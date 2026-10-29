import { test, expect } from '../fixtures';
import { openNewRequestPanel, openParamsTab, openHeadersTab, fillUrl, clickSend, waitForResponseStatus, runCommand } from '../helpers/webview';
import { captureWindow } from '../helpers/vscode';
import * as fs from 'fs';
import * as path from 'path';

test.describe('E2E #28 UI clarity', () => {
  test('labels request context and columns, preserves JSON bytes and keyboard folding at narrow width', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    const phase = process.env.TESSRA_UI_CAPTURE_PHASE || 'after';
    const dir = path.resolve('e2e/.artifacts/ui-clarity');
    fs.mkdirSync(dir, { recursive: true });
    // Native Show command is idempotent; an Activity Bar retry can toggle a slowly opening sidebar shut.
    await runCommand(tessra.page, 'View: Show Tessra - API Client');
    await expect(tessra.page.locator('.monaco-list[aria-label="Collections"]')).toBeVisible({ timeout: 45000 });
    await fillUrl(frame, '{{baseUrl}}/users');
    await openParamsTab(frame);
    await expect(frame.locator('[data-testid="request-params"] .kv-row')).toHaveCount(0);
    await frame.locator('.js-add-param').click();
    await expect(frame.locator('[data-testid="request-params"] .kv-row')).toHaveCount(1);
    await captureWindow(tessra.app, path.join(dir, phase + '-params.png'));
    await openHeadersTab(frame);
    await frame.locator('.js-add-header').click();
    await captureWindow(tessra.app, path.join(dir, phase + '-headers.png'));
    await clickSend(frame);
    await waitForResponseStatus(frame, '200');
    await expect(frame.locator('[data-testid="response-body-tree"]')).toBeVisible();
    await captureWindow(tessra.app, path.join(dir, phase + '-json-sidebar.png'));
    if (phase === 'before') return;
    await expect(frame.locator('.status-strip-seg[data-meta="settings:save-history"]')).toContainText('Record history');
    await expect(frame.locator('[data-testid="status-variable-usage"]')).toContainText('Request vars');
    await expect(frame.locator('[data-testid="status-variable-usage"]')).toHaveAttribute('title', /Distinct variables referenced/);
    const tree = frame.locator('[data-testid="response-body-tree"]');
    const responseText = await frame.locator('[data-testid="response-body"]').textContent();
    const toggle = tree.locator('button.jt-toggle').first();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('title', 'Expand or collapse JSON node: $');
    await toggle.focus();
    await toggle.press('ArrowLeft');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.press('ArrowRight');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const firstNumberRow = tree.locator('.jt-row:has(.jt-num):has(.jt-comma)').first();
    const spacing = await firstNumberRow.evaluate(row => {
      const value = row.querySelector('.jt-num')!;
      const comma = row.querySelector('.jt-comma')!;
      return comma.getBoundingClientRect().left - value.getBoundingClientRect().right;
    });
    expect(spacing).toBeLessThan(1);
    // Preserve the existing Copy policy (the selected pretty format); saved history keeps transport text.
    await frame.locator('[data-testid="response-overflow"]').click();
    await frame.locator('.js-copy-response').click();
    const clipboard = await tessra.app.evaluate(({ clipboard }) => clipboard.readText());
    const historyPath = path.join(tessra.userDataDir, 'User/globalStorage/frozenvoice.tessra/history.json');
    await expect.poll(() => JSON.parse(fs.readFileSync(historyPath, 'utf8')).length).toBe(1);
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    expect(clipboard).toBe(responseText);
    expect(history[0].request.params).toEqual([]);
    expect(history[0].request.headers).toEqual([]);
    const win = await tessra.app.browserWindow(tessra.page);
    await win.evaluate(w => w.setBounds({ x: 40, y: 40, width: 800, height: 680 }));
    await tessra.page.setViewportSize({ width: 800, height: 680 });
    await openParamsTab(frame);
    await expect(frame.locator('[data-testid="params-column-headings"]')).toContainText('Key');
    await expect(frame.locator('[data-testid="params-column-headings"]')).toContainText('Value');
    const geometry = await frame.locator('[data-testid="params-column-headings"]').evaluate(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: window.innerWidth, overflow: document.body.scrollWidth - window.innerWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await expect(frame.locator('[data-testid="request-params"] input[type="checkbox"]')).toHaveCount(0);
    await frame.locator('.js-add-param').click();
    await expect(frame.getByRole('checkbox', { name: 'Enable row' }).first()).toBeVisible();
    await expect(frame.locator('[data-testid="request-params"] input').nth(1)).toHaveAttribute('aria-label', 'Key');
    await expect(frame.locator('[data-testid="request-params"] .js-kv-value')).toHaveAttribute('aria-label', 'Value');
    await captureWindow(tessra.app, path.join(dir, phase + '-narrow.png'));
    await openHeadersTab(frame);
    await expect(frame.locator('[data-testid="headers-column-headings"]')).toContainText('Value');
    await frame.locator('.js-open-default-headers').first().click();
    await expect(frame.locator('#defaultHeadersEditor')).toBeVisible();
    await frame.locator('#addDefaultHeaderBtn').click();
    const defaultRow = frame.locator('#defaultHeaderRows .kv-row').last();
    await defaultRow.locator('input[type="text"]').first().fill('X-Ui-Fixture');
    await defaultRow.locator('.js-kv-value').fill('ui-clarity');
    await frame.locator('#defaultHeadersSaveBtn').click();
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(tessra.userDataDir, 'User/globalStorage/frozenvoice.tessra/default-headers.json'), 'utf8')).length).toBe(1);
    await frame.locator('#defaultHeadersCloseBtn').click();
    // Secondary context can be collapsed at narrow width; its tooltip still explains exact application.
    await expect(frame.locator('.status-strip-seg[data-action="open-default-headers"]')).toContainText('Default headers 1');
    await expect(frame.locator('.status-strip-seg[data-action="open-default-headers"]')).toHaveAttribute('title', /override matching names: X-Ui-Fixture/);
    for (const locale of [
      { option: 'Korean / 한국어', key: '키', value: '값', history: '히스토리 저장', vars: '요청 변수' },
      { option: 'Japanese / 日本語', key: 'キー', value: '値', history: '履歴に保存', vars: 'リクエスト変数' },
    ]) {
      await runCommand(tessra.page, 'Tessra: Change Display Language');
      const option = tessra.page.locator('.quick-input-list .monaco-list-row').filter({ hasText: locale.option }).first();
      await option.waitFor({ state: 'visible' });
      await option.click();
      await expect(frame.locator('[data-testid="headers-column-headings"]')).toContainText(locale.key);
      await expect(frame.locator('[data-testid="headers-column-headings"]')).toContainText(locale.value);
      await expect(frame.locator('.status-strip-seg[data-meta="settings:save-history"]')).toContainText(locale.history);
      await expect(frame.locator('[data-testid="status-variable-usage"]')).toContainText(locale.vars);
      await expect(frame.locator('[data-testid="request-url"]')).toHaveValue('{{baseUrl}}/users');
      const manageGeometry = await frame.locator('.js-open-default-headers').first().evaluate(el => {
        const r = el.getBoundingClientRect();
        return { right: r.right, width: window.innerWidth, nowrap: getComputedStyle(el).whiteSpace };
      });
      expect(manageGeometry.right).toBeLessThanOrEqual(manageGeometry.width);
      expect(manageGeometry.nowrap).toBe('nowrap');
      await captureWindow(tessra.app, path.join(dir, phase + '-' + (locale.option.startsWith('Korean') ? 'ko' : 'ja') + '.png'));
    }
  });
});
