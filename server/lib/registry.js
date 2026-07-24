const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { projectsFile, gsdWebDir } = require('./paths');
const { hasGsdDatabase } = require('./gsdDbReader');

function ensureDir() {
  fs.mkdirSync(gsdWebDir(), { recursive: true });
}

function loadProjects() {
  ensureDir();
  if (!fs.existsSync(projectsFile())) return [];
  return JSON.parse(fs.readFileSync(projectsFile(), 'utf8'));
}

function saveProjects(list) {
  ensureDir();
  fs.writeFileSync(projectsFile(), JSON.stringify(list, null, 2));
}

function isGsdProject(absPath) {
  return fs.existsSync(path.join(absPath, '.planning', 'ROADMAP.md')) || hasGsdDatabase(absPath);
}

function addProject(absPath) {
  if (!fs.existsSync(absPath)) {
    const err = new Error('Path does not exist');
    err.code = 'PATH_NOT_FOUND';
    throw err;
  }
  const resolved = fs.realpathSync(absPath);
  if (!isGsdProject(resolved)) {
    const err = new Error('Not a GSD project (missing .planning/ROADMAP.md)');
    err.code = 'NOT_GSD_PROJECT';
    throw err;
  }
  const list = loadProjects();
  if (list.some((p) => p.path === resolved)) {
    const err = new Error('Project already registered');
    err.code = 'ALREADY_ADDED';
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
  const next = list.filter((p) => p.id !== id);
  saveProjects(next);
  return next.length !== list.length;
}

function findProject(id) {
  return loadProjects().find((p) => p.id === id);
}

module.exports = { loadProjects, saveProjects, isGsdProject, addProject, removeProject, findProject };
