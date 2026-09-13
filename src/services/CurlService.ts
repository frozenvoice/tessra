import { Request, KeyValue, AuthConfig, HttpMethod, RequestBodyType } from '../models/types';
import { buildUrl, coalesceQueryParams } from '../panels/requestPanel/requestUtils';

export interface CurlParseResult {
  request: Request;
  warnings: string[];
}

interface TokenizeResult {
  tokens: string[];
  warnings: string[];
}

interface OptionToken {
  flag: string;
  inlineValue?: string;
}

const VALID_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const VALUE_REQUIRED_SHORT_FLAGS = new Set(['-X', '-H', '-d', '-b', '-u', '-A', '-e', '-F', '-c', '-D', '-K', '-m', '-o', '-x', '-U', '-w', '-z', '-T']);
const BOOLEAN_SHORT_FLAGS = new Set(['-G', '-k', '-L', '-s', '-S', '-v', '-i']);
const KNOWN_LONG_FLAGS = new Set([
  '--request',
  '--header',
  '--data',
  '--data-ascii',
  '--data-raw',
  '--data-binary',
  '--data-urlencode',
  '--form',
  '--form-string',
  '--get',
  '--url',
  '--cookie',
  '--user',
  '--compressed',
  '--location',
  '--insecure',
  '--user-agent',
  '--referer',
  '--referrer',
  '--silent',
  '--show-error',
  '--verbose',
  '--include',
]);

// 로컬 파일·프록시·인증서·출력 파일 연동 없이는 재현할 수 없는 옵션이다.
// 지원하지 않는 옵션의 인자를 소비해 요청 URL로 오인하지 않도록 한다.
const UNSUPPORTED_VALUE_SHORT_FLAGS = new Set(['-c', '-D', '-K', '-m', '-o', '-x', '-U', '-w', '-z', '-T']);
const UNSUPPORTED_VALUE_LONG_FLAGS = new Set([
  '--cacert', '--capath', '--cert', '--cert-type', '--key', '--key-type',
  '--config', '--connect-timeout', '--cookie-jar', '--dns-interface', '--dns-ipv4-addr',
  '--dns-ipv6-addr', '--interface', '--max-time', '--netrc-file', '--output', '--proxy',
  '--proxy-cacert', '--proxy-cert', '--proxy-key', '--proxy-service-name',
  '--proxy-tlsauthtype', '--proxy-tlspassword', '--proxy-tlsuser', '--proxy-tlsv1', '--proxy-user',
  '--resolve', '--retry', '--retry-delay', '--retry-max-time', '--stderr', '--trace', '--trace-ascii',
  '--trace-time', '--upload-file', '--url-query', '--write-out', '--form-escape', '--form-quote',
  '--request-target',
]);

export class CurlService {
  static parse(curl: string): Request {
    return CurlService.parseWithWarnings(curl).request;
  }

