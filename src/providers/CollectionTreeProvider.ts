import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { Collection, CollectionItem, Request, RequestBodyType, RequestSettings } from '../models/types';
import { LocalizationService } from '../services/LocalizationService';

// TreeView에서 사용할 노드 타입
export type CollectionNode =
  | { kind: 'collection'; collection: Collection }
  | { kind: 'folder'; item: CollectionItem; collectionId: string }
  | { kind: 'request'; item: CollectionItem; collectionId: string };

const MIME = 'application/vnd.arc.collection-node';

// 컬렉션 TreeView 프로바이더 (드래그앤드롭 지원)
export class CollectionTreeProvider
  implements vscode.TreeDataProvider<CollectionNode>, vscode.TreeDragAndDropController<CollectionNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // DnD 설정
  readonly dragMimeTypes = [MIME];
  readonly dropMimeTypes = [MIME];

  // 검색 필터
  private _filterText = '';
  get filterText(): string { return this._filterText; }
  set filterText(value: string) {
    this._filterText = value;
    this.refresh();
  }

  constructor(private storage: StorageService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(node: CollectionNode): vscode.TreeItem {
    switch (node.kind) {
      case 'collection': {
        const item = new vscode.TreeItem(
          node.collection.name,
          vscode.TreeItemCollapsibleState.Expanded
        );
        item.iconPath = new vscode.ThemeIcon('folder-library');
        item.contextValue = 'collection';
        return item;
      }
      case 'folder': {
        const item = new vscode.TreeItem(
          node.item.name,
          vscode.TreeItemCollapsibleState.Expanded
        );
        item.iconPath = new vscode.ThemeIcon('folder');
        item.contextValue = 'folder';
        return item;
      }
      case 'request': {
        const req = node.item.request!;
        const item = new vscode.TreeItem(
          node.item.name,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = req.method;
        item.iconPath = this.getMethodIcon(req.method);
        item.contextValue = 'request';
        item.command = {
          command: 'arc.loadFromCollection',
          title: LocalizationService.t('tree.loadRequest'),
          arguments: [node],
        };
        return item;
      }
    }
  }

  getChildren(node?: CollectionNode): CollectionNode[] {
    const q = this._filterText.toLowerCase();

    if (!node) {
      const collections = this.storage.getCollections();
      if (!q) {
        return collections.map((c) => ({ kind: 'collection' as const, collection: c }));
      }
      // 필터 활성: 매칭 항목이 있는 컬렉션만 표시
      return collections
        .filter((c) => this.hasMatchInItems(c.items, q))
        .map((c) => ({ kind: 'collection' as const, collection: c }));
    }

    let items: CollectionItem[] = [];
    let collectionId = '';

    if (node.kind === 'collection') {
      items = node.collection.items;
      collectionId = node.collection.id;
    } else if (node.kind === 'folder') {
      items = node.item.children ?? [];
      collectionId = node.collectionId;
    }

    // 필터 활성 시 매칭 항목만
    if (q) {
      items = items.filter((child) => this.itemMatches(child, q));
    }

    return items.map((child) => ({
      kind: child.type === 'folder' ? 'folder' as const : 'request' as const,
      item: child,
      collectionId,
    }));
  }

  // 항목이 검색어에 매칭되는지 (하위 포함)
  private itemMatches(item: CollectionItem, q: string): boolean {
    if (item.type === 'request') {
      const name = item.name.toLowerCase();
      const url = (item.request?.url ?? '').toLowerCase();
      const method = (item.request?.method ?? '').toLowerCase();
      return name.includes(q) || url.includes(q) || method.includes(q);
    }
    // 폴더: 이름 매칭 또는 하위에 매칭 항목 존재
    if (item.name.toLowerCase().includes(q)) { return true; }
    return this.hasMatchInItems(item.children ?? [], q);
  }

  private hasMatchInItems(items: CollectionItem[], q: string): boolean {
    return items.some((item) => this.itemMatches(item, q));
  }

  // === 드래그앤드롭 ===

  handleDrag(source: readonly CollectionNode[], dataTransfer: vscode.DataTransfer): void {
    // 컬렉션 자체는 드래그 불가
    const draggable = source.filter((n) => n.kind !== 'collection');
    if (draggable.length === 0) { return; }
    dataTransfer.set(MIME, new vscode.DataTransferItem(
      draggable.map((n) => (n as any).item.id)
    ));
  }

  handleDrop(target: CollectionNode | undefined, dataTransfer: vscode.DataTransfer): void {
    const raw = dataTransfer.get(MIME);
    if (!raw) { return; }
    const draggedIds: string[] = raw.value;
    if (!draggedIds || draggedIds.length === 0) { return; }
    if (!target) {
      vscode.window.showWarningMessage(LocalizationService.t('collection.dropTarget'));
      return;
    }

    const collections = this.storage.getCollections();
    if (this.isInvalidDropTarget(collections, draggedIds, target)) {
      vscode.window.showWarningMessage(LocalizationService.t('collection.dropInvalid'));
      return;
    }

    // 드래그된 항목들 수집 후 원래 위치에서 제거
    const draggedItems: CollectionItem[] = [];
    for (const id of draggedIds) {
      const item = this.findAndRemove(collections, id);
      if (item) { draggedItems.push(item); }
    }
    if (draggedItems.length === 0) { return; }

    // 드롭 대상에 삽입
    if (target.kind === 'collection') {
      const col = collections.find((c) => c.id === target.collection.id);
      if (col) { col.items.push(...draggedItems); }
    } else if (target.kind === 'folder') {
      const folder = this.findItem(collections, target.item.id);
      if (folder?.children) { folder.children.push(...draggedItems); }
    } else if (target.kind === 'request') {
      // 요청 옆에 드롭 → 같은 부모에 그 요청 바로 뒤에 삽입
      const parent = this.findParentList(collections, target.item.id);
      if (parent) {
        const idx = parent.findIndex((i) => i.id === target.item.id);
        parent.splice(idx + 1, 0, ...draggedItems);
      }
    }

    this.storage.saveCollections(collections);
    this.refresh();
  }

  // === CRUD 메서드 ===

  async createCollection(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: LocalizationService.t('collection.name.prompt'),
      placeHolder: LocalizationService.t('collection.name.placeholder'),
    });
    if (!name) { return; }

    const collections = this.storage.getCollections();
    collections.push({ id: this.generateId(), name, items: [] });
    this.storage.saveCollections(collections);
    this.refresh();
  }

  async createFolder(node: CollectionNode): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: LocalizationService.t('folder.name.prompt'),
      placeHolder: LocalizationService.t('folder.name.placeholder'),
    });
    if (!name) { return; }

    const collections = this.storage.getCollections();
    const folder: CollectionItem = {
      id: this.generateId(),
      type: 'folder',
      name,
      children: [],
    };

    if (node.kind === 'collection') {
      const col = collections.find((c) => c.id === node.collection.id);
      col?.items.push(folder);
    } else if (node.kind === 'folder') {
      const target = this.findItem(collections, node.item.id);
      target?.children?.push(folder);
    }

    this.storage.saveCollections(collections);
    this.refresh();
  }

  async saveRequest(
    requestData: {
      requestId?: string;  // 기존 요청 ID (있으면 덮어쓰기)
      method: string;
      url: string;
      headers: Request['headers'];
      params: Request['params'];
      body: string;
      bodyType: RequestBodyType;
      formData?: Request['formData'];
      binaryFilePath?: string;
      auth: Request['auth'];
      scripts?: Request['scripts'];
      timeout?: RequestSettings['timeout'];
      followRedirects?: RequestSettings['followRedirects'];
      saveToHistory?: RequestSettings['saveToHistory'];
      tlsValidation?: RequestSettings['tlsValidation'];
      maxResponseSizeKb?: RequestSettings['maxResponseSizeKb'];
      retryCount?: RequestSettings['retryCount'];
      retryDelayMs?: RequestSettings['retryDelayMs'];
      stopAfterHeaders?: RequestSettings['stopAfterHeaders'];
      skipDefaultHeaders?: RequestSettings['skipDefaultHeaders'];
      disableScripts?: RequestSettings['disableScripts'];
    }
  ): Promise<{ requestId: string; name: string } | null> {
    const collections = this.storage.getCollections();

    // 기존 요청 덮어쓰기
    if (requestData.requestId) {
      const existing = this.findItemByRequestId(collections, requestData.requestId);
      if (existing?.request) {
        existing.request.name = existing.name;
        existing.request.method = requestData.method as any;
        existing.request.url = requestData.url;
        existing.request.headers = requestData.headers ?? [];
          existing.request.params = requestData.params ?? [];
          existing.request.body = requestData.body ?? '';
          existing.request.bodyType = requestData.bodyType;
          existing.request.formData = requestData.formData ?? [];
          existing.request.binaryFilePath = requestData.binaryFilePath ?? '';
          existing.request.auth = requestData.auth ?? { type: 'none' };
          existing.request.scripts = requestData.scripts ?? { preRequest: '', test: '' };
          existing.request.timeout = requestData.timeout ?? 0;
          existing.request.followRedirects = requestData.followRedirects === true;
          existing.request.saveToHistory = requestData.saveToHistory !== false;
          existing.request.tlsValidation = requestData.tlsValidation ?? 'default';
          existing.request.maxResponseSizeKb = requestData.maxResponseSizeKb ?? 0;
          existing.request.retryCount = requestData.retryCount ?? 0;
          existing.request.retryDelayMs = requestData.retryDelayMs ?? 0;
          existing.request.stopAfterHeaders = requestData.stopAfterHeaders === true;
          existing.request.skipDefaultHeaders = requestData.skipDefaultHeaders === true;
          existing.request.disableScripts = requestData.disableScripts === true;
          this.storage.saveCollections(collections);
          this.refresh();
        return { requestId: existing.request.id, name: existing.name };
      }
    }

    // 새로 저장
    if (collections.length === 0) {
      vscode.window.showWarningMessage(LocalizationService.t('collection.noneYet'));
      return null;
    }

    const picks = this.buildPickList(collections);
    const selected = await vscode.window.showQuickPick(picks, { placeHolder: LocalizationService.t('collection.chooseSaveTarget') });
    if (!selected) { return null; }

    const name = await vscode.window.showInputBox({
      prompt: LocalizationService.t('collection.saveName.prompt'),
      placeHolder: requestData.method + ' ' + requestData.url,
      value: requestData.method + ' ' + this.extractPath(requestData.url),
    });
    if (!name) { return null; }

    const newRequestId = this.generateId();
    const newItem: CollectionItem = {
      id: this.generateId(),
      type: 'request',
      name,
      request: {
        id: newRequestId,
        name,
        method: requestData.method as any,
        url: requestData.url,
        headers: requestData.headers ?? [],
        params: requestData.params ?? [],
        body: requestData.body ?? '',
        bodyType: requestData.bodyType,
        formData: requestData.formData ?? [],
        binaryFilePath: requestData.binaryFilePath ?? '',
        auth: requestData.auth ?? { type: 'none' },
        scripts: requestData.scripts ?? { preRequest: '', test: '' },
        timeout: requestData.timeout ?? 0,
        followRedirects: requestData.followRedirects === true,
        saveToHistory: requestData.saveToHistory !== false,
        tlsValidation: requestData.tlsValidation ?? 'default',
        maxResponseSizeKb: requestData.maxResponseSizeKb ?? 0,
        retryCount: requestData.retryCount ?? 0,
        retryDelayMs: requestData.retryDelayMs ?? 0,
        stopAfterHeaders: requestData.stopAfterHeaders === true,
        skipDefaultHeaders: requestData.skipDefaultHeaders === true,
        disableScripts: requestData.disableScripts === true,
      },
    };

    if (selected.targetType === 'collection') {
      const col = collections.find((c) => c.id === selected.targetId);
      col?.items.push(newItem);
    } else {
      const folder = this.findItem(collections, selected.targetId);
      folder?.children?.push(newItem);
    }

    this.storage.saveCollections(collections);
    this.refresh();
    vscode.window.showInformationMessage(LocalizationService.t('collection.saved', { name }));
    return { requestId: newRequestId, name };
  }

  // request.id로 CollectionItem 검색
  private findItemByRequestId(collections: Collection[], requestId: string): CollectionItem | undefined {
    for (const col of collections) {
      const found = this.findInItemsByRequestId(col.items, requestId);
      if (found) { return found; }
    }
    return undefined;
  }

  private findInItemsByRequestId(items: CollectionItem[], requestId: string): CollectionItem | undefined {
    for (const item of items) {
      if (item.request?.id === requestId) { return item; }
      if (item.children) {
        const found = this.findInItemsByRequestId(item.children, requestId);
        if (found) { return found; }
      }
    }
    return undefined;
  }

  async rename(node: CollectionNode): Promise<void> {
    const currentName = node.kind === 'collection' ? node.collection.name : node.item.name;
    const newName = await vscode.window.showInputBox({ prompt: LocalizationService.t('collection.rename.prompt'), value: currentName });
    if (!newName || newName === currentName) { return; }

    const collections = this.storage.getCollections();
    if (node.kind === 'collection') {
      const col = collections.find((c) => c.id === node.collection.id);
      if (col) { col.name = newName; }
    } else {
      const item = this.findItem(collections, node.item.id);
      if (item) {
        item.name = newName;
        if (item.request) {
          item.request.name = newName;
        }
      }
    }
    this.storage.saveCollections(collections);
    this.refresh();
  }

  async delete(node: CollectionNode): Promise<void> {
    const name = node.kind === 'collection' ? node.collection.name : node.item.name;
    const confirm = await vscode.window.showWarningMessage(
      LocalizationService.t('collection.delete.confirm', { name }), { modal: true }, LocalizationService.t('warn.delete')
    );
    if (confirm !== LocalizationService.t('warn.delete')) { return; }

    const collections = this.storage.getCollections();
    if (node.kind === 'collection') {
      const idx = collections.findIndex((c) => c.id === node.collection.id);
      if (idx >= 0) { collections.splice(idx, 1); }
    } else {
      this.removeItemById(collections, node.item.id);
    }
    this.storage.saveCollections(collections);
    this.refresh();
  }

  // === Duplicate / Save As ===

  // 같은 컬렉션 안에 "(이름) Copy"로 복제
  async duplicate(node: CollectionNode): Promise<void> {
    if (node.kind === 'collection') { return; }

    const collections = this.storage.getCollections();
    const clone = this.deepCloneItem(node.item);
    clone.name = `${node.item.name} Copy`;
    if (clone.request) {
      clone.request.name = clone.name;
    }

    // 원본 바로 뒤에 삽입
    const parentList = this.findParentList(collections, node.item.id);
    if (parentList) {
      const idx = parentList.findIndex((i) => i.id === node.item.id);
      parentList.splice(idx + 1, 0, clone);
    }

    this.storage.saveCollections(collections);
    this.refresh();
  }

  // 다른 컬렉션/폴더를 선택해서 복사본 저장
  async saveAs(node: CollectionNode): Promise<void> {
    if (node.kind === 'collection') { return; }

    const collections = this.storage.getCollections();
    if (collections.length === 0) {
      vscode.window.showWarningMessage(LocalizationService.t('collection.none'));
      return;
    }

    const picks = this.buildPickList(collections);
    const selected = await vscode.window.showQuickPick(picks, { placeHolder: LocalizationService.t('collection.chooseCopyTarget') });
    if (!selected) { return; }

    const name = await vscode.window.showInputBox({
      prompt: LocalizationService.t('collection.saveName.prompt'),
      value: node.item.name,
    });
    if (!name) { return; }

    const clone = this.deepCloneItem(node.item);
    clone.name = name;
    if (clone.request) {
      clone.request.name = name;
    }

    if (selected.targetType === 'collection') {
      const col = collections.find((c) => c.id === selected.targetId);
      col?.items.push(clone);
    } else {
      const folder = this.findItem(collections, selected.targetId);
      folder?.children?.push(clone);
    }

    this.storage.saveCollections(collections);
    this.refresh();
    vscode.window.showInformationMessage(LocalizationService.t('collection.saved', { name }));
  }

  // 항목을 깊은 복사하고 모든 ID를 새로 생성
  private deepCloneItem(item: CollectionItem): CollectionItem {
    const clone: CollectionItem = {
      ...item,
      id: this.generateId(),
      children: item.children?.map((c) => this.deepCloneItem(c)),
    };
    if (clone.request) {
      clone.request = { ...clone.request, id: this.generateId() };
    }
    return clone;
  }

  // --- 유틸리티 ---

  private buildPickList(
    collections: Collection[]
  ): (vscode.QuickPickItem & { targetId: string; targetType: 'collection' | 'folder' })[] {
    const result: (vscode.QuickPickItem & { targetId: string; targetType: 'collection' | 'folder' })[] = [];
    for (const col of collections) {
      result.push({ label: `$(folder-library) ${col.name}`, targetId: col.id, targetType: 'collection' });
      this.addFolderPicks(col.items, col.name, result);
    }
    return result;
  }

  private addFolderPicks(
    items: CollectionItem[], prefix: string,
    result: (vscode.QuickPickItem & { targetId: string; targetType: 'collection' | 'folder' })[]
  ): void {
    for (const item of items) {
      if (item.type === 'folder') {
        result.push({ label: `$(folder) ${prefix} / ${item.name}`, targetId: item.id, targetType: 'folder' });
        this.addFolderPicks(item.children ?? [], `${prefix} / ${item.name}`, result);
      }
    }
  }

  private isInvalidDropTarget(
    collections: Collection[],
    draggedIds: string[],
    target: CollectionNode | undefined
  ): boolean {
    if (!target || target.kind === 'collection') { return false; }
    return draggedIds.some((draggedId) => {
      if (draggedId === target.item.id) { return true; }
      const draggedItem = this.findItem(collections, draggedId);
      return draggedItem ? this.itemContainsId(draggedItem, target.item.id) : false;
    });
  }

  // 폴더를 자기 자신/하위 폴더로 이동하는 경우를 차단
  private itemContainsId(item: CollectionItem, id: string): boolean {
    if (item.id === id) { return true; }
    return (item.children ?? []).some((child) => this.itemContainsId(child, id));
  }

  private findItem(collections: Collection[], id: string): CollectionItem | undefined {
    for (const col of collections) {
      const found = this.findInItems(col.items, id);
      if (found) { return found; }
    }
    return undefined;
  }

  private findInItems(items: CollectionItem[], id: string): CollectionItem | undefined {
    for (const item of items) {
      if (item.id === id) { return item; }
      if (item.children) {
        const found = this.findInItems(item.children, id);
        if (found) { return found; }
      }
    }
    return undefined;
  }

  // 항목을 찾아서 제거 후 반환
  private findAndRemove(collections: Collection[], id: string): CollectionItem | undefined {
    for (const col of collections) {
      const result = this.removeAndReturn(col.items, id);
      if (result) { return result; }
    }
    return undefined;
  }

  private removeAndReturn(items: CollectionItem[], id: string): CollectionItem | undefined {
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) { return items.splice(idx, 1)[0]; }
    for (const item of items) {
      if (item.children) {
        const result = this.removeAndReturn(item.children, id);
        if (result) { return result; }
      }
    }
    return undefined;
  }

  // 부모 리스트 찾기 (드롭 위치 계산용)
  private findParentList(collections: Collection[], id: string): CollectionItem[] | undefined {
    for (const col of collections) {
      if (col.items.some((i) => i.id === id)) { return col.items; }
      const found = this.findParentInItems(col.items, id);
      if (found) { return found; }
    }
    return undefined;
  }

  private findParentInItems(items: CollectionItem[], id: string): CollectionItem[] | undefined {
    for (const item of items) {
      if (item.children) {
        if (item.children.some((c) => c.id === id)) { return item.children; }
        const found = this.findParentInItems(item.children, id);
        if (found) { return found; }
      }
    }
    return undefined;
  }

  private removeItemById(collections: Collection[], id: string): void {
    for (const col of collections) {
      if (this.removeFromItems(col.items, id)) { return; }
    }
  }

  private removeFromItems(items: CollectionItem[], id: string): boolean {
    const idx = items.findIndex((i) => i.id === id);
    if (idx >= 0) { items.splice(idx, 1); return true; }
    for (const item of items) {
      if (item.children && this.removeFromItems(item.children, id)) { return true; }
    }
    return false;
  }

  private extractPath(url: string): string {
    try { return new URL(url).pathname; } catch { return url; }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
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
