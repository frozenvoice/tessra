import { KeyValue, PathVariableOverride } from '../models/types';
import { VariableService } from './VariableService';

export type { PathVariableOverride };

const FULL_SEGMENT_PLACEHOLDER = /^\{\{\s*([^}]+?)\s*\}\}$/;
const TEMPLATE_TOKEN = /\{\{([^}]+)\}\}/g;

export type UrlVariableOccurrenceScope = 'path' | 'other';
export type UrlVariableResolvedBy = 'path-override' | 'environment' | null;

export interface UrlVariableOccurrence {
  index: number;
  end: number;
  name: string;
  raw: string;
  /** Full path-segment `{{name}}` in the URL path (not query/authority/partial). */
  scope: UrlVariableOccurrenceScope;
  resolvedBy: UrlVariableResolvedBy;
  value: string;
  /** True when this occurrence will remain unresolved at send time. */
  missing: boolean;
}

type UrlBaseParts = {
  base: string;
  query: string;
  fragment: string;
};

function splitUrlBase(rawUrl: string): UrlBaseParts {
  const raw = String(rawUrl ?? '');
  let working = raw;
  let fragment = '';
  const hashIndex = working.indexOf('#');
  if (hashIndex >= 0) {
    fragment = working.slice(hashIndex);
    working = working.slice(0, hashIndex);
  }

  let base = working;
  let query = '';
  const questionIndex = working.indexOf('?');
  if (questionIndex >= 0) {
    base = working.slice(0, questionIndex);
    query = working.slice(questionIndex + 1);
  }

  return { base, query, fragment };
}

/**
 * Path Variables: full path segments that are exactly `{{name}}`.
 * Excludes authority placeholders, leading base prefixes like `{{baseUrl}}/...`,
 * query/fragment placeholders, and partial-segment tokens like `user-{{id}}`.
 */
export class PathVariableService {
  /** Non-empty usable override only. Whitespace-only is inactive; stored value is not auto-trimmed. */
  static isActiveOverrideValue(value: unknown): boolean {
    return String(value ?? '').trim().length > 0;
  }

  static normalizeOverrides(value: unknown): PathVariableOverride[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const out: PathVariableOverride[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const raw = item as { key?: unknown; value?: unknown };
      const key = typeof raw.key === 'string' ? raw.key.trim() : '';
      if (!key || seen.has(key)) {
        continue;
      }
      const nextValue = typeof raw.value === 'string' ? raw.value : String(raw.value ?? '');
      if (!this.isActiveOverrideValue(nextValue)) {
        continue;
      }
      seen.add(key);
      out.push({
        key,
        value: nextValue,
      });
    }
    return out;
  }

  /** Keep overrides that still appear as path variables in the URL (orphan prune). */
  static pruneOverrides(url: string, overrides: PathVariableOverride[] | unknown): PathVariableOverride[] {
    const active = new Set(this.extractPathVariableNames(url));
    return this.normalizeOverrides(overrides).filter((item) => active.has(item.key));
  }

  static extractPathVariableNames(rawUrl: string): string[] {
    const segments = this.getPathSegments(splitUrlBase(rawUrl).base);
    const names: string[] = [];
    const seen = new Set<string>();
    for (const segment of segments) {
      const match = segment.match(FULL_SEGMENT_PLACEHOLDER);
      if (!match) {
        continue;
      }
      const name = match[1].trim();
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      names.push(name);
    }
    return names;
  }

  static getOverrideMap(overrides: PathVariableOverride[] | unknown): Map<string, string> {
    const map = new Map<string, string>();
    for (const item of this.normalizeOverrides(overrides)) {
      map.set(item.key, item.value);
    }
    return map;
  }

  /**
   * Replace full path-segment placeholders that have request-local overrides.
   * Query / fragment / authority / non-path fields are untouched.
   */
  static applyOverridesToUrl(rawUrl: string, overrides: PathVariableOverride[] | unknown): string {
    const overrideMap = this.getOverrideMap(overrides);
    if (overrideMap.size === 0) {
      return String(rawUrl ?? '');
    }
    const parts = splitUrlBase(rawUrl);
    const nextBase = this.rewritePathBase(parts.base, overrideMap);
    return `${nextBase}${parts.query ? `?${parts.query}` : ''}${parts.fragment}`;
  }

  /** Path overrides first, then Environment/workspace variable resolution. */
  static resolveUrl(
    rawUrl: string,
    overrides: PathVariableOverride[] | unknown,
    variables: KeyValue[]
  ): string {
    return VariableService.resolve(this.applyOverridesToUrl(rawUrl, overrides), variables);
  }

