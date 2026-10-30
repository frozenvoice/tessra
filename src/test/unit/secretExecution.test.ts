import * as assert from 'assert';
import { randomUUID } from 'crypto';
import Module = require('module');
import { KeyValue, Request } from '../../models/types';
import { SecretRedactor } from '../../services/secretVariables';
import { VariableService } from '../../services/VariableService';

let helpers: typeof import('../../panels/requestPanel/secretExecution');

describe('Secret execution boundaries', () => {
  before(() => {
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    const original = loader._load;
    loader._load = function(request: unknown, ...args: unknown[]) {
      return request === 'vscode' ? { workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) } }
        : original.apply(this, [request, ...args]);
    };
    try { helpers = require('../../panels/requestPanel/secretExecution'); } finally { loader._load = original; }
  });

  const request = (patch: Partial<Request> = {}): Request => ({ id: 'request', name: 'Request', method: 'GET',
    url: 'http://localhost/items', headers: [], params: [], body: '', bodyType: 'none', auth: { type: 'none' }, ...patch });

  it('collects only actual path overrides while retaining same-name query references', () => {
    const path = request({ url: 'http://localhost/items/{{id}}', pathVariableOverrides: [{ key: 'id', value: 'local-value' }] });
    assert.ok(!helpers.requestVariableTexts(path, []).join('\n').includes('{{id}}'));
    const query = request({ ...path, url: 'http://localhost/items/{{id}}?id={{id}}' });
    assert.ok(helpers.requestVariableTexts(query, []).join('\n').includes('?id={{id}}'));
    const nested = request({ ...path, pathVariableOverrides: [{ key: 'id', value: '{{overrideSecret}}' }] });
    assert.ok(helpers.requestVariableTexts(nested, []).join('\n').includes('{{overrideSecret}}'));
  });

  it('skips unused body and disabled/overridden rows while collecting active binary/formdata payloads', () => {
    const headers: KeyValue[] = [{ key: 'Authorization', value: '{{requestSecret}}', enabled: true },
      { key: 'disabled', value: '{{disabledSecret}}', enabled: false }];
    const defaults = [{ key: 'authorization', value: '{{defaultSecret}}', enabled: true }];
    const form = request({ headers, bodyType: 'formdata', body: '{{staleBody}}', formData: [
      { id: 'active', type: 'text', key: 'field', value: '{{formSecret}}', enabled: true },
      { id: 'disabled', type: 'file', key: 'file', value: '{{disabledFile}}', enabled: false },
    ] });
    const texts = helpers.requestVariableTexts(form, defaults).join('\n');
    assert.ok(texts.includes('{{formSecret}}')); assert.ok(texts.includes('{{requestSecret}}'));
    for (const stale of ['staleBody', 'disabledSecret', 'defaultSecret', 'disabledFile']) { assert.ok(!texts.includes(stale)); }
    const binary = helpers.requestVariableTexts(request({ bodyType: 'binary', body: '{{staleBody}}', binaryFilePath: '{{filePath}}' }), []).join('\n');
    assert.ok(binary.includes('{{filePath}}')); assert.ok(!binary.includes('{{staleBody}}'));
  });

  it('history maps content without altering enums, field names, row IDs or path variable IDs', () => {
    const redactor = new SecretRedactor([{ key: 'token', value: 'GET' }, { key: 'other', value: 'body' }]);
    const snapshot = helpers.createSecretHistorySnapshot(request({ url: 'http://localhost/GET', bodyType: 'json', body: '{"body":"GET"}',
      headers: [{ key: 'GET', value: 'GET', enabled: true }], params: [{ key: 'body', value: 'GET', enabled: true }],
      formData: [{ id: 'GET', type: 'text', key: 'GET', value: 'GET', enabled: true }],
      pathVariableOverrides: [{ key: 'GET', value: 'GET' }], auth: { type: 'apikey', apikey: { key: 'GET', value: 'GET', addTo: 'header' } },
    }), [], { tlsValidation: 'strict', timeout: 15 }, redactor);
    assert.strictEqual(snapshot.method, 'GET'); assert.strictEqual(snapshot.bodyType, 'json'); assert.strictEqual(snapshot.tlsValidation, 'strict');
    assert.strictEqual(snapshot.formData![0].id, 'GET'); assert.strictEqual(snapshot.formData![0].type, 'text');
    assert.strictEqual(snapshot.pathVariableOverrides![0].key, 'GET'); assert.strictEqual(snapshot.pathVariableOverrides![0].value, '{{token}}');
    assert.strictEqual(snapshot.headers[0].value, '{{token}}'); assert.ok(Object.prototype.hasOwnProperty.call(snapshot, 'body'));
    assert.strictEqual(snapshot.auth.apikey!.addTo, 'header'); assert.strictEqual(snapshot.auth.apikey!.value, '{{token}}');
  });

  it('history preserves template auth/default references and drops auto draft rows without changing wire objects', () => {
    const wire = request({ method: 'POST', bodyType: 'json', url: 'http://localhost/{{token}}', body: 'synthetic-secret',
      auth: { type: 'bearer', bearer: { token: '{{token}}' } }, headers: [{ key: '', value: 'draft', enabled: true }] });
    const original = JSON.stringify(wire);
    const snapshot = helpers.createSecretHistorySnapshot(wire, [{ key: 'X-Secret', value: '{{token}}', enabled: true }], {},
      new SecretRedactor([{ key: 'token', value: 'synthetic-secret' }]));
    assert.strictEqual(snapshot.body, '{{token}}'); assert.strictEqual(snapshot.auth.bearer!.token, '{{token}}');
    assert.deepStrictEqual(snapshot.headers, [{ key: 'X-Secret', value: '{{token}}', enabled: true }]);
    assert.deepStrictEqual(snapshot.scripts, { preRequest: '', test: '' }); assert.strictEqual(JSON.stringify(wire), original);
  });

  it('reprotects duplicate protected/plain/disabled families in original order and preserves effective substitution', () => {
    const original: KeyValue[] = [
      { id: randomUUID(), key: 'same', value: '', enabled: true, secretRef: { id: randomUUID() } },
      { id: randomUUID(), key: 'same', value: 'last-effective-plain', enabled: true },
      { id: randomUUID(), key: 'same', value: '', enabled: false, secretRef: { id: randomUUID() } },
      { key: 'other', value: 'before', enabled: true },
    ];
    const script = [{ key: 'same', value: 'synthetic-secret', enabled: true }, { key: 'other', value: 'synthetic-secret', enabled: true }];
    const result = helpers.reprotectScriptVariables(script, original, new SecretRedactor([{ key: 'same', value: 'synthetic-secret' }]));
    assert.deepStrictEqual(result.filter((row) => row.key === 'same'), original.filter((row) => row.key === 'same'));
    assert.strictEqual(VariableService.resolve('{{same}}', result), 'last-effective-plain');
    assert.strictEqual(result.find((row) => row.key === 'other')!.value, '{{same}}');
  });

  it('preview never returns pending originals or secret references', () => {
    const pending: KeyValue = { id: randomUUID(), key: 'token', value: 'synthetic-secret', enabled: true, secretPendingRef: { id: randomUUID() } };
    assert.deepStrictEqual(helpers.previewVariables([pending]), [{ key: 'token', value: '[secret]', enabled: true }]);
  });
});
