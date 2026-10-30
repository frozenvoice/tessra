import type { Response } from '../models/types';
import { SseParser, SseParsedEvent, SseParserItem, SseParserNotice, SseParserOptions } from './SseParser';
import type { SseSnapshot, SseStreamState, SseStreamSummary, SseStreamUpdate } from '../models/sse';
export type { SseEvent, SseNotice, SseSnapshot, SseStreamState, SseStreamSummary, SseStreamUpdate } from '../models/sse';

export interface SseResponse extends Response {
  sse: SseSnapshot;
}

export interface SseStreamOptions extends SseParserOptions {
  maxRetainedEvents?: number;
  maxRetainedBytes?: number;
  maxRawBytes?: number;
  maxBatchEvents?: number;
  maxBatchBytes?: number;
  flushIntervalMs?: number;
}

export function getSseSnapshot(value: unknown): SseSnapshot | undefined {
  if (!value || typeof value !== 'object' || !('sse' in value)) { return undefined; }
  return (value as { sse?: SseSnapshot }).sse;
}

/** 전송 수명은 HttpService가 관리하고, 이벤트/미리보기/배치 보관은 여기서 제한한다. */
export class SseStream {
  static readonly MAX_RETAINED_EVENTS = 500;
  static readonly MAX_RETAINED_BYTES = 2 * 1024 * 1024;
  static readonly MAX_RAW_BYTES = 1024 * 1024;
  private static readonly MAX_NOTICES = 20;
  private static readonly MAX_BATCH_NOTICES = 20;

  private readonly parser: SseParser;
  private readonly maxRetainedEvents: number;
  private readonly maxRetainedBytes: number;
  private readonly maxRawBytes: number;
  private readonly maxBatchEvents: number;
  private readonly maxBatchBytes: number;
  private readonly flushIntervalMs: number;
  private readonly events: SseParsedEvent[] = [];
  private readonly notices: SseParserNotice[] = [];
  private rawBuffer: Buffer | undefined;
  private pendingEvents: SseParsedEvent[] = [];
  private pendingNotices: SseParserNotice[] = [];
  private pendingBytes = 0;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private state: SseStreamState = 'receiving';
  private wireBytes = 0;
  private decodedBytes = 0;
  private retainedBytes = 0;
  private retainedRawBytes = 0;
  private evictedEvents = 0;
  private omittedNotices = 0;
  private endedAt: number | undefined;

  constructor(
    private readonly response: Pick<Response, 'status' | 'statusText' | 'headers'>,
    private readonly startedAt: number,
    private readonly onUpdate: ((update: SseStreamUpdate) => void) | undefined,
    options: SseStreamOptions = {},
  ) {
    this.maxRetainedEvents = SseStream.limit(options.maxRetainedEvents, SseStream.MAX_RETAINED_EVENTS);
    this.maxRetainedBytes = SseStream.limit(options.maxRetainedBytes, SseStream.MAX_RETAINED_BYTES);
    this.maxRawBytes = SseStream.limit(options.maxRawBytes, SseStream.MAX_RAW_BYTES);
    this.maxBatchEvents = SseStream.limit(options.maxBatchEvents, 100);
    this.maxBatchBytes = SseStream.limit(options.maxBatchBytes, 1024 * 1024);
    this.flushIntervalMs = SseStream.limit(options.flushIntervalMs, 50);
    this.parser = new SseParser({
      maxLineBytes: SseStream.limit(options.maxLineBytes, SseParser.DEFAULT_MAX_LINE_BYTES),
      maxEventBytes: SseStream.limit(options.maxEventBytes, Math.min(SseParser.DEFAULT_MAX_EVENT_BYTES, this.maxBatchBytes)),
      maxPendingBytes: SseStream.limit(options.maxPendingBytes, SseParser.DEFAULT_MAX_PENDING_BYTES),
    }, (item) => this.receiveItem(item));
  }

  start(): void {
    if (this.state !== 'receiving') { return; }
    this.deliver({ phase: 'started', events: [], notices: [], summary: this.summary });
  }

  addWireBytes(bytes: number): void {
    if (this.state === 'receiving') { this.wireBytes += bytes; }
  }

  push(chunk: Buffer): void {
    if (this.state !== 'receiving') { return; }
    this.decodedBytes += chunk.length;
    const remaining = this.maxRawBytes - this.retainedRawBytes;
    if (remaining > 0) {
      const bytes = Math.min(remaining, chunk.length);
      // 행마다 chunk 객체를 쌓거나 큰 원본 chunk의 전체 allocation을 붙잡지 않는다.
      this.rawBuffer ??= Buffer.alloc(this.maxRawBytes);
      chunk.copy(this.rawBuffer, this.retainedRawBytes, 0, bytes);
      this.retainedRawBytes += bytes;
    }
    this.parser.push(chunk);
  }

