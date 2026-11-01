# Geezo Says Implementation Plan

Native inline execution. User-requested entertainment feature; use existing design system/mascot and ChatGPT provider.

**Goal:** A nightly, versioned top-ten pitch page: exactly five truck-build ideas and five transformative moonshots anchored to actual project IDs.

**Architecture:** Parameterize the existing immutable portfolio report runner for separate storage, prompt, validation and schedule; retain All In behavior and workspace actions. New feature is read-only ideation, no automatic workspace creation. Nightly default23:00 America/Chicago while running, startup catch-up, configurable schedule. Preserve last successful result on failure.

**Voice:** Geezo is a grizzled Linux veteran who wants to retire; wry, funny and clear, never insulting people. Explain customer experience and value in plain language. A million means an explicitly hypothetical annual-revenue scenario, never a promise/profit claim. No invented buyers, demand, rights, integrations, costs or ownership. Truck means existing ingredients plus a bounded proposed connector experiment, not proof of easy production delivery. Moonshots must identify a new audience/application and hardest leap.

- [x] RED schema/service tests: exact5+5, known IDs/evidence, no copied category/title duplicates, separate state, failure preservation.
- [x] Implement reusable runner namespace/config hooks and nightly schedule/settings validation.
- [x] Add left navigation, report/history/run and editable nightly settings; retain mascot and responsive style.
- [x] Verify backend/full regression/web+binary builds, live endpoints and first real report. Commit locally; no merge/push.

Verification: live edition validated ten pitches (5 truck/5 moonshot), 181 source projects, immutable history. Positive whole-dollar revenue assumptions are validated to total exactly $1,000,000 annually; server formats hypothetical/non-profit disclaimer. Independent review found no shipping blocker; math validation tightened following review. Full final suite127/127 passed with native binary enabled, all5targets built. Tester launcher subsequently verified with empty roots, schedules off, zero report runs and HTTP200 on4318. No merge/push.
