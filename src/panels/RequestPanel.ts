import * as vscode from 'vscode';
import { HttpService } from '../services/HttpService';
import { WebSocketService } from '../services/WebSocketService';
import { StorageService } from '../services/StorageService';
import { CollectionTreeProvider } from '../providers/CollectionTreeProvider';
import { HistoryTreeProvider } from '../providers/HistoryTreeProvider';
import { EnvironmentTreeProvider } from '../providers/EnvironmentTreeProvider';
import {
  MessageType,
  Request,
  AuthConfig,
  KeyValue,
  Environment,
  CollectionItem,
  RequestBodyType,
  CompareResponsesMessage,
  FormDataField,
  StoredTabState,
} from '../models/types';
import { CurlService } from '../services/CurlService';
import { CodegenService } from '../services/CodegenService';
import { ResponseCompareService } from '../services/ResponseCompareService';
import { LocalizationService } from '../services/LocalizationService';
import { RequestExportService } from '../services/RequestExportService';
import { RequestExecutor } from './requestPanel/RequestExecutor';
import { CollectionRunner } from './requestPanel/CollectionRunner';
import { WebSocketManager } from './requestPanel/WebSocketManager';
import {
  createEmptyScripts,
  normalizeBodyType,
  RequestTiming,
} from './requestPanel/requestUtils';
import {
  isIncomingWebviewMessage,
  shouldQueueWebviewMessage,
} from './requestPanel/messages';
import { getRequestPanelHtml } from './requestPanel/requestPanelHtml';

// Request webview panel manager with multi-tab support.
export class RequestPanel {
  public static currentPanel: RequestPanel | undefined;
  public static storage: StorageService;
  public static historyProvider: HistoryTreeProvider;
  public static collectionProvider: CollectionTreeProvider;
  public static environmentProvider: EnvironmentTreeProvider;
  private static readonly viewType = 'tessra.requestPanel';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly httpService: HttpService;
  private readonly requestExecutor: RequestExecutor;
  private readonly collectionRunner: CollectionRunner;
  private readonly webSocketManager: WebSocketManager;
  private disposables: vscode.Disposable[] = [];
  private isDisposed = false;
  private webviewReady = false;
  private pendingWebviewMessages: unknown[] = [];
  private pendingFlushResolvers: Array<() => void> = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.httpService = new HttpService();
    this.webSocketManager = new WebSocketManager(new WebSocketService(), {
      postMessage: (message: unknown) => this.postMessage(message),
      getActiveVariables: () => RequestPanel.environmentProvider.getActiveVariables(),
      getDefaultHeaders: () => RequestPanel.storage.getDefaultHeaders(),
      getAllowInsecureCertificates: () => this.getAllowInsecureCertificates(),
    });
    const executionHost = {
      postMessage: (message: unknown) => this.postMessage(message),
      getActiveVariables: () => RequestPanel.environmentProvider.getActiveVariables(),
      getDefaultHeaders: () => RequestPanel.storage.getDefaultHeaders(),
      getAllowInsecureCertificates: () => this.getAllowInsecureCertificates(),
      saveActiveEnvironmentVariables: (variables: KeyValue[]) => this.saveActiveEnvironmentVariables(variables),
      saveToHistory: (
        request: Request,
        response: { status: number; statusText: string; time: number } | null,
        timing?: RequestTiming
      ) => this.saveToHistory(request, response, timing),
      refreshHistory: () => RequestPanel.historyProvider.refresh(),
    };
    this.requestExecutor = new RequestExecutor(this.httpService, executionHost);
    this.collectionRunner = new CollectionRunner(this.httpService, executionHost);

