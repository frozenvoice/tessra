import * as vscode from 'vscode';
import { HttpService } from '../services/HttpService';
import { VariableService } from '../services/VariableService';
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
  Response,
  TabState,
  RequestBodyType,
  IncomingWebviewMessage,
  SendRequestMessage,
  CompareResponsesMessage,
  FormDataField,
  RequestScripts,
  RequestSettings,
  ScriptExecutionResult,
  StoredTabState,
  TlsValidationMode,
} from '../models/types';
import { CurlService } from '../services/CurlService';
import { SendHandle } from '../services/HttpService';
import { AuthService } from '../services/AuthService';
import { RequestBodyService } from '../services/RequestBodyService';
import { ScriptRunner, ScriptableRequest } from '../services/ScriptRunner';
import { CodegenService } from '../services/CodegenService';
import { ResponseCompareService } from '../services/ResponseCompareService';
import { LocalizationService } from '../services/LocalizationService';
import { RequestExportService } from '../services/RequestExportService';

type ResolvedRequestSettings = {
  timeout: number;
  followRedirects: boolean;
  saveToHistory: boolean;
  tlsValidation: TlsValidationMode;
  maxResponseSizeKb: number;
  retryCount: number;
  retryDelayMs: number;
  stopAfterHeaders: boolean;
  skipDefaultHeaders: boolean;
  disableScripts: boolean;
};

