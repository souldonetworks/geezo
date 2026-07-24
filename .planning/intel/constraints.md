# Constraints (from SPECs)

3 of 3 ingested docs classified as SPEC. All three describe one coherent system (the GSD Run
Dashboard) plus one add-on feature (single-binary packaging of that same dashboard). No ADRs or
PRDs were present in this batch, so these SPECs are the highest-precedence source available and
should be treated as authoritative for the areas they cover.

---

## SPEC 1: GSD Run Dashboard — Design

- source: /Users/matthew/Code/geezo/docs/superpowers/specs/2026-07-24-gsd-run-dashboard-design.md
- type: architecture / product design (feature-level)
- locked: false | precedence override: none (default SPEC tier)

**Purpose:** Local, read-only web dashboard for GSD projects showing (1) roadmap/progress, (2) live
subagent activity, (3) last git milestone tag.

**Non-goals (binding constraints):**
- Single-user, localhost-only, no auth, not multi-tenant/hosted.
- Read-only viewer over GSD's own state files — never a replacement for `.planning/` files.
- Does not correlate a running subagent to a specific phase/plan number — shows the subagent's own
  short task description only.
- No git network operations (no fetch/push) — local refs only.

**Architecture:**
- Backend: Node.js + Express. REST API + one SSE endpoint for live agent-activity push.
- Frontend: React (Vite build, static output served by Express). Two views: dashboard (all
  projects) + project detail.
- Hook script wired into `~/.claude/settings.json` as `PreToolUse`/`PostToolUse` (matcher `Task`)
  and `Stop` hooks. Writes/deletes per-invocation status files the backend watches.
- Fully local: no external services, everything is local files / local git / localhost HTTP/SSE.

**Project registry:**
- Registry file: `~/.claude/gsd-web/projects.json` — array of `{ id, path, name, addedAt }`.
- Add: client-side folder picker (`<input type="file" webkitdirectory>`) → POST to backend →
  validated path must exist; if `.planning/ROADMAP.md` present, registered; if not, UI offers
  "Convert to GSD project" instead of a hard rejection; folder only added to registry once
  `.planning/` exists.
- Remove: deletes registry entry only — never touches the project folder or `.planning/` contents.

**Convert-to-GSD flow:**
- Settings file `~/.claude/gsd-web/settings.json`: `{ cliTool: 'claude'|'codex'|'gemini',
  terminalApp: 'Terminal'|'iTerm', commandTemplates: { claude, codex, gemini } }`. Only `claude`
  defaults to a GSD-aware command (`claude "/gsd:new-project"`); `codex`/`gemini` default to
  launching the bare CLI. All fields user-editable.
- `POST /api/convert`: backend reads `settings.json`, spawns the configured terminal via macOS
  `osascript` (`tell application "<terminalApp>" to do script "cd <path> && <command>"`).
  Explicitly macOS-specific — no Linux/Windows terminal-launch path.
- Dashboard does not poll/wait for conversion; folder becomes addable once
  `.planning/ROADMAP.md` exists.

**Roadmap & progress parsing:**
- Parsed on-demand per request, no caching layer.
- `ROADMAP.md`: parse `## Phases` checklist + `## Phase Details` into
  `{ phaseNumber, title, status, goal, dependsOn, requirements, successCriteria,
  plans: [{ id, title, done }] }`.
- `STATE.md`: parse YAML frontmatter (`milestone`, `status`, `progress.percent`,
  `progress.completed_phases`/`total_phases`, `progress.completed_plans`/`total_plans`,
  `stopped_at`, `last_updated`) + "Current Position" section.
- Progress bar = `STATE.md.progress.percent` when present, else computed from ROADMAP checkbox
  counts (fallback).
- Missing files degrade gracefully (no hard errors).
- Refresh: manual refresh action in UI, plus automatic refresh whenever the live-activity SSE
  stream signals a subagent just completed.

**Live agent activity:**
- Hook writes `~/.claude/gsd-web/status/<project-hash>/<tool_use_id>.json` on `PreToolUse` (matcher
  `Task`) with `{ agentType, description, startedAt, sessionId }`; deletes it on `PostToolUse`.
  `Stop` hook is a cleanup safety net for leftover files matching the ending session.
