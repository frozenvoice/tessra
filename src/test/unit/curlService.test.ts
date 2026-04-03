import * as assert from 'assert';
import { CurlService } from '../../services/CurlService';

// cURL 파싱 및 생성 테스트
describe('CurlService', () => {

  // === parse: bash 형식 ===
  describe('parse - bash 형식', () => {
    it('단순 GET 요청 파싱', () => {
      const req = CurlService.parse("curl 'https://api.example.com/users'");
      assert.strictEqual(req.method, 'GET');
      assert.strictEqual(req.url, 'https://api.example.com/users');
    });

    it('따옴표 없는 URL 파싱', () => {
      const req = CurlService.parse('curl https://api.example.com/users');
      assert.strictEqual(req.method, 'GET');
      assert.strictEqual(req.url, 'https://api.example.com/users');
    });

    it('-X POST + 헤더 + 바디 파싱', () => {
      const curl = `curl -X POST 'https://api.example.com/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json' \\
  -d '{"name":"test","email":"test@test.com"}'`;
      const req = CurlService.parse(curl);
      assert.strictEqual(req.method, 'POST');
      assert.strictEqual(req.url, 'https://api.example.com/users');
      assert.strictEqual(req.headers.length, 2);
      assert.strictEqual(req.headers[0].key, 'Content-Type');
      assert.strictEqual(req.headers[0].value, 'application/json');
      assert.strictEqual(req.body, '{"name":"test","email":"test@test.com"}');
      assert.strictEqual(req.bodyType, 'json');
    });

    it('-d 옵션 시 명시적 메서드 없으면 POST로 추론', () => {
      const req = CurlService.parse("curl 'https://api.example.com/data' -d 'key=value'");
      assert.strictEqual(req.method, 'POST');
    });

    it('명시적 -X GET + -d는 GET 유지', () => {
      const req = CurlService.parse("curl -X GET 'https://api.example.com/data' -d 'key=value'");
      assert.strictEqual(req.method, 'GET');
    });

    it('Bearer 인증 헤더 파싱', () => {
      const curl = "curl 'https://api.example.com' -H 'Authorization: Bearer mytoken123'";
      const req = CurlService.parse(curl);
      assert.strictEqual(req.auth.type, 'bearer');
      assert.strictEqual(req.auth.bearer?.token, 'mytoken123');
      // Authorization 헤더는 auth로 추출되어 headers에서 제거됨
      assert.strictEqual(req.headers.filter(h => h.key.toLowerCase() === 'authorization').length, 0);
    });

    it('Basic 인증 (-u 옵션) 파싱', () => {
      const curl = "curl -u 'admin:password123' 'https://api.example.com'";
      const req = CurlService.parse(curl);
      assert.strictEqual(req.auth.type, 'basic');
      assert.strictEqual(req.auth.basic?.username, 'admin');
      assert.strictEqual(req.auth.basic?.password, 'password123');
    });

    it('Basic 인증 (Authorization 헤더 Base64) 파싱', () => {
      const encoded = Buffer.from('user:pass').toString('base64');
      const curl = `curl 'https://api.example.com' -H 'Authorization: Basic ${encoded}'`;
      const req = CurlService.parse(curl);
      assert.strictEqual(req.auth.type, 'basic');
      assert.strictEqual(req.auth.basic?.username, 'user');
      assert.strictEqual(req.auth.basic?.password, 'pass');
    });

    it('URL 쿼리 파라미터 추출', () => {
      const curl = "curl 'https://api.example.com/search?q=test&page=1'";
      const req = CurlService.parse(curl);
      assert.strictEqual(req.url, 'https://api.example.com/search');
      assert.strictEqual(req.params.length, 2);
      assert.strictEqual(req.params[0].key, 'q');
      assert.strictEqual(req.params[0].value, 'test');
      assert.strictEqual(req.params[1].key, 'page');
      assert.strictEqual(req.params[1].value, '1');
    });

    it('쿠키 (-b) 옵션 파싱', () => {
      const curl = "curl 'https://api.example.com' -b 'session=abc; lang=ko'";
      const req = CurlService.parse(curl);
      const cookie = req.headers.find(h => h.key === 'Cookie');
      assert.ok(cookie);
      assert.strictEqual(cookie.value, 'session=abc; lang=ko');
    });

    it('무시할 플래그 (--compressed, -k 등) 처리', () => {
      const curl = "curl 'https://api.example.com' --compressed -k -s -L";
      const req = CurlService.parse(curl);
      assert.strictEqual(req.method, 'GET');
      assert.strictEqual(req.url, 'https://api.example.com');
      assert.strictEqual(req.headers.length, 0);
    });

    it('--data-raw 옵션 파싱', () => {
      const curl = "curl -X POST 'https://api.example.com' --data-raw '{\"key\":\"value\"}'";
      const req = CurlService.parse(curl);
      assert.strictEqual(req.method, 'POST');
      assert.strictEqual(req.body, '{"key":"value"}');
    });
  });

  // === parse: Windows cmd 형식 ===
  describe('parse - Windows cmd 형식', () => {
    it('cmd 줄바꿈 연결 (^) 파싱', () => {
      const curl = 'curl "https://api.example.com/users" ^\n  -H "Accept: application/json"';
      const req = CurlService.parse(curl);
      assert.strictEqual(req.url, 'https://api.example.com/users');
      assert.strictEqual(req.headers[0].key, 'Accept');
      assert.strictEqual(req.headers[0].value, 'application/json');
    });

    it('cmd ^" 이스케이프 파싱', () => {
      const curl = 'curl "https://api.example.com" ^\n  -H ^"Content-Type: application/json^"';
      const req = CurlService.parse(curl);
      assert.strictEqual(req.headers.length, 1);
      assert.strictEqual(req.headers[0].key, 'Content-Type');
    });

    it('Chrome DevTools cmd 형식 (복잡한 이스케이프)', () => {
      // Chrome "Copy as cURL (cmd)" 형식: ^\^" → \"  → tokenizer에서 " 로 처리
      const curl = 'curl "https://api.example.com" ^\n  -X POST ^\n  -d ^"test body^"';
      const req = CurlService.parse(curl);
      assert.strictEqual(req.method, 'POST');
      assert.strictEqual(req.url, 'https://api.example.com');
      assert.ok(req.body.includes('test body'));
    });
  });

  // === generate: Request → cURL 문자열 ===
  describe('generate', () => {
    it('단순 GET 요청 생성', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com/users',
      });
      assert.ok(curl.startsWith('curl'));
      assert.ok(curl.includes('https://api.example.com/users'));
      // GET은 -X 생략
      assert.ok(!curl.includes('-X'));
    });

    it('POST + 헤더 + 바디 생성', () => {
      const curl = CurlService.generate({
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [
          { key: 'Content-Type', value: 'application/json', enabled: true },
        ],
        body: '{"name":"test"}',
      });
      assert.ok(curl.includes('-X POST'));
      assert.ok(curl.includes("-H 'Content-Type: application/json'"));
      assert.ok(curl.includes("-d '{\"name\":\"test\"}'"));
    });

    it('비활성 헤더는 출력하지 않음', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com',
        headers: [
          { key: 'X-Active', value: 'yes', enabled: true },
          { key: 'X-Disabled', value: 'no', enabled: false },
        ],
      });
      assert.ok(curl.includes('X-Active'));
      assert.ok(!curl.includes('X-Disabled'));
    });

    it('쿼리 파라미터 URL에 포함', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com/search',
        params: [
          { key: 'q', value: 'test', enabled: true },
          { key: 'page', value: '1', enabled: true },
        ],
      });
      assert.ok(curl.includes('q=test'));
      assert.ok(curl.includes('page=1'));
    });

    it('비활성 쿼리 파라미터 제외', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com',
        params: [
          { key: 'active', value: 'yes', enabled: true },
          { key: 'skip', value: 'no', enabled: false },
        ],
      });
      assert.ok(curl.includes('active=yes'));
      assert.ok(!curl.includes('skip=no'));
    });

    it('Bearer 인증 생성', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com',
        auth: { type: 'bearer', bearer: { token: 'my-token' } },
      });
      assert.ok(curl.includes('Authorization: Bearer my-token'));
    });

    it('Basic 인증 생성', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com',
        auth: { type: 'basic', basic: { username: 'admin', password: 'pass' } },
      });
      assert.ok(curl.includes("-u 'admin:pass'"));
    });

    it('API Key (header) 인증 생성', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com',
        auth: { type: 'apikey', apikey: { key: 'X-API-Key', value: 'secret', addTo: 'header' } },
      });
      assert.ok(curl.includes("'X-API-Key: secret'"));
    });

    it('API Key (query) 인증 생성', () => {
      const curl = CurlService.generate({
        method: 'GET',
        url: 'https://api.example.com',
        auth: { type: 'apikey', apikey: { key: 'apiKey', value: 'secret', addTo: 'query' } },
      });
      assert.ok(curl.includes('apiKey=secret'));
      assert.ok(!curl.includes("'apiKey: secret'"));
    });

    it('싱글쿼트 이스케이프', () => {
      const curl = CurlService.generate({
        method: 'POST',
        url: 'https://api.example.com',
        body: "it's a test",
      });
      // 싱글쿼트가 이스케이프되어야 함
      assert.ok(curl.includes("-d"));
      assert.ok(!curl.includes("it's")); // 원본 그대로가 아닌 이스케이프된 형태
    });
  });

  // === 라운드트립: parse → generate → parse ===
  describe('라운드트립', () => {
    it('parse → generate → parse 결과 일치', () => {
      const original = `curl -X POST 'https://api.example.com/data' \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: */*' \\
  -d '{"name":"test"}'`;

      const parsed1 = CurlService.parse(original);
      const generated = CurlService.generate(parsed1);
      const parsed2 = CurlService.parse(generated);

      assert.strictEqual(parsed1.method, parsed2.method);
      assert.strictEqual(parsed1.url, parsed2.url);
      assert.strictEqual(parsed1.body, parsed2.body);
      assert.strictEqual(parsed1.headers.length, parsed2.headers.length);
    });
  });
});
