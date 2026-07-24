const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function run(cwd, args) {
  execFileSync('git', args, { cwd });
}

test('getMilestone reports not-a-repo for a plain directory', () => {
  const { getMilestone } = require('../../server/lib/gitMilestone');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitless-'));
  assert.equal(getMilestone(dir).status, 'not-a-repo');
});

test('getMilestone reports no-remote when there is no upstream', () => {
  const { getMilestone } = require('../../server/lib/gitMilestone');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  run(dir, ['init', '-q']);
  run(dir, ['config', 'user.email', 'test@example.com']);
  run(dir, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  run(dir, ['add', 'a.txt']);
  run(dir, ['commit', '-q', '-m', 'init']);
  assert.equal(getMilestone(dir).status, 'no-remote');
});

test('getMilestone finds the newest tag reachable from the remote-tracking branch', () => {
  const { getMilestone } = require('../../server/lib/gitMilestone');

  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-'));
  run(remote, ['init', '-q', '--bare']);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'withremote-'));
  run(dir, ['init', '-q', '-b', 'main']);
  run(dir, ['config', 'user.email', 'test@example.com']);
  run(dir, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  run(dir, ['add', 'a.txt']);
  run(dir, ['commit', '-q', '-m', 'first commit']);
  run(dir, ['tag', '-a', 'v1.0.0', '-m', 'first release']);
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
  run(dir, ['add', 'b.txt']);
  run(dir, ['commit', '-q', '-m', 'second commit']);
  run(dir, ['remote', 'add', 'origin', remote]);
  run(dir, ['push', '-q', 'origin', 'main']);
  run(dir, ['branch', '--set-upstream-to=origin/main', 'main']);

  const result = getMilestone(dir);
  assert.equal(result.status, 'ok');
  assert.equal(result.tag, 'v1.0.0');
  assert.equal(result.message, 'first release');
});
