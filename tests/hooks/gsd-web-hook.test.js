const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-hook-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../hooks/gsd-web-hook')];
  return { hook: require('../../hooks/gsd-web-hook'), paths: require('../../server/lib/paths') };
}

test('PreToolUse for a Task writes a status file; PostToolUse removes it', () => {
  const { hook, paths } = freshHome();
  const cwd = '/some/project';

  hook.handle({
    hook_event_name: 'PreToolUse',
    tool_name: 'Task',
    tool_use_id: 'tool-1',
    cwd,
    session_id: 'sess-1',
    tool_input: { subagent_type: 'gsd-executor', description: 'Plan 01-01 scaffold' },
  });

  const dir = paths.statusDirFor(cwd);
  const file = path.join(dir, 'tool-1.json');
  assert.equal(fs.existsSync(file), true);
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(payload.agentType, 'gsd-executor');
  assert.equal(payload.description, 'Plan 01-01 scaffold');
  assert.equal(payload.sessionId, 'sess-1');

  hook.handle({ hook_event_name: 'PostToolUse', tool_name: 'Task', tool_use_id: 'tool-1', cwd });
  assert.equal(fs.existsSync(file), false);
});

test('Stop cleans up any leftover files for that session across all projects', () => {
  const { hook, paths } = freshHome();
  const cwdA = '/project/a';
  const cwdB = '/project/b';

  hook.handle({
    hook_event_name: 'PreToolUse',
    tool_name: 'Task',
    tool_use_id: 'tool-a',
    cwd: cwdA,
    session_id: 'sess-x',
    tool_input: { subagent_type: 'gsd-executor', description: 'a' },
  });
  hook.handle({
    hook_event_name: 'PreToolUse',
    tool_name: 'Task',
    tool_use_id: 'tool-b',
    cwd: cwdB,
    session_id: 'sess-x',
    tool_input: { subagent_type: 'gsd-planner', description: 'b' },
  });

  hook.handle({ hook_event_name: 'Stop', session_id: 'sess-x' });

  assert.equal(fs.existsSync(path.join(paths.statusDirFor(cwdA), 'tool-a.json')), false);
  assert.equal(fs.existsSync(path.join(paths.statusDirFor(cwdB), 'tool-b.json')), false);
});

test('handle never throws on malformed input', () => {
  const { hook } = freshHome();
  assert.doesNotThrow(() => hook.handle({}));
  assert.doesNotThrow(() => hook.handle({ hook_event_name: 'PreToolUse', tool_name: 'Task' }));
});
