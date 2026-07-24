const { listRunning } = require('./activityStore');

function createSseHub() {
  const subscribers = new Map();
  const projectPaths = new Map();

  function send(res, projectPath) {
    const payload = JSON.stringify(listRunning(projectPath));
    res.write(`data: ${payload}\n\n`);
  }

  function subscribe(projectId, res, projectPath) {
    if (!subscribers.has(projectId)) subscribers.set(projectId, new Set());
    subscribers.get(projectId).add(res);
    projectPaths.set(projectId, projectPath);
    send(res, projectPath);
  }

  function unsubscribe(projectId, res) {
    const set = subscribers.get(projectId);
    if (set) set.delete(res);
  }

  function broadcast(projectId) {
    const set = subscribers.get(projectId);
    const projectPath = projectPaths.get(projectId);
    if (!set || !projectPath) return;
    for (const res of set) send(res, projectPath);
  }

  return { subscribe, unsubscribe, broadcast };
}

module.exports = { createSseHub };
