import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { KeyValue } from '../../models/types';
import { StorageService, StoredVariableScope } from '../../services/StorageService';
import { SecretVariableService } from '../../services/SecretVariableService';
import { SecretVariableError, isSecretId } from '../../services/secretVariables';
import { LocalizationService } from '../../services/LocalizationService';
import { ExecutionContext } from './executionContext';

interface EditorAuthorization { scope: StoredVariableScope; context: ExecutionContext }

export interface SecretVariableEditorHost {
  captureExecutionContext(): ExecutionContext;
  isExecutionContextCurrent(context: ExecutionContext): boolean;
  postMessage(message: unknown): void;
  variablesChanged(environmentId: string | null): void;
}

/** 편집/보기 권한을 Webview 세대와 scope token에 묶고 값 입력은 native password UI를 쓴다. */
export class SecretVariableEditor {
  private readonly authorizations = new Map<string, EditorAuthorization>();
  private readonly inputBoxes = new Set<vscode.InputBox>();
  private lastEditorToken: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: StorageService, private readonly secrets: SecretVariableService, private readonly host: SecretVariableEditorHost) {}

  async data(environmentId: string | null, preserveCurrentToken = false): Promise<{ variables: KeyValue[]; scopeToken: string }> {
    const context = this.host.captureExecutionContext();
    const scope = this.storage.getVariableScope(environmentId, context.profileName);
    const previous = this.lastEditorToken ? this.authorizations.get(this.lastEditorToken) : undefined;
    const reuse = preserveCurrentToken && previous?.scope.environmentId === environmentId
      && previous.scope.profileId === scope.profileId && this.host.isExecutionContextCurrent(previous.context);
    const scopeToken = reuse ? this.lastEditorToken! : randomUUID();
    this.authorizations.set(scopeToken, { scope, context });
    this.lastEditorToken = scopeToken;
    if (this.authorizations.size > 128) { this.authorizations.delete(this.authorizations.keys().next().value!); }
    this.storage.ensureVariableIds(scope);
    const variables = await this.secrets.describe(scope);
    if (!this.host.isExecutionContextCurrent(context)) { throw new SecretVariableError('conflict'); }
    return { variables, scopeToken };
  }

  save(message: { envId: string | null; scopeToken?: string; variables: unknown }): Promise<void> {
    return this.serial(async () => {
      const { scope } = this.authorize(message.scopeToken, message.envId);
      if (!Array.isArray(message.variables)) { throw new SecretVariableError('conflict'); }
      const before = this.storage.getScopedVariables(scope);
      const existing = new Map(before.filter((row) => row.id).map((row) => [row.id!, row]));
      const seen = new Set<string>();
      const next: KeyValue[] = [];
      for (const raw of message.variables) {
        if (!raw || typeof raw !== 'object') { throw new SecretVariableError('conflict'); }
        const row = raw as Partial<KeyValue>;
        if (typeof row.key !== 'string' || typeof row.enabled !== 'boolean' || typeof row.value !== 'string') { throw new SecretVariableError('conflict'); }
        const id = row.id ?? randomUUID();
        if (!isSecretId(id) || seen.has(id)) { throw new SecretVariableError('invalid-id'); }
        seen.add(id);
        const source = existing.get(id);
        if (source?.secretRef || source?.secretPendingRef) {
          if (row.secretRef?.id !== source.secretRef?.id || row.secretPendingRef?.id !== source.secretPendingRef?.id || row.value !== '') {
            throw new SecretVariableError('conflict', source.key);
          }
          next.push({ ...source, key: row.key, enabled: row.enabled });
        } else {
          if (row.secretRef || row.secretPendingRef) { throw new SecretVariableError('conflict', row.key); }
          if (row.key) { next.push({ id, key: row.key, value: row.value, enabled: row.enabled }); }
        }
      }
      if (before.some((row) => (row.secretRef || row.secretPendingRef) && !seen.has(row.id!))) {
        throw new SecretVariableError('conflict');
      }
      const equal = before.length === next.length && before.every((row, index) => {
        const candidate = next[index];
        return row.id === candidate.id && row.key === candidate.key && row.enabled === candidate.enabled && row.value === candidate.value
          && row.secretRef?.id === candidate.secretRef?.id && row.secretPendingRef?.id === candidate.secretPendingRef?.id;
      });
      if (equal) { return; }
      this.storage.compareAndSaveScopedVariables(scope, before, next);
      this.host.variablesChanged(scope.environmentId);
    });
  }

  action(message: { envId: string | null; scopeToken?: string; variableId: string; action: string; revealRequestId?: string }): Promise<void> {
    return this.serial(async () => {
      const { scope, context } = this.authorize(message.scopeToken, message.envId);
      if (!isSecretId(message.variableId)) { throw new SecretVariableError('invalid-id'); }
      switch (message.action) {
        case 'protect': await this.secrets.convert(scope, message.variableId); break;
        case 'resume': await this.secrets.resumeConversion(scope, message.variableId); break;
        case 'cancel': await this.secrets.cancelConversion(scope, message.variableId); break;
        case 'remove': await this.secrets.remove(scope, message.variableId); break;
        case 'set': {
          const input = await this.input(context);
          if (input === undefined) { return; }
          this.authorize(message.scopeToken, message.envId);
          await this.secrets.replace(scope, message.variableId, input);
          break;
        }
        case 'reveal': {
          if (!isSecretId(message.revealRequestId) || message.scopeToken !== this.lastEditorToken) { throw new SecretVariableError('conflict'); }
          const value = await this.secrets.reveal(scope, message.variableId);
          if (this.host.isExecutionContextCurrent(context) && message.scopeToken === this.lastEditorToken) {
            this.host.postMessage({ type: 'secretVariableRevealed', envId: scope.environmentId,
              variableId: message.variableId, value, scopeToken: message.scopeToken, revealRequestId: message.revealRequestId });
          }
          return;
        }
        default: throw new SecretVariableError('conflict');
      }
      if (this.host.isExecutionContextCurrent(context)) { this.host.variablesChanged(scope.environmentId); }
    });
  }

  invalidate(): void {
    this.authorizations.clear();
    this.lastEditorToken = null;
    for (const input of this.inputBoxes) { input.hide(); input.dispose(); }
    this.inputBoxes.clear();
  }

  private authorize(scopeToken: string | undefined, environmentId: string | null): EditorAuthorization {
    const authorization = typeof scopeToken === 'string' ? this.authorizations.get(scopeToken) : undefined;
    if (!authorization || authorization.scope.environmentId !== environmentId || !this.host.isExecutionContextCurrent(authorization.context)) {
      throw new SecretVariableError('conflict');
    }
    return authorization;
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private input(context: ExecutionContext): Promise<string | undefined> {
    const input = vscode.window.createInputBox();
    input.password = true;
    input.prompt = LocalizationService.t('secret.inputPrompt');
    this.inputBoxes.add(input);
    return new Promise((resolve) => {
      let finished = false;
      const finish = (value?: string) => {
        if (finished) { return; }
        finished = true;
        this.inputBoxes.delete(input);
        accept.dispose(); hide.dispose(); input.dispose();
        resolve(value);
      };
      const accept = input.onDidAccept(() => {
        if (!this.host.isExecutionContextCurrent(context)) { finish(); return; }
        finish(input.value);
      });
      const hide = input.onDidHide(() => finish());
      input.show();
    });
  }
}
