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
} from './requestUtils';

export interface WebSocketManagerHost {
  postMessage(message: unknown): void;
  getActiveVariables(): KeyValue[];
  getDefaultHeaders(): KeyValue[];
  getAllowInsecureCertificates(): boolean;
}

interface WebSocketSession {
  connection: WebSocketConnection;
}

export class WebSocketManager {
  private readonly sessions = new Map<string, WebSocketSession>();

  constructor(
    private readonly service: WebSocketService,
    private readonly host: WebSocketManagerHost
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
        this.sessions.delete(message.tabId);
        this.host.postMessage({
          type: MessageType.WebSocketStatus,
          tabId: message.tabId,
          status: 'closed',
          code: info.code,
          reason: info.reason,
        });
      });
      connection.on('error', (error) => {
        if (this.sessions.get(message.tabId)?.connection !== connection) { return; }
        this.sessions.delete(message.tabId);
        this.host.postMessage({
          type: MessageType.WebSocketStatus,
          tabId: message.tabId,
          status: 'error',
          error: error.message,
        });
      });
    } catch (error: unknown) {
      this.host.postMessage({
        type: MessageType.WebSocketStatus,
        tabId: message.tabId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
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
      session.connection.sendText(payload);
      this.host.postMessage({
        type: MessageType.WebSocketMessage,
        tabId: message.tabId,
        direction: 'out',
        messageType: 'text',
        data: payload,
        size: Buffer.byteLength(payload, 'utf-8'),
        timestamp: Date.now(),
      });
    } catch (error: unknown) {
      this.host.postMessage({
        type: MessageType.WebSocketStatus,
        tabId: message.tabId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  disconnect(tabId: string, notify = true): void {
    const session = this.sessions.get(tabId);
    if (!session) { return; }
    this.sessions.delete(tabId);
    session.connection.close(1000, 'Tessra disconnect');
    if (notify) {
      this.host.postMessage({
        type: MessageType.WebSocketStatus,
        tabId,
        status: 'closed',
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
}
