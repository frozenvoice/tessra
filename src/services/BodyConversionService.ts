import { FormDataField, RequestBodyType } from '../models/types';

/**
 * Body Type Conversion — 구조적 편의 변환 (스키마 인식 없음).
 *
 * JSON → XML 규칙 (결정적):
 * 1) 최상위 object에 프로퍼티가 하나이고 값이 object/array이면 그 키를 루트 요소명으로 사용
 * 2) 그 외 최상위 object/array는 <root> 래핑
 * 3) object 프로퍼티 → 자식 요소 (키 = 요소명; XML Name에 맞지 않으면 item 로 fallback 후 @name)
 * 4) array → 동일 부모 아래 반복 <item> 요소 (항상 item; 다른 키 반복 규칙 없음)
 * 5) primitive → 텍스트 노드
 * 6) null → 빈 요소 (xsi:nil 미사용)
 * 7) boolean/number → 문자열 텍스트; 특수문자 XML escape
 *
 * XML → JSON 규칙 (결정적, 완전 왕복 보장 없음):
 * - 속성 → "@attrName"
 * - 자식 요소만 / 텍스트만이면 단순화; 혼합이면 "#text" + 자식 키
 * - 같은 이름 자식 반복 → 배열
 * - 텍스트만 있는 요소 → 문자열 (또는 속성 있으면 object)
 *
 * form-urlencoded ↔ JSON: flat primitive object만; 중첩/배열 값 거절
 * form-urlencoded 중복 키 → JSON 배열
 * form-data ↔ JSON: 텍스트 필드만; file 필드 있으면 거절
 */

export type ConvertibleBodyType = Exclude<RequestBodyType, 'text'>;

export interface BodyConversionPayload {
  bodyType: ConvertibleBodyType;
  body: string;
  formData?: FormDataField[];
  binaryFilePath?: string;
}

export interface BodyConversionSuccess {
  ok: true;
  bodyType: ConvertibleBodyType;
  body: string;
  formData: FormDataField[];
  binaryFilePath: string;
}

export interface BodyConversionFailure {
  ok: false;
  code:
    | 'unsupported'
    | 'malformed_json'
    | 'malformed_xml'
    | 'nested_json'
    | 'formdata_file'
    | 'binary_blocked'
    | 'empty_target'
    | 'invalid_input';
  message: string;
}

export type BodyConversionResult = BodyConversionSuccess | BodyConversionFailure;

const SUPPORTED: ReadonlyArray<readonly [ConvertibleBodyType, ConvertibleBodyType]> = [
  ['json', 'xml'],
  ['xml', 'json'],
  ['json', 'form'],
  ['form', 'json'],
  ['json', 'formdata'],
  ['formdata', 'json'],
  ['json', 'raw'],
  ['xml', 'raw'],
  ['raw', 'json'],
  ['raw', 'xml'],
  ['json', 'none'],
  ['xml', 'none'],
  ['form', 'none'],
  ['formdata', 'none'],
  ['raw', 'none'],
  ['none', 'json'],
  ['none', 'xml'],
  ['none', 'form'],
  ['none', 'formdata'],
  ['none', 'raw'],
];

function pairKey(from: string, to: string): string {
  return `${from}->${to}`;
}

const SUPPORTED_SET = new Set(SUPPORTED.map(([from, to]) => pairKey(from, to)));

function failure(
  code: BodyConversionFailure['code'],
  message: string
): BodyConversionFailure {
  return { ok: false, code, message };
}

function success(
  bodyType: ConvertibleBodyType,
  body: string,
  formData: FormDataField[] = [],
  binaryFilePath = ''
): BodyConversionSuccess {
  return { ok: true, bodyType, body, formData, binaryFilePath };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  );
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isXmlName(name: string): boolean {
  return /^[A-Za-z_][\w.-]*$/.test(name);
}

