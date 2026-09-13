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
  filterCollectionRunEntriesBySelection,
  flattenCollectionRunEntries,
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
  ignoreAbort?: boolean;
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

describe('CollectionRunner', () => {
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
