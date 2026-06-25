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

  it('updates tree view titles from the Tessra display language setting', () => {
    assert.match(source, /function updateLocalizedViewTitles\(\): void \{/);
    assert.match(source, /collectionTreeView\.title = t\('view\.collections'\);/);
    assert.match(source, /environmentTreeView\.title = t\('view\.environments'\);/);
    assert.match(source, /historyTreeView\.title = t\('view\.history'\);/);
    assert.match(source, /updateLocalizedViewTitles\(\);/);
    assert.match(source, /const displayLanguageChanged = event\.affectsConfiguration\('tessra\.displayLanguage'\);/);
    assert.match(source, /if \(displayLanguageChanged\) \{[\s\S]*updateLocalizedViewTitles\(\);/);
  });

  it('resolves active environment variables before copying collection requests as cURL', () => {
    assert.match(source, /RequestExportService\.resolve\(node\.item\.request, environmentProvider\.getActiveVariables\(\), \{/);
    assert.match(source, /defaultHeaders:\s*storage\.getDefaultHeaders\(\)/);
    assert.match(source, /skipDefaultHeaders:\s*node\.item\.request\.skipDefaultHeaders === true/);
  });

  it('registers dedicated OpenAPI import, request panel theme, and workspace profile commands', () => {
    assert.match(source, /registerCommand\('tessra\.importOpenApi'/);
    assert.match(source, /ImportExportService\.importOpenApiDocuments\(openApiDocuments\)/);
    assert.match(source, /registerCommand\('tessra\.importEnvironment'/);
    assert.match(source, /ImportExportService\.importPostmanEnvironmentDocument\(item\)/);
    assert.match(source, /createUniqueImportedEnvironmentName\(environment\.name, environments\)/);
    assert.match(source, /registerCommand\('tessra\.changeRequestPanelTheme'/);
    assert.match(source, /SUPPORTED_REQUEST_PANEL_THEMES\.map\(\(theme\)/);
    assert.match(source, /picker\.selectRequestPanelTheme/);
    assert.match(source, /info\.requestPanelThemeUpdated/);
    assert.match(source, /update\(\s*'requestPanelTheme'/);
    assert.match(source, /registerCommand\('tessra\.changeWorkspaceProfile'/);
    assert.match(source, /picker\.workspaceProfileDefaultDescription/);
    assert.match(source, /info\.workspaceProfileCreated/);
    assert.match(source, /info\.workspaceProfileFirstCreated/);
    assert.match(source, /RequestPanel\.flushCurrentPanelState\(\)/);
    assert.match(source, /update\(\s*'workspaceProfile'/);
  });

  it('registers workspace backup export and import commands with validation and refresh', () => {
    assert.match(source, /registerCommand\('tessra\.exportWorkspaceBackup'/);
    assert.match(source, /storage\.exportWorkspaceBackup\(getTessraVersion\(\)\)/);
    assert.match(source, /getWorkspaceBackupDefaultName\(\)/);
    assert.match(source, /warn\.workspaceBackupSecrets/);
    assert.match(source, /registerCommand\('tessra\.importWorkspaceBackup'/);
    assert.match(source, /storage\.validateWorkspaceBackup\(backup\)/);
    assert.match(source, /warn\.workspaceBackupImportConfirm/);
    assert.match(source, /storage\.importWorkspaceBackup\(backup, getTessraVersion\(\)\)/);
    assert.match(source, /refreshWorkspaceScopedState\(\{ reloadPanel: true \}\)/);
    assert.match(source, /info\.importedWorkspaceBackup/);
  });

  it('opens the Tessra history retention setting from a dedicated command', () => {
    assert.match(source, /registerCommand\('tessra\.openHistorySettings'/);
    assert.match(source, /executeCommand\('workbench\.action\.openSettings', 'tessra\.historyMaxItems'\)/);
  });

  it('marks imported scripts as untrusted until the user reviews them', () => {
    assert.match(source, /function hasImportedScripts\(scripts: RequestScripts\): boolean \{/);
    assert.match(source, /const scripts = normalizeImportedScripts\(value\.scripts\);/);
    assert.match(source, /const hasScripts = hasImportedScripts\(scripts\);/);
    assert.match(source, /disableScripts: hasScripts,/);
    assert.match(source, /scriptsTrusted: hasScripts \? false : true,/);
  });

  it('refreshes the current panel when the request panel theme changes and reloads storage when the workspace profile changes', () => {
    assert.match(source, /const inspected = config\.inspect<string>\('requestPanelTheme'\);/);
    assert.match(source, /if \(inspected\.globalValue === 'glossy'\) \{/);
    assert.match(source, /config\.update\('requestPanelTheme', 'default', vscode\.ConfigurationTarget\.Global\)/);
    assert.match(source, /if \(inspected\.workspaceValue === 'glossy'\) \{/);
    assert.match(source, /config\.update\('requestPanelTheme', 'default', vscode\.ConfigurationTarget\.Workspace\)/);
    assert.match(source, /const requestPanelThemeChanged = event\.affectsConfiguration\('tessra\.requestPanelTheme'\);/);
    assert.match(source, /if \(!displayLanguageChanged && !requestPanelThemeChanged && !workspaceProfileChanged\) \{ return; \}/);
    assert.match(source, /if \(displayLanguageChanged \|\| requestPanelThemeChanged\) \{[\s\S]*RequestPanel\.refreshCurrentPanel\(\);/);
    assert.match(source, /event\.affectsConfiguration\('tessra\.workspaceProfile'\)/);
    assert.match(source, /refreshWorkspaceScopedState\(\{ reloadPanel: true \}\);/);
    assert.match(source, /RequestPanel\.reloadCurrentPanelForStorageChange\(\)/);
  });
});
