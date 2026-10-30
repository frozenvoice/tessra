/** Request panel WebSocket client fragment (same Webview lexical scope as main client script). */
export function getRequestPanelWebSocketClientScript(): string {
  return /*js*/ `
function disconnectWebSocketIfOpen(tab) {
  if (tab?.websocketStatus && tab.websocketStatus !== 'closed') {
    websocketDisconnect(tab);
  }
}

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
    pathVariableOverrides: prunePathVariableOverrides(tab.url || '', tab.pathVariableOverrides),
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

function handleWebSocketStatusMessage(msg) {
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

function handleWebSocketMessageEvent(msg) {
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

`;
}
