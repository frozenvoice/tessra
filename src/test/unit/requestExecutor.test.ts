import * as assert from 'assert';
import Module = require('module');
import { HttpService, SendHandle } from '../../services/HttpService';
import { MessageType, Response, SendRequestMessage } from '../../models/types';
import type { RequestExecutor, RequestExecutorHost } from '../../panels/requestPanel/RequestExecutor';

let RequestExecutorCtor: new (
  httpService: HttpService,
  host: RequestExecutorHost
) => RequestExecutor;
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
      };
    }
    return originalLoad.apply(this, [request, ...args]);
  };
  restoreModuleLoad = () => {
    (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad;
  };
  RequestExecutorCtor = require('../../panels/requestPanel/RequestExecutor').RequestExecutor;
});

after(() => {
  restoreModuleLoad?.();
});

class DeferredHandle implements SendHandle {
  promise: Promise<Response>;
  aborted = false;
  rejectOnAbort = true;
  private resolvePromise!: (response: Response) => void;
  private rejectPromise!: (error: Error) => void;

  constructor() {
    this.promise = new Promise<Response>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
  }

  abort(): void {
    this.aborted = true;
    if (!this.rejectOnAbort) { return; }
    this.rejectCanceled();
  }

  rejectCanceled(): void {
    this.rejectPromise(new Error('Request was canceled'));
  }

  resolve(response: Response): void {
    this.resolvePromise(response);
  }
}

class FakeHttpService {
  readonly handles: DeferredHandle[] = [];
  readonly sent: Array<{ method: string; url: string }> = [];

  send(method: string, url: string): SendHandle {
    this.sent.push({ method, url });
    const handle = new DeferredHandle();
    this.handles.push(handle);
    return handle;
  }
}

function createHost() {
  const posted: any[] = [];
  const host: RequestExecutorHost = {
    captureExecutionContext: () => ({ profileName: 'default', environmentId: null, generation: 0 }),
    isExecutionContextCurrent: () => true,
    postMessage: (message) => posted.push(message),
    getActiveVariables: () => [],
    getDefaultHeaders: () => [],
    getAllowInsecureCertificates: () => false,
    getScriptTimeoutMs: () => 3000,
    saveEnvironmentChanges: () => undefined,
    saveToHistory: () => undefined,
    refreshHistory: () => undefined,
  };
  return { host, posted };
}

function createMessage(tabId = 'tab-1'): SendRequestMessage {
  return {
    type: MessageType.SendRequest,
    tabId,
    method: 'GET',
    url: 'https://api.example.com/data',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none',
    auth: { type: 'none' },
    saveToHistory: false,
  };
}

async function waitForHandle(service: FakeHttpService, index: number): Promise<DeferredHandle> {
  const startedAt = Date.now();
  while (!service.handles[index]) {
    if (Date.now() - startedAt > 1000) {
      throw new Error(`Timed out waiting for request handle ${index}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return service.handles[index];
}

describe('RequestExecutor query URL building', () => {
  it('does not duplicate mirrored URL query params in the HTTP request URL or resolved display', async () => {
    const service = new FakeHttpService();
    const { host, posted } = createHost();
    host.getActiveVariables = () => [
      { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true },
    ];
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);

    const executePromise = executor.execute({
      ...createMessage(),
      url: '{{baseUrl}}/posts?userId=1',
      params: [{ key: 'userId', value: '1', enabled: true }],
    });
    const handle = await waitForHandle(service, 0);
    handle.resolve({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      time: 1,
      size: 2,
    });
    await executePromise;

    assert.strictEqual(service.sent[0]?.url, 'https://jsonplaceholder.typicode.com/posts?userId=1');
    const responseMessage = posted.find((message) => message.type === MessageType.ReceiveResponse);
    assert.strictEqual(responseMessage?.resolvedUrl, 'https://jsonplaceholder.typicode.com/posts?userId=1');
  });

  it('removes disabled mirrored params from the actual request URL', async () => {
    const service = new FakeHttpService();
    const { host, posted } = createHost();
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);

    const executePromise = executor.execute({
      ...createMessage(),
      url: 'https://api.example.com/posts?userId=1&page=2',
      params: [
        { key: 'userId', value: '1', enabled: false },
        { key: 'page', value: '2', enabled: true },
      ],
    });
    const handle = await waitForHandle(service, 0);
    handle.resolve({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
      time: 1,
      size: 2,
    });
    await executePromise;

    assert.strictEqual(service.sent[0]?.url, 'https://api.example.com/posts?page=2');
    const responseMessage = posted.find((message) => message.type === MessageType.ReceiveResponse);
    assert.strictEqual(responseMessage?.resolvedUrl, 'https://api.example.com/posts?page=2');
  });
});

describe('RequestExecutor cancel handling', () => {
  it('aborts the active HTTP request and posts a canceled message', async () => {
    const service = new FakeHttpService();
    const { host, posted } = createHost();
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);

    const executePromise = executor.execute(createMessage());
    const handle = await waitForHandle(service, 0);

    executor.cancel('tab-1');
    await executePromise;

    assert.strictEqual(handle.aborted, true);
    assert.ok(posted.some((message) =>
      message.type === MessageType.RequestCanceled && message.tabId === 'tab-1'
    ));
  });

  it('does not let an old canceled run clear or overwrite a newer run on the same tab', async () => {
    const service = new FakeHttpService();
    const { host, posted } = createHost();
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);

    const firstRun = executor.execute(createMessage());
    const firstHandle = await waitForHandle(service, 0);
    firstHandle.rejectOnAbort = false;
    executor.cancel('tab-1');

    const secondRun = executor.execute(createMessage());
    const secondHandle = await waitForHandle(service, 1);
    firstHandle.rejectCanceled();
    await firstRun;

    executor.cancel('tab-1');
    await secondRun;

    assert.strictEqual(firstHandle.aborted, true);
    assert.strictEqual(secondHandle.aborted, true);
    assert.strictEqual(
      posted.filter((message) => message.type === MessageType.RequestCanceled && message.tabId === 'tab-1').length,
      1
    );
    assert.strictEqual(
      posted.some((message) => message.type === MessageType.ReceiveResponse),
      false
    );
  });
});
