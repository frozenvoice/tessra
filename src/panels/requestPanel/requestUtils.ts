import {
  AuthConfig,
  FormDataField,
  KeyValue,
  Request,
  RequestBodyType,
  RequestScripts,
  RequestSettings,
  TlsValidationMode,
} from '../../models/types';
import { ScriptableRequest } from '../../services/ScriptRunner';
import { VariableService } from '../../services/VariableService';

export type ResolvedRequestSettings = {
  timeout: number;
  followRedirects: boolean;
  saveToHistory: boolean;
  tlsValidation: TlsValidationMode;
  maxResponseSizeKb: number;
  retryCount: number;
  retryDelayMs: number;
  stopAfterHeaders: boolean;
  skipDefaultHeaders: boolean;
  disableScripts: boolean;
  scriptsTrusted: boolean;
  webSocketKeepAliveEnabled: boolean;
  webSocketKeepAliveIntervalSeconds: number;
  webSocketKeepAliveMessage: string;
};

export type RequestTiming = {
  requestStartedAt?: number;
  requestEndedAt: number;
  durationMs?: number;
};

export const DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS = 30;
export const MIN_WS_KEEPALIVE_INTERVAL_SECONDS = 5;
export const MAX_WS_KEEPALIVE_INTERVAL_SECONDS = 300;
export const DEFAULT_WS_KEEPALIVE_MESSAGE = 'ping';

const UNRESOLVED_VAR_PATTERN = /\{\{([^}]+)\}\}/g;

export function normalizeBodyType(bodyType: string | undefined): RequestBodyType {
  switch (bodyType) {
    case 'json':
    case 'xml':
    case 'form':
    case 'formdata':
    case 'binary':
    case 'raw':
    case 'none':
      return bodyType;
    case 'text':
      return 'raw';
    default:
      return 'none';
  }
}

export function normalizeMethod(method: string | undefined, fallback: Request['method'] = 'GET'): Request['method'] {
  const normalized = String(method || '').toUpperCase();
  switch (normalized) {
    case 'GET':
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
    case 'HEAD':
    case 'OPTIONS':
      return normalized as Request['method'];
    default:
      return fallback;
  }
}

export function createEmptyScripts(): RequestScripts {
  return { preRequest: '', test: '' };
}

export function hasExecutableScripts(scripts: RequestScripts | undefined): boolean {
  return !!(scripts?.preRequest?.trim() || scripts?.test?.trim());
}

export function normalizeCount(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value as number) : 0;
}

export function normalizeWebSocketKeepAliveInterval(value: number | undefined): number {
  const normalized = normalizeCount(value);
  if (normalized <= 0) { return DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS; }
  return Math.min(MAX_WS_KEEPALIVE_INTERVAL_SECONDS, Math.max(MIN_WS_KEEPALIVE_INTERVAL_SECONDS, normalized));
}

export function normalizeWebSocketKeepAliveMessage(value: string | undefined): string {
  const normalized = String(value ?? '').trim();
  return normalized || DEFAULT_WS_KEEPALIVE_MESSAGE;
}

export function normalizeEpochMs(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) { return undefined; }
  const normalized = Math.floor(value as number);
  return normalized > 0 ? normalized : undefined;
}

export function createRequestTiming(startedAt?: number): RequestTiming {
  const requestStartedAt = normalizeEpochMs(startedAt);
  const requestEndedAt = Date.now();
  return {
    requestStartedAt,
    requestEndedAt,
    durationMs: requestStartedAt === undefined ? undefined : Math.max(0, requestEndedAt - requestStartedAt),
  };
}

export function normalizeRequestSettings(settings?: RequestSettings): ResolvedRequestSettings {
  const tlsValidation = settings?.tlsValidation === 'strict' || settings?.tlsValidation === 'insecure'
    ? settings.tlsValidation
    : 'default';

  return {
    timeout: normalizeCount(settings?.timeout),
    followRedirects: settings?.followRedirects === true,
    saveToHistory: settings?.saveToHistory !== false,
    tlsValidation,
    maxResponseSizeKb: normalizeCount(settings?.maxResponseSizeKb),
    retryCount: normalizeCount(settings?.retryCount),
    retryDelayMs: normalizeCount(settings?.retryDelayMs),
    stopAfterHeaders: settings?.stopAfterHeaders === true,
    skipDefaultHeaders: settings?.skipDefaultHeaders === true,
    disableScripts: settings?.disableScripts === true,
    scriptsTrusted: settings?.scriptsTrusted !== false,
    webSocketKeepAliveEnabled: settings?.webSocketKeepAliveEnabled === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(settings?.webSocketKeepAliveIntervalSeconds),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(settings?.webSocketKeepAliveMessage),
  };
}

export function isScriptExecutionBlocked(
  scripts: RequestScripts | undefined,
  settings: ResolvedRequestSettings
): boolean {
  return !settings.disableScripts && !settings.scriptsTrusted && hasExecutableScripts(scripts);
}

