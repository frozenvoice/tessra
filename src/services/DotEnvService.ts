import { Environment, KeyValue } from '../models/types';

export type DotEnvDiagnosticKind = 'invalid_line' | 'duplicate_key' | 'unterminated_quote';

export interface DotEnvParseDiagnostic {
  kind: DotEnvDiagnosticKind;
  line: number;
}

export interface DotEnvParseResult {
  variables: Array<{ key: string; value: string }>;
  skippedInvalidLines: number;
  duplicateKeys: number;
  diagnostics: DotEnvParseDiagnostic[];
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Dependency-free `.env` parser for one-time Tessra Environment import.
 * Does not expand `${VAR}` / `$VAR` and never reads process.env.
 */
export class DotEnvService {
  static isDotEnvFileName(fileName: string): boolean {
    const base = basename(fileName).toLowerCase();
    if (!base) { return false; }
    if (base === '.env') { return true; }
    if (base.startsWith('.env.')) { return true; }
    if (base.endsWith('.env')) { return true; }
    return false;
  }

  static isJsonFileName(fileName: string): boolean {
    return basename(fileName).toLowerCase().endsWith('.json');
  }

  static environmentFileBasename(filePath: string): string {
    return basename(filePath);
  }

  /**
   * Decide import path from filename first, then safe content heuristics.
   * JSON parse failures must not be reinterpreted as dotenv.
   */
  static classifyEnvironmentImport(fileName: string, content: string): 'dotenv' | 'json' | 'unsupported' {
    if (this.isJsonFileName(fileName)) { return 'json'; }
    if (this.isDotEnvFileName(fileName)) { return 'dotenv'; }

    const trimmed = stripBom(content).trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) { return 'json'; }
    if (this.looksLikeDotEnv(content)) { return 'dotenv'; }
    return 'unsupported';
  }

  /** Heuristic for All Files picks that are not named like `.env` / `.json`. */
  static looksLikeDotEnv(content: string): boolean {
    const text = stripBom(content);
    const trimmed = text.trimStart();
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return false;
    }

    for (const line of text.split(/\r?\n/)) {
      const candidate = line.trim();
      if (!candidate || candidate.startsWith('#')) { continue; }
      const withoutExport = candidate.replace(/^export\s+/i, '');
      const eq = withoutExport.indexOf('=');
      if (eq <= 0) { continue; }
      const key = withoutExport.slice(0, eq).trim();
      if (KEY_PATTERN.test(key)) {
        return true;
      }
    }
    return false;
  }

  static parse(content: string): DotEnvParseResult {
    const text = stripBom(content);
    const diagnostics: DotEnvParseDiagnostic[] = [];
    const order: string[] = [];
    const values = new Map<string, string>();
    let skippedInvalidLines = 0;
    let duplicateKeys = 0;

    const markInvalid = (line: number, kind: DotEnvDiagnosticKind = 'invalid_line'): void => {
      skippedInvalidLines += 1;
      diagnostics.push({ kind, line });
    };

    const commit = (key: string, value: string, line: number): void => {
      if (!KEY_PATTERN.test(key)) {
        markInvalid(line);
        return;
      }
      if (values.has(key)) {
        duplicateKeys += 1;
        diagnostics.push({ kind: 'duplicate_key', line });
      } else {
        order.push(key);
      }
      values.set(key, value);
    };

    let index = 0;
    let lineNumber = 1;

    while (index < text.length) {
      // Skip blank lines and full-line comments.
      while (index < text.length) {
        const start = index;
        const lineStartNumber = lineNumber;
        const physical = readPhysicalLine(text, index, lineNumber);
        const trimmed = physical.line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          index = physical.nextIndex;
          lineNumber = physical.nextLineNumber;
          continue;
        }
        index = start;
        lineNumber = lineStartNumber;
        break;
      }
      if (index >= text.length) { break; }

      const assignmentLine = lineNumber;
      const physical = readPhysicalLine(text, index, lineNumber);
      const line = physical.line;
      index = physical.nextIndex;
      lineNumber = physical.nextLineNumber;

      let body = line.trim();
      if (/^export\s+/i.test(body)) {
        body = body.replace(/^export\s+/i, '').trimStart();
      }

      const eq = body.indexOf('=');
      if (eq <= 0) {
        markInvalid(assignmentLine);
        continue;
      }

      const key = body.slice(0, eq).trim();
      if (!key) {
        markInvalid(assignmentLine);
        continue;
      }

      const rawValue = body.slice(eq + 1);
      const first = firstNonWhitespace(rawValue);
      if (!first) {
        commit(key, '', assignmentLine);
        continue;
      }

      if (first.ch === '"' || first.ch === "'") {
        const quote = first.ch as '"' | "'";
        const openInLine = line.indexOf(quote, line.indexOf('='));
        if (openInLine < 0) {
          markInvalid(assignmentLine);
          continue;
        }

        const afterOpen = physical.lineStart + openInLine + 1;
        const quoted = readQuotedFrom(text, afterOpen, quote, assignmentLine);
        if (!quoted.closed) {
          markInvalid(assignmentLine, 'unterminated_quote');
          index = text.length;
          break;
        }
        index = quoted.nextIndex;
        lineNumber = quoted.nextLineNumber;
        commit(key, quoted.value, assignmentLine);
        continue;
      }

      const hash = findUnquotedCommentStart(rawValue);
      const unquoted = (hash >= 0 ? rawValue.slice(0, hash) : rawValue).trim();
      commit(key, unquoted, assignmentLine);
    }

    return {
      variables: order.map((key) => ({ key, value: values.get(key) ?? '' })),
      skippedInvalidLines,
      duplicateKeys,
      diagnostics,
    };
  }

  static toEnvironment(id: string, name: string, parsed: DotEnvParseResult): Environment {
    const variables: KeyValue[] = parsed.variables.map((entry) => ({
      key: entry.key,
      value: entry.value,
      enabled: true,
    }));
    return { id, name, variables };
  }

  static createUniqueEnvironmentName(name: string, environments: readonly Environment[]): string {
    const existingNames = new Set(environments.map((environment) => environment.name));
    if (!existingNames.has(name)) { return name; }

    let index = 2;
    let candidate = `${name} (${index})`;
    while (existingNames.has(candidate)) {
      index += 1;
      candidate = `${name} (${index})`;
    }
    return candidate;
  }
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

