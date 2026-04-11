import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LocalizationService } from '../services/LocalizationService';

export class GuidePanel {
  private static currentPanel: GuidePanel | undefined;
  private static readonly viewType = 'arc.guidePanel';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.render();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static show(extensionUri: vscode.Uri): void {
    if (GuidePanel.currentPanel) {
      GuidePanel.currentPanel.panel.reveal();
      GuidePanel.currentPanel.render();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      GuidePanel.viewType,
      LocalizationService.t('guide.title'),
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    GuidePanel.currentPanel = new GuidePanel(panel, extensionUri);
  }

  public static refreshCurrentPanel(extensionUri: vscode.Uri): void {
    if (!GuidePanel.currentPanel) { return; }
    GuidePanel.currentPanel.panel.title = LocalizationService.t('guide.title');
    GuidePanel.currentPanel.render();
  }

  private dispose(): void {
    GuidePanel.currentPanel = undefined;
    this.panel.dispose();
    for (const disposable of this.disposables) { disposable.dispose(); }
    this.disposables = [];
  }

  private render(): void {
    const readmePath = this.resolveReadmePath();
    let markdown = '';
    try {
      markdown = fs.readFileSync(readmePath, 'utf-8');
    } catch {
      markdown = LocalizationService.t('guide.readmeMissing');
    }

    this.panel.title = LocalizationService.t('guide.title');
    this.panel.webview.html = this.getHtml(markdown);
  }

  private resolveReadmePath(): string {
    const language = LocalizationService.getDisplayLanguage();
    const preferred = language === 'ko'
      ? path.join(this.extensionUri.fsPath, 'README.ko.md')
      : path.join(this.extensionUri.fsPath, 'README.md');
    return fs.existsSync(preferred)
      ? preferred
      : path.join(this.extensionUri.fsPath, 'README.md');
  }

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

      if (line.trimStart().startsWith('```')) {
        if (!inCodeBlock) {
          if (inList) { html += '</ul>'; inList = false; }
          if (inTable) { html += this.renderTable(tableRows); inTable = false; tableRows = []; }
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
          codeContent = '';
        } else {
          html += '<pre class="code-block"><code class="lang-' + this.esc(codeBlockLang) + '">' + this.esc(codeContent) + '</code></pre>';
          inCodeBlock = false;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        continue;
      }

      if (!line.trim()) {
        if (inList) { html += '</ul>'; inList = false; }
        if (inTable) { html += this.renderTable(tableRows); inTable = false; tableRows = []; }
        continue;
      }

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

      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        const level = headingMatch[1].length;
        const text = this.inline(headingMatch[2]);
        html += '<h' + level + '>' + text + '</h' + level + '>';
        continue;
      }

      if (line.match(/^\s*[-*]\s+/)) {
        if (!inList) { html += '<ul>'; inList = true; }
        const text = this.inline(line.replace(/^\s*[-*]\s+/, ''));
        html += '<li>' + text + '</li>';
        continue;
      }

      if (line.match(/^\s*\d+\.\s+/)) {
        if (!inList) { html += '<ul>'; inList = true; }
        const text = this.inline(line.replace(/^\s*\d+\.\s+/, ''));
        html += '<li>' + text + '</li>';
        continue;
      }

      if (!inTable) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<p>' + this.inline(line) + '</p>';
      }
    }

    if (inList) { html += '</ul>'; }
    if (inTable) { html += this.renderTable(tableRows); }
    if (inCodeBlock) {
      html += '<pre class="code-block"><code>' + this.esc(codeContent) + '</code></pre>';
    }

    return html;
  }

  private renderTable(rows: string[]): string {
    if (rows.length < 2) { return ''; }

    const parseRow = (row: string): string[] => row.split('|').slice(1, -1).map((cell) => cell.trim());

    const headerCells = parseRow(rows[0]);
    let html = '<table><thead><tr>';
    for (const cell of headerCells) {
      html += '<th>' + this.inline(cell) + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (let i = 1; i < rows.length; i++) {
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

  private inline(text: string): string {
    let result = this.esc(text);
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return result;
  }

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private getHtml(markdown: string): string {
    const body = this.renderMarkdown(markdown);
    const language = LocalizationService.getDisplayLanguage();
    return /*html*/ `<!DOCTYPE html>
<html lang="${this.esc(language)}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${this.esc(LocalizationService.t('guide.title'))}</title>
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
code{font-family:var(--vscode-editor-font-family,monospace);background:var(--vscode-textCodeBlock-background,rgba(255,255,255,.06));padding:1px 4px;border-radius:4px}
.code-block{padding:12px 14px;border-radius:10px;background:var(--vscode-textCodeBlock-background,rgba(255,255,255,.06));overflow:auto;margin:10px 0}
table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{border:1px solid var(--vscode-panel-border,#444);padding:8px 10px;text-align:left;vertical-align:top}
th{background:rgba(255,255,255,.04)}
a{color:var(--vscode-textLink-foreground)}
</style>
</head>
<body>${body}</body>
</html>`;
  }
}
