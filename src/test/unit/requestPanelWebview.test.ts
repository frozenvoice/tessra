import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const TEST_STRINGS: Record<string, string> = {
  'webview.newTab': 'New tab',
  'webview.requestTabs': 'Request tabs',
  'webview.environment': 'Environment:',
  'webview.environmentNone': 'None',
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
  'webview.profileDefaultTooltip': 'Default profile. Use this for your main Tessra workspace. Create another profile when you want separate collections, history, environments, default headers, and tabs.',
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
  'webview.close': 'Close',
  'webview.remove': 'Remove',
  'webview.more': 'More',
  'webview.send': 'Send',
  'webview.sendAgain': 'Send Again',
  'webview.stop': 'Stop',
  'webview.retry': 'Retry',
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
  'webview.connect': 'Connect',
  'webview.disconnect': 'Disconnect',
  'webview.connected': 'Connected',
  'webview.connecting': 'Connecting...',
  'webview.disconnected': 'Disconnected',
  'webview.sendMessage': 'Send Message',
  'webview.websocket': 'WebSocket',
  'webview.websocketMessages': 'Messages',
  'webview.websocketComposer': 'Use the Body tab as the outgoing WebSocket message composer.',
  'webview.websocketNoMessages': 'No WebSocket messages yet.',
  'webview.websocketMessagePlaceholder': 'Type a message in Body, then press Send Message.',
  'webview.websocketBinaryMessage': 'Binary message ({size} bytes, base64)',
  'webview.websocketClosedByUser': 'Disconnected by user',
  'webview.websocketClosedByRemote': 'Connection closed by remote',
  'webview.websocketClosedUnexpectedly': 'Connection closed unexpectedly',
  'webview.websocketError': 'WebSocket error',
  'webview.webSocketKeepAlive': 'WebSocket keep alive',
  'webview.webSocketKeepAlive.note': 'Send a protocol-level ping while the socket is connected.',
  'webview.webSocketKeepAliveInterval': 'Keep alive interval',
  'webview.webSocketKeepAliveMessage': 'Keep alive message',
  'webview.webSocketKeepAliveIntervalUnit': 'seconds',
  'webview.requestedAt': 'Requested',
  'webview.receivedAt': 'Received',
  'webview.endedAt': 'Ended',
  'webview.empty.hero.title': 'Ready to ship requests',
  'webview.followRedirects': 'Follow redirects',
  'webview.followRedirectsStatus': 'Redirects on',
  'webview.stopAfterHeaders': 'Stop after headers',
  'webview.stopAfterHeadersStatus': 'Headers only',
  'webview.saveToHistory': 'Save to history',
  'webview.skipDefaultHeaders': 'Skip default headers',
  'webview.disableScripts': 'Disable scripts',
  'webview.importedScriptsTrustPrompt': 'Imported scripts are disabled by default for safety.',
  'webview.previewOfflineTitle': 'Offline HTML Preview',
  'webview.previewOfflineCopy': 'This preview stays local. External scripts, styles, images, and other linked assets are blocked, so dynamic pages may only show static HTML.',
  'webview.previewOfflineSource': 'Source URL',
  'webview.previewOfflineDescription': 'Description',
  'webview.previewOfflineBlockedAssets': 'Blocked external assets: {count}',
  'webview.previewOfflineStaticSnapshot': 'Static snapshot',
  'webview.previewOfflineNoStatic': 'No meaningful static body content was detected in this response.',
  'webview.openUrl': 'Open URL',
  'webview.maxSize': 'Max Size (KB)',
  'webview.maxSizeDefault': '0 = default 10240 KB',
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
  'webview.scriptHelpSequenceSend': 'Tessra sends the request with the latest resolved URL, headers, body, and auth.',
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

function readSourceFile(relativePath: string): string {
  const filePath = path.resolve(__dirname, '../../../../', relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

function readRequestPanelSource(): string {
  return readSourceFile('src/panels/RequestPanel.ts');
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
  public readonly attributes: Record<string, string> = {};
  public readonly style: Record<string, string> = {};
  public readonly children: FakeElement[] = [];
  public parent: FakeElement | null = null;
  public focusCalls: unknown[] = [];
  public scrollCalls: unknown[] = [];
  public isConnected = true;
  public offsetHeight = 0;
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
    if (selector.startsWith('.')) {
      return this.collect((node) => node.matches(selector));
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

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
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
    paramsPanel: panels.params,
    headersPanel: panels.headers,
    settingsPanel: panels.settings,
    paramsTabButton: tabButtons.find((button) => button.dataset.tab === 'params')!,
    headersTabButton: tabButtons.find((button) => button.dataset.tab === 'headers')!,
    settingsTabButton: tabButtons.find((button) => button.dataset.tab === 'settings')!,
    saveHistoryToggle,
    saveHistoryInput,
  };
}

describe('RequestPanel Webview', () => {
  let source: string;
  let htmlSource: string;
  let requestExecutorSource: string;
  let collectionRunnerSource: string;
  let requestUtilsSource: string;
  let webSocketManagerSource: string;
  let html: string;
  let script: string;

  before(() => {
    source = readRequestPanelSource();
    htmlSource = readSourceFile('src/panels/requestPanel/requestPanelHtml.ts');
    requestExecutorSource = readSourceFile('src/panels/requestPanel/RequestExecutor.ts');
    collectionRunnerSource = readSourceFile('src/panels/requestPanel/CollectionRunner.ts');
    requestUtilsSource = readSourceFile('src/panels/requestPanel/requestUtils.ts');
    webSocketManagerSource = readSourceFile('src/panels/requestPanel/WebSocketManager.ts');
    html = renderHtml(extractHtmlTemplate(htmlSource));
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

  it('supports WebSocket tabs from the request panel', () => {
    assert.match(script, /function isWebSocketUrl\(url\)/);
    assert.match(script, /function getResolvedUrlForMode\(rawUrl\)/);
    assert.match(script, /function normalizeRequestType\(value, url\)/);
    assert.match(script, /function syncRequestTypeFromUrl\(tab\)/);
    assert.match(script, /syncAllRequestTypesFromUrls\(\);/);
    assert.match(script, /for \(const tab of sorted\) \{[\s\S]*syncRequestTypeFromUrl\(tab\);[\s\S]*const tabMethod = isWebSocketTab\(tab\) \? 'WS' : tab\.method;/);
    assert.match(script, /urlInputEl\.addEventListener\('input', function\(e\) \{[\s\S]*activeTab\.url = e\.target\.value;[\s\S]*syncRequestTypeFromUrl\(activeTab\);/);
    assert.match(script, /function renderWebSocketResponse\(tab\)/);
    assert.match(script, /function formatWebSocketCloseMessage\(msg\)/);
    assert.match(script, /function websocketCloseCodeLabel\(code\)/);
    assert.match(script, /function formatWebSocketErrorMessage\(msg\)/);
    assert.match(script, /function disconnectWebSocketIfOpen\(tab\)/);
    assert.match(script, /disconnectWebSocketIfOpen\(previousTab\);/);
    assert.match(script, /type: 'websocketConnect'/);
    assert.match(script, /type: 'websocketDisconnect'/);
    assert.match(script, /type: 'websocketSend'/);
    assert.match(script, /webSocketKeepAliveEnabled: tab\.webSocketKeepAliveEnabled === true/);
    assert.match(script, /webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval\(tab\.webSocketKeepAliveIntervalSeconds\)/);
    assert.match(script, /webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage\(tab\.webSocketKeepAliveMessage\)/);
    assert.match(script, /if \(msg\.type === 'websocketStatus'\)/);
    assert.match(script, /if \(msg\.type === 'websocketMessage'\)/);
    assert.match(script, /requestType: normalizeRequestType\(t\.requestType, t\.url\)/);
    assert.match(script, /requestType: msg\.requestType/);
    assert.match(htmlSource, /\.ws-console\{display:flex;flex-direction:column;gap:10px;/);
    assert.match(source, /new WebSocketManager\(new WebSocketService\(\)/);
    assert.match(source, /case MessageType\.WebSocketConnect:/);
    assert.match(source, /case MessageType\.WebSocketDisconnect:/);
    assert.match(source, /case MessageType\.WebSocketSend:/);
    assert.match(webSocketManagerSource, /VariableService\.resolve\(message\.url, vars\)/);
    assert.match(webSocketManagerSource, /AuthService\.applyAuth\(auth, finalHeaders, finalParams, vars\)/);
    assert.match(webSocketManagerSource, /manualDisconnectTabs/);
    assert.match(webSocketManagerSource, /closeSource/);
    assert.match(webSocketManagerSource, /User disconnect/);
    assert.match(webSocketManagerSource, /startKeepAlive/);
    assert.match(webSocketManagerSource, /stopKeepAlive/);
    assert.match(webSocketManagerSource, /setInterval/);
    assert.match(webSocketManagerSource, /clearInterval/);
    assert.match(webSocketManagerSource, /MessageType\.WebSocketMessage/);
  });

  it('detects WebSocket tabs from resolved URL variables', () => {
    const modeScript = extractScriptSegment(
      script,
      'function isWebSocketUrl(url)',
      'function normalizeCompareList(value, fallback)'
    );
    const context: {
      activeVarValues: Record<string, string>;
      normalizeRequestType?: (value: string | undefined, url: string) => 'http' | 'websocket';
      syncRequestTypeFromUrl?: (tab: { requestType?: string; url?: string }) => 'http' | 'websocket';
      syncAllRequestTypesFromUrls?: () => void;
      tabs?: Array<{ requestType?: string; url?: string }>;
    } = {
      activeVarValues: {
        wsBaseUrl: 'wss://ws.ifelse.io',
        wsHost: 'wss://ws.ifelse.io',
        nestedWsHost: 'ws.ifelse.io',
        nestedWsBase: 'wss://{{nestedWsHost}}',
        baseUrl: 'https://jsonplaceholder.typicode.com',
      },
      tabs: [],
    };

    vm.createContext(context);
    vm.runInContext(modeScript, context);

    assert.strictEqual(context.normalizeRequestType?.('http', 'wss://ws.ifelse.io'), 'websocket');
    assert.strictEqual(context.normalizeRequestType?.('http', 'ws://localhost:8080/socket'), 'websocket');
    assert.strictEqual(context.normalizeRequestType?.('http', '{{wsBaseUrl}}'), 'websocket');
    assert.strictEqual(context.normalizeRequestType?.('http', '{{wsHost}}/socket'), 'websocket');
    assert.strictEqual(context.normalizeRequestType?.('http', '{{nestedWsBase}}/socket'), 'websocket');
    assert.strictEqual(context.normalizeRequestType?.('websocket', '{{baseUrl}}/users'), 'http');
    assert.strictEqual(context.normalizeRequestType?.('websocket', '{{missingWsUrl}}'), 'http');
    assert.strictEqual(context.normalizeRequestType?.('websocket', 'wss://{{missingWsHost}}/socket'), 'http');

    context.activeVarValues.wsBaseUrl = 'https://jsonplaceholder.typicode.com';
    assert.strictEqual(context.normalizeRequestType?.('websocket', '{{wsBaseUrl}}/users'), 'http');

    const tab = { requestType: 'http', url: 'wss://ws.ifelse.io' };
    assert.strictEqual(context.syncRequestTypeFromUrl?.(tab), 'websocket');
    assert.strictEqual(tab.requestType, 'websocket');

    context.tabs = [{ requestType: 'http', url: '{{wsHost}}' }];
    context.syncAllRequestTypesFromUrls?.();
    assert.strictEqual(context.tabs[0].requestType, 'websocket');

    context.activeVarValues.wsHost = 'https://jsonplaceholder.typicode.com';
    context.syncAllRequestTypesFromUrls?.();
    assert.strictEqual(context.tabs[0].requestType, 'http');
  });

  it('renders the primary button from the resolved WebSocket mode, not the HTTP method', () => {
    const modeScript = extractScriptSegment(
      script,
      'function isWebSocketUrl(url)',
      'function normalizeCompareList(value, fallback)'
    );
    const primaryButtonScript = extractScriptSegment(
      script,
      'function renderPrimaryActionButton(tab)',
      'function buildResponseStatusLine(response)'
    );
    const context: {
      activeVarValues: Record<string, string>;
      renderPrimaryActionButton?: (tab: Record<string, unknown>) => string;
      tr: (key: string) => string;
      escapeHtml: (value: unknown) => string;
      formatDurationMs: (value: unknown) => string;
      getResponseDurationMs: () => number;
    } = {
      activeVarValues: {
        wsBaseUrl: 'wss://ws.ifelse.io',
      },
      tr: (key: string) => TEST_STRINGS[key] ?? key,
      escapeHtml: (value: unknown) => String(value ?? ''),
      formatDurationMs: () => '',
      getResponseDurationMs: () => 0,
    };

    vm.createContext(context);
    vm.runInContext(modeScript + '\n' + primaryButtonScript, context);

    const rawWsButton = context.renderPrimaryActionButton?.({
      method: 'GET',
      requestType: 'http',
      url: 'wss://ws.ifelse.io',
      websocketStatus: 'closed',
    }) ?? '';
    assert.match(rawWsButton, /Connect/);
    assert.match(rawWsButton, /WebSocket/);
    assert.doesNotMatch(rawWsButton, /Send/);

    const resolvedWsButton = context.renderPrimaryActionButton?.({
      method: 'GET',
      requestType: 'http',
      url: '{{wsBaseUrl}}',
      websocketStatus: 'closed',
    }) ?? '';
    assert.match(resolvedWsButton, /Connect/);
    assert.match(resolvedWsButton, /WebSocket/);
    assert.doesNotMatch(resolvedWsButton, /Send/);

    context.activeVarValues.wsBaseUrl = 'https://jsonplaceholder.typicode.com';
    const httpButton = context.renderPrimaryActionButton?.({
      method: 'GET',
      requestType: 'websocket',
      url: '{{wsBaseUrl}}/users',
      websocketStatus: 'closed',
    }) ?? '';
    assert.match(httpButton, /Send/);
    assert.doesNotMatch(httpButton, /WebSocket/);
  });

  it('escapes non-string attribute and HTML values without crashing', () => {
    const escapeScript = extractScriptSegment(
      script,
      'function stringifyForHtml(value)',
      'function checkUnresolvedVars()'
    );
    const context: {
      escapeAttr?: (value: unknown) => string;
      escapeHtml?: (value: unknown) => string;
    } = {};

    vm.createContext(context);
    vm.runInContext(escapeScript, context);

    assert.strictEqual(context.escapeAttr?.(30), '30');
    assert.strictEqual(context.escapeAttr?.(false), 'false');
    assert.strictEqual(context.escapeAttr?.(null), '');
    assert.strictEqual(context.escapeHtml?.(['<tag>', '"quote"']), '[&quot;&lt;tag&gt;&quot;,&quot;\\&quot;quote\\&quot;&quot;]');
    assert.doesNotThrow(() => context.escapeAttr?.({ url: 'wss://ws.ifelse.io', enabled: true }));
    assert.match(context.escapeAttr?.({ url: 'wss://ws.ifelse.io' }) ?? '', /&quot;url&quot;/);
  });

  it('renders WebSocket variable URL content without throwing on settings attributes', () => {
    const modeScript = extractScriptSegment(
      script,
      'function isWebSocketUrl(url)',
      'function normalizeCompareList(value, fallback)'
    );
    const primaryButtonScript = extractScriptSegment(
      script,
      'function renderPrimaryActionButton(tab)',
      'function buildResponseStatusLine(response)'
    );
    const webSocketResponseScript = extractScriptSegment(
      script,
      'function renderWebSocketResponse(tab)',
      'function renderContent()'
    );
    const renderContentScript = extractScriptSegment(
      script,
      'function renderContent()',
      'function bindContentEvents()'
    );
    const settingsNormalizeScript = extractScriptSegment(
      script,
      'function normalizeNumberSetting(value)',
      'function normalizeTlsValidation(value)'
    );
    const escapeScript = extractScriptSegment(
      script,
      'function stringifyForHtml(value)',
      'function checkUnresolvedVars()'
    );
    const mainContent = {
      innerHTML: '',
      querySelector: () => null,
    };
    const context: Record<string, unknown> = {
      DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS: 30,
      MIN_WS_KEEPALIVE_INTERVAL_SECONDS: 5,
      MAX_WS_KEEPALIVE_INTERVAL_SECONDS: 300,
      DEFAULT_WS_KEEPALIVE_MESSAGE: 'ping',
      DEFAULT_MAX_RESPONSE_SIZE_KB: 10240,
      activeVarValues: { wsBaseUrl: 'wss://ws.ifelse.io' },
      activeTabId: 'tab_1',
      tabs: [{
        id: 'tab_1',
        method: 'GET',
        requestType: 'http',
        url: '{{wsBaseUrl}}',
        requestEditorTab: 'settings',
        requestEditorExpanded: true,
        headers: [],
        params: [],
        body: '',
        bodyType: 'raw',
        formData: [],
        binaryFilePath: '',
        auth: { type: 'none' },
        scripts: { preRequest: '', test: '' },
        websocketStatus: 'closed',
        websocketMessages: [],
        webSocketKeepAliveIntervalSeconds: 30,
        webSocketKeepAliveMessage: 'ping',
      }],
      mainContent,
      tr: (key: string) => TEST_STRINGS[key] ?? key,
      tf: (key: string) => TEST_STRINGS[key] ?? key,
      closeActiveFormatMenu: () => undefined,
      releaseSplitDrag: () => undefined,
      hideVariableAutocomplete: () => undefined,
      hideVariablePreviewPopover: () => undefined,
      getRequestStageInfo: () => ({ tone: 'ready', label: TEST_STRINGS['webview.websocket'], detail: '' }),
      normalizeRequestEditorTab: (value: string) => value || 'params',
      renderToplineStatusChips: () => '',
      renderRequestPreflight: () => '',
      renderVariableUsage: () => '',
      websocketStatusLabel: () => TEST_STRINGS['webview.disconnected'],
      formatLocalTime: () => '12:00',
      formatSize: () => '0 B',
      kvRowsHtml: () => '',
      renderDefaultHeadersBanner: () => '',
      authHtml: () => '',
      renderScriptHelpers: () => '',
      bodyTypeLabel: (value: string) => value,
      renderFormDataSummary: () => '',
      formDataRowsHtml: () => '',
      bindContentEvents: () => undefined,
      syncPreviewFrame: () => undefined,
      isRequestEditorCollapsed: () => false,
      applyManualRequestAreaHeight: () => undefined,
      applyAdaptiveRequestAreaHeight: () => undefined,
    };

    vm.createContext(context);
    vm.runInContext(
      modeScript + '\n' + settingsNormalizeScript + '\n' + primaryButtonScript + '\n' + webSocketResponseScript + '\n' + renderContentScript + '\n' + escapeScript,
      context
    );

    assert.doesNotThrow(() => (context.renderContent as () => void)());
    assert.match(mainContent.innerHTML, /method-WS/);
    assert.match(mainContent.innerHTML, /Connect/);
    assert.match(mainContent.innerHTML, /WebSocket/);
    assert.match(mainContent.innerHTML, /js-ws-keepalive-interval[^>]+min="5"[^>]+max="300"[^>]+value="30"/);
  });

  it('formats WebSocket close diagnostics for the message log', () => {
    const closeScript = extractScriptSegment(
      script,
      'function websocketStatusLabel(status)',
      'function websocketConnect(tab)'
    );
    const context: {
      tr: (key: string) => string;
      formatWebSocketCloseMessage?: (message: {
        closeSource?: 'user' | 'remote' | 'unexpected';
        code?: number;
        reason?: string;
        wasClean?: boolean;
      }) => string;
      formatWebSocketErrorMessage?: (message: { error?: string; errorDetail?: string }) => string;
    } = {
      tr: (key: string) => TEST_STRINGS[key] ?? key,
    };

    vm.createContext(context);
    vm.runInContext(closeScript, context);

    assert.strictEqual(
      context.formatWebSocketCloseMessage?.({ closeSource: 'user', code: 1000, reason: 'User disconnect', wasClean: true }),
      'Disconnected by user\ncode: 1000\nreason: User disconnect\nwasClean: true'
    );
    assert.strictEqual(
      context.formatWebSocketCloseMessage?.({ closeSource: 'remote', code: 1000, reason: 'Normal Closure', wasClean: true }),
      'Connection closed by remote\ncode: 1000\nreason: Normal Closure\nwasClean: true'
    );
    assert.strictEqual(
      context.formatWebSocketCloseMessage?.({ closeSource: 'unexpected', code: 1006, reason: 'Abnormal Closure', wasClean: false }),
      'Connection closed unexpectedly\ncode: 1006\nreason: Abnormal Closure\nwasClean: false'
    );
    assert.strictEqual(
      context.formatWebSocketCloseMessage?.({ closeSource: 'remote', code: 1001, reason: '', wasClean: true }),
      'Connection closed by remote\ncode: 1001\nreason: Going Away\nwasClean: true'
    );
    assert.strictEqual(
      context.formatWebSocketErrorMessage?.({ error: 'socket hang up', errorDetail: 'Error: socket hang up\n    at test' }),
      'WebSocket error\nmessage: socket hang up\ndetail: Error: socket hang up\n    at test'
    );
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

  it('keeps Body editor undo and redo available after webview rerenders', () => {
    assert.match(script, /const BODY_UNDO_MAX_ENTRIES = 100;/);
    assert.match(script, /const BODY_UNDO_COALESCE_MS = 700;/);
    assert.match(script, /function resetBodyUndoState\(tab, value, textarea\)/);
    assert.match(script, /function recordBodyEditorInput\(tab, textarea, event\)/);
    assert.match(script, /function handleBodyEditorUndoRedoShortcut\(tab, textarea, event\)/);
    assert.match(script, /if \(isEditableTarget\(e\.target\) && isBodyUndoRedoShortcut\(e\)\) return;/);
    assert.match(script, /resetBodyUndoState\(tab, tab\.body\);/);
    assert.match(script, /resetBodyUndoState\(activeTab, activeTab\.body, textarea\);/);
    assert.match(script, /resetBodyUndoState\(tab, tab\.body\);[\s\S]*renderTabBar\(\);[\s\S]*renderContent\(\);[\s\S]*debouncePersist\(\);/);
    assert.match(script, /recordBodyEditorInput\(bodyTab, bodyTa, event\);/);
    assert.match(script, /if \(handleBodyEditorUndoRedoShortcut\(bodyTab, bodyTa, e\)\) return;/);
    assert.match(script, /bodyTa\._tessraAutoGrow = autoGrow;/);
  });

  it('applies Body editor undo and redo snapshots across a remounted textarea', () => {
    const undoScript = extractScriptSegment(
      script,
      'function isEditableTarget',
      '  function createTab'
    );
    let now = 1000;
    let markDirtyCalls = 0;
    let refreshCalls = 0;
    let persistCalls = 0;
    let autoGrowCalls = 0;
    const context: Record<string, unknown> = {
      BODY_UNDO_MAX_ENTRIES: 100,
      BODY_UNDO_COALESCE_MS: 700,
      bodyUndoApplying: false,
      Date: { now: () => now },
      Math,
      String,
      mainContent: {},
      markDirty: () => { markDirtyCalls += 1; },
      refreshDraftInsights: () => { refreshCalls += 1; },
      debouncePersist: () => { persistCalls += 1; },
    };

    vm.createContext(context);
    vm.runInContext(undoScript, context);

    const tab: { body: string; _bodyUndoState?: { undo: unknown[]; redo: unknown[]; lastValue: string } } = {
      body: '{"name":"before"}',
    };
    const initialTextarea = {
      value: tab.body,
      selectionStart: tab.body.length,
      selectionEnd: tab.body.length,
      _tessraAutoGrow: () => { autoGrowCalls += 1; },
    };

    (context.resetBodyUndoState as (tab: unknown, value: string, textarea: unknown) => void)(tab, tab.body, initialTextarea);
    initialTextarea.value = '{"name":"after"}';
    initialTextarea.selectionStart = initialTextarea.value.length;
    initialTextarea.selectionEnd = initialTextarea.value.length;
    now += 100;
    (context.recordBodyEditorInput as (tab: unknown, textarea: unknown, event: unknown) => void)(
      tab,
      initialTextarea,
      { inputType: 'insertText' }
    );
    tab.body = initialTextarea.value;

    assert.strictEqual(tab._bodyUndoState?.undo.length, 1, 'first edit should store the previous body snapshot');
    assert.strictEqual(tab._bodyUndoState?.lastValue, '{"name":"after"}');

    const remountedTextarea = {
      value: tab.body,
      selectionStart: tab.body.length,
      selectionEnd: tab.body.length,
      _tessraAutoGrow: () => { autoGrowCalls += 1; },
    };
    let prevented = 0;
    let stopped = 0;
    const undoEvent = {
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => { prevented += 1; },
      stopPropagation: () => { stopped += 1; },
    };

    const handledUndo = (context.handleBodyEditorUndoRedoShortcut as (tab: unknown, textarea: unknown, event: unknown) => boolean)(
      tab,
      remountedTextarea,
      undoEvent
    );

    assert.strictEqual(handledUndo, true);
    assert.strictEqual(prevented, 1);
    assert.strictEqual(stopped, 1);
    assert.strictEqual(remountedTextarea.value, '{"name":"before"}');
    assert.strictEqual(tab.body, '{"name":"before"}');
    assert.strictEqual(tab._bodyUndoState?.redo.length, 1, 'undo should preserve the current body for redo');

    const redoEvent = {
      key: 'y',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => { prevented += 1; },
      stopPropagation: () => { stopped += 1; },
    };

    const handledRedo = (context.handleBodyEditorUndoRedoShortcut as (tab: unknown, textarea: unknown, event: unknown) => boolean)(
      tab,
      remountedTextarea,
      redoEvent
    );

    assert.strictEqual(handledRedo, true);
    assert.strictEqual(remountedTextarea.value, '{"name":"after"}');
    assert.strictEqual(tab.body, '{"name":"after"}');
    assert.strictEqual(markDirtyCalls, 2, 'undo and redo should both sync dirty state');
    assert.strictEqual(refreshCalls, 2, 'undo and redo should both refresh body-dependent insights');
    assert.strictEqual(persistCalls, 2, 'undo and redo should both persist tab state');
    assert.strictEqual(autoGrowCalls, 2, 'undo and redo should both refresh textarea sizing');
  });

  it('renders request tabs and utility controls with accessible semantics', () => {
    assert.ok(
      html.includes('<div class="tab-bar" id="tabBar" role="tablist" aria-label="Request tabs">'),
      'request tabs should be exposed as a tablist'
    );
    assert.ok(
      html.includes('<button class="add-tab" id="addTabBtn" type="button" title="New tab" aria-label="New tab">+</button>'),
      'new-tab control should be a named button'
    );
    assert.match(script, /el\.setAttribute\('role', 'tab'\)/);
    assert.match(script, /el\.setAttribute\('tabindex', tab\.id === activeTabId \? '0' : '-1'\)/);
    assert.match(script, /el\.setAttribute\('aria-selected', tab\.id === activeTabId \? 'true' : 'false'\)/);
    assert.match(script, /'<button class="close-tab" type="button" data-id="' \+ tab\.id \+ '" title="' \+ escapeAttr\(tr\('webview\.close'\)\)/);
    assert.match(script, /if \(e\.key === 'Enter' \|\| e\.key === ' '\)/);
    assert.match(script, /class="actions-more-menu js-actions-more-menu" id="responseActionsMoreMenu" role="menu"/);
    assert.match(script, /aria-haspopup="menu" aria-expanded="false" aria-controls="responseActionsMoreMenu"/);
    assert.match(script, /moreBtn\.setAttribute\('aria-expanded', 'true'\)/);
    assert.match(script, /activeFormatMenuState\.button\.setAttribute\('aria-expanded', 'false'\)/);
    assert.match(script, /role="menuitem"/);
    assert.match(script, /class="rm" type="button" title="' \+ escapeAttr\(tr\('webview\.remove'\)\)/);
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
    assert.match(htmlSource, /body\[data-panel-theme="minimal-cool"\] \.tab\.active\{[\s\S]*box-shadow:inset 0 -2px 0 rgba\(125,200,255,.9\);/);
    assert.match(htmlSource, /body\[data-panel-theme="product"\] \.settings-group-title,\s*body\[data-panel-theme="product"\] \.script-helper-label,/);
    assert.match(htmlSource, /body\[data-panel-theme="bold-color"\] \.status-2xx\{[\s\S]*linear-gradient\(135deg,#133a22,#1f7a34\)/);
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
    assert.match(script, /requestEditorExpanded: data\?\.requestEditorExpanded !== false,/);
    assert.match(script, /requestSplitHeightPx: normalizeRequestSplitHeight\(data\?\.requestSplitHeightPx\),/);
    assert.match(script, /requestEditorTab: normalizeRequestEditorTab\(mc\.querySelector\('\.js-req-tabs \.tab\.active'\)\?\.dataset\.tab \|\| tab\.requestEditorTab\),/);
    assert.match(script, /tab\.requestEditorTab = normalizeRequestEditorTab\(mc\.querySelector\('\.js-req-tabs \.tab\.active'\)\?\.dataset\.tab \|\| tab\.requestEditorTab\);/);
    assert.match(script, /activeTab\.requestEditorTab = normalizedTabName;/);
    assert.match(script, /activeTab\.requestEditorExpanded = shouldExpand;/);
    assert.match(script, /const activeRequestEditorTab = normalizeRequestEditorTab\(tab\.requestEditorTab\);/);
    assert.match(script, /const requestEditorExpanded = tab\.requestEditorExpanded !== false;/);
    assert.match(script, /requestEditorTab: normalizeRequestEditorTab\(t\.requestEditorTab\),/);
    assert.match(script, /requestSplitHeightPx: normalizeRequestSplitHeight\(t\.requestSplitHeightPx\) \|\| undefined,/);
    assert.match(script, /<div class="tab' \+ \(isScriptsTab \? ' active' : ''\) \+ \(isScriptsTab && !requestEditorExpanded \? ' collapsed' : ''\) \+ '" data-tab="scripts" role="tab" tabindex="0"/);
    assert.match(script, /<div class="js-scripts-panel request-editor-panel body-section' \+ \(showScriptsEditor \? '' : ' hidden'\) \+ '">/);
  });

  it('toggles the active request editor tab body without adding accordion sections', () => {
    assert.doesNotMatch(script, /renderRequestSection|js-section-toggle|request-section/);
    assert.match(script, /var shouldExpand = options\?\.expand === true/);
    assert.match(script, /x\.classList\.toggle\('collapsed', isActive && !shouldExpand\);/);
    assert.match(script, /mc\.querySelector\(panels\[key\]\)\?\.classList\.toggle\('hidden', !shouldExpand \|\| key !== normalizedTabName\);/);
    assert.match(script, /mc\.querySelector\('\.js-req-tabs'\)\?\.addEventListener\('keydown'/);

    const toggleScript = extractScriptSegment(
      script,
      'function refreshRequestEditorLayout',
      'var linkedFocusTimer'
    );
    const animation = createAnimationHarness();
    const harness = createLinkedFocusHarness();
    harness.paramsPanel.classList.remove('hidden');
    const toggleContext: Record<string, unknown> = {
      tabs: [{ id: 'tab_1', requestEditorTab: 'params', requestEditorExpanded: true }],
      activeTabId: 'tab_1',
      normalizeRequestEditorTab: (value: string) => {
        return ['params', 'headers', 'body', 'auth', 'scripts', 'settings'].includes(String(value || ''))
          ? String(value)
          : 'params';
      },
      requestAnimationFrame: animation.requestAnimationFrame,
      setTimeout: animation.setTimeout,
      refreshDefaultHeadersBanner: () => undefined,
    };

    vm.createContext(toggleContext);
    vm.runInContext(toggleScript, toggleContext);

    const switchRequestEditorTabInContent = toggleContext.switchRequestEditorTabInContent as (
      mc: FakeRootElement,
      tabName: string,
      options?: { expand?: boolean }
    ) => void;
    switchRequestEditorTabInContent(harness.mc, 'params');

    assert.strictEqual(
      (toggleContext.tabs as Array<{ requestEditorExpanded: boolean }>)[0].requestEditorExpanded,
      false,
      'same active tab click should collapse its panel'
    );
    assert.ok(harness.paramsPanel.classList.contains('hidden'), 'active panel should be hidden when collapsed');
    assert.ok(harness.paramsTabButton.classList.contains('active'), 'active tab should stay highlighted while collapsed');
    assert.ok(harness.paramsTabButton.classList.contains('collapsed'), 'collapsed active tab should get a subtle state class');
    assert.strictEqual(harness.paramsTabButton.attributes['aria-expanded'], 'false');

    switchRequestEditorTabInContent(harness.mc, 'params');
    assert.strictEqual(
      (toggleContext.tabs as Array<{ requestEditorExpanded: boolean }>)[0].requestEditorExpanded,
      true,
      'same active tab click should expand the panel again'
    );
    assert.ok(!harness.paramsPanel.classList.contains('hidden'), 'active panel should be shown again');
    assert.strictEqual(harness.paramsTabButton.attributes['aria-expanded'], 'true');

    switchRequestEditorTabInContent(harness.mc, 'headers');
    assert.strictEqual(
      (toggleContext.tabs as Array<{ requestEditorTab: string; requestEditorExpanded: boolean }>)[0].requestEditorTab,
      'headers',
      'different tab click should switch the active request editor tab'
    );
    assert.strictEqual(
      (toggleContext.tabs as Array<{ requestEditorExpanded: boolean }>)[0].requestEditorExpanded,
      true,
      'different tab click should expand the newly active panel'
    );
    assert.ok(harness.paramsPanel.classList.contains('hidden'), 'previous panel should be hidden');
    assert.ok(!harness.headersPanel.classList.contains('hidden'), 'new panel should be shown');
    assert.ok(harness.headersTabButton.classList.contains('active'), 'new tab should be active');
  });

  it('localizes dirty-close prompts and file picker labels', () => {
    assert.match(script, /tr\('webview\.unsavedClosePrompt'\)/);
    assert.match(script, /tf\('webview\.unsavedCloseNamedPrompt', \{ name: tabLabel \}\)/);
    assert.match(script, /tr\('webview\.discard'\)/);
    assert.match(source, /openLabel:\s*LocalizationService\.t\('panel\.selectFile'\)/);
  });

  it('only opens HTTP and HTTPS response URLs externally', () => {
    assert.match(source, /const uri = vscode\.Uri\.parse\(url, true\);/);
    assert.match(source, /uri\.scheme !== 'http' && uri\.scheme !== 'https'/);
    assert.match(source, /panel\.openUrlUnsupportedScheme/);
    assert.match(source, /vscode\.env\.openExternal\(uri\)/);
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
    assert.match(collectionRunnerSource, /private async waitForCollectionRetryDelay\(ms: number, runId: number\): Promise<void>/);
    assert.match(collectionRunnerSource, /this\.currentCollectionDelayCancel = cancel;/);
    assert.match(collectionRunnerSource, /await this\.waitForCollectionRetryDelay\(settings\.retryDelayMs, input\.runId\);/);
    assert.match(collectionRunnerSource, /private isRunStopped\(runId: number\): boolean/);
    assert.match(collectionRunnerSource, /stop\(\): void \{[\s\S]*this\.stoppedRunIds\.add\(this\.activeRunId\);[\s\S]*this\.currentCollectionRequest\?\.abort\(\);[\s\S]*this\.currentCollectionDelayCancel\?\.\(\);[\s\S]*this\.currentCollectionDelayCancel = null;/);
    assert.match(source, /case MessageType\.StopCollectionRun:[\s\S]*this\.collectionRunner\.stop\(\);/);
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

  it('queues outbound webview messages until the webview is ready', () => {
    assert.match(source, /private pendingWebviewMessages: unknown\[\] = \[\];/);
    assert.match(source, /if \(!this\.webviewReady && shouldQueueWebviewMessage\(message\)\) \{/);
    assert.match(source, /this\.pendingWebviewMessages\.push\(message\);/);
    assert.match(source, /private flushPendingWebviewMessages\(\): void \{/);
    assert.match(source, /this\.flushPendingWebviewMessages\(\);/);
  });

  it('uses pre-request method and body type changes for the actual send path', () => {
    assert.match(requestUtilsSource, /export function normalizeMethod\(method: string \| undefined, fallback: Request\['method'\] = 'GET'\): Request\['method'\]/);
    assert.match(requestExecutorSource, /const initialMethod = normalizeMethod\(message\.method\);/);
    assert.match(requestExecutorSource, /const method = normalizeMethod\(requestState\.method, initialMethod\);/);
    assert.match(requestExecutorSource, /requestState\.method = method;/);
    assert.match(requestExecutorSource, /requestState\.bodyType = bodyType;/);
    assert.match(requestExecutorSource, /this\.httpService\.send\(\s*method,\s*url,/);
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
    assert.ok(html.includes('WebSocket keep alive'), 'settings tab should include WebSocket keepalive toggle');
    assert.ok(html.includes('Keep alive interval'), 'settings tab should include WebSocket keepalive interval');
    assert.ok(html.includes('Keep alive message'), 'settings tab should include WebSocket keepalive message');
    assert.match(script, /const MIN_WS_KEEPALIVE_INTERVAL_SECONDS = 5;/);
    assert.match(script, /const MAX_WS_KEEPALIVE_INTERVAL_SECONDS = 300;/);
    assert.match(script, /min="' \+ MIN_WS_KEEPALIVE_INTERVAL_SECONDS \+ '" max="' \+ MAX_WS_KEEPALIVE_INTERVAL_SECONDS/);
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
    assert.ok(html.includes('url-secondary-group'), 'url bar should tuck secondary actions into a separate cluster');
    assert.ok(html.includes('url-secondary-btn'), 'url bar secondary actions should use compact button styling');
    assert.ok(html.includes('action-label'), 'compact action buttons should keep a label span for responsive compression');
    assert.ok(html.includes('res-response-shell'), 'response area should use a dedicated flex shell');
    assert.ok(html.includes('res-empty-shell'), 'response empty states should render inside a scrollable shell');
    assert.ok(html.includes('response-summary-card'), 'response summary should render as a product-style card');
    assert.ok(html.includes('response-stat-inline'), 'response summary should expose inline response stats');
    assert.ok(html.includes('response-action-cluster'), 'response actions should render in a dedicated cluster');
    assert.ok(html.includes('request-info-row'), 'preflight pills and variable usage should share a single row');
    assert.ok(html.includes('actions-more-menu'), 'less-used response actions should collapse into a more menu');
    assert.ok(html.includes('empty-state-head'), 'empty state should render a dedicated hero head');
    assert.ok(html.includes('empty-state-card-index'), 'empty state cards should show playful indices');
    assert.ok(html.includes('divider-grip'), 'split divider should expose an affordance grip');
    assert.match(script, /function getRequestStageInfo\(tab\)/);
    assert.match(script, /function renderEmptyState\(kicker, title, copy, cards, actions, badge\)/);
    assert.match(script, /function renderResponseStat\(label, value, tone, detail\)/);
    assert.match(script, /function buildCompareChipMarkup\(currentSignature\)/);
    assert.match(script, /function scriptTemplateSource\(name\)/);
    assert.match(script, /function insertScriptTemplate\(mc, targetName, templateName\)/);
    assert.match(script, /var secondary = '';/);
    assert.doesNotMatch(script, /var secondary = tr\('webview\.stage\.ready\.detail'\);/);
    assert.match(script, /row\.className = 'runner-row method-' \+ msg\.method \+ ' ' \+ cls;/);
  });

  it('records and renders response timing metadata with readable durations', () => {
    assert.match(script, /function formatLocalTimestamp\(epochMs\)/);
    assert.match(script, /function formatLocalTime\(epochMs\)/);
    assert.match(script, /function formatResponseTimingValue\(epochMs, pairedEpochMs\)/);
    assert.match(script, /function formatDurationMs\(durationMs\)/);
    assert.match(script, /if \(ms < 1000\) return ms \+ ' ms';/);
    assert.match(script, /if \(ms < 60000\) return \(ms \/ 1000\)\.toFixed\(3\) \+ ' s';/);
    assert.match(script, /return minutes \+ 'm ' \+ pad2\(seconds\) \+ '\.' \+ pad3\(milliseconds\) \+ 's';/);
    assert.match(script, /function buildResponseTimingMetaHtml\(tab\)/);
    assert.match(script, /class="response-timing-row"/);
    assert.match(script, /class="timing-flow"/);
    assert.match(script, /class="timing-arrow" aria-hidden="true">→<\/span>/);
    assert.match(script, /tr\('webview\.requestedAt'\)/);
    assert.match(script, /var endedKey = tab\?\.response && tab\?\.lastEvent === 'success' \? 'webview\.receivedAt' : 'webview\.endedAt';/);
    assert.match(script, /titleParts\.push\(tr\('webview\.requestedAt'\) \+ ' ' \+ formatLocalTimestamp\(startedAt\)\);/);
    assert.match(script, /titleParts\.join\(' \/ '\)/);
    assert.match(script, /requestStartedAt: requestStartedAt/);
    assert.match(script, /applyResponseTiming\(tab, msg\);/);
    assert.match(script, /'<span class="stat-time" title="' \+ escapeAttr\(durationTitle\)/);
    assert.match(source, /startedAt:\s*timing\?\.requestStartedAt/);
    assert.match(source, /durationMs:\s*timing\?\.durationMs/);
  });

  it('keeps response panes scrollable and preserves an adaptive response-first split', () => {
    assert.match(script, /function getSplitPanelBounds\(splitEl, dividerEl, progressEl, tab\)/);
    assert.match(script, /function applyManualRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, requestedHeight, tab, rememberManualHeight\)/);
    assert.match(script, /function shouldPreferResponseLayout\(tab\)/);
    assert.match(script, /function applyAdaptiveRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, tab\)/);
    assert.match(script, /function getCollapsedRequestAreaHeight\(splitEl\)/);
    assert.match(script, /function applyStoredRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, tab\)/);
    assert.match(script, /tab\.requestSplitHeightPx = clampedHeight;/);
    assert.match(script, /debouncePersist\(\);/);
    assert.match(script, /requestMinPanel = isRequestEditorCollapsed\(tab\) \? getCollapsedRequestAreaHeight\(splitEl\) : minPanel/);
    assert.match(script, /reqArea\.dataset\.manualHeight === '1' && !isRequestEditorCollapsed\(activeTab\)/);
    assert.match(script, /var targetRatio = panelSpace < 420 \? 0\.34 : panelSpace < 560 \? 0\.38 : 0\.42;/);
    assert.match(script, /window\.addEventListener\('resize', function\(\) \{/);
    assert.match(script, /var splitEl = mainContent\.querySelector\('\.split'\);/);
    assert.match(script, /applyManualRequestAreaHeight\(\s*reqArea,\s*splitEl,\s*dividerEl,\s*progressEl,/);
    assert.match(script, /applyManualRequestAreaHeight\(\s*splitDragState\.reqArea,\s*splitDragState\.splitEl,/);
    assert.match(script, /var activeTab = tabs\.find\(function\(t\) \{ return t\.id === activeTabId; \}\);/);
    assert.match(script, /applyAdaptiveRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, activeTab\);/);
    assert.match(script, /if \(savedHeight && !isRequestEditorCollapsed\(tab\)\) \{[\s\S]*?\} else \{[\s\S]*?applyAdaptiveRequestAreaHeight\(\s*adaptiveReqArea,\s*mainContent\.querySelector\('\.split'\),/);
    assert.match(htmlSource, /\.res-area\{flex:1 1 0;min-height:0;overflow:auto;display:flex;flex-direction:column;padding:0 10px\}/);
    assert.match(htmlSource, /\.res-empty-shell\{flex:1;min-height:0;overflow:auto;padding:8px 0 12px\}/);
    assert.match(htmlSource, /\.var-usage\{display:flex;align-items:center;gap:6px;padding:0;flex-wrap:wrap\}/);
    assert.match(htmlSource, /\.json-body\{background:linear-gradient\(180deg,rgba\(255,255,255,.05\),rgba\(255,255,255,.018\)\);padding:14px 16px;border-radius:18px;border:1px solid rgba\(255,255,255,.08\);font-family:var\(--vscode-editor-font-family,monospace\);font-size:13px;white-space:pre-wrap;word-break:break-word;overflow:auto;flex:1;min-height:0;line-height:1\.3;/);
    assert.match(htmlSource, /\.json-tree\{background:linear-gradient\(180deg,rgba\(255,255,255,.05\),rgba\(255,255,255,.018\)\);padding:14px 16px;border-radius:18px;border:1px solid rgba\(255,255,255,.08\);font-family:var\(--vscode-editor-font-family,monospace\);font-size:13px;overflow:auto;flex:1;min-height:0;line-height:1\.3;user-select:text;/);
  });

  it('allows a much smaller request split minimum while the active editor tab is collapsed', () => {
    const splitScript = extractScriptSegment(
      script,
      'function isRequestEditorCollapsed',
      'document.addEventListener'
    );
    const splitContext: Record<string, unknown> = {};
    vm.createContext(splitContext);
    vm.runInContext(splitScript, splitContext);

    const getSplitPanelBounds = splitContext.getSplitPanelBounds as (
      splitEl: FakeElement,
      dividerEl: FakeElement,
      progressEl: FakeElement,
      tab?: { requestEditorExpanded?: boolean }
    ) => { minReq: number; maxReq: number };
    const applyManualRequestAreaHeight = splitContext.applyManualRequestAreaHeight as (
      reqArea: FakeElement,
      splitEl: FakeElement,
      dividerEl: FakeElement,
      progressEl: FakeElement,
      requestedHeight: number,
      tab?: { requestEditorExpanded?: boolean; requestSplitHeightPx?: number },
      rememberManualHeight?: boolean
    ) => void;
    const applyAdaptiveRequestAreaHeight = splitContext.applyAdaptiveRequestAreaHeight as (
      reqArea: FakeElement,
      splitEl: FakeElement,
      dividerEl: FakeElement,
      progressEl: FakeElement,
      tab?: { response?: unknown; requestEditorExpanded?: boolean; requestSplitHeightPx?: number }
    ) => void;

    const splitEl = new FakeElement('div', ['split']);
    splitEl.offsetHeight = 600;
    const reqArea = splitEl.append(new FakeElement('div', ['req-area']));
    const tabsEl = reqArea.append(new FakeElement('div', ['js-req-tabs']));
    tabsEl.offsetHeight = 28;
    const dividerEl = new FakeElement('div', ['divider']);
    dividerEl.offsetHeight = 10;
    const progressEl = new FakeElement('div', ['bullet-progress']);
    progressEl.offsetHeight = 0;

    const expandedBounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, { requestEditorExpanded: true });
    const collapsedBounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, { requestEditorExpanded: false });

    assert.ok(expandedBounds.minReq >= 120, 'expanded request pane keeps the regular editing minimum');
    assert.ok(collapsedBounds.minReq <= 50, 'collapsed request pane minimum should be close to the tab bar height');
    assert.ok(collapsedBounds.maxReq === expandedBounds.maxReq, 'response pane minimum should stay protected');

    const tab = { response: {}, requestEditorExpanded: true, requestSplitHeightPx: undefined as number | undefined };
    applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, 260, tab);
    assert.strictEqual(tab.requestSplitHeightPx, 260, 'manual divider drag should store the expanded split height');
    assert.strictEqual(reqArea.style.height, '260px');

    tab.requestEditorExpanded = false;
    applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab);
    assert.strictEqual(tab.requestSplitHeightPx, 260, 'collapse should not discard the stored expanded split height');
    assert.strictEqual(reqArea.style.height, '44px', 'collapsed request pane should shrink to the tab row height');
    assert.strictEqual(reqArea.dataset.manualHeight, undefined);

    tab.requestEditorExpanded = true;
    applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab);
    assert.strictEqual(reqArea.style.height, '260px', 'expand should restore the stored manual split height');
    assert.strictEqual(tab.requestSplitHeightPx, 260, 'restoring should not rewrite the saved manual preference');
  });

  it('normalizes and persists request settings in tab state and save actions', () => {
    assert.match(script, /function getRequestSettings\(data\)/);
    assert.match(script, /function requestSettingsSnapshot\(tab\)/);
    assert.match(script, /followRedirects:\s*data\?\.followRedirects === true/);
    assert.match(script, /saveToHistory:\s*data\?\.saveToHistory !== false/);
    assert.match(script, /tlsValidation:\s*normalizeTlsValidation\(data\?\.tlsValidation\)/);
    assert.match(script, /maxResponseSizeKb:\s*normalizeMaxResponseSizeSetting\(data\?\.maxResponseSizeKb\)/);
    assert.match(script, /retryCount:\s*normalizeNumberSetting\(data\?\.retryCount\)/);
    assert.match(script, /retryDelayMs:\s*normalizeNumberSetting\(data\?\.retryDelayMs\)/);
    assert.match(script, /stopAfterHeaders:\s*data\?\.stopAfterHeaders === true/);
    assert.match(script, /skipDefaultHeaders:\s*data\?\.skipDefaultHeaders === true/);
    assert.match(script, /disableScripts:\s*data\?\.disableScripts === true/);
    assert.match(script, /scriptsTrusted:\s*data\?\.scriptsTrusted !== false/);
    assert.match(script, /webSocketKeepAliveEnabled:\s*data\?\.webSocketKeepAliveEnabled === true/);
    assert.match(script, /webSocketKeepAliveIntervalSeconds:\s*normalizeWebSocketKeepAliveInterval\(data\?\.webSocketKeepAliveIntervalSeconds\)/);
    assert.match(script, /webSocketKeepAliveMessage:\s*normalizeWebSocketKeepAliveMessage\(data\?\.webSocketKeepAliveMessage\)/);
    assert.match(script, /buildSaveRequestMessage\(tab/);
    assert.match(script, /followRedirects:\s*!!tab\.followRedirects/);
    assert.match(script, /saveToHistory:\s*tab\.saveToHistory !== false/);
    assert.match(script, /scriptsTrusted:\s*tab\.scriptsTrusted !== false/);
    assert.match(script, /webSocketKeepAliveEnabled:\s*tab\.webSocketKeepAliveEnabled === true/);
  });

  it('requires explicit trust before running imported scripts from the webview', () => {
    assert.match(script, /function hasExecutableScripts\(scripts\)/);
    assert.match(script, /function ensureTrustedScriptsBeforeSend\(tab\)/);
    assert.match(script, /tab\.scriptsTrusted !== false/);
    assert.match(script, /window\.confirm\(tr\('webview\.importedScriptsTrustPrompt'\)\)/);
    assert.match(script, /tab\.scriptsTrusted = true;/);
    assert.match(script, /if \(!ensureTrustedScriptsBeforeSend\(tab\)\) return;/);
    assert.match(script, /scriptsTrusted: tab\.scriptsTrusted !== false/);
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
    assert.match(script, /<span class="var-usage-name">\{\{/);
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

  it('renders the environment editor as a collapsed summary with accessible toggle handling', () => {
    assert.match(html, /<div id="envEditor" class="env-editor collapsed">/);
    assert.match(html, /id="envEditorToggle" role="button" tabindex="0" aria-expanded="false" aria-controls="envEditorBody"/);
    assert.match(html, /class="env-editor-caret" aria-hidden="true"/);
    assert.match(html, /id="envEditorName">None<\/span>/);
    assert.match(html, /id="envEditorVarCount"/);
    assert.match(html, /id="envEditorBody"/);
    assert.match(script, /function toggleEnvironmentEditor\(\)/);
    assert.match(script, /envEditorToggle\?\.addEventListener\('keydown'/);
    assert.match(script, /setEnvironmentEditorData\(msg\.envId \|\| null, msg\.envName \|\| null, msg\.variables \|\| \[\]\)/);
    assert.match(source, /variables,\s*profileName: RequestPanel\.storage\.getWorkspaceProfileName\(\)/);
    assert.ok(
      script.indexOf('const envEditorName = document.getElementById') < script.lastIndexOf('updateStaticLocalizedText();'),
      'initial localized text refresh should run after environment editor elements are bound'
    );
  });

  it('uses the 500 item history retention fallback for status messages', () => {
    assert.match(source, /getConfiguration\('tessra'\)\.get<number>\('historyMaxItems', 500\)/);
    assert.match(source, /History: \$\{removed\} old items removed \(max \$\{maxItems\}\)/);
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
      'function refreshRequestEditorLayout',
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
    assert.match(htmlSource, /\.req-area\{flex:1 1 0;min-height:0;overflow:hidden;padding:2px 8px;display:flex;flex-direction:column\}/);
    assert.match(htmlSource, /\.url-primary-group\{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto\}/);
    assert.match(htmlSource, /\.url-hero-actions\{display:flex;align-items:stretch;justify-content:flex-end;flex:0 0 auto\}/);
    assert.match(htmlSource, /\.url-secondary-btn\{min-height:28px;padding:0 8px;border-radius:6px;gap:6px;font-size:13px;/);
    assert.match(htmlSource, /\.response-summary-card\{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:2px 0;border:none;background:transparent;box-shadow:none;border-radius:0;flex-wrap:nowrap;min-width:0\}/);
    assert.match(htmlSource, /\.response-stat-inline\{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;font-size:13px;font-weight:700;/);
    assert.match(htmlSource, /\.response-action-cluster\{display:flex;align-items:center;justify-content:flex-end;gap:3px;flex-wrap:nowrap;flex:0 0 auto\}/);
    assert.match(htmlSource, /\.actions-more-menu\{display:none;position:absolute;/);
    assert.match(htmlSource, /\.divider-grip\{position:relative;z-index:1;display:inline-flex;align-items:center;gap:4px;padding:1px 8px;/);
    assert.match(htmlSource, /\.json-body\{background:linear-gradient\(180deg,rgba\(255,255,255,.05\),rgba\(255,255,255,.018\)\);padding:14px 16px;border-radius:18px;/);
    assert.match(htmlSource, /\.runner-row\.method-GET::before\{background:linear-gradient\(180deg,rgba\(78,201,78,.8\),rgba\(78,201,78,.18\)\)\}/);
    assert.match(htmlSource, /\.env-editor\.linked-focus-active\{border-color:rgba\(87,166,255,.26\)\}/);
    assert.match(htmlSource, /\.script-helper-shell\.collapsed\{gap:10px\}/);
    assert.match(htmlSource, /@media \(max-height: 820px\)\{/);
  });

  it('shows richer collection runner status updates', () => {
    assert.match(collectionRunnerSource, /type: 'runCollectionStatus'/);
    assert.match(script, /function updateRunnerStatus\(msg\)/);
    assert.match(script, /class="runner-live-status"/);
    assert.match(script, /tr\('webview\.runSending'\)/);
    assert.match(script, /tr\('webview\.runRetrying'\)/);
    assert.match(script, /tr\('webview\.runWaiting'\)/);
    assert.match(script, /tf\('webview\.runIterationStatus'/);
  });

  it('persists collection runner results to history when enabled', () => {
    assert.match(collectionRunnerSource, /let historyRequest: Request \| null = null;/);
    assert.match(collectionRunnerSource, /historyRequest = createHistoryRequestSnapshot\(/);
    assert.match(collectionRunnerSource, /if \(!this\.isRunStopped\(input\.runId\) && settings\.saveToHistory && historyRequest\) \{/);
    assert.match(collectionRunnerSource, /response \? \{ status: response\.status, statusText: response\.statusText, time: response\.time \} : null/);
  });

  it('renders collection runner options before starting a run', () => {
    assert.match(source, /private pendingCollectionRun: \{ name: string; items: CollectionItem\[\] \} \| null = null;/);
    assert.match(source, /type: MessageType\.ConfigureCollectionRun/);
    assert.match(source, /case MessageType\.StartCollectionRun:/);
    assert.match(script, /function showRunnerSetup\(msg\)/);
    assert.match(script, /type: 'startCollectionRun'/);
    assert.match(script, /tr\('webview\.runDelayMs'\)/);
    assert.match(script, /tr\('webview\.runIterations'\)/);
    assert.match(script, /tr\('webview\.runStopOnFailure'\)/);
  });
});
