# Geezo

Your local project library—with editable descriptions, AI assessments, reusable-project discovery and a grizzled Linux veteran offering questionable retirement plans.

**Ready for a small tester pilot.** Single-user, local-only. GSD and Git are optional. The native macOS Apple Silicon build has been exercised; other platform binaries have been built but have not had equivalent runtime testing.

## Try it from source

Install Node.js and npm first. The current build and test environment uses **Node 26.7.0**; older Node versions have not been certified. Bun is only needed to build standalone executables.

Repository access is required. Clone the source, then start the test drive:

```sh
git clone https://github.com/souldonetworks/geezo.git
cd geezo
npm ci
npm ci --prefix web
npm run try:geezo
```

Open **http://localhost:4318**. Stop with **Ctrl+C**.

The test drive keeps its data in `.geezo-data/`, starts with **no project folders**, and leaves **scheduled AI reports off**. It preserves your settings on subsequent launches. This profile is separate from Geezo’s normal data directory.

## First five minutes

1. Open **Settings**. Add an absolute folder path under **Discovery roots**, one per line, then save.
2. Open **Portfolio → Refresh discovery**. Geezo tracks direct child folders. Use **Manage project folders → Browse folders** to add an individual or nested project.
3. Open a project. Check **What is it?**, choose **Personal/Work**, and select an assessment lens. You can edit descriptions and tags.
4. To try AI analysis, install and sign in to the **Codex CLI** using your own account (`codex login`). In Settings, select **ChatGPT (Codex)** and keep executable `codex`. Run **Analyze project** on one project first. Inventory works without an AI login.
5. Try **All In** for portfolio combinations, then **Geezo says...** for five truck-build pitches and five moonshots. Turn on their schedules only when ready; set your timezone. Scheduled runs require the local server to remain running.

Assessments use your configured AI provider and may consume its allowance. Selected source excerpts and portfolio summaries are sent to that provider. Review drafts and accept them explicitly; future results are not automatically approved.

## What can change files?

Discovery and assessment read project files. Explicitly applying a GSD adoption proposal writes the reviewed planning files. Creating a linked workspace adds a new folder and links to existing repositories; it does not move or merge them. These actions require their own review in the app.

## Giving it to another tester

Share a clean source checkout/archive **without** `.geezo-data/`, `node_modules/`, your home-directory application data, credentials or assessment records. Source is hosted at [souldonetworks/geezo](https://github.com/souldonetworks/geezo). There is no published release-download link yet.

For a Node-free handoff, use a matching executable from `dist-bin/` plus the [binary test-drive instructions](docs/TESTER-HANDOFF.md). These are local unsigned test builds, not signed/notarized installers.

## If something goes wrong

- **No projects:** save the correct discovery root, then click Refresh discovery. Hidden folders and symlink entries are skipped. Add nested folders individually.
- **AI login/quota error:** confirm `codex login status` in the same environment that launches Geezo; resolve the provider issue and retry/resume in the app.
- **Port occupied:** run `PORT=4319 npm run try:geezo` and open that port instead.
- **Interrupted assessment after restart:** retry it; existing drafts and accepted versions remain stored.
- **Feedback:** include OS, Node version or binary name, steps, expected/actual behavior and a screenshot. Do not include credentials or private source evidence.

See the [full user guide](docs/USER-GUIDE.md) for storage, providers, assessment lenses, schedules, GSD adoption and linked-workspace details.