function readPhysicalLine(text: string, start: number, currentLine: number): {
  line: string;
  lineStart: number;
  nextIndex: number;
  nextLineNumber: number;
} {
  let index = start;
  while (index < text.length) {
    const ch = text[index];
    if (ch === '\n') {
      return {
        line: text.slice(start, index),
        lineStart: start,
        nextIndex: index + 1,
        nextLineNumber: currentLine + 1,
      };
    }
    if (ch === '\r') {
      const next = index + 1 < text.length && text[index + 1] === '\n' ? index + 2 : index + 1;
      return {
        line: text.slice(start, index),
        lineStart: start,
        nextIndex: next,
        nextLineNumber: currentLine + 1,
      };
    }
    index += 1;
  }
  return {
    line: text.slice(start),
    lineStart: start,
    nextIndex: text.length,
    nextLineNumber: currentLine + (start < text.length ? 1 : 0),
  };
}

function firstNonWhitespace(value: string): { ch: string; index: number } | null {
  for (let i = 0; i < value.length; i++) {
    if (!/\s/.test(value[i])) {
      return { ch: value[i], index: i };
    }
  }
  return null;
}

function readQuotedFrom(
  text: string,
  start: number,
  quote: '"' | "'",
  startLine: number
): { closed: boolean; value: string; nextIndex: number; nextLineNumber: number } {
  let value = '';
  let index = start;
  let lineNumber = startLine;

  while (index < text.length) {
    const ch = text[index];

    if (ch === quote) {
      index += 1;
      while (index < text.length && text[index] !== '\n' && text[index] !== '\r') {
        index += 1;
      }
      if (text[index] === '\r') {
        index += 1;
        if (text[index] === '\n') { index += 1; }
        lineNumber += 1;
      } else if (text[index] === '\n') {
        index += 1;
        lineNumber += 1;
      }
      return { closed: true, value, nextIndex: index, nextLineNumber: lineNumber };
    }

    if (quote === '"' && ch === '\\' && index + 1 < text.length) {
      const next = text[index + 1];
      if (next === '\r' || next === '\n') {
        index += 1;
        if (text[index] === '\r') {
          index += 1;
          if (text[index] === '\n') { index += 1; }
        } else if (text[index] === '\n') {
          index += 1;
        }
        lineNumber += 1;
        continue;
      }
      value += decodeDoubleEscape(next);
      index += 2;
      continue;
    }

    if (quote === "'" && ch === '\\' && index + 1 < text.length && text[index + 1] === "'") {
      value += "'";
      index += 2;
      continue;
    }

    if (ch === '\r') {
      value += '\n';
      index += 1;
      if (text[index] === '\n') { index += 1; }
      lineNumber += 1;
      continue;
    }
    if (ch === '\n') {
      value += '\n';
      index += 1;
      lineNumber += 1;
      continue;
    }

    value += ch;
    index += 1;
  }

  return { closed: false, value, nextIndex: text.length, nextLineNumber: lineNumber };
}

function decodeDoubleEscape(ch: string): string {
  switch (ch) {
    case 'n': return '\n';
    case 'r': return '\r';
    case 't': return '\t';
    case '"': return '"';
    case '\\': return '\\';
    default: return ch;
  }
}

function findUnquotedCommentStart(value: string): number {
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '#' && (i === 0 || /\s/.test(value[i - 1]))) {
      return i;
    }
  }
  return -1;
}
