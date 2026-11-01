const express = require("express");
const { updateMetadata } = require("../lib/projectMetadata");
const { findRelated } = require("../lib/relatedProjects");
function createMetadataRouter() {
  const router = express.Router();
  router.patch("/:id/metadata", (req, res) => {
    try {
      res.json(updateMetadata(req.params.id, req.body));
    } catch (e) {
      res
        .status(
          e.code === "METADATA_CONFLICT"
            ? 409
            : e.code === "NOT_FOUND"
              ? 404
              : 400,
        )
        .json({ code: e.code || "INVALID_METADATA", message: e.message });
    }
  });
  router.get("/:id/related", (req, res) => {
    try {
      res.json(findRelated({ projectId: req.params.id }));
    } catch (e) {
      res
        .status(e.code === "NOT_FOUND" ? 404 : 400)
        .json({ message: e.message });
    }
  });
  return router;
}
module.exports = { createMetadataRouter };