- Design choice: one file per active invocation (no shared append-only log) — no read-modify-write
  locking needed.
- Staleness guard: backend ignores/hides any status file older than **2 hours**.
- Backend `fs.watch`es each project's status directory; on change, re-reads and pushes running-agent
  list over SSE. No polling.
- Displayed per running agent: subagent type, short task description, elapsed time since
  `startedAt`. Empty state: "idle — no subagents currently running."

**Git milestone:**
- Local refs only, no `git fetch`.
- `git for-each-ref --sort=-creatordate refs/tags` filtered to tags that are ancestors of the
  current branch's remote-tracking ref (`git merge-base --is-ancestor`).
- Newest matching tag shown as `{ tag, date, message, commitSha }`.
- Graceful states: "not a git repository," "no remote configured," "no tags pushed yet" — never a
  hard error.

**API surface:**
`GET/POST /api/projects`, `DELETE /api/projects/:id`, `GET /api/projects/:id/roadmap`,
`GET /api/projects/:id/git`, `GET /api/projects/:id/activity/stream` (SSE),
`GET/PUT /api/settings`, `POST /api/convert`.

**UI:** Dashboard (card grid + Add Project), Project detail (roadmap tree, "Running Now" live
panel, git panel — plain text, no guessed remote URLs/links), Settings (CLI tool / terminal app /
command templates form).

**Error handling:** every data source degrades independently per-panel (no whole-page failures);
moved/deleted project folder → "path not found," remove-only, not a crash.

**Testing:** unit tests for ROADMAP.md/STATE.md parsers (fixtures modeled on real GSD projects);
unit tests for git milestone logic (scratch repo fixture); manual smoke test of live SSE path.

---

## SPEC 2: GSD Run Dashboard Implementation Plan

- source: /Users/matthew/Code/geezo/docs/superpowers/plans/2026-07-24-gsd-run-dashboard-plan.md
- type: TDD implementation plan (classified SPEC — see classifier notes: each task defines
  concrete module interfaces/data contracts other components must honor, despite DOC-like
  step-by-step tutorial framing)
- locked: false | precedence override: none (default SPEC tier)
- confidence: medium (per classifier)

**Realizes SPEC 1** (same feature, same architecture) with concrete implementation detail:

**Tech stack:** Node.js (CommonJS), Express, `gray-matter` for YAML frontmatter, Node's built-in
`node:test`/`node:assert/strict` for backend tests, React + Vite frontend, `concurrently` for
local dev.

**Global constraints (binding, explicit in doc):**
- Single-user, localhost-only. No auth, no external network calls except local git.
- All persistent tool state (registry, settings, live-activity status files) lives under
  `~/.claude/gsd-web/`, **never inside a tracked project repo**.
- Tests must override the `~/.claude/gsd-web` location via `GSD_WEB_HOME_OVERRIDE` env var — must
  never touch the real user home directory.
- Git operations use `execFileSync('git', [...])` (array args), **never a shell string** — avoids
  injection.
- Hook script must **never throw uncaught** — must not block the user's Claude Code session; wrap
  all hook logic in try/catch and always exit 0.
- `scripts/install-hook.js` modifies `~/.claude/settings.json` (global, shared file) — **only ever
  run explicitly by the user** (`npm run install-hook`), never invoked automatically by
  build/test.

**Concrete module interfaces (data contracts other components must honor):**
- `server/lib/paths.js`: `gsdWebDir()`, `projectsFile()`, `settingsFile()`, `statusRootDir()`,
  `projectHash(absPath)` (stable, path-normalized, 16-hex-char), `statusDirFor(absPath)`.
- `server/lib/registry.js`: `loadProjects()`, `saveProjects(list)`, `isGsdProject(absPath)`,
  `addProject(absPath)` (throws `Error` with `.code` in
  `'PATH_NOT_FOUND'|'NOT_GSD_PROJECT'|'ALREADY_ADDED'`), `removeProject(id)`, `findProject(id)`.
