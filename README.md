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

The initial supported adapter is the installed Claude CLI. It uses noninteractive output, disables tools, MCP, hooks and project settings, runs outside the project, and enforces time/output limits. `claude --help` must support `--restricted`, `--tools`, `--strict-mcp-config`, `--no-session-persistence` and `--settings`; older CLIs fail visibly. Authenticate the CLI separately. Codex remains available for terminal launch but its analysis adapter is explicitly unsupported until a tool-free invocation is verified.

Evidence collection is local and bounded: 200 files, 64 KiB per file, 1 MiB total, four directory levels and 4,000 inspected entries. It skips common credential stores, environment files, likely secrets, binaries, dependencies, generated output and symlinks. These conservative checks can omit relevant files; incomplete snapshots show **possibly stale**. Evidence is repository documentation/code, not independent proof of demand or accepted organizational commitments.

Every assessment uses the complete versioned [executive-review prompt](server/resources/executive-review-v1.md). Seven sections carry **confirmed**, **hypothesis**, **proposed**, or **unknown** claims. Confirmed claims require collected evidence references. Personal projects and demonstrations receive proportionate assessments. Missing owners, customer evidence, spending limits and validation steps remain visible as unknowns.

Review and edit drafts, explicitly accept a revision, view history, or export Markdown. Reanalysis creates an independent draft; it never overwrites human edits or the accepted version. A failed or interrupted job preserves prior work and can be retried explicitly. Freshness checks compare the accepted/current brief's evidence with current files; freshness is not a claim that its conclusions have been externally validated.

Commercial opportunities require evidence, account, commercial owner, attribution confirmer, motion, stage, amount/currency, next commitment and outcome. Unknown text fields must be explicit. `/api/opportunities` aggregates accepted briefs, deduplicates opportunity IDs, keeps commercial metrics/currencies separate, and excludes conflicting records from totals. No CRM synchronization or forecasting is performed.

## GSD adoption

From project detail, **prepare migration** inspects existing context and shows proposed files, source mappings, unresolved decisions and prerequisites without writing into the project. **Apply reviewed migration** adds missing `.planning/PROJECT.md`, `ROADMAP.md` and `STATE.md`, with an explicitly proposed validation phase. Existing planning files and source code are preserved; existing `.gsd` databases are never converted or mutated. File adoption does not install a GSD CLI, authorize implementation, or transfer accountability. Continue through your installed GSD workflow after reviewing the proposal.

Application checks source fingerprints, records a recovery journal and backups, creates files exclusively, parses resulting planning artifacts and checks pre-existing collected documentation hashes. Changed proposals must be prepared again. **Roll back migration files** removes only migration-created files whose contents still match; later edits block rollback. Restarted partial operations are marked interrupted rather than replayed. Recovery records remain in the application data directory for inspection.

## Local storage and compatibility

Projects/settings remain under `~/.claude/gsd-web`; briefs, immutable evidence snapshots, analysis jobs and migration recovery records are stored alongside them. Existing project IDs/settings remain compatible. Set `GSD_WEB_HOME_OVERRIDE` to a disposable directory for testing. The app is a single-user local service; use one server per data directory. It binds to localhost by default.

Live subagent activity still uses the optional Claude hook: `npm run install-hook`. This explicitly updates `~/.claude/settings.json` with a backup; it is never installed during discovery or analysis.

The Markdown prompt and its compiled JavaScript resource are kept in sync so single-binary builds retain the contract. `npm run build:binary` uses the existing Bun packaging workflow.
