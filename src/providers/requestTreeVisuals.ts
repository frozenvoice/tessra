import * as vscode from 'vscode';
import { AuthConfig, HistoryEntry, HttpMethod, KeyValue, Request, RequestBodyType } from '../models/types';
import { LocalizationService } from '../services/LocalizationService';

const METHOD_VISUALS: Record<HttpMethod, { icon: string; color: string }> = {
  GET: { icon: 'arrow-down', color: 'charts.green' },
  POST: { icon: 'arrow-up', color: 'charts.yellow' },
  PUT: { icon: 'arrow-swap', color: 'charts.blue' },
  PATCH: { icon: 'edit', color: 'charts.orange' },
  DELETE: { icon: 'trash', color: 'charts.red' },
  HEAD: { icon: 'preview', color: 'charts.foreground' },
  OPTIONS: { icon: 'settings-gear', color: 'charts.foreground' },
};

function normalizeMethod(method: string): HttpMethod | null {
  const normalized = String(method || '').toUpperCase();
  if (Object.prototype.hasOwnProperty.call(METHOD_VISUALS, normalized)) {
    return normalized as HttpMethod;
  }
  return null;
}

function countEnabled(items: KeyValue[] | undefined): number {
  return (items || []).filter((item) => item && item.enabled !== false && (item.key || item.value)).length;
}

function summarizeAuth(auth: AuthConfig | undefined): string {
  if (!auth || auth.type === 'none') { return LocalizationService.t('webview.authSummaryNone'); }
  if (auth.type === 'basic') { return LocalizationService.t('webview.authSummaryBasic'); }
  if (auth.type === 'bearer') { return LocalizationService.t('webview.authSummaryBearer'); }
  if (auth.type === 'apikey') {
    return auth.apikey?.addTo === 'query'
      ? LocalizationService.t('webview.authSummaryApiKeyQuery')
      : LocalizationService.t('webview.authSummaryApiKeyHeader');
  }
  return auth.type;
}

function summarizeBodyType(bodyType: RequestBodyType | undefined): string {
  if (!bodyType || bodyType === 'none') { return '-'; }
  return bodyType.toUpperCase();
}

function isWebSocketRequest(request: Pick<Request, 'requestType' | 'url'>): boolean {
  return request.requestType === 'websocket' || /^wss?:\/\//i.test(request.url || '');
}

export function getRequestMethodIcon(method: string, request?: Pick<Request, 'requestType' | 'url'>): vscode.ThemeIcon {
  if (request && isWebSocketRequest(request)) {
    return new vscode.ThemeIcon('broadcast', new vscode.ThemeColor('charts.purple'));
  }
  const normalized = normalizeMethod(method);
  if (!normalized) {
    return new vscode.ThemeIcon('globe');
  }
  const visual = METHOD_VISUALS[normalized];
  return new vscode.ThemeIcon(visual.icon, new vscode.ThemeColor(visual.color));
}

export function summarizeRequestLocation(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    const search = parsed.search && parsed.search !== '?' ? parsed.search : '';
    const compact = `${parsed.host}${path}${search}`;
    return compact.length > 42 ? `${compact.slice(0, 39)}...` : compact;
  } catch {
    const raw = String(url || '-');
    return raw.length > 42 ? `${raw.slice(0, 39)}...` : raw;
  }
}

export function buildRequestTreeDescription(request: Pick<Request, 'requestType' | 'method' | 'url' | 'bodyType'>): string {
  const parts = [
    isWebSocketRequest(request) ? 'WS' : String(request.method || 'GET').toUpperCase(),
    summarizeRequestLocation(request.url),
  ];
  if (request.bodyType && request.bodyType !== 'none' && request.bodyType !== 'raw') {
    parts.push(summarizeBodyType(request.bodyType));
  }
  return parts.join(' · ');
}

export function buildRequestTreeTooltip(request: Request): string {
  const headline = `${isWebSocketRequest(request) ? 'WS' : String(request.method || 'GET').toUpperCase()} ${request.url || '-'}`;
  const detailLine = [
    `${LocalizationService.t('webview.params')}: ${countEnabled(request.params)}`,
    `${LocalizationService.t('webview.headers')}: ${countEnabled(request.headers)}`,
    `${LocalizationService.t('webview.body')}: ${summarizeBodyType(request.bodyType)}`,
    `${LocalizationService.t('webview.auth')}: ${summarizeAuth(request.auth)}`,
  ].join(' · ');

  const settings: string[] = [];
  if (request.followRedirects) { settings.push(LocalizationService.t('webview.followRedirectsStatus')); }
  if (request.stopAfterHeaders) { settings.push(LocalizationService.t('webview.stopAfterHeadersStatus')); }
  if (request.saveToHistory === false) { settings.push(LocalizationService.t('webview.saveToHistoryOffStatus')); }
  if (request.skipDefaultHeaders) { settings.push(LocalizationService.t('webview.skipDefaultHeadersStatus')); }
  if (request.disableScripts) { settings.push(LocalizationService.t('webview.disableScriptsStatus')); }

  return [
    request.name || headline,
    headline,
    detailLine,
    settings.length > 0 ? settings.join(' · ') : '',
  ].filter(Boolean).join('\n');
}

export function buildHistoryDescription(entry: HistoryEntry): string {
  const parts = [
    entry.response ? String(entry.response.status) : LocalizationService.t('history.errorShort'),
  ];
  if (entry.response?.time !== undefined) {
    parts.push(`${entry.response.time}ms`);
  }
  if (entry.pinned) {
    parts.push(LocalizationService.t('webview.pin'));
  }
  return parts.join(' · ');
}

export function buildHistoryTooltip(entry: HistoryEntry): string {
  const responseLine = entry.response
    ? `${entry.response.status} ${entry.response.statusText} · ${entry.response.time}ms`
    : LocalizationService.t('history.errorShort');

  return [
    `${isWebSocketRequest(entry.request) ? 'WS' : String(entry.request.method || 'GET').toUpperCase()} ${entry.request.url || '-'}`,
    responseLine,
    LocalizationService.formatDateTime(new Date(entry.timestamp)),
  ].join('\n');
}
