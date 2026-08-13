import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  waitForResponseStatus,
} from '../helpers/webview';

test.describe('E2E #19 Path Variable occurrence resolution UI', () => {
  test('request-local path override clears path unresolved UI without resolving query', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await fillUrl(frame, '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do');

    const section = frame.locator('[data-testid="path-variables"]');
    await expect(section).toBeVisible();
    const rows = frame.locator('[data-testid="path-variable-row"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('dsgIdn');

    const valueInput = frame.locator('[data-testid="path-variable-value"]');
    await expect(valueInput).toBeVisible();
    await valueInput.fill('1111');
    await expect(valueInput).toHaveValue('1111');

    const url = frame.locator('[data-testid="request-url"]');
    await expect
      .poll(async () => {
        return frame.locator('[data-testid="url-var-unresolved"][data-var-name="dsgIdn"]').count();
      }, { timeout: 8000 })
      .toBe(0);

    const preview = await url.evaluate((el: HTMLInputElement) => ({
      html: el.dataset.varPreviewHtml || '',
      text: el.dataset.varPreview || '',
      lines: Array.from(
        new DOMParser()
          .parseFromString(el.dataset.varPreviewHtml || '', 'text/html')
          .querySelectorAll('[data-testid="var-preview-line"]')
      ).map((node) => ({
        name: (node as HTMLElement).dataset.varName || '',
        missing: (node as HTMLElement).dataset.varMissing || '',
        source: (node as HTMLElement).dataset.varSource || '',
        scope: (node as HTMLElement).dataset.varScope || '',
      })),
    }));
    const dsgLine = preview.lines.find((line) => line.name === 'dsgIdn');
    expect(dsgLine).toEqual(expect.objectContaining({
      missing: 'false',
      source: 'request',
      scope: 'path',
    }));
    expect(preview.lines.some((line) => line.name === 'dsgIdn' && line.missing === 'true')).toBe(false);
    expect(preview.text.toLowerCase()).not.toContain('missing');

    await clickSend(frame);
    await waitForResponseStatus(frame, /404|200/);
    const hit = await tessra.server.waitForRequest((r) => r.pathname === '/mz-chat/1111/customer.do');
    expect(hit.pathname).toBe('/mz-chat/1111/customer.do');

    await fillUrl(frame, '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do?echo={{dsgIdn}}');
    await expect(valueInput).toHaveValue('1111');

    await expect
      .poll(async () => {
        return frame.locator('body').evaluate(() => {
          const unresolved = Array.from(
            document.querySelectorAll('[data-testid="url-var-unresolved"][data-var-name="dsgIdn"]')
          ).map((el) => (el as HTMLElement).dataset.varScope || '');
          const resolved = Array.from(
            document.querySelectorAll('[data-testid="url-var-resolved"][data-var-name="dsgIdn"]')
          ).map((el) => ({
            scope: (el as HTMLElement).dataset.varScope || '',
            source: (el as HTMLElement).dataset.varSource || '',
          }));
          const previewHtml = (document.querySelector('[data-testid="request-url"]') as HTMLInputElement | null)
            ?.dataset.varPreviewHtml || '';
          return { unresolved, resolved, previewHtml };
        });
      }, { timeout: 8000 })
      .toMatchObject({
        unresolved: ['other'],
        resolved: [{ scope: 'path', source: 'path-override' }],
      });

    const mixedLines = await url.evaluate((el: HTMLInputElement) =>
      Array.from(
        new DOMParser()
          .parseFromString(el.dataset.varPreviewHtml || '', 'text/html')
          .querySelectorAll('[data-testid="var-preview-line"][data-var-name="dsgIdn"]')
      ).map((node) => ({
        missing: (node as HTMLElement).dataset.varMissing || '',
        source: (node as HTMLElement).dataset.varSource || '',
        scope: (node as HTMLElement).dataset.varScope || '',
      }))
    );
    expect(mixedLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'path', missing: 'false', source: 'request' }),
      expect.objectContaining({ scope: 'other', missing: 'true' }),
    ]));
  });
});
