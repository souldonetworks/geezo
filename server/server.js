const { createApp } = require("./app");

const PORT = process.env.PORT || 4317;

if (require.main === module) {
  const app = createApp();
  const server = app.listen(PORT, "localhost", () => {
    console.log(`gsd-web server listening on http://localhost:${PORT}`);
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      app.locals.close();
      server.close();
    });
}

module.exports = { PORT };
