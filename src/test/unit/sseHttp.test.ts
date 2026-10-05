import * as assert from 'assert';
import * as http from 'http';
import * as net from 'net';
import * as zlib from 'zlib';
import { HttpService, HttpSendOptions } from '../../services/HttpService';
import { RequestDeadline, RequestTimeoutError } from '../../services/RequestDeadline';
import { SseStream, SseStreamUpdate, getSseSnapshot } from '../../services/SseStream';

describe('HttpService incremental SSE', () => {
  let server: http.Server;
  let baseUrl: string;
  const sockets = new Set<net.Socket>();
  let activeStreams = 0;
  let requestCount = 0;
  let externalRedirectUrl = '';
  const service = new HttpService();
  const streamBody = '\uFEFF: comment\r\nevent: update\r\nid: fixture\r\nretry: 1000\r\ndata: 한글 😀\r\ndata: second\r\n\r\ndata: next\n\n';

  before(async () => {
    server = http.createServer((req, res) => {
      requestCount++;
      const path = new URL(req.url ?? '/', 'http://fixture').pathname;
      if (path === '/ordinary') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=windows-1252' });
        res.end(Buffer.from([0x63, 0x61, 0x66, 0xe9]));
        return;
      }
      if (path === '/binary') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(Buffer.from([0, 255, 128]));
        return;
      }
      if (path === '/almost-sse') {
        res.writeHead(200, { 'Content-Type': 'text/event-streaming' });
        res.end('data: ordinary\n\n');
        return;
      }
      if (path === '/redirect') {
        res.writeHead(302, { Location: `${baseUrl}/complete` });
        res.end();
        return;
      }
      if (path === '/external-redirect') {
        res.writeHead(302, { Location: externalRedirectUrl });
        res.end();
        return;
      }
      res.statusCode = path === '/status-error' ? 500 : 200;
      res.setHeader('Content-Type', 'Text/Event-Stream; charset=iso-8859-1');
      if (path === '/complete' || path === '/status-error') { res.end(streamBody); return; }
      if (path === '/incomplete') { res.end('data: complete\n\ndata: incomplete\n'); return; }
      if (path === '/retention') { res.end('data: event\n\n'.repeat(650)); return; }
      if (path === '/oversize-event') {
        res.end('data: ' + 'x'.repeat(600) + '\n\ndata: recovery\n\n');
        return;
      }
      if (path === '/large-raw') {
        res.end((':' + 'x'.repeat(1000) + '\n').repeat(1200) + 'data: kept\n\n');
        return;
      }
      if (path === '/wire-limit') { res.end('data: ' + 'x'.repeat(2000) + '\n\n'); return; }
      if (path === '/disconnect') {
        res.write('data: before-error\n\n');
        const timer = setTimeout(() => res.destroy(new Error('fixture transport failure')), 90);
        res.on('close', () => clearTimeout(timer));
        return;
      }
      if (path === '/gzip' || path === '/deflate' || path === '/br' || path === '/stacked' || path === '/compressed-limit' || path === '/bad-gzip') {
        const encoding = path === '/deflate' ? 'deflate' : path === '/br' ? 'br' : path === '/stacked' ? 'gzip, br' : 'gzip';
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Content-Encoding': encoding });
        const input = Buffer.from(path === '/compressed-limit' ? 'data: ' + 'x'.repeat(20000) + '\n\n' : streamBody);
        if (path === '/bad-gzip') { res.end('not gzip'); return; }
        const output = path === '/deflate' ? zlib.deflateSync(input)
          : path === '/br' ? zlib.brotliCompressSync(input)
          : path === '/stacked' ? zlib.brotliCompressSync(zlib.gzipSync(input))
          : zlib.gzipSync(input);
        res.end(output);
        return;
      }
      if (path === '/unsupported-encoding') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Content-Encoding': 'unknown' });
        res.end(streamBody);
        return;
      }
      if (path === '/split') {
        const bytes = Buffer.from(streamBody);
        activeStreams++;
        let index = 0;
        const timer = setInterval(() => {
          if (index >= bytes.length) { clearInterval(timer); res.end(); return; }
          res.write(bytes.subarray(index, ++index));
        }, 1);
        res.on('close', () => { clearInterval(timer); activeStreams--; });
        return;
      }
      if (path === '/gzip-slow') {
        activeStreams++;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Content-Encoding': 'gzip' });
        const encoder = zlib.createGzip({ flush: zlib.constants.Z_SYNC_FLUSH });
        encoder.pipe(res);
        encoder.write('data: early compressed\n\n');
        const timer = setTimeout(() => encoder.end('data: final compressed\n\n'), 180);
        res.on('close', () => { clearTimeout(timer); encoder.destroy(); activeStreams--; });
        return;
      }
      if (path === '/slow' || path === '/forever') {
        activeStreams++;
        let count = 1;
        res.write('data: first\n\n');
        const interval = setInterval(() => res.write(`data: ${count++}\n\n`), 10);
        const endTimer = path === '/slow' ? setTimeout(() => res.end('data: final\n\n'), 180) : undefined;
        res.on('close', () => { clearInterval(interval); clearTimeout(endTimer); activeStreams--; });
        return;
      }
      res.end('data: default\n\n');
    });
    server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
  });

  after(async () => {
    for (const socket of sockets) { socket.destroy(); }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function send(path: string, options: HttpSendOptions = {}) {
    const updates: SseStreamUpdate[] = [];
    const userCallback = options.onSseUpdate;
    const handle = service.send('GET', baseUrl + path, [], '', {
      timeoutSec: 2,
      ...options,
      onSseUpdate: (update) => { updates.push(update); userCallback?.(update); },
    });
    return { handle, updates };
  }

  async function waitUntil(predicate: () => boolean, timeoutMs = 1000) {
    const started = Date.now();
    while (!predicate()) {
      if (Date.now() - started > timeoutMs) { throw new Error('fixture condition timed out'); }
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
  }

  it('서버 EOF 전 중간 이벤트를 묶음 표시하고 EOF는 completed로 종료한다', async () => {
    const { handle, updates } = send('/slow');
    let completed = false;
    const responsePromise = handle.promise.then((response) => { completed = true; return response; });
    await waitUntil(() => updates.some((update) => update.phase === 'events'));
    assert.strictEqual(completed, false);
    const batch = updates.find((update) => update.phase === 'events')!;
    assert.ok(batch.events.length >= 2);
    assert.strictEqual(batch.summary.state, 'receiving');
    assert.strictEqual(batch.snapshot, undefined);
    const response = await responsePromise;
    const snapshot = getSseSnapshot(response)!;
    assert.strictEqual(snapshot.state, 'completed');
    assert.strictEqual(snapshot.events.at(-1)?.data, 'final');
    assert.strictEqual(updates[0].phase, 'started');
    assert.strictEqual(updates.at(-1)?.phase, 'ended');
  });

  it('실제 chunk 경계를 가로지른 UTF-8/BOM/CRLF를 처리하고 charset label을 무시한다', async () => {
    const { handle } = send('/split');
    const response = await handle.promise;
    const snapshot = getSseSnapshot(response)!;
    assert.deepStrictEqual(snapshot.events.map(({ data, event, id }) => ({ data, event, id })), [
      { data: '한글 😀\nsecond', event: 'update', id: 'fixture' },
      { data: 'next', event: 'message', id: 'fixture' },
    ]);
    assert.strictEqual(snapshot.events[0].retry, '1000');
    assert.strictEqual(response.body, streamBody);
    assert.strictEqual(Buffer.from(response.bodyBase64!, 'base64').toString('utf8'), streamBody);
    assert.strictEqual(response.decodingWarning, undefined);
  });

  it('정상 EOF에서 마지막 불완전 이벤트는 폐기하고 loss metadata를 남긴다', async () => {
    const response = await send('/incomplete').handle.promise;
    const snapshot = getSseSnapshot(response)!;
    assert.strictEqual(snapshot.state, 'completed');
    assert.deepStrictEqual(snapshot.events.map((event) => event.data), ['complete']);
    assert.strictEqual(snapshot.droppedEvents, 1);
    assert.strictEqual(snapshot.notices[0].reason, 'incomplete-eof');
  });

  it('Stop 이후 소켓/fixture timer를 닫고 부분 이벤트는 aborted로 남긴다', async () => {
    const { handle, updates } = send('/forever', { timeoutSec: 0 });
    const rejection = handle.promise.catch((error: unknown) => error);
    await waitUntil(() => updates.some((update) => update.phase === 'events'));
    handle.abort();
    const error = await rejection;
    assert.match((error as Error).message, /canceled/);
    const partial = getSseSnapshot(error)!;
    assert.strictEqual(partial.state, 'aborted');
    assert.ok(partial.events.length > 0);
    assert.strictEqual(updates.at(-1)?.summary.state, 'aborted');
    const count = updates.length;
    await waitUntil(() => activeStreams === 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    assert.strictEqual(updates.length, count);
  });

  it('끊임없이 오는 이벤트도 전체 deadline을 연장하지 않고 timeout 클래스를 유지한다', async () => {
    const started = Date.now();
    const { handle, updates } = send('/forever', { timeoutSec: 0.12 });
    const error = await handle.promise.catch((value: unknown) => value);
    assert.ok(error instanceof RequestTimeoutError);
    assert.strictEqual(getSseSnapshot(error)?.state, 'timeout');
    assert.ok(getSseSnapshot(error)!.events.length > 0);
    assert.strictEqual(updates.at(-1)?.summary.state, 'timeout');
    assert.ok(Date.now() - started < 700);
    await waitUntil(() => activeStreams === 0);
  });

  it('기존 RequestDeadline의 남은 예산을 streaming에서도 공유한다', async () => {
    const deadline = new RequestDeadline(0.15);
    await new Promise<void>((resolve) => setTimeout(resolve, 90));
    const started = Date.now();
    const error = await send('/forever', { timeoutSec: 3, deadline }).handle.promise.catch((value: unknown) => value);
    assert.ok(error instanceof RequestTimeoutError);
    assert.strictEqual(getSseSnapshot(error)?.state, 'timeout');
    assert.ok(Date.now() - started < 400);
    await waitUntil(() => activeStreams === 0);
  });

  it('transport 실패를 정상 EOF와 구분하고 이미 받은 이벤트를 error 상태로 남긴다', async () => {
    const { handle, updates } = send('/disconnect');
    const error = await handle.promise.catch((value: unknown) => value);
    assert.ok(error instanceof Error);
    assert.strictEqual(getSseSnapshot(error)?.state, 'error');
    assert.deepStrictEqual(getSseSnapshot(error)?.events.map((event) => event.data), ['before-error']);
    assert.strictEqual(updates.at(-1)?.summary.state, 'error');
  });

  it('SSE HTTP 500도 started/ended를 전달하고 HttpService가 POST를 자동 재전송하지 않는다', async () => {
    const beforeCount = requestCount;
    const updates: SseStreamUpdate[] = [];
    const response = await service.send('POST', baseUrl + '/status-error', [], 'request-body', { onSseUpdate: (update) => updates.push(update) }).promise;
    assert.strictEqual(response.status, 500);
    assert.strictEqual(getSseSnapshot(response)?.state, 'completed');
    assert.strictEqual(updates[0].phase, 'started');
    assert.strictEqual(requestCount - beforeCount, 1);
  });

  it('SSE 후 일반 HTTP/바이너리 응답에는 streaming 경로가 적용되지 않는다', async () => {
    for (const path of ['/ordinary', '/binary', '/almost-sse']) {
      const { handle, updates } = send(path);
      const response = await handle.promise;
      assert.strictEqual(getSseSnapshot(response), undefined);
      assert.deepStrictEqual(updates, []);
      if (path === '/ordinary') { assert.strictEqual(response.body, 'café'); }
      if (path === '/binary') { assert.strictEqual(response.bodyBase64, Buffer.from([0, 255, 128]).toString('base64')); }
    }
  });

  it('header 전용 요청은 SSE body를 구독하지 않는다', async () => {
    const { handle, updates } = send('/forever', { stopAfterHeaders: true });
    const response = await handle.promise;
    assert.strictEqual(response.body, '');
    assert.deepStrictEqual(updates, []);
    assert.strictEqual(getSseSnapshot(response), undefined);
    await waitUntil(() => activeStreams === 0);
  });

  it('기존 redirect 옵션을 따른 최종 SSE 응답만 구독한다', async () => {
    const { handle, updates } = send('/redirect', { followRedirects: true });
    const response = await handle.promise;
    assert.strictEqual(response.status, 200);
    assert.strictEqual(getSseSnapshot(response)?.events.length, 2);
    assert.strictEqual(updates.filter((update) => update.phase === 'started').length, 1);
  });

  it('교차 origin 리다이렉트의 최종 SSE 서버에는 인증성 header가 전달되지 않는다', async () => {
    let captured: http.IncomingHttpHeaders | undefined;
    const target = http.createServer((request, response) => {
      captured = request.headers;
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.end('data: success\n\n');
    });
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    externalRedirectUrl = `http://127.0.0.1:${(target.address() as net.AddressInfo).port}/`;
    try {
      const response = await service.send('GET', baseUrl + '/external-redirect', [
        { key: 'Authorization', value: 'Bearer synthetic', enabled: true },
        { key: 'Cookie', value: 'fixture=synthetic', enabled: true },
        { key: 'X-API-Key', value: 'synthetic', enabled: true },
        { key: 'X-Fixture', value: 'allowed', enabled: true },
      ], '', { followRedirects: true }).promise;
      assert.strictEqual(getSseSnapshot(response)?.events[0].data, 'success');
      assert.strictEqual(captured?.authorization, undefined);
      assert.strictEqual(captured?.cookie, undefined);
      assert.strictEqual(captured?.['x-api-key'], undefined);
      assert.strictEqual(captured?.['x-fixture'], 'allowed');
    } finally { await new Promise<void>((resolve) => target.close(() => resolve())); }
  });

  it('gzip/deflate/Brotli 및 중첩 content encoding을 증분 처리한다', async () => {
    for (const path of ['/gzip', '/deflate', '/br', '/stacked']) {
      const response = await send(path).handle.promise;
      const snapshot = getSseSnapshot(response)!;
      assert.strictEqual(snapshot.state, 'completed', path);
      assert.strictEqual(snapshot.events[0].data, '한글 😀\nsecond', path);
      assert.strictEqual(response.body, streamBody, path);
      assert.strictEqual(response.size, Buffer.byteLength(streamBody));
      assert.strictEqual(snapshot.decodedBytes, response.size);
      assert.ok(snapshot.wireBytes > 0);
    }
  });

  it('압축 stream도 EOF 전 초기 이벤트를 보여준다', async () => {
    const { handle, updates } = send('/gzip-slow');
    let complete = false;
    const pending = handle.promise.then((response) => { complete = true; return response; });
    await waitUntil(() => updates.some((update) => update.phase === 'events'));
    assert.strictEqual(complete, false);
    assert.strictEqual(updates.find((update) => update.phase === 'events')?.events[0].data, 'early compressed');
    assert.strictEqual(getSseSnapshot(await pending)?.events.length, 2);
  });

  it('압축 stream의 Stop도 decoder/소켓을 정리하고 late EOF를 무시한다', async () => {
    const { handle, updates } = send('/gzip-slow');
    const pending = handle.promise.catch((error: unknown) => error);
    await waitUntil(() => updates.some((update) => update.phase === 'events'));
    handle.abort();
    const error = await pending;
    assert.strictEqual(getSseSnapshot(error)?.state, 'aborted');
    assert.strictEqual(getSseSnapshot(error)?.events[0].data, 'early compressed');
    const count = updates.length;
    await waitUntil(() => activeStreams === 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    assert.strictEqual(updates.length, count);
  });

  it('압축 stream의 deadline도 decoder를 정리하고 부분 응답을 timeout으로 보존한다', async () => {
    const error = await send('/gzip-slow', { timeoutSec: 0.09 }).handle.promise.catch((value: unknown) => value);
    assert.ok(error instanceof RequestTimeoutError);
    assert.strictEqual(getSseSnapshot(error)?.state, 'timeout');
    assert.strictEqual(getSseSnapshot(error)?.events[0].data, 'early compressed');
    await waitUntil(() => activeStreams === 0);
  });

  it('단일 chunk 처리 중에도 배치 경계에서 만료를 확인하고 늦은 이벤트를 전달하지 않는다', async () => {
    let now = 0;
    const deadline = new RequestDeadline(1, () => now);
    const { handle, updates } = send('/retention', {
      deadline,
      sseOptions: { maxBatchEvents: 2 },
      onSseUpdate: (update) => { if (update.phase === 'events') { now = 2000; } },
    });
    const error = await handle.promise.catch((value: unknown) => value);
    assert.ok(error instanceof RequestTimeoutError);
    assert.strictEqual(getSseSnapshot(error)?.state, 'timeout');
    assert.strictEqual(updates.filter((update) => update.phase === 'events').length, 1);
    assert.strictEqual(updates.at(-1)?.phase, 'ended');
    assert.ok(getSseSnapshot(error)!.receivedEvents < 650);
  });

  it('wire 크기와 압축 해제 크기 제한을 유지하고 제한 실패를 partial error로 표시한다', async () => {
    for (const path of ['/wire-limit', '/compressed-limit']) {
      const { handle, updates } = send(path, { maxResponseSizeBytes: 1024 });
      const error = await handle.promise.catch((value: unknown) => value);
      assert.match((error as Error).message, /exceeded max size/);
      assert.strictEqual(getSseSnapshot(error)?.state, 'error');
      assert.strictEqual(updates.at(-1)?.phase, 'ended');
    }
  });

  it('압축 오류/미지원 encoding도 SSE 오류로 종료한다', async () => {
    for (const path of ['/bad-gzip', '/unsupported-encoding']) {
      const error = await send(path).handle.promise.catch((value: unknown) => value);
      assert.ok(error instanceof Error);
      assert.strictEqual(getSseSnapshot(error)?.state, 'error');
      assert.match((error as Error).message, /decompress|Unsupported content encoding/);
    }
  });

  it('단일 이벤트 상한을 넘으면 event를 위조하지 않고 다음 이벤트에서 복구한다', async () => {
    const response = await send('/oversize-event', { sseOptions: { maxLineBytes: 128, maxEventBytes: 128 } }).handle.promise;
    const snapshot = getSseSnapshot(response)!;
    assert.deepStrictEqual(snapshot.events.map((event) => event.data), ['recovery']);
    assert.strictEqual(snapshot.droppedEvents, 1);
    assert.strictEqual(snapshot.notices[0].reason, 'line-limit');
  });

  it('화면 보관량 500개와 raw preview 1MiB 상한 및 유실을 명시한다', async () => {
    const response = await send('/retention').handle.promise;
    const snapshot = getSseSnapshot(response)!;
    assert.strictEqual(snapshot.events.length, 500);
    assert.strictEqual(snapshot.receivedEvents, 650);
    assert.strictEqual(snapshot.evictedEvents, 150);
    assert.ok(snapshot.retainedBytes <= 2 * 1024 * 1024);
    const large = getSseSnapshot(await send('/large-raw').handle.promise)!;
    assert.strictEqual(Buffer.from(large.rawBodyBase64, 'base64').length, 1024 * 1024);
    assert.strictEqual(large.rawTruncatedBytes, large.decodedBytes - 1024 * 1024);
    assert.ok(large.rawTruncatedBytes > 0);
    assert.strictEqual(large.events[0].data, 'kept');
  });

  it('UI callback가 throw해도 전송 event emitter 밖으로 예외가 새지 않는다', async () => {
    const response = await send('/complete', { onSseUpdate: () => { throw new Error('fixture subscriber failure'); } }).handle.promise;
    assert.strictEqual(getSseSnapshot(response)?.state, 'completed');
  });

  it('started callback에서 즉시 Stop해도 timer/소켓/이벤트가 남지 않는다', async () => {
    let handle: ReturnType<HttpService['send']>;
    const updates: SseStreamUpdate[] = [];
    handle = service.send('GET', baseUrl + '/forever', [], '', {
      onSseUpdate: (update) => { updates.push(update); if (update.phase === 'started') { handle.abort(); } },
    });
    const error = await handle.promise.catch((value: unknown) => value);
    assert.strictEqual(getSseSnapshot(error)?.state, 'aborted');
    assert.deepStrictEqual(updates.map((update) => update.phase), ['started', 'ended']);
    assert.strictEqual(getSseSnapshot(error)?.events.length, 0);
    await waitUntil(() => activeStreams === 0);
  });
});

describe('SseStream bounded retention and batching', () => {
  function stream(options: ConstructorParameters<typeof SseStream>[3] = {}) {
    const updates: SseStreamUpdate[] = [];
    const collector = new SseStream({ status: 200, statusText: 'OK', headers: {} }, Date.now(), (update) => updates.push(update), options);
    collector.start();
    return { collector, updates };
  }

  it('하나의 거대 chunk도 event 개수/byte 배치 상한으로 나눠 전달한다', () => {
    const { collector, updates } = stream({ maxBatchEvents: 7, maxBatchBytes: 120, maxRetainedEvents: 10, maxRetainedBytes: 80 });
    collector.push(Buffer.from('data: x\n\n'.repeat(10000)));
    const snapshot = collector.end('completed');
    assert.strictEqual(snapshot.receivedEvents, 10000);
    assert.strictEqual(snapshot.events.length, 10);
    assert.strictEqual(snapshot.evictedEvents, 9990);
    assert.strictEqual(snapshot.retainedBytes, 80);
    for (const update of updates) {
      assert.ok(update.events.length <= 7);
      assert.ok(update.events.reduce((sum, event) => sum + event.bytes, 0) <= 120);
    }
  });

  it('notice 보관/배치를 제한하고 생략 수와 누적 drop 수를 유지한다', () => {
    const { collector, updates } = stream({ maxLineBytes: 8 });
    collector.push(Buffer.from(('data: ' + 'x'.repeat(32) + '\n\n').repeat(1000)));
    const snapshot = collector.end('completed');
    assert.strictEqual(snapshot.notices.length, 20);
    assert.strictEqual(snapshot.omittedNotices, 980);
    assert.strictEqual(snapshot.droppedEvents, 1000);
    assert.ok(updates.every((update) => update.notices.length <= 20));
  });

  it('큰 이벤트를 많이 받아도 기본 2MiB 보관 상한을 올리지 않는다', () => {
    const { collector, updates } = stream({ maxRetainedBytes: 8 * 1024 * 1024, maxRawBytes: 8 * 1024 * 1024 });
    collector.push(Buffer.from(('data: ' + 'x'.repeat(200000) + '\n\n').repeat(15)));
    const snapshot = collector.end('completed');
    assert.strictEqual(snapshot.receivedEvents, 15);
    assert.strictEqual(snapshot.events.length, 10);
    assert.strictEqual(snapshot.evictedEvents, 5);
    assert.ok(snapshot.retainedBytes <= 2 * 1024 * 1024);
    assert.strictEqual(Buffer.from(snapshot.rawBodyBase64, 'base64').length, 1024 * 1024);
    assert.ok(updates.every((update) => update.events.reduce((sum, event) => sum + event.bytes, 0) <= 1024 * 1024));
  });

  it('부분 raw UTF-8가 잘려도 base64는 실제 byte prefix를 보존한다', () => {
    const { collector } = stream({ maxRawBytes: 9 });
    const bytes = Buffer.from('data: 😀\n\n');
    collector.push(bytes);
    const snapshot = collector.end('completed');
    assert.deepStrictEqual(Buffer.from(snapshot.rawBodyBase64, 'base64'), bytes.subarray(0, 9));
    assert.strictEqual(snapshot.rawTruncatedBytes, bytes.length - 9);
    assert.strictEqual(snapshot.events[0].data, '😀');
  });

  it('종료 후 flush timer와 늦은 push가 화면 update를 추가하지 않는다', async () => {
    const { collector, updates } = stream({ flushIntervalMs: 20 });
    collector.push(Buffer.from('data: partial\n\n'));
    collector.end('aborted');
    collector.push(Buffer.from('data: late\n\n'));
    const count = updates.length;
    await new Promise<void>((resolve) => setTimeout(resolve, 60));
    assert.strictEqual(updates.length, count);
    assert.strictEqual(collector.snapshot.events.length, 1);
    assert.strictEqual(collector.snapshot.state, 'aborted');
  });

  it('배치 callback 안의 취소는 callback 뒤 새 flush timer를 만들지 않는다', () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const scheduled = new Set<ReturnType<typeof setTimeout>>();
    global.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number) => {
      const timer = originalSetTimeout(callback, delay);
      scheduled.add(timer);
      return timer;
    }) as typeof setTimeout;
    global.clearTimeout = ((timer: ReturnType<typeof setTimeout>) => {
      scheduled.delete(timer);
      originalClearTimeout(timer);
    }) as typeof clearTimeout;
    try {
      const collector = new SseStream({ status: 200, statusText: 'OK', headers: {} }, Date.now(), (update) => {
        if (update.phase === 'events') { collector.end('aborted'); }
      }, { maxBatchBytes: 16 });
      collector.start();
      collector.push(Buffer.from('data: x\n\ndata: abcd\n\ndata: late\n\n'));
      assert.strictEqual(collector.snapshot.state, 'aborted');
      assert.strictEqual(scheduled.size, 0);
    } finally {
      for (const timer of scheduled) { originalClearTimeout(timer); }
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });
});
