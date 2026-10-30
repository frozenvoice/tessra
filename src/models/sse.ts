// Extension/Webview가 공유하는 SSE 데이터 계약이다. Node/전송 모듈을 가져오지 않는다.
export interface SseEvent {
  type: 'event';
  event: string;
  data: string;
  id: string;
  // 정밀도를 잃지 않는 십진 문자열 metadata이며 자동 재연결 동작은 없다.
  retry?: string;
  bytes: number;
}

export interface SseNotice {
  type: 'notice';
  reason: 'line-limit' | 'event-limit' | 'pending-limit' | 'incomplete-eof';
  limitBytes?: number;
  droppedEvents: number;
}

export type SseStreamState = 'receiving' | 'completed' | 'aborted' | 'timeout' | 'error';

export interface SseStreamSummary {
  state: SseStreamState;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  time: number;
  wireBytes: number;
  decodedBytes: number;
  receivedEvents: number;
  droppedEvents: number;
  evictedEvents: number;
  retainedBytes: number;
  rawTruncatedBytes: number;
  omittedNotices: number;
}

export interface SseSnapshot extends SseStreamSummary {
  events: SseEvent[];
  notices: SseNotice[];
  rawBody: string;
  rawBodyBase64: string;
}

export interface SseStreamUpdate {
  phase: 'started' | 'events' | 'ended';
  // 수신 중에는 새 항목만 전달한다. 화면도 별도로 보관량을 제한한다.
  events: SseEvent[];
  notices: SseNotice[];
  summary: SseStreamSummary;
  snapshot?: SseSnapshot;
}
