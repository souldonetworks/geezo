# GSD Run Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Node/Express + React dashboard that lists registered GSD project folders, shows each one's roadmap/progress, shows live-running subagents via a Claude Code hook, shows the last git milestone tag, and can bootstrap a non-GSD folder into one via a configurable terminal launch.

**Architecture:** Express backend (`server/`) parses `.planning/ROADMAP.md` and `.planning/STATE.md`, queries local git refs, and watches per-project status directories (written by a Claude Code hook script) to push live agent activity over SSE. A React (Vite) frontend (`web/`) consumes this API. A standalone hook script (`hooks/gsd-web-hook.js`) and an explicit opt-in installer (`scripts/install-hook.js`) wire Claude Code's `PreToolUse`/`PostToolUse`/`Stop` hooks to write/delete status files — the installer is never run automatically, only by the user.

**Tech Stack:** Node.js (CommonJS), Express, `gray-matter` (YAML frontmatter parsing), Node's built-in `node:test` + `node:assert/strict` for backend tests, React + Vite for the frontend, `concurrently` for local dev.

## Global Constraints

- Single-user, localhost-only tool. No auth, no external network calls except local git.
- All persistent tool state (registry, settings, live-activity status files) lives under `~/.claude/gsd-web/`, never inside a tracked project repo.
- Tests must be able to override the `~/.claude/gsd-web` location via the `GSD_WEB_HOME_OVERRIDE` environment variable, so they never touch the real user home directory.
- Git operations use `execFileSync('git', [...])` (array args), never a shell string, to avoid injection.
- The hook script must never throw uncaught — a hook failure must not block the user's actual Claude Code session. Wrap all hook logic in try/catch and always exit 0.
- The `scripts/install-hook.js` installer modifies `~/.claude/settings.json` (a global, shared file) — it is only ever run explicitly by the user (`npm run install-hook`), never invoked automatically as part of building or testing this plan.

---

## File Structure

```
geezo/
  package.json                  # root: server deps + scripts (dev/build/start/test)
  .gitignore
  server/
    app.js                      # express app factory (middleware + routes + static serving)
    server.js                   # entry point: creates app, listens on PORT
    lib/
      paths.js                  # well-known paths + projectHash()
      registry.js                # projects.json CRUD
      roadmapParser.js           # parse ROADMAP.md
      stateParser.js             # parse STATE.md frontmatter
      progress.js                 # combine roadmap+state into a progress summary
      gitMilestone.js             # local git tag/ref inspection
      settings.js                 # settings.json CRUD + defaults
      convert.js                   # build + launch the convert-terminal command
      activityStore.js             # read live status files for a project
      sse.js                        # SSE subscriber hub + fs.watch broadcaster
    routes/
      projects.js                   # /api/projects*
      settingsRoute.js              # /api/settings
      convertRoute.js               # /api/convert
  hooks/
    gsd-web-hook.js                 # PreToolUse/PostToolUse/Stop handler
  scripts/
    install-hook.js                 # idempotent ~/.claude/settings.json merge (user-run only)
  web/
    package.json
    vite.config.js
    index.html
    src/
      main.jsx
      App.jsx
      api.js
      pages/Dashboard.jsx
      pages/ProjectDetail.jsx
      pages/SettingsPage.jsx
      components/ProjectCard.jsx
      components/AddProjectDialog.jsx
      components/RoadmapTree.jsx
      components/RunningNowPanel.jsx
      components/GitMilestonePanel.jsx
  tests/
    server/
      paths.test.js
      registry.test.js
      roadmapParser.test.js
      stateParser.test.js
      progress.test.js
      gitMilestone.test.js
      settings.test.js
      convert.test.js
      activityStore.test.js
      sse.test.js
      app.test.js
    hooks/
      gsd-web-hook.test.js
    scripts/
      install-hook.test.js
    fixtures/
      roadmap-sample.md
      state-sample.md
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `server/app.js`
- Create: `server/server.js`

**Interfaces:**
- Produces: `server/app.js` exports `createApp()` returning an Express app with `GET /api/health` → `{ status: 'ok' }`. `server/server.js` calls `createApp().listen(PORT)`, `PORT = process.env.PORT || 4317`.

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "gsd-run-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev:server": "node server/server.js",
    "dev:web": "npm run dev --prefix web",
    "dev": "concurrently -n server,web \"npm run dev:server\" \"npm run dev:web\"",
    "build:web": "npm run build --prefix web",
    "start": "npm run build:web && node server/server.js",
    "test": "node --test tests/server tests/hooks tests/scripts",
    "install-hook": "node scripts/install-hook.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
web/node_modules/
web/dist/
*.log
```

- [ ] **Step 3: Write `server/app.js`**

```javascript
const express = require('express');

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

module.exports = { createApp };
```

- [ ] **Step 4: Write `server/server.js`**

```javascript
const { createApp } = require('./app');

const PORT = process.env.PORT || 4317;

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`gsd-web server listening on http://localhost:${PORT}`);
  });
}

module.exports = { PORT };
```

- [ ] **Step 5: Install dependencies and verify the server boots**

Run: `npm install`
Run: `node server/server.js &` then `curl http://localhost:4317/api/health`
Expected: `{"status":"ok"}`, then stop the background server (`kill %1`).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore server/app.js server/server.js
git commit -m "feat: scaffold express server with health endpoint"
```

---

### Task 2: Well-known paths utility

**Files:**
- Create: `server/lib/paths.js`
- Test: `tests/server/paths.test.js`

**Interfaces:**
- Produces: `gsdWebDir()`, `projectsFile()`, `settingsFile()`, `statusRootDir()`, `projectHash(absPath)`, `statusDirFor(absPath)` — all pure functions reading `process.env.GSD_WEB_HOME_OVERRIDE` if set, else `~/.claude/gsd-web`.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('paths honor GSD_WEB_HOME_OVERRIDE', () => {
  process.env.GSD_WEB_HOME_OVERRIDE = '/tmp/gsd-web-test-home';
  delete require.cache[require.resolve('../../server/lib/paths')];
  const paths = require('../../server/lib/paths');

  assert.equal(paths.gsdWebDir(), '/tmp/gsd-web-test-home');
  assert.equal(paths.projectsFile(), path.join('/tmp/gsd-web-test-home', 'projects.json'));
  assert.equal(paths.settingsFile(), path.join('/tmp/gsd-web-test-home', 'settings.json'));
  assert.equal(paths.statusRootDir(), path.join('/tmp/gsd-web-test-home', 'status'));
  delete process.env.GSD_WEB_HOME_OVERRIDE;
});

test('projectHash is stable and path-normalized', () => {
  delete require.cache[require.resolve('../../server/lib/paths')];
  const paths = require('../../server/lib/paths');
  const h1 = paths.projectHash('/Users/me/project');
  const h2 = paths.projectHash('/Users/me/project/');
  assert.equal(h1, h2);
  assert.match(h1, /^[a-f0-9]{16}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/paths.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/paths'`

- [ ] **Step 3: Write `server/lib/paths.js`**

```javascript
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

function gsdWebDir() {
  return process.env.GSD_WEB_HOME_OVERRIDE || path.join(os.homedir(), '.claude', 'gsd-web');
}

function projectsFile() {
  return path.join(gsdWebDir(), 'projects.json');
}

function settingsFile() {
  return path.join(gsdWebDir(), 'settings.json');
}

function statusRootDir() {
  return path.join(gsdWebDir(), 'status');
}

function projectHash(absPath) {
  const normalized = path.resolve(absPath).replace(/\/+$/, '');
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

function statusDirFor(absPath) {
  return path.join(statusRootDir(), projectHash(absPath));
}

module.exports = { gsdWebDir, projectsFile, settingsFile, statusRootDir, projectHash, statusDirFor };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/paths.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/paths.js tests/server/paths.test.js
git commit -m "feat: add gsd-web well-known paths utility"
```

---

### Task 3: Project registry

**Files:**
- Create: `server/lib/registry.js`
- Test: `tests/server/registry.test.js`

**Interfaces:**
- Consumes: `paths.js` (`projectsFile`, `gsdWebDir`)
- Produces: `loadProjects()`, `saveProjects(list)`, `isGsdProject(absPath)`, `addProject(absPath)` (returns `{id, path, name, addedAt}`, throws `Error` with `.code` in `'PATH_NOT_FOUND'|'NOT_GSD_PROJECT'|'ALREADY_ADDED'`), `removeProject(id)` (returns boolean), `findProject(id)`.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-home-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/registry')];
  return require('../../server/lib/registry');
}

