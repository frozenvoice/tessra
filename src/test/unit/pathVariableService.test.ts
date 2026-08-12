import * as assert from 'assert';
import { PathVariableService } from '../../services/PathVariableService';
import { VariableService } from '../../services/VariableService';
import { KeyValue } from '../../models/types';

function kv(key: string, value: string, enabled = true): KeyValue {
  return { key, value, enabled };
}

describe('PathVariableService', () => {
  describe('extractPathVariableNames', () => {
    it('detects full path segments and excludes leading baseUrl', () => {
      assert.deepStrictEqual(
        PathVariableService.extractPathVariableNames('{{baseUrl}}/mz-chat/{{customerId}}/customer.do'),
        ['customerId']
      );
    });

    it('detects absolute and relative https paths', () => {
      assert.deepStrictEqual(
        PathVariableService.extractPathVariableNames('https://api.example.com/users/{{userId}}'),
        ['userId']
      );
      assert.deepStrictEqual(
        PathVariableService.extractPathVariableNames('/users/{{userId}}/orders/{{orderId}}'),
        ['userId', 'orderId']
      );
    });

    it('excludes authority placeholders', () => {
      assert.deepStrictEqual(
        PathVariableService.extractPathVariableNames('https://{{host}}/users/{{userId}}'),
        ['userId']
      );
    });

    it('excludes query placeholders and partial segments', () => {
      assert.deepStrictEqual(
        PathVariableService.extractPathVariableNames('{{baseUrl}}/users/{{userId}}?page={{page}}'),
        ['userId']
      );
      assert.deepStrictEqual(
        PathVariableService.extractPathVariableNames('/users/user-{{userId}}'),
        []
      );
    });

    it('dedupes while preserving first-seen order', () => {
      assert.deepStrictEqual(
        PathVariableService.extractPathVariableNames('/a/{{id}}/b/{{id}}/c/{{other}}'),
        ['id', 'other']
      );
    });
  });

  describe('precedence and path-only scope', () => {
    const env: KeyValue[] = [
      kv('baseUrl', 'https://api.example.com'),
      kv('customerId', '9000'),
    ];

    it('prefers request-local path override over environment for path only', () => {
      const url = '{{baseUrl}}/customers/{{customerId}}?echo={{customerId}}';
      const resolved = PathVariableService.resolveUrl(url, [{ key: 'customerId', value: '1111' }], env);
      assert.strictEqual(resolved, 'https://api.example.com/customers/1111?echo=9000');
    });

    it('falls back to environment when override is absent', () => {
      const resolved = PathVariableService.resolveUrl(
        '{{baseUrl}}/customers/{{customerId}}',
        [],
        env
      );
      assert.strictEqual(resolved, 'https://api.example.com/customers/9000');
    });

    it('keeps unresolved path placeholders when neither override nor env exists', () => {
      const resolved = PathVariableService.resolveUrl(
        '{{baseUrl}}/customers/{{missingId}}',
        [],
        [kv('baseUrl', 'https://api.example.com')]
      );
      assert.strictEqual(resolved, 'https://api.example.com/customers/{{missingId}}');
    });

    it('treats empty-string override as active', () => {
      const resolved = PathVariableService.resolveUrl(
        'https://api.example.com/customers/{{customerId}}',
        [{ key: 'customerId', value: '' }],
        env
      );
      assert.strictEqual(resolved, 'https://api.example.com/customers/');
    });

    it('does not apply path override to headers/body via VariableService', () => {
      const overrides = [{ key: 'customerId', value: '1111' }];
      const header = VariableService.resolve('{{customerId}}', env);
      const body = VariableService.resolve('{"customerId":"{{customerId}}"}', env);
      assert.strictEqual(header, '9000');
      assert.strictEqual(body, '{"customerId":"9000"}');
      assert.strictEqual(
        PathVariableService.resolveUrl('/customers/{{customerId}}', overrides, env),
        '/customers/1111'
      );
    });
  });

  describe('normalize and prune', () => {
    it('normalizes missing/invalid override payloads to empty', () => {
      assert.deepStrictEqual(PathVariableService.normalizeOverrides(undefined), []);
      assert.deepStrictEqual(PathVariableService.normalizeOverrides(null), []);
      assert.deepStrictEqual(
        PathVariableService.normalizeOverrides([{ key: ' a ', value: 1 }, { key: 'a', value: '2' }]),
        [{ key: 'a', value: '1' }]
      );
    });

    it('prunes orphan overrides not present in the current URL path', () => {
      const pruned = PathVariableService.pruneOverrides('/users/{{userId}}', [
        { key: 'userId', value: '1' },
        { key: 'customerId', value: '2' },
      ]);
      assert.deepStrictEqual(pruned, [{ key: 'userId', value: '1' }]);
    });
  });
});
