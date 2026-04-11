import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { HistoryEntry } from '../models/types';
import { LocalizationService } from '../services/LocalizationService';
import { buildHistoryDescription, buildHistoryTooltip, getRequestMethodIcon } from './requestTreeVisuals';

const MIME = 'application/vnd.arc.history-entry';

interface HistoryFilter {
  terms: string[];
  methods: string[];
  hosts: string[];
  statuses: string[];
  pinned?: boolean;
}

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

  get visibleCount(): number {
    return this.getChildren().length;
  }

  getTreeItem(entry: HistoryEntry): vscode.TreeItem {
    const method = entry.request.method;
    const url = this.shortenUrl(entry.request.url);
    const status = entry.response ? `${entry.response.status}` : LocalizationService.t('history.errorShort');
    const time = entry.response ? `${entry.response.time}ms` : '';
    const label = `${method} ${url}`;

    const pinLabel = entry.pinned ? '📌 ' : '';
    const localizedPinLabel = entry.pinned ? (LocalizationService.t('history.pinnedTag') || pinLabel) : '';
    const item = new vscode.TreeItem(localizedPinLabel + label, vscode.TreeItemCollapsibleState.None);
    item.description = buildHistoryDescription(entry);
    item.tooltip = buildHistoryTooltip(entry);
    item.iconPath = getRequestMethodIcon(method);
    item.contextValue = entry.pinned ? 'history-pinned' : 'history';

    item.command = {
      command: 'arc.loadFromHistory',
      title: LocalizationService.t('tree.loadRequest'),
      arguments: [entry],
    };

    return item;
  }

  getChildren(): HistoryEntry[] {
    let entries = this.storage.getHistory();
    const filter = this.parseFilter(this._filterText);
    if (this.hasActiveFilter(filter)) {
      entries = entries.filter((entry) => this.matchesEntry(entry, filter));
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

  private parseFilter(text: string): HistoryFilter {
    const filter: HistoryFilter = { terms: [], methods: [], hosts: [], statuses: [] };
    for (const token of String(text || '').trim().split(/\s+/).filter(Boolean)) {
      const match = token.match(/^([a-z]+):(.*)$/i);
      if (!match) {
        filter.terms.push(token.toLowerCase());
        continue;
      }
      const key = match[1].toLowerCase();
      const value = match[2].toLowerCase();
      if (!value) { continue; }
      if (key === 'method') filter.methods.push(value);
      else if (key === 'host') filter.hosts.push(value);
      else if (key === 'status') filter.statuses.push(value);
      else if (key === 'pinned') filter.pinned = ['yes', 'true', '1', 'y'].includes(value);
      else filter.terms.push(token.toLowerCase());
    }
    return filter;
  }

  private hasActiveFilter(filter: HistoryFilter): boolean {
    return filter.terms.length > 0 || filter.methods.length > 0 || filter.hosts.length > 0 || filter.statuses.length > 0 || filter.pinned !== undefined;
  }

  private matchesEntry(entry: HistoryEntry, filter: HistoryFilter): boolean {
    const method = entry.request.method.toLowerCase();
    const url = entry.request.url.toLowerCase();
    const host = this.extractHost(entry.request.url);
    const status = entry.response ? String(entry.response.status) : 'error';
    const textBlob = `${method} ${url} ${host} ${status}`;

    if (filter.terms.length > 0 && !filter.terms.every((term) => textBlob.includes(term))) { return false; }
    if (filter.methods.length > 0 && !filter.methods.some((candidate) => method.includes(candidate))) { return false; }
    if (filter.hosts.length > 0 && !filter.hosts.some((candidate) => host.includes(candidate))) { return false; }
    if (filter.statuses.length > 0 && !filter.statuses.some((candidate) => this.matchesStatusFilter(status, candidate))) { return false; }
    if (filter.pinned !== undefined && entry.pinned !== filter.pinned) { return false; }
    return true;
  }

  private matchesStatusFilter(status: string, candidate: string): boolean {
    if (candidate === 'error' || candidate === 'err') { return status === 'error'; }
    if (/^[1-5]xx$/.test(candidate)) { return status.startsWith(candidate[0]); }
    return status.includes(candidate);
  }

  private extractHost(url: string): string {
    try {
      return new URL(url).host.toLowerCase();
    } catch {
      return '';
    }
  }
}
