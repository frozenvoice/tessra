import * as assert from 'assert';
import * as vm from 'vm';
import { getRequestPanelEnvironmentClientScript, getRequestPanelEnvironmentBindingsScript } from '../../panels/requestPanel/requestPanelEnvironmentClientScript';

const SYNTHETIC_SECRET = 'synthetic-ui-secret-NEVER-PERSIST-7345';
const VARIABLE_ID = 'c14cc058-debf-40aa-b1fe-d41aaf34e091';
const REFERENCE_ID = '97f50b6c-dc91-4e7f-b87c-df0db41e1aef';

function row(protectedRow = true, pending = false) {
  const value = { value: protectedRow ? SYNTHETIC_SECRET : 'ordinary-value', type: protectedRow ? 'text' : 'text' };
  const key = { value: 'renamed-variable' };
  const button = { dataset: { secretAction: 'reveal' }, textContent: '', setAttribute() {} };
  const metadata = { id: VARIABLE_ID, ...(protectedRow ? pending ? { secretPendingRef: { id: REFERENCE_ID } } : { secretRef: { id: REFERENCE_ID } } : {}) };
  const result = { _variableMetadata: metadata, _secretState: pending ? 'pending' : 'set',
    dataset: { variableId: VARIABLE_ID, protected: protectedRow ? '1' : '0' },
    querySelector(selector: string) {
      if (selector === '.js-env-key') return key;
      if (selector === '.js-env-value') return value;
      if (selector === 'input[type="checkbox"]') return { checked: true };
      if (selector === '[data-secret-action="reveal"]') return button;
      if (selector === '[data-secret-action="hide"]') return button.dataset.secretAction === 'hide' ? button : null;
      return null;
    } };
  return { result, value, key, button };
}

