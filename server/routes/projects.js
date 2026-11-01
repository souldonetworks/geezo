const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { getProjectStatus, reconcileProjects } = require("../lib/discovery");
const registry = require("../lib/registry");
const { scanDirectory } = require("../lib/scanDirectory");
const { parseRoadmap } = require("../lib/roadmapParser");
const { parseState } = require("../lib/stateParser");
const { hasGsdDatabase, readGsdDatabase } = require("../lib/gsdDbReader");
const { computeProgress } = require("../lib/progress");
const { getMilestone } = require("../lib/gitMilestone");
const { listRunning } = require("../lib/activityStore");

function readRoadmap(projectPath) {
  if (hasGsdDatabase(projectPath)) return readGsdDatabase(projectPath);
  const roadmapPath = path.join(projectPath, ".planning", "ROADMAP.md");
  const roadmapText = fs.existsSync(roadmapPath)
    ? fs.readFileSync(roadmapPath, "utf8")
    : "";
  return parseRoadmap(roadmapText);
}

function readState(projectPath) {
  // The .gsd/gsd.db format has no separate "state summary" record — progress
  // falls back to counting phases/plans from readRoadmap(), same as a
  // .planning/ project with no STATE.md.
  if (hasGsdDatabase(projectPath)) return null;
  const statePath = path.join(projectPath, ".planning", "STATE.md");
  if (!fs.existsSync(statePath)) return null;
  return parseState(fs.readFileSync(statePath, "utf8"));
}

function createProjectsRouter(sseHub) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const latestJobs = new Map();
    for (const job of sseHub.analysis?.listJobs() || []) {
      const prior = latestJobs.get(job.projectId);
      if (!prior || String(job.createdAt || "") > String(prior.createdAt || ""))
        latestJobs.set(job.projectId, job);
    }
    const projects = registry.loadProjects().map((project) => {
      const status = {
        ...getProjectStatus(project),
        ...require("../lib/projectMetadata").getProjectMetadata(project),
      };
      const brief = require("../lib/briefStore").briefSummary(project.id);
      if (brief && project.brief?.evidenceId === brief.evidenceId)
        brief.freshness = project.brief.freshness;
      const analysis = latestJobs.get(project.id) || null;
      if (status.availability !== "available")
        return {
          ...project,
          brief,
          analysis,
          ...status,
          progress: null,
          git: { status: "unavailable" },
          runningCount: 0,
        };
      try {
        const roadmap = readRoadmap(project.path);
        const state = readState(project.path);
        const progress = computeProgress(roadmap, state);
        const git = getMilestone(project.path);
        const runningCount = listRunning(project.path).length;
        return {
          ...project,
          brief,
          analysis,
          ...status,
          progress: status.gsdFormat === "none" ? null : progress,
          git,
          runningCount,
        };
      } catch (error) {
        return {
          ...project,
          ...status,
          brief,
          analysis,
          progress: null,
          git: { status: "inspection-error" },
          runningCount: 0,
          inspectionError: error.message,
        };
      }
    });
    res.json(projects);
  });

  router.post("/:id/analysis", (req, res) => {
    try {
      res.status(202).json(sseHub.analysis.enqueueAnalysis([req.params.id])[0]);
    } catch (e) {
      res.status(400).json({ message: e.message });
    }
  });

  router.post("/discover", (req, res) => res.json(reconcileProjects()));

  router.get("/folders", (req, res) => {
    try { res.json(require("../lib/folderBrowser").browseFolders(req.query.path)); }
    catch (error) { res.status(error.code === "ENOENT" ? 404 : 400).json({message:error.message}); }
  });

  router.get("/scan", (req, res) => {
    const { path: parentPath } = req.query;
    if (!parentPath) return res.status(400).json({ code: "MISSING_PATH" });
    try {
      res.json(scanDirectory(parentPath));
    } catch (err) {
      const statusByCode = { PATH_NOT_FOUND: 404 };
      res
        .status(statusByCode[err.code] || 500)
        .json({ code: err.code || "UNKNOWN", message: err.message });
    }
  });

  router.post("/", (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ code: "MISSING_PATH" });
    try {
      const project = registry.addProject(targetPath);
      res.status(201).json(project);
    } catch (err) {
      const statusByCode = {
        PATH_NOT_FOUND: 404,
        NOT_DIRECTORY: 400,
        ALREADY_ADDED: 409,
      };
      res
        .status(statusByCode[err.code] || 500)
        .json({ code: err.code || "UNKNOWN", message: err.message });
    }
  });

  router.delete("/:id", (req, res) => {
    registry.removeProject(req.params.id);
    res.status(204).end();
  });

  router.get("/:id/roadmap", (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: "NOT_FOUND" });
    try {
      res.json(readRoadmap(project.path));
    } catch (error) {
      res
        .status(422)
        .json({ code: "INSPECTION_ERROR", message: error.message });
    }
  });

  router.get("/:id/git", (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: "NOT_FOUND" });
    res.json(getMilestone(project.path));
  });

  router.get("/:id/activity/stream", (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: "NOT_FOUND" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    sseHub.subscribe(project.id, res, project.path);

    req.on("close", () => sseHub.unsubscribe(project.id, res));
  });

  return router;
}

module.exports = { createProjectsRouter };
