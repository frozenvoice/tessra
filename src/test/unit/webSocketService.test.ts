import * as assert from 'assert';
import * as crypto from 'crypto';
import * as net from 'net';
import { WebSocketMessage, WebSocketService } from '../../services/WebSocketService';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

interface DecodedFrame {
  opcode: number;
  payload: Buffer<ArrayBufferLike>;
  length: number;
}

function decodeClientFrame(buffer: Buffer<ArrayBufferLike>): DecodedFrame | null {
  if (buffer.length < 2) { return null; }
  const first = buffer[0];
  const second = buffer[1];
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) { return null; }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) { return null; }
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    assert.strictEqual(high, 0);
    length = low;
    offset += 8;
  }

  let mask: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  if (masked) {
    if (buffer.length < offset + 4) { return null; }
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + length) { return null; }

  const rawPayload = buffer.subarray(offset, offset + length);
  const payload = Buffer.alloc(rawPayload.length);
  for (let index = 0; index < rawPayload.length; index += 1) {
    payload[index] = masked ? rawPayload[index] ^ mask[index % 4] : rawPayload[index];
  }
  return { opcode: first & 0x0f, payload, length: offset + length };
}

function createServerFrame(opcode: number, payload: Buffer<ArrayBufferLike>): Buffer {
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
  }
  if (payload.length <= 0xffff) {
    return Buffer.concat([
      Buffer.from([0x80 | opcode, 126, (payload.length >> 8) & 0xff, payload.length & 0xff]),
      payload,
    ]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeUInt32BE(0, 2);
  header.writeUInt32BE(payload.length, 6);
  return Buffer.concat([header, payload]);
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe('WebSocketService', () => {
  it('performs a WebSocket handshake and exchanges text frames', async () => {
    let handshake = '';
    let receivedText = '';
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let upgraded = false;

      function consumeFrames(): void {
        while (true) {
          const frame = decodeClientFrame(buffer);
          if (!frame) { return; }
          buffer = buffer.subarray(frame.length);
          if (frame.opcode === 0x8) {
            socket.end();
            return;
          }
          receivedText = frame.payload.toString('utf-8');
          socket.write(createServerFrame(0x1, Buffer.from(`echo:${receivedText}`, 'utf-8')));
        }
      }

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (!upgraded) {
          const headerEnd = buffer.indexOf('\r\n\r\n');
          if (headerEnd < 0) { return; }
          handshake = buffer.subarray(0, headerEnd).toString('utf-8');
          const key = /^Sec-WebSocket-Key:\s*(.+)$/im.exec(handshake)?.[1].trim();
          assert.ok(key, 'client handshake should include Sec-WebSocket-Key');
          const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
          socket.write([
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '',
            '',
          ].join('\r\n'));
          upgraded = true;
          buffer = buffer.subarray(headerEnd + 4);
        }
        consumeFrames();
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const port = (server.address() as net.AddressInfo).port;
      const connection = new WebSocketService().connect(`ws://127.0.0.1:${port}/socket?room=demo`, [
        { key: 'X-Test', value: 'yes', enabled: true },
        { key: 'X-Skip', value: 'no', enabled: false },
      ]);

      const message = await new Promise<WebSocketMessage>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket echo')), 3000);
        connection.on('open', () => connection.sendText('hello'));
        connection.on('message', (event) => {
          clearTimeout(timer);
          resolve(event);
        });
        connection.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      assert.match(handshake, /^GET \/socket\?room=demo HTTP\/1\.1/m);
      assert.match(handshake, /^Upgrade: websocket$/im);
      assert.match(handshake, /^X-Test: yes$/im);
      assert.doesNotMatch(handshake, /^X-Skip: no$/im);
      assert.strictEqual(receivedText, 'hello');
      assert.deepStrictEqual(message, { type: 'text', data: 'echo:hello', size: 10 });
      connection.close();
    } finally {
      await closeServer(server);
    }
  });

  it('rejects non-WebSocket URLs', () => {
    assert.throws(
      () => new WebSocketService().connect('https://example.com', []),
      /WebSocket URL must start with ws:\/\/ or wss:\/\//
    );
  });
});
