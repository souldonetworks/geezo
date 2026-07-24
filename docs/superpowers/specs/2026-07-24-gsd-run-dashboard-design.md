# GSD Run Dashboard — Design

## Purpose

A local web dashboard for tracking GSD ("Get Shit Done" — Claude Code's spec/plan/execute workflow) run projects. For each registered project folder, the user can see:

1. The full roadmap and current progress (phases, plans, % complete)
2. Which subagents are currently running and what they're working on (live)
3. The last milestone (git tag) pushed to the remote, if the project is a git repo

## Non-goals

- Not a hosted/multi-user service. Single user, localhost only, no auth.
- Not a replacement for GSD's own state files — purely a read-only viewer over them.
- Does not attempt to correlate a running subagent to a specific phase/plan number; it shows the subagent's own short task description instead (parsing that correlation reliably isn't feasible).
- Does not perform git network operations (no fetch/push) — reads local refs only.

## Architecture

- **Backend**: Node.js + Express. Reads `.planning/` files and runs local git commands. Exposes a small REST API plus one SSE endpoint for live agent-activity push.
- **Frontend**: React (Vite build, static output served by Express). Two views: dashboard (all projects) and project detail.
- **Hook script**: a small Node script wired into `~/.claude/settings.json` as `PreToolUse`/`PostToolUse` (matcher: `Task`) and `Stop` hooks. Writes/deletes per-invocation status files that the backend watches.

No component talks to any external service. Everything is local files, local git, localhost HTTP/SSE.

## Project registry

- Registry file: `~/.claude/gsd-web/projects.json` — array of `{ id, path, name, addedAt }`.
- **Add project**: UI folder picker (`<input type="file" webkitdirectory>`) yields a path client-side; POST to backend, which validates the path exists. If it contains `.planning/ROADMAP.md`, it's registered as a GSD project. If not, the UI offers "Convert to GSD project" instead of a hard rejection (see below); the folder is only added to the registry once `.planning/` exists.
- **Remove project**: deletes the registry entry only. Never touches the project folder or its `.planning/` contents.

## Converting a non-GSD folder

When a folder without `.planning/ROADMAP.md` is added, the UI shows a "Convert to GSD project" action instead of a bare error. Clicking it launches a terminal to bootstrap the project:

- **Settings panel** (`~/.claude/gsd-web/settings.json`): `{ cliTool: 'claude'|'codex'|'gemini', terminalApp: 'Terminal'|'iTerm', commandTemplates: { claude: 'claude "/gsd:new-project"', codex: 'codex', gemini: 'gemini' } }`. Editable from a settings view in the dashboard. `commandTemplates` defaults as shown — only `claude` has a GSD-aware default (`/gsd:new-project` is a Claude Code skill); `codex`/`gemini` default to just launching the bare CLI since their GSD-equivalent init commands aren't assumed. All three are user-editable text fields.
- **Convert action**: backend endpoint `POST /api/convert` takes the target folder path, reads `settings.json`, and spawns the configured terminal app (macOS `osascript` — `tell application "<terminalApp>" to do script "cd <path> && <commandTemplates[cliTool]>"`) with the working directory set to the target folder. This is macOS-specific (matches the current environment); no Linux/Windows terminal-launch path is implemented.
- The dashboard does not poll or wait for the conversion — the user works in the opened terminal session at their own pace. The folder becomes addable as a real GSD project (via the normal Add Project flow) once `.planning/ROADMAP.md` exists.

## Roadmap & progress parsing

Parsed on-demand per request (cheap markdown reads, no caching layer needed):

- **`ROADMAP.md`**: parse the `## Phases` checklist (`[x]`/`[ ]`) and the `## Phase Details` sections into a structured tree: `{ phaseNumber, title, status, goal, dependsOn, requirements, successCriteria, plans: [{ id, title, done }] }`.
- **`STATE.md`**: parse YAML frontmatter (`milestone`, `status`, `progress.percent`, `progress.completed_phases`/`total_phases`, `progress.completed_plans`/`total_plans`, `stopped_at`, `last_updated`) and the "Current Position" section (current phase/plan/status).
- **`phases/<dir>/*-SUMMARY.md`** presence used only as a secondary confirmation signal, not primary source.

Progress bar = `STATE.md.progress.percent` when present; else computed from ROADMAP checkbox counts (fallback for projects without STATE.md).

Missing files degrade gracefully — e.g., no STATE.md just means the fallback calc kicks in and "current phase" is inferred from the first incomplete ROADMAP phase; no `.planning/` at all was already rejected at add-time.

