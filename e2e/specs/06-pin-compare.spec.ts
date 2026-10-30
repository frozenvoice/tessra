import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  waitForResponseStatus,
} from '../helpers/webview';

test.describe('E2E #6 Response Pin / Compare discoverability', () => {
  test('Pin and Compare are primary actions; compare opens diff', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);

    await fillUrl(frame, `${tessra.baseUrl}/users`);
    await clickSend(frame);
    await waitForResponseStatus(frame, /200/);

    const pin = frame.locator('[data-testid="response-pin"]');
    const compare = frame.locator('[data-testid="response-compare"]');
    const overflow = frame.locator('[data-testid="response-overflow"]');
    await expect(pin).toBeVisible();
    await expect(compare).toBeVisible();
    await expect(overflow).toBeVisible();

    // Pin must not live only inside overflow menu
    await expect(overflow.locator('[data-testid="response-pin"]')).toHaveCount(0);

    await pin.click();
    await expect(pin).toContainText(/1\/2|Pin/i);

    await fillUrl(frame, `${tessra.baseUrl}/html`);
    await clickSend(frame);
    await waitForResponseStatus(frame, /200/);
    await pin.click();
    await expect(compare).toBeEnabled();
    await compare.click();

    // Compare opens VS Code diff editor
    await expect(tessra.page.locator('.monaco-diff-editor, .tab .label-name').filter({ hasText: /compare|diff|resp_/i }).first()).toBeVisible({
      timeout: 20000,
    });

    // Overflow utilities smoke
    await openNewRequestPanel(tessra.page);
    // Re-focus last request webview after command may open another tab — use latest ready frame
    const latest = tessra.page.frameLocator('iframe.webview.ready').last().frameLocator('#active-frame');
    // Ensure we have a response again for overflow menu
    await fillUrl(latest, `${tessra.baseUrl}/users`);
    await clickSend(latest);
    await waitForResponseStatus(latest, /200/);
    await latest.locator('[data-testid="response-overflow"]').click();
    await expect(latest.locator('.js-actions-more-menu .js-copy-response')).toBeVisible();
    await expect(latest.locator('.js-actions-more-menu .js-save-response')).toBeVisible();
    await expect(latest.locator('.js-actions-more-menu .js-compare-settings')).toBeVisible();
  });
});
