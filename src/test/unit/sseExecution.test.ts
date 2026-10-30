import * as assert from 'assert';
import * as http from 'http';
import * as net from 'net';
import Module = require('module');
import { HttpService, HttpSendOptions, SendHandle } from '../../services/HttpService';
import { KeyValue, MessageType, Request, Response, SendRequestMessage } from '../../models/types';
import { SecretRedactor } from '../../services/secretVariables';
import { SseStream } from '../../services/SseStream';
import type { RequestExecutorHost } from '../../panels/requestPanel/RequestExecutor';
import type { CollectionRunnerHost } from '../../panels/requestPanel/CollectionRunner';

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

function hostFixture() {
  const posted: any[] = [];
  const histories: Array<{ request: Request; response: unknown }> = [];
  const host: RequestExecutorHost & CollectionRunnerHost = {
    captureExecutionContext: () => ({ profileName: 'sse-fixture', environmentId: 'env-1', generation: 0 }),
    isExecutionContextCurrent: () => true,
    postMessage: (message) => posted.push(message),
    getActiveVariables: () => [],
    getDefaultHeaders: () => [],
    getAllowInsecureCertificates: () => false,
    getScriptTimeoutMs: () => 100,
    saveEnvironmentChanges: () => undefined,
    saveToHistory: (request, response) => histories.push({ request, response }),
    refreshHistory: () => undefined,
  };
  return { host, posted, histories };
}

function message(url: string): SendRequestMessage {
  return {
    type: MessageType.SendRequest, tabId: 'sse-tab', method: 'GET', url,
    headers: [], params: [], body: '', bodyType: 'none', auth: { type: 'none' },
    saveToHistory: true, disableScripts: true, timeout: 2, retryCount: 3, retryDelayMs: 0,
  };
}

function request(url: string): Request {
  const { type: _type, tabId: _tabId, ...settings } = message(url);
  return { id: 'sse-request', name: 'Fixture', ...settings };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) { throw new Error('fixture condition timed out'); }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

