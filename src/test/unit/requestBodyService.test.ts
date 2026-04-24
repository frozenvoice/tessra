import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RequestBodyService } from '../../services/RequestBodyService';
import { KeyValue } from '../../models/types';

describe('RequestBodyService', () => {
  it('form-data 텍스트와 파일을 multipart 바디로 준비한다', async () => {
    const tempFile = path.join(os.tmpdir(), `tessra-formdata-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'file-content', 'utf-8');

    try {
      const result = await RequestBodyService.prepare({
        bodyType: 'formdata',
        body: '',
        formData: [
          { id: '1', key: 'name', value: '{{user}}', enabled: true, type: 'text' },
          { id: '2', key: 'file', value: tempFile, enabled: true, type: 'file' },
        ],
        binaryFilePath: '',
        headers: [] as KeyValue[],
        vars: [{ key: 'user', value: 'tessra', enabled: true }],
      });

      assert.ok(Buffer.isBuffer(result.data));
      const body = result.data.toString('utf-8');
      assert.ok(body.includes('name="name"'));
      assert.ok(body.includes('tessra'));
      assert.ok(body.includes('name="file"; filename='));
      assert.ok(body.includes('file-content'));
      assert.ok(result.headers.some((header) => header.key === 'Content-Type' && header.value.includes('multipart/form-data')));
    } finally {
      fs.unlinkSync(tempFile);
    }
  });

  it('binary 바디는 파일을 읽고 기본 content-type을 채운다', async () => {
    const tempFile = path.join(os.tmpdir(), `tessra-binary-${Date.now()}.bin`);
    fs.writeFileSync(tempFile, Buffer.from([1, 2, 3, 4]));

    try {
      const result = await RequestBodyService.prepare({
        bodyType: 'binary',
        body: '',
        formData: [],
        binaryFilePath: tempFile,
        headers: [],
        vars: [],
      });

      assert.ok(Buffer.isBuffer(result.data));
      assert.deepStrictEqual([...result.data], [1, 2, 3, 4]);
      assert.strictEqual(result.headers[0].value, 'application/octet-stream');
    } finally {
      fs.unlinkSync(tempFile);
    }
  });
  it('raw/json/form 바디에서도 오래된 content-length를 제거한다', async () => {
    const result = await RequestBodyService.prepare({
      bodyType: 'json',
      body: '{"name":"{{user}}"}',
      formData: [],
      binaryFilePath: '',
      headers: [
        { key: 'Content-Length', value: '999', enabled: true },
        { key: 'Content-Type', value: 'application/json', enabled: true },
      ],
      vars: [{ key: 'user', value: 'tessra', enabled: true }],
    });

    assert.strictEqual(result.resolvedBody, '{"name":"tessra"}');
    assert.ok(result.headers.every((header) => header.key.toLowerCase() !== 'content-length'));
    assert.ok(result.headers.some((header) => header.key === 'Content-Type' && header.value === 'application/json'));
  });
});
