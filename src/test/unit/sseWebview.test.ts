import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { TextEncoder } from 'util';
import { getRequestPanelSseClientScript } from '../../panels/requestPanel/requestPanelSseClientScript';

const rootPath = path.resolve(__dirname, '../../../../');
function setup() {
  const renders: number[] = [];
  const tab = { id: 'tab-a', loading: true, requestStartedAt: 123, response: null };
  const created: Array<{ textContent: string; children: unknown[] }> = [];
  const context = vm.createContext({ tabs: [tab], activeTabId: 'inactive', TextEncoder,
    tr: (key: string) => key, tf: (key: string, args: unknown) => key + JSON.stringify(args), escapeHtml: (value: string) => value,
    mainContent: { querySelector: () => null }, renderContent: () => renders.push(1), runnerOverlay: null,
    document: { createElement() {
      const node = { textContent: '', className: '', dataset: {}, children: [] as unknown[], setAttribute() {},
        appendChild(child: unknown) { this.children.push(child); } };
      Object.defineProperty(node, 'innerHTML', { set() { throw new Error('Untrusted HTML insertion'); } });
      created.push(node); return node;
    } },
  });
  vm.runInContext(getRequestPanelSseClientScript(), context);
  return { context, tab, renders, created };
}
function update(context: vm.Context, phase: string, state = 'receiving', runId = 'run-a', started = 123, data = 'live') {
  context.msg = { tabId: 'tab-a', runId, requestStartedAt: started, update: { phase,
    summary: { state, receivedEvents: 1, evictedEvents: 0 }, events: phase === 'events' ? [{ data, event: 'message', id: '' }] : [], notices: [] } };
  vm.runInContext('handleSseUpdateMessage(msg)', context);
}

describe('SSE Webview bounded lifecycle', () => {
  it('parses the shipped fragment and does not introduce EventSource or reconnect', () => {
    const script = getRequestPanelSseClientScript();
    assert.doesNotThrow(() => new vm.Script(script));
    assert.doesNotMatch(script, /EventSource|setInterval|innerHTML/);
  });

  it('uses a start timestamp and run ID, and rejects batches after terminal state', () => {
    const { context, tab } = setup();
    update(context, 'started', 'receiving', 'run-old', 122);
    assert.strictEqual((tab as any).sseView, undefined);
    update(context, 'started');
    update(context, 'events', 'receiving', 'wrong-run');
    assert.strictEqual((tab as any).sseView.events.length, 0);
    update(context, 'events');
    update(context, 'ended', 'aborted');
    update(context, 'events', 'receiving', 'run-a', 123, 'late');
    assert.strictEqual((tab as any).sseView.events.length, 1);
    assert.strictEqual((tab as any).sseView.summary.state, 'aborted');
    tab.loading = false;
    update(context, 'started');
    assert.strictEqual((tab as any).sseView.summary.state, 'aborted');
  });

  it('caps event count and UTF-8 byte retention independently', () => {
    const { context } = setup();
    vm.runInContext("view = createSseViewState('run', {}); appendSseViewEvents(view, Array.from({length: 650}, (_, i) => ({data: 'event-' + i})))", context);
    assert.strictEqual(context.view.events.length, 500);
    assert.strictEqual(context.view.clientEvicted, 150);
    assert.strictEqual(context.view.events[0].ordinal, 151);
    vm.runInContext("appendSseViewEvents(view, Array.from({length: 20}, () => ({data: '가'.repeat(100000)})))", context);
    assert.ok(context.view.retainedBytes <= 2 * 1024 * 1024);
    assert.ok(context.view.events.length < 20);
    assert.ok(context.view.clientEvicted > 150);
  });

  it('terminal snapshots preserve raw bytes metadata and count ordinals after host eviction', () => {
    const { context } = setup();
    context.snapshot = { state: 'timeout', receivedEvents: 700, events: [{ data: 'retained', id: 'fixture' }], notices: [], rawBody: 'data: retained\n\n', rawBodyBase64: 'ZGF0YTogcmV0YWluZWQK', rawTruncatedBytes: 42 };
    vm.runInContext("view = createSseViewState('run', {}); applySseViewUpdate(view, {summary: snapshot, snapshot})", context);
    assert.strictEqual(context.view.rawReady, true);
    assert.strictEqual(context.view.rawBody, context.snapshot.rawBody);
    assert.strictEqual(context.view.rawBodyBase64, context.snapshot.rawBodyBase64);
    assert.strictEqual(context.view.events[0].ordinal, 700);
    assert.strictEqual(context.view.summary.state, 'timeout');
  });

  it('renders data, event and ID as inert text, with no HTML sink', () => {
    const { context, created } = setup();
    context.container = { appendChild() {} };
    context.item = { data: '<img src=x onerror=alert(1)>', event: '<script>bad</script>', id: '</div>', retry: '1000', ordinal: 1 };
    vm.runInContext('appendSseEventNode(container, item)', context);
    assert.strictEqual(created[2].textContent, context.item.data);
    assert.ok(created[1].textContent.includes(context.item.event));
    assert.ok(created[1].textContent.includes(context.item.id));
    assert.strictEqual(created[0].children.length, 2);
  });

  it('keeps updates within response DOM and maintains keyboard tabs and truthful partial labels', () => {
    const script = getRequestPanelSseClientScript();
    assert.match(script, /else syncSseResponseView\(tab\)/);
    assert.match(script, /aria-controls="sseEventsPanel"/);
    assert.match(script, /ArrowLeft.*ArrowRight.*Home.*End/);
    assert.match(script, /ssePartialResponse/);
    assert.match(script, /sseRawPending/);
    assert.match(script, /sseRawTruncated/);
    assert.match(script, /sseNoticesOmitted/);
    assert.match(script, /view.notices.*slice\(-20\)/);
  });

  it('clears live state for each send, preserves partial view on errors, and binds runner generation', () => {
    const script = fs.readFileSync(path.join(rootPath, 'src/panels/requestPanel/requestPanelClientScript.ts'), 'utf8');
    const response = fs.readFileSync(path.join(rootPath, 'src/panels/requestPanel/requestPanelResponseClientScript.ts'), 'utf8');
    const runner = fs.readFileSync(path.join(rootPath, 'src/panels/requestPanel/requestPanelRunnerClientScript.ts'), 'utf8');
    assert.match(script, /tab.sseView = null;\s*tab.loading = true/);
    assert.match(script, /receiveSseUpdate/);
    assert.match(response, /if \(tab.sseView\) return buildSseResponseAreaHtml\(tab\)/);
    assert.match(runner, /runnerOverlay._sseRunId = msg.runId/);
  });
});
