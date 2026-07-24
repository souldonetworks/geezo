# Phase 7: Single-Binary Packaging - Research

**Researched:** 2026-07-24
**Domain:** Bun `--compile` standalone executables, CLI subcommand routing, static-asset embedding
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Compiled binary's `serve` subcommand supports a `--port` CLI flag in addition to the existing `PORT` env var (`server/server.js` today: `process.env.PORT || 4317`).
- **D-02:** `--port` flag takes precedence over `PORT` env var when both are set; falls back to `4317` if neither is set.
- **D-03:** Compiled binary also supports a `--host` CLI flag (dashboard is localhost-only by default today with no host selection exposed).
- **D-04:** `--host` defaults to `localhost` (127.0.0.1) when not passed — preserves today's effectively-local-only behavior; LAN exposure via `--host 0.0.0.0` is an explicit opt-in, consistent with PROJECT.md's single-user/no-auth security posture.
- **D-05:** `<binary>` with **no subcommand** prints help/usage text (NOT `serve`). **This overrides the design doc's stated default** ("serve (default when no subcommand given)") — CONTEXT.md is authoritative on this point.
- **D-06:** `<binary> --help` / `-h` prints usage text listing all 3 subcommands (`serve`, `hook`, `install-hook`) with one-line descriptions and available flags per subcommand (`--port`/`--host` for `serve`).
- **D-07:** `<binary> <unknown-subcommand>` prints an error ("Unknown command: X") followed by the same usage text, and exits with code 1.
- **D-08:** `npm run dev` / `npm start` / `npm test` are entirely untouched — they keep calling `server/server.js` directly, never routed through `server/cli.js`. The no-args-prints-help decision only affects the compiled binary's bare-invocation UX (satisfies PKG-07).
- **D-09:** Output binaries are renamed from the design doc's `gsd-web-<platform>` to **`geezo-<platform>`** across all 5 targets. **This overrides the design doc's stated naming.**
- **D-10:** Windows target gets a `.exe` suffix: `geezo-windows-x64.exe`. The other 4 targets have no extension: `geezo-darwin-arm64`, `geezo-darwin-x64`, `geezo-linux-x64`, `geezo-linux-arm64`.
- **D-11:** Binary supports a `--version` flag that prints the version from `package.json` at build time (embedded at compile time).
- **D-12:** `npm run build:binary` does a friendly pre-check (`command -v bun` or equivalent) before invoking `bun`. If missing, print a clear error with install instructions instead of a raw "command not found".
- **D-13:** If `bun build --compile` fails for one specific platform target during the multi-platform build loop, **fail fast** — stop immediately with a non-zero exit rather than continuing to build remaining targets.

### Claude's Discretion

- Exact wording/formatting of the `--help` usage text and error messages.
- Exact flag-parsing implementation approach (hand-rolled `process.argv` parsing vs. a tiny arg-parsing helper) — no library dependency preference was stated; keep it minimal per the "no new dependencies for packaging" spirit of the design doc.
- Where in `server/cli.js` the port/host flag values get threaded through to `createApp().listen(...)`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope (all four areas were implementation-detail clarifications of the existing PKG-01 through PKG-07 requirements, not new capabilities).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | Unified CLI entrypoint (`server/cli.js`) supports `serve`/`hook`/`install-hook` subcommands | See "Architecture Patterns" (CLI routing), "Code Examples" (arg parsing with `node:util parseArgs`, verified working in a compiled binary) |
| PKG-02 | `npm run build:binary` compiles for 5 targets via `bun build --compile` | See "Standard Stack" and "Code Examples" — all 5 `--target` values verified locally on this darwin-arm64 machine, including cross-compile downloads |
| PKG-03 | Compiled binary serves frontend from embedded asset manifest instead of `express.static` | See "Architecture Patterns" (asset embedding), "Common Pitfalls" (`type: "file"` only works via ESM `import`, not CJS `require`) |
| PKG-04 | `hook` subcommand reuses `hooks/gsd-web-hook.js`'s `handle()` via `runHookFromStdin()` | See "Code Examples" — stdin reading verified working identically in a compiled binary |
| PKG-05 | `install-hook` subcommand reuses `installHooks(hookCommand, settingsPath)`, pointing at the binary path | See "Code Examples" — `process.execPath` verified to resolve to the compiled binary's own real path (not a virtual `/$bunfs/...` path) |
| PKG-06 | Missing `server/generatedAssets.js` at serve-time produces explicit error, not confusing crash | See "Common Pitfalls" — nuance on when this can actually occur (dev/non-compiled `node server/cli.js`, not the compiled binary itself) |
| PKG-07 | `npm run dev`/`start`/`test` unaffected | See "Don't Hand-Roll" / D-08 — no changes required to `package.json` scripts touching `server/server.js` |
</phase_requirements>

