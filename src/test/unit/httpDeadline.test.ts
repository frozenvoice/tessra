import * as assert from 'assert';
import * as http from 'http';
import * as net from 'net';
import { EventEmitter } from 'events';
import { HttpService, SendHandle } from '../../services/HttpService';
import { RequestDeadline, RequestTimeoutError } from '../../services/RequestDeadline';

const realSetTimeout = global.setTimeout;
const realClearTimeout = global.clearTimeout;

async function within<T>(promise: Promise<T>, milliseconds = 1500): Promise<T> {
  let safety: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      safety = realSetTimeout(() => reject(new Error('Test safety deadline exceeded')), milliseconds);
    })]);
  } finally { realClearTimeout(safety); }
}

class Clock {
  now = 0;
  private sequence = 0;
  readonly timers = new Map<number, { at: number; callback: () => void }>();
  schedule = (callback: () => void, delay = 0) => {
    const id = ++this.sequence;
    this.timers.set(id, { at: this.now + delay, callback });
    return id;
  };
  clear = (id: number) => { this.timers.delete(id); };
  advance(milliseconds: number): void {
    const target = this.now + milliseconds;
    for (;;) {
      const due = [...this.timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.now = due[1].at;
      this.timers.delete(due[0]);
      due[1].callback();
    }
    this.now = target;
  }
}

class FakeResponse extends EventEmitter {
  destroyed = false;
  complete = false;
  statusMessage = 'Fixture';
  constructor(public statusCode = 200, public headers: http.IncomingHttpHeaders = { 'content-type': 'text/plain' }) { super(); }
  resume(): this { return this; }
  destroy(): this { this.destroyed = true; return this; }
  finish(): void { this.complete = true; this.emit('end'); }
}

class FakeRequest extends EventEmitter {
  destroyed = false;
  written: string | Buffer = '';
  idleCallback?: () => void;
  constructor(private readonly callback: (response: http.IncomingMessage) => void) { super(); }
  setTimeout(_ms: number, callback?: () => void): this { this.idleCallback = callback; return this; }
  write(body: string | Buffer): this { this.written = body; return this; }
  end(): this { return this; }
  destroy(): this { this.destroyed = true; return this; }
  respond(response = new FakeResponse()): FakeResponse {
    this.callback(response as unknown as http.IncomingMessage);
    return response;
  }
}

describe('HttpService total network deadline', function() {
  this.timeout(5000);
  const nativeHttp = require('http') as typeof http;
  const realRequest = nativeHttp.request;
  let clock: Clock;
  let requests: FakeRequest[];
  let handles: SendHandle[];
  beforeEach(() => {
    clock = new Clock(); requests = []; handles = [];
    global.setTimeout = clock.schedule as unknown as typeof setTimeout;
    global.clearTimeout = clock.clear as unknown as typeof clearTimeout;
    nativeHttp.request = ((_options: unknown, callback: (res: http.IncomingMessage) => void) => {
      const request = new FakeRequest(callback); requests.push(request); return request;
    }) as unknown as typeof http.request;
  });
  afterEach(() => {
    for (const handle of handles) handle.abort();
    global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout;
    nativeHttp.request = realRequest;
  });
  function send(seconds = 0.1, extra: Parameters<HttpService['send']>[4] = {}, body = ''): SendHandle {
    const handle = new HttpService().send('POST', 'http://fixture.invalid/', [], body, {
      timeoutSec: seconds, deadline: new RequestDeadline(seconds, () => clock.now), ...extra,
    });
    // 제어 transport의 동기 이벤트가 reject해도 다음 await까지 미처리 상태로 두지 않는다.
    handle.promise.catch(() => undefined);
    handles.push(handle);
    return handle;
  }

  it('expires before a delayed connection callback and releases its request and timer', async () => {
    const handle = send();
    clock.advance(100);
    await assert.rejects(within(handle.promise), RequestTimeoutError);
    assert.strictEqual(requests[0].destroyed, true);
    assert.strictEqual(clock.timers.size, 0);
    const late = requests[0].respond();
    assert.strictEqual(late.destroyed, true);
    late.emit('data', Buffer.from('late')); late.finish();
    assert.strictEqual(requests.length, 1);
  });

  it('includes an upload that has not produced response headers', async () => {
    const handle = send(0.1, {}, Buffer.alloc(1024).toString());
    assert.strictEqual(requests[0].written.length, 1024);
    clock.advance(100);
    await assert.rejects(within(handle.promise), RequestTimeoutError);
    assert.ok(requests[0].destroyed);
    assert.strictEqual(clock.timers.size, 0);
  });

  it('expires while body chunks keep arriving without any socket idle timeout', async () => {
    const handle = send();
    const response = requests[0].respond();
    for (let index = 0; index < 3; index++) {
      clock.advance(25); response.emit('data', Buffer.from('chunk'));
    }
    clock.advance(25);
    await assert.rejects(within(handle.promise), RequestTimeoutError);
    assert.ok(response.destroyed && requests[0].destroyed);
    assert.strictEqual(clock.timers.size, 0);
    response.finish();
    assert.strictEqual(requests.length, 1);
  });

  it('expires an endless redirect body without starting the next request', async () => {
    const handle = send(0.1, { followRedirects: true });
    const response = requests[0].respond(new FakeResponse(302, { location: '/next' }));
    clock.advance(50); response.emit('data', Buffer.from('still streaming'));
    clock.advance(50);
    await assert.rejects(within(handle.promise), RequestTimeoutError);
    assert.ok(response.destroyed && requests[0].destroyed);
    assert.strictEqual(clock.timers.size, 0);
    response.finish();
    assert.strictEqual(requests.length, 1);
  });

  it('shares one budget across multiple redirect hops and ignores old attempt callbacks', async () => {
    const handle = send(0.1, { followRedirects: true });
    const first = requests[0];
    const oldIdleCallback = first.idleCallback;
    clock.advance(40);
    const oldResponse = first.respond(new FakeResponse(302, { location: '/second' }));
    oldResponse.finish();
    assert.strictEqual(requests.length, 2);
    oldIdleCallback?.(); first.emit('error', new Error('late first error')); oldResponse.emit('aborted');
    assert.strictEqual(requests[1].destroyed, false);
    clock.advance(40);
    requests[1].respond(new FakeResponse(302, { location: '/third' })).finish();
    assert.strictEqual(requests.length, 3);
    clock.advance(20);
    await assert.rejects(within(handle.promise), RequestTimeoutError);
    assert.ok(requests[2].destroyed);
    assert.strictEqual(clock.timers.size, 0);
  });

  it('accepts completion just before the deadline and clears timers', async () => {
    const handle = send();
    const response = requests[0].respond();
    clock.advance(99); response.emit('data', Buffer.from('ok')); response.finish();
    assert.strictEqual((await within(handle.promise)).body, 'ok');
    assert.strictEqual(clock.timers.size, 0);
    clock.advance(1000); handle.abort();
  });

  it('clears both timers and the stream when headers-only completes before the body', async () => {
    const handle = send(0.1, { stopAfterHeaders: true });
    const response = requests[0].respond();
    assert.strictEqual((await within(handle.promise)).body, '');
    assert.ok(response.destroyed && requests[0].destroyed);
    assert.strictEqual(requests[0].idleCallback, undefined);
    assert.strictEqual(clock.timers.size, 0);
    clock.advance(1000); response.finish();
  });

  it('settles and cleans up once when the socket idle timeout wins first', async () => {
    const handle = send();
    const request = requests[0];
    const idleCallback = request.idleCallback!;
    const response = request.respond();
    idleCallback(); idleCallback();
    await assert.rejects(within(handle.promise), RequestTimeoutError);
    assert.ok(request.destroyed && response.destroyed);
    assert.strictEqual(clock.timers.size, 0);
    assert.strictEqual(request.idleCallback, undefined);
  });

  it('rejects an already exhausted shared budget without opening a socket', async () => {
    const deadline = new RequestDeadline(0.1, () => clock.now);
    clock.advance(100);
    const handle = send(0, { deadline });
    await assert.rejects(within(handle.promise), RequestTimeoutError);
    assert.strictEqual(requests.length, 0);
    assert.strictEqual(clock.timers.size, 0);
  });

  it('keeps timeout=0 unlimited without a deadline timer', async () => {
    const handle = send(0);
    assert.strictEqual(clock.timers.size, 0);
    clock.advance(86400000);
    const response = requests[0].respond();
    response.emit('data', Buffer.from('unlimited')); response.finish();
    assert.strictEqual((await within(handle.promise)).body, 'unlimited');
  });

  it('checks the deadline after synchronous decompression even before timers can run', async () => {
    const nativeZlib = require('zlib') as typeof import('zlib');
    const realGunzip = nativeZlib.gunzipSync;
    nativeZlib.gunzipSync = (() => { clock.now += 101; return Buffer.from('decoded'); }) as typeof nativeZlib.gunzipSync;
    try {
      const handle = send();
      const response = requests[0].respond(new FakeResponse(200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' }));
      response.emit('data', Buffer.from('fixture')); response.finish();
      await assert.rejects(within(handle.promise), RequestTimeoutError);
      assert.strictEqual(clock.timers.size, 0);
    } finally { nativeZlib.gunzipSync = realGunzip; }
  });

  it('makes Stop idempotent and prevents late response/errors from disturbing a new request', async () => {
    const old = send();
    const oldRequest = requests[0];
    old.abort(); old.abort();
    await assert.rejects(within(old.promise), /canceled/);
    assert.strictEqual(clock.timers.size, 0);
    const next = send();
    const late = oldRequest.respond();
    oldRequest.emit('error', new Error('late canceled error'));
    late.emit('data', Buffer.from('late')); late.finish(); old.abort();
    assert.ok(late.destroyed);
    assert.strictEqual(requests[1].destroyed, false);
    const response = requests[1].respond(); response.emit('data', Buffer.from('next')); response.finish();
    assert.strictEqual((await within(next.promise)).body, 'next');
    assert.strictEqual(clock.timers.size, 0);
  });

  it('clears the deadline timer and stream on transport failure', async () => {
    const handle = send();
    const response = requests[0].respond();
    response.emit('error', new Error('fixture stream failure'));
    await assert.rejects(within(handle.promise), /fixture stream failure/);
    assert.ok(response.destroyed && requests[0].destroyed);
    assert.strictEqual(clock.timers.size, 0);
  });
});

describe('HttpService deadline with real local sockets', function() {
  this.timeout(5000);
  for (const redirect of [false, true]) {
    it(`closes a continuously streaming ${redirect ? 'redirect' : 'response'} on budget expiry`, async () => {
      const sockets = new Set<net.Socket>();
      const intervals = new Set<ReturnType<typeof setInterval>>();
      let attempts = 0;
      let closed!: () => void;
      const socketClosed = new Promise<void>((resolve) => { closed = resolve; });
      const server = http.createServer((_request, response) => {
        attempts++;
        response.writeHead(redirect ? 302 : 200, redirect ? { location: '/never' } : { 'content-type': 'text/plain' });
        response.flushHeaders();
        const timer = setInterval(() => response.write('drip'), 10);
        intervals.add(timer);
        response.on('close', () => { clearInterval(timer); intervals.delete(timer); });
      });
      server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => { sockets.delete(socket); closed(); });
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const started = process.hrtime.bigint();
      const handle = new HttpService().send('GET', `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/`, [], '', {
        timeoutSec: 0.15, followRedirects: true,
      });
      try {
        await assert.rejects(within(handle.promise), RequestTimeoutError);
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
        await within(socketClosed);
        assert.strictEqual(sockets.size, 0);
        assert.strictEqual(intervals.size, 0);
        assert.strictEqual(attempts, 1);
        console.info(`    local ${redirect ? 'redirect' : 'body'} fixture: budget 150ms, timeout observed ${elapsedMs.toFixed(3)}ms, sockets 0, attempts 1`);
      } finally {
        handle.abort();
        for (const timer of intervals) clearInterval(timer);
        for (const socket of sockets) socket.destroy();
        await within(new Promise<void>((resolve) => server.close(() => resolve())));
      }
    });
  }

  it('cancels delayed DNS and ignores its late lookup callback without connecting', async () => {
    const nativeDns = require('dns') as typeof import('dns');
    const realLookup = nativeDns.lookup;
    let reply: (() => void) | undefined;
    let connections = 0;
    const server = http.createServer((_req, res) => res.end('unexpected'));
    const sockets = new Set<net.Socket>();
    server.on('connection', (socket) => {
      connections++; sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    nativeDns.lookup = ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
      assert.strictEqual(hostname, 'delayed-dns.fixture.invalid');
      reply = () => callback(null, ...(options.all ? [[{ address: '127.0.0.1', family: 4 }]] : ['127.0.0.1', 4]));
    }) as typeof nativeDns.lookup;
    const handle = new HttpService().send('GET', `http://delayed-dns.fixture.invalid:${(server.address() as net.AddressInfo).port}/`, [], '', { timeoutSec: 0.1 });
    try {
      assert.ok(reply, 'the real socket must be waiting for the controlled DNS callback');
      await assert.rejects(within(handle.promise), RequestTimeoutError);
      reply!();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.strictEqual(connections, 0);
      assert.strictEqual(sockets.size, 0);
    } finally {
      nativeDns.lookup = realLookup; handle.abort();
      for (const socket of sockets) socket.destroy();
      await within(new Promise<void>((resolve) => server.close(() => resolve())));
    }
  });

  it('includes a stalled TLS handshake and closes its socket on expiry', async () => {
    const sockets = new Set<net.Socket>();
    let closed!: () => void;
    const socketClosed = new Promise<void>((resolve) => { closed = resolve; });
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('data', () => undefined);
      socket.on('error', () => undefined);
      socket.on('close', () => { sockets.delete(socket); closed(); });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const handle = new HttpService().send('GET', `https://127.0.0.1:${(server.address() as net.AddressInfo).port}/`, [], '', { timeoutSec: 0.15 });
    try {
      await assert.rejects(within(handle.promise), RequestTimeoutError);
      await within(socketClosed);
      assert.strictEqual(sockets.size, 0);
    } finally {
      handle.abort();
      for (const socket of sockets) socket.destroy();
      await within(new Promise<void>((resolve) => server.close(() => resolve())));
    }
  });
});
