import * as assert from 'assert';
import * as vm from 'vm';
import Module = require('module');
import { getRequestPanelResponseClientScript } from '../../panels/requestPanel/requestPanelResponseClientScript';
import type { HistoryEntry, Request } from '../../models/types';

describe('UI clarity behavior', () => {
  let visuals: typeof import('../../providers/requestTreeVisuals');
  let localization: typeof import('../../services/LocalizationService');
  let originalLoad: (...args: unknown[]) => unknown;
  before(() => {
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    originalLoad = loader._load;
    loader._load = function(name: unknown, ...args: unknown[]) {
      if (name === 'vscode') return {
        ThemeIcon: class { constructor(public id: string, public color: unknown) {} },
        ThemeColor: class { constructor(public id: string) {} },
        workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
      };
      return originalLoad.apply(this, [name, ...args]);
    };
    delete require.cache[require.resolve('../../providers/requestTreeVisuals')];
    delete require.cache[require.resolve('../../services/LocalizationService')];
    visuals = require('../../providers/requestTreeVisuals');
    localization = require('../../services/LocalizationService');
  });
  after(() => { (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad; });

  it('omits only an already visible method prefix without changing names or locations', () => {
    const request = { method: 'GET', url: 'http://localhost/users', bodyType: 'none' } as Request;
    assert.strictEqual(visuals.buildRequestTreeDescription(request, 'GET Users'), 'localhost/users');
    assert.strictEqual(visuals.buildRequestTreeDescription(request, 'Users'), 'GET · localhost/users');
    assert.strictEqual(visuals.buildRequestTreeDescription(request, 'GETaway'), 'GET · localhost/users');
    assert.strictEqual(visuals.buildRequestTreeDescription(request, 'POST Users'), 'GET · localhost/users');
  });

  it('uses HTTP status for meaning and icons, never elapsed-time thresholds', () => {
    const entry = { request: { method: 'GET', url: 'http://localhost/users' },
      response: { status: 200, statusText: 'OK', time: 123456 }, timestamp: Date.now() } as HistoryEntry;
    assert.strictEqual(visuals.buildHistoryDescription(entry), '200 Success · 123456 ms');
    assert.strictEqual(visuals.getHistoryStatusIcon(entry).id, 'pass');
    entry.response!.time = 1;
    assert.strictEqual(visuals.getHistoryStatusIcon(entry).id, 'pass');
    entry.response!.status = 404;
    assert.match(visuals.buildHistoryDescription(entry), /404 Client error/);
    assert.strictEqual(visuals.getHistoryStatusIcon(entry).id, 'error');
    entry.response!.status = 302;
    assert.match(visuals.buildHistoryDescription(entry), /302 Redirect/);
    assert.strictEqual(visuals.getHistoryStatusIcon(entry).id, 'arrow-right');
  });

  it('provides translated context explanations, screen reader labels and JSON counts in all display languages', () => {
    const keys = ['webview.historyRecordingOnTooltip', 'webview.historyRecordingOffTooltip',
      'webview.defaultHeadersContextTooltip', 'webview.requestVarsContextTooltip', 'webview.enableRow',
      'webview.toggleJsonNode', 'webview.jsonItems', 'webview.jsonKeys', 'history.statusSuccess'];
    for (const language of ['en', 'ko', 'ja'] as const) {
      for (const key of keys) {
        const text = localization.LocalizationService.t(key, { names: 'X-Fixture', path: '$.fixture', count: 2 }, language);
        assert.notStrictEqual(text, key);
        assert.ok(!/\{(?:names|path|count)\}/.test(text));
      }
    }
  });

  it('renders escaped JSON with native fold buttons and adjacent punctuation without changing the data', () => {
    const source = getRequestPanelResponseClientScript();
    const fragment = source.slice(source.indexOf('function appendJsonPath('), source.indexOf('function resolveJsonPath('));
    const context = vm.createContext({
      escapeHtml: (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
      escapeAttr: (value: string) => value.replace(/"/g, '&quot;'),
      tr: (key: string) => key,
      tf: (key: string, args: { path: string }) => key + args.path,
      tfCount: (_key: string, count: number) => String(count),
    });
    vm.runInContext(fragment, context);
    const value = { name: '<script>', count: 2, nested: { ok: true } };
    const original = JSON.stringify(value);
    const html = vm.runInContext('buildJsonTree(' + original + ', "", true, "$")', context) as string;
    assert.match(html, /<button class="jt-toggle" type="button" aria-expanded="true"/);
    assert.match(html, /<span class="jt-separator">: <\/span>/);
    assert.ok(!html.includes('<script>'));
    assert.match(html, /data-copy-path="\$\.nested\.ok"/);
    assert.strictEqual(JSON.stringify(value), original);
  });

  it('keeps the save action’s original response text and byte payload independent of tree presentation', () => {
    const source = getRequestPanelResponseClientScript();
    const callback = source.match(/mc\.querySelector\('\.js-save-response'\)\?\.addEventListener\('click', function\(\) \{([\s\S]*?)\n  \}\);/);
    assert.ok(callback);
    const body = '{\r\n "name": "한글 <tag>", "n": 1\r\n}';
    const bodyBase64 = Buffer.from(body).toString('base64');
    const messages: unknown[] = [];
    const context = vm.createContext({ tabs: [{ id: 'ui', response: { body, bodyBase64, headers: { 'content-type': 'application/json' } } }],
      activeTabId: 'ui', pendingSaveResponseBtn: null, vscode: { postMessage: (message: unknown) => messages.push(message) } });
    vm.runInContext('(function() {' + callback[1] + '})()', context);
    assert.strictEqual(messages.length, 1);
    assert.strictEqual((messages[0] as { body: string }).body, body);
    assert.strictEqual((messages[0] as { bodyBase64: string }).bodyBase64, bodyBase64);
  });
});
