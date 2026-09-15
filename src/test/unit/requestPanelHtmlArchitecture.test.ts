import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractJsTemplate(source: string): string {
  const startMarker = 'return /*js*/ `';
  const start = source.indexOf(startMarker);
  const end = source.lastIndexOf('`;');
  assert.ok(start >= 0 && end > start, 'js template markers should exist');
  return source.slice(start + startMarker.length, end);
}

describe('requestPanelHtml architecture (Phase 1/2/3/4/5/6/7/8/9/10/11 split)', () => {
  it('keeps getRequestPanelHtml as a thin composition over styles/markup/clientScript', () => {
    const html = read('src/panels/requestPanel/requestPanelHtml.ts');
    assert.match(html, /from '\.\/requestPanelStyles'/);
    assert.match(html, /from '\.\/requestPanelMarkup'/);
    assert.match(html, /from '\.\/requestPanelClientScript'/);
    assert.match(html, /export function getRequestPanelHtml\(/);
    assert.match(html, /getRequestPanelStyles\(/);
    assert.match(html, /getRequestPanelMarkup\(/);
    assert.match(html, /getRequestPanelClientScript\(/);

    // Orchestration must not re-absorb the giant CSS/client bodies.
    assert.ok(html.split(/\n/).length < 120, 'requestPanelHtml.ts should stay a thin orchestrator');
    assert.doesNotMatch(html, /\.tab-bar\{display:flex/);
    assert.doesNotMatch(html, /acquireVsCodeApi\(\)/);
  });

  it('ships dedicated styles, markup, client script, Body, Response, Runner, Environment, Default Headers, Status, WebSocket, Auth, Scripts, and Settings client modules', () => {
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelStyles.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelMarkup.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelBodyClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelResponseClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelRunnerClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelEnvironmentClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelDefaultHeadersClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelStatusClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelWebSocketClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelAuthClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelScriptsClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelSettingsClientScript.ts')));

    const styles = read('src/panels/requestPanel/requestPanelStyles.ts');
    const markup = read('src/panels/requestPanel/requestPanelMarkup.ts');
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const body = read('src/panels/requestPanel/requestPanelBodyClientScript.ts');
    const response = read('src/panels/requestPanel/requestPanelResponseClientScript.ts');
    const runner = read('src/panels/requestPanel/requestPanelRunnerClientScript.ts');
    const environment = read('src/panels/requestPanel/requestPanelEnvironmentClientScript.ts');
    const defaultHeaders = read('src/panels/requestPanel/requestPanelDefaultHeadersClientScript.ts');
    const status = read('src/panels/requestPanel/requestPanelStatusClientScript.ts');
    const websocket = read('src/panels/requestPanel/requestPanelWebSocketClientScript.ts');
    const auth = read('src/panels/requestPanel/requestPanelAuthClientScript.ts');
    const scripts = read('src/panels/requestPanel/requestPanelScriptsClientScript.ts');
    const settings = read('src/panels/requestPanel/requestPanelSettingsClientScript.ts');

    assert.match(styles, /export function getRequestPanelStyles\(/);
    assert.match(markup, /export function getRequestPanelMarkup\(/);
    assert.match(script, /export function getRequestPanelClientScript\(/);
    assert.match(body, /export function getRequestPanelBodyClientScript\(/);
    assert.match(response, /export function getRequestPanelResponseClientScript\(/);
    assert.match(runner, /export function getRequestPanelRunnerClientScript\(/);
    assert.match(environment, /export function getRequestPanelEnvironmentClientScript\(/);
    assert.match(environment, /export function getRequestPanelEnvironmentBindingsScript\(/);
    assert.match(defaultHeaders, /export function getRequestPanelDefaultHeadersClientScript\(/);
    assert.match(defaultHeaders, /export function getRequestPanelDefaultHeadersBindingsScript\(/);
    assert.match(status, /export function getRequestPanelStatusClientScript\(/);
    assert.match(websocket, /export function getRequestPanelWebSocketClientScript\(/);
    assert.match(auth, /export function getRequestPanelAuthClientScript\(/);
    assert.match(scripts, /export function getRequestPanelScriptsClientScript\(/);
    assert.match(settings, /export function getRequestPanelSettingsClientScript\(/);
    assert.match(styles, /\.tab-bar\{display:flex/);
    assert.match(markup, /data-testid="environment-disclosure"/);
    assert.match(script, /acquireVsCodeApi\(\)/);
    assert.match(body, /function handleBodyTypeSelectChange\(/);
    assert.match(body, /function bindRequestBodyEditor\(/);
    assert.match(body, /TessraBodyConversion/);
    assert.match(response, /function buildHttpResponseAreaHtml\(/);
    assert.match(response, /function bindResponseViewerEvents\(/);
    assert.match(response, /data-testid="response-pin"/);
    assert.match(response, /data-testid="response-compare"/);
    assert.match(runner, /function showRunnerSetup\(/);
    assert.match(runner, /function showRunner\(/);
    assert.match(runner, /data-testid="runner-start"/);
    assert.match(runner, /data-testid="runner-request-check"/);
    assert.match(environment, /function revealEnvironmentEditor\(/);
    assert.match(environment, /function setEnvironmentEditorData\(/);
    assert.match(environment, /function envScheduleSave\(/);
    assert.match(environment, /type: 'saveEnvironmentVars'/);
    assert.match(defaultHeaders, /function revealDefaultHeadersEditor\(/);
    assert.match(defaultHeaders, /function hideDefaultHeadersEditor\(/);
    assert.match(defaultHeaders, /function setDefaultHeadersEditorData\(/);
    assert.match(defaultHeaders, /type: 'saveDefaultHeaders'/);
    assert.match(status, /function renderStatusStrip\(/);
    assert.match(status, /function buildStatusStripSegments\(/);
    assert.match(status, /testId = 'status-environment'/);
    assert.match(status, /testId = 'status-variable-usage'/);
    assert.match(websocket, /function renderWebSocketResponse\(/);
    assert.match(websocket, /function websocketConnect\(/);
    assert.match(websocket, /type: 'websocketConnect'/);
    assert.match(auth, /function authHtml\(/);
    assert.match(auth, /function collectAuth\(/);
    assert.match(auth, /function bindRequestAuthEditor\(/);
    assert.match(scripts, /function scriptTemplateSource\(/);
    assert.match(scripts, /function renderScriptsEditorContents\(/);
    assert.match(scripts, /function insertScriptTemplate\(/);
    assert.match(scripts, /function collectScripts\(/);
    assert.match(scripts, /function bindRequestScriptsEditor\(/);
    assert.match(settings, /function syncSettingsToggleStates\(/);
    assert.match(settings, /function renderSettingsEditorContents\(/);
    assert.match(settings, /function bindRequestSettingsEditor\(/);
  });

  it('composes Body client fragment into main client script without duplicating Body impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const body = read('src/panels/requestPanel/requestPanelBodyClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const bodyJs = extractJsTemplate(body);

    assert.match(script, /from '\.\/requestPanelBodyClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelBodyClientScript()}'),
      'main client script should insert Body fragment via composition'
    );
    assert.match(scriptJs, /bindRequestBodyEditor\(mc\)/);

    // Body-specific implementations live in the Body module once.
    assert.match(bodyJs, /function isBodyUndoRedoShortcut\(/);
    assert.match(bodyJs, /function syncAutoContentType\(/);
    assert.match(bodyJs, /function applyBodyTypeChange\(/);
    assert.doesNotMatch(scriptJs, /function isBodyUndoRedoShortcut\(/);
    assert.doesNotMatch(scriptJs, /function syncAutoContentType\(/);
    assert.doesNotMatch(scriptJs, /function applyBodyTypeChange\(/);
    assert.doesNotMatch(scriptJs, /const BODY_UNDO_MAX_ENTRIES/);

    // Shared helpers Body needs remain in main (not forcibly dragged into Body module).
    assert.match(scriptJs, /function normalizeBodyType\(/);
    assert.match(scriptJs, /function bodyTypeLabel\(/);
    assert.match(scriptJs, /function isEditableTarget\(/);

    // Ordering: shared editable-target helper before Body fragment; Body fragment before createTab.
    const editableIdx = scriptJs.indexOf('function isEditableTarget(');
    const bodyInsertIdx = scriptJs.indexOf('${getRequestPanelBodyClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(editableIdx >= 0 && bodyInsertIdx > editableIdx, 'Body fragment should follow shared helpers');
    assert.ok(createTabIdx > bodyInsertIdx, 'createTab should follow Body fragment composition');
  });

  it('composes Response client fragment into main client script without duplicating Response impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const response = read('src/panels/requestPanel/requestPanelResponseClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const responseJs = extractJsTemplate(response);

    assert.match(script, /from '\.\/requestPanelResponseClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelResponseClientScript()}'),
      'main client script should insert Response fragment via composition'
    );
    assert.match(scriptJs, /buildHttpResponseAreaHtml\(tab\)/);
    assert.match(scriptJs, /bindResponseViewerEvents\(mc\)/);

    // Response-specific implementations live in the Response module once.
    assert.match(responseJs, /function normalizeCompareList\(/);
    assert.match(responseJs, /function buildJsonTree\(/);
    assert.match(responseJs, /function hasHtmlPreview\(/);
    assert.match(responseJs, /function renderResponseBody\(/);
    assert.match(responseJs, /function switchResponseTabInContent\(/);
    assert.match(responseJs, /function bindResponseViewerEvents\(/);
    assert.match(responseJs, /function buildHttpResponseAreaHtml\(/);
    assert.doesNotMatch(scriptJs, /function normalizeCompareList\(/);
    assert.doesNotMatch(scriptJs, /function buildJsonTree\(/);
    assert.doesNotMatch(scriptJs, /function hasHtmlPreview\(/);
    assert.doesNotMatch(scriptJs, /function renderResponseBody\(/);
    assert.doesNotMatch(scriptJs, /function switchResponseTabInContent\(/);
    assert.doesNotMatch(scriptJs, /function bindResponseViewerEvents\(/);
    assert.doesNotMatch(scriptJs, /function buildHttpResponseAreaHtml\(/);

    // Pin/Compare stay primary (not overflow-only) in Response markup.
    assert.match(responseJs, /data-testid="response-pin"/);
    assert.match(responseJs, /data-testid="response-compare"/);
    assert.match(responseJs, /data-testid="response-overflow"/);
    assert.match(responseJs, /Pin\/Compare stay on the primary toolbar/);

    // Shared helpers Response needs remain in main.
    assert.match(scriptJs, /function isBinaryContentType\(/);
    assert.match(scriptJs, /function formatSize\(/);
    assert.match(scriptJs, /function buildResponseTimingMetaHtml\(/);
    assert.match(scriptJs, /function applyResponseTiming\(/);

    // Ordering: Body fragment before Response fragment; Response before createTab.
    const bodyInsertIdx = scriptJs.indexOf('${getRequestPanelBodyClientScript()}');
    const responseInsertIdx = scriptJs.indexOf('${getRequestPanelResponseClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(bodyInsertIdx >= 0 && responseInsertIdx > bodyInsertIdx, 'Response fragment should follow Body fragment');
    assert.ok(createTabIdx > responseInsertIdx, 'createTab should follow Response fragment composition');
  });

  it('composes Runner client fragment into main client script without duplicating Runner impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const runner = read('src/panels/requestPanel/requestPanelRunnerClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const runnerJs = extractJsTemplate(runner);

    assert.match(script, /from '\.\/requestPanelRunnerClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelRunnerClientScript()}'),
      'main client script should insert Runner fragment via composition'
    );

    // Main keeps thin dispatcher calls; implementations live in Runner module once.
    assert.match(scriptJs, /showRunnerSetup\(msg\)/);
    assert.match(scriptJs, /showRunner\(msg\)/);
    assert.match(scriptJs, /updateRunnerStatus\(msg\)/);
    assert.match(scriptJs, /updateRunnerRow\(msg\)/);
    assert.match(scriptJs, /finishRunner\(msg\)/);
    assert.match(runnerJs, /function showRunnerSetup\(/);
    assert.match(runnerJs, /function showRunner\(/);
    assert.match(runnerJs, /function updateRunnerStatus\(/);
    assert.match(runnerJs, /function updateRunnerRow\(/);
    assert.match(runnerJs, /function finishRunner\(/);
    assert.match(runnerJs, /var runnerOverlay = null/);
    assert.match(runnerJs, /type: 'startCollectionRun'/);
    assert.match(runnerJs, /type: 'stopCollectionRun'/);
    assert.match(runnerJs, /type: 'rerunFailedCollection'/);
    assert.doesNotMatch(scriptJs, /function showRunnerSetup\(/);
    assert.doesNotMatch(scriptJs, /function showRunner\(/);
    assert.doesNotMatch(scriptJs, /function updateRunnerStatus\(/);
    assert.doesNotMatch(scriptJs, /function updateRunnerRow\(/);
    assert.doesNotMatch(scriptJs, /function finishRunner\(/);
    assert.doesNotMatch(scriptJs, /var runnerOverlay = null/);

    // Shared helpers Runner needs remain in main.
    assert.match(scriptJs, /function isBinaryContentType\(/);
    assert.match(scriptJs, /function formatSize\(/);

    // Ordering: Response fragment before Runner fragment; Runner before createTab.
    const responseInsertIdx = scriptJs.indexOf('${getRequestPanelResponseClientScript()}');
    const runnerInsertIdx = scriptJs.indexOf('${getRequestPanelRunnerClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(responseInsertIdx >= 0 && runnerInsertIdx > responseInsertIdx, 'Runner fragment should follow Response fragment');
    assert.ok(createTabIdx > runnerInsertIdx, 'createTab should follow Runner fragment composition');
  });

  it('composes Status client fragment into main client script without duplicating Status impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const status = read('src/panels/requestPanel/requestPanelStatusClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const statusJs = extractJsTemplate(status);

    assert.match(script, /from '\.\/requestPanelStatusClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelStatusClientScript()}'),
      'main client script should insert Status fragment via composition'
    );
    assert.match(scriptJs, /renderStatusStrip\(tab\)/);
    assert.match(scriptJs, /refreshStatusStrip\(/);
    assert.doesNotMatch(scriptJs + statusJs, /renderLegacyStatusChipHooks|renderToplineStatusChips|refreshToplineStatusChips|renderStatusChip|renderEnvironmentStatusChip|renderEnvironmentIndicator/);

    // Status-strip implementations live in the Status module once.
    assert.match(statusJs, /function renderStatusStrip\(/);
    assert.match(statusJs, /function buildStatusStripSegments\(/);
    assert.match(statusJs, /function refreshStatusStrip\(/);
    assert.match(statusJs, /function setStatusStripExpanded\(/);
    assert.match(statusJs, /function revealVariableUsageDisclosure\(/);
    assert.match(statusJs, /function syncEnvironmentStripDisclosureState\(/);
    assert.match(statusJs, /tfCount\('environment\.vars'/);
    assert.match(statusJs, /tfCount\('webview\.stripUsedCount'/);
    assert.match(statusJs, /testId = 'status-environment'/);
    assert.match(statusJs, /testId = 'status-variable-usage'/);
    assert.match(statusJs, /data-testid="variable-usage-disclosure"/);
    assert.doesNotMatch(scriptJs, /function renderStatusStrip\(/);
    assert.doesNotMatch(scriptJs, /function buildStatusStripSegments\(/);
    assert.doesNotMatch(scriptJs, /function refreshStatusStrip\(/);
    assert.doesNotMatch(scriptJs, /function setStatusStripExpanded\(/);
    assert.doesNotMatch(scriptJs, /function syncEnvironmentStripDisclosureState\(/);

    // Shared helpers Status needs remain in main; Environment editor lives in Environment fragment.
    assert.match(scriptJs, /function renderVariableUsage\(/);
    assert.match(scriptJs, /function refreshRequestPreflight\(/);
    assert.match(scriptJs, /function renderDefaultHeadersBanner\(/);
    assert.match(scriptJs, /function collectKv\(/);
    assert.match(scriptJs, /function addKvRow\(/);

    // Ordering: Environment fragment before Status fragment; Status before createTab.
    const environmentInsertIdx = scriptJs.indexOf('${getRequestPanelEnvironmentClientScript()}');
    const statusInsertIdx = scriptJs.indexOf('${getRequestPanelStatusClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(environmentInsertIdx >= 0 && statusInsertIdx > environmentInsertIdx, 'Status fragment should follow Environment fragment');
    assert.ok(createTabIdx > statusInsertIdx, 'createTab should follow Status fragment composition');
  });

  it('composes Environment client fragment into main client script without duplicating Environment editor impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const environment = read('src/panels/requestPanel/requestPanelEnvironmentClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const environmentJs = extractJsTemplate(environment);

    assert.match(script, /from '\.\/requestPanelEnvironmentClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelEnvironmentClientScript()}'),
      'main client script should insert Environment fragment via composition'
    );
    assert.ok(
      scriptJs.includes('${getRequestPanelEnvironmentBindingsScript()}'),
      'main client script should insert Environment bindings fragment via composition'
    );
    assert.match(scriptJs, /revealEnvironmentEditor\(/);
    assert.match(scriptJs, /toggleEnvironmentEditor\(/);
    assert.match(scriptJs, /setEnvironmentEditorData\(/);

    assert.match(environmentJs, /function revealEnvironmentEditor\(/);
    assert.match(environmentJs, /function hideEnvironmentEditor\(/);
    assert.match(environmentJs, /function toggleEnvironmentEditor\(/);
    assert.match(environmentJs, /function isEnvironmentEditorOpen\(/);
    assert.match(environmentJs, /function setEnvironmentEditorData\(/);
    assert.match(environmentJs, /function envAutoSave\(/);
    assert.match(environmentJs, /function envScheduleSave\(/);
    assert.match(environmentJs, /function flushPendingEnvironmentSave\(/);
    assert.match(environmentJs, /let editingEnvId = null/);
    assert.match(environmentJs, /let envEditorVariableCount = 0/);
    assert.match(environmentJs, /setTimeout\(envAutoSave, 500\)/);
    assert.match(environmentJs, /type: 'saveEnvironmentVars'/);
    assert.match(environment, /getElementById\('envEditor'\)/);
    assert.match(environment, /addEnvVarBtn\.addEventListener/);
    assert.match(environment, /envVarRows\.addEventListener\('focusout'/);
    assert.doesNotMatch(scriptJs, /function revealEnvironmentEditor\(/);
    assert.doesNotMatch(scriptJs, /function hideEnvironmentEditor\(/);
    assert.doesNotMatch(scriptJs, /function setEnvironmentEditorData\(/);
    assert.doesNotMatch(scriptJs, /function envAutoSave\(/);
    assert.doesNotMatch(scriptJs, /function envScheduleSave\(/);
    assert.doesNotMatch(scriptJs, /let editingEnvId = null/);

    // Generic KV helpers and Status strip stay outside Environment module.
    assert.match(scriptJs, /function collectKv\(/);
    assert.match(scriptJs, /function addKvRow\(/);
    assert.match(scriptJs, /function bindKvRow\(/);
    assert.match(scriptJs, /function syncKvRowSensitivity\(/);

    // Ordering: Runner → Environment functions → Default Headers functions → Status; bindings before message dispatcher.
    const runnerInsertIdx = scriptJs.indexOf('${getRequestPanelRunnerClientScript()}');
    const environmentInsertIdx = scriptJs.indexOf('${getRequestPanelEnvironmentClientScript()}');
    const defaultHeadersFnsIdx = scriptJs.indexOf('${getRequestPanelDefaultHeadersClientScript()}');
    const statusInsertIdx = scriptJs.indexOf('${getRequestPanelStatusClientScript()}');
    const bindingsInsertIdx = scriptJs.indexOf('${getRequestPanelEnvironmentBindingsScript()}');
    const defaultHeadersBindingsIdx = scriptJs.indexOf('${getRequestPanelDefaultHeadersBindingsScript()}');
    const messageListenerIdx = scriptJs.indexOf("window.addEventListener('message'");
    assert.ok(runnerInsertIdx >= 0 && environmentInsertIdx > runnerInsertIdx, 'Environment fragment should follow Runner fragment');
    assert.ok(defaultHeadersFnsIdx > environmentInsertIdx, 'Default Headers functions should follow Environment functions');
    assert.ok(statusInsertIdx > defaultHeadersFnsIdx, 'Status fragment should follow Default Headers functions');
    assert.ok(bindingsInsertIdx > statusInsertIdx, 'Environment bindings should follow Status composition');
    assert.ok(defaultHeadersBindingsIdx > bindingsInsertIdx, 'Default Headers bindings should follow Environment bindings');
    assert.ok(messageListenerIdx > defaultHeadersBindingsIdx, 'Default Headers bindings should precede message dispatcher');
  });

  it('composes Default Headers client fragment into main client script without duplicating Default Headers editor impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const defaultHeaders = read('src/panels/requestPanel/requestPanelDefaultHeadersClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const defaultHeadersJs = extractJsTemplate(defaultHeaders);

    assert.match(script, /from '\.\/requestPanelDefaultHeadersClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelDefaultHeadersClientScript()}'),
      'main client script should insert Default Headers fragment via composition'
    );
    assert.ok(
      scriptJs.includes('${getRequestPanelDefaultHeadersBindingsScript()}'),
      'main client script should insert Default Headers bindings fragment via composition'
    );
    assert.match(scriptJs, /revealDefaultHeadersEditor\(/);
    assert.match(scriptJs, /setDefaultHeadersEditorData\(/);

    assert.match(defaultHeadersJs, /function revealDefaultHeadersEditor\(/);
    assert.match(defaultHeadersJs, /function hideDefaultHeadersEditor\(/);
    assert.match(defaultHeadersJs, /function setDefaultHeadersEditorData\(/);
    assert.match(defaultHeaders, /getElementById\('defaultHeadersEditor'\)/);
    assert.match(defaultHeaders, /addDefaultHeaderBtn/);
    assert.match(defaultHeaders, /type: 'saveDefaultHeaders'/);
    assert.match(defaultHeaders, /collectKv\(defaultHeaderRows\)/);
    assert.doesNotMatch(scriptJs, /function revealDefaultHeadersEditor\(/);
    assert.doesNotMatch(scriptJs, /function hideDefaultHeadersEditor\(/);
    assert.doesNotMatch(scriptJs, /function setDefaultHeadersEditorData\(/);
    assert.doesNotMatch(scriptJs, /getElementById\('defaultHeadersEditor'\)/);
    assert.doesNotMatch(scriptJs, /getElementById\('defaultHeadersSaveBtn'\)/);

    // Shared state / application / banner / generic KV stay outside Default Headers editor module.
    assert.match(scriptJs, /let workspaceDefaultHeaders = \[\];/);
    assert.match(scriptJs, /function renderDefaultHeadersBanner\(/);
    assert.match(scriptJs, /function refreshDefaultHeadersBanner\(/);
    assert.match(scriptJs, /function getAppliedDefaultHeaders\(/);
    assert.match(scriptJs, /function collectKv\(/);
    assert.match(scriptJs, /function addKvRow\(/);
    assert.match(scriptJs, /function bindKvRow\(/);
    assert.match(scriptJs, /function syncKvRowSensitivity\(/);

    // Explicit Save (not Environment-style autosave).
    assert.doesNotMatch(defaultHeadersJs, /focusout/);
    assert.doesNotMatch(defaultHeadersJs, /envScheduleSave/);
    assert.doesNotMatch(defaultHeadersJs, /setTimeout\(envAutoSave/);
    assert.match(defaultHeaders, /type: 'saveDefaultHeaders'/);

    // Ordering: Environment functions → Default Headers functions → Status; Env bindings → DH bindings → message.
    const environmentInsertIdx = scriptJs.indexOf('${getRequestPanelEnvironmentClientScript()}');
    const defaultHeadersFnsIdx = scriptJs.indexOf('${getRequestPanelDefaultHeadersClientScript()}');
    const statusInsertIdx = scriptJs.indexOf('${getRequestPanelStatusClientScript()}');
    const envBindingsIdx = scriptJs.indexOf('${getRequestPanelEnvironmentBindingsScript()}');
    const dhBindingsIdx = scriptJs.indexOf('${getRequestPanelDefaultHeadersBindingsScript()}');
    const messageListenerIdx = scriptJs.indexOf("window.addEventListener('message'");
    assert.ok(defaultHeadersFnsIdx > environmentInsertIdx, 'Default Headers functions should follow Environment functions');
    assert.ok(statusInsertIdx > defaultHeadersFnsIdx, 'Status should follow Default Headers functions');
    assert.ok(dhBindingsIdx > envBindingsIdx, 'Default Headers bindings should follow Environment bindings');
    assert.ok(messageListenerIdx > dhBindingsIdx, 'message dispatcher should follow Default Headers bindings');
  });

  it('composes WebSocket client fragment into main client script without duplicating WebSocket impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const websocket = read('src/panels/requestPanel/requestPanelWebSocketClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const websocketJs = extractJsTemplate(websocket);

    assert.match(script, /from '\.\/requestPanelWebSocketClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelWebSocketClientScript()}'),
      'main client script should insert WebSocket fragment via composition'
    );
    assert.match(scriptJs, /renderWebSocketResponse\(tab\)/);
    assert.match(scriptJs, /websocketConnect\(/);
    assert.match(scriptJs, /websocketDisconnect\(/);
    assert.match(scriptJs, /websocketSend\(/);
    assert.match(scriptJs, /disconnectWebSocketIfOpen\(/);
    assert.match(scriptJs, /handleWebSocketStatusMessage\(msg\)/);
    assert.match(scriptJs, /handleWebSocketMessageEvent\(msg\)/);

    // WebSocket implementations live in the WebSocket module once.
    assert.match(websocketJs, /function renderWebSocketResponse\(/);
    assert.match(websocketJs, /function websocketConnect\(/);
    assert.match(websocketJs, /function websocketDisconnect\(/);
    assert.match(websocketJs, /function websocketSend\(/);
    assert.match(websocketJs, /function appendWebSocketMessage\(/);
    assert.match(websocketJs, /function formatWebSocketCloseMessage\(/);
    assert.match(websocketJs, /function formatWebSocketErrorMessage\(/);
    assert.match(websocketJs, /function handleWebSocketStatusMessage\(/);
    assert.match(websocketJs, /function handleWebSocketMessageEvent\(/);
    assert.match(websocketJs, /type: 'websocketConnect'/);
    assert.match(websocketJs, /type: 'websocketDisconnect'/);
    assert.match(websocketJs, /type: 'websocketSend'/);
    assert.doesNotMatch(scriptJs, /function renderWebSocketResponse\(/);
    assert.doesNotMatch(scriptJs, /function websocketConnect\(/);
    assert.doesNotMatch(scriptJs, /function websocketDisconnect\(/);
    assert.doesNotMatch(scriptJs, /function websocketSend\(/);
    assert.doesNotMatch(scriptJs, /function appendWebSocketMessage\(/);
    assert.doesNotMatch(scriptJs, /function handleWebSocketStatusMessage\(/);
    assert.doesNotMatch(scriptJs, /function handleWebSocketMessageEvent\(/);

    // requestType detection / tab orchestration / keepalive normalize stay in main.
    assert.match(scriptJs, /function isWebSocketUrl\(/);
    assert.match(scriptJs, /function normalizeRequestType\(/);
    assert.match(scriptJs, /function syncRequestTypeFromUrl\(/);
    assert.match(scriptJs, /function isWebSocketTab\(/);
    assert.match(scriptJs, /function normalizeWebSocketKeepAliveInterval\(/);
    assert.match(scriptJs, /function handlePrimaryAction\(/);
    assert.match(scriptJs, /function renderPrimaryActionButton\(/);

    // Ordering: Status fragment before WebSocket fragment; WebSocket before Auth; Auth before Scripts; Scripts before createTab.
    const statusInsertIdx = scriptJs.indexOf('${getRequestPanelStatusClientScript()}');
    const websocketInsertIdx = scriptJs.indexOf('${getRequestPanelWebSocketClientScript()}');
    const authInsertIdx = scriptJs.indexOf('${getRequestPanelAuthClientScript()}');
    const scriptsInsertIdx = scriptJs.indexOf('${getRequestPanelScriptsClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(statusInsertIdx >= 0 && websocketInsertIdx > statusInsertIdx, 'WebSocket fragment should follow Status fragment');
    assert.ok(authInsertIdx > websocketInsertIdx, 'Auth fragment should follow WebSocket fragment');
    assert.ok(scriptsInsertIdx > authInsertIdx, 'Scripts fragment should follow Auth fragment');
    assert.ok(createTabIdx > scriptsInsertIdx, 'createTab should follow Scripts fragment composition');
  });

  it('composes Auth client fragment into main client script without duplicating Auth editor impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const auth = read('src/panels/requestPanel/requestPanelAuthClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const authJs = extractJsTemplate(auth);

    assert.match(script, /from '\.\/requestPanelAuthClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelAuthClientScript()}'),
      'main client script should insert Auth fragment via composition'
    );
    assert.match(scriptJs, /authHtml\(tab\.auth\)/);
    assert.match(scriptJs, /collectAuth\(mc\)/);
    assert.match(scriptJs, /bindRequestAuthEditor\(mc\)/);

    assert.match(authJs, /function authTypeLabel\(/);
    assert.match(authJs, /function authHtml\(/);
    assert.match(authJs, /function authFieldsHtml\(/);
    assert.match(authJs, /function maskedAuthInputHtml\(/);
    assert.match(authJs, /function collectAuth\(/);
    assert.match(authJs, /function bindRequestAuthEditor\(/);
    assert.match(authJs, /\['none','basic','bearer','apikey'\]/);
    assert.match(authJs, /closest\('\.auth-row'\)/);
    assert.doesNotMatch(authJs, /auth-inline-control/);
    assert.doesNotMatch(scriptJs, /function authTypeLabel\(/);
    assert.doesNotMatch(scriptJs, /function authHtml\(/);
    assert.doesNotMatch(scriptJs, /function authFieldsHtml\(/);
    assert.doesNotMatch(scriptJs, /function maskedAuthInputHtml\(/);
    assert.doesNotMatch(scriptJs, /function collectAuth\(/);
    assert.doesNotMatch(scriptJs, /function bindRequestAuthEditor\(/);

    // Shared presentation / draft lifecycle stay in main.
    assert.match(scriptJs, /function authSummaryLabel\(/);
    assert.match(scriptJs, /function collectVariableUsage\(/);
    assert.match(scriptJs, /function getUnresolvedDraftVariableNames\(/);
    assert.match(scriptJs, /function buildDraftTabFromContent\(/);
    assert.match(scriptJs, /function saveActiveTabState\(/);
    assert.match(scriptJs, /function markDirty\(/);
    assert.match(scriptJs, /function refreshDraftInsights\(/);

    // Single bind call site in main.
    const bindMatches = scriptJs.match(/bindRequestAuthEditor\(mc\)/g) || [];
    assert.strictEqual(bindMatches.length, 1, 'bindRequestAuthEditor should be called exactly once from main');

    const websocketInsertIdx = scriptJs.indexOf('${getRequestPanelWebSocketClientScript()}');
    const authInsertIdx = scriptJs.indexOf('${getRequestPanelAuthClientScript()}');
    const scriptsInsertIdx = scriptJs.indexOf('${getRequestPanelScriptsClientScript()}');
    assert.ok(authInsertIdx > websocketInsertIdx, 'Auth fragment should follow WebSocket fragment');
    assert.ok(scriptsInsertIdx > authInsertIdx, 'Scripts fragment should follow Auth fragment');
  });

  it('composes Scripts client fragment into main client script without duplicating Scripts editor impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const scripts = read('src/panels/requestPanel/requestPanelScriptsClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const scriptsJs = extractJsTemplate(scripts);

    assert.match(script, /from '\.\/requestPanelScriptsClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelScriptsClientScript()}'),
      'main client script should insert Scripts fragment via composition'
    );
    assert.match(scriptJs, /renderScriptsEditorContents\(tab\)/);
    assert.match(scriptJs, /collectScripts\(mc\)/);
    assert.match(scriptJs, /bindRequestScriptsEditor\(mc\)/);

    assert.match(scriptsJs, /function scriptTemplateSource\(/);
    assert.match(scriptsJs, /function renderScriptHelpers\(/);
    assert.match(scriptsJs, /function renderScriptsEditorContents\(/);
    assert.match(scriptsJs, /function insertScriptTemplate\(/);
    assert.match(scriptsJs, /function collectScripts\(/);
    assert.match(scriptsJs, /function bindRequestScriptsEditor\(/);
    assert.match(scriptsJs, /preRequestEnv/);
    assert.match(scriptsJs, /testCaptureValue/);
    assert.match(scriptsJs, /testStatusCheck/);
    assert.match(scriptsJs, /data-testid="script-prerequest"/);
    assert.match(scriptsJs, /data-testid="script-test"/);
    assert.match(scriptsJs, /type: 'openGuide'/);
    assert.doesNotMatch(scriptJs, /function scriptTemplateSource\(/);
    assert.doesNotMatch(scriptJs, /function renderScriptHelpers\(/);
    assert.doesNotMatch(scriptJs, /function renderScriptsEditorContents\(/);
    assert.doesNotMatch(scriptJs, /function insertScriptTemplate\(/);
    assert.doesNotMatch(scriptJs, /function collectScripts\(/);
    assert.doesNotMatch(scriptJs, /function bindRequestScriptsEditor\(/);

    // Trust / disable / send policy stay in main.
    assert.match(scriptJs, /function hasExecutableScripts\(/);
    assert.match(scriptJs, /function ensureTrustedScriptsBeforeSend\(/);
    assert.match(scriptJs, /function sendActiveTab\(/);
    assert.match(scriptJs, /js-disable-scripts/);
    assert.match(scriptJs, /scriptsTrusted/);

    const bindMatches = scriptJs.match(/bindRequestScriptsEditor\(mc\)/g) || [];
    assert.strictEqual(bindMatches.length, 1, 'bindRequestScriptsEditor should be called exactly once from main');

    const authInsertIdx = scriptJs.indexOf('${getRequestPanelAuthClientScript()}');
    const scriptsInsertIdx = scriptJs.indexOf('${getRequestPanelScriptsClientScript()}');
    const settingsInsertIdx = scriptJs.indexOf('${getRequestPanelSettingsClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(scriptsInsertIdx > authInsertIdx, 'Scripts fragment should follow Auth fragment');
    assert.ok(settingsInsertIdx > scriptsInsertIdx, 'Settings fragment should follow Scripts fragment');
    assert.ok(createTabIdx > settingsInsertIdx, 'createTab should follow Settings fragment');
  });

  it('composes Settings client fragment into main client script without duplicating Settings editor impl', () => {
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const settings = read('src/panels/requestPanel/requestPanelSettingsClientScript.ts');
    const body = read('src/panels/requestPanel/requestPanelBodyClientScript.ts');
    const scriptJs = extractJsTemplate(script);
    const settingsJs = extractJsTemplate(settings);
    const bodyJs = extractJsTemplate(body);

    assert.match(script, /from '\.\/requestPanelSettingsClientScript'/);
    assert.ok(
      scriptJs.includes('${getRequestPanelSettingsClientScript()}'),
      'main client script should insert Settings fragment via composition'
    );
    assert.match(scriptJs, /renderSettingsEditorContents\(tab, isWs\)/);
    assert.match(scriptJs, /bindRequestSettingsEditor\(mc\)/);
    assert.match(scriptJs, /syncSettingsToggleStates\(mc\)/);

    assert.match(settingsJs, /function syncSettingsToggleStates\(/);
    assert.match(settingsJs, /function renderSettingsEditorContents\(/);
    assert.match(settingsJs, /function bindRequestSettingsEditor\(/);
    assert.match(settingsJs, /js-timeout/);
    assert.match(settingsJs, /js-tls-validation/);
    assert.match(settingsJs, /js-ws-keepalive-enabled/);
    assert.match(settingsJs, /settingsPanel\.addEventListener\('change'/);
    assert.doesNotMatch(scriptJs, /function syncSettingsToggleStates\(/);
    assert.doesNotMatch(scriptJs, /function renderSettingsEditorContents\(/);
    assert.doesNotMatch(scriptJs, /function bindRequestSettingsEditor\(/);
    assert.doesNotMatch(bodyJs, /js-settings-panel/);
    assert.doesNotMatch(bodyJs, /settingsPanel\.addEventListener/);

    // Settings state / send / dirty lifecycle stay in main.
    assert.match(scriptJs, /function normalizeNumberSetting\(/);
    assert.match(scriptJs, /function normalizeMaxResponseSizeSetting\(/);
    assert.match(scriptJs, /function normalizeTlsValidation\(/);
    assert.match(scriptJs, /function getRequestSettings\(/);
    assert.match(scriptJs, /function applyRequestSettings\(/);
    assert.match(scriptJs, /function requestSettingsSnapshot\(/);
    assert.match(scriptJs, /function saveActiveTabState\(/);
    assert.match(scriptJs, /function buildDraftTabFromContent\(/);
    assert.match(scriptJs, /function sendActiveTab\(/);

    const bindMatches = scriptJs.match(/bindRequestSettingsEditor\(mc\)/g) || [];
    assert.strictEqual(bindMatches.length, 1, 'bindRequestSettingsEditor should be called exactly once from main');

    const scriptsInsertIdx = scriptJs.indexOf('${getRequestPanelScriptsClientScript()}');
    const settingsInsertIdx = scriptJs.indexOf('${getRequestPanelSettingsClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(settingsInsertIdx > scriptsInsertIdx, 'Settings fragment should follow Scripts fragment');
    assert.ok(createTabIdx > settingsInsertIdx, 'createTab should follow Settings fragment');
  });
});
