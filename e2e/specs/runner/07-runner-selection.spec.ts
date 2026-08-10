import { test, expect } from '../fixtures';
import { runCollectionFromSidebar } from '../helpers/webview';

test.describe('E2E #7 Collection Runner selection / reset', () => {
  test('default all selected, deselect one, run 4/5, reopen resets', async ({ tessra }) => {
    const frame = await runCollectionFromSidebar(tessra.page, 'E2E Runner');

    await expect.poll(async () => frame.locator('[data-testid="runner-request-select"]').count()).toBeGreaterThan(0);
    await expect(frame.locator('[data-testid="runner-selected-count"]')).toContainText(/5\s*\/\s*5/);

    const checks = frame.locator('[data-testid="runner-request-check"]');
    await expect(checks).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      await expect(checks.nth(i)).toBeChecked();
    }

    await checks.nth(4).uncheck(); // exclude GET Slow
    await expect(frame.locator('[data-testid="runner-selected-count"]')).toContainText(/4\s*\/\s*5/);

    tessra.server.clearRequests();
    await frame.locator('[data-testid="runner-start"]').click();

    await expect(frame.locator('[data-testid="runner-collection-total"]')).toHaveText('5');
    await expect(frame.locator('[data-testid="runner-selected-total"]')).toHaveText('4');
    await expect(frame.locator('[data-testid="runner-runs"]')).toHaveText('4');

    await expect.poll(async () => tessra.server.requests.filter((r) => r.pathname !== '/favicon.ico').length, {
      timeout: 60000,
    }).toBe(4);
    expect(tessra.server.requests.some((r) => r.pathname === '/slow')).toBe(false);

    await expect(frame.locator('[data-testid="runner-skipped"]')).toHaveText('0', { timeout: 60000 });
    await frame.locator('[data-testid="runner-close"]').click();

    const frame2 = await runCollectionFromSidebar(tessra.page, 'E2E Runner', { skipNewRequest: true });
    await expect(frame2.locator('[data-testid="runner-selected-count"]')).toContainText(/5\s*\/\s*5/);
    const checks2 = frame2.locator('[data-testid="runner-request-check"]');
    await expect(checks2).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      await expect(checks2.nth(i)).toBeChecked();
    }
  });
});
