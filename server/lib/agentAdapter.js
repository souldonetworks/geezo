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
          (code !== 0 ? providerFailure(code, output, diagnostics) : null),
      ),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
    if (signal?.aborted) abort();
  });
}
function analysisArguments(settings) {
  if (settings.adapter === "codex")
    return [
      "exec",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "--json",
      ...[
        "shell_tool",
        "multi_agent",
        "apps",
        "plugins",
        "hooks",
        "skill_search",
        "image_generation",
        "goals",
        "sleep_tool",
        "tool_suggest",
        "view_image",
      ].flatMap((feature) => ["--disable", feature]),
      "-c",
      "project_doc_max_bytes=0",
      "-c",
      'web_search="disabled"',
      "-",
    ];
  if (settings.adapter !== "claude")
    throw new Error("Unsupported analysis adapter");
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
function providerFailure(code, output, diagnostics) {
  let detail = diagnostics;
  try {
    const value = JSON.parse(output);
    if (value.is_error) detail = value.result || value.error || detail;
  } catch {
    try {
      const errors = output
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter(
          (event) =>
            event.type === "error" ||
            event.type === "turn.failed" ||
            event.item?.type === "error",
        );
      detail =
        errors
          .map(
            (event) =>
              event.message ||
              event.error?.message ||
              event.item?.message ||
              "",
          )
          .join("\n") || detail;
    } catch {}
  }
  return classifyProviderError(
    `Agent exited ${code}: ${String(detail || "Provider returned no diagnostic message").slice(-2000)}`,
  );
}
function classifyProviderError(message) {
  const error = new Error(String(message));
  if (
    /not logged in|please.*login|authenticate|invalid api key|unauthorized/i.test(
      error.message,
    )
  )
    error.code = "PROVIDER_AUTH_REQUIRED";
  else if (
    /rate limit|usage limit|credit balance|quota|429/i.test(error.message)
  )
    error.code = "PROVIDER_UNAVAILABLE";
  return error;
}

function parseAgentOutput(output) {
  let value;
  try {
    value = JSON.parse(output);
  } catch {
    const events = output
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    for (const event of events) {
      if (
        event.item &&
        !["agent_message", "reasoning", "error"].includes(event.item.type)
      )
        throw new Error(
          "Unexpected tool activity during source-only assessment",
        );
      if (
        event.type === "turn.failed" ||
        event.type === "error" ||
        event.item?.type === "error"
      )
        throw classifyProviderError(
          event.error?.message ||
            event.message ||
            event.item?.message ||
            "Provider failed",
        );
    }
    const messages = events.filter(
      (event) =>
        event.type === "item.completed" && event.item?.type === "agent_message",
    );
    if (!messages.length)
      throw new Error("Provider returned no final assessment");
    value = JSON.parse(
      messages.at(-1).item.text.replace(/^```(?:json)?\s*|\s*```$/g, ""),
    );
  }
  if (value.is_error)
    throw classifyProviderError(value.result || "Agent reported an error");
  if (value.structured_output) value = value.structured_output;
  else if (typeof value.result === "string")
    value = JSON.parse(value.result.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  return value;
}
module.exports = { runAgent, analysisArguments, parseAgentOutput };
