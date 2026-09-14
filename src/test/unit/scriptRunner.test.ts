import * as assert from 'assert';
import * as vm from 'vm';
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
          pm.environment.set("emptyDecoded", pm.encoding.base64Decode(""));
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
    assert.strictEqual(values.emptyDecoded, '');
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

  it('decodes Base64 alphabet characters and ignores only supported whitespace', () => {
    const inputs = ['bnVsbA==', 'dG9rZW4=', 'nnnn', 'aGVs\nbG8=', 'aGVs\tbG8=', 'aGVs\r\nbG8=', 'aGVs bG8=', ' \t\r\n'];
    const result = ScriptRunner.runPreRequest({
      preRequest: `env.set('decoded', ${JSON.stringify(inputs)}.map(value => pm.encoding.base64Decode(value)));`,
      test: '',
    }, request, []);
    assert.deepStrictEqual(JSON.parse(result.envVariables[0].value), inputs.map(value => Buffer.from(value, 'base64').toString('utf8')));
    for (const value of ['aGVs\\nbG8=', 'abc', '====', 'ab=c', '____']) {
      assert.throws(() => ScriptRunner.runPreRequest({
        preRequest: `pm.encoding.base64Decode(${JSON.stringify(value)});`, test: '',
      }, request, []), /Invalid Base64 input/);
    }
  });

  it('matches Buffer UTF-8 replacement and always finishes on malformed byte sequences', () => {
    const sequences = [
      [0xc2], [0xc2, 0x28], [0xe2], [0xe2, 0x82], [0xe2, 0x82, 0x28], [0xf0],
      [0xf0, 0x90, 0x80], [0xf0, 0x90, 0x28, 0x80], [0xe0, 0x80, 0x80],
      [0xed, 0xa0, 0x80], [0xf0, 0x80, 0x80, 0x80], [0xf4, 0x90, 0x80, 0x80],
      [0xef, 0xbb, 0xbf], [0xf0, 0x9f, 0x98, 0x80],
    ];
    for (let byte = 0; byte < 256; byte++) {
      sequences.push([byte], [byte, 0x80], [byte, 0x9f, 0xbf, 0x41], [0xe0, byte, 0x80], [0xed, byte, 0x80], [0xf0, byte, 0x80, 0x80], [0xf4, byte, 0x80, 0x80]);
    }
    const buffers = sequences.map(bytes => Buffer.from(bytes));
    const encoded = buffers.map(bytes => bytes.toString('base64'));
    const result = ScriptRunner.runTests({
      preRequest: '',
      test: `env.set('decoded', ${JSON.stringify(encoded)}.map(value => pm.encoding.base64Decode(value)));`,
    }, request, okResponse, [], 1000);
    assert.deepStrictEqual(JSON.parse(result.envVariables[0].value), buffers.map(bytes => bytes.toString('utf8')));
  });

  const equalityCases = [
    '[new Date(0), new Date(1)]', '[new Date(1), new Date(1)]',
    '[new Map([["a", 1]]), new Map([["a", 2]])]',
    '[new Map([[{a: 1}, 2], ["b", 3]]), new Map([["b", 3], [{a: 1}, 2]])]',
    '[new Set([1]), new Set([2])]', '[new Set([{a: 1}, {a: 2}]), new Set([{a: 2}, {a: 1}])]',
    '[new Set([{a: 1}, {a: 1}]), new Set([{a: 1}, {a: 2}])]',
    '[/a/, /b/]', '[/a/g, /a/i]', '[/a/g, /a/g]',
    '[Object.assign(/a/g, {lastIndex: 1}), /a/g]',
    '[Array(1), []]', '[Array(1), [undefined]]', '[Array(2), Array(2)]',
    '[{a: [1, {b: true}]}, {a: [1, {b: true}]}]', '[Object.create(null), {}]',
    '(() => { class A {} class B {} return [new A(), new B()]; })()',
    '(() => { const a = {}; a.self = a; const b = {}; b.self = b; return [a, b]; })()',
    '(() => { const a = {n: 1}; a.self = a; const b = {n: 2}; b.self = b; return [a, b]; })()',
    '(() => { const a = new Map(); a.set(a, a); const b = new Map(); b.set(b, b); return [a, b]; })()',
    '(() => { const a = new Set(); a.add(a); const b = new Set(); b.add(b); return [a, b]; })()',
    '(() => { const k = Symbol("k"); return [{[k]: 1}, {[k]: 2}]; })()',
    '(() => { const k = Symbol("k"); return [{[k]: 1}, {[k]: 1}]; })()',
    '[new Uint8Array([1]), new Uint8Array([2])]', '[new Uint8Array([1]), new Uint8Array([1])]',
    '[new Uint8Array([1]).buffer, new Uint8Array([2]).buffer]',
    '[new DataView(new Uint8Array([1]).buffer), new DataView(new Uint8Array([2]).buffer)]',
    '[new Number(1), new Number(2)]', '[new Number(NaN), new Number(NaN)]',
    '[new Boolean(true), new Boolean(false)]', '[new String("a"), new String("b")]',
    '[new Error("a"), new Error("b")]', '[new Error("a"), new Error("a")]',
    '[NaN, NaN]', '[0, -0]',
  ];
  for (const pair of equalityCases) {
    it(`preserves deep assertion semantics: ${pair}`, () => {
      const [left, right] = vm.runInNewContext(pair);
      let expected = true;
      try { assert.deepStrictEqual(left, right); } catch { expected = false; }
      const result = ScriptRunner.runTests({
        preRequest: '',
        test: `const [left, right] = ${pair};
          pm.test('eql', () => pm.expect(left).to.eql(right));
          pm.test('property', () => pm.expect({value: left}).to.have.property('value', right));`,
      }, request, okResponse, []);
      assert.deepStrictEqual(result.result.tests.map(item => item.passed), [expected, expected]);
    });
  }

  it('preserves Object.is equal and SameValueZero array include semantics', () => {
    const result = ScriptRunner.runTests({ preRequest: '', test: `
      pm.test('NaN equal', () => pm.expect(NaN).to.equal(NaN));
      pm.test('signed zero equal', () => pm.expect(0).to.equal(-0));
      pm.test('NaN included', () => pm.expect([NaN]).to.include(NaN));
      pm.test('signed zero included', () => pm.expect([0]).to.include(-0));
    ` }, request, okResponse, []);
    assert.deepStrictEqual(result.result.tests.map(item => item.passed), [true, false, true, true]);
  });

  it('rejects unsupported opaque comparisons instead of claiming equality', () => {
    const result = ScriptRunner.runTests({ preRequest: '', test: `
      pm.test('weak map', () => pm.expect(new WeakMap()).to.eql(new WeakMap()));
      pm.test('promise', () => pm.expect(Promise.resolve(1)).to.eql(Promise.resolve(2)));
    ` }, request, okResponse, []);
    assert.ok(result.result.tests.every(item => !item.passed));
  });

  it('reports recursive microtask exhaustion as a timeout', () => {
    for (const source of [
      'function next() { Promise.resolve().then(next); } next();',
      'function next() { Promise.resolve().then(next); } next(); throw new Error("earlier error");',
    ]) {
      assert.throws(() => ScriptRunner.runPreRequest({ preRequest: source, test: '' }, request, [], 100), /Script execution timed out after 100 ms/);
    }
    const completed = ScriptRunner.runPreRequest({ preRequest: 'Promise.resolve().then(() => Promise.resolve().then(() => env.set("finished", true)));', test: '' }, request, []);
    assert.strictEqual(completed.envVariables[0].value, 'true');
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

  it('rejects direct references to Node runtime globals', () => {
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

  it('빈 script는 빈 key를 포함한 environment 행을 그대로 보존한다', () => {
    const variables = [{ key: '', value: 'draft', enabled: false }];
    const result = ScriptRunner.runPreRequest({ preRequest: '', test: '' }, request, variables);
    assert.deepStrictEqual(result.envVariables, variables);
  });

  it('blocks constructor-chain escapes from globals, exposed functions, errors, and results', () => {
    const preRequestProbes = [
      'globalThis.constructor.constructor("return process")()',
      'request.constructor.constructor("return process")()',
      'pm.environment.set.constructor("return process")()',
      'console.log.constructor("return process")()',
    ];
    for (const probe of preRequestProbes) {
      assert.throws(
        () => ScriptRunner.runPreRequest({ preRequest: probe, test: '' }, request, []),
        /Script execution failed/
      );
    }

    const result = ScriptRunner.runTests(
      {
        preRequest: '',
        test: `
          pm.test('error is realm-owned', function () {
            try {
              throw new Error('expected failure');
            } catch (error) {
              error.constructor.constructor('return process')();
            }
          });
          pm.test('response result is realm-owned', function () {
            pm.response.json().constructor.constructor('return process')();
          });
        `,
      },
      request,
      okResponse,
      []
    );

    assert.strictEqual(result.result.tests.length, 2);
    assert.ok(result.result.tests.every((test) => !test.passed));
    assert.match(result.result.tests[0].error || '', /Code generation from strings disallowed/);
    assert.match(result.result.tests[1].error || '', /Code generation from strings disallowed/);
  });

  it('disallows eval and Function string compilation while preserving timeout enforcement', () => {
    for (const probe of ['eval("process")', 'Function("return process")()']) {
      assert.throws(
        () => ScriptRunner.runPreRequest({ preRequest: probe, test: '' }, request, []),
        /Script execution failed.*Code generation from strings disallowed/
      );
    }
    assert.throws(
      () => ScriptRunner.runPreRequest({ preRequest: 'while (true) {}', test: '' }, request, [], 100),
      /Script execution timed out after 100 ms/
    );
    assert.throws(
      () => ScriptRunner.runPreRequest(
        { preRequest: 'throw { get message() { while (true) {} } };', test: '' },
        request,
        [],
        100
      ),
      /Script execution timed out after 100 ms/
    );
  });

  it('preserves a useful syntax error without evaluating user code', () => {
    assert.throws(
      () => ScriptRunner.runPreRequest({ preRequest: 'const broken = ;', test: '' }, request, []),
      /Script execution failed:.*Unexpected token/
    );
  });

  it('bounds Promise microtasks and the realm UUID pool', () => {
    assert.throws(
      () => ScriptRunner.runPreRequest(
        { preRequest: 'Promise.resolve().then(function () { while (true) {} });', test: '' },
        request,
        [],
        100
      ),
      /Script execution timed out after 100 ms/
    );
    assert.throws(
      () => ScriptRunner.runPreRequest(
        { preRequest: 'for (let index = 0; index < 257; index += 1) { pm.uuid(); }', test: '' },
        request,
        []
      ),
      /UUID utility pool exhausted/
    );
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
