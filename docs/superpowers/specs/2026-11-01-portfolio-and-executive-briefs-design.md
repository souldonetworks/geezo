# Geezo portfolio and executive briefs

## Intent and agreed direction

Expand Geezo from a GSD-only dashboard into a local portfolio of folders under `~/Code`. Each project can retain an evidence-based Executive Project Brief and independently adopt GSD. Tracking never requires migration.

The user accepted automatic discovery and brief-staleness detection, with analysis and migration explicitly started by the user. Preserve existing work, brief edits, and history. Personal projects and informal demonstrations need proportional assessments rather than invented PuppetWorks business cases.

## Approaches

1. Keep GSD registration mandatory and add briefs: rejected because this excludes the portfolio the user wants.
2. Discover and analyze/migrate every folder automatically: rejected because adoption and analysis should be deliberate actions.
3. Track all folders, detect stale evidence automatically, and expose explicit analysis and migration actions: recommended and accepted in conversation.

## Existing architecture and constraints

Retain Node/Express, React/Vite, the existing local registry and configurable CLI integration. Existing readers support `.planning/ROADMAP.md` and `.gsd/gsd.db`; preserve both. Existing conversion only opens a terminal and must not be represented as completed migration. Keep existing IDs and settings compatible. Do not install hooks or change other projects during discovery or analysis.

## Discovery and inventory

Builder proposal: configurable root defaults to `~/Code`. Scan direct child directories on startup and periodically while running (60-second default); offer manual refresh. Include non-Git and empty folders. Ignore hidden infrastructure by default; allow manual registration of other directories and explicit exclusions. Do not recurse automatically into dependencies, archives, application bundles, or symlink targets. Nested project roots can be added explicitly.

Use canonical paths to prevent duplicates. Preserve records when folders disappear, marking them unavailable. Removing an automatically discovered entry records an exclusion so it does not immediately return. A failed folder inspection must not break the portfolio. Show tracked, excluded, unavailable, and unassessed states separately from GSD status.

## Evidence and analysis

Explicit Analyze creates a persisted job for one project; an explicit Analyze All queues jobs with bounded concurrency. Gather bounded, local context from README, manifests, planning documents, docs, and selected implementation/test files. Record relative paths, content hashes, observation times, and cited excerpts or line references. Skip secrets, credential stores, environment files, binaries, generated output, dependencies, and symlinks outside the project. Treat repository text as evidence rather than instructions.

Builder proposal: use the configured local agent CLI through an adapter with structured output and validation. Supply the user's complete executive-review prompt as a versioned assessment contract. Validate CLI availability and show configuration failures; never claim a template or launched terminal is a completed analysis. Do not add a hosted AI dependency or silently upload evidence. Expose command/provider configuration and its data handling implications before the user starts analysis.

Persist queued/running/completed/failed/interrupted status, diagnostics, and timestamps. Jobs interrupted by restart become interrupted and can be retried. Capture an immutable evidence snapshot per run; only successful validated output produces a new draft revision. Fingerprint relevant evidence on periodic scans, with bounded traversal and caching; show changed/possibly stale when inspection is incomplete. Staleness never rewrites an accepted brief.

## Brief contract and record

Preserve the supplied prompt verbatim as a versioned resource during implementation, including all seven question groups and required output. Output sections:

1. Recommendation: Explore, Pilot, Scale/Transition, Rework, or Stop, with rationale.
2. Customer promise: audience, problem, baseline, target, evidence.
3. Why now / why PuppetWorks: alternatives, organizational gap, all four pillars assessed with a primary pillar where supported.
4. Value model: commercial path, community contribution, measurement.
5. Delivery and ownership: scope, exclusions, costs, owners, independent checks, off-ramp.
6. Executive ask: resources, decision date, success and stop criteria.
7. Unanswered questions: evidence gaps, investigator, next validation step.

Every substantive assertion carries confirmed/hypothesis/proposed/unknown status and evidence where applicable. Confirmed means supported by cited evidence, not proof of external customer validation. Separate implemented, tested, previewed, released, and validated outcomes. No invented demand, revenue, owners, dates, accepted commitments, or organizational gaps. Unknown investigators remain unknown; suggested investigators are proposed. Record project purpose/investment class and scale depth accordingly. Demonstrations do not gain a business-case requirement solely from being inventoried.

