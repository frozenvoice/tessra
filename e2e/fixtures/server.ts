import * as http from 'http';
import type { AddressInfo } from 'net';

export interface FixtureRequestLog {
  method: string;
  url: string;
  pathname: string;
  search: string;
  query: Record<string, string | string[]>;
  headers: http.IncomingHttpHeaders;
  body: string;
  at: number;
}

export interface FixtureServer {
  port: number;
  baseUrl: string;
  requests: FixtureRequestLog[];
  close: () => Promise<void>;
  waitForRequest: (predicate: (req: FixtureRequestLog) => boolean, timeoutMs?: number) => Promise<FixtureRequestLog>;
  clearRequests: () => void;
  releaseHeldRequests: () => void;
}

function parseQuery(search: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    out[key] = values.length <= 1 ? (values[0] ?? '') : values;
  }
  return out;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function text(res: http.ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export async function startFixtureServer(options?: { slowMs?: number }): Promise<FixtureServer> {
  const slowMs = options?.slowMs ?? 3000;
  const requests: FixtureRequestLog[] = [];
  const heldResponses = new Set<http.ServerResponse>();
  const releaseHeldRequests = () => {
    for (const response of heldResponses) {
      if (!response.destroyed) { json(response, 200, { held: true }); }
    }
    heldResponses.clear();
  };

  const server = http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://127.0.0.1');
    const body = method === 'GET' || method === 'HEAD' ? '' : await readBody(req);
    const entry: FixtureRequestLog = {
      method,
      url: rawUrl,
      pathname: parsed.pathname,
      search: parsed.search,
      query: parseQuery(parsed.search),
      headers: req.headers,
      body,
      at: Date.now(),
    };
    requests.push(entry);

    try {
      if (parsed.pathname === '/held') {
        heldResponses.add(res);
        res.once('close', () => heldResponses.delete(res));
        return;
      }
      if (parsed.pathname === '/users') {
        const users = [
          { id: 1, name: 'Ada Lovelace' },
          { id: 2, name: 'Grace Hopper' },
          { id: 3, name: 'Katherine Johnson' },
          { id: 4, name: 'Margaret Hamilton' },
          { id: 5, name: 'Radia Perlman' },
          { id: 6, name: 'Barbara Liskov' },
        ];
        const limitRaw = parsed.searchParams.get('_limit');
        const limit = limitRaw ? Number(limitRaw) : users.length;
        const sliced = Number.isFinite(limit) ? users.slice(0, Math.max(0, limit)) : users;
        json(res, 200, {
          users: sliced,
          echoQuery: parseQuery(parsed.search),
          receivedUrl: rawUrl,
        });
        return;
      }

      if (parsed.pathname === '/echo' && method === 'POST') {
        json(res, 200, {
          echoed: body,
          contentType: req.headers['content-type'] || null,
        });
        return;
      }

      if (parsed.pathname === '/html') {
        text(res, 200, '<!doctype html><html><body><h1>Tessra E2E HTML</h1></body></html>', 'text/html; charset=utf-8');
        return;
      }

      if (parsed.pathname === '/xml') {
        text(res, 200, '<?xml version="1.0"?><root><item>tessra</item></root>', 'application/xml; charset=utf-8');
        return;
      }

      if (parsed.pathname === '/headers') {
        json(res, 200, { headers: req.headers });
        return;
      }

      if (parsed.pathname === '/status/500') {
        json(res, 500, { error: 'fixture-500' });
        return;
      }

      if (parsed.pathname === '/slow') {
        await new Promise((resolve) => setTimeout(resolve, slowMs));
        json(res, 200, { ok: true, delayedMs: slowMs });
        return;
      }

      if (parsed.pathname === '/large') {
        const payload = { pad: 'x'.repeat(1024 * 64) };
        json(res, 200, payload);
        return;
      }

      json(res, 404, { error: 'not-found', path: parsed.pathname });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const waitForRequest = async (
    predicate: (req: FixtureRequestLog) => boolean,
    timeoutMs = 15000
  ): Promise<FixtureRequestLog> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const hit = [...requests].reverse().find(predicate);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Fixture server did not receive matching request within ${timeoutMs}ms`);
  };

  return {
    port,
    baseUrl,
    requests,
    clearRequests: () => {
      requests.length = 0;
    },
    waitForRequest,
    releaseHeldRequests,
    close: () =>
      new Promise((resolve, reject) => {
        releaseHeldRequests();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
