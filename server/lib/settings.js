const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { writeJsonAtomic } = require("./atomicStore");
const { settingsFile, gsdWebDir } = require("./paths");

const DEFAULTS = {
  portfolio: {
    roots: [path.join(os.homedir(), "Code")],
    exclusions: [],
    scanIntervalMs: 60000,
  },
  allIn: {
    enabled: true,
    time: "08:00",
    timeZone: "America/Chicago",
    workspaceRoot: path.join(os.homedir(), "Code", "Projects"),
  },
  analysis: {
    adapter: "claude",
    executable: "claude",
    concurrency: 1,
    timeoutMs: 300000,
    maxOutputBytes: 2097152,
  },
  cliTool: "claude",
  terminalApp: "Terminal",
  commandTemplates: {
    claude: 'claude "/gsd:new-project"',
    codex: "codex",
    gemini: "gemini",
  },
};

function ensureDir() {
  fs.mkdirSync(gsdWebDir(), { recursive: true });
}

function loadSettings() {
  ensureDir();
  if (!fs.existsSync(settingsFile())) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  const raw = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
  return {
    ...DEFAULTS,
    ...raw,
    portfolio: { ...DEFAULTS.portfolio, ...raw.portfolio },
    analysis: { ...DEFAULTS.analysis, ...raw.analysis },
    allIn: { ...DEFAULTS.allIn, ...raw.allIn },
    commandTemplates: {
      ...DEFAULTS.commandTemplates,
      ...(raw.commandTemplates || {}),
    },
  };
}

function saveSettings(partial) {
  const current = loadSettings();
  const merged = {
    ...current,
    ...partial,
    portfolio: { ...current.portfolio, ...partial.portfolio },
    analysis: { ...current.analysis, ...partial.analysis },
    allIn: { ...current.allIn, ...partial.allIn },
    commandTemplates: {
      ...current.commandTemplates,
      ...(partial.commandTemplates || {}),
    },
  };
  if (
    !Array.isArray(merged.portfolio.roots) ||
    !merged.portfolio.roots.every(
      (p) => typeof p === "string" && path.isAbsolute(p),
    ) ||
    !Array.isArray(merged.portfolio.exclusions) ||
    !merged.portfolio.exclusions.every(
      (p) => typeof p === "string" && path.isAbsolute(p),
    ) ||
    !Number.isInteger(merged.portfolio.scanIntervalMs) ||
    merged.portfolio.scanIntervalMs < 1000
  )
    throw Object.assign(new Error("Invalid portfolio settings"), {
      code: "INVALID_SETTINGS",
    });
  if (
    !["claude", "codex"].includes(merged.analysis.adapter) ||
    typeof merged.analysis.executable !== "string" ||
    !merged.analysis.executable.trim() ||
    !Number.isInteger(merged.analysis.concurrency) ||
    merged.analysis.concurrency < 1 ||
    merged.analysis.concurrency > 4 ||
    !Number.isInteger(merged.analysis.timeoutMs) ||
    merged.analysis.timeoutMs < 1000 ||
    merged.analysis.timeoutMs > 3600000 ||
    !Number.isInteger(merged.analysis.maxOutputBytes) ||
    merged.analysis.maxOutputBytes < 1024 ||
    merged.analysis.maxOutputBytes > 8388608
  )
    throw Object.assign(new Error("Invalid analysis limits or adapter"), {
      code: "INVALID_SETTINGS",
    });
  if (
    typeof merged.allIn.enabled !== "boolean" ||
    !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(merged.allIn.time) ||
    typeof merged.allIn.timeZone !== "string" ||
    !path.isAbsolute(merged.allIn.workspaceRoot)
  )
    throw Object.assign(
      new Error("Invalid All In schedule or workspace root"),
      { code: "INVALID_SETTINGS" },
    );
  try {
    new Intl.DateTimeFormat("en", { timeZone: merged.allIn.timeZone });
  } catch {
    throw Object.assign(new Error("Invalid schedule timezone"), {
      code: "INVALID_SETTINGS",
    });
  }
  ensureDir();
  writeJsonAtomic(settingsFile(), merged);
  return merged;
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
