import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export type CompareMode = 'raw' | 'normalized' | 'pretty';

export interface CompareSettings {
  mode: CompareMode;
  includeMetadataSummary: boolean;
  foldUnchangedSections: boolean;
  ignoreHeaders: string[];
  ignoreJsonPaths: string[];
}

export interface ResponseCompareSnapshot {
  label: string;
  body: string;
  bodyBase64?: string;
  contentType: string;
  status?: number;
  statusText?: string;
  size?: number;
  time?: number;
  resolvedUrl?: string;
  headers?: Record<string, string> | Array<{ key: string; value: string }>;
  timestamp?: number;
  jsonFormatStyle?: 'pretty' | 'compact';
  xmlFormatStyle?: 'pretty' | 'compact' | 'inline';
  formatIndent?: '2' | '4' | 'tab';
}

export interface PreparedComparisonSide {
  extension: string;
  content: string;
}

export interface PreparedResponseComparison {
  title: string;
  left: PreparedComparisonSide;
  right: PreparedComparisonSide;
}

type CompareBodyKind = 'json' | 'xml' | 'html' | 'text' | 'binary';

interface NormalizedCompareSide {
  kind: CompareBodyKind;
  extension: string;
  bodyContent: string;
  metadataContent: string;
  bodyHash: string;
  parsedJson?: unknown;
}

interface FoldedBodyPair {
  left: string;
  right: string;
}

interface JsonIgnorePattern {
  segments: string[];
}

const TEXT_CONTENT_TYPES = new Set([
  'application/json',
  'application/xml',
  'text/xml',
  'application/javascript',
  'text/javascript',
  'application/x-www-form-urlencoded',
  'application/graphql',
  'application/ld+json',
  'application/x-ndjson',
  'text/plain',
  'text/html',
  'text/css',
]);

export class ResponseCompareService {
  static readonly DEFAULT_IGNORE_HEADERS = [
    'date',
    'set-cookie',
    'x-request-id',
    'x-correlation-id',
    'x-amzn-trace-id',
  ];

  static readonly DEFAULT_IGNORE_JSON_PATHS = [
    '$.timestamp',
    '$.traceId',
    '$.requestId',
    '$.correlationId',
  ];

  private static readonly DIFF_MAX_FILES = 20;
  private static readonly DIFF_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

  static normalizeSettings(settings?: Partial<CompareSettings> | null): CompareSettings {
    return {
      mode: settings?.mode === 'raw' || settings?.mode === 'pretty' ? settings.mode : 'normalized',
      includeMetadataSummary: settings?.includeMetadataSummary !== false,
      foldUnchangedSections: settings?.foldUnchangedSections !== false,
      ignoreHeaders: this.normalizeStringList(settings?.ignoreHeaders, this.DEFAULT_IGNORE_HEADERS),
      ignoreJsonPaths: this.normalizeStringList(settings?.ignoreJsonPaths, this.DEFAULT_IGNORE_JSON_PATHS),
    };
  }

  static prepareComparison(
    left: ResponseCompareSnapshot,
    right: ResponseCompareSnapshot,
    settings?: Partial<CompareSettings> | null
  ): PreparedResponseComparison {
    const options = this.normalizeSettings(settings);
    const leftSide = this.prepareSide(left, options);
    const rightSide = this.prepareSide(right, options);
    const sharedSummary = this.buildSharedSummary(leftSide, rightSide, options);
    const foldedBodies = options.foldUnchangedSections
      ? this.foldUnchangedPair(leftSide.bodyContent, rightSide.bodyContent)
      : null;

    return {
      title: `Response Compare: ${left.label} vs ${right.label} (${options.mode})`,
      left: {
        extension: leftSide.extension,
        content: this.buildDocument(left.label, sharedSummary, leftSide, options, foldedBodies?.left),
      },
      right: {
        extension: rightSide.extension,
        content: this.buildDocument(right.label, sharedSummary, rightSide, options, foldedBodies?.right),
      },
    };
  }

