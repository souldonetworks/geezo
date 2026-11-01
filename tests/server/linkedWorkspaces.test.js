const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
async function setup() {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "workspace-home-"),
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-root-"));
  const projectRoot = path.join(root, "Projects");
  fs.mkdirSync(projectRoot);
  require("../../server/lib/settings").saveSettings({
    allIn: { workspaceRoot: projectRoot },
  });
  const registry = require("../../server/lib/registry");
  const projects = ["first", "second"].map((name) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "source.txt"), "Original source");
    return registry.addProject(dir);
  });
  const output = {
    summary: "A possible combined tool",
    gaps: ["Demand unknown"],
    recommendations: [
      {
        type: "combine",
        projectIds: projects.map((p) => p.id),
        workingName: "Shared Widget",
        description:
          "A proposed widget connecting two existing tools; integration not implemented.",
        audience: "Unknown",
        problem: "Hypothesis",
        value: "Proposed utility",
        confidence: "proposed",
        reasons: ["Complementary scope"],
        risks: ["Unknown ownership"],
        steps: ["Inspect interfaces", "Validate a small integration"],
        successCriteria: ["Demonstrated useful path"],
        evidence: projects.map((p) => ({
          projectId: p.id,
          field: "description",
          observation: "Unknown purpose requires validation",
        })),
      },
    ],
  };
  const service = require("../../server/lib/allIn").createAllInService({
    runner: async () => ({ output: JSON.stringify(output), diagnostics: "" }),
  });
  service.startRun();
  await service.whenIdle();
  return {
    root,
    projectRoot,
    projects,
    report: service.getState().currentReport,
  };
}
test("reviewed workspace creation links originals, is idempotent and archives/restores without source changes", async () => {
  const { projectRoot, projects, report } = await setup();
  const w = require("../../server/lib/linkedWorkspaces");
  const preview = w.prepareLinkedWorkspace(report.id, "proposal-1", {});
  assert.equal(fs.existsSync(preview.targetPath), false);
  const created = w.createLinkedWorkspace(preview.id, {
    expectedFingerprint: preview.sourceFingerprint,
  });
  assert.equal(created.status, "created");
  for (const member of created.members) {
    assert.equal(
      fs.realpathSync(
        path.join(created.targetPath, "repositories", member.alias),
      ),
      member.sourcePath,
    );
    assert.equal(
      fs.readFileSync(path.join(member.sourcePath, "source.txt"), "utf8"),
      "Original source",
    );
  }
  assert.equal(
    w.createLinkedWorkspace(preview.id, {
      expectedFingerprint: preview.sourceFingerprint,
    }).projectId,
    created.projectId,
  );
  assert.ok(
    fs.existsSync(path.join(created.targetPath, ".planning", "ROADMAP.md")),
  );
  fs.writeFileSync(
    path.join(created.targetPath, "notes.txt"),
    "User additions",
  );
  const archived = w.archiveWorkspace(preview.id);
  assert.equal(archived.status, "archived");
  assert.equal(fs.existsSync(created.targetPath), false);
  const restored = w.restoreWorkspace(preview.id);
  assert.equal(
    fs.readFileSync(path.join(restored.targetPath, "notes.txt"), "utf8"),
    "User additions",
  );
  assert.equal(
    require("../../server/lib/registry").findProject(created.projectId).path,
    created.targetPath,
  );
  assert.equal(fs.existsSync(projectRoot), true);
});
test("workspace plans reject stale sources, target collisions, symlink roots and path traversal", async () => {
  const { projectRoot, projects, report } = await setup();
  const w = require("../../server/lib/linkedWorkspaces");
  assert.throws(
    () =>
      w.prepareLinkedWorkspace(report.id, "proposal-1", {
        name: "../../escape",
      }),
    /name/i,
  );
  const plan = w.prepareLinkedWorkspace(report.id, "proposal-1", {});
  require("../../server/lib/projectMetadata").updateMetadata(projects[0].id, {
    description: "A changed source description",
  });
  assert.throws(
    () =>
      w.createLinkedWorkspace(plan.id, {
        expectedFingerprint: plan.sourceFingerprint,
      }),
    (e) => e.code === "WORKSPACE_CONFLICT",
  );
  const fixture = await setup();
  const collision = w.prepareLinkedWorkspace(
    fixture.report.id,
    "proposal-1",
    {},
  );
  fs.mkdirSync(collision.targetPath);
  fs.writeFileSync(path.join(collision.targetPath, "keep.txt"), "Keep");
  assert.throws(
    () =>
      w.createLinkedWorkspace(collision.id, {
        expectedFingerprint: collision.sourceFingerprint,
      }),
    (e) => e.code === "WORKSPACE_CONFLICT",
  );
  assert.equal(
    fs.readFileSync(path.join(collision.targetPath, "keep.txt"), "utf8"),
    "Keep",
  );
  const alias = path.join(fixture.root, "LinkedProjects");
  fs.symlinkSync(fixture.projectRoot, alias);
  require("../../server/lib/settings").saveSettings({
    allIn: { workspaceRoot: alias },
  });
  assert.throws(
    () => w.prepareLinkedWorkspace(fixture.report.id, "proposal-1", {}),
    /symlink/i,
  );
});