test('addProject rejects a path with no .planning/ROADMAP.md', () => {
  const registry = freshHome();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'not-gsd-'));
  assert.throws(() => registry.addProject(target), (err) => err.code === 'NOT_GSD_PROJECT');
});

test('addProject accepts and persists a valid GSD project, removeProject deletes it', () => {
  const registry = freshHome();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'is-gsd-'));
  fs.mkdirSync(path.join(target, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(target, '.planning', 'ROADMAP.md'), '# Roadmap');

  const project = registry.addProject(target);
  assert.equal(project.path, fs.realpathSync(target));
  assert.equal(registry.loadProjects().length, 1);

  assert.throws(() => registry.addProject(target), (err) => err.code === 'ALREADY_ADDED');

  const removed = registry.removeProject(project.id);
  assert.equal(removed, true);
  assert.equal(registry.loadProjects().length, 0);
});

test('addProject rejects a nonexistent path', () => {
  const registry = freshHome();
  assert.throws(() => registry.addProject('/no/such/path/at/all'), (err) => err.code === 'PATH_NOT_FOUND');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/registry.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/registry'`

- [ ] **Step 3: Write `server/lib/registry.js`**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { projectsFile, gsdWebDir } = require('./paths');

function ensureDir() {
  fs.mkdirSync(gsdWebDir(), { recursive: true });
}

function loadProjects() {
  ensureDir();
  if (!fs.existsSync(projectsFile())) return [];
  return JSON.parse(fs.readFileSync(projectsFile(), 'utf8'));
}

function saveProjects(list) {
  ensureDir();
  fs.writeFileSync(projectsFile(), JSON.stringify(list, null, 2));
}

function isGsdProject(absPath) {
  return fs.existsSync(path.join(absPath, '.planning', 'ROADMAP.md'));
}

function addProject(absPath) {
  if (!fs.existsSync(absPath)) {
    const err = new Error('Path does not exist');
    err.code = 'PATH_NOT_FOUND';
    throw err;
  }
  const resolved = fs.realpathSync(absPath);
  if (!isGsdProject(resolved)) {
    const err = new Error('Not a GSD project (missing .planning/ROADMAP.md)');
    err.code = 'NOT_GSD_PROJECT';
    throw err;
  }
  const list = loadProjects();
  if (list.some((p) => p.path === resolved)) {
    const err = new Error('Project already registered');
    err.code = 'ALREADY_ADDED';
    throw err;
  }
  const project = {
    id: crypto.randomUUID(),
    path: resolved,
    name: path.basename(resolved),
    addedAt: new Date().toISOString(),
  };
  list.push(project);
  saveProjects(list);
  return project;
}

function removeProject(id) {
  const list = loadProjects();
  const next = list.filter((p) => p.id !== id);
  saveProjects(next);
  return next.length !== list.length;
}

function findProject(id) {
  return loadProjects().find((p) => p.id === id);
}

module.exports = { loadProjects, saveProjects, isGsdProject, addProject, removeProject, findProject };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/registry.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/registry.js tests/server/registry.test.js
git commit -m "feat: add project registry with GSD validation"
```

---

### Task 4: ROADMAP.md parser

**Files:**
- Create: `server/lib/roadmapParser.js`
- Create: `tests/fixtures/roadmap-sample.md`
- Test: `tests/server/roadmapParser.test.js`

**Interfaces:**
- Produces: `parseRoadmap(markdownText)` → `{ phases: [{ number, title, status: 'done'|'pending', summary, goal, dependsOn, requirements: string[], plans: [{ id, title, done }] }] }`

- [ ] **Step 1: Write the fixture `tests/fixtures/roadmap-sample.md`**

```markdown
# Roadmap: Sample Project

## Overview

A sample project for parser tests.

## Phases

- [x] **Phase 1: Project Scaffold** - Basic scaffold works
- [ ] **Phase 2: Core Feature** - Core feature works end to end

## Phase Details

### Phase 1: Project Scaffold
**Goal**: Basic scaffold works end to end.
**Depends on**: Nothing (first phase)
**Requirements**: [FR-1.1, FR-1.2]
**Success Criteria** (what must be TRUE):
  1. App boots without errors
**Plans**: 2 plans

Plans:
- [x] 01-01: Repo structure — create directories
- [x] 01-02: Health endpoint — add /health route

### Phase 2: Core Feature
**Goal**: Core feature works end to end.
**Depends on**: Phase 1
**Requirements**: [FR-2.1]
**Success Criteria** (what must be TRUE):
  1. Feature returns correct data
**Plans**: 2 plans

Plans:
- [x] 02-01: Data model — define schema
- [ ] 02-02: API route — expose data over HTTP
```

- [ ] **Step 2: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('parseRoadmap extracts phases, status, and plans', () => {
  const { parseRoadmap } = require('../../server/lib/roadmapParser');
  const md = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'roadmap-sample.md'), 'utf8');
  const result = parseRoadmap(md);

  assert.equal(result.phases.length, 2);

  const phase1 = result.phases[0];
  assert.equal(phase1.number, '1');
  assert.equal(phase1.title, 'Project Scaffold');
  assert.equal(phase1.status, 'done');
  assert.equal(phase1.goal, 'Basic scaffold works end to end.');
  assert.equal(phase1.dependsOn, 'Nothing (first phase)');
  assert.deepEqual(phase1.requirements, ['FR-1.1', 'FR-1.2']);
  assert.equal(phase1.plans.length, 2);
  assert.deepEqual(phase1.plans[0], { id: '01-01', title: 'Repo structure — create directories', done: true });

  const phase2 = result.phases[1];
  assert.equal(phase2.status, 'pending');
  assert.equal(phase2.plans[1].done, false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/server/roadmapParser.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/roadmapParser'`

- [ ] **Step 4: Write `server/lib/roadmapParser.js`**

```javascript
const CHECKLIST_RE = /^- \[( |x|X)\] \*\*Phase (\d+(?:\.\d+)?): (.+?)\*\* - (.+)$/;
const PHASE_HEADER_RE = /^### Phase (\d+(?:\.\d+)?): (.+)$/;
const GOAL_RE = /^\*\*Goal\*\*:\s*(.+)$/;
const DEPENDS_RE = /^\*\*Depends on\*\*:\s*(.+)$/;
const REQUIREMENTS_RE = /^\*\*Requirements\*\*:\s*(.+)$/;
const PLAN_RE = /^- \[( |x|X)\] ([\w.]+-\d+): (.+)$/;

function parseRoadmap(markdown) {
  const lines = markdown.split('\n');
  const checklist = new Map();
  const phases = [];
  let current = null;

  for (const line of lines) {
    const checklistMatch = CHECKLIST_RE.exec(line);
    if (checklistMatch) {
      const [, doneFlag, number, title, summary] = checklistMatch;
      checklist.set(number, { done: doneFlag.toLowerCase() === 'x', summary });
      continue;
    }

    const headerMatch = PHASE_HEADER_RE.exec(line);
    if (headerMatch) {
      if (current) phases.push(current);
      const [, number, title] = headerMatch;
      current = { number, title, goal: '', dependsOn: '', requirements: [], plans: [] };
      continue;
    }

    if (!current) continue;

    const goalMatch = GOAL_RE.exec(line);
    if (goalMatch) {
      current.goal = goalMatch[1];
      continue;
    }

    const dependsMatch = DEPENDS_RE.exec(line);
    if (dependsMatch) {
      current.dependsOn = dependsMatch[1];
      continue;
    }

    const requirementsMatch = REQUIREMENTS_RE.exec(line);
    if (requirementsMatch) {
      current.requirements = requirementsMatch[1]
        .replace(/[[\]]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }

    const planMatch = PLAN_RE.exec(line);
    if (planMatch) {
      const [, doneFlag, id, title] = planMatch;
      current.plans.push({ id, title, done: doneFlag.toLowerCase() === 'x' });
      continue;
    }
  }
  if (current) phases.push(current);

  const merged = phases.map((phase) => {
    const entry = checklist.get(phase.number);
    return {
      ...phase,
      status: entry && entry.done ? 'done' : 'pending',
      summary: entry ? entry.summary : '',
    };
  });

  return { phases: merged };
}

module.exports = { parseRoadmap };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/server/roadmapParser.test.js`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add server/lib/roadmapParser.js tests/fixtures/roadmap-sample.md tests/server/roadmapParser.test.js
git commit -m "feat: add ROADMAP.md parser"
```

---

### Task 5: STATE.md parser

**Files:**
- Create: `server/lib/stateParser.js`
- Create: `tests/fixtures/state-sample.md`
- Test: `tests/server/stateParser.test.js`

**Interfaces:**
- Consumes: `gray-matter` npm package
- Produces: `parseState(markdownText)` → `{ milestone, status, progress: {total_phases, completed_phases, total_plans, completed_plans, percent} | null, stoppedAt, lastUpdated, currentPhase, currentStatus }`

- [ ] **Step 1: Write the fixture `tests/fixtures/state-sample.md`**

```markdown
---
gsd_state_version: 1.0
milestone: v1.0
status: executing
stopped_at: context exhaustion at 91% (2026-04-16)
last_updated: "2026-04-18T18:54:01.399Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
  percent: 89
---

# Project State

## Current Position

Phase: 02 (test-pattern-catalog) — EXECUTING
Plan: 1 of 1
Status: Executing Phase 02
Last activity: 2026-04-18 -- Phase 02 execution started
```

- [ ] **Step 2: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('parseState extracts frontmatter and current position', () => {
  const { parseState } = require('../../server/lib/stateParser');
  const md = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'state-sample.md'), 'utf8');
  const result = parseState(md);

  assert.equal(result.milestone, 'v1.0');
  assert.equal(result.status, 'executing');
  assert.equal(result.progress.percent, 89);
  assert.equal(result.progress.completed_plans, 8);
  assert.equal(result.stoppedAt, 'context exhaustion at 91% (2026-04-16)');
  assert.equal(result.currentPhase, '02 (test-pattern-catalog) — EXECUTING');
  assert.equal(result.currentStatus, 'Executing Phase 02');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/server/stateParser.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/stateParser'`

- [ ] **Step 4: Write `server/lib/stateParser.js`**

```javascript
const matter = require('gray-matter');

function parseState(markdown) {
  const { data, content } = matter(markdown);

  const sectionMatch = /## Current Position\n\n([\s\S]*?)(\n##|\n*$)/.exec(content);
  const sectionText = sectionMatch ? sectionMatch[1].trim() : '';

  const phaseMatch = /^Phase:\s*(.+)$/m.exec(sectionText);
  const statusMatch = /^Status:\s*(.+)$/m.exec(sectionText);

  return {
    milestone: data.milestone || null,
    status: data.status || null,
    progress: data.progress || null,
    stoppedAt: data.stopped_at || null,
    lastUpdated: data.last_updated || null,
    currentPhase: phaseMatch ? phaseMatch[1].trim() : null,
    currentStatus: statusMatch ? statusMatch[1].trim() : null,
  };
}

module.exports = { parseState };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/server/stateParser.test.js`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add server/lib/stateParser.js tests/fixtures/state-sample.md tests/server/stateParser.test.js
git commit -m "feat: add STATE.md parser"
```

---

### Task 6: Progress combiner

**Files:**
- Create: `server/lib/progress.js`
- Test: `tests/server/progress.test.js`

**Interfaces:**
- Consumes: `roadmapParser` output shape (`{phases: [{number,title,status,plans:[{done}]}]}`), `stateParser` output shape (`{status, currentPhase, progress}`) or `null`.
- Produces: `computeProgress(roadmap, state)` → `{ percent: number, currentPhase: string|null, status: string, source: 'state'|'roadmap-fallback' }`

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('computeProgress prefers state.progress.percent when present', () => {
  const { computeProgress } = require('../../server/lib/progress');
  const roadmap = { phases: [{ number: '1', title: 'A', status: 'done', plans: [{ done: true }] }] };
  const state = { status: 'executing', currentPhase: '02', progress: { percent: 89 } };

  const result = computeProgress(roadmap, state);
  assert.equal(result.percent, 89);
  assert.equal(result.currentPhase, '02');
  assert.equal(result.status, 'executing');
  assert.equal(result.source, 'state');
});

test('computeProgress falls back to roadmap checkbox counts when state is null', () => {
  const { computeProgress } = require('../../server/lib/progress');
  const roadmap = {
    phases: [
      { number: '1', title: 'A', status: 'done', plans: [{ done: true }, { done: true }] },
      { number: '2', title: 'B', status: 'pending', plans: [{ done: false }] },
    ],
  };

  const result = computeProgress(roadmap, null);
  assert.equal(result.percent, 67);
  assert.equal(result.currentPhase, 'Phase 2: B');
  assert.equal(result.status, 'unknown');
  assert.equal(result.source, 'roadmap-fallback');
});

test('computeProgress reports completion when all phases are done', () => {
  const { computeProgress } = require('../../server/lib/progress');
  const roadmap = { phases: [{ number: '1', title: 'A', status: 'done', plans: [{ done: true }] }] };

  const result = computeProgress(roadmap, null);
  assert.equal(result.percent, 100);
  assert.equal(result.currentPhase, 'All phases complete');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/progress.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/progress'`

- [ ] **Step 3: Write `server/lib/progress.js`**

```javascript
function inferCurrentPhase(roadmap) {
  if (!roadmap.phases.length) return null;
  const firstIncomplete = roadmap.phases.find((p) => p.status !== 'done');
  return firstIncomplete ? `Phase ${firstIncomplete.number}: ${firstIncomplete.title}` : 'All phases complete';
}

function computeProgress(roadmap, state) {
  if (state && state.progress && typeof state.progress.percent === 'number') {
    return {
      percent: state.progress.percent,
      currentPhase: state.currentPhase || inferCurrentPhase(roadmap),
      status: state.status || 'unknown',
      source: 'state',
    };
  }

  const allPlans = roadmap.phases.flatMap((p) => p.plans);
  const donePlans = allPlans.filter((p) => p.done).length;
  const percent = allPlans.length === 0 ? 0 : Math.round((donePlans / allPlans.length) * 100);

  return {
    percent,
    currentPhase: inferCurrentPhase(roadmap),
    status: 'unknown',
    source: 'roadmap-fallback',
  };
}

module.exports = { computeProgress };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/progress.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/progress.js tests/server/progress.test.js
git commit -m "feat: add progress combiner with roadmap fallback"
```

---

### Task 7: Git milestone detection

**Files:**
- Create: `server/lib/gitMilestone.js`
- Test: `tests/server/gitMilestone.test.js`

**Interfaces:**
- Produces: `getMilestone(repoPath)` → `{ status: 'ok'|'not-a-repo'|'no-remote'|'no-tags', tag?, date?, message?, commitSha? }`

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function run(cwd, args) {
  execFileSync('git', args, { cwd });
}

test('getMilestone reports not-a-repo for a plain directory', () => {
  const { getMilestone } = require('../../server/lib/gitMilestone');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitless-'));
  assert.equal(getMilestone(dir).status, 'not-a-repo');
});

test('getMilestone reports no-remote when there is no upstream', () => {
  const { getMilestone } = require('../../server/lib/gitMilestone');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-'));
  run(dir, ['init', '-q']);
  run(dir, ['config', 'user.email', 'test@example.com']);
  run(dir, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  run(dir, ['add', 'a.txt']);
  run(dir, ['commit', '-q', '-m', 'init']);
  assert.equal(getMilestone(dir).status, 'no-remote');
});

test('getMilestone finds the newest tag reachable from the remote-tracking branch', () => {
  const { getMilestone } = require('../../server/lib/gitMilestone');

  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-'));
  run(remote, ['init', '-q', '--bare']);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'withremote-'));
  run(dir, ['init', '-q', '-b', 'main']);
  run(dir, ['config', 'user.email', 'test@example.com']);
  run(dir, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  run(dir, ['add', 'a.txt']);
  run(dir, ['commit', '-q', '-m', 'first commit']);
  run(dir, ['tag', '-a', 'v1.0.0', '-m', 'first release']);
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
  run(dir, ['add', 'b.txt']);
  run(dir, ['commit', '-q', '-m', 'second commit']);
  run(dir, ['remote', 'add', 'origin', remote]);
  run(dir, ['push', '-q', 'origin', 'main']);
  run(dir, ['branch', '--set-upstream-to=origin/main', 'main']);

  const result = getMilestone(dir);
  assert.equal(result.status, 'ok');
  assert.equal(result.tag, 'v1.0.0');
  assert.equal(result.message, 'first release');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/gitMilestone.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/gitMilestone'`

- [ ] **Step 3: Write `server/lib/gitMilestone.js`**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function git(repoPath, args) {
  return execFileSync('git', args, { cwd: repoPath }).toString().trim();
}

function getMilestone(repoPath) {
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    return { status: 'not-a-repo' };
  }

  let upstream;
  try {
    upstream = git(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  } catch {
    return { status: 'no-remote' };
  }

  let tagLines;
  try {
    tagLines = git(repoPath, [
      'for-each-ref',
      '--sort=-creatordate',
      '--format=%(refname:short)|%(creatordate:iso-strict)|%(contents:subject)|%(objectname)',
      'refs/tags',
    ]);
  } catch {
    tagLines = '';
  }

  if (!tagLines) return { status: 'no-tags' };

  for (const line of tagLines.split('\n').filter(Boolean)) {
    const [tag, date, message, commitSha] = line.split('|');
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', tag, upstream], { cwd: repoPath });
      return { status: 'ok', tag, date, message, commitSha };
    } catch {
      continue;
    }
  }

  return { status: 'no-tags' };
}

module.exports = { getMilestone };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/gitMilestone.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/gitMilestone.js tests/server/gitMilestone.test.js
git commit -m "feat: add local git milestone tag detection"
```

---

### Task 8: Settings module

**Files:**
- Create: `server/lib/settings.js`
- Test: `tests/server/settings.test.js`

**Interfaces:**
- Produces: `loadSettings()` → `{ cliTool, terminalApp, commandTemplates: {claude, codex, gemini} }`, `saveSettings(partial)` → merged settings object (deep-merges `commandTemplates`).

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-settings-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/settings')];
  return require('../../server/lib/settings');
}

test('loadSettings returns defaults when no file exists', () => {
  const settings = freshHome();
  const result = settings.loadSettings();
  assert.equal(result.cliTool, 'claude');
  assert.equal(result.terminalApp, 'Terminal');
  assert.equal(result.commandTemplates.claude, 'claude "/gsd:new-project"');
  assert.equal(result.commandTemplates.codex, 'codex');
});

test('saveSettings merges partial updates and persists them', () => {
  const settings = freshHome();
  settings.saveSettings({ cliTool: 'codex', commandTemplates: { codex: 'codex --resume' } });
  const result = settings.loadSettings();
  assert.equal(result.cliTool, 'codex');
  assert.equal(result.commandTemplates.codex, 'codex --resume');
  assert.equal(result.commandTemplates.claude, 'claude "/gsd:new-project"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/settings.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/settings'`

- [ ] **Step 3: Write `server/lib/settings.js`**

```javascript
const fs = require('node:fs');
const { settingsFile, gsdWebDir } = require('./paths');

const DEFAULTS = {
  cliTool: 'claude',
  terminalApp: 'Terminal',
  commandTemplates: {
    claude: 'claude "/gsd:new-project"',
    codex: 'codex',
    gemini: 'gemini',
  },
};

function ensureDir() {
  fs.mkdirSync(gsdWebDir(), { recursive: true });
}

function loadSettings() {
  ensureDir();
  if (!fs.existsSync(settingsFile())) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  return {
    ...DEFAULTS,
    ...raw,
    commandTemplates: { ...DEFAULTS.commandTemplates, ...(raw.commandTemplates || {}) },
  };
}

function saveSettings(partial) {
  const current = loadSettings();
  const merged = {
    ...current,
    ...partial,
    commandTemplates: { ...current.commandTemplates, ...(partial.commandTemplates || {}) },
  };
  ensureDir();
  fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/settings.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/settings.js tests/server/settings.test.js
git commit -m "feat: add settings module with per-tool command templates"
```

---

### Task 9: Convert-terminal command builder

**Files:**
- Create: `server/lib/convert.js`
- Test: `tests/server/convert.test.js`

**Interfaces:**
- Consumes: `settings` shape from Task 8 (`{cliTool, terminalApp, commandTemplates}`)
- Produces: `buildConvertScript(settings, targetPath)` → osascript script string (pure, testable). `launchConvert(settings, targetPath)` → spawns `osascript -e <script>` (not unit tested — exercised manually).

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('buildConvertScript embeds the cd, the tool command, and the chosen terminal app', () => {
  const { buildConvertScript } = require('../../server/lib/convert');
  const settings = {
    cliTool: 'claude',
    terminalApp: 'Terminal',
    commandTemplates: { claude: 'claude "/gsd:new-project"', codex: 'codex', gemini: 'gemini' },
  };

  const script = buildConvertScript(settings, '/Users/me/my project');

  assert.match(script, /tell application "Terminal" to do script/);
  assert.match(script, /cd \\"\/Users\/me\/my project\\"/);
  assert.match(script, /claude \\\\"\/gsd:new-project\\\\"/);
});

test('buildConvertScript falls back to the claude template if cliTool has no template', () => {
  const { buildConvertScript } = require('../../server/lib/convert');
  const settings = {
    cliTool: 'unknown-tool',
    terminalApp: 'iTerm',
    commandTemplates: { claude: 'claude "/gsd:new-project"' },
  };

  const script = buildConvertScript(settings, '/tmp/x');
  assert.match(script, /claude \\\\"\/gsd:new-project\\\\"/);
  assert.match(script, /tell application "iTerm"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/convert.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/convert'`

- [ ] **Step 3: Write `server/lib/convert.js`**

```javascript
const { execFileSync } = require('node:child_process');

function buildConvertScript(settings, targetPath) {
  const template = settings.commandTemplates[settings.cliTool] || settings.commandTemplates.claude;
  const escapedPath = targetPath.replace(/"/g, '\\"');
  const shellCommand = `cd "${escapedPath}" && ${template}`;
  const forOsascript = shellCommand.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `tell application "${settings.terminalApp}" to do script "${forOsascript}"`;
}

function launchConvert(settings, targetPath) {
  const script = buildConvertScript(settings, targetPath);
  execFileSync('osascript', ['-e', script]);
}

module.exports = { buildConvertScript, launchConvert };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/convert.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/convert.js tests/server/convert.test.js
git commit -m "feat: add convert-to-GSD terminal command builder"
```

---

### Task 10: Live activity store

**Files:**
- Create: `server/lib/activityStore.js`
- Test: `tests/server/activityStore.test.js`

**Interfaces:**
- Consumes: `paths.js` `statusDirFor(absPath)`
- Produces: `listRunning(projectPath)` → `[{ agentType, description, startedAt, sessionId, elapsedMs }]`, filtering out entries older than 2 hours and corrupt JSON files.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-activity-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/activityStore')];
  return { activityStore: require('../../server/lib/activityStore'), paths: require('../../server/lib/paths') };
}

test('listRunning returns an empty array when no status dir exists', () => {
  const { activityStore } = freshHome();
  assert.deepEqual(activityStore.listRunning('/some/project'), []);
});

test('listRunning reads fresh entries and skips stale/corrupt ones', () => {
  const { activityStore, paths } = freshHome();
  const projectPath = '/some/project';
  const dir = paths.statusDirFor(projectPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'fresh.json'),
    JSON.stringify({ agentType: 'gsd-executor', description: 'Plan 01-01', startedAt: new Date().toISOString(), sessionId: 's1' })
  );
  const staleDate = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(
    path.join(dir, 'stale.json'),
    JSON.stringify({ agentType: 'gsd-planner', description: 'old', startedAt: staleDate, sessionId: 's2' })
  );
  fs.writeFileSync(path.join(dir, 'corrupt.json'), '{not json');

  const running = activityStore.listRunning(projectPath);
  assert.equal(running.length, 1);
  assert.equal(running[0].agentType, 'gsd-executor');
  assert.equal(typeof running[0].elapsedMs, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/activityStore.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/activityStore'`

- [ ] **Step 3: Write `server/lib/activityStore.js`**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { statusDirFor } = require('./paths');

const STALE_MS = 2 * 60 * 60 * 1000;

function listRunning(projectPath) {
  const dir = statusDirFor(projectPath);
  if (!fs.existsSync(dir)) return [];

  const now = Date.now();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((entry) => ({ ...entry, elapsedMs: now - new Date(entry.startedAt).getTime() }))
    .filter((entry) => entry.elapsedMs < STALE_MS);
}

module.exports = { listRunning, STALE_MS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/activityStore.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add server/lib/activityStore.js tests/server/activityStore.test.js
git commit -m "feat: add live activity store reading hook status files"
```

---

### Task 11: SSE hub

**Files:**
- Create: `server/lib/sse.js`
- Test: `tests/server/sse.test.js`

**Interfaces:**
- Consumes: `activityStore.listRunning`
- Produces: `createSseHub()` → `{ subscribe(projectId, res, projectPath), unsubscribe(projectId, res), broadcast(projectId) }`. `subscribe` immediately writes the current `listRunning` snapshot as an SSE `data:` event, and registers `res` to receive future broadcasts for that `projectId`. `broadcast(projectId)` re-reads `listRunning` for the tracked project path and writes to every subscribed `res`.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-sse-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../server/lib/activityStore')];
  delete require.cache[require.resolve('../../server/lib/sse')];
  return require('../../server/lib/sse');
}

function fakeRes() {
  const chunks = [];
  return {
    chunks,
    write: (chunk) => chunks.push(chunk),
  };
}

test('subscribe sends an immediate snapshot; broadcast pushes updates to subscribers', () => {
  const { createSseHub } = freshHome();
  const hub = createSseHub();
  const res = fakeRes();

  hub.subscribe('proj-1', res, '/some/project');
  assert.equal(res.chunks.length, 1);
  assert.match(res.chunks[0], /^data: /);

  hub.broadcast('proj-1');
  assert.equal(res.chunks.length, 2);

  hub.unsubscribe('proj-1', res);
  hub.broadcast('proj-1');
  assert.equal(res.chunks.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/sse.test.js`
Expected: FAIL — `Cannot find module '../../server/lib/sse'`

- [ ] **Step 3: Write `server/lib/sse.js`**

```javascript
const { listRunning } = require('./activityStore');

function createSseHub() {
  const subscribers = new Map();
  const projectPaths = new Map();

  function send(res, projectPath) {
    const payload = JSON.stringify(listRunning(projectPath));
    res.write(`data: ${payload}\n\n`);
  }

  function subscribe(projectId, res, projectPath) {
    if (!subscribers.has(projectId)) subscribers.set(projectId, new Set());
    subscribers.get(projectId).add(res);
    projectPaths.set(projectId, projectPath);
    send(res, projectPath);
  }

  function unsubscribe(projectId, res) {
    const set = subscribers.get(projectId);
    if (set) set.delete(res);
  }

  function broadcast(projectId) {
    const set = subscribers.get(projectId);
    const projectPath = projectPaths.get(projectId);
    if (!set || !projectPath) return;
    for (const res of set) send(res, projectPath);
  }

  return { subscribe, unsubscribe, broadcast };
}

module.exports = { createSseHub };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/sse.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add server/lib/sse.js tests/server/sse.test.js
git commit -m "feat: add SSE subscriber hub for live activity push"
```

---

### Task 12: Express routes

**Files:**
- Create: `server/routes/projects.js`
- Create: `server/routes/settingsRoute.js`
- Create: `server/routes/convertRoute.js`
- Modify: `server/app.js`
- Test: `tests/server/app.test.js`

**Interfaces:**
- Consumes: `registry`, `roadmapParser`, `stateParser`, `progress`, `gitMilestone`, `settings`, `convert`, `activityStore`, `sse` (all prior tasks)
- Produces: full `/api/*` surface described in the spec, wired into `createApp()`.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-app-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  for (const mod of ['paths', 'registry', 'settings', 'activityStore', 'sse']) {
    delete require.cache[require.resolve(`../../server/lib/${mod}`)];
  }
  delete require.cache[require.resolve('../../server/app')];
  return require('../../server/app');
}

test('POST /api/projects rejects a non-GSD folder with 409 NOT_GSD_PROJECT, then accepts after adding .planning', async () => {
  const { createApp } = freshHome();
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://localhost:${port}`;

  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'app-test-project-'));

  const rejectRes = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: target }),
  });
  assert.equal(rejectRes.status, 409);
  const rejectBody = await rejectRes.json();
  assert.equal(rejectBody.code, 'NOT_GSD_PROJECT');

  fs.mkdirSync(path.join(target, '.planning'));
  fs.writeFileSync(path.join(target, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phases\n');

  const acceptRes = await fetch(`${base}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: target }),
  });
  assert.equal(acceptRes.status, 201);
  const project = await acceptRes.json();
  assert.equal(project.path, fs.realpathSync(target));

  const listRes = await fetch(`${base}/api/projects`);
  const list = await listRes.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, project.id);

  const roadmapRes = await fetch(`${base}/api/projects/${project.id}/roadmap`);
  assert.equal(roadmapRes.status, 200);
  const roadmap = await roadmapRes.json();
  assert.deepEqual(roadmap.phases, []);

  const gitRes = await fetch(`${base}/api/projects/${project.id}/git`);
  assert.equal(gitRes.status, 200);
  const git = await gitRes.json();
  assert.equal(git.status, 'not-a-repo');

  const deleteRes = await fetch(`${base}/api/projects/${project.id}`, { method: 'DELETE' });
  assert.equal(deleteRes.status, 204);

  server.close();
});

test('GET/PUT /api/settings round-trips a partial update', async () => {
  const { createApp } = freshHome();
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://localhost:${port}`;

  const initial = await (await fetch(`${base}/api/settings`)).json();
  assert.equal(initial.cliTool, 'claude');

  const putRes = await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliTool: 'gemini' }),
  });
  const updated = await putRes.json();
  assert.equal(updated.cliTool, 'gemini');

  server.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/app.test.js`
Expected: FAIL — 404s / missing routes

- [ ] **Step 3: Write `server/routes/projects.js`**

```javascript
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry');
const { parseRoadmap } = require('../lib/roadmapParser');
const { parseState } = require('../lib/stateParser');
const { computeProgress } = require('../lib/progress');
const { getMilestone } = require('../lib/gitMilestone');
const { listRunning } = require('../lib/activityStore');

function readRoadmap(projectPath) {
  const roadmapPath = path.join(projectPath, '.planning', 'ROADMAP.md');
  const roadmapText = fs.existsSync(roadmapPath) ? fs.readFileSync(roadmapPath, 'utf8') : '';
  return parseRoadmap(roadmapText);
}

function readState(projectPath) {
  const statePath = path.join(projectPath, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return null;
  return parseState(fs.readFileSync(statePath, 'utf8'));
}

function createProjectsRouter(sseHub) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const projects = registry.loadProjects().map((project) => {
      const roadmap = readRoadmap(project.path);
      const state = readState(project.path);
      const progress = computeProgress(roadmap, state);
      const git = getMilestone(project.path);
      const runningCount = listRunning(project.path).length;
      return { ...project, progress, git, runningCount };
    });
    res.json(projects);
  });

  router.post('/', (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ code: 'MISSING_PATH' });
    try {
      const project = registry.addProject(targetPath);
      res.status(201).json(project);
    } catch (err) {
      const statusByCode = { PATH_NOT_FOUND: 404, NOT_GSD_PROJECT: 409, ALREADY_ADDED: 409 };
      res.status(statusByCode[err.code] || 500).json({ code: err.code || 'UNKNOWN', message: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    registry.removeProject(req.params.id);
    res.status(204).end();
  });

  router.get('/:id/roadmap', (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: 'NOT_FOUND' });
    res.json(readRoadmap(project.path));
  });

  router.get('/:id/git', (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: 'NOT_FOUND' });
    res.json(getMilestone(project.path));
  });

  router.get('/:id/activity/stream', (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: 'NOT_FOUND' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    sseHub.subscribe(project.id, res, project.path);

    req.on('close', () => sseHub.unsubscribe(project.id, res));
  });

  return router;
}

