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
    const overriddenMatches = source.match(/'webview\.defaultHeadersOverridden':/g) ?? [];
    const appliedLabelMatches = source.match(/'webview\.defaultHeadersAppliedLabel':/g) ?? [];
    const overriddenLabelMatches = source.match(/'webview\.defaultHeadersOverriddenLabel':/g) ?? [];
    const skippedMatches = source.match(/'webview\.defaultHeadersSkippedState':/g) ?? [];
    const emptyMatches = source.match(/'webview\.defaultHeadersEmptyState':/g) ?? [];
    const manageMatches = source.match(/'webview\.manage':/g) ?? [];

    assert.strictEqual(appliedMatches.length, 3);
    assert.strictEqual(overriddenMatches.length, 3);
    assert.strictEqual(appliedLabelMatches.length, 3);
    assert.strictEqual(overriddenLabelMatches.length, 3);
    assert.strictEqual(skippedMatches.length, 3);
    assert.strictEqual(emptyMatches.length, 3);
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
});
