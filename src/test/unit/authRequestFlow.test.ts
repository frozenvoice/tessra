import * as assert from 'assert';
import * as http from 'http';
import { AuthService } from '../../services/AuthService';
import { HttpService } from '../../services/HttpService';
import { AuthConfig, KeyValue } from '../../models/types';

describe('인증 요청 플로우', () => {
  let server: http.Server;
  let baseUrl: string;
  const httpService = new HttpService();

  before((done) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: Object.fromEntries(url.searchParams.entries()),
      }));
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

  async function sendWithAuth(auth: AuthConfig, vars: KeyValue[]) {
    const headers: KeyValue[] = [];
    const params: KeyValue[] = [];

    AuthService.applyAuth(auth, headers, params, vars);

    const url = new URL(`${baseUrl}/echo`);
    for (const param of params) {
      if (param.enabled !== false) {
        url.searchParams.append(param.key, param.value);
      }
    }

    const response = await httpService.send('GET', url.toString(), headers, '', {}).promise;
    return JSON.parse(response.body) as {
      method: string;
      url: string;
      headers: Record<string, string | undefined>;
      query: Record<string, string>;
    };
  }

  it('Basic 인증이 실제 요청 헤더로 전송된다', async () => {
    const vars: KeyValue[] = [
      { key: 'user', value: 'demo-user', enabled: true },
      { key: 'password', value: 'secret-pass', enabled: true },
    ];

    const echo = await sendWithAuth({
      type: 'basic',
      basic: { username: '{{user}}', password: '{{password}}' },
    }, vars);

    assert.strictEqual(
      echo.headers.authorization,
      `Basic ${Buffer.from('demo-user:secret-pass').toString('base64')}`
    );
  });

  it('Bearer 인증이 실제 요청 헤더로 전송된다', async () => {
    const vars: KeyValue[] = [
      { key: 'token', value: 'resolved-token', enabled: true },
    ];

    const echo = await sendWithAuth({
      type: 'bearer',
      bearer: { token: '{{token}}' },
    }, vars);

    assert.strictEqual(echo.headers.authorization, 'Bearer resolved-token');
  });

  it('Header API Key 인증이 실제 요청 헤더로 전송된다', async () => {
    const vars: KeyValue[] = [
      { key: 'apiKey', value: 'X-API-Key', enabled: true },
      { key: 'apiValue', value: 'resolved-value', enabled: true },
    ];

    const echo = await sendWithAuth({
      type: 'apikey',
      apikey: { key: '{{apiKey}}', value: '{{apiValue}}', addTo: 'header' },
    }, vars);

    assert.strictEqual(echo.headers['x-api-key'], 'resolved-value');
  });

  it('Query API Key 인증이 실제 요청 쿼리스트링으로 전송된다', async () => {
    const vars: KeyValue[] = [
      { key: 'apiKey', value: 'api_key', enabled: true },
      { key: 'apiValue', value: 'resolved-value', enabled: true },
    ];

    const echo = await sendWithAuth({
      type: 'apikey',
      apikey: { key: '{{apiKey}}', value: '{{apiValue}}', addTo: 'query' },
    }, vars);

    assert.strictEqual(echo.query.api_key, 'resolved-value');
  });
});
