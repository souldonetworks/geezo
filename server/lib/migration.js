const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { gsdWebDir } = require("./paths");
const { readJson, writeJsonAtomic } = require("./atomicStore");
const registry = require("./registry");
const { collectEvidence } = require("./evidence");
const { getBriefRecord } = require("./briefStore");
const { parseRoadmap } = require("./roadmapParser");
const { parseState } = require("./stateParser");
const names = ["PROJECT.md", "ROADMAP.md", "STATE.md"];
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function conflict(message) {
  throw Object.assign(new Error(message), { code: "MIGRATION_CONFLICT" });
}
function getProject(id) {
  const project = registry.findProject(id);
  if (!project)
    throw Object.assign(new Error("Project not found"), { code: "NOT_FOUND" });
  if (fs.realpathSync(project.path) !== project.path)
    conflict("Project canonical path changed");
  return project;
}
function migrationPath(projectId, id) {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId) || !/^[a-zA-Z0-9-]+$/.test(id))
    throw new Error("Invalid migration ID");
  return path.join(gsdWebDir(), "migrations", projectId, `${id}.json`);
}
function persist(proposal) {
  writeJsonAtomic(migrationPath(proposal.projectId, proposal.id), proposal);
  return proposal;
}
function getMigration(projectId, id) {
  const proposal = readJson(migrationPath(projectId, id), null);
  if (!proposal)
    throw Object.assign(new Error("Migration not found"), {
      code: "NOT_FOUND",
    });
  return proposal;
}
function safePlanning(root) {
  const dir = path.join(root, ".planning");
  if (
    fs.existsSync(dir) ||
    (() => {
      try {
        fs.lstatSync(dir);
        return true;
      } catch {
        return false;
      }
    })()
  ) {
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      conflict("Planning directory must not be a symlink or regular file");
  }
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile())
        conflict("Planning files must be ordinary files, not symlinks");
      if (stat.size > 2097152)
        conflict("Planning file exceeds inspection limit");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return dir;
}
function snapshot(project) {
  safePlanning(project.path);
  const evidence = collectEvidence(project.path);
  const planning = names.map((name) => {
    const file = path.join(project.path, ".planning", name);
    return [name, fs.existsSync(file) ? hash(fs.readFileSync(file)) : null];
  });
  let git = "not-a-repo";
  try {
    git = execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=normal"],
      {
        cwd: project.path,
        encoding: "utf8",
        maxBuffer: 1048576,
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {}
  return {
    fingerprint: hash(JSON.stringify([evidence.fingerprint, planning, git])),
    evidence,
    git,
  };
}
function prepareMigration(projectId) {
  const project = getProject(projectId);
  const dir = safePlanning(project.path);
  const state = snapshot(project);
  const id = crypto.randomUUID();
  const proposal = {
    id,
    projectId,
    status: "prepared",
    format: "planning",
    createdAt: new Date().toISOString(),
    sourceFingerprint: state.fingerprint,
    evidenceComplete: state.evidence.complete,
    gitStatus: state.git,
    operations: [],
    unresolved: [
      "Proposed validation phase requires review before implementation.",
      "Implementation, releases, security, support and maintenance owners remain unknown unless explicitly accepted.",
      "GSD CLI/workflow installation is not performed by file adoption. Use the installed GSD workflow for subsequent planning.",
    ],
    validation: [],
    sourceMap: state.evidence.files
      .filter((f) => /\.md$/i.test(f.path))
      .map((f) => ({
        path: f.path,
        hash: f.hash,
        action: "preserve and reference",
      })),
  };
  if (fs.existsSync(path.join(project.path, ".gsd", "gsd.db"))) {
    proposal.status = "already-adopted";
    proposal.format = "database";
    proposal.unresolved = [
      "Existing database format preserved. No database conversion is performed.",
    ];
    return persist(proposal);
  }
  const record = getBriefRecord(projectId);
  const revision = record.revisions.find(
    (r) =>
      r.id ===
      (record.acceptedRevision || record.latestHuman || record.latestDraft),
  );
  const references = proposal.sourceMap
    .slice(0, 40)
    .map((item) => `- ${item.path} (preserved; SHA-256 ${item.hash})`)
    .join("\n");
  const brief = revision
    ? `Executive assessment (${revision.id}; ${record.acceptedRevision === revision.id ? "accepted" : "draft"}): ${revision.brief.recommendation.decision}. This does not authorize implementation or transfer ownership.\n`
    : "Executive assessment: unknown; complete validation before seeking investment.\n";
  const content = {
    "PROJECT.md": `# ${project.name}\n\n## Existing project\n\nAdopted into file-based GSD planning without replacing existing code or documentation.\n\n${brief}\n## Existing context\n\n${references || "No existing project documentation was found."}\n\n## Proposed scope\n\nValidate the smallest useful next step against existing requirements and the executive brief.\n\n## Ownership and off-ramp\n\nUnknown: implementation, releases, security, support and maintenance owners. Proposed transition thresholds trigger review only. PuppetWorks remains accountable for its incubation work until receiving owners explicitly accept.\n\n## Exclusions\n\nNo automatic code changes, runtime upgrades, customer adoption, commercial commitments or transfer of accountability.\n`,
    "ROADMAP.md":
      "# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: Validate existing project direction** - Proposed; no implementation approved\n\n## Phase Details\n\n### Phase 1: Validate existing project direction\n**Goal**: Review existing plans and executive evidence; agree the smallest useful experiment and spending limit.\n**Depends on**: Explicit owner review\n**Requirements**: Existing project context and evidence\n\n- [ ] 01-01: Confirm scope, owners, validation and stop criteria before implementation\n",
    "STATE.md":
      "---\nstatus: proposed\nprogress:\n  percent: 0\n---\n\n# State\n\n## Current Position\n\nPhase: 1\nStatus: Proposed adoption; review required before implementation.\n\n## Decisions\n\nExisting work is preserved. No customer, budget, ownership or organizational commitment is inferred.\n",
  };
  for (const name of names) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file))
      proposal.operations.push({
        relativePath: `.planning/${name}`,
        beforeHash: null,
        afterContent: content[name],
        afterHash: hash(content[name]),
        applied: false,
      });
  }
  if (!proposal.operations.length) proposal.status = "already-adopted";
  return persist(proposal);
}
function applyMigration(projectId, id, { expectedFingerprint } = {}) {
  const project = getProject(projectId);
  const proposal = getMigration(projectId, id);
  if (proposal.status !== "prepared")
    conflict("Only a prepared migration may be applied");
  if (
    expectedFingerprint !== proposal.sourceFingerprint ||
    snapshot(project).fingerprint !== proposal.sourceFingerprint
  )
    conflict("Project changed since preparation. Prepare a new migration.");
  const dir = safePlanning(project.path);
  for (const op of proposal.operations)
    if (fs.existsSync(path.join(project.path, op.relativePath)))
      conflict("A proposed planning file now exists");
  proposal.status = "applying";
  proposal.startedAt = new Date().toISOString();
  proposal.createdPlanningDirectory = !fs.existsSync(dir);
  proposal.backupLocation = path.join(
    gsdWebDir(),
    "migrations",
    projectId,
    `${id}-backup.json`,
  );
  writeJsonAtomic(proposal.backupLocation, {
    projectId,
    migrationId: id,
    files: proposal.operations.map((op) => ({
      path: op.relativePath,
      before: null,
      afterHash: op.afterHash,
    })),
  });
  persist(proposal);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const op of proposal.operations) {
      safePlanning(project.path);
      const file = path.join(project.path, op.relativePath);
      fs.writeFileSync(file, op.afterContent, { flag: "wx", mode: 0o644 });
      op.applied = true;
      persist(proposal);
    }
    const roadmap = parseRoadmap(
      fs.readFileSync(path.join(dir, "ROADMAP.md"), "utf8"),
    );
    if (!roadmap.phases.length)
      throw new Error(
        "GSD roadmap has no parseable phases; review existing roadmap",
      );
    parseState(fs.readFileSync(path.join(dir, "STATE.md"), "utf8"));
    for (const source of proposal.sourceMap) {
      const file = path.join(project.path, source.path);
      if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== source.hash)
        throw new Error(
          `Existing evidence changed during migration: ${source.path}`,
        );
    }
    proposal.validation = [
      "Expected planning files present",
      "Roadmap and state independently parsed",
      "Pre-existing collected documentation hashes preserved",
    ];
    proposal.status = "completed";
    proposal.finishedAt = new Date().toISOString();
  } catch (error) {
    proposal.status = "failed";
    proposal.error = error.message;
    persist(proposal);
    throw error;
  }
  return persist(proposal);
}
function rollbackMigration(projectId, id) {
  const project = getProject(projectId);
  const proposal = getMigration(projectId, id);
  if (!["completed", "failed", "interrupted"].includes(proposal.status))
    conflict("This migration cannot be rolled back");
  safePlanning(project.path);
  // Check every path before deleting any file: a later edit blocks the whole rollback.
  for (const op of proposal.operations) {
    const file = path.join(project.path, op.relativePath);
    if (fs.existsSync(file) && hash(fs.readFileSync(file)) !== op.afterHash)
      conflict(`Later edits preserved: ${op.relativePath}`);
  }
  proposal.status = "rolling-back";
  persist(proposal);
  for (const op of proposal.operations) {
    const file = path.join(project.path, op.relativePath);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    op.applied = false;
    persist(proposal);
  }
  if (proposal.createdPlanningDirectory)
    try {
      fs.rmdirSync(path.join(project.path, ".planning"));
    } catch {}
  proposal.status = "rolled-back";
  proposal.rolledBackAt = new Date().toISOString();
  return persist(proposal);
}
function recoverMigrations() {
  const root = path.join(gsdWebDir(), "migrations");
  if (!fs.existsSync(root)) return;
  for (const project of fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory()))
    for (const file of fs
      .readdirSync(path.join(root, project.name))
      .filter((f) => f.endsWith(".json") && !f.endsWith("-backup.json"))) {
      const proposal = readJson(path.join(root, project.name, file), null);
      if (["applying", "rolling-back"].includes(proposal?.status)) {
        proposal.status = "interrupted";
        proposal.error =
          "Server restarted during migration. Inspect and roll back before preparing again.";
        persist(proposal);
      }
    }
}
function listMigrations(projectId) {
  const root = path.join(gsdWebDir(), "migrations", projectId);
  return fs.existsSync(root)
    ? fs
        .readdirSync(root)
        .filter((f) => f.endsWith(".json") && !f.endsWith("-backup.json"))
        .map((f) => readJson(path.join(root, f), null))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
}
module.exports = {
  prepareMigration,
  getMigration,
  applyMigration,
  rollbackMigration,
  recoverMigrations,
  listMigrations,
};