## Summary

Bun 1.3.14 (already installed on this machine, and current as of research date — May 2026 was the last blog release, no newer version found) fully supports everything the design doc and CONTEXT.md require. All claims below marked HIGH confidence were verified by actually building and running compiled binaries during this research session, not just read from docs.

The single biggest technical nuance the planner must account for: **Bun's `import x from "path" with { type: "file" }` embedding syntax only works from ESM `import` statements — it does NOT work from CommonJS `require()`**, even with an equivalent-looking second-argument object. This was empirically confirmed: `require("./file.txt", { with: { type: "file" } })` compiles but throws `TypeError: path must be a string or a file descriptor` at runtime, while `import x from "./file.txt" with { type: "file" }` works correctly, returning a virtual path string (`/$bunfs/root/...`) that `fs.readFileSync` can read transparently. Since this project is `"type": "commonjs"` throughout, `server/generatedAssets.js` (the codegen output) must be authored as an ES module (`.mjs` extension, or its own directory-scoped `package.json` with `"type": "module"`), and `server/cli.js` (which can remain CommonJS) must load it via a dynamic `await import('./generatedAssets.mjs')` — this was verified to work correctly, including inside a compiled binary, with a CJS entry file dynamically importing an ESM module that does the static file-embedding imports.

Cross-compilation from this single darwin-arm64 machine to all 5 required targets (`bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`) was verified to work with no target OS required — Bun downloads the target platform's runtime binary (cached under `~/.bun/install/cache` after first use) and links the compiled app against it. First-time cross-compile to a new target requires network access to download that target's Bun runtime; subsequent builds to the same target are fast and offline-capable from cache. Resulting binaries are large (66–94 MB each, uncompressed) — expected for a self-contained runtime + app bundle, not a defect.

