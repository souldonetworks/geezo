const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-settings-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/settings')];
  return require('../../server/lib/settings');
}

test('loadSettings returns defaults when no file exists', () => {
  const settings = freshHome();
  const result = settings.loadSettings();
  assert.equal(result.cliTool, 'claude');
  assert.equal(result.terminalApp, 'Terminal');
  assert.equal(result.commandTemplates.claude, 'claude "/gsd:new-project"');
  assert.equal(result.commandTemplates.codex, 'codex');
});

test('saveSettings merges partial updates and persists them', () => {
  const settings = freshHome();
  settings.saveSettings({ cliTool: 'codex', commandTemplates: { codex: 'codex --resume' } });
  const result = settings.loadSettings();
  assert.equal(result.cliTool, 'codex');
  assert.equal(result.commandTemplates.codex, 'codex --resume');
  assert.equal(result.commandTemplates.claude, 'claude "/gsd:new-project"');
});
