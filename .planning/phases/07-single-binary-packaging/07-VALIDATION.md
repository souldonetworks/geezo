---
phase: 07
slug: single-binary-packaging
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-24
validated: 2026-11-01
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` + `node:assert/strict` (no external test framework) |
| **Config file** | none — invoked via `npm test`: `node --test "tests/server/**/*.test.js" "tests/hooks/**/*.test.js" "tests/scripts/**/*.test.js"` |
| **Quick run command** | `node --test tests/hooks/gsd-web-hook.test.js tests/scripts/install-hook.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run targeted `node --test` on the file(s) touched (e.g. `tests/hooks/gsd-web-hook.test.js` after touching `hooks/gsd-web-hook.js`)
- **After every plan wave:** Run `npm test` (full existing suite, must stay green — protects PKG-07)
- **Before `/gsd:verify-work`:** Full suite green, plus the manual smoke checklist (build the binary, run it, hit `/api/health` and `/`, pipe a hook payload, run `install-hook` against a scratch settings path)
- **Max feedback latency:** ~5 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 07-01 | 1 | PKG-04 | — | `hooks/gsd-web-hook.js` exports `runHookFromStdin()`, reused by `hook` subcommand, `handle()` behavior unchanged | unit | `node --test tests/hooks/gsd-web-hook.test.js` (extended) | ✅ existing, extended | ✅ green |
| 07-01-T2 | 07-01 | 1 | PKG-05 | T-07-04 | `scripts/install-hook.js` exports `installHooks(hookCommand, settingsPath)` with full-command-string signature, backup-before-write preserved | unit | `node --test tests/scripts/install-hook.test.js` (updated signature) | ✅ existing, signature updated | ✅ green |
| 07-02-T1 | 07-02 | 1 | PKG-03 | — | `generateManifestSource(distDir)` produces correct `type: "file"` import statements + URL-path manifest against a fixture directory | unit | `node --test tests/scripts/generate-assets-manifest.test.js` (new) | ✅ present, tested | ✅ green |
| 07-02-T2 | 07-02 | 1 | PKG-03 | — | Generator handles nested dirs, relative import paths, missing-dir error; `.gitignore` updated for `server/generatedAssets.mjs` + `dist-bin/` | unit | `node --test tests/scripts/generate-assets-manifest.test.js` | ✅ present, tested | ✅ green |
| 07-03-T1 | 07-03 | 2 | PKG-01, PKG-06 | T-07-01, T-07-02, T-07-03 | `server/cli.js` dispatches serve/hook/install-hook, `--help`/no-args/`--version`/unknown-command; `--port`/`--host` validated; missing `generatedAssets.mjs` produces explicit error via `serveEmbeddedAsset()`, not a crash | unit | `node -e "const cli = require('./server/cli'); ..."` (load-time check) + `node --test tests/server/cli.test.js` | ✅ present, tested | ✅ green |
| 07-03-T2 | 07-03 | 2 | PKG-01, PKG-05, PKG-06 | T-07-01, T-07-02, T-07-03 | `dispatch()` subcommand routing, `resolvePort`/`resolveHost` precedence, unknown-command exit 1, invalid-port rejection, `install-hook` uses `process.execPath` (not `argv[1]`), `serveEmbeddedAsset` catch branch fires (console.error + process.exit(1) stub) | unit | `node --test tests/server/cli.test.js` | ✅ present, tested | ✅ green |
| 07-04-T1 | 07-04 | 3 | PKG-02 | T-07-SC | `scripts/build-binary.js` exports `getTargets()` (5 correctly-named platform targets) and `checkBunAvailable()`; fail-fast per-target build loop with D-12 friendly bun-missing error | unit | `node -e "const b = require('./scripts/build-binary'); ..."` | ✅ present, tested | ✅ green |
| 07-04-T2 | 07-04 | 3 | PKG-02, PKG-07 | — | `getTargets()`/`checkBunAvailable()` unit-tested; `package.json` gains exactly one `build:binary` entry, all 7 existing scripts byte-identical; full suite green | unit + regression | `node --test tests/scripts/build-binary.test.js && npm test` | ✅ present, tested | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Manual/smoke-only behaviors (compiled binary execution across all 5 platforms, PKG-02) are tracked separately in "Manual-Only Verifications" below, not in this automated map.*

---

## Wave 0 Requirements

- [x] `tests/server/cli.test.js` — covers PKG-01 (subcommand dispatch, `--help`, unknown command → exit 1), PKG-06 (missing-assets error path via direct `serveEmbeddedAsset` invocation), and `--port`/`--host` validation (07-03)
- [x] `tests/scripts/generate-assets-manifest.test.js` — covers PKG-03's manifest-generation logic against a small fixture directory (not a real Vite build) (07-02)
- [x] `tests/scripts/build-binary.test.js` — covers PKG-02's `getTargets()`/`checkBunAvailable()` pure logic (07-04)
- [x] Extend `tests/hooks/gsd-web-hook.test.js` — add `runHookFromStdin()` coverage (PKG-04) (07-01)
- [x] Update `tests/scripts/install-hook.test.js` — existing tests call `mergeHookConfig({}, '/path/to/gsd-web-hook.js')` and assert `command === 'node /path/to/gsd-web-hook.js'`; updated for the new signature where the second parameter is a full command string (e.g. `"node /abs/path/hooks/gsd-web-hook.js"` or `"/abs/path/to/binary hook"`) (07-01)
- [x] No test framework install needed — `node:test` is already in use project-wide

