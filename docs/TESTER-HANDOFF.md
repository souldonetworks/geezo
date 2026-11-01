# Give Geezo to a tester

Use a clean source archive with the root README, or a platform-matching executable built by `npm run build:binary`. Build outputs live in `dist-bin/` and are ignored by Git. Current validation: native macOS Apple Silicon runtime; all five targets compiled. Linux/Windows/Intel Mac need their own runtime testing. No signed/notarized installer or published download exists yet.

## Node-free pilot bundle

Send these three files together:

- The matching `geezo-*` executable from `dist-bin/`.
- `config/tester-settings.json`.
- This guide.

Do not send your Geezo data directory, `.geezo-data/`, provider credentials, evidence snapshots or private project records. The compiled application includes the UI, fonts and character, but not your runtime data or CLI account.

### macOS/Linux terminal start

From the folder containing the supplied binary and `tester-settings.json`:

```sh
mkdir -p geezo-test-data
cp -n tester-settings.json geezo-test-data/settings.json
chmod +x ./geezo-darwin-arm64
GSD_WEB_HOME_OVERRIDE="$PWD/geezo-test-data" ./geezo-darwin-arm64 serve --port 4318
```

Replace the executable name with the one matching your machine. Open **http://localhost:4318** and stop with **Ctrl+C**. On subsequent launches, run only the final command; preserve the data folder. macOS may require its normal user approval for an unsigned local build; no signing/notarization is claimed.

### Windows PowerShell start (build-only validation so far)

```powershell
New-Item -ItemType Directory -Force geezo-test-data | Out-Null
if (!(Test-Path geezo-test-data/settings.json)) { Copy-Item tester-settings.json geezo-test-data/settings.json }
$env:GSD_WEB_HOME_OVERRIDE = Join-Path (Get-Location) 'geezo-test-data'
.\geezo-windows-x64.exe serve --port 4318
```

## First use

1. Settings → Discovery roots → add your parent code folder and save.
2. Portfolio → Refresh discovery. No Git or GSD setup is required.
3. Inventory and editing work without an AI account. For assessments, install/authenticate your own Codex CLI (`codex login`), select ChatGPT (Codex) in Geezo Settings, and analyze one project.
4. Try the review/export controls, then All In and Geezo says. Enable their schedules deliberately and set your timezone; runs require the server to stay running.
5. For this pilot, leave optional global Claude hooks and repository-writing adoption/workspace actions until you have reviewed their previews. The core portfolio does not require them.

The supplied preset starts empty, uses the tester's own local data, and disables scheduled AI work. Existing tester settings are not overwritten by the source test-drive launcher. AI uses the tester's own account and sends selected repository excerpts/portfolio summaries to that provider.

## Known pilot limits

- Local single-user service; do not expose it as a shared hosted application.
- Real-session activity timing and full visual fault-flow UAT remain pending in the milestone records.
- Builds are unsigned and not packaged as installers; non-native runtime behavior is not certified.
- AI output can fail validation or be wrong. Failed refreshes preserve prior reports; accepted briefs and human edits are retained.
- The source repository is private at https://github.com/souldonetworks/geezo. There is no published release channel or project-wide public license yet; agree distribution/licensing before a broader public release.
