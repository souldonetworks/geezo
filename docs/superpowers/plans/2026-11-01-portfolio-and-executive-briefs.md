# Geezo Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track all Code projects, retain evidence-based executive briefs, and support deliberate, recoverable GSD adoption.

**Architecture:** Extend the existing Express/React app and local JSON registry. Add focused services for discovery, immutable brief revisions, bounded evidence collection, persisted agent jobs, and reviewed file-based migrations. Deliver three ordered, independently testable increments: inventory, assessment, migration.

**Tech Stack:** Node.js CommonJS, Express 4, React 18, Vite 5, node:test; existing local Claude/Codex CLI installations.

**Spec:** `docs/superpowers/specs/2026-11-01-portfolio-and-executive-briefs-design.md`

## Global Constraints

- Tracking never requires migration.
- Automatic discovery and brief-staleness detection; analysis and migration explicitly started by the user.
- Retain existing project IDs, settings, `.planning/ROADMAP.md` and `.gsd/gsd.db` readers.
- Scan interval defaults to 60 seconds; project root defaults to `~/Code`.
- No silent agent calls, external CRM integration, automatic executive approval, or automatic migration.
- Preserve the complete user prompt verbatim as a versioned resource.
- Human edits create revisions; analysis creates a separate draft and never overwrites edits or the accepted version.
- PuppetWorks remains accountable until ownership is explicitly accepted.
- Real projects remain read-only during development verification unless separately selected for migration.

## Review Focus

- An inaccessible root must not erase known projects or mark its entire inventory definitively missing (Task 1).
- Filenames containing quotes, shell syntax, or Unicode must remain literal paths (Tasks 1, 5, 7).
- Concurrent edits and analysis completion must preserve both results without losing accepted revisions (Task 3).
- An agent may hang, emit huge/invalid output, or embed instructions in evidence; fail visibly and preserve the prior brief (Tasks 4–5).
- A crash or user edit during migration must leave recoverable state and prevent destructive rollback (Tasks 7–8).

## File ownership and boundaries

Existing `registry.js`, `settings.js`, `paths.js`, and project routes retain registration/configuration responsibilities. New `discovery.js` owns reconciliation; `atomicStore.js` owns serialized local persistence; `evidence.js` owns bounded snapshots; `briefStore.js` owns revisions; `briefSchema.js` owns validation; `opportunities.js` owns attribution aggregation; `agentAdapter.js` owns child processes; `analysisJobs.js` owns job lifecycle; `migration.js` owns file changes and recovery. New routers `briefsRoute.js`, `analysisRoute.js`, and `migrationRoute.js` expose those services. UI panels mirror these responsibilities rather than expanding ProjectDetail into one large component.

### Task 1: Universal registration and discovery

**Files:** Modify `server/lib/{registry,settings,paths,scanDirectory}.js`; create `server/lib/{atomicStore,discovery}.js`; modify `server/routes/{projects,settingsRoute}.js`, `server/app.js`; test `tests/server/{registry,settings,scanDirectory,app,discovery,atomicStore}.test.js`.

**Interfaces:** `reconcileProjects({roots, exclusions}) -> {projects, roots, errors}`; `startDiscovery({intervalMs}) -> stop()`; `getProjectStatus(project) -> {availability, gsdFormat}` where availability is available/unavailable/inspection-error and format is planning/database/none. Settings add `portfolio: {roots, exclusions, scanIntervalMs:60000}`. `writeJsonAtomic(file, value)` and `updateJson(file, updater)` serialize writes per file.

