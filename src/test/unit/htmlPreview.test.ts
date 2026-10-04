import * as assert from 'assert';
import * as vm from 'vm';
import { getRequestPanelResponseClientScript } from '../../panels/requestPanel/requestPanelResponseClientScript';

class PreviewElement {
  readonly attributes: Array<{ name: string; value: string }>;

  constructor(attributes: Record<string, string>) {
    this.attributes = Object.entries(attributes).map(([name, value]) => ({ name, value }));
  }

  removeAttribute(name: string): void {
    const index = this.attributes.findIndex((attribute) => attribute.name === name);
    if (index >= 0) this.attributes.splice(index, 1);
  }

  getAttribute(name: string): string | null {
    return this.attributes.find((attribute) => attribute.name === name)?.value ?? null;
  }
}

function previewDocument(elements: PreviewElement[]) {
  return {
    querySelectorAll(selector: string) {
      if (selector === '*') return elements;
      const attributeNames = Array.from(selector.matchAll(/\[([a-z:-]+)\]/g), (match) => match[1]);
      return elements.filter((element) => attributeNames.some((name) => element.getAttribute(name) !== null));
    },
  };
}

function previewSanitizer() {
  const script = getRequestPanelResponseClientScript();
  const start = script.indexOf('function isPreviewSafeUrl(');
  const end = script.indexOf('function extractPreviewDescription(', start);
  assert.ok(start >= 0 && end > start, 'execute the generated production preview helpers');
  const context = vm.createContext({});
  vm.runInContext(script.slice(start, end), context);
  return context as {
    sanitizePreviewDocument: (doc: ReturnType<typeof previewDocument>) => void;
    countPreviewExternalAssets: (doc: ReturnType<typeof previewDocument>) => number;
  };
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
    previewSanitizer().sanitizePreviewDocument(previewDocument([element]));
    assert.deepStrictEqual(element.attributes.map((attribute) => attribute.name), ['title', 'src']);
  });

  it('removes every external URL attribute, including SVG links and HTML background/ping', () => {
    const names = ['src', 'href', 'srcset', 'poster', 'action', 'formaction', 'xlink:href', 'background', 'ping'];
    const elements = names.map((name) => new PreviewElement({ [name]: 'https://outside.invalid/resource' }));
    const doc = previewDocument(elements);
    previewSanitizer().sanitizePreviewDocument(doc);
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
    const sanitizer = previewSanitizer();
    assert.strictEqual(sanitizer.countPreviewExternalAssets(doc), 7);
    sanitizer.sanitizePreviewDocument(doc);
    assert.strictEqual(sanitizer.countPreviewExternalAssets(doc), 0);
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
    const sanitizer = previewSanitizer();
    assert.strictEqual(sanitizer.countPreviewExternalAssets(doc), 0);
    sanitizer.sanitizePreviewDocument(doc);
    assert.deepStrictEqual(elements.map((element) => Object.fromEntries(element.attributes.map(({ name, value }) => [name, value]))), attributes);
  });
});
