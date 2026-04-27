import * as assert from 'assert';
import { EventEmitter } from 'events';
import Module = require('module');
import { MessageType, WebSocketConnectMessage } from '../../models/types';
import { WebSocketConnection, WebSocketService } from '../../services/WebSocketService';
import type { WebSocketManager, WebSocketManagerHost, WebSocketTimerHost } from '../../panels/requestPanel/WebSocketManager';
import {
  normalizeWebSocketKeepAliveInterval,
  normalizeWebSocketKeepAliveMessage,
} from '../../panels/requestPanel/requestUtils';

let WebSocketManagerCtor: new (
  service: WebSocketService,
  host: WebSocketManagerHost,
  timers: WebSocketTimerHost
) => WebSocketManager;
let restoreModuleLoad: (() => void) | null = null;

before(() => {
  const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
  (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function(request: unknown, ...args: unknown[]): unknown {
    if (request === 'vscode') {
      return {
        workspace: {
          getConfiguration: () => ({
            get: (_key: string, fallback: unknown) => fallback,
          }),
        },
      };
    }
    return originalLoad.apply(this, [request, ...args]);
  };
  restoreModuleLoad = () => {
    (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad;
  };
  WebSocketManagerCtor = require('../../panels/requestPanel/WebSocketManager').WebSocketManager;
});

after(() => {
  restoreModuleLoad?.();
});

class FakeWebSocketConnection extends EventEmitter {
  public sent: string[] = [];
  public closed: Array<{ code: number; reason: string }> = [];

  sendText(message: string): void {
    this.sent.push(message);
  }

  close(code = 1000, reason = ''): void {
    this.closed.push({ code, reason });
  }
}

class FakeWebSocketService {
  public connections: FakeWebSocketConnection[] = [];

  connect(): WebSocketConnection {
    const connection = new FakeWebSocketConnection();
    this.connections.push(connection);
    return connection as unknown as WebSocketConnection;
  }
}

type FakeTimer = {
  callback: () => void;
  ms: number;
  cleared: boolean;
};

function createFakeTimers(): WebSocketTimerHost & { timers: FakeTimer[] } {
  const timers: FakeTimer[] = [];
  return {
    timers,
    setInterval(callback: () => void, ms: number): ReturnType<typeof setInterval> {
      const timer = { callback, ms, cleared: false };
      timers.push(timer);
      return timer as unknown as ReturnType<typeof setInterval>;
    },
    clearInterval(timer: ReturnType<typeof setInterval>): void {
      (timer as unknown as FakeTimer).cleared = true;
    },
  };
}

function createManager() {
  const service = new FakeWebSocketService();
  const posted: any[] = [];
  const vars = [{ key: 'clientName', value: 'tessra-demo', enabled: true }];
  const timers = createFakeTimers();
  const manager = new WebSocketManagerCtor(
    service as unknown as WebSocketService,
    {
      postMessage: (message) => posted.push(message),
      getActiveVariables: () => vars,
      getDefaultHeaders: () => [],
      getAllowInsecureCertificates: () => false,
    },
    timers
  );
  return { manager, service, posted, vars, timers };
}

function connectMessage(overrides: Partial<WebSocketConnectMessage> = {}): WebSocketConnectMessage {
  return {
    type: MessageType.WebSocketConnect,
    tabId: 'tab_1',
    url: 'wss://example.test/socket',
    headers: [],
    params: [],
    auth: { type: 'none' },
    webSocketKeepAliveEnabled: true,
    webSocketKeepAliveIntervalSeconds: 10,
    webSocketKeepAliveMessage: '{"type":"ping","from":"{{clientName}}"}',
    ...overrides,
  };
}

describe('WebSocketManager keepalive', () => {
  it('normalizes keepalive settings with defaults and bounds', () => {
    assert.strictEqual(normalizeWebSocketKeepAliveInterval(undefined), 30);
    assert.strictEqual(normalizeWebSocketKeepAliveInterval(1), 5);
    assert.strictEqual(normalizeWebSocketKeepAliveInterval(10), 10);
    assert.strictEqual(normalizeWebSocketKeepAliveInterval(301), 300);
    assert.strictEqual(normalizeWebSocketKeepAliveMessage(undefined), 'ping');
    assert.strictEqual(normalizeWebSocketKeepAliveMessage('  hello  '), 'hello');
  });

  it('starts an app-level keepalive after open and resolves variables in the message', () => {
    const { manager, service, posted, timers } = createManager();

    manager.connect(connectMessage());
    service.connections[0].emit('open');

    assert.strictEqual(timers.timers.length, 1);
    assert.strictEqual(timers.timers[0].ms, 10000);
    assert.ok(
      posted.some((message) => message.type === MessageType.WebSocketMessage && String(message.data).includes('Keepalive enabled')),
      'keepalive start should be logged as a system message'
    );

    timers.timers[0].callback();

    assert.deepStrictEqual(service.connections[0].sent, ['{"type":"ping","from":"tessra-demo"}']);
    assert.ok(
      posted.some((message) =>
        message.type === MessageType.WebSocketMessage &&
        message.direction === 'out' &&
        message.data === '{"type":"ping","from":"tessra-demo"}'
      ),
      'keepalive sends should be visible as OUT messages'
    );
  });

  it('does not start keepalive when the option is off', () => {
    const { manager, service, timers } = createManager();

    manager.connect(connectMessage({ webSocketKeepAliveEnabled: false }));
    service.connections[0].emit('open');

    assert.strictEqual(timers.timers.length, 0);
  });

  it('clears the keepalive interval on manual disconnect', () => {
    const { manager, service, posted, timers } = createManager();

    manager.connect(connectMessage());
    service.connections[0].emit('open');
    manager.disconnect('tab_1');

    assert.strictEqual(timers.timers[0].cleared, true);
    assert.deepStrictEqual(service.connections[0].closed, [{ code: 1000, reason: 'User disconnect' }]);
    assert.ok(
      posted.some((message) => message.type === MessageType.WebSocketMessage && String(message.data).includes('Keepalive stopped')),
      'keepalive stop should be logged'
    );

    timers.timers[0].callback();
    assert.deepStrictEqual(service.connections[0].sent, []);
  });

  it('clears the old interval before reconnecting and avoids duplicate sends', () => {
    const { manager, service, timers } = createManager();

    manager.connect(connectMessage());
    service.connections[0].emit('open');
    manager.connect(connectMessage({ webSocketKeepAliveMessage: 'second' }));
    service.connections[1].emit('open');

    assert.strictEqual(timers.timers.length, 2);
    assert.strictEqual(timers.timers[0].cleared, true);
    assert.strictEqual(timers.timers[1].cleared, false);

    timers.timers[0].callback();
    timers.timers[1].callback();

    assert.deepStrictEqual(service.connections[0].sent, []);
    assert.deepStrictEqual(service.connections[1].sent, ['second']);
  });

  it('clears keepalive on remote close and unexpected close status is reported', () => {
    const { manager, service, posted, timers } = createManager();

    manager.connect(connectMessage());
    service.connections[0].emit('open');
    service.connections[0].emit('close', { code: 1006, reason: 'Abnormal Closure', wasClean: false });

    assert.strictEqual(timers.timers[0].cleared, true);
    assert.ok(
      posted.some((message) =>
        message.type === MessageType.WebSocketStatus &&
        message.status === 'closed' &&
        message.closeSource === 'unexpected' &&
        message.code === 1006
      )
    );
  });
});
