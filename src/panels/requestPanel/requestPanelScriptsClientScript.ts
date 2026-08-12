/** Request panel Scripts Editor client fragment (same Webview lexical scope as main client script). */

export function getRequestPanelScriptsClientScript(): string {
  return /*js*/ `
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

function renderScriptsEditorContents(tab) {
  return renderScriptHelpers(tab) +
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

function collectScripts(mc) {
  return {
    preRequest: mc.querySelector('.js-script-prerequest')?.value || '',
    test: mc.querySelector('.js-script-test')?.value || '',
  };
}

function bindRequestScriptsEditor(mc) {
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
}
`;
}
