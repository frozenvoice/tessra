import * as assert from 'assert';
import {
  buildPreviewDocKey,
  buildPreviewDocument,
  buildPreviewPayload,
  countPreviewExternalAssets,
  hasMeaningfulStaticPreview,
  HtmlPreviewLocale,
  renderPreviewDocument,
  sanitizePreviewDocument,
  syncPreviewFrame,
} from '../../webview/htmlPreview';

class PreviewElement {
  readonly attributes: Array<{ name: string; value: string }>;
  removed = false;

  constructor(attributes: Record<string, string>, readonly tagName = 'img') {
    this.attributes = Object.entries(attributes).map(([name, value]) => ({ name, value }));
  }

  removeAttribute(name: string): void {
    const index = this.attributes.findIndex((attribute) => attribute.name === name);
    if (index >= 0) this.attributes.splice(index, 1);
  }

  getAttribute(name: string): string | null {
    return this.attributes.find((attribute) => attribute.name === name)?.value ?? null;
  }

  remove(): void {
    this.removed = true;
  }
}

interface PreviewDocumentOptions {
  lang?: string;
  title?: string;
  description?: string;
  bodyHtml?: string;
  bodyText?: string;
}

function previewDocument(elements: PreviewElement[], options: PreviewDocumentOptions = {}): Document {
  return {
    documentElement: { getAttribute: (name: string) => name === 'lang' ? options.lang ?? null : null },
    body: { innerHTML: options.bodyHtml ?? '', textContent: options.bodyText ?? '' },
    querySelector(selector: string) {
      if (selector === 'title') return { textContent: options.title ?? '' };
      if (options.description !== undefined && selector.startsWith('meta[name=')) {
        return { getAttribute: () => options.description };
      }
      return null;
    },
    querySelectorAll(selector: string) {
      const remaining = elements.filter((element) => !element.removed);
      if (selector === '*') return remaining;
      const selectors = selector.split(',').map((value) => value.trim());
      return remaining.filter((element) => selectors.some((value) => {
        const match = value.match(/^([a-z]+)(?:\[([^=]+)="([^"]+)"\])?$/);
        return match?.[1] === element.tagName && (!match[2] || element.getAttribute(match[2]) === match[3]);
      }));
    },
  } as unknown as Document;
}

function previewLocale(displayLanguage = 'en'): HtmlPreviewLocale {
  return {
    displayLanguage,
    translate: (key) => `${displayLanguage}:${key}`,
    format: (key, params) => `${displayLanguage}:${key}:${params.count}`,
  };
}

function withPreviewParser<T>(doc: Document, run: (calls: Array<{ html: string; type: string }>) => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  const calls: Array<{ html: string; type: string }> = [];
  class PreviewParser {
    parseFromString(html: string, type: string): Document {
      calls.push({ html, type });
      return doc;
    }
  }
  Object.defineProperty(globalThis, 'DOMParser', { configurable: true, value: PreviewParser });
  try {
    return run(calls);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'DOMParser', descriptor);
    else Reflect.deleteProperty(globalThis, 'DOMParser');
  }
}

