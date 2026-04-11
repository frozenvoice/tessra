import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readGuidePanelSource(): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../../../src/panels/GuidePanel.ts'),
    'utf8'
  );
}

describe('GuidePanel source', () => {
  let source: string;

  before(() => {
    source = readGuidePanelSource();
  });

  it('loads dedicated guide files instead of README files for the in-app guide', () => {
    assert.match(source, /path\.join\(this\.extensionUri\.fsPath, 'GUIDE\.ko\.md'\)/);
    assert.match(source, /path\.join\(this\.extensionUri\.fsPath, `GUIDE\.\$\{language\}\.md`\)/);
    assert.match(source, /path\.join\(this\.extensionUri\.fsPath, 'GUIDE\.md'\)/);
    assert.doesNotMatch(source, /README\.ko\.md/);
    assert.doesNotMatch(source, /path\.join\(this\.extensionUri\.fsPath, 'README\.md'\)/);
  });

  it('ships localized guide files for the supported non-English languages', () => {
    assert.ok(fs.existsSync(path.resolve(__dirname, '../../../../GUIDE.ko.md')));
    assert.ok(fs.existsSync(path.resolve(__dirname, '../../../../GUIDE.ja.md')));
  });
});