describe('SSE execution with real local fixture', () => {
  let server: http.Server;
  let baseUrl: string;
  const sockets = new Set<net.Socket>();
  const foreverSockets = new Set<net.Socket>();
  const calls = new Map<string, number>();
  let secretHeader = '';

  before(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://fixture');
      const path = url.pathname;
      if (path === '/forever') {
        foreverSockets.add(req.socket);
        req.socket.once('close', () => foreverSockets.delete(req.socket));
      }
      calls.set(path, (calls.get(path) ?? 0) + 1);
      res.writeHead(path === '/status-error' ? 500 : 200, { 'Content-Type': 'text/event-stream' });
      if (path === '/secret') {
        secretHeader = String(req.headers['x-secret'] ?? '');
        res.end(`data: ${secretHeader}\n\n`);
        return;
      }
      if (path === '/complete' || path === '/status-error') { res.end('data: complete\n\n'); return; }
      res.write('data: first\n\n');
      if (path === '/disconnect') {
        const timer = setTimeout(() => res.destroy(new Error('fixture transport failure')), 90);
        res.on('close', () => clearTimeout(timer));
        return;
      }
      const interval = setInterval(() => res.write('data: intermediate\n\n'), 15);
      const timer = path === '/slow' ? setTimeout(() => res.end('data: last\n\n'), 180) : undefined;
      res.on('close', () => { clearInterval(interval); clearTimeout(timer); });
    });
    server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
  });

  after(async () => {
    for (const socket of sockets) { socket.destroy(); }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('RequestExecutor는 EOF 전 batch를 전달하고 최종 응답/히스토리를 한 번만 저장한다', async () => {
    const { host, posted, histories } = hostFixture();
    const executor = new RequestExecutorCtor(new HttpService(), host);
    const pending = executor.execute(message(baseUrl + '/slow'));
    await waitUntil(() => posted.some((item) => item.type === MessageType.ReceiveSseUpdate && item.update.phase === 'events'));
    assert.strictEqual(histories.length, 0);
    assert.strictEqual(posted.some((item) => item.type === MessageType.ReceiveResponse), false);
    await pending;
    const updates = posted.filter((item) => item.type === MessageType.ReceiveSseUpdate);
    assert.strictEqual(updates[0].update.phase, 'started');
    assert.strictEqual(updates.at(-1).update.snapshot.state, 'completed');
    assert.strictEqual(new Set(updates.map((item) => item.runId)).size, 1);
    assert.ok(updates.every((item) => typeof item.requestStartedAt === 'number'));
    assert.strictEqual(posted.filter((item) => item.type === MessageType.ReceiveResponse).length, 1);
    assert.strictEqual(histories.length, 1);
  });

  it('RequestExecutor Stop는 partial aborted와 canceled를 보내고 완료 응답으로 바꾸지 않는다', async () => {
    const { host, posted, histories } = hostFixture();
    const executor = new RequestExecutorCtor(new HttpService(), host);
    const pending = executor.execute({ ...message(baseUrl + '/forever'), timeout: 0 });
    await waitUntil(() => posted.some((item) => item.type === MessageType.ReceiveSseUpdate && item.update.phase === 'events'));
    executor.cancel('sse-tab');
    await pending;
    const terminal = posted.find((item) => item.type === MessageType.ReceiveSseUpdate && item.update.phase === 'ended');
    assert.strictEqual(terminal.update.snapshot.state, 'aborted');
    assert.ok(terminal.update.snapshot.events.length > 0);
    assert.strictEqual(posted.filter((item) => item.type === MessageType.RequestCanceled).length, 1);
    assert.strictEqual(posted.filter((item) => item.type === MessageType.ReceiveResponse).length, 0);
    assert.strictEqual(histories.length, 0);
  });

  for (const path of ['/status-error', '/disconnect', '/forever']) {
    it(`RequestExecutor ${path}: SSE가 시작되면 configured retry를 수행하지 않는다`, async () => {
      const { host, posted, histories } = hostFixture();
      const executor = new RequestExecutorCtor(new HttpService(), host);
      const before = calls.get(path) ?? 0;
      await executor.execute({ ...message(baseUrl + path), timeout: path === '/forever' ? 1 : 2 });
      assert.strictEqual((calls.get(path) ?? 0) - before, 1);
      assert.strictEqual(histories.length, 1);
      const terminal = posted.find((item) => item.type === MessageType.ReceiveSseUpdate && item.update.phase === 'ended');
      assert.strictEqual(terminal.update.snapshot.state, path === '/status-error' ? 'completed' : path === '/forever' ? 'timeout' : 'error');
      if (path !== '/status-error') {
        assert.strictEqual(posted.some((item) => item.type === MessageType.ReceiveResponse), false);
        assert.strictEqual(posted.filter((item) => item.type === MessageType.ResponseError).length, 1);
        assert.strictEqual(histories[0].response, null);
      }
    });
  }

  it('secret은 전송 시 해석하고 history 참조는 보존하며 서버 echo는 변조하지 않는다', async () => {
    const { host, posted, histories } = hostFixture();
    const secret = 'synthetic-sse-secret';
    host.getActiveVariables = () => [{ key: 'token', value: '', enabled: true }];
    host.resolveSecretVariables = async () => ({ variables: [{ key: 'token', value: secret, enabled: true }], redactor: new SecretRedactor([{ key: 'token', value: secret }]) });
    const executor = new RequestExecutorCtor(new HttpService(), host);
    await executor.execute({ ...message(baseUrl + '/secret'), headers: [{ key: 'X-Secret', value: '{{token}}', enabled: true }] });
    assert.strictEqual(secretHeader, secret);
    assert.strictEqual(histories.length, 1);
    assert.strictEqual(histories[0].request.headers[0].value, '{{token}}');
    assert.strictEqual(JSON.stringify(histories).includes(secret), false);
    const receive = posted.find((item) => item.type === MessageType.ReceiveResponse);
    assert.strictEqual(receive.response.sse.events[0].data, secret);
    assert.strictEqual(receive.resolvedHeaders[0].value, '[secret]');
    const terminal = posted.find((item) => item.type === MessageType.ReceiveSseUpdate && item.update.phase === 'ended');
    assert.strictEqual(terminal.update.snapshot.events[0].data, secret);
  });

  it('CollectionRunner도 느린 stream progress를 표시하고 한 번만 최종 history를 저장한다', async () => {
    const { host, posted, histories } = hostFixture();
    const runner = new CollectionRunnerCtor(new HttpService(), host);
    const pending = runner.runCollection('Fixture', [{ id: 'entry', type: 'request', name: 'Fixture', request: request(baseUrl + '/slow') }]);
    await waitUntil(() => posted.some((item) => item.type === MessageType.RunCollectionSseUpdate && item.update.phase === 'events'));
    assert.strictEqual(histories.length, 0);
    await pending;
    assert.strictEqual(histories.length, 1);
    const progress = posted.find((item) => item.type === MessageType.RunCollectionProgress);
    assert.strictEqual(progress.response.sse.state, 'completed');
    assert.strictEqual(posted.filter((item) => item.type === MessageType.RunCollectionProgress).length, 1);
    assert.strictEqual(posted.find((item) => item.type === MessageType.RunCollectionDone).passed, 1);
  });

  it('CollectionRunner Stop는 partial aborted를 전달하고 완료된 실행으로 계산하지 않는다', async () => {
    const { host, posted, histories } = hostFixture();
    const runner = new CollectionRunnerCtor(new HttpService(), host);
    const req = { ...request(baseUrl + '/forever'), timeout: 0 };
    const pending = runner.runCollection('Fixture', [{ id: 'entry', type: 'request', name: 'Fixture', request: req }]);
    await waitUntil(() => posted.some((item) => item.type === MessageType.RunCollectionSseUpdate && item.update.phase === 'events'));
    runner.stop();
    await pending;
    const terminal = posted.find((item) => item.type === MessageType.RunCollectionSseUpdate && item.update.phase === 'ended');
    assert.strictEqual(terminal.update.snapshot.state, 'aborted');
    assert.ok(terminal.update.snapshot.events.length > 0);
    const done = posted.find((item) => item.type === MessageType.RunCollectionDone);
    assert.strictEqual(done.stopped, true);
    assert.strictEqual(done.passed, 0);
    assert.strictEqual(posted.some((item) => item.type === MessageType.RunCollectionProgress), false);
    assert.strictEqual(histories.length, 0);
  });

  for (const path of ['/status-error', '/disconnect', '/forever']) {
    it(`CollectionRunner ${path}: 재시도하지 않고 partial 실패를 일반 성공으로 표시하지 않는다`, async () => {
      const { host, posted, histories } = hostFixture();
      const runner = new CollectionRunnerCtor(new HttpService(), host);
      const before = calls.get(path) ?? 0;
      const req = { ...request(baseUrl + path), timeout: path === '/forever' ? 1 : 2 };
      await runner.runCollection('Fixture', [{ id: 'entry', type: 'request', name: 'Fixture', request: req }]);
      assert.strictEqual((calls.get(path) ?? 0) - before, 1);
      const progress = posted.find((item) => item.type === MessageType.RunCollectionProgress);
      assert.strictEqual(progress.response.sse.state, path === '/status-error' ? 'completed' : path === '/forever' ? 'timeout' : 'error');
      assert.strictEqual(posted.find((item) => item.type === MessageType.RunCollectionDone).failed, 1);
      assert.strictEqual(histories.length, 1);
      if (path !== '/status-error') {
        assert.ok(progress.error);
        assert.strictEqual(histories[0].response, null);
        assert.ok(progress.response.sse.events.length > 0);
      }
    });
  }

  it('프로필 무효화 뒤 실제 stream 소켓을 닫고 이전 세대의 종료 메시지/히스토리를 버린다', async () => {
    const { host, posted, histories } = hostFixture();
    let current = true;
    host.isExecutionContextCurrent = () => current;
    const executor = new RequestExecutorCtor(new HttpService(), host);
    const pending = executor.execute(message(baseUrl + '/forever'));
    await waitUntil(() => posted.some((item) => item.type === MessageType.ReceiveSseUpdate && item.update.phase === 'events'));
    current = false;
    const count = posted.length;
    executor.cancelAll();
    await pending;
    assert.strictEqual(posted.length, count);
    assert.strictEqual(histories.length, 0);
    await waitUntil(() => foreverSockets.size === 0);
  });
});