- `server/lib/roadmapParser.js`: `parseRoadmap(markdownText)` →
  `{ phases: [{ number, title, status: 'done'|'pending', summary, goal, dependsOn,
  requirements: string[], plans: [{ id, title, done }] }] }`.
- `server/lib/stateParser.js`: `parseState(markdownText)` →
  `{ milestone, status, progress: {...} | null, stoppedAt, lastUpdated, currentPhase,
  currentStatus }`.
- `server/lib/progress.js`: `computeProgress(roadmap, state)` →
  `{ percent, currentPhase, status, source: 'state'|'roadmap-fallback' }`.
- `server/lib/gitMilestone.js`: `getMilestone(repoPath)` →
  `{ status: 'ok'|'not-a-repo'|'no-remote'|'no-tags', tag?, date?, message?, commitSha? }`.
- `server/lib/settings.js`: `loadSettings()` / `saveSettings(partial)` (deep-merges
  `commandTemplates`); defaults: `cliTool: 'claude'`, `terminalApp: 'Terminal'`,
  `commandTemplates: { claude: 'claude "/gsd:new-project"', codex: 'codex', gemini: 'gemini' }`.
- `server/lib/convert.js`: `buildConvertScript(settings, targetPath)` (pure, testable osascript
  script string), `launchConvert(settings, targetPath)` (spawns it, not unit tested).
