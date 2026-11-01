const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function unknownAssessment() {
  const claim = {
    text: "Purpose and evidence remain uncertain.",
    status: "unknown",
    evidenceRefs: [],
  };
  return {
    description: {
      text: "Best guess: a small software experiment whose exact purpose needs confirmation.",
      status: "hypothesis",
      evidenceRefs: [],
    },
    purpose: "unknown",
    recommendation: { decision: "Explore", claims: [claim] },
    customerPromise: [claim],
    whyNow: [claim],
    valueModel: [claim],
    delivery: [claim],
    executiveAsk: [claim],
    unansweredQuestions: [claim],
    opportunities: [],
    assessment: {
      summary: "Insufficient source evidence.",
      capabilities: [],
      investmentTiers: [],
      limitations: ["No source evidence or project tests."],
    },
  };
}
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
    description: {
      text: "A small documented project.",
      status: "hypothesis",
      evidenceRefs: [],
    },
    assessment: {
      summary: "Source inspection only.",
      capabilities: [],
      investmentTiers: [],
      limitations: ["No tests executed."],
    },
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

test("batch queue deduplicates active jobs and permits a labelled AI best guess for empty projects", async () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "empty-analysis-"),
  );
  const p = require("../../server/lib/registry").addProject(
    fs.mkdtempSync(path.join(os.tmpdir(), "empty-evidence-")),
  );
  let calls = 0;
  const service =
    require("../../server/lib/analysisJobs").createAnalysisService({
      runner: async () => {
        calls++;
        return { output: JSON.stringify(unknownAssessment()), diagnostics: "" };
      },
    });
  const first = service.enqueueAnalysis([p.id])[0];
  assert.equal(service.enqueueAnalysis([p.id])[0].id, first.id);
  await service.whenIdle();
  assert.equal(service.getAnalysisJob(first.id).status, "completed");
  assert.equal(calls, 1);
  const record = require("../../server/lib/briefStore").getBriefRecord(p.id);
  assert.equal(record.revisions[0].brief.recommendation.decision, "Explore");
  assert.ok(
    record.revisions[0].brief.assessment.limitations.some((s) =>
      /evidence/i.test(s),
    ),
  );
});

test("provider authentication errors stay actionable and block the batch without repeated calls", async () => {
  const { runAgent } = require("../../server/lib/agentAdapter");
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "provider-error-"));
  await assert.rejects(
    runAgent({
      executable: process.execPath,
      args: [
        "-e",
        'process.stdout.write(JSON.stringify({is_error:true,result:"Not logged in · Please run /login"}));process.exitCode=1',
      ],
      cwd,
      prompt: "",
      timeoutMs: 1000,
      maxOutputBytes: 1000,
    }),
    (e) =>
      e.code === "PROVIDER_AUTH_REQUIRED" && /Not logged in/.test(e.message),
  );
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "blocked-batch-"),
  );
  const registry = require("../../server/lib/registry");
  const projects = [1, 2].map((n) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blocked-project-"));
    fs.writeFileSync(path.join(dir, "README.md"), "Project context");
    return registry.addProject(dir);
  });
  let calls = 0;
  const service =
    require("../../server/lib/analysisJobs").createAnalysisService({
      runner: async () => {
        calls++;
        throw Object.assign(new Error("Not logged in"), {
          code: "PROVIDER_AUTH_REQUIRED",
        });
      },
    });
  const jobs = service.enqueueAnalysis(projects.map((p) => p.id));
  await service.whenIdle();
  assert.equal(calls, 1);
  assert.equal(service.getAnalysisJob(jobs[0].id).status, "failed");
  assert.equal(service.getAnalysisJob(jobs[1].id).status, "blocked");
  assert.equal(service.getProviderBlock().code, "PROVIDER_AUTH_REQUIRED");
  assert.equal(service.enqueueAnalysis([projects[1].id])[0].id, jobs[1].id);
});