  static async cleanupDiffArtifacts(storagePath: string): Promise<void> {
    const diffDir = path.join(storagePath, '.diff');

    try {
      const entries = await fs.readdir(diffDir, { withFileTypes: true });
      const files = await Promise.all(
        entries
          .filter((entry) => entry.isFile())
          .map(async (entry) => {
            const filePath = path.join(diffDir, entry.name);
            const stat = await fs.stat(filePath);
            return { filePath, mtimeMs: stat.mtimeMs };
          })
      );

      const now = Date.now();
      files.sort((a, b) => b.mtimeMs - a.mtimeMs);

      const stale = files.filter((file, index) =>
        now - file.mtimeMs > this.DIFF_MAX_AGE_MS || index >= this.DIFF_MAX_FILES
      );

      await Promise.all(stale.map((file) => fs.unlink(file.filePath).catch(() => undefined)));
    } catch {
      // 정리 실패는 비교 기능을 막지 않음
    }
  }

  private static prepareSide(snapshot: ResponseCompareSnapshot, options: CompareSettings): NormalizedCompareSide {
    const kind = this.detectKind(snapshot);
    const extension = this.extensionForKind(kind, snapshot.contentType);
    const bodyHash = this.hashSnapshotBody(snapshot);
    const metadataContent = this.buildMetadata(snapshot, kind, bodyHash, options);

    if (kind === 'binary') {
      return {
        kind,
        extension: 'txt',
        bodyHash,
        metadataContent,
        bodyContent: this.buildBinaryBody(snapshot, bodyHash),
      };
    }

    if (kind === 'json') {
      const normalized = this.normalizeJson(snapshot.body, snapshot, options);
      return {
        kind,
        extension,
        bodyHash,
        metadataContent,
        bodyContent: normalized.rendered,
        parsedJson: normalized.parsed,
      };
    }

    if (kind === 'xml' || kind === 'html') {
      return {
        kind,
        extension,
        bodyHash,
        metadataContent,
        bodyContent: this.normalizeXml(snapshot.body, snapshot, options.mode),
      };
    }

    return {
      kind,
      extension,
      bodyHash,
      metadataContent,
      bodyContent: options.mode === 'normalized'
        ? this.normalizeText(snapshot.body)
        : snapshot.body,
    };
  }

  private static buildDocument(
    label: string,
    sharedSummary: string,
    side: NormalizedCompareSide,
    options: CompareSettings,
    foldedBodyContent?: string
  ): string {
    const renderedBody = foldedBodyContent ?? side.bodyContent;
    if (!options.includeMetadataSummary) {
      return renderedBody || '[Empty body]';
    }

    const sections: string[] = [
      `=== ${label} ===`,
      sharedSummary,
    ];
    sections.push(side.metadataContent);

    sections.push('=== Body ===');
    sections.push(renderedBody || '[Empty body]');
    return sections.join('\n\n');
  }

  private static buildSharedSummary(leftSide: NormalizedCompareSide, rightSide: NormalizedCompareSide, options: CompareSettings): string {
    const lines = [
      '=== Comparison Summary ===',
      `Mode: ${this.capitalize(options.mode)}`,
      `Metadata Summary: ${options.includeMetadataSummary ? 'Included' : 'Hidden'}`,
      `Fold Unchanged: ${options.foldUnchangedSections ? 'Enabled' : 'Disabled'}`,
      `Ignored Headers: ${options.ignoreHeaders.length > 0 ? options.ignoreHeaders.join(', ') : '(none)'}`,
      `Ignored JSON Paths: ${options.ignoreJsonPaths.length > 0 ? options.ignoreJsonPaths.join(', ') : '(none)'}`,
    ];

    const changedPaths = this.collectChangedJsonPaths(leftSide.parsedJson, rightSide.parsedJson);
    if (changedPaths.length > 0) {
      lines.push(`Changed JSON Paths: ${changedPaths.join(', ')}`);
    } else if (leftSide.parsedJson !== undefined && rightSide.parsedJson !== undefined) {
      lines.push('Changed JSON Paths: (none)');
    }

    lines.push(this.buildBodyComparisonStats(leftSide.bodyContent, rightSide.bodyContent));

    return lines.join('\n');
  }

