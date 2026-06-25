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
  it('uses Tessra settings keys with localized enum item labels', () => {
    const manifest = readPackageManifest();
    const properties = manifest.contributes.configuration.properties;

    assert.ok(properties['tessra.displayLanguage']);
    assert.ok(properties['tessra.requestPanelTheme']);
    assert.strictEqual(properties['tessra.historyMaxItems'].default, 500);
    assert.strictEqual(properties['tessra.historyMaxItems'].minimum, 50);
    assert.strictEqual(properties['tessra.historyMaxItems'].maximum, 5000);
    const legacyDisplayLanguageKey = ['a' + 'rc', 'client'].join('-') + '.displayLanguage';
    assert.strictEqual(properties[legacyDisplayLanguageKey], undefined);
    assert.deepStrictEqual(properties['tessra.displayLanguage'].enumItemLabels, [
      '%configuration.displayLanguage.enumLabel.en%',
      '%configuration.displayLanguage.enumLabel.ko%',
      '%configuration.displayLanguage.enumLabel.ja%',
    ]);
    assert.deepStrictEqual(properties['tessra.requestPanelTheme'].enumItemLabels, [
      '%configuration.requestPanelTheme.enumLabel.default%',
      '%configuration.requestPanelTheme.enumLabel.minimalCool%',
      '%configuration.requestPanelTheme.enumLabel.product%',
      '%configuration.requestPanelTheme.enumLabel.boldColor%',
    ]);
  });

  it('keeps package metadata and command titles branded as Tessra', () => {
    const manifest = readPackageManifest();
    const en = readPackageLocalization('package.nls.json');

    assert.strictEqual(manifest.name, 'tessra');
    assert.strictEqual(manifest.displayName, 'Tessra - API Client');
    assert.strictEqual(
      manifest.description,
      'A streamlined, offline-first API testing tool for VS Code. No login, no cloud, no limits.'
    );
    assert.strictEqual(en.displayName, 'Tessra - API Client');
    assert.strictEqual(en['command.changeDisplayLanguage'], 'Tessra: Change Display Language');
    assert.strictEqual(en['command.changeRequestPanelTheme'], 'Tessra: Change Request Panel Theme');
    assert.strictEqual(en['command.changeWorkspaceProfile'], 'Tessra: Change Workspace Profile');
    assert.strictEqual(en['command.importData'], 'Tessra: Import...');
    assert.strictEqual(en['command.importCollection'], 'Tessra: Import Collection');
    assert.strictEqual(en['command.importEnvironment'], 'Tessra: Import Environment');
    assert.strictEqual(en['command.exportCollection'], 'Tessra: Export Collection');
    assert.strictEqual(en['command.exportEnvironment'], 'Tessra: Export Environment');
    assert.strictEqual(en['command.exportWorkspaceBackup'], 'Tessra: Export Workspace Backup');
    assert.strictEqual(en['command.importWorkspaceBackup'], 'Tessra: Import Workspace Backup');
    assert.strictEqual(en['command.openHistorySettings'], 'Tessra: Open History Settings');
    assert.match(en['configuration.historyMaxItems.description'], /non-pinned history entries/);
    assert.match(en['configuration.historyMaxItems.description'], /Pinned entries are preserved/);
  });

  it('contributes import and export commands from the expected palette and tree menus', () => {
    const manifest = readPackageManifest();
    const commands = manifest.contributes.commands as Array<{ command: string; title: string }>;
    const titleMenus = manifest.contributes.menus['view/title'] as Array<{
      command: string;
      when: string;
      group: string;
    }>;
    const contextMenus = manifest.contributes.menus['view/item/context'] as Array<{
      command: string;
      when: string;
      group: string;
    }>;

    assert.ok(commands.some((command) => command.command === 'tessra.importData'));
    assert.ok(commands.some((command) => command.command === 'tessra.importCollection'));
    assert.ok(commands.some((command) => command.command === 'tessra.importCurl'));
    assert.ok(commands.some((command) => command.command === 'tessra.importOpenApi'));
    assert.ok(commands.some((command) => command.command === 'tessra.importEnvironment'));
    assert.ok(commands.some((command) => command.command === 'tessra.exportCollection'));
    assert.ok(commands.some((command) => command.command === 'tessra.exportEnvironment'));
    assert.ok(commands.some((command) => command.command === 'tessra.exportWorkspaceBackup'));
    assert.ok(commands.some((command) => command.command === 'tessra.importWorkspaceBackup'));
    assert.ok(commands.some((command) => command.command === 'tessra.openHistorySettings'));
    assert.strictEqual(commands.some((command) => command.command === 'tessra.exportPostmanCollection'), false);
    assert.strictEqual(commands.some((command) => command.command === 'tessra.exportPostmanEnvironment'), false);
    assert.ok(titleMenus.some((item) =>
      item.command === 'tessra.importData'
      && item.when === 'view == tessra-collections'
      && item.group === 'navigation'
    ));
    assert.ok(titleMenus.some((item) =>
      item.command === 'tessra.importEnvironment'
      && item.when === 'view == tessra-environments'
      && item.group === 'navigation'
    ));
    assert.ok(titleMenus.some((item) =>
      item.command === 'tessra.openHistorySettings'
      && item.when === 'view == tessra-history'
      && item.group === 'navigation'
    ));
    assert.ok(contextMenus.some((item) =>
      item.command === 'tessra.exportCollection'
      && item.when === 'viewItem == collection'
    ));
    assert.ok(contextMenus.some((item) =>
      item.command === 'tessra.exportEnvironment'
      && item.when === 'viewItem == environment || viewItem == environment-active'
    ));
  });

  it('ships Korean and Japanese package localization files with Tessra command prefixes', () => {
    const ko = readPackageLocalization('package.nls.ko.json');
    const ja = readPackageLocalization('package.nls.ja.json');

    assert.strictEqual(ko.displayName, 'Tessra - API Client');
    assert.strictEqual(ja.displayName, 'Tessra - API Client');
    assert.match(ko['configuration.displayLanguage.description'], /Tessra/);
    assert.match(ja['configuration.displayLanguage.description'], /Tessra/);
    assert.match(ko['command.changeDisplayLanguage'], /^Tessra:/);
    assert.match(ko['command.importData'], /^Tessra:/);
    assert.match(ko['command.importCollection'], /^Tessra:/);
    assert.match(ko['command.importEnvironment'], /^Tessra:/);
    assert.match(ko['command.exportCollection'], /^Tessra:/);
    assert.match(ko['command.exportEnvironment'], /^Tessra:/);
    assert.match(ko['command.exportWorkspaceBackup'], /^Tessra:/);
    assert.match(ko['command.importWorkspaceBackup'], /^Tessra:/);
    assert.match(ja['command.changeRequestPanelTheme'], /^Tessra:/);
    assert.match(ja['command.importData'], /^Tessra:/);
    assert.match(ja['command.importEnvironment'], /^Tessra:/);
    assert.match(ja['command.exportCollection'], /^Tessra:/);
    assert.match(ja['command.exportEnvironment'], /^Tessra:/);
    assert.match(ja['command.exportWorkspaceBackup'], /^Tessra:/);
    assert.match(ja['command.importWorkspaceBackup'], /^Tessra:/);
    assert.match(ko['command.openHistorySettings'], /^Tessra:/);
    assert.match(ja['command.openHistorySettings'], /^Tessra:/);
    assert.strictEqual(ko['view.collections'].length > 0, true);
    assert.strictEqual(ja['view.history'].length > 0, true);
  });
});