module.exports = { createProjectsRouter };
```

- [ ] **Step 4: Write `server/routes/settingsRoute.js`**

```javascript
const express = require('express');
const settings = require('../lib/settings');

function createSettingsRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(settings.loadSettings());
  });

  router.put('/', (req, res) => {
    res.json(settings.saveSettings(req.body || {}));
  });

  return router;
}

module.exports = { createSettingsRouter };
```

- [ ] **Step 5: Write `server/routes/convertRoute.js`**

```javascript
const express = require('express');
const settings = require('../lib/settings');
const { launchConvert } = require('../lib/convert');

function createConvertRouter() {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ code: 'MISSING_PATH' });
    try {
      launchConvert(settings.loadSettings(), targetPath);
      res.status(202).json({ launched: true });
    } catch (err) {
      res.status(500).json({ code: 'LAUNCH_FAILED', message: err.message });
    }
  });

  return router;
}

module.exports = { createConvertRouter };
```

- [ ] **Step 6: Update `server/app.js`**

```javascript
const express = require('express');
const { createSseHub } = require('./lib/sse');
const { createProjectsRouter } = require('./routes/projects');
const { createSettingsRouter } = require('./routes/settingsRoute');
const { createConvertRouter } = require('./routes/convertRoute');

function createApp() {
  const app = express();
  app.use(express.json());

  const sseHub = createSseHub();

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/projects', createProjectsRouter(sseHub));
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/convert', createConvertRouter());

  return app;
}

