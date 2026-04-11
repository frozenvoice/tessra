import { Request, KeyValue, AuthConfig, HttpMethod, RequestBodyType } from '../models/types';

// cURL 파싱 및 생성 서비스
export class CurlService {

  // === cURL 문자열 → Request 객체 변환 ===
  static parse(curl: string): Request {
    // Windows cmd / bash 형식 자동 감지 및 정규화
    const normalized = CurlService.normalizeCurl(curl);

    // curl 명령어 앞부분 제거
    const withoutCmd = normalized.replace(/^curl\s+/i, '');

    const tokens = CurlService.tokenize(withoutCmd);
    let method: HttpMethod = 'GET';
    let url = '';
    const headers: KeyValue[] = [];
    const cookies: string[] = [];
    let body = '';
    const auth: AuthConfig = { type: 'none' };
    let methodExplicit = false;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];

      if (tok === '-X' || tok === '--request') {
        method = (tokens[++i] || 'GET').toUpperCase() as HttpMethod;
        methodExplicit = true;
      } else if (tok === '-H' || tok === '--header') {
        const hdr = tokens[++i] || '';
        const colonIdx = hdr.indexOf(':');
        if (colonIdx > 0) {
          headers.push({
            key: hdr.substring(0, colonIdx).trim(),
            value: hdr.substring(colonIdx + 1).trim(),
            enabled: true,
          });
        }
      } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
        body = tokens[++i] || '';
        if (!methodExplicit) { method = 'POST'; }
      } else if (tok === '-b' || tok === '--cookie') {
        // 쿠키 옵션 수집
        cookies.push(tokens[++i] || '');
      } else if (tok === '-u' || tok === '--user') {
        const cred = tokens[++i] || '';
        const sepIdx = cred.indexOf(':');
        if (sepIdx > 0) {
          auth.type = 'basic';
          auth.basic = {
            username: cred.substring(0, sepIdx),
            password: cred.substring(sepIdx + 1),
          };
        }
      } else if (tok === '--compressed' || tok === '-s' || tok === '--silent'
        || tok === '-k' || tok === '--insecure' || tok === '-v' || tok === '--verbose'
        || tok === '-i' || tok === '--include' || tok === '-L' || tok === '--location') {
        // 무시할 플래그 (값 없음)
      } else if (!tok.startsWith('-')) {
        // URL
        url = tok;
      }
    }

    // -b 쿠키를 Cookie 헤더로 병합
    if (cookies.length > 0) {
      const existing = headers.find((h) => h.key.toLowerCase() === 'cookie');
      if (existing) {
        existing.value += '; ' + cookies.join('; ');
      } else {
        headers.push({ key: 'Cookie', value: cookies.join('; '), enabled: true });
      }
    }

    // URL에서 쿼리 파라미터 추출
    const params: KeyValue[] = [];
    try {
      const parsed = new URL(url);
      parsed.searchParams.forEach((v, k) => {
        params.push({ key: k, value: v, enabled: true });
      });
      // 파라미터 제거한 기본 URL
      if (params.length > 0) {
        url = parsed.origin + parsed.pathname;
      }
    } catch { /* URL 파싱 실패 시 원본 유지 */ }

    // Authorization 헤더에서 인증 정보 추출
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
          auth.type = 'basic';
          auth.basic = {
            username: decoded.substring(0, sepIdx),
            password: decoded.substring(sepIdx + 1),
          };
          headers.splice(authHeaderIdx, 1);
        } catch { /* Base64 디코딩 실패 시 헤더 유지 */ }
      }
    }

    // bodyType 추론
    const ctHeader = headers.find((h) => h.key.toLowerCase() === 'content-type');
    const bodyType: RequestBodyType = body
      ? this.inferBodyType(ctHeader?.value ?? '')
      : 'none';

    return {
      id: '',
      name: `${method} ${url}`,
      method,
      url,
      headers,
      params,
      body,
      bodyType,
      formData: [],
      binaryFilePath: '',
      auth,
      scripts: { preRequest: '', test: '' },
    };
  }

  // Windows cmd 형식 자동 감지 및 정규화
  private static normalizeCurl(raw: string): string {
    const trimmed = raw.trim();

    // Windows cmd 형식 감지: ^ 줄바꿈 연결이나 ^" 이스케이프가 있으면 cmd 형식
    const isCmd = /\^\s*\r?\n/.test(trimmed) || /\^"/.test(trimmed);

    if (isCmd) {
      return CurlService.normalizeCmd(trimmed);
    }

    // bash 형식: \ 줄바꿈 연결
    return trimmed.replace(/\\\s*\r?\n/g, ' ');
  }

  // Windows cmd 형식 전처리
  // Chrome DevTools "Copy as cURL (cmd)" 출력 형식 처리
  // 예: ^"value^\^"inner^\^"end^"  →  "value\"inner\"end"
  //     ^{^\^"key^\^":^\^"val^\^"^}  →  {"key":"val"}
  private static normalizeCmd(raw: string): string {
    // 1단계: 줄 끝 ^ + 줄바꿈 → 공백 (줄 연결)
    let result = raw.replace(/\^\s*\r?\n\s*/g, ' ');

    // 2단계: 문자 단위로 ^이스케이프 해석
    // cmd에서 ^는 바로 다음 문자를 이스케이프하는 역할
    // ^\^" 패턴: ^ 이스케이프된 \, 그 뒤 ^" 이스케이프된 " → \"  → 최종 "
    // ^" → ", ^{ → {, ^} → }, ^^ → ^, ^| → | 등
    let out = '';
    let i = 0;
    while (i < result.length) {
      if (result[i] === '^' && i + 1 < result.length) {
        // ^ 다음 문자를 그대로 출력 (이스케이프 해제)
        out += result[i + 1];
        i += 2;
      } else {
        out += result[i];
        i++;
      }
    }

    // 3단계: 위 처리 결과에서 \" → " 변환 (cmd JSON 바디의 이스케이프된 따옴표)
    // Chrome cmd는 JSON 내 따옴표를 ^\^" 로 표현 → 2단계 후 \" 가 됨
    // tokenizer가 쌍따옴표 안에서 \" 를 이스케이프로 인식하므로 그대로 둠

    return out;
  }

  // === Request 객체 → cURL 문자열 변환 ===
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

    // URL + 쿼리 파라미터 조합
    let fullUrl = req.url || '';
    const activeParams = [...(req.params ?? []).filter((p) => p.enabled && p.key)];
    if (req.auth?.type === 'apikey' && req.auth.apikey?.addTo === 'query' && req.auth.apikey.key) {
      activeParams.push({
        key: req.auth.apikey.key,
        value: req.auth.apikey.value,
        enabled: true,
      });
    }
    if (activeParams.length > 0) {
      try {
        const urlObj = new URL(fullUrl);
        for (const p of activeParams) {
          urlObj.searchParams.append(p.key, p.value);
        }
        fullUrl = urlObj.toString();
      } catch {
        const sep = fullUrl.includes('?') ? '&' : '?';
        const qs = activeParams
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join('&');
        fullUrl = fullUrl + sep + qs;
      }
    }

    // 메서드 (GET이 아니면 명시)
    if (req.method && req.method !== 'GET') {
      parts.push(`-X ${req.method}`);
    }

    parts.push(`'${CurlService.shellEscape(fullUrl)}'`);

    // 인증
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

    // 헤더
    for (const h of (req.headers ?? []).filter((h) => h.enabled && h.key)) {
      parts.push(`-H '${CurlService.shellEscape(h.key)}: ${CurlService.shellEscape(h.value)}'`);
    }

    // 바디
    if (req.bodyType === 'formdata' && req.formData && req.formData.length > 0) {
      for (const field of req.formData.filter((field) => field.enabled && field.key)) {
        if (field.type === 'file') {
          parts.push(`-F '${CurlService.shellEscape(field.key)}=@${CurlService.shellEscape(field.value)}'`);
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

  // 쉘 이스케이프 (싱글쿼트)
  private static shellEscape(s: string): string {
    return s.replace(/'/g, "'\\''");
  }

  private static inferBodyType(contentType: string): RequestBodyType {
    const normalized = contentType.toLowerCase();
    if (normalized.includes('json')) { return 'json'; }
    if (normalized.includes('xml')) { return 'xml'; }
    if (normalized.includes('x-www-form-urlencoded')) { return 'form'; }
    return 'raw';
  }

  // 공백/따옴표를 고려한 토크나이저
  private static tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escape = false;

    for (const ch of input) {
      if (escape) {
        current += ch;
        escape = false;
        continue;
      }
      if (ch === '\\' && !inSingle) {
        escape = true;
        continue;
      }
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
        if (current) { tokens.push(current); current = ''; }
        continue;
      }
      current += ch;
    }
    if (current) { tokens.push(current); }
    return tokens;
  }
}