test("ChatGPT-backed Codex JSONL produces a validated final result and rejects tool activity", () => {
  const { parseAgentOutput } = require("../../server/lib/agentAdapter");
  const events = [
    { type: "thread.started", thread_id: "example" },
    {
      type: "item.completed",
      item: { type: "agent_message", text: '{"ready":true}' },
    },
    { type: "turn.completed", usage: { input_tokens: 10 } },
  ]
    .map(JSON.stringify)
    .join("\n");
  assert.deepEqual(parseAgentOutput(events), { ready: true });
  const tool = [
    {
      type: "item.started",
      item: { type: "command_execution", command: "echo unsafe" },
    },
    {
      type: "item.completed",
      item: { type: "agent_message", text: '{"ready":true}' },
    },
  ]
    .map(JSON.stringify)
    .join("\n");
  assert.throws(() => parseAgentOutput(tool), /tool activity/i);
});

test("structured provider failure pauses remaining jobs even when the process exits successfully", async () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "provider-envelope-"),
  );
  const registry = require("../../server/lib/registry");
  const projects = [1, 2].map(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "provider-project-"));
    fs.writeFileSync(path.join(root, "README.md"), "Project context");
    return registry.addProject(root);
  });
  let calls = 0;
  const service =
    require("../../server/lib/analysisJobs").createAnalysisService({
      runner: async () => {
        calls++;
        return {
          output: JSON.stringify({
            is_error: true,
            result: "Not logged in · Please run /login",
          }),
          diagnostics: "",
        };
      },
    });
  const jobs = service.enqueueAnalysis(projects.map((p) => p.id));
  await service.whenIdle();
  assert.equal(calls, 1);
  assert.equal(service.getAnalysisJob(jobs[1].id).status, "blocked");
  assert.equal(service.getProviderBlock().code, "PROVIDER_AUTH_REQUIRED");
});

test("queued assessments keep the exact lens charter even if the lens changes before execution", async () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "queued-lens-"),
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "personal-description-"));
  const registry = require("../../server/lib/registry");
  const p = registry.addProject(root);
  registry.saveProjects([
    {
      ...p,
      lensId: "personal",
      description: "A dashboard just for my homelab.",
    },
  ]);
  let supplied = "";
  const service =
    require("../../server/lib/analysisJobs").createAnalysisService({
      runner: async ({ prompt }) => {
        supplied = prompt;
        return { output: JSON.stringify(unknownAssessment()), diagnostics: "" };
      },
    });
  const job = service.enqueueAnalysis([p.id])[0];
  const lenses = require("../../server/lib/lenses");
  lenses.updateLens("personal", {
    charter: "This is a changed charter used only in future assessments.",
    expectedVersion: 1,
  });
  await service.whenIdle();
  assert.equal(service.getAnalysisJob(job.id).status, "completed");
  const revision = require("../../server/lib/briefStore").getBriefRecord(p.id)
    .revisions[0];
  assert.equal(revision.assessmentLens.version, 1);
  assert.match(supplied, /home\/homelab utility/);
  assert.doesNotMatch(supplied, /changed charter used only/);
  assert.match(supplied, /dashboard just for my homelab/);
});

test("queued null description stays null when a user adds an override before execution", async () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "queued-description-"),
  );
  const r = require("../../server/lib/registry");
  const p = r.addProject(
    fs.mkdtempSync(path.join(os.tmpdir(), "queued-empty-")),
  );
  let supplied = "";
  const service =
    require("../../server/lib/analysisJobs").createAnalysisService({
      runner: async ({ prompt }) => {
        supplied = prompt;
        return { output: JSON.stringify(unknownAssessment()), diagnostics: "" };
      },
    });
  const job = service.enqueueAnalysis([p.id])[0];
  require("../../server/lib/projectMetadata").updateMetadata(p.id, {
    description: "Added after this job was queued.",
  });
  await service.whenIdle();
  assert.equal(service.getAnalysisJob(job.id).status, "completed");
  assert.doesNotMatch(supplied, /Added after this job was queued/);
  const revision = require("../../server/lib/briefStore").getBriefRecord(p.id)
    .revisions[0];
  assert.equal(revision.provenance.userDescription, null);
});
