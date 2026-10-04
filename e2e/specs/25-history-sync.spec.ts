import * as fs from 'fs';
import * as path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
  clickSend, fillUrl, openNewRequestPanel, openTessraActivity,
  runCommand, waitForResponseStatus,
} from '../helpers/webview';

async function historyPin(row: Locator, label: 'Pin' | 'Unpin'): Promise<void> {
  // package.json의 inline 그룹 액션은 context menu가 아니라 각 tree row의 toolbar에 있다.
  await row.hover();
  const button = row.getByRole('button', { name: label, exact: true });
  await expect(button).toBeVisible();
  await button.click();
}

async function filterHistory(page: Page, value: string): Promise<void> {
  await runCommand(page, 'Filter History');
  const input = page.locator('.quick-input-widget .input');
  await input.fill(value);
  await input.press('Enter');
}

async function clearHistory(page: Page): Promise<void> {
  await runCommand(page, 'Clear History');
  await page.locator('.monaco-dialog-box').getByRole('button', { name: 'Delete', exact: true }).click();
}

test.describe('E2E #25 히스토리 저장과 트리 동기화', () => {
  test.use({ userSettings: { 'window.dialogStyle': 'custom' } });
  test('연속 완료·핀·필터·삭제가 즉시 저장되고 pinned 항목을 보존한다', async ({ tessra }) => {
    const historyPath = path.join(tessra.userDataDir, 'User', 'globalStorage', 'frozenvoice.tessra', 'history.json');
    const readHistory = () => JSON.parse(fs.readFileSync(historyPath, 'utf8')) as Array<{
      id: string; pinned?: boolean; request: { url: string };
    }>;
    const frame = await openNewRequestPanel(tessra.page);
    for (const endpoint of ['/users', '/headers']) {
      await fillUrl(frame, `${tessra.baseUrl}${endpoint}`);
      await clickSend(frame);
      await waitForResponseStatus(frame, /^200/);
      // 완료된 응답을 표시한 시점에는 지연된 flush 없이 이미 디스크에 기록되어야 한다.
      expect(readHistory().some((entry) => entry.request.url === `${tessra.baseUrl}${endpoint}`)).toBe(true);
    }
    expect(readHistory().map((entry) => entry.request.url)).toEqual([`${tessra.baseUrl}/headers`, `${tessra.baseUrl}/users`]);

    await openTessraActivity(tessra.page);
    const tree = tessra.page.locator('.monaco-list[aria-label="History"]');
    const pane = tessra.page.locator('.pane').filter({
      has: tessra.page.locator('.pane-header .title').filter({ hasText: /^History$/ }),
    });
    if (!await tree.isVisible().catch(() => false)) await pane.locator('.pane-header').click();
    await expect(tree).toBeVisible();
    await expect(pane.locator('.pane-header')).toContainText('2');
    const users = tree.getByRole('treeitem', { name: /\/users/ });
    await expect(users).toBeVisible();
    await expect(tree.getByRole('treeitem', { name: /\/headers/ })).toBeVisible();

    await historyPin(users, 'Pin');
    await expect.poll(() => readHistory().find((entry) => entry.request.url.endsWith('/users'))?.pinned).toBe(true);
    await expect(users).toContainText('[Pinned]');
    await filterHistory(tessra.page, 'pinned:yes');
    await expect(pane.locator('.pane-header')).toContainText('1/2');
    await expect(tree.getByRole('treeitem', { name: /\/headers/ })).toHaveCount(0);
    await expect(users).toBeVisible();

    await clearHistory(tessra.page);
    await expect.poll(() => readHistory().map((entry) => entry.request.url)).toEqual([`${tessra.baseUrl}/users`]);
    await expect(pane.locator('.pane-header')).toContainText('1/1');
    expect(readHistory()[0].pinned).toBe(true);

    await filterHistory(tessra.page, '');
    await historyPin(users, 'Unpin');
    await expect.poll(() => readHistory()[0]?.pinned).toBe(false);
    await clearHistory(tessra.page);
    await expect.poll(readHistory).toEqual([]);
    await expect(tree.getByRole('treeitem')).toHaveCount(0);
  });
});
