# Phase 7: Single-Binary Packaging - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 8 (4 new, 4 modified/extended) + package.json + .gitignore
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `server/cli.js` (new) | controller / CLI entrypoint | request-response + event-driven (argv dispatch) | `server/server.js` | role-match (same "entrypoint that calls createApp().listen()" shape, extended with subcommand routing) |
| `server/generatedAssets.mjs` (new, generated, gitignored) | config / generated data module | file-I/O (static embed) | `server/app.js`'s static-serving branch (lines 23-29) | partial match (same concern — mapping URL path to file — but ESM-only construct with no direct precedent in repo) |
| `scripts/generate-assets-manifest.js` (new) | utility / build script | batch (walks a directory, writes a generated file) | `scripts/install-hook.js` | role-match (both are standalone build/setup scripts run via `require.main === module`, CJS, no test-framework deps) |
| `scripts/build-binary.js` (new, optional per D-13/A1) | utility / build orchestration script | batch (loop over 5 targets, fail-fast) | `scripts/install-hook.js` | role-match (standalone CJS script, `require.main === module` entry pattern) |
| `hooks/gsd-web-hook.js` (modify — extract `runHookFromStdin()`) | utility / OS-integration handler | event-driven (stdin → handle()) | itself (existing `require.main === module` stdin block, lines 75-88) | exact (refactor-in-place, not a new analog needed) |
| `scripts/install-hook.js` (modify — extract `installHooks(hookCommand, settingsPath)`, change 2nd param from bare path to full command string) | utility / config-file writer | file-I/O (read/backup/write JSON) | itself (existing `require.main === module` block, lines 41-57) | exact (refactor-in-place) |
| `tests/server/cli.test.js` (new) | test | request-response / event-driven | `tests/server/app.test.js` (HTTP-level) + `tests/hooks/gsd-web-hook.test.js` (module-cache-reset + `require.main` style) | role-match |
| `tests/scripts/generate-assets-manifest.test.js` (new) | test | batch / file-I/O | `tests/scripts/install-hook.test.js` | exact (same test file's structure: plain `node:test`, requires the module directly, asserts on returned data structure) |
| `tests/hooks/gsd-web-hook.test.js` (extend — add `runHookFromStdin()` coverage) | test | event-driven | itself | exact |
| `tests/scripts/install-hook.test.js` (modify — update signature assertions) | test | file-I/O | itself | exact |
| `package.json` (modify — add `build:binary` script) | config | — | itself, `scripts` block | exact |

## Pattern Assignments

### `server/cli.js` (controller/CLI entrypoint, request-response + event-driven)

**Analog:** `server/server.js` (full file, 12 lines) + `server/app.js` (full file, 34 lines)

**server/server.js — current entrypoint pattern to extend, NOT replace** (lines 1-11):
```javascript
const { createApp } = require('./app');

const PORT = process.env.PORT || 4317;

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`gsd-web server listening on http://localhost:${PORT}`);
  });
}

