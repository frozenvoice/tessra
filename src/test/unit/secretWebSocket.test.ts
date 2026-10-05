import * as assert from 'assert';
import { EventEmitter } from 'events';
import Module = require('module');
import { KeyValue, MessageType } from '../../models/types';
import { SecretVariableService } from '../../services/SecretVariableService';
import type { WebSocketManager } from '../../panels/requestPanel/WebSocketManager';

const secret = 'synthetic-ws-secret-ONLY-LOCAL';
const scope = { profileName: 'default', profileId: '11111111-1111-4111-8111-111111111111', environmentId: 'env-original' };
const variables: KeyValue[] = [{ id: '22222222-2222-4222-8222-222222222222', key: 'token', value: '', enabled: true,
  secretRef: { id: '33333333-3333-4333-8333-333333333333' } }];

class Connection extends EventEmitter {
  texts: string[] = [];
  pings: string[] = [];
  sendText(value: string) { this.texts.push(value); }
  sendPing(value: string) { this.pings.push(value); }
  close() {}
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function settle() { for (let i = 0; i < 8; i++) { await Promise.resolve(); } }

function setup(get: () => PromiseLike<string | undefined> = () => Promise.resolve(secret), initialRows: KeyValue[] = variables) {
  let currentRows = initialRows;
  const original = (Module as any)._load;
  const modulePath = require.resolve('../../panels/requestPanel/WebSocketManager');
  const cached = require.cache[modulePath];
  delete require.cache[modulePath];
  (Module as any)._load = function(name: string, ...args: unknown[]) {
    if (name === 'vscode') { return { workspace: { getConfiguration: () => ({ get: (_: string, fallback: unknown) => fallback }) } }; }
    return original.apply(this, [name, ...args]);
  };
  let Ctor: typeof WebSocketManager;
  try { Ctor = require(modulePath).WebSocketManager; }
  finally { (Module as any)._load = original; if (cached) { require.cache[modulePath] = cached; } else { delete require.cache[modulePath]; } }
  const posted: any[] = [];
  const connections: Connection[] = [];
  const wire: any[] = [];
  const contexts: any[] = [];
  let generation = 1;
  let timer: (() => void) | undefined;
  const service = new SecretVariableService({ get, store: async () => {}, delete: async () => {} }, {
    getVariables: () => currentRows, compareAndSave: () => {},
  });
  const manager = new Ctor!({ connect: (url: string, headers: KeyValue[]) => {
    wire.push({ url, headers }); const connection = new Connection(); connections.push(connection); return connection;
  } } as any, {
    postMessage: (message) => posted.push(message), getActiveVariables: () => currentRows,
    getExecutionVariables: () => currentRows,
    getDefaultHeaders: () => [], getAllowInsecureCertificates: () => false,
    captureExecutionContext: () => ({ profileName: scope.profileName, profileId: scope.profileId, environmentId: scope.environmentId, generation }),
    isExecutionContextCurrent: (context) => context.generation === generation,
    resolveSecretVariables: async (context, rows, texts, scriptsAll) => {
      contexts.push(context); return service.resolve(scope, texts, { variables: rows, scriptsAll });
    },
  }, {
    setInterval: (callback) => { timer = callback; return 1 as any; }, clearInterval: () => { timer = undefined; },
  });
  const connect = (keepAlive = false) => manager.connect({ type: MessageType.WebSocketConnect, tabId: 'tab',
    url: 'ws://fixture.test/socket', headers: [{ key: 'X-Fixture-Secret', value: '{{token}}', enabled: true }], params: [], auth: { type: 'none' },
    webSocketKeepAliveEnabled: keepAlive, webSocketKeepAliveMessage: '{{token}}' });
  return { manager, connect, posted, wire, connections, contexts, setVariables: (rows: KeyValue[]) => { currentRows = rows; }, changeProfile: () => { ++generation; manager.disconnectAll(); }, ping: () => timer?.() };
}

describe('Secret WebSocket execution boundary', () => {
  it('Stop during keychain read opens no socket and drops the late read', async () => {
    const held = deferred<string | undefined>(); const state = setup(() => held.promise);
    state.connect(); state.manager.disconnect('tab'); held.resolve(secret); await settle();
    assert.strictEqual(state.wire.length, 0);
    assert.strictEqual(state.posted[state.posted.length - 1].status, 'closed');
  });
  it('profile invalidation drops a pending handshake', async () => {
    const held = deferred<string | undefined>(); const state = setup(() => held.promise);
    state.connect(); state.changeProfile(); held.resolve(secret); await settle();
    assert.strictEqual(state.connections.length, 0);
  });
  it('sends real handshake/text/ping bytes, masks outbound preview and preserves received echo', async () => {
    const state = setup(); state.connect(true); await settle();
    const connection = state.connections[0]; assert.ok(connection);
    assert.strictEqual(state.wire[0].headers[0].value, secret);
    connection.emit('open');
    state.manager.send({ type: MessageType.WebSocketSend, tabId: 'tab', message: '{{token}}' });
    state.ping(); await settle();
    assert.deepStrictEqual(connection.texts, [secret]); assert.deepStrictEqual(connection.pings, [secret]);
    assert.strictEqual(state.posted.find((entry) => entry.direction === 'out').data, '[secret]');
    connection.emit('message', { type: 'text', data: secret, size: secret.length });
    assert.strictEqual(state.posted.filter((entry) => entry.direction === 'in' && entry.messageType === 'text')[0].data, secret);
    assert.ok(state.contexts.every((context) => context.environmentId === scope.environmentId));
  });
  it('missing keychain values fail closed before opening a socket', async () => {
    const state = setup(() => Promise.resolve(undefined)); state.connect(); await settle();
    assert.strictEqual(state.wire.length, 0); assert.strictEqual(state.posted[state.posted.length - 1].status, 'error');
    assert.ok(!JSON.stringify(state.posted).includes(secret));
  });
  it('a pending send cannot cross a disconnect', async () => {
    let get = () => Promise.resolve<string | undefined>(secret);
    const state = setup(() => get()); state.connect(); await settle();
    const held = deferred<string | undefined>(); get = () => held.promise;
    state.manager.send({ type: MessageType.WebSocketSend, tabId: 'tab', message: '{{token}}' });
    state.manager.disconnect('tab'); held.resolve(secret); await settle();
    assert.deepStrictEqual(state.connections[0].texts, []);
  });
  it('observes explicit protection applied after connecting instead of reusing the plaintext classification', async () => {
    const state = setup(undefined, [{ id: variables[0].id, key: 'token', value: secret, enabled: true }]);
    state.connect(); await settle();
    state.setVariables(variables);
    state.manager.send({ type: MessageType.WebSocketSend, tabId: 'tab', message: '{{token}}' }); await settle();
    assert.deepStrictEqual(state.connections[0].texts, [secret]);
    assert.strictEqual(state.posted.find((entry) => entry.direction === 'out').data, '[secret]');
  });
});