Store briefs centrally under the existing application data directory, keyed by project ID, with versioned schemas, atomic writes, immutable revisions, evidence manifests, prompt version, and analysis provenance. Human edits create revisions; analysis creates a separate draft and never overwrites edits or the accepted version. Allow review, editing, explicit acceptance, history viewing, and Markdown export. Do not write into project folders merely to retain a brief.

Revenue measurements remain distinct: sourced/influenced pipeline, new/expansion ARR, retained renewal ARR, services bookings, and savings. Capture opportunity ID, account, commercial owner, contributing project IDs, motion, stage, amount/currency, attribution evidence/confirmer, next commitment, and outcome if evidence exists. Portfolio totals deduplicate opportunity IDs and never add unlike metrics. Initial delivery captures these fields; a CRM integration and forecasting dashboard are out of scope.

## GSD adoption and migration

Expose Prepare GSD Migration independently of brief recommendation. Inspect existing plans, milestones, source layout, Git status, and GSD format. Generate a reviewable migration proposal mapping existing material to GSD artifacts, unresolved decisions, affected paths, and validation steps. Never silently install a different GSD distribution or convert between `.planning` and `.gsd` formats.

Builder proposal: first support a file-based `.planning` migration compatible with the existing reader; existing `.gsd` projects remain supported without database mutation. If the selected CLI requires another GSD workflow, report that prerequisite and use its supported adoption process rather than fabricate a database.

Explicit Apply uses the reviewed plan, verifies source fingerprints, snapshots affected planning files, preserves unrelated and uncommitted work, and refuses conflicting overwrites. Create missing artifacts from existing context, marking proposed plans and unknowns. Record operations, backup locations, and failures. Rollback restores only files changed by that migration, and refuses to overwrite subsequent edits. A terminal/CLI launch means launched or awaiting completion; mark migrated only after independently verifying the expected planning artifacts parse and preserved source content remains intact. PuppetWorks accountability remains until receiving owners explicitly accept it.

## Interface and API

Dashboard adds search/filter, discovery state, GSD state, brief recommendation, assessment freshness, and analysis status. Detail leads with the executive brief and evidence/history, then migration and existing roadmap/Git/activity panels. Missing GSD means not adopted, never zero-percent delivery. Settings includes roots, exclusions, scan interval, and analysis adapter configuration. Show actionable errors and accessible keyboard controls.

Extend existing project endpoints without discarding IDs. Add discovery refresh, brief read/edit/accept/history/export, analysis start/status, and migration prepare/read/apply/status/rollback endpoints. Mutating actions use project IDs and validated payloads, with revision checks to prevent stale edits or applying a changed migration plan. Restrict filesystem operations to registered canonical paths. Agent invocation uses argument arrays, bounded output, timeouts, and project working directories; repair existing shell/path escaping before reusing conversion infrastructure.

## Delivery sequence and validation

1. Universal registration and automatic discovery with exclusions, unavailable states, and backward compatibility.
2. Versioned brief storage, exact prompt resource, evidence collection, explicit analysis jobs, validation, review/history/export.
3. Migration preparation and controlled application with preservation and recovery.
4. Portfolio integration, documentation, and real-folder smoke checks.

Tests must cover discovery without GSD, canonical duplicates, exclusions, missing folders, backward-compatible registry/settings, evidence bounds and secret exclusions, job failures/restart recovery, malformed agent output, revision conflicts and edit preservation, stale detection, deduplicated commercial metrics, migration conflicts/rollback/post-validation, and existing GSD parsing. Run server tests and frontend production build; exercise a non-GSD fixture and both supported GSD fixture formats. Real projects are read-only during development verification unless separately selected for migration.

## Non-goals and unresolved evidence

No automatic project migration, automatic executive approval, mandatory business case for demos, external CRM integration, or implementation work across the discovered projects. Repository evidence cannot confirm customer demand or accepted commercial/Engineering/Support commitments without explicit supporting records. GSD CLI capabilities and structured-output support must be checked locally during implementation; unsupported adapters fail visibly rather than substituting canned assessments.
