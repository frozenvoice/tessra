import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const TEST_STRINGS: Record<string, string> = {
  'webview.newTab': 'New tab',
  'webview.environment': 'Environment:',
  'webview.unsavedChanges': 'Unsaved changes',
  'webview.autoSaved': 'Auto-saved',
  'webview.addVariable': '+ Add Variable',
  'webview.defaultHeaders': 'Default Headers',
  'webview.save': 'Save',
  'webview.addHeader': '+ Add Header',
  'webview.emptyPlaceholder': 'Press + or Ctrl+T to create a new request',
  'webview.loading': 'Sending request...',
  'webview.loading.hint': 'You can keep editing headers, body, or settings while the response comes back.',
  'webview.empty.hero.title': 'Ready to ship requests',
  'webview.followRedirects': 'Follow redirects',
  'webview.saveToHistory': 'Save to history',
  'webview.skipDefaultHeaders': 'Skip default headers',
  'webview.disableScripts': 'Disable scripts',
  'webview.openHtmlPreview': 'Open HTML preview by default',
  'webview.maxSize': 'Max Size (KB)',
  'webview.retryCount': 'Retry Count',
  'webview.retryDelay': 'Retry Delay',
  'webview.tls': 'TLS',
  'webview.preRequestPlaceholder': 'env.set("token", "123");',
  'webview.testPlaceholder': 'test("status", function () { pm.response.to.have.status(200); });',
  'webview.comparisonSettings': 'Comparison Settings',
};

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
    'displayLanguage',
    'localizedStrings',
    'dateLocale',
    'LocalizationService',
    `return \`${template.replace(/`/g, '\\`')}\`;`
  ) as (
    csp: string,
    nonce: string,
    hljsUri: string,
    displayLanguage: string,
    localizedStrings: string,
    dateLocale: string,
    localizationService: { t: (key: string) => string }
  ) => string;

  return factory(
    'default-src none',
    'test-nonce',
    'hljs.js',
    'en',
    JSON.stringify(TEST_STRINGS).replace(/</g, '\\u003c'),
    'en-US',
    {
      t: (key: string) => TEST_STRINGS[key] ?? key,
    }
  );
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

  it('renders an inline script that parses as valid JavaScript', () => {
    assert.doesNotThrow(() => new vm.Script(script));
  });

  it('uses HTML-escaped placeholders for script editors', () => {
    assert.match(
      script,
      /placeholder="' \+ escapeAttr\(tr\('webview\.preRequestPlaceholder'\)\) \+ '"/,
      'pre-request placeholder should be resolved through localized escaped text'
    );
    assert.match(
      script,
      /placeholder="' \+ escapeAttr\(tr\('webview\.testPlaceholder'\)\) \+ '"/,
      'test placeholder should be resolved through localized escaped text'
    );
    assert.ok(!script.includes('private static createEmptyScripts'), 'webview script should not contain class syntax');
  });

  it('shows a readable loading state', () => {
    assert.match(script, /tr\('webview\.loading'\)/, 'loading state should use the localized loading label');
    assert.match(script, /tr\('webview\.loading\.hint'\)/, 'loading hint should use the localized helper copy');
  });

  it('keeps XML formatting defaults and persistence logic', () => {
    assert.match(script, /jsonFormatStyle:\s*data\?\.jsonFormatStyle\s*\|\|\s*'pretty'/);
    assert.match(script, /xmlFormatStyle:\s*data\?\.xmlFormatStyle\s*\|\|\s*'inline'/);
    assert.match(script, /formatIndent:\s*data\?\.formatIndent\s*\|\|\s*'2'/);
    assert.match(script, /formatStyle === 'inline'/);
    assert.match(script, /if \(opts\.lang === 'xml'\) tab\.xmlFormatStyle = opts\.style;/);
    assert.match(script, /tab\.formatIndent = opts\.indentKey;/);
    assert.match(script, /xmlFormatStyle:\s*t\.xmlFormatStyle/);
    assert.match(script, /formatIndent:\s*t\.formatIndent/);
  });

  it('submits the request when Enter is pressed in the URL field', () => {
    assert.match(script, /urlInputEl\.addEventListener\('keydown', function\(e\) \{/);
    assert.match(script, /if \(e\.key !== 'Enter'\) return;/);
    assert.match(script, /if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey \|\| e\.altKey\) return;/);
    assert.match(script, /if \(e\.isComposing \|\| e\.keyCode === 229\) return;/);
    assert.match(script, /e\.preventDefault\(\);[\s\S]*handlePrimaryAction\(\);/);
  });

  it('persists compare settings through tab state', () => {
    assert.match(script, /var compareSettings = normalizeCompareSettings\(\);/);
    assert.match(script, /options:\s*cloneCompareSettings\(compareSettings\)/);
    assert.match(script, /compareSettings = normalizeCompareSettings\(msg\.compareSettings\);/);
    assert.match(script, /type: 'saveTabState'[\s\S]*compareSettings: cloneCompareSettings\(compareSettings\)/);
    assert.ok(html.includes('Comparison Settings'), 'compare settings dialog should be rendered in the webview template');
  });

  it('injects display language resources into the webview', () => {
    assert.ok(html.includes('<html lang="en">'), 'webview should render with the configured display language');
    assert.match(script, /let i18n = \{/);
    assert.match(script, /let appDateLocale = "en-US";/);
    assert.match(script, /function tr\(key\)/);
    assert.match(script, /function tf\(key, params\)/);
  });

  it('updates localization without reloading the whole webview state', () => {
    assert.match(script, /function applyLocalizationUpdate\(msg\)/);
    assert.match(script, /if \(msg\.type === 'updateLocalization'\)/);
    assert.match(script, /function knownDefaultTabNames\(\)/);
    assert.match(script, /if \(tab\.autoName \|\| isKnownDefaultTabName\(tab\.name\)\) \{/);
    assert.match(script, /updateStaticLocalizedText\(\);[\s\S]*renderTabBar\(\);[\s\S]*renderContent\(\);/);
  });

  it('preserves auto-generated tab names across restore so localization can update them after restart', () => {
    assert.match(script, /const autoName = data\?\.autoName === true/);
    assert.match(script, /name: autoName \? tr\('webview\.stage\.newRequest'\) : \(incomingName \|\| tr\('webview\.stage\.newRequest'\)\)/);
    assert.match(script, /autoName: autoName/);
    assert.match(script, /autoName: !!t\.autoName/);
  });

  it('renders the expanded request settings controls', () => {
    assert.ok(html.includes('Follow redirects'), 'settings tab should include redirect toggle');
    assert.ok(html.includes('Save to history'), 'settings tab should include history toggle');
    assert.ok(html.includes('Skip default headers'), 'settings tab should include default header toggle');
    assert.ok(html.includes('Disable scripts'), 'settings tab should include script toggle');
    assert.ok(html.includes('Open HTML preview by default'), 'settings tab should include preview toggle');
    assert.ok(html.includes('Max Size (KB)'), 'settings tab should include max response size');
    assert.ok(html.includes('Retry Count'), 'settings tab should include retry count');
    assert.ok(html.includes('Retry Delay'), 'settings tab should include retry delay');
    assert.ok(html.includes('TLS'), 'settings tab should include TLS override');
  });

  it('renders the upgraded workspace UI affordances', () => {
    assert.ok(html.includes('Ready to ship requests'), 'empty state hero should be rendered');
    assert.ok(html.includes('settings-grid'), 'settings layout should use cards');
    assert.ok(html.includes('script-card'), 'scripts tab should use cards');
    assert.ok(html.includes('btn-keyhint'), 'send button should show the Enter key hint');
    assert.match(script, /function getRequestStageInfo\(tab\)/);
    assert.match(script, /function renderEmptyState\(kicker, title, copy, cards\)/);
    assert.match(script, /function buildCompareChipMarkup\(currentSignature\)/);
  });

  it('normalizes and persists request settings in tab state and save actions', () => {
    assert.match(script, /function getRequestSettings\(data\)/);
    assert.match(script, /function requestSettingsSnapshot\(tab\)/);
    assert.match(script, /followRedirects:\s*data\?\.followRedirects === true/);
    assert.match(script, /saveToHistory:\s*data\?\.saveToHistory !== false/);
    assert.match(script, /tlsValidation:\s*normalizeTlsValidation\(data\?\.tlsValidation\)/);
    assert.match(script, /maxResponseSizeKb:\s*normalizeNumberSetting\(data\?\.maxResponseSizeKb\)/);
    assert.match(script, /retryCount:\s*normalizeNumberSetting\(data\?\.retryCount\)/);
    assert.match(script, /retryDelayMs:\s*normalizeNumberSetting\(data\?\.retryDelayMs\)/);
    assert.match(script, /stopAfterHeaders:\s*data\?\.stopAfterHeaders === true/);
    assert.match(script, /skipDefaultHeaders:\s*data\?\.skipDefaultHeaders === true/);
    assert.match(script, /disableScripts:\s*data\?\.disableScripts === true/);
    assert.match(script, /openHtmlPreviewByDefault:\s*data\?\.openHtmlPreviewByDefault === true/);
    assert.match(script, /buildSaveRequestMessage\(tab/);
    assert.match(script, /followRedirects:\s*!!tab\.followRedirects/);
    assert.match(script, /saveToHistory:\s*tab\.saveToHistory !== false/);
    assert.match(script, /openHtmlPreviewByDefault:\s*!!tab\.openHtmlPreviewByDefault/);
  });

  it('opens HTML preview automatically when the setting is enabled', () => {
    assert.match(script, /tab\.responseTab = \(tab\.openHtmlPreviewByDefault && contentType\.indexOf\('html'\) >= 0\) \? 'resPreview' : 'resBody';/);
    assert.match(script, /(var|const) tab = tabs\.find\(tt => tt\.id === activeTabId\);[\s\S]*tab\.responseTab = t\.dataset\.tab;/);
  });
});
