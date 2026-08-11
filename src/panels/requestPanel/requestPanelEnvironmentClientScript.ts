/** Request panel on-demand Environment Editor client fragments (same Webview lexical scope as main client script). */

/** State + lifecycle functions (composed before Status; no immediate DOM access). */
export function getRequestPanelEnvironmentClientScript(): string {
  return /*js*/ `
let editingEnvId = null;
let envEditorEnvName = null;
let envEditorVariableCount = 0;
let envSaveTimer = null;
let envAutoSavedTimer = null;

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
envVarRows.addEventListener('focusout', () => {
  if (!editingEnvId) return;
  clearTimeout(envSaveTimer);
  envAutoSave();
});
refreshEnvironmentEditorSummary();
syncEnvironmentEditorControls();
updateStaticLocalizedText();
`;
}
