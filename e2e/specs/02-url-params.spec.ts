import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  openParamsTab,
  setParamRows,
  waitForResponseStatus,
} from '../helpers/webview';

test.describe('E2E #2 URL / Params serialization', () => {
  test('URL query and Params mirror once; duplicate keys preserved', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);

    await fillUrl(frame, '{{baseUrl}}/users?_limit=5');
    await openParamsTab(frame);

    const paramRows = frame.locator('[data-testid="request-params"] .kv-row');
    await expect.poll(async () => paramRows.count()).toBeGreaterThan(0);
    await expect(paramRows.first().locator('input[type="text"]').first()).toHaveValue('_limit');
    await expect(paramRows.first().locator('.js-kv-value')).toHaveValue('5');

    tessra.server.clearRequests();
    await clickSend(frame);
    const once = await tessra.server.waitForRequest((r) => r.pathname === '/users');
    expect(once.search).toBe('?_limit=5');
    expect(once.query._limit).toBe('5');
    await waitForResponseStatus(frame, /200/);

    // Intentional duplicate keys
    await fillUrl(frame, '{{baseUrl}}/users');
    await setParamRows(frame, [
      { key: 'tag', value: 'a' },
      { key: 'tag', value: 'b' },
    ]);

    tessra.server.clearRequests();
    await clickSend(frame);
    const dup = await tessra.server.waitForRequest((r) => r.pathname === '/users' && r.search.includes('tag='));
    const tags = Array.isArray(dup.query.tag) ? dup.query.tag : [dup.query.tag];
    expect(tags).toEqual(expect.arrayContaining(['a', 'b']));
    expect(tags).toHaveLength(2);
  });
});
