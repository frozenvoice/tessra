import * as assert from 'assert';
import { ImportExportService } from '../../services/ImportExportService';
import { CollectionItem, Request } from '../../models/types';

function flattenRequests(items: CollectionItem[]): Request[] {
  const requests: Request[] = [];
  for (const item of items) {
    if (item.type === 'request' && item.request) {
      requests.push(item.request);
    } else if (item.type === 'folder') {
      requests.push(...flattenRequests(item.children ?? []));
    }
  }
  return requests;
}

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

  it('path parameter를 Tessra 변수 placeholder로 가져온다', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'Orders API' },
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/users/{userId}': {
          get: {
            summary: 'Get user',
            parameters: [
              { name: 'userId', in: 'path', required: true, schema: { type: 'string', example: 'u1' } },
              { name: 'include', in: 'query', schema: { type: 'string', default: 'profile' } },
              { name: 'X-Trace', in: 'header', schema: { type: 'string', example: 'trace-1' } },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
        '/orders/{orderId}/items/{itemId}': {
          get: {
            summary: 'Get order item',
            parameters: [
              { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
        '/mixed/{AccountID}': {
          get: {
            summary: 'Get mixed case account',
            parameters: [
              { name: 'AccountID', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const imported = ImportExportService.importOpenApiDocuments([document]);
    const requests = flattenRequests(imported.collections[0].items);
    const userRequest = requests.find((request) => request?.name === 'Get user');
    const orderRequest = requests.find((request) => request?.name === 'Get order item');
    const mixedRequest = requests.find((request) => request?.name === 'Get mixed case account');

    assert.strictEqual(userRequest?.url, '{{baseUrl}}/users/{{userId}}');
    assert.deepStrictEqual(userRequest?.params.map((param) => [param.key, param.value]), [['include', 'profile']]);
    assert.deepStrictEqual(userRequest?.headers.map((header) => [header.key, header.value]), [['X-Trace', 'trace-1']]);
    assert.strictEqual(orderRequest?.url, '{{baseUrl}}/orders/{{orderId}}/items/{{itemId}}');
    assert.strictEqual(mixedRequest?.url, '{{baseUrl}}/mixed/{{AccountID}}');
  });
});