    this.reloadWebview();

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Restore saved tab state.
    this.restoreTabState();
  }

  // Prepare saved tab state for the webview.
  private restoreTabState() {
    const state = RequestPanel.storage.getTabState();
    if (state && (state.tabs.length > 0 || state.compareSettings)) {
      this.pendingRestore = state;
    }
  }
  private pendingRestore: StoredTabState | null = null;

  private postMessage(message: unknown): void {
    if (this.isDisposed) { return; }
    if (!this.webviewReady && shouldQueueWebviewMessage(message)) {
      this.pendingWebviewMessages.push(message);
      return;
    }

    void this.panel.webview.postMessage(message);
  }

  private flushPendingWebviewMessages(): void {
    if (this.isDisposed || !this.webviewReady || this.pendingWebviewMessages.length === 0) { return; }

    const messages = this.pendingWebviewMessages.splice(0);
    for (const message of messages) {
      void this.panel.webview.postMessage(message);
    }
  }

  private getAllowInsecureCertificates(): boolean {
    return vscode.workspace.getConfiguration('tessra').get<boolean>('allowInsecureCertificates', false);
  }

  private static createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  // Show the panel. createNewTab=true opens an additional tab.
  public static show(extensionUri: vscode.Uri, createNewTab: boolean = false) {
    if (RequestPanel.currentPanel) {
      if (!RequestPanel.currentPanel.webviewReady) {
        RequestPanel.currentPanel.reloadWebview();
      }
      RequestPanel.currentPanel.panel.reveal();
      if (createNewTab) {
        RequestPanel.currentPanel.newTab();
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      RequestPanel.viewType,
      'Tessra',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
      }
    );

    RequestPanel.currentPanel = new RequestPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    RequestPanel.currentPanel = new RequestPanel(panel, extensionUri);
  }

  public static refreshCurrentPanel(): void {
    if (!RequestPanel.currentPanel) { return; }
    RequestPanel.currentPanel.refreshLocalization();
  }

  public static async flushCurrentPanelState(): Promise<void> {
    if (!RequestPanel.currentPanel) { return; }
    await RequestPanel.currentPanel.flushTabStateNow();
  }

  public static reloadCurrentPanelForStorageChange(): void {
    if (!RequestPanel.currentPanel) { return; }
    RequestPanel.currentPanel.pendingRestore = RequestPanel.storage.getTabState();
    RequestPanel.currentPanel.reloadWebview();
  }

  private reloadWebview(): void {
    this.webviewReady = false;
    this.panel.webview.html = this.getHtmlContent();
  }

  private flushTabStateNow(): Promise<void> {
    if (!this.webviewReady || this.isDisposed) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) { return; }
        settled = true;
        this.pendingFlushResolvers = this.pendingFlushResolvers.filter((item) => item !== finish);
        resolve();
      };

      this.pendingFlushResolvers.push(finish);
      this.postMessage({ type: MessageType.FlushTabState });
      setTimeout(finish, 250);
    });
  }

  private refreshLocalization(): void {
    if (!this.webviewReady) {
      this.reloadWebview();
      return;
    }

    const displayLanguage = LocalizationService.getDisplayLanguage();
    const requestPanelTheme = LocalizationService.getRequestPanelTheme();
    this.postMessage({
      type: MessageType.UpdateLocalization,
      displayLanguage,
      strings: LocalizationService.getStrings(displayLanguage),
      dateLocale: LocalizationService.getDateLocale(displayLanguage),
      requestPanelTheme,
    });
  }

  public newTab() {
    this.postMessage({ type: 'newTab' });
  }

  public loadRequest(req: Request) {
    this.postMessage({
      type: MessageType.LoadRequest,
      requestId: req.id,
      requestType: req.requestType,
      method: req.method,
      url: req.url,
      headers: req.headers ?? [],
      params: req.params ?? [],
      body: req.body ?? '',
      bodyType: normalizeBodyType(req.bodyType),
      formData: req.formData ?? [],
      binaryFilePath: req.binaryFilePath ?? '',
      auth: req.auth ?? { type: 'none' },
      scripts: req.scripts ?? createEmptyScripts(),
      timeout: req.timeout ?? 0,
      followRedirects: req.followRedirects === true,
      saveToHistory: req.saveToHistory !== false,
      tlsValidation: req.tlsValidation ?? 'default',
      maxResponseSizeKb: req.maxResponseSizeKb ?? 0,
      retryCount: req.retryCount ?? 0,
      retryDelayMs: req.retryDelayMs ?? 0,
      stopAfterHeaders: req.stopAfterHeaders === true,
      skipDefaultHeaders: req.skipDefaultHeaders === true,
      disableScripts: req.disableScripts === true,
      scriptsTrusted: req.scriptsTrusted !== false,
      webSocketKeepAliveEnabled: req.webSocketKeepAliveEnabled === true,
      webSocketKeepAliveIntervalSeconds: req.webSocketKeepAliveIntervalSeconds ?? 30,
      webSocketKeepAliveMessage: req.webSocketKeepAliveMessage ?? 'ping',
      name: req.name || `${req.method} ${req.url}`,
    });
  }

  public loadEnvironment(env: Environment) {
    this.postMessage({
      type: MessageType.LoadEnvironment,
      envId: env.id,
      envName: env.name,
      variables: env.variables,
    });
  }

  public loadDefaultHeaders() {
    this.sendDefaultHeadersToWebview(true);
  }

  public updateActiveEnv(envName: string | null) {
    const envId = RequestPanel.environmentProvider.activeEnvId;
    const variables = RequestPanel.environmentProvider.getActiveVariables();
    this.postMessage({
      type: MessageType.UpdateActiveEnv,
      envId,
      envName,
      variables,
      profileName: RequestPanel.storage.getWorkspaceProfileName(),
    });
    this.sendActiveVarsToWebview();
  }

  private sendDefaultHeadersToWebview(reveal = false): void {
    const headers = RequestPanel.storage.getDefaultHeaders();
    this.postMessage({
      type: MessageType.LoadDefaultHeaders,
      headers,
      reveal,
    });
  }

  // 컬렉션 전체 실행 (재귀적으로 하위 폴더 포함)
  public async runCollection(name: string, items: CollectionItem[]) {
    await this.collectionRunner.runCollection(name, items);
  }

  private async handleMessage(message: unknown) {
    if (!isIncomingWebviewMessage(message)) { return; }
    // Restore saved state after the webview finishes initializing.
    if (message.type === 'webviewReady') {
      this.webviewReady = true;
      // Read the latest saved state each time the webview reports readiness.
      // With retainContextWhenHidden disabled, VS Code can recreate the webview.
      const state = this.pendingRestore ?? RequestPanel.storage.getTabState();
      if (state && (state.tabs.length > 0 || state.compareSettings)) {
        this.postMessage({
          type: MessageType.RestoreTabState,
          tabs: state.tabs,
          activeIndex: state.activeIndex,
          compareSettings: state.compareSettings,
        });
      }
      this.pendingRestore = null;
      this.updateActiveEnv(RequestPanel.environmentProvider.getActiveEnvironmentName());
      this.sendDefaultHeadersToWebview(false);
      this.flushPendingWebviewMessages();
      return;
    }
    switch (message.type) {
      case MessageType.FlushedTabState: {
        const resolver = this.pendingFlushResolvers.shift();
        resolver?.();
        break;
      }
      case MessageType.SendRequest:
        await this.requestExecutor.execute(message);
        break;
      case MessageType.CancelRequest: {
        this.requestExecutor.cancel(message.tabId);
        break;
      }
      case MessageType.SaveRequest: {
        const result = await RequestPanel.collectionProvider.saveRequest({
          requestId: message.requestId,
          requestType: message.requestType,
          method: message.method,
          url: message.url,
          headers: message.headers ?? [],
          params: message.params ?? [],
          body: message.body ?? '',
          bodyType: normalizeBodyType(message.bodyType),
          formData: message.formData ?? [],
          binaryFilePath: message.binaryFilePath ?? '',
          auth: message.auth ?? { type: 'none' },
          scripts: message.scripts ?? createEmptyScripts(),
          timeout: message.timeout ?? 0,
          followRedirects: message.followRedirects === true,
          saveToHistory: message.saveToHistory !== false,
          tlsValidation: message.tlsValidation ?? 'default',
          maxResponseSizeKb: message.maxResponseSizeKb ?? 0,
          retryCount: message.retryCount ?? 0,
          retryDelayMs: message.retryDelayMs ?? 0,
          stopAfterHeaders: message.stopAfterHeaders === true,
          skipDefaultHeaders: message.skipDefaultHeaders === true,
          disableScripts: message.disableScripts === true,
          scriptsTrusted: message.scriptsTrusted !== false,
          webSocketKeepAliveEnabled: message.webSocketKeepAliveEnabled === true,
          webSocketKeepAliveIntervalSeconds: message.webSocketKeepAliveIntervalSeconds ?? 30,
          webSocketKeepAliveMessage: message.webSocketKeepAliveMessage ?? 'ping',
        });
        this.postMessage({
          type: MessageType.SaveRequestResult,
          saved: !!result,
          requestId: result?.requestId,
          name: result?.name,
        });
        break;
      }
      case MessageType.CopyAsCurl: {
        const exported = RequestExportService.resolve({
          method: message.method,
          url: message.url,
          headers: message.headers ?? [],
          params: message.params ?? [],
          body: message.body ?? '',
          bodyType: normalizeBodyType(message.bodyType),
          formData: message.formData ?? [],
          binaryFilePath: message.binaryFilePath ?? '',
          auth: message.auth ?? { type: 'none' },
        }, RequestPanel.environmentProvider.getActiveVariables(), {
          defaultHeaders: RequestPanel.storage.getDefaultHeaders(),
          skipDefaultHeaders: message.skipDefaultHeaders === true,
        });
        const curl = CurlService.generate(exported);
        vscode.env.clipboard.writeText(curl);
      vscode.window.showInformationMessage(LocalizationService.t('info.copiedCurl'));
        break;
      }
      case MessageType.CopyResponseBody:
        await vscode.env.clipboard.writeText(message.body ?? '');
      vscode.window.showInformationMessage(LocalizationService.t('panel.copiedResponseBody'));
        break;
      case MessageType.CopyToClipboard:
        await vscode.env.clipboard.writeText(message.text ?? '');
        break;
      case MessageType.SaveResponseBody: {
        const bodySaved = await this.saveResponseBody(message.body, message.contentType, message.bodyBase64);
        this.postMessage({ type: MessageType.SaveResponseBodyResult, saved: bodySaved });
        break;
      }
      case MessageType.SaveEnvironmentVars:
        RequestPanel.storage.updateEnvironmentVars(message.envId, message.variables);
        RequestPanel.environmentProvider.refresh();
        if (message.envId === RequestPanel.environmentProvider.activeEnvId) {
          this.sendActiveVarsToWebview();
        }
        break;
      case MessageType.SaveDefaultHeaders:
        RequestPanel.storage.saveDefaultHeaders(message.headers);
        this.sendDefaultHeadersToWebview(true);
        vscode.window.showInformationMessage(LocalizationService.t('panel.savedDefaultHeaders'));
        break;
      case MessageType.SaveTabState:
        RequestPanel.storage.saveTabState(message.tabs ?? [], message.activeIndex ?? 0, message.compareSettings);
        break;
      case MessageType.CompareResponses:
        await this.compareResponses(message);
        break;
      case MessageType.StopCollectionRun:
        this.collectionRunner.stop();
        break;
      case MessageType.RerunFailedCollection:
        await this.collectionRunner.rerunFailed(message.failedIndices ?? []);
        break;
      case MessageType.WebSocketConnect:
        this.webSocketManager.connect(message);
        break;
      case MessageType.WebSocketDisconnect:
        this.webSocketManager.disconnect(message.tabId);
        break;
      case MessageType.WebSocketSend:
        this.webSocketManager.send(message);
        break;
      case MessageType.PickFile: {
        const selected = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: LocalizationService.t('panel.selectFile'),
        });
        this.postMessage({
          type: MessageType.PickFileResult,
          target: message.target,
          rowId: message.rowId,
          filePath: selected?.[0]?.fsPath,
        });
        break;
      }
      case MessageType.GenerateCode: {
        await this.generateCode(message);
        break;
      }
      case MessageType.OpenDefaultHeaders:
        this.loadDefaultHeaders();
        break;
      case MessageType.SwitchEnvironment:
        await vscode.commands.executeCommand('tessra.switchEnvironment');
        break;
      case MessageType.ChangeWorkspaceProfile:
        await vscode.commands.executeCommand('tessra.changeWorkspaceProfile');
        break;
      case MessageType.OpenResponseUrl:
        await this.openResponseUrl(message.url);
        break;
      case MessageType.OpenGuide:
        await vscode.commands.executeCommand('tessra.openGuide');
        break;
    }
  }

  private async openResponseUrl(url: string): Promise<void> {
    try {
      if (!url) {
        return;
      }
      const uri = vscode.Uri.parse(url, true);
      if (uri.scheme !== 'http' && uri.scheme !== 'https') {
        vscode.window.showErrorMessage(LocalizationService.t('panel.openUrlUnsupportedScheme'));
        return;
      }
      await vscode.env.openExternal(uri);
    } catch (error) {
      vscode.window.showErrorMessage(
        LocalizationService.t('panel.failedOpenUrl', {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Send active environment variables to the webview.
  private sendActiveVarsToWebview() {
    const vars = RequestPanel.environmentProvider.getActiveVariables();
    const varKeys = vars.filter(v => v.enabled && v.key).map(v => v.key);
    const varValues = Object.fromEntries(
      vars
        .filter((variable) => variable.enabled !== false && variable.key)
        .map((variable) => [variable.key, variable.value])
    );
    this.postMessage({ type: 'activeVarKeys', varKeys, varValues });
  }

  private saveActiveEnvironmentVariables(variables: KeyValue[]): void {
    const activeEnvId = RequestPanel.environmentProvider.activeEnvId;
    if (!activeEnvId) { return; }
    RequestPanel.storage.updateEnvironmentVars(activeEnvId, variables);
    RequestPanel.environmentProvider.refresh();
    this.sendActiveVarsToWebview();
  }

  private saveToHistory(
    request: Request,
    response: { status: number; statusText: string; time: number } | null,
    timing?: RequestTiming
  ) {
    const maxItems = vscode.workspace.getConfiguration('tessra').get<number>('historyMaxItems', 500);
    const removed = RequestPanel.storage.addHistoryEntry({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      request,
      response,
      timestamp: Date.now(),
      startedAt: timing?.requestStartedAt,
      endedAt: timing?.requestEndedAt,
      durationMs: timing?.durationMs,
    });
    if (removed > 0) {
      vscode.window.setStatusBarMessage(`History: ${removed} old items removed (max ${maxItems})`, 3000);
    }
  }

  // Map Content-Type values to file extensions.
  private static contentTypeToExt(ct: string): string {
    const mime = ct.split(';')[0].trim().toLowerCase();
    const map: Record<string, string> = {
      'application/json': 'json',
      'application/xml': 'xml',
      'text/xml': 'xml',
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'js',
      'application/javascript': 'js',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'application/octet-stream': 'bin',
      'application/zip': 'zip',
      'application/gzip': 'gz',
    };
    return map[mime] || 'txt';
  }

  // Save response body to a file.
  private async saveResponseBody(body: string, contentType: string, bodyBase64?: string): Promise<boolean> {
    const ext = RequestPanel.contentTypeToExt(contentType);
    // Default filename: response_YYYYMMDD_HHmmss.ext.
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`response_${ts}.${ext}`),
      filters: {
        [`${ext.toUpperCase()} Files`]: [ext],
        'All Files': ['*'],
      },
    });
    if (!uri) { return false; }
    try {
      const bytes = bodyBase64 ? Buffer.from(bodyBase64, 'base64') : Buffer.from(body, 'utf-8');
      await vscode.workspace.fs.writeFile(uri, bytes);
      vscode.window.showInformationMessage(LocalizationService.t('panel.savedResponseBody', { path: uri.fsPath }));
      return true;
    } catch (err: unknown) {
      vscode.window.showErrorMessage(LocalizationService.t('panel.failedSaveResponseBody', { message: err instanceof Error ? err.message : String(err) }));
      return false;
    }
  }

  // Save two responses as temporary files and compare them in VS Code diff.
  private async compareResponses(message: CompareResponsesMessage): Promise<void> {
    const comparison = ResponseCompareService.prepareComparison(message.left, message.right, message.options);
    try {
      const basePath = RequestPanel.storage.getStoragePath();
      await ResponseCompareService.cleanupDiffArtifacts(basePath);
      const diffDir = vscode.Uri.joinPath(vscode.Uri.file(basePath), '.diff');
      await vscode.workspace.fs.createDirectory(diffDir);
      const ts = Date.now().toString(36);
      const uriL = vscode.Uri.joinPath(diffDir, `resp_left_${ts}.${comparison.left.extension}`);
      const uriR = vscode.Uri.joinPath(diffDir, `resp_right_${ts}.${comparison.right.extension}`);

      await vscode.workspace.fs.writeFile(uriL, new TextEncoder().encode(comparison.left.content));
      await vscode.workspace.fs.writeFile(uriR, new TextEncoder().encode(comparison.right.content));

      await vscode.commands.executeCommand('vscode.diff', uriL, uriR, comparison.title);
    } catch (err: unknown) {
      vscode.window.showErrorMessage(LocalizationService.t('panel.failedCompareResponses', { message: err instanceof Error ? err.message : String(err) }));
    }
  }

  // Format response bodies for diff view.
  private formatForDiff(body: string, ext: string): string {
    if (ext === 'json') {
      try { return JSON.stringify(JSON.parse(body), null, 2); } catch { /* Return original body when JSON parsing fails. */ }
    }
    if (ext === 'xml' || ext === 'html') {
      return RequestPanel.prettyXml(body);
    }
    return body;
  }

  private async generateCode(message: {
    method: Request['method'];
    url: string;
    headers: KeyValue[];
    params: KeyValue[];
    body: string;
    bodyType: RequestBodyType;
    formData?: FormDataField[];
    binaryFilePath?: string;
    auth: AuthConfig;
    skipDefaultHeaders?: boolean;
  }): Promise<void> {
    const target = await vscode.window.showQuickPick([
      { label: 'cURL', target: 'curl' as const },
      { label: 'fetch', target: 'fetch' as const },
      { label: 'axios', target: 'axios' as const },
      { label: 'Java HttpURLConnection', target: 'java' as const },
    ], {
      placeHolder: LocalizationService.t('panel.chooseCodegen'),
    });
    if (!target) { return; }

    const exported = RequestExportService.resolve({
      method: message.method,
      url: message.url,
      headers: message.headers ?? [],
      params: message.params ?? [],
      body: message.body ?? '',
      bodyType: message.bodyType,
      formData: message.formData ?? [],
      binaryFilePath: message.binaryFilePath ?? '',
      auth: message.auth ?? { type: 'none' },
    }, RequestPanel.environmentProvider.getActiveVariables(), {
      defaultHeaders: RequestPanel.storage.getDefaultHeaders(),
      skipDefaultHeaders: message.skipDefaultHeaders === true,
    });

    const code = target.target === 'curl'
      ? CurlService.generate(exported)
      : CodegenService.generate(target.target, exported);

    await vscode.env.clipboard.writeText(code);
    vscode.window.showInformationMessage(LocalizationService.t('panel.copiedCode', { label: target.label }));
  }

  // Pretty-print XML/HTML with simple indentation.
  private static prettyXml(xml: string): string {
    // Normalize existing spacing.
    let formatted = '';
    let indent = 0;
    const tab = '  ';
    // Split by tags.
    const parts = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/);
    for (const part of parts) {
      if (!part.trim()) continue;
      // Closing tag.
      if (part.match(/^<\/\w/)) {
        indent = Math.max(0, indent - 1);
        formatted += tab.repeat(indent) + part + '\n';
      // Self-closing tag or declaration.
      } else if (part.match(/\/>$/) || part.match(/^<\?/) || part.match(/^<!--/) || part.match(/^<!DOCTYPE/i)) {
        formatted += tab.repeat(indent) + part + '\n';
      // Opening tag.
      } else if (part.match(/^<\w/)) {
        formatted += tab.repeat(indent) + part + '\n';
        indent++;
      // Text node.
      } else {
        formatted += tab.repeat(indent) + part + '\n';
      }
    }
    return formatted.trimEnd();
  }

  private dispose() {
    this.isDisposed = true;
    RequestPanel.currentPanel = undefined;
    this.collectionRunner.stop();
    this.webSocketManager.disconnectAll();
    // Tab state is saved periodically from the webview before disposal.
    for (const d of this.disposables) { d.dispose(); }
    this.disposables = [];
  }

  // ===================================================================
  // Webview HTML for request tabs, environment editing, and variable preview.
  // ===================================================================
  private getHtmlContent(): string {
    return getRequestPanelHtml({
      webview: this.panel.webview,
      extensionUri: this.extensionUri,
      nonce: RequestPanel.createNonce(),
    });
  }
}
