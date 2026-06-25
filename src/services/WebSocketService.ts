import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as net from 'net';
import * as tls from 'tls';
import { URL } from 'url';
import { KeyValue } from '../models/types';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface WebSocketConnectOptions {
  timeoutSec?: number;
  allowInsecureHttps?: boolean;
  maxFrameSizeBytes?: number;
  maxMessageSizeBytes?: number;
}

export interface WebSocketCloseInfo {
  code?: number;
  reason?: string;
  wasClean: boolean;
}

export interface WebSocketMessage {
  type: 'text' | 'binary';
  data: string;
  size: number;
}

export declare interface WebSocketConnection {
  on(event: 'open', listener: () => void): this;
  on(event: 'message', listener: (message: WebSocketMessage) => void): this;
  on(event: 'close', listener: (info: WebSocketCloseInfo) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export class WebSocketConnection extends EventEmitter {
  static readonly DEFAULT_MAX_FRAME_SIZE_BYTES = 1024 * 1024;
  static readonly DEFAULT_MAX_MESSAGE_SIZE_BYTES = 10 * 1024 * 1024;
  static readonly MAX_CONFIGURABLE_SIZE_BYTES = 50 * 1024 * 1024;

  private buffer = Buffer.alloc(0);
  private handshakeComplete = false;
  private closed = false;
  private fragments: Buffer[] = [];
  private fragmentOpcode: number | null = null;
  private fragmentSize = 0;
  private lastPongAt: number | undefined;

  constructor(
    private readonly socket: net.Socket | tls.TLSSocket,
    private readonly expectedAccept: string,
    private readonly timeoutMs: number,
    private readonly maxFrameSizeBytes = WebSocketConnection.DEFAULT_MAX_FRAME_SIZE_BYTES,
    private readonly maxMessageSizeBytes = WebSocketConnection.DEFAULT_MAX_MESSAGE_SIZE_BYTES
  ) {
    super();
    this.bindSocket();
  }

  sendText(message: string): void {
    this.sendFrame(0x1, Buffer.from(message, 'utf-8'));
  }

  sendPing(payload: string | Buffer = ''): void {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
    this.sendFrame(0x9, data.subarray(0, 125));
  }

  getLastPongAt(): number | undefined {
    return this.lastPongAt;
  }

  close(code = 1000, reason = ''): void {
    if (this.closed) { return; }
    if (!this.handshakeComplete) {
      this.closed = true;
      this.socket.destroy();
      return;
    }
    const reasonBuffer = Buffer.from(reason, 'utf-8');
    const payload = Buffer.alloc(Math.min(123, reasonBuffer.length + 2));
    payload.writeUInt16BE(code, 0);
    reasonBuffer.copy(payload, 2, 0, Math.max(0, payload.length - 2));
    this.sendFrame(0x8, payload);
    this.socket.end();
  }

  private bindSocket(): void {
    if (this.timeoutMs > 0) {
      this.socket.setTimeout(this.timeoutMs, () => {
        this.fail(new Error('WebSocket connection timed out'));
      });
    }

    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      if (!this.handshakeComplete) {
        this.consumeHandshake();
      }
      if (this.handshakeComplete) {
        this.consumeFrames();
      }
    });

    this.socket.on('error', (error) => this.fail(error));
    this.socket.on('close', (hadError) => {
      if (this.closed) { return; }
      this.closed = true;
      this.emit('close', {
        code: 1006,
        reason: hadError ? 'Socket closed with error' : 'Abnormal Closure',
        wasClean: false,
      });
    });
  }

  private consumeHandshake(): void {
    const headerEnd = this.buffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) { return; }

    const raw = this.buffer.subarray(0, headerEnd).toString('utf-8');
    this.buffer = this.buffer.subarray(headerEnd + 4);
    const lines = raw.split(/\r\n/);
    const statusLine = lines.shift() || '';
    if (!/^HTTP\/1\.[01] 101\b/.test(statusLine)) {
      this.fail(new Error(`WebSocket upgrade failed: ${statusLine || 'no status line'}`));
      return;
    }

