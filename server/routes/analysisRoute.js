const express = require("express");
const { loadSettings } = require("../lib/settings");
function createAnalysisRouter(service) {
  const router = express.Router();
  router.get("/configuration", (req, res) => {
    const config = loadSettings().analysis;
    res.json({
      ...config,
      dataHandling:
        "Selected local evidence is sent through the configured CLI and account to its AI provider. Claude uses no tools. ChatGPT via Codex runs with shell execution, plugins, connectors and hooks disabled in a read-only sandbox; any reported tool activity is rejected.",
      supported: ["claude", "codex"].includes(config.adapter),
      providerBlock: service.getProviderBlock(),
    });
  });
  router.post("/resume", (req, res) => res.json(service.resumeAnalysis()));
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
