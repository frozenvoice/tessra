import { test, expect } from '../fixtures';
import { openNewRequestPanel, openScriptsTab } from '../helpers/webview';

test.describe('E2E #15 Scripts template insertion', () => {
  test('inserts pre-request and test templates without overwriting existing text', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await openScriptsTab(frame);

    const pre = frame.locator('[data-testid="script-prerequest"]');
    const testEditor = frame.locator('[data-testid="script-test"]');
    await expect(pre).toBeVisible();
    await expect(testEditor).toBeVisible();
    await expect(pre).toHaveValue('');

    const preTemplateBtn = frame.locator('.js-insert-script-template[data-template="preRequestEnv"]');
    await expect(preTemplateBtn).toBeVisible();
    await preTemplateBtn.click();

    await expect(pre).toHaveValue(/pm\.environment\.set\(/);
    const afterFirst = await pre.inputValue();
    expect(afterFirst).toContain('requestStartedAt');

    // Second insert appends; does not overwrite the first template body.
    await preTemplateBtn.click();
    const afterSecond = await pre.inputValue();
    expect(afterSecond.startsWith(afterFirst)).toBeTruthy();
    expect(afterSecond.length).toBeGreaterThan(afterFirst.length);
    expect((afterSecond.match(/pm\.environment\.set\(/g) || []).length).toBeGreaterThanOrEqual(2);

    const statusTemplateBtn = frame.locator('.js-insert-script-template[data-template="testStatusCheck"]');
    await expect(statusTemplateBtn).toBeVisible();
    await statusTemplateBtn.click();
    await expect(testEditor).toHaveValue(/pm\.response\.to\.have\.status\(200\)/);
    await expect(testEditor).toHaveValue(/title exists/);

    // Template insertion marks the request dirty (request-tab dirty-dot).
    await expect(frame.locator('.req-tab.active .dirty-dot')).toBeVisible({ timeout: 5000 });
  });
});
