import * as assert from 'assert';
import { randomUUID } from 'crypto';
import Module = require('module');
import { KeyValue } from '../../models/types';
import { SecretVariableService } from '../../services/SecretVariableService';
import { SecretVariableError, SecretVariableScope } from '../../services/secretVariables';
import type { StorageService } from '../../services/StorageService';
import type { SecretVariableEditor } from '../../panels/requestPanel/SecretVariableEditor';

type EditorType = typeof import('../../panels/requestPanel/SecretVariableEditor').SecretVariableEditor;
let EditorCtor: EditorType;

describe('SecretVariableEditor authorization', () => {
  let lastInput: { value: string; password: boolean; prompt?: string; show(): void; hide(): void; dispose(): void;
    onDidAccept(handler: () => void): { dispose(): void }; onDidHide(handler: () => void): { dispose(): void }; accept(): void } | undefined;

  before(() => {
    const editorModulePath = require.resolve('../../panels/requestPanel/SecretVariableEditor');
    const cachedEditor = require.cache[editorModulePath];
    delete require.cache[editorModulePath];
    const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
    const original = loader._load;
    loader._load = function(request: unknown, ...args: unknown[]) {
      if (request !== 'vscode') { return original.apply(this, [request, ...args]); }
      return { workspace: { getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }) }, window: {
        createInputBox: () => {
          let accept: () => void = () => undefined; let hide: () => void = () => undefined;
          lastInput = { value: '', password: false, show() {}, hide() { hide(); }, dispose() {}, accept() { accept(); },
            onDidAccept(handler: () => void) { accept = handler; return { dispose() { accept = () => undefined; } }; },
            onDidHide(handler: () => void) { hide = handler; return { dispose() { hide = () => undefined; } }; } };
          return lastInput;
        },
      } };
    };
    try { EditorCtor = require('../../panels/requestPanel/SecretVariableEditor').SecretVariableEditor; }
    finally {
      loader._load = original;
      if (cachedEditor) { require.cache[editorModulePath] = cachedEditor; } else { delete require.cache[editorModulePath]; }
    }
  });

  function fixture(pending = false) {
    const variable: KeyValue = { id: randomUUID(), key: 'token', value: pending ? 'synthetic-pending-original' : '', enabled: true,
      ...(pending ? { secretPendingRef: { id: randomUUID() } } : { secretRef: { id: randomUUID() } }) };
    let rows: KeyValue[] = [variable]; let generation = 0; let stored = 'synthetic-secret-editor-value';
    let readGate: Promise<void> | undefined;
    const scope: SecretVariableScope = { profileName: 'default', profileId: randomUUID(), environmentId: 'env' };
    const messages: unknown[] = []; const changes: Array<string | null> = [];
    const repository = { getVariables: () => structuredClone(rows), compareAndSave(_scope: SecretVariableScope, before: KeyValue[], next: KeyValue[]) {
      assert.deepStrictEqual(rows, before); rows = structuredClone(next);
    } };
    const service = new SecretVariableService({ async get() { if (readGate) { await readGate; } return stored; },
      async store(_key, value) { stored = value; }, async delete() { stored = ''; } }, repository);
    const storage = { getVariableScope: () => scope, ensureVariableIds: () => structuredClone(rows),
      getScopedVariables: repository.getVariables, compareAndSaveScopedVariables: repository.compareAndSave } as unknown as StorageService;
    const editor: SecretVariableEditor = new EditorCtor(storage, service, {
      captureExecutionContext: () => ({ profileName: scope.profileName, environmentId: scope.environmentId, generation, profileId: scope.profileId }),
      isExecutionContextCurrent: (context) => context.generation === generation,
      postMessage: (message) => { messages.push(message); }, variablesChanged: (id) => { changes.push(id); },
    });
    return { editor, scope, variable, rows: () => structuredClone(rows), messages, changes,
      invalidate: () => { generation++; editor.invalidate(); }, gate: (gate: Promise<void>) => { readGate = gate; } };
  }
  const code = (expected: string) => (error: unknown) => error instanceof SecretVariableError && error.code === expected;

  it('returns masked metadata and permits only exact scope tokens', async () => {
    const f = fixture(); const data = await f.editor.data('env');
    assert.strictEqual(data.variables[0].value, ''); assert.ok(!JSON.stringify(data).includes('synthetic-secret-editor-value'));
    await assert.rejects(f.editor.save({ envId: 'env', scopeToken: randomUUID(), variables: data.variables }), code('conflict'));
    await assert.rejects(f.editor.save({ envId: null, scopeToken: data.scopeToken, variables: data.variables }), code('conflict'));
    f.invalidate(); await assert.rejects(f.editor.save({ envId: 'env', scopeToken: data.scopeToken, variables: data.variables }), code('conflict'));
  });

  it('rejects secret value/ref mutation and removal through ordinary autosave', async () => {
    const f = fixture(); const data = await f.editor.data('env'); const original = f.rows();
    const save = (variables: unknown) => f.editor.save({ envId: 'env', scopeToken: data.scopeToken, variables });
    await assert.rejects(save([{ ...data.variables[0], value: '[secret]' }]), code('conflict'));
    await assert.rejects(save([{ ...data.variables[0], secretRef: { id: randomUUID() } }]), code('conflict'));
    await assert.rejects(save([]), code('conflict'));
    await assert.rejects(save([{ id: randomUUID(), key: 'foreign', value: '', enabled: true, secretRef: { id: randomUUID() } }]), code('conflict'));
    assert.deepStrictEqual(f.rows(), original);
  });

  it('renames pending row metadata while retaining its original recovery plaintext in host storage', async () => {
    const f = fixture(true); const data = await f.editor.data('env');
    assert.strictEqual(data.variables[0].value, '');
    await f.editor.save({ envId: 'env', scopeToken: data.scopeToken, variables: [{ ...data.variables[0], key: 'renamed', enabled: false }] });
    assert.strictEqual(f.rows()[0].key, 'renamed'); assert.strictEqual(f.rows()[0].enabled, false);
    assert.strictEqual(f.rows()[0].value, 'synthetic-pending-original');
    assert.deepStrictEqual(f.rows()[0].secretPendingRef, f.variable.secretPendingRef);
  });

  it('suppresses explicit reveal completion after profile generation invalidation', async () => {
    const f = fixture(); const data = await f.editor.data('env');
    let release!: () => void; f.gate(new Promise<void>((resolve) => { release = resolve; }));
    const action = f.editor.action({ envId: 'env', scopeToken: data.scopeToken, variableId: f.variable.id!, action: 'reveal', revealRequestId: randomUUID() });
    await Promise.resolve(); f.invalidate(); release(); await action;
    assert.deepStrictEqual(f.messages, []);
  });

  it('allows reveal only for the currently displayed editor and exact reveal request ID', async () => {
    const f = fixture(); const old = await f.editor.data('env'); const current = await f.editor.data('env');
    await assert.rejects(f.editor.action({ envId: 'env', scopeToken: old.scopeToken, variableId: f.variable.id!, action: 'reveal', revealRequestId: randomUUID() }), code('conflict'));
    await assert.rejects(f.editor.action({ envId: 'env', scopeToken: current.scopeToken, variableId: f.variable.id!, action: 'reveal', revealRequestId: 'invalid' }), code('conflict'));
    const requestId = randomUUID(); await f.editor.action({ envId: 'env', scopeToken: current.scopeToken, variableId: f.variable.id!, action: 'reveal', revealRequestId: requestId });
    assert.deepStrictEqual(f.messages, [{ type: 'secretVariableRevealed', envId: 'env', variableId: f.variable.id!, value: 'synthetic-secret-editor-value',
      scopeToken: current.scopeToken, revealRequestId: requestId }]);
  });

  it('invalidates native password input on profile switch without persisting a replacement', async () => {
    const f = fixture(); const data = await f.editor.data('env'); const before = f.rows();
    const action = f.editor.action({ envId: 'env', scopeToken: data.scopeToken, variableId: f.variable.id!, action: 'set' });
    await Promise.resolve(); assert.ok(lastInput); assert.strictEqual(lastInput!.password, true);
    lastInput!.value = 'synthetic-new-input'; f.invalidate(); await action;
    assert.deepStrictEqual(f.rows(), before); assert.deepStrictEqual(f.changes, []);
  });
});
