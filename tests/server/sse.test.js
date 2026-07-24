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
