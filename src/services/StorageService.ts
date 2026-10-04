import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  AuthConfig,
  Collection,
  CollectionItem,
  CompareSettings,
  Environment,
  FormDataField,
  HistoryEntry,
  KeyValue,
  Request,
  RequestBodyType,
  TabState,
  StoredTabState,
} from '../models/types';
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

export interface EnvironmentVariableChangesResult {
  changed: boolean;
  conflicts: string[];
  appliedKeys: string[];
}

// 조회용 snapshot은 내부 중첩 객체까지 동결한다. 수정하려면 getHistory()의 복사본을 사용한다.
export interface HistorySnapshot {
  readonly filePath: string;
  readonly entries: readonly HistoryEntry[];
  readonly count: number;
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
  private readonly historySnapshots = new Map<string, { fingerprint: string; snapshot: HistorySnapshot }>();

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
    this.writeJsonFile(metaPath, { name: profileName });
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

  private readJson<T>(filePath: string, fallback: T, normalize?: (value: unknown) => T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        const result = normalize ? normalize(parsed) : parsed as T;
        this.corruptJsonWarnings.delete(filePath);
        return result;
      }
      this.corruptJsonWarnings.delete(filePath);
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
    this.requireRecoveredJson(filePath);
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

  private requireRecoveredJson(filePath: string): void {
    if (this.corruptJsonWarnings.has(filePath)) {
      throw new Error(LocalizationService.t('error.storageJsonRecoveryRequired', { file: path.basename(filePath) }));
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

  private normalizeEnabled(value: unknown, label = 'enabled'): boolean {
    if (typeof value === 'undefined' || value === null) { return true; }
    if (typeof value !== 'boolean') { throw new Error(`${label} must be a boolean.`); }
    return value;
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
      enabled: this.normalizeEnabled(item.enabled, `${label}.enabled`),
    } as KeyValue;
  }

  private normalizeKeyValueArray(value: unknown, label: string): KeyValue[] {
    return this.asArray<unknown>(value, label).map((item, index) =>
      this.normalizeKeyValue(item, `${label}[${index}]`)
    );
  }

  private normalizeOptionalKeyValueArray(value: unknown, label: string): KeyValue[] {
    if (typeof value === 'undefined' || value === null) { return []; }
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
    if (typeof value === 'undefined' || value === null) { return []; }
    if (!Array.isArray(value)) { throw new Error(`${label} must be an array.`); }
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

  private normalizeBodyType(value: unknown, label = 'bodyType'): RequestBodyType {
    if (typeof value === 'undefined' || value === null) { return 'none'; }
    const supported: RequestBodyType[] = ['none', 'json', 'xml', 'form', 'formdata', 'binary', 'raw', 'text'];
    if (typeof value !== 'string' || !supported.includes(value as RequestBodyType)) {
      throw new Error(`${label} has an unsupported value.`);
    }
    return value as RequestBodyType;
  }

  private normalizeAuth(value: unknown, label: string): AuthConfig {
    if (typeof value === 'undefined' || value === null) { return { type: 'none' }; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label} must be an object.`);
    }

    const auth = value as Record<string, unknown>;
    const type = auth.type;
    if (type === 'none' || typeof type === 'undefined' || type === null) {
      return { ...auth, type: 'none' } as AuthConfig;
    }
    if (type === 'basic') {
      const basic = auth.basic;
      if (typeof basic === 'undefined' || basic === null) {
        return { ...auth, type, basic: { username: '', password: '' } } as AuthConfig;
      }
      const config = this.asObject(basic, `${label}.basic`);
      return {
        ...auth,
        type,
        basic: {
          username: this.normalizeStringValue(config.username, `${label}.basic.username`),
          password: this.normalizeStringValue(config.password, `${label}.basic.password`),
        },
      } as AuthConfig;
    }
    if (type === 'bearer') {
      const bearer = auth.bearer;
      if (typeof bearer === 'undefined' || bearer === null) {
        return { ...auth, type, bearer: { token: '' } } as AuthConfig;
      }
      const config = this.asObject(bearer, `${label}.bearer`);
      return {
        ...auth,
        type,
        bearer: { token: this.normalizeStringValue(config.token, `${label}.bearer.token`) },
      } as AuthConfig;
    }
    if (type === 'apikey') {
      const apikey = auth.apikey;
      if (typeof apikey === 'undefined' || apikey === null) {
        return { ...auth, type, apikey: { key: '', value: '', addTo: 'header' } } as AuthConfig;
      }
      const config = this.asObject(apikey, `${label}.apikey`);
      const addTo = config.addTo === 'query' ? 'query' : 'header';
      return {
        ...auth,
        type,
        apikey: {
          key: this.normalizeStringValue(config.key, `${label}.apikey.key`),
          value: this.normalizeStringValue(config.value, `${label}.apikey.value`),
          addTo,
        },
      } as AuthConfig;
    }
    throw new Error(`${label}.type must be "none", "basic", "bearer", or "apikey".`);
  }

  private normalizeOptionalFormData(value: unknown, label: string): FormDataField[] {
    if (typeof value === 'undefined' || value === null) { return []; }
    return this.asArray<unknown>(value, label).map((raw, index) => {
      const field = this.asObject(raw, `${label}[${index}]`);
      const type = field.type === 'file' ? 'file' : field.type === 'text' || typeof field.type === 'undefined'
        ? 'text'
        : null;
      if (!type) { throw new Error(`${label}[${index}].type must be "text" or "file".`); }
      return {
        ...field,
        id: this.asString(field.id, `${label}[${index}].id`),
        key: this.normalizeStringValue(field.key, `${label}[${index}].key`),
        value: this.normalizeStringValue(field.value, `${label}[${index}].value`),
        enabled: this.normalizeEnabled(field.enabled, `${label}[${index}].enabled`),
        type,
      } as FormDataField;
    });
  }

  private normalizeOptionalPathVariableOverrides(value: unknown, label: string): Array<{ key: string; value: string }> {
    if (typeof value === 'undefined' || value === null) { return []; }
    return this.asArray<unknown>(value, label).map((raw, index) => {
      const override = this.asObject(raw, `${label}[${index}]`);
      return {
        ...override,
        key: this.asString(override.key, `${label}[${index}].key`),
        value: this.normalizeStringValue(override.value, `${label}[${index}].value`),
      };
    });
  }

  private normalizeOptionalScripts(value: unknown, label: string): { preRequest: string; test: string } | undefined {
    if (typeof value === 'undefined' || value === null) { return undefined; }
    const scripts = this.asObject(value, label);
    return {
      ...scripts,
      preRequest: this.normalizeStringValue(scripts.preRequest, `${label}.preRequest`),
      test: this.normalizeStringValue(scripts.test, `${label}.test`),
    };
  }

  private normalizeOptionalBoolean(value: unknown, label: string): boolean | undefined {
    if (typeof value === 'undefined' || value === null) { return undefined; }
    if (typeof value !== 'boolean') { throw new Error(`${label} must be a boolean.`); }
    return value;
  }

  private normalizeOptionalNumber(value: unknown, label: string): number | undefined {
    if (typeof value === 'undefined' || value === null) { return undefined; }
    if (typeof value !== 'number' || !Number.isFinite(value)) { throw new Error(`${label} must be a finite number.`); }
    return value;
  }

  private normalizeOptionalEnum<T extends string>(value: unknown, label: string, values: readonly T[]): T | undefined {
    if (typeof value === 'undefined' || value === null) { return undefined; }
    if (typeof value !== 'string' || !values.includes(value as T)) { throw new Error(`${label} has an unsupported value.`); }
    return value as T;
  }

  private normalizeRequest(value: unknown, label: string, includeName: boolean): Request {
    const request = this.asObject(value, label);
    const result: Record<string, unknown> = {
      ...request,
      id: this.asString(request.id, `${label}.id`),
      name: includeName ? this.asString(request.name, `${label}.name`) : this.normalizeStringValue(request.name, `${label}.name`),
      method: this.asString(request.method, `${label}.method`),
      url: this.asString(request.url, `${label}.url`),
      headers: this.normalizeOptionalKeyValueArray(request.headers, `${label}.headers`),
      params: this.normalizeOptionalKeyValueArray(request.params, `${label}.params`),
      pathVariableOverrides: this.normalizeOptionalPathVariableOverrides(request.pathVariableOverrides, `${label}.pathVariableOverrides`),
      body: this.normalizeStringValue(request.body, `${label}.body`),
      bodyType: this.normalizeBodyType(request.bodyType, `${label}.bodyType`),
      formData: this.normalizeOptionalFormData(request.formData, `${label}.formData`),
      binaryFilePath: this.normalizeStringValue(request.binaryFilePath, `${label}.binaryFilePath`),
      auth: this.normalizeAuth(request.auth, `${label}.auth`),
      scripts: this.normalizeOptionalScripts(request.scripts, `${label}.scripts`),
    };

    result.requestType = this.normalizeOptionalEnum(request.requestType, `${label}.requestType`, ['http', 'websocket'] as const);
    result.timeout = this.normalizeOptionalNumber(request.timeout, `${label}.timeout`);
    for (const [key, values] of [
      ['tlsValidation', ['default', 'strict', 'insecure'] as const],
      ['requestEditorTab', ['params', 'headers', 'body', 'auth', 'scripts', 'settings'] as const],
      ['jsonFormatStyle', ['pretty', 'compact'] as const],
      ['xmlFormatStyle', ['pretty', 'compact', 'inline'] as const],
      ['formatIndent', ['2', '4', 'tab'] as const],
    ] as const) {
      result[key] = this.normalizeOptionalEnum(request[key], `${label}.${key}`, values);
    }
    for (const key of [
      'autoName', 'followRedirects', 'saveToHistory', 'stopAfterHeaders', 'skipDefaultHeaders',
      'disableScripts', 'scriptsTrusted', 'webSocketKeepAliveEnabled', 'responseSearchCaseSensitive',
      'responseSearchRegex', 'scriptHelpCollapsed', 'pinned',
    ]) {
      result[key] = this.normalizeOptionalBoolean(request[key], `${label}.${key}`);
    }
    for (const key of [
      'maxResponseSizeKb', 'retryCount', 'retryDelayMs', 'webSocketKeepAliveIntervalSeconds',
      'requestSplitHeightPx', 'responseSearchIndex', 'requestStartedAt', 'requestEndedAt', 'durationMs',
    ]) {
      result[key] = this.normalizeOptionalNumber(request[key], `${label}.${key}`);
    }
    result.responseSearchQuery = typeof request.responseSearchQuery === 'undefined' || request.responseSearchQuery === null
      ? undefined
      : this.normalizeStringValue(request.responseSearchQuery, `${label}.responseSearchQuery`);
    result.webSocketKeepAliveMessage = typeof request.webSocketKeepAliveMessage === 'undefined' || request.webSocketKeepAliveMessage === null
      ? undefined
      : this.normalizeStringValue(request.webSocketKeepAliveMessage, `${label}.webSocketKeepAliveMessage`);
    return result as unknown as Request;
  }

  private normalizeCollectionRequest(value: unknown, label: string): Request {
    return this.normalizeRequest(value, label, true);
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

  private normalizeHistoryResponse(value: unknown, label: string): { status: number; statusText: string; time: number } | null {
    if (value === null || typeof value === 'undefined') { return null; }
    const response = this.asObject(value, label);
    const status = response.status;
    const time = response.time;
    if (typeof status !== 'number' || !Number.isFinite(status)) {
      throw new Error(`${label}.status must be a finite number.`);
    }
    if (typeof time !== 'number' || !Number.isFinite(time)) {
      throw new Error(`${label}.time must be a finite number.`);
    }
    return {
      ...response,
      status,
      statusText: this.normalizeStringValue(response.statusText, `${label}.statusText`),
      time,
    };
  }

  private normalizeHistoryArray(value: unknown, label: string): HistoryEntry[] {
    return this.asArray<unknown>(value, label).map((raw, index) => {
      const entry = this.asObject(raw, `${label}[${index}]`);
      const timestamp = entry.timestamp;
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
        throw new Error(`${label}[${index}].timestamp must be a finite number.`);
      }
      return {
        ...entry,
        id: this.asString(entry.id, `${label}[${index}].id`),
        request: this.normalizeRequest(entry.request, `${label}[${index}].request`, true),
        response: this.normalizeHistoryResponse(entry.response, `${label}[${index}].response`),
        timestamp,
        startedAt: this.normalizeOptionalNumber(entry.startedAt, `${label}[${index}].startedAt`),
        endedAt: this.normalizeOptionalNumber(entry.endedAt, `${label}[${index}].endedAt`),
        durationMs: this.normalizeOptionalNumber(entry.durationMs, `${label}[${index}].durationMs`),
        pinned: this.normalizeOptionalBoolean(entry.pinned, `${label}[${index}].pinned`),
      } as HistoryEntry;
    });
  }

  private normalizeCompareSettings(value: unknown, label: string): CompareSettings | undefined {
    if (typeof value === 'undefined' || value === null) { return undefined; }
    const settings = this.asObject(value, label);
    const mode = settings.mode === 'raw' || settings.mode === 'pretty' || settings.mode === 'normalized'
      ? settings.mode
      : 'normalized';
    const normalizeList = (list: unknown, field: string): string[] => {
      if (typeof list === 'undefined' || list === null) { return []; }
      if (typeof list === 'string') { return list.split(',').map((item) => item.trim()).filter(Boolean); }
      return this.asArray<unknown>(list, field).map((item, index) =>
        this.normalizeStringValue(item, `${field}[${index}]`).trim()
      ).filter(Boolean);
    };
    return {
      ...settings,
      mode,
      includeMetadataSummary: settings.includeMetadataSummary !== false,
      foldUnchangedSections: settings.foldUnchangedSections !== false,
      ignoreHeaders: normalizeList(settings.ignoreHeaders, `${label}.ignoreHeaders`),
      ignoreJsonPaths: normalizeList(settings.ignoreJsonPaths, `${label}.ignoreJsonPaths`),
    } as CompareSettings;
  }

  private normalizeTabState(value: unknown, label: string): TabState {
    const tab = this.asObject(value, label);
    const timeout = this.normalizeOptionalNumber(tab.timeout, `${label}.timeout`) ?? 0;
    const normalized: Record<string, unknown> = {
      ...tab,
      name: this.asString(tab.name, `${label}.name`),
      autoName: this.normalizeOptionalBoolean(tab.autoName, `${label}.autoName`),
      requestType: this.normalizeOptionalEnum(tab.requestType, `${label}.requestType`, ['http', 'websocket'] as const),
      requestEditorTab: this.normalizeOptionalEnum(tab.requestEditorTab, `${label}.requestEditorTab`, ['params', 'headers', 'body', 'auth', 'scripts', 'settings'] as const),
      requestSplitHeightPx: this.normalizeOptionalNumber(tab.requestSplitHeightPx, `${label}.requestSplitHeightPx`),
      method: this.asString(tab.method, `${label}.method`),
      url: this.asString(tab.url, `${label}.url`),
      headers: this.normalizeOptionalKeyValueArray(tab.headers, `${label}.headers`),
      params: this.normalizeOptionalKeyValueArray(tab.params, `${label}.params`),
      pathVariableOverrides: this.normalizeOptionalPathVariableOverrides(tab.pathVariableOverrides, `${label}.pathVariableOverrides`),
      body: this.normalizeStringValue(tab.body, `${label}.body`),
      bodyType: this.normalizeBodyType(tab.bodyType, `${label}.bodyType`),
      formData: this.normalizeOptionalFormData(tab.formData, `${label}.formData`),
      binaryFilePath: this.normalizeStringValue(tab.binaryFilePath, `${label}.binaryFilePath`),
      auth: this.normalizeAuth(tab.auth, `${label}.auth`),
      scripts: this.normalizeOptionalScripts(tab.scripts, `${label}.scripts`),
      timeout,
      tlsValidation: this.normalizeOptionalEnum(tab.tlsValidation, `${label}.tlsValidation`, ['default', 'strict', 'insecure'] as const),
      jsonFormatStyle: this.normalizeOptionalEnum(tab.jsonFormatStyle, `${label}.jsonFormatStyle`, ['pretty', 'compact'] as const),
      xmlFormatStyle: this.normalizeOptionalEnum(tab.xmlFormatStyle, `${label}.xmlFormatStyle`, ['pretty', 'compact', 'inline'] as const),
      formatIndent: this.normalizeOptionalEnum(tab.formatIndent, `${label}.formatIndent`, ['2', '4', 'tab'] as const),
      responseSearchQuery: typeof tab.responseSearchQuery === 'undefined' || tab.responseSearchQuery === null
        ? undefined
        : this.normalizeStringValue(tab.responseSearchQuery, `${label}.responseSearchQuery`),
      responseSearchIndex: this.normalizeOptionalNumber(tab.responseSearchIndex, `${label}.responseSearchIndex`),
      requestStartedAt: this.normalizeOptionalNumber(tab.requestStartedAt, `${label}.requestStartedAt`),
      requestEndedAt: this.normalizeOptionalNumber(tab.requestEndedAt, `${label}.requestEndedAt`),
      durationMs: this.normalizeOptionalNumber(tab.durationMs, `${label}.durationMs`),
      requestId: typeof tab.requestId === 'undefined' || tab.requestId === null
        ? undefined
        : this.asString(tab.requestId, `${label}.requestId`),
      webSocketKeepAliveMessage: typeof tab.webSocketKeepAliveMessage === 'undefined' || tab.webSocketKeepAliveMessage === null
        ? undefined
        : this.normalizeStringValue(tab.webSocketKeepAliveMessage, `${label}.webSocketKeepAliveMessage`),
    };
    for (const key of [
      'followRedirects', 'saveToHistory', 'stopAfterHeaders', 'skipDefaultHeaders', 'disableScripts',
      'scriptsTrusted', 'webSocketKeepAliveEnabled', 'responseSearchCaseSensitive', 'responseSearchRegex',
      'scriptHelpCollapsed', 'pinned',
    ]) {
      normalized[key] = this.normalizeOptionalBoolean(tab[key], `${label}.${key}`);
    }
    for (const key of ['maxResponseSizeKb', 'retryCount', 'retryDelayMs', 'webSocketKeepAliveIntervalSeconds'] as const) {
      normalized[key] = this.normalizeOptionalNumber(tab[key], `${label}.${key}`);
    }
    return normalized as unknown as TabState;
  }

  private normalizeStoredTabState(value: unknown, label: string): StoredTabState | null {
    if (value === null || typeof value === 'undefined') { return null; }
    const state = this.asObject(value, label);
    const tabs = this.asArray<unknown>(state.tabs, `${label}.tabs`).map((tab, index) =>
      this.normalizeTabState(tab, `${label}.tabs[${index}]`)
    );
    const rawActiveIndex = typeof state.activeIndex === 'undefined' || state.activeIndex === null ? 0 : state.activeIndex;
    if (typeof rawActiveIndex !== 'number' || !Number.isFinite(rawActiveIndex)) {
      throw new Error(`${label}.activeIndex must be a finite number.`);
    }
    const activeIndex = tabs.length === 0 ? 0 : Math.min(tabs.length - 1, Math.max(0, Math.floor(rawActiveIndex)));
    return {
      ...state,
      tabs,
      activeIndex,
      compareSettings: this.normalizeCompareSettings(state.compareSettings, `${label}.compareSettings`),
    } as StoredTabState;
  }

  // === 컬렉션 ===

  getCollections(): Collection[] {
    return this.readJson<Collection[]>(this.resolveFilePath('collections.json'), [], (value) =>
      this.normalizeCollectionArray(value, 'Collections')
    );
  }

  saveCollections(collections: Collection[]): void {
    this.writeJson(this.resolveFilePath('collections.json'), collections);
  }

  // === 히스토리 ===

  getHistory(): HistoryEntry[] {
    return this.copyHistoryValue(this.getHistorySnapshot().entries) as HistoryEntry[];
  }

  getHistorySnapshot(): HistorySnapshot {
    const filePath = this.resolveFilePath('history.json');
    try {
      const fingerprint = this.getHistoryFingerprint(filePath);
      const cached = this.historySnapshots.get(filePath);
      if (cached?.fingerprint === fingerprint) { return cached.snapshot; }

      const history = this.readJson<HistoryEntry[]>(filePath, [], (value) =>
        this.normalizeHistoryArray(value, 'History')
      );
      const snapshot = this.createHistorySnapshot(filePath, history);
      // 읽는 동안 외부에서 교체한 파일의 새 metadata를 이전 내용에 연결하지 않는다.
      if (fingerprint === this.getHistoryFingerprint(filePath)) {
        this.historySnapshots.set(filePath, { fingerprint, snapshot });
      } else {
        this.historySnapshots.delete(filePath);
      }
      return snapshot;
    } catch (error: unknown) {
      this.historySnapshots.delete(filePath);
      this.handleCorruptJson(filePath, error);
      return this.createHistorySnapshot(filePath, []);
    }
  }

  saveHistory(history: HistoryEntry[]): void {
    const current = this.getHistorySnapshot();
    // 외부 손상도 쓰기 전에 검증한다. 정상 복구/삭제가 읽혔을 때만 보호가 해제된다.
    this.requireRecoveredJson(current.filePath);
    this.normalizeHistoryArray(this.copyHistoryValue(history), 'History');
    this.writeJson(current.filePath, history);
    // 저장 직후 외부 교체가 가능하므로 다음 읽기에서 실제 내용과 metadata를 함께 검증한다.
    // 실패한 쓰기는 이전 snapshot을 유지한다.
    this.historySnapshots.delete(current.filePath);
  }

  private getHistoryFingerprint(filePath: string): string {
    try {
      const stat = fs.statSync(filePath, { bigint: true });
      return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') { return 'missing'; }
      throw error;
    }
  }

  private createHistorySnapshot(filePath: string, entries: HistoryEntry[]): HistorySnapshot {
    this.freezeHistoryValue(entries);
    return Object.freeze({ filePath, entries, count: entries.length });
  }

  private freezeHistoryValue(value: unknown): void {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) { return; }
    Object.freeze(value);
    for (const child of Object.values(value)) { this.freezeHistoryValue(child); }
  }

  private copyHistoryValue<T>(value: T): T {
    if (Array.isArray(value)) { return value.map((child) => this.copyHistoryValue(child)) as T; }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, this.copyHistoryValue(child)])) as T;
    }
    return value;
  }

  addHistoryEntry(entry: HistoryEntry): number {
    const history = this.getHistory();
    // 읽기 경고는 이미 표시됐다. 요청 결과는 유지하되 빈 fallback으로 원본을 덮지 않는다.
    if (this.corruptJsonWarnings.has(this.resolveFilePath('history.json'))) { return 0; }
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
    return this.readJson<Environment[]>(this.resolveFilePath('environments.json'), [], (value) =>
      this.normalizeEnvironmentArray(value, 'Environments')
    );
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

  applyEnvironmentVariableChanges(
    id: string,
    baseVariables: KeyValue[],
    nextVariables: KeyValue[]
  ): EnvironmentVariableChangesResult {
    const envs = this.getEnvironments();
    const environment = envs.find((candidate) => candidate.id === id);
    if (!environment) {
      return { changed: false, conflicts: [], appliedKeys: [] };
    }

    const byKey = (variables: KeyValue[]): Map<string, KeyValue> => {
      const result = new Map<string, KeyValue>();
      for (const variable of variables) {
        if (variable && typeof variable.key === 'string' && variable.key) {
          result.set(variable.key, { ...variable });
        }
      }
      return result;
    };
    const same = (left: KeyValue | undefined, right: KeyValue | undefined): boolean => {
      if (!left || !right) { return left === right; }
      return left.key === right.key && left.value === right.value && left.enabled === right.enabled;
    };

    const baseline = byKey(baseVariables);
    const next = byKey(nextVariables);
    const current = byKey(environment.variables);
    const currentEntries = new Map<string, KeyValue[]>();
    for (const variable of environment.variables) {
      const entries = currentEntries.get(variable.key) ?? [];
      entries.push(variable);
      currentEntries.set(variable.key, entries);
    }
    const allMatch = (entries: KeyValue[] | undefined, expected: KeyValue | undefined): boolean => {
      if (!entries || entries.length === 0) { return !expected; }
      return Boolean(expected) && entries.every((entry) => same(entry, expected));
    };
    const keys = new Set<string>([...baseline.keys(), ...next.keys()]);
    const conflicts: string[] = [];
    const changes = new Map<string, KeyValue | undefined>();
    for (const key of keys) {
      const before = baseline.get(key);
      const desired = next.get(key);
      if (same(before, desired)) { continue; }

      const now = current.get(key);
      const entries = currentEntries.get(key);
      if (!allMatch(entries, before)) {
        if (!allMatch(entries, desired)) { conflicts.push(key); }
        continue;
      }
      if (!same(now, desired)) {
        changes.set(key, desired);
      }
    }

    if (changes.size === 0) {
      return { changed: false, conflicts, appliedKeys: [] };
    }

    let merged = environment.variables.map((variable) => ({ ...variable }));
    const appliedKeys: string[] = [];
    for (const [key, desired] of changes) {
      const existingIndex = merged.findIndex((variable) => variable.key === key);
      if (!desired) {
        if (existingIndex >= 0) {
          merged = merged.filter((variable) => variable.key !== key);
          appliedKeys.push(key);
        }
      } else if (existingIndex >= 0) {
        if (merged.some((variable) => !same(variable, desired) && variable.key === key)) {
          merged = merged.filter((variable) => variable.key !== key);
          merged.splice(existingIndex, 0, { ...desired });
          appliedKeys.push(key);
        }
      } else {
        merged.push({ ...desired });
        appliedKeys.push(key);
      }
    }

    if (appliedKeys.length === 0) {
      return { changed: false, conflicts, appliedKeys: [] };
    }
    environment.variables = merged;
    this.saveEnvironments(envs);
    return { changed: true, conflicts, appliedKeys };
  }

  getActiveEnvironmentId(): string | null {
    return this.readJson<string | null>(this.resolveFilePath('active-environment.json'), null, (value) => {
      if (value === null) { return null; }
      if (typeof value !== 'string') { throw new Error('Active environment ID must be a string or null.'); }
      return value;
    });
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
    return this.readJson<KeyValue[]>(this.resolveFilePath('default-headers.json'), StorageService.DEFAULT_HEADERS.map((header) => ({ ...header })), (value) =>
      this.normalizeKeyValueArray(value, 'Default headers')
    );
  }

  saveDefaultHeaders(headers: KeyValue[]): void {
    this.writeJson(this.resolveFilePath('default-headers.json'), headers);
  }

  getVariables(): KeyValue[] {
    return this.readJson<KeyValue[]>(this.resolveFilePath('variables.json'), [], (value) =>
      this.normalizeKeyValueArray(value, 'Variables')
    );
  }

  saveVariables(variables: KeyValue[]): void {
    this.writeJson(this.resolveFilePath('variables.json'), variables);
  }

  exportWorkspaceBackup(tessraVersion?: string): WorkspaceBackup {
    const backup: WorkspaceBackup = {
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
    // 불완전한 fallback을 정상 백업으로 내보내거나 pre-import backup으로 사용하지 않는다.
    for (const fileName of ['collections.json', 'environments.json', 'active-environment.json', 'default-headers.json', 'variables.json']) {
      this.requireRecoveredJson(this.resolveFilePath(fileName));
    }
    return backup;
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

  validateTabState(value: unknown): StoredTabState | null {
    return this.normalizeStoredTabState(value, 'Tab state');
  }

  getTabState(): StoredTabState | null {
    return this.readJson<StoredTabState | null>(this.resolveFilePath('tab-state.json'), null, (value) =>
      this.normalizeStoredTabState(value, 'Tab state')
    );
  }

  saveTabState(tabs: TabState[], activeIndex: number, compareSettings?: CompareSettings): void {
    this.writeJson(this.resolveFilePath('tab-state.json'), { tabs, activeIndex, compareSettings });
  }

  saveTabStateForProfile(profileName: string, tabs: TabState[], activeIndex: number, compareSettings?: CompareSettings): void {
    const profilePath = profileName === StorageService.DEFAULT_PROFILE_NAME ? this.rootStoragePath : this.resolveProfilePath(profileName);
    this.ensureDir(profilePath);
    if (profileName !== StorageService.DEFAULT_PROFILE_NAME) { this.ensureProfileMeta(profilePath, profileName); }
    this.writeJsonFile(path.join(profilePath, 'tab-state.json'), { tabs, activeIndex, compareSettings });
  }
}