- `server/lib/activityStore.js`: `listRunning(projectPath)` →
  `[{ agentType, description, startedAt, sessionId, elapsedMs }]`; filters entries older than
  **2 hours** and corrupt JSON files (matches SPEC 1's staleness guard).
- `server/lib/sse.js`: `createSseHub()` → `{ subscribe(projectId, res, projectPath),
  unsubscribe(projectId, res), broadcast(projectId) }`; subscribe sends immediate snapshot.
- `server.js`: `PORT = process.env.PORT || 4317`.
- Express routes wired in `server/app.js`/`server/routes/*.js` implementing the full `/api/*`
  surface from SPEC 1.

**File structure:** `server/` (app.js, server.js, lib/*, routes/*), `hooks/gsd-web-hook.js`,
`scripts/install-hook.js`, `web/` (React/Vite frontend), `tests/`.

Note: this document is truncated in this ingest (only tasks 1-12 of the plan were read in full);
later tasks (hook script, installer, frontend components) were not individually extracted here.
Downstream consumers needing full task-by-task detail should read the source file directly.

---

## SPEC 3: Single-Binary Packaging (Bun compile) — Design

- source: /Users/matthew/Code/geezo/docs/superpowers/specs/2026-07-24-single-binary-packaging-design.md
- type: architecture / design (add-on feature to SPEC 1 & 2)
- locked: false | precedence override: none (default SPEC tier)
- cross_refs (file-level, not doc-level): `server/app.js`, `server/server.js`,
  `hooks/gsd-web-hook.js`, `scripts/install-hook.js`, `scripts/generate-assets-manifest.js`,
  `server/generatedAssets.js`

**Purpose:** Package the existing dashboard (Node/Express + React/Vite + Claude Code hook) into a
single native executable per platform via `bun build --compile`, so it can run without Node.js
installed — including the hook integration.

**Background:** Docker was the original ask but rejected — the "convert to GSD project" feature
needs `osascript` GUI/window-server access a container can't provide. User pivoted to single-binary
distribution instead.

**Non-goals (binding constraints):**
- Not a rewrite — existing Node/Express/React code reused as-is; only a thin CLI wrapper + asset
  embedding step added.
- Does not change existing `npm run dev` / `npm start` / `npm test` workflows — unaffected.
- Does not make "convert to GSD project" cross-platform — remains macOS-only (`osascript`)
  regardless of packaging format (**consistent with SPEC 1's macOS-only convert constraint**).
- No CI/release automation for multi-platform build — `npm run build:binary` is manual/local only.

**Architecture:**
- New CLI entrypoint `server/cli.js`, compiled via `bun build --compile`, three subcommands:
  - `serve` (default): starts the Express app (same routes as `server/app.js`) but serves frontend
    from an embedded asset manifest instead of `express.static(web/dist)`.
  - `hook`: reads Claude Code hook JSON from stdin, runs the same logic as
    `hooks/gsd-web-hook.js`'s `handle()`, always exits 0.
  - `install-hook`: merges hook entries into `~/.claude/settings.json`, pointing them at
    `<binary path> hook` instead of `node hooks/gsd-web-hook.js`.
- Existing Node/npm code paths preserved unchanged for local dev; `server/cli.js` is additive.

**Asset embedding:**
- `scripts/generate-assets-manifest.js` runs after `vite build`; walks `web/dist/` and generates
  `server/generatedAssets.js` with one `import x from "<path>" with { type: "file" }` per file
  (Bun's file-embedding mechanism) plus a URL-path → file-reference map.
- `server/generatedAssets.js` is generated, gitignored (like `web/dist/`), never hand-maintained.
- `cli.js`'s static-serving logic: non-`/api/*` GET → look up path in manifest; if found, serve
  with correct content-type; if not found (client-side route), fall back to `/index.html`.

**Hook logic reuse:**
- `handle(input)` in `hooks/gsd-web-hook.js` unchanged.
- stdin-read/`JSON.parse`/`handle()`/`process.exit(0)` sequence extracted into exported
  `runHookFromStdin()`, called both by the classic script's CLI block and by `cli.js`'s `hook`
  subcommand — guarantees identical behavior between compiled binary and `node
  hooks/gsd-web-hook.js`.

**Install-hook reuse:**
- `mergeHookConfig(existing, hookCommand)` signature changes: second param now the full command
  string to register (e.g. `"node /abs/path/hooks/gsd-web-hook.js"` or `"/abs/path/to/binary
  hook"`), not just a script path — mechanical change, existing tests updated accordingly.
- Backup-then-read-then-merge-then-write sequence extracted into exported
  `installHooks(hookCommand, settingsPath)` (`settingsPath` defaults to
  `~/.claude/settings.json`, overridable) — unit-testable without touching the real settings file.
- Classic CLI calls `installHooks(`node ${absoluteHookScriptPath}`)`; `cli.js`'s `install-hook`
  calls `installHooks(`${process.execPath} hook`)`.

**Multi-platform build (`npm run build:binary`):**
1. `npm run build:web` → `web/dist/`.
2. `node scripts/generate-assets-manifest.js` → `server/generatedAssets.js`.
3. `bun build --compile --target=<platform> server/cli.js --outfile
   dist-bin/gsd-web-<platform>` per target: `darwin-arm64`, `darwin-x64`, `linux-x64`,
   `linux-arm64`, `windows-x64`.
4. Outputs land in `dist-bin/` (gitignored).
- Requires `bun` CLI installed on the build machine (build-time tool only, not an npm dependency;
  not required for `dev`/`start`/`test`).

**Error handling:**
- Missing `server/generatedAssets.js` at `serve`-time → explicit error message, not a confusing
  crash on missing import.
- `install-hook` subcommand backs up real `~/.claude/settings.json` before merging (same safety
  behavior as the existing script).
- `hook` subcommand inherits "never throw, always exit 0" guarantee unchanged.

**Testing:** unit tests for asset-manifest generation (fixture dir, no real Vite build needed);
unit tests for refactored `installHooks(hookCommand, settingsPath)`; unit test confirming
`runHookFromStdin()` extraction is behavior-preserving; manual smoke test on `darwin-arm64` only
(only platform executable on the build machine); other 4 targets build-verified only (file exists,
reasonable size, `file` reports expected format) — cannot be executed on this machine.

---

## Relationship between the three SPECs

SPEC 2 is an implementation-level realization of SPEC 1 (same feature, same API surface, same
staleness/constraint values — no contradictions found). SPEC 3 is a strictly additive packaging
layer on top of SPEC 1 + SPEC 2: it explicitly preserves all existing dev/test workflows unchanged
and only adds a new `server/cli.js` entrypoint, an asset-embedding codegen step, and thin
reuse-refactors (`runHookFromStdin()`, `installHooks()`) of already-specified modules. No
cross-doc contradictions were found in this batch — see `.planning/INGEST-CONFLICTS.md`.
