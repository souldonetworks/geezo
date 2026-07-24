const fs = require('node:fs');
const path = require('node:path');
const { isGsdProject, loadProjects } = require('./registry');

function scanDirectory(parentPath) {
  if (!fs.existsSync(parentPath)) {
    const err = new Error('Path does not exist');
    err.code = 'PATH_NOT_FOUND';
    throw err;
  }
  const resolved = fs.realpathSync(parentPath);
  const registeredPaths = new Set(loadProjects().map((p) => p.path));

  return fs
    .readdirSync(resolved, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const entryPath = path.join(resolved, entry.name);
      let realEntryPath;
      try {
        realEntryPath = fs.realpathSync(entryPath);
      } catch {
        return null;
      }
      return {
        name: entry.name,
        path: realEntryPath,
        isGsdProject: isGsdProject(realEntryPath),
        alreadyRegistered: registeredPaths.has(realEntryPath),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { scanDirectory };