**Primary recommendation:** Use `bun build --compile` with per-target `--target=bun-<platform>` invocations exactly as the design doc specifies; author `server/generatedAssets.js` as ESM loaded via dynamic import from the CJS `server/cli.js`; use Node's built-in `node:util parseArgs` (verified working, zero new dependencies) for `--port`/`--host`/`--version`/`--help` flag parsing with `process.argv.slice(2)`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLI subcommand routing (`serve`/`hook`/`install-hook`, `--help`/`--version`) | Build/CLI entrypoint (`server/cli.js`) | — | Pure argv dispatch, no business logic of its own |
| HTTP serving (`/api/*` routes, SSE) | API/Backend (`server/app.js`, unchanged) | — | Already owns this; `cli.js` just invokes `createApp().listen()` |
| Static frontend asset serving | API/Backend (`server/cli.js` static-serving branch) | Build tier (codegen manifest) | Runtime lookup logic lives in the server tier; the manifest itself is produced at build time |
| Frontend asset embedding (manifest generation) | Build tier (`scripts/generate-assets-manifest.js`) | — | Runs post-`vite build`, pre-`bun build --compile`; not part of app runtime |
| Claude Code hook execution | OS integration / subprocess (`hooks/gsd-web-hook.js` via `hook` subcommand) | — | Invoked by Claude Code itself as a child process reading stdin, not by the dashboard server |
| Hook registration into `~/.claude/settings.json` | OS integration / config file (`scripts/install-hook.js` via `install-hook` subcommand) | — | Mutates a file outside the app's own runtime, at install time only |
| Multi-platform binary build orchestration | Build tier (`package.json` `build:binary` script) | — | Manual, local-only, no CI per PROJECT.md |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `bun` | 1.3.14 (installed and verified on this machine; current as of research) | Compiles `server/cli.js` into standalone native executables via `--compile` | Explicit project decision (PROJECT.md: "Docker rejected in favor of Bun single-binary distribution"); no alternative considered — `pkg`/`nexe`/Node's own `--experimental-sea-config` were not evaluated since Bun was already the locked choice |
| `node:util` `parseArgs` | Built into Node 18+ and Bun (Bun implements Node's `node:util` API) | Subcommand/flag parsing for `serve`/`hook`/`install-hook` + `--port`/`--host`/`--version`/`--help` | Zero new dependencies; verified working correctly inside a compiled Bun binary in this research session |

**No new npm dependencies are introduced by this phase.** `bun` is a build-time CLI tool (like `tsc` or `webpack`), not an npm package dependency — it is not added to `package.json` `dependencies`/`devDependencies`. `express` and `gray-matter` (already project dependencies) both bundle and run correctly inside a `bun build --compile` output — verified locally with a minimal Express app.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:util parseArgs` | Hand-rolled `process.argv` loop | Both work identically well for this scope (3 subcommands, 4 flags); `parseArgs` is slightly more declarative and self-documenting, hand-rolled is marginally more control over exact error wording. CONTEXT.md leaves this to Claude's discretion — either is acceptable, `parseArgs` is recommended for less code. |
| Bun CLI `--compile` invocations in a shell/npm script loop | `Bun.build()` JS API (programmatic) with `compile: { outfile }` | JS API gives finer-grained per-target error handling (useful for D-13's fail-fast requirement) at the cost of writing the build script in JS instead of a simple bash loop. Either is standard; a Node/JS build script (`scripts/build-binary.js`) using `Bun.build()` programmatically is slightly easier to make fail-fast and print clean errors than chaining `&&` in `package.json`. |

**Installation:** No `npm install` step for this phase. Bun itself must be present on the *build* machine only (verify with `command -v bun`, install via `curl -fsSL https://bun.sh/install | bash` or `brew install bun` per D-12).

**Version verification:** `bun --version` on this machine reports `1.3.14`. WebSearch cross-referenced against Bun's own blog confirms 1.3.14 was released May 12–13, 2026 [CITED: bun.sh/blog] and is the latest stable release as of this research date (2026-07-24) — no newer release found.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new npm packages.** `bun` is a build-time CLI tool invoked via `npx`-free shell/`command -v` checks, not an npm dependency; `express` and `gray-matter` are pre-existing dependencies already in `package.json`, unchanged by this phase. The Package Legitimacy Gate protocol (slopcheck, registry verification) is skipped as out of scope for this phase.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────┐
                     │   npm run build:binary       │
                     │  (build-time only, manual)    │
                     └──────────────┬───────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      1. npm run build:web   2. generate-assets-   3. bun build --compile
         (vite build →           manifest.js           server/cli.js
          web/dist/)             (walks web/dist/,      --target=<platform>
                                  writes ESM             --outfile geezo-<platform>
                                  generatedAssets.mjs     (×5 targets, D-13 fail-fast)
                                  with `import x from
                                  "..." with {type:"file"}`
                                  per discovered file)
                                        │
                                        ▼
                             server/generatedAssets.mjs
                             (embedded at compile time
                              into each binary)

                     ┌───────────────────────────────────┐
                     │     geezo-<platform> (runtime)      │
                     └──────────────────┬────────────────┘
                                        │  process.argv.slice(2)
                                        ▼
                              server/cli.js (argv dispatch)
                     ┌──────────────┬───────────────┬────────────────┐
                     ▼              ▼               ▼                ▼
             no args/--help    serve            hook           install-hook
             print usage,      --port/--host    reads stdin    installHooks(
             exit 0/1          → createApp()     → handle()     `${execPath} hook`,
             (D-05..D-07)        .listen()         (imported     settingsPath)
                                  │                 from            │
                                  ▼                 hooks/          ▼
                          static-serving branch:     gsd-web-      writes
                          dynamic import()           hook.js)      ~/.claude/
                          generatedAssets.mjs                       settings.json
                          → lookup URL path                        (backup-first)
                          → serve embedded file
                          → else fallback index.html
```

### Recommended Project Structure

```
server/
├── cli.js                  # NEW — unified entrypoint, CJS, dispatches subcommands
├── app.js                  # unchanged — createApp() factory, reused by both server.js and cli.js
├── server.js                # unchanged — dev/npm-start entrypoint (PKG-07)
└── generatedAssets.mjs      # NEW, generated + gitignored — ESM, `type: "file"` imports per asset
scripts/
├── generate-assets-manifest.js   # NEW — walks web/dist/, writes server/generatedAssets.mjs
└── install-hook.js                 # refactored — exports installHooks(hookCommand, settingsPath)
hooks/
└── gsd-web-hook.js          # refactored — exports runHookFromStdin()
dist-bin/                    # NEW, gitignored — build:binary output, geezo-<platform>[.exe]
```

### Pattern 1: ESM asset manifest loaded dynamically from a CJS entrypoint

**What:** `server/generatedAssets.mjs` is a generated ES module using `import x from "<path>" with { type: "file" }` per embedded file (per the design doc's codegen approach), exporting a map of URL path → embedded file path. `server/cli.js` stays CommonJS and loads it with `await import('./generatedAssets.mjs')`.

**When to use:** Whenever a CJS-based Bun-compiled app needs to statically embed files — `type: "file"` import attributes are ESM-only.

**Example (verified working, including inside a compiled binary):**
```js
// server/generatedAssets.mjs (generated by scripts/generate-assets-manifest.js)
import assetIndexJs from "../web/dist/assets/index-a1b2c3.js" with { type: "file" };
import indexHtml from "../web/dist/index.html" with { type: "file" };

export const manifest = {
  "/assets/index-a1b2c3.js": assetIndexJs,
  "/index.html": indexHtml,
};
```
```js
// server/cli.js (CommonJS)
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
  res.sendFile(filePath); // filePath is a real (or Bun-virtual /$bunfs/...) readable path
}
```
Source: verified locally this session — a CJS `mainCjs.js` file (`require`-based) doing `await import('./assetsModule.mjs')`, where `assetsModule.mjs` does `import dataPath from "./assets/data.txt" with { type: "file" }`, compiled with `bun build --compile` and ran correctly, printing the embedded file's virtual path (`/$bunfs/root/data-e5enxc8r.txt`) and its contents via `fs.readFileSync`.

### Pattern 2: Minimal argv-based subcommand + flag routing with `node:util parseArgs`

**What:** Node's built-in `parseArgs` (no new dependency) handles subcommand + flag extraction.

**Example (verified working inside a compiled binary):**
```js
// server/cli.js
const { parseArgs } = require('node:util');

