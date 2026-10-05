import { KeyValue, MessageType, Request, WebSocketConnectMessage, WebSocketSendMessage } from '../../models/types';
import { AuthService } from '../../services/AuthService';
import { LocalizationService } from '../../services/LocalizationService';
import { PathVariableService } from '../../services/PathVariableService';
import { VariableService } from '../../services/VariableService';
import { WebSocketConnection, WebSocketService } from '../../services/WebSocketService';
import { ExecutionContext } from './executionContext';
import { SecretExecutionHost, requestVariableTexts, secretDiagnostic } from './secretExecution';
import { SecretRedactor } from '../../services/secretVariables';
import {
  buildUrl,
  coalesceQueryParams,
  cloneKeyValues,
  createUnresolvedVariableError,
  findUnresolvedVariables,
  normalizeCount,
  normalizeWebSocketKeepAliveInterval,
  normalizeWebSocketKeepAliveMessage,
} from './requestUtils';

export interface WebSocketManagerHost extends SecretExecutionHost {
  captureExecutionContext?(): ExecutionContext;
  isExecutionContextCurrent?(context: ExecutionContext): boolean;
  getExecutionVariables?(context: ExecutionContext): KeyValue[];
  postMessage(message: unknown): void;
  getActiveVariables(): KeyValue[];
  getDefaultHeaders(): KeyValue[];
  getAllowInsecureCertificates(): boolean;
}

interface WebSocketSession {
  connection: WebSocketConnection;
  context?: ExecutionContext;
  variables: KeyValue[];
  redactor: SecretRedactor;
  keepAliveBusy?: boolean;
  keepAliveTimer?: ReturnType<typeof setInterval>;
}

export interface WebSocketTimerHost {
  setInterval(callback: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval(timer: ReturnType<typeof setInterval>): void;
}

export class WebSocketManager {
  private readonly sessions = new Map<string, WebSocketSession>();
  private readonly manualDisconnectTabs = new Set<string>();
  private readonly pendingConnects = new Map<string, object>();

  constructor(
    private readonly service: WebSocketService,
    private readonly host: WebSocketManagerHost,
    private readonly timers: WebSocketTimerHost = {
      setInterval: (callback, ms) => setInterval(callback, ms),
      clearInterval: (timer) => clearInterval(timer),
    }
  ) {}

  connect(message: WebSocketConnectMessage): void {
    this.disconnect(message.tabId, false);
    const pending = {};
    this.pendingConnects.set(message.tabId, pending);
    this.host.postMessage({
      type: MessageType.WebSocketStatus,
      tabId: message.tabId,
      status: 'connecting',
    });

    const variables = this.host.getActiveVariables().map((row) => ({ ...row }));
    const defaults = message.skipDefaultHeaders === true ? [] : cloneKeyValues(this.host.getDefaultHeaders());
    const context = this.host.captureExecutionContext?.();
    if (this.host.resolveSecretVariables && context) {
      const texts = requestVariableTexts({ ...message, body: '', bodyType: 'none' }, defaults);
      void this.host.resolveSecretVariables(context, variables, texts, false).then(({ variables: resolved, redactor }) => {
        if (!this.isPendingCurrent(message.tabId, pending, context)) { return; }
        this.connectResolved(message, resolved, defaults, variables, context, redactor);
      }).catch((error) => {
        if (this.isPendingCurrent(message.tabId, pending, context)) {
          this.pendingConnects.delete(message.tabId);
          this.postError(message.tabId, error);
        }
      });
    } else {
      this.connectResolved(message, variables, defaults, variables, context, new SecretRedactor([]));
    }
  }

