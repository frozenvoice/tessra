/** Request panel webview CSS (hljs theme + Quiet Instrument shell). */
export function getRequestPanelStyles(): string {
  return /*css*/ `

pre code.hljs{display:block;overflow-x:auto;padding:0}code.hljs{padding:0}.hljs{background:transparent;color:var(--vscode-editor-foreground)}.hljs-keyword,.hljs-literal,.hljs-name,.hljs-symbol{color:var(--vscode-debugTokenExpression-name,var(--vscode-charts-blue,#569cd6))}.hljs-link{color:var(--vscode-textLink-foreground,#569cd6);text-decoration:underline}.hljs-built_in,.hljs-type{color:var(--vscode-charts-green,#4ec9b0)}.hljs-class,.hljs-number{color:var(--vscode-debugTokenExpression-number,var(--vscode-charts-green,#b8d7a3))}.hljs-meta .hljs-string,.hljs-string{color:var(--vscode-debugTokenExpression-string,var(--vscode-charts-orange,#d69d85))}.hljs-regexp,.hljs-template-tag{color:var(--vscode-debugTokenExpression-error,var(--vscode-errorForeground,#9a5334))}.hljs-formula,.hljs-function,.hljs-params,.hljs-subst,.hljs-title{color:var(--vscode-editor-foreground)}.hljs-comment,.hljs-quote{color:var(--vscode-descriptionForeground);font-style:italic}.hljs-doctag{color:var(--vscode-descriptionForeground)}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:var(--vscode-descriptionForeground)}.hljs-template-variable,.hljs-variable{color:var(--vscode-symbolIcon-variableForeground,var(--vscode-charts-purple,#bd63c5))}.hljs-attr,.hljs-attribute{color:var(--vscode-debugTokenExpression-name,var(--vscode-charts-blue,#9cdcfe))}.hljs-section{color:var(--vscode-charts-yellow,#d7ba7d)}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:var(--vscode-charts-yellow,#d7ba7d)}.hljs-addition{background-color:color-mix(in srgb,var(--vscode-charts-green,#4ec94e) 18%,transparent);display:inline-block;width:100%}.hljs-deletion{background-color:color-mix(in srgb,var(--vscode-errorForeground,#f44) 18%,transparent);display:inline-block;width:100%}
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
.path-variables{flex-shrink:0;padding:2px 8px 6px;border-bottom:1px solid var(--vscode-panel-border,#444)}
.path-variables-head{display:flex;align-items:center;gap:8px;min-height:18px;margin-bottom:2px}
.path-variables-title{font-size:11px;font-weight:600;letter-spacing:0.02em;color:var(--vscode-descriptionForeground);text-transform:none}
.path-variables-rows{display:flex;flex-direction:column;gap:2px}
.path-var-row{display:grid;grid-template-columns:minmax(72px,140px) minmax(0,1fr) auto auto;gap:6px;align-items:center;min-width:0}
.path-var-key{font-family:var(--vscode-editor-font-family,monospace);font-size:12px;color:var(--vscode-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.path-var-value-wrap{min-width:0;display:flex;flex-direction:column;gap:1px}
.path-var-input,.path-var-readonly{width:100%;min-width:0;height:26px;padding:0 8px;box-sizing:border-box;border-radius:2px;font-size:12px;font-family:var(--vscode-editor-font-family,monospace)}
.path-var-input{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent)}
.path-var-input:focus{outline:1px solid var(--vscode-focusBorder)}
.path-var-readonly{display:flex;align-items:center;background:transparent;color:var(--vscode-foreground);border:1px solid transparent;opacity:0.92}
.path-var-env-hint{font-size:10px;line-height:1.2;color:var(--vscode-descriptionForeground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.path-var-meta{font-size:11px;color:var(--vscode-descriptionForeground);white-space:nowrap}
.path-var-action{height:26px;padding:0 8px;font-size:11px;flex-shrink:0}
.path-var-action-spacer{width:52px;height:26px;flex-shrink:0}
@media (max-width: 720px){
  .path-var-row{grid-template-columns:minmax(64px,110px) minmax(0,1fr) auto;grid-template-areas:"key value action" "key meta action"}
  .path-var-key{grid-area:key}
  .path-var-value-wrap{grid-area:value}
  .path-var-meta{grid-area:meta}
  .path-var-action,.path-var-action-spacer{grid-area:action}
}
.url-bar{display:flex;flex-wrap:wrap;gap:6px;padding:4px 8px;flex-shrink:0;align-items:center;position:relative;overflow:visible;border-bottom:1px solid var(--vscode-panel-border,#444)}
.url-primary-group{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 200px}
.url-action-group{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex:0 0 auto;margin-left:auto}
.url-bar select{width:100px;height:28px;padding:0 8px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border);border-radius:2px;font-size:13px;font-weight:600}
.url-bar input{flex:1;height:28px;padding:0 8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;font-size:13px;font-family:var(--vscode-editor-font-family,monospace)}
.url-bar input:focus{outline:1px solid var(--vscode-focusBorder)}
.url-input-wrap{position:relative;flex:1 1 200px;min-width:120px;display:flex}
.url-input-wrap input{flex:1;width:100%}
.url-hero-actions{display:flex;align-items:stretch;justify-content:flex-end;flex:0 0 auto}
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
.var-preview-source{margin-left:6px;font-size:11px;color:var(--vscode-descriptionForeground,#a8a8a8);white-space:nowrap}
.resolved-var{color:transparent;text-decoration:none}
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
/* Text Body modes: textarea is the sole vertical scroll owner (no panel + textarea double scroll). */
.js-body-panel.request-editor-panel.is-text-body:not(.hidden){overflow:hidden;min-height:0}
.js-body-panel.is-text-body .body-type-select{flex:0 0 auto}
.js-body-panel.is-text-body .body-editor{display:flex;flex-direction:column;flex:1 1 0;min-height:70px;min-width:0;height:auto !important;max-height:none}
.js-body-panel.is-text-body .body-editor .js-body{flex:1 1 auto;min-height:70px;height:100% !important;max-height:none;overflow:auto;scrollbar-gutter:stable}
.js-body-panel.is-text-body .body-highlight{overflow:hidden !important;scrollbar-gutter:stable}
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
.kv-column-headings{display:flex;gap:3px;align-items:center;margin-bottom:4px;color:var(--vscode-descriptionForeground);font-size:11px}
.kv-column-headings .kv-column-label{flex:1;min-width:0;padding:0 5px}
.kv-column-check{width:20px;flex:none}
.kv-column-action{width:16px;flex:none}
.request-editor-panel .kv-row input[type="text"],.request-editor-panel .kv-row input[type="password"]{min-width:0}
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
.actions-more-menu{display:none;position:absolute;top:calc(100% + 4px);right:0;z-index:120;background:var(--vscode-dropdown-background,#252526);border:1px solid var(--vscode-dropdown-border,#555);border-radius:6px;padding:4px 0;min-width:180px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.42);max-width:calc(100vw - 12px);box-sizing:border-box}
.actions-more-menu.open{display:block}
.actions-more-menu.actions-more-menu-fixed{position:fixed;right:auto;bottom:auto}
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
.jt-row{display:flex;align-items:baseline;white-space:nowrap;gap:0;padding:2px 4px;border-radius:2px;transition:background .12s ease}
.jt-row[data-copy-path]{cursor:pointer}
.jt-row:hover{background:rgba(255,255,255,.04)}
.copy-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);z-index:9999;padding:8px 14px;border-radius:8px;background:rgba(20,24,31,.96);border:1px solid rgba(87,166,255,.35);color:var(--vscode-foreground);font-size:13px;font-family:var(--vscode-editor-font-family,monospace);box-shadow:0 12px 28px rgba(0,0,0,.4),0 0 0 1px rgba(87,166,255,.12);pointer-events:none;opacity:0;transition:opacity .18s ease,transform .18s ease;max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.copy-toast.visible{opacity:1;transform:translateX(-50%) translateY(0)}
.jt-toggle{display:inline-flex;align-items:center;justify-content:center;width:18px;height:20px;margin-right:4px;padding:0;border:none;background:transparent;color:var(--vscode-foreground);flex-shrink:0;user-select:none}
.jt-toggle[aria-expanded]{cursor:pointer;opacity:.8}
.jt-toggle .jt-chevron{display:inline-block;font-size:18px;line-height:1;transform:rotate(90deg)}
.jt-toggle[aria-expanded="false"] .jt-chevron{transform:rotate(0deg)}
.jt-toggle:focus-visible{outline:1px solid var(--vscode-focusBorder);outline-offset:1px}
.jt-separator{white-space:pre}
.jt-toggle:hover{opacity:1}
.jt-copy-path{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:2px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:var(--vscode-descriptionForeground,#bdbdbd);font-size:10px;letter-spacing:.02em;cursor:pointer;opacity:0;transition:opacity .12s ease,transform .12s ease;border:none}
.jt-row:hover .jt-copy-path,.jt-copy-path:focus{opacity:1}
.jt-copy-path:hover{transform:none;background:rgba(87,166,255,.12);color:#93c8ff}
.jt-key{color:#9cdcfe}
.jt-copy-path{margin-left:8px}
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
.url-bar{margin:0;padding:4px 8px;border-radius:0;border:none;border-bottom:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));background:transparent;box-shadow:none;display:flex;flex-wrap:wrap;gap:6px;align-items:center;position:relative;overflow:visible}
.url-primary-group{padding:0;border-radius:0;background:transparent;box-shadow:none}
.url-action-group{padding:0;border-radius:0;background:transparent;box-shadow:none}
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
.default-headers-oneline .js-open-default-headers{flex-shrink:0;white-space:nowrap}
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
.actions-more-menu{display:none;position:absolute;top:calc(100% + 4px);right:0;z-index:120;background:var(--vscode-dropdown-background);border:1px solid var(--tessra-border-soft,var(--vscode-panel-border,#444));border-radius:var(--tessra-radius-sm);box-shadow:0 2px 8px rgba(0,0,0,.28);min-width:180px;padding:4px 0;max-width:calc(100vw - 12px);box-sizing:border-box}
.actions-more-menu.open{display:block}
.actions-more-menu.actions-more-menu-fixed{position:fixed;right:auto;bottom:auto}
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

/* SSE의 이벤트 보관은 전송 상태와 분리하며 각 표시 패널만 스크롤한다. */
.sse-view{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;overflow:hidden;padding:8px 12px;gap:6px}
.sse-summary{display:flex;align-items:baseline;flex-wrap:wrap;gap:12px;font-variant-numeric:tabular-nums}
.js-sse-http-status{font-weight:600}.js-sse-state{color:var(--vscode-descriptionForeground)}
.sse-counts,.sse-loss{font-size:11px;line-height:1.5;overflow-wrap:anywhere;color:var(--vscode-descriptionForeground)}
.sse-loss:empty{display:none}.sse-loss:not(:empty){color:var(--vscode-editorWarning-foreground,var(--vscode-foreground))}
.sse-toolbar{flex-shrink:0}.sse-events,.sse-raw{flex:1;min-height:0;overflow:auto;margin:0;padding:0;font-family:var(--vscode-editor-font-family,monospace)}
.sse-event{padding:8px 0;border-bottom:1px solid var(--vscode-panel-border);min-width:0}
.sse-event-meta{font-size:11px;color:var(--vscode-descriptionForeground);overflow-wrap:anywhere}
.sse-event-data,.sse-raw{font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.sse-event-data{margin:4px 0 0}.sse-view .hidden{display:none}
.runner-sse-response{padding:8px 14px;border-top:1px solid var(--vscode-panel-border);font-size:12px;line-height:1.5}
.runner-sse-events{max-height:180px;overflow:auto;font-family:var(--vscode-editor-font-family,monospace)}

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
`;
}
