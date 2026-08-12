// HTTP 메서드 타입
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// 공통 키-값 구조
export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

/** Request-local path override. Presence of an entry means override is active (value may be empty). */
export interface PathVariableOverride {
  key: string;
  value: string;
}

// 인증 타입
export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey';

// 요청 바디 타입
export type RequestBodyType =
  | 'none'
  | 'json'
  | 'xml'
  | 'form'
  | 'formdata'
  | 'binary'
  | 'raw'
  | 'text';

export interface FormDataField {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  type: 'text' | 'file';
}

export interface RequestScripts {
  preRequest: string;
  test: string;
}

export type TlsValidationMode = 'default' | 'strict' | 'insecure';

export interface RequestSettings {
  timeout?: number;
  followRedirects?: boolean;
  saveToHistory?: boolean;
  tlsValidation?: TlsValidationMode;
  maxResponseSizeKb?: number;
  retryCount?: number;
  retryDelayMs?: number;
  stopAfterHeaders?: boolean;
  skipDefaultHeaders?: boolean;
  disableScripts?: boolean;
  scriptsTrusted?: boolean;
  webSocketKeepAliveEnabled?: boolean;
  webSocketKeepAliveIntervalSeconds?: number;
  webSocketKeepAliveMessage?: string;
}

export interface ScriptLogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
}

export interface ScriptTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ScriptExecutionResult {
  logs: ScriptLogEntry[];
  tests: ScriptTestResult[];
}

export interface AuthConfig {
  type: AuthType;
  basic?: { username: string; password: string };
  bearer?: { token: string };
  apikey?: { key: string; value: string; addTo: 'header' | 'query' };
}

// 탭 상태
export interface TabState {
  name: string;
  autoName?: boolean;
  requestType?: 'http' | 'websocket';
  requestEditorTab?: 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'settings';
  requestSplitHeightPx?: number;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  /** Optional request-local overrides for full path-segment `{{variables}}` only. */
  pathVariableOverrides?: PathVariableOverride[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  scripts?: RequestScripts;
  timeout: number;
  followRedirects?: boolean;
  saveToHistory?: boolean;
  tlsValidation?: TlsValidationMode;
  maxResponseSizeKb?: number;
  retryCount?: number;
  retryDelayMs?: number;
  stopAfterHeaders?: boolean;
  skipDefaultHeaders?: boolean;
  disableScripts?: boolean;
  scriptsTrusted?: boolean;
  webSocketKeepAliveEnabled?: boolean;
  webSocketKeepAliveIntervalSeconds?: number;
  webSocketKeepAliveMessage?: string;
  jsonFormatStyle?: 'pretty' | 'compact';
  xmlFormatStyle?: 'pretty' | 'compact' | 'inline';
  formatIndent?: '2' | '4' | 'tab';
  responseSearchQuery?: string;
  responseSearchIndex?: number;
  responseSearchCaseSensitive?: boolean;
  responseSearchRegex?: boolean;
  scriptHelpCollapsed?: boolean;
  requestStartedAt?: number;
  requestEndedAt?: number;
  durationMs?: number;
  pinned?: boolean;
  requestId?: string;
}

// HTTP 요청 정의
export interface Request extends RequestSettings {
  id: string;
  name: string;
  requestType?: 'http' | 'websocket';
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  /** Optional request-local overrides for full path-segment `{{variables}}` only. */
  pathVariableOverrides?: PathVariableOverride[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  scripts?: RequestScripts;
}

// HTTP 응답
export interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  rawSetCookies?: string[];
  body: string;
  bodyBase64?: string;
  time: number;
  size: number;
}

// 히스토리 항목
export interface HistoryEntry {
  id: string;
  request: Request;
  response: { status: number; statusText: string; time: number } | null;
  timestamp: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  pinned?: boolean;
}

// 컬렉션 아이템
export interface CollectionItem {
  id: string;
  type: 'request' | 'folder';
  name: string;
  request?: Request;
  children?: CollectionItem[];
}

// 컬렉션
export interface Collection {
  id: string;
  name: string;
  items: CollectionItem[];
}

// 환경변수
export interface Environment {
  id: string;
  name: string;
  variables: KeyValue[];
}

export type CodegenTarget = 'curl' | 'fetch' | 'axios' | 'java';
export type CompareMode = 'raw' | 'normalized' | 'pretty';

export interface CompareSettings {
  mode: CompareMode;
  includeMetadataSummary: boolean;
  foldUnchangedSections: boolean;
  ignoreHeaders: string[];
  ignoreJsonPaths: string[];
}

export interface StoredTabState {
  tabs: TabState[];
  activeIndex: number;
  compareSettings?: CompareSettings;
}

// Webview ↔ Extension 메시지 타입
export enum MessageType {
  // Webview -> Extension
  SendRequest = 'sendRequest',
  SaveRequest = 'saveRequest',
  SaveEnvironmentVars = 'saveEnvironmentVars',
  CopyAsCurl = 'copyAsCurl',
  CopyResponseBody = 'copyResponseBody',
  CopyToClipboard = 'copyToClipboard',
  SaveResponseBody = 'saveResponseBody',
  SaveDefaultHeaders = 'saveDefaultHeaders',
  CancelRequest = 'cancelRequest',
  SaveTabState = 'saveTabState',
  CompareResponses = 'compareResponses',
  StopCollectionRun = 'stopCollectionRun',
  StartCollectionRun = 'startCollectionRun',
  RerunFailedCollection = 'rerunFailedCollection',
  PickFile = 'pickFile',
  GenerateCode = 'generateCode',
  OpenDefaultHeaders = 'openDefaultHeaders',
  SwitchEnvironment = 'switchEnvironment',
  ChangeWorkspaceProfile = 'changeWorkspaceProfile',
  OpenResponseUrl = 'openResponseUrl',
  OpenGuide = 'openGuide',
  FlushedTabState = 'flushedTabState',
  WebSocketConnect = 'websocketConnect',
  WebSocketDisconnect = 'websocketDisconnect',
  WebSocketSend = 'websocketSend',