  private connectResolved(message: WebSocketConnectMessage, vars: KeyValue[], sourceDefaults: KeyValue[], sourceVariables: KeyValue[], context: ExecutionContext | undefined, redactor: SecretRedactor): void {
    try {
      const pathVariableOverrides = PathVariableService.pruneOverrides(
        message.url,
        message.pathVariableOverrides
      );
      const resolvedUrl = PathVariableService.resolveUrl(message.url, pathVariableOverrides, vars);
      const resolvedHeaders = VariableService.resolveKeyValues(message.headers ?? [], vars);
      const resolvedParams = VariableService.resolveKeyValues(message.params ?? [], vars);
      const defaultHeaders = message.skipDefaultHeaders === true
        ? []
        : VariableService.resolveKeyValues(sourceDefaults, vars);
      const requestKeySet = new Set(
        resolvedHeaders.filter((header) => header.enabled !== false && header.key).map((header) => header.key.toLowerCase())
      );
      const mergedDefaults = defaultHeaders.filter(
        (header) => header.enabled !== false && header.key && !requestKeySet.has(header.key.toLowerCase())
      );
      const finalHeaders = [...mergedDefaults, ...resolvedHeaders];
      const finalParams = coalesceQueryParams(resolvedUrl, resolvedParams);
      const auth = message.auth ?? { type: 'none' as const };
      const unresolvedVariables = findUnresolvedVariables(
        resolvedUrl,
        finalHeaders,
        finalParams,
        '',
        auth,
        vars
      );
      if (unresolvedVariables.length > 0) {
        throw new Error(createUnresolvedVariableError(unresolvedVariables));
      }

      AuthService.applyAuth(auth, finalHeaders, finalParams, vars);
      const url = buildUrl(resolvedUrl, finalParams);
      if (!/^wss?:\/\//i.test(url)) {
        throw new Error(LocalizationService.t('panel.websocketUrlRequired'));
      }

      const connection = this.service.connect(url, cloneKeyValues(finalHeaders), {
        timeoutSec: normalizeCount(message.timeout),
        allowInsecureHttps: this.resolveAllowInsecureHttps(message.tlsValidation),
      });
      this.pendingConnects.delete(message.tabId);
      this.sessions.set(message.tabId, { connection, context, variables: sourceVariables, redactor });

      connection.on('open', () => {
        if (this.sessions.get(message.tabId)?.connection !== connection) { return; }
        this.host.postMessage({
          type: MessageType.WebSocketStatus,
          tabId: message.tabId,
          status: 'open',
        });
        this.startKeepAlive(message.tabId, connection, message);
      });
      connection.on('message', (event) => {
        if (this.sessions.get(message.tabId)?.connection !== connection) { return; }
        this.host.postMessage({
          type: MessageType.WebSocketMessage,
          tabId: message.tabId,
          direction: 'in',
          messageType: event.type,
          data: event.data,
          size: event.size,
          timestamp: Date.now(),
        });
      });
      connection.on('close', (info) => {
        if (this.sessions.get(message.tabId)?.connection !== connection) { return; }
        const session = this.sessions.get(message.tabId);
        if (session) {
          this.stopKeepAlive(message.tabId, session);
          this.sessions.delete(message.tabId);
        }
        const closeSource = this.manualDisconnectTabs.delete(message.tabId)
          ? 'user'
          : (info.wasClean ? 'remote' : 'unexpected');
        this.host.postMessage({
          type: MessageType.WebSocketStatus,
          tabId: message.tabId,
          status: 'closed',
          code: closeSource === 'user' ? (info.code ?? 1000) : info.code,
          reason: closeSource === 'user' ? (info.reason || 'User disconnect') : info.reason,
          wasClean: closeSource === 'user' ? true : info.wasClean,
          closeSource,
        });
      });
      connection.on('error', (error) => {
        if (this.sessions.get(message.tabId)?.connection !== connection) { return; }
        const session = this.sessions.get(message.tabId);
        if (session) {
          this.stopKeepAlive(message.tabId, session);
          this.sessions.delete(message.tabId);
        }
        this.manualDisconnectTabs.delete(message.tabId);
        this.host.postMessage({
          type: MessageType.WebSocketStatus,
          tabId: message.tabId,
          status: 'error',
          error: redactor.mask(error.message),
          errorDetail: redactor.mask(this.summarizeError(error) ?? ''),
        });
      });
    } catch (error: unknown) {
      this.pendingConnects.delete(message.tabId);
      this.postError(message.tabId, error, redactor);
    }
  }