function parseJsonStrict(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function jsonValueToXml(value: unknown, elementName: string, indent: string): string {
  const nextIndent = `${indent}  `;
  if (value === null || value === undefined) {
    return `${indent}<${elementName}/>\n`;
  }
  if (isPrimitive(value)) {
    return `${indent}<${elementName}>${escapeXml(String(value))}</${elementName}>\n`;
  }
  if (Array.isArray(value)) {
    let out = `${indent}<${elementName}>\n`;
    for (const item of value) {
      out += jsonValueToXml(item, 'item', nextIndent);
    }
    out += `${indent}</${elementName}>\n`;
    return out;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return `${indent}<${elementName}/>\n`;
    }
    let out = `${indent}<${elementName}>\n`;
    for (const key of keys) {
      const childName = isXmlName(key) ? key : 'item';
      if (childName === 'item' && !isXmlName(key)) {
        // 비정상 키: item 요소 + @name 속성으로 보존
        const child = value[key];
        if (isPrimitive(child) || child === undefined) {
          const text = child === null || child === undefined ? '' : escapeXml(String(child));
          if (child === null || child === undefined) {
            out += `${nextIndent}<item name="${escapeXml(key)}"/>\n`;
          } else {
            out += `${nextIndent}<item name="${escapeXml(key)}">${text}</item>\n`;
          }
        } else {
          // 중첩은 item 래핑 후 내용
          out += `${nextIndent}<item name="${escapeXml(key)}">\n`;
          if (Array.isArray(child)) {
            for (const entry of child) {
              out += jsonValueToXml(entry, 'item', `${nextIndent}  `);
            }
          } else if (isPlainObject(child)) {
            for (const nestedKey of Object.keys(child)) {
              const nestedName = isXmlName(nestedKey) ? nestedKey : 'item';
              out += jsonValueToXml(child[nestedKey], nestedName, `${nextIndent}  `);
            }
          }
          out += `${nextIndent}</item>\n`;
        }
      } else {
        out += jsonValueToXml(value[key], childName, nextIndent);
      }
    }
    out += `${indent}</${elementName}>\n`;
    return out;
  }
  return `${indent}<${elementName}>${escapeXml(String(value))}</${elementName}>\n`;
}

export function jsonToXml(value: unknown): string {
  if (Array.isArray(value)) {
    return jsonValueToXml(value, 'root', '').trimEnd() + '\n';
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (
      keys.length === 1
      && (isPlainObject(value[keys[0]]) || Array.isArray(value[keys[0]]))
      && isXmlName(keys[0])
    ) {
      return jsonValueToXml(value[keys[0]], keys[0], '').trimEnd() + '\n';
    }
    return jsonValueToXml(value, 'root', '').trimEnd() + '\n';
  }
  // primitive top-level → <root>text</root>
  if (value === null || value === undefined) {
    return '<root/>\n';
  }
  return `<root>${escapeXml(String(value))}</root>\n`;
}

interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    attrs[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '');
  }
  return attrs;
}

/** DOMParser 없이 동작하는 최소 XML 파서 (테스트/Node + webview 공통 fallback). */
export function parseXmlTree(xml: string): XmlNode {
  const input = String(xml || '').replace(/^\uFEFF/, '').trim();
  if (!input) {
    throw new Error('Empty XML');
  }

  // DOMParser 우선 (webview)
  if (typeof (globalThis as { DOMParser?: new () => DOMParser }).DOMParser === 'function') {
    const parser = new (globalThis as unknown as { DOMParser: new () => DOMParser }).DOMParser();
    const doc = parser.parseFromString(input, 'application/xml');
    const errorNode = doc.getElementsByTagName('parsererror')[0];
    if (errorNode) {
      throw new Error(errorNode.textContent || 'Malformed XML');
    }
    const root = doc.documentElement;
    if (!root) {
      throw new Error('Malformed XML');
    }
    return domElementToNode(root);
  }

  return parseXmlTreeManual(input);
}

function domElementToNode(el: Element): XmlNode {
  const attributes: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes.item(i);
    if (attr) {
      attributes[attr.name] = attr.value;
    }
  }
  const children: XmlNode[] = [];
  let text = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes.item(i);
    if (!child) continue;
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      children.push(domElementToNode(child as Element));
    } else if (child.nodeType === 3 /* TEXT_NODE */ || child.nodeType === 4 /* CDATA */) {
      text += child.textContent || '';
    }
  }
  return {
    name: el.tagName,
    attributes,
    children,
    text: text.replace(/^\s+|\s+$/g, '').length ? text : text.trim(),
  };
}

