import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Module = require('module');
import type { Collection, Environment, KeyValue } from '../../models/types';
import type { StorageService } from '../../services/StorageService';

type StorageServiceType = typeof import('../../services/StorageService').StorageService;

let StorageServiceCtor: StorageServiceType;
let restoreModuleLoad: (() => void) | null = null;

describe('StorageService validation fixtures', () => {
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

function writeRaw(tmpDir: string, fileName: string, value: unknown): string {
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
  return filePath;
}

function corruptBackups(tmpDir: string, fileName: string): string[] {
  return fs.readdirSync(tmpDir).filter((entry) => entry.startsWith(`${fileName}.corrupt-`));
}

function requestCollection(): Collection[] {
  return [{
    id: 'collection-1',
    name: 'Collection',
    items: [{
      id: 'request-1',
      type: 'request',
      name: 'Request',
      request: {
        id: 'request-1',
        name: 'Request',
        method: 'GET',
        url: 'https://example.test',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none',
        auth: { type: 'none' },
      },
    }],
  }];
}

function environment(id = 'env-1', variables: KeyValue[] = []): Environment {
  return { id, name: 'Environment', variables };
}

describe('StorageService persisted data validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-storage-validation-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('backs up malformed collections and keeps the original until an explicit save', () => {
    const storage = createStorage(tmpDir);
    const filePath = writeRaw(tmpDir, 'collections.json', { collections: 'invalid' });

    assert.deepStrictEqual(storage.getCollections(), []);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), '{"collections":"invalid"}');
    assert.strictEqual(corruptBackups(tmpDir, 'collections.json').length, 1);
    storage.getCollections();
    assert.strictEqual(corruptBackups(tmpDir, 'collections.json').length, 1);

    storage.saveCollections(requestCollection());
    assert.strictEqual(storage.getCollections()[0].items[0].request?.url, 'https://example.test');
    assert.strictEqual(corruptBackups(tmpDir, 'collections.json').length, 1);
  });

  it('validates nested request data while preserving compatible optional fields', () => {
    const storage = createStorage(tmpDir);
    const filePath = writeRaw(tmpDir, 'collections.json', [{
      id: 'legacy-collection',
      name: 'Legacy',
      items: [{
        id: 'legacy-request',
        type: 'request',
        name: 'Legacy request',
        request: {
          id: 'legacy-request',
          name: 'Legacy request',
          method: 'GET',
          url: '/legacy',
        },
      }],
    }]);

    const loaded = storage.getCollections();
    const request = loaded[0].items[0].request!;
    assert.strictEqual(request.body, '');
    assert.strictEqual(request.bodyType, 'none');
    assert.deepStrictEqual(request.headers, []);
    assert.deepStrictEqual(request.params, []);
    assert.deepStrictEqual(request.auth, { type: 'none' });
    assert.strictEqual(corruptBackups(tmpDir, 'collections.json').length, 0);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8').includes('"body"'), false);

    writeRaw(tmpDir, 'collections.json', [{
      id: 'bad-collection',
      name: 'Bad',
      items: [{ id: 'bad-request', type: 'request', name: 'Bad', request: { id: 'bad', name: 'Bad', method: 'GET', url: '/bad', headers: {} } }],
    }]);
    assert.deepStrictEqual(storage.getCollections(), []);
    assert.strictEqual(corruptBackups(tmpDir, 'collections.json').length, 1);
  });

  it('backs up malformed values across all persisted stores', () => {
    const storage = createStorage(tmpDir);
    writeRaw(tmpDir, 'history.json', [{}]);
    writeRaw(tmpDir, 'environments.json', { environments: [] });
    writeRaw(tmpDir, 'active-environment.json', 42);
    writeRaw(tmpDir, 'default-headers.json', 'invalid');
    writeRaw(tmpDir, 'variables.json', [{ value: 'missing key' }]);
    writeRaw(tmpDir, 'tab-state.json', { tabs: 'invalid', activeIndex: 0 });

    assert.deepStrictEqual(storage.getHistory(), []);
    assert.deepStrictEqual(storage.getEnvironments(), []);
    assert.strictEqual(storage.getActiveEnvironmentId(), null);
    assert.deepStrictEqual(storage.getDefaultHeaders(), [
      { key: 'User-Agent', value: 'Tessra/1.0', enabled: true },
      { key: 'Accept', value: '*/*', enabled: true },
    ]);
    assert.deepStrictEqual(storage.getVariables(), []);
    assert.strictEqual(storage.getTabState(), null);
    for (const fileName of ['history.json', 'environments.json', 'active-environment.json', 'default-headers.json', 'variables.json', 'tab-state.json']) {
      assert.strictEqual(corruptBackups(tmpDir, fileName).length, 1, fileName);
    }
  });

  it('normalizes a valid legacy tab state in memory without rewriting it', () => {
    const storage = createStorage(tmpDir);
    const rawTab = {
      name: 'Legacy tab',
      method: 'GET',
      url: '/users',
      headers: null,
      params: null,
      body: null,
      auth: null,
    };
    const filePath = writeRaw(tmpDir, 'tab-state.json', { tabs: [rawTab], activeIndex: 9 });

    const state = storage.getTabState()!;
    assert.strictEqual(state.activeIndex, 0);
    assert.strictEqual(state.tabs[0].timeout, 0);
    assert.deepStrictEqual(state.tabs[0].headers, []);
    assert.deepStrictEqual(state.tabs[0].params, []);
    assert.strictEqual(state.tabs[0].body, '');
    assert.deepStrictEqual(state.tabs[0].auth, { type: 'none' });
    assert.strictEqual(corruptBackups(tmpDir, 'tab-state.json').length, 0);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8').includes('"timeout"'), false);
  });
});

