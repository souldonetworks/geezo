const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-web-app-"));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  for (const mod of ["paths", "registry", "settings", "activityStore", "sse"]) {
    delete require.cache[require.resolve(`../../server/lib/${mod}`)];
  }
  delete require.cache[require.resolve("../../server/app")];
  return require("../../server/app");
}

test("ordinary projects register and remain trackable without GSD", async (t) => {
  const { createApp } = freshHome();
  const app = createApp({ discovery: false });
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "ordinary-project-"));
  const response = await fetch(`${base}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: target }),
  });
  assert.equal(response.status, 201);
  const project = await response.json();
  let list = await (await fetch(`${base}/api/projects`)).json();
  assert.equal(list[0].gsdFormat, "none");
  assert.equal(list[0].progress, null);
  fs.rmdirSync(target);
  list = await (await fetch(`${base}/api/projects`)).json();
  assert.equal(list[0].availability, "unavailable");
  assert.equal(list[0].id, project.id);
});

test("GET /api/projects/scan lists a parent directory's subfolders with GSD/registered status", async () => {
  const { createApp } = freshHome();
  const app = createApp({ discovery: false });
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://localhost:${port}`;

  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "scan-route-parent-"));
  const gsdProject = path.join(parent, "has-gsd");
  fs.mkdirSync(path.join(gsdProject, ".planning"), { recursive: true });
  fs.writeFileSync(
    path.join(gsdProject, ".planning", "ROADMAP.md"),
    "# Roadmap",
  );
  fs.mkdirSync(path.join(parent, "no-gsd"));

  const missingRes = await fetch(`${base}/api/projects/scan`);
  assert.equal(missingRes.status, 400);

  const notFoundRes = await fetch(
    `${base}/api/projects/scan?path=${encodeURIComponent("/no/such/dir")}`,
  );
  assert.equal(notFoundRes.status, 404);

  const okRes = await fetch(
    `${base}/api/projects/scan?path=${encodeURIComponent(parent)}`,
  );
  assert.equal(okRes.status, 200);
  const results = await okRes.json();
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));
  assert.equal(byName["has-gsd"].isGsdProject, true);
  assert.equal(byName["no-gsd"].isGsdProject, false);

  server.close();
});

