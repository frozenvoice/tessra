import * as assert from 'assert';
import * as http from 'http';
import * as net from 'net';
import * as zlib from 'zlib';
import { EventEmitter } from 'events';
import type { RequestOptions as HttpsRequestOptions } from 'https';
import { HttpService, HttpSendOptions } from '../../services/HttpService';

describe('HttpService protocol boundary', () => {
  it('지원하지 않는 프로토콜은 소켓 연결 전에 거절한다', async () => {
    let connections = 0;
    const target = net.createServer((socket) => { connections++; socket.destroy(); });
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    const port = (target.address() as net.AddressInfo).port;
    try {
      for (const url of [`ws://127.0.0.1:${port}/`, `wss://127.0.0.1:${port}/`, `ftp://127.0.0.1:${port}/`, 'file:///fixture']) {
        await assert.rejects(new HttpService().send('GET', url, [], '', { timeoutSec: 1 }).promise, /Unsupported HTTP protocol/);
      }
      assert.strictEqual(connections, 0);
    } finally {
      await new Promise<void>((resolve) => target.close(() => resolve()));
    }
  });

  it('리다이렉트 대상에도 같은 프로토콜 검증을 적용한다', async () => {
    let connections = 0;
    const target = net.createServer((socket) => { connections++; socket.destroy(); });
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    const targetPort = (target.address() as net.AddressInfo).port;
    let location = `wss://127.0.0.1:${targetPort}/secret`;
    const redirect = http.createServer((_req, res) => { res.writeHead(302, { Location: location }); res.end(); });
    await new Promise<void>((resolve) => redirect.listen(0, '127.0.0.1', resolve));
    const redirectUrl = `http://127.0.0.1:${(redirect.address() as net.AddressInfo).port}/`;
    try {
      await assert.rejects(new HttpService().send('GET', redirectUrl, [], '', { followRedirects: true }).promise, /Unsupported HTTP protocol: wss:/);
      assert.strictEqual(connections, 0);
      location = 'http://[';
      await assert.rejects(new HttpService().send('GET', redirectUrl, [], '', { followRedirects: true }).promise, /Invalid redirect URL/);
    } finally {
      await new Promise<void>((resolve) => redirect.close(() => resolve()));
      await new Promise<void>((resolve) => target.close(() => resolve()));
    }
  });
});

