# Roadmap: GSD Run Dashboard

## Overview

The GSD Run Dashboard is a local, read-only web dashboard that lets a solo developer check any registered GSD project's roadmap progress, live subagent activity, and last git milestone from the browser instead of running GSD status commands in a terminal. This roadmap documents the project retroactively: Phases 1-6 (project registry, roadmap/state/gsd.db parsing, live agent activity, git milestone detection, convert-to-GSD flow, and the React dashboard UI) are already implemented, tested (37 passing tests), and committed on `main`. Phase 7 (single-binary packaging via Bun) is designed but not yet implemented — it is the only remaining work.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Project Registry & Discovery** - User can add, remove, and discover project folders in a persistent local registry
- [x] **Phase 2: Roadmap & State Parsing** - Dashboard reads ROADMAP.md/STATE.md/gsd.db and computes progress for any registered project
- [x] **Phase 3: Live Agent Activity** - Dashboard shows currently running Claude Code subagents in real time via hook + SSE
- [x] **Phase 4: Git Milestone Detection** - Dashboard shows each project's newest pushed git tag with graceful fallback states
- [x] **Phase 5: Convert-to-GSD Flow** - User can deliberately adopt GSD through a reviewed, guarded migration that preserves existing code and planning
- [x] **Phase 6: Dashboard UI** - User can view/manage all of the above through a React dashboard, project detail page, and settings page
- [x] **Phase 7: Single-Binary Packaging** - User can run the entire dashboard (including the hook) as one native executable with no Node.js install required (completed 2026-11-01)

## Phase Details

### Phase 1: Project Registry & Discovery

**Goal**: User can add, remove, and discover project folders in a persistent local registry
**Depends on**: Nothing (first phase)
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05
**Success Criteria** (what must be TRUE):

  1. User can add a project folder via the local folder picker, review its absolute path, and explicitly add it whether or not GSD metadata exists
  2. User can remove a project from the dashboard without any of its files or `.planning/` contents being touched
  3. User can run scan-folder discovery to find GSD projects on disk without manually typing paths
  4. Registry contents (`~/.claude/gsd-web/projects.json`) survive a server restart

**Plans**: Complete (already implemented — `server/lib/paths.js`, `server/lib/registry.js`, `server/lib/scanDirectory.js`, `server/routes/projects.js`; tests: `tests/server/registry.test.js`, `tests/server/paths.test.js`, `tests/server/scanDirectory.test.js`)

### Phase 2: Roadmap & State Parsing

**Goal**: Dashboard reads ROADMAP.md/STATE.md/gsd.db and computes progress for any registered project
**Depends on**: Phase 1
**Requirements**: RM-01, RM-02, RM-03, RM-04, RM-05, RM-06
**Success Criteria** (what must be TRUE):

  1. User can view a structured phase/plan breakdown for a project using classic `.planning/ROADMAP.md` files
  2. User can view the same breakdown for a project using the newer `.gsd/gsd.db` SQLite format
  3. Progress bar reflects `STATE.md`'s reported percent when available, or falls back to a checkbox-count computation when it isn't
  4. A project with a missing or malformed roadmap/state file still renders (degraded, not broken)
  5. User can trigger a manual refresh of a project's roadmap/progress view

**Plans**: Complete (already implemented — `server/lib/roadmapParser.js`, `server/lib/stateParser.js`, `server/lib/gsdDbReader.js`, `server/lib/progress.js`; tests: `tests/server/roadmapParser.test.js`, `tests/server/stateParser.test.js`, `tests/server/gsdDbReader.test.js`, `tests/server/progress.test.js`)

### Phase 3: Live Agent Activity

**Goal**: Dashboard shows currently running Claude Code subagents in real time via hook + SSE
**Depends on**: Phase 1
**Requirements**: ACT-01, ACT-02, ACT-03, ACT-04, ACT-05
**Success Criteria** (what must be TRUE):

  1. When a subagent (Task tool) starts in Claude Code, the dashboard shows it running with its type, task description, and elapsed time within seconds
  2. When a subagent finishes, it disappears from the "running now" list without a page reload (pushed via SSE)
  3. A leftover status file from a crashed/orphaned invocation older than 2 hours is hidden, not shown as stuck-running
  4. The Claude Code hook never throws an uncaught error or blocks the user's session, even on malformed input
  5. The roadmap/progress view auto-refreshes when the live-activity stream signals a subagent just completed

**Plans**: Complete (already implemented — `hooks/gsd-web-hook.js`, `server/lib/activityStore.js`, `server/lib/sse.js`; tests: `tests/hooks/gsd-web-hook.test.js`, `tests/server/activityStore.test.js`, `tests/server/sse.test.js`)

### Phase 4: Git Milestone Detection

**Goal**: Dashboard shows each project's newest pushed git tag with graceful fallback states
**Depends on**: Phase 1
**Requirements**: GIT-01, GIT-02, GIT-03
**Success Criteria** (what must be TRUE):

  1. User can see the newest git tag (with date, message, and commit SHA) that's an ancestor of the current branch's remote-tracking ref
  2. A project that isn't a git repo, has no remote, or has no tags shows a clear informational state instead of an error
  3. No `git fetch` or other network operation ever runs as part of viewing a project