module.exports = { createApp };
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/server/app.test.js`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add server/app.js server/routes tests/server/app.test.js
git commit -m "feat: wire projects/settings/convert routes into the express app"
```

---

### Task 13: Claude Code hook script

**Files:**
- Create: `hooks/gsd-web-hook.js`
- Test: `tests/hooks/gsd-web-hook.test.js`

**Interfaces:**
- Consumes: `server/lib/paths.js` (`statusDirFor`, `statusRootDir`)
- Produces: `handle(input)` (exported for testing) implementing `PreToolUse`/`PostToolUse`/`Stop` for `tool_name === 'Task'`. A `require.main === module` block reads JSON from stdin and calls `handle`, always exiting 0.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-web-hook-'));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve('../../server/lib/paths')];
  delete require.cache[require.resolve('../../hooks/gsd-web-hook')];
  return { hook: require('../../hooks/gsd-web-hook'), paths: require('../../server/lib/paths') };
}

test('PreToolUse for a Task writes a status file; PostToolUse removes it', () => {
  const { hook, paths } = freshHome();
  const cwd = '/some/project';

  hook.handle({
    hook_event_name: 'PreToolUse',
    tool_name: 'Task',
    tool_use_id: 'tool-1',
    cwd,
    session_id: 'sess-1',
    tool_input: { subagent_type: 'gsd-executor', description: 'Plan 01-01 scaffold' },
  });

  const dir = paths.statusDirFor(cwd);
  const file = path.join(dir, 'tool-1.json');
  assert.equal(fs.existsSync(file), true);
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(payload.agentType, 'gsd-executor');
  assert.equal(payload.description, 'Plan 01-01 scaffold');
  assert.equal(payload.sessionId, 'sess-1');

  hook.handle({ hook_event_name: 'PostToolUse', tool_name: 'Task', tool_use_id: 'tool-1', cwd });
  assert.equal(fs.existsSync(file), false);
});

