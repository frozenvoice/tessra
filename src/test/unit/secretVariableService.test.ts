import * as assert from 'assert';
import { randomUUID } from 'crypto';
import { KeyValue } from '../../models/types';
import { SecretVariableService, SecretVariableStorage } from '../../services/SecretVariableService';
import { SecretRedactor, SecretVariableError, SecretVariableScope, importSecretVariables, sanitizeSecretVariables, secretStorageKey } from '../../services/secretVariables';

describe('SecretVariableService', () => {
  const scope = (): SecretVariableScope => ({ profileName: 'default', profileId: randomUUID(), environmentId: 'existing-env-id' });
  const plain = (key = 'token', value = 'synthetic-secret-✓'): KeyValue => ({ id: randomUUID(), key, value, enabled: true });
  function fixture(initial: KeyValue[]) {
    let rows = structuredClone(initial);
    const values = new Map<string, string>();
    const reads: string[] = [];
    const deleted: string[] = [];
    let failure: 'store' | 'get' | 'delete' | 'verify' | 'save' | undefined;
    let afterStore: (() => void) | undefined;
    const secrets: SecretVariableStorage = {
      async store(key, value) { if (failure === 'store') { throw new Error(value); } values.set(key, value); afterStore?.(); },
      async get(key) { reads.push(key); if (failure === 'get') { throw new Error('keychain failure'); } return failure === 'verify' ? undefined : values.get(key); },
      async delete(key) { if (failure === 'delete') { throw new Error('keychain failure'); } deleted.push(key); values.delete(key); },
    };
    const service = new SecretVariableService(secrets, {
      getVariables() { return structuredClone(rows); },
      compareAndSave(_scope, expected, next) {
        if (failure === 'save' || JSON.stringify(expected) !== JSON.stringify(rows)) { throw new Error('changed'); }
        rows = structuredClone(next);
      },
    });
    return { service, values, reads, deleted, rows: () => structuredClone(rows), setRows: (next: KeyValue[]) => { rows = structuredClone(next); },
      fail: (next: typeof failure) => { failure = next; }, afterStore: (next: () => void) => { afterStore = next; } };
  }
  const code = (expected: string) => (error: unknown) => error instanceof SecretVariableError && error.code === expected;

  it('stores verified secret before removing plaintext and exposes metadata only', async () => {
    const variable = plain(); const owner = scope(); const f = fixture([variable]);
    await f.service.convert(owner, variable.id!);
    const stored = f.rows()[0];
    assert.strictEqual(stored.value, ''); assert.ok(stored.secretRef); assert.ok(!stored.secretPendingRef);
    assert.strictEqual(f.values.get(secretStorageKey(owner, stored, stored.secretRef!.id)), variable.value);
    const view = await f.service.describe(owner);
    assert.strictEqual(view[0].secretState, 'set'); assert.ok(!JSON.stringify(view).includes(variable.value));
    assert.strictEqual(await f.service.reveal(owner, variable.id!), variable.value);
  });

  for (const failure of ['store', 'get', 'verify'] as const) {
    it(`preserves pending original and blocks execution after ${failure} failure`, async () => {
      const variable = plain(); const owner = scope(); const f = fixture([variable]); f.fail(failure);
      await assert.rejects(f.service.convert(owner, variable.id!), code(failure === 'verify' ? 'verification-failed' : 'unavailable'));
      assert.strictEqual(f.rows()[0].value, variable.value); assert.ok(f.rows()[0].secretPendingRef);
      await assert.rejects(f.service.resolve(owner, ['{{token}}']), code('conversion-pending'));
      assert.ok(!JSON.stringify(await f.service.describe(owner)).includes(variable.value));
      assert.ok(!JSON.stringify(sanitizeSecretVariables(f.rows())).includes(variable.value));
    });
  }

  it('resumes a persisted interrupted conversion without changing its ID', async () => {
    const variable = { ...plain(), secretPendingRef: { id: randomUUID() } }; const f = fixture([variable]);
    await f.service.resumeConversion(scope(), variable.id!);
    assert.deepStrictEqual(f.rows()[0].secretRef, variable.secretPendingRef); assert.strictEqual(f.rows()[0].value, '');
  });

  it('explicit cancellation restores original and deletes only exact pending reference', async () => {
    const variable = { ...plain(), secretPendingRef: { id: randomUUID() } }; const owner = scope(); const f = fixture([variable]);
    const pendingKey = secretStorageKey(owner, variable, variable.secretPendingRef.id);
    f.values.set(pendingKey, variable.value); f.values.set('unrelated', 'untouched');
    await f.service.cancelConversion(owner, variable.id!);
    assert.deepStrictEqual(f.deleted, [pendingKey]); assert.strictEqual(f.rows()[0].value, variable.value);
    assert.ok(!f.rows()[0].secretPendingRef); assert.strictEqual(f.values.get('unrelated'), 'untouched');
  });

  it('CAS keeps concurrent rename and interrupted original after keychain completion', async () => {
    const variable = plain(); const f = fixture([variable]);
    f.afterStore(() => f.setRows(f.rows().map((entry) => ({ ...entry, key: 'renamed' }))));
    await assert.rejects(f.service.convert(scope(), variable.id!), code('conflict'));
    assert.strictEqual(f.rows()[0].key, 'renamed'); assert.strictEqual(f.rows()[0].value, variable.value); assert.ok(f.rows()[0].secretPendingRef);
  });

  it('replacement uses fresh reference and leaves old value available for explicit restoration', async () => {
    const variable = plain(); const owner = scope(); const f = fixture([variable]); await f.service.convert(owner, variable.id!);
    const old = f.rows()[0]; await f.service.replace(owner, variable.id!, 'replacement-secret');
    assert.notStrictEqual(f.rows()[0].secretRef!.id, old.secretRef!.id);
    assert.strictEqual(await f.service.reveal(owner, variable.id!), 'replacement-secret');
    f.setRows([old]); assert.strictEqual(await f.service.reveal(owner, variable.id!), variable.value);
    assert.deepStrictEqual(f.deleted, []);
  });

  it('failed replacement leaves original reference intact without saving input plaintext', async () => {
    const variable = plain(); const owner = scope(); const f = fixture([variable]); await f.service.convert(owner, variable.id!);
    const before = f.rows(); f.fail('store');
    await assert.rejects(f.service.replace(owner, variable.id!, 'new-secret'), code('unavailable'));
    assert.deepStrictEqual(f.rows(), before); assert.ok(!JSON.stringify(f.rows()).includes('new-secret'));
  });

  it('name changes do not change secret key; duplicate names and profiles remain separated by IDs', async () => {
    const a = plain('duplicate', 'first-secret'); const b = plain('duplicate', 'second-secret'); const owner = scope(); const f = fixture([a, b]);
    await f.service.convert(owner, a.id!); await f.service.convert(owner, b.id!);
    const before = f.rows(); f.setRows(before.map((entry) => entry.id === a.id ? { ...entry, key: 'renamed' } : entry));
    assert.strictEqual(await f.service.reveal(owner, a.id!), a.value); assert.strictEqual(await f.service.reveal(owner, b.id!), b.value);
    await assert.rejects(f.service.reveal({ ...owner, profileId: randomUUID() }, a.id!), code('missing'));
    await assert.rejects(f.service.reveal({ ...owner, environmentId: null }, a.id!), code('missing'));
  });

  it('reads only selected effective recursively used secrets and blocks missing values', async () => {
    const used = plain('token'); const unused = { ...plain('unused'), secretRef: { id: randomUUID() }, value: '' };
    const alias = plain('header', 'Bearer {{token}}'); const owner = scope(); const f = fixture([used, unused, alias]);
    await f.service.convert(owner, used.id!); f.reads.length = 0;
    const result = await f.service.resolve(owner, ['{{header}}']);
    assert.strictEqual(result.variables[0].value, used.value); assert.strictEqual(f.reads.length, 1);
    assert.strictEqual(result.redactor.mask(used.value), '[secret]');
    await assert.rejects(f.service.resolve(owner, ['{{unused}}']), code('missing'));
    await assert.rejects(f.service.resolve(owner, [], { scriptsAll: true }), code('missing'));
  });

  it('follows secret-to-secret references irrespective of row order', async () => {
    const last = plain('last', 'final-value'); const middle = plain('middle', '{{last}}'); const first = plain('first', '{{middle}}');
    const owner = scope(); const f = fixture([last, middle, first]);
    for (const entry of [last, middle, first]) { await f.service.convert(owner, entry.id!); }
    const result = await f.service.resolve(owner, ['{{first}}']);
    assert.strictEqual(result.variables[0].value, 'final-value'); assert.strictEqual(result.variables[1].value, '{{last}}');
  });

  it('honors captured reference after replacement and keeps unused secrets unresolved', async () => {
    const variable = plain(); const owner = scope(); const f = fixture([variable]); await f.service.convert(owner, variable.id!);
    const snapshot = f.rows(); await f.service.replace(owner, variable.id!, 'new-value');
    const captured = await f.service.resolve(owner, ['{{token}}'], { variables: snapshot });
    assert.strictEqual(captured.variables[0].value, variable.value); assert.ok(!captured.variables[0].secretRef);
    const unused = await f.service.resolve(owner, []);
    assert.strictEqual(unused.variables[0].value, '{{token}}'); assert.ok(unused.variables[0].secretRef);
    assert.strictEqual(f.rows()[0].value, '');
  });

  it('distinguishes explicitly stored empty value from missing keychain value', async () => {
    const variable = plain('token', ''); const owner = scope(); const f = fixture([variable]); await f.service.convert(owner, variable.id!);
    assert.strictEqual(await f.service.reveal(owner, variable.id!), '');
    assert.strictEqual((await f.service.describe(owner))[0].secretState, 'set');
    const empty = await f.service.resolve(owner, ['{{token}}']);
    assert.strictEqual(empty.variables[0].value, '');
    assert.ok(empty.redactor.hasSecrets, 'empty protected values still keep history in reference mode');
    f.values.clear(); await assert.rejects(f.service.resolve(owner, ['{{token}}']), code('missing'));
    assert.strictEqual((await f.service.describe(owner))[0].secretState, 'missing');
    f.fail('get'); assert.strictEqual((await f.service.describe(owner))[0].secretState, 'unavailable');
  });

  it('failed explicit keychain deletion keeps row reference and never restores plaintext', async () => {
    const variable = plain(); const owner = scope(); const f = fixture([variable]); await f.service.convert(owner, variable.id!);
    const before = f.rows(); f.fail('delete');
    await assert.rejects(f.service.remove(owner, variable.id!), code('unavailable'));
    assert.deepStrictEqual(f.rows(), before); assert.strictEqual(f.rows()[0].value, '');
  });

  it('serializes resume and cancel so a confirmed conversion cannot lose its keychain value', async () => {
    const variable = { ...plain(), secretPendingRef: { id: randomUUID() } }; const owner = scope();
    let rows: KeyValue[] = [variable]; let stored: string | undefined; let deleted = false;
    let enter!: () => void; const entered = new Promise<void>((resolve) => { enter = resolve; });
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    const service = new SecretVariableService({
      async store(_key, value) { stored = value; enter(); await gate; },
      async get() { return stored; },
      async delete() { deleted = true; stored = undefined; },
    }, {
      getVariables() { return structuredClone(rows); },
      compareAndSave(_scope, expected, next) { assert.deepStrictEqual(rows, expected); rows = structuredClone(next); },
    });
    const resume = service.resumeConversion(owner, variable.id!); await entered;
    const cancel = service.cancelConversion(owner, variable.id!);
    assert.strictEqual(deleted, false); release(); await resume;
    await assert.rejects(cancel, code('not-found')); assert.strictEqual(deleted, false);
    assert.strictEqual(await service.reveal(owner, variable.id!), variable.value); assert.strictEqual(rows[0].value, '');
  });

  it('deletion removes only explicitly selected IDs and restored reference becomes missing', async () => {
    const a = plain('duplicate'); const b = plain('duplicate', 'second'); const owner = scope(); const f = fixture([a, b]);
    await f.service.convert(owner, a.id!); await f.service.convert(owner, b.id!); const before = f.rows();
    await f.service.remove(owner, a.id!); assert.strictEqual(f.rows().length, 1); assert.strictEqual(f.rows()[0].id, b.id);
    assert.deepStrictEqual(f.deleted, [secretStorageKey(owner, before[0], before[0].secretRef!.id)]);
    f.setRows(before); await assert.rejects(f.service.reveal(owner, a.id!), code('missing'));
    assert.strictEqual(await f.service.reveal(owner, b.id!), b.value);
  });

  it('import strips pending originals and makes every secret reference fresh and missing', () => {
    const secret = { ...plain(), secretRef: { id: randomUUID() } }; const pending = { ...plain('pending'), secretPendingRef: { id: randomUUID() } };
    const imported = importSecretVariables([secret, pending]);
    assert.strictEqual(imported[0].id, secret.id); assert.notStrictEqual(imported[0].secretRef!.id, secret.secretRef.id);
    assert.strictEqual(imported[1].value, ''); assert.ok(!imported[1].secretPendingRef);
    assert.ok(!JSON.stringify(imported).includes(secret.value));
  });

  it('rejects malformed IDs before persisting conversion intent', async () => {
    const variable = plain(); const f = fixture([variable]);
    await assert.rejects(f.service.convert({ ...scope(), profileId: 'bad' }, variable.id!), code('invalid-id'));
    assert.deepStrictEqual(f.rows(), [variable]);
    await assert.rejects(f.service.convert(scope(), 'bad'), code('invalid-id'));
  });

  it('redacts known raw/common encodings once while preserving references for stored requests', () => {
    const value = 'synthetic+value/✓'; const redactor = new SecretRedactor([{ key: 'secret', value }]);
    for (const encoded of [value, encodeURIComponent(value), encodeURI(value), Buffer.from(value).toString('base64'), JSON.stringify(value).slice(1, -1)]) {
      assert.strictEqual(redactor.mask(`prefix ${encoded} suffix`), 'prefix [secret] suffix');
      assert.strictEqual(redactor.preserveReferences(encoded), '{{secret}}');
    }
    assert.deepStrictEqual(redactor.map({ headers: [{ key: value, value }] }, 'references'), { headers: [{ key: '{{secret}}', value: '{{secret}}' }] });
    assert.strictEqual(redactor.mask('ordinary-response'), 'ordinary-response');
    assert.strictEqual(new SecretRedactor([{ key: 'token', value: '\ud800' }]).mask('\ud800'), '[secret]');
  });
});
