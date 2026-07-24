# Phase 7: Single-Binary Packaging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 7-single-binary-packaging
**Areas discussed:** Serve-time port/host config, CLI help & no-args behavior, Windows binary naming, Bun-missing build failure

---

## Serve-time port/host config

| Option | Description | Selected |
|--------|-------------|----------|
| PORT env var only | Matches existing server/server.js behavior exactly | |
| Add --port flag too | CLI flag takes precedence over PORT env var, falls back to 4317 | ✓ |

**User's choice:** Add --port flag too
**Notes:** Precedence confirmed separately — flag wins over env var.

| Option | Description | Selected |
|--------|-------------|----------|
| Localhost-only, no flag | Matches single-user/localhost-only constraint | |
| Add --host flag | Lets user expose on LAN, opt-in | ✓ |

**User's choice:** Add --host flag
**Notes:** Default confirmed as localhost (127.0.0.1) unless explicitly overridden.

| Option | Description | Selected |
|--------|-------------|----------|
| --port flag wins over PORT env var | Explicit CLI input overrides implicit env config | ✓ |
| PORT env var wins over --port flag | Env var stays single source of truth | |

**User's choice:** --port flag wins over PORT env var

| Option | Description | Selected |
|--------|-------------|----------|
| localhost (127.0.0.1) | Preserves today's local-only default behavior | ✓ |
| 0.0.0.0 (all interfaces) by default | Matches typical Express default | |

**User's choice:** localhost (127.0.0.1)

---

## CLI help & no-args behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Default to `serve` (per SPEC) | Matches design doc's stated default | |
| Print help/usage instead | Requires explicit `serve` subcommand | ✓ |

**User's choice:** Print help/usage instead
**Notes:** This explicitly diverges from the design doc's stated "serve is the default" behavior — captured in CONTEXT.md as an override.

| Option | Description | Selected |
|--------|-------------|----------|
| Usage text listing all 3 subcommands | Standard CLI convention | ✓ |
| Point to README only | Minimal, just points to docs | |

**User's choice:** Usage text listing all 3 subcommands

| Option | Description | Selected |
|--------|-------------|----------|
| Print error + usage, exit 1 | Non-zero exit so scripts can detect failure | ✓ |
| Silently fall back to serve | More forgiving but hides typos | |

**User's choice:** Print error + usage, exit 1

| Option | Description | Selected |
|--------|-------------|----------|
| npm start/dev untouched | PKG-07 — dev/start/test keep using server/server.js directly | ✓ |
| Route npm start through cli.js serve too | Unifies entrypoints but touches working dev scripts | |

**User's choice:** npm start/dev untouched

---

## Windows binary naming

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — gsd-web-windows-x64.exe | Windows requires .exe extension | |
| No suffix | Keeps naming uniform but won't run correctly on Windows | |

**User's choice:** "geezo.exe" (free text)
**Notes:** Triggered a follow-up clarifying question on whether the base name change (gsd-web → geezo) applies to all 5 platforms.

| Option | Description | Selected |
|--------|-------------|----------|
| Rename all 5 to geezo-<platform> (.exe on Windows) | Consistent naming, matches project/repo name | ✓ |
| Just Windows gets .exe, base stays gsd-web | Only adds required extension, keeps SPEC's original base name | |

**User's choice:** Rename all 5 to geezo-<platform> (.exe on Windows)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — embed package.json version | Useful for support/debugging | ✓ |
| No version flag | Not in original SPEC scope | |

**User's choice:** Yes — embed package.json version

---

## Bun-missing build failure

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly pre-check + install hint | Clear message with install instructions | ✓ |
| Let the raw shell error surface | Simpler, less helpful | |

**User's choice:** Friendly pre-check + install hint

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast — stop on first target failure | Simpler, matches manual/local-only build step | ✓ |
| Continue all targets, summarize failures at end | More resilient but adds complexity | |

**User's choice:** Fail fast — stop on first target failure

---

## Claude's Discretion

- Exact wording/formatting of `--help` usage text and error messages.
- Flag-parsing implementation approach (hand-rolled vs. minimal helper) — no dependency preference stated.
- Where in `server/cli.js` port/host values get threaded through to `createApp().listen(...)`.

## Deferred Ideas

None — all four discussed areas were implementation-detail clarifications within the existing PKG-01 through PKG-07 scope.
