import * as assert from 'assert';
import { decodeResponseText } from '../../services/responseTextDecoder';

describe('HTTP 응답 문자 인코딩', () => {
  it('기본 UTF-8과 JSON은 문자 추정 없이 기존 body만 반환한다', () => {
    for (const contentType of ['', 'text/plain', 'application/json', 'application/problem+json']) {
      assert.deepStrictEqual(decodeResponseText(Buffer.from('가나 あい'), contentType), { body: '가나 あい' });
    }
  });

  it('고정 EUC-KR·Shift_JIS·Latin-1 바이트를 charset에 따라 읽고 원문을 보존한다', () => {
    for (const [hex, charset, expected] of [
      ['b0a1b3aa', 'EUC-KR', '가나'], ['82a082a2', 'Shift_JIS', 'あい'], ['636166e9', 'iso-8859-1', 'café'],
    ]) {
      const bytes = Buffer.from(hex, 'hex');
      assert.deepStrictEqual(decodeResponseText(bytes, `text/plain; charset=${charset}`), {
        body: expected, bodyBase64: bytes.toString('base64'),
      });
    }
  });

  it('Content-Type 매개변수 이름·공백·따옴표와 UTF8 alias를 처리한다', () => {
    const bytes = Buffer.from('b0a1b3aa', 'hex');
    for (const type of ['TEXT/PLAIN; CHARSET = " EUC-KR "', "text/plain; charset='euc-kr'", 'text/plain; foo="; charset=utf-8"; charset=euc-kr']) {
      assert.strictEqual(decodeResponseText(bytes, type).body, '가나');
    }
    assert.deepStrictEqual(decodeResponseText(Buffer.from('가나'), 'text/plain; charset="UTF8"'), { body: '가나' });
  });

  it('UTF8·UTF16 LE/BE BOM을 사용하고 제거한 BOM 원문도 보존한다', () => {
    for (const [hex, expected] of [['efbbbf41', 'A'], ['fffe0041', '䄀'], ['fffe4100', 'A'], ['feff0041', 'A']]) {
      const bytes = Buffer.from(hex, 'hex');
      assert.deepStrictEqual(decodeResponseText(bytes, 'text/plain'), { body: expected, bodyBase64: bytes.toString('base64') });
    }
  });

  it('명시 charset이 BOM보다 우선한다', () => {
    const bytes = Buffer.from('fffe4100', 'hex');
    const result = decodeResponseText(bytes, 'text/plain; charset=utf-8');
    assert.strictEqual(result.decodingWarning?.reason, 'invalid-bytes');
    assert.strictEqual(result.decodingWarning?.charset, 'utf-8');
    assert.strictEqual(result.bodyBase64, bytes.toString('base64'));
    assert.strictEqual(result.body, '\ufffd\ufffdA\0');
  });

  it('미지원 UTF32 BOM을 UTF16로 오인하지 않고 원문과 경고를 보존한다', () => {
    for (const [hex, charset] of [['fffe000041000000', 'utf-32le'], ['0000feff00000041', 'utf-32be']]) {
      const bytes = Buffer.from(hex, 'hex');
      for (const contentType of ['text/plain', 'application/xml']) {
        const result = decodeResponseText(bytes, contentType);
        assert.deepStrictEqual(result.decodingWarning, { reason: 'unsupported-charset', charset });
        assert.strictEqual(result.bodyBase64, bytes.toString('base64'));
      }
    }
  });

  it('닫히지 않은 charset 따옴표도 정상 UTF8로 조용히 간주하지 않는다', () => {
    const bytes = Buffer.from('plain');
    const result = decodeResponseText(bytes, 'text/plain; charset="unknown');
    assert.deepStrictEqual(result.decodingWarning, { reason: 'unsupported-charset', charset: '"unknown' });
    assert.strictEqual(result.bodyBase64, bytes.toString('base64'));
  });

  it('XML MIME의 선언만 읽으며 명시 charset과 BOM을 우선한다', () => {
    const prefix = '<?xml version="1.0" encoding="euc-kr"?><root>';
    const bytes = Buffer.concat([Buffer.from(prefix), Buffer.from('b0a1b3aa', 'hex'), Buffer.from('</root>')]);
    for (const type of ['application/xml', 'text/xml', 'application/example+xml', 'image/svg+xml']) {
      assert.strictEqual(decodeResponseText(bytes, type).body, prefix + '가나</root>');
    }
    assert.strictEqual(decodeResponseText(bytes, 'text/plain').decodingWarning?.reason, 'invalid-bytes');
    assert.strictEqual(decodeResponseText(bytes, 'text/html').decodingWarning?.reason, 'invalid-bytes');
    assert.strictEqual(decodeResponseText(bytes, 'application/xml; charset=utf-8').decodingWarning?.reason, 'invalid-bytes');
    const utf8 = Buffer.concat([Buffer.from('efbbbf', 'hex'), Buffer.from(prefix + '가나</root>')]);
    assert.strictEqual(decodeResponseText(utf8, 'application/xml').body, prefix + '가나</root>');
  });

  it('XML BOM이 지원 charset보다 우선하되 미지원 명시 charset 경고를 유지한다', () => {
    const bytes = Buffer.from('fffe3c0072002f003e00', 'hex');
    assert.deepStrictEqual(decodeResponseText(bytes, 'application/xml; charset=utf-8'), { body: '<r/>', bodyBase64: bytes.toString('base64') });
    assert.deepStrictEqual(decodeResponseText(bytes, 'application/xml; charset=unknown'), {
      body: '<r/>', bodyBase64: bytes.toString('base64'), decodingWarning: { reason: 'unsupported-charset', charset: 'unknown' },
    });
  });

  it('미지원 charset도 HTTP 오류가 되지 않고 preview와 원문을 보존한다', () => {
    const bytes = Buffer.from('b0a1b3aa', 'hex');
    for (const charset of ['unknown-charset', '', '<img src=x onerror=alert(1)>']) {
      assert.deepStrictEqual(decodeResponseText(bytes, `text/plain; charset="${charset}"`), {
        body: bytes.toString('utf8'), bodyBase64: bytes.toString('base64'),
        decodingWarning: { reason: 'unsupported-charset', charset },
      });
    }
  });

  it('잘못되거나 잘린 UTF8·EUC-KR·Shift_JIS·UTF16은 replacement와 warning을 반환한다', () => {
    for (const [hex, charset] of [['eab0', 'utf-8'], ['b0', 'euc-kr'], ['82', 'shift_jis'], ['4100ff', 'utf-16le']]) {
      const bytes = Buffer.from(hex, 'hex');
      const result = decodeResponseText(bytes, `text/plain; charset=${charset}`);
      assert.ok(result.body.includes('\ufffd'));
      assert.deepStrictEqual(result.decodingWarning, { reason: 'invalid-bytes', charset });
      assert.strictEqual(result.bodyBase64, bytes.toString('base64'));
    }
  });

  it('실제 replacement 문자는 잘못된 바이트로 오인하지 않는다', () => {
    assert.deepStrictEqual(decodeResponseText(Buffer.from('\ufffd'), 'text/plain'), { body: '\ufffd' });
  });

  it('명시 선언 없는 legacy 바이트를 임의로 추정하지 않는다', () => {
    assert.strictEqual(decodeResponseText(Buffer.from('b0a1b3aa', 'hex'), 'text/plain').decodingWarning?.reason, 'invalid-bytes');
  });
});
