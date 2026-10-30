import { randomUUID } from 'crypto';
import { KeyValue } from '../models/types';

export interface SecretVariableScope {
  profileName: string;
  profileId: string;
  environmentId: string | null;
}

export type SecretVariableErrorCode = 'invalid-id' | 'not-found' | 'conversion-pending' | 'missing' | 'unavailable' | 'verification-failed' | 'conflict';

export class SecretVariableError extends Error {
  constructor(public readonly code: SecretVariableErrorCode, public readonly variableKey = '') {
    // 키체인 오류 원문에는 값이 포함될 수 있으므로 전달하지 않는다.
    super(`Secret variable ${code}${variableKey ? `: ${variableKey}` : ''}`);
    this.name = 'SecretVariableError';
  }
}

export function isSecretId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function secretStorageKey(scope: SecretVariableScope, variable: KeyValue, referenceId: string): string {
  if (!isSecretId(scope.profileId) || !isSecretId(variable.id) || !isSecretId(referenceId)
    || (scope.environmentId !== null && (typeof scope.environmentId !== 'string' || !scope.environmentId || scope.environmentId.length > 512))) {
    throw new SecretVariableError('invalid-id', variable.key);
  }
  const owner = scope.environmentId === null ? 'workspace' : `environment/${encodeURIComponent(scope.environmentId)}`;
  return `tessra.secret.v1/${scope.profileId}/${owner}/${variable.id}/${referenceId}`;
}

/** 내보내기에는 진행 중 변환 원문과 비밀값을 넣지 않는다. */
export function sanitizeSecretVariables(variables: KeyValue[]): KeyValue[] {
  return variables.map((variable) => {
    const result: KeyValue = { key: variable.key, value: variable.value, enabled: variable.enabled };
    if (variable.id) { result.id = variable.id; }
    if (variable.secretRef || variable.secretPendingRef) {
      result.value = '';
      result.secretRef = { id: (variable.secretPendingRef ?? variable.secretRef)!.id };
    }
    return result;
  });
}

/** 가져온 참조는 이 설치의 기존 키체인 항목에 자동 연결하지 않는다. */
export function importSecretVariables(variables: KeyValue[]): KeyValue[] {
  return sanitizeSecretVariables(variables).map((variable) => variable.secretRef
    ? { ...variable, id: isSecretId(variable.id) ? variable.id : randomUUID(), secretRef: { id: randomUUID() }, value: '' }
    : { ...variable });
}

/** 저장 JSON과 사용자 backup 파일에 동일한 참조 직렬화 경계를 적용한다. */
export function stringifySecretReferences(data: unknown): string {
  return JSON.stringify(data, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && value.secretRef && !value.secretPendingRef) {
      return { ...value, value: undefined };
    }
    return value;
  }, 2) ?? 'null';
}

export class SecretRedactor {
  private readonly replacements: Array<{ value: string; reference: string }>;
  private readonly pattern: RegExp | null;
  private readonly references: Map<string, string>;
  private readonly secretUsage: boolean;

  get hasSecrets(): boolean { return this.secretUsage; }

  constructor(values: Array<{ key: string; value: string }>) {
    this.secretUsage = values.length > 0;
    const entries = new Map<string, string>();
    for (const secret of values) {
      if (!secret.value) { continue; }
      const reference = `{{${secret.key}}}`;
      const forms = [secret.value, Buffer.from(secret.value).toString('base64'), JSON.stringify(secret.value).slice(1, -1)];
      try { forms.push(encodeURIComponent(secret.value), encodeURI(secret.value)); }
      catch { /* 잘못된 surrogate도 실제 문자열 마스킹은 유지한다. */ }
      for (const value of forms) { if (value && !entries.has(value)) { entries.set(value, reference); } }
    }
    this.replacements = Array.from(entries, ([value, reference]) => ({ value, reference })).sort((a, b) => b.value.length - a.value.length);
    this.references = entries;
    this.pattern = this.replacements.length
      ? new RegExp(this.replacements.map((entry) => entry.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
      : null;
  }

  mask(text: string): string { return this.replace(text, false); }
  preserveReferences(text: string): string { return this.replace(text, true); }

  private replace(text: string, references: boolean): string {
    const source = String(text ?? '');
    if (!this.pattern) { return source; }
    // 한 번만 치환해 생성한 변수 참조를 다시 처리하지 않는다.
    return source.replace(this.pattern, (value) => references ? this.references.get(value)! : '[secret]');
  }

  /** 요청 생성 데이터/진단용. 서버 응답을 이 경로에 넣지 않는다. */
  map<T>(value: T, mode: 'mask' | 'references' = 'mask'): T {
    const visit = (item: unknown): unknown => {
      if (typeof item === 'string') { return mode === 'references' ? this.preserveReferences(item) : this.mask(item); }
      if (Array.isArray(item)) { return item.map(visit); }
      if (item && typeof item === 'object') {
        return Object.fromEntries(Object.entries(item).map(([key, child]) => [mode === 'references' ? this.preserveReferences(key) : this.mask(key), visit(child)]));
      }
      return item;
    };
    return visit(value) as T;
  }
}
