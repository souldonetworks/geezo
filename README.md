# GSD Run Dashboard

A local dashboard for tracking GSD ("Get Shit Done") run projects: roadmap and
progress, live subagent activity, and the last git milestone pushed upstream.

## Setup

npm install
cd web && npm install && cd ..

## Development

npm run dev

Opens the Vite dev server at http://localhost:5173, proxying /api to the
Express server at http://localhost:4317.

## Production

npm start

Builds the frontend and serves everything (API + static UI) from
http://localhost:4317.

## Enabling live "Running Now" activity

This dashboard shows live subagent activity by reading status files written
by a Claude Code hook. The hook is **not** installed automatically. To enable
it:

npm run install-hook

This merges PreToolUse/PostToolUse/Stop hook entries into your
`~/.claude/settings.json` (backing up the existing file first) so that every
Claude Code session on your machine reports subagent activity to this
dashboard. It is safe to run more than once (idempotent).

## Adding a project

Use "Add Project" on the dashboard and enter the absolute path to a folder.
If the folder already has a `.planning/ROADMAP.md` (a GSD project), it's
registered immediately. Otherwise you'll be offered a "Convert to GSD
project" action, which opens a terminal in that folder running your
configured CLI tool (see Settings) to bootstrap it.
