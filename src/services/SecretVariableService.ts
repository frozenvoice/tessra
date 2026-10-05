import { randomUUID } from 'crypto';
import { KeyValue } from '../models/types';
import { SecretRedactor, SecretVariableError, SecretVariableScope, secretStorageKey, isSecretId } from './secretVariables';

export interface SecretVariableStorage {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
}

export interface SecretVariableRepository {
  getVariables(scope: SecretVariableScope): KeyValue[];
  compareAndSave(scope: SecretVariableScope, expected: KeyValue[], next: KeyValue[]): void;
}

export interface SecretVariableView extends KeyValue {
  secretState?: 'set' | 'missing' | 'unavailable' | 'pending';
}

export interface ResolvedSecretVariables {
  variables: KeyValue[];
  redactor: SecretRedactor;
}

export interface ResolveSecretVariableOptions {
  scriptsAll?: boolean;
  /** 확장 호스트에서만 제공하는 실행 시작 시점/러너 스크립트 상태 snapshot. */
  variables?: KeyValue[];
}

/** JSON 교체와 키체인 쓰기는 별도 트랜잭션이다. 진행 표식으로 중단 복구를 제공한다. */
export class SecretVariableService {
  private readonly mutations = new Map<string, Promise<void>>();
  constructor(private readonly secrets: SecretVariableStorage, private readonly repository: SecretVariableRepository) {}

  convert(scope: SecretVariableScope, variableId: string): Promise<void> {
    return this.serialize(scope, variableId, () => this.convertNow(scope, variableId));
  }

  resumeConversion(scope: SecretVariableScope, variableId: string): Promise<void> {
    return this.serialize(scope, variableId, () => this.resumeConversionNow(scope, variableId));
  }

  cancelConversion(scope: SecretVariableScope, variableId: string): Promise<void> {
    return this.serialize(scope, variableId, () => this.cancelConversionNow(scope, variableId));
  }

  replace(scope: SecretVariableScope, variableId: string, value: string): Promise<void> {
    return this.serialize(scope, variableId, () => this.replaceNow(scope, variableId, value));
  }

  remove(scope: SecretVariableScope, variableId: string): Promise<void> {
    return this.serialize(scope, variableId, () => this.removeNow(scope, variableId));
  }

  private async convertNow(scope: SecretVariableScope, variableId: string): Promise<void> {
    const { variables, variable, index } = this.read(scope, variableId);
    if (variable.secretPendingRef) { throw new SecretVariableError('conversion-pending', variable.key); }
    if (variable.secretRef) { return; }
    const next = variables.map((entry) => ({ ...entry }));
    next[index] = { ...variable, secretPendingRef: { id: randomUUID() } };
    secretStorageKey(scope, next[index], next[index].secretPendingRef!.id);
    // 원본을 지우기 전에 복구 표식을 실제 디스크에 저장한다.
    this.save(scope, variables, next, variable.key);
    await this.resumeConversionNow(scope, variableId);
  }

  private async resumeConversionNow(scope: SecretVariableScope, variableId: string): Promise<void> {
    const { variables, variable, index } = this.read(scope, variableId);
    if (!variable.secretPendingRef) { throw new SecretVariableError('not-found', variable.key); }
    if (variable.secretRef) { throw new SecretVariableError('conversion-pending', variable.key); }
    const key = secretStorageKey(scope, variable, variable.secretPendingRef.id);
    await this.storeVerified(key, variable.value, variable.key);
    const next = variables.map((entry) => ({ ...entry }));
    next[index] = { ...variable, value: '', secretRef: { ...variable.secretPendingRef } };
    delete next[index].secretPendingRef;
    this.save(scope, variables, next, variable.key);
  }

  private async cancelConversionNow(scope: SecretVariableScope, variableId: string): Promise<void> {
    const { variables, variable, index } = this.read(scope, variableId);
    if (!variable.secretPendingRef || variable.secretRef) { throw new SecretVariableError('not-found', variable.key); }
    await this.deleteExact(secretStorageKey(scope, variable, variable.secretPendingRef.id), variable.key);
    const next = variables.map((entry) => ({ ...entry }));
    next[index] = { ...variable };
    delete next[index].secretPendingRef;
    this.save(scope, variables, next, variable.key);
  }

  private async replaceNow(scope: SecretVariableScope, variableId: string, value: string): Promise<void> {
    const { variables, variable, index } = this.read(scope, variableId);
    if (variable.secretPendingRef) { throw new SecretVariableError('conversion-pending', variable.key); }
    if (!variable.secretRef) { throw new SecretVariableError('not-found', variable.key); }
    if (typeof value !== 'string') { throw new SecretVariableError('verification-failed', variable.key); }
    const newReference = { id: randomUUID() };
    await this.storeVerified(secretStorageKey(scope, variable, newReference.id), value, variable.key);
    const next = variables.map((entry) => ({ ...entry }));
    next[index] = { ...variable, value: '', secretRef: newReference };
    this.save(scope, variables, next, variable.key);
    // 교체는 이전 참조를 삭제하지 않는다. 과거 복원 사본과 다른 실행이 사용할 수 있다.
  }

  async reveal(scope: SecretVariableScope, variableId: string): Promise<string> {
    const { variable } = this.read(scope, variableId);
    return this.getSecret(scope, variable);
  }

