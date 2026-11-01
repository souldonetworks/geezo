const test = require("node:test");
const assert = require("node:assert/strict");

test("buildConvertScript embeds the cd, the tool command, and the chosen terminal app", () => {
  const { buildConvertScript } = require("../../server/lib/convert");
  const settings = {
    cliTool: "claude",
    terminalApp: "Terminal",
    commandTemplates: {
      claude: 'claude "/gsd:new-project"',
      codex: "codex",
      gemini: "gemini",
    },
  };

  const script = buildConvertScript(settings, "/Users/me/my project");

  assert.match(script, /tell application "Terminal" to do script/);
  assert.ok(script.includes("cd '/Users/me/my project'"));
  assert.match(script, /claude \\"\/gsd:new-project\\"/);
});

test("buildConvertScript falls back to the claude template if cliTool has no template", () => {
  const { buildConvertScript } = require("../../server/lib/convert");
  const settings = {
    cliTool: "unknown-tool",
    terminalApp: "iTerm",
    commandTemplates: { claude: 'claude "/gsd:new-project"' },
  };

  const script = buildConvertScript(settings, "/tmp/x");
  assert.match(script, /claude \\"\/gsd:new-project\\"/);
  assert.match(script, /tell application "iTerm"/);
});

test("conversion keeps shell metacharacters in paths literal and rejects terminal injection", () => {
  const {
    buildShellCommand,
    buildConvertScript,
  } = require("../../server/lib/convert");
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { execFileSync } = require("node:child_process");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "convert '$() ü-"));
  const settings = {
    terminalApp: "Terminal",
    cliTool: "claude",
    commandTemplates: { claude: "pwd -P" },
  };
  assert.equal(
    execFileSync("/bin/sh", ["-c", buildShellCommand(settings, root)], {
      encoding: "utf8",
    }).trim(),
    fs.realpathSync(root),
  );
  assert.throws(
    () =>
      buildConvertScript(
        { ...settings, terminalApp: 'Terminal"\n do shell script "bad' },
        root,
      ),
    /Unsupported terminal/,
  );
});
