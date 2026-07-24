# Phase 7: Single-Binary Packaging - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Package the existing GSD Run Dashboard (Node/Express backend + React/Vite frontend + Claude Code hook) as a single, self-contained native executable per target platform (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `windows-x64`), via `bun build --compile`, so it can run without Node.js installed — including the Claude Code hook integration. Fully additive: existing `npm run dev`/`start`/`test` workflows must be untouched.

</domain>

<decisions>
## Implementation Decisions

### Serve-time port/host config
- **D-01:** Compiled binary's `serve` subcommand supports a `--port` CLI flag in addition to the existing `PORT` env var (`server/server.js` today: `process.env.PORT || 4317`).
- **D-02:** `--port` flag takes precedence over `PORT` env var when both are set; falls back to `4317` if neither is set.
- **D-03:** Compiled binary also supports a `--host` CLI flag (dashboard is localhost-only by default today with no host selection exposed).
- **D-04:** `--host` defaults to `localhost` (127.0.0.1) when not passed — preserves today's effectively-local-only behavior; LAN exposure via `--host 0.0.0.0` is an explicit opt-in, consistent with PROJECT.md's single-user/no-auth security posture.

### CLI help & no-args behavior
- **D-05:** `<binary>` with **no subcommand** prints help/usage text (NOT `serve`). **This overrides the design doc's stated default** (`docs/superpowers/specs/2026-07-24-single-binary-packaging-design.md` says "serve (default when no subcommand given)") — treat this discussion decision as authoritative over that doc for this specific point.
- **D-06:** `<binary> --help` / `-h` prints usage text listing all 3 subcommands (`serve`, `hook`, `install-hook`) with one-line descriptions and available flags per subcommand (`--port`/`--host` for `serve`).
- **D-07:** `<binary> <unknown-subcommand>` prints an error ("Unknown command: X") followed by the same usage text, and exits with code 1.
- **D-08:** `npm run dev` / `npm start` / `npm test` are entirely untouched — they keep calling `server/server.js` directly, never routed through `server/cli.js`. The no-args-prints-help decision only affects the compiled binary's bare-invocation UX (satisfies PKG-07).

### Windows binary naming / build outputs
- **D-09:** Output binaries are renamed from the design doc's `gsd-web-<platform>` to **`geezo-<platform>`** across all 5 targets (matches the repo/project name). **This overrides the design doc's stated naming.**
- **D-10:** Windows target gets a `.exe` suffix: `geezo-windows-x64.exe`. The other 4 targets have no extension: `geezo-darwin-arm64`, `geezo-darwin-x64`, `geezo-linux-x64`, `geezo-linux-arm64`.
- **D-11:** Binary supports a `--version` flag that prints the version from `package.json` at build time (embedded at compile time).

### Bun-missing / build-failure handling
- **D-12:** `npm run build:binary` does a friendly pre-check (`command -v bun` or equivalent) before invoking `bun`. If missing, print a clear error with install instructions (e.g. `curl -fsSL https://bun.sh/install | bash` or `brew install bun`) instead of letting a raw "command not found" surface.
- **D-13:** If `bun build --compile` fails for one specific platform target during the multi-platform build loop, **fail fast** — stop immediately with a non-zero exit rather than continuing to build remaining targets and summarizing failures at the end. Matches the manual/local-only nature of this build step (no CI automation planned per PROJECT.md).

### Claude's Discretion
- Exact wording/formatting of the `--help` usage text and error messages.
- Exact flag-parsing implementation approach (hand-rolled `process.argv` parsing vs. a tiny arg-parsing helper) — no library dependency preference was stated; keep it minimal per the "no new dependencies for packaging" spirit of the design doc.
- Where in `server/cli.js` the port/host flag values get threaded through to `createApp().listen(...)`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Packaging design (primary source for this phase)
- `docs/superpowers/specs/2026-07-24-single-binary-packaging-design.md` — Full architecture: `server/cli.js` unified entrypoint, asset embedding via `scripts/generate-assets-manifest.js` + `server/generatedAssets.js`, hook logic reuse (`runHookFromStdin()`), install-hook reuse (`installHooks(hookCommand, settingsPath)`), multi-platform build steps, error handling, and testing approach. **Note:** this discussion's decisions D-05 (no-args prints help, not serve) and D-09/D-10 (binary renamed to `geezo-<platform>`, `.exe` on Windows) explicitly override specific statements in this doc — everything else in the doc remains authoritative.

### Existing dashboard architecture (what's being packaged)
- `docs/superpowers/specs/2026-07-24-gsd-run-dashboard-design.md` — Core dashboard design (already shipped: registry, roadmap parsing, live activity, git milestones, convert-to-GSD, UI).
- `docs/superpowers/plans/2026-07-24-gsd-run-dashboard-plan.md` — Original implementation plan for the shipped dashboard.

### Project-level context
- `.planning/PROJECT.md` — Constraints (single-user/localhost-only/no-auth, read-only, packaging-is-additive), key decisions (Docker rejected in favor of Bun single-binary), and confirms zero packaging code exists yet (no `server/cli.js`, no `scripts/generate-assets-manifest.js`, no `server/generatedAssets.js`).
- `.planning/REQUIREMENTS.md` — PKG-01 through PKG-07 requirement definitions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/server.js` — `const PORT = process.env.PORT || 4317;` pattern to extend with `--port` flag precedence in `server/cli.js`.
- `server/app.js` — `createApp()` factory (Express app + routes + SSE hub) is reused as-is by `serve`; only the static-serving branch (`express.static(web/dist)` + fallback to `index.html`) needs replacing with the embedded-asset-manifest lookup described in the design doc.
- `hooks/gsd-web-hook.js` — `handle(input)` already implemented and tested; needs the `runHookFromStdin()` extraction described in the design doc.
- `scripts/install-hook.js` — `mergeHookConfig(existing, hookCommand)` already implemented and tested; needs the `installHooks(hookCommand, settingsPath)` extraction with the signature change described in the design doc (second param becomes a full command string, not a bare script path).

### Established Patterns
- CommonJS (`require`/`module.exports`) throughout `server/`, `hooks/`, `scripts/` — no ESM. `server/cli.js` should follow the same module style unless Bun's `--compile` requires otherwise (check during research/planning).
- Existing tests use Node's built-in `node:test` / `node:assert/strict` (see `tests/server`, `tests/hooks`, `tests/scripts`) — no external test framework.

### Integration Points
- `package.json` `scripts` block: `dev:server`, `dev:web`, `dev`, `build:web`, `start`, `test`, `install-hook` all stay as-is (PKG-07); a new `build:binary` script is added alongside them, not replacing any.
- `package.json` `version` field is the source for the new `--version` flag (D-11).

</code_context>

<specifics>
## Specific Ideas

- Binary name changes from the design doc's `gsd-web-<platform>` to `geezo-<platform>` (D-09) — the user wants the shipped binary to match the project's actual name.
- `--port`/`--host` flags were an explicit ask beyond the original SPEC scope (which only specified env-var-driven port config implicitly via the existing `server.js` pattern) — the user wants the compiled binary to be more self-sufficient/discoverable via `--help` than relying on an env var alone.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (all four areas were implementation-detail clarifications of the existing PKG-01 through PKG-07 requirements, not new capabilities).

</deferred>

---

*Phase: 07-single-binary-packaging*
*Context gathered: 2026-07-24*
