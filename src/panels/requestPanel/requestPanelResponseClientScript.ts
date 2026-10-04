/** Request panel Response Viewer client fragment (same Webview lexical scope as main client script). */
export function getRequestPanelResponseClientScript(): string {
  return /*js*/ `
function normalizeCompareList(value, fallback) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(function(item) { return item.trim(); }).filter(Boolean);
  }
  return fallback.slice();
}

function normalizeCompareSettings(value) {
  var mode = value && (value.mode === 'raw' || value.mode === 'pretty' || value.mode === 'normalized')
    ? value.mode
    : 'normalized';
  return {
    mode: mode,
    includeMetadataSummary: value ? value.includeMetadataSummary !== false : true,
    foldUnchangedSections: value ? value.foldUnchangedSections !== false : DEFAULT_COMPARE_FOLD_UNCHANGED,
    ignoreHeaders: normalizeCompareList(value && value.ignoreHeaders, DEFAULT_COMPARE_IGNORE_HEADERS),
    ignoreJsonPaths: normalizeCompareList(value && value.ignoreJsonPaths, DEFAULT_COMPARE_IGNORE_JSON_PATHS)
  };
}

function cloneCompareSettings(value) {
  var normalized = normalizeCompareSettings(value);
  return {
    mode: normalized.mode,
    includeMetadataSummary: normalized.includeMetadataSummary,
    foldUnchangedSections: normalized.foldUnchangedSections,
    ignoreHeaders: normalized.ignoreHeaders.slice(),
    ignoreJsonPaths: normalized.ignoreJsonPaths.slice()
  };
}

function compareModeShort(mode) {
  return mode === 'raw' ? tr('webview.modeRaw') : mode === 'pretty' ? tr('webview.modePretty') : tr('webview.modeNormalized');
}

function compareModeLabel(mode) {
  return mode === 'raw' ? tr('webview.modeRaw') : mode === 'pretty' ? tr('webview.modePretty') : tr('webview.modeNormalized');
}

function simpleHash(value) {
  var hash = 5381;
  for (var i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(36);
}

function buildResponseSignature(snapshot) {
  return [
    snapshot.status || 0,
    snapshot.statusText || '',
    snapshot.contentType || '',
    snapshot.resolvedUrl || '',
    snapshot.body ? snapshot.body.length : 0,
    simpleHash(snapshot.bodyBase64 || snapshot.body || '')
  ].join('|');
}

function createResponseSnapshot(tab, response, label) {
  if (!tab || !response) return null;
  var ct = response.headers?.['content-type'] || response.headers?.['Content-Type'] || 'text/plain';
  var snapshot = {
    label: label,
    body: response.body || '',
    bodyBase64: response.bodyBase64 || '',
    contentType: ct,
    status: response.status,
    statusText: response.statusText,
    size: response.size,
    time: response.time,
    resolvedUrl: tab.resolvedUrl || tab.url || '',
    headers: response.headers || {},
    timestamp: Date.now(),
    jsonFormatStyle: tab.jsonFormatStyle || 'pretty',
    xmlFormatStyle: tab.xmlFormatStyle || 'inline',
    formatIndent: tab.formatIndent || '2'
  };
  snapshot.signature = buildResponseSignature(snapshot);
  return snapshot;
}

function getActiveResponseSnapshot() {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return null;
  var envLabel = currentEnvName ? '[' + currentEnvName + ']' : '';
  var timeLabel = formatShortTime(new Date());
  var label = ((tab.name || (tab.method + ' ' + tab.url)) + ' ' + envLabel + ' ' + timeLabel).trim();
  return createResponseSnapshot(tab, tab.response, label);
}

function serializeCompareSnapshot(snapshot) {
  return {
    label: snapshot.label,
    body: snapshot.body,
    bodyBase64: snapshot.bodyBase64 || '',
    contentType: snapshot.contentType,
    status: snapshot.status,
    statusText: snapshot.statusText,
    size: snapshot.size,
    time: snapshot.time,
    resolvedUrl: snapshot.resolvedUrl,
    headers: snapshot.headers || {},
    timestamp: snapshot.timestamp,
    jsonFormatStyle: snapshot.jsonFormatStyle || 'pretty',
    xmlFormatStyle: snapshot.xmlFormatStyle || 'inline',
    formatIndent: snapshot.formatIndent || '2'
  };
}

function requestCompare(left, right) {
  if (!left || !right) return;
  vscode.postMessage({
    type: 'compareResponses',
    left: serializeCompareSnapshot(left),
    right: serializeCompareSnapshot(right),
    options: cloneCompareSettings(compareSettings)
  });
}

function compareCurrentWithLast() {
  var current = getActiveResponseSnapshot();
  if (!current || !lastResponse) return;
  requestCompare(lastResponse, current);
}

function buildCompareChipMarkup(currentSignature) {
  var compareContextActive = !!lastResponse || pinnedResponses.length > 0;
  return '<span class="compare-chip mode"><strong>' + escapeHtml(tr('webview.mode')) + '</strong> ' + escapeHtml(compareModeShort(compareSettings.mode)) + '</span>' +
    (compareSettings.includeMetadataSummary ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.includeMetadata')) + '</span>' : '') +
    (compareContextActive && compareSettings.foldUnchangedSections ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.compareFoldUnchanged')) + '</span>' : '') +
    (lastResponse ? '<span class="compare-chip ready"><strong>' + escapeHtml(tr('webview.last')) + '</strong> ' + escapeHtml(tr('webview.lastReady')) + '</span>' : '') +
    (pinnedResponses.length >= 2 ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.comparePinned')) + '</span>' : '') +
    pinnedResponses.map(function(pin, index) {
      var current = pin.signature === currentSignature;
      return '<span class="compare-chip' + (current ? ' current' : '') + '">' +
        '<strong>' + escapeHtml(current ? tr('webview.pinnedHere') : tf('webview.pinNumber', { count: index + 1 })) + '</strong>' +
        escapeHtml(truncate(pin.label || tr('webview.savedResponse'), 24)) +
      '</span>';
    }).join('');
}

function buildCompareContextCueText() {
  var compareActive = pinnedResponses.length >= 2 || !!lastResponse;
  var nonDefaultMode = compareSettings.mode !== 'normalized';
  var parts = [];
  if (compareActive || nonDefaultMode) {
    parts.push(compareModeShort(compareSettings.mode));
  }
  // Compact Metadata cue only when compare context or non-default mode is already visible.
  if (compareSettings.includeMetadataSummary && (compareActive || nonDefaultMode)) {
    parts.push(tr('webview.metadata'));
  }
  return parts.join(' · ');
}

function syncCompareContextIndicator(mc, currentSignature) {
  var chipRow = mc.querySelector('.js-compare-chip-row');
  if (!chipRow) return;
  var cueText = buildCompareContextCueText();
  if (cueText) {
    // Quiet Instrument: compact text only — never rebuild the old chip/pill wall here.
    chipRow.className = 'compare-active-indicator js-compare-chip-row';
    chipRow.textContent = cueText;
    return;
  }
  chipRow.className = 'js-compare-chip-row visually-hidden';
  chipRow.innerHTML = buildCompareChipMarkup(currentSignature || '');
}

function updatePinCompareButtons(mc) {
  var activeSnapshot = getActiveResponseSnapshot();
  var currentPinned = activeSnapshot
    ? pinnedResponses.some(function(pin) { return pin.signature === activeSnapshot.signature; })
    : false;
  var pinCountSuffix = pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '';
  var compareReady = pinnedResponses.length >= 2;

  var pinBtn = mc.querySelector('.js-pin-response');
  if (pinBtn) {
    pinBtn.classList.toggle('pinned', currentPinned);
    pinBtn.disabled = false;
    var pinLabel = (currentPinned ? tr('webview.unpin') : tr('webview.pin')) + pinCountSuffix;
    pinBtn.innerHTML = pinSvg + '<span class="action-label">' + escapeHtml(pinLabel) + '</span>';
    pinBtn.title = tr('webview.pinResponse') + pinCountSuffix;
    pinBtn.setAttribute('aria-label', pinLabel);
  }

  var cmpBtn = mc.querySelector('.js-compare-responses');
  if (cmpBtn) {
    if (compareReady) {
      cmpBtn.disabled = false;
      cmpBtn.classList.add('ready');
      cmpBtn.title = tr('webview.comparePinned') + ' ' + compareModeShort(compareSettings.mode) + pinCountSuffix;
    } else {
      cmpBtn.disabled = true;
      cmpBtn.classList.remove('ready');
      cmpBtn.title = tr('webview.compareNeedsPin');
    }
    cmpBtn.innerHTML = diffSvg + '<span class="action-label">' + escapeHtml(tr('webview.compare')) + '</span>';
    cmpBtn.setAttribute('aria-label', tr('webview.compare'));
  }

  var compareLastBtn = mc.querySelector('.js-compare-last');
  if (compareLastBtn) {
    compareLastBtn.disabled = !lastResponse;
    compareLastBtn.innerHTML = '<span class="action-label">' + escapeHtml(tr('webview.last')) + '</span>';
  }

  var settingsBtn = mc.querySelector('.js-compare-settings');
  if (settingsBtn) {
    settingsBtn.innerHTML = '<span class="action-label">' + escapeHtml(tr('webview.mode') + ': ' + compareModeShort(compareSettings.mode)) + '</span>';
  }

  syncCompareContextIndicator(mc, activeSnapshot ? activeSnapshot.signature : '');
}
var pinSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1C8.55228 1 9 1.44772 9 2V7.586L12.707 3.879C13.098 3.488 13.731 3.488 14.121 3.879C14.512 4.269 14.512 4.902 14.121 5.293L9 10.414V14C9 14.5523 8.55228 15 8 15C7.44772 15 7 14.5523 7 14V10.414L1.879 5.293C1.488 4.902 1.488 4.269 1.879 3.879C2.269 3.488 2.902 3.488 3.293 3.879L7 7.586V2C7 1.44772 7.44772 1 8 1Z"/></svg>';
var diffSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4h5v1H2V4zm0 3h5v1H2V7zm0 3h5v1H2v-1zm9-6h5v1h-5V4zm0 3h5v1h-5V7zm0 3h5v1h-5v-1zM8 1v14l-1-1V2l1-1z"/></svg>';

function showCompareSettings() {
  var old = document.getElementById('compareSettingsOverlay');
  if (old) old.remove();

  var draft = cloneCompareSettings(compareSettings);
  var overlay = document.createElement('div');
  overlay.id = 'compareSettingsOverlay';
  overlay.className = 'dirty-confirm-overlay';
  overlay.innerHTML =
    '<div class="dirty-confirm-dialog compare-settings-dialog">' +
      '<div class="dirty-confirm-msg">' + escapeHtml(tr('webview.comparisonSettings')) + '</div>' +
      '<div class="compare-settings-grid">' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.mode')) + '</label>' +
          '<div class="compare-mode-options">' +
            '<button class="compare-mode-chip' + (draft.mode === 'raw' ? ' active' : '') + '" data-mode="raw">' + escapeHtml(tr('webview.modeRaw')) + '</button>' +
            '<button class="compare-mode-chip' + (draft.mode === 'normalized' ? ' active' : '') + '" data-mode="normalized">' + escapeHtml(tr('webview.modeNormalized')) + '</button>' +
            '<button class="compare-mode-chip' + (draft.mode === 'pretty' ? ' active' : '') + '" data-mode="pretty">' + escapeHtml(tr('webview.modePretty')) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label><input type="checkbox" class="js-compare-metadata"' + (draft.includeMetadataSummary ? ' checked' : '') + '/> ' + escapeHtml(tr('webview.includeMetadata')) + '</label>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label><input type="checkbox" class="js-compare-fold-unchanged"' + (draft.foldUnchangedSections ? ' checked' : '') + '/> ' + escapeHtml(tr('webview.compareFoldUnchanged')) + '</label>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.ignoredHeaders')) + '</label>' +
          '<input type="text" class="compare-settings-input js-compare-ignore-headers" value="' + escapeAttr(draft.ignoreHeaders.join(', ')) + '"/>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.ignoredJsonPaths')) + '</label>' +
          '<input type="text" class="compare-settings-input js-compare-ignore-paths" value="' + escapeAttr(draft.ignoreJsonPaths.join(', ')) + '"/>' +
        '</div>' +
        '<div class="compare-settings-note">' + escapeHtml(tr('webview.normalizedModeNote')) + '</div>' +
      '</div>' +
      '<div class="dirty-confirm-actions compare-settings-actions">' +
        '<button class="dirty-btn dirty-btn-discard" data-action="reset">' + escapeHtml(tr('webview.reset')) + '</button>' +
        '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
        '<button class="dirty-btn dirty-btn-save" data-action="save">' + escapeHtml(tr('webview.save')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  overlay.querySelectorAll('.compare-mode-chip').forEach(function(button) {
    button.addEventListener('click', function(event) {
      event.preventDefault();
      draft.mode = button.dataset.mode;
      overlay.querySelectorAll('.compare-mode-chip').forEach(function(chip) {
        chip.classList.toggle('active', chip === button);
      });
    });
  });

  overlay.addEventListener('click', function(event) {
    var target = event.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    if (action === 'cancel') {
      overlay.remove();
      return;
    }

    if (action === 'reset') {
      overlay.remove();
      compareSettings = cloneCompareSettings({
        mode: 'normalized',
        includeMetadataSummary: true,
        foldUnchangedSections: DEFAULT_COMPARE_FOLD_UNCHANGED,
        ignoreHeaders: DEFAULT_COMPARE_IGNORE_HEADERS,
        ignoreJsonPaths: DEFAULT_COMPARE_IGNORE_JSON_PATHS
      });
      renderContent();
      debouncePersist();
      return;
    }

    draft.includeMetadataSummary = !!overlay.querySelector('.js-compare-metadata')?.checked;
    draft.foldUnchangedSections = !!overlay.querySelector('.js-compare-fold-unchanged')?.checked;
    draft.ignoreHeaders = normalizeCompareList(
      overlay.querySelector('.js-compare-ignore-headers')?.value || '',
      []
    );
    draft.ignoreJsonPaths = normalizeCompareList(
      overlay.querySelector('.js-compare-ignore-paths')?.value || '',
      []
    );
    compareSettings = normalizeCompareSettings(draft);
    overlay.remove();
    renderContent();
    debouncePersist();
  });
}

function switchResponseTabInContent(mc, tabName) {
  if (!mc) return;
  const tab = tabs.find(function(tt) { return tt.id === activeTabId; });
  if (tab) {
    tab.responseTab = tabName;
    debouncePersist();
  }
  mc.querySelectorAll('.js-res-tabs .tab').forEach(function(x) {
    var isActive = x.dataset.tab === tabName;
    x.classList.toggle('active', isActive);
    x.setAttribute('aria-selected', isActive ? 'true' : 'false');
    x.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  const isBody = tabName === 'resBody';
  const isPreview = tabName === 'resPreview';

  mc.querySelectorAll('.js-res-body').forEach(function(el) {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  });
  var hideResponsePanel = function(selector) {
    var panel = mc.querySelector(selector);
    if (!panel) return;
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
  };
  hideResponsePanel('.js-res-headers');
  hideResponsePanel('.js-res-cookies');
  hideResponsePanel('.js-res-tests');
  const preview = mc.querySelector('.js-res-preview');
  if (preview) {
    preview.classList.add('hidden');
    preview.setAttribute('aria-hidden', 'true');
  }
  const toolbar = mc.querySelector('.js-res-body-toolbar');
  if (toolbar) toolbar.classList.add('hidden');

  if (isBody) {
    if (toolbar) toolbar.classList.remove('hidden');
    const tree = mc.querySelector('.js-res-tree');
    const raw = mc.querySelector('.js-res-raw');
    if (tree) {
      const mode = toolbar?.querySelector('.toggle-btn.active')?.dataset.mode || 'tree';
      tree.classList.toggle('hidden', mode !== 'tree');
      tree.setAttribute('aria-hidden', mode === 'tree' ? 'false' : 'true');
      if (raw) raw.classList.toggle('hidden', mode !== 'raw');
      if (raw) raw.setAttribute('aria-hidden', mode === 'raw' ? 'false' : 'true');
    } else if (raw) {
      raw.classList.remove('hidden');
      raw.setAttribute('aria-hidden', 'false');
    }
  } else if (tabName === 'resHeaders') {
    var headersPanel = mc.querySelector('.js-res-headers');
    if (headersPanel) {
      headersPanel.classList.remove('hidden');
      headersPanel.setAttribute('aria-hidden', 'false');
    }
  } else if (tabName === 'resCookies') {
    var cookiesPanel = mc.querySelector('.js-res-cookies');
    if (cookiesPanel) {
      cookiesPanel.classList.remove('hidden');
      cookiesPanel.setAttribute('aria-hidden', 'false');
    }
  } else if (tabName === 'resTests') {
    var testsPanel = mc.querySelector('.js-res-tests');
    if (testsPanel) {
      testsPanel.classList.remove('hidden');
      testsPanel.setAttribute('aria-hidden', 'false');
    }
  } else if (isPreview && preview) {
    preview.classList.remove('hidden');
    preview.setAttribute('aria-hidden', 'false');
    if (tab?.response?.body) {
      syncPreviewFrame(preview, tab);
    }
  }

  if (tabName === 'resBody') {
    syncResponseSearch(mc);
  }
}

function handleResponseTabKeydown(mc, event) {
  var target = event.target?.closest?.('.js-res-tabs .tab');
  if (!target || !mc.contains(target)) return;
  var tabEls = Array.prototype.slice.call(mc.querySelectorAll('.js-res-tabs .tab'));
  var index = tabEls.indexOf(target);
  if (index < 0) return;
  var nextIndex = -1;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (index + 1) % tabEls.length;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (index - 1 + tabEls.length) % tabEls.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = tabEls.length - 1;
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    switchResponseTabInContent(mc, target.dataset.tab);
    return;
  } else {
    return;
  }
  event.preventDefault();
  var next = tabEls[nextIndex];
  if (!next) return;
  switchResponseTabInContent(mc, next.dataset.tab);
  next.focus();
}

function responseTabMarkup(tabName, label, active, controls, count) {
  var id = 'responseTab-' + tabName;
  var countHtml = count == null ? '' : ' <span class="tab-count">' + count + '</span>';
  return '<div class="tab' + (active ? ' active' : '') + '" id="' + id + '" data-tab="' + tabName + '" role="tab" tabindex="' + (active ? '0' : '-1') + '" aria-selected="' + (active ? 'true' : 'false') + '" aria-controls="' + controls + '">' + escapeHtml(label) + countHtml + '</div>';
}

function focusResponseSearchField() {
  const input = mainContent.querySelector('.js-response-search');
  if (!input || input.closest('.hidden')) return false;
  input.focus();
  input.select?.();
  return true;
}

function buildResponseStatusLine(response) {
  if (!response) return '';
  return response.status + ' ' + (response.statusText || '');
}

function buildRawResponseHeaders(response) {
  if (!response?.headers) return '';
  return Object.entries(response.headers).map(function(entry) {
    return entry[0] + ': ' + entry[1];
  }).join('\\n');
}

function renderResponseStat(label, value, tone, detail) {
  return '<div class="response-stat-card' + (tone ? ' ' + tone : '') + '">' +
    '<div class="response-stat-label">' + escapeHtml(label) + '</div>' +
    '<div class="response-stat-value">' + escapeHtml(value) + '</div>' +
    (detail ? '<div class="response-stat-detail">' + escapeHtml(detail) + '</div>' : '') +
  '</div>';
}

function renderInlineEmptyState(_kicker, title, copy) {
  return '<div class="empty-state inline">' +
    '<div class="empty-state-title">' + escapeHtml(title) + '</div>' +
    '<div class="empty-state-copy">' + escapeHtml(copy) + '</div>' +
  '</div>';
}

function isPreviewSafeUrl(value) {
  return value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:');
}

function isPreviewUrlAttribute(name) {
  return ['src', 'href', 'xlink:href', 'srcset', 'poster', 'action', 'formaction', 'background', 'ping'].indexOf(name) >= 0;
}

function countPreviewExternalAssets(doc) {
  var count = 0;
  doc.querySelectorAll('*').forEach(function(el) {
    Array.from(el.attributes).forEach(function(attr) {
      var name = attr.name.toLowerCase();
      if (!isPreviewUrlAttribute(name)) return;
      var value = String(attr.value || '').trim();
      if (!value || (name !== 'ping' && isPreviewSafeUrl(value))) return;
      count += 1;
    });
  });
  return count;
}

function sanitizePreviewDocument(doc) {
  doc.querySelectorAll('script, style, noscript, iframe, object, embed, link, source, audio, video, track, base, set, animate, meta[http-equiv="refresh"]').forEach(function(node) {
    node.remove();
  });
  doc.querySelectorAll('*').forEach(function(el) {
    Array.from(el.attributes).forEach(function(attr) {
      var name = attr.name.toLowerCase();
      var value = String(attr.value || '').trim();
      if (name.startsWith('on') || name === 'style' || name === 'srcset' || name === 'ping') {
        el.removeAttribute(attr.name);
        return;
      }
      if (isPreviewUrlAttribute(name) && value && !isPreviewSafeUrl(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
}

function extractPreviewDescription(doc) {
  var meta = doc.querySelector('meta[name="description"], meta[property="og:description"]');
  if (meta && meta.getAttribute('content')) {
    return meta.getAttribute('content').trim();
  }
  var bodyText = collapseWhitespace((doc.body && doc.body.textContent) || '');
  return bodyText ? truncate(bodyText, 220) : '';
}

function buildPreviewPayload(rawHtml) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(rawHtml || '', 'text/html');
  var blockedAssets = countPreviewExternalAssets(doc);
  sanitizePreviewDocument(doc);

  var docLang = (doc.documentElement && doc.documentElement.getAttribute('lang')) || currentDisplayLanguage || 'en';
  var title = ((doc.querySelector('title') && doc.querySelector('title').textContent) || '').trim() || tr('webview.preview');
  var description = extractPreviewDescription(doc);
  var bodyHtml = (doc.body && doc.body.innerHTML ? doc.body.innerHTML.trim() : '');
  var bodyText = collapseWhitespace((doc.body && doc.body.textContent) || '');
  var hasStaticSnapshot = !!bodyHtml && bodyText.length >= 24;

  return {
    docLang: docLang,
    title: title,
    description: description,
    bodyHtml: bodyHtml,
    blockedAssets: blockedAssets,
    hasStaticSnapshot: hasStaticSnapshot,
  };
}

function hasMeaningfulStaticPreview(rawHtml) {
  return buildPreviewPayload(rawHtml).hasStaticSnapshot;
}

function hasHtmlPreview(tab) {
  if (!tab?.response) return false;
  var contentType = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (contentType.indexOf('html') < 0) return false;
  return hasMeaningfulStaticPreview(tab.response.body || '');
}

function buildPreviewDocument(rawHtml, resolvedUrl) {
  var payload = buildPreviewPayload(rawHtml);
  var docLang = payload.docLang;
  var title = payload.title;
  var description = payload.description;
  var bodyHtml = payload.bodyHtml;
  var hasStaticSnapshot = payload.hasStaticSnapshot;
  var blockedAssetsLabel = tf('webview.previewOfflineBlockedAssets', { count: String(payload.blockedAssets) });

  return '<div class="preview-shell" lang="' + escapeAttr(docLang) + '">' +
    '<div class="preview-kicker">' + escapeHtml(tr('webview.previewOfflineTitle')) + '</div>' +
    '<h1 class="preview-title">' + escapeHtml(title) + '</h1>' +
    '<p class="preview-copy">' + escapeHtml(tr('webview.previewOfflineCopy')) + '</p>' +
    '<div class="preview-grid">' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineSource')) + '</div>' +
        '<div class="preview-card-value">' + escapeHtml(resolvedUrl || '') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineDescription')) + '</div>' +
        '<div class="preview-card-value' + (description ? '' : ' muted') + '">' + escapeHtml(description || '-') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(blockedAssetsLabel) + '</div>' +
        '<div class="preview-card-value" data-testid="preview-blocked-assets">' + escapeHtml(String(payload.blockedAssets)) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="preview-section">' +
      '<div class="preview-section-title">' + escapeHtml(tr('webview.previewOfflineStaticSnapshot')) + '</div>' +
      (hasStaticSnapshot
        ? '<div class="preview-snapshot">' + bodyHtml + '</div>'
        : '<div class="preview-empty">' + escapeHtml(tr('webview.previewOfflineNoStatic')) + '</div>') +
    '</div>' +
  '</div>';
}

function buildPreviewDocKey(tab) {
  if (!tab || !tab.response) return '';
  var body = tab.response.body || '';
  return [
    tab.response.status || 0,
    tab.response.size || 0,
    tab.resolvedUrl || tab.url || '',
    body.length,
    body.slice(0, 120)
  ].join('|');
}

function syncPreviewFrame(preview, tab) {
  if (!preview || !tab?.response) return;
  var key = buildPreviewDocKey(tab);
  if (preview.dataset.previewKey === key) return;
  preview.innerHTML = buildPreviewDocument(tab.response.body || '', tab.resolvedUrl || tab.url || '');
  preview.dataset.previewKey = key;
}

function buildHttpResponseAreaHtml(tab) {
  if (tab.loading) {
    return '<div class="res-empty-shell">' +
      '<div class="js-loading-summary" style="padding:6px"><span class="spinner"></span>' + escapeHtml(tr('webview.loading')) + '</div>' +
      '<div class="request-stage-hint" style="padding:0 6px 6px">' + escapeHtml(tr('webview.loading.hint')) + '</div>' +
      '<div class="skeleton-loader"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>' +
    '</div>';
  } else if (tab.error) {
    return '<div class="res-empty-shell">' + buildResponseTimingMetaHtml(tab) + '<div class="error-msg">' + escapeHtml(tab.error) + '</div></div>';
  } else if (tab.response) {
    const r = tab.response;
    const sc = Math.floor(r.status / 100);
    const ct = (r.headers?.['content-type'] || r.headers?.['Content-Type'] || '').toLowerCase();
    const isBinary = !!r.bodyBase64 && isBinaryContentType(ct);
    const displayBody = isBinary
      ? tr('webview.binaryResponse')
      : r.body;
    const lang = isBinary ? 'text' : detectLang(ct, displayBody);
    const searchState = getResponseSearchState(tab);
    const displayBodyText = isBinary
      ? displayBody
      : getDisplayResponseBody(tab, lang, displayBody);
    const rawBodyHtml = isBinary
      ? escapeHtml(displayBodyText)
      : (lang === 'xml' && !searchState.query
          ? renderXmlBodyWithPaths(displayBodyText)
          : renderResponseBody(displayBodyText, lang, searchState.query, searchState.index, searchState));
    
    const headerEntries = Object.entries(r.headers);
    const headerCount = headerEntries.length;
    let headersTableHtml = '<table class="res-header-table">' +
      '<thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.key')) + '</th><th>' + escapeHtml(tr('webview.value')) + '</th></tr></thead><tbody>';
    for (const [k,v] of headerEntries) {
      headersTableHtml += '<tr><td class="res-header-key">' + escapeHtml(k) + '</td>' +
        '<td class="res-header-value" title="' + escapeAttr(String(v)) + '">' + escapeHtml(String(v)) + '</td></tr>';
    }
    headersTableHtml += '</tbody></table>';

    
    
    
    let allCookieStrs = [];
    if (r.rawSetCookies && r.rawSetCookies.length > 0) {
      allCookieStrs = r.rawSetCookies;
    } else {
      const cookieHeader = headerEntries
        .filter(([k]) => k.toLowerCase() === 'set-cookie')
        .map(([,v]) => String(v))
        .join(', ');
      if (cookieHeader) {
        
        allCookieStrs = cookieHeader.split(/,\\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/);
      }
    }
    const cookieCount = allCookieStrs.length;
    let cookiesTableHtml = '';
    if (cookieCount > 0) {
      cookiesTableHtml = '<table class="res-header-table res-cookie-table">' +
        '<thead><tr><th>Name</th><th>Value</th><th>Domain</th><th>Path</th><th>Expires</th><th>HttpOnly</th><th>Secure</th></tr></thead><tbody>';
      for (const cs of allCookieStrs) {
        const parts = cs.split(';').map(function(s) { return s.trim(); });
        const nameVal = parts[0] || '';
        const eqIdx = nameVal.indexOf('=');
        const cName = eqIdx >= 0 ? nameVal.substring(0, eqIdx) : nameVal;
        const cValue = eqIdx >= 0 ? nameVal.substring(eqIdx + 1) : '';
        let domain = '', path = '', expires = '', httpOnly = false, secure = false;
        for (let i = 1; i < parts.length; i++) {
          const attr = parts[i];
          const attrLower = attr.toLowerCase();
          if (attrLower.startsWith('domain=')) domain = attr.substring(7);
          else if (attrLower.startsWith('path=')) path = attr.substring(5);
          else if (attrLower.startsWith('expires=')) expires = attr.substring(8);
          else if (attrLower.startsWith('max-age=')) { if (!expires) expires = 'max-age=' + attr.substring(8); }
          else if (attrLower === 'httponly') httpOnly = true;
          else if (attrLower === 'secure') secure = true;
        }
        cookiesTableHtml += '<tr>' +
          '<td class="res-header-key">' + escapeHtml(cName) + '</td>' +
          '<td class="res-header-value" title="' + escapeAttr(cValue) + '">' + escapeHtml(cValue) + '</td>' +
          '<td>' + escapeHtml(domain) + '</td>' +
          '<td>' + escapeHtml(path) + '</td>' +
          '<td>' + escapeHtml(expires) + '</td>' +
          '<td>' + (httpOnly ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
          '<td>' + (secure ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
        '</tr>';
      }
      cookiesTableHtml += '</tbody></table>';
    }
    const previewAvailable = lang === 'html' && hasHtmlPreview(tab);
    const activeResponseTab = tab.responseTab === 'resPreview' && !previewAvailable
      ? 'resBody'
      : tab.responseTab === 'resCookies' && cookieCount === 0
        ? 'resBody'
        : tab.responseTab || 'resBody';
    const showBody = activeResponseTab === 'resBody';
    const showCookies = activeResponseTab === 'resCookies';
    const showHeaders = activeResponseTab === 'resHeaders';
    const showTests = activeResponseTab === 'resTests';
    const showPreview = activeResponseTab === 'resPreview';
    const hasFormat = (lang === 'json' || lang === 'xml');
    const currentSnapshot = createResponseSnapshot(tab, tab.response, '');
    const currentSignature = currentSnapshot?.signature || '';
    const formatStyle = lang === 'xml'
      ? (tab.xmlFormatStyle || 'inline')
      : (tab.jsonFormatStyle || 'pretty');
    const formatIndent = tab.formatIndent || '2';
    const fmtMenuHtml = hasFormat
      ? '<div class="fmt-wrap">' +
          '<button class="tb-btn ripple-btn js-fmt-btn">' + escapeHtml(tr('webview.format')) + '</button>' +
          '<div class="fmt-menu js-fmt-menu">' +
            '<div class="fmt-menu-label">' + escapeHtml(tr('webview.style')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="pretty"><span class="check">' + (formatStyle === 'pretty' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.pretty')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="compact"><span class="check">' + (formatStyle === 'compact' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.compact')) + '</div>' +
            (lang === 'xml' ? '<div class="fmt-menu-item js-fmt-style" data-style="inline"><span class="check">' + (formatStyle === 'inline' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.inlineChildren')) + '</div>' : '') +
            '<div class="fmt-menu-sep"></div>' +
            '<div class="fmt-menu-label">' + escapeHtml(tr('webview.indent')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="2"><span class="check">' + (formatIndent === '2' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.twoSpaces')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="4"><span class="check">' + (formatIndent === '4' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.fourSpaces')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="tab"><span class="check">' + (formatIndent === 'tab' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.tabIndent')) + '</div>' +
          '</div>' +
        '</div>'
      : '';
    const searchToolbarHtml = !isBinary
      ? '<div class="response-search-wrap js-response-search-wrap">' +
          '<input class="response-search-input js-response-search" type="text" value="' + escapeAttr(searchState.query) + '" placeholder="' + escapeAttr(tr('webview.searchPlaceholder')) + '" />' +
          '<button class="tb-btn js-response-search-case' + (searchState.caseSensitive ? ' active' : '') + '" type="button" title="' + escapeAttr(tr('webview.searchCaseSensitive')) + '">Aa</button>' +
          '<button class="tb-btn js-response-search-regex' + (searchState.regex ? ' active' : '') + '" type="button" title="' + escapeAttr(tr('webview.searchRegex')) + '">.*</button>' +
          '<span class="response-search-count js-response-search-count"></span>' +
          '<button class="tb-btn js-response-search-prev" type="button" title="' + escapeAttr(tr('webview.searchPrev')) + '">&#8593;</button>' +
          '<button class="tb-btn js-response-search-next" type="button" title="' + escapeAttr(tr('webview.searchNext')) + '">&#8595;</button>' +
          '<button class="tb-btn js-response-search-clear" type="button" title="' + escapeAttr(tr('webview.searchClear')) + '">&times;</button>' +
        '</div>'
      : '';
    const pathHintHtml = lang === 'json'
      ? '<span class="response-path-hint">' + escapeHtml(tr('webview.jsonPathHint')) + '</span>'
      : (lang === 'xml' && !searchState.query
        ? '<span class="response-path-hint">' + escapeHtml(tr('webview.xpathHint')) + '</span>'
        : '');
    const toolbarHtml = !isBinary
      ? '<div class="res-body-toolbar js-res-body-toolbar' + (showBody ? '' : ' hidden') + '" data-lang="' + lang + '">' +
          (lang === 'json'
              ? '<div class="toggle-group">' +
                  '<button class="toggle-btn active" data-mode="tree">' + escapeHtml(tr('webview.tree')) + '</button>' +
                  '<button class="toggle-btn" data-mode="raw">' + escapeHtml(tr('webview.raw')) + '</button>' +
                '</div>' +
              '<button class="tb-btn js-expand-all" title="' + escapeAttr(tr('webview.expand')) + '">' + escapeHtml(tr('webview.expand')) + '</button>' +
              '<button class="tb-btn js-collapse-all" title="' + escapeAttr(tr('webview.collapse')) + '">' + escapeHtml(tr('webview.collapse')) + '</button>'
            : '') +
          fmtMenuHtml +
          pathHintHtml +
          searchToolbarHtml +
        '</div>'
      : '';
    
    const resolvedUrlDisplay = tab.resolvedUrl
      ? '<div class="resolved-url js-resolved-url" title="' + escapeAttr(tr('webview.clickToCopy') + ': ' + tab.resolvedUrl) + '">' + escapeHtml(tab.resolvedUrl) + '</div>'
      : '';
    const responseToneClass = 'response-tone-' + sc + 'xx';
    const compareCueText = buildCompareContextCueText();
    const compareQuietHtml = compareCueText
      ? '<span class="compare-active-indicator js-compare-chip-row">' + escapeHtml(compareCueText) + '</span>'
      : '<span class="js-compare-chip-row visually-hidden">' + buildCompareChipMarkup(currentSignature) + '</span>';
    const pinCountSuffix = pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '';
    const compareReady = pinnedResponses.length >= 2;
    const compareTitle = compareReady
      ? tr('webview.comparePinned') + ' ' + compareModeShort(compareSettings.mode) + pinCountSuffix
      : tr('webview.compareNeedsPin');
    const responseFormatValue = (lang === 'text' ? 'TEXT' : lang.toUpperCase());
    const statusText = r.statusText ? ' ' + r.statusText : '';
    const sepHtml = '<span class="stat-sep">\u00B7</span>';
    const durationMs = getResponseDurationMs(tab, r.time);
    const durationText = formatDurationMs(durationMs) || (String(r.time) + ' ms');
    const durationTitle = durationMs === null ? durationText : String(durationMs) + ' ms';
    const responseTimingMetaHtml = buildResponseTimingMetaHtml(tab);
    const responseStatsHtml =
      '<div class="response-stat-inline" title="' + escapeAttr(String(r.status) + statusText + ' - ' + durationTitle + ' - ' + formatSize(r.size) + ' - ' + responseFormatValue) + '">' +
        '<span class="stat-status status-' + sc + 'xx" data-testid="response-status">' + escapeHtml(String(r.status) + statusText) + '</span>' +
        sepHtml +
        '<span class="stat-time" title="' + escapeAttr(durationTitle) + '">' + escapeHtml(durationText) + '</span>' +
        sepHtml +
        '<span class="stat-size">' + escapeHtml(formatSize(r.size)) + '</span>' +
        sepHtml +
        '<span class="stat-format">' + escapeHtml(responseFormatValue) + '</span>' +
      '</div>';
    const testResults = tab.scriptResults?.tests || [];
    const failedTests = testResults.filter(function(test) { return !test.passed; });
    const passedCount = testResults.length - failedTests.length;
    const logCount = (tab.scriptResults?.logs || []).length;
    const firstFailedTest = failedTests[0] || null;
    const testsSummaryHtml = testResults.length > 0
      ? '<div class="test-summary">' +
          '<span class="test-badge pass">' + escapeHtml(tfCount('webview.testSummaryPass', passedCount)) + '</span>' +
          '<span class="test-badge fail">' + escapeHtml(tfCount('webview.testSummaryFail', failedTests.length)) + '</span>' +
          '<span class="test-badge log">' + escapeHtml(tfCount('webview.testSummaryLogs', logCount)) + '</span>' +
        '</div>'
      : '';
    const testsAlertHtml = testResults.length === 0
      ? ''
      : (failedTests.length === 0
        ? '<div class="test-alert pass"><div class="test-alert-title">' + escapeHtml(tr('webview.testSummaryAllPassed')) + '</div></div>'
        : '<div class="test-alert fail">' +
            '<div class="test-alert-title">' + escapeHtml(tr('webview.testSummaryFirstFailure')) + '</div>' +
            '<div>' + escapeHtml(firstFailedTest?.name || '') + (firstFailedTest?.error ? ' - ' + escapeHtml(firstFailedTest.error) : '') + '</div>' +
          '</div>');
    return '<div class="res-response-shell">' +
      '<div class="res-sticky-shell">' +
      '<div class="response-summary">' +
      '<div class="response-summary-card ' + responseToneClass + '">' +
        responseStatsHtml +
        '<div class="response-action-cluster">' +
          compareQuietHtml +
          '<button class="pin-response-btn js-pin-response" data-testid="response-pin" type="button" title="' + escapeAttr(tr('webview.pinResponse') + pinCountSuffix) + '" aria-label="' + escapeAttr(tr('webview.pin') + pinCountSuffix) + '">' + pinSvg + '<span class="action-label">' + escapeHtml(tr('webview.pin') + pinCountSuffix) + '</span></button>' +
          '<button class="compare-btn js-compare-responses' + (compareReady ? ' ready' : '') + '" data-testid="response-compare" type="button" title="' + escapeAttr(compareTitle) + '" aria-label="' + escapeAttr(tr('webview.compare')) + '"' + (compareReady ? '' : ' disabled') + '>' + diffSvg + '<span class="action-label">' + escapeHtml(tr('webview.compare')) + '</span></button>' +
          '<div class="actions-more-wrap">' +
            '<button class="res-action-btn js-actions-more-btn" data-testid="response-overflow" type="button" title="' + escapeAttr(tr('webview.more') || 'More') + '" aria-label="' + escapeAttr(tr('webview.more') || 'More') + '" aria-haspopup="menu" aria-expanded="false" aria-controls="responseActionsMoreMenu"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg></button>' +
            '<div class="actions-more-menu js-actions-more-menu" id="responseActionsMoreMenu" role="menu">' +
              '<button class="res-action-btn js-copy-response" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyResponse')) + '"><span class="action-label">' + escapeHtml(tr('webview.copy')) + '</span></button>' +
              ((tab.resolvedUrl || tab.url) ? '<button class="res-action-btn js-copy-response-url" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyUrl')) + '"><span class="action-label">' + escapeHtml(tr('webview.copyUrl')) + '</span></button>' : '') +
              '<button class="res-action-btn js-save-response" type="button" role="menuitem" title="' + escapeAttr(tr('webview.saveResponse')) + '"><span class="action-label">' + escapeHtml(tr('webview.save')) + '</span></button>' +
              '<button class="res-action-btn js-copy-response-status" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyStatus')) + '"><span class="action-label">' + escapeHtml(tr('webview.copyStatus')) + '</span></button>' +
              '<button class="res-action-btn js-copy-response-headers" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyHeadersRaw')) + '"><span class="action-label">' + escapeHtml(tr('webview.copyHeadersRaw')) + '</span></button>' +
              ((lang === 'html' && (tab.resolvedUrl || tab.url))
                ? '<button class="res-action-btn js-open-response-url" type="button" role="menuitem" title="' + escapeAttr(tr('webview.openUrl')) + '"><span class="action-label">' + escapeHtml(tr('webview.openUrl')) + '</span></button>'
                : '') +
              '<button class="res-action-btn js-compare-last" type="button" role="menuitem" title="' + escapeAttr(tr('webview.compareLast')) + '"' + (!lastResponse ? ' disabled' : '') + '><span class="action-label">' + escapeHtml(tr('webview.last')) + '</span></button>' +
              '<button class="res-action-btn js-compare-settings" type="button" role="menuitem" title="' + escapeAttr(tr('webview.comparisonSettings')) + '"><span class="action-label">' + escapeHtml(tr('webview.mode')) + ': ' + escapeHtml(compareModeShort(compareSettings.mode)) + '</span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="response-context-row">' +
        resolvedUrlDisplay +
      '</div>' +
      responseTimingMetaHtml +
      '</div>' +
      '<div class="tabs js-res-tabs" role="tablist" aria-label="' + escapeAttr(tr('webview.responseTabs')) + '">' +
        responseTabMarkup('resBody', tr('webview.body'), showBody, 'responseBodyPanel') +
        responseTabMarkup('resCookies', tr('webview.cookies'), showCookies, 'responseCookiesPanel', cookieCount > 0 ? cookieCount : null) +
        responseTabMarkup('resHeaders', tr('webview.headers'), showHeaders, 'responseHeadersPanel', headerCount) +
        responseTabMarkup('resTests', tr('webview.tests'), showTests, 'responseTestsPanel', (tab.scriptResults?.tests?.length || 0) > 0 ? tab.scriptResults.tests.length : null) +
        (previewAvailable ? responseTabMarkup('resPreview', tr('webview.preview'), showPreview, 'responsePreviewPanel') : '') +
      '</div>' +
      toolbarHtml +
      '</div>' +
      (lang === 'json' ? '<div id="responseBodyPanel" role="tabpanel" aria-labelledby="responseTab-resBody" aria-hidden="' + (showBody ? 'false' : 'true') + '" class="json-tree js-res-tree js-res-body' + (showBody ? '' : ' hidden') + '" data-testid="response-body-tree"></div>' : '') +
      '<div id="' + (lang === 'json' ? 'responseRawPanel' : 'responseBodyPanel') + '"' + (lang === 'json' ? '' : ' role="tabpanel" aria-labelledby="responseTab-resBody"') + ' aria-hidden="' + (lang === 'json' || !showBody ? 'true' : 'false') + '" class="json-body js-res-raw js-res-body' + ((lang === 'json' || !showBody) ? ' hidden' : '') + '" data-testid="response-body">' + rawBodyHtml + '</div>' +
      '<div id="responseHeadersPanel" role="tabpanel" aria-labelledby="responseTab-resHeaders" aria-hidden="' + (showHeaders ? 'false' : 'true') + '" class="res-headers-panel' + (showHeaders ? '' : ' hidden') + ' js-res-headers">' +
        (tab.resolvedHeaders && tab.resolvedHeaders.length
          ? '<div class="resolved-headers-section"><div class="resolved-headers-title">' + escapeHtml(tr('webview.requestHeadersResolved')) + '</div>' +
            '<table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.key')) + '</th><th>' + escapeHtml(tr('webview.value')) + '</th></tr></thead><tbody>' +
            tab.resolvedHeaders.map(function(h) {
              return '<tr><td class="res-header-key">' + escapeHtml(h.key) + '</td><td class="res-header-value" title="' + escapeAttr(h.value) + '">' + escapeHtml(h.value) + '</td></tr>';
            }).join('') +
            '</tbody></table></div><div class="resolved-headers-title" style="margin-top:8px">' + escapeHtml(tr('webview.responseHeaders')) + '</div>'
          : '') +
        headersTableHtml +
      '</div>' +
      '<div id="responseCookiesPanel" role="tabpanel" aria-labelledby="responseTab-resCookies" aria-hidden="' + (showCookies ? 'false' : 'true') + '" class="res-cookies-panel' + (showCookies ? '' : ' hidden') + ' js-res-cookies">' +
        (cookieCount > 0 ? cookiesTableHtml : renderInlineEmptyState(tr('webview.inline.response.noCookies.kicker'), tr('webview.inline.response.noCookies.title'), tr('webview.inline.response.noCookies.copy'))) +
      '</div>' +
      '<div id="responseTestsPanel" role="tabpanel" aria-labelledby="responseTab-resTests" aria-hidden="' + (showTests ? 'false' : 'true') + '" class="res-headers-panel' + (showTests ? '' : ' hidden') + ' js-res-tests" data-testid="response-tests">' +
        (testResults.length > 0
          ? testsSummaryHtml +
            testsAlertHtml +
            '<table class="res-header-table" data-testid="response-tests-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.test')) + '</th><th>' + escapeHtml(tr('webview.result')) + '</th></tr></thead><tbody>' +
            testResults.map(function(test) {
              var status = test.passed ? tr('webview.testResult.pass') : tr('webview.testResult.fail');
              var detail = test.passed ? tr('webview.testResult.passed') : (test.error || tr('webview.testResult.failed'));
              return '<tr class="' + (test.passed ? 'test-row-pass' : 'test-row-fail') + '" data-testid="response-test-row"><td class="res-header-key">' + escapeHtml(test.name) + '</td><td class="res-header-value" title="' + escapeAttr(detail) + '">' + escapeHtml(status + ' - ' + detail) + '</td></tr>';
            }).join('') +
            '</tbody></table>' +
            ((tab.scriptResults.logs || []).length > 0
              ? '<div class="resolved-headers-title" style="margin-top:4px">' + escapeHtml(tr('webview.scriptLogs')) + '</div><table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.level')) + '</th><th>' + escapeHtml(tr('webview.message')) + '</th></tr></thead><tbody>' +
                tab.scriptResults.logs.map(function(log) {
                  return '<tr><td class="res-header-key">' + escapeHtml(log.level.toUpperCase()) + '</td><td class="res-header-value" title="' + escapeAttr(log.message) + '">' + escapeHtml(log.message) + '</td></tr>';
                }).join('') +
                '</tbody></table>'
              : '')
          : renderInlineEmptyState(tr('webview.inline.tests.none.kicker'), tr('webview.inline.tests.none.title'), tr('webview.inline.tests.none.copy'))) +
      '</div>' +
      (previewAvailable ? '<div id="responsePreviewPanel" role="tabpanel" aria-labelledby="responseTab-resPreview" aria-hidden="' + (showPreview ? 'false' : 'true') + '" class="res-preview' + (showPreview ? '' : ' hidden') + ' js-res-preview"></div>' : '') +
      '</div>';
  } else {
    return '<div class="res-empty-shell">' + buildResponseTimingMetaHtml(tab) + (tab.url
      ? renderEmptyState(
          tr('webview.empty.response.title'),
          tr('webview.empty.response.copy'),
          [
            { label: tr('webview.emptyActionFocusUrl'), action: 'focus-url' },
            { label: tr('webview.emptyActionGuide'), action: 'open-guide' }
          ]
        )
      : renderEmptyState(
          tr('webview.empty.request.title'),
          tr('webview.empty.request.copy'),
          [
            { label: tr('webview.emptyActionSample'), action: 'sample-request' },
            { label: tr('webview.openEnvironmentPicker'), action: 'switch-environment' },
            { label: tr('webview.emptyActionGuide'), action: 'open-guide' }
          ]
        )) + '</div>';
  }
}

function bindResponseViewerEvents(mc) {
  mc.querySelector('.js-copy-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    var opts = getFormatOptions(mc);
    var body = tab.response.body;
    if (opts) {
      if (opts.lang === 'json') body = formatJson(body, opts.style, opts.indent);
      else if (opts.lang === 'xml') body = formatXml(body, opts.style, opts.indent);
    }
    vscode.postMessage({ type: 'copyResponseBody', body: body });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });
  mc.querySelector('.js-res-raw')?.addEventListener('click', function(event) {
    var target = event.target.closest('.js-copy-xml-path') || event.target.closest('.xml-path-line[data-copy-path]');
    if (!target || !target.dataset.copyPath) return;
    event.preventDefault();
    vscode.postMessage({ type: 'copyToClipboard', text: target.dataset.copyPath });
    if (target.classList.contains('js-copy-xml-path')) {
      showBtnFeedback(target, tr('webview.copied'), 1000);
    }
  });
  mc.querySelector('.js-copy-response-url')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    const url = tab?.resolvedUrl || tab?.url || '';
    if (!url) return;
    vscode.postMessage({ type: 'copyToClipboard', text: url });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });
  mc.querySelector('.js-copy-response-status')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    vscode.postMessage({ type: 'copyToClipboard', text: buildResponseStatusLine(tab.response) });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });
  mc.querySelector('.js-copy-response-headers')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    vscode.postMessage({ type: 'copyToClipboard', text: buildRawResponseHeaders(tab.response) });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });

  // Response overflow: Mode / copy / save utilities. Pin/Compare stay on the primary toolbar.
  bindActionsMoreMenu(mc.querySelector('.js-actions-more-btn'), mc.querySelector('.js-actions-more-menu'));

  
  mc.querySelector('.js-resolved-url')?.addEventListener('click', (e) => {
    const el = e.currentTarget;
    const url = el.textContent;
    vscode.postMessage({ type: 'copyToClipboard', text: url });
    el.classList.add('copied');
    const orig = el.textContent;
    el.textContent = tr('webview.copied');
    setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1200);
  });

  
  mc.querySelector('.js-save-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const ct = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '';
    pendingSaveResponseBtn = this;
    vscode.postMessage({ type: 'saveResponseBody', body: tab.response.body, bodyBase64: tab.response.bodyBase64 || '', contentType: ct });
  });

  mc.querySelector('.js-open-response-url')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    const url = tab?.resolvedUrl || tab?.url || '';
    if (!url) return;
    vscode.postMessage({ type: 'openResponseUrl', url: url });
    showBtnFeedback(this, tr('webview.opened'), 1000);
  });

  mc.querySelector('.js-pin-response')?.addEventListener('click', function() {
    var snapshot = getActiveResponseSnapshot();
    if (!snapshot) return;
    var existIdx = pinnedResponses.findIndex(function(p) { return p.signature === snapshot.signature; });
    if (existIdx !== -1) {
      pinnedResponses.splice(existIdx, 1);
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    } else {
      if (pinnedResponses.length >= 2) {
        pinnedResponses.shift();
      }
      pinnedResponses.push(snapshot);
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    }
    updatePinCompareButtons(mc);
  });

  mc.querySelector('.js-compare-responses')?.addEventListener('click', function() {
    if (pinnedResponses.length < 2) return;
    requestCompare(pinnedResponses[0], pinnedResponses[1]);
  });

  mc.querySelector('.js-compare-last')?.addEventListener('click', function() {
    compareCurrentWithLast();
  });

  mc.querySelector('.js-compare-settings')?.addEventListener('click', function() {
    showCompareSettings();
  });

  mc.querySelector('.res-area')?.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    document.querySelectorAll('.res-ctx-menu').forEach(m => m.remove());
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const activeSnapshot = getActiveResponseSnapshot();
    const pinnedOne = pinnedResponses[0] || null;
    const pinnedTwo = pinnedResponses[1] || null;

    const menu = document.createElement('div');
    menu.className = 'res-ctx-menu';
    menu.innerHTML =
      '<div class="ctx-item js-ctx-compare-last' + (!lastResponse ? ' disabled' : '') + '">' + escapeHtml(tr('webview.compareLast')) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pin1' + (!pinnedOne ? ' disabled' : '') + '">' + escapeHtml(pinnedOne ? tf('webview.compareWith', { label: truncate(pinnedOne.label, 32) }) : tf('webview.compareWith', { label: tf('webview.pinNumber', { count: 1 }) })) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pin2' + (!pinnedTwo ? ' disabled' : '') + '">' + escapeHtml(pinnedTwo ? tf('webview.compareWith', { label: truncate(pinnedTwo.label, 32) }) : tf('webview.compareWith', { label: tf('webview.pinNumber', { count: 2 }) })) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pins' + (pinnedResponses.length < 2 ? ' disabled' : '') + '">' + escapeHtml(tr('webview.comparePinned')) + '</div>' +
      '<div class="ctx-item js-ctx-settings">' + escapeHtml(tr('webview.comparisonSettings')) + '</div>' +
      '<div class="ctx-sep"></div>' +
      '<div class="ctx-item js-ctx-pin-current">' + pinSvg + ' ' + escapeHtml(tr('webview.pinCurrentResponse')) + '</div>' +
      '<div class="ctx-item js-ctx-clear-pins' + (pinnedResponses.length === 0 ? ' disabled' : '') + '">' + escapeHtml(tr('webview.clearAllPins')) + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + ')' : '') + '</div>';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    document.body.appendChild(menu);

    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

    menu.querySelector('.js-ctx-compare-last')?.addEventListener('click', function() {
      if (!activeSnapshot || !lastResponse) return;
      requestCompare(lastResponse, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pin1')?.addEventListener('click', function() {
      if (!activeSnapshot || !pinnedOne) return;
      requestCompare(pinnedOne, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pin2')?.addEventListener('click', function() {
      if (!activeSnapshot || !pinnedTwo) return;
      requestCompare(pinnedTwo, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pins')?.addEventListener('click', function() {
      if (pinnedResponses.length < 2) return;
      requestCompare(pinnedResponses[0], pinnedResponses[1]);
      menu.remove();
    });

    menu.querySelector('.js-ctx-settings')?.addEventListener('click', function() {
      showCompareSettings();
      menu.remove();
    });

    menu.querySelector('.js-ctx-pin-current')?.addEventListener('click', function() {
      var pinBtn = mc.querySelector('.js-pin-response');
      if (pinBtn) pinBtn.click();
      menu.remove();
    });

    menu.querySelector('.js-ctx-clear-pins')?.addEventListener('click', function() {
      if (pinnedResponses.length === 0) return;
      pinnedResponses.length = 0;
      updatePinCompareButtons(mc);
      menu.remove();
    });

    setTimeout(function() {
      document.addEventListener('click', function closeCtx() {
        menu.remove();
        document.removeEventListener('click', closeCtx);
      }, { once: true });
    }, 0);
  });

  updatePinCompareButtons(mc);

  mc.querySelector('.js-res-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    switchResponseTabInContent(mc, t.dataset.tab);
  });
  mc.querySelector('.js-res-tabs')?.addEventListener('keydown', (e) => {
    handleResponseTabKeydown(mc, e);
  });

  
  mc.querySelector('.js-res-body-toolbar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (btn) {
      mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) tree.classList.toggle('hidden', btn.dataset.mode !== 'tree');
      if (raw) raw.classList.toggle('hidden', btn.dataset.mode !== 'raw');
      
      mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(b => b.style.display = btn.dataset.mode === 'tree' ? '' : 'none');
      syncResponseSearch(mc);
    }
  });

  mc.querySelector('.js-response-search')?.addEventListener('input', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchQuery = this.value || '';
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });
  mc.querySelector('.js-response-search')?.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    stepResponseSearch(mc, e.shiftKey ? -1 : 1);
  });
  mc.querySelector('.js-response-search-prev')?.addEventListener('click', function() {
    stepResponseSearch(mc, -1);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-next')?.addEventListener('click', function() {
    stepResponseSearch(mc, 1);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-clear')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchQuery = '';
    tab.responseSearchIndex = 0;
    var input = mc.querySelector('.js-response-search');
    if (input) input.value = '';
    syncResponseSearch(mc);
    input?.focus();
    debouncePersist();
  });
  mc.querySelector('.js-response-search-case')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchCaseSensitive = tab.responseSearchCaseSensitive !== true;
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-regex')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchRegex = tab.responseSearchRegex !== true;
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });

  // Expand All
  mc.querySelector('.js-expand-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.remove('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '-'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.add('hidden'));
  });

  // Collapse All
  mc.querySelector('.js-collapse-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.add('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '+'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.remove('hidden'));
  });

  
  const fmtBtn = mc.querySelector('.js-fmt-btn');
  const fmtMenu = mc.querySelector('.js-fmt-menu');
  if (fmtBtn && fmtMenu) {
    fmtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeFormatMenuState && activeFormatMenuState.menu === fmtMenu) {
        closeActiveFormatMenu();
        return;
      }
      closeActiveFormatMenu();
      fmtMenu.classList.add('open');
      activeFormatMenuState = { button: fmtBtn, menu: fmtMenu };
    });
    fmtMenu.addEventListener('click', (e) => { e.stopPropagation(); });

    
    fmtMenu.querySelectorAll('.js-fmt-style').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-style .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
    
    fmtMenu.querySelectorAll('.js-fmt-indent').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-indent .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
  }

  
  if (mc.querySelector('.js-res-body-toolbar')) {
    applyFormat(mc);
  }

  
  const treeContainer = mc.querySelector('.js-res-tree');
  if (treeContainer && !treeContainer.hasChildNodes()) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.response?.body) {
      try {
        const parsed = JSON.parse(tab.response.body);
        treeContainer.innerHTML = buildJsonTree(parsed, '', true, '$');
        treeContainer._jsonData = parsed;
        bindTreeToggles(treeContainer);
      } catch {}
    }
  }
}

function appendJsonPath(basePath, segment, isArray) {
  if (segment === '' || segment === undefined || segment === null) return basePath || '$';
  if (isArray) return (basePath || '$') + '[' + segment + ']';
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)
    ? ((basePath || '$') + '.' + segment)
    : ((basePath || '$') + '[' + JSON.stringify(segment) + ']');
}

function buildJsonTree(val, key, isLast, path) {
  const comma = isLast ? '' : '<span class="jt-comma">,</span>';
  const keyHtml = key !== '' ? '<span class="jt-key">' + escapeHtml('"' + key + '"') + '</span>: ' : '';
  const copyPath = path || '$';
  const pathAttr = ' data-copy-path="' + escapeAttr(copyPath) + '"';
  const rowTitle = ' title="' + escapeAttr(tf('webview.copyJsonPathValue', { path: copyPath })) + '"';
  const copyBtn = '<button class="jt-copy-path" type="button" data-copy-path="' + escapeAttr(copyPath) + '" title="' + escapeAttr(tf('webview.copyJsonPathValue', { path: copyPath })) + '">' + escapeHtml(tr('webview.copyPathShort')) + '</button>';

  if (val === null) {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-null">null</span>' + comma + copyBtn + '</div>';
  }
  if (typeof val === 'boolean') {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-bool">' + val + '</span>' + comma + copyBtn + '</div>';
  }
  if (typeof val === 'number') {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-num">' + val + '</span>' + comma + copyBtn + '</div>';
  }
  if (typeof val === 'string') {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-str">' + escapeHtml('"' + val + '"') + '</span>' + comma + copyBtn + '</div>';
  }

  const isArr = Array.isArray(val);
  const open = isArr ? '[' : '{';
  const close = isArr ? ']' : '}';
  const entries = isArr ? val.map((v, i) => [i, v]) : Object.entries(val);
  const count = entries.length;

  if (count === 0) {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml +
      '<span class="jt-brace">' + open + close + '</span>' + comma + copyBtn + '</div>';
  }

  let childrenHtml = '';
  entries.forEach(([k, v], idx) => {
    const childKey = isArr ? '' : String(k);
    const childPath = appendJsonPath(copyPath, String(k), isArr);
    childrenHtml += buildJsonTree(v, childKey, idx === count - 1, childPath);
  });

  const summary = isArr ? count + ' items' : count + ' keys';

  return '<div class="jt-row"' + pathAttr + rowTitle + '>' +
      '<span class="jt-toggle">-</span>' + keyHtml +
      '<span class="jt-brace">' + open + '</span>' +
      '<span class="jt-ellipsis hidden" title="' + summary + '"> ... ' + summary + ' </span>' +
      copyBtn +
    '</div>' +
    '<div class="jt-children jt-node">' + childrenHtml + '</div>' +
    '<div class="jt-row"><span class="jt-toggle"></span><span class="jt-brace">' + close + '</span>' + comma + '</div>';
}

function resolveJsonPath(root, path) {
  if (!path || path === '$') return root;
  var rest = path.charAt(0) === '$' ? path.slice(1) : path;
  var tokenRe = /\\.([^.\\[\\]]+)|\\[(\\d+)\\]|\\["((?:\\\\.|[^"\\\\])*)"\\]/g;
  var current = root;
  var match;
  while ((match = tokenRe.exec(rest)) !== null) {
    if (current == null) return undefined;
    if (match[1] !== undefined) {
      current = current[match[1]];
    } else if (match[2] !== undefined) {
      current = current[Number(match[2])];
    } else if (match[3] !== undefined) {
      current = current[match[3].replace(/\\\\(.)/g, '$1')];
    }
  }
  return current;
}

function stringifyJsonValue(value) {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function truncateToastText(text, max) {
  max = max || 80;
  var flat = String(text).replace(/\\s+/g, ' ');
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1) + '\u2026';
}

function bindTreeToggles(container) {
  var pendingRowClickTimer = null;
  var cancelPendingRowClick = function() {
    if (pendingRowClickTimer) {
      clearTimeout(pendingRowClickTimer);
      pendingRowClickTimer = null;
    }
  };

  container.addEventListener('click', (e) => {
    const copyPathBtn = e.target.closest('.jt-copy-path');
    if (copyPathBtn && copyPathBtn.dataset.copyPath) {
      e.preventDefault();
      e.stopPropagation();
      cancelPendingRowClick();
      const path = copyPathBtn.dataset.copyPath;
      vscode.postMessage({ type: 'copyToClipboard', text: path });
      showCopyToast(tf('webview.copiedPath', { path: path }));
      return;
    }

    const toggle = e.target.closest('.jt-toggle');
    const ellipsis = e.target.closest('.jt-ellipsis');

    // Toggle / ellipsis click => expand/collapse (immediate, no delay)
    if (toggle || ellipsis) {
      cancelPendingRowClick();
      const row = (toggle || ellipsis).closest('.jt-row');
      if (!row) return;
      const tgl = row.querySelector('.jt-toggle');
      if (!tgl || !tgl.textContent.trim()) return;

      const children = row.nextElementSibling;
      if (!children || !children.classList.contains('jt-children')) return;

      const collapsed = children.classList.toggle('collapsed');
      tgl.textContent = collapsed ? '+' : '-';
      const ell = row.querySelector('.jt-ellipsis');
      if (ell) ell.classList.toggle('hidden', !collapsed);
      return;
    }

    // Row click anywhere else => copy JSONPath (delayed, so dblclick can cancel it)
    const row = e.target.closest('.jt-row[data-copy-path]');
    if (row && row.dataset.copyPath) {
      const path = row.dataset.copyPath;
      cancelPendingRowClick();
      pendingRowClickTimer = setTimeout(function() {
        pendingRowClickTimer = null;
        vscode.postMessage({ type: 'copyToClipboard', text: path });
        showCopyToast(tf('webview.copiedPath', { path: path }));
      }, 240);
    }
  });

  container.addEventListener('dblclick', (e) => {
    // Ignore when double-clicking expand/collapse affordances
    if (e.target.closest('.jt-toggle') || e.target.closest('.jt-ellipsis') || e.target.closest('.jt-copy-path')) return;
    const row = e.target.closest('.jt-row[data-copy-path]');
    if (!row || !row.dataset.copyPath) return;
    e.preventDefault();
    cancelPendingRowClick();
    // Clear the accidental text selection the double-click creates
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();

    const root = container._jsonData;
    if (root === undefined) return;
    const value = resolveJsonPath(root, row.dataset.copyPath);
    if (value === undefined) return;
    const text = stringifyJsonValue(value);
    vscode.postMessage({ type: 'copyToClipboard', text: text });
    showCopyToast(tf('webview.copiedValue', { value: truncateToastText(text, 80) }));
  });
}

function buildXPathFromStack(stack) {
  if (!stack.length) return '';
  return '/' + stack.map(function(segment) {
    return segment.name + '[' + segment.index + ']';
  }).join('/');
}

function extractXmlLinePaths(body) {
  var lines = String(body || '').split('\\n');
  var tagPattern = /(<\\?[\\s\\S]*?\\?>|<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\/[^>]+>|<[^>]+\\/\\s*>|<[^>]+>)/g;
  var stack = [];
  var childCounters = [Object.create(null)];

  return lines.map(function(line) {
    var trimmed = (line || '').trim();
    if (!trimmed || trimmed.indexOf('<') < 0) return '';

    var linePath = '';
    var match;
    tagPattern.lastIndex = 0;
    while ((match = tagPattern.exec(trimmed)) !== null) {
      var tag = match[1];
      if (tag.startsWith('<?') || tag.startsWith('<!--') || tag.startsWith('<![CDATA[')) {
        continue;
      }

      if (tag.startsWith('</')) {
        if (!linePath && stack.length) {
          linePath = buildXPathFromStack(stack);
        }
        if (stack.length) {
          stack.pop();
          childCounters.pop();
        }
        continue;
      }

      var nameMatch = tag.match(/^<\\s*([^\\s/>]+)/);
      if (!nameMatch) continue;

      var name = nameMatch[1];
      var currentCounters = childCounters[childCounters.length - 1];
      var nextIndex = (currentCounters[name] || 0) + 1;
      currentCounters[name] = nextIndex;

      stack.push({ name: name, index: nextIndex });
      childCounters.push(Object.create(null));
      linePath = buildXPathFromStack(stack);

      if (/\\/\\s*>$/.test(tag)) {
        stack.pop();
        childCounters.pop();
      }
    }

    return linePath;
  });
}

function renderXmlBodyWithPaths(body) {
  var lines = String(body || '').split('\\n');
  var linePaths = extractXmlLinePaths(body);
  return '<div class="xml-path-body">' + lines.map(function(line, index) {
    var xpath = linePaths[index];
    var copyButton = xpath
      ? '<button class="xml-path-copy js-copy-xml-path" type="button" data-copy-path="' + escapeAttr(xpath) + '" title="' + escapeAttr(tf('webview.copyXPathValue', { path: xpath })) + '">' + escapeHtml(tr('webview.copyXPathShort')) + '</button>'
      : '';
    return '<div class="xml-path-line"' + (xpath ? ' data-copy-path="' + escapeAttr(xpath) + '"' : '') + '>' +
      '<span class="xml-path-content">' + (line ? highlightBody(line, 'xml') : '&nbsp;') + '</span>' +
      copyButton +
    '</div>';
  }).join('') + '</div>';
}



var hljsLangMap = { json: 'json', html: 'html', xml: 'xml', js: 'javascript', css: 'css', text: 'plaintext' };

function detectLang(ct, body) {
  if (ct.includes('json') || ct.includes('javascript') && tryJsonParse(body)) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml') || ct.includes('svg')) return 'xml';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'js';
  if (ct.includes('css')) return 'css';
  if (tryJsonParse(body)) return 'json';
  if (body.trimStart().startsWith('<!') || body.trimStart().startsWith('<html')) return 'html';
  if (body.trimStart().startsWith('<?xml') || body.trimStart().startsWith('<rss')) return 'xml';
  return 'text';
}
function tryJsonParse(s) { try { JSON.parse(s); return true; } catch { return false; } }

function highlightBody(body, lang) {
  
  if (lang === 'json') {
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch {}
  }
  var actualLang = lang === '_formatted_json' ? 'json' : lang;
  
  if (typeof hljs !== 'undefined') {
    var hljsLang = hljsLangMap[actualLang] || 'plaintext';
    try {
      return hljs.highlight(body, { language: hljsLang }).value;
    } catch {}
  }
  
  return escapeHtml(body);
}

function getResponseSearchState(tab) {
  return {
    query: typeof tab?.responseSearchQuery === 'string' ? tab.responseSearchQuery : '',
    index: typeof tab?.responseSearchIndex === 'number' ? tab.responseSearchIndex : 0,
    caseSensitive: tab?.responseSearchCaseSensitive === true,
    regex: tab?.responseSearchRegex === true,
  };
}

function getIndentString(indentKey) {
  return indentKey === 'tab' ? '\\t' : ' '.repeat(parseInt(indentKey || '2', 10) || 2);
}

function getDisplayResponseBody(tab, lang, fallbackBody) {
  if (!tab?.response) return fallbackBody || '';
  var body = typeof fallbackBody === 'string' ? fallbackBody : (tab.response.body || '');
  if (lang === 'json') {
    return formatJson(body, tab.jsonFormatStyle || 'pretty', getIndentString(tab.formatIndent || '2'));
  }
  if (lang === 'xml') {
    return formatXml(body, tab.xmlFormatStyle || 'inline', getIndentString(tab.formatIndent || '2'));
  }
  return body;
}

function findResponseSearchMatches(body, query, options) {
  if (!body || !query) return [];
  var source = String(body);
  var settings = options || {};

  if (settings.regex) {
    try {
      var flags = settings.caseSensitive ? 'g' : 'gi';
      var regex = new RegExp(query, flags);
      var regexMatches = [];
      var match;
      while ((match = regex.exec(source)) !== null) {
        var value = match[0] || '';
        regexMatches.push({ start: match.index, end: match.index + value.length });
        if (value.length === 0) {
          regex.lastIndex += 1;
        }
      }
      return regexMatches;
    } catch (_) {
      return [];
    }
  }

  var haystack = settings.caseSensitive ? source : source.toLowerCase();
  var needle = settings.caseSensitive ? String(query) : String(query).toLowerCase();
  if (!needle) return [];
  var matches = [];
  var start = 0;
  while (start <= haystack.length) {
    var idx = haystack.indexOf(needle, start);
    if (idx < 0) break;
    matches.push({ start: idx, end: idx + needle.length });
    start = idx + Math.max(needle.length, 1);
  }
  return matches;
}

function normalizeResponseSearchIndex(index, total) {
  if (total <= 0) return -1;
  if (typeof index !== 'number' || !isFinite(index)) return 0;
  var normalized = index % total;
  return normalized < 0 ? normalized + total : normalized;
}

function renderResponseBody(body, lang, searchQuery, searchIndex, searchState) {
  if (!searchQuery) {
    return highlightBody(body, lang === 'json' ? '_formatted_json' : lang);
  }

  var matches = findResponseSearchMatches(body, searchQuery, searchState || {});
  if (matches.length === 0) {
    return escapeHtml(body);
  }

  var activeIndex = normalizeResponseSearchIndex(searchIndex, matches.length);
  var parts = [];
  var cursor = 0;
  for (var i = 0; i < matches.length; i++) {
    var start = matches[i].start;
    var end = matches[i].end;
    parts.push(escapeHtml(body.slice(cursor, start)));
    parts.push('<mark class="response-search-hit' + (i === activeIndex ? ' active' : '') + '">' + escapeHtml(body.slice(start, end)) + '</mark>');
    cursor = end;
  }
  parts.push(escapeHtml(body.slice(cursor)));
  return parts.join('');
}

function setJsonBodyMode(mc, mode) {
  mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(function(button) {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  var tree = mc.querySelector('.js-res-tree');
  var raw = mc.querySelector('.js-res-raw');
  if (tree) tree.classList.toggle('hidden', mode !== 'tree');
  if (raw) raw.classList.toggle('hidden', mode !== 'raw');
  mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(function(button) {
    button.style.display = mode === 'tree' ? '' : 'none';
  });
}

function syncResponseSearch(mc) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  var rawEl = mc.querySelector('.js-res-raw');
  if (!tab?.response || !rawEl) return;

  var ct = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (!!tab.response.bodyBase64 && isBinaryContentType(ct)) return;

  var lang = detectLang(ct, tab.response.body || '');
  var searchState = getResponseSearchState(tab);
  var query = searchState.query || '';
  var displayBody = getDisplayResponseBody(tab, lang, tab.response.body || '');
  var matches = findResponseSearchMatches(displayBody, query, searchState);
  var activeIndex = normalizeResponseSearchIndex(searchState.index, matches.length);

  if (query && lang === 'json') {
    setJsonBodyMode(mc, 'raw');
  }

  rawEl.innerHTML = lang === 'xml' && !query
    ? renderXmlBodyWithPaths(displayBody)
    : renderResponseBody(displayBody, lang, query, activeIndex, searchState);

  var countEl = mc.querySelector('.js-response-search-count');
  if (countEl) {
    countEl.textContent = query
      ? (matches.length > 0
          ? tf('webview.searchCount', { current: activeIndex + 1, total: matches.length })
          : tr('webview.searchNoMatches'))
      : '';
  }

  var prevBtn = mc.querySelector('.js-response-search-prev');
  var nextBtn = mc.querySelector('.js-response-search-next');
  var clearBtn = mc.querySelector('.js-response-search-clear');
  var caseBtn = mc.querySelector('.js-response-search-case');
  var regexBtn = mc.querySelector('.js-response-search-regex');
  if (prevBtn) prevBtn.disabled = matches.length === 0;
  if (nextBtn) nextBtn.disabled = matches.length === 0;
  if (clearBtn) clearBtn.disabled = !query;
  if (caseBtn) caseBtn.classList.toggle('active', !!searchState.caseSensitive);
  if (regexBtn) regexBtn.classList.toggle('active', !!searchState.regex);

  tab.responseSearchIndex = activeIndex < 0 ? 0 : activeIndex;

  if (query && matches.length > 0) {
    setTimeout(function() {
      rawEl.querySelector('.response-search-hit.active')?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, 0);
  }
}

function stepResponseSearch(mc, delta) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab?.response) return;
  var ct = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (!!tab.response.bodyBase64 && isBinaryContentType(ct)) return;
  var lang = detectLang(ct, tab.response.body || '');
  var displayBody = getDisplayResponseBody(tab, lang, tab.response.body || '');
  var matches = findResponseSearchMatches(displayBody, tab.responseSearchQuery || '', getResponseSearchState(tab));
  if (matches.length === 0) return;
  tab.responseSearchIndex = normalizeResponseSearchIndex((tab.responseSearchIndex || 0) + delta, matches.length);
  syncResponseSearch(mc);
}


function getFormatOptions(mc) {
  var toolbar = mc.querySelector('.js-res-body-toolbar');
  if (!toolbar) return null;
  var styleEl = toolbar.querySelector('.js-fmt-style .check');
  var style = 'pretty';
  toolbar.querySelectorAll('.js-fmt-style').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') style = el.dataset.style;
  });
  var indent = '2';
  toolbar.querySelectorAll('.js-fmt-indent').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') indent = el.dataset.indent;
  });
  var indentStr = indent === 'tab' ? '\\t' : ' '.repeat(parseInt(indent));
  return { style: style, indent: indentStr, indentKey: indent, lang: toolbar.dataset.lang };
}

function applyFormat(mc) {
  var opts = getFormatOptions(mc);
  if (!opts) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return;
  if (opts.lang === 'json') tab.jsonFormatStyle = opts.style;
  if (opts.lang === 'xml') tab.xmlFormatStyle = opts.style;
  tab.formatIndent = opts.indentKey;
  var body = tab.response.body;
  var formatted;
  if (opts.lang === 'json') {
    formatted = formatJson(body, opts.style, opts.indent);
  } else if (opts.lang === 'xml') {
    formatted = formatXml(body, opts.style, opts.indent);
  } else {
    return;
  }
  
  var rawEl = mc.querySelector('.js-res-raw');
  if (rawEl) {
    var searchQuery = tab.responseSearchQuery || '';
    rawEl.innerHTML = opts.lang === 'xml' && !searchQuery
      ? renderXmlBodyWithPaths(formatted)
      : renderResponseBody(formatted, opts.lang, searchQuery, tab.responseSearchIndex || 0, getResponseSearchState(tab));
  }
  
  if (opts.lang === 'json') {
    var treeEl = mc.querySelector('.js-res-tree');
    if (treeEl) {
      try {
        var parsed = JSON.parse(body);
        treeEl.innerHTML = buildJsonTree(parsed, '', true, '$');
        treeEl._jsonData = parsed;
        bindTreeToggles(treeEl);
      } catch {}
    }
  }
  syncResponseSearch(mc);
  debouncePersist();
}

function formatJson(body, style, indent) {
  try {
    var parsed = JSON.parse(body);
    if (style === 'compact') return JSON.stringify(parsed);
    return JSON.stringify(parsed, null, indent);
  } catch { return body; }
}


function formatXml(xml, style, indent) {
  
  xml = xml.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');

  if (style === 'compact') {
    
    return xml.replace(/>\\s+</g, '><').replace(/^\\s+|\\s+$/g, '');
  }

  
  var tokens = xmlTokenize(xml);

  if (style === 'inline') {
    return xmlBuildInline(tokens, indent);
  }

  // Pretty
  return xmlBuildPretty(tokens, indent);
}

function xmlTokenize(xml) {
  var tokens = [];
  var re = /(<\\?[\\s\\S]*?\\?>|<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\/[^>]+>|<[^>]+\\/\\s*>|<[^>]+>)/g;
  var lastIndex = 0;
  var match;
  while ((match = re.exec(xml)) !== null) {
    if (match.index > lastIndex) {
      var text = xml.substring(lastIndex, match.index).trim();
      if (text) tokens.push({ type: 'text', value: text });
    }
    var tag = match[1];
    if (tag.startsWith('<?')) tokens.push({ type: 'decl', value: tag });
    else if (tag.startsWith('<!--')) tokens.push({ type: 'comment', value: tag });
    else if (tag.startsWith('<![CDATA[')) tokens.push({ type: 'cdata', value: tag });
    else if (tag.startsWith('</')) tokens.push({ type: 'close', value: tag });
    else if (tag.endsWith('/>')) tokens.push({ type: 'self', value: tag });
    else tokens.push({ type: 'open', value: tag });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < xml.length) {
    var tail = xml.substring(lastIndex).trim();
    if (tail) tokens.push({ type: 'text', value: tail });
  }
  return tokens;
}

function xmlBuildPretty(tokens, indent) {
  var lines = [];
  var depth = 0;
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
    } else if (t.type === 'open') {
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
    }
  }
  return lines.join('\\n');
}

function xmlBuildInline(tokens, indent) {
  
  
  var lines = [];
  var depth = 0;
  var i = 0;
  while (i < tokens.length) {
    var t = tokens[i];
    if (t.type === 'open') {
      
      if (i + 2 < tokens.length && tokens[i+1].type === 'text' && tokens[i+2].type === 'close') {
        
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      if (i + 3 < tokens.length && tokens[i+1].type === 'self' && tokens[i+2].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      
      if (i + 4 < tokens.length &&
          tokens[i+1].type === 'open' && tokens[i+2].type === 'text' &&
          tokens[i+3].type === 'close' && tokens[i+4].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value + tokens[i+3].value + tokens[i+4].value);
        i += 5;
        continue;
      }
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
      i++;
    } else if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    }
  }
  return lines.join('\\n');
}

function indentStr(depth, indent) {
  var s = '';
  for (var i = 0; i < depth; i++) s += indent;
  return s;
}
`;
}