- [ ] Write failing tests: empty ordinary directories register; regular files reject; aliases deduplicate; removed discovered entries become excluded; failed roots preserve prior status; deleted folders remain with stable IDs; shell characters remain literal; legacy settings merge.
- [ ] Run `node --test tests/server/registry.test.js tests/server/discovery.test.js tests/server/settings.test.js`; confirm failures identify missing behavior.
- [ ] Implement canonical registration without the GSD gate, atomic writes, validation of absolute directory roots and positive intervals, direct-child scanning, exclusions, startup/periodic/manual reconciliation, and cleanup on app shutdown. Ignore hidden folders, symlinks, and app bundles in automatic scans. Persist last root inspection outcome separately from project absence.
- [ ] Extend `POST /api/projects/discover` for manual refresh and list responses with independent availability/GSD state. Keep unavailable projects safe from roadmap/Git failures; non-GSD progress is null.
- [ ] Run `npm test`; update the old NOT_GSD_PROJECT rejection assertion to acceptance and confirm all tests pass.
- [ ] Commit only this task's files: `git commit -m "feat: track ordinary projects and discover Code folders"`.

### Task 2: Portfolio UI and settings

**Files:** Modify `web/src/{api.js,pages/Dashboard.jsx,pages/SettingsPage.jsx,components/ProjectCard.jsx,components/AddProjectDialog.jsx,components/ScanFolderPanel.jsx}`; create `web/src/components/PortfolioFilters.jsx`; modify existing styles and `README.md`.

**Interfaces:** `discoverProjects()` wraps Task 1 endpoint. Cards consume `availability`, `gsdFormat`, and nullable `progress` while retaining existing Git/activity values.

- [ ] Implement root/exclusion/interval settings, refresh, search, and availability/GSD filters with visible loading/errors and labelled controls. Include non-GSD Add actions and remove conversion as a registration prerequisite.
- [ ] Render unavailable and not-adopted states explicitly; never show zero-percent delivery for ordinary folders. Reload inventory every 60 seconds, with timer cleanup.
- [ ] Run `npm run build:web`; expect exit 0. Smoke-check search, ordinary registration, exclusion persistence, missing-folder cards, and existing GSD cards against temporary roots.
- [ ] Document discovery and exclusions; commit with `git commit -m "feat: expose universal portfolio inventory"`.

### Task 3: Brief schema, exact prompt, revision storage, and revenue records

**Files:** Create `server/resources/executive-review-v1.md`, `server/lib/{briefSchema,briefStore,opportunities}.js`, `server/routes/briefsRoute.js`, `tests/server/{briefStore,briefSchema,opportunities}.test.js`; modify `server/app.js` and binary resource packaging in `scripts/build-binary.js` as needed.

**Interfaces:** `validateBrief(value) -> brief` throws `INVALID_BRIEF`; `createRevision(projectId,{brief,source,parentRevision,evidenceId}) -> revision`; `acceptRevision(projectId,{revisionId,expectedAcceptedRevision})`; `getBriefRecord(projectId) -> {acceptedRevision, latestDraft, revisions}`. Revision fields include schema/prompt versions, UUID, timestamp, source human/analysis, parent and evidence IDs. Brief sections have fixed keys recommendation/customerPromise/whyNow/valueModel/delivery/executiveAsk/unansweredQuestions; each claim is `{text,status,evidenceRefs}` with status confirmed/hypothesis/proposed/unknown.

- [ ] Write failing tests for all seven required sections, enum/status validation, confirmed claims requiring evidence, missing accepted commitments remaining unknown, immutable revision creation, conflicting acceptance returning 409, and analysis completing after human edits without replacing either revision.
- [ ] Write attribution tests: one opportunity contributed by two projects counts once per metric; sourced/influenced, new/expansion ARR, retained ARR, services, and savings remain separate; mixed currencies never sum; contradictory records surface conflicts instead of silently choosing an amount.
- [ ] Run `node --test tests/server/briefStore.test.js tests/server/briefSchema.test.js tests/server/opportunities.test.js`; expect failures before implementation.
- [ ] Copy the user's entire prompt verbatim into the versioned resource. Implement validated, atomic central revision storage, Markdown export, and opportunity records with the spec's required fields. Store purpose/investment class, proposed/accepted ownership, and distinct implementation/release/customer-validation maturity in brief data.
- [ ] Add GET/POST `/api/projects/:id/brief`, POST `/brief/accept`, GET `/brief/history`, GET `/brief/export`, and GET `/api/opportunities`. Require revision expectations on edits, preserve independent analysis drafts, and validate project IDs and citation references.
- [ ] Run targeted tests and `npm test`; ensure packaged builds include the prompt resource. Commit with `git commit -m "feat: retain evidence-labelled executive brief revisions"`.

