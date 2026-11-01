const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
test("evidence is bounded, ignores secrets and links, and detects same-size changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-"));
  fs.writeFileSync(path.join(root, "README.md"), "first");
  fs.writeFileSync(path.join(root, ".env"), "SECRET");
  fs.mkdirSync(path.join(root, "keys"));
  fs.writeFileSync(path.join(root, "keys", "README.md"), "SECRET");
  fs.symlinkSync("/etc/passwd", path.join(root, "external.md"));
  const {
    collectEvidence,
    compareEvidence,
  } = require("../../server/lib/evidence");
  const before = collectEvidence(root);
  assert.deepEqual(
    before.files.map((f) => f.path),
    ["README.md"],
  );
  assert.equal(before.complete, true);
  fs.writeFileSync(path.join(root, "README.md"), "other");
  assert.equal(compareEvidence(before, collectEvidence(root)), "stale");
  const limited = collectEvidence(root, { maxTotalBytes: 2 });
  assert.equal(limited.complete, false);
  assert.equal(limited.files.length, 0);
  assert.equal(compareEvidence(before, limited), "possibly-stale");
});