  send(message: WebSocketSendMessage): void {
    const session = this.sessions.get(message.tabId);
    if (!session) {
      this.host.postMessage({
        type: MessageType.WebSocketStatus,
        tabId: message.tabId,
        status: 'error',
        error: LocalizationService.t('panel.websocketNotConnected'),
      });
      return;
    }

    if (this.host.resolveSecretVariables && session.context) {
      void this.resolvePayload(message.tabId, session, message.message ?? '').then((resolved) => {
        if (!resolved) { return; }
        try { this.sendText(message.tabId, session, resolved.payload, resolved.redactor); }
        catch (error) { this.postError(message.tabId, error, resolved.redactor); }
      }).catch((error) => {
        if (this.isSessionCurrent(message.tabId, session)) { this.postError(message.tabId, error, session.redactor); }
      });
      return;
    }
    try {
      const payload = VariableService.resolve(message.message ?? '', this.host.getActiveVariables());
      this.sendText(message.tabId, session, payload);
    } catch (error: unknown) {
      this.host.postMessage({
        type: MessageType.WebSocketStatus,
        tabId: message.tabId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        errorDetail: error instanceof Error ? this.summarizeError(error) : undefined,
      });
    }
  }

  disconnect(tabId: string, notify = true): void {
    const wasPending = this.pendingConnects.delete(tabId);
    const session = this.sessions.get(tabId);
    if (!session) {
      if (wasPending && notify) { this.host.postMessage({ type: MessageType.WebSocketStatus, tabId, status: 'closed', closeSource: 'user', wasClean: true }); }
      return;
    }
    if (notify) {
      this.manualDisconnectTabs.add(tabId);
    }
    this.stopKeepAlive(tabId, session);
    this.sessions.delete(tabId);
    session.connection.close(1000, 'User disconnect');
    if (notify) {
      const isManualDisconnect = this.manualDisconnectTabs.delete(tabId);
      this.host.postMessage({
        type: MessageType.WebSocketStatus,
        tabId,
        status: 'closed',
        code: 1000,
        reason: 'User disconnect',
        wasClean: true,
        closeSource: isManualDisconnect ? 'user' : 'unexpected',
      });
    }
  }

  disconnectAll(): void {
    for (const tabId of new Set([...this.sessions.keys(), ...this.pendingConnects.keys()])) {
      this.disconnect(tabId);
    }
  }

  private resolveAllowInsecureHttps(tlsValidation: Request['tlsValidation']): boolean {
    if (tlsValidation === 'insecure') { return true; }
    if (tlsValidation === 'strict') { return false; }
    return this.host.getAllowInsecureCertificates();
  }

