const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const { createSseHub } = require("./lib/sse");
const { createProjectsRouter } = require("./routes/projects");
const { createSettingsRouter } = require("./routes/settingsRoute");
const { createConvertRouter } = require("./routes/convertRoute");

function createApp(options = {}) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin) {
      try {
        const url = new URL(origin);
        if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
          return res.status(403).json({ code: "FOREIGN_ORIGIN" });
      } catch {
        return res.status(403).json({ code: "FOREIGN_ORIGIN" });
      }
    }
    next();
  });
  const sseHub = createSseHub();
  if (options.discovery !== false) {
    const stop = require("./lib/discovery").startDiscovery();
    app.locals.stopDiscovery = stop;
  }

  const analysis = require("./lib/analysisJobs").createAnalysisService();
  app.locals.analysis = analysis;
  app.use("/api/lenses", require("./routes/lensesRoute").createLensesRouter());
  require("./lib/linkedWorkspaces").recoverWorkspaces();
  app.use(
    "/api/workspaces",
    require("./routes/workspacesRoute").createWorkspacesRouter(),
  );
  const allIn = require("./lib/allIn").createAllInService();
  const stopAllInSchedule =
    options.discovery !== false && options.scheduling !== false
      ? require("./lib/allInScheduler").startAllInScheduler(allIn)
      : () => {};
  app.use(
    "/api/all-in",
    require("./routes/allInRoute").createAllInRouter(allIn),
  );
  sseHub.analysis = analysis;
  app.locals.close = () => {
    app.locals.stopDiscovery?.();
    analysis.stop();
    stopAllInSchedule();
    allIn.stop();
  };
  require("./lib/migration").recoverMigrations();
  app.use(
    "/api/projects/:id/migrations",
    require("./routes/migrationRoute").createMigrationRouter(),
  );
  app.use(
    "/api/analysis",
    require("./routes/analysisRoute").createAnalysisRouter(analysis),
  );
  app.use(
    "/api/projects/:id/brief",
    require("./routes/briefsRoute").createBriefsRouter(),
  );
  app.get("/api/briefings", (req, res) =>
    res.json(require("./lib/briefings").getBriefings(analysis.listJobs())),
  );
  app.get("/api/opportunities", (req, res) => {
    const records = require("./lib/registry")
      .loadProjects()
      .flatMap((p) => {
        const r = require("./lib/briefStore").getBriefRecord(p.id);
        const brief = r.revisions.find((v) => v.id === r.acceptedRevision);
        return (brief?.brief.opportunities || []).map((o) => ({
          ...o,
          projectIds: [...new Set([...(o.projectIds || []), p.id])],
        }));
      });
    res.json(require("./lib/opportunities").aggregateOpportunities(records));
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api/projects",
    require("./routes/metadataRoute").createMetadataRouter(),
  );
  app.get("/api/related", (req, res) => {
    try {
      res.json(
        require("./lib/relatedProjects").findRelated({
          query: req.query.q || "",
          category: req.query.category || "all",
        }),
      );
    } catch (e) {
      res.status(400).json({ message: e.message });
    }
  });
  app.use("/api/projects", createProjectsRouter(sseHub));
  app.use("/api/settings", createSettingsRouter());
  app.use("/api/convert", createConvertRouter());

  const distDir = path.join(__dirname, "..", "web", "dist");
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  return app;
}

module.exports = { createApp };
