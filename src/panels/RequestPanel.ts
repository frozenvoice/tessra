import * as vscode from 'vscode';
import { HttpService } from '../services/HttpService';
import { VariableService } from '../services/VariableService';
import { StorageService } from '../services/StorageService';
import { CollectionTreeProvider } from '../providers/CollectionTreeProvider';
import { HistoryTreeProvider } from '../providers/HistoryTreeProvider';
import { EnvironmentTreeProvider } from '../providers/EnvironmentTreeProvider';
import { MessageType, Request, AuthConfig, KeyValue, Environment, CollectionItem, Response, TabState } from '../models/types';
import { CurlService } from '../services/CurlService';

// Webview 요청 패널 관리 (다중 탭 지원)
export class RequestPanel {
  public static currentPanel: RequestPanel | undefined;
  public static storage: StorageService;
  public static historyProvider: HistoryTreeProvider;
  public static collectionProvider: CollectionTreeProvider;
  public static environmentProvider: EnvironmentTreeProvider;
  private static readonly viewType = 'arc.requestPanel';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly httpService: HttpService;
  private disposables: vscode.Disposable[] = [];
  private collectionRunAbort = false;
  private activeRequests = new Map<string, { abort: () => void }>();

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.httpService = new HttpService();

    this.panel.webview.html = this.getHtmlContent();

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // 저장된 탭 상태 복원
    this.restoreTabState();
  }

  // 저장된 탭 상태를 webview에 전송
  private restoreTabState() {
    const state = RequestPanel.storage.getTabState();
    if (state && state.tabs.length > 0) {
      // webview 준비 후 복원 (onDidReceiveMessage에서 webviewReady 수신 시 전송)
      this.pendingRestore = state;
    }
  }
  private pendingRestore: { tabs: TabState[]; activeIndex: number } | null = null;

  // 패널 표시. createNewTab=true이면 새 탭도 생성
  public static show(extensionUri: vscode.Uri, createNewTab: boolean = false) {
    if (RequestPanel.currentPanel) {
      RequestPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
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

  // WebviewPanelSerializer에서 호출: 패널 복원
  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    RequestPanel.currentPanel = new RequestPanel(panel, extensionUri);
  }

  // Webview에 새 탭 생성 요청
  public newTab() {
    this.panel.webview.postMessage({ type: 'newTab' });
  }

  // 외부에서 요청 로드 → Webview에 새 탭으로 전달
  public loadRequest(req: Request) {
    this.panel.webview.postMessage({
      type: MessageType.LoadRequest,
      method: req.method,
      url: req.url,
      headers: req.headers ?? [],
      params: req.params ?? [],
      body: req.body ?? '',
      auth: req.auth ?? { type: 'none' },
      name: req.name || `${req.method} ${req.url}`,
    });
  }

  // 환경변수 편집 데이터 전송
  public loadEnvironment(env: Environment) {
    this.panel.webview.postMessage({
      type: MessageType.LoadEnvironment,
      envId: env.id,
      envName: env.name,
      variables: env.variables,
    });
  }

  // 기본 헤더 편집 UI 로드
  public loadDefaultHeaders() {
    const headers = RequestPanel.storage.getDefaultHeaders();
    this.panel.webview.postMessage({
      type: MessageType.LoadDefaultHeaders,
      headers,
    });
  }

  // 활성 환경 이름 업데이트
  public updateActiveEnv(envName: string | null) {
    this.panel.webview.postMessage({
      type: MessageType.UpdateActiveEnv,
      envName,
    });
    this.sendActiveVarsToWebview();
  }

  // 컬렉션 전체 실행 (재귀적으로 하위 폴더 포함)
  public async runCollection(name: string, items: CollectionItem[]) {
    // 모든 요청을 재귀적으로 수집
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
      vscode.window.showInformationMessage('실행할 요청이 없습니다.');
      return;
    }

    // Webview에 러너 시작 알림
    this.collectionRunAbort = false;
    this.panel.webview.postMessage({
      type: MessageType.RunCollectionStart,
      name,
      total: requests.length,
    });

    const vars = RequestPanel.environmentProvider.getActiveVariables();
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < requests.length; i++) {
      if (this.collectionRunAbort) { break; }

      const { name: reqName, request: req } = requests[i];
      const resolvedUrl = VariableService.resolve(req.url, vars);
      const resolvedHeaders = VariableService.resolveKeyValues(req.headers ?? [], vars);
      const resolvedParams = VariableService.resolveKeyValues(req.params ?? [], vars);
      const resolvedBody = VariableService.resolve(req.body ?? '', vars);
      const url = this.buildUrl(resolvedUrl, resolvedParams);
      const finalHeaders = [...resolvedHeaders];
      this.applyAuth(req.auth ?? { type: 'none' }, finalHeaders, vars);

      let response: Response | null = null;
      let error: string | null = null;
      let status = 0;
      let statusText = '';
      let time = 0;

      try {
        response = await this.httpService.send(req.method, url, finalHeaders, resolvedBody, 30);
        status = response.status;
        statusText = response.statusText;
        time = response.time;
        if (status >= 400) { failed++; } else { passed++; }
      } catch (err: unknown) {
        error = err instanceof Error ? err.message : String(err);
        failed++;
      }

      // 진행 상황 전송
      this.panel.webview.postMessage({
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

    // 완료 알림
    this.panel.webview.postMessage({
      type: MessageType.RunCollectionDone,
      total: requests.length,
      passed,
      failed,
      time: Date.now() - startTime,
      stopped: this.collectionRunAbort,
    });
  }

  private async handleMessage(message: any) {
    // Webview 초기화 완료 → 저장된 탭 복원
    if (message.type === 'webviewReady') {
      if (this.pendingRestore) {
        this.panel.webview.postMessage({
          type: MessageType.RestoreTabState,
          tabs: this.pendingRestore.tabs,
          activeIndex: this.pendingRestore.activeIndex,
        });
        this.pendingRestore = null;
      }
      // 활성 환경변수 목록도 전송 (미치환 변수 경고용)
      this.sendActiveVarsToWebview();
      return;
    }
    switch (message.type) {
      case MessageType.SendRequest:
        await this.executeRequest(message);
        break;
      case MessageType.CancelRequest: {
        const handle = this.activeRequests.get(message.tabId);
        if (handle) { handle.abort(); }
        break;
      }
      case MessageType.SaveRequest:
        await RequestPanel.collectionProvider.saveRequest({
          method: message.method,
          url: message.url,
          headers: message.headers ?? [],
          params: message.params ?? [],
          body: message.body ?? '',
          auth: message.auth ?? { type: 'none' },
        });
        break;
      case MessageType.CopyAsCurl: {
        const curl = CurlService.generate({
          method: message.method,
          url: message.url,
          headers: message.headers ?? [],
          params: message.params ?? [],
          body: message.body ?? '',
          auth: message.auth ?? { type: 'none' },
        });
        vscode.env.clipboard.writeText(curl);
        vscode.window.showInformationMessage('cURL 명령어가 클립보드에 복사되었습니다.');
        break;
      }
      case MessageType.CopyResponseBody:
        await vscode.env.clipboard.writeText(message.body ?? '');
        vscode.window.showInformationMessage('응답 본문이 클립보드에 복사되었습니다.');
        break;
      case MessageType.CopyToClipboard:
        await vscode.env.clipboard.writeText(message.text ?? '');
        break;
      case MessageType.SaveResponseBody:
        await this.saveResponseBody(message.body, message.contentType);
        break;
      case MessageType.SaveEnvironmentVars:
        RequestPanel.storage.updateEnvironmentVars(message.envId, message.variables);
        RequestPanel.environmentProvider.refresh();
        break;
      case MessageType.SaveDefaultHeaders:
        RequestPanel.storage.saveDefaultHeaders(message.headers);
        vscode.window.showInformationMessage('기본 헤더가 저장되었습니다.');
        break;
      case MessageType.SaveTabState:
        RequestPanel.storage.saveTabState(message.tabs ?? [], message.activeIndex ?? 0);
        break;
      case MessageType.StopCollectionRun:
        this.collectionRunAbort = true;
        break;
    }
  }

  // 활성 환경변수 키 목록을 webview에 전달
  private sendActiveVarsToWebview() {
    const vars = RequestPanel.environmentProvider.getActiveVariables();
    const varKeys = vars.filter(v => v.enabled && v.key).map(v => v.key);
    this.panel.webview.postMessage({ type: 'activeVarKeys', varKeys });
  }

  private async executeRequest(message: any) {
    const tabId = message.tabId;
    const method = message.method;
    const rawUrl = message.url;
    const rawHeaders: KeyValue[] = message.headers ?? [];
    const rawParams: KeyValue[] = message.params ?? [];
    const rawBody: string = message.body ?? '';
    const auth: AuthConfig = message.auth ?? { type: 'none' };
    const timeout: number = message.timeout ?? 30;

    // {{변수}} 치환
    const vars = RequestPanel.environmentProvider.getActiveVariables();
    const resolvedUrl = VariableService.resolve(rawUrl, vars);

    // 미치환 변수 검사 — {{변수}}가 그대로 남아있으면 전송 차단
    const unresolvedMatch = resolvedUrl.match(/\{\{([^}]+)\}\}/);
    if (unresolvedMatch) {
      const varName = unresolvedMatch[1].trim();
      this.panel.webview.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: `환경변수 {{${varName}}}이 설정되지 않았습니다. Environment를 활성화해주세요.`,
      });
      return;
    }

    const resolvedHeaders = VariableService.resolveKeyValues(rawHeaders, vars);
    const resolvedParams = VariableService.resolveKeyValues(rawParams, vars);
    const resolvedBody = VariableService.resolve(rawBody, vars);

    // 쿼리 파라미터 병합
    let url: string;
    try {
      url = this.buildUrl(resolvedUrl, resolvedParams);
    } catch {
      this.panel.webview.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: `잘못된 URL입니다: ${resolvedUrl}`,
      });
      return;
    }

    // 기본 헤더 병합 (개별 요청 헤더가 우선)
    const defaultHeaders = VariableService.resolveKeyValues(
      RequestPanel.storage.getDefaultHeaders(), vars
    );
    const requestKeySet = new Set(
      resolvedHeaders.filter((h) => h.enabled && h.key).map((h) => h.key.toLowerCase())
    );
    const mergedDefaults = defaultHeaders.filter(
      (h) => h.enabled && h.key && !requestKeySet.has(h.key.toLowerCase())
    );
    const finalHeaders = [...mergedDefaults, ...resolvedHeaders];

    // 인증 헤더 주입
    this.applyAuth(auth, finalHeaders, vars);

    let handle: import('../services/HttpService').SendHandle;
    try {
      handle = this.httpService.send(method, url, finalHeaders, resolvedBody, timeout);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.panel.webview.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: errorMsg,
      });
      return;
    }
    this.activeRequests.set(tabId, handle);

    try {
      const response = await handle.promise;

      // 히스토리 저장
      this.saveToHistory(method, rawUrl, rawHeaders, rawParams, rawBody, auth,
        { status: response.status, statusText: response.statusText, time: response.time });
      RequestPanel.historyProvider.refresh();

      // 치환된 실제 URL과 헤더를 webview에 전달
      const resolvedHeaderPairs = finalHeaders
        .filter(h => h.enabled && h.key)
        .map(h => ({ key: h.key, value: h.value }));

      this.panel.webview.postMessage({
        type: MessageType.ReceiveResponse,
        tabId,
        response,
        resolvedUrl: url,
        resolvedHeaders: resolvedHeaderPairs,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.saveToHistory(method, rawUrl, rawHeaders, rawParams, rawBody, auth, null);
      RequestPanel.historyProvider.refresh();

      this.panel.webview.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: errorMsg,
      });
    } finally {
      this.activeRequests.delete(tabId);
    }
  }

  private saveToHistory(
    method: string, url: string, headers: KeyValue[], params: KeyValue[],
    body: string, auth: AuthConfig,
    response: { status: number; statusText: string; time: number } | null
  ) {
    RequestPanel.storage.addHistoryEntry({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      request: {
        id: '', name: `${method} ${url}`, method: method as any,
        url, headers, params, body,
        bodyType: body ? 'json' : 'none', auth,
      },
      response,
      timestamp: Date.now(),
    });
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

  private applyAuth(auth: AuthConfig, headers: KeyValue[], vars: KeyValue[]): void {
    switch (auth.type) {
      case 'basic':
        if (auth.basic) {
          const u = VariableService.resolve(auth.basic.username, vars);
          const p = VariableService.resolve(auth.basic.password, vars);
          const encoded = Buffer.from(`${u}:${p}`).toString('base64');
          headers.push({ key: 'Authorization', value: `Basic ${encoded}`, enabled: true });
        }
        break;
      case 'bearer':
        if (auth.bearer) {
          const t = VariableService.resolve(auth.bearer.token, vars);
          headers.push({ key: 'Authorization', value: `Bearer ${t}`, enabled: true });
        }
        break;
      case 'apikey':
        if (auth.apikey && auth.apikey.addTo === 'header') {
          headers.push({
            key: VariableService.resolve(auth.apikey.key, vars),
            value: VariableService.resolve(auth.apikey.value, vars),
            enabled: true,
          });
        }
        break;
    }
  }

  // Content-Type → 파일 확장자 매핑
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

  // 응답 바디를 파일로 저장
  private async saveResponseBody(body: string, contentType: string): Promise<void> {
    const ext = RequestPanel.contentTypeToExt(contentType);
    // 기본 파일명: response_YYYYMMDD_HHmmss.확장자
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`response_${ts}.${ext}`),
      filters: {
        [`${ext.toUpperCase()} Files`]: [ext],
        'All Files': ['*'],
      },
    });
    if (!uri) { return; }
    try {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(body, 'utf-8'));
      vscode.window.showInformationMessage(`응답 저장 완료: ${uri.fsPath}`);
    } catch (err: unknown) {
      vscode.window.showErrorMessage(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private dispose() {
    RequestPanel.currentPanel = undefined;
    // 패널 닫힐 때 마지막으로 저장된 탭 상태 유지 (webview에서 주기적으로 전송)
    for (const d of this.disposables) { d.dispose(); }
    this.disposables = [];
  }

  // ===================================================================
  // Webview HTML (다중 탭 + 환경변수 편집 + 변수 치환 미리보기)
  // ===================================================================
  private getHtmlContent(): string {
    const hljsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'hljs.js')
    );
    return /*html*/ `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Arc Client</title>
<style>
/* highlight.js vs2015 테마 (인라인) */
pre code.hljs{display:block;overflow-x:auto;padding:0}code.hljs{padding:0}.hljs{background:transparent;color:#dcdcdc}.hljs-keyword,.hljs-literal,.hljs-name,.hljs-symbol{color:#569cd6}.hljs-link{color:#569cd6;text-decoration:underline}.hljs-built_in,.hljs-type{color:#4ec9b0}.hljs-class,.hljs-number{color:#b8d7a3}.hljs-meta .hljs-string,.hljs-string{color:#d69d85}.hljs-regexp,.hljs-template-tag{color:#9a5334}.hljs-formula,.hljs-function,.hljs-params,.hljs-subst,.hljs-title{color:#dcdcdc}.hljs-comment,.hljs-quote{color:#57a64a;font-style:italic}.hljs-doctag{color:#608b4e}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#9b9b9b}.hljs-template-variable,.hljs-variable{color:#bd63c5}.hljs-attr,.hljs-attribute{color:#9cdcfe}.hljs-section{color:gold}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:#d7ba7d}.hljs-addition{background-color:#144212;display:inline-block;width:100%}.hljs-deletion{background-color:#600;display:inline-block;width:100%}
</style>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* === 요청 탭 바 === */
.tab-bar{display:flex;background:var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background));border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;overflow-x:auto;scrollbar-width:thin}
.tab-bar::-webkit-scrollbar{height:3px}
.req-tab{display:flex;align-items:center;gap:4px;padding:4px 10px;font-size:12px;cursor:pointer;border-right:1px solid var(--vscode-panel-border,#333);white-space:nowrap;opacity:.6;min-width:0;flex-shrink:0;user-select:none}
.req-tab:hover{opacity:.85}
.req-tab.active{opacity:1;background:var(--vscode-editor-background);border-bottom:2px solid var(--vscode-focusBorder)}
.req-tab .method-badge{font-weight:700;font-size:11px;padding:1px 4px;border-radius:2px}
.method-GET{color:#4ec94e}.method-POST{color:#e5c07b}.method-PUT{color:#61afef}.method-PATCH{color:#d19a66}.method-DELETE{color:#e06c75}.method-HEAD{color:#abb2bf}.method-OPTIONS{color:#abb2bf}
.req-tab .close-tab{opacity:.5;cursor:pointer;font-size:12px;padding:0 2px;line-height:1}
.req-tab .close-tab:hover{opacity:1;color:var(--vscode-errorForeground)}
.add-tab{padding:4px 10px;cursor:pointer;opacity:.5;font-size:14px;display:flex;align-items:center}
.add-tab:hover{opacity:1}

/* === 메인 컨텐츠 === */
.main-content{flex:1;overflow:hidden;display:flex;flex-direction:column}

/* URL 바 */
.url-bar{display:flex;gap:6px;padding:6px 10px;flex-shrink:0}
.url-bar select{width:95px;padding:4px 5px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:3px;font-size:12px;font-weight:700}
.url-bar input{flex:1;padding:4px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:var(--vscode-editor-font-family,monospace)}
.url-bar input:focus{outline:1px solid var(--vscode-focusBorder)}
.url-input-wrap{position:relative;flex:1;display:flex}
.url-input-wrap input{flex:1;width:100%}
.var-overlay{position:absolute;top:0;left:0;right:0;bottom:0;padding:4px 8px;font-size:12px;font-family:var(--vscode-editor-font-family,monospace);pointer-events:none;white-space:nowrap;overflow:hidden;color:transparent}
.unresolved-var{text-decoration:wavy underline #e06c75;text-decoration-skip-ink:none;color:transparent}
.btn{padding:4px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;font-size:12px;font-weight:600;cursor:pointer}
.btn:hover{background:var(--vscode-button-hoverBackground)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-s{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-cancel{background:#a1260d;color:#fff}
.btn-cancel:hover{background:#c42b1c}
.btn-s:hover{background:var(--vscode-button-secondaryHoverBackground)}
.timeout-wrap{display:flex;align-items:center;gap:0;margin-left:-2px}
.timeout-icon{font-size:12px;opacity:.45;margin-right:3px;user-select:none}
.timeout-input{width:50px;padding:4px 3px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:11px;text-align:center;font-family:var(--vscode-editor-font-family,monospace)}
.timeout-input:focus{outline:1px solid var(--vscode-focusBorder)}
.timeout-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.timeout-suffix{font-size:9px;opacity:.5;margin-left:2px;user-select:none}
.url-bar-spacer{flex:1}

/* 내부 탭 */
.tabs{display:flex;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;padding:0 10px}
.tab{padding:4px 12px;cursor:pointer;border-bottom:2px solid transparent;opacity:.5;font-size:11px;user-select:none;text-transform:uppercase;letter-spacing:.5px}
.tab:hover{opacity:.75}
.tab.active{opacity:1;border-bottom-color:var(--vscode-focusBorder)}

/* 패널 레이아웃 */
.split{flex:1;overflow:hidden;display:flex;flex-direction:column}
.req-area{flex:0 0 auto;max-height:40vh;overflow:auto;padding:4px 10px}
.divider{height:1px;background:var(--vscode-panel-border,#444);flex-shrink:0}
.res-area{flex:1;overflow:hidden;display:flex;flex-direction:column;padding:0 10px}

/* KV 행 */
.kv-section{padding:3px 0}
.kv-row{display:flex;gap:3px;margin-bottom:2px;align-items:center}
.kv-row input[type="checkbox"]{width:14px;height:14px;accent-color:var(--vscode-focusBorder)}
.kv-row input[type="text"],.kv-row input[type="password"]{flex:1;padding:3px 5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:11px;font-family:var(--vscode-editor-font-family,monospace)}
.kv-row .rm{background:transparent;border:none;color:var(--vscode-errorForeground,#f44);cursor:pointer;font-size:13px;padding:0 3px;line-height:1}
.add-btn{background:transparent;border:1px dashed var(--vscode-input-border,#555);color:var(--vscode-foreground);padding:2px 8px;border-radius:2px;cursor:pointer;font-size:12px;opacity:.5;margin-top:2px}
.auto-badge{font-size:9px;opacity:.4;white-space:nowrap;margin-left:2px;user-select:none}
.add-btn:hover{opacity:1}

/* Body */
.body-type-select{padding:3px 5px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:12px;margin-bottom:4px}
.body-section textarea{width:100%;min-height:70px;padding:5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-family:var(--vscode-editor-font-family,monospace);font-size:12px;resize:vertical}

/* Auth */
.auth-section{padding:3px 0}
.auth-section select{padding:3px 5px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:11px;margin-bottom:4px}
.auth-section .auth-fields{display:flex;flex-direction:column;gap:3px}
.auth-section .auth-fields input,.auth-section .auth-fields select{padding:3px 5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:11px}
.auth-row{display:flex;gap:4px;align-items:center}
.auth-row label{font-size:11px;opacity:.6;min-width:55px}

/* 환경변수 편집 */
.env-editor{padding:6px 10px;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;background:var(--vscode-sideBar-background,var(--vscode-editor-background))}
.env-editor-title{font-size:11px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px}
.env-badge{background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:1px 6px;border-radius:8px;font-size:9px}

/* 응답 */
.response-meta{display:flex;gap:10px;align-items:center;padding:5px 0;flex-shrink:0;font-size:11px}
.status{font-weight:700;padding:1px 6px;border-radius:3px}
.status-2xx{background:#1a3a1a;color:#4ec94e}
.status-3xx{background:#3a3a1a;color:#c9c94e}
.status-4xx{background:#3a1a1a;color:#c94e4e}
.status-5xx{background:#3a1a2a;color:#c94e8e}

.resolved-url{padding:3px 8px;font-size:10px;color:var(--vscode-textLink-foreground,#3794ff);background:var(--vscode-input-background);border-radius:3px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;font-family:var(--vscode-editor-font-family,monospace);flex-shrink:0}
.resolved-url:hover{text-decoration:underline;opacity:.85}
.resolved-url.copied{color:#4ec94e}
.resolved-headers-section{margin-bottom:4px}
.resolved-headers-title{font-size:10px;font-weight:700;color:var(--vscode-descriptionForeground,#888);text-transform:uppercase;letter-spacing:.5px;padding:2px 0}
.res-headers-pre pre{background:var(--vscode-input-background);padding:6px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);font-size:11px;white-space:pre-wrap;word-break:break-all;margin:0}

.json-body{background:var(--vscode-input-background);padding:6px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);font-size:11px;white-space:pre-wrap;word-break:break-all;overflow:auto;flex:1;line-height:1.45}
.json-key{color:#9cdcfe}.json-str{color:#ce9178}.json-num{color:#b5cea8}.json-bool{color:#569cd6}.json-null{color:#569cd6}

/* 응답 바디 툴바 */
.res-body-toolbar{display:flex;align-items:center;gap:4px;padding:2px 0;flex-shrink:0}
.res-body-toolbar .toggle-group{display:flex;border:1px solid var(--vscode-input-border,#555);border-radius:3px;overflow:hidden;margin-right:4px}
.res-body-toolbar .toggle-btn{padding:2px 8px;font-size:9px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:none;opacity:.6;user-select:none}
.res-body-toolbar .toggle-btn:hover{opacity:.85}
.res-body-toolbar .toggle-btn.active{opacity:1;background:var(--vscode-button-secondaryBackground)}
.res-body-toolbar .tb-btn{padding:2px 6px;font-size:9px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-input-border,#555);border-radius:3px;opacity:.6}
.res-body-toolbar .tb-btn:hover{opacity:1}

/* JSON 트리 뷰 */
.json-tree{background:var(--vscode-input-background);padding:6px;border-radius:3px;font-family:var(--vscode-editor-font-family,monospace);font-size:11px;overflow:auto;flex:1;line-height:1.6;user-select:text}
.jt-node{padding-left:16px}
.jt-row{display:flex;align-items:baseline;white-space:nowrap}
.jt-toggle{display:inline-block;width:14px;cursor:pointer;text-align:center;color:var(--vscode-foreground);opacity:.5;flex-shrink:0;user-select:none}
.jt-toggle:hover{opacity:1}
.jt-key{color:#9cdcfe;margin-right:4px}
.jt-str{color:#ce9178}.jt-num{color:#b5cea8}.jt-bool{color:#569cd6}.jt-null{color:#569cd6}
.jt-brace{color:var(--vscode-foreground);opacity:.6}
.jt-children{overflow:hidden}
.jt-children.collapsed{display:none}

/* Format 드롭다운 */
.fmt-wrap{position:relative;display:inline-block}
.fmt-menu{display:none;position:absolute;top:100%;left:0;z-index:100;background:var(--vscode-dropdown-background,#252526);border:1px solid var(--vscode-dropdown-border,#555);border-radius:3px;padding:4px 0;min-width:170px;font-size:9px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.fmt-menu.open{display:block}
.fmt-menu-label{padding:2px 10px;opacity:.5;font-size:8px;text-transform:uppercase;user-select:none}
.fmt-menu-item{padding:3px 10px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px}
.fmt-menu-item:hover{background:var(--vscode-list-hoverBackground)}
.fmt-menu-item .check{width:12px;text-align:center;opacity:.7}
.fmt-menu-sep{border-top:1px solid var(--vscode-input-border,#555);margin:3px 0}
.jt-ellipsis{color:var(--vscode-foreground);opacity:.4;cursor:pointer}
.jt-comma{opacity:.4}

.res-headers-pre{font-family:var(--vscode-editor-font-family,monospace);font-size:11px;background:var(--vscode-input-background);padding:6px;border-radius:3px;overflow:auto;flex:1}
.error-msg{color:var(--vscode-errorForeground,#f44);padding:6px;font-size:12px}
.hidden{display:none!important}
.spinner{display:inline-block;width:11px;height:11px;border:2px solid var(--vscode-foreground);border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:4px}
@keyframes spin{to{transform:rotate(360deg)}}

/* Send 버튼 클릭 → 눌림 효과 */
@keyframes btn-press{0%{transform:scale(1)}50%{transform:scale(.95)}100%{transform:scale(1)}}
.btn.btn-pressed{animation:btn-press .15s ease}

/* URL 입력란 빛 줄기 sweep */
@keyframes url-sweep{0%{background-position:-100% 0}100%{background-position:200% 0}}
.url-input-wrap.sweep::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;border-radius:3px;pointer-events:none;background:linear-gradient(90deg,transparent 0%,rgba(0,122,204,.25) 40%,rgba(0,122,204,.45) 50%,rgba(0,122,204,.25) 60%,transparent 100%);background-size:50% 100%;background-repeat:no-repeat;animation:url-sweep .3s ease forwards}

/* 전송 중 네온 펄스 */
@keyframes neon-pulse{0%{border-color:#007acc;box-shadow:0 0 3px rgba(0,122,204,.4)}50%{border-color:#3af;box-shadow:0 0 8px rgba(51,170,255,.6)}100%{border-color:#007acc;box-shadow:0 0 3px rgba(0,122,204,.4)}}
.url-bar input.neon-active{animation:neon-pulse 1.5s ease infinite;border-color:#007acc}

/* Send→Cancel 전환 슬라이드 */
@keyframes btn-slide-in{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
.btn-sending{pointer-events:auto;position:relative;min-width:58px;animation:btn-slide-in .2s ease}
.btn-sending .spinner{width:10px;height:10px;border-width:1.5px;margin-right:3px}

/* 2xx 성공: 팡! 터지듯 scale + 초록 글로우 */
@keyframes badge-pop{0%{transform:scale(1.3);box-shadow:0 0 12px rgba(78,201,78,.8)}100%{transform:scale(1);box-shadow:none}}
.status.flash-success{animation:badge-pop .25s cubic-bezier(.17,.67,.35,1.5)}

/* 4xx/5xx 실패: 흔들림 shake */
@keyframes badge-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
.status.flash-error{animation:badge-shake .25s ease}

/* 4xx/5xx 화면 전체 빨간색 번쩍 */
@keyframes screen-flash-red{0%{opacity:.15}100%{opacity:0}}
.screen-flash{position:fixed;top:0;left:0;right:0;bottom:0;background:#c94e4e;pointer-events:none;z-index:9999;animation:screen-flash-red .1s ease forwards}

/* 응답 영역 슬램 (바운스) */
@keyframes res-slam{0%{opacity:0;transform:translateY(-10px)}60%{opacity:1;transform:translateY(2px)}100%{transform:translateY(0)}}
.res-area.slide-in{animation:res-slam .25s cubic-bezier(.22,.68,0,1.2)}

/* 프로그레스 바 */
@keyframes progress-indeterminate{0%{left:-30%}100%{left:100%}}
.req-progress{height:2px;width:100%;background:var(--vscode-input-background);overflow:hidden;flex-shrink:0;opacity:0;transition:opacity .2s}
.req-progress.active{opacity:1}
.req-progress-bar{height:100%;width:30%;background:var(--vscode-progressBar-background,#0e70c0);position:relative;animation:progress-indeterminate 1.2s ease-in-out infinite}

/* PERFECT! 텍스트 */
@keyframes perfect-pop{0%{opacity:0;transform:scale(.5)}30%{opacity:1;transform:scale(1.1)}60%{transform:scale(.95)}100%{opacity:0;transform:scale(1)}}
.perfect-badge{position:absolute;top:-18px;right:0;font-size:9px;font-weight:800;color:#4ec94e;letter-spacing:1px;pointer-events:none;animation:perfect-pop .8s ease forwards;text-shadow:0 0 6px rgba(78,201,78,.5)}

/* 경과시간 실시간 표시 */
.elapsed-timer{font-size:10px;opacity:.6;margin-left:4px;font-variant-numeric:tabular-nums}

.placeholder{display:flex;align-items:center;justify-content:center;flex:1;opacity:.25;font-size:12px}

/* 컬렉션 러너 */
.runner-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--vscode-editor-background);z-index:100;display:flex;flex-direction:column;overflow:hidden}
.runner-header{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border,#444);display:flex;align-items:center;gap:8px;flex-shrink:0}
.runner-header h3{font-size:12px;font-weight:600;flex:1;margin:0}
.runner-progress{padding:4px 12px;font-size:11px;opacity:.7;flex-shrink:0;display:flex;align-items:center;gap:6px}
.runner-bar{flex:1;height:3px;background:var(--vscode-input-background);border-radius:2px;overflow:hidden}
.runner-bar-fill{height:100%;background:var(--vscode-progressBar-background,#0e70c0);transition:width .2s}
.runner-summary{padding:6px 12px;font-size:12px;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;display:flex;gap:12px}
.runner-summary .pass{color:#4ec94e}.runner-summary .fail{color:#e06c75}
.runner-list{flex:1;overflow:auto;font-size:11px}
.runner-row{padding:4px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;border-bottom:1px solid var(--vscode-panel-border,#222)}
.runner-row:hover{background:var(--vscode-list-hoverBackground)}
.runner-row .rr-idx{opacity:.4;width:20px;text-align:right}
.runner-row .rr-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.runner-row .rr-status{font-weight:700;min-width:44px}
.runner-row .rr-time{opacity:.5;min-width:40px;text-align:right}
.runner-row .rr-icon{font-size:12px}
.runner-row.pass .rr-status{color:#4ec94e}.runner-row.fail .rr-status{color:#e06c75}.runner-row.pending{opacity:.35}
.runner-detail{padding:6px 12px;background:var(--vscode-input-background);border-bottom:1px solid var(--vscode-panel-border,#333);font-family:var(--vscode-editor-font-family,monospace);font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow:auto}

/* 활성 환경 표시 */
.env-indicator{font-size:11px;opacity:.6;padding:0 10px 2px;flex-shrink:0}
.env-indicator .var-name{color:#dcdcaa}
</style>
</head>
<body>

<!-- 요청 탭 바 -->
<div class="tab-bar" id="tabBar">
  <div class="add-tab" id="addTabBtn" title="New tab">+</div>
</div>

<!-- 환경변수 편집 (숨김 상태) -->
<div id="envEditor" class="env-editor hidden">
  <div class="env-editor-title">
    <span>Environment:</span>
    <span class="env-badge" id="envEditorName"></span>
    <span style="flex:1"></span>
    <button class="btn btn-s" id="envSaveBtn" style="padding:2px 8px;font-size:11px">Save</button>
    <span class="rm" id="envCloseBtn" style="cursor:pointer;font-size:14px;opacity:.6">&times;</span>
  </div>
  <div id="envVarRows" class="kv-section"></div>
  <button class="add-btn" id="addEnvVarBtn">+ Add Variable</button>
</div>

<!-- 기본 헤더 편집 (숨김 상태) -->
<div id="defaultHeadersEditor" class="env-editor hidden">
  <div class="env-editor-title">
    <span>Default Headers</span>
    <span style="flex:1"></span>
    <button class="btn btn-s" id="defaultHeadersSaveBtn" style="padding:2px 8px;font-size:11px">Save</button>
    <span class="rm" id="defaultHeadersCloseBtn" style="cursor:pointer;font-size:14px;opacity:.6">&times;</span>
  </div>
  <div id="defaultHeaderRows" class="kv-section"></div>
  <button class="add-btn" id="addDefaultHeaderBtn">+ Add Header</button>
</div>

<!-- 메인 (탭별 컨텐츠) -->
<div class="main-content" id="mainContent">
  <div class="placeholder" id="emptyPlaceholder">Press + or Ctrl+T to create a new request</div>
</div>

<script>
const vscode = acquireVsCodeApi();

// === 탭 상태 관리 ===
let tabs = [];       // { id, name, method, url, headers, params, body, auth, response, error, loading }
let activeTabId = null;
let tabIdCounter = 0;
let currentEnvName = null;
let editingEnvId = null;
let activeVarKeys = [];  // 활성 환경의 변수 키 목록

// === 탭 바 ===
const tabBar = document.getElementById('tabBar');
const addTabBtn = document.getElementById('addTabBtn');
const mainContent = document.getElementById('mainContent');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');

addTabBtn.addEventListener('click', () => createTab());
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); createTab(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'w' && activeTabId) { e.preventDefault(); closeTab(activeTabId); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { sendActiveTab(); }
});

function createTab(data) {
  const id = 'tab_' + (++tabIdCounter);
  const tab = {
    id,
    name: data?.name || 'New Request',
    method: data?.method || 'GET',
    url: data?.url || '',
    headers: data?.headers || [],
    params: data?.params || [],
    body: data?.body || '',
    bodyType: data?.bodyType || 'none',
    auth: data?.auth || { type: 'none' },
    timeout: data?.timeout ?? 30,
    response: null,
    resolvedUrl: '',
    resolvedHeaders: [],
    error: null,
    loading: false,
    progressVisible: false,
    slideIn: false,
    sendTime: 0,
  };
  tabs.push(tab);
  switchTab(id);
  if (data) debouncePersist();
  return id;
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;
  tabs.splice(idx, 1);
  if (activeTabId === id) {
    activeTabId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)].id : null;
  }
  renderTabBar();
  renderContent();
  debouncePersist();
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
  tab.auth = collectAuth(mc);
  tab.timeout = parseInt(mc.querySelector('.js-timeout')?.value) || 0;
}

function renderTabBar() {
  // 기존 탭 요소 제거
  tabBar.querySelectorAll('.req-tab').forEach(el => el.remove());
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'req-tab' + (tab.id === activeTabId ? ' active' : '');
    el.innerHTML =
      '<span class="method-badge method-' + tab.method + '">' + tab.method + '</span>' +
      '<span class="tab-name">' + escapeHtml(truncate(tab.name, 25)) + '</span>' +
      '<span class="close-tab" data-id="' + tab.id + '">&times;</span>';
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('close-tab')) {
        closeTab(e.target.dataset.id);
      } else {
        switchTab(tab.id);
      }
    });
    tabBar.insertBefore(el, addTabBtn);
  }
}

function renderContent() {
  if (!activeTabId || tabs.length === 0) {
    mainContent.innerHTML = '<div class="placeholder">Press + or Ctrl+T to create a new request</div>';
    return;
  }
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  const envLine = currentEnvName
    ? '<div class="env-indicator"><span class="var-name">{{env}}</span> = ' + escapeHtml(currentEnvName) + '</div>'
    : '';

  let resHtml = '';
  if (tab.loading) {
    resHtml = '<div style="padding:6px"><span class="spinner"></span>요청 전송 중...</div>';
  } else if (tab.error) {
    resHtml = '<div class="error-msg">' + escapeHtml(tab.error) + '</div>';
  } else if (tab.response) {
    const r = tab.response;
    const sc = Math.floor(r.status / 100);
    const ct = (r.headers?.['content-type'] || r.headers?.['Content-Type'] || '').toLowerCase();
    const lang = detectLang(ct, r.body);
    const rawBodyHtml = highlightBody(r.body, lang);
    let hdrText = '';
    for (const [k,v] of Object.entries(r.headers)) hdrText += k + ': ' + v + '\\n';
    const hasFormat = (lang === 'json' || lang === 'xml');
    const fmtMenuHtml = hasFormat
      ? '<div class="fmt-wrap">' +
          '<button class="tb-btn js-fmt-btn">Format ▾</button>' +
          '<div class="fmt-menu js-fmt-menu">' +
            '<div class="fmt-menu-label">Style</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="pretty"><span class="check">✓</span>Pretty</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="compact"><span class="check"> </span>Compact</div>' +
            (lang === 'xml' ? '<div class="fmt-menu-item js-fmt-style" data-style="inline"><span class="check"> </span>Inline Children</div>' : '') +
            '<div class="fmt-menu-sep"></div>' +
            '<div class="fmt-menu-label">Indent</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="2"><span class="check">✓</span>2 spaces</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="4"><span class="check"> </span>4 spaces</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="tab"><span class="check"> </span>Tab</div>' +
          '</div>' +
        '</div>'
      : '';
    const toolbarHtml = (lang === 'json' || lang === 'xml')
      ? '<div class="res-body-toolbar js-res-body-toolbar" data-lang="' + lang + '">' +
          (lang === 'json'
            ? '<div class="toggle-group">' +
                '<button class="toggle-btn active" data-mode="tree">Tree</button>' +
                '<button class="toggle-btn" data-mode="raw">Raw</button>' +
              '</div>' +
              '<button class="tb-btn js-expand-all" title="Expand All">⊞ Expand</button>' +
              '<button class="tb-btn js-collapse-all" title="Collapse All">⊟ Collapse</button>'
            : '') +
          fmtMenuHtml +
        '</div>'
      : '';
    // 치환된 실제 URL 표시
    const resolvedUrlDisplay = tab.resolvedUrl
      ? '<div class="resolved-url js-resolved-url" title="클릭하여 복사">' + escapeHtml(tab.resolvedUrl) + '</div>'
      : '';
    resHtml =
      '<div class="response-meta">' +
        '<span class="status status-' + sc + 'xx">' + r.status + ' ' + escapeHtml(r.statusText) + '</span>' +
        '<span>' + r.time + ' ms</span><span>' + formatSize(r.size) + '</span>' +
        '<span style="flex:1"></span>' +
        (lang !== 'text' ? '<span style="font-size:9px;opacity:.5;text-transform:uppercase">' + lang + '</span>' : '') +
        '<button class="btn btn-s js-copy-response" title="Copy Response Body" style="padding:2px 8px;font-size:9px">$(copy) Copy</button>' +
        '<button class="btn btn-s js-save-response" title="Save Response Body" style="padding:2px 8px;font-size:9px">$(file-add) Save</button>' +
      '</div>' +
      resolvedUrlDisplay +
      '<div class="tabs js-res-tabs">' +
        '<div class="tab active" data-tab="resBody">Body</div>' +
        '<div class="tab" data-tab="resHeaders">Headers</div>' +
        (lang === 'html' ? '<div class="tab" data-tab="resPreview">Preview</div>' : '') +
      '</div>' +
      toolbarHtml +
      (lang === 'json' ? '<div class="json-tree js-res-tree js-res-body"></div>' : '') +
      '<div class="json-body js-res-raw js-res-body' + (lang === 'json' ? ' hidden' : '') + '">' + rawBodyHtml + '</div>' +
      '<div class="res-headers-pre hidden js-res-headers">' +
        (tab.resolvedHeaders && tab.resolvedHeaders.length
          ? '<div class="resolved-headers-section"><div class="resolved-headers-title">Request Headers (치환 후)</div><pre>' +
            escapeHtml(tab.resolvedHeaders.map(function(h) { return h.key + ': ' + h.value; }).join('\\n')) +
            '</pre></div><div class="resolved-headers-title" style="margin-top:8px">Response Headers</div>'
          : '') +
        '<pre>' + escapeHtml(hdrText) + '</pre>' +
      '</div>' +
      (lang === 'html' ? '<iframe class="res-preview hidden js-res-preview" sandbox="allow-same-origin" style="width:100%;flex:1;border:none;background:#fff"></iframe>' : '');
  } else {
    resHtml = '<div class="placeholder">Send a request to see the response</div>';
  }

  mainContent.innerHTML = envLine +
    '<div class="url-bar">' +
      '<select class="js-method">' +
        ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m =>
          '<option' + (m === tab.method ? ' selected' : '') + '>' + m + '</option>'
        ).join('') +
      '</select>' +
      '<div class="url-input-wrap">' +
        '<input class="js-url" type="text" placeholder="{{baseUrl}}/api/endpoint" spellcheck="false" value="' + escapeAttr(tab.url) + '"/>' +
        '<div class="var-overlay js-var-overlay hidden"></div>' +
      '</div>' +
      '<button class="btn js-send">Send</button>' +
      '<div class="timeout-wrap"><span class="timeout-icon">⏱</span><input class="js-timeout timeout-input" type="number" min="0" placeholder="30s" title="Timeout (초, 0=무제한)" value="' + (tab.timeout || '') + '"/></div>' +
      '<span class="url-bar-spacer"></span>' +
      '<button class="btn btn-s js-save">Save</button>' +
      '<button class="btn btn-s js-copy-curl" title="Copy as cURL">cURL</button>' +
    '</div>' +
    '<div class="split">' +
      '<div class="req-area">' +
        '<div class="tabs js-req-tabs">' +
          '<div class="tab active" data-tab="params">Params</div>' +
          '<div class="tab" data-tab="headers">Headers</div>' +
          '<div class="tab" data-tab="body">Body</div>' +
          '<div class="tab" data-tab="auth">Auth</div>' +
        '</div>' +
        '<div class="js-params-panel kv-section">' +
          '<div class="js-param-rows">' + kvRowsHtml(tab.params) + '</div>' +
          '<button class="add-btn js-add-param">+ Add Param</button>' +
        '</div>' +
        '<div class="js-headers-panel kv-section hidden">' +
          '<div class="js-header-rows">' + kvRowsHtml(tab.headers) + '</div>' +
          '<button class="add-btn js-add-header">+ Add Header</button>' +
        '</div>' +
        '<div class="js-body-panel body-section hidden">' +
          '<select class="js-body-type body-type-select">' +
            ['none','json','xml','form','raw'].map(function(t) {
              var label = { none:'None', json:'JSON', xml:'XML', form:'Form URL Encoded', raw:'Raw' }[t];
              return '<option value="' + t + '"' + (t === tab.bodyType ? ' selected' : '') + '>' + label + '</option>';
            }).join('') +
          '</select>' +
          '<textarea class="js-body" placeholder="{&quot;key&quot;: &quot;value&quot;}"' + (tab.bodyType === 'none' ? ' style="display:none"' : '') + '>' + escapeHtml(tab.body) + '</textarea>' +
        '</div>' +
        '<div class="js-auth-panel auth-section hidden">' +
          authHtml(tab.auth) +
        '</div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="req-progress js-req-progress' + (tab.loading && tab.progressVisible ? ' active' : '') + '"><div class="req-progress-bar"></div></div>' +
      '<div class="res-area' + (tab.response && tab.slideIn ? ' slide-in' : '') + '">' + resHtml + '</div>' +
    '</div>';

  // 이벤트 바인딩
  bindContentEvents();
}

function bindContentEvents() {
  const mc = mainContent;

  // 메서드 변경 시 탭 바 업데이트
  mc.querySelector('.js-method')?.addEventListener('change', (e) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.method = e.target.value; renderTabBar(); }
  });

  // URL 입력 → 미치환 변수 체크 + 자동 저장
  var urlInputEl = mc.querySelector('.js-url');
  if (urlInputEl) {
    urlInputEl.addEventListener('input', function() {
      checkUnresolvedVars();
      debouncePersist();
    });
    urlInputEl.addEventListener('scroll', function() {
      var ov = mc.querySelector('.js-var-overlay');
      if (ov) ov.scrollLeft = urlInputEl.scrollLeft;
    });
    // 초기 체크
    setTimeout(checkUnresolvedVars, 50);
  }

  // Send
  const sendBtn = mc.querySelector('.js-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab && tab.loading) {
        vscode.postMessage({ type: 'cancelRequest', tabId: tab.id });
      } else {
        sendActiveTab();
      }
    });
    // loading 상태면 Cancel 표시 (스피너 포함)
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.loading) {
      sendBtn.innerHTML = '<span class="spinner"></span>Cancel';
      sendBtn.classList.add('btn-cancel', 'btn-sending');
    }
  }

  // Save
  mc.querySelector('.js-save')?.addEventListener('click', () => {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'saveRequest', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, auth: tab.auth });
  });

  // Copy as cURL
  mc.querySelector('.js-copy-curl')?.addEventListener('click', () => {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'copyAsCurl', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, auth: tab.auth });
  });

  // Copy Response Body (포맷팅 적용 상태로 복사)
  mc.querySelector('.js-copy-response')?.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    var opts = getFormatOptions(mc);
    var body = tab.response.body;
    if (opts) {
      if (opts.lang === 'json') body = formatJson(body, opts.style, opts.indent);
      else if (opts.lang === 'xml') body = formatXml(body, opts.style, opts.indent);
    }
    vscode.postMessage({ type: 'copyResponseBody', body: body });
  });

  // 치환된 URL 클릭 → 클립보드 복사
  mc.querySelector('.js-resolved-url')?.addEventListener('click', (e) => {
    const el = e.currentTarget;
    const url = el.textContent;
    vscode.postMessage({ type: 'copyToClipboard', text: url });
    el.classList.add('copied');
    const orig = el.textContent;
    el.textContent = '✓ Copied!';
    setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1200);
  });

  // Save Response Body
  mc.querySelector('.js-save-response')?.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const ct = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '';
    vscode.postMessage({ type: 'saveResponseBody', body: tab.response.body, contentType: ct });
  });

  // 요청 탭 전환
  mc.querySelector('.js-req-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    mc.querySelectorAll('.js-req-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const panels = { params: '.js-params-panel', headers: '.js-headers-panel', body: '.js-body-panel', auth: '.js-auth-panel' };
    for (const [k, sel] of Object.entries(panels)) {
      mc.querySelector(sel)?.classList.toggle('hidden', k !== t.dataset.tab);
    }
  });

  // 응답 탭 전환 (Body / Headers / Preview)
  mc.querySelector('.js-res-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    mc.querySelectorAll('.js-res-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const sel = t.dataset.tab;
    const isBody = sel === 'resBody';
    const isPreview = sel === 'resPreview';
    mc.querySelectorAll('.js-res-body').forEach(el => el.classList.toggle('hidden', !isBody));
    mc.querySelector('.js-res-headers')?.classList.toggle('hidden', sel !== 'resHeaders');
    // Preview iframe 표시/숨김 + 최초 렌더링
    const preview = mc.querySelector('.js-res-preview');
    if (preview) {
      preview.classList.toggle('hidden', !isPreview);
      if (isPreview && !preview.dataset.loaded) {
        const tab = tabs.find(tt => tt.id === activeTabId);
        if (tab?.response?.body) {
          preview.srcdoc = tab.response.body;
          preview.dataset.loaded = '1';
        }
      }
    }
    // 툴바도 Body일 때만 표시
    const toolbar = mc.querySelector('.js-res-body-toolbar');
    if (toolbar) toolbar.classList.toggle('hidden', !isBody);
    // Tree/Raw 모드 복원
    if (isBody && toolbar) {
      const mode = toolbar.querySelector('.toggle-btn.active')?.dataset.mode || 'tree';
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) tree.classList.toggle('hidden', mode !== 'tree');
      if (raw) raw.classList.toggle('hidden', mode !== 'raw');
    }
  });

  // Tree/Raw 토글
  mc.querySelector('.js-res-body-toolbar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (btn) {
      mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) tree.classList.toggle('hidden', btn.dataset.mode !== 'tree');
      if (raw) raw.classList.toggle('hidden', btn.dataset.mode !== 'raw');
      // Expand/Collapse 버튼은 Tree 모드에서만 활성
      mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(b => b.style.display = btn.dataset.mode === 'tree' ? '' : 'none');
    }
  });

  // Expand All
  mc.querySelector('.js-expand-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.remove('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '▼'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.add('hidden'));
  });

  // Collapse All
  mc.querySelector('.js-collapse-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.add('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '▶'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.remove('hidden'));
  });

  // Format 드롭다운
  const fmtBtn = mc.querySelector('.js-fmt-btn');
  const fmtMenu = mc.querySelector('.js-fmt-menu');
  if (fmtBtn && fmtMenu) {
    fmtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fmtMenu.classList.toggle('open');
    });
    document.addEventListener('click', () => fmtMenu.classList.remove('open'));
    fmtMenu.addEventListener('click', (e) => { e.stopPropagation(); });

    // 스타일 선택
    fmtMenu.querySelectorAll('.js-fmt-style').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-style .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = '✓';
        applyFormat(mc);
      });
    });
    // 들여쓰기 선택
    fmtMenu.querySelectorAll('.js-fmt-indent').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-indent .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = '✓';
        applyFormat(mc);
      });
    });
  }

  // JSON 트리 초기 렌더링
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
  mc.querySelector('.js-add-param')?.addEventListener('click', () => addKvRow(mc.querySelector('.js-param-rows')));
  mc.querySelector('.js-add-header')?.addEventListener('click', () => addKvRow(mc.querySelector('.js-header-rows')));

  // KV 삭제 이벤트 위임
  mc.querySelectorAll('.js-param-rows, .js-header-rows').forEach(container => {
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('rm')) e.target.closest('.kv-row')?.remove();
    });
  });

  // Auth 타입 변경
  mc.querySelector('.js-auth-type')?.addEventListener('change', (e) => {
    const fields = mc.querySelector('.js-auth-fields');
    if (fields) fields.innerHTML = authFieldsHtml(e.target.value);
  });

  // Body 타입 변경 → Content-Type 자동 설정
  mc.querySelector('.js-body-type')?.addEventListener('change', (e) => {
    const bodyType = e.target.value;
    const textarea = mc.querySelector('.js-body');
    if (textarea) textarea.style.display = bodyType === 'none' ? 'none' : '';
    syncAutoContentType(mc, bodyType);
  });
  // 초기 렌더링 시 auto Content-Type 동기화
  var initBodyType = mc.querySelector('.js-body-type')?.value || 'none';
  if (initBodyType !== 'none') syncAutoContentType(mc, initBodyType);
}

var BODY_TYPE_CT = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  raw: 'text/plain',
};

function syncAutoContentType(mc, bodyType) {
  var headerRows = mc.querySelector('.js-header-rows');
  if (!headerRows) return;

  // 기존 auto Content-Type 행 제거
  headerRows.querySelectorAll('.kv-row[data-auto="content-type"]').forEach(function(r) { r.remove(); });

  var ct = BODY_TYPE_CT[bodyType];
  if (!ct) return; // none이면 추가하지 않음

  // 수동으로 Content-Type이 이미 있으면 추가하지 않음
  var hasManual = false;
  headerRows.querySelectorAll('.kv-row:not([data-auto])').forEach(function(row) {
    var keyInput = row.querySelectorAll('input[type="text"]')[0];
    if (keyInput && keyInput.value.toLowerCase() === 'content-type') hasManual = true;
  });
  if (hasManual) return;

  // auto 행 추가
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
  const mc = mainContent;

  // 1) Send 버튼 눌림 효과
  var sendBtn = mc.querySelector('.js-send');
  if (sendBtn) {
    sendBtn.classList.remove('btn-pressed');
    void sendBtn.offsetWidth;
    sendBtn.classList.add('btn-pressed');
  }

  // 2) URL 입력란 빛 줄기 sweep
  var urlWrap = mc.querySelector('.url-input-wrap');
  if (urlWrap) {
    urlWrap.classList.remove('sweep');
    void urlWrap.offsetWidth;
    urlWrap.classList.add('sweep');
    setTimeout(function() { urlWrap.classList.remove('sweep'); }, 350);
  }

  // auto Content-Type 포함한 전체 헤더 수집
  const allHeaders = collectAllKv(mc.querySelector('.js-header-rows'));
  tab.loading = true;
  tab.error = null;
  tab.progressVisible = false;
  tab.slideIn = false;
  tab.sendTime = Date.now();
  renderContent();

  // 3) 전송 중 네온 펄스 (renderContent 후 다시 쿼리)
  var urlInput = mc.querySelector('.js-url');
  if (urlInput) {
    urlInput.classList.add('neon-active');
  }

  // 3초 후 경과시간 실시간 표시 + 프로그레스 바
  var elapsedTimer = null;
  var progressTimer = setTimeout(function() {
    if (!tab.loading) return;
    tab.progressVisible = true;
    var bar = mc.querySelector('.js-req-progress');
    if (bar) bar.classList.add('active');
    // 경과시간 표시 시작
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
    method: tab.method, url: tab.url, headers: allHeaders, params: tab.params, body: tab.body, auth: tab.auth, timeout: tab.timeout,
  });
}

// === KV 행 ===
function kvRowsHtml(items) {
  return (items || []).map(kv =>
    '<div class="kv-row">' +
      '<input type="checkbox"' + (kv.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" placeholder="Key" value="' + escapeAttr(kv.key) + '"/>' +
      '<input type="text" placeholder="Value" value="' + escapeAttr(kv.value) + '"/>' +
      '<span class="rm" title="Remove">&times;</span>' +
    '</div>'
  ).join('');
}

function addKvRow(container, key, value) {
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" placeholder="Key" value="' + escapeAttr(key || '') + '"/>' +
    '<input type="text" placeholder="Value" value="' + escapeAttr(value || '') + '"/>' +
    '<span class="rm" title="Remove">&times;</span>';
  row.querySelector('.rm').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    if (row.dataset.auto) return; // auto 행 제외
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

// === Auth ===
function authHtml(auth) {
  const type = auth?.type || 'none';
  return '<select class="js-auth-type">' +
    ['none','basic','bearer','apikey'].map(t =>
      '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' +
      ({none:'No Auth',basic:'Basic Auth',bearer:'Bearer Token',apikey:'API Key'}[t]) + '</option>'
    ).join('') +
    '</select><div class="auth-fields js-auth-fields">' + authFieldsHtml(type, auth) + '</div>';
}

function authFieldsHtml(type, auth) {
  if (type === 'basic') {
    const u = auth?.basic?.username || '';
    const p = auth?.basic?.password || '';
    return '<div class="auth-row"><label>Username</label><input type="text" class="js-auth-user" value="' + escapeAttr(u) + '"/></div>' +
           '<div class="auth-row"><label>Password</label><input type="password" class="js-auth-pass" value="' + escapeAttr(p) + '"/></div>';
  }
  if (type === 'bearer') {
    const t = auth?.bearer?.token || '';
    return '<div class="auth-row"><label>Token</label><input type="text" class="js-auth-token" value="' + escapeAttr(t) + '"/></div>';
  }
  if (type === 'apikey') {
    const k = auth?.apikey?.key || '';
    const v = auth?.apikey?.value || '';
    const a = auth?.apikey?.addTo || 'header';
    return '<div class="auth-row"><label>Key</label><input type="text" class="js-auth-apikey" value="' + escapeAttr(k) + '"/></div>' +
           '<div class="auth-row"><label>Value</label><input type="text" class="js-auth-apival" value="' + escapeAttr(v) + '"/></div>' +
           '<div class="auth-row"><label>Add to</label><select class="js-auth-addto"><option value="header"' + (a==='header'?' selected':'') + '>Header</option><option value="query"' + (a==='query'?' selected':'') + '>Query</option></select></div>';
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

// === 환경변수 편집 ===
const envEditor = document.getElementById('envEditor');
const envEditorName = document.getElementById('envEditorName');
const envVarRows = document.getElementById('envVarRows');

document.getElementById('addEnvVarBtn').addEventListener('click', () => addKvRow(envVarRows));
document.getElementById('envCloseBtn').addEventListener('click', () => envEditor.classList.add('hidden'));
document.getElementById('envSaveBtn').addEventListener('click', () => {
  if (!editingEnvId) return;
  const vars = collectKv(envVarRows);
  vscode.postMessage({ type: 'saveEnvironmentVars', envId: editingEnvId, variables: vars });
});

envVarRows.addEventListener('click', (e) => {
  if (e.target.classList.contains('rm')) e.target.closest('.kv-row')?.remove();
});

// === 기본 헤더 편집 ===
const defaultHeadersEditor = document.getElementById('defaultHeadersEditor');
const defaultHeaderRows = document.getElementById('defaultHeaderRows');

document.getElementById('addDefaultHeaderBtn').addEventListener('click', () => addKvRow(defaultHeaderRows));
document.getElementById('defaultHeadersCloseBtn').addEventListener('click', () => defaultHeadersEditor.classList.add('hidden'));
document.getElementById('defaultHeadersSaveBtn').addEventListener('click', () => {
  const headers = collectKv(defaultHeaderRows);
  vscode.postMessage({ type: 'saveDefaultHeaders', headers: headers });
});
defaultHeaderRows.addEventListener('click', (e) => {
  if (e.target.classList.contains('rm')) e.target.closest('.kv-row')?.remove();
});

// === Extension → Webview 메시지 ===
window.addEventListener('message', (event) => {
  const msg = event.data;

  if (msg.type === 'receiveResponse' || msg.type === 'responseError') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    tab.loading = false;
    if (tab._progressTimer) { clearTimeout(tab._progressTimer); tab._progressTimer = null; }
    if (tab._elapsedTimer) { clearInterval(tab._elapsedTimer); tab._elapsedTimer = null; }
    tab.progressVisible = false;
    tab.slideIn = true;

    // 네온 펄스 제거
    var neonEl = mainContent.querySelector('.js-url.neon-active');
    if (neonEl) neonEl.classList.remove('neon-active');

    if (msg.type === 'receiveResponse') {
      tab.response = msg.response;
      tab.resolvedUrl = msg.resolvedUrl || '';
      tab.resolvedHeaders = msg.resolvedHeaders || [];
      tab.error = null;
    } else {
      tab.error = msg.error;
      tab.response = null;
    }
    if (activeTabId === msg.tabId) {
      renderContent();
      setTimeout(function() {
        var sc = tab.response ? Math.floor(tab.response.status / 100) : 0;
        var isError = (sc >= 4 || !tab.response);

        // 상태코드 배지 효과
        var badge = mainContent.querySelector('.status');
        if (badge) {
          badge.classList.add(isError ? 'flash-error' : 'flash-success');
        }

        // 4xx/5xx: 화면 전체 빨간색 번쩍
        if (isError && tab.response) {
          var flash = document.createElement('div');
          flash.className = 'screen-flash';
          document.body.appendChild(flash);
          setTimeout(function() { flash.remove(); }, 150);
        }

        // 빠른 응답 (100ms 이하): PERFECT!
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
    }
    // slide-in은 한 번만 적용
    setTimeout(function() { tab.slideIn = false; }, 300);
  }

  if (msg.type === 'newTab') {
    createTab();
  }

  if (msg.type === 'restoreTabState') {
    // 저장된 탭들 복원
    var restoreTabs = msg.tabs || [];
    var restoreIdx = msg.activeIndex || 0;
    if (restoreTabs.length > 0) {
      // 초기 빈 탭 제거 (탭이 1개이고 URL이 비어있으면)
      if (tabs.length === 1 && !tabs[0].url) {
        tabs.splice(0, 1);
      }
      for (var ri = 0; ri < restoreTabs.length; ri++) {
        createTab(restoreTabs[ri]);
      }
      // 활성 탭 복원
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
    // 새 탭으로 열기
    createTab({
      name: msg.name || msg.method + ' ' + msg.url,
      method: msg.method,
      url: msg.url,
      headers: msg.headers || [],
      params: msg.params || [],
      body: msg.body || '',
      auth: msg.auth || { type: 'none' },
    });
  }

  if (msg.type === 'loadEnvironment') {
    editingEnvId = msg.envId;
    envEditorName.textContent = msg.envName;
    envVarRows.innerHTML = kvRowsHtml(msg.variables || []);
    envEditor.classList.remove('hidden');
  }

  if (msg.type === 'loadDefaultHeaders') {
    defaultHeaderRows.innerHTML = kvRowsHtml(msg.headers || []);
    defaultHeadersEditor.classList.remove('hidden');
  }

  if (msg.type === 'updateActiveEnv') {
    currentEnvName = msg.envName;
    const ind = mainContent.querySelector('.env-indicator');
    if (ind) {
      if (currentEnvName) {
        ind.innerHTML = '<span class="var-name">{{env}}</span> = ' + escapeHtml(currentEnvName);
        ind.classList.remove('hidden');
      } else {
        ind.classList.add('hidden');
      }
    }
  }

  // === 컬렉션 러너 메시지 ===
  if (msg.type === 'runCollectionStart') {
    showRunner(msg.name, msg.total);
  }
  if (msg.type === 'runCollectionProgress') {
    updateRunnerRow(msg);
  }
  if (msg.type === 'runCollectionDone') {
    finishRunner(msg);
  }
});

// === 컬렉션 러너 UI ===
var runnerOverlay = null;
var runnerResults = [];

function showRunner(name, total) {
  runnerResults = [];
  // 오버레이 생성
  if (runnerOverlay) runnerOverlay.remove();
  runnerOverlay = document.createElement('div');
  runnerOverlay.className = 'runner-overlay';
  runnerOverlay.innerHTML =
    '<div class="runner-header">' +
      '<h3>Run: ' + escapeHtml(name) + '</h3>' +
      '<button class="btn btn-s js-runner-stop" style="padding:2px 10px;font-size:11px">Stop</button>' +
      '<button class="btn btn-s js-runner-close hidden" style="padding:2px 10px;font-size:11px">Close</button>' +
    '</div>' +
    '<div class="runner-progress">' +
      '<span class="js-runner-counter">0/' + total + '</span>' +
      '<div class="runner-bar"><div class="runner-bar-fill js-runner-bar" style="width:0%"></div></div>' +
      '<span class="spinner js-runner-spinner"></span>' +
    '</div>' +
    '<div class="runner-summary">' +
      '<span>Total: <b>' + total + '</b></span>' +
      '<span class="pass">Passed: <b class="js-runner-pass">0</b></span>' +
      '<span class="fail">Failed: <b class="js-runner-fail">0</b></span>' +
      '<span class="js-runner-time"></span>' +
    '</div>' +
    '<div class="runner-list js-runner-list"></div>';

  document.body.appendChild(runnerOverlay);

  // Stop 버튼
  runnerOverlay.querySelector('.js-runner-stop').addEventListener('click', function() {
    vscode.postMessage({ type: 'stopCollectionRun' });
    this.disabled = true;
    this.textContent = 'Stopping...';
  });
  // Close 버튼
  runnerOverlay.querySelector('.js-runner-close').addEventListener('click', function() {
    if (runnerOverlay) { runnerOverlay.remove(); runnerOverlay = null; }
  });
  // 행 클릭 이벤트 위임
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
      detail.textContent = 'Error: ' + r.error;
    } else if (r.response) {
      var body = r.response.body || '';
      if (body.length > 2000) body = body.substring(0, 2000) + '\\n... (truncated)';
      detail.textContent = 'Status: ' + r.response.status + ' ' + r.response.statusText +
        '\\nSize: ' + formatSize(r.response.size) + '\\n\\n' + body;
    }
    row.after(detail);
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

  // 결과 저장
  runnerResults[msg.index] = { error: msg.error, response: msg.response };

  // 프로그레스 업데이트
  var pct = Math.round(((msg.index + 1) / msg.total) * 100);
  runnerOverlay.querySelector('.js-runner-counter').textContent = (msg.index + 1) + '/' + msg.total;
  runnerOverlay.querySelector('.js-runner-bar').style.width = pct + '%';
  runnerOverlay.querySelector('.js-runner-pass').textContent = msg.passed;
  runnerOverlay.querySelector('.js-runner-fail').textContent = msg.failed;

  // 자동 스크롤
  list.scrollTop = list.scrollHeight;
}

function finishRunner(msg) {
  if (!runnerOverlay) return;
  // 스피너 제거
  var spinner = runnerOverlay.querySelector('.js-runner-spinner');
  if (spinner) spinner.remove();
  // Stop → Close 전환
  var stopBtn = runnerOverlay.querySelector('.js-runner-stop');
  if (stopBtn) stopBtn.classList.add('hidden');
  var closeBtn = runnerOverlay.querySelector('.js-runner-close');
  if (closeBtn) closeBtn.classList.remove('hidden');
  // 최종 시간 표시
  runnerOverlay.querySelector('.js-runner-time').textContent = 'Time: ' + msg.time + 'ms';
  // 바 100% (또는 중단 시 현재 값 유지)
  if (!msg.stopped) {
    runnerOverlay.querySelector('.js-runner-bar').style.width = '100%';
  }
}

// === JSON 트리 뷰 ===
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
      '<span class="jt-toggle">▼</span>' + keyHtml +
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

    // ellipsis 클릭 시 → 해당 행의 토글과 동일 동작
    const row = (toggle || ellipsis).closest('.jt-row');
    if (!row) return;
    const tgl = row.querySelector('.jt-toggle');
    if (!tgl || !tgl.textContent.trim()) return;

    const children = row.nextElementSibling;
    if (!children || !children.classList.contains('jt-children')) return;

    const collapsed = children.classList.toggle('collapsed');
    tgl.textContent = collapsed ? '▶' : '▼';
    const ell = row.querySelector('.jt-ellipsis');
    if (ell) ell.classList.toggle('hidden', !collapsed);
  });
}

// === Content-Type 감지 및 구문 하이라이팅 (highlight.js) ===
// hljs 언어 매핑
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

function highlightBody(body, lang) {
  // JSON은 pretty-print 후 하이라이팅 (_formatted_json이면 이미 포맷됨)
  if (lang === 'json') {
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch {}
  }
  var actualLang = lang === '_formatted_json' ? 'json' : lang;
  // hljs 사용 가능하면 라이브러리 하이라이팅
  if (typeof hljs !== 'undefined') {
    var hljsLang = hljsLangMap[actualLang] || 'plaintext';
    try {
      return hljs.highlight(body, { language: hljsLang }).value;
    } catch {}
  }
  // fallback: 단순 escape
  return escapeHtml(body);
}

// === Format 기능 (JSON + XML) ===
function getFormatOptions(mc) {
  var toolbar = mc.querySelector('.js-res-body-toolbar');
  if (!toolbar) return null;
  var styleEl = toolbar.querySelector('.js-fmt-style .check');
  var style = 'pretty';
  toolbar.querySelectorAll('.js-fmt-style').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === '✓') style = el.dataset.style;
  });
  var indent = '2';
  toolbar.querySelectorAll('.js-fmt-indent').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === '✓') indent = el.dataset.indent;
  });
  var indentStr = indent === 'tab' ? '\\t' : ' '.repeat(parseInt(indent));
  return { style: style, indent: indentStr, lang: toolbar.dataset.lang };
}

function applyFormat(mc) {
  var opts = getFormatOptions(mc);
  if (!opts) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return;
  var body = tab.response.body;
  var formatted;
  if (opts.lang === 'json') {
    formatted = formatJson(body, opts.style, opts.indent);
  } else if (opts.lang === 'xml') {
    formatted = formatXml(body, opts.style, opts.indent);
  } else {
    return;
  }
  // Raw 뷰 업데이트
  var rawEl = mc.querySelector('.js-res-raw');
  if (rawEl) rawEl.innerHTML = highlightBody(formatted, opts.lang === 'json' ? '_formatted_json' : 'xml');
  // JSON 트리도 재렌더링 (pretty에서는 의미 없지만 일관성 유지)
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
}

function formatJson(body, style, indent) {
  try {
    var parsed = JSON.parse(body);
    if (style === 'compact') return JSON.stringify(parsed);
    return JSON.stringify(parsed, null, indent);
  } catch { return body; }
}

// === XML 포맷터 (정규식 기반, 외부 라이브러리 없음) ===
function formatXml(xml, style, indent) {
  // 선행 공백/줄바꿈 정규화
  xml = xml.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');

  if (style === 'compact') {
    // 태그 사이의 공백/줄바꿈 제거
    return xml.replace(/>\\s+</g, '><').replace(/^\\s+|\\s+$/g, '');
  }

  // 토큰 분리: XML 선언, 주석, CDATA, 셀프클로징, 여는태그, 닫는태그, 텍스트
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
  // Inline Children: 자식이 텍스트 하나거나 자식이 하나뿐이면 한 줄로
  // 1단계: 트리 구조 파악 후 inline 판정
  var lines = [];
  var depth = 0;
  var i = 0;
  while (i < tokens.length) {
    var t = tokens[i];
    if (t.type === 'open') {
      // 다음 토큰이 텍스트+닫는태그 또는 단일 자식+닫는태그인지 확인
      if (i + 2 < tokens.length && tokens[i+1].type === 'text' && tokens[i+2].type === 'close') {
        // <tag>text</tag> → 한 줄
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      if (i + 3 < tokens.length && tokens[i+1].type === 'self' && tokens[i+2].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      // 자식이 하나 (open + text + close) 인 경우: <parent><child>text</child></parent>
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

// 미치환 변수 체크 (URL 입력란)
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
    // 스크롤 동기화
    overlay.scrollLeft = urlEl.scrollLeft;
  } else {
    overlay.innerHTML = '';
    overlay.classList.add('hidden');
  }
}

// 탭 상태를 Extension에 전송 (저장용)
function persistTabState() {
  saveActiveTabState();
  var tabData = tabs.map(function(t) {
    return { name: t.name, method: t.method, url: t.url, headers: t.headers, params: t.params, body: t.body, bodyType: t.bodyType, auth: t.auth, timeout: t.timeout };
  });
  var activeIdx = tabs.findIndex(function(t) { return t.id === activeTabId; });
  vscode.postMessage({ type: 'saveTabState', tabs: tabData, activeIndex: Math.max(0, activeIdx) });
}

// 탭 변경/전환/닫기 시 자동 저장 (디바운스)
var _persistTimer = null;
function debouncePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistTabState, 1000);
}

// 초기 상태: 빈 탭 하나 생성
createTab();

// webview 준비 신호 전송
vscode.postMessage({ type: 'webviewReady' });
</script>
<script src="${hljsUri}"></script>
</body>
</html>`;
  }
}
