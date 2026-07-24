const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeFixtureDir() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-manifest-'));
  fs.writeFileSync(path.join(fixtureDir, 'index.html'), '<html></html>');
  fs.mkdirSync(path.join(fixtureDir, 'assets'));
  fs.writeFileSync(path.join(fixtureDir, 'assets', 'index-abc123.js'), 'console.log(1);');
  return fixtureDir;
}

test('generateManifestSource produces import statements and manifest entries for a fixture directory', () => {
  const { generateManifestSource } = require('../../scripts/generate-assets-manifest');
  const fixtureDir = makeFixtureDir();

  const result = generateManifestSource(fixtureDir);

  const importMatches = result.match(/with \{ type: "file" \}/g) || [];
  assert.equal(importMatches.length, 2);
  assert.match(result, /export const manifest = \{/);
  assert.match(result, /"\/index\.html"/);
  assert.match(result, /"\/assets\/index-abc123\.js"/);
});

test('generateManifestSource emits relative import paths, not absolute filesystem paths', () => {
  const { generateManifestSource } = require('../../scripts/generate-assets-manifest');
  const fixtureDir = makeFixtureDir();

  const result = generateManifestSource(fixtureDir);

  assert.equal(result.includes(fixtureDir), false);
  assert.match(result, /from "\.\.\//);
});

test('generateManifestSource throws when distDir does not exist', () => {
  const { generateManifestSource } = require('../../scripts/generate-assets-manifest');
  const missingDir = path.join(os.tmpdir(), `does-not-exist-${Date.now()}-${Math.random()}`);

  assert.throws(() => generateManifestSource(missingDir), Error);
});
