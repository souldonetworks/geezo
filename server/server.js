const { createApp } = require('./app');

const PORT = process.env.PORT || 4317;

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`gsd-web server listening on http://localhost:${PORT}`);
  });
}

module.exports = { PORT };
