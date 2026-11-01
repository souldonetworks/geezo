# Geezo executive workspace

## Approved direction

The user approved the proposed full Souldo-inspired portfolio treatment and Executive Briefings navigation, requested import of geezer's assessment, then explicitly requested running that same assessment across all Geezo projects. Keep the Geezo character prominent regardless of colors or branding. Continue native execution as previously selected; this records the already approved direction rather than requesting the same permission again.

## Approach and scope

A palette-only refresh would leave the large card grid and buried briefs. The selected full treatment uses Souldo's paper/ink/orange/navy palette and Newsreader/DM Sans type, with compact portfolio tables, summary metrics, and persistent Portfolio / Executive Briefings / Settings navigation. Preserve the mascot in a prominent navigation brand area. Keep the existing Node/React architecture and localhost address. Fonts are self-hosted from the existing local Souldo source; include their license files. Do not replace the character with Souldo's swirl.

## Assessment import and provenance

Geezer is the planning workspace for Puppet Governed Remediation Gateway; rapi-rest owns its proposed implementation. Import the existing `.planning/research/ASSESSMENT.md` and supporting research files as immutable source snapshots, leaving geezer and sibling repositories unchanged. Add a structured executive draft that conservatively maps reported findings into the seven brief sections and preserves the original recommendation and date. Source reports are historical inspection evidence, not fresh verification. Unassigned customer evidence, commercial ownership, budget, support and off-ramp stay unknown. Do not create separate full project assessments for every repository merely mentioned in the matrix. Reimport unchanged sources is idempotent; changed sources create a new draft without overwriting accepted or human revisions.

## Portfolio-wide assessment

Extend explicit analysis with a versioned Geezer-style methodology: project/revision inventory, capability matrix, implemented/partial/planned only/missing/unknown status, separately recorded verification, alternatives/reuse, smallest useful experiment, indicative investment tiers, ownership gaps, and continue/stop criteria. Preserve the original executive prompt. Evidence is bounded and tools remain disabled; do not execute project tests, dependencies or infrastructure. Existing test records are reported as historical, never freshly tested. Lack of files produces a useful unknown assessment rather than fabricated findings. Assess personal/demo projects proportionately.

Persist the extended assessment on each brief revision, validate citations, show it in detail/export, and retain the source prompt version. Queue all currently tracked projects on the live server as explicitly requested. Show progress and failures in Executive Briefings; no automatic acceptance or migration. Deduplicate active jobs; retry only deliberately. A provider/account failure must be surfaced and must not be described as a completed run.

## Interface

Portfolio: project counts, GSD adoption, assessed coverage and running jobs; searchable/filterable compact table; folder management tucked into a disclosure rather than dominating the page. Executive Briefings: counts for drafts/accepted/unassessed, recommendations, freshness and assessment job status; direct links to project briefs; import existing Geezer research and analyze-all controls. Each project detail keeps its roadmap, Git, activity and deliberate migration actions. Clearly distinguish imported drafts, AI drafts and accepted revisions.

## Validation

Regression tests cover import preservation/idempotency/changed sources, citation limits, preservation of human/accepted revisions, unsupported fake verification, empty-evidence honesty, active-job deduplication, and portfolio briefing API summaries. Run full server tests and frontend build. Restart the live app and verify homepage/briefings/import/job API responses. Browser inspection is attempted only if an enabled surface exists. Record real analysis progress and any provider failures truthfully.

## Additional approved scope: classification and related-project discovery

The user requested a manual Personal / Work classification and assessment-assigned topic tags to find related projects before starting new work. Classification defaults to Unclassified and is never inferred from the project name or AI output. Keep user tags separate from suggested tags; suggestions are indexed immediately but clearly labelled and can be accepted or dismissed. Use completed/imported assessment text to derive conservative topic suggestions for existing results, and request explicit suggestedTags in subsequent analysis output. No assessment reruns are required just to add searchability.

Add category/tag filters to the portfolio, an editable classification on each project, tag management on detail, a Related Projects navigation entry with concept/tag search, and related-project suggestions on detail. Relevance is explained by matching tags/terms; it is a reuse lead, not proof of interchangeable capabilities. Metadata persists independently of brief revisions and survives reanalysis/import/discovery. Validate normalized tags, preserve dismissed suggestions, and support optimistic metadata versions.

## Provider adjustment requested during execution

The user chose ChatGPT after Claude reported not signed in. The installed Codex CLI is authenticated through ChatGPT. Its adapter ignores user config/rules, disables shell execution, apps/plugins/hooks and discovery features, uses an isolated read-only working directory, and rejects provider transcripts containing tool activity. This is a restricted read-only adapter rather than a claim that every administrative model tool is absent. Provider errors are classified from both nonzero exits and successful-exit structured errors; authentication/quota failures pause the remaining queue until explicit resume.