  static parseWithWarnings(curl: string): CurlParseResult {
    const normalized = CurlService.normalizeCurl(curl);
    const withoutCmd = normalized.replace(/^curl(?:\.exe)?\s+/i, '');
    const tokenized = CurlService.tokenize(withoutCmd);
    const warnings = [...tokenized.warnings];
    const tokens = CurlService.expandCompactShortOptions(tokenized.tokens, warnings);

    let method: HttpMethod = 'GET';
    let url = '';
    const headers: KeyValue[] = [];
    const cookies: string[] = [];
    const bodyParts: string[] = [];
    const dataUrlEncodeParts: string[] = [];
    const formData: NonNullable<Request['formData']> = [];
    const auth: AuthConfig = { type: 'none' };
    let methodExplicit = false;
    let getWithData = false;
    let bodyTypeHint: RequestBodyType | undefined;
    let binaryFilePath = '';
    let followRedirects = false;
    let tlsValidation: Request['tlsValidation'] = 'default';

    for (let index = 0; index < tokens.length; index++) {
      const option = CurlService.splitOptionToken(tokens[index]);
      const tok = option.flag;

      const readValue = (flag: string, kind: 'method' | 'header' | 'form' | 'generic' | 'unsupported' = 'generic'): string | undefined => {
        if (option.inlineValue !== undefined) { return option.inlineValue; }
        const next = tokens[index + 1];
        if (next === undefined || CurlService.shouldTreatAsMissingValue(kind, next)) {
          warnings.push(`Missing value for cURL option: ${flag}`);
          return undefined;
        }
        index++;
        return next;
      };

      switch (tok) {
        case '-X':
        case '--request': {
          const value = readValue(tok, 'method');
          if (!value) { break; }
          const normalizedMethod = value.toUpperCase();
          if (VALID_METHODS.has(normalizedMethod as HttpMethod)) {
            method = normalizedMethod as HttpMethod;
            methodExplicit = true;
          } else {
            warnings.push(`Unsupported HTTP method ignored: ${value}.`);
          }
          break;
        }
        case '-H':
        case '--header': {
          const value = readValue(tok, 'header');
          if (!value) { break; }
          CurlService.addHeader(headers, value, warnings);
          break;
        }
        case '-d':
        case '--data':
        case '--data-ascii':
        case '--data-raw':
        case '--data-binary': {
          const value = readValue(tok);
          if (value === undefined) { break; }
          if (tok === '--data-binary' && value.startsWith('@')) {
            const filePath = value.slice(1);
            if (!filePath) {
              warnings.push('Empty --data-binary @file value cannot be imported.');
              break;
            }
            if (bodyParts.length > 0 || binaryFilePath) {
              warnings.push('Multiple cURL request bodies cannot be represented without loss; the last binary file is retained.');
            }
            binaryFilePath = filePath;
            bodyTypeHint = 'binary';
          } else {
            if (binaryFilePath) {
              warnings.push('Multiple cURL request bodies cannot be represented without loss; the binary file reference was replaced by inline data.');
              binaryFilePath = '';
            }
            bodyParts.push(value);
            if (tok === '--data-binary') { bodyTypeHint = 'raw'; }
          }
          if (!methodExplicit && !getWithData) { method = 'POST'; }
          break;
        }
        case '-F':
        case '--form':
        case '--form-string': {
          const value = readValue(tok, 'form');
          if (value === undefined) { break; }
          const field = CurlService.parseFormField(value, tok === '--form-string', warnings);
          if (field) {
            formData.push(field);
            bodyTypeHint = 'formdata';
            if (!methodExplicit && !getWithData) { method = 'POST'; }
          }
          break;
        }
        case '--data-urlencode': {
          const value = readValue(tok);
          if (value === undefined) { break; }
          dataUrlEncodeParts.push(value);
          bodyTypeHint = 'form';
          if (!methodExplicit && !getWithData) { method = 'POST'; }
          break;
        }
        case '-G':
        case '--get':
          getWithData = true;
          if (!methodExplicit) { method = 'GET'; }
          break;
        case '--url': {
          const value = readValue(tok);
          if (value) { url = value; }
          break;
        }
        case '-b':
        case '--cookie': {
          const value = readValue(tok);
          if (value) { cookies.push(value); }
          break;
        }
        case '-u':
        case '--user': {
          const value = readValue(tok);
          if (!value) { break; }
          const sepIdx = value.indexOf(':');
          if (sepIdx > 0) {
            auth.type = 'basic';
            auth.basic = {
              username: value.substring(0, sepIdx),
              password: value.substring(sepIdx + 1),
            };
          } else {
            warnings.push('Basic auth credentials should use username:password format.');
          }
          break;
        }
        case '--compressed':
          CurlService.ensureHeader(headers, 'Accept-Encoding', 'gzip, deflate, br');
          break;
        case '-L':
        case '--location':
          followRedirects = true;
          break;
        case '-k':
        case '--insecure':
          tlsValidation = 'insecure';
          break;
        case '-A':
        case '--user-agent': {
          const value = readValue(tok);
          if (value) { CurlService.setHeader(headers, 'User-Agent', value); }
          break;
        }
        case '-e':
        case '--referer':
        case '--referrer': {
          const value = readValue(tok);
          if (value) { CurlService.setHeader(headers, 'Referer', value); }
          break;
        }
        case '-s':
        case '--silent':
        case '-S':
        case '--show-error':
        case '-v':
        case '--verbose':
        case '-i':
        case '--include':
          warnings.push(`Ignored cURL flag with no request effect in Tessra: ${tok}`);
          break;
        default:
          if (tok.startsWith('-')) {
            if (UNSUPPORTED_VALUE_SHORT_FLAGS.has(tok) || UNSUPPORTED_VALUE_LONG_FLAGS.has(tok)) {
              const value = readValue(tok, 'unsupported');
              warnings.push(`Unsupported cURL option ignored: ${tok}${value === undefined ? '' : ` (argument ${value} was ignored)`}.`);
            } else {
              warnings.push(`Unsupported cURL flag ignored: ${tokens[index]}.`);
            }
          } else {
            url = tok;
          }
      }
    }

    if (cookies.length > 0) {
      const existing = headers.find((h) => h.key.toLowerCase() === 'cookie');
      if (existing) {
        existing.value += '; ' + cookies.join('; ');
      } else {
        headers.push({ key: 'Cookie', value: cookies.join('; '), enabled: true });
      }
    }

    const params: KeyValue[] = [];
    try {
      const parsed = new URL(url);
      parsed.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true });
      });
      if (params.length > 0) {
        url = parsed.origin + parsed.pathname;
      }
    } catch {
      if (!url) {
        warnings.push('No URL was found in the cURL command.');
      }
    }

    if (getWithData) {
      for (const part of [...bodyParts, ...dataUrlEncodeParts]) {
        CurlService.appendDataParams(params, part, warnings);
      }
      bodyParts.length = 0;
      dataUrlEncodeParts.length = 0;
      if (formData.length > 0 || binaryFilePath) {
        warnings.push('cURL form or binary data cannot be moved into query parameters and was ignored for -G/--get.');
        formData.length = 0;
        binaryFilePath = '';
        bodyTypeHint = undefined;
      }
      if (!methodExplicit) { method = 'GET'; }
    }

    let body = '';
    if (dataUrlEncodeParts.length > 0) {
      const encodedParts = dataUrlEncodeParts.map((part) => CurlService.encodeFormPart(part, warnings));
      body = [...bodyParts, ...encodedParts].filter((part) => part.length > 0).join('&');
      CurlService.ensureHeader(headers, 'Content-Type', 'application/x-www-form-urlencoded');
    } else {
      body = bodyParts.join('&');
    }

    const authHeaderIdx = headers.findIndex(
      (h) => h.key.toLowerCase() === 'authorization'
    );
    if (authHeaderIdx >= 0 && auth.type === 'none') {
      const val = headers[authHeaderIdx].value;
      if (val.toLowerCase().startsWith('bearer ')) {
        auth.type = 'bearer';
        auth.bearer = { token: val.substring(7) };
        headers.splice(authHeaderIdx, 1);
      } else if (val.toLowerCase().startsWith('basic ')) {
        try {
          const decoded = Buffer.from(val.substring(6), 'base64').toString();
          const sepIdx = decoded.indexOf(':');
          if (sepIdx > 0) {
            auth.type = 'basic';
            auth.basic = {
              username: decoded.substring(0, sepIdx),
              password: decoded.substring(sepIdx + 1),
            };
            headers.splice(authHeaderIdx, 1);
          }
        } catch {
          warnings.push('Authorization Basic header could not be decoded and was kept as a header.');
        }
      }
    }

    const ctHeader = headers.find((h) => h.key.toLowerCase() === 'content-type');
    const hasBody = body.length > 0 || formData.length > 0 || binaryFilePath.length > 0;
    const bodyType: RequestBodyType = hasBody
      ? (bodyTypeHint ?? this.inferBodyType(ctHeader?.value ?? ''))
      : 'none';

    return {
      request: {
        id: '',
        name: `${method} ${url}`,
        method,
        url,
        headers,
        params,
        body,
        bodyType,
        formData,
        binaryFilePath,
        auth,
        followRedirects,
        tlsValidation,
        scripts: { preRequest: '', test: '' },
      },
      warnings,
    };
  }

  static generate(req: {
    method: string;
    url: string;
    headers?: KeyValue[];
    params?: KeyValue[];
    body?: string;
    bodyType?: RequestBodyType;
    formData?: Request['formData'];
    binaryFilePath?: string;
    auth?: AuthConfig;
  }): string {
    const parts: string[] = ['curl'];
    let fullUrl = req.url || '';
    const activeHeaders = (req.headers ?? [])
      .filter((header) => header.enabled && header.key)
      .map((header) => ({ ...header }));
    const activeParams = (req.params ?? [])
      .filter((param) => param.enabled && param.key)
      .map((param) => ({ ...param }));

    if (req.auth?.type === 'basic' || req.auth?.type === 'bearer') {
      this.removeHeader(activeHeaders, 'Authorization');
    } else if (req.auth?.type === 'apikey' && req.auth.apikey?.key) {
      if (req.auth.apikey.addTo === 'query') {
        this.removeParam(activeParams, req.auth.apikey.key);
        activeParams.push({
          key: req.auth.apikey.key,
          value: req.auth.apikey.value,
          enabled: true,
        });
      } else {
        this.removeHeader(activeHeaders, req.auth.apikey.key);
      }
    }
    if (activeParams.length > 0) {
      fullUrl = buildUrl(fullUrl, coalesceQueryParams(fullUrl, activeParams));
    }

    if (req.method && req.method !== 'GET') {
      parts.push(`-X ${req.method}`);
    }

    parts.push(`'${CurlService.shellEscape(fullUrl)}'`);

    if (req.auth) {
      switch (req.auth.type) {
        case 'basic':
          if (req.auth.basic) {
            parts.push(`-u '${CurlService.shellEscape(req.auth.basic.username + ':' + req.auth.basic.password)}'`);
          }
          break;
        case 'bearer':
          if (req.auth.bearer) {
            parts.push(`-H 'Authorization: Bearer ${CurlService.shellEscape(req.auth.bearer.token)}'`);
          }
          break;
        case 'apikey':
          if (req.auth.apikey && req.auth.apikey.addTo === 'header') {
            parts.push(`-H '${CurlService.shellEscape(req.auth.apikey.key)}: ${CurlService.shellEscape(req.auth.apikey.value)}'`);
          }
          break;
      }
    }

    for (const header of activeHeaders) {
      parts.push(`-H '${CurlService.shellEscape(header.key)}: ${CurlService.shellEscape(header.value)}'`);
    }

    if (req.bodyType === 'formdata' && req.formData && req.formData.length > 0) {
      for (const field of req.formData.filter((field) => field.enabled && field.key)) {
        if (field.type === 'file') {
          const filePath = CurlService.escapeFormFilePath(field.value);
          parts.push(`-F '${CurlService.shellEscape(field.key)}=@${CurlService.shellEscape(filePath)}'`);
        } else if (CurlService.shouldUseFormString(field.value)) {
          parts.push(`--form-string '${CurlService.shellEscape(field.key)}=${CurlService.shellEscape(field.value)}'`);
        } else {
          parts.push(`-F '${CurlService.shellEscape(field.key)}=${CurlService.shellEscape(field.value)}'`);
        }
      }
    } else if (req.bodyType === 'binary' && req.binaryFilePath) {
      parts.push(`--data-binary '@${CurlService.shellEscape(req.binaryFilePath)}'`);
    } else if (req.body) {
      parts.push(`-d '${CurlService.shellEscape(req.body)}'`);
    }

    return parts.join(' \\\n  ');
  }

  private static splitOptionToken(token: string): OptionToken {
    if (token.startsWith('--')) {
      const index = token.indexOf('=');
      if (index > 2) {
        return {
          flag: token.slice(0, index),
          inlineValue: token.slice(index + 1),
        };
      }
    }
    return { flag: token };
  }

  private static expandCompactShortOptions(tokens: string[], warnings: string[]): string[] {
    const expanded: string[] = [];
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const previousValueKind = index > 0 ? CurlService.valueKindForOptionToken(tokens[index - 1]) : undefined;
      if (previousValueKind && !CurlService.shouldTreatAsMissingValue(previousValueKind, token)) {
        expanded.push(token);
        continue;
      }
      expanded.push(...CurlService.expandCompactShortOption(token, warnings));
    }
    return expanded;
  }

  private static expandCompactShortOption(token: string, warnings: string[]): string[] {
    if (!token.startsWith('-') || token.startsWith('--') || token.length <= 2) {
      return [token];
    }

    const out: string[] = [];
    for (let index = 1; index < token.length; index++) {
      const flag = `-${token[index]}`;
      if (VALUE_REQUIRED_SHORT_FLAGS.has(flag)) {
        out.push(flag);
        const value = token.slice(index + 1);
        if (value) { out.push(value); }
        return out;
      }
      if (BOOLEAN_SHORT_FLAGS.has(flag)) {
        out.push(flag);
        continue;
      }
      if (out.length === 0) {
        return [token];
      }
      warnings.push(`Unsupported cURL flag ignored: ${flag}`);
    }

    return out.length > 0 ? out : [token];
  }

  private static shouldTreatAsMissingValue(kind: 'method' | 'header' | 'form' | 'generic' | 'unsupported', next: string): boolean {
    if ((kind === 'method' || kind === 'header' || kind === 'form' || kind === 'unsupported') && CurlService.looksLikeUrl(next)) {
      return true;
    }

    // Hyphen-prefixed payloads such as -1 are valid cURL values. Only tokens
    // that clearly look like cURL options interrupt value reading.
    if (CurlService.isExactKnownShortFlag(next) || CurlService.isLongOptionLike(next)) {
      return true;
    }
    if (CurlService.isBooleanShortBundle(next)) {
      return true;
    }
    return kind !== 'generic' && CurlService.isCompactValueShortOption(next);
  }

  private static valueKindForOptionToken(token: string): 'method' | 'header' | 'generic' | undefined {
    const option = CurlService.splitOptionToken(token);
    if (option.inlineValue !== undefined) { return undefined; }
    switch (option.flag) {
      case '-X':
      case '--request':
        return 'method';
      case '-H':
      case '--header':
        return 'header';
      case '-d':
      case '--data':
      case '--data-ascii':
      case '--data-raw':
      case '--data-binary':
      case '--data-urlencode':
      case '-F':
      case '--form':
      case '--form-string':
      case '-b':
      case '--cookie':
      case '-u':
      case '--user':
      case '-A':
      case '--user-agent':
      case '-e':
      case '--referer':
      case '--referrer':
      case '--url':
        return 'generic';
      default:
        return undefined;
    }
  }

  private static looksLikeUrl(value: string): boolean {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  }

  private static isExactKnownShortFlag(value: string): boolean {
    return VALUE_REQUIRED_SHORT_FLAGS.has(value) || BOOLEAN_SHORT_FLAGS.has(value);
  }

  private static isLongOptionLike(value: string): boolean {
    if (!/^--[A-Za-z][A-Za-z0-9-]*(=|$)/.test(value)) { return false; }
    const name = value.includes('=') ? value.slice(0, value.indexOf('=')) : value;
    return KNOWN_LONG_FLAGS.has(name) || value.startsWith('--');
  }

  private static isBooleanShortBundle(value: string): boolean {
    return /^-[A-Za-z]{2,}$/.test(value)
      && value.slice(1).split('').every((char) => BOOLEAN_SHORT_FLAGS.has(`-${char}`));
  }

  private static isCompactValueShortOption(value: string): boolean {
    return /^-[A-Za-z].+/.test(value) && VALUE_REQUIRED_SHORT_FLAGS.has(value.slice(0, 2));
  }

  private static addHeader(headers: KeyValue[], raw: string, warnings: string[]): void {
    const colonIdx = raw.indexOf(':');
    if (colonIdx <= 0) {
      warnings.push(`Invalid header format: ${raw}. Expected "Name: value".`);
      return;
    }
    const key = raw.substring(0, colonIdx).trim();
    if (!key) {
      warnings.push(`Invalid header format: ${raw}. Header name is empty.`);
      return;
    }
    headers.push({
      key,
      value: raw.substring(colonIdx + 1).trim(),
      enabled: true,
    });
  }

  private static ensureHeader(headers: KeyValue[], key: string, value: string): void {
    if (!headers.some((header) => header.key.toLowerCase() === key.toLowerCase())) {
      headers.push({ key, value, enabled: true });
    }
  }

  private static setHeader(headers: KeyValue[], key: string, value: string): void {
    const existing = headers.find((header) => header.key.toLowerCase() === key.toLowerCase());
    if (existing) {
      existing.value = value;
    } else {
      headers.push({ key, value, enabled: true });
    }
  }

  private static appendDataParams(params: KeyValue[], raw: string, warnings: string[]): void {
    if (!raw) {
      warnings.push('Empty data value was ignored for -G/--get.');
      return;
    }
    if (raw.includes('&')) {
      for (const [key, value] of new URLSearchParams(raw)) {
        params.push({ key, value, enabled: true });
      }
      return;
    }
    const index = raw.indexOf('=');
    if (index >= 0) {
      params.push({
        key: raw.slice(0, index),
        value: raw.slice(index + 1),
        enabled: true,
      });
    } else {
      params.push({ key: raw, value: '', enabled: true });
    }
  }

  private static parseFormField(
    raw: string,
    forceText: boolean,
    warnings: string[]
  ): NonNullable<Request['formData']>[number] | null {
    const equals = raw.indexOf('=');
    if (equals <= 0) {
      warnings.push(`Invalid cURL form field: ${raw}. Expected "name=value" or "name=@file".`);
      return null;
    }
    const key = raw.slice(0, equals);
    const value = raw.slice(equals + 1);
    if (!forceText && value.startsWith('@')) {
      const fileAndAttributes = value.slice(1);
      const attributeIndex = CurlService.findUnescapedSemicolon(fileAndAttributes);
      const filePath = attributeIndex >= 0 ? fileAndAttributes.slice(0, attributeIndex) : fileAndAttributes;
      if (attributeIndex >= 0) {
        warnings.push(`Unsupported cURL form attributes ignored: ${fileAndAttributes.slice(attributeIndex + 1)}.`);
      }
      if (!filePath) {
        warnings.push(`Empty file path in cURL form field: ${raw}.`);
        return null;
      }
      return {
        id: `fd_${Math.random().toString(36).slice(2, 10)}`,
        key,
        value: CurlService.unescapeFormFilePath(filePath),
        enabled: true,
        type: 'file',
      };
    }
    if (!forceText && value.startsWith('<')) {
      warnings.push(`Unsupported cURL form file-content syntax preserved as text: ${raw}.`);
    }
    return {
      id: `fd_${Math.random().toString(36).slice(2, 10)}`,
      key,
      value,
      enabled: true,
      type: 'text',
    };
  }

  private static encodeFormPart(raw: string, warnings: string[]): string {
    if (!raw) {
      warnings.push('Empty --data-urlencode value was ignored.');
      return '';
    }
    const index = raw.indexOf('=');
    if (index >= 0) {
      return `${encodeURIComponent(raw.slice(0, index))}=${encodeURIComponent(raw.slice(index + 1))}`;
    }
    return encodeURIComponent(raw);
  }

  private static shouldUseFormString(value: string): boolean {
    return /^[<@]/.test(value) || value.includes(';');
  }

  private static escapeFormFilePath(value: string): string {
    return value.replace(/;/g, '\\;');
  }

  private static unescapeFormFilePath(value: string): string {
    return value.replace(/\\;/g, ';');
  }

  private static findUnescapedSemicolon(value: string): number {
    for (let index = 0; index < value.length; index++) {
      if (value[index] !== ';') { continue; }
      let backslashes = 0;
      for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor--) {
        backslashes++;
      }
      if (backslashes % 2 === 0) { return index; }
    }
    return -1;
  }

  private static normalizeCurl(raw: string): string {
    const trimmed = raw.trim();
    const isCmd = /\^\s*\r?\n/.test(trimmed) || /\^"/.test(trimmed);
    if (isCmd) {
      return CurlService.normalizeCmd(trimmed);
    }
    return trimmed.replace(/\\\s*\r?\n/g, ' ');
  }

  private static normalizeCmd(raw: string): string {
    const result = raw.replace(/\^\s*\r?\n\s*/g, ' ');
    let out = '';
    let index = 0;
    while (index < result.length) {
      if (result[index] === '^' && index + 1 < result.length) {
        out += result[index + 1];
        index += 2;
      } else {
        out += result[index];
        index++;
      }
    }
    return out;
  }

  private static shellEscape(value: string): string {
    return value.replace(/'/g, "'\\''");
  }

  private static removeHeader(headers: KeyValue[], key: string): void {
    const target = key.toLowerCase();
    for (let index = headers.length - 1; index >= 0; index--) {
      if (headers[index].key.toLowerCase() === target) {
        headers.splice(index, 1);
      }
    }
  }

  private static removeParam(params: KeyValue[], key: string): void {
    for (let index = params.length - 1; index >= 0; index--) {
      if (params[index].key === key) {
        params.splice(index, 1);
      }
    }
  }

  private static inferBodyType(contentType: string): RequestBodyType {
    const normalized = contentType.toLowerCase();
    if (normalized.includes('json')) { return 'json'; }
    if (normalized.includes('xml')) { return 'xml'; }
    if (normalized.includes('x-www-form-urlencoded')) { return 'form'; }
    return 'raw';
  }

  private static tokenize(input: string): TokenizeResult {
    const tokens: string[] = [];
    const warnings: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escape = false;

    for (const char of input) {
      if (escape) {
        current += char;
        escape = false;
        continue;
      }
      if (char === '\\' && !inSingle) {
        escape = true;
        continue;
      }
      if (char === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (char === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if ((char === ' ' || char === '\t') && !inSingle && !inDouble) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }

    if (escape) {
      throw new Error('Malformed cURL command: dangling escape character.');
    }
    if (inSingle || inDouble) {
      throw new Error('Malformed cURL command: unmatched quote.');
    }
    if (current) { tokens.push(current); }
    return { tokens, warnings };
  }
}
