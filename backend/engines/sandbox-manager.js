const Docker = require('dockerode');
const docker = new Docker();

const activeSessions = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

async function createSandboxSession(sessionId) {
  if (activeSessions.has(sessionId)) {
    return activeSessions.get(sessionId).container;
  }

  const container = await docker.createContainer({
    Image: 'rootx-kali',
    Tty: true,
    OpenStdin: true,
    HostConfig: {
      Memory: 512 * 1024 * 1024,
      NanoCpus: 1_000_000_000,
      CapDrop: ['ALL'],
      CapAdd: ['NET_RAW', 'NET_ADMIN'],
      SecurityOpt: ['no-new-privileges'],
      NetworkMode: 'rootx-sandbox-net',
      AutoRemove: true,
    },
    Cmd: ['/bin/bash'],
  });

  await container.start();

  const timeout = setTimeout(() => destroySandboxSession(sessionId), SESSION_TIMEOUT_MS);
  activeSessions.set(sessionId, { container, timeout });

  return container;
}

async function destroySandboxSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  clearTimeout(session.timeout);
  try {
    await session.container.stop();
  } catch { /* already stopped */ }
  activeSessions.delete(sessionId);
}

function getSession(sessionId) {
  return activeSessions.get(sessionId)?.container;
}

module.exports = { createSandboxSession, destroySandboxSession, getSession };
