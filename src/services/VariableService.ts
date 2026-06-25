import { KeyValue } from '../models/types';

// {{변수명}} 패턴을 환경변수 값으로 치환
export class VariableService {
  private static readonly PATTERN = /\{\{([^}]+)\}\}/g;
  static readonly DEFAULT_MAX_DEPTH = 10;

  // 문자열 내 모든 {{변수명}}을 치환
  static resolve(text: string, variables: KeyValue[], maxDepth = VariableService.DEFAULT_MAX_DEPTH): string {
    if (!text) { return text; }
    const varMap = this.createVariableMap(variables);
    return this.resolveText(text, varMap, [], 0, Math.max(1, maxDepth));
  }

  static findCircularReferences(text: string, variables: KeyValue[], maxDepth = VariableService.DEFAULT_MAX_DEPTH): string[] {
    if (!text) { return []; }
    const varMap = this.createVariableMap(variables);
    const circular = new Set<string>();
    this.collectCircularReferences(text, varMap, [], 0, Math.max(1, maxDepth), circular);
    return [...circular];
  }

  private static createVariableMap(variables: KeyValue[]): Map<string, string> {
    const varMap = new Map<string, string>();
    for (const v of variables) {
      if (v.enabled && v.key) {
        varMap.set(v.key, v.value);
      }
    }
    return varMap;
  }

  private static resolveText(
    text: string,
    varMap: Map<string, string>,
    stack: string[],
    depth: number,
    maxDepth: number
  ): string {
    return text.replace(this.PATTERN, (match, name) => {
      const trimmed = name.trim();
      if (!varMap.has(trimmed)) { return match; }
      if (stack.includes(trimmed) || depth >= maxDepth) { return `{{${trimmed}}}`; }
      return this.resolveText(varMap.get(trimmed)!, varMap, [...stack, trimmed], depth + 1, maxDepth);
    });
  }

  private static collectCircularReferences(
    text: string,
    varMap: Map<string, string>,
    stack: string[],
    depth: number,
    maxDepth: number,
    circular: Set<string>
  ): void {
    if (depth > maxDepth) { return; }
    for (const match of text.matchAll(this.PATTERN)) {
      const name = match[1]?.trim();
      if (!name || !varMap.has(name)) { continue; }
      const existing = stack.indexOf(name);
      if (existing >= 0) {
        for (const item of stack.slice(existing)) {
          circular.add(item);
        }
        circular.add(name);
        continue;
      }
      this.collectCircularReferences(varMap.get(name)!, varMap, [...stack, name], depth + 1, maxDepth, circular);
    }
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
