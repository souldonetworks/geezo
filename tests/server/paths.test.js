const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('paths honor GSD_WEB_HOME_OVERRIDE', () => {
  process.env.GSD_WEB_HOME_OVERRIDE = '/tmp/gsd-web-test-home';
  delete require.cache[require.resolve('../../server/lib/paths')];
  const paths = require('../../server/lib/paths');

  assert.equal(paths.gsdWebDir(), '/tmp/gsd-web-test-home');
  assert.equal(paths.projectsFile(), path.join('/tmp/gsd-web-test-home', 'projects.json'));
  assert.equal(paths.settingsFile(), path.join('/tmp/gsd-web-test-home', 'settings.json'));
  assert.equal(paths.statusRootDir(), path.join('/tmp/gsd-web-test-home', 'status'));
  delete process.env.GSD_WEB_HOME_OVERRIDE;
});

test('projectHash is stable and path-normalized', () => {
  delete require.cache[require.resolve('../../server/lib/paths')];
  const paths = require('../../server/lib/paths');
  const h1 = paths.projectHash('/Users/me/project');
  const h2 = paths.projectHash('/Users/me/project/');
  assert.equal(h1, h2);
  assert.match(h1, /^[a-f0-9]{16}$/);
});
