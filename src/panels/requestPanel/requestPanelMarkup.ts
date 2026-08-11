import { DisplayLanguage, LocalizationService } from '../../services/LocalizationService';

export interface RequestPanelMarkupInput {
  displayLanguage: DisplayLanguage;
}

export function getRequestPanelMarkup(input: RequestPanelMarkupInput): string {
  const { displayLanguage } = input;
  return /*html*/ `


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
`;
}
