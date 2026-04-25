import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readLocalizationSource(): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../../../src/services/LocalizationService.ts'),
    'utf8'
  );
}

describe('LocalizationService source', () => {
  let source: string;

  before(() => {
    source = readLocalizationSource();
  });

  it('only exposes display languages that have maintained translations', () => {
    assert.match(
      source,
      /export const SUPPORTED_DISPLAY_LANGUAGES = \[\s*'en',\s*'ko',\s*'ja',\s*\] as const;/
    );
    assert.match(
      source,
      /export const SUPPORTED_REQUEST_PANEL_THEMES = \[\s*'default',\s*'minimal-cool',\s*'product',\s*'bold-color',\s*\] as const;/
    );
  });

  it('keeps dirty-close and file-picker strings translated for every supported language', () => {
    assert.match(source, /'panel\.selectFile': 'Select File'/);
    assert.match(source, /'panel\.selectFile': '파일 선택'/);
    assert.match(source, /'panel\.selectFile': 'ファイルを選択'/);
    assert.match(source, /'webview\.discard': 'Discard'/);
    assert.match(source, /'webview\.discard': '저장 안 함'/);
    assert.match(source, /'webview\.discard': '破棄'/);
    assert.match(source, /'webview\.unsavedClosePrompt': 'There are unsaved changes\. Close this tab\?'/);
    assert.match(source, /'webview\.unsavedClosePrompt': '저장되지 않은 변경사항이 있습니다\. 이 탭을 닫을까요\?'/);
    assert.match(source, /'webview\.unsavedClosePrompt': '未保存の変更があります。このタブを閉じますか？'/);
  });

  it('keeps tree view titles translated for every supported language', () => {
    assert.match(source, /'view\.collections': 'Collections'/);
    assert.match(source, /'view\.environments': 'Environments'/);
    assert.match(source, /'view\.history': 'History'/);
    assert.match(source, /'view\.collections': '컬렉션'/);
    assert.match(source, /'view\.environments': '환경'/);
    assert.match(source, /'view\.history': '히스토리'/);
    assert.match(source, /'view\.collections': 'コレクション'/);
    assert.match(source, /'view\.environments': '環境'/);
    assert.match(source, /'view\.history': '履歴'/);
  });
  it('keeps default-header visibility copy translated for every supported language', () => {
    const appliedMatches = source.match(/'webview\.defaultHeadersApplied':/g) ?? [];
    const statusMatches = source.match(/'webview\.defaultHeadersStatus':/g) ?? [];
    const overriddenMatches = source.match(/'webview\.defaultHeadersOverridden':/g) ?? [];
    const appliedLabelMatches = source.match(/'webview\.defaultHeadersAppliedLabel':/g) ?? [];
    const overriddenLabelMatches = source.match(/'webview\.defaultHeadersOverriddenLabel':/g) ?? [];
    const skippedMatches = source.match(/'webview\.defaultHeadersSkippedState':/g) ?? [];
    const skippedStatusMatches = source.match(/'webview\.skipDefaultHeadersStatus':/g) ?? [];
    const emptyMatches = source.match(/'webview\.defaultHeadersEmptyState':/g) ?? [];
    const noEnvironmentMatches = source.match(/'webview\.noEnvironment':/g) ?? [];
    const disableScriptsStatusMatches = source.match(/'webview\.disableScriptsStatus':/g) ?? [];
    const historyOffStatusMatches = source.match(/'webview\.saveToHistoryOffStatus':/g) ?? [];
    const manageMatches = source.match(/'webview\.manage':/g) ?? [];

    assert.strictEqual(appliedMatches.length, 3);
    assert.strictEqual(statusMatches.length, 3);
    assert.strictEqual(overriddenMatches.length, 3);
    assert.strictEqual(appliedLabelMatches.length, 3);
    assert.strictEqual(overriddenLabelMatches.length, 3);
    assert.strictEqual(skippedMatches.length, 3);
    assert.strictEqual(skippedStatusMatches.length, 3);
    assert.strictEqual(emptyMatches.length, 3);
    assert.strictEqual(noEnvironmentMatches.length, 3);
    assert.strictEqual(disableScriptsStatusMatches.length, 3);
    assert.strictEqual(historyOffStatusMatches.length, 3);
    assert.strictEqual(manageMatches.length, 3);
  });

  it('keeps offline HTML preview copy translated for every supported language', () => {
    const titleMatches = source.match(/'webview\.previewOfflineTitle':/g) ?? [];
    const copyMatches = source.match(/'webview\.previewOfflineCopy':/g) ?? [];
    const sourceMatches = source.match(/'webview\.previewOfflineSource':/g) ?? [];
    const descriptionMatches = source.match(/'webview\.previewOfflineDescription':/g) ?? [];
    const blockedMatches = source.match(/'webview\.previewOfflineBlockedAssets':/g) ?? [];
    const snapshotMatches = source.match(/'webview\.previewOfflineStaticSnapshot':/g) ?? [];
    const emptyMatches = source.match(/'webview\.previewOfflineNoStatic':/g) ?? [];

    assert.strictEqual(titleMatches.length, 3);
    assert.strictEqual(copyMatches.length, 3);
    assert.strictEqual(sourceMatches.length, 3);
    assert.strictEqual(descriptionMatches.length, 3);
    assert.strictEqual(blockedMatches.length, 3);
    assert.strictEqual(snapshotMatches.length, 3);
    assert.strictEqual(emptyMatches.length, 3);
  });

  it('keeps HTML preview actions translated for every supported language', () => {
    const openUrlMatches = source.match(/'webview\.openUrl':/g) ?? [];
    const failedOpenUrlMatches = source.match(/'panel\.failedOpenUrl':/g) ?? [];

    assert.strictEqual(openUrlMatches.length, 3);
    assert.strictEqual(failedOpenUrlMatches.length, 3);
  });

  it('keeps response search copy translated for every supported language', () => {
    const placeholderMatches = source.match(/'webview\.searchPlaceholder':/g) ?? [];
    const caseMatches = source.match(/'webview\.searchCaseSensitive':/g) ?? [];
    const regexMatches = source.match(/'webview\.searchRegex':/g) ?? [];
    const prevMatches = source.match(/'webview\.searchPrev':/g) ?? [];
    const nextMatches = source.match(/'webview\.searchNext':/g) ?? [];
    const clearMatches = source.match(/'webview\.searchClear':/g) ?? [];
    const countMatches = source.match(/'webview\.searchCount':/g) ?? [];
    const emptyMatches = source.match(/'webview\.searchNoMatches':/g) ?? [];

    assert.strictEqual(placeholderMatches.length, 3);
    assert.strictEqual(caseMatches.length, 3);
    assert.strictEqual(regexMatches.length, 3);
    assert.strictEqual(prevMatches.length, 3);
    assert.strictEqual(nextMatches.length, 3);
    assert.strictEqual(clearMatches.length, 3);
    assert.strictEqual(countMatches.length, 3);
    assert.strictEqual(emptyMatches.length, 3);
  });

  it('keeps response timing labels translated for every supported language', () => {
    const keys = [
      'webview.requestedAt',
      'webview.receivedAt',
      'webview.endedAt',
    ];

    for (const key of keys) {
      const matches = source.match(new RegExp(`'${key.replace(/\./g, '\\.')}'\\s*:`, 'g')) ?? [];
      assert.strictEqual(matches.length, 3, `${key} should exist for every supported language`);
    }
  });

  it('keeps imported-script trust warnings translated for every supported language', () => {
    const keys = [
      'panel.importedScriptsBlocked',
      'webview.importedScriptsTrustPrompt',
    ];

    for (const key of keys) {
      const matches = source.match(new RegExp(`'${key.replace(/\./g, '\\.')}'\\s*:`, 'g')) ?? [];
      assert.strictEqual(matches.length, 3, `${key} should exist for every supported language`);
    }
  });

  it('keeps preflight, masking, and runner status copy translated for every supported language', () => {
    const keys = [
      'webview.summaryEnvironment',
      'webview.environmentNone',
      'webview.summaryProfile',
      'webview.profileDefaultTooltip',
      'webview.profileCustomTooltip',
      'webview.summaryAuth',
      'webview.summaryHeaders',
      'webview.summaryParams',
      'webview.summaryScriptsOn',
      'webview.summaryScriptsOff',
      'webview.summaryHistoryOn',
      'webview.summaryHistoryOff',
      'webview.followRedirectsStatus',
      'webview.stopAfterHeadersStatus',
      'webview.unresolvedVariablesCount',
      'webview.openEnvironmentPicker',
      'webview.reviewRequestInputs',
      'webview.authSummaryNone',
      'webview.authSummaryBasic',
      'webview.authSummaryBearer',
      'webview.authSummaryApiKeyHeader',
      'webview.authSummaryApiKeyQuery',
      'webview.bulkPaste',
      'webview.bulkPasteParams',
      'webview.bulkPasteParamsPlaceholder',
      'webview.bulkPasteHeaders',
      'webview.bulkPasteHeadersPlaceholder',
      'webview.apply',
      'webview.revealValue',
      'webview.hideValue',
      'webview.revealShort',
      'webview.hideShort',
      'webview.variableAutocompleteTitle',
      'webview.variableAutocompleteEmpty',
      'webview.scriptHelpTitle',
      'webview.scriptHelpRuntimeTitle',
      'webview.scriptHelpRuntimeCopy',
      'webview.scriptHelpStepperTitle',
      'webview.scriptHelpCollapse',
      'webview.scriptHelpExpand',
      'webview.scriptHelpCollapsedCopy',
      'webview.scriptHelpWhenTitle',
      'webview.scriptHelpRuntimeWhen',
      'webview.scriptHelpStageFixed',
      'webview.scriptHelpStageSend',
      'webview.scriptHelpStageTest',
      'webview.scriptHelpStageReuse',
      'webview.scriptHelpRuleFixed',
      'webview.scriptHelpRuleDerived',
      'webview.scriptHelpRulePreRequest',
      'webview.scriptHelpSequenceTitle',
      'webview.scriptHelpSequencePre',
      'webview.scriptHelpSequenceSend',
      'webview.scriptHelpSequenceTest',
      'webview.scriptHelpSequencePersist',
      'webview.scriptHelpFlowTitle',
      'webview.scriptHelpFlowCopy',
      'webview.scriptHelpRequestOne',
      'webview.scriptHelpRequestTwo',
      'webview.scriptHelpInsertPreRequest',
      'webview.scriptHelpInsertCapture',
      'webview.scriptHelpInsertStatus',
      'webview.runSending',
      'webview.runRetrying',
      'webview.runAttempt',
      'webview.runRetryDelay',
      'webview.runRerunFailed',
      'webview.compareFoldUnchanged',
      'webview.inserted',
    ];

    for (const key of keys) {
      const matches = source.match(new RegExp(`'${key.replace(/\./g, '\\.')}'\\s*:`, 'g')) ?? [];
      assert.strictEqual(matches.length, 3, `${key} should exist for every supported language`);
    }
  });

  it('keeps workspace-profile guidance translated for every supported language', () => {
    const keys = [
      'info.workspaceProfileCreated',
      'info.workspaceProfileFirstCreated',
      'picker.workspaceProfileDefaultDescription',
    ];

    for (const key of keys) {
      const matches = source.match(new RegExp(`'${key.replace(/\./g, '\\.')}'\\s*:`, 'g')) ?? [];
      assert.strictEqual(matches.length, 3, `${key} should exist for every supported language`);
    }
  });

  it('keeps request-panel theme picker guidance translated for every supported language', () => {
    const keys = [
      'picker.selectRequestPanelTheme',
      'info.requestPanelThemeUpdated',
    ];

    for (const key of keys) {
      const matches = source.match(new RegExp(`'${key.replace(/\./g, '\\.')}'\\s*:`, 'g')) ?? [];
      assert.strictEqual(matches.length, 3, `${key} should exist for every supported language`);
    }

    assert.match(source, /const REQUEST_PANEL_THEME_LABELS: Record<RequestPanelTheme, Record<DisplayLanguage, string>> = \{/);
    assert.match(source, /public static getRequestPanelTheme\(\): RequestPanelTheme \{/);
    assert.match(source, /public static getRequestPanelThemeLabel\(/);
  });

  it('keeps storage corruption warnings translated for every supported language', () => {
    const matches = source.match(/'warn\.storageJsonCorrupt':/g) ?? [];
    assert.strictEqual(matches.length, 3);
  });
});
