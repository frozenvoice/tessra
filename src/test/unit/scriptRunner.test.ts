import * as assert from 'assert';
import { ScriptRunner } from '../../services/ScriptRunner';
import { KeyValue, Response } from '../../models/types';

describe('ScriptRunner', () => {
  const request = {
    method: 'GET' as const,
    url: 'https://example.com',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none' as const,
    formData: [],
    binaryFilePath: '',
    auth: { type: 'none' as const },
  };

  it('pre-request 스크립트가 요청과 환경을 수정한다', () => {
    const result = ScriptRunner.runPreRequest(
      {
        preRequest: `request.url = request.url + '/v1'; env.set('token', 'abc');`,
        test: '',
      },
      request,
      [] as KeyValue[]
    );

    assert.strictEqual(result.request.url, 'https://example.com/v1');
    assert.strictEqual(result.envVariables[0].key, 'token');
    assert.strictEqual(result.envVariables[0].value, 'abc');
  });

  it('test 스크립트가 pm.test 결과와 로그를 남긴다', () => {
    const response: Response = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
      time: 10,
      size: 12,
    };

    const result = ScriptRunner.runTests(
      {
        preRequest: '',
        test: `
          console.log('running tests');
          pm.test('status', function () { pm.response.to.have.status(200); });
          pm.test('json body', function () { pm.expect(pm.response.json()).to.have.property('ok', true); });
        `,
      },
      request,
      response,
      []
    );

    assert.strictEqual(result.result.tests.length, 2);
    assert.ok(result.result.tests.every((test) => test.passed));
    assert.strictEqual(result.result.logs[0].message, 'running tests');
  });

  it('script timeout 값을 설정값 범위로 정규화한다', () => {
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(undefined), 3000);
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(50), 100);
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(5000), 5000);
    assert.strictEqual(ScriptRunner.normalizeTimeoutMs(60000), 30000);
  });

  it('설정된 timeout으로 오래 실행되는 script를 중단한다', () => {
    assert.throws(
      () => ScriptRunner.runPreRequest(
        {
          preRequest: 'while (true) {}',
          test: '',
        },
        request,
        [],
        100
      ),
      /Script execution timed out after 100 ms/
    );
  });
});
