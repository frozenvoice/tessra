import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { Environment } from '../models/types';
import { LocalizationService } from '../services/LocalizationService';

const ENV_MIME = 'application/vnd.tessra.environment';

// Environment TreeView provider with drag-and-drop support.
export class EnvironmentTreeProvider
  implements vscode.TreeDataProvider<Environment>, vscode.TreeDragAndDropController<Environment>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  readonly dragMimeTypes = [ENV_MIME];
  readonly dropMimeTypes = [ENV_MIME];

  // Current active environment ID.
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

  // Start drag by passing environment IDs.
  handleDrag(source: readonly Environment[], dataTransfer: vscode.DataTransfer): void {
    if (source.length === 0) { return; }
    dataTransfer.set(ENV_MIME, new vscode.DataTransferItem(source.map((e) => e.id)));
  }

  // Drop environments to reorder them.
  handleDrop(target: Environment | undefined, dataTransfer: vscode.DataTransfer): void {
    const raw = dataTransfer.get(ENV_MIME);
    if (!raw) { return; }
    const draggedIds: string[] = raw.value;
    if (target && draggedIds.includes(target.id)) { return; }

    const envs = this.storage.getEnvironments();
    // Collect dragged items.
    const dragged: Environment[] = [];
    for (const id of draggedIds) {
      const idx = envs.findIndex((e) => e.id === id);
      if (idx >= 0) {
        dragged.push(...envs.splice(idx, 1));
      }
    }
    if (dragged.length === 0) { return; }

    // Decide insertion position.
    if (!target) {
      // Append at root when there is no target.
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
    const varsLabel = LocalizationService.t('environment.vars', { count: env.variables.length });
    const item = new vscode.TreeItem(
      env.name,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = isActive
      ? LocalizationService.t('environment.active')
      : LocalizationService.t('environment.vars', { count: env.variables.length });
    item.description = isActive
      ? `${LocalizationService.t('environment.active')} | ${varsLabel}`
      : varsLabel;
    item.iconPath = new vscode.ThemeIcon(
      isActive ? 'pass-filled' : 'symbol-variable',
      isActive ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.blue')
    );
    item.description = isActive
      ? `${LocalizationService.t('environment.active')} | ${LocalizationService.t('environment.vars', { count: env.variables.length })}`
      : LocalizationService.t('environment.vars', { count: env.variables.length });
    item.tooltip = isActive
      ? `${env.name}\n${LocalizationService.t('environment.active')} | ${varsLabel}`
      : `${env.name}\n${varsLabel}`;
    item.description = isActive
      ? `${LocalizationService.t('environment.active')} | ${varsLabel}`
      : varsLabel;
    item.tooltip = isActive
      ? `${env.name}\n${LocalizationService.t('environment.active')} | ${varsLabel}`
      : `${env.name}\n${varsLabel}`;
    item.contextValue = isActive ? 'environment-active' : 'environment';

    // Single click edits variables; double click toggles active state.
    item.command = {
      command: 'tessra.onEnvironmentClick',
      title: LocalizationService.t('environment.clickTitle'),
      arguments: [env],
    };

    return item;
  }

  getChildren(): Environment[] {
    return this.storage.getEnvironments();
  }

  // Create a new environment.
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

  // Rename an environment.
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

  // Delete an environment.
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

    // Deactivate if the active environment was deleted.
    if (this.activeEnvId === env.id) {
      this.activeEnvId = null;
    }
    this.refresh();
  }

  // Return variables from the active environment.
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
