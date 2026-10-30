import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vm from 'vm';
import { CodegenService } from '../../services/CodegenService';

describe('CodegenService', () => {
  it('dedupes Authorization headers before applying bearer auth', () => {
    const code = CodegenService.generate('fetch', {
      method: 'GET',
      url: 'https://api.example.com/items',
      headers: [
        { key: 'Authorization', value: 'Bearer old-token', enabled: true },
        { key: 'Accept', value: 'application/json', enabled: true },
      ],
      params: [],
      body: '',
      bodyType: 'none',
      formData: [],
      binaryFilePath: '',
      auth: { type: 'bearer', bearer: { token: 'new-token' } },
    });

    assert.strictEqual((code.match(/Authorization/g) || []).length, 1);
    assert.ok(code.includes('"Authorization": "Bearer new-token"'));
    assert.ok(code.includes('"Accept": "application/json"'));
  });

  it('dedupes query API keys before building generated URLs', () => {
    const code = CodegenService.generate('axios', {
      method: 'GET',
      url: 'https://api.example.com/items',
      headers: [],
      params: [
        { key: 'apiKey', value: 'old-value', enabled: true },
        { key: 'page', value: '1', enabled: true },
      ],
      body: '',
      bodyType: 'none',
      formData: [],
      binaryFilePath: '',
      auth: { type: 'apikey', apikey: { key: 'apiKey', value: 'new-value', addTo: 'query' } },
    });

    assert.ok(code.includes('"https://api.example.com/items?'));
    assert.ok(code.includes('page=1'));
    assert.ok(code.includes('apiKey=new-value'));
    assert.ok(!code.includes('apiKey=old-value&apiKey=new-value'));
  });

  it('keeps authorization and custom headers in fetch FormData code while omitting Content-Type', () => {
    const code = CodegenService.generate('fetch', {
      method: 'POST',
      url: 'https://api.example.com/upload',
      headers: [
        { key: 'Content-Type', value: 'multipart/form-data; boundary=wrong', enabled: true },
        { key: 'X-Trace', value: 'trace-1', enabled: true },
      ],
      params: [],
      body: '',
      bodyType: 'formdata',
      formData: [{ id: '1', key: 'name', value: 'demo', enabled: true, type: 'text' }],
      binaryFilePath: '',
      auth: { type: 'bearer', bearer: { token: 'secret' } },
    });

    assert.ok(code.includes('"Authorization": "Bearer secret"'));
    assert.ok(code.includes('"X-Trace": "trace-1"'));
    assert.ok(!code.includes('multipart/form-data; boundary=wrong'));
    assert.ok(code.includes('body: form'));
  });

  it('executes generated fetch FormData and preserves headers, duplicates, and file bytes', async () => {
    const fixturePath = path.join(os.tmpdir(), `tessra-codegen-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
    const fileBytes = Buffer.from([0, 1, 2, 250, 255]);
    fs.writeFileSync(fixturePath, fileBytes);
    try {
      const code = CodegenService.generate('fetch', {
        method: 'POST',
        url: 'https://example.com/upload',
        headers: [
          { key: 'Content-Type', value: 'multipart/form-data; boundary=caller-boundary', enabled: true },
          { key: 'X-Trace', value: 'trace-42', enabled: true },
        ],
        params: [],
        body: '',
        bodyType: 'formdata',
        formData: [
          { id: '1', key: 'tag', value: 'one', enabled: true, type: 'text' },
          { id: '2', key: 'tag', value: 'two', enabled: true, type: 'text' },
          { id: '3', key: 'attachment', value: fixturePath, enabled: true, type: 'file' },
        ],
        binaryFilePath: '',
        auth: { type: 'bearer', bearer: { token: 'generated-token' } },
      });

      const nodeGlobals = globalThis as unknown as {
        FormData: unknown;
        Blob: unknown;
        Request: new (url: string, init?: unknown) => { headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> };
        Response: new (body?: unknown, init?: unknown) => unknown;
      };
      let observed: { contentType: string | null; headers: Record<string, string>; body: Buffer } | undefined;
      const context = vm.createContext({
        require,
        FormData: nodeGlobals.FormData,
        Blob: nodeGlobals.Blob,
        fetch: async (url: string, init: { headers?: Record<string, string>; body?: unknown }) => {
          const request = new nodeGlobals.Request(url, init);
          const body = Buffer.from(await request.arrayBuffer());
          observed = {
            contentType: request.headers.get('content-type'),
            headers: {
              authorization: request.headers.get('authorization') ?? '',
              trace: request.headers.get('x-trace') ?? '',
            },
            body,
          };
          return new nodeGlobals.Response('ok', { status: 201 });
        },
        console: {
          log: () => undefined,
          error: (error: unknown) => { throw error; },
        },
      });

      await vm.runInContext(code, context);
      assert.ok(observed);
      assert.match(observed!.contentType ?? '', /^multipart\/form-data; boundary=.+/);
      assert.strictEqual(observed!.headers.authorization, 'Bearer generated-token');
      assert.strictEqual(observed!.headers.trace, 'trace-42');
      const bodyText = observed!.body.toString('latin1');
      assert.strictEqual((bodyText.match(/name="tag"/g) || []).length, 2);
      assert.ok(bodyText.includes('one'));
      assert.ok(bodyText.includes('two'));
      assert.ok(bodyText.includes(`filename="${path.basename(fixturePath)}"`));
      assert.ok(observed!.body.includes(fileBytes));
    } finally {
      fs.rmSync(fixturePath, { force: true });
    }
  });
});
