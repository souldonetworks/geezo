const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-app-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  for (const mod of ['paths', 'registry', 'settings', 'activityStore', 'sse']) {
    delete require.cache[require.resolve(`../../server/lib/${mod}`)];
  }
  delete require.cache[require.resolve('../../server/app')];
  return require('../../server/app');
}

test('POST /api/projects rejects a non-GSD folder with 409 NOT_GSD_PROJECT, then accepts after adding .planning', async () => {
  const { createApp } = freshHome();
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://localhost:${port}`;

  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'app-test-project-'));

  const rejectRes = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: target }),
  });
  assert.equal(rejectRes.status, 409);
  const rejectBody = await rejectRes.json();
  assert.equal(rejectBody.code, 'NOT_GSD_PROJECT');

  fs.mkdirSync(path.join(target, '.planning'));
  fs.writeFileSync(path.join(target, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phases\n');

  const acceptRes = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: target }),
  });
  assert.equal(acceptRes.status, 201);
  const project = await acceptRes.json();
  assert.equal(project.path, fs.realpathSync(target));

  const listRes = await fetch(`${base}/api/projects`);
  const list = await listRes.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, project.id);

  const roadmapRes = await fetch(`${base}/api/projects/${project.id}/roadmap`);
  assert.equal(roadmapRes.status, 200);
  const roadmap = await roadmapRes.json();
  assert.deepEqual(roadmap.phases, []);

  const gitRes = await fetch(`${base}/api/projects/${project.id}/git`);
  assert.equal(gitRes.status, 200);
  const git = await gitRes.json();
  assert.equal(git.status, 'not-a-repo');

  const deleteRes = await fetch(`${base}/api/projects/${project.id}`, { method: 'DELETE' });
  assert.equal(deleteRes.status, 204);

  server.close();
});

test('GET/PUT /api/settings round-trips a partial update', async () => {
  const { createApp } = freshHome();
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://localhost:${port}`;

  const initial = await (await fetch(`${base}/api/settings`)).json();
  assert.equal(initial.cliTool, 'claude');

  const putRes = await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliTool: 'gemini' }),
  });
  const updated = await putRes.json();
  assert.equal(updated.cliTool, 'gemini');

  server.close();
});
