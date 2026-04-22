import * as assert from 'assert';
import { ImportExportService } from '../../services/ImportExportService';

describe('ImportExportService', () => {
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
  });
});
