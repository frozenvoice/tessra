import { test, expect } from '../fixtures';
import { fillUrl, openNewRequestPanel, openSettingsTab } from '../helpers/webview';

test.describe('E2E #16 Settings editor state', () => {
  test('keeps Settings UI values across tab roundtrip and shows WS keepalive only for WebSocket URLs', async ({
    tessra,
  }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await fillUrl(frame, `${tessra.baseUrl}/get`);

    await openSettingsTab(frame);

    const timeout = frame.locator('.js-timeout');
    const tls = frame.locator('.js-tls-validation');
    const retryCount = frame.locator('.js-retry-count');
    const retryDelay = frame.locator('.js-retry-delay');
    const saveHistory = frame.locator('.js-save-history');
    const skipDefaults = frame.locator('.js-skip-default-headers');
    const disableScripts = frame.locator('.js-disable-scripts');
    const followRedirects = frame.locator('.js-follow-redirects');
    const stopAfterHeaders = frame.locator('.js-stop-after-headers');
    const wsKeepAliveEnabled = frame.locator('.js-ws-keepalive-enabled');

    await expect(timeout).toBeVisible();
    await expect(tls).toBeVisible();
    await expect(retryCount).toBeVisible();
    await expect(retryDelay).toBeVisible();
    await expect(saveHistory).toBeVisible();
    await expect(skipDefaults).toBeVisible();
    await expect(disableScripts).toBeVisible();
    await expect(followRedirects).toBeVisible();
    await expect(stopAfterHeaders).toBeVisible();
    await expect(wsKeepAliveEnabled).toHaveCount(0);

    await timeout.fill('1234');
    await retryCount.fill('2');
    await retryDelay.fill('25');
    await tls.selectOption('insecure');
    await saveHistory.uncheck();
    await skipDefaults.check();
    await disableScripts.check();

    await expect(frame.locator('.req-tab.active .dirty-dot')).toBeVisible({ timeout: 5000 });

    const firstTab = frame.locator('.req-tab').first();
    await frame.locator('#addTabBtn').click();
    await expect(frame.locator('.req-tab')).toHaveCount(2, { timeout: 10000 });
    await firstTab.click();
    await expect(firstTab).toHaveClass(/active/);

    await openSettingsTab(frame);
    await expect(timeout).toHaveValue('1234');
    await expect(retryCount).toHaveValue('2');
    await expect(retryDelay).toHaveValue('25');
    await expect(tls).toHaveValue('insecure');
    await expect(saveHistory).not.toBeChecked();
    await expect(skipDefaults).toBeChecked();
    await expect(disableScripts).toBeChecked();
    await expect(wsKeepAliveEnabled).toHaveCount(0);

    await fillUrl(frame, 'ws://127.0.0.1:9');
    await openSettingsTab(frame);

    const wsEnabled = frame.locator('.js-ws-keepalive-enabled');
    const wsInterval = frame.locator('.js-ws-keepalive-interval');
    const wsMessage = frame.locator('.js-ws-keepalive-message');
    await expect(wsEnabled).toBeVisible();
    await expect(wsInterval).toBeVisible();
    await expect(wsMessage).toBeVisible();

    await wsEnabled.check();
    await wsInterval.fill('45');
    await wsMessage.fill('tessra-e2e-ping');

    await frame.locator('#addTabBtn').click();
    await expect(frame.locator('.req-tab')).toHaveCount(3, { timeout: 10000 });
    await firstTab.click();
    await expect(firstTab).toHaveClass(/active/);

    await openSettingsTab(frame);
    await expect(frame.locator('.js-ws-keepalive-enabled')).toBeChecked();
    await expect(frame.locator('.js-ws-keepalive-interval')).toHaveValue('45');
    await expect(frame.locator('.js-ws-keepalive-message')).toHaveValue('tessra-e2e-ping');
    await expect(frame.locator('.js-timeout')).toHaveValue('1234');
    await expect(frame.locator('.js-tls-validation')).toHaveValue('insecure');
  });
});
