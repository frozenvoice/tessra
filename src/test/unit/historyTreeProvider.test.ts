import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Module = require('module');
import type { HistoryEntry } from '../../models/types';
import type { StorageService } from '../../services/StorageService';
import type { HistoryTreeProvider } from '../../providers/HistoryTreeProvider';

class EventEmitter<T> {
  private listeners = new Set<(value: T) => void>();
  readonly event = (listener: (value: T) => void) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(value: T): void { for (const listener of this.listeners) listener(value); }
}

const settings = { profile: 'default' };
let Storage: typeof StorageService;
let Provider: typeof HistoryTreeProvider;

function entry(id: string, method: 'GET' | 'POST' = 'GET', pinned = false): HistoryEntry {
  return { id, pinned, timestamp: Date.now(),
    request: { id, name: id, method, url: `http://fixture.invalid/${id}`, headers: [], params: [],
      body: '', bodyType: 'none', auth: { type: 'none' } },
    response: { status: method === 'GET' ? 200 : 500, statusText: 'Synthetic', time: 1 } };
}

describe('History tree snapshot consumers', () => {
  let directory: string;
  let storage: StorageService;
  let provider: HistoryTreeProvider;
  let originalLoad: (...args: unknown[]) => unknown;

  before(() => {
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    originalLoad = loader._load;
    loader._load = function(name: unknown, ...args: unknown[]) {
      if (name === 'vscode') {
        return { EventEmitter,
          TreeItem: class { constructor(public label: string, public collapsibleState: number) {} },
          ThemeIcon: class {}, ThemeColor: class {}, DataTransferItem: class { constructor(public value: unknown) {} },
          TreeItemCollapsibleState: { None: 0, Expanded: 2 },
          workspace: { getConfiguration: () => ({ get: (key: string, fallback: unknown) => key === 'workspaceProfile' ? settings.profile : fallback }) },
          window: { showWarningMessage() {} } };
      }
      return originalLoad.apply(this, [name, ...args]);
    };
    delete require.cache[require.resolve('../../services/StorageService')];
    delete require.cache[require.resolve('../../providers/HistoryTreeProvider')];
    Storage = require('../../services/StorageService').StorageService;
    Provider = require('../../providers/HistoryTreeProvider').HistoryTreeProvider;
  });

  after(() => { (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad; });

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-history-tree-'));
    settings.profile = 'default';
    storage = new Storage({ globalStorageUri: { fsPath: directory } } as never);
    provider = new Provider(storage);
  });

  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  it('computes counts before the tree event and emits one description change per completed save', () => {
    storage.saveHistory([entry('initial')]);
    provider.getChildren();
    const counts: Array<[number, number]> = [];
    let events = 0;
    provider.onCountChanged = (total, visible) => counts.push([total, visible]);
    provider.onDidChangeTreeData(() => {
      events++;
      assert.deepStrictEqual(provider.getCounts(), { total: counts[counts.length - 1][0], visible: counts[counts.length - 1][1] });
    });
    for (let index = 0; index < 3; index++) {
      storage.addHistoryEntry(entry(`completed-${index}`));
      provider.refresh();
      provider.getChildren();
      provider.visibleCount;
    }
    assert.deepStrictEqual(counts, [[2, 2], [3, 3], [4, 4]]);
    assert.strictEqual(events, 3);
    provider.refresh();
    assert.strictEqual(events, 4, 'unchanged data may still need a localized tree redraw');
    assert.strictEqual(counts.length, 3, 'unchanged state does not duplicate description updates');
  });

  it('filters current immutable entries and groups pins without rewriting stored order', () => {
    const fixture = [entry('one'), entry('two', 'POST', true), entry('three')];
    storage.saveHistory(fixture);
    const snapshot = storage.getHistorySnapshot();
    const groups = provider.getChildren();
    assert.ok('kind' in groups[0] && groups[0].kind === 'group');
    assert.strictEqual((groups[0] as { id: string }).id, 'pinned');
    provider.filterText = 'method:post host:fixture status:5xx pinned:yes';
    assert.deepStrictEqual(provider.getCounts(), { total: 3, visible: 1 });
    assert.strictEqual(provider.visibleCount, 1);
    provider.filterText = 'method:get pinned:no';
    assert.deepStrictEqual(provider.getCounts(), { total: 3, visible: 2 });
    provider.filterText = '';
    assert.strictEqual(provider.visibleCount, 3);
    assert.strictEqual(storage.getHistorySnapshot(), snapshot);
    assert.deepStrictEqual(storage.getHistory().map((item) => item.id), fixture.map((item) => item.id));
  });

  it('detects external edit/delete/restore through children or visibleCount without an explicit refresh', () => {
    storage.saveHistory([entry('initial')]);
    const groups = provider.getChildren();
    const notifications: number[] = [];
    provider.onCountChanged = (total) => notifications.push(total);
    const historyPath = path.join(directory, 'history.json');
    fs.writeFileSync(historyPath, JSON.stringify([entry('external-one'), entry('external-two')]), 'utf8');
    assert.strictEqual(provider.visibleCount, 2);
    const currentChildren = provider.getChildren(groups[0]);
    assert.deepStrictEqual(currentChildren.map((node) => node.id), ['external-one', 'external-two']);
    fs.unlinkSync(historyPath);
    assert.deepStrictEqual(provider.getChildren(), []);
    fs.writeFileSync(historyPath, JSON.stringify([entry('restored')]), 'utf8');
    assert.strictEqual(provider.visibleCount, 1);
    assert.deepStrictEqual(notifications, [2, 0, 1]);
  });

  it('reinterprets old group nodes after profile changes and never returns a previous profile entry', () => {
    storage.saveHistory([entry('default')]);
    const oldGroup = provider.getChildren()[0];
    settings.profile = 'other';
    storage.saveHistory([entry('other')]);
    assert.deepStrictEqual(provider.getChildren(oldGroup).map((node) => node.id), ['other']);
    settings.profile = 'default';
    assert.deepStrictEqual(provider.getChildren(oldGroup).map((node) => node.id), ['default']);
  });

  it('reorders via real drag/drop persistence and preserves filter and pin metadata', () => {
    storage.saveHistory([entry('one'), entry('two', 'GET', true), entry('three')]);
    provider.filterText = 'method:get';
    const transfer = { get: () => ({ value: ['one'] }) };
    provider.handleDrop(entry('three'), transfer as never);
    assert.deepStrictEqual(storage.getHistory().map((item) => item.id), ['two', 'three', 'one']);
    assert.strictEqual(storage.getHistory()[0].pinned, true);
    assert.deepStrictEqual(provider.getCounts(), { total: 3, visible: 3 });
    const snapshot = storage.getHistorySnapshot();
    provider.handleDrop(entry('one'), transfer as never);
    assert.strictEqual(storage.getHistorySnapshot(), snapshot, 'self drop must not save');
  });
});
