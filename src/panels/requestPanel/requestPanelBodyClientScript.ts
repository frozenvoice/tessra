/** Request panel Body editor client fragment (same Webview lexical scope as main client script). */
export function getRequestPanelBodyClientScript(): string {
  return /*js*/ `
const BODY_UNDO_MAX_ENTRIES = 100;
const BODY_UNDO_COALESCE_MS = 700;
// Skip tokenized JSON highlight above this size to avoid typing jank; overlay falls back to escaped plain text.
const BODY_JSON_HIGHLIGHT_MAX_CHARS = 120000;
const BODY_JSON_HIGHLIGHT_DEBOUNCE_MS = 80;
var bodyUndoApplying = false;

function isBodyUndoRedoShortcut(event) {
  if (!event || event.altKey) return false;
  var isPrimaryModifier = event.ctrlKey || event.metaKey;
  if (!isPrimaryModifier) return false;
  var key = String(event.key || '').toLowerCase();
  return key === 'z' || key === 'y';
}

function isBodyRedoShortcut(event) {
  var key = String(event.key || '').toLowerCase();
  return (key === 'y' && !event.shiftKey) || (key === 'z' && event.shiftKey);
}

function createBodyUndoSnapshot(value, textarea, extras) {
  var text = String(value || '');
  var fallbackOffset = text.length;
  var selectionStart = typeof textarea?.selectionStart === 'number' ? textarea.selectionStart : fallbackOffset;
  var selectionEnd = typeof textarea?.selectionEnd === 'number' ? textarea.selectionEnd : selectionStart;
  var snapshot = {
    value: text,
    selectionStart: Math.min(selectionStart, text.length),
    selectionEnd: Math.min(selectionEnd, text.length),
  };
  if (extras && extras.conversion) {
    snapshot.conversion = true;
    snapshot.bodyType = normalizeBodyType(extras.bodyType);
    snapshot.formData = cloneFormDataFields(extras.formData);
    snapshot.binaryFilePath = String(extras.binaryFilePath || '');
  }
  return snapshot;
}

function cloneFormDataFields(fields) {
  return (fields || []).map(function(field) {
    return {
      id: field.id || ('fd_' + Math.random().toString(36).slice(2, 10)),
      key: field.key || '',
      value: field.value || '',
      enabled: field.enabled !== false,
      type: field.type === 'file' ? 'file' : 'text',
    };
  });
}

function bodyUndoSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  if (a.value !== b.value) return false;
  if (!!a.conversion !== !!b.conversion) return false;
  if (a.conversion) {
    if (normalizeBodyType(a.bodyType) !== normalizeBodyType(b.bodyType)) return false;
    if (String(a.binaryFilePath || '') !== String(b.binaryFilePath || '')) return false;
    try {
      return JSON.stringify(a.formData || []) === JSON.stringify(b.formData || []);
    } catch {
      return false;
    }
  }
  return true;
}

function resetBodyUndoState(tab, value, textarea) {
  if (!tab) return null;
  var snapshot = createBodyUndoSnapshot(value, textarea);
  tab._bodyUndoState = {
    undo: [],
    redo: [],
    lastValue: snapshot.value,
    lastSelectionStart: snapshot.selectionStart,
    lastSelectionEnd: snapshot.selectionEnd,
    lastRecordedAt: 0,
    lastInputType: '',
    lastBodyType: normalizeBodyType(tab.bodyType),
  };
  return tab._bodyUndoState;
}

function ensureBodyUndoState(tab, textarea) {
  if (!tab) return null;
  var value = textarea ? textarea.value : (tab.body || '');
  if (!tab._bodyUndoState) {
    return resetBodyUndoState(tab, value, textarea);
  }
  if (!bodyUndoApplying && tab._bodyUndoState.lastValue !== String(value || '')) {
    return resetBodyUndoState(tab, value, textarea);
  }
  return tab._bodyUndoState;
}

function trimBodyUndoStack(stack) {
  while (stack.length > BODY_UNDO_MAX_ENTRIES) {
    stack.shift();
  }
}

function pushBodyUndoSnapshot(stack, snapshot) {
  if (!stack || !snapshot) return;
  var previous = stack[stack.length - 1];
  if (previous && bodyUndoSnapshotsEqual(previous, snapshot)) return;
  stack.push(snapshot);
  trimBodyUndoStack(stack);
}

function rememberBodyEditorSelection(tab, textarea) {
  var state = ensureBodyUndoState(tab, textarea);
  if (!state || !textarea) return;
  state.lastSelectionStart = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : state.lastValue.length;
  state.lastSelectionEnd = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : state.lastSelectionStart;
}

function normalizeBodyUndoInputType(event) {
  var inputType = String(event?.inputType || '');
  if (inputType.indexOf('delete') === 0 || inputType.indexOf('insertText') === 0) return 'typing';
  if (inputType.indexOf('history') === 0) return 'history';
  return inputType || 'input';
}

function recordBodyEditorInput(tab, textarea, event) {
  if (bodyUndoApplying || !tab || !textarea) return;
  var state = tab._bodyUndoState || resetBodyUndoState(tab, textarea.value, textarea);
  if (!state) return;
  var previousValue = state.lastValue;
  var nextValue = textarea.value;
  if (previousValue === nextValue) {
    rememberBodyEditorSelection(tab, textarea);
    return;
  }
  var now = Date.now();
  var inputType = normalizeBodyUndoInputType(event);
  var shouldCoalesce = inputType === 'typing'
    && state.lastInputType === 'typing'
    && state.undo.length > 0
    && now - state.lastRecordedAt <= BODY_UNDO_COALESCE_MS;
  if (!shouldCoalesce) {
    pushBodyUndoSnapshot(state.undo, {
      value: previousValue,
      selectionStart: state.lastSelectionStart,
      selectionEnd: state.lastSelectionEnd,
    });
  }
  state.redo = [];
  state.lastValue = nextValue;
  state.lastRecordedAt = now;
  state.lastInputType = inputType;
  rememberBodyEditorSelection(tab, textarea);
}

function captureBodyConversionUndoSnapshot(tab, textarea) {
  return createBodyUndoSnapshot(textarea ? textarea.value : (tab?.body || ''), textarea, {
    conversion: true,
    bodyType: tab?.bodyType || 'none',
    formData: tab?.formData || [],
    binaryFilePath: tab?.binaryFilePath || '',
  });
}

function applyBodyEditorUndoSnapshot(tab, textarea, snapshot) {
  if (!tab || !snapshot) return;
  bodyUndoApplying = true;
  var nextValue = snapshot.value;
  tab.body = nextValue;
  if (textarea) {
    textarea.value = nextValue;
  }
  if (snapshot.conversion) {
    tab.bodyType = normalizeBodyType(snapshot.bodyType);
    tab.formData = cloneFormDataFields(snapshot.formData);
    tab.binaryFilePath = String(snapshot.binaryFilePath || '');
    syncBodyTypeUiFromTab(tab);
  }
  var state = ensureBodyUndoState(tab, textarea) || resetBodyUndoState(tab, nextValue, textarea);
  if (state) {
    state.lastValue = nextValue;
    state.lastSelectionStart = snapshot.selectionStart;
    state.lastSelectionEnd = snapshot.selectionEnd;
    state.lastRecordedAt = Date.now();
    state.lastInputType = snapshot.conversion ? 'conversion' : 'history';
    state.lastBodyType = normalizeBodyType(tab.bodyType);
  }
  if (textarea) {
    try {
      textarea.selectionStart = snapshot.selectionStart;
      textarea.selectionEnd = snapshot.selectionEnd;
    } catch {}
    if (typeof textarea._tessraAutoGrow === 'function') {
      textarea._tessraAutoGrow();
    }
    if (typeof textarea._tessraRefreshBodyHighlight === 'function') {
      textarea._tessraRefreshBodyHighlight(true);
    }
  }
  bodyUndoApplying = false;
  markDirty();
  refreshDraftInsights(mainContent);
  debouncePersist();
}

function handleBodyEditorUndoRedoShortcut(tab, textarea, event) {
  if (!isBodyUndoRedoShortcut(event) || !tab) return false;
  var state = ensureBodyUndoState(tab, textarea);
  if (!state) return false;
  var isRedo = isBodyRedoShortcut(event);
  var sourceStack = isRedo ? state.redo : state.undo;
  var targetStack = isRedo ? state.undo : state.redo;
  if (!sourceStack.length) return false;
  event.preventDefault();
  event.stopPropagation();
  var peek = sourceStack[sourceStack.length - 1];
  var currentSnapshot = (peek && peek.conversion)
    ? captureBodyConversionUndoSnapshot(tab, textarea)
    : createBodyUndoSnapshot(textarea ? textarea.value : (tab.body || ''), textarea);
  pushBodyUndoSnapshot(targetStack, currentSnapshot);
  var nextSnapshot = sourceStack.pop();
  applyBodyEditorUndoSnapshot(tab, textarea, nextSnapshot);
  return true;
}

function shouldEnableBodySyntaxHighlight(bodyType, isWebSocket) {
  var normalized = normalizeBodyType(bodyType);
  return !isWebSocket && (normalized === 'json' || normalized === 'xml');
}

function bodyHighlightLanguage(bodyType) {
  var normalized = normalizeBodyType(bodyType);
  if (normalized === 'xml') return 'xml';
  if (normalized === 'json') return 'json';
  return '';
}

// 하위 호환 별칭 (기존 테스트/호출)
function shouldEnableBodyJsonHighlight(bodyType, isWebSocket) {
  return shouldEnableBodySyntaxHighlight(bodyType, isWebSocket);
}

function highlightBodySource(source, language) {
  var text = String(source || '');
  var lang = language === 'xml' ? 'xml' : 'json';
  var html = '';
  // Large bodies: keep a plain escaped mirror so scroll/layout stay aligned without hljs work each keystroke.
  if (text.length > BODY_JSON_HIGHLIGHT_MAX_CHARS) {
    html = escapeHtml(text);
  } else if (typeof hljs !== 'undefined') {
    try {
      html = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
    } catch {
      html = escapeHtml(text);
    }
  } else {
    html = escapeHtml(text);
  }
  // Match textarea rendering of a trailing newline (extra visual line).
  if (text.endsWith('\\n')) {
    html += '<br>';
  }
  return html;
}

function highlightJsonBodySource(source) {
  return highlightBodySource(source, 'json');
}

function syncBodyHighlightScroll(textarea, highlightEl) {
  if (!textarea || !highlightEl) return;
  highlightEl.scrollTop = textarea.scrollTop;
  highlightEl.scrollLeft = textarea.scrollLeft;
}

function syncBodyTypeUiFromTab(tab) {
  var mc = mainContent;
  if (!mc || !tab) return;
  var select = mc.querySelector('.js-body-type');
  var bodyType = normalizeBodyType(tab.bodyType);
  if (select && select.value !== bodyType) {
    select.value = bodyType;
  }
  var wsBody = isWebSocketTab(tab);
  var textarea = mc.querySelector('.js-body');
  var bodyEditor = mc.querySelector('.js-body-editor');
  var formDataPanel = mc.querySelector('.js-formdata-panel');
  var binaryPanel = mc.querySelector('.js-binary-panel');
  var hideBodyEditor = (!wsBody && (bodyType === 'none' || bodyType === 'formdata' || bodyType === 'binary'));
  if (bodyEditor) bodyEditor.style.display = hideBodyEditor ? 'none' : '';
  else if (textarea) textarea.style.display = hideBodyEditor ? 'none' : '';
  if (formDataPanel) {
    formDataPanel.classList.toggle('hidden', bodyType !== 'formdata');
    if (bodyType === 'formdata') {
      var rows = mc.querySelector('.js-formdata-rows');
      if (rows) rows.innerHTML = formDataRowsHtml(tab.formData || []);
      refreshFormDataSummary(mc);
    }
  }
  if (binaryPanel) {
    binaryPanel.classList.toggle('hidden', bodyType !== 'binary');
    var binaryInput = mc.querySelector('.js-binary-path');
    if (binaryInput) binaryInput.value = tab.binaryFilePath || '';
  }
  if (textarea && bodyType !== 'formdata' && bodyType !== 'binary' && bodyType !== 'none') {
    if (textarea.value !== (tab.body || '')) {
      textarea.value = tab.body || '';
    }
  }
  if (!wsBody) syncAutoContentType(mc, bodyType);
  if (typeof textarea?._tessraRefreshBodyHighlight === 'function') {
    textarea._tessraRefreshBodyHighlight(true);
  }
}

function getBodyConversionApi() {
  return (typeof TessraBodyConversion !== 'undefined') ? TessraBodyConversion : null;
}

function bodyTypeDisplayName(type) {
  var normalized = normalizeBodyType(type);
  if (normalized === 'json') return 'JSON';
  if (normalized === 'xml') return 'XML';
  return bodyTypeLabel(normalized);
}

function showBodyTypeConversionConfirm(options) {
  var old = document.getElementById('bodyConvertOverlay');
  if (old) old.remove();
  var fromType = normalizeBodyType(options.fromType);
  var toType = normalizeBodyType(options.toType);
  var canConvert = !!options.canConvert;
  var isNoneClear = toType === 'none';
  var title = isNoneClear
    ? tr('webview.bodyConvertClearTitle')
    : tf('webview.bodyConvertTitle', { from: bodyTypeDisplayName(fromType), to: bodyTypeDisplayName(toType) });
  var subtitle = isNoneClear
    ? tr('webview.bodyConvertClearSubtitle')
    : tr('webview.bodyConvertSubtitle');
  var convertLabel = isNoneClear ? tr('webview.bodyConvertClear') : tr('webview.bodyConvert');
  var overlay = document.createElement('div');
  overlay.id = 'bodyConvertOverlay';
  overlay.className = 'body-convert-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div class="body-convert-dialog">' +
      '<div class="body-convert-title">' + escapeHtml(title) + '</div>' +
      '<div class="body-convert-sub">' + escapeHtml(subtitle) + '</div>' +
      '<div class="body-convert-actions">' +
        (canConvert
          ? '<button type="button" class="dirty-btn dirty-btn-save" data-action="convert" data-testid="body-convert-confirm">' + escapeHtml(convertLabel) + '</button>'
          : '') +
        '<button type="button" class="dirty-btn dirty-btn-discard" data-action="keep" data-testid="body-convert-keep">' + escapeHtml(tr('webview.bodyConvertKeep')) + '</button>' +
        '<button type="button" class="dirty-btn dirty-btn-cancel" data-action="cancel" data-testid="body-convert-cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  var finish = function(action) {
    overlay.remove();
    if (typeof options.onAction === 'function') options.onAction(action);
  };
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      finish('cancel');
      return;
    }
    var button = event.target.closest('[data-action]');
    if (!button) return;
    finish(button.getAttribute('data-action'));
  });
  overlay.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish('cancel');
    }
  });
  var focusBtn = overlay.querySelector('[data-action="convert"]')
    || overlay.querySelector('[data-action="keep"]')
    || overlay.querySelector('[data-action="cancel"]');
  if (focusBtn) focusBtn.focus();
}

function applyBodyTypeChange(mc, tab, nextType, mode) {
  var api = getBodyConversionApi();
  var fromType = normalizeBodyType(tab.bodyType);
  var toType = normalizeBodyType(nextType);
  var textarea = mc.querySelector('.js-body');
  var currentBody = textarea ? textarea.value : (tab.body || '');
  var currentFormData = tab.bodyType === 'formdata'
    ? collectFormData(mc.querySelector('.js-formdata-rows'))
    : (tab.formData || []);
  var currentBinary = tab.binaryFilePath || '';
  if (tab.bodyType === 'formdata') {
    tab.formData = currentFormData;
  }
  tab.body = currentBody;

  var undoState = ensureBodyUndoState(tab, textarea) || resetBodyUndoState(tab, currentBody, textarea);
  var beforeSnapshot = captureBodyConversionUndoSnapshot(tab, textarea);

  if (mode === 'convert') {
    if (!api) {
      showCopyToast(tr('webview.bodyConvertFailed'));
      if (mc.querySelector('.js-body-type')) {
        mc.querySelector('.js-body-type').value = fromType;
      }
      return false;
    }
    var result = api.convert({
      bodyType: fromType,
      body: currentBody,
      formData: currentFormData,
      binaryFilePath: currentBinary,
    }, toType);
    if (!result || !result.ok) {
      showCopyToast(result?.message || tr('webview.bodyConvertFailed'));
      // 실패 시 원본 유지
      if (mc.querySelector('.js-body-type')) {
        mc.querySelector('.js-body-type').value = fromType;
      }
      return false;
    }
    pushBodyUndoSnapshot(undoState.undo, beforeSnapshot);
    undoState.redo = [];
    tab.bodyType = result.bodyType;
    tab.body = result.body || '';
    tab.formData = cloneFormDataFields(result.formData || []);
    tab.binaryFilePath = result.binaryFilePath || '';
    if (textarea) textarea.value = tab.body;
    undoState.lastValue = tab.body;
    undoState.lastBodyType = tab.bodyType;
    undoState.lastInputType = 'conversion';
    undoState.lastRecordedAt = Date.now();
    syncBodyTypeUiFromTab(tab);
    markDirty();
    refreshDraftInsights(mc);
    debouncePersist();
    return true;
  }

  // Keep text: type only (content unchanged). Binary never invents files.
  pushBodyUndoSnapshot(undoState.undo, beforeSnapshot);
  undoState.redo = [];
  tab.bodyType = toType;
  undoState.lastValue = textarea ? textarea.value : (tab.body || '');
  undoState.lastBodyType = tab.bodyType;
  undoState.lastInputType = 'conversion';
  undoState.lastRecordedAt = Date.now();
  syncBodyTypeUiFromTab(tab);
  markDirty();
  refreshDraftInsights(mc);
  debouncePersist();
  return true;
}

function handleBodyTypeSelectChange(mc, selectEl) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !selectEl) return;
  var nextType = normalizeBodyType(selectEl.value);
  var prevType = normalizeBodyType(tab.bodyType);
  if (nextType === prevType) return;

  var textarea = mc.querySelector('.js-body');
  if (prevType === 'formdata') {
    tab.formData = collectFormData(mc.querySelector('.js-formdata-rows'));
  }
  if (textarea) tab.body = textarea.value;
  if (prevType === 'binary') {
    var binaryInput = mc.querySelector('.js-binary-path');
    if (binaryInput) tab.binaryFilePath = binaryInput.value || '';
  }

  var payload = {
    bodyType: prevType,
    body: tab.body || '',
    formData: tab.formData || [],
    binaryFilePath: tab.binaryFilePath || '',
  };
  var api = getBodyConversionApi();
  var hasContent = api && typeof api.hasContent === 'function'
    ? api.hasContent(payload)
    : !!(String(payload.body || '').trim()
      || (payload.formData || []).some(function(f) { return f && (f.key || f.value); })
      || String(payload.binaryFilePath || '').trim());

  // 빈 바디: 확인 없이 타입만 변경 (기존 동작)
  if (!hasContent) {
    tab.bodyType = nextType;
    resetBodyUndoState(tab, tab.body || '', textarea);
    syncBodyTypeUiFromTab(tab);
    markDirty();
    refreshDraftInsights(mc);
    debouncePersist();
    return;
  }

  // 선택값을 일단 되돌린 뒤 확인 (Cancel 시 원본 유지)
  selectEl.value = prevType;

  var canConvert = false;
  if (api && typeof api.isBinaryTransition === 'function' && api.isBinaryTransition(prevType, nextType)) {
    canConvert = false;
  } else if (api && typeof api.supportsConversion === 'function') {
    canConvert = api.supportsConversion(prevType, nextType);
  } else if (nextType === 'none') {
    canConvert = true;
  }

  showBodyTypeConversionConfirm({
    fromType: prevType,
    toType: nextType,
    canConvert: canConvert,
    onAction: function(action) {
      if (action === 'cancel') {
        selectEl.value = prevType;
        return;
      }
      if (action === 'convert') {
        applyBodyTypeChange(mc, tab, nextType, 'convert');
        return;
      }
      if (action === 'keep') {
        applyBodyTypeChange(mc, tab, nextType, 'keep');
      }
    },
  });
}

var BODY_TYPE_CT = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  formdata: 'multipart/form-data',
  binary: 'application/octet-stream',
  raw: 'text/plain',
};

function syncAutoContentType(mc, bodyType) {
  var headerRows = mc.querySelector('.js-header-rows');
  if (!headerRows) return;

  
  headerRows.querySelectorAll('.kv-row[data-auto="content-type"]').forEach(function(r) { r.remove(); });

  var ct = BODY_TYPE_CT[bodyType];
  if (!ct) return;

  
  var hasManual = false;
  headerRows.querySelectorAll('.kv-row:not([data-auto])').forEach(function(row) {
    var keyInput = row.querySelectorAll('input[type="text"]')[0];
    if (keyInput && keyInput.value.toLowerCase() === 'content-type') hasManual = true;
  });
  if (hasManual) return;

  
  var row = document.createElement('div');
  row.className = 'kv-row';
  row.dataset.auto = 'content-type';
  row.innerHTML =
    '<input type="checkbox" checked disabled/>' +
    '<input type="text" value="Content-Type" readonly style="opacity:.6"/>' +
    '<input type="text" value="' + ct + '" readonly style="opacity:.6"/>' +
    '<span class="auto-badge">(auto)</span>';
  headerRows.insertBefore(row, headerRows.firstChild);
}

function bindRequestBodyEditor(mc) {
  mc.querySelector('.js-body-type')?.addEventListener('change', (e) => {
    handleBodyTypeSelectChange(mc, e.target);
  });
  
  var initBodyType = mc.querySelector('.js-body-type')?.value || 'none';
  if (initBodyType !== 'none' && !isWebSocketTab(tabs.find(t => t.id === activeTabId))) syncAutoContentType(mc, initBodyType);

  
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

  // === textarea auto grow + JSON body highlight mirror ===
  var bodyTa = mc.querySelector('.js-body');
  var bodyEditorEl = mc.querySelector('.js-body-editor');
  var bodyHighlightEl = mc.querySelector('.js-body-highlight');
  var bodyHighlightCodeEl = mc.querySelector('.js-body-highlight-code');
  var bodyHighlightTimer = null;
  var bodyHighlightLastSource = null;
  if (bodyTa) {
    var bodyTab = tabs.find(t => t.id === activeTabId);
    ensureBodyUndoState(bodyTab, bodyTa);
    function refreshBodyJsonHighlight(immediate) {
      if (!bodyEditorEl || !bodyHighlightCodeEl) return;
      var activeBodyTab = tabs.find(t => t.id === activeTabId);
      var bodyType = mc.querySelector('.js-body-type')?.value || activeBodyTab?.bodyType || 'none';
      var language = bodyHighlightLanguage(bodyType);
      var enabled = shouldEnableBodySyntaxHighlight(bodyType, isWebSocketTab(activeBodyTab));
      bodyEditorEl.classList.toggle('is-syntax-highlight', enabled);
      bodyEditorEl.classList.remove('is-json-highlight');
      if (!enabled) {
        if (bodyHighlightTimer) {
          clearTimeout(bodyHighlightTimer);
          bodyHighlightTimer = null;
        }
        if (bodyHighlightLastSource !== null) {
          bodyHighlightCodeEl.textContent = '';
          bodyHighlightLastSource = null;
        }
        bodyEditorEl.removeAttribute('data-highlight-lang');
        return;
      }
      bodyEditorEl.setAttribute('data-highlight-lang', language);
      var run = function() {
        bodyHighlightTimer = null;
        var value = bodyTa.value;
        var stamp = language + '\\0' + value;
        if (bodyHighlightLastSource === stamp) {
          syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
          return;
        }
        bodyHighlightLastSource = stamp;
        bodyHighlightCodeEl.innerHTML = highlightBodySource(value, language);
        syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
      };
      if (immediate) {
        if (bodyHighlightTimer) {
          clearTimeout(bodyHighlightTimer);
          bodyHighlightTimer = null;
        }
        run();
        return;
      }
      if (bodyHighlightTimer) clearTimeout(bodyHighlightTimer);
      bodyHighlightTimer = setTimeout(run, BODY_JSON_HIGHLIGHT_DEBOUNCE_MS);
    }
    function autoGrow() {
      bodyTa.style.height = 'auto';
      var h = Math.max(100, Math.min(400, bodyTa.scrollHeight));
      bodyTa.style.height = h + 'px';
      if (bodyEditorEl) bodyEditorEl.style.height = h + 'px';
      syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
    }
    bodyTa._tessraAutoGrow = autoGrow;
    bodyTa._tessraRefreshBodyHighlight = refreshBodyJsonHighlight;
    bodyTa.addEventListener('input', function(event) {
      recordBodyEditorInput(bodyTab, bodyTa, event);
      autoGrow();
      refreshBodyJsonHighlight(false);
      markDirty();
      refreshDraftInsights(mc);
    });
    bodyTa.addEventListener('scroll', function() {
      syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
    });
    bodyTa.addEventListener('keydown', function(e) {
      if (handleBodyEditorUndoRedoShortcut(bodyTab, bodyTa, e)) return;
      if (e.key === 'Enter') { setTimeout(autoGrow, 0); }
    });
    bodyTa.addEventListener('keyup', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    bodyTa.addEventListener('mouseup', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    bodyTa.addEventListener('select', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    bodyTa.addEventListener('focus', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    autoGrow();
    refreshBodyJsonHighlight(true);
  }
}
`;
}
