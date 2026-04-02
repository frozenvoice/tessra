import * as assert from 'assert';
import * as http from 'http';
import { HttpService } from '../../services/HttpService';

// HttpService 테스트 (로컬 HTTP 서버 사용)
describe('HttpService', () => {
  let server: http.Server;
  let baseUrl: string;
  const httpService = new HttpService();

  // 테스트용 로컬 HTTP 서버
  before((done) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost`);
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

          case '/status':
            const code = parseInt(url.searchParams.get('code') || '200', 10);
            res.writeHead(code, { 'Content-Type': 'text/plain' });
            res.end(`Status: ${code}`);
            break;

          case '/slow':
            // 지연 응답 (타임아웃 테스트용)
            setTimeout(() => {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('slow response');
            }, 3000);
            break;

          case '/large':
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('A'.repeat(10000));
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

  describe('GET 요청', () => {
    it('JSON 응답 수신 및 파싱', async () => {
      const res = await httpService.send('GET', `${baseUrl}/json`, [], '');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.statusText, 'OK');
      const parsed = JSON.parse(res.body);
      assert.strictEqual(parsed.message, 'ok');
      assert.strictEqual(parsed.method, 'GET');
      assert.ok(res.time >= 0);
      assert.ok(res.size > 0);
    });

    it('404 응답 처리', async () => {
      const res = await httpService.send('GET', `${baseUrl}/nonexistent`, [], '');
      assert.strictEqual(res.status, 404);
    });

    it('다양한 상태 코드 처리', async () => {
      for (const code of [200, 201, 400, 500]) {
        const res = await httpService.send('GET', `${baseUrl}/status?code=${code}`, [], '');
        assert.strictEqual(res.status, code);
      }
    });

    it('응답 헤더 수신', async () => {
      const res = await httpService.send('GET', `${baseUrl}/json`, [], '');
      assert.ok(res.headers['content-type']?.includes('application/json'));
    });

    it('큰 응답 body 수신', async () => {
      const res = await httpService.send('GET', `${baseUrl}/large`, [], '');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.length, 10000);
      assert.strictEqual(res.size, 10000);
    });
  });

  describe('POST 요청', () => {
    it('JSON body 전송', async () => {
      const body = JSON.stringify({ name: 'test', value: 42 });
      const headers = [
        { key: 'Content-Type', value: 'application/json', enabled: true },
      ];
      const res = await httpService.send('POST', `${baseUrl}/echo`, headers, body);
      assert.strictEqual(res.status, 200);
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'POST');
      assert.strictEqual(echo.body, body);
    });

    it('커스텀 헤더 전송', async () => {
      const headers = [
        { key: 'X-Custom', value: 'hello', enabled: true },
        { key: 'X-Disabled', value: 'skip', enabled: false },
      ];
      const res = await httpService.send('POST', `${baseUrl}/echo`, headers, 'data');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.headers['x-custom'], 'hello');
      // 비활성 헤더는 전송되지 않음
      assert.strictEqual(echo.headers['x-disabled'], undefined);
    });
  });

  describe('기타 메서드', () => {
    it('PUT 요청', async () => {
      const res = await httpService.send('PUT', `${baseUrl}/echo`, [], '{"update":true}');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'PUT');
    });

    it('DELETE 요청', async () => {
      const res = await httpService.send('DELETE', `${baseUrl}/echo`, [], '');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'DELETE');
    });

    it('PATCH 요청', async () => {
      const res = await httpService.send('PATCH', `${baseUrl}/echo`, [], '{"patch":true}');
      const echo = JSON.parse(res.body);
      assert.strictEqual(echo.method, 'PATCH');
    });
  });

  describe('타임아웃', () => {
    it('타임아웃 초과 시 에러 발생', async () => {
      try {
        await httpService.send('GET', `${baseUrl}/slow`, [], '', 1);
        assert.fail('타임아웃 에러가 발생해야 함');
      } catch (err: any) {
        assert.ok(err.message.includes('타임아웃') || err.code === 'ECONNRESET');
      }
    });
  });

  describe('응답 시간 측정', () => {
    it('time 필드가 0 이상의 밀리초', async () => {
      const res = await httpService.send('GET', `${baseUrl}/json`, [], '');
      assert.ok(typeof res.time === 'number');
      assert.ok(res.time >= 0);
    });
  });
});
