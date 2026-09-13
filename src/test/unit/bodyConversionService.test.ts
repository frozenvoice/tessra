import * as assert from 'assert';
import {
  BodyConversionService,
  formDataFieldsToJson,
  formUrlEncodedToJson,
  jsonToFormDataFields,
  jsonToFormUrlEncoded,
  jsonToXml,
  xmlToJsonValue,
} from '../../services/BodyConversionService';
import { FormDataField } from '../../models/types';

describe('BodyConversionService', () => {
  describe('JSON → XML', () => {
    it('uses the single object/array property as root element name', () => {
      const xml = jsonToXml({ user: { name: 'a', age: 1 } });
      assert.match(xml, /^<user>/);
      assert.match(xml, /<name>a<\/name>/);
      assert.match(xml, /<age>1<\/age>/);
      assert.doesNotMatch(xml, /<root>/);
    });

    it('wraps multi-property objects in <root>', () => {
      const xml = jsonToXml({ a: 1, b: 2 });
      assert.match(xml, /^<root>/);
      assert.match(xml, /<a>1<\/a>/);
      assert.match(xml, /<b>2<\/b>/);
    });

    it('wraps top-level arrays in <root> with repeated <item>', () => {
      const xml = jsonToXml([1, 'x', null]);
      assert.match(xml, /^<root>/);
      assert.match(xml, /<item>1<\/item>/);
      assert.match(xml, /<item>x<\/item>/);
      assert.match(xml, /<item\/>/);
    });

    it('escapes XML special characters and renders null as empty element', () => {
      const xml = jsonToXml({ note: 'a<b>&"\'', empty: null });
      assert.match(xml, /<note>a&lt;b&gt;&amp;&quot;&apos;<\/note>/);
      assert.match(xml, /<empty\/>/);
      assert.doesNotMatch(xml, /xsi:nil/);
    });

    it('fails conversion and keeps original on malformed JSON', () => {
      const original = '{bad';
      const result = BodyConversionService.convert(
        { bodyType: 'json', body: original },
        'xml'
      );
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'malformed_json');
      }
    });
  });

  describe('XML → JSON', () => {
    it('maps elements, attributes, and repeated children deterministically', () => {
      const value = xmlToJsonValue(
        '<root id="1"><item>a</item><item>b</item><note lang="en">hi</note></root>'
      ) as Record<string, unknown>;
      assert.ok(value.root);
      const root = value.root as Record<string, unknown>;
      assert.strictEqual(root['@id'], '1');
      assert.deepStrictEqual(root.item, ['a', 'b']);
      assert.deepStrictEqual(root.note, { '@lang': 'en', '#text': 'hi' });
    });

    it('fails conversion on malformed XML', () => {
      const result = BodyConversionService.convert(
        { bodyType: 'xml', body: '<root><x></root>' },
        'json'
      );
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'malformed_xml');
      }
    });
  });

  describe('JSON ↔ form-urlencoded', () => {
    it('converts flat primitive JSON objects', () => {
      assert.strictEqual(
        jsonToFormUrlEncoded({ a: '1', b: true, c: null }),
        'a=1&b=true&c='
      );
      const result = BodyConversionService.convert(
        { bodyType: 'json', body: '{"x":"y"}' },
        'form'
      );
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.bodyType, 'form');
        assert.strictEqual(result.body, 'x=y');
      }
    });

    it('rejects nested JSON for form-urlencoded', () => {
      const result = BodyConversionService.convert(
        { bodyType: 'json', body: '{"a":{"b":1}}' },
        'form'
      );
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'nested_json');
        assert.match(result.message, /nested values/i);
      }
    });

    it('converts form-urlencoded to JSON and collapses duplicate keys into arrays', () => {
      const value = formUrlEncodedToJson('a=1&a=2&b=hello%20world');
      assert.deepStrictEqual(value, { a: ['1', '2'], b: 'hello world' });
      const result = BodyConversionService.convert(
        { bodyType: 'form', body: 'a=1&a=2' },
        'json'
      );
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.bodyType, 'json');
        assert.deepStrictEqual(JSON.parse(result.body), { a: ['1', '2'] });
      }
    });

    it('decodes plus as spaces and reports malformed percent encoding as invalid input', () => {
      assert.deepStrictEqual(formUrlEncodedToJson('message=hello+world&signature=abc=='), {
        message: 'hello world',
        signature: 'abc==',
      });
      const result = BodyConversionService.convert(
        { bodyType: 'form', body: 'message=%E0%A4%A' },
        'json'
      );
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'invalid_input');
      }
    });
  });

  describe('JSON ↔ form-data', () => {
    it('converts flat primitive JSON to text form-data fields', () => {
      const fields = jsonToFormDataFields({ name: 'tessra', count: 2 });
      assert.strictEqual(fields.length, 2);
      assert.ok(fields.every((f) => f.type === 'text' && f.enabled));
      assert.strictEqual(fields.find((f) => f.key === 'name')?.value, 'tessra');
      assert.strictEqual(fields.find((f) => f.key === 'count')?.value, '2');
    });

    it('rejects nested JSON for form-data', () => {
      const result = BodyConversionService.convert(
        { bodyType: 'json', body: '{"a":[1]}' },
        'formdata'
      );
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'nested_json');
      }
    });

    it('converts text form-data fields to JSON', () => {
      const fields: FormDataField[] = [
        { id: '1', key: 'a', value: '1', enabled: true, type: 'text' },
        { id: '2', key: 'a', value: '2', enabled: true, type: 'text' },
        { id: '3', key: 'b', value: 'x', enabled: true, type: 'text' },
      ];
      const mapped = formDataFieldsToJson(fields);
      assert.strictEqual(mapped.ok, true);
      if (mapped.ok) {
        assert.deepStrictEqual(mapped.value, { a: ['1', '2'], b: 'x' });
      }
    });

    it('rejects form-data with file fields', () => {
      const result = BodyConversionService.convert(
        {
          bodyType: 'formdata',
          body: '',
          formData: [
            { id: '1', key: 'file', value: 'C:/a.bin', enabled: true, type: 'file' },
          ],
        },
        'json'
      );
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'formdata_file');
      }
    });
  });

  describe('Raw / Binary / None', () => {
    it('JSON/XML → raw keeps serialized text', () => {
      const jsonRaw = BodyConversionService.convert(
        { bodyType: 'json', body: '{"a":1}' },
        'raw'
      );
      assert.strictEqual(jsonRaw.ok, true);
      if (jsonRaw.ok) {
        assert.strictEqual(jsonRaw.bodyType, 'raw');
        assert.strictEqual(jsonRaw.body, '{"a":1}');
      }
      const xmlRaw = BodyConversionService.convert(
        { bodyType: 'xml', body: '<root/>' },
        'raw'
      );
      assert.strictEqual(xmlRaw.ok, true);
      if (xmlRaw.ok) {
        assert.strictEqual(xmlRaw.body, '<root/>');
      }
    });

    it('raw → JSON/XML only when parseable; otherwise fails', () => {
      const okJson = BodyConversionService.convert(
        { bodyType: 'raw', body: '{"ok":true}' },
        'json'
      );
      assert.strictEqual(okJson.ok, true);
      const badJson = BodyConversionService.convert(
        { bodyType: 'raw', body: 'not-json' },
        'json'
      );
      assert.strictEqual(badJson.ok, false);

      const okXml = BodyConversionService.convert(
        { bodyType: 'raw', body: '<ok/>' },
        'xml'
      );
      assert.strictEqual(okXml.ok, true);
      const badXml = BodyConversionService.convert(
        { bodyType: 'raw', body: '<ok>' },
        'xml'
      );
      assert.strictEqual(badXml.ok, false);
    });

    it('blocks Binary auto-conversion in either direction', () => {
      assert.strictEqual(BodyConversionService.supportsConversion('binary', 'json'), false);
      assert.strictEqual(BodyConversionService.supportsConversion('json', 'binary'), false);
      assert.strictEqual(BodyConversionService.isBinaryTransition('binary', 'raw'), true);
      const result = BodyConversionService.convert(
        { bodyType: 'binary', body: '', binaryFilePath: 'C:/a.bin' },
        'json'
      );
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'binary_blocked');
      }
    });

    it('None → other yields empty payload; other → None clears on convert', () => {
      const fromNone = BodyConversionService.convert({ bodyType: 'none', body: '' }, 'json');
      assert.strictEqual(fromNone.ok, true);
      if (fromNone.ok) {
        assert.strictEqual(fromNone.body, '');
        assert.strictEqual(fromNone.bodyType, 'json');
      }
      const toNone = BodyConversionService.convert(
        { bodyType: 'json', body: '{"a":1}' },
        'none'
      );
      assert.strictEqual(toNone.ok, true);
      if (toNone.ok) {
        assert.strictEqual(toNone.bodyType, 'none');
        assert.strictEqual(toNone.body, '');
      }
    });
  });

  describe('support matrix helpers', () => {
    it('reports supported pairs without auto-converting unsupported ones', () => {
      assert.strictEqual(BodyConversionService.supportsConversion('json', 'xml'), true);
      assert.strictEqual(BodyConversionService.supportsConversion('xml', 'form'), false);
      assert.strictEqual(BodyConversionService.supportsConversion('form', 'formdata'), false);
      const unsupported = BodyConversionService.convert(
        { bodyType: 'xml', body: '<a/>' },
        'form'
      );
      assert.strictEqual(unsupported.ok, false);
      if (!unsupported.ok) {
        assert.strictEqual(unsupported.code, 'unsupported');
      }
    });

    it('detects non-empty form-data and binary payloads for confirm UX', () => {
      assert.strictEqual(
        BodyConversionService.hasContent({ bodyType: 'json', body: '  ' }),
        false
      );
      assert.strictEqual(
        BodyConversionService.hasContent({
          bodyType: 'formdata',
          body: '',
          formData: [{ id: '1', key: 'a', value: '', enabled: true, type: 'text' }],
        }),
        true
      );
      assert.strictEqual(
        BodyConversionService.hasContent({
          bodyType: 'binary',
          body: '',
          binaryFilePath: 'C:/file.bin',
        }),
        true
      );
    });
  });

  describe('round-trip sanity (not guaranteed schema fidelity)', () => {
    it('JSON → XML → JSON preserves a simple nested object under a named root', () => {
      const original = { user: { name: 'tessra', tags: ['a', 'b'] } };
      const xml = jsonToXml(original);
      const back = xmlToJsonValue(xml) as { user: { name: string; tags: { item: string[] } } };
      assert.strictEqual(back.user.name, 'tessra');
      // arrays become repeated <item> under the property element
      assert.ok(back.user.tags);
    });
  });
});
