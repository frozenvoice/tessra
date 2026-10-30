import * as assert from 'assert';
import { CurlService } from '../../services/CurlService';

describe('CurlService export dedupe', () => {
  it('replaces an existing Authorization header when bearer auth is exported', () => {
    const curl = CurlService.generate({
      method: 'GET',
      url: 'https://api.example.com',
      headers: [
        { key: 'Authorization', value: 'Bearer old-token', enabled: true },
        { key: 'Accept', value: 'application/json', enabled: true },
      ],
      auth: { type: 'bearer', bearer: { token: 'new-token' } },
    });

    assert.strictEqual((curl.match(/Authorization:/g) || []).length, 1);
    assert.ok(curl.includes('Authorization: Bearer new-token'));
    assert.ok(curl.includes('Accept: application/json'));
  });

  it('replaces an existing query API key when auth targets the query string', () => {
    const curl = CurlService.generate({
      method: 'GET',
      url: 'https://api.example.com',
      params: [
        { key: 'apiKey', value: 'old-value', enabled: true },
        { key: 'page', value: '1', enabled: true },
      ],
      auth: { type: 'apikey', apikey: { key: 'apiKey', value: 'new-value', addTo: 'query' } },
    });

    assert.ok(curl.includes('apiKey=new-value'));
    assert.ok(curl.includes('page=1'));
    assert.ok(!curl.includes('apiKey=old-value&apiKey=new-value'));
  });
});
