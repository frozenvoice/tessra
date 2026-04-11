import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

function readRequestPanelSource(): string {
  const filePath = path.resolve(__dirname, '../../../../src/panels/RequestPanel.ts');
  return fs.readFileSync(filePath, 'utf8');
}

function extractHtmlTemplate(source: string): string {
  const startMarker = 'return /*html*/ `';
  const start = source.indexOf(startMarker);
  const end = source.lastIndexOf('`;');

  assert.ok(start >= 0, 'webview HTML template start marker should exist');
  assert.ok(end > start, 'webview HTML template end marker should exist');

  return source.slice(start + startMarker.length, end);
}

function renderHtml(template: string): string {
  const factory = new Function(
    'csp',
    'nonce',
    'hljsUri',
    `return \`${template.replace(/`/g, '\\`')}\`;`
  ) as (csp: string, nonce: string, hljsUri: string) => string;

  return factory('default-src none', 'test-nonce', 'hljs.js');
}

function extractInlineScript(html: string): string {
  const startMarker = '<script nonce="test-nonce">';
  const endMarker = '</script>';
  const start = html.indexOf(startMarker);
  const scriptStart = start + startMarker.length;
  const end = html.indexOf(endMarker, scriptStart);

  assert.ok(start >= 0, 'inline script start marker should exist');
  assert.ok(end > scriptStart, 'inline script end marker should exist');

  return html.slice(scriptStart, end);
}

describe('RequestPanel Webview', () => {
  let source: string;
  let html: string;
  let script: string;

  before(() => {
    source = readRequestPanelSource();
    html = renderHtml(extractHtmlTemplate(source));
    script = extractInlineScript(html);
  });

  it('웹뷰 인라인 스크립트가 유효한 자바스크립트다', () => {
    assert.doesNotThrow(() => new vm.Script(script));
  });

  it('스크립트 placeholder 예제가 안전한 따옴표를 사용한다', () => {
    assert.ok(
      html.includes('placeholder="env.set(&quot;token&quot;, &quot;123&quot;);"'),
      'pre-request placeholder should use HTML-escaped quotes'
    );
    assert.ok(
      html.includes('placeholder="test(&quot;status&quot;, function () { pm.response.to.have.status(200); });"'),
      'test placeholder should use HTML-escaped quotes'
    );
    assert.ok(!script.includes("private static createEmptyScripts"), 'webview script should not contain class syntax');
  });

  it('전송 중 상태 문구가 정상 문자열로 표시된다', () => {
    assert.ok(
      html.includes('<span class="spinner"></span>Sending request...'),
      'loading state should render a readable status message'
    );
  });

  it('XML 포맷 기본값과 포맷 상태 저장 로직이 유지된다', () => {
    assert.match(script, /jsonFormatStyle:\s*data\?\.jsonFormatStyle\s*\|\|\s*'pretty'/);
    assert.match(script, /xmlFormatStyle:\s*data\?\.xmlFormatStyle\s*\|\|\s*'inline'/);
    assert.match(script, /formatIndent:\s*data\?\.formatIndent\s*\|\|\s*'2'/);
    assert.match(script, /formatStyle === 'inline'/);
    assert.match(script, /if \(opts\.lang === 'xml'\) tab\.xmlFormatStyle = opts\.style;/);
    assert.match(script, /tab\.formatIndent = opts\.indentKey;/);
    assert.match(script, /xmlFormatStyle:\s*t\.xmlFormatStyle/);
    assert.match(script, /formatIndent:\s*t\.formatIndent/);
  });

  it('URL 입력창에서 plain Enter로 요청을 전송한다', () => {
    assert.match(script, /urlInputEl\.addEventListener\('keydown', function\(e\) \{/);
    assert.match(script, /if \(e\.key !== 'Enter'\) return;/);
    assert.match(script, /if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey \|\| e\.altKey\) return;/);
    assert.match(script, /if \(e\.isComposing \|\| e\.keyCode === 229\) return;/);
    assert.match(script, /e\.preventDefault\(\);[\s\S]*handlePrimaryAction\(\);/);
  });
});