Refreshed via a manual refresh action in the UI (files only change between Claude Code sessions, not continuously) plus an automatic refresh whenever the live-activity SSE stream signals a subagent just completed (a reasonable moment for roadmap state to have changed).

## Live agent activity

**Hook wiring** in `~/.claude/settings.json`:
- `PreToolUse` (matcher `Task`): before a subagent launches, hook script computes a project hash (stable hash of the resolved `cwd`) and writes `~/.claude/gsd-web/status/<project-hash>/<tool_use_id>.json`:
  ```json
  { "agentType": "<tool_input.subagent_type>", "description": "<tool_input.description>", "startedAt": "<ISO timestamp>", "sessionId": "<session_id>" }
  ```
- `PostToolUse` (matcher `Task`): deletes that same file.
- `Stop`: cleanup safety net — deletes any leftover files under any project dir whose `sessionId` matches the ending session (covers a subagent whose `PostToolUse` never fired, e.g. session killed mid-run).

Design choice: **one file per active invocation**, not a shared append-only log, so concurrent sessions/subagents never need read-modify-write locking — file create/delete are the only operations.

Staleness guard: the backend ignores/hides any status file older than 2 hours even if not cleaned up, in case both `PostToolUse` and `Stop` were skipped (e.g. hard process kill).

**Live push**: backend `fs.watch`es each project's status directory. On any change, it re-reads the directory and pushes the current running-agent list over SSE to browser clients subscribed to that project. No polling.

**Displayed per running agent**: subagent type, its short task description, elapsed time since `startedAt`. Empty state: "idle — no subagents currently running."

## Git milestone

For a project with a `.git` directory:
- Read local refs only — no network calls triggered by the dashboard (no `git fetch`).
- `git for-each-ref --sort=-creatordate refs/tags` filtered to tags that are ancestors of the current branch's remote-tracking ref (`git merge-base --is-ancestor <tag> <remote-tracking-ref>`).
- Take the newest matching tag; show `{ tag, date, message, commitSha }`.
- Graceful states: "not a git repository" (no `.git`), "no remote configured" (no upstream), "no tags pushed yet" (remote exists, no matching tags) — never a hard error.

## API surface

- `GET /api/projects` — registered projects with summary (name, % complete, current phase, milestone tag, running-agent count)
- `POST /api/projects` — add by path (validates `.planning/`; returns a distinguishable response if the path exists but isn't a GSD project yet, so the UI can offer conversion instead of a bare error)
- `DELETE /api/projects/:id` — remove from registry
- `GET /api/projects/:id/roadmap` — full parsed roadmap/progress tree
- `GET /api/projects/:id/git` — milestone info
- `GET /api/projects/:id/activity/stream` — SSE stream of the running-agent list
- `GET /api/settings` / `PUT /api/settings` — read/update `settings.json` (CLI tool, terminal app, command templates)
- `POST /api/convert` — spawn the configured terminal against a given folder path to bootstrap it as a GSD project

## UI

- **Dashboard** (`/`): card grid, one per project — name, progress bar, current phase, milestone tag, "N agents running" badge when active. "Add Project" button opens the folder picker flow; if the picked folder isn't a GSD project yet, shows "Convert to GSD project" instead of an error.
- **Project detail** (`/project/:id`): roadmap tree (phases → plans, checkboxes, collapsible per phase), a "Running Now" live panel (subagent type + description + elapsed, or idle state), and a git panel (milestone tag/date/message as plain text — no guessed remote URLs/links).
- **Settings** (`/settings`): form for CLI tool choice, terminal app choice, and the per-tool command templates used by the convert action.

## Error handling

Every data source degrades independently and renders a clear per-panel state instead of failing the whole page: missing STATE.md → fallback progress calc; no git repo → git panel shows "not a git project"; no running agents → idle state; a project folder that's been moved/deleted since being registered → dashboard card shows "path not found," offering only remove, not a crash.

## Testing

- Unit tests for the ROADMAP.md/STATE.md parsers, using fixtures shaped like real projects (based on structures observed in `puppet-alert-center`, `puppet-inspector`, `puppet-specdd`).
- Unit tests for the git milestone logic against a scratch repo fixture (tags ancestor-of-branch filtering).
- Manual smoke test: register a real GSD project, confirm roadmap/progress/git render correctly; in a separate terminal run an actual GSD command in that project and confirm the "Running Now" panel updates live via the hook + SSE path.