  // Extension -> Webview
  RestoreTabState = 'restoreTabState',
  ReceiveResponse = 'receiveResponse',
  ResponseError = 'responseError',
  RequestCanceled = 'requestCanceled',
  LoadRequest = 'loadRequest',
  LoadEnvironment = 'loadEnvironment',
  UpdateActiveEnv = 'updateActiveEnv',
  UpdateLocalization = 'updateLocalization',
  LoadDefaultHeaders = 'loadDefaultHeaders',
  SaveRequestResult = 'saveRequestResult',
  SaveResponseBodyResult = 'saveResponseBodyResult',
  PickFileResult = 'pickFileResult',
  FlushTabState = 'flushTabState',
  WebSocketStatus = 'websocketStatus',
  WebSocketMessage = 'websocketMessage',

  // 컬렉션 러너
  RunCollectionStart = 'runCollectionStart',
  RunCollectionProgress = 'runCollectionProgress',
  RunCollectionDone = 'runCollectionDone',
  ConfigureCollectionRun = 'configureCollectionRun',
}

export interface SendRequestMessage extends RequestSettings {
  type: MessageType.SendRequest;
  tabId: string;
  requestStartedAt?: number;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  pathVariableOverrides?: PathVariableOverride[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  scripts?: RequestScripts;
}

export interface SaveRequestMessage extends RequestSettings {
  type: MessageType.SaveRequest;
  requestId?: string;
  requestType?: 'http' | 'websocket';
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  pathVariableOverrides?: PathVariableOverride[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  scripts?: RequestScripts;
}

export interface SaveEnvironmentVarsMessage {
  type: MessageType.SaveEnvironmentVars;
  envId: string;
  variables: KeyValue[];
}

export interface CopyAsCurlMessage {
  type: MessageType.CopyAsCurl;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  pathVariableOverrides?: PathVariableOverride[];
  body: string;
  bodyType?: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  skipDefaultHeaders?: boolean;
}

export interface CopyResponseBodyMessage {
  type: MessageType.CopyResponseBody;
  body: string;
}

export interface CopyToClipboardMessage {
  type: MessageType.CopyToClipboard;
  text: string;
}

export interface SaveResponseBodyMessage {
  type: MessageType.SaveResponseBody;
  body: string;
  bodyBase64?: string;
  contentType: string;
}

export interface SaveDefaultHeadersMessage {
  type: MessageType.SaveDefaultHeaders;
  headers: KeyValue[];
}

export interface CancelRequestMessage {
  type: MessageType.CancelRequest;
  tabId: string;
}

export interface SaveTabStateMessage {
  type: MessageType.SaveTabState;
  tabs: TabState[];
  activeIndex: number;
  compareSettings?: CompareSettings;
}

export interface CompareResponsesMessage {
  type: MessageType.CompareResponses;
  left: {
    label: string;
    body: string;
    bodyBase64?: string;
    contentType: string;
    status?: number;
    statusText?: string;
    size?: number;
    time?: number;
    resolvedUrl?: string;
    headers?: Record<string, string>;
    timestamp?: number;
    jsonFormatStyle?: 'pretty' | 'compact';
    xmlFormatStyle?: 'pretty' | 'compact' | 'inline';
    formatIndent?: '2' | '4' | 'tab';
  };
  right: {
    label: string;
    body: string;
    bodyBase64?: string;
    contentType: string;
    status?: number;
    statusText?: string;
    size?: number;
    time?: number;
    resolvedUrl?: string;
    headers?: Record<string, string>;
    timestamp?: number;
    jsonFormatStyle?: 'pretty' | 'compact';
    xmlFormatStyle?: 'pretty' | 'compact' | 'inline';
    formatIndent?: '2' | '4' | 'tab';
  };
  options?: CompareSettings;
}

export interface StopCollectionRunMessage {
  type: MessageType.StopCollectionRun;
}

export interface StartCollectionRunMessage {
  type: MessageType.StartCollectionRun;
  delayMs?: number;
  iterations?: number;
  stopOnFailure?: boolean;
  /** CollectionItem.id values selected for this run only. */
  selectedRequestIds?: string[];
}

export interface CollectionRunRequestChoice {
  id: string;
  name: string;
  method: string;
  folderPath?: string;
}

export interface RerunFailedCollectionMessage {
  type: MessageType.RerunFailedCollection;
  failedIndices: number[];
}

export interface PickFileMessage {
  type: MessageType.PickFile;
  target: 'binary' | 'formdata';
  rowId?: string;
}

export interface GenerateCodeMessage {
  type: MessageType.GenerateCode;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  pathVariableOverrides?: PathVariableOverride[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  skipDefaultHeaders?: boolean;
}

export interface OpenDefaultHeadersMessage {
  type: MessageType.OpenDefaultHeaders;
}

export interface OpenResponseUrlMessage {
  type: MessageType.OpenResponseUrl;
  url: string;
}

export interface ChangeWorkspaceProfileMessage {
  type: MessageType.ChangeWorkspaceProfile;
}

export interface OpenGuideMessage {
  type: MessageType.OpenGuide;
}

export interface WebviewReadyMessage {
  type: 'webviewReady';
}

export interface FlushedTabStateMessage {
  type: MessageType.FlushedTabState;
}

export interface RestoreTabStateMessage {
  type: MessageType.RestoreTabState;
  tabs: TabState[];
  activeIndex: number;
  compareSettings?: CompareSettings;
}

export interface SwitchEnvironmentMessage {
  type: MessageType.SwitchEnvironment;
}

export interface ReceiveResponseMessage {
  type: MessageType.ReceiveResponse;
  tabId: string;
  response: Response;
  resolvedUrl?: string;
  resolvedHeaders?: Array<{ key: string; value: string }>;
  scriptResults?: ScriptExecutionResult;
  requestStartedAt?: number;
  requestEndedAt?: number;
  durationMs?: number;
}

export interface WebSocketConnectMessage extends RequestSettings {
  type: MessageType.WebSocketConnect;
  tabId: string;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  pathVariableOverrides?: PathVariableOverride[];
  auth: AuthConfig;
}

export interface WebSocketDisconnectMessage {
  type: MessageType.WebSocketDisconnect;
  tabId: string;
}

export interface WebSocketSendMessage {
  type: MessageType.WebSocketSend;
  tabId: string;
  message: string;
}

export interface ResponseErrorMessage {
  type: MessageType.ResponseError;
  tabId: string;
  error: string;
  requestStartedAt?: number;
  requestEndedAt?: number;
  durationMs?: number;
}

export interface RequestCanceledMessage {
  type: MessageType.RequestCanceled;
  tabId: string;
  requestStartedAt?: number;
  requestEndedAt?: number;
  durationMs?: number;
}

export interface LoadRequestMessage extends RequestSettings {
  type: MessageType.LoadRequest;
  requestId?: string;
  requestType?: 'http' | 'websocket';
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  pathVariableOverrides?: PathVariableOverride[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  scripts?: RequestScripts;
  name: string;
}

export interface LoadEnvironmentMessage {
  type: MessageType.LoadEnvironment;
  envId: string;
  envName: string;
  variables: KeyValue[];
}

export interface UpdateActiveEnvMessage {
  type: MessageType.UpdateActiveEnv;
  envId?: string | null;
  envName: string | null;
  variables?: KeyValue[];
  profileName?: string;
}

export interface UpdateLocalizationMessage {
  type: MessageType.UpdateLocalization;
  displayLanguage: string;
  strings: Record<string, string>;
  dateLocale: string;
  requestPanelTheme?: string;
}

export interface LoadDefaultHeadersMessage {
  type: MessageType.LoadDefaultHeaders;
  headers: KeyValue[];
  reveal?: boolean;
}

export interface PickFileResultMessage {
  type: MessageType.PickFileResult;
  target: 'binary' | 'formdata';
  rowId?: string;
  filePath?: string;
}

export interface FlushTabStateMessage {
  type: MessageType.FlushTabState;
}

export interface WebSocketStatusMessage {
  type: MessageType.WebSocketStatus;
  tabId: string;
  status: 'connecting' | 'open' | 'closed' | 'error';
  error?: string;
  errorDetail?: string;
  code?: number;
  reason?: string;
  wasClean?: boolean;
  closeSource?: 'user' | 'remote' | 'unexpected';
}

export interface WebSocketDataMessage {
  type: MessageType.WebSocketMessage;
  tabId: string;
  direction: 'in' | 'out';
  messageType: 'text' | 'binary' | 'system';
  data: string;
  size?: number;
  timestamp: number;
}

export interface ConfigureCollectionRunMessage {
  type: MessageType.ConfigureCollectionRun;
  name: string;
  total: number;
  requests?: CollectionRunRequestChoice[];
  options?: {
    delayMs?: number;
    iterations?: number;
    stopOnFailure?: boolean;
  };
}

export type IncomingWebviewMessage =
  | SendRequestMessage
  | SaveRequestMessage
  | SaveEnvironmentVarsMessage
  | CopyAsCurlMessage
  | CopyResponseBodyMessage
  | CopyToClipboardMessage
  | SaveResponseBodyMessage
  | SaveDefaultHeadersMessage
  | CancelRequestMessage
  | SaveTabStateMessage
  | CompareResponsesMessage
  | StopCollectionRunMessage
  | StartCollectionRunMessage
  | RerunFailedCollectionMessage
  | PickFileMessage
  | GenerateCodeMessage
  | OpenDefaultHeadersMessage
  | SwitchEnvironmentMessage
  | ChangeWorkspaceProfileMessage
  | OpenResponseUrlMessage
  | OpenGuideMessage
  | FlushedTabStateMessage
  | WebSocketConnectMessage
  | WebSocketDisconnectMessage
  | WebSocketSendMessage
  | WebviewReadyMessage;

export type OutgoingWebviewMessage =
  | RestoreTabStateMessage
  | ReceiveResponseMessage
  | ResponseErrorMessage
  | RequestCanceledMessage
  | LoadRequestMessage
  | LoadEnvironmentMessage
  | UpdateActiveEnvMessage
  | UpdateLocalizationMessage
  | LoadDefaultHeadersMessage
  | PickFileResultMessage
  | FlushTabStateMessage
  | WebSocketStatusMessage
  | WebSocketDataMessage
  | ConfigureCollectionRunMessage;

export type WebviewMessage = IncomingWebviewMessage | OutgoingWebviewMessage;