### Task 4: Bounded evidence snapshots and freshness

**Files:** Create `server/lib/evidence.js`, `tests/server/evidence.test.js`; modify `server/lib/discovery.js` and project summaries.

**Interfaces:** `collectEvidence(projectPath,{maxFiles:200,maxFileBytes:65536,maxTotalBytes:1048576,maxDepth:4}) -> {id,files,fingerprint,complete,omissions,observedAt}`; each file has relative path, SHA-256 hash, bounded text and line references. `compareEvidence(snapshot,current) -> fresh|stale|possibly-stale`.

- [ ] Write failing fixtures for README/planning/docs/manifests/selected source inclusion; hidden credentials, `.env*`, key material, binaries, dependencies and generated-output exclusions; external and directory symlinks; files disappearing mid-read; bounded depth/bytes/count; same-size edits; unknown freshness when traversal is incomplete.
- [ ] Run `node --test tests/server/evidence.test.js`; confirm failure, then implement deterministic selection, content hashes, per-file failures, immutable evidence manifests, and cached periodic freshness checks.
- [ ] Confirm discovery only compares evidence and never starts analysis. Run targeted tests and `npm test`; commit with `git commit -m "feat: collect bounded evidence and detect stale briefs"`.

### Task 5: Explicit analysis jobs and agent adapter

**Files:** Create `server/lib/{agentAdapter,analysisJobs}.js`, `server/routes/analysisRoute.js`, `tests/server/{agentAdapter,analysisJobs}.test.js`; modify settings, app lifecycle, and packaging.

**Interfaces:** `runAgent({adapter,executable,args,cwd,prompt,timeoutMs,maxOutputBytes}, {signal}) -> Promise<{output,diagnostics}>`; `enqueueAnalysis(projectIds) -> jobs`; `getAnalysisJob(id) -> job`; states queued/running/completed/failed/interrupted. Settings add explicit analysis adapter/executable/argument-array configuration, concurrency default 1, timeout 300000 ms and output limit 2097152 bytes. Persist each job and evidence ID before invocation.

- [ ] Inspect installed CLI `--help` for supported noninteractive/structured-output flags; document verified defaults. Do not assume bare CLI startup performs analysis.
- [ ] Write failing tests using fake child processes for missing executable, literal shell characters, nonzero exit, timeout, oversize output, malformed JSON/schema/citations, injected repository instructions, bounded queueing, restart recovery, and failed analysis preserving prior accepted brief.
- [ ] Run `node --test tests/server/agentAdapter.test.js tests/server/analysisJobs.test.js`; expect failures, then implement argument-array invocation, bounded diagnostics, timeout/cancellation, persisted job lifecycle and schema/evidence validation. Constrain agent operation to analysis without tools or filesystem writes using supported adapter controls; reject unsupported adapter configurations rather than claiming read-only execution.
- [ ] Supply exact prompt, assessment schema, project purpose and clearly delimited untrusted evidence. Request proportional assessment, not invented facts. Validate output before creating an analysis draft through Task 3.
- [ ] Add POST `/api/projects/:id/analysis`, POST `/api/analysis` with explicit project IDs, GET `/api/analysis/:jobId`; report preflight provider/data-handling configuration to UI. Recover running jobs as interrupted on restart.
- [ ] Run targeted tests and `npm test`; commit with `git commit -m "feat: run explicit evidence-based analysis jobs"`.

