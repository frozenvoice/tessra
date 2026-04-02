import { KeyValue } from '../models/types';

// {{변수명}} 패턴을 환경변수 값으로 치환
export class VariableService {
  private static readonly PATTERN = /\{\{([^}]+)\}\}/g;

  // 문자열 내 모든 {{변수명}}을 치환
  static resolve(text: string, variables: KeyValue[]): string {
    if (!text) { return text; }

    // 활성화된 변수만 맵으로 구성
    const varMap = new Map<string, string>();
    for (const v of variables) {
      if (v.enabled && v.key) {
        varMap.set(v.key, v.value);
      }
    }

    return text.replace(this.PATTERN, (match, name) => {
      const trimmed = name.trim();
      return varMap.has(trimmed) ? varMap.get(trimmed)! : match;
    });
  }

  // KeyValue 배열의 key, value 모두 치환
  static resolveKeyValues(kvs: KeyValue[], variables: KeyValue[]): KeyValue[] {
    return kvs.map((kv) => ({
      key: this.resolve(kv.key, variables),
      value: this.resolve(kv.value, variables),
      enabled: kv.enabled,
    }));
  }
}
