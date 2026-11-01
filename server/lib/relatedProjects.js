const registry = require("./registry");
const {
  getProjectMetadata,
  currentBrief,
  deriveSuggestedTags,
} = require("./projectMetadata");
const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "project",
  "new",
  "using",
  "want",
  "build",
  "need",
  "create",
  "tool",
  "can",
  "into",
  "our",
  "your",
]);
function words(value) {
  return [
    ...new Set(
      String(value)
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9-]+/g) || [],
    ),
  ].filter((term) => !STOP.has(term));
}
function findRelated({ query = "", projectId, category } = {}) {
  if (typeof query !== "string" || query.length > 500)
    throw new Error("Use a search of 500 characters or fewer");
  if (
    category &&
    !["all", "personal", "work", "unclassified"].includes(category)
  )
    throw new Error("Invalid project category");
  const projects = registry.loadProjects();
  const origin = projectId ? projects.find((p) => p.id === projectId) : null;
  if (projectId && !origin)
    throw Object.assign(new Error("Project not found"), { code: "NOT_FOUND" });
  const sourceTags = origin ? getProjectMetadata(origin).allTags : [];
  const terms = words(query);
  const topicTags = deriveSuggestedTags({ assessment: { summary: query } });
  const requestedTags = [...new Set([...sourceTags, ...topicTags, ...terms])];
  if (!terms.length && !sourceTags.length) return [];
  return projects
    .filter((p) => p.id !== projectId)
    .map((project) => {
      const brief = currentBrief(project.id);
      const meta = getProjectMetadata(project, brief);
      if (category && category !== "all" && meta.category !== category)
        return null;
      const matchedTags = meta.allTags.filter(
        (tag) =>
          requestedTags.includes(tag) ||
          terms.some((term) => tag.split("-").includes(term)),
      );
      const title = words(project.name);
      const description = words(
        [
          meta.description.text,
          brief?.recommendation?.claims?.map((c) => c.text).join(" "),
          brief?.assessment?.summary || "",
        ].join(" "),
      );
      const matchedTerms = terms.filter(
        (term) => title.includes(term) || description.includes(term),
      );
      const score =
        matchedTags.reduce(
          (n, tag) => n + (meta.tags.includes(tag) ? 6 : 4),
          0,
        ) +
        matchedTerms.reduce((n, term) => n + (title.includes(term) ? 3 : 1), 0);
      return score
        ? {
            id: project.id,
            name: project.name,
            path: project.path,
            ...meta,
            score,
            matchedTags,
            matchedTerms,
            summary:
              brief?.assessment?.summary ||
              brief?.recommendation?.claims?.[0]?.text ||
              "Assessment not yet available.",
            recommendation: brief?.recommendation?.decision || null,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 30);
}
module.exports = { findRelated };
