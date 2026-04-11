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
  'webview.defaultHeadersApplied': 'Workspace default headers active: {count}',
  'webview.defaultHeadersAppliedNote': 'Applied before request-specific headers unless the same key is already set in this tab.',
  'webview.defaultHeadersOverridden': 'Request-specific headers override {count} workspace default header(s).',
  'webview.defaultHeadersAppliedLabel': 'Applied',
  'webview.defaultHeadersOverriddenLabel': 'Overridden',
  'webview.defaultHeadersSkippedState': 'This tab is skipping workspace default headers.',
  'webview.defaultHeadersSkippedNote': 'Turn off "Skip default headers" in Settings to apply them here.',
  'webview.defaultHeadersEmptyState': 'No workspace default headers saved yet.',
  'webview.summaryEnvironment': 'Environment: {name}',
  'webview.summaryAuth': 'Auth: {value}',
  'webview.summaryHeaders': 'Headers: {count}',
  'webview.summaryParams': 'Params: {count}',
  'webview.summaryScriptsOn': 'Scripts enabled',
  'webview.summaryScriptsOff': 'Scripts disabled',
  'webview.summaryHistoryOn': 'History on',
  'webview.summaryHistoryOff': 'History off',
  'webview.unresolvedVariablesCount': 'Unresolved variables: {count}',
  'webview.openEnvironmentPicker': 'Choose Environment',
  'webview.reviewRequestInputs': 'Review Request',
  'webview.authSummaryNone': 'None',
  'webview.authSummaryBasic': 'Basic',
  'webview.authSummaryBearer': 'Bearer',
  'webview.authSummaryApiKeyHeader': 'API Key (Header)',
  'webview.authSummaryApiKeyQuery': 'API Key (Query)',
  'webview.manage': 'Manage',
  'webview.save': 'Save',
  'webview.addHeader': '+ Add Header',
  'webview.bulkPaste': 'Bulk Paste',
  'webview.bulkPasteParams': 'Paste query string or one key/value per line',
  'webview.bulkPasteParamsPlaceholder': 'page=1&size=20\\nfoo=bar',
  'webview.bulkPasteHeaders': 'Paste raw headers or one key/value per line',
  'webview.bulkPasteHeadersPlaceholder': 'Authorization: Bearer token\\nX-Tenant: demo',
  'webview.apply': 'Apply',
  'webview.revealValue': 'Reveal value',
  'webview.hideValue': 'Hide value',
  'webview.revealShort': 'Show',
  'webview.hideShort': 'Hide',
  'webview.emptyPlaceholder': 'Press + or Ctrl+T to create a new request',
  'webview.loading': 'Sending request...',
  'webview.loading.hint': 'You can keep editing headers, body, or settings while the response comes back.',
  'webview.empty.hero.title': 'Ready to ship requests',
  'webview.followRedirects': 'Follow redirects',
  'webview.saveToHistory': 'Save to history',
  'webview.skipDefaultHeaders': 'Skip default headers',
  'webview.disableScripts': 'Disable scripts',
  'webview.previewOfflineTitle': 'Offline HTML Preview',
  'webview.previewOfflineCopy': 'This preview stays local. External scripts, styles, images, and other linked assets are blocked, so dynamic pages may only show static HTML.',
  'webview.previewOfflineSource': 'Source URL',
  'webview.previewOfflineDescription': 'Description',
  'webview.previewOfflineBlockedAssets': 'Blocked external assets: {count}',
  'webview.previewOfflineStaticSnapshot': 'Static snapshot',
  'webview.previewOfflineNoStatic': 'No meaningful static body content was detected in this response.',
  'webview.openUrl': 'Open URL',
  'webview.maxSize': 'Max Size (KB)',
  'webview.retryCount': 'Retry Count',
  'webview.retryDelay': 'Retry Delay',
  'webview.tls': 'TLS',
  'webview.searchPlaceholder': 'Find in response',
  'webview.searchCaseSensitive': 'Case sensitive',
  'webview.searchRegex': 'Use regular expression',
  'webview.searchPrev': 'Previous match',
  'webview.searchNext': 'Next match',
  'webview.searchClear': 'Clear search',
  'webview.searchCount': '{current}/{total}',
  'webview.searchNoMatches': '0 results',
  'webview.includeMetadata': 'Include metadata summary',
  'webview.runStatus': 'Status',
  'webview.runSending': 'Sending',
  'webview.runRetrying': 'Retrying',
  'webview.runAttempt': 'Attempt {current}/{total}',
  'webview.runRetryDelay': 'Retry in {count} ms',
  'webview.preRequestPlaceholder': 'env.set("token", "123");',
  'webview.testPlaceholder': 'test("status", function () { pm.response.to.have.status(200); });',
  'webview.comparisonSettings': 'Comparison Settings',
  'webview.discard': 'Discard',
  'webview.unsavedClosePrompt': 'There are unsaved changes. Close this tab?',
  'webview.unsavedCloseNamedPrompt': '"{name}" has unsaved changes.',
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

  it('renders and collects every auth type from the auth tab UI', () => {
    assert.match(script, /function authHtml\(auth\)/);
    assert.match(script, /function authFieldsHtml\(type, auth\)/);
    assert.match(script, /function collectAuth\(mc\)/);
    assert.match(script, /\['none','basic','bearer','apikey'\]\.map\(t/);
    assert.match(script, /maskedAuthInputHtml\(tr\('webview\.username'\), 'js-auth-user'/);
    assert.match(script, /maskedAuthInputHtml\(tr\('webview\.password'\), 'js-auth-pass'/);
    assert.match(script, /maskedAuthInputHtml\(tr\('webview\.token'\), 'js-auth-token'/);
    assert.match(script, /maskedAuthInputHtml\(tr\('webview\.key'\), 'js-auth-apikey'/);
    assert.match(script, /maskedAuthInputHtml\(tr\('webview\.value'\), 'js-auth-apival'/);
    assert.match(script, /class="js-auth-addto"/);
    assert.match(script, /if \(type === 'basic'\) auth\.basic =/);
    assert.match(script, /if \(type === 'bearer'\) auth\.bearer =/);
    assert.match(script, /if \(type === 'apikey'\) auth\.apikey =/);
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
    assert.match(script, /function tfCount\(key, count\)/);
    assert.match(script, /replace\(\/\{\(\[A-Za-z0-9_\]\+\)\}\/g, function\(_, name\)/);
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

  it('localizes dirty-close prompts and file picker labels', () => {
    assert.match(script, /tr\('webview\.unsavedClosePrompt'\)/);
    assert.match(script, /tf\('webview\.unsavedCloseNamedPrompt', \{ name: tabLabel \}\)/);
    assert.match(script, /tr\('webview\.discard'\)/);
    assert.match(source, /openLabel:\s*LocalizationService\.t\('panel\.selectFile'\)/);
  });

  it('keeps singleton global listeners for format menus and split dragging', () => {
    assert.match(script, /var activeFormatMenuState = null;/);
    assert.match(script, /function closeActiveFormatMenu\(\)/);
    assert.match(script, /document\.addEventListener\('click', function\(e\) \{\s*if \(!activeFormatMenuState\) return;/);
    assert.match(script, /var splitDragState = null;/);
    assert.match(script, /function releaseSplitDrag\(\)/);
    assert.match(script, /document\.addEventListener\('mousemove', function\(e\) \{\s*if \(!splitDragState\) return;/);
    assert.match(script, /document\.addEventListener\('mouseup', function\(\) \{\s*releaseSplitDrag\(\);/);
    assert.doesNotMatch(script, /document\.addEventListener\('click', \(\) => fmtMenu\.classList\.remove\('open'\)\)/);
  });

  it('cancels collection retry delays when stop is requested', () => {
    assert.match(source, /private async waitForCollectionRetryDelay\(ms: number\): Promise<void>/);
    assert.match(source, /this\.currentCollectionDelayCancel = cancel;/);
    assert.match(source, /await this\.waitForCollectionRetryDelay\(settings\.retryDelayMs\);/);
    assert.match(source, /case MessageType\.StopCollectionRun:[\s\S]*this\.currentCollectionDelayCancel\?\.\(\);[\s\S]*this\.currentCollectionDelayCancel = null;/);
  });

  it('resolves active environment variables before copying or generating code', () => {
    assert.match(source, /const exported = RequestExportService\.resolve\(\{/);
    assert.match(source, /RequestPanel\.environmentProvider\.getActiveVariables\(\)/);
    assert.match(source, /defaultHeaders:\s*RequestPanel\.storage\.getDefaultHeaders\(\)/);
    assert.match(source, /skipDefaultHeaders:\s*message\.skipDefaultHeaders === true/);
    assert.match(source, /const curl = CurlService\.generate\(exported\);/);
    assert.match(source, /CodegenService\.generate\(target\.target, exported\)/);
    assert.match(script, /skipDefaultHeaders:\s*!!tab\.skipDefaultHeaders/);
  });

  it('renders the expanded request settings controls', () => {
    assert.ok(html.includes('Follow redirects'), 'settings tab should include redirect toggle');
    assert.ok(html.includes('Save to history'), 'settings tab should include history toggle');
    assert.ok(html.includes('Skip default headers'), 'settings tab should include default header toggle');
    assert.ok(html.includes('Disable scripts'), 'settings tab should include script toggle');
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
    assert.match(script, /buildSaveRequestMessage\(tab/);
    assert.match(script, /followRedirects:\s*!!tab\.followRedirects/);
    assert.match(script, /saveToHistory:\s*tab\.saveToHistory !== false/);
  });

  it('opens HTML preview automatically when meaningful static HTML exists', () => {
    assert.match(script, /function collapseWhitespace\(text\)/);
    assert.match(script, /function hasMeaningfulStaticPreview\(rawHtml\)/);
    assert.match(script, /function hasHtmlPreview\(tab\)/);
    assert.match(script, /tab\.responseTab = \(contentType\.indexOf\('html'\) >= 0 && hasMeaningfulStaticPreview\(msg\.response\.body \|\| ''\)\) \? 'resPreview' : 'resBody';/);
    assert.match(script, /(var|const) tab = tabs\.find\(tt => tt\.id === activeTabId\);[\s\S]*tab\.responseTab = t\.dataset\.tab;/);
    assert.match(script, /function buildPreviewDocument\(rawHtml, resolvedUrl\)/);
    assert.match(script, /function syncPreviewFrame\(preview, tab\)/);
    assert.match(script, /const previewAvailable = lang === 'html' && hasHtmlPreview\(tab\);/);
    assert.match(script, /\(previewAvailable \? '<div class="tab' \+ \(showPreview \? ' active' : ''\) \+ '" data-tab="resPreview">/);
    assert.match(script, /<div class="res-preview' \+ \(showPreview \? '' : ' hidden'\) \+ ' js-res-preview"><\/div>/);
    assert.match(script, /preview\.innerHTML = buildPreviewDocument\(tab\.response\.body \|\| '', tab\.resolvedUrl \|\| tab\.url \|\| ''\);/);
    assert.match(script, /querySelectorAll\('script, style, noscript, iframe, object, embed, link, source, audio, video, track, base, meta\[http-equiv="refresh"\]'\)/);
    assert.match(script, /tf\('webview\.previewOfflineBlockedAssets', \{ count: String\(payload\.blockedAssets\) \}\)/);
    assert.match(script, /js-open-response-url/);
  });

  it('surfaces workspace default headers directly in the request UI', () => {
    assert.match(script, /let workspaceDefaultHeaders = \[\];/);
    assert.match(script, /function renderDefaultHeadersBanner\(tab\)/);
    assert.match(script, /function refreshDefaultHeadersBanner\(mc\)/);
    assert.match(script, /function getOverriddenDefaultHeaders\(tab\)/);
    assert.match(script, /function renderDefaultHeaderKeyGroup\(labelKey, headers, chipClass\)/);
    assert.match(script, /js-open-default-headers-top/);
    assert.match(script, /js-default-headers-banner-wrap/);
    assert.match(script, /vscode\.postMessage\(\{ type: 'openDefaultHeaders' \}\)/);
    assert.match(script, /workspaceDefaultHeaders = msg\.headers \|\| \[\];/);
    assert.match(script, /if \(msg\.reveal !== false\)/);
    assert.match(script, /tfCount\('webview\.defaultHeadersApplied', applied\.length\)/);
    assert.match(script, /tfCount\('webview\.defaultHeadersOverridden', overridden\.length\)/);
    assert.match(script, /renderDefaultHeaderKeyGroup\('webview\.defaultHeadersAppliedLabel', applied, ''\)/);
    assert.match(script, /renderDefaultHeaderKeyGroup\('webview\.defaultHeadersOverriddenLabel', overridden, ' override'\)/);
  });

  it('shows the current environment with a localized label instead of raw template syntax', () => {
    assert.match(script, /function renderEnvironmentIndicator\(envName\)/);
    assert.match(script, /function renderToplineStatusChips\(tab\)/);
    assert.match(script, /function refreshToplineStatusChips\(mc\)/);
    assert.match(script, /class="request-status-chips js-topline-status-chips"/);
    assert.match(script, /tr\('webview\.noEnvironment'\)/);
    assert.match(script, /tfCount\('webview\.defaultHeadersStatus', appliedDefaultHeaders\.length\)/);
    assert.match(script, /tr\('webview\.disableScriptsStatus'\)/);
    assert.match(script, /tr\('webview\.saveToHistoryOffStatus'\)/);
    assert.match(script, /tr\('webview\.environment'\)/);
    assert.doesNotMatch(script, /<span class="var-name">\{\{env\}\}<\/span>/);
  });

  it('renders response search controls and search syncing helpers', () => {
    assert.match(script, /function getResponseSearchState\(tab\)/);
    assert.match(script, /function findResponseSearchMatches\(body, query, options\)/);
    assert.match(script, /function renderResponseBody\(body, lang, searchQuery, searchIndex, searchState\)/);
    assert.match(script, /function syncResponseSearch\(mc\)/);
    assert.match(script, /placeholder="' \+ escapeAttr\(tr\('webview\.searchPlaceholder'\)\) \+ '"/);
    assert.match(script, /class="response-search-input js-response-search"/);
    assert.match(script, /js-response-search-prev/);
    assert.match(script, /js-response-search-next/);
    assert.match(script, /js-response-search-clear/);
    assert.match(script, /js-response-search-case/);
    assert.match(script, /js-response-search-regex/);
  });

  it('renders preflight, masking, and bulk paste request helpers', () => {
    assert.match(script, /function renderRequestPreflight\(tab\)/);
    assert.match(script, /class="js-request-preflight-wrap"/);
    assert.match(script, /tfCount\('webview\.unresolvedVariablesCount', unresolved\.length\)/);
    assert.match(script, /function isSensitiveKeyName\(value\)/);
    assert.match(script, /class="kv-reveal/);
    assert.match(script, /class="ghost-btn auth-reveal js-auth-reveal"/);
    assert.match(script, /function parseBulkKeyValueText\(text, target\)/);
    assert.match(script, /function applyBulkEditor\(mc, target\)/);
    assert.match(script, /js-open-bulk-editor/);
  });

  it('persists enriched response search state and supports environment-switch actions', () => {
    assert.match(script, /responseSearchQuery: typeof data\?\.responseSearchQuery === 'string'/);
    assert.match(script, /responseSearchCaseSensitive: data\?\.responseSearchCaseSensitive === true/);
    assert.match(script, /responseSearchRegex: data\?\.responseSearchRegex === true/);
    assert.match(script, /responseSearchQuery: t\.responseSearchQuery \|\| ''/);
    assert.match(script, /responseSearchCaseSensitive: t\.responseSearchCaseSensitive === true/);
    assert.match(script, /responseSearchRegex: t\.responseSearchRegex === true/);
    assert.match(script, /data-action="switch-environment"/);
    assert.match(script, /type: 'switchEnvironment'/);
  });

  it('shows richer collection runner status updates', () => {
    assert.match(source, /type: 'runCollectionStatus'/);
    assert.match(script, /function updateRunnerStatus\(msg\)/);
    assert.match(script, /class="runner-live-status"/);
    assert.match(script, /tr\('webview\.runSending'\)/);
    assert.match(script, /tr\('webview\.runRetrying'\)/);
  });
});