describe('HTML preview sanitization', () => {
  it('removes consecutive event attributes from a live attribute list', () => {
    const element = new PreviewElement({
      onclick: 'attack()', onmouseover: 'attack()', onfocus: 'attack()',
      style: 'background:url(https://outside.invalid/style)',
      srcset: 'https://outside.invalid/image 2x',
      ping: '#local-section https://outside.invalid/ping',
      title: 'A useful static image', src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///w==',
    });
    sanitizePreviewDocument(previewDocument([element]));
    assert.deepStrictEqual(element.attributes.map((attribute) => attribute.name), ['title', 'src']);
  });

  it('removes every external URL attribute, including SVG links and HTML background/ping', () => {
    const names = ['src', 'href', 'srcset', 'poster', 'action', 'formaction', 'xlink:href', 'background', 'ping'];
    const elements = names.map((name) => new PreviewElement({ [name]: 'https://outside.invalid/resource' }));
    const doc = previewDocument(elements);
    sanitizePreviewDocument(doc);
    for (let index = 0; index < names.length; index += 1) {
      assert.strictEqual(elements[index].getAttribute(names[index]), null, `${names[index]} must not survive`);
    }
  });

  it('counts external URL attributes consistently with sanitization', () => {
    const external = ['http://outside.invalid/', '//outside.invalid/image', '/relative/image', 'javascript:attack()'];
    const elements = external.map((value) => new PreviewElement({ src: value }));
    elements.push(new PreviewElement({ 'xlink:href': 'https://outside.invalid/svg' }));
    elements.push(new PreviewElement({ background: 'https://outside.invalid/background' }));
    elements.push(new PreviewElement({ href: '#local-section', ping: 'https://outside.invalid/ping' }));
    elements.push(new PreviewElement({ src: 'data:image/png;base64,AAAA' }));
    const doc = previewDocument(elements);
    assert.strictEqual(countPreviewExternalAssets(doc), 7);
    sanitizePreviewDocument(doc);
    assert.strictEqual(countPreviewExternalAssets(doc), 0);
  });

  it('preserves local fragment links, data images, and harmless static attributes', () => {
    const attributes: Array<Record<string, string>> = [
      { href: '#local-section', title: 'Jump to local content' },
      { 'xlink:href': '#local-section' },
      { src: 'data:image/png;base64,AAAA', alt: 'Embedded image' },
      { src: 'blob:local-image' },
    ];
    const elements = attributes.map((value) => new PreviewElement(value));
    const doc = previewDocument(elements);
    assert.strictEqual(countPreviewExternalAssets(doc), 0);
    sanitizePreviewDocument(doc);
    assert.deepStrictEqual(elements.map((element) => Object.fromEntries(element.attributes.map(({ name, value }) => [name, value]))), attributes);
  });

  it('removes active content and SVG URL animations without removing static elements', () => {
    const tags = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'link', 'source', 'audio', 'video', 'track', 'base', 'set', 'animate'];
    const unsafe = tags.map((tag) => new PreviewElement({}, tag));
    const refresh = new PreviewElement({ 'http-equiv': 'refresh' }, 'meta');
    const paragraph = new PreviewElement({ id: 'local-section' }, 'p');
    const image = new PreviewElement({ src: 'data:image/png;base64,AAAA' });
    sanitizePreviewDocument(previewDocument([...unsafe, refresh, paragraph, image]));
    assert.ok(unsafe.every((element) => element.removed));
    assert.strictEqual(refresh.removed, true);
    assert.strictEqual(paragraph.removed, false);
    assert.strictEqual(image.removed, false);
  });
});

