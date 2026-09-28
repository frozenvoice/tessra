import * as http from 'http';
import type { AddressInfo } from 'net';

export interface DemoServer {
  baseUrl: string;
  close: () => Promise<void>;
}

const USERS = [
  { id: 42, name: 'Ada Lovelace', email: 'ada@example.test', role: 'admin', active: true },
  { id: 7, name: 'Grace Hopper', email: 'grace@example.test', role: 'editor', active: true },
  { id: 12, name: 'Katherine Johnson', email: 'katherine@example.test', role: 'viewer', active: false },
];

function send(res: http.ServerResponse, status: number, payload?: unknown): void {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Small local API for the promo capture. `env` is echoed so switching
 * environments visibly changes the response. DELETE fails the first time
 * so the runner has a failure to rerun.
 */
export async function startDemoServer(env: string, port: number): Promise<DemoServer> {
  let deleteAttempts = 0;
  const latency = env === 'staging' ? 120 : 40;
  const handler: http.RequestListener = (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    setTimeout(() => {
      const m = url.pathname.match(/^\/users\/(\d+)$/);
      if (url.pathname === '/users' && req.method === 'GET') return send(res, 200, { env, users: USERS });
      if (url.pathname === '/users' && req.method === 'POST') return send(res, 201, { env, id: 43, created: true });
      if (m && req.method === 'GET') {
        const user = USERS.find((u) => u.id === Number(m[1]));
        return user ? send(res, 200, { ...user, env }) : send(res, 404, { error: 'not_found' });
      }
      if (m && req.method === 'DELETE') {
        deleteAttempts += 1;
        return deleteAttempts === 1 ? send(res, 503, { error: 'temporarily_unavailable' }) : send(res, 204);
      }
      send(res, 404, { error: 'not_found' });
    }, latency);
  };

  // 'localhost' may resolve to ::1 or 127.0.0.1, so listen on both loopbacks.
  const v4 = http.createServer(handler);
  await new Promise<void>((resolve) => {
    v4.once('error', () => v4.listen(0, '127.0.0.1', () => resolve()));
    v4.listen(port, '127.0.0.1', () => resolve());
  });
  const actual = (v4.address() as AddressInfo).port;
  const v6 = http.createServer(handler);
  await new Promise<void>((resolve) => {
    v6.once('error', () => resolve());
    v6.listen(actual, '::1', () => resolve());
  });

  return {
    baseUrl: `http://localhost:${actual}`,
    close: async () => {
      await new Promise((r) => v4.close(() => r(undefined)));
      await new Promise((r) => v6.close(() => r(undefined)));
    },
  };
}
