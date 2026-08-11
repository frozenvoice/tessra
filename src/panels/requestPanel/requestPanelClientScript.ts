import { getRequestPanelBodyClientScript } from './requestPanelBodyClientScript';
import { getRequestPanelResponseClientScript } from './requestPanelResponseClientScript';
import { getRequestPanelRunnerClientScript } from './requestPanelRunnerClientScript';

export interface RequestPanelClientScriptInput {
  localizedStrings: string;
  dateLocale: string;
  displayLanguage: string;
  requestPanelTheme: string;
}

export function getRequestPanelClientScript(input: RequestPanelClientScriptInput): string {
  const { localizedStrings, dateLocale, displayLanguage, requestPanelTheme } = input;
  return /*js*/ `
const vscode = acquireVsCodeApi();
let i18n = ${localizedStrings};
let appDateLocale = ${JSON.stringify(dateLocale)};
let currentDisplayLanguage = ${JSON.stringify(displayLanguage)};
const REQUEST_PANEL_THEMES = ['default', 'minimal-cool', 'product', 'bold-color'];
let currentRequestPanelTheme = ${JSON.stringify(requestPanelTheme)};


let tabs = [];       // { id, name, method, url, headers, params, body, auth, response, error, loading }
let activeTabId = null;
let tabIdCounter = 0;
let currentEnvName = null;
let currentWorkspaceProfile = 'default';
let editingEnvId = null;
let envEditorEnvName = null;
let envEditorVariableCount = 0;
let activeVarKeys = [];
let activeVarValues = {};
let workspaceDefaultHeaders = [];
let pendingSaveBtn = null;
let pendingSaveResponseBtn = null;
var _pendingCloseAfterSave = null;
const VALID_BODY_TYPES = ['none', 'json', 'xml', 'form', 'formdata', 'binary', 'raw'];

const DEFAULT_COMPARE_IGNORE_HEADERS = ['date', 'set-cookie', 'x-request-id', 'x-correlation-id', 'x-amzn-trace-id'];
const DEFAULT_COMPARE_IGNORE_JSON_PATHS = ['$.timestamp', '$.traceId', '$.requestId', '$.correlationId'];
const DEFAULT_COMPARE_FOLD_UNCHANGED = true;
const DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS = 30;
const MIN_WS_KEEPALIVE_INTERVAL_SECONDS = 5;
const MAX_WS_KEEPALIVE_INTERVAL_SECONDS = 300;
const DEFAULT_WS_KEEPALIVE_MESSAGE = 'ping';
const DEFAULT_MAX_RESPONSE_SIZE_KB = 10240;
const REQUEST_EDITOR_TABS = ['params', 'headers', 'body', 'auth', 'scripts', 'settings'];
var pinnedResponses = [];
var lastResponse = null;
var compareSettings = normalizeCompareSettings();
var activeFormatMenuState = null;
var splitDragState = null;
var contentDelegatedEventsBound = false;

function closeActiveFormatMenu() {
  if (!activeFormatMenuState) return;
  if (activeFormatMenuState.menu) activeFormatMenuState.menu.classList.remove('open');
  if (activeFormatMenuState.button) activeFormatMenuState.button.setAttribute('aria-expanded', 'false');
  activeFormatMenuState = null;
}

function getOpenActionsMenuItems(menu) {
  if (!menu) return [];
  return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]')).filter(function(item) {
    return !item.disabled && item.getAttribute('aria-disabled') !== 'true';
  });
}

function focusActionsMenuItem(menu, index) {
  var items = getOpenActionsMenuItems(menu);
  if (!items.length) return;
  var next = items[(index % items.length + items.length) % items.length];
  if (next && typeof next.focus === 'function') next.focus();
}

function handleActionsMenuKeydown(event) {
  if (!activeFormatMenuState || !activeFormatMenuState.menu) return false;
  var menu = activeFormatMenuState.menu;
  var button = activeFormatMenuState.button;
  if (!menu.classList || !menu.classList.contains('open')) return false;
  var target = event.target;
  var inMenu = !!(menu.contains && menu.contains(target))
    || target === button
    || !!(button && button.contains && button.contains(target));
  if (!inMenu) return false;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeActiveFormatMenu();
    if (button && typeof button.focus === 'function') button.focus();
    return true;
  }

  var items = getOpenActionsMenuItems(menu);
  if (!items.length) return false;
  var currentIndex = items.indexOf(target);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusActionsMenuItem(menu, currentIndex < 0 ? 0 : currentIndex + 1);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusActionsMenuItem(menu, currentIndex < 0 ? items.length - 1 : currentIndex - 1);
    return true;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    focusActionsMenuItem(menu, 0);
    return true;
  }
  if (event.key === 'End') {
    event.preventDefault();
    focusActionsMenuItem(menu, items.length - 1);
    return true;
  }
  return false;
}

function bindActionsMoreMenu(button, menu) {
  if (!button || !menu) return;
  button.addEventListener('click', function(e) {
    e.stopPropagation();
    if (activeFormatMenuState && activeFormatMenuState.menu === menu) {
      closeActiveFormatMenu();
      return;
    }
    closeActiveFormatMenu();
    menu.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    activeFormatMenuState = { button: button, menu: menu };
  });
  button.addEventListener('keydown', function(e) {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (!menu.classList.contains('open')) {
      button.click();
    }
    focusActionsMenuItem(menu, 0);
  });
  menu.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (btn && !btn.disabled) {
      setTimeout(closeActiveFormatMenu, 0);
    }
  });
}

function releaseSplitDrag() {
  if (!splitDragState) return;
  if (splitDragState.divider) splitDragState.divider.classList.remove('active');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  splitDragState = null;
  debouncePersist();
}

function isRequestEditorCollapsed(tab) {
  return tab?.requestEditorExpanded === false;
}

function getCollapsedRequestAreaHeight(splitEl) {
  var tabsHeight = splitEl?.querySelector('.js-req-tabs')?.offsetHeight || 0;
  return Math.max(44, tabsHeight + 8);
}

function normalizeRequestSplitHeight(value) {
  var height = typeof value === 'number'
    ? value
    : Number.parseFloat(String(value || ''));
  return Number.isFinite(height) && height > 0 ? height : null;
}

function getSplitPanelBounds(splitEl, dividerEl, progressEl, tab) {
  var chromeHeight = (dividerEl?.offsetHeight || 0) + (progressEl?.offsetHeight || 0);
  var panelSpace = Math.max(0, (splitEl?.offsetHeight || 0) - chromeHeight);
  var preferredMin = Math.max(120, Math.floor(panelSpace * 0.28));
  var minPanel = panelSpace >= preferredMin * 2
    ? preferredMin
    : Math.max(80, Math.floor(panelSpace / 2));
  var requestMinPanel = isRequestEditorCollapsed(tab) ? getCollapsedRequestAreaHeight(splitEl) : minPanel;
  var minReq = Math.min(requestMinPanel, Math.max(0, panelSpace - minPanel));
  var maxReq = Math.max(minReq, panelSpace - minPanel);
  return { minReq: minReq, maxReq: maxReq };
}

function applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, requestedHeight, tab, rememberManualHeight) {
  if (!reqArea || !splitEl) return;
  var nextHeight = typeof requestedHeight === 'number'
    ? requestedHeight
    : Number.parseFloat(String(requestedHeight || ''));
  if (!Number.isFinite(nextHeight)) return;
  var bounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, tab);
  var clampedHeight = Math.min(bounds.maxReq, Math.max(bounds.minReq, nextHeight));
  reqArea.style.height = clampedHeight + 'px';
  reqArea.style.flex = 'none';
  reqArea.classList.toggle('is-collapsed', isRequestEditorCollapsed(tab));
  reqArea.dataset.manualHeight = '1';
  if (rememberManualHeight !== false && tab && !isRequestEditorCollapsed(tab)) {
    tab.requestSplitHeightPx = clampedHeight;
  }
}

function applyStoredRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab) {
  var storedHeight = normalizeRequestSplitHeight(tab?.requestSplitHeightPx);
  if (storedHeight === null) return false;
  applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, storedHeight, tab, false);
  return true;
}

function shouldPreferResponseLayout(tab) {
  return !!(tab && (tab.response || tab.loading || tab.error || (tab.websocketMessages && tab.websocketMessages.length > 0)));
}

function clearAdaptiveRequestAreaHeight(reqArea) {
  if (!reqArea) return;
  reqArea.style.height = '';
  reqArea.style.flex = '';
  delete reqArea.dataset.autoHeight;
}

function hasUserLockedSplitRatio(reqArea, tab) {
  if (reqArea && reqArea.dataset.manualHeight === '1') return true;
  return normalizeRequestSplitHeight(tab?.requestSplitHeightPx) !== null;
}

function syncResponseEmphasisClass(splitEl, tab) {
  if (!splitEl) return;
  var prefer = shouldPreferResponseLayout(tab);
  splitEl.classList.toggle('is-response-emphasis', prefer);
  var resArea = splitEl.querySelector('.res-area');
  if (resArea) resArea.classList.toggle('is-response-emphasis', prefer);
}

function applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab) {
  if (!reqArea || !splitEl) return;
  syncResponseEmphasisClass(splitEl, tab);
  reqArea.classList.toggle('is-collapsed', isRequestEditorCollapsed(tab));
  // 사용자 수동 비율이 있으면 Send/edit 자동 리사이즈 금지 (시각 강조만)
  if (hasUserLockedSplitRatio(reqArea, tab) && !isRequestEditorCollapsed(tab)) {
    applyStoredRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab);
    return;
  }
  if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(tab)) return;
  if (!isRequestEditorCollapsed(tab) && applyStoredRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab)) {
    return;
  }
  if (isRequestEditorCollapsed(tab)) {
    var collapsedBounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, tab);
    var collapsedHeight = Math.min(collapsedBounds.maxReq, Math.max(collapsedBounds.minReq, getCollapsedRequestAreaHeight(splitEl)));
    reqArea.style.height = collapsedHeight + 'px';
    reqArea.style.flex = 'none';
    reqArea.dataset.autoHeight = '1';
    delete reqArea.dataset.manualHeight;
    return;
  }
  if (!shouldPreferResponseLayout(tab)) {
    clearAdaptiveRequestAreaHeight(reqArea);
    return;
  }
  var chromeHeight = (dividerEl?.offsetHeight || 0) + (progressEl?.offsetHeight || 0);
  var panelSpace = Math.max(0, (splitEl?.offsetHeight || 0) - chromeHeight);
  if (!panelSpace) return;
  var bounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, tab);
  var targetRatio = panelSpace < 420 ? 0.34 : panelSpace < 560 ? 0.38 : 0.42;
  var requestEditorTab = normalizeRequestEditorTab(tab.requestEditorTab);
  if (requestEditorTab === 'scripts' || requestEditorTab === 'body') {
    targetRatio += 0.04;
  } else if (requestEditorTab === 'settings' || requestEditorTab === 'headers') {
    targetRatio += 0.02;
  }
  var targetHeight = Math.round(panelSpace * Math.min(0.48, targetRatio));
  var clampedHeight = Math.min(bounds.maxReq, Math.max(bounds.minReq, targetHeight));
  reqArea.style.height = clampedHeight + 'px';
  reqArea.style.flex = 'none';
  reqArea.dataset.autoHeight = '1';
}

document.addEventListener('click', function(e) {
  if (!activeFormatMenuState) return;
  if (!activeFormatMenuState.menu?.isConnected || !activeFormatMenuState.button?.isConnected) {
    closeActiveFormatMenu();
    return;
  }
  if (activeFormatMenuState.menu.contains(e.target) || activeFormatMenuState.button.contains(e.target)) {
    return;
  }
  closeActiveFormatMenu();
});

document.addEventListener('keydown', function(e) {
  handleActionsMenuKeydown(e);
});

document.addEventListener('mousemove', function(e) {
  if (!splitDragState) return;
  if (!splitDragState.divider?.isConnected || !splitDragState.splitEl?.isConnected || !splitDragState.reqArea?.isConnected) {
    releaseSplitDrag();
    return;
  }
  var dy = e.clientY - splitDragState.startY;
  var newH = splitDragState.startH + dy;
  var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
  applyManualRequestAreaHeight(
    splitDragState.reqArea,
    splitDragState.splitEl,
    splitDragState.divider,
    splitDragState.progressEl,
    newH,
    activeTab
  );
});

document.addEventListener('mouseup', function() {
  releaseSplitDrag();
});

function tr(key) {
  return Object.prototype.hasOwnProperty.call(i18n, key) ? i18n[key] : key;
}

function tf(key, params) {
  return tr(key).replace(/{([A-Za-z0-9_]+)}/g, function(_, name) {
    return Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params[name]) : '{' + name + '}';
  });
}

function tfCount(key, count) {
  return tf(key, { count: String(count) });
}

function normalizeRequestEditorTab(value) {
  return REQUEST_EDITOR_TABS.indexOf(String(value || '')) >= 0 ? String(value) : 'params';
}

function renderEnvironmentIndicator(envName) {
  return '<span class="env-label">' + escapeHtml(tr('webview.environment')) + '</span><span class="env-name">' + escapeHtml(envName) + '</span>';
}

function renderProfileIndicator(profileName) {
  return tf('webview.summaryProfile', { name: profileName || 'default' });
}

function renderStatusChip(label, tone, action, meta, tooltip) {
  var attrs = action
    ? ' type="button" data-action="' + escapeAttr(action) + '"' + (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '')
    : '';
  var titleAttr = tooltip ? ' title="' + escapeAttr(tooltip) + '"' : '';
  return '<button class="request-status-chip' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '') + '"' + attrs + titleAttr + '>' + escapeHtml(label) + '</button>';
}

function renderEnvironmentStatusChip(envName) {
  return '<button class="request-status-chip info clickable" type="button" data-action="switch-environment">' + renderEnvironmentIndicator(envName) + '</button>';
}

function renderPreflightPill(label, tone, action, meta) {
  return '<button class="preflight-pill' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '') + '"' +
    (action ? ' type="button" data-action="' + escapeAttr(action) + '"' : '') +
    (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '') +
    '>' + escapeHtml(label) + '</button>';
}

function collectTemplateVariableNames(target, text) {
  if (!text) return;
  var re = /\{\{([^}]+)\}\}/g;
  var match;
  while ((match = re.exec(String(text))) !== null) {
    var name = (match[1] || '').trim();
    if (name) target.add(name);
  }
}

function collectTemplateVariablesFromKeyValues(target, items) {
  (items || []).forEach(function(item) {
    if (!item || item.enabled === false) return;
    collectTemplateVariableNames(target, item.key);
    collectTemplateVariableNames(target, item.value);
  });
}

function isSensitiveKeyName(value) {
  return /(^|[-_])(authorization|token|secret|password|passwd|pwd|api[-_]?key|session|cookie|access[-_]?token|refresh[-_]?token)([-_]|$)/i.test(String(value || '').trim());
}

function authSummaryLabel(auth) {
  if (!auth || auth.type === 'none') return tr('webview.authSummaryNone');
  if (auth.type === 'basic') return tr('webview.authSummaryBasic');
  if (auth.type === 'bearer') return tr('webview.authSummaryBearer');
  if (auth.type === 'apikey') {
    return auth?.apikey?.addTo === 'query'
      ? tr('webview.authSummaryApiKeyQuery')
      : tr('webview.authSummaryApiKeyHeader');
  }
  return authTypeLabel(auth.type);
}

function getUnresolvedDraftVariableNames(tab) {
  var names = new Set();
  if (!tab) return [];
  collectTemplateVariableNames(names, tab.url);
  collectTemplateVariablesFromKeyValues(names, tab.headers);
  collectTemplateVariablesFromKeyValues(names, tab.params);
  collectTemplateVariableNames(names, tab.body);
  collectTemplateVariableNames(names, tab.binaryFilePath);
  (tab.formData || []).forEach(function(field) {
    if (!field || field.enabled === false) return;
    collectTemplateVariableNames(names, field.key);
    collectTemplateVariableNames(names, field.value);
  });
  if (!tab.skipDefaultHeaders) {
    collectTemplateVariablesFromKeyValues(names, workspaceDefaultHeaders);
  }
  if (tab.auth?.basic) {
    collectTemplateVariableNames(names, tab.auth.basic.username);
    collectTemplateVariableNames(names, tab.auth.basic.password);
  }
  if (tab.auth?.bearer) {
    collectTemplateVariableNames(names, tab.auth.bearer.token);
  }
  if (tab.auth?.apikey) {
    collectTemplateVariableNames(names, tab.auth.apikey.key);
    collectTemplateVariableNames(names, tab.auth.apikey.value);
  }
  return Array.from(names).filter(function(name) {
    return activeVarKeys.indexOf(name) < 0;
  });
}

function buildDraftTabFromContent(mc) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !mc) return tab;
  var methodEl = mc.querySelector('.js-method');
  var saveHistoryInput = mc.querySelector('.js-save-history');
  var skipDefaultHeadersInput = mc.querySelector('.js-skip-default-headers');
  var disableScriptsInput = mc.querySelector('.js-disable-scripts');
  var followRedirectsInput = mc.querySelector('.js-follow-redirects');
  var stopAfterHeadersInput = mc.querySelector('.js-stop-after-headers');
  var tlsValidationInput = mc.querySelector('.js-tls-validation');
  return Object.assign({}, tab, {
    requestEditorTab: normalizeRequestEditorTab(mc.querySelector('.js-req-tabs .tab.active')?.dataset.tab || tab.requestEditorTab),
    method: methodEl ? methodEl.value : tab.method,
    url: mc.querySelector('.js-url')?.value || tab.url || '',
    requestType: normalizeRequestType(tab.requestType, mc.querySelector('.js-url')?.value || tab.url || ''),
    headers: collectKv(mc.querySelector('.js-header-rows')),
    params: collectKv(mc.querySelector('.js-param-rows')),
    body: mc.querySelector('.js-body')?.value || '',
    bodyType: normalizeBodyType(mc.querySelector('.js-body-type')?.value || tab.bodyType),
    formData: collectFormData(mc.querySelector('.js-formdata-rows')),
    binaryFilePath: mc.querySelector('.js-binary-path')?.value || '',
    auth: collectAuth(mc),
    scripts: collectScripts(mc),
    timeout: normalizeNumberSetting(mc.querySelector('.js-timeout')?.value),
    followRedirects: followRedirectsInput ? followRedirectsInput.checked === true : !!tab.followRedirects,
    saveToHistory: saveHistoryInput ? saveHistoryInput.checked !== false : tab.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(tlsValidationInput?.value || tab.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(mc.querySelector('.js-max-response-size')?.value),
    retryCount: normalizeNumberSetting(mc.querySelector('.js-retry-count')?.value),
    retryDelayMs: normalizeNumberSetting(mc.querySelector('.js-retry-delay')?.value),
    stopAfterHeaders: stopAfterHeadersInput ? stopAfterHeadersInput.checked === true : !!tab.stopAfterHeaders,
    skipDefaultHeaders: skipDefaultHeadersInput ? skipDefaultHeadersInput.checked === true : !!tab.skipDefaultHeaders,
    disableScripts: disableScriptsInput ? disableScriptsInput.checked === true : !!tab.disableScripts,
    webSocketKeepAliveEnabled: mc.querySelector('.js-ws-keepalive-enabled')?.checked === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(mc.querySelector('.js-ws-keepalive-interval')?.value),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(mc.querySelector('.js-ws-keepalive-message')?.value)
  });
}

function countEnabledKeyValues(items) {
  return (items || []).filter(function(item) {
    return item && item.enabled !== false && item.key;
  }).length;
}

function countEnabledFormData(items) {
  return (items || []).filter(function(item) {
    return item && item.enabled !== false && (item.key || item.value);
  }).length;
}

function createRequestChangeBaseline(tab) {
  var baseline = {
    requestType: 'http',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none',
    formData: [],
    binaryFilePath: '',
    auth: { type: 'none' },
    scripts: { preRequest: '', test: '' },
    timeout: 0,
    followRedirects: false,
    saveToHistory: true,
    tlsValidation: 'default',
    maxResponseSizeKb: DEFAULT_MAX_RESPONSE_SIZE_KB,
    retryCount: 0,
    retryDelayMs: 0,
    stopAfterHeaders: false,
    skipDefaultHeaders: false,
    disableScripts: false,
    webSocketKeepAliveEnabled: false,
    webSocketKeepAliveIntervalSeconds: DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS,
    webSocketKeepAliveMessage: DEFAULT_WS_KEEPALIVE_MESSAGE,
  };
  if (!tab?._snapshot) {
    return baseline;
  }
  try {
    var raw = JSON.parse(tab._snapshot);
    var settings = raw.settings || {};
    baseline.requestType = normalizeRequestType(raw.requestType, raw.url);
    baseline.method = raw.method || baseline.method;
    baseline.url = raw.url || '';
    baseline.headers = raw.headers || [];
    baseline.params = raw.params || [];
    baseline.body = raw.body || '';
    baseline.bodyType = normalizeBodyType(raw.bodyType || baseline.bodyType);
    baseline.formData = raw.formData || [];
    baseline.binaryFilePath = raw.binaryFilePath || '';
    baseline.auth = raw.auth || baseline.auth;
    baseline.scripts = raw.scripts || baseline.scripts;
    baseline.timeout = normalizeNumberSetting(settings.timeout);
    baseline.followRedirects = settings.followRedirects === true;
    baseline.saveToHistory = settings.saveToHistory !== false;
    baseline.tlsValidation = normalizeTlsValidation(settings.tlsValidation);
    baseline.maxResponseSizeKb = normalizeMaxResponseSizeSetting(settings.maxResponseSizeKb);
    baseline.retryCount = normalizeNumberSetting(settings.retryCount);
    baseline.retryDelayMs = normalizeNumberSetting(settings.retryDelayMs);
    baseline.stopAfterHeaders = settings.stopAfterHeaders === true;
    baseline.skipDefaultHeaders = settings.skipDefaultHeaders === true;
    baseline.disableScripts = settings.disableScripts === true;
    baseline.webSocketKeepAliveEnabled = settings.webSocketKeepAliveEnabled === true;
    baseline.webSocketKeepAliveIntervalSeconds = normalizeWebSocketKeepAliveInterval(settings.webSocketKeepAliveIntervalSeconds);
    baseline.webSocketKeepAliveMessage = normalizeWebSocketKeepAliveMessage(settings.webSocketKeepAliveMessage);
  } catch {}
  return baseline;
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function changeDetailWithCounts(beforeCount, afterCount) {
  if (beforeCount !== afterCount) {
    return beforeCount + '→' + afterCount;
  }
  return tr('webview.requestDiffEdited');
}

function buildRequestChangeItems(tab) {
  if (!tab) return [];
  var baseline = createRequestChangeBaseline(tab);
  var items = [];
  if (baseline.method !== tab.method || baseline.url !== tab.url) {
    items.push({
      label: tr('webview.requestDiffRequest'),
      detail: baseline.method !== tab.method ? baseline.method + '→' + tab.method : tr('webview.requestDiffEdited'),
      action: 'focus-url'
    });
  }
  if (!sameJson(baseline.params, tab.params)) {
    items.push({
      label: tr('webview.requestDiffParams'),
      detail: changeDetailWithCounts(countEnabledKeyValues(baseline.params), countEnabledKeyValues(tab.params)),
      action: 'switch-tab',
      meta: 'params'
    });
  }
  if (!sameJson(baseline.headers, tab.headers)) {
    items.push({
      label: tr('webview.requestDiffHeaders'),
      detail: changeDetailWithCounts(countEnabledKeyValues(baseline.headers), countEnabledKeyValues(tab.headers)),
      action: 'switch-tab',
      meta: 'headers'
    });
  }
  if (
    baseline.body !== tab.body ||
    baseline.bodyType !== tab.bodyType ||
    baseline.binaryFilePath !== tab.binaryFilePath ||
    !sameJson(baseline.formData, tab.formData)
  ) {
    var bodyDetail = baseline.bodyType !== tab.bodyType
      ? String(baseline.bodyType || 'none') + '→' + String(tab.bodyType || 'none')
      : (tab.bodyType === 'formdata'
        ? changeDetailWithCounts(countEnabledFormData(baseline.formData), countEnabledFormData(tab.formData))
        : tr('webview.requestDiffEdited'));
    items.push({
      label: tr('webview.requestDiffBody'),
      detail: bodyDetail,
      action: 'switch-tab',
      meta: 'body'
    });
  }
  if (!sameJson(baseline.auth, tab.auth)) {
    items.push({
      label: tr('webview.requestDiffAuth'),
      detail: tr('webview.requestDiffUpdated'),
      action: 'switch-tab',
      meta: 'auth'
    });
  }
  if (!sameJson(baseline.scripts, tab.scripts)) {
    items.push({
      label: tr('webview.requestDiffScripts'),
      detail: tr('webview.requestDiffUpdated'),
      action: 'switch-tab',
      meta: 'scripts'
    });
  }
  if (!sameJson(requestSettingsSnapshot(baseline), requestSettingsSnapshot(tab))) {
    items.push({
      label: tr('webview.requestDiffSettings'),
      detail: tr('webview.requestDiffUpdated'),
      action: 'switch-tab',
      meta: 'settings'
    });
  }
  return items;
}

function renderRequestChangeSummary(tab) {
  if (!tab) return '<div class="request-change-summary empty"></div>';
  tab.dirty = isTabDirty(tab);
  if (!tab.dirty) return '<div class="request-change-summary empty"></div>';
  var items = buildRequestChangeItems(tab);
  if (!items.length) return '<div class="request-change-summary empty"></div>';
  return '<div class="request-change-summary">' +
    '<div class="request-change-summary-head">' +
      '<div class="request-change-summary-title">' + escapeHtml(tr('webview.requestDiffTitle')) + '</div>' +
      '<div class="request-change-summary-copy">' + escapeHtml(tfCount('webview.requestDiffCount', items.length)) + '</div>' +
    '</div>' +
    '<div class="request-change-chip-row">' +
      items.map(function(item) {
        var attrs = ' type="button" class="request-change-chip clickable" data-action="' + escapeAttr(item.action) + '"' + (item.meta ? ' data-meta="' + escapeAttr(item.meta) + '"' : '') + '>';
        return '<button' + attrs +
          '<span class="delta-label">' + escapeHtml(item.label) + '</span>' +
          '<span class="delta-value">' + escapeHtml(item.detail) + '</span>' +
        '</button>';
      }).join('') +
    '</div>' +
  '</div>';
}

function refreshRequestChangeSummary(mc) {
  var wrap = mc?.querySelector('.js-request-change-summary-wrap');
  if (!wrap) return;
  var draftTab = buildDraftTabFromContent(mc);
  wrap.innerHTML = renderRequestChangeSummary(draftTab);
}

function renderRequestDirtyTitle(tab) {
  var baseTitle = tr('webview.unsavedChanges');
  if (!tab) return baseTitle;
  var items = buildRequestChangeItems(tab);
  if (!items.length) return baseTitle;
  return baseTitle + ' · ' + tfCount('webview.requestDiffCount', items.length);
}

function addVariableUsage(usageMap, value, scopeLabel) {
  if (!value) return;
  var matches = String(value).match(/\{\{([^}]+)\}\}/g) || [];
  matches.forEach(function(token) {
    var name = token.slice(2, -2).trim();
    if (!name) return;
    if (!usageMap[name]) {
      usageMap[name] = new Set();
    }
    usageMap[name].add(scopeLabel);
  });
}

function collectVariableUsage(tab) {
  var usageMap = {};
  addVariableUsage(usageMap, tab.url, tr('webview.varScopeUrl'));
  (tab.params || []).forEach(function(item) {
    if (!item || item.enabled === false) return;
    addVariableUsage(usageMap, item.key, tr('webview.varScopeParams'));
    addVariableUsage(usageMap, item.value, tr('webview.varScopeParams'));
  });
  (tab.headers || []).forEach(function(item) {
    if (!item || item.enabled === false) return;
    addVariableUsage(usageMap, item.key, tr('webview.varScopeHeaders'));
    addVariableUsage(usageMap, item.value, tr('webview.varScopeHeaders'));
  });
  if (!tab.skipDefaultHeaders) {
    (workspaceDefaultHeaders || []).forEach(function(item) {
      if (!item || item.enabled === false) return;
      addVariableUsage(usageMap, item.key, tr('webview.varScopeDefaultHeaders'));
      addVariableUsage(usageMap, item.value, tr('webview.varScopeDefaultHeaders'));
    });
  }
  addVariableUsage(usageMap, tab.body, tr('webview.varScopeBody'));
  (tab.formData || []).forEach(function(field) {
    if (!field || field.enabled === false) return;
    addVariableUsage(usageMap, field.key, tr('webview.varScopeFormData'));
    addVariableUsage(usageMap, field.value, tr('webview.varScopeFormData'));
  });
  addVariableUsage(usageMap, tab.binaryFilePath, tr('webview.varScopeBinary'));
  if (tab.auth?.basic) {
    addVariableUsage(usageMap, tab.auth.basic.username, tr('webview.varScopeAuth'));
    addVariableUsage(usageMap, tab.auth.basic.password, tr('webview.varScopeAuth'));
  }
  if (tab.auth?.bearer) {
    addVariableUsage(usageMap, tab.auth.bearer.token, tr('webview.varScopeAuth'));
  }
  if (tab.auth?.apikey) {
    addVariableUsage(usageMap, tab.auth.apikey.key, tr('webview.varScopeAuth'));
    addVariableUsage(usageMap, tab.auth.apikey.value, tr('webview.varScopeAuth'));
  }
  addVariableUsage(usageMap, tab.scripts?.preRequest, tr('webview.varScopeScripts'));
  addVariableUsage(usageMap, tab.scripts?.test, tr('webview.varScopeScripts'));
  return Object.keys(usageMap).sort(function(left, right) { return left.localeCompare(right); }).map(function(name) {
    return { name: name, scopes: Array.from(usageMap[name]).sort() };
  });
}

function renderVariableUsage(tab) {
  var usage = collectVariableUsage(tab);
  if (!usage.length) return '<div class="var-usage hidden"></div>';
  return '<div class="var-usage">' +
    '<div class="var-usage-head">' +
      '<div class="var-usage-title">' + escapeHtml(tr('webview.variableUsageTitle')) + '</div>' +
      '<div class="var-usage-copy">' + escapeHtml(tfCount('webview.variableUsageCount', usage.length)) + '</div>' +
    '</div>' +
    '<div class="var-usage-grid">' +
      usage.map(function(item) {
        return '<div class="var-usage-card">' +
          '<span class="var-usage-name">{{' + escapeHtml(item.name) + '}}</span>' +
          '<div class="var-usage-scopes">' +
            item.scopes.map(function(scope) {
              return '<span class="var-usage-scope">' + escapeHtml(scope) + '</span>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</div>';
}

function refreshVariableUsage(mc) {
  var wrap = mc?.querySelector('.js-variable-usage-wrap');
  if (wrap) {
    var draftTab = buildDraftTabFromContent(mc);
    wrap.innerHTML = renderVariableUsage(draftTab);
  }
  // compose 경로에 영구 카드가 없으므로 스트립 상세를 함께 갱신
  if (mc?.querySelector('.js-status-strip-host')) {
    refreshStatusStrip(mc);
  }
}

function refreshFormDataSummary(mc) {
  var wrap = mc?.querySelector('.js-formdata-summary');
  if (!wrap) return;
  wrap.innerHTML = renderFormDataSummary(collectFormData(mc.querySelector('.js-formdata-rows')));
}

function syncSettingsToggleStates(mc) {
  if (!mc) return;
  var syncTone = function(selector, className, enabled) {
    var label = mc.querySelector(selector)?.closest('.settings-toggle');
    if (!label) return;
    label.classList.toggle(className, enabled === true);
  };
  syncTone('.js-stop-after-headers', 'risk-muted', mc.querySelector('.js-stop-after-headers')?.checked === true);
  syncTone('.js-save-history', 'risk-muted', mc.querySelector('.js-save-history')?.checked !== true);
  syncTone('.js-skip-default-headers', 'risk-warning', mc.querySelector('.js-skip-default-headers')?.checked === true);
  syncTone('.js-disable-scripts', 'risk-warning', mc.querySelector('.js-disable-scripts')?.checked === true);
}

function refreshDraftInsights(mc, options) {
  var opts = options || {};
  syncSettingsToggleStates(mc);
  refreshDefaultHeadersBanner(mc);
  refreshToplineStatusChips(mc);
  refreshRequestPreflight(mc);
  refreshVariableUsage(mc);
  refreshFormDataSummary(mc);
  syncVariablePreviewHints(mc);
  if (opts.renderContent === true) {
    renderContent();
  }
}

function renderUnresolvedVariableBanner(tab) {
  var unresolved = getUnresolvedDraftVariableNames(tab);
  if (unresolved.length === 0) return '';
  return '<div class="preflight-warning">' +
    '<div class="preflight-warning-title">' + escapeHtml(tfCount('webview.unresolvedVariablesCount', unresolved.length)) + '</div>' +
    '<div class="preflight-warning-copy">' + escapeHtml(unresolved.map(function(name) { return '{{' + name + '}}'; }).join(', ')) + '</div>' +
    '<div class="preflight-warning-actions">' +
      '<button class="ghost-btn ripple-btn js-preflight-action" type="button" data-action="switch-environment">' + escapeHtml(tr('webview.openEnvironmentPicker')) + '</button>' +
      '<button class="ghost-btn ripple-btn js-preflight-action" type="button" data-action="switch-tab" data-meta="headers">' + escapeHtml(tr('webview.reviewRequestInputs')) + '</button>' +
    '</div>' +
  '</div>';
}

function renderRequestPreflight(tab) {
  if (!tab) return '';
  var headerCount = (tab.headers || []).filter(function(item) { return item && item.enabled !== false && item.key; }).length;
  var paramCount = (tab.params || []).filter(function(item) { return item && item.enabled !== false && item.key; }).length;
  var unresolved = getUnresolvedDraftVariableNames(tab);
  var pills = [
    renderPreflightPill(currentEnvName ? tf('webview.summaryEnvironment', { name: currentEnvName }) : tr('webview.noEnvironment'), currentEnvName ? 'info' : 'warning', 'switch-environment'),
    renderPreflightPill(tf('webview.summaryAuth', { value: authSummaryLabel(tab.auth) }), tab.auth?.type && tab.auth.type !== 'none' ? 'accent' : 'muted', 'switch-tab', 'auth'),
    renderPreflightPill(tfCount('webview.summaryHeaders', headerCount), headerCount > 0 ? 'accent' : 'muted', 'switch-tab', 'headers'),
    renderPreflightPill(tfCount('webview.summaryParams', paramCount), paramCount > 0 ? 'accent' : 'muted', 'switch-tab', 'params'),
    renderPreflightPill(tab.disableScripts ? tr('webview.summaryScriptsOff') : tr('webview.summaryScriptsOn'), tab.disableScripts ? 'warning' : 'info', 'switch-tab', tab.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request'),
    renderPreflightPill(tab.saveToHistory === false ? tr('webview.summaryHistoryOff') : tr('webview.summaryHistoryOn'), tab.saveToHistory === false ? 'muted' : 'info', 'switch-tab', 'settings:save-history')
  ];
  if (unresolved.length > 0) {
    pills.unshift(renderPreflightPill(tfCount('webview.unresolvedVariablesCount', unresolved.length), 'warning', 'switch-environment'));
  }
  return '<div class="request-preflight js-request-preflight">' +
    '<div class="request-preflight-pills">' + pills.join('') + '</div>' +
    renderUnresolvedVariableBanner(tab) +
  '</div>';
}

function scriptTemplateSource(name) {
  var nl = String.fromCharCode(10);
  if (name === 'preRequestEnv') {
    return [
      'pm.environment.set("requestStartedAt", String(Date.now()));',
      'console.log("requestStartedAt", pm.environment.get("requestStartedAt"));'
    ].join(nl);
  }
  if (name === 'testCaptureValue') {
    return [
      'const body = pm.response.json();',
      '',
      'pm.test("response has key", function () {',
      '  pm.expect(body).to.have.property("key");',
      '});',
      '',
      'pm.environment.set("sessionKey", String(body.key));'
    ].join(nl);
  }
  if (name === 'testStatusCheck') {
    return [
      'pm.test("status is 200", function () {',
      '  pm.response.to.have.status(200);',
      '});',
      '',
      'const body = pm.response.json();',
      '',
      'pm.test("title exists", function () {',
      '  pm.expect(body).to.have.property("title");',
      '});'
    ].join(nl);
  }
  return '';
}

function renderScriptHelpers(_tab) {
  return '<div class="script-help-line">' +
    '<span class="script-help-line-copy">' + escapeHtml(tr('webview.scriptHelpOneLiner')) + '</span>' +
    '<button type="button" class="script-help-line-link js-open-script-guide">' + escapeHtml(tr('webview.emptyActionGuide')) + '</button>' +
  '</div>';
}

function insertScriptTemplate(mc, targetName, templateName) {
  var input = mc?.querySelector(targetName === 'preRequest' ? '.js-script-prerequest' : '.js-script-test');
  if (!input) return;
  var template = scriptTemplateSource(templateName);
  if (!template) return;
  var existing = String(input.value || '').trim();
  var doubleBreak = String.fromCharCode(10) + String.fromCharCode(10);
  input.value = existing ? (existing + doubleBreak + template) : template;
  input.focus();
  input.selectionStart = input.selectionEnd = input.value.length;
  markDirty();
  refreshDraftInsights(mc);
}

function collapseWhitespace(text) {
  var cr = String.fromCharCode(13);
  var lf = String.fromCharCode(10);
  var tab = String.fromCharCode(9);
  var ff = String.fromCharCode(12);
  return String(text || '')
    .split(cr).join(' ')
    .split(lf).join(' ')
    .split(tab).join(' ')
    .split(ff).join(' ')
    .split(' ')
    .filter(function(part) { return part.length > 0; })
    .join(' ');
}

function formatShortTime(date) {
  try {
    return new Intl.DateTimeFormat(appDateLocale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

function bodyTypeLabel(type) {
  var map = {
    none: tr('webview.none'),
    json: 'JSON',
    xml: 'XML',
    form: tr('webview.formUrlEncoded'),
    formdata: tr('webview.formData'),
    binary: tr('webview.binary'),
    raw: tr('webview.raw'),
  };
  return map[type] || type;
}

function authTypeLabel(type) {
  var map = {
    none: tr('webview.noAuth'),
    basic: tr('webview.basicAuth'),
    bearer: tr('webview.bearerToken'),
    apikey: tr('webview.apiKey'),
  };
  return map[type] || type;
}

function isWebSocketUrl(url) {
  return /^wss?:\\/\\//i.test(String(url || '').trim());
}

function hasUnresolvedTemplateVariables(text) {
  return /\\{\\{[^}]+\\}\\}/.test(String(text || ''));
}

function hasTemplateVariables(text) {
  return /\\{\\{[^}]+\\}\\}/.test(String(text || ''));
}

function resolveTemplateVariables(text) {
  if (!text) return text;
  var resolved = String(text);
  for (var depth = 0; depth < 10; depth++) {
    var changed = false;
    resolved = resolved.replace(/\\{\\{([^}]+)\\}\\}/g, function(match, name) {
      var key = String(name || '').trim();
      if (!Object.prototype.hasOwnProperty.call(activeVarValues, key)) return match;
      var value = String(activeVarValues[key] ?? '');
      if (value === match) return match;
      changed = true;
      return value;
    });
    if (!changed) break;
  }
  return resolved;
}

function getUrlModeInfo(rawUrl) {
  var raw = String(rawUrl || '').trim();
  var resolved = String(resolveTemplateVariables(raw) || '').trim();
  var hasVariables = hasTemplateVariables(raw);
  var unresolved = hasVariables && hasUnresolvedTemplateVariables(resolved);
  return {
    rawUrl: raw,
    resolvedUrl: resolved && !unresolved ? resolved : '',
    hasVariables: hasVariables,
    unresolved: unresolved
  };
}

function getResolvedUrlForMode(rawUrl) {
  return getUrlModeInfo(rawUrl).resolvedUrl;
}

function normalizeRequestType(value, url) {
  var modeInfo = getUrlModeInfo(url);
  var candidate = modeInfo.resolvedUrl || (modeInfo.unresolved ? '' : modeInfo.rawUrl);
  if (isWebSocketUrl(candidate)) return 'websocket';
  if (/^https?:\\/\\//i.test(candidate)) return 'http';
  if (candidate) return 'http';
  return value === 'websocket' && isWebSocketUrl(modeInfo.rawUrl) && !modeInfo.unresolved ? 'websocket' : 'http';
}

function syncRequestTypeFromUrl(tab) {
  if (!tab) return 'http';
  tab.requestType = normalizeRequestType(tab.requestType, tab.url);
  return tab.requestType;
}

function syncAllRequestTypesFromUrls() {
  tabs.forEach(syncRequestTypeFromUrl);
}

function isWebSocketTab(tab) {
  return !!(tab && normalizeRequestType(tab.requestType, tab.url) === 'websocket');
}


function normalizeBodyType(bodyType) {
  if (VALID_BODY_TYPES.indexOf(bodyType) >= 0) return bodyType;
  return bodyType === 'text' ? 'raw' : 'none';
}


const tabBar = document.getElementById('tabBar');
const addTabBtn = document.getElementById('addTabBtn');
const mainContent = document.getElementById('mainContent');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');

window.addEventListener('resize', function() {
  var reqArea = mainContent?.querySelector('.req-area');
  if (!reqArea) return;
  var splitEl = mainContent.querySelector('.split');
  var dividerEl = mainContent.querySelector('.divider');
  var progressEl = mainContent.querySelector('.bullet-progress');
  var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
  if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(activeTab)) {
    applyManualRequestAreaHeight(
      reqArea,
      splitEl,
      dividerEl,
      progressEl,
      reqArea.offsetHeight || reqArea.style.height,
      activeTab,
      false
    );
    return;
  }
  applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, activeTab);
});

function setTextContent(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function normalizeRequestPanelTheme(theme) {
  return REQUEST_PANEL_THEMES.indexOf(theme) >= 0 ? theme : 'default';
}

function applyRequestPanelTheme(theme) {
  currentRequestPanelTheme = normalizeRequestPanelTheme(theme);
  if (document.body) {
    document.body.setAttribute('data-panel-theme', currentRequestPanelTheme);
  }
}

function updateStaticLocalizedText() {
  document.documentElement.lang = currentDisplayLanguage;
  addTabBtn.title = tr('webview.newTab');
  addTabBtn.setAttribute('aria-label', tr('webview.newTab'));
  tabBar.setAttribute('aria-label', tr('webview.requestTabs'));
  if (emptyPlaceholder) emptyPlaceholder.textContent = tr('webview.emptyPlaceholder');
  setTextContent('envEditorTitle', tr('webview.environment'));
  setTextContent('envAutoSavedLabel', tr('webview.autoSaved'));
  setTextContent('addEnvVarBtn', tr('webview.addVariable'));
  setTextContent('defaultHeadersTitle', tr('webview.defaultHeaders'));
  setTextContent('defaultHeadersSaveBtn', tr('webview.save'));
  setTextContent('addDefaultHeaderBtn', tr('webview.addHeader'));
  var envDirty = document.getElementById('envDirtyDot');
  if (envDirty) envDirty.title = tr('webview.unsavedChanges');
  var envClose = document.getElementById('envCloseBtn');
  if (envClose) {
    envClose.title = tr('webview.close');
    envClose.setAttribute('aria-label', tr('webview.close'));
  }
  refreshEnvironmentEditorSummary();
  var defaultHeadersClose = document.getElementById('defaultHeadersCloseBtn');
  if (defaultHeadersClose) {
    defaultHeadersClose.title = tr('webview.close');
    defaultHeadersClose.setAttribute('aria-label', tr('webview.close'));
  }
}

function applyLocalizationUpdate(msg) {
  if (msg.strings && typeof msg.strings === 'object') {
    i18n = msg.strings;
  }
  if (typeof msg.dateLocale === 'string' && msg.dateLocale) {
    appDateLocale = msg.dateLocale;
  }
  if (typeof msg.displayLanguage === 'string' && msg.displayLanguage) {
    currentDisplayLanguage = msg.displayLanguage;
  }
  if (typeof msg.requestPanelTheme === 'string' && msg.requestPanelTheme) {
    applyRequestPanelTheme(msg.requestPanelTheme);
  }
  tabs.forEach(function(tab) {
    if (tab.autoName || isKnownDefaultTabName(tab.name)) {
      tab.name = tr('webview.stage.newRequest');
      tab.autoName = true;
    }
  });
  updateStaticLocalizedText();
  envVarRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  defaultHeaderRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  renderTabBar();
  renderContent();
}

addTabBtn.addEventListener('click', () => createTab());
document.addEventListener('keydown', (e) => {
  const isPrimaryModifier = e.ctrlKey || e.metaKey;
  const digitMatch = /^Digit([1-6])$/.exec(e.code || '');

  if (isEditableTarget(e.target) && isBodyUndoRedoShortcut(e)) return;
  if (isPrimaryModifier && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(); return; }
  if (isPrimaryModifier && e.key.toLowerCase() === 'w' && activeTabId) { e.preventDefault(); closeTab(activeTabId); return; }
  if (isPrimaryModifier && e.key === 'Enter') { e.preventDefault(); handlePrimaryAction(); return; }
  if (isPrimaryModifier && e.key.toLowerCase() === 's') {
    e.preventDefault();
    triggerSaveFromShortcut(e.shiftKey);
    return;
  }
  if (isPrimaryModifier && e.key.toLowerCase() === 'f') {
    if (focusResponseSearchField()) {
      e.preventDefault();
    }
    return;
  }
  if (e.altKey && !e.ctrlKey && !e.metaKey && digitMatch) {
    const index = Number(digitMatch[1]) - 1;
    if (e.shiftKey) {
      const responseTabName = ['resBody', 'resCookies', 'resHeaders', 'resTests', 'resPreview'][index];
      if (responseTabName) {
        e.preventDefault();
        switchResponseTabInContent(mainContent, responseTabName);
      }
      return;
    }

    const requestTabName = ['params', 'headers', 'body', 'auth', 'scripts', 'settings'][index];
    if (requestTabName) {
      e.preventDefault();
      switchRequestEditorTabInContent(mainContent, requestTabName, { expand: true });
    }
  }
});

mainContent.addEventListener('mouseover', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  showVariablePreviewPopover(target);
});

mainContent.addEventListener('mouseout', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  if (event.relatedTarget && target.contains(event.relatedTarget)) return;
  hideVariablePreviewPopover();
});

mainContent.addEventListener('focusin', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  showVariablePreviewPopover(target);
});

mainContent.addEventListener('focusout', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  if (event.relatedTarget && target.contains(event.relatedTarget)) return;
  hideVariablePreviewPopover();
});

function knownDefaultTabNames() {
  return ['New Request', '새 요청', '新しいリクエスト', 'Nouvelle requête'];
}

function isKnownDefaultTabName(name) {
  return knownDefaultTabNames().indexOf(name) >= 0;
}


function normalizeNumberSetting(value) {
  var num = parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeMaxResponseSizeSetting(value) {
  var num = normalizeNumberSetting(value);
  return num > 0 ? num : DEFAULT_MAX_RESPONSE_SIZE_KB;
}

function normalizeWebSocketKeepAliveInterval(value) {
  var num = normalizeNumberSetting(value);
  if (num <= 0) return DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS;
  return Math.min(MAX_WS_KEEPALIVE_INTERVAL_SECONDS, Math.max(MIN_WS_KEEPALIVE_INTERVAL_SECONDS, num));
}

function normalizeWebSocketKeepAliveMessage(value) {
  var text = String(value ?? '').trim();
  return text || DEFAULT_WS_KEEPALIVE_MESSAGE;
}

function normalizeTlsValidation(value) {
  return value === 'strict' || value === 'insecure' ? value : 'default';
}

function getRequestSettings(data) {
  return {
    timeout: normalizeNumberSetting(data?.timeout),
    followRedirects: data?.followRedirects === true,
    saveToHistory: data?.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(data?.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(data?.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(data?.retryCount),
    retryDelayMs: normalizeNumberSetting(data?.retryDelayMs),
    stopAfterHeaders: data?.stopAfterHeaders === true,
    skipDefaultHeaders: data?.skipDefaultHeaders === true,
    disableScripts: data?.disableScripts === true,
    scriptsTrusted: data?.scriptsTrusted !== false,
    webSocketKeepAliveEnabled: data?.webSocketKeepAliveEnabled === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(data?.webSocketKeepAliveIntervalSeconds),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(data?.webSocketKeepAliveMessage),
  };
}

function applyRequestSettings(target, data) {
  var settings = getRequestSettings(data);
  target.timeout = settings.timeout;
  target.followRedirects = settings.followRedirects;
  target.saveToHistory = settings.saveToHistory;
  target.tlsValidation = settings.tlsValidation;
  target.maxResponseSizeKb = settings.maxResponseSizeKb;
  target.retryCount = settings.retryCount;
  target.retryDelayMs = settings.retryDelayMs;
  target.stopAfterHeaders = settings.stopAfterHeaders;
  target.skipDefaultHeaders = settings.skipDefaultHeaders;
  target.disableScripts = settings.disableScripts;
  target.scriptsTrusted = settings.scriptsTrusted;
  target.webSocketKeepAliveEnabled = settings.webSocketKeepAliveEnabled;
  target.webSocketKeepAliveIntervalSeconds = settings.webSocketKeepAliveIntervalSeconds;
  target.webSocketKeepAliveMessage = settings.webSocketKeepAliveMessage;
  return target;
}

function requestSettingsSnapshot(tab) {
  return {
    timeout: tab.timeout,
    followRedirects: !!tab.followRedirects,
    saveToHistory: tab.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(tab.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(tab.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(tab.retryCount),
    retryDelayMs: normalizeNumberSetting(tab.retryDelayMs),
    stopAfterHeaders: !!tab.stopAfterHeaders,
    skipDefaultHeaders: !!tab.skipDefaultHeaders,
    disableScripts: !!tab.disableScripts,
    scriptsTrusted: tab.scriptsTrusted !== false,
    webSocketKeepAliveEnabled: tab.webSocketKeepAliveEnabled === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage),
  };
}

function buildSaveRequestMessage(tab, requestId) {
  var payload = {
    type: 'saveRequest',
    requestType: normalizeRequestType(tab.requestType, tab.url),
    method: tab.method,
    url: tab.url,
    headers: tab.headers,
    params: tab.params,
    body: tab.body,
    bodyType: tab.bodyType,
    formData: tab.formData || [],
    binaryFilePath: tab.binaryFilePath || '',
    auth: tab.auth,
    scripts: tab.scripts || { preRequest: '', test: '' },
  };
  if (requestId !== undefined) {
    payload.requestId = requestId;
  }
  return Object.assign(payload, requestSettingsSnapshot(tab));
}

function snapshotTab(tab) {
  return JSON.stringify({
    requestType: normalizeRequestType(tab.requestType, tab.url),
    method: tab.method, url: tab.url,
    headers: tab.headers, params: tab.params,
    body: tab.body, bodyType: tab.bodyType,
    formData: tab.formData, binaryFilePath: tab.binaryFilePath,
    auth: tab.auth, scripts: tab.scripts,
    settings: requestSettingsSnapshot(tab)
  });
}


function isTabDirty(tab) {
  if (!tab) return false;
  
  if (!tab._snapshot) {
    return !!(
      tab.url ||
      tab.headers.some(function(h){return h.key||h.value}) ||
      tab.params.some(function(p){return p.key||p.value}) ||
      tab.body ||
      (tab.formData || []).some(function(field){return field.key || field.value}) ||
      tab.binaryFilePath ||
      tab.scripts?.preRequest ||
      tab.scripts?.test ||
      tab.timeout ||
      tab.followRedirects ||
      tab.saveToHistory === false ||
      (tab.tlsValidation && tab.tlsValidation !== 'default') ||
      tab.maxResponseSizeKb ||
      tab.retryCount ||
      tab.retryDelayMs ||
      tab.stopAfterHeaders ||
      tab.skipDefaultHeaders ||
      tab.disableScripts ||
      tab.webSocketKeepAliveEnabled ||
      normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds) !== DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS ||
      normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage) !== DEFAULT_WS_KEEPALIVE_MESSAGE
    );
  }
  
  return snapshotTab(tab) !== tab._snapshot;
}


function markDirty() {
  var tab = tabs.find(function(t){return t.id === activeTabId});
  if (!tab) return;
  saveActiveTabState();
  var wasDirty = tab.dirty;
  tab.dirty = isTabDirty(tab);
  if (tab.dirty !== wasDirty) renderTabBar();
}

function isEditableTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}

${getRequestPanelBodyClientScript()}

${getRequestPanelResponseClientScript()}

${getRequestPanelRunnerClientScript()}

  function createTab(data) {
    const id = 'tab_' + (++tabIdCounter);
    const incomingName = data?.name;
    const autoName = data?.autoName === true
      || (!incomingName && !data?.requestId)
      || (data?.autoName !== false && !data?.requestId && isKnownDefaultTabName(incomingName || ''));
    const tab = applyRequestSettings({
      id,
    requestEditorTab: normalizeRequestEditorTab(data?.requestEditorTab),
    requestEditorExpanded: data?.requestEditorExpanded !== false,
    requestSplitHeightPx: normalizeRequestSplitHeight(data?.requestSplitHeightPx),
    requestId: data?.requestId || null,
    name: autoName ? tr('webview.stage.newRequest') : (incomingName || tr('webview.stage.newRequest')),
    autoName: autoName,
    requestType: normalizeRequestType(data?.requestType, data?.url),
    method: data?.method || 'GET',
    url: data?.url || '',
    headers: data?.headers || [],
    params: data?.params || [],
    body: data?.body || '',
    bodyType: normalizeBodyType(data?.bodyType),
    formData: data?.formData || [],
    binaryFilePath: data?.binaryFilePath || '',
    auth: data?.auth || { type: 'none' },
      scripts: data?.scripts || { preRequest: '', test: '' },
      jsonFormatStyle: data?.jsonFormatStyle || 'pretty',
      xmlFormatStyle: data?.xmlFormatStyle || 'inline',
      formatIndent: data?.formatIndent || '2',
      responseSearchQuery: typeof data?.responseSearchQuery === 'string' ? data.responseSearchQuery : '',
      responseSearchIndex: typeof data?.responseSearchIndex === 'number' ? data.responseSearchIndex : 0,
      responseSearchCaseSensitive: data?.responseSearchCaseSensitive === true,
      responseSearchRegex: data?.responseSearchRegex === true,
      scriptHelpCollapsed: data?.scriptHelpCollapsed === true,
      pinned: data?.pinned || false,
      dirty: false,
    _snapshot: null,
    response: null,
    websocketStatus: 'closed',
    websocketMessages: [],
    resolvedUrl: '',
    resolvedHeaders: [],
    scriptResults: null,
    error: null,
    loading: false,
    progressVisible: false,
    slideIn: false,
    lastEvent: data?.lastEvent || 'idle',
    responseTab: data?.responseTab || 'resBody',
    sendTime: 0,
    requestStartedAt: normalizeEpochMs(data?.requestStartedAt),
    requestEndedAt: normalizeEpochMs(data?.requestEndedAt),
    durationMs: normalizeDurationMs(data?.durationMs),
  }, data);
  syncRequestTypeFromUrl(tab);
  resetBodyUndoState(tab, tab.body);
  
  if (data?.requestId) {
    tab._snapshot = snapshotTab(tab);
  }
  tabs.push(tab);
  switchTab(id);
  if (data) debouncePersist();
  return id;
}

function clearTabRequestState(tab) {
  if (!tab) return;
  tab.loading = false;
  tab.progressVisible = false;
  if (tab._progressTimer) { clearTimeout(tab._progressTimer); tab._progressTimer = null; }
  if (tab._elapsedTimer) { clearInterval(tab._elapsedTimer); tab._elapsedTimer = null; }
}

function disconnectWebSocketIfOpen(tab) {
  if (tab?.websocketStatus && tab.websocketStatus !== 'closed') {
    websocketDisconnect(tab);
  }
}

function doCloseTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;
  const tab = tabs[idx];
  if (tab?.loading) {
    clearTabRequestState(tab);
    vscode.postMessage({ type: 'cancelRequest', tabId: id });
  }
  disconnectWebSocketIfOpen(tab);
  tabs.splice(idx, 1);
  if (activeTabId === id) {
    activeTabId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)].id : null;
  }
  renderTabBar();
  renderContent();
  debouncePersist();
}

function closeTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  if (tab.pinned) return;
  
  if (id === activeTabId) saveActiveTabState();
  tab.dirty = isTabDirty(tab);
  if (tab.dirty) {
    showDirtyConfirm(id);
    return;
  }
  doCloseTab(id);
}


function showDirtyConfirm(tabId) {
  
  var old = document.getElementById('dirtyConfirmOverlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'dirtyConfirmOverlay';
  overlay.className = 'dirty-confirm-overlay';
  overlay.innerHTML =
    '<div class="dirty-confirm-dialog">' +
      '<div class="dirty-confirm-msg">' + escapeHtml(tr('webview.unsavedClosePrompt')) + '</div>' +
      '<div class="dirty-confirm-actions">' +
        '<button class="dirty-btn dirty-btn-save" data-action="save">' + escapeHtml(tr('webview.save')) + '</button>' +
        '<button class="dirty-btn dirty-btn-discard" data-action="discard">' + escapeHtml(tr('webview.discard')) + '</button>' +
        '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    overlay.remove();
    if (action === 'save') {
      
      var tab = tabs.find(function(t){return t.id === tabId});
      if (tab && tab.url) {
        if (tabId === activeTabId) saveActiveTabState();
        _pendingCloseAfterSave = tabId;
        vscode.postMessage(buildSaveRequestMessage(tab, tab.requestId || undefined));
      } else {
        doCloseTab(tabId);
      }
    } else if (action === 'discard') {
      doCloseTab(tabId);
    }
    
  });
}


function closeTabs(ids) {
  if (!ids || ids.length === 0) return;
  var queue = ids.slice();
  function next() {
    while (queue.length > 0) {
      var id = queue.shift();
      var tab = tabs.find(function(t){return t.id === id});
      if (!tab || tab.pinned) continue;
      if (id === activeTabId) saveActiveTabState();
      tab.dirty = isTabDirty(tab);
      if (tab.dirty) {
        showBatchDirtyConfirm(id, queue);
        return;
      }
      doCloseTab(id);
    }
  }
  next();

  function showBatchDirtyConfirm(tabId, remaining) {
    var old = document.getElementById('dirtyConfirmOverlay');
    if (old) old.remove();
    var tabObj = tabs.find(function(t){return t.id === tabId});
    var tabLabel = tabObj ? (tabObj.name || tr('webview.stage.newRequest')) : '';
    var overlay = document.createElement('div');
    overlay.id = 'dirtyConfirmOverlay';
    overlay.className = 'dirty-confirm-overlay';
    overlay.innerHTML =
      '<div class="dirty-confirm-dialog">' +
        '<div class="dirty-confirm-msg">' + escapeHtml(tf('webview.unsavedCloseNamedPrompt', { name: tabLabel })) + '</div>' +
        '<div class="dirty-confirm-actions">' +
          '<button class="dirty-btn dirty-btn-discard" data-action="discard">' + escapeHtml(tr('webview.discard')) + '</button>' +
          '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      var action = e.target.dataset.action;
      if (!action) return;
      overlay.remove();
      if (action === 'discard') {
        doCloseTab(tabId);
        next();
      }
      
    });
  }
}


function addRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const size = Math.max(rect.width, rect.height) * 4;
  const circle = document.createElement('span');
  circle.className = 'ripple-circle';
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (x - size / 2) + 'px';
  circle.style.top = (y - size / 2) + 'px';
  btn.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}


function showBtnFeedback(btn, text, duration) {
  duration = duration || 1500;
  const origHtml = btn.innerHTML;
  btn.innerHTML = text;
  setTimeout(() => { btn.innerHTML = origHtml; }, duration);
}

// Floating toast (for row-level copy feedback etc.)
var copyToastEl = null;
var copyToastTimer = null;
function showCopyToast(text, duration) {
  duration = duration || 1600;
  if (!copyToastEl) {
    copyToastEl = document.createElement('div');
    copyToastEl.className = 'copy-toast';
    document.body.appendChild(copyToastEl);
  }
  copyToastEl.textContent = text;
  void copyToastEl.offsetWidth;
  copyToastEl.classList.add('visible');
  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(function() {
    if (copyToastEl) copyToastEl.classList.remove('visible');
  }, duration);
}


function triggerSendStreak(btn) {
  btn.classList.add('streak-active');
  setTimeout(() => btn.classList.remove('streak-active'), 400);
}



function triggerSendSlam(btn) {
  triggerSendStreak(btn);
  setTimeout(function() {
    var newBtn = mainContent.querySelector('.js-send');
    if (newBtn) {
      newBtn.classList.add('send-click');
      newBtn.classList.add('send-click-flash');
      setTimeout(function() { newBtn.classList.remove('send-click-flash'); }, 100);
      setTimeout(function() { newBtn.classList.remove('send-click'); }, 300);
    }
  }, 0);
}


function triggerStopSlam(btn) {
  
  btn.classList.remove('stop-slam');
  void btn.offsetWidth;
  btn.classList.add('stop-slam');
  
  btn.classList.add('stop-flash');
  setTimeout(function() { btn.classList.remove('stop-flash'); }, 160);
  
  setTimeout(function() { btn.classList.remove('stop-slam'); }, 400);
  // vignette flash
  var vig = document.createElement('div');
  vig.className = 'stop-vignette-flash';
  document.body.appendChild(vig);
  setTimeout(function() { vig.remove(); }, 300);
}



document.addEventListener('click', function(e) {
  const btn = e.target.closest('.ripple-btn');
  if (!btn) return;
  addRipple(btn, e);
  
  if (btn.classList.contains('btn-send') || btn.classList.contains('btn-stop')) return;
  
  btn.classList.add('btn-flash');
  setTimeout(function() { btn.classList.remove('btn-flash'); }, 100);
  
  btn.classList.remove('btn-bouncing');
  void btn.offsetWidth;
  btn.classList.add('btn-bouncing');
  btn.addEventListener('animationend', function handler() {
    btn.classList.remove('btn-bouncing');
    btn.removeEventListener('animationend', handler);
  });
});

function appendWebSocketMessage(tab, item) {
  if (!tab) return;
  tab.websocketMessages = tab.websocketMessages || [];
  tab.websocketMessages.push(Object.assign({ timestamp: Date.now() }, item));
  if (tab.websocketMessages.length > 200) {
    tab.websocketMessages = tab.websocketMessages.slice(tab.websocketMessages.length - 200);
  }
}

function websocketStatusLabel(status) {
  if (status === 'open') return tr('webview.connected');
  if (status === 'connecting') return tr('webview.connecting');
  if (status === 'error') return tr('webview.stage.failed');
  return tr('webview.disconnected');
}

function websocketCloseCodeLabel(code) {
  var labels = {
    1000: 'Normal Closure',
    1001: 'Going Away',
    1002: 'Protocol Error',
    1003: 'Unsupported Data',
    1005: 'No Status Received',
    1006: 'Abnormal Closure',
    1007: 'Invalid Frame Payload Data',
    1008: 'Policy Violation',
    1009: 'Message Too Big',
    1010: 'Mandatory Extension',
    1011: 'Internal Error',
    1012: 'Service Restart',
    1013: 'Try Again Later',
    1015: 'TLS Handshake Failure'
  };
  return labels[code] || '';
}

function compactDiagnosticText(value, fallback) {
  var text = String(value || fallback || '').trim();
  if (!text) return '(no reason)';
  return text.length > 480 ? text.substring(0, 477) + '...' : text;
}

function formatWebSocketCloseMessage(msg) {
  var source = msg.closeSource || (msg.wasClean === true ? 'remote' : 'unexpected');
  var lines = [
    tr(source === 'user'
      ? 'webview.websocketClosedByUser'
      : (source === 'unexpected'
        ? 'webview.websocketClosedUnexpectedly'
        : 'webview.websocketClosedByRemote'))
  ];
  var code = typeof msg.code === 'number'
    ? msg.code
    : (source === 'unexpected' ? 1006 : 1005);
  var reason = compactDiagnosticText(msg.reason, source === 'user' ? 'User disconnect' : websocketCloseCodeLabel(code));
  var wasClean = typeof msg.wasClean === 'boolean'
    ? msg.wasClean
    : source !== 'unexpected';
  lines.push('code: ' + code);
  lines.push('reason: ' + reason);
  lines.push('wasClean: ' + String(wasClean));
  return lines.join('\\n');
}

function formatWebSocketErrorMessage(msg) {
  var lines = [tr('webview.websocketError')];
  lines.push('message: ' + compactDiagnosticText(msg.error, tr('webview.stage.failed')));
  if (msg.errorDetail && msg.errorDetail !== msg.error) {
    lines.push('detail: ' + compactDiagnosticText(msg.errorDetail, ''));
  }
  return lines.join('\\n');
}

function websocketConnect(tab) {
  if (!tab) return;
  saveActiveTabState();
  tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url) return;
  const mc = mainContent;
  const allHeaders = collectAllKv(mc.querySelector('.js-header-rows'));
  tab.requestType = 'websocket';
  tab.websocketStatus = 'connecting';
  tab.websocketMessages = [];
  tab.error = null;
  tab.response = null;
  tab.responseTab = 'resBody';
  tab.lastEvent = 'websocket';
  renderTabBar();
  renderContent();
  vscode.postMessage({
    type: 'websocketConnect',
    tabId: tab.id,
    url: tab.url,
    headers: allHeaders,
    params: tab.params,
    auth: tab.auth,
    timeout: tab.timeout,
    followRedirects: !!tab.followRedirects,
    saveToHistory: tab.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(tab.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(tab.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(tab.retryCount),
    retryDelayMs: normalizeNumberSetting(tab.retryDelayMs),
    stopAfterHeaders: !!tab.stopAfterHeaders,
    skipDefaultHeaders: !!tab.skipDefaultHeaders,
    disableScripts: !!tab.disableScripts,
    scriptsTrusted: tab.scriptsTrusted !== false,
    webSocketKeepAliveEnabled: tab.webSocketKeepAliveEnabled === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage),
  });
}

function websocketDisconnect(tab) {
  if (!tab) return;
  vscode.postMessage({ type: 'websocketDisconnect', tabId: tab.id });
}

function websocketSend(tab) {
  if (!tab) return;
  saveActiveTabState();
  tab = tabs.find(t => t.id === activeTabId);
  if (!tab || tab.websocketStatus !== 'open') return;
  vscode.postMessage({
    type: 'websocketSend',
    tabId: tab.id,
    message: tab.body || ''
  });
}

function handlePrimaryAction() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  if (isWebSocketTab(tab)) {
    if (tab.websocketStatus === 'connecting') {
      websocketDisconnect(tab);
      return;
    }
    if (tab.websocketStatus === 'open') {
      websocketSend(tab);
      return;
    }
    websocketConnect(tab);
    return;
  }
  if (tab.loading) {
    clearTabRequestState(tab);
    tab.lastEvent = 'canceled';
    tab.error = null;
    renderContent();
    vscode.postMessage({ type: 'cancelRequest', tabId: tab.id });
    return;
  }
  sendActiveTab();
}

function switchTab(id) {
  if (activeTabId === id) return;
  var previousTab = tabs.find(function(t) { return t.id === activeTabId; });
  saveActiveTabState();
  disconnectWebSocketIfOpen(previousTab);
  syncRequestTypeFromUrl(tabs.find(function(t) { return t.id === id; }));
  activeTabId = id;
  renderTabBar();
  renderContent();
  debouncePersist();
}

function saveActiveTabState() {
  if (!activeTabId) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  const mc = mainContent;
  const methodEl = mc.querySelector('.js-method');
  const urlEl = mc.querySelector('.js-url');
  if (!methodEl) return;
  tab.method = methodEl.value;
  tab.url = urlEl.value;
  syncRequestTypeFromUrl(tab);
  tab.headers = collectKv(mc.querySelector('.js-header-rows'));
  tab.params = collectKv(mc.querySelector('.js-param-rows'));
  tab.body = mc.querySelector('.js-body')?.value || '';
  tab.bodyType = mc.querySelector('.js-body-type')?.value || 'none';
  tab.formData = collectFormData(mc.querySelector('.js-formdata-rows'));
  tab.binaryFilePath = mc.querySelector('.js-binary-path')?.value || '';
  tab.auth = collectAuth(mc);
  tab.scripts = collectScripts(mc);
  tab.timeout = normalizeNumberSetting(mc.querySelector('.js-timeout')?.value);
  tab.followRedirects = mc.querySelector('.js-follow-redirects')?.checked === true;
  tab.saveToHistory = mc.querySelector('.js-save-history')?.checked !== false;
  tab.tlsValidation = normalizeTlsValidation(mc.querySelector('.js-tls-validation')?.value);
  tab.maxResponseSizeKb = normalizeMaxResponseSizeSetting(mc.querySelector('.js-max-response-size')?.value);
  tab.retryCount = normalizeNumberSetting(mc.querySelector('.js-retry-count')?.value);
  tab.retryDelayMs = normalizeNumberSetting(mc.querySelector('.js-retry-delay')?.value);
  tab.stopAfterHeaders = mc.querySelector('.js-stop-after-headers')?.checked === true;
  tab.skipDefaultHeaders = mc.querySelector('.js-skip-default-headers')?.checked === true;
  tab.disableScripts = mc.querySelector('.js-disable-scripts')?.checked === true;
  tab.webSocketKeepAliveEnabled = mc.querySelector('.js-ws-keepalive-enabled')?.checked === true;
  tab.webSocketKeepAliveIntervalSeconds = normalizeWebSocketKeepAliveInterval(mc.querySelector('.js-ws-keepalive-interval')?.value);
  tab.webSocketKeepAliveMessage = normalizeWebSocketKeepAliveMessage(mc.querySelector('.js-ws-keepalive-message')?.value);
  tab.requestEditorTab = normalizeRequestEditorTab(mc.querySelector('.js-req-tabs .tab.active')?.dataset.tab || tab.requestEditorTab);
}

function refreshRequestEditorLayout() {
  var schedule = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function(callback) { return setTimeout(callback, 0); };
  schedule(function() {
    if (typeof mainContent === 'undefined' || !mainContent || typeof applyAdaptiveRequestAreaHeight !== 'function') return;
    var reqArea = mainContent.querySelector('.req-area');
    if (!reqArea) return;
    var splitEl = mainContent.querySelector('.split');
    var dividerEl = mainContent.querySelector('.divider');
    var progressEl = mainContent.querySelector('.bullet-progress');
    var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
    if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(activeTab)) {
      applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, reqArea.offsetHeight || reqArea.style.height, activeTab, false);
      return;
    }
    applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, activeTab);
  });
}

function switchRequestEditorTabInContent(mc, tabName, options) {
  if (!mc) return;
  var normalizedTabName = normalizeRequestEditorTab(tabName);
  var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
  var previousTabName = normalizeRequestEditorTab(activeTab?.requestEditorTab);
  var isSameTab = !!activeTab && previousTabName === normalizedTabName;
  var shouldExpand = options?.expand === true
    ? true
    : (isSameTab ? activeTab.requestEditorExpanded === false : true);
  if (activeTab) {
    activeTab.requestEditorTab = normalizedTabName;
    activeTab.requestEditorExpanded = shouldExpand;
  }
  var tabsEl = mc.querySelectorAll('.js-req-tabs .tab');
  tabsEl.forEach(function(x) {
    var isActive = x.dataset.tab === normalizedTabName;
    x.classList.toggle('active', isActive);
    x.classList.toggle('collapsed', isActive && !shouldExpand);
    x.setAttribute('aria-selected', String(isActive));
    x.setAttribute('aria-expanded', String(isActive && shouldExpand));
  });
  var panels = { params: '.js-params-panel', headers: '.js-headers-panel', body: '.js-body-panel', auth: '.js-auth-panel', scripts: '.js-scripts-panel', settings: '.js-settings-panel' };
  Object.keys(panels).forEach(function(key) {
    mc.querySelector(panels[key])?.classList.toggle('hidden', !shouldExpand || key !== normalizedTabName);
  });
  if (normalizedTabName === 'headers') refreshDefaultHeadersBanner(mc);
  refreshRequestEditorLayout();
}

var linkedFocusTimer = null;
var linkedFocusFrame = null;
var editorLinkedFocusTimer = null;

function clearLinkedFocusInContent(mc) {
  if (linkedFocusTimer) {
    clearTimeout(linkedFocusTimer);
    linkedFocusTimer = null;
  }
  if (linkedFocusFrame) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(linkedFocusFrame);
    }
    linkedFocusFrame = null;
  }
  mc?.querySelectorAll('.linked-focus-active').forEach(function(node) {
    node.classList.remove('linked-focus-active');
  });
}

function resolveLinkedFocusTargetInContent(mc, targetKey) {
  if (!mc || !targetKey) return null;
  var selectors = {
    'params': '.js-params-panel',
    'headers': '.js-headers-panel',
    'body': '.js-body-panel',
    'auth': '.js-auth-panel',
    'scripts': '.js-scripts-panel',
    'scripts:pre-request': '.js-script-prerequest',
    'scripts:test': '.js-script-test',
    'settings': '.js-settings-panel',
    'settings:save-history': '.js-save-history',
    'settings:skip-default-headers': '.js-skip-default-headers',
    'settings:disable-scripts': '.js-disable-scripts',
    'settings:follow-redirects': '.js-follow-redirects',
    'settings:stop-after-headers': '.js-stop-after-headers',
    'settings:timeout': '.js-timeout',
    'settings:max-response-size': '.js-max-response-size',
    'settings:retry-count': '.js-retry-count',
    'settings:retry-delay': '.js-retry-delay',
    'settings:tls-validation': '.js-tls-validation',
    'settings:websocket-keepalive': '.js-ws-keepalive-enabled'
  };
  var selector = selectors[targetKey] || selectors[String(targetKey).split(':')[0]] || null;
  if (!selector) return null;
  return mc.querySelector(selector);
}

function resolveLinkedFocusContainer(target) {
  if (!target) return null;
  return target.closest('.settings-toggle, .script-card, .script-help-line, .default-headers-banner, .body-section') || target;
}

function focusLinkedTarget(target) {
  if (!target) return;
  if (typeof target.focus === 'function') {
    try {
      target.focus({ preventScroll: true });
      return;
    } catch (_) {
      target.focus();
      return;
    }
  }
  var focusable = target.querySelector('input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
  if (focusable && typeof focusable.focus === 'function') {
    try {
      focusable.focus({ preventScroll: true });
    } catch (_) {
      focusable.focus();
    }
  }
}

function queueLinkedFocusReveal(callback) {
  if (linkedFocusFrame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(linkedFocusFrame);
  }
  linkedFocusFrame = requestAnimationFrame(function() {
    linkedFocusFrame = requestAnimationFrame(function() {
      linkedFocusFrame = null;
      callback();
    });
  });
}

function revealLinkedTargetInContent(mc, targetKey) {
  var target = resolveLinkedFocusTargetInContent(mc, targetKey);
  if (!target) return false;
  var container = resolveLinkedFocusContainer(target);
  clearLinkedFocusInContent(mc);
  if (typeof container.scrollIntoView === 'function') {
    try {
      container.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (_) {
      container.scrollIntoView();
    }
  }
  queueLinkedFocusReveal(function() {
    if (!container?.isConnected || !target?.isConnected) return;
    container.classList.add('linked-focus-active');
    focusLinkedTarget(target);
    linkedFocusTimer = setTimeout(function() {
      container.classList.remove('linked-focus-active');
      linkedFocusTimer = null;
    }, 2200);
  });
  return true;
}

function revealDefaultHeadersEditor() {
  if (!defaultHeadersEditor) return;
  defaultHeadersEditor.classList.remove('hidden');
  if (editorLinkedFocusTimer) {
    clearTimeout(editorLinkedFocusTimer);
    editorLinkedFocusTimer = null;
  }
  defaultHeadersEditor.classList.remove('linked-focus-active');
  if (typeof defaultHeadersEditor.scrollIntoView === 'function') {
    try {
      defaultHeadersEditor.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (_) {
      defaultHeadersEditor.scrollIntoView();
    }
  }
  queueLinkedFocusReveal(function() {
    if (!defaultHeadersEditor?.isConnected) return;
    defaultHeadersEditor.classList.add('linked-focus-active');
    var focusTarget = defaultHeaderRows?.querySelector('input[type="text"], input[type="password"]') || document.getElementById('addDefaultHeaderBtn') || defaultHeadersEditor;
    focusLinkedTarget(focusTarget);
    editorLinkedFocusTimer = setTimeout(function() {
      defaultHeadersEditor.classList.remove('linked-focus-active');
      editorLinkedFocusTimer = null;
    }, 2200);
  });
}

function syncEnvironmentStripDisclosureState() {
  var btn = mainContent?.querySelector('.status-strip-seg[data-action="edit-environment"]');
  if (!btn) return;
  btn.setAttribute('aria-expanded', isEnvironmentEditorOpen() ? 'true' : 'false');
}

function revealEnvironmentEditor() {
  if (!envEditor) return;
  envEditor.classList.remove('hidden');
  syncEnvironmentStripDisclosureState();
  if (editorLinkedFocusTimer) {
    clearTimeout(editorLinkedFocusTimer);
    editorLinkedFocusTimer = null;
  }
  envEditor.classList.remove('linked-focus-active');
  refreshEnvironmentEditorLayout();
  if (typeof envEditor.scrollIntoView === 'function') {
    try {
      envEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } catch (_) {
      envEditor.scrollIntoView();
    }
  }
  queueLinkedFocusReveal(function() {
    if (!envEditor?.isConnected) return;
    envEditor.classList.add('linked-focus-active');
    var focusTarget = envVarRows?.querySelector('input[type="text"], input[type="password"]') || addEnvVarBtn || envEditor;
    focusLinkedTarget(focusTarget);
    editorLinkedFocusTimer = setTimeout(function() {
      envEditor.classList.remove('linked-focus-active');
      editorLinkedFocusTimer = null;
    }, 2200);
  });
}

function toggleEnvironmentEditor() {
  if (!editingEnvId) {
    vscode.postMessage({ type: 'switchEnvironment' });
    return;
  }
  if (isEnvironmentEditorOpen()) {
    hideEnvironmentEditor();
    return;
  }
  revealEnvironmentEditor();
}

function switchRequestEditorTabAndRevealInContent(mc, meta) {
  if (!mc || !meta) return;
  var metaValue = String(meta);
  var tabName = metaValue.split(':')[0];
  switchRequestEditorTabInContent(mc, tabName, { expand: true });
  revealLinkedTargetInContent(mc, metaValue);
}


function triggerSaveFromShortcut(forceSaveAs) {
  saveActiveTabState();
  const tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.url) return;
  vscode.postMessage(buildSaveRequestMessage(tab, forceSaveAs ? undefined : (tab.requestId || undefined)));
}


function toggleBulkEditor(mc, target, open) {
  mc?.querySelectorAll('.js-bulk-editor').forEach(function(panel) {
    var match = panel.dataset.target === target;
    panel.classList.toggle('hidden', !(open && match));
    if (open && match) {
      panel.querySelector('.js-bulk-editor-input')?.focus();
    }
  });
}

function applyBulkEditor(mc, target) {
  var editor = mc?.querySelector('.js-bulk-editor[data-target="' + target + '"]');
  var rows = mc?.querySelector(target === 'headers' ? '.js-header-rows' : '.js-param-rows');
  var input = editor?.querySelector('.js-bulk-editor-input');
  if (!editor || !rows || !input) return;
  var parsed = parseBulkKeyValueText(input.value, target);
  if (!parsed.length) return;
  parsed.forEach(function(item) { addKvRow(rows, item.key, item.value); });
  rows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  input.value = '';
  toggleBulkEditor(mc, target, false);
  if (target === 'params') syncUrlFromParamsEditor(mc);
  markDirty();
  refreshDraftInsights(mc);
}

function renderTabBar() {
  
  tabBar.querySelectorAll('.req-tab').forEach(el => el.remove());

  
  const sorted = tabs.filter(t => t.pinned).concat(tabs.filter(t => !t.pinned));

  for (const tab of sorted) {
    syncRequestTypeFromUrl(tab);
    const tabMethod = isWebSocketTab(tab) ? 'WS' : tab.method;
    const el = document.createElement('div');
    el.className = 'req-tab' + (tab.id === activeTabId ? ' active' : '') + (tab.pinned ? ' pinned' : '') + ' tab-' + tabMethod;
    el.setAttribute('role', 'tab');
    el.setAttribute('tabindex', tab.id === activeTabId ? '0' : '-1');
    el.setAttribute('aria-selected', tab.id === activeTabId ? 'true' : 'false');
    el.setAttribute('aria-label', tabMethod + ' ' + tab.name);
    el.title = tab.name;
    el.innerHTML =
      '<span class="pin-icon">\u{1F4CC}</span>' +
      '<span class="method-badge method-' + tabMethod + '">' + tabMethod + '</span>' +
      '<span class="tab-name">' + escapeHtml(truncate(tab.name, 25)) + '</span>' +
      (tab.dirty ? '<span class="dirty-dot" title="' + escapeAttr(renderRequestDirtyTitle(tab)) + '">\u25CF</span>' : '') +
      '<button class="close-tab" type="button" data-id="' + tab.id + '" title="' + escapeAttr(tr('webview.close')) + '" aria-label="' + escapeAttr(tr('webview.close')) + '">&times;</button>';
    el.addEventListener('click', (e) => {
      const closeButton = e.target.closest('.close-tab');
      if (closeButton && el.contains(closeButton)) {
        closeTab(closeButton.dataset.id);
      } else {
        switchTab(tab.id);
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.target.closest('.close-tab')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchTab(tab.id);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(e.clientX, e.clientY, tab.id);
    });
    tabBar.insertBefore(el, addTabBtn);
  }
}

function showTabContextMenu(x, y, tabId) {
  closeTabContextMenu();
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const tabIdx = tabs.indexOf(tab);
  const othersClosable = tabs.filter(t => t.id !== tabId && !t.pinned);
  const rightClosable = tabs.filter((t, i) => i > tabIdx && !t.pinned);
  const allClosable = tabs.filter(t => !t.pinned);

  const items = [
    { label: tr('webview.close'), action: 'close', disabled: !!tab.pinned },
    { label: tr('webview.closeOthers'), action: 'closeOthers', disabled: othersClosable.length === 0 },
    { label: tr('webview.closeAll'), action: 'closeAll', disabled: allClosable.length === 0 },
    { label: tr('webview.closeRight'), action: 'closeRight', disabled: rightClosable.length === 0 },
    { sep: true },
    tab.pinned
      ? { label: tr('webview.unpinTab'), action: 'unpin' }
      : { label: tr('webview.pinTab'), action: 'pin' },
    { sep: true },
    { label: tr('webview.duplicateTab'), action: 'duplicate' },
  ];

  const menu = document.createElement('div');
  menu.className = 'tab-ctx-menu';
  menu.id = 'tabCtxMenu';
  items.forEach(function(it) {
    if (it.sep) {
      var sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      return;
    }
    var el = document.createElement('div');
    el.className = 'ctx-item' + (it.disabled ? ' disabled' : '');
    el.textContent = it.label;
    el.dataset.action = it.action;
    menu.appendChild(el);
  });

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.body.appendChild(menu);

  
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

  menu.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    closeTabContextMenu();
    switch (action) {
      case 'close':
        closeTab(tabId);
        break;
      case 'closeOthers':
        closeTabs(othersClosable.map(function(t){return t.id}));
        break;
      case 'closeAll':
        closeTabs(allClosable.map(function(t){return t.id}));
        break;
      case 'closeRight':
        closeTabs(rightClosable.map(function(t){return t.id}));
        break;
      case 'pin':
        tab.pinned = true;
        renderTabBar();
        debouncePersist();
        break;
      case 'unpin':
        tab.pinned = false;
        renderTabBar();
        debouncePersist();
        break;
      case 'duplicate':
        saveActiveTabState();
        createTab({ name: tab.name, autoName: !!tab.autoName, requestType: tab.requestType, requestEditorTab: tab.requestEditorTab, method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout, followRedirects: tab.followRedirects, saveToHistory: tab.saveToHistory, tlsValidation: tab.tlsValidation, maxResponseSizeKb: tab.maxResponseSizeKb, retryCount: tab.retryCount, retryDelayMs: tab.retryDelayMs, stopAfterHeaders: tab.stopAfterHeaders, skipDefaultHeaders: tab.skipDefaultHeaders, disableScripts: tab.disableScripts, scriptsTrusted: tab.scriptsTrusted !== false, webSocketKeepAliveEnabled: tab.webSocketKeepAliveEnabled === true, webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds), webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage), jsonFormatStyle: tab.jsonFormatStyle, xmlFormatStyle: tab.xmlFormatStyle, formatIndent: tab.formatIndent, responseSearchQuery: tab.responseSearchQuery || '', responseSearchIndex: typeof tab.responseSearchIndex === 'number' ? tab.responseSearchIndex : 0, responseSearchCaseSensitive: tab.responseSearchCaseSensitive === true, responseSearchRegex: tab.responseSearchRegex === true, scriptHelpCollapsed: tab.scriptHelpCollapsed === true });
        break;
    }
  });
  setTimeout(function() { document.addEventListener('click', closeTabContextMenu, { once: true }); }, 0);
}

function closeTabContextMenu() {
  var m = document.getElementById('tabCtxMenu');
  if (m) m.remove();
}

function getRequestStageInfo(tab) {
  if (!tab) {
    return { tone: 'idle', label: tr('webview.stage.newRequest'), detail: tr('webview.stage.newRequest.detail') };
  }
  if (isWebSocketTab(tab)) {
    if (tab.websocketStatus === 'open') {
      return { tone: 'success', label: tr('webview.connected'), detail: tr('webview.websocket') };
    }
    if (tab.websocketStatus === 'connecting') {
      return { tone: 'loading', label: tr('webview.connecting'), detail: tr('webview.websocket') };
    }
    if (tab.websocketStatus === 'error' && tab.error) {
      return { tone: 'error', label: tr('webview.stage.failed'), detail: truncate(tab.error, 96) };
    }
    if (tab.websocketStatus === 'closed' && (tab.websocketMessages || []).length > 0) {
      return { tone: 'idle', label: tr('webview.disconnected'), detail: tr('webview.websocket') };
    }
    if (tab.url) {
      return { tone: 'ready', label: tr('webview.websocket'), detail: tr('webview.websocketComposer') };
    }
  }
  if (tab.loading) {
    return { tone: 'loading', label: tr('webview.stage.sending'), detail: tr('webview.stage.sending.detail') };
  }
  if (tab.lastEvent === 'canceled') {
    return {
      tone: 'canceled',
      label: tr('webview.stage.canceled'),
      detail: tab.response ? tr('webview.stage.canceled.withResponse') : tr('webview.stage.canceled.noResponse')
    };
  }
  if (tab.error) {
    return { tone: 'error', label: tr('webview.stage.failed'), detail: truncate(tab.error, 96) };
  }
  if (tab.response) {
    var status = tab.response.status || 0;
    var durationLabel = formatDurationMs(getResponseDurationMs(tab, tab.response.time)) || (tab.response.time + ' ms');
    if (status >= 500) {
      return { tone: 'error', label: tr('webview.stage.serverError'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
    }
    if (status >= 400) {
      return { tone: 'error', label: tr('webview.stage.clientError'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
    }
    if (status >= 300) {
      return { tone: 'redirect', label: tr('webview.stage.redirected'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
    }
    return { tone: 'success', label: tr('webview.stage.liveResponse'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
  }
  if (tab.url) {
    return { tone: 'ready', label: tr('webview.stage.ready'), detail: tr('webview.stage.ready.detail') };
  }
  return { tone: 'idle', label: tr('webview.stage.newRequest'), detail: tr('webview.stage.newRequest.detail') };
}

function renderPrimaryActionButton(tab) {
  if (isWebSocketTab(tab)) {
    if (tab.websocketStatus === 'connecting') {
      return '<button class="btn-stop js-send" data-testid="stop-request">' +
        '<span class="stop-icon"></span>' +
        '<span class="btn-send-labels">' +
          '<span class="btn-send-primary">' + escapeHtml(tr('webview.disconnect')) + '</span>' +
          '<span class="btn-send-secondary">' + escapeHtml(tr('webview.connecting')) + '</span>' +
        '</span>' +
      '</button>';
    }
    var wsTone = tab.websocketStatus === 'open' ? 'success' : (tab.websocketStatus === 'error' ? 'error' : 'ready');
    var wsPrimary = tab.websocketStatus === 'open' ? tr('webview.sendMessage') : tr('webview.connect');
    var wsSecondary = tab.websocketStatus === 'open'
      ? tr('webview.connected')
      : (tab.websocketStatus === 'error' && tab.error ? tab.error : tr('webview.websocket'));
    var wsIcon = tab.websocketStatus === 'open'
      ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.5l14 6.5-14 6.5V9l10-1-10-1V1.5z"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h10a1 1 0 011 1v6a1 1 0 01-1 1H8.5L5 13.5V10H3a1 1 0 01-1-1V3a1 1 0 011-1zm1 2v4h3v2.1L9.1 8H12V4H4z"/></svg>';
    // WS open일 때만 summary/status에서 성공을 표현 — Send/Connect 필은 액션 색 유지
    var sendTone = wsTone === 'success' ? 'ready' : (wsTone === 'error' ? 'ready' : wsTone);
    return '<button class="btn-send state-' + sendTone + ' js-send" data-testid="send-request">' +
      wsIcon +
      '<span class="btn-send-labels">' +
        '<span class="btn-send-primary">' + escapeHtml(wsPrimary) + '</span>' +
        '<span class="btn-send-secondary">' + escapeHtml(wsSecondary) + '</span>' +
      '</span>' +
    '</button>';
  }
  if (tab.loading) {
    return '<button class="btn-stop js-send" data-testid="stop-request">' +
      '<span class="stop-icon"></span>' +
      '<span class="btn-send-labels">' +
        '<span class="btn-send-primary">' + escapeHtml(tr('webview.stop')) + '</span>' +
        '<span class="btn-send-secondary">' + escapeHtml(tr('webview.stage.sending.detail')) + '</span>' +
      '</span>' +
    '</button>';
  }

  var tone = 'ready';
  var primary = tr('webview.send');
  var secondary = '';
  var icon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.5l14 6.5-14 6.5V9l10-1-10-1V1.5z"/></svg>';
  var keyHint = '<span class="btn-keyhint">Enter</span>';

  if (tab.lastEvent === 'success' && tab.response) {
    // 성공 강조는 응답 sticky summary만 담당 — Send secondary에 2xx를 미러하지 않음
    tone = 'ready';
    primary = tr('webview.sendAgain');
    secondary = '';
    keyHint = '';
  } else if (tab.lastEvent === 'error') {
    tone = 'ready';
    primary = tr('webview.retry');
    secondary = tab.error || tr('webview.stage.failed');
    keyHint = '';
  } else if (tab.lastEvent === 'canceled') {
    tone = 'ready';
    primary = tr('webview.sendAgain');
    secondary = tr('webview.stage.canceled');
    keyHint = '';
  }

  return '<button class="btn-send state-' + tone + ' js-send" data-testid="send-request">' +
    icon +
    '<span class="btn-send-labels">' +
      '<span class="btn-send-primary">' + escapeHtml(primary) + '</span>' +
      (secondary ? '<span class="btn-send-secondary">' + escapeHtml(secondary) + '</span>' : '') +
    '</span>' +
    keyHint +
  '</button>';
}


function buildSampleRequestData() {
  return {
    name: tr('webview.sampleRequestName'),
    autoName: false,
    requestId: null,
    method: 'GET',
    url: 'https://dummyjson.com/products/search?q=phone',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    params: [],
    body: '',
    bodyType: 'none',
    formData: [],
    binaryFilePath: '',
    auth: { type: 'none' },
    scripts: { preRequest: '', test: '' },
    timeout: 0,
    followRedirects: false,
    saveToHistory: true,
    tlsValidation: 'default',
    maxResponseSizeKb: DEFAULT_MAX_RESPONSE_SIZE_KB,
    retryCount: 0,
    retryDelayMs: 0,
    stopAfterHeaders: false,
    skipDefaultHeaders: false,
    disableScripts: false,
    webSocketKeepAliveEnabled: false,
    webSocketKeepAliveIntervalSeconds: DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS,
    webSocketKeepAliveMessage: DEFAULT_WS_KEEPALIVE_MESSAGE,
  };
}

function loadSampleRequestIntoActiveTab() {
  var sample = buildSampleRequestData();
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab) {
    createTab(sample);
    return;
  }
  Object.assign(tab, sample, {
    id: tab.id,
    response: null,
    error: null,
    lastEvent: 'ready',
    dirty: true,
    _snapshot: null,
    responseTab: 'resBody',
    pinned: false,
    requestStartedAt: null,
    requestEndedAt: null,
    durationMs: null,
  });
  resetBodyUndoState(tab, tab.body);
  renderTabBar();
  renderContent();
  debouncePersist();
}

function renderEmptyState(title, copy, actions) {
  // Quiet Instrument: 짧은 안내 + 주요 액션만 (orbit/카드/kicker 없음); 저대비 Tessra mark 1회
  return '<div class="empty-state">' +
    renderTessraMark('tessra-mark--empty') +
    '<div class="empty-state-title">' + escapeHtml(title) + '</div>' +
    '<div class="empty-state-copy">' + escapeHtml(copy) + '</div>' +
    ((actions && actions.length)
      ? '<div class="empty-state-actions">' + actions.map(function(action, index) {
          return '<button class="empty-state-action js-empty-action' + (index === 0 ? ' primary' : '') + '" type="button" data-action="' + escapeAttr(action.action || '') + '">' + escapeHtml(action.label || '') + '</button>';
        }).join('') + '</div>'
      : '') +
  '</div>';
}


function getEnabledDefaultHeaders() {
  return (workspaceDefaultHeaders || []).filter(function(header) {
    return header && header.enabled !== false && header.key;
  });
}

function getAppliedDefaultHeaders(tab) {
  if (!tab || tab.skipDefaultHeaders) return [];
  var requestHeaderKeys = new Set((tab.headers || [])
    .filter(function(header) { return header && header.enabled !== false && header.key; })
    .map(function(header) { return String(header.key).toLowerCase(); }));
  return getEnabledDefaultHeaders().filter(function(header) {
    return !requestHeaderKeys.has(String(header.key).toLowerCase());
  });
}

function getOverriddenDefaultHeaders(tab) {
  if (!tab || tab.skipDefaultHeaders) return [];
  var requestHeaderKeys = new Set((tab.headers || [])
    .filter(function(header) { return header && header.enabled !== false && header.key; })
    .map(function(header) { return String(header.key).toLowerCase(); }));
  return getEnabledDefaultHeaders().filter(function(header) {
    return requestHeaderKeys.has(String(header.key).toLowerCase());
  });
}

function renderDefaultHeaderKeyGroup(labelKey, headers, chipClass) {
  if (!headers.length) return '';
  return '<div class="default-headers-key-group">' +
    '<div class="default-headers-key-label">' + escapeHtml(tr(labelKey)) + '</div>' +
    '<div class="default-headers-key-list">' + headers
      .slice(0, 6)
      .map(function(header) {
        return '<span class="default-header-chip' + chipClass + '">' + escapeHtml(header.key) + '</span>';
      })
      .join('') +
      (headers.length > 6 ? '<span class="default-header-chip' + chipClass + '">+' + (headers.length - 6) + '</span>' : '') +
      '</div>' +
    '</div>';
}

function renderDefaultHeadersBanner(tab) {
  var title = tr('webview.defaultHeaders');
  var manageLabel = tr('webview.manage');
  var tone = '';
  var summary = '';
  var detail = '';
  if (tab?.skipDefaultHeaders) {
    tone = ' warning';
    summary = tr('webview.defaultHeadersSkippedState');
    detail = '<div class="default-headers-banner-note">' + escapeHtml(tr('webview.defaultHeadersSkippedNote')) + '</div>';
  } else {
    var enabled = getEnabledDefaultHeaders();
    if (!enabled.length) {
      summary = tr('webview.defaultHeadersEmptyState');
      detail = '<div class="default-headers-banner-note">' + escapeHtml(tr('webview.defaultHeadersAppliedNote')) + '</div>';
    } else {
      var applied = getAppliedDefaultHeaders(tab);
      var overridden = getOverriddenDefaultHeaders(tab);
      tone = ' active';
      summary = tfCount('webview.defaultHeadersApplied', applied.length);
      detail = renderDefaultHeaderKeyGroup('webview.defaultHeadersAppliedLabel', applied, '') +
        renderDefaultHeaderKeyGroup('webview.defaultHeadersOverriddenLabel', overridden, ' override') +
        (overridden.length
          ? '<div class="default-headers-banner-note">' + escapeHtml(tfCount('webview.defaultHeadersOverridden', overridden.length)) + '</div>'
          : '');
    }
  }
  return '<div class="default-headers-banner' + tone + '" data-expanded="0">' +
    '<div class="default-headers-oneline">' +
      '<button type="button" class="default-headers-summary js-default-headers-toggle" aria-expanded="false" aria-label="' + escapeAttr(title + ' · ' + summary) + '">' +
        '<span class="default-headers-banner-title">' + escapeHtml(title) + '</span>' +
        '<span class="status-strip-sep" aria-hidden="true">·</span>' +
        '<span class="default-headers-banner-copy">' + escapeHtml(summary) + '</span>' +
      '</button>' +
      '<button class="ghost-btn js-open-default-headers" type="button">' + escapeHtml(manageLabel) + '</button>' +
    '</div>' +
    '<div class="default-headers-expand js-default-headers-expand hidden">' + detail + '</div>' +
  '</div>';
}

function countExecutableScripts(scripts) {
  var count = 0;
  if (scripts && (scripts.preRequest || '').trim()) count++;
  if (scripts && (scripts.test || '').trim()) count++;
  return count;
}

function renderTessraMark(extraClass) {
  // Activity Bar / Marketplace 아이콘과 동일 테서랙트 와이어프레임 (tiny mark only)
  return '<svg class="tessra-mark' + (extraClass ? ' ' + extraClass : '') + '" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M12 2.9 19.1 7v10L12 21.1 4.9 17V7L12 2.9Zm0 0v18.2M4.9 7l7.1 4.1L19.1 7M4.9 17l7.1-4.2 7.1 4.2M4.9 7l7.1 5.8L4.9 17M19.1 7 12 12.8l7.1 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';
}

function renderStatusStripCue(cue) {
  if (cue === 'on-dot') return '<span class="status-strip-cue" aria-hidden="true">●</span>';
  if (cue === 'on-check') return '<span class="status-strip-cue" aria-hidden="true">✓</span>';
  if (cue === 'warn') return '<span class="status-strip-cue" aria-hidden="true">⚠</span>';
  if (cue === 'off') return '<span class="status-strip-cue" aria-hidden="true">○</span>';
  return '';
}

function renderStatusStripLabelHtml(label, count) {
  if (count == null) return escapeHtml(label);
  var countStr = String(count);
  var idx = String(label).lastIndexOf(countStr);
  if (idx < 0) return escapeHtml(label);
  return escapeHtml(String(label).slice(0, idx)) +
    '<span class="status-strip-num">' + escapeHtml(countStr) + '</span>' +
    escapeHtml(String(label).slice(idx + countStr.length));
}

function isEnvironmentEditorOpen() {
  return !!(envEditor && !envEditor.classList.contains('hidden'));
}

function getStatusStripRoot() {
  return (typeof mainContent !== 'undefined' && mainContent)
    ? mainContent.querySelector('.js-status-strip')
    : null;
}

function isStatusStripExpanded() {
  return getStatusStripRoot()?.dataset?.expanded === '1';
}

function setStatusStripExpanded(open, options) {
  var opts = options || {};
  var host = (typeof mainContent !== 'undefined' && mainContent) ? mainContent : null;
  var strip = host?.querySelector('.js-status-strip');
  var panel = strip?.querySelector('.js-status-strip-panel');
  var toggle = strip?.querySelector('.js-status-strip-toggle');
  if (!strip || !panel || !toggle) return false;
  strip.dataset.expanded = open ? '1' : '0';
  panel.classList.toggle('hidden', !open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toggle.setAttribute('aria-label', open ? tr('webview.collapse') : tr('webview.expand'));
  toggle.setAttribute('title', open ? tr('webview.collapse') : tr('webview.expand'));
  // Used/Vars 세그먼트 aria-expanded 동기화
  host.querySelectorAll('.status-strip-seg[data-action="reveal-variable-usage"]').forEach(function(btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  if (open && opts.focusSelector) {
    var target = panel.querySelector(opts.focusSelector);
    if (target) {
      clearLinkedFocusInContent(host);
      if (typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch (_) {
          target.scrollIntoView();
        }
      }
      queueLinkedFocusReveal(function() {
        if (!target?.isConnected) return;
        target.classList.add('linked-focus-active');
        var focusable = target.querySelector('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') || target;
        focusLinkedTarget(focusable);
        linkedFocusTimer = setTimeout(function() {
          target.classList.remove('linked-focus-active');
          linkedFocusTimer = null;
        }, 2200);
      });
    }
  }
  return true;
}

function revealVariableUsageDisclosure() {
  var host = (typeof mainContent !== 'undefined' && mainContent) ? mainContent : null;
  var focusSel = host?.querySelector('.js-status-strip-unresolved')
    ? '.js-status-strip-unresolved'
    : '.js-status-strip-var-usage';
  setStatusStripExpanded(true, { focusSelector: focusSel });
}

function renderStatusStripSegment(label, tone, action, meta, tooltip, options) {
  options = options || {};
  var cue = options.cue || '';
  var priority = options.priority || 'medium';
  var classes = 'status-strip-seg' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '');
  var testId = '';
  if (action === 'edit-environment' || action === 'switch-environment') {
    testId = 'status-environment';
  } else if (action === 'reveal-variable-usage') {
    testId = 'status-variable-usage';
  }
  var attrs = action
    ? ' type="button" data-action="' + escapeAttr(action) + '"' + (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '')
    : '';
  if (testId) {
    attrs += ' data-testid="' + escapeAttr(testId) + '"';
  }
  if (options.ariaExpanded != null) {
    attrs += ' aria-expanded="' + (options.ariaExpanded ? 'true' : 'false') + '"';
  }
  if (options.ariaControls) {
    attrs += ' aria-controls="' + escapeAttr(options.ariaControls) + '"';
  }
  var titleAttr = tooltip ? ' title="' + escapeAttr(tooltip) + '"' : '';
  var priorityAttr = ' data-priority="' + escapeAttr(priority) + '"';
  var tag = action ? 'button' : 'span';
  var labelInner = options.labelHtml != null
    ? options.labelHtml
    : renderStatusStripLabelHtml(label, options.count);
  return '<' + tag + ' class="' + classes + '"' + attrs + priorityAttr + titleAttr + '>' +
    (options.mark ? renderTessraMark('tessra-mark--strip') : '') +
    renderStatusStripCue(cue) +
    '<span class="status-strip-label">' + labelInner + '</span>' +
  '</' + tag + '>';
}

function buildStatusStripSegments(tab) {
  var segments = [];

  // 1) Environment — always first; shows active env variable count (not request usage)
  var envLabel = currentEnvName || tr('webview.noEnvironment');
  var envTip = currentEnvName
    ? tf('webview.summaryEnvironment', { name: currentEnvName }) + ' · ' + tfCount('environment.vars', envEditorVariableCount)
    : tr('webview.noEnvironment');
  var envLabelHtml = escapeHtml(envLabel);
  if (currentEnvName) {
    envLabelHtml += '<span class="status-strip-env-count"> ' +
      renderStatusStripLabelHtml(tfCount('environment.vars', envEditorVariableCount), envEditorVariableCount) +
      '</span>';
  }
  segments.push(renderStatusStripSegment(
    envLabel,
    currentEnvName ? 'is-env' : 'is-warn',
    currentEnvName ? 'edit-environment' : 'switch-environment',
    null,
    envTip,
    {
      cue: currentEnvName ? '' : 'warn',
      priority: 'critical',
      mark: true,
      labelHtml: envLabelHtml,
      ariaExpanded: currentEnvName ? isEnvironmentEditorOpen() : undefined,
      ariaControls: currentEnvName ? 'envEditor' : undefined
    }
  ));

  // 2) Scripts — glanceable when present; warn when disabled/untrusted
  var hasScripts = hasExecutableScripts(tab?.scripts);
  var scriptsOff = !!(tab?.disableScripts || (hasScripts && tab?.scriptsTrusted === false));
  var scriptCount = countExecutableScripts(tab?.scripts);
  if (scriptsOff) {
    var scriptsOffMeta = tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request';
    segments.push(renderStatusStripSegment(
      tr('webview.disableScriptsStatus'),
      'is-warn',
      'switch-tab',
      scriptsOffMeta,
      tr('webview.disableScriptsStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  } else if (hasScripts) {
    var scriptsLabel = scriptCount > 1
      ? tfCount('webview.stripScriptsCount', scriptCount)
      : tr('webview.scriptsPresentStatus');
    segments.push(renderStatusStripSegment(
      scriptsLabel,
      'is-on',
      'switch-tab',
      'scripts:pre-request',
      tr('webview.summaryScriptsOn'),
      { cue: 'on-dot', priority: 'high' }
    ));
  }

  // 3) History — always visible; on/off must be distinguishable at a glance
  var historyOn = tab?.saveToHistory !== false;
  segments.push(renderStatusStripSegment(
    tr(historyOn ? 'webview.saveToHistoryOnStatus' : 'webview.saveToHistoryOffStatus'),
    historyOn ? 'is-on' : 'is-off',
    'switch-tab',
    'settings:save-history',
    tr(historyOn ? 'webview.summaryHistoryOn' : 'webview.summaryHistoryOff'),
    { cue: historyOn ? 'on-check' : 'off', priority: 'high' }
  ));

  // 4) Defaults — applied count or skipped warning only
  if (tab?.skipDefaultHeaders) {
    segments.push(renderStatusStripSegment(
      tr('webview.skipDefaultHeadersStatus'),
      'is-warn',
      'switch-tab',
      'settings:skip-default-headers',
      tr('webview.skipDefaultHeadersStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  } else {
    var appliedDefaultHeaders = getAppliedDefaultHeaders(tab);
    if (appliedDefaultHeaders.length > 0) {
      segments.push(renderStatusStripSegment(
        tfCount('webview.stripDefaultsCount', appliedDefaultHeaders.length),
        'is-info',
        'open-default-headers',
        null,
        tr('webview.defaultHeaders'),
        { priority: 'medium', count: appliedDefaultHeaders.length }
      ));
    }
  }

  // 5) Risk / non-default execution overrides
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    segments.push(renderStatusStripSegment(
      tr('webview.tlsInsecureStatus'),
      'is-warn',
      'switch-tab',
      'settings:tls-validation',
      tr('webview.tlsInsecureStatus'),
      { cue: 'warn', priority: 'critical' }
    ));
  }
  if (tab?.followRedirects) {
    segments.push(renderStatusStripSegment(
      tr('webview.followRedirectsStatus'),
      'is-info',
      'switch-tab',
      'settings:follow-redirects',
      tr('webview.followRedirectsStatus'),
      { priority: 'medium' }
    ));
  }
  if (tab?.stopAfterHeaders) {
    segments.push(renderStatusStripSegment(
      tr('webview.stopAfterHeadersStatus'),
      'is-warn',
      'switch-tab',
      'settings:stop-after-headers',
      tr('webview.stopAfterHeadersStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  }

  // 6) Request variable usage — distinct from active env's defined var count.
  // Click opens strip disclosure with the same {{var}} + scope list 1.0.9 showed (not a permanent card).
  var usage = collectVariableUsage(tab);
  var unresolved = getUnresolvedDraftVariableNames(tab);
  if (unresolved.length > 0) {
    segments.push(renderStatusStripSegment(
      tfCount('webview.stripVarsCount', unresolved.length),
      'is-warn',
      'reveal-variable-usage',
      null,
      unresolved.map(function(n) { return '{{' + n + '}}'; }).join(', '),
      {
        cue: 'warn',
        priority: 'high',
        count: unresolved.length,
        ariaExpanded: isStatusStripExpanded(),
        ariaControls: 'statusStripVariableUsage'
      }
    ));
  } else if (usage.length > 0) {
    segments.push(renderStatusStripSegment(
      tfCount('webview.stripUsedCount', usage.length),
      'is-info',
      'reveal-variable-usage',
      null,
      usage.map(function(u) { return '{{' + u.name + '}}'; }).join(', '),
      {
        priority: 'low',
        count: usage.length,
        ariaExpanded: isStatusStripExpanded(),
        ariaControls: 'statusStripVariableUsage'
      }
    ));
  }

  // Profile stays in expand disclosure only — not on the always-visible line.
  return segments;
}

function renderStatusStripExpandDetails(tab) {
  var usage = collectVariableUsage(tab);
  var unresolved = getUnresolvedDraftVariableNames(tab);
  var applied = getAppliedDefaultHeaders(tab);
  var parts = [];
  parts.push('<div class="status-strip-detail-block">' +
    '<button type="button" class="status-strip-link" data-action="switch-environment">' + escapeHtml(currentEnvName ? tf('webview.summaryEnvironment', { name: currentEnvName }) : tr('webview.noEnvironment')) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="edit-environment">' + escapeHtml(tr('webview.editEnvironmentVariables')) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="change-workspace-profile" title="' + escapeAttr(tr(currentWorkspaceProfile === 'default' ? 'webview.profileDefaultTooltip' : 'webview.profileCustomTooltip')) + '">' + escapeHtml(renderProfileIndicator(currentWorkspaceProfile)) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="open-default-headers">' + escapeHtml(tr('webview.defaultHeaders')) + '</button>' +
  '</div>');
  if (unresolved.length > 0) {
    parts.push('<div class="status-strip-detail-block warning js-status-strip-unresolved">' +
      '<div class="status-strip-detail-title">' + escapeHtml(tfCount('webview.unresolvedVariablesCount', unresolved.length)) + '</div>' +
      '<div class="status-strip-detail-copy">' + escapeHtml(unresolved.map(function(name) { return '{{' + name + '}}'; }).join(', ')) + '</div>' +
      '<button type="button" class="status-strip-link" data-action="edit-environment">' + escapeHtml(tr('webview.editEnvironmentVariables')) + '</button>' +
      '<button type="button" class="status-strip-link" data-action="switch-environment">' + escapeHtml(tr('webview.openEnvironmentPicker')) + '</button>' +
    '</div>');
  }
  // Visible variable-usage list lives in strip disclosure (Quiet Instrument); keep js-variable-usage-wrap for refresh.
  if (usage.length > 0 || unresolved.length > 0) {
    parts.push('<div class="status-strip-detail-block js-status-strip-var-usage" id="statusStripVariableUsage" data-testid="variable-usage-disclosure">' +
      '<div class="js-variable-usage-wrap">' + renderVariableUsage(tab) + '</div>' +
    '</div>');
  }
  if (applied.length > 0 && !tab?.skipDefaultHeaders) {
    parts.push('<div class="status-strip-detail-block">' +
      '<div class="status-strip-detail-title">' + escapeHtml(tfCount('webview.defaultHeadersApplied', applied.length)) + '</div>' +
      '<div class="status-strip-detail-copy">' + escapeHtml(applied.map(function(h) { return h.key; }).join(', ')) + '</div>' +
    '</div>');
  }
  var warnings = [];
  var expandHasScripts = hasExecutableScripts(tab?.scripts);
  var expandScriptsOff = !!(tab?.disableScripts || (expandHasScripts && tab?.scriptsTrusted === false));
  if (expandScriptsOff) {
    warnings.push({
      label: tr('webview.disableScriptsStatus'),
      action: 'switch-tab',
      meta: tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request'
    });
  } else if (expandHasScripts) {
    warnings.push({ label: tr('webview.scriptsPresentStatus'), action: 'switch-tab', meta: 'scripts:pre-request' });
  }
  if (tab?.followRedirects) warnings.push({ label: tr('webview.followRedirectsStatus'), action: 'switch-tab', meta: 'settings:follow-redirects' });
  if (tab?.stopAfterHeaders) warnings.push({ label: tr('webview.stopAfterHeadersStatus'), action: 'switch-tab', meta: 'settings:stop-after-headers' });
  if (tab?.saveToHistory === false) warnings.push({ label: tr('webview.saveToHistoryOffStatus'), action: 'switch-tab', meta: 'settings:save-history' });
  if (tab?.skipDefaultHeaders) warnings.push({ label: tr('webview.skipDefaultHeadersStatus'), action: 'switch-tab', meta: 'settings:skip-default-headers' });
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    warnings.push({ label: tr('webview.tlsInsecureStatus'), action: 'switch-tab', meta: 'settings:tls-validation' });
  }
  if (warnings.length) {
    parts.push('<div class="status-strip-detail-block">' + warnings.map(function(w) {
      return '<button type="button" class="status-strip-link" data-action="' + escapeAttr(w.action) + '" data-meta="' + escapeAttr(w.meta) + '">' + escapeHtml(w.label) + '</button>';
    }).join('') + '</div>');
  }
  // linked-focus 호환용 숨김 칩/프리플라이트 훅 유지 (변수 사용처는 위 disclosure에 노출)
  parts.push('<div class="request-status-chips js-topline-status-chips visually-hidden" aria-hidden="true">' + renderLegacyStatusChipHooks(tab) + '</div>');
  parts.push('<div class="js-request-preflight-wrap visually-hidden" aria-hidden="true">' + renderRequestPreflight(tab) + '</div>');
  return parts.join('');
}

function renderLegacyStatusChipHooks(tab) {
  var chips = [];
  chips.push(renderStatusChip(
    renderProfileIndicator(currentWorkspaceProfile),
    currentWorkspaceProfile === 'default' ? 'muted' : 'info',
    'change-workspace-profile',
    null,
    tr(currentWorkspaceProfile === 'default' ? 'webview.profileDefaultTooltip' : 'webview.profileCustomTooltip')
  ));
  if (currentEnvName) {
    chips.push(renderEnvironmentStatusChip(currentEnvName));
  } else {
    chips.push(renderStatusChip(tr('webview.noEnvironment'), 'muted', 'switch-environment'));
  }
  if (tab?.skipDefaultHeaders) {
    chips.push(renderStatusChip(tr('webview.skipDefaultHeadersStatus'), 'warning', 'switch-tab', 'settings:skip-default-headers'));
  } else {
    var appliedDefaultHeaders = getAppliedDefaultHeaders(tab);
    if (appliedDefaultHeaders.length > 0) {
      chips.push(renderStatusChip(tfCount('webview.defaultHeadersStatus', appliedDefaultHeaders.length), 'info', 'open-default-headers'));
    }
  }
  var chipHasScripts = hasExecutableScripts(tab?.scripts);
  var chipScriptsOff = !!(tab?.disableScripts || (chipHasScripts && tab?.scriptsTrusted === false));
  if (chipScriptsOff) {
    chips.push(renderStatusChip(
      tr('webview.disableScriptsStatus'),
      'warning',
      'switch-tab',
      tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request'
    ));
  } else if (chipHasScripts) {
    chips.push(renderStatusChip(tr('webview.scriptsPresentStatus'), 'muted', 'switch-tab', 'scripts:pre-request'));
  }
  if (tab?.followRedirects) chips.push(renderStatusChip(tr('webview.followRedirectsStatus'), 'info', 'switch-tab', 'settings:follow-redirects'));
  if (tab?.stopAfterHeaders) chips.push(renderStatusChip(tr('webview.stopAfterHeadersStatus'), 'warning', 'switch-tab', 'settings:stop-after-headers'));
  if (tab?.saveToHistory === false) chips.push(renderStatusChip(tr('webview.saveToHistoryOffStatus'), 'muted', 'switch-tab', 'settings:save-history'));
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    chips.push(renderStatusChip(tr('webview.tlsInsecureStatus'), 'warning', 'switch-tab', 'settings:tls-validation'));
  }
  return chips.join('');
}

function renderStatusStrip(tab) {
  var segments = buildStatusStripSegments(tab);
  var sep = '<span class="status-strip-sep" aria-hidden="true">│</span>';
  return '<div class="status-strip js-status-strip" data-expanded="0">' +
    '<div class="status-strip-line">' +
      '<div class="status-strip-segments">' + segments.join(sep) + '</div>' +
      '<button type="button" class="status-strip-toggle js-status-strip-toggle" aria-expanded="false" aria-label="' + escapeAttr(tr('webview.expand')) + '" title="' + escapeAttr(tr('webview.expand')) + '">▾</button>' +
    '</div>' +
    '<div class="status-strip-panel js-status-strip-panel hidden">' + renderStatusStripExpandDetails(tab) + '</div>' +
  '</div>';
}

function renderToplineStatusChips(tab) {
  return renderLegacyStatusChipHooks(tab);
}

function refreshToplineStatusChips(mc) {
  refreshStatusStrip(mc);
}

function refreshStatusStrip(mc) {
  var wrap = mc?.querySelector('.js-status-strip-host');
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!wrap || !tab) return;
  var draftTab = buildDraftTabFromContent(mc);
  var wasExpanded = isStatusStripExpanded();
  wrap.innerHTML = renderStatusStrip(draftTab);
  if (wasExpanded) {
    setStatusStripExpanded(true);
  }
  syncEnvironmentStripDisclosureState();
}

function refreshRequestPreflight(mc) {
  var wrap = mc?.querySelector('.js-request-preflight-wrap');
  if (!wrap) return;
  var draftTab = buildDraftTabFromContent(mc);
  wrap.innerHTML = renderRequestPreflight(draftTab);
}

function refreshDefaultHeadersBanner(mc) {
  var wrap = mc?.querySelector('.js-default-headers-banner-wrap');
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!wrap || !tab) return;

  var draftHeaders = collectKv(mc.querySelector('.js-header-rows'));
  var skipDefaultHeadersInput = mc.querySelector('.js-skip-default-headers');
  var draftTab = Object.assign({}, tab, {
    headers: draftHeaders,
    skipDefaultHeaders: skipDefaultHeadersInput ? skipDefaultHeadersInput.checked === true : !!tab.skipDefaultHeaders
  });

  wrap.innerHTML = renderDefaultHeadersBanner(draftTab);
  refreshToplineStatusChips(mc);
}


function renderWebSocketResponse(tab) {
  var status = tab.websocketStatus || 'closed';
  var messages = tab.websocketMessages || [];
  var statusLabel = websocketStatusLabel(status);
  var actionHtml = (status === 'open' || status === 'connecting')
    ? '<button class="res-action-btn ripple-btn js-ws-disconnect" type="button">' + escapeHtml(tr('webview.disconnect')) + '</button>'
    : '';
  var messagesHtml = messages.length === 0
    ? '<div class="ws-empty">' + escapeHtml(tr('webview.websocketNoMessages')) + '</div>'
    : messages.map(function(item) {
        var messageType = item.messageType || 'text';
        var direction = messageType === 'system' ? 'SYS' : (item.direction === 'out' ? 'OUT' : 'IN');
        var directionClass = messageType === 'system' ? 'system' : (item.direction === 'out' ? 'out' : 'in');
        var payload = messageType === 'binary'
          ? tf('webview.websocketBinaryMessage', { size: String(item.size || 0) }) + '\\n' + (item.data || '')
          : (item.data || '');
        var sizeLabel = typeof item.size === 'number' ? ' · ' + formatSize(item.size) : '';
        return '<div class="ws-message ' + directionClass + '">' +
          '<div class="ws-message-meta">' +
            '<span class="ws-direction">' + escapeHtml(direction) + '</span>' +
            '<span class="ws-time">' + escapeHtml(formatLocalTime(item.timestamp || Date.now()) + sizeLabel) + '</span>' +
          '</div>' +
          '<div class="ws-payload">' + escapeHtml(payload) + '</div>' +
        '</div>';
      }).join('');
  return '<div class="ws-console">' +
    '<div class="ws-summary ws-status-' + escapeAttr(status) + '">' +
      '<div class="ws-summary-main">' +
        '<span class="ws-status-dot"></span>' +
        '<span class="method-badge method-WS">WS</span>' +
        '<span class="ws-status-label">' + escapeHtml(statusLabel) + '</span>' +
      '</div>' +
      '<div class="ws-summary-note">' + escapeHtml(tr('webview.websocketComposer')) + '</div>' +
      actionHtml +
    '</div>' +
    (tab.error && status === 'error' ? '<div class="error-msg">' + escapeHtml(tab.error) + '</div>' : '') +
    '<div class="ws-log">' + messagesHtml + '</div>' +
  '</div>';
}

function renderContent() {
  closeActiveFormatMenu();
  releaseSplitDrag();
  hideVariableAutocomplete();
  hideVariablePreviewPopover();
  if (!activeTabId || tabs.length === 0) {
    mainContent.innerHTML = renderEmptyState(
      tr('webview.empty.hero.title'),
      tr('webview.empty.hero.copy'),
      [
        { label: tr('webview.emptyActionNewRequest'), action: 'new-tab' },
        { label: tr('webview.emptyActionSample'), action: 'sample-request' },
        { label: tr('webview.emptyActionGuide'), action: 'open-guide' }
      ]
    );
    return;
  }
  
  var prevReqArea = mainContent.querySelector('.req-area');
  var savedHeight = prevReqArea && prevReqArea.dataset.manualHeight ? prevReqArea.style.height : null;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  syncRequestTypeFromUrl(tab);
  const isWs = isWebSocketTab(tab);

  const stage = getRequestStageInfo(tab);
  const activeRequestEditorTab = normalizeRequestEditorTab(tab.requestEditorTab);
  const requestEditorExpanded = tab.requestEditorExpanded !== false;
  const isParamsTab = activeRequestEditorTab === 'params';
  const isHeadersTab = activeRequestEditorTab === 'headers';
  const isBodyTab = activeRequestEditorTab === 'body';
  const isAuthTab = activeRequestEditorTab === 'auth';
  const isScriptsTab = activeRequestEditorTab === 'scripts';
  const isSettingsTab = activeRequestEditorTab === 'settings';
  const showParamsEditor = requestEditorExpanded && isParamsTab;
  const showHeadersEditor = requestEditorExpanded && isHeadersTab;
  const showBodyEditor = requestEditorExpanded && isBodyTab;
  const showAuthEditor = requestEditorExpanded && isAuthTab;
  const showScriptsEditor = requestEditorExpanded && isScriptsTab;
  const showSettingsEditor = requestEditorExpanded && isSettingsTab;
  const envLine = '<div class="js-status-strip-host">' + renderStatusStrip(tab) + '</div>';
  const requestInfoRowHtml = '';

  let resHtml = '';
  if (isWs) {
    resHtml = renderWebSocketResponse(tab);
  } else {
    resHtml = buildHttpResponseAreaHtml(tab);
  }

  mainContent.innerHTML = envLine +
    '<div class="url-bar">' +
      '<div class="url-primary-group">' +
          '<select class="js-method" data-testid="request-method">' +
          ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m =>
            '<option' + (m === tab.method ? ' selected' : '') + '>' + m + '</option>'
          ).join('') +
        '</select>' +
        '<div class="url-input-wrap">' +
          '<input class="js-url" data-testid="request-url" type="text" placeholder="' + escapeAttr(tr('webview.urlPlaceholder')) + '" spellcheck="false" value="' + escapeAttr(tab.url) + '"/>' +
          '<div class="var-overlay js-var-overlay hidden"></div>' +
        '</div>' +
      '</div>' +
      '<div class="url-hero-actions">' + renderPrimaryActionButton(tab) + '</div>' +
      '<div class="url-overflow-wrap actions-more-wrap">' +
        '<button class="res-action-btn js-request-more-btn" type="button" title="' + escapeAttr(tr('webview.more') || 'More') + '" aria-label="' + escapeAttr(tr('webview.more') || 'More') + '" aria-haspopup="menu" aria-expanded="false" aria-controls="requestActionsMoreMenu"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg></button>' +
        '<div class="actions-more-menu js-request-more-menu" id="requestActionsMoreMenu" role="menu">' +
          '<button class="res-action-btn js-save" type="button" role="menuitem" title="' + escapeAttr(tr('webview.save')) + '"><span class="action-label">' + escapeHtml(tr('webview.save')) + '</span></button>' +
          (tab.requestId ? '<button class="res-action-btn js-save-as" type="button" role="menuitem" title="' + escapeAttr(tr('webview.saveAs')) + '"><span class="action-label">' + escapeHtml(tr('webview.saveAs')) + '</span></button>' : '') +
          '<button class="res-action-btn js-copy-curl" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyAsCurl')) + '"><span class="action-label">cURL</span></button>' +
          '<button class="res-action-btn js-generate-code" type="button" role="menuitem" title="' + escapeAttr(tr('webview.generateCode')) + '"><span class="action-label">' + escapeHtml(tr('webview.code')) + '</span></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    requestInfoRowHtml +
    '<div class="split">' +
      '<div class="req-area">' +
        '<div class="tabs js-req-tabs" role="tablist">' +
          '<div class="tab' + (isParamsTab ? ' active' : '') + (isParamsTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="params" role="tab" tabindex="0" aria-selected="' + (isParamsTab ? 'true' : 'false') + '" aria-expanded="' + (showParamsEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.params')) + '</div>' +
          '<div class="tab' + (isHeadersTab ? ' active' : '') + (isHeadersTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="headers" role="tab" tabindex="0" aria-selected="' + (isHeadersTab ? 'true' : 'false') + '" aria-expanded="' + (showHeadersEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.headers')) + '</div>' +
          '<div class="tab' + (isBodyTab ? ' active' : '') + (isBodyTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="body" role="tab" tabindex="0" aria-selected="' + (isBodyTab ? 'true' : 'false') + '" aria-expanded="' + (showBodyEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.body')) + '</div>' +
          '<div class="tab' + (isAuthTab ? ' active' : '') + (isAuthTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="auth" role="tab" tabindex="0" aria-selected="' + (isAuthTab ? 'true' : 'false') + '" aria-expanded="' + (showAuthEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.auth')) + '</div>' +
          '<div class="tab' + (isScriptsTab ? ' active' : '') + (isScriptsTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="scripts" role="tab" tabindex="0" aria-selected="' + (isScriptsTab ? 'true' : 'false') + '" aria-expanded="' + (showScriptsEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.scripts')) + '</div>' +
          '<div class="tab' + (isSettingsTab ? ' active' : '') + (isSettingsTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="settings" role="tab" tabindex="0" aria-selected="' + (isSettingsTab ? 'true' : 'false') + '" aria-expanded="' + (showSettingsEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.settings')) + '</div>' +
        '</div>' +
        '<div class="js-params-panel request-editor-panel kv-section' + (showParamsEditor ? '' : ' hidden') + '">' +
          '<div class="js-param-rows" data-testid="request-params">' + kvRowsHtml(tab.params) + '</div>' +
          '<div class="kv-actions">' +
            '<button class="add-btn js-add-param">' + escapeHtml(tr('webview.addParam')) + '</button>' +
            '<button class="ghost-btn ripple-btn js-open-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.bulkPaste')) + '</button>' +
          '</div>' +
          '<div class="bulk-editor hidden js-bulk-editor" data-target="params">' +
            '<div class="bulk-editor-label">' + escapeHtml(tr('webview.bulkPasteParams')) + '</div>' +
            '<textarea class="bulk-editor-input js-bulk-editor-input" spellcheck="false" placeholder="' + escapeAttr(tr('webview.bulkPasteParamsPlaceholder')) + '"></textarea>' +
            '<div class="bulk-editor-actions">' +
              '<button class="ghost-btn ripple-btn js-apply-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.apply')) + '</button>' +
              '<button class="ghost-btn ripple-btn js-cancel-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.cancel')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-headers-panel request-editor-panel kv-section' + (showHeadersEditor ? '' : ' hidden') + '">' +
          '<div class="js-default-headers-banner-wrap">' + renderDefaultHeadersBanner(tab) + '</div>' +
          '<div class="js-header-rows" data-testid="request-headers">' + kvRowsHtml(tab.headers) + '</div>' +
          '<div class="kv-actions">' +
            '<button class="add-btn js-add-header">' + escapeHtml(tr('webview.addHeader')) + '</button>' +
            '<button class="ghost-btn ripple-btn js-open-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.bulkPaste')) + '</button>' +
          '</div>' +
          '<div class="bulk-editor hidden js-bulk-editor" data-target="headers">' +
            '<div class="bulk-editor-label">' + escapeHtml(tr('webview.bulkPasteHeaders')) + '</div>' +
            '<textarea class="bulk-editor-input js-bulk-editor-input" spellcheck="false" placeholder="' + escapeAttr(tr('webview.bulkPasteHeadersPlaceholder')) + '"></textarea>' +
            '<div class="bulk-editor-actions">' +
              '<button class="ghost-btn ripple-btn js-apply-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.apply')) + '</button>' +
              '<button class="ghost-btn ripple-btn js-cancel-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.cancel')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-body-panel request-editor-panel body-section' + (showBodyEditor ? '' : ' hidden') + '">' +
          '<select class="js-body-type body-type-select" data-testid="body-type">' +
            ['none','json','xml','form','formdata','binary','raw'].map(function(t) {
              var label = bodyTypeLabel(t);
              return '<option value="' + t + '"' + (t === tab.bodyType ? ' selected' : '') + '>' + label + '</option>';
            }).join('') +
          '</select>' +
          '<div class="body-editor js-body-editor' + (shouldEnableBodySyntaxHighlight(tab.bodyType, isWs) ? ' is-syntax-highlight' : '') + '"' + (!isWs && (tab.bodyType === 'none' || tab.bodyType === 'formdata' || tab.bodyType === 'binary') ? ' style="display:none"' : '') + '>' +
            '<pre class="body-highlight js-body-highlight" aria-hidden="true"><code class="hljs js-body-highlight-code"></code></pre>' +
            '<textarea class="js-body" data-testid="request-body-editor" spellcheck="false" placeholder="' + escapeAttr(isWs ? tr('webview.websocketMessagePlaceholder') : tr('webview.bodyPlaceholder')) + '">' + escapeHtml(tab.body) + '</textarea>' +
          '</div>' +
          '<div class="js-formdata-panel' + (tab.bodyType === 'formdata' ? '' : ' hidden') + '">' +
            '<div class="formdata-summary js-formdata-summary">' + renderFormDataSummary(tab.formData || []) + '</div>' +
            '<div class="js-formdata-rows">' + formDataRowsHtml(tab.formData || []) + '</div>' +
            '<button class="add-btn js-add-formdata-text">' + escapeHtml(tr('webview.addField')) + '</button>' +
            '<button class="add-btn js-add-formdata-file">' + escapeHtml(tr('webview.addFile')) + '</button>' +
          '</div>' +
          '<div class="js-binary-panel' + (tab.bodyType === 'binary' ? '' : ' hidden') + '">' +
            '<div class="kv-row" style="margin-top:4px">' +
              '<input class="js-binary-path" type="text" placeholder="' + escapeAttr(tr('webview.filePath')) + '" value="' + escapeAttr(tab.binaryFilePath || '') + '"/>' +
              '<button class="btn btn-s js-browse-binary" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-auth-panel request-editor-panel auth-section' + (showAuthEditor ? '' : ' hidden') + '">' +
          authHtml(tab.auth) +
        '</div>' +
        '<div class="js-scripts-panel request-editor-panel body-section' + (showScriptsEditor ? '' : ' hidden') + '">' +
          renderScriptHelpers(tab) +
          '<div class="script-editor-grid">' +
            '<div class="script-card">' +
              '<div class="script-card-label">' + escapeHtml(tr('webview.preRequestScript')) + '</div>' +
              '<div class="script-card-note">' + escapeHtml(tr('webview.preRequestNote')) + '</div>' +
              '<div class="script-card-actions">' +
                '<button class="ghost-btn ripple-btn js-insert-script-template" type="button" data-target="preRequest" data-template="preRequestEnv">' + escapeHtml(tr('webview.scriptHelpInsertPreRequest')) + '</button>' +
              '</div>' +
              '<textarea class="js-script-prerequest" data-testid="script-prerequest" placeholder="' + escapeAttr(tr('webview.preRequestPlaceholder')) + '">' + escapeHtml(tab.scripts?.preRequest || '') + '</textarea>' +
            '</div>' +
            '<div class="script-card">' +
              '<div class="script-card-label">' + escapeHtml(tr('webview.testScript')) + '</div>' +
              '<div class="script-card-note">' + escapeHtml(tr('webview.testNote')) + '</div>' +
              '<div class="script-card-actions">' +
                '<button class="ghost-btn ripple-btn js-insert-script-template" type="button" data-target="test" data-template="testCaptureValue">' + escapeHtml(tr('webview.scriptHelpInsertCapture')) + '</button>' +
                '<button class="ghost-btn ripple-btn js-insert-script-template" type="button" data-target="test" data-template="testStatusCheck">' + escapeHtml(tr('webview.scriptHelpInsertStatus')) + '</button>' +
              '</div>' +
              '<textarea class="js-script-test" data-testid="script-test" placeholder="' + escapeAttr(tr('webview.testPlaceholder')) + '">' + escapeHtml(tab.scripts?.test || '') + '</textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-settings-panel request-editor-panel settings-section' + (showSettingsEditor ? '' : ' hidden') + '">' +
          '<div class="settings-grid">' +
            '<div class="settings-card">' +
              '<div class="settings-group">' +
                '<div class="settings-group-title">' + escapeHtml(tr('webview.transport')) + '</div>' +
                '<div class="settings-group-note">' + escapeHtml(tr('webview.transportNote')) + '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.timeout')) + '</label>' +
                  '<input class="js-timeout settings-input" type="number" min="0" placeholder="0" title="' + escapeAttr(tr('webview.unlimited')) + '" value="' + (tab.timeout || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.unlimited')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.maxSize')) + '</label>' +
                  '<input class="js-max-response-size settings-input" type="number" min="0" placeholder="' + DEFAULT_MAX_RESPONSE_SIZE_KB + '" title="' + escapeAttr(tr('webview.maxSizeDefault')) + '" value="' + (tab.maxResponseSizeKb || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.maxSizeDefault')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.retryCount')) + '</label>' +
                  '<input class="js-retry-count settings-input" type="number" min="0" placeholder="0" value="' + (tab.retryCount || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.off')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.retryDelay')) + '</label>' +
                  '<input class="js-retry-delay settings-input" type="number" min="0" placeholder="0" value="' + (tab.retryDelayMs || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.retryDelayUnit')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row' + (tab.tlsValidation === 'insecure' ? ' risk-warning' : '') + '">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.tls')) + '</label>' +
                  '<select class="js-tls-validation settings-input settings-select">' +
                    '<option value="default"' + (tab.tlsValidation !== 'strict' && tab.tlsValidation !== 'insecure' ? ' selected' : '') + '>' + escapeHtml(tr('webview.default')) + '</option>' +
                    '<option value="strict"' + (tab.tlsValidation === 'strict' ? ' selected' : '') + '>' + escapeHtml(tr('webview.strict')) + '</option>' +
                    '<option value="insecure"' + (tab.tlsValidation === 'insecure' ? ' selected' : '') + '>' + escapeHtml(tr('webview.insecure')) + '</option>' +
                  '</select>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.perRequestOverride')) + '</span></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="settings-card">' +
              '<div class="settings-group">' +
                '<div class="settings-group-title">' + escapeHtml(tr('webview.behavior')) + '</div>' +
                '<div class="settings-group-note">' + escapeHtml(tr('webview.behaviorNote')) + '</div>' +
                '<div class="settings-toggle-grid">' +
                  '<label class="settings-toggle"><input class="js-follow-redirects" type="checkbox"' + (tab.followRedirects ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.followRedirects')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.followRedirects.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.stopAfterHeaders ? ' risk-muted' : '') + '"><input class="js-stop-after-headers" type="checkbox"' + (tab.stopAfterHeaders ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.stopAfterHeaders')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.stopAfterHeaders.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.saveToHistory === false ? ' risk-muted' : '' ) + '"><input class="js-save-history" type="checkbox"' + (tab.saveToHistory !== false ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.saveToHistory')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.saveToHistory.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.skipDefaultHeaders ? ' risk-warning' : '' ) + '"><input class="js-skip-default-headers" type="checkbox"' + (tab.skipDefaultHeaders ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.skipDefaultHeaders')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.skipDefaultHeaders.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.disableScripts ? ' risk-warning' : '' ) + '"><input class="js-disable-scripts" type="checkbox"' + (tab.disableScripts ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.disableScripts')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.disableScripts.note')) + '</span></span></label>' +
                '</div>' +
              '</div>' +
            '</div>' +
            (isWs ?
              '<div class="settings-card">' +
                '<div class="settings-group">' +
                  '<div class="settings-group-title">' + escapeHtml(tr('webview.websocket')) + '</div>' +
                  '<div class="settings-group-note">' + escapeHtml(tr('webview.webSocketKeepAlive.note')) + '</div>' +
                  '<div class="settings-toggle-grid">' +
                    '<label class="settings-toggle"><input class="js-ws-keepalive-enabled" type="checkbox"' + (tab.webSocketKeepAliveEnabled ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.webSocketKeepAlive')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.webSocketKeepAlive.note')) + '</span></span></label>' +
                  '</div>' +
                  '<div class="settings-row">' +
                    '<label class="settings-label">' + escapeHtml(tr('webview.webSocketKeepAliveInterval')) + '</label>' +
                    '<input class="js-ws-keepalive-interval settings-input" type="number" min="' + MIN_WS_KEEPALIVE_INTERVAL_SECONDS + '" max="' + MAX_WS_KEEPALIVE_INTERVAL_SECONDS + '" placeholder="' + escapeAttr(String(DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS)) + '" value="' + escapeAttr(String(normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds))) + '"/>' +
                    '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.webSocketKeepAliveIntervalUnit')) + '</span></div>' +
                  '</div>' +
                  '<div class="settings-row">' +
                    '<label class="settings-label">' + escapeHtml(tr('webview.webSocketKeepAliveMessage')) + '</label>' +
                    '<input class="js-ws-keepalive-message settings-input settings-text-input" type="text" placeholder="' + escapeAttr(DEFAULT_WS_KEEPALIVE_MESSAGE) + '" value="' + escapeAttr(normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage)) + '"/>' +
                  '</div>' +
                '</div>' +
              '</div>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="divider"><div class="divider-grip"><span></span><span></span><span></span></div></div>' +
      '<div class="bullet-progress js-bullet-progress' + (tab.loading || (isWs && tab.websocketStatus === 'connecting') ? ' active' : '') + '"><div class="bullet-glow"></div></div>' +
      '<div class="res-area' + (tab.response && tab.slideIn ? ' slide-in' : '') + '">' + resHtml + '</div>' +
    '</div>';

  
  bindContentEvents();

  var previewFrame = mainContent.querySelector('.js-res-preview');
  if (previewFrame) {
    syncPreviewFrame(previewFrame, tab);
  }

  
  if (savedHeight && !isRequestEditorCollapsed(tab)) {
    var newReqArea = mainContent.querySelector('.req-area');
    if (newReqArea) {
      applyManualRequestAreaHeight(
        newReqArea,
        mainContent.querySelector('.split'),
        mainContent.querySelector('.divider'),
        mainContent.querySelector('.bullet-progress'),
        savedHeight,
        tab,
        false
      );
    }
  } else {
    var adaptiveReqArea = mainContent.querySelector('.req-area');
    if (adaptiveReqArea) {
      applyAdaptiveRequestAreaHeight(
        adaptiveReqArea,
        mainContent.querySelector('.split'),
        mainContent.querySelector('.divider'),
        mainContent.querySelector('.bullet-progress'),
        tab
      );
    }
  }
}

function bindContentDelegatedEventsOnce() {
  if (contentDelegatedEventsBound) return;
  contentDelegatedEventsBound = true;

  mainContent.addEventListener('keydown', function(e) {
    handleVariableAutocompleteKeydown(e);
  }, true);
  mainContent.addEventListener('focusin', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    syncVariableAutocomplete(e.target);
  });
  mainContent.addEventListener('focusout', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    setTimeout(function() {
      if (isVariableAutocompleteField(document.activeElement)) {
        syncVariableAutocomplete(document.activeElement);
        return;
      }
      hideVariableAutocomplete();
    }, 0);
  });
  mainContent.addEventListener('click', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    syncVariableAutocomplete(e.target);
  });
  mainContent.addEventListener('input', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    syncVariablePreviewHints(mainContent);
    syncVariableAutocomplete(e.target);
  });
  mainContent.addEventListener('click', function(e) {
    if (!e.target.closest('.js-open-default-headers')) return;
    vscode.postMessage({ type: 'openDefaultHeaders' });
  });
  mainContent.addEventListener('click', function(e) {
    var stripToggle = e.target.closest('.js-status-strip-toggle');
    if (stripToggle) {
      setStatusStripExpanded(!isStatusStripExpanded());
      return;
    }
    var dhToggle = e.target.closest('.js-default-headers-toggle');
    if (dhToggle) {
      var banner = dhToggle.closest('.default-headers-banner');
      var expand = banner?.querySelector('.js-default-headers-expand');
      if (!banner || !expand) return;
      var dhOpen = banner.dataset.expanded !== '1';
      banner.dataset.expanded = dhOpen ? '1' : '0';
      expand.classList.toggle('hidden', !dhOpen);
      dhToggle.setAttribute('aria-expanded', dhOpen ? 'true' : 'false');
      return;
    }
    var actionEl = e.target.closest('.request-status-chip.clickable, .preflight-pill.clickable, .js-preflight-action, .request-change-chip.clickable, .status-strip-seg.clickable, .status-strip-link');
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    var meta = actionEl.dataset.meta;
    if (action === 'open-default-headers') {
      vscode.postMessage({ type: 'openDefaultHeaders' });
      return;
    }
    if (action === 'switch-environment') {
      vscode.postMessage({ type: 'switchEnvironment' });
      return;
    }
    if (action === 'edit-environment') {
      toggleEnvironmentEditor();
      return;
    }
    if (action === 'reveal-variable-usage') {
      // Used N / unresolved Vars: toggle disclosure with the 1.0.9 variable-usage list
      if (isStatusStripExpanded()) {
        setStatusStripExpanded(false);
      } else {
        revealVariableUsageDisclosure();
      }
      return;
    }
    if (action === 'change-workspace-profile') {
      vscode.postMessage({ type: 'changeWorkspaceProfile' });
      return;
    }
    if (action === 'switch-tab' && meta) {
      switchRequestEditorTabAndRevealInContent(mainContent, meta);
    }
  });
  mainContent.addEventListener('click', function(e) {
    var actionEl = e.target.closest('.js-empty-action');
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    if (action === 'new-tab') {
      createTab();
      return;
    }
    if (action === 'sample-request') {
      loadSampleRequestIntoActiveTab();
      return;
    }
    if (action === 'focus-url') {
      var urlInput = mainContent.querySelector('.js-url');
      urlInput?.focus();
      urlInput?.select?.();
      return;
    }
    if (action === 'switch-environment') {
      vscode.postMessage({ type: 'switchEnvironment' });
      return;
    }
    if (action === 'open-guide') {
      vscode.postMessage({ type: 'openGuide' });
    }
  });
}

function bindContentEvents() {
  const mc = mainContent;
  bindContentDelegatedEventsOnce();

  
  mc.querySelector('.js-method')?.addEventListener('change', (e) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.method = e.target.value; markDirty(); renderTabBar(); refreshRequestPreflight(mc); }
  });

  
  var urlInputEl = mc.querySelector('.js-url');
  if (urlInputEl) {
    urlInputEl.addEventListener('input', function(e) {
      var activeTab = tabs.find(t => t.id === activeTabId);
      var wasWs = isWebSocketTab(activeTab);
      if (activeTab) {
        activeTab.url = e.target.value;
        syncRequestTypeFromUrl(activeTab);
      }
      syncParamsFromUrlInput(mc);
      checkUnresolvedVars();
      markDirty();
      activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        activeTab.url = e.target.value;
        syncRequestTypeFromUrl(activeTab);
      }
      if (wasWs !== isWebSocketTab(activeTab)) {
        renderTabBar();
        renderContent();
        return;
      }
      refreshRequestPreflight(mc);
      debouncePersist();
    });
    urlInputEl.addEventListener('keydown', function(e) {
      if (e.defaultPrevented) return;
      if (e.key !== 'Enter') return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      handlePrimaryAction();
    });
    urlInputEl.addEventListener('scroll', function() {
      var ov = mc.querySelector('.js-var-overlay');
      if (ov) ov.scrollLeft = urlInputEl.scrollLeft;
    });
    
    setTimeout(checkUnresolvedVars, 50);
  }

  
  const sendBtn = mc.querySelector('.js-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (sendBtn.classList.contains('btn-send')) {
        triggerSendSlam(sendBtn);
      } else if (sendBtn.classList.contains('btn-stop')) {
        triggerStopSlam(sendBtn);
      }
      handlePrimaryAction();
    });
  }

  mc.querySelector('.js-ws-disconnect')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    websocketDisconnect(tab);
  });

  mc.querySelector('.js-open-default-headers-top')?.addEventListener('click', function() {
    vscode.postMessage({ type: 'openDefaultHeaders' });
  });

  bindActionsMoreMenu(mc.querySelector('.js-request-more-btn'), mc.querySelector('.js-request-more-menu'));

  mc.querySelector('.js-save')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage(buildSaveRequestMessage(tab, tab.requestId || undefined));
  });

  
  mc.querySelector('.js-save-as')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage(buildSaveRequestMessage(tab));
  });

  
  mc.querySelector('.js-copy-curl')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'copyAsCurl', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, skipDefaultHeaders: !!tab.skipDefaultHeaders });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });

  mc.querySelector('.js-generate-code')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'generateCode', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, skipDefaultHeaders: !!tab.skipDefaultHeaders });
    showBtnFeedback(this, tr('webview.opened'), 1000);
  });

  
  bindResponseViewerEvents(mc);

  mc.querySelector('.js-req-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    switchRequestEditorTabInContent(mc, t.dataset.tab);
  });
  mc.querySelector('.js-req-tabs')?.addEventListener('keydown', (e) => {
    const t = e.target.closest('.tab');
    if (!t || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    switchRequestEditorTabInContent(mc, t.dataset.tab);
  });

  
  bindKvRow(mc.querySelector('.js-param-rows'), {
    onChange: function() {
      syncUrlFromParamsEditor(mc);
      markDirty();
      refreshDraftInsights(mc);
    }
  });
  bindKvRow(mc.querySelector('.js-header-rows'));
  healParamsMirrorFromUrl(mc);

  mc.querySelector('.js-add-param')?.addEventListener('click', () => {
    var container = mc.querySelector('.js-param-rows');
    addKvRow(container);
    container?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    syncUrlFromParamsEditor(mc);
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-add-header')?.addEventListener('click', () => {
    var container = mc.querySelector('.js-header-rows');
    addKvRow(container);
    container?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    markDirty();
    refreshDraftInsights(mc);
  });

  mc.querySelectorAll('.js-open-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      toggleBulkEditor(mc, button.dataset.target, true);
    });
  });
  mc.querySelectorAll('.js-apply-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      applyBulkEditor(mc, button.dataset.target);
    });
  });
  mc.querySelectorAll('.js-cancel-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      toggleBulkEditor(mc, button.dataset.target, false);
    });
  });

  
  mc.querySelector('.js-auth-type')?.addEventListener('change', (e) => {
    const fields = mc.querySelector('.js-auth-fields');
    if (fields) fields.innerHTML = authFieldsHtml(e.target.value);
    markDirty();
    refreshDraftInsights(mc);
  });
  
  mc.querySelector('.js-auth-fields')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-auth-fields')?.addEventListener('click', function(e) {
    if (!e.target.classList.contains('js-auth-reveal')) return;
    var wrap = e.target.closest('.auth-inline-control');
    var input = wrap?.querySelector('input');
    if (!input) return;
    var revealing = input.type === 'password';
    input.type = revealing ? 'text' : 'password';
    e.target.textContent = revealing ? tr('webview.hideShort') : tr('webview.revealShort');
  });

  
  bindRequestBodyEditor(mc);

  mc.querySelector('.js-add-formdata-text')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'text');
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-add-formdata-file')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'file');
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('rm')) {
      e.target.closest('.formdata-row')?.remove();
      markDirty();
      refreshDraftInsights(mc);
      return;
    }
    if (e.target.classList.contains('js-formdata-browse')) {
      const row = e.target.closest('.formdata-row');
      vscode.postMessage({ type: 'pickFile', target: 'formdata', rowId: row?.dataset.rowId });
    }
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('js-formdata-type')) {
      syncFormDataRow(e.target.closest('.formdata-row'));
    }
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('input', function(e) {
    syncFormDataRow(e.target.closest('.formdata-row'));
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelectorAll('.formdata-row').forEach(syncFormDataRow);

  mc.querySelector('.js-browse-binary')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'pickFile', target: 'binary' });
  });
  mc.querySelector('.js-binary-path')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-script-prerequest')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-script-test')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelectorAll('.js-insert-script-template').forEach(function(button) {
    button.addEventListener('click', function() {
      insertScriptTemplate(mc, button.dataset.target, button.dataset.template);
      showBtnFeedback(button, tr('webview.inserted'), 1000);
    });
  });
  mc.querySelector('.js-open-script-guide')?.addEventListener('click', function() {
    vscode.postMessage({ type: 'openGuide' });
  });

  
  var divider = mc.querySelector('.divider');
  var splitEl = mc.querySelector('.split');
  var reqArea = mc.querySelector('.req-area');
  var resArea = mc.querySelector('.res-area');
  if (divider && splitEl && reqArea && resArea) {
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      splitDragState = {
        divider: divider,
        splitEl: splitEl,
        reqArea: reqArea,
        progressEl: mc.querySelector('.bullet-progress'),
        startY: e.clientY,
        startH: reqArea.offsetHeight
      };
      divider.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
  }

  refreshDraftInsights(mc);
  syncResponseSearch(mc);
}


function collectAllKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function hasExecutableScripts(scripts) {
  return !!(scripts && ((scripts.preRequest || '').trim() || (scripts.test || '').trim()));
}

function ensureTrustedScriptsBeforeSend(tab) {
  if (!tab || tab.disableScripts || tab.scriptsTrusted !== false || !hasExecutableScripts(tab.scripts)) {
    return true;
  }
  if (!window.confirm(tr('webview.importedScriptsTrustPrompt'))) {
    return false;
  }
  tab.scriptsTrusted = true;
  debouncePersist();
  return true;
}

function sendActiveTab() {
  saveActiveTabState();
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url) return;
  if (tab.loading) return;
  if (!ensureTrustedScriptsBeforeSend(tab)) return;
  const mc = mainContent;

  

  
  var urlWrap = mc.querySelector('.url-input-wrap');
  if (urlWrap) {
    urlWrap.classList.remove('sweep');
    void urlWrap.offsetWidth;
    urlWrap.classList.add('sweep');
    setTimeout(function() { urlWrap.classList.remove('sweep'); }, 350);
  }

  
  const allHeaders = collectAllKv(mc.querySelector('.js-header-rows'));
  tab.loading = true;
  tab.lastEvent = 'sending';
  tab.error = null;
  tab.progressVisible = false;
  tab.slideIn = false;
  const requestStartedAt = Date.now();
  tab.sendTime = requestStartedAt;
  tab.requestStartedAt = requestStartedAt;
  tab.requestEndedAt = null;
  tab.durationMs = null;
  renderContent();

  
  var urlInput = mc.querySelector('.js-url');
  if (urlInput) {
    urlInput.classList.add('neon-active');
  }

  
  var elapsedTimer = null;
  var progressTimer = setTimeout(function() {
    if (!tab.loading) return;
    tab.progressVisible = true;
    
      var timerEl = mc.querySelector('.js-elapsed-timer');
      if (!timerEl) {
        var loadingDiv = mc.querySelector('.js-loading-summary') || mc.querySelector('.res-area > div');
        if (loadingDiv) {
          var sp = document.createElement('span');
          sp.className = 'elapsed-timer js-elapsed-timer';
        loadingDiv.appendChild(sp);
      }
      timerEl = mc.querySelector('.js-elapsed-timer');
    }
    if (timerEl) {
      elapsedTimer = setInterval(function() {
        if (!tab.loading) { clearInterval(elapsedTimer); return; }
        var elapsed = ((Date.now() - tab.sendTime) / 1000).toFixed(1);
        timerEl.textContent = elapsed + 's';
      }, 100);
    }
  }, 3000);
  tab._progressTimer = progressTimer;
  tab._elapsedTimer = elapsedTimer;

  vscode.postMessage({
    type: 'sendRequest', tabId: tab.id,
    requestStartedAt: requestStartedAt,
    method: tab.method, url: tab.url, headers: allHeaders, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout, followRedirects: !!tab.followRedirects, saveToHistory: tab.saveToHistory !== false, tlsValidation: normalizeTlsValidation(tab.tlsValidation), maxResponseSizeKb: normalizeMaxResponseSizeSetting(tab.maxResponseSizeKb), retryCount: normalizeNumberSetting(tab.retryCount), retryDelayMs: normalizeNumberSetting(tab.retryDelayMs), stopAfterHeaders: !!tab.stopAfterHeaders, skipDefaultHeaders: !!tab.skipDefaultHeaders, disableScripts: !!tab.disableScripts, scriptsTrusted: tab.scriptsTrusted !== false,
  });
}

// === KV ??===
function kvValueControlHtml(key, value) {
  var sensitive = isSensitiveKeyName(key);
  return '<input type="' + (sensitive ? 'password' : 'text') + '" class="js-kv-value" placeholder="' + escapeAttr(tr('webview.value')) + '" value="' + escapeAttr(value) + '"/>' +
    '<button class="kv-reveal' + (sensitive ? '' : ' hidden') + '" type="button" title="' + escapeAttr(tr('webview.revealValue')) + '">' + escapeHtml(tr('webview.revealShort')) + '</button>';
}

function kvRowsHtml(items) {
  return (items || []).map(kv =>
    '<div class="kv-row">' +
      '<input type="checkbox"' + (kv.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(kv.key) + '"/>' +
      kvValueControlHtml(kv.key, kv.value) +
      '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>' +
    '</div>'
  ).join('');
}

function addKvRow(container, key, value) {
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(key || '') + '"/>' +
    kvValueControlHtml(key || '', value || '') +
    '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>';
  row.querySelector('.rm').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    if (row.dataset.auto) return;
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function syncKvRowSensitivity(row) {
  if (!row) return;
  var keyInput = row.querySelector('input[type="text"]');
  var valueInput = row.querySelector('.js-kv-value');
  var revealBtn = row.querySelector('.kv-reveal');
  if (!keyInput || !valueInput || !revealBtn) return;
  var sensitive = isSensitiveKeyName(keyInput.value);
  valueInput.type = sensitive ? 'password' : 'text';
  revealBtn.classList.toggle('hidden', !sensitive);
  revealBtn.textContent = tr('webview.revealShort');
  revealBtn.title = tr('webview.revealValue');
}

function bindKvRow(container, options) {
  if (!container) return;
  if (container.dataset.kvBound === 'true') return;
  container.dataset.kvBound = 'true';
  var opts = options || {};
  var handleChange = function() {
    if (typeof opts.onChange === 'function') {
      opts.onChange();
      return;
    }
    markDirty();
    refreshDraftInsights(mainContent);
  };
  container.addEventListener('click', function(e) {
    if (e.target.classList.contains('rm')) {
      e.target.closest('.kv-row')?.remove();
      handleChange();
      return;
    }
    if (e.target.classList.contains('kv-reveal')) {
      var row = e.target.closest('.kv-row');
      var valueInput = row?.querySelector('.js-kv-value');
      if (!valueInput) return;
      var revealing = valueInput.type === 'password';
      valueInput.type = revealing ? 'text' : 'password';
      e.target.textContent = revealing ? tr('webview.hideShort') : tr('webview.revealShort');
      e.target.title = revealing ? tr('webview.hideValue') : tr('webview.revealValue');
    }
  });
  container.addEventListener('input', function(e) {
    var row = e.target.closest('.kv-row');
    if (!row) return;
    syncKvRowSensitivity(row);
    handleChange();
  });
  container.addEventListener('change', function(e) {
    if (!e.target || !e.target.matches || !e.target.matches('input[type="checkbox"]')) return;
    handleChange();
  });
  container.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
}

var syncingUrlParams = false;

function decodeQueryComponentJs(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\\+/g, ' '));
  } catch (err) {
    return String(value || '').replace(/\\+/g, ' ');
  }
}

function encodeQueryComponentPreservingTemplates(value) {
  return String(value || '').replace(/\\{\\{[^{}]+\\}\\}|[^{}]+/g, function(part) {
    if (part.charAt(0) === '{') return part;
    return encodeURIComponent(part);
  });
}

function splitUrlPartsJs(rawUrl) {
  var raw = String(rawUrl || '');
  var working = raw;
  var fragment = '';
  var hashIndex = working.indexOf('#');
  if (hashIndex >= 0) {
    fragment = working.substring(hashIndex);
    working = working.substring(0, hashIndex);
  }
  var base = working;
  var query = '';
  var questionIndex = working.indexOf('?');
  if (questionIndex >= 0) {
    base = working.substring(0, questionIndex);
    query = working.substring(questionIndex + 1);
  }
  var pairs = query.split('&').filter(function(part) { return part.length > 0; }).map(function(part) {
    var eqIndex = part.indexOf('=');
    if (eqIndex < 0) {
      return { key: decodeQueryComponentJs(part), value: '' };
    }
    return {
      key: decodeQueryComponentJs(part.substring(0, eqIndex)),
      value: decodeQueryComponentJs(part.substring(eqIndex + 1))
    };
  }).filter(function(pair) { return !!pair.key; });
  return { base: base, query: query, fragment: fragment, pairs: pairs };
}

function composeUrlWithParamsJs(rawUrl, params) {
  var parts = splitUrlPartsJs(rawUrl);
  var active = (params || []).filter(function(item) { return item && item.enabled !== false && item.key; });
  var next = parts.base;
  if (active.length > 0) {
    next += '?' + active.map(function(item) {
      return encodeQueryComponentPreservingTemplates(item.key) + '=' + encodeQueryComponentPreservingTemplates(item.value || '');
    }).join('&');
  }
  return next + parts.fragment;
}

function syncParamsFromUrlInput(mc) {
  if (syncingUrlParams || !mc) return;
  var urlEl = mc.querySelector('.js-url');
  var rows = mc.querySelector('.js-param-rows');
  if (!urlEl || !rows) return;
  var pairs = splitUrlPartsJs(urlEl.value).pairs;
  syncingUrlParams = true;
  try {
    rows.innerHTML = kvRowsHtml(pairs.map(function(pair) {
      return { key: pair.key, value: pair.value, enabled: true };
    }));
    rows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (tab) {
      tab.params = collectKv(rows);
      tab.url = urlEl.value;
    }
  } finally {
    syncingUrlParams = false;
  }
}

function syncUrlFromParamsEditor(mc) {
  if (syncingUrlParams || !mc) return;
  var urlEl = mc.querySelector('.js-url');
  var rows = mc.querySelector('.js-param-rows');
  if (!urlEl || !rows) return;
  var params = collectKv(rows);
  var nextUrl = composeUrlWithParamsJs(urlEl.value, params);
  if (nextUrl === urlEl.value) {
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (tab) tab.params = params;
    return;
  }
  syncingUrlParams = true;
  try {
    urlEl.value = nextUrl;
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (tab) {
      tab.url = nextUrl;
      tab.params = params;
      syncRequestTypeFromUrl(tab);
    }
    checkUnresolvedVars();
  } finally {
    syncingUrlParams = false;
  }
}

function healParamsMirrorFromUrl(mc) {
  if (!mc) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  var rows = mc.querySelector('.js-param-rows');
  var urlEl = mc.querySelector('.js-url');
  if (!tab || !rows || !urlEl) return;
  var hasParams = (tab.params || []).some(function(item) { return item && item.key; });
  var urlPairs = splitUrlPartsJs(urlEl.value || tab.url || '').pairs;
  if (!hasParams && urlPairs.length > 0) {
    syncParamsFromUrlInput(mc);
  }
}

function parseBulkKeyValueText(text, target) {
  var source = String(text || '').trim();
  if (!source) return [];
  if (target === 'params') {
    var query = source;
    var question = query.indexOf('?');
    if (question >= 0) query = query.substring(question + 1);
    if (query.indexOf('&') >= 0 && query.indexOf('\\n') < 0) {
      return query.split('&').filter(Boolean).map(function(part) {
        var eqIndex = part.indexOf('=');
        if (eqIndex < 0) {
          return { key: decodeURIComponent(part), value: '', enabled: true };
        }
        return {
          key: decodeURIComponent(part.substring(0, eqIndex).replace(/\\+/g, ' ')),
          value: decodeURIComponent(part.substring(eqIndex + 1).replace(/\\+/g, ' ')),
          enabled: true
        };
      }).filter(function(item) { return item.key; });
    }
  }

  return source
    .split(/\\r?\\n/)
    .map(function(line) { return line.trim(); })
    .filter(Boolean)
    .map(function(line) {
      if (target === 'headers' && /^-H\s+/i.test(line)) {
        line = line.replace(/^-H\s+/i, '').replace(/^['"]|['"]$/g, '');
      }
      var sepIndex = line.indexOf(':');
      if (target === 'params' && (sepIndex < 0 || line.indexOf('=') >= 0 && line.indexOf('=') < sepIndex)) {
        sepIndex = line.indexOf('=');
      }
      if (sepIndex < 0 && /\\t/.test(line)) {
        var parts = line.split(/\\t+/);
        return { key: parts.shift() || '', value: parts.join('\t'), enabled: true };
      }
      if (sepIndex < 0) {
        return { key: line, value: '', enabled: true };
      }
      return {
        key: line.substring(0, sepIndex).trim(),
        value: line.substring(sepIndex + 1).trim(),
        enabled: true
      };
    })
    .filter(function(item) { return item.key; });
}

function formDataRowsHtml(items) {
  return (items || []).map(function(field) {
    var isFile = field.type === 'file';
    var value = field.value || '';
    var fileName = isFile ? getFileName(value) : '';
    return '<div class="kv-row formdata-row' + (isFile ? ' is-file' : '') + '" data-row-id="' + escapeAttr(field.id || ('fd_' + Math.random().toString(36).slice(2, 8))) + '">' +
      '<input type="checkbox"' + (field.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" class="js-formdata-key" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(field.key || '') + '"/>' +
      '<select class="js-formdata-type body-type-select formdata-kind" style="width:84px;margin-bottom:0">' +
        '<option value="text"' + (isFile ? '' : ' selected') + '>' + escapeHtml(tr('webview.text')) + '</option>' +
        '<option value="file"' + (isFile ? ' selected' : '') + '>' + escapeHtml(tr('webview.file')) + '</option>' +
      '</select>' +
      '<div class="formdata-meta">' +
        '<input type="text" class="js-formdata-value" placeholder="' + escapeAttr(isFile ? tr('webview.filePath') : tr('webview.value')) + '" value="' + escapeAttr(value) + '"/>' +
        '<span class="formdata-file-chip js-formdata-file-chip' + (isFile && fileName ? '' : ' hidden') + '">' + escapeHtml(fileName || tf('webview.fileSelected', { name: '' })) + '</span>' +
      '</div>' +
      '<button class="btn btn-s js-formdata-browse' + (isFile ? '' : ' hidden') + '" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
      '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>' +
    '</div>';
  }).join('');
}

function getFileName(filePath) {
  var normalized = String(filePath || '').replace(/\\\\/g, '/');
  var parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

function addFormDataRow(container, type) {
  if (!container) return;
  var row = document.createElement('div');
  row.className = 'kv-row formdata-row' + (type === 'file' ? ' is-file' : '');
  row.dataset.rowId = 'fd_' + Math.random().toString(36).slice(2, 10);
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" class="js-formdata-key" placeholder="' + escapeAttr(tr('webview.key')) + '"/>' +
    '<select class="js-formdata-type body-type-select formdata-kind" style="width:84px;margin-bottom:0">' +
      '<option value="text"' + (type === 'file' ? '' : ' selected') + '>' + escapeHtml(tr('webview.text')) + '</option>' +
      '<option value="file"' + (type === 'file' ? ' selected' : '') + '>' + escapeHtml(tr('webview.file')) + '</option>' +
    '</select>' +
    '<div class="formdata-meta">' +
      '<input type="text" class="js-formdata-value" placeholder="' + escapeAttr(type === 'file' ? tr('webview.filePath') : tr('webview.value')) + '"/>' +
      '<span class="formdata-file-chip js-formdata-file-chip hidden"></span>' +
    '</div>' +
    '<button class="btn btn-s js-formdata-browse' + (type === 'file' ? '' : ' hidden') + '" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
    '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>';
  container.appendChild(row);
  syncFormDataRow(row);
}

function syncFormDataRow(row) {
  if (!row) return;
  var type = row.querySelector('.js-formdata-type')?.value || 'text';
  var valueInput = row.querySelector('.js-formdata-value');
  var browseBtn = row.querySelector('.js-formdata-browse');
  var fileChip = row.querySelector('.js-formdata-file-chip');
  var value = valueInput?.value || '';
  var fileName = type === 'file' ? getFileName(value) : '';
  if (valueInput) valueInput.placeholder = type === 'file' ? tr('webview.filePath') : tr('webview.value');
  if (browseBtn) browseBtn.classList.toggle('hidden', type !== 'file');
  row.classList.toggle('is-file', type === 'file');
  if (fileChip) {
    fileChip.classList.toggle('hidden', !(type === 'file' && fileName));
    fileChip.textContent = fileName ? tf('webview.fileSelected', { name: fileName }) : '';
  }
}

function renderFormDataSummary(fields) {
  var enabled = (fields || []).filter(function(field) {
    return field && field.enabled !== false;
  });
  var fileCount = enabled.filter(function(field) { return field.type === 'file'; }).length;
  var textCount = enabled.filter(function(field) { return field.type !== 'file'; }).length;
  return '<span class="meta-stat">' + escapeHtml(tfCount('webview.formDataSummaryFields', enabled.length)) + '</span>' +
    '<span class="meta-stat">' + escapeHtml(tfCount('webview.formDataSummaryFiles', fileCount)) + '</span>' +
    '<span class="meta-stat">' + escapeHtml(tfCount('webview.formDataSummaryText', textCount)) + '</span>';
}

function collectFormData(container) {
  if (!container) return [];
  var arr = [];
  container.querySelectorAll('.formdata-row').forEach(function(row) {
    var cb = row.querySelector('input[type="checkbox"]');
    var key = row.querySelector('.js-formdata-key')?.value || '';
    var value = row.querySelector('.js-formdata-value')?.value || '';
    var type = row.querySelector('.js-formdata-type')?.value || 'text';
    if (!key && !value) return;
    arr.push({
      id: row.dataset.rowId || ('fd_' + Math.random().toString(36).slice(2, 8)),
      key: key,
      value: value,
      enabled: cb?.checked !== false,
      type: type === 'file' ? 'file' : 'text',
    });
  });
  return arr;
}

function collectScripts(mc) {
  return {
    preRequest: mc.querySelector('.js-script-prerequest')?.value || '',
    test: mc.querySelector('.js-script-test')?.value || '',
  };
}

// === Auth ===
function authHtml(auth) {
  const type = auth?.type || 'none';
  return '<select class="js-auth-type">' +
    ['none','basic','bearer','apikey'].map(t =>
      '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' +
      authTypeLabel(t) + '</option>'
    ).join('') +
    '</select><div class="auth-fields js-auth-fields">' + authFieldsHtml(type, auth) + '</div>';
}

function maskedAuthInputHtml(label, className, value, sensitive) {
  return '<div class="auth-row"><label>' + escapeHtml(label) + '</label>' +
    '<input type="' + (sensitive ? 'password' : 'text') + '" class="' + className + '" value="' + escapeAttr(value) + '"/>' +
    (sensitive
      ? '<button class="ghost-btn auth-reveal js-auth-reveal" type="button">' + escapeHtml(tr('webview.revealShort')) + '</button>'
      : '') +
  '</div>';
}

function authFieldsHtml(type, auth) {
  if (type === 'basic') {
    const u = auth?.basic?.username || '';
    const p = auth?.basic?.password || '';
    return maskedAuthInputHtml(tr('webview.username'), 'js-auth-user', u, false) +
           maskedAuthInputHtml(tr('webview.password'), 'js-auth-pass', p, true);
  }
  if (type === 'bearer') {
    const t = auth?.bearer?.token || '';
    return maskedAuthInputHtml(tr('webview.token'), 'js-auth-token', t, true);
  }
  if (type === 'apikey') {
    const k = auth?.apikey?.key || '';
    const v = auth?.apikey?.value || '';
    const a = auth?.apikey?.addTo || 'header';
    return maskedAuthInputHtml(tr('webview.key'), 'js-auth-apikey', k, false) +
           maskedAuthInputHtml(tr('webview.value'), 'js-auth-apival', v, true) +
           '<div class="auth-row"><label>' + escapeHtml(tr('webview.addTo')) + '</label><select class="js-auth-addto"><option value="header"' + (a==='header'?' selected':'') + '>' + escapeHtml(tr('webview.header')) + '</option><option value="query"' + (a==='query'?' selected':'') + '>' + escapeHtml(tr('webview.query')) + '</option></select></div>';
  }
  return '';
}

function collectAuth(mc) {
  const type = mc.querySelector('.js-auth-type')?.value || 'none';
  const auth = { type };
  if (type === 'basic') auth.basic = { username: mc.querySelector('.js-auth-user')?.value || '', password: mc.querySelector('.js-auth-pass')?.value || '' };
  if (type === 'bearer') auth.bearer = { token: mc.querySelector('.js-auth-token')?.value || '' };
  if (type === 'apikey') auth.apikey = { key: mc.querySelector('.js-auth-apikey')?.value || '', value: mc.querySelector('.js-auth-apival')?.value || '', addTo: mc.querySelector('.js-auth-addto')?.value || 'header' };
  return auth;
}


const envEditor = document.getElementById('envEditor');
const envEditorName = document.getElementById('envEditorName');
const envEditorVarCount = document.getElementById('envEditorVarCount');
const envVarRows = document.getElementById('envVarRows');
const addEnvVarBtn = document.getElementById('addEnvVarBtn');
const envCloseBtn = document.getElementById('envCloseBtn');

function refreshEnvironmentEditorLayout() {
  requestAnimationFrame(function() {
    var reqArea = mainContent?.querySelector('.req-area');
    if (!reqArea) return;
    var splitEl = mainContent.querySelector('.split');
    var dividerEl = mainContent.querySelector('.divider');
    var progressEl = mainContent.querySelector('.bullet-progress');
    var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
    if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(activeTab)) {
      applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, reqArea.offsetHeight || reqArea.style.height, activeTab, false);
      return;
    }
    applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, activeTab);
  });
}

function refreshEnvironmentEditorSummary() {
  var hasEnvironment = !!editingEnvId && !!envEditorEnvName;
  if (envEditorName) {
    envEditorName.textContent = hasEnvironment ? envEditorEnvName : tr('webview.environmentNone');
    envEditorName.classList.toggle('muted', !hasEnvironment);
  }
  if (envEditorVarCount) {
    envEditorVarCount.textContent = hasEnvironment ? '(' + tfCount('environment.vars', envEditorVariableCount) + ')' : '';
  }
}

function refreshEnvironmentEditorCountFromRows() {
  envEditorVariableCount = collectKv(envVarRows).length;
  refreshEnvironmentEditorSummary();
  refreshStatusStrip(mainContent);
}

function syncEnvironmentEditorControls() {
  if (addEnvVarBtn) {
    addEnvVarBtn.disabled = !editingEnvId;
  }
}

function hideEnvironmentEditor() {
  if (!envEditor) return;
  envEditor.classList.add('hidden');
  envEditor.classList.remove('linked-focus-active');
  syncEnvironmentStripDisclosureState();
  refreshEnvironmentEditorLayout();
}

function setEnvironmentEditorData(envId, envName, variables) {
  flushPendingEnvironmentSave();
  editingEnvId = envId || null;
  envEditorEnvName = envName || null;
  var items = Array.isArray(variables) ? variables : [];
  envEditorVariableCount = editingEnvId ? items.length : 0;
  envVarRows.innerHTML = editingEnvId ? kvRowsHtml(items) : '';
  envVarRows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  envDirtyDot?.classList.remove('show');
  envAutoSaved?.classList.remove('show');
  refreshEnvironmentEditorSummary();
  syncEnvironmentEditorControls();
  if (!editingEnvId) {
    hideEnvironmentEditor();
  } else {
    refreshEnvironmentEditorLayout();
  }
}

addEnvVarBtn.addEventListener('click', () => {
  if (!editingEnvId) return;
  addKvRow(envVarRows);
  envVarRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  refreshEnvironmentEditorCountFromRows();
  envScheduleSave();
});
envCloseBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  hideEnvironmentEditor();
});
bindKvRow(envVarRows, {
  onChange: () => {
    refreshEnvironmentEditorCountFromRows();
    envScheduleSave();
  }
});
refreshEnvironmentEditorSummary();
syncEnvironmentEditorControls();
updateStaticLocalizedText();


const envDirtyDot = document.getElementById('envDirtyDot');
const envAutoSaved = document.getElementById('envAutoSaved');
let envSaveTimer = null;
let envAutoSavedTimer = null;

function envMarkDirty() {
  envDirtyDot.classList.add('show');
  envAutoSaved.classList.remove('show');
}

function envAutoSave() {
  clearTimeout(envSaveTimer);
  envSaveTimer = null;
  if (!editingEnvId) return;
  const vars = collectKv(envVarRows);
  vscode.postMessage({ type: 'saveEnvironmentVars', envId: editingEnvId, variables: vars });
  
  envDirtyDot.classList.remove('show');
  envAutoSaved.classList.add('show');
  clearTimeout(envAutoSavedTimer);
  envAutoSavedTimer = setTimeout(() => envAutoSaved.classList.remove('show'), 2000);
}

function flushPendingEnvironmentSave() {
  if (!envSaveTimer) return;
  clearTimeout(envSaveTimer);
  envSaveTimer = null;
  envAutoSave();
}

function envScheduleSave() {
  envMarkDirty();
  clearTimeout(envSaveTimer);
  envSaveTimer = setTimeout(envAutoSave, 500);
}


envVarRows.addEventListener('focusout', () => {
  if (!editingEnvId) return;
  clearTimeout(envSaveTimer);
  envAutoSave();
});


const defaultHeadersEditor = document.getElementById('defaultHeadersEditor');
const defaultHeaderRows = document.getElementById('defaultHeaderRows');

document.getElementById('addDefaultHeaderBtn').addEventListener('click', () => {
  addKvRow(defaultHeaderRows);
  defaultHeaderRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
});
document.getElementById('defaultHeadersCloseBtn').addEventListener('click', () => {
  defaultHeadersEditor.classList.remove('linked-focus-active');
  defaultHeadersEditor.classList.add('hidden');
});
bindKvRow(defaultHeaderRows, { onChange: function() {} });
document.getElementById('defaultHeadersSaveBtn').addEventListener('click', () => {
  const headers = collectKv(defaultHeaderRows);
  workspaceDefaultHeaders = headers;
  refreshDefaultHeadersBanner(mainContent);
  refreshToplineStatusChips(mainContent);
  refreshRequestPreflight(mainContent);
  vscode.postMessage({ type: 'saveDefaultHeaders', headers: headers });
});


window.addEventListener('message', (event) => {
  const msg = event.data;

  if (msg.type === 'updateLocalization') {
    applyLocalizationUpdate(msg);
    return;
  }

  if (msg.type === 'flushTabState') {
    persistTabState();
    vscode.postMessage({ type: 'flushedTabState' });
    return;
  }

  if (msg.type === 'websocketStatus') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    var previousStatus = tab.websocketStatus || 'closed';
    tab.requestType = 'websocket';
    tab.websocketStatus = msg.status;
    tab.lastEvent = msg.status === 'error' ? 'error' : 'websocket';
    if (msg.status === 'error') {
      tab.error = msg.error || tr('webview.stage.failed');
    } else if (msg.status === 'open') {
      tab.error = null;
    } else if (msg.status === 'closed' && previousStatus !== 'error') {
      tab.error = null;
    }
    if (msg.status === 'open') {
      appendWebSocketMessage(tab, { direction: 'in', messageType: 'system', data: tr('webview.connected') });
    } else if (msg.status === 'closed') {
      appendWebSocketMessage(tab, { direction: 'in', messageType: 'system', data: formatWebSocketCloseMessage(msg) });
    } else if (msg.status === 'error') {
      appendWebSocketMessage(tab, { direction: 'in', messageType: 'system', data: formatWebSocketErrorMessage(msg) });
    }
    if (activeTabId === msg.tabId) {
      renderTabBar();
      renderContent();
    } else {
      renderTabBar();
    }
    debouncePersist();
    return;
  }

  if (msg.type === 'websocketMessage') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    tab.requestType = 'websocket';
    tab.lastEvent = 'websocket';
    if (tab.websocketStatus !== 'error') {
      tab.websocketStatus = 'open';
      tab.error = null;
    }
    appendWebSocketMessage(tab, {
      direction: msg.direction,
      messageType: msg.messageType,
      data: msg.data || '',
      size: msg.size,
      timestamp: msg.timestamp || Date.now()
    });
    if (activeTabId === msg.tabId) {
      renderContent();
    } else {
      renderTabBar();
    }
    debouncePersist();
    return;
  }

  if (msg.type === 'requestCanceled') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    applyResponseTiming(tab, msg);
    tab.lastEvent = 'canceled';
    tab.error = null;
    if (activeTabId === msg.tabId) {
      var neonEl = mainContent.querySelector('.js-url.neon-active');
      if (neonEl) neonEl.classList.remove('neon-active');
      renderContent();
    } else {
      renderTabBar();
    }
  }

  if (msg.type === 'receiveResponse' || msg.type === 'responseError') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    applyResponseTiming(tab, msg);
    tab.slideIn = true;

    
    var neonEl = mainContent.querySelector('.js-url.neon-active');
    if (neonEl) neonEl.classList.remove('neon-active');

    if (msg.type === 'receiveResponse') {
      if (tab.response) {
        var prevEnv = currentEnvName ? '[' + currentEnvName + ']' : '';
        lastResponse = createResponseSnapshot(
          tab,
          tab.response,
          ((tab.name || (tab.method + ' ' + tab.url)) + ' ' + prevEnv + ' (previous)').trim()
        );
      }
      tab.response = msg.response;
      tab.lastEvent = 'success';
      tab.resolvedUrl = msg.resolvedUrl || '';
      tab.resolvedHeaders = msg.resolvedHeaders || [];
      tab.scriptResults = msg.scriptResults || { logs: [], tests: [] };
      var contentType = ((msg.response.headers?.['content-type'] || msg.response.headers?.['Content-Type'] || '') + '').toLowerCase();
      tab.responseTab = (contentType.indexOf('html') >= 0 && hasMeaningfulStaticPreview(msg.response.body || '')) ? 'resPreview' : 'resBody';
      tab.error = null;
    } else {
      tab.lastEvent = 'error';
      tab.error = msg.error;
      tab.response = null;
      tab.scriptResults = null;
      tab.responseTab = 'resBody';
    }
    if (activeTabId === msg.tabId) {
      
      var bp = mainContent.querySelector('.js-bullet-progress');
      if (bp) {
        var glow = bp.querySelector('.bullet-glow');
        if (glow) {
          var glowRect = glow.getBoundingClientRect();
          var bpRect = bp.getBoundingClientRect();
          bp.style.setProperty('--pos', (glowRect.left - bpRect.left) + 'px');
        }
        bp.classList.add('finishing');
      }
      
      setTimeout(function() {
        renderContent();
        setTimeout(function() {
          var sc = tab.response ? Math.floor(tab.response.status / 100) : 0;
          var isError = (sc >= 4 || !tab.response);

          
          var badge = mainContent.querySelector('.status');
          if (badge) {
            badge.classList.add(isError ? 'flash-error' : 'flash-success');
          }

          
          if (isError && tab.response) {
            var flash = document.createElement('div');
            flash.className = 'screen-flash';
            document.body.appendChild(flash);
            setTimeout(function() { flash.remove(); }, 150);
          }

          
          if (tab.response && tab.response.time <= 100) {
            var meta = mainContent.querySelector('.response-meta');
            if (meta) {
              meta.style.position = 'relative';
              var perf = document.createElement('span');
              perf.className = 'perfect-badge';
              perf.textContent = 'PERFECT!';
              meta.appendChild(perf);
              setTimeout(function() { perf.remove(); }, 900);
            }
          }
        }, 30);
      }, 250);
    }
    
    setTimeout(function() { tab.slideIn = false; }, 300);
  }

  if (msg.type === 'newTab') {
    createTab();
  }

  if (msg.type === 'restoreTabState') {
    compareSettings = normalizeCompareSettings(msg.compareSettings);
    var restoreTabs = msg.tabs || [];
    var restoreIdx = msg.activeIndex || 0;
    if (restoreTabs.length > 0) {
      
      if (tabs.length === 1 && !tabs[0].url) {
        tabs.splice(0, 1);
      }
      for (var ri = 0; ri < restoreTabs.length; ri++) {
        createTab(restoreTabs[ri]);
      }
      
      if (restoreIdx >= 0 && restoreIdx < tabs.length) {
        switchTab(tabs[restoreIdx].id);
      }
    }
  }

  if (msg.type === 'activeVarKeys') {
    activeVarKeys = msg.varKeys || [];
    activeVarValues = msg.varValues || {};
    syncAllRequestTypesFromUrls();
    checkUnresolvedVars();
    syncVariablePreviewHints(mainContent);
    if (variableAutocompleteState?.target) {
      syncVariableAutocomplete(variableAutocompleteState.target);
    }
    renderTabBar();
    renderContent();
  }

  if (msg.type === 'loadRequest') {
    
    if (msg.requestId) {
      var existing = tabs.find(function(t) { return t.requestId === msg.requestId; });
      if (existing) {
        switchTab(existing.id);
        return;
      }
    }
    createTab({
      requestId: msg.requestId || null,
      name: msg.name || msg.method + ' ' + msg.url,
      requestType: msg.requestType,
      method: msg.method,
      url: msg.url,
      headers: msg.headers || [],
      params: msg.params || [],
      body: msg.body || '',
      bodyType: msg.bodyType || 'none',
      formData: msg.formData || [],
      binaryFilePath: msg.binaryFilePath || '',
      auth: msg.auth || { type: 'none' },
      scripts: msg.scripts || { preRequest: '', test: '' },
      timeout: msg.timeout || 0,
      followRedirects: msg.followRedirects === true,
      saveToHistory: msg.saveToHistory !== false,
      tlsValidation: msg.tlsValidation || 'default',
      maxResponseSizeKb: msg.maxResponseSizeKb || 0,
      retryCount: msg.retryCount || 0,
      retryDelayMs: msg.retryDelayMs || 0,
      stopAfterHeaders: msg.stopAfterHeaders === true,
      skipDefaultHeaders: msg.skipDefaultHeaders === true,
      disableScripts: msg.disableScripts === true,
      scriptsTrusted: msg.scriptsTrusted !== false,
      webSocketKeepAliveEnabled: msg.webSocketKeepAliveEnabled === true,
      webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(msg.webSocketKeepAliveIntervalSeconds),
      webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(msg.webSocketKeepAliveMessage),
    });
  }

  if (msg.type === 'pickFileResult') {
    if (msg.target === 'binary') {
      var binaryInput = mainContent.querySelector('.js-binary-path');
      if (binaryInput && msg.filePath) {
        binaryInput.value = msg.filePath;
        markDirty();
        refreshDraftInsights(mainContent);
      }
    } else if (msg.target === 'formdata' && msg.rowId) {
      var row = mainContent.querySelector('.formdata-row[data-row-id="' + msg.rowId + '"]');
      var input = row?.querySelector('.js-formdata-value');
      if (input && msg.filePath) {
        input.value = msg.filePath;
        syncFormDataRow(row);
        markDirty();
        refreshDraftInsights(mainContent);
      }
    }
  }

  if (msg.type === 'loadEnvironment') {
    setEnvironmentEditorData(msg.envId, msg.envName, msg.variables || []);
    revealEnvironmentEditor();
  }

  if (msg.type === 'loadDefaultHeaders') {
    workspaceDefaultHeaders = msg.headers || [];
    defaultHeaderRows.innerHTML = kvRowsHtml(workspaceDefaultHeaders);
    defaultHeaderRows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    refreshDefaultHeadersBanner(mainContent);
    refreshToplineStatusChips(mainContent);
    refreshRequestPreflight(mainContent);
    if (msg.reveal !== false) {
      revealDefaultHeadersEditor();
    }
  }

  if (msg.type === 'updateActiveEnv') {
    currentEnvName = msg.envName;
    currentWorkspaceProfile = msg.profileName || 'default';
    if (Object.prototype.hasOwnProperty.call(msg, 'envId')) {
      setEnvironmentEditorData(msg.envId || null, msg.envName || null, msg.variables || []);
    }
    refreshToplineStatusChips(mainContent);
    refreshRequestPreflight(mainContent);
  }

  
  if (msg.type === 'saveRequestResult') {
    if (msg.saved) {
      
      var savedTab = _pendingCloseAfterSave
        ? tabs.find(function(t){return t.id === _pendingCloseAfterSave})
        : tabs.find(function(t){return t.id === activeTabId});
      if (savedTab) {
        if (msg.requestId) savedTab.requestId = msg.requestId;
        if (msg.name) savedTab.name = msg.name;
        savedTab.autoName = false;
        savedTab._snapshot = snapshotTab(savedTab);
        savedTab.dirty = false;
      }
      renderTabBar();
      if (pendingSaveBtn) {
        showBtnFeedback(pendingSaveBtn, tr('webview.saved'), 1200);
      }
      
      if (_pendingCloseAfterSave) {
        doCloseTab(_pendingCloseAfterSave);
        _pendingCloseAfterSave = null;
      }
      debouncePersist();
    } else {
      
      _pendingCloseAfterSave = null;
    }
    pendingSaveBtn = null;
  }
  if (msg.type === 'saveResponseBodyResult') {
    if (msg.saved && pendingSaveResponseBtn) {
      showBtnFeedback(pendingSaveResponseBtn, tr('webview.saved'), 1200);
    }
    pendingSaveResponseBtn = null;
  }

  
  if (msg.type === 'configureCollectionRun') {
    showRunnerSetup(msg);
  }
  if (msg.type === 'runCollectionStart') {
    showRunner(msg);
  }
  if (msg.type === 'runCollectionStatus') {
    updateRunnerStatus(msg);
  }
  if (msg.type === 'runCollectionProgress') {
    updateRunnerRow(msg);
  }
  if (msg.type === 'runCollectionDone') {
    finishRunner(msg);
  }
});





function isBinaryContentType(ct) {
  var mime = (ct || '').split(';')[0].trim().toLowerCase();
  if (!mime) return false;
  if (mime.startsWith('text/')) return false;
  if (mime.endsWith('+json') || mime.endsWith('+xml')) return false;
  return [
    'application/json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'text/javascript',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/ld+json',
    'application/x-ndjson',
  ].indexOf(mime) < 0;
}


function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

function normalizeEpochMs(value) {
  var num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
}

function normalizeDurationMs(value) {
  var num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function pad3(value) {
  return String(value).padStart(3, '0');
}

function formatLocalTimestamp(epochMs) {
  var ms = normalizeEpochMs(epochMs);
  if (ms === null) return '';
  var date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return '';
  return date.getFullYear() + '-' +
    pad2(date.getMonth() + 1) + '-' +
    pad2(date.getDate()) + ' ' +
    pad2(date.getHours()) + ':' +
    pad2(date.getMinutes()) + ':' +
    pad2(date.getSeconds()) + '.' +
    pad3(date.getMilliseconds());
}

function formatLocalTime(epochMs) {
  var ms = normalizeEpochMs(epochMs);
  if (ms === null) return '';
  var date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return '';
  return pad2(date.getHours()) + ':' +
    pad2(date.getMinutes()) + ':' +
    pad2(date.getSeconds()) + '.' +
    pad3(date.getMilliseconds());
}

function isSameLocalDate(leftEpochMs, rightEpochMs) {
  var left = normalizeEpochMs(leftEpochMs);
  var right = normalizeEpochMs(rightEpochMs);
  if (left === null || right === null) return false;
  var leftDate = new Date(left);
  var rightDate = new Date(right);
  return leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate();
}

function formatResponseTimingValue(epochMs, pairedEpochMs) {
  var ms = normalizeEpochMs(epochMs);
  if (ms === null) return '';
  if (pairedEpochMs !== undefined && isSameLocalDate(ms, pairedEpochMs)) {
    return formatLocalTime(ms);
  }
  var date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return '';
  return pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + formatLocalTime(ms);
}

function formatDurationMs(durationMs) {
  var ms = normalizeDurationMs(durationMs);
  if (ms === null) return '';
  if (ms < 1000) return ms + ' ms';
  if (ms < 60000) return (ms / 1000).toFixed(3) + ' s';
  var minutes = Math.floor(ms / 60000);
  var remainder = ms % 60000;
  var seconds = Math.floor(remainder / 1000);
  var milliseconds = remainder % 1000;
  return minutes + 'm ' + pad2(seconds) + '.' + pad3(milliseconds) + 's';
}

function getResponseDurationMs(tab, fallbackTime) {
  var explicit = normalizeDurationMs(tab?.durationMs);
  if (explicit !== null) return explicit;
  var startedAt = normalizeEpochMs(tab?.requestStartedAt);
  var endedAt = normalizeEpochMs(tab?.requestEndedAt);
  if (startedAt !== null && endedAt !== null) {
    return Math.max(0, endedAt - startedAt);
  }
  return normalizeDurationMs(fallbackTime);
}

function applyResponseTiming(tab, msg) {
  if (!tab) return;
  var startedAt = normalizeEpochMs(msg?.requestStartedAt) ?? normalizeEpochMs(tab.requestStartedAt) ?? normalizeEpochMs(tab.sendTime);
  var endedAt = normalizeEpochMs(msg?.requestEndedAt) ?? Date.now();
  var durationMs = normalizeDurationMs(msg?.durationMs);
  if (durationMs === null && startedAt !== null && endedAt !== null) {
    durationMs = Math.max(0, endedAt - startedAt);
  }
  tab.requestStartedAt = startedAt;
  tab.requestEndedAt = endedAt;
  tab.durationMs = durationMs;
}

function buildResponseTimingMetaHtml(tab) {
  var startedAt = normalizeEpochMs(tab?.requestStartedAt);
  var endedAt = normalizeEpochMs(tab?.requestEndedAt);
  if (startedAt === null && endedAt === null) return '';
  var endedKey = tab?.response && tab?.lastEvent === 'success' ? 'webview.receivedAt' : 'webview.endedAt';
  var titleParts = [];
  if (startedAt !== null) {
    titleParts.push(tr('webview.requestedAt') + ' ' + formatLocalTimestamp(startedAt));
  }
  if (endedAt !== null) {
    titleParts.push(tr(endedKey) + ' ' + formatLocalTimestamp(endedAt));
  }
  var durationMs = getResponseDurationMs(tab, tab?.response?.time);
  if (durationMs !== null) {
    titleParts.push(String(durationMs) + ' ms');
  }
  var title = titleParts.length > 0 ? ' title="' + escapeAttr(titleParts.join(' / ')) + '"' : '';
  if (startedAt !== null && endedAt !== null) {
    return '<div class="response-timing-row"' + title + '><span class="timing-flow"><span class="timing-value">' + escapeHtml(formatResponseTimingValue(startedAt, endedAt)) + '</span><span class="timing-arrow" aria-hidden="true">\u2192</span><span class="timing-value">' + escapeHtml(formatResponseTimingValue(endedAt, startedAt)) + '</span></span></div>';
  }
  if (startedAt !== null) {
    return '<div class="response-timing-row"' + title + '><span class="timing-flow"><span class="timing-prefix">' + escapeHtml(tr('webview.requestedAt')) + '</span><span class="timing-value">' + escapeHtml(formatResponseTimingValue(startedAt)) + '</span></span></div>';
  }
  return '<div class="response-timing-row"' + title + '><span class="timing-flow"><span class="timing-prefix">' + escapeHtml(tr(endedKey)) + '</span><span class="timing-value">' + escapeHtml(formatResponseTimingValue(endedAt)) + '</span></span></div>';
}
function stringifyForHtml(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    if (typeof value === 'object') {
      var json = JSON.stringify(value);
      if (typeof json === 'string') return json;
    }
  } catch {}
  return String(value);
}
function escapeHtml(s) { return stringifyForHtml(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escapeAttr(s) { return stringifyForHtml(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function truncate(s, n) { return s.length > n ? s.substring(0, n-1) + '...' : s; }


function checkUnresolvedVars() {
  var urlEl = mainContent.querySelector('.js-url');
  var overlay = mainContent.querySelector('.js-var-overlay');
  if (!urlEl || !overlay) return;
  var val = urlEl.value || '';
  var re = /\\{\\{([^}]+)\\}\\}/g;
  var match;
  var unresolvedNames = [];
  while ((match = re.exec(val)) !== null) {
    var name = match[1].trim();
    if (activeVarKeys.indexOf(name) < 0) {
      unresolvedNames.push(name);
    }
  }
  if (unresolvedNames.length > 0) {
    var html = escapeHtml(val).replace(/\\{\\{([^}]+)\\}\\}/g, function(m, n) {
      if (unresolvedNames.indexOf(n.trim()) >= 0) {
        return '<span class="unresolved-var">' + m + '</span>';
      }
      return m;
    });
    overlay.innerHTML = html;
    overlay.classList.remove('hidden');
    
    overlay.scrollLeft = urlEl.scrollLeft;
  } else {
    overlay.innerHTML = '';
    overlay.classList.add('hidden');
  }
}

function collectVariablePreviewItems(text) {
  var value = String(text || '');
  var regex = /\{\{([^}]+)\}\}/g;
  var seen = {};
  var items = [];
  var match;
  while ((match = regex.exec(value)) !== null) {
    var name = (match[1] || '').trim();
    if (!name || seen[name]) continue;
    seen[name] = true;
    items.push({
      name: name,
      value: Object.prototype.hasOwnProperty.call(activeVarValues, name) ? String(activeVarValues[name] ?? '') : '',
      missing: activeVarKeys.indexOf(name) < 0
    });
  }
  return items;
}

function ensureVariablePreviewPopover() {
  if (variablePreviewPopover) return variablePreviewPopover;
  variablePreviewPopover = document.createElement('div');
  variablePreviewPopover.className = 'var-preview-popover hidden';
  document.body.appendChild(variablePreviewPopover);
  return variablePreviewPopover;
}

function hideVariablePreviewPopover() {
  if (!variablePreviewPopover) return;
  variablePreviewPopover.classList.add('hidden');
  variablePreviewPopover.innerHTML = '';
}

function syncVariablePreviewHints(scope) {
  scope?.querySelectorAll('input[type="text"], input[type="password"], textarea').forEach(function(field) {
    if (field.classList.contains('js-response-search')) {
      delete field.dataset.varPreview;
      delete field.dataset.varPreviewHtml;
      field.removeAttribute('title');
      return;
    }
    var items = collectVariablePreviewItems(field.value || '');
    if (!items.length) {
      delete field.dataset.varPreview;
      delete field.dataset.varPreviewHtml;
      field.removeAttribute('title');
      return;
    }

    var previewText = items.map(function(item) {
      return '{{' + item.name + '}} → ' + (item.missing ? tr('webview.variablePreviewMissing') : item.value);
    }).join('\\n');
    var previewHtml = '<div class="var-preview-title">' + escapeHtml(tr('webview.variablePreviewTitle')) + '</div>' +
      items.map(function(item) {
        return '<div class="var-preview-line">' +
          '<span class="var-preview-name">{{' + escapeHtml(item.name) + '}}</span>' +
          '<span class="var-preview-value' + (item.missing ? ' missing' : '') + '">' + escapeHtml(item.missing ? tr('webview.variablePreviewMissing') : item.value) + '</span>' +
        '</div>';
      }).join('');

    field.dataset.varPreview = previewText;
    field.dataset.varPreviewHtml = previewHtml;
    field.title = previewText;
  });
}

function showVariablePreviewPopover(target) {
  if (!target?.dataset?.varPreviewHtml) {
    hideVariablePreviewPopover();
    return;
  }

  var popover = ensureVariablePreviewPopover();
  popover.innerHTML = target.dataset.varPreviewHtml;
  popover.classList.remove('hidden');
  var rect = target.getBoundingClientRect();
  var top = Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom + 8);
  var left = Math.min(window.innerWidth - popover.offsetWidth - 12, rect.left);
  popover.style.top = Math.max(12, top) + 'px';
  popover.style.left = Math.max(12, left) + 'px';
}

function isVariableAutocompleteField(target) {
  if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (target.disabled || target.readOnly) return false;
  if (target.classList.contains('js-response-search')) return false;
  if (target.type && ['checkbox', 'number', 'hidden'].indexOf(target.type) >= 0) return false;
  return true;
}

function getVariableAutocompleteContext(target) {
  if (!isVariableAutocompleteField(target)) return null;
  if (typeof target.selectionStart !== 'number' || typeof target.selectionEnd !== 'number') return null;
  if (target.selectionStart !== target.selectionEnd) return null;
  var value = String(target.value || '');
  var caret = target.selectionStart;
  var before = value.slice(0, caret);
  var openIndex = before.lastIndexOf('{{');
  if (openIndex < 0) return null;
  if (before.indexOf('}}', openIndex) >= 0) return null;
  var partial = before.slice(openIndex + 2);
  var cr = String.fromCharCode(13);
  var lf = String.fromCharCode(10);
  var tab = String.fromCharCode(9);
  if (partial.indexOf('{') >= 0 || partial.indexOf('}') >= 0) return null;
  if (partial.indexOf(cr) >= 0 || partial.indexOf(lf) >= 0) return null;
  if (partial.indexOf(' ') >= 0 || partial.indexOf(tab) >= 0) return null;
  var replaceEnd = caret;
  if (value.slice(caret, caret + 2) === '}}') {
    replaceEnd += 2;
  }
  return {
    start: openIndex,
    end: replaceEnd,
    query: partial,
  };
}

function getVariableAutocompleteSuggestions(query) {
  var needle = String(query || '').toLowerCase();
  var exactPrefix = [];
  var fuzzy = [];
  activeVarKeys.forEach(function(name) {
    var lowered = String(name || '').toLowerCase();
    if (!needle || lowered.indexOf(needle) === 0) {
      exactPrefix.push(name);
      return;
    }
    if (lowered.indexOf(needle) >= 0) {
      fuzzy.push(name);
    }
  });
  return exactPrefix.concat(fuzzy).slice(0, 10).map(function(name) {
    return {
      name: name,
      value: Object.prototype.hasOwnProperty.call(activeVarValues, name) ? String(activeVarValues[name] ?? '') : '',
    };
  });
}

function ensureVariableAutocompletePopover() {
  if (variableAutocompletePopover) return variableAutocompletePopover;
  variableAutocompletePopover = document.createElement('div');
  variableAutocompletePopover.className = 'var-autocomplete hidden';
  variableAutocompletePopover.addEventListener('mousedown', function(event) {
    var item = event.target.closest('.js-var-autocomplete-item');
    if (!item) return;
    event.preventDefault();
    applyVariableAutocompleteSelection(Number(item.dataset.index || 0));
  });
  document.body.appendChild(variableAutocompletePopover);
  return variableAutocompletePopover;
}

function hideVariableAutocomplete() {
  if (variableAutocompletePopover) {
    variableAutocompletePopover.classList.add('hidden');
    variableAutocompletePopover.innerHTML = '';
  }
  variableAutocompleteState = null;
}

function positionVariableAutocomplete(target) {
  if (!variableAutocompletePopover || !target) return;
  var rect = target.getBoundingClientRect();
  var top = Math.min(window.innerHeight - variableAutocompletePopover.offsetHeight - 12, rect.bottom + 8);
  var left = Math.min(window.innerWidth - variableAutocompletePopover.offsetWidth - 12, rect.left);
  variableAutocompletePopover.style.top = Math.max(12, top) + 'px';
  variableAutocompletePopover.style.left = Math.max(12, left) + 'px';
}

function renderVariableAutocomplete() {
  if (!variableAutocompleteState) {
    hideVariableAutocomplete();
    return;
  }
  var popover = ensureVariableAutocompletePopover();
  var suggestions = variableAutocompleteState.suggestions || [];
  var listHtml = suggestions.length
    ? suggestions.map(function(item, index) {
        return '<button class="var-autocomplete-item js-var-autocomplete-item' + (index === variableAutocompleteState.activeIndex ? ' active' : '') + '" type="button" data-index="' + index + '">' +
          '<span class="var-autocomplete-key">{{' + escapeHtml(item.name) + '}}</span>' +
          '<span class="var-autocomplete-value">' + escapeHtml(item.value || '') + '</span>' +
        '</button>';
      }).join('')
    : '<div class="var-autocomplete-empty">' + escapeHtml(tr('webview.variableAutocompleteEmpty')) + '</div>';
  popover.innerHTML =
    '<div class="var-autocomplete-title">' + escapeHtml(tr('webview.variableAutocompleteTitle')) + '</div>' +
    '<div class="var-autocomplete-list">' + listHtml + '</div>';
  popover.classList.remove('hidden');
  positionVariableAutocomplete(variableAutocompleteState.target);
}

function syncVariableAutocomplete(target) {
  if (!isVariableAutocompleteField(target)) {
    hideVariableAutocomplete();
    return;
  }
  var context = getVariableAutocompleteContext(target);
  if (!context) {
    hideVariableAutocomplete();
    return;
  }
  variableAutocompleteState = {
    target: target,
    context: context,
    suggestions: getVariableAutocompleteSuggestions(context.query),
    activeIndex: 0,
  };
  renderVariableAutocomplete();
}

function moveVariableAutocomplete(delta) {
  if (!variableAutocompleteState || !variableAutocompleteState.suggestions.length) return;
  var total = variableAutocompleteState.suggestions.length;
  variableAutocompleteState.activeIndex = (variableAutocompleteState.activeIndex + delta + total) % total;
  renderVariableAutocomplete();
}

function applyVariableAutocompleteSelection(index) {
  if (!variableAutocompleteState) return false;
  var target = variableAutocompleteState.target;
  var suggestions = variableAutocompleteState.suggestions || [];
  if (!target || !suggestions.length) return false;
  var next = suggestions[index];
  if (!next) return false;
  var context = getVariableAutocompleteContext(target) || variableAutocompleteState.context;
  if (!context) return false;
  var token = '{{' + next.name + '}}';
  var value = String(target.value || '');
  target.value = value.slice(0, context.start) + token + value.slice(context.end);
  var nextCaret = context.start + token.length;
  target.setSelectionRange(nextCaret, nextCaret);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  hideVariableAutocomplete();
  return true;
}

function handleVariableAutocompleteKeydown(event) {
  if (!variableAutocompleteState || variableAutocompleteState.target !== event.target) return false;
  if (event.key === 'Escape') {
    hideVariableAutocomplete();
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (!variableAutocompleteState.suggestions.length) return false;
  if (event.key === 'ArrowDown') {
    moveVariableAutocomplete(1);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.key === 'ArrowUp') {
    moveVariableAutocomplete(-1);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    if (applyVariableAutocompleteSelection(variableAutocompleteState.activeIndex || 0)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  }
  return false;
}


function persistTabState() {
    saveActiveTabState();
    var tabData = tabs.map(function(t) {
    return Object.assign({ name: t.name, autoName: !!t.autoName, requestType: normalizeRequestType(t.requestType, t.url), requestEditorTab: normalizeRequestEditorTab(t.requestEditorTab), requestSplitHeightPx: normalizeRequestSplitHeight(t.requestSplitHeightPx) || undefined, method: t.method, url: t.url, headers: t.headers, params: t.params, body: t.body, bodyType: t.bodyType, formData: t.formData || [], binaryFilePath: t.binaryFilePath || '', auth: t.auth, scripts: t.scripts || { preRequest: '', test: '' }, jsonFormatStyle: t.jsonFormatStyle, xmlFormatStyle: t.xmlFormatStyle, formatIndent: t.formatIndent, responseSearchQuery: t.responseSearchQuery || '', responseSearchIndex: typeof t.responseSearchIndex === 'number' ? t.responseSearchIndex : 0, responseSearchCaseSensitive: t.responseSearchCaseSensitive === true, responseSearchRegex: t.responseSearchRegex === true, scriptHelpCollapsed: t.scriptHelpCollapsed === true, pinned: t.pinned || false, requestId: t.requestId || undefined }, requestSettingsSnapshot(t));
    });
  var activeIdx = tabs.findIndex(function(t) { return t.id === activeTabId; });
  vscode.postMessage({ type: 'saveTabState', tabs: tabData, activeIndex: Math.max(0, activeIdx), compareSettings: cloneCompareSettings(compareSettings) });
}


var _persistTimer = null;
var variablePreviewPopover = null;
var variableAutocompletePopover = null;
var variableAutocompleteState = null;
function debouncePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistTabState, 1000);
}


createTab();


vscode.postMessage({ type: 'webviewReady' });
`;
}
