const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { checkBunAvailable } = require('../../scripts/build-binary');
const root = path.resolve(__dirname, '../..');
const bun = checkBunAvailable();
function isolatedHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'geezo-binary-'));
  fs.writeFileSync(path.join(home, 'settings.json'), JSON.stringify({ portfolio: { roots: [], scanIntervalMs: 60000 }, allIn: { enabled: false } }));
  return home;
}
function env(home) { return { ...process.env, GSD_WEB_HOME_OVERRIDE: home }; }
test('real Bun CLI prints help and version', { skip: !bun }, () => {
  for (const flag of ['--help', '--version']) {
    const result = spawnSync('bun', ['server/cli.js', flag], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, flag === '--help' ? /serve[\s\S]*hook[\s\S]*install-hook/ : /0\.1\.0/);
  }
});
test('real Bun hook accepts valid and malformed stdin without failing', { skip: !bun }, () => {
  const home = isolatedHome();
  try {
    for (const input of ['{"hook_event_name":"Stop","session_id":"smoke"}', 'invalid-json']) {
      const result = spawnSync('bun', ['server/cli.js', 'hook'], { cwd: root, env: env(home), input, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 0, result.stderr);
    }
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
async function serveSmoke(command, args) {
  const home = isolatedHome();
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const child = spawn(command, [...args, 'serve', '--host', '127.0.0.1', '--port', String(port)], { cwd: home, env: env(home), stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', d => output += d);
  child.stderr.on('data', d => output += d);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Startup timed out: '+output)), 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error('Exited '+code+': '+output)); });
      child.stdout.on('data', () => { if (output.includes('server listening')) { clearTimeout(timeout); resolve(); } });
    });
    const base = `http://127.0.0.1:${port}`;
    assert.deepEqual(await (await fetch(base+'/api/health', { signal: AbortSignal.timeout(5000) })).json(), { status: 'ok' });
    for (const route of (args.length ? [] : ['/', '/constructor', '/__proto__', '/all-in'])) {
      const response = await fetch(base+route, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200, route+' '+output);
      const html = await response.text();
      assert.match(html, /<html/i);
      if (route === '/') {
        for (const asset of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)) {
          const resource = await fetch(base+asset[1], { signal: AbortSignal.timeout(5000) });
          assert.equal(resource.status, 200, asset[1]);
          assert.ok((await resource.arrayBuffer()).byteLength > 0);
        }
      }
    }
    assert.equal((await fetch(base+'/api/health', { signal: AbortSignal.timeout(5000) })).status, 200);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 3000);
      await exit;
      clearTimeout(force);
    }
    fs.rmSync(home, { recursive: true, force: true });
  }
}
test('real Bun serves the health API without a SQLite runtime crash', { skip: !bun, timeout: 20000 }, () => serveSmoke('bun', [path.join(root, 'server/cli.js')]));
test('compiled executable serves API and embedded frontend outside the checkout', { skip: !process.env.GEEZO_TEST_BINARY, timeout: 20000 }, () => serveSmoke(process.env.GEEZO_TEST_BINARY, []));

test('real Bun reports missing generated assets clearly over HTTP', { skip: !bun, timeout: 20000 }, async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'geezo-no-assets-'));
  const home = isolatedHome();
  const serverDir = path.join(fixture, 'server');
  fs.cpSync(path.join(root, 'server'), serverDir, { recursive: true, filter: source => path.basename(source) !== 'generatedAssets.mjs' });
  for (const name of ['node_modules', 'hooks', 'scripts']) fs.symlinkSync(path.join(root, name), path.join(fixture, name), 'dir');
  fs.copyFileSync(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
  const child = spawn('bun', ['-e', "const {createApp}=require('./server/app');const {serveEmbeddedAsset}=require('./server/cli');const app=createApp({discovery:false,staticAssets:false});app.get('/',(req,res)=>serveEmbeddedAsset(req,res));const s=app.listen(0,'127.0.0.1',()=>console.log(s.address().port));"], { cwd: fixture, env: env(home), stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => stderr += d);
  const exited = once(child, 'exit');
  try {
    const [chunk] = await once(child.stdout, 'data');
    await fetch('http://127.0.0.1:'+Number(chunk.toString().trim())+'/', { signal: AbortSignal.timeout(5000) }).catch(() => {});
    const [code] = await exited;
    assert.equal(code, 1, stderr);
    assert.match(stderr, /Embedded frontend assets not found/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
