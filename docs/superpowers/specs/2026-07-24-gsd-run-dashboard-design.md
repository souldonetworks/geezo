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
- **Add project**: UI folder picker (`<input type="file" webkitdirectory>`) yields a path client-side; POST to backend, which validates the path exists and contains `.planning/ROADMAP.md`. Rejects with a clear error if not a GSD project.
- **Remove project**: deletes the registry entry only. Never touches the project folder or its `.planning/` contents.

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
- `POST /api/projects` — add by path (validates `.planning/`)
- `DELETE /api/projects/:id` — remove from registry
- `GET /api/projects/:id/roadmap` — full parsed roadmap/progress tree
- `GET /api/projects/:id/git` — milestone info
- `GET /api/projects/:id/activity/stream` — SSE stream of the running-agent list

## UI

- **Dashboard** (`/`): card grid, one per project — name, progress bar, current phase, milestone tag, "N agents running" badge when active. "Add Project" button opens the folder picker flow.
- **Project detail** (`/project/:id`): roadmap tree (phases → plans, checkboxes, collapsible per phase), a "Running Now" live panel (subagent type + description + elapsed, or idle state), and a git panel (milestone tag/date/message as plain text — no guessed remote URLs/links).

## Error handling

Every data source degrades independently and renders a clear per-panel state instead of failing the whole page: missing STATE.md → fallback progress calc; no git repo → git panel shows "not a git project"; no running agents → idle state; a project folder that's been moved/deleted since being registered → dashboard card shows "path not found," offering only remove, not a crash.

## Testing

- Unit tests for the ROADMAP.md/STATE.md parsers, using fixtures shaped like real projects (based on structures observed in `puppet-alert-center`, `puppet-inspector`, `puppet-specdd`).
- Unit tests for the git milestone logic against a scratch repo fixture (tags ancestor-of-branch filtering).
- Manual smoke test: register a real GSD project, confirm roadmap/progress/git render correctly; in a separate terminal run an actual GSD command in that project and confirm the "Running Now" panel updates live via the hook + SSE path.