function setup(rows = [row().result]) {
  const messages: unknown[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const envVarRows = {
    querySelectorAll: (selector: string) => selector.includes('[data-protected="1"]') ? rows.filter(r => r.dataset.protected === '1') : rows,
    replaceChildren() {}, appendChild() {},
  };
  const context = vm.createContext({ envVarRows,
    envEditor: { classList: { contains: () => false, add() {}, remove() {} } },
    envDirtyDot: { classList: { remove() {}, add() {} } }, envAutoSaved: { classList: { remove() {}, add() {} } },
    envEditorName: null, envEditorVarCount: null, addEnvVarBtn: null,
    mainContent: null, requestAnimationFrame() {}, refreshStatusStrip() {}, syncEnvironmentStripDisclosureState() {},
    tr: (key: string) => key, tfCount: (_key: string, count: number) => String(count),
    escapeHtml: (value: string) => String(value).replace(/</g, '&lt;'),
    escapeAttr: (value: string) => String(value).replace(/"/g, '&quot;'),
    crypto: { randomUUID: () => VARIABLE_ID },
    isSensitiveKeyName: (key: string) => /token|password/i.test(key),
    document: { createElement: () => ({ dataset: {}, style: {} }), getElementById: () => null },
    setTimeout: (callback: () => void, _delay: number) => { timers.set(nextTimer, callback); return nextTimer++; },
    clearTimeout: (id: number) => timers.delete(id),
    vscode: { postMessage: (message: unknown) => messages.push(message) },
  });
  vm.runInContext(getRequestPanelEnvironmentClientScript(), context);
  vm.runInContext("editingEnvId = 'env-a'; envEditorScopeToken = 'profile-a-view-1';", context);
  return { context, messages, timers, rows };
}

describe('Secret variable Webview boundary', () => {
  it('never serializes a revealed value or mask; preserves IDs, refs, renamed keys and enabled metadata', () => {
    const secret = row();
    const { context, messages } = setup([secret.result]);
    vm.runInContext('envAutoSave()', context);
    const serialized = JSON.stringify(messages);
    assert.ok(!serialized.includes(SYNTHETIC_SECRET));
    const variable = (messages[0] as { variables: Array<{ id: string; key: string; value: string; secretRef: { id: string } }> }).variables[0];
    assert.strictEqual(variable.id, VARIABLE_ID);
    assert.strictEqual(variable.secretRef.id, REFERENCE_ID);
    assert.strictEqual(variable.key, 'renamed-variable');
    assert.strictEqual(variable.value, '');
  });

  it('preserves a pending ref without sending its retained plaintext as a fallback', () => {
    const { context, messages } = setup([row(true, true).result]);
    vm.runInContext('envAutoSave()', context);
    assert.ok(!JSON.stringify(messages).includes(SYNTHETIC_SECRET));
    assert.strictEqual((messages[0] as { variables: Array<{ secretPendingRef: { id: string } }> }).variables[0].secretPendingRef.id, REFERENCE_ID);
  });

  it('routes workspace saves explicitly without treating null environment as request fallback', () => {
    const { context, messages } = setup([row(false).result]);
    vm.runInContext("editingEnvId = null; envEditorScope = 'workspace'; envAutoSave()", context);
    assert.strictEqual((messages[0] as { type: string }).type, 'saveWorkspaceVariables');
    assert.strictEqual((messages[0] as { envId: string | null }).envId, null);
    assert.strictEqual((messages[0] as { scopeToken: string }).scopeToken, 'profile-a-view-1');
  });

  it('renders secret and interrupted-conversion rows without plaintext and with readonly native controls', () => {
    const { context } = setup();
    const html = vm.runInContext('createEnvironmentVariableRow(' + JSON.stringify({ id: VARIABLE_ID, key: '<unsafe>', value: SYNTHETIC_SECRET,
      enabled: true, secretPendingRef: { id: REFERENCE_ID }, secretState: 'pending' }) + ').innerHTML', context) as string;
    assert.ok(!html.includes(SYNTHETIC_SECRET));
    assert.match(html, /readonly autocomplete="off"/);
    assert.match(html, /data-secret-action="resume"/);
    assert.match(html, /data-secret-action="cancel"/);
    assert.doesNotMatch(html, /data-secret-action="protect"/);
  });

  it('preserves ordinary sensitive-name visual masking without automatically converting the variable', () => {
    const { context } = setup();
    const created = vm.runInContext('createEnvironmentVariableRow(' + JSON.stringify({ id: VARIABLE_ID, key: 'apiToken', value: 'ordinary-existing-token', enabled: true }) + ')', context) as { innerHTML: string; _variableMetadata: { secretRef?: unknown }; dataset: { protected: string } };
    assert.match(created.innerHTML, /input type="password" class="js-env-value/);
    assert.match(created.innerHTML, /data-secret-action="protect"/);
    assert.match(created.innerHTML, /data-secret-action="toggle-plain"/);
    assert.strictEqual(created._variableMetadata.secretRef, undefined);
    assert.strictEqual(created.dataset.protected, '0');
  });

  it('requires a matching requested reveal and clears DOM values on expiry, close and scope replacement', () => {
    const secret = row(); secret.value.value = '';
    const { context, timers } = setup([secret.result]);
    vm.runInContext("pendingSecretReveal = { variableId: '" + VARIABLE_ID + "', revealRequestId: 'user-click-1' }", context);
    const message = { envId: 'env-a', variableId: VARIABLE_ID, scopeToken: 'profile-a-view-1', revealRequestId: 'user-click-1', value: SYNTHETIC_SECRET };
    vm.runInContext('receiveSecretVariableReveal(' + JSON.stringify({ ...message, scopeToken: 'different-profile' }) + ')', context);
    assert.strictEqual(secret.value.value, '');
    vm.runInContext('receiveSecretVariableReveal(' + JSON.stringify({ ...message, revealRequestId: 'older-click' }) + ')', context);
    assert.strictEqual(secret.value.value, '');
    vm.runInContext('receiveSecretVariableReveal(' + JSON.stringify(message) + ')', context);
    assert.strictEqual(secret.value.value, SYNTHETIC_SECRET);
    assert.strictEqual(secret.button.dataset.secretAction, 'hide');
    Array.from(timers.values())[0]();
    assert.strictEqual(secret.value.value, '');
    assert.strictEqual(secret.value.type, 'password');
    secret.value.value = SYNTHETIC_SECRET;
    vm.runInContext('hideEnvironmentEditor()', context);
    assert.strictEqual(secret.value.value, '');
    vm.runInContext('receiveSecretVariableReveal(' + JSON.stringify(message) + ')', context);
    assert.strictEqual(secret.value.value, '', 'late reply after close is ignored');
  });

  it('uses bespoke environment events, explicit protected deletion and unload clearing', () => {
    const source = getRequestPanelEnvironmentBindingsScript();
    assert.ok(!source.includes('bindKvRow(envVarRows'));
    assert.match(source, /action === 'remove' && row\.dataset\.protected !== '1'/);
    assert.match(source, /envAutoSave\(\);[\s\S]*type: 'secretVariableAction'/);
    assert.match(source, /window\.addEventListener\('beforeunload', clearSecretReveals\)/);
    assert.match(source, /window\.addEventListener\('pagehide', clearSecretReveals\)/);
    assert.doesNotThrow(() => new vm.Script(getRequestPanelEnvironmentClientScript() + source));
  });
});
