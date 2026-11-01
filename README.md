# Geezo

A local portfolio for the projects under `~/Code`: discover folders, retain evidence-based executive briefs, and deliberately adopt GSD within existing projects.

## Run

```sh
npm install
npm install --prefix web
npm start
```

Open http://localhost:4317. Development: `npm run dev` (Vite on 5173, API on 4317). Tests: `npm test`; frontend build: `npm run build:web`.

## Track all projects

Discovery runs at startup and every 60 seconds by default. Configure roots, exclusions and scan interval in Settings; use **discover folders** for immediate refresh. Direct child directories are tracked whether they use Git, GSD, or neither. Hidden directories, symlinks and application bundles are skipped automatically. Add nested projects manually. Removing a discovered project excludes its path from future discovery; clear its exclusion in Settings to restore it. Missing folders retain their records and IDs.

Existing `.planning/ROADMAP.md` and `.gsd/gsd.db` projects retain roadmap, Git milestone and live activity views. Ordinary folders show **GSD not adopted**, rather than a misleading delivery percentage. One malformed project displays an inspection error without hiding the others.

## Executive briefs

Use **analyze project**, or explicitly **analyze all available projects**, to collect local evidence and request a draft. Discovery never makes AI calls. The analysis panel identifies the provider and data handling before invocation: selected project evidence is sent through your configured CLI/account to its AI provider. Provider charges and account policies apply.

Analysis supports Claude and **ChatGPT through the local Codex CLI**. Sign in using the selected CLI. Claude disables tools/MCP/hooks/project settings. The ChatGPT adapter ignores user config and rules, disables command execution, plugins, connectors, hooks and related features, and uses a read-only sandbox outside project folders; reported tool activity causes the result to be rejected. Both enforce time/output limits. Account or quota errors pause pending jobs rather than repeating failures across the portfolio; resume after resolving the provider issue. The current workspace is configured for ChatGPT.

Evidence collection is local and bounded. Analysis uses 80 files, 32 KiB per file and 256 KiB total; general evidence inspection uses up to 200 files, 64 KiB per file and 1 MiB total. Both stop at four directory levels and 4,000 inspected entries. It skips common credential stores, environment files, likely secrets, binaries, dependencies, generated output and symlinks. These conservative checks can omit relevant files; incomplete snapshots show **possibly stale**. Evidence is repository documentation/code, not independent proof of demand or accepted organizational commitments.

Each assessment captures its selected lens and charter version. PuppetWorks uses the complete [executive-review charter](server/resources/executive-review-v1.md); other lenses use their own charter with the shared [assessment methodology](server/resources/assessment-v3.md). Seven sections carry **confirmed**, **hypothesis**, **proposed**, or **unknown** claims. Confirmed claims require collected evidence references. Personal projects and demonstrations receive proportionate assessments. Missing owners, customer evidence, spending limits and validation steps remain visible as unknowns.

Review and edit drafts, explicitly accept a revision, view history, or export Markdown. Reanalysis creates an independent draft; it never overwrites human edits or the accepted version. A failed or interrupted job preserves prior work and can be retried explicitly. Freshness checks compare the accepted/current brief's evidence with current files; freshness is not a claim that its conclusions have been externally validated.

Commercial opportunities require evidence, account, commercial owner, attribution confirmer, motion, stage, amount/currency, next commitment and outcome. Unknown text fields must be explicit. `/api/opportunities` aggregates accepted briefs, deduplicates opportunity IDs, keeps commercial metrics/currencies separate, and excludes conflicting records from totals. No CRM synchronization or forecasting is performed.

## Executive workspace and existing research

The Souldo-inspired workspace keeps the original Geezo character, with self-hosted Newsreader/DM Sans fonts and Portfolio, Executive Briefings, Related Projects and Settings navigation. Executive Briefings shows recommendations, draft/accepted states, source freshness and live assessment progress.

