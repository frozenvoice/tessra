import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('requestPanelHtml architecture (Phase 1 split)', () => {
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

  it('ships dedicated styles, markup, and client script modules', () => {
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelStyles.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelMarkup.ts')));
    assert.ok(fs.existsSync(path.join(repoRoot, 'src/panels/requestPanel/requestPanelClientScript.ts')));

    const styles = read('src/panels/requestPanel/requestPanelStyles.ts');
    const markup = read('src/panels/requestPanel/requestPanelMarkup.ts');
    const script = read('src/panels/requestPanel/requestPanelClientScript.ts');

    assert.match(styles, /export function getRequestPanelStyles\(/);
    assert.match(markup, /export function getRequestPanelMarkup\(/);
    assert.match(script, /export function getRequestPanelClientScript\(/);
    assert.match(styles, /\.tab-bar\{display:flex/);
    assert.match(markup, /data-testid="environment-disclosure"/);
    assert.match(script, /acquireVsCodeApi\(\)/);
  });
});