describe('HTML preview browser module', () => {
  it('extracts document metadata and counts blocked resources before sanitizing', () => {
    const image = new PreviewElement({ src: 'https://outside.invalid/image' });
    const doc = previewDocument([image], {
      lang: 'ja', title: '  Static document  ', description: '  Useful summary  ',
      bodyHtml: '  <p>A sufficiently long static response.</p>  ', bodyText: 'A sufficiently long static response.',
    });
    const payload = buildPreviewPayload(doc, previewLocale('ko'));
    assert.deepStrictEqual(payload, {
      docLang: 'ja', title: 'Static document', description: 'Useful summary',
      bodyHtml: '<p>A sufficiently long static response.</p>', blockedAssets: 1, hasStaticSnapshot: true,
    });
    assert.strictEqual(image.getAttribute('src'), null);
  });

  it('uses the supplied display language and collapses response whitespace for fallback metadata', () => {
    const doc = previewDocument([], { title: '  ', bodyHtml: '<p>one two three</p>', bodyText: ' \r\n one\t two\f three  ' });
    const payload = buildPreviewPayload(doc, previewLocale('ko'));
    assert.strictEqual(payload.docLang, 'ko');
    assert.strictEqual(payload.title, 'ko:webview.preview');
    assert.strictEqual(payload.description, 'one two three');
    assert.strictEqual(payload.hasStaticSnapshot, false);
    const longDoc = previewDocument([], { bodyHtml: '<p>long response</p>', bodyText: 'x'.repeat(221) });
    assert.strictEqual(buildPreviewPayload(longDoc, previewLocale()).description, 'x'.repeat(219) + '...');
  });

  it('parses HTML in the browser boundary and keeps the meaningful-content threshold', () => {
    for (const length of [23, 24]) {
      const doc = previewDocument([], { bodyHtml: '<p>Static content</p>', bodyText: 'x'.repeat(length) });
      withPreviewParser(doc, (calls) => {
        assert.strictEqual(hasMeaningfulStaticPreview('<p>real response input</p>', previewLocale()), length === 24);
        assert.deepStrictEqual(calls, [{ html: '<p>real response input</p>', type: 'text/html' }]);
      });
    }
  });

  it('renders translated labels, escaped metadata, and the sanitized static snapshot', () => {
    const payload = {
      docLang: 'ja" onload="attack()', title: '<title>&"', description: '<summary>',
      bodyHtml: '<p>Sanitized static text</p>', blockedAssets: 3, hasStaticSnapshot: true,
    };
    const html = renderPreviewDocument(payload, 'https://local.invalid/?x="<&', previewLocale('ko'));
    assert.ok(html.includes('lang="ja&quot; onload=&quot;attack()"'));
    assert.ok(html.includes('<h1 class="preview-title">&lt;title&gt;&amp;&quot;</h1>'));
    assert.ok(html.includes('https://local.invalid/?x=&quot;&lt;&amp;'));
    assert.ok(html.includes('ko:webview.previewOfflineTitle'));
    assert.ok(html.includes('ko:webview.previewOfflineBlockedAssets:3'));
    assert.ok(html.includes('data-testid="preview-blocked-assets">3</div>'));
    assert.ok(html.includes('<div class="preview-snapshot"><p>Sanitized static text</p></div>'));
    const empty = renderPreviewDocument({ ...payload, hasStaticSnapshot: false }, '', previewLocale('ja'));
    assert.ok(empty.includes('<div class="preview-empty">ja:webview.previewOfflineNoStatic</div>'));
    assert.ok(!empty.includes('Sanitized static text'));
  });

  it('builds the preview through its parser and preserves the existing render cache contract', () => {
    const doc = previewDocument([], { bodyHtml: '<p>Actual module rendering</p>', bodyText: 'A sufficiently long static response.' });
    const locale = previewLocale();
    const tab = { url: '/draft', resolvedUrl: '/sent', response: { status: 200, size: 38, body: '<p>response</p>' } };
    let writes = 0;
    let innerHTML = '';
    const preview = {
      dataset: {} as Record<string, string>,
      get innerHTML() { return innerHTML; },
      set innerHTML(value: string) { innerHTML = value; writes += 1; },
    } as unknown as HTMLElement;
    withPreviewParser(doc, (calls) => {
      const html = buildPreviewDocument(tab.response.body, tab.resolvedUrl, locale);
      assert.ok(html.includes('<div class="preview-snapshot"><p>Actual module rendering</p></div>'));
      syncPreviewFrame(null, tab, locale);
      syncPreviewFrame(preview, {}, locale);
      assert.strictEqual(writes, 0);
      syncPreviewFrame(preview, tab, locale);
      assert.strictEqual(innerHTML, html);
      assert.strictEqual(writes, 1);
      assert.strictEqual(preview.dataset.previewKey, buildPreviewDocKey(tab));
      syncPreviewFrame(preview, tab, locale);
      assert.strictEqual(writes, 1);
      syncPreviewFrame(preview, { ...tab, response: { ...tab.response, status: 201 } }, locale);
      assert.strictEqual(writes, 2);
      assert.strictEqual(calls.length, 3);
      assert.strictEqual(buildPreviewDocKey(null), '');
    });
  });
});
