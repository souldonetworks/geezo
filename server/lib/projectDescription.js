function getProjectDescription(project, brief) {
  if (typeof project.description === "string" && project.description.trim())
    return {
      text: project.description.trim(),
      source: "user",
      status: "proposed",
      evidenceRefs: [],
      updatedAt: project.descriptionUpdatedAt || null,
    };
  if (brief?.description?.text) return { ...brief.description, source: "ai" };
  const candidate =
    brief?.customerPromise?.find(
      (c) => c.status !== "unknown" && c.text.length > 30,
    )?.text || brief?.assessment?.summary;
  if (candidate)
    return {
      text: candidate.slice(0, 1400),
      source: "ai-inferred",
      status: "hypothesis",
      evidenceRefs: [],
      note: "Provisional description from the earlier assessment; edit it or reassess with the selected lens.",
    };
  return {
    text: `The purpose of ${project.name || "this project"} is not yet established. Add a description or request an AI best guess.`,
    source: "unknown",
    status: "unknown",
    evidenceRefs: [],
  };
}
module.exports = { getProjectDescription };
