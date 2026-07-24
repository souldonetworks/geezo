const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry');
const { scanDirectory } = require('../lib/scanDirectory');
const { parseRoadmap } = require('../lib/roadmapParser');
const { parseState } = require('../lib/stateParser');
const { computeProgress } = require('../lib/progress');
const { getMilestone } = require('../lib/gitMilestone');
const { listRunning } = require('../lib/activityStore');

function readRoadmap(projectPath) {
  const roadmapPath = path.join(projectPath, '.planning', 'ROADMAP.md');
  const roadmapText = fs.existsSync(roadmapPath) ? fs.readFileSync(roadmapPath, 'utf8') : '';
  return parseRoadmap(roadmapText);
}

function readState(projectPath) {
  const statePath = path.join(projectPath, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return null;
  return parseState(fs.readFileSync(statePath, 'utf8'));
}

function createProjectsRouter(sseHub) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const projects = registry.loadProjects().map((project) => {
      const roadmap = readRoadmap(project.path);
      const state = readState(project.path);
      const progress = computeProgress(roadmap, state);
      const git = getMilestone(project.path);
      const runningCount = listRunning(project.path).length;
      return { ...project, progress, git, runningCount };
    });
    res.json(projects);
  });

  router.get('/scan', (req, res) => {
    const { path: parentPath } = req.query;
    if (!parentPath) return res.status(400).json({ code: 'MISSING_PATH' });
    try {
      res.json(scanDirectory(parentPath));
    } catch (err) {
      const statusByCode = { PATH_NOT_FOUND: 404 };
      res.status(statusByCode[err.code] || 500).json({ code: err.code || 'UNKNOWN', message: err.message });
    }
  });

  router.post('/', (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ code: 'MISSING_PATH' });
    try {
      const project = registry.addProject(targetPath);
      res.status(201).json(project);
    } catch (err) {
      const statusByCode = { PATH_NOT_FOUND: 404, NOT_GSD_PROJECT: 409, ALREADY_ADDED: 409 };
      res.status(statusByCode[err.code] || 500).json({ code: err.code || 'UNKNOWN', message: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    registry.removeProject(req.params.id);
    res.status(204).end();
  });

  router.get('/:id/roadmap', (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: 'NOT_FOUND' });
    res.json(readRoadmap(project.path));
  });

  router.get('/:id/git', (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: 'NOT_FOUND' });
    res.json(getMilestone(project.path));
  });

  router.get('/:id/activity/stream', (req, res) => {
    const project = registry.findProject(req.params.id);
    if (!project) return res.status(404).json({ code: 'NOT_FOUND' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    sseHub.subscribe(project.id, res, project.path);

    req.on('close', () => sseHub.unsubscribe(project.id, res));
  });

  return router;
}

module.exports = { createProjectsRouter };
