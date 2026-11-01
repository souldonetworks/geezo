const express = require("express");
const migration = require("../lib/migration");
const registry = require("../lib/registry");
function createMigrationRouter() {
  const router = express.Router({ mergeParams: true });
  router.use((req, res, next) => {
    if (!registry.findProject(req.params.id))
      return res.status(404).json({ code: "NOT_FOUND" });
    next();
  });
  const action = (fn) => (req, res) => {
    try {
      res.json(fn(req));
    } catch (e) {
      res
        .status(
          e.code === "MIGRATION_CONFLICT"
            ? 409
            : e.code === "NOT_FOUND"
              ? 404
              : 400,
        )
        .json({ code: e.code || "MIGRATION_FAILED", message: e.message });
    }
  };
  router.get(
    "/",
    action((req) => migration.listMigrations(req.params.id)),
  );
  router.post(
    "/",
    action((req) => migration.prepareMigration(req.params.id)),
  );
  router.get(
    "/:migrationId",
    action((req) =>
      migration.getMigration(req.params.id, req.params.migrationId),
    ),
  );
  router.post(
    "/:migrationId/apply",
    action((req) =>
      migration.applyMigration(req.params.id, req.params.migrationId, req.body),
    ),
  );
  router.post(
    "/:migrationId/rollback",
    action((req) =>
      migration.rollbackMigration(req.params.id, req.params.migrationId),
    ),
  );
  return router;
}
module.exports = { createMigrationRouter };
