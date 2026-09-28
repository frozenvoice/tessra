import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, waitForResponseStatus } from '../helpers/webview';

test.describe('E2E #21/#22 Request Panel accessibility and draft preservation', () => {
  test('response tabs support roving keyboard navigation', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await fillUrl(frame, `${tessra.baseUrl}/users`);
    await clickSend(frame);
    await waitForResponseStatus(frame, /^200/);

    const tabs = frame.locator('.js-res-tabs [role="tab"]');
    await expect(tabs).toHaveCount(4);
    const bodyTab = frame.locator('.js-res-tabs [role="tab"][data-tab="resBody"]');
    const cookiesTab = frame.locator('.js-res-tabs [role="tab"][data-tab="resCookies"]');
    const headersTab = frame.locator('.js-res-tabs [role="tab"][data-tab="resHeaders"]');
    await expect(bodyTab).toHaveAttribute('tabindex', '0');
    await expect(headersTab).toHaveAttribute('tabindex', '-1');

    await bodyTab.focus();
    await tessra.page.keyboard.press('ArrowRight');
    await expect(cookiesTab).toHaveAttribute('aria-selected', 'true');
    await expect(cookiesTab).toHaveAttribute('tabindex', '0');

    await tessra.page.keyboard.press('Home');
    await expect(bodyTab).toHaveAttribute('aria-selected', 'true');
    await tessra.page.keyboard.press('ArrowRight');
    await tessra.page.keyboard.press('ArrowRight');
    await expect(headersTab).toHaveAttribute('aria-selected', 'true');
    await expect(headersTab).toHaveAttribute('tabindex', '0');

    await tessra.page.keyboard.press('End');
    const lastTab = tabs.last();
    await expect(lastTab).toHaveAttribute('aria-selected', 'true');
    await expect(lastTab).toBeFocused();
  });

  test('preserves the latest draft when the request editor closes immediately', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    const url = `${tessra.baseUrl}/users?_limit=1`;
    const input = frame.locator('[data-testid="request-url"]');
    await input.fill(url);

    // UI 왕복 시간은 CI 부하에 따라 달라진다. debounce 이전 보존은 fake timer 단위 테스트로 보장한다.
    // The focused webview frame is torn down while the key is still being dispatched, which can leave
    // keyboard.press waiting on a dead target. Wait for the editor to close instead of the key press.
    void tessra.page.keyboard.press(process.platform === 'darwin' ? 'Meta+w' : 'Control+w').catch(() => undefined);
    await tessra.page.locator('iframe.webview.ready').waitFor({ state: 'detached' });
    const reopened = await openNewRequestPanel(tessra.page);
    await expect(reopened.locator('[data-testid="request-url"]')).toHaveValue(url, { timeout: 15000 });
  });
});
