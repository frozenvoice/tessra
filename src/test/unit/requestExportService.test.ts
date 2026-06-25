import * as assert from 'assert';
import { RequestExportService } from '../../services/RequestExportService';
import { KeyValue } from '../../models/types';

describe('RequestExportService', () => {
  const vars: KeyValue[] = [
    { key: 'host', value: 'api.example.com', enabled: true },
    { key: 'baseUrl', value: 'https://{{host}}', enabled: true },
    { key: 'token', value: 'abc123', enabled: true },
    { key: 'authHeader', value: 'Bearer {{token}}', enabled: true },
    { key: 'user', value: 'demo-user', enabled: true },
    { key: 'queryUser', value: '{{user}}', enabled: true },
    { key: 'password', value: 'secret', enabled: true },
    { key: 'secretPassword', value: '{{password}}', enabled: true },
    { key: 'uploadPath', value: 'C:/tmp/file.bin', enabled: true },
  ];

  it('resolves variables across URL, headers, params, body, auth, and file paths', () => {
    const exported = RequestExportService.resolve({
      method: 'POST',
      url: '{{baseUrl}}/items',
      headers: [{ key: 'Authorization', value: '{{authHeader}}', enabled: true }],
      params: [{ key: 'env', value: '{{queryUser}}', enabled: true }],
      body: '{"token":"{{token}}"}',
      bodyType: 'json',
      formData: [
        { id: '1', key: 'name', value: '{{user}}', type: 'text', enabled: true },
        { id: '2', key: 'file', value: '{{uploadPath}}', type: 'file', enabled: true },
      ],
      binaryFilePath: '{{uploadPath}}',
      auth: {
        type: 'basic',
        basic: {
          username: '{{queryUser}}',
          password: '{{secretPassword}}',
        },
      },
    }, vars);

    assert.strictEqual(exported.url, 'https://api.example.com/items');
    assert.strictEqual(exported.headers?.[0].value, 'Bearer abc123');
    assert.strictEqual(exported.params?.[0].value, 'demo-user');
    assert.strictEqual(exported.body, '{"token":"abc123"}');
    assert.strictEqual(exported.formData?.[0].value, 'demo-user');
    assert.strictEqual(exported.formData?.[1].value, 'C:/tmp/file.bin');
    assert.strictEqual(exported.binaryFilePath, 'C:/tmp/file.bin');
    assert.strictEqual(exported.auth?.type, 'basic');
    assert.strictEqual(exported.auth?.basic?.username, 'demo-user');
    assert.strictEqual(exported.auth?.basic?.password, 'secret');
  });

  it('merges workspace default headers unless the tab skips them or already overrides the key', () => {
    const exported = RequestExportService.resolve({
      method: 'GET',
      url: '{{baseUrl}}/items',
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: 'X-Trace-Id', value: 'trace-1', enabled: true },
      ],
      params: [],
      body: '',
      bodyType: 'none',
      auth: { type: 'none' },
    }, vars, {
      defaultHeaders: [
        { key: 'Accept', value: '*/*', enabled: true },
        { key: 'X-Tenant', value: '{{user}}', enabled: true },
      ],
    });

    assert.deepStrictEqual(exported.headers, [
      { key: 'X-Tenant', value: 'demo-user', enabled: true },
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: 'X-Trace-Id', value: 'trace-1', enabled: true },
    ]);

    const skipped = RequestExportService.resolve({
      method: 'GET',
      url: '{{baseUrl}}/items',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none',
      auth: { type: 'none' },
    }, vars, {
      defaultHeaders: [
        { key: 'X-Tenant', value: '{{user}}', enabled: true },
      ],
      skipDefaultHeaders: true,
    });

    assert.deepStrictEqual(skipped.headers, []);
  });
});
