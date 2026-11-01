const SECTIONS = [
  "customerPromise",
  "whyNow",
  "valueModel",
  "delivery",
  "executiveAsk",
  "unansweredQuestions",
];
const STATUSES = ["confirmed", "hypothesis", "proposed", "unknown"];
function invalid(message) {
  throw Object.assign(new Error(message), { code: "INVALID_BRIEF" });
}
function validReference(ref, evidence) {
  if (typeof ref !== "string") return false;
  const match = /^(.+?)(?::([1-9][0-9]*)(?:-([1-9][0-9]*))?)?$/.exec(ref);
  if (!match) return false;
  const file = evidence.files.find((f) => f.path === match[1]);
  return (
    !!file &&
    (!match[2] ||
      (Number(match[2]) <= file.lines &&
        (!match[3] ||
          (Number(match[3]) >= Number(match[2]) &&
            Number(match[3]) <= file.lines))))
  );
}
function validateBrief(value, evidence) {
  if (
    !value ||
    typeof value !== "object" ||
    !["Explore", "Pilot", "Scale/Transition", "Rework", "Stop"].includes(
      value.recommendation?.decision,
    )
  )
    invalid("Invalid recommendation");
  const groups = [
    value.recommendation.claims,
    ...SECTIONS.map((key) => value[key]),
  ];
  if (value.description) {
    if (
      typeof value.description.text !== "string" ||
      value.description.text.length > 6000
    )
      invalid("Invalid project description");
    groups.push([value.description]);
  }
  if (value.valueOrientation) {
    if (
      ![
        "commercial",
        "home-homelab",
        "learning",
        "community",
        "mixed",
        "unclear",
      ].includes(value.valueOrientation.kind)
    )
      invalid("Invalid value orientation");
    groups.push([value.valueOrientation]);
  }
  if (groups.some((group) => !Array.isArray(group) || group.length === 0))
    invalid("All seven brief sections are required");
  for (const claim of groups.flat()) {
    if (
      !claim ||
      typeof claim.text !== "string" ||
      !claim.text.trim() ||
      !STATUSES.includes(claim.status) ||
      !Array.isArray(claim.evidenceRefs) ||
      !claim.evidenceRefs.every((r) => typeof r === "string")
    )
      invalid("Invalid evidence-labelled claim");
    if (claim.status === "confirmed" && !claim.evidenceRefs.length)
      invalid("Confirmed claims require evidence");
    if (
      evidence &&
      claim.evidenceRefs.some((ref) => !validReference(ref, evidence))
    )
      invalid("Citation references an uncollected file or invalid line");
  }
  if (
    ![
      "experiment",
      "customer-release",
      "community",
      "personal",
      "demonstration",
      "unknown",
    ].includes(value.purpose)
  )
    invalid("Invalid project purpose");
  if (!Array.isArray(value.opportunities))
    invalid("Opportunities must be an array");
  for (const o of value.opportunities)
    if (
      !o ||
      typeof o.id !== "string" ||
      !o.id.trim() ||
      !Number.isFinite(o.amount) ||
      o.amount < 0 ||
      ![
        "sourcedPipeline",
        "influencedPipeline",
        "newARR",
        "expansionARR",
        "retainedARR",
        "servicesBookings",
        "costSavings",
      ].includes(o.metric) ||
      !/^[A-Z]{3}$/.test(o.currency)
    )
      invalid("Invalid opportunity metric, ID, amount or currency");
  for (const o of value.opportunities) {
    for (const key of [
      "account",
      "commercialOwner",
      "motion",
      "stage",
      "attributionConfirmer",
      "nextCommitment",
      "outcome",
    ])
      if (typeof o[key] !== "string" || !o[key].trim())
        invalid(`Opportunity ${key} must be stated or explicitly unknown`);
    if (
      !Array.isArray(o.projectIds) ||
      !o.projectIds.every((id) => typeof id === "string")
    )
      invalid("Invalid contributing projects");
    if (
      !Array.isArray(o.attributionEvidence) ||
      !o.attributionEvidence.length ||
      !o.attributionEvidence.every((ref) => typeof ref === "string")
    )
      invalid("Commercial amounts require attribution evidence");
    if (
      evidence &&
      !o.attributionEvidence.every((ref) => validReference(ref, evidence))
    )
      invalid("Commercial attribution must cite collected evidence");
  }
  if (value.suggestedTags !== undefined) {
    if (
      !Array.isArray(value.suggestedTags) ||
      value.suggestedTags.length > 16 ||
      !value.suggestedTags.every(
        (tag) =>
          typeof tag === "string" &&
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag) &&
          tag.length <= 40,
      )
    )
      invalid("Invalid suggested project tags");
  }
  if (value.assessment) {
    const a = value.assessment;
    if (
      typeof a.summary !== "string" ||
      !a.summary.trim() ||
      !Array.isArray(a.capabilities) ||
      a.capabilities.length > 50 ||
      !Array.isArray(a.investmentTiers) ||
      !Array.isArray(a.limitations) ||
      !a.limitations.length ||
      !a.limitations.every((v) => typeof v === "string" && v.trim())
    )
      invalid("Invalid technical assessment");
    for (const row of a.capabilities) {
      if (
        !row ||
        typeof row.capability !== "string" ||
        ![
          "implemented",
          "partial",
          "planned only",
          "missing",
          "unknown",
        ].includes(row.status) ||
        ![
          "inspected only",
          "historical tests reported",
          "not verified",
        ].includes(row.verification) ||
        typeof row.limitations !== "string" ||
        typeof row.reuseApproach !== "string" ||
        (row.component !== undefined && typeof row.component !== "string") ||
        (row.verificationDetail !== undefined &&
          typeof row.verificationDetail !== "string") ||
        !Array.isArray(row.evidenceRefs)
      )
        invalid("Invalid capability status or verification boundary");
      if (
        (row.status === "implemented" ||
          row.verification === "historical tests reported") &&
        !row.evidenceRefs.length
      )
        invalid("Implementation and historical verification require evidence");
      if (
        evidence &&
        !row.evidenceRefs.every((ref) => validReference(ref, evidence))
      )
        invalid("Invalid capability citation");
    }
    for (const row of a.investmentTiers) {
      if (
        !row ||
        !["experiment", "pilot", "production", "optional"].includes(row.tier) ||
        typeof row.scope !== "string" ||
        typeof row.effort !== "string" ||
        typeof row.confidence !== "string" ||
        (row.acceptance !== undefined && typeof row.acceptance !== "string") ||
        !Array.isArray(row.evidenceRefs)
      )
        invalid("Invalid investment tier");
      if (
        evidence &&
        !row.evidenceRefs.every((ref) => validReference(ref, evidence))
      )
        invalid("Invalid investment citation");
    }
  }
  return JSON.parse(JSON.stringify(value));
}
function exportMarkdown(revision) {
  const b = revision.brief;
  return (
    `# Executive Project Brief\n\n**${b.recommendation.decision}** · purpose: ${b.purpose}\n\n` +
    (b.description
      ? `## What is it?\n\n**${b.description.status}**: ${b.description.text}\n\n`
      : "") +
    [
      ["Recommendation", b.recommendation.claims],
      ...SECTIONS.map((key) => [key, b[key]]),
    ]
      .map(
        ([heading, claims]) =>
          `## ${heading}\n\n` +
          (claims.length
            ? claims
                .map(
                  (c) =>
                    `- **${c.status}**: ${c.text}${c.evidenceRefs.length ? ` (${c.evidenceRefs.join(", ")})` : ""}`,
                )
                .join("\n")
            : "**unknown**: No evidence recorded."),
      )
      .join("\n\n") +
    (b.assessment
      ? `\n\n## Technical assessment\n\n${b.assessment.summary}\n\n` +
        b.assessment.capabilities
          .map(
            (c) =>
              `- ${c.capability} (${c.component || "component unknown"}): ${c.status}; ${c.verification}. Verification scope: ${c.verificationDetail || "not established"}. ${c.limitations} Reuse: ${c.reuseApproach} (${c.evidenceRefs.join(", ")})`,
          )
          .join("\n") +
        `\n\n## Investment tiers\n\n` +
        b.assessment.investmentTiers
          .map(
            (t) =>
              `- ${t.tier}: ${t.scope}; effort: ${t.effort}; confidence: ${t.confidence}; proposed acceptance: ${t.acceptance || "unknown"} (${t.evidenceRefs.join(", ")})`,
          )
          .join("\n") +
        `\n\nLimits: ${b.assessment.limitations.join(" ")}`
      : "") +
    (revision.assessmentLens
      ? `\n\nAssessment lens: ${revision.assessmentLens.name} · version ${revision.assessmentLens.version} · ${revision.assessmentLens.charterHash}`
      : "") +
    (revision.provenance
      ? `\n\nSource provenance: ${JSON.stringify(revision.provenance)}`
      : "") +
    `\n\nRevision: ${revision.id}\nPrompt: ${revision.promptVersion}\n`
  );
}
module.exports = { validateBrief, exportMarkdown, SECTIONS, STATUSES };
