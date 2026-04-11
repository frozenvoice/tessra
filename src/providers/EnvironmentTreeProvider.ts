import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { Environment } from '../models/types';
import { LocalizationService } from '../services/LocalizationService';

const ENV_MIME = 'application/vnd.arc.environment';

// 환경변수 TreeView 프로바이더 (드래그앤드롭 지원)
export class EnvironmentTreeProvider
  implements vscode.TreeDataProvider<Environment>, vscode.TreeDragAndDropController<Environment>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  readonly dragMimeTypes = [ENV_MIME];
  readonly dropMimeTypes = [ENV_MIME];

  // 현재 활성 환경 ID
  private _activeEnvId: string | null;

  constructor(private storage: StorageService) {
    this._activeEnvId = null;
    this.reloadFromStorage();
  }

  reloadFromStorage(): void {
    const savedId = this.storage.getActiveEnvironmentId();
    this._activeEnvId = savedId && this.storage.getEnvironment(savedId) ? savedId : null;
    if (savedId !== this._activeEnvId) {
      this.storage.saveActiveEnvironmentId(this._activeEnvId);
    }
  }

  get activeEnvId(): string | null {
    return this._activeEnvId;
  }

  set activeEnvId(value: string | null) {
    this._activeEnvId = value;
    this.storage.saveActiveEnvironmentId(value);
  }

  // 드래그 시작: 환경 ID를 전달
  handleDrag(source: readonly Environment[], dataTransfer: vscode.DataTransfer): void {
    if (source.length === 0) { return; }
    dataTransfer.set(ENV_MIME, new vscode.DataTransferItem(source.map((e) => e.id)));
  }

  // 드롭: 환경 순서 변경
  handleDrop(target: Environment | undefined, dataTransfer: vscode.DataTransfer): void {
    const raw = dataTransfer.get(ENV_MIME);
    if (!raw) { return; }
    const draggedIds: string[] = raw.value;
    if (target && draggedIds.includes(target.id)) { return; }

    const envs = this.storage.getEnvironments();
    // 드래그된 항목 추출
    const dragged: Environment[] = [];
    for (const id of draggedIds) {
      const idx = envs.findIndex((e) => e.id === id);
      if (idx >= 0) {
        dragged.push(...envs.splice(idx, 1));
      }
    }
    if (dragged.length === 0) { return; }

    // 삽입 위치 결정
    if (!target) {
      // 루트 끝에 추가
      envs.push(...dragged);
    } else {
      const targetIdx = envs.findIndex((e) => e.id === target.id);
      if (targetIdx >= 0) {
        envs.splice(targetIdx + 1, 0, ...dragged);
      } else {
        envs.push(...dragged);
      }
    }

    this.storage.saveEnvironments(envs);
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(env: Environment): vscode.TreeItem {
    const isActive = env.id === this.activeEnvId;
    const item = new vscode.TreeItem(
      env.name,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = isActive
      ? `✓ ${LocalizationService.t('environment.active')}`
      : LocalizationService.t('environment.vars', { count: env.variables.length });
    const varsLabel = LocalizationService.t('environment.vars', { count: env.variables.length });
    item.description = isActive
      ? `${LocalizationService.t('environment.active')} · ${varsLabel}`
      : varsLabel;
    item.iconPath = new vscode.ThemeIcon(
      isActive ? 'pass-filled' : 'symbol-variable',
      isActive ? new vscode.ThemeColor('charts.green') : undefined
    );
    item.description = isActive
      ? `${LocalizationService.t('environment.active')} · ${LocalizationService.t('environment.vars', { count: env.variables.length })}`
      : LocalizationService.t('environment.vars', { count: env.variables.length });
    item.contextValue = isActive ? 'environment-active' : 'environment';

    // 싱글클릭: 변수 편집, 더블클릭: 활성/비활성 토글
    item.command = {
      command: 'arc.onEnvironmentClick',
      title: LocalizationService.t('environment.clickTitle'),
      arguments: [env],
    };

    return item;
  }

  getChildren(): Environment[] {
    return this.storage.getEnvironments();
  }

  // 새 환경 생성
  async createEnvironment(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: LocalizationService.t('environment.name.prompt'),
      placeHolder: LocalizationService.t('environment.name.placeholder'),
    });
    if (!name) { return; }

    const envs = this.storage.getEnvironments();
    envs.push({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      name,
      variables: [],
    });
    this.storage.saveEnvironments(envs);
    this.refresh();
  }

  // 이름 변경
  async renameEnvironment(env: Environment): Promise<void> {
    const newName = await vscode.window.showInputBox({
      prompt: LocalizationService.t('environment.rename.prompt'),
      value: env.name,
    });
    if (!newName || newName === env.name) { return; }

    const envs = this.storage.getEnvironments();
    const target = envs.find((e) => e.id === env.id);
    if (target) { target.name = newName; }
    this.storage.saveEnvironments(envs);
    this.refresh();
  }

  // 삭제
  async deleteEnvironment(env: Environment): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      LocalizationService.t('environment.delete.confirm', { name: env.name }),
      { modal: true },
      LocalizationService.t('warn.delete')
    );
    if (confirm !== LocalizationService.t('warn.delete')) { return; }

    const envs = this.storage.getEnvironments();
    const idx = envs.findIndex((e) => e.id === env.id);
    if (idx >= 0) { envs.splice(idx, 1); }
    this.storage.saveEnvironments(envs);

    // 활성 환경이 삭제되면 비활성화
    if (this.activeEnvId === env.id) {
      this.activeEnvId = null;
    }
    this.refresh();
  }

  // 활성 환경의 변수 목록 반환
  getActiveVariables(): import('../models/types').KeyValue[] {
    if (!this.activeEnvId) { return []; }
    const env = this.storage.getEnvironment(this.activeEnvId);
    return env?.variables ?? [];
  }

  getActiveEnvironmentName(): string | null {
    if (!this.activeEnvId) { return null; }
    const env = this.storage.getEnvironment(this.activeEnvId);
    return env?.name ?? null;
  }
}
