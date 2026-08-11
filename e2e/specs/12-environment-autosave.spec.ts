import * as fs from 'fs';
import * as path from 'path';
import type { FrameLocator } from '@playwright/test';
import { test, expect } from '../fixtures';
import { openNewRequestPanel } from '../helpers/webview';

function readEnvironmentVars(userDataDir: string): Array<{ key: string; value: string; enabled?: boolean }> {
  const file = path.join(userDataDir, 'User', 'globalStorage', 'frozenvoice.tessra', 'environments.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{
    id: string;
    variables?: Array<{ key: string; value: string; enabled?: boolean }>;
  }>;
  const env = raw.find((item) => item.id === 'env-e2e') || raw[0];
  return env?.variables || [];
}

async function findEnvValueInput(frame: FrameLocator, key: string) {
  const rows = frame.locator('[data-testid="environment-var-rows"] .kv-row');
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    const keyVal = await rows.nth(i).locator('input[type="text"]').first().inputValue();
    if (keyVal === key) {
      return rows.nth(i).locator('.js-kv-value');
    }
  }
  throw new Error(`Environment row not found for key: ${key}`);
}

test.describe('E2E #12 Environment autosave / reopen', () => {
  test('edits env var, autosaves to storage, reopen keeps value and N vars', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    const envSeg = frame.locator('[data-testid="status-environment"]');
    const disclosure = frame.locator('[data-testid="environment-disclosure"]');
    const autosaved = frame.locator('#envAutoSaved');

    await expect(envSeg).toBeVisible();
    await envSeg.click();
    await expect(disclosure).toBeVisible();
    await expect(disclosure).not.toHaveClass(/hidden/);

    // Seed starts with 3 vars (baseUrl, token, envName).
    await expect(envSeg).toContainText(/3\s*vars/i);

    const valueInput = await findEnvValueInput(frame, 'envName');
    await expect(valueInput).toHaveValue('e2e');
    await valueInput.click({ clickCount: 3 });
    await valueInput.fill('e2e-autosaved');
    // Blur triggers focusout flush (autosaved cue also covers 500ms debounce path).
    await valueInput.blur();

    await expect(autosaved).toHaveClass(/show/, { timeout: 10000 });

    await expect
      .poll(() => {
        const vars = readEnvironmentVars(tessra.userDataDir);
        return vars.find((v) => v.key === 'envName')?.value || '';
      }, { timeout: 10000 })
      .toBe('e2e-autosaved');

    await frame.locator('[data-testid="environment-disclosure-close"]').click();
    await expect(disclosure).toHaveClass(/hidden/);

    // Reopen via Status Environment segment — editor should still show saved value.
    await envSeg.click();
    await expect(disclosure).not.toHaveClass(/hidden/);
    await expect(await findEnvValueInput(frame, 'envName')).toHaveValue('e2e-autosaved');

    // Add a variable → count should become 4 vars on Status strip after autosave.
    await frame.locator('[data-testid="environment-add-variable"]').click();
    const emptyKey = frame.locator('[data-testid="environment-var-rows"] .kv-row').last().locator('input[type="text"]').first();
    await emptyKey.fill('e2eExtra');
    await emptyKey.blur();
    await expect(autosaved).toHaveClass(/show/, { timeout: 10000 });
    await expect(envSeg).toContainText(/4\s*vars/i, { timeout: 10000 });

    await expect
      .poll(() => {
        const vars = readEnvironmentVars(tessra.userDataDir);
        return vars.some((v) => v.key === 'e2eExtra');
      }, { timeout: 10000 })
      .toBe(true);
  });
});
