import * as assert from 'assert';
import { ScriptUtilities } from '../../services/ScriptUtilities';

describe('ScriptUtilities', () => {
  describe('sha256', () => {
    it('matches known vectors including empty and unicode', () => {
      assert.strictEqual(
        ScriptUtilities.sha256(''),
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
      assert.strictEqual(
        ScriptUtilities.sha256('abc'),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
      );
      assert.strictEqual(
        ScriptUtilities.sha256('The quick brown fox jumps over the lazy dog'),
        'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'
      );
      const korean = ScriptUtilities.sha256('테스라');
      assert.match(korean, /^[0-9a-f]{64}$/);
      assert.strictEqual(ScriptUtilities.sha256('테스라'), korean);
      assert.match(ScriptUtilities.sha256('日本語'), /^[0-9a-f]{64}$/);
      assert.match(ScriptUtilities.sha256('🦊'), /^[0-9a-f]{64}$/);
    });

    it('is deterministic and rejects objects', () => {
      assert.strictEqual(ScriptUtilities.sha256(42), ScriptUtilities.sha256('42'));
      assert.throws(() => ScriptUtilities.sha256({ a: 1 }), /expects a string/);
      assert.throws(() => ScriptUtilities.sha256([1, 2]), /expects a string/);
    });
  });

  describe('hmacSha256', () => {
    it('matches RFC 4231-style known vector and argument order', () => {
      // RFC 4231 Test Case 2
      assert.strictEqual(
        ScriptUtilities.hmacSha256('what do ya want for nothing?', 'Jefe'),
        '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
      );
      const forward = ScriptUtilities.hmacSha256('payload', 'secret');
      const swapped = ScriptUtilities.hmacSha256('secret', 'payload');
      assert.notStrictEqual(forward, swapped);
      assert.match(forward, /^[0-9a-f]{64}$/);
    });

    it('supports empty message/secret and unicode', () => {
      assert.match(ScriptUtilities.hmacSha256('', ''), /^[0-9a-f]{64}$/);
      assert.match(ScriptUtilities.hmacSha256('메시지', '비밀'), /^[0-9a-f]{64}$/);
    });
  });

  describe('base64', () => {
    it('encodes ASCII/unicode/empty with standard padding', () => {
      assert.strictEqual(ScriptUtilities.base64Encode('hello'), 'aGVsbG8=');
      assert.strictEqual(ScriptUtilities.base64Encode('hello world'), 'aGVsbG8gd29ybGQ=');
      assert.strictEqual(ScriptUtilities.base64Encode(''), '');
      assert.strictEqual(ScriptUtilities.base64Encode('한글'), Buffer.from('한글', 'utf8').toString('base64'));
      assert.strictEqual(ScriptUtilities.base64Encode('日本語'), Buffer.from('日本語', 'utf8').toString('base64'));
      assert.ok(ScriptUtilities.base64Encode('a').endsWith('==') || ScriptUtilities.base64Encode('a').includes('='));
    });

    it('round-trips unicode and permits ASCII whitespace on decode', () => {
      const encoded = ScriptUtilities.base64Encode('Tessra 🦊');
      assert.strictEqual(ScriptUtilities.base64Decode(encoded), 'Tessra 🦊');
      assert.strictEqual(ScriptUtilities.base64Decode('aGVs bG8=\n'), 'hello');
    });

    it('rejects invalid alphabet, padding, and Base64URL', () => {
      assert.throws(() => ScriptUtilities.base64Decode('%%%'), /Invalid Base64 input/);
      assert.throws(() => ScriptUtilities.base64Decode('aGVsbG8'), /Invalid Base64 input/); // missing padding
      assert.throws(() => ScriptUtilities.base64Decode('aGVsbG8==='), /Invalid Base64 input/);
      assert.throws(() => ScriptUtilities.base64Decode('aGVsbG8-'), /Invalid Base64 input/);
      assert.throws(() => ScriptUtilities.base64Decode('aGVsbG8_'), /Invalid Base64 input/);
    });
  });

  describe('uuid and time', () => {
    it('returns RFC 4122 UUID v4 with version/variant nibble', () => {
      const a = ScriptUtilities.uuidV4();
      const b = ScriptUtilities.uuidV4();
      assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.match(b, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.notStrictEqual(a, b);
    });

    it('returns unix seconds/ms in a plausible range', () => {
      const beforeMs = Date.now();
      const unix = ScriptUtilities.unixSeconds();
      const unixMs = ScriptUtilities.unixMilliseconds();
      const afterMs = Date.now();
      assert.ok(Number.isInteger(unix));
      assert.ok(Number.isInteger(unixMs));
      assert.ok(unixMs >= beforeMs && unixMs <= afterMs);
      assert.ok(unix >= Math.floor(beforeMs / 1000) && unix <= Math.floor(afterMs / 1000));
      assert.ok(Math.abs(unixMs - unix * 1000) < 1000);
    });
  });
});
