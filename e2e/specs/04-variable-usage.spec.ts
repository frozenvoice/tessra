import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, waitForResponseStatus } from '../helpers/webview';

test.describe('E2E #4 Variable Usage / Used N', () => {
  test('Used N disclosure lists request variables without hiding Environment', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);

    await fillUrl(frame, '{{baseUrl}}/users?token={{token}}&env={{envName}}');
    await clickSend(frame);
    await waitForResponseStatus(frame, /200/);

    // After response render, status strip includes Used N for template variables in the request.
    const used = frame.locator('[data-testid="status-variable-usage"]');
    await expect(used).toBeAttached({ timeout: 15000 });
    if (await used.isVisible().catch(() => false)) {
      await used.click();
    } else {
      await frame.locator('.js-status-strip-toggle').click();
      await used.click({ force: true });
    }

    const disclosure = frame.locator('[data-testid="variable-usage-disclosure"]');
    await expect(disclosure).toBeVisible({ timeout: 15000 });
    await expect(disclosure).toContainText(/baseUrl|token|envName/i);
    await expect(frame.locator('[data-testid="status-environment"]')).toBeVisible();
  });
});