// Webview ?붿껌 ?⑤꼸 愿由?(?ㅼ쨷 ??吏??
export class RequestPanel {
  public static currentPanel: RequestPanel | undefined;
  public static storage: StorageService;
  public static historyProvider: HistoryTreeProvider;
  public static collectionProvider: CollectionTreeProvider;
  public static environmentProvider: EnvironmentTreeProvider;
  private static readonly viewType = 'arc.requestPanel';
  private static readonly INCOMING_MESSAGE_TYPES = new Set<string>([
    MessageType.SendRequest,
    MessageType.SaveRequest,
    MessageType.SaveEnvironmentVars,
    MessageType.CopyAsCurl,
    MessageType.CopyResponseBody,
    MessageType.CopyToClipboard,
    MessageType.SaveResponseBody,
    MessageType.SaveDefaultHeaders,
    MessageType.CancelRequest,
    MessageType.SaveTabState,
    MessageType.CompareResponses,
    MessageType.StopCollectionRun,
    MessageType.PickFile,
    MessageType.GenerateCode,
    MessageType.OpenDefaultHeaders,
    MessageType.SwitchEnvironment,
    MessageType.OpenResponseUrl,
    'webviewReady',
  ]);
  private static readonly UNRESOLVED_VAR_PATTERN = /\{\{([^}]+)\}\}/g;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly httpService: HttpService;
  private disposables: vscode.Disposable[] = [];
  private isDisposed = false;
  private collectionRunAbort = false;
  private currentCollectionRequest: SendHandle | null = null;
  private currentCollectionDelayCancel: (() => void) | null = null;
  private canceledRequestTabs = new Set<string>();
  private activeRequests = new Map<string, { abort: () => void }>();
  private webviewReady = false;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.httpService = new HttpService();

    this.reloadWebview();

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // ??λ맂 ???곹깭 蹂듭썝
    this.restoreTabState();
  }

  // ??λ맂 ???곹깭瑜?webview???꾩넚
  private restoreTabState() {
    const state = RequestPanel.storage.getTabState();
    if (state && (state.tabs.length > 0 || state.compareSettings)) {
      this.pendingRestore = state;
    }
  }
  private pendingRestore: StoredTabState | null = null;

  private static normalizeBodyType(bodyType: string | undefined): RequestBodyType {
    switch (bodyType) {
      case 'json':
      case 'xml':
      case 'form':
      case 'formdata':
      case 'binary':
      case 'raw':
      case 'none':
        return bodyType;
      case 'text':
        return 'raw';
      default:
        return 'none';
    }
  }

  private static createEmptyScripts(): RequestScripts {
    return { preRequest: '', test: '' };
  }

  private static normalizeCount(value: number | undefined): number {
    return Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value as number) : 0;
  }

  private normalizeRequestSettings(settings?: RequestSettings): ResolvedRequestSettings {
    const tlsValidation = settings?.tlsValidation === 'strict' || settings?.tlsValidation === 'insecure'
      ? settings.tlsValidation
      : 'default';

    return {
      timeout: RequestPanel.normalizeCount(settings?.timeout),
      followRedirects: settings?.followRedirects === true,
      saveToHistory: settings?.saveToHistory !== false,
      tlsValidation,
      maxResponseSizeKb: RequestPanel.normalizeCount(settings?.maxResponseSizeKb),
      retryCount: RequestPanel.normalizeCount(settings?.retryCount),
      retryDelayMs: RequestPanel.normalizeCount(settings?.retryDelayMs),
      stopAfterHeaders: settings?.stopAfterHeaders === true,
      skipDefaultHeaders: settings?.skipDefaultHeaders === true,
      disableScripts: settings?.disableScripts === true,
    };
  }

  private resolveAllowInsecureHttps(tlsValidation: TlsValidationMode): boolean {
    if (tlsValidation === 'insecure') { return true; }
    if (tlsValidation === 'strict') { return false; }
    return this.getAllowInsecureCertificates();
  }

  private shouldRetryResponse(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
  }

  private cloneRequestSettings(settings: ResolvedRequestSettings): RequestSettings {
    return {
      timeout: settings.timeout,
      followRedirects: settings.followRedirects,
      saveToHistory: settings.saveToHistory,
      tlsValidation: settings.tlsValidation,
      maxResponseSizeKb: settings.maxResponseSizeKb,
      retryCount: settings.retryCount,
      retryDelayMs: settings.retryDelayMs,
      stopAfterHeaders: settings.stopAfterHeaders,
      skipDefaultHeaders: settings.skipDefaultHeaders,
      disableScripts: settings.disableScripts,
    };
  }

  private createCancelableDelay(
    ms: number,
    registerCancel?: (cancel: (() => void) | null) => void
  ): Promise<void> {
    if (ms <= 0) { return Promise.resolve(); }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        registerCancel?.(null);
        resolve();
      }, ms);

      registerCancel?.(() => {
        clearTimeout(timer);
        registerCancel?.(null);
        reject(new Error('Request was canceled'));
      });
    });
  }

  private async waitForCollectionRetryDelay(ms: number): Promise<void> {
    if (ms <= 0) { return; }

    try {
      await this.createCancelableDelay(ms, (cancel) => {
        this.currentCollectionDelayCancel = cancel;
      });
    } finally {
      this.currentCollectionDelayCancel = null;
    }
  }

  private postMessage(message: unknown): void {
    if (this.isDisposed) { return; }
    this.panel.webview.postMessage(message);
  }

  private getAllowInsecureCertificates(): boolean {
    return vscode.workspace.getConfiguration('arc-client').get<boolean>('allowInsecureCertificates', false);
  }

  private cancelActiveRequest(tabId: string): void {
    const handle = this.activeRequests.get(tabId);
    if (!handle) { return; }
    this.canceledRequestTabs.add(tabId);
    handle.abort();
  }

  private findUnresolvedVariables(
    url: string,
    headers: KeyValue[],
    params: KeyValue[],
    body: string,
    auth: AuthConfig,
    vars: KeyValue[]
  ): string[] {
    const names = new Set<string>();
    this.collectUnresolvedVariableNames(names, url);
    this.collectUnresolvedFromKeyValues(names, headers);
    this.collectUnresolvedFromKeyValues(names, params);
    this.collectUnresolvedVariableNames(names, body);

    switch (auth.type) {
      case 'basic':
        if (auth.basic) {
          this.collectUnresolvedVariableNames(names, VariableService.resolve(auth.basic.username, vars));
          this.collectUnresolvedVariableNames(names, VariableService.resolve(auth.basic.password, vars));
        }
        break;
      case 'bearer':
        if (auth.bearer) {
          this.collectUnresolvedVariableNames(names, VariableService.resolve(auth.bearer.token, vars));
        }
        break;
      case 'apikey':
        if (auth.apikey) {
          this.collectUnresolvedVariableNames(names, VariableService.resolve(auth.apikey.key, vars));
          this.collectUnresolvedVariableNames(names, VariableService.resolve(auth.apikey.value, vars));
        }
        break;
    }

    return [...names];
  }

  private collectUnresolvedFromKeyValues(target: Set<string>, items: KeyValue[]): void {
    for (const item of items) {
      if (item.enabled === false) { continue; }
      this.collectUnresolvedVariableNames(target, item.key);
      this.collectUnresolvedVariableNames(target, item.value);
    }
  }

  private collectUnresolvedVariableNames(target: Set<string>, text: string): void {
    if (!text) { return; }
    for (const match of text.matchAll(RequestPanel.UNRESOLVED_VAR_PATTERN)) {
      const name = match[1]?.trim();
      if (name) { target.add(name); }
    }
  }

  private createUnresolvedVariableError(names: string[]): string {
    return `Unresolved environment variables: ${names.map((name) => `{{${name}}}`).join(', ')}`;
  }

  private isIncomingMessage(value: unknown): value is IncomingWebviewMessage {
    if (!value || typeof value !== 'object') { return false; }
    const type = (value as { type?: unknown }).type;
    return typeof type === 'string' && RequestPanel.INCOMING_MESSAGE_TYPES.has(type);
  }

  private static createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  // ?⑤꼸 ?쒖떆. createNewTab=true?대㈃ ????룄 ?앹꽦
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
      'Arc Client',
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

  private reloadWebview(): void {
    this.webviewReady = false;
    this.panel.webview.html = this.getHtmlContent();
  }

  private refreshLocalization(): void {
    if (!this.webviewReady) {
      this.reloadWebview();
      return;
    }

    const displayLanguage = LocalizationService.getDisplayLanguage();
    this.postMessage({
      type: MessageType.UpdateLocalization,
      displayLanguage,
      strings: LocalizationService.getStrings(displayLanguage),
      dateLocale: LocalizationService.getDateLocale(displayLanguage),
    });
  }

  public newTab() {
    this.postMessage({ type: 'newTab' });
  }

  public loadRequest(req: Request) {
    this.postMessage({
      type: MessageType.LoadRequest,
      requestId: req.id,
      method: req.method,
      url: req.url,
      headers: req.headers ?? [],
      params: req.params ?? [],
      body: req.body ?? '',
      bodyType: RequestPanel.normalizeBodyType(req.bodyType),
      formData: req.formData ?? [],
      binaryFilePath: req.binaryFilePath ?? '',
      auth: req.auth ?? { type: 'none' },
      scripts: req.scripts ?? RequestPanel.createEmptyScripts(),
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
    this.postMessage({
      type: MessageType.UpdateActiveEnv,
      envName,
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
    const requests: { name: string; request: Request }[] = [];
    const collect = (list: CollectionItem[]) => {
      for (const item of list) {
        if (item.type === 'request' && item.request) {
          requests.push({ name: item.name, request: item.request });
        } else if (item.type === 'folder' && item.children) {
          collect(item.children);
        }
      }
    };
    collect(items);

    if (requests.length === 0) {
      vscode.window.showInformationMessage(LocalizationService.t('info.noRequestsToRun'));
      return;
    }

    this.collectionRunAbort = false;
    this.currentCollectionRequest = null;
    this.postMessage({
      type: MessageType.RunCollectionStart,
      name,
      total: requests.length,
    });

    let vars = RequestPanel.environmentProvider.getActiveVariables();
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < requests.length; i++) {
      if (this.collectionRunAbort) { break; }

      const { name: reqName, request: req } = requests[i];
      const settings = this.normalizeRequestSettings(req);
      const scripts = this.normalizeScripts(req.scripts);
      let requestState = this.createScriptableRequest({
        method: req.method,
        url: req.url,
        headers: req.headers ?? [],
        params: req.params ?? [],
        body: req.body ?? '',
        bodyType: RequestPanel.normalizeBodyType(req.bodyType),
        formData: req.formData ?? [],
        binaryFilePath: req.binaryFilePath ?? '',
        auth: req.auth ?? { type: 'none' },
      });

      let response: Response | null = null;
      let error: string | null = null;
      let status = 0;
      let statusText = '';
      let time = 0;

      try {
        if (!settings.disableScripts) {
          const preRequestResult = ScriptRunner.runPreRequest(scripts, requestState, vars);
          requestState = preRequestResult.request;
          vars = preRequestResult.envVariables;
          this.saveActiveEnvironmentVariables(vars);
        }

        const resolvedUrl = VariableService.resolve(requestState.url, vars);
        const resolvedHeaders = VariableService.resolveKeyValues(requestState.headers, vars);
        const resolvedParams = VariableService.resolveKeyValues(requestState.params, vars);
        const resolvedBody = VariableService.resolve(requestState.body ?? '', vars);
        const resolvedFormData = this.cloneFormDataFields(requestState.formData ?? []).map((field) => ({
          ...field,
          key: VariableService.resolve(field.key, vars),
          value: VariableService.resolve(field.value, vars),
        }));
        const resolvedBinaryFilePath = VariableService.resolve(requestState.binaryFilePath ?? '', vars);
        const defaultHeaders = settings.skipDefaultHeaders
          ? []
          : VariableService.resolveKeyValues(RequestPanel.storage.getDefaultHeaders(), vars);
        const requestKeySet = new Set(
          resolvedHeaders.filter((header) => header.enabled && header.key).map((header) => header.key.toLowerCase())
        );
        const mergedDefaults = defaultHeaders.filter(
          (header) => header.enabled && header.key && !requestKeySet.has(header.key.toLowerCase())
        );
        const finalHeaders = [...mergedDefaults, ...resolvedHeaders];
        const finalParams = [...resolvedParams];
        const unresolvedVariables = this.findUnresolvedVariables(
          resolvedUrl,
          finalHeaders,
          finalParams,
          resolvedBody,
          requestState.auth,
          vars
        );
        unresolvedVariables.push(...this.findPayloadUnresolvedVariables(resolvedFormData, resolvedBinaryFilePath));
        if (unresolvedVariables.length > 0) {
          throw new Error(this.createUnresolvedVariableError(unresolvedVariables));
        }

        AuthService.applyAuth(requestState.auth, finalHeaders, finalParams, vars);
        const url = this.buildUrl(resolvedUrl, finalParams);
        const preparedBody = await RequestBodyService.prepare({
          bodyType: requestState.bodyType,
          body: requestState.body ?? '',
          formData: requestState.formData ?? [],
          binaryFilePath: requestState.binaryFilePath ?? '',
          headers: finalHeaders,
          vars,
        });
        const executedRequest = this.createScriptableRequest({
          method: req.method,
          url,
          headers: preparedBody.headers,
          params: finalParams,
          body: preparedBody.resolvedBody,
          bodyType: requestState.bodyType,
          formData: preparedBody.resolvedFormData,
          binaryFilePath: preparedBody.resolvedBinaryFilePath,
          auth: { type: 'none' },
        });

        const totalAttempts = Math.max(1, settings.retryCount + 1);
        for (let attempt = 0; attempt <= settings.retryCount; attempt++) {
          if (this.collectionRunAbort) {
            throw new Error('Request was canceled');
          }

          this.postMessage({
            type: 'runCollectionStatus',
            phase: 'sending',
            index: i,
            total: requests.length,
            name: reqName,
            method: req.method,
            attempt: attempt + 1,
            totalAttempts,
          });

          const handle = this.httpService.send(
            req.method,
            url,
            preparedBody.headers,
            preparedBody.data,
            {
              timeoutSec: settings.timeout,
              allowInsecureHttps: this.resolveAllowInsecureHttps(settings.tlsValidation),
              followRedirects: settings.followRedirects,
              maxResponseSizeBytes: settings.maxResponseSizeKb > 0 ? settings.maxResponseSizeKb * 1024 : 0,
              stopAfterHeaders: settings.stopAfterHeaders,
            }
          );
          this.currentCollectionRequest = handle;

          try {
            response = await handle.promise;
            this.currentCollectionRequest = null;
          } catch (err: unknown) {
            this.currentCollectionRequest = null;
            if (this.collectionRunAbort || attempt >= settings.retryCount) {
              throw err;
            }
            this.postMessage({
              type: 'runCollectionStatus',
              phase: 'retry',
              index: i,
              total: requests.length,
              name: reqName,
              method: req.method,
              attempt: attempt + 2,
              totalAttempts,
              retryDelayMs: settings.retryDelayMs,
            });
            await this.waitForCollectionRetryDelay(settings.retryDelayMs);
            continue;
          }

          if (response && attempt < settings.retryCount && this.shouldRetryResponse(response.status)) {
            this.postMessage({
              type: 'runCollectionStatus',
              phase: 'retry',
              index: i,
              total: requests.length,
              name: reqName,
              method: req.method,
              attempt: attempt + 2,
              totalAttempts,
              retryDelayMs: settings.retryDelayMs,
            });
            await this.waitForCollectionRetryDelay(settings.retryDelayMs);
            response = null;
            continue;
          }

          break;
        }

        if (!response) {
          throw new Error('Request did not produce a response.');
        }
        status = response.status;
        statusText = response.statusText;
        time = response.time;

        if (!settings.disableScripts) {
          const testResult = ScriptRunner.runTests(scripts, executedRequest, response, vars);
          vars = testResult.envVariables;
          this.saveActiveEnvironmentVariables(vars);
          const failedTests = testResult.result.tests.filter((test) => !test.passed).length;
          if (failedTests > 0) {
            error = `Tests failed: ${failedTests}`;
          }
        }

        if (status >= 400 || error) { failed++; } else { passed++; }
      } catch (err: unknown) {
        if (this.collectionRunAbort) { break; }
        error = err instanceof Error ? err.message : String(err);
        failed++;
      } finally {
        this.currentCollectionRequest = null;
      }

      this.postMessage({
        type: MessageType.RunCollectionProgress,
        index: i,
        total: requests.length,
        name: reqName,
        method: req.method,
        url: req.url,
        status,
        statusText,
        time,
        error,
        response,
        passed,
        failed,
      });
    }

    this.postMessage({
      type: MessageType.RunCollectionDone,
      total: requests.length,
      passed,
      failed,
      time: Date.now() - startTime,
      stopped: this.collectionRunAbort,
    });
  }

  private async handleMessage(message: unknown) {
    if (!this.isIncomingMessage(message)) { return; }
    // Webview 珥덇린???꾨즺 ????λ맂 ??蹂듭썝
    if (message.type === 'webviewReady') {
      this.webviewReady = true;
      // 留?webviewReady留덈떎 ??μ냼?먯꽌 ???곹깭瑜??쎌뼱 蹂듭썝
      // (retainContextWhenHidden ?놁씠 蹂듭썝???⑤꼸? ?④??믫몴????webview媛 ?ъ깮?깅맖)
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
      return;
    }
    switch (message.type) {
      case MessageType.SendRequest:
        await this.executeRequest(message);
        break;
      case MessageType.CancelRequest: {
        this.cancelActiveRequest(message.tabId);
        break;
      }
      case MessageType.SaveRequest: {
        const result = await RequestPanel.collectionProvider.saveRequest({
          requestId: message.requestId,
          method: message.method,
          url: message.url,
          headers: message.headers ?? [],
          params: message.params ?? [],
          body: message.body ?? '',
          bodyType: RequestPanel.normalizeBodyType(message.bodyType),
          formData: message.formData ?? [],
          binaryFilePath: message.binaryFilePath ?? '',
          auth: message.auth ?? { type: 'none' },
          scripts: message.scripts ?? RequestPanel.createEmptyScripts(),
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
          bodyType: RequestPanel.normalizeBodyType(message.bodyType),
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
        this.collectionRunAbort = true;
        this.currentCollectionRequest?.abort();
        this.currentCollectionDelayCancel?.();
        this.currentCollectionDelayCancel = null;
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
        await vscode.commands.executeCommand('arc.switchEnvironment');
        break;
      case MessageType.OpenResponseUrl:
        await this.openResponseUrl(message.url);
        break;
    }
  }

  private async openResponseUrl(url: string): Promise<void> {
    try {
      if (!url) {
        return;
      }
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (error) {
      vscode.window.showErrorMessage(
        LocalizationService.t('panel.failedOpenUrl', {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ?쒖꽦 ?섍꼍蹂????紐⑸줉??webview???꾨떖
  private sendActiveVarsToWebview() {
    const vars = RequestPanel.environmentProvider.getActiveVariables();
    const varKeys = vars.filter(v => v.enabled && v.key).map(v => v.key);
    this.postMessage({ type: 'activeVarKeys', varKeys });
  }

  private cloneFormDataFields(fields: FormDataField[]): FormDataField[] {
    return (fields ?? []).map((field) => ({ ...field }));
  }

  private normalizeScripts(scripts: RequestScripts | undefined): RequestScripts {
    return scripts ?? RequestPanel.createEmptyScripts();
  }

  private createScriptableRequest(input: {
    method: Request['method'];
    url: string;
    headers: KeyValue[];
    params: KeyValue[];
    body: string;
    bodyType: RequestBodyType;
    formData?: FormDataField[];
    binaryFilePath?: string;
    auth: AuthConfig;
  }): ScriptableRequest {
    return {
      method: input.method,
      url: input.url,
      headers: this.cloneKeyValues(input.headers),
      params: this.cloneKeyValues(input.params),
      body: input.body,
      bodyType: input.bodyType,
      formData: this.cloneFormDataFields(input.formData ?? []),
      binaryFilePath: input.binaryFilePath ?? '',
      auth: JSON.parse(JSON.stringify(input.auth ?? { type: 'none' })),
    };
  }

  private saveActiveEnvironmentVariables(variables: KeyValue[]): void {
    const activeEnvId = RequestPanel.environmentProvider.activeEnvId;
    if (!activeEnvId) { return; }
    RequestPanel.storage.updateEnvironmentVars(activeEnvId, variables);
    RequestPanel.environmentProvider.refresh();
    this.sendActiveVarsToWebview();
  }

  private findPayloadUnresolvedVariables(
    formData: FormDataField[],
    binaryFilePath: string
  ): string[] {
    const names = new Set<string>();
    for (const field of formData) {
      if (field.enabled === false) { continue; }
      this.collectUnresolvedVariableNames(names, field.key);
      this.collectUnresolvedVariableNames(names, field.value);
    }
    this.collectUnresolvedVariableNames(names, binaryFilePath);
    return [...names];
  }

  private async executeRequest(message: SendRequestMessage) {
    const tabId = message.tabId;
    const method = message.method;
    const bodyType = RequestPanel.normalizeBodyType(message.bodyType);
    const settings = this.normalizeRequestSettings(message);
    const scripts = this.normalizeScripts(message.scripts);
    let vars = RequestPanel.environmentProvider.getActiveVariables();
    let requestState = this.createScriptableRequest({
      method,
      url: message.url,
      headers: message.headers ?? [],
      params: message.params ?? [],
      body: message.body ?? '',
      bodyType,
      formData: message.formData ?? [],
      binaryFilePath: message.binaryFilePath ?? '',
      auth: message.auth ?? { type: 'none' },
    });

    if (!settings.disableScripts) {
      try {
        const preRequestResult = ScriptRunner.runPreRequest(scripts, requestState, vars);
        requestState = preRequestResult.request;
        vars = preRequestResult.envVariables;
        this.saveActiveEnvironmentVariables(vars);
      } catch (err: unknown) {
        this.postMessage({
          type: MessageType.ResponseError,
          tabId,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    const resolvedUrl = VariableService.resolve(requestState.url, vars);
    const resolvedHeaders = VariableService.resolveKeyValues(requestState.headers, vars);
    const resolvedParams = VariableService.resolveKeyValues(requestState.params, vars);
    const resolvedBody = VariableService.resolve(requestState.body ?? '', vars);
    const resolvedFormData = this.cloneFormDataFields(requestState.formData ?? []).map((field) => ({
      ...field,
      key: VariableService.resolve(field.key, vars),
      value: VariableService.resolve(field.value, vars),
    }));
    const resolvedBinaryFilePath = VariableService.resolve(requestState.binaryFilePath ?? '', vars);

    const defaultHeaders = settings.skipDefaultHeaders
      ? []
      : VariableService.resolveKeyValues(RequestPanel.storage.getDefaultHeaders(), vars);
    const requestKeySet = new Set(
      resolvedHeaders.filter((header) => header.enabled && header.key).map((header) => header.key.toLowerCase())
    );
    const mergedDefaults = defaultHeaders.filter(
      (header) => header.enabled && header.key && !requestKeySet.has(header.key.toLowerCase())
    );
    const finalHeaders = [...mergedDefaults, ...resolvedHeaders];
    const finalParams = [...resolvedParams];
    const unresolvedVariables = this.findUnresolvedVariables(
      resolvedUrl,
      finalHeaders,
      finalParams,
      resolvedBody,
      requestState.auth,
      vars
    );
    unresolvedVariables.push(...this.findPayloadUnresolvedVariables(resolvedFormData, resolvedBinaryFilePath));
    if (unresolvedVariables.length > 0) {
      this.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: this.createUnresolvedVariableError(unresolvedVariables),
      });
      return;
    }

    AuthService.applyAuth(requestState.auth, finalHeaders, finalParams, vars);

    let url: string;
    try {
      url = this.buildUrl(resolvedUrl, finalParams);
    } catch {
      this.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: `Invalid URL: ${resolvedUrl}`,
      });
      return;
    }

    let preparedBody: Awaited<ReturnType<typeof RequestBodyService.prepare>>;
    try {
      preparedBody = await RequestBodyService.prepare({
        bodyType,
        body: requestState.body ?? '',
        formData: requestState.formData ?? [],
        binaryFilePath: requestState.binaryFilePath ?? '',
        headers: finalHeaders,
        vars,
      });
    } catch (err: unknown) {
      this.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const executedRequest = this.createScriptableRequest({
      method,
      url,
      headers: preparedBody.headers,
      params: finalParams,
      body: preparedBody.resolvedBody,
      bodyType,
      formData: preparedBody.resolvedFormData,
      binaryFilePath: preparedBody.resolvedBinaryFilePath,
      auth: { type: 'none' },
    });

    let currentHandle: SendHandle | null = null;
    let cancelDelay: (() => void) | null = null;
    this.activeRequests.set(tabId, {
      abort: () => {
        currentHandle?.abort();
        cancelDelay?.();
      },
    });

    try {
      let response: Response | null = null;
      for (let attempt = 0; attempt <= settings.retryCount; attempt++) {
        currentHandle = this.httpService.send(
          method,
          url,
          preparedBody.headers,
          preparedBody.data,
          {
            timeoutSec: settings.timeout,
            allowInsecureHttps: this.resolveAllowInsecureHttps(settings.tlsValidation),
            followRedirects: settings.followRedirects,
            maxResponseSizeBytes: settings.maxResponseSizeKb > 0 ? settings.maxResponseSizeKb * 1024 : 0,
            stopAfterHeaders: settings.stopAfterHeaders,
          }
        );

        try {
          response = await currentHandle.promise;
          currentHandle = null;
        } catch (err: unknown) {
          currentHandle = null;
          if (this.canceledRequestTabs.has(tabId) || attempt >= settings.retryCount) {
            throw err;
          }
          await this.createCancelableDelay(settings.retryDelayMs, (cancel) => {
            cancelDelay = cancel;
          });
          cancelDelay = null;
          continue;
        }

        if (response && attempt < settings.retryCount && this.shouldRetryResponse(response.status)) {
          await this.createCancelableDelay(settings.retryDelayMs, (cancel) => {
            cancelDelay = cancel;
          });
          cancelDelay = null;
          response = null;
          continue;
        }

        if (response) {
          break;
        }
      }

      if (this.canceledRequestTabs.delete(tabId)) { return; }
      if (!response) {
        throw new Error('Request did not produce a response.');
      }

      let scriptResults: ScriptExecutionResult | undefined;
      if (!settings.disableScripts) {
        try {
          const testResult = ScriptRunner.runTests(scripts, executedRequest, response, vars);
          vars = testResult.envVariables;
          this.saveActiveEnvironmentVariables(vars);
          scriptResults = testResult.result;
        } catch (err: unknown) {
          scriptResults = {
            logs: [],
            tests: [{
              name: LocalizationService.t('webview.testScript'),
              passed: false,
              error: err instanceof Error ? err.message : String(err),
            }],
          };
        }
      }

      if (settings.saveToHistory) {
        this.saveToHistory(
          this.createHistoryRequestSnapshot(
            method,
            url,
            preparedBody.headers,
            preparedBody.resolvedBody,
            bodyType,
            preparedBody.resolvedFormData,
            preparedBody.resolvedBinaryFilePath,
            settings
          ),
          { status: response.status, statusText: response.statusText, time: response.time }
        );
        RequestPanel.historyProvider.refresh();
      }

      const resolvedHeaderPairs = preparedBody.headers
        .filter((header) => header.enabled && header.key)
        .map((header) => ({ key: header.key, value: header.value }));

      this.postMessage({
        type: MessageType.ReceiveResponse,
        tabId,
        response,
        resolvedUrl: url,
        resolvedHeaders: resolvedHeaderPairs,
        scriptResults,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const wasCanceled = this.canceledRequestTabs.delete(tabId);

      if (wasCanceled) {
        this.postMessage({
          type: MessageType.RequestCanceled,
          tabId,
        });
        return;
      }

      if (settings.saveToHistory) {
        this.saveToHistory(
          this.createHistoryRequestSnapshot(
            method,
            url,
            preparedBody.headers,
            preparedBody.resolvedBody,
            bodyType,
            preparedBody.resolvedFormData,
            preparedBody.resolvedBinaryFilePath,
            settings
          ),
          null
        );
        RequestPanel.historyProvider.refresh();
      }

      this.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: errorMsg,
      });
    } finally {
      cancelDelay = null;
      this.activeRequests.delete(tabId);
    }
  }

  private cloneKeyValues(items: KeyValue[]): KeyValue[] {
    return items
      .filter((item) => item.enabled !== false && item.key)
      .map((item) => ({
        key: item.key,
        value: item.value,
        enabled: true,
      }));
  }

  private createHistoryRequestSnapshot(
    method: string,
    url: string,
    headers: KeyValue[],
    body: string,
    bodyType: RequestBodyType,
    formData: FormDataField[] = [],
    binaryFilePath: string = '',
    settings?: RequestSettings
  ): Request {
    const normalizedSettings = this.normalizeRequestSettings(settings);
    return {
      id: '',
      name: `${method} ${url}`,
      method: method as Request['method'],
      url,
      headers: this.cloneKeyValues(headers),
      params: [],
      body,
      bodyType,
      formData: this.cloneFormDataFields(formData),
      binaryFilePath,
      auth: { type: 'none' },
      scripts: RequestPanel.createEmptyScripts(),
      ...this.cloneRequestSettings(normalizedSettings),
    };
  }

  private saveToHistory(
    request: Request,
    response: { status: number; statusText: string; time: number } | null
  ) {
    const maxItems = vscode.workspace.getConfiguration('arc-client').get<number>('historyMaxItems', 100);
    const removed = RequestPanel.storage.addHistoryEntry({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      request,
      response,
      timestamp: Date.now(),
    });
    if (removed > 0) {
      vscode.window.setStatusBarMessage(`History: ${removed} old items removed (max ${maxItems})`, 3000);
    }
  }

  private buildUrl(baseUrl: string, params: KeyValue[]): string {
    const active = params.filter((p) => p.enabled && p.key);
    if (active.length === 0) { return baseUrl; }
    try {
      const url = new URL(baseUrl);
      for (const p of active) { url.searchParams.append(p.key, p.value); }
      return url.toString();
    } catch {
      const sep = baseUrl.includes('?') ? '&' : '?';
      const qs = active.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      return baseUrl + sep + qs;
    }
  }

  // Content-Type ???뚯씪 ?뺤옣??留ㅽ븨
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

  // ?묐떟 諛붾뵒瑜??뚯씪濡????
  private async saveResponseBody(body: string, contentType: string, bodyBase64?: string): Promise<boolean> {
    const ext = RequestPanel.contentTypeToExt(contentType);
    // 湲곕낯 ?뚯씪紐? response_YYYYMMDD_HHmmss.?뺤옣??
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

  // ???묐떟???꾩떆 ?뚯씪濡???ν븯怨?VS Code diff ?먮뵒?곕줈 鍮꾧탳
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

  // diff??蹂몃Ц ?щ㎎??
  private formatForDiff(body: string, ext: string): string {
    if (ext === 'json') {
      try { return JSON.stringify(JSON.parse(body), null, 2); } catch { /* ?뚯떛 ?ㅽ뙣 ???먮낯 諛섑솚 */ }
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

  // XML/HTML Pretty ?щ㎎??(?몃뜶???곸슜)
  private static prettyXml(xml: string): string {
    // 湲곗〈 怨듬갚 ?뺣━
    let formatted = '';
    let indent = 0;
    const tab = '  ';
    // ?쒓렇 ?⑥쐞濡?遺꾨━
    const parts = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/);
    for (const part of parts) {
      if (!part.trim()) continue;
      // ?ル뒗 ?쒓렇
      if (part.match(/^<\/\w/)) {
        indent = Math.max(0, indent - 1);
        formatted += tab.repeat(indent) + part + '\n';
      // ?먭린 ?リ린 ?쒓렇 ?먮뒗 ?좎뼵
      } else if (part.match(/\/>$/) || part.match(/^<\?/) || part.match(/^<!--/) || part.match(/^<!DOCTYPE/i)) {
        formatted += tab.repeat(indent) + part + '\n';
      // ?щ뒗 ?쒓렇
      } else if (part.match(/^<\w/)) {
        formatted += tab.repeat(indent) + part + '\n';
        indent++;
      // ?띿뒪???몃뱶
      } else {
        formatted += tab.repeat(indent) + part + '\n';
      }
    }
    return formatted.trimEnd();
  }

  private dispose() {
    this.isDisposed = true;
    RequestPanel.currentPanel = undefined;
    this.collectionRunAbort = true;
    this.currentCollectionRequest?.abort();
    this.currentCollectionDelayCancel?.();
    this.currentCollectionDelayCancel = null;
    for (const tabId of this.activeRequests.keys()) {
      this.cancelActiveRequest(tabId);
    }
    // ?⑤꼸 ?ロ옄 ??留덉?留됱쑝濡???λ맂 ???곹깭 ?좎? (webview?먯꽌 二쇨린?곸쑝濡??꾩넚)
    for (const d of this.disposables) { d.dispose(); }
    this.disposables = [];
  }

  // ===================================================================
  // Webview HTML (?ㅼ쨷 ??+ ?섍꼍蹂???몄쭛 + 蹂??移섑솚 誘몃━蹂닿린)
  // ===================================================================
  private getHtmlContent(): string {
    const hljsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'hljs.js')
    );
    const nonce = RequestPanel.createNonce();
    const displayLanguage = LocalizationService.getDisplayLanguage();
    const localizedStrings = JSON.stringify(LocalizationService.getStrings(displayLanguage)).replace(/</g, '\\u003c');
    const dateLocale = LocalizationService.getDateLocale(displayLanguage);
    const csp = [
      "default-src 'none'",
      `img-src ${this.panel.webview.cspSource} data:`,
      `style-src ${this.panel.webview.cspSource} 'unsafe-inline'`,
      `script-src ${this.panel.webview.cspSource} 'nonce-${nonce}'`,
      `font-src ${this.panel.webview.cspSource}`,
    ].join('; ');
    return /*html*/ `<!DOCTYPE html>
<html lang="${displayLanguage}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<title>Arc Client</title>
<style nonce="${nonce}">
/* highlight.js vs2015 ?뚮쭏 (?몃씪?? */
pre code.hljs{display:block;overflow-x:auto;padding:0}code.hljs{padding:0}.hljs{background:transparent;color:#dcdcdc}.hljs-keyword,.hljs-literal,.hljs-name,.hljs-symbol{color:#569cd6}.hljs-link{color:#569cd6;text-decoration:underline}.hljs-built_in,.hljs-type{color:#4ec9b0}.hljs-class,.hljs-number{color:#b8d7a3}.hljs-meta .hljs-string,.hljs-string{color:#d69d85}.hljs-regexp,.hljs-template-tag{color:#9a5334}.hljs-formula,.hljs-function,.hljs-params,.hljs-subst,.hljs-title{color:#dcdcdc}.hljs-comment,.hljs-quote{color:#57a64a;font-style:italic}.hljs-doctag{color:#608b4e}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#9b9b9b}.hljs-template-variable,.hljs-variable{color:#bd63c5}.hljs-attr,.hljs-attribute{color:#9cdcfe}.hljs-section{color:gold}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:#d7ba7d}.hljs-addition{background-color:#144212;display:inline-block;width:100%}.hljs-deletion{background-color:#600;display:inline-block;width:100%}
</style>
<style nonce="${nonce}">
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* === ?붿껌 ??諛?=== */
.tab-bar{display:flex;background:var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background));border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;overflow-x:auto;scrollbar-width:thin}
.tab-bar::-webkit-scrollbar{height:3px}
.req-tab{position:relative;display:flex;align-items:center;gap:5px;padding:6px 12px;font-size:13px;cursor:pointer;border-right:1px solid var(--vscode-panel-border,#333);white-space:nowrap;opacity:.68;min-width:0;flex-shrink:0;user-select:none;transition:background .18s,opacity .18s,transform .18s,box-shadow .18s;border-bottom:3px solid transparent;border-radius:10px 10px 0 0;margin-top:2px;background:rgba(255,255,255,.015)}
.req-tab::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:999px;background:linear-gradient(90deg,transparent,currentColor,transparent);opacity:0;transition:opacity .18s}
.req-tab:hover{opacity:.92;background:rgba(255,255,255,.05);transform:translateY(-1px)}
.req-tab.active{opacity:1;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border-bottom:3px solid var(--vscode-focusBorder);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 20px rgba(0,0,0,.22)}
.req-tab.active::after{opacity:.5}
.req-tab .method-badge{font-weight:700;font-size:13px;padding:1px 4px;border-radius:2px}
.req-tab .tab-name{max-width:180px;overflow:hidden;text-overflow:ellipsis}
.method-GET{color:#4ec94e}.method-POST{color:#e5c07b}.method-PUT{color:#61afef}.method-PATCH{color:#d19a66}.method-DELETE{color:#e06c75}.method-HEAD{color:#abb2bf}.method-OPTIONS{color:#abb2bf}
.req-tab.active.tab-GET{border-bottom-color:#4ec94e;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(78,201,78,.12)}
.req-tab.active.tab-POST{border-bottom-color:#e5c07b;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(229,192,123,.12)}
.req-tab.active.tab-PUT{border-bottom-color:#61afef;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(97,175,239,.12)}
.req-tab.active.tab-PATCH{border-bottom-color:#d19a66;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(209,154,102,.12)}
.req-tab.active.tab-DELETE{border-bottom-color:#e06c75;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 24px rgba(224,108,117,.14)}
.req-tab.active.tab-HEAD{border-bottom-color:#abb2bf}
.req-tab.active.tab-OPTIONS{border-bottom-color:#abb2bf}
.req-tab .close-tab{opacity:.5;cursor:pointer;font-size:13px;padding:0 2px;line-height:1}
.req-tab .close-tab:hover{opacity:1;color:var(--vscode-errorForeground)}
.req-tab.pinned{opacity:.85;border-left:2px solid var(--vscode-focusBorder)}
.req-tab.pinned .close-tab{display:none}
.req-tab.pinned .pin-icon{display:inline;font-size:13px;margin-right:2px}
.req-tab .pin-icon{display:none}
.req-tab .dirty-dot{color:var(--vscode-foreground,#ccc);font-size:10px;margin-left:3px;opacity:.85}
.dirty-confirm-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(5,8,14,.55);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center}
.dirty-confirm-dialog{background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-panel-border,#444);border-radius:6px;padding:20px 24px;min-width:340px;box-shadow:0 4px 24px rgba(0,0,0,.5)}
.dirty-confirm-msg{font-size:14px;margin-bottom:16px;line-height:1.5}
.dirty-confirm-actions{display:flex;gap:8px;justify-content:flex-end}
.dirty-btn{padding:5px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-family:inherit}
.dirty-btn-save{background:var(--vscode-button-background,#0078d4);color:var(--vscode-button-foreground,#fff)}
.dirty-btn-save:hover{background:var(--vscode-button-hoverBackground,#026ec1)}
.dirty-btn-discard{background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-panel-border,#444)}
.dirty-btn-discard:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
.dirty-btn-cancel{background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-panel-border,#444)}
.dirty-btn-cancel:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
.compare-settings-dialog{min-width:520px;max-width:640px}
.compare-settings-grid{display:flex;flex-direction:column;gap:12px}
.compare-settings-row{display:flex;flex-direction:column;gap:6px}
.compare-settings-row label{font-size:12px;opacity:.9}
.compare-settings-input{width:100%;padding:6px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:4px;font-size:13px}
.compare-settings-note{font-size:12px;opacity:.65;line-height:1.5}
.compare-mode-options{display:flex;gap:8px;flex-wrap:wrap}
.compare-mode-chip{padding:6px 10px;border:1px solid var(--vscode-input-border,#555);border-radius:999px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:12px}
.compare-mode-chip.active{border-color:var(--vscode-charts-blue,#3794ff);color:var(--vscode-charts-blue,#3794ff);background:rgba(55,148,255,.12)}
.add-tab{padding:4px 10px;cursor:pointer;opacity:.5;font-size:14px;display:flex;align-items:center}
.add-tab:hover{opacity:1}
.tab-ctx-menu{position:fixed;z-index:9999;background:var(--vscode-menu-background,#252526);border:1px solid var(--vscode-menu-border,#454545);border-radius:4px;padding:4px 0;min-width:160px;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:13px}
.tab-ctx-menu .ctx-item{padding:4px 16px;cursor:pointer;color:var(--vscode-menu-foreground,#ccc)}
.tab-ctx-menu .ctx-item:hover{background:var(--vscode-menu-selectionBackground,#094771);color:var(--vscode-menu-selectionForeground,#fff)}
.tab-ctx-menu .ctx-item.disabled{opacity:.4;cursor:default;pointer-events:none}
.tab-ctx-menu .ctx-sep{height:1px;margin:4px 8px;background:var(--vscode-menu-separatorBackground,#454545)}

/* === 硫붿씤 而⑦뀗痢?=== */
.main-content{flex:1;overflow:hidden;display:flex;flex-direction:column}

/* URL 諛?*/
.request-topline{display:flex;align-items:center;gap:10px;padding:10px 10px 0;flex-shrink:0;flex-wrap:wrap}
.request-stage{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);font-size:12px;font-weight:700;letter-spacing:.02em;background:rgba(255,255,255,.03)}
.request-stage .stage-dot{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}
.request-stage.stage-idle{color:var(--vscode-descriptionForeground,#8d8d8d)}
.request-stage.stage-ready{color:var(--vscode-charts-blue,#57a6ff)}
.request-stage.stage-loading{color:#7dc8ff}
.request-stage.stage-success{color:#4ec94e}
.request-stage.stage-redirect{color:#e5c07b}
.request-stage.stage-error{color:#ff7a7a}
.request-stage.stage-canceled{color:#d19a66}
.request-stage-hint{font-size:12px;color:var(--vscode-descriptionForeground,#9a9a9a);line-height:1.4}
.request-topline-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.request-status-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.request-status-chip{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:var(--vscode-descriptionForeground,#c2c2c2);white-space:nowrap;font-family:inherit;appearance:none}
.request-status-chip.clickable{cursor:pointer;transition:transform .12s ease,background .12s ease,border-color .12s ease}
.request-status-chip.clickable:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.06)}
.request-status-chip.info{background:rgba(87,166,255,.08);border-color:rgba(87,166,255,.16);color:#93c8ff}
.request-status-chip.warning{background:rgba(229,192,123,.08);border-color:rgba(229,192,123,.16);color:#f1cf8a}
.request-status-chip.muted{opacity:.78}
.request-status-chip .env-label{opacity:.75;margin-right:4px}
.request-status-chip .env-name{color:#dcdcaa}
.request-preflight{display:flex;flex-direction:column;gap:10px;padding:0 10px 8px}
.request-preflight-pills{display:flex;flex-wrap:wrap;gap:8px}
.preflight-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:var(--vscode-descriptionForeground,#c8c8c8);font-family:inherit;appearance:none}
.preflight-pill.clickable{cursor:pointer;transition:transform .12s ease,background .12s ease}
.preflight-pill.clickable:hover{transform:translateY(-1px);background:rgba(255,255,255,.06)}
.preflight-pill.info{background:rgba(87,166,255,.08);border-color:rgba(87,166,255,.16);color:#93c8ff}
.preflight-pill.accent{background:rgba(78,201,176,.08);border-color:rgba(78,201,176,.18);color:#8ce3d1}
.preflight-pill.warning{background:rgba(229,192,123,.09);border-color:rgba(229,192,123,.18);color:#f1cf8a}
.preflight-pill.muted{opacity:.78}
.preflight-warning{padding:12px;border-radius:12px;border:1px solid rgba(229,192,123,.18);background:rgba(229,192,123,.08);display:flex;flex-direction:column;gap:8px}
.preflight-warning-title{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#f1cf8a}
.preflight-warning-copy{font-size:12px;line-height:1.55;color:var(--vscode-foreground);word-break:break-word}
.preflight-warning-actions{display:flex;flex-wrap:wrap;gap:8px}
.ghost-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:var(--vscode-foreground);font-size:12px;cursor:pointer}
.ghost-btn:hover{background:rgba(255,255,255,.07)}
.url-bar{display:flex;gap:8px;padding:8px 10px;flex-shrink:0;align-items:center;position:relative;overflow:visible}
.url-bar select{width:100px;padding:6px 8px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:6px;font-size:13px;font-weight:700}
.url-bar input{flex:1;padding:6px 10px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:6px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace)}
.url-bar input:focus{outline:1px solid var(--vscode-focusBorder)}
.url-input-wrap{position:relative;flex:1;display:flex}
.url-input-wrap input{flex:1;width:100%}
.var-overlay{position:absolute;top:0;left:0;right:0;bottom:0;padding:6px 10px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace);pointer-events:none;white-space:nowrap;overflow:hidden;color:transparent}
.unresolved-var{text-decoration:wavy underline #e06c75;text-decoration-skip-ink:none;color:transparent}
.btn{padding:4px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer}
.btn:hover{background:var(--vscode-button-hoverBackground)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-s{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-s:hover{background:var(--vscode-button-secondaryHoverBackground)}
/* Send 踰꾪듉 */
.btn-send{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:7px;padding:6px 16px;background:linear-gradient(135deg,#0078d4,#1683eb);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s;box-shadow:0 8px 18px rgba(0,120,212,.24)}
.btn-send:hover{background:linear-gradient(135deg,#1683eb,#2697ff);transform:translateY(-1px);box-shadow:0 12px 24px rgba(0,120,212,.28)}
.btn-send svg{flex-shrink:0}
.btn-keyhint{padding:2px 6px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;line-height:1;letter-spacing:.02em}
/* Stop 踰꾪듉 (?꾩넚 以? */
.btn-stop{display:inline-flex;align-items:center;gap:7px;padding:6px 16px;background:linear-gradient(135deg,#c42b1c,#e04535);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s;box-shadow:0 8px 18px rgba(224,69,53,.18)}
.btn-stop:hover{background:linear-gradient(135deg,#d53b2c,#f05f4c);transform:translateY(-1px);box-shadow:0 12px 24px rgba(224,69,53,.24)}
.btn-stop .stop-icon{display:inline-block;width:10px;height:10px;background:#fff;border-radius:1px}
.url-bar-spacer{flex:1}

/* ?대? ??*/
.tabs{display:flex;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;padding:0 10px;gap:4px;flex-wrap:wrap}
.tab{padding:8px 14px;cursor:pointer;border-bottom:2px solid transparent;opacity:.52;font-size:12px;user-select:none;text-transform:uppercase;letter-spacing:.08em;transition:opacity .15s,background .15s,color .15s,transform .15s;border-radius:10px 10px 0 0}
.tab:hover{opacity:.82;background:rgba(255,255,255,.04);transform:translateY(-1px)}
.tab.active{opacity:1;border-bottom-color:#0078d4;background:rgba(0,122,204,.08);color:var(--vscode-foreground)}

/* ?⑤꼸 ?덉씠?꾩썐 */
.split{flex:1;overflow:hidden;display:flex;flex-direction:column}
.req-area{flex:none;min-height:60px;overflow-y:auto;padding:4px 10px}
.divider{height:5px;background:var(--vscode-panel-border,#444);flex-shrink:0;cursor:row-resize;position:relative;z-index:10;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(0,0,0,.2)}
.divider:hover,.divider.active{background:#0078d4}
.divider::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40px;height:2px;background:var(--vscode-foreground);opacity:.2;border-radius:2px}
.res-area{flex:1;min-height:40px;overflow:hidden;display:flex;flex-direction:column;padding:0 10px}
.res-preview{width:100%;flex:1;overflow:auto;background:#fff;color:#111}
.preview-shell{max-width:1080px;margin:0 auto;padding:24px}
.preview-kicker{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6a6f77;margin-bottom:8px}
.preview-title{font-size:28px;font-weight:800;line-height:1.2;margin:0 0 10px}
.preview-copy{font-size:14px;line-height:1.65;color:#4b5563;margin:0 0 18px}
.preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:18px}
.preview-card{padding:14px 16px;border:1px solid #d9dde3;border-radius:14px;background:#f8fafc}
.preview-card-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6a6f77;margin-bottom:6px}
.preview-card-value{font-size:13px;line-height:1.55;color:#111;word-break:break-word}
.preview-card-value.muted{color:#6b7280}
.preview-section{margin-top:20px}
.preview-section-title{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6a6f77;margin-bottom:8px}
.preview-empty{padding:16px;border:1px dashed #c8cdd4;border-radius:14px;background:#f8fafc;color:#6b7280}
.preview-snapshot{padding:18px;border:1px solid #d9dde3;border-radius:14px;background:#fff;overflow:auto}
.preview-snapshot img{max-width:100%;height:auto}
.preview-snapshot table{border-collapse:collapse;max-width:100%}
.preview-snapshot th,.preview-snapshot td{border:1px solid #d9dde3;padding:6px 8px;vertical-align:top}
.preview-snapshot pre{white-space:pre-wrap;word-break:break-word}
.preview-snapshot code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}

/* KV ??*/
.kv-section{padding:3px 0}
.kv-row{display:flex;gap:3px;margin-bottom:2px;align-items:center}
.kv-row input[type="checkbox"]{width:14px;height:14px;accent-color:var(--vscode-focusBorder)}
.kv-row input[type="text"],.kv-row input[type="password"]{flex:1;padding:3px 5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace)}
.kv-row .rm{background:transparent;border:none;color:var(--vscode-errorForeground,#f44);cursor:pointer;font-size:13px;padding:0 3px;line-height:1}
.add-btn{background:transparent;border:none;color:var(--vscode-textLink-foreground,#3794ff);padding:4px 2px;border-radius:4px;cursor:pointer;font-size:13px;opacity:.7;margin-top:4px}
.auto-badge{font-size:13px;opacity:.4;white-space:nowrap;margin-left:2px;user-select:none}
.add-btn:hover{opacity:1;text-decoration:underline}

/* Body */
.body-type-select{padding:3px 5px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:13px;margin-bottom:4px}
.body-section textarea{width:100%;min-height:70px;max-height:50vh;padding:5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-family:var(--vscode-editor-font-family,monospace);font-size:13px;resize:vertical;overflow-y:auto;field-sizing:content}

/* Auth */
.auth-section{padding:3px 0}
.auth-section select{padding:3px 5px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:13px;margin-bottom:4px}
.auth-section .auth-fields{display:flex;flex-direction:column;gap:3px}
.auth-section .auth-fields input,.auth-section .auth-fields select{padding:3px 5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:13px}
.auth-row{display:flex;gap:4px;align-items:center}
.auth-row label{font-size:13px;opacity:.6;min-width:55px}

/* Settings ?⑤꼸 */
.settings-section{padding:10px 4px}
.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.settings-card{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));box-shadow:0 10px 24px rgba(0,0,0,.14)}
.settings-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.settings-label{font-size:13px;opacity:.8;min-width:80px;font-weight:600}
.settings-input{width:80px;padding:4px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:4px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace)}
.settings-input:focus{outline:1px solid var(--vscode-focusBorder)}
.settings-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.settings-hint{font-size:13px;opacity:.4}
.settings-group{padding:0}
.settings-group + .settings-group{border-top:none;margin-top:0}
.settings-group-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin:0 0 6px}
.settings-group-note{font-size:12px;line-height:1.45;color:var(--vscode-descriptionForeground,#989898);margin:0 0 12px}
.settings-toggle-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.settings-toggle{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.4;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02)}
.settings-toggle input{margin:2px 0 0}
.settings-toggle > span{display:flex;flex-direction:column;gap:3px}
.settings-row.multi-line{align-items:flex-start;flex-direction:column;gap:4px}
.settings-row.risk-warning,.settings-toggle.risk-warning{border-color:rgba(229,192,123,.24);background:rgba(229,192,123,.08)}
.settings-row.risk-muted,.settings-toggle.risk-muted{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.045)}
.settings-row.risk-warning .settings-label,.settings-toggle.risk-warning > span{color:#f1cf8a}
.settings-select{width:140px}
.settings-inline-note{display:block;font-size:12px;color:var(--vscode-descriptionForeground,#989898);margin-left:22px}
.settings-field-meta{display:flex;flex-direction:column;gap:2px}
.settings-field-meta .settings-hint{font-size:12px}

/* ?섍꼍蹂???몄쭛 */
.env-editor{padding:6px 10px;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;background:var(--vscode-sideBar-background,var(--vscode-editor-background))}
.env-editor-title{font-size:13px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px}
.env-badge{background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:1px 6px;border-radius:8px;font-size:13px}
.env-autosave-indicator{font-size:12px;color:var(--vscode-charts-green,#4ec94e);opacity:0;transition:opacity .3s;display:flex;align-items:center;gap:3px}
.env-autosave-indicator.show{opacity:1}
.env-dirty-dot{width:6px;height:6px;border-radius:50%;background:var(--vscode-editorWarning-foreground,#cca700);display:none}
.env-dirty-dot.show{display:inline-block}

/* ?묐떟 */
.response-summary{display:flex;flex-direction:column;gap:8px}
.res-sticky-shell{position:sticky;top:0;z-index:4;background:linear-gradient(180deg,var(--vscode-editor-background) 0%,var(--vscode-editor-background) 88%,rgba(0,0,0,0) 100%);padding-top:2px}
.response-meta{display:flex;gap:10px;align-items:center;padding:6px 0 2px;flex-shrink:0;font-size:13px;flex-wrap:wrap}
.response-meta.response-tone-2xx .status{box-shadow:0 0 0 1px rgba(78,201,78,.12),0 0 18px rgba(78,201,78,.12)}
.response-meta.response-tone-3xx .status{box-shadow:0 0 0 1px rgba(229,192,123,.12),0 0 18px rgba(229,192,123,.1)}
.response-meta.response-tone-4xx .status,.response-meta.response-tone-5xx .status{box-shadow:0 0 0 1px rgba(255,122,122,.14),0 0 18px rgba(255,122,122,.12)}
.meta-stat{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);font-variant-numeric:tabular-nums}
.meta-lang{font-size:11px;opacity:.72;text-transform:uppercase;letter-spacing:.08em}
.compare-chip-row{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:4px}
.compare-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);font-size:12px;color:var(--vscode-descriptionForeground,#a6a6a6)}
.compare-chip strong{color:var(--vscode-foreground)}
.compare-chip.current{border-color:rgba(78,201,78,.28);color:#93e493;background:rgba(78,201,78,.08)}
.compare-chip.ready{border-color:rgba(87,166,255,.24);color:#93c8ff;background:rgba(87,166,255,.08)}
.compare-chip.mode{border-color:rgba(209,154,102,.22);color:#f0c995;background:rgba(209,154,102,.08)}
.res-action-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1px solid var(--vscode-input-border,#555);border-radius:6px;background:transparent;color:var(--vscode-foreground);font-size:13px;cursor:pointer;transition:background .15s,transform .1s;user-select:none}
.res-action-btn:hover{background:var(--vscode-button-secondaryHoverBackground,rgba(255,255,255,.1));transform:scale(1.05)}
.res-action-btn:active{transform:scale(.92)}
.res-action-btn:disabled{opacity:.35;cursor:default;transform:none}
.res-action-btn:disabled:hover{background:transparent;transform:none}
.res-action-btn svg{flex-shrink:0;color:var(--vscode-foreground)}
.status{font-weight:700;padding:1px 6px;border-radius:3px}
.status-2xx{background:#1a3a1a;color:#4ec94e}
.status-3xx{background:#3a3a1a;color:#c9c94e}
.status-4xx{background:#3a1a1a;color:#c94e4e}
.status-5xx{background:#3a1a2a;color:#c94e8e}

.resolved-url{padding:3px 8px;font-size:13px;color:var(--vscode-textLink-foreground,#3794ff);background:var(--vscode-input-background);border-radius:3px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;font-family:var(--vscode-editor-font-family,monospace);flex-shrink:0}
.resolved-url:hover{text-decoration:underline;opacity:.85}
.resolved-url.copied{color:#4ec94e}
.resolved-headers-section{margin-bottom:8px}
.resolved-headers-title{font-size:13px;font-weight:700;color:var(--vscode-descriptionForeground,#888);text-transform:uppercase;letter-spacing:.5px;padding:2px 0}
.res-header-table{width:100%;border-collapse:collapse;font-family:var(--vscode-editor-font-family,monospace);font-size:13px}
.res-header-table thead th{text-align:left;padding:4px 8px;font-size:13px;font-weight:600;color:var(--vscode-descriptionForeground,#888);text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--vscode-input-border,#555);position:sticky;top:0;background:var(--vscode-editor-background)}
.res-header-table tbody tr{border-bottom:1px solid var(--vscode-input-border,rgba(85,85,85,.3))}
.res-header-table tbody tr:hover{background:var(--vscode-list-hoverBackground,rgba(255,255,255,.04))}
.res-header-table td{padding:3px 8px;vertical-align:top}
.res-header-key-col{width:200px}
.res-header-key{font-weight:700;color:var(--vscode-foreground);white-space:nowrap}
.res-header-value{color:var(--vscode-descriptionForeground,#aaa);max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.res-header-value:hover{white-space:normal;word-break:break-all;overflow:visible}
.res-headers-panel{overflow:auto;flex:1;padding:4px 0}
.res-cookies-panel{overflow:auto;flex:1;padding:4px 0}
.res-cookie-table th,.res-cookie-table td{font-size:13px;padding:3px 6px}
.cookie-badge{display:inline-block;background:var(--vscode-badge-background,#4d4d4d);color:var(--vscode-badge-foreground,#ccc);font-size:13px;padding:0 4px;border-radius:3px;font-weight:600}
.tab-count{display:inline-block;background:var(--vscode-badge-background,#4d4d4d);color:var(--vscode-badge-foreground,#ccc);font-size:13px;padding:0 5px;border-radius:8px;margin-left:3px;min-width:14px;text-align:center;line-height:15px;vertical-align:middle}

/* ?묐떟 鍮꾧탳 (Pin / Compare) */
.pin-response-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1px solid var(--vscode-input-border,#555);border-radius:6px;background:transparent;color:var(--vscode-foreground);font-size:13px;cursor:pointer;transition:background .15s,transform .1s;user-select:none}
.pin-response-btn:hover{background:var(--vscode-button-secondaryHoverBackground,rgba(255,255,255,.1));transform:scale(1.05)}
.pin-response-btn:active{transform:scale(.92)}
.pin-response-btn.pinned{border-color:var(--vscode-charts-green,#4ec94e);color:var(--vscode-charts-green,#4ec94e)}
.compare-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1px solid var(--vscode-input-border,#555);border-radius:6px;background:transparent;color:var(--vscode-foreground);font-size:13px;cursor:pointer;transition:background .15s,transform .1s;user-select:none}
.compare-btn:hover:not(:disabled){background:var(--vscode-button-secondaryHoverBackground,rgba(255,255,255,.1));transform:scale(1.05)}
.compare-btn:active:not(:disabled){transform:scale(.92)}
.compare-btn:disabled{opacity:.35;cursor:default;transform:none}
.compare-btn.ready{border-color:var(--vscode-charts-blue,#3794ff);color:var(--vscode-charts-blue,#3794ff)}
/* ?묐떟 而⑦뀓?ㅽ듃 硫붾돱 */
.res-ctx-menu{position:fixed;z-index:9999;min-width:200px;background:var(--vscode-menu-background,#252526);color:var(--vscode-menu-foreground,#ccc);border:1px solid var(--vscode-menu-border,#454545);border-radius:5px;padding:4px 0;box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:13px}
.res-ctx-menu .ctx-item{padding:6px 16px;cursor:pointer;display:flex;align-items:center;gap:8px}
.res-ctx-menu .ctx-item:hover{background:var(--vscode-menu-selectionBackground,#094771)}
.res-ctx-menu .ctx-item.disabled{opacity:.35;cursor:default}
.res-ctx-menu .ctx-item.disabled:hover{background:transparent}
.res-ctx-menu .ctx-sep{height:1px;margin:4px 0;background:var(--vscode-menu-separatorBackground,#454545)}

.json-body{background:var(--vscode-input-background);padding:6px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);font-size:13px;white-space:pre-wrap;word-break:break-all;overflow:auto;flex:1;line-height:1.45}
.json-key{color:#9cdcfe}.json-str{color:#ce9178}.json-num{color:#b5cea8}.json-bool{color:#569cd6}.json-null{color:#569cd6}

/* ?묐떟 諛붾뵒 ?대컮 */
.res-body-toolbar{display:flex;align-items:center;gap:4px;padding:2px 0;flex-shrink:0}
.res-body-toolbar .toggle-group{display:flex;border:1px solid var(--vscode-input-border,#555);border-radius:3px;overflow:hidden;margin-right:4px}
.res-body-toolbar .toggle-btn{padding:2px 8px;font-size:13px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:none;opacity:.6;user-select:none}
.res-body-toolbar .toggle-btn:hover{opacity:.85}
.res-body-toolbar .toggle-btn.active{opacity:1;background:var(--vscode-button-secondaryBackground)}
.res-body-toolbar .tb-btn{position:relative;overflow:hidden;padding:2px 6px;font-size:13px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-input-border,#555);border-radius:3px;opacity:.6;transition:transform .1s}
.res-body-toolbar .tb-btn:hover{opacity:1}
.res-body-toolbar .tb-btn:active{transform:scale(.92)}
.response-search-wrap{margin-left:auto;display:flex;align-items:center;gap:4px;min-width:0;max-width:420px;flex:1;justify-content:flex-end}
.response-search-input{width:180px;max-width:100%;padding:3px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,#555);border-radius:4px;font-size:13px}
.response-search-input:focus{outline:1px solid var(--vscode-focusBorder)}
.response-search-count{min-width:54px;text-align:center;font-size:12px;color:var(--vscode-descriptionForeground,#a6a6a6);font-variant-numeric:tabular-nums}
.response-search-wrap .tb-btn.active{opacity:1;background:rgba(87,166,255,.14);border-color:rgba(87,166,255,.24)}
.kv-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.bulk-editor{display:flex;flex-direction:column;gap:8px;margin-bottom:10px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}
.bulk-editor-label{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.82}
.bulk-editor-input{min-height:90px;padding:8px 10px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:8px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace);resize:vertical}
.bulk-editor-actions{display:flex;gap:8px;justify-content:flex-end}
.kv-reveal,.auth-reveal{margin-left:6px;min-width:34px}
.runner-live-status{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border,#333);display:flex;flex-direction:column;gap:4px;background:rgba(255,255,255,.02)}
.runner-live-title{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.runner-live-copy{font-size:12px;line-height:1.5;color:var(--vscode-descriptionForeground,#a6a6a6)}
.runner-row.active{background:rgba(87,166,255,.1);border-left:2px solid rgba(87,166,255,.6)}
.response-search-hit{background:rgba(255,215,0,.22);color:inherit;border-radius:2px;padding:0 1px}
.response-search-hit.active{background:rgba(255,165,0,.42);box-shadow:0 0 0 1px rgba(255,165,0,.4)}

/* JSON ?몃━ 酉?*/
.json-tree{background:var(--vscode-input-background);padding:6px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);font-size:13px;overflow:auto;flex:1;line-height:1.6;user-select:text}
.jt-node{padding-left:16px}
.jt-row{display:flex;align-items:baseline;white-space:nowrap}
.jt-toggle{display:inline-block;width:14px;cursor:pointer;text-align:center;color:var(--vscode-foreground);opacity:.5;flex-shrink:0;user-select:none}
.jt-toggle:hover{opacity:1}
.jt-key{color:#9cdcfe;margin-right:4px}
.jt-str{color:#ce9178}.jt-num{color:#b5cea8}.jt-bool{color:#569cd6}.jt-null{color:#569cd6}
.jt-brace{color:var(--vscode-foreground);opacity:.6}
.jt-children{overflow:hidden}
.jt-children.collapsed{display:none}

/* Format ?쒕∼?ㅼ슫 */
.fmt-wrap{position:relative;display:inline-block}
.fmt-menu{display:none;position:absolute;top:100%;left:0;z-index:100;background:var(--vscode-dropdown-background,#252526);border:1px solid var(--vscode-dropdown-border,#555);border-radius:3px;padding:4px 0;min-width:170px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.fmt-menu.open{display:block}
.fmt-menu-label{padding:2px 10px;opacity:.5;font-size:13px;text-transform:uppercase;user-select:none}
.fmt-menu-item{padding:3px 10px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px}
.fmt-menu-item:hover{background:var(--vscode-list-hoverBackground)}
.fmt-menu-item .check{width:12px;text-align:center;opacity:.7}
.fmt-menu-sep{border-top:1px solid var(--vscode-input-border,#555);margin:3px 0}
.jt-ellipsis{color:var(--vscode-foreground);opacity:.4;cursor:pointer}
.jt-comma{opacity:.4}

.error-msg{color:var(--vscode-errorForeground,#f44);padding:6px;font-size:13px}
.hidden{display:none!important}
.spinner{display:inline-block;width:11px;height:11px;border:2px solid var(--vscode-foreground);border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:4px}
@keyframes spin{to{transform:rotate(360deg)}}

/* 怨듯넻 ripple 踰꾪듉 ?④낵 */
.ripple-btn{position:relative;overflow:hidden;transition:transform .05s ease}
.ripple-btn .ripple-circle{position:absolute;border-radius:50%;background:rgba(255,255,255,.4);transform:scale(0);animation:ripple-expand .35s ease-out forwards;pointer-events:none}
@keyframes ripple-expand{0%{transform:scale(0);opacity:1}100%{transform:scale(5);opacity:0}}
/* ?대┃ ??諛곌꼍??flash */
.ripple-btn.btn-flash{background:rgba(255,255,255,.25)!important}
/* ?뚮┝ ??諛붿슫?????먮옒 ?쒗??*/
@keyframes btn-bounce{0%{transform:scale(.85)}40%{transform:scale(.85)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
.ripple-btn.btn-bouncing{animation:btn-bounce .25s cubic-bezier(.22,.68,0,1.2) forwards}

/* ========== Send 踰꾪듉 ?대┃ ?댄럺??========== */
@keyframes send-click{
  0%{transform:scale(.82);box-shadow:0 0 25px 6px rgba(0,120,212,.8)}
  40%{transform:scale(1.05) translateY(-2px);box-shadow:0 0 12px 3px rgba(0,120,212,.4)}
  70%{transform:scale(1) translateY(0);box-shadow:0 0 4px 1px rgba(0,120,212,.15)}
  100%{transform:scale(1) translateY(0);box-shadow:none}
}
.send-click{animation:send-click .25s cubic-bezier(.22,.68,0,1.2) forwards!important;transition:none!important}
.send-click-flash{background:#40a0ff!important}

/* ========== ?꾩넚 以?珥앹븣 濡쒕뵫 諛?========== */
.bullet-progress{height:3px;width:100%;background:rgba(255,255,255,.05);overflow:hidden;flex-shrink:0;position:relative;opacity:0;transition:opacity .15s}
.bullet-progress.active{opacity:1}
@keyframes bullet-run{
  0%{left:-60px}
  100%{left:100%}
}
.bullet-progress .bullet-glow{position:absolute;top:0;height:100%;width:60px;background:linear-gradient(90deg,transparent,#4da6ff 30%,#80bfff 60%,transparent);border-radius:2px;animation:bullet-run 1.2s ease-in-out infinite;box-shadow:0 0 8px rgba(77,166,255,.5)}
/* ?꾨즺 ?? 珥앹븣???앷퉴吏 ?щ젮媛硫??щ씪吏?*/
@keyframes bullet-finish{
  0%{left:var(--pos);opacity:1}
  100%{left:100%;opacity:0}
}
.bullet-progress.finishing .bullet-glow{animation:bullet-finish .2s ease-out forwards}
.bullet-progress.finishing{transition:opacity .15s .2s;opacity:0}

/* ========== Stop 踰꾪듉 ?寃⑷컧 ========== */
/* stop: transform + box-shadow ?섎굹??keyframe?쇰줈 ?⑹묠 */
@keyframes stop-slam{
  0%{transform:scale(.82);box-shadow:0 0 20px rgba(255,50,50,.8)}
  40%{transform:scale(.82);box-shadow:0 0 16px rgba(255,50,50,.6)}
  70%{transform:scale(1.06);box-shadow:0 0 6px rgba(255,50,50,.2)}
  100%{transform:scale(1);box-shadow:none}
}
.btn-stop.stop-slam{animation:stop-slam .35s cubic-bezier(.22,.68,0,1.2) forwards!important;transition:none!important}
.btn-stop.stop-flash{background:#ff6b6b!important}
/* Stop vignette flash (?붾㈃ 鍮④컙 ?ㅻ쾭?덉씠) */
@keyframes stop-vignette{0%{opacity:.22}100%{opacity:0}}
.stop-vignette-flash{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:9999;background:radial-gradient(ellipse at center,transparent 40%,rgba(255,40,40,.35) 100%);animation:stop-vignette .25s ease-out forwards}

/* ========== Send?뭆top ?꾪솚 ========== */
@keyframes icon-fade-in{0%{opacity:0}100%{opacity:1}}
.btn-stop .stop-icon{animation:icon-fade-in .2s ease}
.btn-send svg{animation:icon-fade-in .2s ease}

/* Send 踰꾪듉 鍮?以꾧린 ?④낵 */
.btn-send .send-streak{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;border-radius:6px;overflow:hidden}
.btn-send .send-streak::after{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:none}
.btn-send.streak-active .send-streak::after{animation:send-streak .5s ease-out forwards}
@keyframes send-streak{0%{left:-60%}100%{left:120%}}

/* 踰꾪듉 ?쇰뱶諛??띿뒪??*/
.btn-feedback{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);white-space:nowrap;font-size:12px;font-weight:700;opacity:0;pointer-events:none;transition:opacity .15s}
.btn-feedback.show{opacity:1}


/* URL ?낅젰? 鍮?以꾧린 sweep */
@keyframes url-sweep{0%{background-position:-100% 0}100%{background-position:200% 0}}
.url-input-wrap.sweep::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;border-radius:3px;pointer-events:none;background:linear-gradient(90deg,transparent 0%,rgba(0,122,204,.25) 40%,rgba(0,122,204,.45) 50%,rgba(0,122,204,.25) 60%,transparent 100%);background-size:50% 100%;background-repeat:no-repeat;animation:url-sweep .3s ease forwards}

/* ?꾩넚 以??ㅼ삩 ?꾩뒪 */
@keyframes neon-pulse{0%{border-color:#007acc;box-shadow:0 0 3px rgba(0,122,204,.4)}50%{border-color:#3af;box-shadow:0 0 8px rgba(51,170,255,.6)}100%{border-color:#007acc;box-shadow:0 0 3px rgba(0,122,204,.4)}}
.url-bar input.neon-active{animation:neon-pulse 1.5s ease infinite;border-color:#007acc}

/* Send?묬ancel ?꾪솚 ?щ씪?대뱶 */
@keyframes btn-slide-in{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
.btn-sending{pointer-events:auto;position:relative;min-width:58px;animation:btn-slide-in .2s ease}
.btn-sending .spinner{width:10px;height:10px;border-width:1.5px;margin-right:3px}

/* 2xx ?깃났: 珥덈줉 鍮???컻 + scale 諛붿슫??*/
@keyframes badge-pop{0%{transform:scale(1.5);box-shadow:0 0 20px rgba(78,201,78,.9)}40%{transform:scale(.95);box-shadow:0 0 8px rgba(78,201,78,.4)}70%{transform:scale(1.08)}100%{transform:scale(1);box-shadow:none}}
.status.flash-success{animation:badge-pop .35s cubic-bezier(.17,.67,.35,1.5)}

/* 4xx/5xx ?ㅽ뙣: shake ?붾뱾由?(醫뚯슦 3px, 3?? + 鍮④컙 flash */
@keyframes badge-shake{0%,100%{transform:translateX(0);box-shadow:none}10%{transform:translateX(-3px)}20%{transform:translateX(3px)}30%{transform:translateX(-3px)}40%{transform:translateX(3px)}50%{transform:translateX(-3px)}60%{transform:translateX(3px)}70%{transform:translateX(0)}}
.status.flash-error{animation:badge-shake .35s ease;box-shadow:0 0 12px rgba(255,50,50,.6)}

/* 4xx/5xx ?붾㈃ ?꾩껜 鍮④컙??踰덉찉 */
@keyframes screen-flash-red{0%{opacity:.18}100%{opacity:0}}
.screen-flash{position:fixed;top:0;left:0;right:0;bottom:0;background:#c94e4e;pointer-events:none;z-index:9999;animation:screen-flash-red .12s ease forwards}

/* ?묐떟 ?곸뿭 ?щ옩 (諛붿슫?? */
@keyframes res-slam{0%{opacity:0;transform:translateY(-10px)}60%{opacity:1;transform:translateY(2px)}100%{transform:translateY(0)}}
.res-area.slide-in{animation:res-slam .25s cubic-bezier(.22,.68,0,1.2)}

/* ?꾨줈洹몃젅??諛?*/

/* PERFECT! ?띿뒪??*/
@keyframes perfect-pop{0%{opacity:0;transform:scale(.5)}30%{opacity:1;transform:scale(1.1)}60%{transform:scale(.95)}100%{opacity:0;transform:scale(1)}}
.perfect-badge{position:absolute;top:-18px;right:0;font-size:9px;font-weight:800;color:#4ec94e;letter-spacing:1px;pointer-events:none;animation:perfect-pop .8s ease forwards;text-shadow:0 0 6px rgba(78,201,78,.5)}

/* 寃쎄낵?쒓컙 ?ㅼ떆媛??쒖떆 */
.elapsed-timer{font-size:13px;opacity:.6;margin-left:4px;font-variant-numeric:tabular-nums}

.placeholder{display:flex;align-items:center;justify-content:center;flex:1;opacity:.25;font-size:13px}
.empty-state{display:flex;flex-direction:column;justify-content:center;gap:12px;min-height:180px;padding:18px 16px;border:1px solid rgba(255,255,255,.06);border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))}
.empty-state.inline{min-height:auto;padding:16px}
.empty-state-kicker{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--vscode-descriptionForeground,#8e8e8e)}
.empty-state-title{font-size:20px;font-weight:700;line-height:1.15}
.empty-state-copy{font-size:13px;line-height:1.6;color:var(--vscode-descriptionForeground,#a0a0a0);max-width:860px}
.empty-state-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.empty-state-card{padding:12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.empty-state-card strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;color:var(--vscode-foreground)}
.empty-state-card span{display:block;font-size:12px;line-height:1.5;color:var(--vscode-descriptionForeground,#a0a0a0)}
.empty-state-actions{display:flex;flex-wrap:wrap;gap:8px}
.empty-state-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:rgba(87,166,255,.08);border:1px solid rgba(87,166,255,.16);font-size:12px;color:#93c8ff}

/* ?ㅼ펷?덊넠 濡쒕뵫 UI */
@keyframes skeleton-pulse{0%{opacity:.15}50%{opacity:.3}100%{opacity:.15}}
.skeleton-loader{padding:12px 10px;display:flex;flex-direction:column;gap:8px}
.skeleton-line{height:14px;border-radius:4px;background:var(--vscode-foreground,#ccc);animation:skeleton-pulse 1.2s ease-in-out infinite}
.skeleton-line:nth-child(1){width:85%}
.skeleton-line:nth-child(2){width:70%;animation-delay:.15s}
.skeleton-line:nth-child(3){width:55%;animation-delay:.3s}
.skeleton-line:nth-child(4){width:40%;animation-delay:.45s}

/* 鍮??붿껌 ???덈궡 */
.empty-tab-hint{display:flex;align-items:center;justify-content:center;flex:1;color:var(--vscode-descriptionForeground,#888);font-size:13px;opacity:.5;text-align:center;padding:20px;user-select:none}
.script-editor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.script-card{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))}
.script-card-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-bottom:4px}
.script-card-note{font-size:12px;line-height:1.45;color:var(--vscode-descriptionForeground,#989898);margin-bottom:8px}
.script-card textarea{min-height:160px}
.default-headers-banner{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);margin-bottom:10px}
.default-headers-banner.active{border-color:rgba(78,201,78,.18);background:rgba(78,201,78,.05)}
.default-headers-banner.warning{border-color:rgba(229,192,123,.18);background:rgba(229,192,123,.06)}
.default-headers-banner-main{display:flex;flex-direction:column;gap:4px;min-width:0}
.default-headers-banner-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
.default-headers-banner-copy{font-size:13px;font-weight:600;line-height:1.45}
.default-headers-banner-note{font-size:12px;line-height:1.5;color:var(--vscode-descriptionForeground,#989898)}
.default-headers-key-group{display:flex;flex-direction:column;gap:4px;margin-top:4px}
.default-headers-key-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.62}
.default-headers-key-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.default-header-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);font-size:12px;font-family:var(--vscode-editor-font-family,monospace)}
.default-header-chip.override{border-color:rgba(229,192,123,.24);background:rgba(229,192,123,.1);color:#f0c995}

/* 而щ젆???щ꼫 */
.runner-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--vscode-editor-background);z-index:100;display:flex;flex-direction:column;overflow:hidden}
.runner-header{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border,#444);display:flex;align-items:center;gap:8px;flex-shrink:0}
.runner-header h3{font-size:13px;font-weight:600;flex:1;margin:0}
.runner-progress{padding:4px 12px;font-size:13px;opacity:.7;flex-shrink:0;display:flex;align-items:center;gap:6px}
.runner-bar{flex:1;height:3px;background:var(--vscode-input-background);border-radius:2px;overflow:hidden}
.runner-bar-fill{height:100%;background:var(--vscode-progressBar-background,#0e70c0);transition:width .2s}
.runner-summary{padding:6px 12px;font-size:13px;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;display:flex;gap:12px}
.runner-summary .pass{color:#4ec94e}.runner-summary .fail{color:#e06c75}
.runner-list{flex:1;overflow:auto;font-size:13px}
.runner-row{padding:4px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;border-bottom:1px solid var(--vscode-panel-border,#222)}
.runner-row:hover{background:var(--vscode-list-hoverBackground)}
.runner-row .rr-idx{opacity:.4;width:20px;text-align:right}
.runner-row .rr-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.runner-row .rr-status{font-weight:700;min-width:44px}
.runner-row .rr-time{opacity:.5;min-width:40px;text-align:right}
.runner-row .rr-icon{font-size:13px}
.runner-row.pass .rr-status{color:#4ec94e}.runner-row.fail .rr-status{color:#e06c75}.runner-row.pending{opacity:.35}
.runner-detail{padding:6px 12px;background:var(--vscode-input-background);border-bottom:1px solid var(--vscode-panel-border,#333);font-family:var(--vscode-editor-font-family,monospace);font-size:13px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow:auto}

/* ?쒖꽦 ?섍꼍 ?쒖떆 */
.env-indicator{font-size:13px;opacity:.6;padding:0 10px 2px;flex-shrink:0}
.env-indicator .var-name{color:#dcdcaa}
@media (max-width: 900px){
  .request-topline{align-items:flex-start}
  .request-topline-right{margin-left:0}
  .url-bar{flex-wrap:wrap}
  .url-bar-spacer{display:none}
  .btn-send,.btn-stop{margin-left:auto}
  .settings-grid,.script-editor-grid,.empty-state-grid{grid-template-columns:1fr}
  .response-meta{align-items:flex-start}
  .default-headers-banner{flex-direction:column}
}
</style>
</head>
<body>

<!-- ?붿껌 ??諛?-->
<div class="tab-bar" id="tabBar">
<div class="add-tab" id="addTabBtn" title="${LocalizationService.t('webview.newTab', undefined, displayLanguage)}">+</div>
</div>

<!-- ?섍꼍蹂???몄쭛 (?④? ?곹깭) -->
<div id="envEditor" class="env-editor hidden">
  <div class="env-editor-title">
    <span id="envEditorTitle">${LocalizationService.t('webview.environment', undefined, displayLanguage)}</span>
    <span class="env-badge" id="envEditorName"></span>
    <span style="flex:1"></span>
    <span class="env-dirty-dot" id="envDirtyDot" title="${LocalizationService.t('webview.unsavedChanges', undefined, displayLanguage)}"></span>
    <span class="env-autosave-indicator" id="envAutoSaved"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6.27 10.87h.04l4.49-4.49-1.06-1.06-3.47 3.47-1.47-1.47-1.06 1.06 2.53 2.49z"/><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12z"/></svg> <span id="envAutoSavedLabel">${LocalizationService.t('webview.autoSaved', undefined, displayLanguage)}</span></span>
    <span class="rm" id="envCloseBtn" style="cursor:pointer;font-size:14px;opacity:.6">&times;</span>
  </div>
  <div id="envVarRows" class="kv-section"></div>
  <button class="add-btn" id="addEnvVarBtn">${LocalizationService.t('webview.addVariable', undefined, displayLanguage)}</button>
</div>

<!-- 湲곕낯 ?ㅻ뜑 ?몄쭛 (?④? ?곹깭) -->
<div id="defaultHeadersEditor" class="env-editor hidden">
  <div class="env-editor-title">
    <span id="defaultHeadersTitle">${LocalizationService.t('webview.defaultHeaders', undefined, displayLanguage)}</span>
    <span style="flex:1"></span>
    <button class="btn btn-s" id="defaultHeadersSaveBtn" style="padding:2px 8px;font-size:13px">${LocalizationService.t('webview.save', undefined, displayLanguage)}</button>
    <span class="rm" id="defaultHeadersCloseBtn" style="cursor:pointer;font-size:14px;opacity:.6">&times;</span>
  </div>
  <div id="defaultHeaderRows" class="kv-section"></div>
  <button class="add-btn" id="addDefaultHeaderBtn">${LocalizationService.t('webview.addHeader', undefined, displayLanguage)}</button>
</div>

<!-- 硫붿씤 (??퀎 而⑦뀗痢? -->
<div class="main-content" id="mainContent">
  <div class="placeholder" id="emptyPlaceholder">${LocalizationService.t('webview.emptyPlaceholder', undefined, displayLanguage)}</div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let i18n = ${localizedStrings};
let appDateLocale = ${JSON.stringify(dateLocale)};
let currentDisplayLanguage = ${JSON.stringify(displayLanguage)};

// === ???곹깭 愿由?===
let tabs = [];       // { id, name, method, url, headers, params, body, auth, response, error, loading }
let activeTabId = null;
let tabIdCounter = 0;
let currentEnvName = null;
let editingEnvId = null;
let activeVarKeys = [];  // ?쒖꽦 ?섍꼍??蹂????紐⑸줉
let workspaceDefaultHeaders = [];
let pendingSaveBtn = null;          // Save 踰꾪듉 ?ㅼ씠?쇰줈洹??꾨즺 ?湲?
let pendingSaveResponseBtn = null;  // Save Response Body 踰꾪듉 ?ㅼ씠?쇰줈洹??꾨즺 ?湲?
var _pendingCloseAfterSave = null;  // dirty ???リ린 ????????レ쓣 ??ID
const VALID_BODY_TYPES = ['none', 'json', 'xml', 'form', 'formdata', 'binary', 'raw'];

const DEFAULT_COMPARE_IGNORE_HEADERS = ['date', 'set-cookie', 'x-request-id', 'x-correlation-id', 'x-amzn-trace-id'];
const DEFAULT_COMPARE_IGNORE_JSON_PATHS = ['$.timestamp', '$.traceId', '$.requestId', '$.correlationId'];
var pinnedResponses = [];
var lastResponse = null;
var compareSettings = normalizeCompareSettings();
var activeFormatMenuState = null;
var splitDragState = null;

function closeActiveFormatMenu() {
  if (!activeFormatMenuState) return;
  if (activeFormatMenuState.menu) activeFormatMenuState.menu.classList.remove('open');
  activeFormatMenuState = null;
}

function releaseSplitDrag() {
  if (!splitDragState) return;
  if (splitDragState.divider) splitDragState.divider.classList.remove('active');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  splitDragState = null;
}

document.addEventListener('click', function(e) {
  if (!activeFormatMenuState) return;
  if (!activeFormatMenuState.menu?.isConnected || !activeFormatMenuState.button?.isConnected) {
    closeActiveFormatMenu();
    return;
  }
  if (activeFormatMenuState.menu.contains(e.target) || activeFormatMenuState.button.contains(e.target)) {
    return;
  }
  closeActiveFormatMenu();
});

document.addEventListener('mousemove', function(e) {
  if (!splitDragState) return;
  if (!splitDragState.divider?.isConnected || !splitDragState.splitEl?.isConnected || !splitDragState.reqArea?.isConnected) {
    releaseSplitDrag();
    return;
  }
  var dy = e.clientY - splitDragState.startY;
  var newH = Math.max(60, splitDragState.startH + dy);
  var maxH = splitDragState.splitEl.offsetHeight - 40 - splitDragState.divider.offsetHeight;
  newH = Math.min(newH, maxH);
  splitDragState.reqArea.style.height = newH + 'px';
  splitDragState.reqArea.style.flex = 'none';
  splitDragState.reqArea.dataset.manualHeight = '1';
});

document.addEventListener('mouseup', function() {
  releaseSplitDrag();
});

function tr(key) {
  return Object.prototype.hasOwnProperty.call(i18n, key) ? i18n[key] : key;
}

function tf(key, params) {
  return tr(key).replace(/{([A-Za-z0-9_]+)}/g, function(_, name) {
    return Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params[name]) : '{' + name + '}';
  });
}

function tfCount(key, count) {
  return tf(key, { count: String(count) });
}

function renderEnvironmentIndicator(envName) {
  return '<span class="env-label">' + escapeHtml(tr('webview.environment')) + '</span><span class="env-name">' + escapeHtml(envName) + '</span>';
}

function renderStatusChip(label, tone, action, meta) {
  var attrs = action
    ? ' type="button" data-action="' + escapeAttr(action) + '"' + (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '')
    : '';
  return '<button class="request-status-chip' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '') + '"' + attrs + '>' + escapeHtml(label) + '</button>';
}

function renderEnvironmentStatusChip(envName) {
  return '<button class="request-status-chip info clickable" type="button" data-action="switch-environment">' + renderEnvironmentIndicator(envName) + '</button>';
}

function renderPreflightPill(label, tone, action, meta) {
  return '<button class="preflight-pill' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '') + '"' +
    (action ? ' type="button" data-action="' + escapeAttr(action) + '"' : '') +
    (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '') +
    '>' + escapeHtml(label) + '</button>';
}

function collectTemplateVariableNames(target, text) {
  if (!text) return;
  var re = /\{\{([^}]+)\}\}/g;
  var match;
  while ((match = re.exec(String(text))) !== null) {
    var name = (match[1] || '').trim();
    if (name) target.add(name);
  }
}

function collectTemplateVariablesFromKeyValues(target, items) {
  (items || []).forEach(function(item) {
    if (!item || item.enabled === false) return;
    collectTemplateVariableNames(target, item.key);
    collectTemplateVariableNames(target, item.value);
  });
}

function isSensitiveKeyName(value) {
  return /(^|[-_])(authorization|token|secret|password|passwd|pwd|api[-_]?key|session|cookie|access[-_]?token|refresh[-_]?token)([-_]|$)/i.test(String(value || '').trim());
}

function authSummaryLabel(auth) {
  if (!auth || auth.type === 'none') return tr('webview.authSummaryNone');
  if (auth.type === 'basic') return tr('webview.authSummaryBasic');
  if (auth.type === 'bearer') return tr('webview.authSummaryBearer');
  if (auth.type === 'apikey') {
    return auth?.apikey?.addTo === 'query'
      ? tr('webview.authSummaryApiKeyQuery')
      : tr('webview.authSummaryApiKeyHeader');
  }
  return authTypeLabel(auth.type);
}

function getUnresolvedDraftVariableNames(tab) {
  var names = new Set();
  if (!tab) return [];
  collectTemplateVariableNames(names, tab.url);
  collectTemplateVariablesFromKeyValues(names, tab.headers);
  collectTemplateVariablesFromKeyValues(names, tab.params);
  collectTemplateVariableNames(names, tab.body);
  collectTemplateVariableNames(names, tab.binaryFilePath);
  (tab.formData || []).forEach(function(field) {
    if (!field || field.enabled === false) return;
    collectTemplateVariableNames(names, field.key);
    collectTemplateVariableNames(names, field.value);
  });
  if (!tab.skipDefaultHeaders) {
    collectTemplateVariablesFromKeyValues(names, workspaceDefaultHeaders);
  }
  if (tab.auth?.basic) {
    collectTemplateVariableNames(names, tab.auth.basic.username);
    collectTemplateVariableNames(names, tab.auth.basic.password);
  }
  if (tab.auth?.bearer) {
    collectTemplateVariableNames(names, tab.auth.bearer.token);
  }
  if (tab.auth?.apikey) {
    collectTemplateVariableNames(names, tab.auth.apikey.key);
    collectTemplateVariableNames(names, tab.auth.apikey.value);
  }
  return Array.from(names).filter(function(name) {
    return activeVarKeys.indexOf(name) < 0;
  });
}

function buildDraftTabFromContent(mc) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !mc) return tab;
  var methodEl = mc.querySelector('.js-method');
  var saveHistoryInput = mc.querySelector('.js-save-history');
  var skipDefaultHeadersInput = mc.querySelector('.js-skip-default-headers');
  var disableScriptsInput = mc.querySelector('.js-disable-scripts');
  return Object.assign({}, tab, {
    method: methodEl ? methodEl.value : tab.method,
    url: mc.querySelector('.js-url')?.value || tab.url || '',
    headers: collectKv(mc.querySelector('.js-header-rows')),
    params: collectKv(mc.querySelector('.js-param-rows')),
    body: mc.querySelector('.js-body')?.value || '',
    bodyType: normalizeBodyType(mc.querySelector('.js-body-type')?.value || tab.bodyType),
    formData: collectFormData(mc.querySelector('.js-formdata-rows')),
    binaryFilePath: mc.querySelector('.js-binary-path')?.value || '',
    auth: collectAuth(mc),
    scripts: collectScripts(mc),
    saveToHistory: saveHistoryInput ? saveHistoryInput.checked !== false : tab.saveToHistory !== false,
    skipDefaultHeaders: skipDefaultHeadersInput ? skipDefaultHeadersInput.checked === true : !!tab.skipDefaultHeaders,
    disableScripts: disableScriptsInput ? disableScriptsInput.checked === true : !!tab.disableScripts
  });
}

function renderUnresolvedVariableBanner(tab) {
  var unresolved = getUnresolvedDraftVariableNames(tab);
  if (unresolved.length === 0) return '';
  return '<div class="preflight-warning">' +
    '<div class="preflight-warning-title">' + escapeHtml(tfCount('webview.unresolvedVariablesCount', unresolved.length)) + '</div>' +
    '<div class="preflight-warning-copy">' + escapeHtml(unresolved.map(function(name) { return '{{' + name + '}}'; }).join(', ')) + '</div>' +
    '<div class="preflight-warning-actions">' +
      '<button class="ghost-btn ripple-btn js-preflight-action" type="button" data-action="switch-environment">' + escapeHtml(tr('webview.openEnvironmentPicker')) + '</button>' +
      '<button class="ghost-btn ripple-btn js-preflight-action" type="button" data-action="switch-tab" data-meta="headers">' + escapeHtml(tr('webview.reviewRequestInputs')) + '</button>' +
    '</div>' +
  '</div>';
}

function renderRequestPreflight(tab) {
  if (!tab) return '';
  var headerCount = (tab.headers || []).filter(function(item) { return item && item.enabled !== false && item.key; }).length;
  var paramCount = (tab.params || []).filter(function(item) { return item && item.enabled !== false && item.key; }).length;
  var unresolved = getUnresolvedDraftVariableNames(tab);
  var pills = [
    renderPreflightPill(currentEnvName ? tf('webview.summaryEnvironment', { name: currentEnvName }) : tr('webview.noEnvironment'), currentEnvName ? 'info' : 'warning', 'switch-environment'),
    renderPreflightPill(tf('webview.summaryAuth', { value: authSummaryLabel(tab.auth) }), tab.auth?.type && tab.auth.type !== 'none' ? 'accent' : 'muted', 'switch-tab', 'auth'),
    renderPreflightPill(tfCount('webview.summaryHeaders', headerCount), headerCount > 0 ? 'accent' : 'muted', 'switch-tab', 'headers'),
    renderPreflightPill(tfCount('webview.summaryParams', paramCount), paramCount > 0 ? 'accent' : 'muted', 'switch-tab', 'params'),
    renderPreflightPill(tab.disableScripts ? tr('webview.summaryScriptsOff') : tr('webview.summaryScriptsOn'), tab.disableScripts ? 'warning' : 'info', 'switch-tab', tab.disableScripts ? 'settings' : 'scripts'),
    renderPreflightPill(tab.saveToHistory === false ? tr('webview.summaryHistoryOff') : tr('webview.summaryHistoryOn'), tab.saveToHistory === false ? 'muted' : 'info', 'switch-tab', 'settings')
  ];
  if (unresolved.length > 0) {
    pills.unshift(renderPreflightPill(tfCount('webview.unresolvedVariablesCount', unresolved.length), 'warning', 'switch-environment'));
  }
  return '<div class="request-preflight js-request-preflight">' +
    '<div class="request-preflight-pills">' + pills.join('') + '</div>' +
    renderUnresolvedVariableBanner(tab) +
  '</div>';
}

function collapseWhitespace(text) {
  var cr = String.fromCharCode(13);
  var lf = String.fromCharCode(10);
  var tab = String.fromCharCode(9);
  var ff = String.fromCharCode(12);
  return String(text || '')
    .split(cr).join(' ')
    .split(lf).join(' ')
    .split(tab).join(' ')
    .split(ff).join(' ')
    .split(' ')
    .filter(function(part) { return part.length > 0; })
    .join(' ');
}

function formatShortTime(date) {
  try {
    return new Intl.DateTimeFormat(appDateLocale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

function bodyTypeLabel(type) {
  var map = {
    none: tr('webview.none'),
    json: 'JSON',
    xml: 'XML',
    form: tr('webview.formUrlEncoded'),
    formdata: tr('webview.formData'),
    binary: tr('webview.binary'),
    raw: tr('webview.raw'),
  };
  return map[type] || type;
}

function authTypeLabel(type) {
  var map = {
    none: tr('webview.noAuth'),
    basic: tr('webview.basicAuth'),
    bearer: tr('webview.bearerToken'),
    apikey: tr('webview.apiKey'),
  };
  return map[type] || type;
}

function normalizeCompareList(value, fallback) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(function(item) { return item.trim(); }).filter(Boolean);
  }
  return fallback.slice();
}

function normalizeCompareSettings(value) {
  var mode = value && (value.mode === 'raw' || value.mode === 'pretty' || value.mode === 'normalized')
    ? value.mode
    : 'normalized';
  return {
    mode: mode,
    includeMetadataSummary: value ? value.includeMetadataSummary !== false : true,
    ignoreHeaders: normalizeCompareList(value && value.ignoreHeaders, DEFAULT_COMPARE_IGNORE_HEADERS),
    ignoreJsonPaths: normalizeCompareList(value && value.ignoreJsonPaths, DEFAULT_COMPARE_IGNORE_JSON_PATHS)
  };
}

function cloneCompareSettings(value) {
  var normalized = normalizeCompareSettings(value);
  return {
    mode: normalized.mode,
    includeMetadataSummary: normalized.includeMetadataSummary,
    ignoreHeaders: normalized.ignoreHeaders.slice(),
    ignoreJsonPaths: normalized.ignoreJsonPaths.slice()
  };
}

function compareModeShort(mode) {
  return mode === 'raw' ? tr('webview.modeRaw') : mode === 'pretty' ? tr('webview.modePretty') : tr('webview.modeNormalized');
}

function compareModeLabel(mode) {
  return mode === 'raw' ? tr('webview.modeRaw') : mode === 'pretty' ? tr('webview.modePretty') : tr('webview.modeNormalized');
}

function simpleHash(value) {
  var hash = 5381;
  for (var i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(36);
}

function buildResponseSignature(snapshot) {
  return [
    snapshot.status || 0,
    snapshot.statusText || '',
    snapshot.contentType || '',
    snapshot.resolvedUrl || '',
    snapshot.body ? snapshot.body.length : 0,
    simpleHash(snapshot.bodyBase64 || snapshot.body || '')
  ].join('|');
}

function createResponseSnapshot(tab, response, label) {
  if (!tab || !response) return null;
  var ct = response.headers?.['content-type'] || response.headers?.['Content-Type'] || 'text/plain';
  var snapshot = {
    label: label,
    body: response.body || '',
    bodyBase64: response.bodyBase64 || '',
    contentType: ct,
    status: response.status,
    statusText: response.statusText,
    size: response.size,
    time: response.time,
    resolvedUrl: tab.resolvedUrl || tab.url || '',
    headers: response.headers || {},
    timestamp: Date.now(),
    jsonFormatStyle: tab.jsonFormatStyle || 'pretty',
    xmlFormatStyle: tab.xmlFormatStyle || 'inline',
    formatIndent: tab.formatIndent || '2'
  };
  snapshot.signature = buildResponseSignature(snapshot);
  return snapshot;
}

function getActiveResponseSnapshot() {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return null;
  var envLabel = currentEnvName ? '[' + currentEnvName + ']' : '';
  var timeLabel = formatShortTime(new Date());
  var label = ((tab.name || (tab.method + ' ' + tab.url)) + ' ' + envLabel + ' ' + timeLabel).trim();
  return createResponseSnapshot(tab, tab.response, label);
}

function serializeCompareSnapshot(snapshot) {
  return {
    label: snapshot.label,
    body: snapshot.body,
    bodyBase64: snapshot.bodyBase64 || '',
    contentType: snapshot.contentType,
    status: snapshot.status,
    statusText: snapshot.statusText,
    size: snapshot.size,
    time: snapshot.time,
    resolvedUrl: snapshot.resolvedUrl,
    headers: snapshot.headers || {},
    timestamp: snapshot.timestamp,
    jsonFormatStyle: snapshot.jsonFormatStyle || 'pretty',
    xmlFormatStyle: snapshot.xmlFormatStyle || 'inline',
    formatIndent: snapshot.formatIndent || '2'
  };
}

function requestCompare(left, right) {
  if (!left || !right) return;
  vscode.postMessage({
    type: 'compareResponses',
    left: serializeCompareSnapshot(left),
    right: serializeCompareSnapshot(right),
    options: cloneCompareSettings(compareSettings)
  });
}

function compareCurrentWithLast() {
  var current = getActiveResponseSnapshot();
  if (!current || !lastResponse) return;
  requestCompare(lastResponse, current);
}

function buildCompareChipMarkup(currentSignature) {
  return '<span class="compare-chip mode"><strong>' + escapeHtml(tr('webview.mode')) + '</strong> ' + escapeHtml(compareModeShort(compareSettings.mode)) + '</span>' +
    (compareSettings.includeMetadataSummary ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.includeMetadata')) + '</span>' : '') +
    (lastResponse ? '<span class="compare-chip ready"><strong>' + escapeHtml(tr('webview.last')) + '</strong> ' + escapeHtml(tr('webview.lastReady')) + '</span>' : '') +
    (pinnedResponses.length >= 2 ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.comparePinned')) + '</span>' : '') +
    pinnedResponses.map(function(pin, index) {
      var current = pin.signature === currentSignature;
      return '<span class="compare-chip' + (current ? ' current' : '') + '">' +
        '<strong>' + escapeHtml(current ? tr('webview.pinnedHere') : tf('webview.pinNumber', { count: index + 1 })) + '</strong>' +
        escapeHtml(truncate(pin.label || tr('webview.savedResponse'), 24)) +
      '</span>';
    }).join('');
}

function updatePinCompareButtons(mc) {
  var activeSnapshot = getActiveResponseSnapshot();
  var currentPinned = activeSnapshot
    ? pinnedResponses.some(function(pin) { return pin.signature === activeSnapshot.signature; })
    : false;

  var pinBtn = mc.querySelector('.js-pin-response');
  if (pinBtn) {
    pinBtn.classList.toggle('pinned', currentPinned);
    pinBtn.innerHTML = pinSvg + ' ' + escapeHtml(currentPinned ? tr('webview.unpin') : tr('webview.pin')) + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '');
  }

  var cmpBtn = mc.querySelector('.js-compare-responses');
  if (cmpBtn) {
    if (pinnedResponses.length >= 2) {
      cmpBtn.disabled = false;
      cmpBtn.classList.add('ready');
    } else {
      cmpBtn.disabled = true;
      cmpBtn.classList.remove('ready');
    }
    cmpBtn.innerHTML = diffSvg + ' ' + escapeHtml(tr('webview.compare')) + ' ' + escapeHtml(compareModeShort(compareSettings.mode)) + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '');
  }

  var compareLastBtn = mc.querySelector('.js-compare-last');
  if (compareLastBtn) {
    compareLastBtn.disabled = !lastResponse;
    compareLastBtn.textContent = tr('webview.last');
  }

  var settingsBtn = mc.querySelector('.js-compare-settings');
  if (settingsBtn) {
    settingsBtn.textContent = tr('webview.mode') + ': ' + compareModeShort(compareSettings.mode);
  }

  var chipRow = mc.querySelector('.js-compare-chip-row');
  if (chipRow) {
    chipRow.innerHTML = buildCompareChipMarkup(activeSnapshot ? activeSnapshot.signature : '');
  }
}
var pinSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1C8.55228 1 9 1.44772 9 2V7.586L12.707 3.879C13.098 3.488 13.731 3.488 14.121 3.879C14.512 4.269 14.512 4.902 14.121 5.293L9 10.414V14C9 14.5523 8.55228 15 8 15C7.44772 15 7 14.5523 7 14V10.414L1.879 5.293C1.488 4.902 1.488 4.269 1.879 3.879C2.269 3.488 2.902 3.488 3.293 3.879L7 7.586V2C7 1.44772 7.44772 1 8 1Z"/></svg>';
var diffSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4h5v1H2V4zm0 3h5v1H2V7zm0 3h5v1H2v-1zm9-6h5v1h-5V4zm0 3h5v1h-5V7zm0 3h5v1h-5v-1zM8 1v14l-1-1V2l1-1z"/></svg>';

function showCompareSettings() {
  var old = document.getElementById('compareSettingsOverlay');
  if (old) old.remove();

  var draft = cloneCompareSettings(compareSettings);
  var overlay = document.createElement('div');
  overlay.id = 'compareSettingsOverlay';
  overlay.className = 'dirty-confirm-overlay';
  overlay.innerHTML =
    '<div class="dirty-confirm-dialog compare-settings-dialog">' +
      '<div class="dirty-confirm-msg">' + escapeHtml(tr('webview.comparisonSettings')) + '</div>' +
      '<div class="compare-settings-grid">' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.mode')) + '</label>' +
          '<div class="compare-mode-options">' +
            '<button class="compare-mode-chip' + (draft.mode === 'raw' ? ' active' : '') + '" data-mode="raw">' + escapeHtml(tr('webview.modeRaw')) + '</button>' +
            '<button class="compare-mode-chip' + (draft.mode === 'normalized' ? ' active' : '') + '" data-mode="normalized">' + escapeHtml(tr('webview.modeNormalized')) + '</button>' +
            '<button class="compare-mode-chip' + (draft.mode === 'pretty' ? ' active' : '') + '" data-mode="pretty">' + escapeHtml(tr('webview.modePretty')) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label><input type="checkbox" class="js-compare-metadata"' + (draft.includeMetadataSummary ? ' checked' : '') + '/> ' + escapeHtml(tr('webview.includeMetadata')) + '</label>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.ignoredHeaders')) + '</label>' +
          '<input type="text" class="compare-settings-input js-compare-ignore-headers" value="' + escapeAttr(draft.ignoreHeaders.join(', ')) + '"/>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.ignoredJsonPaths')) + '</label>' +
          '<input type="text" class="compare-settings-input js-compare-ignore-paths" value="' + escapeAttr(draft.ignoreJsonPaths.join(', ')) + '"/>' +
        '</div>' +
        '<div class="compare-settings-note">' + escapeHtml(tr('webview.normalizedModeNote')) + '</div>' +
      '</div>' +
      '<div class="dirty-confirm-actions compare-settings-actions">' +
        '<button class="dirty-btn dirty-btn-discard" data-action="reset">' + escapeHtml(tr('webview.reset')) + '</button>' +
        '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
        '<button class="dirty-btn dirty-btn-save" data-action="save">' + escapeHtml(tr('webview.save')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  overlay.querySelectorAll('.compare-mode-chip').forEach(function(button) {
    button.addEventListener('click', function(event) {
      event.preventDefault();
      draft.mode = button.dataset.mode;
      overlay.querySelectorAll('.compare-mode-chip').forEach(function(chip) {
        chip.classList.toggle('active', chip === button);
      });
    });
  });

  overlay.addEventListener('click', function(event) {
    var target = event.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    if (action === 'cancel') {
      overlay.remove();
      return;
    }

    if (action === 'reset') {
      overlay.remove();
      compareSettings = cloneCompareSettings({
        mode: 'normalized',
        includeMetadataSummary: true,
        ignoreHeaders: DEFAULT_COMPARE_IGNORE_HEADERS,
        ignoreJsonPaths: DEFAULT_COMPARE_IGNORE_JSON_PATHS
      });
      renderContent();
      debouncePersist();
      return;
    }

    draft.includeMetadataSummary = !!overlay.querySelector('.js-compare-metadata')?.checked;
    draft.ignoreHeaders = normalizeCompareList(
      overlay.querySelector('.js-compare-ignore-headers')?.value || '',
      []
    );
    draft.ignoreJsonPaths = normalizeCompareList(
      overlay.querySelector('.js-compare-ignore-paths')?.value || '',
      []
    );
    compareSettings = normalizeCompareSettings(draft);
    overlay.remove();
    renderContent();
    debouncePersist();
  });
}

function normalizeBodyType(bodyType) {
  if (VALID_BODY_TYPES.indexOf(bodyType) >= 0) return bodyType;
  return bodyType === 'text' ? 'raw' : 'none';
}

// === ??諛?===
const tabBar = document.getElementById('tabBar');
const addTabBtn = document.getElementById('addTabBtn');
const mainContent = document.getElementById('mainContent');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');

function setTextContent(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateStaticLocalizedText() {
  document.documentElement.lang = currentDisplayLanguage;
  addTabBtn.title = tr('webview.newTab');
  if (emptyPlaceholder) emptyPlaceholder.textContent = tr('webview.emptyPlaceholder');
  setTextContent('envEditorTitle', tr('webview.environment'));
  setTextContent('envAutoSavedLabel', tr('webview.autoSaved'));
  setTextContent('addEnvVarBtn', tr('webview.addVariable'));
  setTextContent('defaultHeadersTitle', tr('webview.defaultHeaders'));
  setTextContent('defaultHeadersSaveBtn', tr('webview.save'));
  setTextContent('addDefaultHeaderBtn', tr('webview.addHeader'));
  var envDirty = document.getElementById('envDirtyDot');
  if (envDirty) envDirty.title = tr('webview.unsavedChanges');
}

function applyLocalizationUpdate(msg) {
  if (msg.strings && typeof msg.strings === 'object') {
    i18n = msg.strings;
  }
  if (typeof msg.dateLocale === 'string' && msg.dateLocale) {
    appDateLocale = msg.dateLocale;
  }
  if (typeof msg.displayLanguage === 'string' && msg.displayLanguage) {
    currentDisplayLanguage = msg.displayLanguage;
  }
  tabs.forEach(function(tab) {
    if (tab.autoName || isKnownDefaultTabName(tab.name)) {
      tab.name = tr('webview.stage.newRequest');
      tab.autoName = true;
    }
  });
  updateStaticLocalizedText();
  envVarRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  defaultHeaderRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  renderTabBar();
  renderContent();
}

addTabBtn.addEventListener('click', () => createTab());
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); createTab(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'w' && activeTabId) { e.preventDefault(); closeTab(activeTabId); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handlePrimaryAction(); }
});

updateStaticLocalizedText();

function knownDefaultTabNames() {
  return ['New Request', '새 요청', '新しいリクエスト', 'Nouvelle requête'];
}

function isKnownDefaultTabName(name) {
  return knownDefaultTabNames().indexOf(name) >= 0;
}

// ???ㅻ깄???앹꽦 (dirty 鍮꾧탳??
function normalizeNumberSetting(value) {
  var num = parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeTlsValidation(value) {
  return value === 'strict' || value === 'insecure' ? value : 'default';
}

function getRequestSettings(data) {
  return {
    timeout: normalizeNumberSetting(data?.timeout),
    followRedirects: data?.followRedirects === true,
    saveToHistory: data?.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(data?.tlsValidation),
    maxResponseSizeKb: normalizeNumberSetting(data?.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(data?.retryCount),
    retryDelayMs: normalizeNumberSetting(data?.retryDelayMs),
    stopAfterHeaders: data?.stopAfterHeaders === true,
    skipDefaultHeaders: data?.skipDefaultHeaders === true,
    disableScripts: data?.disableScripts === true,
  };
}

function applyRequestSettings(target, data) {
  var settings = getRequestSettings(data);
  target.timeout = settings.timeout;
  target.followRedirects = settings.followRedirects;
  target.saveToHistory = settings.saveToHistory;
  target.tlsValidation = settings.tlsValidation;
  target.maxResponseSizeKb = settings.maxResponseSizeKb;
  target.retryCount = settings.retryCount;
  target.retryDelayMs = settings.retryDelayMs;
  target.stopAfterHeaders = settings.stopAfterHeaders;
  target.skipDefaultHeaders = settings.skipDefaultHeaders;
  target.disableScripts = settings.disableScripts;
  return target;
}

function requestSettingsSnapshot(tab) {
  return {
    timeout: tab.timeout,
    followRedirects: !!tab.followRedirects,
    saveToHistory: tab.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(tab.tlsValidation),
    maxResponseSizeKb: normalizeNumberSetting(tab.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(tab.retryCount),
    retryDelayMs: normalizeNumberSetting(tab.retryDelayMs),
    stopAfterHeaders: !!tab.stopAfterHeaders,
    skipDefaultHeaders: !!tab.skipDefaultHeaders,
    disableScripts: !!tab.disableScripts,
  };
}

function buildSaveRequestMessage(tab, requestId) {
  var payload = {
    type: 'saveRequest',
    method: tab.method,
    url: tab.url,
    headers: tab.headers,
    params: tab.params,
    body: tab.body,
    bodyType: tab.bodyType,
    formData: tab.formData || [],
    binaryFilePath: tab.binaryFilePath || '',
    auth: tab.auth,
    scripts: tab.scripts || { preRequest: '', test: '' },
  };
  if (requestId !== undefined) {
    payload.requestId = requestId;
  }
  return Object.assign(payload, requestSettingsSnapshot(tab));
}

function snapshotTab(tab) {
  return JSON.stringify({
    method: tab.method, url: tab.url,
    headers: tab.headers, params: tab.params,
    body: tab.body, bodyType: tab.bodyType,
    formData: tab.formData, binaryFilePath: tab.binaryFilePath,
    auth: tab.auth, scripts: tab.scripts,
    settings: requestSettingsSnapshot(tab)
  });
}

// ??씠 dirty ?곹깭?몄? ?먮퀎
function isTabDirty(tab) {
  if (!tab) return false;
  // ???? URL, ?ㅻ뜑, ?뚮씪誘명꽣, 諛붾뵒 以??섎굹?쇰룄 ?낅젰?섎㈃ dirty
  if (!tab._snapshot) {
    return !!(
      tab.url ||
      tab.headers.some(function(h){return h.key||h.value}) ||
      tab.params.some(function(p){return p.key||p.value}) ||
      tab.body ||
      (tab.formData || []).some(function(field){return field.key || field.value}) ||
      tab.binaryFilePath ||
      tab.scripts?.preRequest ||
      tab.scripts?.test ||
      tab.timeout ||
      tab.followRedirects ||
      tab.saveToHistory === false ||
      (tab.tlsValidation && tab.tlsValidation !== 'default') ||
      tab.maxResponseSizeKb ||
      tab.retryCount ||
      tab.retryDelayMs ||
      tab.stopAfterHeaders ||
      tab.skipDefaultHeaders ||
      tab.disableScripts
    );
  }
  // 而щ젆?섏뿉??遺덈윭???? ?ㅻ깄???鍮?蹂寃?媛먯?
  return snapshotTab(tab) !== tab._snapshot;
}

// dirty ?곹깭 媛깆떊 ????諛?由щ젋??
function markDirty() {
  var tab = tabs.find(function(t){return t.id === activeTabId});
  if (!tab) return;
  saveActiveTabState();
  var wasDirty = tab.dirty;
  tab.dirty = isTabDirty(tab);
  if (tab.dirty !== wasDirty) renderTabBar();
}

  function createTab(data) {
    const id = 'tab_' + (++tabIdCounter);
    const incomingName = data?.name;
    const autoName = data?.autoName === true
      || (!incomingName && !data?.requestId)
      || (data?.autoName !== false && !data?.requestId && isKnownDefaultTabName(incomingName || ''));
    const tab = applyRequestSettings({
      id,
    requestId: data?.requestId || null,  // 而щ젆???덉뒪?좊━ ?붿껌 ID (以묐났 ??諛⑹?)
    name: autoName ? tr('webview.stage.newRequest') : (incomingName || tr('webview.stage.newRequest')),
    autoName: autoName,
    method: data?.method || 'GET',
    url: data?.url || '',
    headers: data?.headers || [],
    params: data?.params || [],
    body: data?.body || '',
    bodyType: normalizeBodyType(data?.bodyType),
    formData: data?.formData || [],
    binaryFilePath: data?.binaryFilePath || '',
    auth: data?.auth || { type: 'none' },
      scripts: data?.scripts || { preRequest: '', test: '' },
      jsonFormatStyle: data?.jsonFormatStyle || 'pretty',
      xmlFormatStyle: data?.xmlFormatStyle || 'inline',
      formatIndent: data?.formatIndent || '2',
      responseSearchQuery: typeof data?.responseSearchQuery === 'string' ? data.responseSearchQuery : '',
      responseSearchIndex: typeof data?.responseSearchIndex === 'number' ? data.responseSearchIndex : 0,
      responseSearchCaseSensitive: data?.responseSearchCaseSensitive === true,
      responseSearchRegex: data?.responseSearchRegex === true,
      pinned: data?.pinned || false,
      dirty: false,
    _snapshot: null,  // 而щ젆?섏뿉??遺덈윭????쓽 ?먮낯 ?ㅻ깄??
    response: null,
    resolvedUrl: '',
    resolvedHeaders: [],
    scriptResults: null,
    error: null,
    loading: false,
    progressVisible: false,
    slideIn: false,
    lastEvent: data?.lastEvent || 'idle',
    responseTab: data?.responseTab || 'resBody',
    sendTime: 0,
  }, data);
  // 而щ젆???덉뒪?좊━?먯꽌 遺덈윭????씠硫??ㅻ깄?????
  if (data?.requestId) {
    tab._snapshot = snapshotTab(tab);
  }
  tabs.push(tab);
  switchTab(id);
  if (data) debouncePersist();
  return id;
}

function clearTabRequestState(tab) {
  if (!tab) return;
  tab.loading = false;
  tab.progressVisible = false;
  if (tab._progressTimer) { clearTimeout(tab._progressTimer); tab._progressTimer = null; }
  if (tab._elapsedTimer) { clearInterval(tab._elapsedTimer); tab._elapsedTimer = null; }
}

function doCloseTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;
  const tab = tabs[idx];
  if (tab?.loading) {
    clearTabRequestState(tab);
    vscode.postMessage({ type: 'cancelRequest', tabId: id });
  }
  tabs.splice(idx, 1);
  if (activeTabId === id) {
    activeTabId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)].id : null;
  }
  renderTabBar();
  renderContent();
  debouncePersist();
}

function closeTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  if (tab.pinned) return;
  // dirty ?곹깭硫??꾩옱 ??媛??숆린?????ы솗??
  if (id === activeTabId) saveActiveTabState();
  tab.dirty = isTabDirty(tab);
  if (tab.dirty) {
    showDirtyConfirm(id);
    return;
  }
  doCloseTab(id);
}

// dirty ???リ린 ?뺤씤 ?ㅼ씠?쇰줈洹?
function showDirtyConfirm(tabId) {
  // 湲곗〈 ?ㅼ씠?쇰줈洹??쒓굅
  var old = document.getElementById('dirtyConfirmOverlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'dirtyConfirmOverlay';
  overlay.className = 'dirty-confirm-overlay';
  overlay.innerHTML =
    '<div class="dirty-confirm-dialog">' +
      '<div class="dirty-confirm-msg">' + escapeHtml(tr('webview.unsavedClosePrompt')) + '</div>' +
      '<div class="dirty-confirm-actions">' +
        '<button class="dirty-btn dirty-btn-save" data-action="save">' + escapeHtml(tr('webview.save')) + '</button>' +
        '<button class="dirty-btn dirty-btn-discard" data-action="discard">' + escapeHtml(tr('webview.discard')) + '</button>' +
        '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    overlay.remove();
    if (action === 'save') {
      // ??????リ린: saveRequest ?꾩넚 ??寃곌낵?먯꽌 ???リ린
      var tab = tabs.find(function(t){return t.id === tabId});
      if (tab && tab.url) {
        if (tabId === activeTabId) saveActiveTabState();
        _pendingCloseAfterSave = tabId;
        vscode.postMessage(buildSaveRequestMessage(tab, tab.requestId || undefined));
      } else {
        doCloseTab(tabId);
      }
    } else if (action === 'discard') {
      doCloseTab(tabId);
    }
    // cancel: ?꾨Т寃껊룄 ????
  });
}

// ?щ윭 ???쇨큵 ?リ린 (dirty ??? ?섎굹???쒖감 ?뺤씤)
function closeTabs(ids) {
  if (!ids || ids.length === 0) return;
  var queue = ids.slice();
  function next() {
    while (queue.length > 0) {
      var id = queue.shift();
      var tab = tabs.find(function(t){return t.id === id});
      if (!tab || tab.pinned) continue;
      if (id === activeTabId) saveActiveTabState();
      tab.dirty = isTabDirty(tab);
      if (tab.dirty) {
        showBatchDirtyConfirm(id, queue);
        return;
      }
      doCloseTab(id);
    }
  }
  next();

  function showBatchDirtyConfirm(tabId, remaining) {
    var old = document.getElementById('dirtyConfirmOverlay');
    if (old) old.remove();
    var tabObj = tabs.find(function(t){return t.id === tabId});
    var tabLabel = tabObj ? (tabObj.name || tr('webview.stage.newRequest')) : '';
    var overlay = document.createElement('div');
    overlay.id = 'dirtyConfirmOverlay';
    overlay.className = 'dirty-confirm-overlay';
    overlay.innerHTML =
      '<div class="dirty-confirm-dialog">' +
        '<div class="dirty-confirm-msg">' + escapeHtml(tf('webview.unsavedCloseNamedPrompt', { name: tabLabel })) + '</div>' +
        '<div class="dirty-confirm-actions">' +
          '<button class="dirty-btn dirty-btn-discard" data-action="discard">' + escapeHtml(tr('webview.discard')) + '</button>' +
          '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      var action = e.target.dataset.action;
      if (!action) return;
      overlay.remove();
      if (action === 'discard') {
        doCloseTab(tabId);
        next();
      }
      // cancel: ?섎㉧吏??紐⑤몢 痍⑥냼
    });
  }
}

// === ?대┃ ripple ?댄럺??===
function addRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const size = Math.max(rect.width, rect.height) * 4;
  const circle = document.createElement('span');
  circle.className = 'ripple-circle';
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (x - size / 2) + 'px';
  circle.style.top = (y - size / 2) + 'px';
  btn.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}

// 踰꾪듉 ?띿뒪???꾩떆 蹂寃??쇰뱶諛?
function showBtnFeedback(btn, text, duration) {
  duration = duration || 1500;
  const origHtml = btn.innerHTML;
  btn.innerHTML = text;
  setTimeout(() => { btn.innerHTML = origHtml; }, duration);
}

// Send 鍮?以꾧린 ?④낵
function triggerSendStreak(btn) {
  btn.classList.add('streak-active');
  setTimeout(() => btn.classList.remove('streak-active'), 400);
}

// Send 踰꾪듉 ?대┃ ?댄럺????源붾걫???뚮┝ + 湲濡쒖슦
// renderContent()媛 吏곹썑??DOM??援먯껜?섎?濡?setTimeout(0)?쇰줈 ??踰꾪듉???곸슜
function triggerSendSlam(btn) {
  triggerSendStreak(btn);
  setTimeout(function() {
    var newBtn = mainContent.querySelector('.js-send');
    if (newBtn) {
      newBtn.classList.add('send-click');
      newBtn.classList.add('send-click-flash');
      setTimeout(function() { newBtn.classList.remove('send-click-flash'); }, 100);
      setTimeout(function() { newBtn.classList.remove('send-click'); }, 300);
    }
  }, 0);
}

// Stop 踰꾪듉 ?寃⑷컧 (slam + glow + flash + vignette ???⑥씪 keyframe?쇰줈 ?듯빀)
function triggerStopSlam(btn) {
  // slam ?뚮┝ + 湲濡쒖슦 (?섎굹??animation?쇰줈 ?듯빀)
  btn.classList.remove('stop-slam');
  void btn.offsetWidth;
  btn.classList.add('stop-slam');
  // 諛곌꼍??flash (160ms)
  btn.classList.add('stop-flash');
  setTimeout(function() { btn.classList.remove('stop-flash'); }, 160);
  // slam ?대옒???뺣━
  setTimeout(function() { btn.classList.remove('stop-slam'); }, 400);
  // vignette flash
  var vig = document.createElement('div');
  vig.className = 'stop-vignette-flash';
  document.body.appendChild(vig);
  setTimeout(function() { vig.remove(); }, 300);
}

// ?꾩뿭 ripple ?대깽???꾩엫 (紐⑤뱺 .ripple-btn ??? + flash/bounce ?④낵
// Send/Stop 踰꾪듉? ?꾩슜 slam ?몃뱾?ш? 泥섎━?섎?濡??ш린??ripple留?
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.ripple-btn');
  if (!btn) return;
  addRipple(btn, e);
  // Send/Stop 踰꾪듉? ?꾩슜 ?④낵 ?ъ슜
  if (btn.classList.contains('btn-send') || btn.classList.contains('btn-stop')) return;
  // 諛곌꼍??flash (0.1珥?
  btn.classList.add('btn-flash');
  setTimeout(function() { btn.classList.remove('btn-flash'); }, 100);
  // ?뚮┝ ??諛붿슫?????먮옒 ?쒗??
  btn.classList.remove('btn-bouncing');
  void btn.offsetWidth;
  btn.classList.add('btn-bouncing');
  btn.addEventListener('animationend', function handler() {
    btn.classList.remove('btn-bouncing');
    btn.removeEventListener('animationend', handler);
  });
});

function handlePrimaryAction() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  if (tab.loading) {
    vscode.postMessage({ type: 'cancelRequest', tabId: tab.id });
    return;
  }
  sendActiveTab();
}

function switchTab(id) {
  if (activeTabId === id) return;
  saveActiveTabState();
  activeTabId = id;
  renderTabBar();
  renderContent();
  debouncePersist();
}

function saveActiveTabState() {
  if (!activeTabId) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  const mc = mainContent;
  const methodEl = mc.querySelector('.js-method');
  const urlEl = mc.querySelector('.js-url');
  if (!methodEl) return;
  tab.method = methodEl.value;
  tab.url = urlEl.value;
  tab.headers = collectKv(mc.querySelector('.js-header-rows'));
  tab.params = collectKv(mc.querySelector('.js-param-rows'));
  tab.body = mc.querySelector('.js-body')?.value || '';
  tab.bodyType = mc.querySelector('.js-body-type')?.value || 'none';
  tab.formData = collectFormData(mc.querySelector('.js-formdata-rows'));
  tab.binaryFilePath = mc.querySelector('.js-binary-path')?.value || '';
  tab.auth = collectAuth(mc);
  tab.scripts = collectScripts(mc);
  tab.timeout = normalizeNumberSetting(mc.querySelector('.js-timeout')?.value);
  tab.followRedirects = mc.querySelector('.js-follow-redirects')?.checked === true;
  tab.saveToHistory = mc.querySelector('.js-save-history')?.checked !== false;
  tab.tlsValidation = normalizeTlsValidation(mc.querySelector('.js-tls-validation')?.value);
  tab.maxResponseSizeKb = normalizeNumberSetting(mc.querySelector('.js-max-response-size')?.value);
  tab.retryCount = normalizeNumberSetting(mc.querySelector('.js-retry-count')?.value);
  tab.retryDelayMs = normalizeNumberSetting(mc.querySelector('.js-retry-delay')?.value);
  tab.stopAfterHeaders = mc.querySelector('.js-stop-after-headers')?.checked === true;
  tab.skipDefaultHeaders = mc.querySelector('.js-skip-default-headers')?.checked === true;
  tab.disableScripts = mc.querySelector('.js-disable-scripts')?.checked === true;
}

function switchRequestEditorTabInContent(mc, tabName) {
  if (!mc) return;
  var tabsEl = mc.querySelectorAll('.js-req-tabs .tab');
  tabsEl.forEach(function(x) { x.classList.toggle('active', x.dataset.tab === tabName); });
  var panels = { params: '.js-params-panel', headers: '.js-headers-panel', body: '.js-body-panel', auth: '.js-auth-panel', scripts: '.js-scripts-panel', settings: '.js-settings-panel' };
  Object.keys(panels).forEach(function(key) {
    mc.querySelector(panels[key])?.classList.toggle('hidden', key !== tabName);
  });
  if (tabName === 'headers') refreshDefaultHeadersBanner(mc);
}

function toggleBulkEditor(mc, target, open) {
  mc?.querySelectorAll('.js-bulk-editor').forEach(function(panel) {
    var match = panel.dataset.target === target;
    panel.classList.toggle('hidden', !(open && match));
    if (open && match) {
      panel.querySelector('.js-bulk-editor-input')?.focus();
    }
  });
}

function applyBulkEditor(mc, target) {
  var editor = mc?.querySelector('.js-bulk-editor[data-target="' + target + '"]');
  var rows = mc?.querySelector(target === 'headers' ? '.js-header-rows' : '.js-param-rows');
  var input = editor?.querySelector('.js-bulk-editor-input');
  if (!editor || !rows || !input) return;
  var parsed = parseBulkKeyValueText(input.value, target);
  if (!parsed.length) return;
  parsed.forEach(function(item) { addKvRow(rows, item.key, item.value); });
  rows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  input.value = '';
  toggleBulkEditor(mc, target, false);
  markDirty();
  refreshDefaultHeadersBanner(mc);
  refreshToplineStatusChips(mc);
  refreshRequestPreflight(mc);
}

function renderTabBar() {
  // 湲곗〈 ???붿냼 ?쒓굅
  tabBar.querySelectorAll('.req-tab').forEach(el => el.remove());

  // pinned ??쓣 ?쇱そ??怨좎젙
  const sorted = tabs.filter(t => t.pinned).concat(tabs.filter(t => !t.pinned));

  for (const tab of sorted) {
    const el = document.createElement('div');
    el.className = 'req-tab' + (tab.id === activeTabId ? ' active' : '') + (tab.pinned ? ' pinned' : '') + ' tab-' + tab.method;
    el.innerHTML =
      '<span class="pin-icon">\u{1F4CC}</span>' +
      '<span class="method-badge method-' + tab.method + '">' + tab.method + '</span>' +
      '<span class="tab-name">' + escapeHtml(truncate(tab.name, 25)) + '</span>' +
      (tab.dirty ? '<span class="dirty-dot" title="' + escapeAttr(tr('webview.unsavedChanges')) + '">\u25CF</span>' : '') +
      '<span class="close-tab" data-id="' + tab.id + '">&times;</span>';
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('close-tab')) {
        closeTab(e.target.dataset.id);
      } else {
        switchTab(tab.id);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(e.clientX, e.clientY, tab.id);
    });
    tabBar.insertBefore(el, addTabBtn);
  }
}

function showTabContextMenu(x, y, tabId) {
  closeTabContextMenu();
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const tabIdx = tabs.indexOf(tab);
  const othersClosable = tabs.filter(t => t.id !== tabId && !t.pinned);
  const rightClosable = tabs.filter((t, i) => i > tabIdx && !t.pinned);
  const allClosable = tabs.filter(t => !t.pinned);

  const items = [
    { label: tr('webview.close'), action: 'close', disabled: !!tab.pinned },
    { label: tr('webview.closeOthers'), action: 'closeOthers', disabled: othersClosable.length === 0 },
    { label: tr('webview.closeAll'), action: 'closeAll', disabled: allClosable.length === 0 },
    { label: tr('webview.closeRight'), action: 'closeRight', disabled: rightClosable.length === 0 },
    { sep: true },
    tab.pinned
      ? { label: tr('webview.unpinTab'), action: 'unpin' }
      : { label: tr('webview.pinTab'), action: 'pin' },
    { sep: true },
    { label: tr('webview.duplicateTab'), action: 'duplicate' },
  ];

  const menu = document.createElement('div');
  menu.className = 'tab-ctx-menu';
  menu.id = 'tabCtxMenu';
  items.forEach(function(it) {
    if (it.sep) {
      var sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      return;
    }
    var el = document.createElement('div');
    el.className = 'ctx-item' + (it.disabled ? ' disabled' : '');
    el.textContent = it.label;
    el.dataset.action = it.action;
    menu.appendChild(el);
  });

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.body.appendChild(menu);

  // 硫붾돱媛 酉고룷??諛뽰쑝濡??섍?硫?蹂댁젙
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

  menu.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    closeTabContextMenu();
    switch (action) {
      case 'close':
        closeTab(tabId);
        break;
      case 'closeOthers':
        closeTabs(othersClosable.map(function(t){return t.id}));
        break;
      case 'closeAll':
        closeTabs(allClosable.map(function(t){return t.id}));
        break;
      case 'closeRight':
        closeTabs(rightClosable.map(function(t){return t.id}));
        break;
      case 'pin':
        tab.pinned = true;
        renderTabBar();
        debouncePersist();
        break;
      case 'unpin':
        tab.pinned = false;
        renderTabBar();
        debouncePersist();
        break;
      case 'duplicate':
        saveActiveTabState();
        createTab({ name: tab.name, autoName: !!tab.autoName, method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout, followRedirects: tab.followRedirects, saveToHistory: tab.saveToHistory, tlsValidation: tab.tlsValidation, maxResponseSizeKb: tab.maxResponseSizeKb, retryCount: tab.retryCount, retryDelayMs: tab.retryDelayMs, stopAfterHeaders: tab.stopAfterHeaders, skipDefaultHeaders: tab.skipDefaultHeaders, disableScripts: tab.disableScripts, jsonFormatStyle: tab.jsonFormatStyle, xmlFormatStyle: tab.xmlFormatStyle, formatIndent: tab.formatIndent, responseSearchQuery: tab.responseSearchQuery || '', responseSearchIndex: typeof tab.responseSearchIndex === 'number' ? tab.responseSearchIndex : 0, responseSearchCaseSensitive: tab.responseSearchCaseSensitive === true, responseSearchRegex: tab.responseSearchRegex === true });
        break;
    }
  });
  setTimeout(function() { document.addEventListener('click', closeTabContextMenu, { once: true }); }, 0);
}

function closeTabContextMenu() {
  var m = document.getElementById('tabCtxMenu');
  if (m) m.remove();
}

function getRequestStageInfo(tab) {
  if (!tab) {
    return { tone: 'idle', label: tr('webview.stage.newRequest'), detail: tr('webview.stage.newRequest.detail') };
  }
  if (tab.loading) {
    return { tone: 'loading', label: tr('webview.stage.sending'), detail: tr('webview.stage.sending.detail') };
  }
  if (tab.lastEvent === 'canceled') {
    return {
      tone: 'canceled',
      label: tr('webview.stage.canceled'),
      detail: tab.response ? tr('webview.stage.canceled.withResponse') : tr('webview.stage.canceled.noResponse')
    };
  }
  if (tab.error) {
    return { tone: 'error', label: tr('webview.stage.failed'), detail: truncate(tab.error, 96) };
  }
  if (tab.response) {
    var status = tab.response.status || 0;
    if (status >= 500) {
      return { tone: 'error', label: tr('webview.stage.serverError'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + tab.response.time + ' ms' };
    }
    if (status >= 400) {
      return { tone: 'error', label: tr('webview.stage.clientError'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + tab.response.time + ' ms' };
    }
    if (status >= 300) {
      return { tone: 'redirect', label: tr('webview.stage.redirected'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + tab.response.time + ' ms' };
    }
    return { tone: 'success', label: tr('webview.stage.liveResponse'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + tab.response.time + ' ms' };
  }
  if (tab.url) {
    return { tone: 'ready', label: tr('webview.stage.ready'), detail: tr('webview.stage.ready.detail') };
  }
  return { tone: 'idle', label: tr('webview.stage.newRequest'), detail: tr('webview.stage.newRequest.detail') };
}

function renderEmptyState(kicker, title, copy, cards) {
  return '<div class="empty-state">' +
    '<div class="empty-state-kicker">' + escapeHtml(kicker) + '</div>' +
    '<div class="empty-state-title">' + escapeHtml(title) + '</div>' +
    '<div class="empty-state-copy">' + escapeHtml(copy) + '</div>' +
    '<div class="empty-state-grid">' +
      (cards || []).map(function(card) {
        return '<div class="empty-state-card">' +
          '<strong>' + escapeHtml(card.title || '') + '</strong>' +
          '<span>' + escapeHtml(card.copy || '') + '</span>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</div>';
}

function renderInlineEmptyState(kicker, title, copy) {
  return '<div class="empty-state inline">' +
    '<div class="empty-state-kicker">' + escapeHtml(kicker) + '</div>' +
    '<div class="empty-state-title" style="font-size:16px">' + escapeHtml(title) + '</div>' +
    '<div class="empty-state-copy" style="max-width:none">' + escapeHtml(copy) + '</div>' +
  '</div>';
}

function getEnabledDefaultHeaders() {
  return (workspaceDefaultHeaders || []).filter(function(header) {
    return header && header.enabled !== false && header.key;
  });
}

function getAppliedDefaultHeaders(tab) {
  if (!tab || tab.skipDefaultHeaders) return [];
  var requestHeaderKeys = new Set((tab.headers || [])
    .filter(function(header) { return header && header.enabled !== false && header.key; })
    .map(function(header) { return String(header.key).toLowerCase(); }));
  return getEnabledDefaultHeaders().filter(function(header) {
    return !requestHeaderKeys.has(String(header.key).toLowerCase());
  });
}

function getOverriddenDefaultHeaders(tab) {
  if (!tab || tab.skipDefaultHeaders) return [];
  var requestHeaderKeys = new Set((tab.headers || [])
    .filter(function(header) { return header && header.enabled !== false && header.key; })
    .map(function(header) { return String(header.key).toLowerCase(); }));
  return getEnabledDefaultHeaders().filter(function(header) {
    return requestHeaderKeys.has(String(header.key).toLowerCase());
  });
}

function renderDefaultHeaderKeyGroup(labelKey, headers, chipClass) {
  if (!headers.length) return '';
  return '<div class="default-headers-key-group">' +
    '<div class="default-headers-key-label">' + escapeHtml(tr(labelKey)) + '</div>' +
    '<div class="default-headers-key-list">' + headers
      .slice(0, 6)
      .map(function(header) {
        return '<span class="default-header-chip' + chipClass + '">' + escapeHtml(header.key) + '</span>';
      })
      .join('') +
      (headers.length > 6 ? '<span class="default-header-chip' + chipClass + '">+' + (headers.length - 6) + '</span>' : '') +
      '</div>' +
    '</div>';
}

function renderDefaultHeadersBanner(tab) {
  var title = tr('webview.defaultHeaders');
  var manageLabel = tr('webview.manage');
  if (tab?.skipDefaultHeaders) {
    return '<div class="default-headers-banner warning">' +
      '<div class="default-headers-banner-main">' +
        '<div class="default-headers-banner-title">' + escapeHtml(title) + '</div>' +
        '<div class="default-headers-banner-copy">' + escapeHtml(tr('webview.defaultHeadersSkippedState')) + '</div>' +
        '<div class="default-headers-banner-note">' + escapeHtml(tr('webview.defaultHeadersSkippedNote')) + '</div>' +
      '</div>' +
      '<button class="res-action-btn ripple-btn js-open-default-headers" type="button">' + escapeHtml(manageLabel) + '</button>' +
    '</div>';
  }

  var enabled = getEnabledDefaultHeaders();
  if (!enabled.length) {
    return '<div class="default-headers-banner">' +
      '<div class="default-headers-banner-main">' +
        '<div class="default-headers-banner-title">' + escapeHtml(title) + '</div>' +
        '<div class="default-headers-banner-copy">' + escapeHtml(tr('webview.defaultHeadersEmptyState')) + '</div>' +
        '<div class="default-headers-banner-note">' + escapeHtml(tr('webview.defaultHeadersAppliedNote')) + '</div>' +
      '</div>' +
      '<button class="res-action-btn ripple-btn js-open-default-headers" type="button">' + escapeHtml(manageLabel) + '</button>' +
    '</div>';
  }

  var applied = getAppliedDefaultHeaders(tab);
  var overridden = getOverriddenDefaultHeaders(tab);
  var headerGroups = renderDefaultHeaderKeyGroup('webview.defaultHeadersAppliedLabel', applied, '') +
    renderDefaultHeaderKeyGroup('webview.defaultHeadersOverriddenLabel', overridden, ' override');

  return '<div class="default-headers-banner active">' +
    '<div class="default-headers-banner-main">' +
      '<div class="default-headers-banner-title">' + escapeHtml(title) + '</div>' +
      '<div class="default-headers-banner-copy">' + escapeHtml(tfCount('webview.defaultHeadersApplied', applied.length)) + '</div>' +
      '<div class="default-headers-banner-note">' + escapeHtml(tr('webview.defaultHeadersAppliedNote')) + '</div>' +
      (overridden.length
        ? '<div class="default-headers-banner-note">' + escapeHtml(tfCount('webview.defaultHeadersOverridden', overridden.length)) + '</div>'
        : '') +
      headerGroups +
    '</div>' +
    '<button class="res-action-btn ripple-btn js-open-default-headers" type="button">' + escapeHtml(manageLabel) + '</button>' +
  '</div>';
}

function renderToplineStatusChips(tab) {
  var chips = [];

  if (currentEnvName) {
    chips.push(renderEnvironmentStatusChip(currentEnvName));
  } else {
    chips.push(renderStatusChip(tr('webview.noEnvironment'), 'muted', 'switch-environment'));
  }

  if (tab?.skipDefaultHeaders) {
    chips.push(renderStatusChip(tr('webview.skipDefaultHeadersStatus'), 'warning', 'switch-tab', 'settings'));
  } else {
    var appliedDefaultHeaders = getAppliedDefaultHeaders(tab);
    if (appliedDefaultHeaders.length > 0) {
      chips.push(renderStatusChip(tfCount('webview.defaultHeadersStatus', appliedDefaultHeaders.length), 'info', 'open-default-headers'));
    }
  }

  if (tab?.disableScripts) {
    chips.push(renderStatusChip(tr('webview.disableScriptsStatus'), 'warning', 'switch-tab', 'settings'));
  }

  if (tab?.saveToHistory === false) {
    chips.push(renderStatusChip(tr('webview.saveToHistoryOffStatus'), 'muted', 'switch-tab', 'settings'));
  }

  return chips.join('');
}

function refreshToplineStatusChips(mc) {
  var wrap = mc?.querySelector('.js-topline-status-chips');
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!wrap || !tab) return;
  var draftTab = buildDraftTabFromContent(mc);
  wrap.innerHTML = renderToplineStatusChips(draftTab);
}

function refreshRequestPreflight(mc) {
  var wrap = mc?.querySelector('.js-request-preflight-wrap');
  if (!wrap) return;
  var draftTab = buildDraftTabFromContent(mc);
  wrap.innerHTML = renderRequestPreflight(draftTab);
}

function refreshDefaultHeadersBanner(mc) {
  var wrap = mc?.querySelector('.js-default-headers-banner-wrap');
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!wrap || !tab) return;

  var draftHeaders = collectKv(mc.querySelector('.js-header-rows'));
  var skipDefaultHeadersInput = mc.querySelector('.js-skip-default-headers');
  var draftTab = Object.assign({}, tab, {
    headers: draftHeaders,
    skipDefaultHeaders: skipDefaultHeadersInput ? skipDefaultHeadersInput.checked === true : !!tab.skipDefaultHeaders
  });

  wrap.innerHTML = renderDefaultHeadersBanner(draftTab);
  refreshToplineStatusChips(mc);
}

function isPreviewSafeUrl(value) {
  return value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:');
}

function countPreviewExternalAssets(doc) {
  var count = 0;
  doc.querySelectorAll('[src],[href],[srcset],[poster],[action],[formaction]').forEach(function(el) {
    Array.from(el.attributes).forEach(function(attr) {
      var name = attr.name.toLowerCase();
      if (['src', 'href', 'srcset', 'poster', 'action', 'formaction'].indexOf(name) === -1) return;
      var value = String(attr.value || '').trim();
      if (!value || isPreviewSafeUrl(value)) return;
      count += 1;
    });
  });
  return count;
}

function sanitizePreviewDocument(doc) {
  doc.querySelectorAll('script, style, noscript, iframe, object, embed, link, source, audio, video, track, base, meta[http-equiv="refresh"]').forEach(function(node) {
    node.remove();
  });
  doc.querySelectorAll('*').forEach(function(el) {
    Array.from(el.attributes).forEach(function(attr) {
      var name = attr.name.toLowerCase();
      var value = String(attr.value || '').trim();
      if (name.startsWith('on') || name === 'style' || name === 'srcset') {
        el.removeAttribute(attr.name);
        return;
      }
      if (['src', 'href', 'poster', 'action', 'formaction'].indexOf(name) >= 0 && value && !isPreviewSafeUrl(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
}

function extractPreviewDescription(doc) {
  var meta = doc.querySelector('meta[name="description"], meta[property="og:description"]');
  if (meta && meta.getAttribute('content')) {
    return meta.getAttribute('content').trim();
  }
  var bodyText = collapseWhitespace((doc.body && doc.body.textContent) || '');
  return bodyText ? truncate(bodyText, 220) : '';
}

function buildPreviewPayload(rawHtml) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(rawHtml || '', 'text/html');
  var blockedAssets = countPreviewExternalAssets(doc);
  sanitizePreviewDocument(doc);

  var docLang = (doc.documentElement && doc.documentElement.getAttribute('lang')) || currentDisplayLanguage || 'en';
  var title = ((doc.querySelector('title') && doc.querySelector('title').textContent) || '').trim() || tr('webview.preview');
  var description = extractPreviewDescription(doc);
  var bodyHtml = (doc.body && doc.body.innerHTML ? doc.body.innerHTML.trim() : '');
  var bodyText = collapseWhitespace((doc.body && doc.body.textContent) || '');
  var hasStaticSnapshot = !!bodyHtml && bodyText.length >= 24;

  return {
    docLang: docLang,
    title: title,
    description: description,
    bodyHtml: bodyHtml,
    blockedAssets: blockedAssets,
    hasStaticSnapshot: hasStaticSnapshot,
  };
}

function hasMeaningfulStaticPreview(rawHtml) {
  return buildPreviewPayload(rawHtml).hasStaticSnapshot;
}

function hasHtmlPreview(tab) {
  if (!tab?.response) return false;
  var contentType = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (contentType.indexOf('html') < 0) return false;
  return hasMeaningfulStaticPreview(tab.response.body || '');
}

function buildPreviewDocument(rawHtml, resolvedUrl) {
  var payload = buildPreviewPayload(rawHtml);
  var docLang = payload.docLang;
  var title = payload.title;
  var description = payload.description;
  var bodyHtml = payload.bodyHtml;
  var hasStaticSnapshot = payload.hasStaticSnapshot;
  var blockedAssetsLabel = tf('webview.previewOfflineBlockedAssets', { count: String(payload.blockedAssets) });

  return '<div class="preview-shell" lang="' + escapeAttr(docLang) + '">' +
    '<div class="preview-kicker">' + escapeHtml(tr('webview.previewOfflineTitle')) + '</div>' +
    '<h1 class="preview-title">' + escapeHtml(title) + '</h1>' +
    '<p class="preview-copy">' + escapeHtml(tr('webview.previewOfflineCopy')) + '</p>' +
    '<div class="preview-grid">' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineSource')) + '</div>' +
        '<div class="preview-card-value">' + escapeHtml(resolvedUrl || '') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineDescription')) + '</div>' +
        '<div class="preview-card-value' + (description ? '' : ' muted') + '">' + escapeHtml(description || '-') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(blockedAssetsLabel) + '</div>' +
        '<div class="preview-card-value">' + escapeHtml(String(payload.blockedAssets)) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="preview-section">' +
      '<div class="preview-section-title">' + escapeHtml(tr('webview.previewOfflineStaticSnapshot')) + '</div>' +
      (hasStaticSnapshot
        ? '<div class="preview-snapshot">' + bodyHtml + '</div>'
        : '<div class="preview-empty">' + escapeHtml(tr('webview.previewOfflineNoStatic')) + '</div>') +
    '</div>' +
  '</div>';
}

function buildPreviewDocKey(tab) {
  if (!tab || !tab.response) return '';
  var body = tab.response.body || '';
  return [
    tab.response.status || 0,
    tab.response.size || 0,
    tab.resolvedUrl || tab.url || '',
    body.length,
    body.slice(0, 120)
  ].join('|');
}

function syncPreviewFrame(preview, tab) {
  if (!preview || !tab?.response) return;
  var key = buildPreviewDocKey(tab);
  if (preview.dataset.previewKey === key) return;
  preview.innerHTML = buildPreviewDocument(tab.response.body || '', tab.resolvedUrl || tab.url || '');
  preview.dataset.previewKey = key;
}

function renderContent() {
  closeActiveFormatMenu();
  releaseSplitDrag();
  if (!activeTabId || tabs.length === 0) {
    mainContent.innerHTML = renderEmptyState(
      tr('webview.empty.hero.kicker'),
      tr('webview.empty.hero.title'),
      tr('webview.empty.hero.copy'),
      [
        { title: tr('webview.empty.hero.card.create.title'), copy: tr('webview.empty.hero.card.create.copy') },
        { title: tr('webview.empty.hero.card.import.title'), copy: tr('webview.empty.hero.card.import.copy') },
        { title: tr('webview.empty.hero.card.compare.title'), copy: tr('webview.empty.hero.card.compare.copy') }
      ]
    );
    return;
  }
  // 由щ젋?????섎룞 議곗젅???붿껌 ?곸뿭 ?믪씠 蹂댁〈
  var prevReqArea = mainContent.querySelector('.req-area');
  var savedHeight = prevReqArea && prevReqArea.dataset.manualHeight ? prevReqArea.style.height : null;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  const stage = getRequestStageInfo(tab);
  const envLine =
    '<div class="request-topline">' +
      '<div class="request-stage stage-' + stage.tone + '"><span class="stage-dot"></span>' + escapeHtml(stage.label) + '</div>' +
      '<div class="request-stage-hint">' + escapeHtml(stage.detail) + '</div>' +
      '<div class="request-topline-right">' +
        '<button class="res-action-btn ripple-btn js-open-default-headers-top" type="button">' + escapeHtml(tr('webview.defaultHeaders')) + '</button>' +
        '<div class="request-status-chips js-topline-status-chips">' + renderToplineStatusChips(tab) + '</div>' +
      '</div>' +
    '</div>';
  const preflightHtml = '<div class="js-request-preflight-wrap">' + renderRequestPreflight(tab) + '</div>';

  let resHtml = '';
  if (tab.loading) {
    resHtml = '<div style="padding:6px"><span class="spinner"></span>' + escapeHtml(tr('webview.loading')) + '</div>' +
      '<div class="request-stage-hint" style="padding:0 6px 6px">' + escapeHtml(tr('webview.loading.hint')) + '</div>' +
      '<div class="skeleton-loader"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
  } else if (tab.error) {
    resHtml = '<div class="error-msg">' + escapeHtml(tab.error) + '</div>';
  } else if (tab.response) {
    const r = tab.response;
    const sc = Math.floor(r.status / 100);
    const ct = (r.headers?.['content-type'] || r.headers?.['Content-Type'] || '').toLowerCase();
    const isBinary = !!r.bodyBase64 && isBinaryContentType(ct);
    const displayBody = isBinary
      ? tr('webview.binaryResponse')
      : r.body;
    const lang = isBinary ? 'text' : detectLang(ct, displayBody);
    const searchState = getResponseSearchState(tab);
    const displayBodyText = isBinary
      ? displayBody
      : getDisplayResponseBody(tab, lang, displayBody);
    const rawBodyHtml = isBinary
      ? escapeHtml(displayBodyText)
      : renderResponseBody(displayBodyText, lang, searchState.query, searchState.index, searchState);
    // ?묐떟 ?ㅻ뜑瑜??뚯씠釉?HTML濡??앹꽦
    const headerEntries = Object.entries(r.headers);
    const headerCount = headerEntries.length;
    let headersTableHtml = '<table class="res-header-table">' +
      '<thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.key')) + '</th><th>' + escapeHtml(tr('webview.value')) + '</th></tr></thead><tbody>';
    for (const [k,v] of headerEntries) {
      headersTableHtml += '<tr><td class="res-header-key">' + escapeHtml(k) + '</td>' +
        '<td class="res-header-value" title="' + escapeAttr(String(v)) + '">' + escapeHtml(String(v)) + '</td></tr>';
    }
    headersTableHtml += '</tbody></table>';

    // Set-Cookie ?뚯떛?섏뿬 荑좏궎 ?뚯씠釉??앹꽦
    // rawSetCookies媛 ?덉쑝硫?媛쒕퀎 荑좏궎 諛곗뿴 ?ъ슜 (expires ?쇳몴 臾몄젣 ?놁쓬)
    // ?놁쑝硫??ㅻ뜑?먯꽌 異붿텧 ???뺢퇋?앹쑝濡?荑좏궎 寃쎄퀎 遺꾨━
    let allCookieStrs = [];
    if (r.rawSetCookies && r.rawSetCookies.length > 0) {
      allCookieStrs = r.rawSetCookies;
    } else {
      const cookieHeader = headerEntries
        .filter(([k]) => k.toLowerCase() === 'set-cookie')
        .map(([,v]) => String(v))
        .join(', ');
      if (cookieHeader) {
        // ?쇳몴 ?ㅼ뿉 "?뚰뙆踰?=" ?⑦꽩???ㅻ㈃ ??荑좏궎 ?쒖옉 (expires ?좎쭨 ?쇳몴? 援щ퀎)
        allCookieStrs = cookieHeader.split(/,\\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/);
      }
    }
    const cookieCount = allCookieStrs.length;
    let cookiesTableHtml = '';
    if (cookieCount > 0) {
      cookiesTableHtml = '<table class="res-header-table res-cookie-table">' +
        '<thead><tr><th>Name</th><th>Value</th><th>Domain</th><th>Path</th><th>Expires</th><th>HttpOnly</th><th>Secure</th></tr></thead><tbody>';
      for (const cs of allCookieStrs) {
        const parts = cs.split(';').map(function(s) { return s.trim(); });
        const nameVal = parts[0] || '';
        const eqIdx = nameVal.indexOf('=');
        const cName = eqIdx >= 0 ? nameVal.substring(0, eqIdx) : nameVal;
        const cValue = eqIdx >= 0 ? nameVal.substring(eqIdx + 1) : '';
        let domain = '', path = '', expires = '', httpOnly = false, secure = false;
        for (let i = 1; i < parts.length; i++) {
          const attr = parts[i];
          const attrLower = attr.toLowerCase();
          if (attrLower.startsWith('domain=')) domain = attr.substring(7);
          else if (attrLower.startsWith('path=')) path = attr.substring(5);
          else if (attrLower.startsWith('expires=')) expires = attr.substring(8);
          else if (attrLower.startsWith('max-age=')) { if (!expires) expires = 'max-age=' + attr.substring(8); }
          else if (attrLower === 'httponly') httpOnly = true;
          else if (attrLower === 'secure') secure = true;
        }
        cookiesTableHtml += '<tr>' +
          '<td class="res-header-key">' + escapeHtml(cName) + '</td>' +
          '<td class="res-header-value" title="' + escapeAttr(cValue) + '">' + escapeHtml(cValue) + '</td>' +
          '<td>' + escapeHtml(domain) + '</td>' +
          '<td>' + escapeHtml(path) + '</td>' +
          '<td>' + escapeHtml(expires) + '</td>' +
          '<td>' + (httpOnly ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
          '<td>' + (secure ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
        '</tr>';
      }
      cookiesTableHtml += '</tbody></table>';
    }
    const previewAvailable = lang === 'html' && hasHtmlPreview(tab);
    const activeResponseTab = tab.responseTab === 'resPreview' && !previewAvailable
      ? 'resBody'
      : tab.responseTab === 'resCookies' && cookieCount === 0
        ? 'resBody'
        : tab.responseTab || 'resBody';
    const showBody = activeResponseTab === 'resBody';
    const showCookies = activeResponseTab === 'resCookies';
    const showHeaders = activeResponseTab === 'resHeaders';
    const showTests = activeResponseTab === 'resTests';
    const showPreview = activeResponseTab === 'resPreview';
    const hasFormat = (lang === 'json' || lang === 'xml');
    const currentSnapshot = createResponseSnapshot(tab, tab.response, '');
    const currentSignature = currentSnapshot?.signature || '';
    const formatStyle = lang === 'xml'
      ? (tab.xmlFormatStyle || 'inline')
      : (tab.jsonFormatStyle || 'pretty');
    const formatIndent = tab.formatIndent || '2';
    const fmtMenuHtml = hasFormat
      ? '<div class="fmt-wrap">' +
          '<button class="tb-btn ripple-btn js-fmt-btn">' + escapeHtml(tr('webview.format')) + '</button>' +
          '<div class="fmt-menu js-fmt-menu">' +
            '<div class="fmt-menu-label">' + escapeHtml(tr('webview.style')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="pretty"><span class="check">' + (formatStyle === 'pretty' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.pretty')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="compact"><span class="check">' + (formatStyle === 'compact' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.compact')) + '</div>' +
            (lang === 'xml' ? '<div class="fmt-menu-item js-fmt-style" data-style="inline"><span class="check">' + (formatStyle === 'inline' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.inlineChildren')) + '</div>' : '') +
            '<div class="fmt-menu-sep"></div>' +
            '<div class="fmt-menu-label">' + escapeHtml(tr('webview.indent')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="2"><span class="check">' + (formatIndent === '2' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.twoSpaces')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="4"><span class="check">' + (formatIndent === '4' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.fourSpaces')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="tab"><span class="check">' + (formatIndent === 'tab' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.tabIndent')) + '</div>' +
          '</div>' +
        '</div>'
      : '';
    const searchToolbarHtml = !isBinary
      ? '<div class="response-search-wrap js-response-search-wrap">' +
          '<input class="response-search-input js-response-search" type="text" value="' + escapeAttr(searchState.query) + '" placeholder="' + escapeAttr(tr('webview.searchPlaceholder')) + '" />' +
          '<button class="tb-btn js-response-search-case' + (searchState.caseSensitive ? ' active' : '') + '" type="button" title="' + escapeAttr(tr('webview.searchCaseSensitive')) + '">Aa</button>' +
          '<button class="tb-btn js-response-search-regex' + (searchState.regex ? ' active' : '') + '" type="button" title="' + escapeAttr(tr('webview.searchRegex')) + '">.*</button>' +
          '<span class="response-search-count js-response-search-count"></span>' +
          '<button class="tb-btn js-response-search-prev" type="button" title="' + escapeAttr(tr('webview.searchPrev')) + '">&#8593;</button>' +
          '<button class="tb-btn js-response-search-next" type="button" title="' + escapeAttr(tr('webview.searchNext')) + '">&#8595;</button>' +
          '<button class="tb-btn js-response-search-clear" type="button" title="' + escapeAttr(tr('webview.searchClear')) + '">&times;</button>' +
        '</div>'
      : '';
    const toolbarHtml = !isBinary
      ? '<div class="res-body-toolbar js-res-body-toolbar' + (showBody ? '' : ' hidden') + '" data-lang="' + lang + '">' +
          (lang === 'json'
              ? '<div class="toggle-group">' +
                  '<button class="toggle-btn active" data-mode="tree">' + escapeHtml(tr('webview.tree')) + '</button>' +
                  '<button class="toggle-btn" data-mode="raw">' + escapeHtml(tr('webview.raw')) + '</button>' +
                '</div>' +
              '<button class="tb-btn js-expand-all" title="' + escapeAttr(tr('webview.expand')) + '">' + escapeHtml(tr('webview.expand')) + '</button>' +
              '<button class="tb-btn js-collapse-all" title="' + escapeAttr(tr('webview.collapse')) + '">' + escapeHtml(tr('webview.collapse')) + '</button>'
            : '') +
          fmtMenuHtml +
          searchToolbarHtml +
        '</div>'
      : '';
    // 移섑솚???ㅼ젣 URL ?쒖떆
    const resolvedUrlDisplay = tab.resolvedUrl
      ? '<div class="resolved-url js-resolved-url" title="' + escapeAttr(tr('webview.clickToCopy')) + '">' + escapeHtml(tab.resolvedUrl) + '</div>'
      : '';
    const responseToneClass = 'response-tone-' + sc + 'xx';
    const compareChipHtml = '<div class="compare-chip-row js-compare-chip-row">' + buildCompareChipMarkup(currentSignature) + '</div>';
    resHtml =
      '<div class="res-sticky-shell">' +
      '<div class="response-summary">' +
      '<div class="response-meta ' + responseToneClass + '">' +
        '<span class="status status-' + sc + 'xx">' + r.status + ' ' + escapeHtml(r.statusText) + '</span>' +
        '<span class="meta-stat">' + r.time + ' ms</span><span class="meta-stat">' + formatSize(r.size) + '</span>' +
        '<span style="flex:1"></span>' +
        (lang !== 'text' ? '<span class="meta-lang">' + lang + '</span>' : '') +
        '<button class="res-action-btn ripple-btn js-copy-response" title="' + escapeAttr(tr('webview.copyResponse')) + '"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3H4v10h8V5l-2-2zM9 4l2 2H9V4zM3 0h6l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V1a1 1 0 011-1z"/><path d="M1 3v11a1 1 0 001 1h8v-1H2V3H1z"/></svg> ' + escapeHtml(tr('webview.copy')) + '</button>' +
        '<button class="res-action-btn ripple-btn js-save-response" title="' + escapeAttr(tr('webview.saveResponse')) + '"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.353 1.146l1.5 1.5L15 2.793V14.5a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5h11.707l.146.146zM2 2v12h12V3.207L12.793 2H2zm4 0v4h4V2H6zm5 0v5H5V2h1v3h3V2h2zm-3 7a2 2 0 110 4 2 2 0 010-4z"/></svg> ' + escapeHtml(tr('webview.save')) + '</button>' +
        '<button class="pin-response-btn ripple-btn js-pin-response" title="' + escapeAttr(tr('webview.pinResponse')) + '">' + pinSvg + ' ' + escapeHtml(tr('webview.pin')) + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '') + '</button>' +
        ((lang === 'html' && (tab.resolvedUrl || tab.url))
          ? '<button class="res-action-btn ripple-btn js-open-response-url" title="' + escapeAttr(tr('webview.openUrl')) + '">' + escapeHtml(tr('webview.openUrl')) + '</button>'
          : '') +
        '<button class="res-action-btn ripple-btn js-compare-last" title="' + escapeAttr(tr('webview.compareLast')) + '"' + (!lastResponse ? ' disabled' : '') + '>' + escapeHtml(tr('webview.last')) + '</button>' +
        '<button class="res-action-btn ripple-btn js-compare-settings" title="' + escapeAttr(tr('webview.comparisonSettings')) + '">' + escapeHtml(tr('webview.mode')) + ': ' + compareModeShort(compareSettings.mode) + '</button>' +
        '<button class="compare-btn js-compare-responses' + (pinnedResponses.length >= 2 ? ' ready' : '') + '" title="' + escapeAttr(tr('webview.comparePinned')) + '"' + (pinnedResponses.length < 2 ? ' disabled' : '') + '>' + diffSvg + ' ' + escapeHtml(tr('webview.compare')) + ' ' + compareModeShort(compareSettings.mode) + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '') + '</button>' +
      '</div>' +
      compareChipHtml +
      '</div>' +
      resolvedUrlDisplay +
      '<div class="tabs js-res-tabs">' +
        '<div class="tab' + (showBody ? ' active' : '') + '" data-tab="resBody">' + escapeHtml(tr('webview.body')) + '</div>' +
        (cookieCount > 0 ? '<div class="tab' + (showCookies ? ' active' : '') + '" data-tab="resCookies">' + escapeHtml(tr('webview.cookies')) + ' <span class="tab-count">' + cookieCount + '</span></div>' : '<div class="tab' + (showCookies ? ' active' : '') + '" data-tab="resCookies">' + escapeHtml(tr('webview.cookies')) + '</div>') +
        '<div class="tab' + (showHeaders ? ' active' : '') + '" data-tab="resHeaders">' + escapeHtml(tr('webview.headers')) + ' <span class="tab-count">' + headerCount + '</span></div>' +
        ((tab.scriptResults?.tests?.length || 0) > 0 ? '<div class="tab' + (showTests ? ' active' : '') + '" data-tab="resTests">' + escapeHtml(tr('webview.tests')) + ' <span class="tab-count">' + tab.scriptResults.tests.length + '</span></div>' : '<div class="tab' + (showTests ? ' active' : '') + '" data-tab="resTests">' + escapeHtml(tr('webview.tests')) + '</div>') +
        (previewAvailable ? '<div class="tab' + (showPreview ? ' active' : '') + '" data-tab="resPreview">' + escapeHtml(tr('webview.preview')) + '</div>' : '') +
      '</div>' +
      toolbarHtml +
      '</div>' +
      (lang === 'json' ? '<div class="json-tree js-res-tree js-res-body' + (showBody ? '' : ' hidden') + '"></div>' : '') +
      '<div class="json-body js-res-raw js-res-body' + ((lang === 'json' || !showBody) ? ' hidden' : '') + '">' + rawBodyHtml + '</div>' +
      '<div class="res-headers-panel' + (showHeaders ? '' : ' hidden') + ' js-res-headers">' +
        (tab.resolvedHeaders && tab.resolvedHeaders.length
          ? '<div class="resolved-headers-section"><div class="resolved-headers-title">' + escapeHtml(tr('webview.requestHeadersResolved')) + '</div>' +
            '<table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.key')) + '</th><th>' + escapeHtml(tr('webview.value')) + '</th></tr></thead><tbody>' +
            tab.resolvedHeaders.map(function(h) {
              return '<tr><td class="res-header-key">' + escapeHtml(h.key) + '</td><td class="res-header-value" title="' + escapeAttr(h.value) + '">' + escapeHtml(h.value) + '</td></tr>';
            }).join('') +
            '</tbody></table></div><div class="resolved-headers-title" style="margin-top:8px">' + escapeHtml(tr('webview.responseHeaders')) + '</div>'
          : '') +
        headersTableHtml +
      '</div>' +
      '<div class="res-cookies-panel' + (showCookies ? '' : ' hidden') + ' js-res-cookies">' +
        (cookieCount > 0 ? cookiesTableHtml : renderInlineEmptyState(tr('webview.inline.response.noCookies.kicker'), tr('webview.inline.response.noCookies.title'), tr('webview.inline.response.noCookies.copy'))) +
      '</div>' +
      '<div class="res-headers-panel' + (showTests ? '' : ' hidden') + ' js-res-tests">' +
        ((tab.scriptResults?.tests?.length || 0) > 0
          ? '<table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.test')) + '</th><th>' + escapeHtml(tr('webview.result')) + '</th></tr></thead><tbody>' +
            tab.scriptResults.tests.map(function(test) {
              var status = test.passed ? tr('webview.testResult.pass') : tr('webview.testResult.fail');
              var detail = test.passed ? tr('webview.testResult.passed') : escapeHtml(test.error || tr('webview.testResult.failed'));
              return '<tr><td class="res-header-key">' + escapeHtml(test.name) + '</td><td class="res-header-value" title="' + escapeAttr(detail) + '">' + status + ' - ' + detail + '</td></tr>';
            }).join('') +
            '</tbody></table>' +
            ((tab.scriptResults.logs || []).length > 0
              ? '<div class="resolved-headers-title" style="margin-top:8px">' + escapeHtml(tr('webview.scriptLogs')) + '</div><table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.level')) + '</th><th>' + escapeHtml(tr('webview.message')) + '</th></tr></thead><tbody>' +
                tab.scriptResults.logs.map(function(log) {
                  return '<tr><td class="res-header-key">' + escapeHtml(log.level.toUpperCase()) + '</td><td class="res-header-value" title="' + escapeAttr(log.message) + '">' + escapeHtml(log.message) + '</td></tr>';
                }).join('') +
                '</tbody></table>'
              : '')
          : renderInlineEmptyState(tr('webview.inline.tests.none.kicker'), tr('webview.inline.tests.none.title'), tr('webview.inline.tests.none.copy'))) +
      '</div>' +
      (previewAvailable ? '<div class="res-preview' + (showPreview ? '' : ' hidden') + ' js-res-preview"></div>' : '');
  } else {
    resHtml = tab.url
      ? renderEmptyState(
          tr('webview.empty.response.kicker'),
          tr('webview.empty.response.title'),
          tr('webview.empty.response.copy'),
          [
            { title: tr('webview.empty.response.card.send.title'), copy: tr('webview.empty.response.card.send.copy') },
            { title: tr('webview.empty.response.card.settings.title'), copy: tr('webview.empty.response.card.settings.copy') },
            { title: tr('webview.empty.response.card.compare.title'), copy: tr('webview.empty.response.card.compare.copy') }
          ]
        )
      : renderEmptyState(
          tr('webview.empty.request.kicker'),
          tr('webview.empty.request.title'),
          tr('webview.empty.request.copy'),
          [
            { title: tr('webview.empty.request.card.variables.title'), copy: tr('webview.empty.request.card.variables.copy') },
            { title: tr('webview.empty.request.card.bodies.title'), copy: tr('webview.empty.request.card.bodies.copy') },
            { title: tr('webview.empty.request.card.scripts.title'), copy: tr('webview.empty.request.card.scripts.copy') }
          ]
        );
  }

  mainContent.innerHTML = envLine +
    '<div class="url-bar">' +
      '<select class="js-method">' +
        ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m =>
          '<option' + (m === tab.method ? ' selected' : '') + '>' + m + '</option>'
        ).join('') +
      '</select>' +
      '<div class="url-input-wrap">' +
        '<input class="js-url" type="text" placeholder="' + escapeAttr(tr('webview.urlPlaceholder')) + '" spellcheck="false" value="' + escapeAttr(tab.url) + '"/>' +
        '<div class="var-overlay js-var-overlay hidden"></div>' +
      '</div>' +
      (tab.loading
        ? '<button class="btn-stop js-send"><span class="stop-icon"></span> ' + escapeHtml(tr('webview.stop')) + '</button>'
        : '<button class="btn-send ripple-btn js-send"><span class="send-streak"></span><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.5l14 6.5-14 6.5V9l10-1-10-1V1.5z"/></svg> ' + escapeHtml(tr('webview.send')) + ' <span class="btn-keyhint">Enter</span></button>') +
      '<span class="url-bar-spacer"></span>' +
      '<button class="res-action-btn ripple-btn js-save"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.353 1.146l1.5 1.5L15 2.793V14.5a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5h11.707l.146.146zM2 2v12h12V3.207L12.793 2H2zm4 0v4h4V2H6zm5 0v5H5V2h1v3h3V2h2zm-3 7a2 2 0 110 4 2 2 0 010-4z"/></svg> ' + escapeHtml(tr('webview.save')) + '</button>' +
      (tab.requestId ? '<button class="res-action-btn ripple-btn js-save-as" title="' + escapeAttr(tr('webview.saveAs')) + '">' + escapeHtml(tr('webview.saveAs')) + '</button>' : '') +
      '<button class="res-action-btn ripple-btn js-copy-curl" title="' + escapeAttr(tr('webview.copyAsCurl')) + '"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2l4.5 4L1 10l1 1.5L7.5 6 2 0.5 1 2zm7 8h7v1.5H8V10z"/></svg> cURL</button>' +
      '<button class="res-action-btn ripple-btn js-generate-code" title="' + escapeAttr(tr('webview.generateCode')) + '">' + escapeHtml(tr('webview.code')) + '</button>' +
    '</div>' +
    preflightHtml +
    '<div class="split">' +
      '<div class="req-area">' +
        '<div class="tabs js-req-tabs">' +
          '<div class="tab active" data-tab="params">' + escapeHtml(tr('webview.params')) + '</div>' +
          '<div class="tab" data-tab="headers">' + escapeHtml(tr('webview.headers')) + '</div>' +
          '<div class="tab" data-tab="body">' + escapeHtml(tr('webview.body')) + '</div>' +
          '<div class="tab" data-tab="auth">' + escapeHtml(tr('webview.auth')) + '</div>' +
          '<div class="tab" data-tab="scripts">' + escapeHtml(tr('webview.scripts')) + '</div>' +
          '<div class="tab" data-tab="settings">' + escapeHtml(tr('webview.settings')) + '</div>' +
        '</div>' +
        '<div class="js-params-panel kv-section">' +
          '<div class="js-param-rows">' + kvRowsHtml(tab.params) + '</div>' +
          '<div class="kv-actions">' +
            '<button class="add-btn js-add-param">' + escapeHtml(tr('webview.addParam')) + '</button>' +
            '<button class="ghost-btn ripple-btn js-open-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.bulkPaste')) + '</button>' +
          '</div>' +
          '<div class="bulk-editor hidden js-bulk-editor" data-target="params">' +
            '<div class="bulk-editor-label">' + escapeHtml(tr('webview.bulkPasteParams')) + '</div>' +
            '<textarea class="bulk-editor-input js-bulk-editor-input" spellcheck="false" placeholder="' + escapeAttr(tr('webview.bulkPasteParamsPlaceholder')) + '"></textarea>' +
            '<div class="bulk-editor-actions">' +
              '<button class="ghost-btn ripple-btn js-apply-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.apply')) + '</button>' +
              '<button class="ghost-btn ripple-btn js-cancel-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.cancel')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-headers-panel kv-section hidden">' +
          '<div class="js-default-headers-banner-wrap">' + renderDefaultHeadersBanner(tab) + '</div>' +
          '<div class="js-header-rows">' + kvRowsHtml(tab.headers) + '</div>' +
          '<div class="kv-actions">' +
            '<button class="add-btn js-add-header">' + escapeHtml(tr('webview.addHeader')) + '</button>' +
            '<button class="ghost-btn ripple-btn js-open-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.bulkPaste')) + '</button>' +
          '</div>' +
          '<div class="bulk-editor hidden js-bulk-editor" data-target="headers">' +
            '<div class="bulk-editor-label">' + escapeHtml(tr('webview.bulkPasteHeaders')) + '</div>' +
            '<textarea class="bulk-editor-input js-bulk-editor-input" spellcheck="false" placeholder="' + escapeAttr(tr('webview.bulkPasteHeadersPlaceholder')) + '"></textarea>' +
            '<div class="bulk-editor-actions">' +
              '<button class="ghost-btn ripple-btn js-apply-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.apply')) + '</button>' +
              '<button class="ghost-btn ripple-btn js-cancel-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.cancel')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-body-panel body-section hidden">' +
          '<select class="js-body-type body-type-select">' +
            ['none','json','xml','form','formdata','binary','raw'].map(function(t) {
              var label = bodyTypeLabel(t);
              return '<option value="' + t + '"' + (t === tab.bodyType ? ' selected' : '') + '>' + label + '</option>';
            }).join('') +
          '</select>' +
          '<textarea class="js-body" placeholder="' + escapeAttr(tr('webview.bodyPlaceholder')) + '"' + (tab.bodyType === 'none' || tab.bodyType === 'formdata' || tab.bodyType === 'binary' ? ' style="display:none"' : '') + '>' + escapeHtml(tab.body) + '</textarea>' +
          '<div class="js-formdata-panel' + (tab.bodyType === 'formdata' ? '' : ' hidden') + '">' +
            '<div class="js-formdata-rows">' + formDataRowsHtml(tab.formData || []) + '</div>' +
            '<button class="add-btn js-add-formdata-text">' + escapeHtml(tr('webview.addField')) + '</button>' +
            '<button class="add-btn js-add-formdata-file">' + escapeHtml(tr('webview.addFile')) + '</button>' +
          '</div>' +
          '<div class="js-binary-panel' + (tab.bodyType === 'binary' ? '' : ' hidden') + '">' +
            '<div class="kv-row" style="margin-top:4px">' +
              '<input class="js-binary-path" type="text" placeholder="' + escapeAttr(tr('webview.filePath')) + '" value="' + escapeAttr(tab.binaryFilePath || '') + '"/>' +
              '<button class="btn btn-s js-browse-binary" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-auth-panel auth-section hidden">' +
          authHtml(tab.auth) +
        '</div>' +
        '<div class="js-scripts-panel body-section hidden">' +
          '<div class="script-editor-grid">' +
            '<div class="script-card">' +
              '<div class="script-card-label">' + escapeHtml(tr('webview.preRequestScript')) + '</div>' +
              '<div class="script-card-note">' + escapeHtml(tr('webview.preRequestNote')) + '</div>' +
              '<textarea class="js-script-prerequest" placeholder="' + escapeAttr(tr('webview.preRequestPlaceholder')) + '">' + escapeHtml(tab.scripts?.preRequest || '') + '</textarea>' +
            '</div>' +
            '<div class="script-card">' +
              '<div class="script-card-label">' + escapeHtml(tr('webview.testScript')) + '</div>' +
              '<div class="script-card-note">' + escapeHtml(tr('webview.testNote')) + '</div>' +
              '<textarea class="js-script-test" placeholder="' + escapeAttr(tr('webview.testPlaceholder')) + '">' + escapeHtml(tab.scripts?.test || '') + '</textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-settings-panel settings-section hidden">' +
          '<div class="settings-grid">' +
            '<div class="settings-card">' +
              '<div class="settings-group">' +
                '<div class="settings-group-title">' + escapeHtml(tr('webview.transport')) + '</div>' +
                '<div class="settings-group-note">' + escapeHtml(tr('webview.transportNote')) + '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.timeout')) + '</label>' +
                  '<input class="js-timeout settings-input" type="number" min="0" placeholder="0" title="' + escapeAttr(tr('webview.unlimited')) + '" value="' + (tab.timeout || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.unlimited')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.maxSize')) + '</label>' +
                  '<input class="js-max-response-size settings-input" type="number" min="0" placeholder="0" title="' + escapeAttr(tr('webview.unlimited')) + '" value="' + (tab.maxResponseSizeKb || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.unlimited')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.retryCount')) + '</label>' +
                  '<input class="js-retry-count settings-input" type="number" min="0" placeholder="0" value="' + (tab.retryCount || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.off')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.retryDelay')) + '</label>' +
                  '<input class="js-retry-delay settings-input" type="number" min="0" placeholder="0" value="' + (tab.retryDelayMs || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.retryDelayUnit')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row' + (tab.tlsValidation === 'insecure' ? ' risk-warning' : '') + '">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.tls')) + '</label>' +
                  '<select class="js-tls-validation settings-input settings-select">' +
                    '<option value="default"' + (tab.tlsValidation !== 'strict' && tab.tlsValidation !== 'insecure' ? ' selected' : '') + '>' + escapeHtml(tr('webview.default')) + '</option>' +
                    '<option value="strict"' + (tab.tlsValidation === 'strict' ? ' selected' : '') + '>' + escapeHtml(tr('webview.strict')) + '</option>' +
                    '<option value="insecure"' + (tab.tlsValidation === 'insecure' ? ' selected' : '') + '>' + escapeHtml(tr('webview.insecure')) + '</option>' +
                  '</select>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.perRequestOverride')) + '</span></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="settings-card">' +
              '<div class="settings-group">' +
                '<div class="settings-group-title">' + escapeHtml(tr('webview.behavior')) + '</div>' +
                '<div class="settings-group-note">' + escapeHtml(tr('webview.behaviorNote')) + '</div>' +
                '<div class="settings-toggle-grid">' +
                  '<label class="settings-toggle"><input class="js-follow-redirects" type="checkbox"' + (tab.followRedirects ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.followRedirects')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.followRedirects.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.stopAfterHeaders ? ' risk-muted' : '') + '"><input class="js-stop-after-headers" type="checkbox"' + (tab.stopAfterHeaders ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.stopAfterHeaders')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.stopAfterHeaders.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.saveToHistory === false ? ' risk-muted' : '' ) + '"><input class="js-save-history" type="checkbox"' + (tab.saveToHistory !== false ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.saveToHistory')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.saveToHistory.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.skipDefaultHeaders ? ' risk-warning' : '' ) + '"><input class="js-skip-default-headers" type="checkbox"' + (tab.skipDefaultHeaders ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.skipDefaultHeaders')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.skipDefaultHeaders.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.disableScripts ? ' risk-warning' : '' ) + '"><input class="js-disable-scripts" type="checkbox"' + (tab.disableScripts ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.disableScripts')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.disableScripts.note')) + '</span></span></label>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="bullet-progress js-bullet-progress' + (tab.loading ? ' active' : '') + '"><div class="bullet-glow"></div></div>' +
      '<div class="res-area' + (tab.response && tab.slideIn ? ' slide-in' : '') + '">' + resHtml + '</div>' +
    '</div>';

  // ?대깽??諛붿씤??
  bindContentEvents();

  var previewFrame = mainContent.querySelector('.js-res-preview');
  if (previewFrame) {
    syncPreviewFrame(previewFrame, tab);
  }

  // ?섎룞 議곗젅 ?믪씠 蹂듭썝
  if (savedHeight) {
    var newReqArea = mainContent.querySelector('.req-area');
    if (newReqArea) {
      newReqArea.style.height = savedHeight;
      newReqArea.style.flex = 'none';
      newReqArea.dataset.manualHeight = '1';
    }
  }
}

function bindContentEvents() {
  const mc = mainContent;

  // 硫붿꽌??蹂寃?????諛??낅뜲?댄듃
  mc.querySelector('.js-method')?.addEventListener('change', (e) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.method = e.target.value; markDirty(); renderTabBar(); refreshRequestPreflight(mc); }
  });

  // URL ?낅젰 ??誘몄튂??蹂??泥댄겕 + ?먮룞 ???
  var urlInputEl = mc.querySelector('.js-url');
  if (urlInputEl) {
    urlInputEl.addEventListener('input', function() {
      checkUnresolvedVars();
      markDirty();
      refreshRequestPreflight(mc);
      debouncePersist();
    });
    urlInputEl.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      handlePrimaryAction();
    });
    urlInputEl.addEventListener('scroll', function() {
      var ov = mc.querySelector('.js-var-overlay');
      if (ov) ov.scrollLeft = urlInputEl.scrollLeft;
    });
    // 珥덇린 泥댄겕
    setTimeout(checkUnresolvedVars, 50);
  }

  // Send / Stop ?대┃ ?寃⑷컧
  const sendBtn = mc.querySelector('.js-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (sendBtn.classList.contains('btn-send')) {
        triggerSendSlam(sendBtn);
      } else if (sendBtn.classList.contains('btn-stop')) {
        triggerStopSlam(sendBtn);
      }
      handlePrimaryAction();
    });
  }

  mc.querySelector('.js-open-default-headers-top')?.addEventListener('click', function() {
    vscode.postMessage({ type: 'openDefaultHeaders' });
  });
  mc.addEventListener('click', function(e) {
    if (!e.target.closest('.js-open-default-headers')) return;
    vscode.postMessage({ type: 'openDefaultHeaders' });
  });
  mc.addEventListener('click', function(e) {
    var actionEl = e.target.closest('.request-status-chip.clickable, .preflight-pill.clickable, .js-preflight-action');
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    var meta = actionEl.dataset.meta;
    if (action === 'open-default-headers') {
      vscode.postMessage({ type: 'openDefaultHeaders' });
      return;
    }
    if (action === 'switch-environment') {
      vscode.postMessage({ type: 'switchEnvironment' });
      return;
    }
    if (action === 'switch-tab' && meta) {
      switchRequestEditorTabInContent(mc, meta);
    }
  });

  // Save (?대? ??λ맂 ??씠硫???뼱?곌린, ????씠硫??꾩튂 ?좏깮 ?ㅼ씠?쇰줈洹?
  mc.querySelector('.js-save')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage(buildSaveRequestMessage(tab, tab.requestId || undefined));
  });

  // Save As (???대쫫/?꾩튂濡??????requestId ?놁씠 ?꾩넚?섏뿬 ????ぉ ?앹꽦)
  mc.querySelector('.js-save-as')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage(buildSaveRequestMessage(tab));
  });

  // Copy as cURL (+ "Copied!" ?쇰뱶諛?
  mc.querySelector('.js-copy-curl')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'copyAsCurl', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, skipDefaultHeaders: !!tab.skipDefaultHeaders });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });

  mc.querySelector('.js-generate-code')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'generateCode', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, skipDefaultHeaders: !!tab.skipDefaultHeaders });
    showBtnFeedback(this, tr('webview.opened'), 1000);
  });

  // Copy Response Body (+ "Copied!" ?쇰뱶諛?
  mc.querySelector('.js-copy-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    var opts = getFormatOptions(mc);
    var body = tab.response.body;
    if (opts) {
      if (opts.lang === 'json') body = formatJson(body, opts.style, opts.indent);
      else if (opts.lang === 'xml') body = formatXml(body, opts.style, opts.indent);
    }
    vscode.postMessage({ type: 'copyResponseBody', body: body });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });

  // 移섑솚??URL ?대┃ ???대┰蹂대뱶 蹂듭궗
  mc.querySelector('.js-resolved-url')?.addEventListener('click', (e) => {
    const el = e.currentTarget;
    const url = el.textContent;
    vscode.postMessage({ type: 'copyToClipboard', text: url });
    el.classList.add('copied');
    const orig = el.textContent;
    el.textContent = tr('webview.copied');
    setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1200);
  });

  // Save Response Body (?ㅼ씠?쇰줈洹??꾨즺 ?꾩뿉留?"Saved ?? ?쇰뱶諛?
  mc.querySelector('.js-save-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const ct = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '';
    pendingSaveResponseBtn = this;
    vscode.postMessage({ type: 'saveResponseBody', body: tab.response.body, bodyBase64: tab.response.bodyBase64 || '', contentType: ct });
  });

  mc.querySelector('.js-open-response-url')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    const url = tab?.resolvedUrl || tab?.url || '';
    if (!url) return;
    vscode.postMessage({ type: 'openResponseUrl', url: url });
    showBtnFeedback(this, tr('webview.opened'), 1000);
  });

  mc.querySelector('.js-pin-response')?.addEventListener('click', function() {
    var snapshot = getActiveResponseSnapshot();
    if (!snapshot) return;
    var existIdx = pinnedResponses.findIndex(function(p) { return p.signature === snapshot.signature; });
    if (existIdx !== -1) {
      pinnedResponses.splice(existIdx, 1);
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    } else {
      if (pinnedResponses.length >= 2) {
        pinnedResponses.shift();
      }
      pinnedResponses.push(snapshot);
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    }
    updatePinCompareButtons(mc);
  });

  mc.querySelector('.js-compare-responses')?.addEventListener('click', function() {
    if (pinnedResponses.length < 2) return;
    requestCompare(pinnedResponses[0], pinnedResponses[1]);
  });

  mc.querySelector('.js-compare-last')?.addEventListener('click', function() {
    compareCurrentWithLast();
  });

  mc.querySelector('.js-compare-settings')?.addEventListener('click', function() {
    showCompareSettings();
  });

  mc.querySelector('.res-area')?.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    document.querySelectorAll('.res-ctx-menu').forEach(m => m.remove());
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const activeSnapshot = getActiveResponseSnapshot();
    const pinnedOne = pinnedResponses[0] || null;
    const pinnedTwo = pinnedResponses[1] || null;

    const menu = document.createElement('div');
    menu.className = 'res-ctx-menu';
    menu.innerHTML =
      '<div class="ctx-item js-ctx-compare-last' + (!lastResponse ? ' disabled' : '') + '">' + escapeHtml(tr('webview.compareLast')) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pin1' + (!pinnedOne ? ' disabled' : '') + '">' + escapeHtml(pinnedOne ? tf('webview.compareWith', { label: truncate(pinnedOne.label, 32) }) : tf('webview.compareWith', { label: tf('webview.pinNumber', { count: 1 }) })) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pin2' + (!pinnedTwo ? ' disabled' : '') + '">' + escapeHtml(pinnedTwo ? tf('webview.compareWith', { label: truncate(pinnedTwo.label, 32) }) : tf('webview.compareWith', { label: tf('webview.pinNumber', { count: 2 }) })) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pins' + (pinnedResponses.length < 2 ? ' disabled' : '') + '">' + escapeHtml(tr('webview.comparePinned')) + '</div>' +
      '<div class="ctx-item js-ctx-settings">' + escapeHtml(tr('webview.comparisonSettings')) + '</div>' +
      '<div class="ctx-sep"></div>' +
      '<div class="ctx-item js-ctx-pin-current">' + pinSvg + ' ' + escapeHtml(tr('webview.pinCurrentResponse')) + '</div>' +
      '<div class="ctx-item js-ctx-clear-pins' + (pinnedResponses.length === 0 ? ' disabled' : '') + '">' + escapeHtml(tr('webview.clearAllPins')) + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + ')' : '') + '</div>';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    document.body.appendChild(menu);

    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

    menu.querySelector('.js-ctx-compare-last')?.addEventListener('click', function() {
      if (!activeSnapshot || !lastResponse) return;
      requestCompare(lastResponse, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pin1')?.addEventListener('click', function() {
      if (!activeSnapshot || !pinnedOne) return;
      requestCompare(pinnedOne, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pin2')?.addEventListener('click', function() {
      if (!activeSnapshot || !pinnedTwo) return;
      requestCompare(pinnedTwo, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pins')?.addEventListener('click', function() {
      if (pinnedResponses.length < 2) return;
      requestCompare(pinnedResponses[0], pinnedResponses[1]);
      menu.remove();
    });

    menu.querySelector('.js-ctx-settings')?.addEventListener('click', function() {
      showCompareSettings();
      menu.remove();
    });

    menu.querySelector('.js-ctx-pin-current')?.addEventListener('click', function() {
      var pinBtn = mc.querySelector('.js-pin-response');
      if (pinBtn) pinBtn.click();
      menu.remove();
    });

    menu.querySelector('.js-ctx-clear-pins')?.addEventListener('click', function() {
      if (pinnedResponses.length === 0) return;
      pinnedResponses.length = 0;
      updatePinCompareButtons(mc);
      menu.remove();
    });

    setTimeout(function() {
      document.addEventListener('click', function closeCtx() {
        menu.remove();
        document.removeEventListener('click', closeCtx);
      }, { once: true });
    }, 0);
  });

  updatePinCompareButtons(mc);

  // ?붿껌 ???꾪솚
  mc.querySelector('.js-req-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    switchRequestEditorTabInContent(mc, t.dataset.tab);
  });

  // ?묐떟 ???꾪솚 (Body / Headers / Preview)
  mc.querySelector('.js-res-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    const tab = tabs.find(tt => tt.id === activeTabId);
    if (tab) {
      tab.responseTab = t.dataset.tab;
      debouncePersist();
    }
    mc.querySelectorAll('.js-res-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const sel = t.dataset.tab;
    const isBody = sel === 'resBody';
    const isPreview = sel === 'resPreview';

    // 紐⑤뱺 ?묐떟 肄섑뀗痢??④?
      mc.querySelectorAll('.js-res-body').forEach(el => el.classList.add('hidden'));
      mc.querySelector('.js-res-headers')?.classList.add('hidden');
      mc.querySelector('.js-res-cookies')?.classList.add('hidden');
      mc.querySelector('.js-res-tests')?.classList.add('hidden');
      const preview = mc.querySelector('.js-res-preview');
      if (preview) preview.classList.add('hidden');
    const toolbar = mc.querySelector('.js-res-body-toolbar');
    if (toolbar) toolbar.classList.add('hidden');

    // ?좏깮????肄섑뀗痢좊쭔 ?쒖떆
    if (isBody) {
      if (toolbar) toolbar.classList.remove('hidden');
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) {
        // JSON: Tree/Raw ?좉? 紐⑤뱶 蹂듭썝
        const mode = toolbar?.querySelector('.toggle-btn.active')?.dataset.mode || 'tree';
        tree.classList.toggle('hidden', mode !== 'tree');
        if (raw) raw.classList.toggle('hidden', mode !== 'raw');
      } else {
        // XML, text ?? raw留??쒖떆
        if (raw) raw.classList.remove('hidden');
      }
      } else if (sel === 'resHeaders') {
        mc.querySelector('.js-res-headers')?.classList.remove('hidden');
      } else if (sel === 'resCookies') {
        mc.querySelector('.js-res-cookies')?.classList.remove('hidden');
      } else if (sel === 'resTests') {
        mc.querySelector('.js-res-tests')?.classList.remove('hidden');
    } else if (isPreview && preview) {
      preview.classList.remove('hidden');
      const tab = tabs.find(tt => tt.id === activeTabId);
      if (tab?.response?.body) {
        syncPreviewFrame(preview, tab);
      }
    }
    if (sel === 'resBody') {
      syncResponseSearch(mc);
    }
  });

  // Tree/Raw ?좉?
  mc.querySelector('.js-res-body-toolbar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (btn) {
      mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) tree.classList.toggle('hidden', btn.dataset.mode !== 'tree');
      if (raw) raw.classList.toggle('hidden', btn.dataset.mode !== 'raw');
      // Expand/Collapse 踰꾪듉? Tree 紐⑤뱶?먯꽌留??쒖꽦
      mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(b => b.style.display = btn.dataset.mode === 'tree' ? '' : 'none');
      syncResponseSearch(mc);
    }
  });

  mc.querySelector('.js-response-search')?.addEventListener('input', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchQuery = this.value || '';
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });
  mc.querySelector('.js-response-search')?.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    stepResponseSearch(mc, e.shiftKey ? -1 : 1);
  });
  mc.querySelector('.js-response-search-prev')?.addEventListener('click', function() {
    stepResponseSearch(mc, -1);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-next')?.addEventListener('click', function() {
    stepResponseSearch(mc, 1);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-clear')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchQuery = '';
    tab.responseSearchIndex = 0;
    var input = mc.querySelector('.js-response-search');
    if (input) input.value = '';
    syncResponseSearch(mc);
    input?.focus();
    debouncePersist();
  });
  mc.querySelector('.js-response-search-case')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchCaseSensitive = tab.responseSearchCaseSensitive !== true;
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-regex')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchRegex = tab.responseSearchRegex !== true;
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });

  // Expand All
  mc.querySelector('.js-expand-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.remove('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '-'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.add('hidden'));
  });

  // Collapse All
  mc.querySelector('.js-collapse-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.add('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '+'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.remove('hidden'));
  });

  // Format ?쒕∼?ㅼ슫
  const fmtBtn = mc.querySelector('.js-fmt-btn');
  const fmtMenu = mc.querySelector('.js-fmt-menu');
  if (fmtBtn && fmtMenu) {
    fmtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeFormatMenuState && activeFormatMenuState.menu === fmtMenu) {
        closeActiveFormatMenu();
        return;
      }
      closeActiveFormatMenu();
      fmtMenu.classList.add('open');
      activeFormatMenuState = { button: fmtBtn, menu: fmtMenu };
    });
    fmtMenu.addEventListener('click', (e) => { e.stopPropagation(); });

    // ?ㅽ????좏깮
    fmtMenu.querySelectorAll('.js-fmt-style').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-style .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
    // ?ㅼ뿬?곌린 ?좏깮
    fmtMenu.querySelectorAll('.js-fmt-indent').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-indent .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
  }

  // XML/JSON 珥덇린 ?щ㎎ ?곸슜 (?묐떟 ?섏떊 ??利됱떆 ?щ㎎??
  if (mc.querySelector('.js-res-body-toolbar')) {
    applyFormat(mc);
  }

  // JSON ?몃━ 珥덇린 ?뚮뜑留?
  const treeContainer = mc.querySelector('.js-res-tree');
  if (treeContainer && !treeContainer.hasChildNodes()) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.response?.body) {
      try {
        const parsed = JSON.parse(tab.response.body);
        treeContainer.innerHTML = buildJsonTree(parsed, '', true);
        bindTreeToggles(treeContainer);
      } catch {}
    }
  }

  // KV 추가
  bindKvRow(mc.querySelector('.js-param-rows'));
  bindKvRow(mc.querySelector('.js-header-rows'));

  mc.querySelector('.js-add-param')?.addEventListener('click', () => {
    var container = mc.querySelector('.js-param-rows');
    addKvRow(container);
    container?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    refreshRequestPreflight(mc);
    markDirty();
  });
  mc.querySelector('.js-add-header')?.addEventListener('click', () => {
    var container = mc.querySelector('.js-header-rows');
    addKvRow(container);
    container?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    markDirty();
    refreshDefaultHeadersBanner(mc);
    refreshRequestPreflight(mc);
  });

  mc.querySelectorAll('.js-open-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      toggleBulkEditor(mc, button.dataset.target, true);
    });
  });
  mc.querySelectorAll('.js-apply-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      applyBulkEditor(mc, button.dataset.target);
    });
  });
  mc.querySelectorAll('.js-cancel-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      toggleBulkEditor(mc, button.dataset.target, false);
    });
  });

  // Auth ???蹂寃?
  mc.querySelector('.js-auth-type')?.addEventListener('change', (e) => {
    const fields = mc.querySelector('.js-auth-fields');
    if (fields) fields.innerHTML = authFieldsHtml(e.target.value);
    markDirty();
    refreshRequestPreflight(mc);
  });
  // Auth 필드 입력 변경 감지
  mc.querySelector('.js-auth-fields')?.addEventListener('input', function() {
    markDirty();
    refreshRequestPreflight(mc);
  });
  mc.querySelector('.js-auth-fields')?.addEventListener('click', function(e) {
    if (!e.target.classList.contains('js-auth-reveal')) return;
    var wrap = e.target.closest('.auth-inline-control');
    var input = wrap?.querySelector('input');
    if (!input) return;
    var revealing = input.type === 'password';
    input.type = revealing ? 'text' : 'password';
    e.target.textContent = revealing ? tr('webview.hideShort') : tr('webview.revealShort');
  });

  // Body ???蹂寃???Content-Type ?먮룞 ?ㅼ젙
  mc.querySelector('.js-body-type')?.addEventListener('change', (e) => {
    const bodyType = e.target.value;
    const textarea = mc.querySelector('.js-body');
    const formDataPanel = mc.querySelector('.js-formdata-panel');
    const binaryPanel = mc.querySelector('.js-binary-panel');
    if (textarea) textarea.style.display = (bodyType === 'none' || bodyType === 'formdata' || bodyType === 'binary') ? 'none' : '';
    if (formDataPanel) formDataPanel.classList.toggle('hidden', bodyType !== 'formdata');
    if (binaryPanel) binaryPanel.classList.toggle('hidden', bodyType !== 'binary');
    syncAutoContentType(mc, bodyType);
    markDirty();
    refreshDefaultHeadersBanner(mc);
    refreshRequestPreflight(mc);
  });
  // 珥덇린 ?뚮뜑留???auto Content-Type ?숆린??
  var initBodyType = mc.querySelector('.js-body-type')?.value || 'none';
  if (initBodyType !== 'none') syncAutoContentType(mc, initBodyType);

  // Settings ?낅젰 蹂寃?媛먯?
  mc.querySelector('.js-settings-panel')?.addEventListener('input', markDirty);
  mc.querySelector('.js-settings-panel')?.addEventListener('change', function() {
    markDirty();
    refreshDefaultHeadersBanner(mc);
    refreshToplineStatusChips(mc);
    refreshRequestPreflight(mc);
    renderContent();
  });

  // === textarea ?먮룞 ?믪씠 議곗젅 ===
  var bodyTa = mc.querySelector('.js-body');
  if (bodyTa) {
    function autoGrow() {
      bodyTa.style.height = 'auto';
      var h = Math.max(100, Math.min(400, bodyTa.scrollHeight));
      bodyTa.style.height = h + 'px';
    }
    bodyTa.addEventListener('input', function() { autoGrow(); markDirty(); refreshRequestPreflight(mc); });
    bodyTa.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { setTimeout(autoGrow, 0); }
    });
    autoGrow();
  }

  mc.querySelector('.js-add-formdata-text')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'text');
    markDirty();
    refreshRequestPreflight(mc);
  });
  mc.querySelector('.js-add-formdata-file')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'file');
    markDirty();
    refreshRequestPreflight(mc);
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('rm')) {
      e.target.closest('.formdata-row')?.remove();
      markDirty();
      refreshRequestPreflight(mc);
      return;
    }
    if (e.target.classList.contains('js-formdata-browse')) {
      const row = e.target.closest('.formdata-row');
      vscode.postMessage({ type: 'pickFile', target: 'formdata', rowId: row?.dataset.rowId });
    }
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('js-formdata-type')) {
      syncFormDataRow(e.target.closest('.formdata-row'));
    }
    markDirty();
    refreshRequestPreflight(mc);
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('input', function() {
    markDirty();
    refreshRequestPreflight(mc);
  });
  mc.querySelectorAll('.formdata-row').forEach(syncFormDataRow);

  mc.querySelector('.js-browse-binary')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'pickFile', target: 'binary' });
  });
  mc.querySelector('.js-binary-path')?.addEventListener('input', function() {
    markDirty();
    refreshRequestPreflight(mc);
  });
  mc.querySelector('.js-script-prerequest')?.addEventListener('input', function() {
    markDirty();
    refreshRequestPreflight(mc);
  });
  mc.querySelector('.js-script-test')?.addEventListener('input', function() {
    markDirty();
    refreshRequestPreflight(mc);
  });

  // === ?쒕옒洹?援щ텇??===
  var divider = mc.querySelector('.divider');
  var splitEl = mc.querySelector('.split');
  var reqArea = mc.querySelector('.req-area');
  var resArea = mc.querySelector('.res-area');
  if (divider && splitEl && reqArea && resArea) {
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      splitDragState = {
        divider: divider,
        splitEl: splitEl,
        reqArea: reqArea,
        startY: e.clientY,
        startH: reqArea.offsetHeight
      };
      divider.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
  }

  refreshDefaultHeadersBanner(mc);
  refreshRequestPreflight(mc);
  syncResponseSearch(mc);
}

var BODY_TYPE_CT = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  formdata: 'multipart/form-data',
  binary: 'application/octet-stream',
  raw: 'text/plain',
};

function syncAutoContentType(mc, bodyType) {
  var headerRows = mc.querySelector('.js-header-rows');
  if (!headerRows) return;

  // 湲곗〈 auto Content-Type ???쒓굅
  headerRows.querySelectorAll('.kv-row[data-auto="content-type"]').forEach(function(r) { r.remove(); });

  var ct = BODY_TYPE_CT[bodyType];
  if (!ct) return; // none?대㈃ 異붽??섏? ?딆쓬

  // ?섎룞?쇰줈 Content-Type???대? ?덉쑝硫?異붽??섏? ?딆쓬
  var hasManual = false;
  headerRows.querySelectorAll('.kv-row:not([data-auto])').forEach(function(row) {
    var keyInput = row.querySelectorAll('input[type="text"]')[0];
    if (keyInput && keyInput.value.toLowerCase() === 'content-type') hasManual = true;
  });
  if (hasManual) return;

  // auto ??異붽?
  var row = document.createElement('div');
  row.className = 'kv-row';
  row.dataset.auto = 'content-type';
  row.innerHTML =
    '<input type="checkbox" checked disabled/>' +
    '<input type="text" value="Content-Type" readonly style="opacity:.6"/>' +
    '<input type="text" value="' + ct + '" readonly style="opacity:.6"/>' +
    '<span class="auto-badge">(auto)</span>';
  headerRows.insertBefore(row, headerRows.firstChild);
}

function collectAllKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function sendActiveTab() {
  saveActiveTabState();
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url) return;
  if (tab.loading) return;
  const mc = mainContent;

  // 1) Send 踰꾪듉 ?뚮┝ ?④낵 ??renderContent?먯꽌 Stop?쇰줈 ?꾪솚??

  // 2) URL ?낅젰? 鍮?以꾧린 sweep
  var urlWrap = mc.querySelector('.url-input-wrap');
  if (urlWrap) {
    urlWrap.classList.remove('sweep');
    void urlWrap.offsetWidth;
    urlWrap.classList.add('sweep');
    setTimeout(function() { urlWrap.classList.remove('sweep'); }, 350);
  }

  // auto Content-Type ?ы븿???꾩껜 ?ㅻ뜑 ?섏쭛
  const allHeaders = collectAllKv(mc.querySelector('.js-header-rows'));
  tab.loading = true;
  tab.lastEvent = 'sending';
  tab.error = null;
  tab.progressVisible = false;
  tab.slideIn = false;
  tab.sendTime = Date.now();
  renderContent();

  // 3) ?꾩넚 以??ㅼ삩 ?꾩뒪 (renderContent ???ㅼ떆 荑쇰━)
  var urlInput = mc.querySelector('.js-url');
  if (urlInput) {
    urlInput.classList.add('neon-active');
  }

  // 3珥???寃쎄낵?쒓컙 ?ㅼ떆媛??쒖떆 + ?꾨줈洹몃젅??諛?
  var elapsedTimer = null;
  var progressTimer = setTimeout(function() {
    if (!tab.loading) return;
    tab.progressVisible = true;
    // 寃쎄낵?쒓컙 ?쒖떆 ?쒖옉
    var timerEl = mc.querySelector('.js-elapsed-timer');
    if (!timerEl) {
      var loadingDiv = mc.querySelector('.res-area > div');
      if (loadingDiv) {
        var sp = document.createElement('span');
        sp.className = 'elapsed-timer js-elapsed-timer';
        loadingDiv.appendChild(sp);
      }
      timerEl = mc.querySelector('.js-elapsed-timer');
    }
    if (timerEl) {
      elapsedTimer = setInterval(function() {
        if (!tab.loading) { clearInterval(elapsedTimer); return; }
        var elapsed = ((Date.now() - tab.sendTime) / 1000).toFixed(1);
        timerEl.textContent = elapsed + 's';
      }, 100);
    }
  }, 3000);
  tab._progressTimer = progressTimer;
  tab._elapsedTimer = elapsedTimer;

  vscode.postMessage({
    type: 'sendRequest', tabId: tab.id,
    method: tab.method, url: tab.url, headers: allHeaders, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout, followRedirects: !!tab.followRedirects, saveToHistory: tab.saveToHistory !== false, tlsValidation: normalizeTlsValidation(tab.tlsValidation), maxResponseSizeKb: normalizeNumberSetting(tab.maxResponseSizeKb), retryCount: normalizeNumberSetting(tab.retryCount), retryDelayMs: normalizeNumberSetting(tab.retryDelayMs), stopAfterHeaders: !!tab.stopAfterHeaders, skipDefaultHeaders: !!tab.skipDefaultHeaders, disableScripts: !!tab.disableScripts,
  });
}

// === KV ??===
function kvValueControlHtml(key, value) {
  var sensitive = isSensitiveKeyName(key);
  return '<input type="' + (sensitive ? 'password' : 'text') + '" class="js-kv-value" placeholder="' + escapeAttr(tr('webview.value')) + '" value="' + escapeAttr(value) + '"/>' +
    '<button class="kv-reveal' + (sensitive ? '' : ' hidden') + '" type="button" title="' + escapeAttr(tr('webview.revealValue')) + '">' + escapeHtml(tr('webview.revealShort')) + '</button>';
}

function kvRowsHtml(items) {
  return (items || []).map(kv =>
    '<div class="kv-row">' +
      '<input type="checkbox"' + (kv.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(kv.key) + '"/>' +
      kvValueControlHtml(kv.key, kv.value) +
      '<span class="rm" title="' + escapeAttr(tr('webview.remove')) + '">&times;</span>' +
    '</div>'
  ).join('');
}

function addKvRow(container, key, value) {
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(key || '') + '"/>' +
    kvValueControlHtml(key || '', value || '') +
    '<span class="rm" title="' + escapeAttr(tr('webview.remove')) + '">&times;</span>';
  row.querySelector('.rm').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    if (row.dataset.auto) return; // auto ???쒖쇅
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function syncKvRowSensitivity(row) {
  if (!row) return;
  var keyInput = row.querySelector('input[type="text"]');
  var valueInput = row.querySelector('.js-kv-value');
  var revealBtn = row.querySelector('.kv-reveal');
  if (!keyInput || !valueInput || !revealBtn) return;
  var sensitive = isSensitiveKeyName(keyInput.value);
  valueInput.type = sensitive ? 'password' : 'text';
  revealBtn.classList.toggle('hidden', !sensitive);
  revealBtn.textContent = tr('webview.revealShort');
  revealBtn.title = tr('webview.revealValue');
}

function bindKvRow(container, options) {
  if (!container) return;
  if (container.dataset.kvBound === 'true') return;
  container.dataset.kvBound = 'true';
  var opts = options || {};
  var handleChange = function() {
    if (typeof opts.onChange === 'function') {
      opts.onChange();
      return;
    }
    refreshDefaultHeadersBanner(mainContent);
    refreshToplineStatusChips(mainContent);
    refreshRequestPreflight(mainContent);
    markDirty();
  };
  container.addEventListener('click', function(e) {
    if (e.target.classList.contains('rm')) {
      e.target.closest('.kv-row')?.remove();
      handleChange();
      return;
    }
    if (e.target.classList.contains('kv-reveal')) {
      var row = e.target.closest('.kv-row');
      var valueInput = row?.querySelector('.js-kv-value');
      if (!valueInput) return;
      var revealing = valueInput.type === 'password';
      valueInput.type = revealing ? 'text' : 'password';
      e.target.textContent = revealing ? tr('webview.hideShort') : tr('webview.revealShort');
      e.target.title = revealing ? tr('webview.hideValue') : tr('webview.revealValue');
    }
  });
  container.addEventListener('input', function(e) {
    var row = e.target.closest('.kv-row');
    if (!row) return;
    syncKvRowSensitivity(row);
    handleChange();
  });
  container.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
}

function parseBulkKeyValueText(text, target) {
  var source = String(text || '').trim();
  if (!source) return [];
  if (target === 'params') {
    var query = source;
    var question = query.indexOf('?');
    if (question >= 0) query = query.substring(question + 1);
    if (query.indexOf('&') >= 0 && query.indexOf('\\n') < 0) {
      return query.split('&').filter(Boolean).map(function(part) {
        var eqIndex = part.indexOf('=');
        if (eqIndex < 0) {
          return { key: decodeURIComponent(part), value: '', enabled: true };
        }
        return {
          key: decodeURIComponent(part.substring(0, eqIndex).replace(/\\+/g, ' ')),
          value: decodeURIComponent(part.substring(eqIndex + 1).replace(/\\+/g, ' ')),
          enabled: true
        };
      }).filter(function(item) { return item.key; });
    }
  }

  return source
    .split(/\\r?\\n/)
    .map(function(line) { return line.trim(); })
    .filter(Boolean)
    .map(function(line) {
      if (target === 'headers' && /^-H\s+/i.test(line)) {
        line = line.replace(/^-H\s+/i, '').replace(/^['"]|['"]$/g, '');
      }
      var sepIndex = line.indexOf(':');
      if (target === 'params' && (sepIndex < 0 || line.indexOf('=') >= 0 && line.indexOf('=') < sepIndex)) {
        sepIndex = line.indexOf('=');
      }
      if (sepIndex < 0 && /\\t/.test(line)) {
        var parts = line.split(/\\t+/);
        return { key: parts.shift() || '', value: parts.join('\t'), enabled: true };
      }
      if (sepIndex < 0) {
        return { key: line, value: '', enabled: true };
      }
      return {
        key: line.substring(0, sepIndex).trim(),
        value: line.substring(sepIndex + 1).trim(),
        enabled: true
      };
    })
    .filter(function(item) { return item.key; });
}

function formDataRowsHtml(items) {
  return (items || []).map(function(field) {
    var isFile = field.type === 'file';
    return '<div class="kv-row formdata-row" data-row-id="' + escapeAttr(field.id || ('fd_' + Math.random().toString(36).slice(2, 8))) + '">' +
      '<input type="checkbox"' + (field.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" class="js-formdata-key" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(field.key || '') + '"/>' +
      '<select class="js-formdata-type body-type-select" style="width:84px;margin-bottom:0">' +
        '<option value="text"' + (isFile ? '' : ' selected') + '>' + escapeHtml(tr('webview.text')) + '</option>' +
        '<option value="file"' + (isFile ? ' selected' : '') + '>' + escapeHtml(tr('webview.file')) + '</option>' +
      '</select>' +
      '<input type="text" class="js-formdata-value" placeholder="' + escapeAttr(isFile ? tr('webview.filePath') : tr('webview.value')) + '" value="' + escapeAttr(field.value || '') + '"/>' +
      '<button class="btn btn-s js-formdata-browse' + (isFile ? '' : ' hidden') + '" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
      '<span class="rm" title="' + escapeAttr(tr('webview.remove')) + '">&times;</span>' +
    '</div>';
  }).join('');
}

function addFormDataRow(container, type) {
  if (!container) return;
  var row = document.createElement('div');
  row.className = 'kv-row formdata-row';
  row.dataset.rowId = 'fd_' + Math.random().toString(36).slice(2, 10);
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" class="js-formdata-key" placeholder="' + escapeAttr(tr('webview.key')) + '"/>' +
    '<select class="js-formdata-type body-type-select" style="width:84px;margin-bottom:0">' +
      '<option value="text"' + (type === 'file' ? '' : ' selected') + '>' + escapeHtml(tr('webview.text')) + '</option>' +
      '<option value="file"' + (type === 'file' ? ' selected' : '') + '>' + escapeHtml(tr('webview.file')) + '</option>' +
    '</select>' +
    '<input type="text" class="js-formdata-value" placeholder="' + escapeAttr(type === 'file' ? tr('webview.filePath') : tr('webview.value')) + '"/>' +
    '<button class="btn btn-s js-formdata-browse' + (type === 'file' ? '' : ' hidden') + '" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
    '<span class="rm" title="' + escapeAttr(tr('webview.remove')) + '">&times;</span>';
  container.appendChild(row);
}

function syncFormDataRow(row) {
  if (!row) return;
  var type = row.querySelector('.js-formdata-type')?.value || 'text';
  var valueInput = row.querySelector('.js-formdata-value');
  var browseBtn = row.querySelector('.js-formdata-browse');
  if (valueInput) valueInput.placeholder = type === 'file' ? tr('webview.filePath') : tr('webview.value');
  if (browseBtn) browseBtn.classList.toggle('hidden', type !== 'file');
}

function collectFormData(container) {
  if (!container) return [];
  var arr = [];
  container.querySelectorAll('.formdata-row').forEach(function(row) {
    var cb = row.querySelector('input[type="checkbox"]');
    var key = row.querySelector('.js-formdata-key')?.value || '';
    var value = row.querySelector('.js-formdata-value')?.value || '';
    var type = row.querySelector('.js-formdata-type')?.value || 'text';
    if (!key && !value) return;
    arr.push({
      id: row.dataset.rowId || ('fd_' + Math.random().toString(36).slice(2, 8)),
      key: key,
      value: value,
      enabled: cb?.checked !== false,
      type: type === 'file' ? 'file' : 'text',
    });
  });
  return arr;
}

function collectScripts(mc) {
  return {
    preRequest: mc.querySelector('.js-script-prerequest')?.value || '',
    test: mc.querySelector('.js-script-test')?.value || '',
  };
}

// === Auth ===
function authHtml(auth) {
  const type = auth?.type || 'none';
  return '<select class="js-auth-type">' +
    ['none','basic','bearer','apikey'].map(t =>
      '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' +
      authTypeLabel(t) + '</option>'
    ).join('') +
    '</select><div class="auth-fields js-auth-fields">' + authFieldsHtml(type, auth) + '</div>';
}

function maskedAuthInputHtml(label, className, value, sensitive) {
  return '<div class="auth-row"><label>' + escapeHtml(label) + '</label>' +
    '<input type="' + (sensitive ? 'password' : 'text') + '" class="' + className + '" value="' + escapeAttr(value) + '"/>' +
    (sensitive
      ? '<button class="ghost-btn auth-reveal js-auth-reveal" type="button">' + escapeHtml(tr('webview.revealShort')) + '</button>'
      : '') +
  '</div>';
}

function authFieldsHtml(type, auth) {
  if (type === 'basic') {
    const u = auth?.basic?.username || '';
    const p = auth?.basic?.password || '';
    return maskedAuthInputHtml(tr('webview.username'), 'js-auth-user', u, false) +
           maskedAuthInputHtml(tr('webview.password'), 'js-auth-pass', p, true);
  }
  if (type === 'bearer') {
    const t = auth?.bearer?.token || '';
    return maskedAuthInputHtml(tr('webview.token'), 'js-auth-token', t, true);
  }
  if (type === 'apikey') {
    const k = auth?.apikey?.key || '';
    const v = auth?.apikey?.value || '';
    const a = auth?.apikey?.addTo || 'header';
    return maskedAuthInputHtml(tr('webview.key'), 'js-auth-apikey', k, false) +
           maskedAuthInputHtml(tr('webview.value'), 'js-auth-apival', v, true) +
           '<div class="auth-row"><label>' + escapeHtml(tr('webview.addTo')) + '</label><select class="js-auth-addto"><option value="header"' + (a==='header'?' selected':'') + '>' + escapeHtml(tr('webview.header')) + '</option><option value="query"' + (a==='query'?' selected':'') + '>' + escapeHtml(tr('webview.query')) + '</option></select></div>';
  }
  return '';
}

function collectAuth(mc) {
  const type = mc.querySelector('.js-auth-type')?.value || 'none';
  const auth = { type };
  if (type === 'basic') auth.basic = { username: mc.querySelector('.js-auth-user')?.value || '', password: mc.querySelector('.js-auth-pass')?.value || '' };
  if (type === 'bearer') auth.bearer = { token: mc.querySelector('.js-auth-token')?.value || '' };
  if (type === 'apikey') auth.apikey = { key: mc.querySelector('.js-auth-apikey')?.value || '', value: mc.querySelector('.js-auth-apival')?.value || '', addTo: mc.querySelector('.js-auth-addto')?.value || 'header' };
  return auth;
}

// === ?섍꼍蹂???몄쭛 ===
const envEditor = document.getElementById('envEditor');
const envEditorName = document.getElementById('envEditorName');
const envVarRows = document.getElementById('envVarRows');

document.getElementById('addEnvVarBtn').addEventListener('click', () => {
  addKvRow(envVarRows);
  envVarRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  envScheduleSave();
});
document.getElementById('envCloseBtn').addEventListener('click', () => envEditor.classList.add('hidden'));
bindKvRow(envVarRows, { onChange: envScheduleSave });

// ?섍꼍蹂???먮룞???(debounce 500ms)
const envDirtyDot = document.getElementById('envDirtyDot');
const envAutoSaved = document.getElementById('envAutoSaved');
let envSaveTimer = null;
let envAutoSavedTimer = null;

function envMarkDirty() {
  envDirtyDot.classList.add('show');
  envAutoSaved.classList.remove('show');
}

function envAutoSave() {
  if (!editingEnvId) return;
  const vars = collectKv(envVarRows);
  vscode.postMessage({ type: 'saveEnvironmentVars', envId: editingEnvId, variables: vars });
  // ????꾨즺 ?쇰뱶諛?
  envDirtyDot.classList.remove('show');
  envAutoSaved.classList.add('show');
  clearTimeout(envAutoSavedTimer);
  envAutoSavedTimer = setTimeout(() => envAutoSaved.classList.remove('show'), 2000);
}

function envScheduleSave() {
  envMarkDirty();
  clearTimeout(envSaveTimer);
  envSaveTimer = setTimeout(envAutoSave, 500);
}

// ?낅젰 蹂寃?媛먯? (input, checkbox, blur)
envVarRows.addEventListener('focusout', () => {
  if (!editingEnvId) return;
  clearTimeout(envSaveTimer);
  envAutoSave();
});

// === 湲곕낯 ?ㅻ뜑 ?몄쭛 ===
const defaultHeadersEditor = document.getElementById('defaultHeadersEditor');
const defaultHeaderRows = document.getElementById('defaultHeaderRows');

document.getElementById('addDefaultHeaderBtn').addEventListener('click', () => {
  addKvRow(defaultHeaderRows);
  defaultHeaderRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
});
document.getElementById('defaultHeadersCloseBtn').addEventListener('click', () => defaultHeadersEditor.classList.add('hidden'));
bindKvRow(defaultHeaderRows, { onChange: function() {} });
document.getElementById('defaultHeadersSaveBtn').addEventListener('click', () => {
  const headers = collectKv(defaultHeaderRows);
  workspaceDefaultHeaders = headers;
  refreshDefaultHeadersBanner(mainContent);
  refreshToplineStatusChips(mainContent);
  refreshRequestPreflight(mainContent);
  vscode.postMessage({ type: 'saveDefaultHeaders', headers: headers });
});

// === Extension ??Webview 硫붿떆吏 ===
window.addEventListener('message', (event) => {
  const msg = event.data;

  if (msg.type === 'updateLocalization') {
    applyLocalizationUpdate(msg);
    return;
  }

  if (msg.type === 'requestCanceled') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    tab.lastEvent = 'canceled';
    tab.error = null;
    if (activeTabId === msg.tabId) {
      var neonEl = mainContent.querySelector('.js-url.neon-active');
      if (neonEl) neonEl.classList.remove('neon-active');
      renderContent();
    } else {
      renderTabBar();
    }
  }

  if (msg.type === 'receiveResponse' || msg.type === 'responseError') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    tab.slideIn = true;

    // ?ㅼ삩 ?꾩뒪 ?쒓굅
    var neonEl = mainContent.querySelector('.js-url.neon-active');
    if (neonEl) neonEl.classList.remove('neon-active');

    if (msg.type === 'receiveResponse') {
      if (tab.response) {
        var prevEnv = currentEnvName ? '[' + currentEnvName + ']' : '';
        lastResponse = createResponseSnapshot(
          tab,
          tab.response,
          ((tab.name || (tab.method + ' ' + tab.url)) + ' ' + prevEnv + ' (previous)').trim()
        );
      }
      tab.response = msg.response;
      tab.lastEvent = 'success';
      tab.resolvedUrl = msg.resolvedUrl || '';
      tab.resolvedHeaders = msg.resolvedHeaders || [];
      tab.scriptResults = msg.scriptResults || { logs: [], tests: [] };
      var contentType = ((msg.response.headers?.['content-type'] || msg.response.headers?.['Content-Type'] || '') + '').toLowerCase();
      tab.responseTab = (contentType.indexOf('html') >= 0 && hasMeaningfulStaticPreview(msg.response.body || '')) ? 'resPreview' : 'resBody';
      tab.error = null;
    } else {
      tab.lastEvent = 'error';
      tab.error = msg.error;
      tab.response = null;
      tab.scriptResults = null;
      tab.responseTab = 'resBody';
    }
    if (activeTabId === msg.tabId) {
      // 珥앹븣 濡쒕뵫 諛? ?앷퉴吏 ?щ젮媛硫??щ씪吏???꾨즺 ?좊땲硫붿씠??
      var bp = mainContent.querySelector('.js-bullet-progress');
      if (bp) {
        var glow = bp.querySelector('.bullet-glow');
        if (glow) {
          var glowRect = glow.getBoundingClientRect();
          var bpRect = bp.getBoundingClientRect();
          bp.style.setProperty('--pos', (glowRect.left - bpRect.left) + 'px');
        }
        bp.classList.add('finishing');
      }
      // ?꾨즺 ?좊땲硫붿씠??0.25珥? ??renderContent
      setTimeout(function() {
        renderContent();
        setTimeout(function() {
          var sc = tab.response ? Math.floor(tab.response.status / 100) : 0;
          var isError = (sc >= 4 || !tab.response);

          // ?곹깭肄붾뱶 諛곗? ?④낵
          var badge = mainContent.querySelector('.status');
          if (badge) {
            badge.classList.add(isError ? 'flash-error' : 'flash-success');
          }

          // 4xx/5xx: ?붾㈃ ?꾩껜 鍮④컙??踰덉찉
          if (isError && tab.response) {
            var flash = document.createElement('div');
            flash.className = 'screen-flash';
            document.body.appendChild(flash);
            setTimeout(function() { flash.remove(); }, 150);
          }

          // 鍮좊Ⅸ ?묐떟 (100ms ?댄븯): PERFECT!
          if (tab.response && tab.response.time <= 100) {
            var meta = mainContent.querySelector('.response-meta');
            if (meta) {
              meta.style.position = 'relative';
              var perf = document.createElement('span');
              perf.className = 'perfect-badge';
              perf.textContent = 'PERFECT!';
              meta.appendChild(perf);
              setTimeout(function() { perf.remove(); }, 900);
            }
          }
        }, 30);
      }, 250);
    }
    // slide-in? ??踰덈쭔 ?곸슜
    setTimeout(function() { tab.slideIn = false; }, 300);
  }

  if (msg.type === 'newTab') {
    createTab();
  }

  if (msg.type === 'restoreTabState') {
    compareSettings = normalizeCompareSettings(msg.compareSettings);
    var restoreTabs = msg.tabs || [];
    var restoreIdx = msg.activeIndex || 0;
    if (restoreTabs.length > 0) {
      // 珥덇린 鍮????쒓굅 (??씠 1媛쒖씠怨?URL??鍮꾩뼱?덉쑝硫?
      if (tabs.length === 1 && !tabs[0].url) {
        tabs.splice(0, 1);
      }
      for (var ri = 0; ri < restoreTabs.length; ri++) {
        createTab(restoreTabs[ri]);
      }
      // ?쒖꽦 ??蹂듭썝
      if (restoreIdx >= 0 && restoreIdx < tabs.length) {
        switchTab(tabs[restoreIdx].id);
      }
    }
  }

  if (msg.type === 'activeVarKeys') {
    activeVarKeys = msg.varKeys || [];
    checkUnresolvedVars();
  }

  if (msg.type === 'loadRequest') {
    // 以묐났 ??諛⑹?: requestId媛 ?덉쑝硫?湲곗〈 ??뿉??寃??
    if (msg.requestId) {
      var existing = tabs.find(function(t) { return t.requestId === msg.requestId; });
      if (existing) {
        switchTab(existing.id);
        return;
      }
    }
    createTab({
      requestId: msg.requestId || null,
      name: msg.name || msg.method + ' ' + msg.url,
      method: msg.method,
      url: msg.url,
      headers: msg.headers || [],
      params: msg.params || [],
      body: msg.body || '',
      bodyType: msg.bodyType || 'none',
      formData: msg.formData || [],
      binaryFilePath: msg.binaryFilePath || '',
      auth: msg.auth || { type: 'none' },
      scripts: msg.scripts || { preRequest: '', test: '' },
      timeout: msg.timeout || 0,
      followRedirects: msg.followRedirects === true,
      saveToHistory: msg.saveToHistory !== false,
      tlsValidation: msg.tlsValidation || 'default',
      maxResponseSizeKb: msg.maxResponseSizeKb || 0,
      retryCount: msg.retryCount || 0,
      retryDelayMs: msg.retryDelayMs || 0,
      stopAfterHeaders: msg.stopAfterHeaders === true,
      skipDefaultHeaders: msg.skipDefaultHeaders === true,
      disableScripts: msg.disableScripts === true,
    });
  }

  if (msg.type === 'pickFileResult') {
    if (msg.target === 'binary') {
      var binaryInput = mainContent.querySelector('.js-binary-path');
      if (binaryInput && msg.filePath) {
        binaryInput.value = msg.filePath;
        markDirty();
      }
    } else if (msg.target === 'formdata' && msg.rowId) {
      var row = mainContent.querySelector('.formdata-row[data-row-id="' + msg.rowId + '"]');
      var input = row?.querySelector('.js-formdata-value');
      if (input && msg.filePath) {
        input.value = msg.filePath;
        markDirty();
      }
    }
  }

  if (msg.type === 'loadEnvironment') {
    editingEnvId = msg.envId;
    envEditorName.textContent = msg.envName;
    envVarRows.innerHTML = kvRowsHtml(msg.variables || []);
    envVarRows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    envEditor.classList.remove('hidden');
  }

  if (msg.type === 'loadDefaultHeaders') {
    workspaceDefaultHeaders = msg.headers || [];
    defaultHeaderRows.innerHTML = kvRowsHtml(workspaceDefaultHeaders);
    defaultHeaderRows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    refreshDefaultHeadersBanner(mainContent);
    refreshToplineStatusChips(mainContent);
    refreshRequestPreflight(mainContent);
    if (msg.reveal !== false) {
      defaultHeadersEditor.classList.remove('hidden');
    }
  }

  if (msg.type === 'updateActiveEnv') {
    currentEnvName = msg.envName;
    refreshToplineStatusChips(mainContent);
    refreshRequestPreflight(mainContent);
  }

  // === Save 寃곌낵 ?쇰뱶諛?===
  if (msg.type === 'saveRequestResult') {
    if (msg.saved) {
      // ??뿉 而щ젆???붿껌 ID? ?대쫫 ?곌껐 + dirty 珥덇린??
      var savedTab = _pendingCloseAfterSave
        ? tabs.find(function(t){return t.id === _pendingCloseAfterSave})
        : tabs.find(function(t){return t.id === activeTabId});
      if (savedTab) {
        if (msg.requestId) savedTab.requestId = msg.requestId;
        if (msg.name) savedTab.name = msg.name;
        savedTab.autoName = false;
        savedTab._snapshot = snapshotTab(savedTab);
        savedTab.dirty = false;
      }
      renderTabBar();
      if (pendingSaveBtn) {
        showBtnFeedback(pendingSaveBtn, tr('webview.saved'), 1200);
      }
      // dirty ?뺤씤 ?ㅼ씠?쇰줈洹몄뿉??"??? ?좏깮 ???リ린
      if (_pendingCloseAfterSave) {
        doCloseTab(_pendingCloseAfterSave);
        _pendingCloseAfterSave = null;
      }
      debouncePersist();
    } else {
      // ???痍⑥냼 ??pendingClose??痍⑥냼
      _pendingCloseAfterSave = null;
    }
    pendingSaveBtn = null;
  }
  if (msg.type === 'saveResponseBodyResult') {
    if (msg.saved && pendingSaveResponseBtn) {
      showBtnFeedback(pendingSaveResponseBtn, tr('webview.saved'), 1200);
    }
    pendingSaveResponseBtn = null;
  }

  // === 而щ젆???щ꼫 硫붿떆吏 ===
  if (msg.type === 'runCollectionStart') {
    showRunner(msg.name, msg.total);
  }
  if (msg.type === 'runCollectionStatus') {
    updateRunnerStatus(msg);
  }
  if (msg.type === 'runCollectionProgress') {
    updateRunnerRow(msg);
  }
  if (msg.type === 'runCollectionDone') {
    finishRunner(msg);
  }
});

// === 而щ젆???щ꼫 UI ===
var runnerOverlay = null;
var runnerResults = [];
var runnerStatusState = null;

function showRunner(name, total) {
  runnerResults = [];
  runnerStatusState = null;
  // ?ㅻ쾭?덉씠 ?앹꽦
  if (runnerOverlay) runnerOverlay.remove();
  runnerOverlay = document.createElement('div');
  runnerOverlay.className = 'runner-overlay';
  runnerOverlay.innerHTML =
    '<div class="runner-header">' +
      '<h3>' + escapeHtml(tf('webview.runTitle', { name: name })) + '</h3>' +
      '<button class="btn btn-s js-runner-stop" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runStop')) + '</button>' +
      '<button class="btn btn-s js-runner-close hidden" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runClose')) + '</button>' +
    '</div>' +
    '<div class="runner-progress">' +
      '<span class="js-runner-counter">0/' + total + '</span>' +
      '<div class="runner-bar"><div class="runner-bar-fill js-runner-bar" style="width:0%"></div></div>' +
      '<span class="spinner js-runner-spinner"></span>' +
    '</div>' +
    '<div class="runner-summary">' +
      '<span>' + escapeHtml(tr('webview.runTotal')) + ': <b>' + total + '</b></span>' +
      '<span class="pass">' + escapeHtml(tr('webview.runPassed')) + ': <b class="js-runner-pass">0</b></span>' +
      '<span class="fail">' + escapeHtml(tr('webview.runFailed')) + ': <b class="js-runner-fail">0</b></span>' +
      '<span class="js-runner-time"></span>' +
    '</div>' +
    '<div class="runner-live-status">' +
      '<div class="runner-live-title js-runner-live-title">' + escapeHtml(tr('webview.runStatus')) + '</div>' +
      '<div class="runner-live-copy js-runner-live-copy"></div>' +
    '</div>' +
    '<div class="runner-list js-runner-list"></div>';

  document.body.appendChild(runnerOverlay);

  // Stop 踰꾪듉
  runnerOverlay.querySelector('.js-runner-stop').addEventListener('click', function() {
    vscode.postMessage({ type: 'stopCollectionRun' });
    this.disabled = true;
    this.textContent = tr('webview.runStopping');
  });
  // Close 踰꾪듉
  runnerOverlay.querySelector('.js-runner-close').addEventListener('click', function() {
    if (runnerOverlay) { runnerOverlay.remove(); runnerOverlay = null; }
  });
  // ???대┃ ?대깽???꾩엫
  runnerOverlay.querySelector('.js-runner-list').addEventListener('click', function(e) {
    var row = e.target.closest('.runner-row');
    if (!row) return;
    var idx = parseInt(row.dataset.idx);
    var existing = row.nextElementSibling;
    if (existing && existing.classList.contains('runner-detail')) {
      existing.remove();
      return;
    }
    var r = runnerResults[idx];
    if (!r) return;
    var detail = document.createElement('div');
    detail.className = 'runner-detail';
    if (r.error) {
      detail.textContent = tr('webview.runError') + ': ' + r.error;
    } else if (r.response) {
      var body = r.response.body || '';
      var ct = (r.response.headers?.['content-type'] || r.response.headers?.['Content-Type'] || '').toLowerCase();
      if (r.response.bodyBase64 && isBinaryContentType(ct)) {
        body = tr('webview.binaryResponse');
      }
      if (body.length > 2000) body = body.substring(0, 2000) + '\\n... (truncated)';
      detail.textContent = tr('webview.runStatus') + ': ' + r.response.status + ' ' + r.response.statusText +
        '\\n' + tr('webview.size') + ': ' + formatSize(r.response.size) + '\\n\\n' + body;
    }
    row.after(detail);
  });
}

function updateRunnerStatus(msg) {
  if (!runnerOverlay) return;
  runnerStatusState = msg;
  var titleEl = runnerOverlay.querySelector('.js-runner-live-title');
  var copyEl = runnerOverlay.querySelector('.js-runner-live-copy');
  if (titleEl) {
    titleEl.textContent = msg.phase === 'retry' ? tr('webview.runRetrying') : tr('webview.runSending');
  }
  if (copyEl) {
    var attemptLabel = tf('webview.runAttempt', {
      current: msg.attempt || 1,
      total: msg.totalAttempts || 1,
    });
    var prefix = (msg.method || '') + ' ' + (msg.name || '');
    if (msg.phase === 'retry') {
      copyEl.textContent = prefix + ' · ' + attemptLabel + ' · ' + tf('webview.runRetryDelay', { count: msg.retryDelayMs || 0 });
    } else {
      copyEl.textContent = prefix + ' · ' + attemptLabel;
    }
  }
  runnerOverlay.querySelectorAll('.runner-row').forEach(function(row) {
    row.classList.toggle('active', Number(row.dataset.idx) === Number(msg.index));
  });
}

function updateRunnerRow(msg) {
  if (!runnerOverlay) return;
  var list = runnerOverlay.querySelector('.js-runner-list');
  var isPassed = !msg.error && msg.status < 400;
  var cls = isPassed ? 'pass' : 'fail';
  var icon = isPassed ? '\\u2705' : '\\u274C';
  var statusStr = msg.error ? 'ERR' : (msg.status + '');
  var row = document.createElement('div');
  row.className = 'runner-row ' + cls;
  row.dataset.idx = msg.index;
  row.innerHTML =
    '<span class="rr-idx">' + (msg.index + 1) + '</span>' +
    '<span class="method-badge method-' + msg.method + '">' + msg.method + '</span>' +
    '<span class="rr-name">' + escapeHtml(msg.name) + '</span>' +
    '<span class="rr-status">' + statusStr + '</span>' +
    '<span class="rr-time">' + (msg.time ? msg.time + 'ms' : '-') + '</span>' +
    '<span class="rr-icon">' + icon + '</span>';
  list.appendChild(row);

  // 寃곌낵 ???
  runnerResults[msg.index] = { error: msg.error, response: msg.response };

  // ?꾨줈洹몃젅???낅뜲?댄듃
  var pct = Math.round(((msg.index + 1) / msg.total) * 100);
  runnerOverlay.querySelector('.js-runner-counter').textContent = (msg.index + 1) + '/' + msg.total;
  runnerOverlay.querySelector('.js-runner-bar').style.width = pct + '%';
  runnerOverlay.querySelector('.js-runner-pass').textContent = msg.passed;
  runnerOverlay.querySelector('.js-runner-fail').textContent = msg.failed;
  runnerOverlay.querySelectorAll('.runner-row').forEach(function(existingRow) {
    existingRow.classList.toggle('active', Number(existingRow.dataset.idx) === Number(msg.index));
  });

  // ?먮룞 ?ㅽ겕濡?
  list.scrollTop = list.scrollHeight;
}

function finishRunner(msg) {
  if (!runnerOverlay) return;
  // ?ㅽ뵾???쒓굅
  var spinner = runnerOverlay.querySelector('.js-runner-spinner');
  if (spinner) spinner.remove();
  // Stop ??Close ?꾪솚
  var stopBtn = runnerOverlay.querySelector('.js-runner-stop');
  if (stopBtn) stopBtn.classList.add('hidden');
  var closeBtn = runnerOverlay.querySelector('.js-runner-close');
  if (closeBtn) closeBtn.classList.remove('hidden');
  var liveTitle = runnerOverlay.querySelector('.js-runner-live-title');
  var liveCopy = runnerOverlay.querySelector('.js-runner-live-copy');
  if (liveTitle) liveTitle.textContent = tr('webview.runStatus');
  if (liveCopy) liveCopy.textContent = msg.stopped ? tr('webview.runStopping') : '';
  // 理쒖쥌 ?쒓컙 ?쒖떆
  runnerOverlay.querySelector('.js-runner-time').textContent = tr('webview.runTime') + ': ' + msg.time + 'ms';
  // 諛?100% (?먮뒗 以묐떒 ???꾩옱 媛??좎?)
  if (!msg.stopped) {
    runnerOverlay.querySelector('.js-runner-bar').style.width = '100%';
  }
}

// === JSON ?몃━ 酉?===
function buildJsonTree(val, key, isLast) {
  const comma = isLast ? '' : '<span class="jt-comma">,</span>';
  const keyHtml = key !== '' ? '<span class="jt-key">' + escapeHtml('"' + key + '"') + '</span>: ' : '';

  if (val === null) {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-null">null</span>' + comma + '</div>';
  }
  if (typeof val === 'boolean') {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-bool">' + val + '</span>' + comma + '</div>';
  }
  if (typeof val === 'number') {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-num">' + val + '</span>' + comma + '</div>';
  }
  if (typeof val === 'string') {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-str">' + escapeHtml('"' + val + '"') + '</span>' + comma + '</div>';
  }

  const isArr = Array.isArray(val);
  const open = isArr ? '[' : '{';
  const close = isArr ? ']' : '}';
  const entries = isArr ? val.map((v, i) => [i, v]) : Object.entries(val);
  const count = entries.length;

  if (count === 0) {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml +
      '<span class="jt-brace">' + open + close + '</span>' + comma + '</div>';
  }

  let childrenHtml = '';
  entries.forEach(([k, v], idx) => {
    const childKey = isArr ? '' : String(k);
    childrenHtml += buildJsonTree(v, childKey, idx === count - 1);
  });

  const summary = isArr ? count + ' items' : count + ' keys';

  return '<div class="jt-row">' +
      '<span class="jt-toggle">-</span>' + keyHtml +
      '<span class="jt-brace">' + open + '</span>' +
      '<span class="jt-ellipsis hidden" title="' + summary + '"> ... ' + summary + ' </span>' +
    '</div>' +
    '<div class="jt-children jt-node">' + childrenHtml + '</div>' +
    '<div class="jt-row"><span class="jt-toggle"></span><span class="jt-brace">' + close + '</span>' + comma + '</div>';
}

function bindTreeToggles(container) {
  container.addEventListener('click', (e) => {
    const toggle = e.target.closest('.jt-toggle');
    const ellipsis = e.target.closest('.jt-ellipsis');
    if (!toggle && !ellipsis) return;

    // ellipsis ?대┃ ?????대떦 ?됱쓽 ?좉?怨??숈씪 ?숈옉
    const row = (toggle || ellipsis).closest('.jt-row');
    if (!row) return;
    const tgl = row.querySelector('.jt-toggle');
    if (!tgl || !tgl.textContent.trim()) return;

    const children = row.nextElementSibling;
    if (!children || !children.classList.contains('jt-children')) return;

    const collapsed = children.classList.toggle('collapsed');
    tgl.textContent = collapsed ? '+' : '-';
    const ell = row.querySelector('.jt-ellipsis');
    if (ell) ell.classList.toggle('hidden', !collapsed);
  });
}

// === Content-Type 媛먯? 諛?援щЦ ?섏씠?쇱씠??(highlight.js) ===
// hljs ?몄뼱 留ㅽ븨
var hljsLangMap = { json: 'json', html: 'html', xml: 'xml', js: 'javascript', css: 'css', text: 'plaintext' };

function detectLang(ct, body) {
  if (ct.includes('json') || ct.includes('javascript') && tryJsonParse(body)) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml') || ct.includes('svg')) return 'xml';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'js';
  if (ct.includes('css')) return 'css';
  if (tryJsonParse(body)) return 'json';
  if (body.trimStart().startsWith('<!') || body.trimStart().startsWith('<html')) return 'html';
  if (body.trimStart().startsWith('<?xml') || body.trimStart().startsWith('<rss')) return 'xml';
  return 'text';
}
function tryJsonParse(s) { try { JSON.parse(s); return true; } catch { return false; } }

function isBinaryContentType(ct) {
  var mime = (ct || '').split(';')[0].trim().toLowerCase();
  if (!mime) return false;
  if (mime.startsWith('text/')) return false;
  if (mime.endsWith('+json') || mime.endsWith('+xml')) return false;
  return [
    'application/json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'text/javascript',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/ld+json',
    'application/x-ndjson',
  ].indexOf(mime) < 0;
}

function highlightBody(body, lang) {
  // JSON? pretty-print ???섏씠?쇱씠??(_formatted_json?대㈃ ?대? ?щ㎎??
  if (lang === 'json') {
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch {}
  }
  var actualLang = lang === '_formatted_json' ? 'json' : lang;
  // hljs ?ъ슜 媛?ν븯硫??쇱씠釉뚮윭由??섏씠?쇱씠??
  if (typeof hljs !== 'undefined') {
    var hljsLang = hljsLangMap[actualLang] || 'plaintext';
    try {
      return hljs.highlight(body, { language: hljsLang }).value;
    } catch {}
  }
  // fallback: ?⑥닚 escape
  return escapeHtml(body);
}

function getResponseSearchState(tab) {
  return {
    query: typeof tab?.responseSearchQuery === 'string' ? tab.responseSearchQuery : '',
    index: typeof tab?.responseSearchIndex === 'number' ? tab.responseSearchIndex : 0,
    caseSensitive: tab?.responseSearchCaseSensitive === true,
    regex: tab?.responseSearchRegex === true,
  };
}

function getIndentString(indentKey) {
  return indentKey === 'tab' ? '\\t' : ' '.repeat(parseInt(indentKey || '2', 10) || 2);
}

function getDisplayResponseBody(tab, lang, fallbackBody) {
  if (!tab?.response) return fallbackBody || '';
  var body = typeof fallbackBody === 'string' ? fallbackBody : (tab.response.body || '');
  if (lang === 'json') {
    return formatJson(body, tab.jsonFormatStyle || 'pretty', getIndentString(tab.formatIndent || '2'));
  }
  if (lang === 'xml') {
    return formatXml(body, tab.xmlFormatStyle || 'inline', getIndentString(tab.formatIndent || '2'));
  }
  return body;
}

function findResponseSearchMatches(body, query, options) {
  if (!body || !query) return [];
  var source = String(body);
  var settings = options || {};

  if (settings.regex) {
    try {
      var flags = settings.caseSensitive ? 'g' : 'gi';
      var regex = new RegExp(query, flags);
      var regexMatches = [];
      var match;
      while ((match = regex.exec(source)) !== null) {
        var value = match[0] || '';
        regexMatches.push({ start: match.index, end: match.index + value.length });
        if (value.length === 0) {
          regex.lastIndex += 1;
        }
      }
      return regexMatches;
    } catch (_) {
      return [];
    }
  }

  var haystack = settings.caseSensitive ? source : source.toLowerCase();
  var needle = settings.caseSensitive ? String(query) : String(query).toLowerCase();
  if (!needle) return [];
  var matches = [];
  var start = 0;
  while (start <= haystack.length) {
    var idx = haystack.indexOf(needle, start);
    if (idx < 0) break;
    matches.push({ start: idx, end: idx + needle.length });
    start = idx + Math.max(needle.length, 1);
  }
  return matches;
}

function normalizeResponseSearchIndex(index, total) {
  if (total <= 0) return -1;
  if (typeof index !== 'number' || !isFinite(index)) return 0;
  var normalized = index % total;
  return normalized < 0 ? normalized + total : normalized;
}

function renderResponseBody(body, lang, searchQuery, searchIndex, searchState) {
  if (!searchQuery) {
    return highlightBody(body, lang === 'json' ? '_formatted_json' : lang);
  }

  var matches = findResponseSearchMatches(body, searchQuery, searchState || {});
  if (matches.length === 0) {
    return escapeHtml(body);
  }

  var activeIndex = normalizeResponseSearchIndex(searchIndex, matches.length);
  var parts = [];
  var cursor = 0;
  for (var i = 0; i < matches.length; i++) {
    var start = matches[i].start;
    var end = matches[i].end;
    parts.push(escapeHtml(body.slice(cursor, start)));
    parts.push('<mark class="response-search-hit' + (i === activeIndex ? ' active' : '') + '">' + escapeHtml(body.slice(start, end)) + '</mark>');
    cursor = end;
  }
  parts.push(escapeHtml(body.slice(cursor)));
  return parts.join('');
}

function setJsonBodyMode(mc, mode) {
  mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(function(button) {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  var tree = mc.querySelector('.js-res-tree');
  var raw = mc.querySelector('.js-res-raw');
  if (tree) tree.classList.toggle('hidden', mode !== 'tree');
  if (raw) raw.classList.toggle('hidden', mode !== 'raw');
  mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(function(button) {
    button.style.display = mode === 'tree' ? '' : 'none';
  });
}

function syncResponseSearch(mc) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  var rawEl = mc.querySelector('.js-res-raw');
  if (!tab?.response || !rawEl) return;

  var ct = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (!!tab.response.bodyBase64 && isBinaryContentType(ct)) return;

  var lang = detectLang(ct, tab.response.body || '');
  var searchState = getResponseSearchState(tab);
  var query = searchState.query || '';
  var displayBody = getDisplayResponseBody(tab, lang, tab.response.body || '');
  var matches = findResponseSearchMatches(displayBody, query, searchState);
  var activeIndex = normalizeResponseSearchIndex(searchState.index, matches.length);

  if (query && lang === 'json') {
    setJsonBodyMode(mc, 'raw');
  }

  rawEl.innerHTML = renderResponseBody(displayBody, lang, query, activeIndex, searchState);

  var countEl = mc.querySelector('.js-response-search-count');
  if (countEl) {
    countEl.textContent = query
      ? (matches.length > 0
          ? tf('webview.searchCount', { current: activeIndex + 1, total: matches.length })
          : tr('webview.searchNoMatches'))
      : '';
  }

  var prevBtn = mc.querySelector('.js-response-search-prev');
  var nextBtn = mc.querySelector('.js-response-search-next');
  var clearBtn = mc.querySelector('.js-response-search-clear');
  var caseBtn = mc.querySelector('.js-response-search-case');
  var regexBtn = mc.querySelector('.js-response-search-regex');
  if (prevBtn) prevBtn.disabled = matches.length === 0;
  if (nextBtn) nextBtn.disabled = matches.length === 0;
  if (clearBtn) clearBtn.disabled = !query;
  if (caseBtn) caseBtn.classList.toggle('active', !!searchState.caseSensitive);
  if (regexBtn) regexBtn.classList.toggle('active', !!searchState.regex);

  tab.responseSearchIndex = activeIndex < 0 ? 0 : activeIndex;

  if (query && matches.length > 0) {
    setTimeout(function() {
      rawEl.querySelector('.response-search-hit.active')?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, 0);
  }
}

function stepResponseSearch(mc, delta) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab?.response) return;
  var ct = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (!!tab.response.bodyBase64 && isBinaryContentType(ct)) return;
  var lang = detectLang(ct, tab.response.body || '');
  var displayBody = getDisplayResponseBody(tab, lang, tab.response.body || '');
  var matches = findResponseSearchMatches(displayBody, tab.responseSearchQuery || '', getResponseSearchState(tab));
  if (matches.length === 0) return;
  tab.responseSearchIndex = normalizeResponseSearchIndex((tab.responseSearchIndex || 0) + delta, matches.length);
  syncResponseSearch(mc);
}

// === Format 湲곕뒫 (JSON + XML) ===
function getFormatOptions(mc) {
  var toolbar = mc.querySelector('.js-res-body-toolbar');
  if (!toolbar) return null;
  var styleEl = toolbar.querySelector('.js-fmt-style .check');
  var style = 'pretty';
  toolbar.querySelectorAll('.js-fmt-style').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') style = el.dataset.style;
  });
  var indent = '2';
  toolbar.querySelectorAll('.js-fmt-indent').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') indent = el.dataset.indent;
  });
  var indentStr = indent === 'tab' ? '\\t' : ' '.repeat(parseInt(indent));
  return { style: style, indent: indentStr, indentKey: indent, lang: toolbar.dataset.lang };
}

function applyFormat(mc) {
  var opts = getFormatOptions(mc);
  if (!opts) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return;
  if (opts.lang === 'json') tab.jsonFormatStyle = opts.style;
  if (opts.lang === 'xml') tab.xmlFormatStyle = opts.style;
  tab.formatIndent = opts.indentKey;
  var body = tab.response.body;
  var formatted;
  if (opts.lang === 'json') {
    formatted = formatJson(body, opts.style, opts.indent);
  } else if (opts.lang === 'xml') {
    formatted = formatXml(body, opts.style, opts.indent);
  } else {
    return;
  }
  // Raw 酉??낅뜲?댄듃
  var rawEl = mc.querySelector('.js-res-raw');
  if (rawEl) rawEl.innerHTML = renderResponseBody(formatted, opts.lang, tab.responseSearchQuery || '', tab.responseSearchIndex || 0, getResponseSearchState(tab));
  // JSON ?몃━???щ젋?붾쭅 (pretty?먯꽌???섎? ?놁?留??쇨????좎?)
  if (opts.lang === 'json') {
    var treeEl = mc.querySelector('.js-res-tree');
    if (treeEl) {
      try {
        var parsed = JSON.parse(body);
        treeEl.innerHTML = buildJsonTree(parsed, '', true);
        bindTreeToggles(treeEl);
      } catch {}
    }
  }
  syncResponseSearch(mc);
  debouncePersist();
}

function formatJson(body, style, indent) {
  try {
    var parsed = JSON.parse(body);
    if (style === 'compact') return JSON.stringify(parsed);
    return JSON.stringify(parsed, null, indent);
  } catch { return body; }
}

// === XML ?щ㎎??(?뺢퇋??湲곕컲, ?몃? ?쇱씠釉뚮윭由??놁쓬) ===
function formatXml(xml, style, indent) {
  // ?좏뻾 怨듬갚/以꾨컮轅??뺢퇋??
  xml = xml.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');

  if (style === 'compact') {
    // ?쒓렇 ?ъ씠??怨듬갚/以꾨컮轅??쒓굅
    return xml.replace(/>\\s+</g, '><').replace(/^\\s+|\\s+$/g, '');
  }

  // ?좏겙 遺꾨━: XML ?좎뼵, 二쇱꽍, CDATA, ??꾪겢濡쒖쭠, ?щ뒗?쒓렇, ?ル뒗?쒓렇, ?띿뒪??
  var tokens = xmlTokenize(xml);

  if (style === 'inline') {
    return xmlBuildInline(tokens, indent);
  }

  // Pretty
  return xmlBuildPretty(tokens, indent);
}

function xmlTokenize(xml) {
  var tokens = [];
  var re = /(<\\?[\\s\\S]*?\\?>|<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\/[^>]+>|<[^>]+\\/\\s*>|<[^>]+>)/g;
  var lastIndex = 0;
  var match;
  while ((match = re.exec(xml)) !== null) {
    if (match.index > lastIndex) {
      var text = xml.substring(lastIndex, match.index).trim();
      if (text) tokens.push({ type: 'text', value: text });
    }
    var tag = match[1];
    if (tag.startsWith('<?')) tokens.push({ type: 'decl', value: tag });
    else if (tag.startsWith('<!--')) tokens.push({ type: 'comment', value: tag });
    else if (tag.startsWith('<![CDATA[')) tokens.push({ type: 'cdata', value: tag });
    else if (tag.startsWith('</')) tokens.push({ type: 'close', value: tag });
    else if (tag.endsWith('/>')) tokens.push({ type: 'self', value: tag });
    else tokens.push({ type: 'open', value: tag });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < xml.length) {
    var tail = xml.substring(lastIndex).trim();
    if (tail) tokens.push({ type: 'text', value: tail });
  }
  return tokens;
}

function xmlBuildPretty(tokens, indent) {
  var lines = [];
  var depth = 0;
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
    } else if (t.type === 'open') {
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
    }
  }
  return lines.join('\\n');
}

function xmlBuildInline(tokens, indent) {
  // Inline Children: ?먯떇???띿뒪???섎굹嫄곕굹 ?먯떇???섎굹肉먯씠硫???以꾨줈
  // 1?④퀎: ?몃━ 援ъ“ ?뚯븙 ??inline ?먯젙
  var lines = [];
  var depth = 0;
  var i = 0;
  while (i < tokens.length) {
    var t = tokens[i];
    if (t.type === 'open') {
      // ?ㅼ쓬 ?좏겙???띿뒪???ル뒗?쒓렇 ?먮뒗 ?⑥씪 ?먯떇+?ル뒗?쒓렇?몄? ?뺤씤
      if (i + 2 < tokens.length && tokens[i+1].type === 'text' && tokens[i+2].type === 'close') {
        // <tag>text</tag> ????以?
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      if (i + 3 < tokens.length && tokens[i+1].type === 'self' && tokens[i+2].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      // ?먯떇???섎굹 (open + text + close) ??寃쎌슦: <parent><child>text</child></parent>
      if (i + 4 < tokens.length &&
          tokens[i+1].type === 'open' && tokens[i+2].type === 'text' &&
          tokens[i+3].type === 'close' && tokens[i+4].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value + tokens[i+3].value + tokens[i+4].value);
        i += 5;
        continue;
      }
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
      i++;
    } else if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    }
  }
  return lines.join('\\n');
}

function indentStr(depth, indent) {
  var s = '';
  for (var i = 0; i < depth; i++) s += indent;
  return s;
}

function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function escapeHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escapeAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function truncate(s, n) { return s.length > n ? s.substring(0, n-1) + '...' : s; }

// 誘몄튂??蹂??泥댄겕 (URL ?낅젰?)
function checkUnresolvedVars() {
  var urlEl = mainContent.querySelector('.js-url');
  var overlay = mainContent.querySelector('.js-var-overlay');
  if (!urlEl || !overlay) return;
  var val = urlEl.value || '';
  var re = /\\{\\{([^}]+)\\}\\}/g;
  var match;
  var unresolvedNames = [];
  while ((match = re.exec(val)) !== null) {
    var name = match[1].trim();
    if (activeVarKeys.indexOf(name) < 0) {
      unresolvedNames.push(name);
    }
  }
  if (unresolvedNames.length > 0) {
    var html = escapeHtml(val).replace(/\\{\\{([^}]+)\\}\\}/g, function(m, n) {
      if (unresolvedNames.indexOf(n.trim()) >= 0) {
        return '<span class="unresolved-var">' + m + '</span>';
      }
      return m;
    });
    overlay.innerHTML = html;
    overlay.classList.remove('hidden');
    // ?ㅽ겕濡??숆린??
    overlay.scrollLeft = urlEl.scrollLeft;
  } else {
    overlay.innerHTML = '';
    overlay.classList.add('hidden');
  }
}

// ???곹깭瑜?Extension???꾩넚 (??μ슜)
function persistTabState() {
    saveActiveTabState();
    var tabData = tabs.map(function(t) {
    return Object.assign({ name: t.name, autoName: !!t.autoName, method: t.method, url: t.url, headers: t.headers, params: t.params, body: t.body, bodyType: t.bodyType, formData: t.formData || [], binaryFilePath: t.binaryFilePath || '', auth: t.auth, scripts: t.scripts || { preRequest: '', test: '' }, jsonFormatStyle: t.jsonFormatStyle, xmlFormatStyle: t.xmlFormatStyle, formatIndent: t.formatIndent, responseSearchQuery: t.responseSearchQuery || '', responseSearchIndex: typeof t.responseSearchIndex === 'number' ? t.responseSearchIndex : 0, responseSearchCaseSensitive: t.responseSearchCaseSensitive === true, responseSearchRegex: t.responseSearchRegex === true, pinned: t.pinned || false, requestId: t.requestId || undefined }, requestSettingsSnapshot(t));
    });
  var activeIdx = tabs.findIndex(function(t) { return t.id === activeTabId; });
  vscode.postMessage({ type: 'saveTabState', tabs: tabData, activeIndex: Math.max(0, activeIdx), compareSettings: cloneCompareSettings(compareSettings) });
}

// ??蹂寃??꾪솚/?リ린 ???먮룞 ???(?붾컮?댁뒪)
var _persistTimer = null;
function debouncePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistTabState, 1000);
}

// 珥덇린 ?곹깭: 鍮????섎굹 ?앹꽦
createTab();

// webview 以鍮??좏샇 ?꾩넚
vscode.postMessage({ type: 'webviewReady' });
</script>
<script nonce="${nonce}" src="${hljsUri}"></script>
</body>
</html>`;
  }
}



