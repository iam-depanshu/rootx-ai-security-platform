const Docker = require('dockerode');
const docker = new Docker();

function randomPort(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

async function spinUpLab(templateName, sessionId) {
  const template = require(`../sandbox/lab-templates/${templateName}.json`);
  const hostPort = randomPort(...template.randomize.exposedPortRange);

  const container = await docker.createContainer({
    Image: template.image,
    HostConfig: {
      PortBindings: { '3000/tcp': [{ HostPort: String(hostPort) }] },
      NetworkMode: 'rootx-sandbox-net',
      AutoRemove: true,
    },
  });
  await container.start();

  return { sessionId, accessUrl: `http://localhost:${hostPort}`, containerId: container.id };
}

async function destroyLab(containerId) {
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
  } catch { /* already stopped */ }
}

module.exports = { spinUpLab, destroyLab };
