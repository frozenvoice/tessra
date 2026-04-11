import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { HttpMethod, KeyValue, Response } from '../models/types';

export interface SendHandle {
  promise: Promise<Response>;
  abort: () => void;
}

// Node.js 내장 http/https 모듈로 HTTP 요청 실행
export class HttpService {
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
    timeoutSec: number = 0,
    allowInsecureHttps: boolean = false
  ): SendHandle {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    // 활성화된 헤더만 적용
    const headerMap: Record<string, string> = {};
    for (const h of headers) {
      if (h.enabled && h.key) {
        headerMap[h.key] = h.value;
      }
    }

    const options: http.RequestOptions & { rejectUnauthorized?: boolean } = {
      method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: headerMap,
    };
    if (isHttps && allowInsecureHttps) {
      // 자체 서명 인증서 허용은 명시적으로 켠 경우에만 적용
      options.rejectUnauthorized = false;
    }

    const startTime = Date.now();

    let reqRef: http.ClientRequest;

    const promise = new Promise<Response>((resolve, reject) => {
      reqRef = transport.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const elapsed = Date.now() - startTime;
          const buffer = Buffer.concat(chunks);

          // 응답 헤더를 단순 레코드로 변환
          const responseHeaders: Record<string, string> = {};
          // Set-Cookie는 배열 그대로 보존 (expires 날짜의 쉼표 때문에 join하면 파싱 불가)
          const rawSetCookies: string[] = [];
          for (const [key, val] of Object.entries(res.headers)) {
            if (val) {
              if (key.toLowerCase() === 'set-cookie' && Array.isArray(val)) {
                rawSetCookies.push(...val);
                responseHeaders[key] = val.join(', ');
              } else {
                responseHeaders[key] = Array.isArray(val) ? val.join(', ') : val;
              }
            }
          }

          const contentType = responseHeaders['content-type'] ?? '';
          const isBinary = HttpService.isBinaryContentType(contentType);

          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? '',
            headers: responseHeaders,
            rawSetCookies: rawSetCookies.length > 0 ? rawSetCookies : undefined,
            body: buffer.toString('utf-8'),
            bodyBase64: isBinary ? buffer.toString('base64') : undefined,
            time: elapsed,
            size: buffer.length,
          });
        });
      });

      reqRef.on('error', (err) => {
        reject(err);
      });

      // 타임아웃 (0이면 무제한)
      if (timeoutSec > 0) {
        const ms = timeoutSec * 1000;
        reqRef.setTimeout(ms, () => {
          reqRef.destroy(new Error(`요청 타임아웃 (${timeoutSec}초)`));
        });
      }

      // body 전송 (GET/HEAD 제외)
      if (body && method !== 'GET' && method !== 'HEAD') {
        reqRef.write(body);
      }

      reqRef.end();
    });

    return {
      promise,
      abort: () => { reqRef.destroy(new Error('요청이 취소되었습니다')); },
    };
  }

  // 파일 저장이 필요한 바이너리 응답만 base64로 함께 보존
  private static isBinaryContentType(contentType: string): boolean {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    if (!mime) { return false; }
    if (mime.startsWith('text/')) { return false; }
    if (mime.endsWith('+json') || mime.endsWith('+xml')) { return false; }
    return !this.TEXT_CONTENT_TYPES.has(mime);
  }
}
