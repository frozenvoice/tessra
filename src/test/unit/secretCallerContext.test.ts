import * as assert from 'assert';
import Module = require('module');
import { HttpService, HttpSendOptions, SendHandle } from '../../services/HttpService';
import { KeyValue, MessageType, Request, Response, SendRequestMessage } from '../../models/types';
import { SecretRedactor } from '../../services/secretVariables';
import type { RequestExecutor, RequestExecutorHost } from '../../panels/requestPanel/RequestExecutor';
import type { CollectionRunner, CollectionRunnerHost } from '../../panels/requestPanel/CollectionRunner';

let RequestExecutorCtor: typeof import('../../panels/requestPanel/RequestExecutor').RequestExecutor;
let CollectionRunnerCtor: typeof import('../../panels/requestPanel/CollectionRunner').CollectionRunner;

before(() => {
  const moduleHost = Module as unknown as { _load: (...args: unknown[]) => unknown };
  const originalLoad = moduleHost._load;
  moduleHost._load = function(request: unknown, ...args: unknown[]): unknown {
    if (request === 'vscode') {
      return { workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) } };
    }
    return originalLoad.apply(this, [request, ...args]);
  };
  try {
    RequestExecutorCtor = require('../../panels/requestPanel/RequestExecutor').RequestExecutor;
    CollectionRunnerCtor = require('../../panels/requestPanel/CollectionRunner').CollectionRunner;
  } finally { moduleHost._load = originalLoad; }
});

class CapturingHttpService {
  sent: Array<{ url: string; headers: KeyValue[] }> = [];
  send(_method: string, url: string, headers: KeyValue[], _body: unknown, _options: HttpSendOptions): SendHandle {
    this.sent.push({ url, headers: headers.map((header) => ({ ...header })) });
    const response: Response = { status: 200, statusText: 'OK', headers: {}, body: '{}', size: 2, time: 1 };
    return { promise: Promise.resolve(response), abort: () => undefined };
  }
}

function hostFixture() {
  const posted: any[] = [];
  const histories: Request[] = [];
  const host: RequestExecutorHost & CollectionRunnerHost = {
    captureExecutionContext: () => ({ profileName: 'fixture', environmentId: 'env-1', generation: 0 }),
    isExecutionContextCurrent: () => true,
    postMessage: (message) => posted.push(message),
    getActiveVariables: () => [],
    getDefaultHeaders: () => [],
    getAllowInsecureCertificates: () => false,
    getScriptTimeoutMs: () => 100,
    saveEnvironmentChanges: () => undefined,
    saveToHistory: (request) => histories.push(request),
    refreshHistory: () => undefined,
  };
  return { host, posted, histories };
}

function message(): SendRequestMessage {
  return {
    type: MessageType.SendRequest, tabId: 'secret-fixture', method: 'GET', url: 'http://fixture.local/',
    headers: [], params: [], body: '', bodyType: 'none', auth: { type: 'none' }, saveToHistory: true, disableScripts: true,
  };
}

function request(): Request {
  const { type: _type, tabId: _tabId, ...settings } = message();
  return { id: 'fixture-request', name: 'Fixture', ...settings };
}

