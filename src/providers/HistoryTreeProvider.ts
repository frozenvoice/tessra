import * as vscode from 'vscode';
import { HistorySnapshot, StorageService } from '../services/StorageService';
import { HistoryEntry } from '../models/types';
import { LocalizationService } from '../services/LocalizationService';
import { buildHistoryDescription, buildHistoryTooltip, getRequestMethodIcon } from './requestTreeVisuals';

const MIME = 'application/vnd.tessra.history-entry';

interface HistoryFilter {
  terms: string[];
  methods: string[];
  hosts: string[];
  statuses: string[];
  pinned?: boolean;
}

type HistoryGroupId = 'pinned' | 'today' | 'yesterday' | 'thisWeek' | 'older';

interface HistoryGroupNode {
  kind: 'group';
  id: HistoryGroupId;
  labelKey: string;
  entries: HistoryEntry[];
}

type HistoryTreeNode = HistoryEntry | HistoryGroupNode;

export class HistoryTreeProvider
  implements vscode.TreeDataProvider<HistoryTreeNode>, vscode.TreeDragAndDropController<HistoryTreeNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<HistoryTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  readonly dragMimeTypes = [MIME];
  readonly dropMimeTypes = [MIME];

  private _filterText = '';
  get filterText(): string { return this._filterText; }
  set filterText(value: string) {
    this._filterText = value;
    this.refresh();
  }

  private snapshot: HistorySnapshot | undefined;
  private filteredText = '';
  private filteredEntries: HistoryEntry[] = [];

  onCountChanged: ((count: number, visibleCount: number) => void) | undefined;

  constructor(private storage: StorageService) {}

  refresh(): void {
    // 이벤트 전에 같은 snapshot의 건수를 확정해 설명 라벨과 트리를 맞춘다.
    this.getFilteredEntries();
    this._onDidChangeTreeData.fire(undefined);
  }

  getCounts(): { total: number; visible: number } {
    const visible = this.getFilteredEntries().length;
    return { total: this.snapshot!.count, visible };
  }

  get visibleCount(): number {
    return this.getFilteredEntries().length;
  }

  getTreeItem(node: HistoryTreeNode): vscode.TreeItem {
    if (this.isGroupNode(node)) {
      const item = new vscode.TreeItem(
        LocalizationService.t(node.labelKey),
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.description = String(node.entries.length);
      item.contextValue = 'history-group';
      item.iconPath = new vscode.ThemeIcon(node.id === 'pinned' ? 'pinned' : 'calendar');
      return item;
    }

    const entry = node;
    const method = entry.request.requestType === 'websocket' || /^wss?:\/\//i.test(entry.request.url || '')
      ? 'WS'
      : entry.request.method;
    const url = this.shortenUrl(entry.request.url);
    const label = `${method} ${url}`;

    const pinLabel = entry.pinned ? '[Pinned] ' : '';
    const localizedPinLabel = entry.pinned ? (LocalizationService.t('history.pinnedTag') || pinLabel) : '';
    const item = new vscode.TreeItem(localizedPinLabel + label, vscode.TreeItemCollapsibleState.None);
    item.description = buildHistoryDescription(entry);
    item.tooltip = buildHistoryTooltip(entry);
    item.iconPath = getRequestMethodIcon(method, entry.request);
    item.contextValue = entry.pinned ? 'history-pinned' : 'history';

    item.command = {
      command: 'tessra.loadFromHistory',
      title: LocalizationService.t('tree.loadRequest'),
      arguments: [entry],
    };

    return item;
  }

  getChildren(element?: HistoryTreeNode): HistoryTreeNode[] {
    if (this.isGroupNode(element)) {
      // 프로필 전환 전에 받은 group node도 현재 파일의 항목으로 다시 해석한다.
      return this.groupEntries(this.getFilteredEntries()).find((group) => group.id === element.id)?.entries ?? [];
    }
    return this.groupEntries(this.getFilteredEntries());
  }

  private getFilteredEntries(): HistoryEntry[] {
    const snapshot = this.storage.getHistorySnapshot();
    if (snapshot !== this.snapshot || this.filteredText !== this._filterText) {
      const filter = this.parseFilter(this._filterText);
      this.filteredEntries = this.hasActiveFilter(filter)
        ? snapshot.entries.filter((entry) => this.matchesEntry(entry, filter))
        : [...snapshot.entries];
      this.snapshot = snapshot;
      this.filteredText = this._filterText;
      this.onCountChanged?.(snapshot.count, this.filteredEntries.length);
    }
    return this.filteredEntries;
  }

  private groupEntries(entries: HistoryEntry[]): HistoryGroupNode[] {
    const groups: HistoryGroupNode[] = [];
    const pinned = entries.filter((entry) => entry.pinned);
    if (pinned.length > 0) {
      groups.push({ kind: 'group', id: 'pinned', labelKey: 'history.group.pinned', entries: pinned });
    }

    const buckets: Record<Exclude<HistoryGroupId, 'pinned'>, HistoryEntry[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    for (const entry of entries) {
      if (entry.pinned) { continue; }
      buckets[this.resolveDateGroup(entry)].push(entry);
    }

    const orderedGroups: Array<{ id: Exclude<HistoryGroupId, 'pinned'>; labelKey: string }> = [
      { id: 'today', labelKey: 'history.group.today' },
      { id: 'yesterday', labelKey: 'history.group.yesterday' },
      { id: 'thisWeek', labelKey: 'history.group.thisWeek' },
      { id: 'older', labelKey: 'history.group.older' },
    ];

    for (const group of orderedGroups) {
      const groupedEntries = buckets[group.id];
      if (groupedEntries.length > 0) {
        groups.push({ kind: 'group', id: group.id, labelKey: group.labelKey, entries: groupedEntries });
      }
    }

    return groups;
  }

  private resolveDateGroup(entry: HistoryEntry): Exclude<HistoryGroupId, 'pinned'> {
    const timestamp = new Date(entry.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      return 'older';
    }

    const todayStart = this.startOfLocalDay(new Date()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = this.startOfLocalWeek(new Date()).getTime();
    const entryTime = this.startOfLocalDay(timestamp).getTime();

    if (entryTime >= todayStart) { return 'today'; }
    if (entryTime >= yesterdayStart) { return 'yesterday'; }
    if (entryTime >= weekStart) { return 'thisWeek'; }
    return 'older';
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfLocalWeek(date: Date): Date {
    const start = this.startOfLocalDay(date);
    const day = start.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysSinceMonday);
    return start;
  }

  handleDrag(source: readonly HistoryTreeNode[], dataTransfer: vscode.DataTransfer): void {
    const entryIds = source
      .filter((node): node is HistoryEntry => this.isHistoryEntry(node))
      .map((entry) => entry.id);
    if (entryIds.length === 0) { return; }
    dataTransfer.set(MIME, new vscode.DataTransferItem(entryIds));
  }

  handleDrop(target: HistoryTreeNode | undefined, dataTransfer: vscode.DataTransfer): void {
    if (!this.isHistoryEntry(target)) { return; }
    const raw = dataTransfer.get(MIME);
    if (!raw) { return; }
    const draggedIds = Array.isArray(raw.value) ? raw.value.filter((value): value is string => typeof value === 'string') : [];
    if (draggedIds.length === 0 || draggedIds.includes(target.id)) { return; }

    const history = this.storage.getHistory();
    const dragged: HistoryEntry[] = [];
    const remaining = history.filter((entry) => {
      if (draggedIds.includes(entry.id)) {
        dragged.push(entry);
        return false;
      }
      return true;
    });
    if (dragged.length === 0) { return; }

    const insertIdx = remaining.findIndex((entry) => entry.id === target.id);
    if (insertIdx < 0) { return; }

    remaining.splice(insertIdx + 1, 0, ...dragged);
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
    const method = (entry.request.requestType === 'websocket' || /^wss?:\/\//i.test(entry.request.url || ''))
      ? 'ws'
      : entry.request.method.toLowerCase();
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

  private isGroupNode(node: HistoryTreeNode | undefined): node is HistoryGroupNode {
    return !!node && (node as HistoryGroupNode).kind === 'group';
  }

  private isHistoryEntry(node: HistoryTreeNode | undefined): node is HistoryEntry {
    return !!node && !this.isGroupNode(node);
  }
}
