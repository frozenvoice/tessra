import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import { URL } from 'url';
import { Transform } from 'stream';
import { HttpMethod, KeyValue, Response } from '../models/types';
import { decodeResponseText } from './responseTextDecoder';
import { RequestDeadline, RequestTimeoutError } from './RequestDeadline';
import { SseStream, SseStreamOptions, SseStreamUpdate } from './SseStream';

export interface SendHandle {
  promise: Promise<Response>;
  abort: () => void;
}

export interface HttpSendOptions {
  timeoutSec?: number;
  allowInsecureHttps?: boolean;
  followRedirects?: boolean;
  // AuthService가 실제 적용한 인증 헤더명이다. 값이나 저장 설정은 포함하지 않는다.
  credentialHeaderNames?: readonly string[];
  maxResponseSizeBytes?: number;
  stopAfterHeaders?: boolean;
  // 호출자의 자동 재시도도 같은 네트워크 실행 예산을 공유한다. 저장 설정에는 포함하지 않는다.
  deadline?: RequestDeadline;
  onSseUpdate?: (update: SseStreamUpdate) => void;
  // 외부 설정을 변경하지 않는 전송별 보관 상한이다. SSE에도 전체 응답 제한은 별도로 적용한다.
  sseOptions?: SseStreamOptions;
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
    const credentialHeaderNames = new Set((options.credentialHeaderNames ?? []).map((name) => name.toLowerCase()));
    const maxResponseSizeBytes = HttpService.normalizeMaxResponseSizeBytes(options.maxResponseSizeBytes);
    const stopAfterHeaders = options.stopAfterHeaders === true;
    const startTime = Date.now();
    const deadline = options.deadline ?? new RequestDeadline(timeoutSec);

    let reqRef: http.ClientRequest | undefined;
    let resRef: http.IncomingMessage | undefined;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let attemptId = 0;
    let settled = false;
    let aborted = false;
    let abortRequest: () => void = () => undefined;
    let sseRef: SseStream | undefined;
    let decoderRefs: Transform[] = [];

