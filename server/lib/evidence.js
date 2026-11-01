const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { gsdWebDir } = require("./paths");
const { readJson, writeJsonAtomic } = require("./atomicStore");
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");
const excluded =
  /^(node_modules|vendor|dist|dist-bin|build|coverage|target|bin|obj|keys?|credentials?|secrets?|\.git|\.aws|\.ssh|\.codex|\.claude|\.agents|\.worktrees|\.superpowers)$/i;
const sensitive =
  /(^|[._-])(env|secret|credential|token|password|private|key)([._-]|$)|lock\.(json|yaml)$|package-lock\.json|\.min\./i;
function collectEvidence(projectPath, options = {}) {
  const limits = {
    maxFiles: 200,
    maxFileBytes: 65536,
    maxTotalBytes: 1048576,
    maxDepth: 4,
    ...options,
  };
  const files = [];
  const omissions = [];
  let bytes = 0;
  let visited = 0;
  let complete = true;
  function omit(file, reason) {
    complete = false;
    if (omissions.length < 100) omissions.push({ path: file, reason });
  }
  function walk(dir, depth) {
    if (visited > 4000) {
      omit(path.relative(projectPath, dir), "traversal limit");
      return;
    }
    let entries;
    try {
      entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      omit(path.relative(projectPath, dir), e.code);
      return;
    }
    for (const entry of entries) {
      if (++visited > 4000) {
        omit("", "traversal limit");
        return;
      }
      if (
        entry.isSymbolicLink() ||
        excluded.test(entry.name) ||
        sensitive.test(entry.name) ||
        (entry.name.startsWith(".") &&
          ![".planning", ".gsd"].includes(entry.name))
      )
        continue;
      const absolute = path.join(dir, entry.name);
      const relative = path
        .relative(projectPath, absolute)
        .split(path.sep)
        .join("/");
      if (entry.isDirectory()) {
        if (depth < limits.maxDepth) walk(absolute, depth + 1);
        else omit(relative, "depth limit");
        continue;
      }
      if (
        !entry.isFile() ||
        !(
          /\.(md|txt|json|ya?ml|toml|js|jsx|ts|tsx|go|py|rb|cs|pp|sh)$/i.test(
            entry.name,
          ) || /^(Makefile|Gemfile|Dockerfile|LICENSE)$/i.test(entry.name)
        )
      )
        continue;
      try {
        const stat = fs.lstatSync(absolute);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        if (
          files.length >= limits.maxFiles ||
          stat.size > limits.maxFileBytes ||
          bytes + stat.size > limits.maxTotalBytes
        ) {
          omit(relative, "size or file limit");
          continue;
        }
        const fd = fs.openSync(
          absolute,
          fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
        );
        let data;
        try {
          const buffer = Buffer.alloc(limits.maxFileBytes + 1);
          const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
          data = buffer.subarray(0, length);
        } finally {
          fs.closeSync(fd);
        }
        if (
          data.length > limits.maxFileBytes ||
          bytes + data.length > limits.maxTotalBytes
        ) {
          omit(relative, "size limit");
          continue;
        }
        if (data.includes(0)) continue;
        const content = data.toString("utf8");
        if (
          /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:AKIA|ASIA)[A-Z0-9]{16}|(?:api[_-]?key|password|access[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i.test(
            content,
          )
        ) {
          omit(relative, "potential credential content");
          continue;
        }
        bytes += data.length;
        files.push({
          path: relative,
          hash: hash(data),
          text: content,
          lines: content.split("\n").length,
        });
      } catch (e) {
        omit(relative, e.code || e.message);
      }
    }
  }
  walk(projectPath, 0);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    id: crypto.randomUUID(),
    observedAt: new Date().toISOString(),
    files,
    fingerprint: hash(JSON.stringify(files.map((f) => [f.path, f.hash]))),
    complete,
    omissions,
  };
}
function compareEvidence(before, current) {
  if (!before?.complete || !current.complete) return "possibly-stale";
  return before.fingerprint === current.fingerprint ? "fresh" : "stale";
}
function evidencePath(projectId, id) {
  if (!/^[a-zA-Z0-9-]+$/.test(projectId) || !/^[a-zA-Z0-9-]+$/.test(id))
    throw new Error("Invalid evidence ID");
  return path.join(gsdWebDir(), "evidence", projectId, `${id}.json`);
}
function saveEvidence(projectId, evidence) {
  writeJsonAtomic(evidencePath(projectId, evidence.id), evidence);
  return evidence;
}
function readEvidence(projectId, id) {
  return readJson(evidencePath(projectId, id), null);
}
module.exports = {
  collectEvidence,
  compareEvidence,
  saveEvidence,
  readEvidence,
};
