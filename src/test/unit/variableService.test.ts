import * as assert from 'assert';
import { VariableService } from '../../services/VariableService';
import { KeyValue } from '../../models/types';

// {{변수}} 치환 테스트
describe('VariableService', () => {
  const vars: KeyValue[] = [
    { key: 'baseUrl', value: 'https://api.example.com', enabled: true },
    { key: 'token', value: 'abc123', enabled: true },
    { key: 'disabled', value: 'should-not-appear', enabled: false },
    { key: 'port', value: '8080', enabled: true },
  ];

  describe('resolve', () => {
    it('단일 변수 치환', () => {
      const result = VariableService.resolve('{{baseUrl}}/users', vars);
      assert.strictEqual(result, 'https://api.example.com/users');
    });

    it('복수 변수 치환', () => {
      const result = VariableService.resolve('{{baseUrl}}:{{port}}/api', vars);
      assert.strictEqual(result, 'https://api.example.com:8080/api');
    });

    it('비활성 변수는 치환하지 않음', () => {
      const result = VariableService.resolve('{{disabled}}', vars);
      assert.strictEqual(result, '{{disabled}}');
    });

    it('존재하지 않는 변수는 원본 유지', () => {
      const result = VariableService.resolve('{{unknown}}', vars);
      assert.strictEqual(result, '{{unknown}}');
    });

    it('변수명 앞뒤 공백 무시', () => {
      const result = VariableService.resolve('{{ baseUrl }}', vars);
      assert.strictEqual(result, 'https://api.example.com');
    });

    it('빈 문자열 입력', () => {
      const result = VariableService.resolve('', vars);
      assert.strictEqual(result, '');
    });

    it('변수 없는 문자열은 그대로 반환', () => {
      const result = VariableService.resolve('no variables here', vars);
      assert.strictEqual(result, 'no variables here');
    });

    it('중첩 중괄호 처리 (변수 아님)', () => {
      const result = VariableService.resolve('{not a var}', vars);
      assert.strictEqual(result, '{not a var}');
    });

    it('같은 변수 여러 번 치환', () => {
      const result = VariableService.resolve('{{token}}-{{token}}', vars);
      assert.strictEqual(result, 'abc123-abc123');
    });
  });

  describe('resolveKeyValues', () => {
    it('key와 value 모두 치환', () => {
      const input: KeyValue[] = [
        { key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
        { key: '{{baseUrl}}', value: '{{port}}', enabled: true },
      ];
      const result = VariableService.resolveKeyValues(input, vars);
      assert.strictEqual(result[0].key, 'Authorization');
      assert.strictEqual(result[0].value, 'Bearer abc123');
      assert.strictEqual(result[1].key, 'https://api.example.com');
      assert.strictEqual(result[1].value, '8080');
    });

    it('enabled 상태 보존', () => {
      const input: KeyValue[] = [
        { key: 'X-Key', value: '{{token}}', enabled: false },
      ];
      const result = VariableService.resolveKeyValues(input, vars);
      assert.strictEqual(result[0].enabled, false);
      assert.strictEqual(result[0].value, 'abc123');
    });

    it('빈 배열 입력', () => {
      const result = VariableService.resolveKeyValues([], vars);
      assert.deepStrictEqual(result, []);
    });
  });
});
