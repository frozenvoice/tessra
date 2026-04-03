import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Collection, HistoryEntry, Environment, KeyValue, TabState } from '../models/types';

// globalStorage 경로에 JSON 파일로 데이터 영속화
export class StorageService {
  private storagePath: string;
  private collectionsPath: string;
  private historyPath: string;
  private environmentsPath: string;
  private activeEnvironmentPath: string;
  private defaultHeadersPath: string;
  private tabStatePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.storagePath = context.globalStorageUri.fsPath;
    this.collectionsPath = path.join(this.storagePath, 'collections.json');
    this.historyPath = path.join(this.storagePath, 'history.json');
    this.environmentsPath = path.join(this.storagePath, 'environments.json');
    this.activeEnvironmentPath = path.join(this.storagePath, 'active-environment.json');
    this.defaultHeadersPath = path.join(this.storagePath, 'default-headers.json');
    this.tabStatePath = path.join(this.storagePath, 'tab-state.json');
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private readJson<T>(filePath: string, fallback: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // 파싱 실패 시 기본값 반환
    }
    return fallback;
  }

  private writeJson(filePath: string, data: unknown): void {
    this.ensureStorageDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // === 컬렉션 ===

  getCollections(): Collection[] {
    return this.readJson<Collection[]>(this.collectionsPath, []);
  }

  saveCollections(collections: Collection[]): void {
    this.writeJson(this.collectionsPath, collections);
  }

  // === 히스토리 ===

  getHistory(): HistoryEntry[] {
    return this.readJson<HistoryEntry[]>(this.historyPath, []);
  }

  saveHistory(history: HistoryEntry[]): void {
    this.writeJson(this.historyPath, history);
  }

  addHistoryEntry(entry: HistoryEntry): void {
    const history = this.getHistory();
    history.unshift(entry);
    if (history.length > 200) {
      history.length = 200;
    }
    this.saveHistory(history);
  }

  // === 환경변수 ===

  getEnvironments(): Environment[] {
    return this.readJson<Environment[]>(this.environmentsPath, []);
  }

  saveEnvironments(environments: Environment[]): void {
    this.writeJson(this.environmentsPath, environments);
  }

  getEnvironment(id: string): Environment | undefined {
    return this.getEnvironments().find((e) => e.id === id);
  }

  updateEnvironmentVars(id: string, variables: KeyValue[]): void {
    const envs = this.getEnvironments();
    const env = envs.find((e) => e.id === id);
    if (env) {
      env.variables = variables;
      this.saveEnvironments(envs);
    }
  }

  getActiveEnvironmentId(): string | null {
    return this.readJson<string | null>(this.activeEnvironmentPath, null);
  }

  saveActiveEnvironmentId(id: string | null): void {
    this.writeJson(this.activeEnvironmentPath, id);
  }

  // === 기본 헤더 ===

  private static readonly DEFAULT_HEADERS: KeyValue[] = [
    { key: 'User-Agent', value: 'Arc Client/1.0', enabled: true },
    { key: 'Accept', value: '*/*', enabled: true },
  ];

  getDefaultHeaders(): KeyValue[] {
    return this.readJson<KeyValue[]>(this.defaultHeadersPath, StorageService.DEFAULT_HEADERS);
  }

  saveDefaultHeaders(headers: KeyValue[]): void {
    this.writeJson(this.defaultHeadersPath, headers);
  }

  // === 탭 상태 ===

  getTabState(): { tabs: TabState[]; activeIndex: number } | null {
    return this.readJson(this.tabStatePath, null);
  }

  saveTabState(tabs: TabState[], activeIndex: number): void {
    this.writeJson(this.tabStatePath, { tabs, activeIndex });
  }
}
