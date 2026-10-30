import * as assert from 'assert';
import { performance } from 'perf_hooks';
import type { HttpSendOptions } from '../../services/HttpService';
import { RequestTimeoutError } from '../../services/RequestDeadline';
import { CollectionItem, KeyValue, MessageType, Request, Response } from '../../models/types';

const Module = require('module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === 'vscode') {
    return {
      workspace: {
        getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
      },
      window: {
        showInformationMessage: () => undefined,
      },
    };
  }
  return originalLoad.apply(this, arguments as any);
};

const {
  CollectionRunner,
  filterCollectionRunEntriesBySelection,
  flattenCollectionRunEntries,
  normalizeCollectionRunnerOptions,
} = require('../../panels/requestPanel/CollectionRunner') as typeof import('../../panels/requestPanel/CollectionRunner');

interface PlannedSend {
  status?: number;
  statusText?: string;
  delayMs?: number;
  error?: string | Error;
  never?: boolean;
  aborted?: boolean;
  resolveLate?: () => void;
  ignoreAbort?: boolean;
  onComplete?: () => void;
}

class FakeHttpService {
  calls: Array<{ url: string; headers: KeyValue[]; startedAt: number; options: HttpSendOptions }> = [];
  onSend?: (options: HttpSendOptions, index: number) => void;

  constructor(private readonly plans: PlannedSend[] = []) {}

  send(_method: string, url: string, headers: KeyValue[], _body: unknown, options: HttpSendOptions) {
    const plan = this.plans.shift() ?? {};
    this.calls.push({ url, headers, startedAt: Date.now(), options });
    this.onSend?.(options, this.calls.length - 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectPromise: ((error: Error) => void) | undefined;

    const response: Response = {
      status: plan.status ?? 200,
      statusText: plan.statusText ?? (plan.status && plan.status >= 400 ? 'Error' : 'OK'),
      headers: { 'content-type': 'application/json' },
      body: '{}',
      time: 5,
      size: 2,
    };

    const promise = new Promise<Response>((resolve, reject) => {
      rejectPromise = reject;
      if (plan.never) {
        plan.resolveLate = () => resolve(response);
        return;
      }
      timer = setTimeout(() => {
        plan.onComplete?.();
        if (plan.error) {
          reject(plan.error instanceof Error ? plan.error : new Error(plan.error));
        } else {
          resolve(response);
        }
      }, plan.delayMs ?? 0);
    });

    return {
      promise,
      abort: () => {
        plan.aborted = true;
        if (plan.ignoreAbort) { return; }
        if (timer) { clearTimeout(timer); }
        rejectPromise?.(new Error('Request was canceled'));
      },
    };
  }
}

class FakeRunnerHost {
  messages: unknown[] = [];
  histories: unknown[] = [];
  showInformationMessage?: (message: string) => void;

  constructor(private readonly scriptTimeoutMs = 100) {}

  captureExecutionContext() {
    return { profileName: 'default', environmentId: null, generation: 0 };
  }

  isExecutionContextCurrent(): boolean { return true; }

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  getActiveVariables(): KeyValue[] {
    return [];
  }

  getDefaultHeaders(): KeyValue[] {
    return [];
  }

  getAllowInsecureCertificates(): boolean {
    return false;
  }

  getScriptTimeoutMs(): number {
    return this.scriptTimeoutMs;
  }

  saveEnvironmentChanges(_context: unknown, _before: KeyValue[], _after: KeyValue[]): void {}

  saveToHistory(request: Request, response: { status: number; statusText: string; time: number } | null): void {
    this.histories.push({ request, response });
  }

  refreshHistory(): void {}
}

function request(id: string, overrides: Partial<Request> = {}): Request {
  return {
    id,
    name: id,
    method: 'GET',
    url: `https://example.com/${id}`,
    headers: [],
    params: [],
    body: '',
    bodyType: 'none',
    formData: [],
    binaryFilePath: '',
    auth: { type: 'none' },
    scripts: { preRequest: '', test: '' },
    saveToHistory: false,
    ...overrides,
  };
}

function items(...requests: Request[]): CollectionItem[] {
  return requests.map((entry) => ({
    id: entry.id,
    type: 'request' as const,
    name: entry.name,
    request: entry,
  }));
}

function latestMessage<T extends Record<string, unknown>>(messages: unknown[], type: string): T {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as Record<string, unknown>;
    if (message?.type === type) {
      return message as T;
    }
  }
  throw new Error(`Message ${type} was not posted.`);
}

