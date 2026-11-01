const express = require("express");
const { loadSettings } = require("../lib/settings");
function createAnalysisRouter(service) {
  const router = express.Router();
  router.get("/configuration", (req, res) => {
    const config = loadSettings().analysis;
    res.json({
      ...config,
      dataHandling:
        "Selected local evidence is sent through the configured CLI and account to its AI provider. Tools, project settings, hooks and MCP servers are disabled by the Claude adapter.",
      supported: config.adapter === "claude",
    });
  });
  router.post("/", (req, res) => {
    try {
      res.status(202).json(service.enqueueAnalysis(req.body.projectIds));
    } catch (e) {
      res.status(400).json({ code: "ANALYSIS_FAILED", message: e.message });
    }
  });
  router.get("/:jobId", (req, res) => {
    try {
      const job = service.getAnalysisJob(req.params.jobId);
      if (!job) return res.status(404).json({ code: "NOT_FOUND" });
      res.json(job);
    } catch (e) {
      res.status(400).json({ message: e.message });
    }
  });
  return router;
}
module.exports = { createAnalysisRouter };
