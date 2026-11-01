const { parseArgs } = require("node:util");
const path = require("node:path");
const os = require("node:os");
const { createApp } = require("./app");
const { runHookFromStdin } = require("../hooks/gsd-web-hook");
const { installHooks } = require("../scripts/install-hook");
const pkg = require("../package.json");

function printUsage() {
  console.log(
    [
      "Usage: gsd-web <command> [options]",
      "",
      "Commands:",
      "  serve [--port <n>] [--host <host>]  Start the dashboard server (default port 4317, host localhost)",
      "  hook                                 Read a Claude Code hook event from stdin and record activity",
      "  install-hook                         Register this binary as a Claude Code hook in ~/.claude/settings.json",
      "",
      "Options:",
      "  --help, -h                           Show this help message",
      "  --version                             Print the version number",
    ].join("\n"),
  );
}

function resolvePort({ portFlag, portEnv }) {
  if (portFlag !== undefined) return Number(portFlag);
  if (portEnv !== undefined) return Number(portEnv);
  return 4317;
}

function resolveHost(hostFlag) {
  return hostFlag || "localhost";
}

async function serveEmbeddedAsset(req, res) {
  let assetsModule;
  try {
    assetsModule = await import("./generatedAssets.mjs");
  } catch (err) {
    console.error(
      "Embedded frontend assets not found. This binary may have been built incorrectly, " +
        "or you are running server/cli.js directly without generating assets first " +
        "(run: npm run build:web && node scripts/generate-assets-manifest.js).",
    );
    process.exit(1);
    return;
  }
  const filePath =
    assetsModule.manifest[req.path] || assetsModule.manifest["/index.html"];
  res.sendFile(filePath);
}

function dispatch(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printUsage();
    return 0;
  }

  if (subcommand === "--version") {
    console.log(pkg.version);
    return 0;
  }

  if (subcommand === "serve") {
    const { values } = parseArgs({
      args: rest,
      options: {
        port: { type: "string" },
        host: { type: "string" },
      },
      allowPositionals: false,
    });

    const port = resolvePort({
      portFlag: values.port,
      portEnv: process.env.PORT,
    });
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.error("Invalid port: " + values.port);
      return 1;
    }

    const host = resolveHost(values.host);
    if (host !== "localhost" && host !== "127.0.0.1") {
      console.log(
        "Warning: binding to non-localhost host " +
          host +
          " - dashboard will be reachable on your network.",
      );
    }

    const app = createApp();
    app.get(/^\/(?!api).*/, serveEmbeddedAsset);

    const server = app.listen(port, host, () => {
      console.log(`gsd-web server listening on http://${host}:${port}`);
    });
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        app.locals.close();
        server.close();
      });
    return undefined;
  }

  if (subcommand === "hook") {
    runHookFromStdin();
    return undefined;
  }

  if (subcommand === "install-hook") {
    const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
    const execPath = process.execPath;
    const hookCommand = execPath + " hook";
    try {
      installHooks(hookCommand, settingsPath);
      console.log("Installed hooks pointing at " + hookCommand);
      return 0;
    } catch (err) {
      console.error(err.message);
      return 1;
    }
  }

  console.error("Unknown command: " + subcommand);
  printUsage();
  return 1;
}

if (require.main === module) {
  const code = dispatch(process.argv.slice(2));
  if (typeof code === "number") process.exit(code);
}

module.exports = {
  dispatch,
  resolvePort,
  resolveHost,
  printUsage,
  serveEmbeddedAsset,
};
