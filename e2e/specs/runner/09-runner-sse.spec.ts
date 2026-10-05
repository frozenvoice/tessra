import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import { test, expect } from '../../fixtures';
import { openNewRequestPanel, fillUrl, openSettingsTab, runCollectionFromSidebar } from '../../helpers/webview';

test.describe('E2E #9 Collection Runner SSE', () => {
  test('keeps bounded live POST events and aborted partial data after Stop without replay or history spam', async ({ tessra }) => {
    const sockets = new Set<net.Socket>();
    const timers = new Set<ReturnType<typeof setInterval>>();
    const hits: Array<{ method: string; route: string }> = [];
    const server = http.createServer((request, response) => {
      hits.push({ method: request.method || '', route: request.url || '' });
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.flushHeaders();
      // A burst exceeds display retention, then the stream stays open until Runner Stop.
      for (let index = 0; index < 650; index++) {
        response.write('id: fixture-' + index + '\nevent: runner-fixture\ndata: stream-fixture-' + index + ' 한글 😀 <img src=x onerror=alert(1)>\n\n');
      }
      const timer = setInterval(() => response.write('data: ongoing runner fixture\n\n'), 80);
      timers.add(timer);
      response.on('close', () => { clearInterval(timer); timers.delete(timer); });
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const streamUrl = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/runner-stream`;
    const storageRoot = path.join(tessra.userDataDir, 'User/globalStorage/frozenvoice.tessra');
    const historyCount = () => JSON.parse(fs.readFileSync(path.join(storageRoot, 'history.json'), 'utf8')).length;
    try {
      // Save through the real panel and native collection/name prompts; no storage injection.
      let frame = await openNewRequestPanel(tessra.page);
      await fillUrl(frame, streamUrl);
      await frame.getByTestId('request-method').selectOption('POST');
      await openSettingsTab(frame);
      await frame.locator('.js-timeout').fill('0'); // Long streams require explicit opt-in.
      await frame.locator('.js-retry-count').fill('2');
      await frame.locator('.js-retry-delay').fill('10');
      await expect(frame.locator('.js-save-history')).toBeChecked();
      await frame.getByTestId('request-overflow').click();
      await frame.locator('.js-save').click();
      await tessra.page.locator('.quick-input-list .monaco-list-row').filter({ hasText: 'E2E Runner' }).click();
      const nameInput = tessra.page.locator('.quick-input-widget .input');
      await expect(nameInput).toHaveValue('POST /runner-stream');
      await nameInput.fill('POST SSE Runner Fixture');
      await nameInput.press('Enter');
      await expect(nameInput).not.toBeVisible();
      await expect.poll(() => {
        const collections = JSON.parse(fs.readFileSync(path.join(storageRoot, 'collections.json'), 'utf8'));
        return collections.find((collection: { name: string }) => collection.name === 'E2E Runner').items.some((item: { name: string }) => item.name === 'POST SSE Runner Fixture');
      }).toBe(true);

      frame = await runCollectionFromSidebar(tessra.page, 'E2E Runner', { skipNewRequest: true });
      await frame.getByTestId('runner-clear-selection').click();
      await frame.locator('.runner-request-row').filter({ hasText: 'POST SSE Runner Fixture' }).getByTestId('runner-request-check').check();
      await expect(frame.getByTestId('runner-selected-count')).toContainText(/1\s*\/\s*6/);
      const initialHistoryCount = historyCount();
      await frame.getByTestId('runner-start').click();
      const stream = frame.getByTestId('runner-sse-response');
      await expect(stream.locator('.runner-sse-label')).toContainText(/receiving/i);
      await expect(stream.locator('.sse-event')).toHaveCount(500);
      await expect(stream).toContainText('stream-fixture-649 한글 😀');
      await expect(stream.locator('img,script')).toHaveCount(0);
      await expect(frame.getByTestId('runner-stop')).toBeEnabled();
      expect(historyCount()).toBe(initialHistoryCount);
      expect(hits).toEqual([{ method: 'POST', route: '/runner-stream' }]);
      const artifactDir = path.resolve('e2e/.artifacts/sse-streaming'); fs.mkdirSync(artifactDir, { recursive: true });
      await tessra.page.screenshot({ path: path.join(artifactDir, 'runner-receiving.png') });

      await frame.getByTestId('runner-stop').click();
      await expect(frame.getByTestId('runner-close')).toBeVisible();
      await expect(stream.locator('.runner-sse-label')).toContainText(/stopped|aborted|canceled/i);
      await expect(stream.locator('.runner-sse-label')).not.toContainText(/completed/i);
      await expect(stream).toContainText('stream-fixture-649 한글 😀');
      expect(await stream.locator('.sse-event').count()).toBeLessThanOrEqual(500);
      await expect(frame.getByTestId('runner-passed')).toHaveText('0');
      await expect(frame.locator('.runner-row.pass')).toHaveCount(0);
      await expect.poll(() => timers.size).toBe(0);
      await expect.poll(() => sockets.size).toBe(0);
      expect(historyCount()).toBe(initialHistoryCount);
      expect(hits).toEqual([{ method: 'POST', route: '/runner-stream' }]);
      await tessra.page.screenshot({ path: path.join(artifactDir, 'runner-stopped-partial.png') });
      await frame.getByTestId('runner-close').click();
      await expect(stream).toHaveCount(0);
    } finally {
      for (const timer of timers) clearInterval(timer);
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
