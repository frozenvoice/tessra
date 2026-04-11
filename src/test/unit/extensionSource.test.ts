import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readExtensionSource(): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../../../src/extension.ts'),
    'utf8'
  );
}

describe('extension source', () => {
  let source: string;

  before(() => {
    source = readExtensionSource();
  });

  it('updates tree view titles from the Arc display language setting', () => {
    assert.match(source, /function updateLocalizedViewTitles\(\): void \{/);
    assert.match(source, /collectionTreeView\.title = t\('view\.collections'\);/);
    assert.match(source, /environmentTreeView\.title = t\('view\.environments'\);/);
    assert.match(source, /historyTreeView\.title = t\('view\.history'\);/);
    assert.match(source, /updateLocalizedViewTitles\(\);/);
    assert.match(source, /if \(!event\.affectsConfiguration\('arc-client\.displayLanguage'\)\) \{ return; \}[\s\S]*updateLocalizedViewTitles\(\);/);
  });

  it('resolves active environment variables before copying collection requests as cURL', () => {
    assert.match(source, /RequestExportService\.resolve\(node\.item\.request, environmentProvider\.getActiveVariables\(\), \{/);
    assert.match(source, /defaultHeaders:\s*storage\.getDefaultHeaders\(\)/);
    assert.match(source, /skipDefaultHeaders:\s*node\.item\.request\.skipDefaultHeaders === true/);
  });
});
