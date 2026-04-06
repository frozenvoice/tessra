import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 가이드(README) 표시 Webview 패널
export class GuidePanel {
  private static currentPanel: GuidePanel | undefined;
  private static readonly viewType = 'arc.guidePanel';

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;

    // README.md 읽기
    const readmePath = path.join(extensionUri.fsPath, 'README.md');
    let markdown = '';
    try {
      markdown = fs.readFileSync(readmePath, 'utf-8');
    } catch {
      markdown = '# Arc Client\n\nREADME.md 파일을 찾을 수 없습니다.';
    }

    this.panel.webview.html = this.getHtml(markdown);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static show(extensionUri: vscode.Uri): void {
    if (GuidePanel.currentPanel) {
      GuidePanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      GuidePanel.viewType,
      'Arc Client Guide',
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    GuidePanel.currentPanel = new GuidePanel(panel, extensionUri);
  }

  private dispose(): void {
    GuidePanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) { d.dispose(); }
    this.disposables = [];
  }

  // 간단한 Markdown → HTML 변환
  private renderMarkdown(md: string): string {
    const lines = md.split('\n');
    let html = '';
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeContent = '';
    let inList = false;
    let inTable = false;
    let tableRows: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 코드 블록 토글
      if (line.trimStart().startsWith('```')) {
        if (!inCodeBlock) {
          // 열린 리스트/테이블 닫기
          if (inList) { html += '</ul>'; inList = false; }
          if (inTable) { html += this.renderTable(tableRows); inTable = false; tableRows = []; }
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
          codeContent = '';
        } else {
          html += '<pre class="code-block"><code class="lang-' + this.esc(codeBlockLang) + '">'
            + this.esc(codeContent) + '</code></pre>';
          inCodeBlock = false;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        continue;
      }

      // 빈 줄 → 열린 리스트/테이블 닫기
      if (!line.trim()) {
        if (inList) { html += '</ul>'; inList = false; }
        if (inTable) { html += this.renderTable(tableRows); inTable = false; tableRows = []; }
        continue;
      }

      // 테이블 행 (| ... |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!inList) {
          if (!inTable) { inTable = true; tableRows = []; }
          tableRows.push(line);
          continue;
        }
      } else if (inTable) {
        html += this.renderTable(tableRows);
        inTable = false;
        tableRows = [];
      }

      // 헤딩
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        const level = headingMatch[1].length;
        const text = this.inline(headingMatch[2]);
        html += '<h' + level + '>' + text + '</h' + level + '>';
        continue;
      }

      // 리스트 항목
      if (line.match(/^\s*[-*]\s+/)) {
        if (!inList) { html += '<ul>'; inList = true; }
        const text = this.inline(line.replace(/^\s*[-*]\s+/, ''));
        html += '<li>' + text + '</li>';
        continue;
      }

      // 숫자 리스트
      if (line.match(/^\s*\d+\.\s+/)) {
        if (!inList) { html += '<ul>'; inList = true; }
        const text = this.inline(line.replace(/^\s*\d+\.\s+/, ''));
        html += '<li>' + text + '</li>';
        continue;
      }

      // 일반 단락 (테이블이 아닌 경우)
      if (!inTable) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<p>' + this.inline(line) + '</p>';
      }
    }

    // 닫기
    if (inList) { html += '</ul>'; }
    if (inTable) { html += this.renderTable(tableRows); }
    if (inCodeBlock) {
      html += '<pre class="code-block"><code>' + this.esc(codeContent) + '</code></pre>';
    }

    return html;
  }

  // 테이블 렌더링
  private renderTable(rows: string[]): string {
    if (rows.length < 2) { return ''; }

    const parseRow = (row: string): string[] =>
      row.split('|').slice(1, -1).map((c) => c.trim());

    // 구분선(--- | ---) 행 건너뛰기
    const headerCells = parseRow(rows[0]);
    let html = '<table><thead><tr>';
    for (const cell of headerCells) {
      html += '<th>' + this.inline(cell) + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (let i = 1; i < rows.length; i++) {
      // 구분선 행 (---|---) 건너뛰기
      if (rows[i].replace(/[|\s:-]/g, '') === '') { continue; }
      const cells = parseRow(rows[i]);
      html += '<tr>';
      for (const cell of cells) {
        html += '<td>' + this.inline(cell) + '</td>';
      }
      html += '</tr>';
    }

    html += '</tbody></table>';
    return html;
  }

  // 인라인 마크다운 (볼드, 이탤릭, 코드, 링크)
  private inline(text: string): string {
    let s = this.esc(text);
    // 인라인 코드
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 볼드
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // 이탤릭
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return s;
  }

  // HTML 이스케이프
  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private getHtml(markdown: string): string {
    const body = this.renderMarkdown(markdown);
    return /*html*/ `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Arc Client Guide</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--vscode-font-family);font-size:13px;color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px 32px 60px;line-height:1.7;max-width:820px;margin:0 auto}

h1{font-size:24px;margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid var(--vscode-panel-border,#444)}
h2{font-size:18px;margin:28px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--vscode-panel-border,#333)}
h3{font-size:14px;margin:20px 0 6px}
h4{font-size:13px;margin:16px 0 4px;opacity:.85}

p{margin:6px 0}
strong{color:var(--vscode-foreground)}

ul{margin:4px 0 4px 20px;padding:0}
li{margin:2px 0}

code{font-family:var(--vscode-editor-font-family,monospace);font-size:12px;background:var(--vscode-textCodeBlock-background,rgba(255,255,255,.06));padding:1px 5px;border-radius:3px}

pre.code-block{background:var(--vscode-textCodeBlock-background,rgba(255,255,255,.06));padding:10px 14px;border-radius:5px;margin:8px 0;overflow-x:auto;line-height:1.5}
pre.code-block code{background:transparent;padding:0;font-size:11px}

table{border-collapse:collapse;margin:8px 0;width:100%;font-size:12px}
th,td{border:1px solid var(--vscode-panel-border,#444);padding:5px 10px;text-align:left}
th{background:var(--vscode-textCodeBlock-background,rgba(255,255,255,.06));font-weight:600}
tr:nth-child(even) td{background:rgba(255,255,255,.02)}
</style>
</head>
<body>
${body}
</body>
</html>`;
  }
}
