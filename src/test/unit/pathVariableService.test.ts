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

    it('falls back to environment when override is empty or whitespace-only', () => {
      const url = 'https://api.example.com/customers/{{customerId}}';
      assert.strictEqual(
        PathVariableService.resolveUrl(url, [{ key: 'customerId', value: '' }], env),
        'https://api.example.com/customers/9000'
      );
      assert.strictEqual(
        PathVariableService.resolveUrl(url, [{ key: 'customerId', value: '   ' }], env),
        'https://api.example.com/customers/9000'
      );
    });

    it('keeps "0" as an active path override', () => {
      const resolved = PathVariableService.resolveUrl(
        'https://api.example.com/customers/{{customerId}}',
        [{ key: 'customerId', value: '0' }],
        env
      );
      assert.strictEqual(resolved, 'https://api.example.com/customers/0');
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

  describe('analyzeUrlVariableOccurrences', () => {
    it('marks path override as resolved when Environment is missing the key', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do',
        [{ key: 'dsgIdn', value: '1111' }],
        ['baseUrl'],
        { baseUrl: 'https://example.test' }
      );
      const pathDsg = occurrences.find((item) => item.name === 'dsgIdn');
      const base = occurrences.find((item) => item.name === 'baseUrl');
      assert.ok(pathDsg);
      assert.strictEqual(pathDsg!.scope, 'path');
      assert.strictEqual(pathDsg!.resolvedBy, 'path-override');
      assert.strictEqual(pathDsg!.value, '1111');
      assert.strictEqual(pathDsg!.missing, false);
      assert.strictEqual(base!.resolvedBy, 'environment');
      assert.strictEqual(base!.missing, false);
    });

    it('keeps path unresolved when override and Environment are both missing', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do',
        [],
        ['baseUrl'],
        { baseUrl: 'https://example.test' }
      );
      const pathDsg = occurrences.find((item) => item.name === 'dsgIdn');
      assert.strictEqual(pathDsg!.missing, true);
      assert.strictEqual(pathDsg!.resolvedBy, null);
    });

    it('uses Environment for path when override is absent', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '/users/{{userId}}',
        [],
        ['userId'],
        { userId: '9000' }
      );
      assert.strictEqual(occurrences[0].resolvedBy, 'environment');
      assert.strictEqual(occurrences[0].value, '9000');
      assert.strictEqual(occurrences[0].missing, false);
    });

    it('prefers path override over Environment for path occurrence', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '/users/{{userId}}',
        [{ key: 'userId', value: '1111' }],
        ['userId'],
        { userId: '9000' }
      );
      assert.strictEqual(occurrences[0].resolvedBy, 'path-override');
      assert.strictEqual(occurrences[0].value, '1111');
    });

    it('keeps query occurrence unresolved when only path override exists', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do?echo={{dsgIdn}}',
        [{ key: 'dsgIdn', value: '1111' }],
        ['baseUrl'],
        { baseUrl: 'https://example.test' }
      );
      const dsg = occurrences.filter((item) => item.name === 'dsgIdn');
      assert.strictEqual(dsg.length, 2);
      assert.strictEqual(dsg[0].scope, 'path');
      assert.strictEqual(dsg[0].missing, false);
      assert.strictEqual(dsg[0].resolvedBy, 'path-override');
      assert.strictEqual(dsg[1].scope, 'other');
      assert.strictEqual(dsg[1].missing, true);
      assert.strictEqual(dsg[1].resolvedBy, null);
    });

    it('does not treat path override as resolving non-path scopes', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '/users/{{userId}}',
        [{ key: 'userId', value: '1111' }],
        [],
        {}
      );
      assert.strictEqual(occurrences[0].scope, 'path');
      assert.strictEqual(occurrences[0].missing, false);
      // Same key in a body-like string is out of scope for this analyzer; callers must not reuse path results.
      assert.ok(!PathVariableService.extractPathVariableNames('{"id":"{{userId}}"}').includes('userId'));
    });

    it('treats empty override as inactive when Environment is missing', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do',
        [{ key: 'dsgIdn', value: '' }],
        ['baseUrl'],
        { baseUrl: 'https://example.test' }
      );
      const pathDsg = occurrences.find((item) => item.name === 'dsgIdn');
      assert.strictEqual(pathDsg!.missing, true);
      assert.strictEqual(pathDsg!.resolvedBy, null);
    });

    it('treats whitespace-only override as inactive', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do',
        [{ key: 'dsgIdn', value: '   ' }],
        ['baseUrl'],
        { baseUrl: 'https://example.test' }
      );
      assert.strictEqual(occurrences.find((item) => item.name === 'dsgIdn')!.missing, true);
    });

    it('falls back to Environment when override is cleared', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '/users/{{userId}}',
        [{ key: 'userId', value: '' }],
        ['userId'],
        { userId: '9000' }
      );
      assert.strictEqual(occurrences[0].resolvedBy, 'environment');
      assert.strictEqual(occurrences[0].value, '9000');
      assert.strictEqual(occurrences[0].missing, false);
    });

    it('keeps "0" as a resolved path override', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '/users/{{userId}}',
        [{ key: 'userId', value: '0' }],
        [],
        {}
      );
      assert.strictEqual(occurrences[0].resolvedBy, 'path-override');
      assert.strictEqual(occurrences[0].value, '0');
      assert.strictEqual(occurrences[0].missing, false);
    });

    it('clears mixed path/query when override is empty and Environment is missing', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do?echo={{dsgIdn}}',
        [{ key: 'dsgIdn', value: '' }],
        ['baseUrl'],
        { baseUrl: 'https://example.test' }
      );
      const dsg = occurrences.filter((item) => item.name === 'dsgIdn');
      assert.strictEqual(dsg.length, 2);
      assert.ok(dsg.every((item) => item.missing && item.resolvedBy === null));
    });

    it('uses Environment for mixed path/query when override is empty', () => {
      const occurrences = PathVariableService.analyzeUrlVariableOccurrences(
        '{{baseUrl}}/mz-chat/{{dsgIdn}}/customer.do?echo={{dsgIdn}}',
        [{ key: 'dsgIdn', value: '' }],
        ['baseUrl', 'dsgIdn'],
        { baseUrl: 'https://example.test', dsgIdn: '9000' }
      );
      const dsg = occurrences.filter((item) => item.name === 'dsgIdn');
      assert.strictEqual(dsg.length, 2);
      assert.ok(dsg.every((item) => item.resolvedBy === 'environment' && item.value === '9000' && !item.missing));
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

    it('drops empty and whitespace-only override entries, including legacy payloads', () => {
      assert.ok(!PathVariableService.isActiveOverrideValue(''));
      assert.ok(!PathVariableService.isActiveOverrideValue('   '));
      assert.ok(PathVariableService.isActiveOverrideValue('0'));
      assert.ok(PathVariableService.isActiveOverrideValue('  abc  '));
      assert.deepStrictEqual(
        PathVariableService.normalizeOverrides([
          { key: 'dsgIdn', value: '' },
          { key: 'userId', value: '   ' },
          { key: 'keep', value: '  abc  ' },
        ]),
        [{ key: 'keep', value: '  abc  ' }]
      );
      assert.deepStrictEqual(
        PathVariableService.pruneOverrides('/mz-chat/{{dsgIdn}}/customer.do', [
          { key: 'dsgIdn', value: '' },
        ]),
        []
      );
    });
  });
});
