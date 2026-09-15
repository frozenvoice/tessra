/** Request panel Default Headers Editor client fragments (same Webview lexical scope as main client script). */

/** Reveal / hide / row sync helpers (composed after Environment functions; no immediate DOM access). */
export function getRequestPanelDefaultHeadersClientScript(): string {
  return /*js*/ `
function setDefaultHeadersEditorData(headers) {
  var items = Array.isArray(headers) ? headers : [];
  if (!defaultHeaderRows) return;
  defaultHeaderRows.innerHTML = kvRowsHtml(items);
  defaultHeaderRows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
}

function hideDefaultHeadersEditor() {
  if (!defaultHeadersEditor) return;
  defaultHeadersEditor.classList.remove('linked-focus-active');
  defaultHeadersEditor.classList.add('hidden');
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
`;
}

/** DOM refs + event bindings (composed after Environment bindings; before message dispatcher). */
export function getRequestPanelDefaultHeadersBindingsScript(): string {
  return /*js*/ `
const defaultHeadersEditor = document.getElementById('defaultHeadersEditor');
const defaultHeaderRows = document.getElementById('defaultHeaderRows');

document.getElementById('addDefaultHeaderBtn').addEventListener('click', () => {
  addKvRow(defaultHeaderRows);
  defaultHeaderRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
});
document.getElementById('defaultHeadersCloseBtn').addEventListener('click', () => {
  hideDefaultHeadersEditor();
});
bindKvRow(defaultHeaderRows, { onChange: function() {} });
document.getElementById('defaultHeadersSaveBtn').addEventListener('click', () => {
  const headers = collectKv(defaultHeaderRows);
  workspaceDefaultHeaders = headers;
  refreshDefaultHeadersBanner(mainContent);
  refreshStatusStrip(mainContent);
  refreshRequestPreflight(mainContent);
  vscode.postMessage({ type: 'saveDefaultHeaders', headers: headers });
});
`;
}
