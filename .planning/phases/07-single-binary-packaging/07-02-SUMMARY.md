---
phase: 07-single-binary-packaging
plan: 02
subsystem: infra
tags: [bun, esm, asset-embedding, build-tooling]

# Dependency graph
requires:
  - phase: 07-single-binary-packaging (plan 01)
    provides: scripts/install-hook.js pure-function/require.main split pattern to mirror
provides:
  - "scripts/generate-assets-manifest.js: generateManifestSource(distDir) pure function producing ESM `import ... with { type: \"file\" }` statements + manifest export, plus a require.main CLI writer to server/generatedAssets.mjs"
  - "tests/scripts/generate-assets-manifest.test.js: fixture-based unit coverage (no real Vite build required)"
  - ".gitignore updated to exclude server/generatedAssets.mjs and dist-bin/"
affects: [07-03 (server/cli.js serve consuming the generated manifest), 07-04 (build:binary orchestration script)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function/require.main split (mirrors scripts/install-hook.js) for testable CLI scripts"
    - "Deriving directory anchors from a passed-in path via path.resolve(x, '..', '..', 'name') instead of __dirname, to keep relative-path generation testable against arbitrary fixture directories without leaking absolute filesystem paths"

key-files:
  created:
    - scripts/generate-assets-manifest.js
    - tests/scripts/generate-assets-manifest.test.js
  modified:
    - .gitignore

key-decisions:
  - "Compute the server/ anchor directory from distDir's own structure (path.resolve(distDir, '..', '..', 'server')) rather than from __dirname, so the same relative-path logic is both correct for the real web/dist -> server/generatedAssets.mjs layout and safely testable against arbitrary temp fixture directories without ever embedding an absolute machine-specific path in generated import specifiers."

patterns-established:
  - "Pattern: pure generateX(...) function + require.main === module I/O block + module.exports, for any future build-time codegen script in scripts/."

requirements-completed: [PKG-03]

# Metrics
duration: 25min
completed: 2026-07-24
---

# Phase 07 Plan 02: Asset Manifest Generator Summary

**`scripts/generate-assets-manifest.js` walks a built `web/dist/` and emits an ESM module with static `import ... with { type: "file" }` statements plus a `manifest` URL-path lookup, ready for Bun's compile-time asset embedding.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `generateManifestSource(distDir)` recursively walks a directory and produces valid ESM source matching RESEARCH.md's verified target shape exactly (`import asset__index_html from "../web/dist/index.html" with { type: "file" };` style imports + `export const manifest = { ... }`).
- Fixture-based test suite (3 tests) validates shape, relative-path portability, and missing-directory error handling without requiring a real Vite build.
- `.gitignore` updated so `server/generatedAssets.mjs` and future `dist-bin/` build output are never committed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement generateManifestSource(distDir) and the manifest-writing CLI script** - `3e92535` (feat)
2. **Task 2: Test generateManifestSource against a fixture directory; update .gitignore** - `3451b19` (test — also includes a same-commit fix to Task 1's serverDir derivation, see Deviations)

_Note: Task 2 folded a necessary fix to Task 1's code into the same test commit since the fix was discovered while writing Task 2's tests and both touch the same acceptance criteria._

## Files Created/Modified
- `scripts/generate-assets-manifest.js` - `generateManifestSource(distDir)` pure function + `require.main` CLI writer (CommonJS, no new dependencies)
- `tests/scripts/generate-assets-manifest.test.js` - 3 fixture-based tests using `node:test`/`node:assert/strict`
- `.gitignore` - added `server/generatedAssets.mjs` and `dist-bin/`

## Decisions Made
- Derived the `server/` anchor directory from `distDir` via `path.resolve(distDir, '..', '..', 'server')` instead of `__dirname`. Using `__dirname` is correct for the real invocation (`distDir = <repo>/web/dist`, script lives in `<repo>/scripts/`) but breaks portability guarantees when tested against an unrelated fixture directory (e.g. under `os.tmpdir()`): `path.relative` between two absolute paths whose only common ancestor is the filesystem root necessarily reproduces the full absolute path of one argument as a substring of the result. Deriving the anchor from `distDir`'s own two-levels-up structure keeps the real-world output byte-identical to RESEARCH.md's target shape while making the generated import specifiers structurally incapable of leaking an absolute fixture path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed serverDir derivation to avoid leaking absolute fixture paths in generated import specifiers**
- **Found during:** Task 2 (writing the "relative import paths, not absolute filesystem paths" test)
- **Issue:** Task 1's initial implementation computed the import-path anchor via `path.join(__dirname, '..', 'server')`. This produces the correct output for the real `web/dist` -> `server/generatedAssets.mjs` case, but when tested against a fixture directory created under `os.tmpdir()` (an unrelated directory tree), `path.relative(serverDir, filePath)` necessarily reconstructs and embeds the fixture directory's full absolute path in the generated import specifier — a portability/reproducibility violation the plan's Task 2 acceptance criteria explicitly test for.
- **Fix:** Changed the anchor computation to `path.resolve(distDir, '..', '..', 'server')`, deriving the server directory purely from `distDir`'s own path structure rather than the script's own location. Verified this produces byte-identical output to RESEARCH.md's target shape for the real case (`../web/dist/...`) while never leaking the fixture's absolute path for the test case.
- **Files modified:** scripts/generate-assets-manifest.js
- **Verification:** `node --test tests/scripts/generate-assets-manifest.test.js` — all 3 tests pass; manually verified real-usage output against a temporary `web/dist/` fixture matches RESEARCH.md's shape exactly.
- **Committed in:** `3451b19` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness of the plan's own stated acceptance criteria (portability test). No scope creep — same file, same task's behavior contract.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `scripts/generate-assets-manifest.js` and its `generateManifestSource` export are ready to be invoked by Plan 07-04's `npm run build:binary` orchestration script.
- `server/generatedAssets.mjs` (gitignored, not yet generated in a committed state) is the artifact Plan 07-03's `server/cli.js serve` will consume in place of `express.static`.
- No blockers identified.

---
*Phase: 07-single-binary-packaging*
*Completed: 2026-07-24*
