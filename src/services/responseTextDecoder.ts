import { TextDecoder } from 'util';
import type { Response } from '../models/types';

export type DecodedResponseText = Pick<Response, 'body' | 'bodyBase64' | 'decodingWarning'>;

function contentTypeCharset(contentType: string): string | undefined {
  // 따옴표 안의 세미콜론은 매개변수 구분자가 아니다.
  const parameters: string[] = [];
  let start = 0;
  let quote = '';
  let escaped = false;
  for (let index = 0; index <= contentType.length; index++) {
    if (index === contentType.length) {
      parameters.push(contentType.slice(start).trim());
      break;
    }
    const char = contentType[index];
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ';') {
      parameters.push(contentType.slice(start, index).trim());
      start = index + 1;
    }
  }
  for (const parameter of parameters.slice(1)) {
    const equals = parameter.indexOf('=');
    if (equals < 0 || parameter.slice(0, equals).trim().toLowerCase() !== 'charset') continue;
    let label = parameter.slice(equals + 1).trim();
    if ((label.startsWith('"') && label.endsWith('"')) || (label.startsWith("'") && label.endsWith("'"))) {
      label = label.slice(1, -1).replace(/\\(.)/g, '$1').trim();
    }
    return label;
  }
  return undefined;
}

function bomCharset(buffer: Buffer): string | undefined {
  // 긴 BOM부터 검사해 미지원 UTF-32를 UTF-16로 잘못 해독하지 않는다.
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xfe && buffer[2] === 0 && buffer[3] === 0) return 'utf-32le';
  if (buffer.length >= 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 0xfe && buffer[3] === 0xff) return 'utf-32be';
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf-8';
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
  return undefined;
}

function isXmlContentType(contentType: string): boolean {
  const mime = contentType.split(';', 1)[0].trim().toLowerCase();
  return mime === 'application/xml' || mime === 'text/xml' || /^[^\s/;]+\/[^\s/;]+\+xml$/.test(mime);
}

function xmlCharset(buffer: Buffer): string | undefined {
  // XML 선언만 제한된 접두부에서 읽는다. 본문/HTML meta 인코딩을 추정하지 않는다.
  const declaration = /^<\?xml\s[^?]*\?>/.exec(buffer.subarray(0, 1024).toString('latin1'))?.[0];
  return declaration && /\sencoding\s*=\s*(['"])([A-Za-z][A-Za-z0-9._-]*)\1/.exec(declaration)?.[2];
}

/** 압축 해제된 텍스트 응답을 디코딩한다. 바이너리 판정은 호출자가 담당한다. */
export function decodeResponseText(buffer: Buffer, contentType: string): DecodedResponseText {
  const bom = bomCharset(buffer);
  const headerCharset = contentTypeCharset(contentType);
  const xml = isXmlContentType(contentType);
  let unsupportedHeader = false;
  if (headerCharset !== undefined) {
    try { new TextDecoder(headerCharset); } catch { unsupportedHeader = true; }
  }
  // XML은 RFC 7303에 따라 BOM을 우선한다. 미지원 명시 charset 경고는 생략하지 않는다.
  const charset = (xml ? bom ?? headerCharset ?? xmlCharset(buffer) : headerCharset ?? bom) ?? 'utf-8';
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset, { fatal: true });
  } catch {
    return {
      body: buffer.toString('utf8'),
      bodyBase64: buffer.toString('base64'),
      decodingWarning: { reason: 'unsupported-charset', charset },
    };
  }
  try {
    const body = decoder.decode(buffer);
    if (unsupportedHeader) {
      return { body, bodyBase64: buffer.toString('base64'), decodingWarning: { reason: 'unsupported-charset', charset: headerCharset! } };
    }
    return decoder.encoding !== 'utf-8' || bom
      ? { body, bodyBase64: buffer.toString('base64') }
      : { body };
  } catch {
    return {
      body: new TextDecoder(charset).decode(buffer),
      bodyBase64: buffer.toString('base64'),
      decodingWarning: unsupportedHeader
        ? { reason: 'unsupported-charset', charset: headerCharset! }
        : { reason: 'invalid-bytes', charset },
    };
  }
}
