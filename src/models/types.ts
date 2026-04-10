// HTTP 메서드 타입
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// 키-값 쌍 (헤더, 쿼리 파라미터 등)
export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

// 인증 타입
export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey';

// 요청 바디 타입
export type RequestBodyType = 'none' | 'json' | 'xml' | 'form' | 'raw' | 'text';

export interface AuthConfig {
  type: AuthType;
  basic?: { username: string; password: string };
  bearer?: { token: string };
  apikey?: { key: string; value: string; addTo: 'header' | 'query' };
}

// 탭 상태 (영속화용)
export interface TabState {
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  auth: AuthConfig;
  timeout: number;
  pinned?: boolean;
  requestId?: string;  // 컬렉션/히스토리 요청 ID (중복 탭 방지)
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
  auth: AuthConfig;
}

// HTTP 응답
export interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  rawSetCookies?: string[];  // Set-Cookie 헤더 원본 배열 (쉼표 join 하지 않은 개별 쿠키)
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

// 컬렉션 내 항목 (요청 또는 폴더)
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

// Webview ↔ Extension 메시지 타입
export enum MessageType {
  // Webview → Extension
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

  // Webview → Extension (응답 비교)
  CompareResponses = 'compareResponses',

  // Webview → Extension (컬렉션 러너)
  StopCollectionRun = 'stopCollectionRun',

  // Extension → Webview
  RestoreTabState = 'restoreTabState',
  ReceiveResponse = 'receiveResponse',
  ResponseError = 'responseError',
  LoadRequest = 'loadRequest',
  LoadEnvironment = 'loadEnvironment',
  UpdateActiveEnv = 'updateActiveEnv',
  LoadDefaultHeaders = 'loadDefaultHeaders',
  SaveRequestResult = 'saveRequestResult',
  SaveResponseBodyResult = 'saveResponseBodyResult',

  // Extension → Webview (컬렉션 러너)
  RunCollectionStart = 'runCollectionStart',
  RunCollectionProgress = 'runCollectionProgress',
  RunCollectionDone = 'runCollectionDone',
}

// Webview에서 Extension으로 보내는 메시지
export interface SendRequestMessage {
  type: MessageType.SendRequest;
  tabId: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  auth: AuthConfig;
  timeout?: number;
}

export interface SaveRequestMessage {
  type: MessageType.SaveRequest;
  requestId?: string;  // 기존 컬렉션 요청 ID (있으면 덮어쓰기, 없으면 새로 생성)
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  auth: AuthConfig;
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

export interface WebviewReadyMessage {
  type: 'webviewReady';
}

// Extension에서 Webview로 보내는 응답 메시지
export interface ReceiveResponseMessage {
  type: MessageType.ReceiveResponse;
  tabId: string;
  response: Response;
}

export interface ResponseErrorMessage {
  type: MessageType.ResponseError;
  tabId: string;
  error: string;
}

// Extension에서 Webview로 보내는 요청 로드 메시지
export interface LoadRequestMessage {
  type: MessageType.LoadRequest;
  requestId?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  auth: AuthConfig;
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
  | WebviewReadyMessage;

export type OutgoingWebviewMessage =
  | ReceiveResponseMessage
  | ResponseErrorMessage
  | LoadRequestMessage
  | LoadEnvironmentMessage
  | UpdateActiveEnvMessage;

export type WebviewMessage = IncomingWebviewMessage | OutgoingWebviewMessage;
