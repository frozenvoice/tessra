import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import Module = require('module');
import { KeyValue } from '../../models/types';
import { SecretVariableService } from '../../services/SecretVariableService';
import { SecretVariableError, secretStorageKey, stringifySecretReferences } from '../../services/secretVariables';
import type { StorageService } from '../../services/StorageService';

type StorageType = typeof import('../../services/StorageService').StorageService;
let StorageCtor: StorageType;

describe('Secret variables with real StorageService JSON', () => {
  let directory: string;
  let profile: string;
  let storage: StorageService;
  let service: SecretVariableService;
  let values: Map<string, string>;
  let failStore: boolean;

  before(() => {
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    const original = loader._load;
    loader._load = function(request: unknown, ...args: unknown[]) {
      return request === 'vscode' ? { workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
        window: { showWarningMessage: () => undefined } } : original.apply(this, [request, ...args]);
    };
    try { StorageCtor = require('../../services/StorageService').StorageService; } finally { loader._load = original; }
  });

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-secret-storage-'));
    profile = 'default'; failStore = false; values = new Map();
    storage = new StorageCtor({ globalStorageUri: { fsPath: directory } } as ConstructorParameters<StorageType>[0]);
    storage.getWorkspaceProfileName = () => profile;
    service = new SecretVariableService({ async get(key) { return values.get(key); },
      async store(key, value) { if (failStore) { throw new Error(value); } values.set(key, value); },
      async delete(key) { values.delete(key); } }, {
      getVariables: storage.getScopedVariables.bind(storage), compareAndSave: storage.compareAndSaveScopedVariables.bind(storage),
    });
  });

  afterEach(() => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  });

  const variable = (value = 'synthetic-secret-storage-value'): KeyValue => ({ id: randomUUID(), key: 'token', value, enabled: true });
  const errorCode = (expected: string) => (error: unknown) => error instanceof SecretVariableError && error.code === expected;
  const disk = (name: string) => fs.readFileSync(path.join(directory, name), 'utf8');

  it('preserves invalid profile metadata and blocks identity creation until it is recovered', () => {
    for (const input of [[], { name: 'default', id: 'invalid' }]) {
      const original = JSON.stringify(input);
      fs.writeFileSync(path.join(directory, 'profile.json'), original);
      assert.throws(() => storage.getWorkspaceProfileId());
      assert.strictEqual(disk('profile.json'), original);
    }
    fs.writeFileSync(path.join(directory, 'profile.json'), JSON.stringify({ name: 'default' }));
    assert.match(storage.getWorkspaceProfileId(), /^[0-9a-f-]{36}$/);
  });

  it('keeps stable UUID profiles and separates duplicate names/environment IDs/workspace references', async () => {
    const a = variable(); storage.saveEnvironments([{ id: 'env', name: 'Environment', variables: [a] }]);
    const owner = storage.getVariableScope('env'); await service.convert(owner, a.id!);
    const first = storage.getScopedVariables(owner)[0];
    assert.strictEqual(storage.getWorkspaceProfileId(), owner.profileId);
    storage.saveVariables([{ ...first }]);
    await assert.rejects(service.reveal(storage.getVariableScope(null), a.id!), errorCode('missing'));
    profile = 'another profile'; storage.saveEnvironments([{ id: 'env', name: 'Environment', variables: [first] }]);
    const other = storage.getVariableScope('env'); assert.notStrictEqual(other.profileId, owner.profileId);
    await assert.rejects(service.reveal(other, a.id!), errorCode('missing'));
    assert.strictEqual(await service.reveal(owner, a.id!), a.value);
    assert.ok(disk('profile.json').includes(owner.profileId));
  });

  it('removes secret value properties from disk and exports only references including pre-import backup', async () => {
    const a = variable(); storage.saveEnvironments([{ id: 'env', name: 'Environment', variables: [a] }]);
    const owner = storage.getVariableScope('env'); await service.convert(owner, a.id!);
    const json = JSON.parse(disk('environments.json'));
    assert.ok(!Object.prototype.hasOwnProperty.call(json[0].variables[0], 'value'));
    assert.ok(!disk('environments.json').includes(a.value));
    const backup = storage.exportWorkspaceBackup(); assert.ok(!JSON.stringify(backup).includes(a.value));
    const exported = JSON.parse(stringifySecretReferences(backup));
    assert.ok(!Object.prototype.hasOwnProperty.call(exported.data.environments[0].variables[0], 'value'));
    const reference = backup.data.environments[0].variables[0].secretRef!.id;
    storage.importWorkspaceBackup(backup);
    const imported = storage.getScopedVariables(owner)[0]; assert.notStrictEqual(imported.secretRef!.id, reference);
    await assert.rejects(service.reveal(owner, a.id!), errorCode('missing'));
    const backups = fs.readdirSync(path.join(directory, 'backups'));
    assert.strictEqual(backups.length, 1);
    assert.ok(!fs.readFileSync(path.join(directory, 'backups', backups[0]), 'utf8').includes(a.value));
    assert.strictEqual(values.get(secretStorageKey(owner, backup.data.environments[0].variables[0], reference)), a.value);
  });

  it('pending conversion retains current original only for recovery and new backups omit it', async () => {
    const a = variable(); storage.saveEnvironments([{ id: 'env', name: 'Environment', variables: [a] }]);
    const owner = storage.getVariableScope('env'); failStore = true;
    await assert.rejects(service.convert(owner, a.id!), errorCode('unavailable'));
    assert.ok(disk('environments.json').includes(a.value)); assert.ok(storage.getScopedVariables(owner)[0].secretPendingRef);
    assert.ok(!JSON.stringify(storage.exportWorkspaceBackup()).includes(a.value));
    await assert.rejects(service.resolve(owner, ['{{token}}']), errorCode('conversion-pending'));
    failStore = false; await service.resumeConversion(owner, a.id!);
    assert.ok(!disk('environments.json').includes(a.value)); assert.strictEqual(await service.reveal(owner, a.id!), a.value);
  });

  it('explicit cancellation restores original from persisted pending state without a mask fallback', async () => {
    const a = variable(); storage.saveVariables([a]); const owner = storage.getVariableScope(null); failStore = true;
    await assert.rejects(service.convert(owner, a.id!), errorCode('unavailable'));
    const pending = storage.getScopedVariables(owner)[0]; values.set(secretStorageKey(owner, pending, pending.secretPendingRef!.id), a.value);
    await service.cancelConversion(owner, a.id!);
    assert.deepStrictEqual(storage.getScopedVariables(owner), [a]); assert.strictEqual(values.size, 0);
    assert.ok(disk('variables.json').includes(a.value)); assert.ok(!disk('variables.json').includes('[secret]'));
  });

  it('rename retains stable variable identity and exact deletion leaves restored ref missing', async () => {
    const a = variable(); const b = variable('second-synthetic-secret'); storage.saveEnvironments([{ id: 'env', name: 'Old name', variables: [a, b] }]);
    const owner = storage.getVariableScope('env'); await service.convert(owner, a.id!); await service.convert(owner, b.id!);
    const environments = storage.getEnvironments(); environments[0].name = 'Renamed environment'; environments[0].variables[0].key = 'renamed-token';
    storage.saveEnvironments(environments); assert.strictEqual(await service.reveal(owner, a.id!), a.value);
    const before = storage.getScopedVariables(owner); await service.remove(owner, a.id!);
    const after = storage.getScopedVariables(owner); assert.strictEqual(after.length, 1); assert.strictEqual(await service.reveal(owner, b.id!), b.value);
    storage.compareAndSaveScopedVariables(owner, after, before);
    await assert.rejects(service.reveal(owner, a.id!), errorCode('missing'));
    assert.strictEqual(await service.reveal(owner, b.id!), b.value);
  });

  it('scope CAS rejects edits and profile identity changes without overwriting current data', () => {
    const a = variable(); storage.saveVariables([a]); const owner = storage.getVariableScope(null); const before = storage.getScopedVariables(owner);
    storage.saveVariables([{ ...a, key: 'renamed' }]);
    assert.throws(() => storage.compareAndSaveScopedVariables(owner, before, []), /changed/);
    assert.strictEqual(storage.getVariables()[0].key, 'renamed');
    const metadata = JSON.parse(disk('profile.json')); metadata.id = randomUUID();
    fs.writeFileSync(path.join(directory, 'profile.json'), JSON.stringify(metadata));
    assert.throws(() => storage.getScopedVariables(owner), /identity changed/);
    assert.strictEqual(storage.getVariables()[0].key, 'renamed');
  });

  it('keeps an in-flight conversion in its captured profile after the active profile changes', async () => {
    const a = variable(); storage.saveVariables([a]); const owner = storage.getVariableScope(null);
    let enter!: () => void; const entered = new Promise<void>((resolve) => { enter = resolve; });
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    const delayed = new SecretVariableService({ async get(key) { return values.get(key); },
      async store(key, value) { values.set(key, value); enter(); await gate; }, async delete(key) { values.delete(key); } }, {
      getVariables: storage.getScopedVariables.bind(storage), compareAndSave: storage.compareAndSaveScopedVariables.bind(storage),
    });
    const conversion = delayed.convert(owner, a.id!); await entered;
    profile = 'switched'; storage.saveVariables([{ ...a, value: 'other-profile-original' }]); const other = storage.getVariableScope(null);
    release(); await conversion;
    assert.strictEqual(storage.getScopedVariables(other)[0].value, 'other-profile-original');
    assert.ok(!storage.getScopedVariables(other)[0].secretRef);
    assert.strictEqual(storage.getScopedVariables(owner)[0].value, '');
    assert.strictEqual(await delayed.reveal(owner, a.id!), a.value);
    await assert.rejects(delayed.reveal(other, a.id!), errorCode('not-found'));
  });
});
