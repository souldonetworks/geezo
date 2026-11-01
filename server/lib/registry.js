const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { projectsFile, gsdWebDir } = require("./paths");
const { writeJsonAtomic } = require("./atomicStore");
const { hasGsdDatabase } = require("./gsdDbReader");

function ensureDir() {
  fs.mkdirSync(gsdWebDir(), { recursive: true });
}

function loadProjects() {
  ensureDir();
  if (!fs.existsSync(projectsFile())) return [];
  return JSON.parse(fs.readFileSync(projectsFile(), "utf8"));
}

function saveProjects(list) {
  ensureDir();
  writeJsonAtomic(projectsFile(), list);
}

function isGsdProject(absPath) {
  return (
    fs.existsSync(path.join(absPath, ".planning", "ROADMAP.md")) ||
    hasGsdDatabase(absPath)
  );
}

function addProject(absPath) {
  if (!fs.existsSync(absPath)) {
    const err = new Error("Path does not exist");
    err.code = "PATH_NOT_FOUND";
    throw err;
  }
  const resolved = fs.realpathSync(absPath);
  if (!fs.statSync(resolved).isDirectory())
    throw Object.assign(new Error("Project must be a directory"), {
      code: "NOT_DIRECTORY",
    });
  const list = loadProjects();
  if (list.some((p) => p.path === resolved)) {
    const err = new Error("Project already registered");
    err.code = "ALREADY_ADDED";
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
  const project = list.find((p) => p.id === id);
  if (project?.discovered) {
    const settings = require("./settings");
    const current = settings.loadSettings();
    settings.saveSettings({
      portfolio: {
        exclusions: [
          ...new Set([...current.portfolio.exclusions, project.path]),
        ],
      },
    });
  }
  const next = list.filter((p) => p.id !== id);
  saveProjects(next);
  return next.length !== list.length;
}

function findProject(id) {
  return loadProjects().find((p) => p.id === id);
}

module.exports = {
  loadProjects,
  saveProjects,
  isGsdProject,
  addProject,
  removeProject,
  findProject,
};
