import type { SseEvent as SseParsedEvent, SseNotice as SseParserNotice } from '../models/sse';
export type { SseEvent as SseParsedEvent, SseNotice as SseParserNotice } from '../models/sse';

export type SseParserItem = SseParsedEvent | SseParserNotice;

export interface SseParserOptions {
  maxLineBytes?: number;
  maxEventBytes?: number;
  maxPendingBytes?: number;
}

export interface SseParserState {
  // EOF/취소 후에는 진행 중 버퍼가 없으며 마지막 ID/retry metadata만 남는다.
  pendingBytes: number;
  dropping: boolean;
  droppedEvents: number;
  receivedEvents: number;
  lastEventId: string;
  retry?: string;
  ended: boolean;
}

/**
 * WHATWG event-stream UTF-8/행/필드 규칙을 따르는 증분 파서다.
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 *
 * sink는 동기 콜백이다. 호출자가 배치/보관량을 제한하므로 파서는 출력 목록을 쌓지 않는다.
 * 제한 초과 시 해당 블록 전체를 다음 빈 줄까지 버리며 잘린 이벤트를 완성하지 않는다.
 * pendingBytes는 보관 문자열의 UTF-8 바이트다. 디코더는 별도로 최대 3 바이트를 보관한다.
 * 정상 EOF는 finish(), 오류/사용자 취소는 discard()로 호출자가 구분한다.
 */
export class SseParser {
  static readonly DEFAULT_MAX_LINE_BYTES = 256 * 1024;
  static readonly DEFAULT_MAX_EVENT_BYTES = 256 * 1024;
  static readonly DEFAULT_MAX_PENDING_BYTES = 512 * 1024;
  private static readonly DECODE_SLICE_BYTES = 8 * 1024;

  private readonly decoder = new TextDecoder('utf-8');
  private readonly maxLineBytes: number;
  private readonly maxEventBytes: number;
  private readonly maxPendingBytes: number;
  private line = '';
  private lineBytes = 0;
  private data = '';
  private dataBytes = 0;
  private eventType = '';
  private eventTypeBytes = 0;
  private eventId = '';
  private eventIdBytes = 0;
  private lastEventId = '';
  private lastEventIdBytes = 0;
  private retry: string | undefined;
  private retryBytes = 0;
  private skipLf = false;
  private dropping = false;
  private droppedEvents = 0;
  private receivedEvents = 0;
  private ended = false;
  private blockHasFields = false;

  constructor(options: SseParserOptions = {}, private readonly sink: (item: SseParserItem) => void) {
    this.maxLineBytes = SseParser.normalizeLimit(options.maxLineBytes, SseParser.DEFAULT_MAX_LINE_BYTES);
    this.maxEventBytes = SseParser.normalizeLimit(options.maxEventBytes, SseParser.DEFAULT_MAX_EVENT_BYTES);
    this.maxPendingBytes = SseParser.normalizeLimit(options.maxPendingBytes, SseParser.DEFAULT_MAX_PENDING_BYTES);
  }

  push(chunk: Uint8Array): void {
    if (this.ended) { return; }
    // 거대한 단일 chunk도 전체 디코딩 문자열/이벤트 배열을 만들지 않는다.
    for (let offset = 0; offset < chunk.byteLength && !this.ended; offset += SseParser.DECODE_SLICE_BYTES) {
      const slice = chunk.subarray(offset, offset + SseParser.DECODE_SLICE_BYTES);
      this.consume(this.decoder.decode(slice, { stream: true }));
    }
  }

  finish(): void {
    if (this.ended) { return; }
    this.consume(this.decoder.decode());
    if (!this.ended && !this.dropping && (this.lineBytes > 0 || this.blockHasFields)) {
      this.droppedEvents++;
      this.sink({ type: 'notice', reason: 'incomplete-eof', droppedEvents: this.droppedEvents });
    }
    this.discard();
  }

  discard(): void {
    this.ended = true;
    this.clearBlock();
    this.dropping = false;
    // 불완전한 UTF-8 suffix도 해제한다. transport 종료 이유는 호출자가 관리한다.
    this.decoder.decode();
  }

  get state(): SseParserState {
    return {
      pendingBytes: this.ended ? 0 : this.pendingBytes(),
      dropping: this.dropping,
      droppedEvents: this.droppedEvents,
      receivedEvents: this.receivedEvents,
      lastEventId: this.lastEventId,
      retry: this.retry,
      ended: this.ended,
    };
  }

