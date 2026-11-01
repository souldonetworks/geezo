---
phase: 07-single-binary-packaging
reviewed: 2026-11-01T20:57:29Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - hooks/gsd-web-hook.js
  - scripts/install-hook.js
  - tests/hooks/gsd-web-hook.test.js
  - tests/scripts/install-hook.test.js
  - scripts/generate-assets-manifest.js
  - tests/scripts/generate-assets-manifest.test.js
  - .gitignore
  - server/cli.js
  - tests/server/cli.test.js
  - scripts/build-binary.js
  - tests/scripts/build-binary.test.js
  - package.json
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 07: Code Review Report

## Gap-Closure Re-review — 2026-11-01

**Scope:** `264228a..61a6db3`, specifically `server/cli.js`, `server/app.js`, `tests/server/cli.test.js`, and `tests/scripts/binary-smoke.test.js`. The existing SQLite fix and cross-runtime reader test were also inspected. No production files were changed by this review.

**Current result:** No new blocker found. CR-01's unsafe-value concern is resolved: `resolveAssetPath` accepts only nonempty own string entries, including the index fallback; absence returns HTTP 404. A named resolver test was independently executed and passed. The saved native binary smoke result also covers `/constructor`, `/__proto__`, normal frontend routes, referenced assets and a subsequent healthy API response. Historical warnings WR-01 through WR-06 remain open; `issues_found` reflects these existing nonblocking warnings, not an unresolved critical finding.

The new `createApp({ staticAssets: false })` call prevents disk assets from masking embedded-serving failures. The default factory behavior remains unchanged for Node workflows. The wrapper route correctly avoids passing Express's `next` argument as the injectable asset loader. Bun reads embedded files as bytes because its virtual paths do not work with Express `sendFile`; the read failure branch responds HTTP 500. The generated manifest contains real Vite HTML, JavaScript, CSS, fonts and image entries.

Evidence inspected: `/tmp/geezo-07-final-full.log` records 114 passes, zero failures/skips, including the compiled executable outside the checkout; `/tmp/geezo-07-all-targets.log` records all five builds. Native darwin-arm64 hook and installer were independently invoked with temporary child-only HOME and data directories. Valid/malformed hook input exited 0. Two installer runs preserved unrelated settings and an existing hook, registered the actual executable path exactly once per event, and produced byte-exact pre-write backups. No real user settings were touched. Other target artifacts were inspected with `file`, not executed.

**Calibration / limits:** The historical CR-01 explanation below overstates normal JavaScript prototype lookup: `/constructor` and `/__proto__` do not equal the unprefixed Object.prototype keys. Preserve that report as history, not as proof that those exact URL paths previously crashed an ordinary manifest. The new test explicitly supplies inherited slash-prefixed entries and non-string own values, so it meaningfully verifies the defensive contract. Missing-manifest coverage runs a copied source fixture under Bun, rather than a specially compiled broken distribution. Native frontend smoke checks status, HTML and nonempty referenced resources; it does not assess visual appearance or exercise every API route. Shared `createApp` wiring and the existing route tests supply API coverage.

No unreferenced `TBD`, `FIXME` or `XXX` debt markers were found in the four gap-change files. No new external dependency was added. There is no declared shell probe for this phase.

## Historical Initial Review — 2026-07-24

The following original findings are retained for audit history. CR-01 is closed as described above; WR-01–WR-06 and IN-01–IN-04 remain historical, nonblocking observations.

**Reviewed:** 2026-07-24T18:20:57Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 07 wires up the single-binary packaging pipeline: hook/install-hook logic extraction (`hooks/gsd-web-hook.js`, `scripts/install-hook.js`), the compile-time asset manifest generator (`scripts/generate-assets-manifest.js`), the unified CLI entrypoint (`server/cli.js`), and the multi-target build orchestrator (`scripts/build-binary.js`). The refactor work in Plan 07-01 is clean and faithfully preserves prior behavior. The most serious issue is in `server/cli.js`'s embedded-asset route handler: it does an unguarded property lookup on a plain-object manifest keyed by attacker-controlled `req.path`, which can retrieve inherited `Object.prototype` members (e.g. `/constructor`, `/__proto__`) instead of `undefined`, then hands a non-string value to `res.sendFile()`. Because the handler is `async` and Express 4 does not catch rejected promises from route handlers, the resulting synchronous throw inside `res.sendFile` becomes an unhandled promise rejection — which terminates the Node/Bun process by default (Node >= 15's `unhandledRejection: throw` behavior). This is a remotely triggerable single-request denial-of-service against the compiled binary's `serve` command. Several other robustness gaps around CLI argument parsing, port-validation diagnostics, and manifest-identifier collisions are also present.

## Critical Issues

### CR-01: Unsanitized property lookup on `manifest` in `serveEmbeddedAsset` crashes the server on crafted requests