  private static buildBodyComparisonStats(leftBody: string, rightBody: string): string {
    const leftLines = String(leftBody || '').split('\n');
    const rightLines = String(rightBody || '').split('\n');
    const max = Math.max(leftLines.length, rightLines.length);
    let changed = 0;
    let leftOnly = 0;
    let rightOnly = 0;

    for (let index = 0; index < max; index += 1) {
      const leftLine = leftLines[index];
      const rightLine = rightLines[index];
      if (leftLine === rightLine) { continue; }
      changed += 1;
      if (leftLine !== undefined && rightLine === undefined) { leftOnly += 1; }
      else if (leftLine === undefined && rightLine !== undefined) { rightOnly += 1; }
    }

    return `Body Lines: left ${leftLines.length}, right ${rightLines.length}, changed ${changed}, left-only ${leftOnly}, right-only ${rightOnly}`;
  }

  private static foldUnchangedPair(leftBody: string, rightBody: string): FoldedBodyPair {
    const leftLines = String(leftBody || '').split('\n');
    const rightLines = String(rightBody || '').split('\n');

    if (
      leftLines.length === 0 ||
      rightLines.length === 0 ||
      leftLines.length > 2000 ||
      rightLines.length > 2000
    ) {
      return { left: leftBody, right: rightBody };
    }

    const matches = this.computeLineMatches(leftLines, rightLines);
    if (matches.length === 0) {
      return { left: leftBody, right: rightBody };
    }

    const context = 2;
    const leftOutput: string[] = [];
    const rightOutput: string[] = [];
    let leftCursor = 0;
    let rightCursor = 0;
    let matchCursor = 0;

    while (matchCursor < matches.length) {
      const runStart = matchCursor;
      let runEnd = matchCursor;
      while (
        runEnd + 1 < matches.length &&
        matches[runEnd + 1].left === matches[runEnd].left + 1 &&
        matches[runEnd + 1].right === matches[runEnd].right + 1
      ) {
        runEnd += 1;
      }

      const run = matches.slice(runStart, runEnd + 1);
      const runLeftStart = run[0].left;
      const runRightStart = run[0].right;
      const runLength = run.length;

      if (leftCursor < runLeftStart) {
        leftOutput.push(...leftLines.slice(leftCursor, runLeftStart));
      }
      if (rightCursor < runRightStart) {
        rightOutput.push(...rightLines.slice(rightCursor, runRightStart));
      }

      if (runLength <= (context * 2) + 1) {
        for (const match of run) {
          leftOutput.push(leftLines[match.left]);
          rightOutput.push(rightLines[match.right]);
        }
      } else {
        for (let index = 0; index < context; index += 1) {
          leftOutput.push(leftLines[run[index].left]);
          rightOutput.push(rightLines[run[index].right]);
        }

        const foldedCount = runLength - (context * 2);
        const placeholder = `… ${foldedCount} unchanged lines folded …`;
        leftOutput.push(placeholder);
        rightOutput.push(placeholder);

        for (let index = runLength - context; index < runLength; index += 1) {
          leftOutput.push(leftLines[run[index].left]);
          rightOutput.push(rightLines[run[index].right]);
        }
      }

      leftCursor = run[runLength - 1].left + 1;
      rightCursor = run[runLength - 1].right + 1;
      matchCursor = runEnd + 1;
    }

    if (leftCursor < leftLines.length) {
      leftOutput.push(...leftLines.slice(leftCursor));
    }
    if (rightCursor < rightLines.length) {
      rightOutput.push(...rightLines.slice(rightCursor));
    }

    return {
      left: leftOutput.join('\n'),
      right: rightOutput.join('\n'),
    };
  }

