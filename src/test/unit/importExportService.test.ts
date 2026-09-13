import * as assert from 'assert';
import { ImportExportService } from '../../services/ImportExportService';

describe('ImportExportService', () => {
  it('imports a Postman environment with enabled state and fallback values', () => {
    const postmanEnvironment = {
      id: 'postman-env-id',
      name: 'Demo Environment',
      values: [
        { key: 'baseUrl', value: 'https://api.example.com', enabled: true, type: 'text' },
        { key: 'token', value: 'secret-token', enabled: false, type: 'secret' },
        { key: 'version', default: 2, type: 'text' },
      ],
    };

    const imported = ImportExportService.importPostmanEnvironmentDocument(postmanEnvironment);

    assert.strictEqual(imported.name, 'Demo Environment');
    assert.strictEqual(imported.variables.length, 3);
    assert.deepStrictEqual(imported.variables[0], {
      key: 'baseUrl',
      value: 'https://api.example.com',
      enabled: true,
    });
    assert.deepStrictEqual(imported.variables[1], {
      key: 'token',
      value: 'secret-token',
      enabled: false,
    });
    assert.deepStrictEqual(imported.variables[2], {
      key: 'version',
      value: '2',
      enabled: true,
    });
  });

  it('imports a Postman environment with an empty values array', () => {
    const imported = ImportExportService.importPostmanEnvironmentDocument({
      name: 'Empty Environment',
      values: [],
    });

    assert.strictEqual(imported.name, 'Empty Environment');
    assert.deepStrictEqual(imported.variables, []);
  });

  it('rejects Postman environment documents without a name or values array', () => {
    assert.throws(
      () => ImportExportService.importPostmanEnvironmentDocument({ values: [] }),
      /missing a name/
    );
    assert.throws(
      () => ImportExportService.importPostmanEnvironmentDocument({ name: 'No Values' }),
      /missing a values array/
    );
    assert.throws(
      () => ImportExportService.importPostmanEnvironmentDocument({ info: { name: 'Collection' }, item: [] }),
      /not a Postman Environment/
    );
  });

  it('Postman 컬렉션의 form-data와 스크립트를 가져온다', () => {
    const postmanCollection = {
      info: {
        name: 'Sample Collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Upload',
          request: {
            method: 'POST',
            url: { raw: 'https://example.com/upload' },
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'name', value: 'tessra', type: 'text' },
                { key: 'file', src: '/tmp/file.txt', type: 'file' },
              ],
            },
            event: [
              {
                listen: 'prerequest',
                script: { exec: ['env.set("token", "abc");'] },
              },
              {
                listen: 'test',
                script: { exec: ['pm.test("status", function () {});'] },
              },
            ],
          },
        },
      ],
    };

    const imported = ImportExportService.importDocuments([postmanCollection]);
    assert.strictEqual(imported.collections.length, 1);
    const request = imported.collections[0].items[0].request!;
    assert.strictEqual(request.bodyType, 'formdata');
    assert.strictEqual(request.formData?.length, 2);
    assert.strictEqual(request.formData?.[1].type, 'file');
    assert.ok(request.scripts?.preRequest.includes('env.set'));
    assert.ok(request.scripts?.test.includes('pm.test'));
    assert.strictEqual(request.disableScripts, true);
    assert.strictEqual(request.scriptsTrusted, false);
  });

  it('exports form-urlencoded values using the first equals and plus as a space', () => {
    const exported = ImportExportService.exportCollection({
      id: 'collection-1',
      name: 'Form collection',
      items: [{
        id: 'request-1',
        name: 'Form request',
        type: 'request',
        request: {
          id: 'request-1',
          name: 'Form request',
          method: 'POST',
          url: 'https://example.com/form',
          headers: [],
          params: [],
          body: 'message=hello+world&signature=abc==',
          bodyType: 'form',
          formData: [],
          binaryFilePath: '',
          auth: { type: 'none' },
        },
      }],
    });
    const body = (exported.item as Array<Record<string, unknown>>)[0].request as Record<string, unknown>;
    const entries = body.body as Record<string, unknown>;
    assert.deepStrictEqual(entries.urlencoded, [
      { key: 'message', value: 'hello world', disabled: false },
      { key: 'signature', value: 'abc==', disabled: false },
    ]);
  });
});
