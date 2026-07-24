const test = require('node:test');
const assert = require('node:assert/strict');

test('buildConvertScript embeds the cd, the tool command, and the chosen terminal app', () => {
  const { buildConvertScript } = require('../../server/lib/convert');
  const settings = {
    cliTool: 'claude',
    terminalApp: 'Terminal',
    commandTemplates: { claude: 'claude "/gsd:new-project"', codex: 'codex', gemini: 'gemini' },
  };

  const script = buildConvertScript(settings, '/Users/me/my project');

  assert.match(script, /tell application "Terminal" to do script/);
  assert.match(script, /cd \\"\/Users\/me\/my project\\"/);
  assert.match(script, /claude \\"\/gsd:new-project\\"/);
});

test('buildConvertScript falls back to the claude template if cliTool has no template', () => {
  const { buildConvertScript } = require('../../server/lib/convert');
  const settings = {
    cliTool: 'unknown-tool',
    terminalApp: 'iTerm',
    commandTemplates: { claude: 'claude "/gsd:new-project"' },
  };

  const script = buildConvertScript(settings, '/tmp/x');
  assert.match(script, /claude \\"\/gsd:new-project\\"/);
  assert.match(script, /tell application "iTerm"/);
});