    const headers: Record<string, string> = {};
    for (const line of lines) {
      const index = line.indexOf(':');
      if (index <= 0) { continue; }
      headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    }

    if ((headers['sec-websocket-accept'] || '') !== this.expectedAccept) {
      this.fail(new Error('WebSocket upgrade failed: invalid Sec-WebSocket-Accept header'));
      return;
    }

    this.handshakeComplete = true;
    this.socket.setTimeout(0);
    this.emit('open');
  }

  private consumeFrames(): void {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < offset + 2) { return; }
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) { return; }
        const high = this.buffer.readUInt32BE(offset);
        const low = this.buffer.readUInt32BE(offset + 4);
        if (high !== 0) {
          this.failMessageTooBig('WebSocket frame size exceeded');
          return;
        }
        length = low;
        offset += 8;
      }

      if (length > this.maxFrameSizeBytes) {
        this.failMessageTooBig(`WebSocket frame size exceeded (${length} > ${this.maxFrameSizeBytes} bytes)`);
        return;
      }

      const maskOffset = offset;
      if (masked) { offset += 4; }
      if (this.buffer.length < offset + length) { return; }

      let payload: Buffer<ArrayBufferLike> = this.buffer.subarray(offset, offset + length);
      if (masked) {
        const mask = this.buffer.subarray(maskOffset, maskOffset + 4);
        payload = applyMask(payload, mask);
      }
      this.buffer = this.buffer.subarray(offset + length);
      this.handleFrame(opcode, fin, payload);
    }
  }

  private handleFrame(opcode: number, fin: boolean, payload: Buffer<ArrayBufferLike>): void {
    if (opcode === 0x8) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : undefined;
      const reason = payload.length > 2 ? payload.subarray(2).toString('utf-8') : '';
      if (!this.closed) {
        this.closed = true;
        this.emit('close', { code, reason, wasClean: true });
      }
      this.socket.end();
      return;
    }

    if (opcode === 0x9) {
      this.sendFrame(0xA, payload);
      return;
    }
    if (opcode === 0xA) {
      this.lastPongAt = Date.now();
      return;
    }

    if (opcode === 0x0) {
      if (this.fragmentOpcode === null) { return; }
      this.fragmentSize += payload.length;
      if (this.fragmentSize > this.maxMessageSizeBytes) {
        this.failMessageTooBig(`WebSocket message size exceeded (${this.fragmentSize} > ${this.maxMessageSizeBytes} bytes)`);
        return;
      }
      this.fragments.push(payload);
      if (fin) {
        this.emitMessage(this.fragmentOpcode, Buffer.concat(this.fragments));
        this.fragments = [];
        this.fragmentOpcode = null;
        this.fragmentSize = 0;
      }
      return;
    }

    if (opcode === 0x1 || opcode === 0x2) {
      if (payload.length > this.maxMessageSizeBytes) {
        this.failMessageTooBig(`WebSocket message size exceeded (${payload.length} > ${this.maxMessageSizeBytes} bytes)`);
        return;
      }
      if (fin) {
        this.emitMessage(opcode, payload);
        return;
      }
      this.fragmentOpcode = opcode;
      this.fragments = [payload];
      this.fragmentSize = payload.length;
    }
  }

  private emitMessage(opcode: number, payload: Buffer<ArrayBufferLike>): void {
    if (opcode === 0x1) {
      this.emit('message', { type: 'text', data: payload.toString('utf-8'), size: payload.length });
      return;
    }
    if (opcode === 0x2) {
      this.emit('message', { type: 'binary', data: payload.toString('base64'), size: payload.length });
    }
  }

  private sendFrame(opcode: number, payload: Buffer<ArrayBufferLike>): void {
    if (this.closed) {
      throw new Error('WebSocket is closed');
    }
    const length = payload.length;
    const lengthBytes = length < 126
      ? Buffer.from([0x80 | opcode, 0x80 | length])
      : length <= 0xffff
        ? Buffer.from([0x80 | opcode, 0x80 | 126, (length >> 8) & 0xff, length & 0xff])
        : this.createLargeFrameHeader(opcode, length);
    const mask = crypto.randomBytes(4);
    const maskedPayload = applyMask(payload, mask);
    this.socket.write(Buffer.concat([lengthBytes, mask, maskedPayload]));
  }

  private createLargeFrameHeader(opcode: number, length: number): Buffer {
    const header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
    return header;
  }

  private failMessageTooBig(reason: string): void {
    if (this.handshakeComplete && !this.closed) {
      try {
        const reasonBuffer = Buffer.from('Message Too Big', 'utf-8');
        const payload = Buffer.alloc(2 + reasonBuffer.length);
        payload.writeUInt16BE(1009, 0);
        reasonBuffer.copy(payload, 2);
        this.sendFrame(0x8, payload);
      } catch {
        // Best-effort close frame; the error below is the diagnostic users see.
      }
    }
    this.fragments = [];
    this.fragmentOpcode = null;
    this.fragmentSize = 0;
    this.fail(new Error(reason));
  }

  private fail(error: Error): void {
    if (!this.closed) {
      this.emit('error', error);
    }
    this.closed = true;
    this.socket.destroy();
  }
}

