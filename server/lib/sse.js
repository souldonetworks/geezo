const fs = require('node:fs');
const { listRunning } = require('./activityStore');
const { statusDirFor } = require('./paths');

const DEBOUNCE_MS = 50;

function createSseHub() {
  const subscribers = new Map();
  const projectPaths = new Map();
  const watchers = new Map();
  const debounceTimers = new Map();

  function send(res, projectPath) {
    const payload = JSON.stringify(listRunning(projectPath));
    res.write(`data: ${payload}\n\n`);
  }

  function ensureWatcher(projectId, projectPath) {
    if (watchers.has(projectId)) return;
    const dir = statusDirFor(projectPath);
    try {
      fs.mkdirSync(dir, { recursive: true });
      const watcher = fs.watch(dir, () => {
        const existingTimer = debounceTimers.get(projectId);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          debounceTimers.delete(projectId);
          broadcast(projectId);
        }, DEBOUNCE_MS);
        if (typeof timer.unref === 'function') timer.unref();
        debounceTimers.set(projectId, timer);
      });
      watchers.set(projectId, watcher);
    } catch {
      // If the status directory can't be watched (e.g. permissions), the
      // live panel simply won't auto-refresh; the initial snapshot still works.
    }
  }

  function stopWatcher(projectId) {
    const watcher = watchers.get(projectId);
    if (watcher) {
      watcher.close();
      watchers.delete(projectId);
    }
    const timer = debounceTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(projectId);
    }
    projectPaths.delete(projectId);
  }

  function subscribe(projectId, res, projectPath) {
    if (!subscribers.has(projectId)) subscribers.set(projectId, new Set());
    subscribers.get(projectId).add(res);
    projectPaths.set(projectId, projectPath);
    send(res, projectPath);
    ensureWatcher(projectId, projectPath);
  }

  function unsubscribe(projectId, res) {
    const set = subscribers.get(projectId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) {
      subscribers.delete(projectId);
      stopWatcher(projectId);
    }
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
