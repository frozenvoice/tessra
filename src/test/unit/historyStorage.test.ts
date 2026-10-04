import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Module = require('module');
import type { HistoryEntry } from '../../models/types';
import type { StorageService } from '../../services/StorageService';

const nativeFs = require('fs') as {
  readFileSync: typeof fs.readFileSync;
  statSync: typeof fs.statSync;
  renameSync: typeof fs.renameSync;
};
const settings = { profile: 'default', maxItems: 500 };
const warnings: string[] = [];
let Storage: typeof StorageService;

function entry(id: string, pinned = false): HistoryEntry {
  return {
    id, timestamp: 1700000000000, pinned,
    request: {
      id: `request-${id}`, name: id, method: 'GET', url: `http://fixture.invalid/${id}`,
      headers: [{ key: 'X-Fixture', value: 'original', enabled: true }], params: [],
      body: '', bodyType: 'none', auth: { type: 'bearer', bearer: { token: 'synthetic' } },
    },
    response: { status: 200, statusText: 'OK', time: 1 },
  };
}

describe('History storage snapshots', () => {
  let directory: string;
  let historyPath: string;
  let storage: StorageService;
  let originalLoad: (...args: unknown[]) => unknown;

  before(() => {
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    originalLoad = loader._load;
    loader._load = function(name: unknown, ...args: unknown[]) {
      if (name === 'vscode') {
        return {
          workspace: { getConfiguration: () => ({ get: (key: string, fallback: unknown) =>
            key === 'workspaceProfile' ? settings.profile : key === 'historyMaxItems' ? settings.maxItems : fallback }) },
          window: { showWarningMessage: (message: string) => warnings.push(message) },
        };
      }
      return originalLoad.apply(this, [name, ...args]);
    };
    delete require.cache[require.resolve('../../services/StorageService')];
    Storage = require('../../services/StorageService').StorageService;
  });

  after(() => { (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad; });

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-history-snapshots-'));
    historyPath = path.join(directory, 'history.json');
    settings.profile = 'default'; settings.maxItems = 500; warnings.length = 0;
    storage = new Storage({ globalStorageUri: { fsPath: directory } } as never);
  });

  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  function write(entries: HistoryEntry[]): void { fs.writeFileSync(historyPath, JSON.stringify(entries), 'utf8'); }

  it('reads/parses a cold file once and reuses it across consecutive synchronous completions', () => {
    write([entry('initial')]);
    const realRead = nativeFs.readFileSync;
    const realParse = JSON.parse;
    let reads = 0;
    let parses = 0;
    nativeFs.readFileSync = ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (file === historyPath) reads++;
      return (realRead as (...args: unknown[]) => unknown)(file, ...args);
    }) as typeof fs.readFileSync;
    JSON.parse = ((...args: Parameters<typeof JSON.parse>) => { parses++; return realParse(...args); }) as typeof JSON.parse;
    try {
      for (let index = 0; index < 5; index++) {
        storage.addHistoryEntry(entry(`completed-${index}`));
        assert.strictEqual(storage.getHistorySnapshot().count, index + 2);
        assert.strictEqual(storage.getHistory()[0].id, `completed-${index}`);
        const persisted = realParse(realRead(historyPath, 'utf8')) as HistoryEntry[];
        assert.strictEqual(persisted[0].id, `completed-${index}`, 'completion has already reached disk');
      }
      assert.strictEqual(reads, 1);
      assert.strictEqual(parses, 1);
    } finally {
      nativeFs.readFileSync = realRead;
      JSON.parse = realParse;
    }
  });

  it('owns deep-frozen snapshots without freezing inputs or leaking mutable getHistory copies', () => {
    const input = entry('owned');
    const supplied = [input];
    storage.saveHistory(supplied);
    const snapshot = storage.getHistorySnapshot();
    assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.entries));
    assert.ok(Object.isFrozen(snapshot.entries[0].request.auth.bearer));
    assert.ok(!Object.isFrozen(supplied) && !Object.isFrozen(input.request.headers));
    input.request.headers[0].value = 'caller edited';
    input.request.auth.bearer!.token = 'caller edited';
    const mutable = storage.getHistory();
    mutable[0].request.headers[0].value = 'copy edited';
    mutable[0].request.auth.bearer!.token = 'copy edited';
    mutable.pop();
    assert.throws(() => { snapshot.entries[0].request.headers[0].value = 'forbidden'; }, TypeError);
    assert.strictEqual(storage.getHistorySnapshot(), snapshot);
    assert.strictEqual(snapshot.entries[0].request.headers[0].value, 'original');
    assert.strictEqual(snapshot.entries[0].request.auth.bearer!.token, 'synthetic');
    assert.strictEqual((JSON.parse(fs.readFileSync(historyPath, 'utf8')) as HistoryEntry[])[0].request.headers[0].value, 'original');
  });

  it('detects equal-size external edits even when mtime is restored', () => {
    write([entry('alpha')]);
    const previous = storage.getHistorySnapshot();
    const stat = fs.statSync(historyPath);
    write([entry('bravo')]);
    fs.utimesSync(historyPath, stat.atime, stat.mtime);
    assert.strictEqual(fs.statSync(historyPath).size, stat.size);
    const changed = storage.getHistorySnapshot();
    assert.notStrictEqual(changed, previous);
    assert.strictEqual(changed.entries[0].id, 'bravo');
  });

  it('detects atomic external replacement, deletion and restoration on the same path', () => {
    write([entry('alpha')]);
    const previous = storage.getHistorySnapshot();
    const stat = fs.statSync(historyPath);
    const replacement = path.join(directory, 'external.json');
    fs.writeFileSync(replacement, JSON.stringify([entry('bravo')]), 'utf8');
    fs.utimesSync(replacement, stat.atime, stat.mtime);
    fs.renameSync(replacement, historyPath);
    assert.notStrictEqual(storage.getHistorySnapshot(), previous);
    assert.strictEqual(storage.getHistory()[0].id, 'bravo');
    fs.unlinkSync(historyPath);
    assert.deepStrictEqual(storage.getHistory(), []);
    write([entry('restored')]);
    assert.strictEqual(storage.getHistory()[0].id, 'restored');
  });

  it('keeps profile paths independent when switching, editing an inactive profile and returning', () => {
    storage.saveHistory([entry('default')]);
    settings.profile = 'custom/a';
    storage.saveHistory([entry('custom')]);
    const customPath = storage.getHistorySnapshot().filePath;
    assert.notStrictEqual(customPath, historyPath);
    settings.profile = 'default';
    assert.strictEqual(storage.getHistory()[0].id, 'default');
    fs.writeFileSync(customPath, JSON.stringify([entry('external-custom')]), 'utf8');
    settings.profile = 'custom/a';
    assert.strictEqual(storage.getHistory()[0].id, 'external-custom');
    settings.profile = 'default';
    assert.strictEqual(storage.getHistory()[0].id, 'default');
  });

  it('preserves order through delete/pin/unpin and never prunes pinned entries beyond the configured limit', () => {
    settings.maxItems = 50;
    const initial = Array.from({ length: 70 }, (_, index) => entry(`item-${index}`, index < 60));
    storage.saveHistory(initial);
    assert.strictEqual(storage.addHistoryEntry(entry('latest')), 11);
    assert.strictEqual(storage.getHistory().length, 60);
    assert.ok(storage.getHistory().every((item) => item.pinned));
    storage.setHistoryPin('item-0', false);
    assert.strictEqual(storage.getHistory()[0].pinned, false);
    storage.setHistoryPin('item-0', true);
    storage.saveHistory(storage.getHistory().filter((item) => item.id !== 'item-1'));
    assert.deepStrictEqual(storage.getHistory().map((item) => item.id), initial.slice(0, 60).filter((item) => item.id !== 'item-1').map((item) => item.id));
  });

  it('never publishes a failed atomic save and removes its temporary file', () => {
    storage.saveHistory([entry('original')]);
    const previous = storage.getHistorySnapshot();
    const raw = fs.readFileSync(historyPath, 'utf8');
    const realRename = nativeFs.renameSync;
    nativeFs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (to === historyPath) throw Object.assign(new Error('Synthetic rename failure'), { code: 'EACCES' });
      realRename(from, to);
    }) as typeof fs.renameSync;
    try {
      assert.throws(() => storage.addHistoryEntry(entry('failed')), /Synthetic rename failure/);
    } finally { nativeFs.renameSync = realRename; }
    assert.strictEqual(fs.readFileSync(historyPath, 'utf8'), raw);
    assert.strictEqual(storage.getHistorySnapshot(), previous);
    assert.deepStrictEqual(fs.readdirSync(directory), ['history.json']);
  });

  it('keeps a successful atomic save successful when its following stat fails', () => {
    storage.saveHistory([entry('original')]);
    const realStat = nativeFs.statSync;
    const realRename = nativeFs.renameSync;
    let renamed = false;
    nativeFs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      realRename(from, to);
      if (to === historyPath) renamed = true;
    }) as typeof fs.renameSync;
    nativeFs.statSync = ((file: fs.PathLike, ...args: unknown[]) => {
      if (file === historyPath && renamed) throw Object.assign(new Error('Synthetic stat failure'), { code: 'EACCES' });
      return (realStat as (...args: unknown[]) => unknown)(file, ...args);
    }) as typeof fs.statSync;
    try {
      assert.doesNotThrow(() => storage.addHistoryEntry(entry('saved')));
    } finally { nativeFs.statSync = realStat; nativeFs.renameSync = realRename; }
    assert.strictEqual(storage.getHistory()[0].id, 'saved');
    assert.strictEqual((JSON.parse(fs.readFileSync(historyPath, 'utf8')) as HistoryEntry[])[0].id, 'saved');
  });

  it('protects a cached healthy file that is externally corrupted before a direct save', () => {
    storage.saveHistory([entry('healthy')]);
    const broken = '[{"id":"broken"}]';
    fs.writeFileSync(historyPath, broken, 'utf8');
    assert.throws(() => storage.saveHistory([entry('replacement')]), /history.json/);
    assert.strictEqual(storage.addHistoryEntry(entry('skipped')), 0);
    assert.strictEqual(fs.readFileSync(historyPath, 'utf8'), broken);
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(fs.readdirSync(directory).filter((name) => name.startsWith('history.json.corrupt-')).length, 1);
    assert.deepStrictEqual(storage.getHistory(), []);
    write([entry('recovered')]);
    storage.saveHistory([entry('saved-after-recovery')]);
    assert.strictEqual(storage.getHistory()[0].id, 'saved-after-recovery');
  });

  it('retains corruption write protection across cached-empty reads and releases it after deletion is observed', () => {
    fs.writeFileSync(historyPath, '{invalid', 'utf8');
    const corrupted = storage.getHistorySnapshot();
    assert.strictEqual(corrupted.count, 0);
    assert.strictEqual(storage.getHistorySnapshot(), corrupted);
    assert.throws(() => storage.saveHistory([]), /history.json/);
    assert.strictEqual(fs.readFileSync(historyPath, 'utf8'), '{invalid');
    settings.profile = 'other'; storage.saveHistory([entry('other-profile')]);
    settings.profile = 'default';
    assert.throws(() => storage.saveHistory([]), /history.json/);
    fs.unlinkSync(historyPath);
    assert.deepStrictEqual(storage.getHistory(), []);
    storage.saveHistory([entry('after-deletion')]);
    assert.strictEqual(storage.getHistory()[0].id, 'after-deletion');
    assert.strictEqual(warnings.length, 1);
  });
});