**Plans**: Complete (already implemented — `server/lib/gitMilestone.js`; tests: `tests/server/gitMilestone.test.js`)

### Phase 5: Convert-to-GSD Flow

**Goal**: User can deliberately adopt GSD through a reviewed, guarded migration that preserves existing code and planning
**Depends on**: Phase 1
**Requirements**: CONV-01, CONV-02, CONV-03
**Success Criteria** (what must be TRUE):

  1. User can configure their preferred CLI tool, terminal app, and command templates, and those preferences persist
  2. User can prepare a GSD adoption proposal, review its exact changes, and explicitly apply it to a registered non-GSD project
  3. Adoption preserves source code and pre-existing planning; guarded rollback is available, and project status refreshes after completion

**Plans**: Complete (already implemented — `server/lib/settings.js`, `server/lib/convert.js`, `server/routes/convertRoute.js`, `server/routes/settingsRoute.js`; tests: `tests/server/settings.test.js`, `tests/server/convert.test.js`)

### Phase 6: Dashboard UI

**Goal**: User can view/manage all of the above through a React dashboard, project detail page, and settings page
**Depends on**: Phase 2, Phase 3, Phase 4, Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):

  1. User can view a searchable/filterable portfolio table of all registered projects plus an "Add Project" action
  2. User can open a project detail page showing the roadmap tree, a "Running Now" live panel, and a git panel
  3. User can view and edit Settings (CLI tool, terminal app, command templates) from the UI
  4. If one panel's data source fails (e.g. moved/deleted project folder), only that panel shows an error state — the rest of the page still renders

**Plans**: Complete (already implemented — `web/src/` React/Vite app, `server/app.js` wiring the full `/api/*` surface; tests: `tests/server/app.test.js`)
**UI hint**: yes

### Phase 7: Single-Binary Packaging

**Goal**: User can run the entire dashboard (including the hook) as one native executable with no Node.js install required
**Depends on**: Phase 6
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, PKG-06, PKG-07
**Success Criteria** (what must be TRUE):

  1. Running the compiled binary's `serve` subcommand starts the same dashboard (same API routes) as `node server/server.js`, without a Node.js install
  2. `npm run build:binary` produces executables for `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, and `windows-x64` in `dist-bin/`
  3. Running the compiled binary's `hook` subcommand against Claude Code hook stdin behaves identically to `node hooks/gsd-web-hook.js` (same never-throw, always-exit-0 guarantee)
  4. Running the compiled binary's `install-hook` subcommand registers hooks in `~/.claude/settings.json` pointing at the binary path, backing up the file first
  5. If `server/generatedAssets.mjs` is missing when `serve` runs, the binary prints a clear, explicit error instead of crashing on a missing import
  6. `npm run dev`, `npm start`, and `npm test` continue to work exactly as before — packaging is fully additive

**Plans**: 5 plans (4 original + 1 gap closure)
Plans:

- [x] 07-01-PLAN.md — Refactor hooks/gsd-web-hook.js and scripts/install-hook.js to export runHookFromStdin()/installHooks() for CLI reuse
- [x] 07-02-PLAN.md — Build scripts/generate-assets-manifest.js to generate server/generatedAssets.mjs (ESM asset embedding manifest)
- [x] 07-03-PLAN.md — Build server/cli.js unified entrypoint (serve/hook/install-hook dispatch, --port/--host/--help/--version)
- [x] 07-04-PLAN.md — Build scripts/build-binary.js multi-platform build:binary orchestration script
- [x] 07-05-PLAN.md — Gap closure: fix node:sqlite/Bun incompatibility (gsdDbReader.js), fix CR-01 manifest-lookup DoS (cli.js), add Bun-runtime smoke test

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Registry & Discovery | Complete | Complete | 2026-07-24 (retroactive) |
| 2. Roadmap & State Parsing | Complete | Complete | 2026-07-24 (retroactive) |
| 3. Live Agent Activity | Complete | Complete | 2026-07-24 (retroactive) |
| 4. Git Milestone Detection | Complete | Complete | 2026-07-24 (retroactive) |
| 5. Convert-to-GSD Flow | Complete | Complete | 2026-07-24 (retroactive) |
| 6. Dashboard UI | Complete | Complete | 2026-07-24 (retroactive) |
| 7. Single-Binary Packaging | 5/5 | Complete    | 2026-11-01 |

### Phase 07.1: Close original milestone integration gaps (INSERTED)

**Goal:** Folder selection, complete success-criteria data and completion-triggered project refresh close the original audit failures.
**Requirements**: REG-01, RM-01, ACT-05
**Depends on:** Phase 7
**Plans:** 1 plan

Plans:

- [ ] 07.1-01-PLAN.md — Close folder-selection, criteria and activity-refresh gaps
