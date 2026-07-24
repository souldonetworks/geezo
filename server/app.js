const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { createSseHub } = require('./lib/sse');
const { createProjectsRouter } = require('./routes/projects');
const { createSettingsRouter } = require('./routes/settingsRoute');
const { createConvertRouter } = require('./routes/convertRoute');

function createApp() {
  const app = express();
  app.use(express.json());

  const sseHub = createSseHub();

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/projects', createProjectsRouter(sseHub));
  app.use('/api/settings', createSettingsRouter());
  app.use('/api/convert', createConvertRouter());

  const distDir = path.join(__dirname, '..', 'web', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