function parseXmlTreeManual(input: string): XmlNode {
  let i = 0;
  const length = input.length;

  function skipWs() {
    while (i < length && /\s/.test(input[i])) i++;
  }

  function parseName(): string {
    const start = i;
    while (i < length && /[\w:.-]/.test(input[i])) i++;
    if (start === i) throw new Error('Malformed XML');
    return input.slice(start, i);
  }

  function parseNode(): XmlNode {
    skipWs();
    while (i < length) {
      if (input.startsWith('<?', i)) {
        const end = input.indexOf('?>', i);
        if (end < 0) throw new Error('Malformed XML');
        i = end + 2;
        skipWs();
        continue;
      }
      if (input.startsWith('<!--', i)) {
        const end = input.indexOf('-->', i);
        if (end < 0) throw new Error('Malformed XML');
        i = end + 3;
        skipWs();
        continue;
      }
      if (input.startsWith('<!', i)) {
        const end = input.indexOf('>', i);
        if (end < 0) throw new Error('Malformed XML');
        i = end + 1;
        skipWs();
        continue;
      }
      break;
    }
    if (input[i] !== '<') throw new Error('Malformed XML');
    i++;
    if (input[i] === '/') throw new Error('Malformed XML');
    const name = parseName();
    const attrStart = i;
    let selfClosing = false;
    while (i < length) {
      if (input[i] === '>') break;
      if (input[i] === '/' && input[i + 1] === '>') {
        selfClosing = true;
        break;
      }
      i++;
    }
    if (i >= length) throw new Error('Malformed XML');
    const attrRaw = input.slice(attrStart, i);
    const attributes = parseAttributes(attrRaw);
    if (selfClosing) {
      i += 2;
      return { name, attributes, children: [], text: '' };
    }
    if (input[i] !== '>') throw new Error('Malformed XML');
    i++;

    const children: XmlNode[] = [];
    let text = '';
    let closed = false;
    while (i < length) {
      if (input.startsWith('</', i)) {
        i += 2;
        const closeName = parseName();
        skipWs();
        if (input[i] !== '>') throw new Error('Malformed XML');
        i++;
        if (closeName !== name) throw new Error('Malformed XML');
        closed = true;
        break;
      }
      if (input.startsWith('<!--', i)) {
        const end = input.indexOf('-->', i);
        if (end < 0) throw new Error('Malformed XML');
        i = end + 3;
        continue;
      }
      if (input[i] === '<') {
        children.push(parseNode());
        continue;
      }
      const nextTag = input.indexOf('<', i);
      if (nextTag < 0) throw new Error('Malformed XML');
      text += input.slice(i, nextTag);
      i = nextTag;
    }
    if (!closed) throw new Error('Malformed XML');

    // 자식이 있으면 주변 공백만 있는 텍스트는 무시
    const trimmed = text.trim();
    return {
      name,
      attributes,
      children,
      text: children.length > 0 ? (trimmed ? text : '') : text,
    };
  }

  const root = parseNode();
  skipWs();
  if (i < length) {
    // trailing whitespace already skipped; leftover content is malformed
    throw new Error('Malformed XML');
  }
  return root;
}

function xmlNodeToJson(node: XmlNode): unknown {
  const attrKeys = Object.keys(node.attributes);
  const hasAttrs = attrKeys.length > 0;
  const childNames = node.children.map((c) => c.name);
  const hasChildren = node.children.length > 0;
  const trimmedText = node.text.trim();
  const hasText = trimmedText.length > 0;

  if (!hasAttrs && !hasChildren) {
    return hasText ? decodeXmlEntities(node.text) : '';
  }

  const result: Record<string, unknown> = {};
  for (const key of attrKeys) {
    result[`@${key}`] = node.attributes[key];
  }

  if (hasChildren) {
    const grouped: Record<string, unknown[]> = {};
    for (const child of node.children) {
      if (!grouped[child.name]) grouped[child.name] = [];
      grouped[child.name].push(xmlNodeToJson(child));
    }
    for (const name of Object.keys(grouped)) {
      result[name] = grouped[name].length === 1 ? grouped[name][0] : grouped[name];
    }
  }

  if (hasText) {
    if (!hasChildren && !hasAttrs) {
      return decodeXmlEntities(node.text);
    }
    if (!hasChildren && hasAttrs) {
      result['#text'] = decodeXmlEntities(trimmedText);
      return result;
    }
    if (hasChildren && hasText) {
      result['#text'] = decodeXmlEntities(trimmedText);
    }
  }

  return result;
}

