const express = require('express');
const settings = require('../lib/settings');
const { launchConvert } = require('../lib/convert');

function createConvertRouter() {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { path: targetPath } = req.body;
    if (!targetPath) return res.status(400).json({ code: 'MISSING_PATH' });
    try {
      launchConvert(settings.loadSettings(), targetPath);
      res.status(202).json({ launched: true });
    } catch (err) {
      res.status(500).json({ code: 'LAUNCH_FAILED', message: err.message });
    }
  });

  return router;
}

module.exports = { createConvertRouter };
