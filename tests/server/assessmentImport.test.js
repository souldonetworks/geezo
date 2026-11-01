const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function fixture() {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "import-home-"),
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "import-project-"));
  fs.mkdirSync(path.join(root, ".planning", "research"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".planning", "research", "ASSESSMENT.md"),
    "# Existing Project Assessment\n\n**Project:** Example\n**Assessment and expanded research:** 2026-11-01\n**Recommendation:** Extend an existing project for a bounded lab.\n\n## Executive verdict\n\nComponent tests passed historically. Real deployment is not verified.\n\n## Smallest credible demonstration\n\nProposed: exercise one disposable target.\n\n## Investment tiers\n\nRough estimates are not commitments.\n\n## Executive investment questions\n\n- **Buyer/problem:** Hypothesis: operators need less effort.\n- **Customer evidence:** Customer demand is unknown.\n- **Measurement:** Measure operator minutes.\n- **Ownership:** Owners remain unassigned.\n- **Continue:** Reproduce containment.\n- **Stop/rework:** Stop if demand is absent.\n",
  );
  return require("../../server/lib/registry").addProject(root);
}
test("research import preserves source, provenance, unknowns and accepted work and is idempotent", () => {
  const p = fixture();
  const { importAssessment } = require("../../server/lib/assessmentImport");
  const store = require("../../server/lib/briefStore");
  const before = fs.readFileSync(
    path.join(p.path, ".planning/research/ASSESSMENT.md"),
    "utf8",
  );
  const first = importAssessment(p.id);
  assert.equal(first.revision.source, "import");
  assert.equal(first.revision.brief.recommendation.decision, "Explore");
  assert.equal(first.revision.provenance.kind, "existing-research");
  assert.equal(store.getBriefRecord(p.id).acceptedRevision, null);
  assert.equal(importAssessment(p.id).revision.id, first.revision.id);
  assert.equal(store.getBriefRecord(p.id).revisions.length, 1);
  assert.ok(first.revision.brief.delivery.some((c) => c.status === "unknown"));
  assert.equal(first.revision.brief.opportunities.length, 0);
  store.acceptRevision(p.id, {
    revisionId: first.revision.id,
    expectedAcceptedRevision: null,
  });
  fs.appendFileSync(
    path.join(p.path, ".planning/research/ASSESSMENT.md"),
    "\nNew observation.",
  );
  const updated = importAssessment(p.id);
  assert.notEqual(updated.revision.id, first.revision.id);
  assert.equal(store.getBriefRecord(p.id).acceptedRevision, first.revision.id);
  assert.equal(
    fs.readFileSync(
      path.join(p.path, ".planning/research/ASSESSMENT.md"),
      "utf8",
    ),
    before + "\nNew observation.",
  );
  const snap = require("../../server/lib/evidence").readEvidence(
    p.id,
    first.revision.evidenceId,
  );
  assert.equal(
    snap.files.find((f) => f.path.endsWith("ASSESSMENT.md")).text,
    before,
  );
});
test("absent assessment and symlinked source are rejected without fabricating research", () => {
  const p = fixture();
  const file = path.join(p.path, ".planning/research/ASSESSMENT.md");
  fs.unlinkSync(file);
  const { importAssessment } = require("../../server/lib/assessmentImport");
  assert.throws(() => importAssessment(p.id), /assessment/i);
  fs.symlinkSync("/etc/passwd", file);
  assert.throws(() => importAssessment(p.id), /assessment/i);
});
