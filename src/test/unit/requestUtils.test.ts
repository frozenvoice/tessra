import * as assert from 'assert';
import {
  buildUrl,
  coalesceQueryParams,
  createUnresolvedVariableError,
  findUnresolvedVariables,
  parseQueryString,
  splitUrlParts,
} from '../../panels/requestPanel/requestUtils';
import { KeyValue } from '../../models/types';
import { VariableService } from '../../services/VariableService';

describe('requestUtils variable diagnostics', () => {
  it('keeps missing nested variables as unresolved warnings', () => {
    const vars: KeyValue[] = [
      { key: 'missing', value: '{{notFound}}', enabled: true },
    ];

    const unresolved = findUnresolvedVariables(
      VariableService.resolve('{{missing}}', vars),
      [],
      [],
      '',
      { type: 'none' },
      vars
    );

    assert.deepStrictEqual(unresolved, ['notFound']);
    assert.strictEqual(
      createUnresolvedVariableError(unresolved),
      'Unresolved environment variables: {{notFound}}'
    );
  });

  it('reports circular references without duplicating them as unresolved variables', () => {
    const vars: KeyValue[] = [
      { key: 'a', value: '{{b}}', enabled: true },
      { key: 'b', value: '{{a}}', enabled: true },
    ];

    const unresolved = findUnresolvedVariables(
      VariableService.resolve('{{a}}', vars),
      [],
      [],
      '',
      { type: 'none' },
      vars
    );

    assert.strictEqual(
      createUnresolvedVariableError(unresolved),
      'Circular environment variable references: {{a}}, {{b}}'
    );
  });
});

describe('requestUtils query URL building', () => {
  it('auto-parse style URL+Params mirror does not duplicate query keys', () => {
    const url = 'https://jsonplaceholder.typicode.com/posts?userId=1';
    const params: KeyValue[] = [
      { key: 'userId', value: '1', enabled: true },
    ];

    assert.strictEqual(
      buildUrl(url, coalesceQueryParams(url, params)),
      'https://jsonplaceholder.typicode.com/posts?userId=1'
    );
  });

  it('merges URL query with an additional Params row once each', () => {
    const url = 'https://api.example.com/posts?userId=1';
    const params: KeyValue[] = [
      { key: 'userId', value: '1', enabled: true },
      { key: 'page', value: '2', enabled: true },
    ];

    assert.strictEqual(
      buildUrl(url, coalesceQueryParams(url, params)),
      'https://api.example.com/posts?userId=1&page=2'
    );
  });

  it('preserves intentional duplicate keys', () => {
    const url = 'https://api.example.com/search?tag=a&tag=b';
    const params: KeyValue[] = [
      { key: 'tag', value: 'a', enabled: true },
      { key: 'tag', value: 'b', enabled: true },
    ];

    assert.strictEqual(
      buildUrl(url, coalesceQueryParams(url, params)),
      'https://api.example.com/search?tag=a&tag=b'
    );
  });

  it('uses the edited Params value once when URL still has the old query', () => {
    const url = 'https://api.example.com/posts?userId=1';
    const params: KeyValue[] = [
      { key: 'userId', value: '2', enabled: true },
    ];

    assert.strictEqual(
      buildUrl(url, coalesceQueryParams(url, params)),
      'https://api.example.com/posts?userId=2'
    );
  });

  it('removes a disabled Params row from the final URL', () => {
    const url = 'https://api.example.com/posts?userId=1&page=2';
    const params: KeyValue[] = [
      { key: 'userId', value: '1', enabled: false },
      { key: 'page', value: '2', enabled: true },
    ];

    assert.strictEqual(
      buildUrl(url, coalesceQueryParams(url, params)),
      'https://api.example.com/posts?page=2'
    );
  });

  it('builds variable-resolved URL query without duplication', () => {
    const vars: KeyValue[] = [
      { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
    ];
    const rawUrl = '{{baseUrl}}/users?_limit=5';
    const resolvedUrl = VariableService.resolve(rawUrl, vars);
    const params: KeyValue[] = [
      { key: '_limit', value: '5', enabled: true },
    ];

    assert.strictEqual(resolvedUrl, 'https://jsonplaceholder.typicode.com/users?_limit=5');
    assert.strictEqual(
      buildUrl(resolvedUrl, coalesceQueryParams(resolvedUrl, params)),
      'https://jsonplaceholder.typicode.com/users?_limit=5'
    );
  });

  it('keeps URL-only query when Params are empty and still allows auth-style append via coalesce seed', () => {
    const url = 'https://api.example.com/posts?userId=1';
    const seeded = coalesceQueryParams(url, []);
    seeded.push({ key: 'api_key', value: 'secret', enabled: true });

    assert.strictEqual(
      buildUrl(url, seeded),
      'https://api.example.com/posts?userId=1&api_key=secret'
    );
  });

  it('preserves fragments and empty values', () => {
    const url = 'https://api.example.com/path?flag=&q=1#section';
    const params: KeyValue[] = [
      { key: 'flag', value: '', enabled: true },
      { key: 'q', value: '1', enabled: true },
    ];

    assert.deepStrictEqual(splitUrlParts(url).pairs, [
      { key: 'flag', value: '' },
      { key: 'q', value: '1' },
    ]);
    assert.strictEqual(
      buildUrl(url, coalesceQueryParams(url, params)),
      'https://api.example.com/path?flag=&q=1#section'
    );
  });

  it('parses encoded query components', () => {
    assert.deepStrictEqual(parseQueryString('q=hello%20world&tag=a'), [
      { key: 'q', value: 'hello world' },
      { key: 'tag', value: 'a' },
    ]);
  });
});
