const { execFileSync } = require('node:child_process');

function buildConvertScript(settings, targetPath) {
  const template = settings.commandTemplates[settings.cliTool] || settings.commandTemplates.claude;
  const escapedPath = targetPath.replace(/"/g, '\\"');
  const shellCommand = `cd "${escapedPath}" && ${template}`;
  const forOsascript = shellCommand.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `tell application "${settings.terminalApp}" to do script "${forOsascript}"`;
}

function launchConvert(settings, targetPath) {
  const script = buildConvertScript(settings, targetPath);
  execFileSync('osascript', ['-e', script]);
}

module.exports = { buildConvertScript, launchConvert };
