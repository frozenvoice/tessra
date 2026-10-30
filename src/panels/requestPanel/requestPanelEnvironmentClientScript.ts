/** Request panel on-demand Environment Editor client fragments (same Webview lexical scope as main client script). */

/** State + lifecycle functions (composed before Status; no immediate DOM access). */
export function getRequestPanelEnvironmentClientScript(): string {
  return /*js*/ `
let editingEnvId = null;
let envEditorEnvName = null;
let envEditorVariableCount = 0;
let envEditorRowCount = 0;
let envSaveTimer = null;
let envAutoSavedTimer = null;
let envEditorScope = 'environment';
let envEditorScopeToken = null;
let pendingSecretReveal = null;
let secretRevealTimer = null;

function canEditEnvironmentVariables() {
  return envEditorScope === 'workspace' || !!editingEnvId;
}

function clearSecretReveals() {
  pendingSecretReveal = null;
  clearTimeout(secretRevealTimer);
  secretRevealTimer = null;
  envVarRows?.querySelectorAll('.env-variable-row[data-protected="1"]').forEach(function(row) {
    var input = row.querySelector('.js-env-value');
    if (input) { input.value = ''; input.type = 'password'; }
    var button = row.querySelector('[data-secret-action="hide"]');
    if (button) {
      button.dataset.secretAction = 'reveal';
      button.textContent = tr('webview.secretReveal');
      button.setAttribute('aria-label', tr('webview.secretReveal'));
    }
  });
}

function collectEnvironmentVariables() {
  var variables = [];
  envVarRows?.querySelectorAll('.env-variable-row').forEach(function(row) {
    var source = row._variableMetadata || {};
    var key = row.querySelector('.js-env-key')?.value || '';
    var protectedRow = !!(source.secretRef || source.secretPendingRef);
    if (!key && !protectedRow) return;
    var variable = { id: source.id, key: key, value: protectedRow ? '' : (row.querySelector('.js-env-value')?.value || ''), enabled: row.querySelector('input[type="checkbox"]')?.checked !== false };
    if (source.secretRef) variable.secretRef = { id: source.secretRef.id };
    if (source.secretPendingRef) variable.secretPendingRef = { id: source.secretPendingRef.id };
    variables.push(variable);
  });
  return variables;
}

function createEnvironmentVariableRow(variable) {
  var protectedRow = !!(variable.secretRef || variable.secretPendingRef);
  var maskPlainValue = !protectedRow && isSensitiveKeyName(variable.key || '');
  var metadata = { id: variable.id || crypto.randomUUID() };
  if (variable.secretRef) metadata.secretRef = { id: variable.secretRef.id };
  if (variable.secretPendingRef) metadata.secretPendingRef = { id: variable.secretPendingRef.id };
  var state = variable.secretPendingRef ? 'pending' : (variable.secretState || 'missing');
  var stateKey = 'webview.secretState' + state.charAt(0).toUpperCase() + state.slice(1);
  var row = document.createElement('div');
  row.className = 'kv-row env-variable-row';
  row.dataset.variableId = metadata.id;
  row.dataset.protected = protectedRow ? '1' : '0';
  row._variableMetadata = metadata;
  row._secretState = state;
  row.style.flexWrap = 'wrap';
  var secretButton = function(action, label) {
    return '<button type="button" class="ghost-btn" data-secret-action="' + action + '" aria-label="' + escapeAttr(tr(label)) + '">' + escapeHtml(tr(label)) + '</button>';
  };
  row.innerHTML = '<input type="checkbox" aria-label="' + escapeAttr(tr('webview.enableRow')) + '"' + (variable.enabled !== false ? ' checked' : '') + '/>' +
    '<input type="text" class="js-env-key" aria-label="' + escapeAttr(tr('webview.key')) + '" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(variable.key || '') + '" style="min-width:80px"/>' +
    '<input type="' + (protectedRow || maskPlainValue ? 'password' : 'text') + '" class="js-env-value js-kv-value" aria-label="' + escapeAttr(tr(protectedRow ? 'webview.secretProtectedValue' : 'webview.value')) + '" placeholder="' + escapeAttr(tr(protectedRow ? stateKey : 'webview.value')) + '" value="' + escapeAttr(protectedRow ? '' : (variable.value || '')) + '"' + (protectedRow ? ' readonly autocomplete="off"' : '') + ' style="min-width:80px"/>' +
    (!protectedRow ? '<button type="button" class="kv-reveal' + (maskPlainValue ? '' : ' hidden') + '" data-secret-action="toggle-plain" title="' + escapeAttr(tr('webview.revealValue')) + '">' + escapeHtml(tr('webview.revealShort')) + '</button>' : '') +
    (protectedRow ? '<span class="secret-state" role="status">' + escapeHtml(tr(stateKey)) + '</span>' : '') +
    '<span class="env-variable-actions" style="display:inline-flex;gap:3px;flex-wrap:wrap">' +
      (variable.secretPendingRef
        ? secretButton('resume', 'webview.secretResume') + secretButton('cancel', 'webview.secretCancel')
        : protectedRow
          ? secretButton('set', 'webview.secretSet') + (state === 'set' ? secretButton('reveal', 'webview.secretReveal') : '')
          : secretButton('protect', 'webview.secretProtect')) +
      '<button class="rm" type="button" data-secret-action="remove" aria-label="' + escapeAttr(tr(protectedRow ? 'webview.secretRemove' : 'webview.remove')) + '" title="' + escapeAttr(tr(protectedRow ? 'webview.secretRemove' : 'webview.remove')) + '">&times;</button>' +
    '</span>';
  return row;
}

function renderEnvironmentVariableRows(variables) {
  clearSecretReveals();
  envVarRows.replaceChildren();
  (variables || []).forEach(function(variable) { envVarRows.appendChild(createEnvironmentVariableRow(variable)); });
}

function receiveSecretVariableReveal(msg) {
  if (!pendingSecretReveal || !isEnvironmentEditorOpen() || msg.scopeToken !== envEditorScopeToken ||
      msg.variableId !== pendingSecretReveal.variableId || msg.revealRequestId !== pendingSecretReveal.revealRequestId ||
      (msg.envId || null) !== editingEnvId || typeof msg.value !== 'string') return;
  var row = Array.from(envVarRows.querySelectorAll('.env-variable-row')).find(function(item) { return item.dataset.variableId === msg.variableId; });
  if (!row || row.dataset.protected !== '1') return;
  clearSecretReveals();
  var input = row.querySelector('.js-env-value');
  input.type = 'text';
  input.value = msg.value;
  var button = row.querySelector('[data-secret-action="reveal"]');
  if (button) {
    button.dataset.secretAction = 'hide';
    button.textContent = tr('webview.secretHide');
    button.setAttribute('aria-label', tr('webview.secretHide'));
  }
  secretRevealTimer = setTimeout(clearSecretReveals, 30000);
}

function refreshEnvironmentVariableLabels() {
  if (!envVarRows) return;
  var variables = collectEnvironmentVariables();
  variables.forEach(function(variable) {
    var row = Array.from(envVarRows.querySelectorAll('.env-variable-row')).find(function(item) { return item.dataset.variableId === variable.id; });
    if (row) variable.secretState = row._secretState;
  });
  // 값 보기를 해제하고 현재 편집 내용과 참조 metadata만 다시 그린다.
  renderEnvironmentVariableRows(variables);
}

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
  var hasEnvironment = canEditEnvironmentVariables();
  if (envEditorName) {
    envEditorName.textContent = envEditorScope === 'workspace' ? tr('webview.workspaceVariables') : (hasEnvironment ? envEditorEnvName : tr('webview.environmentNone'));
    envEditorName.classList.toggle('muted', !hasEnvironment);
  }
  if (envEditorVarCount) {
    envEditorVarCount.textContent = hasEnvironment ? '(' + tfCount('environment.vars', envEditorRowCount) + ')' : '';
  }
}

function refreshEnvironmentEditorCountFromRows() {
  envEditorRowCount = collectEnvironmentVariables().length;
  if (envEditorScope === 'environment') envEditorVariableCount = envEditorRowCount;
  refreshEnvironmentEditorSummary();
  refreshStatusStrip(mainContent);
}

function syncEnvironmentEditorControls() {
  if (addEnvVarBtn) {
    addEnvVarBtn.disabled = !canEditEnvironmentVariables();
  }
}

function hideEnvironmentEditor() {
  clearSecretReveals();
  if (!envEditor) return;
  envEditor.classList.add('hidden');
  envEditor.classList.remove('linked-focus-active');
  syncEnvironmentStripDisclosureState();
  refreshEnvironmentEditorLayout();
}

function setEnvironmentEditorData(envId, envName, variables, scopeToken, scope) {
  flushPendingEnvironmentSave();
  clearSecretReveals();
  var nextScope = scope === 'workspace' ? 'workspace' : 'environment';
  // 저장 직후 같은 대상의 갱신이면 방금 켠 Auto-saved 표시를 지우지 않는다.
  var sameEditorTarget = envEditorScope === nextScope && editingEnvId === (envId || null);
  envEditorScope = nextScope;
  envEditorScopeToken = scopeToken || null;
  editingEnvId = envId || null;
  envEditorEnvName = envName || null;
  var items = Array.isArray(variables) ? variables : [];
  envEditorRowCount = canEditEnvironmentVariables() ? items.length : 0;
  if (envEditorScope === 'environment') envEditorVariableCount = envEditorRowCount;
  renderEnvironmentVariableRows(canEditEnvironmentVariables() ? items : []);
  var workspaceNote = document.getElementById('workspaceVariablesNote');
  if (workspaceNote) workspaceNote.classList.toggle('hidden', envEditorScope !== 'workspace');
  envDirtyDot?.classList.remove('show');
  if (!sameEditorTarget) {
    clearTimeout(envAutoSavedTimer);
    envAutoSaved?.classList.remove('show');
  }
  refreshEnvironmentEditorSummary();
  syncEnvironmentEditorControls();
  if (!canEditEnvironmentVariables()) {
    hideEnvironmentEditor();
  } else {
    refreshEnvironmentEditorLayout();
  }
}

function isEnvironmentEditorOpen() {
  return !!(envEditor && !envEditor.classList.contains('hidden'));
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

function envMarkDirty() {
  envDirtyDot.classList.add('show');
  envAutoSaved.classList.remove('show');
}

function envAutoSave() {
  clearTimeout(envSaveTimer);
  envSaveTimer = null;
  if (!canEditEnvironmentVariables()) return;
  const vars = collectEnvironmentVariables();
  vscode.postMessage({ type: envEditorScope === 'workspace' ? 'saveWorkspaceVariables' : 'saveEnvironmentVars', envId: editingEnvId, scopeToken: envEditorScopeToken, variables: vars });
  
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
`;
}

