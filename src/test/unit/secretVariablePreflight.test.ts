import * as assert from 'assert';
import { randomUUID } from 'crypto';
import Module = require('module');
import { KeyValue } from '../../models/types';
import { SecretVariableService, SecretVariableView } from '../../services/SecretVariableService';
import { secretStorageKey } from '../../services/secretVariables';
import type { RequestPanel } from '../../panels/RequestPanel';
import type { StorageService } from '../../services/StorageService';
import type { EnvironmentTreeProvider } from '../../providers/EnvironmentTreeProvider';

interface PreflightPanel {
  storageProfileName: string;
  executionGeneration: number;
  isDisposed: boolean;
  activeVariableSequence: number;
  sendActiveVarsToWebview(): void;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('Secret variable Webview preflight metadata', () => {
  let Panel: typeof RequestPanel;
  let panel: PreflightPanel;
  let originalStorage: StorageService;
  let originalProvider: EnvironmentTreeProvider;
  let originalSecrets: SecretVariableService;
  let originalModule: NodeModule | undefined;
  let posted: any[];
  let errors: string[];
  let profile: string;
  let rows: Map<string, KeyValue[]>;
  const profileId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    posted = []; errors = []; profile = 'fixture'; rows = new Map([['a', []], ['b', []]]);
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    const originalLoad = loader._load;
    loader._load = function(request: unknown, ...args: unknown[]): unknown {
      if (request === 'vscode') {
        return { workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
          window: { showErrorMessage: (error: string) => errors.push(error) } };
      }
      return originalLoad.apply(this, [request, ...args]);
    };
    const modulePath = require.resolve('../../panels/RequestPanel');
    originalModule = require.cache[modulePath];
    delete require.cache[modulePath];
    try { Panel = require(modulePath).RequestPanel; }
    finally { loader._load = originalLoad; }
    originalStorage = Panel.storage;
    originalProvider = Panel.environmentProvider;
    originalSecrets = Panel.secretVariables;
    Panel.storage = {
      getWorkspaceProfileName: () => profile,
      getWorkspaceProfileId: () => profileId,
      getVariableScope: (environmentId: string | null, profileName: string) => ({ environmentId, profileName, profileId }),
    } as unknown as StorageService;
    Panel.environmentProvider = {
      activeEnvId: 'a',
      getActiveVariables: () => rows.get(Panel.environmentProvider.activeEnvId ?? '') ?? [],
    } as unknown as EnvironmentTreeProvider;
    panel = Object.assign(Object.create(Panel.prototype), {
      storageProfileName: profile, executionGeneration: 0, isDisposed: false, activeVariableSequence: 0,
      postMessage: (message: unknown) => posted.push(message),
    });
  });

  afterEach(() => {
    Panel.storage = originalStorage;
    Panel.environmentProvider = originalProvider;
    Panel.secretVariables = originalSecrets;
    const modulePath = require.resolve('../../panels/RequestPanel');
    if (originalModule) { require.cache[modulePath] = originalModule; }
    else { delete require.cache[modulePath]; }
  });

  function secret(key: string, pending = false, enabled = true): KeyValue {
    return { id: randomUUID(), key, enabled, value: pending ? 'synthetic-pending-original-DO-NOT-POST' : '',
      ...(pending ? { secretPendingRef: { id: randomUUID() } } : { secretRef: { id: randomUUID() } }) };
  }

  async function settle() { for (let index = 0; index < 12; index++) { await Promise.resolve(); } }