  private static computeLineMatches(
    leftLines: string[],
    rightLines: string[],
  ): Array<{ left: number; right: number }> {
    const leftLength = leftLines.length;
    const rightLength = rightLines.length;
    const matrix: number[][] = Array.from({ length: leftLength + 1 }, () => new Array<number>(rightLength + 1).fill(0));

    for (let leftIndex = leftLength - 1; leftIndex >= 0; leftIndex -= 1) {
      for (let rightIndex = rightLength - 1; rightIndex >= 0; rightIndex -= 1) {
        matrix[leftIndex][rightIndex] = leftLines[leftIndex] === rightLines[rightIndex]
          ? matrix[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(matrix[leftIndex + 1][rightIndex], matrix[leftIndex][rightIndex + 1]);
      }
    }

    const matches: Array<{ left: number; right: number }> = [];
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < leftLength && rightIndex < rightLength) {
      if (leftLines[leftIndex] === rightLines[rightIndex]) {
        matches.push({ left: leftIndex, right: rightIndex });
        leftIndex += 1;
        rightIndex += 1;
      } else if (matrix[leftIndex + 1][rightIndex] >= matrix[leftIndex][rightIndex + 1]) {
        leftIndex += 1;
      } else {
        rightIndex += 1;
      }
    }

    return matches;
  }

  private static buildMetadata(
    snapshot: ResponseCompareSnapshot,
    kind: CompareBodyKind,
    bodyHash: string,
    options: CompareSettings
  ): string {
    const size = snapshot.size ?? this.snapshotBodyBuffer(snapshot).length;
    const headers = this.normalizeHeaders(snapshot.headers, options.ignoreHeaders);

    const lines = [
      '=== Metadata ===',
      `Status: ${snapshot.status ?? '-'}${snapshot.statusText ? ` ${snapshot.statusText}` : ''}`,
      `URL: ${snapshot.resolvedUrl || '-'}`,
      `Content-Type: ${snapshot.contentType || '-'}`,
      `Kind: ${kind}`,
      `Time: ${typeof snapshot.time === 'number' ? `${snapshot.time} ms` : '-'}`,
      `Size: ${this.formatSize(size)}`,
      `SHA-256: ${bodyHash}`,
    ];

    if (typeof snapshot.timestamp === 'number') {
      lines.push(`Captured: ${new Date(snapshot.timestamp).toISOString()}`);
    }

    if (headers.length > 0) {
      lines.push('Headers:');
      for (const header of headers) {
        lines.push(`  ${header.key}: ${header.value}`);
      }
    }

    return lines.join('\n');
  }

  private static buildBinaryBody(snapshot: ResponseCompareSnapshot, bodyHash: string): string {
    const buffer = this.snapshotBodyBuffer(snapshot);
    const base64 = snapshot.bodyBase64 || buffer.toString('base64');
    const prefix = base64.slice(0, 80);
    return [
      'This response body is binary. The comparison uses fingerprints instead of a text diff.',
      `Bytes: ${buffer.length}`,
      `SHA-256: ${bodyHash}`,
      `Base64 Prefix: ${prefix}${base64.length > prefix.length ? '...' : ''}`,
    ].join('\n');
  }

  private static normalizeJson(
    body: string,
    snapshot: ResponseCompareSnapshot,
    options: CompareSettings
  ): { rendered: string; parsed?: unknown } {
    try {
      const parsed = JSON.parse(body);
      const ignorePatterns = options.ignoreJsonPaths.map((pattern) => this.parseJsonIgnorePattern(pattern));
      const normalizedValue = this.normalizeJsonValue(parsed, [], ignorePatterns);
      const jsonStyle = snapshot.jsonFormatStyle === 'compact' ? 'compact' : 'pretty';
      const indent = this.indentFromKey(snapshot.formatIndent);
      return {
        parsed: normalizedValue,
        rendered: options.mode === 'pretty'
          ? (jsonStyle === 'compact'
            ? JSON.stringify(normalizedValue)
            : JSON.stringify(normalizedValue, null, indent))
          : options.mode === 'normalized'
            ? JSON.stringify(normalizedValue)
            : body,
      };
    } catch {
      return { rendered: body };
    }
  }

