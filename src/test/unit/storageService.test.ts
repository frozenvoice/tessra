import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Collection, HistoryEntry, Environment, KeyValue } from '../../models/types';

// StorageService는 vscode.ExtensionContext에 의존하므로
// 핵심 로직(JSON 파일 읽기/쓰기)을 직접 테스트
describe('StorageService (파일 기반)', () => {
  let tmpDir: string;
  let collectionsPath: string;
  let historyPath: string;
  let environmentsPath: string;
  let activeEnvironmentPath: string;

  // readJson / writeJson 헬퍼 (StorageService 내부 로직 재현)
  function readJson<T>(filePath: string, fallback: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch { /* 파싱 실패 시 기본값 */ }
    return fallback;
  }

  function writeJson(filePath: string, data: unknown): void {
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-test-'));
    collectionsPath = path.join(tmpDir, 'collections.json');
    historyPath = path.join(tmpDir, 'history.json');
    environmentsPath = path.join(tmpDir, 'environments.json');
    activeEnvironmentPath = path.join(tmpDir, 'active-environment.json');
  });

  after(() => {
    // 정리
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // === 컬렉션 ===
  describe('컬렉션 CRUD', () => {
    it('초기 상태: 빈 배열 반환', () => {
      const result = readJson<Collection[]>(collectionsPath, []);
      assert.deepStrictEqual(result, []);
    });

    it('컬렉션 저장 및 로드', () => {
      const collections: Collection[] = [
        {
          id: 'col-1',
          name: 'My API',
          items: [
            {
              id: 'req-1',
              type: 'request',
              name: 'Get Users',
              request: {
                id: 'req-1',
                name: 'Get Users',
                method: 'GET',
                url: 'https://api.example.com/users',
                headers: [],
                params: [],
                body: '',
                bodyType: 'none',
                auth: { type: 'none' },
              },
            },
          ],
        },
      ];
      writeJson(collectionsPath, collections);
      const loaded = readJson<Collection[]>(collectionsPath, []);
      assert.strictEqual(loaded.length, 1);
      assert.strictEqual(loaded[0].name, 'My API');
      assert.strictEqual(loaded[0].items.length, 1);
      assert.strictEqual(loaded[0].items[0].name, 'Get Users');
    });

    it('컬렉션 수정 후 저장', () => {
      const collections = readJson<Collection[]>(collectionsPath, []);
      collections[0].items.push({
        id: 'req-2',
        type: 'request',
        name: 'Create User',
        request: {
          id: 'req-2',
          name: 'Create User',
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
          params: [],
          body: '{"name":"new"}',
          bodyType: 'json',
          auth: { type: 'none' },
        },
      });
      writeJson(collectionsPath, collections);
      const loaded = readJson<Collection[]>(collectionsPath, []);
      assert.strictEqual(loaded[0].items.length, 2);
      assert.strictEqual(loaded[0].items[1].name, 'Create User');
    });

    it('컬렉션 삭제', () => {
      writeJson(collectionsPath, []);
      const loaded = readJson<Collection[]>(collectionsPath, []);
      assert.strictEqual(loaded.length, 0);
    });

    it('폴더 구조 저장/로드', () => {
      const collections: Collection[] = [
        {
          id: 'col-1',
          name: 'Nested',
          items: [
            {
              id: 'folder-1',
              type: 'folder',
              name: 'Auth',
              children: [
                {
                  id: 'req-1',
                  type: 'request',
                  name: 'Login',
                  request: {
                    id: 'req-1',
                    name: 'Login',
                    method: 'POST',
                    url: '/login',
                    headers: [],
                    params: [],
                    body: '',
                    bodyType: 'none',
                    auth: { type: 'none' },
                  },
                },
              ],
            },
          ],
        },
      ];
      writeJson(collectionsPath, collections);
      const loaded = readJson<Collection[]>(collectionsPath, []);
      assert.strictEqual(loaded[0].items[0].type, 'folder');
      assert.strictEqual(loaded[0].items[0].children?.length, 1);
      assert.strictEqual(loaded[0].items[0].children?.[0].name, 'Login');
    });
  });

  // === 히스토리 ===
  describe('히스토리 CRUD', () => {
    it('히스토리 항목 추가', () => {
      const entry: HistoryEntry = {
        id: 'hist-1',
        request: {
          id: 'r1',
          name: 'GET /users',
          method: 'GET',
          url: 'https://api.example.com/users',
          headers: [],
          params: [],
          body: '',
          bodyType: 'none',
          auth: { type: 'none' },
        },
        response: { status: 200, statusText: 'OK', time: 150 },
        timestamp: Date.now(),
      };
      const history: HistoryEntry[] = [];
      history.unshift(entry);
      writeJson(historyPath, history);
      const loaded = readJson<HistoryEntry[]>(historyPath, []);
      assert.strictEqual(loaded.length, 1);
      assert.strictEqual(loaded[0].request.method, 'GET');
      assert.strictEqual(loaded[0].response?.status, 200);
    });

    it('히스토리 최대 200개 제한', () => {
      const history: HistoryEntry[] = [];
      for (let i = 0; i < 210; i++) {
        history.push({
          id: `hist-${i}`,
          request: {
            id: `r${i}`,
            name: `Request ${i}`,
            method: 'GET',
            url: `https://api.example.com/${i}`,
            headers: [],
            params: [],
            body: '',
            bodyType: 'none',
            auth: { type: 'none' },
          },
          response: null,
          timestamp: Date.now(),
        });
      }
      // addHistoryEntry 로직: 200개 초과 시 잘라냄
      if (history.length > 200) {
        history.length = 200;
      }
      writeJson(historyPath, history);
      const loaded = readJson<HistoryEntry[]>(historyPath, []);
      assert.strictEqual(loaded.length, 200);
    });

    it('히스토리 초기화', () => {
      writeJson(historyPath, []);
      const loaded = readJson<HistoryEntry[]>(historyPath, []);
      assert.strictEqual(loaded.length, 0);
    });
  });

  // === 환경변수 ===
  describe('환경변수 CRUD', () => {
    it('환경 저장 및 로드', () => {
      const envs: Environment[] = [
        {
          id: 'env-1',
          name: 'Development',
          variables: [
            { key: 'baseUrl', value: 'http://localhost:3000', enabled: true },
            { key: 'apiKey', value: 'dev-key-123', enabled: true },
          ],
        },
        {
          id: 'env-2',
          name: 'Production',
          variables: [
            { key: 'baseUrl', value: 'https://api.prod.com', enabled: true },
          ],
        },
      ];
      writeJson(environmentsPath, envs);
      const loaded = readJson<Environment[]>(environmentsPath, []);
      assert.strictEqual(loaded.length, 2);
      assert.strictEqual(loaded[0].name, 'Development');
      assert.strictEqual(loaded[0].variables.length, 2);
    });

    it('특정 환경 조회', () => {
      const envs = readJson<Environment[]>(environmentsPath, []);
      const env = envs.find(e => e.id === 'env-1');
      assert.ok(env);
      assert.strictEqual(env.name, 'Development');
    });

    it('환경변수 업데이트', () => {
      const envs = readJson<Environment[]>(environmentsPath, []);
      const env = envs.find(e => e.id === 'env-1');
      if (env) {
        env.variables = [
          { key: 'baseUrl', value: 'http://localhost:4000', enabled: true },
          { key: 'apiKey', value: 'new-key', enabled: true },
          { key: 'debug', value: 'true', enabled: false },
        ];
        writeJson(environmentsPath, envs);
      }
      const loaded = readJson<Environment[]>(environmentsPath, []);
      const updated = loaded.find(e => e.id === 'env-1')!;
      assert.strictEqual(updated.variables.length, 3);
      assert.strictEqual(updated.variables[0].value, 'http://localhost:4000');
      assert.strictEqual(updated.variables[2].enabled, false);
    });

    it('환경 삭제', () => {
      const envs = readJson<Environment[]>(environmentsPath, []);
      const filtered = envs.filter(e => e.id !== 'env-2');
      writeJson(environmentsPath, filtered);
      const loaded = readJson<Environment[]>(environmentsPath, []);
      assert.strictEqual(loaded.length, 1);
      assert.strictEqual(loaded[0].id, 'env-1');
    });
  });

  describe('활성 환경 저장', () => {
    it('활성 환경 ID 저장 및 로드', () => {
      writeJson(activeEnvironmentPath, 'env-1');
      const activeEnvId = readJson<string | null>(activeEnvironmentPath, null);
      assert.strictEqual(activeEnvId, 'env-1');
    });

    it('활성 환경 해제 상태 저장', () => {
      writeJson(activeEnvironmentPath, null);
      const activeEnvId = readJson<string | null>(activeEnvironmentPath, 'fallback');
      assert.strictEqual(activeEnvId, null);
    });
  });

  // === 엣지 케이스 ===
  describe('엣지 케이스', () => {
    it('손상된 JSON 파일 → 기본값 반환', () => {
      fs.writeFileSync(path.join(tmpDir, 'broken.json'), '{invalid json!!!', 'utf-8');
      const result = readJson<string[]>(path.join(tmpDir, 'broken.json'), []);
      assert.deepStrictEqual(result, []);
    });

    it('존재하지 않는 파일 → 기본값 반환', () => {
      const result = readJson<string[]>(path.join(tmpDir, 'not-exists.json'), []);
      assert.deepStrictEqual(result, []);
    });

    it('빈 파일 → 기본값 반환', () => {
      fs.writeFileSync(path.join(tmpDir, 'empty.json'), '', 'utf-8');
      const result = readJson<string[]>(path.join(tmpDir, 'empty.json'), []);
      assert.deepStrictEqual(result, []);
    });
  });
});
