# Executive Workspace Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; native execution was selected in this conversation.

**Goal:** Ship the approved Souldo-inspired Geezo workspace, import existing Geezer research, and run the same assessment across the portfolio.
**Architecture:** Extend immutable brief/evidence storage with imported provenance and optional validated technical assessments. Keep the existing Express/React app and tool-free analysis jobs.
**Tech Stack:** Node, Express, React/Vite, local fonts, node:test.
**Spec:** `docs/superpowers/specs/2026-11-01-executive-workspace-design.md`.

## Global constraints

Keep the Geezo character prominent. Existing sources and project code remain unchanged. Imported and generated briefs are drafts. Claims require citations; verification is inspection-only or historical. Native execution and the approved direction persist across turns.

## Review focus

Importing reported research must not claim fresh tests. Changed source imports must not clobber human edits. Empty projects must get explicit unknowns. Active jobs must deduplicate. Batch provider failures must remain visible instead of creating fictional assessments.

### Task 1: Source-linked import

Files: new `server/lib/assessmentImport.js`, `tests/server/assessmentImport.test.js`; extend `briefStore.js`, `briefsRoute.js` and project summaries.
Interfaces: `importAssessment(projectId)` returns a draft revision or existing identical import; `getBriefings()` returns project briefing summaries.
- [ ] Write failing import/idempotency/preservation tests and run them.
- [ ] Snapshot allowed local research documents, conservatively map sections, add imported provenance and summary endpoint.
- [ ] Verify tests pass.

### Task 2: Portfolio assessment methodology

Files: new versioned assessment resource; extend `analysisJobs.js`, `briefSchema.js`, `agentAdapter.js`, tests.
Interfaces: optional `brief.assessment={summary,capabilities,investmentTiers,limitations}`, validated with source references. Analysis uses executive-review-v1 plus assessment-v2 methodology; active jobs reuse existing IDs.
- [ ] Write failing tests for invalid citations/statuses/verification and active deduplication.
- [ ] Implement validated structured assessment, metadata and conservative empty-evidence draft, with no project execution.
- [ ] Verify focused tests and whole server suite.

### Task 3: Enterprise workspace

Files: `App.jsx`, dashboard/detail, new briefings page/shared table, tokens/global CSS, font assets/license, API client.
- [ ] Self-host Souldo fonts; retain character as primary brand image.
- [ ] Build responsive paper/navy/orange shell, compact tables, summary metrics, visible briefings navigation and job progress.
- [ ] Display source provenance and technical assessments in detail/export; preserve current actions.
- [ ] Build frontend and check API contracts.

### Task 4: Live import and batch run

- [ ] Run full suite and build, independent final review, fix consequential findings.
- [ ] Restart live Geezo, import Geezer assessment, queue all tracked projects once using the new methodology.
- [ ] Verify HTTP responses, imported evidence, queue progress/provider result, and keep the app running at localhost:4317.
- [ ] Commit implementation; do not merge or push without authorization.

### Task 5: Classification, tags and related discovery (added by user during execution)

Files: new `server/lib/projectMetadata.js`, `server/lib/relatedProjects.js`, related routes; tests; new RelatedProjectsPage and ProjectMetadataPanel; extend project tables/filters.
Interfaces: `updateMetadata(id,{category,tags,dismissedTags,expectedVersion})`; manual category is personal/work/unclassified. `getProjectMetadata(project)` returns user tags, suggested tags and version. `findRelated({query,projectId,category})` returns explained ranked matches.
- [ ] Write failing tests for category/tag validation, preservation across reanalysis, dismissals, version conflicts and relevant ranking/exclusion.
- [ ] Implement independent metadata, normalized suggested topics from existing/new assessments, category filters and visible tag provenance.
- [ ] Add Related Projects search and project detail related suggestions; verify tests/build.
- [ ] Preserve the ongoing batch: after final backend restart, requeue only incomplete projects and verify existing completed drafts remain intact.

## Implementation and validation record

Implemented the approved redesign, original mascot/tagline treatment, Executive Briefings register, historical research import, ChatGPT/Codex assessment provider, and subsequently requested classification/tag/related-project discovery.

- Geezer import preserves 28 source-reported capabilities, 13 investment tiers and eight research documents as an unaccepted immutable draft; originals remain unchanged.
- ChatGPT is selected through the authenticated local Codex CLI. The live batch runs three assessments concurrently. Completed drafts were preserved during the tagging restart; only unfinished projects were requeued. Progress remains visible in Executive Briefings rather than claiming the entire asynchronous batch is finished.
- Personal/work is manually controlled; suggested topics are separate, dismissible and searchable. Existing completed/imported briefs gain derived topics without another model call; new results can supply explicit suggested tags.
- Final suite: 92 tests passed, zero skipped/failed (full serial run while the live batch was active). A prior parallel run hit the pre-existing filesystem watcher timing assertion; the complete serial rerun passed.
- Production frontend and host compiled binary builds passed. Live `/`, `/briefings`, `/discover` and related-search API returned HTTP 200. Classification fields are present on all tracked projects; related matches explain shared topics. No enabled browser surface was available for screenshot-based verification.
- Independent review findings were fixed with failing-then-passing regressions: display-field validation, prompt-version inheritance, export verification/acceptance detail, structured provider-error pausing, and delayed-navigation metadata isolation. The navigation regression exercises the real React component with delayed network responses; its development-only renderer dependency is recorded under web/package.json.
- No GSD migration, project tests or infrastructure actions were run across the assessed repositories. Existing test records remain historical inspection evidence.

The checklist above is retained as the original work breakdown. This record describes delivered functionality and explicit verification limits; ongoing background assessments are not labelled complete here.
