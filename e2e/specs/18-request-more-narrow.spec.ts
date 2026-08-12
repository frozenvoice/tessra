import { test, expect } from '../fixtures';
import { openNewRequestPanel } from '../helpers/webview';
import type { ElectronApplication, FrameLocator, Page } from '@playwright/test';

async function setElectronWindowSize(app: ElectronApplication, page: Page, width: number, height: number): Promise<void> {
  const w = Math.round(width);
  const h = Math.round(height);
  const bw = await app.browserWindow(page);
  await bw.evaluate(
    (win, size) => {
      win.setBounds({ x: 40, y: 40, width: size.w, height: size.h });
    },
    { w, h }
  );
  // The E2E harness locks a 1600×1000 viewport; without updating it, BrowserWindow
  // bounds change while the workbench/webview layout stay wide.
  await page.setViewportSize({ width: w, height: h });
  await expect
    .poll(async () => {
      const box = await page.locator('.monaco-workbench').boundingBox();
      return box?.width ?? 0;
    }, { timeout: 8000 })
    .toBeLessThan(w + 80);
}

async function measureWebviewWidth(page: Page, frame: FrameLocator): Promise<number> {
  const iframeBox = await page.locator('iframe.webview.ready').last().boundingBox();
  const inner = await frame.locator('body').evaluate(() => window.innerWidth || document.documentElement.clientWidth || 0);
  const host = iframeBox?.width ?? 0;
  // Prefer the visible host iframe width when it is a trustworthy panel measure.
  if (host >= 300) {
    return Math.round(host);
  }
  return inner;
}

/**
 * Shrink the VS Code window until the Tessra webview content width is in [minW, maxW].
 * Sidebar stays open so editor/webview is narrower than the window.
 */
async function forceNarrowWebview(
  app: ElectronApplication,
  page: Page,
  frame: FrameLocator,
  minW = 430,
  maxW = 520
): Promise<number> {
  let windowWidth = 800;
  let last = 0;
  for (let i = 0; i < 14; i++) {
    await setElectronWindowSize(app, page, windowWidth, 900);
    await expect
      .poll(async () => {
        last = await measureWebviewWidth(page, frame);
        return last;
      }, { timeout: 8000 })
      .toBeGreaterThan(0);

    if (last >= minW && last <= maxW) {
      return last;
    }
    if (last > maxW) {
      windowWidth = Math.max(640, windowWidth - Math.max(20, Math.floor((last - maxW) * 0.85)));
      continue;
    }
    windowWidth = Math.min(1200, windowWidth + Math.max(20, Math.floor((minW - last) * 0.85)));
  }
  expect(last, `expected webview width in ${minW}-${maxW}px, got ${last}`).toBeGreaterThanOrEqual(minW - 20);
  expect(last).toBeLessThanOrEqual(maxW + 60);
  return last;
}

test.describe('E2E #18 Request More menu narrow viewport geometry', () => {
  test('keeps Send/More grouped and menu fully inside the webview', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    const viewportWidth = await forceNarrowWebview(tessra.app, tessra.page, frame, 430, 500);

    const method = frame.locator('[data-testid="request-method"]');
    const url = frame.locator('[data-testid="request-url"]');
    const send = frame.locator('[data-testid="send-request"]');
    const more = frame.locator('[data-testid="request-overflow"]');
    const menu = frame.locator('[data-testid="request-overflow-menu"]');

    await expect(method).toBeVisible();
    await expect(url).toBeVisible();
    await expect(send).toBeVisible();
    await expect(more).toBeVisible();

    const layout = await frame.locator('body').evaluate(() => {
      const sendEl = document.querySelector('[data-testid="send-request"]') as HTMLElement | null;
      const moreEl = document.querySelector('[data-testid="request-overflow"]') as HTMLElement | null;
      const urlBar = document.querySelector('.url-bar') as HTMLElement | null;
      const actionGroup = document.querySelector('.url-action-group') as HTMLElement | null;
      if (!sendEl || !moreEl || !urlBar) {
        return null;
      }
      const sendRect = sendEl.getBoundingClientRect();
      const moreRect = moreEl.getBoundingClientRect();
      return {
        send: { left: sendRect.left, right: sendRect.right, top: sendRect.top, bottom: sendRect.bottom },
        more: { left: moreRect.left, right: moreRect.right, top: moreRect.top, bottom: moreRect.bottom },
        hasActionGroup: !!actionGroup,
        moreOrphanLeft: moreRect.left < 24 && moreRect.top > sendRect.bottom + 2,
        sendMoreGap: moreRect.left - sendRect.right,
        sameRow: Math.abs(moreRect.top - sendRect.top) < 8,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.hasActionGroup).toBe(true);
    expect(layout!.more.left).toBeGreaterThanOrEqual(0);
    expect(layout!.more.right).toBeLessThanOrEqual(viewportWidth);
    expect(layout!.send.left).toBeGreaterThanOrEqual(0);
    expect(layout!.send.right).toBeLessThanOrEqual(viewportWidth);
    expect(layout!.moreOrphanLeft).toBe(false);
    expect(layout!.sendMoreGap).toBeLessThan(24);
    expect(layout!.sendMoreGap).toBeGreaterThan(-4);
    if (!layout!.sameRow) {
      expect(layout!.more.left).toBeGreaterThan(layout!.send.left);
    }

    await more.click();
    await expect(menu).toBeVisible();

    const geometry = await frame.locator('body').evaluate(() => {
      const menuEl = document.querySelector('[data-testid="request-overflow-menu"]') as HTMLElement | null;
      const save = menuEl?.querySelector('.js-save') as HTMLElement | null;
      const curl = menuEl?.querySelector('.js-copy-curl') as HTMLElement | null;
      if (!menuEl) return null;
      const rect = menuEl.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth || 0;
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        vw,
        vh,
        saveVisible: !!(save && save.offsetParent !== null && save.getBoundingClientRect().width > 0),
        curlVisible: !!(curl && curl.offsetParent !== null && curl.getBoundingClientRect().width > 0),
        saveText: (save?.textContent || '').trim(),
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.width).toBeGreaterThan(0);
    expect(geometry!.height).toBeGreaterThan(0);
    expect(geometry!.left).toBeGreaterThanOrEqual(4);
    expect(geometry!.right).toBeLessThanOrEqual(geometry!.vw - 4);
    expect(geometry!.top).toBeGreaterThanOrEqual(0);
    expect(geometry!.bottom).toBeLessThanOrEqual(geometry!.vh);
    expect(geometry!.saveVisible).toBe(true);
    expect(geometry!.curlVisible).toBe(true);
    expect(geometry!.saveText.length).toBeGreaterThan(0);

    const curlItem = menu.locator('.js-copy-curl');
    await expect(curlItem).toBeVisible();
    await curlItem.click();
    await expect(menu).toBeHidden();
  });
});
