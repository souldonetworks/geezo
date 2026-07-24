const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-sse-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/activityStore')];
  delete require.cache[require.resolve('../../server/lib/sse')];
  return require('../../server/lib/sse');
}

function fakeRes() {
  const chunks = [];
  return {
    chunks,
    write: (chunk) => chunks.push(chunk),
  };
}

test('subscribe sends an immediate snapshot; broadcast pushes updates to subscribers', () => {
  const { createSseHub } = freshHome();
  const hub = createSseHub();
  const res = fakeRes();

  hub.subscribe('proj-1', res, '/some/project');
  assert.equal(res.chunks.length, 1);
  assert.match(res.chunks[0], /^data: /);

  hub.broadcast('proj-1');
  assert.equal(res.chunks.length, 2);

  hub.unsubscribe('proj-1', res);
  hub.broadcast('proj-1');
  assert.equal(res.chunks.length, 2);
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('fs.watch on the project status dir auto-broadcasts on file create/delete, without a manual broadcast() call', async () => {
  const { createSseHub } = freshHome();
  const paths = require('../../server/lib/paths');
  const hub = createSseHub();
  const res = fakeRes();
  const projectPath = '/some/watched/project';

  hub.subscribe('proj-2', res, projectPath);
  assert.equal(res.chunks.length, 1, 'initial snapshot sent on subscribe');

  const dir = paths.statusDirFor(projectPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'tool-1.json'),
    JSON.stringify({
      agentType: 'gsd-executor',
      description: 'watched task',
      startedAt: new Date().toISOString(),
      sessionId: 'sess-watch',
    })
  );

  await wait(200);
  assert.equal(res.chunks.length, 2, 'watcher pushed an update after file creation, with no manual broadcast() call');
  const afterCreate = JSON.parse(res.chunks[1].slice('data: '.length));
  assert.equal(afterCreate.length, 1);
  assert.equal(afterCreate[0].agentType, 'gsd-executor');

  fs.unlinkSync(path.join(dir, 'tool-1.json'));
  await wait(200);
  assert.equal(res.chunks.length, 3, 'watcher pushed an update after file deletion');
  const afterDelete = JSON.parse(res.chunks[2].slice('data: '.length));
  assert.equal(afterDelete.length, 0);

  hub.unsubscribe('proj-2', res);
  fs.writeFileSync(
    path.join(dir, 'tool-2.json'),
    JSON.stringify({
      agentType: 'gsd-executor',
      description: 'after unsubscribe',
      startedAt: new Date().toISOString(),
      sessionId: 'sess-watch-2',
    })
  );
  await wait(200);
  assert.equal(res.chunks.length, 3, 'no further pushes after unsubscribe (watcher stopped)');
});

test('a burst of file events within the debounce window results in a single broadcast', async () => {
  const { createSseHub } = freshHome();
  const paths = require('../../server/lib/paths');
  const hub = createSseHub();
  const res = fakeRes();
  const projectPath = '/some/burst/project';

  hub.subscribe('proj-3', res, projectPath);
  assert.equal(res.chunks.length, 1);

  const dir = paths.statusDirFor(projectPath);
  for (let i = 0; i < 5; i += 1) {
    fs.writeFileSync(
      path.join(dir, `tool-${i}.json`),
      JSON.stringify({
        agentType: 'gsd-executor',
        description: `burst ${i}`,
        startedAt: new Date().toISOString(),
        sessionId: `sess-burst-${i}`,
      })
    );
  }

  await wait(200);
  // Exactly one debounced broadcast should have fired for the whole burst.
  assert.equal(res.chunks.length, 2);
  const payload = JSON.parse(res.chunks[1].slice('data: '.length));
  assert.equal(payload.length, 5);

  hub.unsubscribe('proj-3', res);
});
