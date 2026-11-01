const crypto = require("node:crypto");
const registry = require("./registry");
const { collectEvidence, saveEvidence } = require("./evidence");
const { getBriefRecord, createRevision } = require("./briefStore");
const primary = ".planning/research/ASSESSMENT.md";
function importAssessment(projectId) {
  const project = registry.findProject(projectId);
  if (!project) throw new Error("Project not found");
  const snapshot = collectEvidence(project.path);
  snapshot.files = snapshot.files.filter(
    (f) =>
      (f.path.startsWith(".planning/research/") && f.path.endsWith(".md")) ||
      f.path === ".planning/PROJECT.md",
  );
  const assessment = snapshot.files.find((f) => f.path === primary);
  if (!assessment)
    throw Object.assign(
      new Error(
        "No readable .planning/research/ASSESSMENT.md found; symlinks and oversized sources are excluded.",
      ),
      { code: "NO_ASSESSMENT" },
    );
  snapshot.scope = {
    kind: "existing-research",
    paths: snapshot.files.map((f) => f.path),
  };
  snapshot.fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot.files.map((f) => [f.path, f.hash])))
    .digest("hex");
  const record = getBriefRecord(projectId);
  const existing = record.revisions.find(
    (r) =>
      r.source === "import" &&
      r.provenance?.sourceFingerprint === snapshot.fingerprint,
  );
  if (existing) return { revision: existing, alreadyImported: true };
  const lines = assessment.text.split("\n");
  const claim = (text, status = "hypothesis", line = 1) => ({
    text,
    status,
    evidenceRefs: [`${primary}:${line}`],
  });
  const unknown = (text) => ({ text, status: "unknown", evidenceRefs: [] });
  function section(name) {
    const start = lines.findIndex(
      (line) => line.toLowerCase() === `## ${name.toLowerCase()}`,
    );
    if (start < 0) return [];
    let end = lines.findIndex(
      (line, index) => index > start && line.startsWith("## "),
    );
    if (end < 0) end = lines.length;
    return lines
      .slice(start + 1, end)
      .map((text, index) => ({ text, line: start + index + 2 }))
      .filter((row) => row.text.trim());
  }
  function paragraphs(name, status = "hypothesis") {
    const rows = section(name);
    const result = [];
    let buffer = [];
    for (const row of rows) {
      if (row.text.startsWith("|")) continue;
      if (row.text.startsWith("- ") || row.text.startsWith("### ")) {
        if (buffer.length) {
          result.push(
            claim(buffer.map((r) => r.text).join(" "), status, buffer[0].line),
          );
          buffer = [];
        }
        if (!row.text.startsWith("### "))
          result.push(claim(row.text.replace(/^- /, ""), status, row.line));
      } else buffer.push(row);
    }
    if (buffer.length)
      result.push(
        claim(buffer.map((r) => r.text).join(" "), status, buffer[0].line),
      );
    return result;
  }
  function question(label, status = "unknown") {
    const index = lines.findIndex((line) => line.startsWith(`- **${label}:**`));
    return index < 0
      ? unknown(`${label}: not established by the imported assessment.`)
      : claim(lines[index].replace(/^- /, ""), status, index + 1);
  }
  const recommendation = lines.findIndex((line) =>
    /^\*\*Recommendation:\*\*/.test(line),
  );
  const verdict = paragraphs("Executive verdict");
  const brief = {
    purpose: "experiment",
    recommendation: {
      decision: "Explore",
      claims: [
        recommendation >= 0
          ? claim(
              lines[recommendation].replace(/^\*\*Recommendation:\*\*\s*/, ""),
              "proposed",
              recommendation + 1,
            )
          : unknown("Source recommendation requires review."),
        ...verdict,
      ],
    },
    customerPromise: [
      question("Buyer/problem", "hypothesis"),
      question("Customer evidence"),
    ],
    whyNow: [
      question("Why Puppet", "hypothesis"),
      question("Alternatives", "proposed"),
      unknown(
        "Pillar alignment and organizational overlap require validation; no accepted Product or Engineering commitment is inferred.",
      ),
    ],
    valueModel: [
      question("Measurement", "proposed"),
      unknown(
        "Commercial path, attributed opportunities and customer commitments are not established by this research.",
      ),
    ],
    delivery: [
      ...paragraphs("Smallest credible demonstration", "proposed"),
      ...paragraphs("Investment tiers", "proposed"),
      question("Ownership"),
      unknown(
        "Receiving Engineering/Support owners, handoff acceptance, funding, transfer date and advisory duration remain unknown. PuppetWorks remains accountable until ownership is explicitly accepted.",
      ),
    ],
    executiveAsk: [
      question("Continue", "proposed"),
      question("Stop/rework", "proposed"),
      unknown(
        "Authority, protected capacity, spending limit and decision date require an executive decision.",
      ),
    ],
    unansweredQuestions: [
      question("Buyer/problem", "hypothesis"),
      question("Customer evidence"),
      question("Ownership"),
      unknown(
        "Named investigators are unknown; next validation is to identify an operator, observe the workflow, reproduce the isolated baseline and resolve ownership before pilot investment.",
      ),
    ],
    opportunities: [],
  };
  const capabilityRows = section("Evidence-backed capability matrix")
    .filter((row) => row.text.startsWith("|") && !row.text.includes("---"))
    .slice(1);
  const capabilities = capabilityRows.map((row) => {
    const c = row.text
      .split("|")
      .slice(1, -1)
      .map((v) => v.trim());
    const raw = (c[2] || "").toLowerCase();
    return {
      capability: c[0],
      component: c[1] || "unknown",
      status: raw.startsWith("implemented")
        ? "implemented"
        : raw.startsWith("partial")
          ? "partial"
          : raw.startsWith("planned")
            ? "planned only"
            : raw.startsWith("missing")
              ? "missing"
              : "unknown",
      verification:
        /tested/i.test(c[4] || "") && !/^not /i.test(c[4])
          ? "historical tests reported"
          : /inspected/i.test(c[4] || "")
            ? "inspected only"
            : "not verified",
      verificationDetail: c[4] || "unknown",
      evidenceRefs: [`${primary}:${row.line}`],
      limitations: c[5] || "Not established by the source",
      reuseApproach: c[6] || "Review source before reuse",
    };
  });
  const tierRows = section("Investment tiers")
    .filter((row) => row.text.startsWith("|") && !row.text.includes("---"))
    .slice(1);
  brief.assessment = {
    summary: verdict.map((c) => c.text).join(" "),
    capabilities: capabilities.slice(0, 40),
    investmentTiers: tierRows.map((row) => {
      const c = row.text
        .split("|")
        .slice(1, -1)
        .map((v) => v.trim());
      const tier = /^lab/i.test(c[0])
        ? "experiment"
        : /^pilot/i.test(c[0])
          ? "pilot"
          : /^production/i.test(c[0])
            ? "production"
            : "optional";
      return {
        tier,
        scope: c[0],
        effort: c[4] || "unknown",
        confidence:
          "Source ranges are indicative, overlapping and not commitments.",
        acceptance: c[3] || "unknown",
        evidenceRefs: [`${primary}:${row.line}`],
      };
    }),
    limitations: [
      "Imported historical source inspection; no tests, services or project actions rerun.",
      "Customer demand, commercial ownership, delivery dates and ongoing support are not inferred.",
    ],
  };
  if (!brief.assessment.summary)
    brief.assessment.summary =
      "Existing research imported for review; source reports retain their original verification limits.";
  const dateLine = lines.find((line) =>
    line.startsWith("**Assessment and expanded research:**"),
  );
  saveEvidence(projectId, snapshot);
  const revision = createRevision(projectId, {
    brief,
    source: "import",
    parentRevision:
      record.latestHuman || record.acceptedRevision || record.latestDraft,
    evidenceId: snapshot.id,
    evidence: snapshot,
    provenance: {
      kind: "existing-research",
      originalProject:
        lines
          .find((line) => line.startsWith("**Project:**"))
          ?.replace("**Project:**", "")
          .trim() || project.name,
      originalDate:
        dateLine?.replace("**Assessment and expanded research:**", "").trim() ||
        "unknown",
      sourcePath: primary,
      sourceFingerprint: snapshot.fingerprint,
      methodology:
        "historical source import; no tests or project actions rerun",
      documents: snapshot.scope.paths,
    },
  });
  return { revision, alreadyImported: false };
}
module.exports = { importAssessment };
