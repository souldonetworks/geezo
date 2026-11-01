---
phase: 03
slug: live-agent-activity
status: human_needed
nyquist_compliant: false
wave_0_complete: true
retrospective: true
validated: 2026-11-01
---

# Phase 03: RETROSPECTIVE Validation Map

Original execution sampling cannot be reconstructed. Current evidence uses node:test, React test renderer and temporary fixtures. Saved full run 120 pass/0 fail/1 optional native skip; actual native smoke separately 5/5 pass. Verifier ran 13 selected named tests plus three closure named tests and the independent edge probe. See verification report for exact limits.

| ID | Evidence / source trace | Status |
|---|---|---|
| ACT-01 | hooks/gsd-web-hook.handle → shared status paths; named PreToolUse/PostToolUse test PASS; saved Stop/native stdin coverage | green (bounded requirement) |
| ACT-02 | activityStore → sse send/watch → EventSource → RunningNowPanel; real fs.watch test and React event consumption PASS; real-session timing needs human | human review pending |
| ACT-03 | listRunning computes elapsedMs and filters STALE_MS; fresh/stale/corrupt test PASS; already-open streams only re-evaluate after an event | green (bounded requirement) |
| ACT-04 | guarded handle/runHookFromStdin; malformed-input tests and saved native malformed stdin PASS; no uncaught ordinary parse/I/O errors | green (bounded requirement) |
| ACT-05 | RunningNowPanel identity set difference → onCompleted → ProjectDetail dataRefreshKey → API; same-count/empty/manual test PASS; navigation probe PASS | green (bounded requirement) |

**Human review pending:** In a real Claude Code session start and complete a Task while a project detail page is open; confirm its type/description and elapsed display appear promptly, it disappears, and roadmap refreshes.

No watch-mode or redundant whole-suite runs. No fictional historical test sampling.

