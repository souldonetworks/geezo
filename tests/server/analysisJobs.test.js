const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
test("agent process reports bounded output, timeout, malformed output and literal arguments", async () => {
  const { runAgent } = require("../../server/lib/agentAdapter");
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "agent-test-"));
  assert.equal(
    (
      await runAgent({
        executable: process.execPath,
        args: ["-e", "process.stdout.write(process.argv[1])", "literal '$() ü"],
        cwd,
        prompt: "",
        timeoutMs: 1000,
        maxOutputBytes: 1000,
      })
    ).output,
    "literal '$() ü",
  );
  await assert.rejects(
    runAgent({
      executable: process.execPath,
      args: ["-e", 'process.stdout.write("x".repeat(1000))'],
      cwd,
      prompt: "",
      timeoutMs: 1000,
      maxOutputBytes: 100,
    }),
    /output limit/,
  );
  await assert.rejects(
    runAgent({
      executable: process.execPath,
      args: ["-e", "setTimeout(()=>{},10000)"],
      cwd,
      prompt: "",
      timeoutMs: 20,
      maxOutputBytes: 100,
    }),
    /timed out/,
  );
  await assert.rejects(
    runAgent({
      executable: "missing-geezo-command",
      args: [],
      cwd,
      prompt: "",
      timeoutMs: 1000,
      maxOutputBytes: 100,
    }),
    /ENOENT/,
  );
});
test("analysis saves validated draft and evidence; invalid output leaves it intact; restart interrupts jobs", async () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "analysis-home-"),
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "analysis-project-"));
  fs.writeFileSync(path.join(root, "README.md"), "A project");
  const registry = require("../../server/lib/registry");
  const project = registry.addProject(root);
  const { createAnalysisService } = require("../../server/lib/analysisJobs");
  const valid = {
    purpose: "experiment",
    opportunities: [],
    recommendation: {
      decision: "Explore",
      claims: [
        { text: "Validate demand", status: "proposed", evidenceRefs: [] },
      ],
    },
    customerPromise: [
      { text: "A project", status: "confirmed", evidenceRefs: ["README.md:1"] },
    ],
    whyNow: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    valueModel: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    delivery: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    executiveAsk: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    unansweredQuestions: [
      {
        text: "Investigator unknown; next step is to review existing evidence.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
  };
  const service = createAnalysisService({
    runner: async () => ({ output: JSON.stringify(valid), diagnostics: "" }),
  });
  const job = service.enqueueAnalysis([project.id])[0];
  await service.whenIdle();
  assert.equal(service.getAnalysisJob(job.id).status, "completed");
  const record = require("../../server/lib/briefStore").getBriefRecord(
    project.id,
  );
  assert.equal(record.revisions.length, 1);
  assert.ok(record.revisions[0].evidenceId);
  const bad = createAnalysisService({
    runner: async () => ({ output: "not JSON", diagnostics: "" }),
  });
  const failed = bad.enqueueAnalysis([project.id])[0];
  await bad.whenIdle();
  assert.equal(bad.getAnalysisJob(failed.id).status, "failed");
  assert.equal(
    require("../../server/lib/briefStore").getBriefRecord(project.id).revisions
      .length,
    1,
  );
  const store = require("../../server/lib/atomicStore");
  store.writeJsonAtomic(
    path.join(
      process.env.GSD_WEB_HOME_OVERRIDE,
      "analysis-jobs",
      "interrupted.json",
    ),
    { id: "interrupted", status: "running" },
  );
  const resumed = createAnalysisService({
    runner: async () => {
      throw new Error("must not run");
    },
  });
  assert.equal(resumed.getAnalysisJob("interrupted").status, "interrupted");
});
