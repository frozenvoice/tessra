import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

/** Must stay identical to `e2e/stableTestIgnore.ts` (asserted below). */
const STABLE_E2E_TEST_IGNORE = /[\\/]specs[\\/]runner[\\/]/;

describe('stable E2E testIgnore', () => {
  it('exports a specs/runner-scoped pattern (not **/runner/**)', () => {
    const ignoreSource = fs.readFileSync(path.join(repoRoot, 'e2e/stableTestIgnore.ts'), 'utf8');
    const configSource = fs.readFileSync(path.join(repoRoot, 'e2e/playwright.config.ts'), 'utf8');

    assert.match(ignoreSource, /export const STABLE_E2E_TEST_IGNORE = \/\[\\\\\/\]specs\[\\\\\/\]runner\[\\\\\/\]\//);
    assert.match(configSource, /from '\.\/stableTestIgnore'/);
    assert.match(configSource, /testIgnore:\s*STABLE_E2E_TEST_IGNORE/);
    assert.doesNotMatch(configSource, /testIgnore:\s*\[[^\]]*['"]\*\*\/runner\/\*\*/);
  });

  it('does not ignore stable specs under GitHub Actions /home/runner/work paths', () => {
    const ghaStable = '/home/runner/work/tessra/tessra/e2e/specs/01-basic-send.spec.ts';
    assert.strictEqual(
      STABLE_E2E_TEST_IGNORE.test(ghaStable),
      false,
      `stable GHA path must not match testIgnore: ${ghaStable}`
    );
  });

  it('ignores Collection Runner specs under e2e/specs/runner', () => {
    const ghaRunner = '/home/runner/work/tessra/tessra/e2e/specs/runner/07-runner-selection.spec.ts';
    assert.strictEqual(
      STABLE_E2E_TEST_IGNORE.test(ghaRunner),
      true,
      `runner GHA path must match testIgnore: ${ghaRunner}`
    );
  });

  it('ignores Windows and relative runner specs while keeping sibling stable specs', () => {
    assert.strictEqual(
      STABLE_E2E_TEST_IGNORE.test('C:\\Dev\\github\\tessra\\e2e\\specs\\01-basic-send.spec.ts'),
      false
    );
    assert.strictEqual(
      STABLE_E2E_TEST_IGNORE.test('C:\\Dev\\github\\tessra\\e2e\\specs\\runner\\07-runner-selection.spec.ts'),
      true
    );
    assert.strictEqual(STABLE_E2E_TEST_IGNORE.test('e2e/specs/02-url-params.spec.ts'), false);
    assert.strictEqual(STABLE_E2E_TEST_IGNORE.test('e2e/specs/runner/08-runner-select-clear.spec.ts'), true);
  });
});
