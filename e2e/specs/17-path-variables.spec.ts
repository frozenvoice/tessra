import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  waitForResponseStatus,
} from '../helpers/webview';
import * as fs from 'fs';
import * as path from 'path';

test.describe('E2E #17 Path Variables override', () => {
  test('overrides path segment locally without mutating Environment, then resets', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await fillUrl(frame, '{{baseUrl}}/mz-chat/{{customerId}}/customer.do');

    const section = frame.locator('[data-testid="path-variables"]');
    await expect(section).toBeVisible();

    const rows = frame.locator('[data-testid="path-variable-row"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('customerId');
    await expect(section).not.toContainText('baseUrl');

    await expect(frame.locator('[data-testid="path-variable-env-value"]')).toHaveText('9000');
    const overrideBtn = frame.locator('[data-testid="path-variable-override"]');
    await expect(overrideBtn).toBeVisible();
    await overrideBtn.click();

    const valueInput = frame.locator('[data-testid="path-variable-value"]');
    await expect(valueInput).toBeVisible();
    await valueInput.fill('1111');

    await clickSend(frame);
    await waitForResponseStatus(frame, /404|200/);
    const first = await tessra.server.waitForRequest((r) => r.pathname === '/mz-chat/1111/customer.do');
    expect(first.pathname).toBe('/mz-chat/1111/customer.do');

    const envPath = path.join(tessra.userDataDir, 'User', 'globalStorage', 'frozenvoice.tessra', 'environments.json');
    const envs = JSON.parse(fs.readFileSync(envPath, 'utf8')) as Array<{ variables: Array<{ key: string; value: string }> }>;
    const customer = envs[0].variables.find((v) => v.key === 'customerId');
    expect(customer?.value).toBe('9000');

    await frame.locator('[data-testid="path-variable-reset"]').click();
    await expect(frame.locator('[data-testid="path-variable-env-value"]')).toHaveText('9000');

    await clickSend(frame);
    await waitForResponseStatus(frame, /404|200/);
    const resetHit = await tessra.server.waitForRequest((r) => r.pathname === '/mz-chat/9000/customer.do');
    expect(resetHit.pathname).toBe('/mz-chat/9000/customer.do');

    await fillUrl(frame, '{{baseUrl}}/mz-chat/{{unregisteredId}}/customer.do');
    await expect(section).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('unregisteredId');

    const unresolvedInput = frame.locator('[data-testid="path-variable-value"]');
    await expect(unresolvedInput).toBeVisible();
    await unresolvedInput.fill('2222');

    await clickSend(frame);
    await waitForResponseStatus(frame, /404|200/);
    const unresolvedHit = await tessra.server.waitForRequest((r) => r.pathname === '/mz-chat/2222/customer.do');
    expect(unresolvedHit.pathname).toBe('/mz-chat/2222/customer.do');
  });
});