const [subcommand, ...rest] = process.argv.slice(2);

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  printUsage();
  process.exit(subcommand ? 0 : 0); // D-05: no-args prints help and exits 0
}

if (subcommand === '--version') {
  console.log(require('../package.json').version); // embedded at compile time
  process.exit(0);
}

if (subcommand === 'serve') {
  const { values } = parseArgs({
    args: rest,
    options: { port: { type: 'string' }, host: { type: 'string' } },
    allowPositionals: false,
  });
  const port = values.port ? Number(values.port) : (process.env.PORT ? Number(process.env.PORT) : 4317); // D-02
  const host = values.host || 'localhost'; // D-04
  // createApp().listen(port, host, ...)
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
`process.argv` inside a compiled binary was verified to be `["bun", "/$bunfs/root/<binary-name>", ...real user args]` — `process.argv.slice(2)` correctly yields only the user-supplied args, exactly as it does under plain `node`/`bun run`. No special-casing needed for the compiled context.

### Anti-Patterns to Avoid

- **Using CJS `require()` with a `type: "file"` second argument to embed assets:** Compiles without error but throws `TypeError: path must be a string or a file descriptor` at runtime — confirmed empirically this session. Always use ESM `import ... with { type: "file" }`, loaded via dynamic `import()` if the caller is CJS.
- **Assuming `process.argv[1]` is the real binary path inside a compiled executable:** It resolves to a virtual `/$bunfs/root/<name>` path, not a real filesystem path. Use `process.execPath` instead when you need the binary's real, on-disk path (needed for D-11's `install-hook` registering `${process.execPath} hook`) — `process.execPath` was verified to correctly resolve to the real path of the compiled binary on disk.
- **Trying to glob-embed a whole directory as extra `bun build` entrypoints instead of codegen:** Bun's docs note directory embedding requires expanding glob patterns into individual entrypoints yourself and does not automatically produce a URL-path-to-embedded-path mapping — the codegen-manifest approach in the design doc (one static `import ... with { type: "file" }` per discovered file, plus a hand-maintained-format map) remains the cleaner, already-designed approach; do not swap it for a raw glob-entrypoint build without also building equivalent manifest logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| CLI flag parsing | A regex-based or manual token-scanning argv parser | `node:util` `parseArgs` | Built into Node/Bun, zero dependencies, handles `--flag value` / `--flag=value` / booleans / short flags correctly, verified working in a compiled binary |
| Cross-platform native executable bundling | A custom Node `pkg`-style bundler or manual V8 snapshot tooling | `bun build --compile` | Already the project's locked architectural decision (PROJECT.md); handles cross-compilation, asset embedding, and Node-API compatibility as a single first-class feature |
| Static file MIME-type/content-type resolution for served assets | Hand-rolled extension-to-MIME-type map | Reuse Express's existing `res.sendFile()` (already does content-type detection via `mime-types`, bundled as an Express dependency) rather than rolling a custom content-type lookup in the embedded-asset serving branch | Express already solves this problem correctly; the only change needed is the file *lookup* source (manifest vs. `fs.existsSync` against `web/dist/`), not the serving mechanism itself |

