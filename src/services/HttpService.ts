import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import { URL } from 'url';
import { HttpMethod, KeyValue, Response } from '../models/types';

export interface SendHandle {
  promise: Promise<Response>;
  abort: () => void;
}

export interface HttpSendOptions {
  timeoutSec?: number;
  allowInsecureHttps?: boolean;
  followRedirects?: boolean;
  maxResponseSizeBytes?: number;
  stopAfterHeaders?: boolean;
}

// Node.js 내장 http/https 모듈로 HTTP 요청 실행
export class HttpService {
  static readonly DEFAULT_MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024;
  private static readonly REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
  private static readonly MAX_REDIRECTS = 10;
  private static readonly TEXT_CONTENT_TYPES = new Set([
    'application/json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'text/javascript',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/ld+json',
    'application/x-ndjson',
  ]);

  send(
    method: HttpMethod,
    url: string,
    headers: KeyValue[],
    body: string | Buffer,
    options: HttpSendOptions = {}
  ): SendHandle {
    const baseHeaders: Record<string, string> = {};
    for (const header of headers) {
      if (header.enabled && header.key) {
        baseHeaders[header.key] = header.value;
      }
    }

    const timeoutSec = Math.max(0, options.timeoutSec ?? 0);
    const allowInsecureHttps = options.allowInsecureHttps === true;
    const followRedirects = options.followRedirects === true;
    const maxResponseSizeBytes = HttpService.normalizeMaxResponseSizeBytes(options.maxResponseSizeBytes);
    const stopAfterHeaders = options.stopAfterHeaders === true;
    const startTime = Date.now();

    let reqRef: http.ClientRequest | undefined;
    let settled = false;
    let aborted = false;

    const promise = new Promise<Response>((resolve, reject) => {
      const safeResolve = (value: Response) => {
        if (settled) { return; }
        settled = true;
        resolve(value);
      };

      const safeReject = (error: unknown) => {
        if (settled) { return; }
        settled = true;
        reject(error);
      };

      const extractResponseHeaders = (rawHeaders: http.IncomingHttpHeaders): Pick<Response, 'headers' | 'rawSetCookies'> => {
        const responseHeaders: Record<string, string> = {};
        const rawSetCookies: string[] = [];

        for (const [key, value] of Object.entries(rawHeaders)) {
          if (!value) { continue; }
          if (key.toLowerCase() === 'set-cookie' && Array.isArray(value)) {
            rawSetCookies.push(...value);
            responseHeaders[key] = value.join(', ');
          } else {
            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
          }
        }

        return {
          headers: responseHeaders,
          rawSetCookies: rawSetCookies.length > 0 ? rawSetCookies : undefined,
        };
      };

      const deleteHeaderCaseInsensitive = (map: Record<string, string>, headerName: string): void => {
        for (const key of Object.keys(map)) {
          if (key.toLowerCase() === headerName.toLowerCase()) {
            delete map[key];
          }
        }
      };

      const isSensitiveRedirectHeader = (headerName: string): boolean => {
        const normalized = headerName.toLowerCase();
        return normalized === 'authorization'
          || normalized === 'proxy-authorization'
          || normalized === 'cookie'
          || normalized === 'x-api-key'
          || normalized === 'api-key'
          || normalized === 'apikey'
          || normalized.endsWith('-api-key')
          || normalized.includes('token');
      };

      const deleteSensitiveRedirectHeaders = (map: Record<string, string>): void => {
        for (const key of Object.keys(map)) {
          if (isSensitiveRedirectHeader(key)) {
            delete map[key];
          }
        }
      };

      const getRedirectTarget = (
        statusCode: number,
        currentMethod: HttpMethod,
        currentUrl: string,
        currentBody: string | Buffer,
        responseHeaders: Record<string, string>,
        currentHeaders: Record<string, string>
      ): { nextMethod: HttpMethod; nextUrl: string; nextBody: string | Buffer; nextHeaders: Record<string, string> } | null => {
        const location = Object.entries(responseHeaders).find(([key]) => key.toLowerCase() === 'location')?.[1];
        if (!location) { return null; }

        let nextMethod = currentMethod;
        let nextBody = currentBody;
        const nextHeaders = { ...currentHeaders };
        let nextUrl: string;

        try {
          nextUrl = new URL(location, currentUrl).toString();
        } catch {
          safeReject(new Error('Invalid redirect URL'));
          return null;
        }

        const currentOrigin = new URL(currentUrl).origin;
        const nextOrigin = new URL(nextUrl).origin;
        if (currentOrigin !== nextOrigin) {
          // 교차 origin 리다이렉트에서는 인증성 헤더를 보수적으로 제거한다.
          deleteSensitiveRedirectHeaders(nextHeaders);
        }

        if (statusCode === 303 || ((statusCode === 301 || statusCode === 302) && currentMethod === 'POST')) {
          nextMethod = 'GET';
          nextBody = '';
          deleteHeaderCaseInsensitive(nextHeaders, 'content-length');
          deleteHeaderCaseInsensitive(nextHeaders, 'content-type');
        }

        return {
          nextMethod,
          nextUrl,
          nextBody,
          nextHeaders,
        };
      };

      const performRequest = (
        currentMethod: HttpMethod,
        currentUrl: string,
        currentBody: string | Buffer,
        currentHeaders: Record<string, string>,
        redirectCount: number
      ) => {
        if (settled) { return; }
        if (aborted) {
          safeReject(new Error('Request was canceled'));
          return;
        }

        let parsedUrl: URL;
        try {
          parsedUrl = new URL(currentUrl);
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            throw new Error(`Unsupported HTTP protocol: ${parsedUrl.protocol}`);
          }
        } catch (error: unknown) {
          safeReject(error);
          return;
        }
        const isHttps = parsedUrl.protocol === 'https:';
        const transport = isHttps ? https : http;
        const requestOptions: http.RequestOptions & { rejectUnauthorized?: boolean } = {
          method: currentMethod,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          headers: currentHeaders,
        };

        if (isHttps && allowInsecureHttps) {
          requestOptions.rejectUnauthorized = false;
        }

        reqRef = transport.request(requestOptions, (res) => {
          const statusCode = res.statusCode ?? 0;
          const headerInfo = extractResponseHeaders(res.headers);
          const responseHeaders = headerInfo.headers;
          const rejectResponseStream = (error: Error) => {
            safeReject(error);
          };
          res.on('error', rejectResponseStream);
          res.on('aborted', () => {
            rejectResponseStream(new Error('Response aborted before completion'));
          });

          if (followRedirects && HttpService.REDIRECT_STATUS_CODES.has(statusCode)) {
            if (redirectCount >= HttpService.MAX_REDIRECTS) {
              res.resume();
              safeReject(new Error(`Too many redirects (${HttpService.MAX_REDIRECTS})`));
              return;
            }

            const redirectTarget = getRedirectTarget(
              statusCode,
              currentMethod,
              currentUrl,
              currentBody,
              responseHeaders,
              currentHeaders
            );
            if (settled) { res.resume(); return; }
            if (redirectTarget) {
              res.resume();
              res.on('end', () => {
                performRequest(
                  redirectTarget.nextMethod,
                  redirectTarget.nextUrl,
                  redirectTarget.nextBody,
                  redirectTarget.nextHeaders,
                  redirectCount + 1
                );
              });
              return;
            }
          }

          if (stopAfterHeaders) {
            safeResolve({
              status: statusCode,
              statusText: res.statusMessage ?? '',
              headers: responseHeaders,
              rawSetCookies: headerInfo.rawSetCookies,
              body: '',
              time: Date.now() - startTime,
              size: 0,
            });
            res.destroy();
            return;
          }

          const chunks: Buffer[] = [];
          let totalSize = 0;

          res.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;
            if (maxResponseSizeBytes > 0 && totalSize > maxResponseSizeBytes) {
              const error = new Error(`Response exceeded max size (${Math.ceil(maxResponseSizeBytes / 1024)} KB)`);
              safeReject(error);
              res.destroy();
              reqRef?.destroy();
              return;
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            if (aborted) { return; }
            const rawBuffer = Buffer.concat(chunks);
            let buffer: Buffer;
            try {
              buffer = HttpService.decodeResponseBody(rawBuffer, responseHeaders, maxResponseSizeBytes);
            } catch (error: unknown) {
              safeReject(error);
              return;
            }
            const contentType = responseHeaders['content-type'] ?? responseHeaders['Content-Type'] ?? '';
            const isBinary = HttpService.isBinaryContentType(contentType);

            safeResolve({
              status: statusCode,
              statusText: res.statusMessage ?? '',
              headers: responseHeaders,
              rawSetCookies: headerInfo.rawSetCookies,
              body: buffer.toString('utf-8'),
              bodyBase64: isBinary ? buffer.toString('base64') : undefined,
              time: Date.now() - startTime,
              size: buffer.length,
            });
          });
        });

        reqRef.on('error', (err) => {
          safeReject(err);
        });

        if (timeoutSec > 0) {
          reqRef.setTimeout(timeoutSec * 1000, () => {
            reqRef?.destroy(new Error(`Request timed out (${timeoutSec}s)`));
          });
        }

        if (currentBody && currentMethod !== 'GET' && currentMethod !== 'HEAD') {
          reqRef.write(currentBody);
        }

        reqRef.end();
      };

      performRequest(method, url, body, { ...baseHeaders }, 0);
    });

    return {
      promise,
      abort: () => {
        aborted = true;
        reqRef?.destroy(new Error('Request was canceled'));
      },
    };
  }

  private static normalizeMaxResponseSizeBytes(value: number | undefined): number {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) {
      return HttpService.DEFAULT_MAX_RESPONSE_SIZE_BYTES;
    }
    return Math.floor(value as number);
  }

  private static decodeResponseBody(
    buffer: Buffer,
    headers: Record<string, string>,
    maxResponseSizeBytes: number
  ): Buffer {
    const encodings = HttpService.getContentEncodings(headers);
    let decoded = buffer;

    for (const encoding of encodings.reverse()) {
      if (encoding === 'identity') { continue; }
      try {
        switch (encoding) {
          case 'gzip':
          case 'x-gzip':
            decoded = zlib.gunzipSync(decoded, { maxOutputLength: maxResponseSizeBytes });
            break;
          case 'deflate':
            decoded = zlib.inflateSync(decoded, { maxOutputLength: maxResponseSizeBytes });
            break;
          case 'br':
            decoded = zlib.brotliDecompressSync(decoded, { maxOutputLength: maxResponseSizeBytes });
            break;
          default:
            throw new Error(`Unsupported content encoding: ${encoding}`);
        }
      } catch (error: unknown) {
        if (HttpService.isMaxOutputLengthError(error)) {
          throw HttpService.createMaxSizeError(maxResponseSizeBytes);
        }
        if (error instanceof Error && error.message.startsWith('Unsupported content encoding:')) {
          throw error;
        }
        throw new Error(`Failed to decompress ${encoding} response: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (decoded.length > maxResponseSizeBytes) {
        throw HttpService.createMaxSizeError(maxResponseSizeBytes);
      }
    }

    if (decoded.length > maxResponseSizeBytes) {
      throw HttpService.createMaxSizeError(maxResponseSizeBytes);
    }
    return decoded;
  }

  private static getContentEncodings(headers: Record<string, string>): string[] {
    const value = Object.entries(headers)
      .find(([key]) => key.toLowerCase() === 'content-encoding')?.[1] ?? '';
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  private static isMaxOutputLengthError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /maxoutputlength|buffer too large|cannot create a buffer/i.test(message);
  }

  private static createMaxSizeError(maxResponseSizeBytes: number): Error {
    return new Error(`Response exceeded max size (${Math.ceil(maxResponseSizeBytes / 1024)} KB)`);
  }

  // 파일 타입이 의심되는 바이너리 응답만 base64로 원본 보존
  private static isBinaryContentType(contentType: string): boolean {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    if (!mime) { return false; }
    if (mime.startsWith('text/')) { return false; }
    if (mime.endsWith('+json') || mime.endsWith('+xml')) { return false; }
    return !this.TEXT_CONTENT_TYPES.has(mime);
  }
}