**File:** `server/cli.js:36-51`
**Issue:** `assetsModule.manifest[req.path]` looks up a plain JS object literal using an attacker-controlled string (`req.path` from any inbound HTTP GET). Because `manifest` is a normal object (not `Object.create(null)` or a `Map`), keys like `/constructor`, `/__proto__`, `/toString`, `/valueOf`, `/hasOwnProperty` resolve to inherited `Object.prototype` members instead of `undefined`. That means:
- A request to `GET /constructor` returns `Object` (a function) as `filePath`, which is truthy, so the `|| manifest['/index.html']` fallback never triggers.
- `res.sendFile(Object)` (or `res.sendFile(Object.prototype)` for `/__proto__`) is not a string, so Express's `res.sendFile` throws synchronously (`TypeError: path must be a string`).
- Because `serveEmbeddedAsset` is an `async function` and Express 4 does not await/catch route-handler promises, this throw becomes an **unhandled promise rejection**. Under Node's default `unhandledRejection` mode since Node 15 (`throw`), this **terminates the whole process** — killing the dashboard for every connected user from a single unauthenticated GET request.
- Separately, even without the prototype angle, if a legitimate build ever produces a manifest missing `/index.html` (e.g. an empty `web/dist`), the `|| assetsModule.manifest['/index.html']` fallback yields `undefined` and `res.sendFile(undefined)` hits the same crash path.

This is directly reachable by any client that can reach the `serve` HTTP port (including a non-localhost bind per `--host`), making it a remote, low-effort DoS.
**Fix:**
```javascript
async function serveEmbeddedAsset(req, res) {
  let assetsModule;
  try {
    assetsModule = await import('./generatedAssets.mjs');
  } catch (err) {
    console.error(/* ... existing message ... */);
    process.exit(1);
    return;
  }

  const manifest = assetsModule.manifest;
  const hasEntry = (key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(manifest, key);
  const filePath = hasEntry(req.path) ? manifest[req.path] : manifest['/index.html'];

  if (typeof filePath !== 'string') {
    res.status(404).end();
    return;
  }
  res.sendFile(filePath);
}
```
Also consider generating `manifest` with `Object.assign(Object.create(null), {...})` (or building it as a `Map`) in `scripts/generate-assets-manifest.js` so the underlying object has no prototype at all, closing this class of bug at the source.

## Warnings

### WR-01: `serve`'s flag parsing crashes on unrecognized flags/positional args instead of returning a friendly error

**File:** `server/cli.js:66-74`
**Issue:** `dispatch`'s `serve` branch calls `parseArgs({ args: rest, options: {...}, allowPositionals: false })` with no surrounding `try/catch`. Node's `parseArgs` defaults to `strict: true`, and `allowPositionals: false` means any unknown flag (e.g. `geezo serve --bogus`) or any positional argument (e.g. `geezo serve extra`) throws an uncaught `TypeError`. This propagates out of `dispatch()` as a raw, uncaught exception with a stack trace — inconsistent with the rest of `dispatch`'s design, which otherwise carefully produces friendly stderr messages and defined exit codes for every other invalid-input case (unknown command, invalid port). No test in `tests/server/cli.test.js` exercises this path, so it went unnoticed.
**Fix:** Wrap the `parseArgs` call in try/catch and return exit code 1 with a friendly message on failure:
```javascript
let values;
try {
  ({ values } = parseArgs({ args: rest, options: { port: { type: 'string' }, host: { type: 'string' } }, allowPositionals: false }));
} catch (err) {
  console.error('Invalid arguments for serve: ' + err.message);
  printUsage();
  return 1;
}
```

### WR-02: Invalid-port error message can show the wrong source value

**File:** `server/cli.js:76-80`
**Issue:** The error message always prints `values.port` (the `--port` flag), even when the invalid value actually came from `process.env.PORT`. If `--port` is omitted and `PORT` is set to a non-numeric value, `resolvePort` correctly returns `NaN` and the range check correctly rejects it, but the printed message is `Invalid port: undefined`, which misleads the user about which input was bad.
**Fix:** Track which source actually produced the value and reference the real offending value:
```javascript
const portSource = values.port !== undefined ? values.port : process.env.PORT;
console.error('Invalid port: ' + portSource);
```

### WR-03: `install-hook`'s command string is not shell-quoted, breaking on paths with spaces

**File:** `server/cli.js:103-104`
**Issue:** `hookCommand = execPath + ' hook'` is written verbatim into `~/.claude/settings.json` as the `command` field that Claude Code later executes (likely via a shell). If the compiled binary is installed at a path containing spaces (e.g. `/Users/John Doe/Applications/geezo-darwin-arm64`, or any default macOS "~/Downloads" folder with spaces, or Windows `Program Files`), the unquoted command string will be mis-parsed as multiple arguments when invoked, breaking the hook silently.
**Fix:** Quote the executable path when building the command string, e.g. `` `"${execPath}" hook` ``, and verify Claude Code's hook invocation mechanism handles quoted commands (it should, since it already prepended `node ` to a possibly-spaced script path before this refactor — but that pre-existing dev-mode path was less likely to contain spaces than a user-chosen binary install location).

