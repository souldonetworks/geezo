const { spawn } = require("node:child_process");
function runAgent(
  {
    executable,
    args,
    cwd,
    prompt,
    timeoutMs = 300000,
    maxOutputBytes = 2097152,
  },
  { signal } = {},
) {
  return new Promise((resolve, reject) => {
    let output = "";
    let diagnostics = "";
    let total = 0;
    let failure;
    let settled = false;
    const child = spawn(executable, args, {
      cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: { ...process.env, CLAUDECODE: undefined },
    });
    function kill(error) {
      failure = error;
      try {
        if (process.platform !== "win32" && child.pid)
          process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }
    const timer = setTimeout(
      () => kill(new Error("Agent timed out")),
      timeoutMs,
    );
    const abort = () => kill(new Error("Analysis cancelled"));
    signal?.addEventListener("abort", abort, { once: true });
    function done(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve({ output, diagnostics });
    }
    function chunk(data, kind) {
      total += data.length;
      if (total > maxOutputBytes) {
        kill(new Error("Agent output limit exceeded"));
        return;
      }
      if (kind === "out") output += data.toString();
      else diagnostics += data.toString();
    }
    child.stdout.on("data", (data) => chunk(data, "out"));
    child.stderr.on("data", (data) => chunk(data, "err"));
    child.on("error", done);
    child.on("close", (code) =>
      done(
        failure ||
          (code !== 0
            ? new Error(`Agent exited ${code}: ${diagnostics.slice(-2000)}`)
            : null),
      ),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
    if (signal?.aborted) abort();
  });
}
function analysisArguments(settings) {
  if (settings.adapter !== "claude")
    throw Object.assign(
      new Error(
        "Only the Claude tool-free adapter is currently supported. Select Claude in Settings; Codex requires a verified tool-free adapter.",
      ),
      { code: "UNSUPPORTED_ADAPTER" },
    );
  return [
    "--print",
    "--output-format",
    "json",
    "--tools",
    "",
    "--restricted",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-session-persistence",
    "--settings",
    '{"disableAllHooks":true}',
  ];
}
function parseAgentOutput(output) {
  let value = JSON.parse(output);
  if (value.is_error)
    throw new Error(value.result || "Agent reported an error");
  if (value.structured_output) value = value.structured_output;
  else if (typeof value.result === "string")
    value = JSON.parse(value.result.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  return value;
}
module.exports = { runAgent, analysisArguments, parseAgentOutput };
