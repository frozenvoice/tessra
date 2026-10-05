import * as http from 'http';
import type { AddressInfo } from 'net';
import * as zlib from 'zlib';
import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, waitForResponseStatus } from '../helpers/webview';

test.describe('E2E #26 응답 charset', () => {
  test('legacy charset·BOM을 읽고 손상/미지원 응답 warning을 탭 전환과 pin 이후에도 표시한다', async ({ tessra }) => {
    const eucKr = Buffer.from('b0a1b3aa', 'hex');
    const shiftJis = Buffer.from('82a082a2', 'hex');
    const invalid = Buffer.from('eab0', 'hex');
    const charset = '<img src=x onerror=alert(1)>';
    const paths: string[] = [];
    const server = http.createServer((request, response) => {
      const pathname = request.url || '/';
      paths.push(pathname);
      switch (pathname) {
        case '/euc-kr': response.setHeader('Content-Type', 'text/plain; CHARSET = "EUC-KR"'); response.end(eucKr); break;
        case '/shift-jis': response.setHeader('Content-Type', 'text/plain; charset=Shift_JIS'); response.end(shiftJis); break;
        case '/gzip':
          response.writeHead(200, { 'Content-Type': 'text/plain; charset=euc-kr', 'Content-Encoding': 'gzip' });
          response.end(zlib.gzipSync(eucKr)); break;
        case '/utf16': response.setHeader('Content-Type', 'text/plain'); response.end(Buffer.from('fffe4100', 'hex')); break;
        case '/invalid': response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.end(invalid); break;
        case '/unsupported': response.setHeader('Content-Type', `text/plain; charset="${charset}"`); response.end(eucKr); break;
        default: response.writeHead(404); response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const frame = await openNewRequestPanel(tessra.page);
      const warning = frame.getByTestId('response-decoding-warning');
      const body = frame.getByTestId('response-body');
      for (const [pathname, text] of [['/euc-kr', '가나'], ['/shift-jis', 'あい'], ['/gzip', '가나'], ['/utf16', 'A']]) {
        await fillUrl(frame, baseUrl + pathname);
        await clickSend(frame);
        await expect.poll(() => paths.includes(pathname)).toBe(true);
        await waitForResponseStatus(frame, /^200/);
        await expect(body).toHaveText(text);
        await expect(warning).toHaveCount(0);
      }

      await fillUrl(frame, baseUrl + '/invalid');
      await clickSend(frame);
      await waitForResponseStatus(frame, /^200/);
      await expect(body).toHaveText('\ufffd');
      await expect(warning).toContainText('invalid utf-8 bytes');
      await expect(warning).toContainText('Original bytes are preserved when saving');

      await fillUrl(frame, baseUrl + '/unsupported');
      await clickSend(frame);
      await waitForResponseStatus(frame, /^200/);
      await expect(warning).toContainText(`Unsupported response charset "${charset}"`);
      await expect(warning.locator('img')).toHaveCount(0);
      await expect(body).toHaveText(eucKr.toString('utf8'));
      await frame.getByTestId('response-pin').click();
      await expect(frame.getByTestId('response-pin')).toHaveClass(/pinned/);
      await frame.locator('.js-res-tabs [data-tab="resHeaders"]').click();
      await expect(warning).toBeVisible();
      await frame.locator('.js-res-tabs [data-tab="resBody"]').click();

      const originalTabId = await frame.locator('.req-tab.active .close-tab').getAttribute('data-id');
      expect(originalTabId).toBeTruthy();
      await frame.locator('#addTabBtn').click();
      await expect(warning).toHaveCount(0);
      await frame.locator('.req-tab').filter({ has: frame.locator(`.close-tab[data-id="${originalTabId}"]`) }).click();
      await expect(warning).toContainText(`Unsupported response charset "${charset}"`);
      await expect(frame.getByTestId('response-pin')).toHaveClass(/pinned/);
      await expect(body).toHaveText(eucKr.toString('utf8'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