module.exports = { PORT };
```
`server/cli.js` is a NEW, separate file — it does not replace `server/server.js`. `npm run dev`/`start` continue to require `./server.js` directly (D-08/PKG-07). `cli.js` reuses `createApp` the same way but adds argv-based subcommand dispatch in front of it, and threads `--port`/`--host` values into `.listen(port, host, cb)` instead of the bare `PORT` constant.

**server/app.js — `createApp()` factory to reuse as-is, only static-serving branch changes** (lines 9-34, static branch at 23-29):
```javascript
function createApp() {
  const app = express();
  app.use(express.json());
  const sseHub = createSseHub();

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/projects', createProjectsRouter(sseHub));
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/convert', createConvertRouter());

  const distDir = path.join(__dirname, '..', 'web', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
```
Per RESEARCH.md, `createApp()` itself is untouched — the compiled binary's `serve` subcommand in `cli.js` should NOT modify `app.js`'s static branch (that stays serving `web/dist` via `fs.existsSync`/`express.static` for the dev/`server.js` path). Instead, `cli.js`'s `serve` handler installs its OWN static-serving middleware (backed by the dynamic `import('./generatedAssets.mjs')` manifest lookup, per RESEARCH.md Pattern 1) ahead of / instead of relying on `app.js`'s `express.static(distDir)` branch when running as the compiled binary (since `web/dist` won't exist on-disk inside a compiled binary — only embedded assets do).

**CommonJS module style to follow throughout `cli.js`:**
```javascript
const { createApp } = require('./app');
const { parseArgs } = require('node:util');
// ... require-based imports throughout, module.exports at bottom (or none, if pure entrypoint)
```

**Argv dispatch pattern** (from RESEARCH.md, verified working in a compiled binary — copy this shape directly):
```javascript
const { parseArgs } = require('node:util');
const [subcommand, ...rest] = process.argv.slice(2);

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  printUsage();
  process.exit(0); // D-05: no-args prints help and exits 0
}

if (subcommand === '--version') {
  console.log(require('../package.json').version);
  process.exit(0);
}

if (subcommand === 'serve') {
  const { values } = parseArgs({
    args: rest,
    options: { port: { type: 'string' }, host: { type: 'string' } },
    allowPositionals: false,
  });
  const port = values.port ? Number(values.port) : (process.env.PORT ? Number(process.env.PORT) : 4317); // D-01/D-02
  const host = values.host || 'localhost'; // D-03/D-04
  // validate port is an integer in 1-65535 range before calling .listen() (ASVS V5 per RESEARCH.md)
} else if (subcommand === 'hook') {
  // runHookFromStdin()
} else if (subcommand === 'install-hook') {
  // installHooks(`${process.execPath} hook`, settingsPath)
} else {
  console.error(`Unknown command: ${subcommand}`); // D-07
  printUsage();
  process.exit(1);
}
```

**Error handling pattern for missing generated assets** (PKG-06, non-compiled dev execution only):
```javascript
async function serveStatic(req, res, next) {
  let assetsModule;
  try {
    assetsModule = await import('./generatedAssets.mjs');
  } catch (err) {
    console.error(
      'Embedded frontend assets not found. This binary may have been built incorrectly, ' +
      'or you are running server/cli.js directly without generating assets first ' +
      '(run: npm run build:web && node scripts/generate-assets-manifest.js).'
    );
    process.exit(1);
  }
  const filePath = assetsModule.manifest[req.path] || assetsModule.manifest['/index.html'];
  res.sendFile(filePath);
}
```

**`process.execPath` for install-hook wiring** (PKG-05 — do NOT use `process.argv[1]`, which resolves to a virtual `/$bunfs/root/...` path inside a compiled binary):
```javascript
const { installHooks } = require('../scripts/install-hook');
installHooks(`${process.execPath} hook`);
```

---

### `server/generatedAssets.mjs` (config/generated, file-I/O)

**Analog:** none in the codebase (new construct) — copy directly from RESEARCH.md's verified example. Must be ESM (`.mjs`), not CJS, because `type: "file"` import attributes only work with `import` statements.

```javascript
// server/generatedAssets.mjs (generated by scripts/generate-assets-manifest.js — gitignored, do not hand-edit)
import assetIndexJs from "../web/dist/assets/index-a1b2c3.js" with { type: "file" };
import indexHtml from "../web/dist/index.html" with { type: "file" };

export const manifest = {
  "/assets/index-a1b2c3.js": assetIndexJs,
  "/index.html": indexHtml,
};
```

`server/cli.js` (CJS) loads it via `await import('./generatedAssets.mjs')` — never `require()`.

---

### `scripts/generate-assets-manifest.js` (utility/build script, batch)

**Analog:** `scripts/install-hook.js` (full file, 59 lines) — closest existing standalone CJS build/setup script with the same `require.main === module` entrypoint shape and no external dependencies.

**Imports pattern** (lines 1-3 of `scripts/install-hook.js`):
```javascript
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
```
For the manifest generator, swap `os` for a recursive directory walk — same node:fs/node:path style, no new deps:
```javascript
const fs = require('node:fs');
const path = require('node:path');
```

**Entrypoint + core pattern** (mirror lines 41-57's `require.main === module` shape):
```javascript
if (require.main === module) {
  const distDir = path.join(__dirname, '..', 'web', 'dist');
  const outFile = path.join(__dirname, '..', 'server', 'generatedAssets.mjs');
  const source = generateManifestSource(distDir); // walk distDir, build import statements + manifest object literal
  fs.writeFileSync(outFile, source);
  console.log(`Wrote asset manifest to ${outFile}`);
}

module.exports = { generateManifestSource }; // export the pure function for testability, per install-hook.js's mergeHookConfig export pattern
```
Note the key structural pattern from `install-hook.js` to copy: separate the **pure, testable core function** (`mergeHookConfig` there / `generateManifestSource` or equivalent here) from the **I/O side effects** (`fs.readFileSync`/`writeFileSync`, `console.log`) which only run under `require.main === module`. This is exactly what makes `install-hook.js` unit-testable without touching the real filesystem/`~/.claude/settings.json`, and the manifest generator should follow the same shape against a fixture directory (per RESEARCH.md's stated testing approach — test against a small fixture dir, not a real Vite build).

---

### `hooks/gsd-web-hook.js` (utility/OS-integration handler, event-driven) — refactor in place

**Analog:** itself — current file (90 lines), extract the existing `require.main === module` stdin block into a named, exported function.

**Current stdin-handling block to extract** (lines 75-88):
```javascript
if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    try {
      handle(JSON.parse(raw));
    } catch {
      // ignore malformed stdin
    }
    process.exit(0);
  });
}

