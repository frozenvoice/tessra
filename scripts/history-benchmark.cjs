'use strict';

// 실제 저장소/패널/TreeProvider/확장 콜백을 합성 임시 저장소에서 실행한다.
// 전송·Electron UI 시간은 포함하지 않으며 측정용 transpile은 메모리에서만 수행한다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const items = Number(process.env.TESSRA_BENCH_ITEMS || 500);
const completions = Number(process.env.TESSRA_BENCH_COMPLETIONS || 100);
const runs = Number(process.env.TESSRA_BENCH_RUNS || 3);
let currentProfile = 'default';
let trackedPath;
let metrics;
const noopDisposable = () => ({ dispose() {} });
const views = new Map();

class EventEmitter {
  listeners = new Set();
  event = (listener, receiver) => {
    const wrapped = (value) => listener.call(receiver, value);
    this.listeners.add(wrapped);
    return { dispose: () => this.listeners.delete(wrapped) };
  };
  fire(value) { for (const listener of this.listeners) listener(value); }
  dispose() { this.listeners.clear(); }
}

const vscode = {
  EventEmitter,
  TreeItem: class { constructor(label, collapsibleState) { Object.assign(this, { label, collapsibleState }); } },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class {}, ThemeColor: class {},
  StatusBarAlignment: { Left: 1 },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  workspace: {
    getConfiguration: () => ({
      get: (key, fallback) => key === 'workspaceProfile' ? currentProfile : key === 'historyMaxItems' ? items : fallback,
      inspect: () => undefined,
    }),
    onDidChangeConfiguration: noopDisposable,
  },
  window: {
    createTreeView: (id, options) => {
      let description;
      const view = {
        ...options, dispose() {},
        get description() { return description; },
        set description(value) {
          description = value;
          if (metrics && id === 'tessra-history') metrics.descriptionUpdates++;
        },
      };
      views.set(id, view);
      return view;
    },
    createStatusBarItem: () => ({ show() {}, dispose() {} }),
    registerWebviewPanelSerializer: noopDisposable,
    showInformationMessage() {}, showWarningMessage() {}, showErrorMessage() {}, setStatusBarMessage() {},
  },
  commands: { registerCommand: noopDisposable },
};

const originalLoad = Module._load;
Module._load = function(name, ...args) {
  return name === 'vscode' ? vscode : originalLoad.call(this, name, ...args);
};
const originalTsExtension = Module._extensions['.ts'];
Module._extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const real = {
  read: fs.readFileSync, stat: fs.statSync, write: fs.writeFileSync, rename: fs.renameSync, parse: JSON.parse,
};
function isHistory(file) { return typeof file === 'string' && path.resolve(file) === trackedPath; }
fs.readFileSync = function(file, ...args) {
  if (metrics && isHistory(file)) metrics.reads++;
  return real.read.call(this, file, ...args);
};
fs.statSync = function(file, ...args) {
  if (metrics && isHistory(file)) metrics.stats++;
  return real.stat.call(this, file, ...args);
};
fs.writeFileSync = function(file, ...args) {
  if (metrics && typeof file === 'string' && path.dirname(file) === path.dirname(trackedPath)
    && path.basename(file).startsWith('.history.json.')) metrics.atomicWrites++;
  return real.write.call(this, file, ...args);
};
fs.renameSync = function(from, to, ...args) {
  if (metrics && isHistory(to)) metrics.atomicRenames++;
  return real.rename.call(this, from, to, ...args);
};
JSON.parse = function(...args) {
  if (metrics) metrics.parses++;
  return real.parse.apply(this, args);
};

function entry(index) {
  return {
    id: `synthetic-${index}`,
    timestamp: 1700000000000 + index,
    pinned: index % 50 === 0,
    request: {
      id: `request-${index}`, name: `Synthetic ${index}`, method: 'GET', url: `http://fixture.invalid/items/${index}`,
      headers: [{ key: 'X-Synthetic', value: 'fixture', enabled: true }], params: [],
      body: 'x'.repeat(1024), bodyType: 'raw', auth: { type: 'none' },
    },
    response: { status: 200, statusText: 'OK', time: 1 },
  };
}

try {
  const { activate } = require(path.join(root, 'src/extension.ts'));
  const { RequestPanel } = require(path.join(root, 'src/panels/RequestPanel.ts'));
  const samples = [];
  for (let run = 0; run < runs; run++) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-history-bench-'));
    try {
      trackedPath = path.join(directory, 'history.json');
      const fixture = Array.from({ length: items }, (_, index) => entry(index));
      real.write(trackedPath, JSON.stringify(fixture, null, 2), 'utf8');
      const context = { globalStorageUri: { fsPath: directory }, extensionUri: { fsPath: root }, subscriptions: [], extension: { packageJSON: { version: 'synthetic' } } };
      activate(context);
      const provider = RequestPanel.historyProvider;
      metrics = { reads: 0, parses: 0, stats: 0, atomicWrites: 0, atomicRenames: 0, descriptionUpdates: 0, treeEvents: 0 };
      const subscription = provider.onDidChangeTreeData(() => { metrics.treeEvents++; });
      const started = performance.now();
      for (let index = 0; index < completions; index++) {
        const completed = entry(items + index);
        RequestPanel.prototype.saveToHistory.call({}, completed.request, completed.response);
        provider.refresh();
        // VS Code TreeView가 refresh 후 root children을 요청하는 경로다.
        provider.getChildren();
      }
      const elapsedMs = performance.now() - started;
      const sample = { ...metrics, elapsedMs: Number(elapsedMs.toFixed(3)) };
      metrics = undefined;
      subscription.dispose();
      const stored = real.parse(real.read(trackedPath, 'utf8'));
      assert.equal(stored.length, items);
      assert.equal(stored[0].request.url, `http://fixture.invalid/items/${items + completions - 1}`);
      assert.equal(stored.filter((item) => item.pinned).length, fixture.filter((item) => item.pinned).length);
      assert.equal(views.get('tessra-history').description, String(items));
      assert.equal(sample.atomicWrites, completions);
      assert.equal(sample.atomicRenames, completions);
      samples.push(sample);
      for (const disposable of context.subscriptions) disposable?.dispose();
    } finally {
      metrics = undefined;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  const elapsed = samples.map((sample) => sample.elapsedMs).sort((a, b) => a - b);
  console.log(JSON.stringify({
    environment: { platform: process.platform, node: process.version },
    fixture: { initialItems: items, completedRequests: completions, bodyBytesPerRequest: 1024, runs },
    path: 'actual extension activation + RequestPanel.saveToHistory + HistoryTreeProvider.refresh/getChildren',
    samples, medianElapsedMs: elapsed[Math.floor(elapsed.length / 2)],
  }, null, 2));
} finally {
  Module._load = originalLoad;
  if (originalTsExtension) Module._extensions['.ts'] = originalTsExtension;
  else delete Module._extensions['.ts'];
  fs.readFileSync = real.read; fs.statSync = real.stat; fs.writeFileSync = real.write; fs.renameSync = real.rename; JSON.parse = real.parse;
}
