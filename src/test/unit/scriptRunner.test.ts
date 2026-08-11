import * as assert from 'assert';
import { ScriptRunner } from '../../services/ScriptRunner';
import { KeyValue, Response } from '../../models/types';

describe('ScriptRunner', () => {
  const request = {
    method: 'GET' as const,
    url: 'https://example.com',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none' as const,
    formData: [],
    binaryFilePath: '',
    auth: { type: 'none' as const },
  };

  const okResponse: Response = {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true }),
    time: 10,
    size: 12,
  };

  it('pre-request 스크립트가 요청과 환경을 수정한다', () => {
    const result = ScriptRunner.runPreRequest(
      {
        preRequest: `request.url = request.url + '/v1'; env.set('token', 'abc');`,
        test: '',
      },
      request,
      [] as KeyValue[]
    );

    assert.strictEqual(result.request.url, 'https://example.com/v1');
    assert.strictEqual(result.envVariables[0].key, 'token');
    assert.strictEqual(result.envVariables[0].value, 'abc');
  });

  it('test 스크립트가 pm.test 결과와 로그를 남긴다', () => {
    const result = ScriptRunner.runTests(
      {
        preRequest: '',
        test: `
          console.log('running tests');
          pm.test('status', function () { pm.response.to.have.status(200); });
          pm.test('json body', function () { pm.expect(pm.response.json()).to.have.property('ok', true); });
        `,
      },
      request,
      okResponse,
      []
    );

    assert.strictEqual(result.result.tests.length, 2);
    assert.ok(result.result.tests.every((test) => test.passed));
    assert.strictEqual(result.result.logs[0].message, 'running tests');
  });

  it('script timeout 값을 설정값 범위로 정규화한다', () => {
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(undefined), 3000);
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(50), 100);
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(5000), 5000);
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(60000), 30000);
  });

  it('설정된 timeout으로 오래 실행되는 script를 중단한다', () => {
    assert.throws(
      () => ScriptRunner.runPreRequest(
        {
          preRequest: 'while (true) {}',
          test: '',
        },
        request,
        [],
        100
      ),
      /Script execution timed out after 100 ms/
    );
  });

  it('exposes Tessra script utilities in pre-request scripts', () => {
    const result = ScriptRunner.runPreRequest(
      {
        preRequest: `
          const signature = pm.crypto.hmacSha256("payload", "secret");
          pm.environment.set("signature", signature);
          pm.environment.set("hash", pm.crypto.sha256("abc"));
          pm.environment.set("requestId", pm.uuid());
          pm.environment.set("timestamp", String(pm.time.unix()));
          pm.environment.set("encoded", pm.encoding.base64Encode("Tessra"));
        `,
        test: '',
      },
      request,
      []
    );

    const values = Object.fromEntries(result.envVariables.map((item) => [item.key, item.value]));
    assert.strictEqual(
      values.hash,
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    assert.match(values.signature, /^[0-9a-f]{64}$/);
    assert.match(values.requestId, /^[0-9a-f-]{36}$/i);
    assert.ok(Number(values.timestamp) > 1_700_000_000);
    assert.strictEqual(values.encoded, pmBase64('Tessra'));
  });

  it('exposes the same utilities in test scripts and records utility failures', () => {
    const result = ScriptRunner.runTests(
      {
        preRequest: '',
        test: `
          pm.test("sha", function () {
            pm.expect(pm.crypto.sha256("abc")).to.equal(
              "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
            );
          });
          pm.test("base64 roundtrip", function () {
            pm.expect(pm.encoding.base64Decode(pm.encoding.base64Encode("Tessra"))).to.equal("Tessra");
          });
          pm.test("invalid base64", function () {
            pm.encoding.base64Decode("%%%");
          });
        `,
      },
      request,
      okResponse,
      []
    );

    assert.strictEqual(result.result.tests[0].passed, true);
    assert.strictEqual(result.result.tests[1].passed, true);
    assert.strictEqual(result.result.tests[2].passed, false);
    assert.match(result.result.tests[2].error || '', /Invalid Base64 input/);
  });

  it('surfaces utility TypeErrors outside pm.test as script execution failures', () => {
    assert.throws(
      () => ScriptRunner.runPreRequest(
        {
          preRequest: 'pm.crypto.sha256({ nested: true });',
          test: '',
        },
        request,
        []
      ),
      /Script execution failed:.*expects a string/
    );
  });

  it('keeps Node runtime APIs inaccessible from the sandbox', () => {
    const probes = [
      'require("fs")',
      'process.env',
      'Buffer.from("x")',
      'global.process',
      'module.exports',
      'crypto.createHash("sha256")',
    ];
    for (const probe of probes) {
      assert.throws(
        () => ScriptRunner.runPreRequest({ preRequest: probe, test: '' }, request, []),
        /Script execution failed/
      );
    }
  });

  it('keeps pm.environment and pm.variables aliases working with utilities', () => {
    const result = ScriptRunner.runPreRequest(
      {
        preRequest: `
          pm.variables.set("nonce", pm.uuid());
          env.set("fromEnvAlias", pm.time.unixMs());
        `,
        test: '',
      },
      request,
      []
    );
    const map = Object.fromEntries(result.envVariables.map((item) => [item.key, item.value]));
    assert.match(map.nonce, /^[0-9a-f-]{36}$/i);
    assert.ok(Number(map.fromEnvAlias) > 0);
  });
});

function pmBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}
