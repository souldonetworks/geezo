const fs = require('node:fs');
const path = require('node:path');
const { statusDirFor } = require('./paths');

const STALE_MS = 2 * 60 * 60 * 1000;

function listRunning(projectPath) {
  const dir = statusDirFor(projectPath);
  if (!fs.existsSync(dir)) return [];

  const now = Date.now();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((entry) => ({ ...entry, elapsedMs: now - new Date(entry.startedAt).getTime() }))
    .filter((entry) => entry.elapsedMs < STALE_MS);
}

module.exports = { listRunning, STALE_MS };
