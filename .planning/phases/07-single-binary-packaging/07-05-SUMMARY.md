---
phase: 07-single-binary-packaging
plan: 05
subsystem: packaging
tags: [bun, sqlite, embedded-assets, regression]
requires:
  - phase: 07-04
    provides: Multi-platform build orchestration
provides:
  - Verified lazy Bun/Node read-only SQLite selection
  - Safe embedded asset lookup and standalone file delivery
  - Real-runtime and compiled-distribution smoke tests
affects: [distribution]
tech-stack:
  added: []
  patterns: [isolated application homes, compiled executable smoke tests]
key-files:
  created: [tests/scripts/binary-smoke.test.js]
  modified: [server/cli.js, server/app.js, tests/server/cli.test.js]
key-decisions:
  - Preserve the existing process.versions.bun lazy SQLite driver fix and its regression test.
  - Disable disk frontend fallback in CLI serve so embedded asset failures cannot be masked.
  - Read Bun embedded files as bytes because Express sendFile returned 404 for virtual embedded paths.
requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, PKG-06]
duration: 18 min
completed: 2026-11-01
coverage:
  - id: D1
    description: SQLite driver works under Node and Bun without modifying the database
    verification:
      - kind: integration
        ref: tests/server/gsdDbReader.test.js
        status: pass
    human_judgment: false
  - id: D2
    description: Only owned string asset paths are served with a safe fallback or 404
    verification:
      - kind: unit
        ref: tests/server/cli.test.js
        status: pass
    human_judgment: false
  - id: D3
    description: Real Bun and the compiled distribution serve API and embedded frontend outside the checkout
    verification:
      - kind: e2e
        ref: tests/scripts/binary-smoke.test.js
        status: pass
    human_judgment: false
---

# Phase 07 Plan 05: Packaging Gap Closure

**The standalone distribution now serves its embedded frontend, guards manifest lookups, and has regression coverage under the real Bun runtime.**

## Accomplishments

- Confirmed Task 1's existing lazy SQLite driver fix and cross-runtime read-only test; no duplicate implementation.
- Added RED tests for owned string paths, inherited values, invalid own values, missing fallback and HTTP 404 handling; then implemented the safe resolver.
- Added isolated real-Bun help/version, valid/malformed hook input, health API, missing-manifest error and compiled frontend/API/assets smoke tests.
- Built all five distribution targets; executed the native darwin-arm64 distribution from a temporary directory.

## Task Commits

1. SQLite: existing implementation verified with all 5 reader tests.
2. Asset resolver: `264228a` (RED), `3bbca51` (GREEN).
3. Runtime/compiled smoke and embedded delivery: `f054b7e`.

## Verification

`GEEZO_TEST_BINARY=/Users/matthew/Code/geezo/dist-bin/geezo-darwin-arm64 node --test --test-concurrency=1 'tests/server/**/*.test.js' 'tests/hooks/**/*.test.js' 'tests/scripts/**/*.test.js'`: **114 passed, 0 failed, 0 skipped**. Log: `/tmp/geezo-07-final-full.log`.

`npm run build:binary`: all five targets built. Log: `/tmp/geezo-07-all-targets.log`. Non-native targets were compiled, not executed on this macOS host.

## Deviations from Plan

- Existing Task 1 fix used `process.versions.bun` rather than the plan's `typeof Bun`; behavior already meets the intended runtime contract.
- Added `createApp({ staticAssets: false })` in CLI serve: disk frontend fallback otherwise hid embedded asset failures.
- Added Bun-specific byte responses after the compiled smoke test showed Express sendFile returning 404 for embedded paths. Native binary regression now exercises actual HTML and referenced assets.
- Asset loader injection makes missing/invalid-manifest unit tests deterministic. Express registration wraps the handler so Express's next argument cannot be mistaken for the loader.

## Issues Encountered

Sandbox denied local listeners/watchers; verification succeeded with approved local execution. No unresolved implementation blocker.

## Next Phase Readiness

All five plan summaries exist. Phase verification and tracking reconciliation remain before completion.
