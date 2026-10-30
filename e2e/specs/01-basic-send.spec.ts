import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, responseBodyText, waitForResponseStatus } from '../helpers/webview';

test.describe('E2E #1 Activation / basic request', () => {
  test('opens request panel, sends /users, shows JSON response', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);

    await expect(frame.locator('[data-testid="request-url"]')).toBeVisible();
    await expect(frame.locator('[data-testid="send-request"]')).toBeVisible();
    await expect(frame.locator('[data-testid="status-environment"]')).toBeVisible();

    await fillUrl(frame, `${tessra.baseUrl}/users`);
    await clickSend(frame);

    const received = await tessra.server.waitForRequest((r) => r.pathname === '/users' && r.method === 'GET');
    expect(received.search).toBe('');

    await waitForResponseStatus(frame, /200/);
    await expect(frame.locator('[data-testid="response-status"]')).toContainText('200');

    const body = await responseBodyText(frame);
    expect(body).toMatch(/Ada Lovelace/);
    expect(body).toMatch(/JSON|Ada|users/i);
  });
});
