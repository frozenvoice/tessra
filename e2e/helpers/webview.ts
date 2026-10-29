import type { FrameLocator, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ARTIFACTS_DIR } from './paths';

const isMac = process.platform === 'darwin';
const RUN_ALL_REQUESTS = 'Run All Requests';

export async function runCommand(page: Page, commandLabel: string): Promise<void> {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.locator('.monaco-workbench').click({ position: { x: 400, y: 240 }, timeout: 10000 }).catch(() => undefined);
  // Prefer `.input` class — a bare `input` also matches the hidden quick-input checkbox.
  const input = page.locator('.quick-input-widget .input');
  // 위 클릭 지점이 webview면 늦게 도착한 focus가 막 열린 palette를 닫을 수 있어 다시 연다.
  for (let attempt = 1; ; attempt++) {
    await page.keyboard.press(isMac ? 'Meta+Shift+P' : 'Control+Shift+P');
    try {
      await input.waitFor({ state: 'visible', timeout: 20000 });
      await input.fill(`> ${commandLabel}`, { timeout: 5000 });
      break;
    } catch (error) {
      if (attempt >= 3) { throw error; }
    }
  }
  const option = page.locator('.quick-input-list .monaco-list-row').filter({ hasText: commandLabel }).first();
  await option.waitFor({ state: 'visible', timeout: 30000 });
  await option.click();
  // 이전 command palette의 닫힘과 다음 quick input의 열림을 구분한다.
  await option.waitFor({ state: 'hidden', timeout: 30000 });
}

export async function openNewRequestPanel(page: Page): Promise<FrameLocator> {
  await runCommand(page, 'Tessra: New Request');
  return getRequestWebview(page);
}

export function getRequestWebview(page: Page): FrameLocator {
  // VS Code nests webview content: outer host iframe → #active-frame.
  return page.frameLocator('iframe.webview.ready').last().frameLocator('#active-frame');
}

export async function waitForRequestWebview(page: Page, timeoutMs = 60000): Promise<FrameLocator> {
  await page.locator('iframe.webview.ready').last().waitFor({ state: 'attached', timeout: timeoutMs });
  const frame = getRequestWebview(page);
  await frame.locator('[data-testid="request-url"]').waitFor({ state: 'visible', timeout: timeoutMs });
  return frame;
}

/** Tessra activity-bar sidebar that hosts Collections / Environments / History. */
function tessraSidebarRoot(page: Page): Locator {
  // Attribute selector avoids CSS id escaping quirks with dotted VS Code ids.
  return page.locator('[id="workbench.view.extension.tessra-sidebar"]');
}

/** Collections tree only — avoids Environment/History monaco lists. */
function collectionsTree(page: Page): Locator {
  // Prefer tree scoped under Tessra viewlet; fall back to aria-label alone if composite id lags.
  const inSidebar = tessraSidebarRoot(page).locator('.monaco-list[aria-label="Collections"]');
  const byAria = page.locator('.monaco-list[aria-label="Collections"]');
  return inSidebar.or(byAria);
}

async function clickTessraActivityBar(page: Page): Promise<void> {
  const byLabel = page.locator('.activitybar [aria-label*="Tessra"]').first();
  if (await byLabel.count()) {
    await byLabel.click({ timeout: 15000 });
    return;
  }
  await page.locator('.activitybar .action-item').filter({ hasText: /Tessra/i }).first().click({ timeout: 15000 });
}

export async function openTessraActivity(page: Page): Promise<void> {
  const seedRow = findCollectionRow(page, 'E2E Runner');
  if (await seedRow.isVisible().catch(() => false)) {
    return;
  }

  await clickTessraActivityBar(page);

  // Clicking the already-active activity-bar icon toggles the sidebar closed in VS Code.
  // If Collections did not appear, click once more to reopen.
  try {
    await collectionsTree(page).waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    await clickTessraActivityBar(page);
    await collectionsTree(page).waitFor({ state: 'visible', timeout: 20000 });
  }

  await seedRow.waitFor({ state: 'visible', timeout: 45000 });
}

export function findCollectionRow(page: Page, collectionName: string): Locator {
  const tree = collectionsTree(page);
  // Accessible name is often "E2E Runner\n5 req" (title + description), so avoid exact-only match.
  const byRole = tree.getByRole('treeitem', { name: new RegExp(`^${escapeRegExp(collectionName)}(\\n|$)`) });
  const byText = tree.locator('.monaco-list-row').filter({ hasText: collectionName });
  return byRole.or(byText).first();
}