  end(state: Exclude<SseStreamState, 'receiving'>): SseSnapshot {
    if (this.state === 'receiving') {
      if (state === 'completed') { this.parser.finish(); }
      else { this.parser.discard(); }
      if (this.state !== 'receiving') { return this.snapshot; }
      this.state = state;
      this.endedAt = Date.now();
      this.clearTimer();
      const events = this.pendingEvents;
      const notices = this.pendingNotices;
      this.pendingEvents = [];
      this.pendingNotices = [];
      this.pendingBytes = 0;
      const snapshot = this.snapshot;
      this.deliver({ phase: 'ended', events, notices, summary: this.summary, snapshot });
      return snapshot;
    }
    return this.snapshot;
  }

  get snapshot(): SseSnapshot {
    const buffer = this.rawBuffer?.subarray(0, this.retainedRawBytes) ?? Buffer.alloc(0);
    return {
      ...this.summary,
      events: this.events.map((event) => ({ ...event })),
      notices: this.notices.map((notice) => ({ ...notice })),
      rawBody: buffer.toString('utf8'),
      rawBodyBase64: buffer.toString('base64'),
    };
  }

  get summary(): SseStreamSummary {
    const parser = this.parser.state;
    return {
      state: this.state,
      ...this.response,
      headers: { ...this.response.headers },
      time: (this.endedAt ?? Date.now()) - this.startedAt,
      wireBytes: this.wireBytes,
      decodedBytes: this.decodedBytes,
      receivedEvents: parser.receivedEvents,
      droppedEvents: parser.droppedEvents,
      evictedEvents: this.evictedEvents,
      retainedBytes: this.retainedBytes,
      rawTruncatedBytes: this.decodedBytes - this.retainedRawBytes,
      omittedNotices: this.omittedNotices,
    };
  }

  private receiveItem(item: SseParserItem): void {
    if (this.state !== 'receiving') { return; }
    if (item.type === 'event') {
      while (this.events.length > 0 && (this.events.length >= this.maxRetainedEvents
        || this.retainedBytes + item.bytes > this.maxRetainedBytes)) {
        this.retainedBytes -= this.events.shift()!.bytes;
        this.evictedEvents++;
      }
      if (item.bytes <= this.maxRetainedBytes) {
        this.events.push(item);
        this.retainedBytes += item.bytes;
      } else { this.evictedEvents++; }
      if (this.pendingEvents.length >= this.maxBatchEvents || this.pendingBytes + item.bytes > this.maxBatchBytes) {
        this.flush();
        if (this.state !== 'receiving') { return; }
      }
      this.pendingEvents.push(item);
      this.pendingBytes += item.bytes;
      // 단일 항목이 배치보다 크면 보관을 늘리지 않고 즉시 전달한다.
      if (this.pendingEvents.length >= this.maxBatchEvents || this.pendingBytes >= this.maxBatchBytes) { this.flush(); }
    } else {
      if (this.notices.length >= SseStream.MAX_NOTICES) {
        this.notices.shift();
        this.omittedNotices++;
      }
      this.notices.push(item);
      if (this.pendingNotices.length >= SseStream.MAX_BATCH_NOTICES) {
        this.flush();
        if (this.state !== 'receiving') { return; }
      }
      this.pendingNotices.push(item);
    }
    if (this.state === 'receiving' && !this.flushTimer && (this.pendingEvents.length > 0 || this.pendingNotices.length > 0)) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  private flush(): void {
    this.clearTimer();
    if (this.state !== 'receiving' || (this.pendingEvents.length === 0 && this.pendingNotices.length === 0)) { return; }
    const events = this.pendingEvents;
    const notices = this.pendingNotices;
    this.pendingEvents = [];
    this.pendingNotices = [];
    this.pendingBytes = 0;
    this.deliver({ phase: 'events', events: events.map((event) => ({ ...event })), notices: notices.map((notice) => ({ ...notice })), summary: this.summary });
  }

  private deliver(update: SseStreamUpdate): void {
    // UI 구독자의 예외로 HTTP event emitter에 uncaught exception이 발생하지 않는다.
    try { this.onUpdate?.(update); } catch { /* 응답 전송은 구독자와 독립적으로 종료한다. */ }
  }

  private clearTimer(): void {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }

  private static limit(value: number | undefined, fallback: number): number {
    // 전송별 옵션은 안전한 기본 상한을 낮추는 용도로만 사용한다.
    return value !== undefined && Number.isFinite(value) && value > 0 ? Math.min(fallback, Math.max(1, Math.floor(value))) : fallback;
  }
}
