import * as assert from 'assert';
import * as http from 'http';
import * as net from 'net';
import { HttpService } from '../../services/HttpService';

describe('HttpService headers-only stream cleanup', () => {
  it('returns headers and closes each endless response socket promptly', async () => {
    const sockets = new Set<net.Socket>();
    let chunksSent = 0;
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'X-Fixture': 'endless' });
      res.flushHeaders();
      const timer = setInterval(() => {
        chunksSent++;
        res.write('data: fixture\n\n');
      }, 20);
      res.on('close', () => clearInterval(timer));
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/`;
    try {
      for (let index = 0; index < 10; index++) {
        const handle = new HttpService().send('GET', url, [], '', { stopAfterHeaders: true });
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          const response = await Promise.race([
            handle.promise,
            new Promise<never>((_resolve, reject) => {
              deadline = setTimeout(() => reject(new Error('Headers did not return promptly')), 1000);
            }),
          ]);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(response.headers['x-fixture'], 'endless');
          assert.strictEqual(response.body, '');
          assert.strictEqual(response.size, 0);
          const closeDeadline = Date.now() + 500;
          while (sockets.size > 0 && Date.now() < closeDeadline) {
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
          }
          assert.strictEqual(sockets.size, 0, `Request ${index + 1} left an endless response socket open (${chunksSent} chunks sent)`);
        } finally {
          clearTimeout(deadline);
          handle.abort();
        }
      }
      const chunksAtCompletion = chunksSent;
      await new Promise<void>((resolve) => setTimeout(resolve, 60));
      assert.strictEqual(chunksSent, chunksAtCompletion);
    } finally {
      for (const socket of sockets) { socket.destroy(); }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
