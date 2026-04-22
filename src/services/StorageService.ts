import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Collection, HistoryEntry, Environment, KeyValue, TabState, CompareSettings, StoredTabState } from '../models/types';

// globalStorage 경로에 JSON 파일로 데이터 영속화
export class StorageService {
  private static readonly DEFAULT_PROFILE_NAME = 'default';
  private static readonly PROFILE_ROOT_DIR = 'profiles';
  private static readonly PROFILE_META_FILE = 'profile.json';
  private static readonly LEGACY_STORAGE_DIR_CANDIDATES = ['arc.arc-client', 'arc-client'];
  private static readonly STORAGE_DATA_INDICATOR_FILES = [
    'collections.json',
    'environments.json',
    'history.json',
  ];
  private static readonly MIGRATABLE_STORAGE_ENTRIES = [
    'collections.json',
    'history.json',
    'environments.json',
    'active-environment.json',
    'default-headers.json',
    'variables.json',
    'tab-state.json',
    StorageService.PROFILE_ROOT_DIR,
  ];
  private readonly rootStoragePath: string;
  private migratedLegacyStorage = false;
  private legacyMigrationError: string | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.rootStoragePath = context.globalStorageUri.fsPath;
    this.ensureDir(this.rootStoragePath);
    try {
      this.migratedLegacyStorage = this.migrateLegacyStorageIfNeeded();
    } catch (err: unknown) {
      this.legacyMigrationError = err instanceof Error ? err.message : String(err);
    }
  }

  // globalStorage 경로 반환 (임시 파일 등에 활용)
  getStoragePath(): string {
    return this.getActiveStoragePath();
  }

  didMigrateLegacyStorage(): boolean {
    return this.migratedLegacyStorage;
  }

  getLegacyMigrationError(): string | null {
    return this.legacyMigrationError;
  }

  private migrateLegacyStorageIfNeeded(): boolean {
    if (this.hasStorageData(this.rootStoragePath)) { return false; }

    const legacyStoragePath = this.findLegacyStoragePath();
    if (!legacyStoragePath) { return false; }

    let copied = false;
    for (const entry of StorageService.MIGRATABLE_STORAGE_ENTRIES) {
      const sourcePath = path.join(legacyStoragePath, entry);
      if (!fs.existsSync(sourcePath)) { continue; }
      const targetPath = path.join(this.rootStoragePath, entry);
      copied = this.copyStorageEntry(sourcePath, targetPath) || copied;
    }
    return copied;
  }

  private hasStorageData(storagePath: string): boolean {
    return StorageService.STORAGE_DATA_INDICATOR_FILES.some((entry) => fs.existsSync(path.join(storagePath, entry)));
  }

  private findLegacyStoragePath(): string | null {
    const storageParent = path.dirname(this.rootStoragePath);
    for (const dirName of StorageService.LEGACY_STORAGE_DIR_CANDIDATES) {
      const candidate = path.join(storageParent, dirName);
      if (fs.existsSync(candidate) && this.hasStorageData(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private copyStorageEntry(sourcePath: string, targetPath: string): boolean {
    if (fs.existsSync(targetPath)) { return false; }

    const stat = fs.lstatSync(sourcePath);
    if (stat.isSymbolicLink()) { return false; }

    if (stat.isDirectory()) {
      let copied = false;
      this.ensureDir(targetPath);
      for (const entry of fs.readdirSync(sourcePath)) {
        copied = this.copyStorageEntry(path.join(sourcePath, entry), path.join(targetPath, entry)) || copied;
      }
      return copied;
    }

    if (!stat.isFile()) { return false; }
    this.ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
    return true;
  }

  getWorkspaceProfileName(): string {
    const configured = vscode.workspace.getConfiguration('tessra').get<string>(
      'workspaceProfile',
      StorageService.DEFAULT_PROFILE_NAME
    );
    const trimmed = String(configured || '').trim();
    return trimmed || StorageService.DEFAULT_PROFILE_NAME;
  }

  listProfiles(): string[] {
    const names = new Set<string>([StorageService.DEFAULT_PROFILE_NAME]);
    const profilesRoot = path.join(this.rootStoragePath, StorageService.PROFILE_ROOT_DIR);

    if (fs.existsSync(profilesRoot)) {
      for (const entry of fs.readdirSync(profilesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) { continue; }
        const dirPath = path.join(profilesRoot, entry.name);
        const meta = this.readJson<{ name?: string } | null>(path.join(dirPath, StorageService.PROFILE_META_FILE), null);
        const displayName = typeof meta?.name === 'string' && meta.name.trim() ? meta.name.trim() : entry.name;
        names.add(displayName);
      }
    }

    return Array.from(names).sort((left, right) => {
      if (left === StorageService.DEFAULT_PROFILE_NAME) { return -1; }
      if (right === StorageService.DEFAULT_PROFILE_NAME) { return 1; }
      return left.localeCompare(right);
    });
  }

  private getActiveStoragePath(): string {
    const profileName = this.getWorkspaceProfileName();
    if (profileName === StorageService.DEFAULT_PROFILE_NAME) {
      this.ensureDir(this.rootStoragePath);
      return this.rootStoragePath;
    }

    const profilePath = path.join(
      this.rootStoragePath,
      StorageService.PROFILE_ROOT_DIR,
      this.toProfileDirectoryName(profileName)
    );
    this.ensureDir(profilePath);
    this.ensureProfileMeta(profilePath, profileName);
    return profilePath;
  }

  private ensureProfileMeta(profilePath: string, profileName: string): void {
    const metaPath = path.join(profilePath, StorageService.PROFILE_META_FILE);
    const current = this.readJson<{ name?: string } | null>(metaPath, null);
    if (current?.name === profileName) { return; }
    fs.writeFileSync(metaPath, JSON.stringify({ name: profileName }, null, 2), 'utf-8');
  }

  private toProfileDirectoryName(profileName: string): string {
    const sanitized = profileName
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
      .replace(/[. ]+$/g, '')
      .trim();
    return sanitized || StorageService.DEFAULT_PROFILE_NAME;
  }

  private ensureDir(targetPath: string): void {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
  }

  private resolveFilePath(fileName: string): string {
    return path.join(this.getActiveStoragePath(), fileName);
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
    const dirPath = path.dirname(filePath);
    this.ensureDir(dirPath);
    if (path.basename(filePath) !== StorageService.PROFILE_META_FILE && dirPath !== this.rootStoragePath) {
      const profileName = this.getWorkspaceProfileName();
      if (profileName !== StorageService.DEFAULT_PROFILE_NAME) {
        this.ensureProfileMeta(dirPath, profileName);
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // === 컬렉션 ===

  getCollections(): Collection[] {
    return this.readJson<Collection[]>(this.resolveFilePath('collections.json'), []);
  }

  saveCollections(collections: Collection[]): void {
    this.writeJson(this.resolveFilePath('collections.json'), collections);
  }

  // === 히스토리 ===

  getHistory(): HistoryEntry[] {
    return this.readJson<HistoryEntry[]>(this.resolveFilePath('history.json'), []);
  }

  saveHistory(history: HistoryEntry[]): void {
    this.writeJson(this.resolveFilePath('history.json'), history);
  }

  addHistoryEntry(entry: HistoryEntry): number {
    const history = this.getHistory();
    history.unshift(entry);
    const removed = this.pruneHistory(history);
    this.saveHistory(history);
    return removed;
  }

  // 히스토리 자동 정리: maxItems 초과 시 pinned 아닌 오래된 항목부터 삭제
  // 삭제된 개수를 반환
  pruneHistory(history: HistoryEntry[]): number {
    const maxItems = vscode.workspace.getConfiguration('tessra').get<number>('historyMaxItems', 100);
    if (history.length <= maxItems) { return 0; }

    let removed = 0;
    // 뒤(오래된 것)부터 순회하며 pinned 아닌 항목 삭제
    for (let i = history.length - 1; i >= 0 && history.length > maxItems; i--) {
      if (!history[i].pinned) {
        history.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  setHistoryPin(id: string, pinned: boolean): void {
    const history = this.getHistory();
    const entry = history.find((e) => e.id === id);
    if (entry) {
      entry.pinned = pinned;
      this.saveHistory(history);
    }
  }

  // === 환경변수 ===

  getEnvironments(): Environment[] {
    return this.readJson<Environment[]>(this.resolveFilePath('environments.json'), []);
  }

  saveEnvironments(environments: Environment[]): void {
    this.writeJson(this.resolveFilePath('environments.json'), environments);
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
    return this.readJson<string | null>(this.resolveFilePath('active-environment.json'), null);
  }

  saveActiveEnvironmentId(id: string | null): void {
    this.writeJson(this.resolveFilePath('active-environment.json'), id);
  }

  // === 기본 헤더 ===

  private static readonly DEFAULT_HEADERS: KeyValue[] = [
    { key: 'User-Agent', value: 'Tessra/1.0', enabled: true },
    { key: 'Accept', value: '*/*', enabled: true },
  ];

  getDefaultHeaders(): KeyValue[] {
    return this.readJson<KeyValue[]>(this.resolveFilePath('default-headers.json'), StorageService.DEFAULT_HEADERS);
  }

  saveDefaultHeaders(headers: KeyValue[]): void {
    this.writeJson(this.resolveFilePath('default-headers.json'), headers);
  }

  // === 탭 상태 ===

  getTabState(): StoredTabState | null {
    return this.readJson(this.resolveFilePath('tab-state.json'), null);
  }

  saveTabState(tabs: TabState[], activeIndex: number, compareSettings?: CompareSettings): void {
    this.writeJson(this.resolveFilePath('tab-state.json'), { tabs, activeIndex, compareSettings });
  }
}
