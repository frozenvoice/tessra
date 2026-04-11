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
  'webview.summaryProfile': 'Profile: {name}',
  'webview.profileDefaultTooltip': 'Default profile. Use this for your main Arc Client workspace. Create another profile when you want separate collections, history, environments, default headers, and tabs.',
  'webview.profileCustomTooltip': 'This profile keeps collections, history, environments, default headers, and tabs separate from other profiles. Click to switch or create another profile.',
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
  'webview.followRedirectsStatus': 'Redirects on',
  'webview.stopAfterHeaders': 'Stop after headers',
  'webview.stopAfterHeadersStatus': 'Headers only',
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
  'webview.jsonPathHint': 'Click a row to copy JSONPath',
  'webview.xpathHint': 'Click a line to copy XPath',
  'webview.copyPathShort': 'PATH',
  'webview.includeMetadata': 'Include metadata summary',
  'webview.foldUnchanged': 'Fold unchanged sections',
  'webview.compareFoldUnchanged': 'Compare: fold unchanged sections',
  'webview.copyJsonPathValue': 'Copy JSONPath: {path}',
  'webview.copyXPathValue': 'Copy XPath: {path}',
  'webview.copyXPathShort': 'XPath',
  'webview.runStatus': 'Status',
  'webview.runSending': 'Sending',
  'webview.runRetrying': 'Retrying',
  'webview.runAttempt': 'Attempt {current}/{total}',
  'webview.runRetryDelay': 'Retry in {count} ms',
  'webview.runRerunFailed': 'Rerun Failed',
  'webview.preRequestPlaceholder': 'env.set("token", "123");',
  'webview.scriptHelpTitle': 'Script helpers',
  'webview.scriptHelpRuntimeTitle': 'Built-ins',
  'webview.scriptHelpRuntimeCopy': 'pm, env, test(), expect(), and assert() are available without importing anything.',
  'webview.scriptHelpStepperTitle': 'Follow the 4-step request flow',
  'webview.scriptHelpCollapse': 'Collapse help',
  'webview.scriptHelpExpand': 'Expand help',
  'webview.scriptHelpCollapsedCopy': 'Open the helper again anytime for built-ins, chaining examples, and step-by-step reminders.',
  'webview.scriptHelpWhenTitle': 'When to use scripts',
  'webview.scriptHelpRuntimeWhen': 'Use environment variables directly for fixed values. Use scripts when a value needs to come from a previous response.',
  'webview.scriptHelpStageFixed': 'Start with environments',
  'webview.scriptHelpStageSend': 'Send the resolved request',
  'webview.scriptHelpStageTest': 'Read the response in tests',
  'webview.scriptHelpStageReuse': 'Reuse the saved value',
  'webview.scriptHelpRuleFixed': 'If the value is already known, keep it in environments and just reference {{variable}}.',
  'webview.scriptHelpRuleDerived': 'If request 2 depends on request 1, save the response value in a test script and reuse it.',
  'webview.scriptHelpRulePreRequest': 'If something must be prepared right before sending, use the pre-request script.',
  'webview.scriptHelpSequenceTitle': 'Execution order',
  'webview.scriptHelpSequencePre': 'Pre-request script runs first and can prepare variables before the request is sent.',
  'webview.scriptHelpSequenceSend': 'Arc Client sends the request with the latest resolved URL, headers, body, and auth.',
  'webview.scriptHelpSequenceTest': 'After the response arrives, the test script can inspect pm.response and assert values.',
  'webview.scriptHelpSequencePersist': 'Values saved with pm.environment.set(...) are available to the next request right away.',
  'webview.scriptHelpFlowTitle': 'Chain request 1 -> request 2',
  'webview.scriptHelpFlowCopy': 'Save a response value in request 1, then reference it as {{sessionKey}} in request 2.',
  'webview.scriptHelpRequestOne': 'Request 1 · Test script',
  'webview.scriptHelpRequestTwo': 'Request 2 · Use in URL, headers, body, or auth',
  'webview.scriptHelpQuickInsertTitle': 'Quick inserts',
  'webview.scriptHelpQuickInsertCopy': 'Drop a starter snippet into the editor below, then only adjust the variable names you need.',
  'webview.scriptHelpInsertPreRequest': 'Insert pre-request example',
  'webview.scriptHelpInsertCapture': 'Insert capture example',
  'webview.scriptHelpInsertStatus': 'Insert status test',
  'webview.sampleRequestName': 'Sample Request',
  'webview.requestDiffTitle': 'Request changes',
  'webview.requestDiffCount': '{count} updates',
  'webview.requestDiffEdited': 'Edited',
  'webview.requestDiffUpdated': 'Updated',
  'webview.requestDiffRequest': 'Request',
  'webview.requestDiffParams': 'Params',
  'webview.requestDiffHeaders': 'Headers',
  'webview.requestDiffBody': 'Body',
  'webview.requestDiffAuth': 'Auth',
  'webview.requestDiffScripts': 'Scripts',
  'webview.requestDiffSettings': 'Settings',
  'webview.variableUsageTitle': 'Variable usage',
  'webview.variableUsageCount': '{count} variables',
  'webview.variablePreviewTitle': 'Resolved variables',
  'webview.variablePreviewMissing': 'Missing in the active environment',
  'webview.variableAutocompleteTitle': 'Insert variable',
  'webview.variableAutocompleteEmpty': 'There are no matching variables in the active environment.',
  'webview.varScopeUrl': 'URL',
  'webview.varScopeParams': 'Params',
  'webview.varScopeHeaders': 'Headers',
  'webview.varScopeDefaultHeaders': 'Default Headers',
  'webview.varScopeBody': 'Body',
  'webview.varScopeFormData': 'Form Data',
  'webview.varScopeBinary': 'Binary',
  'webview.varScopeAuth': 'Auth',
  'webview.varScopeScripts': 'Scripts',
  'webview.formDataSummaryFields': '{count} fields',
  'webview.formDataSummaryFiles': '{count} files',
  'webview.formDataSummaryText': '{count} text',
  'webview.fileSelected': 'File: {name}',
  'webview.testSummaryPass': '{count} passed',
  'webview.testSummaryFail': '{count} failed',
  'webview.testSummaryLogs': '{count} logs',
  'webview.testSummaryAllPassed': 'All tests passed',
  'webview.testSummaryFirstFailure': 'First failure',
  'webview.testPlaceholder': 'test("status", function () { pm.response.to.have.status(200); });',
  'webview.inserted': 'Inserted',
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
    'requestPanelTheme',
    'localizedStrings',
    'dateLocale',
    'LocalizationService',
    `return \`${template.replace(/`/g, '\\`')}\`;`
  ) as (
    csp: string,
    nonce: string,
    hljsUri: string,
    displayLanguage: string,
    requestPanelTheme: string,
    localizedStrings: string,
    dateLocale: string,
    localizationService: { t: (key: string) => string }
  ) => string;

  return factory(
    'default-src none',
    'test-nonce',
    'hljs.js',
    'en',
    'default',
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

function extractScriptSegment(script: string, startMarker: string, endMarker: string): string {
  const start = script.indexOf(startMarker);
  const end = script.indexOf(endMarker, start);

  assert.ok(start >= 0, `script start marker should exist: ${startMarker}`);
  assert.ok(end > start, `script end marker should exist: ${endMarker}`);

  return script.slice(start, end);
}

class FakeClassList {
  private readonly values = new Set<string>();

  constructor(initial: string[] = []) {
    initial.forEach((value) => this.values.add(value));
  }

  add(...tokens: string[]) {
    tokens.forEach((token) => this.values.add(token));
  }

  remove(...tokens: string[]) {
    tokens.forEach((token) => this.values.delete(token));
  }

  contains(token: string) {
    return this.values.has(token);
  }

  toggle(token: string, force?: boolean) {
    const nextValue = force === undefined ? !this.contains(token) : force;
    if (nextValue) {
      this.add(token);
    } else {
      this.remove(token);
    }
    return nextValue;
  }
}

class FakeElement {
  public readonly classList: FakeClassList;
  public readonly dataset: Record<string, string> = {};
  public readonly children: FakeElement[] = [];
  public parent: FakeElement | null = null;
  public focusCalls: unknown[] = [];
  public scrollCalls: unknown[] = [];
  public isConnected = true;
  public tabindex?: string;

  constructor(public readonly tagName = 'div', initialClasses: string[] = []) {
    this.classList = new FakeClassList(initialClasses);
  }

  append(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === '.linked-focus-active') {
      return this.collect((node) => node.classList.contains('linked-focus-active'));
    }
    if (selector === 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])') {
      return this.collect(
        (node) =>
          ['input', 'textarea', 'select', 'button'].includes(node.tagName.toLowerCase())
          || (typeof node.tabindex === 'string' && node.tabindex !== '-1')
      );
    }
    return [];
  }

  closest(selector: string): FakeElement | null {
    const selectors = selector.split(',').map((value) => value.trim()).filter(Boolean);
    let current: FakeElement | null = this;
    while (current) {
      const node = current;
      if (selectors.some((value) => node.matches(value))) {
        return node;
      }
      current = current.parent;
    }
    return null;
  }

  focus(options?: unknown) {
    this.focusCalls.push(options);
  }

  scrollIntoView(options?: unknown) {
    this.scrollCalls.push(options);
  }

  private collect(predicate: (node: FakeElement) => boolean): FakeElement[] {
    const result: FakeElement[] = [];
    const visit = (node: FakeElement) => {
      if (predicate(node)) {
        result.push(node);
      }
      node.children.forEach(visit);
    };
    visit(this);
    return result;
  }

  private matches(selector: string): boolean {
    if (!selector) {
      return false;
    }
    if (selector.startsWith('.')) {
      const classNames = selector.slice(1).split('.').filter(Boolean);
      return classNames.every((className) => this.classList.contains(className));
    }
    if (selector === 'input' || selector === 'textarea' || selector === 'select' || selector === 'button') {
      return this.tagName.toLowerCase() === selector;
    }
    if (selector === '[tabindex]:not([tabindex="-1"])') {
      return typeof this.tabindex === 'string' && this.tabindex !== '-1';
    }
    return false;
  }
}