test("restore checks registry conflicts before moving archived files and recovers an interrupted archive", async () => {
  const { report } = await setup();
  const w = require("../../server/lib/linkedWorkspaces");
  const registry = require("../../server/lib/registry");
  const plan = w.prepareLinkedWorkspace(report.id, "proposal-1", {});
  const created = w.createLinkedWorkspace(plan.id, {
    expectedFingerprint: plan.sourceFingerprint,
  });
  const archived = w.archiveWorkspace(plan.id);
  registry.saveProjects([
    ...registry.loadProjects(),
    { ...created.projectRecord, path: path.join(created.rootPath, "other") },
  ]);
  assert.throws(
    () => w.restoreWorkspace(plan.id),
    (e) => e.code === "WORKSPACE_CONFLICT",
  );
  assert.equal(fs.existsSync(created.targetPath), false);
  assert.equal(fs.existsSync(archived.archivePath), true);
  registry.saveProjects(
    registry.loadProjects().filter((p) => p.id !== created.projectId),
  );
  w.restoreWorkspace(plan.id);
  const archiveRoot = path.join(created.rootPath, ".geezo-archive");
  const next = {
    ...w.getWorkspace(plan.id),
    status: "archiving",
    archivePath: path.join(archiveRoot, plan.id),
  };
  require("../../server/lib/atomicStore").writeJsonAtomic(
    path.join(
      process.env.GSD_WEB_HOME_OVERRIDE,
      "linked-workspaces",
      `${plan.id}.json`,
    ),
    next,
  );
  fs.renameSync(created.targetPath, next.archivePath);
  w.recoverWorkspaces();
  assert.equal(w.getWorkspace(plan.id).status, "archived");
  assert.equal(registry.findProject(created.projectId), undefined);
});

test("creation restart reconciles a registered managed workspace before archive and restore", async () => {
  const { report } = await setup();
  const w = require("../../server/lib/linkedWorkspaces");
  const plan = w.prepareLinkedWorkspace(report.id, "proposal-1", {});
  const created = w.createLinkedWorkspace(plan.id, {
    expectedFingerprint: plan.sourceFingerprint,
  });
  const interrupted = { ...created, status: "creating" };
  delete interrupted.projectId;
  delete interrupted.projectRecord;
  require("../../server/lib/atomicStore").writeJsonAtomic(
    path.join(
      process.env.GSD_WEB_HOME_OVERRIDE,
      "linked-workspaces",
      `${plan.id}.json`,
    ),
    interrupted,
  );
  w.recoverWorkspaces();
  const recovered = w.getWorkspace(plan.id);
  assert.equal(recovered.projectId, created.projectId);
  w.archiveWorkspace(plan.id);
  assert.equal(
    require("../../server/lib/registry").findProject(created.projectId),
    undefined,
  );
  w.restoreWorkspace(plan.id);
  assert.equal(
    require("../../server/lib/registry").findProject(created.projectId).path,
    created.targetPath,
  );
});
test("workspace operations reject symlinked ancestors and replaced root identities", async () => {
  const fixture = await setup();
  const w = require("../../server/lib/linkedWorkspaces");
  const alias = path.join(fixture.root, "parent-alias");
  fs.symlinkSync(fixture.root, alias);
  require("../../server/lib/settings").saveSettings({
    allIn: { workspaceRoot: path.join(alias, "Projects") },
  });
  assert.throws(
    () => w.prepareLinkedWorkspace(fixture.report.id, "proposal-1", {}),
    /symlink/i,
  );
  require("../../server/lib/settings").saveSettings({
    allIn: { workspaceRoot: fixture.projectRoot },
  });
  const plan = w.prepareLinkedWorkspace(fixture.report.id, "proposal-1", {});
  const created = w.createLinkedWorkspace(plan.id, {
    expectedFingerprint: plan.sourceFingerprint,
  });
  const moved = path.join(fixture.root, "old-Projects");
  fs.renameSync(fixture.projectRoot, moved);
  fs.mkdirSync(fixture.projectRoot);
  fs.renameSync(path.join(moved, created.slug), created.targetPath);
  assert.throws(
    () => w.archiveWorkspace(plan.id),
    (e) => e.code === "WORKSPACE_CONFLICT",
  );
  assert.equal(fs.existsSync(created.targetPath), true);
});

test("restoring an unregistered partial workspace does not claim successful creation", async () => {
  const { report } = await setup();
  const w = require("../../server/lib/linkedWorkspaces");
  const registry = require("../../server/lib/registry");
  const plan = w.prepareLinkedWorkspace(report.id, "proposal-1", {});
  const created = w.createLinkedWorkspace(plan.id, {
    expectedFingerprint: plan.sourceFingerprint,
  });
  registry.saveProjects(
    registry.loadProjects().filter((p) => p.id !== created.projectId),
  );
  const partial = {
    ...created,
    status: "failed",
    error: "Simulated interruption before registration",
  };
  delete partial.projectRecord;
  require("../../server/lib/atomicStore").writeJsonAtomic(
    path.join(
      process.env.GSD_WEB_HOME_OVERRIDE,
      "linked-workspaces",
      `${plan.id}.json`,
    ),
    partial,
  );
  w.archiveWorkspace(plan.id);
  const restored = w.restoreWorkspace(plan.id);
  assert.equal(restored.status, "interrupted");
  assert.equal(registry.findProject(created.projectId), undefined);
  assert.equal(fs.existsSync(restored.targetPath), true);
});
