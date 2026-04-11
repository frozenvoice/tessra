import * as assert from 'assert';
import { AuthService } from '../../services/AuthService';
import { AuthConfig, KeyValue } from '../../models/types';

describe('AuthService', () => {
  const vars: KeyValue[] = [
    { key: 'token', value: 'resolved-token', enabled: true },
    { key: 'apiKey', value: 'X-API-Key', enabled: true },
    { key: 'apiValue', value: 'resolved-value', enabled: true },
    { key: 'user', value: 'demo-user', enabled: true },
    { key: 'password', value: 'secret-pass', enabled: true },
  ];

  it('none 인증은 기존 헤더와 파라미터를 그대로 둔다', () => {
    const headers: KeyValue[] = [
      { key: 'Accept', value: 'application/json', enabled: true },
    ];
    const params: KeyValue[] = [
      { key: 'page', value: '1', enabled: true },
    ];

    AuthService.applyAuth({ type: 'none' }, headers, params, vars);

    assert.deepStrictEqual(headers, [
      { key: 'Accept', value: 'application/json', enabled: true },
    ]);
    assert.deepStrictEqual(params, [
      { key: 'page', value: '1', enabled: true },
    ]);
  });

  it('basic 인증은 변수 치환 후 Base64 Authorization 헤더를 만든다', () => {
    const headers: KeyValue[] = [];
    const params: KeyValue[] = [];
    const auth: AuthConfig = {
      type: 'basic',
      basic: { username: '{{user}}', password: '{{password}}' },
    };

    AuthService.applyAuth(auth, headers, params, vars);

    assert.deepStrictEqual(headers, [
      {
        key: 'Authorization',
        value: `Basic ${Buffer.from('demo-user:secret-pass').toString('base64')}`,
        enabled: true,
      },
    ]);
  });

  it('basic/bearer 인증은 기존 Authorization 헤더를 교체한다', () => {
    const headers: KeyValue[] = [
      { key: 'Authorization', value: 'Bearer old-token', enabled: true },
      { key: 'authorization', value: 'Basic old-basic', enabled: false },
      { key: 'Accept', value: 'application/json', enabled: true },
    ];
    const params: KeyValue[] = [];
    const auth: AuthConfig = { type: 'bearer', bearer: { token: '{{token}}' } };

    AuthService.applyAuth(auth, headers, params, vars);

    assert.strictEqual(headers.length, 2);
    assert.strictEqual(headers[0].key, 'Accept');
    assert.strictEqual(headers[1].key, 'Authorization');
    assert.strictEqual(headers[1].value, 'Bearer resolved-token');
  });

  it('header 방식 API Key는 동일 헤더를 교체한다', () => {
    const headers: KeyValue[] = [
      { key: 'X-API-Key', value: 'old-value', enabled: true },
      { key: 'X-Trace-Id', value: 'trace', enabled: true },
    ];
    const params: KeyValue[] = [];
    const auth: AuthConfig = {
      type: 'apikey',
      apikey: { key: '{{apiKey}}', value: '{{apiValue}}', addTo: 'header' },
    };

    AuthService.applyAuth(auth, headers, params, vars);

    assert.deepStrictEqual(headers, [
      { key: 'X-Trace-Id', value: 'trace', enabled: true },
      { key: 'X-API-Key', value: 'resolved-value', enabled: true },
    ]);
  });

  it('query 방식 API Key는 동일 파라미터를 교체한다', () => {
    const headers: KeyValue[] = [];
    const params: KeyValue[] = [
      { key: 'X-API-Key', value: 'old-value', enabled: true },
      { key: 'page', value: '1', enabled: true },
      { key: 'X-API-Key', value: 'disabled-old', enabled: false },
    ];
    const auth: AuthConfig = {
      type: 'apikey',
      apikey: { key: '{{apiKey}}', value: '{{apiValue}}', addTo: 'query' },
    };

    AuthService.applyAuth(auth, headers, params, vars);

    assert.deepStrictEqual(params, [
      { key: 'page', value: '1', enabled: true },
      { key: 'X-API-Key', value: 'resolved-value', enabled: true },
    ]);
  });
});
