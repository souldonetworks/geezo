const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-web-home-"));
  process.env.GSD_WEB_HOME_OVERRIDE = dir;
  delete require.cache[require.resolve("../../server/lib/paths")];
  delete require.cache[require.resolve("../../server/lib/registry")];
  return require("../../server/lib/registry");
}

test("addProject accepts a directory without GSD", () => {
  const registry = freshHome();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "not-gsd-"));
  assert.equal(registry.addProject(target).path, fs.realpathSync(target));
});

test("addProject accepts and persists a valid GSD project, removeProject deletes it", () => {
  const registry = freshHome();
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "is-gsd-"));
  fs.mkdirSync(path.join(target, ".planning"), { recursive: true });
  fs.writeFileSync(path.join(target, ".planning", "ROADMAP.md"), "# Roadmap");

  const project = registry.addProject(target);
  assert.equal(project.path, fs.realpathSync(target));
  assert.equal(registry.loadProjects().length, 1);

  assert.throws(
    () => registry.addProject(target),
    (err) => err.code === "ALREADY_ADDED",
  );

  const removed = registry.removeProject(project.id);
  assert.equal(removed, true);
  assert.equal(registry.loadProjects().length, 0);
});

test("addProject rejects a nonexistent path", () => {
  const registry = freshHome();
  assert.throws(
    () => registry.addProject("/no/such/path/at/all"),
    (err) => err.code === "PATH_NOT_FOUND",
  );
});

test("addProject accepts a project using the .gsd/gsd.db format", () => {
  const registry = freshHome();
  const { DatabaseSync } = require("node:sqlite");
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "is-gsd-db-"));
  fs.mkdirSync(path.join(target, ".gsd"));
  const db = new DatabaseSync(path.join(target, ".gsd", "gsd.db"));
  db.exec("CREATE TABLE milestones (id TEXT PRIMARY KEY);");
  db.close();

  const project = registry.addProject(target);
  assert.equal(project.path, fs.realpathSync(target));
});
