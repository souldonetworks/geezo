const express = require("express");
const registry = require("../lib/registry");
const store = require("../lib/briefStore");
const { exportMarkdown } = require("../lib/briefSchema");
function createBriefsRouter() {
  const router = express.Router({ mergeParams: true });
  router.use((req, res, next) => {
    if (!registry.findProject(req.params.id))
      return res.status(404).json({ code: "NOT_FOUND" });
    next();
  });
  const action = (fn) => (req, res) => {
    try {
      fn(req, res);
    } catch (e) {
      res
        .status(
          e.code === "REVISION_CONFLICT"
            ? 409
            : e.code === "NOT_FOUND"
              ? 404
              : 400,
        )
        .json({ code: e.code || "INVALID_BRIEF", message: e.message });
    }
  };
  router.get(
    "/",
    action((req, res) => res.json(store.getBriefRecord(req.params.id))),
  );
  router.post(
    "/",
    action((req, res) => {
      const record = store.getBriefRecord(req.params.id);
      const parent = record.revisions.find(
        (r) => r.id === req.body.parentRevision,
      );
      if (req.body.parentRevision && !parent)
        throw Object.assign(new Error("Base revision not found"), {
          code: "REVISION_CONFLICT",
        });
      const evidence = parent?.evidenceId
        ? require("../lib/evidence").readEvidence(
            req.params.id,
            parent.evidenceId,
          )
        : { files: [] };
      if (parent?.evidenceId && !evidence)
        throw Object.assign(new Error("Base evidence snapshot unavailable"), {
          code: "INVALID_BRIEF",
        });
      res.status(201).json(
        store.createRevision(req.params.id, {
          ...req.body,
          source: "human",
          evidenceId: parent?.evidenceId || null,
          evidence,
          provenance: parent?.provenance || null,
          assessmentLens: parent?.assessmentLens || null,
          promptVersion: parent?.promptVersion || "executive-review-v1",
        }),
      );
    }),
  );
  router.post(
    "/accept",
    action((req, res) =>
      res.json(store.acceptRevision(req.params.id, req.body)),
    ),
  );
  router.get(
    "/evidence/:evidenceId",
    action((req, res) => {
      const record = store.getBriefRecord(req.params.id);
      if (!record.revisions.some((r) => r.evidenceId === req.params.evidenceId))
        throw Object.assign(new Error("Evidence not found"), {
          code: "NOT_FOUND",
        });
      const evidence = require("../lib/evidence").readEvidence(
        req.params.id,
        req.params.evidenceId,
      );
      if (!evidence)
        throw Object.assign(new Error("Evidence snapshot unavailable"), {
          code: "NOT_FOUND",
        });
      res.json(evidence);
    }),
  );
  router.post(
    "/import",
    action((req, res) =>
      res.json(
        require("../lib/assessmentImport").importAssessment(req.params.id),
      ),
    ),
  );
  router.get(
    "/history",
    action((req, res) =>
      res.json(store.getBriefRecord(req.params.id).revisions),
    ),
  );
  router.get(
    "/export",
    action((req, res) => {
      const record = store.getBriefRecord(req.params.id);
      const revision = record.revisions.find(
        (r) =>
          r.id ===
          (req.query.revision ||
            record.acceptedRevision ||
            record.latestHuman ||
            record.latestDraft),
      );
      if (!revision)
        throw Object.assign(new Error("No brief revision"), {
          code: "NOT_FOUND",
        });
      res
        .type("text/markdown")
        .attachment("executive-project-brief.md")
        .send(exportMarkdown(revision));
    }),
  );
  return router;
}
module.exports = { createBriefsRouter };
