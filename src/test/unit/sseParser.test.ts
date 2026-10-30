import * as assert from 'assert';
import { SseParser, SseParsedEvent, SseParserItem, SseParserOptions, SseParserNotice } from '../../services/SseParser';

function fixture(options: SseParserOptions = {}) {
  const items: SseParserItem[] = [];
  const parser = new SseParser(options, (item) => items.push(item));
  return {
    parser,
    items,
    events: () => items.filter((item): item is SseParsedEvent => item.type === 'event'),
    notices: () => items.filter((item): item is SseParserNotice => item.type === 'notice'),
    push: (text: string) => parser.push(Buffer.from(text, 'utf8')),
  };
}

describe('SseParser', () => {
  it('UTF-8/BOM/CRLF/이벤트의 모든 byte split 위치에서 같은 결과를 만든다', () => {
    const input = Buffer.from('\uFEFF: heartbeat\r\nevent: update\r\nid: 事件-1\r\nretry: 1500\r\ndata: 한글 😀\r\ndata: second\r\n\r\ndata: next\n\n');
    for (let split = 0; split <= input.length; split++) {
      const test = fixture();
      test.parser.push(input.subarray(0, split));
      test.parser.push(input.subarray(split));
      test.parser.finish();
      assert.deepStrictEqual(test.events().map(({ event, data, id, retry }) => ({ event, data, id, retry })), [
        { event: 'update', data: '한글 😀\nsecond', id: '事件-1', retry: '1500' },
        { event: 'message', data: 'next', id: '事件-1', retry: '1500' },
      ], `split ${split}`);
      assert.deepStrictEqual(test.notices(), []);
    }
  });

  it('UTF-8를 byte 단위로 나눠도 surrogate/문자 치환을 만들지 않는다', () => {
    const test = fixture();
    for (const byte of Buffer.from('\uFEFFdata: é한😀\r\n\r\n')) {
      test.parser.push(Uint8Array.of(byte));
    }
    assert.strictEqual(test.events()[0].data, 'é한😀');
    assert.strictEqual(test.events()[0].bytes, Buffer.byteLength('é한😀message'));
  });

  it('선두 BOM 한 개만 제거하고 이후 BOM은 data 그대로 남긴다', () => {
    const test = fixture();
    test.push('\uFEFFdata: \uFEFFinside\n\ndata: after\uFEFF\n\n');
    assert.deepStrictEqual(test.events().map((item) => item.data), ['\uFEFFinside', 'after\uFEFF']);
    const doubleBom = fixture();
    doubleBom.push('\uFEFF\uFEFFdata: ignored\n\ndata: good\n\n');
    assert.deepStrictEqual(doubleBom.events().map((item) => item.data), ['good']);
  });

  it('LF/CR/CRLF를 함께 사용하고 chunk 마지막 CR 뒤 LF를 중복 빈 줄로 보지 않는다', () => {
    const test = fixture();
    test.push('data: a\r');
    assert.strictEqual(test.events().length, 0);
    test.push('\ndata: b\r\r');
    assert.deepStrictEqual(test.events().map((item) => item.data), ['a\nb']);
    test.push('\ndata: c\n\ndata: d\r\n\r\n');
    assert.deepStrictEqual(test.events().map((item) => item.data), ['a\nb', 'c', 'd']);
  });

  it('콜론 없는 data와 빈 data는 빈 문자열 이벤트를 만들고 data 없는 블록은 만들지 않는다', () => {
    const test = fixture();
    test.push('data\n\nevent: ignored\n\ndata:\n\ndata: one\ndata\ndata: three\n\n');
    assert.deepStrictEqual(test.events().map(({ event, data }) => ({ event, data })), [
      { event: 'message', data: '' }, { event: 'message', data: '' }, { event: 'message', data: 'one\n\nthree' },
    ]);
  });

  it('필드 대소문자는 그대로 비교하고 값 앞의 ASCII space 하나만 제거한다', () => {
    const test = fixture();
    test.push('Data: ignored\nunknown: ignored\n:data: comment\ndata:  two spaces\ndata:\ttab\ndata: colon: preserved\n\n');
    assert.strictEqual(test.events()[0].data, ' two spaces\n\ttab\ncolon: preserved');
  });

  it('event 마지막 값/빈 값과 ID 상속/빈 ID/NUL 무시를 처리한다', () => {
    const test = fixture();
    test.push('id: persistent\n\nevent: first\nevent: last\ndata: a\n\nid: bad\0id\ndata: b\n\nevent:\nid:\ndata: c\n\ndata: d\n\n');
    assert.deepStrictEqual(test.events().map(({ event, id }) => ({ event, id })), [
      { event: 'last', id: 'persistent' }, { event: 'message', id: 'persistent' },
      { event: 'message', id: '' }, { event: 'message', id: '' },
    ]);
  });

  it('retry는 ASCII 숫자만 받아 큰 정수를 정밀도 손실 없이 metadata로 보존한다', () => {
    const test = fixture();
    test.push('retry: 999999999999999999999999999999999999\n\nretry: -1\nretry: 2.5\nretry: ４\nretry:\nretry: 1 2\ndata: a\n\n');
    assert.strictEqual(test.events()[0].retry, '999999999999999999999999999999999999');
    test.push('retry: 0\ndata: b\n\n');
    assert.strictEqual(test.events()[1].retry, '0');
    test.push('retry: 0000012\ndata: c\n\n');
    assert.strictEqual(test.events()[2].retry, '12');
  });

  it('HTML/명령/벤더 JSON처럼 보이는 내용도 그대로 문자열로 전달한다', () => {
    const test = fixture();
    const data = '<script>alert(1)</script> {"choices":[1]} command:tessra.delete';
    test.push(`data: ${data}\n\n`);
    assert.strictEqual(test.events()[0].data, data);
  });

  it('UTF-8 손상은 WHATWG UTF-8 decode의 replacement character로 처리한다', () => {
    const test = fixture();
    test.parser.push(Buffer.concat([Buffer.from('data: '), Buffer.from([0xff]), Buffer.from('\n\n')]));
    assert.strictEqual(test.events()[0].data, '\uFFFD');
    assert.strictEqual(test.events()[0].bytes, 10);
  });

  it('EOF의 data와 닫히지 않은 UTF-8 suffix는 이벤트로 임의 완성하지 않는다', () => {
    for (const ending of ['data: pending', 'data: pending\n', 'data: pending\r\n', 'event: pending\ndata: pending\n']) {
      const test = fixture();
      test.push('data: complete\n\n' + ending);
      test.parser.finish();
      assert.deepStrictEqual(test.events().map((item) => item.data), ['complete']);
      assert.strictEqual(test.notices()[0].reason, 'incomplete-eof');
      assert.strictEqual(test.parser.state.pendingBytes, 0);
      assert.strictEqual(test.parser.state.ended, true);
    }
    const suffix = fixture();
    suffix.parser.push(Buffer.concat([Buffer.from('data: '), Buffer.from([0xf0, 0x9f])]));
    suffix.parser.finish();
    assert.strictEqual(suffix.events().length, 0);
    assert.strictEqual(suffix.notices()[0].reason, 'incomplete-eof');
  });

  it('이미 완성된 CR 빈 줄은 다음 LF/EOF를 기다리지 않고 즉시 전달한다', () => {
    const test = fixture();
    test.push('data: done\r\r');
    assert.strictEqual(test.events()[0].data, 'done');
    test.parser.finish();
    assert.deepStrictEqual(test.notices(), []);
  });

  it('빈 스트림/완성 블록 뒤 EOF/주석만 있는 스트림을 불완전 이벤트로 표시하지 않는다', () => {
    for (const input of ['', '\uFEFF', '\n\n', ': comment\n', 'data: done\n\n']) {
      const test = fixture();
      test.push(input);
      test.parser.finish();
      assert.deepStrictEqual(test.notices(), [], input);
    }
  });

  it('취소/error discard는 EOF와 구분하고 이후 push/finish가 이벤트를 만들지 않는다', () => {
    const test = fixture();
    test.push('data: complete\n\ndata: pending');
    test.parser.discard();
    test.push('\n\ndata: late\n\n');
    test.parser.finish();
    test.parser.discard();
    assert.deepStrictEqual(test.events().map((item) => item.data), ['complete']);
    assert.deepStrictEqual(test.notices(), []);
    assert.strictEqual(test.parser.state.pendingBytes, 0);
  });

  it('단일 행 제한을 넘어선 블록 전체를 버리고 다음 블록에서 복구한다', () => {
    const test = fixture({ maxLineBytes: 16 });
    test.push('id: old\ndata: a\n\nid: new\ndata: ' + 'x'.repeat(1000) + '\ndata: not-dispatched\n\ndata: next\n\n');
    assert.deepStrictEqual(test.events().map(({ data, id }) => ({ data, id })), [
      { data: 'a', id: 'old' }, { data: 'next', id: 'old' },
    ]);
    assert.deepStrictEqual(test.notices(), [{ type: 'notice', reason: 'line-limit', limitBytes: 16, droppedEvents: 1 }]);
  });

  it('여러 작은 data 행의 합과 metadata에 이벤트 UTF-8 byte 제한을 적용한다', () => {
    const test = fixture({ maxEventBytes: 12 });
    test.push('event: t\nid: i\ndata: 한글\ndata: 한글\n\ndata: good\n\n');
    assert.deepStrictEqual(test.events().map((item) => item.data), ['good']);
    assert.strictEqual(test.events()[0].id, '');
    assert.strictEqual(test.notices()[0].reason, 'event-limit');
    assert.strictEqual(test.notices()[0].limitBytes, 12);
  });

  it('이벤트 제한에 맞는 다중 byte data는 허용하고 한 byte 초과는 버린다', () => {
    const exact = fixture({ maxEventBytes: 14 });
    exact.push('data: 한😀\n\n');
    assert.strictEqual(exact.events()[0].data, '한😀');
    assert.strictEqual(exact.events()[0].bytes, 14);
    const excess = fixture({ maxEventBytes: 13 });
    excess.push('data: 한😀\n\n');
    assert.strictEqual(excess.events().length, 0);
    assert.strictEqual(excess.notices()[0].reason, 'event-limit');
  });

  it('큰 retry metadata를 제한 전에 보관하지 않고 다음 블록을 정상 처리한다', () => {
    const test = fixture({ maxEventBytes: 16 });
    test.push('retry: ' + '9'.repeat(100) + '\n\ndata: next\n\n');
    assert.strictEqual(test.notices()[0].reason, 'event-limit');
    assert.strictEqual(test.events()[0].data, 'next');
    assert.strictEqual(test.events()[0].retry, undefined);
    assert.ok(test.parser.state.pendingBytes <= 16);
  });

  it('보관 data와 아직 줄바꿈 없는 행의 합을 pending 상한으로 제한한다', () => {
    const test = fixture({ maxEventBytes: 1000, maxLineBytes: 1000, maxPendingBytes: 20 });
    test.push('data: 1234567890\ndata: 1234567890');
    assert.strictEqual(test.notices()[0].reason, 'pending-limit');
    assert.strictEqual(test.parser.state.dropping, true);
    assert.ok(test.parser.state.pendingBytes <= 20);
    test.push('\n\ndata: good\n\n');
    assert.deepStrictEqual(test.events().map((item) => item.data), ['good']);
  });

  it('빈 data 행이 끝없이 오거나 단일 거대 chunk가 와도 버퍼 상한을 유지한다', () => {
    const test = fixture({ maxLineBytes: 32, maxEventBytes: 32, maxPendingBytes: 64 });
    test.push('data\n'.repeat(100000));
    assert.strictEqual(test.events().length, 0);
    assert.strictEqual(test.notices().length, 1);
    assert.strictEqual(test.notices()[0].reason, 'event-limit');
    assert.ok(test.parser.state.pendingBytes <= 64);
    test.push('\ndata: recovery\n\n');
    assert.deepStrictEqual(test.events().map((item) => item.data), ['recovery']);
    const huge = fixture({ maxLineBytes: 32, maxPendingBytes: 64 });
    huge.push('data: ' + 'x'.repeat(2 * 1024 * 1024));
    assert.strictEqual(huge.notices().length, 1);
    assert.ok(huge.parser.state.pendingBytes <= 64);
    huge.parser.finish();
    assert.strictEqual(huge.notices().length, 1);
  });

  it('하나의 chunk에 많은 이벤트가 있어도 sink에 순서대로 전달하고 출력 목록을 보관하지 않는다', () => {
    let count = 0;
    const parser = new SseParser({}, (item) => {
      assert.strictEqual(item.type, 'event');
      if (item.type === 'event') { assert.strictEqual(item.data, 'ok'); }
      count++;
    });
    parser.push(Buffer.from('data: ok\n\n'.repeat(50000)));
    assert.strictEqual(count, 50000);
    assert.strictEqual(parser.state.receivedEvents, count);
    assert.strictEqual(parser.state.pendingBytes, 0);
  });

  it('sink에서 중단해도 같은 chunk 뒤 이벤트가 전달되지 않는다', () => {
    const items: SseParserItem[] = [];
    const parser = new SseParser({}, (item) => { items.push(item); parser.discard(); });
    parser.push(Buffer.from('data: first\n\ndata: late\n\n'));
    assert.strictEqual(items.length, 1);
    assert.strictEqual(parser.state.ended, true);
  });

  it('제한 초과 시점마다 상태의 보관 byte 수가 설정 상한 안에 남는다', () => {
    const parser = new SseParser({ maxLineBytes: 24, maxEventBytes: 32, maxPendingBytes: 40 }, () => undefined);
    for (const byte of Buffer.from('id: prior\ndata: ok\n\nid: new\ndata: 한😀\ndata: 多'.repeat(100) + '\n\ndata: recovered\n\n')) {
      parser.push(Uint8Array.of(byte));
      assert.ok(parser.state.pendingBytes <= 40);
    }
    parser.finish();
    assert.strictEqual(parser.state.pendingBytes, 0);
  });
});
