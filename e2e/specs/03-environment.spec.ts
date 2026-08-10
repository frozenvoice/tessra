import { test, expect } from '../fixtures';
import { openNewRequestPanel } from '../helpers/webview';

test.describe('E2E #3 Environment disclosure', () => {
  test('status Environment segment opens editable disclosure', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);

    const envSeg = frame.locator('[data-testid="status-environment"]');
    await expect(envSeg).toBeVisible();
    await expect(envSeg).toContainText(/vars|Tessra E2E|Environment/i);

    await envSeg.click();
    const disclosure = frame.locator('[data-testid="environment-disclosure"]');
    await expect(disclosure).toBeVisible();
    await expect(disclosure).not.toHaveClass(/hidden/);

    const keyValues = await frame.locator('[data-testid="environment-var-rows"] .kv-row').evaluateAll((nodes) =>
      nodes.map((node) => {
        const textInputs = Array.from(
          node.querySelectorAll('input[type="text"], input[type="password"]')
        ) as HTMLInputElement[];
        return textInputs[0]?.value || '';
      })
    );
    expect(keyValues).toEqual(expect.arrayContaining(['baseUrl', 'token', 'envName']));
    await expect(frame.locator('[data-testid="environment-add-variable"]')).toBeEnabled();

    await frame.locator('[data-testid="environment-disclosure-close"]').click();
    await expect(disclosure).toHaveClass(/hidden/);
  });
});
