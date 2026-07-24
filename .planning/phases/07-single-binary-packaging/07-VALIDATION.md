---
phase: 07
slug: single-binary-packaging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
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
| 07-01-TBD | TBD | 0 | PKG-01 | — | `server/cli.js` dispatches serve/hook/install-hook, --help, unknown-command error | unit | `node --test tests/server/cli.test.js` | ❌ W0 | ⬜ pending |
| 07-01-TBD | TBD | 0 | PKG-06 | T-07-01 | Missing `generatedAssets.mjs` produces explicit error, not a crash | unit | `node --test tests/server/cli.test.js` | ❌ W0 | ⬜ pending |
| 07-02-TBD | TBD | 1 | PKG-03 | — | `generate-assets-manifest.js` produces correct import statements + URL-path map against a fixture directory | unit | `node --test tests/scripts/generate-assets-manifest.test.js` | ❌ W0 | ⬜ pending |
| 07-03-TBD | TBD | 1 | PKG-04 | — | `hook` subcommand behaves identically to `node hooks/gsd-web-hook.js` via `runHookFromStdin()` | unit | `node --test tests/hooks/gsd-web-hook.test.js` (extend existing) | ✅ existing, needs extension | ⬜ pending |
| 07-04-TBD | TBD | 1 | PKG-05 | T-07-03 | `install-hook` reuses `installHooks(hookCommand, settingsPath)` with binary path via `process.execPath` | unit | `node --test tests/scripts/install-hook.test.js` (update for new signature) | ✅ existing, needs signature update | ⬜ pending |
| 07-05-TBD | TBD | 1 | — (D-05/D-01/D-04) | T-07-02 | `--port`/`--host` flags validated (parseable int, 1–65535 range) before `.listen()` | unit | `node --test tests/server/cli.test.js` | ❌ W0 | ⬜ pending |
| 07-06-TBD | TBD | 2 | PKG-02 | — | `npm run build:binary` produces 5 correctly-named binaries (`geezo-<platform>`, `.exe` on Windows) | manual/smoke (only darwin-arm64 executable on this machine; others build-verified via `file <path>`) | `npm run build:binary && file dist-bin/*` | ❌ W0 — new script + smoke checklist | ⬜ pending |
| 07-07-TBD | TBD | 2 | PKG-07 | — | `npm run dev`/`start`/`test` unaffected — zero modification to `server/server.js`/`server/app.js` behavior | regression | `npm test` (full existing suite green) | ✅ existing suite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — the planner assigns final plan/wave/task numbering; this map's requirement coverage must be preserved 1:1.*

---

## Wave 0 Requirements

- [ ] `tests/server/cli.test.js` — covers PKG-01 (subcommand dispatch, `--help`, unknown command → exit 1), PKG-06 (missing-assets error path), and `--port`/`--host` validation
- [ ] `tests/scripts/generate-assets-manifest.test.js` — covers PKG-03's manifest-generation logic against a small fixture directory (not a real Vite build)
- [ ] Extend `tests/hooks/gsd-web-hook.test.js` — add `runHookFromStdin()` coverage (PKG-04)
- [ ] Update `tests/scripts/install-hook.test.js` — existing tests call `mergeHookConfig({}, '/path/to/gsd-web-hook.js')` and assert `command === 'node /path/to/gsd-web-hook.js'`; must be updated for the new signature where the second parameter is a full command string (e.g. `"node /abs/path/hooks/gsd-web-hook.js"` or `"/abs/path/to/binary hook"`)
- [ ] No test framework install needed — `node:test` is already in use project-wide

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

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