---

## Security Domain (ASVS L1)

### Applicable Categories

| ASVS Category | Applies | Notes |
|-----------------|---------|--------------------|
| V2 Authentication | No | Single-user, localhost-only, no-auth by design (PROJECT.md) |
| V3 Session Management | No | No sessions introduced |
| V4 Access Control | No | `--host 0.0.0.0` is an explicit opt-in (D-04), not a default |
| V5 Input Validation | Yes | `--port`/`--host` CLI values must be validated before use |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threats

| ID | Pattern | STRIDE | Mitigation |
|----|---------|--------|------------|
| T-07-01 | Missing `generatedAssets.mjs` at `serve`-time crashes on unresolved import | Denial of Service | PKG-06: explicit, clear error message instead of a raw import-resolution crash |
| T-07-02 | Invalid/malicious `--port` value causes a crash or unexpected bind behavior | Denial of Service | Validate `--port` is a parseable integer in range 1–65535 before `.listen()`; fall back to default (4317) or print a clear error |
| T-07-03 | `--host 0.0.0.0` inadvertently exposes the no-auth dashboard to a LAN | Information Disclosure | D-04 default is `localhost`; log a startup notice when bound to a non-localhost host so exposure is visible, not silent |
| T-07-04 | `install-hook` overwrites `~/.claude/settings.json` unsafely | Tampering | Preserve existing backup-before-write behavior through the `installHooks(hookCommand, settingsPath)` refactor, unchanged |
| T-07-SC | `bun build --compile` subprocess invocation | Tampering | Fixed, hardcoded `execFileSync` argv array (no shell interpolation); D-12 pre-check only detects presence, never auto-installs |

**Block on:** high severity (per project default `security_block_on`). None of the above are rated high — all have a stated, low-cost mitigation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Compiled binary actually runs standalone | PKG-01, PKG-02, PKG-03 | Requires the `bun` CLI and an executable binary; only `darwin-arm64` can be executed on this dev machine | `npm run build:binary`; run `./dist-bin/geezo-darwin-arm64`; confirm `/api/health` and `/` respond; confirm `--help`, `--version`, `--port`, `--host` all behave as specified |
| Cross-platform binary format check | PKG-02 | Other 4 targets can't be executed on this machine | `file dist-bin/geezo-darwin-x64 dist-bin/geezo-linux-x64 dist-bin/geezo-linux-arm64 dist-bin/geezo-windows-x64.exe` — confirm each reports the expected format (Mach-O / ELF / PE32+) and a reasonable file size |
| `hook` subcommand end-to-end via compiled binary | PKG-04 | Confirms the compiled binary's stdin handling, not just the underlying function | Pipe a sample hook JSON payload into `./dist-bin/geezo-darwin-arm64 hook`; confirm it writes a status file and exits 0 |
| `install-hook` end-to-end via compiled binary | PKG-05 | Must not touch the real `~/.claude/settings.json` in automated tests | Run `./dist-bin/geezo-darwin-arm64 install-hook` against a scratch settings file path; confirm backup-then-merge behavior and that the registered command points at the binary path (via `process.execPath`, not `process.argv[1]`) |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated against current code/tests and 07-VERIFICATION.md; not a claim of historical task sampling.


## Evidence Reconciliation — 2026-11-01

The former approved/pending strategy contradicted completed implementation. Each automated-map file exists and its named cases appear green in the saved current full run (/tmp/geezo-closure-full.log: 121 total, 120 passed, zero failures, one optional compiled test skipped). This is a retrospective validation update, not reconstructed historical per-task sampling. Existing 07-VERIFICATION.md independently documents owned-asset lookup, SQLite parity, missing-assets and compiled hook/installer checks with isolated settings and exact backups.

Current /tmp/geezo-closure-native.log explicitly executes the real distribution smoke: 5/5 passed, no skips, including health/embedded resources outside checkout and valid/malformed hook stdin. /tmp/geezo-closure-binaries.log records all five target compiles including frontend build. Cross-target runtime execution remains unverified and was never the local five-build requirement. The native installer result is the prior independent verification evidence, not one of those five new smoke cases.

The automated task map is now green on actual evidence. Original manual instructions above remain a reference; only native execution and cross-target compilation/formats are evidenced, not execution on every OS. No visual screenshot claimed. Retain 07-REVIEW.md warnings (especially installed path spaces); validation does not silently fix them. Interactive dev/start are supported by unchanged scripts/source and regression evidence, not a newly observed manual session.
