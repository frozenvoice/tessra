import { test, expect } from '../fixtures';
import { openBodyTab, openNewRequestPanel } from '../helpers/webview';

const isMac = process.platform === 'darwin';

test.describe('E2E #5 Body syntax / conversion / undo', () => {
  test('JSON body convert to XML then undo restores JSON', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await openBodyTab(frame);

    await frame.locator('[data-testid="body-type"]').selectOption('json');
    const editor = frame.locator('[data-testid="request-body-editor"]');
    await editor.fill('{\n  "title": "Tessra E2E",\n  "count": 1\n}');
    await expect(editor).toHaveValue(/Tessra E2E/);

    await frame.locator('[data-testid="body-type"]').selectOption('xml');
    await frame.locator('[data-testid="body-convert-confirm"]').click();
    await expect(frame.locator('[data-testid="body-type"]')).toHaveValue('xml');
    await expect(editor).toHaveValue(/<title>Tessra E2E<\/title>|<count>1<\/count>|Tessra E2E/);

    await editor.focus();
    await tessra.page.keyboard.press(isMac ? 'Meta+Z' : 'Control+Z');

    await expect.poll(async () => frame.locator('[data-testid="body-type"]').inputValue()).toBe('json');
    await expect(editor).toHaveValue(/"title"\s*:\s*"Tessra E2E"/);
  });
});
