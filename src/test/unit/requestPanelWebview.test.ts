import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const TEST_STRINGS: Record<string, string> = {
  'webview.newTab': 'New tab',
  'webview.requestTabs': 'Request tabs',
  'webview.responseTabs': 'Response tabs',
  'webview.tabActions': 'Tab actions',
  'webview.environment': 'Environment:',
  'webview.environmentNone': 'None',
  'webview.unsavedChanges': 'Unsaved changes',
  'webview.autoSaved': 'Auto-saved',
  'webview.addVariable': '+ Add Variable',
  'webview.defaultHeaders': 'Default headers',
  'webview.editEnvironmentVariables': 'Edit variables',
  'webview.emptyActionGuide': 'Open Guide',
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
  'webview.followRedirectsStatus': 'Redirects',
  'webview.stopAfterHeaders': 'Stop after headers',
  'webview.stopAfterHeadersStatus': 'Headers only',
  'webview.saveToHistory': 'Save to history',
  'webview.saveToHistoryOnStatus': 'History on',
  'webview.saveToHistoryOffStatus': 'History off',
  'webview.skipDefaultHeaders': 'Skip default headers',
  'webview.skipDefaultHeadersStatus': 'Defaults skipped',
  'webview.disableScripts': 'Disable scripts',
  'webview.disableScriptsStatus': 'Scripts off',
  'webview.scriptsPresentStatus': 'Scripts',
  'webview.stripScriptsCount': 'Scripts {count}',
  'webview.stripDefaultsCount': 'Defaults {count}',
  'webview.stripVarsCount': 'Vars {count}',
  'webview.stripUsedCount': 'Used {count}',
  'webview.tlsInsecureStatus': 'TLS insecure',
  'webview.defaultHeadersStatus': 'Default headers: {count}',
  'webview.noEnvironment': 'No environment',
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
  'webview.metadata': 'Metadata',
  'webview.compareNeedsPin': 'Pin a response first',
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
  'webview.scriptHelpOneLiner': 'Environment → Pre-request → Send → Tests',
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
  'webview.variablePreviewSourceRequest': 'Request',
  'webview.variablePreviewSourceEnvironment': 'Environment',
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

function extractTaggedTemplate(source: string, tagComment: '/*css*/' | '/*html*/' | '/*js*/'): string {
  const startMarker = `return ${tagComment} \``;
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `webview template start marker should exist: ${tagComment}`);
  const contentStart = start + startMarker.length;
  const end = source.indexOf('`;', contentStart);
  assert.ok(end > contentStart, `webview template end marker should exist: ${tagComment}`);
  return source.slice(contentStart, end);
}

function extractNthTaggedTemplate(source: string, tagComment: '/*css*/' | '/*html*/' | '/*js*/', index: number): string {
  const startMarker = `return ${tagComment} \``;
  let from = 0;
  let start = -1;
  for (let i = 0; i <= index; i++) {
    start = source.indexOf(startMarker, from);
    assert.ok(start >= 0, `webview template #${i} start marker should exist: ${tagComment}`);
    from = start + startMarker.length;
  }
  const end = source.indexOf('`;', from);
  assert.ok(end > from, `webview template #${index} end marker should exist: ${tagComment}`);
  return source.slice(from, end);
}

/** Expand Body/Response/Runner/Environment/Default Headers/Status/WebSocket/Auth/Scripts/Settings/PathVariables fragment composition without interpreting other ${...} interpolations. */
function expandClientScriptTemplate(
  clientScript: string,
  bodyClientScript: string,
  responseClientScript: string,
  runnerClientScript: string,
  environmentClientScript: string,
  environmentBindingsScript: string,
  defaultHeadersClientScript: string,
  defaultHeadersBindingsScript: string,
  statusClientScript: string,
  webSocketClientScript: string,
  authClientScript: string,
  scriptsClientScript: string,
  settingsClientScript: string,
  pathVariablesClientScript: string
): string {
  const bodyMarker = '${getRequestPanelBodyClientScript()}';
  const responseMarker = '${getRequestPanelResponseClientScript()}';
  const runnerMarker = '${getRequestPanelRunnerClientScript()}';
  const environmentMarker = '${getRequestPanelEnvironmentClientScript()}';
  const environmentBindingsMarker = '${getRequestPanelEnvironmentBindingsScript()}';
  const defaultHeadersMarker = '${getRequestPanelDefaultHeadersClientScript()}';
  const defaultHeadersBindingsMarker = '${getRequestPanelDefaultHeadersBindingsScript()}';
  const statusMarker = '${getRequestPanelStatusClientScript()}';
  const webSocketMarker = '${getRequestPanelWebSocketClientScript()}';
  const authMarker = '${getRequestPanelAuthClientScript()}';
  const scriptsMarker = '${getRequestPanelScriptsClientScript()}';
  const settingsMarker = '${getRequestPanelSettingsClientScript()}';
  const pathVariablesMarker = '${getRequestPanelPathVariablesClientScript()}';
  assert.ok(
    clientScript.includes(bodyMarker),
    'requestPanelClientScript should compose getRequestPanelBodyClientScript()'
  );
  assert.ok(
    clientScript.includes(responseMarker),
    'requestPanelClientScript should compose getRequestPanelResponseClientScript()'
  );
  assert.ok(
    clientScript.includes(runnerMarker),
    'requestPanelClientScript should compose getRequestPanelRunnerClientScript()'
  );
  assert.ok(
    clientScript.includes(environmentMarker),
    'requestPanelClientScript should compose getRequestPanelEnvironmentClientScript()'
  );
  assert.ok(
    clientScript.includes(environmentBindingsMarker),
    'requestPanelClientScript should compose getRequestPanelEnvironmentBindingsScript()'
  );
  assert.ok(
    clientScript.includes(defaultHeadersMarker),
    'requestPanelClientScript should compose getRequestPanelDefaultHeadersClientScript()'
  );
  assert.ok(
    clientScript.includes(defaultHeadersBindingsMarker),
    'requestPanelClientScript should compose getRequestPanelDefaultHeadersBindingsScript()'
  );
  assert.ok(
    clientScript.includes(statusMarker),
    'requestPanelClientScript should compose getRequestPanelStatusClientScript()'
  );
  assert.ok(
    clientScript.includes(webSocketMarker),
    'requestPanelClientScript should compose getRequestPanelWebSocketClientScript()'
  );
  assert.ok(
    clientScript.includes(authMarker),
    'requestPanelClientScript should compose getRequestPanelAuthClientScript()'
  );
  assert.ok(
    clientScript.includes(scriptsMarker),
    'requestPanelClientScript should compose getRequestPanelScriptsClientScript()'
  );
  assert.ok(
    clientScript.includes(settingsMarker),
    'requestPanelClientScript should compose getRequestPanelSettingsClientScript()'
  );
  assert.ok(
    clientScript.includes(pathVariablesMarker),
    'requestPanelClientScript should compose getRequestPanelPathVariablesClientScript()'
  );
  return clientScript
    .split(bodyMarker).join(bodyClientScript)
    .split(responseMarker).join(responseClientScript)
    .split(runnerMarker).join(runnerClientScript)
    .split(environmentMarker).join(environmentClientScript)
    .split(environmentBindingsMarker).join(environmentBindingsScript)
    .split(defaultHeadersMarker).join(defaultHeadersClientScript)
    .split(defaultHeadersBindingsMarker).join(defaultHeadersBindingsScript)
    .split(statusMarker).join(statusClientScript)
    .split(webSocketMarker).join(webSocketClientScript)
    .split(authMarker).join(authClientScript)
    .split(scriptsMarker).join(scriptsClientScript)
    .split(settingsMarker).join(settingsClientScript)
    .split(pathVariablesMarker).join(pathVariablesClientScript);
}

/** Compose styles/markup/clientScript the same way requestPanelHtml.ts assembles the shell. */
function extractHtmlTemplate(): string {
  const styles = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelStyles.ts'),
    '/*css*/'
  );
  const markup = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelMarkup.ts'),
    '/*html*/'
  );
  const bodyClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelBodyClientScript.ts'),
    '/*js*/'
  );
  const responseClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelResponseClientScript.ts'),
    '/*js*/'
  );
  const runnerClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelRunnerClientScript.ts'),
    '/*js*/'
  );
  const environmentClientScript = extractNthTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelEnvironmentClientScript.ts'),
    '/*js*/',
    0
  );
  const environmentBindingsScript = extractNthTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelEnvironmentClientScript.ts'),
    '/*js*/',
    1
  );
  const defaultHeadersClientScript = extractNthTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelDefaultHeadersClientScript.ts'),
    '/*js*/',
    0
  );
  const defaultHeadersBindingsScript = extractNthTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelDefaultHeadersClientScript.ts'),
    '/*js*/',
    1
  );
  const statusClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelStatusClientScript.ts'),
    '/*js*/'
  );
  const webSocketClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelWebSocketClientScript.ts'),
    '/*js*/'
  );
  const authClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelAuthClientScript.ts'),
    '/*js*/'
  );
  const scriptsClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelScriptsClientScript.ts'),
    '/*js*/'
  );
  const settingsClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelSettingsClientScript.ts'),
    '/*js*/'
  );
  const pathVariablesClientScript = extractTaggedTemplate(
    readSourceFile('src/panels/requestPanel/requestPanelPathVariablesClientScript.ts'),
    '/*js*/'
  );
  const clientScript = expandClientScriptTemplate(
    extractTaggedTemplate(
      readSourceFile('src/panels/requestPanel/requestPanelClientScript.ts'),
      '/*js*/'
    ),
    bodyClientScript,
    responseClientScript,
    runnerClientScript,
    environmentClientScript,
    environmentBindingsScript,
    defaultHeadersClientScript,
    defaultHeadersBindingsScript,
    statusClientScript,
    webSocketClientScript,
    authClientScript,
    scriptsClientScript,
    settingsClientScript,
    pathVariablesClientScript
  );

  // Concatenation keeps ${...} inside markup/script as literals for renderHtml().
  return [
    '<!DOCTYPE html>\n',
    '<html lang="${displayLanguage}">\n',
    '<head>\n',
    '<meta charset="UTF-8"/>\n',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n',
    '<meta http-equiv="Content-Security-Policy" content="${csp}"/>\n',
    '<title>Tessra</title>\n',
    '<style nonce="${nonce}">\n',
    styles,
    '\n</style>\n',
    '</head>\n',
    '<body data-panel-theme="${requestPanelTheme}">\n',
    markup,
    '\n\n<script nonce="${nonce}">\n',
    clientScript,
    '\n</script>\n',
    '<script nonce="${nonce}" src="${bodyConversionUri}"></script>\n',
    '<script nonce="${nonce}" src="${hljsUri}"></script>\n',
    '</body>\n',
    '</html>',
  ].join('');
}

function readRequestPanelHtmlSources(): string {
  return [
    'src/panels/requestPanel/requestPanelHtml.ts',
    'src/panels/requestPanel/requestPanelStyles.ts',
    'src/panels/requestPanel/requestPanelMarkup.ts',
    'src/panels/requestPanel/requestPanelClientScript.ts',
    'src/panels/requestPanel/requestPanelBodyClientScript.ts',
    'src/panels/requestPanel/requestPanelResponseClientScript.ts',
    'src/panels/requestPanel/requestPanelRunnerClientScript.ts',
    'src/panels/requestPanel/requestPanelEnvironmentClientScript.ts',
    'src/panels/requestPanel/requestPanelDefaultHeadersClientScript.ts',
    'src/panels/requestPanel/requestPanelStatusClientScript.ts',
    'src/panels/requestPanel/requestPanelWebSocketClientScript.ts',
    'src/panels/requestPanel/requestPanelAuthClientScript.ts',
    'src/panels/requestPanel/requestPanelScriptsClientScript.ts',
    'src/panels/requestPanel/requestPanelSettingsClientScript.ts',
  ]
    .map((relativePath) => readSourceFile(relativePath))
    .join('\n');
}