### Task 6: Brief review and analysis UI

**Files:** Create `web/src/components/{ExecutiveBriefPanel,BriefHistoryPanel,AnalysisPanel}.jsx`; modify `web/src/pages/{ProjectDetail,Dashboard,SettingsPage}.jsx`, `web/src/api.js`, styles, and `README.md`.

**Interfaces:** Consume Tasks 3–5 APIs. Project summaries expose `brief: {recommendation,freshness,acceptedRevision,latestDraft}` and `analysis: {jobId,status}` or null.

- [ ] Implement seven labelled sections with visible claim statuses/citations, purpose/investment class, draft/accepted distinction, editable claims, revision conflict errors, explicit acceptance, history and Markdown export.
- [ ] Add explicit per-project Analyze and selected/all-project analysis actions; show configured provider/data handling before invocation, progress, diagnostic errors, retry and interrupted states. Poll only active jobs and clean up effects on navigation.
- [ ] Display brief recommendation/freshness and analysis status in dashboard filters/cards; retain roadmap/Git/activity below brief detail.
- [ ] Run `npm run build:web` and a fixture-backed browser smoke check covering analysis failure, draft review/edit/accept, stale evidence and export. Update README and commit with `git commit -m "feat: review executive briefs and analysis evidence"`.

### Task 7: Reviewable GSD migration plans

**Files:** Create `server/lib/migration.js`, `server/routes/migrationRoute.js`, `tests/server/migration.test.js`; modify `server/lib/convert.js` and its tests, app and packaging.

**Interfaces:** `prepareMigration(projectId) -> {id,status:'prepared',sourceFingerprint,format:'planning',operations,unresolved,validation}`; operation is `{relativePath,beforeHash,afterContent}` restricted to `.planning/`. Store proposal centrally; no project writes during preparation. `getMigration(projectId,id)` returns recorded state.

- [ ] Write failing tests for ordinary/empty projects, existing planning files, existing database projects, literal hostile filenames, symlinked planning paths, active Git changes, and stale source fingerprints.
- [ ] Run `node --test tests/server/migration.test.js tests/server/convert.test.js`; confirm failures, then implement read-only plan generation from existing README/plans and accepted/draft brief, with source provenance and unresolved decisions. Existing `.gsd` projects report already adopted without database changes; existing `.planning` content is preserved and proposed additions require review.
- [ ] Generate minimal parseable PROJECT.md, ROADMAP.md and STATE.md only where missing; mark proposed phases as proposed and incomplete. Never infer approval or ownership from the brief recommendation. Record supported GSD prerequisites; CLI-dependent workflows remain awaiting prerequisites until independently verified.
- [ ] Replace unsafe conversion interpolation with literal-safe argument handling/strict terminal validation; validate target directory before launching. Legacy conversion reports launched only.
- [ ] Expose POST `/api/projects/:id/migrations` and GET `/api/projects/:id/migrations/:migrationId`; run targeted and full tests; commit with `git commit -m "feat: prepare reviewable GSD adoption plans"`.

### Task 8: Controlled migration application and recovery

**Files:** Modify `server/lib/migration.js`, `server/routes/migrationRoute.js`; extend `tests/server/migration.test.js`.

**Interfaces:** `applyMigration(projectId,id,{expectedFingerprint}) -> migration`; `rollbackMigration(projectId,id) -> migration`; states prepared/applying/completed/failed/interrupted/rolled-back. Central migration journal contains per-operation before/after hashes, backups, completion markers and verification results.

