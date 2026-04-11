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
    assert.match(source, /path\.join\(\s*this\.rootStoragePath,\s*StorageService\.PROFILE_ROOT_DIR,/);
  });

  it('resolves persisted files through the active profile path', () => {
    assert.match(source, /private resolveFilePath\(fileName: string\): string/);
    assert.match(source, /this\.resolveFilePath\('collections\.json'\)/);
    assert.match(source, /this\.resolveFilePath\('history\.json'\)/);
    assert.match(source, /this\.resolveFilePath\('environments\.json'\)/);
    assert.match(source, /this\.resolveFilePath\('tab-state\.json'\)/);
  });
});
