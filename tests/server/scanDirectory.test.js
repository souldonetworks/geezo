const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-scan-home-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/registry')];
  delete require.cache[require.resolve('../../server/lib/scanDirectory')];
  return {
    scanDirectory: require('../../server/lib/scanDirectory').scanDirectory,
    registry: require('../../server/lib/registry'),
  };
}

test('scanDirectory rejects a nonexistent parent path', () => {
  const { scanDirectory } = freshHome();
  assert.throws(() => scanDirectory('/no/such/parent/at/all'), (err) => err.code === 'PATH_NOT_FOUND');
});

test('scanDirectory lists immediate subfolders, flagging GSD status and registration', () => {
  const { scanDirectory, registry } = freshHome();
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-parent-'));

  const gsdProject = path.join(parent, 'is-gsd');
  fs.mkdirSync(path.join(gsdProject, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(gsdProject, '.planning', 'ROADMAP.md'), '# Roadmap');

  const plainFolder = path.join(parent, 'not-gsd');
  fs.mkdirSync(plainFolder);

  const registeredProject = path.join(parent, 'already-added');
  fs.mkdirSync(path.join(registeredProject, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(registeredProject, '.planning', 'ROADMAP.md'), '# Roadmap');
  registry.addProject(registeredProject);

  fs.writeFileSync(path.join(parent, 'a-file.txt'), 'not a directory');
  fs.mkdirSync(path.join(parent, '.hidden'));

  const results = scanDirectory(parent);
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));

  assert.equal(results.length, 3);
  assert.equal(byName['is-gsd'].isGsdProject, true);
  assert.equal(byName['is-gsd'].alreadyRegistered, false);
  assert.equal(byName['not-gsd'].isGsdProject, false);
  assert.equal(byName['already-added'].isGsdProject, true);
  assert.equal(byName['already-added'].alreadyRegistered, true);
  assert.equal(byName['already-added'].path, fs.realpathSync(registeredProject));
  assert.equal(byName['a-file.txt'], undefined);
  assert.equal(byName['.hidden'], undefined);
});