### WR-04: Generated asset-manifest import identifiers are not collision-checked

**File:** `scripts/generate-assets-manifest.js:18-21`
**Issue:** `toIdentifier(urlPath)` sanitizes non-alphanumeric characters to `_`. Two distinct URL paths that differ only by characters that both normalize to `_` (e.g. `/assets/index-abc.js` and `/assets/index_abc.js`) produce the *same* identifier (`asset_assets_index_abc_js`), resulting in two `import X from ...` statements with a duplicate `X` binding — invalid ES module syntax that would fail to load at runtime inside the compiled binary. There is no collision detection or disambiguation.
**Fix:** Track identifiers already used and disambiguate on collision (e.g. append a numeric suffix), or throw a clear build-time error if a collision is detected so it fails fast during `npm run build:binary` rather than producing broken output silently:
```javascript
const seen = new Map();
function toIdentifier(urlPath) {
  const base = `asset_${urlPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}_${count}`;
}
```

### WR-05: No error handling for `app.listen()` failures (e.g. port already in use)

**File:** `server/cli.js:90-92`
**Issue:** `app.listen(port, host, callback)` is called without attaching an `'error'` listener to the returned server, or wrapping in try/catch. If the resolved port is already in use (`EADDRINUSE`) or the host cannot be bound, Node emits an unhandled `'error'` event on the HTTP server, which by default throws and crashes the process with a raw stack trace instead of a clean "port already in use" message — inconsistent with the careful validation done just above it for out-of-range ports.
**Fix:**
```javascript
const server = app.listen(port, host, () => {
  console.log(`gsd-web server listening on http://${host}:${port}`);
});
server.on('error', (err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
```

### WR-06: `checkBunAvailable()` uses a POSIX-only shell check

**File:** `scripts/build-binary.js:15-22`
**Issue:** `execSync('command -v bun', { stdio: 'ignore' })` relies on `command -v`, a POSIX shell builtin. On Windows (`cmd.exe`/PowerShell as the default shell), this will always fail even when `bun` is correctly installed and on `PATH`, causing `build:binary` to print a misleading "bun was not found" error on an otherwise-correctly-configured Windows dev machine.
**Fix:** Use a cross-platform check, e.g. attempt `execSync('bun --version', { stdio: 'ignore' })` inside the try/catch instead of shelling out to a POSIX-specific builtin — this works identically on all three platforms via Node's own `PATH` resolution.

## Info

### IN-01: Pre-existing path-traversal-shaped input surface in the hook status-file path (not introduced by Phase 07)

**File:** `hooks/gsd-web-hook.js:16-29` (`handleTaskStart`)
**Issue:** `path.join(dir, \`${input.tool_use_id}.json\`)` builds a filesystem path directly from `input.tool_use_id`, which comes from Claude Code's hook JSON payload. This logic is unchanged by Phase 07 (the plan explicitly required `handle()` and its helpers to remain byte-identical), so it's flagged here only for awareness since the whole file is in this phase's review scope — it was not introduced or worsened by this phase's changes and the hook's trust boundary (local, Claude-Code-controlled stdin) makes it low-risk in practice.
**Fix:** Out of scope for this phase; consider validating/sanitizing `tool_use_id` (e.g. reject values containing `/`, `\`, or `..`) in a future hardening pass.

### IN-02: `walk()` does not filter non-asset files (e.g. `.DS_Store`)

**File:** `scripts/generate-assets-manifest.js:4-16`
**Issue:** The recursive directory walker embeds every regular file under `distDir` with no extension/dotfile filtering. If a stray `.DS_Store` or other OS-generated file ends up in `web/dist/` before a build, it will be embedded into the compiled binary and exposed via the manifest's URL-path mapping.
**Fix:** Optionally skip dotfiles (`entry.name.startsWith('.')`) during the walk, or document that `web/dist/` must be a clean Vite build output.

### IN-03: `printUsage()` option-column alignment is inconsistent

**File:** `server/cli.js:9-24`
**Issue:** Minor formatting nit — `'  --version                             Print the version number'` has one extra space of padding compared to the `--help, -h` line above it, misaligning the printed columns.
**Fix:** Align padding consistently, e.g. `'  --version                            Print the version number'`.

### IN-04: Empty-string `--port` value produces an unhelpful diagnostic

**File:** `server/cli.js:78`
**Issue:** `geezo serve --port ""` results in `resolvePort` returning `Number('')` = `0`, which correctly fails the range check, but the printed message is `Invalid port: ` (trailing empty value), giving the user no indication of what was actually wrong.
**Fix:** Special-case empty-string port values with a clearer message, e.g. `'Invalid port: (empty value)'`.

---

_Reviewed: 2026-07-24T18:20:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
