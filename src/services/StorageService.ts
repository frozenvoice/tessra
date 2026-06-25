import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Collection, CollectionItem, HistoryEntry, Environment, KeyValue, Request, TabState, CompareSettings, StoredTabState } from '../models/types';
import { LocalizationService } from './LocalizationService';

export interface WorkspaceBackupData {
  collections: Collection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  defaultHeaders: KeyValue[];
  variables: KeyValue[];
  tabState: StoredTabState | null;
  history: HistoryEntry[] | null;
}

export interface WorkspaceBackup {
  app: 'tessra';
  schemaVersion: 1;
  exportedAt: string;
  tessraVersion?: string;
  profile: {
    name: string;
  };
  data: WorkspaceBackupData;
}

export interface WorkspaceBackupImportResult {
  collections: number;
  environments: number;
  activeEnvironmentRestored: boolean;
  preImportBackupPath: string;
}

// globalStorage 경로에 JSON 파일로 데이터 영속화
export class StorageService {
  private static readonly DEFAULT_PROFILE_NAME = 'default';
  private static readonly PROFILE_ROOT_DIR = 'profiles';
  private static readonly PROFILE_META_FILE = 'profile.json';
  private static readonly WORKSPACE_BACKUP_SCHEMA_VERSION = 1;
  private static readonly WORKSPACE_BACKUP_APP = 'tessra';
  private static readonly WORKSPACE_BACKUP_DIR = 'backups';
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
  private readonly corruptJsonWarnings = new Set<string>();

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

