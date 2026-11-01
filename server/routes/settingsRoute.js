const express = require("express");
const settings = require("../lib/settings");

function createSettingsRouter() {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json(settings.loadSettings());
  });

  router.put("/", (req, res) => {
    try {
      res.json(settings.saveSettings(req.body || {}));
    } catch (error) {
      res
        .status(400)
        .json({
          code: error.code || "INVALID_SETTINGS",
          message: error.message,
        });
    }
  });

  return router;
}

module.exports = { createSettingsRouter };
