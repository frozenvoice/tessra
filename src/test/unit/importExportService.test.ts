import * as assert from 'assert';
import { randomUUID } from 'crypto';
import { ImportExportService } from '../../services/ImportExportService';

describe('ImportExportService', () => {
  it('exports only explicit secret metadata for protected and interrupted environment variables', () => {
    const id = randomUUID(); const referenceId = randomUUID(); const pendingId = randomUUID(); const pendingReferenceId = randomUUID();
    const exported = ImportExportService.exportEnvironment({ id: 'env', name: 'Safe export', variables: [
      { id, key: 'token', value: 'synthetic-current-secret', enabled: false, secretRef: { id: referenceId } },
      { id: pendingId, key: 'pending', value: 'synthetic-pending-original', enabled: true, secretPendingRef: { id: pendingReferenceId } },
      { key: 'plain', value: 'preserve-existing-plaintext', enabled: true },
    ] });
    const values = exported.values as Array<Record<string, unknown>>;
    assert.deepStrictEqual(values[0], { key: 'token', value: '', enabled: false, type: 'secret',
      _tessraSecret: { version: 1, variableId: id, referenceId } });
    assert.deepStrictEqual(values[1], { key: 'pending', value: '', enabled: true, type: 'secret',
      _tessraSecret: { version: 1, variableId: pendingId, referenceId: pendingReferenceId } });
    assert.deepStrictEqual(values[2], { key: 'plain', value: 'preserve-existing-plaintext', enabled: true, type: 'text' });
    assert.ok(!JSON.stringify(exported).includes('synthetic-'));
  });

  it('round trips explicit Tessra references as fresh missing values while retaining variable IDs', () => {
    const id = randomUUID(); const referenceId = randomUUID();
    const exported = ImportExportService.exportEnvironment({ id: 'env', name: 'References', variables: [
      { id, key: 'token', value: '', enabled: true, secretRef: { id: referenceId } },
    ] });
    const first = ImportExportService.importPostmanEnvironmentDocument(exported).variables[0];
    const second = ImportExportService.importDocuments([exported]).environments[0].variables[0];
    assert.strictEqual(first.id, id); assert.strictEqual(first.value, ''); assert.ok(first.secretRef);
    assert.notStrictEqual(first.secretRef!.id, referenceId); assert.notStrictEqual(first.secretRef!.id, second.secretRef!.id);
  });

  it('ignores marker-bearing input values and defaults instead of storing mask strings as real secrets', () => {
    const id = randomUUID(); const referenceId = randomUUID();
    const imported = ImportExportService.importPostmanEnvironmentDocument({ name: 'Explicit reference', values: [
      { key: 'token', value: '••••', default: 'synthetic-default', disabled: true,
        _tessraSecret: { version: 1, variableId: id, referenceId } },
    ] });
    assert.strictEqual(imported.variables[0].value, ''); assert.strictEqual(imported.variables[0].enabled, false);
    assert.ok(imported.variables[0].secretRef); assert.strictEqual(imported.variables[0].id, id);
  });

  it('rejects malformed explicit references without falling back to plaintext import or export', () => {
    for (const marker of [null, {}, { version: 2, variableId: randomUUID(), referenceId: randomUUID() },
      { version: 1, variableId: 'invalid', referenceId: randomUUID() }]) {
      assert.throws(() => ImportExportService.importPostmanEnvironmentDocument({ name: 'Bad marker', values: [
        { key: 'token', value: 'synthetic-secret', _tessraSecret: marker },
      ] }), /Invalid Tessra protected variable reference/);
    }
    assert.throws(() => ImportExportService.exportEnvironment({ id: 'env', name: 'Bad export', variables: [
      { key: 'token', value: 'synthetic-secret', enabled: true, secretRef: { id: randomUUID() } },
    ] }), /requires stable IDs/);
  });

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
