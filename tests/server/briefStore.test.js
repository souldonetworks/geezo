const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
function brief() {
  return {
    recommendation: {
      decision: "Explore",
      claims: [
        { text: "Validate demand", status: "proposed", evidenceRefs: [] },
      ],
    },
    customerPromise: [
      {
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
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
        text: "Evidence, investigator and next validation step are unknown.",
        status: "unknown",
        evidenceRefs: [],
      },
    ],
    purpose: "experiment",
    opportunities: [],
  };
}
module.exports = { brief };
test("brief revisions preserve human work, accepted version and independent analysis drafts", () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "brief-store-"),
  );
  const s = require("../../server/lib/briefStore");
  const projectId = require("node:crypto").randomUUID();
  const first = s.createRevision(projectId, {
    brief: brief(),
    source: "human",
    parentRevision: null,
  });
  s.acceptRevision(projectId, {
    revisionId: first.id,
    expectedAcceptedRevision: null,
  });
  const edit = s.createRevision(projectId, {
    brief: { ...brief(), purpose: "personal" },
    source: "human",
    parentRevision: first.id,
  });
  const draft = s.createRevision(projectId, {
    brief: brief(),
    source: "analysis",
    parentRevision: first.id,
  });
  const record = s.getBriefRecord(projectId);
  assert.equal(record.acceptedRevision, first.id);
  assert.equal(record.latestHuman, edit.id);
  assert.equal(record.latestDraft, draft.id);
  assert.throws(
    () =>
      s.createRevision(projectId, {
        brief: brief(),
        source: "human",
        parentRevision: first.id,
      }),
    (e) => e.code === "REVISION_CONFLICT",
  );
  assert.throws(
    () =>
      s.acceptRevision(projectId, {
        revisionId: draft.id,
        expectedAcceptedRevision: null,
      }),
    (e) => e.code === "REVISION_CONFLICT",
  );
});
test("schema rejects unsupported claims and invalid decisions", () => {
  const { validateBrief } = require("../../server/lib/briefSchema");
  assert.throws(
    () =>
      validateBrief({
        ...brief(),
        recommendation: { decision: "Ship", claims: [] },
      }),
    (e) => e.code === "INVALID_BRIEF",
  );
  assert.throws(
    () =>
      validateBrief({
        ...brief(),
        delivery: [
          { text: "Revenue guaranteed", status: "confirmed", evidenceRefs: [] },
        ],
      }),
    (e) => e.code === "INVALID_BRIEF",
  );
  assert.throws(
    () =>
      validateBrief({
        ...brief(),
        delivery: [
          { text: "Owner accepted", status: "invented", evidenceRefs: [] },
        ],
      }),
    (e) => e.code === "INVALID_BRIEF",
  );
});
test("opportunities deduplicate contributions without mixing commercial metrics or currencies", () => {
  const { aggregateOpportunities } = require("../../server/lib/opportunities");
  const opportunity = {
    id: "opp-1",
    amount: 100,
    currency: "USD",
    metric: "newARR",
    projectIds: ["a"],
  };
  let result = aggregateOpportunities([
    opportunity,
    { ...opportunity, projectIds: ["b"] },
    { ...opportunity, id: "opp-2", metric: "servicesBookings", amount: 20 },
  ]);
  assert.equal(result.totals.USD.newARR, 100);
  assert.equal(result.totals.USD.servicesBookings, 20);
  assert.deepEqual(result.opportunities[0].projectIds, ["a", "b"]);
  result = aggregateOpportunities([
    opportunity,
    { ...opportunity, amount: 200 },
  ]);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.totals.USD?.newARR || 0, 0);
});

test("opportunity amounts cannot enter a brief without attribution and commercial evidence", () => {
  const { validateBrief } = require("../../server/lib/briefSchema");
  assert.throws(
    () =>
      validateBrief({
        ...brief(),
        opportunities: [
          { id: "opp-1", amount: 100, currency: "USD", metric: "newARR" },
        ],
      }),
    (e) => e.code === "INVALID_BRIEF",
  );
});

