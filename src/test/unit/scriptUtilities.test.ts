import * as assert from 'assert';
import * as crypto from 'crypto';
import { ScriptRunner, ScriptableRequest } from '../../services/ScriptRunner';
import { Response } from '../../models/types';

const request: ScriptableRequest = {
  method: 'GET', url: 'https://example.com', headers: [], params: [],
  body: '', bodyType: 'none', formData: [], binaryFilePath: '', auth: { type: 'none' },
};
const response: Response = {
  status: 200, statusText: 'OK', headers: {}, body: '', time: 0, size: 0,
};

for (const phase of ['preRequest', 'test'] as const) {
  describe(`ScriptRunner utilities (${phase})`, () => {
    function run(source: string): Record<string, string> {
      const scripts = { preRequest: '', test: '', [phase]: source };
      const result = phase === 'preRequest'
        ? ScriptRunner.runPreRequest(scripts, request, [])
        : ScriptRunner.runTests(scripts, request, response, []);
      return Object.fromEntries(result.envVariables.map(item => [item.key, item.value]));
    }

    it('matches known SHA-256 vectors, Unicode and block boundaries', () => {
      const inputs = ['', 'abc', 'The quick brown fox jumps over the lazy dog', '테스라', '日本語', '🦊', '\ud800'];
      inputs.push(...[55, 56, 63, 64, 65, 1000].map(length => 'a'.repeat(length)));
      const values = JSON.parse(run(`env.set('hashes', ${JSON.stringify(inputs)}.map(value => pm.crypto.sha256(value)));`).hashes);
      assert.deepStrictEqual(values.slice(0, 3), [
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
      ]);
      assert.deepStrictEqual(values, inputs.map(value => crypto.createHash('sha256').update(value, 'utf8').digest('hex')));
    });

    it('coerces supported primitives consistently across utilities', () => {
      const values = run(`
        const inputs = [42, true, false, 123n, null, undefined];
        env.set('actual', inputs.map(value => [
          pm.crypto.sha256(value), pm.encoding.base64Encode(value),
          pm.crypto.hmacSha256(value, 'secret'), pm.crypto.hmacSha256('payload', value)
        ]));
        env.set('expected', inputs.map(value => [
          pm.crypto.sha256(String(value)), pm.encoding.base64Encode(String(value)),
          pm.crypto.hmacSha256(String(value), 'secret'), pm.crypto.hmacSha256('payload', String(value))
        ]));
      `);
      assert.deepStrictEqual(JSON.parse(values.actual), JSON.parse(values.expected));
    });

    it('rejects objects, arrays, functions and symbols through the execution boundary', () => {
      const values = run(`
        const operations = [
          value => pm.crypto.sha256(value), value => pm.crypto.hmacSha256(value, 'secret'),
          value => pm.crypto.hmacSha256('payload', value), value => pm.encoding.base64Encode(value),
          value => pm.encoding.base64Decode(value)
        ];
        env.set('errors', [{a: 1}, [1, 2], () => 'text', Symbol('text')].flatMap(value =>
          operations.map(operation => {
            try { operation(value); return 'accepted'; }
            catch (error) { return error.name + ': ' + error.message; }
          })
        ));
      `);
      const errors = JSON.parse(values.errors) as string[];
      assert.strictEqual(errors.length, 20);
      errors.forEach(error => assert.match(error, /^TypeError: .*expects a string/));
    });

    it('matches HMAC-SHA256 vectors with message-first arguments and long secrets', () => {
      const pairs = [
        ['what do ya want for nothing?', 'Jefe'], ['payload', 'secret'], ['secret', 'payload'],
        ['', ''], ['메시지', '비밀'], ['日本語 🦊', '비밀'.repeat(40)], ['payload', 'a'.repeat(131)],
      ];
      const values = JSON.parse(run(`env.set('hashes', ${JSON.stringify(pairs)}.map(([message, secret]) => pm.crypto.hmacSha256(message, secret)));`).hashes);
      assert.strictEqual(values[0], '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
      assert.notStrictEqual(values[1], values[2]);
      assert.deepStrictEqual(values, pairs.map(([message, secret]) => crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex')));
    });

    it('encodes and round-trips ASCII, Unicode and empty strings with standard padding', () => {
      const inputs = ['hello', 'hello world', '', 'a', 'ab', '한글', '日本語', 'Tessra 🦊'];
      const values = run(`
        const inputs = ${JSON.stringify(inputs)};
        env.set('encoded', inputs.map(value => pm.encoding.base64Encode(value)));
        env.set('decoded', inputs.map(value => pm.encoding.base64Decode(pm.encoding.base64Encode(value))));
      `);
      assert.deepStrictEqual(JSON.parse(values.encoded), inputs.map(value => Buffer.from(value, 'utf8').toString('base64')));
      assert.deepStrictEqual(JSON.parse(values.decoded), inputs);
    });

    it('allows ASCII whitespace without stripping Base64 alphabet characters', () => {
      const inputs = ['aGVs bG8=\n', 'aGVs\tbG8=\r\n', ' \t\r\n', 'bnVsbA==', 'dG9rZW4=', 'nnnn'];
      const values = run(`env.set('decoded', ${JSON.stringify(inputs)}.map(value => pm.encoding.base64Decode(value)));`);
      assert.deepStrictEqual(JSON.parse(values.decoded), inputs.map(value => Buffer.from(value, 'base64').toString('utf8')));
    });

    it('rejects invalid alphabet, padding and Base64URL', () => {
      for (const value of ['%%%', 'aGVsbG8', 'aGVsbG8===', 'aGVsbG8-', 'aGVsbG8_', '====', 'ab=c', 'aGVs\u00a0bG8=']) {
        assert.throws(() => run(`pm.encoding.base64Decode(${JSON.stringify(value)});`), /Script execution failed:.*Invalid Base64 input/);
      }
    });

    it('provides a fresh pool of distinct RFC 4122 UUID v4 values for each execution', () => {
      const source = `env.set('ids', Array.from({length: ${ScriptRunner.UUID_POOL_SIZE}}, () => pm.uuid()));`;
      const ids = [...JSON.parse(run(source).ids), ...JSON.parse(run(source).ids)] as string[];
      assert.strictEqual(ids.length, ScriptRunner.UUID_POOL_SIZE * 2);
      assert.strictEqual(new Set(ids).size, ids.length);
      ids.forEach(id => assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
      assert.throws(() => run(`for (let i = 0; i <= ${ScriptRunner.UUID_POOL_SIZE}; i++) pm.uuid();`), /UUID utility pool exhausted/);
    });

    it('returns integer Unix seconds and milliseconds within the execution interval', () => {
      const beforeMs = Date.now();
      const values = run(`env.set('unix', pm.time.unix()); env.set('unixMs', pm.time.unixMs());`);
      const afterMs = Date.now();
      const unix = Number(values.unix);
      const unixMs = Number(values.unixMs);
      assert.ok(Number.isInteger(unix));
      assert.ok(Number.isInteger(unixMs));
      assert.ok(unixMs >= beforeMs && unixMs <= afterMs);
      assert.ok(unix >= Math.floor(beforeMs / 1000) && unix <= Math.floor(afterMs / 1000));
    });
  });
}