describe('StorageService environment variable change merge', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-storage-env-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('applies changed set and unset keys while retaining unrelated latest edits', () => {
    const storage = createStorage(tmpDir);
    const baseline: KeyValue[] = [
      { key: 'baseUrl', value: 'https://old.test', enabled: true },
      { key: 'removeMe', value: 'old', enabled: true },
      { key: 'keepMe', value: 'old', enabled: true },
    ];
    storage.saveEnvironments([environment('env-1', [
      baseline[0],
      baseline[1],
      { key: 'keepMe', value: 'edited-by-user', enabled: true },
    ])]);

    const result = storage.applyEnvironmentVariableChanges('env-1', baseline, [
      { key: 'baseUrl', value: 'https://new.test', enabled: true },
      { key: 'keepMe', value: 'old', enabled: true },
      { key: 'added', value: 'script-value', enabled: false },
    ]);

    assert.deepStrictEqual(result, {
      changed: true,
      conflicts: [],
      appliedKeys: ['baseUrl', 'removeMe', 'added'],
    });
    assert.deepStrictEqual(storage.getEnvironment('env-1')?.variables, [
      { key: 'baseUrl', value: 'https://new.test', enabled: true },
      { key: 'keepMe', value: 'edited-by-user', enabled: true },
      { key: 'added', value: 'script-value', enabled: false },
    ]);
  });

  it('reports conflicts for keys changed since the baseline and does not overwrite them', () => {
    const storage = createStorage(tmpDir);
    const baseline: KeyValue[] = [{ key: 'token', value: 'baseline', enabled: true }];
    storage.saveEnvironments([environment('env-1', [{ key: 'token', value: 'user-edit', enabled: true }])]);

    const result = storage.applyEnvironmentVariableChanges('env-1', baseline, [
      { key: 'token', value: 'script-edit', enabled: true },
    ]);

    assert.deepStrictEqual(result, {
      changed: false,
      conflicts: ['token'],
      appliedKeys: [],
    });
    assert.strictEqual(storage.getEnvironment('env-1')?.variables[0].value, 'user-edit');
  });

  it('does not write when the desired values are already current', () => {
    const storage = createStorage(tmpDir);
    const variables: KeyValue[] = [{ key: 'token', value: 'same', enabled: false }];
    storage.saveEnvironments([environment('env-1', variables)]);
    const filePath = path.join(tmpDir, 'environments.json');
    const before = fs.readFileSync(filePath, 'utf8');

    const result = storage.applyEnvironmentVariableChanges('env-1', variables, variables.map((item) => ({ ...item })));

    assert.deepStrictEqual(result, { changed: false, conflicts: [], appliedKeys: [] });
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), before);
  });

  it('treats disabled state as part of a variable change', () => {
    const storage = createStorage(tmpDir);
    const baseline: KeyValue[] = [{ key: 'token', value: 'same', enabled: true }];
    storage.saveEnvironments([environment('env-1', baseline)]);

    const result = storage.applyEnvironmentVariableChanges('env-1', baseline, [
      { key: 'token', value: 'same', enabled: false },
    ]);

    assert.deepStrictEqual(result, { changed: true, conflicts: [], appliedKeys: ['token'] });
    assert.deepStrictEqual(storage.getEnvironment('env-1')?.variables, [{ key: 'token', value: 'same', enabled: false }]);
  });
});
});
