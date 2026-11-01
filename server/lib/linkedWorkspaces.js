const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { gsdWebDir } = require("./paths");
const { loadSettings } = require("./settings");
const { readJson, writeJsonAtomic } = require("./atomicStore");
const registry = require("./registry");
const { getReport } = require("./allIn");
const { getBriefRecord } = require("./briefStore");
const { resolveLens, listLenses } = require("./lenses");
const hash = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function conflict(message) {
  throw Object.assign(new Error(message), { code: "WORKSPACE_CONFLICT" });
}
function file(id) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Invalid workspace ID");
  return path.join(gsdWebDir(), "linked-workspaces", `${id}.json`);
}
function save(plan) {
  writeJsonAtomic(file(plan.id), plan);
  return plan;
}
function getWorkspace(id) {
  const plan = readJson(file(id), null);
  if (!plan)
    throw Object.assign(new Error("Workspace not found"), {
      code: "NOT_FOUND",
    });
  return plan;
}
function listWorkspaces() {
  const root = path.join(gsdWebDir(), "linked-workspaces");
  return fs.existsSync(root)
    ? fs
        .readdirSync(root)
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJson(path.join(root, f), null))
        .filter(Boolean)
    : [];
}
function assertNoSymlinkParents(target) {
  let current = path.parse(path.resolve(target)).root;
  for (const part of path
    .resolve(target)
    .slice(current.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        const platformAlias =
          (current === "/var" && fs.realpathSync(current) === "/private/var") ||
          (current === "/tmp" && fs.realpathSync(current) === "/private/tmp");
        if (!platformAlias) conflict("Workspace parent must not be a symlink");
      }
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
  }
}
function rootIdentity(root) {
  if (!fs.existsSync(root)) return null;
  const s = fs.lstatSync(root);
  return { ino: s.ino, dev: s.dev };
}
function verifyRoot(plan) {
  assertNoSymlinkParents(plan.rootPath);
  if (plan.rootIdentity) {
    const current = rootIdentity(plan.rootPath);
    if (
      !current ||
      current.ino !== plan.rootIdentity.ino ||
      current.dev !== plan.rootIdentity.dev
    )
      conflict(
        "Workspace root identity changed; refusing filesystem operations",
      );
  }
}
function workspaceRoot(create = false) {
  const configured = path.resolve(loadSettings().allIn.workspaceRoot);
  assertNoSymlinkParents(configured);
  try {
    const stat = fs.lstatSync(configured);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      conflict("Workspace root must be a directory, not a symlink");
    return fs.realpathSync(configured);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const parent = fs.realpathSync(path.dirname(configured));
    const root = path.join(parent, path.basename(configured));
    if (create) fs.mkdirSync(root);
    return root;
  }
}
function safeName(name) {
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.length > 100 ||
    /[\\/\x00-\x1f]/.test(name) ||
    name.includes("..")
  )
    throw new Error("Use a workspace name without path separators");
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (!slug) throw new Error("Workspace name needs letters or numbers");
  return { name: name.trim(), slug };
}
function revisionFor(projectId) {
  const r = getBriefRecord(projectId);
  return r.acceptedRevision || r.latestHuman || r.latestDraft;
}
function verifyMembers(plan) {
  verifyRoot(plan);
  if (workspaceRoot() !== plan.rootPath)
    conflict("Workspace root changed; prepare a new review");
  for (const member of plan.members) {
    const project = registry.findProject(member.projectId);
    if (
      !project ||
      project.path !== member.sourcePath ||
      (project.metadataVersion || 0) !== member.metadataVersion ||
      revisionFor(project.id) !== member.sourceRevisionId
    )
      conflict(
        `Source project changed: ${member.name}. Refresh All In and prepare a new review.`,
      );
    const history = getBriefRecord(project.id);
    const selected = history.revisions.find(
      (r) => r.id === revisionFor(project.id),
    );
    const lens = resolveLens(project, selected?.brief);
    if (lens.id !== member.lens.id || lens.version !== member.lens.version)
      conflict("A source assessment lens changed; refresh All In");
    if (
      fs.realpathSync(project.path) !== member.sourcePath ||
      !fs.statSync(member.sourcePath).isDirectory()
    )
      conflict("A source repository is unavailable");
    if (
      plan.targetPath === member.sourcePath ||
      plan.targetPath.startsWith(member.sourcePath + path.sep)
    )
      conflict("A workspace cannot link to its own ancestor or container");
  }
}
function prepareLinkedWorkspace(reportId, proposalId, options = {}) {
  const report = getReport(reportId);
  const proposal = report?.recommendations.find((p) => p.id === proposalId);
  if (!proposal)
    throw Object.assign(new Error("Recommendation not found"), {
      code: "NOT_FOUND",
    });
  if (proposal.type === "keep-separate")
    conflict("This recommendation deliberately keeps projects separate");
  const existing = listWorkspaces().find(
    (w) =>
      w.reportId === reportId &&
      w.proposalId === proposalId &&
      w.status === "created",
  );
  if (existing) return { ...existing, alreadyCreated: true };
  const { name, slug } = safeName(options.name || proposal.workingName);
  const rootPath = workspaceRoot();
  const targetPath = path.join(rootPath, slug);
  if (fs.existsSync(targetPath))
    conflict(
      "Workspace target already exists; existing folders are never overwritten",
    );
  const members = proposal.projectIds.map((id) => {
    const source = report.sourceProjects.find((p) => p.id === id);
    if (!source)
      conflict("Recommendation member is absent from the source snapshot");
    return {
      projectId: id,
      name: source.name,
      sourcePath: source.path,
      metadataVersion: source.metadataVersion,
      sourceRevisionId: source.sourceRevisionId,
      lens: source.lens,
      alias:
        source.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 65) || `repo-${id.slice(0, 6)}`,
    };
  });
  const counts = new Map();
  for (const member of members)
    counts.set(member.alias, (counts.get(member.alias) || 0) + 1);
  for (const member of members)
    if (counts.get(member.alias) > 1)
      member.alias += `-${member.projectId.slice(0, 6)}`;
  const categories = members.map(
    (m) => registry.findProject(m.projectId)?.category || "unclassified",
  );
  const category =
    options.category ||
    (new Set(categories).size === 1 ? categories[0] : "unclassified");
  if (!["personal", "work", "unclassified"].includes(category))
    throw new Error("Invalid workspace category");
  const active = listLenses();
  const lensId =
    options.lensId ||
    proposal.proposedLensId ||
    (members.every((m) => m.lens.id === members[0].lens.id)
      ? members[0].lens.id
      : active.find((l) => l.id === "experimental")?.id || active[0].id);
  if (!active.some((l) => l.id === lensId))
    throw new Error("Choose an active assessment lens");
  const plan = {
    id: crypto.randomUUID(),
    status: "prepared",
    createdAt: new Date().toISOString(),
    reportId,
    proposalId,
    name,
    slug,
    rootPath,
    rootIdentity: rootIdentity(rootPath),
    targetPath,
    description: proposal.description,
    category,
    lensId,
    members,
    proposal,
  };
  plan.sourceFingerprint = hash({
    reportId,
    proposalId,
    name,
    rootPath,
    members,
    category,
    lensId,
  });
  verifyMembers(plan);
  const prior = listWorkspaces().find(
    (w) =>
      w.status === "prepared" && w.sourceFingerprint === plan.sourceFingerprint,
  );
  return prior || save(plan);
}
function createLinkedWorkspace(id, { expectedFingerprint } = {}) {
  const plan = getWorkspace(id);
  if (expectedFingerprint !== plan.sourceFingerprint)
    conflict("Reviewed workspace fingerprint does not match");
  if (plan.status === "created") return plan;
  if (plan.status !== "prepared")
    conflict("Prepare a new workspace before applying");
  const other = listWorkspaces().find(
    (w) =>
      w.id !== id &&
      w.reportId === plan.reportId &&
      w.proposalId === plan.proposalId &&
      w.status === "created",
  );
  if (other) return other;
  verifyMembers(plan);
  workspaceRoot(true);
  verifyRoot(plan);
  if (!plan.rootIdentity) plan.rootIdentity = rootIdentity(plan.rootPath);
  if (fs.existsSync(plan.targetPath))
    conflict("Workspace target already exists");
  plan.status = "creating";
  plan.projectId = plan.projectId || crypto.randomUUID();
  save(plan);
  try {
    fs.mkdirSync(plan.targetPath);
    const stat = fs.lstatSync(plan.targetPath);
    plan.targetInode = stat.ino;
    plan.targetDevice = stat.dev;
    save(plan);
    fs.writeFileSync(
      path.join(plan.targetPath, ".geezo-workspace.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: plan.id,
          name: plan.name,
          reportId: plan.reportId,
          proposalId: plan.proposalId,
          members: plan.members,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    fs.mkdirSync(path.join(plan.targetPath, "repositories"));
    fs.mkdirSync(path.join(plan.targetPath, ".planning"));
    const docs = {
      "README.md": `# ${plan.name}\n\n## What is it?\n\n${plan.description}\n\nThis is a proposed product/component workspace, not an already integrated or released offering. Original repositories remain in their existing locations.\n\n## Member repositories\n\n${plan.members.map((m) => `- [${m.name}](repositories/${m.alias}) → ${m.sourcePath}`).join("\n")}\n\n## Suggested path\n\n${plan.proposal.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n## Risks and unknowns\n\n${plan.proposal.risks.map((r) => `- ${r}`).join("\n")}\n\n## Proposed success criteria\n\n${plan.proposal.successCriteria.map((s) => `- ${s}`).join("\n")}\n\nOwnership, funding, integration approval and commercial commitments remain to be agreed.\n`,
      ".planning/PROJECT.md": `# ${plan.name}\n\n${plan.description}\n\n## Scope\n\nReview the member interfaces and establish one useful end-to-end path. Implementation remains in the owning linked repositories until a separate integration plan is accepted.\n\n## Exclusions\n\nNo repository moves, code merging, dependency installation, service startup or automatic ownership transfer.\n`,
      ".planning/ROADMAP.md": `# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: Validate the proposed composition** - Proposed; implementation not approved\n\n## Phase Details\n\n### Phase 1: Validate the proposed composition\n**Goal**: ${plan.proposal.steps.join(" ")}\n**Depends on**: Accepted scope and owners\n**Requirements**: ${plan.proposal.successCriteria.join("; ")}\n\n- [ ] 01-01: Inspect interfaces, confirm boundaries and validate a small integrated slice\n`,
      ".planning/STATE.md":
        "---\nstatus: proposed\nprogress:\n  percent: 0\n---\n\n# State\n\nProposed linked workspace created. Integration remains unimplemented and requires an accepted execution plan.\n",
    };
    for (const [relative, content] of Object.entries(docs))
      fs.writeFileSync(path.join(plan.targetPath, relative), content, {
        flag: "wx",
      });
    for (const member of plan.members)
      fs.symlinkSync(
        path.relative(
          path.join(plan.targetPath, "repositories"),
          member.sourcePath,
        ),
        path.join(plan.targetPath, "repositories", member.alias),
        "dir",
      );
    const list = registry.loadProjects();
    if (list.some((p) => p.id === plan.projectId || p.path === plan.targetPath))
      conflict("Workspace registration conflicts");
    const projectRecord = {
      id: plan.projectId,
      path: fs.realpathSync(plan.targetPath),
      addedAt: new Date().toISOString(),
      name: plan.name,
      description: plan.description,
      category: plan.category,
      lensId: plan.lensId,
      tags: ["linked-workspace"],
      workspaceId: plan.id,
      groupMembers: plan.members.map((m) => m.projectId),
      metadataVersion: 1,
    };
    plan.projectRecord = projectRecord;
    save(plan);
    list.push(projectRecord);
    registry.saveProjects(list);
    plan.status = plan.projectRecord ? "created" : "interrupted";
    plan.completedAt = new Date().toISOString();
    return save(plan);
  } catch (error) {
    plan.status = "failed";
    plan.error = error.message;
    save(plan);
    throw error;
  }
}
function ownedTarget(plan, target) {
  const stat = fs.lstatSync(target);
  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    stat.ino !== plan.targetInode ||
    stat.dev !== plan.targetDevice
  )
    conflict("Workspace directory identity changed; refusing to touch it");
  const manifest = readJson(path.join(target, ".geezo-workspace.json"), null);
  if (manifest?.id !== plan.id)
    conflict("Workspace ownership marker is missing or changed");
}
function archiveWorkspace(id) {
  const plan = getWorkspace(id);
  verifyRoot(plan);
  if (!["created", "failed", "interrupted"].includes(plan.status))
    conflict("This workspace cannot be archived");
  ownedTarget(plan, plan.targetPath);
  const archiveRoot = path.join(plan.rootPath, ".geezo-archive");
  if (fs.existsSync(archiveRoot)) {
    const st = fs.lstatSync(archiveRoot);
    if (st.isSymbolicLink() || !st.isDirectory())
      conflict("Archive root must not be a symlink");
  } else fs.mkdirSync(archiveRoot);
  const archivePath = path.join(archiveRoot, plan.id);
  if (fs.existsSync(archivePath))
    conflict("Archive destination already exists");
  const current = registry.findProject(plan.projectId);
  if (current) plan.projectRecord = current;
  plan.status = "archiving";
  plan.archivePath = archivePath;
  save(plan);
  fs.renameSync(plan.targetPath, archivePath);
  registry.saveProjects(
    registry.loadProjects().filter((p) => p.id !== plan.projectId),
  );
  plan.status = "archived";
  plan.archivedAt = new Date().toISOString();
  return save(plan);
}
function restoreWorkspace(id) {
  const plan = getWorkspace(id);
  verifyRoot(plan);
  if (plan.status !== "archived")
    conflict("Only archived workspaces may be restored");
  if (fs.existsSync(plan.targetPath))
    conflict("Original workspace path is occupied");
  ownedTarget(plan, plan.archivePath);
  const list = registry.loadProjects();
  if (
    plan.projectRecord &&
    list.some(
      (p) => p.id === plan.projectRecord.id || p.path === plan.targetPath,
    )
  )
    conflict("Workspace registry entry conflicts");
  plan.status = "restoring";
  save(plan);
  fs.renameSync(plan.archivePath, plan.targetPath);
  if (plan.projectRecord) {
    list.push(plan.projectRecord);
    registry.saveProjects(list);
  }
  plan.status = plan.projectRecord ? "created" : "interrupted";
  if (!plan.projectRecord)
    plan.error =
      "Partial workspace restored for inspection; registration was not completed.";
  plan.restoredAt = new Date().toISOString();
  return save(plan);
}
function recoverWorkspaces() {
  for (const plan of listWorkspaces()) {
    if (plan.status === "creating" && fs.existsSync(plan.targetPath)) {
      try {
        verifyRoot(plan);
        ownedTarget(plan, plan.targetPath);
        const registered = registry
          .loadProjects()
          .find((p) => p.path === plan.targetPath);
        if (registered) {
          plan.projectId = registered.id;
          plan.projectRecord = registered;
          save(plan);
        }
      } catch {}
    }

    if (plan.status === "archiving") {
      if (
        plan.archivePath &&
        fs.existsSync(plan.archivePath) &&
        !fs.existsSync(plan.targetPath)
      ) {
        try {
          ownedTarget(plan, plan.archivePath);
          registry.saveProjects(
            registry.loadProjects().filter((p) => p.id !== plan.projectId),
          );
          plan.status = "archived";
          save(plan);
          continue;
        } catch {}
      } else if (
        fs.existsSync(plan.targetPath) &&
        !fs.existsSync(plan.archivePath)
      ) {
        try {
          ownedTarget(plan, plan.targetPath);
          plan.status = plan.projectRecord ? "created" : "interrupted";
          save(plan);
          continue;
        } catch {}
      }
    }
    if (plan.status === "restoring") {
      if (fs.existsSync(plan.targetPath) && !fs.existsSync(plan.archivePath)) {
        try {
          ownedTarget(plan, plan.targetPath);
          const list = registry.loadProjects();
          if (
            !list.some(
              (p) => p.id === plan.projectId || p.path === plan.targetPath,
            ) &&
            plan.projectRecord
          ) {
            list.push(plan.projectRecord);
            registry.saveProjects(list);
          }
          plan.status = plan.projectRecord ? "created" : "interrupted";
          save(plan);
          continue;
        } catch {}
      } else if (
        fs.existsSync(plan.archivePath) &&
        !fs.existsSync(plan.targetPath)
      ) {
        plan.status = "archived";
        save(plan);
        continue;
      }
    }
    if (["creating", "archiving", "restoring"].includes(plan.status)) {
      plan.status = "interrupted";
      plan.error =
        "Server restarted during workspace operations. Inspect the recorded paths; original repositories were not moved.";
      save(plan);
    }
  }
}
module.exports = {
  prepareLinkedWorkspace,
  createLinkedWorkspace,
  getWorkspace,
  listWorkspaces,
  archiveWorkspace,
  restoreWorkspace,
  recoverWorkspaces,
};
