import * as assert from 'assert';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as zlib from 'zlib';
import { HttpService } from '../../services/HttpService';

describe('HttpService 응답 charset 통합', () => {
  let server: http.Server;
  let baseUrl: string;
  const eucKr = Buffer.from('b0a1b3aa', 'hex');
  const shiftJis = Buffer.from('82a082a2', 'hex');
  const invalid = Buffer.from('eab0', 'hex');
  const binary = Buffer.from('0082fffeb0', 'hex');
  before(async () => {
    server = http.createServer((request, response) => {
      switch (request.url) {
        case '/euc-kr': response.setHeader('Content-Type', 'text/plain; CHARSET = "EUC-KR"'); response.end(eucKr); break;
        case '/shift-jis': response.setHeader('Content-Type', 'text/plain; charset=Shift_JIS'); response.end(shiftJis); break;
        case '/gzip':
          response.writeHead(200, { 'Content-Type': 'text/plain; charset=euc-kr', 'Content-Encoding': 'gzip' });
          response.end(zlib.gzipSync(eucKr)); break;
        case '/chunked':
        case '/chunked-jp': {
          const bytes = request.url === '/chunked' ? eucKr : shiftJis;
          response.setHeader('Content-Type', `text/plain; charset=${request.url === '/chunked' ? 'euc-kr' : 'shift_jis'}`);
          let index = 0;
          const sendByte = () => {
            if (response.destroyed) return;
            if (index === bytes.length) { response.end(); return; }
            response.write(bytes.subarray(index, ++index));
            setImmediate(sendByte);
          };
          sendByte(); break;
        }
        case '/invalid': response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.end(invalid); break;
        case '/unsupported': response.setHeader('Content-Type', 'text/plain; charset=unknown-fixture'); response.end(eucKr); break;
        case '/xml':
          response.setHeader('Content-Type', 'application/xml; charset=utf-8');
          response.end(Buffer.from('fffe3c0072002f003e00', 'hex')); break;
        case '/json': response.setHeader('Content-Type', 'application/json'); response.end('{"text":"가나"}'); break;
        case '/binary': response.setHeader('Content-Type', 'application/octet-stream; charset=unknown-fixture'); response.end(binary); break;
        default: response.writeHead(404); response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  const get = (pathname: string) => new HttpService().send('GET', baseUrl + pathname, [], '').promise;

  it('legacy charset과 gzip·chunked 응답을 전체 바이트 조립/압축 해제 이후 읽는다', async () => {
    for (const pathname of ['/euc-kr', '/gzip', '/chunked']) {
      const response = await get(pathname);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body, '가나');
      assert.strictEqual(response.size, eucKr.length);
      assert.strictEqual(response.bodyBase64, eucKr.toString('base64'));
      assert.strictEqual(response.decodingWarning, undefined);
    }
    for (const pathname of ['/shift-jis', '/chunked-jp']) {
      const response = await get(pathname);
      assert.strictEqual(response.body, 'あい');
      assert.strictEqual(response.size, shiftJis.length);
      assert.strictEqual(response.bodyBase64, shiftJis.toString('base64'));
    }
  });

  it('invalid/unsupported charset은 응답을 거절하지 않고 warning과 원문을 전달한다', async () => {
    for (const [pathname, bytes, reason, charset] of [
      ['/invalid', invalid, 'invalid-bytes', 'utf-8'], ['/unsupported', eucKr, 'unsupported-charset', 'unknown-fixture'],
    ] as const) {
      const response = await get(pathname);
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.includes('\ufffd'));
      assert.strictEqual(response.bodyBase64, bytes.toString('base64'));
      assert.deepStrictEqual(response.decodingWarning, { reason, charset });
    }
  });

  it('XML BOM 우선순위와 정상 UTF8 JSON 계약을 유지한다', async () => {
    const xml = await get('/xml');
    assert.strictEqual(xml.body, '<r/>');
    assert.strictEqual(xml.decodingWarning, undefined);
    const json = await get('/json');
    assert.deepStrictEqual(JSON.parse(json.body), { text: '가나' });
    assert.strictEqual(json.bodyBase64, undefined);
    assert.strictEqual(json.decodingWarning, undefined);
  });

  it('binary 응답은 charset 해석 없이 기존 body/base64를 보존한다', async () => {
    const response = await get('/binary');
    assert.strictEqual(response.body, binary.toString('utf8'));
    assert.strictEqual(response.bodyBase64, binary.toString('base64'));
    assert.strictEqual(response.decodingWarning, undefined);
  });
});