describe('Secret caller context snapshots', () => {
  for (const caller of ['executor', 'runner'] as const) {
    it(`${caller}: 키체인 await 중 바뀐 default headers를 같은 실행에 섞지 않는다`, async () => {
      const service = new CapturingHttpService();
      const { host, histories } = hostFixture();
      const defaults: KeyValue[] = [{ key: 'X-Fixture', value: '{{token}}', enabled: true }];
      host.getDefaultHeaders = () => defaults;
      host.getActiveVariables = () => [{ key: 'token', value: '', enabled: true }];
      let lookedUpTexts: string[] = [];
      host.resolveSecretVariables = async (_context, _variables, texts) => {
        lookedUpTexts = texts;
        await Promise.resolve();
        defaults[0].value = 'changed-after-capture';
        defaults.push({ key: 'X-New', value: 'new-context', enabled: true });
        return { variables: [{ key: 'token', value: 'synthetic-private', enabled: true }], redactor: new SecretRedactor([{ key: 'token', value: 'synthetic-private' }]) };
      };
      if (caller === 'executor') {
        const executor: RequestExecutor = new RequestExecutorCtor(service as unknown as HttpService, host);
        await executor.execute(message());
      } else {
        const runner: CollectionRunner = new CollectionRunnerCtor(service as unknown as HttpService, host);
        await runner.runCollection('Fixture', [{ id: 'entry', type: 'request', name: 'Fixture', request: request() }]);
      }
      assert.ok(lookedUpTexts.includes('{{token}}'));
      assert.strictEqual(service.sent[0].headers.find((row) => row.key === 'X-Fixture')?.value, 'synthetic-private');
      assert.strictEqual(service.sent[0].headers.some((row) => row.key === 'X-New'), false);
      assert.strictEqual(histories.length, 1);
      assert.strictEqual(histories[0].headers[0].value, '{{token}}');
      assert.strictEqual(JSON.stringify(histories).includes('synthetic-private'), false);
    });
  }

  it('Basic의 합성 credential은 실제 전송하고 앱 요청 metadata에서는 전체를 마스킹한다', async () => {
    const service = new CapturingHttpService();
    const { host, posted, histories } = hostFixture();
    const secret = 'synthetic-basic-password';
    const encoded = Buffer.from(`user:${secret}`).toString('base64');
    host.getActiveVariables = () => [{ key: 'password', value: '', enabled: true }];
    host.resolveSecretVariables = async () => ({ variables: [{ key: 'password', value: secret, enabled: true }], redactor: new SecretRedactor([{ key: 'password', value: secret }]) });
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);
    await executor.execute({ ...message(), auth: { type: 'basic', basic: { username: 'user', password: '{{password}}' } } });
    assert.strictEqual(service.sent[0].headers.find((row) => row.key === 'Authorization')?.value, `Basic ${encoded}`);
    const receive = posted.find((item) => item.type === MessageType.ReceiveResponse);
    assert.strictEqual(receive.resolvedHeaders.find((row: { key: string }) => row.key === 'Authorization')?.value, 'Basic [secret]');
    assert.strictEqual(JSON.stringify(posted).includes(encoded), false);
    assert.strictEqual(JSON.stringify(histories).includes(encoded), false);
    assert.strictEqual(histories[0].auth.basic?.password, '{{password}}');
  });

  it('키체인 await 중 Stop은 한 번만 알리고 네트워크/히스토리를 시작하지 않는다', async () => {
    const service = new CapturingHttpService();
    const { host, posted, histories } = hostFixture();
    let release!: () => void;
    host.resolveSecretVariables = async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { variables: [], redactor: new SecretRedactor([]) };
    };
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);
    const pending = executor.execute(message());
    executor.cancel('secret-fixture');
    executor.cancel('secret-fixture');
    release();
    await pending;
    assert.strictEqual(posted.filter((item) => item.type === MessageType.RequestCanceled).length, 1);
    assert.strictEqual(posted.filter((item) => item.type === MessageType.ResponseError).length, 0);
    assert.strictEqual(service.sent.length, 0);
    assert.strictEqual(histories.length, 0);
  });

  it('키체인 await 중 프로필 세대가 바뀌면 이전 메시지/네트워크/히스토리를 폐기한다', async () => {
    const service = new CapturingHttpService();
    const { host, posted, histories } = hostFixture();
    let current = true;
    let release!: () => void;
    host.isExecutionContextCurrent = () => current;
    host.resolveSecretVariables = async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return { variables: [], redactor: new SecretRedactor([]) };
    };
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);
    const pending = executor.execute(message());
    current = false;
    executor.cancelAll();
    release();
    await pending;
    assert.deepStrictEqual(posted, []);
    assert.strictEqual(service.sent.length, 0);
    assert.strictEqual(histories.length, 0);
  });
});