export class WebSocketService {
  connect(urlText: string, headers: KeyValue[], options: WebSocketConnectOptions = {}): WebSocketConnection {
    const url = new URL(urlText);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new Error('WebSocket URL must start with ws:// or wss://');
    }

    const isSecure = url.protocol === 'wss:';
    const port = Number(url.port || (isSecure ? 443 : 80));
    const key = crypto.randomBytes(16).toString('base64');
    const expectedAccept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    const socket = isSecure
      ? tls.connect({
        host: url.hostname,
        port,
        servername: url.hostname,
        rejectUnauthorized: options.allowInsecureHttps === true ? false : true,
      })
      : net.connect({ host: url.hostname, port });
    const connection = new WebSocketConnection(
      socket,
      expectedAccept,
      Math.max(0, options.timeoutSec ?? 0) * 1000,
      WebSocketService.normalizeSizeLimit(
        options.maxFrameSizeBytes,
        WebSocketConnection.DEFAULT_MAX_FRAME_SIZE_BYTES
      ),
      WebSocketService.normalizeSizeLimit(
        options.maxMessageSizeBytes,
        WebSocketConnection.DEFAULT_MAX_MESSAGE_SIZE_BYTES
      )
    );

    const requestHeaders = this.buildHandshakeHeaders(url, key, headers);
    socket.once(isSecure ? 'secureConnect' : 'connect', () => {
      socket.write(requestHeaders);
    });

    return connection;
  }

  private buildHandshakeHeaders(url: URL, key: string, headers: KeyValue[]): string {
    const path = `${url.pathname || '/'}${url.search || ''}`;
    const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
    const lines = [
      `GET ${path} HTTP/1.1`,
      `Host: ${host}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
    ];

    const reserved = new Set([
      'host',
      'upgrade',
      'connection',
      'sec-websocket-key',
      'sec-websocket-version',
      'sec-websocket-accept',
    ]);
    for (const header of headers) {
      if (header.enabled === false || !header.key) { continue; }
      if (reserved.has(header.key.toLowerCase())) { continue; }
      lines.push(`${header.key}: ${header.value}`);
    }

    return `${lines.join('\r\n')}\r\n\r\n`;
  }

  private static normalizeSizeLimit(value: number | undefined, fallback: number): number {
    if (!Number.isFinite(value) || (value ?? 0) <= 0) { return fallback; }
    return Math.min(WebSocketConnection.MAX_CONFIGURABLE_SIZE_BYTES, Math.floor(value as number));
  }
}

function applyMask(payload: Buffer<ArrayBufferLike>, mask: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> {
  const output = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    output[index] = payload[index] ^ mask[index % 4];
  }
  return output as Buffer<ArrayBufferLike>;
}
