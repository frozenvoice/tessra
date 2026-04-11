import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readCollectionTreeProviderSource(): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../../../src/providers/CollectionTreeProvider.ts'),
    'utf8'
  );
}

describe('CollectionTreeProvider source', () => {
  let source: string;

  before(() => {
    source = readCollectionTreeProviderSource();
  });

  it('keeps request.name in sync when a saved request is renamed', () => {
    assert.match(source, /if \(item\) \{\s*item\.name = newName;[\s\S]*item\.request\.name = newName;/);
  });

  it('keeps duplicated or copied requests aligned with their new item name', () => {
    assert.match(source, /clone\.name = `\$\{node\.item\.name\} Copy`;\s*if \(clone\.request\) \{\s*clone\.request\.name = clone\.name;/);
    assert.match(source, /clone\.name = name;\s*if \(clone\.request\) \{\s*clone\.request\.name = name;/);
  });
});
