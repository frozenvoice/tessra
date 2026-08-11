import * as assert from 'assert';
import { DotEnvService } from '../../services/DotEnvService';
import { Environment } from '../../models/types';

describe('DotEnvService', () => {
  describe('file name detection', () => {
    it('recognizes common .env filenames across path separators', () => {
      assert.strictEqual(DotEnvService.isDotEnvFileName('.env'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('.env.local'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('.env.development'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('.env.production'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('.env.test'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('.env.example'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('production.env'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('staging.env'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('C:\\proj\\.env.local'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('/home/runner/work/app/.env'), true);
      assert.strictEqual(DotEnvService.isDotEnvFileName('env.json'), false);
      assert.strictEqual(DotEnvService.isJsonFileName('env.json'), true);
    });
  });

  describe('parse', () => {
    it('parses KEY=value and empty values', () => {
      const parsed = DotEnvService.parse('KEY=value\nEMPTY=\n');
      assert.deepStrictEqual(parsed.variables, [
        { key: 'KEY', value: 'value' },
        { key: 'EMPTY', value: '' },
      ]);
    });

    it('trims whitespace around keys and unquoted values', () => {
      const parsed = DotEnvService.parse('KEY = value\nKEY2= value\nKEY3 =value\n');
      assert.deepStrictEqual(parsed.variables, [
        { key: 'KEY', value: 'value' },
        { key: 'KEY2', value: 'value' },
        { key: 'KEY3', value: 'value' },
      ]);
    });

    it('ignores blank lines and full-line comments', () => {
      const parsed = DotEnvService.parse('\n# full line comment\n\nKEY=value\n');
      assert.deepStrictEqual(parsed.variables, [{ key: 'KEY', value: 'value' }]);
      assert.strictEqual(parsed.skippedInvalidLines, 0);
    });

    it('supports double and single quoted values including #', () => {
      const parsed = DotEnvService.parse([
        'A="hello world"',
        "B='hello world'",
        'C="hello # world"',
        "D='hello # world'",
      ].join('\n'));
      assert.deepStrictEqual(parsed.variables, [
        { key: 'A', value: 'hello world' },
        { key: 'B', value: 'hello world' },
        { key: 'C', value: 'hello # world' },
        { key: 'D', value: 'hello # world' },
      ]);
    });

    it('strips unquoted inline comments', () => {
      const parsed = DotEnvService.parse('KEY=value # comment\nURL=https://example.com?a=1#frag\n');
      assert.strictEqual(parsed.variables.find((v) => v.key === 'KEY')?.value, 'value');
      // `#frag` has no preceding whitespace, so it stays in the value.
      assert.strictEqual(parsed.variables.find((v) => v.key === 'URL')?.value, 'https://example.com?a=1#frag');
    });

    it('supports export prefix and = inside values', () => {
      const parsed = DotEnvService.parse([
        'export API_URL=https://example.com',
        'export TOKEN="abc"',
        'TOKEN2=abc=def==',
        'URL=https://example.com?a=1&b=2',
      ].join('\n'));
      assert.deepStrictEqual(parsed.variables, [
        { key: 'API_URL', value: 'https://example.com' },
        { key: 'TOKEN', value: 'abc' },
        { key: 'TOKEN2', value: 'abc=def==' },
        { key: 'URL', value: 'https://example.com?a=1&b=2' },
      ]);
    });

    it('supports CRLF and UTF-8 BOM without attaching BOM to the first key', () => {
      const parsed = DotEnvService.parse('\uFEFFAPI_URL=https://example.com\r\nTOKEN=abc\r\n');
      assert.deepStrictEqual(parsed.variables.map((v) => v.key), ['API_URL', 'TOKEN']);
      assert.strictEqual(parsed.variables[0].value, 'https://example.com');
    });

    it('uses last assignment wins while preserving first-seen key order', () => {
      const parsed = DotEnvService.parse([
        'API_URL=https://a.example',
        'TOKEN=one',
        'API_URL=https://b.example',
      ].join('\n'));
      assert.deepStrictEqual(parsed.variables, [
        { key: 'API_URL', value: 'https://b.example' },
        { key: 'TOKEN', value: 'one' },
      ]);
      assert.strictEqual(parsed.duplicateKeys, 1);
    });

    it('keeps ${VAR} and $VAR literals without expansion', () => {
      const parsed = DotEnvService.parse('API=${BASE}/api\nHOME2=$HOME\n');
      assert.deepStrictEqual(parsed.variables, [
        { key: 'API', value: '${BASE}/api' },
        { key: 'HOME2', value: '$HOME' },
      ]);
    });

    it('skips invalid lines and continues', () => {
      const parsed = DotEnvService.parse('GOOD=1\nTHIS IS NOT VALID\nALSO_GOOD=2\n');
      assert.deepStrictEqual(parsed.variables, [
        { key: 'GOOD', value: '1' },
        { key: 'ALSO_GOOD', value: '2' },
      ]);
      assert.strictEqual(parsed.skippedInvalidLines, 1);
    });

    it('returns zero variables for empty or comment-only files', () => {
      assert.strictEqual(DotEnvService.parse('').variables.length, 0);
      assert.strictEqual(DotEnvService.parse('# only\n\n').variables.length, 0);
    });

    it('marks unterminated quotes as malformed', () => {
      const parsed = DotEnvService.parse('GOOD=1\nBAD="unterminated\n');
      assert.deepStrictEqual(parsed.variables, [{ key: 'GOOD', value: '1' }]);
      assert.ok(parsed.diagnostics.some((d) => d.kind === 'unterminated_quote'));
      assert.ok(parsed.skippedInvalidLines >= 1);
    });

    it('decodes common double-quoted escapes', () => {
      const parsed = DotEnvService.parse('A="line\\nnext"\nB="tab\\there"\nC="quote\\"x\\\\y"\n');
      assert.strictEqual(parsed.variables.find((v) => v.key === 'A')?.value, 'line\nnext');
      assert.strictEqual(parsed.variables.find((v) => v.key === 'B')?.value, 'tab\there');
      assert.strictEqual(parsed.variables.find((v) => v.key === 'C')?.value, 'quote"x\\y');
    });

    it('supports multiline double-quoted values', () => {
      const parsed = DotEnvService.parse([
        'PRIVATE_KEY="-----BEGIN KEY-----',
        'abc',
        'def',
        '-----END KEY-----"',
        'AFTER=1',
      ].join('\n'));
      assert.strictEqual(
        parsed.variables.find((v) => v.key === 'PRIVATE_KEY')?.value,
        '-----BEGIN KEY-----\nabc\ndef\n-----END KEY-----'
      );
      assert.strictEqual(parsed.variables.find((v) => v.key === 'AFTER')?.value, '1');
    });

    it('preserves unicode values', () => {
      const parsed = DotEnvService.parse('NAME=테스라\nNOTE="日本語"\n');
      assert.deepStrictEqual(parsed.variables, [
        { key: 'NAME', value: '테스라' },
        { key: 'NOTE', value: '日本語' },
      ]);
    });

    it('does not put secret values into diagnostics', () => {
      const secret = 'super-secret-token-value';
      const parsed = DotEnvService.parse(`TOKEN=${secret}\nBAD LINE\n`);
      const blob = JSON.stringify(parsed.diagnostics);
      assert.ok(!blob.includes(secret));
    });
  });

  describe('environment conversion and naming', () => {
    it('creates environments with all variables enabled and basename-friendly names', () => {
      const parsed = DotEnvService.parse('API_URL=https://api.example.com\nTOKEN=abc123\nDEBUG=true\n');
      const env = DotEnvService.toEnvironment('id-1', '.env', parsed);
      assert.strictEqual(env.name, '.env');
      assert.ok(env.variables.every((variable) => variable.enabled === true));
      assert.deepStrictEqual(env.variables.map((v) => v.key), ['API_URL', 'TOKEN', 'DEBUG']);
    });

    it('creates unique environment names without overwriting', () => {
      const existing: Environment[] = [
        { id: '1', name: '.env', variables: [] },
        { id: '2', name: '.env (2)', variables: [] },
      ];
      assert.strictEqual(DotEnvService.createUniqueEnvironmentName('.env', existing), '.env (3)');
      assert.strictEqual(DotEnvService.createUniqueEnvironmentName('Demo', []), 'Demo');
      // Existing environments remain untouched.
      assert.deepStrictEqual(existing.map((e) => e.name), ['.env', '.env (2)']);
    });
  });

  describe('looksLikeDotEnv', () => {
    it('accepts assignment text and rejects JSON-looking payloads', () => {
      assert.strictEqual(DotEnvService.looksLikeDotEnv('FOO=bar\n'), true);
      assert.strictEqual(DotEnvService.looksLikeDotEnv('{"name":"Demo","values":[]}'), false);
    });
  });
});
