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
export const DEFAULT_MAX_RESPONSE_SIZE_KB = 10 * 1024;

const UNRESOLVED_VAR_PATTERN = /\{\{([^}]+)\}\}/g;
const CIRCULAR_VAR_PREFIX = 'circular:';

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

export function normalizeMaxResponseSizeKb(value: number | undefined): number {
  const normalized = normalizeCount(value);
  return normalized > 0 ? normalized : DEFAULT_MAX_RESPONSE_SIZE_KB;
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
    maxResponseSizeKb: normalizeMaxResponseSizeKb(settings?.maxResponseSizeKb),
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
    // Params는 disable 시 URL에서 제거해야 하므로 enabled=false 행을 유지한다.
    params: cloneAllKeyValues(input.params),
    body: input.body,
    bodyType: input.bodyType,
    formData: cloneFormDataFields(input.formData ?? []),
    binaryFilePath: input.binaryFilePath ?? '',
    auth: JSON.parse(JSON.stringify(input.auth ?? { type: 'none' })),
  };
}

export function findPayloadUnresolvedVariables(
  formData: FormDataField[],
  binaryFilePath: string,
  vars: KeyValue[] = []
): string[] {
  const names = new Set<string>();
  for (const field of formData) {
    if (field.enabled === false) { continue; }
    collectUnresolvedVariableNames(names, field.key);
    collectUnresolvedVariableNames(names, field.value);
    collectCircularVariableNames(names, field.key, vars);
    collectCircularVariableNames(names, field.value, vars);
  }
  collectUnresolvedVariableNames(names, binaryFilePath);
  collectCircularVariableNames(names, binaryFilePath, vars);
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
  collectCircularVariableNames(names, url, vars);
  collectCircularFromKeyValues(names, headers, vars);
  collectCircularFromKeyValues(names, params, vars);
  collectCircularVariableNames(names, body, vars);

  switch (auth.type) {
    case 'basic':
      if (auth.basic) {
        const username = VariableService.resolve(auth.basic.username, vars);
        const password = VariableService.resolve(auth.basic.password, vars);
        collectUnresolvedVariableNames(names, username);
        collectUnresolvedVariableNames(names, password);
        collectCircularVariableNames(names, username, vars);
        collectCircularVariableNames(names, password, vars);
      }
      break;
    case 'bearer':
      if (auth.bearer) {
        const token = VariableService.resolve(auth.bearer.token, vars);
        collectUnresolvedVariableNames(names, token);
        collectCircularVariableNames(names, token, vars);
      }
      break;
    case 'apikey':
      if (auth.apikey) {
        const key = VariableService.resolve(auth.apikey.key, vars);
        const value = VariableService.resolve(auth.apikey.value, vars);
        collectUnresolvedVariableNames(names, key);
        collectUnresolvedVariableNames(names, value);
        collectCircularVariableNames(names, key, vars);
        collectCircularVariableNames(names, value, vars);
      }
      break;
  }

  return [...names];
}

