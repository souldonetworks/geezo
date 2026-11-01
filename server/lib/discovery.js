const fs = require("node:fs");
const path = require("node:path");
const registry = require("./registry");
const { loadSettings } = require("./settings");
function getProjectStatus(project) {
  try {
    if (!fs.statSync(project.path).isDirectory())
      return { availability: "unavailable", gsdFormat: "none" };
    const gsdFormat = fs.existsSync(path.join(project.path, ".gsd", "gsd.db"))
      ? "database"
      : fs.existsSync(path.join(project.path, ".planning", "ROADMAP.md"))
        ? "planning"
        : "none";
    return { availability: "available", gsdFormat };
  } catch (error) {
    return {
      availability:
        !project.discoveryRootError &&
        ["ENOENT", "ENOTDIR"].includes(error.code)
          ? "unavailable"
          : "inspection-error",
      gsdFormat: "none",
    };
  }
}
function reconcileProjects(options = {}) {
  const config = loadSettings().portfolio;
  const roots = options.roots || config.roots;
  const exclusions = new Set(options.exclusions || config.exclusions);
  const projects = registry.loadProjects();
  const errors = [];
  const inspected = [];
  for (const root of roots) {
    try {
      const canonical = fs.realpathSync(root);
      for (const entry of fs.readdirSync(canonical, { withFileTypes: true })) {
        if (
          !entry.isDirectory() ||
          entry.name.startsWith(".") ||
          /\.(app|band|bundle)$/i.test(entry.name)
        )
          continue;
        const target = path.join(canonical, entry.name);
        if (exclusions.has(target) || projects.some((p) => p.path === target))
          continue;
        projects.push({
          id: require("node:crypto").randomUUID(),
          name: entry.name,
          path: target,
          addedAt: new Date().toISOString(),
          discovered: true,
          discoveryRoot: root,
        });
      }
      inspected.push(root);
    } catch (error) {
      errors.push({ root, message: error.message });
    }
  }
  for (const project of projects) {
    const failedRoot = errors.find(
      (error) =>
        project.discoveryRoot === error.root ||
        project.path.startsWith(path.resolve(error.root) + path.sep),
    );
    project.discoveryRootError = failedRoot?.message || null;
    Object.assign(project, getProjectStatus(project));
  }
  for (const project of projects) {
    const summary = require("./briefStore").briefSummary(project.id);
    if (summary?.evidenceId && project.availability === "available") {
      const evidence = require("./evidence");
      summary.freshness = evidence.compareEvidence(
        evidence.readEvidence(project.id, summary.evidenceId),
        evidence.collectEvidence(project.path),
      );
    }
    project.brief = summary;
  }
  registry.saveProjects(projects);
  return { projects, roots: inspected, errors };
}
function startDiscovery() {
  let stopped = false;
  let timer;
  function tick() {
    if (stopped) return;
    try {
      reconcileProjects();
    } catch (error) {
      console.error("Discovery failed:", error.message);
    }
    timer = setTimeout(tick, loadSettings().portfolio.scanIntervalMs);
    timer.unref();
  }
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
module.exports = { reconcileProjects, getProjectStatus, startDiscovery };
