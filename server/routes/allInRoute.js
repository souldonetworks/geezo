const express = require("express");
function createAllInRouter(service) {
  const router = express.Router();
  const act = (fn) => (req, res) => {
    try {
      res.json(fn(req));
    } catch (e) {
      res
        .status(e.code === "NOT_FOUND" ? 404 : 400)
        .json({ code: e.code || "ALL_IN_FAILED", message: e.message });
    }
  };
  router.get(
    "/",
    act(() => service.getState()),
  );
  router.post(
    "/run",
    act(() => service.startRun({ reason: "manual" })),
  );
  router.get(
    "/reports/:id",
    act((req) => {
      const r = service.getReport(req.params.id);
      if (!r)
        throw Object.assign(new Error("Report not found"), {
          code: "NOT_FOUND",
        });
      return r;
    }),
  );
  router.get(
    "/snapshots/:id",
    act((req) => {
      const r = service.getSnapshot(req.params.id);
      if (!r)
        throw Object.assign(new Error("Snapshot not found"), {
          code: "NOT_FOUND",
        });
      return r;
    }),
  );
  return router;
}
module.exports = { createAllInRouter };
