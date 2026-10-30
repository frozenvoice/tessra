import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openAuthTab,
  openNewRequestPanel,
  responseBodyText,
  waitForResponseStatus,
} from '../helpers/webview';

const TOKEN = 'tessra-e2e-token';

test.describe('E2E #14 Auth editor / Bearer request', () => {
  test('sets Bearer token via Auth tab, toggles Reveal/Hide, and applies Authorization on Send', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await fillUrl(frame, `${tessra.baseUrl}/headers`);

    await openAuthTab(frame);
    const authType = frame.locator('.js-auth-type');
    await expect(authType).toBeVisible();
    await authType.selectOption('bearer');

    const token = frame.locator('.js-auth-token');
    const reveal = frame.locator('.js-auth-reveal');
    await expect(token).toBeVisible();
    await expect(reveal).toBeVisible();
    await expect(token).toHaveAttribute('type', 'password');
    await token.fill(TOKEN);

    // Reveal → text, then Hide → password; value must survive the toggle.
    await reveal.click();
    await expect(token).toHaveAttribute('type', 'text');
    await expect(token).toHaveValue(TOKEN);

    await reveal.click();
    await expect(token).toHaveAttribute('type', 'password');
    await expect(token).toHaveValue(TOKEN);

    await clickSend(frame);
    await waitForResponseStatus(frame, /200/);

    const body = await responseBodyText(frame);
    const parsed = JSON.parse(body.match(/\{[\s\S]*\}/)?.[0] || body);
    const received = parsed.headers || {};
    expect(String(received.authorization || '')).toBe(`Bearer ${TOKEN}`);
  });
});
