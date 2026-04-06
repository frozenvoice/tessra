import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { HistoryEntry } from '../models/types';

const MIME = 'application/vnd.arc.history-entry';

// 히스토리 TreeView 프로바이더 (드래그앤드롭 지원)
export class HistoryTreeProvider
  implements vscode.TreeDataProvider<HistoryEntry>, vscode.TreeDragAndDropController<HistoryEntry>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  readonly dragMimeTypes = [MIME];
  readonly dropMimeTypes = [MIME];

  // 검색 필터
  private _filterText = '';
  get filterText(): string { return this._filterText; }
  set filterText(value: string) {
    this._filterText = value;
    this.refresh();
  }

  // 뷰 타이틀 갱신 콜백 (extension.ts에서 설정)
  onCountChanged: ((count: number) => void) | undefined;

  constructor(private storage: StorageService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
    // 개수 갱신 알림
    const count = this.storage.getHistory().length;
    this.onCountChanged?.(count);
  }

  getTreeItem(entry: HistoryEntry): vscode.TreeItem {
    const method = entry.request.method;
    const url = this.shortenUrl(entry.request.url);
    const status = entry.response ? `${entry.response.status}` : 'ERR';
    const time = entry.response ? `${entry.response.time}ms` : '';
    const label = `${method} ${url}`;

    const pinLabel = entry.pinned ? '📌 ' : '';
    const item = new vscode.TreeItem(pinLabel + label, vscode.TreeItemCollapsibleState.None);
    item.description = `${status} ${time}`;
    item.tooltip = `${entry.pinned ? '[고정] ' : ''}${method} ${entry.request.url}\n${status} ${time}\n${new Date(entry.timestamp).toLocaleString()}`;
    item.iconPath = this.getMethodIcon(method);
    item.contextValue = entry.pinned ? 'history-pinned' : 'history';

    item.command = {
      command: 'arc.loadFromHistory',
      title: '요청 로드',
      arguments: [entry],
    };

    return item;
  }

  getChildren(): HistoryEntry[] {
    let entries = this.storage.getHistory();
    const q = this._filterText.toLowerCase();
    if (q) {
      entries = entries.filter((e) => {
        const method = e.request.method.toLowerCase();
        const url = e.request.url.toLowerCase();
        const status = e.response ? String(e.response.status) : 'err';
        return method.includes(q) || url.includes(q) || status.includes(q);
      });
    }

    // pinned 항목을 최상단에 고정 (각 그룹 내 순서는 유지)
    const pinned = entries.filter((e) => e.pinned);
    const unpinned = entries.filter((e) => !e.pinned);
    return [...pinned, ...unpinned];
  }

  // === 드래그앤드롭 ===

  handleDrag(source: readonly HistoryEntry[], dataTransfer: vscode.DataTransfer): void {
    dataTransfer.set(MIME, new vscode.DataTransferItem(
      source.map((e) => e.id)
    ));
  }

  handleDrop(target: HistoryEntry | undefined, dataTransfer: vscode.DataTransfer): void {
    const raw = dataTransfer.get(MIME);
    if (!raw) { return; }
    const draggedIds: string[] = raw.value;
    if (!draggedIds || draggedIds.length === 0) { return; }
    if (target && draggedIds.includes(target.id)) { return; }

    const history = this.storage.getHistory();

    // 드래그된 항목 추출
    const dragged: HistoryEntry[] = [];
    const remaining = history.filter((e) => {
      if (draggedIds.includes(e.id)) {
        dragged.push(e);
        return false;
      }
      return true;
    });

    // 드롭 위치 계산
    let insertIdx = 0;
    if (target) {
      insertIdx = remaining.findIndex((e) => e.id === target.id);
      if (insertIdx < 0) { insertIdx = remaining.length; }
      else { insertIdx += 1; } // 대상 바로 아래
    }

    remaining.splice(insertIdx, 0, ...dragged);
    this.storage.saveHistory(remaining);
    this.refresh();
  }

  private shortenUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.length > 20
        ? parsed.hostname.substring(0, 17) + '...'
        : parsed.hostname;
      return host + parsed.pathname;
    } catch {
      return url.length > 40 ? url.substring(0, 37) + '...' : url;
    }
  }

  private getMethodIcon(method: string): vscode.ThemeIcon {
    switch (method) {
      case 'GET': return new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.green'));
      case 'POST': return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.yellow'));
      case 'PUT': return new vscode.ThemeIcon('arrow-swap', new vscode.ThemeColor('charts.blue'));
      case 'PATCH': return new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.orange'));
      case 'DELETE': return new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red'));
      default: return new vscode.ThemeIcon('globe');
    }
  }
}