  private async removeNow(scope: SecretVariableScope, variableId: string): Promise<void> {
    const { variables, variable } = this.read(scope, variableId);
    // 사용자 명시 삭제로 지정된 행의 정확한 참조만 정리한다.
    for (const reference of [variable.secretPendingRef, variable.secretRef]) {
      if (reference) { await this.deleteExact(secretStorageKey(scope, variable, reference.id), variable.key); }
    }
    this.save(scope, variables, variables.filter((entry) => entry.id !== variableId), variable.key);
  }

  private serialize(scope: SecretVariableScope, variableId: string, operation: () => Promise<void>): Promise<void> {
    const key = JSON.stringify([scope.profileId, scope.environmentId, variableId]);
    const previous = this.mutations.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    this.mutations.set(key, result);
    void result.finally(() => { if (this.mutations.get(key) === result) { this.mutations.delete(key); } }).catch(() => undefined);
    return result;
  }

  async describe(scope: SecretVariableScope): Promise<SecretVariableView[]> {
    const variables = this.repository.getVariables(scope);
    return Promise.all(variables.map(async (variable): Promise<SecretVariableView> => {
      if (!variable.secretRef && !variable.secretPendingRef) { return { ...variable }; }
      const view: SecretVariableView = { ...variable, value: '', secretState: 'pending' };
      if (variable.secretPendingRef) { return view; }
      try { await this.getSecret(scope, variable); view.secretState = 'set'; }
      catch (error) { view.secretState = error instanceof SecretVariableError && error.code === 'missing' ? 'missing' : 'unavailable'; }
      return view;
    }));
  }

  async resolve(scope: SecretVariableScope, texts: string[], options: ResolveSecretVariableOptions = {}): Promise<ResolvedSecretVariables> {
    const variables = options.variables ? options.variables.map((variable) => ({ ...variable })) : this.repository.getVariables(scope);
    const byKey = new Map(variables.filter((entry) => entry.enabled && entry.key).map((entry) => [entry.key, entry]));
    const needed = new Set<string>();
    const collect = (text: string, depth = 0): void => {
      if (depth > 10) { return; }
      for (const match of String(text ?? '').matchAll(/\{\{([^}]+)\}\}/g)) {
        const name = match[1].trim();
        if (needed.has(name)) { continue; }
        needed.add(name);
        const variable = byKey.get(name);
        if (variable && !variable.secretRef && !variable.secretPendingRef) { collect(variable.value, depth + 1); }
      }
    };
    texts.forEach((text) => collect(text));
    if (options.scriptsAll) { byKey.forEach((_value, key) => needed.add(key)); }
    const values: Array<{ key: string; value: string }> = [];
    const resolved = variables.map((variable) => ({ ...variable, value: variable.secretRef || variable.secretPendingRef ? `{{${variable.key}}}` : variable.value }));
    const loaded = new Set<KeyValue>();
    // 비밀값 안의 참조도 기존 재귀 치환 규칙에 따라 필요한 키를 읽는다.
    // 최대 10단계로 제한해 순환과 비정상 확장을 제어한다.
    for (let depth = 0; depth <= 10; depth++) {
      let changed = false;
      for (let index = 0; index < variables.length; index++) {
        const variable = variables[index];
        if ((!variable.secretRef && !variable.secretPendingRef) || !variable.enabled || !needed.has(variable.key)
          || byKey.get(variable.key) !== variable || loaded.has(variable)) { continue; }
        const value = await this.getSecret(scope, variable);
        loaded.add(variable);
        values.push({ key: variable.key, value });
        resolved[index].value = value;
        delete resolved[index].secretRef;
        delete resolved[index].secretPendingRef;
        collect(value);
        changed = true;
      }
      if (!changed) { break; }
    }
    return { variables: resolved, redactor: new SecretRedactor(values) };
  }

  private read(scope: SecretVariableScope, variableId: string): { variables: KeyValue[]; variable: KeyValue; index: number } {
    if (!isSecretId(variableId)) { throw new SecretVariableError('invalid-id'); }
    const variables = this.repository.getVariables(scope);
    const matches = variables.filter((entry) => entry.id === variableId);
    if (matches.length !== 1) { throw new SecretVariableError(matches.length ? 'conflict' : 'not-found'); }
    const index = variables.findIndex((entry) => entry.id === variableId);
    return { variables, variable: variables[index], index };
  }

  private save(scope: SecretVariableScope, expected: KeyValue[], next: KeyValue[], variableKey: string): void {
    try { this.repository.compareAndSave(scope, expected, next); }
    catch { throw new SecretVariableError('conflict', variableKey); }
  }

  private async getSecret(scope: SecretVariableScope, variable: KeyValue): Promise<string> {
    if (variable.secretPendingRef) { throw new SecretVariableError('conversion-pending', variable.key); }
    if (!variable.secretRef) { throw new SecretVariableError('not-found', variable.key); }
    const key = secretStorageKey(scope, variable, variable.secretRef.id);
    let value: string | undefined;
    try { value = await this.secrets.get(key); }
    catch { throw new SecretVariableError('unavailable', variable.key); }
    if (value === undefined) { throw new SecretVariableError('missing', variable.key); }
    return value;
  }

  private async storeVerified(key: string, value: string, variableKey: string): Promise<void> {
    let stored: string | undefined;
    try { await this.secrets.store(key, value); stored = await this.secrets.get(key); }
    catch { throw new SecretVariableError('unavailable', variableKey); }
    if (stored !== value) { throw new SecretVariableError('verification-failed', variableKey); }
  }

  private async deleteExact(key: string, variableKey: string): Promise<void> {
    try { await this.secrets.delete(key); }
    catch { throw new SecretVariableError('unavailable', variableKey); }
  }
}
