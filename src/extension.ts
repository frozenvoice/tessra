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
import { LocalizationService, SUPPORTED_DISPLAY_LANGUAGES } from './services/LocalizationService';
import { RequestExportService } from './services/RequestExportService';

const VALID_HTTP_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

interface ImportStats {
  skippedCollections: number;
  skippedItems: number;
}

export function activate(context: vscode.ExtensionContext) {
  const t = (key: string, params?: Record<string, string | number>) => LocalizationService.t(key, params);
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
  function updateCollectionDescription(): void {
    const visible = collectionProvider.visibleCollectionCount;
    const total = collectionProvider.totalCollectionCount;
    const filter = collectionProvider.filterText.trim();
    const parts: string[] = [];
    if (total > 0) { parts.push(filter ? `${visible}/${total}` : String(total)); }
    if (filter) { parts.push(filter); }
    collectionTreeView.description = parts.length > 0 ? parts.join(' · ') : undefined;
    collectionTreeView.description = parts.length > 0 ? parts.join(' · ') : undefined;
    collectionTreeView.description = parts.length > 0 ? parts.join(' · ') : undefined;
  }

  function updateHistoryDescription(): void {
    const count = storage.getHistory().length;
    const visible = historyProvider.visibleCount;
    const filter = historyProvider.filterText.trim();
    const parts: string[] = [];
    if (count > 0) { parts.push(filter ? `${visible}/${count}` : String(count)); }
    if (filter) { parts.push(filter); }
    historyTreeView.description = parts.length > 0 ? parts.join(' · ') : undefined;
  }
  historyProvider.onCountChanged = () => updateHistoryDescription();
  collectionProvider.onDidChangeTreeData(() => updateCollectionDescription());
  historyProvider.onDidChangeTreeData(() => updateHistoryDescription());
  updateCollectionDescription();
  updateHistoryDescription();
  const environmentTreeView = vscode.window.createTreeView('arc.environments', {
    treeDataProvider: environmentProvider,
    dragAndDropController: environmentProvider,
  });
  context.subscriptions.push(collectionTreeView, historyTreeView, environmentTreeView);

  function updateLocalizedViewTitles(): void {
    collectionTreeView.title = t('view.collections');
    environmentTreeView.title = t('view.environments');
    historyTreeView.title = t('view.history');
  }

  updateLocalizedViewTitles();

  RequestPanel.storage = storage;
  RequestPanel.historyProvider = historyProvider;
  RequestPanel.collectionProvider = collectionProvider;
  RequestPanel.environmentProvider = environmentProvider;

  const envStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  envStatusBar.command = 'arc.switchEnvironment';
  envStatusBar.tooltip = t('statusBar.switchEnvironment');
  updateStatusBar(envStatusBar, environmentProvider);
  envStatusBar.show();
  context.subscriptions.push(envStatusBar);

  function refreshWorkspaceScopedState(options: { reloadPanel?: boolean } = {}): void {
    environmentProvider.reloadFromStorage();
    collectionProvider.refresh();
    historyProvider.refresh();
    environmentProvider.refresh();
    updateCollectionDescription();
    updateHistoryDescription();
    updateStatusBar(envStatusBar, environmentProvider);

    if (options.reloadPanel) {
      RequestPanel.reloadCurrentPanelForStorageChange();
    } else {
      RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
    }
  }

  async function importStructuredDocuments(
    uris: readonly vscode.Uri[],
    options: { openApiOnly?: boolean } = {}
  ): Promise<void> {
    const collections = storage.getCollections();
    const environments = storage.getEnvironments();
    const stats: ImportStats = { skippedCollections: 0, skippedItems: 0 };
    const postmanDocuments: unknown[] = [];
    const openApiDocuments: unknown[] = [];
    let importedCollections = 0;

    for (const uri of uris) {
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const data = JSON.parse(Buffer.from(raw).toString('utf-8'));
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (ImportExportService.isOpenApiDocument(item)) {
            openApiDocuments.push(item);
            continue;
          }
          if (!options.openApiOnly && ImportExportService.isPostmanDocument(item)) {
            postmanDocuments.push(item);
            continue;
          }
          if (options.openApiOnly) {
            continue;
          }

          const normalized = normalizeImportedCollection(item, stats);
          if (!normalized) { continue; }
          collections.push(normalized);
          importedCollections++;
        }
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          t('error.importFailed', {
            path: uri.fsPath,
            message: err instanceof Error ? err.message : String(err),
          })
        );
      }
    }

    const importedOpenApi = ImportExportService.importOpenApiDocuments(openApiDocuments);
    const importedPostman = options.openApiOnly
      ? { collections: [] as Collection[], environments: [] as Environment[] }
      : ImportExportService.importDocuments(postmanDocuments);

    collections.push(...importedOpenApi.collections, ...importedPostman.collections);
    environments.push(...importedOpenApi.environments, ...importedPostman.environments);
    importedCollections += importedOpenApi.collections.length + importedPostman.collections.length;

    if (importedCollections > 0) {
      storage.saveCollections(collections);
      collectionProvider.refresh();
      vscode.window.showInformationMessage(t('info.importedCollections', { count: importedCollections }));
    } else if (options.openApiOnly) {
      vscode.window.showWarningMessage(t('warn.noOpenApiDocuments'));
    }

    const importedEnvironmentCount = importedOpenApi.environments.length + importedPostman.environments.length;
    if (importedEnvironmentCount > 0) {
      storage.saveEnvironments(environments);
      environmentProvider.reloadFromStorage();
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
      vscode.window.showInformationMessage(t('info.importedEnvironments', { count: importedEnvironmentCount }));
    }

    if (!options.openApiOnly && (stats.skippedCollections > 0 || stats.skippedItems > 0)) {
      vscode.window.showWarningMessage(t('warn.skippedImportData', {
        collections: stats.skippedCollections,
        items: stats.skippedItems,
      }));
    }
  }

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
        prompt: t('input.importCurl.prompt'),
        placeHolder: t('input.importCurl.placeholder'),
        ignoreFocusOut: true,
      });
      if (!input) { return; }

      try {
        const req = CurlService.parse(input);
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadRequest(req);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(t('error.parseCurl', { message: err instanceof Error ? err.message : String(err) }));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.copyAsCurl', (node: CollectionNode) => {
      if (node.kind === 'request' && node.item.request) {
        const curl = CurlService.generate(
          RequestExportService.resolve(node.item.request, environmentProvider.getActiveVariables(), {
            defaultHeaders: storage.getDefaultHeaders(),
            skipDefaultHeaders: node.item.request.skipDefaultHeaders === true,
          })
        );
        vscode.env.clipboard.writeText(curl);
        vscode.window.showInformationMessage(t('info.copiedCurl'));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.importCollection', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: { 'JSON Files': ['json'] },
        openLabel: t('action.import'),
      });
      if (!uris || uris.length === 0) { return; }
      await importStructuredDocuments(uris);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.importOpenApi', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: { 'OpenAPI JSON': ['json'] },
        openLabel: t('action.import'),
      });
      if (!uris || uris.length === 0) { return; }
      await importStructuredDocuments(uris, { openApiOnly: true });
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
      vscode.window.showInformationMessage(t('info.exportedPostmanCollection', { path: uri.fsPath }));
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
      vscode.window.showInformationMessage(t('info.exportedPostmanEnvironment', { path: uri.fsPath }));
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
      inputBox.placeholder = t('filter.collections.placeholder');
      inputBox.value = collectionProvider.filterText;
      inputBox.title = t('filter.collections.title');
      inputBox.onDidChangeValue((value) => {
        collectionProvider.filterText = value;
        updateCollectionDescription();
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
      updateCollectionDescription();
      vscode.commands.executeCommand('setContext', 'arc.collectionFilterActive', false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.filterHistory', () => {
      const inputBox = vscode.window.createInputBox();
      inputBox.placeholder = t('filter.history.placeholder');
      inputBox.value = historyProvider.filterText;
      inputBox.title = t('filter.history.title');
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
        vscode.window.showInformationMessage(t('info.noRequestsToRun'));
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
        `${t('warn.deletePinned.confirm', { count: 1, suffix: 'y' })}\n${entry.request.method} ${entry.request.url}`,
        { modal: true },
        t('warn.delete')
      );
      if (confirm === t('warn.delete')) {
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
        vscode.window.showInformationMessage(t('info.noPinnedHistoryToDelete'));
        return;
      }

      const msg = pinned.length > 0
        ? t('warn.clearHistory.confirmPinned', {
            count: unpinnedCount,
            suffix: unpinnedCount === 1 ? 'y' : 'ies',
            pinned: pinned.length,
            pinnedSuffix: pinned.length === 1 ? 'y' : 'ies',
          })
        : t('warn.clearHistory.confirm');

      const confirm = await vscode.window.showWarningMessage(msg, { modal: true }, t('warn.delete'));
      if (confirm === t('warn.delete')) {
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
        { label: `$(circle-slash) ${t('picker.deactivateEnvironment')}`, envId: null },
        ...envs.map((env) => ({
          label: `$(symbol-variable) ${env.name}`,
          description: env.id === environmentProvider.activeEnvId ? `(${t('environment.active')})` : '',
          envId: env.id,
        })),
      ];

      const selected = await vscode.window.showQuickPick(picks, { placeHolder: t('picker.selectEnvironment') });
      if (selected === undefined) { return; }

      environmentProvider.activeEnvId = selected.envId;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.changeDisplayLanguage', async () => {
      const current = LocalizationService.getDisplayLanguage();
      const picks = SUPPORTED_DISPLAY_LANGUAGES.map((language) => ({
        label: LocalizationService.getDisplayLanguageLabel(language),
        description: language === current ? t('picker.current') : undefined,
        language,
      }));

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: t('picker.selectDisplayLanguage'),
      });
      if (!selected || selected.language === current) { return; }

      await vscode.workspace.getConfiguration('arc-client').update(
        'displayLanguage',
        selected.language,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage(t('info.displayLanguageUpdated', {
        language: LocalizationService.getDisplayLanguageLabel(selected.language),
      }));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('arc.changeWorkspaceProfile', async () => {
      const current = storage.getWorkspaceProfileName();
      const existingProfiles = storage.listProfiles();
      const existingCustomProfiles = existingProfiles.filter((profileName) => profileName !== 'default');
      const picks: Array<vscode.QuickPickItem & { profileName: string }> = [
        ...storage.listProfiles().map((profileName) => ({
          label: profileName,
          description: profileName === current ? t('picker.current') : undefined,
          detail: profileName === 'default' ? t('picker.workspaceProfileDefaultDescription') : undefined,
          profileName,
        })),
        {
          label: t('picker.createWorkspaceProfile'),
          description: t('picker.createWorkspaceProfileDescription'),
          profileName: '__create__',
        },
      ];

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: t('picker.selectWorkspaceProfile'),
      });
      if (!selected) { return; }

      let nextProfile = selected.profileName;
      let isCreatingNewProfile = false;
      if (nextProfile === '__create__') {
        const entered = await vscode.window.showInputBox({
          prompt: t('input.workspaceProfile.prompt'),
          placeHolder: t('input.workspaceProfile.placeholder'),
          ignoreFocusOut: true,
          value: current === 'default' ? '' : current,
        });
        const normalized = String(entered || '').trim();
        if (!normalized) { return; }
        nextProfile = normalized;
        isCreatingNewProfile = existingProfiles.indexOf(nextProfile) < 0;
      }

      if (nextProfile === current) { return; }

      await RequestPanel.flushCurrentPanelState();
      await vscode.workspace.getConfiguration('arc-client').update(
        'workspaceProfile',
        nextProfile,
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
          ? vscode.ConfigurationTarget.Workspace
          : vscode.ConfigurationTarget.Global
      );

      if (isCreatingNewProfile) {
        const createdKey = existingCustomProfiles.length === 0
          ? 'info.workspaceProfileFirstCreated'
          : 'info.workspaceProfileCreated';
        vscode.window.showInformationMessage(t(createdKey, { profile: nextProfile }));
      } else {
        vscode.window.showInformationMessage(t('info.workspaceProfileUpdated', { profile: nextProfile }));
      }
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

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    const displayLanguageChanged = event.affectsConfiguration('arc-client.displayLanguage');
    const workspaceProfileChanged = event.affectsConfiguration('arc-client.workspaceProfile');
    if (!displayLanguageChanged && !workspaceProfileChanged) { return; }

    if (displayLanguageChanged) {
      envStatusBar.tooltip = t('statusBar.switchEnvironment');
      updateLocalizedViewTitles();
      GuidePanel.refreshCurrentPanel(context.extensionUri);
    }

    if (workspaceProfileChanged) {
      refreshWorkspaceScopedState({ reloadPanel: true });
      return;
    }

    updateStatusBar(envStatusBar, environmentProvider);
    collectionProvider.refresh();
    historyProvider.refresh();
    environmentProvider.refresh();
    RequestPanel.refreshCurrentPanel();
  }));
}

function updateStatusBar(item: vscode.StatusBarItem, provider: EnvironmentTreeProvider): void {
  const t = (key: string, params?: Record<string, string | number>) => LocalizationService.t(key, params);
  const name = provider.getActiveEnvironmentName();
  if (name) {
    item.text = `$(symbol-variable) ${name}`;
  } else {
    item.text = `$(symbol-variable) ${t('picker.deactivateEnvironment')}`;
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
      name: name || 'Imported Folder',
      children,
    };
  }

  if (value.type === 'request' || (!value.type && hasRequest)) {
    const request = normalizeImportedRequest(value.request, name || 'Imported Request');
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