test("GET/PUT /api/settings round-trips a partial update", async () => {
  const { createApp } = freshHome();
  const app = createApp({ discovery: false });
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://localhost:${port}`;

  const initial = await (await fetch(`${base}/api/settings`)).json();
  assert.equal(initial.cliTool, "claude");

  const putRes = await fetch(`${base}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliTool: "gemini" }),
  });
  const updated = await putRes.json();
  assert.equal(updated.cliTool, "gemini");

  server.close();
});

test("API supports ordinary discovery, evidence-linked review, acceptance, export and reversible GSD adoption", async (t) => {
  const { createApp } = freshHome();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-flow-"));
  const target = path.join(root, "existing");
  fs.mkdirSync(target);
  fs.writeFileSync(
    path.join(target, "README.md"),
    "# Existing project\nA small experiment.",
  );
  require("../../server/lib/settings").saveSettings({
    portfolio: { roots: [root] },
  });
  const app = createApp({ discovery: false });
  const server = app.listen(0);
  t.after(() => {
    app.locals.close();
    server.close();
  });
  const base = `http://localhost:${server.address().port}`;
  async function api(route, body) {
    const res = await fetch(base + route, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.ok(
      res.ok,
      `${route}: ${res.status} ${await (res.ok ? Promise.resolve("") : res.text())}`,
    );
    return res.headers.get("content-type")?.includes("json")
      ? res.json()
      : res.text();
  }
  const discovered = await api("/api/projects/discover", {});
  assert.equal(discovered.projects.length, 1);
  const project = discovered.projects[0];
  const prefix = `/api/projects/${project.id}`;
  const evidence = require("../../server/lib/evidence").saveEvidence(
    project.id,
    require("../../server/lib/evidence").collectEvidence(target),
  );
  const brief = {
    purpose: "experiment",
    opportunities: [],
    recommendation: {
      decision: "Explore",
      claims: [
        {
          text: "Validate the experiment before investing.",
          status: "proposed",
          evidenceRefs: [],
        },
      ],
    },
    customerPromise: [
      {
        text: "A small experiment.",
        status: "confirmed",
        evidenceRefs: ["README.md:2"],
      },
    ],
    whyNow: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    valueModel: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    delivery: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    executiveAsk: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    unansweredQuestions: [
      {
        text: "Investigator unknown; next step is to review existing evidence.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
  };
  const draft = require("../../server/lib/briefStore").createRevision(
    project.id,
    { brief, source: "analysis", evidenceId: evidence.id, evidence },
  );
  const revision = await api(prefix + "/brief", {
    brief: { ...brief, purpose: "personal" },
    parentRevision: draft.id,
  });
  await api(prefix + "/brief/accept", {
    revisionId: revision.id,
    expectedAcceptedRevision: null,
  });
  const exported = await api(prefix + "/brief/export");
  assert.match(exported, /Explore/);
  assert.match(exported, /confirmed/);
  const proposal = await api(prefix + "/migrations", {});
  const applied = await api(prefix + `/migrations/${proposal.id}/apply`, {
    expectedFingerprint: proposal.sourceFingerprint,
  });
  assert.equal(applied.status, "completed");
  const roadmap = await api(prefix + "/roadmap");
  assert.equal(roadmap.phases.length, 1);
  await api(prefix + `/migrations/${proposal.id}/rollback`, {});
  assert.equal(
    fs.existsSync(path.join(target, ".planning", "ROADMAP.md")),
    false,
  );
  assert.equal(
    fs.readFileSync(path.join(target, "README.md"), "utf8"),
    "# Existing project\nA small experiment.",
  );
  const denied = await fetch(base + prefix + "/analysis", {
    method: "POST",
    headers: {
      Origin: "https://external.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(denied.status, 403);
});

test("a malformed GSD database cannot hide the rest of the portfolio", async (t) => {
  const { createApp } = freshHome();
  const app = createApp({ discovery: false });
  const server = app.listen(0);
  t.after(() => {
    app.locals.close();
    server.close();
  });
  const registry = require("../../server/lib/registry");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bad-database-"));
  fs.mkdirSync(path.join(root, ".gsd"));
  fs.writeFileSync(path.join(root, ".gsd", "gsd.db"), "not sqlite");
  const broken = registry.addProject(root);
  const normal = fs.mkdtempSync(path.join(os.tmpdir(), "normal-project-"));
  const healthy = registry.addProject(normal);
  const response = await fetch(
    `http://localhost:${server.address().port}/api/projects`,
  );
  assert.equal(response.status, 200);
  const projects = await response.json();
  assert.equal(projects.length, 2);
  assert.ok(projects.find((p) => p.id === broken.id).inspectionError);
  assert.equal(projects.find((p) => p.id === healthy.id).gsdFormat, "none");
});

test("briefing register exposes imported research as a draft with original provenance", async (t) => {
  const { createApp } = freshHome();
  const app = createApp({ discovery: false });
  const server = app.listen(0);
  t.after(() => {
    app.locals.close();
    server.close();
  });
  const base = `http://localhost:${server.address().port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "briefing-import-api-"));
  fs.mkdirSync(path.join(root, ".planning", "research"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".planning", "research", "ASSESSMENT.md"),
    "# Existing Project Assessment\n\n**Project:** Example\n**Recommendation:** Validate a bounded experiment.\n\n## Executive verdict\n\nReal deployment is unverified.\n",
  );
  const p = require("../../server/lib/registry").addProject(root);
  let list = await (await fetch(base + "/api/briefings")).json();
  assert.equal(list[0].importAvailable, true);
  assert.equal(list[0].brief, null);
  const response = await fetch(`${base}/api/projects/${p.id}/brief/import`, {
    method: "POST",
  });
  assert.equal(response.status, 200);
  const imported = await response.json();
  list = await (await fetch(base + "/api/briefings")).json();
  assert.equal(list[0].draftSource, "import");
  assert.equal(list[0].hasPendingDraft, true);
  assert.equal(list[0].brief.acceptedRevision, null);
  const record = await (
    await fetch(`${base}/api/projects/${p.id}/brief`)
  ).json();
  assert.equal(record.revisions[0].provenance.originalProject, "Example");
  assert.equal(record.revisions[0].id, imported.revision.id);
  const store = require("../../server/lib/briefStore");
  const v2 = store.createRevision(p.id, {
    brief: record.revisions[0].brief,
    source: "analysis",
    parentRevision: imported.revision.id,
    evidenceId: record.revisions[0].evidenceId,
    promptVersion: "executive-review-v1+assessment-v2",
  });
  const edit = await fetch(`${base}/api/projects/${p.id}/brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brief: v2.brief,
      parentRevision: v2.id,
      expectedHead: v2.id,
    }),
  });
  assert.equal(edit.status, 201);
  assert.equal(
    (await edit.json()).promptVersion,
    "executive-review-v1+assessment-v2",
  );
});

test("personal/work and tags round-trip through API and support explained related search", async (t) => {
  const { createApp } = freshHome();
  const app = createApp({ discovery: false });
  const server = app.listen(0);
  t.after(() => {
    app.locals.close();
    server.close();
  });
  const base = `http://localhost:${server.address().port}`;
  const registry = require("../../server/lib/registry");
  const p = registry.addProject(
    fs.mkdtempSync(path.join(os.tmpdir(), "metadata-api-")),
  );
  const saved = await fetch(`${base}/api/projects/${p.id}/metadata`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "work",
      tags: ["Puppet", "MCP"],
      expectedVersion: 0,
    }),
  });
  assert.equal(saved.status, 200);
  const metadata = await saved.json();
  assert.equal(metadata.category, "work");
  assert.deepEqual(metadata.tags, ["puppet", "mcp"]);
  const briefings = await (await fetch(base + "/api/briefings")).json();
  assert.equal(briefings[0].category, "work");
  assert.deepEqual(briefings[0].allTags, ["puppet", "mcp"]);
  const related = await (
    await fetch(base + "/api/related?q=puppet&category=work")
  ).json();
  assert.equal(related[0].id, p.id);
  assert.deepEqual(related[0].matchedTags, ["puppet"]);
  const conflict = await fetch(`${base}/api/projects/${p.id}/metadata`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "personal", expectedVersion: 0 }),
  });
  assert.equal(conflict.status, 409);
});