test('Stop cleans up any leftover files for that session across all projects', () => {
  const { hook, paths } = freshHome();
  const cwdA = '/project/a';
  const cwdB = '/project/b';

  hook.handle({
    hook_event_name: 'PreToolUse',
    tool_name: 'Task',
    tool_use_id: 'tool-a',
    cwd: cwdA,
    session_id: 'sess-x',
    tool_input: { subagent_type: 'gsd-executor', description: 'a' },
  });
  hook.handle({
    hook_event_name: 'PreToolUse',
    tool_name: 'Task',
    tool_use_id: 'tool-b',
    cwd: cwdB,
    session_id: 'sess-x',
    tool_input: { subagent_type: 'gsd-planner', description: 'b' },
  });

  hook.handle({ hook_event_name: 'Stop', session_id: 'sess-x' });

  assert.equal(fs.existsSync(path.join(paths.statusDirFor(cwdA), 'tool-a.json')), false);
  assert.equal(fs.existsSync(path.join(paths.statusDirFor(cwdB), 'tool-b.json')), false);
});

test('handle never throws on malformed input', () => {
  const { hook } = freshHome();
  assert.doesNotThrow(() => hook.handle({}));
  assert.doesNotThrow(() => hook.handle({ hook_event_name: 'PreToolUse', tool_name: 'Task' }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/hooks/gsd-web-hook.test.js`
Expected: FAIL — `Cannot find module '../../hooks/gsd-web-hook'`

- [ ] **Step 3: Write `hooks/gsd-web-hook.js`**

```javascript
const fs = require('node:fs');
const path = require('node:path');
const { statusDirFor, statusRootDir } = require('../server/lib/paths');

function handleTaskStart(input) {
  const cwd = input.cwd || process.cwd();
  const dir = statusDirFor(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${input.tool_use_id}.json`);
  const toolInput = input.tool_input || {};
  const payload = {
    agentType: toolInput.subagent_type || 'unknown',
    description: toolInput.description || '',
    startedAt: new Date().toISOString(),
    sessionId: input.session_id,
  };
  fs.writeFileSync(file, JSON.stringify(payload));
}

function handleTaskEnd(input) {
  const cwd = input.cwd || process.cwd();
  const file = path.join(statusDirFor(cwd), `${input.tool_use_id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function handleStop(input) {
  const root = statusRootDir();
  if (!fs.existsSync(root)) return;
  for (const projectHashDir of fs.readdirSync(root)) {
    const dirPath = path.join(root, projectHashDir);
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (data.sessionId === input.session_id) fs.unlinkSync(fullPath);
      } catch {
        continue;
      }
    }
  }
}

function handle(input) {
  try {
    if (!input || !input.hook_event_name) return;
    if (input.hook_event_name === 'PreToolUse' && input.tool_name === 'Task' && input.tool_use_id) {
      handleTaskStart(input);
    } else if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Task' && input.tool_use_id) {
      handleTaskEnd(input);
    } else if (input.hook_event_name === 'Stop') {
      handleStop(input);
    }
  } catch {
    // Hook failures must never surface to the user's Claude Code session.
  }
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    try {
      handle(JSON.parse(raw));
    } catch {
      // ignore malformed stdin
    }
    process.exit(0);
  });
}

module.exports = { handle };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/hooks/gsd-web-hook.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/gsd-web-hook.js tests/hooks/gsd-web-hook.test.js
git commit -m "feat: add Claude Code hook for live subagent status tracking"
```

---

### Task 14: Hook installer script

**Files:**
- Create: `scripts/install-hook.js`
- Test: `tests/scripts/install-hook.test.js`

**Interfaces:**
- Produces: `mergeHookConfig(existingSettings, hookScriptPath)` (pure function, exported for testing) → new settings object with `PreToolUse`/`PostToolUse`/`Stop` hook entries for `hookScriptPath` added idempotently (no duplicates on repeated calls). A `require.main === module` block reads `~/.claude/settings.json` (or `{}` if absent), backs it up to `settings.json.bak-<timestamp>`, merges, and writes it back — this block is not covered by automated tests since it touches the real home directory; it is only exercised by the user manually running `npm run install-hook`.

- [ ] **Step 1: Write the failing test**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

test('mergeHookConfig adds PreToolUse/PostToolUse/Stop hook entries', () => {
  const { mergeHookConfig } = require('../../scripts/install-hook');
  const result = mergeHookConfig({}, '/path/to/gsd-web-hook.js');

  assert.equal(result.hooks.PreToolUse.length, 1);
  assert.equal(result.hooks.PreToolUse[0].matcher, 'Task');
  assert.equal(result.hooks.PreToolUse[0].hooks[0].command, 'node /path/to/gsd-web-hook.js');
  assert.equal(result.hooks.PostToolUse.length, 1);
  assert.equal(result.hooks.Stop.length, 1);
});

test('mergeHookConfig is idempotent and preserves unrelated existing hooks', () => {
  const { mergeHookConfig } = require('../../scripts/install-hook');
  const existing = {
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }],
    },
  };

  const once = mergeHookConfig(existing, '/path/to/gsd-web-hook.js');
  const twice = mergeHookConfig(once, '/path/to/gsd-web-hook.js');

  assert.equal(twice.hooks.PreToolUse.length, 2);
  assert.deepEqual(twice, once);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scripts/install-hook.test.js`
Expected: FAIL — `Cannot find module '../../scripts/install-hook'`

- [ ] **Step 3: Write `scripts/install-hook.js`**

```javascript
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function hookEntry(hookScriptPath) {
  return { matcher: 'Task', hooks: [{ type: 'command', command: `node ${hookScriptPath}` }] };
}

function stopHookEntry(hookScriptPath) {
  return { hooks: [{ type: 'command', command: `node ${hookScriptPath}` }] };
}

function hasEntry(list, command) {
  return list.some((entry) => (entry.hooks || []).some((h) => h.command === command));
}

function mergeHookConfig(existing, hookScriptPath) {
  const settings = JSON.parse(JSON.stringify(existing || {}));
  settings.hooks = settings.hooks || {};

  const command = `node ${hookScriptPath}`;

  settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
  if (!hasEntry(settings.hooks.PreToolUse, command)) {
    settings.hooks.PreToolUse.push(hookEntry(hookScriptPath));
  }

  settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];
  if (!hasEntry(settings.hooks.PostToolUse, command)) {
    settings.hooks.PostToolUse.push(hookEntry(hookScriptPath));
  }

  settings.hooks.Stop = settings.hooks.Stop || [];
  if (!hasEntry(settings.hooks.Stop, command)) {
    settings.hooks.Stop.push(stopHookEntry(hookScriptPath));
  }

  return settings;
}

if (require.main === module) {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const hookScriptPath = path.join(__dirname, '..', 'hooks', 'gsd-web-hook.js');

  const existing = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};

  if (fs.existsSync(settingsPath)) {
    const backupPath = `${settingsPath}.bak-${Date.now()}`;
    fs.copyFileSync(settingsPath, backupPath);
    console.log(`Backed up existing settings to ${backupPath}`);
  }

  const merged = mergeHookConfig(existing, hookScriptPath);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
  console.log(`Installed gsd-web hooks into ${settingsPath}`);
}

module.exports = { mergeHookConfig };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scripts/install-hook.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/install-hook.js tests/scripts/install-hook.test.js
git commit -m "feat: add idempotent hook installer script (user-run only)"
```

---

### Task 15: Frontend scaffold + API client

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.js`
- Create: `web/index.html`
- Create: `web/src/main.jsx`
- Create: `web/src/App.jsx`
- Create: `web/src/api.js`

**Interfaces:**
- Produces: `api.js` exports `listProjects()`, `addProject(path)`, `removeProject(id)`, `getRoadmap(id)`, `getGit(id)`, `subscribeActivity(id, onUpdate)` (wraps `EventSource`, returns an unsubscribe function), `getSettings()`, `saveSettings(partial)`, `convertProject(path)`.

- [ ] **Step 1: Write `web/package.json`**

```json
{
  "name": "gsd-web-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write `web/vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4317',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Write `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>GSD Run Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write `web/src/api.js`**

```javascript
async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Request to ${path} failed with ${res.status}`);
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listProjects() {
  return request('/projects');
}

export function addProject(path) {
  return request('/projects', { method: 'POST', body: JSON.stringify({ path }) });
}

export function removeProject(id) {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

export function getRoadmap(id) {
  return request(`/projects/${id}/roadmap`);
}

export function getGit(id) {
  return request(`/projects/${id}/git`);
}

export function subscribeActivity(id, onUpdate) {
  const source = new EventSource(`/api/projects/${id}/activity/stream`);
  source.onmessage = (event) => onUpdate(JSON.parse(event.data));
  return () => source.close();
}

export function getSettings() {
  return request('/settings');
}

export function saveSettings(partial) {
  return request('/settings', { method: 'PUT', body: JSON.stringify(partial) });
}

export function convertProject(path) {
  return request('/convert', { method: 'POST', body: JSON.stringify({ path }) });
}
```

- [ ] **Step 5: Write `web/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <Link to="/">Dashboard</Link> | <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Write `web/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Install and verify the dev server boots (placeholder pages come in the next tasks)**

Run: `mkdir -p web/src/pages web/src/components`
Run: `printf 'export default function Dashboard(){return <div>Dashboard placeholder</div>;}\n' > web/src/pages/Dashboard.jsx`
Run: `printf 'export default function ProjectDetail(){return <div>Detail placeholder</div>;}\n' > web/src/pages/ProjectDetail.jsx`
Run: `printf 'export default function SettingsPage(){return <div>Settings placeholder</div>;}\n' > web/src/pages/SettingsPage.jsx`
Run: `cd web && npm install && cd ..`
Run: `npm run dev:web &` then open `http://localhost:5173` in a browser
Expected: page loads showing "Dashboard placeholder" and the nav links; stop the dev server afterward (`kill %1`).

- [ ] **Step 8: Commit**

```bash
git add web/package.json web/package-lock.json web/vite.config.js web/index.html web/src
git commit -m "feat: scaffold vite/react frontend with api client and routing"
```

---

### Task 16: Dashboard page + Add Project flow

**Files:**
- Modify: `web/src/pages/Dashboard.jsx`
- Create: `web/src/components/ProjectCard.jsx`
- Create: `web/src/components/AddProjectDialog.jsx`

**Interfaces:**
- Consumes: `api.js` (`listProjects`, `addProject`, `removeProject`, `convertProject`)
- Produces: `Dashboard` renders a card grid and the add-project flow, including the convert offer when `addProject` rejects with `code === 'NOT_GSD_PROJECT'`.

- [ ] **Step 1: Write `web/src/components/ProjectCard.jsx`**

```jsx
import { Link } from 'react-router-dom';

export default function ProjectCard({ project, onRemove }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
      <h3>
        <Link to={`/project/${project.id}`}>{project.name}</Link>
      </h3>
      <div>Progress: {project.progress.percent}%</div>
      <div>Current phase: {project.progress.currentPhase || 'n/a'}</div>
      <div>
        Milestone:{' '}
        {project.git.status === 'ok'
          ? `${project.git.tag} (${project.git.message})`
          : project.git.status.replace(/-/g, ' ')}
      </div>
      {project.runningCount > 0 && <div>{project.runningCount} agent(s) running</div>}
      <button onClick={() => onRemove(project.id)}>Remove</button>
    </div>
  );
}
```

- [ ] **Step 2: Write `web/src/components/AddProjectDialog.jsx`**

```jsx
import { useState } from 'react';
import { addProject, convertProject } from '../api';

export default function AddProjectDialog({ onAdded }) {
  const [path, setPath] = useState('');
  const [notGsd, setNotGsd] = useState(false);
  const [error, setError] = useState(null);

  async function handleAdd() {
    setError(null);
    setNotGsd(false);
    try {
      await addProject(path);
      setPath('');
      onAdded();
    } catch (err) {
      if (err.code === 'NOT_GSD_PROJECT') {
        setNotGsd(true);
      } else {
        setError(err.message);
      }
    }
  }

  async function handleConvert() {
    await convertProject(path);
    setNotGsd(false);
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <input
        type="text"
        placeholder="/absolute/path/to/project"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />
      <button onClick={handleAdd}>Add Project</button>
      {notGsd && (
        <div>
          <p>That folder isn't a GSD project yet.</p>
          <button onClick={handleConvert}>Convert to GSD project</button>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Write `web/src/pages/Dashboard.jsx`**

```jsx
import { useEffect, useState, useCallback } from 'react';
import { listProjects, removeProject } from '../api';
import ProjectCard from '../components/ProjectCard';
import AddProjectDialog from '../components/AddProjectDialog';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);

  const refresh = useCallback(() => {
    listProjects().then(setProjects);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRemove(id) {
    await removeProject(id);
    refresh();
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>GSD Projects</h1>
      <AddProjectDialog onAdded={refresh} />
      {projects.length === 0 ? (
        <p>No projects yet. Add one above.</p>
      ) : (
        projects.map((project) => <ProjectCard key={project.id} project={project} onRemove={handleRemove} />)
      )}
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev` (starts both server and vite dev server)
Open `http://localhost:5173`, use "Add Project" with the path to this `geezo` repo itself — it should show "Convert to GSD project" (since it has no `.planning/` yet). Then add a real GSD project path (e.g. `/Users/matthew/Code/puppet-specdd`) and confirm a card renders with progress %, current phase, and milestone tag.
Stop the dev servers afterward (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Dashboard.jsx web/src/components/ProjectCard.jsx web/src/components/AddProjectDialog.jsx
git commit -m "feat: add dashboard page with project cards and add/convert flow"
```

---

### Task 17: Project detail page — roadmap + git panel

**Files:**
- Modify: `web/src/pages/ProjectDetail.jsx`
- Create: `web/src/components/RoadmapTree.jsx`
- Create: `web/src/components/GitMilestonePanel.jsx`

**Interfaces:**
- Consumes: `api.js` (`getRoadmap`, `getGit`)
- Produces: `RoadmapTree` renders collapsible phases with plan checkboxes; `GitMilestonePanel` renders the milestone or an appropriate empty state.

- [ ] **Step 1: Write `web/src/components/RoadmapTree.jsx`**

```jsx
import { useState } from 'react';

function Phase({ phase }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
        {phase.status === 'done' ? '[x]' : '[ ]'} Phase {phase.number}: {phase.title}
      </div>
      {open && (
        <div style={{ paddingLeft: '1.5rem' }}>
          <p>{phase.goal}</p>
          <ul>
            {phase.plans.map((plan) => (
              <li key={plan.id}>
                {plan.done ? '[x]' : '[ ]'} {plan.id}: {plan.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function RoadmapTree({ roadmap }) {
  if (!roadmap || roadmap.phases.length === 0) return <p>No roadmap data found.</p>;
  return (
    <div>
      {roadmap.phases.map((phase) => (
        <Phase key={phase.number} phase={phase} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `web/src/components/GitMilestonePanel.jsx`**

```jsx
const MESSAGES = {
  'not-a-repo': 'Not a git repository.',
  'no-remote': 'No remote configured.',
  'no-tags': 'No tags pushed yet.',
};

export default function GitMilestonePanel({ git }) {
  if (!git) return null;
  if (git.status !== 'ok') {
    return <p>{MESSAGES[git.status] || 'Unknown git state.'}</p>;
  }
  return (
    <div>
      <strong>{git.tag}</strong> — {git.message}
      <div>{git.date}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write `web/src/pages/ProjectDetail.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRoadmap, getGit } from '../api';
import RoadmapTree from '../components/RoadmapTree';
import GitMilestonePanel from '../components/GitMilestonePanel';
import RunningNowPanel from '../components/RunningNowPanel';

export default function ProjectDetail() {
  const { id } = useParams();
  const [roadmap, setRoadmap] = useState(null);
  const [git, setGit] = useState(null);

  useEffect(() => {
    getRoadmap(id).then(setRoadmap);
    getGit(id).then(setGit);
  }, [id]);

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Project Detail</h1>
      <section>
        <h2>Running Now</h2>
        <RunningNowPanel projectId={id} />
      </section>
      <section>
        <h2>Milestone</h2>
        <GitMilestonePanel git={git} />
      </section>
      <section>
        <h2>Roadmap</h2>
        <RoadmapTree roadmap={roadmap} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:5173/project/<id>` for a registered project (get the id from the dashboard link).
Confirm the roadmap section lists phases with correct done/pending markers matching the project's real `ROADMAP.md`, and the milestone section shows a real tag or the correct empty-state message.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/ProjectDetail.jsx web/src/components/RoadmapTree.jsx web/src/components/GitMilestonePanel.jsx
git commit -m "feat: add project detail page with roadmap tree and git panel"
```

---

### Task 18: Running Now panel (live SSE)

**Files:**
- Create: `web/src/components/RunningNowPanel.jsx`

**Interfaces:**
- Consumes: `api.js` `subscribeActivity(id, onUpdate)`
- Produces: `RunningNowPanel` renders the live list of running agents or an idle state, updating without a page reload as SSE events arrive.

- [ ] **Step 1: Write `web/src/components/RunningNowPanel.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { subscribeActivity } from '../api';

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export default function RunningNowPanel({ projectId }) {
  const [running, setRunning] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeActivity(projectId, setRunning);
    return unsubscribe;
  }, [projectId]);

  if (running.length === 0) return <p>Idle — no subagents currently running.</p>;

  return (
    <ul>
      {running.map((agent) => (
        <li key={`${agent.agentType}-${agent.startedAt}`}>
          <strong>{agent.agentType}</strong>: {agent.description} ({formatElapsed(agent.elapsedMs)})
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running and a project detail page open, manually simulate a running agent by creating a status file for that project (find the project hash by running `node -e "console.log(require('./server/lib/paths').projectHash('/absolute/path/to/project'))"`, then `mkdir -p ~/.claude/gsd-web/status/<hash> && echo '{"agentType":"gsd-executor","description":"manual test","startedAt":"'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'","sessionId":"manual"}' > ~/.claude/gsd-web/status/<hash>/manual.json`).
Confirm the "Running Now" panel updates within a couple seconds without a page reload. Delete the file and confirm it reverts to the idle state.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/RunningNowPanel.jsx
git commit -m "feat: add live Running Now panel driven by SSE"
```

---

### Task 19: Settings page

**Files:**
- Modify: `web/src/pages/SettingsPage.jsx`

**Interfaces:**
- Consumes: `api.js` (`getSettings`, `saveSettings`)

- [ ] **Step 1: Write `web/src/pages/SettingsPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <p>Loading…</p>;

  function updateTemplate(tool, value) {
    setSettings({ ...settings, commandTemplates: { ...settings.commandTemplates, [tool]: value } });
  }

  async function handleSave() {
    const updated = await saveSettings(settings);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Settings</h1>
      <label>
        CLI tool:
        <select value={settings.cliTool} onChange={(e) => setSettings({ ...settings, cliTool: e.target.value })}>
          <option value="claude">claude</option>
          <option value="codex">codex</option>
          <option value="gemini">gemini</option>
        </select>
      </label>
      <br />
      <label>
        Terminal app:
        <select
          value={settings.terminalApp}
          onChange={(e) => setSettings({ ...settings, terminalApp: e.target.value })}
        >
          <option value="Terminal">Terminal</option>
          <option value="iTerm">iTerm</option>
        </select>
      </label>
      <h2>Convert command templates</h2>
      {['claude', 'codex', 'gemini'].map((tool) => (
        <div key={tool}>
          <label>
            {tool}:
            <input
              type="text"
              value={settings.commandTemplates[tool]}
              onChange={(e) => updateTemplate(tool, e.target.value)}
              style={{ width: '20rem' }}
            />
          </label>
        </div>
      ))}
      <button onClick={handleSave}>Save</button>
      {saved && <span> Saved.</span>}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `http://localhost:5173/settings`, change the CLI tool and a command template, click Save, reload the page, confirm the changes persisted (reflecting `~/.claude/gsd-web/settings.json` contents).

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/SettingsPage.jsx
git commit -m "feat: add settings page for CLI tool and convert command templates"
```

---

### Task 20: Production build wiring + README + final smoke test

**Files:**
- Modify: `server/app.js`
- Create: `README.md`

**Interfaces:**
- Produces: in production (`npm start`), `createApp()` serves the built `web/dist` static assets and falls back to `index.html` for client-side routes not matching `/api`.

- [ ] **Step 1: Update `server/app.js` to serve the built frontend**

```javascript
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { createSseHub } = require('./lib/sse');
const { createProjectsRouter } = require('./routes/projects');
const { createSettingsRouter } = require('./routes/settingsRoute');
const { createConvertRouter } = require('./routes/convertRoute');

function createApp() {
  const app = express();
  app.use(express.json());

  const sseHub = createSseHub();

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/projects', createProjectsRouter(sseHub));
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/convert', createConvertRouter());

  const distDir = path.join(__dirname, '..', 'web', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
```

- [ ] **Step 2: Run the full backend test suite to confirm nothing regressed**

Run: `npm test`
Expected: all tests across `tests/server`, `tests/hooks`, `tests/scripts` PASS

- [ ] **Step 3: Write `README.md`**

```markdown
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
```

- [ ] **Step 4: Full manual smoke test**

Run: `npm run install-hook` (installs the hook into your real `~/.claude/settings.json`)
Run: `npm start`
Open `http://localhost:4317`, add a real GSD project (e.g. `/Users/matthew/Code/puppet-specdd`), confirm roadmap/progress/milestone render.
In a separate terminal, `cd` into that same project and run any GSD command that spawns a subagent (e.g. `/gsd:progress` or similar). While it runs, confirm the dashboard's "Running Now" panel for that project updates live with the subagent type and description, and clears when it finishes.
Add this `geezo` folder itself (no `.planning/` yet) and confirm the "Convert to GSD project" flow opens a terminal running the configured `claude "/gsd:new-project"` command.

- [ ] **Step 5: Commit**

```bash
git add server/app.js README.md
git commit -m "feat: serve production frontend build and document setup/usage"
```
