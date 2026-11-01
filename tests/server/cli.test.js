const test = require('node:test');
const assert = require('node:assert/strict');

const { dispatch, resolvePort, resolveHost, serveEmbeddedAsset, resolveAssetPath } = require('../../server/cli');
const pkg = require('../../package.json');

function captureConsole(fn) {
  const logCalls = [];
  const errorCalls = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => logCalls.push(args);
  console.error = (...args) => errorCalls.push(args);
  try {
    const result = fn();
    return { result, logCalls, errorCalls };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('dispatch([]) prints usage and returns 0', () => {
  const { result, logCalls } = captureConsole(() => dispatch([]));
  assert.equal(result, 0);
  const output = logCalls.map((args) => args.join(' ')).join('\n');
  assert.match(output, /serve/);
  assert.match(output, /hook/);
  assert.match(output, /install-hook/);
});

test("dispatch(['--help']) prints usage and returns 0", () => {
  const { result, logCalls } = captureConsole(() => dispatch(['--help']));
  assert.equal(result, 0);
  const output = logCalls.map((args) => args.join(' ')).join('\n');
  assert.match(output, /serve/);
  assert.match(output, /hook/);
  assert.match(output, /install-hook/);
});

test("dispatch(['-h']) prints usage and returns 0", () => {
  const { result, logCalls } = captureConsole(() => dispatch(['-h']));
  assert.equal(result, 0);
  const output = logCalls.map((args) => args.join(' ')).join('\n');
  assert.match(output, /serve/);
  assert.match(output, /hook/);
  assert.match(output, /install-hook/);
});

test("dispatch(['--version']) prints package version and returns 0", () => {
  const { result, logCalls } = captureConsole(() => dispatch(['--version']));
  assert.equal(result, 0);
  assert.equal(logCalls.length, 1);
  assert.equal(logCalls[0][0], pkg.version);
});

test("dispatch(['bogus-command']) returns 1 and prints Unknown command to stderr", () => {
  const { result, errorCalls } = captureConsole(() => dispatch(['bogus-command']));
  assert.equal(result, 1);
  const output = errorCalls.map((args) => args.join(' ')).join('\n');
  assert.match(output, /Unknown command: bogus-command/);
});

test('resolvePort: flag takes precedence over env (D-02)', () => {
  assert.equal(resolvePort({ portFlag: '5000', portEnv: '6000' }), 5000);
});

test('resolvePort: env used when flag absent', () => {
  assert.equal(resolvePort({ portFlag: undefined, portEnv: '6000' }), 6000);
});

test('resolvePort: defaults to 4317 when neither set', () => {
  assert.equal(resolvePort({ portFlag: undefined, portEnv: undefined }), 4317);
});

test('resolveHost: defaults to localhost (D-04)', () => {
  assert.equal(resolveHost(undefined), 'localhost');
});

test('resolveHost: returns explicit host flag', () => {
  assert.equal(resolveHost('0.0.0.0'), '0.0.0.0');
});

test("dispatch(['serve', '--port', 'not-a-number']) returns 1 without throwing, stderr contains Invalid port", () => {
  const { result, errorCalls } = captureConsole(() => dispatch(['serve', '--port', 'not-a-number']));
  assert.equal(result, 1);
  const output = errorCalls.map((args) => args.join(' ')).join('\n');
  assert.match(output, /Invalid port/);
});

// PKG-06 / T-07-01: server/generatedAssets.mjs is gitignored and only produced by
// Plan 07-02's asset-manifest generator against a real web/dist/ build, so it is
// absent in a fresh checkout/test run. This directly invokes serveEmbeddedAsset to
// prove cli.js's own catch/print-error/exit(1) logic fires (not just that the
// dynamic import rejects). The full end-to-end HTTP-level check (hitting a running
// dispatched serve instance and confirming the friendly stderr message + exit(1)
// over a real request) remains covered by the manual smoke checklist in
// 07-VALIDATION.md, complementing (not replacing) this direct unit-level assertion.
test('serveEmbeddedAsset prints friendly error and exits 1 when generatedAssets.mjs is missing', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const calls = [];
  process.exit = (code) => {
    throw new Error('EXIT_1');
  };
  console.error = (...args) => calls.push(args);

  try {
    await assert.rejects(() => serveEmbeddedAsset({ path: '/index.html' }, {}, async () => { throw new Error('Missing assets'); }), /EXIT_1/);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].join(' '),
      'Embedded frontend assets not found. This binary may have been built incorrectly, ' +
        'or you are running server/cli.js directly without generating assets first ' +
        '(run: npm run build:web && node scripts/generate-assets-manifest.js).'
    );
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
});


test('asset resolution accepts only own string paths and safely falls back', () => {
  const manifest = Object.assign(Object.create({ '/inherited': '/unsafe', '/constructor': Object }), {
    '/index.html': '/tmp/index.html', '/app.js': '/tmp/app.js', '/invalid': {},
  });
  assert.equal(resolveAssetPath(manifest, '/app.js'), '/tmp/app.js');
  for (const requested of ['/constructor', '/__proto__', '/inherited', '/invalid', '/missing']) {
    assert.equal(resolveAssetPath(manifest, requested), '/tmp/index.html');
  }
  assert.equal(resolveAssetPath({}, '/missing'), undefined);
  assert.equal(resolveAssetPath(Object.create({ '/index.html': '/unsafe' }), '/missing'), undefined);
  assert.equal(resolveAssetPath({ '/index.html': {} }, '/missing'), undefined);
});

test('embedded assets return 404 when no safe file path exists', async () => {
  let status, ended = false, sent = false;
  const res = { status(code) { status = code; return this; }, end() { ended = true; }, sendFile() { sent = true; } };
  await serveEmbeddedAsset({ path: '/constructor' }, res, async () => ({ manifest: {} }));
  assert.equal(status, 404);
  assert.equal(ended, true);
  assert.equal(sent, false);
});