module.exports = { handle };
```

**Target refactor** (from RESEARCH.md, verified identical behavior in a compiled binary):
```javascript
function runHookFromStdin() {
  let raw = '';
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      handle(JSON.parse(raw));
    } catch {
      // ignore malformed stdin
    }
    process.exit(0);
  });
}

if (require.main === module) {
  runHookFromStdin();
}

module.exports = { handle, runHookFromStdin };
```
Preserve the existing `handle()` function (lines 60-73) and all its helper functions (`resolveCwd`, `handleTaskStart`, `handleTaskEnd`, `handleStop`, lines 1-58) completely unchanged — only the bottom stdin block and export line change.

---

### `scripts/install-hook.js` (utility/config-file writer, file-I/O) — refactor in place + signature change

**Analog:** itself — current file (59 lines).

**Current structure to extract into `installHooks(hookCommand, settingsPath)`** (lines 41-57):
```javascript
if (require.main === module) {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const hookScriptPath = path.join(__dirname, '..', 'hooks', 'gsd-web-hook.js');

  const existing = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};

  if (fs.existsSync(settingsPath)) {
    const backupPath = `${settingsPath}.bak-${Date.now()}`;
    fs.copyFileSync(settingsPath, backupPath);
    console.log(`Backed up existing settings to ${backupPath}`);
  }

  const merged = mergeHookConfig(existing, hookScriptPath);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
  console.log(`Installed gsd-web hooks into ${settingsPath}`);
}
```

**Signature change required (per RESEARCH.md and CONTEXT.md code_context section):** `mergeHookConfig(existing, hookScriptPath)` currently takes a bare script path and hardcodes `node ${hookScriptPath}` as the command (see `hookEntry`/`stopHookEntry`, lines 5-11: `` `node ${hookScriptPath}` ``). This must change so the SECOND PARAMETER IS ALREADY A FULL COMMAND STRING (e.g. `"node /abs/path/hooks/gsd-web-hook.js"` for dev, or `"/abs/path/to/binary hook"` for the compiled binary), not a bare path that gets `node ` prepended internally. Concretely:

```javascript
// BEFORE (lines 5-11):
function hookEntry(hookScriptPath) {
  return { matcher: 'Task', hooks: [{ type: 'command', command: `node ${hookScriptPath}` }] };
}
function stopHookEntry(hookScriptPath) {
  return { hooks: [{ type: 'command', command: `node ${hookScriptPath}` }] };
}

// AFTER (rename param to hookCommand, drop the `node ` prefix — caller supplies the full command)
function hookEntry(hookCommand) {
  return { matcher: 'Task', hooks: [{ type: 'command', command: hookCommand }] };
}
function stopHookEntry(hookCommand) {
  return { hooks: [{ type: 'command', command: hookCommand }] };
}
```

New exported `installHooks(hookCommand, settingsPath)` wraps the existing I/O block above as a testable function (mirroring `generate-assets-manifest.js`'s pure-function/I/O-shell split), with `require.main === module` calling it with the dev-mode default (`` `node ${path.join(__dirname, '..', 'hooks', 'gsd-web-hook.js')}` ``, `path.join(os.homedir(), '.claude', 'settings.json')`), and `server/cli.js`'s `install-hook` subcommand calling it with `` `${process.execPath} hook` `` instead.

**Backup-before-write behavior (lines 47-51) must be preserved unchanged** through this refactor — it's an explicit RESEARCH.md/security requirement (ASVS Tampering mitigation).

---

### `tests/server/cli.test.js` (test, new)

**Analog:** `tests/server/app.test.js` for the HTTP-serving assertions (real `.listen(0)` + `fetch()` pattern) combined with `tests/hooks/gsd-web-hook.test.js` for the module-cache-reset-per-test pattern.

**Imports pattern** (from `tests/server/app.test.js` lines 1-5, and `tests/hooks/gsd-web-hook.test.js` lines 1-5):
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
```