  private static normalizeJsonValue(
    value: unknown,
    pathSegments: string[],
    ignorePatterns: JsonIgnorePattern[]
  ): unknown {
    if (Array.isArray(value)) {
      const normalizedItems: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        const nextPath = [...pathSegments, String(index)];
        if (this.shouldIgnoreJsonPath(nextPath, ignorePatterns)) { continue; }
        normalizedItems.push(this.normalizeJsonValue(value[index], nextPath, ignorePatterns));
      }
      return normalizedItems;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !this.shouldIgnoreJsonPath([...pathSegments, key], ignorePatterns))
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, child]) => [key, this.normalizeJsonValue(child, [...pathSegments, key], ignorePatterns)]);

      return Object.fromEntries(entries);
    }

    return value;
  }

  private static shouldIgnoreJsonPath(pathSegments: string[], patterns: JsonIgnorePattern[]): boolean {
    return patterns.some((pattern) => {
      if (pattern.segments.length !== pathSegments.length) { return false; }
      for (let index = 0; index < pattern.segments.length; index++) {
        const expected = pattern.segments[index];
        if (expected !== '*' && expected !== pathSegments[index]) {
          return false;
        }
      }
      return true;
    });
  }

  private static parseJsonIgnorePattern(pattern: string): JsonIgnorePattern {
    const trimmed = pattern.trim().replace(/^\$\./, '').replace(/^\$/, '');
    if (!trimmed) { return { segments: [] }; }

    const normalized = trimmed
      .replace(/\[(\d+|\*)\]/g, '.$1')
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);

    return { segments: normalized };
  }

  private static normalizeXml(xml: string, snapshot: ResponseCompareSnapshot, mode: CompareMode): string {
    if (mode === 'raw') { return xml; }

    const normalized = xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const tokens = this.xmlTokenize(normalized);
    const canonicalTokens = tokens.map((token) => {
      if (token.type === 'text') {
        return { ...token, value: token.value.replace(/\s+/g, ' ').trim() };
      }

      if (token.type === 'open' || token.type === 'self') {
        return { ...token, value: this.sortTagAttributes(token.value) };
      }

      return token;
    }).filter((token) => token.value.length > 0);

    if (mode === 'normalized') {
      return canonicalTokens.map((token) => token.value).join('');
    }

    const style = snapshot.xmlFormatStyle || 'pretty';
    const indent = this.indentFromKey(snapshot.formatIndent);

    if (style === 'compact') {
      return canonicalTokens.map((token) => token.value).join('');
    }

    if (style === 'inline') {
      return this.xmlBuildInline(canonicalTokens, indent);
    }

    return this.xmlBuildPretty(canonicalTokens, indent);
  }

  private static xmlTokenize(xml: string): Array<{ type: string; value: string }> {
    const tokens: Array<{ type: string; value: string }> = [];
    const tokenPattern = /(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/[^>]+>|<[^>]+\/\s*>|<[^>]+>)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(xml)) !== null) {
      if (match.index > lastIndex) {
        const text = xml.substring(lastIndex, match.index).trim();
        if (text) {
          tokens.push({ type: 'text', value: text });
        }
      }

      const tag = match[1];
      if (tag.startsWith('<?')) { tokens.push({ type: 'decl', value: tag }); }
      else if (tag.startsWith('<!--')) { tokens.push({ type: 'comment', value: tag }); }
      else if (tag.startsWith('<![CDATA[')) { tokens.push({ type: 'cdata', value: tag }); }
      else if (tag.startsWith('</')) { tokens.push({ type: 'close', value: tag }); }
      else if (/\/\s*>$/.test(tag)) { tokens.push({ type: 'self', value: tag }); }
      else { tokens.push({ type: 'open', value: tag }); }

      lastIndex = tokenPattern.lastIndex;
    }

    if (lastIndex < xml.length) {
      const tail = xml.substring(lastIndex).trim();
      if (tail) {
        tokens.push({ type: 'text', value: tail });
      }
    }

    return tokens;
  }

  private static xmlBuildPretty(tokens: Array<{ type: string; value: string }>, indent: string): string {
    const lines: string[] = [];
    let depth = 0;

    for (const token of tokens) {
      if (token.type === 'close') {
        depth = Math.max(0, depth - 1);
        lines.push(indent.repeat(depth) + token.value);
        continue;
      }

      lines.push(indent.repeat(depth) + token.value);

      if (token.type === 'open') {
        depth++;
      }
    }

    return lines.join('\n');
  }

  private static xmlBuildInline(tokens: Array<{ type: string; value: string }>, indent: string): string {
    const lines: string[] = [];
    let depth = 0;
    let index = 0;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === 'open') {
        if (index + 2 < tokens.length && tokens[index + 1].type === 'text' && tokens[index + 2].type === 'close') {
          lines.push(this.repeatIndent(depth, indent) + token.value + tokens[index + 1].value + tokens[index + 2].value);
          index += 3;
          continue;
        }

        if (index + 3 < tokens.length && tokens[index + 1].type === 'self' && tokens[index + 2].type === 'close') {
          lines.push(this.repeatIndent(depth, indent) + token.value + tokens[index + 1].value + tokens[index + 2].value);
          index += 3;
          continue;
        }

        if (
          index + 4 < tokens.length &&
          tokens[index + 1].type === 'open' &&
          tokens[index + 2].type === 'text' &&
          tokens[index + 3].type === 'close' &&
          tokens[index + 4].type === 'close'
        ) {
          lines.push(
            this.repeatIndent(depth, indent) +
            token.value +
            tokens[index + 1].value +
            tokens[index + 2].value +
            tokens[index + 3].value +
            tokens[index + 4].value
          );
          index += 5;
          continue;
        }

        lines.push(this.repeatIndent(depth, indent) + token.value);
        depth++;
        index++;
        continue;
      }

      if (token.type === 'close') {
        depth = Math.max(0, depth - 1);
        lines.push(this.repeatIndent(depth, indent) + token.value);
        index++;
        continue;
      }

      lines.push(this.repeatIndent(depth, indent) + token.value);
      index++;
    }

    return lines.join('\n');
  }

  private static sortTagAttributes(tag: string): string {
    const match = tag.match(/^<([^\s/>]+)([\s\S]*?)(\/?)>$/);
    if (!match) { return tag; }

    const [, tagName, rawAttrs, selfClosing] = match;
    const attributes = [...rawAttrs.matchAll(/([^\s=\/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g)]
      .map((attr) => ({
        name: attr[1],
        value: attr[2] ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    if (attributes.length === 0) {
      return `<${tagName}${selfClosing ? ' /' : ''}>`;
    }

    const renderedAttrs = attributes
      .map((attr) => attr.value === null ? attr.name : `${attr.name}=${attr.value}`)
      .join(' ');

    return `<${tagName} ${renderedAttrs}${selfClosing ? ' /' : ''}>`;
  }

  private static normalizeText(value: string): string {
    return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  }

  private static indentFromKey(indentKey?: '2' | '4' | 'tab'): string {
    if (indentKey === 'tab') { return '\t'; }
    const spaces = Number.parseInt(indentKey || '2', 10) || 2;
    return ' '.repeat(spaces);
  }

  private static repeatIndent(depth: number, indent: string): string {
    return indent.repeat(Math.max(0, depth));
  }

  private static detectKind(snapshot: ResponseCompareSnapshot): CompareBodyKind {
    const mime = snapshot.contentType.split(';')[0].trim().toLowerCase();
    if (snapshot.bodyBase64 && this.isBinaryContentType(mime)) { return 'binary'; }
    if (mime === 'application/json' || mime.endsWith('+json')) { return 'json'; }
    if (mime === 'application/xml' || mime === 'text/xml' || mime.endsWith('+xml')) { return 'xml'; }
    if (mime === 'text/html') { return 'html'; }
    if (this.isBinaryContentType(mime)) { return 'binary'; }
    return 'text';
  }

  private static isBinaryContentType(mime: string): boolean {
    if (!mime) { return false; }
    if (mime.startsWith('text/')) { return false; }
    if (mime.endsWith('+json') || mime.endsWith('+xml')) { return false; }
    return !TEXT_CONTENT_TYPES.has(mime);
  }

  private static extensionForKind(kind: CompareBodyKind, contentType: string): string {
    switch (kind) {
      case 'json':
        return 'json';
      case 'xml':
        return 'xml';
      case 'html':
        return 'html';
      case 'binary':
        return 'txt';
      default:
        return this.extensionFromContentType(contentType);
    }
  }

  private static extensionFromContentType(contentType: string): string {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    const mapping: Record<string, string> = {
      'application/json': 'json',
      'application/xml': 'xml',
      'text/xml': 'xml',
      'text/html': 'html',
      'text/plain': 'txt',
      'text/css': 'css',
      'application/javascript': 'js',
      'text/javascript': 'js',
      'application/x-www-form-urlencoded': 'txt',
    };
    return mapping[mime] || 'txt';
  }

  private static snapshotBodyBuffer(snapshot: ResponseCompareSnapshot): Buffer {
    if (snapshot.bodyBase64) {
      return Buffer.from(snapshot.bodyBase64, 'base64');
    }
    return Buffer.from(snapshot.body ?? '', 'utf-8');
  }

  private static hashSnapshotBody(snapshot: ResponseCompareSnapshot): string {
    return crypto.createHash('sha256').update(this.snapshotBodyBuffer(snapshot)).digest('hex');
  }

  private static normalizeHeaders(
    headers: ResponseCompareSnapshot['headers'],
    ignoreHeaders: string[]
  ): Array<{ key: string; value: string }> {
    const ignored = new Set(ignoreHeaders.map((header) => header.toLowerCase()));
    const pairs: Array<{ key: string; value: string }> = [];

    if (Array.isArray(headers)) {
      for (const header of headers) {
        if (!header?.key) { continue; }
        if (ignored.has(header.key.toLowerCase())) { continue; }
        pairs.push({ key: header.key, value: header.value });
      }
    } else if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (ignored.has(key.toLowerCase())) { continue; }
        pairs.push({ key, value });
      }
    }

    return pairs.sort((left, right) => left.key.localeCompare(right.key));
  }

  private static collectChangedJsonPaths(left: unknown, right: unknown): string[] {
    if (left === undefined || right === undefined) {
      return [];
    }

    const paths: string[] = [];
    this.walkJsonDiff(left, right, '$', paths);
    return paths.slice(0, 20);
  }

  private static walkJsonDiff(left: unknown, right: unknown, path: string, target: string[]): void {
    if (target.length >= 20) { return; }

    if (this.deepEqual(left, right)) {
      return;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      const max = Math.max(left.length, right.length);
      for (let index = 0; index < max; index++) {
        this.walkJsonDiff(left[index], right[index], `${path}[${index}]`, target);
        if (target.length >= 20) { return; }
      }
      return;
    }

    if (this.isPlainObject(left) && this.isPlainObject(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const key of [...keys].sort()) {
        const nextPath = path === '$' ? `$.${key}` : `${path}.${key}`;
        this.walkJsonDiff((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], nextPath, target);
        if (target.length >= 20) { return; }
      }
      return;
    }

    target.push(path);
  }

  private static deepEqual(left: unknown, right: unknown): boolean {
    if (left === right) { return true; }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) { return false; }
      return left.every((value, index) => this.deepEqual(value, right[index]));
    }
    if (this.isPlainObject(left) && this.isPlainObject(right)) {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) { return false; }
      return leftKeys.every((key) => this.deepEqual(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key]
      ));
    }
    return false;
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private static normalizeStringList(value: string[] | undefined, fallback: string[]): string[] {
    if (value === undefined) { return [...fallback]; }
    return value.map((item) => item.trim()).filter(Boolean);
  }

  private static formatSize(bytes: number): string {
    if (bytes < 1024) { return `${bytes} B`; }
    if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

  private static capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
