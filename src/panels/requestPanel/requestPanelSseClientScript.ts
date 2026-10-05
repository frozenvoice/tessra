/** SSE 화면은 호스트의 배치 경계를 유지하고 이벤트 문자열을 textContent로만 표시한다. */
export function getRequestPanelSseClientScript(): string {
  return /*js*/ `
var SSE_VIEW_MAX_EVENTS = 500;
var SSE_VIEW_MAX_BYTES = 2 * 1024 * 1024;

function sseStateLabel(state) {
  var key = state === 'completed' ? 'Completed' : state === 'aborted' ? 'Aborted' : state === 'timeout' ? 'Timeout' : state === 'error' ? 'Error' : 'Receiving';
  return tr('webview.sse' + key);
}

function createSseViewState(runId, summary) {
  return { runId: runId, summary: summary || {}, events: [], notices: [], retainedBytes: 0, clientEvicted: 0,
    nextOrdinal: 1, version: 0, rawBody: '', rawReady: false, mode: 'events' };
}

function appendSseViewEvents(view, events) {
  (events || []).forEach(function(event) {
    if (!event || typeof event.data !== 'string') return;
    var item = { data: event.data, event: String(event.event || 'message'), id: String(event.id || ''),
      retry: event.retry === undefined ? undefined : String(event.retry), ordinal: view.nextOrdinal++ };
    item.bytes = new TextEncoder().encode(item.data + item.event + item.id + (item.retry || '')).length;
    if (item.bytes > SSE_VIEW_MAX_BYTES) { view.clientEvicted++; return; }
    view.events.push(item); view.retainedBytes += item.bytes;
    while (view.events.length > SSE_VIEW_MAX_EVENTS || view.retainedBytes > SSE_VIEW_MAX_BYTES) {
      view.retainedBytes -= view.events.shift().bytes;
      view.clientEvicted++;
    }
  });
}

function applySseViewUpdate(view, update) {
  view.summary = update.summary || view.summary;
  if (update.snapshot) {
    var snapshot = update.snapshot;
    view.events = []; view.retainedBytes = 0; view.clientEvicted = 0;
    view.nextOrdinal = Math.max(1, Number(snapshot.receivedEvents || 0) - (snapshot.events || []).length + 1);
    appendSseViewEvents(view, snapshot.events);
    view.notices = (snapshot.notices || []).slice(-20);
    view.rawBody = String(snapshot.rawBody || '');
    view.rawBodyBase64 = String(snapshot.rawBodyBase64 || '');
    view.rawReady = true;
    view.version++;
  } else {
    appendSseViewEvents(view, update.events);
    view.notices = view.notices.concat(update.notices || []).slice(-20);
  }
}

function buildSseResponseAreaHtml(tab) {
  return '<div class="sse-view" data-testid="sse-response">' +
    '<div class="sse-summary" data-testid="response-status"><span class="js-sse-http-status"></span><span class="js-sse-state" data-testid="sse-state" role="status" aria-live="polite"></span></div>' +
    '<div class="sse-counts" data-testid="sse-counts"></div>' +
    '<div class="sse-loss" data-testid="sse-loss" role="status"></div>' +
    '<div class="sse-error error-msg hidden" data-testid="sse-error"></div>' +
    '<div class="res-body-toolbar sse-toolbar" role="tablist" aria-label="SSE">' +
      '<button type="button" role="tab" class="toggle-btn js-sse-events" id="sseEventsTab" aria-controls="sseEventsPanel">' + escapeHtml(tr('webview.sseEvents')) + '</button>' +
      '<button type="button" role="tab" class="toggle-btn js-sse-raw" id="sseRawTab" aria-controls="sseRawPanel">' + escapeHtml(tr('webview.sseRaw')) + '</button>' +
    '</div>' +
    '<div class="res-body-toolbar sse-raw-actions"><button type="button" class="tb-btn js-sse-copy" disabled>' + escapeHtml(tr('webview.copy')) + '</button><button type="button" class="tb-btn js-sse-save" disabled>' + escapeHtml(tr('webview.save')) + '</button></div>' +
    '<div class="sse-events" id="sseEventsPanel" role="tabpanel" aria-labelledby="sseEventsTab" data-testid="sse-events"></div>' +
    '<pre class="sse-raw hidden" id="sseRawPanel" role="tabpanel" aria-labelledby="sseRawTab" data-testid="sse-raw"></pre>' +
  '</div>';
}

function appendSseEventNode(container, item) {
  var row = document.createElement('article');
  row.className = 'sse-event';
  row.dataset.ordinal = String(item.ordinal);
  row.setAttribute('data-testid', 'sse-event');
  var metadata = document.createElement('div');
  metadata.className = 'sse-event-meta';
  metadata.textContent = '#' + item.ordinal + ' · event: ' + item.event + (item.id ? ' · id: ' + item.id : '') +
    (item.retry !== undefined ? ' · retry: ' + item.retry + ' (' + tr('webview.sseRetryMetadata') + ')' : '');
  var data = document.createElement('pre');
  data.className = 'sse-event-data';
  data.setAttribute('data-testid', 'sse-event-data');
  data.textContent = item.data;
  row.appendChild(metadata); row.appendChild(data); container.appendChild(row);
}

function syncSseResponseView(tab, root) {
  var view = tab.sseView;
  root = root || mainContent?.querySelector('[data-testid="sse-response"]');
  if (!view || !root) return;
  var summary = view.summary;
  var state = summary.state || 'receiving';
  root.dataset.state = state;
  root.querySelector('.js-sse-http-status').textContent = String(summary.status || '') + ' ' + String(summary.statusText || '');
  root.querySelector('.js-sse-state').textContent = sseStateLabel(state) + (state !== 'receiving' && state !== 'completed' ? ' · ' + tr('webview.ssePartialResponse') : '');
  root.querySelector('[data-testid="sse-counts"]').textContent = tf('webview.sseCounts', {
    received: summary.receivedEvents || 0, retained: view.events.length, dropped: summary.droppedEvents || 0,
    evicted: Math.max(summary.evictedEvents || 0, view.clientEvicted) });
  var noticeKeys = { 'line-limit': 'LineLimit', 'event-limit': 'EventLimit', 'pending-limit': 'PendingLimit', 'incomplete-eof': 'IncompleteEof' };
  var loss = view.notices.map(function(notice) { return tr('webview.sseNotice' + noticeKeys[notice.reason]); });
  if (summary.rawTruncatedBytes) loss.push(tf('webview.sseRawTruncated', { bytes: summary.rawTruncatedBytes }));
  if (summary.omittedNotices) loss.push(tf('webview.sseNoticesOmitted', { count: summary.omittedNotices }));
  root.querySelector('[data-testid="sse-loss"]').textContent = Array.from(new Set(loss)).join(' · ');
  var error = root.querySelector('[data-testid="sse-error"]');
  error.textContent = tab.error || ''; error.classList.toggle('hidden', !tab.error);
  var events = root.querySelector('[data-testid="sse-events"]');
  var reset = root._sseRunId !== view.runId || root._sseVersion !== view.version;
  if (reset) { events.replaceChildren(); root._sseLastOrdinal = 0; }
  var firstOrdinal = view.events[0]?.ordinal || Infinity;
  while (events.firstElementChild && Number(events.firstElementChild.dataset.ordinal) < firstOrdinal) events.firstElementChild.remove();
  view.events.forEach(function(item) {
    if (item.ordinal > (root._sseLastOrdinal || 0)) { appendSseEventNode(events, item); root._sseLastOrdinal = item.ordinal; }
  });
  root._sseRunId = view.runId; root._sseVersion = view.version;
  root.querySelector('.js-sse-copy').disabled = !view.rawReady;
  root.querySelector('.js-sse-save').disabled = !view.rawReady;
  root.querySelector('[data-testid="sse-raw"]').textContent = view.rawReady ? view.rawBody : tr('webview.sseRawPending');
  ['events', 'raw'].forEach(function(mode) {
    var selected = view.mode === mode;
    var button = root.querySelector('.js-sse-' + mode);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
    button.classList.toggle('active', selected);
    var panel = root.querySelector('[data-testid="sse-' + mode + '"]');
    panel.classList.toggle('hidden', !selected);
    panel.setAttribute('aria-hidden', selected ? 'false' : 'true');
  });
}

function bindSseResponseViewer(mc) {
  var root = mc.querySelector('[data-testid="sse-response"]');
  var tab = tabs.find(function(item) { return item.id === activeTabId; });
  if (!root || !tab?.sseView) return;
  ['events', 'raw'].forEach(function(mode) {
    var button = root.querySelector('.js-sse-' + mode);
    button.addEventListener('click', function() { tab.sseView.mode = mode; syncSseResponseView(tab, root); });
    button.addEventListener('keydown', function(event) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) < 0) return;
      event.preventDefault();
      var next = event.key === 'Home' ? 'events' : event.key === 'End' ? 'raw' : (mode === 'events' ? 'raw' : 'events');
      tab.sseView.mode = next; syncSseResponseView(tab, root); root.querySelector('.js-sse-' + next).focus();
    });
  });
  root.querySelector('.js-sse-copy').addEventListener('click', function() {
    if (tab.sseView.rawReady) vscode.postMessage({ type: 'copyResponseBody', body: tab.sseView.rawBody });
  });
  root.querySelector('.js-sse-save').addEventListener('click', function() {
    if (!tab.sseView.rawReady) return;
    pendingSaveResponseBtn = this;
    vscode.postMessage({ type: 'saveResponseBody', body: tab.sseView.rawBody, bodyBase64: tab.sseView.rawBodyBase64 || '', contentType: 'text/event-stream' });
  });
  syncSseResponseView(tab, root);
}

function handleSseUpdateMessage(msg) {
  var tab = tabs.find(function(item) { return item.id === msg.tabId; });
  if (!tab || !msg.update || msg.requestStartedAt !== tab.requestStartedAt) return;
  if (msg.update.phase === 'started') {
    if (!tab.loading) return;
    tab.sseView = createSseViewState(msg.runId, msg.update.summary);
    tab.response = null;
  } else if (!tab.sseView || tab.sseView.runId !== msg.runId) return;
  if (tab.sseView.summary.state !== 'receiving' && msg.update.phase !== 'started') return;
  applySseViewUpdate(tab.sseView, msg.update);
  if (activeTabId !== tab.id) return;
  if (msg.update.phase === 'started' || !mainContent.querySelector('[data-testid="sse-response"]')) renderContent();
  else syncSseResponseView(tab);
}

function handleRunnerSseUpdate(msg) {
  if (!runnerOverlay || !msg.update || runnerOverlay._sseRunId !== msg.runId) return;
  var root = runnerOverlay.querySelector('[data-testid="runner-sse-response"]');
  if (!root) {
    root = document.createElement('div'); root.className = 'runner-sse-response'; root.setAttribute('data-testid', 'runner-sse-response');
    var label = document.createElement('div'); label.className = 'runner-sse-label'; label.setAttribute('role', 'status'); root.appendChild(label);
    var events = document.createElement('div'); events.className = 'runner-sse-events'; root.appendChild(events);
    runnerOverlay.appendChild(root);
  }
  var key = String(msg.index) + ':' + String(msg.iteration);
  if (root._requestKey !== key || msg.update.phase === 'started') {
    root._requestKey = key;
    root._view = createSseViewState(msg.runId + ':' + key, msg.update.summary);
    root.querySelector('.runner-sse-events').replaceChildren(); root._lastOrdinal = 0;
  }
  if (root._view.summary.state !== 'receiving' && msg.update.phase !== 'started') return;
  applySseViewUpdate(root._view, msg.update);
  var view = root._view; var summary = view.summary;
  root.querySelector('.runner-sse-label').textContent = 'SSE · #' + (Number(msg.requestIndex || 0) + 1) + ' · ' + sseStateLabel(summary.state) + ' · ' +
    tf('webview.sseCounts', { received: summary.receivedEvents || 0, retained: view.events.length, dropped: summary.droppedEvents || 0, evicted: Math.max(summary.evictedEvents || 0, view.clientEvicted) });
  var container = root.querySelector('.runner-sse-events');
  if (msg.update.snapshot) { container.replaceChildren(); root._lastOrdinal = 0; }
  var first = view.events[0]?.ordinal || Infinity;
  while (container.firstElementChild && Number(container.firstElementChild.dataset.ordinal) < first) container.firstElementChild.remove();
  view.events.forEach(function(item) { if (item.ordinal > root._lastOrdinal) { appendSseEventNode(container, item); root._lastOrdinal = item.ordinal; } });
}

`;
}
