import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  waitForResponseStatus,
} from '../helpers/webview';
import type { FrameLocator } from '@playwright/test';

type PreviewLine = {
  name: string;
  missing: string;
  source: string;
  scope: string;
};

async function readUrlPreviewLines(frame: FrameLocator, varName?: string): Promise<PreviewLine[]> {
  return frame.locator('[data-testid="request-url"]').evaluate((el, name) => {
    const lines = Array.from(
      new DOMParser()
        .parseFromString((el as HTMLInputElement).dataset.varPreviewHtml || '', 'text/html')
        .querySelectorAll('[data-testid="var-preview-line"]')
    ).map((node) => ({
      name: (node as HTMLElement).dataset.varName || '',
      missing: (node as HTMLElement).dataset.varMissing || '',
      source: (node as HTMLElement).dataset.varSource || '',
      scope: (node as HTMLElement).dataset.varScope || '',
    }));
    return name ? lines.filter((line) => line.name === name) : lines;
  }, varName);
}

async function readNamedOccurrenceState(frame: FrameLocator, varName: string) {
  return frame.locator('body').evaluate((_, name) => {
    const unresolved = Array.from(
      document.querySelectorAll(`[data-testid="url-var-unresolved"][data-var-name="${name}"]`)
    ).map((el) => (el as HTMLElement).dataset.varScope || '');
    const resolved = Array.from(
      document.querySelectorAll(`[data-testid="url-var-resolved"][data-var-name="${name}"]`)
    ).map((el) => ({
      scope: (el as HTMLElement).dataset.varScope || '',
      source: (el as HTMLElement).dataset.varSource || '',
    }));
    const row = document.querySelector('[data-testid="path-variable-row"]') as HTMLElement | null;
    return {
      unresolved,
      resolved,
      override: row?.dataset.override || '',
      mode: row?.dataset.mode || '',
    };
  }, varName);
}

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

    await expect
      .poll(async () => {
        return frame.locator('[data-testid="url-var-unresolved"][data-var-name="dsgIdn"]').count();
      }, { timeout: 8000 })
      .toBe(0);

    const dsgLine = (await readUrlPreviewLines(frame, 'dsgIdn'))[0];
    expect(dsgLine).toEqual(expect.objectContaining({
      missing: 'false',
      source: 'request',
      scope: 'path',
    }));

    await clickSend(frame);
    await waitForResponseStatus(frame, /404|200/);
    const hit = await tessra.server.waitForRequest((r) => r.pathname === '/mz-chat/1111/customer.do');
    expect(hit.pathname).toBe('/mz-chat/1111/customer.do');

    await fillUrl(frame, '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do?echo={{dsgIdn}}');
    await expect(valueInput).toHaveValue('1111');

    await expect
      .poll(async () => readNamedOccurrenceState(frame, 'dsgIdn'), { timeout: 8000 })
      .toMatchObject({
        unresolved: ['other'],
        resolved: [{ scope: 'path', source: 'path-override' }],
        override: '1',
      });

    const mixedLines = await readUrlPreviewLines(frame, 'dsgIdn');
    expect(mixedLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'path', missing: 'false', source: 'request' }),
      expect.objectContaining({ scope: 'other', missing: 'true' }),
    ]));

    await valueInput.fill('');
    await expect(valueInput).toHaveValue('');
    await expect
      .poll(async () => readNamedOccurrenceState(frame, 'dsgIdn'), { timeout: 8000 })
      .toMatchObject({
        unresolved: expect.arrayContaining(['path', 'other']),
        resolved: [],
        override: '0',
      });

    const clearedLines = await readUrlPreviewLines(frame, 'dsgIdn');
    expect(clearedLines.length).toBeGreaterThan(0);
    expect(clearedLines.every((line) => line.missing === 'true' && line.source !== 'request')).toBe(true);
    await expect(frame.locator('.preflight-warning')).toHaveCount(1);

    await fillUrl(frame, '{{baseUrl}}/mz-chat/{{customerId}}/customer.do');
    await expect(section).toBeVisible();
    await expect(frame.locator('[data-testid="path-variable-env-value"]')).toHaveText('9000');

    await frame.locator('[data-testid="path-variable-override"]').click();
    await expect(valueInput).toBeVisible();
    await valueInput.fill('1111');
    await expect(valueInput).toHaveValue('1111');

    await expect
      .poll(async () => {
        const lines = await readUrlPreviewLines(frame, 'customerId');
        return lines.find((line) => line.scope === 'path');
      }, { timeout: 8000 })
      .toEqual(expect.objectContaining({
        missing: 'false',
        source: 'request',
      }));
    await expect(frame.locator('[data-testid="url-var-unresolved"][data-var-name="customerId"]')).toHaveCount(0);

    await valueInput.fill('');
    await expect(frame.locator('[data-testid="path-variable-env-value"]')).toHaveText('9000');
    await expect(frame.locator('[data-testid="path-variable-value"]')).toHaveCount(0);
    await expect(frame.locator('[data-testid="path-variable-row"]')).toHaveAttribute('data-mode', 'environment');

    await expect
      .poll(async () => {
        const lines = await readUrlPreviewLines(frame, 'customerId');
        return lines.find((line) => line.scope === 'path');
      }, { timeout: 8000 })
      .toEqual(expect.objectContaining({
        missing: 'false',
        source: 'environment',
      }));
    await expect(frame.locator('[data-testid="url-var-unresolved"][data-var-name="customerId"]')).toHaveCount(0);
  });
});
