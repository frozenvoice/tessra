import { KeyValue, Request, RequestSettings } from '../../models/types';
import { LocalizationService } from '../../services/LocalizationService';
import { PathVariableService } from '../../services/PathVariableService';
import { SecretRedactor, SecretVariableError } from '../../services/secretVariables';
import { ResolvedSecretVariables } from '../../services/SecretVariableService';
import { ExecutionContext } from './executionContext';
import { createEmptyScripts, normalizeRequestSettings } from './requestUtils';

export interface SecretExecutionHost {
  resolveSecretVariables?(
    context: ExecutionContext, variables: KeyValue[], texts: string[], scriptsAll: boolean
  ): Promise<ResolvedSecretVariables>;
}

export function requestVariableTexts(request: Pick<Request, 'url' | 'headers' | 'params' | 'body' | 'bodyType' | 'auth' | 'formData' | 'binaryFilePath' | 'pathVariableOverrides'>, defaults: KeyValue[]): string[] {
  const texts = [PathVariableService.applyOverridesToUrl(request.url, request.pathVariableOverrides)];
  const append = (rows: Array<{ key: string; value: string; enabled: boolean }>) => {
    for (const row of rows) { if (row.enabled !== false && row.key) { texts.push(row.key, row.value); } }
  };
  append(request.headers);
  append(request.params);
  const explicit = new Set(request.headers.filter((row) => row.enabled !== false && row.key).map((row) => row.key.toLowerCase()));
  append(defaults.filter((row) => !explicit.has(row.key.toLowerCase())));
  if (request.bodyType !== 'none' && request.bodyType !== 'formdata' && request.bodyType !== 'binary') { texts.push(request.body); }
  if (request.bodyType === 'formdata') { append(request.formData ?? []); }
  if (request.bodyType === 'binary') { texts.push(request.binaryFilePath ?? ''); }
  for (const override of PathVariableService.pruneOverrides(request.url, request.pathVariableOverrides)) { texts.push(override.value); }
  const auth = request.auth;
  if (auth.type === 'basic' && auth.basic) { texts.push(auth.basic.username, auth.basic.password); }
  if (auth.type === 'bearer' && auth.bearer) { texts.push(auth.bearer.token); }
  if (auth.type === 'apikey' && auth.apikey) { texts.push(auth.apikey.key, auth.apikey.value); }
  return texts;
}

export function secretDiagnostic(error: unknown, redactor = new SecretRedactor([])): string {
  if (error instanceof SecretVariableError) {
    return LocalizationService.t('secret.error.' + error.code, { key: error.variableKey });
  }
  return redactor.mask(error instanceof Error ? error.message : String(error));
}

// 실제 통신 데이터는 그대로 둔다. 앱이 생성하는 저장 스냅샷만 변수 참조를 보존한다.
export function createSecretHistorySnapshot(
  template: Omit<Request, 'id' | 'name'>, defaults: KeyValue[], settings: RequestSettings, redactor: SecretRedactor
): Request {
  const explicit = new Set(template.headers.filter((row) => row.enabled !== false && row.key).map((row) => row.key.toLowerCase()));
  const preserve = (text: string) => redactor.preserveReferences(text);
  const rows = (items: KeyValue[]) => items.filter((row) => row.key)
    .map((row) => ({ key: preserve(row.key), value: preserve(row.value), enabled: row.enabled }));
  const auth = template.auth.type === 'basic'
    ? { type: 'basic' as const, basic: { username: preserve(template.auth.basic?.username ?? ''), password: preserve(template.auth.basic?.password ?? '') } }
    : template.auth.type === 'bearer'
      ? { type: 'bearer' as const, bearer: { token: preserve(template.auth.bearer?.token ?? '') } }
      : template.auth.type === 'apikey'
        ? { type: 'apikey' as const, apikey: { key: preserve(template.auth.apikey?.key ?? ''), value: preserve(template.auth.apikey?.value ?? ''),
          addTo: template.auth.apikey?.addTo === 'query' ? 'query' as const : 'header' as const } }
        : { type: 'none' as const };
  const normalizedSettings = normalizeRequestSettings(settings);
  return {
    id: '',
    name: `${template.method} ${preserve(template.url)}`,
    requestType: template.requestType,
    method: template.method,
    url: preserve(template.url),
    headers: rows([...defaults.filter((row) => row.enabled !== false && row.key && !explicit.has(row.key.toLowerCase())), ...template.headers]),
    params: rows(template.params),
    pathVariableOverrides: template.pathVariableOverrides?.map((override) => ({ key: override.key, value: preserve(override.value) })),
    body: preserve(template.body),
    bodyType: template.bodyType,
    formData: template.formData?.map((field) => ({ id: field.id, type: field.type, enabled: field.enabled, key: preserve(field.key), value: preserve(field.value) })),
    binaryFilePath: preserve(template.binaryFilePath ?? ''),
    auth,
    scripts: createEmptyScripts(),
    ...normalizedSettings,
    webSocketKeepAliveMessage: preserve(normalizedSettings.webSocketKeepAliveMessage),
  };
}

// 다음 Runner 항목까지 키체인 값을 캐시하지 않는다. script의 비밀 행 수정/삭제는 편집기로 제한한다.
export function reprotectScriptVariables(variables: KeyValue[], original: KeyValue[], redactor: SecretRedactor): KeyValue[] {
  const protectedByKey = new Map(original.filter((row) => row.secretRef || row.secretPendingRef).map((row) => [row.key, row]));
  const next = variables.filter((row) => !protectedByKey.has(row.key))
    .map((row) => ({ ...row, value: redactor.preserveReferences(row.value) }));
  // 같은 이름의 평문/disabled 행도 함께 유지해 마지막 enabled 행의 치환 우선순위가 바뀌지 않게 한다.
  for (const row of original) { if (protectedByKey.has(row.key)) { next.push({ ...row }); } }
  return next;
}

export function previewVariables(variables: KeyValue[]): KeyValue[] {
  return variables.map((row) => ({ key: row.key, enabled: row.enabled, value: row.secretRef || row.secretPendingRef ? '[secret]' : row.value }));
}
