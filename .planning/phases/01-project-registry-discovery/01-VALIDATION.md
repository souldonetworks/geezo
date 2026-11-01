---
phase: 01
slug: project-registry-discovery
status: validated
nyquist_compliant: true
wave_0_complete: true
retrospective: true
validated: 2026-11-01
---

# Phase 01: RETROSPECTIVE Validation Map

Original execution sampling cannot be reconstructed. Current evidence uses node:test, React test renderer and temporary fixtures. Saved full run 120 pass/0 fail/1 optional native skip; actual native smoke separately 5/5 pass. Verifier ran 13 selected named tests plus three closure named tests and the independent edge probe. See verification report for exact limits.

| ID | Evidence / source trace | Status |
|---|---|---|
| REG-01 | server/lib/folderBrowser.js → projects /folders → api.browseFolders → AddProjectDialog; milestoneUi selection test and independent late-cancel probe PASS | green (bounded requirement) |
| REG-02 | registry.removeProject only rewrites registry/settings exclusions; DELETE route and PortfolioTable removal wired; registry lifecycle test PASS | green (bounded requirement) |
| REG-03 | registry.addProject realpath/stat checks; accepts ordinary and .gsd directories; registry and app tests PASS | green (bounded requirement) |
| REG-04 | scanDirectory → /scan → ScanFolderPanel; named immediate-subfolders scan test PASS | green (bounded requirement) |
| REG-05 | paths.projectsFile → writeJsonAtomic → loadProjects; registry lifecycle reload test PASS; standard path ~/.claude/gsd-web/projects.json | green (bounded requirement) |

All bounded functional checks have current implementation and automated/source evidence. No visual acceptance asserted.

No watch-mode or redundant whole-suite runs. No fictional historical test sampling.