  /**
   * Occurrence-level URL template analysis for UI (underline / popover).
   * Path-local overrides resolve only matching full path-segment occurrences;
   * same-named query/header-style tokens stay unresolved unless Environment has them.
   */
  static analyzeUrlVariableOccurrences(
    rawUrl: string,
    overrides: PathVariableOverride[] | unknown,
    envKeys: Iterable<string>,
    envValues: Record<string, string> = {}
  ): UrlVariableOccurrence[] {
    const url = String(rawUrl ?? '');
    const parts = splitUrlBase(url);
    const overrideMap = this.getOverrideMap(overrides);
    const pathNames = new Set(this.extractPathVariableNames(url));
    const envKeySet = new Set(
      Array.from(envKeys, (key) => String(key || '').trim()).filter(Boolean)
    );

    const out: UrlVariableOccurrence[] = [];
    TEMPLATE_TOKEN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TEMPLATE_TOKEN.exec(url)) !== null) {
      const raw = match[0];
      const name = String(match[1] || '').trim();
      if (!name) {
        continue;
      }
      const index = match.index;
      const end = index + raw.length;
      const inPathPortion = end <= parts.base.length;
      const prev = index > 0 ? url.charAt(index - 1) : '';
      const next = end < parts.base.length ? parts.base.charAt(end) : '';
      const boundedAsSegment =
        inPathPortion &&
        (index === 0 || prev === '/') &&
        (end === parts.base.length || next === '/');
      const scope: UrlVariableOccurrenceScope =
        boundedAsSegment && pathNames.has(name) ? 'path' : 'other';

      let resolvedBy: UrlVariableResolvedBy = null;
      let value = '';
      if (scope === 'path' && overrideMap.has(name)) {
        resolvedBy = 'path-override';
        value = overrideMap.get(name) ?? '';
      } else if (envKeySet.has(name)) {
        resolvedBy = 'environment';
        value = Object.prototype.hasOwnProperty.call(envValues, name)
          ? String(envValues[name] ?? '')
          : '';
      }

      out.push({
        index,
        end,
        name,
        raw,
        scope,
        resolvedBy,
        value,
        missing: resolvedBy === null,
      });
    }
    return out;
  }

  private static getPathSegments(base: string): string[] {
    const raw = String(base ?? '');
    if (!raw) {
      return [];
    }

    const schemeAuthority = raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
    if (schemeAuthority) {
      const afterScheme = raw.slice(schemeAuthority[0].length);
      const slash = afterScheme.indexOf('/');
      if (slash < 0) {
        return [];
      }
      return afterScheme
        .slice(slash + 1)
        .split('/')
        .filter((segment) => segment.length > 0);
    }

    if (raw.startsWith('/')) {
      return raw.split('/').filter((segment) => segment.length > 0);
    }

    const segments = raw.split('/');
    if (segments.length <= 1) {
      return [];
    }

    // `{{baseUrl}}/users/{{userId}}` — leading full-segment placeholder is a base prefix, not a path var.
    if (FULL_SEGMENT_PLACEHOLDER.test(segments[0])) {
      return segments.slice(1).filter((segment) => segment.length > 0);
    }

    return segments.filter((segment) => segment.length > 0);
  }

  private static rewritePathBase(base: string, overrideMap: Map<string, string>): string {
    const raw = String(base ?? '');
    if (!raw || overrideMap.size === 0) {
      return raw;
    }

    const schemeAuthority = raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
    if (schemeAuthority) {
      const prefix = schemeAuthority[0];
      const afterScheme = raw.slice(prefix.length);
      const slash = afterScheme.indexOf('/');
      if (slash < 0) {
        return raw;
      }
      const authority = afterScheme.slice(0, slash);
      const pathAndRest = afterScheme.slice(slash); // starts with /
      const rewritten = this.rewriteSlashPath(pathAndRest, overrideMap);
      return `${prefix}${authority}${rewritten}`;
    }

    if (raw.startsWith('/')) {
      return this.rewriteSlashPath(raw, overrideMap);
    }

    const segments = raw.split('/');
    if (segments.length <= 1) {
      return raw;
    }

    const leadingBasePrefix = FULL_SEGMENT_PLACEHOLDER.test(segments[0]);
    const startIndex = leadingBasePrefix ? 1 : 0;
    const next = segments.slice();
    for (let i = startIndex; i < next.length; i++) {
      const match = next[i].match(FULL_SEGMENT_PLACEHOLDER);
      if (!match) {
        continue;
      }
      const name = match[1].trim();
      if (overrideMap.has(name)) {
        next[i] = overrideMap.get(name)!;
      }
    }
    return next.join('/');
  }

  private static rewriteSlashPath(
    pathWithLeadingSlash: string,
    overrideMap: Map<string, string>
  ): string {
    const leadingSlash = pathWithLeadingSlash.startsWith('/');
    const body = leadingSlash ? pathWithLeadingSlash.slice(1) : pathWithLeadingSlash;
    if (!body) {
      return leadingSlash ? '/' : '';
    }
    const segments = body.split('/');
    const next = segments.map((segment) => {
      const match = segment.match(FULL_SEGMENT_PLACEHOLDER);
      if (!match) {
        return segment;
      }
      const name = match[1].trim();
      return overrideMap.has(name) ? overrideMap.get(name)! : segment;
    });
    return `${leadingSlash ? '/' : ''}${next.join('/')}`;
  }
}
