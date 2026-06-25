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
import {
  LocalizationService,
  SUPPORTED_DISPLAY_LANGUAGES,
  SUPPORTED_REQUEST_PANEL_THEMES,
} from './services/LocalizationService';
import { RequestExportService } from './services/RequestExportService';

const VALID_HTTP_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

interface ImportStats {
  skippedCollections: number;
  skippedItems: number;
}

export function activate(context: vscode.ExtensionContext) {
  const t = (key: string, params?: Record<string, string | number>) => LocalizationService.t(key, params);
  const storage = new StorageService(context);
  if (storage.didMigrateLegacyStorage()) {
    vscode.window.showInformationMessage('Migrated existing Arc Client data into Tessra.');
  }
  const legacyMigrationError = storage.getLegacyMigrationError();
  if (legacyMigrationError) {
    vscode.window.showErrorMessage(`Failed to migrate existing Arc Client data into Tessra: ${legacyMigrationError}`);
  }
  const collectionProvider = new CollectionTreeProvider(storage);
  const historyProvider = new HistoryTreeProvider(storage);
  const environmentProvider = new EnvironmentTreeProvider(storage);

  const collectionTreeView = vscode.window.createTreeView('tessra-collections', {
    treeDataProvider: collectionProvider,
    showCollapseAll: true,
    dragAndDropController: collectionProvider,
  });
  const historyTreeView = vscode.window.createTreeView('tessra-history', {
    treeDataProvider: historyProvider,
    dragAndDropController: historyProvider,
  });

  // Update collection view description with counts and filter text.
  function updateCollectionDescription(): void {
    const visible = collectionProvider.visibleCollectionCount;
    const total = collectionProvider.totalCollectionCount;
    const filter = collectionProvider.filterText.trim();
    const parts: string[] = [];
    if (total > 0) { parts.push(filter ? `${visible}/${total}` : String(total)); }
    if (filter) { parts.push(filter); }
    collectionTreeView.description = parts.length > 0 ? parts.join(' | ') : undefined;
    collectionTreeView.description = parts.length > 0 ? parts.join(' | ') : undefined;
    collectionTreeView.description = parts.length > 0 ? parts.join(' | ') : undefined;
  }

  function updateHistoryDescription(): void {
    const count = storage.getHistory().length;
    const visible = historyProvider.visibleCount;
    const filter = historyProvider.filterText.trim();
    const parts: string[] = [];
    if (count > 0) { parts.push(filter ? `${visible}/${count}` : String(count)); }
    if (filter) { parts.push(filter); }
    historyTreeView.description = parts.length > 0 ? parts.join(' | ') : undefined;
  }
  historyProvider.onCountChanged = () => updateHistoryDescription();
  collectionProvider.onDidChangeTreeData(() => updateCollectionDescription());
  historyProvider.onDidChangeTreeData(() => updateHistoryDescription());
  updateCollectionDescription();
  updateHistoryDescription();
  const environmentTreeView = vscode.window.createTreeView('tessra-environments', {
    treeDataProvider: environmentProvider,
    dragAndDropController: environmentProvider,
  });
  context.subscriptions.push(collectionTreeView, historyTreeView, environmentTreeView);

  function updateLocalizedViewTitles(): void {
    collectionTreeView.title = t('view.collections');
    environmentTreeView.title = t('view.environments');
    historyTreeView.title = t('view.history');
  }

  async function migrateLegacyRequestPanelTheme(): Promise<void> {
    const config = vscode.workspace.getConfiguration('tessra');
    const inspected = config.inspect<string>('requestPanelTheme');
    if (!inspected) { return; }

    const updates: Thenable<void>[] = [];
    if (inspected.globalValue === 'glossy') {
      updates.push(config.update('requestPanelTheme', 'default', vscode.ConfigurationTarget.Global));
    }
    if (inspected.workspaceValue === 'glossy') {
      updates.push(config.update('requestPanelTheme', 'default', vscode.ConfigurationTarget.Workspace));
    }
    if (updates.length === 0) { return; }

    try {
      await Promise.all(updates);
    } catch {
      // Best-effort cleanup for the old theme value; keep the extension running if it fails.
    }
  }

  updateLocalizedViewTitles();
  void migrateLegacyRequestPanelTheme();

  RequestPanel.storage = storage;
  RequestPanel.historyProvider = historyProvider;
  RequestPanel.collectionProvider = collectionProvider;
  RequestPanel.environmentProvider = environmentProvider;

  const envStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  envStatusBar.command = 'tessra.switchEnvironment';
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

  function refreshEnvironmentState(): void {
    environmentProvider.reloadFromStorage();
    environmentProvider.refresh();
    updateStatusBar(envStatusBar, environmentProvider);
    RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
  }

  function getTessraVersion(): string | undefined {
    const packageJson = context.extension.packageJSON as { version?: unknown };
    return typeof packageJson.version === 'string' ? packageJson.version : undefined;
  }

  function formatBackupFileTimestamp(date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      '-',
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('');
  }

  function getWorkspaceBackupDefaultName(): string {
    return `tessra-backup-${formatBackupFileTimestamp()}.tessra-backup.json`;
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
      refreshEnvironmentState();
      vscode.window.showInformationMessage(t('info.importedEnvironments', { count: importedEnvironmentCount }));
    }

    if (!options.openApiOnly && (stats.skippedCollections > 0 || stats.skippedItems > 0)) {
      vscode.window.showWarningMessage(t('warn.skippedImportData', {
        collections: stats.skippedCollections,
        items: stats.skippedItems,
      }));
    }
  }

  async function importEnvironmentDocuments(uris: readonly vscode.Uri[]): Promise<void> {
    const environments = storage.getEnvironments();
    let importedCount = 0;

    for (const uri of uris) {
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const data = JSON.parse(Buffer.from(raw).toString('utf-8'));
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          const environment = ImportExportService.importPostmanEnvironmentDocument(item);
          environment.id = createImportId();
          environment.name = createUniqueImportedEnvironmentName(environment.name, environments);
          environments.push(environment);
          importedCount++;
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

    if (importedCount > 0) {
      storage.saveEnvironments(environments);
      refreshEnvironmentState();
      vscode.window.showInformationMessage(t('info.importedEnvironments', { count: importedCount }));
    }
  }

  async function showImportPicker(): Promise<void> {
    const selected = await vscode.window.showQuickPick(
      [
        { label: t('picker.importCollection'), command: 'tessra.importCollection' },
        { label: t('picker.importCurl'), command: 'tessra.importCurl' },
        { label: t('picker.importOpenApi'), command: 'tessra.importOpenApi' },
        { label: t('picker.importWorkspaceBackup'), command: 'tessra.importWorkspaceBackup' },
      ],
      { placeHolder: t('picker.selectImportAction') }
    );
    if (!selected) { return; }

    await vscode.commands.executeCommand(selected.command);
  }

  function isCollectionExportNode(value: unknown): value is Extract<CollectionNode, { kind: 'collection' }> {
    return typeof value === 'object'
      && value !== null
      && (value as { kind?: unknown }).kind === 'collection';
  }

  function isEnvironmentExportTarget(value: unknown): value is Environment {
    if (typeof value !== 'object' || value === null) { return false; }
    const candidate = value as Partial<Environment>;
    return typeof candidate.id === 'string'
      && typeof candidate.name === 'string'
      && Array.isArray(candidate.variables);
  }

  async function pickCollectionToExport(): Promise<Collection | undefined> {
    const collections = storage.getCollections();
    if (collections.length === 0) {
      vscode.window.showInformationMessage(t('info.noCollectionsToExport'));
      return undefined;
    }

    const selected = await vscode.window.showQuickPick(
      collections.map((collection) => ({
        label: collection.name,
        description: collection.id,
        collection,
      })),
      { placeHolder: t('picker.selectCollectionToExport') }
    );
    return selected?.collection;
  }

  async function pickEnvironmentToExport(): Promise<Environment | undefined> {
    const environments = storage.getEnvironments();
    if (environments.length === 0) {
      vscode.window.showInformationMessage(t('info.noEnvironmentsToExport'));
      return undefined;
    }

    const selected = await vscode.window.showQuickPick(
      environments.map((environment) => ({
        label: environment.name,
        description: environment.id,
        environment,
      })),
      { placeHolder: t('picker.selectEnvironmentToExport') }
    );
    return selected?.environment;
  }

  async function resolveCollectionExportTarget(node?: unknown): Promise<Collection | undefined> {
    if (isCollectionExportNode(node)) { return node.collection; }
    return pickCollectionToExport();
  }

  async function resolveEnvironmentExportTarget(env?: unknown): Promise<Environment | undefined> {
    if (isEnvironmentExportTarget(env)) { return env; }
    return pickEnvironmentToExport();
  }

  async function exportCollectionDocument(collection: Collection): Promise<void> {
    const defaultName = `${sanitizeFilename(collection.name)}.postman_collection.json`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { 'JSON Files': ['json'] },
    });
    if (!uri) { return; }

    const document = ImportExportService.exportCollection(collection);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(document, null, 2), 'utf-8'));
    vscode.window.showInformationMessage(t('info.exportedPostmanCollection', { path: uri.fsPath }));
  }

  async function exportEnvironmentDocument(env: Environment): Promise<void> {
    const defaultName = `${sanitizeFilename(env.name)}.postman_environment.json`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { 'JSON Files': ['json'] },
    });
    if (!uri) { return; }

    const document = ImportExportService.exportEnvironment(env);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(document, null, 2), 'utf-8'));
    vscode.window.showInformationMessage(t('info.exportedPostmanEnvironment', { path: uri.fsPath }));
  }

  async function exportCollectionCommand(node?: unknown): Promise<void> {
    const collection = await resolveCollectionExportTarget(node);
    if (!collection) { return; }
    await exportCollectionDocument(collection);
  }

  async function exportEnvironmentCommand(env?: unknown): Promise<void> {
    const environment = await resolveEnvironmentExportTarget(env);
    if (!environment) { return; }
    await exportEnvironmentDocument(environment);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.newRequest', () => {
      RequestPanel.show(context.extensionUri, !!RequestPanel.currentPanel);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.createCollection', () => {
      collectionProvider.createCollection();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.createFolder', (node: CollectionNode) => {
      collectionProvider.createFolder(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.rename', (node: CollectionNode) => {
      collectionProvider.rename(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.delete', (node: CollectionNode) => {
      collectionProvider.delete(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.duplicateRequest', (node: CollectionNode) => {
      collectionProvider.duplicate(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.saveRequestAs', (node: CollectionNode) => {
      collectionProvider.saveAs(node);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.importData', async () => {
      await showImportPicker();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.importCurl', async () => {
      const input = await vscode.window.showInputBox({
        prompt: t('input.importCurl.prompt'),
        placeHolder: t('input.importCurl.placeholder'),
        ignoreFocusOut: true,
      });
      if (!input) { return; }

      try {
        const result = CurlService.parseWithWarnings(input);
        const req = result.request;
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadRequest(req);
        if (result.warnings.length > 0) {
          vscode.window.showWarningMessage(t('warn.importCurlWarnings', {
            count: result.warnings.length,
            warnings: result.warnings.slice(0, 4).join('; '),
          }));
        }
      } catch (err: unknown) {
        vscode.window.showErrorMessage(t('error.parseCurl', { message: err instanceof Error ? err.message : String(err) }));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.copyAsCurl', (node: CollectionNode) => {
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
    vscode.commands.registerCommand('tessra.importCollection', async () => {
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
    vscode.commands.registerCommand('tessra.importOpenApi', async () => {
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
    vscode.commands.registerCommand('tessra.importEnvironment', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: { 'JSON Files': ['json'] },
        openLabel: t('action.import'),
      });
      if (!uris || uris.length === 0) { return; }
      await importEnvironmentDocuments(uris);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.exportWorkspaceBackup', async () => {
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(getWorkspaceBackupDefaultName()),
        filters: { 'JSON Files': ['json'] },
      });
      if (!uri) { return; }

      try {
        const backup = storage.exportWorkspaceBackup(getTessraVersion());
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(backup, null, 2), 'utf-8'));
        vscode.window.showInformationMessage(t('info.exportedWorkspaceBackup', { path: uri.fsPath }));
        vscode.window.showWarningMessage(t('warn.workspaceBackupSecrets'));
      } catch (err: unknown) {
        vscode.window.showErrorMessage(t('error.exportWorkspaceBackupFailed', {
          message: err instanceof Error ? err.message : String(err),
        }));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.importWorkspaceBackup', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'JSON Files': ['json'] },
        openLabel: t('action.import'),
      });
      const uri = uris?.[0];
      if (!uri) { return; }

      let backup: unknown;
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        backup = JSON.parse(Buffer.from(raw).toString('utf-8'));
        backup = storage.validateWorkspaceBackup(backup);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(t('error.workspaceBackupInvalid', {
          message: err instanceof Error ? err.message : String(err),
        }));
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        t('warn.workspaceBackupImportConfirm'),
        { modal: true },
        t('action.import')
      );
      if (confirm !== t('action.import')) { return; }

      try {
        await RequestPanel.flushCurrentPanelState();
        const result = storage.importWorkspaceBackup(backup, getTessraVersion());
        refreshWorkspaceScopedState({ reloadPanel: true });
        vscode.window.showInformationMessage(t('info.importedWorkspaceBackup', {
          collections: result.collections,
          environments: result.environments,
          active: result.activeEnvironmentRestored
            ? t('workspaceBackup.activeRestored')
            : t('workspaceBackup.activeCleared'),
          backup: result.preImportBackupPath,
        }));
      } catch (err: unknown) {
        vscode.window.showErrorMessage(t('error.importWorkspaceBackupFailed', {
          message: err instanceof Error ? err.message : String(err),
        }));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.exportCollection', exportCollectionCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.exportEnvironment', exportEnvironmentCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.exportPostmanCollection', exportCollectionCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.exportPostmanEnvironment', exportEnvironmentCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.collapseAll', () => {
      vscode.commands.executeCommand('workbench.actions.treeView.tessra-collections.collapseAll');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.filterCollections', () => {
      const inputBox = vscode.window.createInputBox();
      inputBox.placeholder = t('filter.collections.placeholder');
      inputBox.value = collectionProvider.filterText;
      inputBox.title = t('filter.collections.title');
      inputBox.onDidChangeValue((value) => {
        collectionProvider.filterText = value;
        updateCollectionDescription();
        vscode.commands.executeCommand('setContext', 'tessra.collectionFilterActive', !!value);
      });
      inputBox.onDidAccept(() => inputBox.hide());
      inputBox.onDidHide(() => inputBox.dispose());
      inputBox.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.clearCollectionFilter', () => {
      collectionProvider.filterText = '';
      updateCollectionDescription();
      vscode.commands.executeCommand('setContext', 'tessra.collectionFilterActive', false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.filterHistory', () => {
      const inputBox = vscode.window.createInputBox();
      inputBox.placeholder = t('filter.history.placeholder');
      inputBox.value = historyProvider.filterText;
      inputBox.title = t('filter.history.title');
      inputBox.onDidChangeValue((value) => {
        historyProvider.filterText = value;
        updateHistoryDescription();
        vscode.commands.executeCommand('setContext', 'tessra.historyFilterActive', !!value);
      });
      inputBox.onDidAccept(() => inputBox.hide());
      inputBox.onDidHide(() => inputBox.dispose());
      inputBox.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.clearHistoryFilter', () => {
      historyProvider.filterText = '';
      updateHistoryDescription();
      vscode.commands.executeCommand('setContext', 'tessra.historyFilterActive', false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.loadFromHistory', (entry: HistoryEntry) => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadRequest(entry.request);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.loadFromCollection', (node: CollectionNode) => {
      if (node.kind === 'request' && node.item.request) {
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadRequest(node.item.request);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.runCollection', (node: CollectionNode) => {
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
    vscode.commands.registerCommand('tessra.pinHistory', (entry: HistoryEntry) => {
      storage.setHistoryPin(entry.id, true);
      historyProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.unpinHistory', (entry: HistoryEntry) => {
      storage.setHistoryPin(entry.id, false);
      historyProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.deletePinnedHistory', async (entry: HistoryEntry) => {
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
    vscode.commands.registerCommand('tessra.clearHistory', async () => {
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
    vscode.commands.registerCommand('tessra.openHistorySettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'tessra.historyMaxItems');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.createEnvironment', () => {
      environmentProvider.createEnvironment();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.renameEnvironment', (env: Environment) => {
      environmentProvider.renameEnvironment(env);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.deleteEnvironment', (env: Environment) => {
      environmentProvider.deleteEnvironment(env).then(() => {
        updateStatusBar(envStatusBar, environmentProvider);
        RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.editEnvironment', (env: Environment) => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadEnvironment(env);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.editDefaultHeaders', () => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadDefaultHeaders();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.setActiveEnvironment', (env: Environment) => {
      environmentProvider.activeEnvId = env.id;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(env.name);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.deactivateEnvironment', () => {
      environmentProvider.activeEnvId = null;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(null);
    })
  );

  // Environment click: single click edits variables, double click toggles active state.
  let envClickTimer: ReturnType<typeof setTimeout> | null = null;
  let envLastClickId: string | null = null;
  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.onEnvironmentClick', (env: Environment) => {
      if (envLastClickId === env.id && envClickTimer) {
        // Double click: toggle active state and show the variable editor.
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
        // Single click: wait briefly before opening the variable editor.
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
    vscode.commands.registerCommand('tessra.switchEnvironment', async () => {
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
    vscode.commands.registerCommand('tessra.changeDisplayLanguage', async () => {
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

      await vscode.workspace.getConfiguration('tessra').update(
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
    vscode.commands.registerCommand('tessra.changeRequestPanelTheme', async () => {
      const current = LocalizationService.getRequestPanelTheme();
      const language = LocalizationService.getDisplayLanguage();
      const picks = SUPPORTED_REQUEST_PANEL_THEMES.map((theme) => ({
        label: LocalizationService.getRequestPanelThemeLabel(theme, language),
        description: theme === current ? t('picker.current') : undefined,
        theme,
      }));

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: t('picker.selectRequestPanelTheme'),
      });
      if (!selected || selected.theme === current) { return; }

      await vscode.workspace.getConfiguration('tessra').update(
        'requestPanelTheme',
        selected.theme,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage(t('info.requestPanelThemeUpdated', {
        theme: LocalizationService.getRequestPanelThemeLabel(selected.theme, language),
      }));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('tessra.changeWorkspaceProfile', async () => {
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
      await vscode.workspace.getConfiguration('tessra').update(
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
    vscode.commands.registerCommand('tessra.openGuide', () => {
      GuidePanel.show(context.extensionUri);
    })
  );

  const requestPanelSerializer = vscode.window.registerWebviewPanelSerializer('tessra.requestPanel', {
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
    const displayLanguageChanged = event.affectsConfiguration('tessra.displayLanguage');
    const requestPanelThemeChanged = event.affectsConfiguration('tessra.requestPanelTheme');
    const workspaceProfileChanged = event.affectsConfiguration('tessra.workspaceProfile');
    if (!displayLanguageChanged && !requestPanelThemeChanged && !workspaceProfileChanged) { return; }

    if (displayLanguageChanged) {
      envStatusBar.tooltip = t('statusBar.switchEnvironment');
      updateLocalizedViewTitles();
      GuidePanel.refreshCurrentPanel(context.extensionUri);
    }

    if (workspaceProfileChanged) {
      refreshWorkspaceScopedState({ reloadPanel: true });
      return;
    }

    if (displayLanguageChanged) {
      updateStatusBar(envStatusBar, environmentProvider);
      collectionProvider.refresh();
      historyProvider.refresh();
      environmentProvider.refresh();
    }

    if (displayLanguageChanged || requestPanelThemeChanged) {
      RequestPanel.refreshCurrentPanel();
    }
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

function createUniqueImportedEnvironmentName(name: string, environments: Environment[]): string {
  const existingNames = new Set(environments.map((environment) => environment.name));
  if (!existingNames.has(name)) { return name; }

  const importedName = `${name} (Imported)`;
  if (!existingNames.has(importedName)) { return importedName; }

  let index = 2;
  let candidate = `${name} (Imported ${index})`;
  while (existingNames.has(candidate)) {
    index++;
    candidate = `${name} (Imported ${index})`;
  }
  return candidate;
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

function hasImportedScripts(scripts: RequestScripts): boolean {
  return !!(scripts.preRequest.trim() || scripts.test.trim());
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
  const scripts = normalizeImportedScripts(value.scripts);
  const hasScripts = hasImportedScripts(scripts);

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
    scripts,
    disableScripts: hasScripts,
    scriptsTrusted: hasScripts ? false : true,
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