/** DOM refs + event bindings (composed near original late-init location before default-headers editor). */
export function getRequestPanelEnvironmentBindingsScript(): string {
  return /*js*/ `
const envEditor = document.getElementById('envEditor');
const envEditorName = document.getElementById('envEditorName');
const envEditorVarCount = document.getElementById('envEditorVarCount');
const envVarRows = document.getElementById('envVarRows');
const addEnvVarBtn = document.getElementById('addEnvVarBtn');
const envCloseBtn = document.getElementById('envCloseBtn');
const envDirtyDot = document.getElementById('envDirtyDot');
const envAutoSaved = document.getElementById('envAutoSaved');

addEnvVarBtn.addEventListener('click', () => {
  if (!canEditEnvironmentVariables()) return;
  envVarRows.appendChild(createEnvironmentVariableRow({ key: '', value: '', enabled: true }));
  refreshEnvironmentEditorCountFromRows();
  envScheduleSave();
});
envCloseBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  hideEnvironmentEditor();
});
envVarRows.addEventListener('input', (event) => {
    var row = event.target.closest('.env-variable-row');
    if (row?.dataset.protected !== '1' && event.target.classList.contains('js-env-key')) syncKvRowSensitivity(row);
    refreshEnvironmentEditorCountFromRows();
    envScheduleSave();
});
envVarRows.addEventListener('change', () => {
  refreshEnvironmentEditorCountFromRows();
  envScheduleSave();
});
envVarRows.addEventListener('click', function(event) {
  var button = event.target.closest('[data-secret-action]');
  var row = button?.closest('.env-variable-row');
  if (!button || !row || !canEditEnvironmentVariables()) return;
  var action = button.dataset.secretAction;
  if (action === 'toggle-plain') {
    var input = row.querySelector('.js-env-value');
    var reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.textContent = tr(reveal ? 'webview.hideShort' : 'webview.revealShort');
    button.title = tr(reveal ? 'webview.hideValue' : 'webview.revealValue');
    return;
  }
  if (action === 'hide') { clearSecretReveals(); return; }
  if (action === 'remove' && row.dataset.protected !== '1') {
    row.remove(); refreshEnvironmentEditorCountFromRows(); envScheduleSave(); return;
  }
  // 평문 편집을 먼저 전송한다. 호스트는 save/action 메시지를 순서대로 처리한다.
  envAutoSave();
  var request = { type: 'secretVariableAction', envId: editingEnvId, scope: envEditorScope, scopeToken: envEditorScopeToken, variableId: row.dataset.variableId, action: action };
  if (action === 'reveal') {
    clearSecretReveals();
    request.revealRequestId = crypto.randomUUID();
    pendingSecretReveal = { variableId: request.variableId, revealRequestId: request.revealRequestId };
  } else clearSecretReveals();
  vscode.postMessage(request);
});
document.getElementById('openWorkspaceVariablesBtn')?.addEventListener('click', function() {
  flushPendingEnvironmentSave();
  clearSecretReveals();
  vscode.postMessage({ type: 'openWorkspaceVariables' });
});
window.addEventListener('beforeunload', clearSecretReveals);
window.addEventListener('pagehide', clearSecretReveals);
envVarRows.addEventListener('focusout', () => {
  if (!canEditEnvironmentVariables()) return;
  clearTimeout(envSaveTimer);
  envAutoSave();
});
refreshEnvironmentEditorSummary();
syncEnvironmentEditorControls();
updateStaticLocalizedText();
`;
}
