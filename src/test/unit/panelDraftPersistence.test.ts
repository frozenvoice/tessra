import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Module = require('module');
import { MessageType, StoredTabState } from '../../models/types';
import type { RequestPanel } from '../../panels/RequestPanel';
import type { StorageService } from '../../services/StorageService';

interface DraftPanel {
  storageProfileName: string;
  latestTabDraft: StoredTabState | null;
  pendingRestore: StoredTabState | null;
  pendingFlushResolvers: Map<string, (error?: Error) => void>;
  flushTabStateNow(): Promise<void>;
  handleMessage(message: unknown): Promise<void>;
  dispose(): void;
  invalidateExecutions(): void;
}

describe('RequestPanel draft persistence', () => {
  let root: string;
  let profile: string;
  let storage: StorageService;
  let Panel: typeof RequestPanel;
  let panel: DraftPanel;
  let posted: Array<{ type: string; requestId: string }>;
  let errors: string[];
  const draft = (url: string): StoredTabState => ({ tabs: [{ name: 'Draft', method: 'GET', url, headers: [], params: [], body: '', bodyType: 'none', auth: { type: 'none' }, timeout: 0 }], activeIndex: 0 });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-panel-draft-'));
    profile = 'default'; posted = []; errors = [];
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    const originalLoad = loader._load;
    loader._load = function(name: unknown, ...args: unknown[]) {
      if (name === 'vscode') {
        return { workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
          window: { showWarningMessage() {}, showErrorMessage: (message: string) => errors.push(message) } };
      }
      return originalLoad.apply(this, [name, ...args]);
    };
    delete require.cache[require.resolve('../../panels/RequestPanel')];
    try {
      Panel = require('../../panels/RequestPanel').RequestPanel;
      const Storage = require('../../services/StorageService').StorageService;
      storage = new Storage({ globalStorageUri: { fsPath: root } });
    } finally { loader._load = originalLoad; }
    storage.getWorkspaceProfileName = () => profile;
    Panel.storage = storage;
    panel = Object.assign(Object.create(Panel.prototype), {
      storageProfileName: profile, latestTabDraft: draft('/latest'), pendingRestore: null,
      pendingFlushResolvers: new Map(), pendingWebviewMessages: [], executionGeneration: 0,
      isDisposed: false, webviewReady: true, webviewSessionId: 'session', disposables: [],
      requestExecutor: { cancelAll() {} }, collectionRunner: { reset() {} }, webSocketManager: { disconnectAll() {} }, secretEditor: { invalidate() {} },
      reloadWebview() {}, postMessage: (message: { type: string; requestId: string }) => posted.push(message),
    });
    Panel.currentPanel = panel as unknown as RequestPanel;
  });

  afterEach(() => {
    panel.invalidateExecutions();
    Panel.currentPanel = undefined;
    fs.rmSync(root, { recursive: true, force: true });
  });

  function acknowledge(requestId: string, state = draft('/confirmed')) {
    return panel.handleMessage({ type: MessageType.FlushedTabState, requestId, sessionId: 'session', ...state });
  }

  it('saves the cached draft on disposal without waiting for any disk debounce', () => {
    panel.dispose();
    assert.strictEqual(storage.getTabState()?.tabs[0].url, '/latest');
    assert.deepStrictEqual(errors, []);
  });

  for (const originalProfile of ['default', 'custom']) {
    it(`preserves the ${originalProfile} draft on direct configuration changes without writing into the new profile`, () => {
      profile = originalProfile;
      storage.getStoragePath();
      panel.storageProfileName = profile;
      profile = 'next';
      storage.saveTabState(draft('/next').tabs, 0);
      Panel.reloadCurrentPanelForStorageChange();
      assert.strictEqual(storage.getTabState()?.tabs[0].url, '/next');
      assert.strictEqual(panel.pendingRestore?.tabs[0].url, '/next');
      profile = originalProfile;
      assert.strictEqual(storage.getTabState()?.tabs[0].url, '/latest');
      assert.deepStrictEqual(errors, []);
    });
  }

  it('waits past the old 250ms deadline and resolves only after saving the matching acknowledgement', async () => {
    let resolved = false;
    const pending = panel.flushTabStateNow().then(() => { resolved = true; });
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.strictEqual(resolved, false);
    await acknowledge('unrelated');
    assert.strictEqual(resolved, false);
    await acknowledge(posted[0].requestId);
    await pending;
    assert.strictEqual(storage.getTabState()?.tabs[0].url, '/confirmed');
    assert.strictEqual(panel.pendingFlushResolvers.size, 0);
  });

  it('rejects a missing acknowledgement and ignores its late reply during a later flush', async () => {
    await assert.rejects(panel.flushTabStateNow(), /latest request edits/);
    const previousId = posted[0].requestId;
    const pending = panel.flushTabStateNow();
    await acknowledge(previousId, draft('/stale'));
    assert.strictEqual(panel.pendingFlushResolvers.size, 1);
    assert.strictEqual(storage.getTabState(), null);
    await acknowledge(posted[1].requestId);
    await pending;
    assert.strictEqual(storage.getTabState()?.tabs[0].url, '/confirmed');
  });

  it('rejects the flush when writing its validated draft fails', async () => {
    const filePath = path.join(root, 'tab-state.json');
    fs.writeFileSync(filePath, '{invalid', 'utf8');
    storage.getTabState();
    const rejected = assert.rejects(panel.flushTabStateNow(), /tab-state.json/);
    await acknowledge(posted[0].requestId);
    await rejected;
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), '{invalid');
  });

  it('rejects a pending flush on execution invalidation', async () => {
    const rejected = assert.rejects(panel.flushTabStateNow(), /latest request edits/);
    panel.invalidateExecutions();
    await rejected;
    assert.strictEqual(panel.pendingFlushResolvers.size, 0);
  });
});
