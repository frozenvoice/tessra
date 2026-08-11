import * as crypto from 'crypto';

/**
 * Tessra Script utilities for the Pre-request / Test sandbox.
 * Not a Postman-official `pm.crypto` API — wrappers only; never expose Node built-ins.
 */
export class ScriptUtilities {
  static createApi(): {
    crypto: { sha256: (value: unknown) => string; hmacSha256: (message: unknown, secret: unknown) => string };
    encoding: { base64Encode: (value: unknown) => string; base64Decode: (value: unknown) => string };
    uuid: () => string;
    time: { unix: () => number; unixMs: () => number };
  } {
    return {
      crypto: {
        sha256: (value: unknown) => ScriptUtilities.sha256(value),
        hmacSha256: (message: unknown, secret: unknown) => ScriptUtilities.hmacSha256(message, secret),
      },
      encoding: {
        base64Encode: (value: unknown) => ScriptUtilities.base64Encode(value),
        base64Decode: (value: unknown) => ScriptUtilities.base64Decode(value),
      },
      uuid: () => ScriptUtilities.uuidV4(),
      time: {
        unix: () => ScriptUtilities.unixSeconds(),
        unixMs: () => ScriptUtilities.unixMilliseconds(),
      },
    };
  }

  static sha256(value: unknown): string {
    const text = coerceScriptText(value, 'pm.crypto.sha256');
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  /** Argument order is fixed: message first, secret second. */
  static hmacSha256(message: unknown, secret: unknown): string {
    const msg = coerceScriptText(message, 'pm.crypto.hmacSha256(message)');
    const key = coerceScriptText(secret, 'pm.crypto.hmacSha256(secret)');
    return crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
  }

  static base64Encode(value: unknown): string {
    const text = coerceScriptText(value, 'pm.encoding.base64Encode');
    return Buffer.from(text, 'utf8').toString('base64');
  }

  static base64Decode(value: unknown): string {
    const text = coerceScriptText(value, 'pm.encoding.base64Decode');
    const cleaned = stripAsciiWhitespace(text);
    if (!isStrictStandardBase64(cleaned)) {
      throw new Error('Invalid Base64 input.');
    }
    return Buffer.from(cleaned, 'base64').toString('utf8');
  }

  static uuidV4(): string {
    return crypto.randomUUID();
  }

  static unixSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  static unixMilliseconds(): number {
    return Date.now();
  }
}

function coerceScriptText(value: unknown, label: string): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
    return String(value);
  }
  throw new TypeError(
    `${label} expects a string, number, boolean, bigint, null, or undefined. Pass JSON.stringify(...) for objects.`
  );
}

function stripAsciiWhitespace(value: string): string {
  return value.replace(/[ \t\r\n]/g, '');
}

function isStrictStandardBase64(value: string): boolean {
  if (value.length === 0) {
    return true;
  }
  if (/[-_]/.test(value)) {
    return false;
  }
  if (value.length % 4 !== 0) {
    return false;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return false;
  }
  const firstPad = value.indexOf('=');
  if (firstPad === -1) {
    return true;
  }
  // Padding only at the end: "=" or "==".
  const padding = value.slice(firstPad);
  return padding === '=' || padding === '==';
}