// HttpService 테스트 (로컬 HTTP 서버 사용)
describe('HttpService', () => {
  let server: http.Server;
  let baseUrl: string;
  let externalRedirectUrl = '';
  const httpService = new HttpService();
  const send = (
    method: Parameters<HttpService['send']>[0],
    url: string,
    headers: Parameters<HttpService['send']>[2],
    body: string,
    options: HttpSendOptions = {}
  ) => httpService.send(method, url, headers, body, options).promise;

  before((done) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        switch (url.pathname) {
          case '/json':
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'ok', method: req.method }));
            break;

          case '/echo':
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              method: req.method,
              headers: req.headers,
              body,
              url: req.url,
            }));
            break;

          case '/status': {
            const code = parseInt(url.searchParams.get('code') || '200', 10);
            res.writeHead(code, { 'Content-Type': 'text/plain' });
            res.end(`Status: ${code}`);
            break;
          }

          case '/redirect':
            res.writeHead(302, { Location: '/json' });
            res.end('redirect');
            break;

          case '/redirect-external':
            res.writeHead(302, { Location: externalRedirectUrl || '/json' });
            res.end('external redirect');
            break;

          case '/redirect-303':
            res.writeHead(303, { Location: '/echo' });
            res.end('see other');
            break;

          case '/slow':
            setTimeout(() => {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('slow response');
            }, 3000);
            break;

          case '/large':
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('A'.repeat(10000));
            break;

          case '/huge':
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('A'.repeat(11 * 1024 * 1024));
            break;

          case '/gzip': {
            const payload = Buffer.from(JSON.stringify({ compressed: true }), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
            res.end(zlib.gzipSync(payload));
            break;
          }

          case '/deflate': {
            const payload = Buffer.from('deflated response', 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'deflate' });
            res.end(zlib.deflateSync(payload));
            break;
          }

          case '/br': {
            const payload = Buffer.from(JSON.stringify({ brotli: true }), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'br' });
            res.end(zlib.brotliCompressSync(payload));
            break;
          }

          case '/bad-gzip':
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
            res.end('not really gzip');
            break;

          case '/unsupported-encoding':
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'compress' });
            res.end('legacy');
            break;

          case '/binary':
            res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
            res.end(Buffer.from([0, 255, 16, 32, 65, 66, 67]));
            break;

          default:
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  after((done) => {
    server.close(done);
  });

  describe('GET requests', () => {
    it('receives and parses JSON responses', async () => {
      const res = await send('GET', `${baseUrl}/json`, [], '');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.statusText, 'OK');
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.message, 'ok');
      assert.strictEqual(parsed.method, 'GET');
      assert.ok(res.time >= 0);
      assert.ok(res.size > 0);
    });

    it('handles 404 responses', async () => {
      const res = await send('GET', `${baseUrl}/nonexistent`, [], '');
      assert.strictEqual(res.status, 404);
    });

    it('handles several status codes', async () => {
      for (const code of [200, 201, 400, 500]) {
        const res = await send('GET', `${baseUrl}/status?code=${code}`, [], '');
        assert.strictEqual(res.status, code);
      }
    });

    it('reads response headers', async () => {
      const res = await send('GET', `${baseUrl}/json`, [], '');
      assert.ok(res.headers['content-type']?.includes('application/json'));
    });

    it('receives a large response body', async () => {
      const res = await send('GET', `${baseUrl}/large`, [], '');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.length, 10000);
      assert.strictEqual(res.size, 10000);
    });

    it('preserves binary responses as base64', async () => {
      const res = await send('GET', `${baseUrl}/binary`, [], '');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.bodyBase64, Buffer.from([0, 255, 16, 32, 65, 66, 67]).toString('base64'));
    });

    it('does not follow redirects unless enabled', async () => {
      const res = await send('GET', `${baseUrl}/redirect`, [], '');
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.location, '/json');
    });

    it('follows redirects when enabled', async () => {
      const res = await send('GET', `${baseUrl}/redirect`, [], '', { followRedirects: true });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(JSON.parse(res.body).message, 'ok');
    });

    it('strips sensitive headers when redirects cross origins', async () => {
      let capturedHeaders: http.IncomingHttpHeaders = {};
      const targetServer = http.createServer((req, res) => {
        capturedHeaders = req.headers;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });

      await new Promise<void>((resolve) => {
        targetServer.listen(0, '127.0.0.1', () => resolve());
      });

      try {
        const addr = targetServer.address() as { port: number };
        externalRedirectUrl = `http://127.0.0.1:${addr.port}/target`;
        const res = await send('GET', `${baseUrl}/redirect-external`, [
          { key: 'Authorization', value: 'Bearer secret', enabled: true },
          { key: 'Cookie', value: 'session=secret', enabled: true },
          { key: 'X-API-Key', value: 'api-secret', enabled: true },
          { key: 'X-Trace-Id', value: 'trace-1', enabled: true },
        ], '', { followRedirects: true });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(capturedHeaders.authorization, undefined);
        assert.strictEqual(capturedHeaders.cookie, undefined);
        assert.strictEqual(capturedHeaders['x-api-key'], undefined);
        assert.strictEqual(capturedHeaders['x-trace-id'], 'trace-1');
      } finally {
        externalRedirectUrl = '';
        await new Promise<void>((resolve, reject) => {
          targetServer.close((err) => err ? reject(err) : resolve());
        });
      }
    });

    it('stops after headers when requested', async () => {
      const res = await send('GET', `${baseUrl}/json`, [], '', { stopAfterHeaders: true });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body, '');
      assert.strictEqual(res.size, 0);
      assert.ok(res.headers['content-type']?.includes('application/json'));
    });

    it('rejects responses that exceed the size limit', async () => {
      await assert.rejects(
        () => send('GET', `${baseUrl}/large`, [], '', { maxResponseSizeBytes: 1024 }),
        /Response exceeded max size/
      );
    });

    it('uses a safe default response size limit', async () => {
      await assert.rejects(
        () => send('GET', `${baseUrl}/huge`, [], ''),
        /Response exceeded max size/
      );
    });

    it('automatically decodes gzip JSON responses', async () => {
      const res = await send('GET', `${baseUrl}/gzip`, [], '');
      assert.deepStrictEqual(JSON.parse(res.body), { compressed: true });
      assert.strictEqual(res.size, Buffer.byteLength(res.body, 'utf-8'));
    });

    it('automatically decodes deflate text responses', async () => {
      const res = await send('GET', `${baseUrl}/deflate`, [], '');
      assert.strictEqual(res.body, 'deflated response');
    });

    it('automatically decodes Brotli responses', async () => {
      const res = await send('GET', `${baseUrl}/br`, [], '');
      assert.deepStrictEqual(JSON.parse(res.body), { brotli: true });
    });

    it('rejects invalid compressed responses with a clear error', async () => {
      await assert.rejects(
        () => send('GET', `${baseUrl}/bad-gzip`, [], ''),
        /Failed to decompress gzip response/
      );
    });

    it('rejects unsupported content encodings clearly', async () => {
      await assert.rejects(
        () => send('GET', `${baseUrl}/unsupported-encoding`, [], ''),
        /Unsupported content encoding: compress/
      );
    });
  });

  describe('POST requests', () => {
    it('sends a JSON body', async () => {
      const body = JSON.stringify({ name: 'test', value: 42 });
      const headers = [
        { key: 'Content-Type', value: 'application/json', enabled: true },
      ];
      const res = await send('POST', `${baseUrl}/echo`, headers, body);
      assert.strictEqual(res.status, 200);
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'POST');
      assert.strictEqual(echo.body, body);
    });

    it('sends custom headers only when enabled', async () => {
      const headers = [
        { key: 'X-Custom', value: 'hello', enabled: true },
        { key: 'X-Disabled', value: 'skip', enabled: false },
      ];
      const res = await send('POST', `${baseUrl}/echo`, headers, 'data');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.headers['x-custom'], 'hello');
      assert.strictEqual(echo.headers['x-disabled'], undefined);
    });

    it('switches POST redirects to GET for 303 responses', async () => {
      const res = await send('POST', `${baseUrl}/redirect-303`, [], 'payload', { followRedirects: true });
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'GET');
      assert.strictEqual(echo.body, '');
    });
  });

  describe('other methods', () => {
    it('supports PUT requests', async () => {
      const res = await send('PUT', `${baseUrl}/echo`, [], '{"update":true}');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'PUT');
    });

    it('supports DELETE requests', async () => {
      const res = await send('DELETE', `${baseUrl}/echo`, [], '');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'DELETE');
    });

    it('supports PATCH requests', async () => {
      const res = await send('PATCH', `${baseUrl}/echo`, [], '{"patch":true}');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'PATCH');
    });
  });

  describe('timeouts', () => {
    it('throws when the timeout is exceeded', async () => {
      await assert.rejects(
        () => send('GET', `${baseUrl}/slow`, [], '', { timeoutSec: 1 }),
        /timed out|ECONNRESET/
      );
    });

    it('rejects when the response stream aborts before completion', async () => {
      const rawServer = net.createServer((socket) => {
        socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 20\r\n\r\npartial');
        socket.destroy();
      });

      await new Promise<void>((resolve) => {
        rawServer.listen(0, '127.0.0.1', () => resolve());
      });

      try {
        const addr = rawServer.address() as { port: number };
        await assert.rejects(
          () => send('GET', `http://127.0.0.1:${addr.port}/aborted`, [], ''),
          /aborted|socket hang up|ECONNRESET|terminated/
        );
      } finally {
        await new Promise<void>((resolve, reject) => {
          rawServer.close((err) => err ? reject(err) : resolve());
        });
      }
    });
  });

  describe('response timing', () => {
    it('measures elapsed time', async () => {
      const res = await send('GET', `${baseUrl}/json`, [], '');
      assert.ok(typeof res.time === 'number');
      assert.ok(res.time >= 0);
    });
  });

  describe('HTTPS certificate validation', () => {
    const nativeHttps = require('https') as typeof import('https');

    class MockHttpsRequest extends EventEmitter {
      constructor(private readonly callback: (res: http.IncomingMessage) => void) {
        super();
      }

      setTimeout(): this {
        return this;
      }

      write(): this {
        return this;
      }

      end(): this {
        const res = new EventEmitter() as http.IncomingMessage;
        (res as unknown as { headers: Record<string, string> }).headers = { 'content-type': 'text/plain' };
        (res as unknown as { statusCode: number }).statusCode = 200;
        (res as unknown as { statusMessage: string }).statusMessage = 'OK';
        this.callback(res);
        res.emit('data', Buffer.from('ok'));
        // 실제 IncomingMessage는 정상 end 전에 complete가 true가 된다.
        (res as unknown as { complete: boolean }).complete = true;
        res.emit('end');
        return this;
      }

      destroy(err?: Error): this {
        if (err) {
          this.emit('error', err);
        }
        return this;
      }
    }

    it('keeps certificate validation on by default', async () => {
      const originalRequest = nativeHttps.request;
      let capturedOptions: HttpsRequestOptions | undefined;

      try {
        nativeHttps.request =
          ((options: HttpsRequestOptions, callback: (res: http.IncomingMessage) => void) => {
            capturedOptions = options;
            return new MockHttpsRequest(callback) as unknown as http.ClientRequest;
          }) as typeof nativeHttps.request;

        const res = await httpService.send('GET', 'https://example.com/test', [], '').promise;
        assert.strictEqual(res.status, 200);
        assert.strictEqual(capturedOptions?.rejectUnauthorized, undefined);
      } finally {
        nativeHttps.request = originalRequest;
      }
    });

    it('disables certificate validation only when explicitly requested', async () => {
      const originalRequest = nativeHttps.request;
      let capturedOptions: HttpsRequestOptions | undefined;

      try {
        nativeHttps.request =
          ((options: HttpsRequestOptions, callback: (res: http.IncomingMessage) => void) => {
            capturedOptions = options;
            return new MockHttpsRequest(callback) as unknown as http.ClientRequest;
          }) as typeof nativeHttps.request;

        const res = await httpService.send('GET', 'https://example.com/test', [], '', { allowInsecureHttps: true }).promise;
        assert.strictEqual(res.status, 200);
        assert.strictEqual(capturedOptions?.rejectUnauthorized, false);
      } finally {
        nativeHttps.request = originalRequest;
      }
    });
  });
});
