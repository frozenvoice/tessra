import * as crypto from 'crypto';
import * as net from 'net';
import type { AddressInfo } from 'net';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface WebSocketEchoServer {
  port: number;
  /** Path-bearing ws URL, e.g. ws://127.0.0.1:PORT/echo */
  url: string;
  receivedTexts: string[];
  close: () => Promise<void>;
  waitForText: (predicate: (text: string) => boolean, timeoutMs?: number) => Promise<string>;
}

interface DecodedFrame {
  opcode: number;
  payload: Buffer;
  length: number;
}

function decodeClientFrame(buffer: Buffer): DecodedFrame | null {
  if (buffer.length < 2) {
    return null;
  }
  const first = buffer[0];
  const second = buffer[1];
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    if (high !== 0) {
      return null;
    }
    length = low;
    offset += 8;
  }

  let mask = Buffer.alloc(0);
  if (masked) {
    if (buffer.length < offset + 4) {
      return null;
    }
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + length) {
    return null;
  }

  const rawPayload = buffer.subarray(offset, offset + length);
  const payload = Buffer.alloc(rawPayload.length);
  for (let index = 0; index < rawPayload.length; index += 1) {
    payload[index] = masked ? rawPayload[index] ^ mask[index % 4] : rawPayload[index];
  }
  return { opcode: first & 0x0f, payload, length: offset + length };
}

function createServerFrame(opcode: number, payload: Buffer, fin = true): Buffer {
  const firstByte = (fin ? 0x80 : 0) | opcode;
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([firstByte, payload.length]), payload]);
  }
  if (payload.length <= 0xffff) {
    return Buffer.concat([
      Buffer.from([firstByte, 126, (payload.length >> 8) & 0xff, payload.length & 0xff]),
      payload,
    ]);
  }
  const header = Buffer.alloc(10);
  header[0] = firstByte;
  header[1] = 127;
  header.writeUInt32BE(0, 2);
  header.writeUInt32BE(payload.length, 6);
  return Buffer.concat([header, payload]);
}

/**
 * Minimal local WebSocket echo fixture for UI E2E.
 * Supports HTTP Upgrade, text echo, ping→pong, and close — Node built-ins only.
 */
export async function startWebSocketEchoServer(): Promise<WebSocketEchoServer> {
  const receivedTexts: string[] = [];

  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let upgraded = false;

    const consumeFrames = (): void => {
      while (true) {
        const frame = decodeClientFrame(buffer);
        if (!frame) {
          return;
        }
        buffer = buffer.subarray(frame.length);
        if (frame.opcode === 0x8) {
          // Echo close and end.
          const closePayload = frame.payload.length >= 2 ? frame.payload.subarray(0, 2) : Buffer.alloc(0);
          try {
            socket.write(createServerFrame(0x8, closePayload));
          } catch {
            /* ignore write-after-close */
          }
          socket.end();
          return;
        }
        if (frame.opcode === 0x9) {
          // Protocol ping → pong (keep Tessra keepalive path healthy if enabled).
          try {
            socket.write(createServerFrame(0xa, frame.payload));
          } catch {
            /* ignore */
          }
          continue;
        }
        if (frame.opcode === 0xa) {
          continue;
        }
        if (frame.opcode === 0x1) {
          const text = frame.payload.toString('utf8');
          receivedTexts.push(text);
          try {
            socket.write(createServerFrame(0x1, Buffer.from(text, 'utf8')));
          } catch {
            /* ignore */
          }
        }
      }
    };

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) {
          return;
        }
        const handshake = buffer.subarray(0, headerEnd).toString('utf8');
        const key = /^Sec-WebSocket-Key:\s*(.+)$/im.exec(handshake)?.[1]?.trim();
        if (!key) {
          socket.destroy();
          return;
        }
        const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
        socket.write(
          [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '',
            '',
          ].join('\r\n')
        );
        upgraded = true;
        buffer = buffer.subarray(headerEnd + 4);
      }
      consumeFrames();
    });

    socket.on('error', () => {
      /* fixture sockets may close abruptly during harness teardown */
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  const port = address.port;
  const url = `ws://127.0.0.1:${port}/echo`;

  const waitForText = async (
    predicate: (text: string) => boolean,
    timeoutMs = 15000
  ): Promise<string> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const hit = [...receivedTexts].reverse().find(predicate);
      if (hit !== undefined) {
        return hit;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`WebSocket echo server did not receive matching text within ${timeoutMs}ms`);
  };

  return {
    port,
    url,
    receivedTexts,
    waitForText,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
