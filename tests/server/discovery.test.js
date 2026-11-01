const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
test("discovery preserves IDs, exclusions and unavailable records without following links", () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "portfolio-home-"),
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-root-"));
  const project = path.join(root, "ordinary '$() ü");
  fs.mkdirSync(project);
  fs.mkdirSync(path.join(root, ".hidden"));
  fs.symlinkSync(project, path.join(root, "alias"));
  const { reconcileProjects } = require("../../server/lib/discovery");
  const registry = require("../../server/lib/registry");
  let result = reconcileProjects({ roots: [root], exclusions: [] });
  assert.equal(result.projects.length, 1);
  const id = result.projects[0].id;
  assert.equal(
    reconcileProjects({ roots: [root], exclusions: [] }).projects[0].id,
    id,
  );
  fs.rmdirSync(project);
  result = reconcileProjects({ roots: [root], exclusions: [] });
  assert.equal(result.projects[0].availability, "unavailable");
  fs.mkdirSync(project);
  registry.removeProject(id);
  assert.equal(reconcileProjects({ roots: [root] }).projects.length, 0);
  const missing = reconcileProjects({
    roots: [path.join(root, "missing")],
    exclusions: [],
  });
  assert.equal(missing.errors.length, 1);
});

test("a missing discovery root marks inspection uncertainty without deleting its portfolio", () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "root-error-home-"),
  );
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "root-error-"));
  const root = path.join(parent, "Code");
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(root, "project"));
  const {
    reconcileProjects,
    getProjectStatus,
  } = require("../../server/lib/discovery");
  const id = reconcileProjects({ roots: [root], exclusions: [] }).projects[0]
    .id;
  fs.renameSync(root, path.join(parent, "offline"));
  const result = reconcileProjects({ roots: [root], exclusions: [] });
  assert.equal(result.projects[0].id, id);
  assert.equal(result.projects[0].availability, "inspection-error");
  assert.equal(
    getProjectStatus(result.projects[0]).availability,
    "inspection-error",
  );
});