async function focusTreeItem(row: Locator): Promise<void> {
  await row.scrollIntoViewIfNeeded().catch(() => undefined);
  await row.click({ timeout: 15000 });
  // VS Code marks the active tree row with .focused and/or aria-selected.
  await expect
    .poll(
      async () => {
        const cls = (await row.getAttribute('class')) || '';
        const selected = await row.getAttribute('aria-selected');
        return cls.includes('focused') || cls.includes('selected') || selected === 'true';
      },
      { timeout: 5000, message: 'collection tree row did not become focused/selected after click' }
    )
    .toBe(true);
}

/**
 * Visible workbench context menu root.
 * VS Code 1.99: `.context-view.monaco-menu-container` → `.monaco-menu` → `ul[role=menu]` → `a.action-menu-item[role=menuitem]`.
 * Scope here so menubar `role=menuitem` / hidden templates are never matched.
 */
export function findVisibleContextMenu(page: Page): Locator {
  return page
    .locator('.context-view.monaco-menu-container, .context-view')
    .filter({ has: page.locator('ul.actions-container[role="menu"], .monaco-menu, a.action-menu-item') })
    .filter({ visible: true })
    .last();
}

async function waitForVisibleContextMenu(page: Page, timeoutMs = 4000): Promise<Locator> {
  const menu = findVisibleContextMenu(page);
  await menu.waitFor({ state: 'visible', timeout: timeoutMs });
  return menu;
}

