import * as assert from 'assert';
import Module = require('module');
import { HttpService, HttpSendOptions, SendHandle } from '../../services/HttpService';
import { performance } from 'perf_hooks';
import { RequestDeadline, RequestTimeoutError } from '../../services/RequestDeadline';
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

  reject(error: Error): void {
    this.rejectPromise(error);
  }
}

class FakeHttpService {
  readonly handles: DeferredHandle[] = [];
  readonly sent: Array<{ method: string; url: string; options: HttpSendOptions }> = [];
  onSend?: (handle: DeferredHandle, options: HttpSendOptions, index: number) => void;

  send(method: string, url: string, _headers: unknown, _body: unknown, options: HttpSendOptions): SendHandle {
    this.sent.push({ method, url, options });
    const handle = new DeferredHandle();
    this.handles.push(handle);
    this.onSend?.(handle, options, this.handles.length - 1);
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

const successfulResponse: Response = {
  status: 200, statusText: 'OK', headers: {}, body: '{}', time: 1, size: 2,
};

async function withNetworkClock(run: (advance: (ms: number) => void, delays: number[]) => Promise<void>): Promise<void> {
  let now = 0;
  const ownNow = Object.getOwnPropertyDescriptor(performance, 'now');
  const utils = require('../../panels/requestPanel/requestUtils') as typeof import('../../panels/requestPanel/requestUtils');
  const originalDelay = utils.createCancelableDelay;
  const delays: number[] = [];
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  utils.createCancelableDelay = async (ms) => { delays.push(ms); now += Math.trunc(ms); };
  try {
    await run((ms) => { now += ms; }, delays);
  } finally {
    utils.createCancelableDelay = originalDelay;
    if (ownNow) { Object.defineProperty(performance, 'now', ownNow); }
    else { Reflect.deleteProperty(performance, 'now'); }
  }
}

describe('RequestDeadline', () => {
  it('expires exactly at zero remaining time and keeps zero timeout unlimited', () => {
    let now = 10;
    const deadline = new RequestDeadline(1, () => now);
    now = 1009.5;
    assert.strictEqual(deadline.remainingMs(), 0.5);
    assert.doesNotThrow(() => deadline.throwIfExpired());
    now = 1010;
    assert.strictEqual(deadline.remainingMs(), 0);
    assert.throws(() => deadline.throwIfExpired(), RequestTimeoutError);
    const unlimited = new RequestDeadline(0, () => now);
    now = Number.MAX_SAFE_INTEGER;
    assert.strictEqual(unlimited.remainingMs(), Infinity);
    assert.doesNotThrow(() => unlimited.throwIfExpired());
  });
});

describe('RequestExecutor shared network budget', () => {
  it('passes one deadline through retries and spends retry backoff from that deadline', async () => {
    await withNetworkClock(async (advance, delays) => {
      const service = new FakeHttpService();
      const { host, posted } = createHost();
      service.onSend = (handle, options, index) => {
        assert.ok(options.deadline);
        if (index === 0) {
          assert.strictEqual(options.deadline.remainingMs(), 1000);
          advance(100);
          handle.resolve({ ...successfulResponse, status: 503 });
        } else {
          assert.strictEqual(options.deadline, service.sent[0].options.deadline);
          assert.strictEqual(options.deadline.remainingMs(), 700);
          handle.resolve(successfulResponse);
        }
      };
      await new RequestExecutorCtor(service as unknown as HttpService, host)
        .execute({ ...createMessage(), timeout: 1, retryCount: 1, retryDelayMs: 200 });
      assert.deepStrictEqual(delays, [200]);
      assert.strictEqual(service.sent.length, 2);
      assert.strictEqual(posted.filter((message) => message.type === MessageType.ReceiveResponse).length, 1);
    });
  });

  for (const failure of ['network', 'status'] as const) {
    it(`caps ${failure} retry backoff and sends no attempt after budget expiry`, async () => {
      await withNetworkClock(async (advance, delays) => {
        const service = new FakeHttpService();
        const { host, posted } = createHost();
        service.onSend = (handle) => {
          advance(900);
          if (failure === 'network') { handle.reject(new Error('ECONNRESET')); }
          else { handle.resolve({ ...successfulResponse, status: 503 }); }
        };
        await new RequestExecutorCtor(service as unknown as HttpService, host)
          .execute({ ...createMessage(), timeout: 1, retryCount: 5, retryDelayMs: 5000 });
        assert.deepStrictEqual(delays, [100]);
        assert.strictEqual(service.sent.length, 1);
        assert.strictEqual(posted.filter((message) => message.type === MessageType.ReceiveResponse).length, 0);
        assert.match(posted.find((message) => message.type === MessageType.ResponseError)?.error, /Request timed out \(1s\)/);
      });
    });
  }

  it('treats a typed timeout as terminal even before the caller clock reaches its boundary', async () => {
    await withNetworkClock(async (_advance, delays) => {
      const service = new FakeHttpService();
      const { host, posted } = createHost();
      service.onSend = (handle) => handle.reject(new RequestTimeoutError(1));
      await new RequestExecutorCtor(service as unknown as HttpService, host)
        .execute({ ...createMessage(), timeout: 1, retryCount: 5, retryDelayMs: 10 });
      assert.strictEqual(service.sent.length, 1);
      assert.deepStrictEqual(delays, []);
      assert.match(posted.find((message) => message.type === MessageType.ResponseError)?.error, /Request timed out/);
    });
  });

  it('rounds a fractional remaining budget up so truncated timers cannot start another attempt', async () => {
    await withNetworkClock(async (advance, delays) => {
      const service = new FakeHttpService();
      const { host, posted } = createHost();
      service.onSend = (handle) => { advance(0.5); handle.resolve({ ...successfulResponse, status: 503 }); };
      await new RequestExecutorCtor(service as unknown as HttpService, host)
        .execute({ ...createMessage(), timeout: 1, retryCount: 5, retryDelayMs: 5000 });
      assert.deepStrictEqual(delays, [1000], '999.5ms remaining must become a 1000ms timer');
      assert.strictEqual(service.sent.length, 1);
      assert.match(posted.find((message) => message.type === MessageType.ResponseError)?.error, /Request timed out/);
    });
  });

  it('rejects a response at the exact deadline before running post-request scripts', async () => {
    await withNetworkClock(async (advance) => {
      const service = new FakeHttpService();
      const { host, posted } = createHost();
      let changes = 0;
      host.saveEnvironmentChanges = () => { changes++; };
      service.onSend = (handle) => { advance(1000); handle.resolve(successfulResponse); };
      await new RequestExecutorCtor(service as unknown as HttpService, host).execute({
        ...createMessage(), timeout: 1,
        scripts: { preRequest: '', test: 'pm.environment.set("shouldNotRun", "value");' },
      });
      assert.strictEqual(changes, 0);
      assert.match(posted.find((message) => message.type === MessageType.ResponseError)?.error, /Request timed out/);
    });
  });

  it('excludes body preparation and pre/post script execution from the network budget', async () => {
    await withNetworkClock(async (advance) => {
      const body = require('../../services/RequestBodyService').RequestBodyService as typeof import('../../services/RequestBodyService').RequestBodyService;
      const script = require('../../services/ScriptRunner').ScriptRunner as typeof import('../../services/ScriptRunner').ScriptRunner;
      const originalPrepare = body.prepare;
      const originalPre = script.runPreRequest;
      const originalPost = script.runTests;
      body.prepare = async (...args) => { advance(2000); return originalPrepare.apply(body, args); };
      script.runPreRequest = (...args) => { advance(2000); return originalPre.apply(script, args); };
      script.runTests = (...args) => { advance(2000); return originalPost.apply(script, args); };
      try {
        const service = new FakeHttpService();
        const { host, posted } = createHost();
        service.onSend = (handle, options) => {
          assert.strictEqual(options.deadline?.remainingMs(), 1000);
          advance(250);
          handle.resolve(successfulResponse);
        };
        await new RequestExecutorCtor(service as unknown as HttpService, host)
          .execute({ ...createMessage(), timeout: 1, requestStartedAt: 1 });
        assert.strictEqual(posted.filter((message) => message.type === MessageType.ReceiveResponse).length, 1);
        assert.strictEqual(posted.filter((message) => message.type === MessageType.ResponseError).length, 0);
      } finally { body.prepare = originalPrepare; script.runPreRequest = originalPre; script.runTests = originalPost; }
    });
  });

  it('keeps cancel precedence when Stop interrupts a retry delay at the deadline', async () => {
    await withNetworkClock(async (advance) => {
      const utils = require('../../panels/requestPanel/requestUtils') as typeof import('../../panels/requestPanel/requestUtils');
      let cancel: (() => void) | null = null;
      utils.createCancelableDelay = (_ms, register) => new Promise((_resolve, reject) => {
        cancel = () => { advance(1000); reject(new Error('Request was canceled')); };
        register?.(cancel);
      });
      const service = new FakeHttpService();
      const { host, posted } = createHost();
      service.onSend = (handle) => handle.resolve({ ...successfulResponse, status: 503 });
      const executor = new RequestExecutorCtor(service as unknown as HttpService, host);
      const pending = executor.execute({ ...createMessage(), timeout: 1, retryCount: 2, retryDelayMs: 500 });
      for (let tries = 0; !cancel && tries < 100; tries++) { await new Promise((resolve) => setImmediate(resolve)); }
      assert.ok(cancel, 'retry delay must register its cancel callback');
      executor.cancel('tab-1');
      await pending;
      assert.strictEqual(service.sent.length, 1);
      assert.strictEqual(posted.filter((message) => message.type === MessageType.RequestCanceled).length, 1);
      assert.strictEqual(posted.filter((message) => message.type === MessageType.ResponseError).length, 0);
    });
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
