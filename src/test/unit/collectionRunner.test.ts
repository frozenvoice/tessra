import * as assert from 'assert';
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
  normalizeCollectionRunnerOptions,
} = require('../../panels/requestPanel/CollectionRunner') as typeof import('../../panels/requestPanel/CollectionRunner');

interface PlannedSend {
  status?: number;
  statusText?: string;
  delayMs?: number;
  error?: string;
  never?: boolean;
  aborted?: boolean;
  resolveLate?: () => void;
}

class FakeHttpService {
  calls: Array<{ url: string; startedAt: number }> = [];

  constructor(private readonly plans: PlannedSend[] = []) {}

  send(_method: string, url: string) {
    const plan = this.plans.shift() ?? {};
    this.calls.push({ url, startedAt: Date.now() });
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
        if (plan.error) {
          reject(new Error(plan.error));
        } else {
          resolve(response);
        }
      }, plan.delayMs ?? 0);
    });

    return {
      promise,
      abort: () => {
        plan.aborted = true;
        if (timer) { clearTimeout(timer); }
        rejectPromise?.(new Error('Request was canceled'));
      },
    };
  }
}

class FakeRunnerHost {
  messages: unknown[] = [];
  histories: unknown[] = [];

  constructor(private readonly scriptTimeoutMs = 100) {}

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

  saveActiveEnvironmentVariables(_variables: KeyValue[]): void {}

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

describe('CollectionRunner', () => {
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
});
