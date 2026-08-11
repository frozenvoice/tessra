import { test, expect } from '../../fixtures';
import { runCollectionFromSidebar } from '../../helpers/webview';

test.describe('E2E #8 Runner Select all / Clear / zero selection', () => {
  test('Clear disables Start; Select all re-enables', async ({ tessra }) => {
    const frame = await runCollectionFromSidebar(tessra.page, 'E2E Runner');

    await frame.locator('[data-testid="runner-clear-selection"]').click();
    await expect(frame.locator('[data-testid="runner-selected-count"]')).toContainText(/0\s*\/\s*5/);
    await expect(frame.locator('[data-testid="runner-start"]')).toBeDisabled();
    await expect(frame.locator('[data-testid="runner-select-hint"]')).toBeVisible();

    await frame.locator('[data-testid="runner-select-all"]').click();
    await expect(frame.locator('[data-testid="runner-selected-count"]')).toContainText(/5\s*\/\s*5/);
    await expect(frame.locator('[data-testid="runner-start"]')).toBeEnabled();
  });
});
