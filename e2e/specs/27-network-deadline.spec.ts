import * as http from 'http';
import * as net from 'net';
import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, openSettingsTab, waitForResponseStatus } from '../helpers/webview';

test.describe('E2E #27 전체 네트워크 실행 예산', () => {
  test('계속 오는 본문과 재시도 대기를 제한하고 Stop 뒤 늦은 응답을 폐기한다', async ({ tessra }) => {
    const sockets = new Set<net.Socket>();
    const timers = new Set<ReturnType<typeof setInterval>>();
    const hits: string[] = [];
    let held: http.ServerResponse | undefined;
    const server = http.createServer((request, response) => {
      const route = request.url || '/';
      hits.push(route);
      if (route === '/drip') {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.flushHeaders();
        const timer = setInterval(() => response.write('still arriving\n'), 30);
        timers.add(timer);
        response.on('close', () => { clearInterval(timer); timers.delete(timer); });
      } else if (route === '/retry') {
        response.writeHead(503, { 'Content-Type': 'text/plain' });
        response.end('retryable');
      } else if (route === '/held') {
        held = response;
      } else {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('current response');
      }
    });
    server.on('connection', (socket) => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
    try {
      const frame = await openNewRequestPanel(tessra.page);
      await fillUrl(frame, `${baseUrl}/drip`);
      await openSettingsTab(frame);
      await frame.locator('.js-timeout').fill('1');
      await frame.locator('.js-retry-count').fill('2');
      await frame.locator('.js-retry-delay').fill('5000');
      await clickSend(frame);
      await expect(frame.locator('.error-msg')).toContainText('Request timed out (1s)');
      await expect.poll(() => timers.size).toBe(0);
      await expect.poll(() => sockets.size).toBe(0);
      expect(hits.filter((route) => route === '/drip')).toHaveLength(1);

      await fillUrl(frame, `${baseUrl}/retry`);
      await clickSend(frame);
      await expect.poll(() => hits.filter((route) => route === '/retry').length).toBe(1);
      await expect(frame.locator('.error-msg')).toContainText('Request timed out (1s)');
      expect(hits.filter((route) => route === '/retry')).toHaveLength(1);

      await openSettingsTab(frame);
      await frame.locator('.js-timeout').fill('0');
      await fillUrl(frame, `${baseUrl}/held`);
      await clickSend(frame);
      await expect.poll(() => !!held).toBe(true);
      await frame.locator('[data-testid="stop-request"]').click();
      await expect(frame.locator('[data-testid="send-request"]')).toBeVisible();
      await expect.poll(() => !!held?.destroyed).toBe(true);
      held!.end('late canceled response');

      await fillUrl(frame, `${baseUrl}/ok`);
      await clickSend(frame);
      await waitForResponseStatus(frame, /200/);
      await expect(frame.locator('[data-testid="response-body"]')).toContainText('current response');
      expect(hits.filter((route) => route === '/drip')).toHaveLength(1);
      expect(hits.filter((route) => route === '/retry')).toHaveLength(1);
    } finally {
      for (const timer of timers) clearInterval(timer);
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
