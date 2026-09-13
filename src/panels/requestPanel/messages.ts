import { IncomingWebviewMessage, MessageType } from '../../models/types';

export const INCOMING_WEBVIEW_MESSAGE_TYPES = new Set<string>([
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
  MessageType.UpdateTabDraft,
  MessageType.CompareResponses,
  MessageType.StopCollectionRun,
  MessageType.StartCollectionRun,
  MessageType.RerunFailedCollection,
  MessageType.PickFile,
  MessageType.GenerateCode,
  MessageType.OpenDefaultHeaders,
  MessageType.SwitchEnvironment,
  MessageType.ChangeWorkspaceProfile,
  MessageType.OpenResponseUrl,
  MessageType.OpenGuide,
  MessageType.FlushedTabState,
  MessageType.WebSocketConnect,
  MessageType.WebSocketDisconnect,
  MessageType.WebSocketSend,
  'webviewReady',
]);

export function isIncomingWebviewMessage(value: unknown): value is IncomingWebviewMessage {
  if (!value || typeof value !== 'object') { return false; }
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && INCOMING_WEBVIEW_MESSAGE_TYPES.has(type);
}

export function shouldQueueWebviewMessage(message: unknown): boolean {
  if (!message || typeof message !== 'object') { return false; }
  return typeof (message as { type?: unknown }).type === 'string';
}
