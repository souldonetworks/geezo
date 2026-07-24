# Synthesis Summary

Mode: new (net-new bootstrap — no existing `.planning/` context to merge against)
Precedence order: ADR > SPEC > PRD > DOC (no per-doc overrides present)

## Doc counts by type

- ADR: 0
- SPEC: 3
  - `docs/superpowers/specs/2026-07-24-gsd-run-dashboard-design.md` (confidence: high)
  - `docs/superpowers/plans/2026-07-24-gsd-run-dashboard-plan.md` (confidence: medium)
  - `docs/superpowers/specs/2026-07-24-single-binary-packaging-design.md` (confidence: high)
- PRD: 0
- DOC: 0
- UNKNOWN/unresolved: 0

## Decisions locked

0. No ADRs in this batch — `decisions.md` documents this gap and flags two implicit
   design choices (single-binary distribution via Bun; macOS-only "convert to GSD project"
   scope) that are currently only SPEC-level and not durably locked.

## Requirements extracted

0. No PRDs in this batch — `requirements.md` documents this gap. Product-level "what must be
   true" content exists only inside the SPEC docs (Purpose / Non-goals / feature lists);
   `gsd-roadmapper` will likely need to derive REQ-* entries directly from those sections.

## Constraints (from SPECs)

3 SPEC entries fully extracted into `constraints.md`:
- Type breakdown: 2 architecture/design docs, 1 TDD implementation plan (classified SPEC).
- Covers: dashboard architecture (Express + React/Vite), project registry, convert-to-GSD flow,
  roadmap/state parsing, live agent activity (hook + SSE), git milestone detection, full API
  surface, concrete module interfaces (paths/registry/parsers/progress/gitMilestone/settings/
  convert/activityStore/sse), global engineering constraints (localhost-only, no shell-string git
  calls, hook must never throw, `~/.claude/gsd-web/` state location, `GSD_WEB_HOME_OVERRIDE` test
  override), and the additive single-binary (Bun compile) packaging layer with its own CLI
  subcommands, asset-embedding codegen, and hook/install-hook reuse refactors.

## Context topics

0. No DOC-classified documents in this batch — `context.md` documents this gap.

## Conflicts

0 blockers, 0 competing-variants, 0 auto-resolved.
See `.planning/INGEST-CONFLICTS.md` for the full report (1 informational entry noting the
three SPECs are mutually consistent and that no ADRs/PRDs exist yet to establish precedence
against).

## Entry points for downstream consumers

- `.planning/intel/decisions.md` — ADR extraction (empty; gap noted)
- `.planning/intel/requirements.md` — PRD extraction (empty; gap noted)
- `.planning/intel/constraints.md` — SPEC extraction (full detail, 3 entries)
- `.planning/intel/context.md` — DOC extraction (empty; gap noted)
- `.planning/INGEST-CONFLICTS.md` — conflict detection report
