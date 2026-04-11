import * as assert from 'assert';
import { CodegenService } from '../../services/CodegenService';

describe('CodegenService', () => {
  it('dedupes Authorization headers before applying bearer auth', () => {
    const code = CodegenService.generate('fetch', {
      method: 'GET',
      url: 'https://api.example.com/items',
      headers: [
        { key: 'Authorization', value: 'Bearer old-token', enabled: true },
        { key: 'Accept', value: 'application/json', enabled: true },
      ],
      params: [],
      body: '',
      bodyType: 'none',
      formData: [],
      binaryFilePath: '',
      auth: { type: 'bearer', bearer: { token: 'new-token' } },
    });

    assert.strictEqual((code.match(/Authorization/g) || []).length, 1);
    assert.ok(code.includes('"Authorization": "Bearer new-token"'));
    assert.ok(code.includes('"Accept": "application/json"'));
  });

  it('dedupes query API keys before building generated URLs', () => {
    const code = CodegenService.generate('axios', {
      method: 'GET',
      url: 'https://api.example.com/items',
      headers: [],
      params: [
        { key: 'apiKey', value: 'old-value', enabled: true },
        { key: 'page', value: '1', enabled: true },
      ],
      body: '',
      bodyType: 'none',
      formData: [],
      binaryFilePath: '',
      auth: { type: 'apikey', apikey: { key: 'apiKey', value: 'new-value', addTo: 'query' } },
    });

    assert.ok(code.includes('"https://api.example.com/items?'));
    assert.ok(code.includes('page=1'));
    assert.ok(code.includes('apiKey=new-value'));
    assert.ok(!code.includes('apiKey=old-value&apiKey=new-value'));
  });
});
