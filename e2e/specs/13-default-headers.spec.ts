import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  openHeadersTab,
  responseBodyText,
  waitForResponseStatus,
} from '../helpers/webview';

const HEADER_NAME = 'X-Tessra-E2E-Default';
const HEADER_VALUE = 'default-alpha';

function readDefaultHeaders(userDataDir: string): Array<{ key: string; value: string; enabled?: boolean }> {
  const file = path.join(userDataDir, 'User', 'globalStorage', 'frozenvoice.tessra', 'default-headers.json');
  if (!fs.existsSync(file)) {
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw : [];
}

async function openDefaultHeadersEditor(frame: Awaited<ReturnType<typeof openNewRequestPanel>>) {
  // Product path: Headers tab banner Manage → openDefaultHeaders → loadDefaultHeaders(reveal).
  await openHeadersTab(frame);
  const manage = frame.locator('.js-open-default-headers').first();
  await expect(manage).toBeVisible({ timeout: 10000 });
  await manage.click();

  const editor = frame.locator('#defaultHeadersEditor');
  await expect(editor).toBeVisible({ timeout: 15000 });
  await expect(editor).not.toHaveClass(/hidden/);
  return editor;
}

test.describe('E2E #13 Default Headers save / apply', () => {
  test('saves default header, reopens with value, and applies it on Send', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    const editor = await openDefaultHeadersEditor(frame);

    await frame.locator('#addDefaultHeaderBtn').click();
    const row = frame.locator('#defaultHeaderRows .kv-row').last();
    const keyInput = row.locator('input[type="text"]').first();
    const valueInput = row.locator('.js-kv-value');
    await keyInput.fill(HEADER_NAME);
    await valueInput.fill(HEADER_VALUE);

    await frame.locator('#defaultHeadersSaveBtn').click();

    await expect
      .poll(() => {
        const headers = readDefaultHeaders(tessra.userDataDir);
        const hit = headers.find((h) => h.key === HEADER_NAME);
        return hit?.value || '';
      }, { timeout: 15000 })
      .toBe(HEADER_VALUE);

    await frame.locator('#defaultHeadersCloseBtn').click();
    await expect(editor).toHaveClass(/hidden/);

    // Reopen — loadDefaultHeaders(reveal) should restore the saved row.
    await openDefaultHeadersEditor(frame);
    const reopenedRows = frame.locator('#defaultHeaderRows .kv-row');
    const count = await reopenedRows.count();
    let foundValue = '';
    for (let i = 0; i < count; i++) {
      const key = await reopenedRows.nth(i).locator('input[type="text"]').first().inputValue();
      if (key === HEADER_NAME) {
        foundValue = await reopenedRows.nth(i).locator('.js-kv-value').inputValue();
        break;
      }
    }
    expect(foundValue).toBe(HEADER_VALUE);

    await frame.locator('#defaultHeadersCloseBtn').click();
    await expect(editor).toHaveClass(/hidden/);

    // Actual request application via fixture /headers.
    await fillUrl(frame, `${tessra.baseUrl}/headers`);
    await clickSend(frame);
    await waitForResponseStatus(frame, /200/);

    const body = await responseBodyText(frame);
    const parsed = JSON.parse(body.match(/\{[\s\S]*\}/)?.[0] || body);
    const received = parsed.headers || {};
    // Node IncomingMessage lowercases header names.
    expect(String(received['x-tessra-e2e-default'] || '')).toBe(HEADER_VALUE);

    // Headers banner should surface applied default count.
    await openHeadersTab(frame);
    await expect(frame.locator('.default-headers-banner')).toContainText(/1|Default/i);
  });
});
