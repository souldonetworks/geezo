---
phase: 01-project-registry-discovery
verified: 2026-11-01T22:30:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
retrospective: true
---

# Phase 01: Project Registry & Discovery — RETROSPECTIVE Current-State Verification

**Goal:** User can add, remove, and discover project folders in a persistent local registry

This is a reconstruction on 2026-11-01, not historical execution evidence. No previous phase plan/summary/verification existed. ROADMAP criteria and reconciled REQUIREMENTS establish the contract. SUMMARY claims were not accepted as implementation evidence. No historical execution dates, commits or timings are invented.

## Observable Truths

| Truth | Status | Evidence |
|---|---|---|
| Add chosen existing folder after absolute-path review | VERIFIED | Selection test proves no POST until Add; late-cancel probe proves cancellation leaves path unchanged |
| Remove registry entry without touching project files | VERIFIED | removeProject performs no operation inside project.path; named lifecycle test passes |
| Discover GSD projects through scan-folder UI | VERIFIED | scanDirectory test passes; ScanFolderPanel consumes status and add handler |
| Registry survives reload/restart | VERIFIED | Atomic file storage and reload exercised; startup uses same loadProjects |

**Score:** 4/4. UNCERTAIN means WARNING requiring human decision; FAILED means BLOCKER.

## Requirements Coverage

| ID | Contract | Code/test evidence and limits |
|---|---|---|
| REG-01 | Folder selection followed by explicit Add | server/lib/folderBrowser.js → projects /folders → api.browseFolders → AddProjectDialog; milestoneUi selection test and independent late-cancel probe PASS |
| REG-02 | Removal preserves project files | registry.removeProject only rewrites registry/settings exclusions; DELETE route and PortfolioTable removal wired; registry lifecycle test PASS |
| REG-03 | Existing directory validation; GSD optional | registry.addProject realpath/stat checks; accepts ordinary and .gsd directories; registry and app tests PASS |
| REG-04 | Scan discovers GSD folders | scanDirectory → /scan → ScanFolderPanel; named immediate-subfolders scan test PASS |
| REG-05 | Persistent local registry | paths.projectsFile → writeJsonAtomic → loadProjects; registry lifecycle reload test PASS; standard path ~/.claude/gsd-web/projects.json |

All assigned IDs are claimed in the retrospective verification-only plan/summary. None orphaned. Approved all-folder, portfolio-table and deliberate-adoption reconciliations are current contract, not invented overrides.

## Required Artifacts / Key Links / Level 4 Data Flow

Inspected substantive runtime files: server/lib/paths.js, server/lib/registry.js, server/lib/scanDirectory.js, server/lib/folderBrowser.js, server/routes/projects.js, web/src/components/AddProjectDialog.jsx, web/src/components/ScanFolderPanel.jsx.

Folder browser GET returns absolute paths without mutation; explicit POST registers; scan results flow to UI; remove writes registry only.

These are substantive implementations called by runtime consumers, not file-existence checks. Frontend initial empty/null state is populated by real disk/database/status API data; no hardcoded empty data replacement was found. Utilities do not render dynamic data.

## Behavioral Spot-Checks

Independent verifier ran 13 named checks (registry persistence, scan, STATE, SQLite active milestone, both progress branches, hook lifecycle, stale filtering, real fs.watch, git ancestry, settings persistence, migration/rollback, malformed-database isolation): **13 PASS, zero failures/skips, under one second**. Separately picker/completion/criteria tests: **3 PASS**. Commands used node --test --test-name-pattern with explicit files; no repeated whole suite.

Independent temporary probe /tmp/geezo-verifier-edge.cjs: **PASS** folder cancellation ignores late response; **PASS** navigation closes old EventSource and rejects late roadmap/old stream updates; **CONFIRMED** annotated-tag object SHA differs from commit SHA. Disposable fixture writes only; no user project mutations.

Inspected current-run logs: /tmp/geezo-closure-full.log (121 total, 120 pass, 0 fail, 1 optional compiled test skipped); /tmp/geezo-closure-native.log (actual native distribution, 5/5 pass, zero skips); /tmp/geezo-closure-binaries.log (five targets built); /tmp/geezo-closure-focused.log (closure tests). Native evidence closes the optional-test skip for the actual distribution. Other-platform binaries were compiled, not executed.

## Probe Execution

No phase-declared probe scripts exist. The independently executed temporary edge probe above supplements named tests. No SUMMARY PASS marker substitutes for its execution.

## Anti-Patterns and Remaining Limits

No unreferenced TBD/FIXME/XXX markers found in reviewed closure/core files. No user-visible disconnected empty-data implementation identified. Existing nonblocking debt remains: event-driven elapsed/stale-age updates, silent SSE watch/connection failure, hook executable paths with spaces, and Phase 7 review warnings. Settings-load and scan-add errors now surface. Phase 4's SHA defect is a concrete roadmap BLOCKER distinct from its narrower satisfied GIT-01 requirement. No later phase specifically defers that defect.

## Human Verification Required

None for these bounded functional checks. No visual appearance or OS terminal-launch verification is claimed.

**Disposition:** passed. Current evidence only; no commit created.

