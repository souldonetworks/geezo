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
  return JSON.parse(JSON.stringify(value));
}
function exportMarkdown(revision) {
  const b = revision.brief;
  return (
    `# Executive Project Brief\n\n**${b.recommendation.decision}** · purpose: ${b.purpose}\n\n` +
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
    `\n\nRevision: ${revision.id}\nPrompt: ${revision.promptVersion}\n`
  );
}
module.exports = { validateBrief, exportMarkdown, SECTIONS, STATUSES };
