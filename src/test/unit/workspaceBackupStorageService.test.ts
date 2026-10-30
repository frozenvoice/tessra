import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Module = require('module');
import { Collection, Environment } from '../../models/types';
import type { WorkspaceBackup } from '../../services/StorageService';

type StorageServiceType = typeof import('../../services/StorageService').StorageService;

let StorageServiceCtor: StorageServiceType;
let restoreModuleLoad: (() => void) | null = null;

before(() => {
  const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
  (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function(request: unknown, ...args: unknown[]): unknown {
    if (request === 'vscode') {
      return {
        workspace: {
          getConfiguration: () => ({
            get: (_key: string, fallback: unknown) => fallback,
          }),
        },
        window: {
          showWarningMessage: () => undefined,
        },
      };
    }
    return originalLoad.apply(this, [request, ...args]);
  };
  restoreModuleLoad = () => {
    (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad;
  };
  StorageServiceCtor = require('../../services/StorageService').StorageService;
});

after(() => {
  restoreModuleLoad?.();
});

function createStorage(tmpDir: string): InstanceType<StorageServiceType> {
  return new StorageServiceCtor({
    globalStorageUri: { fsPath: tmpDir },
  } as ConstructorParameters<StorageServiceType>[0]);
}

function createCollection(id: string, name: string): Collection {
  return {
    id,
    name,
    items: [
      {
        id: `${id}-req`,
        type: 'request',
        name: 'GET users',
        request: {
          id: `${id}-request`,
          name: 'GET users',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: [],
          params: [],
          body: '',
          bodyType: 'none',
          auth: { type: 'none' },
        },
      },
    ],
  };
}

function createEnvironment(id: string, name: string): Environment {
  return {
    id,
    name,
    variables: [
      { key: 'baseUrl', value: 'https://api.example.com', enabled: true },
    ],
  };
}

function createBackup(overrides: Partial<WorkspaceBackup['data']> = {}): WorkspaceBackup {
  return {
    app: 'tessra',
    schemaVersion: 1,
    exportedAt: '2026-06-25T00:00:00.000Z',
    tessraVersion: '1.0.3',
    profile: { name: 'default' },
    data: {
      collections: [createCollection('new-col', 'New Collection')],
      environments: [createEnvironment('new-env', 'New Environment')],
      activeEnvironmentId: 'new-env',
      defaultHeaders: [{ key: 'X-New', value: '1', enabled: true }],
      variables: [{ key: 'sharedToken', value: 'secret', enabled: true }],
      tabState: null,
      history: null,
      ...overrides,
    },
  };
}

describe('StorageService workspace backup', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-workspace-backup-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exports the current profile data with the v1 Tessra backup schema', () => {
    const storage = createStorage(tmpDir);
    storage.saveCollections([createCollection('col-1', 'Source Collection')]);
    storage.saveEnvironments([createEnvironment('env-1', 'Source Environment')]);
    storage.saveActiveEnvironmentId('env-1');
    storage.saveDefaultHeaders([{ key: 'Authorization', value: 'Bearer token', enabled: true }]);
    storage.saveVariables([{ key: 'workspaceToken', value: 'abc', enabled: true }]);

    const backup = storage.exportWorkspaceBackup('1.0.3');

    assert.strictEqual(backup.app, 'tessra');
    assert.strictEqual(backup.schemaVersion, 1);
    assert.strictEqual(backup.tessraVersion, '1.0.3');
    assert.strictEqual(backup.profile.name, 'default');
    assert.strictEqual(backup.data.collections[0].name, 'Source Collection');
    assert.strictEqual(backup.data.environments[0].id, 'env-1');
    assert.strictEqual(backup.data.activeEnvironmentId, 'env-1');
    assert.strictEqual(backup.data.defaultHeaders[0].key, 'Authorization');
    assert.strictEqual(backup.data.variables[0].key, 'workspaceToken');
    assert.strictEqual(backup.data.tabState, null);
    assert.strictEqual(backup.data.history, null);
  });

  it('rejects invalid app, unsupported schema versions, and malformed required fields', () => {
    const storage = createStorage(tmpDir);
    const valid = createBackup();

    assert.throws(
      () => storage.validateWorkspaceBackup({ ...valid, app: 'postman' }),
      /Backup app must be "tessra"/
    );
    assert.throws(
      () => storage.validateWorkspaceBackup({ ...valid, schemaVersion: 2 }),
      /Unsupported backup schemaVersion/
    );
    assert.throws(
      () => storage.validateWorkspaceBackup({
        ...valid,
        data: { ...valid.data, collections: {} },
      }),
      /Backup data\.collections must be an array/
    );
  });

  it('rejects malformed collection elements before import', () => {
    const storage = createStorage(tmpDir);

    assert.throws(
      () => storage.validateWorkspaceBackup(createBackup({
        collections: [null] as unknown as WorkspaceBackup['data']['collections'],
      })),
      /Backup data\.collections\[0\] must be an object/
    );
    assert.throws(
      () => storage.validateWorkspaceBackup(createBackup({
        collections: [{
          id: 'bad-col',
          name: 'Bad Collection',
          items: [{ id: 'bad-item', name: 'Bad Request', type: 'request' }],
        }] as unknown as WorkspaceBackup['data']['collections'],
      })),
      /Backup data\.collections\[0\]\.items\[0\]\.request must be an object/
    );
  });

  it('rejects malformed environment elements and normalizes missing environment variables', () => {
    const storage = createStorage(tmpDir);

    assert.throws(
      () => storage.validateWorkspaceBackup(createBackup({
        environments: [{ id: 123, name: 'Bad Environment' }] as unknown as WorkspaceBackup['data']['environments'],
      })),
      /Backup data\.environments\[0\]\.id must be a string/
    );

    const normalized = storage.validateWorkspaceBackup(createBackup({
      environments: [{ id: 'env-no-vars', name: 'No Vars' }] as unknown as WorkspaceBackup['data']['environments'],
      activeEnvironmentId: 'env-no-vars',
    }));
    assert.deepStrictEqual(normalized.data.environments[0].variables, []);
    assert.strictEqual(normalized.data.activeEnvironmentId, 'env-no-vars');
  });

  it('normalizes default header elements with name/value-compatible fields', () => {
    const storage = createStorage(tmpDir);
    const normalized = storage.validateWorkspaceBackup(createBackup({
      defaultHeaders: [{ name: 'X-Legacy', value: 123 }] as unknown as WorkspaceBackup['data']['defaultHeaders'],
    }));

    assert.strictEqual(normalized.data.defaultHeaders[0].key, 'X-Legacy');
    assert.strictEqual(normalized.data.defaultHeaders[0].value, '123');
    assert.strictEqual(normalized.data.defaultHeaders[0].enabled, true);
  });

  it('normalizes variable elements and rejects entries without key or name', () => {
    const storage = createStorage(tmpDir);
    const normalized = storage.validateWorkspaceBackup(createBackup({
      variables: [{ name: 'legacyToken', value: false }] as unknown as WorkspaceBackup['data']['variables'],
    }));

    assert.strictEqual(normalized.data.variables[0].key, 'legacyToken');
    assert.strictEqual(normalized.data.variables[0].value, 'false');
    assert.strictEqual(normalized.data.variables[0].enabled, true);
    assert.throws(
      () => storage.validateWorkspaceBackup(createBackup({
        variables: [{ value: 'missing-key' }] as unknown as WorkspaceBackup['data']['variables'],
      })),
      /Backup data\.variables\[0\]\.key or Backup data\.variables\[0\]\.name must be a string/
    );
  });

  it('replaces current profile data and creates a pre-import backup before restoring', () => {
    const storage = createStorage(tmpDir);
    storage.saveCollections([createCollection('old-col', 'Old Collection')]);
    storage.saveEnvironments([createEnvironment('old-env', 'Old Environment')]);
    storage.saveActiveEnvironmentId('old-env');
    storage.saveDefaultHeaders([{ key: 'X-Old', value: '1', enabled: true }]);
    storage.saveVariables([{ key: 'oldToken', value: 'old', enabled: true }]);

    const result = storage.importWorkspaceBackup(createBackup(), '1.0.3');

    assert.strictEqual(result.collections, 1);
    assert.strictEqual(result.environments, 1);
    assert.strictEqual(result.activeEnvironmentRestored, true);
    assert.ok(fs.existsSync(result.preImportBackupPath));
    assert.strictEqual(path.dirname(result.preImportBackupPath), path.join(tmpDir, 'backups'));

    assert.strictEqual(storage.getCollections()[0].id, 'new-col');
    assert.strictEqual(storage.getEnvironments()[0].id, 'new-env');
    assert.strictEqual(storage.getActiveEnvironmentId(), 'new-env');
    assert.deepStrictEqual(storage.getDefaultHeaders(), [{ key: 'X-New', value: '1', enabled: true }]);
    assert.deepStrictEqual(storage.getVariables(), [{ key: 'sharedToken', value: 'secret', enabled: true }]);

    const preImportBackup = JSON.parse(fs.readFileSync(result.preImportBackupPath, 'utf-8')) as WorkspaceBackup;
    assert.strictEqual(preImportBackup.data.collections[0].id, 'old-col');
    assert.strictEqual(preImportBackup.data.environments[0].id, 'old-env');
    assert.strictEqual(preImportBackup.data.activeEnvironmentId, 'old-env');
  });

  it('clears active environment when the backup references a missing environment id', () => {
    const storage = createStorage(tmpDir);
    storage.saveEnvironments([createEnvironment('old-env', 'Old Environment')]);
    storage.saveActiveEnvironmentId('old-env');

    const result = storage.importWorkspaceBackup(
      createBackup({ activeEnvironmentId: 'missing-env' }),
      '1.0.3'
    );

    assert.strictEqual(result.activeEnvironmentRestored, false);
    assert.strictEqual(storage.getActiveEnvironmentId(), null);
    assert.strictEqual(storage.getEnvironments()[0].id, 'new-env');
  });

  it('imports a backup produced by Tessra export without changing the v1 policies', () => {
    const source = createStorage(tmpDir);
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-workspace-backup-target-'));
    try {
      const target = createStorage(targetDir);
      source.saveCollections([createCollection('export-col', 'Exported Collection')]);
      source.saveEnvironments([createEnvironment('export-env', 'Exported Environment')]);
      source.saveActiveEnvironmentId('export-env');
      source.saveDefaultHeaders([{ key: 'X-Exported', value: 'yes', enabled: true }]);
      source.saveVariables([{ key: 'exportedToken', value: 'secret', enabled: false }]);

      const exported = source.exportWorkspaceBackup('1.0.3');
      const result = target.importWorkspaceBackup(exported, '1.0.3');

      assert.strictEqual(result.collections, 1);
      assert.strictEqual(result.environments, 1);
      assert.strictEqual(result.activeEnvironmentRestored, true);
      assert.strictEqual(target.getCollections()[0].id, 'export-col');
      assert.strictEqual(target.getEnvironments()[0].id, 'export-env');
      assert.strictEqual(target.getActiveEnvironmentId(), 'export-env');
      assert.deepStrictEqual(target.getDefaultHeaders(), [{ key: 'X-Exported', value: 'yes', enabled: true }]);
      assert.deepStrictEqual(target.getVariables(), [{ key: 'exportedToken', value: 'secret', enabled: false }]);
      assert.strictEqual(exported.data.history, null);
      assert.strictEqual(exported.data.tabState, null);
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});
