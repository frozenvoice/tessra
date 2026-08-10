import type { FrameLocator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const isMac = process.platform === 'darwin';

export async function runCommand(page: Page, commandLabel: string): Promise<void> {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.locator('.monaco-workbench').click({ position: { x: 400, y: 240 }, timeout: 10000 }).catch(() => undefined);
  await page.keyboard.press(isMac ? 'Meta+Shift+P' : 'Control+Shift+P');
  // Prefer `.input` class — a bare `input` also matches the hidden quick-input checkbox.
  const input = page.locator('.quick-input-widget .input');
  await input.waitFor({ state: 'visible', timeout: 20000 });
  await input.fill(`> ${commandLabel}`);
  const option = page.locator('.quick-input-list .monaco-list-row').filter({ hasText: commandLabel }).first();
  await option.waitFor({ state: 'visible', timeout: 30000 });
  await option.click();
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

export async function openTessraActivity(page: Page): Promise<void> {
  const byLabel = page.locator('.activitybar [aria-label*="Tessra"]').first();
  if (await byLabel.count()) {
    await byLabel.click({ timeout: 15000 });
  } else {
    await page.locator('.activitybar .action-item').filter({ hasText: /Tessra/i }).first().click({ timeout: 15000 });
  }
  await page.locator('.monaco-list-row').filter({ hasText: /E2E Runner/i }).first().waitFor({
    state: 'visible',
    timeout: 45000,
  });
}

export async function runCollectionFromSidebar(
  page: Page,
  collectionName: string,
  options?: { skipNewRequest?: boolean }
): Promise<FrameLocator> {
  if (!options?.skipNewRequest) {
    await openNewRequestPanel(page);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await openTessraActivity(page);
      const item = page.locator('.monaco-list-row').filter({ hasText: collectionName }).first();
      await item.waitFor({ state: 'visible', timeout: 30000 });
      await page.keyboard.press('Escape').catch(() => undefined);
      await item.click();
      await item.focus();
      // Prefer keyboard context menu — more reliable under Electron automation than mouse right-click.
      await page.keyboard.press('Shift+F10');
      let runLabel = page.getByText('Run All Requests', { exact: true });
      if (!(await runLabel.isVisible().catch(() => false))) {
        await item.click({ button: 'right' });
        runLabel = page.getByText('Run All Requests', { exact: true });
      }
      await expect(runLabel).toBeVisible({ timeout: 10000 });
      await runLabel.click();

      const frame = getRequestWebview(page);
      await expect.poll(async () => frame.locator('.runner-overlay').count(), { timeout: 20000 }).toBeGreaterThan(0);
      await frame.locator('[data-testid="runner-start"]').waitFor({ state: 'attached', timeout: 10000 });
      return frame;
    } catch (err) {
      lastError = err;
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
  tabName: 'params' | 'headers' | 'body',
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
