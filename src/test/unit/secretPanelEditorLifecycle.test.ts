import * as assert from 'assert';
import Module = require('module');
import { Environment, KeyValue, MessageType } from '../../models/types';
import type { RequestPanel } from '../../panels/RequestPanel';
import type { StorageService } from '../../services/StorageService';
import type { EnvironmentTreeProvider } from '../../providers/EnvironmentTreeProvider';

interface EditorLifecyclePanel {
  editingVariableScope: string | null | undefined;
  editorLoadSequence: number;
  loadEnvironment(environment: Environment, reveal?: boolean): Promise<void>;
  loadWorkspaceVariables(reveal?: boolean): Promise<void>;
  updateActiveEnv(name: string | null): Promise<void>;
  variablesChanged(environmentId: string | null): void;
  invalidateExecutions(): void;
}

interface Description {
  environmentId: string | null;
  preserveCurrentToken: boolean;
  resolve(data: { variables: KeyValue[]; scopeToken: string }): void;
}

const environment = (id: string): Environment => ({ id, name: id.toUpperCase(), variables: [] });

describe('RequestPanel secret editor async lifecycle', () => {
  let Panel: typeof RequestPanel;
  let panel: EditorLifecyclePanel;
  let posted: any[];
  let calls: Description[];
  let activeVariablesNotifications: number;
  let refreshes: number;
  let invalidations: number;
  let originalStorage: StorageService;
  let originalProvider: EnvironmentTreeProvider;
  let originalModule: NodeModule | undefined;

  beforeEach(() => {
    posted = []; calls = []; activeVariablesNotifications = 0; refreshes = 0; invalidations = 0;
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    const originalLoad = loader._load;
    loader._load = function(request: unknown, ...args: unknown[]): unknown {
      if (request === 'vscode') {
        return {
          workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
          window: { showErrorMessage: (error: string) => { throw new Error(error); } },
        };
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
    Panel.storage = {
      getWorkspaceProfileName: () => 'fixture',
      getEnvironments: () => [environment('a'), environment('b'), environment('c')],
    } as unknown as StorageService;
    Panel.environmentProvider = {
      activeEnvId: 'a', refresh: () => { refreshes++; },
    } as unknown as EnvironmentTreeProvider;
    panel = Object.assign(Object.create(Panel.prototype), {
      editingVariableScope: undefined, editorLoadSequence: 0,
      executionGeneration: 0, isDisposed: false, storageProfileName: 'fixture',
      pendingFlushResolvers: new Map(), pendingWebviewMessages: [],
      requestExecutor: { cancelAll() {} }, collectionRunner: { reset() {} }, webSocketManager: { disconnectAll() {} },
      secretEditor: {
        data: (environmentId: string | null, preserveCurrentToken = false) => new Promise<{ variables: KeyValue[]; scopeToken: string }>((resolve) => {
          calls.push({ environmentId, preserveCurrentToken, resolve });
        }),
        invalidate: () => { invalidations++; },
      },
      postMessage: (message: unknown) => posted.push(message),
      sendActiveVarsToWebview: () => { activeVariablesNotifications++; },
    });
  });

  afterEach(() => {
    Panel.storage = originalStorage;
    Panel.environmentProvider = originalProvider;
    const modulePath = require.resolve('../../panels/RequestPanel');
    if (originalModule) { require.cache[modulePath] = originalModule; }
    else { delete require.cache[modulePath]; }
  });

  function release(index: number, token = `token-${index}`) {
    const variable: KeyValue = { key: `variable-${index}`, value: '', enabled: true,
      id: '11111111-1111-4111-8111-111111111111', secretRef: { id: '22222222-2222-4222-8222-222222222222' } };
    calls[index].resolve({ variables: [variable], scopeToken: token });
  }

  async function settle() { for (let index = 0; index < 8; index++) { await Promise.resolve(); } }

  it('A의 느린 키체인 metadata가 빠르게 끝난 B의 active environment를 덮어쓰지 않는다', async () => {
    const first = panel.updateActiveEnv('A');
    Panel.environmentProvider.activeEnvId = 'b';
    const second = panel.updateActiveEnv('B');
    release(1, 'scope-b');
    await second;
    release(0, 'scope-a');
    await first;
    const activeMessages = posted.filter((message) => message.type === MessageType.UpdateActiveEnv && Array.isArray(message.variables));
    assert.strictEqual(activeMessages.length, 1);
    assert.strictEqual(activeMessages[0].envId, 'b');
    assert.strictEqual(activeMessages[0].envName, 'B');
    assert.strictEqual(activeMessages[0].scopeToken, 'scope-b');
    assert.strictEqual(activeMessages[0].variables[0].secretRef.id, '22222222-2222-4222-8222-222222222222');
    assert.strictEqual(activeVariablesNotifications, 2);
  });

  it('metadata await 중 activeEnvId가 바뀌면 이전 선택을 게시하지 않는다', async () => {
    const pending = panel.updateActiveEnv('A');
    Panel.environmentProvider.activeEnvId = 'b';
    release(0);
    await pending;
    assert.strictEqual(posted.some((message) => Array.isArray(message.variables) || message.scopeToken), false);
    assert.strictEqual(activeVariablesNotifications, 1);
  });

  it('환경 비활성화 뒤 이전 키체인 metadata가 늦게 와도 비활성화를 되돌리지 않는다', async () => {
    const pending = panel.updateActiveEnv('A');
    Panel.environmentProvider.activeEnvId = null;
    await panel.updateActiveEnv(null);
    const before = posted.length;
    release(0);
    await pending;
    assert.strictEqual(posted.length, before);
    assert.strictEqual(posted.at(-1).type, MessageType.UpdateActiveEnv);
    assert.strictEqual(posted.at(-1).envId, null);
    assert.deepStrictEqual(posted.at(-1).variables, []);
  });

  it('수동 A 편집기 로드가 느려도 나중에 선택한 B 편집기만 표시한다', async () => {
    const first = panel.loadEnvironment(environment('a'));
    const second = panel.loadEnvironment(environment('b'));
    release(1, 'scope-b');
    await second;
    release(0, 'scope-a');
    await first;
    const loads = posted.filter((message) => message.type === MessageType.LoadEnvironment);
    assert.strictEqual(loads.length, 1);
    assert.strictEqual(loads[0].envId, 'b');
    assert.strictEqual(loads[0].scopeToken, 'scope-b');
    assert.strictEqual(panel.editingVariableScope, 'b');
  });

  it('환경 metadata가 늦게 도착해도 나중에 연 workspace 편집기를 덮어쓰지 않는다', async () => {
    const first = panel.loadEnvironment(environment('a'));
    const workspace = panel.loadWorkspaceVariables();
    release(1, 'scope-workspace');
    await workspace;
    release(0);
    await first;
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].type, 'loadWorkspaceVariables');
    assert.strictEqual(posted[0].scopeToken, 'scope-workspace');
    assert.strictEqual(panel.editingVariableScope, null);
  });

  it('workspace metadata가 늦게 도착해도 나중에 연 환경 편집기를 덮어쓰지 않는다', async () => {
    const workspace = panel.loadWorkspaceVariables();
    const environmentLoad = panel.loadEnvironment(environment('b'));
    release(1, 'scope-b');
    await environmentLoad;
    release(0);
    await workspace;
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].type, MessageType.LoadEnvironment);
    assert.strictEqual(posted[0].envId, 'b');
    assert.strictEqual(panel.editingVariableScope, 'b');
  });

  it('활성 환경 표시/치환 정보는 keychain과 수동 편집기 열기에 가로막히지 않는다', async () => {
    Panel.environmentProvider.activeEnvId = 'b';
    const selection = panel.updateActiveEnv('B');
    assert.strictEqual(posted[0].type, MessageType.UpdateActiveEnv);
    assert.strictEqual(posted[0].envName, 'B');
    assert.strictEqual(activeVariablesNotifications, 1);
    const manual = panel.loadEnvironment(environment('c'));
    release(1, 'scope-c');
    await manual;
    const before = posted.length;
    release(0, 'old-active-b');
    await selection;
    assert.strictEqual(posted.length, before);
    assert.strictEqual(posted.at(-1).type, MessageType.LoadEnvironment);
    assert.strictEqual(posted.at(-1).envId, 'c');
    assert.strictEqual(panel.editingVariableScope, 'c');
  });

  it('예전 환경의 mutation 완료는 현재 다른 환경 편집기를 자동으로 다시 열지 않는다', async () => {
    const current = panel.loadEnvironment(environment('b'));
    release(0);
    await current;
    const beforeCalls = calls.length;
    const beforeMessages = posted.length;
    panel.variablesChanged('a');
    await settle();
    assert.strictEqual(calls.length, beforeCalls);
    assert.strictEqual(posted.length, beforeMessages);
    assert.strictEqual(panel.editingVariableScope, 'b');
    assert.strictEqual(refreshes, 1);
  });

  it('예전 환경 mutation 완료는 현재 workspace 편집기를 덮어쓰지 않는다', async () => {
    const workspace = panel.loadWorkspaceVariables();
    release(0);
    await workspace;
    panel.variablesChanged('a');
    await settle();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].type, 'loadWorkspaceVariables');
  });

  it('예전 workspace mutation 완료는 현재 환경 편집기를 덮어쓰지 않는다', async () => {
    const current = panel.loadEnvironment(environment('b'));
    release(0);
    await current;
    panel.variablesChanged(null);
    await settle();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].envId, 'b');
  });

  it('mutation refresh가 이미 기다리는 동안 편집기를 바꾸면 늦은 refresh를 버린다', async () => {
    const current = panel.loadEnvironment(environment('a'));
    release(0);
    await current;
    panel.variablesChanged('a');
    assert.strictEqual(calls[1].preserveCurrentToken, true);
    const next = panel.loadEnvironment(environment('b'));
    release(2, 'scope-b');
    await next;
    const before = posted.length;
    release(1, 'stale-refresh');
    await settle();
    assert.strictEqual(posted.length, before);
    assert.strictEqual(posted.at(-1).envId, 'b');
  });

  it('같은 workspace 편집기 refresh는 preserveCurrentToken으로 요청한다', async () => {
    const current = panel.loadWorkspaceVariables();
    release(0);
    await current;
    panel.variablesChanged(null);
    assert.strictEqual(calls[1].environmentId, null);
    assert.strictEqual(calls[1].preserveCurrentToken, true);
    release(1, 'refreshed-workspace');
    await settle();
    assert.strictEqual(posted.at(-1).type, 'loadWorkspaceVariables');
    assert.strictEqual(posted.at(-1).reveal, false);
  });

  it('프로필/패널 무효화는 pending 환경/workspace metadata와 scope token을 폐기한다', async () => {
    for (const target of ['environment', 'workspace']) {
      const pending = target === 'environment' ? panel.loadEnvironment(environment('a')) : panel.loadWorkspaceVariables();
      const index = calls.length - 1;
      panel.invalidateExecutions();
      release(index, 'old-profile-scope');
      await pending;
      assert.deepStrictEqual(posted, []);
      assert.strictEqual(panel.editingVariableScope, undefined);
    }
    assert.strictEqual(invalidations, 2);
  });
});
