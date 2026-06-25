import { KeyValue, MessageType, Request, WebSocketConnectMessage, WebSocketSendMessage } from '../../models/types';
import { AuthService } from '../../services/AuthService';
import { LocalizationService } from '../../services/LocalizationService';
import { VariableService } from '../../services/VariableService';
import { WebSocketConnection, WebSocketService } from '../../services/WebSocketService';
import {
  buildUrl,
  cloneKeyValues,
  createUnresolvedVariableError,
  findUnresolvedVariables,
  normalizeCount,
  normalizeWebSocketKeepAliveInterval,
  normalizeWebSocketKeepAliveMessage,
} from './requestUtils';

export interface WebSocketManagerHost {
  postMessage(message: unknown): void;
  getActiveVariables(): KeyValue[];
  getDefaultHeaders(): KeyValue[];
  getAllowInsecureCertificates(): boolean;
}

interface WebSocketSession {
  connection: WebSocketConnection;
  keepAliveTimer?: ReturnType<typeof setInterval>;
}

export interface WebSocketTimerHost {
  setInterval(callback: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval(timer: ReturnType<typeof setInterval>): void;
}

export class WebSocketManager {
  private readonly sessions = new Map<string, WebSocketSession>();
  private readonly manualDisconnectTabs = new Set<string>();

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
    this.host.postMessage({
      type: MessageType.WebSocketStatus,
      tabId: message.tabId,
      status: 'connecting',
    });

    try {
      const vars = this.host.getActiveVariables();
      const resolvedUrl = VariableService.resolve(message.url, vars);
      const resolvedHeaders = VariableService.resolveKeyValues(message.headers ?? [], vars);
      const resolvedParams = VariableService.resolveKeyValues(message.params ?? [], vars);
      const defaultHeaders = message.skipDefaultHeaders === true
        ? []
        : VariableService.resolveKeyValues(this.host.getDefaultHeaders(), vars);
      const requestKeySet = new Set(
        resolvedHeaders.filter((header) => header.enabled !== false && header.key).map((header) => header.key.toLowerCase())
      );
      const mergedDefaults = defaultHeaders.filter(
        (header) => header.enabled !== false && header.key && !requestKeySet.has(header.key.toLowerCase())
      );
      const finalHeaders = [...mergedDefaults, ...resolvedHeaders];
      const finalParams = [...resolvedParams];
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
      this.sessions.set(message.tabId, { connection });

      connection.on('open', () => {
        this.host.postMessage({
          type: MessageType.WebSocketStatus,
          tabId: message.tabId,
          status: 'open',
        });
        this.startKeepAlive(message.tabId, connection, message);
      });
      connection.on('message', (event) => {
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
          error: error.message,
          errorDetail: this.summarizeError(error),
        });
      });
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
    const session = this.sessions.get(tabId);
    if (!session) { return; }
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
    for (const tabId of Array.from(this.sessions.keys())) {
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

  private sendText(tabId: string, session: WebSocketSession, payload: string): void {
    session.connection.sendText(payload);
    this.host.postMessage({
      type: MessageType.WebSocketMessage,
      tabId,
      direction: 'out',
      messageType: 'text',
      data: payload,
      size: Buffer.byteLength(payload, 'utf-8'),
      timestamp: Date.now(),
    });
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