function findRunAllMenuItem(menu: Locator): Locator {
  return menu
    .getByRole('menuitem', { name: RUN_ALL_REQUESTS, exact: true })
    .or(
      menu
        .locator('a.action-menu-item[role="menuitem"]')
        .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(RUN_ALL_REQUESTS)}\\s*$`) })
    )
    .first();
}

async function openContextMenuForTreeItem(page: Page, row: Locator): Promise<Locator> {
  await page.keyboard.press('Escape').catch(() => undefined);
  await focusTreeItem(row);

  // Primary: accessibility keyboard path (key targeted at the focused row).
  await row.press('Shift+F10');
  try {
    return await waitForVisibleContextMenu(page, 4000);
  } catch {
    /* fall through to mouse */
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  await focusTreeItem(row);
  await row.click({ button: 'right', timeout: 15000 });
  return waitForVisibleContextMenu(page, 8000);
}

async function clickContextMenuCommand(page: Page, label: string): Promise<void> {
  const menu = findVisibleContextMenu(page);
  await expect(menu, 'visible context menu root missing before command click').toBeVisible({ timeout: 5000 });
  const item =
    label === RUN_ALL_REQUESTS
      ? findRunAllMenuItem(menu)
      : menu.getByRole('menuitem', { name: label, exact: true }).first();
  await expect(item, `context menu item "${label}" not found in visible menu`).toBeVisible({ timeout: 5000 });

  // Monaco context menus under Playwright/Electron often focus the item on mouse click
  // without running the command (menu stays open). Prefer keyboard activation.
  await item.focus().catch(() => undefined);
  const focusedOk = await page.evaluate((wanted) => {
    const active = document.activeElement;
    const text = (active?.textContent || '').replace(/\s+/g, ' ').trim();
    return text.includes(wanted);
  }, label);
  if (!focusedOk) {
    // Arrow to the matching item inside the open menu (Run All is usually first).
    for (let i = 0; i < 8; i += 1) {
      const match = await page.evaluate((wanted) => {
        const active = document.activeElement;
        const text = (active?.textContent || '').replace(/\s+/g, ' ').trim();
        return text.includes(wanted);
      }, label);
      if (match) break;
      await page.keyboard.press('ArrowDown');
    }
  }

  await page.keyboard.press('Enter');

  // Command acceptance evidence: context menu dismisses.
  try {
    await expect(menu).toBeHidden({ timeout: 5000 });
    return;
  } catch {
    /* fall through */
  }

  // Fallback: click the inner action-label (hit target VS Code uses for mouse users).
  const actionLabel = item.locator('.action-label').first();
  if (await actionLabel.count()) {
    await actionLabel.click({ timeout: 5000 });
  } else {
    await item.click({ timeout: 5000 });
  }
  await expect(menu, `context menu stayed open after activating "${label}"`).toBeHidden({ timeout: 5000 });
}

async function waitForRunnerOverlay(page: Page): Promise<FrameLocator> {
  const frame = getRequestWebview(page);
  // Prefer stable data-testid evidence over CSS-class-only coupling.
  await frame.locator('[data-testid="runner-start"]').waitFor({ state: 'visible', timeout: 20000 });
  await frame.locator('[data-testid="runner-selected-count"]').waitFor({ state: 'visible', timeout: 10000 });
  return frame;
}

async function ensureRunnerOverlayClosed(page: Page): Promise<void> {
  const frame = getRequestWebview(page);
  const start = frame.locator('[data-testid="runner-start"]');
  if (await start.count()) {
    await start.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => undefined);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function dumpRunnerContextMenuDiagnostics(page: Page, stage: string, err: unknown): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(ARTIFACTS_DIR, `runner-context-menu-${stamp}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return;
  }

  try {
    await page.screenshot({ path: path.join(dir, 'window.png'), fullPage: true });
  } catch {
    /* ignore */
  }

  try {
    const diagnostics = await page.evaluate((runLabel) => {
      const visibleText = (el: Element | null | undefined) =>
        el && (el as HTMLElement).offsetParent !== null ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';

      const contextViews = Array.from(document.querySelectorAll('.context-view')).map((el, index) => {
        const style = window.getComputedStyle(el);
        return {
          index,
          visible: style.visibility !== 'hidden' && style.display !== 'none' && (el as HTMLElement).offsetParent !== null,
          text: visibleText(el).slice(0, 400),
          className: el.className,
        };
      });

      const menuItems = Array.from(
        document.querySelectorAll('.context-view .action-menu-item, .context-view [role="menuitem"]')
      ).map((el) => ({
        text: visibleText(el).slice(0, 120),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        visible: (el as HTMLElement).offsetParent !== null,
      }));

      const runCandidates = menuItems.filter((item) => (item.text || item.ariaLabel || '').includes(runLabel));
      const active = document.activeElement;
      const rows = Array.from(document.querySelectorAll('#workbench\\.view\\.extension\\.tessra-sidebar .monaco-list-row'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .slice(0, 20)
        .map((el) => ({
          text: visibleText(el).slice(0, 80),
          ariaLabel: el.getAttribute('aria-label'),
          ariaSelected: el.getAttribute('aria-selected'),
          className: el.className,
        }));

      return {
        title: document.title,
        contextViewCount: contextViews.length,
        visibleContextViewCount: contextViews.filter((v) => v.visible).length,
        contextViews,
        menuItemCount: menuItems.length,
        runAllCandidates: runCandidates.length,
        menuItems: menuItems.slice(0, 40),
        focused: active
          ? {
              tag: active.tagName,
              id: active.id,
              className: (active as HTMLElement).className,
              ariaLabel: active.getAttribute('aria-label'),
              text: visibleText(active).slice(0, 80),
            }
          : null,
        collectionRows: rows,
        webviewIframeCount: document.querySelectorAll('iframe.webview').length,
        readyWebviewIframeCount: document.querySelectorAll('iframe.webview.ready').length,
      };
    }, RUN_ALL_REQUESTS);

    fs.writeFileSync(
      path.join(dir, 'diagnostics.json'),
      JSON.stringify(
        {
          stage,
          error: err instanceof Error ? { message: err.message, name: err.name } : String(err),
          ...diagnostics,
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (dumpErr) {
    fs.writeFileSync(
      path.join(dir, 'diagnostics-error.txt'),
      `${stage}\n${err}\n${dumpErr}`,
      'utf8'
    );
  }
}

export async function runCollectionFromSidebar(
  page: Page,
  collectionName: string,
  options?: { skipNewRequest?: boolean }
): Promise<FrameLocator> {
  if (!options?.skipNewRequest) {
    await openNewRequestPanel(page);
  } else {
    await ensureRunnerOverlayClosed(page);
  }

  // One recovery attempt after a full open failure — root cause should be locator/focus, not retry storms.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await openTessraActivity(page);
      const row = findCollectionRow(page, collectionName);
      await row.waitFor({ state: 'visible', timeout: 30000 });
      await openContextMenuForTreeItem(page, row);
      await clickContextMenuCommand(page, RUN_ALL_REQUESTS);
      return await waitForRunnerOverlay(page);
    } catch (err) {
      lastError = err;
      const stage =
        err instanceof Error && /context menu/i.test(err.message)
          ? 'context-menu'
          : err instanceof Error && /runner-/i.test(err.message)
            ? 'runner-overlay'
            : 'runCollectionFromSidebar';
      await dumpRunnerContextMenuDiagnostics(page, `${stage}:attempt-${attempt + 1}`, err);
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`runCollectionFromSidebar failed: ${String(lastError)}`);
}

export async function fillUrl(frame: FrameLocator, url: string): Promise<void> {
  const input = frame.locator('[data-testid="request-url"]');
  await input.click({ clickCount: 3 });
  await input.fill(url);
  await input.press('Tab');
}

export async function selectMethod(frame: FrameLocator, method: string): Promise<void> {
  await frame.locator('[data-testid="request-method"]').selectOption(method);
}

export async function clickSend(frame: FrameLocator): Promise<void> {
  await frame.locator('[data-testid="send-request"]').click();
}

export async function waitForResponseStatus(frame: FrameLocator, status: string | RegExp, timeout = 20000): Promise<void> {
  await frame.locator('[data-testid="response-status"]').filter({ hasText: status }).waitFor({
    state: 'visible',
    timeout,
  });
}

async function ensureRequestEditorTab(
  frame: FrameLocator,
  tabName: 'params' | 'headers' | 'body' | 'scripts' | 'auth' | 'settings',
  contentSelector: string
): Promise<void> {
  const tab = frame.locator(`.js-req-tabs .tab[data-tab="${tabName}"]`);
  const panel = frame.locator(`.js-${tabName}-panel`);
  const content = frame.locator(contentSelector);

  const isExpanded = async () => (await tab.getAttribute('aria-expanded')) === 'true';

  if (!(await isExpanded())) {
    await tab.click();
  }
  if (!(await isExpanded())) {
    // Active-tab click toggles collapse; second click expands again.
    await tab.click();
  }

  await expect.poll(async () => tab.getAttribute('aria-expanded'), { timeout: 15000 }).toBe('true');
  await expect(panel).not.toHaveClass(/hidden/);
  await content.waitFor({ state: 'attached', timeout: 5000 });
}

export async function openBodyTab(frame: FrameLocator): Promise<void> {
  await ensureRequestEditorTab(frame, 'body', '[data-testid="request-body-editor"]');
}

export async function openParamsTab(frame: FrameLocator): Promise<void> {
  await ensureRequestEditorTab(frame, 'params', '[data-testid="request-params"]');
}

export async function openHeadersTab(frame: FrameLocator): Promise<void> {
  await ensureRequestEditorTab(frame, 'headers', '[data-testid="request-headers"]');
}

export async function openScriptsTab(frame: FrameLocator): Promise<void> {
  await ensureRequestEditorTab(frame, 'scripts', '[data-testid="script-prerequest"]');
}

export async function openAuthTab(frame: FrameLocator): Promise<void> {
  await ensureRequestEditorTab(frame, 'auth', '.js-auth-type');
}

export async function openSettingsTab(frame: FrameLocator): Promise<void> {
  await ensureRequestEditorTab(frame, 'settings', '.js-timeout');
}

export async function setScriptEditors(
  frame: FrameLocator,
  scripts: { preRequest?: string; test?: string }
): Promise<void> {
  await openScriptsTab(frame);
  if (scripts.preRequest !== undefined) {
    const pre = frame.locator('[data-testid="script-prerequest"]');
    await pre.click({ clickCount: 3 });
    await pre.fill(scripts.preRequest);
  }
  if (scripts.test !== undefined) {
    const testEditor = frame.locator('[data-testid="script-test"]');
    await testEditor.click({ clickCount: 3 });
    await testEditor.fill(scripts.test);
  }
}

export async function waitForPassedTest(frame: FrameLocator, testName: string, timeout = 20000): Promise<void> {
  const testsTab = frame.locator('.js-res-tabs .tab[data-tab="resTests"]');
  await expect(testsTab).toBeVisible({ timeout });
  await testsTab.click();
  const panel = frame.locator('[data-testid="response-tests"]');
  await expect(panel).toBeVisible({ timeout });
  await expect(panel.locator('[data-testid="response-test-row"]').filter({ hasText: testName })).toBeVisible({
    timeout,
  });
  await expect(panel).toContainText(/pass|통과|合格|成功/i);
}

export async function setParamRows(
  frame: FrameLocator,
  rows: Array<{ key: string; value: string }>
): Promise<void> {
  await openParamsTab(frame);
  const container = frame.locator('[data-testid="request-params"]');
  // Clear existing rows via remove buttons
  const removes = container.locator('.rm');
  const count = await removes.count();
  for (let i = count - 1; i >= 0; i -= 1) {
    await removes.nth(i).click();
  }
  for (const row of rows) {
    await frame.locator('.js-add-param').click();
    const last = container.locator('.kv-row').last();
    await last.locator('input[type="text"]').first().fill(row.key);
    await last.locator('.js-kv-value').fill(row.value);
  }
}

export async function responseBodyText(frame: FrameLocator): Promise<string> {
  const raw = frame.locator('[data-testid="response-body"]');
  if (await raw.count()) {
    const text = await raw.innerText();
    if (text.trim()) return text;
  }
  const tree = frame.locator('[data-testid="response-body-tree"]');
  if (await tree.count()) {
    return tree.innerText();
  }
  return '';
}
