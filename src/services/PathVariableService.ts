import { KeyValue, PathVariableOverride } from '../models/types';
import { VariableService } from './VariableService';

export type { PathVariableOverride };

const FULL_SEGMENT_PLACEHOLDER = /^\{\{\s*([^}]+?)\s*\}\}$/;

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
      seen.add(key);
      out.push({
        key,
        value: typeof raw.value === 'string' ? raw.value : String(raw.value ?? ''),
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
