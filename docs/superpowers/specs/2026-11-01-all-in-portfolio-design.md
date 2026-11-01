# Descriptions, assessment lenses and All In

## Authorized direction

Continue native execution. The user requested editable descriptions (AI best guesses labelled when uncertain), a daily canonical All In portfolio review, concrete product/reuse proposals with an action, and CRUD for assessment lenses. The user explicitly selected linked workspaces under `~/Code/Projects/<name>` before physical moves. Keep Geezo's character and current visual system.

## Descriptions and lenses

Each project exposes a short 'What is it?' description with provenance/confidence. A saved user description takes precedence over AI output and survives reanalysis. Existing briefs provide a clearly labelled provisional fallback; new assessments return an explicit description, using a hypothesis when uncertain. Users can edit or clear their override.

Persist versioned lens records independently of projects and briefs. Seed four editable charters: PuppetWorks (the supplied executive charter), Souldo Games (game vision/player experience, playability, production and possible commercial validation), Personal (sellable potential versus home/homelab utility), Experimental (learning, feasibility, bounded experiments and possible future direction). CRUD uses optimistic versions. Deleting a lens assigned to projects is blocked until reassignment; historical lens snapshots are preserved. Category personal/work remains a separate manually controlled field.

Each project can explicitly select a lens or use Auto. Auto proposes PuppetWorks for clear Puppet identities, Souldo Games for game evidence, Personal for explicit personal classification or supported prior personal purpose, otherwise Experimental. Auto does not change classification. Individual jobs capture exact lens charter/version and user description at intake; that snapshot drives the prompt and remains attached to the result. Non-Puppet charters do not inherit PuppetWorks pillars or commercial assumptions. Personal reviews distinguish commercial, home/homelab, learning, community, mixed or unclear value; revenue/demand remains unknown without evidence.

## All In

One canonical current report, with immutable prior reports and source snapshots. A bounded portfolio digest contains project IDs, descriptions, classifications, lens assignments/versions, tags and source assessment summaries/capabilities, with coverage and staleness. Use the configured ChatGPT adapter with the existing restrictions; no source code execution or automatic repository mutation.

Output includes overall direction, material gaps, and up to eight evidence-linked proposals to combine projects, extract reusable components, integrate complementary capabilities, or deliberately keep projects separate. Each proposal names its source projects, a working product name, 'what it is', audience/problem, proposed value, confidence, reasons, risks, validation gates and a suggested implementation path. Shared tags alone never prove duplicate implementation. Cross-lens/personal-work combinations remain explicit proposals rather than organizational commitments.

Default schedule: daily at 08:00 America/Chicago, configurable in-app. The local service must be running; missed runs catch up at startup. No OS service or cloud automation is installed. Schedule attempts are persisted by local day, no duplicate active runs and no minute-by-minute retries after provider failure. Manual refresh is available. Changing inputs does not silently replace a successful report with a failed run. One daily report update is the default, while explicit manual updates retain history.

## Linked workspace action

A proposal opens a concrete review of the name, target path, member repositories, classification/lens and proposed product description. Explicit Create makes a new directory under the configured existing Projects root, with README, manifest, a proposed GSD integration roadmap and `repositories/` links to the original canonical repositories. It registers the new workspace as a project. This organizes a product effort; it does not claim the code is integrated, production-ready or commercialized.

Reject target collisions, invalid names, symlinked target parents, missing/changed members, stale selected-source revisions/metadata, duplicate member aliases, and ancestor/link cycles. Do not move or edit original repositories. Preserve the existing Projects tree. Record operations and recovery state centrally. Creation is idempotent per reviewed proposal. Archive moves only the created workspace into a recoverable hidden archive and removes its registry entry; originals stay untouched. Restore refuses collisions and reinstates the saved workspace/project record.

## Interface and verification

Portfolio tables lead with descriptions. Detail allows description/lens edits alongside category/tags; effective lens and AI guess labels are visible. Add Assessment Lenses CRUD and All In navigation/pages, schedule settings, job progress, source coverage, recommendation history and reviewable workspace actions. Preserve existing executive brief/history and related-project workflows.

Tests cover description precedence, lens CRUD/versioning/deletion restrictions and exact prompt provenance, bounded portfolio input and invented-source rejection, daily timezone/dedup/catch-up behavior, failed report preservation, workspace collisions/links/source preservation/idempotency/archive/restore, and navigation/save safety. Run the full suite, frontend build and compiled binary checks, then restart the live service, preserve completed assessments, run the initial All In report and use the new lenses for subsequent/non-Puppet assessments. Real workspace creation is left to the user's review button; development uses temporary folders.
