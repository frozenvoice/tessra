import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Module = require('module');
import { KeyValue, MessageType, Response, SendRequestMessage } from '../../models/types';
import type { ExecutionContext } from '../../panels/requestPanel/executionContext';
import type { RequestExecutorHost } from '../../panels/requestPanel/RequestExecutor';
import { RequestBodyService } from '../../services/RequestBodyService';

const kv = (key: string, value: string): KeyValue => ({ key, value, enabled: true });
const okResponse: Response = { status: 200, statusText: 'OK', headers: {}, body: '{}', time: 1, size: 2 };

describe('실행 컨텍스트와 저장소 통합', () => {
  let root: string;
  let profile: string;
  let envId: string;
  let warnings: string[];
  let storage: import('../../services/StorageService').StorageService;
  let executor: import('../../panels/requestPanel/RequestExecutor').RequestExecutor;
  let host: RequestExecutorHost;
  let posted: Array<{ type?: string }>;
  let sends: number;
  let resolveResponse: (response: Response) => void;
  let invalidate: () => void;
  let dispose: () => void;
  let writes: number;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-execution-context-'));
    profile = 'default'; envId = 'a'; warnings = []; posted = []; sends = 0; writes = 0;
    const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
    (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function(name: unknown, ...args: unknown[]) {
      if (name === 'vscode') {
        return { workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
          window: { showWarningMessage: (message: string) => warnings.push(message), setStatusBarMessage: () => undefined } };
      }
      return originalLoad.apply(this, [name, ...args]);
    };
    // 실제 패널 저장 메서드의 vscode 바인딩만 테스트용으로 제공한다.
    delete require.cache[require.resolve('../../panels/RequestPanel')];
    let Panel: typeof import('../../panels/RequestPanel').RequestPanel;
    let Executor: typeof import('../../panels/requestPanel/RequestExecutor').RequestExecutor;
    try {
      const Storage = require('../../services/StorageService').StorageService as typeof import('../../services/StorageService').StorageService;
      Panel = require('../../panels/RequestPanel').RequestPanel;
      Executor = require('../../panels/requestPanel/RequestExecutor').RequestExecutor;
      storage = new Storage({ globalStorageUri: { fsPath: root } } as never);
    } finally { (Module as unknown as { _load: unknown })._load = originalLoad; }
    storage.getWorkspaceProfileName = () => profile;
    storage.saveEnvironments([{ id: 'a', name: 'A', variables: [kv('value', 'A'), kv('keep', 'old')] },
      { id: 'b', name: 'B', variables: [kv('value', 'B')] }]);
    const saveEnvironments = storage.saveEnvironments.bind(storage);
    storage.saveEnvironments = (values) => { writes++; saveEnvironments(values); };
    Panel!.storage = storage;
    Panel!.environmentProvider = { get activeEnvId() { return envId; }, refresh() {} } as never;
    Panel!.historyProvider = { refresh() {} } as never;
    const panel = Object.create(Panel!.prototype) as {
      storageProfileName: string; executionGeneration: number; isDisposed: boolean;
      sendActiveVarsToWebview(): void; captureExecutionContext(): ExecutionContext;
      isExecutionContextCurrent(context: ExecutionContext): boolean;
      saveEnvironmentChanges(context: ExecutionContext, before: KeyValue[], after: KeyValue[]): void;
      saveToHistory: RequestExecutorHost['saveToHistory']; invalidateExecutions(): void;
      requestExecutor: typeof executor; collectionRunner: { reset(): void }; webSocketManager: { disconnectAll(): void };
      pendingFlushResolvers: Map<string, (error?: Error) => void>;
    };
    Object.assign(panel, { storageProfileName: profile, executionGeneration: 0, isDisposed: false,
      sendActiveVarsToWebview() {}, collectionRunner: { reset() {} }, webSocketManager: { disconnectAll() {} }, secretEditor: { invalidate() {} }, pendingFlushResolvers: new Map() });
    host = {
      captureExecutionContext: () => panel.captureExecutionContext(),
      isExecutionContextCurrent: context => panel.isExecutionContextCurrent(context),
      postMessage: message => posted.push(message as { type?: string }),
      getActiveVariables: () => storage.getEnvironment(envId)?.variables ?? [], getDefaultHeaders: () => [],
      getAllowInsecureCertificates: () => false, getScriptTimeoutMs: () => 100,
      saveEnvironmentChanges: (context, before, after) => panel.saveEnvironmentChanges(context, before, after),
      saveToHistory: (request, response, timing, context) => {
        if (panel.isExecutionContextCurrent(context)) { panel.saveToHistory(request, response, timing, context); }
      }, refreshHistory() {},
    };
    executor = new Executor!({ send: () => {
      sends++;
      return { promise: new Promise<Response>(resolve => { resolveResponse = resolve; }), abort() {} };
    } } as never, host);
    panel.requestExecutor = executor;
    invalidate = () => panel.invalidateExecutions();
    dispose = () => { panel.isDisposed = true; panel.invalidateExecutions(); };
  });

  afterEach(() => { executor.cancelAll(); fs.rmSync(root, { recursive: true, force: true }); });

  function send(overrides: Partial<SendRequestMessage> = {}) {
    return executor.execute({ type: MessageType.SendRequest, tabId: 'tab', method: 'GET', url: 'http://127.0.0.1/fixture',
      headers: [], params: [], body: '', bodyType: 'none', auth: { type: 'none' }, ...overrides });
  }

  async function waitForSend() {
    for (let attempts = 0; sends === 0 && attempts < 100; attempts++) { await new Promise(resolve => setImmediate(resolve)); }
    assert.strictEqual(sends, 1);
  }

  it('스크립트 없는 요청은 환경을 쓰지 않고, 전환한 B 환경도 보존한다', async () => {
    const pending = send(); await waitForSend(); envId = 'b'; resolveResponse(okResponse); await pending;
    assert.strictEqual(writes, 0);
    assert.deepStrictEqual(storage.getEnvironment('b')?.variables, [kv('value', 'B')]);
  });

  it('손상된 history 저장은 건너뛰고 성공한 HTTP 응답은 그대로 표시한다', async () => {
    const historyPath = path.join(root, 'history.json');
    const original = '[{"id":"broken"}]';
    fs.writeFileSync(historyPath, original, 'utf8');
    const pending = send(); await waitForSend(); resolveResponse(okResponse); await pending;
    assert.strictEqual(fs.readFileSync(historyPath, 'utf8'), original);
    assert.strictEqual(posted.filter(message => message.type === MessageType.ReceiveResponse).length, 1);
    assert.strictEqual(posted.filter(message => message.type === MessageType.ResponseError).length, 0);
    assert.strictEqual(fs.readdirSync(root).filter(name => name.startsWith('history.json.corrupt-')).length, 1);
  });

  it('스크립트 set/unset은 시작 환경에만 적용하고 무관한 사용자 편집을 보존한다', async () => {
    const pending = send({ scripts: { preRequest: '', test: 'pm.environment.unset("value"); pm.environment.set("created", "script");' } });
    await waitForSend();
    storage.updateEnvironmentVars('a', [kv('value', 'A'), kv('keep', 'edited')]); envId = 'b';
    resolveResponse(okResponse); await pending;
    assert.deepStrictEqual(storage.getEnvironment('a')?.variables, [kv('keep', 'edited'), kv('created', 'script')]);
    assert.deepStrictEqual(storage.getEnvironment('b')?.variables, [kv('value', 'B')]);
  });

  it('같은 키의 동시 편집은 현재 값을 보존하고 충돌을 알린다', async () => {
    const pending = send({ scripts: { preRequest: '', test: 'pm.environment.set("value", "script"); pm.environment.unset("keep");' } });
    await waitForSend(); storage.updateEnvironmentVars('a', [kv('value', 'user'), kv('keep', 'user')]);
    const writesBeforeResponse = writes;
    resolveResponse(okResponse); await pending;
    assert.strictEqual(writes, writesBeforeResponse);
    assert.deepStrictEqual(storage.getEnvironment('a')?.variables, [kv('value', 'user'), kv('keep', 'user')]);
    assert.strictEqual(warnings.length, 1);
  });

  it('프로필 전환 뒤 늦은 응답은 새 환경·히스토리·화면을 바꾸지 않는다', async () => {
    const pending = send({ scripts: { preRequest: '', test: 'pm.environment.set("value", "late");' } });
    await waitForSend(); profile = 'next';
    storage.saveEnvironments([{ id: 'a', name: 'Same ID', variables: [kv('value', 'NEW')] }]);
    invalidate(); const writesBeforeResponse = writes;
    resolveResponse(okResponse); await pending;
    assert.strictEqual(writes, writesBeforeResponse);
    assert.deepStrictEqual(storage.getEnvironment('a')?.variables, [kv('value', 'NEW')]);
    assert.deepStrictEqual(storage.getHistory(), []);
    assert.deepStrictEqual(posted, []);
  });

  it('패널 종료 뒤 늦게 도착한 응답도 저장하거나 표시하지 않는다', async () => {
    const pending = send(); await waitForSend(); dispose(); resolveResponse(okResponse); await pending;
    assert.deepStrictEqual(storage.getHistory(), []); assert.deepStrictEqual(posted, []);
  });

  it('Body 준비 중 Stop 후 준비가 완료되어도 전송 횟수는 0이다', async () => {
    const original = RequestBodyService.prepare;
    let finish: () => void = () => {};
    const prepared = await original.call(RequestBodyService, { bodyType: 'none', body: '', formData: [], binaryFilePath: '', headers: [], vars: [] });
    RequestBodyService.prepare = () => new Promise(resolve => { finish = () => resolve(prepared); });
    try {
      const pending = send(); executor.cancel('tab'); finish(); await pending;
      assert.strictEqual(sends, 0); assert.deepStrictEqual(storage.getHistory(), []);
      assert.strictEqual(posted.filter(message => message.type === MessageType.RequestCanceled).length, 1);
    } finally { RequestBodyService.prepare = original; }
  });
});
