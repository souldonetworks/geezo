const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
function setup() {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "all-in-home-"),
  );
  const r = require("../../server/lib/registry");
  return [1, 2].map((n) =>
    r.addProject(fs.mkdtempSync(path.join(os.tmpdir(), `related-${n}-`))),
  );
}
function report(ids) {
  return {
    summary: "Two complementary projects may support one useful tool.",
    gaps: ["Customer demand is unknown."],
    recommendations: [
      {
        type: "combine",
        projectIds: ids,
        workingName: "Puppet Widget Project",
        description:
          "A proposed tool combining the existing project capabilities.",
        audience: "Infrastructure operators (hypothesis)",
        problem: "Repeated operational effort (hypothesis)",
        value: "Proposed simpler workflow; demand unvalidated.",
        confidence: "hypothesis",
        reasons: ["Shared workflow needs validation."],
        risks: ["Unknown ownership."],
        steps: ["Inspect interfaces", "Validate a smallest integrated slice"],
        successCriteria: ["A repeatable useful workflow"],
        evidence: ids.map((projectId) => ({
          projectId,
          field: "description",
          observation: "Source project purpose may fit.",
        })),
      },
    ],
  };
}
test("All In validates source identities and preserves the last successful report after provider failure", async () => {
  const p = setup();
  const { createAllInService } = require("../../server/lib/allIn");
  let fail = false;
  let calls = 0;
  const service = createAllInService({
    runner: async () => {
      calls++;
      if (fail) throw new Error("Provider unavailable");
      return {
        output: JSON.stringify(report(p.map((v) => v.id))),
        diagnostics: "",
      };
    },
  });
  const first = service.startRun({ reason: "manual" });
  assert.equal(service.startRun({ reason: "manual" }).id, first.id);
  await service.whenIdle();
  let state = service.getState();
  assert.equal(state.run.status, "completed");
  assert.equal(state.currentReport.coverage.total, 2);
  assert.equal(state.currentReport.recommendations[0].projectIds.length, 2);
  const prior = state.currentReport.id;
  fail = true;
  service.startRun({ reason: "manual" });
  await service.whenIdle();
  state = service.getState();
  assert.equal(state.run.status, "failed");
  assert.equal(state.currentReport.id, prior);
  assert.equal(calls, 2);
});
test("All In rejects invented members and evidence instead of saving an actionable proposal", async () => {
  const p = setup();
  const {
    makePortfolioSnapshot,
    validateAllInReport,
  } = require("../../server/lib/allIn");
  const snapshot = makePortfolioSnapshot();
  const bad = report([p[0].id, "invented"]);
  assert.throws(
    () => validateAllInReport(bad, snapshot),
    (e) => e.code === "INVALID_ALL_IN",
  );
  const valid = report(p.map((v) => v.id));
  valid.recommendations[0].evidence[0].field = "invented-field";
  assert.throws(
    () => validateAllInReport(valid, snapshot),
    (e) => e.code === "INVALID_ALL_IN",
  );
});
test("daily scheduling uses local due dates, catches missed runs and does not retry repeatedly on a failed day", () => {
  const {
    dueDailyKey,
    shouldRunDaily,
  } = require("../../server/lib/allInScheduler");
  const config = { enabled: true, time: "08:00", timeZone: "America/Chicago" };
  assert.equal(
    dueDailyKey(config, new Date("2026-11-01T15:00:00Z")),
    "2026-11-01",
  );
  assert.equal(
    dueDailyKey(config, new Date("2026-11-01T12:00:00Z")),
    "2026-10-31",
  );
  assert.equal(
    shouldRunDaily(
      config,
      { lastAttemptDay: "2026-10-30" },
      new Date("2026-11-01T12:00:00Z"),
    ),
    true,
  );
  assert.equal(
    shouldRunDaily(
      config,
      { lastAttemptDay: "2026-11-01", run: { status: "failed" } },
      new Date("2026-11-01T18:00:00Z"),
    ),
    false,
  );
  assert.equal(
    shouldRunDaily(
      config,
      { run: { status: "running" } },
      new Date("2026-11-01T18:00:00Z"),
    ),
    false,
  );
});
