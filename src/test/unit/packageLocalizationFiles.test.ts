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
    assert.strictEqual(en['command.importCollection'], 'Tessra: Import Collection');
    assert.strictEqual(en['command.importEnvironment'], 'Import Environment');
    assert.strictEqual(en['command.exportWorkspaceBackup'], 'Tessra: Export Workspace Backup');
    assert.strictEqual(en['command.importWorkspaceBackup'], 'Tessra: Import Workspace Backup');
    assert.strictEqual(en['command.openHistorySettings'], 'Tessra: Open History Settings');
    assert.match(en['configuration.historyMaxItems.description'], /non-pinned history entries/);
    assert.match(en['configuration.historyMaxItems.description'], /Pinned entries are preserved/);
  });

  it('contributes Import Environment and History Settings from their view title bars', () => {
    const manifest = readPackageManifest();
    const commands = manifest.contributes.commands as Array<{ command: string; title: string }>;
    const titleMenus = manifest.contributes.menus['view/title'] as Array<{
      command: string;
      when: string;
      group: string;
    }>;

    assert.ok(commands.some((command) => command.command === 'tessra.importEnvironment'));
    assert.ok(commands.some((command) => command.command === 'tessra.exportWorkspaceBackup'));
    assert.ok(commands.some((command) => command.command === 'tessra.importWorkspaceBackup'));
    assert.ok(commands.some((command) => command.command === 'tessra.openHistorySettings'));
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
  });

  it('ships Korean and Japanese package localization files with Tessra command prefixes', () => {
    const ko = readPackageLocalization('package.nls.ko.json');
    const ja = readPackageLocalization('package.nls.ja.json');

    assert.strictEqual(ko.displayName, 'Tessra - API Client');
    assert.strictEqual(ja.displayName, 'Tessra - API Client');
    assert.match(ko['configuration.displayLanguage.description'], /Tessra/);
    assert.match(ja['configuration.displayLanguage.description'], /Tessra/);
    assert.match(ko['command.changeDisplayLanguage'], /^Tessra:/);
    assert.match(ko['command.importCollection'], /^Tessra:/);
    assert.match(ko['command.exportWorkspaceBackup'], /^Tessra:/);
    assert.match(ko['command.importWorkspaceBackup'], /^Tessra:/);
    assert.strictEqual(ko['command.importEnvironment'], 'Import Environment');
    assert.match(ja['command.changeRequestPanelTheme'], /^Tessra:/);
    assert.match(ja['command.exportWorkspaceBackup'], /^Tessra:/);
    assert.match(ja['command.importWorkspaceBackup'], /^Tessra:/);
    assert.strictEqual(ja['command.importEnvironment'], 'Import Environment');
    assert.match(ko['command.openHistorySettings'], /^Tessra:/);
    assert.match(ja['command.openHistorySettings'], /^Tessra:/);
    assert.strictEqual(ko['view.collections'].length > 0, true);
    assert.strictEqual(ja['view.history'].length > 0, true);
  });
});