function renderHtml(template: string): string {
  const factory = new Function(
    'csp',
    'nonce',
    'hljsUri',
    'bodyConversionUri',
    'displayLanguage',
    'requestPanelTheme',
    'sessionId',
    'profileName',
    'localizedStrings',
    'dateLocale',
    'LocalizationService',
    `return \`${template.replace(/`/g, '\\`')}\`;`
  ) as (
    csp: string,
    nonce: string,
    hljsUri: string,
    bodyConversionUri: string,
    displayLanguage: string,
    requestPanelTheme: string,
    sessionId: string,
    profileName: string,
    localizedStrings: string,
    dateLocale: string,
    localizationService: { t: (key: string) => string }
  ) => string;

  return factory(
    'default-src none',
    'test-nonce',
    'hljs.js',
    'bodyConversion.js',
    'en',
    'default',
    'test-session',
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
    htmlSource = readRequestPanelHtmlSources();
    requestExecutorSource = readSourceFile('src/panels/requestPanel/RequestExecutor.ts');
    collectionRunnerSource = readSourceFile('src/panels/requestPanel/CollectionRunner.ts');
    requestUtilsSource = readSourceFile('src/panels/requestPanel/requestUtils.ts');
    webSocketManagerSource = readSourceFile('src/panels/requestPanel/WebSocketManager.ts');
    html = renderHtml(extractHtmlTemplate());
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
    assert.match(htmlSource, /\.ws-console\{display:flex;flex-direction:column;gap:8px;/);
    assert.match(htmlSource, /\.ws-summary\{[^}]*border-radius:0;background:transparent/);
    assert.match(htmlSource, /\.ws-status-dot\{[^}]*box-shadow:none/);
    assert.doesNotMatch(htmlSource, /\.ws-status-label\{[^}]*text-transform:uppercase/);
    assert.match(source, /new WebSocketManager\(new WebSocketService\(\)/);
    assert.match(source, /case MessageType\.WebSocketConnect:/);
    assert.match(source, /case MessageType\.WebSocketDisconnect:/);
    assert.match(source, /case MessageType\.WebSocketSend:/);
    assert.match(webSocketManagerSource, /PathVariableService\.resolveUrl\(message\.url, pathVariableOverrides, vars\)/);
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
      'function normalizeBodyType(bodyType)'
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
      'function normalizeBodyType(bodyType)'
    );
    const primaryButtonScript = extractScriptSegment(
      script,
      'function renderPrimaryActionButton(tab)',
      'function buildSampleRequestData()'
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
      'function normalizeBodyType(bodyType)'
    );
    const primaryButtonScript = extractScriptSegment(
      script,
      'function renderPrimaryActionButton(tab)',
      'function buildSampleRequestData()'
    );
    const webSocketResponseScript = extractScriptSegment(
      script,
      'function renderWebSocketResponse(tab)',
      'function handleWebSocketStatusMessage(msg)'
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
    const settingsRenderScript = extractScriptSegment(
      script,
      'function renderSettingsEditorContents(tab, isWs)',
      'function bindRequestSettingsEditor(mc)'
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
      renderStatusStrip: () => '<div class="status-strip js-status-strip"></div>',
      renderRequestPreflight: () => '',
      renderVariableUsage: () => '',
      websocketStatusLabel: () => TEST_STRINGS['webview.disconnected'],
      formatLocalTime: () => '12:00',
      formatSize: () => '0 B',
      kvRowsHtml: () => '',
      renderDefaultHeadersBanner: () => '',
      authHtml: () => '',
      renderScriptsEditorContents: () => '',
      bodyTypeLabel: (value: string) => value,
      renderFormDataSummary: () => '',
      formDataRowsHtml: () => '',
      shouldEnableBodySyntaxHighlight: (bodyType: string, isWebSocket: boolean) => !isWebSocket && (bodyType === 'json' || bodyType === 'xml'),
      shouldEnableBodyJsonHighlight: (bodyType: string, isWebSocket: boolean) => !isWebSocket && (bodyType === 'json' || bodyType === 'xml'),
      bindContentEvents: () => undefined,
      syncPreviewFrame: () => undefined,
      isRequestEditorCollapsed: () => false,
      applyManualRequestAreaHeight: () => undefined,
      applyAdaptiveRequestAreaHeight: () => undefined,
    };

    vm.createContext(context);
    vm.runInContext(
      modeScript + '\n' + settingsNormalizeScript + '\n' + settingsRenderScript + '\n' + primaryButtonScript + '\n' + webSocketResponseScript + '\n' + renderContentScript + '\n' + escapeScript,
      context
    );

    assert.doesNotThrow(() => (context.renderContent as () => void)());
    assert.match(mainContent.innerHTML, /method-WS/);
    assert.match(mainContent.innerHTML, /Connect/);
    assert.match(mainContent.innerHTML, /WebSocket/);
    assert.match(mainContent.innerHTML, /js-ws-keepalive-interval[^>]+min="5"[^>]+max="300"[^>]+value="30"/);
    assert.match(mainContent.innerHTML, /js-body-editor/);
    assert.doesNotMatch(mainContent.innerHTML, /is-syntax-highlight|is-json-highlight/, 'WebSocket Body composer must not enable syntax overlay');
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
    assert.match(script, /function captureBodyConversionUndoSnapshot\(tab, textarea\)/);
    assert.match(script, /if \(isEditableTarget\(e\.target\) && isBodyUndoRedoShortcut\(e\)\) return;/);
    assert.match(script, /resetBodyUndoState\(tab, tab\.body\);/);
    assert.match(script, /resetBodyUndoState\(tab, tab\.body \|\| '', textarea\);/);
    assert.match(script, /resetBodyUndoState\(tab, tab\.body\);[\s\S]*renderTabBar\(\);[\s\S]*renderContent\(\);[\s\S]*debouncePersist\(\);/);
    assert.match(script, /recordBodyEditorInput\(bodyTab, bodyTa, event\);/);
    assert.match(script, /if \(handleBodyEditorUndoRedoShortcut\(bodyTab, bodyTa, e\)\) return;/);
    assert.match(script, /bodyTa\._tessraAutoGrow = autoGrow;/);
  });

  it('binds delegated mainContent events only once across repeated renders', () => {
    assert.match(script, /var contentDelegatedEventsBound = false;/);
    assert.match(script, /function bindContentDelegatedEventsOnce\(\)/);
    assert.match(script, /if \(contentDelegatedEventsBound\) return;/);
    assert.match(script, /contentDelegatedEventsBound = true;/);
    assert.match(script, /function bindContentEvents\(\) \{[\s\S]*bindContentDelegatedEventsOnce\(\);/);

    const bindDelegatedScript = extractScriptSegment(
      script,
      'function bindContentDelegatedEventsOnce',
      'function bindContentEvents'
    );
    const registrations: Array<{ type: string; options: unknown }> = [];
    const context: Record<string, unknown> = {
      contentDelegatedEventsBound: false,
      mainContent: {
        addEventListener: (type: string, _handler: unknown, options?: unknown) => {
          registrations.push({ type, options });
        },
      },
    };

    vm.createContext(context);
    vm.runInContext(bindDelegatedScript, context);

    (context.bindContentDelegatedEventsOnce as () => void)();
    (context.bindContentDelegatedEventsOnce as () => void)();

    const types = registrations.map((entry) => entry.type);
    assert.deepStrictEqual(types, [
      'keydown',
      'focusin',
      'focusout',
      'click',
      'input',
      'click',
      'click',
      'click',
    ]);
    assert.strictEqual(registrations.length, 8, 'delegated listener registration should not repeat');
    assert.strictEqual(registrations[0].options, true, 'autocomplete keydown should remain capture-phase');

    const bindContentSegment = extractScriptSegment(
      script,
      'function bindContentEvents',
      '  mc.querySelector(\'.js-method\')'
    );
    assert.doesNotMatch(
      bindContentSegment,
      /mc\.addEventListener/,
      'render-scoped bindContentEvents should not attach delegated listeners to mainContent'
    );
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
      normalizeBodyType: (bodyType: string) => bodyType || 'none',
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

  it('mirrors JSON/XML Body syntax highlighting behind the real textarea', () => {
    assert.match(
      script,
      /class="body-editor js-body-editor/,
      'body markup should wrap textarea in a relative editor shell'
    );
    assert.match(
      script,
      /class="body-highlight js-body-highlight" aria-hidden="true"/,
      'highlight overlay should be aria-hidden for assistive tech'
    );
    assert.match(script, /shouldEnableBodySyntaxHighlight\(tab\.bodyType, isWs\)/);
    assert.match(script, /BODY_JSON_HIGHLIGHT_MAX_CHARS = 120000/);
    assert.match(script, /BODY_JSON_HIGHLIGHT_DEBOUNCE_MS = 80/);
    assert.match(script, /bodyTa\.addEventListener\('scroll'/);
    assert.match(script, /_tessraRefreshBodyHighlight/);
    assert.match(
      html,
      /\.body-editor\.is-syntax-highlight \.js-body\{[^}]*color:transparent/,
      'syntax highlight mode should make textarea text transparent so the overlay shows tokens'
    );
    assert.match(
      html,
      /\.body-highlight\{[^}]*pointer-events:none/,
      'overlay must not intercept pointer input'
    );
    assert.match(html, /bodyConversion\.js/, 'Body conversion helper script should load in the webview');
    assert.match(html, /body-convert-dialog/, 'conversion confirm dialog styles should stay VS Code-native compact');

    const highlightScript = extractScriptSegment(
      script,
      'function shouldEnableBodySyntaxHighlight',
      'function syncBodyTypeUiFromTab'
    );
    const context: Record<string, unknown> = {
      BODY_JSON_HIGHLIGHT_MAX_CHARS: 120000,
      normalizeBodyType: (bodyType: string) => {
        const valid = ['none', 'json', 'xml', 'form', 'formdata', 'binary', 'raw'];
        return valid.includes(bodyType) ? bodyType : (bodyType === 'text' ? 'raw' : 'none');
      },
      escapeHtml: (value: string) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),
      hljs: {
        highlight: (code: string, opts: { language: string }) => ({
          value: `<span class="hljs-attr">${opts.language}</span> :: ${code.length}`,
        }),
      },
    };
    vm.createContext(context);
    vm.runInContext(highlightScript, context);

    const shouldEnable = context.shouldEnableBodySyntaxHighlight as (bodyType: string, isWebSocket: boolean) => boolean;
    assert.strictEqual(shouldEnable('json', false), true, 'HTTP JSON body should enable overlay');
    assert.strictEqual(shouldEnable('xml', false), true, 'HTTP XML body should enable overlay');
    assert.strictEqual(shouldEnable('json', true), false, 'WebSocket composer should stay plain');
    assert.strictEqual(shouldEnable('raw', false), false, 'raw body types should disable overlay');

    const highlight = context.highlightBodySource as (source: string, language: string) => string;
    const highlighted = highlight('{"k":"v"}', 'json');
    assert.ok(highlighted.includes('hljs-attr'), 'valid JSON should use highlight.js tokens');
    assert.ok(highlighted.includes('json'), 'JSON language should be passed to hljs');

    const xmlHighlighted = highlight('<root/>', 'xml');
    assert.ok(xmlHighlighted.includes('xml'), 'XML language should refresh overlay language immediately');

    const plainLarge = highlight('x'.repeat(120001), 'json');
    assert.strictEqual(plainLarge.includes('hljs-'), false, 'over-threshold bodies should skip tokenization');
    assert.ok(plainLarge.startsWith('x'), 'over-threshold bodies still render escaped plain text');

    const withTrailingNewline = highlight('{\n}\n', 'json');
    assert.ok(withTrailingNewline.endsWith('<br>'), 'trailing newline should preserve an extra overlay line');

    const textarea = { scrollTop: 42, scrollLeft: 7 };
    const overlay = { scrollTop: 0, scrollLeft: 0 };
    (context.syncBodyHighlightScroll as (textarea: unknown, highlightEl: unknown) => void)(textarea, overlay);
    assert.strictEqual(overlay.scrollTop, 42, 'overlay scrollTop should mirror textarea');
    assert.strictEqual(overlay.scrollLeft, 7, 'overlay scrollLeft should mirror textarea');

    context.hljs = {
      highlight: () => {
        throw new Error('bad json');
      },
    };
    const degraded = highlight('{ partial', 'json');
    assert.strictEqual(degraded.includes('hljs-'), false, 'highlight failures should degrade to escaped plain text');
    assert.ok(degraded.includes('{ partial'), 'partial JSON must remain editable/visible via plain overlay');
  });

  it('offers Body type conversion confirm without auto-converting on select', () => {
    assert.match(script, /function handleBodyTypeSelectChange\(mc, selectEl\)/);
    assert.match(script, /function showBodyTypeConversionConfirm\(options\)/);
    assert.match(script, /function applyBodyTypeChange\(mc, tab, nextType, mode\)/);
    assert.match(script, /handleBodyTypeSelectChange\(mc, e\.target\)/);
    assert.match(script, /data-action="convert"/);
    assert.match(script, /data-action="keep"/);
    assert.match(script, /webview\.bodyConvertKeep/);
    assert.match(script, /captureBodyConversionUndoSnapshot/);
    assert.match(script, /api\.convert\(/);
    assert.doesNotMatch(
      script,
      /mc\.querySelector\('\.js-body-type'\)\?\.addEventListener\('change', \(e\) => \{\s*const bodyType = e\.target\.value/,
      'legacy auto type-change handler without confirm must not remain'
    );
  });

  it('restores body type and content together for conversion undo/redo', () => {
    const undoScript = extractScriptSegment(
      script,
      'function isEditableTarget',
      '  function createTab'
    );
    let markDirtyCalls = 0;
    const selectState = { value: 'xml' };
    const context: Record<string, unknown> = {
      BODY_UNDO_MAX_ENTRIES: 100,
      BODY_UNDO_COALESCE_MS: 700,
      bodyUndoApplying: false,
      Date: { now: () => 1000 },
      Math,
      String,
      JSON,
      mainContent: {
        querySelector: (sel: string) => {
          if (sel === '.js-body-type') return selectState;
          if (sel === '.js-body') return null;
          if (sel === '.js-body-editor') return { style: {}, classList: { toggle() {}, remove() {} }, setAttribute() {}, removeAttribute() {} };
          if (sel === '.js-formdata-panel') return { classList: { toggle() {} } };
          if (sel === '.js-binary-panel') return { classList: { toggle() {} } };
          if (sel === '.js-formdata-rows') return { innerHTML: '' };
          if (sel === '.js-binary-path') return { value: '' };
          return null;
        },
      },
      markDirty: () => { markDirtyCalls += 1; },
      refreshDraftInsights: () => undefined,
      debouncePersist: () => undefined,
      isWebSocketTab: () => false,
      syncAutoContentType: () => undefined,
      formDataRowsHtml: () => '',
      refreshFormDataSummary: () => undefined,
      normalizeBodyType: (bodyType: string) => bodyType,
    };

    vm.createContext(context);
    vm.runInContext(undoScript, context);

    const tab: {
      body: string;
      bodyType: string;
      formData: unknown[];
      binaryFilePath: string;
      _bodyUndoState?: { undo: Array<{ conversion?: boolean; bodyType?: string; value: string }>; redo: unknown[]; lastValue: string };
    } = {
      body: '<root><a>1</a></root>',
      bodyType: 'xml',
      formData: [],
      binaryFilePath: '',
    };
    const textarea = {
      value: tab.body,
      selectionStart: tab.body.length,
      selectionEnd: tab.body.length,
      _tessraAutoGrow: () => undefined,
      _tessraRefreshBodyHighlight: () => undefined,
    };

    (context.resetBodyUndoState as (tab: unknown, value: string, textarea: unknown) => void)(tab, tab.body, textarea);
    const before = (context.captureBodyConversionUndoSnapshot as (tab: unknown, textarea: unknown) => unknown)(tab, textarea);
    tab.body = '{"a":1}';
    tab.bodyType = 'json';
    textarea.value = tab.body;
    selectState.value = 'json';
    const state = tab._bodyUndoState!;
    (context.pushBodyUndoSnapshot as (stack: unknown, snapshot: unknown) => void)(state.undo, before);
    state.lastValue = tab.body;

    const undoEvent = {
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    };
    const handled = (context.handleBodyEditorUndoRedoShortcut as (tab: unknown, textarea: unknown, event: unknown) => boolean)(
      tab,
      textarea,
      undoEvent
    );
    assert.strictEqual(handled, true);
    assert.strictEqual(tab.bodyType, 'xml');
    assert.strictEqual(tab.body, '<root><a>1</a></root>');
    assert.strictEqual(selectState.value, 'xml');
    assert.ok(markDirtyCalls >= 1);
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
    assert.match(script, /function bindActionsMoreMenu\(button, menu\)/);
    assert.match(script, /button\.setAttribute\('aria-expanded', 'true'\)/);
    assert.match(script, /activeFormatMenuState\.button\.setAttribute\('aria-expanded', 'false'\)/);
    assert.match(script, /role="menuitem"/);
    assert.match(script, /class="rm" type="button" title="' \+ escapeAttr\(tr\('webview\.remove'\)\)/);
  });

  it('renders variable hover preview helpers with active environment values', () => {
    assert.match(script, /let activeVarValues = \{\};/);
    assert.match(script, /function syncVariablePreviewHints\(scope\)/);
    assert.match(script, /function showVariablePreviewPopover\(target\)/);
    assert.match(script, /let currentWorkspaceProfile = ["']default["'];/);
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

  it('ships token-only color skins for the request panel theme presets', () => {
    assert.match(htmlSource, /\/\* Theme presets: CSS custom properties only/);
    assert.match(htmlSource, /body\[data-panel-theme="minimal-cool"\]\{[\s\S]*--tessra-brand-blue:#7dc8ff;[\s\S]*--tessra-accent:var\(--tessra-brand\);[\s\S]*--tessra-method-get:#5bbf6a;/);
    assert.match(htmlSource, /body\[data-panel-theme="product"\]\{[\s\S]*--tessra-tone-info:#9fd3ff;[\s\S]*--tessra-label-accent:#9fd3ff;/);
    assert.match(htmlSource, /\.req-tab\.active\{opacity:1;background:transparent;border-bottom:3px solid var\(--vscode-focusBorder\);box-shadow:none\}/);
    assert.doesNotMatch(htmlSource, /\.req-tab\.active\{[^}]*linear-gradient/);
    assert.match(htmlSource, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(htmlSource, /\.runner-bar-fill\{[^}]*transform:scaleX\(0\);[^}]*transition:transform/);
    assert.doesNotMatch(htmlSource, /\.runner-bar-fill\{[^}]*transition:width/);
    assert.match(htmlSource, /\.default-headers-summary:focus-visible/);
    assert.match(htmlSource, /\.status-strip-link:focus-visible/);
    assert.match(htmlSource, /--tessra-json-key:var\(--vscode-debugTokenExpression-name\)/);
    assert.match(htmlSource, /body\[data-panel-theme="bold-color"\]\{[\s\S]*--tessra-status-2xx:#7ff09f;[\s\S]*--tessra-json-key:var\(--vscode-debugTokenExpression-name\);/);
    assert.match(htmlSource, /\.tab\.active\{opacity:1;background:transparent;box-shadow:inset 0 -2px 0 var\(--tessra-accent/);
    assert.doesNotMatch(htmlSource, /body\[data-panel-theme="minimal-cool"\] \.tab\.active\{/);
    assert.doesNotMatch(htmlSource, /body\[data-panel-theme="product"\] \.settings-group-title/);
    assert.doesNotMatch(htmlSource, /body\[data-panel-theme="bold-color"\] \.status-2xx\{/);
    assert.doesNotMatch(htmlSource, /body\[data-panel-theme="[^"]+"\][^{]*\{[^}]*(padding|margin|border-radius|box-shadow|linear-gradient|glow):/);
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
    assert.match(script, /function bindRequestSettingsEditor\(/);
    const settingsSegment = extractScriptSegment(
      script,
      "var settingsPanel = mc.querySelector('.js-settings-panel');",
      'function createTab('
    );
    assert.doesNotMatch(settingsSegment, /renderContent\(\);/);
  });

  it('renders Quiet Instrument request panel chrome affordances', () => {
    assert.ok(html.includes('settings-grid'), 'settings layout should remain available');
    assert.ok(html.includes('script-card'), 'scripts tab should keep field groups');
    assert.ok(html.includes('script-help-line'), 'scripts tab should render a compact one-line helper');
    assert.ok(html.includes('btn-keyhint'), 'send button should show the Enter key hint');
    assert.ok(html.includes('url-primary-group'), 'url bar should isolate Method/URL primary controls');
    assert.ok(html.includes('url-hero-actions'), 'url bar should keep the primary Send/Stop action');
    assert.ok(html.includes('js-request-more-btn'), 'infrequent request actions should live in overflow');
    assert.ok(html.includes('js-request-more-menu'), 'request overflow menu should be present');
    assert.ok(html.includes('action-label'), 'overflow actions should keep label spans');
    assert.ok(html.includes('res-response-shell'), 'response area should use a dedicated flex shell');
    assert.ok(html.includes('res-empty-shell'), 'response empty states should render inside a scrollable shell');
    assert.ok(html.includes('response-summary-card'), 'response summary remains the success primary');
    assert.ok(html.includes('response-stat-inline'), 'response summary should expose inline response stats');
    assert.ok(html.includes('response-action-cluster'), 'response actions should render in a dedicated cluster');
    assert.ok(html.includes('js-status-strip'), 'meta should use one quiet status strip');
    assert.ok(html.includes('status-strip-line'), 'status strip should expose a one-line default');
    assert.ok(html.includes('actions-more-menu'), 'infrequent response actions should collapse into a more menu');
    assert.ok(html.includes('divider-grip'), 'split divider should expose an affordance grip');
    assert.ok(html.includes('default-headers-oneline'), 'default headers should be a one-liner');
    assert.doesNotMatch(script, /request-info-row">'\s*\+\s*preflightHtml/);
    assert.match(script, /function getRequestStageInfo\(tab\)/);
    assert.match(script, /function renderEmptyState\(title, copy, actions\)/);
    assert.doesNotMatch(script, /empty-state-card/);
    assert.doesNotMatch(script, /empty-state-orbit/);
    assert.doesNotMatch(script, /empty-state-kicker/);
    assert.doesNotMatch(htmlSource, /\.ws-status-label\{[^}]*text-transform:uppercase/);
    assert.doesNotMatch(htmlSource, /\.settings-card:hover\{[^}]*box-shadow:[^;]*22px/);
    assert.doesNotMatch(htmlSource, /\.settings-toggle::before\{content:""/);
    assert.match(script, /function renderStatusStrip\(tab\)/);
    assert.match(script, /function renderResponseStat\(label, value, tone, detail\)/);
    assert.match(script, /function buildCompareChipMarkup\(currentSignature\)/);
    assert.match(script, /function scriptTemplateSource\(name\)/);
    assert.match(script, /function insertScriptTemplate\(mc, targetName, templateName\)/);
    assert.match(script, /var secondary = '';/);
    assert.doesNotMatch(script, /var secondary = tr\('webview\.stage\.ready\.detail'\);/);
    assert.doesNotMatch(script, /secondary = tab\.response\.status \+ ' ' \+ \(tab\.response\.statusText \|\| ''\);/);
    assert.match(script, /row\.className = 'runner-row method-' \+ msg\.method \+ ' ' \+ cls;/);
  });

  it('keeps inert data-testid hooks for UI E2E without duplicates in static HTML shell', () => {
    const requiredLiterals = [
      'request-url',
      'send-request',
      'stop-request',
      'status-environment',
      'status-variable-usage',
      'environment-disclosure',
      'variable-usage-disclosure',
      'request-body-editor',
      'body-type',
      'response-status',
      'response-pin',
      'response-compare',
      'response-overflow',
      'script-prerequest',
      'script-test',
      'response-tests',
      'runner-selected-count',
      'runner-start',
    ];
    for (const id of requiredLiterals) {
      assert.ok(
        htmlSource.includes(`"${id}"`) || htmlSource.includes(`'${id}'`),
        `missing data-testid literal ${id}`
      );
    }
    const shellHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const staticIds = [...shellHtml.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(staticIds.includes('environment-disclosure'));
    assert.deepStrictEqual(staticIds, [...new Set(staticIds)], 'static HTML shell must not duplicate data-testid values');
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
    assert.match(script, /function hasUserLockedSplitRatio\(reqArea, tab\)/);
    assert.match(script, /function syncResponseEmphasisClass\(splitEl, tab\)/);
    assert.match(script, /is-response-emphasis/);
    assert.match(script, /function getCollapsedRequestAreaHeight\(splitEl\)/);
    assert.match(script, /function applyStoredRequestAreaHeight\(reqArea, splitEl, dividerEl, progressEl, tab\)/);
    assert.match(script, /tab\.requestSplitHeightPx = clampedHeight;/);
    assert.match(script, /debouncePersist\(\);/);
    assert.match(script, /requestMinPanel = isRequestEditorCollapsed\(tab\) \? getCollapsedRequestAreaHeight\(splitEl\) : minPanel/);
    assert.match(script, /hasUserLockedSplitRatio\(reqArea, tab\) && !isRequestEditorCollapsed\(tab\)/);
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
    assert.match(htmlSource, /\.json-body\{background:var\(--vscode-editor-background\);padding:8px 10px;border-radius:2px;/);
    assert.match(htmlSource, /\.json-tree\{background:var\(--vscode-editor-background\);padding:8px 10px;border-radius:2px;/);
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
    assert.match(script, /responseTabMarkup\('resPreview', tr\('webview\.preview'\), showPreview, 'responsePreviewPanel'\)/);
    assert.match(script, /<div id="responsePreviewPanel" role="tabpanel" aria-labelledby="responseTab-resPreview"/);
    assert.match(script, /preview\.innerHTML = buildPreviewDocument\(tab\.response\.body \|\| '', tab\.resolvedUrl \|\| tab\.url \|\| ''\);/);
    assert.match(script, /querySelectorAll\('script, style, noscript, iframe, object, embed, link, source, audio, video, track, base, meta\[http-equiv="refresh"\]'\)/);
    assert.match(script, /tf\('webview\.previewOfflineBlockedAssets', \{ count: String\(payload\.blockedAssets\) \}\)/);
    assert.match(script, /js-open-response-url/);
  });

  it('gives response tabs roving keyboard semantics and labelled tab panels', () => {
    assert.match(script, /class="tabs js-res-tabs" role="tablist" aria-label="/);
    assert.match(script, /function responseTabMarkup\(tabName, label, active, controls, count\)/);
    assert.match(script, /role="tab" tabindex="' \+ \(active \? '0' : '-1'\)/);
    assert.match(script, /function handleResponseTabKeydown\(mc, event\)/);
    assert.match(script, /event\.key === 'ArrowRight' \|\| event\.key === 'ArrowDown'/);
    assert.match(script, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowUp'/);
    assert.match(script, /event\.key === 'Home'/);
    assert.match(script, /event\.key === 'End'/);
    assert.match(script, /switchResponseTabInContent\(mc, next\.dataset\.tab\);\n  next\.focus\(\);/);
    assert.match(script, /id="responseBodyPanel" role="tabpanel" aria-labelledby="responseTab-resBody"/);
    assert.match(script, /id="responseHeadersPanel" role="tabpanel" aria-labelledby="responseTab-resHeaders"/);
    assert.match(script, /mc\.querySelector\('\.js-res-tabs'\)\?\.addEventListener\('keydown'/);
  });

  it('keeps the latest tab draft in webview state and host memory before disk debounce', () => {
    assert.match(script, /function buildWebviewDraftState\(\)/);
    assert.match(script, /profileName: currentWorkspaceProfile \|\| 'default'/);
    assert.match(script, /vscode\.setState\(draft\)/);
    assert.match(script, /type: 'updateTabDraft'/);
    assert.match(script, /function readInitialWebviewDraft\(\)/);
    assert.match(script, /var normalizedProfile = typeof state\.profileName === 'string'/);
    assert.match(script, /if \(normalizedProfile !== \(currentWorkspaceProfile \|\| 'default'\)\)/);
    assert.match(script, /type: 'webviewReady',[\s\S]*webviewDraft: initialWebviewDraft/);
    assert.match(script, /if \(webviewDraftRestored && msg\.replace !== true\)/);
  });

  it('publishes every latest draft with the disk timer held and flushes only the final state', () => {
    const persistence = extractScriptSegment(script, 'function buildWebviewDraftState()', "window.addEventListener('beforeunload', flushPersist);");
    const animation = createAnimationHarness();
    const posted: Array<{ type: string; tabs: Array<{ url: string; body: string }> }> = [];
    const states: Array<{ tabs: Array<{ url: string; body: string }> }> = [];
    const tab = { id: 'tab', name: 'Draft', url: '/before', body: '', method: 'GET', bodyType: 'raw', headers: [], params: [], auth: { type: 'none' } };
    const context = vm.createContext({
      tabs: [tab], activeTabId: 'tab', currentWorkspaceProfile: 'default', compareSettings: {},
      saveActiveTabState() {}, normalizeRequestType: () => 'http', normalizeRequestEditorTab: () => 'body',
      normalizeRequestSplitHeight: () => 0, prunePathVariableOverrides: () => ({}), requestSettingsSnapshot: () => ({}),
      cloneCompareSettings: () => ({}), setTimeout: animation.setTimeout, clearTimeout: animation.clearTimeout,
      vscode: { setState: (value: typeof states[number]) => states.push(JSON.parse(JSON.stringify(value))),
        postMessage: (value: typeof posted[number]) => posted.push(JSON.parse(JSON.stringify(value))) },
    });
    vm.runInContext(persistence, context);
    for (const value of ['first', 'latest']) {
      tab.url = '/' + value;
      tab.body = value;
      vm.runInContext('debouncePersist()', context);
    }
    assert.deepStrictEqual(posted.map(item => item.type), ['updateTabDraft', 'updateTabDraft']);
    assert.strictEqual(posted[1].tabs[0].url, '/latest');
    assert.strictEqual(states[1].tabs[0].body, 'latest');
    vm.runInContext('flushPersist()', context);
    assert.strictEqual(posted.filter(item => item.type === 'saveTabState').length, 1);
    assert.strictEqual(posted[posted.length - 1].tabs[0].body, 'latest');
    animation.flushTimers();
    assert.strictEqual(posted.filter(item => item.type === 'saveTabState').length, 1);
  });

  it('keeps legacy status hooks inert and makes tab dialogs and menus keyboard-safe', () => {
    const detail = extractScriptSegment(
      script,
      'function renderStatusStripExpandDetails(tab)',
      'function renderStatusStrip(tab)'
    );
    assert.match(detail, /js-topline-status-chips visually-hidden" aria-hidden="true"><\/div>/);
    // 스트립을 다시 그려도 unresolved 경고를 유지하되 숨김 영역에는 포커스 가능한 노드를 넣지 않는다.
    assert.match(detail, /js-request-preflight-wrap visually-hidden" aria-hidden="true">'[\s\S]*renderRequestPreflight\(tab\)[\s\S]*'<\/div>/);
    assert.match(script, /function refreshRequestPreflight\(mc\)[\s\S]*wrap\.innerHTML = renderRequestPreflight\(draftTab\)/);
    assert.match(script, /return '<span class="preflight-pill/);
    assert.match(script, /<span class="ghost-btn ripple-btn js-preflight-action"/);
    assert.doesNotMatch(script, /return '<button class="preflight-pill/);
    assert.match(script, /function setupDirtyConfirmOverlay\(overlay\)/);
    assert.match(script, /aria-modal', 'true'/);
    assert.match(script, /e\.key === 'Escape'/);
    assert.match(script, /e\.key !== 'Tab'/);
    assert.match(script, /showTabContextMenu\(rect\.left, rect\.bottom, tab\.id, el\)/);
    assert.match(script, /e\.key === 'ContextMenu' \|\| \(e\.key === 'F10' && e\.shiftKey\)/);
    assert.match(script, /menu\.setAttribute\('role', 'menu'\)/);
    assert.match(script, /el\.setAttribute\('role', 'menuitem'\)/);
    assert.match(script, /e\.key === 'ArrowDown'/);
  });

  it('surfaces workspace default headers directly in the request UI', () => {
    assert.match(script, /let workspaceDefaultHeaders = \[\];/);
    assert.match(script, /function renderDefaultHeadersBanner\(tab\)/);
    assert.match(script, /function refreshDefaultHeadersBanner\(mc\)/);
    assert.match(script, /function revealDefaultHeadersEditor\(\)/);
    assert.match(script, /function setDefaultHeadersEditorData\(/);
    assert.match(script, /function getOverriddenDefaultHeaders\(tab\)/);
    assert.match(script, /function renderDefaultHeaderKeyGroup\(labelKey, headers, chipClass\)/);
    assert.match(script, /js-default-headers-toggle/);
    assert.match(script, /default-headers-oneline/);
    assert.match(script, /js-default-headers-banner-wrap/);
    assert.match(script, /vscode\.postMessage\(\{ type: 'openDefaultHeaders' \}\)/);
    assert.match(script, /type: 'saveDefaultHeaders'/);
    assert.match(script, /workspaceDefaultHeaders = msg\.headers \|\| \[\];/);
    assert.match(script, /setDefaultHeadersEditorData\(workspaceDefaultHeaders\)/);
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

  it('keeps Pin/Compare on Response primary toolbar and utilities in overflow', () => {
    const responseCluster = extractScriptSegment(
      script,
      '\'<div class="response-action-cluster">\' +',
      '\'<div class="response-context-row">\' +'
    );
    const menuStart = responseCluster.indexOf('js-actions-more-menu');
    assert.ok(menuStart >= 0, 'Response summary must render an overflow menu');
    const beforeMenu = responseCluster.slice(0, menuStart);
    const menuBody = responseCluster.slice(menuStart);

    // 1–3: Pin / Compare / More always visible on primary toolbar.
    assert.match(beforeMenu, /pin-response-btn js-pin-response/);
    assert.match(beforeMenu, /compare-btn js-compare-responses/);
    assert.match(beforeMenu, /js-actions-more-btn/);
    assert.match(beforeMenu, /compareQuietHtml/);
    assert.doesNotMatch(beforeMenu, /js-copy-response"/);
    assert.doesNotMatch(beforeMenu, /js-save-response/);

    // Pin/Compare must not be overflow-only (prefer primary-only, no menuitem duplicates).
    assert.doesNotMatch(menuBody, /js-pin-response/);
    assert.doesNotMatch(menuBody, /js-compare-responses/);

    // 4–10: Copy / Save / Mode / metadata utilities stay in ⋯.
    const requiredOverflowItems = [
      { cls: 'js-copy-response', menuitemRe: /js-copy-response"(?!-)[\s\S]{0,160}?role="menuitem"/ },
      { cls: 'js-copy-response-url', menuitemRe: /js-copy-response-url"[\s\S]{0,160}?role="menuitem"/ },
      { cls: 'js-save-response', menuitemRe: /js-save-response"[\s\S]{0,160}?role="menuitem"/ },
      { cls: 'js-copy-response-status', menuitemRe: /js-copy-response-status"[\s\S]{0,160}?role="menuitem"/ },
      { cls: 'js-copy-response-headers', menuitemRe: /js-copy-response-headers"[\s\S]{0,160}?role="menuitem"/ },
      { cls: 'js-compare-last', menuitemRe: /js-compare-last"[\s\S]{0,200}?role="menuitem"/ },
      { cls: 'js-compare-settings', menuitemRe: /js-compare-settings"[\s\S]{0,160}?role="menuitem"/ },
    ];
    for (const item of requiredOverflowItems) {
      assert.ok(menuBody.includes(item.cls), `Response overflow must list ${item.cls}`);
      assert.match(menuBody, item.menuitemRe, `${item.cls} must be a menuitem`);
    }
    assert.match(menuBody, /!lastResponse \? ' disabled'/);
    assert.match(menuBody, /tr\('webview\.mode'\)[\s\S]*compareModeShort\(compareSettings\.mode\)/);
    assert.match(beforeMenu, /compareReady \? '' : ' disabled'/);
    assert.match(script, /const compareTitle = compareReady/);
    assert.match(script, /tr\('webview\.compareNeedsPin'\)/);

    // 11–14: Click handlers + pin/compare state wiring.
    assert.match(script, /bindActionsMoreMenu\(mc\.querySelector\('\.js-actions-more-btn'\), mc\.querySelector\('\.js-actions-more-menu'\)\)/);
    assert.match(script, /mc\.querySelector\('\.js-pin-response'\)\?\.addEventListener\('click'/);
    assert.match(script, /mc\.querySelector\('\.js-compare-responses'\)\?\.addEventListener\('click'/);
    assert.match(script, /mc\.querySelector\('\.js-compare-last'\)\?\.addEventListener\('click'/);
    assert.match(script, /mc\.querySelector\('\.js-compare-settings'\)\?\.addEventListener\('click'/);
    assert.match(script, /mc\.querySelector\('\.js-copy-response'\)\?\.addEventListener\('click'/);
    assert.match(script, /mc\.querySelector\('\.js-save-response'\)\?\.addEventListener\('click'/);
    assert.match(script, /type: 'copyResponseBody'/);
    assert.match(script, /type: 'saveResponseBody'/);
    assert.match(script, /type: 'compareResponses'/);
    assert.match(script, /showCompareSettings\(\)/);
    assert.match(script, /js-compare-metadata/);
    assert.match(script, /includeMetadataSummary/);
    assert.match(script, /data-mode="raw"/);
    assert.match(script, /data-mode="normalized"/);
    assert.match(script, /data-mode="pretty"/);
    assert.match(script, /pinBtn\.classList\.toggle\('pinned', currentPinned\)/);
    assert.match(script, /cmpBtn\.disabled = true/);
    assert.match(script, /cmpBtn\.disabled = false/);
    assert.match(script, /tr\('webview\.compareNeedsPin'\)/);

    // 15: Mode/metadata contextual cue sync (compact text, not chip wall).
    assert.match(script, /function buildCompareContextCueText\(\)/);
    assert.match(script, /compare-active-indicator js-compare-chip-row/);
    assert.match(script, /js-compare-chip-row visually-hidden/);
    assert.match(script, /const compareQuietHtml = compareCueText/);
    assert.match(script, /tr\('webview\.metadata'\)/);

    // Body toolbar / tabs remain reachable outside overflow.
    assert.match(script, /js-res-body-toolbar/);
    assert.match(script, /data-mode="tree"/);
    assert.match(script, /js-fmt-btn/);
    assert.match(script, /js-response-search/);
    assert.match(script, /responseTabMarkup\('resCookies'/);
    assert.match(script, /responseTabMarkup\('resHeaders'/);
    assert.match(script, /responseTabMarkup\('resTests'/);
    assert.match(script, /responseTabMarkup\('resPreview'/);
    assert.match(script, /xpathHint|webview\.xpathHint/);
  });

  it('fails if Pin/Compare regress to Response overflow-only discoverability', () => {
    const responseCluster = extractScriptSegment(
      script,
      '\'<div class="response-action-cluster">\' +',
      '\'<div class="response-context-row">\' +'
    );
    const menuStart = responseCluster.indexOf('js-actions-more-menu');
    assert.ok(menuStart >= 0, 'Response overflow menu must exist');
    const primaryToolbar = responseCluster.slice(0, menuStart);
    const overflowMenu = responseCluster.slice(menuStart);

    // Primary workflow: Pin/Compare must live in the response-action-cluster primary strip.
    assert.match(primaryToolbar, /class="pin-response-btn js-pin-response"/);
    assert.match(primaryToolbar, /class="compare-btn js-compare-responses/);
    assert.match(primaryToolbar, /js-actions-more-btn/);
    // Overflow must not be the only path (and preferably must not duplicate them).
    assert.doesNotMatch(overflowMenu, /js-pin-response/);
    assert.doesNotMatch(overflowMenu, /js-compare-responses/);

    // Other primary workflow actions must also remain discoverable outside overflow-only paths.
    assert.match(script, /url-hero-actions/);
    assert.match(script, /class="btn-send/);
    assert.match(script, /class="btn-stop/);
    assert.match(script, /js-body-type/);
    assert.match(script, /data-action="edit-environment"/);
    assert.match(script, /data-action="reveal-variable-usage"/);
    assert.match(script, /class="js-body-type body-type-select"/);
  });

  it('keeps Response overflow keyboard access and quiet compare indicator updates', () => {
    assert.match(script, /function bindActionsMoreMenu\(button, menu\)/);
    assert.match(script, /function handleActionsMenuKeydown\(event\)/);
    assert.match(script, /function getOpenActionsMenuItems\(menu\)/);
    assert.match(script, /function focusActionsMenuItem\(menu, index\)/);
    assert.match(script, /function syncCompareContextIndicator\(mc, currentSignature\)/);
    assert.match(script, /document\.addEventListener\('keydown', function\(e\) \{\s*handleActionsMenuKeydown\(e\);\s*\}\)/);
    assert.match(script, /if \(e\.key !== 'ArrowDown'\) return;/);
    assert.match(script, /event\.key === 'Escape'/);
    assert.match(script, /event\.key === 'ArrowUp'/);
    assert.match(script, /event\.key === 'Home'/);
    assert.match(script, /event\.key === 'End'/);

    assert.match(script, /function buildCompareContextCueText\(\)/);
    const syncScript = extractScriptSegment(
      script,
      'function syncCompareContextIndicator(mc, currentSignature) {',
      'function updatePinCompareButtons(mc) {'
    );
    assert.match(syncScript, /compare-active-indicator js-compare-chip-row/);
    assert.match(syncScript, /js-compare-chip-row visually-hidden/);
    assert.match(syncScript, /chipRow\.textContent = cueText/);
    assert.match(syncScript, /chipRow\.innerHTML = buildCompareChipMarkup\(currentSignature/);

    const updateScript = extractScriptSegment(
      script,
      'function updatePinCompareButtons(mc) {',
      'var pinSvg ='
    );
    assert.match(updateScript, /syncCompareContextIndicator\(mc,/);
    assert.match(updateScript, /span class="action-label"/);
    assert.match(updateScript, /cmpBtn\.disabled = true/);
    assert.match(updateScript, /cmpBtn\.disabled = false/);
    assert.match(updateScript, /tr\('webview\.compareNeedsPin'\)/);
    assert.match(updateScript, /compareLastBtn\.disabled = !lastResponse/);

    const keyboardHarness = [
      'var activeFormatMenuState = null;',
      extractScriptSegment(script, 'function clearActionsMoreMenuPlacement(menu) {', 'function releaseSplitDrag() {'),
      'var pinnedResponses = [];',
      'var lastResponse = null;',
      'var compareSettings = { mode: "normalized", includeMetadataSummary: true };',
      'function compareModeShort(mode) { return mode === "normalized" ? "Normalized" : mode; }',
      'function tr(key) { return key === "webview.metadata" ? "Metadata" : key === "webview.compare" ? "Compare" : key; }',
      'function buildCompareChipMarkup() { return "<span class=\\"compare-chip mode\\">Mode</span>"; }',
      extractScriptSegment(script, 'function buildCompareContextCueText() {', 'function updatePinCompareButtons(mc) {'),
    ].join('\n');

    class MenuItem {
      public disabled = false;
      public focusCalls = 0;
      constructor(public role = 'menuitem') {}
      getAttribute(name: string) {
        if (name === 'aria-disabled') return 'false';
        return null;
      }
      focus() { this.focusCalls += 1; }
    }

    const items = [new MenuItem(), new MenuItem(), new MenuItem()];
    items[1].disabled = true;
    const menu = {
      classList: new FakeClassList(['open']),
      isConnected: true,
      contains(node: unknown) { return items.includes(node as MenuItem) || node === menu; },
      querySelectorAll(selector: string) {
        assert.strictEqual(selector, '[role="menuitem"]');
        return items;
      },
    };
    const button = {
      focusCalls: 0,
      isConnected: true,
      attributes: {} as Record<string, string>,
      focus() { this.focusCalls += 1; },
      contains() { return false; },
      setAttribute(name: string, value: string) { this.attributes[name] = value; },
    };
    const chip = {
      className: '',
      textContent: '',
      innerHTML: '',
    };
    const mc = {
      querySelector(selector: string) {
        if (selector === '.js-compare-chip-row') return chip;
        return null;
      },
    };

    const context: Record<string, unknown> = {
      activeFormatMenuState: { button, menu },
      pinnedResponses: [{ signature: 'a' }, { signature: 'b' }],
      lastResponse: { signature: 'last' },
      compareSettings: { mode: 'normalized', includeMetadataSummary: true },
      Array,
    };
    vm.createContext(context);
    vm.runInContext(keyboardHarness, context);
    // Re-seed after harness local `var activeFormatMenuState = null` initialization.
    context.activeFormatMenuState = { button, menu };
    context.pinnedResponses = [{ signature: 'a' }, { signature: 'b' }];
    context.lastResponse = { signature: 'last' };
    context.compareSettings = { mode: 'normalized', includeMetadataSummary: true };

    const focusItem = context.focusActionsMenuItem as (menu: unknown, index: number) => void;
    focusItem(menu, 0);
    assert.strictEqual(items[0].focusCalls, 1);
    focusItem(menu, 1);
    assert.strictEqual(items[2].focusCalls, 1, 'disabled menuitem should be skipped by focusing enabled items cyclically');

    const handleKey = context.handleActionsMenuKeydown as (event: { key: string; target: unknown; preventDefault: () => void }) => boolean;
    let prevented = 0;
    const escapeEvent = {
      key: 'Escape',
      target: items[0],
      preventDefault() { prevented += 1; },
    };
    assert.strictEqual(handleKey(escapeEvent), true);
    assert.strictEqual(prevented, 1);
    assert.strictEqual(context.activeFormatMenuState, null);
    assert.strictEqual(button.focusCalls, 1);
    assert.strictEqual(button.attributes['aria-expanded'], 'false');

    const sync = context.syncCompareContextIndicator as (mc: unknown, signature: string) => void;
    context.pinnedResponses = [{ signature: 'a' }, { signature: 'b' }];
    context.lastResponse = { signature: 'last' };
    sync(mc, 'a');
    assert.strictEqual(chip.className, 'compare-active-indicator js-compare-chip-row');
    assert.strictEqual(chip.textContent, 'Normalized · Metadata');
    assert.ok(!String(chip.innerHTML).includes('compare-chip'), 'active compare cue must not rebuild pill chips');

    context.pinnedResponses = [];
    context.lastResponse = null;
    context.compareSettings = { mode: 'normalized', includeMetadataSummary: true };
    sync(mc, '');
    assert.strictEqual(chip.className, 'js-compare-chip-row visually-hidden');
    assert.match(String(chip.innerHTML), /compare-chip/);

    // Non-default mode shows compact cue even without an active compare baseline.
    context.compareSettings = { mode: 'raw', includeMetadataSummary: false };
    sync(mc, '');
    assert.strictEqual(chip.className, 'compare-active-indicator js-compare-chip-row');
    assert.strictEqual(chip.textContent, 'raw');
  });

  it('shows the current environment with a localized label instead of raw template syntax', () => {
    assert.doesNotMatch(script, /renderLegacyStatusChipHooks|renderToplineStatusChips|refreshToplineStatusChips/);
    assert.match(script, /function renderStatusStrip\(tab\)/);
    assert.match(script, /function buildStatusStripSegments\(tab\)/);
    assert.match(script, /function refreshStatusStrip\(mc\)/);
    assert.match(script, /class="status-strip js-status-strip"/);
    assert.match(script, /class="request-status-chips js-topline-status-chips/);
    assert.match(script, /tr\('webview\.noEnvironment'\)/);
    assert.match(script, /tfCount\('webview\.stripDefaultsCount', appliedDefaultHeaders\.length\)/);
    assert.match(script, /tr\('webview\.disableScriptsStatus'\)/);
    assert.match(script, /tr\('webview\.scriptsPresentStatus'\)/);
    assert.match(script, /tr\('webview\.followRedirectsStatus'\)/);
    assert.match(script, /tr\('webview\.stopAfterHeadersStatus'\)/);
    assert.match(script, /'webview\.saveToHistoryOnStatus'/);
    assert.match(script, /'webview\.saveToHistoryOffStatus'/);
    assert.match(script, /tr\('webview\.tlsInsecureStatus'\)/);
    assert.match(script, /tf\('webview\.summaryEnvironment', \{ name: currentEnvName \}\)/);
    assert.doesNotMatch(script, /<span class="var-name">\{\{env\}\}<\/span>/);
  });

  it('refreshes status from the current draft while preserving disclosure state', () => {
    const context: Record<string, unknown> = {};
    vm.createContext(context);
    vm.runInContext(extractTaggedTemplate(
      readSourceFile('src/panels/requestPanel/requestPanelStatusClientScript.ts'), '/*js*/'
    ), context);
    const refresh = context.refreshStatusStrip as (mc: unknown) => void;
    const wrap = { innerHTML: '' };
    const mc = { querySelector: (selector: string) => selector === '.js-status-strip-host' ? wrap : null };
    const draft = { id: 'active', url: '/edited', saveToHistory: false };
    let expanded = true;
    const calls: string[] = [];
    Object.assign(context, {
      tabs: [{ id: 'active', url: '/saved', saveToHistory: true }],
      activeTabId: 'active',
      buildDraftTabFromContent: (content: unknown) => {
        assert.strictEqual(content, mc);
        return draft;
      },
      isStatusStripExpanded: () => expanded,
      renderStatusStrip: (tab: unknown) => {
        assert.strictEqual(tab, draft);
        calls.push('render');
        return 'updated';
      },
      setStatusStripExpanded: (open: boolean) => {
        assert.strictEqual(open, true);
        assert.strictEqual(wrap.innerHTML, 'updated');
        calls.push('expand');
      },
      syncEnvironmentStripDisclosureState: () => calls.push('sync environment'),
    });
    refresh(mc);
    assert.strictEqual(wrap.innerHTML, 'updated');
    assert.deepStrictEqual(calls, ['render', 'expand', 'sync environment']);
    calls.length = 0;
    expanded = false;
    refresh(mc);
    assert.deepStrictEqual(calls, ['render', 'sync environment']);
    calls.length = 0;
    refresh(null);
    context.activeTabId = 'missing';
    refresh(mc);
    assert.deepStrictEqual(calls, []);
  });

  it('keeps execution-affecting request settings on the status strip and demotes profile to disclosure', () => {
    const stripSegmentsFn = extractScriptSegment(
      script,
      'function buildStatusStripSegments(tab)',
      'function renderStatusStripExpandDetails(tab)'
    );
    assert.match(stripSegmentsFn, /var hasScripts = hasExecutableScripts\(tab\?\.scripts\);/);
    assert.match(stripSegmentsFn, /var scriptsOff = !!\(tab\?\.disableScripts \|\| \(hasScripts && tab\?\.scriptsTrusted === false\)\);/);
    assert.match(stripSegmentsFn, /tr\('webview\.scriptsPresentStatus'\)/);
    assert.match(stripSegmentsFn, /var historyOn = tab\?\.saveToHistory !== false;/);
    assert.match(stripSegmentsFn, /historyOn \? 'webview\.saveToHistoryOnStatus' : 'webview\.saveToHistoryOffStatus'/);
    assert.match(stripSegmentsFn, /normalizeTlsValidation\(tab\?\.tlsValidation\) === 'insecure'/);
    assert.match(stripSegmentsFn, /tr\('webview\.tlsInsecureStatus'\)/);
    assert.match(stripSegmentsFn, /tab\?\.followRedirects/);
    assert.match(stripSegmentsFn, /tr\('webview\.followRedirectsStatus'\)/);
    assert.match(stripSegmentsFn, /tab\?\.stopAfterHeaders/);
    assert.match(stripSegmentsFn, /tr\('webview\.stopAfterHeadersStatus'\)/);
    assert.match(stripSegmentsFn, /tab\?\.skipDefaultHeaders/);
    assert.match(stripSegmentsFn, /tr\('webview\.skipDefaultHeadersStatus'\)/);
    assert.match(stripSegmentsFn, /Profile stays in expand disclosure/);
    assert.doesNotMatch(stripSegmentsFn, /renderProfileIndicator/);
    assert.doesNotMatch(stripSegmentsFn, /change-workspace-profile/);
    assert.match(script, /data-action="change-workspace-profile"/);
  });

  it('ships Tessra brand signature tokens without colliding with method/status spectra', () => {
    assert.match(htmlSource, /--tessra-brand-blue:var\(--vscode-charts-blue/);
    assert.match(htmlSource, /--tessra-brand-violet:var\(--vscode-charts-purple/);
    assert.match(htmlSource, /--tessra-brand:color-mix\(in srgb,var\(--tessra-brand-violet\)/);
    assert.match(htmlSource, /--tessra-accent:var\(--tessra-brand\)/);
    assert.match(htmlSource, /\.tessra-mark\{/);
    assert.match(htmlSource, /\.tessra-mark--strip\{/);
    assert.match(htmlSource, /\.tessra-mark--empty\{/);
    assert.match(htmlSource, /--strip-env-fg:var\(--tessra-brand-fg/);
    assert.match(htmlSource, /--strip-active-cue:var\(--tessra-tone-info/);
    assert.match(script, /function renderTessraMark\(extraClass\)/);
    assert.match(script, /M12 2\.9 19\.1 7v10L12 21\.1 4\.9 17V7L12 2\.9/);
    assert.match(script, /mark: true/);
    assert.match(script, /renderTessraMark\('tessra-mark--empty'\)/);
    assert.match(script, /options\.mark \? renderTessraMark\('tessra-mark--strip'\)/);
    // Brand stays off Send fill and response success owner
    assert.doesNotMatch(htmlSource, /\.btn-send[^{]*\{[^}]*--tessra-brand/);
    assert.doesNotMatch(htmlSource, /\.status-2xx[^{]*\{[^}]*--tessra-brand/);
    assert.doesNotMatch(htmlSource, /\.method-GET[^{]*\{[^}]*--tessra-brand/);
  });

  it('gives status strip segments Quiet Instrument discoverability cues (not flat gray, not pill wall)', () => {
    assert.match(htmlSource, /\.status-strip-seg\.is-env\{/);
    assert.match(htmlSource, /\.status-strip-seg\.is-on\{/);
    assert.match(htmlSource, /\.status-strip-seg\.is-off\{/);
    assert.match(htmlSource, /\.status-strip-seg\.is-warn\{/);
    assert.match(htmlSource, /\.status-strip-cue\{/);
    assert.match(htmlSource, /\.status-strip-num\{/);
    assert.match(htmlSource, /--strip-env-bg:/);
    assert.match(htmlSource, /--strip-active-cue:/);
    assert.match(htmlSource, /\.status-strip-seg\.is-on \.status-strip-cue\{[^}]*color:var\(--strip-active-cue/);
    assert.match(htmlSource, /\.status-strip-seg\.is-info \.status-strip-num\{/);
    assert.match(htmlSource, /@container status-strip \(max-width: 480px\)/);
    assert.match(htmlSource, /@container status-strip \(max-width: 360px\)/);
    assert.match(htmlSource, /\.status-strip-seg\[data-priority="low"\]\{display:none\}/);
    assert.match(htmlSource, /\.status-strip-seg\[data-priority="medium"\]\{display:none\}/);
    assert.doesNotMatch(htmlSource, /\.status-strip-seg[^{]*\{[^}]*border-radius:\s*999px/);
    assert.doesNotMatch(htmlSource, /\.status-strip[^{]*\{[^}]*linear-gradient/);
    assert.doesNotMatch(htmlSource, /\.status-strip-seg[^{]*\{[^}]*box-shadow:/);
    assert.doesNotMatch(htmlSource, /\.status-strip-seg\.is-on[^{]*\{[^}]*#4[Ee][Cc]94[Ee]/);
    assert.match(script, /function buildStatusStripSegments\(tab\)/);
    assert.match(script, /function renderStatusStripLabelHtml\(label, count\)/);
    assert.match(script, /cue: 'on-dot'/);
    assert.match(script, /'on-check'/);
    assert.match(script, /cue: 'warn'/);
    assert.match(script, /'off'/);
    assert.match(script, /priority: 'critical'/);
    assert.match(script, /priority: 'low'/);
    assert.match(script, /status-strip-sep[\s\S]*?│/);
  });

  it('renders concrete status strip HTML for discoverability cases', () => {
    const stripHelpers = extractScriptSegment(
      script,
      'function countExecutableScripts(scripts)',
      'function renderStatusStripExpandDetails(tab)'
    );
    const harness = `
      var currentEnvName = 'staging';
      var envEditorVariableCount = 2;
      var envEditor = { classList: { contains: function() { return true; } } };
      var STRINGS = ${JSON.stringify({
        'webview.noEnvironment': 'No environment',
        'webview.summaryEnvironment': 'Environment: {name}',
        'environment.vars': '{count} vars',
        'webview.disableScriptsStatus': 'Scripts off',
        'webview.scriptsPresentStatus': 'Scripts',
        'webview.stripScriptsCount': 'Scripts {count}',
        'webview.summaryScriptsOn': 'Scripts enabled',
        'webview.saveToHistoryOnStatus': 'History on',
        'webview.saveToHistoryOffStatus': 'History off',
        'webview.summaryHistoryOn': 'History on',
        'webview.summaryHistoryOff': 'History off',
        'webview.skipDefaultHeadersStatus': 'Defaults skipped',
        'webview.stripDefaultsCount': 'Defaults {count}',
        'webview.defaultHeaders': 'Default headers',
        'webview.tlsInsecureStatus': 'TLS insecure',
        'webview.followRedirectsStatus': 'Redirects',
        'webview.stopAfterHeadersStatus': 'Headers only',
        'webview.stripVarsCount': 'Vars {count}',
        'webview.stripUsedCount': 'Used {count}',
        'webview.more': 'More',
      })};
      function tr(key) { return Object.prototype.hasOwnProperty.call(STRINGS, key) ? STRINGS[key] : key; }
      function tf(key, params) {
        return tr(key).replace(/{([A-Za-z0-9_]+)}/g, function(_, name) {
          return Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params[name]) : '{' + name + '}';
        });
      }
      function tfCount(key, count) { return tf(key, { count: String(count) }); }
      function escapeHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }
      function escapeAttr(s) { return escapeHtml(s); }
      function normalizeTlsValidation(value) {
        return value === 'insecure' ? 'insecure' : (value === 'strict' ? 'strict' : 'default');
      }
      function hasExecutableScripts(scripts) {
        return !!(scripts && ((scripts.preRequest || '').trim() || (scripts.test || '').trim()));
      }
      function collectVariableUsage(tab) { return tab && tab.__usage ? tab.__usage : []; }
      function getUnresolvedDraftVariableNames(tab) { return tab && tab.__unresolved ? tab.__unresolved : []; }
      function getAppliedDefaultHeaders(tab) { return tab && tab.__appliedDefaults ? tab.__appliedDefaults : []; }
      function isEnvironmentEditorOpen() {
        return !!(envEditor && !envEditor.classList.contains('hidden'));
      }
      function renderTessraMark(extraClass) {
        return '<svg class="tessra-mark' + (extraClass ? ' ' + extraClass : '') + '"></svg>';
      }
      ${stripHelpers}
      function renderStatusStripExpandDetails() { return ''; }
      function renderStatusStrip(tab) {
        var segments = buildStatusStripSegments(tab);
        var sep = '<span class="status-strip-sep" aria-hidden="true">│</span>';
        return '<div class="status-strip js-status-strip">' +
          '<div class="status-strip-segments">' + segments.join(sep) + '</div></div>';
      }
    `;
    const context: Record<string, unknown> = {};
    vm.createContext(context);
    vm.runInContext(harness, context);
    const renderStatusStrip = context.renderStatusStrip as (tab: Record<string, unknown>) => string;

    // 1) Scripts present + History on + Defaults 2; env shows defined var count
    const case1 = renderStatusStrip({
      scripts: { preRequest: 'env.set("a","1")', test: 'pm.test("ok", function(){})' },
      saveToHistory: true,
      __appliedDefaults: [{ key: 'X-A' }, { key: 'X-B' }],
    });
    assert.match(case1, /status-strip-seg is-env/);
    assert.match(case1, /tessra-mark tessra-mark--strip[\s\S]*?status-strip-label[\s\S]*?staging/);
    assert.match(case1, /status-strip-env-count[\s\S]*?<span class="status-strip-num">2<\/span> vars/);
    assert.match(case1, /data-action="edit-environment"/);
    assert.match(case1, /aria-expanded="false"/);
    assert.match(case1, /aria-controls="envEditor"/);
    assert.match(case1, /status-strip-seg is-on[\s\S]*?●[\s\S]*?Scripts 2/);
    assert.match(case1, /status-strip-seg is-on[\s\S]*?✓[\s\S]*?History on/);
    assert.match(case1, /status-strip-seg is-info[\s\S]*?Defaults <span class="status-strip-num">2<\/span>/);
    assert.doesNotMatch(case1, /border-radius:\s*999px/);
    // Motif appears once on the strip (Env only), not on every segment
    assert.strictEqual((case1.match(/tessra-mark--strip/g) || []).length, 1);

    // 2) Scripts disabled + History on
    const case2 = renderStatusStrip({
      scripts: { preRequest: 'x', test: '' },
      disableScripts: true,
      saveToHistory: true,
    });
    assert.match(case2, /status-strip-seg is-warn[\s\S]*?⚠[\s\S]*?Scripts off/);
    assert.match(case2, /status-strip-seg is-on[\s\S]*?✓[\s\S]*?History on/);

    // 3) History off
    const case3 = renderStatusStrip({ saveToHistory: false });
    assert.match(case3, /status-strip-seg is-off[\s\S]*?○[\s\S]*?History off/);
    assert.doesNotMatch(case3, /History on/);

    // 4) Defaults skipped
    const case4 = renderStatusStrip({ skipDefaultHeaders: true, saveToHistory: true });
    assert.match(case4, /status-strip-seg is-warn[\s\S]*?⚠[\s\S]*?Defaults skipped/);

    // 5) TLS insecure
    const case5 = renderStatusStrip({ tlsValidation: 'insecure', saveToHistory: true });
    assert.match(case5, /status-strip-seg is-warn[\s\S]*?⚠[\s\S]*?TLS insecure/);
    assert.match(case5, /data-priority="critical"/);

    // 6) Request usage is Used N (independent of env's 2 vars) and opens strip disclosure
    const case6 = renderStatusStrip({
      saveToHistory: true,
      __usage: [{ name: 'baseUrl' }],
    });
    assert.match(case6, /status-strip-env-count[\s\S]*?<span class="status-strip-num">2<\/span> vars/);
    assert.match(case6, /status-strip-seg is-info[\s\S]*?Used <span class="status-strip-num">1<\/span>/);
    assert.match(case6, /data-action="reveal-variable-usage"/);
    assert.match(case6, /aria-controls="statusStripVariableUsage"/);
    assert.match(case6, /data-priority="low"/);
    assert.doesNotMatch(case6, /status-strip-seg is-info[\s\S]*?Vars <span class="status-strip-num">1<\/span>/);

    // 6b) Multiple used vars still labeled Used
    const case6b = renderStatusStrip({
      saveToHistory: true,
      __usage: [{ name: 'baseUrl' }, { name: 'token' }, { name: 'tenant' }],
    });
    assert.match(case6b, /Used <span class="status-strip-num">3<\/span>/);

    // 6c) Unresolved Vars N is clickable into the same disclosure path
    const case6c = renderStatusStrip({
      saveToHistory: true,
      __unresolved: ['missingToken'],
      __usage: [{ name: 'missingToken' }],
    });
    assert.match(case6c, /data-action="reveal-variable-usage"[\s\S]*?Vars <span class="status-strip-num">1<\/span>/);

    // 7) Multiple simultaneous
    const case7 = renderStatusStrip({
      scripts: { preRequest: 'x', test: 'y' },
      disableScripts: true,
      saveToHistory: false,
      skipDefaultHeaders: true,
      tlsValidation: 'insecure',
      followRedirects: true,
      stopAfterHeaders: true,
      __usage: [{ name: 'host' }],
    });
    assert.match(case7, /Scripts off/);
    assert.match(case7, /History off/);
    assert.match(case7, /Defaults skipped/);
    assert.match(case7, /TLS insecure/);
    assert.match(case7, /Redirects/);
    assert.match(case7, /Headers only/);
    assert.match(case7, /Used <span class="status-strip-num">1<\/span>/);
    assert.match(case7, /status-strip-sep[\s\S]*?│/);

    // 8) Narrow-width strategy: priority attrs + container collapse CSS; env + critical before low-priority Used
    assert.match(case7, /data-priority="critical"/);
    assert.match(case7, /data-priority="high"/);
    assert.match(case7, /data-priority="medium"/);
    assert.match(case7, /data-priority="low"/);
    assert.match(htmlSource, /@container status-strip \(max-width: 480px\)[\s\S]*?data-priority="low"[\s\S]*?display:none/);
    assert.match(htmlSource, /\.status-strip-env-count\{display:none\}/);
    const envFirst = case7.indexOf('is-env');
    const tlsIdx = case7.indexOf('TLS insecure');
    const usedIdx = case7.indexOf('status-strip-num">1');
    assert.ok(envFirst >= 0 && envFirst < tlsIdx && tlsIdx < usedIdx, 'env and risk should precede low-priority Used');

    // 9) Env expand/collapse aria when editor is open
    vm.runInContext('envEditor = { classList: { contains: function() { return false; } } };', context);
    const case9 = renderStatusStrip({ saveToHistory: true });
    assert.match(case9, /data-action="edit-environment"[^>]*aria-expanded="true"/);
  });

  it('keeps the environment editor on-demand and restores Environment segment disclosure', () => {
    assert.match(html, /<div id="envEditor" class="env-editor hidden" data-testid="environment-disclosure">/);
    assert.doesNotMatch(html, /id="envEditorToggle"/);
    assert.doesNotMatch(html, /class="env-badge/);
    assert.match(html, /id="envEditorName">None<\/span>/);
    assert.match(html, /id="envEditorVarCount"/);
    assert.match(html, /id="envEditorBody"/);
    assert.match(html, /id="envVarRows"/);
    assert.match(html, /id="addEnvVarBtn"/);
    assert.match(script, /function revealEnvironmentEditor\(\)/);
    assert.match(script, /function hideEnvironmentEditor\(\)/);
    assert.match(script, /function toggleEnvironmentEditor\(\)/);
    assert.match(script, /function isEnvironmentEditorOpen\(\)/);
    assert.match(script, /function syncEnvironmentStripDisclosureState\(\)/);
    assert.match(script, /currentEnvName \? 'edit-environment' : 'switch-environment'/);
    assert.match(script, /tfCount\('environment\.vars', envEditorVariableCount\)/);
    assert.match(script, /tfCount\('webview\.stripUsedCount', usage\.length\)/);
    assert.match(script, /data-action="edit-environment"/);
    assert.match(script, /tr\('webview\.editEnvironmentVariables'\)/);
    assert.match(script, /setEnvironmentEditorData\(msg\.envId \|\| null, msg\.envName \|\| null, msg\.variables \|\| \[\]\)/);
    assert.match(script, /revealEnvironmentEditor\(\);/);
    assert.match(script, /toggleEnvironmentEditor\(\)/);
    assert.match(source, /variables,\s*profileName: RequestPanel\.storage\.getWorkspaceProfileName\(\)/);
    assert.ok(
      script.indexOf('const envEditorName = document.getElementById') < script.lastIndexOf('updateStaticLocalizedText();'),
      'initial localized text refresh should run after environment editor elements are bound'
    );
  });

  it('restores Variable Usage detail via status-strip disclosure (not a permanent card)', () => {
    assert.match(script, /data-action="reveal-variable-usage"/);
    assert.match(script, /function revealVariableUsageDisclosure\(\)/);
    assert.match(script, /function setStatusStripExpanded\(/);
    assert.match(script, /ariaControls:\s*'statusStripVariableUsage'/);
    assert.match(script, /aria-controls="/);
    assert.match(script, /js-status-strip-var-usage/);
    assert.match(script, /id="statusStripVariableUsage"/);
    assert.match(script, /js-variable-usage-wrap/);
    assert.match(script, /function renderVariableUsage\(tab\)/);
    assert.match(script, /var-usage-name/);
    assert.match(script, /var-usage-scope/);
    // Permanent compose-row card is gone; disclosure + Used N is the access path
    assert.match(script, /const requestInfoRowHtml = '';/);
    assert.doesNotMatch(script, /js-variable-usage-wrap visually-hidden/);
    assert.match(script, /action === 'reveal-variable-usage'/);
    assert.match(script, /js-status-strip-unresolved/);

    const expandHelpers = extractScriptSegment(
      script,
      'function renderStatusStripExpandDetails(tab)',
      'function renderStatusStrip(tab)'
    );
    const expandHarness = `
      var currentEnvName = 'staging';
      var currentWorkspaceProfile = 'default';
      var STRINGS = ${JSON.stringify({
        'webview.summaryEnvironment': 'Environment: {name}',
        'webview.noEnvironment': 'No environment',
        'webview.editEnvironmentVariables': 'Edit variables',
        'webview.openEnvironmentPicker': 'Switch environment',
        'webview.defaultHeaders': 'Default headers',
        'webview.profileDefaultTooltip': 'Default profile',
        'webview.profileCustomTooltip': 'Custom profile',
        'webview.variableUsageTitle': 'Variable usage',
        'webview.variableUsageCount': '{count} variables',
        'webview.unresolvedVariablesCount': '{count} unresolved',
        'webview.defaultHeadersApplied': '{count} applied',
        'webview.disableScriptsStatus': 'Scripts off',
        'webview.scriptsPresentStatus': 'Scripts',
        'webview.followRedirectsStatus': 'Redirects',
        'webview.stopAfterHeadersStatus': 'Headers only',
        'webview.saveToHistoryOffStatus': 'History off',
        'webview.skipDefaultHeadersStatus': 'Defaults skipped',
        'webview.tlsInsecureStatus': 'TLS insecure',
      })};
      function tr(key) { return Object.prototype.hasOwnProperty.call(STRINGS, key) ? STRINGS[key] : key; }
      function tf(key, params) {
        return tr(key).replace(/{([A-Za-z0-9_]+)}/g, function(_, name) {
          return Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params[name]) : '{' + name + '}';
        });
      }
      function tfCount(key, count) { return tf(key, { count: String(count) }); }
      function escapeHtml(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }
      function escapeAttr(s) { return escapeHtml(s); }
      function renderProfileIndicator(name) { return 'Profile: ' + name; }
      function collectVariableUsage(tab) { return tab && tab.__usage ? tab.__usage : []; }
      function getUnresolvedDraftVariableNames(tab) { return tab && tab.__unresolved ? tab.__unresolved : []; }
      function getAppliedDefaultHeaders(tab) { return tab && tab.__appliedDefaults ? tab.__appliedDefaults : []; }
      function hasExecutableScripts() { return false; }
      function normalizeTlsValidation() { return 'default'; }
      function renderVariableUsage(tab) {
        var usage = collectVariableUsage(tab);
        if (!usage.length) return '<div class="var-usage hidden"></div>';
        return '<div class="var-usage">' + usage.map(function(item) {
          return '<div class="var-usage-card"><span class="var-usage-name">{{' + escapeHtml(item.name) + '}}</span>' +
            '<div class="var-usage-scopes">' + (item.scopes || []).map(function(scope) {
              return '<span class="var-usage-scope">' + escapeHtml(scope) + '</span>';
            }).join('') + '</div></div>';
        }).join('') + '</div>';
      }
      function renderRequestPreflight() { return ''; }
      ${expandHelpers}
    `;
    const expandContext: Record<string, unknown> = {};
    vm.createContext(expandContext);
    vm.runInContext(expandHarness, expandContext);
    const renderExpand = expandContext.renderStatusStripExpandDetails as (tab: Record<string, unknown>) => string;
    const detail = renderExpand({
      saveToHistory: true,
      __usage: [{ name: 'baseUrl', scopes: ['URL', 'Headers'] }, { name: 'token', scopes: ['Auth'] }],
      __unresolved: ['token'],
    });
    assert.match(detail, /id="statusStripVariableUsage"/);
    assert.match(detail, /js-status-strip-var-usage/);
    assert.match(detail, /js-variable-usage-wrap/);
    assert.match(detail, /var-usage-name[\s\S]*?baseUrl/);
    assert.match(detail, /var-usage-scope[\s\S]*?URL/);
    assert.match(detail, /var-usage-name[\s\S]*?token/);
    assert.match(detail, /js-status-strip-unresolved/);
    assert.match(detail, /data-action="edit-environment"/);
    assert.match(detail, /data-action="switch-environment"/);
    assert.doesNotMatch(detail, /js-variable-usage-wrap visually-hidden/);
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
    assert.match(script, /js-request-preflight-wrap/);
    assert.match(script, /tfCount\('webview\.unresolvedVariablesCount', unresolved\.length\)/);
    assert.match(script, /function isSensitiveKeyName\(value\)/);
    assert.match(script, /class="kv-reveal/);
    assert.match(script, /class="ghost-btn auth-reveal js-auth-reveal"/);
    assert.match(script, /function parseBulkKeyValueText\(text, target\)/);
    assert.match(script, /function applyBulkEditor\(mc, target\)/);
    assert.match(script, /js-open-bulk-editor/);
    assert.match(script, /tab\.disableScripts \? 'settings:disable-scripts' : 'scripts:pre-request'/);
  });

  it('keeps URL field and Params query mirror in sync without double-serializing', () => {
    assert.match(script, /function syncParamsFromUrlInput\(mc\)/);
    assert.match(script, /function syncUrlFromParamsEditor\(mc\)/);
    assert.match(script, /function healParamsMirrorFromUrl\(mc\)/);
    assert.match(script, /function composeUrlWithParamsJs\(rawUrl, params\)/);
    assert.match(script, /syncParamsFromUrlInput\(mc\)/);
    assert.match(script, /syncUrlFromParamsEditor\(mc\)/);
    assert.match(script, /healParamsMirrorFromUrl\(mc\)/);
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
      'function triggerSaveFromShortcut'
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

  it('renders a compact script help one-liner with Guide link and Quiet Instrument chrome', () => {
    assert.match(script, /function renderScriptHelpers\(_tab\)/);
    assert.match(script, /class="script-help-line"/);
    assert.match(script, /tr\('webview\.scriptHelpOneLiner'\)/);
    assert.match(script, /js-open-script-guide/);
    assert.match(script, /tr\('webview\.emptyActionGuide'\)/);
    assert.match(script, /type: 'openGuide'/);
    assert.doesNotMatch(script, /class="script-helper-shell/);
    assert.doesNotMatch(script, /class="script-helper-stepper"/);
    assert.doesNotMatch(script, /class="script-helper-card/);
    assert.doesNotMatch(htmlSource, /\.default-headers-banner-title\{[^}]*text-transform:uppercase/);
    assert.match(script, /data-template="testCaptureValue"/);
    assert.match(htmlSource, /\.req-area\{flex:1 1 0;min-height:0;overflow:hidden;padding:2px 8px;display:flex;flex-direction:column\}/);
    assert.match(htmlSource, /\.url-bar\{display:flex;flex-wrap:wrap;gap:6px;/);
    assert.match(htmlSource, /\.url-primary-group\{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 200px\}/);
    assert.match(htmlSource, /\.url-action-group\{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex:0 0 auto;margin-left:auto\}/);
    assert.match(htmlSource, /\.url-hero-actions\{display:flex;align-items:stretch;justify-content:flex-end;flex:0 0 auto\}/);
    assert.match(htmlSource, /\.status-strip\{display:flex;flex-direction:column;/);
    assert.match(htmlSource, /\.response-summary-card\{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:2px 0;[\s\S]*flex-wrap:nowrap;min-width:0\}/);
    assert.match(htmlSource, /\.response-stat-inline\{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;font-size:13px;font-weight:700;/);
    assert.match(htmlSource, /\.response-action-cluster\{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:nowrap;flex:0 0 auto\}/);
    assert.match(htmlSource, /\.actions-more-menu\{display:none;position:absolute;/);
    assert.match(htmlSource, /\.actions-more-menu\.actions-more-menu-fixed\{position:fixed;right:auto;bottom:auto\}/);
    assert.match(script, /function placeActionsMoreMenu\(button, menu\)/);
    assert.match(script, /function clearActionsMoreMenuPlacement\(menu\)/);
    assert.match(script, /class="url-action-group"/);
    assert.match(script, /data-testid="request-overflow"/);
    assert.match(script, /data-testid="request-overflow-menu"/);
    assert.match(htmlSource, /\.divider-grip\{position:relative;z-index:1;display:inline-flex;align-items:center;gap:3px;padding:1px 6px;/);
    assert.match(htmlSource, /\.json-body\{background:var\(--vscode-editor-background\);padding:8px 10px;border-radius:2px;/);
    assert.match(htmlSource, /\.runner-row\.method-GET::before\{background:linear-gradient\(180deg,rgba\(78,201,78,.8\),rgba\(78,201,78,.18\)\)\}/);
    assert.match(htmlSource, /\.env-editor\.linked-focus-active(?:,[^{]+)?\{border-color:var\(--vscode-focusBorder\)\}/);
    assert.match(htmlSource, /\.status-strip-detail-block\.linked-focus-active/);
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
    // 실행 중단 여부와 저장 설정을 확인한 뒤 execution context까지 전달하는 계약을 검증한다.
    assert.match(collectionRunnerSource, /if \(!isStopped\(\) && settings\.saveToHistory && historyRequest\) \{/);
    assert.match(collectionRunnerSource, /this\.host\.saveToHistory\([\s\S]*?historyRequest,[\s\S]*?response \? \{ status: response\.status, statusText: response\.statusText, time: response\.time \} : null,[\s\S]*?createRequestTiming\(requestStartedAt\),[\s\S]*?input\.context/);
    assert.match(collectionRunnerSource, /this\.host\.refreshHistory\(\);/);
  });

  it('renders collection runner options before starting a run', () => {
    assert.match(source, /private pendingCollectionRun: \{ name: string; items: CollectionItem\[\] \} \| null = null;/);
    assert.match(source, /type: MessageType\.ConfigureCollectionRun/);
    assert.match(source, /case MessageType\.StartCollectionRun:/);
    assert.match(source, /selectedRequestIds/);
    assert.match(source, /flattenCollectionRunEntries/);
    assert.match(script, /function showRunnerSetup\(msg\)/);
    assert.match(script, /function normalizeRunnerRequestChoices\(msg\)/);
    assert.match(script, /type: 'startCollectionRun'/);
    assert.match(script, /selectedRequestIds:\s*selectedRequestIds/);
    assert.match(script, /tr\('webview\.runDelayMs'\)/);
    assert.match(script, /tr\('webview\.runIterations'\)/);
    assert.match(script, /tr\('webview\.runStopOnFailure'\)/);
    assert.match(script, /tr\('webview\.runRequests'\)/);
    assert.match(script, /tr\('webview\.runSelectAll'\)/);
    assert.match(script, /tr\('webview\.runClearSelection'\)/);
    assert.match(script, /tr\('webview\.runSelectAtLeastOne'\)/);
    assert.match(script, /class="js-runner-request-check"/);
    assert.match(script, /data-request-id=/);
    assert.match(script, /startBtn\.disabled = noneSelected/);
    assert.match(htmlSource, /\.runner-request-select\{/);
    assert.match(htmlSource, /\.runner-request-list\{/);
    assert.match(collectionRunnerSource, /export function flattenCollectionRunEntries/);
    assert.match(collectionRunnerSource, /export function filterCollectionRunEntriesBySelection/);
    assert.match(collectionRunnerSource, /selectedRequestIds/);
    assert.match(collectionRunnerSource, /collectionTotal/);
    assert.match(collectionRunnerSource, /selectedTotal/);
  });
});
