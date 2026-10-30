import * as assert from 'assert';
import * as vm from 'vm';
import { getRequestPanelResponseClientScript } from '../../panels/requestPanel/requestPanelResponseClientScript';
import { getRequestPanelRunnerClientScript } from '../../panels/requestPanel/requestPanelRunnerClientScript';

function warningContext(): vm.Context {
  const strings: Record<string, string> = {
    'webview.responseCharsetUnsupported': 'Unsupported {charset}.',
    'webview.responseCharsetInvalidBytes': 'Invalid {charset}.',
    'webview.responseOriginalBytesPreserved': 'Original bytes are preserved when saving.',
  };
  const context = vm.createContext({
    tr: (key: string) => strings[key] || key,
    tf: (key: string, args: Record<string, unknown>) => (strings[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(args[name])),
    escapeHtml: (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  });
  vm.runInContext(getRequestPanelResponseClientScript(), context);
  return context;
}

describe('응답 charset warning Webview 계약', () => {
  it('charset에서 온 HTML을 escape하고 warning 없는 응답은 안내를 표시하지 않는다', () => {
    const context = warningContext();
    const render = context.renderResponseDecodingWarning as (response: unknown) => string;
    const html = render({ decodingWarning: { reason: 'unsupported-charset', charset: '<img src=x onerror=alert(1)>' } });
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('data-testid="response-decoding-warning"'));
    assert.ok(html.includes('Original bytes are preserved when saving.'));
    assert.strictEqual(render({ body: 'ok' }), '');
  });

  it('pin snapshot이 response warning과 원문을 유지한다', () => {
    const context = warningContext();
    const warning = { reason: 'invalid-bytes', charset: 'utf-8' };
    const snapshot = (context.createResponseSnapshot as (tab: unknown, response: unknown, label: string) => Record<string, unknown>)({}, {
      body: '\ufffd', bodyBase64: '6rA=', headers: { 'content-type': 'text/plain' }, status: 200, decodingWarning: warning,
    }, 'fixture');
    assert.strictEqual(snapshot.decodingWarning, warning);
    assert.strictEqual(snapshot.bodyBase64, '6rA=');
  });

  it('응답·Runner fragment는 실행 가능한 JS이며 Runner는 동일한 warning 텍스트를 사용한다', () => {
    assert.doesNotThrow(() => new vm.Script(getRequestPanelResponseClientScript()));
    assert.doesNotThrow(() => new vm.Script(getRequestPanelRunnerClientScript()));
    assert.ok(getRequestPanelRunnerClientScript().includes('responseDecodingWarningText(r.response)'));
  });
});
