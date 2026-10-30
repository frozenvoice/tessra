import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import type { FrameLocator } from '@playwright/test';
import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, openSettingsTab, waitForResponseStatus, runCommand, getRequestWebview } from '../helpers/webview';
import { captureWindow } from '../helpers/vscode';

async function sseFixture() {
  const sockets = new Set<net.Socket>();
  const timers = new Set<ReturnType<typeof setInterval>>();
  const hits: Array<{ route: string; method: string }> = [];
  const server = http.createServer((request, response) => {
    const route = request.url || '/';
    hits.push({ route, method: request.method || '' });
    if (route === '/ordinary') { response.writeHead(200, { 'Content-Type': 'text/plain' }); response.end('current ordinary response'); return; }
    response.writeHead(route === '/status-error' ? 500 : 200, { 'Content-Type': 'text/event-stream; charset=windows-1252' });
    response.flushHeaders();
    const writeTimer = (callback: () => void, delay: number) => {
      const timer = setInterval(callback, delay); timers.add(timer);
      response.on('close', () => { clearInterval(timer); timers.delete(timer); });
      return timer;
    };
    if (route === '/finite') {
      // Every byte is a separate transport write: BOM/UTF-8/CRLF boundaries are intentional.
      const bytes = Buffer.from('\ufeff: fixture comment\r\nevent: custom\r\nid: fixture-한\r\nretry: 2500\r\ndata: 한글 😀\r\ndata: second line\r\n\r\ndata: unfinished tail');
      let index = 0;
      const timer = writeTimer(() => {
        if (index < bytes.length) response.write(bytes.subarray(index, ++index));
        else { clearInterval(timer); timers.delete(timer); response.end(); }
      }, 2);
    } else if (route === '/burst') {
      response.write('data: ' + 'oversize'.repeat(45000) + '\n\n');
      for (let index = 0; index < 650; index++) response.write('id: ' + index + '\ndata: event-' + index + ' ' + 'x'.repeat(2300) + '\n\n');
      response.end();
    } else if (route === '/status-error') {
      response.end('event: server-error\ndata: ordinary SSE payload at HTTP 500\n\n');
    } else if (route === '/transport-error') {
      response.write('data: before transport error\n\n');
      const timer = writeTimer(() => { clearInterval(timer); timers.delete(timer); response.destroy(new Error('synthetic fixture transport failure')); }, 150);
    } else {
      response.write('data: initial fixture event\n\n');
      let index = 0;
      writeTimer(() => response.write('id: ' + index++ + '\ndata: <img src=x onerror=alert(1)> 한글 😀 slow event\n\n'), 80);
    }
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`, sockets, timers, hits,
    async close() { for (const timer of timers) clearInterval(timer); for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
async function setTimeoutSeconds(frame: FrameLocator, seconds: number) {
  await openSettingsTab(frame);
  await frame.locator('.js-timeout').fill(String(seconds));
}

// All traffic uses a local fixture and an isolated VS Code profile; no external API tokens.
test.describe('E2E #30 SSE incremental responses', () => {
  test('renders UTF-8 split standard fields, leaves incomplete EOF undispatched, and handles non-2xx SSE without retry', async ({ tessra }) => {
    const fixture = await sseFixture();
    try {
      const frame = await openNewRequestPanel(tessra.page);
      await fillUrl(frame, fixture.baseUrl + '/finite');
      await frame.getByTestId('request-method').selectOption('POST');
      await clickSend(frame);
      await expect(frame.getByTestId('sse-state')).toContainText(/completed/i);
      await expect(frame.getByTestId('sse-event')).toHaveCount(1);
      await expect(frame.getByTestId('sse-event-data')).toHaveText('한글 😀\nsecond line');
      await expect(frame.locator('.sse-event-meta')).toContainText('custom');
      await expect(frame.locator('.sse-event-meta')).toContainText('fixture-한');
      await expect(frame.locator('.sse-event-meta')).toContainText('2500');
      await expect(frame.getByTestId('sse-loss')).toContainText(/incomplete|unfinished/i);
      expect(fixture.hits.filter(hit => hit.route === '/finite')).toEqual([{ route: '/finite', method: 'POST' }]);
      await frame.locator('.js-sse-events').focus();
      await frame.locator('.js-sse-events').press('ArrowRight');
      await expect(frame.locator('.js-sse-raw')).toBeFocused();
      await expect(frame.locator('.js-sse-raw')).toHaveAttribute('aria-selected', 'true');
      await expect(frame.getByTestId('sse-raw')).toContainText('data: unfinished tail');
      await frame.locator('.js-sse-raw').press('Home');
      await expect(frame.locator('.js-sse-events')).toBeFocused();
      await frame.locator('.js-sse-copy').click();
      await expect(frame.getByTestId('sse-event-data')).toHaveText('한글 😀\nsecond line');

      await openSettingsTab(frame);
      await frame.locator('.js-retry-count').fill('2');
      await fillUrl(frame, fixture.baseUrl + '/status-error');
      await clickSend(frame);
      await expect(frame.getByTestId('sse-state')).toContainText(/completed/i);
      await expect(frame.getByTestId('response-status')).toContainText('500');
      await expect(frame.getByTestId('sse-event-data')).toHaveText('ordinary SSE payload at HTTP 500');
      expect(fixture.hits.filter(hit => hit.route === '/status-error')).toHaveLength(1);
    } finally { await fixture.close(); }
  });

  test('shows slow untrusted events before EOF, keeps Stop active, honors deadline and discards canceled run chunks', async ({ tessra }) => {
    const fixture = await sseFixture();
    try {
      const frame = await openNewRequestPanel(tessra.page);
      await setTimeoutSeconds(frame, 0); // Explicit opt-in for long streams.
      await fillUrl(frame, fixture.baseUrl + '/slow');
      await frame.getByTestId('request-method').selectOption('POST');
      await clickSend(frame);
      await expect(frame.getByTestId('sse-state')).toContainText(/receiving/i);
      await expect(frame.getByTestId('sse-events')).toContainText('한글 😀 slow event');
      await expect(frame.getByTestId('sse-events').locator('img,script')).toHaveCount(0);
      await expect(frame.getByTestId('stop-request')).toBeEnabled();
      await frame.locator('.js-sse-raw').click();
      await expect(frame.getByTestId('sse-raw')).toContainText(/available|receiving|finish/i);
      await frame.locator('.js-sse-events').click();
      const screenshotDir = path.resolve('e2e/.artifacts/sse-streaming'); fs.mkdirSync(screenshotDir, { recursive: true });
      await captureWindow(tessra.app, path.join(screenshotDir, 'receiving.png'));
      await frame.getByTestId('stop-request').click();
      await expect(frame.getByTestId('sse-state')).toContainText(/stopped|aborted|canceled/i);
      await expect(frame.getByTestId('sse-state')).toContainText(/partial/i);
      await expect(frame.getByTestId('sse-events')).toContainText('initial fixture event');
      await expect.poll(() => fixture.timers.size).toBe(0);
      await expect.poll(() => fixture.sockets.size).toBe(0);
      expect(fixture.hits.filter(hit => hit.route === '/slow')).toEqual([{ route: '/slow', method: 'POST' }]);
      await captureWindow(tessra.app, path.join(screenshotDir, 'stopped-partial.png'));
      await fillUrl(frame, fixture.baseUrl + '/ordinary');
      await clickSend(frame);
      await waitForResponseStatus(frame, /200/);
      await expect(frame.getByTestId('response-body')).toHaveText('current ordinary response');
      await expect(frame.getByTestId('sse-response')).toHaveCount(0);

      await setTimeoutSeconds(frame, 1);
      await fillUrl(frame, fixture.baseUrl + '/deadline');
      await clickSend(frame);
      await expect(frame.getByTestId('sse-state')).toContainText(/timeout|timed out/i);
      await expect(frame.getByTestId('sse-state')).toContainText(/partial/i);
      await expect(frame.getByTestId('sse-events')).toContainText('initial fixture event');
      await expect.poll(() => fixture.timers.size).toBe(0);
      await expect.poll(() => fixture.sockets.size).toBe(0);
      expect(fixture.hits.filter(hit => hit.route === '/deadline')).toHaveLength(1);
    } finally { await fixture.close(); }
  });

  test('caps event and raw display retention, marks loss and transport failure, and cancels on profile switch', async ({ tessra }) => {
    const fixture = await sseFixture();
    try {
      let frame = await openNewRequestPanel(tessra.page);
      await fillUrl(frame, fixture.baseUrl + '/burst');
      await clickSend(frame);
      await expect(frame.getByTestId('sse-state')).toContainText(/completed/i);
      await expect(frame.getByTestId('sse-event')).toHaveCount(500);
      await expect(frame.getByTestId('sse-counts')).toContainText(/650/);
      await expect(frame.getByTestId('sse-counts')).toContainText(/150/);
      await expect(frame.getByTestId('sse-loss')).toContainText(/limit|large|oversize/i);
      await expect(frame.getByTestId('sse-loss')).toContainText(/truncat|raw/i);
      await frame.locator('.js-sse-raw').click();
      const raw = await frame.getByTestId('sse-raw').textContent();
      expect(Buffer.byteLength(raw || '', 'utf8')).toBeLessThanOrEqual(1024 * 1024 + 3);
      await frame.locator('.js-sse-events').click();
      await expect(frame.getByTestId('sse-event').first()).toContainText('event-150');
      await expect(frame.getByTestId('sse-event').last()).toContainText('event-649');

      await fillUrl(frame, fixture.baseUrl + '/transport-error');
      await clickSend(frame);
      await expect(frame.getByTestId('sse-state')).toContainText(/error/i);
      await expect(frame.getByTestId('sse-state')).toContainText(/partial/i);
      await expect(frame.getByTestId('sse-events')).toContainText('before transport error');

      await setTimeoutSeconds(frame, 0);
      await fillUrl(frame, fixture.baseUrl + '/profile-stream');
      await clickSend(frame);
      await expect(frame.getByTestId('sse-state')).toContainText(/receiving/i);
      await runCommand(tessra.page, 'Tessra: Change Workspace Profile');
      await tessra.page.locator('.quick-input-list .monaco-list-row').filter({ hasText: 'Create New Profile' }).click();
      const input = tessra.page.locator('.quick-input-widget .input');
      await input.fill('sse-isolation'); await input.press('Enter');
      frame = getRequestWebview(tessra.page);
      await expect(frame.getByTestId('request-url')).toHaveValue('');
      await expect.poll(() => fixture.timers.size).toBe(0);
      await expect.poll(() => fixture.sockets.size).toBe(0);
      await fillUrl(frame, fixture.baseUrl + '/ordinary');
      await clickSend(frame);
      await waitForResponseStatus(frame, /200/);
      await expect(frame.getByTestId('response-body')).toHaveText('current ordinary response');
      await expect(frame.getByTestId('sse-response')).toHaveCount(0);
    } finally { await fixture.close(); }
  });
});
