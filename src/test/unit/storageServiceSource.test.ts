import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readStorageSource(): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../../../src/services/StorageService.ts'),
    'utf8'
  );
}

describe('storage service source', () => {
  let source: string;

  before(() => {
    source = readStorageSource();
  });

  it('supports workspace-scoped profile directories', () => {
    assert.match(source, /DEFAULT_PROFILE_NAME = 'default'/);
    assert.match(source, /PROFILE_ROOT_DIR = 'profiles'/);
    assert.match(source, /getWorkspaceProfileName\(\): string/);
    assert.match(source, /listProfiles\(\): string\[\]/);
    assert.match(source, /private getActiveStoragePath\(\): string/);
    assert.match(source, /private resolveProfilePath\(profileName: string\): string/);
    assert.match(source, /path\.join\(this\.rootStoragePath, StorageService\.PROFILE_ROOT_DIR\)/);
  });

  it('uses collision-resistant directories for new workspace profiles', () => {
    assert.match(source, /private toProfileDirectoryName\(profileName: string\): string/);
    assert.match(source, /Buffer\.from\(profileName, 'utf-8'\)/);
    assert.match(source, /return `profile-\$\{encoded \|\| StorageService\.DEFAULT_PROFILE_NAME\}`;/);
    assert.match(source, /private toLegacyProfileDirectoryName\(profileName: string\): string/);
    assert.match(source, /findLegacyProfilePath\(profilesRoot, profileName, profilePath\)/);
    assert.match(source, /const legacyDirName = this\.toLegacyProfileDirectoryName\(profileName\);/);
    assert.match(source, /path\.basename\(legacyPath\) === legacyDirName/);
    assert.match(source, /Workspace profile "\$\{profileName\}" collides with existing profile/);
  });

  it('resolves persisted files through the active profile path', () => {
    assert.match(source, /private resolveFilePath\(fileName: string\): string/);
    assert.match(source, /this\.resolveFilePath\('collections\.json'\)/);
    assert.match(source, /this\.resolveFilePath\('history\.json'\)/);
    assert.match(source, /this\.resolveFilePath\('environments\.json'\)/);
    assert.match(source, /this\.resolveFilePath\('tab-state\.json'\)/);
  });

  it('migrates legacy Arc Client storage only when Tessra storage is empty', () => {
    assert.match(source, /LEGACY_STORAGE_DIR_CANDIDATES = \['arc\.arc-client', 'arc-client'\]/);
    assert.match(source, /STORAGE_DATA_INDICATOR_FILES = \[\s*'collections\.json',\s*'environments\.json',\s*'history\.json',\s*\]/);
    assert.match(source, /MIGRATABLE_STORAGE_ENTRIES = \[/);
    assert.match(source, /'collections\.json'/);
    assert.match(source, /'environments\.json'/);
    assert.match(source, /'history\.json'/);
    assert.match(source, /'default-headers\.json'/);
    assert.match(source, /'variables\.json'/);
    assert.match(source, /'tab-state\.json'/);
    assert.match(source, /private migrateLegacyStorageIfNeeded\(\): boolean/);
    assert.match(source, /if \(this\.hasStorageData\(this\.rootStoragePath\)\) \{ return false; \}/);
    assert.match(source, /StorageService\.STORAGE_DATA_INDICATOR_FILES\.some/);
    assert.match(source, /fs\.copyFileSync\(sourcePath, targetPath, fs\.constants\.COPYFILE_EXCL\)/);
  });

  it('backs up corrupt JSON files and writes data atomically', () => {
    assert.match(source, /private readonly corruptJsonWarnings = new Set<string>\(\);/);
    assert.match(source, /this\.handleCorruptJson\(filePath, err\);/);
    assert.match(source, /private backupCorruptJson\(filePath: string\): string \| null/);
    assert.match(source, /fs\.copyFileSync\(filePath, backupPath, fs\.constants\.COPYFILE_EXCL\)/);
    assert.match(source, /warn\.storageJsonCorrupt/);
    assert.match(source, /const tempPath = path\.join\(/);
    assert.match(source, /fs\.writeFileSync\(tempPath,/);
    assert.match(source, /fs\.renameSync\(tempPath, filePath\)/);
  });

  it('keeps history pruning count-based with a 500 item default fallback', () => {
    assert.match(source, /pruneHistory\(history: HistoryEntry\[\]\): number/);
    assert.match(source, /getConfiguration\('tessra'\)\.get<number>\('historyMaxItems', 500\)/);
    assert.match(source, /if \(!history\[i\]\.pinned\) \{/);
  });
});
