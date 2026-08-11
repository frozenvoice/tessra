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

describe('requestPanelHtml architecture (Phase 1/2 split)', () => {
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

  it('ships dedicated styles, markup, client script, and Body client modules', () => {
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelStyles.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelMarkup.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelClientScript.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelBodyClientScript.ts')));

    const styles = read('src/panels/requestPanel/requestPanelStyles.ts');
    const markup = read('src/panels/requestPanel/requestPanelMarkup.ts');
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');
    const body = read('src/panels/requestPanel/requestPanelBodyClientScript.ts');

    assert.match(styles, /export function getRequestPanelStyles\(/);
    assert.match(markup, /export function getRequestPanelMarkup\(/);
    assert.match(script, /export function getRequestPanelClientScript\(/);
    assert.match(body, /export function getRequestPanelBodyClientScript\(/);
    assert.match(styles, /\.tab-bar\{display:flex/);
    assert.match(markup, /data-testid="environment-disclosure"/);
    assert.match(script, /acquireVsCodeApi\(\)/);
    assert.match(body, /function handleBodyTypeSelectChange\(/);
    assert.match(body, /function bindRequestBodyEditor\(/);
    assert.match(body, /TessraBodyConversion/);
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
});