Use **Import existing research** for projects containing `.planning/research/ASSESSMENT.md`. Geezer's existing Puppet Governed Remediation Gateway assessment is imported with its supporting research, original date and historical verification limits. Unchanged imports are idempotent; changed sources create another draft. Original files and accepted/human work are preserved.

The versioned [Geezer-style assessment methodology](server/resources/assessment-v2.md) adds an evidence-backed capability/reuse matrix, separate inspection/historical-verification states, smallest useful experiment and investment tiers to the executive brief. No project tests, infrastructure or application code are executed by these reviews. Historical checks remain historical, and missing context produces explicit unknowns.

## Personal/work, tags and related projects

Set **Personal**, **Work** or **Unclassified** directly on a portfolio row or in project detail. This is always your choice; assessment output never changes it. Filter the portfolio by category and topic.

Each project has your own tags and separately marked assessment suggestions. Keep or dismiss suggestions in project detail. Manual tags, classification and dismissals survive discovery and reanalysis. Existing completed/imported assessments receive topic suggestions without another AI call; new assessments may also propose explicit tags.

Use **Related Projects** to describe an idea or select a topic before starting something new. Results explain matching tags/assessment terms, respect the personal/work filter, and link to existing project evidence. Project detail also shows related projects. Matches are reuse leads, not proof that components are interchangeable or ready for production.

## GSD adoption

From project detail, **prepare migration** inspects existing context and shows proposed files, source mappings, unresolved decisions and prerequisites without writing into the project. **Apply reviewed migration** adds missing `.planning/PROJECT.md`, `ROADMAP.md` and `STATE.md`, with an explicitly proposed validation phase. Existing planning files and source code are preserved; existing `.gsd` databases are never converted or mutated. File adoption does not install a GSD CLI, authorize implementation, or transfer accountability. Continue through your installed GSD workflow after reviewing the proposal.

Application checks source fingerprints, records a recovery journal and backups, creates files exclusively, parses resulting planning artifacts and checks pre-existing collected documentation hashes. Changed proposals must be prepared again. **Roll back migration files** removes only migration-created files whose contents still match; later edits block rollback. Restarted partial operations are marked interrupted rather than replayed. Recovery records remain in the application data directory for inspection.

## Local storage and compatibility

Projects/settings remain under `~/.claude/gsd-web`; briefs, immutable evidence snapshots, analysis jobs and migration recovery records are stored alongside them. Existing project IDs/settings remain compatible. Set `GSD_WEB_HOME_OVERRIDE` to a disposable directory for testing. The app is a single-user local service; use one server per data directory. It binds to localhost by default.

Live subagent activity still uses the optional Claude hook: `npm run install-hook`. This explicitly updates `~/.claude/settings.json` with a backup; it is never installed during discovery or analysis.

The Markdown prompt and its compiled JavaScript resource are kept in sync so single-binary builds retain the contract. `npm run build:binary` uses the existing Bun packaging workflow.

## Descriptions, assessment lenses and All In

Project detail includes an editable **What is it?** description. Your saved description takes precedence; clearing it restores the AI suggestion. Inferred descriptions remain labelled hypotheses. Saving tags or category alone does not turn AI text into a user override.

**Assessment Lenses** supports creating, reading, editing and deleting versioned charters. The initial lenses are PuppetWorks, Souldo Games, Personal and Experimental. Choose a lens per project or use Auto; personal/work classification remains separate. Prior assessments retain their original charter. Assigned lenses must be reassigned before deletion, and historical versions remain available.

**All In** produces a portfolio-wide report with proposed combinations, reusable components and possible product directions. The default schedule is 08:00 America/Chicago, configurable on that page. Daily runs require the local server to be running; startup catches a missed due date. Failed runs preserve the previous successful report.

Review a recommendation before creating a linked workspace under `~/Code/Projects/<name>`. Geezo creates planning documents and links to existing repositories; it does not move or merge their code. Preview fingerprints reject stale inputs. Created workspaces can be archived and restored without changing source repositories. Existing directories are preserved.
