const fs = require("node:fs");
const path = require("node:path");
// Bun's compiled runtime uses its native SQLite API; Node uses node:sqlite.
function openReadOnlyDatabase(file) {
  if (process.versions.bun)
    return new (require("bun:sqlite").Database)(file, { readonly: true });
  return new (require("node:sqlite").DatabaseSync)(file, { readOnly: true });
}

const DONE_STATUSES = new Set(["done", "completed", "complete"]);

function isDone(status) {
  return DONE_STATUSES.has(String(status || "").toLowerCase());
}

function dbPathFor(projectPath) {
  return path.join(projectPath, ".gsd", "gsd.db");
}

function hasGsdDatabase(projectPath) {
  return fs.existsSync(dbPathFor(projectPath));
}

function readGsdDatabase(projectPath) {
  const db = openReadOnlyDatabase(dbPathFor(projectPath));
  try {
    const milestone = db
      .prepare(
        `SELECT * FROM milestones
         ORDER BY (status = 'active') DESC, sequence DESC
         LIMIT 1`,
      )
      .get();

    if (!milestone) return { phases: [] };

    const slices = db
      .prepare("SELECT * FROM slices WHERE milestone_id = ? ORDER BY sequence")
      .all(milestone.id);

    const taskStmt = db.prepare(
      "SELECT * FROM tasks WHERE milestone_id = ? AND slice_id = ? ORDER BY sequence",
    );

    const phases = slices.map((slice, index) => {
      const tasks = taskStmt.all(milestone.id, slice.id);
      let dependsOn = "";
      try {
        dependsOn = JSON.parse(slice.depends || "[]").join(", ");
      } catch {
        dependsOn = "";
      }
      return {
        number: String(slice.sequence || index + 1),
        title: slice.title,
        status: isDone(slice.status) ? "done" : "pending",
        summary: slice.demo || "",
        goal: slice.goal || "",
        dependsOn,
        requirements: [],
        plans: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          done: isDone(task.status),
        })),
      };
    });

    return { phases };
  } finally {
    db.close();
  }
}

module.exports = { hasGsdDatabase, readGsdDatabase };
