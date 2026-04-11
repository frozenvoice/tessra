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

describe('package localization files', () => {
  it('keeps the Korean package command labels localized for recent UI settings commands', () => {
    const ko = readPackageLocalization('package.nls.ko.json');

    assert.strictEqual(ko['command.changeDisplayLanguage'], 'Arc: 표시 언어 변경');
    assert.strictEqual(ko['command.changeRequestPanelTheme'], 'Arc: 요청 패널 테마 변경');
    assert.strictEqual(ko['command.changeWorkspaceProfile'], 'Arc: 워크스페이스 프로필 변경');
  });

  it('ships a Japanese package localization file for extension settings and commands', () => {
    const ja = readPackageLocalization('package.nls.ja.json');

    assert.strictEqual(ja['configuration.requestPanelTheme.description'].includes('リクエストパネル'), true);
    assert.strictEqual(ja['command.changeRequestPanelTheme'], 'Arc: リクエストパネルテーマを変更');
    assert.strictEqual(ja['view.history'], '履歴');
  });
});