export function cloneRequestSettings(settings: ResolvedRequestSettings): RequestSettings {
  return {
    timeout: settings.timeout,
    followRedirects: settings.followRedirects,
    saveToHistory: settings.saveToHistory,
    tlsValidation: settings.tlsValidation,
    maxResponseSizeKb: settings.maxResponseSizeKb,
    retryCount: settings.retryCount,
    retryDelayMs: settings.retryDelayMs,
    stopAfterHeaders: settings.stopAfterHeaders,
    skipDefaultHeaders: settings.skipDefaultHeaders,
    disableScripts: settings.disableScripts,
    scriptsTrusted: settings.scriptsTrusted,
    webSocketKeepAliveEnabled: settings.webSocketKeepAliveEnabled,
    webSocketKeepAliveIntervalSeconds: settings.webSocketKeepAliveIntervalSeconds,
    webSocketKeepAliveMessage: settings.webSocketKeepAliveMessage,
  };
}

export function shouldRetryResponse(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function createCancelableDelay(
  ms: number,
  registerCancel?: (cancel: (() => void) | null) => void
): Promise<void> {
  if (ms <= 0) { return Promise.resolve(); }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      registerCancel?.(null);
      resolve();
    }, ms);

    registerCancel?.(() => {
      clearTimeout(timer);
      registerCancel?.(null);
      reject(new Error('Request was canceled'));
    });
  });
}

export function cloneKeyValues(items: KeyValue[]): KeyValue[] {
  return items
    .filter((item) => item.enabled !== false && item.key)
    .map((item) => ({
      key: item.key,
      value: item.value,
      enabled: true,
    }));
}

export function cloneFormDataFields(fields: FormDataField[]): FormDataField[] {
  return (fields ?? []).map((field) => ({ ...field }));
}

export function normalizeScripts(scripts: RequestScripts | undefined): RequestScripts {
  return scripts ?? createEmptyScripts();
}

export function createScriptableRequest(input: {
  method: Request['method'];
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
}): ScriptableRequest {
  return {
    method: input.method,
    url: input.url,
    headers: cloneKeyValues(input.headers),
    params: cloneKeyValues(input.params),
    body: input.body,
    bodyType: input.bodyType,
    formData: cloneFormDataFields(input.formData ?? []),
    binaryFilePath: input.binaryFilePath ?? '',
    auth: JSON.parse(JSON.stringify(input.auth ?? { type: 'none' })),
  };
}

export function findPayloadUnresolvedVariables(
  formData: FormDataField[],
  binaryFilePath: string
): string[] {
  const names = new Set<string>();
  for (const field of formData) {
    if (field.enabled === false) { continue; }
    collectUnresolvedVariableNames(names, field.key);
    collectUnresolvedVariableNames(names, field.value);
  }
  collectUnresolvedVariableNames(names, binaryFilePath);
  return [...names];
}

export function findUnresolvedVariables(
  url: string,
  headers: KeyValue[],
  params: KeyValue[],
  body: string,
  auth: AuthConfig,
  vars: KeyValue[]
): string[] {
  const names = new Set<string>();
  collectUnresolvedVariableNames(names, url);
  collectUnresolvedFromKeyValues(names, headers);
  collectUnresolvedFromKeyValues(names, params);
  collectUnresolvedVariableNames(names, body);

  switch (auth.type) {
    case 'basic':
      if (auth.basic) {
        collectUnresolvedVariableNames(names, VariableService.resolve(auth.basic.username, vars));
        collectUnresolvedVariableNames(names, VariableService.resolve(auth.basic.password, vars));
      }
      break;
    case 'bearer':
      if (auth.bearer) {
        collectUnresolvedVariableNames(names, VariableService.resolve(auth.bearer.token, vars));
      }
      break;
    case 'apikey':
      if (auth.apikey) {
        collectUnresolvedVariableNames(names, VariableService.resolve(auth.apikey.key, vars));
        collectUnresolvedVariableNames(names, VariableService.resolve(auth.apikey.value, vars));
      }
      break;
  }

  return [...names];
}

export function createUnresolvedVariableError(names: string[]): string {
  return `Unresolved environment variables: ${names.map((name) => `{{${name}}}`).join(', ')}`;
}

export function createHistoryRequestSnapshot(
  method: string,
  url: string,
  headers: KeyValue[],
  body: string,
  bodyType: RequestBodyType,
  formData: FormDataField[] = [],
  binaryFilePath: string = '',
  settings?: RequestSettings
): Request {
  const normalizedSettings = normalizeRequestSettings(settings);
  return {
    id: '',
    name: `${method} ${url}`,
    method: method as Request['method'],
    url,
    headers: cloneKeyValues(headers),
    params: [],
    body,
    bodyType,
    formData: cloneFormDataFields(formData),
    binaryFilePath,
    auth: { type: 'none' },
    scripts: createEmptyScripts(),
    ...cloneRequestSettings(normalizedSettings),
  };
}

export function buildUrl(baseUrl: string, params: KeyValue[]): string {
  const active = params.filter((p) => p.enabled && p.key);
  if (active.length === 0) { return baseUrl; }
  try {
    const url = new URL(baseUrl);
    for (const p of active) { url.searchParams.append(p.key, p.value); }
    return url.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const qs = active.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    return baseUrl + sep + qs;
  }
}

function collectUnresolvedFromKeyValues(target: Set<string>, items: KeyValue[]): void {
  for (const item of items) {
    if (item.enabled === false) { continue; }
    collectUnresolvedVariableNames(target, item.key);
    collectUnresolvedVariableNames(target, item.value);
  }
}

function collectUnresolvedVariableNames(target: Set<string>, text: string): void {
  if (!text) { return; }
  for (const match of text.matchAll(UNRESOLVED_VAR_PATTERN)) {
    const name = match[1]?.trim();
    if (name) { target.add(name); }
  }
}
