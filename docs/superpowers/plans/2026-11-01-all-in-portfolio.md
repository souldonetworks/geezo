# All In Portfolio Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Continue the user's native execution method.

**Goal:** Give every project a useful editable description, versioned assessment lenses, and a daily portfolio synthesis with reversible linked-workspace actions.
**Architecture:** Extend existing metadata/brief storage and restricted provider. Add focused lens, description, portfolio-review and workspace services with Express routes and React pages.
**Tech Stack:** Node/Express, React/Vite, node:test, existing local ChatGPT/Codex.
**Spec:** `docs/superpowers/specs/2026-11-01-all-in-portfolio-design.md`.

## Global constraints

No original repository moves or edits. Linked workspaces were explicitly selected. Human descriptions and classifications survive AI updates. Exact lens versions remain attached to assessments. Daily scheduling is local while Geezo runs, with catch-up; no cloud/OS scheduler install. All In outputs are proposals, not accepted commitments or finished integrations.

## Review focus

Lens edits must not rewrite queued/historical prompts. A synthesis cannot invent member IDs or evidence. A failed daily run must preserve the last successful report. A workspace action must never overwrite existing Projects contents or follow a target symlink. Manual metadata must remain safe across navigation and reanalysis.

### Task 1: Descriptions and versioned lenses

Files: `server/lib/lenses.js`, `projectDescription.js`, metadata/brief schema/job services and routes; tests.
Interfaces: lens CRUD/versioned charter snapshots; `getProjectDescription(project,brief)`; metadata updates include description and lensId with expectedVersion.
- [x] Write failing precedence/CRUD/conflict/history tests.
- [x] Seed editable PuppetWorks, Souldo Games, Personal, Experimental charters; resolve explicit/auto lenses.
- [x] Generate explicit descriptions and value orientation, preserve source limits and capture exact charter/version in jobs/results.
- [x] Verify focused tests and add description/lens UI.

### Task 2: Daily All In synthesis

Files: `allIn.js`, `allInScheduler.js`, provider prompt/resource, routes/settings and tests.
Interfaces: bounded source snapshot, single active synthesis job, immutable successful reports, canonical latest, local daily scheduler.
- [x] Write failing coverage/source-validation/daily-run/failure-preservation tests.
- [x] Implement synthesis with named combine/extract/integrate/keep-separate proposals and validation paths.
- [x] Expose manual refresh, report history/progress and schedule configuration.
- [x] Verify tests and add All In page.

### Task 3: Reviewed linked workspaces

Files: `linkedWorkspaces.js`, workspace routes, tests, action UI.
Interfaces: preview recommendation, create idempotently from reviewed fingerprint, archive/restore.
- [x] Write failing link/source-preservation/collision/staleness/archive/restore tests.
- [x] Create only new managed workspace artifacts, references and proposed GSD plans; journal operations and register nested workspace.
- [x] Build review/apply/archive UI with explicit original-path preservation.
- [x] Verify temporary-directory lifecycle.

### Task 4: Integration and live validation

- [x] Run full tests/build/binary and independent final review; fix consequential findings with regressions.
- [x] Restart without losing completed project drafts; inspect/retry incomplete work only.
- [x] Run first All In synthesis, enable daily catch-up schedule and verify live endpoints.
- [x] Reassess non-Puppet projects with the appropriate seeded/assigned lenses; leave linked-workspace application to the user's concrete review.
- [x] Commit locally without merging/pushing unrelated branches.

Verification: 107 tests pass with local filesystem watchers enabled; frontend build and compiled Bun binary (`--version` 0.1.0) pass. Independent review identified intake snapshot, registration recovery and symlink/root identity issues; each was fixed with regression coverage. Live lenses and All In pages return 200; four seed charters are present. The first daily synthesis completed successfully. Fresh lens-aware assessment jobs were queued for 150 currently available projects. These jobs remain asynchronous; no completion claim is made. Workspace preview is exercised separately; no real grouped workspace was created. No merge or push performed.
