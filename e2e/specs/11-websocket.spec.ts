import { test, expect } from '../fixtures';
import { startWebSocketEchoServer } from '../fixtures/websocketServer';
import {
  clickSend,
  fillUrl,
  openBodyTab,
  openNewRequestPanel,
} from '../helpers/webview';

test.describe('E2E #11 WebSocket connect / echo / disconnect', () => {
  test('connects to local echo, sends text, shows OUT/IN, then disconnects', async ({ tessra }) => {
    const wsServer = await startWebSocketEchoServer();
    try {
      const frame = await openNewRequestPanel(tessra.page);
      const primary = frame.locator('[data-testid="send-request"]');

      await fillUrl(frame, wsServer.url);

      // URL mode flip → Connect primary (locale=en harness).
      await expect(primary).toBeVisible();
      await expect(primary).toContainText(/Connect/i);

      await clickSend(frame);

      const console = frame.locator('.ws-console');
      await expect(console).toBeVisible({ timeout: 20000 });
      await expect(console.locator('.ws-summary')).toHaveClass(/ws-status-open/, { timeout: 20000 });
      await expect(console.locator('.ws-status-label')).toContainText(/Connected/i);
      await expect(primary).toContainText(/Send Message/i);

      await openBodyTab(frame);
      const body = frame.locator('[data-testid="request-body-editor"]');
      await body.click({ clickCount: 3 });
      await body.fill('hello tessra');

      await clickSend(frame);

      await wsServer.waitForText((text) => text === 'hello tessra');

      const outMsg = console.locator('.ws-message.out').filter({ hasText: 'hello tessra' }).first();
      const inMsg = console.locator('.ws-message.in').filter({ hasText: 'hello tessra' }).first();
      await expect(outMsg).toBeVisible({ timeout: 15000 });
      await expect(inMsg).toBeVisible({ timeout: 15000 });
      await expect(outMsg.locator('.ws-direction')).toHaveText('OUT');
      await expect(inMsg.locator('.ws-direction')).toHaveText('IN');
      await expect(outMsg.locator('.ws-payload')).toHaveText('hello tessra');
      await expect(inMsg.locator('.ws-payload')).toHaveText('hello tessra');

      await frame.locator('.js-ws-disconnect').click();

      await expect(console.locator('.ws-summary')).toHaveClass(/ws-status-closed/, { timeout: 15000 });
      await expect(console.locator('.ws-status-label')).toContainText(/Disconnected/i);
      // Close diagnostics land as SYS (system) entries in the message log.
      await expect(console.locator('.ws-message.system').filter({ hasText: /code:\s*\d+/i })).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await wsServer.close().catch(() => undefined);
    }
  });
});
