# Milestone Closure Implementation Plan

> Native inline execution, as previously selected. Apply executing-plans task by task.

**Goal:** Close REG-01, RM-01 and ACT-05 audit failures and verify the retroactively imported phases without rewriting user decisions.

**Architecture:** Add a read-only directory listing endpoint and local folder browser; parse phase success criteria into a stable array consumed by RoadmapTree; detect removed activity identities and refetch detail data with navigation cleanup. Keep default Node/compiled app behavior and existing personal/work/lens state.

**Spec:** `.planning/v1.0-MILESTONE-AUDIT.md`, original ROADMAP.md, and approved all-folder/table/deliberate-adoption pivot.

## Constraints and review focus

No repository changes from selecting folders. Absolute directory paths, errors/cancellation, empty lists, multiline criteria, phase boundaries, same-count activity replacement, stale navigation responses and subscription cleanup need checks. No GUI automation or real user settings changes in tests. Retain mascot. Scope excludes six existing packaging warnings.

- [x] Folder browser: test local listing and choose-before-add interaction; implement bounded listing and API/UI errors.
- [x] Success criteria: RED parser/renderer checks; support numbered/bullet items and continuation text; preserve per-phase boundaries.
- [x] Activity refresh: RED React interaction check; detect completion including same-count replacement; make detail refresh navigation-safe and manually available.
- [x] Verify full suite/build/compiled binary; reconcile approved requirement wording, restore evidence-bearing phase records, rerun independent integration audit. Record missing evidence honestly.

Functional implementation and independent verification complete; real-session/visual UAT remain explicitly pending, not waived.
