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
    assert.match(source, /const displayLanguageChanged = event\.affectsConfiguration\('arc-client\.displayLanguage'\);/);
    assert.match(source, /if \(displayLanguageChanged\) \{[\s\S]*updateLocalizedViewTitles\(\);/);
  });

  it('resolves active environment variables before copying collection requests as cURL', () => {
    assert.match(source, /RequestExportService\.resolve\(node\.item\.request, environmentProvider\.getActiveVariables\(\), \{/);
    assert.match(source, /defaultHeaders:\s*storage\.getDefaultHeaders\(\)/);
    assert.match(source, /skipDefaultHeaders:\s*node\.item\.request\.skipDefaultHeaders === true/);
  });

  it('registers dedicated OpenAPI import and workspace profile commands', () => {
    assert.match(source, /registerCommand\('arc\.importOpenApi'/);
    assert.match(source, /ImportExportService\.importOpenApiDocuments\(openApiDocuments\)/);
    assert.match(source, /registerCommand\('arc\.changeWorkspaceProfile'/);
    assert.match(source, /picker\.workspaceProfileDefaultDescription/);
    assert.match(source, /info\.workspaceProfileCreated/);
    assert.match(source, /info\.workspaceProfileFirstCreated/);
    assert.match(source, /RequestPanel\.flushCurrentPanelState\(\)/);
    assert.match(source, /update\(\s*'workspaceProfile'/);
  });

  it('reloads workspace-scoped state when the workspace profile changes', () => {
    assert.match(source, /event\.affectsConfiguration\('arc-client\.workspaceProfile'\)/);
    assert.match(source, /refreshWorkspaceScopedState\(\{ reloadPanel: true \}\);/);
    assert.match(source, /RequestPanel\.reloadCurrentPanelForStorageChange\(\)/);
  });
});
