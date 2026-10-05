const translations: Record<string, [string, string, string]> = {
  'webview.sseEvents': ['Events', '이벤트', 'イベント'], 'webview.sseRaw': ['Raw', '원문', 'Raw'],
  'webview.sseReceiving': ['Receiving', '수신 중', '受信中'],
  'webview.sseCompleted': ['Completed', '수신 완료', '完了'],
  'webview.sseAborted': ['Stopped', '중지됨', '停止'],
  'webview.sseTimeout': ['Timed out', '시간 초과', 'タイムアウト'],
  'webview.sseError': ['Stream error', '스트림 오류', 'ストリームエラー'],
  'webview.sseCounts': ['{received} received · {retained} retained · {dropped} dropped · {evicted} evicted', '{received}개 수신 · {retained}개 보관 · {dropped}개 누락 · {evicted}개 제거', '{received} 件受信 · {retained} 件保持 · {dropped} 件破棄 · {evicted} 件除去'],
  'webview.sseRawTruncated': ['Raw preview truncated by {bytes} bytes.', '원문 미리보기에서 {bytes}바이트를 생략했습니다.', 'Raw プレビューで {bytes} バイト省略しました。'],
  'webview.sseRawPending': ['Raw preview is available when the stream ends. Events update while receiving.', '원문 미리보기는 스트림 종료 후 표시됩니다. 수신 중에는 이벤트가 갱신됩니다.', 'Raw プレビューはストリーム終了後に表示されます。受信中はイベントを更新します。'],
  'webview.sseNoticesOmitted': ['{count} additional notices omitted.', '추가 알림 {count}개를 생략했습니다.', '追加通知 {count} 件を省略しました。'],
  'webview.sseNoticeLineLimit': ['A line exceeded the limit; the event was dropped.', '줄 크기 한도를 넘어 이벤트를 누락했습니다.', '行の上限を超えたためイベントを破棄しました。'],
  'webview.sseNoticeEventLimit': ['An event exceeded the limit and was dropped.', '이벤트 크기 한도를 넘어 누락했습니다.', 'イベントの上限を超えたため破棄しました。'],
  'webview.sseNoticePendingLimit': ['Pending input exceeded the limit; an incomplete event was dropped.', '대기 입력 한도를 넘어 미완성 이벤트를 누락했습니다.', '保留入力の上限を超えたため未完了イベントを破棄しました。'],
  'webview.sseNoticeIncompleteEof': ['The stream ended with an incomplete event; it was not dispatched.', '미완성 이벤트로 스트림이 끝나 해당 이벤트를 표시하지 않았습니다.', '未完了イベントでストリームが終了したため、そのイベントは表示しません。'],
  'webview.sseRetryMetadata': ['Retry metadata: {retry} ms (no automatic reconnect)', 'Retry 정보: {retry}ms (자동 재연결 없음)', 'Retry 情報: {retry} ms (自動再接続なし)'],
  'webview.ssePartialResponse': ['Partial response retained', '부분 응답 보관됨', '部分レスポンスを保持'],
};
export const SSE_STRINGS = Object.fromEntries(['en', 'ko', 'ja'].map((language, index) =>
  [language, Object.fromEntries(Object.entries(translations).map(([key, values]) => [key, values[index]]))]
)) as Record<string, Record<string, string>>;