    const profilePath = this.resolveProfilePath(profileName);
    this.ensureDir(profilePath);
    this.ensureProfileMeta(profilePath, profileName);
    return profilePath;
  }

  private resolveProfilePath(profileName: string): string {
    const profilesRoot = path.join(this.rootStoragePath, StorageService.PROFILE_ROOT_DIR);
    const profilePath = path.join(profilesRoot, this.toProfileDirectoryName(profileName));
    const legacyProfilePath = this.findLegacyProfilePath(profilesRoot, profileName, profilePath);
    return legacyProfilePath ?? profilePath;
  }

  private findLegacyProfilePath(profilesRoot: string, profileName: string, profilePath: string): string | null {
    const legacyDirName = this.toLegacyProfileDirectoryName(profileName);
    const legacyPath = path.join(profilesRoot, legacyDirName);
    if (legacyPath === profilePath || !fs.existsSync(legacyPath) || fs.existsSync(profilePath)) {
      return null;
    }

    const meta = this.readJson<{ name?: string } | null>(
      path.join(legacyPath, StorageService.PROFILE_META_FILE),
      null
    );
    if (meta?.name === profileName || (!meta?.name && path.basename(legacyPath) === legacyDirName)) {
      return legacyPath;
    }
    return null;
  }

  private ensureProfileMeta(profilePath: string, profileName: string): void {
    const metaPath = path.join(profilePath, StorageService.PROFILE_META_FILE);
    const current = this.readJson<{ name?: string } | null>(metaPath, null);
    if (current?.name && current.name !== profileName) {
      throw new Error(`Workspace profile "${profileName}" collides with existing profile "${current.name}".`);
    }
    if (current?.name === profileName) { return; }
    fs.writeFileSync(metaPath, JSON.stringify({ name: profileName }, null, 2), 'utf-8');
  }

  private toProfileDirectoryName(profileName: string): string {
    const encoded = Buffer.from(profileName, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    return `profile-${encoded || StorageService.DEFAULT_PROFILE_NAME}`;
  }

  private toLegacyProfileDirectoryName(profileName: string): string {
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
    } catch (err: unknown) {
      this.handleCorruptJson(filePath, err);
    }
    return fallback;
  }

  private handleCorruptJson(filePath: string, err: unknown): void {
    if (this.corruptJsonWarnings.has(filePath)) { return; }
    this.corruptJsonWarnings.add(filePath);

    const backupPath = this.backupCorruptJson(filePath);
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showWarningMessage(LocalizationService.t('warn.storageJsonCorrupt', {
      file: path.basename(filePath),
      message,
      backup: backupPath ?? 'backup unavailable',
    }));
  }

  private backupCorruptJson(filePath: string): string | null {
    try {
      const backupPath = this.createCorruptBackupPath(filePath);
      fs.copyFileSync(filePath, backupPath, fs.constants.COPYFILE_EXCL);
      return backupPath;
    } catch {
      return null;
    }
  }

  private createCorruptBackupPath(filePath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = `${filePath}.corrupt-${timestamp}`;
    let candidate = basePath;
    let index = 1;
    while (fs.existsSync(candidate)) {
      candidate = `${basePath}-${index}`;
      index++;
    }
    return candidate;
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

    this.writeJsonFile(filePath, data);
  }

  private writeJsonFile(filePath: string, data: unknown): void {
    const dirPath = path.dirname(filePath);
    this.ensureDir(dirPath);
    const tempPath = path.join(
      dirPath,
      `.${path.basename(filePath)}.${process.pid}.${Date.now().toString(36)}.tmp`
    );
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2) ?? 'null', 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err: unknown) {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // 임시 파일 정리 실패는 원래 쓰기 실패를 가리지 않는다.
      }
      throw err;
    }
  }

  private formatBackupTimestamp(date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      '-',
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('');
  }

  private createPreImportBackup(tessraVersion?: string): string {
    const backup = this.exportWorkspaceBackup(tessraVersion);
    const backupDir = path.join(this.rootStoragePath, StorageService.WORKSPACE_BACKUP_DIR);
    const timestamp = this.formatBackupTimestamp();
    let backupPath = path.join(backupDir, `tessra-preimport-${timestamp}.tessra-backup.json`);
    let index = 1;
    while (fs.existsSync(backupPath)) {
      backupPath = path.join(backupDir, `tessra-preimport-${timestamp}-${index}.tessra-backup.json`);
      index++;
    }
    this.writeJsonFile(backupPath, backup);
    return backupPath;
  }

  private asObject(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label} must be an object.`);
    }
    return value as Record<string, unknown>;
  }

  private asArray<T>(value: unknown, label: string): T[] {
    if (!Array.isArray(value)) {
      throw new Error(`${label} must be an array.`);
    }
    return value as T[];
  }

  private asString(value: unknown, label: string): string {
    if (typeof value !== 'string') {
      throw new Error(`${label} must be a string.`);
    }
    return value;
  }

  private normalizeStringValue(value: unknown, label: string): string {
    if (typeof value === 'undefined' || value === null) { return ''; }
    if (typeof value === 'string') { return value; }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    throw new Error(`${label} must be a string-compatible value.`);
  }

  private normalizeEnabled(value: unknown): boolean {
    return typeof value === 'boolean' ? value : true;
  }

  private normalizeKeyValue(value: unknown, label: string): KeyValue {
    const item = this.asObject(value, label);
    const key = typeof item.key === 'string'
      ? item.key
      : typeof item.name === 'string'
        ? item.name
        : null;
    if (key === null) {
      throw new Error(`${label}.key or ${label}.name must be a string.`);
    }
    return {
      ...item,
      key,
      value: this.normalizeStringValue(item.value, `${label}.value`),
      enabled: this.normalizeEnabled(item.enabled),
    } as KeyValue;
  }

  private normalizeKeyValueArray(value: unknown, label: string): KeyValue[] {
    return this.asArray<unknown>(value, label).map((item, index) =>
      this.normalizeKeyValue(item, `${label}[${index}]`)
    );
  }

  private normalizeOptionalKeyValueArray(value: unknown, label: string): KeyValue[] {
    if (typeof value === 'undefined') { return []; }
    return this.normalizeKeyValueArray(value, label);
  }

  private normalizeCollectionArray(value: unknown, label: string): Collection[] {
    return this.asArray<unknown>(value, label).map((item, index) => {
      const collection = this.asObject(item, `${label}[${index}]`);
      return {
        ...collection,
        id: this.asString(collection.id, `${label}[${index}].id`),
        name: this.asString(collection.name, `${label}[${index}].name`),
        items: this.normalizeCollectionItems(collection.items, `${label}[${index}].items`),
      } as Collection;
    });
  }

  private normalizeCollectionItems(value: unknown, label: string): CollectionItem[] {
    if (!Array.isArray(value)) { return []; }
    return value.map((item, index) => this.normalizeCollectionItem(item, `${label}[${index}]`));
  }

  private normalizeCollectionItem(value: unknown, label: string): CollectionItem {
    const item = this.asObject(value, label);
    const type = item.type;
    if (type !== 'request' && type !== 'folder') {
      throw new Error(`${label}.type must be "request" or "folder".`);
    }

    if (type === 'folder') {
      return {
        ...item,
        id: this.asString(item.id, `${label}.id`),
        type,
        name: this.asString(item.name, `${label}.name`),
        children: this.normalizeCollectionItems(item.children, `${label}.children`),
      } as CollectionItem;
    }

    return {
      ...item,
      id: this.asString(item.id, `${label}.id`),
      type,
      name: this.asString(item.name, `${label}.name`),
      request: this.normalizeCollectionRequest(item.request, `${label}.request`),
    } as CollectionItem;
  }

  private normalizeCollectionRequest(value: unknown, label: string): Request {
    const request = this.asObject(value, label);
    const auth = request.auth && typeof request.auth === 'object' && !Array.isArray(request.auth)
      ? request.auth
      : { type: 'none' };

    return {
      ...request,
      id: this.asString(request.id, `${label}.id`),
      name: this.asString(request.name, `${label}.name`),
      method: this.asString(request.method, `${label}.method`) as Request['method'],
      url: this.asString(request.url, `${label}.url`),
      headers: this.normalizeOptionalKeyValueArray(request.headers, `${label}.headers`),
      params: this.normalizeOptionalKeyValueArray(request.params, `${label}.params`),
      body: this.normalizeStringValue(request.body, `${label}.body`),
      bodyType: typeof request.bodyType === 'string' ? request.bodyType as Request['bodyType'] : 'none',
      auth: auth as Request['auth'],
    } as Request;
  }

  private normalizeEnvironmentArray(value: unknown, label: string): Environment[] {
    return this.asArray<unknown>(value, label).map((item, index) => {
      const environment = this.asObject(item, `${label}[${index}]`);
      return {
        ...environment,
        id: this.asString(environment.id, `${label}[${index}].id`),
        name: this.asString(environment.name, `${label}[${index}].name`),
        variables: this.normalizeOptionalKeyValueArray(environment.variables, `${label}[${index}].variables`),
      } as Environment;
    });
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
    const maxItems = vscode.workspace.getConfiguration('tessra').get<number>('historyMaxItems', 500);
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

  getVariables(): KeyValue[] {
    return this.readJson<KeyValue[]>(this.resolveFilePath('variables.json'), []);
  }

  saveVariables(variables: KeyValue[]): void {
    this.writeJson(this.resolveFilePath('variables.json'), variables);
  }

  exportWorkspaceBackup(tessraVersion?: string): WorkspaceBackup {
    return {
      app: StorageService.WORKSPACE_BACKUP_APP,
      schemaVersion: StorageService.WORKSPACE_BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tessraVersion,
      profile: {
        name: this.getWorkspaceProfileName(),
      },
      data: {
        collections: this.getCollections(),
        environments: this.getEnvironments(),
        activeEnvironmentId: this.getActiveEnvironmentId(),
        defaultHeaders: this.getDefaultHeaders(),
        variables: this.getVariables(),
        tabState: null,
        history: null,
      },
    };
  }

  validateWorkspaceBackup(value: unknown): WorkspaceBackup {
    const root = this.asObject(value, 'Backup');
    if (root.app !== StorageService.WORKSPACE_BACKUP_APP) {
      throw new Error(LocalizationService.t('error.workspaceBackupInvalidApp'));
    }
    if (root.schemaVersion !== StorageService.WORKSPACE_BACKUP_SCHEMA_VERSION) {
      throw new Error(LocalizationService.t('error.workspaceBackupUnsupportedSchemaVersion', {
        version: String(root.schemaVersion),
      }));
    }
    const exportedAt = root.exportedAt;
    if (typeof exportedAt !== 'string' || !exportedAt.trim()) {
      throw new Error('Backup exportedAt must be a string.');
    }

    const profile = this.asObject(root.profile, 'Backup profile');
    const profileName = profile.name;
    if (typeof profileName !== 'string' || !profileName.trim()) {
      throw new Error('Backup profile.name must be a string.');
    }

    const data = this.asObject(root.data, 'Backup data');
    const activeEnvironmentId = data.activeEnvironmentId;
    if (activeEnvironmentId !== null && typeof activeEnvironmentId !== 'string') {
      throw new Error('Backup data.activeEnvironmentId must be a string or null.');
    }

    const history = data.history === null || typeof data.history === 'undefined'
      ? null
      : this.asArray<HistoryEntry>(data.history, 'Backup data.history');
    const tabState = data.tabState === null || typeof data.tabState === 'undefined'
      ? null
      : data.tabState as StoredTabState;

    return {
      app: StorageService.WORKSPACE_BACKUP_APP,
      schemaVersion: StorageService.WORKSPACE_BACKUP_SCHEMA_VERSION,
      exportedAt,
      tessraVersion: typeof root.tessraVersion === 'string' ? root.tessraVersion : undefined,
      profile: {
        name: profileName.trim(),
      },
      data: {
        collections: this.normalizeCollectionArray(data.collections, 'Backup data.collections'),
        environments: this.normalizeEnvironmentArray(data.environments, 'Backup data.environments'),
        activeEnvironmentId,
        defaultHeaders: this.normalizeKeyValueArray(data.defaultHeaders, 'Backup data.defaultHeaders'),
        variables: this.normalizeKeyValueArray(data.variables, 'Backup data.variables'),
        tabState,
        history,
      },
    };
  }

  importWorkspaceBackup(value: unknown, tessraVersion?: string): WorkspaceBackupImportResult {
    const backup = this.validateWorkspaceBackup(value);
    const preImportBackupPath = this.createPreImportBackup(tessraVersion);
    const importedActiveEnvironmentId = backup.data.activeEnvironmentId;
    const activeEnvironmentRestored = typeof importedActiveEnvironmentId === 'string'
      && backup.data.environments.some((environment) => environment.id === importedActiveEnvironmentId);

    this.saveCollections(backup.data.collections);
    this.saveEnvironments(backup.data.environments);
    this.saveDefaultHeaders(backup.data.defaultHeaders);
    this.saveVariables(backup.data.variables);
    this.saveActiveEnvironmentId(activeEnvironmentRestored ? importedActiveEnvironmentId : null);

    return {
      collections: backup.data.collections.length,
      environments: backup.data.environments.length,
      activeEnvironmentRestored,
      preImportBackupPath,
    };
  }

  // === 탭 상태 ===

  getTabState(): StoredTabState | null {
    return this.readJson(this.resolveFilePath('tab-state.json'), null);
  }

  saveTabState(tabs: TabState[], activeIndex: number, compareSettings?: CompareSettings): void {
    this.writeJson(this.resolveFilePath('tab-state.json'), { tabs, activeIndex, compareSettings });
  }
}
