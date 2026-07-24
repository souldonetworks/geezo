const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('mergeHookConfig adds PreToolUse/PostToolUse/Stop hook entries', () => {
  const { mergeHookConfig } = require('../../scripts/install-hook');
  const result = mergeHookConfig({}, 'node /path/to/gsd-web-hook.js');

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

  const once = mergeHookConfig(existing, 'node /path/to/gsd-web-hook.js');
  const twice = mergeHookConfig(once, 'node /path/to/gsd-web-hook.js');

  assert.equal(twice.hooks.PreToolUse.length, 2);
  assert.deepEqual(twice, once);
});

test('installHooks writes hook entries verbatim and creates a backup on re-install', () => {
  const { installHooks } = require('../../scripts/install-hook');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-hook-'));
  const settingsPath = path.join(dir, 'settings.json');
  const hookCommand = '/abs/path/to/geezo-darwin-arm64 hook';

  assert.equal(typeof installHooks, 'function');

  installHooks(hookCommand, settingsPath);
  assert.equal(fs.existsSync(settingsPath), true);
  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.hooks.PreToolUse[0].hooks[0].command, hookCommand);
  assert.equal(written.hooks.PostToolUse[0].hooks[0].command, hookCommand);
  assert.equal(written.hooks.Stop[0].hooks[0].command, hookCommand);

  const beforeSecondInstall = fs.readdirSync(dir);
  assert.equal(beforeSecondInstall.some((f) => f.startsWith('settings.json.bak-')), false);

  installHooks(hookCommand, settingsPath);
  const afterSecondInstall = fs.readdirSync(dir);
  assert.equal(afterSecondInstall.some((f) => f.startsWith('settings.json.bak-')), true);

  const rewritten = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(rewritten.hooks.PreToolUse.length, 1);
  assert.equal(rewritten.hooks.PostToolUse.length, 1);
  assert.equal(rewritten.hooks.Stop.length, 1);
});