async function waitForCondition(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    if (condition()) { return; }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for condition.');
}

async function withRunnerClock(run: (advance: (ms: number) => void, delays: number[]) => Promise<void>): Promise<void> {
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

describe('CollectionRunner shared network budget', () => {
  for (const failure of ['network', 'status'] as const) {
    it(`caps ${failure} retry backoff and reports one failed run when its deadline expires`, async () => {
      await withRunnerClock(async (advance, delays) => {
        const http = new FakeHttpService([{
          ...(failure === 'network' ? { error: 'ECONNRESET' } : { status: 503 }),
          onComplete: () => advance(900),
        }]);
        const host = new FakeRunnerHost();
        await new CollectionRunner(http as never, host).runCollection('Expiry', items(
          request('expires', { timeout: 1, retryCount: 5, retryDelayMs: 5000, saveToHistory: true })
        ));
        assert.deepStrictEqual(delays, [100]);
        assert.strictEqual(http.calls.length, 1);
        const progress = latestMessage<any>(host.messages, MessageType.RunCollectionProgress);
        assert.match(progress.error, /Request timed out \(1s\)/);
        assert.strictEqual(progress.response, null);
        assert.strictEqual(host.histories.length, 1);
        assert.strictEqual((host.histories[0] as any).response, null);
        assert.strictEqual(latestMessage<any>(host.messages, MessageType.RunCollectionDone).failed, 1);
      });
    });
  }

  it('shares a deadline across attempts but gives each item and iteration a fresh budget', async () => {
    await withRunnerClock(async (advance, delays) => {
      const http = new FakeHttpService([
        { status: 503, onComplete: () => advance(100) }, { status: 200 },
        { status: 200 }, { status: 200 }, { status: 200 },
      ]);
      http.onSend = (options, index) => {
        assert.ok(options.deadline);
        if (index === 1) {
          assert.strictEqual(options.deadline, http.calls[0].options.deadline);
          assert.strictEqual(options.deadline.remainingMs(), 700);
        } else {
          assert.strictEqual(options.deadline.remainingMs(), 1000);
          if (index > 1) { assert.notStrictEqual(options.deadline, http.calls[index - 1].options.deadline); }
        }
      };
      const host = new FakeRunnerHost();
      await new CollectionRunner(http as never, host).runCollection('Independent budgets', items(
        request('one', { timeout: 1, retryCount: 1, retryDelayMs: 200 }),
        request('two', { timeout: 1 })
      ), { iterations: 2, delayMs: 1500 });
      assert.deepStrictEqual(delays, [200, 1500, 1500, 1500]);
      assert.strictEqual(http.calls.length, 5);
      assert.strictEqual(latestMessage<any>(host.messages, MessageType.RunCollectionDone).passed, 4);
    });
  });

  it('rounds fractional remaining time up before Node truncates the retry timer delay', async () => {
    await withRunnerClock(async (advance, delays) => {
      const http = new FakeHttpService([{ status: 503, onComplete: () => advance(0.5) }]);
      const host = new FakeRunnerHost();
      await new CollectionRunner(http as never, host).runCollection('Fractional expiry', items(
        request('one', { timeout: 1, retryCount: 5, retryDelayMs: 5000, saveToHistory: true })
      ));
      assert.deepStrictEqual(delays, [1000], '999.5ms remaining must become a 1000ms timer');
      assert.strictEqual(http.calls.length, 1);
      const progress = latestMessage<any>(host.messages, MessageType.RunCollectionProgress);
      assert.match(progress.error, /Request timed out/);
      assert.strictEqual(progress.response, null);
      assert.strictEqual(host.histories.length, 1);
      assert.strictEqual((host.histories[0] as any).response, null);
    });
  });

  it('does not retry a typed timeout or start another attempt at exact zero remaining time', async () => {
    await withRunnerClock(async (advance, delays) => {
      const http = new FakeHttpService([
        { error: new RequestTimeoutError(1) },
        { status: 503, onComplete: () => advance(1000) },
      ]);
      const host = new FakeRunnerHost();
      await new CollectionRunner(http as never, host).runCollection('Terminal timeouts', items(
        request('typed', { timeout: 1, retryCount: 5, retryDelayMs: 10, saveToHistory: true }),
        request('boundary', { timeout: 1, retryCount: 5, retryDelayMs: 0, saveToHistory: true })
      ));
      assert.strictEqual(http.calls.length, 2);
      assert.deepStrictEqual(delays, []);
      const progress = host.messages.filter((message: any) => message.type === MessageType.RunCollectionProgress) as any[];
      assert.ok(progress.every((message) => /Request timed out/.test(message.error)));
      assert.ok(progress.every((message) => message.response === null));
      assert.strictEqual(host.histories.length, 2);
      assert.ok(host.histories.every((history: any) => history.response === null));
      assert.strictEqual(latestMessage<any>(host.messages, MessageType.RunCollectionDone).failed, 2);
    });
  });

  it('rejects a boundary response before post-script execution and respects stopOnFailure', async () => {
    await withRunnerClock(async (advance) => {
      const http = new FakeHttpService([{ status: 200, onComplete: () => advance(1000) }]);
      const host = new FakeRunnerHost();
      let changes = 0;
      host.saveEnvironmentChanges = () => { changes++; };
      await new CollectionRunner(http as never, host).runCollection('Boundary', items(
        request('boundary', { timeout: 1, saveToHistory: true,
          scripts: { preRequest: '', test: 'pm.environment.set("shouldNotRun", "value");' } }),
        request('skipped')
      ), { stopOnFailure: true });
      assert.strictEqual(http.calls.length, 1);
      assert.strictEqual(changes, 0);
      const progress = latestMessage<any>(host.messages, MessageType.RunCollectionProgress);
      assert.strictEqual(progress.status, 0);
      assert.strictEqual(progress.response, null);
      assert.strictEqual(host.histories.length, 1);
      assert.strictEqual((host.histories[0] as any).response, null);
      const done = latestMessage<any>(host.messages, MessageType.RunCollectionDone);
      assert.strictEqual(done.failed, 1);
      assert.strictEqual(done.skipped, 1);
    });
  });

  it('excludes body preparation and pre/post script execution from the network budget', async () => {
    await withRunnerClock(async (advance) => {
      const body = require('../../services/RequestBodyService').RequestBodyService as typeof import('../../services/RequestBodyService').RequestBodyService;
      const script = require('../../services/ScriptRunner').ScriptRunner as typeof import('../../services/ScriptRunner').ScriptRunner;
      const originalPrepare = body.prepare;
      const originalPre = script.runPreRequest;
      const originalPost = script.runTests;
      body.prepare = async (...args) => { advance(2000); return originalPrepare.apply(body, args); };
      script.runPreRequest = (...args) => { advance(2000); return originalPre.apply(script, args); };
      script.runTests = (...args) => { advance(2000); return originalPost.apply(script, args); };
      try {
        const http = new FakeHttpService([{ onComplete: () => advance(250) }]);
        http.onSend = (options) => { assert.strictEqual(options.deadline?.remainingMs(), 1000); };
        const host = new FakeRunnerHost();
        await new CollectionRunner(http as never, host).runCollection('Scripts excluded', items(request('one', { timeout: 1 })));
        assert.strictEqual(latestMessage<any>(host.messages, MessageType.RunCollectionDone).passed, 1);
      } finally { body.prepare = originalPrepare; script.runPreRequest = originalPre; script.runTests = originalPost; }
    });
  });

  it('keeps Stop precedence when canceling retry backoff at the deadline', async () => {
    await withRunnerClock(async (advance) => {
      const utils = require('../../panels/requestPanel/requestUtils') as typeof import('../../panels/requestPanel/requestUtils');
      let cancel: (() => void) | null = null;
      utils.createCancelableDelay = (_ms, register) => new Promise((_resolve, reject) => {
        cancel = () => { advance(1000); reject(new Error('Request was canceled')); };
        register?.(cancel);
      });
      const http = new FakeHttpService([{ status: 503 }]);
      const host = new FakeRunnerHost();
      const runner = new CollectionRunner(http as never, host);
      const pending = runner.runCollection('Stop', items(request('one', { timeout: 1, retryCount: 2, retryDelayMs: 500 })));
      await waitForCondition(() => !!cancel);
      runner.stop();
      await pending;
      assert.strictEqual(http.calls.length, 1);
      assert.strictEqual(host.messages.filter((message: any) => message.type === MessageType.RunCollectionProgress).length, 0);
      assert.strictEqual(latestMessage<any>(host.messages, MessageType.RunCollectionDone).stopped, true);
    });
  });
});

describe('CollectionRunner', () => {
  it('변수로 지정한 API Key 헤더명과 보호 metadata를 실제 HTTP 호출에 전달한다', async () => {
    const http = new FakeHttpService();
    const host = new FakeRunnerHost();
    host.getActiveVariables = () => [{ key: 'name', value: 'Ocp-Apim-Subscription-Key', enabled: true }];
    await new CollectionRunner(http as never, host).runCollection('Credential metadata', items(request('key', {
      followRedirects: true,
      auth: { type: 'apikey', apikey: { key: '{{name}}', value: 'synthetic-key', addTo: 'header' } },
    })));
    assert.strictEqual(http.calls.length, 1);
    assert.deepStrictEqual(http.calls[0].options.credentialHeaderNames, ['Ocp-Apim-Subscription-Key']);
    assert.strictEqual(http.calls[0].options.followRedirects, true);
    assert.strictEqual(http.calls[0].headers.find((header) => header.key === 'Ocp-Apim-Subscription-Key')?.value, 'synthetic-key');
  });

  it('WS/WSS와 변수로 해석된 WebSocket 요청을 전송 전에 거절한다', async () => {
    const http = new FakeHttpService();
    const host = new FakeRunnerHost();
    host.getActiveVariables = () => [{ key: 'socketUrl', value: 'wss://example.invalid/socket', enabled: true }];
    await new CollectionRunner(http as never, host).runCollection('Unsupported WebSocket', items(
      request('ws', { url: 'ws://example.invalid/socket' }),
      request('wss', { url: 'wss://example.invalid/socket' }),
      request('variable', { url: '{{socketUrl}}' }),
      request('typed', { requestType: 'websocket', url: 'https://example.invalid/socket' }),
    ));
    assert.strictEqual(http.calls.length, 0);
    const done = latestMessage<Record<string, unknown>>(host.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.failed, 4);
    const errors = host.messages.filter((message) => (message as { type?: string }).type === MessageType.RunCollectionProgress);
    assert.ok(errors.every((message) => /HTTP requests only/.test(String((message as { error: unknown }).error))));
  });

  it('빈 스크립트 실행은 환경 변수 쓰기를 발생시키지 않는다', async () => {
    const host = new FakeRunnerHost();
    let writes = 0;
    host.saveEnvironmentChanges = () => { writes++; };
    await new CollectionRunner(new FakeHttpService() as never, host).runCollection('No scripts', items(request('plain')));
    assert.strictEqual(writes, 0);
  });

  it('프로필 무효화와 reset 뒤 늦은 러너 응답을 저장하거나 표시하지 않는다', async () => {
    const plan: PlannedSend = { never: true, ignoreAbort: true };
    const http = new FakeHttpService([plan]);
    const host = new FakeRunnerHost();
    let current = true;
    host.isExecutionContextCurrent = () => current;
    const runner = new CollectionRunner(http as never, host);
    const pending = runner.runCollection('Old profile', items(request('late', { saveToHistory: true,
      scripts: { preRequest: '', test: 'pm.environment.set("late", "value");' } })));
    await waitForCondition(() => http.calls.length === 1);
    current = false;
    runner.reset();
    const previousMessages = host.messages.length;
    plan.resolveLate?.();
    await pending;
    assert.strictEqual(host.messages.length, previousMessages);
    assert.deepStrictEqual(host.histories, []);
    await runner.rerunFailed([0]);
    assert.strictEqual(http.calls.length, 1);
  });

  it('normalizes runner options within safe bounds', () => {
    assert.deepStrictEqual(normalizeCollectionRunnerOptions(), {
      delayMs: 0,
      iterations: 1,
      stopOnFailure: false,
    });
    assert.deepStrictEqual(normalizeCollectionRunnerOptions({ delayMs: -1, iterations: 0 }), {
      delayMs: 0,
      iterations: 1,
      stopOnFailure: false,
    });
    assert.deepStrictEqual(normalizeCollectionRunnerOptions({ delayMs: 999999, iterations: 999999, stopOnFailure: true }), {
      delayMs: 60000,
      iterations: 100,
      stopOnFailure: true,
    });
  });

  it('keeps delay 0 runs immediate and applies delay only between requests', async () => {
    const noDelayHttp = new FakeHttpService();
    const noDelayHost = new FakeRunnerHost();
    await new CollectionRunner(noDelayHttp as any, noDelayHost).runCollection('No Delay', items(request('one'), request('two')));
    assert.strictEqual(noDelayHttp.calls.length, 2);
    assert.strictEqual(noDelayHost.messages.filter((message: any) => message.phase === 'delay').length, 0);

    const delayHttp = new FakeHttpService();
    const delayHost = new FakeRunnerHost();
    await new CollectionRunner(delayHttp as any, delayHost).runCollection('Delay', items(request('one'), request('two')), {
      delayMs: 30,
    });
    assert.strictEqual(delayHttp.calls.length, 2);
    assert.ok(delayHttp.calls[1].startedAt - delayHttp.calls[0].startedAt >= 25);
    assert.strictEqual(delayHost.messages.filter((message: any) => message.phase === 'delay').length, 1);
  });

  it('runs all requests for each iteration and reports iteration progress', async () => {
    const http = new FakeHttpService();
    const host = new FakeRunnerHost();
    await new CollectionRunner(http as any, host).runCollection('Iterations', items(request('one'), request('two')), {
      iterations: 2,
    });

    assert.deepStrictEqual(http.calls.map((call) => call.url), [
      'https://example.com/one',
      'https://example.com/two',
      'https://example.com/one',
      'https://example.com/two',
    ]);
    const done = latestMessage<any>(host.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.totalRuns, 4);
    assert.strictEqual(done.passed, 4);
    const progress = host.messages.filter((message: any) => message.type === MessageType.RunCollectionProgress) as any[];
    assert.deepStrictEqual(progress.map((message) => message.iteration), [1, 1, 2, 2]);
  });

  it('continues on failure by default and stops with skipped count when requested', async () => {
    const continueHttp = new FakeHttpService([{ status: 500 }, { status: 200 }]);
    const continueHost = new FakeRunnerHost();
    await new CollectionRunner(continueHttp as any, continueHost).runCollection('Continue', items(request('bad'), request('good')));
    assert.strictEqual(continueHttp.calls.length, 2);
    let done = latestMessage<any>(continueHost.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.failed, 1);
    assert.strictEqual(done.skipped, 0);

    const stopHttp = new FakeHttpService([{ status: 500 }, { status: 200 }]);
    const stopHost = new FakeRunnerHost();
    await new CollectionRunner(stopHttp as any, stopHost).runCollection('Stop', items(request('bad'), request('good')), {
      stopOnFailure: true,
    });
    assert.strictEqual(stopHttp.calls.length, 1);
    done = latestMessage<any>(stopHost.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.failed, 1);
    assert.strictEqual(done.skipped, 1);
    assert.strictEqual(done.stoppedOnFailure, true);
  });

  it('treats test failures, script timeouts, and network errors as stop-on-failure failures', async () => {
    const testFailHttp = new FakeHttpService([{ status: 200 }, { status: 200 }]);
    const testFailHost = new FakeRunnerHost();
    await new CollectionRunner(testFailHttp as any, testFailHost).runCollection('Test failure', items(
      request('test-fail', { scripts: { preRequest: '', test: "test('fails', function () { assert(false); });" } }),
      request('next')
    ), { stopOnFailure: true });
    assert.strictEqual(testFailHttp.calls.length, 1);
    assert.strictEqual(latestMessage<any>(testFailHost.messages, MessageType.RunCollectionDone).skipped, 1);

    const timeoutHttp = new FakeHttpService([{ status: 200 }]);
    const timeoutHost = new FakeRunnerHost(100);
    await new CollectionRunner(timeoutHttp as any, timeoutHost).runCollection('Timeout', items(
      request('timeout', { scripts: { preRequest: 'while (true) {}', test: '' } }),
      request('next')
    ), { stopOnFailure: true });
    assert.strictEqual(timeoutHttp.calls.length, 0);
    const timeoutProgress = latestMessage<any>(timeoutHost.messages, MessageType.RunCollectionProgress);
    assert.match(timeoutProgress.error, /Script execution timed out after 100 ms/);
    assert.strictEqual(latestMessage<any>(timeoutHost.messages, MessageType.RunCollectionDone).skipped, 1);

    const networkHttp = new FakeHttpService([{ error: 'ECONNRESET' }, { status: 200 }]);
    const networkHost = new FakeRunnerHost();
    await new CollectionRunner(networkHttp as any, networkHost).runCollection('Network', items(request('bad'), request('next')), {
      stopOnFailure: true,
    });
    assert.strictEqual(networkHttp.calls.length, 1);
    assert.strictEqual(latestMessage<any>(networkHost.messages, MessageType.RunCollectionDone).skipped, 1);
  });

  it('continues after runner pre-request and test script timeouts when stopOnFailure is off', async () => {
    const preHttp = new FakeHttpService([{ status: 200 }]);
    const preHost = new FakeRunnerHost(100);
    await new CollectionRunner(preHttp as any, preHost).runCollection('Pre timeout', items(
      request('timeout', { scripts: { preRequest: 'while (true) {}', test: '' } }),
      request('next')
    ));
    assert.strictEqual(preHttp.calls.length, 1);
    let done = latestMessage<any>(preHost.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.failed, 1);
    assert.strictEqual(done.passed, 1);

    const testHttp = new FakeHttpService([{ status: 200 }, { status: 200 }]);
    const testHost = new FakeRunnerHost(100);
    await new CollectionRunner(testHttp as any, testHost).runCollection('Test timeout', items(
      request('timeout', { scripts: { preRequest: '', test: 'while (true) {}' } }),
      request('next')
    ));
    assert.strictEqual(testHttp.calls.length, 2);
    done = latestMessage<any>(testHost.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.failed, 1);
    assert.strictEqual(done.passed, 1);
  });

  it('stops safely during active requests, runner delay, and retry delay', async () => {
    const activePlan: PlannedSend = { never: true };
    const activeHttp = new FakeHttpService([activePlan, { status: 200 }]);
    const activeHost = new FakeRunnerHost();
    const activeRunner = new CollectionRunner(activeHttp as any, activeHost);
    const activeRun = activeRunner.runCollection('Active stop', items(request('slow'), request('next')));
    await waitForCondition(() => activeHttp.calls.length === 1);
    activeRunner.stop();
    await activeRun;
    assert.strictEqual(activePlan.aborted, true);
    assert.strictEqual(activeHttp.calls.length, 1);
    assert.strictEqual(latestMessage<any>(activeHost.messages, MessageType.RunCollectionDone).stopped, true);

    const delayHttp = new FakeHttpService([{ status: 200 }, { status: 200 }]);
    const delayHost = new FakeRunnerHost();
    const delayRunner = new CollectionRunner(delayHttp as any, delayHost);
    const delayRun = delayRunner.runCollection('Delay stop', items(request('one'), request('two')), { delayMs: 1000 });
    await waitForCondition(() => delayHost.messages.some((message: any) => message.phase === 'delay'));
    delayRunner.stop();
    await delayRun;
    assert.strictEqual(delayHttp.calls.length, 1);
    assert.strictEqual(latestMessage<any>(delayHost.messages, MessageType.RunCollectionDone).stopped, true);

    const retryHttp = new FakeHttpService([{ status: 500 }, { status: 200 }]);
    const retryHost = new FakeRunnerHost();
    const retryRunner = new CollectionRunner(retryHttp as any, retryHost);
    const retryRun = retryRunner.runCollection('Retry stop', items(request('retry', { retryCount: 1, retryDelayMs: 1000 })));
    await waitForCondition(() => retryHost.messages.some((message: any) => message.phase === 'retry'));
    retryRunner.stop();
    await retryRun;
    assert.strictEqual(retryHttp.calls.length, 1);
    assert.strictEqual(latestMessage<any>(retryHost.messages, MessageType.RunCollectionDone).stopped, true);
  });

  it('can run again after stop and ignores late results from stale runs', async () => {
    const firstPlan: PlannedSend = { never: true };
    const http = new FakeHttpService([firstPlan, { status: 200 }]);
    const host = new FakeRunnerHost();
    const runner = new CollectionRunner(http as any, host);

    const firstRun = runner.runCollection('First', items(request('slow')));
    await waitForCondition(() => http.calls.length === 1);
    const secondRun = runner.runCollection('Second', items(request('ok')));
    firstPlan.resolveLate?.();
    await Promise.all([firstRun, secondRun]);

    const doneMessages = host.messages.filter((message: any) => message.type === MessageType.RunCollectionDone) as any[];
    assert.strictEqual(http.calls.length, 2);
    assert.strictEqual(doneMessages.length, 1);
    assert.strictEqual(doneMessages[0].passed, 1);
  });

  it('flattens nested folder requests with CollectionItem ids and folder paths', () => {
    const collection: CollectionItem[] = [
      { id: 'root', type: 'request', name: 'Root Get', request: request('root') },
      {
        id: 'folder-auth',
        type: 'folder',
        name: 'Auth & Headers',
        children: [
          { id: 'basic-1', type: 'request', name: 'Basic Auth', request: request('basic-1') },
          { id: 'basic-2', type: 'request', name: 'Basic Auth', request: request('basic-2') },
          {
            id: 'folder-nested',
            type: 'folder',
            name: 'Nested',
            children: [
              {
                id: 'ws-echo',
                type: 'request',
                name: 'WS Echo',
                request: request('ws-echo', { requestType: 'websocket', url: 'wss://example.com/echo' }),
              },
            ],
          },
        ],
      },
    ];
    const flattened = flattenCollectionRunEntries(collection);
    assert.deepStrictEqual(flattened.map((entry) => ({
      id: entry.id,
      name: entry.name,
      method: entry.method,
      folderPath: entry.folderPath,
    })), [
      { id: 'root', name: 'Root Get', method: 'GET', folderPath: '' },
      { id: 'basic-1', name: 'Basic Auth', method: 'GET', folderPath: 'Auth & Headers' },
      { id: 'basic-2', name: 'Basic Auth', method: 'GET', folderPath: 'Auth & Headers' },
      { id: 'ws-echo', name: 'WS Echo', method: 'WS', folderPath: 'Auth & Headers / Nested' },
    ]);
  });

  it('filters selected requests by id while preserving flatten order', () => {
    const collection = items(
      request('a'),
      request('b'),
      request('c'),
      request('d')
    );
    const flattened = flattenCollectionRunEntries(collection);
    const selected = filterCollectionRunEntriesBySelection(flattened, ['d', 'a', 'missing', 'c']);
    assert.deepStrictEqual(selected.map((entry) => entry.id), ['a', 'c', 'd']);
  });

  it('runs only selected requests and reports collection vs selected totals', async () => {
    const http = new FakeHttpService();
    const host = new FakeRunnerHost();
    const collection = items(
      request('a'),
      request('b'),
      request('c'),
      request('d'),
      request('e'),
      request('f'),
      request('g'),
      request('h', { requestType: 'websocket', url: 'wss://example.com/echo' })
    );
    const before = JSON.stringify(collection);

    await new CollectionRunner(http as any, host).runCollection('Selected', collection, {
      selectedRequestIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      iterations: 2,
      delayMs: 0,
    });

    assert.strictEqual(JSON.stringify(collection), before, 'collection storage must not mutate');
    assert.deepStrictEqual(http.calls.map((call) => call.url), [
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
      'https://example.com/d',
      'https://example.com/e',
      'https://example.com/f',
      'https://example.com/g',
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
      'https://example.com/d',
      'https://example.com/e',
      'https://example.com/f',
      'https://example.com/g',
    ]);
    assert.ok(!http.calls.some((call) => call.url.includes('/h')));

    const start = latestMessage<any>(host.messages, MessageType.RunCollectionStart);
    assert.strictEqual(start.collectionTotal, 8);
    assert.strictEqual(start.selectedTotal, 7);
    assert.strictEqual(start.total, 7);
    assert.strictEqual(start.totalRuns, 14);

    const done = latestMessage<any>(host.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.collectionTotal, 8);
    assert.strictEqual(done.selectedTotal, 7);
    assert.strictEqual(done.total, 7);
    assert.strictEqual(done.totalRuns, 14);
    assert.strictEqual(done.passed, 14);
    assert.strictEqual(done.failed, 0);
    assert.strictEqual(done.skipped, 0);
    assert.strictEqual(host.histories.length, 0);
  });

  it('does not count excluded requests as skipped and keeps history for executed selected requests only', async () => {
    const http = new FakeHttpService([{ status: 500 }, { status: 200 }]);
    const host = new FakeRunnerHost();
    await new CollectionRunner(http as any, host).runCollection(
      'Exclude',
      items(
        request('keep-fail', { saveToHistory: true }),
        request('excluded', { saveToHistory: true }),
        request('keep-ok', { saveToHistory: true })
      ),
      {
        selectedRequestIds: ['keep-fail', 'keep-ok'],
        stopOnFailure: true,
      }
    );

    assert.deepStrictEqual(http.calls.map((call) => call.url), ['https://example.com/keep-fail']);
    const done = latestMessage<any>(host.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.collectionTotal, 3);
    assert.strictEqual(done.selectedTotal, 2);
    assert.strictEqual(done.failed, 1);
    assert.strictEqual(done.skipped, 1);
    assert.strictEqual(done.stoppedOnFailure, true);
    assert.strictEqual(host.histories.length, 1);
    assert.strictEqual((host.histories[0] as any).request.url, 'https://example.com/keep-fail');
  });

  it('reruns only failed selected requests and never reintroduces excluded ones', async () => {
    const http = new FakeHttpService([
      { status: 500 },
      { status: 200 },
      { status: 500 },
      { status: 200 },
    ]);
    const host = new FakeRunnerHost();
    const runner = new CollectionRunner(http as any, host);
    await runner.runCollection(
      'Rerun base',
      items(request('a'), request('b'), request('c'), request('excluded')),
      { selectedRequestIds: ['a', 'b', 'c'] }
    );
    assert.deepStrictEqual(http.calls.map((call) => call.url), [
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
    ]);

    await runner.rerunFailed([0, 2]);
    assert.deepStrictEqual(http.calls.map((call) => call.url), [
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
      'https://example.com/a',
      'https://example.com/c',
    ]);
    const done = latestMessage<any>(host.messages, MessageType.RunCollectionDone);
    assert.strictEqual(done.total, 2);
    assert.strictEqual(done.selectedTotal, 2);
    assert.ok(!http.calls.some((call) => call.url.includes('/excluded')));
  });

  it('combines selection with delay and stop without changing cancellation behavior', async () => {
    const delayHttp = new FakeHttpService([{ status: 200 }, { status: 200 }]);
    const delayHost = new FakeRunnerHost();
    const delayRunner = new CollectionRunner(delayHttp as any, delayHost);
    const delayRun = delayRunner.runCollection(
      'Delay select',
      items(request('one'), request('skip-me'), request('two')),
      { selectedRequestIds: ['one', 'two'], delayMs: 1000 }
    );
    await waitForCondition(() => delayHost.messages.some((message: any) => message.phase === 'delay'));
    delayRunner.stop();
    await delayRun;
    assert.strictEqual(delayHttp.calls.length, 1);
    assert.strictEqual(latestMessage<any>(delayHost.messages, MessageType.RunCollectionDone).stopped, true);
    assert.ok(!delayHttp.calls.some((call) => call.url.includes('/skip-me')));
  });

  it('shows information and skips execution when selection is empty', async () => {
    const http = new FakeHttpService();
    const host = new FakeRunnerHost();
    let info = '';
    host.showInformationMessage = (message: string) => { info = message; };
    await new CollectionRunner(http as any, host).runCollection(
      'Empty',
      items(request('a'), request('b')),
      { selectedRequestIds: [] }
    );
    assert.strictEqual(http.calls.length, 0);
    assert.strictEqual(host.messages.length, 0);
    assert.match(info, /no requests|실행할 요청|リクエスト/i);
  });
});
