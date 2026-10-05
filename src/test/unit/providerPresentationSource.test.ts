import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../../../', relativePath), 'utf8');
}

describe('Provider presentation source', () => {
  const visualsSource = readSource('src/providers/requestTreeVisuals.ts');
  const collectionSource = readSource('src/providers/CollectionTreeProvider.ts');
  const historySource = readSource('src/providers/HistoryTreeProvider.ts');
  const environmentSource = readSource('src/providers/EnvironmentTreeProvider.ts');

  it('shares method visuals across collection and history trees', () => {
    assert.match(visualsSource, /GET:\s*\{\s*icon:\s*'arrow-down',\s*color:\s*'charts\.green'\s*\}/);
    assert.match(visualsSource, /POST:\s*\{\s*icon:\s*'arrow-up',\s*color:\s*'charts\.yellow'\s*\}/);
    assert.match(visualsSource, /DELETE:\s*\{\s*icon:\s*'trash',\s*color:\s*'charts\.red'\s*\}/);
    assert.match(collectionSource, /buildRequestTreeDescription/);
    assert.match(collectionSource, /buildRequestTreeTooltip/);
    assert.match(collectionSource, /getRequestMethodIcon/);
    assert.match(historySource, /buildHistoryDescription/);
    assert.match(historySource, /buildHistoryTooltip/);
    assert.match(historySource, /getHistoryStatusIcon/);
  });

  it('groups history entries by pinned state and local date without changing storage order', () => {
    assert.match(historySource, /type HistoryGroupId = 'pinned' \| 'today' \| 'yesterday' \| 'thisWeek' \| 'older';/);
    assert.match(historySource, /type HistoryTreeNode = HistoryEntry \| HistoryGroupNode;/);
    assert.match(historySource, /TreeDataProvider<HistoryTreeNode>/);
    assert.match(historySource, /get visibleCount\(\): number \{\s*return this\.getFilteredEntries\(\)\.length;/);
    assert.match(historySource, /return this\.groupEntries\(this\.getFilteredEntries\(\)\);/);
    assert.match(historySource, /history\.group\.pinned/);
    assert.match(historySource, /history\.group\.today/);
    assert.match(historySource, /history\.group\.yesterday/);
    assert.match(historySource, /history\.group\.thisWeek/);
    assert.match(historySource, /history\.group\.older/);
    assert.match(historySource, /if \(entry\.pinned\) \{ continue; \}/);
    assert.match(historySource, /startOfLocalDay\(date: Date\)/);
    assert.match(historySource, /startOfLocalWeek\(date: Date\)/);
    assert.match(historySource, /item\.contextValue = 'history-group';/);
    assert.match(historySource, /item\.command = \{\s*command: 'tessra\.loadFromHistory'/);
    assert.match(historySource, /if \(!this\.isHistoryEntry\(target\)\) \{ return; \}/);
  });

  it('adds richer tooltips and metadata to environment items', () => {
    assert.match(environmentSource, /const varsLabel = LocalizationService\.t\('environment\.vars'/);
    assert.match(environmentSource, /item\.tooltip = isActive/);
    assert.match(environmentSource, /new vscode\.ThemeColor\('charts\.blue'\)/);
  });
});
