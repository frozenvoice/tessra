import { test, expect } from '../fixtures';
import { openBodyTab, openNewRequestPanel } from '../helpers/webview';
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
  await page.setViewportSize({ width: w, height: h });
  await expect
    .poll(async () => {
      const box = await page.locator('.monaco-workbench').boundingBox();
      return box?.height ?? 0;
    }, { timeout: 8000 })
    .toBeLessThan(h + 80);
}

function buildLongJson(lines = 120): string {
  const items = Array.from({ length: lines }, (_, i) => `  "line_${String(i + 1).padStart(3, '0')}": "payload-${i + 1}"`);
  return `{\n${items.join(',\n')}\n}`;
}

async function selectBodyTypeKeepingText(frame: FrameLocator, type: string): Promise<void> {
  await frame.locator('[data-testid="body-type"]').selectOption(type);
  const keep = frame.locator('[data-testid="body-convert-keep"]');
  try {
    await keep.waitFor({ state: 'visible', timeout: 1500 });
    await keep.click();
  } catch {
    // No conversion dialog for this transition.
  }
  await expect.poll(async () => frame.locator('[data-testid="body-type"]').inputValue()).toBe(type);
}

async function measureBodyScrollContract(frame: FrameLocator) {
  return frame.locator('body').evaluate(() => {
    const isVerticallyScrollable = (el: Element | null) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canOverflow = overflowY === 'auto' || overflowY === 'scroll';
      return canOverflow && el.scrollHeight > el.clientHeight + 2;
    };

    const panel = document.querySelector('.js-body-panel') as HTMLElement | null;
    const editor = document.querySelector('.js-body-editor') as HTMLElement | null;
    const textarea = document.querySelector('[data-testid="request-body-editor"]') as HTMLTextAreaElement | null;
    const highlight = document.querySelector('.js-body-highlight') as HTMLElement | null;
    if (!panel || !editor || !textarea || !highlight) {
      return null;
    }

    const candidates = [panel, editor, textarea, highlight, ...Array.from(panel.querySelectorAll('*'))];
    const scrollable = candidates
      .filter((el, idx, arr) => arr.indexOf(el) === idx)
      .filter((el) => isVerticallyScrollable(el))
      .map((el) => {
        if (el === textarea) return 'textarea';
        if (el === panel) return 'panel';
        if (el === editor) return 'editor';
        if (el === highlight) return 'highlight';
        return (el as HTMLElement).className || el.tagName;
      });

    const panelStyle = window.getComputedStyle(panel);
    const taStyle = window.getComputedStyle(textarea);
    const hiStyle = window.getComputedStyle(highlight);

    return {
      panelOverflowY: panelStyle.overflowY,
      panelScrollTop: panel.scrollTop,
      panelScrollRange: panel.scrollHeight - panel.clientHeight,
      textareaOverflowY: taStyle.overflowY,
      textareaScrollHeight: textarea.scrollHeight,
      textareaClientHeight: textarea.clientHeight,
      highlightOverflowY: hiStyle.overflowY,
      highlightScrollTop: highlight.scrollTop,
      textareaScrollTop: textarea.scrollTop,
      isTextBody: panel.classList.contains('is-text-body'),
      scrollable,
      clientHeight: document.documentElement.clientHeight,
    };
  });
}

test.describe('E2E #20 Body text scroll ownership', () => {
  test('keeps a single vertical scroll owner under short windows', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await openBodyTab(frame);
    await frame.locator('[data-testid="body-type"]').selectOption('json');
    const editor = frame.locator('[data-testid="request-body-editor"]');
    await editor.fill(buildLongJson(120));
    await expect(editor).toHaveValue(/line_120/);

    const heights = [900, 700, 620];
    for (const height of heights) {
      await setElectronWindowSize(tessra.app, tessra.page, 1000, height);
      await expect
        .poll(async () => {
          const m = await measureBodyScrollContract(frame);
          return m?.clientHeight ?? 0;
        }, { timeout: 8000 })
        .toBeLessThan(height + 40);

      await expect
        .poll(async () => measureBodyScrollContract(frame), { timeout: 10000 })
        .toEqual(expect.objectContaining({
          isTextBody: true,
          scrollable: ['textarea'],
        }));

      const before = await measureBodyScrollContract(frame);
      expect(before).not.toBeNull();
      expect(before!.textareaScrollHeight).toBeGreaterThan(before!.textareaClientHeight + 2);
      expect(['auto', 'scroll']).toContain(before!.textareaOverflowY);
      expect(before!.panelOverflowY === 'hidden' || before!.panelScrollRange <= 2).toBe(true);

      await editor.hover();
      await tessra.page.mouse.wheel(0, 500);
      await expect
        .poll(async () => {
          const m = await measureBodyScrollContract(frame);
          return {
            top: m?.textareaScrollTop ?? 0,
            panelTop: m?.panelScrollTop ?? -1,
            sync: Math.abs((m?.highlightScrollTop ?? 0) - (m?.textareaScrollTop ?? 0)),
            scrollable: m?.scrollable,
          };
        }, { timeout: 8000 })
        .toEqual(expect.objectContaining({
          panelTop: 0,
          scrollable: ['textarea'],
        }));

      const afterDown = await measureBodyScrollContract(frame);
      expect(afterDown!.textareaScrollTop).toBeGreaterThan(before!.textareaScrollTop);
      expect(Math.abs(afterDown!.highlightScrollTop - afterDown!.textareaScrollTop)).toBeLessThanOrEqual(2);

      const midTop = afterDown!.textareaScrollTop;
      await tessra.page.mouse.wheel(0, -500);
      await expect
        .poll(async () => {
          const m = await measureBodyScrollContract(frame);
          return m?.textareaScrollTop ?? midTop;
        }, { timeout: 8000 })
        .toBeLessThan(midTop);
    }

    await selectBodyTypeKeepingText(frame, 'raw');
    await expect(editor).toHaveValue(/line_120/);
    await expect
      .poll(async () => measureBodyScrollContract(frame), { timeout: 8000 })
      .toEqual(expect.objectContaining({
        isTextBody: true,
        scrollable: ['textarea'],
      }));

    await selectBodyTypeKeepingText(frame, 'json');
    await expect
      .poll(async () => measureBodyScrollContract(frame), { timeout: 8000 })
      .toEqual(expect.objectContaining({
        isTextBody: true,
        scrollable: ['textarea'],
      }));

    await selectBodyTypeKeepingText(frame, 'formdata');
    await expect
      .poll(async () => {
        return frame.locator('.js-body-panel').evaluate((el) => el.classList.contains('is-text-body'));
      }, { timeout: 8000 })
      .toBe(false);
  });
});