**Key insight:** This phase is fundamentally "wire two already-built things together" (Bun's compile/embed feature + the existing Express app) rather than build anything novel. The only genuinely new code is the CLI dispatch shim and the codegen script — both are small and should stay small.

## Common Pitfalls

### Pitfall 1: `type: "file"` import attributes silently fail under CommonJS `require()`

**What goes wrong:** Writing `require("./path", { with: { type: "file" } })` (mirroring the ESM syntax) compiles cleanly but throws `TypeError: path must be a string or a file descriptor` the first time the "file path" (actually a `Module` object) is passed to `fs.readFileSync`.
**Why it happens:** Import attributes (`with { type: "file" }`) are a proposed ECMAScript module-system feature; Bun implements them for `import` statements specifically, not as a generic `require()` option. `require()` returns a normal CJS module wrapper object instead.
**How to avoid:** Author `server/generatedAssets.mjs` as an ES module using real `import` statements; load it from CJS code via `await import('./generatedAssets.mjs')` (dynamic import interop from CJS to ESM works correctly and was verified in a compiled binary).
**Warning signs:** `TypeError: path must be a string or a file descriptor` at the `fs.readFileSync`/`res.sendFile` call site; the "path" value logs as an object (`Module { default: ... }`) instead of a string.

### Pitfall 2: PKG-06's "missing generatedAssets.js" scenario mostly applies to non-compiled execution, not the compiled binary itself

**What goes wrong:** Assuming the "explicit error for missing `server/generatedAssets.js`" requirement needs special handling *inside* the compiled binary.
**Why it happens:** Because `generatedAssets.mjs`'s imports are statically embedded at `bun build --compile` time, if the file were genuinely absent, the *build itself* would fail (with a Bun bundler error), not the runtime. The scenario PKG-06 actually protects against is someone running `node server/cli.js serve` (or `bun server/cli.js serve`, non-compiled) directly in a dev/test context without having first run `npm run build:web && node scripts/generate-assets-manifest.js`.
**How to avoid:** Wrap the `import('./generatedAssets.mjs')` call in try/catch (see Pattern 1 code example) so the friendly error message fires in the non-compiled dev-execution path; this same guard is harmless (never triggers) once bundled into a compiled binary, since the import will always resolve there.
**Warning signs:** A raw `Cannot find module './generatedAssets.mjs'` stack trace instead of a clear instructional message, when running `server/cli.js` directly via `node`/`bun` without generated assets present.

### Pitfall 3: Cross-compile targets require network access on first use per target

**What goes wrong:** `npm run build:binary` fails or hangs with no obvious error on a machine with no internet access, the first time a given `--target` is built.
**Why it happens:** Bun cross-compilation works by downloading the target platform's Bun runtime binary (cached under `~/.bun/install/cache`) and linking the compiled app against it — verified this session: building `bun-linux-x64` and `bun-windows-x64` from this darwin-arm64 machine triggered multi-step "Downloading [...]" output before compiling successfully.
**How to avoid:** Document that the first `build:binary` run needs network access; subsequent runs targeting the same platforms reuse the cache and work offline. Not a blocker given PROJECT.md's "manual/local-only" build model, but worth a one-line note in the build script's output or README.
**Warning signs:** Long pause with "Downloading [...]" lines in build output (expected, not an error) versus a genuine network-failure stack trace (actual problem) if fully offline.

### Pitfall 4: Compiled binaries are large (66–94 MB each)

**What goes wrong:** Surprise at `dist-bin/` ballooning to 350–450 MB total across 5 targets, or CI/artifact-size assumptions breaking (though CI isn't in scope here per PROJECT.md).
**Why it happens:** Each output bundles a full copy of the Bun runtime plus the app code and embedded assets — this is expected behavior for self-contained executables, not a misconfiguration.
**How to avoid:** No action needed for this phase (no CI, no distribution-size constraint stated), but the planner should not treat large binary sizes as a bug to "fix" — confirm `dist-bin/` is gitignored (it should already be per the design doc) so these aren't accidentally committed.
**Warning signs:** N/A — this is expected, verified behavior, not a defect.

## Code Examples

### Reading stdin identically in a compiled binary vs. plain Node

```js
// hooks/gsd-web-hook.js — runHookFromStdin() extraction (design doc's plan)
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
module.exports = { handle, runHookFromStdin };
```
Verified this session: a minimal compiled binary with the identical stdin-reading pattern correctly received and processed piped JSON (`echo '{"hello":"world"}' | ./hook-bin` printed the parsed content) — no differences in stdin behavior between a compiled Bun executable and plain `node`/`bun run`.

### `process.execPath` resolves correctly for `install-hook`

```js
// server/cli.js's install-hook subcommand
const { installHooks } = require('../scripts/install-hook');
installHooks(`${process.execPath} hook`); // process.execPath verified to be the real on-disk binary path
```
Verified this session: inside a compiled binary, `console.log(process.execPath)` printed the actual absolute filesystem path to the compiled executable (e.g. `/path/to/cli-bin`), **not** the virtual `/$bunfs/root/...` path that `process.argv[1]` resolves to. This distinction matters directly for PKG-05 — `process.execPath`, not `process.argv[1]` or `process.argv[0]`, is the correct source for the binary's own path.

### Express apps bundle and run correctly under `bun build --compile`

Verified this session: a minimal Express app (`require('express')`, `app.listen()`) compiled cleanly (139 modules bundled) and ran correctly as a standalone binary, confirming `server/app.js`'s existing Express-based `createApp()` factory needs no changes to work inside a compiled binary.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `pkg` (Vercel's now-deprecated Node packaging tool) or manual Node SEA (`--experimental-sea-config`) | `bun build --compile` | Bun's compile feature has been stable and actively improved through 2024–2026 (cross-compilation added per PR oven-sh/bun#10477) | Already the project's locked decision; no migration needed, just confirms the choice remains well-supported |

**Deprecated/outdated:** None directly relevant — this is a from-scratch adoption of Bun's current compile feature, not a migration off an older Bun API.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `Bun.build()`'s JS API is "slightly easier" for fail-fast (D-13) than chaining shell commands | Standard Stack / Alternatives Considered | Low — this is a stylistic recommendation, not a hard requirement; a bash loop with `set -e` (or `&&` chaining) achieves the same fail-fast behavior equally well. Planner/implementer can pick either. |

**All other claims in this document were verified locally during this research session** (by compiling and running actual Bun binaries on this machine) or cited from official Bun documentation (`bun.com/docs/bundler/executables`) — none rely solely on unverified training-data recall.

## Open Questions

1. **Should `server/cli.js` itself be authored as CJS (per the codebase's existing convention) or ESM?**
   - What we know: Both work. A CJS `cli.js` can dynamically `import()` the ESM `generatedAssets.mjs` (verified working, including compiled). Converting `cli.js` fully to ESM was not necessary in any verified test.
   - What's unclear: Whether the planner prefers `cli.js` to stay CJS (matching `server/app.js`, `server/server.js` convention) for consistency, or become the project's first ESM file.
   - Recommendation: Keep `server/cli.js` as CommonJS, matching existing project convention (`"type": "commonjs"` in `package.json`, all other files CJS) — only `server/generatedAssets.mjs` needs to be ESM, and only because `type: "file"` import attributes require it.

2. **Exact `--help` text wording and error message formatting.**
   - What we know: CONTEXT.md explicitly leaves this to Claude's discretion (D-06/D-07 specify *what* must appear, not exact wording).
   - What's unclear: N/A — this is intentionally open per CONTEXT.md.
   - Recommendation: Planner/implementer picks reasonable, conventional CLI help text (usage line, subcommand list with one-line descriptions, flags per subcommand) — no further research needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|-----------|
| `bun` | `npm run build:binary` (all of PKG-02, PKG-03) | Yes (this machine) | 1.3.14 | D-12 requires a friendly pre-check + install instructions if absent on other machines; no code fallback exists (Bun is mandatory for this phase's core feature) |
| Network access (for first-time cross-compile per target) | Cross-compiling to `linux-x64`/`linux-arm64`/`windows-x64`/`darwin-x64` from this darwin-arm64 machine | Yes (verified — downloads succeeded during research) | — | None needed if network is available; if genuinely offline with no cached target runtimes, that specific target's build will fail — acceptable given PROJECT.md's manual/local-only build model |
| Node.js (for `npm run dev`/`start`/`test`, unaffected by this phase) | PKG-07 | Yes | (project's existing Node version, unchanged) | N/A — untouched by this phase |

**Missing dependencies with no fallback:** None on this machine — `bun` is present and verified working for all 5 targets.

**Missing dependencies with fallback:** None applicable to this phase's core requirements.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` + `node:assert/strict` (no external test framework) |
| Config file | none — invoked directly via `npm test` script: `node --test "tests/server/**/*.test.js" "tests/hooks/**/*.test.js" "tests/scripts/**/*.test.js"` |
| Quick run command | `node --test tests/hooks/gsd-web-hook.test.js tests/scripts/install-hook.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| PKG-01 | `server/cli.js` dispatches `serve`/`hook`/`install-hook`, `--help`, unknown-command error | unit | `node --test tests/server/cli.test.js` | ❌ Wave 0 — new file needed |
| PKG-02 | `npm run build:binary` produces 5 correctly-named binaries | manual/smoke (per design doc — only darwin-arm64 executable on this machine; others build-verified via `file <path>`) | `npm run build:binary && file dist-bin/*` | ❌ Wave 0 — new `build:binary` script and manual smoke checklist |
| PKG-03 | Compiled binary serves embedded frontend correctly | unit (manifest generation logic) + manual smoke (actual serving) | `node --test tests/scripts/generate-assets-manifest.test.js` | ❌ Wave 0 — new file, tested against a fixture directory, not a real Vite build (per design doc) |
| PKG-04 | `hook` subcommand behaves identically to `node hooks/gsd-web-hook.js` | unit | `node --test tests/hooks/gsd-web-hook.test.js` (extend existing file with `runHookFromStdin()` coverage) | ✅ existing file, needs extension |
| PKG-05 | `install-hook` reuses `installHooks(hookCommand, settingsPath)` with binary path | unit | `node --test tests/scripts/install-hook.test.js` (update existing tests for new signature: full command string instead of bare script path) | ✅ existing file, needs signature-change updates |
| PKG-06 | Missing `generatedAssets.mjs` produces explicit error in non-compiled execution | unit | `node --test tests/server/cli.test.js` (new — assert friendly error path) | ❌ Wave 0 |
| PKG-07 | `npm run dev`/`start`/`test` unaffected | regression | `npm test` (full existing suite must remain green with zero modification to `server/server.js`/`server/app.js` behavior) | ✅ existing suite |

### Sampling Rate

- **Per task commit:** targeted `node --test` on the file(s) touched (e.g. `tests/hooks/gsd-web-hook.test.js` after touching `hooks/gsd-web-hook.js`)
- **Per wave merge:** `npm test` (full existing suite, must stay green — protects PKG-07)
- **Phase gate:** Full suite green, plus the manual smoke checklist from the design doc's Testing section (build the binary, run it, hit `/api/health` and `/`, pipe a hook payload, run `install-hook` against a scratch settings path) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/server/cli.test.js` — covers PKG-01 (subcommand dispatch, `--help`, unknown command → exit 1), PKG-06 (missing-assets error path)
- [ ] `tests/scripts/generate-assets-manifest.test.js` — covers PKG-03's manifest-generation logic against a small fixture directory (not a real Vite build, per design doc's stated testing approach)
- [ ] Extend `tests/hooks/gsd-web-hook.test.js` — add `runHookFromStdin()` coverage (PKG-04)
- [ ] Update `tests/scripts/install-hook.test.js` — existing tests currently call `mergeHookConfig({}, '/path/to/gsd-web-hook.js')` and assert `command === 'node /path/to/gsd-web-hook.js'`; must be updated for the new signature where the second parameter is a full command string, not a bare script path (design doc: `mergeHookConfig(existing, hookCommand)` where `hookCommand` is e.g. `"node /abs/path/hooks/gsd-web-hook.js"` or `"/abs/path/to/binary hook"`)
- [ ] No test framework install needed — `node:test` is already in use project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|--------------------|
| V2 Authentication | No | Explicitly out of scope — PROJECT.md: single-user, localhost-only, no-auth by design |
| V3 Session Management | No | No sessions introduced by this phase |
| V4 Access Control | No | No access-control surface added; `--host 0.0.0.0` is an explicit user opt-in to LAN exposure (D-04), not a default |
| V5 Input Validation | Yes | CLI flag values (`--port`, `--host`) should be validated (`Number(values.port)` checked for `NaN`/valid port range 1–65535 before use) rather than passed through unchecked to `.listen()` |
| V6 Cryptography | No | No new cryptographic operations introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Invalid/malicious `--port` value causing a crash or unexpected bind behavior | Denial of Service | Validate `--port` is a parseable integer in the valid TCP port range before passing to `.listen()`; fall back to default (4317) or print a clear error on invalid input |
| `--host 0.0.0.0` inadvertently exposing the no-auth dashboard to a LAN | Information Disclosure / Elevation of Privilege | Already addressed by D-04 (defaults to `localhost`, requires explicit opt-in) — no additional code needed beyond honoring the default; consider a one-line startup log noting when bound to a non-localhost host, so the exposure is visible in terminal output, not silent |
| Hook `install-hook` overwriting `~/.claude/settings.json` unsafely | Tampering | Already addressed by existing backup-before-write behavior in `scripts/install-hook.js` (Task 14, per design doc) — must be preserved unchanged through the `installHooks(hookCommand, settingsPath)` refactor |

## Sources

### Primary (HIGH confidence — verified locally this session)

- Local build/run verification on this machine (Bun 1.3.14, darwin-arm64): file embedding via ESM `import ... with { type: "file" }` (works) vs. CJS `require(..., { with: { type: "file" } })` (fails at runtime); `process.execPath` vs. `process.argv` resolution inside a compiled binary; stdin reading in a compiled binary; `node:util parseArgs` inside a compiled binary; Express bundling inside a compiled binary; cross-compilation to all 5 required targets (`bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`) from this single darwin-arm64 machine
- [Bun docs: Single-file executable](https://bun.com/docs/bundler/executables) — cross-compile target list, file/directory embedding mechanism, `Bun.build()` JS API, Windows-specific flags

### Secondary (MEDIUM confidence)

- [Bun v1.3.13 blog post](https://bun.sh/blog/bun-v1.3.13) and related WebSearch results confirming 1.3.14 (May 2026) is the current latest stable release as of this research date
- [oven-sh/bun PR #10477 — cross-compilation support](https://github.com/oven-sh/bun/pull/10477) — historical confirmation this is a stable, intentionally-built feature, not a recent/fragile addition

### Tertiary (LOW confidence)

None — all findings above were either verified locally or cited from official documentation/blog sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Bun version and behavior confirmed by direct local build/execution, not just docs
- Architecture: HIGH — the ESM-vs-CJS embedding nuance, `process.execPath` behavior, and stdin handling were all empirically verified, not assumed
- Pitfalls: HIGH — all four documented pitfalls were either directly triggered/observed this session or are direct logical consequences of verified behavior

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (30 days — Bun releases roughly monthly; re-verify `bun --version` and re-check for `--compile`/embedding API changes if planning is delayed significantly past this window)
