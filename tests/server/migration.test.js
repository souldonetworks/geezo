const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
function fixture() {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "migration-home-"),
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "migration-'$ ü-"));
  fs.writeFileSync(
    path.join(root, "README.md"),
    "# Existing work\nKeep this source",
  );
  return {
    root,
    project: require("../../server/lib/registry").addProject(root),
  };
}
test("migration prepares without writes, applies parseable GSD files and rolls back only its own files", () => {
  const { root, project } = fixture();
  const m = require("../../server/lib/migration");
  const proposal = m.prepareMigration(project.id);
  assert.equal(proposal.status, "prepared");
  assert.equal(fs.existsSync(path.join(root, ".planning")), false);
  assert.equal(proposal.operations.length, 3);
  const applied = m.applyMigration(project.id, proposal.id, {
    expectedFingerprint: proposal.sourceFingerprint,
  });
  assert.equal(applied.status, "completed");
  assert.equal(
    require("../../server/lib/roadmapParser").parseRoadmap(
      fs.readFileSync(path.join(root, ".planning", "ROADMAP.md"), "utf8"),
    ).phases.length,
    1,
  );
  assert.equal(
    fs.readFileSync(path.join(root, "README.md"), "utf8"),
    "# Existing work\nKeep this source",
  );
  assert.equal(
    m.rollbackMigration(project.id, proposal.id).status,
    "rolled-back",
  );
  assert.equal(
    fs.existsSync(path.join(root, ".planning", "ROADMAP.md")),
    false,
  );
});
test("migration refuses stale evidence, planning symlinks and rollback over later edits", () => {
  const { root, project } = fixture();
  const m = require("../../server/lib/migration");
  let proposal = m.prepareMigration(project.id);
  fs.writeFileSync(path.join(root, "README.md"), "Changed");
  assert.throws(
    () =>
      m.applyMigration(project.id, proposal.id, {
        expectedFingerprint: proposal.sourceFingerprint,
      }),
    (e) => e.code === "MIGRATION_CONFLICT",
  );
  proposal = m.prepareMigration(project.id);
  m.applyMigration(project.id, proposal.id, {
    expectedFingerprint: proposal.sourceFingerprint,
  });
  fs.appendFileSync(
    path.join(root, ".planning", "PROJECT.md"),
    "\nLater edits",
  );
  assert.throws(
    () => m.rollbackMigration(project.id, proposal.id),
    (e) => e.code === "MIGRATION_CONFLICT",
  );
  assert.equal(fs.existsSync(path.join(root, ".planning", "ROADMAP.md")), true);
  const other = fixture();
  fs.symlinkSync(root, path.join(other.root, ".planning"));
  assert.throws(() => m.prepareMigration(other.project.id), /symlink/i);
});
test("existing planning contents and database projects are never overwritten", () => {
  const { root, project } = fixture();
  const m = require("../../server/lib/migration");
  fs.mkdirSync(path.join(root, ".planning"));
  fs.writeFileSync(path.join(root, ".planning", "PROJECT.md"), "Existing plan");
  const proposal = m.prepareMigration(project.id);
  assert.equal(
    proposal.operations.some((o) => o.relativePath.endsWith("PROJECT.md")),
    false,
  );
  m.applyMigration(project.id, proposal.id, {
    expectedFingerprint: proposal.sourceFingerprint,
  });
  assert.equal(
    fs.readFileSync(path.join(root, ".planning", "PROJECT.md"), "utf8"),
    "Existing plan",
  );
  const other = fixture();
  fs.mkdirSync(path.join(other.root, ".gsd"));
  fs.writeFileSync(path.join(other.root, ".gsd", "gsd.db"), "database");
  assert.equal(m.prepareMigration(other.project.id).status, "already-adopted");
});

test("interrupted migration journals remain recoverable without replaying writes", () => {
  const { root, project } = fixture();
  const m = require("../../server/lib/migration");
  const proposal = m.prepareMigration(project.id);
  fs.mkdirSync(path.join(root, ".planning"));
  fs.writeFileSync(
    path.join(root, proposal.operations[0].relativePath),
    proposal.operations[0].afterContent,
  );
  proposal.status = "applying";
  proposal.createdPlanningDirectory = true;
  proposal.operations[0].applied = true;
  require("../../server/lib/atomicStore").writeJsonAtomic(
    path.join(
      process.env.GSD_WEB_HOME_OVERRIDE,
      "migrations",
      project.id,
      `${proposal.id}.json`,
    ),
    proposal,
  );
  m.recoverMigrations();
  assert.equal(m.getMigration(project.id, proposal.id).status, "interrupted");
  assert.equal(
    fs.existsSync(path.join(root, ".planning", "ROADMAP.md")),
    false,
  );
  m.rollbackMigration(project.id, proposal.id);
  assert.equal(
    fs.existsSync(path.join(root, ".planning", "PROJECT.md")),
    false,
  );
});