- [ ] Write failing tests for apply after source changes, existing-file conflicts, crash after the first operation, interrupted restart, partial rollback, post-apply user edits, concurrent applies, unexpected symlinks, and independent parse validation failure.
- [ ] Run migration tests; confirm failures. Implement project-scoped locking, fingerprint recheck, pre-write backups, durable operation journal, exclusive/atomic planning writes, and preservation checks on pre-existing source. Refuse overwrites and paths outside canonical `.planning`.
- [ ] Implement rollback only when current hashes match recorded migration output; preserve later edits and report conflicts. Recover interrupted journal states on startup without automatically rerunning application.
- [ ] Expose POST `/migrations/:migrationId/apply` and POST `/migrations/:migrationId/rollback`. Mark completed only after parsing expected files with existing readers and confirming preservation checks; keep launch state separate from completion.
- [ ] Run targeted tests and `npm test`; commit with `git commit -m "feat: apply and recover GSD migrations safely"`.

### Task 9: Migration UI and integrated verification

**Files:** Create `web/src/components/GsdMigrationPanel.jsx`; modify project detail, API module, styles, `README.md`; extend `tests/server/app.test.js` with end-to-end fixture workflows.

**Interfaces:** Consume Tasks 7–8 API using proposal IDs and expected fingerprints, with explicit Prepare/Apply/Rollback actions.

- [ ] Add readable operation previews, unresolved decisions, prerequisites, backup/recovery status, conflict diagnostics, and independently verified completion. Keep migration available regardless of executive recommendation, with existing roadmap/activity panels intact.
- [ ] Write integration tests for discover ordinary folder → analyze using fake adapter → draft/edit/accept/export → prepare/apply/verify/rollback migration. Include existing `.planning` and `.gsd` projects and isolated application homes.
- [ ] Run `npm test` and `npm run build:web`; expect exit 0. Verify binary packaging includes prompt and schemas using existing packaging tests. No live agent or real-project mutation is required for automated checks.
- [ ] Smoke-check the UI on temporary roots, then inspect actual Code inventory read-only. Document provider setup, evidence limits, history, staleness, missing folders, GSD prerequisites, rollback and current limitations.
- [ ] Commit with `git commit -m "feat: complete portfolio assessment and GSD adoption workflow"`.

## Self-review

All spec sections map to tasks: discovery 1–2, exact prompt and brief record/value model 3, evidence/freshness 4, jobs 5, review UI 6, migration proposal 7, controlled writes/recovery 8, integrated delivery 9. All five review-focus conditions have named test coverage. New function names and API consumers match the interfaces above. Decisions left to implementation are local CLI flag selection after help inspection and detailed visual styling within the existing interface.

## Implementation record — 2026-11-01

All nine implementation tasks delivered on `feat/portfolio-executive-briefs`. The final regression suite has 77 passing tests with no skips/failures. The frontend production build and host Bun compilation pass; the compiled server returned HTTP 200 for health and embedded frontend, and correctly discovered a disposable ordinary project. A read-only actual Code inventory returned 152 projects (39 GSD, 113 ordinary), with one incompatible GSD project isolated rather than breaking the portfolio.

Rulings/deviations:

- Use the verified tool-free Claude adapter initially. Codex analysis fails visibly as unsupported rather than assuming that read-only shell sandboxing disables all tools. Codex terminal launch remains available.
- Keep a single coherent implementation commit after integrated validation because inventory, briefs, jobs and UI now share their final interfaces; avoid committing intermediate broken combinations.
- The environment exposes no browser surfaces. Browser visual smoke verification could not run; API end-to-end flows, frontend build and compiled-server HTTP smoke checks were completed instead. Live provider analysis was not invoked against real repositories during tests.
- Host binary smoke testing exposed the pre-existing unconditional node:sqlite import under Bun. Added a runtime-specific read-only SQLite opener, verified by a failing-then-passing cross-runtime regression and compiled binary startup.
- Independent review found four issues (project error isolation, commercial evidence validation, selected-revision ancestry, empty sections). All were fixed with regression tests; the reviewer rechecked the fixes with no remaining consequential findings within that scope.

The detailed steps above remain the original plan; this record states the delivered status and verification exceptions rather than marking unperformed browser checks as complete.
