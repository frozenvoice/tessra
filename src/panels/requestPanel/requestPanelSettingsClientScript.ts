/** Request panel Settings Editor client fragment (same Webview lexical scope as main client script). */

export function getRequestPanelSettingsClientScript(): string {
  return /*js*/ `
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

function renderSettingsEditorContents(tab, isWs) {
  return '<div class="settings-grid">' +
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
  '</div>';
}

function bindRequestSettingsEditor(mc) {
  var settingsPanel = mc.querySelector('.js-settings-panel');
  if (settingsPanel) {
    var refreshSettingsDraftUi = function() {
      syncSettingsToggleStates(mc);
      markDirty();
      refreshDraftInsights(mc);
    };
    settingsPanel.addEventListener('input', function(e) {
      if (e.target?.matches?.('input[type="checkbox"]')) return;
      refreshSettingsDraftUi();
    });
    settingsPanel.addEventListener('change', function(e) {
      if (!e.target?.matches?.('input[type="checkbox"], select')) return;
      refreshSettingsDraftUi();
    });
  }
}
`;
}
