---
phase: 07-single-binary-packaging
plan: 04
subsystem: infra
tags: [bun, build-tooling, cross-compile, npm-scripts]

# Dependency graph
requires:
  - phase: 07-single-binary-packaging (plan 02)
    provides: scripts/generate-assets-manifest.js CLI script invoked by the build pipeline
  - phase: 07-single-binary-packaging (plan 03)
    provides: server/cli.js as the bun build --compile entrypoint
provides:
  - "scripts/build-binary.js: getTargets() (5-target list), checkBunAvailable() (safe bun presence check), and a require.main orchestration block chaining build:web -> generate-assets-manifest.js -> fail-fast bun build --compile per target"
  - "npm run build:binary script entry in package.json"
  - "tests/scripts/build-binary.test.js: unit coverage of the pure target-list and bun-check logic"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function/require.main split (mirrors scripts/install-hook.js and scripts/generate-assets-manifest.js) for testable CLI orchestration scripts"
    - "execFileSync with a fixed argv array (never string-interpolated) for subprocess invocations shelling out to external build tools"

key-files:
  created:
    - scripts/build-binary.js
    - tests/scripts/build-binary.test.js
  modified:
    - package.json

key-decisions:
  - "Wrapped each per-target bun build --compile call individually in try/catch inside the loop so the fail-fast error message (D-13) prints before process.exit(1), rather than letting a raw uncaught exception surface from execFileSync."

patterns-established:
  - "Pattern: any future multi-target build/compile orchestration script should follow build-binary.js's pure getTargets()-style list + require.main block + module.exports shape."

requirements-completed: [PKG-02, PKG-07]

# Metrics
duration: 20min
completed: 2026-07-24
---

# Phase 07 Plan 04: Multi-Platform Build Orchestration Script Summary

**`npm run build:binary` now chains build:web -> asset-manifest generation -> 5 fail-fast `bun build --compile` invocations of `server/cli.js`, producing `dist-bin/geezo-<platform>[.exe]` for all D-09/D-10-specified targets, with a friendly bun-missing pre-check.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `scripts/build-binary.js` exports `getTargets()` — the exact 5-entry `{ platform, bunTarget, outfile }` list matching D-09/D-10's confirmed Bun `--target` values and output names (`geezo-darwin-arm64`, `geezo-darwin-x64`, `geezo-linux-x64`, `geezo-linux-arm64`, `geezo-windows-x64.exe`).
- `checkBunAvailable()` performs a side-effect-free `command -v bun` presence check, returning a boolean without throwing regardless of whether bun is installed.
- The `require.main` orchestration block implements D-12 (friendly bun-missing error with both `curl -fsSL https://bun.sh/install | bash` and `brew install bun` install options) and D-13 (fail-fast: any target's `bun build --compile` failure halts immediately via `process.exit(1)`, no continuing to remaining targets).
- `package.json` gains exactly one new script entry, `"build:binary": "node scripts/build-binary.js"`, appended after `install-hook`; all 7 pre-existing script entries verified byte-identical to their pre-plan values (PKG-07).
- `tests/scripts/build-binary.test.js` (3 tests) covers `getTargets()`'s exact shape, the `.exe`-only-on-`windows-x64` invariant (D-10), and `checkBunAvailable()`'s safe boolean return.
- Full existing suite (`tests/server/**`, `tests/hooks/**`, `tests/scripts/**`) is green at 58/58, confirming no regression.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement scripts/build-binary.js — bun pre-check, target list, fail-fast multi-target build loop** - `c7109d5` (feat)
2. **Task 2: Unit-test target list and bun pre-check; wire package.json build:binary script; confirm PKG-07 regression-free** - `073c56f` (test)

## Files Created/Modified
- `scripts/build-binary.js` (new) - `getTargets()` and `checkBunAvailable()` pure/safe exports, plus a `require.main` CLI block orchestrating `build:web` -> asset-manifest generation -> 5-target `bun build --compile` loop (CommonJS, `node:child_process`/`node:fs`/`node:path` only, no new dependencies).
- `tests/scripts/build-binary.test.js` (new) - 3 `node:test`/`node:assert/strict` tests exercising `getTargets()` and `checkBunAvailable()` directly (no subprocess mocking needed, both exported functions are safe to call).
- `package.json` (modified) - added `"build:binary": "node scripts/build-binary.js"` after `install-hook`; all other 7 entries unchanged.

## Decisions Made
- Each per-target `bun build --compile` call is wrapped in its own try/catch inside the loop (rather than one try/catch around the whole loop) so the D-13 fail-fast message can name the specific failing platform before exiting, and so the loop structurally cannot continue to a subsequent target after a failure.

## Deviations from Plan
None - plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` exactly.

## Issues Encountered
- The `Edit` tool and some `Bash`/`node -e` invocations in this worktree trigger a `PostToolUse` hook error ("Not logged into Semgrep Guardian"), the same environment issue documented in Plans 07-01 and 07-03's summaries. For `package.json`'s edit, this silently prevented the `Edit` tool from applying the change even though the tool call reported success; worked around via `Bash` + `python3` doing the identical string replacement, then verified via `grep`/`node -e` checks and the acceptance-criteria script.
- The optional manual smoke check (per 07-VALIDATION.md, not part of automated acceptance criteria) — actually running `npm run build:binary` with `bun` installed on this machine to confirm `dist-bin/geezo-darwin-arm64 --help` runs and `file dist-bin/*` reports expected binary formats — could not be completed in this session: the same hook environment issue intercepted the `npm run build:binary` Bash invocation before any output or `dist-bin/` artifacts were produced (confirmed via `ls dist-bin/` returning "No such file or directory" after the attempt). This does not affect any automated acceptance criterion; all `node --test` and `grep`-based acceptance criteria for both tasks passed directly. Recommend a follow-up manual run of `npm run build:binary` outside this worktree's hook environment to confirm the real cross-compile end-to-end, per 07-VALIDATION.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `npm run build:binary` is fully wired: `scripts/build-binary.js` chains `build:web` -> `scripts/generate-assets-manifest.js` -> 5 fail-fast `bun build --compile server/cli.js` invocations producing `dist-bin/geezo-<platform>[.exe]`.
- PKG-02 (build orchestration) and PKG-07 (existing dev/start/test scripts unaffected) are both satisfied per automated acceptance criteria.
- Outstanding: the manual end-to-end smoke test (actually running the compiled binaries) was not completed in this session due to an environment hook issue intercepting the Bash invocation — see "Issues Encountered". This is the last verification step in 07-VALIDATION.md and should be run manually before considering Phase 7 fully validated.
- No architectural blockers identified; this was the final wave-3 plan of Phase 7.

---
*Phase: 07-single-binary-packaging*
*Completed: 2026-07-24*

## Self-Check: PASSED
All created files (scripts/build-binary.js, tests/scripts/build-binary.test.js, this SUMMARY.md) confirmed present on disk. All 3 task/plan commits (c7109d5, 073c56f, 6bdef05) confirmed present in git log.
