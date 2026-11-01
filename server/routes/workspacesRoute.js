const express = require("express");
const w = require("../lib/linkedWorkspaces");
function createWorkspacesRouter() {
  const router = express.Router();
  const act = (fn) => (req, res) => {
    try {
      res.json(fn(req));
    } catch (e) {
      res
        .status(
          e.code === "WORKSPACE_CONFLICT"
            ? 409
            : e.code === "NOT_FOUND"
              ? 404
              : 400,
        )
        .json({ code: e.code || "WORKSPACE_FAILED", message: e.message });
    }
  };
  router.get(
    "/",
    act(() => w.listWorkspaces()),
  );
  router.post(
    "/preview",
    act((req) =>
      w.prepareLinkedWorkspace(
        req.body.reportId,
        req.body.proposalId,
        req.body,
      ),
    ),
  );
  router.post(
    "/:id/create",
    act((req) => w.createLinkedWorkspace(req.params.id, req.body)),
  );
  router.post(
    "/:id/archive",
    act((req) => w.archiveWorkspace(req.params.id)),
  );
  router.post(
    "/:id/restore",
    act((req) => w.restoreWorkspace(req.params.id)),
  );
  return router;
}
module.exports = { createWorkspacesRouter };
