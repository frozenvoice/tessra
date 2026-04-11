import * as vscode from 'vscode';
import { RequestPanel } from './panels/RequestPanel';
import { StorageService } from './services/StorageService';
import { CollectionTreeProvider, CollectionNode } from './providers/CollectionTreeProvider';
import { HistoryTreeProvider } from './providers/HistoryTreeProvider';
import { EnvironmentTreeProvider } from './providers/EnvironmentTreeProvider';
import {
  AuthConfig,
  CodegenTarget,
  Collection,
  CollectionItem,
  Environment,
  FormDataField,
  HistoryEntry,
  HttpMethod,
  KeyValue,
  Request,
  RequestBodyType,
  RequestScripts,
} from './models/types';
import { CurlService } from './services/CurlService';
import { GuidePanel } from './panels/GuidePanel';
import { ImportExportService } from './services/ImportExportService';
import { CodegenService } from './services/CodegenService';

const VALID_HTTP_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

interface ImportStats {
  skippedCollections: number;
  skippedItems: number;
}

export function activate(context: vscode.ExtensionContext) {
  const storage = new StorageService(context);
  const collectionProvider = new CollectionTreeProvider(storage);
  const historyProvider = new HistoryTreeProvider(storage);
  const environmentProvider = new EnvironmentTreeProvider(storage);

  const collectionTreeView = vscode.window.createTreeView('arc.collections', {
    treeDataProvider: collectionProvider,
    showCollapseAll: true,
    dragAndDropController: collectionProvider,
  });
  const historyTreeView = vscode.window.createTreeView('arc.history', {
    treeDataProvider: historyProvider,
    dragAndDropController: historyProvider,
  });

  // 히스토리 뷰 타이틀 갱신 (개수 + 필터 표시)
  function updateHistoryDescription(): void {
    const count = storage.getHistory().length;
    const filter = historyProvider.filterText;
    const parts: string[] = [];
    if (count > 0) { parts.push(`(${count})`); }
    if (filter) { parts.push(filter); }
    historyTreeView.description = parts.length > 0 ? parts.join(' ') : undefined;
  }
  historyProvider.onCountChanged = () => updateHistoryDescription();
  updateHistoryDescription();
  const environmentTreeView = vscode.window.createTreeView('arc.environments', {
    treeDataProvider: environmentProvider,
    dragAndDropController: environmentProvider,
  });
  context.subscriptions.push(collectionTreeView, historyTreeView, environmentTreeView);

  RequestPanel.storage = storage;
  RequestPanel.historyProvider = historyProvider;
  RequestPanel.collectionProvider = collectionProvider;
  RequestPanel.environmentProvider = environmentProvider;

  const envStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  envStatusBar.command = 'arc.switchEnvironment';
  envStatusBar.tooltip = '환경 전환';
  updateStatusBar(envStatusBar, environmentProvider);
  envStatusBar.show();
  context.subscriptions.push(envStatusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.newRequest', () => {
      RequestPanel.show(context.extensionUri, !!RequestPanel.currentPanel);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.createCollection', () => {
      collectionProvider.createCollection();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.createFolder', (node: CollectionNode) => {
      collectionProvider.createFolder(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.rename', (node: CollectionNode) => {
      collectionProvider.rename(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.delete', (node: CollectionNode) => {
      collectionProvider.delete(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.duplicateRequest', (node: CollectionNode) => {
      collectionProvider.duplicate(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.saveRequestAs', (node: CollectionNode) => {
      collectionProvider.saveAs(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.importCurl', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'cURL 명령어를 붙여넣으세요',
        placeHolder: "curl -X GET 'https://api.example.com/data'",
        ignoreFocusOut: true,
      });
      if (!input) { return; }

      try {
        const req = CurlService.parse(input);
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadRequest(req);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`cURL 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.copyAsCurl', (node: CollectionNode) => {
      if (node.kind === 'request' && node.item.request) {
        const curl = CurlService.generate(node.item.request);
        vscode.env.clipboard.writeText(curl);
        vscode.window.showInformationMessage('cURL 명령어가 클립보드에 복사되었습니다.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.importCollection', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: { 'JSON Files': ['json'] },
        openLabel: 'Import',
      });
      if (!uris || uris.length === 0) { return; }

      const collections = storage.getCollections();
      const environments = storage.getEnvironments();
      const stats: ImportStats = { skippedCollections: 0, skippedItems: 0 };
      const postmanDocuments: unknown[] = [];
      let imported = 0;

      for (const uri of uris) {
        try {
          const raw = await vscode.workspace.fs.readFile(uri);
          const data = JSON.parse(Buffer.from(raw).toString('utf-8'));
          const items = Array.isArray(data) ? data : [data];

          for (const item of items) {
            if (looksLikePostmanDocument(item)) {
              postmanDocuments.push(item);
              continue;
            }
            const normalized = normalizeImportedCollection(item, stats);
            if (!normalized) {
              continue;
            }
            collections.push(normalized);
            imported++;
          }
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `가져오기 실패 (${uri.fsPath}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      const importedPostman = ImportExportService.importDocuments(postmanDocuments);
      collections.push(...importedPostman.collections);
      environments.push(...importedPostman.environments);
      imported += importedPostman.collections.length;

      if (imported > 0) {
        storage.saveCollections(collections);
        collectionProvider.refresh();
        vscode.window.showInformationMessage(`${imported}개 컬렉션을 가져왔습니다.`);
      }

      if (importedPostman.environments.length > 0) {
        storage.saveEnvironments(environments);
        environmentProvider.refresh();
        vscode.window.showInformationMessage(`환경 ${importedPostman.environments.length}개를 가져왔습니다.`);
      }

      if (stats.skippedCollections > 0 || stats.skippedItems > 0) {
        vscode.window.showWarningMessage(
          `가져오는 동안 잘못된 데이터가 있어 컬렉션 ${stats.skippedCollections}개, 항목 ${stats.skippedItems}개를 건너뛰었습니다.`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.exportPostmanCollection', async (node: CollectionNode) => {
      if (node.kind !== 'collection') { return; }
      const defaultName = `${sanitizeFilename(node.collection.name)}.postman_collection.json`;
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultName),
        filters: { 'JSON Files': ['json'] },
      });
      if (!uri) { return; }

      const document = ImportExportService.exportCollection(node.collection);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(document, null, 2), 'utf-8'));
      vscode.window.showInformationMessage(`Postman 컬렉션을 내보냈습니다: ${uri.fsPath}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.exportPostmanEnvironment', async (env: Environment) => {
      const defaultName = `${sanitizeFilename(env.name)}.postman_environment.json`;
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultName),
        filters: { 'JSON Files': ['json'] },
      });
      if (!uri) { return; }

      const document = ImportExportService.exportEnvironment(env);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(document, null, 2), 'utf-8'));
      vscode.window.showInformationMessage(`Postman 환경을 내보냈습니다: ${uri.fsPath}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.collapseAll', () => {
      vscode.commands.executeCommand('workbench.actions.treeView.arc.collections.collapseAll');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.filterCollections', () => {
      const inputBox = vscode.window.createInputBox();
      inputBox.placeholder = '요청 이름, URL로 검색...';
      inputBox.value = collectionProvider.filterText;
      inputBox.title = 'Filter Collections';
      inputBox.onDidChangeValue((value) => {
        collectionProvider.filterText = value;
        collectionTreeView.description = value || undefined;
        vscode.commands.executeCommand('setContext', 'arc.collectionFilterActive', !!value);
      });
      inputBox.onDidAccept(() => inputBox.hide());
      inputBox.onDidHide(() => inputBox.dispose());
      inputBox.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.clearCollectionFilter', () => {
      collectionProvider.filterText = '';
      collectionTreeView.description = undefined;
      vscode.commands.executeCommand('setContext', 'arc.collectionFilterActive', false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.filterHistory', () => {
      const inputBox = vscode.window.createInputBox();
      inputBox.placeholder = 'URL, 메서드(GET), 상태코드(404)로 검색...';
      inputBox.value = historyProvider.filterText;
      inputBox.title = 'Filter History';
      inputBox.onDidChangeValue((value) => {
        historyProvider.filterText = value;
        updateHistoryDescription();
        vscode.commands.executeCommand('setContext', 'arc.historyFilterActive', !!value);
      });
      inputBox.onDidAccept(() => inputBox.hide());
      inputBox.onDidHide(() => inputBox.dispose());
      inputBox.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.clearHistoryFilter', () => {
      historyProvider.filterText = '';
      updateHistoryDescription();
      vscode.commands.executeCommand('setContext', 'arc.historyFilterActive', false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.loadFromHistory', (entry: HistoryEntry) => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadRequest(entry.request);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.loadFromCollection', (node: CollectionNode) => {
      if (node.kind === 'request' && node.item.request) {
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadRequest(node.item.request);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.runCollection', (node: CollectionNode) => {
      let items: CollectionItem[] = [];
      if (node.kind === 'collection') {
        items = node.collection.items;
      } else if (node.kind === 'folder' && node.item.children) {
        items = node.item.children;
      }

      if (items.length === 0) {
        vscode.window.showInformationMessage('실행할 요청이 없습니다.');
        return;
      }

      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.runCollection(node.kind === 'collection' ? node.collection.name : node.item.name, items);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.pinHistory', (entry: HistoryEntry) => {
      storage.setHistoryPin(entry.id, true);
      historyProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.unpinHistory', (entry: HistoryEntry) => {
      storage.setHistoryPin(entry.id, false);
      historyProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.deletePinnedHistory', async (entry: HistoryEntry) => {
      const confirm = await vscode.window.showWarningMessage(
        `고정된 항목을 삭제하시겠습니까?\n${entry.request.method} ${entry.request.url}`,
        { modal: true },
        '삭제'
      );
      if (confirm === '삭제') {
        const history = storage.getHistory().filter((e) => e.id !== entry.id);
        storage.saveHistory(history);
        historyProvider.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.clearHistory', async () => {
      const history = storage.getHistory();
      const pinned = history.filter((e) => e.pinned);
      const unpinnedCount = history.length - pinned.length;

      if (unpinnedCount === 0) {
        vscode.window.showInformationMessage('삭제할 항목이 없습니다. (모두 Pin 상태)');
        return;
      }

      const msg = pinned.length > 0
        ? `Pin된 ${pinned.length}개 항목은 유지됩니다. 나머지 ${unpinnedCount}개를 삭제하시겠습니까?`
        : `히스토리 ${unpinnedCount}개를 모두 삭제하시겠습니까?`;

      const confirm = await vscode.window.showWarningMessage(msg, { modal: true }, '삭제');
      if (confirm === '삭제') {
        storage.saveHistory(pinned);
        historyProvider.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.createEnvironment', () => {
      environmentProvider.createEnvironment();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.renameEnvironment', (env: Environment) => {
      environmentProvider.renameEnvironment(env);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.deleteEnvironment', (env: Environment) => {
      environmentProvider.deleteEnvironment(env).then(() => {
        updateStatusBar(envStatusBar, environmentProvider);
        RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.editEnvironment', (env: Environment) => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadEnvironment(env);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.editDefaultHeaders', () => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadDefaultHeaders();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.setActiveEnvironment', (env: Environment) => {
      environmentProvider.activeEnvId = env.id;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(env.name);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.deactivateEnvironment', () => {
      environmentProvider.activeEnvId = null;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(null);
    })
  );

  // 환경 클릭: 싱글클릭 → 변수 편집, 더블클릭 → 활성/비활성 토글
  let envClickTimer: ReturnType<typeof setTimeout> | null = null;
  let envLastClickId: string | null = null;
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.onEnvironmentClick', (env: Environment) => {
      if (envLastClickId === env.id && envClickTimer) {
        // 더블클릭: 활성/비활성 토글 + 변수 편집 화면 표시
        clearTimeout(envClickTimer);
        envClickTimer = null;
        envLastClickId = null;
        if (environmentProvider.activeEnvId === env.id) {
          environmentProvider.activeEnvId = null;
          environmentProvider.refresh();
          updateStatusBar(envStatusBar, environmentProvider);
          RequestPanel.currentPanel?.updateActiveEnv(null);
        } else {
          environmentProvider.activeEnvId = env.id;
          environmentProvider.refresh();
          updateStatusBar(envStatusBar, environmentProvider);
          RequestPanel.currentPanel?.updateActiveEnv(env.name);
        }
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadEnvironment(env);
      } else {
        // 싱글클릭: 대기 후 변수 편집
        if (envClickTimer) { clearTimeout(envClickTimer); }
        envLastClickId = env.id;
        envClickTimer = setTimeout(() => {
          envClickTimer = null;
          envLastClickId = null;
          RequestPanel.show(context.extensionUri);
          RequestPanel.currentPanel?.loadEnvironment(env);
        }, 300);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.switchEnvironment', async () => {
      const envs = storage.getEnvironments();
      const picks: (vscode.QuickPickItem & { envId: string | null })[] = [
        { label: '$(circle-slash) No Environment', envId: null },
        ...envs.map((env) => ({
          label: `$(symbol-variable) ${env.name}`,
          description: env.id === environmentProvider.activeEnvId ? '(active)' : '',
          envId: env.id,
        })),
      ];

      const selected = await vscode.window.showQuickPick(picks, { placeHolder: '환경 선택' });
      if (selected === undefined) { return; }

      environmentProvider.activeEnvId = selected.envId;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.openGuide', () => {
      GuidePanel.show(context.extensionUri);
    })
  );

  const requestPanelSerializer = vscode.window.registerWebviewPanelSerializer('arc.requestPanel', {
    async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: unknown) {
      panel.webview.options = {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
      };
      RequestPanel.revive(panel, context.extensionUri);
    },
  });
  context.subscriptions.push(requestPanelSerializer);
}

function updateStatusBar(item: vscode.StatusBarItem, provider: EnvironmentTreeProvider): void {
  const name = provider.getActiveEnvironmentName();
  if (name) {
    item.text = `$(symbol-variable) ${name}`;
  } else {
    item.text = '$(symbol-variable) No Env';
  }
}

function createImportId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, '_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikePostmanDocument(value: unknown): boolean {
  if (!isRecord(value)) { return false; }
  return (Array.isArray(value.item) && isRecord(value.info)) || (Array.isArray(value.values) && typeof value.name === 'string');
}

function normalizeImportedMethod(value: unknown): HttpMethod {
  const method = typeof value === 'string' ? value.toUpperCase() : '';
  return VALID_HTTP_METHODS.has(method as HttpMethod) ? method as HttpMethod : 'GET';
}

function normalizeImportedBodyType(value: unknown): RequestBodyType {
  switch (value) {
    case 'json':
    case 'xml':
    case 'form':
    case 'formdata':
    case 'binary':
    case 'raw':
    case 'none':
      return value;
    case 'text':
      return 'raw';
    default:
      return 'none';
  }
}

function normalizeImportedKeyValues(value: unknown): KeyValue[] {
  if (!Array.isArray(value)) { return []; }

  const items: KeyValue[] = [];
  for (const item of value) {
    if (!isRecord(item)) { continue; }

    const key = typeof item.key === 'string' ? item.key : '';
    const itemValue = typeof item.value === 'string' ? item.value : '';
    if (!key && !itemValue) { continue; }

    items.push({
      key,
      value: itemValue,
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    });
  }

  return items;
}

function normalizeImportedFormData(value: unknown): FormDataField[] {
  if (!Array.isArray(value)) { return []; }

  return value
    .filter((item) => isRecord(item) && typeof item.key === 'string')
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : createImportId(),
      key: typeof item.key === 'string' ? item.key : '',
      value: typeof item.value === 'string' ? item.value : '',
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      type: item.type === 'file' ? 'file' : 'text',
    }));
}

function normalizeImportedScripts(value: unknown): RequestScripts {
  if (!isRecord(value)) {
    return { preRequest: '', test: '' };
  }

  return {
    preRequest: typeof value.preRequest === 'string' ? value.preRequest : '',
    test: typeof value.test === 'string' ? value.test : '',
  };
}

function normalizeImportedAuthConfig(value: unknown): AuthConfig {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return { type: 'none' };
  }

  switch (value.type) {
    case 'basic': {
      const basic = isRecord(value.basic) ? value.basic : {};
      return {
        type: 'basic',
        basic: {
          username: typeof basic.username === 'string' ? basic.username : '',
          password: typeof basic.password === 'string' ? basic.password : '',
        },
      };
    }
    case 'bearer': {
      const bearer = isRecord(value.bearer) ? value.bearer : {};
      return {
        type: 'bearer',
        bearer: {
          token: typeof bearer.token === 'string' ? bearer.token : '',
        },
      };
    }
    case 'apikey': {
      const apikey = isRecord(value.apikey) ? value.apikey : {};
      return {
        type: 'apikey',
        apikey: {
          key: typeof apikey.key === 'string' ? apikey.key : '',
          value: typeof apikey.value === 'string' ? apikey.value : '',
          addTo: apikey.addTo === 'query' ? 'query' : 'header',
        },
      };
    }
    default:
      return { type: 'none' };
  }
}

function normalizeImportedRequest(value: unknown, fallbackName: string): Request | null {
  if (!isRecord(value)) { return null; }

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : createImportId(),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : fallbackName,
    method: normalizeImportedMethod(value.method),
    url: typeof value.url === 'string' ? value.url : '',
    headers: normalizeImportedKeyValues(value.headers),
    params: normalizeImportedKeyValues(value.params),
    body: typeof value.body === 'string' ? value.body : '',
    bodyType: normalizeImportedBodyType(value.bodyType),
    formData: normalizeImportedFormData(value.formData),
    binaryFilePath: typeof value.binaryFilePath === 'string' ? value.binaryFilePath : '',
    auth: normalizeImportedAuthConfig(value.auth),
    scripts: normalizeImportedScripts(value.scripts),
  };
}

