import * as assert from 'assert';
import { ImportExportService } from '../../services/ImportExportService';

describe('OpenAPI import', () => {
  it('OpenAPI 문서를 컬렉션과 환경으로 가져온다', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'Pet API' },
      servers: [{ url: 'https://api.example.com/v1' }],
      paths: {
        '/pets': {
          get: {
            summary: 'List pets',
            parameters: [
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', default: 10 },
              },
            ],
            responses: {
              '200': { description: 'OK' },
            },
          },
          post: {
            summary: 'Create pet',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'Fluffy' },
                      age: { type: 'integer', default: 3 },
                    },
                  },
                },
              },
            },
            responses: {
              '201': { description: 'Created' },
            },
          },
        },
      },
    };

    const imported = ImportExportService.importOpenApiDocuments([document]);
    assert.strictEqual(imported.collections.length, 1);
    assert.strictEqual(imported.environments.length, 1);
    assert.strictEqual(imported.collections[0].name, 'Pet API');
    assert.strictEqual(imported.environments[0].variables[0].key, 'baseUrl');
    assert.strictEqual(imported.environments[0].variables[0].value, 'https://api.example.com/v1');

    const requests = imported.collections[0].items;
    assert.strictEqual(requests.length, 2);

    const getRequest = requests.find((item) => item.request?.method === 'GET')?.request;
    const postRequest = requests.find((item) => item.request?.method === 'POST')?.request;

    assert.ok(getRequest);
    assert.ok(postRequest);
    assert.strictEqual(getRequest?.url, '{{baseUrl}}/pets');
    assert.strictEqual(getRequest?.params[0].key, 'limit');
    assert.strictEqual(getRequest?.params[0].value, '10');
    assert.strictEqual(postRequest?.bodyType, 'json');
    assert.match(postRequest?.body ?? '', /Fluffy/);
  });
});
