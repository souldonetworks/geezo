const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const {
  hasGsdDatabase,
  readGsdDatabase,
} = require("../../server/lib/gsdDbReader");

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-db-project-"));
  fs.mkdirSync(path.join(dir, ".gsd"));
  return dir;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE milestones (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      sequence INTEGER DEFAULT 0
    );
    CREATE TABLE slices (
      milestone_id TEXT NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      depends TEXT NOT NULL DEFAULT '[]',
      goal TEXT NOT NULL DEFAULT '',
      demo TEXT NOT NULL DEFAULT '',
      sequence INTEGER DEFAULT 0,
      PRIMARY KEY (milestone_id, id)
    );
    CREATE TABLE tasks (
      milestone_id TEXT NOT NULL,
      slice_id TEXT NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      sequence INTEGER DEFAULT 0,
      PRIMARY KEY (milestone_id, slice_id, id)
    );
  `);
}

test("hasGsdDatabase is false when .gsd/gsd.db does not exist", () => {
  const dir = makeProject();
  assert.equal(hasGsdDatabase(dir), false);
});

test("hasGsdDatabase is true once .gsd/gsd.db exists", () => {
  const dir = makeProject();
  const db = new DatabaseSync(path.join(dir, ".gsd", "gsd.db"));
  createSchema(db);
  db.close();
  assert.equal(hasGsdDatabase(dir), true);
});

test("readGsdDatabase returns empty phases when no milestone exists", () => {
  const dir = makeProject();
  const db = new DatabaseSync(path.join(dir, ".gsd", "gsd.db"));
  createSchema(db);
  db.close();

  const result = readGsdDatabase(dir);
  assert.deepEqual(result.phases, []);
});

test("readGsdDatabase maps the active milestone's slices/tasks to phases/plans", () => {
  const dir = makeProject();
  const db = new DatabaseSync(path.join(dir, ".gsd", "gsd.db"));
  createSchema(db);

  db.exec(`
    INSERT INTO milestones (id, title, status, sequence) VALUES ('m1', 'v1.0', 'active', 1);
    INSERT INTO milestones (id, title, status, sequence) VALUES ('m0', 'v0.9', 'completed', 0);

    INSERT INTO slices (milestone_id, id, title, status, goal, sequence) VALUES
      ('m1', 's1', 'Scaffold', 'completed', 'Get the app booting', 1);
    INSERT INTO slices (milestone_id, id, title, status, goal, sequence) VALUES
      ('m1', 's2', 'Core Feature', 'pending', 'Ship the core feature', 2);

    INSERT INTO tasks (milestone_id, slice_id, id, title, status, sequence) VALUES
      ('m1', 's1', 't1', 'Repo structure', 'completed', 1);
    INSERT INTO tasks (milestone_id, slice_id, id, title, status, sequence) VALUES
      ('m1', 's1', 't2', 'Health endpoint', 'completed', 2);
    INSERT INTO tasks (milestone_id, slice_id, id, title, status, sequence) VALUES
      ('m1', 's2', 't3', 'Data model', 'pending', 1);
  `);
  db.close();

  const result = readGsdDatabase(dir);
  assert.equal(result.phases.length, 2);

  const [phase1, phase2] = result.phases;
  assert.equal(phase1.title, "Scaffold");
  assert.equal(phase1.status, "done");
  assert.equal(phase1.goal, "Get the app booting");
  assert.equal(phase1.plans.length, 2);
  assert.deepEqual(phase1.plans[0], {
    id: "t1",
    title: "Repo structure",
    done: true,
  });

  assert.equal(phase2.title, "Core Feature");
  assert.equal(phase2.status, "pending");
  assert.equal(phase2.plans[0].done, false);
});

test("Bun reads the same SQLite project without requiring node:sqlite or changing its database", (t) => {
  const { spawnSync, execFileSync } = require("node:child_process");
  if (spawnSync("bun", ["--version"]).status !== 0) {
    t.skip("Bun is not installed");
    return;
  }
  const dir = makeProject();
  const file = path.join(dir, ".gsd", "gsd.db");
  const db = new DatabaseSync(file);
  createSchema(db);
  db.exec(
    "INSERT INTO milestones(id,title,status,sequence) VALUES('m1','Example','active',1)",
  );
  db.close();
  const before = fs.readFileSync(file);
  const output = execFileSync(
    "bun",
    [
      "-e",
      "try {const {readGsdDatabase}=require('./server/lib/gsdDbReader');console.log(JSON.stringify(readGsdDatabase(process.argv[1])))} catch(error) {console.error(error.message);process.exit(1)}",
      dir,
    ],
    { cwd: path.join(__dirname, "../.."), encoding: "utf8" },
  );
  assert.deepEqual(JSON.parse(output), { phases: [] });
  assert.deepEqual(fs.readFileSync(file), before);
});