export function createUnresolvedVariableError(names: string[]): string {
  const circular = [...new Set(names
    .filter((name) => name.startsWith(CIRCULAR_VAR_PREFIX))
    .map((name) => name.slice(CIRCULAR_VAR_PREFIX.length)))];
  const circularSet = new Set(circular);
  const unresolved = [...new Set(names
    .filter((name) => !name.startsWith(CIRCULAR_VAR_PREFIX))
    .filter((name) => !circularSet.has(name)))];
  const parts: string[] = [];
  if (unresolved.length > 0) {
    parts.push(`Unresolved environment variables: ${unresolved.map((name) => `{{${name}}}`).join(', ')}`);
  }
  if (circular.length > 0) {
    parts.push(`Circular environment variable references: ${circular.map((name) => `{{${name}}}`).join(', ')}`);
  }
  return parts.join('; ');
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

export type UrlQueryPair = { key: string; value: string };

export type UrlParts = {
  base: string;
  query: string;
  fragment: string;
  pairs: UrlQueryPair[];
};

/** URL을 base / query / fragment로 분리한다. `{{var}}`가 포함된 URL도 허용한다. */
export function splitUrlParts(rawUrl: string): UrlParts {
  const raw = String(rawUrl ?? '');
  let working = raw;
  let fragment = '';
  const hashIndex = working.indexOf('#');
  if (hashIndex >= 0) {
    fragment = working.slice(hashIndex);
    working = working.slice(0, hashIndex);
  }

  let base = working;
  let query = '';
  const questionIndex = working.indexOf('?');
  if (questionIndex >= 0) {
    base = working.slice(0, questionIndex);
    query = working.slice(questionIndex + 1);
  }

  return {
    base,
    query,
    fragment,
    pairs: parseQueryString(query),
  };
}

/** application/x-www-form-urlencoded 스타일 쿼리 문자열을 순서 보존으로 파싱한다. */
export function parseQueryString(query: string): UrlQueryPair[] {
  if (!query) { return []; }
  return query
    .split('&')
    .filter((part) => part.length > 0)
    .map((part) => {
      const eqIndex = part.indexOf('=');
      if (eqIndex < 0) {
        return { key: decodeQueryComponent(part), value: '' };
      }
      return {
        key: decodeQueryComponent(part.slice(0, eqIndex)),
        value: decodeQueryComponent(part.slice(eqIndex + 1)),
      };
    })
    .filter((pair) => pair.key.length > 0);
}

/**
 * Params 탭이 비어 있으면 URL 쿼리를 시드하고,
 * Params에 키가 있으면(비활성 포함) Params를 쿼리의 단일 소스로 쓴다.
 * 의도적 중복 키는 그대로 유지한다.
 */
export function coalesceQueryParams(url: string, params: KeyValue[]): KeyValue[] {
  const structured = (params ?? [])
    .filter((param) => !!param.key)
    .map((param) => ({
      key: param.key,
      value: param.value ?? '',
      enabled: param.enabled !== false,
    }));

  if (structured.length > 0) {
    return structured;
  }

  return splitUrlParts(url).pairs.map((pair) => ({
    key: pair.key,
    value: pair.value,
    enabled: true,
  }));
}

/**
 * 최종 요청 URL을 만든다.
 * - Params에 keyed row가 있으면 URL 쿼리를 제거하고 enabled Params만 직렬화한다.
 * - Params가 비어 있으면 원본 URL(쿼리 포함)을 유지한다.
 * - 같은 키 중복은 dedupe하지 않는다.
 * - fragment는 보존한다.
 */
export function buildUrl(baseUrl: string, params: KeyValue[]): string {
  const parts = splitUrlParts(baseUrl);
  const structured = (params ?? []).filter((param) => !!param.key);
  const active = structured.filter((param) => param.enabled !== false);

  if (structured.length === 0) {
    return baseUrl;
  }

  if (active.length === 0) {
    return parts.base + parts.fragment;
  }

  const query = active
    .map((param) => `${encodeQueryComponent(param.key)}=${encodeQueryComponent(param.value ?? '')}`)
    .join('&');
  return `${parts.base}?${query}${parts.fragment}`;
}

/** enabled 여부와 관계없이 key가 있는 KV를 복제한다 (Params disable 의미 보존용). */
export function cloneAllKeyValues(items: KeyValue[]): KeyValue[] {
  return items
    .filter((item) => !!item.key)
    .map((item) => ({
      key: item.key,
      value: item.value ?? '',
      enabled: item.enabled !== false,
    }));
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(String(value ?? '').replace(/\+/g, ' '));
  } catch {
    return String(value ?? '').replace(/\+/g, ' ');
  }
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(String(value ?? ''));
}

function collectUnresolvedFromKeyValues(target: Set<string>, items: KeyValue[]): void {
  for (const item of items) {
    if (item.enabled === false) { continue; }
    collectUnresolvedVariableNames(target, item.key);
    collectUnresolvedVariableNames(target, item.value);
  }
}

function collectCircularFromKeyValues(target: Set<string>, items: KeyValue[], vars: KeyValue[]): void {
  for (const item of items) {
    if (item.enabled === false) { continue; }
    collectCircularVariableNames(target, item.key, vars);
    collectCircularVariableNames(target, item.value, vars);
  }
}

function collectUnresolvedVariableNames(target: Set<string>, text: string): void {
  if (!text) { return; }
  for (const match of text.matchAll(UNRESOLVED_VAR_PATTERN)) {
    const name = match[1]?.trim();
    if (name) { target.add(name); }
  }
}

function collectCircularVariableNames(target: Set<string>, text: string, vars: KeyValue[]): void {
  if (!text || vars.length === 0) { return; }
  for (const name of VariableService.findCircularReferences(text, vars)) {
    target.add(`${CIRCULAR_VAR_PREFIX}${name}`);
  }
}
