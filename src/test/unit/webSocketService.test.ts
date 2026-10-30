import * as assert from 'assert';
import * as crypto from 'crypto';
import * as net from 'net';
import { WebSocketCloseInfo, WebSocketConnection, WebSocketMessage, WebSocketService } from '../../services/WebSocketService';

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

function createServerFrame(opcode: number, payload: Buffer<ArrayBufferLike>, fin = true): Buffer {
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

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe('WebSocketService', () => {
  it('거대한 미완성 upgrade 응답을 거절하고 이후 수신도 무시한다', () => {
    const socket = new net.Socket();
    const connection = new WebSocketConnection(socket, 'accept', 1000);
    const errors: Error[] = [];
    connection.on('error', error => errors.push(error));
    socket.emit('data', Buffer.alloc(4 * 1024 * 1024, 'a'));
    socket.emit('data', Buffer.alloc(1024, 'a'));
    assert.strictEqual(socket.destroyed, true);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0].message, /handshake headers exceeded/);
  });

  it('헤더가 여러 chunk에 나뉘어도 upgrade 상한을 적용한다', () => {
    const socket = new net.Socket();
    const connection = new WebSocketConnection(socket, 'accept', 1000);
    let error: Error | undefined;
    connection.on('error', value => { error = value; });
    socket.emit('data', Buffer.alloc(10 * 1024, 'a'));
    assert.strictEqual(socket.destroyed, false);
    socket.emit('data', Buffer.alloc(7 * 1024, 'a'));
    assert.strictEqual(socket.destroyed, true);
    assert.match(error!.message, /handshake headers exceeded/);
  });

  it('upgrade와 같은 chunk에 온 정상 대형 프레임은 헤더 상한으로 거절하지 않는다', () => {
    const socket = new net.Socket();
    const connection = new WebSocketConnection(socket, 'accept', 1000);
    let opened = false;
    let message: WebSocketMessage | undefined;
    connection.on('open', () => { opened = true; });
    connection.on('message', value => { message = value; });
    connection.on('error', error => { throw error; });
    const payload = Buffer.alloc(32 * 1024, 'a');
    socket.emit('data', Buffer.concat([
      Buffer.from('HTTP/1.1 101 Switching Protocols\r\nSec-WebSocket-Accept: accept\r\n\r\n'),
      createServerFrame(0x1, payload),
    ]));
    assert.strictEqual(opened, true);
    assert.strictEqual(message?.data, payload.toString());
    connection.close();
    socket.destroy();
  });

  it('응답 조각이 계속 와도 전체 handshake deadline에 연결을 닫는다', async () => {
    const socket = new net.Socket();
    const connection = new WebSocketConnection(socket, 'accept', 50);
    const drip = setInterval(() => socket.emit('data', Buffer.from('a')), 5);
    try {
      const error = await new Promise<Error>((resolve, reject) => {
        const guard = setTimeout(() => reject(new Error('handshake deadline did not fire')), 1000);
        connection.on('error', value => { clearTimeout(guard); resolve(value); });
      });
      assert.match(error.message, /handshake timed out/);
      assert.strictEqual(socket.destroyed, true);
    } finally {
      clearInterval(drip);
      socket.destroy();
    }
  });

  it('최종 요청 헤더의 줄바꿈·잘못된 이름을 socket 생성 전에 거절한다', () => {
    for (const header of [
      { key: 'X-Test', value: 'ok\r\nX-Injected: yes' },
      { key: 'Bad\r\nName', value: 'yes' },
      { key: 'Bad Name', value: 'yes' },
      { key: 'X-Test', value: 'bad\0value' },
    ]) {
      assert.throws(() => new WebSocketService().connect('ws://127.0.0.1:9/', [{ ...header, enabled: true }]), /header|token|Invalid/i);
    }
  });

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

  it('reports clean remote close diagnostics', async () => {
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let upgraded = false;
      socket.on('data', (chunk) => {
        if (upgraded) { return; }
        buffer = Buffer.concat([buffer, chunk]);
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) { return; }
        upgraded = true;
        const handshake = buffer.subarray(0, headerEnd).toString('utf-8');
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
        const reason = Buffer.from('Normal Closure', 'utf-8');
        const payload = Buffer.alloc(2 + reason.length);
        payload.writeUInt16BE(1000, 0);
        reason.copy(payload, 2);
        socket.write(createServerFrame(0x8, payload));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const port = (server.address() as net.AddressInfo).port;
      const connection = new WebSocketService().connect(`ws://127.0.0.1:${port}/socket`, []);
      const closeInfo = await new Promise<WebSocketCloseInfo>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket close')), 3000);
        connection.on('close', (info) => {
          clearTimeout(timer);
          resolve(info);
        });
        connection.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      assert.deepStrictEqual(closeInfo, { code: 1000, reason: 'Normal Closure', wasClean: true });
    } finally {
      await closeServer(server);
    }
  });

  it('reports abnormal socket close diagnostics when no close frame is received', async () => {
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let upgraded = false;
      socket.on('data', (chunk) => {
        if (upgraded) { return; }
        buffer = Buffer.concat([buffer, chunk]);
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) { return; }
        upgraded = true;
        const handshake = buffer.subarray(0, headerEnd).toString('utf-8');
        const key = /^Sec-WebSocket-Key:\s*(.+)$/im.exec(handshake)?.[1].trim();
        assert.ok(key, 'client handshake should include Sec-WebSocket-Key');
        const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
        socket.end([
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${accept}`,
          '',
          '',
        ].join('\r\n'));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const port = (server.address() as net.AddressInfo).port;
      const connection = new WebSocketService().connect(`ws://127.0.0.1:${port}/socket`, []);
      const closeInfo = await new Promise<WebSocketCloseInfo>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket close')), 3000);
        connection.on('close', (info) => {
          clearTimeout(timer);
          resolve(info);
        });
        connection.on('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      assert.deepStrictEqual(closeInfo, { code: 1006, reason: 'Abnormal Closure', wasClean: false });
    } finally {
      await closeServer(server);
    }
  });

  it('sends protocol ping frames and records pong timestamps', async () => {
    let receivedPingPayload = '';
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let upgraded = false;

      function consumeFrames(): void {
        while (true) {
          const frame = decodeClientFrame(buffer);
          if (!frame) { return; }
          buffer = buffer.subarray(frame.length);
          if (frame.opcode === 0x9) {
            receivedPingPayload = frame.payload.toString('utf-8');
            socket.write(createServerFrame(0xA, frame.payload));
          }
        }
      }

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (!upgraded) {
          const headerEnd = buffer.indexOf('\r\n\r\n');
          if (headerEnd < 0) { return; }
          upgraded = true;
          const handshake = buffer.subarray(0, headerEnd).toString('utf-8');
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
      const connection = new WebSocketService().connect(`ws://127.0.0.1:${port}/socket`, []);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for pong')), 3000);
        connection.on('open', () => connection.sendPing('ka'));
        const poll = setInterval(() => {
          if (connection.getLastPongAt()) {
            clearTimeout(timer);
            clearInterval(poll);
            resolve();
          }
        }, 10);
        connection.on('error', (error) => {
          clearTimeout(timer);
          clearInterval(poll);
          reject(error);
        });
      });

      assert.strictEqual(receivedPingPayload, 'ka');
      assert.ok(connection.getLastPongAt());
      connection.close();
    } finally {
      await closeServer(server);
    }
  });

  it('rejects incoming frames above the configured frame size limit before buffering payloads', async () => {
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let upgraded = false;
      socket.on('error', () => undefined);
      socket.on('data', (chunk) => {
        if (upgraded) { return; }
        buffer = Buffer.concat([buffer, chunk]);
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) { return; }
        upgraded = true;
        const handshake = buffer.subarray(0, headerEnd).toString('utf-8');
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
        socket.write(createServerFrame(0x1, Buffer.alloc(6)));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const port = (server.address() as net.AddressInfo).port;
      const connection = new WebSocketService().connect(`ws://127.0.0.1:${port}/socket`, [], {
        maxFrameSizeBytes: 5,
      });
      await assert.rejects(
        () => new Promise<void>((resolve, reject) => {
          connection.on('message', () => resolve());
          connection.on('error', reject);
        }),
        /frame size exceeded/
      );
    } finally {
      await closeServer(server);
    }
  });

  it('rejects fragmented messages above the configured message size limit', async () => {
    const server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);
      let upgraded = false;
      socket.on('error', () => undefined);
      socket.on('data', (chunk) => {
        if (upgraded) { return; }
        buffer = Buffer.concat([buffer, chunk]);
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) { return; }
        upgraded = true;
        const handshake = buffer.subarray(0, headerEnd).toString('utf-8');
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
        socket.write(createServerFrame(0x1, Buffer.from('abcd'), false));
        socket.write(createServerFrame(0x0, Buffer.from('efgh'), true));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const port = (server.address() as net.AddressInfo).port;
      const connection = new WebSocketService().connect(`ws://127.0.0.1:${port}/socket`, [], {
        maxFrameSizeBytes: 1024,
        maxMessageSizeBytes: 6,
      });
      await assert.rejects(
        () => new Promise<void>((resolve, reject) => {
          connection.on('message', () => resolve());
          connection.on('error', reject);
        }),
        /message size exceeded/
      );
    } finally {
      await closeServer(server);
    }
  });
});
