import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  waitForResponseStatus,
} from '../helpers/webview';

test.describe('E2E #9 Send Stop / cancellation', () => {
  test('Stop cancels slow request and late response does not overwrite', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);

    await fillUrl(frame, `${tessra.baseUrl}/slow`);
    await clickSend(frame);

    const stop = frame.locator('[data-testid="stop-request"]');
    await expect(stop).toBeVisible({ timeout: 10000 });
    await stop.click();

    // Busy state ends — Send returns
    await expect(frame.locator('[data-testid="send-request"]')).toBeVisible({ timeout: 15000 });

    // Subsequent fast request works
    await fillUrl(frame, `${tessra.baseUrl}/users`);
    await clickSend(frame);
    await waitForResponseStatus(frame, /200/);
    await expect(frame.locator('[data-testid="response-status"]')).toContainText('200');

    // Wait until slow would have completed; status must remain the fast response
    await expect
      .poll(async () => tessra.server.requests.some((r) => r.pathname === '/slow'), { timeout: 8000 })
      .toBe(true);
    await expect(frame.locator('[data-testid="response-status"]')).toContainText('200');
    const statusText = await frame.locator('[data-testid="response-status"]').innerText();
    expect(statusText).not.toMatch(/delayedMs/);
  });
});