function normalizeImportedCollectionItem(value: unknown, stats: ImportStats): CollectionItem | null {
  if (!isRecord(value)) {
    stats.skippedItems++;
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id : createImportId();
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const hasChildren = Array.isArray(value.children);
  const hasRequest = isRecord(value.request);

  if (value.type === 'folder' || (!value.type && hasChildren)) {
    const childValues = hasChildren ? value.children as unknown[] : [];
    const children = hasChildren
      ? childValues
          .map((child) => normalizeImportedCollectionItem(child, stats))
          .filter((child): child is CollectionItem => child !== null)
      : [];

    return {
      id,
      type: 'folder',
      name: name || '가져온 폴더',
      children,
    };
  }

  if (value.type === 'request' || (!value.type && hasRequest)) {
    const request = normalizeImportedRequest(value.request, name || '가져온 요청');
    if (!request) {
      stats.skippedItems++;
      return null;
    }

    return {
      id,
      type: 'request',
      name: name || request.name,
      request,
    };
  }

  stats.skippedItems++;
  return null;
}

function normalizeImportedCollection(value: unknown, stats: ImportStats): Collection | null {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim() || !Array.isArray(value.items)) {
    stats.skippedCollections++;
    return null;
  }

  const itemValues = value.items as unknown[];
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : createImportId(),
    name: value.name.trim(),
    items: itemValues
      .map((item) => normalizeImportedCollectionItem(item, stats))
      .filter((item): item is CollectionItem => item !== null),
  };
}

export function deactivate() {}