  private startKeepAlive(tabId: string, connection: WebSocketConnection, message: WebSocketConnectMessage): void {
    if (message.webSocketKeepAliveEnabled !== true) { return; }
    const session = this.sessions.get(tabId);
    if (!session || session.connection !== connection) { return; }

    this.stopKeepAlive(tabId, session, false);
    const intervalSeconds = normalizeWebSocketKeepAliveInterval(message.webSocketKeepAliveIntervalSeconds);
    const rawPayload = normalizeWebSocketKeepAliveMessage(message.webSocketKeepAliveMessage);
    this.postSystemMessage(tabId, LocalizationService.t('panel.websocketKeepAliveEnabled', { seconds: intervalSeconds }));
    session.keepAliveTimer = this.timers.setInterval(() => {
      const activeSession = this.sessions.get(tabId);
      if (!activeSession || activeSession.connection !== connection) {
        this.stopKeepAlive(tabId, session, false);
        return;
      }
      if (this.host.resolveSecretVariables && session.context) {
        if (session.keepAliveBusy) { return; }
        session.keepAliveBusy = true;
        void this.resolvePayload(tabId, session, rawPayload).then((resolved) => {
          if (!resolved) { return; }
          try { connection.sendPing(resolved.payload); }
          catch (error) { this.stopKeepAlive(tabId, session); this.postError(tabId, error, resolved.redactor); return; }
          this.postSystemMessage(tabId, LocalizationService.t('panel.websocketKeepAlivePingSent'));
        }).catch((error) => {
          if (this.isSessionCurrent(tabId, session)) { this.stopKeepAlive(tabId, session); this.postError(tabId, error, session.redactor); }
        }).finally(() => { session.keepAliveBusy = false; });
        return;
      }
      try {
        const payload = VariableService.resolve(rawPayload, this.host.getActiveVariables());
        activeSession.connection.sendPing(payload);
        this.postSystemMessage(tabId, LocalizationService.t('panel.websocketKeepAlivePingSent'));
      } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : String(error);
        this.postSystemMessage(
          tabId,
          LocalizationService.t('panel.websocketKeepAliveSendFailed', { message: messageText })
        );
        this.stopKeepAlive(tabId, activeSession);
        this.host.postMessage({
          type: MessageType.WebSocketStatus,
          tabId,
          status: 'error',
          error: messageText,
          errorDetail: error instanceof Error ? this.summarizeError(error) : undefined,
        });
      }
    }, intervalSeconds * 1000);
  }

  private stopKeepAlive(tabId: string, session: WebSocketSession, notify = true): void {
    if (!session.keepAliveTimer) { return; }
    this.timers.clearInterval(session.keepAliveTimer);
    session.keepAliveTimer = undefined;
    if (notify) {
      this.postSystemMessage(tabId, LocalizationService.t('panel.websocketKeepAliveStopped'));
    }
  }

  private sendText(tabId: string, session: WebSocketSession, payload: string, redactor = session.redactor): void {
    session.connection.sendText(payload);
    this.host.postMessage({
      type: MessageType.WebSocketMessage,
      tabId,
      direction: 'out',
      messageType: 'text',
      data: redactor.mask(payload),
      size: Buffer.byteLength(payload, 'utf-8'),
      timestamp: Date.now(),
    });
  }

  private isPendingCurrent(tabId: string, pending: object, context: ExecutionContext): boolean {
    return this.pendingConnects.get(tabId) === pending && this.host.isExecutionContextCurrent?.(context) !== false;
  }

  private isSessionCurrent(tabId: string, session: WebSocketSession): boolean {
    return this.sessions.get(tabId) === session && (!session.context || this.host.isExecutionContextCurrent?.(session.context) !== false);
  }

  private async resolvePayload(tabId: string, session: WebSocketSession, raw: string) {
    // 각 Send/Ping은 원래 연결의 환경에서 현재 보호 metadata를 읽는다. 연결 당시 평문 snapshot으로 새 보호를 우회하지 않는다.
    const source = this.host.getExecutionVariables?.(session.context!) ?? session.variables;
    const result = await this.host.resolveSecretVariables!(session.context!, source, [raw], false);
    if (!this.isSessionCurrent(tabId, session)) { return undefined; }
    const payload = VariableService.resolve(raw, result.variables);
    const unresolved = [...new Set([...payload.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1].trim()))];
    if (unresolved.length > 0) { throw new Error(createUnresolvedVariableError(unresolved)); }
    return { payload, redactor: result.redactor };
  }

  private postError(tabId: string, error: unknown, redactor = new SecretRedactor([])): void {
    this.host.postMessage({ type: MessageType.WebSocketStatus, tabId, status: 'error', error: secretDiagnostic(error, redactor) });
  }

  private postSystemMessage(tabId: string, data: string): void {
    this.host.postMessage({
      type: MessageType.WebSocketMessage,
      tabId,
      direction: 'in',
      messageType: 'system',
      data,
      timestamp: Date.now(),
    });
  }

  private summarizeError(error: Error): string | undefined {
    const detail = error.stack || error.message;
    if (!detail) { return undefined; }
    return detail.length > 600 ? `${detail.slice(0, 597)}...` : detail;
  }
}
