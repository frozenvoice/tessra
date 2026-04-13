import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readPackageLocalization(filename: string): Record<string, string> {
  return JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../../', filename),
      'utf8'
    )
  ) as Record<string, string>;
}

function readPackageManifest(): Record<string, any> {
  return JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../../package.json'),
      'utf8'
    )
  ) as Record<string, any>;
}

describe('package localization files', () => {
  it('uses localized enum item labels for settings dropdowns', () => {
    const manifest = readPackageManifest();
    const properties = manifest.contributes.configuration.properties;

    assert.deepStrictEqual(properties['arc-client.displayLanguage'].enumItemLabels, [
      '%configuration.displayLanguage.enumLabel.en%',
      '%configuration.displayLanguage.enumLabel.ko%',
      '%configuration.displayLanguage.enumLabel.ja%',
    ]);
    assert.deepStrictEqual(properties['arc-client.requestPanelTheme'].enumItemLabels, [
      '%configuration.requestPanelTheme.enumLabel.default%',
      '%configuration.requestPanelTheme.enumLabel.minimalCool%',
      '%configuration.requestPanelTheme.enumLabel.product%',
      '%configuration.requestPanelTheme.enumLabel.boldColor%',
    ]);
  });

  it('keeps the Korean package localization consistent across settings, commands, and views', () => {
    const ko = readPackageLocalization('package.nls.ko.json');

    assert.strictEqual(ko['configuration.displayLanguage.description'].includes('VS Code 설정 레이블'), true);
    assert.strictEqual(ko['configuration.workspaceProfile.description'].includes('워크스페이스 로컬 저장 프로필'), true);
    assert.strictEqual(ko['configuration.displayLanguage.enumLabel.ko'], '한국어');
    assert.strictEqual(ko['configuration.requestPanelTheme.enumLabel.default'], '기본');
    assert.strictEqual(ko['command.changeDisplayLanguage'], 'Arc: 표시 언어 변경');
    assert.strictEqual(ko['command.changeRequestPanelTheme'], 'Arc: 요청 패널 테마 변경');
    assert.strictEqual(ko['command.changeWorkspaceProfile'], 'Arc: 워크스페이스 프로필 변경');
    assert.strictEqual(ko['command.importCollection'], 'Arc: 컬렉션 가져오기');
    assert.strictEqual(ko['view.collections'], '컬렉션');
    assert.strictEqual(ko['view.history'], '히스토리');
  });

  it('ships a Japanese package localization file for extension settings and commands', () => {
    const ja = readPackageLocalization('package.nls.ja.json');

    assert.strictEqual(ja['configuration.displayLanguage.description'].includes('設定ラベル'), true);
    assert.strictEqual(ja['configuration.displayLanguage.enumLabel.ja'], '日本語');
    assert.strictEqual(ja['configuration.requestPanelTheme.enumLabel.product'], 'プロダクト感強め');
    assert.strictEqual(ja['configuration.requestPanelTheme.description'].includes('リクエストパネル'), true);
    assert.strictEqual(ja['command.changeRequestPanelTheme'], 'Arc: リクエストパネルテーマを変更');
    assert.strictEqual(ja['view.history'], '履歴');
  });
});