  private consume(text: string): void {
    for (const character of text) {
      if (this.ended) { return; }
      if (this.skipLf) {
        this.skipLf = false;
        if (character === '\n') { continue; }
      }
      if (character === '\r' || character === '\n') {
        this.processLine();
        this.skipLf = character === '\r';
        continue;
      }
      if (this.dropping) {
        // 버리는 행이 빈 줄이 아닌지만 보관한다.
        this.lineBytes = 1;
        continue;
      }
      const bytes = Buffer.byteLength(character, 'utf8');
      if (this.lineBytes + bytes > this.maxLineBytes) {
        this.dropBlock('line-limit', this.maxLineBytes);
        this.lineBytes = 1;
      } else if (this.pendingBytes() + bytes > this.maxPendingBytes) {
        this.dropBlock('pending-limit', this.maxPendingBytes);
        this.lineBytes = 1;
      } else {
        this.line += character;
        this.lineBytes += bytes;
      }
    }
  }

  private processLine(): void {
    const line = this.line;
    const wasEmpty = this.lineBytes === 0;
    this.line = '';
    this.lineBytes = 0;
    if (this.dropping) {
      if (wasEmpty) {
        this.dropping = false;
        this.clearBlock();
      }
      return;
    }
    if (wasEmpty) {
      this.dispatch();
      return;
    }
    if (line[0] === ':') { return; }
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) { value = value.slice(1); }
    const validId = field === 'id' && !value.includes('\0');
    const validRetry = field === 'retry' && /^[0-9]+$/.test(value);
    if (field !== 'data' && field !== 'event' && !validId && !validRetry) { return; }
    // retry 필드는 정수로 해석하지만 Number로 변환하여 큰 값을 반올림하지 않는다.
    if (validRetry) { value = value.replace(/^0+(?=[0-9])/, ''); }
    const valueBytes = Buffer.byteLength(value, 'utf8');
    let dataBytes = this.dataBytes;
    let eventTypeBytes = this.eventTypeBytes;
    let eventIdBytes = this.eventIdBytes;
    let retryBytes = this.retryBytes;
    let eventId = this.eventId;
    if (field === 'data') { dataBytes += valueBytes + 1; }
    else if (field === 'event') { eventTypeBytes = valueBytes; }
    else if (validId) { eventIdBytes = valueBytes; eventId = value; }
    else if (validRetry) { retryBytes = valueBytes; }
    const eventBytes = Math.max(0, dataBytes - 1) + (eventTypeBytes || 7) + eventIdBytes + retryBytes;
    const pendingBytes = dataBytes + eventTypeBytes + eventIdBytes + retryBytes
      + (eventId === this.lastEventId ? 0 : this.lastEventIdBytes);
    // 값을 합치기 전에 검사하여 제한보다 큰 data 문자열을 만들지 않는다.
    if (eventBytes > this.maxEventBytes) {
      this.dropBlock('event-limit', this.maxEventBytes);
      return;
    }
    if (pendingBytes > this.maxPendingBytes) {
      this.dropBlock('pending-limit', this.maxPendingBytes);
      return;
    }
    if (field === 'data') {
      this.data += value + '\n';
      this.dataBytes += valueBytes + 1;
      this.blockHasFields = true;
    } else if (field === 'event') {
      this.eventType = value;
      this.eventTypeBytes = valueBytes;
      this.blockHasFields = true;
    } else if (validId) {
      this.eventId = value;
      this.eventIdBytes = valueBytes;
      this.blockHasFields = true;
    } else if (validRetry) {
      this.retry = value;
      this.retryBytes = valueBytes;
      this.blockHasFields = true;
    }
  }

  private dispatch(): void {
    this.lastEventId = this.eventId;
    this.lastEventIdBytes = this.eventIdBytes;
    if (this.dataBytes === 0) {
      this.clearBlock();
      return;
    }
    const item: SseParsedEvent = {
      type: 'event',
      event: this.eventType || 'message',
      data: this.data.slice(0, -1),
      id: this.lastEventId,
      retry: this.retry,
      bytes: this.eventBytes(),
    };
    this.receivedEvents++;
    this.clearBlock();
    this.sink(item);
  }

  private dropBlock(reason: SseParserNotice['reason'], limitBytes: number): void {
    this.droppedEvents++;
    this.clearBlock();
    this.dropping = true;
    this.sink({ type: 'notice', reason, limitBytes, droppedEvents: this.droppedEvents });
  }

  private clearBlock(): void {
    this.line = '';
    this.lineBytes = 0;
    this.data = '';
    this.dataBytes = 0;
    this.eventType = '';
    this.eventTypeBytes = 0;
    this.eventId = this.lastEventId;
    this.eventIdBytes = this.lastEventIdBytes;
    this.blockHasFields = false;
  }

  private eventBytes(): number {
    return Math.max(0, this.dataBytes - 1) + (this.eventTypeBytes || 7) + this.eventIdBytes + this.retryBytes;
  }

  private pendingBytes(): number {
    // 이전 ID와 아직 확정되지 않은 ID가 다르면 둘 다 보관 중이다.
    const previousIdBytes = this.eventId === this.lastEventId ? 0 : this.lastEventIdBytes;
    return this.lineBytes + this.dataBytes + this.eventTypeBytes + this.eventIdBytes + previousIdBytes + this.retryBytes;
  }

  private static normalizeLimit(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback;
  }
}
