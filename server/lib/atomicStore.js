const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function readJson(file, fallback) {
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : fallback;
}
// Synchronous updates cannot interleave inside this single local server process.
function updateJson(file, updater) {
  const value = updater(readJson(file, null));
  writeJsonAtomic(file, value);
  return value;
}
module.exports = { writeJsonAtomic, readJson, updateJson };
