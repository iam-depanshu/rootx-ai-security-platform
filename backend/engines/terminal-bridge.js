const WebSocket = require('ws');
const { getSession, createSandboxSession } = require('./sandbox-manager');

function attachTerminalServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/terminal' });

  wss.on('connection', async (ws, req) => {
    const params = new URL(req.url, 'http://x').searchParams;
    const sessionId = params.get('sessionId');
    if (!sessionId) return ws.close();

    const container = await createSandboxSession(sessionId);

    const exec = await container.exec({
      Cmd: ['/bin/bash'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const stream = await exec.start({ hijack: true, stdin: true });

    stream.on('data', (chunk) => ws.send(chunk.toString('utf8')));
    ws.on('message', (msg) => stream.write(msg));
    ws.on('close', () => stream.end());
  });
}

module.exports = { attachTerminalServer };
