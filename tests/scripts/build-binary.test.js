const test = require('node:test');
const assert = require('node:assert/strict');

test('getTargets returns 5 targets with exact outfile and bunTarget values', () => {
  const { getTargets } = require('../../scripts/build-binary');
  const targets = getTargets();

  assert.equal(targets.length, 5);
  assert.deepEqual(
    targets.map((t) => t.outfile),
    [
      'geezo-darwin-arm64',
      'geezo-darwin-x64',
      'geezo-linux-x64',
      'geezo-linux-arm64',
      'geezo-windows-x64.exe',
    ]
  );
  assert.deepEqual(
    targets.map((t) => t.bunTarget),
    ['bun-darwin-arm64', 'bun-darwin-x64', 'bun-linux-x64', 'bun-linux-arm64', 'bun-windows-x64']
  );
});

test('only windows-x64 target outfile ends in .exe', () => {
  const { getTargets } = require('../../scripts/build-binary');
  const targets = getTargets();

  const exeTargets = targets.filter((t) => t.outfile.endsWith('.exe'));
  assert.equal(exeTargets.length, 1);
  assert.equal(exeTargets[0].platform, 'windows-x64');
});

test('checkBunAvailable returns a boolean without throwing', () => {
  const { checkBunAvailable } = require('../../scripts/build-binary');
  const result = checkBunAvailable();

  assert.equal(typeof result, 'boolean');
});