  it('실제 keychain metadata의 set/missing/pending/unavailable를 구분하고 실제 비밀값을 보내지 않는다', async () => {
    const set = secret('set');
    const missing = secret('missing');
    const pending = secret('pending', true);
    const unavailable = secret('unavailable');
    const disabled = secret('disabled', false, false);
    rows.set('a', [set, missing, pending, unavailable, disabled, { key: 'ordinary', value: 'plain-preserved', enabled: true }]);
    const scope = { profileName: profile, profileId, environmentId: 'a' };
    const secrets = new Map([[secretStorageKey(scope, set, set.secretRef!.id), 'synthetic-current-value-DO-NOT-POST']]);
    const unavailableKey = secretStorageKey(scope, unavailable, unavailable.secretRef!.id);
    Panel.secretVariables = new SecretVariableService({
      get: async (key) => { if (key === unavailableKey) { throw new Error('synthetic-keychain-error-value-DO-NOT-POST'); } return secrets.get(key); },
      store: async () => { throw new Error('metadata must not store'); },
      delete: async () => { throw new Error('metadata must not delete'); },
    }, { getVariables: () => structuredClone(rows.get('a')!), compareAndSave: () => { throw new Error('metadata must not mutate'); } });
    panel.sendActiveVarsToWebview();
    await settle();
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].type, 'activeVarKeys');
    assert.deepStrictEqual(posted[0].varKeys, ['set', 'missing', 'pending', 'unavailable', 'ordinary']);
    assert.deepStrictEqual(posted[0].varValues, {
      set: '[secret]', missing: '{{missing}}', pending: '{{pending}}', unavailable: '{{unavailable}}', ordinary: 'plain-preserved',
    });
    assert.strictEqual(JSON.stringify(posted).includes('DO-NOT-POST'), false);
    assert.deepStrictEqual(errors, []);
  });

  it('keychain describe 실패는 빈 문자열이나 resolved mask로 대체하지 않고 참조를 남긴다', async () => {
    rows.set('a', [secret('token'), secret('converting', true), { key: 'ordinary', value: 'plain-preserved', enabled: true }]);
    Panel.secretVariables = { describe: async () => { throw new Error('synthetic-private-rejection-DO-NOT-POST'); } } as unknown as SecretVariableService;
    panel.sendActiveVarsToWebview();
    await settle();
    assert.deepStrictEqual(posted[0].varValues, { token: '{{token}}', converting: '{{converting}}', ordinary: 'plain-preserved' });
    assert.strictEqual(JSON.stringify(posted).includes('DO-NOT-POST'), false);
    assert.deepStrictEqual(errors, []);
  });

  it('보호 참조가 없는 평문 변수는 자동 비밀 분류하거나 keychain을 읽지 않는다', () => {
    rows.set('a', [{ key: 'ordinary', value: 'explicit-plaintext', enabled: true }, { key: 'disabled', value: 'do-not-use', enabled: false }, { key: '', value: 'empty-key', enabled: true }]);
    Panel.secretVariables = { describe: async () => { throw new Error('unneeded keychain access'); } } as unknown as SecretVariableService;
    panel.sendActiveVarsToWebview();
    assert.deepStrictEqual(posted[0].varKeys, ['ordinary']);
    assert.deepStrictEqual(posted[0].varValues, { ordinary: 'explicit-plaintext' });
    assert.deepStrictEqual(errors, []);
  });

  it('pending ref의 원문이 source snapshot에 남아도 description 실패 시 Webview로 새지 않는다', async () => {
    const pending = secret('token', true);
    rows.set('a', [pending]);
    const gate = deferred<SecretVariableView[]>();
    Panel.secretVariables = { describe: () => gate.promise } as unknown as SecretVariableService;
    panel.sendActiveVarsToWebview();
    assert.strictEqual(posted.length, 0);
    gate.reject(new Error(pending.value));
    await settle();
    assert.deepStrictEqual(posted[0].varValues, { token: '{{token}}' });
    assert.strictEqual(JSON.stringify(posted).includes(pending.value), false);
  });

  it('느린 A metadata가 빠른 B의 치환 preflight를 덮어쓰지 않는다', async () => {
    rows.set('a', [secret('a-token')]);
    rows.set('b', [secret('b-token')]);
    const a = deferred<SecretVariableView[]>();
    const b = deferred<SecretVariableView[]>();
    Panel.secretVariables = { describe: (scope) => scope.environmentId === 'a' ? a.promise : b.promise } as SecretVariableService;
    panel.sendActiveVarsToWebview();
    Panel.environmentProvider.activeEnvId = 'b';
    panel.sendActiveVarsToWebview();
    b.resolve([{ ...rows.get('b')![0], secretState: 'missing' }]);
    await settle();
    a.resolve([{ ...rows.get('a')![0], secretState: 'set' }]);
    await settle();
    assert.strictEqual(posted.length, 1);
    assert.deepStrictEqual(posted[0].varValues, { 'b-token': '{{b-token}}' });
  });

  it('같은 환경의 이전 describe 실패도 최신 metadata를 unresolved로 되돌리지 않는다', async () => {
    const token = secret('token');
    rows.set('a', [token]);
    const first = deferred<SecretVariableView[]>();
    const second = deferred<SecretVariableView[]>();
    let count = 0;
    Panel.secretVariables = { describe: () => count++ === 0 ? first.promise : second.promise } as unknown as SecretVariableService;
    panel.sendActiveVarsToWebview();
    panel.sendActiveVarsToWebview();
    second.resolve([{ ...token, secretState: 'set' }]);
    await settle();
    first.reject(new Error('old-keychain-failure'));
    await settle();
    assert.strictEqual(posted.length, 1);
    assert.deepStrictEqual(posted[0].varValues, { token: '[secret]' });
  });

  it('await 중 active environment가 바뀌면 새 publish 호출 없이도 이전 metadata를 버린다', async () => {
    const token = secret('token');
    rows.set('a', [token]);
    const gate = deferred<SecretVariableView[]>();
    Panel.secretVariables = { describe: () => gate.promise } as unknown as SecretVariableService;
    panel.sendActiveVarsToWebview();
    Panel.environmentProvider.activeEnvId = 'b';
    gate.resolve([{ ...token, secretState: 'set' }]);
    await settle();
    assert.deepStrictEqual(posted, []);
  });

  for (const invalidate of ['generation', 'profile', 'dispose'] as const) {
    it(`pending secret metadata는 ${invalidate} 변경 뒤 게시하지 않는다`, async () => {
      const token = secret('token');
      rows.set('a', [token]);
      const gate = deferred<SecretVariableView[]>();
      Panel.secretVariables = { describe: () => gate.promise } as unknown as SecretVariableService;
      panel.sendActiveVarsToWebview();
      if (invalidate === 'generation') { panel.executionGeneration++; }
      else if (invalidate === 'profile') { profile = 'new-profile'; panel.storageProfileName = profile; }
      else { panel.isDisposed = true; }
      gate.resolve([{ ...token, secretState: 'set' }]);
      await settle();
      assert.deepStrictEqual(posted, []);
    });
  }

  it('환경 비활성화의 즉시 빈 상태를 이전 metadata가 되돌리지 않는다', async () => {
    const token = secret('token');
    rows.set('a', [token]);
    const gate = deferred<SecretVariableView[]>();
    Panel.secretVariables = { describe: () => gate.promise } as unknown as SecretVariableService;
    panel.sendActiveVarsToWebview();
    Panel.environmentProvider.activeEnvId = null;
    panel.sendActiveVarsToWebview();
    assert.deepStrictEqual(posted[0].varKeys, []);
    assert.deepStrictEqual(posted[0].varValues, {});
    gate.resolve([{ ...token, secretState: 'set' }]);
    await settle();
    assert.strictEqual(posted.length, 1);
  });
});
