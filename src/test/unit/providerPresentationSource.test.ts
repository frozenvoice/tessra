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
    assert.match(historySource, /getRequestMethodIcon/);
  });

  it('adds richer tooltips and metadata to environment items', () => {
    assert.match(environmentSource, /const varsLabel = LocalizationService\.t\('environment\.vars'/);
    assert.match(environmentSource, /item\.tooltip = isActive/);
    assert.match(environmentSource, /new vscode\.ThemeColor\('charts\.blue'\)/);
  });
});
