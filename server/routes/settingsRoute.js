const express = require('express');
const settings = require('../lib/settings');

function createSettingsRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(settings.loadSettings());
  });

  router.put('/', (req, res) => {
    res.json(settings.saveSettings(req.body || {}));
  });

  return router;
}

module.exports = { createSettingsRouter };
