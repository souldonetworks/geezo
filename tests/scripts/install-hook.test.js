const test = require('node:test');
const assert = require('node:assert/strict');

test('mergeHookConfig adds PreToolUse/PostToolUse/Stop hook entries', () => {
  const { mergeHookConfig } = require('../../scripts/install-hook');
  const result = mergeHookConfig({}, '/path/to/gsd-web-hook.js');

  assert.equal(result.hooks.PreToolUse.length, 1);
  assert.equal(result.hooks.PreToolUse[0].matcher, 'Task');
  assert.equal(result.hooks.PreToolUse[0].hooks[0].command, 'node /path/to/gsd-web-hook.js');
  assert.equal(result.hooks.PostToolUse.length, 1);
  assert.equal(result.hooks.Stop.length, 1);
});

test('mergeHookConfig is idempotent and preserves unrelated existing hooks', () => {
  const { mergeHookConfig } = require('../../scripts/install-hook');
  const existing = {
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }],
    },
  };

  const once = mergeHookConfig(existing, '/path/to/gsd-web-hook.js');
  const twice = mergeHookConfig(once, '/path/to/gsd-web-hook.js');

  assert.equal(twice.hooks.PreToolUse.length, 2);
  assert.deepEqual(twice, once);
});
