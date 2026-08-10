import * as vscode from 'vscode';
import { LocalizationService } from '../../services/LocalizationService';

export interface RequestPanelHtmlInput {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  nonce: string;
}

export function getRequestPanelHtml(input: RequestPanelHtmlInput): string {
  const { webview, extensionUri, nonce } = input;
    const hljsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'hljs.js')
    );
    const bodyConversionUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'bodyConversion.js')
    );
    const displayLanguage = LocalizationService.getDisplayLanguage();
    const requestPanelTheme = LocalizationService.getRequestPanelTheme();
    const localizedStrings = JSON.stringify(LocalizationService.getStrings(displayLanguage)).replace(/</g, '\\u003c');
    const dateLocale = LocalizationService.getDateLocale(displayLanguage);
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join('; ');
    return /*html*/ `<!DOCTYPE html>
<html lang="${displayLanguage}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<title>Tessra</title>
<style nonce="${nonce}">

pre code.hljs{display:block;overflow-x:auto;padding:0}code.hljs{padding:0}.hljs{background:transparent;color:var(--vscode-editor-foreground)}.hljs-keyword,.hljs-literal,.hljs-name,.hljs-symbol{color:var(--vscode-debugTokenExpression-name,var(--vscode-charts-blue,#569cd6))}.hljs-link{color:var(--vscode-textLink-foreground,#569cd6);text-decoration:underline}.hljs-built_in,.hljs-type{color:var(--vscode-charts-green,#4ec9b0)}.hljs-class,.hljs-number{color:var(--vscode-debugTokenExpression-number,var(--vscode-charts-green,#b8d7a3))}.hljs-meta .hljs-string,.hljs-string{color:var(--vscode-debugTokenExpression-string,var(--vscode-charts-orange,#d69d85))}.hljs-regexp,.hljs-template-tag{color:var(--vscode-debugTokenExpression-error,var(--vscode-errorForeground,#9a5334))}.hljs-formula,.hljs-function,.hljs-params,.hljs-subst,.hljs-title{color:var(--vscode-editor-foreground)}.hljs-comment,.hljs-quote{color:var(--vscode-descriptionForeground);font-style:italic}.hljs-doctag{color:var(--vscode-descriptionForeground)}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:var(--vscode-descriptionForeground)}.hljs-template-variable,.hljs-variable{color:var(--vscode-symbolIcon-variableForeground,var(--vscode-charts-purple,#bd63c5))}.hljs-attr,.hljs-attribute{color:var(--vscode-debugTokenExpression-name,var(--vscode-charts-blue,#9cdcfe))}.hljs-section{color:var(--vscode-charts-yellow,#d7ba7d)}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:var(--vscode-charts-yellow,#d7ba7d)}.hljs-addition{background-color:color-mix(in srgb,var(--vscode-charts-green,#4ec94e) 18%,transparent);display:inline-block;width:100%}.hljs-deletion{background-color:color-mix(in srgb,var(--vscode-errorForeground,#f44) 18%,transparent);display:inline-block;width:100%}
</style>
<style nonce="${nonce}">
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);display:flex;flex-direction:column;height:100vh;overflow:hidden}


.tab-bar{display:flex;background:var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background));border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;overflow-x:auto;scrollbar-width:thin}
.tab-bar::-webkit-scrollbar{height:3px}
.req-tab{position:relative;display:flex;align-items:center;gap:5px;padding:3px 10px;font-size:13px;cursor:pointer;border-right:1px solid var(--vscode-panel-border,#333);white-space:nowrap;opacity:.68;min-width:0;flex-shrink:0;user-select:none;transition:background .18s,opacity .18s;border-bottom:3px solid transparent;border-radius:0;margin-top:2px;background:transparent}
.req-tab::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:0;background:currentColor;opacity:0;transition:opacity .18s}
.req-tab:hover{opacity:.92;background:var(--vscode-list-hoverBackground,var(--vscode-toolbar-hoverBackground));transform:none}
.req-tab.active{opacity:1;background:transparent;border-bottom:3px solid var(--vscode-focusBorder);box-shadow:none}
.req-tab.active::after{opacity:0}
.method-badge{display:inline-flex;align-items:center;justify-content:center;min-width:48px;min-height:24px;padding:0 10px;border-radius:2px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;font-weight:800;font-size:11px;letter-spacing:.02em;text-transform:uppercase;line-height:1;box-shadow:none}
.req-tab .method-badge{min-width:46px}
.req-tab .tab-name{max-width:180px;overflow:hidden;text-overflow:ellipsis}
.method-GET{color:var(--tessra-method-get,#4ec94e);background:color-mix(in srgb,var(--tessra-method-get,#4ec94e) 14%,transparent);border-color:color-mix(in srgb,var(--tessra-method-get,#4ec94e) 24%,transparent)}
.method-POST{color:var(--tessra-method-post,#e5c07b);background:color-mix(in srgb,var(--tessra-method-post,#e5c07b) 14%,transparent);border-color:color-mix(in srgb,var(--tessra-method-post,#e5c07b) 24%,transparent)}
.method-PUT{color:var(--tessra-method-put,#61afef);background:color-mix(in srgb,var(--tessra-method-put,#61afef) 14%,transparent);border-color:color-mix(in srgb,var(--tessra-method-put,#61afef) 24%,transparent)}
.method-PATCH{color:var(--tessra-method-patch,#d19a66);background:color-mix(in srgb,var(--tessra-method-patch,#d19a66) 14%,transparent);border-color:color-mix(in srgb,var(--tessra-method-patch,#d19a66) 24%,transparent)}
.method-DELETE{color:var(--tessra-method-delete,#e06c75);background:color-mix(in srgb,var(--tessra-method-delete,#e06c75) 14%,transparent);border-color:color-mix(in srgb,var(--tessra-method-delete,#e06c75) 24%,transparent)}
.method-HEAD,.method-OPTIONS{color:var(--tessra-method-meta,#abb2bf);background:color-mix(in srgb,var(--tessra-method-meta,#abb2bf) 14%,transparent);border-color:color-mix(in srgb,var(--tessra-method-meta,#abb2bf) 22%,transparent)}
.method-WS{color:var(--tessra-method-ws,#4ec9b0);background:color-mix(in srgb,var(--tessra-method-ws,#4ec9b0) 14%,transparent);border-color:color-mix(in srgb,var(--tessra-method-ws,#4ec9b0) 26%,transparent)}
.req-tab.active.tab-GET{border-bottom-color:var(--tessra-method-get,#4ec94e);box-shadow:none}
.req-tab.active.tab-POST{border-bottom-color:var(--tessra-method-post,#e5c07b);box-shadow:none}
.req-tab.active.tab-PUT{border-bottom-color:var(--tessra-method-put,#61afef);box-shadow:none}
.req-tab.active.tab-PATCH{border-bottom-color:var(--tessra-method-patch,#d19a66);box-shadow:none}
.req-tab.active.tab-DELETE{border-bottom-color:var(--tessra-method-delete,#e06c75);box-shadow:none}
.req-tab.active.tab-HEAD{border-bottom-color:var(--tessra-method-meta,#abb2bf);box-shadow:none}
.req-tab.active.tab-OPTIONS{border-bottom-color:var(--tessra-method-meta,#abb2bf);box-shadow:none}
.req-tab.active.tab-WS{border-bottom-color:var(--tessra-method-ws,#4ec9b0);box-shadow:none}
.req-tab .close-tab{opacity:.5;cursor:pointer;font-size:13px;padding:0 2px;line-height:1;background:transparent;border:0;color:inherit;font:inherit}
.req-tab .close-tab:hover{opacity:1;color:var(--vscode-errorForeground)}
.req-tab.pinned{opacity:.85;border-left:2px solid var(--vscode-focusBorder)}
.req-tab.pinned .close-tab{display:none}
.req-tab.pinned .pin-icon{display:inline;font-size:13px;margin-right:2px}
.req-tab .pin-icon{display:none}
.req-tab .dirty-dot{color:var(--vscode-foreground,#ccc);font-size:10px;margin-left:3px;opacity:.85}
.dirty-confirm-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(5,8,14,.55);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center}
.dirty-confirm-dialog{background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-panel-border,#444);border-radius:6px;padding:20px 24px;min-width:340px;box-shadow:0 4px 24px rgba(0,0,0,.5)}
.dirty-confirm-msg{font-size:14px;margin-bottom:16px;line-height:1.5}
.dirty-confirm-actions{display:flex;gap:8px;justify-content:flex-end}
.dirty-btn{padding:5px 14px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-family:inherit}
.dirty-btn-save{background:var(--vscode-button-background,#0078d4);color:var(--vscode-button-foreground,#fff)}
.dirty-btn-save:hover{background:var(--vscode-button-hoverBackground,#026ec1)}
.dirty-btn-discard{background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-panel-border,#444)}
.dirty-btn-discard:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
.dirty-btn-cancel{background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-panel-border,#444)}
.dirty-btn-cancel:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
/* Body type conversion — VS Code-native compact confirm (no card/gradient/glow) */
.body-convert-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center}
.body-convert-dialog{background:var(--vscode-editorWidget-background,var(--vscode-editor-background,#1e1e1e));color:var(--vscode-editorWidget-foreground,var(--vscode-foreground));border:1px solid var(--vscode-editorWidget-border,var(--vscode-panel-border,#444));border-radius:2px;padding:12px 14px;min-width:280px;max-width:420px;box-shadow:0 2px 8px rgba(0,0,0,.36)}
.body-convert-title{font-size:13px;font-weight:600;line-height:1.35;margin:0 0 6px}
.body-convert-sub{font-size:12px;line-height:1.4;color:var(--vscode-descriptionForeground);margin:0 0 12px}
.body-convert-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.body-convert-actions .dirty-btn{padding:3px 10px;border-radius:2px;font-size:12px;min-height:24px}
.compare-settings-dialog{min-width:520px;max-width:640px}
.compare-settings-grid{display:flex;flex-direction:column;gap:12px}
.compare-settings-row{display:flex;flex-direction:column;gap:6px}
.compare-settings-row label{font-size:12px;opacity:.9}
.compare-settings-input{width:100%;padding:6px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:4px;font-size:13px}
.compare-settings-note{font-size:12px;opacity:.65;line-height:1.5}
.compare-mode-options{display:flex;gap:8px;flex-wrap:wrap}
.compare-mode-chip{padding:4px 8px;border:1px solid var(--vscode-input-border,#555);border-radius:3px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:12px}
.compare-mode-chip.active{border-color:var(--vscode-charts-blue,#3794ff);color:var(--vscode-charts-blue,#3794ff);background:rgba(55,148,255,.12)}
.add-tab{padding:4px 10px;cursor:pointer;opacity:.5;font-size:14px;display:flex;align-items:center;background:transparent;border:0;color:inherit;font-family:inherit}
.add-tab:hover{opacity:1}
.tab-ctx-menu{position:fixed;z-index:9999;background:var(--vscode-menu-background,#252526);border:1px solid var(--vscode-menu-border,#454545);border-radius:4px;padding:4px 0;min-width:160px;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:13px}
.tab-ctx-menu .ctx-item{padding:4px 16px;cursor:pointer;color:var(--vscode-menu-foreground,#ccc)}
.tab-ctx-menu .ctx-item:hover{background:var(--vscode-menu-selectionBackground,#094771);color:var(--vscode-menu-selectionForeground,#fff)}
.tab-ctx-menu .ctx-item.disabled{opacity:.4;cursor:default;pointer-events:none}
.tab-ctx-menu .ctx-sep{height:1px;margin:4px 8px;background:var(--vscode-menu-separatorBackground,#454545)}


.main-content{flex:1;overflow:hidden;display:flex;flex-direction:column}


/* Quiet Instrument — status / URL / Send chrome */
.status-strip{display:flex;flex-direction:column;flex-shrink:0;padding:2px 8px;border-bottom:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:var(--tessra-surface-tint,var(--vscode-editor-background));min-height:22px;container-type:inline-size;container-name:status-strip;--strip-env-fg:var(--tessra-brand-fg,var(--vscode-foreground));--strip-env-border:var(--tessra-brand-border,color-mix(in srgb,var(--tessra-accent,var(--vscode-focusBorder,#007acc)) 50%,transparent));--strip-env-bg:var(--tessra-brand-soft,color-mix(in srgb,var(--tessra-accent,var(--vscode-focusBorder,#007acc)) 9%,transparent));--strip-active-cue:var(--tessra-tone-info,#61afef);--strip-warn:var(--vscode-editorWarning-foreground,var(--tessra-tone-warning,#d19a66));--strip-warn-border:color-mix(in srgb,var(--strip-warn) 55%,transparent);--strip-warn-bg:color-mix(in srgb,var(--strip-warn) 12%,transparent);--strip-info:var(--tessra-strip-info,var(--vscode-descriptionForeground,#8e8e8e));--strip-info-num:var(--tessra-strip-info-num,var(--vscode-foreground))}
.status-strip-line{display:flex;align-items:center;gap:4px;min-height:18px;min-width:0}
.status-strip-segments{display:flex;align-items:center;flex-wrap:nowrap;gap:0;min-width:0;flex:1;overflow:hidden;font-size:11px;font-weight:400;line-height:1.2;letter-spacing:0;color:var(--strip-info)}
.status-strip-seg{display:inline-flex;align-items:center;gap:3px;min-width:0;max-width:220px;min-height:18px;padding:0 3px;border:1px solid transparent;border-radius:2px;background:transparent;color:inherit;font:inherit;font-weight:400;letter-spacing:0;cursor:default;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:1}
.status-strip-seg.clickable{cursor:pointer}
.status-strip-seg.clickable:hover{color:var(--vscode-foreground);background:var(--vscode-toolbar-hoverBackground,rgba(90,93,94,.22))}
.tessra-mark{display:inline-block;flex-shrink:0;width:10px;height:10px;color:var(--tessra-brand,var(--tessra-accent,var(--vscode-focusBorder,#007acc)));opacity:.88;vertical-align:-0.05em}
.tessra-mark--strip{width:9px;height:9px}
.tessra-mark--empty{width:14px;height:14px;opacity:.26;margin-bottom:4px}
.status-strip-seg.is-env .tessra-mark,.status-strip-seg.is-warn .tessra-mark{opacity:.92}
/* Tier 1 — Environment: soft brand chip (rect, not pill); first scan hit on strip */
.status-strip-seg.is-env{flex-shrink:0;max-width:min(40%,180px);padding:0 5px;border-radius:3px;font-weight:600;letter-spacing:.01em;color:var(--strip-env-fg);border-color:var(--strip-env-border);background:var(--strip-env-bg)}
/* Tier 2 — Active behavior: cue + weight; muted info cue (never response success green) */
.status-strip-seg.is-on{flex-shrink:0;font-weight:500;letter-spacing:0;color:var(--vscode-foreground)}
.status-strip-seg.is-on .status-strip-cue{color:var(--strip-active-cue);opacity:1}
/* Tier 3 — Informational counts: muted label, slightly brighter number, no boxes */
.status-strip-seg.is-info{font-weight:400;letter-spacing:0;color:var(--strip-info)}
.status-strip-seg.is-info .status-strip-num{color:var(--strip-info-num);font-weight:500}
/* Tier 4 — Risk / non-default: clear semantic; never quiet away */
.status-strip-seg.is-off{flex-shrink:0;font-weight:600;letter-spacing:0;color:var(--strip-warn)}
.status-strip-seg.is-off .status-strip-cue{color:var(--strip-warn);opacity:1}
.status-strip-seg.is-warn{flex-shrink:0;padding:0 4px;border-radius:3px;font-weight:600;letter-spacing:0;color:var(--strip-warn);border-color:var(--strip-warn-border);background:var(--strip-warn-bg)}
.status-strip-seg.is-warn .status-strip-cue,.status-strip-seg.warning .status-strip-cue{color:var(--strip-warn);opacity:1}
.status-strip-seg.is-muted{opacity:.7;font-weight:400}
.status-strip-seg.warning{color:var(--strip-warn);font-weight:600}
.status-strip-seg.muted{opacity:.7}
.status-strip-seg[data-priority="critical"],.status-strip-seg[data-priority="high"]{flex-shrink:0}
.status-strip-seg[data-priority="medium"]{flex-shrink:1;min-width:0}
.status-strip-seg[data-priority="low"]{flex-shrink:2;min-width:0;max-width:9em}
.status-strip-cue{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:.85em;min-width:9px;font-size:9px;line-height:1;font-weight:700;opacity:.9}
.status-strip-label{min-width:0;overflow:hidden;text-overflow:ellipsis}
.status-strip-num{font-variant-numeric:tabular-nums}
.status-strip-sep{flex-shrink:0;opacity:.28;padding:0 3px;user-select:none;color:var(--strip-info);font-weight:400;line-height:1}
.status-strip-seg.is-env + .status-strip-sep{opacity:.4;padding-left:4px}
.status-strip-toggle{flex-shrink:0;border:none;background:transparent;color:var(--vscode-descriptionForeground);cursor:pointer;padding:0 2px;font-size:11px;line-height:1;border-radius:2px;min-height:18px;min-width:18px}
.status-strip-toggle:hover{color:var(--vscode-foreground);background:var(--vscode-toolbar-hoverBackground,rgba(90,93,94,.22))}
.status-strip-toggle:focus-visible{outline:1px solid var(--vscode-focusBorder)}
.status-strip-panel{padding:4px 0 6px;border-top:1px solid var(--vscode-panel-border,#444);display:flex;flex-direction:column;gap:4px}
.status-strip-panel.hidden{display:none}
/* Narrow: Used/env-count (low) → Defaults/other info (medium); Env disclosure + risk + Scripts/History stay */
.status-strip-env-count{font-weight:500;opacity:.85;white-space:nowrap}
@container status-strip (max-width: 480px){
  .status-strip-seg[data-priority="low"]{display:none}
  .status-strip-env-count{display:none}
}
@container status-strip (max-width: 360px){
  .status-strip-seg[data-priority="medium"]{display:none}
}
.status-strip-detail-block{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:flex-start;font-size:12px;color:var(--vscode-descriptionForeground)}
.status-strip-detail-block.warning{color:var(--vscode-editorWarning-foreground,#d19a66)}
.status-strip-detail-title{font-size:11px;font-weight:600;letter-spacing:.01em;width:100%}
.status-strip-detail-copy{font-size:12px;line-height:1.35;word-break:break-word;font-family:var(--vscode-editor-font-family,monospace)}
.status-strip-link{border:none;background:transparent;color:var(--vscode-textLink-foreground,#3794ff);cursor:pointer;font:inherit;padding:0;text-align:left;border-radius:2px}
.status-strip-link:hover{text-decoration:underline}
.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.request-topline{display:none}
.request-stage{display:none}
.request-topline-right{display:none}
.request-status-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.request-status-chip,
.preflight-pill{display:inline-flex;align-items:center;gap:4px;min-height:20px;padding:1px 6px;border-radius:2px;font-size:11px;border:1px solid var(--vscode-panel-border,#444);background:transparent;color:var(--vscode-descriptionForeground);white-space:nowrap;font-family:inherit;appearance:none}
.request-status-chip.clickable,
.preflight-pill.clickable{cursor:pointer}
.request-status-chip.info,
.preflight-pill.info{color:var(--vscode-charts-blue,#61afef);border-color:rgba(97,175,239,.35)}
.request-status-chip.warning,
.preflight-pill.warning{color:var(--vscode-editorWarning-foreground,#d19a66);border-color:rgba(209,154,102,.35)}
.preflight-pill.accent{color:var(--tessra-method-ws,#4ec9b0);border-color:color-mix(in srgb,var(--tessra-method-ws,#4ec9b0) 35%,transparent)}
.request-status-chip.muted{opacity:.78}
.linked-focus-active{outline:1px solid var(--vscode-focusBorder);outline-offset:1px}
.settings-toggle.linked-focus-active,.script-card.linked-focus-active,.script-help-line.linked-focus-active,.default-headers-banner.linked-focus-active,.env-editor.linked-focus-active,.status-strip-detail-block.linked-focus-active{border-color:var(--vscode-focusBorder)}
.request-status-chip .env-label{opacity:.75;margin-right:4px}
.request-status-chip .env-name{color:var(--vscode-debugTokenExpression-name,var(--vscode-symbolIcon-variableForeground))}
.request-preflight{display:flex;flex-direction:column;gap:4px;padding:0;flex:0 1 auto;min-width:0}
.request-preflight-pills{display:flex;flex-wrap:wrap;gap:4px}
.request-info-row{display:none}
.preflight-pill.muted{opacity:.78}
.preflight-warning{padding:8px;border-radius:3px;border:1px solid color-mix(in srgb,var(--vscode-editorWarning-foreground,#d19a66) 25%,transparent);background:transparent;display:flex;flex-direction:column;gap:6px}
.preflight-warning-title{font-size:11px;font-weight:600;color:var(--vscode-editorWarning-foreground,#d19a66)}
.preflight-warning-copy{font-size:12px;line-height:1.45;color:var(--vscode-foreground);word-break:break-word}
.preflight-warning-actions{display:flex;flex-wrap:wrap;gap:6px}
.ghost-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:4px 8px;border-radius:3px;border:1px solid var(--vscode-panel-border,#444);background:transparent;color:var(--vscode-foreground);font-size:12px;cursor:pointer;min-height:28px}
.ghost-btn:hover{background:var(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))}
.url-bar{display:flex;flex-wrap:nowrap;gap:6px;padding:4px 8px;flex-shrink:0;align-items:center;position:relative;overflow:visible;border-bottom:1px solid var(--vscode-panel-border,#444)}
.url-primary-group{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto}
.url-bar select{width:100px;height:28px;padding:0 8px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:13px;font-weight:600}
.url-bar input{flex:1;height:28px;padding:0 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace)}
.url-bar input:focus{outline:1px solid var(--vscode-focusBorder)}
.url-input-wrap{position:relative;flex:1 1 200px;min-width:120px;display:flex}
.url-input-wrap input{flex:1;width:100%}
.url-hero-actions{display:flex;align-items:stretch;justify-content:flex-end;flex:0 0 auto}
.url-action-group{display:flex;align-items:center;justify-content:flex-end;min-width:0;flex:0 0 auto}
.url-secondary-group,.url-overflow-wrap{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:nowrap;padding:0;border:none;background:transparent}
.url-action-group > *,
.url-hero-actions > *,
.url-secondary-group > *,
.url-overflow-wrap > *{flex-shrink:0}
.url-secondary-btn{min-height:28px;padding:0 8px;border-radius:3px;gap:6px;font-size:13px;background:transparent}
.url-secondary-btn .action-label{white-space:nowrap}
.var-overlay{position:absolute;top:0;left:0;right:0;bottom:0;padding:6px 8px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace);pointer-events:none;white-space:nowrap;overflow:hidden;color:transparent}
.var-preview-popover{position:fixed;z-index:150;padding:8px 10px;max-width:360px;border-radius:4px;border:1px solid var(--vscode-panel-border,#444);background:var(--vscode-editorWidget-background,var(--vscode-editor-background));box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:12px;line-height:1.45;pointer-events:none}
.var-preview-popover.hidden{display:none}
.var-preview-title{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground,#a8a8a8);margin-bottom:4px}
.var-preview-line{display:flex;gap:8px;align-items:flex-start}
.var-preview-name{color:var(--vscode-debugTokenExpression-name,var(--vscode-symbolIcon-variableForeground));font-family:var(--vscode-editor-font-family,monospace);white-space:nowrap}
.var-preview-value{color:var(--vscode-foreground);word-break:break-word}
.var-preview-value.missing{color:var(--vscode-errorForeground,#f48771)}
.var-autocomplete{position:fixed;z-index:170;min-width:260px;max-width:420px;padding:6px;border-radius:4px;border:1px solid var(--vscode-panel-border,#444);background:var(--vscode-editorWidget-background,var(--vscode-editor-background));box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:12px;line-height:1.4}
.var-autocomplete.hidden{display:none}
.var-autocomplete-title{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground,#a8a8a8);padding:4px 6px}
.var-autocomplete-list{display:flex;flex-direction:column;gap:2px}
.var-autocomplete-item{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;width:100%;padding:6px 8px;border:none;border-radius:3px;background:transparent;color:var(--vscode-foreground);cursor:pointer;text-align:left;font:inherit}
.var-autocomplete-item:hover,.var-autocomplete-item.active{background:var(--vscode-list-hoverBackground)}
.var-autocomplete-key{font-family:var(--vscode-editor-font-family,monospace);color:var(--vscode-debugTokenExpression-name,var(--vscode-symbolIcon-variableForeground));white-space:nowrap}
.var-autocomplete-value{max-width:220px;color:var(--vscode-descriptionForeground,#c8c8c8);word-break:break-word}
.var-autocomplete-empty{padding:8px;border-radius:3px;color:var(--vscode-descriptionForeground,#c8c8c8)}
.unresolved-var{text-decoration:wavy underline var(--vscode-errorForeground,#e06c75);text-decoration-skip-ink:none;color:transparent}
.btn{padding:4px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;font-size:13px;font-weight:600;cursor:pointer;min-height:28px}
.btn:hover{background:var(--vscode-button-hoverBackground)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-s{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-s:hover{background:var(--vscode-button-secondaryHoverBackground)}
.btn-send{position:relative;display:inline-flex;align-items:center;gap:8px;padding:4px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;font-size:13px;font-weight:600;cursor:pointer;min-height:28px;flex-shrink:0}
.btn-send:hover{background:var(--vscode-button-hoverBackground)}
.btn-send svg{flex-shrink:0}
.btn-send-labels{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1}
.btn-send-primary{font-size:13px;font-weight:600}
.btn-send-secondary{font-size:10px;font-weight:400;opacity:.75;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn-stop .btn-send-labels{flex-direction:row;align-items:center;gap:7px}
.btn-stop .btn-send-secondary{line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px}
.btn-send.state-success,
.btn-send.state-error,
.btn-send.state-canceled,
.btn-send.state-ready{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.btn-send.state-success:hover,
.btn-send.state-error:hover,
.btn-send.state-canceled:hover,
.btn-send.state-ready:hover{background:var(--vscode-button-hoverBackground)}
.btn-keyhint{padding:1px 4px;border-radius:2px;background:var(--vscode-keybindingLabel-background,var(--vscode-badge-background));color:var(--vscode-keybindingLabel-foreground,var(--vscode-badge-foreground));font-size:10px;line-height:1}
.btn-send .send-streak{display:none}
.btn-stop{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;background:var(--vscode-inputValidation-errorBackground,#5a1d1d);color:var(--vscode-errorForeground,#f48771);border:1px solid var(--vscode-inputValidation-errorBorder,#be1100);border-radius:3px;font-size:13px;font-weight:600;cursor:pointer;min-height:28px;flex-shrink:0;box-shadow:none}
.btn-stop:hover{filter:brightness(1.08)}
.btn-stop .stop-icon{display:inline-block;width:10px;height:10px;background:currentColor;border-radius:1px}


.tabs{display:flex;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;padding:0 10px;gap:4px;flex-wrap:wrap}
.tab{position:relative;padding:4px 10px;cursor:pointer;border-bottom:none;opacity:.54;font-size:12px;user-select:none;letter-spacing:normal;transition:opacity .15s,background .15s,color .15s;border-radius:2px 2px 0 0}
.tab::after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2px;border-radius:0;background:var(--vscode-focusBorder,#007acc);opacity:0;transform:scaleX(.56);transform-origin:center;transition:transform .15s ease,opacity .15s ease}
.tab:hover{opacity:.82;background:var(--vscode-list-hoverBackground,var(--vscode-toolbar-hoverBackground));transform:none}
.tab.active{opacity:1;background:transparent;color:var(--vscode-foreground)}
.tab.active::after{opacity:1;transform:scaleX(1)}
.tab.active.collapsed{opacity:.8}
.tab.active.collapsed::after{opacity:.35;transform:scaleX(.62)}


.split{flex:1;overflow:hidden;display:flex;flex-direction:column}
.req-area{flex:1 1 0;min-height:0;overflow:hidden;padding:2px 8px;display:flex;flex-direction:column}
.req-area.is-collapsed{flex:0 0 auto}
.request-editor-panel:not(.hidden){flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto}
.divider{height:8px;background:transparent;flex-shrink:0;cursor:row-resize;position:relative;z-index:10;border:none;display:flex;align-items:center;justify-content:center}
.divider::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;transform:translateY(-50%);background:var(--vscode-panel-border,#444)}
.divider-grip{position:relative;z-index:1;display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:2px;border:1px solid var(--vscode-panel-border,#444);background:var(--vscode-editor-background);box-shadow:none}
.divider-grip span{width:3px;height:3px;border-radius:1px;background:var(--vscode-descriptionForeground,#888);box-shadow:none}
.divider:hover .divider-grip,.divider.active .divider-grip{border-color:var(--vscode-focusBorder);background:var(--vscode-list-hoverBackground,rgba(255,255,255,.04))}
.res-area{flex:1 1 0;min-height:0;overflow:auto;display:flex;flex-direction:column;padding:0 10px}
.res-response-shell{display:flex;flex-direction:column;flex:1;min-height:0}
.res-empty-shell{flex:1;min-height:0;overflow:auto;padding:8px 0 12px}
.ws-console{display:flex;flex-direction:column;gap:8px;min-height:100%;padding:8px 0 12px}
.ws-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 8px;border:none;border-bottom:1px solid var(--vscode-panel-border,#444);border-radius:0;background:transparent;box-shadow:none}
.ws-summary-main{display:flex;align-items:center;gap:8px;min-width:0}
.ws-status-dot{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:none;flex-shrink:0}
.ws-status-open{color:#4ec94e}.ws-status-connecting{color:#7dc8ff}.ws-status-error{color:#ff7a7a}.ws-status-closed{color:var(--vscode-descriptionForeground,#9a9a9a)}
.ws-status-label{font-weight:600;font-size:12px;letter-spacing:0;text-transform:none}
.ws-summary-note{font-size:12px;color:var(--vscode-descriptionForeground,#aaa);line-height:1.4;text-align:right}
.ws-log{display:flex;flex-direction:column;gap:0;min-height:0}
.ws-message{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;padding:6px 0;border:none;border-bottom:1px solid var(--vscode-panel-border,#444);border-radius:0;background:transparent;box-shadow:none}
.ws-message.out,.ws-message.in{border-color:var(--vscode-panel-border,#444);background:transparent}
.ws-message.system{border-style:solid;color:var(--vscode-descriptionForeground,#aaa)}
.ws-message-meta{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:56px}
.ws-direction{font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;font-family:var(--vscode-editor-font-family,monospace)}
.ws-message.out .ws-direction{color:#61afef}
.ws-message.in .ws-direction{color:#4ec9b0}
.ws-message.system .ws-direction{color:var(--vscode-descriptionForeground,#aaa)}
.ws-time{font-size:11px;color:var(--vscode-descriptionForeground,#999)}
.ws-payload{min-width:0;white-space:pre-wrap;word-break:break-word;font-family:var(--vscode-editor-font-family,monospace);font-size:12px;line-height:1.45}
.ws-empty{padding:12px 0;border:none;border-radius:0;background:transparent;color:var(--vscode-descriptionForeground,#aaa);text-align:left;line-height:1.45}
.res-preview{width:100%;flex:1;min-height:0;overflow:auto;background:#fff;color:#111}
.preview-shell{max-width:1080px;margin:0 auto;padding:24px}
.preview-kicker{font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;color:#6a6f77;margin-bottom:8px}
.preview-title{font-size:28px;font-weight:800;line-height:1.2;margin:0 0 10px}
.preview-copy{font-size:14px;line-height:1.65;color:#4b5563;margin:0 0 18px}
.preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:18px}
.preview-card{padding:14px 16px;border:1px solid #d9dde3;border-radius:14px;background:#f8fafc}
.preview-card-label{font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;color:#6a6f77;margin-bottom:6px}
.preview-card-value{font-size:13px;line-height:1.55;color:#111;word-break:break-word}
.preview-card-value.muted{color:#6b7280}
.preview-section{margin-top:20px}
.preview-section-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:#6a6f77;margin-bottom:8px}
.preview-empty{padding:16px;border:1px dashed #c8cdd4;border-radius:14px;background:#f8fafc;color:#6b7280}
.preview-snapshot{padding:18px;border:1px solid #d9dde3;border-radius:14px;background:#fff;overflow:auto}
.preview-snapshot img{max-width:100%;height:auto}
.preview-snapshot table{border-collapse:collapse;max-width:100%}
.preview-snapshot th,.preview-snapshot td{border:1px solid #d9dde3;padding:6px 8px;vertical-align:top}
.preview-snapshot pre{white-space:pre-wrap;word-break:break-word}
.preview-snapshot code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}

/* KV ??*/
.kv-section{padding:3px 0}
.kv-row{display:flex;gap:3px;margin-bottom:2px;align-items:center}
.kv-row input[type="checkbox"]{width:14px;height:14px;accent-color:var(--vscode-focusBorder)}
.kv-row input[type="text"],.kv-row input[type="password"]{flex:1;padding:3px 5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace)}
.kv-row .rm{background:transparent;border:none;color:var(--vscode-errorForeground,#f44);cursor:pointer;font-size:13px;padding:0 3px;line-height:1}
.add-btn{background:transparent;border:none;color:var(--vscode-textLink-foreground,#3794ff);padding:4px 2px;border-radius:4px;cursor:pointer;font-size:13px;opacity:.7;margin-top:4px}
.add-btn:disabled{opacity:.4;cursor:not-allowed;text-decoration:none}
.auto-badge{font-size:13px;opacity:.4;white-space:nowrap;margin-left:2px;user-select:none}
.add-btn:hover{opacity:1;text-decoration:underline}
.add-btn:disabled:hover{opacity:.4;text-decoration:none}

/* Body */
.body-type-select{padding:3px 5px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:13px;margin-bottom:4px}
.body-editor{position:relative;width:100%;flex:1;min-height:70px;min-width:0}
.body-section textarea,.body-highlight{width:100%;min-height:70px;padding:5px;border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-family:var(--vscode-editor-font-family,monospace);font-size:13px;line-height:1.4;tab-size:4;white-space:pre-wrap;overflow-wrap:break-word;word-wrap:break-word;box-sizing:border-box}
.body-section textarea{position:relative;z-index:1;flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);resize:none;overflow:auto;caret-color:var(--vscode-editorCursor-foreground,var(--vscode-editor-foreground))}
.body-highlight{position:absolute;inset:0;z-index:0;margin:0;overflow:hidden;pointer-events:none;background:var(--vscode-input-background);color:var(--vscode-input-foreground)}
.body-highlight code{display:block;font:inherit;color:inherit;background:transparent;padding:0;margin:0;white-space:inherit;overflow-wrap:inherit;word-wrap:inherit;tab-size:inherit;line-height:inherit}
.body-editor.is-syntax-highlight .js-body{color:transparent;-webkit-text-fill-color:transparent;background:transparent;caret-color:var(--vscode-editorCursor-foreground,var(--vscode-editor-foreground))}
.body-editor.is-syntax-highlight .js-body::placeholder{color:var(--vscode-input-placeholderForeground,#999);-webkit-text-fill-color:var(--vscode-input-placeholderForeground,#999)}
.body-editor.is-syntax-highlight .js-body::selection{background:var(--vscode-editor-selectionBackground,rgba(87,166,255,.35));color:transparent;-webkit-text-fill-color:transparent}
.body-editor:not(.is-syntax-highlight) .body-highlight{visibility:hidden}
.body-highlight .hljs-attr{color:var(--tessra-json-key,var(--vscode-debugTokenExpression-name))}
.body-highlight .hljs-string{color:var(--tessra-json-str,var(--vscode-debugTokenExpression-string))}
.body-highlight .hljs-number{color:var(--tessra-json-num,var(--vscode-debugTokenExpression-number))}
.body-highlight .hljs-literal{color:var(--tessra-json-bool,var(--vscode-debugTokenExpression-boolean))}
.body-type-select{flex-shrink:0}

/* Auth */
.auth-section{padding:3px 0}
.auth-section select{padding:3px 5px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:13px;margin-bottom:4px}
.auth-section .auth-fields{display:flex;flex-direction:column;gap:3px}
.auth-section .auth-fields input,.auth-section .auth-fields select{padding:3px 5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:13px}
.auth-row{display:flex;gap:4px;align-items:center}
.auth-row label{font-size:13px;opacity:.6;min-width:55px}


.settings-section{padding:8px 0}
.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0}
.settings-card{position:relative;overflow:visible;padding:8px 0;border-radius:0;border:none;border-bottom:1px solid var(--vscode-panel-border,#444);background:transparent;box-shadow:none}
.settings-card::before{display:none}
.settings-card:hover{transform:none;border-color:var(--vscode-panel-border,#444);box-shadow:none}
.settings-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.settings-label{font-size:13px;opacity:.8;min-width:80px;font-weight:600}
.settings-input{width:80px;padding:4px 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace)}
.settings-input.settings-text-input{width:min(220px,100%)}
.settings-input:focus{outline:1px solid var(--vscode-focusBorder)}
.settings-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.settings-hint{font-size:13px;opacity:.4}
.settings-group{padding:0}
.settings-group + .settings-group{border-top:none;margin-top:0}
.settings-group-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--tessra-label-accent,var(--vscode-descriptionForeground));margin:0 0 6px}
.settings-group-note{font-size:12px;line-height:1.45;color:var(--vscode-descriptionForeground,#a6aebe);margin:0 0 8px}
.settings-toggle-grid{display:grid;grid-template-columns:1fr;gap:2px}
.settings-toggle{position:relative;display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.45;padding:6px 0;border-radius:0;border:none;background:transparent;box-shadow:none;transition:none}
.settings-toggle::before{display:none}
.settings-toggle:hover{transform:none;border:none;background:transparent;box-shadow:none}
.settings-toggle input{margin:2px 0 0}
.settings-toggle > span{display:flex;flex-direction:column;gap:2px}
.settings-row.multi-line{align-items:flex-start;flex-direction:column;gap:4px}
.settings-row.risk-warning,.settings-toggle.risk-warning{border:none;background:transparent}
.settings-row.risk-muted,.settings-toggle.risk-muted{border:none;background:transparent}
.settings-row.risk-warning .settings-label,.settings-toggle.risk-warning > span{color:#f1cf8a}
.settings-select{width:140px}
.settings-inline-note{display:block;font-size:12px;color:var(--vscode-descriptionForeground,#989898);margin-left:22px}
.settings-field-meta{display:flex;flex-direction:column;gap:2px}
.settings-field-meta .settings-hint{font-size:12px}


.env-editor{padding:6px 10px;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;background:var(--vscode-editor-background)}
.env-editor.hidden{display:none}
.env-editor-title{font-size:12px;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;color:var(--vscode-descriptionForeground)}
.env-editor-name{font-size:12px;font-weight:500;color:var(--vscode-foreground)}
.env-editor-name.muted{color:var(--vscode-descriptionForeground,#a8a8a8)}
.env-editor-body{padding-top:2px}
.env-editor-title .rm{background:transparent;border:0;color:inherit;font:inherit;padding:0 3px}
.env-var-count{font-size:12px;font-weight:500;color:var(--vscode-descriptionForeground,#a8a8a8);white-space:nowrap}
.env-autosave-indicator{font-size:12px;color:var(--vscode-charts-green,#4ec94e);opacity:0;transition:opacity .3s;display:flex;align-items:center;gap:3px}
.env-autosave-indicator.show{opacity:1}
.env-dirty-dot{width:6px;height:6px;border-radius:50%;background:var(--vscode-editorWarning-foreground,#cca700);display:none}
.env-dirty-dot.show{display:inline-block}


.response-summary{display:flex;flex-direction:column;gap:8px;padding-top:0}
.res-sticky-shell{position:sticky;top:0;z-index:4;background:linear-gradient(180deg,var(--vscode-editor-background) 0%,var(--vscode-editor-background) 88%,rgba(0,0,0,0) 100%);padding-top:0}
.response-summary-card{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:2px 0;border:none;background:transparent;box-shadow:none;border-radius:0;flex-wrap:nowrap;min-width:0}
.response-stat-inline{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--vscode-foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.response-stat-inline .stat-sep{opacity:.3;font-weight:500;padding:0 2px}
.response-stat-inline .stat-status.status-2xx{color:var(--tessra-status-2xx,#4ec94e)}
.response-stat-inline .stat-status.status-3xx{color:var(--tessra-status-3xx,#d19a66)}
.response-stat-inline .stat-status.status-4xx,
.response-stat-inline .stat-status.status-5xx{color:var(--tessra-status-error,#e06c75)}
.response-action-cluster{display:flex;align-items:center;justify-content:flex-end;gap:3px;flex-wrap:nowrap;flex:0 0 auto}
.response-action-cluster .res-action-btn,
.response-action-cluster .pin-response-btn,
.response-action-cluster .compare-btn{min-height:24px;padding:2px 6px;border-radius:4px;font-size:13px;gap:3px}
.response-action-cluster .res-action-btn .action-label,
.response-action-cluster .pin-response-btn .action-label,
.response-action-cluster .compare-btn .action-label{display:none}
.actions-more-wrap{position:relative;display:inline-flex}
.actions-more-menu{display:none;position:absolute;top:calc(100% + 4px);right:0;z-index:120;background:var(--vscode-dropdown-background,#252526);border:1px solid var(--vscode-dropdown-border,#555);border-radius:6px;padding:4px 0;min-width:180px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.42)}
.actions-more-menu.open{display:block}
.actions-more-menu .res-action-btn,
.actions-more-menu .pin-response-btn,
.actions-more-menu .compare-btn{display:flex;width:100%;justify-content:flex-start;padding:5px 12px;border:none;border-radius:0;background:transparent;min-height:26px;box-shadow:none;gap:8px;font-size:13px}
.actions-more-menu .res-action-btn:hover:not(:disabled),
.actions-more-menu .pin-response-btn:hover,
.actions-more-menu .compare-btn:hover:not(:disabled){background:var(--vscode-list-hoverBackground,rgba(255,255,255,.08));transform:none;border:none;box-shadow:none}
.actions-more-menu .res-action-btn .action-label,
.actions-more-menu .pin-response-btn .action-label,
.actions-more-menu .compare-btn .action-label{display:inline}
.response-context-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.response-timing-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;margin-top:-2px;padding:0 2px 2px;color:var(--vscode-descriptionForeground,#8f99a6);font-size:12px;line-height:1.45;font-family:var(--vscode-editor-font-family,monospace);font-variant-numeric:tabular-nums;letter-spacing:.01em;user-select:text}
.response-timing-row .timing-flow{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.response-timing-row .timing-value{white-space:nowrap}
.response-timing-row .timing-prefix{font-family:var(--vscode-font-family,sans-serif);font-size:11px;font-weight:600;letter-spacing:.02em;color:inherit;opacity:.88}
.response-timing-row .timing-arrow{font-family:var(--vscode-font-family,sans-serif);opacity:.62}
.compare-chip-row{display:flex;flex-wrap:wrap;gap:8px}
.meta-stat{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:2px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);font-variant-numeric:tabular-nums}
.meta-lang{font-size:11px;opacity:.72;text-transform:none;letter-spacing:0}
.compare-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:2px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);font-size:12px;color:var(--vscode-descriptionForeground,#a6a6a6)}
.compare-chip strong{color:var(--vscode-foreground)}
.compare-chip.current{border-color:rgba(78,201,78,.28);color:#93e493;background:rgba(78,201,78,.08)}
.compare-chip.ready{border-color:rgba(87,166,255,.24);color:#93c8ff;background:rgba(87,166,255,.08)}
.compare-chip.mode{border-color:rgba(209,154,102,.22);color:#f0c995;background:rgba(209,154,102,.08)}
.res-action-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1px solid var(--vscode-input-border,#555);border-radius:6px;background:transparent;color:var(--vscode-foreground);font-size:13px;cursor:pointer;transition:background .15s,transform .1s;user-select:none}
.res-action-btn:hover{background:var(--vscode-button-secondaryHoverBackground,rgba(255,255,255,.1));transform:scale(1.05)}
.res-action-btn:active{transform:scale(.92)}
.res-action-btn:disabled{opacity:.35;cursor:default;transform:none}
.res-action-btn:disabled:hover{background:transparent;transform:none}
.res-action-btn svg{flex-shrink:0;color:var(--vscode-foreground)}
.status{font-weight:700;padding:1px 6px;border-radius:2px}
.status-2xx{background:color-mix(in srgb,var(--tessra-status-2xx,#4ec94e) 16%,transparent);color:var(--tessra-status-2xx,#4ec94e)}
.status-3xx{background:color-mix(in srgb,var(--tessra-status-3xx,#d19a66) 16%,transparent);color:var(--tessra-status-3xx,#d19a66)}
.status-4xx{background:color-mix(in srgb,var(--tessra-status-error,#e06c75) 16%,transparent);color:var(--tessra-status-error,#e06c75)}
.status-5xx{background:color-mix(in srgb,var(--tessra-status-error,#e06c75) 18%,transparent);color:var(--tessra-status-error,#e06c75)}

.resolved-url{display:block;max-width:100%;padding:2px 0;font-size:12px;color:var(--vscode-descriptionForeground);background:transparent;border:none;border-radius:0;cursor:text;user-select:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--vscode-editor-font-family,monospace);flex-shrink:1}
.resolved-url:hover{text-decoration:underline;opacity:.85}
.resolved-url.copied{color:#4ec94e}
.resolved-headers-section{margin-bottom:4px}
.resolved-headers-title{font-size:12px;font-weight:600;color:var(--vscode-descriptionForeground,#888);text-transform:none;letter-spacing:0;padding:1px 0;margin-bottom:2px}
.res-header-table{width:100%;border-collapse:separate;border-spacing:0 2px;font-family:var(--vscode-editor-font-family,monospace);font-size:13px}
.res-header-table thead th{text-align:left;padding:3px 12px 4px;font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground,#97a0ae);text-transform:none;letter-spacing:0;border-bottom:1px solid var(--vscode-panel-border,#444);position:sticky;top:0;background:var(--vscode-editor-background)}
.res-header-table tbody tr:hover td{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}
.res-header-table td{padding:3px 12px;vertical-align:top;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.018));border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}
.res-header-table td:first-child{border-left:1px solid rgba(255,255,255,.06);border-radius:5px 0 0 5px}
.res-header-table td:last-child{border-right:1px solid rgba(255,255,255,.06);border-radius:0 5px 5px 0}
.res-header-key-col{width:200px}
.res-header-key{font-weight:700;color:var(--vscode-foreground);white-space:nowrap}
.res-header-value{color:var(--vscode-descriptionForeground,#c1c7d0);white-space:normal;word-break:break-word}
.res-header-value:hover{overflow:visible}
.res-headers-panel{overflow:auto;flex:1;min-height:0;padding:3px 0 8px}
.res-cookies-panel{overflow:auto;flex:1;min-height:0;padding:3px 0 8px}
.res-cookie-table th,.res-cookie-table td{font-size:13px;padding:3px 6px}
.cookie-badge{display:inline-block;background:var(--vscode-badge-background,#4d4d4d);color:var(--vscode-badge-foreground,#ccc);font-size:13px;padding:0 4px;border-radius:3px;font-weight:600}
.tab-count{display:inline-block;background:var(--vscode-badge-background,#4d4d4d);color:var(--vscode-badge-foreground,#ccc);font-size:13px;padding:0 5px;border-radius:8px;margin-left:3px;min-width:14px;text-align:center;line-height:15px;vertical-align:middle}
.test-summary{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.test-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:2px;border:1px solid rgba(255,255,255,.08);font-size:12px}
.test-badge.pass{background:rgba(78,201,78,.08);border-color:rgba(78,201,78,.18);color:#93e493}
.test-badge.fail{background:rgba(255,122,122,.08);border-color:rgba(255,122,122,.18);color:#ffb3b3}
.test-badge.log{background:rgba(87,166,255,.08);border-color:rgba(87,166,255,.16);color:#93c8ff}
.test-alert{margin-bottom:10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
.test-alert.fail{border-color:rgba(255,122,122,.2);background:rgba(255,122,122,.08)}
.test-alert.pass{border-color:rgba(78,201,78,.18);background:rgba(78,201,78,.08)}
.test-alert-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;margin-bottom:6px}
.test-alert-copy{font-size:12px;line-height:1.55;color:var(--vscode-foreground)}
.test-row-fail .res-header-key,.test-row-fail .res-header-value{color:#ffb3b3}
.test-row-pass .res-header-key,.test-row-pass .res-header-value{color:inherit}


.pin-response-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1px solid var(--vscode-input-border,#555);border-radius:6px;background:transparent;color:var(--vscode-foreground);font-size:13px;cursor:pointer;transition:background .15s,transform .1s;user-select:none}
.pin-response-btn:hover{background:var(--vscode-button-secondaryHoverBackground,rgba(255,255,255,.1));transform:scale(1.05)}
.pin-response-btn:active{transform:scale(.92)}
.pin-response-btn.pinned{border-color:var(--vscode-charts-green,#4ec94e);color:var(--vscode-charts-green,#4ec94e)}
.compare-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1px solid var(--vscode-input-border,#555);border-radius:6px;background:transparent;color:var(--vscode-foreground);font-size:13px;cursor:pointer;transition:background .15s,transform .1s;user-select:none}
.compare-btn:hover:not(:disabled){background:var(--vscode-button-secondaryHoverBackground,rgba(255,255,255,.1));transform:scale(1.05)}
.compare-btn:active:not(:disabled){transform:scale(.92)}
.compare-btn:disabled{opacity:.35;cursor:default;transform:none}
.compare-btn.ready{border-color:var(--vscode-charts-blue,#3794ff);color:var(--vscode-charts-blue,#3794ff)}

.res-ctx-menu{position:fixed;z-index:9999;min-width:200px;background:var(--vscode-menu-background,#252526);color:var(--vscode-menu-foreground,#ccc);border:1px solid var(--vscode-menu-border,#454545);border-radius:5px;padding:4px 0;box-shadow:0 4px 16px rgba(0,0,0,.4);font-size:13px}
.res-ctx-menu .ctx-item{padding:6px 16px;cursor:pointer;display:flex;align-items:center;gap:8px}
.res-ctx-menu .ctx-item:hover{background:var(--vscode-menu-selectionBackground,#094771)}
.res-ctx-menu .ctx-item.disabled{opacity:.35;cursor:default}
.res-ctx-menu .ctx-item.disabled:hover{background:transparent}
.res-ctx-menu .ctx-sep{height:1px;margin:4px 0;background:var(--vscode-menu-separatorBackground,#454545)}

.json-body{background:var(--vscode-editor-background);padding:8px 10px;border-radius:2px;border:1px solid var(--vscode-panel-border,#444);font-family:var(--vscode-editor-font-family,monospace);font-size:13px;white-space:pre-wrap;word-break:break-word;overflow:auto;flex:1;min-height:0;line-height:1.3;box-shadow:none}
.json-key{color:var(--tessra-json-key,var(--vscode-debugTokenExpression-name))}.json-str{color:var(--tessra-json-str,var(--vscode-debugTokenExpression-string))}.json-num{color:var(--tessra-json-num,var(--vscode-debugTokenExpression-number))}.json-bool{color:var(--tessra-json-bool,var(--vscode-debugTokenExpression-boolean))}.json-null{color:var(--tessra-json-null,var(--vscode-debugTokenExpression-boolean))}


.res-body-toolbar{display:flex;align-items:center;gap:6px;padding:4px 0 2px;flex-shrink:0;flex-wrap:wrap}
.res-body-toolbar .toggle-group{display:flex;border:1px solid var(--vscode-input-border,#555);border-radius:3px;overflow:hidden;margin-right:4px;background:transparent}
.res-body-toolbar .toggle-btn{padding:5px 10px;font-size:12px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:none;opacity:.62;user-select:none;letter-spacing:0;text-transform:none}
.res-body-toolbar .toggle-btn:hover{opacity:.85}
.res-body-toolbar .toggle-btn.active{opacity:1;background:var(--vscode-button-secondaryBackground)}
.res-body-toolbar .tb-btn{position:relative;overflow:hidden;padding:4px 8px;font-size:12px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-input-border,#555);border-radius:3px;opacity:.8}
.res-body-toolbar .tb-btn:hover{opacity:1}
.res-body-toolbar .tb-btn:active{transform:scale(.92)}
.response-search-wrap{margin-left:auto;display:flex;align-items:center;gap:4px;min-width:0;max-width:420px;flex:1;justify-content:flex-end}
.response-search-input{width:180px;max-width:100%;padding:7px 10px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,#555);border-radius:2px;font-size:13px}
.response-search-input:focus{outline:1px solid var(--vscode-focusBorder)}
.response-search-count{min-width:54px;text-align:center;font-size:12px;color:var(--vscode-descriptionForeground,#a6a6a6);font-variant-numeric:tabular-nums}
.response-search-wrap .tb-btn.active{opacity:1;background:rgba(87,166,255,.14);border-color:rgba(87,166,255,.24)}
.kv-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.bulk-editor{display:flex;flex-direction:column;gap:8px;margin-bottom:10px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}
.bulk-editor-label{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;opacity:.82}
.bulk-editor-input{min-height:90px;padding:8px 10px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:8px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace);resize:vertical}
.bulk-editor-actions{display:flex;gap:8px;justify-content:flex-end}
.kv-reveal,.auth-reveal{margin-left:6px;min-width:34px}
.runner-live-status{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border,#333);display:flex;flex-direction:column;gap:4px;background:transparent}
.runner-live-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;opacity:.75}
.runner-live-copy{font-size:12px;line-height:1.5;color:var(--vscode-descriptionForeground,#a6a6a6)}
.runner-row.active{background:color-mix(in srgb,var(--tessra-accent,#57a6ff) 10%,transparent);border-left:2px solid color-mix(in srgb,var(--tessra-accent,#57a6ff) 60%,transparent)}
.response-search-hit{background:rgba(255,215,0,.22);color:inherit;border-radius:2px;padding:0 1px}
.response-search-hit.active{background:rgba(255,165,0,.42);box-shadow:0 0 0 1px rgba(255,165,0,.4)}
.formdata-summary{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.formdata-summary .meta-stat{font-size:12px}
.formdata-row{align-items:flex-start;flex-wrap:wrap;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);margin-bottom:8px;gap:8px}
.formdata-row.is-file{border-color:rgba(87,166,255,.18);background:rgba(87,166,255,.04)}
.formdata-kind{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:4px 8px;border-radius:2px;font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;background:transparent;border:1px solid var(--vscode-panel-border,#444);color:var(--vscode-descriptionForeground,#c0c0c0)}
.formdata-row.is-file .formdata-kind{background:rgba(87,166,255,.12);color:#93c8ff}
.formdata-meta{display:flex;flex-wrap:wrap;gap:6px;width:100%;padding-left:26px}
.formdata-file-chip{display:inline-flex;align-items:center;padding:4px 8px;border-radius:2px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:12px;color:var(--vscode-descriptionForeground,#c2c2c2)}
.formdata-file-chip.hidden{display:none}


.json-tree{background:var(--vscode-editor-background);padding:8px 10px;border-radius:2px;border:1px solid var(--vscode-panel-border,#444);font-family:var(--vscode-editor-font-family,monospace);font-size:13px;overflow:auto;flex:1;min-height:0;line-height:1.3;user-select:text;box-shadow:none}
.jt-node{padding-left:16px}
.jt-row{display:flex;align-items:baseline;white-space:nowrap;gap:6px;padding:2px 8px;border-radius:10px;transition:background .12s ease}
.jt-row[data-copy-path]{cursor:pointer}
.jt-row:hover{background:rgba(255,255,255,.04)}
.copy-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);z-index:9999;padding:8px 14px;border-radius:8px;background:rgba(20,24,31,.96);border:1px solid rgba(87,166,255,.35);color:var(--vscode-foreground);font-size:13px;font-family:var(--vscode-editor-font-family,monospace);box-shadow:0 12px 28px rgba(0,0,0,.4),0 0 0 1px rgba(87,166,255,.12);pointer-events:none;opacity:0;transition:opacity .18s ease,transform .18s ease;max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.copy-toast.visible{opacity:1;transform:translateX(-50%) translateY(0)}
.jt-toggle{display:inline-block;width:14px;cursor:pointer;text-align:center;color:var(--vscode-foreground);opacity:.5;flex-shrink:0;user-select:none}
.jt-toggle:hover{opacity:1}
.jt-copy-path{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:2px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:var(--vscode-descriptionForeground,#bdbdbd);font-size:10px;letter-spacing:.02em;cursor:pointer;opacity:0;transition:opacity .12s ease,transform .12s ease;border:none}
.jt-row:hover .jt-copy-path,.jt-copy-path:focus{opacity:1}
.jt-copy-path:hover{transform:none;background:rgba(87,166,255,.12);color:#93c8ff}
.jt-key{color:#9cdcfe;margin-right:4px}
.jt-str{color:#ce9178}.jt-num{color:#b5cea8}.jt-bool{color:#569cd6}.jt-null{color:#569cd6}
.jt-brace{color:var(--vscode-foreground);opacity:.6}
.jt-children{overflow:hidden}
.jt-children.collapsed{display:none}
.xml-path-body{font-family:var(--vscode-editor-font-family,monospace);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.018));padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.08);overflow:auto;line-height:1.3;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.xml-path-line{display:block;position:relative;padding:1px 54px 1px 10px;border-radius:4px;white-space:pre;cursor:pointer;transition:background .12s ease}
.xml-path-line:hover{background:rgba(87,166,255,.08)}
.xml-path-copy{position:absolute;right:0;top:0;padding:0 8px;border:none;background:transparent;color:var(--vscode-descriptionForeground,#bdbdbd);cursor:pointer;opacity:0;font-size:11px}
.xml-path-line:hover .xml-path-copy,.xml-path-copy:focus{opacity:1}
.xml-path-copy:hover{color:#93c8ff}
.response-path-hint{display:inline-flex;align-items:center;padding:0 6px;border-radius:2px;border:1px solid rgba(255,255,255,.08);font-size:11px;color:var(--vscode-descriptionForeground,#a5a5a5)}


.fmt-wrap{position:relative;display:inline-block}
.fmt-menu{display:none;position:absolute;top:100%;left:0;z-index:100;background:var(--vscode-dropdown-background,#252526);border:1px solid var(--vscode-dropdown-border,#555);border-radius:3px;padding:4px 0;min-width:170px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.fmt-menu.open{display:block}
.fmt-menu-label{padding:2px 10px;opacity:.5;font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;user-select:none}
.fmt-menu-item{padding:3px 10px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px}
.fmt-menu-item:hover{background:var(--vscode-list-hoverBackground)}
.fmt-menu-item .check{width:12px;text-align:center;opacity:.7}
.fmt-menu-sep{border-top:1px solid var(--vscode-input-border,#555);margin:3px 0}
.jt-ellipsis{color:var(--vscode-foreground);opacity:.4;cursor:pointer}
.jt-comma{opacity:.4}

.error-msg{color:var(--vscode-errorForeground,#f44);padding:6px;font-size:13px}
.hidden{display:none!important}
.spinner{display:inline-block;width:11px;height:11px;border:2px solid var(--vscode-foreground);border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:4px}
@keyframes spin{to{transform:rotate(360deg)}}


.ripple-btn{position:relative;overflow:hidden;transition:transform .05s ease}
.ripple-btn .ripple-circle{position:absolute;border-radius:50%;background:rgba(255,255,255,.4);transform:scale(0);animation:ripple-expand .35s ease-out forwards;pointer-events:none}
@keyframes ripple-expand{0%{transform:scale(0);opacity:1}100%{transform:scale(5);opacity:0}}

.ripple-btn.btn-flash{background:rgba(255,255,255,.25)!important}

.ripple-btn.btn-bouncing{animation:none}

@keyframes send-click{
  0%{opacity:.85}
  100%{opacity:1}
}
.send-click{animation:send-click .15s ease-out forwards!important;transition:none!important}
.send-click-flash{background:var(--vscode-button-hoverBackground)!important}


.bullet-progress{height:3px;width:100%;background:color-mix(in srgb,var(--vscode-foreground) 8%,transparent);overflow:hidden;flex-shrink:0;position:relative;opacity:0;transition:opacity .15s}
.bullet-progress.active{opacity:1}
@keyframes bullet-run{
  0%{left:-60px}
  100%{left:100%}
}
.bullet-progress .bullet-glow{position:absolute;top:0;height:100%;width:60px;background:linear-gradient(90deg,transparent,rgba(77,166,255,.55) 40%,transparent);border-radius:2px;animation:bullet-run 1.2s linear infinite;box-shadow:none}

@keyframes bullet-finish{
  0%{left:var(--pos);opacity:1}
  100%{left:100%;opacity:0}
}
.bullet-progress.finishing .bullet-glow{animation:bullet-finish .2s ease-out forwards}
.bullet-progress.finishing{transition:opacity .15s .2s;opacity:0}



@keyframes stop-slam{
  0%{opacity:.8}
  100%{opacity:1}
}
.btn-stop.stop-slam{animation:stop-slam .15s ease-out forwards!important;transition:none!important}
.btn-stop.stop-flash{filter:brightness(1.1)!important}

@keyframes stop-vignette{0%{opacity:.22}100%{opacity:0}}
.stop-vignette-flash{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:9999;background:radial-gradient(ellipse at center,transparent 40%,rgba(255,40,40,.35) 100%);animation:stop-vignette .25s ease-out forwards}


@keyframes icon-fade-in{0%{opacity:0}100%{opacity:1}}
.btn-stop .stop-icon{animation:icon-fade-in .2s ease}
.btn-send svg{animation:icon-fade-in .2s ease}


.btn-send .send-streak{display:none}

.btn-feedback{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);white-space:nowrap;font-size:12px;font-weight:700;opacity:0;pointer-events:none;transition:opacity .15s}
.btn-feedback.show{opacity:1}



@keyframes url-sweep{0%{background-position:-100% 0}100%{background-position:200% 0}}
.url-input-wrap.sweep::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;border-radius:3px;pointer-events:none;background:linear-gradient(90deg,transparent 0%,rgba(0,122,204,.25) 40%,rgba(0,122,204,.45) 50%,rgba(0,122,204,.25) 60%,transparent 100%);background-size:50% 100%;background-repeat:no-repeat;animation:url-sweep .3s ease forwards}


.url-bar input.neon-active{border-color:var(--vscode-focusBorder);outline:1px solid var(--vscode-focusBorder)}


@keyframes btn-slide-in{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
.btn-sending{pointer-events:auto;position:relative;min-width:58px;animation:btn-slide-in .2s ease}
.btn-sending .spinner{width:10px;height:10px;border-width:1.5px;margin-right:3px}


.status.flash-success{outline:1px solid #4ec94e}
.status.flash-error{outline:1px solid #e06c75}
.screen-flash{display:none}
@keyframes res-fade{0%{opacity:.6}100%{opacity:1}}
.res-area.slide-in{animation:res-fade .15s ease-out}




@keyframes perfect-pop{0%{opacity:0;transform:scale(.5)}30%{opacity:1;transform:scale(1.1)}60%{transform:scale(.95)}100%{opacity:0;transform:scale(1)}}
.perfect-badge{position:absolute;top:-18px;right:0;font-size:9px;font-weight:800;color:#4ec94e;letter-spacing:1px;pointer-events:none;animation:perfect-pop .8s ease forwards;text-shadow:0 0 6px rgba(78,201,78,.5)}


.elapsed-timer{font-size:13px;opacity:.6;margin-left:4px;font-variant-numeric:tabular-nums}

.placeholder{display:flex;align-items:center;justify-content:center;flex:1;opacity:.25;font-size:13px}
.empty-state{display:flex;flex-direction:column;justify-content:center;gap:8px;min-height:120px;padding:16px 12px;border:none;border-radius:0;background:transparent;box-shadow:none}
.empty-state.inline{min-height:auto;padding:12px 0}
.empty-state-title{font-size:13px;font-weight:600;line-height:1.3;max-width:720px}
.empty-state-copy{font-size:13px;line-height:1.45;color:var(--vscode-descriptionForeground,#a0a0a0);max-width:720px}
.empty-state-actions{display:flex;flex-wrap:wrap;gap:8px}
.empty-state-action{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:3px;border:1px solid var(--vscode-panel-border,#444);background:transparent;color:var(--vscode-foreground);font-size:12px;font-weight:600;cursor:pointer;box-shadow:none}
.empty-state-action.primary{background:var(--vscode-button-background);border-color:transparent;color:var(--vscode-button-foreground)}
.empty-state-action:hover{background:var(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground))}
.request-change-summary{display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px}
.request-change-summary.empty{display:none}
.request-change-summary-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.request-change-summary-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--vscode-descriptionForeground,#9a9a9a)}
.request-change-summary-copy{font-size:12px;color:var(--vscode-descriptionForeground,#a4a4a4)}
.request-change-chip-row{display:flex;flex-wrap:wrap;gap:8px}
.request-change-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:2px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;font-size:12px;color:var(--vscode-foreground)}
.request-change-chip.clickable{cursor:pointer;transition:background .12s ease,border-color .12s ease}
.request-change-chip.clickable:hover{transform:none;background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
.request-change-chip .delta-label{opacity:.72}
.request-change-chip .delta-value{font-weight:700}
.var-usage{display:flex;align-items:center;gap:6px;padding:0;flex-wrap:wrap}
.var-usage.hidden{display:none}
.var-usage-head{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.var-usage-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--vscode-descriptionForeground,#9a9a9a)}
.var-usage-copy{display:inline-flex;align-items:center;padding:2px 8px;border-radius:2px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));font-size:11px;color:var(--vscode-descriptionForeground,#a0a0a0);background:transparent}
.var-usage-grid{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.var-usage-card{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:2px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;min-width:0;max-width:100%}
.var-usage-name{font-size:12px;font-weight:700;color:var(--vscode-debugTokenExpression-name,var(--vscode-symbolIcon-variableForeground));font-family:var(--vscode-editor-font-family,monospace);margin-bottom:0;white-space:nowrap}
.var-usage-scopes{display:inline-flex;flex-wrap:wrap;gap:4px}
.var-usage-scope{display:inline-flex;align-items:center;padding:1px 5px;border-radius:2px;font-size:10px;background:color-mix(in srgb,var(--tessra-accent,#57a6ff) 10%,transparent);color:var(--tessra-tone-info,var(--vscode-charts-blue,#93c8ff));border:1px solid color-mix(in srgb,var(--tessra-accent,#57a6ff) 16%,transparent)}


@keyframes skeleton-pulse{0%{opacity:.15}50%{opacity:.3}100%{opacity:.15}}
.skeleton-loader{padding:12px 10px;display:flex;flex-direction:column;gap:8px}
.skeleton-line{height:14px;border-radius:4px;background:var(--vscode-foreground,#ccc);animation:skeleton-pulse 1.2s ease-in-out infinite}
.skeleton-line:nth-child(1){width:85%}
.skeleton-line:nth-child(2){width:70%;animation-delay:.15s}
.skeleton-line:nth-child(3){width:55%;animation-delay:.3s}
.skeleton-line:nth-child(4){width:40%;animation-delay:.45s}


.empty-tab-hint{display:flex;align-items:center;justify-content:center;flex:1;color:var(--vscode-descriptionForeground,#888);font-size:13px;opacity:.5;text-align:center;padding:20px;user-select:none}
.script-editor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.script-help-line{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-height:22px;margin:0 0 8px;padding:0;border:none;background:transparent}
.script-help-line-copy{font-size:12px;font-weight:500;line-height:1.4;color:var(--vscode-descriptionForeground);min-width:0}
.script-help-line-link{border:none;background:transparent;color:var(--vscode-textLink-foreground,var(--vscode-charts-blue,#3794ff));font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:0;text-decoration:none;white-space:nowrap;border-radius:2px}
.script-help-line-link:hover{text-decoration:underline;color:var(--vscode-textLink-activeForeground,var(--vscode-charts-blue,#3794ff))}
.script-card{position:relative;overflow:hidden;padding:8px 0;border-radius:0;border:none;border-bottom:1px solid var(--vscode-panel-border,#444);background:transparent;box-shadow:none}
.script-card:last-child{border-bottom:none}
.script-card::before{display:none}
.script-card:hover{transform:none;border-color:var(--vscode-panel-border,#444);box-shadow:none}
.script-card-label{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--tessra-label-accent,var(--vscode-descriptionForeground));margin-bottom:4px}
.script-card-note{font-size:12px;line-height:1.45;color:var(--vscode-descriptionForeground,#a6aebe);margin-bottom:6px}
.script-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.script-card textarea{min-height:140px;padding:8px 10px;border-radius:2px;border:1px solid var(--vscode-input-border,transparent);background:var(--vscode-input-background);box-shadow:none}
.default-headers-banner{display:flex;flex-direction:column;gap:4px;padding:4px 0;border-radius:0;border:none;background:transparent;margin-bottom:6px}
.default-headers-banner.active{border-color:transparent;background:transparent}
.default-headers-banner.warning{border-color:transparent;background:transparent}
.default-headers-banner-main{display:flex;flex-direction:column;gap:4px;min-width:0}
.default-headers-banner-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;opacity:.85}
.default-headers-banner-copy{font-size:12px;font-weight:500;line-height:1.4}
.default-headers-banner-note{font-size:12px;line-height:1.45;color:var(--vscode-descriptionForeground,#989898)}
.default-headers-key-group{display:flex;flex-direction:column;gap:4px;margin-top:4px}
.default-headers-key-label{font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;opacity:.75}
.default-headers-key-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.default-header-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:2px;background:transparent;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));font-size:12px;font-family:var(--vscode-editor-font-family,monospace)}
.default-header-chip.override{border-color:color-mix(in srgb,var(--vscode-editorWarning-foreground,#d19a66) 24%,transparent);background:color-mix(in srgb,var(--vscode-editorWarning-foreground,#d19a66) 10%,transparent);color:var(--vscode-editorWarning-foreground,#d19a66)}


.runner-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--vscode-editor-background);z-index:100;display:flex;flex-direction:column;overflow:hidden}
.runner-header{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border,#444);display:flex;align-items:center;gap:8px;flex-shrink:0}
.runner-header h3{font-size:13px;font-weight:600;flex:1;margin:0}
.runner-options{padding:12px;border-bottom:1px solid var(--vscode-panel-border,#444);display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end;flex-shrink:0}
.runner-option{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--vscode-descriptionForeground,#a6a6a6)}
.runner-option input[type="number"]{width:100%}
.runner-option-check{flex-direction:row;align-items:center;color:var(--vscode-foreground,#ddd);padding-bottom:4px}
.runner-request-select{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border,#444);display:flex;flex-direction:column;gap:6px;flex:0 1 auto;min-height:0;max-height:min(42vh,280px)}
.runner-request-select-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.runner-request-select-title{font-size:12px;font-weight:600;color:var(--vscode-foreground)}
.runner-request-select-count{font-size:12px;color:var(--vscode-descriptionForeground,#a6a6a6);font-variant-numeric:tabular-nums}
.runner-request-select-actions{display:flex;align-items:center;gap:8px}
.runner-request-select-actions button{appearance:none;border:none;background:transparent;color:var(--vscode-textLink-foreground);font:inherit;font-size:12px;padding:2px 0;cursor:pointer;border-radius:2px}
.runner-request-select-actions button:hover{text-decoration:underline}
.runner-request-select-actions button:focus-visible{outline:1px solid var(--vscode-focusBorder,#007acc);outline-offset:2px}
.runner-request-list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:1px;border:1px solid var(--vscode-panel-border,#444);border-radius:2px;padding:2px;background:transparent}
.runner-request-row{display:flex;align-items:flex-start;gap:8px;padding:5px 6px;border-radius:2px;cursor:pointer;color:var(--vscode-foreground)}
.runner-request-row:hover{background:var(--vscode-list-hoverBackground)}
.runner-request-row:focus-within{outline:1px solid var(--vscode-focusBorder,#007acc);outline-offset:-1px}
.runner-request-row input[type="checkbox"]{margin:2px 0 0;flex-shrink:0}
.runner-request-meta{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
.runner-request-line{display:flex;align-items:center;gap:8px;min-width:0}
.runner-request-line .method-badge{min-width:48px;flex-shrink:0}
.runner-request-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.runner-request-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--vscode-descriptionForeground,#a6a6a6)}
.runner-select-hint{font-size:12px;line-height:1.4;color:var(--vscode-editorWarning-foreground,#d19a66);min-height:1.2em}
.runner-progress{padding:4px 12px;font-size:13px;opacity:.7;flex-shrink:0;display:flex;align-items:center;gap:6px}
.runner-bar{flex:1;height:3px;background:var(--vscode-input-background);border-radius:2px;overflow:hidden}
.runner-bar-fill{height:100%;width:100%;transform:scaleX(0);transform-origin:left center;background:var(--vscode-progressBar-background,#0e70c0);transition:transform .2s ease-out}
.runner-summary{padding:6px 12px;font-size:13px;border-bottom:1px solid var(--vscode-panel-border,#444);flex-shrink:0;display:flex;gap:12px;flex-wrap:wrap}
.runner-summary .pass{color:#4ec94e}.runner-summary .fail{color:#e06c75}.runner-summary .skip{color:#d7ba7d}
.runner-list{flex:1;overflow:auto;font-size:13px}
.runner-row{position:relative;padding:8px 12px 8px 16px;display:flex;align-items:center;gap:8px;cursor:pointer;border-bottom:1px solid var(--vscode-panel-border,#222);background:transparent;transition:background .12s ease}
.runner-row::before{content:"";position:absolute;left:8px;top:10px;bottom:10px;width:3px;border-radius:2px;background:transparent;opacity:.9}
.runner-row:hover{background:var(--vscode-list-hoverBackground);transform:none}
.runner-row .rr-idx{opacity:.4;width:20px;text-align:right}
.runner-row .rr-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.runner-row .rr-status{font-weight:700;min-width:44px}
.runner-row .rr-time{opacity:.5;min-width:40px;text-align:right}
.runner-row .rr-icon{font-size:13px}
.runner-row .method-badge{min-width:52px}
.runner-row.pass .rr-status{color:#4ec94e}.runner-row.fail .rr-status{color:#e06c75}.runner-row.pending{opacity:.35}
.runner-row.method-GET::before{background:linear-gradient(180deg,rgba(78,201,78,.8),rgba(78,201,78,.18))}
.runner-row.method-POST::before{background:linear-gradient(180deg,rgba(229,192,123,.8),rgba(229,192,123,.18))}
.runner-row.method-PUT::before{background:linear-gradient(180deg,rgba(97,175,239,.8),rgba(97,175,239,.18))}
.runner-row.method-PATCH::before{background:linear-gradient(180deg,rgba(209,154,102,.8),rgba(209,154,102,.18))}
.runner-row.method-DELETE::before{background:linear-gradient(180deg,rgba(224,108,117,.8),rgba(224,108,117,.18))}
.runner-row.method-HEAD::before,.runner-row.method-OPTIONS::before{background:linear-gradient(180deg,rgba(171,178,191,.78),rgba(171,178,191,.18))}
.runner-detail{padding:6px 12px;background:var(--vscode-input-background);border-bottom:1px solid var(--vscode-panel-border,#333);font-family:var(--vscode-editor-font-family,monospace);font-size:13px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow:auto}


.env-indicator{font-size:13px;opacity:.6;padding:0 10px 2px;flex-shrink:0}
.env-indicator .var-name{color:var(--vscode-debugTokenExpression-name,var(--vscode-symbolIcon-variableForeground))}
:root{
  --tessra-surface-tint:var(--vscode-editor-background);
  --tessra-surface-1:transparent;
  --tessra-surface-2:color-mix(in srgb,var(--vscode-foreground) 3%,transparent);
  --tessra-surface-3:color-mix(in srgb,var(--vscode-foreground) 5%,transparent);
  --tessra-border-soft:var(--vscode-panel-border,#444);
  --tessra-border-strong:var(--vscode-panel-border,#555);
  --tessra-shadow-sm:none;
  --tessra-shadow-lg:none;
  --tessra-glow-blue:transparent;
  --tessra-glow-mint:transparent;
  /* Tessra signature: icon blue→violet DNA, host charts blend (light/dark safe) */
  --tessra-brand-blue:var(--vscode-charts-blue,#3794ff);
  --tessra-brand-violet:var(--vscode-charts-purple,#b180d7);
  --tessra-brand:color-mix(in srgb,var(--tessra-brand-violet) 46%,var(--tessra-brand-blue));
  --tessra-brand-fg:color-mix(in srgb,var(--tessra-brand) 42%,var(--vscode-foreground));
  --tessra-brand-soft:color-mix(in srgb,var(--tessra-brand) 9%,transparent);
  --tessra-brand-border:color-mix(in srgb,var(--tessra-brand) 48%,transparent);
  --tessra-accent:var(--tessra-brand);
  --tessra-label-accent:var(--vscode-descriptionForeground);
  --tessra-strip-info:var(--vscode-descriptionForeground,#8e8e8e);
  --tessra-strip-info-num:var(--vscode-foreground);
  --tessra-tone-info:#61afef;
  --tessra-tone-info-bg:transparent;
  --tessra-tone-warning:#d19a66;
  --tessra-tone-warning-bg:transparent;
  --tessra-tone-success:#4ec94e;
  --tessra-tone-success-bg:transparent;
  --tessra-tone-danger:#e06c75;
  --tessra-tone-danger-bg:transparent;
  --tessra-tone-neutral:var(--vscode-descriptionForeground);
  --tessra-tone-neutral-bg:transparent;
  --tessra-method-get:#4ec94e;
  --tessra-method-post:#e5c07b;
  --tessra-method-put:#61afef;
  --tessra-method-patch:#d19a66;
  --tessra-method-delete:#e06c75;
  --tessra-method-meta:#abb2bf;
  --tessra-method-ws:#4ec9b0;
  --tessra-status-2xx:#4ec94e;
  --tessra-status-3xx:#d19a66;
  --tessra-status-error:#e06c75;
  --tessra-json-key:var(--vscode-debugTokenExpression-name);
  --tessra-json-str:var(--vscode-debugTokenExpression-string);
  --tessra-json-num:var(--vscode-debugTokenExpression-number);
  --tessra-json-bool:var(--vscode-debugTokenExpression-boolean);
  --tessra-json-null:var(--vscode-debugTokenExpression-boolean);
  --tessra-radius-xs:2px;
  --tessra-radius-sm:3px;
  --tessra-radius-md:4px;
}
body{background:var(--tessra-surface-tint,var(--vscode-editor-background))}
.main-content::before{display:none!important}
.tab-bar{background:var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background));box-shadow:none}
.add-tab{border-radius:var(--tessra-radius-sm);border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;min-width:28px;height:28px}
.add-tab:hover{background:var(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground));transform:none}
.req-tab{background:transparent;box-shadow:none;border-radius:0}
.req-tab.active,.req-tab.active.tab-GET,.req-tab.active.tab-POST,.req-tab.active.tab-PUT,.req-tab.active.tab-PATCH,.req-tab.active.tab-DELETE,.req-tab.active.tab-HEAD,.req-tab.active.tab-OPTIONS,.req-tab.active.tab-WS{background:transparent;box-shadow:none}
.req-tab .method-badge{padding:2px 6px;border-radius:var(--tessra-radius-xs);background:transparent;letter-spacing:0}
.req-tab .close-tab{border-radius:var(--tessra-radius-xs)}
.ghost-btn,.res-action-btn,.pin-response-btn,.compare-btn,.empty-state-action,.dirty-btn-discard,.dirty-btn-cancel{
  border-radius:var(--tessra-radius-sm);border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;box-shadow:none;backdrop-filter:none;min-height:28px
}
.ghost-btn:hover,.res-action-btn:hover:not(:disabled),.pin-response-btn:hover,.compare-btn:hover:not(:disabled),.empty-state-action:hover,.dirty-btn-discard:hover,.dirty-btn-cancel:hover{
  transform:none;background:var(--vscode-toolbar-hoverBackground,var(--vscode-list-hoverBackground));box-shadow:none
}
.btn-send:focus,.btn-stop:focus,.ghost-btn:focus,.res-action-btn:focus,.pin-response-btn:focus,.compare-btn:focus,.empty-state-action:focus,.request-status-chip:focus,.preflight-pill:focus,.script-help-line-link:focus,.tab:focus,.req-tab:focus,.close-tab:focus,.add-tab:focus,.add-btn:focus,.status-strip-toggle:focus,.status-strip-link:focus,.default-headers-summary:focus{outline:none}
.btn-send:focus-visible,.btn-stop:focus-visible,.ghost-btn:focus-visible,.res-action-btn:focus-visible,.pin-response-btn:focus-visible,.compare-btn:focus-visible,.empty-state-action:focus-visible,.request-status-chip:focus-visible,.preflight-pill:focus-visible,.status-strip-toggle:focus-visible,.status-strip-seg.clickable:focus-visible,.status-strip-link:focus-visible,.default-headers-summary:focus-visible,.script-help-line-link:focus-visible,.tab:focus-visible,.req-tab:focus-visible,.close-tab:focus-visible,.add-tab:focus-visible,.add-btn:focus-visible{
  outline:1px solid var(--vscode-focusBorder);outline-offset:1px
}
.url-bar{margin:0;padding:4px 8px;border-radius:0;border:none;border-bottom:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;box-shadow:none}
.url-primary-group{padding:0;border-radius:0;background:transparent;box-shadow:none}
.url-secondary-group,.url-overflow-wrap{padding:0;border-radius:0;background:transparent;box-shadow:none}
.url-hero-actions .btn-send,.url-hero-actions .btn-stop{min-width:auto;max-width:none;justify-content:center}
.url-bar select,.url-bar input,.kv-row input[type="text"],.kv-row input[type="password"],.body-type-select,.body-section textarea,.auth-section select,.auth-section .auth-fields input,.auth-section .auth-fields select,.settings-input,.response-search-input,.bulk-editor-input{
  border-radius:var(--tessra-radius-xs);border-color:var(--vscode-input-border,transparent);background:var(--vscode-input-background);box-shadow:none
}
.url-bar input:focus,.settings-input:focus,.response-search-input:focus,.bulk-editor-input:focus,.body-section textarea:focus,.auth-section .auth-fields input:focus,.auth-section .auth-fields select:focus,.kv-row input[type="text"]:focus,.kv-row input[type="password"]:focus{
  outline:1px solid var(--vscode-focusBorder);border-color:var(--vscode-focusBorder);box-shadow:none
}
.tabs{padding:0 8px;gap:2px;border-bottom:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444))}
.tab{padding:4px 8px;opacity:.65;border-radius:0}
.tab.active{opacity:1;background:transparent;box-shadow:inset 0 -2px 0 var(--tessra-accent,var(--vscode-focusBorder))}
.settings-card{
  border-radius:0;border:none;border-bottom:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;box-shadow:none;padding:8px 0
}
.settings-card::before,.settings-toggle::before{display:none}
.settings-card:hover,.script-card:hover,.settings-toggle:hover{transform:none;box-shadow:none;background:transparent}
.settings-toggle{border:none;border-radius:0;background:transparent;box-shadow:none;padding:6px 0}
.script-card{border:none;border-bottom:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));border-radius:0;background:transparent;box-shadow:none;padding:8px 0}
.ws-summary,.ws-message,.ws-empty{border-radius:0;background:transparent;box-shadow:none}
.ws-status-dot{box-shadow:none}
.default-headers-banner{display:flex;flex-direction:column;gap:4px;padding:4px 0;margin-bottom:6px;border:none;border-radius:0;background:transparent;box-shadow:none}
.default-headers-banner.active,.default-headers-banner.warning{border:none;background:transparent;box-shadow:none}
.default-headers-oneline{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:22px}
.default-headers-summary{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;border:none;background:transparent;color:var(--vscode-descriptionForeground);font:inherit;cursor:pointer;padding:0;text-align:left;border-radius:2px}
.default-headers-summary:hover{color:var(--vscode-foreground)}
.default-headers-banner-title{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;opacity:.85;color:var(--tessra-label-accent,var(--vscode-descriptionForeground))}
.default-headers-banner-copy{font-size:12px;font-weight:500}
.default-headers-expand{padding:4px 0 2px}
.default-headers-expand.hidden{display:none}
.default-header-chip{display:inline-flex;padding:1px 5px;border-radius:2px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));font-size:11px;background:transparent}
.empty-state{display:flex;flex-direction:column;justify-content:center;gap:8px;min-height:120px;padding:16px 12px;border:none;border-radius:0;background:transparent;box-shadow:none}
.empty-state.inline{min-height:auto;padding:12px 0}
.empty-state-title{font-size:13px;font-weight:600;line-height:1.3;max-width:720px}
.empty-state-copy{font-size:13px;line-height:1.45;color:var(--vscode-descriptionForeground);max-width:720px}
.empty-state-actions{display:flex;flex-wrap:wrap;gap:8px}
.empty-state-action{padding:4px 10px;border-radius:3px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;font-size:12px;font-weight:600}
.empty-state-action.primary{background:var(--vscode-button-background);border-color:transparent;color:var(--vscode-button-foreground)}
.var-usage{display:flex;align-items:center;gap:6px;padding:0;flex-wrap:wrap}
.var-usage.hidden{display:none}
.var-usage-title{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground)}
.var-usage-copy{font-size:11px;color:var(--vscode-descriptionForeground)}
.var-usage-card{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:2px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent}
.var-usage-name{font-size:12px;font-weight:600;color:var(--vscode-debugTokenExpression-name,var(--vscode-symbolIcon-variableForeground));font-family:var(--vscode-editor-font-family,monospace)}
.var-usage-scope{display:inline-flex;padding:0 4px;border-radius:2px;font-size:10px;border:1px solid color-mix(in srgb,var(--tessra-accent,#57a6ff) 28%,transparent);color:var(--tessra-tone-info,#93c8ff)}
.json-body,.json-tree,.xml-path-body{
  background:var(--vscode-editor-background);padding:8px 10px;border-radius:var(--tessra-radius-xs);border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));font-family:var(--vscode-editor-font-family,monospace);font-size:13px;overflow:auto;flex:1;min-height:0;line-height:1.3;box-shadow:none
}
.json-body{white-space:pre-wrap;word-break:break-word}
.res-body-toolbar .toggle-group{display:flex;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));border-radius:var(--tessra-radius-sm);overflow:hidden;margin-right:4px;background:transparent}
.res-body-toolbar .tb-btn{padding:4px 8px;font-size:12px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));border-radius:var(--tessra-radius-sm);opacity:.8}
.res-body-toolbar .toggle-btn{border:none;border-radius:0;padding:4px 8px}
.compare-mode-chip{padding:4px 8px;border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));border-radius:var(--tessra-radius-sm);background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:12px}
.compare-mode-chip.active{border-color:var(--tessra-accent,var(--vscode-charts-blue,#3794ff));color:var(--tessra-accent,var(--vscode-charts-blue,#3794ff));background:color-mix(in srgb,var(--tessra-accent,#3794ff) 12%,transparent)}
.resolved-url{display:block;max-width:100%;padding:2px 0;font-size:12px;color:var(--vscode-descriptionForeground);background:transparent;border:none;border-radius:0;cursor:text;user-select:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--vscode-editor-font-family,monospace);flex-shrink:1}
.resolved-url:hover{text-decoration:none;opacity:1;color:var(--vscode-foreground)}
.resolved-url.copied{color:var(--tessra-status-2xx,#4ec94e)}
.compare-active-indicator{font-size:11px;color:var(--vscode-descriptionForeground);white-space:nowrap;padding:0 4px}
.response-summary,.response-summary-card,.response-stat-card{border:none;background:transparent;box-shadow:none;border-radius:0}
.response-summary-card{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:2px 0;flex-wrap:nowrap;min-width:0}
.response-stat-inline{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--vscode-foreground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.response-action-cluster{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:nowrap;flex:0 0 auto}
.actions-more-menu{display:none;position:absolute;top:calc(100% + 4px);right:0;z-index:120;background:var(--vscode-dropdown-background);border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));border-radius:var(--tessra-radius-sm);box-shadow:0 2px 8px rgba(0,0,0,.28);min-width:180px;padding:4px 0}
.actions-more-menu.open{display:block}
.actions-more-menu .res-action-btn,.actions-more-menu .pin-response-btn,.actions-more-menu .compare-btn{display:flex;width:100%;justify-content:flex-start;padding:5px 12px;border:none;border-radius:0;background:transparent;box-shadow:none}
.split.is-response-emphasis .res-area,.res-area.is-response-emphasis{border-top:2px solid var(--tessra-accent,var(--vscode-focusBorder,#007acc))}
.btn-stop{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;background:var(--vscode-errorForeground,#c42b1c);color:#fff;border:none;border-radius:3px;font-size:13px;font-weight:600;cursor:pointer;min-height:28px;flex-shrink:0;box-shadow:none}
.btn-stop:hover{filter:brightness(1.08);transform:none;box-shadow:none}
.runner-row:hover{transform:none}
.ripple-btn{position:relative}
.copy-toast{border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
/* Theme presets: CSS custom properties only — shared Quiet Instrument layout/spacing/radius/chrome */
body[data-panel-theme="minimal-cool"]{
  --tessra-brand-blue:#7dc8ff;
  --tessra-brand-violet:#9a8cff;
  --tessra-brand:color-mix(in srgb,var(--tessra-brand-violet) 40%,var(--tessra-brand-blue));
  --tessra-brand-fg:color-mix(in srgb,var(--tessra-brand) 38%,var(--vscode-foreground));
  --tessra-brand-soft:color-mix(in srgb,var(--tessra-brand) 8%,transparent);
  --tessra-brand-border:color-mix(in srgb,var(--tessra-brand) 44%,transparent);
  --tessra-accent:var(--tessra-brand);
  --tessra-tone-info:#7dc8ff;
  --tessra-surface-tint:color-mix(in srgb,var(--tessra-brand) 3%,var(--vscode-editor-background));
  --tessra-surface-2:color-mix(in srgb,var(--tessra-brand) 4%,transparent);
  --tessra-border-soft:color-mix(in srgb,var(--tessra-brand-blue) 18%,var(--vscode-panel-border,#444));
  --tessra-border-strong:color-mix(in srgb,var(--tessra-brand-blue) 28%,var(--vscode-panel-border,#555));
  --tessra-strip-info:var(--vscode-descriptionForeground,#8e8e8e);
  --tessra-strip-info-num:var(--vscode-foreground);
  --tessra-label-accent:var(--vscode-descriptionForeground);
  --tessra-method-get:#5bbf6a;
  --tessra-method-post:#c9b07a;
  --tessra-method-put:#7dc8ff;
  --tessra-method-patch:#c49a72;
  --tessra-method-delete:#d07a86;
  --tessra-method-meta:#9aa3b2;
  --tessra-method-ws:#5bbfae;
  --tessra-status-2xx:#5bbf6a;
  --tessra-status-3xx:#c9b07a;
  --tessra-status-error:#d07a86;
  --tessra-json-key:var(--vscode-debugTokenExpression-name);
  --tessra-json-str:var(--vscode-debugTokenExpression-string);
  --tessra-json-num:var(--vscode-debugTokenExpression-number);
  --tessra-json-bool:var(--vscode-debugTokenExpression-boolean);
  --tessra-json-null:var(--vscode-debugTokenExpression-boolean);
}
body[data-panel-theme="product"]{
  --tessra-brand-blue:#75bcff;
  --tessra-brand-violet:#a78bfa;
  --tessra-brand:color-mix(in srgb,var(--tessra-brand-violet) 44%,var(--tessra-brand-blue));
  --tessra-brand-fg:color-mix(in srgb,var(--tessra-brand) 40%,var(--vscode-foreground));
  --tessra-brand-soft:color-mix(in srgb,var(--tessra-brand) 9%,transparent);
  --tessra-brand-border:color-mix(in srgb,var(--tessra-brand) 48%,transparent);
  --tessra-accent:var(--tessra-brand);
  --tessra-tone-info:#9fd3ff;
  --tessra-surface-tint:color-mix(in srgb,var(--tessra-brand) 2.5%,var(--vscode-editor-background));
  --tessra-surface-2:color-mix(in srgb,var(--tessra-brand) 3.5%,transparent);
  --tessra-border-soft:color-mix(in srgb,var(--tessra-brand-blue) 22%,var(--vscode-panel-border,#444));
  --tessra-border-strong:color-mix(in srgb,var(--tessra-brand-blue) 34%,var(--vscode-panel-border,#555));
  --tessra-strip-info:var(--vscode-descriptionForeground,#8e8e8e);
  --tessra-strip-info-num:var(--vscode-foreground);
  --tessra-label-accent:#9fd3ff;
  --tessra-method-get:#4ec94e;
  --tessra-method-post:#e5c07b;
  --tessra-method-put:#75bcff;
  --tessra-method-patch:#d19a66;
  --tessra-method-delete:#e06c75;
  --tessra-method-meta:#abb2bf;
  --tessra-method-ws:#4ec9b0;
  --tessra-status-2xx:#4ec94e;
  --tessra-status-3xx:#d19a66;
  --tessra-status-error:#e06c75;
  --tessra-json-key:var(--vscode-debugTokenExpression-name);
  --tessra-json-str:var(--vscode-debugTokenExpression-string);
  --tessra-json-num:var(--vscode-debugTokenExpression-number);
  --tessra-json-bool:var(--vscode-debugTokenExpression-boolean);
  --tessra-json-null:var(--vscode-debugTokenExpression-boolean);
}
body[data-panel-theme="bold-color"]{
  --tessra-brand-blue:#57a6ff;
  --tessra-brand-violet:#9b6dff;
  --tessra-brand:color-mix(in srgb,var(--tessra-brand-violet) 48%,var(--tessra-brand-blue));
  --tessra-brand-fg:color-mix(in srgb,var(--tessra-brand) 45%,var(--vscode-foreground));
  --tessra-brand-soft:color-mix(in srgb,var(--tessra-brand) 10%,transparent);
  --tessra-brand-border:color-mix(in srgb,var(--tessra-brand) 52%,transparent);
  --tessra-accent:var(--tessra-brand);
  --tessra-tone-info:#7fc8ff;
  --tessra-surface-tint:color-mix(in srgb,var(--tessra-brand) 4%,var(--vscode-editor-background));
  --tessra-surface-2:color-mix(in srgb,var(--tessra-brand) 5%,transparent);
  --tessra-border-soft:color-mix(in srgb,var(--tessra-brand-blue) 26%,var(--vscode-panel-border,#444));
  --tessra-border-strong:color-mix(in srgb,var(--tessra-brand-blue) 40%,var(--vscode-panel-border,#555));
  --tessra-strip-info:var(--vscode-descriptionForeground,#8e8e8e);
  --tessra-strip-info-num:var(--vscode-foreground);
  --tessra-label-accent:var(--vscode-descriptionForeground);
  --tessra-method-get:#7ff09f;
  --tessra-method-post:#ffd27d;
  --tessra-method-put:#9fd4ff;
  --tessra-method-patch:#f0c995;
  --tessra-method-delete:#ff9fae;
  --tessra-method-meta:#cfd6e4;
  --tessra-method-ws:#90f0d6;
  --tessra-status-2xx:#7ff09f;
  --tessra-status-3xx:#ffd27d;
  --tessra-status-error:#ff95b1;
  --tessra-json-key:var(--vscode-debugTokenExpression-name);
  --tessra-json-str:var(--vscode-debugTokenExpression-string);
  --tessra-json-num:var(--vscode-debugTokenExpression-number);
  --tessra-json-bool:var(--vscode-debugTokenExpression-boolean);
  --tessra-json-null:var(--vscode-debugTokenExpression-boolean);
}
@media (max-width: 900px){
  .resolved-url{max-width:100%}
  .settings-grid,.script-editor-grid{grid-template-columns:1fr}
  .response-context-row{align-items:flex-start}
}
@media (max-width: 640px){
  .resolved-url{display:none}
  .compare-active-indicator{display:none}
}
@media (max-height: 820px){
  .script-card textarea{min-height:120px;max-height:32vh}
}
@media (prefers-reduced-motion: reduce){
  .bullet-progress .bullet-glow,
  .skeleton-line,
  .perfect-badge,
  .stop-vignette-flash,
  .ripple-btn .ripple-circle,
  .btn-stop .stop-icon,
  .btn-send svg,
  .send-click,
  .btn-stop.stop-slam,
  .btn-sending,
  .res-area.slide-in,
  .url-input-wrap.sweep::after,
  .spinner{
    animation:none!important;
  }
  .bullet-progress .bullet-glow,
  .stop-vignette-flash,
  .perfect-badge,
  .ripple-btn .ripple-circle{
    display:none!important;
  }
  .skeleton-line{opacity:.22}
  .spinner{opacity:.7;border-top-color:var(--vscode-foreground)}
  .req-tab,.tab,.ghost-btn,.compare-btn,.runner-row,.runner-bar-fill,.bullet-progress,.request-change-chip.clickable,.ripple-btn,.btn-stop,.res-action-btn,.pin-response-btn{
    transition:none!important;
  }
  .compare-btn:hover:not(:disabled),.compare-btn:active:not(:disabled),.res-body-toolbar .tb-btn:active{transform:none}
}
</style>
</head>
<body data-panel-theme="${requestPanelTheme}">


<div class="tab-bar" id="tabBar" role="tablist" aria-label="${LocalizationService.t('webview.requestTabs', undefined, displayLanguage)}">
<button class="add-tab" id="addTabBtn" type="button" title="${LocalizationService.t('webview.newTab', undefined, displayLanguage)}" aria-label="${LocalizationService.t('webview.newTab', undefined, displayLanguage)}">+</button>
</div>


<div id="envEditor" class="env-editor hidden" data-testid="environment-disclosure">
  <div class="env-editor-title">
    <span id="envEditorTitle">${LocalizationService.t('webview.environment', undefined, displayLanguage)}</span>
    <span class="env-editor-name muted" id="envEditorName">${LocalizationService.t('webview.environmentNone', undefined, displayLanguage)}</span>
    <span class="env-var-count" id="envEditorVarCount"></span>
    <span style="flex:1"></span>
    <span class="env-dirty-dot" id="envDirtyDot" title="${LocalizationService.t('webview.unsavedChanges', undefined, displayLanguage)}"></span>
    <span class="env-autosave-indicator" id="envAutoSaved"><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6.27 10.87h.04l4.49-4.49-1.06-1.06-3.47 3.47-1.47-1.47-1.06 1.06 2.53 2.49z"/><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12z"/></svg> <span id="envAutoSavedLabel">${LocalizationService.t('webview.autoSaved', undefined, displayLanguage)}</span></span>
    <button class="rm" id="envCloseBtn" data-testid="environment-disclosure-close" type="button" title="${LocalizationService.t('webview.close', undefined, displayLanguage)}" aria-label="${LocalizationService.t('webview.close', undefined, displayLanguage)}" style="cursor:pointer;font-size:14px;opacity:.6">&times;</button>
  </div>
  <div class="env-editor-body" id="envEditorBody">
    <div id="envVarRows" class="kv-section" data-testid="environment-var-rows"></div>
    <button class="add-btn" id="addEnvVarBtn" data-testid="environment-add-variable" disabled>${LocalizationService.t('webview.addVariable', undefined, displayLanguage)}</button>
  </div>
</div>


<div id="defaultHeadersEditor" class="env-editor hidden">
  <div class="env-editor-title">
    <span id="defaultHeadersTitle">${LocalizationService.t('webview.defaultHeaders', undefined, displayLanguage)}</span>
    <span style="flex:1"></span>
    <button class="btn btn-s" id="defaultHeadersSaveBtn" style="padding:2px 8px;font-size:13px">${LocalizationService.t('webview.save', undefined, displayLanguage)}</button>
    <button class="rm" id="defaultHeadersCloseBtn" type="button" title="${LocalizationService.t('webview.close', undefined, displayLanguage)}" aria-label="${LocalizationService.t('webview.close', undefined, displayLanguage)}" style="cursor:pointer;font-size:14px;opacity:.6">&times;</button>
  </div>
  <div id="defaultHeaderRows" class="kv-section"></div>
  <button class="add-btn" id="addDefaultHeaderBtn">${LocalizationService.t('webview.addHeader', undefined, displayLanguage)}</button>
</div>


<div class="main-content" id="mainContent">
  <div class="placeholder" id="emptyPlaceholder">${LocalizationService.t('webview.emptyPlaceholder', undefined, displayLanguage)}</div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let i18n = ${localizedStrings};
let appDateLocale = ${JSON.stringify(dateLocale)};
let currentDisplayLanguage = ${JSON.stringify(displayLanguage)};
const REQUEST_PANEL_THEMES = ['default', 'minimal-cool', 'product', 'bold-color'];
let currentRequestPanelTheme = ${JSON.stringify(requestPanelTheme)};


let tabs = [];       // { id, name, method, url, headers, params, body, auth, response, error, loading }
let activeTabId = null;
let tabIdCounter = 0;
let currentEnvName = null;
let currentWorkspaceProfile = 'default';
let editingEnvId = null;
let envEditorEnvName = null;
let envEditorVariableCount = 0;
let activeVarKeys = [];
let activeVarValues = {};
let workspaceDefaultHeaders = [];
let pendingSaveBtn = null;
let pendingSaveResponseBtn = null;
var _pendingCloseAfterSave = null;
const VALID_BODY_TYPES = ['none', 'json', 'xml', 'form', 'formdata', 'binary', 'raw'];

const DEFAULT_COMPARE_IGNORE_HEADERS = ['date', 'set-cookie', 'x-request-id', 'x-correlation-id', 'x-amzn-trace-id'];
const DEFAULT_COMPARE_IGNORE_JSON_PATHS = ['$.timestamp', '$.traceId', '$.requestId', '$.correlationId'];
const DEFAULT_COMPARE_FOLD_UNCHANGED = true;
const DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS = 30;
const MIN_WS_KEEPALIVE_INTERVAL_SECONDS = 5;
const MAX_WS_KEEPALIVE_INTERVAL_SECONDS = 300;
const DEFAULT_WS_KEEPALIVE_MESSAGE = 'ping';
const DEFAULT_MAX_RESPONSE_SIZE_KB = 10240;
const REQUEST_EDITOR_TABS = ['params', 'headers', 'body', 'auth', 'scripts', 'settings'];
const BODY_UNDO_MAX_ENTRIES = 100;
const BODY_UNDO_COALESCE_MS = 700;
// Skip tokenized JSON highlight above this size to avoid typing jank; overlay falls back to escaped plain text.
const BODY_JSON_HIGHLIGHT_MAX_CHARS = 120000;
const BODY_JSON_HIGHLIGHT_DEBOUNCE_MS = 80;
var pinnedResponses = [];
var lastResponse = null;
var compareSettings = normalizeCompareSettings();
var activeFormatMenuState = null;
var splitDragState = null;
var bodyUndoApplying = false;
var contentDelegatedEventsBound = false;

function closeActiveFormatMenu() {
  if (!activeFormatMenuState) return;
  if (activeFormatMenuState.menu) activeFormatMenuState.menu.classList.remove('open');
  if (activeFormatMenuState.button) activeFormatMenuState.button.setAttribute('aria-expanded', 'false');
  activeFormatMenuState = null;
}

function getOpenActionsMenuItems(menu) {
  if (!menu) return [];
  return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]')).filter(function(item) {
    return !item.disabled && item.getAttribute('aria-disabled') !== 'true';
  });
}

function focusActionsMenuItem(menu, index) {
  var items = getOpenActionsMenuItems(menu);
  if (!items.length) return;
  var next = items[(index % items.length + items.length) % items.length];
  if (next && typeof next.focus === 'function') next.focus();
}

function handleActionsMenuKeydown(event) {
  if (!activeFormatMenuState || !activeFormatMenuState.menu) return false;
  var menu = activeFormatMenuState.menu;
  var button = activeFormatMenuState.button;
  if (!menu.classList || !menu.classList.contains('open')) return false;
  var target = event.target;
  var inMenu = !!(menu.contains && menu.contains(target))
    || target === button
    || !!(button && button.contains && button.contains(target));
  if (!inMenu) return false;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeActiveFormatMenu();
    if (button && typeof button.focus === 'function') button.focus();
    return true;
  }

  var items = getOpenActionsMenuItems(menu);
  if (!items.length) return false;
  var currentIndex = items.indexOf(target);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusActionsMenuItem(menu, currentIndex < 0 ? 0 : currentIndex + 1);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusActionsMenuItem(menu, currentIndex < 0 ? items.length - 1 : currentIndex - 1);
    return true;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    focusActionsMenuItem(menu, 0);
    return true;
  }
  if (event.key === 'End') {
    event.preventDefault();
    focusActionsMenuItem(menu, items.length - 1);
    return true;
  }
  return false;
}

function bindActionsMoreMenu(button, menu) {
  if (!button || !menu) return;
  button.addEventListener('click', function(e) {
    e.stopPropagation();
    if (activeFormatMenuState && activeFormatMenuState.menu === menu) {
      closeActiveFormatMenu();
      return;
    }
    closeActiveFormatMenu();
    menu.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    activeFormatMenuState = { button: button, menu: menu };
  });
  button.addEventListener('keydown', function(e) {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (!menu.classList.contains('open')) {
      button.click();
    }
    focusActionsMenuItem(menu, 0);
  });
  menu.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (btn && !btn.disabled) {
      setTimeout(closeActiveFormatMenu, 0);
    }
  });
}

function releaseSplitDrag() {
  if (!splitDragState) return;
  if (splitDragState.divider) splitDragState.divider.classList.remove('active');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  splitDragState = null;
  debouncePersist();
}

function isRequestEditorCollapsed(tab) {
  return tab?.requestEditorExpanded === false;
}

function getCollapsedRequestAreaHeight(splitEl) {
  var tabsHeight = splitEl?.querySelector('.js-req-tabs')?.offsetHeight || 0;
  return Math.max(44, tabsHeight + 8);
}

function normalizeRequestSplitHeight(value) {
  var height = typeof value === 'number'
    ? value
    : Number.parseFloat(String(value || ''));
  return Number.isFinite(height) && height > 0 ? height : null;
}

function getSplitPanelBounds(splitEl, dividerEl, progressEl, tab) {
  var chromeHeight = (dividerEl?.offsetHeight || 0) + (progressEl?.offsetHeight || 0);
  var panelSpace = Math.max(0, (splitEl?.offsetHeight || 0) - chromeHeight);
  var preferredMin = Math.max(120, Math.floor(panelSpace * 0.28));
  var minPanel = panelSpace >= preferredMin * 2
    ? preferredMin
    : Math.max(80, Math.floor(panelSpace / 2));
  var requestMinPanel = isRequestEditorCollapsed(tab) ? getCollapsedRequestAreaHeight(splitEl) : minPanel;
  var minReq = Math.min(requestMinPanel, Math.max(0, panelSpace - minPanel));
  var maxReq = Math.max(minReq, panelSpace - minPanel);
  return { minReq: minReq, maxReq: maxReq };
}

function applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, requestedHeight, tab, rememberManualHeight) {
  if (!reqArea || !splitEl) return;
  var nextHeight = typeof requestedHeight === 'number'
    ? requestedHeight
    : Number.parseFloat(String(requestedHeight || ''));
  if (!Number.isFinite(nextHeight)) return;
  var bounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, tab);
  var clampedHeight = Math.min(bounds.maxReq, Math.max(bounds.minReq, nextHeight));
  reqArea.style.height = clampedHeight + 'px';
  reqArea.style.flex = 'none';
  reqArea.classList.toggle('is-collapsed', isRequestEditorCollapsed(tab));
  reqArea.dataset.manualHeight = '1';
  if (rememberManualHeight !== false && tab && !isRequestEditorCollapsed(tab)) {
    tab.requestSplitHeightPx = clampedHeight;
  }
}

function applyStoredRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab) {
  var storedHeight = normalizeRequestSplitHeight(tab?.requestSplitHeightPx);
  if (storedHeight === null) return false;
  applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, storedHeight, tab, false);
  return true;
}

function shouldPreferResponseLayout(tab) {
  return !!(tab && (tab.response || tab.loading || tab.error || (tab.websocketMessages && tab.websocketMessages.length > 0)));
}

function clearAdaptiveRequestAreaHeight(reqArea) {
  if (!reqArea) return;
  reqArea.style.height = '';
  reqArea.style.flex = '';
  delete reqArea.dataset.autoHeight;
}

function hasUserLockedSplitRatio(reqArea, tab) {
  if (reqArea && reqArea.dataset.manualHeight === '1') return true;
  return normalizeRequestSplitHeight(tab?.requestSplitHeightPx) !== null;
}

function syncResponseEmphasisClass(splitEl, tab) {
  if (!splitEl) return;
  var prefer = shouldPreferResponseLayout(tab);
  splitEl.classList.toggle('is-response-emphasis', prefer);
  var resArea = splitEl.querySelector('.res-area');
  if (resArea) resArea.classList.toggle('is-response-emphasis', prefer);
}

function applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab) {
  if (!reqArea || !splitEl) return;
  syncResponseEmphasisClass(splitEl, tab);
  reqArea.classList.toggle('is-collapsed', isRequestEditorCollapsed(tab));
  // 사용자 수동 비율이 있으면 Send/edit 자동 리사이즈 금지 (시각 강조만)
  if (hasUserLockedSplitRatio(reqArea, tab) && !isRequestEditorCollapsed(tab)) {
    applyStoredRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab);
    return;
  }
  if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(tab)) return;
  if (!isRequestEditorCollapsed(tab) && applyStoredRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, tab)) {
    return;
  }
  if (isRequestEditorCollapsed(tab)) {
    var collapsedBounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, tab);
    var collapsedHeight = Math.min(collapsedBounds.maxReq, Math.max(collapsedBounds.minReq, getCollapsedRequestAreaHeight(splitEl)));
    reqArea.style.height = collapsedHeight + 'px';
    reqArea.style.flex = 'none';
    reqArea.dataset.autoHeight = '1';
    delete reqArea.dataset.manualHeight;
    return;
  }
  if (!shouldPreferResponseLayout(tab)) {
    clearAdaptiveRequestAreaHeight(reqArea);
    return;
  }
  var chromeHeight = (dividerEl?.offsetHeight || 0) + (progressEl?.offsetHeight || 0);
  var panelSpace = Math.max(0, (splitEl?.offsetHeight || 0) - chromeHeight);
  if (!panelSpace) return;
  var bounds = getSplitPanelBounds(splitEl, dividerEl, progressEl, tab);
  var targetRatio = panelSpace < 420 ? 0.34 : panelSpace < 560 ? 0.38 : 0.42;
  var requestEditorTab = normalizeRequestEditorTab(tab.requestEditorTab);
  if (requestEditorTab === 'scripts' || requestEditorTab === 'body') {
    targetRatio += 0.04;
  } else if (requestEditorTab === 'settings' || requestEditorTab === 'headers') {
    targetRatio += 0.02;
  }
  var targetHeight = Math.round(panelSpace * Math.min(0.48, targetRatio));
  var clampedHeight = Math.min(bounds.maxReq, Math.max(bounds.minReq, targetHeight));
  reqArea.style.height = clampedHeight + 'px';
  reqArea.style.flex = 'none';
  reqArea.dataset.autoHeight = '1';
}

document.addEventListener('click', function(e) {
  if (!activeFormatMenuState) return;
  if (!activeFormatMenuState.menu?.isConnected || !activeFormatMenuState.button?.isConnected) {
    closeActiveFormatMenu();
    return;
  }
  if (activeFormatMenuState.menu.contains(e.target) || activeFormatMenuState.button.contains(e.target)) {
    return;
  }
  closeActiveFormatMenu();
});

document.addEventListener('keydown', function(e) {
  handleActionsMenuKeydown(e);
});

document.addEventListener('mousemove', function(e) {
  if (!splitDragState) return;
  if (!splitDragState.divider?.isConnected || !splitDragState.splitEl?.isConnected || !splitDragState.reqArea?.isConnected) {
    releaseSplitDrag();
    return;
  }
  var dy = e.clientY - splitDragState.startY;
  var newH = splitDragState.startH + dy;
  var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
  applyManualRequestAreaHeight(
    splitDragState.reqArea,
    splitDragState.splitEl,
    splitDragState.divider,
    splitDragState.progressEl,
    newH,
    activeTab
  );
});

document.addEventListener('mouseup', function() {
  releaseSplitDrag();
});

function tr(key) {
  return Object.prototype.hasOwnProperty.call(i18n, key) ? i18n[key] : key;
}

function tf(key, params) {
  return tr(key).replace(/{([A-Za-z0-9_]+)}/g, function(_, name) {
    return Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params[name]) : '{' + name + '}';
  });
}

function tfCount(key, count) {
  return tf(key, { count: String(count) });
}

function normalizeRequestEditorTab(value) {
  return REQUEST_EDITOR_TABS.indexOf(String(value || '')) >= 0 ? String(value) : 'params';
}

function renderEnvironmentIndicator(envName) {
  return '<span class="env-label">' + escapeHtml(tr('webview.environment')) + '</span><span class="env-name">' + escapeHtml(envName) + '</span>';
}

function renderProfileIndicator(profileName) {
  return tf('webview.summaryProfile', { name: profileName || 'default' });
}

function renderStatusChip(label, tone, action, meta, tooltip) {
  var attrs = action
    ? ' type="button" data-action="' + escapeAttr(action) + '"' + (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '')
    : '';
  var titleAttr = tooltip ? ' title="' + escapeAttr(tooltip) + '"' : '';
  return '<button class="request-status-chip' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '') + '"' + attrs + titleAttr + '>' + escapeHtml(label) + '</button>';
}

function renderEnvironmentStatusChip(envName) {
  return '<button class="request-status-chip info clickable" type="button" data-action="switch-environment">' + renderEnvironmentIndicator(envName) + '</button>';
}

function renderPreflightPill(label, tone, action, meta) {
  return '<button class="preflight-pill' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '') + '"' +
    (action ? ' type="button" data-action="' + escapeAttr(action) + '"' : '') +
    (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '') +
    '>' + escapeHtml(label) + '</button>';
}

function collectTemplateVariableNames(target, text) {
  if (!text) return;
  var re = /\{\{([^}]+)\}\}/g;
  var match;
  while ((match = re.exec(String(text))) !== null) {
    var name = (match[1] || '').trim();
    if (name) target.add(name);
  }
}

function collectTemplateVariablesFromKeyValues(target, items) {
  (items || []).forEach(function(item) {
    if (!item || item.enabled === false) return;
    collectTemplateVariableNames(target, item.key);
    collectTemplateVariableNames(target, item.value);
  });
}

function isSensitiveKeyName(value) {
  return /(^|[-_])(authorization|token|secret|password|passwd|pwd|api[-_]?key|session|cookie|access[-_]?token|refresh[-_]?token)([-_]|$)/i.test(String(value || '').trim());
}

function authSummaryLabel(auth) {
  if (!auth || auth.type === 'none') return tr('webview.authSummaryNone');
  if (auth.type === 'basic') return tr('webview.authSummaryBasic');
  if (auth.type === 'bearer') return tr('webview.authSummaryBearer');
  if (auth.type === 'apikey') {
    return auth?.apikey?.addTo === 'query'
      ? tr('webview.authSummaryApiKeyQuery')
      : tr('webview.authSummaryApiKeyHeader');
  }
  return authTypeLabel(auth.type);
}

function getUnresolvedDraftVariableNames(tab) {
  var names = new Set();
  if (!tab) return [];
  collectTemplateVariableNames(names, tab.url);
  collectTemplateVariablesFromKeyValues(names, tab.headers);
  collectTemplateVariablesFromKeyValues(names, tab.params);
  collectTemplateVariableNames(names, tab.body);
  collectTemplateVariableNames(names, tab.binaryFilePath);
  (tab.formData || []).forEach(function(field) {
    if (!field || field.enabled === false) return;
    collectTemplateVariableNames(names, field.key);
    collectTemplateVariableNames(names, field.value);
  });
  if (!tab.skipDefaultHeaders) {
    collectTemplateVariablesFromKeyValues(names, workspaceDefaultHeaders);
  }
  if (tab.auth?.basic) {
    collectTemplateVariableNames(names, tab.auth.basic.username);
    collectTemplateVariableNames(names, tab.auth.basic.password);
  }
  if (tab.auth?.bearer) {
    collectTemplateVariableNames(names, tab.auth.bearer.token);
  }
  if (tab.auth?.apikey) {
    collectTemplateVariableNames(names, tab.auth.apikey.key);
    collectTemplateVariableNames(names, tab.auth.apikey.value);
  }
  return Array.from(names).filter(function(name) {
    return activeVarKeys.indexOf(name) < 0;
  });
}

function buildDraftTabFromContent(mc) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !mc) return tab;
  var methodEl = mc.querySelector('.js-method');
  var saveHistoryInput = mc.querySelector('.js-save-history');
  var skipDefaultHeadersInput = mc.querySelector('.js-skip-default-headers');
  var disableScriptsInput = mc.querySelector('.js-disable-scripts');
  var followRedirectsInput = mc.querySelector('.js-follow-redirects');
  var stopAfterHeadersInput = mc.querySelector('.js-stop-after-headers');
  var tlsValidationInput = mc.querySelector('.js-tls-validation');
  return Object.assign({}, tab, {
    requestEditorTab: normalizeRequestEditorTab(mc.querySelector('.js-req-tabs .tab.active')?.dataset.tab || tab.requestEditorTab),
    method: methodEl ? methodEl.value : tab.method,
    url: mc.querySelector('.js-url')?.value || tab.url || '',
    requestType: normalizeRequestType(tab.requestType, mc.querySelector('.js-url')?.value || tab.url || ''),
    headers: collectKv(mc.querySelector('.js-header-rows')),
    params: collectKv(mc.querySelector('.js-param-rows')),
    body: mc.querySelector('.js-body')?.value || '',
    bodyType: normalizeBodyType(mc.querySelector('.js-body-type')?.value || tab.bodyType),
    formData: collectFormData(mc.querySelector('.js-formdata-rows')),
    binaryFilePath: mc.querySelector('.js-binary-path')?.value || '',
    auth: collectAuth(mc),
    scripts: collectScripts(mc),
    timeout: normalizeNumberSetting(mc.querySelector('.js-timeout')?.value),
    followRedirects: followRedirectsInput ? followRedirectsInput.checked === true : !!tab.followRedirects,
    saveToHistory: saveHistoryInput ? saveHistoryInput.checked !== false : tab.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(tlsValidationInput?.value || tab.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(mc.querySelector('.js-max-response-size')?.value),
    retryCount: normalizeNumberSetting(mc.querySelector('.js-retry-count')?.value),
    retryDelayMs: normalizeNumberSetting(mc.querySelector('.js-retry-delay')?.value),
    stopAfterHeaders: stopAfterHeadersInput ? stopAfterHeadersInput.checked === true : !!tab.stopAfterHeaders,
    skipDefaultHeaders: skipDefaultHeadersInput ? skipDefaultHeadersInput.checked === true : !!tab.skipDefaultHeaders,
    disableScripts: disableScriptsInput ? disableScriptsInput.checked === true : !!tab.disableScripts,
    webSocketKeepAliveEnabled: mc.querySelector('.js-ws-keepalive-enabled')?.checked === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(mc.querySelector('.js-ws-keepalive-interval')?.value),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(mc.querySelector('.js-ws-keepalive-message')?.value)
  });
}

function countEnabledKeyValues(items) {
  return (items || []).filter(function(item) {
    return item && item.enabled !== false && item.key;
  }).length;
}

function countEnabledFormData(items) {
  return (items || []).filter(function(item) {
    return item && item.enabled !== false && (item.key || item.value);
  }).length;
}

function createRequestChangeBaseline(tab) {
  var baseline = {
    requestType: 'http',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none',
    formData: [],
    binaryFilePath: '',
    auth: { type: 'none' },
    scripts: { preRequest: '', test: '' },
    timeout: 0,
    followRedirects: false,
    saveToHistory: true,
    tlsValidation: 'default',
    maxResponseSizeKb: DEFAULT_MAX_RESPONSE_SIZE_KB,
    retryCount: 0,
    retryDelayMs: 0,
    stopAfterHeaders: false,
    skipDefaultHeaders: false,
    disableScripts: false,
    webSocketKeepAliveEnabled: false,
    webSocketKeepAliveIntervalSeconds: DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS,
    webSocketKeepAliveMessage: DEFAULT_WS_KEEPALIVE_MESSAGE,
  };
  if (!tab?._snapshot) {
    return baseline;
  }
  try {
    var raw = JSON.parse(tab._snapshot);
    var settings = raw.settings || {};
    baseline.requestType = normalizeRequestType(raw.requestType, raw.url);
    baseline.method = raw.method || baseline.method;
    baseline.url = raw.url || '';
    baseline.headers = raw.headers || [];
    baseline.params = raw.params || [];
    baseline.body = raw.body || '';
    baseline.bodyType = normalizeBodyType(raw.bodyType || baseline.bodyType);
    baseline.formData = raw.formData || [];
    baseline.binaryFilePath = raw.binaryFilePath || '';
    baseline.auth = raw.auth || baseline.auth;
    baseline.scripts = raw.scripts || baseline.scripts;
    baseline.timeout = normalizeNumberSetting(settings.timeout);
    baseline.followRedirects = settings.followRedirects === true;
    baseline.saveToHistory = settings.saveToHistory !== false;
    baseline.tlsValidation = normalizeTlsValidation(settings.tlsValidation);
    baseline.maxResponseSizeKb = normalizeMaxResponseSizeSetting(settings.maxResponseSizeKb);
    baseline.retryCount = normalizeNumberSetting(settings.retryCount);
    baseline.retryDelayMs = normalizeNumberSetting(settings.retryDelayMs);
    baseline.stopAfterHeaders = settings.stopAfterHeaders === true;
    baseline.skipDefaultHeaders = settings.skipDefaultHeaders === true;
    baseline.disableScripts = settings.disableScripts === true;
    baseline.webSocketKeepAliveEnabled = settings.webSocketKeepAliveEnabled === true;
    baseline.webSocketKeepAliveIntervalSeconds = normalizeWebSocketKeepAliveInterval(settings.webSocketKeepAliveIntervalSeconds);
    baseline.webSocketKeepAliveMessage = normalizeWebSocketKeepAliveMessage(settings.webSocketKeepAliveMessage);
  } catch {}
  return baseline;
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function changeDetailWithCounts(beforeCount, afterCount) {
  if (beforeCount !== afterCount) {
    return beforeCount + '→' + afterCount;
  }
  return tr('webview.requestDiffEdited');
}

function buildRequestChangeItems(tab) {
  if (!tab) return [];
  var baseline = createRequestChangeBaseline(tab);
  var items = [];
  if (baseline.method !== tab.method || baseline.url !== tab.url) {
    items.push({
      label: tr('webview.requestDiffRequest'),
      detail: baseline.method !== tab.method ? baseline.method + '→' + tab.method : tr('webview.requestDiffEdited'),
      action: 'focus-url'
    });
  }
  if (!sameJson(baseline.params, tab.params)) {
    items.push({
      label: tr('webview.requestDiffParams'),
      detail: changeDetailWithCounts(countEnabledKeyValues(baseline.params), countEnabledKeyValues(tab.params)),
      action: 'switch-tab',
      meta: 'params'
    });
  }
  if (!sameJson(baseline.headers, tab.headers)) {
    items.push({
      label: tr('webview.requestDiffHeaders'),
      detail: changeDetailWithCounts(countEnabledKeyValues(baseline.headers), countEnabledKeyValues(tab.headers)),
      action: 'switch-tab',
      meta: 'headers'
    });
  }
  if (
    baseline.body !== tab.body ||
    baseline.bodyType !== tab.bodyType ||
    baseline.binaryFilePath !== tab.binaryFilePath ||
    !sameJson(baseline.formData, tab.formData)
  ) {
    var bodyDetail = baseline.bodyType !== tab.bodyType
      ? String(baseline.bodyType || 'none') + '→' + String(tab.bodyType || 'none')
      : (tab.bodyType === 'formdata'
        ? changeDetailWithCounts(countEnabledFormData(baseline.formData), countEnabledFormData(tab.formData))
        : tr('webview.requestDiffEdited'));
    items.push({
      label: tr('webview.requestDiffBody'),
      detail: bodyDetail,
      action: 'switch-tab',
      meta: 'body'
    });
  }
  if (!sameJson(baseline.auth, tab.auth)) {
    items.push({
      label: tr('webview.requestDiffAuth'),
      detail: tr('webview.requestDiffUpdated'),
      action: 'switch-tab',
      meta: 'auth'
    });
  }
  if (!sameJson(baseline.scripts, tab.scripts)) {
    items.push({
      label: tr('webview.requestDiffScripts'),
      detail: tr('webview.requestDiffUpdated'),
      action: 'switch-tab',
      meta: 'scripts'
    });
  }
  if (!sameJson(requestSettingsSnapshot(baseline), requestSettingsSnapshot(tab))) {
    items.push({
      label: tr('webview.requestDiffSettings'),
      detail: tr('webview.requestDiffUpdated'),
      action: 'switch-tab',
      meta: 'settings'
    });
  }
  return items;
}

function renderRequestChangeSummary(tab) {
  if (!tab) return '<div class="request-change-summary empty"></div>';
  tab.dirty = isTabDirty(tab);
  if (!tab.dirty) return '<div class="request-change-summary empty"></div>';
  var items = buildRequestChangeItems(tab);
  if (!items.length) return '<div class="request-change-summary empty"></div>';
  return '<div class="request-change-summary">' +
    '<div class="request-change-summary-head">' +
      '<div class="request-change-summary-title">' + escapeHtml(tr('webview.requestDiffTitle')) + '</div>' +
      '<div class="request-change-summary-copy">' + escapeHtml(tfCount('webview.requestDiffCount', items.length)) + '</div>' +
    '</div>' +
    '<div class="request-change-chip-row">' +
      items.map(function(item) {
        var attrs = ' type="button" class="request-change-chip clickable" data-action="' + escapeAttr(item.action) + '"' + (item.meta ? ' data-meta="' + escapeAttr(item.meta) + '"' : '') + '>';
        return '<button' + attrs +
          '<span class="delta-label">' + escapeHtml(item.label) + '</span>' +
          '<span class="delta-value">' + escapeHtml(item.detail) + '</span>' +
        '</button>';
      }).join('') +
    '</div>' +
  '</div>';
}

function refreshRequestChangeSummary(mc) {
  var wrap = mc?.querySelector('.js-request-change-summary-wrap');
  if (!wrap) return;
  var draftTab = buildDraftTabFromContent(mc);
  wrap.innerHTML = renderRequestChangeSummary(draftTab);
}

function renderRequestDirtyTitle(tab) {
  var baseTitle = tr('webview.unsavedChanges');
  if (!tab) return baseTitle;
  var items = buildRequestChangeItems(tab);
  if (!items.length) return baseTitle;
  return baseTitle + ' · ' + tfCount('webview.requestDiffCount', items.length);
}

function addVariableUsage(usageMap, value, scopeLabel) {
  if (!value) return;
  var matches = String(value).match(/\{\{([^}]+)\}\}/g) || [];
  matches.forEach(function(token) {
    var name = token.slice(2, -2).trim();
    if (!name) return;
    if (!usageMap[name]) {
      usageMap[name] = new Set();
    }
    usageMap[name].add(scopeLabel);
  });
}

function collectVariableUsage(tab) {
  var usageMap = {};
  addVariableUsage(usageMap, tab.url, tr('webview.varScopeUrl'));
  (tab.params || []).forEach(function(item) {
    if (!item || item.enabled === false) return;
    addVariableUsage(usageMap, item.key, tr('webview.varScopeParams'));
    addVariableUsage(usageMap, item.value, tr('webview.varScopeParams'));
  });
  (tab.headers || []).forEach(function(item) {
    if (!item || item.enabled === false) return;
    addVariableUsage(usageMap, item.key, tr('webview.varScopeHeaders'));
    addVariableUsage(usageMap, item.value, tr('webview.varScopeHeaders'));
  });
  if (!tab.skipDefaultHeaders) {
    (workspaceDefaultHeaders || []).forEach(function(item) {
      if (!item || item.enabled === false) return;
      addVariableUsage(usageMap, item.key, tr('webview.varScopeDefaultHeaders'));
      addVariableUsage(usageMap, item.value, tr('webview.varScopeDefaultHeaders'));
    });
  }
  addVariableUsage(usageMap, tab.body, tr('webview.varScopeBody'));
  (tab.formData || []).forEach(function(field) {
    if (!field || field.enabled === false) return;
    addVariableUsage(usageMap, field.key, tr('webview.varScopeFormData'));
    addVariableUsage(usageMap, field.value, tr('webview.varScopeFormData'));
  });
  addVariableUsage(usageMap, tab.binaryFilePath, tr('webview.varScopeBinary'));
  if (tab.auth?.basic) {
    addVariableUsage(usageMap, tab.auth.basic.username, tr('webview.varScopeAuth'));
    addVariableUsage(usageMap, tab.auth.basic.password, tr('webview.varScopeAuth'));
  }
  if (tab.auth?.bearer) {
    addVariableUsage(usageMap, tab.auth.bearer.token, tr('webview.varScopeAuth'));
  }
  if (tab.auth?.apikey) {
    addVariableUsage(usageMap, tab.auth.apikey.key, tr('webview.varScopeAuth'));
    addVariableUsage(usageMap, tab.auth.apikey.value, tr('webview.varScopeAuth'));
  }
  addVariableUsage(usageMap, tab.scripts?.preRequest, tr('webview.varScopeScripts'));
  addVariableUsage(usageMap, tab.scripts?.test, tr('webview.varScopeScripts'));
  return Object.keys(usageMap).sort(function(left, right) { return left.localeCompare(right); }).map(function(name) {
    return { name: name, scopes: Array.from(usageMap[name]).sort() };
  });
}

function renderVariableUsage(tab) {
  var usage = collectVariableUsage(tab);
  if (!usage.length) return '<div class="var-usage hidden"></div>';
  return '<div class="var-usage">' +
    '<div class="var-usage-head">' +
      '<div class="var-usage-title">' + escapeHtml(tr('webview.variableUsageTitle')) + '</div>' +
      '<div class="var-usage-copy">' + escapeHtml(tfCount('webview.variableUsageCount', usage.length)) + '</div>' +
    '</div>' +
    '<div class="var-usage-grid">' +
      usage.map(function(item) {
        return '<div class="var-usage-card">' +
          '<span class="var-usage-name">{{' + escapeHtml(item.name) + '}}</span>' +
          '<div class="var-usage-scopes">' +
            item.scopes.map(function(scope) {
              return '<span class="var-usage-scope">' + escapeHtml(scope) + '</span>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</div>';
}

function refreshVariableUsage(mc) {
  var wrap = mc?.querySelector('.js-variable-usage-wrap');
  if (wrap) {
    var draftTab = buildDraftTabFromContent(mc);
    wrap.innerHTML = renderVariableUsage(draftTab);
  }
  // compose 경로에 영구 카드가 없으므로 스트립 상세를 함께 갱신
  if (mc?.querySelector('.js-status-strip-host')) {
    refreshStatusStrip(mc);
  }
}

function refreshFormDataSummary(mc) {
  var wrap = mc?.querySelector('.js-formdata-summary');
  if (!wrap) return;
  wrap.innerHTML = renderFormDataSummary(collectFormData(mc.querySelector('.js-formdata-rows')));
}

function syncSettingsToggleStates(mc) {
  if (!mc) return;
  var syncTone = function(selector, className, enabled) {
    var label = mc.querySelector(selector)?.closest('.settings-toggle');
    if (!label) return;
    label.classList.toggle(className, enabled === true);
  };
  syncTone('.js-stop-after-headers', 'risk-muted', mc.querySelector('.js-stop-after-headers')?.checked === true);
  syncTone('.js-save-history', 'risk-muted', mc.querySelector('.js-save-history')?.checked !== true);
  syncTone('.js-skip-default-headers', 'risk-warning', mc.querySelector('.js-skip-default-headers')?.checked === true);
  syncTone('.js-disable-scripts', 'risk-warning', mc.querySelector('.js-disable-scripts')?.checked === true);
}

function refreshDraftInsights(mc, options) {
  var opts = options || {};
  syncSettingsToggleStates(mc);
  refreshDefaultHeadersBanner(mc);
  refreshToplineStatusChips(mc);
  refreshRequestPreflight(mc);
  refreshVariableUsage(mc);
  refreshFormDataSummary(mc);
  syncVariablePreviewHints(mc);
  if (opts.renderContent === true) {
    renderContent();
  }
}

function renderUnresolvedVariableBanner(tab) {
  var unresolved = getUnresolvedDraftVariableNames(tab);
  if (unresolved.length === 0) return '';
  return '<div class="preflight-warning">' +
    '<div class="preflight-warning-title">' + escapeHtml(tfCount('webview.unresolvedVariablesCount', unresolved.length)) + '</div>' +
    '<div class="preflight-warning-copy">' + escapeHtml(unresolved.map(function(name) { return '{{' + name + '}}'; }).join(', ')) + '</div>' +
    '<div class="preflight-warning-actions">' +
      '<button class="ghost-btn ripple-btn js-preflight-action" type="button" data-action="switch-environment">' + escapeHtml(tr('webview.openEnvironmentPicker')) + '</button>' +
      '<button class="ghost-btn ripple-btn js-preflight-action" type="button" data-action="switch-tab" data-meta="headers">' + escapeHtml(tr('webview.reviewRequestInputs')) + '</button>' +
    '</div>' +
  '</div>';
}

function renderRequestPreflight(tab) {
  if (!tab) return '';
  var headerCount = (tab.headers || []).filter(function(item) { return item && item.enabled !== false && item.key; }).length;
  var paramCount = (tab.params || []).filter(function(item) { return item && item.enabled !== false && item.key; }).length;
  var unresolved = getUnresolvedDraftVariableNames(tab);
  var pills = [
    renderPreflightPill(currentEnvName ? tf('webview.summaryEnvironment', { name: currentEnvName }) : tr('webview.noEnvironment'), currentEnvName ? 'info' : 'warning', 'switch-environment'),
    renderPreflightPill(tf('webview.summaryAuth', { value: authSummaryLabel(tab.auth) }), tab.auth?.type && tab.auth.type !== 'none' ? 'accent' : 'muted', 'switch-tab', 'auth'),
    renderPreflightPill(tfCount('webview.summaryHeaders', headerCount), headerCount > 0 ? 'accent' : 'muted', 'switch-tab', 'headers'),
    renderPreflightPill(tfCount('webview.summaryParams', paramCount), paramCount > 0 ? 'accent' : 'muted', 'switch-tab', 'params'),
    renderPreflightPill(tab.disableScripts ? tr('webview.summaryScriptsOff') : tr('webview.summaryScriptsOn'), tab.disableScripts ? 'warning' : 'info', 'switch-tab', tab.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request'),
    renderPreflightPill(tab.saveToHistory === false ? tr('webview.summaryHistoryOff') : tr('webview.summaryHistoryOn'), tab.saveToHistory === false ? 'muted' : 'info', 'switch-tab', 'settings:save-history')
  ];
  if (unresolved.length > 0) {
    pills.unshift(renderPreflightPill(tfCount('webview.unresolvedVariablesCount', unresolved.length), 'warning', 'switch-environment'));
  }
  return '<div class="request-preflight js-request-preflight">' +
    '<div class="request-preflight-pills">' + pills.join('') + '</div>' +
    renderUnresolvedVariableBanner(tab) +
  '</div>';
}

function scriptTemplateSource(name) {
  var nl = String.fromCharCode(10);
  if (name === 'preRequestEnv') {
    return [
      'pm.environment.set("requestStartedAt", String(Date.now()));',
      'console.log("requestStartedAt", pm.environment.get("requestStartedAt"));'
    ].join(nl);
  }
  if (name === 'testCaptureValue') {
    return [
      'const body = pm.response.json();',
      '',
      'pm.test("response has key", function () {',
      '  pm.expect(body).to.have.property("key");',
      '});',
      '',
      'pm.environment.set("sessionKey", String(body.key));'
    ].join(nl);
  }
  if (name === 'testStatusCheck') {
    return [
      'pm.test("status is 200", function () {',
      '  pm.response.to.have.status(200);',
      '});',
      '',
      'const body = pm.response.json();',
      '',
      'pm.test("title exists", function () {',
      '  pm.expect(body).to.have.property("title");',
      '});'
    ].join(nl);
  }
  return '';
}

function renderScriptHelpers(_tab) {
  return '<div class="script-help-line">' +
    '<span class="script-help-line-copy">' + escapeHtml(tr('webview.scriptHelpOneLiner')) + '</span>' +
    '<button type="button" class="script-help-line-link js-open-script-guide">' + escapeHtml(tr('webview.emptyActionGuide')) + '</button>' +
  '</div>';
}

function insertScriptTemplate(mc, targetName, templateName) {
  var input = mc?.querySelector(targetName === 'preRequest' ? '.js-script-prerequest' : '.js-script-test');
  if (!input) return;
  var template = scriptTemplateSource(templateName);
  if (!template) return;
  var existing = String(input.value || '').trim();
  var doubleBreak = String.fromCharCode(10) + String.fromCharCode(10);
  input.value = existing ? (existing + doubleBreak + template) : template;
  input.focus();
  input.selectionStart = input.selectionEnd = input.value.length;
  markDirty();
  refreshDraftInsights(mc);
}

function collapseWhitespace(text) {
  var cr = String.fromCharCode(13);
  var lf = String.fromCharCode(10);
  var tab = String.fromCharCode(9);
  var ff = String.fromCharCode(12);
  return String(text || '')
    .split(cr).join(' ')
    .split(lf).join(' ')
    .split(tab).join(' ')
    .split(ff).join(' ')
    .split(' ')
    .filter(function(part) { return part.length > 0; })
    .join(' ');
}

function formatShortTime(date) {
  try {
    return new Intl.DateTimeFormat(appDateLocale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

function bodyTypeLabel(type) {
  var map = {
    none: tr('webview.none'),
    json: 'JSON',
    xml: 'XML',
    form: tr('webview.formUrlEncoded'),
    formdata: tr('webview.formData'),
    binary: tr('webview.binary'),
    raw: tr('webview.raw'),
  };
  return map[type] || type;
}

function authTypeLabel(type) {
  var map = {
    none: tr('webview.noAuth'),
    basic: tr('webview.basicAuth'),
    bearer: tr('webview.bearerToken'),
    apikey: tr('webview.apiKey'),
  };
  return map[type] || type;
}

function isWebSocketUrl(url) {
  return /^wss?:\\/\\//i.test(String(url || '').trim());
}

function hasUnresolvedTemplateVariables(text) {
  return /\\{\\{[^}]+\\}\\}/.test(String(text || ''));
}

function hasTemplateVariables(text) {
  return /\\{\\{[^}]+\\}\\}/.test(String(text || ''));
}

function resolveTemplateVariables(text) {
  if (!text) return text;
  var resolved = String(text);
  for (var depth = 0; depth < 10; depth++) {
    var changed = false;
    resolved = resolved.replace(/\\{\\{([^}]+)\\}\\}/g, function(match, name) {
      var key = String(name || '').trim();
      if (!Object.prototype.hasOwnProperty.call(activeVarValues, key)) return match;
      var value = String(activeVarValues[key] ?? '');
      if (value === match) return match;
      changed = true;
      return value;
    });
    if (!changed) break;
  }
  return resolved;
}

function getUrlModeInfo(rawUrl) {
  var raw = String(rawUrl || '').trim();
  var resolved = String(resolveTemplateVariables(raw) || '').trim();
  var hasVariables = hasTemplateVariables(raw);
  var unresolved = hasVariables && hasUnresolvedTemplateVariables(resolved);
  return {
    rawUrl: raw,
    resolvedUrl: resolved && !unresolved ? resolved : '',
    hasVariables: hasVariables,
    unresolved: unresolved
  };
}

function getResolvedUrlForMode(rawUrl) {
  return getUrlModeInfo(rawUrl).resolvedUrl;
}

function normalizeRequestType(value, url) {
  var modeInfo = getUrlModeInfo(url);
  var candidate = modeInfo.resolvedUrl || (modeInfo.unresolved ? '' : modeInfo.rawUrl);
  if (isWebSocketUrl(candidate)) return 'websocket';
  if (/^https?:\\/\\//i.test(candidate)) return 'http';
  if (candidate) return 'http';
  return value === 'websocket' && isWebSocketUrl(modeInfo.rawUrl) && !modeInfo.unresolved ? 'websocket' : 'http';
}

function syncRequestTypeFromUrl(tab) {
  if (!tab) return 'http';
  tab.requestType = normalizeRequestType(tab.requestType, tab.url);
  return tab.requestType;
}

function syncAllRequestTypesFromUrls() {
  tabs.forEach(syncRequestTypeFromUrl);
}

function isWebSocketTab(tab) {
  return !!(tab && normalizeRequestType(tab.requestType, tab.url) === 'websocket');
}

function normalizeCompareList(value, fallback) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return String(item || '').trim(); }).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(function(item) { return item.trim(); }).filter(Boolean);
  }
  return fallback.slice();
}

function normalizeCompareSettings(value) {
  var mode = value && (value.mode === 'raw' || value.mode === 'pretty' || value.mode === 'normalized')
    ? value.mode
    : 'normalized';
  return {
    mode: mode,
    includeMetadataSummary: value ? value.includeMetadataSummary !== false : true,
    foldUnchangedSections: value ? value.foldUnchangedSections !== false : DEFAULT_COMPARE_FOLD_UNCHANGED,
    ignoreHeaders: normalizeCompareList(value && value.ignoreHeaders, DEFAULT_COMPARE_IGNORE_HEADERS),
    ignoreJsonPaths: normalizeCompareList(value && value.ignoreJsonPaths, DEFAULT_COMPARE_IGNORE_JSON_PATHS)
  };
}

function cloneCompareSettings(value) {
  var normalized = normalizeCompareSettings(value);
  return {
    mode: normalized.mode,
    includeMetadataSummary: normalized.includeMetadataSummary,
    foldUnchangedSections: normalized.foldUnchangedSections,
    ignoreHeaders: normalized.ignoreHeaders.slice(),
    ignoreJsonPaths: normalized.ignoreJsonPaths.slice()
  };
}

function compareModeShort(mode) {
  return mode === 'raw' ? tr('webview.modeRaw') : mode === 'pretty' ? tr('webview.modePretty') : tr('webview.modeNormalized');
}

function compareModeLabel(mode) {
  return mode === 'raw' ? tr('webview.modeRaw') : mode === 'pretty' ? tr('webview.modePretty') : tr('webview.modeNormalized');
}

function simpleHash(value) {
  var hash = 5381;
  for (var i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(36);
}

function buildResponseSignature(snapshot) {
  return [
    snapshot.status || 0,
    snapshot.statusText || '',
    snapshot.contentType || '',
    snapshot.resolvedUrl || '',
    snapshot.body ? snapshot.body.length : 0,
    simpleHash(snapshot.bodyBase64 || snapshot.body || '')
  ].join('|');
}

function createResponseSnapshot(tab, response, label) {
  if (!tab || !response) return null;
  var ct = response.headers?.['content-type'] || response.headers?.['Content-Type'] || 'text/plain';
  var snapshot = {
    label: label,
    body: response.body || '',
    bodyBase64: response.bodyBase64 || '',
    contentType: ct,
    status: response.status,
    statusText: response.statusText,
    size: response.size,
    time: response.time,
    resolvedUrl: tab.resolvedUrl || tab.url || '',
    headers: response.headers || {},
    timestamp: Date.now(),
    jsonFormatStyle: tab.jsonFormatStyle || 'pretty',
    xmlFormatStyle: tab.xmlFormatStyle || 'inline',
    formatIndent: tab.formatIndent || '2'
  };
  snapshot.signature = buildResponseSignature(snapshot);
  return snapshot;
}

function getActiveResponseSnapshot() {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return null;
  var envLabel = currentEnvName ? '[' + currentEnvName + ']' : '';
  var timeLabel = formatShortTime(new Date());
  var label = ((tab.name || (tab.method + ' ' + tab.url)) + ' ' + envLabel + ' ' + timeLabel).trim();
  return createResponseSnapshot(tab, tab.response, label);
}

function serializeCompareSnapshot(snapshot) {
  return {
    label: snapshot.label,
    body: snapshot.body,
    bodyBase64: snapshot.bodyBase64 || '',
    contentType: snapshot.contentType,
    status: snapshot.status,
    statusText: snapshot.statusText,
    size: snapshot.size,
    time: snapshot.time,
    resolvedUrl: snapshot.resolvedUrl,
    headers: snapshot.headers || {},
    timestamp: snapshot.timestamp,
    jsonFormatStyle: snapshot.jsonFormatStyle || 'pretty',
    xmlFormatStyle: snapshot.xmlFormatStyle || 'inline',
    formatIndent: snapshot.formatIndent || '2'
  };
}

function requestCompare(left, right) {
  if (!left || !right) return;
  vscode.postMessage({
    type: 'compareResponses',
    left: serializeCompareSnapshot(left),
    right: serializeCompareSnapshot(right),
    options: cloneCompareSettings(compareSettings)
  });
}

function compareCurrentWithLast() {
  var current = getActiveResponseSnapshot();
  if (!current || !lastResponse) return;
  requestCompare(lastResponse, current);
}

function buildCompareChipMarkup(currentSignature) {
  var compareContextActive = !!lastResponse || pinnedResponses.length > 0;
  return '<span class="compare-chip mode"><strong>' + escapeHtml(tr('webview.mode')) + '</strong> ' + escapeHtml(compareModeShort(compareSettings.mode)) + '</span>' +
    (compareSettings.includeMetadataSummary ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.includeMetadata')) + '</span>' : '') +
    (compareContextActive && compareSettings.foldUnchangedSections ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.compareFoldUnchanged')) + '</span>' : '') +
    (lastResponse ? '<span class="compare-chip ready"><strong>' + escapeHtml(tr('webview.last')) + '</strong> ' + escapeHtml(tr('webview.lastReady')) + '</span>' : '') +
    (pinnedResponses.length >= 2 ? '<span class="compare-chip ready">' + escapeHtml(tr('webview.comparePinned')) + '</span>' : '') +
    pinnedResponses.map(function(pin, index) {
      var current = pin.signature === currentSignature;
      return '<span class="compare-chip' + (current ? ' current' : '') + '">' +
        '<strong>' + escapeHtml(current ? tr('webview.pinnedHere') : tf('webview.pinNumber', { count: index + 1 })) + '</strong>' +
        escapeHtml(truncate(pin.label || tr('webview.savedResponse'), 24)) +
      '</span>';
    }).join('');
}

function buildCompareContextCueText() {
  var compareActive = pinnedResponses.length >= 2 || !!lastResponse;
  var nonDefaultMode = compareSettings.mode !== 'normalized';
  var parts = [];
  if (compareActive || nonDefaultMode) {
    parts.push(compareModeShort(compareSettings.mode));
  }
  // Compact Metadata cue only when compare context or non-default mode is already visible.
  if (compareSettings.includeMetadataSummary && (compareActive || nonDefaultMode)) {
    parts.push(tr('webview.metadata'));
  }
  return parts.join(' · ');
}

function syncCompareContextIndicator(mc, currentSignature) {
  var chipRow = mc.querySelector('.js-compare-chip-row');
  if (!chipRow) return;
  var cueText = buildCompareContextCueText();
  if (cueText) {
    // Quiet Instrument: compact text only — never rebuild the old chip/pill wall here.
    chipRow.className = 'compare-active-indicator js-compare-chip-row';
    chipRow.textContent = cueText;
    return;
  }
  chipRow.className = 'js-compare-chip-row visually-hidden';
  chipRow.innerHTML = buildCompareChipMarkup(currentSignature || '');
}

function updatePinCompareButtons(mc) {
  var activeSnapshot = getActiveResponseSnapshot();
  var currentPinned = activeSnapshot
    ? pinnedResponses.some(function(pin) { return pin.signature === activeSnapshot.signature; })
    : false;
  var pinCountSuffix = pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '';
  var compareReady = pinnedResponses.length >= 2;

  var pinBtn = mc.querySelector('.js-pin-response');
  if (pinBtn) {
    pinBtn.classList.toggle('pinned', currentPinned);
    pinBtn.disabled = false;
    var pinLabel = (currentPinned ? tr('webview.unpin') : tr('webview.pin')) + pinCountSuffix;
    pinBtn.innerHTML = pinSvg + '<span class="action-label">' + escapeHtml(pinLabel) + '</span>';
    pinBtn.title = tr('webview.pinResponse') + pinCountSuffix;
    pinBtn.setAttribute('aria-label', pinLabel);
  }

  var cmpBtn = mc.querySelector('.js-compare-responses');
  if (cmpBtn) {
    if (compareReady) {
      cmpBtn.disabled = false;
      cmpBtn.classList.add('ready');
      cmpBtn.title = tr('webview.comparePinned') + ' ' + compareModeShort(compareSettings.mode) + pinCountSuffix;
    } else {
      cmpBtn.disabled = true;
      cmpBtn.classList.remove('ready');
      cmpBtn.title = tr('webview.compareNeedsPin');
    }
    cmpBtn.innerHTML = diffSvg + '<span class="action-label">' + escapeHtml(tr('webview.compare')) + '</span>';
    cmpBtn.setAttribute('aria-label', tr('webview.compare'));
  }

  var compareLastBtn = mc.querySelector('.js-compare-last');
  if (compareLastBtn) {
    compareLastBtn.disabled = !lastResponse;
    compareLastBtn.innerHTML = '<span class="action-label">' + escapeHtml(tr('webview.last')) + '</span>';
  }

  var settingsBtn = mc.querySelector('.js-compare-settings');
  if (settingsBtn) {
    settingsBtn.innerHTML = '<span class="action-label">' + escapeHtml(tr('webview.mode') + ': ' + compareModeShort(compareSettings.mode)) + '</span>';
  }

  syncCompareContextIndicator(mc, activeSnapshot ? activeSnapshot.signature : '');
}
var pinSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1C8.55228 1 9 1.44772 9 2V7.586L12.707 3.879C13.098 3.488 13.731 3.488 14.121 3.879C14.512 4.269 14.512 4.902 14.121 5.293L9 10.414V14C9 14.5523 8.55228 15 8 15C7.44772 15 7 14.5523 7 14V10.414L1.879 5.293C1.488 4.902 1.488 4.269 1.879 3.879C2.269 3.488 2.902 3.488 3.293 3.879L7 7.586V2C7 1.44772 7.44772 1 8 1Z"/></svg>';
var diffSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4h5v1H2V4zm0 3h5v1H2V7zm0 3h5v1H2v-1zm9-6h5v1h-5V4zm0 3h5v1h-5V7zm0 3h5v1h-5v-1zM8 1v14l-1-1V2l1-1z"/></svg>';

function showCompareSettings() {
  var old = document.getElementById('compareSettingsOverlay');
  if (old) old.remove();

  var draft = cloneCompareSettings(compareSettings);
  var overlay = document.createElement('div');
  overlay.id = 'compareSettingsOverlay';
  overlay.className = 'dirty-confirm-overlay';
  overlay.innerHTML =
    '<div class="dirty-confirm-dialog compare-settings-dialog">' +
      '<div class="dirty-confirm-msg">' + escapeHtml(tr('webview.comparisonSettings')) + '</div>' +
      '<div class="compare-settings-grid">' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.mode')) + '</label>' +
          '<div class="compare-mode-options">' +
            '<button class="compare-mode-chip' + (draft.mode === 'raw' ? ' active' : '') + '" data-mode="raw">' + escapeHtml(tr('webview.modeRaw')) + '</button>' +
            '<button class="compare-mode-chip' + (draft.mode === 'normalized' ? ' active' : '') + '" data-mode="normalized">' + escapeHtml(tr('webview.modeNormalized')) + '</button>' +
            '<button class="compare-mode-chip' + (draft.mode === 'pretty' ? ' active' : '') + '" data-mode="pretty">' + escapeHtml(tr('webview.modePretty')) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label><input type="checkbox" class="js-compare-metadata"' + (draft.includeMetadataSummary ? ' checked' : '') + '/> ' + escapeHtml(tr('webview.includeMetadata')) + '</label>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label><input type="checkbox" class="js-compare-fold-unchanged"' + (draft.foldUnchangedSections ? ' checked' : '') + '/> ' + escapeHtml(tr('webview.compareFoldUnchanged')) + '</label>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.ignoredHeaders')) + '</label>' +
          '<input type="text" class="compare-settings-input js-compare-ignore-headers" value="' + escapeAttr(draft.ignoreHeaders.join(', ')) + '"/>' +
        '</div>' +
        '<div class="compare-settings-row">' +
          '<label>' + escapeHtml(tr('webview.ignoredJsonPaths')) + '</label>' +
          '<input type="text" class="compare-settings-input js-compare-ignore-paths" value="' + escapeAttr(draft.ignoreJsonPaths.join(', ')) + '"/>' +
        '</div>' +
        '<div class="compare-settings-note">' + escapeHtml(tr('webview.normalizedModeNote')) + '</div>' +
      '</div>' +
      '<div class="dirty-confirm-actions compare-settings-actions">' +
        '<button class="dirty-btn dirty-btn-discard" data-action="reset">' + escapeHtml(tr('webview.reset')) + '</button>' +
        '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
        '<button class="dirty-btn dirty-btn-save" data-action="save">' + escapeHtml(tr('webview.save')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  overlay.querySelectorAll('.compare-mode-chip').forEach(function(button) {
    button.addEventListener('click', function(event) {
      event.preventDefault();
      draft.mode = button.dataset.mode;
      overlay.querySelectorAll('.compare-mode-chip').forEach(function(chip) {
        chip.classList.toggle('active', chip === button);
      });
    });
  });

  overlay.addEventListener('click', function(event) {
    var target = event.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    if (action === 'cancel') {
      overlay.remove();
      return;
    }

    if (action === 'reset') {
      overlay.remove();
      compareSettings = cloneCompareSettings({
        mode: 'normalized',
        includeMetadataSummary: true,
        foldUnchangedSections: DEFAULT_COMPARE_FOLD_UNCHANGED,
        ignoreHeaders: DEFAULT_COMPARE_IGNORE_HEADERS,
        ignoreJsonPaths: DEFAULT_COMPARE_IGNORE_JSON_PATHS
      });
      renderContent();
      debouncePersist();
      return;
    }

    draft.includeMetadataSummary = !!overlay.querySelector('.js-compare-metadata')?.checked;
    draft.foldUnchangedSections = !!overlay.querySelector('.js-compare-fold-unchanged')?.checked;
    draft.ignoreHeaders = normalizeCompareList(
      overlay.querySelector('.js-compare-ignore-headers')?.value || '',
      []
    );
    draft.ignoreJsonPaths = normalizeCompareList(
      overlay.querySelector('.js-compare-ignore-paths')?.value || '',
      []
    );
    compareSettings = normalizeCompareSettings(draft);
    overlay.remove();
    renderContent();
    debouncePersist();
  });
}

function normalizeBodyType(bodyType) {
  if (VALID_BODY_TYPES.indexOf(bodyType) >= 0) return bodyType;
  return bodyType === 'text' ? 'raw' : 'none';
}


const tabBar = document.getElementById('tabBar');
const addTabBtn = document.getElementById('addTabBtn');
const mainContent = document.getElementById('mainContent');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');

window.addEventListener('resize', function() {
  var reqArea = mainContent?.querySelector('.req-area');
  if (!reqArea) return;
  var splitEl = mainContent.querySelector('.split');
  var dividerEl = mainContent.querySelector('.divider');
  var progressEl = mainContent.querySelector('.bullet-progress');
  var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
  if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(activeTab)) {
    applyManualRequestAreaHeight(
      reqArea,
      splitEl,
      dividerEl,
      progressEl,
      reqArea.offsetHeight || reqArea.style.height,
      activeTab,
      false
    );
    return;
  }
  applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, activeTab);
});

function setTextContent(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function normalizeRequestPanelTheme(theme) {
  return REQUEST_PANEL_THEMES.indexOf(theme) >= 0 ? theme : 'default';
}

function applyRequestPanelTheme(theme) {
  currentRequestPanelTheme = normalizeRequestPanelTheme(theme);
  if (document.body) {
    document.body.setAttribute('data-panel-theme', currentRequestPanelTheme);
  }
}

function updateStaticLocalizedText() {
  document.documentElement.lang = currentDisplayLanguage;
  addTabBtn.title = tr('webview.newTab');
  addTabBtn.setAttribute('aria-label', tr('webview.newTab'));
  tabBar.setAttribute('aria-label', tr('webview.requestTabs'));
  if (emptyPlaceholder) emptyPlaceholder.textContent = tr('webview.emptyPlaceholder');
  setTextContent('envEditorTitle', tr('webview.environment'));
  setTextContent('envAutoSavedLabel', tr('webview.autoSaved'));
  setTextContent('addEnvVarBtn', tr('webview.addVariable'));
  setTextContent('defaultHeadersTitle', tr('webview.defaultHeaders'));
  setTextContent('defaultHeadersSaveBtn', tr('webview.save'));
  setTextContent('addDefaultHeaderBtn', tr('webview.addHeader'));
  var envDirty = document.getElementById('envDirtyDot');
  if (envDirty) envDirty.title = tr('webview.unsavedChanges');
  var envClose = document.getElementById('envCloseBtn');
  if (envClose) {
    envClose.title = tr('webview.close');
    envClose.setAttribute('aria-label', tr('webview.close'));
  }
  refreshEnvironmentEditorSummary();
  var defaultHeadersClose = document.getElementById('defaultHeadersCloseBtn');
  if (defaultHeadersClose) {
    defaultHeadersClose.title = tr('webview.close');
    defaultHeadersClose.setAttribute('aria-label', tr('webview.close'));
  }
}

function applyLocalizationUpdate(msg) {
  if (msg.strings && typeof msg.strings === 'object') {
    i18n = msg.strings;
  }
  if (typeof msg.dateLocale === 'string' && msg.dateLocale) {
    appDateLocale = msg.dateLocale;
  }
  if (typeof msg.displayLanguage === 'string' && msg.displayLanguage) {
    currentDisplayLanguage = msg.displayLanguage;
  }
  if (typeof msg.requestPanelTheme === 'string' && msg.requestPanelTheme) {
    applyRequestPanelTheme(msg.requestPanelTheme);
  }
  tabs.forEach(function(tab) {
    if (tab.autoName || isKnownDefaultTabName(tab.name)) {
      tab.name = tr('webview.stage.newRequest');
      tab.autoName = true;
    }
  });
  updateStaticLocalizedText();
  envVarRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  defaultHeaderRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  renderTabBar();
  renderContent();
}

addTabBtn.addEventListener('click', () => createTab());
document.addEventListener('keydown', (e) => {
  const isPrimaryModifier = e.ctrlKey || e.metaKey;
  const digitMatch = /^Digit([1-6])$/.exec(e.code || '');

  if (isEditableTarget(e.target) && isBodyUndoRedoShortcut(e)) return;
  if (isPrimaryModifier && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(); return; }
  if (isPrimaryModifier && e.key.toLowerCase() === 'w' && activeTabId) { e.preventDefault(); closeTab(activeTabId); return; }
  if (isPrimaryModifier && e.key === 'Enter') { e.preventDefault(); handlePrimaryAction(); return; }
  if (isPrimaryModifier && e.key.toLowerCase() === 's') {
    e.preventDefault();
    triggerSaveFromShortcut(e.shiftKey);
    return;
  }
  if (isPrimaryModifier && e.key.toLowerCase() === 'f') {
    if (focusResponseSearchField()) {
      e.preventDefault();
    }
    return;
  }
  if (e.altKey && !e.ctrlKey && !e.metaKey && digitMatch) {
    const index = Number(digitMatch[1]) - 1;
    if (e.shiftKey) {
      const responseTabName = ['resBody', 'resCookies', 'resHeaders', 'resTests', 'resPreview'][index];
      if (responseTabName) {
        e.preventDefault();
        switchResponseTabInContent(mainContent, responseTabName);
      }
      return;
    }

    const requestTabName = ['params', 'headers', 'body', 'auth', 'scripts', 'settings'][index];
    if (requestTabName) {
      e.preventDefault();
      switchRequestEditorTabInContent(mainContent, requestTabName, { expand: true });
    }
  }
});

mainContent.addEventListener('mouseover', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  showVariablePreviewPopover(target);
});

mainContent.addEventListener('mouseout', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  if (event.relatedTarget && target.contains(event.relatedTarget)) return;
  hideVariablePreviewPopover();
});

mainContent.addEventListener('focusin', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  showVariablePreviewPopover(target);
});

mainContent.addEventListener('focusout', function(event) {
  var target = event.target.closest('input[type="text"], input[type="password"], textarea');
  if (!target || !mainContent.contains(target)) return;
  if (event.relatedTarget && target.contains(event.relatedTarget)) return;
  hideVariablePreviewPopover();
});

function knownDefaultTabNames() {
  return ['New Request', '새 요청', '新しいリクエスト', 'Nouvelle requête'];
}

function isKnownDefaultTabName(name) {
  return knownDefaultTabNames().indexOf(name) >= 0;
}


function normalizeNumberSetting(value) {
  var num = parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeMaxResponseSizeSetting(value) {
  var num = normalizeNumberSetting(value);
  return num > 0 ? num : DEFAULT_MAX_RESPONSE_SIZE_KB;
}

function normalizeWebSocketKeepAliveInterval(value) {
  var num = normalizeNumberSetting(value);
  if (num <= 0) return DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS;
  return Math.min(MAX_WS_KEEPALIVE_INTERVAL_SECONDS, Math.max(MIN_WS_KEEPALIVE_INTERVAL_SECONDS, num));
}

function normalizeWebSocketKeepAliveMessage(value) {
  var text = String(value ?? '').trim();
  return text || DEFAULT_WS_KEEPALIVE_MESSAGE;
}

function normalizeTlsValidation(value) {
  return value === 'strict' || value === 'insecure' ? value : 'default';
}

function getRequestSettings(data) {
  return {
    timeout: normalizeNumberSetting(data?.timeout),
    followRedirects: data?.followRedirects === true,
    saveToHistory: data?.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(data?.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(data?.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(data?.retryCount),
    retryDelayMs: normalizeNumberSetting(data?.retryDelayMs),
    stopAfterHeaders: data?.stopAfterHeaders === true,
    skipDefaultHeaders: data?.skipDefaultHeaders === true,
    disableScripts: data?.disableScripts === true,
    scriptsTrusted: data?.scriptsTrusted !== false,
    webSocketKeepAliveEnabled: data?.webSocketKeepAliveEnabled === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(data?.webSocketKeepAliveIntervalSeconds),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(data?.webSocketKeepAliveMessage),
  };
}

function applyRequestSettings(target, data) {
  var settings = getRequestSettings(data);
  target.timeout = settings.timeout;
  target.followRedirects = settings.followRedirects;
  target.saveToHistory = settings.saveToHistory;
  target.tlsValidation = settings.tlsValidation;
  target.maxResponseSizeKb = settings.maxResponseSizeKb;
  target.retryCount = settings.retryCount;
  target.retryDelayMs = settings.retryDelayMs;
  target.stopAfterHeaders = settings.stopAfterHeaders;
  target.skipDefaultHeaders = settings.skipDefaultHeaders;
  target.disableScripts = settings.disableScripts;
  target.scriptsTrusted = settings.scriptsTrusted;
  target.webSocketKeepAliveEnabled = settings.webSocketKeepAliveEnabled;
  target.webSocketKeepAliveIntervalSeconds = settings.webSocketKeepAliveIntervalSeconds;
  target.webSocketKeepAliveMessage = settings.webSocketKeepAliveMessage;
  return target;
}

function requestSettingsSnapshot(tab) {
  return {
    timeout: tab.timeout,
    followRedirects: !!tab.followRedirects,
    saveToHistory: tab.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(tab.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(tab.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(tab.retryCount),
    retryDelayMs: normalizeNumberSetting(tab.retryDelayMs),
    stopAfterHeaders: !!tab.stopAfterHeaders,
    skipDefaultHeaders: !!tab.skipDefaultHeaders,
    disableScripts: !!tab.disableScripts,
    scriptsTrusted: tab.scriptsTrusted !== false,
    webSocketKeepAliveEnabled: tab.webSocketKeepAliveEnabled === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage),
  };
}

function buildSaveRequestMessage(tab, requestId) {
  var payload = {
    type: 'saveRequest',
    requestType: normalizeRequestType(tab.requestType, tab.url),
    method: tab.method,
    url: tab.url,
    headers: tab.headers,
    params: tab.params,
    body: tab.body,
    bodyType: tab.bodyType,
    formData: tab.formData || [],
    binaryFilePath: tab.binaryFilePath || '',
    auth: tab.auth,
    scripts: tab.scripts || { preRequest: '', test: '' },
  };
  if (requestId !== undefined) {
    payload.requestId = requestId;
  }
  return Object.assign(payload, requestSettingsSnapshot(tab));
}

function snapshotTab(tab) {
  return JSON.stringify({
    requestType: normalizeRequestType(tab.requestType, tab.url),
    method: tab.method, url: tab.url,
    headers: tab.headers, params: tab.params,
    body: tab.body, bodyType: tab.bodyType,
    formData: tab.formData, binaryFilePath: tab.binaryFilePath,
    auth: tab.auth, scripts: tab.scripts,
    settings: requestSettingsSnapshot(tab)
  });
}


function isTabDirty(tab) {
  if (!tab) return false;
  
  if (!tab._snapshot) {
    return !!(
      tab.url ||
      tab.headers.some(function(h){return h.key||h.value}) ||
      tab.params.some(function(p){return p.key||p.value}) ||
      tab.body ||
      (tab.formData || []).some(function(field){return field.key || field.value}) ||
      tab.binaryFilePath ||
      tab.scripts?.preRequest ||
      tab.scripts?.test ||
      tab.timeout ||
      tab.followRedirects ||
      tab.saveToHistory === false ||
      (tab.tlsValidation && tab.tlsValidation !== 'default') ||
      tab.maxResponseSizeKb ||
      tab.retryCount ||
      tab.retryDelayMs ||
      tab.stopAfterHeaders ||
      tab.skipDefaultHeaders ||
      tab.disableScripts ||
      tab.webSocketKeepAliveEnabled ||
      normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds) !== DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS ||
      normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage) !== DEFAULT_WS_KEEPALIVE_MESSAGE
    );
  }
  
  return snapshotTab(tab) !== tab._snapshot;
}


function markDirty() {
  var tab = tabs.find(function(t){return t.id === activeTabId});
  if (!tab) return;
  saveActiveTabState();
  var wasDirty = tab.dirty;
  tab.dirty = isTabDirty(tab);
  if (tab.dirty !== wasDirty) renderTabBar();
}

function isEditableTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}

function isBodyUndoRedoShortcut(event) {
  if (!event || event.altKey) return false;
  var isPrimaryModifier = event.ctrlKey || event.metaKey;
  if (!isPrimaryModifier) return false;
  var key = String(event.key || '').toLowerCase();
  return key === 'z' || key === 'y';
}

function isBodyRedoShortcut(event) {
  var key = String(event.key || '').toLowerCase();
  return (key === 'y' && !event.shiftKey) || (key === 'z' && event.shiftKey);
}

function createBodyUndoSnapshot(value, textarea, extras) {
  var text = String(value || '');
  var fallbackOffset = text.length;
  var selectionStart = typeof textarea?.selectionStart === 'number' ? textarea.selectionStart : fallbackOffset;
  var selectionEnd = typeof textarea?.selectionEnd === 'number' ? textarea.selectionEnd : selectionStart;
  var snapshot = {
    value: text,
    selectionStart: Math.min(selectionStart, text.length),
    selectionEnd: Math.min(selectionEnd, text.length),
  };
  if (extras && extras.conversion) {
    snapshot.conversion = true;
    snapshot.bodyType = normalizeBodyType(extras.bodyType);
    snapshot.formData = cloneFormDataFields(extras.formData);
    snapshot.binaryFilePath = String(extras.binaryFilePath || '');
  }
  return snapshot;
}

function cloneFormDataFields(fields) {
  return (fields || []).map(function(field) {
    return {
      id: field.id || ('fd_' + Math.random().toString(36).slice(2, 10)),
      key: field.key || '',
      value: field.value || '',
      enabled: field.enabled !== false,
      type: field.type === 'file' ? 'file' : 'text',
    };
  });
}

function bodyUndoSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  if (a.value !== b.value) return false;
  if (!!a.conversion !== !!b.conversion) return false;
  if (a.conversion) {
    if (normalizeBodyType(a.bodyType) !== normalizeBodyType(b.bodyType)) return false;
    if (String(a.binaryFilePath || '') !== String(b.binaryFilePath || '')) return false;
    try {
      return JSON.stringify(a.formData || []) === JSON.stringify(b.formData || []);
    } catch {
      return false;
    }
  }
  return true;
}

function resetBodyUndoState(tab, value, textarea) {
  if (!tab) return null;
  var snapshot = createBodyUndoSnapshot(value, textarea);
  tab._bodyUndoState = {
    undo: [],
    redo: [],
    lastValue: snapshot.value,
    lastSelectionStart: snapshot.selectionStart,
    lastSelectionEnd: snapshot.selectionEnd,
    lastRecordedAt: 0,
    lastInputType: '',
    lastBodyType: normalizeBodyType(tab.bodyType),
  };
  return tab._bodyUndoState;
}

function ensureBodyUndoState(tab, textarea) {
  if (!tab) return null;
  var value = textarea ? textarea.value : (tab.body || '');
  if (!tab._bodyUndoState) {
    return resetBodyUndoState(tab, value, textarea);
  }
  if (!bodyUndoApplying && tab._bodyUndoState.lastValue !== String(value || '')) {
    return resetBodyUndoState(tab, value, textarea);
  }
  return tab._bodyUndoState;
}

function trimBodyUndoStack(stack) {
  while (stack.length > BODY_UNDO_MAX_ENTRIES) {
    stack.shift();
  }
}

function pushBodyUndoSnapshot(stack, snapshot) {
  if (!stack || !snapshot) return;
  var previous = stack[stack.length - 1];
  if (previous && bodyUndoSnapshotsEqual(previous, snapshot)) return;
  stack.push(snapshot);
  trimBodyUndoStack(stack);
}

function rememberBodyEditorSelection(tab, textarea) {
  var state = ensureBodyUndoState(tab, textarea);
  if (!state || !textarea) return;
  state.lastSelectionStart = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : state.lastValue.length;
  state.lastSelectionEnd = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : state.lastSelectionStart;
}

function normalizeBodyUndoInputType(event) {
  var inputType = String(event?.inputType || '');
  if (inputType.indexOf('delete') === 0 || inputType.indexOf('insertText') === 0) return 'typing';
  if (inputType.indexOf('history') === 0) return 'history';
  return inputType || 'input';
}

function recordBodyEditorInput(tab, textarea, event) {
  if (bodyUndoApplying || !tab || !textarea) return;
  var state = tab._bodyUndoState || resetBodyUndoState(tab, textarea.value, textarea);
  if (!state) return;
  var previousValue = state.lastValue;
  var nextValue = textarea.value;
  if (previousValue === nextValue) {
    rememberBodyEditorSelection(tab, textarea);
    return;
  }
  var now = Date.now();
  var inputType = normalizeBodyUndoInputType(event);
  var shouldCoalesce = inputType === 'typing'
    && state.lastInputType === 'typing'
    && state.undo.length > 0
    && now - state.lastRecordedAt <= BODY_UNDO_COALESCE_MS;
  if (!shouldCoalesce) {
    pushBodyUndoSnapshot(state.undo, {
      value: previousValue,
      selectionStart: state.lastSelectionStart,
      selectionEnd: state.lastSelectionEnd,
    });
  }
  state.redo = [];
  state.lastValue = nextValue;
  state.lastRecordedAt = now;
  state.lastInputType = inputType;
  rememberBodyEditorSelection(tab, textarea);
}

function captureBodyConversionUndoSnapshot(tab, textarea) {
  return createBodyUndoSnapshot(textarea ? textarea.value : (tab?.body || ''), textarea, {
    conversion: true,
    bodyType: tab?.bodyType || 'none',
    formData: tab?.formData || [],
    binaryFilePath: tab?.binaryFilePath || '',
  });
}

function applyBodyEditorUndoSnapshot(tab, textarea, snapshot) {
  if (!tab || !snapshot) return;
  bodyUndoApplying = true;
  var nextValue = snapshot.value;
  tab.body = nextValue;
  if (textarea) {
    textarea.value = nextValue;
  }
  if (snapshot.conversion) {
    tab.bodyType = normalizeBodyType(snapshot.bodyType);
    tab.formData = cloneFormDataFields(snapshot.formData);
    tab.binaryFilePath = String(snapshot.binaryFilePath || '');
    syncBodyTypeUiFromTab(tab);
  }
  var state = ensureBodyUndoState(tab, textarea) || resetBodyUndoState(tab, nextValue, textarea);
  if (state) {
    state.lastValue = nextValue;
    state.lastSelectionStart = snapshot.selectionStart;
    state.lastSelectionEnd = snapshot.selectionEnd;
    state.lastRecordedAt = Date.now();
    state.lastInputType = snapshot.conversion ? 'conversion' : 'history';
    state.lastBodyType = normalizeBodyType(tab.bodyType);
  }
  if (textarea) {
    try {
      textarea.selectionStart = snapshot.selectionStart;
      textarea.selectionEnd = snapshot.selectionEnd;
    } catch {}
    if (typeof textarea._tessraAutoGrow === 'function') {
      textarea._tessraAutoGrow();
    }
    if (typeof textarea._tessraRefreshBodyHighlight === 'function') {
      textarea._tessraRefreshBodyHighlight(true);
    }
  }
  bodyUndoApplying = false;
  markDirty();
  refreshDraftInsights(mainContent);
  debouncePersist();
}

function handleBodyEditorUndoRedoShortcut(tab, textarea, event) {
  if (!isBodyUndoRedoShortcut(event) || !tab) return false;
  var state = ensureBodyUndoState(tab, textarea);
  if (!state) return false;
  var isRedo = isBodyRedoShortcut(event);
  var sourceStack = isRedo ? state.redo : state.undo;
  var targetStack = isRedo ? state.undo : state.redo;
  if (!sourceStack.length) return false;
  event.preventDefault();
  event.stopPropagation();
  var peek = sourceStack[sourceStack.length - 1];
  var currentSnapshot = (peek && peek.conversion)
    ? captureBodyConversionUndoSnapshot(tab, textarea)
    : createBodyUndoSnapshot(textarea ? textarea.value : (tab.body || ''), textarea);
  pushBodyUndoSnapshot(targetStack, currentSnapshot);
  var nextSnapshot = sourceStack.pop();
  applyBodyEditorUndoSnapshot(tab, textarea, nextSnapshot);
  return true;
}

function shouldEnableBodySyntaxHighlight(bodyType, isWebSocket) {
  var normalized = normalizeBodyType(bodyType);
  return !isWebSocket && (normalized === 'json' || normalized === 'xml');
}

function bodyHighlightLanguage(bodyType) {
  var normalized = normalizeBodyType(bodyType);
  if (normalized === 'xml') return 'xml';
  if (normalized === 'json') return 'json';
  return '';
}

// 하위 호환 별칭 (기존 테스트/호출)
function shouldEnableBodyJsonHighlight(bodyType, isWebSocket) {
  return shouldEnableBodySyntaxHighlight(bodyType, isWebSocket);
}

function highlightBodySource(source, language) {
  var text = String(source || '');
  var lang = language === 'xml' ? 'xml' : 'json';
  var html = '';
  // Large bodies: keep a plain escaped mirror so scroll/layout stay aligned without hljs work each keystroke.
  if (text.length > BODY_JSON_HIGHLIGHT_MAX_CHARS) {
    html = escapeHtml(text);
  } else if (typeof hljs !== 'undefined') {
    try {
      html = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
    } catch {
      html = escapeHtml(text);
    }
  } else {
    html = escapeHtml(text);
  }
  // Match textarea rendering of a trailing newline (extra visual line).
  if (text.endsWith('\\n')) {
    html += '<br>';
  }
  return html;
}

function highlightJsonBodySource(source) {
  return highlightBodySource(source, 'json');
}

function syncBodyHighlightScroll(textarea, highlightEl) {
  if (!textarea || !highlightEl) return;
  highlightEl.scrollTop = textarea.scrollTop;
  highlightEl.scrollLeft = textarea.scrollLeft;
}

function syncBodyTypeUiFromTab(tab) {
  var mc = mainContent;
  if (!mc || !tab) return;
  var select = mc.querySelector('.js-body-type');
  var bodyType = normalizeBodyType(tab.bodyType);
  if (select && select.value !== bodyType) {
    select.value = bodyType;
  }
  var wsBody = isWebSocketTab(tab);
  var textarea = mc.querySelector('.js-body');
  var bodyEditor = mc.querySelector('.js-body-editor');
  var formDataPanel = mc.querySelector('.js-formdata-panel');
  var binaryPanel = mc.querySelector('.js-binary-panel');
  var hideBodyEditor = (!wsBody && (bodyType === 'none' || bodyType === 'formdata' || bodyType === 'binary'));
  if (bodyEditor) bodyEditor.style.display = hideBodyEditor ? 'none' : '';
  else if (textarea) textarea.style.display = hideBodyEditor ? 'none' : '';
  if (formDataPanel) {
    formDataPanel.classList.toggle('hidden', bodyType !== 'formdata');
    if (bodyType === 'formdata') {
      var rows = mc.querySelector('.js-formdata-rows');
      if (rows) rows.innerHTML = formDataRowsHtml(tab.formData || []);
      refreshFormDataSummary(mc);
    }
  }
  if (binaryPanel) {
    binaryPanel.classList.toggle('hidden', bodyType !== 'binary');
    var binaryInput = mc.querySelector('.js-binary-path');
    if (binaryInput) binaryInput.value = tab.binaryFilePath || '';
  }
  if (textarea && bodyType !== 'formdata' && bodyType !== 'binary' && bodyType !== 'none') {
    if (textarea.value !== (tab.body || '')) {
      textarea.value = tab.body || '';
    }
  }
  if (!wsBody) syncAutoContentType(mc, bodyType);
  if (typeof textarea?._tessraRefreshBodyHighlight === 'function') {
    textarea._tessraRefreshBodyHighlight(true);
  }
}

function getBodyConversionApi() {
  return (typeof TessraBodyConversion !== 'undefined') ? TessraBodyConversion : null;
}

function bodyTypeDisplayName(type) {
  var normalized = normalizeBodyType(type);
  if (normalized === 'json') return 'JSON';
  if (normalized === 'xml') return 'XML';
  return bodyTypeLabel(normalized);
}

function showBodyTypeConversionConfirm(options) {
  var old = document.getElementById('bodyConvertOverlay');
  if (old) old.remove();
  var fromType = normalizeBodyType(options.fromType);
  var toType = normalizeBodyType(options.toType);
  var canConvert = !!options.canConvert;
  var isNoneClear = toType === 'none';
  var title = isNoneClear
    ? tr('webview.bodyConvertClearTitle')
    : tf('webview.bodyConvertTitle', { from: bodyTypeDisplayName(fromType), to: bodyTypeDisplayName(toType) });
  var subtitle = isNoneClear
    ? tr('webview.bodyConvertClearSubtitle')
    : tr('webview.bodyConvertSubtitle');
  var convertLabel = isNoneClear ? tr('webview.bodyConvertClear') : tr('webview.bodyConvert');
  var overlay = document.createElement('div');
  overlay.id = 'bodyConvertOverlay';
  overlay.className = 'body-convert-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML =
    '<div class="body-convert-dialog">' +
      '<div class="body-convert-title">' + escapeHtml(title) + '</div>' +
      '<div class="body-convert-sub">' + escapeHtml(subtitle) + '</div>' +
      '<div class="body-convert-actions">' +
        (canConvert
          ? '<button type="button" class="dirty-btn dirty-btn-save" data-action="convert" data-testid="body-convert-confirm">' + escapeHtml(convertLabel) + '</button>'
          : '') +
        '<button type="button" class="dirty-btn dirty-btn-discard" data-action="keep" data-testid="body-convert-keep">' + escapeHtml(tr('webview.bodyConvertKeep')) + '</button>' +
        '<button type="button" class="dirty-btn dirty-btn-cancel" data-action="cancel" data-testid="body-convert-cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  var finish = function(action) {
    overlay.remove();
    if (typeof options.onAction === 'function') options.onAction(action);
  };
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      finish('cancel');
      return;
    }
    var button = event.target.closest('[data-action]');
    if (!button) return;
    finish(button.getAttribute('data-action'));
  });
  overlay.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish('cancel');
    }
  });
  var focusBtn = overlay.querySelector('[data-action="convert"]')
    || overlay.querySelector('[data-action="keep"]')
    || overlay.querySelector('[data-action="cancel"]');
  if (focusBtn) focusBtn.focus();
}

function applyBodyTypeChange(mc, tab, nextType, mode) {
  var api = getBodyConversionApi();
  var fromType = normalizeBodyType(tab.bodyType);
  var toType = normalizeBodyType(nextType);
  var textarea = mc.querySelector('.js-body');
  var currentBody = textarea ? textarea.value : (tab.body || '');
  var currentFormData = tab.bodyType === 'formdata'
    ? collectFormData(mc.querySelector('.js-formdata-rows'))
    : (tab.formData || []);
  var currentBinary = tab.binaryFilePath || '';
  if (tab.bodyType === 'formdata') {
    tab.formData = currentFormData;
  }
  tab.body = currentBody;

  var undoState = ensureBodyUndoState(tab, textarea) || resetBodyUndoState(tab, currentBody, textarea);
  var beforeSnapshot = captureBodyConversionUndoSnapshot(tab, textarea);

  if (mode === 'convert') {
    if (!api) {
      showCopyToast(tr('webview.bodyConvertFailed'));
      if (mc.querySelector('.js-body-type')) {
        mc.querySelector('.js-body-type').value = fromType;
      }
      return false;
    }
    var result = api.convert({
      bodyType: fromType,
      body: currentBody,
      formData: currentFormData,
      binaryFilePath: currentBinary,
    }, toType);
    if (!result || !result.ok) {
      showCopyToast(result?.message || tr('webview.bodyConvertFailed'));
      // 실패 시 원본 유지
      if (mc.querySelector('.js-body-type')) {
        mc.querySelector('.js-body-type').value = fromType;
      }
      return false;
    }
    pushBodyUndoSnapshot(undoState.undo, beforeSnapshot);
    undoState.redo = [];
    tab.bodyType = result.bodyType;
    tab.body = result.body || '';
    tab.formData = cloneFormDataFields(result.formData || []);
    tab.binaryFilePath = result.binaryFilePath || '';
    if (textarea) textarea.value = tab.body;
    undoState.lastValue = tab.body;
    undoState.lastBodyType = tab.bodyType;
    undoState.lastInputType = 'conversion';
    undoState.lastRecordedAt = Date.now();
    syncBodyTypeUiFromTab(tab);
    markDirty();
    refreshDraftInsights(mc);
    debouncePersist();
    return true;
  }

  // Keep text: type only (content unchanged). Binary never invents files.
  pushBodyUndoSnapshot(undoState.undo, beforeSnapshot);
  undoState.redo = [];
  tab.bodyType = toType;
  undoState.lastValue = textarea ? textarea.value : (tab.body || '');
  undoState.lastBodyType = tab.bodyType;
  undoState.lastInputType = 'conversion';
  undoState.lastRecordedAt = Date.now();
  syncBodyTypeUiFromTab(tab);
  markDirty();
  refreshDraftInsights(mc);
  debouncePersist();
  return true;
}

function handleBodyTypeSelectChange(mc, selectEl) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !selectEl) return;
  var nextType = normalizeBodyType(selectEl.value);
  var prevType = normalizeBodyType(tab.bodyType);
  if (nextType === prevType) return;

  var textarea = mc.querySelector('.js-body');
  if (prevType === 'formdata') {
    tab.formData = collectFormData(mc.querySelector('.js-formdata-rows'));
  }
  if (textarea) tab.body = textarea.value;
  if (prevType === 'binary') {
    var binaryInput = mc.querySelector('.js-binary-path');
    if (binaryInput) tab.binaryFilePath = binaryInput.value || '';
  }

  var payload = {
    bodyType: prevType,
    body: tab.body || '',
    formData: tab.formData || [],
    binaryFilePath: tab.binaryFilePath || '',
  };
  var api = getBodyConversionApi();
  var hasContent = api && typeof api.hasContent === 'function'
    ? api.hasContent(payload)
    : !!(String(payload.body || '').trim()
      || (payload.formData || []).some(function(f) { return f && (f.key || f.value); })
      || String(payload.binaryFilePath || '').trim());

  // 빈 바디: 확인 없이 타입만 변경 (기존 동작)
  if (!hasContent) {
    tab.bodyType = nextType;
    resetBodyUndoState(tab, tab.body || '', textarea);
    syncBodyTypeUiFromTab(tab);
    markDirty();
    refreshDraftInsights(mc);
    debouncePersist();
    return;
  }

  // 선택값을 일단 되돌린 뒤 확인 (Cancel 시 원본 유지)
  selectEl.value = prevType;

  var canConvert = false;
  if (api && typeof api.isBinaryTransition === 'function' && api.isBinaryTransition(prevType, nextType)) {
    canConvert = false;
  } else if (api && typeof api.supportsConversion === 'function') {
    canConvert = api.supportsConversion(prevType, nextType);
  } else if (nextType === 'none') {
    canConvert = true;
  }

  showBodyTypeConversionConfirm({
    fromType: prevType,
    toType: nextType,
    canConvert: canConvert,
    onAction: function(action) {
      if (action === 'cancel') {
        selectEl.value = prevType;
        return;
      }
      if (action === 'convert') {
        applyBodyTypeChange(mc, tab, nextType, 'convert');
        return;
      }
      if (action === 'keep') {
        applyBodyTypeChange(mc, tab, nextType, 'keep');
      }
    },
  });
}

  function createTab(data) {
    const id = 'tab_' + (++tabIdCounter);
    const incomingName = data?.name;
    const autoName = data?.autoName === true
      || (!incomingName && !data?.requestId)
      || (data?.autoName !== false && !data?.requestId && isKnownDefaultTabName(incomingName || ''));
    const tab = applyRequestSettings({
      id,
    requestEditorTab: normalizeRequestEditorTab(data?.requestEditorTab),
    requestEditorExpanded: data?.requestEditorExpanded !== false,
    requestSplitHeightPx: normalizeRequestSplitHeight(data?.requestSplitHeightPx),
    requestId: data?.requestId || null,
    name: autoName ? tr('webview.stage.newRequest') : (incomingName || tr('webview.stage.newRequest')),
    autoName: autoName,
    requestType: normalizeRequestType(data?.requestType, data?.url),
    method: data?.method || 'GET',
    url: data?.url || '',
    headers: data?.headers || [],
    params: data?.params || [],
    body: data?.body || '',
    bodyType: normalizeBodyType(data?.bodyType),
    formData: data?.formData || [],
    binaryFilePath: data?.binaryFilePath || '',
    auth: data?.auth || { type: 'none' },
      scripts: data?.scripts || { preRequest: '', test: '' },
      jsonFormatStyle: data?.jsonFormatStyle || 'pretty',
      xmlFormatStyle: data?.xmlFormatStyle || 'inline',
      formatIndent: data?.formatIndent || '2',
      responseSearchQuery: typeof data?.responseSearchQuery === 'string' ? data.responseSearchQuery : '',
      responseSearchIndex: typeof data?.responseSearchIndex === 'number' ? data.responseSearchIndex : 0,
      responseSearchCaseSensitive: data?.responseSearchCaseSensitive === true,
      responseSearchRegex: data?.responseSearchRegex === true,
      scriptHelpCollapsed: data?.scriptHelpCollapsed === true,
      pinned: data?.pinned || false,
      dirty: false,
    _snapshot: null,
    response: null,
    websocketStatus: 'closed',
    websocketMessages: [],
    resolvedUrl: '',
    resolvedHeaders: [],
    scriptResults: null,
    error: null,
    loading: false,
    progressVisible: false,
    slideIn: false,
    lastEvent: data?.lastEvent || 'idle',
    responseTab: data?.responseTab || 'resBody',
    sendTime: 0,
    requestStartedAt: normalizeEpochMs(data?.requestStartedAt),
    requestEndedAt: normalizeEpochMs(data?.requestEndedAt),
    durationMs: normalizeDurationMs(data?.durationMs),
  }, data);
  syncRequestTypeFromUrl(tab);
  resetBodyUndoState(tab, tab.body);
  
  if (data?.requestId) {
    tab._snapshot = snapshotTab(tab);
  }
  tabs.push(tab);
  switchTab(id);
  if (data) debouncePersist();
  return id;
}

function clearTabRequestState(tab) {
  if (!tab) return;
  tab.loading = false;
  tab.progressVisible = false;
  if (tab._progressTimer) { clearTimeout(tab._progressTimer); tab._progressTimer = null; }
  if (tab._elapsedTimer) { clearInterval(tab._elapsedTimer); tab._elapsedTimer = null; }
}

function disconnectWebSocketIfOpen(tab) {
  if (tab?.websocketStatus && tab.websocketStatus !== 'closed') {
    websocketDisconnect(tab);
  }
}

function doCloseTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;
  const tab = tabs[idx];
  if (tab?.loading) {
    clearTabRequestState(tab);
    vscode.postMessage({ type: 'cancelRequest', tabId: id });
  }
  disconnectWebSocketIfOpen(tab);
  tabs.splice(idx, 1);
  if (activeTabId === id) {
    activeTabId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)].id : null;
  }
  renderTabBar();
  renderContent();
  debouncePersist();
}

function closeTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  if (tab.pinned) return;
  
  if (id === activeTabId) saveActiveTabState();
  tab.dirty = isTabDirty(tab);
  if (tab.dirty) {
    showDirtyConfirm(id);
    return;
  }
  doCloseTab(id);
}


function showDirtyConfirm(tabId) {
  
  var old = document.getElementById('dirtyConfirmOverlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'dirtyConfirmOverlay';
  overlay.className = 'dirty-confirm-overlay';
  overlay.innerHTML =
    '<div class="dirty-confirm-dialog">' +
      '<div class="dirty-confirm-msg">' + escapeHtml(tr('webview.unsavedClosePrompt')) + '</div>' +
      '<div class="dirty-confirm-actions">' +
        '<button class="dirty-btn dirty-btn-save" data-action="save">' + escapeHtml(tr('webview.save')) + '</button>' +
        '<button class="dirty-btn dirty-btn-discard" data-action="discard">' + escapeHtml(tr('webview.discard')) + '</button>' +
        '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    overlay.remove();
    if (action === 'save') {
      
      var tab = tabs.find(function(t){return t.id === tabId});
      if (tab && tab.url) {
        if (tabId === activeTabId) saveActiveTabState();
        _pendingCloseAfterSave = tabId;
        vscode.postMessage(buildSaveRequestMessage(tab, tab.requestId || undefined));
      } else {
        doCloseTab(tabId);
      }
    } else if (action === 'discard') {
      doCloseTab(tabId);
    }
    
  });
}


function closeTabs(ids) {
  if (!ids || ids.length === 0) return;
  var queue = ids.slice();
  function next() {
    while (queue.length > 0) {
      var id = queue.shift();
      var tab = tabs.find(function(t){return t.id === id});
      if (!tab || tab.pinned) continue;
      if (id === activeTabId) saveActiveTabState();
      tab.dirty = isTabDirty(tab);
      if (tab.dirty) {
        showBatchDirtyConfirm(id, queue);
        return;
      }
      doCloseTab(id);
    }
  }
  next();

  function showBatchDirtyConfirm(tabId, remaining) {
    var old = document.getElementById('dirtyConfirmOverlay');
    if (old) old.remove();
    var tabObj = tabs.find(function(t){return t.id === tabId});
    var tabLabel = tabObj ? (tabObj.name || tr('webview.stage.newRequest')) : '';
    var overlay = document.createElement('div');
    overlay.id = 'dirtyConfirmOverlay';
    overlay.className = 'dirty-confirm-overlay';
    overlay.innerHTML =
      '<div class="dirty-confirm-dialog">' +
        '<div class="dirty-confirm-msg">' + escapeHtml(tf('webview.unsavedCloseNamedPrompt', { name: tabLabel })) + '</div>' +
        '<div class="dirty-confirm-actions">' +
          '<button class="dirty-btn dirty-btn-discard" data-action="discard">' + escapeHtml(tr('webview.discard')) + '</button>' +
          '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">' + escapeHtml(tr('webview.cancel')) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      var action = e.target.dataset.action;
      if (!action) return;
      overlay.remove();
      if (action === 'discard') {
        doCloseTab(tabId);
        next();
      }
      
    });
  }
}


function addRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const size = Math.max(rect.width, rect.height) * 4;
  const circle = document.createElement('span');
  circle.className = 'ripple-circle';
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (x - size / 2) + 'px';
  circle.style.top = (y - size / 2) + 'px';
  btn.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}


function showBtnFeedback(btn, text, duration) {
  duration = duration || 1500;
  const origHtml = btn.innerHTML;
  btn.innerHTML = text;
  setTimeout(() => { btn.innerHTML = origHtml; }, duration);
}

// Floating toast (for row-level copy feedback etc.)
var copyToastEl = null;
var copyToastTimer = null;
function showCopyToast(text, duration) {
  duration = duration || 1600;
  if (!copyToastEl) {
    copyToastEl = document.createElement('div');
    copyToastEl.className = 'copy-toast';
    document.body.appendChild(copyToastEl);
  }
  copyToastEl.textContent = text;
  void copyToastEl.offsetWidth;
  copyToastEl.classList.add('visible');
  if (copyToastTimer) clearTimeout(copyToastTimer);
  copyToastTimer = setTimeout(function() {
    if (copyToastEl) copyToastEl.classList.remove('visible');
  }, duration);
}


function triggerSendStreak(btn) {
  btn.classList.add('streak-active');
  setTimeout(() => btn.classList.remove('streak-active'), 400);
}



function triggerSendSlam(btn) {
  triggerSendStreak(btn);
  setTimeout(function() {
    var newBtn = mainContent.querySelector('.js-send');
    if (newBtn) {
      newBtn.classList.add('send-click');
      newBtn.classList.add('send-click-flash');
      setTimeout(function() { newBtn.classList.remove('send-click-flash'); }, 100);
      setTimeout(function() { newBtn.classList.remove('send-click'); }, 300);
    }
  }, 0);
}


function triggerStopSlam(btn) {
  
  btn.classList.remove('stop-slam');
  void btn.offsetWidth;
  btn.classList.add('stop-slam');
  
  btn.classList.add('stop-flash');
  setTimeout(function() { btn.classList.remove('stop-flash'); }, 160);
  
  setTimeout(function() { btn.classList.remove('stop-slam'); }, 400);
  // vignette flash
  var vig = document.createElement('div');
  vig.className = 'stop-vignette-flash';
  document.body.appendChild(vig);
  setTimeout(function() { vig.remove(); }, 300);
}



document.addEventListener('click', function(e) {
  const btn = e.target.closest('.ripple-btn');
  if (!btn) return;
  addRipple(btn, e);
  
  if (btn.classList.contains('btn-send') || btn.classList.contains('btn-stop')) return;
  
  btn.classList.add('btn-flash');
  setTimeout(function() { btn.classList.remove('btn-flash'); }, 100);
  
  btn.classList.remove('btn-bouncing');
  void btn.offsetWidth;
  btn.classList.add('btn-bouncing');
  btn.addEventListener('animationend', function handler() {
    btn.classList.remove('btn-bouncing');
    btn.removeEventListener('animationend', handler);
  });
});

function appendWebSocketMessage(tab, item) {
  if (!tab) return;
  tab.websocketMessages = tab.websocketMessages || [];
  tab.websocketMessages.push(Object.assign({ timestamp: Date.now() }, item));
  if (tab.websocketMessages.length > 200) {
    tab.websocketMessages = tab.websocketMessages.slice(tab.websocketMessages.length - 200);
  }
}

function websocketStatusLabel(status) {
  if (status === 'open') return tr('webview.connected');
  if (status === 'connecting') return tr('webview.connecting');
  if (status === 'error') return tr('webview.stage.failed');
  return tr('webview.disconnected');
}

function websocketCloseCodeLabel(code) {
  var labels = {
    1000: 'Normal Closure',
    1001: 'Going Away',
    1002: 'Protocol Error',
    1003: 'Unsupported Data',
    1005: 'No Status Received',
    1006: 'Abnormal Closure',
    1007: 'Invalid Frame Payload Data',
    1008: 'Policy Violation',
    1009: 'Message Too Big',
    1010: 'Mandatory Extension',
    1011: 'Internal Error',
    1012: 'Service Restart',
    1013: 'Try Again Later',
    1015: 'TLS Handshake Failure'
  };
  return labels[code] || '';
}

function compactDiagnosticText(value, fallback) {
  var text = String(value || fallback || '').trim();
  if (!text) return '(no reason)';
  return text.length > 480 ? text.substring(0, 477) + '...' : text;
}

function formatWebSocketCloseMessage(msg) {
  var source = msg.closeSource || (msg.wasClean === true ? 'remote' : 'unexpected');
  var lines = [
    tr(source === 'user'
      ? 'webview.websocketClosedByUser'
      : (source === 'unexpected'
        ? 'webview.websocketClosedUnexpectedly'
        : 'webview.websocketClosedByRemote'))
  ];
  var code = typeof msg.code === 'number'
    ? msg.code
    : (source === 'unexpected' ? 1006 : 1005);
  var reason = compactDiagnosticText(msg.reason, source === 'user' ? 'User disconnect' : websocketCloseCodeLabel(code));
  var wasClean = typeof msg.wasClean === 'boolean'
    ? msg.wasClean
    : source !== 'unexpected';
  lines.push('code: ' + code);
  lines.push('reason: ' + reason);
  lines.push('wasClean: ' + String(wasClean));
  return lines.join('\\n');
}

function formatWebSocketErrorMessage(msg) {
  var lines = [tr('webview.websocketError')];
  lines.push('message: ' + compactDiagnosticText(msg.error, tr('webview.stage.failed')));
  if (msg.errorDetail && msg.errorDetail !== msg.error) {
    lines.push('detail: ' + compactDiagnosticText(msg.errorDetail, ''));
  }
  return lines.join('\\n');
}

function websocketConnect(tab) {
  if (!tab) return;
  saveActiveTabState();
  tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url) return;
  const mc = mainContent;
  const allHeaders = collectAllKv(mc.querySelector('.js-header-rows'));
  tab.requestType = 'websocket';
  tab.websocketStatus = 'connecting';
  tab.websocketMessages = [];
  tab.error = null;
  tab.response = null;
  tab.responseTab = 'resBody';
  tab.lastEvent = 'websocket';
  renderTabBar();
  renderContent();
  vscode.postMessage({
    type: 'websocketConnect',
    tabId: tab.id,
    url: tab.url,
    headers: allHeaders,
    params: tab.params,
    auth: tab.auth,
    timeout: tab.timeout,
    followRedirects: !!tab.followRedirects,
    saveToHistory: tab.saveToHistory !== false,
    tlsValidation: normalizeTlsValidation(tab.tlsValidation),
    maxResponseSizeKb: normalizeMaxResponseSizeSetting(tab.maxResponseSizeKb),
    retryCount: normalizeNumberSetting(tab.retryCount),
    retryDelayMs: normalizeNumberSetting(tab.retryDelayMs),
    stopAfterHeaders: !!tab.stopAfterHeaders,
    skipDefaultHeaders: !!tab.skipDefaultHeaders,
    disableScripts: !!tab.disableScripts,
    scriptsTrusted: tab.scriptsTrusted !== false,
    webSocketKeepAliveEnabled: tab.webSocketKeepAliveEnabled === true,
    webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds),
    webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage),
  });
}

function websocketDisconnect(tab) {
  if (!tab) return;
  vscode.postMessage({ type: 'websocketDisconnect', tabId: tab.id });
}

function websocketSend(tab) {
  if (!tab) return;
  saveActiveTabState();
  tab = tabs.find(t => t.id === activeTabId);
  if (!tab || tab.websocketStatus !== 'open') return;
  vscode.postMessage({
    type: 'websocketSend',
    tabId: tab.id,
    message: tab.body || ''
  });
}

function handlePrimaryAction() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  if (isWebSocketTab(tab)) {
    if (tab.websocketStatus === 'connecting') {
      websocketDisconnect(tab);
      return;
    }
    if (tab.websocketStatus === 'open') {
      websocketSend(tab);
      return;
    }
    websocketConnect(tab);
    return;
  }
  if (tab.loading) {
    clearTabRequestState(tab);
    tab.lastEvent = 'canceled';
    tab.error = null;
    renderContent();
    vscode.postMessage({ type: 'cancelRequest', tabId: tab.id });
    return;
  }
  sendActiveTab();
}

function switchTab(id) {
  if (activeTabId === id) return;
  var previousTab = tabs.find(function(t) { return t.id === activeTabId; });
  saveActiveTabState();
  disconnectWebSocketIfOpen(previousTab);
  syncRequestTypeFromUrl(tabs.find(function(t) { return t.id === id; }));
  activeTabId = id;
  renderTabBar();
  renderContent();
  debouncePersist();
}

function saveActiveTabState() {
  if (!activeTabId) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  const mc = mainContent;
  const methodEl = mc.querySelector('.js-method');
  const urlEl = mc.querySelector('.js-url');
  if (!methodEl) return;
  tab.method = methodEl.value;
  tab.url = urlEl.value;
  syncRequestTypeFromUrl(tab);
  tab.headers = collectKv(mc.querySelector('.js-header-rows'));
  tab.params = collectKv(mc.querySelector('.js-param-rows'));
  tab.body = mc.querySelector('.js-body')?.value || '';
  tab.bodyType = mc.querySelector('.js-body-type')?.value || 'none';
  tab.formData = collectFormData(mc.querySelector('.js-formdata-rows'));
  tab.binaryFilePath = mc.querySelector('.js-binary-path')?.value || '';
  tab.auth = collectAuth(mc);
  tab.scripts = collectScripts(mc);
  tab.timeout = normalizeNumberSetting(mc.querySelector('.js-timeout')?.value);
  tab.followRedirects = mc.querySelector('.js-follow-redirects')?.checked === true;
  tab.saveToHistory = mc.querySelector('.js-save-history')?.checked !== false;
  tab.tlsValidation = normalizeTlsValidation(mc.querySelector('.js-tls-validation')?.value);
  tab.maxResponseSizeKb = normalizeMaxResponseSizeSetting(mc.querySelector('.js-max-response-size')?.value);
  tab.retryCount = normalizeNumberSetting(mc.querySelector('.js-retry-count')?.value);
  tab.retryDelayMs = normalizeNumberSetting(mc.querySelector('.js-retry-delay')?.value);
  tab.stopAfterHeaders = mc.querySelector('.js-stop-after-headers')?.checked === true;
  tab.skipDefaultHeaders = mc.querySelector('.js-skip-default-headers')?.checked === true;
  tab.disableScripts = mc.querySelector('.js-disable-scripts')?.checked === true;
  tab.webSocketKeepAliveEnabled = mc.querySelector('.js-ws-keepalive-enabled')?.checked === true;
  tab.webSocketKeepAliveIntervalSeconds = normalizeWebSocketKeepAliveInterval(mc.querySelector('.js-ws-keepalive-interval')?.value);
  tab.webSocketKeepAliveMessage = normalizeWebSocketKeepAliveMessage(mc.querySelector('.js-ws-keepalive-message')?.value);
  tab.requestEditorTab = normalizeRequestEditorTab(mc.querySelector('.js-req-tabs .tab.active')?.dataset.tab || tab.requestEditorTab);
}

function refreshRequestEditorLayout() {
  var schedule = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function(callback) { return setTimeout(callback, 0); };
  schedule(function() {
    if (typeof mainContent === 'undefined' || !mainContent || typeof applyAdaptiveRequestAreaHeight !== 'function') return;
    var reqArea = mainContent.querySelector('.req-area');
    if (!reqArea) return;
    var splitEl = mainContent.querySelector('.split');
    var dividerEl = mainContent.querySelector('.divider');
    var progressEl = mainContent.querySelector('.bullet-progress');
    var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
    if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(activeTab)) {
      applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, reqArea.offsetHeight || reqArea.style.height, activeTab, false);
      return;
    }
    applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, activeTab);
  });
}

function switchRequestEditorTabInContent(mc, tabName, options) {
  if (!mc) return;
  var normalizedTabName = normalizeRequestEditorTab(tabName);
  var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
  var previousTabName = normalizeRequestEditorTab(activeTab?.requestEditorTab);
  var isSameTab = !!activeTab && previousTabName === normalizedTabName;
  var shouldExpand = options?.expand === true
    ? true
    : (isSameTab ? activeTab.requestEditorExpanded === false : true);
  if (activeTab) {
    activeTab.requestEditorTab = normalizedTabName;
    activeTab.requestEditorExpanded = shouldExpand;
  }
  var tabsEl = mc.querySelectorAll('.js-req-tabs .tab');
  tabsEl.forEach(function(x) {
    var isActive = x.dataset.tab === normalizedTabName;
    x.classList.toggle('active', isActive);
    x.classList.toggle('collapsed', isActive && !shouldExpand);
    x.setAttribute('aria-selected', String(isActive));
    x.setAttribute('aria-expanded', String(isActive && shouldExpand));
  });
  var panels = { params: '.js-params-panel', headers: '.js-headers-panel', body: '.js-body-panel', auth: '.js-auth-panel', scripts: '.js-scripts-panel', settings: '.js-settings-panel' };
  Object.keys(panels).forEach(function(key) {
    mc.querySelector(panels[key])?.classList.toggle('hidden', !shouldExpand || key !== normalizedTabName);
  });
  if (normalizedTabName === 'headers') refreshDefaultHeadersBanner(mc);
  refreshRequestEditorLayout();
}

var linkedFocusTimer = null;
var linkedFocusFrame = null;
var editorLinkedFocusTimer = null;

function clearLinkedFocusInContent(mc) {
  if (linkedFocusTimer) {
    clearTimeout(linkedFocusTimer);
    linkedFocusTimer = null;
  }
  if (linkedFocusFrame) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(linkedFocusFrame);
    }
    linkedFocusFrame = null;
  }
  mc?.querySelectorAll('.linked-focus-active').forEach(function(node) {
    node.classList.remove('linked-focus-active');
  });
}

function resolveLinkedFocusTargetInContent(mc, targetKey) {
  if (!mc || !targetKey) return null;
  var selectors = {
    'params': '.js-params-panel',
    'headers': '.js-headers-panel',
    'body': '.js-body-panel',
    'auth': '.js-auth-panel',
    'scripts': '.js-scripts-panel',
    'scripts:pre-request': '.js-script-prerequest',
    'scripts:test': '.js-script-test',
    'settings': '.js-settings-panel',
    'settings:save-history': '.js-save-history',
    'settings:skip-default-headers': '.js-skip-default-headers',
    'settings:disable-scripts': '.js-disable-scripts',
    'settings:follow-redirects': '.js-follow-redirects',
    'settings:stop-after-headers': '.js-stop-after-headers',
    'settings:timeout': '.js-timeout',
    'settings:max-response-size': '.js-max-response-size',
    'settings:retry-count': '.js-retry-count',
    'settings:retry-delay': '.js-retry-delay',
    'settings:tls-validation': '.js-tls-validation',
    'settings:websocket-keepalive': '.js-ws-keepalive-enabled'
  };
  var selector = selectors[targetKey] || selectors[String(targetKey).split(':')[0]] || null;
  if (!selector) return null;
  return mc.querySelector(selector);
}

function resolveLinkedFocusContainer(target) {
  if (!target) return null;
  return target.closest('.settings-toggle, .script-card, .script-help-line, .default-headers-banner, .body-section') || target;
}

function focusLinkedTarget(target) {
  if (!target) return;
  if (typeof target.focus === 'function') {
    try {
      target.focus({ preventScroll: true });
      return;
    } catch (_) {
      target.focus();
      return;
    }
  }
  var focusable = target.querySelector('input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
  if (focusable && typeof focusable.focus === 'function') {
    try {
      focusable.focus({ preventScroll: true });
    } catch (_) {
      focusable.focus();
    }
  }
}

function queueLinkedFocusReveal(callback) {
  if (linkedFocusFrame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(linkedFocusFrame);
  }
  linkedFocusFrame = requestAnimationFrame(function() {
    linkedFocusFrame = requestAnimationFrame(function() {
      linkedFocusFrame = null;
      callback();
    });
  });
}

function revealLinkedTargetInContent(mc, targetKey) {
  var target = resolveLinkedFocusTargetInContent(mc, targetKey);
  if (!target) return false;
  var container = resolveLinkedFocusContainer(target);
  clearLinkedFocusInContent(mc);
  if (typeof container.scrollIntoView === 'function') {
    try {
      container.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (_) {
      container.scrollIntoView();
    }
  }
  queueLinkedFocusReveal(function() {
    if (!container?.isConnected || !target?.isConnected) return;
    container.classList.add('linked-focus-active');
    focusLinkedTarget(target);
    linkedFocusTimer = setTimeout(function() {
      container.classList.remove('linked-focus-active');
      linkedFocusTimer = null;
    }, 2200);
  });
  return true;
}

function revealDefaultHeadersEditor() {
  if (!defaultHeadersEditor) return;
  defaultHeadersEditor.classList.remove('hidden');
  if (editorLinkedFocusTimer) {
    clearTimeout(editorLinkedFocusTimer);
    editorLinkedFocusTimer = null;
  }
  defaultHeadersEditor.classList.remove('linked-focus-active');
  if (typeof defaultHeadersEditor.scrollIntoView === 'function') {
    try {
      defaultHeadersEditor.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (_) {
      defaultHeadersEditor.scrollIntoView();
    }
  }
  queueLinkedFocusReveal(function() {
    if (!defaultHeadersEditor?.isConnected) return;
    defaultHeadersEditor.classList.add('linked-focus-active');
    var focusTarget = defaultHeaderRows?.querySelector('input[type="text"], input[type="password"]') || document.getElementById('addDefaultHeaderBtn') || defaultHeadersEditor;
    focusLinkedTarget(focusTarget);
    editorLinkedFocusTimer = setTimeout(function() {
      defaultHeadersEditor.classList.remove('linked-focus-active');
      editorLinkedFocusTimer = null;
    }, 2200);
  });
}

function syncEnvironmentStripDisclosureState() {
  var btn = mainContent?.querySelector('.status-strip-seg[data-action="edit-environment"]');
  if (!btn) return;
  btn.setAttribute('aria-expanded', isEnvironmentEditorOpen() ? 'true' : 'false');
}

function revealEnvironmentEditor() {
  if (!envEditor) return;
  envEditor.classList.remove('hidden');
  syncEnvironmentStripDisclosureState();
  if (editorLinkedFocusTimer) {
    clearTimeout(editorLinkedFocusTimer);
    editorLinkedFocusTimer = null;
  }
  envEditor.classList.remove('linked-focus-active');
  refreshEnvironmentEditorLayout();
  if (typeof envEditor.scrollIntoView === 'function') {
    try {
      envEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } catch (_) {
      envEditor.scrollIntoView();
    }
  }
  queueLinkedFocusReveal(function() {
    if (!envEditor?.isConnected) return;
    envEditor.classList.add('linked-focus-active');
    var focusTarget = envVarRows?.querySelector('input[type="text"], input[type="password"]') || addEnvVarBtn || envEditor;
    focusLinkedTarget(focusTarget);
    editorLinkedFocusTimer = setTimeout(function() {
      envEditor.classList.remove('linked-focus-active');
      editorLinkedFocusTimer = null;
    }, 2200);
  });
}

function toggleEnvironmentEditor() {
  if (!editingEnvId) {
    vscode.postMessage({ type: 'switchEnvironment' });
    return;
  }
  if (isEnvironmentEditorOpen()) {
    hideEnvironmentEditor();
    return;
  }
  revealEnvironmentEditor();
}

function switchRequestEditorTabAndRevealInContent(mc, meta) {
  if (!mc || !meta) return;
  var metaValue = String(meta);
  var tabName = metaValue.split(':')[0];
  switchRequestEditorTabInContent(mc, tabName, { expand: true });
  revealLinkedTargetInContent(mc, metaValue);
}

function switchResponseTabInContent(mc, tabName) {
  if (!mc) return;
  const tab = tabs.find(function(tt) { return tt.id === activeTabId; });
  if (tab) {
    tab.responseTab = tabName;
    debouncePersist();
  }
  mc.querySelectorAll('.js-res-tabs .tab').forEach(function(x) { x.classList.toggle('active', x.dataset.tab === tabName); });
  const isBody = tabName === 'resBody';
  const isPreview = tabName === 'resPreview';

  mc.querySelectorAll('.js-res-body').forEach(function(el) { el.classList.add('hidden'); });
  mc.querySelector('.js-res-headers')?.classList.add('hidden');
  mc.querySelector('.js-res-cookies')?.classList.add('hidden');
  mc.querySelector('.js-res-tests')?.classList.add('hidden');
  const preview = mc.querySelector('.js-res-preview');
  if (preview) preview.classList.add('hidden');
  const toolbar = mc.querySelector('.js-res-body-toolbar');
  if (toolbar) toolbar.classList.add('hidden');

  if (isBody) {
    if (toolbar) toolbar.classList.remove('hidden');
    const tree = mc.querySelector('.js-res-tree');
    const raw = mc.querySelector('.js-res-raw');
    if (tree) {
      const mode = toolbar?.querySelector('.toggle-btn.active')?.dataset.mode || 'tree';
      tree.classList.toggle('hidden', mode !== 'tree');
      if (raw) raw.classList.toggle('hidden', mode !== 'raw');
    } else if (raw) {
      raw.classList.remove('hidden');
    }
  } else if (tabName === 'resHeaders') {
    mc.querySelector('.js-res-headers')?.classList.remove('hidden');
  } else if (tabName === 'resCookies') {
    mc.querySelector('.js-res-cookies')?.classList.remove('hidden');
  } else if (tabName === 'resTests') {
    mc.querySelector('.js-res-tests')?.classList.remove('hidden');
  } else if (isPreview && preview) {
    preview.classList.remove('hidden');
    if (tab?.response?.body) {
      syncPreviewFrame(preview, tab);
    }
  }

  if (tabName === 'resBody') {
    syncResponseSearch(mc);
  }
}

function triggerSaveFromShortcut(forceSaveAs) {
  saveActiveTabState();
  const tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.url) return;
  vscode.postMessage(buildSaveRequestMessage(tab, forceSaveAs ? undefined : (tab.requestId || undefined)));
}

function focusResponseSearchField() {
  const input = mainContent.querySelector('.js-response-search');
  if (!input || input.closest('.hidden')) return false;
  input.focus();
  input.select?.();
  return true;
}

function toggleBulkEditor(mc, target, open) {
  mc?.querySelectorAll('.js-bulk-editor').forEach(function(panel) {
    var match = panel.dataset.target === target;
    panel.classList.toggle('hidden', !(open && match));
    if (open && match) {
      panel.querySelector('.js-bulk-editor-input')?.focus();
    }
  });
}

function applyBulkEditor(mc, target) {
  var editor = mc?.querySelector('.js-bulk-editor[data-target="' + target + '"]');
  var rows = mc?.querySelector(target === 'headers' ? '.js-header-rows' : '.js-param-rows');
  var input = editor?.querySelector('.js-bulk-editor-input');
  if (!editor || !rows || !input) return;
  var parsed = parseBulkKeyValueText(input.value, target);
  if (!parsed.length) return;
  parsed.forEach(function(item) { addKvRow(rows, item.key, item.value); });
  rows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  input.value = '';
  toggleBulkEditor(mc, target, false);
  if (target === 'params') syncUrlFromParamsEditor(mc);
  markDirty();
  refreshDraftInsights(mc);
}

function renderTabBar() {
  
  tabBar.querySelectorAll('.req-tab').forEach(el => el.remove());

  
  const sorted = tabs.filter(t => t.pinned).concat(tabs.filter(t => !t.pinned));

  for (const tab of sorted) {
    syncRequestTypeFromUrl(tab);
    const tabMethod = isWebSocketTab(tab) ? 'WS' : tab.method;
    const el = document.createElement('div');
    el.className = 'req-tab' + (tab.id === activeTabId ? ' active' : '') + (tab.pinned ? ' pinned' : '') + ' tab-' + tabMethod;
    el.setAttribute('role', 'tab');
    el.setAttribute('tabindex', tab.id === activeTabId ? '0' : '-1');
    el.setAttribute('aria-selected', tab.id === activeTabId ? 'true' : 'false');
    el.setAttribute('aria-label', tabMethod + ' ' + tab.name);
    el.title = tab.name;
    el.innerHTML =
      '<span class="pin-icon">\u{1F4CC}</span>' +
      '<span class="method-badge method-' + tabMethod + '">' + tabMethod + '</span>' +
      '<span class="tab-name">' + escapeHtml(truncate(tab.name, 25)) + '</span>' +
      (tab.dirty ? '<span class="dirty-dot" title="' + escapeAttr(renderRequestDirtyTitle(tab)) + '">\u25CF</span>' : '') +
      '<button class="close-tab" type="button" data-id="' + tab.id + '" title="' + escapeAttr(tr('webview.close')) + '" aria-label="' + escapeAttr(tr('webview.close')) + '">&times;</button>';
    el.addEventListener('click', (e) => {
      const closeButton = e.target.closest('.close-tab');
      if (closeButton && el.contains(closeButton)) {
        closeTab(closeButton.dataset.id);
      } else {
        switchTab(tab.id);
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.target.closest('.close-tab')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchTab(tab.id);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(e.clientX, e.clientY, tab.id);
    });
    tabBar.insertBefore(el, addTabBtn);
  }
}

function showTabContextMenu(x, y, tabId) {
  closeTabContextMenu();
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const tabIdx = tabs.indexOf(tab);
  const othersClosable = tabs.filter(t => t.id !== tabId && !t.pinned);
  const rightClosable = tabs.filter((t, i) => i > tabIdx && !t.pinned);
  const allClosable = tabs.filter(t => !t.pinned);

  const items = [
    { label: tr('webview.close'), action: 'close', disabled: !!tab.pinned },
    { label: tr('webview.closeOthers'), action: 'closeOthers', disabled: othersClosable.length === 0 },
    { label: tr('webview.closeAll'), action: 'closeAll', disabled: allClosable.length === 0 },
    { label: tr('webview.closeRight'), action: 'closeRight', disabled: rightClosable.length === 0 },
    { sep: true },
    tab.pinned
      ? { label: tr('webview.unpinTab'), action: 'unpin' }
      : { label: tr('webview.pinTab'), action: 'pin' },
    { sep: true },
    { label: tr('webview.duplicateTab'), action: 'duplicate' },
  ];

  const menu = document.createElement('div');
  menu.className = 'tab-ctx-menu';
  menu.id = 'tabCtxMenu';
  items.forEach(function(it) {
    if (it.sep) {
      var sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      return;
    }
    var el = document.createElement('div');
    el.className = 'ctx-item' + (it.disabled ? ' disabled' : '');
    el.textContent = it.label;
    el.dataset.action = it.action;
    menu.appendChild(el);
  });

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.body.appendChild(menu);

  
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

  menu.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    closeTabContextMenu();
    switch (action) {
      case 'close':
        closeTab(tabId);
        break;
      case 'closeOthers':
        closeTabs(othersClosable.map(function(t){return t.id}));
        break;
      case 'closeAll':
        closeTabs(allClosable.map(function(t){return t.id}));
        break;
      case 'closeRight':
        closeTabs(rightClosable.map(function(t){return t.id}));
        break;
      case 'pin':
        tab.pinned = true;
        renderTabBar();
        debouncePersist();
        break;
      case 'unpin':
        tab.pinned = false;
        renderTabBar();
        debouncePersist();
        break;
      case 'duplicate':
        saveActiveTabState();
        createTab({ name: tab.name, autoName: !!tab.autoName, requestType: tab.requestType, requestEditorTab: tab.requestEditorTab, method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout, followRedirects: tab.followRedirects, saveToHistory: tab.saveToHistory, tlsValidation: tab.tlsValidation, maxResponseSizeKb: tab.maxResponseSizeKb, retryCount: tab.retryCount, retryDelayMs: tab.retryDelayMs, stopAfterHeaders: tab.stopAfterHeaders, skipDefaultHeaders: tab.skipDefaultHeaders, disableScripts: tab.disableScripts, scriptsTrusted: tab.scriptsTrusted !== false, webSocketKeepAliveEnabled: tab.webSocketKeepAliveEnabled === true, webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds), webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage), jsonFormatStyle: tab.jsonFormatStyle, xmlFormatStyle: tab.xmlFormatStyle, formatIndent: tab.formatIndent, responseSearchQuery: tab.responseSearchQuery || '', responseSearchIndex: typeof tab.responseSearchIndex === 'number' ? tab.responseSearchIndex : 0, responseSearchCaseSensitive: tab.responseSearchCaseSensitive === true, responseSearchRegex: tab.responseSearchRegex === true, scriptHelpCollapsed: tab.scriptHelpCollapsed === true });
        break;
    }
  });
  setTimeout(function() { document.addEventListener('click', closeTabContextMenu, { once: true }); }, 0);
}

function closeTabContextMenu() {
  var m = document.getElementById('tabCtxMenu');
  if (m) m.remove();
}

function getRequestStageInfo(tab) {
  if (!tab) {
    return { tone: 'idle', label: tr('webview.stage.newRequest'), detail: tr('webview.stage.newRequest.detail') };
  }
  if (isWebSocketTab(tab)) {
    if (tab.websocketStatus === 'open') {
      return { tone: 'success', label: tr('webview.connected'), detail: tr('webview.websocket') };
    }
    if (tab.websocketStatus === 'connecting') {
      return { tone: 'loading', label: tr('webview.connecting'), detail: tr('webview.websocket') };
    }
    if (tab.websocketStatus === 'error' && tab.error) {
      return { tone: 'error', label: tr('webview.stage.failed'), detail: truncate(tab.error, 96) };
    }
    if (tab.websocketStatus === 'closed' && (tab.websocketMessages || []).length > 0) {
      return { tone: 'idle', label: tr('webview.disconnected'), detail: tr('webview.websocket') };
    }
    if (tab.url) {
      return { tone: 'ready', label: tr('webview.websocket'), detail: tr('webview.websocketComposer') };
    }
  }
  if (tab.loading) {
    return { tone: 'loading', label: tr('webview.stage.sending'), detail: tr('webview.stage.sending.detail') };
  }
  if (tab.lastEvent === 'canceled') {
    return {
      tone: 'canceled',
      label: tr('webview.stage.canceled'),
      detail: tab.response ? tr('webview.stage.canceled.withResponse') : tr('webview.stage.canceled.noResponse')
    };
  }
  if (tab.error) {
    return { tone: 'error', label: tr('webview.stage.failed'), detail: truncate(tab.error, 96) };
  }
  if (tab.response) {
    var status = tab.response.status || 0;
    var durationLabel = formatDurationMs(getResponseDurationMs(tab, tab.response.time)) || (tab.response.time + ' ms');
    if (status >= 500) {
      return { tone: 'error', label: tr('webview.stage.serverError'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
    }
    if (status >= 400) {
      return { tone: 'error', label: tr('webview.stage.clientError'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
    }
    if (status >= 300) {
      return { tone: 'redirect', label: tr('webview.stage.redirected'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
    }
    return { tone: 'success', label: tr('webview.stage.liveResponse'), detail: status + ' ' + (tab.response.statusText || '') + ' in ' + durationLabel };
  }
  if (tab.url) {
    return { tone: 'ready', label: tr('webview.stage.ready'), detail: tr('webview.stage.ready.detail') };
  }
  return { tone: 'idle', label: tr('webview.stage.newRequest'), detail: tr('webview.stage.newRequest.detail') };
}

function renderPrimaryActionButton(tab) {
  if (isWebSocketTab(tab)) {
    if (tab.websocketStatus === 'connecting') {
      return '<button class="btn-stop js-send" data-testid="stop-request">' +
        '<span class="stop-icon"></span>' +
        '<span class="btn-send-labels">' +
          '<span class="btn-send-primary">' + escapeHtml(tr('webview.disconnect')) + '</span>' +
          '<span class="btn-send-secondary">' + escapeHtml(tr('webview.connecting')) + '</span>' +
        '</span>' +
      '</button>';
    }
    var wsTone = tab.websocketStatus === 'open' ? 'success' : (tab.websocketStatus === 'error' ? 'error' : 'ready');
    var wsPrimary = tab.websocketStatus === 'open' ? tr('webview.sendMessage') : tr('webview.connect');
    var wsSecondary = tab.websocketStatus === 'open'
      ? tr('webview.connected')
      : (tab.websocketStatus === 'error' && tab.error ? tab.error : tr('webview.websocket'));
    var wsIcon = tab.websocketStatus === 'open'
      ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.5l14 6.5-14 6.5V9l10-1-10-1V1.5z"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h10a1 1 0 011 1v6a1 1 0 01-1 1H8.5L5 13.5V10H3a1 1 0 01-1-1V3a1 1 0 011-1zm1 2v4h3v2.1L9.1 8H12V4H4z"/></svg>';
    // WS open일 때만 summary/status에서 성공을 표현 — Send/Connect 필은 액션 색 유지
    var sendTone = wsTone === 'success' ? 'ready' : (wsTone === 'error' ? 'ready' : wsTone);
    return '<button class="btn-send state-' + sendTone + ' js-send" data-testid="send-request">' +
      wsIcon +
      '<span class="btn-send-labels">' +
        '<span class="btn-send-primary">' + escapeHtml(wsPrimary) + '</span>' +
        '<span class="btn-send-secondary">' + escapeHtml(wsSecondary) + '</span>' +
      '</span>' +
    '</button>';
  }
  if (tab.loading) {
    return '<button class="btn-stop js-send" data-testid="stop-request">' +
      '<span class="stop-icon"></span>' +
      '<span class="btn-send-labels">' +
        '<span class="btn-send-primary">' + escapeHtml(tr('webview.stop')) + '</span>' +
        '<span class="btn-send-secondary">' + escapeHtml(tr('webview.stage.sending.detail')) + '</span>' +
      '</span>' +
    '</button>';
  }

  var tone = 'ready';
  var primary = tr('webview.send');
  var secondary = '';
  var icon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.5l14 6.5-14 6.5V9l10-1-10-1V1.5z"/></svg>';
  var keyHint = '<span class="btn-keyhint">Enter</span>';

  if (tab.lastEvent === 'success' && tab.response) {
    // 성공 강조는 응답 sticky summary만 담당 — Send secondary에 2xx를 미러하지 않음
    tone = 'ready';
    primary = tr('webview.sendAgain');
    secondary = '';
    keyHint = '';
  } else if (tab.lastEvent === 'error') {
    tone = 'ready';
    primary = tr('webview.retry');
    secondary = tab.error || tr('webview.stage.failed');
    keyHint = '';
  } else if (tab.lastEvent === 'canceled') {
    tone = 'ready';
    primary = tr('webview.sendAgain');
    secondary = tr('webview.stage.canceled');
    keyHint = '';
  }

  return '<button class="btn-send state-' + tone + ' js-send" data-testid="send-request">' +
    icon +
    '<span class="btn-send-labels">' +
      '<span class="btn-send-primary">' + escapeHtml(primary) + '</span>' +
      (secondary ? '<span class="btn-send-secondary">' + escapeHtml(secondary) + '</span>' : '') +
    '</span>' +
    keyHint +
  '</button>';
}

function buildResponseStatusLine(response) {
  if (!response) return '';
  return response.status + ' ' + (response.statusText || '');
}

function buildRawResponseHeaders(response) {
  if (!response?.headers) return '';
  return Object.entries(response.headers).map(function(entry) {
    return entry[0] + ': ' + entry[1];
  }).join('\\n');
}

function buildSampleRequestData() {
  return {
    name: tr('webview.sampleRequestName'),
    autoName: false,
    requestId: null,
    method: 'GET',
    url: 'https://dummyjson.com/products/search?q=phone',
    headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    params: [],
    body: '',
    bodyType: 'none',
    formData: [],
    binaryFilePath: '',
    auth: { type: 'none' },
    scripts: { preRequest: '', test: '' },
    timeout: 0,
    followRedirects: false,
    saveToHistory: true,
    tlsValidation: 'default',
    maxResponseSizeKb: DEFAULT_MAX_RESPONSE_SIZE_KB,
    retryCount: 0,
    retryDelayMs: 0,
    stopAfterHeaders: false,
    skipDefaultHeaders: false,
    disableScripts: false,
    webSocketKeepAliveEnabled: false,
    webSocketKeepAliveIntervalSeconds: DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS,
    webSocketKeepAliveMessage: DEFAULT_WS_KEEPALIVE_MESSAGE,
  };
}

function loadSampleRequestIntoActiveTab() {
  var sample = buildSampleRequestData();
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab) {
    createTab(sample);
    return;
  }
  Object.assign(tab, sample, {
    id: tab.id,
    response: null,
    error: null,
    lastEvent: 'ready',
    dirty: true,
    _snapshot: null,
    responseTab: 'resBody',
    pinned: false,
    requestStartedAt: null,
    requestEndedAt: null,
    durationMs: null,
  });
  resetBodyUndoState(tab, tab.body);
  renderTabBar();
  renderContent();
  debouncePersist();
}

function renderEmptyState(title, copy, actions) {
  // Quiet Instrument: 짧은 안내 + 주요 액션만 (orbit/카드/kicker 없음); 저대비 Tessra mark 1회
  return '<div class="empty-state">' +
    renderTessraMark('tessra-mark--empty') +
    '<div class="empty-state-title">' + escapeHtml(title) + '</div>' +
    '<div class="empty-state-copy">' + escapeHtml(copy) + '</div>' +
    ((actions && actions.length)
      ? '<div class="empty-state-actions">' + actions.map(function(action, index) {
          return '<button class="empty-state-action js-empty-action' + (index === 0 ? ' primary' : '') + '" type="button" data-action="' + escapeAttr(action.action || '') + '">' + escapeHtml(action.label || '') + '</button>';
        }).join('') + '</div>'
      : '') +
  '</div>';
}

function renderResponseStat(label, value, tone, detail) {
  return '<div class="response-stat-card' + (tone ? ' ' + tone : '') + '">' +
    '<div class="response-stat-label">' + escapeHtml(label) + '</div>' +
    '<div class="response-stat-value">' + escapeHtml(value) + '</div>' +
    (detail ? '<div class="response-stat-detail">' + escapeHtml(detail) + '</div>' : '') +
  '</div>';
}

function renderInlineEmptyState(_kicker, title, copy) {
  return '<div class="empty-state inline">' +
    '<div class="empty-state-title">' + escapeHtml(title) + '</div>' +
    '<div class="empty-state-copy">' + escapeHtml(copy) + '</div>' +
  '</div>';
}

function getEnabledDefaultHeaders() {
  return (workspaceDefaultHeaders || []).filter(function(header) {
    return header && header.enabled !== false && header.key;
  });
}

function getAppliedDefaultHeaders(tab) {
  if (!tab || tab.skipDefaultHeaders) return [];
  var requestHeaderKeys = new Set((tab.headers || [])
    .filter(function(header) { return header && header.enabled !== false && header.key; })
    .map(function(header) { return String(header.key).toLowerCase(); }));
  return getEnabledDefaultHeaders().filter(function(header) {
    return !requestHeaderKeys.has(String(header.key).toLowerCase());
  });
}

function getOverriddenDefaultHeaders(tab) {
  if (!tab || tab.skipDefaultHeaders) return [];
  var requestHeaderKeys = new Set((tab.headers || [])
    .filter(function(header) { return header && header.enabled !== false && header.key; })
    .map(function(header) { return String(header.key).toLowerCase(); }));
  return getEnabledDefaultHeaders().filter(function(header) {
    return requestHeaderKeys.has(String(header.key).toLowerCase());
  });
}

function renderDefaultHeaderKeyGroup(labelKey, headers, chipClass) {
  if (!headers.length) return '';
  return '<div class="default-headers-key-group">' +
    '<div class="default-headers-key-label">' + escapeHtml(tr(labelKey)) + '</div>' +
    '<div class="default-headers-key-list">' + headers
      .slice(0, 6)
      .map(function(header) {
        return '<span class="default-header-chip' + chipClass + '">' + escapeHtml(header.key) + '</span>';
      })
      .join('') +
      (headers.length > 6 ? '<span class="default-header-chip' + chipClass + '">+' + (headers.length - 6) + '</span>' : '') +
      '</div>' +
    '</div>';
}

function renderDefaultHeadersBanner(tab) {
  var title = tr('webview.defaultHeaders');
  var manageLabel = tr('webview.manage');
  var tone = '';
  var summary = '';
  var detail = '';
  if (tab?.skipDefaultHeaders) {
    tone = ' warning';
    summary = tr('webview.defaultHeadersSkippedState');
    detail = '<div class="default-headers-banner-note">' + escapeHtml(tr('webview.defaultHeadersSkippedNote')) + '</div>';
  } else {
    var enabled = getEnabledDefaultHeaders();
    if (!enabled.length) {
      summary = tr('webview.defaultHeadersEmptyState');
      detail = '<div class="default-headers-banner-note">' + escapeHtml(tr('webview.defaultHeadersAppliedNote')) + '</div>';
    } else {
      var applied = getAppliedDefaultHeaders(tab);
      var overridden = getOverriddenDefaultHeaders(tab);
      tone = ' active';
      summary = tfCount('webview.defaultHeadersApplied', applied.length);
      detail = renderDefaultHeaderKeyGroup('webview.defaultHeadersAppliedLabel', applied, '') +
        renderDefaultHeaderKeyGroup('webview.defaultHeadersOverriddenLabel', overridden, ' override') +
        (overridden.length
          ? '<div class="default-headers-banner-note">' + escapeHtml(tfCount('webview.defaultHeadersOverridden', overridden.length)) + '</div>'
          : '');
    }
  }
  return '<div class="default-headers-banner' + tone + '" data-expanded="0">' +
    '<div class="default-headers-oneline">' +
      '<button type="button" class="default-headers-summary js-default-headers-toggle" aria-expanded="false" aria-label="' + escapeAttr(title + ' · ' + summary) + '">' +
        '<span class="default-headers-banner-title">' + escapeHtml(title) + '</span>' +
        '<span class="status-strip-sep" aria-hidden="true">·</span>' +
        '<span class="default-headers-banner-copy">' + escapeHtml(summary) + '</span>' +
      '</button>' +
      '<button class="ghost-btn js-open-default-headers" type="button">' + escapeHtml(manageLabel) + '</button>' +
    '</div>' +
    '<div class="default-headers-expand js-default-headers-expand hidden">' + detail + '</div>' +
  '</div>';
}

function countExecutableScripts(scripts) {
  var count = 0;
  if (scripts && (scripts.preRequest || '').trim()) count++;
  if (scripts && (scripts.test || '').trim()) count++;
  return count;
}

function renderTessraMark(extraClass) {
  // Activity Bar / Marketplace 아이콘과 동일 테서랙트 와이어프레임 (tiny mark only)
  return '<svg class="tessra-mark' + (extraClass ? ' ' + extraClass : '') + '" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M12 2.9 19.1 7v10L12 21.1 4.9 17V7L12 2.9Zm0 0v18.2M4.9 7l7.1 4.1L19.1 7M4.9 17l7.1-4.2 7.1 4.2M4.9 7l7.1 5.8L4.9 17M19.1 7 12 12.8l7.1 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';
}

function renderStatusStripCue(cue) {
  if (cue === 'on-dot') return '<span class="status-strip-cue" aria-hidden="true">●</span>';
  if (cue === 'on-check') return '<span class="status-strip-cue" aria-hidden="true">✓</span>';
  if (cue === 'warn') return '<span class="status-strip-cue" aria-hidden="true">⚠</span>';
  if (cue === 'off') return '<span class="status-strip-cue" aria-hidden="true">○</span>';
  return '';
}

function renderStatusStripLabelHtml(label, count) {
  if (count == null) return escapeHtml(label);
  var countStr = String(count);
  var idx = String(label).lastIndexOf(countStr);
  if (idx < 0) return escapeHtml(label);
  return escapeHtml(String(label).slice(0, idx)) +
    '<span class="status-strip-num">' + escapeHtml(countStr) + '</span>' +
    escapeHtml(String(label).slice(idx + countStr.length));
}

function isEnvironmentEditorOpen() {
  return !!(envEditor && !envEditor.classList.contains('hidden'));
}

function getStatusStripRoot() {
  return (typeof mainContent !== 'undefined' && mainContent)
    ? mainContent.querySelector('.js-status-strip')
    : null;
}

function isStatusStripExpanded() {
  return getStatusStripRoot()?.dataset?.expanded === '1';
}

function setStatusStripExpanded(open, options) {
  var opts = options || {};
  var host = (typeof mainContent !== 'undefined' && mainContent) ? mainContent : null;
  var strip = host?.querySelector('.js-status-strip');
  var panel = strip?.querySelector('.js-status-strip-panel');
  var toggle = strip?.querySelector('.js-status-strip-toggle');
  if (!strip || !panel || !toggle) return false;
  strip.dataset.expanded = open ? '1' : '0';
  panel.classList.toggle('hidden', !open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toggle.setAttribute('aria-label', open ? tr('webview.collapse') : tr('webview.expand'));
  toggle.setAttribute('title', open ? tr('webview.collapse') : tr('webview.expand'));
  // Used/Vars 세그먼트 aria-expanded 동기화
  host.querySelectorAll('.status-strip-seg[data-action="reveal-variable-usage"]').forEach(function(btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  if (open && opts.focusSelector) {
    var target = panel.querySelector(opts.focusSelector);
    if (target) {
      clearLinkedFocusInContent(host);
      if (typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch (_) {
          target.scrollIntoView();
        }
      }
      queueLinkedFocusReveal(function() {
        if (!target?.isConnected) return;
        target.classList.add('linked-focus-active');
        var focusable = target.querySelector('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') || target;
        focusLinkedTarget(focusable);
        linkedFocusTimer = setTimeout(function() {
          target.classList.remove('linked-focus-active');
          linkedFocusTimer = null;
        }, 2200);
      });
    }
  }
  return true;
}

function revealVariableUsageDisclosure() {
  var host = (typeof mainContent !== 'undefined' && mainContent) ? mainContent : null;
  var focusSel = host?.querySelector('.js-status-strip-unresolved')
    ? '.js-status-strip-unresolved'
    : '.js-status-strip-var-usage';
  setStatusStripExpanded(true, { focusSelector: focusSel });
}

function renderStatusStripSegment(label, tone, action, meta, tooltip, options) {
  options = options || {};
  var cue = options.cue || '';
  var priority = options.priority || 'medium';
  var classes = 'status-strip-seg' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '');
  var testId = '';
  if (action === 'edit-environment' || action === 'switch-environment') {
    testId = 'status-environment';
  } else if (action === 'reveal-variable-usage') {
    testId = 'status-variable-usage';
  }
  var attrs = action
    ? ' type="button" data-action="' + escapeAttr(action) + '"' + (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '')
    : '';
  if (testId) {
    attrs += ' data-testid="' + escapeAttr(testId) + '"';
  }
  if (options.ariaExpanded != null) {
    attrs += ' aria-expanded="' + (options.ariaExpanded ? 'true' : 'false') + '"';
  }
  if (options.ariaControls) {
    attrs += ' aria-controls="' + escapeAttr(options.ariaControls) + '"';
  }
  var titleAttr = tooltip ? ' title="' + escapeAttr(tooltip) + '"' : '';
  var priorityAttr = ' data-priority="' + escapeAttr(priority) + '"';
  var tag = action ? 'button' : 'span';
  var labelInner = options.labelHtml != null
    ? options.labelHtml
    : renderStatusStripLabelHtml(label, options.count);
  return '<' + tag + ' class="' + classes + '"' + attrs + priorityAttr + titleAttr + '>' +
    (options.mark ? renderTessraMark('tessra-mark--strip') : '') +
    renderStatusStripCue(cue) +
    '<span class="status-strip-label">' + labelInner + '</span>' +
  '</' + tag + '>';
}

function buildStatusStripSegments(tab) {
  var segments = [];

  // 1) Environment — always first; shows active env variable count (not request usage)
  var envLabel = currentEnvName || tr('webview.noEnvironment');
  var envTip = currentEnvName
    ? tf('webview.summaryEnvironment', { name: currentEnvName }) + ' · ' + tfCount('environment.vars', envEditorVariableCount)
    : tr('webview.noEnvironment');
  var envLabelHtml = escapeHtml(envLabel);
  if (currentEnvName) {
    envLabelHtml += '<span class="status-strip-env-count"> ' +
      renderStatusStripLabelHtml(tfCount('environment.vars', envEditorVariableCount), envEditorVariableCount) +
      '</span>';
  }
  segments.push(renderStatusStripSegment(
    envLabel,
    currentEnvName ? 'is-env' : 'is-warn',
    currentEnvName ? 'edit-environment' : 'switch-environment',
    null,
    envTip,
    {
      cue: currentEnvName ? '' : 'warn',
      priority: 'critical',
      mark: true,
      labelHtml: envLabelHtml,
      ariaExpanded: currentEnvName ? isEnvironmentEditorOpen() : undefined,
      ariaControls: currentEnvName ? 'envEditor' : undefined
    }
  ));

  // 2) Scripts — glanceable when present; warn when disabled/untrusted
  var hasScripts = hasExecutableScripts(tab?.scripts);
  var scriptsOff = !!(tab?.disableScripts || (hasScripts && tab?.scriptsTrusted === false));
  var scriptCount = countExecutableScripts(tab?.scripts);
  if (scriptsOff) {
    var scriptsOffMeta = tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request';
    segments.push(renderStatusStripSegment(
      tr('webview.disableScriptsStatus'),
      'is-warn',
      'switch-tab',
      scriptsOffMeta,
      tr('webview.disableScriptsStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  } else if (hasScripts) {
    var scriptsLabel = scriptCount > 1
      ? tfCount('webview.stripScriptsCount', scriptCount)
      : tr('webview.scriptsPresentStatus');
    segments.push(renderStatusStripSegment(
      scriptsLabel,
      'is-on',
      'switch-tab',
      'scripts:pre-request',
      tr('webview.summaryScriptsOn'),
      { cue: 'on-dot', priority: 'high' }
    ));
  }

  // 3) History — always visible; on/off must be distinguishable at a glance
  var historyOn = tab?.saveToHistory !== false;
  segments.push(renderStatusStripSegment(
    tr(historyOn ? 'webview.saveToHistoryOnStatus' : 'webview.saveToHistoryOffStatus'),
    historyOn ? 'is-on' : 'is-off',
    'switch-tab',
    'settings:save-history',
    tr(historyOn ? 'webview.summaryHistoryOn' : 'webview.summaryHistoryOff'),
    { cue: historyOn ? 'on-check' : 'off', priority: 'high' }
  ));

  // 4) Defaults — applied count or skipped warning only
  if (tab?.skipDefaultHeaders) {
    segments.push(renderStatusStripSegment(
      tr('webview.skipDefaultHeadersStatus'),
      'is-warn',
      'switch-tab',
      'settings:skip-default-headers',
      tr('webview.skipDefaultHeadersStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  } else {
    var appliedDefaultHeaders = getAppliedDefaultHeaders(tab);
    if (appliedDefaultHeaders.length > 0) {
      segments.push(renderStatusStripSegment(
        tfCount('webview.stripDefaultsCount', appliedDefaultHeaders.length),
        'is-info',
        'open-default-headers',
        null,
        tr('webview.defaultHeaders'),
        { priority: 'medium', count: appliedDefaultHeaders.length }
      ));
    }
  }

  // 5) Risk / non-default execution overrides
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    segments.push(renderStatusStripSegment(
      tr('webview.tlsInsecureStatus'),
      'is-warn',
      'switch-tab',
      'settings:tls-validation',
      tr('webview.tlsInsecureStatus'),
      { cue: 'warn', priority: 'critical' }
    ));
  }
  if (tab?.followRedirects) {
    segments.push(renderStatusStripSegment(
      tr('webview.followRedirectsStatus'),
      'is-info',
      'switch-tab',
      'settings:follow-redirects',
      tr('webview.followRedirectsStatus'),
      { priority: 'medium' }
    ));
  }
  if (tab?.stopAfterHeaders) {
    segments.push(renderStatusStripSegment(
      tr('webview.stopAfterHeadersStatus'),
      'is-warn',
      'switch-tab',
      'settings:stop-after-headers',
      tr('webview.stopAfterHeadersStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  }

  // 6) Request variable usage — distinct from active env's defined var count.
  // Click opens strip disclosure with the same {{var}} + scope list 1.0.9 showed (not a permanent card).
  var usage = collectVariableUsage(tab);
  var unresolved = getUnresolvedDraftVariableNames(tab);
  if (unresolved.length > 0) {
    segments.push(renderStatusStripSegment(
      tfCount('webview.stripVarsCount', unresolved.length),
      'is-warn',
      'reveal-variable-usage',
      null,
      unresolved.map(function(n) { return '{{' + n + '}}'; }).join(', '),
      {
        cue: 'warn',
        priority: 'high',
        count: unresolved.length,
        ariaExpanded: isStatusStripExpanded(),
        ariaControls: 'statusStripVariableUsage'
      }
    ));
  } else if (usage.length > 0) {
    segments.push(renderStatusStripSegment(
      tfCount('webview.stripUsedCount', usage.length),
      'is-info',
      'reveal-variable-usage',
      null,
      usage.map(function(u) { return '{{' + u.name + '}}'; }).join(', '),
      {
        priority: 'low',
        count: usage.length,
        ariaExpanded: isStatusStripExpanded(),
        ariaControls: 'statusStripVariableUsage'
      }
    ));
  }

  // Profile stays in expand disclosure only — not on the always-visible line.
  return segments;
}

function renderStatusStripExpandDetails(tab) {
  var usage = collectVariableUsage(tab);
  var unresolved = getUnresolvedDraftVariableNames(tab);
  var applied = getAppliedDefaultHeaders(tab);
  var parts = [];
  parts.push('<div class="status-strip-detail-block">' +
    '<button type="button" class="status-strip-link" data-action="switch-environment">' + escapeHtml(currentEnvName ? tf('webview.summaryEnvironment', { name: currentEnvName }) : tr('webview.noEnvironment')) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="edit-environment">' + escapeHtml(tr('webview.editEnvironmentVariables')) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="change-workspace-profile" title="' + escapeAttr(tr(currentWorkspaceProfile === 'default' ? 'webview.profileDefaultTooltip' : 'webview.profileCustomTooltip')) + '">' + escapeHtml(renderProfileIndicator(currentWorkspaceProfile)) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="open-default-headers">' + escapeHtml(tr('webview.defaultHeaders')) + '</button>' +
  '</div>');
  if (unresolved.length > 0) {
    parts.push('<div class="status-strip-detail-block warning js-status-strip-unresolved">' +
      '<div class="status-strip-detail-title">' + escapeHtml(tfCount('webview.unresolvedVariablesCount', unresolved.length)) + '</div>' +
      '<div class="status-strip-detail-copy">' + escapeHtml(unresolved.map(function(name) { return '{{' + name + '}}'; }).join(', ')) + '</div>' +
      '<button type="button" class="status-strip-link" data-action="edit-environment">' + escapeHtml(tr('webview.editEnvironmentVariables')) + '</button>' +
      '<button type="button" class="status-strip-link" data-action="switch-environment">' + escapeHtml(tr('webview.openEnvironmentPicker')) + '</button>' +
    '</div>');
  }
  // Visible variable-usage list lives in strip disclosure (Quiet Instrument); keep js-variable-usage-wrap for refresh.
  if (usage.length > 0 || unresolved.length > 0) {
    parts.push('<div class="status-strip-detail-block js-status-strip-var-usage" id="statusStripVariableUsage" data-testid="variable-usage-disclosure">' +
      '<div class="js-variable-usage-wrap">' + renderVariableUsage(tab) + '</div>' +
    '</div>');
  }
  if (applied.length > 0 && !tab?.skipDefaultHeaders) {
    parts.push('<div class="status-strip-detail-block">' +
      '<div class="status-strip-detail-title">' + escapeHtml(tfCount('webview.defaultHeadersApplied', applied.length)) + '</div>' +
      '<div class="status-strip-detail-copy">' + escapeHtml(applied.map(function(h) { return h.key; }).join(', ')) + '</div>' +
    '</div>');
  }
  var warnings = [];
  var expandHasScripts = hasExecutableScripts(tab?.scripts);
  var expandScriptsOff = !!(tab?.disableScripts || (expandHasScripts && tab?.scriptsTrusted === false));
  if (expandScriptsOff) {
    warnings.push({
      label: tr('webview.disableScriptsStatus'),
      action: 'switch-tab',
      meta: tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request'
    });
  } else if (expandHasScripts) {
    warnings.push({ label: tr('webview.scriptsPresentStatus'), action: 'switch-tab', meta: 'scripts:pre-request' });
  }
  if (tab?.followRedirects) warnings.push({ label: tr('webview.followRedirectsStatus'), action: 'switch-tab', meta: 'settings:follow-redirects' });
  if (tab?.stopAfterHeaders) warnings.push({ label: tr('webview.stopAfterHeadersStatus'), action: 'switch-tab', meta: 'settings:stop-after-headers' });
  if (tab?.saveToHistory === false) warnings.push({ label: tr('webview.saveToHistoryOffStatus'), action: 'switch-tab', meta: 'settings:save-history' });
  if (tab?.skipDefaultHeaders) warnings.push({ label: tr('webview.skipDefaultHeadersStatus'), action: 'switch-tab', meta: 'settings:skip-default-headers' });
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    warnings.push({ label: tr('webview.tlsInsecureStatus'), action: 'switch-tab', meta: 'settings:tls-validation' });
  }
  if (warnings.length) {
    parts.push('<div class="status-strip-detail-block">' + warnings.map(function(w) {
      return '<button type="button" class="status-strip-link" data-action="' + escapeAttr(w.action) + '" data-meta="' + escapeAttr(w.meta) + '">' + escapeHtml(w.label) + '</button>';
    }).join('') + '</div>');
  }
  // linked-focus 호환용 숨김 칩/프리플라이트 훅 유지 (변수 사용처는 위 disclosure에 노출)
  parts.push('<div class="request-status-chips js-topline-status-chips visually-hidden" aria-hidden="true">' + renderLegacyStatusChipHooks(tab) + '</div>');
  parts.push('<div class="js-request-preflight-wrap visually-hidden" aria-hidden="true">' + renderRequestPreflight(tab) + '</div>');
  return parts.join('');
}

function renderLegacyStatusChipHooks(tab) {
  var chips = [];
  chips.push(renderStatusChip(
    renderProfileIndicator(currentWorkspaceProfile),
    currentWorkspaceProfile === 'default' ? 'muted' : 'info',
    'change-workspace-profile',
    null,
    tr(currentWorkspaceProfile === 'default' ? 'webview.profileDefaultTooltip' : 'webview.profileCustomTooltip')
  ));
  if (currentEnvName) {
    chips.push(renderEnvironmentStatusChip(currentEnvName));
  } else {
    chips.push(renderStatusChip(tr('webview.noEnvironment'), 'muted', 'switch-environment'));
  }
  if (tab?.skipDefaultHeaders) {
    chips.push(renderStatusChip(tr('webview.skipDefaultHeadersStatus'), 'warning', 'switch-tab', 'settings:skip-default-headers'));
  } else {
    var appliedDefaultHeaders = getAppliedDefaultHeaders(tab);
    if (appliedDefaultHeaders.length > 0) {
      chips.push(renderStatusChip(tfCount('webview.defaultHeadersStatus', appliedDefaultHeaders.length), 'info', 'open-default-headers'));
    }
  }
  var chipHasScripts = hasExecutableScripts(tab?.scripts);
  var chipScriptsOff = !!(tab?.disableScripts || (chipHasScripts && tab?.scriptsTrusted === false));
  if (chipScriptsOff) {
    chips.push(renderStatusChip(
      tr('webview.disableScriptsStatus'),
      'warning',
      'switch-tab',
      tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request'
    ));
  } else if (chipHasScripts) {
    chips.push(renderStatusChip(tr('webview.scriptsPresentStatus'), 'muted', 'switch-tab', 'scripts:pre-request'));
  }
  if (tab?.followRedirects) chips.push(renderStatusChip(tr('webview.followRedirectsStatus'), 'info', 'switch-tab', 'settings:follow-redirects'));
  if (tab?.stopAfterHeaders) chips.push(renderStatusChip(tr('webview.stopAfterHeadersStatus'), 'warning', 'switch-tab', 'settings:stop-after-headers'));
  if (tab?.saveToHistory === false) chips.push(renderStatusChip(tr('webview.saveToHistoryOffStatus'), 'muted', 'switch-tab', 'settings:save-history'));
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    chips.push(renderStatusChip(tr('webview.tlsInsecureStatus'), 'warning', 'switch-tab', 'settings:tls-validation'));
  }
  return chips.join('');
}

function renderStatusStrip(tab) {
  var segments = buildStatusStripSegments(tab);
  var sep = '<span class="status-strip-sep" aria-hidden="true">│</span>';
  return '<div class="status-strip js-status-strip" data-expanded="0">' +
    '<div class="status-strip-line">' +
      '<div class="status-strip-segments">' + segments.join(sep) + '</div>' +
      '<button type="button" class="status-strip-toggle js-status-strip-toggle" aria-expanded="false" aria-label="' + escapeAttr(tr('webview.expand')) + '" title="' + escapeAttr(tr('webview.expand')) + '">▾</button>' +
    '</div>' +
    '<div class="status-strip-panel js-status-strip-panel hidden">' + renderStatusStripExpandDetails(tab) + '</div>' +
  '</div>';
}

function renderToplineStatusChips(tab) {
  return renderLegacyStatusChipHooks(tab);
}

function refreshToplineStatusChips(mc) {
  refreshStatusStrip(mc);
}

function refreshStatusStrip(mc) {
  var wrap = mc?.querySelector('.js-status-strip-host');
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!wrap || !tab) return;
  var draftTab = buildDraftTabFromContent(mc);
  var wasExpanded = isStatusStripExpanded();
  wrap.innerHTML = renderStatusStrip(draftTab);
  if (wasExpanded) {
    setStatusStripExpanded(true);
  }
  syncEnvironmentStripDisclosureState();
}

function refreshRequestPreflight(mc) {
  var wrap = mc?.querySelector('.js-request-preflight-wrap');
  if (!wrap) return;
  var draftTab = buildDraftTabFromContent(mc);
  wrap.innerHTML = renderRequestPreflight(draftTab);
}

function refreshDefaultHeadersBanner(mc) {
  var wrap = mc?.querySelector('.js-default-headers-banner-wrap');
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!wrap || !tab) return;

  var draftHeaders = collectKv(mc.querySelector('.js-header-rows'));
  var skipDefaultHeadersInput = mc.querySelector('.js-skip-default-headers');
  var draftTab = Object.assign({}, tab, {
    headers: draftHeaders,
    skipDefaultHeaders: skipDefaultHeadersInput ? skipDefaultHeadersInput.checked === true : !!tab.skipDefaultHeaders
  });

  wrap.innerHTML = renderDefaultHeadersBanner(draftTab);
  refreshToplineStatusChips(mc);
}

function isPreviewSafeUrl(value) {
  return value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:');
}

function countPreviewExternalAssets(doc) {
  var count = 0;
  doc.querySelectorAll('[src],[href],[srcset],[poster],[action],[formaction]').forEach(function(el) {
    Array.from(el.attributes).forEach(function(attr) {
      var name = attr.name.toLowerCase();
      if (['src', 'href', 'srcset', 'poster', 'action', 'formaction'].indexOf(name) === -1) return;
      var value = String(attr.value || '').trim();
      if (!value || isPreviewSafeUrl(value)) return;
      count += 1;
    });
  });
  return count;
}

function sanitizePreviewDocument(doc) {
  doc.querySelectorAll('script, style, noscript, iframe, object, embed, link, source, audio, video, track, base, meta[http-equiv="refresh"]').forEach(function(node) {
    node.remove();
  });
  doc.querySelectorAll('*').forEach(function(el) {
    Array.from(el.attributes).forEach(function(attr) {
      var name = attr.name.toLowerCase();
      var value = String(attr.value || '').trim();
      if (name.startsWith('on') || name === 'style' || name === 'srcset') {
        el.removeAttribute(attr.name);
        return;
      }
      if (['src', 'href', 'poster', 'action', 'formaction'].indexOf(name) >= 0 && value && !isPreviewSafeUrl(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
}

function extractPreviewDescription(doc) {
  var meta = doc.querySelector('meta[name="description"], meta[property="og:description"]');
  if (meta && meta.getAttribute('content')) {
    return meta.getAttribute('content').trim();
  }
  var bodyText = collapseWhitespace((doc.body && doc.body.textContent) || '');
  return bodyText ? truncate(bodyText, 220) : '';
}

function buildPreviewPayload(rawHtml) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(rawHtml || '', 'text/html');
  var blockedAssets = countPreviewExternalAssets(doc);
  sanitizePreviewDocument(doc);

  var docLang = (doc.documentElement && doc.documentElement.getAttribute('lang')) || currentDisplayLanguage || 'en';
  var title = ((doc.querySelector('title') && doc.querySelector('title').textContent) || '').trim() || tr('webview.preview');
  var description = extractPreviewDescription(doc);
  var bodyHtml = (doc.body && doc.body.innerHTML ? doc.body.innerHTML.trim() : '');
  var bodyText = collapseWhitespace((doc.body && doc.body.textContent) || '');
  var hasStaticSnapshot = !!bodyHtml && bodyText.length >= 24;

  return {
    docLang: docLang,
    title: title,
    description: description,
    bodyHtml: bodyHtml,
    blockedAssets: blockedAssets,
    hasStaticSnapshot: hasStaticSnapshot,
  };
}

function hasMeaningfulStaticPreview(rawHtml) {
  return buildPreviewPayload(rawHtml).hasStaticSnapshot;
}

function hasHtmlPreview(tab) {
  if (!tab?.response) return false;
  var contentType = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (contentType.indexOf('html') < 0) return false;
  return hasMeaningfulStaticPreview(tab.response.body || '');
}

function buildPreviewDocument(rawHtml, resolvedUrl) {
  var payload = buildPreviewPayload(rawHtml);
  var docLang = payload.docLang;
  var title = payload.title;
  var description = payload.description;
  var bodyHtml = payload.bodyHtml;
  var hasStaticSnapshot = payload.hasStaticSnapshot;
  var blockedAssetsLabel = tf('webview.previewOfflineBlockedAssets', { count: String(payload.blockedAssets) });

  return '<div class="preview-shell" lang="' + escapeAttr(docLang) + '">' +
    '<div class="preview-kicker">' + escapeHtml(tr('webview.previewOfflineTitle')) + '</div>' +
    '<h1 class="preview-title">' + escapeHtml(title) + '</h1>' +
    '<p class="preview-copy">' + escapeHtml(tr('webview.previewOfflineCopy')) + '</p>' +
    '<div class="preview-grid">' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineSource')) + '</div>' +
        '<div class="preview-card-value">' + escapeHtml(resolvedUrl || '') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineDescription')) + '</div>' +
        '<div class="preview-card-value' + (description ? '' : ' muted') + '">' + escapeHtml(description || '-') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(blockedAssetsLabel) + '</div>' +
        '<div class="preview-card-value">' + escapeHtml(String(payload.blockedAssets)) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="preview-section">' +
      '<div class="preview-section-title">' + escapeHtml(tr('webview.previewOfflineStaticSnapshot')) + '</div>' +
      (hasStaticSnapshot
        ? '<div class="preview-snapshot">' + bodyHtml + '</div>'
        : '<div class="preview-empty">' + escapeHtml(tr('webview.previewOfflineNoStatic')) + '</div>') +
    '</div>' +
  '</div>';
}

function buildPreviewDocKey(tab) {
  if (!tab || !tab.response) return '';
  var body = tab.response.body || '';
  return [
    tab.response.status || 0,
    tab.response.size || 0,
    tab.resolvedUrl || tab.url || '',
    body.length,
    body.slice(0, 120)
  ].join('|');
}

function syncPreviewFrame(preview, tab) {
  if (!preview || !tab?.response) return;
  var key = buildPreviewDocKey(tab);
  if (preview.dataset.previewKey === key) return;
  preview.innerHTML = buildPreviewDocument(tab.response.body || '', tab.resolvedUrl || tab.url || '');
  preview.dataset.previewKey = key;
}

function renderWebSocketResponse(tab) {
  var status = tab.websocketStatus || 'closed';
  var messages = tab.websocketMessages || [];
  var statusLabel = websocketStatusLabel(status);
  var actionHtml = (status === 'open' || status === 'connecting')
    ? '<button class="res-action-btn ripple-btn js-ws-disconnect" type="button">' + escapeHtml(tr('webview.disconnect')) + '</button>'
    : '';
  var messagesHtml = messages.length === 0
    ? '<div class="ws-empty">' + escapeHtml(tr('webview.websocketNoMessages')) + '</div>'
    : messages.map(function(item) {
        var messageType = item.messageType || 'text';
        var direction = messageType === 'system' ? 'SYS' : (item.direction === 'out' ? 'OUT' : 'IN');
        var directionClass = messageType === 'system' ? 'system' : (item.direction === 'out' ? 'out' : 'in');
        var payload = messageType === 'binary'
          ? tf('webview.websocketBinaryMessage', { size: String(item.size || 0) }) + '\\n' + (item.data || '')
          : (item.data || '');
        var sizeLabel = typeof item.size === 'number' ? ' · ' + formatSize(item.size) : '';
        return '<div class="ws-message ' + directionClass + '">' +
          '<div class="ws-message-meta">' +
            '<span class="ws-direction">' + escapeHtml(direction) + '</span>' +
            '<span class="ws-time">' + escapeHtml(formatLocalTime(item.timestamp || Date.now()) + sizeLabel) + '</span>' +
          '</div>' +
          '<div class="ws-payload">' + escapeHtml(payload) + '</div>' +
        '</div>';
      }).join('');
  return '<div class="ws-console">' +
    '<div class="ws-summary ws-status-' + escapeAttr(status) + '">' +
      '<div class="ws-summary-main">' +
        '<span class="ws-status-dot"></span>' +
        '<span class="method-badge method-WS">WS</span>' +
        '<span class="ws-status-label">' + escapeHtml(statusLabel) + '</span>' +
      '</div>' +
      '<div class="ws-summary-note">' + escapeHtml(tr('webview.websocketComposer')) + '</div>' +
      actionHtml +
    '</div>' +
    (tab.error && status === 'error' ? '<div class="error-msg">' + escapeHtml(tab.error) + '</div>' : '') +
    '<div class="ws-log">' + messagesHtml + '</div>' +
  '</div>';
}

function renderContent() {
  closeActiveFormatMenu();
  releaseSplitDrag();
  hideVariableAutocomplete();
  hideVariablePreviewPopover();
  if (!activeTabId || tabs.length === 0) {
    mainContent.innerHTML = renderEmptyState(
      tr('webview.empty.hero.title'),
      tr('webview.empty.hero.copy'),
      [
        { label: tr('webview.emptyActionNewRequest'), action: 'new-tab' },
        { label: tr('webview.emptyActionSample'), action: 'sample-request' },
        { label: tr('webview.emptyActionGuide'), action: 'open-guide' }
      ]
    );
    return;
  }
  
  var prevReqArea = mainContent.querySelector('.req-area');
  var savedHeight = prevReqArea && prevReqArea.dataset.manualHeight ? prevReqArea.style.height : null;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  syncRequestTypeFromUrl(tab);
  const isWs = isWebSocketTab(tab);

  const stage = getRequestStageInfo(tab);
  const activeRequestEditorTab = normalizeRequestEditorTab(tab.requestEditorTab);
  const requestEditorExpanded = tab.requestEditorExpanded !== false;
  const isParamsTab = activeRequestEditorTab === 'params';
  const isHeadersTab = activeRequestEditorTab === 'headers';
  const isBodyTab = activeRequestEditorTab === 'body';
  const isAuthTab = activeRequestEditorTab === 'auth';
  const isScriptsTab = activeRequestEditorTab === 'scripts';
  const isSettingsTab = activeRequestEditorTab === 'settings';
  const showParamsEditor = requestEditorExpanded && isParamsTab;
  const showHeadersEditor = requestEditorExpanded && isHeadersTab;
  const showBodyEditor = requestEditorExpanded && isBodyTab;
  const showAuthEditor = requestEditorExpanded && isAuthTab;
  const showScriptsEditor = requestEditorExpanded && isScriptsTab;
  const showSettingsEditor = requestEditorExpanded && isSettingsTab;
  const envLine = '<div class="js-status-strip-host">' + renderStatusStrip(tab) + '</div>';
  const requestInfoRowHtml = '';

  let resHtml = '';
  if (isWs) {
    resHtml = renderWebSocketResponse(tab);
  } else if (tab.loading) {
    resHtml = '<div class="res-empty-shell">' +
      '<div class="js-loading-summary" style="padding:6px"><span class="spinner"></span>' + escapeHtml(tr('webview.loading')) + '</div>' +
      '<div class="request-stage-hint" style="padding:0 6px 6px">' + escapeHtml(tr('webview.loading.hint')) + '</div>' +
      '<div class="skeleton-loader"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>' +
    '</div>';
  } else if (tab.error) {
    resHtml = '<div class="res-empty-shell">' + buildResponseTimingMetaHtml(tab) + '<div class="error-msg">' + escapeHtml(tab.error) + '</div></div>';
  } else if (tab.response) {
    const r = tab.response;
    const sc = Math.floor(r.status / 100);
    const ct = (r.headers?.['content-type'] || r.headers?.['Content-Type'] || '').toLowerCase();
    const isBinary = !!r.bodyBase64 && isBinaryContentType(ct);
    const displayBody = isBinary
      ? tr('webview.binaryResponse')
      : r.body;
    const lang = isBinary ? 'text' : detectLang(ct, displayBody);
    const searchState = getResponseSearchState(tab);
    const displayBodyText = isBinary
      ? displayBody
      : getDisplayResponseBody(tab, lang, displayBody);
    const rawBodyHtml = isBinary
      ? escapeHtml(displayBodyText)
      : (lang === 'xml' && !searchState.query
          ? renderXmlBodyWithPaths(displayBodyText)
          : renderResponseBody(displayBodyText, lang, searchState.query, searchState.index, searchState));
    
    const headerEntries = Object.entries(r.headers);
    const headerCount = headerEntries.length;
    let headersTableHtml = '<table class="res-header-table">' +
      '<thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.key')) + '</th><th>' + escapeHtml(tr('webview.value')) + '</th></tr></thead><tbody>';
    for (const [k,v] of headerEntries) {
      headersTableHtml += '<tr><td class="res-header-key">' + escapeHtml(k) + '</td>' +
        '<td class="res-header-value" title="' + escapeAttr(String(v)) + '">' + escapeHtml(String(v)) + '</td></tr>';
    }
    headersTableHtml += '</tbody></table>';

    
    
    
    let allCookieStrs = [];
    if (r.rawSetCookies && r.rawSetCookies.length > 0) {
      allCookieStrs = r.rawSetCookies;
    } else {
      const cookieHeader = headerEntries
        .filter(([k]) => k.toLowerCase() === 'set-cookie')
        .map(([,v]) => String(v))
        .join(', ');
      if (cookieHeader) {
        
        allCookieStrs = cookieHeader.split(/,\\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/);
      }
    }
    const cookieCount = allCookieStrs.length;
    let cookiesTableHtml = '';
    if (cookieCount > 0) {
      cookiesTableHtml = '<table class="res-header-table res-cookie-table">' +
        '<thead><tr><th>Name</th><th>Value</th><th>Domain</th><th>Path</th><th>Expires</th><th>HttpOnly</th><th>Secure</th></tr></thead><tbody>';
      for (const cs of allCookieStrs) {
        const parts = cs.split(';').map(function(s) { return s.trim(); });
        const nameVal = parts[0] || '';
        const eqIdx = nameVal.indexOf('=');
        const cName = eqIdx >= 0 ? nameVal.substring(0, eqIdx) : nameVal;
        const cValue = eqIdx >= 0 ? nameVal.substring(eqIdx + 1) : '';
        let domain = '', path = '', expires = '', httpOnly = false, secure = false;
        for (let i = 1; i < parts.length; i++) {
          const attr = parts[i];
          const attrLower = attr.toLowerCase();
          if (attrLower.startsWith('domain=')) domain = attr.substring(7);
          else if (attrLower.startsWith('path=')) path = attr.substring(5);
          else if (attrLower.startsWith('expires=')) expires = attr.substring(8);
          else if (attrLower.startsWith('max-age=')) { if (!expires) expires = 'max-age=' + attr.substring(8); }
          else if (attrLower === 'httponly') httpOnly = true;
          else if (attrLower === 'secure') secure = true;
        }
        cookiesTableHtml += '<tr>' +
          '<td class="res-header-key">' + escapeHtml(cName) + '</td>' +
          '<td class="res-header-value" title="' + escapeAttr(cValue) + '">' + escapeHtml(cValue) + '</td>' +
          '<td>' + escapeHtml(domain) + '</td>' +
          '<td>' + escapeHtml(path) + '</td>' +
          '<td>' + escapeHtml(expires) + '</td>' +
          '<td>' + (httpOnly ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
          '<td>' + (secure ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
        '</tr>';
      }
      cookiesTableHtml += '</tbody></table>';
    }
    const previewAvailable = lang === 'html' && hasHtmlPreview(tab);
    const activeResponseTab = tab.responseTab === 'resPreview' && !previewAvailable
      ? 'resBody'
      : tab.responseTab === 'resCookies' && cookieCount === 0
        ? 'resBody'
        : tab.responseTab || 'resBody';
    const showBody = activeResponseTab === 'resBody';
    const showCookies = activeResponseTab === 'resCookies';
    const showHeaders = activeResponseTab === 'resHeaders';
    const showTests = activeResponseTab === 'resTests';
    const showPreview = activeResponseTab === 'resPreview';
    const hasFormat = (lang === 'json' || lang === 'xml');
    const currentSnapshot = createResponseSnapshot(tab, tab.response, '');
    const currentSignature = currentSnapshot?.signature || '';
    const formatStyle = lang === 'xml'
      ? (tab.xmlFormatStyle || 'inline')
      : (tab.jsonFormatStyle || 'pretty');
    const formatIndent = tab.formatIndent || '2';
    const fmtMenuHtml = hasFormat
      ? '<div class="fmt-wrap">' +
          '<button class="tb-btn ripple-btn js-fmt-btn">' + escapeHtml(tr('webview.format')) + '</button>' +
          '<div class="fmt-menu js-fmt-menu">' +
            '<div class="fmt-menu-label">' + escapeHtml(tr('webview.style')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="pretty"><span class="check">' + (formatStyle === 'pretty' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.pretty')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="compact"><span class="check">' + (formatStyle === 'compact' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.compact')) + '</div>' +
            (lang === 'xml' ? '<div class="fmt-menu-item js-fmt-style" data-style="inline"><span class="check">' + (formatStyle === 'inline' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.inlineChildren')) + '</div>' : '') +
            '<div class="fmt-menu-sep"></div>' +
            '<div class="fmt-menu-label">' + escapeHtml(tr('webview.indent')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="2"><span class="check">' + (formatIndent === '2' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.twoSpaces')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="4"><span class="check">' + (formatIndent === '4' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.fourSpaces')) + '</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="tab"><span class="check">' + (formatIndent === 'tab' ? 'x' : ' ') + '</span>' + escapeHtml(tr('webview.tabIndent')) + '</div>' +
          '</div>' +
        '</div>'
      : '';
    const searchToolbarHtml = !isBinary
      ? '<div class="response-search-wrap js-response-search-wrap">' +
          '<input class="response-search-input js-response-search" type="text" value="' + escapeAttr(searchState.query) + '" placeholder="' + escapeAttr(tr('webview.searchPlaceholder')) + '" />' +
          '<button class="tb-btn js-response-search-case' + (searchState.caseSensitive ? ' active' : '') + '" type="button" title="' + escapeAttr(tr('webview.searchCaseSensitive')) + '">Aa</button>' +
          '<button class="tb-btn js-response-search-regex' + (searchState.regex ? ' active' : '') + '" type="button" title="' + escapeAttr(tr('webview.searchRegex')) + '">.*</button>' +
          '<span class="response-search-count js-response-search-count"></span>' +
          '<button class="tb-btn js-response-search-prev" type="button" title="' + escapeAttr(tr('webview.searchPrev')) + '">&#8593;</button>' +
          '<button class="tb-btn js-response-search-next" type="button" title="' + escapeAttr(tr('webview.searchNext')) + '">&#8595;</button>' +
          '<button class="tb-btn js-response-search-clear" type="button" title="' + escapeAttr(tr('webview.searchClear')) + '">&times;</button>' +
        '</div>'
      : '';
    const pathHintHtml = lang === 'json'
      ? '<span class="response-path-hint">' + escapeHtml(tr('webview.jsonPathHint')) + '</span>'
      : (lang === 'xml' && !searchState.query
        ? '<span class="response-path-hint">' + escapeHtml(tr('webview.xpathHint')) + '</span>'
        : '');
    const toolbarHtml = !isBinary
      ? '<div class="res-body-toolbar js-res-body-toolbar' + (showBody ? '' : ' hidden') + '" data-lang="' + lang + '">' +
          (lang === 'json'
              ? '<div class="toggle-group">' +
                  '<button class="toggle-btn active" data-mode="tree">' + escapeHtml(tr('webview.tree')) + '</button>' +
                  '<button class="toggle-btn" data-mode="raw">' + escapeHtml(tr('webview.raw')) + '</button>' +
                '</div>' +
              '<button class="tb-btn js-expand-all" title="' + escapeAttr(tr('webview.expand')) + '">' + escapeHtml(tr('webview.expand')) + '</button>' +
              '<button class="tb-btn js-collapse-all" title="' + escapeAttr(tr('webview.collapse')) + '">' + escapeHtml(tr('webview.collapse')) + '</button>'
            : '') +
          fmtMenuHtml +
          pathHintHtml +
          searchToolbarHtml +
        '</div>'
      : '';
    
    const resolvedUrlDisplay = tab.resolvedUrl
      ? '<div class="resolved-url js-resolved-url" title="' + escapeAttr(tr('webview.clickToCopy') + ': ' + tab.resolvedUrl) + '">' + escapeHtml(tab.resolvedUrl) + '</div>'
      : '';
    const responseToneClass = 'response-tone-' + sc + 'xx';
    const compareCueText = buildCompareContextCueText();
    const compareQuietHtml = compareCueText
      ? '<span class="compare-active-indicator js-compare-chip-row">' + escapeHtml(compareCueText) + '</span>'
      : '<span class="js-compare-chip-row visually-hidden">' + buildCompareChipMarkup(currentSignature) + '</span>';
    const pinCountSuffix = pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '';
    const compareReady = pinnedResponses.length >= 2;
    const compareTitle = compareReady
      ? tr('webview.comparePinned') + ' ' + compareModeShort(compareSettings.mode) + pinCountSuffix
      : tr('webview.compareNeedsPin');
    const responseFormatValue = (lang === 'text' ? 'TEXT' : lang.toUpperCase());
    const statusText = r.statusText ? ' ' + r.statusText : '';
    const sepHtml = '<span class="stat-sep">\u00B7</span>';
    const durationMs = getResponseDurationMs(tab, r.time);
    const durationText = formatDurationMs(durationMs) || (String(r.time) + ' ms');
    const durationTitle = durationMs === null ? durationText : String(durationMs) + ' ms';
    const responseTimingMetaHtml = buildResponseTimingMetaHtml(tab);
    const responseStatsHtml =
      '<div class="response-stat-inline" title="' + escapeAttr(String(r.status) + statusText + ' - ' + durationTitle + ' - ' + formatSize(r.size) + ' - ' + responseFormatValue) + '">' +
        '<span class="stat-status status-' + sc + 'xx" data-testid="response-status">' + escapeHtml(String(r.status) + statusText) + '</span>' +
        sepHtml +
        '<span class="stat-time" title="' + escapeAttr(durationTitle) + '">' + escapeHtml(durationText) + '</span>' +
        sepHtml +
        '<span class="stat-size">' + escapeHtml(formatSize(r.size)) + '</span>' +
        sepHtml +
        '<span class="stat-format">' + escapeHtml(responseFormatValue) + '</span>' +
      '</div>';
    const testResults = tab.scriptResults?.tests || [];
    const failedTests = testResults.filter(function(test) { return !test.passed; });
    const passedCount = testResults.length - failedTests.length;
    const logCount = (tab.scriptResults?.logs || []).length;
    const firstFailedTest = failedTests[0] || null;
    const testsSummaryHtml = testResults.length > 0
      ? '<div class="test-summary">' +
          '<span class="test-badge pass">' + escapeHtml(tfCount('webview.testSummaryPass', passedCount)) + '</span>' +
          '<span class="test-badge fail">' + escapeHtml(tfCount('webview.testSummaryFail', failedTests.length)) + '</span>' +
          '<span class="test-badge log">' + escapeHtml(tfCount('webview.testSummaryLogs', logCount)) + '</span>' +
        '</div>'
      : '';
    const testsAlertHtml = testResults.length === 0
      ? ''
      : (failedTests.length === 0
        ? '<div class="test-alert pass"><div class="test-alert-title">' + escapeHtml(tr('webview.testSummaryAllPassed')) + '</div></div>'
        : '<div class="test-alert fail">' +
            '<div class="test-alert-title">' + escapeHtml(tr('webview.testSummaryFirstFailure')) + '</div>' +
            '<div>' + escapeHtml(firstFailedTest?.name || '') + (firstFailedTest?.error ? ' - ' + escapeHtml(firstFailedTest.error) : '') + '</div>' +
          '</div>');
    resHtml =
      '<div class="res-response-shell">' +
      '<div class="res-sticky-shell">' +
      '<div class="response-summary">' +
      '<div class="response-summary-card ' + responseToneClass + '">' +
        responseStatsHtml +
        '<div class="response-action-cluster">' +
          compareQuietHtml +
          '<button class="pin-response-btn js-pin-response" data-testid="response-pin" type="button" title="' + escapeAttr(tr('webview.pinResponse') + pinCountSuffix) + '" aria-label="' + escapeAttr(tr('webview.pin') + pinCountSuffix) + '">' + pinSvg + '<span class="action-label">' + escapeHtml(tr('webview.pin') + pinCountSuffix) + '</span></button>' +
          '<button class="compare-btn js-compare-responses' + (compareReady ? ' ready' : '') + '" data-testid="response-compare" type="button" title="' + escapeAttr(compareTitle) + '" aria-label="' + escapeAttr(tr('webview.compare')) + '"' + (compareReady ? '' : ' disabled') + '>' + diffSvg + '<span class="action-label">' + escapeHtml(tr('webview.compare')) + '</span></button>' +
          '<div class="actions-more-wrap">' +
            '<button class="res-action-btn js-actions-more-btn" data-testid="response-overflow" type="button" title="' + escapeAttr(tr('webview.more') || 'More') + '" aria-label="' + escapeAttr(tr('webview.more') || 'More') + '" aria-haspopup="menu" aria-expanded="false" aria-controls="responseActionsMoreMenu"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg></button>' +
            '<div class="actions-more-menu js-actions-more-menu" id="responseActionsMoreMenu" role="menu">' +
              '<button class="res-action-btn js-copy-response" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyResponse')) + '"><span class="action-label">' + escapeHtml(tr('webview.copy')) + '</span></button>' +
              ((tab.resolvedUrl || tab.url) ? '<button class="res-action-btn js-copy-response-url" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyUrl')) + '"><span class="action-label">' + escapeHtml(tr('webview.copyUrl')) + '</span></button>' : '') +
              '<button class="res-action-btn js-save-response" type="button" role="menuitem" title="' + escapeAttr(tr('webview.saveResponse')) + '"><span class="action-label">' + escapeHtml(tr('webview.save')) + '</span></button>' +
              '<button class="res-action-btn js-copy-response-status" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyStatus')) + '"><span class="action-label">' + escapeHtml(tr('webview.copyStatus')) + '</span></button>' +
              '<button class="res-action-btn js-copy-response-headers" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyHeadersRaw')) + '"><span class="action-label">' + escapeHtml(tr('webview.copyHeadersRaw')) + '</span></button>' +
              ((lang === 'html' && (tab.resolvedUrl || tab.url))
                ? '<button class="res-action-btn js-open-response-url" type="button" role="menuitem" title="' + escapeAttr(tr('webview.openUrl')) + '"><span class="action-label">' + escapeHtml(tr('webview.openUrl')) + '</span></button>'
                : '') +
              '<button class="res-action-btn js-compare-last" type="button" role="menuitem" title="' + escapeAttr(tr('webview.compareLast')) + '"' + (!lastResponse ? ' disabled' : '') + '><span class="action-label">' + escapeHtml(tr('webview.last')) + '</span></button>' +
              '<button class="res-action-btn js-compare-settings" type="button" role="menuitem" title="' + escapeAttr(tr('webview.comparisonSettings')) + '"><span class="action-label">' + escapeHtml(tr('webview.mode')) + ': ' + escapeHtml(compareModeShort(compareSettings.mode)) + '</span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="response-context-row">' +
        resolvedUrlDisplay +
      '</div>' +
      responseTimingMetaHtml +
      '</div>' +
      '<div class="tabs js-res-tabs">' +
        '<div class="tab' + (showBody ? ' active' : '') + '" data-tab="resBody">' + escapeHtml(tr('webview.body')) + '</div>' +
        (cookieCount > 0 ? '<div class="tab' + (showCookies ? ' active' : '') + '" data-tab="resCookies">' + escapeHtml(tr('webview.cookies')) + ' <span class="tab-count">' + cookieCount + '</span></div>' : '<div class="tab' + (showCookies ? ' active' : '') + '" data-tab="resCookies">' + escapeHtml(tr('webview.cookies')) + '</div>') +
        '<div class="tab' + (showHeaders ? ' active' : '') + '" data-tab="resHeaders">' + escapeHtml(tr('webview.headers')) + ' <span class="tab-count">' + headerCount + '</span></div>' +
        ((tab.scriptResults?.tests?.length || 0) > 0 ? '<div class="tab' + (showTests ? ' active' : '') + '" data-tab="resTests">' + escapeHtml(tr('webview.tests')) + ' <span class="tab-count">' + tab.scriptResults.tests.length + '</span></div>' : '<div class="tab' + (showTests ? ' active' : '') + '" data-tab="resTests">' + escapeHtml(tr('webview.tests')) + '</div>') +
        (previewAvailable ? '<div class="tab' + (showPreview ? ' active' : '') + '" data-tab="resPreview">' + escapeHtml(tr('webview.preview')) + '</div>' : '') +
      '</div>' +
      toolbarHtml +
      '</div>' +
      (lang === 'json' ? '<div class="json-tree js-res-tree js-res-body' + (showBody ? '' : ' hidden') + '" data-testid="response-body-tree"></div>' : '') +
      '<div class="json-body js-res-raw js-res-body' + ((lang === 'json' || !showBody) ? ' hidden' : '') + '" data-testid="response-body">' + rawBodyHtml + '</div>' +
      '<div class="res-headers-panel' + (showHeaders ? '' : ' hidden') + ' js-res-headers">' +
        (tab.resolvedHeaders && tab.resolvedHeaders.length
          ? '<div class="resolved-headers-section"><div class="resolved-headers-title">' + escapeHtml(tr('webview.requestHeadersResolved')) + '</div>' +
            '<table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.key')) + '</th><th>' + escapeHtml(tr('webview.value')) + '</th></tr></thead><tbody>' +
            tab.resolvedHeaders.map(function(h) {
              return '<tr><td class="res-header-key">' + escapeHtml(h.key) + '</td><td class="res-header-value" title="' + escapeAttr(h.value) + '">' + escapeHtml(h.value) + '</td></tr>';
            }).join('') +
            '</tbody></table></div><div class="resolved-headers-title" style="margin-top:8px">' + escapeHtml(tr('webview.responseHeaders')) + '</div>'
          : '') +
        headersTableHtml +
      '</div>' +
      '<div class="res-cookies-panel' + (showCookies ? '' : ' hidden') + ' js-res-cookies">' +
        (cookieCount > 0 ? cookiesTableHtml : renderInlineEmptyState(tr('webview.inline.response.noCookies.kicker'), tr('webview.inline.response.noCookies.title'), tr('webview.inline.response.noCookies.copy'))) +
      '</div>' +
      '<div class="res-headers-panel' + (showTests ? '' : ' hidden') + ' js-res-tests">' +
        (testResults.length > 0
          ? testsSummaryHtml +
            testsAlertHtml +
            '<table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.test')) + '</th><th>' + escapeHtml(tr('webview.result')) + '</th></tr></thead><tbody>' +
            testResults.map(function(test) {
              var status = test.passed ? tr('webview.testResult.pass') : tr('webview.testResult.fail');
              var detail = test.passed ? tr('webview.testResult.passed') : (test.error || tr('webview.testResult.failed'));
              return '<tr class="' + (test.passed ? 'test-row-pass' : 'test-row-fail') + '"><td class="res-header-key">' + escapeHtml(test.name) + '</td><td class="res-header-value" title="' + escapeAttr(detail) + '">' + escapeHtml(status + ' - ' + detail) + '</td></tr>';
            }).join('') +
            '</tbody></table>' +
            ((tab.scriptResults.logs || []).length > 0
              ? '<div class="resolved-headers-title" style="margin-top:4px">' + escapeHtml(tr('webview.scriptLogs')) + '</div><table class="res-header-table"><thead><tr><th class="res-header-key-col">' + escapeHtml(tr('webview.level')) + '</th><th>' + escapeHtml(tr('webview.message')) + '</th></tr></thead><tbody>' +
                tab.scriptResults.logs.map(function(log) {
                  return '<tr><td class="res-header-key">' + escapeHtml(log.level.toUpperCase()) + '</td><td class="res-header-value" title="' + escapeAttr(log.message) + '">' + escapeHtml(log.message) + '</td></tr>';
                }).join('') +
                '</tbody></table>'
              : '')
          : renderInlineEmptyState(tr('webview.inline.tests.none.kicker'), tr('webview.inline.tests.none.title'), tr('webview.inline.tests.none.copy'))) +
      '</div>' +
      (previewAvailable ? '<div class="res-preview' + (showPreview ? '' : ' hidden') + ' js-res-preview"></div>' : '') +
      '</div>';
  } else {
    resHtml = '<div class="res-empty-shell">' + buildResponseTimingMetaHtml(tab) + (tab.url
      ? renderEmptyState(
          tr('webview.empty.response.title'),
          tr('webview.empty.response.copy'),
          [
            { label: tr('webview.emptyActionFocusUrl'), action: 'focus-url' },
            { label: tr('webview.emptyActionGuide'), action: 'open-guide' }
          ]
        )
      : renderEmptyState(
          tr('webview.empty.request.title'),
          tr('webview.empty.request.copy'),
          [
            { label: tr('webview.emptyActionSample'), action: 'sample-request' },
            { label: tr('webview.openEnvironmentPicker'), action: 'switch-environment' },
            { label: tr('webview.emptyActionGuide'), action: 'open-guide' }
          ]
        )) + '</div>';
  }

  mainContent.innerHTML = envLine +
    '<div class="url-bar">' +
      '<div class="url-primary-group">' +
          '<select class="js-method" data-testid="request-method">' +
          ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m =>
            '<option' + (m === tab.method ? ' selected' : '') + '>' + m + '</option>'
          ).join('') +
        '</select>' +
        '<div class="url-input-wrap">' +
          '<input class="js-url" data-testid="request-url" type="text" placeholder="' + escapeAttr(tr('webview.urlPlaceholder')) + '" spellcheck="false" value="' + escapeAttr(tab.url) + '"/>' +
          '<div class="var-overlay js-var-overlay hidden"></div>' +
        '</div>' +
      '</div>' +
      '<div class="url-hero-actions">' + renderPrimaryActionButton(tab) + '</div>' +
      '<div class="url-overflow-wrap actions-more-wrap">' +
        '<button class="res-action-btn js-request-more-btn" type="button" title="' + escapeAttr(tr('webview.more') || 'More') + '" aria-label="' + escapeAttr(tr('webview.more') || 'More') + '" aria-haspopup="menu" aria-expanded="false" aria-controls="requestActionsMoreMenu"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/></svg></button>' +
        '<div class="actions-more-menu js-request-more-menu" id="requestActionsMoreMenu" role="menu">' +
          '<button class="res-action-btn js-save" type="button" role="menuitem" title="' + escapeAttr(tr('webview.save')) + '"><span class="action-label">' + escapeHtml(tr('webview.save')) + '</span></button>' +
          (tab.requestId ? '<button class="res-action-btn js-save-as" type="button" role="menuitem" title="' + escapeAttr(tr('webview.saveAs')) + '"><span class="action-label">' + escapeHtml(tr('webview.saveAs')) + '</span></button>' : '') +
          '<button class="res-action-btn js-copy-curl" type="button" role="menuitem" title="' + escapeAttr(tr('webview.copyAsCurl')) + '"><span class="action-label">cURL</span></button>' +
          '<button class="res-action-btn js-generate-code" type="button" role="menuitem" title="' + escapeAttr(tr('webview.generateCode')) + '"><span class="action-label">' + escapeHtml(tr('webview.code')) + '</span></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    requestInfoRowHtml +
    '<div class="split">' +
      '<div class="req-area">' +
        '<div class="tabs js-req-tabs" role="tablist">' +
          '<div class="tab' + (isParamsTab ? ' active' : '') + (isParamsTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="params" role="tab" tabindex="0" aria-selected="' + (isParamsTab ? 'true' : 'false') + '" aria-expanded="' + (showParamsEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.params')) + '</div>' +
          '<div class="tab' + (isHeadersTab ? ' active' : '') + (isHeadersTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="headers" role="tab" tabindex="0" aria-selected="' + (isHeadersTab ? 'true' : 'false') + '" aria-expanded="' + (showHeadersEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.headers')) + '</div>' +
          '<div class="tab' + (isBodyTab ? ' active' : '') + (isBodyTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="body" role="tab" tabindex="0" aria-selected="' + (isBodyTab ? 'true' : 'false') + '" aria-expanded="' + (showBodyEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.body')) + '</div>' +
          '<div class="tab' + (isAuthTab ? ' active' : '') + (isAuthTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="auth" role="tab" tabindex="0" aria-selected="' + (isAuthTab ? 'true' : 'false') + '" aria-expanded="' + (showAuthEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.auth')) + '</div>' +
          '<div class="tab' + (isScriptsTab ? ' active' : '') + (isScriptsTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="scripts" role="tab" tabindex="0" aria-selected="' + (isScriptsTab ? 'true' : 'false') + '" aria-expanded="' + (showScriptsEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.scripts')) + '</div>' +
          '<div class="tab' + (isSettingsTab ? ' active' : '') + (isSettingsTab && !requestEditorExpanded ? ' collapsed' : '') + '" data-tab="settings" role="tab" tabindex="0" aria-selected="' + (isSettingsTab ? 'true' : 'false') + '" aria-expanded="' + (showSettingsEditor ? 'true' : 'false') + '">' + escapeHtml(tr('webview.settings')) + '</div>' +
        '</div>' +
        '<div class="js-params-panel request-editor-panel kv-section' + (showParamsEditor ? '' : ' hidden') + '">' +
          '<div class="js-param-rows" data-testid="request-params">' + kvRowsHtml(tab.params) + '</div>' +
          '<div class="kv-actions">' +
            '<button class="add-btn js-add-param">' + escapeHtml(tr('webview.addParam')) + '</button>' +
            '<button class="ghost-btn ripple-btn js-open-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.bulkPaste')) + '</button>' +
          '</div>' +
          '<div class="bulk-editor hidden js-bulk-editor" data-target="params">' +
            '<div class="bulk-editor-label">' + escapeHtml(tr('webview.bulkPasteParams')) + '</div>' +
            '<textarea class="bulk-editor-input js-bulk-editor-input" spellcheck="false" placeholder="' + escapeAttr(tr('webview.bulkPasteParamsPlaceholder')) + '"></textarea>' +
            '<div class="bulk-editor-actions">' +
              '<button class="ghost-btn ripple-btn js-apply-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.apply')) + '</button>' +
              '<button class="ghost-btn ripple-btn js-cancel-bulk-editor" type="button" data-target="params">' + escapeHtml(tr('webview.cancel')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-headers-panel request-editor-panel kv-section' + (showHeadersEditor ? '' : ' hidden') + '">' +
          '<div class="js-default-headers-banner-wrap">' + renderDefaultHeadersBanner(tab) + '</div>' +
          '<div class="js-header-rows" data-testid="request-headers">' + kvRowsHtml(tab.headers) + '</div>' +
          '<div class="kv-actions">' +
            '<button class="add-btn js-add-header">' + escapeHtml(tr('webview.addHeader')) + '</button>' +
            '<button class="ghost-btn ripple-btn js-open-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.bulkPaste')) + '</button>' +
          '</div>' +
          '<div class="bulk-editor hidden js-bulk-editor" data-target="headers">' +
            '<div class="bulk-editor-label">' + escapeHtml(tr('webview.bulkPasteHeaders')) + '</div>' +
            '<textarea class="bulk-editor-input js-bulk-editor-input" spellcheck="false" placeholder="' + escapeAttr(tr('webview.bulkPasteHeadersPlaceholder')) + '"></textarea>' +
            '<div class="bulk-editor-actions">' +
              '<button class="ghost-btn ripple-btn js-apply-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.apply')) + '</button>' +
              '<button class="ghost-btn ripple-btn js-cancel-bulk-editor" type="button" data-target="headers">' + escapeHtml(tr('webview.cancel')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-body-panel request-editor-panel body-section' + (showBodyEditor ? '' : ' hidden') + '">' +
          '<select class="js-body-type body-type-select" data-testid="body-type">' +
            ['none','json','xml','form','formdata','binary','raw'].map(function(t) {
              var label = bodyTypeLabel(t);
              return '<option value="' + t + '"' + (t === tab.bodyType ? ' selected' : '') + '>' + label + '</option>';
            }).join('') +
          '</select>' +
          '<div class="body-editor js-body-editor' + (shouldEnableBodySyntaxHighlight(tab.bodyType, isWs) ? ' is-syntax-highlight' : '') + '"' + (!isWs && (tab.bodyType === 'none' || tab.bodyType === 'formdata' || tab.bodyType === 'binary') ? ' style="display:none"' : '') + '>' +
            '<pre class="body-highlight js-body-highlight" aria-hidden="true"><code class="hljs js-body-highlight-code"></code></pre>' +
            '<textarea class="js-body" data-testid="request-body-editor" spellcheck="false" placeholder="' + escapeAttr(isWs ? tr('webview.websocketMessagePlaceholder') : tr('webview.bodyPlaceholder')) + '">' + escapeHtml(tab.body) + '</textarea>' +
          '</div>' +
          '<div class="js-formdata-panel' + (tab.bodyType === 'formdata' ? '' : ' hidden') + '">' +
            '<div class="formdata-summary js-formdata-summary">' + renderFormDataSummary(tab.formData || []) + '</div>' +
            '<div class="js-formdata-rows">' + formDataRowsHtml(tab.formData || []) + '</div>' +
            '<button class="add-btn js-add-formdata-text">' + escapeHtml(tr('webview.addField')) + '</button>' +
            '<button class="add-btn js-add-formdata-file">' + escapeHtml(tr('webview.addFile')) + '</button>' +
          '</div>' +
          '<div class="js-binary-panel' + (tab.bodyType === 'binary' ? '' : ' hidden') + '">' +
            '<div class="kv-row" style="margin-top:4px">' +
              '<input class="js-binary-path" type="text" placeholder="' + escapeAttr(tr('webview.filePath')) + '" value="' + escapeAttr(tab.binaryFilePath || '') + '"/>' +
              '<button class="btn btn-s js-browse-binary" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-auth-panel request-editor-panel auth-section' + (showAuthEditor ? '' : ' hidden') + '">' +
          authHtml(tab.auth) +
        '</div>' +
        '<div class="js-scripts-panel request-editor-panel body-section' + (showScriptsEditor ? '' : ' hidden') + '">' +
          renderScriptHelpers(tab) +
          '<div class="script-editor-grid">' +
            '<div class="script-card">' +
              '<div class="script-card-label">' + escapeHtml(tr('webview.preRequestScript')) + '</div>' +
              '<div class="script-card-note">' + escapeHtml(tr('webview.preRequestNote')) + '</div>' +
              '<div class="script-card-actions">' +
                '<button class="ghost-btn ripple-btn js-insert-script-template" type="button" data-target="preRequest" data-template="preRequestEnv">' + escapeHtml(tr('webview.scriptHelpInsertPreRequest')) + '</button>' +
              '</div>' +
              '<textarea class="js-script-prerequest" placeholder="' + escapeAttr(tr('webview.preRequestPlaceholder')) + '">' + escapeHtml(tab.scripts?.preRequest || '') + '</textarea>' +
            '</div>' +
            '<div class="script-card">' +
              '<div class="script-card-label">' + escapeHtml(tr('webview.testScript')) + '</div>' +
              '<div class="script-card-note">' + escapeHtml(tr('webview.testNote')) + '</div>' +
              '<div class="script-card-actions">' +
                '<button class="ghost-btn ripple-btn js-insert-script-template" type="button" data-target="test" data-template="testCaptureValue">' + escapeHtml(tr('webview.scriptHelpInsertCapture')) + '</button>' +
                '<button class="ghost-btn ripple-btn js-insert-script-template" type="button" data-target="test" data-template="testStatusCheck">' + escapeHtml(tr('webview.scriptHelpInsertStatus')) + '</button>' +
              '</div>' +
              '<textarea class="js-script-test" placeholder="' + escapeAttr(tr('webview.testPlaceholder')) + '">' + escapeHtml(tab.scripts?.test || '') + '</textarea>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-settings-panel request-editor-panel settings-section' + (showSettingsEditor ? '' : ' hidden') + '">' +
          '<div class="settings-grid">' +
            '<div class="settings-card">' +
              '<div class="settings-group">' +
                '<div class="settings-group-title">' + escapeHtml(tr('webview.transport')) + '</div>' +
                '<div class="settings-group-note">' + escapeHtml(tr('webview.transportNote')) + '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.timeout')) + '</label>' +
                  '<input class="js-timeout settings-input" type="number" min="0" placeholder="0" title="' + escapeAttr(tr('webview.unlimited')) + '" value="' + (tab.timeout || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.unlimited')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.maxSize')) + '</label>' +
                  '<input class="js-max-response-size settings-input" type="number" min="0" placeholder="' + DEFAULT_MAX_RESPONSE_SIZE_KB + '" title="' + escapeAttr(tr('webview.maxSizeDefault')) + '" value="' + (tab.maxResponseSizeKb || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.maxSizeDefault')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.retryCount')) + '</label>' +
                  '<input class="js-retry-count settings-input" type="number" min="0" placeholder="0" value="' + (tab.retryCount || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.off')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.retryDelay')) + '</label>' +
                  '<input class="js-retry-delay settings-input" type="number" min="0" placeholder="0" value="' + (tab.retryDelayMs || '') + '"/>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.retryDelayUnit')) + '</span></div>' +
                '</div>' +
                '<div class="settings-row' + (tab.tlsValidation === 'insecure' ? ' risk-warning' : '') + '">' +
                  '<label class="settings-label">' + escapeHtml(tr('webview.tls')) + '</label>' +
                  '<select class="js-tls-validation settings-input settings-select">' +
                    '<option value="default"' + (tab.tlsValidation !== 'strict' && tab.tlsValidation !== 'insecure' ? ' selected' : '') + '>' + escapeHtml(tr('webview.default')) + '</option>' +
                    '<option value="strict"' + (tab.tlsValidation === 'strict' ? ' selected' : '') + '>' + escapeHtml(tr('webview.strict')) + '</option>' +
                    '<option value="insecure"' + (tab.tlsValidation === 'insecure' ? ' selected' : '') + '>' + escapeHtml(tr('webview.insecure')) + '</option>' +
                  '</select>' +
                  '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.perRequestOverride')) + '</span></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="settings-card">' +
              '<div class="settings-group">' +
                '<div class="settings-group-title">' + escapeHtml(tr('webview.behavior')) + '</div>' +
                '<div class="settings-group-note">' + escapeHtml(tr('webview.behaviorNote')) + '</div>' +
                '<div class="settings-toggle-grid">' +
                  '<label class="settings-toggle"><input class="js-follow-redirects" type="checkbox"' + (tab.followRedirects ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.followRedirects')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.followRedirects.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.stopAfterHeaders ? ' risk-muted' : '') + '"><input class="js-stop-after-headers" type="checkbox"' + (tab.stopAfterHeaders ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.stopAfterHeaders')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.stopAfterHeaders.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.saveToHistory === false ? ' risk-muted' : '' ) + '"><input class="js-save-history" type="checkbox"' + (tab.saveToHistory !== false ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.saveToHistory')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.saveToHistory.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.skipDefaultHeaders ? ' risk-warning' : '' ) + '"><input class="js-skip-default-headers" type="checkbox"' + (tab.skipDefaultHeaders ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.skipDefaultHeaders')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.skipDefaultHeaders.note')) + '</span></span></label>' +
                  '<label class="settings-toggle' + (tab.disableScripts ? ' risk-warning' : '' ) + '"><input class="js-disable-scripts" type="checkbox"' + (tab.disableScripts ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.disableScripts')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.disableScripts.note')) + '</span></span></label>' +
                '</div>' +
              '</div>' +
            '</div>' +
            (isWs ?
              '<div class="settings-card">' +
                '<div class="settings-group">' +
                  '<div class="settings-group-title">' + escapeHtml(tr('webview.websocket')) + '</div>' +
                  '<div class="settings-group-note">' + escapeHtml(tr('webview.webSocketKeepAlive.note')) + '</div>' +
                  '<div class="settings-toggle-grid">' +
                    '<label class="settings-toggle"><input class="js-ws-keepalive-enabled" type="checkbox"' + (tab.webSocketKeepAliveEnabled ? ' checked' : '') + '/><span>' + escapeHtml(tr('webview.webSocketKeepAlive')) + '<span class="settings-inline-note">' + escapeHtml(tr('webview.webSocketKeepAlive.note')) + '</span></span></label>' +
                  '</div>' +
                  '<div class="settings-row">' +
                    '<label class="settings-label">' + escapeHtml(tr('webview.webSocketKeepAliveInterval')) + '</label>' +
                    '<input class="js-ws-keepalive-interval settings-input" type="number" min="' + MIN_WS_KEEPALIVE_INTERVAL_SECONDS + '" max="' + MAX_WS_KEEPALIVE_INTERVAL_SECONDS + '" placeholder="' + escapeAttr(String(DEFAULT_WS_KEEPALIVE_INTERVAL_SECONDS)) + '" value="' + escapeAttr(String(normalizeWebSocketKeepAliveInterval(tab.webSocketKeepAliveIntervalSeconds))) + '"/>' +
                    '<div class="settings-field-meta"><span class="settings-hint">' + escapeHtml(tr('webview.webSocketKeepAliveIntervalUnit')) + '</span></div>' +
                  '</div>' +
                  '<div class="settings-row">' +
                    '<label class="settings-label">' + escapeHtml(tr('webview.webSocketKeepAliveMessage')) + '</label>' +
                    '<input class="js-ws-keepalive-message settings-input settings-text-input" type="text" placeholder="' + escapeAttr(DEFAULT_WS_KEEPALIVE_MESSAGE) + '" value="' + escapeAttr(normalizeWebSocketKeepAliveMessage(tab.webSocketKeepAliveMessage)) + '"/>' +
                  '</div>' +
                '</div>' +
              '</div>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="divider"><div class="divider-grip"><span></span><span></span><span></span></div></div>' +
      '<div class="bullet-progress js-bullet-progress' + (tab.loading || (isWs && tab.websocketStatus === 'connecting') ? ' active' : '') + '"><div class="bullet-glow"></div></div>' +
      '<div class="res-area' + (tab.response && tab.slideIn ? ' slide-in' : '') + '">' + resHtml + '</div>' +
    '</div>';

  
  bindContentEvents();

  var previewFrame = mainContent.querySelector('.js-res-preview');
  if (previewFrame) {
    syncPreviewFrame(previewFrame, tab);
  }

  
  if (savedHeight && !isRequestEditorCollapsed(tab)) {
    var newReqArea = mainContent.querySelector('.req-area');
    if (newReqArea) {
      applyManualRequestAreaHeight(
        newReqArea,
        mainContent.querySelector('.split'),
        mainContent.querySelector('.divider'),
        mainContent.querySelector('.bullet-progress'),
        savedHeight,
        tab,
        false
      );
    }
  } else {
    var adaptiveReqArea = mainContent.querySelector('.req-area');
    if (adaptiveReqArea) {
      applyAdaptiveRequestAreaHeight(
        adaptiveReqArea,
        mainContent.querySelector('.split'),
        mainContent.querySelector('.divider'),
        mainContent.querySelector('.bullet-progress'),
        tab
      );
    }
  }
}

function bindContentDelegatedEventsOnce() {
  if (contentDelegatedEventsBound) return;
  contentDelegatedEventsBound = true;

  mainContent.addEventListener('keydown', function(e) {
    handleVariableAutocompleteKeydown(e);
  }, true);
  mainContent.addEventListener('focusin', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    syncVariableAutocomplete(e.target);
  });
  mainContent.addEventListener('focusout', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    setTimeout(function() {
      if (isVariableAutocompleteField(document.activeElement)) {
        syncVariableAutocomplete(document.activeElement);
        return;
      }
      hideVariableAutocomplete();
    }, 0);
  });
  mainContent.addEventListener('click', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    syncVariableAutocomplete(e.target);
  });
  mainContent.addEventListener('input', function(e) {
    if (!isVariableAutocompleteField(e.target)) return;
    syncVariablePreviewHints(mainContent);
    syncVariableAutocomplete(e.target);
  });
  mainContent.addEventListener('click', function(e) {
    if (!e.target.closest('.js-open-default-headers')) return;
    vscode.postMessage({ type: 'openDefaultHeaders' });
  });
  mainContent.addEventListener('click', function(e) {
    var stripToggle = e.target.closest('.js-status-strip-toggle');
    if (stripToggle) {
      setStatusStripExpanded(!isStatusStripExpanded());
      return;
    }
    var dhToggle = e.target.closest('.js-default-headers-toggle');
    if (dhToggle) {
      var banner = dhToggle.closest('.default-headers-banner');
      var expand = banner?.querySelector('.js-default-headers-expand');
      if (!banner || !expand) return;
      var dhOpen = banner.dataset.expanded !== '1';
      banner.dataset.expanded = dhOpen ? '1' : '0';
      expand.classList.toggle('hidden', !dhOpen);
      dhToggle.setAttribute('aria-expanded', dhOpen ? 'true' : 'false');
      return;
    }
    var actionEl = e.target.closest('.request-status-chip.clickable, .preflight-pill.clickable, .js-preflight-action, .request-change-chip.clickable, .status-strip-seg.clickable, .status-strip-link');
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    var meta = actionEl.dataset.meta;
    if (action === 'open-default-headers') {
      vscode.postMessage({ type: 'openDefaultHeaders' });
      return;
    }
    if (action === 'switch-environment') {
      vscode.postMessage({ type: 'switchEnvironment' });
      return;
    }
    if (action === 'edit-environment') {
      toggleEnvironmentEditor();
      return;
    }
    if (action === 'reveal-variable-usage') {
      // Used N / unresolved Vars: toggle disclosure with the 1.0.9 variable-usage list
      if (isStatusStripExpanded()) {
        setStatusStripExpanded(false);
      } else {
        revealVariableUsageDisclosure();
      }
      return;
    }
    if (action === 'change-workspace-profile') {
      vscode.postMessage({ type: 'changeWorkspaceProfile' });
      return;
    }
    if (action === 'switch-tab' && meta) {
      switchRequestEditorTabAndRevealInContent(mainContent, meta);
    }
  });
  mainContent.addEventListener('click', function(e) {
    var actionEl = e.target.closest('.js-empty-action');
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    if (action === 'new-tab') {
      createTab();
      return;
    }
    if (action === 'sample-request') {
      loadSampleRequestIntoActiveTab();
      return;
    }
    if (action === 'focus-url') {
      var urlInput = mainContent.querySelector('.js-url');
      urlInput?.focus();
      urlInput?.select?.();
      return;
    }
    if (action === 'switch-environment') {
      vscode.postMessage({ type: 'switchEnvironment' });
      return;
    }
    if (action === 'open-guide') {
      vscode.postMessage({ type: 'openGuide' });
    }
  });
}

function bindContentEvents() {
  const mc = mainContent;
  bindContentDelegatedEventsOnce();

  
  mc.querySelector('.js-method')?.addEventListener('change', (e) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.method = e.target.value; markDirty(); renderTabBar(); refreshRequestPreflight(mc); }
  });

  
  var urlInputEl = mc.querySelector('.js-url');
  if (urlInputEl) {
    urlInputEl.addEventListener('input', function(e) {
      var activeTab = tabs.find(t => t.id === activeTabId);
      var wasWs = isWebSocketTab(activeTab);
      if (activeTab) {
        activeTab.url = e.target.value;
        syncRequestTypeFromUrl(activeTab);
      }
      syncParamsFromUrlInput(mc);
      checkUnresolvedVars();
      markDirty();
      activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        activeTab.url = e.target.value;
        syncRequestTypeFromUrl(activeTab);
      }
      if (wasWs !== isWebSocketTab(activeTab)) {
        renderTabBar();
        renderContent();
        return;
      }
      refreshRequestPreflight(mc);
      debouncePersist();
    });
    urlInputEl.addEventListener('keydown', function(e) {
      if (e.defaultPrevented) return;
      if (e.key !== 'Enter') return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      handlePrimaryAction();
    });
    urlInputEl.addEventListener('scroll', function() {
      var ov = mc.querySelector('.js-var-overlay');
      if (ov) ov.scrollLeft = urlInputEl.scrollLeft;
    });
    
    setTimeout(checkUnresolvedVars, 50);
  }

  
  const sendBtn = mc.querySelector('.js-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (sendBtn.classList.contains('btn-send')) {
        triggerSendSlam(sendBtn);
      } else if (sendBtn.classList.contains('btn-stop')) {
        triggerStopSlam(sendBtn);
      }
      handlePrimaryAction();
    });
  }

  mc.querySelector('.js-ws-disconnect')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    websocketDisconnect(tab);
  });

  mc.querySelector('.js-open-default-headers-top')?.addEventListener('click', function() {
    vscode.postMessage({ type: 'openDefaultHeaders' });
  });

  bindActionsMoreMenu(mc.querySelector('.js-request-more-btn'), mc.querySelector('.js-request-more-menu'));

  mc.querySelector('.js-save')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage(buildSaveRequestMessage(tab, tab.requestId || undefined));
  });

  
  mc.querySelector('.js-save-as')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage(buildSaveRequestMessage(tab));
  });

  
  mc.querySelector('.js-copy-curl')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'copyAsCurl', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, skipDefaultHeaders: !!tab.skipDefaultHeaders });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });

  mc.querySelector('.js-generate-code')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'generateCode', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, skipDefaultHeaders: !!tab.skipDefaultHeaders });
    showBtnFeedback(this, tr('webview.opened'), 1000);
  });

  
  mc.querySelector('.js-copy-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    var opts = getFormatOptions(mc);
    var body = tab.response.body;
    if (opts) {
      if (opts.lang === 'json') body = formatJson(body, opts.style, opts.indent);
      else if (opts.lang === 'xml') body = formatXml(body, opts.style, opts.indent);
    }
    vscode.postMessage({ type: 'copyResponseBody', body: body });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });
  mc.querySelector('.js-res-raw')?.addEventListener('click', function(event) {
    var target = event.target.closest('.js-copy-xml-path') || event.target.closest('.xml-path-line[data-copy-path]');
    if (!target || !target.dataset.copyPath) return;
    event.preventDefault();
    vscode.postMessage({ type: 'copyToClipboard', text: target.dataset.copyPath });
    if (target.classList.contains('js-copy-xml-path')) {
      showBtnFeedback(target, tr('webview.copied'), 1000);
    }
  });
  mc.querySelector('.js-copy-response-url')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    const url = tab?.resolvedUrl || tab?.url || '';
    if (!url) return;
    vscode.postMessage({ type: 'copyToClipboard', text: url });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });
  mc.querySelector('.js-copy-response-status')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    vscode.postMessage({ type: 'copyToClipboard', text: buildResponseStatusLine(tab.response) });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });
  mc.querySelector('.js-copy-response-headers')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    vscode.postMessage({ type: 'copyToClipboard', text: buildRawResponseHeaders(tab.response) });
    showBtnFeedback(this, tr('webview.copied'), 1200);
  });

  // Response overflow: Mode / copy / save utilities. Pin/Compare stay on the primary toolbar.
  bindActionsMoreMenu(mc.querySelector('.js-actions-more-btn'), mc.querySelector('.js-actions-more-menu'));

  
  mc.querySelector('.js-resolved-url')?.addEventListener('click', (e) => {
    const el = e.currentTarget;
    const url = el.textContent;
    vscode.postMessage({ type: 'copyToClipboard', text: url });
    el.classList.add('copied');
    const orig = el.textContent;
    el.textContent = tr('webview.copied');
    setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1200);
  });

  
  mc.querySelector('.js-save-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const ct = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '';
    pendingSaveResponseBtn = this;
    vscode.postMessage({ type: 'saveResponseBody', body: tab.response.body, bodyBase64: tab.response.bodyBase64 || '', contentType: ct });
  });

  mc.querySelector('.js-open-response-url')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    const url = tab?.resolvedUrl || tab?.url || '';
    if (!url) return;
    vscode.postMessage({ type: 'openResponseUrl', url: url });
    showBtnFeedback(this, tr('webview.opened'), 1000);
  });

  mc.querySelector('.js-pin-response')?.addEventListener('click', function() {
    var snapshot = getActiveResponseSnapshot();
    if (!snapshot) return;
    var existIdx = pinnedResponses.findIndex(function(p) { return p.signature === snapshot.signature; });
    if (existIdx !== -1) {
      pinnedResponses.splice(existIdx, 1);
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    } else {
      if (pinnedResponses.length >= 2) {
        pinnedResponses.shift();
      }
      pinnedResponses.push(snapshot);
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    }
    updatePinCompareButtons(mc);
  });

  mc.querySelector('.js-compare-responses')?.addEventListener('click', function() {
    if (pinnedResponses.length < 2) return;
    requestCompare(pinnedResponses[0], pinnedResponses[1]);
  });

  mc.querySelector('.js-compare-last')?.addEventListener('click', function() {
    compareCurrentWithLast();
  });

  mc.querySelector('.js-compare-settings')?.addEventListener('click', function() {
    showCompareSettings();
  });

  mc.querySelector('.res-area')?.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    document.querySelectorAll('.res-ctx-menu').forEach(m => m.remove());
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const activeSnapshot = getActiveResponseSnapshot();
    const pinnedOne = pinnedResponses[0] || null;
    const pinnedTwo = pinnedResponses[1] || null;

    const menu = document.createElement('div');
    menu.className = 'res-ctx-menu';
    menu.innerHTML =
      '<div class="ctx-item js-ctx-compare-last' + (!lastResponse ? ' disabled' : '') + '">' + escapeHtml(tr('webview.compareLast')) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pin1' + (!pinnedOne ? ' disabled' : '') + '">' + escapeHtml(pinnedOne ? tf('webview.compareWith', { label: truncate(pinnedOne.label, 32) }) : tf('webview.compareWith', { label: tf('webview.pinNumber', { count: 1 }) })) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pin2' + (!pinnedTwo ? ' disabled' : '') + '">' + escapeHtml(pinnedTwo ? tf('webview.compareWith', { label: truncate(pinnedTwo.label, 32) }) : tf('webview.compareWith', { label: tf('webview.pinNumber', { count: 2 }) })) + '</div>' +
      '<div class="ctx-item js-ctx-compare-pins' + (pinnedResponses.length < 2 ? ' disabled' : '') + '">' + escapeHtml(tr('webview.comparePinned')) + '</div>' +
      '<div class="ctx-item js-ctx-settings">' + escapeHtml(tr('webview.comparisonSettings')) + '</div>' +
      '<div class="ctx-sep"></div>' +
      '<div class="ctx-item js-ctx-pin-current">' + pinSvg + ' ' + escapeHtml(tr('webview.pinCurrentResponse')) + '</div>' +
      '<div class="ctx-item js-ctx-clear-pins' + (pinnedResponses.length === 0 ? ' disabled' : '') + '">' + escapeHtml(tr('webview.clearAllPins')) + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + ')' : '') + '</div>';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    document.body.appendChild(menu);

    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

    menu.querySelector('.js-ctx-compare-last')?.addEventListener('click', function() {
      if (!activeSnapshot || !lastResponse) return;
      requestCompare(lastResponse, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pin1')?.addEventListener('click', function() {
      if (!activeSnapshot || !pinnedOne) return;
      requestCompare(pinnedOne, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pin2')?.addEventListener('click', function() {
      if (!activeSnapshot || !pinnedTwo) return;
      requestCompare(pinnedTwo, activeSnapshot);
      menu.remove();
    });

    menu.querySelector('.js-ctx-compare-pins')?.addEventListener('click', function() {
      if (pinnedResponses.length < 2) return;
      requestCompare(pinnedResponses[0], pinnedResponses[1]);
      menu.remove();
    });

    menu.querySelector('.js-ctx-settings')?.addEventListener('click', function() {
      showCompareSettings();
      menu.remove();
    });

    menu.querySelector('.js-ctx-pin-current')?.addEventListener('click', function() {
      var pinBtn = mc.querySelector('.js-pin-response');
      if (pinBtn) pinBtn.click();
      menu.remove();
    });

    menu.querySelector('.js-ctx-clear-pins')?.addEventListener('click', function() {
      if (pinnedResponses.length === 0) return;
      pinnedResponses.length = 0;
      updatePinCompareButtons(mc);
      menu.remove();
    });

    setTimeout(function() {
      document.addEventListener('click', function closeCtx() {
        menu.remove();
        document.removeEventListener('click', closeCtx);
      }, { once: true });
    }, 0);
  });

  updatePinCompareButtons(mc);

  
  mc.querySelector('.js-req-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    switchRequestEditorTabInContent(mc, t.dataset.tab);
  });
  mc.querySelector('.js-req-tabs')?.addEventListener('keydown', (e) => {
    const t = e.target.closest('.tab');
    if (!t || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    switchRequestEditorTabInContent(mc, t.dataset.tab);
  });

  
  mc.querySelector('.js-res-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    switchResponseTabInContent(mc, t.dataset.tab);
  });

  
  mc.querySelector('.js-res-body-toolbar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (btn) {
      mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) tree.classList.toggle('hidden', btn.dataset.mode !== 'tree');
      if (raw) raw.classList.toggle('hidden', btn.dataset.mode !== 'raw');
      
      mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(b => b.style.display = btn.dataset.mode === 'tree' ? '' : 'none');
      syncResponseSearch(mc);
    }
  });

  mc.querySelector('.js-response-search')?.addEventListener('input', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchQuery = this.value || '';
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });
  mc.querySelector('.js-response-search')?.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    stepResponseSearch(mc, e.shiftKey ? -1 : 1);
  });
  mc.querySelector('.js-response-search-prev')?.addEventListener('click', function() {
    stepResponseSearch(mc, -1);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-next')?.addEventListener('click', function() {
    stepResponseSearch(mc, 1);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-clear')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchQuery = '';
    tab.responseSearchIndex = 0;
    var input = mc.querySelector('.js-response-search');
    if (input) input.value = '';
    syncResponseSearch(mc);
    input?.focus();
    debouncePersist();
  });
  mc.querySelector('.js-response-search-case')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchCaseSensitive = tab.responseSearchCaseSensitive !== true;
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });
  mc.querySelector('.js-response-search-regex')?.addEventListener('click', function() {
    var tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.responseSearchRegex = tab.responseSearchRegex !== true;
    tab.responseSearchIndex = 0;
    syncResponseSearch(mc);
    debouncePersist();
  });

  // Expand All
  mc.querySelector('.js-expand-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.remove('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '-'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.add('hidden'));
  });

  // Collapse All
  mc.querySelector('.js-collapse-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.add('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '+'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.remove('hidden'));
  });

  
  const fmtBtn = mc.querySelector('.js-fmt-btn');
  const fmtMenu = mc.querySelector('.js-fmt-menu');
  if (fmtBtn && fmtMenu) {
    fmtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeFormatMenuState && activeFormatMenuState.menu === fmtMenu) {
        closeActiveFormatMenu();
        return;
      }
      closeActiveFormatMenu();
      fmtMenu.classList.add('open');
      activeFormatMenuState = { button: fmtBtn, menu: fmtMenu };
    });
    fmtMenu.addEventListener('click', (e) => { e.stopPropagation(); });

    
    fmtMenu.querySelectorAll('.js-fmt-style').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-style .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
    
    fmtMenu.querySelectorAll('.js-fmt-indent').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-indent .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
  }

  
  if (mc.querySelector('.js-res-body-toolbar')) {
    applyFormat(mc);
  }

  
  const treeContainer = mc.querySelector('.js-res-tree');
  if (treeContainer && !treeContainer.hasChildNodes()) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.response?.body) {
      try {
        const parsed = JSON.parse(tab.response.body);
        treeContainer.innerHTML = buildJsonTree(parsed, '', true, '$');
        treeContainer._jsonData = parsed;
        bindTreeToggles(treeContainer);
      } catch {}
    }
  }

  
  bindKvRow(mc.querySelector('.js-param-rows'), {
    onChange: function() {
      syncUrlFromParamsEditor(mc);
      markDirty();
      refreshDraftInsights(mc);
    }
  });
  bindKvRow(mc.querySelector('.js-header-rows'));
  healParamsMirrorFromUrl(mc);

  mc.querySelector('.js-add-param')?.addEventListener('click', () => {
    var container = mc.querySelector('.js-param-rows');
    addKvRow(container);
    container?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    syncUrlFromParamsEditor(mc);
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-add-header')?.addEventListener('click', () => {
    var container = mc.querySelector('.js-header-rows');
    addKvRow(container);
    container?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    markDirty();
    refreshDraftInsights(mc);
  });

  mc.querySelectorAll('.js-open-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      toggleBulkEditor(mc, button.dataset.target, true);
    });
  });
  mc.querySelectorAll('.js-apply-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      applyBulkEditor(mc, button.dataset.target);
    });
  });
  mc.querySelectorAll('.js-cancel-bulk-editor').forEach(function(button) {
    button.addEventListener('click', function() {
      toggleBulkEditor(mc, button.dataset.target, false);
    });
  });

  
  mc.querySelector('.js-auth-type')?.addEventListener('change', (e) => {
    const fields = mc.querySelector('.js-auth-fields');
    if (fields) fields.innerHTML = authFieldsHtml(e.target.value);
    markDirty();
    refreshDraftInsights(mc);
  });
  
  mc.querySelector('.js-auth-fields')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-auth-fields')?.addEventListener('click', function(e) {
    if (!e.target.classList.contains('js-auth-reveal')) return;
    var wrap = e.target.closest('.auth-inline-control');
    var input = wrap?.querySelector('input');
    if (!input) return;
    var revealing = input.type === 'password';
    input.type = revealing ? 'text' : 'password';
    e.target.textContent = revealing ? tr('webview.hideShort') : tr('webview.revealShort');
  });

  
  mc.querySelector('.js-body-type')?.addEventListener('change', (e) => {
    handleBodyTypeSelectChange(mc, e.target);
  });
  
  var initBodyType = mc.querySelector('.js-body-type')?.value || 'none';
  if (initBodyType !== 'none' && !isWebSocketTab(tabs.find(t => t.id === activeTabId))) syncAutoContentType(mc, initBodyType);

  
  var settingsPanel = mc.querySelector('.js-settings-panel');
  if (settingsPanel) {
    var refreshSettingsDraftUi = function() {
      syncSettingsToggleStates(mc);
      markDirty();
      refreshDraftInsights(mc);
    };
    settingsPanel.addEventListener('input', function(e) {
      if (e.target?.matches?.('input[type="checkbox"]')) return;
      refreshSettingsDraftUi();
    });
    settingsPanel.addEventListener('change', function(e) {
      if (!e.target?.matches?.('input[type="checkbox"], select')) return;
      refreshSettingsDraftUi();
    });
  }

  // === textarea auto grow + JSON body highlight mirror ===
  var bodyTa = mc.querySelector('.js-body');
  var bodyEditorEl = mc.querySelector('.js-body-editor');
  var bodyHighlightEl = mc.querySelector('.js-body-highlight');
  var bodyHighlightCodeEl = mc.querySelector('.js-body-highlight-code');
  var bodyHighlightTimer = null;
  var bodyHighlightLastSource = null;
  if (bodyTa) {
    var bodyTab = tabs.find(t => t.id === activeTabId);
    ensureBodyUndoState(bodyTab, bodyTa);
    function refreshBodyJsonHighlight(immediate) {
      if (!bodyEditorEl || !bodyHighlightCodeEl) return;
      var activeBodyTab = tabs.find(t => t.id === activeTabId);
      var bodyType = mc.querySelector('.js-body-type')?.value || activeBodyTab?.bodyType || 'none';
      var language = bodyHighlightLanguage(bodyType);
      var enabled = shouldEnableBodySyntaxHighlight(bodyType, isWebSocketTab(activeBodyTab));
      bodyEditorEl.classList.toggle('is-syntax-highlight', enabled);
      bodyEditorEl.classList.remove('is-json-highlight');
      if (!enabled) {
        if (bodyHighlightTimer) {
          clearTimeout(bodyHighlightTimer);
          bodyHighlightTimer = null;
        }
        if (bodyHighlightLastSource !== null) {
          bodyHighlightCodeEl.textContent = '';
          bodyHighlightLastSource = null;
        }
        bodyEditorEl.removeAttribute('data-highlight-lang');
        return;
      }
      bodyEditorEl.setAttribute('data-highlight-lang', language);
      var run = function() {
        bodyHighlightTimer = null;
        var value = bodyTa.value;
        var stamp = language + '\\0' + value;
        if (bodyHighlightLastSource === stamp) {
          syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
          return;
        }
        bodyHighlightLastSource = stamp;
        bodyHighlightCodeEl.innerHTML = highlightBodySource(value, language);
        syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
      };
      if (immediate) {
        if (bodyHighlightTimer) {
          clearTimeout(bodyHighlightTimer);
          bodyHighlightTimer = null;
        }
        run();
        return;
      }
      if (bodyHighlightTimer) clearTimeout(bodyHighlightTimer);
      bodyHighlightTimer = setTimeout(run, BODY_JSON_HIGHLIGHT_DEBOUNCE_MS);
    }
    function autoGrow() {
      bodyTa.style.height = 'auto';
      var h = Math.max(100, Math.min(400, bodyTa.scrollHeight));
      bodyTa.style.height = h + 'px';
      if (bodyEditorEl) bodyEditorEl.style.height = h + 'px';
      syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
    }
    bodyTa._tessraAutoGrow = autoGrow;
    bodyTa._tessraRefreshBodyHighlight = refreshBodyJsonHighlight;
    bodyTa.addEventListener('input', function(event) {
      recordBodyEditorInput(bodyTab, bodyTa, event);
      autoGrow();
      refreshBodyJsonHighlight(false);
      markDirty();
      refreshDraftInsights(mc);
    });
    bodyTa.addEventListener('scroll', function() {
      syncBodyHighlightScroll(bodyTa, bodyHighlightEl);
    });
    bodyTa.addEventListener('keydown', function(e) {
      if (handleBodyEditorUndoRedoShortcut(bodyTab, bodyTa, e)) return;
      if (e.key === 'Enter') { setTimeout(autoGrow, 0); }
    });
    bodyTa.addEventListener('keyup', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    bodyTa.addEventListener('mouseup', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    bodyTa.addEventListener('select', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    bodyTa.addEventListener('focus', function() { rememberBodyEditorSelection(bodyTab, bodyTa); });
    autoGrow();
    refreshBodyJsonHighlight(true);
  }

  mc.querySelector('.js-add-formdata-text')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'text');
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-add-formdata-file')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'file');
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('rm')) {
      e.target.closest('.formdata-row')?.remove();
      markDirty();
      refreshDraftInsights(mc);
      return;
    }
    if (e.target.classList.contains('js-formdata-browse')) {
      const row = e.target.closest('.formdata-row');
      vscode.postMessage({ type: 'pickFile', target: 'formdata', rowId: row?.dataset.rowId });
    }
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('js-formdata-type')) {
      syncFormDataRow(e.target.closest('.formdata-row'));
    }
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('input', function(e) {
    syncFormDataRow(e.target.closest('.formdata-row'));
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelectorAll('.formdata-row').forEach(syncFormDataRow);

  mc.querySelector('.js-browse-binary')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'pickFile', target: 'binary' });
  });
  mc.querySelector('.js-binary-path')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-script-prerequest')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-script-test')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelectorAll('.js-insert-script-template').forEach(function(button) {
    button.addEventListener('click', function() {
      insertScriptTemplate(mc, button.dataset.target, button.dataset.template);
      showBtnFeedback(button, tr('webview.inserted'), 1000);
    });
  });
  mc.querySelector('.js-open-script-guide')?.addEventListener('click', function() {
    vscode.postMessage({ type: 'openGuide' });
  });

  
  var divider = mc.querySelector('.divider');
  var splitEl = mc.querySelector('.split');
  var reqArea = mc.querySelector('.req-area');
  var resArea = mc.querySelector('.res-area');
  if (divider && splitEl && reqArea && resArea) {
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      splitDragState = {
        divider: divider,
        splitEl: splitEl,
        reqArea: reqArea,
        progressEl: mc.querySelector('.bullet-progress'),
        startY: e.clientY,
        startH: reqArea.offsetHeight
      };
      divider.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
  }

  refreshDraftInsights(mc);
  syncResponseSearch(mc);
}

var BODY_TYPE_CT = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  formdata: 'multipart/form-data',
  binary: 'application/octet-stream',
  raw: 'text/plain',
};

function syncAutoContentType(mc, bodyType) {
  var headerRows = mc.querySelector('.js-header-rows');
  if (!headerRows) return;

  
  headerRows.querySelectorAll('.kv-row[data-auto="content-type"]').forEach(function(r) { r.remove(); });

  var ct = BODY_TYPE_CT[bodyType];
  if (!ct) return;

  
  var hasManual = false;
  headerRows.querySelectorAll('.kv-row:not([data-auto])').forEach(function(row) {
    var keyInput = row.querySelectorAll('input[type="text"]')[0];
    if (keyInput && keyInput.value.toLowerCase() === 'content-type') hasManual = true;
  });
  if (hasManual) return;

  
  var row = document.createElement('div');
  row.className = 'kv-row';
  row.dataset.auto = 'content-type';
  row.innerHTML =
    '<input type="checkbox" checked disabled/>' +
    '<input type="text" value="Content-Type" readonly style="opacity:.6"/>' +
    '<input type="text" value="' + ct + '" readonly style="opacity:.6"/>' +
    '<span class="auto-badge">(auto)</span>';
  headerRows.insertBefore(row, headerRows.firstChild);
}

function collectAllKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function hasExecutableScripts(scripts) {
  return !!(scripts && ((scripts.preRequest || '').trim() || (scripts.test || '').trim()));
}

function ensureTrustedScriptsBeforeSend(tab) {
  if (!tab || tab.disableScripts || tab.scriptsTrusted !== false || !hasExecutableScripts(tab.scripts)) {
    return true;
  }
  if (!window.confirm(tr('webview.importedScriptsTrustPrompt'))) {
    return false;
  }
  tab.scriptsTrusted = true;
  debouncePersist();
  return true;
}

function sendActiveTab() {
  saveActiveTabState();
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url) return;
  if (tab.loading) return;
  if (!ensureTrustedScriptsBeforeSend(tab)) return;
  const mc = mainContent;

  

  
  var urlWrap = mc.querySelector('.url-input-wrap');
  if (urlWrap) {
    urlWrap.classList.remove('sweep');
    void urlWrap.offsetWidth;
    urlWrap.classList.add('sweep');
    setTimeout(function() { urlWrap.classList.remove('sweep'); }, 350);
  }

  
  const allHeaders = collectAllKv(mc.querySelector('.js-header-rows'));
  tab.loading = true;
  tab.lastEvent = 'sending';
  tab.error = null;
  tab.progressVisible = false;
  tab.slideIn = false;
  const requestStartedAt = Date.now();
  tab.sendTime = requestStartedAt;
  tab.requestStartedAt = requestStartedAt;
  tab.requestEndedAt = null;
  tab.durationMs = null;
  renderContent();

  
  var urlInput = mc.querySelector('.js-url');
  if (urlInput) {
    urlInput.classList.add('neon-active');
  }

  
  var elapsedTimer = null;
  var progressTimer = setTimeout(function() {
    if (!tab.loading) return;
    tab.progressVisible = true;
    
      var timerEl = mc.querySelector('.js-elapsed-timer');
      if (!timerEl) {
        var loadingDiv = mc.querySelector('.js-loading-summary') || mc.querySelector('.res-area > div');
        if (loadingDiv) {
          var sp = document.createElement('span');
          sp.className = 'elapsed-timer js-elapsed-timer';
        loadingDiv.appendChild(sp);
      }
      timerEl = mc.querySelector('.js-elapsed-timer');
    }
    if (timerEl) {
      elapsedTimer = setInterval(function() {
        if (!tab.loading) { clearInterval(elapsedTimer); return; }
        var elapsed = ((Date.now() - tab.sendTime) / 1000).toFixed(1);
        timerEl.textContent = elapsed + 's';
      }, 100);
    }
  }, 3000);
  tab._progressTimer = progressTimer;
  tab._elapsedTimer = elapsedTimer;

  vscode.postMessage({
    type: 'sendRequest', tabId: tab.id,
    requestStartedAt: requestStartedAt,
    method: tab.method, url: tab.url, headers: allHeaders, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout, followRedirects: !!tab.followRedirects, saveToHistory: tab.saveToHistory !== false, tlsValidation: normalizeTlsValidation(tab.tlsValidation), maxResponseSizeKb: normalizeMaxResponseSizeSetting(tab.maxResponseSizeKb), retryCount: normalizeNumberSetting(tab.retryCount), retryDelayMs: normalizeNumberSetting(tab.retryDelayMs), stopAfterHeaders: !!tab.stopAfterHeaders, skipDefaultHeaders: !!tab.skipDefaultHeaders, disableScripts: !!tab.disableScripts, scriptsTrusted: tab.scriptsTrusted !== false,
  });
}

// === KV ??===
function kvValueControlHtml(key, value) {
  var sensitive = isSensitiveKeyName(key);
  return '<input type="' + (sensitive ? 'password' : 'text') + '" class="js-kv-value" placeholder="' + escapeAttr(tr('webview.value')) + '" value="' + escapeAttr(value) + '"/>' +
    '<button class="kv-reveal' + (sensitive ? '' : ' hidden') + '" type="button" title="' + escapeAttr(tr('webview.revealValue')) + '">' + escapeHtml(tr('webview.revealShort')) + '</button>';
}

function kvRowsHtml(items) {
  return (items || []).map(kv =>
    '<div class="kv-row">' +
      '<input type="checkbox"' + (kv.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(kv.key) + '"/>' +
      kvValueControlHtml(kv.key, kv.value) +
      '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>' +
    '</div>'
  ).join('');
}

function addKvRow(container, key, value) {
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(key || '') + '"/>' +
    kvValueControlHtml(key || '', value || '') +
    '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>';
  row.querySelector('.rm').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    if (row.dataset.auto) return;
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function syncKvRowSensitivity(row) {
  if (!row) return;
  var keyInput = row.querySelector('input[type="text"]');
  var valueInput = row.querySelector('.js-kv-value');
  var revealBtn = row.querySelector('.kv-reveal');
  if (!keyInput || !valueInput || !revealBtn) return;
  var sensitive = isSensitiveKeyName(keyInput.value);
  valueInput.type = sensitive ? 'password' : 'text';
  revealBtn.classList.toggle('hidden', !sensitive);
  revealBtn.textContent = tr('webview.revealShort');
  revealBtn.title = tr('webview.revealValue');
}

function bindKvRow(container, options) {
  if (!container) return;
  if (container.dataset.kvBound === 'true') return;
  container.dataset.kvBound = 'true';
  var opts = options || {};
  var handleChange = function() {
    if (typeof opts.onChange === 'function') {
      opts.onChange();
      return;
    }
    markDirty();
    refreshDraftInsights(mainContent);
  };
  container.addEventListener('click', function(e) {
    if (e.target.classList.contains('rm')) {
      e.target.closest('.kv-row')?.remove();
      handleChange();
      return;
    }
    if (e.target.classList.contains('kv-reveal')) {
      var row = e.target.closest('.kv-row');
      var valueInput = row?.querySelector('.js-kv-value');
      if (!valueInput) return;
      var revealing = valueInput.type === 'password';
      valueInput.type = revealing ? 'text' : 'password';
      e.target.textContent = revealing ? tr('webview.hideShort') : tr('webview.revealShort');
      e.target.title = revealing ? tr('webview.hideValue') : tr('webview.revealValue');
    }
  });
  container.addEventListener('input', function(e) {
    var row = e.target.closest('.kv-row');
    if (!row) return;
    syncKvRowSensitivity(row);
    handleChange();
  });
  container.addEventListener('change', function(e) {
    if (!e.target || !e.target.matches || !e.target.matches('input[type="checkbox"]')) return;
    handleChange();
  });
  container.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
}

var syncingUrlParams = false;

function decodeQueryComponentJs(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\\+/g, ' '));
  } catch (err) {
    return String(value || '').replace(/\\+/g, ' ');
  }
}

function encodeQueryComponentPreservingTemplates(value) {
  return String(value || '').replace(/\\{\\{[^{}]+\\}\\}|[^{}]+/g, function(part) {
    if (part.charAt(0) === '{') return part;
    return encodeURIComponent(part);
  });
}

function splitUrlPartsJs(rawUrl) {
  var raw = String(rawUrl || '');
  var working = raw;
  var fragment = '';
  var hashIndex = working.indexOf('#');
  if (hashIndex >= 0) {
    fragment = working.substring(hashIndex);
    working = working.substring(0, hashIndex);
  }
  var base = working;
  var query = '';
  var questionIndex = working.indexOf('?');
  if (questionIndex >= 0) {
    base = working.substring(0, questionIndex);
    query = working.substring(questionIndex + 1);
  }
  var pairs = query.split('&').filter(function(part) { return part.length > 0; }).map(function(part) {
    var eqIndex = part.indexOf('=');
    if (eqIndex < 0) {
      return { key: decodeQueryComponentJs(part), value: '' };
    }
    return {
      key: decodeQueryComponentJs(part.substring(0, eqIndex)),
      value: decodeQueryComponentJs(part.substring(eqIndex + 1))
    };
  }).filter(function(pair) { return !!pair.key; });
  return { base: base, query: query, fragment: fragment, pairs: pairs };
}

function composeUrlWithParamsJs(rawUrl, params) {
  var parts = splitUrlPartsJs(rawUrl);
  var active = (params || []).filter(function(item) { return item && item.enabled !== false && item.key; });
  var next = parts.base;
  if (active.length > 0) {
    next += '?' + active.map(function(item) {
      return encodeQueryComponentPreservingTemplates(item.key) + '=' + encodeQueryComponentPreservingTemplates(item.value || '');
    }).join('&');
  }
  return next + parts.fragment;
}

function syncParamsFromUrlInput(mc) {
  if (syncingUrlParams || !mc) return;
  var urlEl = mc.querySelector('.js-url');
  var rows = mc.querySelector('.js-param-rows');
  if (!urlEl || !rows) return;
  var pairs = splitUrlPartsJs(urlEl.value).pairs;
  syncingUrlParams = true;
  try {
    rows.innerHTML = kvRowsHtml(pairs.map(function(pair) {
      return { key: pair.key, value: pair.value, enabled: true };
    }));
    rows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (tab) {
      tab.params = collectKv(rows);
      tab.url = urlEl.value;
    }
  } finally {
    syncingUrlParams = false;
  }
}

function syncUrlFromParamsEditor(mc) {
  if (syncingUrlParams || !mc) return;
  var urlEl = mc.querySelector('.js-url');
  var rows = mc.querySelector('.js-param-rows');
  if (!urlEl || !rows) return;
  var params = collectKv(rows);
  var nextUrl = composeUrlWithParamsJs(urlEl.value, params);
  if (nextUrl === urlEl.value) {
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (tab) tab.params = params;
    return;
  }
  syncingUrlParams = true;
  try {
    urlEl.value = nextUrl;
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (tab) {
      tab.url = nextUrl;
      tab.params = params;
      syncRequestTypeFromUrl(tab);
    }
    checkUnresolvedVars();
  } finally {
    syncingUrlParams = false;
  }
}

function healParamsMirrorFromUrl(mc) {
  if (!mc) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  var rows = mc.querySelector('.js-param-rows');
  var urlEl = mc.querySelector('.js-url');
  if (!tab || !rows || !urlEl) return;
  var hasParams = (tab.params || []).some(function(item) { return item && item.key; });
  var urlPairs = splitUrlPartsJs(urlEl.value || tab.url || '').pairs;
  if (!hasParams && urlPairs.length > 0) {
    syncParamsFromUrlInput(mc);
  }
}

function parseBulkKeyValueText(text, target) {
  var source = String(text || '').trim();
  if (!source) return [];
  if (target === 'params') {
    var query = source;
    var question = query.indexOf('?');
    if (question >= 0) query = query.substring(question + 1);
    if (query.indexOf('&') >= 0 && query.indexOf('\\n') < 0) {
      return query.split('&').filter(Boolean).map(function(part) {
        var eqIndex = part.indexOf('=');
        if (eqIndex < 0) {
          return { key: decodeURIComponent(part), value: '', enabled: true };
        }
        return {
          key: decodeURIComponent(part.substring(0, eqIndex).replace(/\\+/g, ' ')),
          value: decodeURIComponent(part.substring(eqIndex + 1).replace(/\\+/g, ' ')),
          enabled: true
        };
      }).filter(function(item) { return item.key; });
    }
  }

  return source
    .split(/\\r?\\n/)
    .map(function(line) { return line.trim(); })
    .filter(Boolean)
    .map(function(line) {
      if (target === 'headers' && /^-H\s+/i.test(line)) {
        line = line.replace(/^-H\s+/i, '').replace(/^['"]|['"]$/g, '');
      }
      var sepIndex = line.indexOf(':');
      if (target === 'params' && (sepIndex < 0 || line.indexOf('=') >= 0 && line.indexOf('=') < sepIndex)) {
        sepIndex = line.indexOf('=');
      }
      if (sepIndex < 0 && /\\t/.test(line)) {
        var parts = line.split(/\\t+/);
        return { key: parts.shift() || '', value: parts.join('\t'), enabled: true };
      }
      if (sepIndex < 0) {
        return { key: line, value: '', enabled: true };
      }
      return {
        key: line.substring(0, sepIndex).trim(),
        value: line.substring(sepIndex + 1).trim(),
        enabled: true
      };
    })
    .filter(function(item) { return item.key; });
}

function formDataRowsHtml(items) {
  return (items || []).map(function(field) {
    var isFile = field.type === 'file';
    var value = field.value || '';
    var fileName = isFile ? getFileName(value) : '';
    return '<div class="kv-row formdata-row' + (isFile ? ' is-file' : '') + '" data-row-id="' + escapeAttr(field.id || ('fd_' + Math.random().toString(36).slice(2, 8))) + '">' +
      '<input type="checkbox"' + (field.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" class="js-formdata-key" placeholder="' + escapeAttr(tr('webview.key')) + '" value="' + escapeAttr(field.key || '') + '"/>' +
      '<select class="js-formdata-type body-type-select formdata-kind" style="width:84px;margin-bottom:0">' +
        '<option value="text"' + (isFile ? '' : ' selected') + '>' + escapeHtml(tr('webview.text')) + '</option>' +
        '<option value="file"' + (isFile ? ' selected' : '') + '>' + escapeHtml(tr('webview.file')) + '</option>' +
      '</select>' +
      '<div class="formdata-meta">' +
        '<input type="text" class="js-formdata-value" placeholder="' + escapeAttr(isFile ? tr('webview.filePath') : tr('webview.value')) + '" value="' + escapeAttr(value) + '"/>' +
        '<span class="formdata-file-chip js-formdata-file-chip' + (isFile && fileName ? '' : ' hidden') + '">' + escapeHtml(fileName || tf('webview.fileSelected', { name: '' })) + '</span>' +
      '</div>' +
      '<button class="btn btn-s js-formdata-browse' + (isFile ? '' : ' hidden') + '" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
      '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>' +
    '</div>';
  }).join('');
}

function getFileName(filePath) {
  var normalized = String(filePath || '').replace(/\\\\/g, '/');
  var parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

function addFormDataRow(container, type) {
  if (!container) return;
  var row = document.createElement('div');
  row.className = 'kv-row formdata-row' + (type === 'file' ? ' is-file' : '');
  row.dataset.rowId = 'fd_' + Math.random().toString(36).slice(2, 10);
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" class="js-formdata-key" placeholder="' + escapeAttr(tr('webview.key')) + '"/>' +
    '<select class="js-formdata-type body-type-select formdata-kind" style="width:84px;margin-bottom:0">' +
      '<option value="text"' + (type === 'file' ? '' : ' selected') + '>' + escapeHtml(tr('webview.text')) + '</option>' +
      '<option value="file"' + (type === 'file' ? ' selected' : '') + '>' + escapeHtml(tr('webview.file')) + '</option>' +
    '</select>' +
    '<div class="formdata-meta">' +
      '<input type="text" class="js-formdata-value" placeholder="' + escapeAttr(type === 'file' ? tr('webview.filePath') : tr('webview.value')) + '"/>' +
      '<span class="formdata-file-chip js-formdata-file-chip hidden"></span>' +
    '</div>' +
    '<button class="btn btn-s js-formdata-browse' + (type === 'file' ? '' : ' hidden') + '" type="button" style="padding:3px 8px">' + escapeHtml(tr('webview.browse')) + '</button>' +
    '<button class="rm" type="button" title="' + escapeAttr(tr('webview.remove')) + '" aria-label="' + escapeAttr(tr('webview.remove')) + '">&times;</button>';
  container.appendChild(row);
  syncFormDataRow(row);
}

function syncFormDataRow(row) {
  if (!row) return;
  var type = row.querySelector('.js-formdata-type')?.value || 'text';
  var valueInput = row.querySelector('.js-formdata-value');
  var browseBtn = row.querySelector('.js-formdata-browse');
  var fileChip = row.querySelector('.js-formdata-file-chip');
  var value = valueInput?.value || '';
  var fileName = type === 'file' ? getFileName(value) : '';
  if (valueInput) valueInput.placeholder = type === 'file' ? tr('webview.filePath') : tr('webview.value');
  if (browseBtn) browseBtn.classList.toggle('hidden', type !== 'file');
  row.classList.toggle('is-file', type === 'file');
  if (fileChip) {
    fileChip.classList.toggle('hidden', !(type === 'file' && fileName));
    fileChip.textContent = fileName ? tf('webview.fileSelected', { name: fileName }) : '';
  }
}

function renderFormDataSummary(fields) {
  var enabled = (fields || []).filter(function(field) {
    return field && field.enabled !== false;
  });
  var fileCount = enabled.filter(function(field) { return field.type === 'file'; }).length;
  var textCount = enabled.filter(function(field) { return field.type !== 'file'; }).length;
  return '<span class="meta-stat">' + escapeHtml(tfCount('webview.formDataSummaryFields', enabled.length)) + '</span>' +
    '<span class="meta-stat">' + escapeHtml(tfCount('webview.formDataSummaryFiles', fileCount)) + '</span>' +
    '<span class="meta-stat">' + escapeHtml(tfCount('webview.formDataSummaryText', textCount)) + '</span>';
}

function collectFormData(container) {
  if (!container) return [];
  var arr = [];
  container.querySelectorAll('.formdata-row').forEach(function(row) {
    var cb = row.querySelector('input[type="checkbox"]');
    var key = row.querySelector('.js-formdata-key')?.value || '';
    var value = row.querySelector('.js-formdata-value')?.value || '';
    var type = row.querySelector('.js-formdata-type')?.value || 'text';
    if (!key && !value) return;
    arr.push({
      id: row.dataset.rowId || ('fd_' + Math.random().toString(36).slice(2, 8)),
      key: key,
      value: value,
      enabled: cb?.checked !== false,
      type: type === 'file' ? 'file' : 'text',
    });
  });
  return arr;
}

function collectScripts(mc) {
  return {
    preRequest: mc.querySelector('.js-script-prerequest')?.value || '',
    test: mc.querySelector('.js-script-test')?.value || '',
  };
}

// === Auth ===
function authHtml(auth) {
  const type = auth?.type || 'none';
  return '<select class="js-auth-type">' +
    ['none','basic','bearer','apikey'].map(t =>
      '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' +
      authTypeLabel(t) + '</option>'
    ).join('') +
    '</select><div class="auth-fields js-auth-fields">' + authFieldsHtml(type, auth) + '</div>';
}

function maskedAuthInputHtml(label, className, value, sensitive) {
  return '<div class="auth-row"><label>' + escapeHtml(label) + '</label>' +
    '<input type="' + (sensitive ? 'password' : 'text') + '" class="' + className + '" value="' + escapeAttr(value) + '"/>' +
    (sensitive
      ? '<button class="ghost-btn auth-reveal js-auth-reveal" type="button">' + escapeHtml(tr('webview.revealShort')) + '</button>'
      : '') +
  '</div>';
}

function authFieldsHtml(type, auth) {
  if (type === 'basic') {
    const u = auth?.basic?.username || '';
    const p = auth?.basic?.password || '';
    return maskedAuthInputHtml(tr('webview.username'), 'js-auth-user', u, false) +
           maskedAuthInputHtml(tr('webview.password'), 'js-auth-pass', p, true);
  }
  if (type === 'bearer') {
    const t = auth?.bearer?.token || '';
    return maskedAuthInputHtml(tr('webview.token'), 'js-auth-token', t, true);
  }
  if (type === 'apikey') {
    const k = auth?.apikey?.key || '';
    const v = auth?.apikey?.value || '';
    const a = auth?.apikey?.addTo || 'header';
    return maskedAuthInputHtml(tr('webview.key'), 'js-auth-apikey', k, false) +
           maskedAuthInputHtml(tr('webview.value'), 'js-auth-apival', v, true) +
           '<div class="auth-row"><label>' + escapeHtml(tr('webview.addTo')) + '</label><select class="js-auth-addto"><option value="header"' + (a==='header'?' selected':'') + '>' + escapeHtml(tr('webview.header')) + '</option><option value="query"' + (a==='query'?' selected':'') + '>' + escapeHtml(tr('webview.query')) + '</option></select></div>';
  }
  return '';
}

function collectAuth(mc) {
  const type = mc.querySelector('.js-auth-type')?.value || 'none';
  const auth = { type };
  if (type === 'basic') auth.basic = { username: mc.querySelector('.js-auth-user')?.value || '', password: mc.querySelector('.js-auth-pass')?.value || '' };
  if (type === 'bearer') auth.bearer = { token: mc.querySelector('.js-auth-token')?.value || '' };
  if (type === 'apikey') auth.apikey = { key: mc.querySelector('.js-auth-apikey')?.value || '', value: mc.querySelector('.js-auth-apival')?.value || '', addTo: mc.querySelector('.js-auth-addto')?.value || 'header' };
  return auth;
}


const envEditor = document.getElementById('envEditor');
const envEditorName = document.getElementById('envEditorName');
const envEditorVarCount = document.getElementById('envEditorVarCount');
const envVarRows = document.getElementById('envVarRows');
const addEnvVarBtn = document.getElementById('addEnvVarBtn');
const envCloseBtn = document.getElementById('envCloseBtn');

function refreshEnvironmentEditorLayout() {
  requestAnimationFrame(function() {
    var reqArea = mainContent?.querySelector('.req-area');
    if (!reqArea) return;
    var splitEl = mainContent.querySelector('.split');
    var dividerEl = mainContent.querySelector('.divider');
    var progressEl = mainContent.querySelector('.bullet-progress');
    var activeTab = tabs.find(function(t) { return t.id === activeTabId; });
    if (reqArea.dataset.manualHeight === '1' && !isRequestEditorCollapsed(activeTab)) {
      applyManualRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, reqArea.offsetHeight || reqArea.style.height, activeTab, false);
      return;
    }
    applyAdaptiveRequestAreaHeight(reqArea, splitEl, dividerEl, progressEl, activeTab);
  });
}

function refreshEnvironmentEditorSummary() {
  var hasEnvironment = !!editingEnvId && !!envEditorEnvName;
  if (envEditorName) {
    envEditorName.textContent = hasEnvironment ? envEditorEnvName : tr('webview.environmentNone');
    envEditorName.classList.toggle('muted', !hasEnvironment);
  }
  if (envEditorVarCount) {
    envEditorVarCount.textContent = hasEnvironment ? '(' + tfCount('environment.vars', envEditorVariableCount) + ')' : '';
  }
}

function refreshEnvironmentEditorCountFromRows() {
  envEditorVariableCount = collectKv(envVarRows).length;
  refreshEnvironmentEditorSummary();
  refreshStatusStrip(mainContent);
}

function syncEnvironmentEditorControls() {
  if (addEnvVarBtn) {
    addEnvVarBtn.disabled = !editingEnvId;
  }
}

function hideEnvironmentEditor() {
  if (!envEditor) return;
  envEditor.classList.add('hidden');
  envEditor.classList.remove('linked-focus-active');
  syncEnvironmentStripDisclosureState();
  refreshEnvironmentEditorLayout();
}

function setEnvironmentEditorData(envId, envName, variables) {
  flushPendingEnvironmentSave();
  editingEnvId = envId || null;
  envEditorEnvName = envName || null;
  var items = Array.isArray(variables) ? variables : [];
  envEditorVariableCount = editingEnvId ? items.length : 0;
  envVarRows.innerHTML = editingEnvId ? kvRowsHtml(items) : '';
  envVarRows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  envDirtyDot?.classList.remove('show');
  envAutoSaved?.classList.remove('show');
  refreshEnvironmentEditorSummary();
  syncEnvironmentEditorControls();
  if (!editingEnvId) {
    hideEnvironmentEditor();
  } else {
    refreshEnvironmentEditorLayout();
  }
}

addEnvVarBtn.addEventListener('click', () => {
  if (!editingEnvId) return;
  addKvRow(envVarRows);
  envVarRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
  refreshEnvironmentEditorCountFromRows();
  envScheduleSave();
});
envCloseBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  hideEnvironmentEditor();
});
bindKvRow(envVarRows, {
  onChange: () => {
    refreshEnvironmentEditorCountFromRows();
    envScheduleSave();
  }
});
refreshEnvironmentEditorSummary();
syncEnvironmentEditorControls();
updateStaticLocalizedText();


const envDirtyDot = document.getElementById('envDirtyDot');
const envAutoSaved = document.getElementById('envAutoSaved');
let envSaveTimer = null;
let envAutoSavedTimer = null;

function envMarkDirty() {
  envDirtyDot.classList.add('show');
  envAutoSaved.classList.remove('show');
}

function envAutoSave() {
  clearTimeout(envSaveTimer);
  envSaveTimer = null;
  if (!editingEnvId) return;
  const vars = collectKv(envVarRows);
  vscode.postMessage({ type: 'saveEnvironmentVars', envId: editingEnvId, variables: vars });
  
  envDirtyDot.classList.remove('show');
  envAutoSaved.classList.add('show');
  clearTimeout(envAutoSavedTimer);
  envAutoSavedTimer = setTimeout(() => envAutoSaved.classList.remove('show'), 2000);
}

function flushPendingEnvironmentSave() {
  if (!envSaveTimer) return;
  clearTimeout(envSaveTimer);
  envSaveTimer = null;
  envAutoSave();
}

function envScheduleSave() {
  envMarkDirty();
  clearTimeout(envSaveTimer);
  envSaveTimer = setTimeout(envAutoSave, 500);
}


envVarRows.addEventListener('focusout', () => {
  if (!editingEnvId) return;
  clearTimeout(envSaveTimer);
  envAutoSave();
});


const defaultHeadersEditor = document.getElementById('defaultHeadersEditor');
const defaultHeaderRows = document.getElementById('defaultHeaderRows');

document.getElementById('addDefaultHeaderBtn').addEventListener('click', () => {
  addKvRow(defaultHeaderRows);
  defaultHeaderRows?.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
});
document.getElementById('defaultHeadersCloseBtn').addEventListener('click', () => {
  defaultHeadersEditor.classList.remove('linked-focus-active');
  defaultHeadersEditor.classList.add('hidden');
});
bindKvRow(defaultHeaderRows, { onChange: function() {} });
document.getElementById('defaultHeadersSaveBtn').addEventListener('click', () => {
  const headers = collectKv(defaultHeaderRows);
  workspaceDefaultHeaders = headers;
  refreshDefaultHeadersBanner(mainContent);
  refreshToplineStatusChips(mainContent);
  refreshRequestPreflight(mainContent);
  vscode.postMessage({ type: 'saveDefaultHeaders', headers: headers });
});


window.addEventListener('message', (event) => {
  const msg = event.data;

  if (msg.type === 'updateLocalization') {
    applyLocalizationUpdate(msg);
    return;
  }

  if (msg.type === 'flushTabState') {
    persistTabState();
    vscode.postMessage({ type: 'flushedTabState' });
    return;
  }

  if (msg.type === 'websocketStatus') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    var previousStatus = tab.websocketStatus || 'closed';
    tab.requestType = 'websocket';
    tab.websocketStatus = msg.status;
    tab.lastEvent = msg.status === 'error' ? 'error' : 'websocket';
    if (msg.status === 'error') {
      tab.error = msg.error || tr('webview.stage.failed');
    } else if (msg.status === 'open') {
      tab.error = null;
    } else if (msg.status === 'closed' && previousStatus !== 'error') {
      tab.error = null;
    }
    if (msg.status === 'open') {
      appendWebSocketMessage(tab, { direction: 'in', messageType: 'system', data: tr('webview.connected') });
    } else if (msg.status === 'closed') {
      appendWebSocketMessage(tab, { direction: 'in', messageType: 'system', data: formatWebSocketCloseMessage(msg) });
    } else if (msg.status === 'error') {
      appendWebSocketMessage(tab, { direction: 'in', messageType: 'system', data: formatWebSocketErrorMessage(msg) });
    }
    if (activeTabId === msg.tabId) {
      renderTabBar();
      renderContent();
    } else {
      renderTabBar();
    }
    debouncePersist();
    return;
  }

  if (msg.type === 'websocketMessage') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    tab.requestType = 'websocket';
    tab.lastEvent = 'websocket';
    if (tab.websocketStatus !== 'error') {
      tab.websocketStatus = 'open';
      tab.error = null;
    }
    appendWebSocketMessage(tab, {
      direction: msg.direction,
      messageType: msg.messageType,
      data: msg.data || '',
      size: msg.size,
      timestamp: msg.timestamp || Date.now()
    });
    if (activeTabId === msg.tabId) {
      renderContent();
    } else {
      renderTabBar();
    }
    debouncePersist();
    return;
  }

  if (msg.type === 'requestCanceled') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    applyResponseTiming(tab, msg);
    tab.lastEvent = 'canceled';
    tab.error = null;
    if (activeTabId === msg.tabId) {
      var neonEl = mainContent.querySelector('.js-url.neon-active');
      if (neonEl) neonEl.classList.remove('neon-active');
      renderContent();
    } else {
      renderTabBar();
    }
  }

  if (msg.type === 'receiveResponse' || msg.type === 'responseError') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    applyResponseTiming(tab, msg);
    tab.slideIn = true;

    
    var neonEl = mainContent.querySelector('.js-url.neon-active');
    if (neonEl) neonEl.classList.remove('neon-active');

    if (msg.type === 'receiveResponse') {
      if (tab.response) {
        var prevEnv = currentEnvName ? '[' + currentEnvName + ']' : '';
        lastResponse = createResponseSnapshot(
          tab,
          tab.response,
          ((tab.name || (tab.method + ' ' + tab.url)) + ' ' + prevEnv + ' (previous)').trim()
        );
      }
      tab.response = msg.response;
      tab.lastEvent = 'success';
      tab.resolvedUrl = msg.resolvedUrl || '';
      tab.resolvedHeaders = msg.resolvedHeaders || [];
      tab.scriptResults = msg.scriptResults || { logs: [], tests: [] };
      var contentType = ((msg.response.headers?.['content-type'] || msg.response.headers?.['Content-Type'] || '') + '').toLowerCase();
      tab.responseTab = (contentType.indexOf('html') >= 0 && hasMeaningfulStaticPreview(msg.response.body || '')) ? 'resPreview' : 'resBody';
      tab.error = null;
    } else {
      tab.lastEvent = 'error';
      tab.error = msg.error;
      tab.response = null;
      tab.scriptResults = null;
      tab.responseTab = 'resBody';
    }
    if (activeTabId === msg.tabId) {
      
      var bp = mainContent.querySelector('.js-bullet-progress');
      if (bp) {
        var glow = bp.querySelector('.bullet-glow');
        if (glow) {
          var glowRect = glow.getBoundingClientRect();
          var bpRect = bp.getBoundingClientRect();
          bp.style.setProperty('--pos', (glowRect.left - bpRect.left) + 'px');
        }
        bp.classList.add('finishing');
      }
      
      setTimeout(function() {
        renderContent();
        setTimeout(function() {
          var sc = tab.response ? Math.floor(tab.response.status / 100) : 0;
          var isError = (sc >= 4 || !tab.response);

          
          var badge = mainContent.querySelector('.status');
          if (badge) {
            badge.classList.add(isError ? 'flash-error' : 'flash-success');
          }

          
          if (isError && tab.response) {
            var flash = document.createElement('div');
            flash.className = 'screen-flash';
            document.body.appendChild(flash);
            setTimeout(function() { flash.remove(); }, 150);
          }

          
          if (tab.response && tab.response.time <= 100) {
            var meta = mainContent.querySelector('.response-meta');
            if (meta) {
              meta.style.position = 'relative';
              var perf = document.createElement('span');
              perf.className = 'perfect-badge';
              perf.textContent = 'PERFECT!';
              meta.appendChild(perf);
              setTimeout(function() { perf.remove(); }, 900);
            }
          }
        }, 30);
      }, 250);
    }
    
    setTimeout(function() { tab.slideIn = false; }, 300);
  }

  if (msg.type === 'newTab') {
    createTab();
  }

  if (msg.type === 'restoreTabState') {
    compareSettings = normalizeCompareSettings(msg.compareSettings);
    var restoreTabs = msg.tabs || [];
    var restoreIdx = msg.activeIndex || 0;
    if (restoreTabs.length > 0) {
      
      if (tabs.length === 1 && !tabs[0].url) {
        tabs.splice(0, 1);
      }
      for (var ri = 0; ri < restoreTabs.length; ri++) {
        createTab(restoreTabs[ri]);
      }
      
      if (restoreIdx >= 0 && restoreIdx < tabs.length) {
        switchTab(tabs[restoreIdx].id);
      }
    }
  }

  if (msg.type === 'activeVarKeys') {
    activeVarKeys = msg.varKeys || [];
    activeVarValues = msg.varValues || {};
    syncAllRequestTypesFromUrls();
    checkUnresolvedVars();
    syncVariablePreviewHints(mainContent);
    if (variableAutocompleteState?.target) {
      syncVariableAutocomplete(variableAutocompleteState.target);
    }
    renderTabBar();
    renderContent();
  }

  if (msg.type === 'loadRequest') {
    
    if (msg.requestId) {
      var existing = tabs.find(function(t) { return t.requestId === msg.requestId; });
      if (existing) {
        switchTab(existing.id);
        return;
      }
    }
    createTab({
      requestId: msg.requestId || null,
      name: msg.name || msg.method + ' ' + msg.url,
      requestType: msg.requestType,
      method: msg.method,
      url: msg.url,
      headers: msg.headers || [],
      params: msg.params || [],
      body: msg.body || '',
      bodyType: msg.bodyType || 'none',
      formData: msg.formData || [],
      binaryFilePath: msg.binaryFilePath || '',
      auth: msg.auth || { type: 'none' },
      scripts: msg.scripts || { preRequest: '', test: '' },
      timeout: msg.timeout || 0,
      followRedirects: msg.followRedirects === true,
      saveToHistory: msg.saveToHistory !== false,
      tlsValidation: msg.tlsValidation || 'default',
      maxResponseSizeKb: msg.maxResponseSizeKb || 0,
      retryCount: msg.retryCount || 0,
      retryDelayMs: msg.retryDelayMs || 0,
      stopAfterHeaders: msg.stopAfterHeaders === true,
      skipDefaultHeaders: msg.skipDefaultHeaders === true,
      disableScripts: msg.disableScripts === true,
      scriptsTrusted: msg.scriptsTrusted !== false,
      webSocketKeepAliveEnabled: msg.webSocketKeepAliveEnabled === true,
      webSocketKeepAliveIntervalSeconds: normalizeWebSocketKeepAliveInterval(msg.webSocketKeepAliveIntervalSeconds),
      webSocketKeepAliveMessage: normalizeWebSocketKeepAliveMessage(msg.webSocketKeepAliveMessage),
    });
  }

  if (msg.type === 'pickFileResult') {
    if (msg.target === 'binary') {
      var binaryInput = mainContent.querySelector('.js-binary-path');
      if (binaryInput && msg.filePath) {
        binaryInput.value = msg.filePath;
        markDirty();
        refreshDraftInsights(mainContent);
      }
    } else if (msg.target === 'formdata' && msg.rowId) {
      var row = mainContent.querySelector('.formdata-row[data-row-id="' + msg.rowId + '"]');
      var input = row?.querySelector('.js-formdata-value');
      if (input && msg.filePath) {
        input.value = msg.filePath;
        syncFormDataRow(row);
        markDirty();
        refreshDraftInsights(mainContent);
      }
    }
  }

  if (msg.type === 'loadEnvironment') {
    setEnvironmentEditorData(msg.envId, msg.envName, msg.variables || []);
    revealEnvironmentEditor();
  }

  if (msg.type === 'loadDefaultHeaders') {
    workspaceDefaultHeaders = msg.headers || [];
    defaultHeaderRows.innerHTML = kvRowsHtml(workspaceDefaultHeaders);
    defaultHeaderRows.querySelectorAll('.kv-row').forEach(syncKvRowSensitivity);
    refreshDefaultHeadersBanner(mainContent);
    refreshToplineStatusChips(mainContent);
    refreshRequestPreflight(mainContent);
    if (msg.reveal !== false) {
      revealDefaultHeadersEditor();
    }
  }

  if (msg.type === 'updateActiveEnv') {
    currentEnvName = msg.envName;
    currentWorkspaceProfile = msg.profileName || 'default';
    if (Object.prototype.hasOwnProperty.call(msg, 'envId')) {
      setEnvironmentEditorData(msg.envId || null, msg.envName || null, msg.variables || []);
    }
    refreshToplineStatusChips(mainContent);
    refreshRequestPreflight(mainContent);
  }

  
  if (msg.type === 'saveRequestResult') {
    if (msg.saved) {
      
      var savedTab = _pendingCloseAfterSave
        ? tabs.find(function(t){return t.id === _pendingCloseAfterSave})
        : tabs.find(function(t){return t.id === activeTabId});
      if (savedTab) {
        if (msg.requestId) savedTab.requestId = msg.requestId;
        if (msg.name) savedTab.name = msg.name;
        savedTab.autoName = false;
        savedTab._snapshot = snapshotTab(savedTab);
        savedTab.dirty = false;
      }
      renderTabBar();
      if (pendingSaveBtn) {
        showBtnFeedback(pendingSaveBtn, tr('webview.saved'), 1200);
      }
      
      if (_pendingCloseAfterSave) {
        doCloseTab(_pendingCloseAfterSave);
        _pendingCloseAfterSave = null;
      }
      debouncePersist();
    } else {
      
      _pendingCloseAfterSave = null;
    }
    pendingSaveBtn = null;
  }
  if (msg.type === 'saveResponseBodyResult') {
    if (msg.saved && pendingSaveResponseBtn) {
      showBtnFeedback(pendingSaveResponseBtn, tr('webview.saved'), 1200);
    }
    pendingSaveResponseBtn = null;
  }

  
  if (msg.type === 'configureCollectionRun') {
    showRunnerSetup(msg);
  }
  if (msg.type === 'runCollectionStart') {
    showRunner(msg);
  }
  if (msg.type === 'runCollectionStatus') {
    updateRunnerStatus(msg);
  }
  if (msg.type === 'runCollectionProgress') {
    updateRunnerRow(msg);
  }
  if (msg.type === 'runCollectionDone') {
    finishRunner(msg);
  }
});


var runnerOverlay = null;
var runnerResults = [];
var runnerStatusState = null;

function normalizeRunnerDelayInput(value) {
  var parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(60000, Math.max(0, parsed));
}

function normalizeRunnerIterationsInput(value) {
  var parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(100, Math.max(1, parsed));
}

function normalizeRunnerRequestChoices(msg) {
  var requests = Array.isArray(msg.requests) ? msg.requests : [];
  var normalized = [];
  for (var i = 0; i < requests.length; i++) {
    var entry = requests[i];
    if (!entry || typeof entry.id !== 'string' || !entry.id) continue;
    normalized.push({
      id: entry.id,
      name: typeof entry.name === 'string' ? entry.name : entry.id,
      method: typeof entry.method === 'string' && entry.method ? String(entry.method).toUpperCase() : 'GET',
      folderPath: typeof entry.folderPath === 'string' ? entry.folderPath : '',
    });
  }
  if (normalized.length > 0) return normalized;
  var fallbackTotal = Number(msg.total) || 0;
  for (var j = 0; j < fallbackTotal; j++) {
    normalized.push({
      id: 'legacy-' + j,
      name: '#' + (j + 1),
      method: 'GET',
      folderPath: '',
    });
  }
  return normalized;
}

function renderRunnerRequestChoiceRows(requests) {
  return requests.map(function(entry, index) {
    var checkboxId = 'runner-req-' + index;
    var pathHtml = entry.folderPath
      ? '<div class="runner-request-path">' + escapeHtml(entry.folderPath) + '</div>'
      : '';
    return '<label class="runner-request-row" for="' + escapeAttr(checkboxId) + '">' +
      '<input id="' + escapeAttr(checkboxId) + '" class="js-runner-request-check" data-testid="runner-request-check" type="checkbox" checked data-request-id="' + escapeAttr(entry.id) + '">' +
      '<span class="runner-request-meta">' +
        '<span class="runner-request-line">' +
          '<span class="method-badge method-' + escapeAttr(entry.method) + '">' + escapeHtml(entry.method) + '</span>' +
          '<span class="runner-request-name">' + escapeHtml(entry.name) + '</span>' +
        '</span>' +
        pathHtml +
      '</span>' +
    '</label>';
  }).join('');
}

function showRunnerSetup(msg) {
  runnerResults = [];
  runnerStatusState = null;
  var options = msg.options || {};
  var delayMs = normalizeRunnerDelayInput(options.delayMs);
  var iterations = normalizeRunnerIterationsInput(options.iterations);
  var stopOnFailure = options.stopOnFailure === true;
  var requestChoices = normalizeRunnerRequestChoices(msg);
  var collectionTotal = requestChoices.length;

  if (runnerOverlay) runnerOverlay.remove();
  runnerOverlay = document.createElement('div');
  runnerOverlay.className = 'runner-overlay';
  runnerOverlay.innerHTML =
    '<div class="runner-header">' +
      '<h3>' + escapeHtml(tf('webview.runTitle', { name: msg.name })) + '</h3>' +
      '<button class="btn btn-s js-runner-start" data-testid="runner-start" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runStart')) + '</button>' +
      '<button class="btn btn-s js-runner-close" data-testid="runner-close" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runClose')) + '</button>' +
    '</div>' +
    '<div class="runner-request-select" data-testid="runner-request-select">' +
      '<div class="runner-request-select-head">' +
        '<div>' +
          '<div class="runner-request-select-title">' + escapeHtml(tr('webview.runRequests')) + '</div>' +
          '<div class="runner-request-select-count js-runner-selected-count" data-testid="runner-selected-count"></div>' +
        '</div>' +
        '<div class="runner-request-select-actions">' +
          '<button type="button" class="js-runner-select-all" data-testid="runner-select-all">' + escapeHtml(tr('webview.runSelectAll')) + '</button>' +
          '<button type="button" class="js-runner-clear-selection" data-testid="runner-clear-selection">' + escapeHtml(tr('webview.runClearSelection')) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="runner-request-list js-runner-request-list" data-testid="runner-request-list" role="group" aria-label="' + escapeAttr(tr('webview.runRequests')) + '">' +
        renderRunnerRequestChoiceRows(requestChoices) +
      '</div>' +
      '<div class="runner-select-hint js-runner-select-hint" data-testid="runner-select-hint" hidden></div>' +
    '</div>' +
    '<div class="runner-options">' +
      '<label class="runner-option">' +
        '<span>' + escapeHtml(tr('webview.runDelayMs')) + '</span>' +
        '<input class="input js-runner-delay" type="number" min="0" max="60000" step="100" value="' + delayMs + '">' +
      '</label>' +
      '<label class="runner-option">' +
        '<span>' + escapeHtml(tr('webview.runIterations')) + '</span>' +
        '<input class="input js-runner-iterations" type="number" min="1" max="100" step="1" value="' + iterations + '">' +
      '</label>' +
      '<label class="runner-option runner-option-check">' +
        '<input class="js-runner-stop-on-failure" type="checkbox"' + (stopOnFailure ? ' checked' : '') + '>' +
        '<span>' + escapeHtml(tr('webview.runStopOnFailure')) + '</span>' +
      '</label>' +
    '</div>' +
    '<div class="runner-summary" data-testid="runner-summary">' +
      '<span>' + escapeHtml(tr('webview.runTotal')) + ': <b class="js-runner-collection-total" data-testid="runner-collection-total">' + collectionTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runSelected')) + ': <b class="js-runner-selected-total" data-testid="runner-selected-total">' + collectionTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runRuns')) + ': <b class="js-runner-runs" data-testid="runner-runs">' + (collectionTotal * iterations) + '</b></span>' +
    '</div>' +
    '<div class="runner-live-status">' +
      '<div class="runner-live-title">' + escapeHtml(tr('webview.runOptions')) + '</div>' +
      '<div class="runner-live-copy">' + escapeHtml(tr('webview.runOptionsCopy')) + '</div>' +
    '</div>';

  document.body.appendChild(runnerOverlay);

  var delayInput = runnerOverlay.querySelector('.js-runner-delay');
  var iterationInput = runnerOverlay.querySelector('.js-runner-iterations');
  var runsEl = runnerOverlay.querySelector('.js-runner-runs');
  var selectedTotalEl = runnerOverlay.querySelector('.js-runner-selected-total');
  var selectedCountEl = runnerOverlay.querySelector('.js-runner-selected-count');
  var selectHintEl = runnerOverlay.querySelector('.js-runner-select-hint');
  var startBtn = runnerOverlay.querySelector('.js-runner-start');
  var checkboxes = Array.from(runnerOverlay.querySelectorAll('.js-runner-request-check'));

  var getSelectedRequestIds = function() {
    return checkboxes
      .filter(function(input) { return input.checked; })
      .map(function(input) { return input.dataset.requestId; })
      .filter(Boolean);
  };

  var syncRunnerSelectionUi = function() {
    var selectedCount = getSelectedRequestIds().length;
    if (selectedCountEl) {
      selectedCountEl.textContent = tf('webview.runSelectedCount', {
        selected: selectedCount,
        total: collectionTotal,
      });
    }
    if (selectedTotalEl) selectedTotalEl.textContent = String(selectedCount);
    if (runsEl) {
      runsEl.textContent = String(selectedCount * normalizeRunnerIterationsInput(iterationInput?.value));
    }
    var noneSelected = selectedCount === 0;
    if (startBtn) {
      startBtn.disabled = noneSelected;
      startBtn.setAttribute('aria-disabled', noneSelected ? 'true' : 'false');
    }
    if (selectHintEl) {
      selectHintEl.hidden = !noneSelected;
      selectHintEl.textContent = noneSelected ? tr('webview.runSelectAtLeastOne') : '';
    }
  };

  checkboxes.forEach(function(input) {
    input.addEventListener('change', syncRunnerSelectionUi);
  });
  runnerOverlay.querySelector('.js-runner-select-all')?.addEventListener('click', function() {
    checkboxes.forEach(function(input) { input.checked = true; });
    syncRunnerSelectionUi();
  });
  runnerOverlay.querySelector('.js-runner-clear-selection')?.addEventListener('click', function() {
    checkboxes.forEach(function(input) { input.checked = false; });
    syncRunnerSelectionUi();
  });

  delayInput?.addEventListener('change', function() { this.value = String(normalizeRunnerDelayInput(this.value)); });
  iterationInput?.addEventListener('change', function() {
    this.value = String(normalizeRunnerIterationsInput(this.value));
    syncRunnerSelectionUi();
  });
  iterationInput?.addEventListener('input', syncRunnerSelectionUi);
  syncRunnerSelectionUi();

  startBtn?.addEventListener('click', function() {
    var selectedRequestIds = getSelectedRequestIds();
    if (selectedRequestIds.length === 0) {
      syncRunnerSelectionUi();
      return;
    }
    var selectedOptions = {
      delayMs: normalizeRunnerDelayInput(delayInput?.value),
      iterations: normalizeRunnerIterationsInput(iterationInput?.value),
      stopOnFailure: runnerOverlay.querySelector('.js-runner-stop-on-failure')?.checked === true,
    };
    this.disabled = true;
    vscode.postMessage({
      type: 'startCollectionRun',
      delayMs: selectedOptions.delayMs,
      iterations: selectedOptions.iterations,
      stopOnFailure: selectedOptions.stopOnFailure,
      selectedRequestIds: selectedRequestIds,
    });
  });

  runnerOverlay.querySelector('.js-runner-close').addEventListener('click', function() {
    if (runnerOverlay) { runnerOverlay.remove(); runnerOverlay = null; }
  });
}

function showRunner(msg) {
  runnerResults = [];
  runnerStatusState = null;
  var total = msg.total || 0;
  var collectionTotal = msg.collectionTotal != null ? msg.collectionTotal : total;
  var selectedTotal = msg.selectedTotal != null ? msg.selectedTotal : total;
  var totalRuns = msg.totalRuns || total;
  
  if (runnerOverlay) runnerOverlay.remove();
  runnerOverlay = document.createElement('div');
  runnerOverlay.className = 'runner-overlay';
  runnerOverlay.innerHTML =
    '<div class="runner-header">' +
      '<h3>' + escapeHtml(tf('webview.runTitle', { name: msg.name })) + '</h3>' +
      '<button class="btn btn-s js-runner-stop" data-testid="runner-stop" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runStop')) + '</button>' +
      '<button class="btn btn-s js-runner-rerun hidden" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runRerunFailed')) + '</button>' +
      '<button class="btn btn-s js-runner-close hidden" data-testid="runner-close" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runClose')) + '</button>' +
    '</div>' +
    '<div class="runner-progress" data-testid="runner-progress">' +
      '<span class="js-runner-counter" data-testid="runner-counter">0/' + totalRuns + '</span>' +
      '<div class="runner-bar"><div class="runner-bar-fill js-runner-bar" style="transform:scaleX(0)"></div></div>' +
      '<span class="spinner js-runner-spinner"></span>' +
    '</div>' +
    '<div class="runner-summary" data-testid="runner-summary">' +
      '<span>' + escapeHtml(tr('webview.runTotal')) + ': <b data-testid="runner-collection-total">' + collectionTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runSelected')) + ': <b data-testid="runner-selected-total">' + selectedTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runRuns')) + ': <b data-testid="runner-runs">' + totalRuns + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runIteration')) + ': <b class="js-runner-iteration">1/' + (msg.iterations || 1) + '</b></span>' +
      '<span class="pass">' + escapeHtml(tr('webview.runPassed')) + ': <b class="js-runner-pass" data-testid="runner-passed">0</b></span>' +
      '<span class="fail">' + escapeHtml(tr('webview.runFailed')) + ': <b class="js-runner-fail" data-testid="runner-failed">0</b></span>' +
      '<span class="skip">' + escapeHtml(tr('webview.runSkipped')) + ': <b class="js-runner-skip" data-testid="runner-skipped">0</b></span>' +
      '<span class="js-runner-time"></span>' +
    '</div>' +
    '<div class="runner-live-status">' +
      '<div class="runner-live-title js-runner-live-title">' + escapeHtml(tr('webview.runStatus')) + '</div>' +
      '<div class="runner-live-copy js-runner-live-copy"></div>' +
    '</div>' +
    '<div class="runner-list js-runner-list"></div>';

  document.body.appendChild(runnerOverlay);

  
  runnerOverlay.querySelector('.js-runner-stop').addEventListener('click', function() {
    vscode.postMessage({ type: 'stopCollectionRun' });
    this.disabled = true;
    this.textContent = tr('webview.runStopping');
  });
  
  runnerOverlay.querySelector('.js-runner-close').addEventListener('click', function() {
    if (runnerOverlay) { runnerOverlay.remove(); runnerOverlay = null; }
  });
  runnerOverlay.querySelector('.js-runner-rerun').addEventListener('click', function() {
    var failedIndices = [];
    runnerResults.forEach(function(result, index) {
      if (result?.failed) {
        failedIndices.push(Number.isInteger(result.requestIndex) ? result.requestIndex : index);
      }
    });
    failedIndices = Array.from(new Set(failedIndices));
    if (!failedIndices.length) return;
    this.disabled = true;
    vscode.postMessage({ type: 'rerunFailedCollection', failedIndices: failedIndices });
  });
  
  runnerOverlay.querySelector('.js-runner-list').addEventListener('click', function(e) {
    var row = e.target.closest('.runner-row');
    if (!row) return;
    var idx = parseInt(row.dataset.idx);
    var existing = row.nextElementSibling;
    if (existing && existing.classList.contains('runner-detail')) {
      existing.remove();
      return;
    }
    var r = runnerResults[idx];
    if (!r) return;
    var detail = document.createElement('div');
    detail.className = 'runner-detail';
    if (r.error) {
      detail.textContent = tr('webview.runError') + ': ' + r.error;
    } else if (r.response) {
      var body = r.response.body || '';
      var ct = (r.response.headers?.['content-type'] || r.response.headers?.['Content-Type'] || '').toLowerCase();
      if (r.response.bodyBase64 && isBinaryContentType(ct)) {
        body = tr('webview.binaryResponse');
      }
      if (body.length > 2000) body = body.substring(0, 2000) + '\\n... (truncated)';
      detail.textContent = tr('webview.runStatus') + ': ' + r.response.status + ' ' + r.response.statusText +
        '\\n' + tr('webview.size') + ': ' + formatSize(r.response.size) + '\\n\\n' + body;
    }
    row.after(detail);
  });
}

function updateRunnerStatus(msg) {
  if (!runnerOverlay) return;
  runnerStatusState = msg;
  var titleEl = runnerOverlay.querySelector('.js-runner-live-title');
  var copyEl = runnerOverlay.querySelector('.js-runner-live-copy');
  if (titleEl) {
    titleEl.textContent = msg.phase === 'retry'
      ? tr('webview.runRetrying')
      : msg.phase === 'delay'
        ? tr('webview.runWaiting')
        : tr('webview.runSending');
  }
  if (copyEl) {
    var attemptLabel = tf('webview.runAttempt', {
      current: msg.attempt || 1,
      total: msg.totalAttempts || 1,
    });
    var iterationLabel = tf('webview.runIterationStatus', {
      current: msg.iteration || 1,
      total: msg.totalIterations || 1,
    });
    var prefix = (msg.method || '') + ' ' + (msg.name || '');
    if (msg.phase === 'retry') {
      copyEl.textContent = iterationLabel + ' · ' + prefix + ' · ' + attemptLabel + ' · ' + tf('webview.runRetryDelay', { count: msg.retryDelayMs || 0 });
    } else if (msg.phase === 'delay') {
      copyEl.textContent = iterationLabel + ' · ' + prefix + ' · ' + tf('webview.runDelayStatus', { count: msg.delayMs || 0 });
    } else {
      copyEl.textContent = iterationLabel + ' · ' + prefix + ' · ' + attemptLabel;
    }
  }
  runnerOverlay.querySelectorAll('.runner-row').forEach(function(row) {
    row.classList.toggle('active', Number(row.dataset.idx) === Number(msg.index));
  });
}

function updateRunnerRow(msg) {
  if (!runnerOverlay) return;
  var list = runnerOverlay.querySelector('.js-runner-list');
  var isPassed = !msg.error && msg.status < 400;
  var cls = isPassed ? 'pass' : 'fail';
  var icon = isPassed ? '\\u2705' : '\\u274C';
  var statusStr = msg.error ? 'ERR' : (msg.status + '');
  var row = document.createElement('div');
  row.className = 'runner-row method-' + msg.method + ' ' + cls;
  row.dataset.idx = msg.index;
  row.dataset.requestIndex = msg.requestIndex;
  row.innerHTML =
    '<span class="rr-idx">' + (msg.index + 1) + '</span>' +
    '<span class="method-badge method-' + msg.method + '">' + msg.method + '</span>' +
    '<span class="rr-name">' + escapeHtml(tf('webview.runRowName', { iteration: msg.iteration || 1, name: msg.name })) + '</span>' +
    '<span class="rr-status">' + statusStr + '</span>' +
    '<span class="rr-time">' + (msg.time ? msg.time + 'ms' : '-') + '</span>' +
    '<span class="rr-icon">' + icon + '</span>';
  list.appendChild(row);

  
  runnerResults[msg.index] = { error: msg.error, response: msg.response, failed: !isPassed, requestIndex: msg.requestIndex };

  
  var totalRuns = msg.totalRuns || msg.total;
  var pct = Math.round(((msg.index + 1) / totalRuns) * 100);
  runnerOverlay.querySelector('.js-runner-counter').textContent = (msg.index + 1) + '/' + totalRuns;
  runnerOverlay.querySelector('.js-runner-bar').style.transform = 'scaleX(' + (pct / 100) + ')';
  var iterationEl = runnerOverlay.querySelector('.js-runner-iteration');
  if (iterationEl) iterationEl.textContent = (msg.iteration || 1) + '/' + (msg.totalIterations || 1);
  runnerOverlay.querySelector('.js-runner-pass').textContent = msg.passed;
  runnerOverlay.querySelector('.js-runner-fail').textContent = msg.failed;
  runnerOverlay.querySelector('.js-runner-skip').textContent = msg.skipped || 0;
  runnerOverlay.querySelectorAll('.runner-row').forEach(function(existingRow) {
    existingRow.classList.toggle('active', Number(existingRow.dataset.idx) === Number(msg.index));
  });

  
  list.scrollTop = list.scrollHeight;
}

function finishRunner(msg) {
  if (!runnerOverlay) return;
  
  var spinner = runnerOverlay.querySelector('.js-runner-spinner');
  if (spinner) spinner.remove();
  
  var stopBtn = runnerOverlay.querySelector('.js-runner-stop');
  if (stopBtn) stopBtn.classList.add('hidden');
  var rerunBtn = runnerOverlay.querySelector('.js-runner-rerun');
  if (rerunBtn) {
    rerunBtn.classList.toggle('hidden', msg.failed <= 0);
    rerunBtn.disabled = false;
  }
  var closeBtn = runnerOverlay.querySelector('.js-runner-close');
  if (closeBtn) closeBtn.classList.remove('hidden');
  var liveTitle = runnerOverlay.querySelector('.js-runner-live-title');
  var liveCopy = runnerOverlay.querySelector('.js-runner-live-copy');
  if (liveTitle) liveTitle.textContent = tr('webview.runStatus');
  if (liveCopy) {
    liveCopy.textContent = msg.stopped
      ? tr('webview.runStopping')
      : msg.stoppedOnFailure
        ? tf('webview.runStoppedOnFailure', { count: msg.skipped || 0 })
        : '';
  }
  
  runnerOverlay.querySelector('.js-runner-time').textContent = tr('webview.runTime') + ': ' + msg.time + 'ms';
  var skipEl = runnerOverlay.querySelector('.js-runner-skip');
  if (skipEl) skipEl.textContent = msg.skipped || 0;
  
  if (!msg.stopped) {
    runnerOverlay.querySelector('.js-runner-bar').style.transform = 'scaleX(1)';
  }
}


function appendJsonPath(basePath, segment, isArray) {
  if (segment === '' || segment === undefined || segment === null) return basePath || '$';
  if (isArray) return (basePath || '$') + '[' + segment + ']';
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)
    ? ((basePath || '$') + '.' + segment)
    : ((basePath || '$') + '[' + JSON.stringify(segment) + ']');
}

function buildJsonTree(val, key, isLast, path) {
  const comma = isLast ? '' : '<span class="jt-comma">,</span>';
  const keyHtml = key !== '' ? '<span class="jt-key">' + escapeHtml('"' + key + '"') + '</span>: ' : '';
  const copyPath = path || '$';
  const pathAttr = ' data-copy-path="' + escapeAttr(copyPath) + '"';
  const rowTitle = ' title="' + escapeAttr(tf('webview.copyJsonPathValue', { path: copyPath })) + '"';
  const copyBtn = '<button class="jt-copy-path" type="button" data-copy-path="' + escapeAttr(copyPath) + '" title="' + escapeAttr(tf('webview.copyJsonPathValue', { path: copyPath })) + '">' + escapeHtml(tr('webview.copyPathShort')) + '</button>';

  if (val === null) {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-null">null</span>' + comma + copyBtn + '</div>';
  }
  if (typeof val === 'boolean') {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-bool">' + val + '</span>' + comma + copyBtn + '</div>';
  }
  if (typeof val === 'number') {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-num">' + val + '</span>' + comma + copyBtn + '</div>';
  }
  if (typeof val === 'string') {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-str">' + escapeHtml('"' + val + '"') + '</span>' + comma + copyBtn + '</div>';
  }

  const isArr = Array.isArray(val);
  const open = isArr ? '[' : '{';
  const close = isArr ? ']' : '}';
  const entries = isArr ? val.map((v, i) => [i, v]) : Object.entries(val);
  const count = entries.length;

  if (count === 0) {
    return '<div class="jt-row"' + pathAttr + rowTitle + '><span class="jt-toggle"></span>' + keyHtml +
      '<span class="jt-brace">' + open + close + '</span>' + comma + copyBtn + '</div>';
  }

  let childrenHtml = '';
  entries.forEach(([k, v], idx) => {
    const childKey = isArr ? '' : String(k);
    const childPath = appendJsonPath(copyPath, String(k), isArr);
    childrenHtml += buildJsonTree(v, childKey, idx === count - 1, childPath);
  });

  const summary = isArr ? count + ' items' : count + ' keys';

  return '<div class="jt-row"' + pathAttr + rowTitle + '>' +
      '<span class="jt-toggle">-</span>' + keyHtml +
      '<span class="jt-brace">' + open + '</span>' +
      '<span class="jt-ellipsis hidden" title="' + summary + '"> ... ' + summary + ' </span>' +
      copyBtn +
    '</div>' +
    '<div class="jt-children jt-node">' + childrenHtml + '</div>' +
    '<div class="jt-row"><span class="jt-toggle"></span><span class="jt-brace">' + close + '</span>' + comma + '</div>';
}

function resolveJsonPath(root, path) {
  if (!path || path === '$') return root;
  var rest = path.charAt(0) === '$' ? path.slice(1) : path;
  var tokenRe = /\\.([^.\\[\\]]+)|\\[(\\d+)\\]|\\["((?:\\\\.|[^"\\\\])*)"\\]/g;
  var current = root;
  var match;
  while ((match = tokenRe.exec(rest)) !== null) {
    if (current == null) return undefined;
    if (match[1] !== undefined) {
      current = current[match[1]];
    } else if (match[2] !== undefined) {
      current = current[Number(match[2])];
    } else if (match[3] !== undefined) {
      current = current[match[3].replace(/\\\\(.)/g, '$1')];
    }
  }
  return current;
}

function stringifyJsonValue(value) {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function truncateToastText(text, max) {
  max = max || 80;
  var flat = String(text).replace(/\\s+/g, ' ');
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1) + '\u2026';
}

function bindTreeToggles(container) {
  var pendingRowClickTimer = null;
  var cancelPendingRowClick = function() {
    if (pendingRowClickTimer) {
      clearTimeout(pendingRowClickTimer);
      pendingRowClickTimer = null;
    }
  };

  container.addEventListener('click', (e) => {
    const copyPathBtn = e.target.closest('.jt-copy-path');
    if (copyPathBtn && copyPathBtn.dataset.copyPath) {
      e.preventDefault();
      e.stopPropagation();
      cancelPendingRowClick();
      const path = copyPathBtn.dataset.copyPath;
      vscode.postMessage({ type: 'copyToClipboard', text: path });
      showCopyToast(tf('webview.copiedPath', { path: path }));
      return;
    }

    const toggle = e.target.closest('.jt-toggle');
    const ellipsis = e.target.closest('.jt-ellipsis');

    // Toggle / ellipsis click => expand/collapse (immediate, no delay)
    if (toggle || ellipsis) {
      cancelPendingRowClick();
      const row = (toggle || ellipsis).closest('.jt-row');
      if (!row) return;
      const tgl = row.querySelector('.jt-toggle');
      if (!tgl || !tgl.textContent.trim()) return;

      const children = row.nextElementSibling;
      if (!children || !children.classList.contains('jt-children')) return;

      const collapsed = children.classList.toggle('collapsed');
      tgl.textContent = collapsed ? '+' : '-';
      const ell = row.querySelector('.jt-ellipsis');
      if (ell) ell.classList.toggle('hidden', !collapsed);
      return;
    }

    // Row click anywhere else => copy JSONPath (delayed, so dblclick can cancel it)
    const row = e.target.closest('.jt-row[data-copy-path]');
    if (row && row.dataset.copyPath) {
      const path = row.dataset.copyPath;
      cancelPendingRowClick();
      pendingRowClickTimer = setTimeout(function() {
        pendingRowClickTimer = null;
        vscode.postMessage({ type: 'copyToClipboard', text: path });
        showCopyToast(tf('webview.copiedPath', { path: path }));
      }, 240);
    }
  });

  container.addEventListener('dblclick', (e) => {
    // Ignore when double-clicking expand/collapse affordances
    if (e.target.closest('.jt-toggle') || e.target.closest('.jt-ellipsis') || e.target.closest('.jt-copy-path')) return;
    const row = e.target.closest('.jt-row[data-copy-path]');
    if (!row || !row.dataset.copyPath) return;
    e.preventDefault();
    cancelPendingRowClick();
    // Clear the accidental text selection the double-click creates
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();

    const root = container._jsonData;
    if (root === undefined) return;
    const value = resolveJsonPath(root, row.dataset.copyPath);
    if (value === undefined) return;
    const text = stringifyJsonValue(value);
    vscode.postMessage({ type: 'copyToClipboard', text: text });
    showCopyToast(tf('webview.copiedValue', { value: truncateToastText(text, 80) }));
  });
}

function buildXPathFromStack(stack) {
  if (!stack.length) return '';
  return '/' + stack.map(function(segment) {
    return segment.name + '[' + segment.index + ']';
  }).join('/');
}

function extractXmlLinePaths(body) {
  var lines = String(body || '').split('\\n');
  var tagPattern = /(<\\?[\\s\\S]*?\\?>|<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\/[^>]+>|<[^>]+\\/\\s*>|<[^>]+>)/g;
  var stack = [];
  var childCounters = [Object.create(null)];

  return lines.map(function(line) {
    var trimmed = (line || '').trim();
    if (!trimmed || trimmed.indexOf('<') < 0) return '';

    var linePath = '';
    var match;
    tagPattern.lastIndex = 0;
    while ((match = tagPattern.exec(trimmed)) !== null) {
      var tag = match[1];
      if (tag.startsWith('<?') || tag.startsWith('<!--') || tag.startsWith('<![CDATA[')) {
        continue;
      }

      if (tag.startsWith('</')) {
        if (!linePath && stack.length) {
          linePath = buildXPathFromStack(stack);
        }
        if (stack.length) {
          stack.pop();
          childCounters.pop();
        }
        continue;
      }

      var nameMatch = tag.match(/^<\\s*([^\\s/>]+)/);
      if (!nameMatch) continue;

      var name = nameMatch[1];
      var currentCounters = childCounters[childCounters.length - 1];
      var nextIndex = (currentCounters[name] || 0) + 1;
      currentCounters[name] = nextIndex;

      stack.push({ name: name, index: nextIndex });
      childCounters.push(Object.create(null));
      linePath = buildXPathFromStack(stack);

      if (/\\/\\s*>$/.test(tag)) {
        stack.pop();
        childCounters.pop();
      }
    }

    return linePath;
  });
}

function renderXmlBodyWithPaths(body) {
  var lines = String(body || '').split('\\n');
  var linePaths = extractXmlLinePaths(body);
  return '<div class="xml-path-body">' + lines.map(function(line, index) {
    var xpath = linePaths[index];
    var copyButton = xpath
      ? '<button class="xml-path-copy js-copy-xml-path" type="button" data-copy-path="' + escapeAttr(xpath) + '" title="' + escapeAttr(tf('webview.copyXPathValue', { path: xpath })) + '">' + escapeHtml(tr('webview.copyXPathShort')) + '</button>'
      : '';
    return '<div class="xml-path-line"' + (xpath ? ' data-copy-path="' + escapeAttr(xpath) + '"' : '') + '>' +
      '<span class="xml-path-content">' + (line ? highlightBody(line, 'xml') : '&nbsp;') + '</span>' +
      copyButton +
    '</div>';
  }).join('') + '</div>';
}



var hljsLangMap = { json: 'json', html: 'html', xml: 'xml', js: 'javascript', css: 'css', text: 'plaintext' };

function detectLang(ct, body) {
  if (ct.includes('json') || ct.includes('javascript') && tryJsonParse(body)) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml') || ct.includes('svg')) return 'xml';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'js';
  if (ct.includes('css')) return 'css';
  if (tryJsonParse(body)) return 'json';
  if (body.trimStart().startsWith('<!') || body.trimStart().startsWith('<html')) return 'html';
  if (body.trimStart().startsWith('<?xml') || body.trimStart().startsWith('<rss')) return 'xml';
  return 'text';
}
function tryJsonParse(s) { try { JSON.parse(s); return true; } catch { return false; } }

function isBinaryContentType(ct) {
  var mime = (ct || '').split(';')[0].trim().toLowerCase();
  if (!mime) return false;
  if (mime.startsWith('text/')) return false;
  if (mime.endsWith('+json') || mime.endsWith('+xml')) return false;
  return [
    'application/json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'text/javascript',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/ld+json',
    'application/x-ndjson',
  ].indexOf(mime) < 0;
}

function highlightBody(body, lang) {
  
  if (lang === 'json') {
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch {}
  }
  var actualLang = lang === '_formatted_json' ? 'json' : lang;
  
  if (typeof hljs !== 'undefined') {
    var hljsLang = hljsLangMap[actualLang] || 'plaintext';
    try {
      return hljs.highlight(body, { language: hljsLang }).value;
    } catch {}
  }
  
  return escapeHtml(body);
}

function getResponseSearchState(tab) {
  return {
    query: typeof tab?.responseSearchQuery === 'string' ? tab.responseSearchQuery : '',
    index: typeof tab?.responseSearchIndex === 'number' ? tab.responseSearchIndex : 0,
    caseSensitive: tab?.responseSearchCaseSensitive === true,
    regex: tab?.responseSearchRegex === true,
  };
}

function getIndentString(indentKey) {
  return indentKey === 'tab' ? '\\t' : ' '.repeat(parseInt(indentKey || '2', 10) || 2);
}

function getDisplayResponseBody(tab, lang, fallbackBody) {
  if (!tab?.response) return fallbackBody || '';
  var body = typeof fallbackBody === 'string' ? fallbackBody : (tab.response.body || '');
  if (lang === 'json') {
    return formatJson(body, tab.jsonFormatStyle || 'pretty', getIndentString(tab.formatIndent || '2'));
  }
  if (lang === 'xml') {
    return formatXml(body, tab.xmlFormatStyle || 'inline', getIndentString(tab.formatIndent || '2'));
  }
  return body;
}

function findResponseSearchMatches(body, query, options) {
  if (!body || !query) return [];
  var source = String(body);
  var settings = options || {};

  if (settings.regex) {
    try {
      var flags = settings.caseSensitive ? 'g' : 'gi';
      var regex = new RegExp(query, flags);
      var regexMatches = [];
      var match;
      while ((match = regex.exec(source)) !== null) {
        var value = match[0] || '';
        regexMatches.push({ start: match.index, end: match.index + value.length });
        if (value.length === 0) {
          regex.lastIndex += 1;
        }
      }
      return regexMatches;
    } catch (_) {
      return [];
    }
  }

  var haystack = settings.caseSensitive ? source : source.toLowerCase();
  var needle = settings.caseSensitive ? String(query) : String(query).toLowerCase();
  if (!needle) return [];
  var matches = [];
  var start = 0;
  while (start <= haystack.length) {
    var idx = haystack.indexOf(needle, start);
    if (idx < 0) break;
    matches.push({ start: idx, end: idx + needle.length });
    start = idx + Math.max(needle.length, 1);
  }
  return matches;
}

function normalizeResponseSearchIndex(index, total) {
  if (total <= 0) return -1;
  if (typeof index !== 'number' || !isFinite(index)) return 0;
  var normalized = index % total;
  return normalized < 0 ? normalized + total : normalized;
}

function renderResponseBody(body, lang, searchQuery, searchIndex, searchState) {
  if (!searchQuery) {
    return highlightBody(body, lang === 'json' ? '_formatted_json' : lang);
  }

  var matches = findResponseSearchMatches(body, searchQuery, searchState || {});
  if (matches.length === 0) {
    return escapeHtml(body);
  }

  var activeIndex = normalizeResponseSearchIndex(searchIndex, matches.length);
  var parts = [];
  var cursor = 0;
  for (var i = 0; i < matches.length; i++) {
    var start = matches[i].start;
    var end = matches[i].end;
    parts.push(escapeHtml(body.slice(cursor, start)));
    parts.push('<mark class="response-search-hit' + (i === activeIndex ? ' active' : '') + '">' + escapeHtml(body.slice(start, end)) + '</mark>');
    cursor = end;
  }
  parts.push(escapeHtml(body.slice(cursor)));
  return parts.join('');
}

function setJsonBodyMode(mc, mode) {
  mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(function(button) {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  var tree = mc.querySelector('.js-res-tree');
  var raw = mc.querySelector('.js-res-raw');
  if (tree) tree.classList.toggle('hidden', mode !== 'tree');
  if (raw) raw.classList.toggle('hidden', mode !== 'raw');
  mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(function(button) {
    button.style.display = mode === 'tree' ? '' : 'none';
  });
}

function syncResponseSearch(mc) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  var rawEl = mc.querySelector('.js-res-raw');
  if (!tab?.response || !rawEl) return;

  var ct = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (!!tab.response.bodyBase64 && isBinaryContentType(ct)) return;

  var lang = detectLang(ct, tab.response.body || '');
  var searchState = getResponseSearchState(tab);
  var query = searchState.query || '';
  var displayBody = getDisplayResponseBody(tab, lang, tab.response.body || '');
  var matches = findResponseSearchMatches(displayBody, query, searchState);
  var activeIndex = normalizeResponseSearchIndex(searchState.index, matches.length);

  if (query && lang === 'json') {
    setJsonBodyMode(mc, 'raw');
  }

  rawEl.innerHTML = lang === 'xml' && !query
    ? renderXmlBodyWithPaths(displayBody)
    : renderResponseBody(displayBody, lang, query, activeIndex, searchState);

  var countEl = mc.querySelector('.js-response-search-count');
  if (countEl) {
    countEl.textContent = query
      ? (matches.length > 0
          ? tf('webview.searchCount', { current: activeIndex + 1, total: matches.length })
          : tr('webview.searchNoMatches'))
      : '';
  }

  var prevBtn = mc.querySelector('.js-response-search-prev');
  var nextBtn = mc.querySelector('.js-response-search-next');
  var clearBtn = mc.querySelector('.js-response-search-clear');
  var caseBtn = mc.querySelector('.js-response-search-case');
  var regexBtn = mc.querySelector('.js-response-search-regex');
  if (prevBtn) prevBtn.disabled = matches.length === 0;
  if (nextBtn) nextBtn.disabled = matches.length === 0;
  if (clearBtn) clearBtn.disabled = !query;
  if (caseBtn) caseBtn.classList.toggle('active', !!searchState.caseSensitive);
  if (regexBtn) regexBtn.classList.toggle('active', !!searchState.regex);

  tab.responseSearchIndex = activeIndex < 0 ? 0 : activeIndex;

  if (query && matches.length > 0) {
    setTimeout(function() {
      rawEl.querySelector('.response-search-hit.active')?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, 0);
  }
}

function stepResponseSearch(mc, delta) {
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab?.response) return;
  var ct = ((tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '') + '').toLowerCase();
  if (!!tab.response.bodyBase64 && isBinaryContentType(ct)) return;
  var lang = detectLang(ct, tab.response.body || '');
  var displayBody = getDisplayResponseBody(tab, lang, tab.response.body || '');
  var matches = findResponseSearchMatches(displayBody, tab.responseSearchQuery || '', getResponseSearchState(tab));
  if (matches.length === 0) return;
  tab.responseSearchIndex = normalizeResponseSearchIndex((tab.responseSearchIndex || 0) + delta, matches.length);
  syncResponseSearch(mc);
}


function getFormatOptions(mc) {
  var toolbar = mc.querySelector('.js-res-body-toolbar');
  if (!toolbar) return null;
  var styleEl = toolbar.querySelector('.js-fmt-style .check');
  var style = 'pretty';
  toolbar.querySelectorAll('.js-fmt-style').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') style = el.dataset.style;
  });
  var indent = '2';
  toolbar.querySelectorAll('.js-fmt-indent').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') indent = el.dataset.indent;
  });
  var indentStr = indent === 'tab' ? '\\t' : ' '.repeat(parseInt(indent));
  return { style: style, indent: indentStr, indentKey: indent, lang: toolbar.dataset.lang };
}

function applyFormat(mc) {
  var opts = getFormatOptions(mc);
  if (!opts) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return;
  if (opts.lang === 'json') tab.jsonFormatStyle = opts.style;
  if (opts.lang === 'xml') tab.xmlFormatStyle = opts.style;
  tab.formatIndent = opts.indentKey;
  var body = tab.response.body;
  var formatted;
  if (opts.lang === 'json') {
    formatted = formatJson(body, opts.style, opts.indent);
  } else if (opts.lang === 'xml') {
    formatted = formatXml(body, opts.style, opts.indent);
  } else {
    return;
  }
  
  var rawEl = mc.querySelector('.js-res-raw');
  if (rawEl) {
    var searchQuery = tab.responseSearchQuery || '';
    rawEl.innerHTML = opts.lang === 'xml' && !searchQuery
      ? renderXmlBodyWithPaths(formatted)
      : renderResponseBody(formatted, opts.lang, searchQuery, tab.responseSearchIndex || 0, getResponseSearchState(tab));
  }
  
  if (opts.lang === 'json') {
    var treeEl = mc.querySelector('.js-res-tree');
    if (treeEl) {
      try {
        var parsed = JSON.parse(body);
        treeEl.innerHTML = buildJsonTree(parsed, '', true, '$');
        treeEl._jsonData = parsed;
        bindTreeToggles(treeEl);
      } catch {}
    }
  }
  syncResponseSearch(mc);
  debouncePersist();
}

function formatJson(body, style, indent) {
  try {
    var parsed = JSON.parse(body);
    if (style === 'compact') return JSON.stringify(parsed);
    return JSON.stringify(parsed, null, indent);
  } catch { return body; }
}


function formatXml(xml, style, indent) {
  
  xml = xml.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');

  if (style === 'compact') {
    
    return xml.replace(/>\\s+</g, '><').replace(/^\\s+|\\s+$/g, '');
  }

  
  var tokens = xmlTokenize(xml);

  if (style === 'inline') {
    return xmlBuildInline(tokens, indent);
  }

  // Pretty
  return xmlBuildPretty(tokens, indent);
}

function xmlTokenize(xml) {
  var tokens = [];
  var re = /(<\\?[\\s\\S]*?\\?>|<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<\\/[^>]+>|<[^>]+\\/\\s*>|<[^>]+>)/g;
  var lastIndex = 0;
  var match;
  while ((match = re.exec(xml)) !== null) {
    if (match.index > lastIndex) {
      var text = xml.substring(lastIndex, match.index).trim();
      if (text) tokens.push({ type: 'text', value: text });
    }
    var tag = match[1];
    if (tag.startsWith('<?')) tokens.push({ type: 'decl', value: tag });
    else if (tag.startsWith('<!--')) tokens.push({ type: 'comment', value: tag });
    else if (tag.startsWith('<![CDATA[')) tokens.push({ type: 'cdata', value: tag });
    else if (tag.startsWith('</')) tokens.push({ type: 'close', value: tag });
    else if (tag.endsWith('/>')) tokens.push({ type: 'self', value: tag });
    else tokens.push({ type: 'open', value: tag });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < xml.length) {
    var tail = xml.substring(lastIndex).trim();
    if (tail) tokens.push({ type: 'text', value: tail });
  }
  return tokens;
}

function xmlBuildPretty(tokens, indent) {
  var lines = [];
  var depth = 0;
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
    } else if (t.type === 'open') {
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
    }
  }
  return lines.join('\\n');
}

function xmlBuildInline(tokens, indent) {
  
  
  var lines = [];
  var depth = 0;
  var i = 0;
  while (i < tokens.length) {
    var t = tokens[i];
    if (t.type === 'open') {
      
      if (i + 2 < tokens.length && tokens[i+1].type === 'text' && tokens[i+2].type === 'close') {
        
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      if (i + 3 < tokens.length && tokens[i+1].type === 'self' && tokens[i+2].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      
      if (i + 4 < tokens.length &&
          tokens[i+1].type === 'open' && tokens[i+2].type === 'text' &&
          tokens[i+3].type === 'close' && tokens[i+4].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value + tokens[i+3].value + tokens[i+4].value);
        i += 5;
        continue;
      }
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
      i++;
    } else if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    }
  }
  return lines.join('\\n');
}

function indentStr(depth, indent) {
  var s = '';
  for (var i = 0; i < depth; i++) s += indent;
  return s;
}

function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

function normalizeEpochMs(value) {
  var num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
}

function normalizeDurationMs(value) {
  var num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function pad3(value) {
  return String(value).padStart(3, '0');
}

function formatLocalTimestamp(epochMs) {
  var ms = normalizeEpochMs(epochMs);
  if (ms === null) return '';
  var date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return '';
  return date.getFullYear() + '-' +
    pad2(date.getMonth() + 1) + '-' +
    pad2(date.getDate()) + ' ' +
    pad2(date.getHours()) + ':' +
    pad2(date.getMinutes()) + ':' +
    pad2(date.getSeconds()) + '.' +
    pad3(date.getMilliseconds());
}

function formatLocalTime(epochMs) {
  var ms = normalizeEpochMs(epochMs);
  if (ms === null) return '';
  var date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return '';
  return pad2(date.getHours()) + ':' +
    pad2(date.getMinutes()) + ':' +
    pad2(date.getSeconds()) + '.' +
    pad3(date.getMilliseconds());
}

function isSameLocalDate(leftEpochMs, rightEpochMs) {
  var left = normalizeEpochMs(leftEpochMs);
  var right = normalizeEpochMs(rightEpochMs);
  if (left === null || right === null) return false;
  var leftDate = new Date(left);
  var rightDate = new Date(right);
  return leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate();
}

function formatResponseTimingValue(epochMs, pairedEpochMs) {
  var ms = normalizeEpochMs(epochMs);
  if (ms === null) return '';
  if (pairedEpochMs !== undefined && isSameLocalDate(ms, pairedEpochMs)) {
    return formatLocalTime(ms);
  }
  var date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return '';
  return pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + formatLocalTime(ms);
}

function formatDurationMs(durationMs) {
  var ms = normalizeDurationMs(durationMs);
  if (ms === null) return '';
  if (ms < 1000) return ms + ' ms';
  if (ms < 60000) return (ms / 1000).toFixed(3) + ' s';
  var minutes = Math.floor(ms / 60000);
  var remainder = ms % 60000;
  var seconds = Math.floor(remainder / 1000);
  var milliseconds = remainder % 1000;
  return minutes + 'm ' + pad2(seconds) + '.' + pad3(milliseconds) + 's';
}

function getResponseDurationMs(tab, fallbackTime) {
  var explicit = normalizeDurationMs(tab?.durationMs);
  if (explicit !== null) return explicit;
  var startedAt = normalizeEpochMs(tab?.requestStartedAt);
  var endedAt = normalizeEpochMs(tab?.requestEndedAt);
  if (startedAt !== null && endedAt !== null) {
    return Math.max(0, endedAt - startedAt);
  }
  return normalizeDurationMs(fallbackTime);
}

function applyResponseTiming(tab, msg) {
  if (!tab) return;
  var startedAt = normalizeEpochMs(msg?.requestStartedAt) ?? normalizeEpochMs(tab.requestStartedAt) ?? normalizeEpochMs(tab.sendTime);
  var endedAt = normalizeEpochMs(msg?.requestEndedAt) ?? Date.now();
  var durationMs = normalizeDurationMs(msg?.durationMs);
  if (durationMs === null && startedAt !== null && endedAt !== null) {
    durationMs = Math.max(0, endedAt - startedAt);
  }
  tab.requestStartedAt = startedAt;
  tab.requestEndedAt = endedAt;
  tab.durationMs = durationMs;
}

function buildResponseTimingMetaHtml(tab) {
  var startedAt = normalizeEpochMs(tab?.requestStartedAt);
  var endedAt = normalizeEpochMs(tab?.requestEndedAt);
  if (startedAt === null && endedAt === null) return '';
  var endedKey = tab?.response && tab?.lastEvent === 'success' ? 'webview.receivedAt' : 'webview.endedAt';
  var titleParts = [];
  if (startedAt !== null) {
    titleParts.push(tr('webview.requestedAt') + ' ' + formatLocalTimestamp(startedAt));
  }
  if (endedAt !== null) {
    titleParts.push(tr(endedKey) + ' ' + formatLocalTimestamp(endedAt));
  }
  var durationMs = getResponseDurationMs(tab, tab?.response?.time);
  if (durationMs !== null) {
    titleParts.push(String(durationMs) + ' ms');
  }
  var title = titleParts.length > 0 ? ' title="' + escapeAttr(titleParts.join(' / ')) + '"' : '';
  if (startedAt !== null && endedAt !== null) {
    return '<div class="response-timing-row"' + title + '><span class="timing-flow"><span class="timing-value">' + escapeHtml(formatResponseTimingValue(startedAt, endedAt)) + '</span><span class="timing-arrow" aria-hidden="true">\u2192</span><span class="timing-value">' + escapeHtml(formatResponseTimingValue(endedAt, startedAt)) + '</span></span></div>';
  }
  if (startedAt !== null) {
    return '<div class="response-timing-row"' + title + '><span class="timing-flow"><span class="timing-prefix">' + escapeHtml(tr('webview.requestedAt')) + '</span><span class="timing-value">' + escapeHtml(formatResponseTimingValue(startedAt)) + '</span></span></div>';
  }
  return '<div class="response-timing-row"' + title + '><span class="timing-flow"><span class="timing-prefix">' + escapeHtml(tr(endedKey)) + '</span><span class="timing-value">' + escapeHtml(formatResponseTimingValue(endedAt)) + '</span></span></div>';
}
function stringifyForHtml(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    if (typeof value === 'object') {
      var json = JSON.stringify(value);
      if (typeof json === 'string') return json;
    }
  } catch {}
  return String(value);
}
function escapeHtml(s) { return stringifyForHtml(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escapeAttr(s) { return stringifyForHtml(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function truncate(s, n) { return s.length > n ? s.substring(0, n-1) + '...' : s; }


function checkUnresolvedVars() {
  var urlEl = mainContent.querySelector('.js-url');
  var overlay = mainContent.querySelector('.js-var-overlay');
  if (!urlEl || !overlay) return;
  var val = urlEl.value || '';
  var re = /\\{\\{([^}]+)\\}\\}/g;
  var match;
  var unresolvedNames = [];
  while ((match = re.exec(val)) !== null) {
    var name = match[1].trim();
    if (activeVarKeys.indexOf(name) < 0) {
      unresolvedNames.push(name);
    }
  }
  if (unresolvedNames.length > 0) {
    var html = escapeHtml(val).replace(/\\{\\{([^}]+)\\}\\}/g, function(m, n) {
      if (unresolvedNames.indexOf(n.trim()) >= 0) {
        return '<span class="unresolved-var">' + m + '</span>';
      }
      return m;
    });
    overlay.innerHTML = html;
    overlay.classList.remove('hidden');
    
    overlay.scrollLeft = urlEl.scrollLeft;
  } else {
    overlay.innerHTML = '';
    overlay.classList.add('hidden');
  }
}

function collectVariablePreviewItems(text) {
  var value = String(text || '');
  var regex = /\{\{([^}]+)\}\}/g;
  var seen = {};
  var items = [];
  var match;
  while ((match = regex.exec(value)) !== null) {
    var name = (match[1] || '').trim();
    if (!name || seen[name]) continue;
    seen[name] = true;
    items.push({
      name: name,
      value: Object.prototype.hasOwnProperty.call(activeVarValues, name) ? String(activeVarValues[name] ?? '') : '',
      missing: activeVarKeys.indexOf(name) < 0
    });
  }
  return items;
}

function ensureVariablePreviewPopover() {
  if (variablePreviewPopover) return variablePreviewPopover;
  variablePreviewPopover = document.createElement('div');
  variablePreviewPopover.className = 'var-preview-popover hidden';
  document.body.appendChild(variablePreviewPopover);
  return variablePreviewPopover;
}

function hideVariablePreviewPopover() {
  if (!variablePreviewPopover) return;
  variablePreviewPopover.classList.add('hidden');
  variablePreviewPopover.innerHTML = '';
}

function syncVariablePreviewHints(scope) {
  scope?.querySelectorAll('input[type="text"], input[type="password"], textarea').forEach(function(field) {
    if (field.classList.contains('js-response-search')) {
      delete field.dataset.varPreview;
      delete field.dataset.varPreviewHtml;
      field.removeAttribute('title');
      return;
    }
    var items = collectVariablePreviewItems(field.value || '');
    if (!items.length) {
      delete field.dataset.varPreview;
      delete field.dataset.varPreviewHtml;
      field.removeAttribute('title');
      return;
    }

    var previewText = items.map(function(item) {
      return '{{' + item.name + '}} → ' + (item.missing ? tr('webview.variablePreviewMissing') : item.value);
    }).join('\\n');
    var previewHtml = '<div class="var-preview-title">' + escapeHtml(tr('webview.variablePreviewTitle')) + '</div>' +
      items.map(function(item) {
        return '<div class="var-preview-line">' +
          '<span class="var-preview-name">{{' + escapeHtml(item.name) + '}}</span>' +
          '<span class="var-preview-value' + (item.missing ? ' missing' : '') + '">' + escapeHtml(item.missing ? tr('webview.variablePreviewMissing') : item.value) + '</span>' +
        '</div>';
      }).join('');

    field.dataset.varPreview = previewText;
    field.dataset.varPreviewHtml = previewHtml;
    field.title = previewText;
  });
}

function showVariablePreviewPopover(target) {
  if (!target?.dataset?.varPreviewHtml) {
    hideVariablePreviewPopover();
    return;
  }

  var popover = ensureVariablePreviewPopover();
  popover.innerHTML = target.dataset.varPreviewHtml;
  popover.classList.remove('hidden');
  var rect = target.getBoundingClientRect();
  var top = Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom + 8);
  var left = Math.min(window.innerWidth - popover.offsetWidth - 12, rect.left);
  popover.style.top = Math.max(12, top) + 'px';
  popover.style.left = Math.max(12, left) + 'px';
}

function isVariableAutocompleteField(target) {
  if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (target.disabled || target.readOnly) return false;
  if (target.classList.contains('js-response-search')) return false;
  if (target.type && ['checkbox', 'number', 'hidden'].indexOf(target.type) >= 0) return false;
  return true;
}

function getVariableAutocompleteContext(target) {
  if (!isVariableAutocompleteField(target)) return null;
  if (typeof target.selectionStart !== 'number' || typeof target.selectionEnd !== 'number') return null;
  if (target.selectionStart !== target.selectionEnd) return null;
  var value = String(target.value || '');
  var caret = target.selectionStart;
  var before = value.slice(0, caret);
  var openIndex = before.lastIndexOf('{{');
  if (openIndex < 0) return null;
  if (before.indexOf('}}', openIndex) >= 0) return null;
  var partial = before.slice(openIndex + 2);
  var cr = String.fromCharCode(13);
  var lf = String.fromCharCode(10);
  var tab = String.fromCharCode(9);
  if (partial.indexOf('{') >= 0 || partial.indexOf('}') >= 0) return null;
  if (partial.indexOf(cr) >= 0 || partial.indexOf(lf) >= 0) return null;
  if (partial.indexOf(' ') >= 0 || partial.indexOf(tab) >= 0) return null;
  var replaceEnd = caret;
  if (value.slice(caret, caret + 2) === '}}') {
    replaceEnd += 2;
  }
  return {
    start: openIndex,
    end: replaceEnd,
    query: partial,
  };
}

function getVariableAutocompleteSuggestions(query) {
  var needle = String(query || '').toLowerCase();
  var exactPrefix = [];
  var fuzzy = [];
  activeVarKeys.forEach(function(name) {
    var lowered = String(name || '').toLowerCase();
    if (!needle || lowered.indexOf(needle) === 0) {
      exactPrefix.push(name);
      return;
    }
    if (lowered.indexOf(needle) >= 0) {
      fuzzy.push(name);
    }
  });
  return exactPrefix.concat(fuzzy).slice(0, 10).map(function(name) {
    return {
      name: name,
      value: Object.prototype.hasOwnProperty.call(activeVarValues, name) ? String(activeVarValues[name] ?? '') : '',
    };
  });
}

function ensureVariableAutocompletePopover() {
  if (variableAutocompletePopover) return variableAutocompletePopover;
  variableAutocompletePopover = document.createElement('div');
  variableAutocompletePopover.className = 'var-autocomplete hidden';
  variableAutocompletePopover.addEventListener('mousedown', function(event) {
    var item = event.target.closest('.js-var-autocomplete-item');
    if (!item) return;
    event.preventDefault();
    applyVariableAutocompleteSelection(Number(item.dataset.index || 0));
  });
  document.body.appendChild(variableAutocompletePopover);
  return variableAutocompletePopover;
}

function hideVariableAutocomplete() {
  if (variableAutocompletePopover) {
    variableAutocompletePopover.classList.add('hidden');
    variableAutocompletePopover.innerHTML = '';
  }
  variableAutocompleteState = null;
}

function positionVariableAutocomplete(target) {
  if (!variableAutocompletePopover || !target) return;
  var rect = target.getBoundingClientRect();
  var top = Math.min(window.innerHeight - variableAutocompletePopover.offsetHeight - 12, rect.bottom + 8);
  var left = Math.min(window.innerWidth - variableAutocompletePopover.offsetWidth - 12, rect.left);
  variableAutocompletePopover.style.top = Math.max(12, top) + 'px';
  variableAutocompletePopover.style.left = Math.max(12, left) + 'px';
}

function renderVariableAutocomplete() {
  if (!variableAutocompleteState) {
    hideVariableAutocomplete();
    return;
  }
  var popover = ensureVariableAutocompletePopover();
  var suggestions = variableAutocompleteState.suggestions || [];
  var listHtml = suggestions.length
    ? suggestions.map(function(item, index) {
        return '<button class="var-autocomplete-item js-var-autocomplete-item' + (index === variableAutocompleteState.activeIndex ? ' active' : '') + '" type="button" data-index="' + index + '">' +
          '<span class="var-autocomplete-key">{{' + escapeHtml(item.name) + '}}</span>' +
          '<span class="var-autocomplete-value">' + escapeHtml(item.value || '') + '</span>' +
        '</button>';
      }).join('')
    : '<div class="var-autocomplete-empty">' + escapeHtml(tr('webview.variableAutocompleteEmpty')) + '</div>';
  popover.innerHTML =
    '<div class="var-autocomplete-title">' + escapeHtml(tr('webview.variableAutocompleteTitle')) + '</div>' +
    '<div class="var-autocomplete-list">' + listHtml + '</div>';
  popover.classList.remove('hidden');
  positionVariableAutocomplete(variableAutocompleteState.target);
}

function syncVariableAutocomplete(target) {
  if (!isVariableAutocompleteField(target)) {
    hideVariableAutocomplete();
    return;
  }
  var context = getVariableAutocompleteContext(target);
  if (!context) {
    hideVariableAutocomplete();
    return;
  }
  variableAutocompleteState = {
    target: target,
    context: context,
    suggestions: getVariableAutocompleteSuggestions(context.query),
    activeIndex: 0,
  };
  renderVariableAutocomplete();
}

function moveVariableAutocomplete(delta) {
  if (!variableAutocompleteState || !variableAutocompleteState.suggestions.length) return;
  var total = variableAutocompleteState.suggestions.length;
  variableAutocompleteState.activeIndex = (variableAutocompleteState.activeIndex + delta + total) % total;
  renderVariableAutocomplete();
}

function applyVariableAutocompleteSelection(index) {
  if (!variableAutocompleteState) return false;
  var target = variableAutocompleteState.target;
  var suggestions = variableAutocompleteState.suggestions || [];
  if (!target || !suggestions.length) return false;
  var next = suggestions[index];
  if (!next) return false;
  var context = getVariableAutocompleteContext(target) || variableAutocompleteState.context;
  if (!context) return false;
  var token = '{{' + next.name + '}}';
  var value = String(target.value || '');
  target.value = value.slice(0, context.start) + token + value.slice(context.end);
  var nextCaret = context.start + token.length;
  target.setSelectionRange(nextCaret, nextCaret);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  hideVariableAutocomplete();
  return true;
}

function handleVariableAutocompleteKeydown(event) {
  if (!variableAutocompleteState || variableAutocompleteState.target !== event.target) return false;
  if (event.key === 'Escape') {
    hideVariableAutocomplete();
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (!variableAutocompleteState.suggestions.length) return false;
  if (event.key === 'ArrowDown') {
    moveVariableAutocomplete(1);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.key === 'ArrowUp') {
    moveVariableAutocomplete(-1);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    if (applyVariableAutocompleteSelection(variableAutocompleteState.activeIndex || 0)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  }
  return false;
}


function persistTabState() {
    saveActiveTabState();
    var tabData = tabs.map(function(t) {
    return Object.assign({ name: t.name, autoName: !!t.autoName, requestType: normalizeRequestType(t.requestType, t.url), requestEditorTab: normalizeRequestEditorTab(t.requestEditorTab), requestSplitHeightPx: normalizeRequestSplitHeight(t.requestSplitHeightPx) || undefined, method: t.method, url: t.url, headers: t.headers, params: t.params, body: t.body, bodyType: t.bodyType, formData: t.formData || [], binaryFilePath: t.binaryFilePath || '', auth: t.auth, scripts: t.scripts || { preRequest: '', test: '' }, jsonFormatStyle: t.jsonFormatStyle, xmlFormatStyle: t.xmlFormatStyle, formatIndent: t.formatIndent, responseSearchQuery: t.responseSearchQuery || '', responseSearchIndex: typeof t.responseSearchIndex === 'number' ? t.responseSearchIndex : 0, responseSearchCaseSensitive: t.responseSearchCaseSensitive === true, responseSearchRegex: t.responseSearchRegex === true, scriptHelpCollapsed: t.scriptHelpCollapsed === true, pinned: t.pinned || false, requestId: t.requestId || undefined }, requestSettingsSnapshot(t));
    });
  var activeIdx = tabs.findIndex(function(t) { return t.id === activeTabId; });
  vscode.postMessage({ type: 'saveTabState', tabs: tabData, activeIndex: Math.max(0, activeIdx), compareSettings: cloneCompareSettings(compareSettings) });
}


var _persistTimer = null;
var variablePreviewPopover = null;
var variableAutocompletePopover = null;
var variableAutocompleteState = null;
function debouncePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistTabState, 1000);
}


createTab();


vscode.postMessage({ type: 'webviewReady' });
</script>
<script nonce="${nonce}" src="${bodyConversionUri}"></script>
<script nonce="${nonce}" src="${hljsUri}"></script>
</body>
</html>`;
}
