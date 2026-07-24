const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function hookEntry(hookScriptPath) {
  return { matcher: 'Task', hooks: [{ type: 'command', command: `node ${hookScriptPath}` }] };
}

function stopHookEntry(hookScriptPath) {
  return { hooks: [{ type: 'command', command: `node ${hookScriptPath}` }] };
}

function hasEntry(list, command) {
  return list.some((entry) => (entry.hooks || []).some((h) => h.command === command));
}

function mergeHookConfig(existing, hookScriptPath) {
  const settings = JSON.parse(JSON.stringify(existing || {}));
  settings.hooks = settings.hooks || {};

  const command = `node ${hookScriptPath}`;

  settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
  if (!hasEntry(settings.hooks.PreToolUse, command)) {
    settings.hooks.PreToolUse.push(hookEntry(hookScriptPath));
  }

  settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];
  if (!hasEntry(settings.hooks.PostToolUse, command)) {
    settings.hooks.PostToolUse.push(hookEntry(hookScriptPath));
  }

  settings.hooks.Stop = settings.hooks.Stop || [];
  if (!hasEntry(settings.hooks.Stop, command)) {
    settings.hooks.Stop.push(stopHookEntry(hookScriptPath));
  }

  return settings;
}

if (require.main === module) {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const hookScriptPath = path.join(__dirname, '..', 'hooks', 'gsd-web-hook.js');

  const existing = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};

  if (fs.existsSync(settingsPath)) {
    const backupPath = `${settingsPath}.bak-${Date.now()}`;
    fs.copyFileSync(settingsPath, backupPath);
    console.log(`Backed up existing settings to ${backupPath}`);
  }

  const merged = mergeHookConfig(existing, hookScriptPath);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
  console.log(`Installed gsd-web hooks into ${settingsPath}`);
}

module.exports = { mergeHookConfig };