test("successful assessment requires a rationale and explicit unknown claims rather than empty sections", () => {
  const { validateBrief } = require("../../server/lib/briefSchema");
  assert.throws(
    () =>
      validateBrief({
        ...brief(),
        recommendation: { decision: "Scale/Transition", claims: [] },
      }),
    (e) => e.code === "INVALID_BRIEF",
  );
  assert.throws(
    () => validateBrief({ ...brief(), delivery: [] }),
    (e) => e.code === "INVALID_BRIEF",
  );
});
test("editing a newer analysis revision preserves its ancestry with an independent expected head", () => {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "brief-ancestry-"),
  );
  const s = require("../../server/lib/briefStore");
  const id = require("node:crypto").randomUUID();
  const first = s.createRevision(id, {
    brief: brief(),
    source: "human",
    parentRevision: null,
  });
  const draft = s.createRevision(id, {
    brief: brief(),
    source: "analysis",
    parentRevision: first.id,
  });
  const edit = s.createRevision(id, {
    brief: brief(),
    source: "human",
    parentRevision: draft.id,
    expectedHead: first.id,
  });
  assert.equal(edit.parentRevision, draft.id);
  assert.throws(
    () =>
      s.createRevision(id, {
        brief: brief(),
        source: "human",
        parentRevision: draft.id,
        expectedHead: first.id,
      }),
    (e) => e.code === "REVISION_CONFLICT",
  );
});

test("technical assessment separates inspection from historical checks and validates capability citations", () => {
  const { validateBrief } = require("../../server/lib/briefSchema");
  const assessment = {
    summary: "Source inspection only.",
    capabilities: [
      {
        capability: "Preview",
        status: "implemented",
        verification: "tested",
        evidenceRefs: ["README.md:1"],
        limitations: "Unknown runtime behavior",
        reuseApproach: "Inspect existing path",
      },
    ],
    investmentTiers: [],
    limitations: ["No tests executed"],
  };
  assert.throws(
    () =>
      validateBrief(
        { ...brief(), assessment },
        { files: [{ path: "README.md", lines: 1 }] },
      ),
    (e) => e.code === "INVALID_BRIEF",
  );
  assessment.capabilities[0].verification = "inspected only";
  assert.doesNotThrow(() =>
    validateBrief(
      { ...brief(), assessment },
      { files: [{ path: "README.md", lines: 1 }] },
    ),
  );
  assessment.capabilities[0].evidenceRefs = ["outside.md:1"];
  assert.throws(
    () =>
      validateBrief(
        { ...brief(), assessment },
        { files: [{ path: "README.md", lines: 1 }] },
      ),
    (e) => e.code === "INVALID_BRIEF",
  );
});

test("malformed display fields cannot turn a completed assessment into a broken page", () => {
  const { validateBrief } = require("../../server/lib/briefSchema");
  const assessment = {
    summary: "Source inspection only",
    capabilities: [
      {
        capability: "Preview",
        component: { bad: true },
        status: "unknown",
        verification: "not verified",
        verificationDetail: "No tests run",
        evidenceRefs: [],
        limitations: "Unknown",
        reuseApproach: "Inspect",
      },
    ],
    investmentTiers: [],
    limitations: ["No tests executed"],
  };
  assert.throws(
    () => validateBrief({ ...brief(), assessment }),
    (e) => e.code === "INVALID_BRIEF",
  );
  assessment.capabilities[0].component = "controller";
  assessment.capabilities[0].verificationDetail = { bad: true };
  assert.throws(
    () => validateBrief({ ...brief(), assessment }),
    (e) => e.code === "INVALID_BRIEF",
  );
  assessment.capabilities[0].verificationDetail = "No tests run";
  assessment.investmentTiers = [
    {
      tier: "experiment",
      scope: "One action",
      effort: "unknown",
      confidence: "unknown",
      evidenceRefs: [],
      acceptance: { bad: true },
    },
  ];
  assert.throws(
    () => validateBrief({ ...brief(), assessment }),
    (e) => e.code === "INVALID_BRIEF",
  );
});
test("Markdown export retains historical verification limits and proposed acceptance gates", () => {
  const { exportMarkdown } = require("../../server/lib/briefSchema");
  const b = brief();
  b.assessment = {
    summary: "Historical inspection",
    capabilities: [
      {
        capability: "Preview",
        component: "controller.go",
        status: "partial",
        verification: "historical tests reported",
        verificationDetail: "Only fake targets; real Puppet was never tested",
        evidenceRefs: ["ASSESSMENT.md:8"],
        limitations: "No real deployment",
        reuseApproach: "Reproduce lab",
      },
    ],
    investmentTiers: [
      {
        tier: "experiment",
        scope: "One action",
        effort: "unknown",
        confidence: "unknown",
        acceptance: "Reject stale approval before target dispatch",
        evidenceRefs: ["ASSESSMENT.md:12"],
      },
    ],
    limitations: ["Source reports only"],
  };
  const output = exportMarkdown({
    id: "example",
    brief: b,
    promptVersion: "executive-review-v1+assessment-v2",
  });
  assert.match(output, /Only fake targets; real Puppet was never tested/);
  assert.match(output, /controller.go/);
  assert.match(output, /Reject stale approval before target dispatch/);
  assert.match(output, /ASSESSMENT.md:12/);
});
