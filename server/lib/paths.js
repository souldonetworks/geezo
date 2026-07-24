const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

function gsdWebDir() {
  return process.env.GSD_WEB_HOME_OVERRIDE || path.join(os.homedir(), '.claude', 'gsd-web');
}

function projectsFile() {
  return path.join(gsdWebDir(), 'projects.json');
}

function settingsFile() {
  return path.join(gsdWebDir(), 'settings.json');
}

function statusRootDir() {
  return path.join(gsdWebDir(), 'status');
}

function projectHash(absPath) {
  const normalized = path.resolve(absPath).replace(/\/+$/, '');
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

function statusDirFor(absPath) {
  return path.join(statusRootDir(), projectHash(absPath));
}

module.exports = { gsdWebDir, projectsFile, settingsFile, statusRootDir, projectHash, statusDirFor };