class FakeRootElement extends FakeElement {
  private readonly selectorMap = new Map<string, FakeElement>();
  private readonly selectorListMap = new Map<string, FakeElement[]>();

  register(selector: string, element: FakeElement): FakeElement {
    this.selectorMap.set(selector, element);
    return element;
  }

  registerAll(selector: string, elements: FakeElement[]): FakeElement[] {
    this.selectorListMap.set(selector, elements);
    return elements;
  }

  querySelector(selector: string): FakeElement | null {
    return this.selectorMap.get(selector) ?? super.querySelector(selector);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorListMap.get(selector) ?? super.querySelectorAll(selector);
  }
}

function createAnimationHarness() {
  let nextFrameId = 1;
  let nextTimerId = 1;
  const frameOrder: number[] = [];
  const frameCallbacks = new Map<number, (time: number) => void>();
  const timerCallbacks = new Map<number, () => void>();

  return {
    requestAnimationFrame(callback: (time: number) => void) {
      const frameId = nextFrameId++;
      frameOrder.push(frameId);
      frameCallbacks.set(frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(frameId: number) {
      frameCallbacks.delete(frameId);
      const index = frameOrder.indexOf(frameId);
      if (index >= 0) {
        frameOrder.splice(index, 1);
      }
    },
    flushFrame() {
      const pending = frameOrder.splice(0, frameOrder.length);
      pending.forEach((frameId) => {
        const callback = frameCallbacks.get(frameId);
        if (!callback) {
          return;
        }
        frameCallbacks.delete(frameId);
        callback(0);
      });
    },
    setTimeout(callback: () => void) {
      const timerId = nextTimerId++;
      timerCallbacks.set(timerId, callback);
      return timerId;
    },
    clearTimeout(timerId: number) {
      timerCallbacks.delete(timerId);
    },
    flushTimers() {
      const pending = [...timerCallbacks.entries()];
      timerCallbacks.clear();
      pending.forEach(([, callback]) => callback());
    },
  };
}

function createLinkedFocusHarness() {
  const mc = new FakeRootElement();

  const panels = {
    params: mc.register('.js-params-panel', mc.append(new FakeElement('div', ['js-params-panel', 'hidden']))),
    headers: mc.register('.js-headers-panel', mc.append(new FakeElement('div', ['js-headers-panel', 'hidden']))),
    body: mc.register('.js-body-panel', mc.append(new FakeElement('div', ['js-body-panel', 'hidden']))),
    auth: mc.register('.js-auth-panel', mc.append(new FakeElement('div', ['js-auth-panel', 'hidden']))),
    scripts: mc.register('.js-scripts-panel', mc.append(new FakeElement('div', ['js-scripts-panel', 'hidden']))),
    settings: mc.register('.js-settings-panel', mc.append(new FakeElement('div', ['js-settings-panel', 'hidden']))),
  };

  const tabButtons = ['params', 'headers', 'body', 'auth', 'scripts', 'settings'].map((name) => {
    const button = new FakeElement('button', ['tab']);
    button.dataset.tab = name;
    return button;
  });
  mc.registerAll('.js-req-tabs .tab', tabButtons);

  const saveHistoryToggle = panels.settings.append(new FakeElement('label', ['settings-toggle']));
  const saveHistoryInput = saveHistoryToggle.append(new FakeElement('input', ['js-save-history']));
  mc.register('.js-save-history', saveHistoryInput);

  return {
    mc,
    settingsPanel: panels.settings,
    settingsTabButton: tabButtons.find((button) => button.dataset.tab === 'settings')!,
    saveHistoryToggle,
    saveHistoryInput,
  };
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
    assert.match(script, /foldUnchangedSections:\s*value \? value\.foldUnchangedSections !== false : DEFAULT_COMPARE_FOLD_UNCHANGED/);
    assert.match(script, /type: 'saveTabState'[\s\S]*compareSettings: cloneCompareSettings\(compareSettings\)/);
    assert.match(script, /var compareContextActive = !!lastResponse \|\| pinnedResponses\.length > 0;/);
    assert.match(script, /tr\('webview\.compareFoldUnchanged'\)/);
    assert.ok(html.includes('Comparison Settings'), 'compare settings dialog should be rendered in the webview template');
  });

  it('renders path copy helpers for JSON and XML response bodies', () => {
    assert.match(script, /function appendJsonPath\(basePath, segment, isArray\)/);
    assert.match(script, /data-copy-path="' \+ escapeAttr\(copyPath\) \+ '"/);
    assert.match(script, /function extractXmlLinePaths\(body\)/);
    assert.match(script, /function renderXmlBodyWithPaths\(body\)/);
    assert.match(script, /js-copy-xml-path/);
    assert.match(script, /tr\('webview\.jsonPathHint'\)/);
    assert.match(script, /tr\('webview\.xpathHint'\)/);
  });

  it('supports keyboard workflow shortcuts for tabs, save, send, and response search', () => {
    assert.match(script, /function triggerSaveFromShortcut\(forceSaveAs\)/);
    assert.match(script, /function focusResponseSearchField\(\)/);
    assert.match(script, /if \(isPrimaryModifier && e\.key\.toLowerCase\(\) === 's'\)/);
    assert.match(script, /if \(isPrimaryModifier && e\.key\.toLowerCase\(\) === 'f'\)/);
    assert.match(script, /if \(e\.altKey && !e\.ctrlKey && !e\.metaKey && digitMatch\)/);
    assert.match(script, /\['params', 'headers', 'body', 'auth', 'scripts', 'settings'\]/);
    assert.match(script, /\['resBody', 'resCookies', 'resHeaders', 'resTests', 'resPreview'\]/);
  });

  it('renders variable hover preview helpers with active environment values', () => {
    assert.match(script, /let activeVarValues = \{\};/);
    assert.match(script, /function syncVariablePreviewHints\(scope\)/);
    assert.match(script, /function showVariablePreviewPopover\(target\)/);
    assert.match(script, /let currentWorkspaceProfile = 'default';/);
    assert.match(script, /msg\.varValues \|\| \{\}/);
    assert.match(script, /tr\('webview\.variablePreviewTitle'\)/);
    assert.match(script, /tr\('webview\.variablePreviewMissing'\)/);
  });

  it('renders variable autocomplete, failed-only rerun, and profile switching helpers', () => {
    assert.match(script, /function syncVariableAutocomplete\(target\)/);
    assert.match(script, /function applyVariableAutocompleteSelection\(index\)/);
    assert.match(script, /tr\('webview\.variableAutocompleteTitle'\)/);
    assert.match(script, /tr\('webview\.variableAutocompleteEmpty'\)/);
    assert.match(script, /change-workspace-profile/);
    assert.match(script, /tr\(currentWorkspaceProfile === 'default' \? 'webview\.profileDefaultTooltip' : 'webview\.profileCustomTooltip'\)/);
    assert.match(script, /type:\s*'changeWorkspaceProfile'/);
    assert.match(script, /type:\s*'rerunFailedCollection'/);
    assert.match(script, /tr\('webview\.runRerunFailed'\)/);
  });

  it('injects display language resources into the webview', () => {
    assert.ok(html.includes('<html lang="en">'), 'webview should render with the configured display language');
    assert.ok(html.includes('<body data-panel-theme="default">'), 'webview should render with the configured request panel theme');
    assert.match(script, /let i18n = \{/);
    assert.match(script, /let appDateLocale = "en-US";/);
    assert.match(script, /function tr\(key\)/);
    assert.match(script, /function tf\(key, params\)/);
    assert.match(script, /function tfCount\(key, count\)/);
    assert.ok(script.includes('replace(/{([A-Za-z0-9_]+)}/g'), 'tf should replace {placeholders} inside localized strings');
  });

  it('updates localization without reloading the whole webview state', () => {
    assert.match(script, /function applyLocalizationUpdate\(msg\)/);
    assert.match(script, /if \(msg\.type === 'updateLocalization'\)/);
    assert.match(script, /const REQUEST_PANEL_THEMES = \['default', 'minimal-cool', 'product', 'bold-color'\];/);
    assert.match(script, /let currentRequestPanelTheme = "default";/);
    assert.match(script, /function normalizeRequestPanelTheme\(theme\)/);
    assert.match(script, /function applyRequestPanelTheme\(theme\)/);
    assert.match(script, /document\.body\.setAttribute\('data-panel-theme', currentRequestPanelTheme\);/);
    assert.match(script, /if \(typeof msg\.requestPanelTheme === 'string' && msg\.requestPanelTheme\) \{/);
    assert.match(script, /function knownDefaultTabNames\(\)/);
    assert.match(script, /if \(tab\.autoName \|\| isKnownDefaultTabName\(tab\.name\)\) \{/);
    assert.match(script, /updateStaticLocalizedText\(\);[\s\S]*renderTabBar\(\);[\s\S]*renderContent\(\);/);
  });

  it('ships distinct visual signatures for the request panel theme presets', () => {
    assert.match(source, /body\[data-panel-theme="minimal-cool"\] \.tab\.active\{[\s\S]*box-shadow:inset 0 -2px 0 rgba\(125,200,255,.9\);/);
    assert.match(source, /body\[data-panel-theme="product"\] \.settings-group-title,\s*body\[data-panel-theme="product"\] \.script-helper-label,/);
    assert.match(source, /body\[data-panel-theme="bold-color"\] \.status-2xx\{[\s\S]*linear-gradient\(135deg,#133a22,#1f7a34\)/);
  });

  it('preserves auto-generated tab names across restore so localization can update them after restart', () => {
    assert.match(script, /const autoName = data\?\.autoName === true/);
    assert.match(script, /name: autoName \? tr\('webview\.stage\.newRequest'\) : \(incomingName \|\| tr\('webview\.stage\.newRequest'\)\)/);
    assert.match(script, /autoName: autoName/);
    assert.match(script, /autoName: !!t\.autoName/);
  });

  it('preserves the active request editor tab across rerenders and saved tab restore', () => {
    assert.match(script, /const REQUEST_EDITOR_TABS = \['params', 'headers', 'body', 'auth', 'scripts', 'settings'\];/);
    assert.match(script, /function normalizeRequestEditorTab\(value\)/);
    assert.match(script, /requestEditorTab: normalizeRequestEditorTab\(data\?\.requestEditorTab\),/);
    assert.match(script, /requestEditorTab: normalizeRequestEditorTab\(mc\.querySelector\('\.js-req-tabs \.tab\.active'\)\?\.dataset\.tab \|\| tab\.requestEditorTab\),/);
    assert.match(script, /tab\.requestEditorTab = normalizeRequestEditorTab\(mc\.querySelector\('\.js-req-tabs \.tab\.active'\)\?\.dataset\.tab \|\| tab\.requestEditorTab\);/);
    assert.match(script, /activeTab\.requestEditorTab = normalizedTabName;/);
    assert.match(script, /const activeRequestEditorTab = normalizeRequestEditorTab\(tab\.requestEditorTab\);/);
    assert.match(script, /requestEditorTab: normalizeRequestEditorTab\(t\.requestEditorTab\),/);
    assert.match(script, /<div class="tab' \+ \(showScriptsEditor \? ' active' : ''\) \+ '" data-tab="scripts">/);
    assert.match(script, /<div class="js-scripts-panel request-editor-panel body-section' \+ \(showScriptsEditor \? '' : ' hidden'\) \+ '">/);
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
    assert.ok(html.includes('Stop after headers'), 'settings tab should include headers-only toggle');
    assert.ok(html.includes('Save to history'), 'settings tab should include history toggle');
    assert.ok(html.includes('Skip default headers'), 'settings tab should include default header toggle');
    assert.ok(html.includes('Disable scripts'), 'settings tab should include script toggle');
    assert.ok(html.includes('Max Size (KB)'), 'settings tab should include max response size');
    assert.ok(html.includes('Retry Count'), 'settings tab should include retry count');
    assert.ok(html.includes('Retry Delay'), 'settings tab should include retry delay');
    assert.ok(html.includes('TLS'), 'settings tab should include TLS override');
    assert.match(script, /function syncSettingsToggleStates\(mc\)/);
    assert.match(script, /settingsPanel\.addEventListener\('change', function\(e\)/);
    const settingsSegment = extractScriptSegment(
      script,
      "var settingsPanel = mc.querySelector('.js-settings-panel');",
      '// === textarea'
    );
    assert.doesNotMatch(settingsSegment, /renderContent\(\);/);
  });

  it('renders the upgraded workspace UI affordances', () => {
    assert.ok(html.includes('Ready to ship requests'), 'empty state hero should be rendered');
    assert.ok(html.includes('settings-grid'), 'settings layout should use cards');
    assert.ok(html.includes('script-card'), 'scripts tab should use cards');
    assert.ok(html.includes('script-helper-grid'), 'scripts tab should render helper cards');
    assert.ok(html.includes('btn-keyhint'), 'send button should show the Enter key hint');
    assert.ok(html.includes('url-primary-group'), 'url bar should isolate the primary request controls');
    assert.ok(html.includes('url-hero-actions'), 'url bar should elevate the primary action');
    assert.ok(html.includes('url-action-group'), 'url bar should group secondary actions for responsive layouts');
    assert.ok(html.includes('url-secondary-group'), 'url bar should tuck secondary actions into a separate cluster');
    assert.ok(html.includes('res-response-shell'), 'response area should use a dedicated flex shell');
    assert.ok(html.includes('res-empty-shell'), 'response empty states should render inside a scrollable shell');
    assert.ok(html.includes('response-summary-card'), 'response summary should render as a product-style card');
    assert.ok(html.includes('response-stat-grid'), 'response summary should expose response stat cards');
    assert.ok(html.includes('response-action-cluster'), 'response actions should render in a dedicated cluster');
    assert.ok(html.includes('empty-state-head'), 'empty state should render a dedicated hero head');
    assert.ok(html.includes('empty-state-card-index'), 'empty state cards should show playful indices');
    assert.ok(html.includes('divider-grip'), 'split divider should expose an affordance grip');
    assert.match(script, /function getRequestStageInfo\(tab\)/);
    assert.match(script, /function renderEmptyState\(kicker, title, copy, cards, actions, badge\)/);
    assert.match(script, /function renderResponseStat\(label, value, tone, detail\)/);
    assert.match(script, /function buildCompareChipMarkup\(currentSignature\)/);
    assert.match(script, /function scriptTemplateSource\(name\)/);
    assert.match(script, /function insertScriptTemplate\(mc, targetName, templateName\)/);
  });

  it('keeps response panes scrollable and preserves an adaptive response-first split', () => {
    assert.match(script, /function getSplitPanelBounds\(splitEl, dividerEl, progressEl\)/);
    assert.match(script, /function applyManualRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, requestedHeight\)/);
    assert.match(script, /function shouldPreferResponseLayout\(tab\)/);
    assert.match(script, /function applyAdaptiveRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, tab\)/);
    assert.match(script, /var targetRatio = panelSpace < 420 \? 0\.34 : panelSpace < 560 \? 0\.38 : 0\.42;/);
    assert.match(script, /window\.addEventListener\('resize', function\(\) \{/);
    assert.match(script, /var splitEl = mainContent\.querySelector\('\.split'\);/);
    assert.match(script, /applyManualRequestAreaHeight\(\s*reqArea,\s*splitEl,\s*dividerEl,\s*progressEl,/);
    assert.match(script, /applyManualRequestAreaHeight\(\s*splitDragState\.reqArea,\s*splitDragState\.splitEl,/);
    assert.match(script, /if \(reqArea\.dataset\.manualHeight === '1'\) \{/);
    assert.match(script, /var activeTab = tabs\.find\(function\(t\) \{ return t\.id === activeTabId; \}\);/);
    assert.match(script, /applyAdaptiveRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, activeTab\);/);
    assert.match(script, /if \(savedHeight\) \{[\s\S]*?\} else \{[\s\S]*?applyAdaptiveRequestAreaHeight\(\s*adaptiveReqArea,\s*mainContent\.querySelector\('\.split'\),/);
    assert.match(source, /\.res-area\{flex:1 1 0;min-height:0;overflow:auto;display:flex;flex-direction:column;padding:0 10px\}/);
    assert.match(source, /\.res-empty-shell\{flex:1;min-height:0;overflow:auto;padding:8px 0 12px\}/);
    assert.match(source, /\.json-body\{background:var\(--vscode-input-background\);padding:6px;border-radius:3px;font-family:var\(--vscode-editor-font-family,monospace\);font-size:13px;white-space:pre-wrap;word-break:break-all;overflow:auto;flex:1;min-height:0;line-height:1\.45\}/);
    assert.match(source, /\.json-tree\{background:var\(--vscode-input-background\);padding:6px;border-radius:3px;font-family:var\(--vscode-editor-font-family,monospace\);font-size:13px;overflow:auto;flex:1;min-height:0;line-height:1\.6;user-select:text\}/);
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
    assert.match(script, /function switchResponseTabInContent\(mc, tabName\)/);
    assert.match(script, /const tab = tabs\.find\(function\(tt\) \{ return tt\.id === activeTabId; \}\);[\s\S]*tab\.responseTab = tabName;/);
    assert.match(script, /switchResponseTabInContent\(mc, t\.dataset\.tab\);/);
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
    assert.match(script, /function revealDefaultHeadersEditor\(\)/);
    assert.match(script, /function getOverriddenDefaultHeaders\(tab\)/);
    assert.match(script, /function renderDefaultHeaderKeyGroup\(labelKey, headers, chipClass\)/);
    assert.match(script, /js-open-default-headers-top/);
    assert.match(script, /js-default-headers-banner-wrap/);
    assert.match(script, /vscode\.postMessage\(\{ type: 'openDefaultHeaders' \}\)/);
    assert.match(script, /workspaceDefaultHeaders = msg\.headers \|\| \[\];/);
    assert.match(script, /if \(msg\.reveal !== false\)/);
    assert.match(script, /revealDefaultHeadersEditor\(\);/);
    assert.match(script, /tfCount\('webview\.defaultHeadersApplied', applied\.length\)/);
    assert.match(script, /tfCount\('webview\.defaultHeadersOverridden', overridden\.length\)/);
    assert.match(script, /renderDefaultHeaderKeyGroup\('webview\.defaultHeadersAppliedLabel', applied, ''\)/);
    assert.match(script, /renderDefaultHeaderKeyGroup\('webview\.defaultHeadersOverriddenLabel', overridden, ' override'\)/);
  });

  it('renders request-diff, variable usage, form-data, and response quick-copy helpers', () => {
    assert.match(script, /function renderRequestChangeSummary\(tab\)/);
    assert.match(script, /function refreshRequestChangeSummary\(mc\)/);
    assert.match(script, /function renderRequestDirtyTitle\(tab\)/);
    assert.match(script, /function collectVariableUsage\(tab\)/);
    assert.match(script, /function renderVariableUsage\(tab\)/);
    assert.match(script, /function renderFormDataSummary\(fields\)/);
    assert.match(script, /function refreshFormDataSummary\(mc\)/);
    assert.match(script, /js-copy-response-url/);
    assert.match(script, /js-copy-response-status/);
    assert.match(script, /js-copy-response-headers/);
    assert.match(script, /js-empty-action/);
    assert.match(script, /dirty-dot" title="' \+ escapeAttr\(renderRequestDirtyTitle\(tab\)\)/);
    assert.strictEqual(script.includes('requestDiffHtml +'), false, 'request change summary should not reserve its own layout row');
  });

  it('shows the current environment with a localized label instead of raw template syntax', () => {
    assert.match(script, /function renderEnvironmentIndicator\(envName\)/);
    assert.match(script, /function renderToplineStatusChips\(tab\)/);
    assert.match(script, /function refreshToplineStatusChips\(mc\)/);
    assert.match(script, /class="request-status-chips js-topline-status-chips"/);
    assert.match(script, /tr\('webview\.noEnvironment'\)/);
    assert.match(script, /tfCount\('webview\.defaultHeadersStatus', appliedDefaultHeaders\.length\)/);
    assert.match(script, /tr\('webview\.disableScriptsStatus'\)/);
    assert.match(script, /tr\('webview\.followRedirectsStatus'\)/);
    assert.match(script, /tr\('webview\.stopAfterHeadersStatus'\)/);
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
    assert.match(script, /tab\.disableScripts \? 'settings:disable-scripts' : 'scripts:pre-request'/);
  });

  it('persists enriched response search state and supports environment-switch actions', () => {
    assert.match(script, /responseSearchQuery: typeof data\?\.responseSearchQuery === 'string'/);
    assert.match(script, /responseSearchCaseSensitive: data\?\.responseSearchCaseSensitive === true/);
    assert.match(script, /responseSearchRegex: data\?\.responseSearchRegex === true/);
    assert.match(script, /scriptHelpCollapsed: data\?\.scriptHelpCollapsed === true/);
    assert.match(script, /responseSearchQuery: t\.responseSearchQuery \|\| ''/);
    assert.match(script, /responseSearchCaseSensitive: t\.responseSearchCaseSensitive === true/);
    assert.match(script, /responseSearchRegex: t\.responseSearchRegex === true/);
    assert.match(script, /scriptHelpCollapsed: t\.scriptHelpCollapsed === true/);
    assert.match(script, /data-action="switch-environment"/);
    assert.match(script, /type: 'switchEnvironment'/);
  });

  it('reveals linked settings targets from request chips and summaries', () => {
    assert.match(script, /function clearLinkedFocusInContent\(mc\)/);
    assert.match(script, /var linkedFocusFrame = null;/);
    assert.match(script, /function queueLinkedFocusReveal\(callback\)/);
    assert.match(script, /function revealLinkedTargetInContent\(mc, targetKey\)/);
    assert.match(script, /function switchRequestEditorTabAndRevealInContent\(mc, meta\)/);
    assert.match(script, /linked-focus-active/);
    assert.match(script, /settings:save-history/);
    assert.match(script, /settings:skip-default-headers/);
    assert.match(script, /settings:disable-scripts/);
    assert.match(script, /settings:follow-redirects/);
    assert.match(script, /settings:stop-after-headers/);
    assert.match(script, /switchRequestEditorTabAndRevealInContent\(mc, meta\)/);
  });

  it('reveals linked settings targets after the target tab is shown and focuses the mapped control', () => {
    const linkedFocusScript = extractScriptSegment(
      script,
      'function switchRequestEditorTabInContent',
      'function switchResponseTabInContent'
    );
    const animation = createAnimationHarness();
    const harness = createLinkedFocusHarness();
    const linkedFocusContext: Record<string, unknown> = {
      tabs: [{ id: 'tab_1', requestEditorTab: 'params' }],
      activeTabId: 'tab_1',
      normalizeRequestEditorTab: (value: string) => {
        return ['params', 'headers', 'body', 'auth', 'scripts', 'settings'].includes(String(value || ''))
          ? String(value)
          : 'params';
      },
      requestAnimationFrame: animation.requestAnimationFrame,
      cancelAnimationFrame: animation.cancelAnimationFrame,
      setTimeout: animation.setTimeout,
      clearTimeout: animation.clearTimeout,
      refreshDefaultHeadersBanner: () => undefined,
    };

    vm.createContext(linkedFocusContext);
    vm.runInContext(linkedFocusScript, linkedFocusContext);

    const switchRequestEditorTabAndRevealInContent = linkedFocusContext.switchRequestEditorTabAndRevealInContent as (
      mc: FakeRootElement,
      meta: string
    ) => void;
    switchRequestEditorTabAndRevealInContent(harness.mc, 'settings:save-history');

    assert.ok(harness.settingsTabButton.classList.contains('active'), 'settings tab button should become active immediately');
    assert.ok(!harness.settingsPanel.classList.contains('hidden'), 'settings panel should be shown before reveal work runs');
    assert.strictEqual(
      (linkedFocusContext.tabs as Array<{ requestEditorTab: string }>)[0].requestEditorTab,
      'settings',
      'active request editor tab should update before reveal work runs'
    );
    assert.ok(
      !harness.saveHistoryToggle.classList.contains('linked-focus-active'),
      'highlight should wait until the reveal frames run'
    );

    animation.flushFrame();
    assert.ok(
      !harness.saveHistoryToggle.classList.contains('linked-focus-active'),
      'first frame should only queue the reveal'
    );

    animation.flushFrame();
    assert.ok(
      harness.saveHistoryToggle.classList.contains('linked-focus-active'),
      'second frame should apply the highlight once the target is visible'
    );
    assert.strictEqual(harness.saveHistoryToggle.scrollCalls.length, 1, 'target container should scroll into view');
    assert.strictEqual(harness.saveHistoryInput.focusCalls.length, 1, 'target input should receive focus');

    animation.flushTimers();
    assert.ok(
      !harness.saveHistoryToggle.classList.contains('linked-focus-active'),
      'highlight should clear after the reveal timeout'
    );
  });

  it('renders collapsible script helpers with a stepper layout', () => {
    assert.match(script, /function renderScriptHelpStep\(index, titleKey, copyKey\)/);
    assert.match(script, /function renderScriptHelpers\(tab\)/);
    assert.match(script, /class="script-helper-shell/);
    assert.match(script, /class="script-helper-stepper"/);
    assert.match(script, /var helperLeadCopy = collapsed \? tr\('webview\.scriptHelpCollapsedCopy'\) : tr\('webview\.scriptHelpRuntimeWhen'\);/);
    assert.match(script, /\(collapsed\s*\?\s*'<div class="script-helper-collapsed">'/);
    assert.match(script, /class="script-helper-card tinted"/);
    assert.match(script, /class="script-helper-columns flow"/);
    assert.match(script, /tr\('webview\.scriptHelpQuickInsertTitle'\)/);
    assert.match(script, /data-template="testCaptureValue"/);
    assert.match(script, /js-toggle-script-help/);
    assert.match(script, /const activeTab = tabs\.find\(t => t\.id === activeTabId\);/);
    assert.match(script, /activeTab\.scriptHelpCollapsed = activeTab\.scriptHelpCollapsed !== true/);
    assert.match(source, /\.req-area\{flex:1 1 0;min-height:0;overflow-y:auto;padding:4px 10px\}/);
    assert.match(source, /\.url-primary-group\{display:flex;align-items:center;gap:10px;min-width:0\}/);
    assert.match(source, /\.url-action-group\{display:flex;align-items:center;justify-content:flex-end;min-width:0\}/);
    assert.match(source, /\.response-summary-card\{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:12px;border-radius:18px;/);
    assert.match(source, /\.divider-grip\{position:relative;z-index:1;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;/);
    assert.match(source, /\.env-editor\.linked-focus-active\{border-color:rgba\(87,166,255,.26\)\}/);
    assert.match(source, /\.script-helper-shell\.collapsed\{gap:10px\}/);
    assert.match(source, /@media \(max-width: 1220px\)\{/);
    assert.match(source, /@media \(max-height: 820px\)\{/);
  });

  it('shows richer collection runner status updates', () => {
    assert.match(source, /type: 'runCollectionStatus'/);
    assert.match(script, /function updateRunnerStatus\(msg\)/);
    assert.match(script, /class="runner-live-status"/);
    assert.match(script, /tr\('webview\.runSending'\)/);
    assert.match(script, /tr\('webview\.runRetrying'\)/);
  });
});
