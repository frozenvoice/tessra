// HTTP 메서드 타입
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// 공통 키-값 구조
export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
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
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  scripts?: RequestScripts;
  timeout: number;
  pinned?: boolean;
  requestId?: string;
}

// HTTP 요청 정의
export interface Request {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
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
  PickFile = 'pickFile',
  GenerateCode = 'generateCode',

  // Extension -> Webview
  RestoreTabState = 'restoreTabState',
  ReceiveResponse = 'receiveResponse',
  ResponseError = 'responseError',
  RequestCanceled = 'requestCanceled',
  LoadRequest = 'loadRequest',
  LoadEnvironment = 'loadEnvironment',
  UpdateActiveEnv = 'updateActiveEnv',
  LoadDefaultHeaders = 'loadDefaultHeaders',
  SaveRequestResult = 'saveRequestResult',
  SaveResponseBodyResult = 'saveResponseBodyResult',
  PickFileResult = 'pickFileResult',

  // 컬렉션 러너
  RunCollectionStart = 'runCollectionStart',
  RunCollectionProgress = 'runCollectionProgress',
  RunCollectionDone = 'runCollectionDone',
}

export interface SendRequestMessage {
  type: MessageType.SendRequest;
  tabId: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
  scripts?: RequestScripts;
  timeout?: number;
}

export interface SaveRequestMessage {
  type: MessageType.SaveRequest;
  requestId?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
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
  body: string;
  bodyType?: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
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
}

export interface CompareResponsesMessage {
  type: MessageType.CompareResponses;
  left: { label: string; body: string; contentType: string; formatted?: boolean };
  right: { label: string; body: string; contentType: string; formatted?: boolean };
}

export interface StopCollectionRunMessage {
  type: MessageType.StopCollectionRun;
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
  body: string;
  bodyType: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth: AuthConfig;
}

export interface WebviewReadyMessage {
  type: 'webviewReady';
}

export interface ReceiveResponseMessage {
  type: MessageType.ReceiveResponse;
  tabId: string;
  response: Response;
  resolvedUrl?: string;
  resolvedHeaders?: Array<{ key: string; value: string }>;
  scriptResults?: ScriptExecutionResult;
}

export interface ResponseErrorMessage {
  type: MessageType.ResponseError;
  tabId: string;
  error: string;
}

export interface RequestCanceledMessage {
  type: MessageType.RequestCanceled;
  tabId: string;
}

export interface LoadRequestMessage {
  type: MessageType.LoadRequest;
  requestId?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
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
  envName: string | null;
}

export interface PickFileResultMessage {
  type: MessageType.PickFileResult;
  target: 'binary' | 'formdata';
  rowId?: string;
  filePath?: string;
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
  | PickFileMessage
  | GenerateCodeMessage
  | WebviewReadyMessage;

export type OutgoingWebviewMessage =
  | ReceiveResponseMessage
  | ResponseErrorMessage
  | RequestCanceledMessage
  | LoadRequestMessage
  | LoadEnvironmentMessage
  | UpdateActiveEnvMessage
  | PickFileResultMessage;

export type WebviewMessage = IncomingWebviewMessage | OutgoingWebviewMessage;
