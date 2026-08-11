import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('stable E2E Collection Runner discovery', () => {
  it('includes runner specs in the default Playwright config (no specs/runner ignore)', () => {
    const configSource = fs.readFileSync(path.join(repoRoot, 'e2e/playwright.config.ts'), 'utf8');
    assert.doesNotMatch(configSource, /^\s*testIgnore\s*:/m);
    assert.doesNotMatch(configSource, /stableTestIgnore|STABLE_E2E_TEST_IGNORE/);
    // Past GHA bug: bare **/runner/** matched /home/runner/work/... and dropped every spec.
    assert.doesNotMatch(configSource, /testIgnore:\s*\[[^\]]*['"]\*\*\/runner\/\*\*/);
    assert.match(configSource, /\/home\/runner\/work/);
    assert.strictEqual(fs.existsSync(path.join(repoRoot, 'e2e/stableTestIgnore.ts')), false);
  });

  it('keeps a focused runner Playwright config for npm run test:e2e:runner', () => {
    const runnerConfig = fs.readFileSync(path.join(repoRoot, 'e2e/playwright.runner.config.ts'), 'utf8');
    assert.match(runnerConfig, /specs',\s*'runner'|specs[\\/]runner/);
    assert.doesNotMatch(runnerConfig, /flaky/i);
  });

  it('scopes context-menu activation (no workbench-wide getByText fallback)', () => {
    const helper = fs.readFileSync(path.join(repoRoot, 'e2e/helpers/webview.ts'), 'utf8');
    assert.match(helper, /findVisibleContextMenu/);
    assert.match(helper, /context-view\.monaco-menu-container|context-view/);
    assert.match(helper, /keyboard\.press\('Enter'\)/);
    assert.match(helper, /aria-label="Collections"/);
    assert.doesNotMatch(helper, /page\.getByText\(\s*['"]Run All Requests['"]/);
  });

  it('imports runner specs from e2e/fixtures (../../fixtures)', () => {
    const selection = fs.readFileSync(path.join(repoRoot, 'e2e/specs/runner/07-runner-selection.spec.ts'), 'utf8');
    const clear = fs.readFileSync(path.join(repoRoot, 'e2e/specs/runner/08-runner-select-clear.spec.ts'), 'utf8');
    assert.match(selection, /from '\.\.\/\.\.\/fixtures'/);
    assert.match(clear, /from '\.\.\/\.\.\/fixtures'/);
  });
});
