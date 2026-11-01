const express = require("express");
const lenses = require("../lib/lenses");
function createLensesRouter() {
  const router = express.Router();
  const act = (fn) => (req, res) => {
    try {
      res.json(fn(req));
    } catch (e) {
      res
        .status(
          ["LENS_CONFLICT", "LENS_IN_USE"].includes(e.code)
            ? 409
            : e.code === "NOT_FOUND"
              ? 404
              : 400,
        )
        .json({ code: e.code || "INVALID_LENS", message: e.message });
    }
  };
  router.get(
    "/",
    act(() => lenses.listLenses()),
  );
  router.post(
    "/",
    act((req) => lenses.createLens(req.body)),
  );
  router.get(
    "/:id",
    act((req) =>
      lenses.getLensSnapshot(
        req.params.id,
        req.query.version ? Number(req.query.version) : undefined,
      ),
    ),
  );
  router.put(
    "/:id",
    act((req) => lenses.updateLens(req.params.id, req.body)),
  );
  router.delete(
    "/:id",
    act((req) => lenses.deleteLens(req.params.id, req.body.expectedVersion)),
  );
  return router;
}
module.exports = { createLensesRouter };
