import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, runCommand, waitForResponseStatus } from '../helpers/webview';

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
    const editedAt = Date.now();
    await input.fill(url);

    // 1초 디스크 debounce 전에 실제 VS Code 편집기를 닫아 setState + host draft cache를 검증한다.
    await runCommand(tessra.page, 'View: Close Editor');
    await tessra.page.locator('iframe.webview.ready').waitFor({ state: 'detached', timeout: 1000 });
    expect(Date.now() - editedAt).toBeLessThan(1000);
    const reopened = await openNewRequestPanel(tessra.page);
    await expect(reopened.locator('[data-testid="request-url"]')).toHaveValue(url, { timeout: 15000 });
  });
});
