const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const shellQuote = (value) => "'" + value.replace(/'/g, "'\\''") + "'";
function buildShellCommand(settings, targetPath) {
  const template =
    settings.commandTemplates[settings.cliTool] ||
    settings.commandTemplates.claude;
  return `cd ${shellQuote(targetPath)} && ${template}`;
}
function buildConvertScript(settings, targetPath) {
  if (!["Terminal", "iTerm"].includes(settings.terminalApp))
    throw new Error("Unsupported terminal application");
  const command = buildShellCommand(settings, targetPath)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
  return settings.terminalApp === "iTerm"
    ? `tell application "iTerm"\n create window with default profile command "${command}"\nend tell`
    : `tell application "Terminal" to do script "${command}"`;
}
function launchConvert(settings, targetPath) {
  const resolved = fs.realpathSync(targetPath);
  if (!fs.statSync(resolved).isDirectory())
    throw new Error("Target must be a directory");
  execFileSync("osascript", ["-e", buildConvertScript(settings, resolved)]);
}
module.exports = { buildShellCommand, buildConvertScript, launchConvert };
