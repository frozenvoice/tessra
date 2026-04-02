import * as vscode from 'vscode';
import { RequestPanel } from './panels/RequestPanel';
import { StorageService } from './services/StorageService';
import { CollectionTreeProvider, CollectionNode } from './providers/CollectionTreeProvider';
import { HistoryTreeProvider } from './providers/HistoryTreeProvider';
import { EnvironmentTreeProvider } from './providers/EnvironmentTreeProvider';
import { HistoryEntry, Environment } from './models/types';
import { CurlService } from './services/CurlService';
import { GuidePanel } from './panels/GuidePanel';

// 확장 활성화 시 호출
export function activate(context: vscode.ExtensionContext) {
  const storage = new StorageService(context);
  const collectionProvider = new CollectionTreeProvider(storage);
  const historyProvider = new HistoryTreeProvider(storage);
  const environmentProvider = new EnvironmentTreeProvider(storage);

  // TreeView 등록 (드래그앤드롭 포함)
  const collectionTreeView = vscode.window.createTreeView('arc.collections', {
    treeDataProvider: collectionProvider,
    showCollapseAll: true,
    dragAndDropController: collectionProvider,
  });
  const historyTreeView = vscode.window.createTreeView('arc.history', {
    treeDataProvider: historyProvider,
    dragAndDropController: historyProvider,
  });
  vscode.window.createTreeView('arc.environments', {
    treeDataProvider: environmentProvider,
    dragAndDropController: environmentProvider,
  });

  // RequestPanel에 의존성 주입
  RequestPanel.storage = storage;
  RequestPanel.historyProvider = historyProvider;
  RequestPanel.collectionProvider = collectionProvider;
  RequestPanel.environmentProvider = environmentProvider;

  // === 상태바: 현재 환경 표시 ===
  const envStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  envStatusBar.command = 'arc.switchEnvironment';
  envStatusBar.tooltip = '환경 전환';
  updateStatusBar(envStatusBar, environmentProvider);
  envStatusBar.show();
  context.subscriptions.push(envStatusBar);

  // --- 커맨드 등록 ---

  // 새 요청 패널 (이미 열려 있으면 새 탭 생성)
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.newRequest', () => {
      RequestPanel.show(context.extensionUri, /* createNewTab */ !!RequestPanel.currentPanel);
    })
  );

  // 컬렉션 생성
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.createCollection', () => {
      collectionProvider.createCollection();
    })
  );

  // 폴더 생성
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.createFolder', (node: CollectionNode) => {
      collectionProvider.createFolder(node);
    })
  );

  // 이름 변경
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.rename', (node: CollectionNode) => {
      collectionProvider.rename(node);
    })
  );

  // 삭제
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.delete', (node: CollectionNode) => {
      collectionProvider.delete(node);
    })
  );

  // 요청 복제
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.duplicateRequest', (node: CollectionNode) => {
      collectionProvider.duplicate(node);
    })
  );

  // 다른 컬렉션으로 복사 저장
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.saveRequestAs', (node: CollectionNode) => {
      collectionProvider.saveAs(node);
    })
  );

  // cURL Import → 새 요청 탭으로 로드
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.importCurl', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'cURL 명령어를 붙여넣으세요',
        placeHolder: "curl -X GET 'https://api.example.com/data'",
        ignoreFocusOut: true,
      });
      if (!input) { return; }
      try {
        const req = CurlService.parse(input);
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadRequest(req);
      } catch (err: unknown) {
        vscode.window.showErrorMessage(`cURL 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  // 컬렉션 요청 → Copy as cURL
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.copyAsCurl', (node: CollectionNode) => {
      if (node.kind === 'request' && node.item.request) {
        const curl = CurlService.generate(node.item.request);
        vscode.env.clipboard.writeText(curl);
        vscode.window.showInformationMessage('cURL 명령어가 클립보드에 복사되었습니다.');
      }
    })
  );

  // JSON 파일에서 컬렉션 가져오기
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.importCollection', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        filters: { 'JSON Files': ['json'] },
        openLabel: 'Import',
      });
      if (!uris || uris.length === 0) { return; }

      let imported = 0;
      for (const uri of uris) {
        try {
          const raw = await vscode.workspace.fs.readFile(uri);
          const data = JSON.parse(Buffer.from(raw).toString('utf-8'));

          // 배열이면 여러 컬렉션, 아니면 단일 컬렉션
          const items = Array.isArray(data) ? data : [data];
          const collections = storage.getCollections();

          for (const item of items) {
            if (item.name && Array.isArray(item.items)) {
              // ID가 없으면 생성
              if (!item.id) { item.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8); }
              collections.push(item);
              imported++;
            }
          }

          storage.saveCollections(collections);
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `가져오기 실패 (${uri.fsPath}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (imported > 0) {
        collectionProvider.refresh();
        vscode.window.showInformationMessage(`${imported}개 컬렉션 가져오기 완료`);
      }
    })
  );

  // 컬렉션 모두 접기
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.collapseAll', () => {
      vscode.commands.executeCommand('workbench.actions.treeView.arc.collections.collapseAll');
    })
  );

  // === 검색 필터 ===

  // 컬렉션 검색
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.filterCollections', () => {
      const inputBox = vscode.window.createInputBox();
      inputBox.placeholder = '요청 이름, URL로 검색...';
      inputBox.value = collectionProvider.filterText;
      inputBox.title = 'Filter Collections';
      inputBox.onDidChangeValue((value) => {
        collectionProvider.filterText = value;
        collectionTreeView.description = value || undefined;
        vscode.commands.executeCommand('setContext', 'arc.collectionFilterActive', !!value);
      });
      inputBox.onDidAccept(() => inputBox.hide());
      inputBox.onDidHide(() => inputBox.dispose());
      inputBox.show();
    })
  );

  // 컬렉션 검색 초기화
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.clearCollectionFilter', () => {
      collectionProvider.filterText = '';
      collectionTreeView.description = undefined;
      vscode.commands.executeCommand('setContext', 'arc.collectionFilterActive', false);
    })
  );

  // 히스토리 검색
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.filterHistory', () => {
      const inputBox = vscode.window.createInputBox();
      inputBox.placeholder = 'URL, 메서드(GET), 상태코드(404)로 검색...';
      inputBox.value = historyProvider.filterText;
      inputBox.title = 'Filter History';
      inputBox.onDidChangeValue((value) => {
        historyProvider.filterText = value;
        historyTreeView.description = value || undefined;
        vscode.commands.executeCommand('setContext', 'arc.historyFilterActive', !!value);
      });
      inputBox.onDidAccept(() => inputBox.hide());
      inputBox.onDidHide(() => inputBox.dispose());
      inputBox.show();
    })
  );

  // 히스토리 검색 초기화
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.clearHistoryFilter', () => {
      historyProvider.filterText = '';
      historyTreeView.description = undefined;
      vscode.commands.executeCommand('setContext', 'arc.historyFilterActive', false);
    })
  );

  // 히스토리에서 요청 로드
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.loadFromHistory', (entry: HistoryEntry) => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadRequest(entry.request);
    })
  );

  // 컬렉션에서 요청 로드
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.loadFromCollection', (node: CollectionNode) => {
      if (node.kind === 'request' && node.item.request) {
        RequestPanel.show(context.extensionUri);
        RequestPanel.currentPanel?.loadRequest(node.item.request);
      }
    })
  );

  // 컬렉션 실행 (Run All Requests)
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.runCollection', (node: CollectionNode) => {
      // 컬렉션 노드 또는 폴더 노드에서 요청 목록 추출
      let items: import('./models/types').CollectionItem[] = [];
      if (node.kind === 'collection') {
        items = node.collection.items;
      } else if (node.kind === 'folder' && node.item.children) {
        items = node.item.children;
      }
      if (items.length === 0) {
        vscode.window.showInformationMessage('실행할 요청이 없습니다.');
        return;
      }
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.runCollection(node.kind === 'collection' ? node.collection.name : node.item.name, items);
    })
  );

  // 히스토리 초기화
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.clearHistory', async () => {
      const confirm = await vscode.window.showWarningMessage(
        '히스토리를 모두 삭제하시겠습니까?', { modal: true }, '삭제'
      );
      if (confirm === '삭제') {
        storage.saveHistory([]);
        historyProvider.refresh();
      }
    })
  );

  // === 환경 커맨드 ===

  // 환경 생성
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.createEnvironment', () => {
      environmentProvider.createEnvironment();
    })
  );

  // 환경 이름 변경
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.renameEnvironment', (env: Environment) => {
      environmentProvider.renameEnvironment(env);
    })
  );

  // 환경 삭제
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.deleteEnvironment', (env: Environment) => {
      environmentProvider.deleteEnvironment(env).then(() => {
        updateStatusBar(envStatusBar, environmentProvider);
        RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
      });
    })
  );

  // 환경 클릭 → 변수 편집만 (활성화 안 함)
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.editEnvironment', (env: Environment) => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadEnvironment(env);
    })
  );

  // 기본 헤더 편집
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.editDefaultHeaders', () => {
      RequestPanel.show(context.extensionUri);
      RequestPanel.currentPanel?.loadDefaultHeaders();
    })
  );

  // 환경 활성화 (우클릭 Set Active)
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.setActiveEnvironment', (env: Environment) => {
      environmentProvider.activeEnvId = env.id;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(env.name);
    })
  );

  // 환경 비활성화 (우클릭 Deactivate)
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.deactivateEnvironment', () => {
      environmentProvider.activeEnvId = null;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(null);
    })
  );

  // 환경 전환 (상태바 QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.switchEnvironment', async () => {
      const envs = storage.getEnvironments();
      const picks: (vscode.QuickPickItem & { envId: string | null })[] = [
        { label: '$(circle-slash) No Environment', envId: null },
        ...envs.map((e) => ({
          label: `$(symbol-variable) ${e.name}`,
          description: e.id === environmentProvider.activeEnvId ? '(active)' : '',
          envId: e.id,
        })),
      ];

      const selected = await vscode.window.showQuickPick(picks, { placeHolder: '환경 선택' });
      if (selected === undefined) { return; }

      environmentProvider.activeEnvId = selected.envId;
      environmentProvider.refresh();
      updateStatusBar(envStatusBar, environmentProvider);
      RequestPanel.currentPanel?.updateActiveEnv(environmentProvider.getActiveEnvironmentName());
    })
  );

  // 가이드 열기
  context.subscriptions.push(
    vscode.commands.registerCommand('arc.openGuide', () => {
      GuidePanel.show(context.extensionUri);
    })
  );

  // WebviewPanelSerializer: VS Code 재시작 시 패널 자동 복원
  vscode.window.registerWebviewPanelSerializer('arc.requestPanel', {
    async deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: unknown) {
      // 패널 옵션 재설정
      panel.webview.options = {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
      };
      RequestPanel.revive(panel, context.extensionUri);
    },
  });
}

function updateStatusBar(item: vscode.StatusBarItem, provider: EnvironmentTreeProvider): void {
  const name = provider.getActiveEnvironmentName();
  if (name) {
    item.text = `$(symbol-variable) ${name}`;
  } else {
    item.text = '$(symbol-variable) No Env';
  }
}

export function deactivate() {}
