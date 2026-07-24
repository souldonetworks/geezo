const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-activity-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/activityStore')];
  return { activityStore: require('../../server/lib/activityStore'), paths: require('../../server/lib/paths') };
}

test('listRunning returns an empty array when no status dir exists', () => {
  const { activityStore } = freshHome();
  assert.deepEqual(activityStore.listRunning('/some/project'), []);
});

test('listRunning reads fresh entries and skips stale/corrupt ones', () => {
  const { activityStore, paths } = freshHome();
  const projectPath = '/some/project';
  const dir = paths.statusDirFor(projectPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'fresh.json'),
    JSON.stringify({ agentType: 'gsd-executor', description: 'Plan 01-01', startedAt: new Date().toISOString(), sessionId: 's1' })
  );
  const staleDate = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(
    path.join(dir, 'stale.json'),
    JSON.stringify({ agentType: 'gsd-planner', description: 'old', startedAt: staleDate, sessionId: 's2' })
  );
  fs.writeFileSync(path.join(dir, 'corrupt.json'), '{not json');

  const running = activityStore.listRunning(projectPath);
  assert.equal(running.length, 1);
  assert.equal(running[0].agentType, 'gsd-executor');
  assert.equal(typeof running[0].elapsedMs, 'number');
});