export function xmlToJsonValue(xml: string): unknown {
  const tree = parseXmlTree(xml);
  // 루트 래핑: 단일 루트 요소를 { rootName: content } 형태로 유지하되,
  // 루트가 "root"이고 속성/혼합이 없으면 내용만 반환하지 않고 { root: ... } 유지
  // → 왕복 친화: 항상 { [tagName]: value }
  const value = xmlNodeToJson(tree);
  return { [tree.name]: value };
}

function assertFlatPrimitiveObject(
  value: unknown
): { ok: true; obj: Record<string, string | number | boolean | null> } | { ok: false } {
  if (!isPlainObject(value)) return { ok: false };
  for (const key of Object.keys(value)) {
    const v = value[key];
    if (Array.isArray(v) || isPlainObject(v) || typeof v === 'undefined') {
      return { ok: false };
    }
    if (!(v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      return { ok: false };
    }
  }
  return { ok: true, obj: value as Record<string, string | number | boolean | null> };
}

export function jsonToFormUrlEncoded(value: unknown): string {
  const flat = assertFlatPrimitiveObject(value);
  if (!flat.ok) {
    throw new Error('nested');
  }
  return Object.keys(flat.obj)
    .map((key) => {
      const raw = flat.obj[key];
      const encodedKey = encodeURIComponent(key);
      if (raw === null) {
        return `${encodedKey}=`;
      }
      return `${encodedKey}=${encodeURIComponent(String(raw))}`;
    })
    .join('&');
}

export function formUrlEncodedToJson(body: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const source = String(body || '').trim();
  if (!source) return result;

  const parts = source.split('&').filter(Boolean);
  for (const part of parts) {
    const eq = part.indexOf('=');
    let key: string;
    let value: string;
    if (eq < 0) {
      key = decodeURIComponent(part.replace(/\+/g, ' '));
      value = '';
    } else {
      key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' '));
      value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
    }
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

function newFormFieldId(): string {
  return `fd_${Math.random().toString(36).slice(2, 10)}`;
}

export function jsonToFormDataFields(value: unknown): FormDataField[] {
  const flat = assertFlatPrimitiveObject(value);
  if (!flat.ok) {
    throw new Error('nested');
  }
  return Object.keys(flat.obj).map((key) => ({
    id: newFormFieldId(),
    key,
    value: flat.obj[key] === null ? '' : String(flat.obj[key]),
    enabled: true,
    type: 'text' as const,
  }));
}

export function formDataFieldsToJson(
  fields: FormDataField[]
): { ok: true; value: Record<string, string | string[]> } | { ok: false; code: 'formdata_file' } {
  const enabled = (fields || []).filter((f) => f && f.enabled !== false && f.key);
  if (enabled.some((f) => f.type === 'file')) {
    return { ok: false, code: 'formdata_file' };
  }
  const result: Record<string, string | string[]> = {};
  for (const field of enabled) {
    const key = field.key;
    const value = field.value ?? '';
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }
  return { ok: true, value: result };
}

function normalizeType(type: string | undefined): ConvertibleBodyType {
  switch (type) {
    case 'json':
    case 'xml':
    case 'form':
    case 'formdata':
    case 'binary':
    case 'raw':
    case 'none':
      return type;
    case 'text':
      return 'raw';
    default:
      return 'none';
  }
}

function hasConvertibleContent(payload: BodyConversionPayload): boolean {
  const type = normalizeType(payload.bodyType);
  if (type === 'formdata') {
    return (payload.formData || []).some((f) => f && (f.key || f.value));
  }
  if (type === 'binary') {
    return !!(payload.binaryFilePath || '').trim() || !!(payload.body || '').trim();
  }
  return !!(payload.body || '').trim();
}

export class BodyConversionService {
  static supportsConversion(fromType: string, toType: string): boolean {
    const from = normalizeType(fromType);
    const to = normalizeType(toType);
    if (from === to) return false;
    if (from === 'binary' || to === 'binary') return false;
    return SUPPORTED_SET.has(pairKey(from, to));
  }

  /** Convert는 Binary와 관련되면 절대 제공하지 않는다. */
  static isBinaryTransition(fromType: string, toType: string): boolean {
    return normalizeType(fromType) === 'binary' || normalizeType(toType) === 'binary';
  }

  static hasContent(payload: BodyConversionPayload): boolean {
    return hasConvertibleContent(payload);
  }

  static convert(
    payload: BodyConversionPayload,
    toType: ConvertibleBodyType
  ): BodyConversionResult {
    const from = normalizeType(payload.bodyType);
    const to = normalizeType(toType);

    if (from === to) {
      return success(to, payload.body || '', payload.formData || [], payload.binaryFilePath || '');
    }

    if (from === 'binary' || to === 'binary') {
      return failure(
        'binary_blocked',
        'Binary body type cannot be auto-converted. Choose Keep text or Cancel.'
      );
    }

    if (!this.supportsConversion(from, to)) {
      return failure(
        'unsupported',
        `Conversion from ${from} to ${to} is not supported. Choose Keep text or Cancel.`
      );
    }

    // none → * : empty payloads
    if (from === 'none') {
      if (to === 'formdata') {
        return success('formdata', '', [], '');
      }
      return success(to, '', [], '');
    }

    // * → none : clear body (Convert = intentional clear)
    if (to === 'none') {
      return success('none', '', [], '');
    }

    // JSON / XML → raw: keep serialized text
    if ((from === 'json' || from === 'xml') && to === 'raw') {
      return success('raw', payload.body || '', [], '');
    }

    // raw → json / xml
    if (from === 'raw' && (to === 'json' || to === 'xml')) {
      const text = payload.body || '';
      if (to === 'json') {
        const parsed = parseJsonStrict(text);
        if (!parsed.ok) {
          return failure('malformed_json', 'Raw body is not valid JSON.');
        }
        // keep original serialization (do not re-stringify) so undo matches
        return success('json', text, [], '');
      }
      try {
        parseXmlTree(text);
        return success('xml', text, [], '');
      } catch {
        return failure('malformed_xml', 'Raw body is not valid XML.');
      }
    }

    if (from === 'json' && to === 'xml') {
      const parsed = parseJsonStrict(payload.body || '');
      if (!parsed.ok) {
        return failure('malformed_json', 'Current JSON body is malformed and cannot be converted.');
      }
      return success('xml', jsonToXml(parsed.value), [], '');
    }

    if (from === 'xml' && to === 'json') {
      try {
        const value = xmlToJsonValue(payload.body || '');
        return success('json', `${JSON.stringify(value, null, 2)}\n`, [], '');
      } catch {
        return failure('malformed_xml', 'Current XML body is malformed and cannot be converted.');
      }
    }

    if (from === 'json' && to === 'form') {
      const parsed = parseJsonStrict(payload.body || '');
      if (!parsed.ok) {
        return failure('malformed_json', 'Current JSON body is malformed and cannot be converted.');
      }
      try {
        return success('form', jsonToFormUrlEncoded(parsed.value), [], '');
      } catch {
        return failure(
          'nested_json',
          'This JSON contains nested values and cannot be safely converted to form-urlencoded.'
        );
      }
    }

    if (from === 'form' && to === 'json') {
      try {
        const value = formUrlEncodedToJson(payload.body || '');
        return success('json', `${JSON.stringify(value, null, 2)}\n`, [], '');
      } catch {
        return failure('invalid_input', 'Form-urlencoded body contains malformed percent-encoding.');
      }
    }

    if (from === 'json' && to === 'formdata') {
      const parsed = parseJsonStrict(payload.body || '');
      if (!parsed.ok) {
        return failure('malformed_json', 'Current JSON body is malformed and cannot be converted.');
      }
      try {
        const fields = jsonToFormDataFields(parsed.value);
        return success('formdata', '', fields, '');
      } catch {
        return failure(
          'nested_json',
          'This JSON contains nested values and cannot be safely converted to form-data.'
        );
      }
    }

    if (from === 'formdata' && to === 'json') {
      const mapped = formDataFieldsToJson(payload.formData || []);
      if (!mapped.ok) {
        return failure(
          'formdata_file',
          'Form-data contains file fields and cannot be safely converted to JSON.'
        );
      }
      return success('json', `${JSON.stringify(mapped.value, null, 2)}\n`, [], '');
    }

    return failure('unsupported', `Conversion from ${from} to ${to} is not supported.`);
  }
}
