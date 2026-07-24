const fs = require('node:fs');
const { settingsFile, gsdWebDir } = require('./paths');

const DEFAULTS = {
  cliTool: 'claude',
  terminalApp: 'Terminal',
  commandTemplates: {
    claude: 'claude "/gsd:new-project"',
    codex: 'codex',
    gemini: 'gemini',
  },
};

function ensureDir() {
  fs.mkdirSync(gsdWebDir(), { recursive: true });
}

function loadSettings() {
  ensureDir();
  if (!fs.existsSync(settingsFile())) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  return {
    ...DEFAULTS,
    ...raw,
    commandTemplates: { ...DEFAULTS.commandTemplates, ...(raw.commandTemplates || {}) },
  };
}

function saveSettings(partial) {
  const current = loadSettings();
  const merged = {
    ...current,
    ...partial,
    commandTemplates: { ...current.commandTemplates, ...(partial.commandTemplates || {}) },
  };
  ensureDir();
  fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