**Module-cache-reset pattern for tests that need fresh state per test** (`tests/hooks/gsd-web-hook.test.js` lines 7-13):
```javascript
function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-hook-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../hooks/gsd-web-hook')];
  return { hook: require('../../hooks/gsd-web-hook'), paths: require('../../server/lib/paths') };
}
```
For `cli.test.js`, since `cli.js` reads `process.argv` at module-load time in the RESEARCH.md example pattern, tests will likely need to either (a) spawn `server/cli.js` as a child process with `child_process.execFileSync`/`spawnSync` (no existing analog for this in the repo — this would be a genuinely new test technique, needed because `process.argv`-based dispatch is hard to unit-test via `require()` alone) passing custom `argv`, or (b) refactor `cli.js`'s dispatch logic into an exported, argv-taking function (e.g. `module.exports = { dispatch }` where `dispatch(argv)` is called with `process.argv.slice(2)` at the bottom under `require.main === module`, exactly mirroring the `handle()`/`if (require.main === module)` split already used in `hooks/gsd-web-hook.js`). **Recommend (b)** — it reuses the exact split pattern already established in this codebase (pure function + `require.main` guard) rather than introducing child-process spawning as a new test technique.

**Real-server HTTP pattern to reuse for the `serve` subcommand's asset-serving test** (`tests/server/app.test.js` lines 19-22):
```javascript
const app = createApp();
const server = app.listen(0);
const { port } = server.address();
const base = `http://localhost:${port}`;
// ... fetch(`${base}/...`) ...
server.close();
```

**Assert-never-throws / graceful-failure pattern** (`tests/hooks/gsd-web-hook.test.js` lines 68-72) — reuse for PKG-06's missing-assets error path and PKG-01's unknown-command path:
```javascript
test('handle never throws on malformed input', () => {
  const { hook } = freshHome();
  assert.doesNotThrow(() => hook.handle({}));
  assert.doesNotThrow(() => hook.handle({ hook_event_name: 'PreToolUse', tool_name: 'Task' }));
});
```

---

### `tests/scripts/generate-assets-manifest.test.js` (test, new)

**Analog:** `tests/scripts/install-hook.test.js` (full file, 29 lines) — exact structural match: no `node:fs`/`os`/`path` mocking needed if the core function is pure (fixture-directory-in, string/object-out).

**Full pattern to copy:**
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('generateManifestSource produces an import + manifest entry per discovered file', () => {
  const { generateManifestSource } = require('../../scripts/generate-assets-manifest');
  const result = generateManifestSource('/path/to/fixture/dist'); // small fixture dir, not a real Vite build (per RESEARCH.md)

  assert.match(result, /with \{ type: "file" \}/);
  assert.match(result, /export const manifest/);
});
```
Build a small fixture directory under `tests/scripts/fixtures/` (or inline via `fs.mkdtempSync` + a couple of written files, mirroring `tests/hooks/gsd-web-hook.test.js`'s `freshHome()` temp-dir-per-test approach) rather than depending on a real `npm run build:web` output, per RESEARCH.md's stated testing approach (Wave 0 Gaps section).

---

### `tests/hooks/gsd-web-hook.test.js` (extend, event-driven)

**Analog:** itself. Add a new `test(...)` block asserting `runHookFromStdin` is exported and (if feasible without truly re-wiring stdin in-process) that it delegates to `handle()` identically — mirror the existing three-test structure (lines 15-72) exactly: same `freshHome()` helper, same `assert.equal`/`assert.doesNotThrow` style.

### `tests/scripts/install-hook.test.js` (modify, file-I/O)

**Analog:** itself. Update both existing tests' second-argument literal from a bare path to a full command string, and update assertions accordingly:

**Current (to change)** (lines 6, 10):
```javascript
const result = mergeHookConfig({}, '/path/to/gsd-web-hook.js');
// ...
assert.equal(result.hooks.PreToolUse[0].hooks[0].command, 'node /path/to/gsd-web-hook.js');
```

**Target:**
```javascript
const result = mergeHookConfig({}, 'node /path/to/gsd-web-hook.js');
// ...
assert.equal(result.hooks.PreToolUse[0].hooks[0].command, 'node /path/to/gsd-web-hook.js');
```
i.e. the test now passes the ALREADY-FULL command string as the second arg (matching the new `hookCommand` param semantics), rather than relying on `mergeHookConfig`/`hookEntry` to prepend `node ` internally. Same idempotency test (lines 15-28) needs the same second-arg update in both `mergeHookConfig(existing, ...)` calls.

---

### `package.json` (config)

**Analog:** itself — `scripts` block (lines 6-14).

**Current pattern:**
```json
"scripts": {
  "dev:server": "node server/server.js",
  "dev:web": "npm run dev --prefix web",
  "dev": "concurrently -n server,web \"npm run dev:server\" \"npm run dev:web\"",
  "build:web": "npm run build --prefix web",
  "start": "npm run build:web && node server/server.js",
  "test": "node --test \"tests/server/**/*.test.js\" \"tests/hooks/**/*.test.js\" \"tests/scripts/**/*.test.js\"",
  "install-hook": "node scripts/install-hook.js"
}
```
Add `"build:binary": "node scripts/build-binary.js"` (or equivalent) as a NEW entry appended to this block — do not modify any existing entries (D-08/PKG-07). `"test"` glob pattern already covers `tests/server/**`, `tests/hooks/**`, `tests/scripts/**` so new test files (`cli.test.js`, `generate-assets-manifest.test.js`) are automatically picked up with zero `package.json` changes needed to the `test` script itself.

## Shared Patterns

### CommonJS module style (project-wide convention)
**Source:** `server/server.js`, `server/app.js`, `hooks/gsd-web-hook.js`, `scripts/install-hook.js` — all identical style
**Apply to:** `server/cli.js`, `scripts/generate-assets-manifest.js`, `scripts/build-binary.js` (all new files EXCEPT `server/generatedAssets.mjs`, which must be ESM per RESEARCH.md's `type: "file"` constraint)
```javascript
const fs = require('node:fs');
const path = require('node:path');
// ... requires at top, no import/export syntax
module.exports = { someFunction }; // at bottom, named exports object
```

### Pure-function-plus-`require.main`-guard split (testability pattern)
**Source:** `hooks/gsd-web-hook.js` (`handle()` exported separately from the stdin-reading `if (require.main === module)` block) and `scripts/install-hook.js` (`mergeHookConfig()` exported separately from the file-I/O `if (require.main === module)` block)
**Apply to:** `scripts/generate-assets-manifest.js` (export a pure `generateManifestSource(distDir)` separate from the `fs.writeFileSync` side effect), `scripts/install-hook.js`'s new `installHooks()` export, and ideally `server/cli.js` itself (export a `dispatch(argv)` function separate from the `if (require.main === module) { dispatch(process.argv.slice(2)); }` guard, to make PKG-01/PKG-06/PKG-07 testable without child-process spawning)

### Silent/non-throwing error handling for hook execution
**Source:** `hooks/gsd-web-hook.js` lines 60-73 (`handle()`'s outer try/catch — "Hook failures must never surface to the user's Claude Code session")
**Apply to:** `server/cli.js`'s `hook` subcommand dispatch — must preserve this same never-throw guarantee when routing to `runHookFromStdin()`

### Real HTTP server test pattern (no supertest/mocking library)
**Source:** `tests/server/app.test.js` (`app.listen(0)` + `server.address().port` + `fetch()` + `server.close()`)
**Apply to:** `tests/server/cli.test.js`'s `serve` subcommand assertions (asset-manifest lookup, `--port`/`--host` flag threading)

### Temp-directory-per-test isolation pattern
**Source:** `tests/hooks/gsd-web-hook.test.js` (`fs.mkdtempSync(path.join(os.tmpdir(), '<prefix>-'))`) and `tests/server/app.test.js` (same pattern for scratch project dirs)
**Apply to:** `tests/scripts/generate-assets-manifest.test.js`'s fixture directory, and any `cli.test.js` tests needing a scratch `~/.claude/settings.json`-equivalent path for `install-hook` dispatch tests

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `server/generatedAssets.mjs` | config/generated | file-I/O | No ESM file exists anywhere in the repo (`"type": "commonjs"` project-wide); RESEARCH.md's verified code example (Pattern 1) is the only available reference — copy it directly rather than searching further |
| `scripts/build-binary.js` (if authored as a JS build script per RESEARCH.md's "Alternatives Considered" recommendation, vs. a plain bash loop in `package.json`) | utility/build orchestration | batch | No existing multi-target build-loop script in the repo; closest structural analog is still `scripts/install-hook.js`'s CJS/`require.main` shape, but the fail-fast-per-target-loop logic itself (D-13) has no precedent to copy — implement fresh per RESEARCH.md's `Bun.build()` JS API guidance |

## Metadata

**Analog search scope:** `server/`, `hooks/`, `scripts/`, `tests/server/`, `tests/hooks/`, `tests/scripts/`, `package.json`
**Files scanned:** `server/server.js`, `server/app.js`, `hooks/gsd-web-hook.js`, `scripts/install-hook.js`, `package.json`, `tests/hooks/gsd-web-hook.test.js`, `tests/scripts/install-hook.test.js`, `tests/server/app.test.js` (plus directory listing of all `tests/server/*.test.js` and `server/lib/*.js`)
**Pattern extraction date:** 2026-07-24
