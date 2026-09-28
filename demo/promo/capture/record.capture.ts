import { test, expect, type Locator } from '@playwright/test';
import { launchPromoHarness, ScreenRecorder } from './harness';
import { getRequestWebview, runCommand, waitForRequestWebview } from '../../../e2e/helpers/webview';

// Real Extension Development Host session, recorded for the promo video.
// Pauses are deliberate: the composition draws a cursor gliding to each click mark.
test('record promo footage', async () => {
  const h = await launchPromoHarness();
  const { page } = h;
  const rec = new ScreenRecorder(page);
  const pause = (ms: number) => page.waitForTimeout(ms);

  async function click(target: Locator, name: string, opts: { button?: 'right' } = {}): Promise<void> {
    const box = await target.boundingBox();
    if (!box) throw new Error(`no box for ${name}`);
    rec.mark(name, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await pause(650);
    await target.click({ button: opts.button });
  }

  async function type(target: Locator, text: string, delay: number): Promise<void> {
    for (const ch of text) {
      rec.key();
      await target.press(ch === ' ' ? 'Space' : ch);
      await pause(delay);
    }
  }
  async function press(key: string, target?: Locator): Promise<void> {
    rec.key();
    await (target ? target.press(key) : page.keyboard.press(key));
  }

  // --- setup (not recorded) ---
  await page.locator('.activitybar [aria-label*="Tessra"]').first().click();
  await page.locator('.monaco-list-row').filter({ hasText: 'Demo API' }).first().waitFor();
  await runCommand(page, 'Tessra: New Request');
  const frame = await waitForRequestWebview(page);
  await runCommand(page, 'Notifications: Clear All Notifications').catch(() => undefined);
  await page.mouse.move(1200, 860);
  await pause(1500);

  await rec.start();
  await pause(800);

  // --- scene: compose & send ---
  const url = frame.locator('[data-testid="request-url"]');
  await click(url, 'click-url');
  rec.mark('type-start');
  await type(url, '{{ba', 110);
  await pause(700);
  rec.mark('tab-1');
  await press('Tab', url);
  await type(url, '/users/', 90);
  await type(url, '{{us', 110);
  await pause(600);
  rec.mark('tab-2');
  await press('Tab', url);
  rec.mark('type-end');
  await pause(700);
  await click(frame.locator('[data-testid="send-request"]'), 'send-1');
  await expect(frame.locator('[data-testid="response-status"]')).toContainText('200');
  rec.mark('response-1');
  await pause(2600);

  // --- scene: environment switch ---
  rec.mark('env-start');
  await pause(300);
  rec.mark('palette');
  await press('Control+Shift+P');
  const quick = page.locator('.quick-input-widget .input');
  await quick.waitFor({ state: 'visible' });
  await type(quick, 'Tessra: Switch Env', 60);
  await pause(500);
  await press('Enter');
  await page.locator('.quick-input-list .monaco-list-row').filter({ hasText: 'staging' }).first().waitFor();
  await pause(700);
  const stagingRow = page.locator('.quick-input-list .monaco-list-row').filter({ hasText: 'staging' }).first();
  await click(stagingRow, 'pick-staging');
  await expect(frame.locator('[data-testid="status-environment"]')).toContainText('staging');
  rec.mark('env-switched');
  await pause(1000);
  await click(frame.locator('[data-testid="send-request"]'), 'send-2');
  await expect(frame.locator('[data-testid="response-body-tree"], [data-testid="response-body"]').first()).toContainText('staging');
  rec.mark('response-2');
  await pause(2600);

  // --- scene: collection runner ---
  rec.mark('runner-start');
  const collectionRow = page.locator('.monaco-list-row').filter({ hasText: 'Demo API' }).first();
  await click(collectionRow, 'right-click-collection', { button: 'right' });
  const runAll = page.locator('.context-view a.action-menu-item').filter({ hasText: /^\s*Run All Requests\s*$/ }).first();
  await runAll.waitFor({ state: 'visible' });
  await pause(400);
  await runAll.hover();
  const box = await runAll.boundingBox();
  if (box) rec.mark('menu-run-all', { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await pause(650);
  await press('Enter').catch(() => undefined);
  // Park the pointer on empty runner space so no sidebar hover tooltip lingers.
  await page.mouse.move(1100, 700);
  const runner = getRequestWebview(page);
  await runner.locator('[data-testid="runner-start"]').waitFor({ state: 'visible' });
  rec.mark('runner-open');
  await pause(1600);
  await click(runner.locator('[data-testid="runner-start"]'), 'runner-go');
  await expect(runner.locator('[data-testid="runner-failed"]')).toHaveText('1', { timeout: 30000 });
  await expect(runner.locator('.js-runner-rerun')).toBeVisible({ timeout: 30000 });
  rec.mark('runner-done');
  await pause(1800);
  await click(runner.locator('.js-runner-rerun'), 'rerun-failed');
  await expect(runner.locator('[data-testid="runner-failed"]')).toHaveText('0', { timeout: 30000 });
  rec.mark('rerun-done');
  await pause(2600);

  const dir = await rec.stop('session');
  console.log('frames in', dir);
  await h.dispose();
});