describe('SSE execution generation guards', () => {
  it('새 요청이 시작된 뒤 이전 run의 늦은 SSE callback/응답을 모두 버린다', async () => {
    const { host, posted, histories } = hostFixture();
    const handles: Array<{ options: HttpSendOptions; resolve: (response: Response) => void }> = [];
    const service = {
      send(_method: string, _url: string, _headers: KeyValue[], _body: unknown, options: HttpSendOptions): SendHandle {
        let resolve!: (response: Response) => void;
        const promise = new Promise<Response>((done) => { resolve = done; });
        handles.push({ options, resolve });
        return { promise, abort: () => undefined };
      },
    };
    const executor = new RequestExecutorCtor(service as unknown as HttpService, host);
    const first = executor.execute(message('http://fixture.local/old'));
    await waitUntil(() => handles.length === 1);
    const second = executor.execute(message('http://fixture.local/new'));
    await waitUntil(() => handles.length === 2);
    const stream = new SseStream({ status: 200, statusText: 'OK', headers: {} }, Date.now(), handles[0].options.onSseUpdate, { maxBatchEvents: 1 });
    stream.start();
    stream.push(Buffer.from('data: late-old\n\n'));
    const old = stream.end('completed');
    handles[0].resolve({ status: 200, statusText: 'OK', headers: {}, body: old.rawBody, time: 1, size: 1, sse: old });
    handles[1].resolve({ status: 200, statusText: 'OK', headers: {}, body: 'new', time: 1, size: 3 });
    await Promise.all([first, second]);
    assert.strictEqual(posted.filter((item) => item.type === MessageType.ReceiveSseUpdate).length, 0);
    assert.strictEqual(posted.filter((item) => item.type === MessageType.ReceiveResponse).length, 1);
    assert.strictEqual(posted.find((item) => item.type === MessageType.ReceiveResponse).response.body, 'new');
    assert.strictEqual(histories.length, 1);
    assert.strictEqual(histories[0].request.url, 'http://fixture.local/new');
  });
});
