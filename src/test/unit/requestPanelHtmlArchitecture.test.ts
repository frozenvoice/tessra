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

describe('requestPanelHtml architecture (Phase 1/2/3/4/5/6 split)', () => {
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

  it('ships dedicated styles, markup, client script, Body, Response, Runner, Status, and WebSocket client modules', () => {
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelStyles.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelMarkup.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelBodyClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelResponseClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelRunnerClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelStatusClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelWebSocketClientScript.ts')));

    const styles = read('src/panels/requestPanel/requestPanelStyles.ts');
    const markup = read('src/panels/requestPanel/requestPanelMarkup.ts');
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const body = read('src/panels/requestPanel/requestPanelBodyClientScript.ts');
    const response = read('src/panels/requestPanel/requestPanelResponseClientScript.ts');
    const runner = read('src/panels/requestPanel/requestPanelRunnerClientScript.ts');
    const status = read('src/panels/requestPanel/requestPanelStatusClientScript.ts');
    const websocket = read('src/panels/requestPanel/requestPanelWebSocketClientScript.ts');

    assert.match(styles, /export function getRequestPanelStyles\(/);
    assert.match(markup, /export function getRequestPanelMarkup\(/);
    assert.match(script, /export function getRequestPanelClientScript\(/);
    assert.match(body, /export function getRequestPanelBodyClientScript\(/);
    assert.match(response, /export function getRequestPanelResponseClientScript\(/);
    assert.match(runner, /export function getRequestPanelRunnerClientScript\(/);
    assert.match(status, /export function getRequestPanelStatusClientScript\(/);
    assert.match(websocket, /export function getRequestPanelWebSocketClientScript\(/);
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
    assert.match(status, /function renderStatusStrip\(/);
    assert.match(status, /function buildStatusStripSegments\(/);
    assert.match(status, /testId = 'status-environment'/);
    assert.match(status, /testId = 'status-variable-usage'/);
    assert.match(websocket, /function renderWebSocketResponse\(/);
    assert.match(websocket, /function websocketConnect\(/);
    assert.match(websocket, /type: 'websocketConnect'/);
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
    assert.match(scriptJs, /refreshToplineStatusChips\(/);

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

    // Full Environment editor / shared helpers remain in main.
    assert.match(scriptJs, /function revealEnvironmentEditor\(/);
    assert.match(scriptJs, /function isEnvironmentEditorOpen\(/);
    assert.match(scriptJs, /function hideEnvironmentEditor\(/);
    assert.match(scriptJs, /function setEnvironmentEditorData\(/);
    assert.match(scriptJs, /function renderVariableUsage\(/);
    assert.match(scriptJs, /function refreshRequestPreflight\(/);
    assert.match(scriptJs, /function renderDefaultHeadersBanner\(/);

    // Ordering: Runner fragment before Status fragment; Status before createTab.
    const runnerInsertIdx = scriptJs.indexOf('${getRequestPanelRunnerClientScript()}');
    const statusInsertIdx = scriptJs.indexOf('${getRequestPanelStatusClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(runnerInsertIdx >= 0 && statusInsertIdx > runnerInsertIdx, 'Status fragment should follow Runner fragment');
    assert.ok(createTabIdx > statusInsertIdx, 'createTab should follow Status fragment composition');
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

    // Ordering: Status fragment before WebSocket fragment; WebSocket before createTab.
    const statusInsertIdx = scriptJs.indexOf('${getRequestPanelStatusClientScript()}');
    const websocketInsertIdx = scriptJs.indexOf('${getRequestPanelWebSocketClientScript()}');
    const createTabIdx = scriptJs.indexOf('function createTab(');
    assert.ok(statusInsertIdx >= 0 && websocketInsertIdx > statusInsertIdx, 'WebSocket fragment should follow Status fragment');
    assert.ok(createTabIdx > websocketInsertIdx, 'createTab should follow WebSocket fragment composition');
  });
});
