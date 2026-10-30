export type HtmlPreviewTranslationKey =
  | 'webview.preview'
  | 'webview.previewOfflineTitle'
  | 'webview.previewOfflineCopy'
  | 'webview.previewOfflineSource'
  | 'webview.previewOfflineDescription'
  | 'webview.previewOfflineBlockedAssets'
  | 'webview.previewOfflineStaticSnapshot'
  | 'webview.previewOfflineNoStatic';

export interface HtmlPreviewLocale {
  displayLanguage: string;
  translate: (key: HtmlPreviewTranslationKey) => string;
  format: (key: HtmlPreviewTranslationKey, params: Record<string, string>) => string;
}

export interface HtmlPreviewPayload {
  docLang: string;
  title: string;
  description: string;
  bodyHtml: string;
  blockedAssets: number;
  hasStaticSnapshot: boolean;
}

export interface HtmlPreviewTab {
  url?: string;
  resolvedUrl?: string;
  response?: { status?: number; size?: number; body?: string };
}

function isPreviewSafeUrl(value: string): boolean {
  return value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:');
}

function isPreviewUrlAttribute(name: string): boolean {
  return ['src', 'href', 'xlink:href', 'srcset', 'poster', 'action', 'formaction', 'background', 'ping'].includes(name);
}

export function countPreviewExternalAssets(doc: Document): number {
  let count = 0;
  doc.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (!isPreviewUrlAttribute(name)) return;
      const value = attribute.value.trim();
      if (!value || (name !== 'ping' && isPreviewSafeUrl(value))) return;
      count += 1;
    });
  });
  return count;
}

export function sanitizePreviewDocument(doc: Document): void {
  doc.querySelectorAll('script, style, noscript, iframe, object, embed, link, source, audio, video, track, base, set, animate, meta[http-equiv="refresh"]').forEach((node) => {
    node.remove();
  });
  doc.querySelectorAll('*').forEach((element) => {
    // 속성을 지울 때 NamedNodeMap도 바뀌므로 복사본에서 인접 이벤트 속성을 모두 지운다.
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || name === 'style' || name === 'srcset' || name === 'ping') {
        element.removeAttribute(attribute.name);
      } else if (isPreviewUrlAttribute(name) && value && !isPreviewSafeUrl(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function collapseWhitespace(text: string): string {
  return text.split(/[ \r\n\t\f]+/).filter(Boolean).join(' ');
}

function extractPreviewDescription(doc: Document): string {
  const meta = doc.querySelector('meta[name="description"], meta[property="og:description"]');
  const content = meta?.getAttribute('content');
  if (content) return content.trim();
  const text = collapseWhitespace(doc.body?.textContent || '');
  return text.length > 220 ? text.substring(0, 219) + '...' : text;
}

// DOMParser가 만든 비활성 문서를 정제한 뒤에만 HTML snapshot을 반환한다.
export function buildPreviewPayload(doc: Document, locale: HtmlPreviewLocale): HtmlPreviewPayload {
  const blockedAssets = countPreviewExternalAssets(doc);
  sanitizePreviewDocument(doc);
  const bodyHtml = doc.body?.innerHTML.trim() || '';
  const bodyText = collapseWhitespace(doc.body?.textContent || '');
  return {
    docLang: doc.documentElement?.getAttribute('lang') || locale.displayLanguage || 'en',
    title: doc.querySelector('title')?.textContent?.trim() || locale.translate('webview.preview'),
    description: extractPreviewDescription(doc),
    bodyHtml,
    blockedAssets,
    hasStaticSnapshot: Boolean(bodyHtml) && bodyText.length >= 24,
  };
}

function parsePreviewPayload(rawHtml: string, locale: HtmlPreviewLocale): HtmlPreviewPayload {
  return buildPreviewPayload(new DOMParser().parseFromString(rawHtml || '', 'text/html'), locale);
}

export function hasMeaningfulStaticPreview(rawHtml: string, locale: HtmlPreviewLocale): boolean {
  return parsePreviewPayload(rawHtml, locale).hasStaticSnapshot;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderPreviewDocument(payload: HtmlPreviewPayload, resolvedUrl: string, locale: HtmlPreviewLocale): string {
  const tr = locale.translate;
  const blockedAssetsLabel = locale.format('webview.previewOfflineBlockedAssets', { count: String(payload.blockedAssets) });
  return '<div class="preview-shell" lang="' + escapeHtml(payload.docLang) + '">' +
    '<div class="preview-kicker">' + escapeHtml(tr('webview.previewOfflineTitle')) + '</div>' +
    '<h1 class="preview-title">' + escapeHtml(payload.title) + '</h1>' +
    '<p class="preview-copy">' + escapeHtml(tr('webview.previewOfflineCopy')) + '</p>' +
    '<div class="preview-grid">' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineSource')) + '</div>' +
        '<div class="preview-card-value">' + escapeHtml(resolvedUrl || '') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(tr('webview.previewOfflineDescription')) + '</div>' +
        '<div class="preview-card-value' + (payload.description ? '' : ' muted') + '">' + escapeHtml(payload.description || '-') + '</div>' +
      '</div>' +
      '<div class="preview-card">' +
        '<div class="preview-card-label">' + escapeHtml(blockedAssetsLabel) + '</div>' +
        '<div class="preview-card-value" data-testid="preview-blocked-assets">' + escapeHtml(String(payload.blockedAssets)) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="preview-section">' +
      '<div class="preview-section-title">' + escapeHtml(tr('webview.previewOfflineStaticSnapshot')) + '</div>' +
      (payload.hasStaticSnapshot
        ? '<div class="preview-snapshot">' + payload.bodyHtml + '</div>'
        : '<div class="preview-empty">' + escapeHtml(tr('webview.previewOfflineNoStatic')) + '</div>') +
    '</div>' +
  '</div>';
}

export function buildPreviewDocument(rawHtml: string, resolvedUrl: string, locale: HtmlPreviewLocale): string {
  return renderPreviewDocument(parsePreviewPayload(rawHtml, locale), resolvedUrl, locale);
}

export function buildPreviewDocKey(tab: HtmlPreviewTab | null | undefined): string {
  if (!tab?.response) return '';
  const body = tab.response.body || '';
  return [
    tab.response.status || 0,
    tab.response.size || 0,
    tab.resolvedUrl || tab.url || '',
    body.length,
    body.slice(0, 120),
  ].join('|');
}

export function syncPreviewFrame(preview: HTMLElement | null, tab: HtmlPreviewTab | null | undefined, locale: HtmlPreviewLocale): void {
  if (!preview || !tab?.response) return;
  const key = buildPreviewDocKey(tab);
  if (preview.dataset.previewKey === key) return;
  preview.innerHTML = buildPreviewDocument(tab.response.body || '', tab.resolvedUrl || tab.url || '', locale);
  preview.dataset.previewKey = key;
}