    const promise = new Promise<Response>((resolve, reject) => {
      const cleanup = (destroy: boolean) => {
        clearTimeout(deadlineTimer);
        deadlineTimer = undefined;
        // destroy가 동기 이벤트를 발생시켜도 종료된 시도의 콜백은 무시한다.
        attemptId++;
        const request = reqRef;
        const response = resRef;
        const decoders = decoderRefs;
        reqRef = undefined;
        resRef = undefined;
        decoderRefs = [];
        request?.setTimeout(0);
        for (const decoder of decoders) { decoder.destroy(); }
        if (destroy) {
          response?.destroy();
          request?.destroy();
        }
      };

      const safeResolve = (value: Response) => {
        if (settled) { return; }
        // 동기 압축 해제/문자 디코딩 동안 timer가 실행되지 못했어도 만료는 검사한다.
        try { deadline.throwIfExpired(); } catch (error: unknown) { safeReject(error); return; }
        settled = true;
        if (sseRef) {
          const sse = sseRef.end('completed');
          Object.assign(value, { sse, body: sse.rawBody, bodyBase64: sse.rawBodyBase64 });
        }
        cleanup(!resRef?.complete);
        resolve(value);
      };

      const safeReject = (error: unknown) => {
        if (settled) { return; }
        settled = true;
        if (sseRef) {
          const sse = sseRef.end(aborted ? 'aborted' : error instanceof RequestTimeoutError ? 'timeout' : 'error');
          if (error && typeof error === 'object') {
            // 원래 Error 클래스/이름을 유지해 기존 timeout 판별을 보존한다.
            try { Object.assign(error, { sse }); } catch { /* terminal callback도 부분 응답을 전달한다. */ }
          }
        }
        cleanup(true);
        reject(error);
      };

      const checkDeadline = (): boolean => {
        if (settled) { return false; }
        try { deadline.throwIfExpired(); return true; }
        catch (error: unknown) { safeReject(error); return false; }
      };

      const armDeadline = () => {
        if (!checkDeadline()) { return; }
        const remaining = deadline.remainingMs();
        if (!Number.isFinite(remaining)) { return; }
        // Node timer의 정수 범위를 넘는 예산은 나눠 기다리며 조기 callback도 재확인한다.
        deadlineTimer = setTimeout(() => {
          deadlineTimer = undefined;
          if (checkDeadline()) { armDeadline(); }
        }, Math.min(Math.ceil(remaining), 0x7fffffff));
      };

      abortRequest = () => safeReject(new Error('Request was canceled'));

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
        return credentialHeaderNames.has(normalized)
          || normalized === 'authorization'
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
        if (!checkDeadline()) { return; }
        if (aborted) {
          safeReject(new Error('Request was canceled'));
          return;
        }
        const currentAttempt = ++attemptId;
        const isCurrentAttempt = () => !settled && currentAttempt === attemptId;

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

        let request: http.ClientRequest;
        const receiveResponse = (res: http.IncomingMessage) => {
          res.on('error', (error) => {
            if (isCurrentAttempt() && checkDeadline()) { safeReject(error); }
          });
          res.on('aborted', () => {
            if (isCurrentAttempt() && checkDeadline()) { safeReject(new Error('Response aborted before completion')); }
          });
          if (!isCurrentAttempt() || !checkDeadline()) { res.destroy(); return; }
          resRef = res;
          const statusCode = res.statusCode ?? 0;
          const headerInfo = extractResponseHeaders(res.headers);
          const responseHeaders = headerInfo.headers;

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
                if (!isCurrentAttempt() || !checkDeadline()) { return; }
                request.setTimeout(0);
                reqRef = undefined;
                resRef = undefined;
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

          const contentType = Object.entries(responseHeaders).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? '';
          if (contentType.split(';')[0].trim().toLowerCase() === 'text/event-stream') {
            const sse = new SseStream(
              { status: statusCode, statusText: res.statusMessage ?? '', headers: responseHeaders },
              startTime,
              (update) => {
                // 한 chunk 안에 많은 이벤트가 있어도 배치 경계에서 전체 예산을 다시 검사한다.
                if (update.phase !== 'ended' && !checkDeadline()) { return; }
                options.onSseUpdate?.(update);
              },
              options.sseOptions,
            );
            sseRef = sse;
            sse.start();
            if (!isCurrentAttempt() || !checkDeadline()) { return; }
            let wireSize = 0;
            let decodedSize = 0;
            let source: NodeJS.ReadableStream = res;

            // 압축 응답도 EOF까지 기다리지 않고 해제한다. 각 중간 layer에도 크기 제한을 적용한다.
            for (const encoding of HttpService.getContentEncodings(responseHeaders).reverse()) {
              if (encoding === 'identity') { continue; }
              let decoder: Transform;
              switch (encoding) {
                case 'gzip':
                case 'x-gzip': decoder = zlib.createGunzip(); break;
                case 'deflate': decoder = zlib.createInflate(); break;
                case 'br': decoder = zlib.createBrotliDecompress(); break;
                default: safeReject(new Error(`Unsupported content encoding: ${encoding}`)); return;
              }
              decoderRefs.push(decoder);
              let layerSize = 0;
              decoder.on('data', (chunk: Buffer) => {
                if (!isCurrentAttempt() || !checkDeadline()) { return; }
                layerSize += chunk.length;
                if (layerSize > maxResponseSizeBytes) { safeReject(HttpService.createMaxSizeError(maxResponseSizeBytes)); }
              });
              decoder.on('error', (error) => {
                if (isCurrentAttempt() && checkDeadline()) {
                  safeReject(new Error(`Failed to decompress ${encoding} response: ${error.message}`));
                }
              });
              source = source.pipe(decoder);
            }

            res.on('data', (chunk: Buffer) => {
              if (!isCurrentAttempt() || !checkDeadline()) { return; }
              wireSize += chunk.length;
              sse.addWireBytes(chunk.length);
              if (wireSize > maxResponseSizeBytes) { safeReject(HttpService.createMaxSizeError(maxResponseSizeBytes)); }
            });
            source.on('data', (chunk: Buffer) => {
              if (!isCurrentAttempt() || !checkDeadline()) { return; }
              decodedSize += chunk.length;
              if (decodedSize > maxResponseSizeBytes) { safeReject(HttpService.createMaxSizeError(maxResponseSizeBytes)); return; }
              sse.push(chunk);
              checkDeadline();
            });
            source.on('end', () => {
              if (!isCurrentAttempt() || !checkDeadline()) { return; }
              safeResolve({
                status: statusCode,
                statusText: res.statusMessage ?? '',
                headers: responseHeaders,
                rawSetCookies: headerInfo.rawSetCookies,
                body: '',
                time: Date.now() - startTime,
                size: decodedSize,
              });
            });
            return;
          }

          const chunks: Buffer[] = [];
          let totalSize = 0;

          res.on('data', (chunk: Buffer) => {
            if (!isCurrentAttempt() || !checkDeadline()) { return; }
            totalSize += chunk.length;
            if (maxResponseSizeBytes > 0 && totalSize > maxResponseSizeBytes) {
              const error = new Error(`Response exceeded max size (${Math.ceil(maxResponseSizeBytes / 1024)} KB)`);
              safeReject(error);
              return;
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            if (!isCurrentAttempt() || !checkDeadline()) { return; }
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
            const decodedText = isBinary
              ? { body: buffer.toString('utf-8'), bodyBase64: buffer.toString('base64') }
              : decodeResponseText(buffer, contentType);

            safeResolve({
              status: statusCode,
              statusText: res.statusMessage ?? '',
              headers: responseHeaders,
              rawSetCookies: headerInfo.rawSetCookies,
              ...decodedText,
              time: Date.now() - startTime,
              size: buffer.length,
            });
          });
        };
        try {
          request = transport.request(requestOptions, receiveResponse);
        } catch (error: unknown) { safeReject(error); return; }
        reqRef = request;

        request.on('error', (err) => {
          if (isCurrentAttempt() && checkDeadline()) { safeReject(err); }
        });

        try {
          if (timeoutSec > 0 && timeoutSec * 1000 <= 0x7fffffff) {
            request.setTimeout(timeoutSec * 1000, () => {
              if (isCurrentAttempt()) { safeReject(new RequestTimeoutError(timeoutSec)); }
            });
          }

          if (currentBody && currentMethod !== 'GET' && currentMethod !== 'HEAD') {
            request.write(currentBody);
          }

          request.end();
        } catch (error: unknown) { safeReject(error); }
      };

      armDeadline();
      performRequest(method, url, body, { ...baseHeaders }, 0);
    });

    return {
      promise,
      abort: () => {
        if (settled) { return; }
        aborted = true;
        abortRequest();
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
