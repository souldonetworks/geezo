const registry = require("./registry");
const { getBriefRecord } = require("./briefStore");
const TOPICS = [
  ["puppet", /\bpuppet\b|openvox/i],
  ["mcp", /\bmcp\b|model context protocol/i],
  ["ai-agents", /agentic|\bllm\b|ai agents?|copilot/i],
  ["automation", /automat|orchestrat|remediat/i],
  ["security", /secur|authoriz|authentication|zero.trust|approval/i],
  ["compliance", /compliance|cis benchmark|regulat/i],
  [
    "configuration-management",
    /configuration.management|desired.state|config.management|drift/i,
  ],
  ["observability", /observability|monitoring|telemetry|diagnostics/i],
  ["infrastructure", /infrastructure|provision|terraform|homelab/i],
  ["homelab", /homelab|home.lab|unraid|proxmox/i],
  ["networking", /network|firewall|dns|vpn|cloudflare/i],
  ["containers", /docker|container|podman/i],
  ["kubernetes", /kubernetes|k8s|microk8s/i],
  ["go", /\bgolang\b|\bGo\b/],
  ["python", /\bpython\b/i],
  ["ruby", /\bruby\b/i],
  ["typescript", /\btypescript\b/i],
  ["react", /\breact\b|\bnext\.js\b/i],
  ["unity", /\bunity\b/i],
  ["games", /\bgame\b|\bgaming\b|\barcade\b/i],
  ["media", /\bmedia\b|\bplex\b|\bjellyfin\b|\bepg\b|\biptv\b/i],
  ["data", /database|postgres|sqlite|data.pipeline/i],
  ["developer-tools", /developer.tool|code.assist|build.system|\bcli\b/i],
  ["patch-management", /patch.management|patching|os.updates/i],
];
function invalid(message) {
  throw Object.assign(new Error(message), { code: "INVALID_METADATA" });
}
function normalizeTags(tags) {
  if (
    !Array.isArray(tags) ||
    tags.length > 40 ||
    !tags.every((tag) => typeof tag === "string" && tag.length <= 80)
  )
    invalid("Use at most 40 short text tags");
  return [
    ...new Set(
      tags
        .map((tag) =>
          tag
            .trim()
            .toLowerCase()
            .replace(/^#/, "")
            .replace(/c\+\+/g, "cpp")
            .replace(/c#/g, "csharp")
            .replace(/^\.net$/, "dotnet")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        )
        .filter(Boolean),
    ),
  ].map((tag) => {
    if (tag.length > 40) invalid("Tags must be 40 characters or fewer");
    return tag;
  });
}
function deriveSuggestedTags(brief) {
  if (!brief) return [];
  const text = JSON.stringify(brief);
  const explicit = normalizeTags(brief.suggestedTags || []).filter(
    (tag) => !["personal", "work", "unclassified"].includes(tag),
  );
  return [
    ...new Set([
      ...explicit,
      ...TOPICS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag),
    ]),
  ].slice(0, 16);
}
function currentBrief(projectId) {
  const r = getBriefRecord(projectId);
  return (
    r.revisions.find(
      (v) => v.id === (r.latestDraft || r.latestHuman || r.acceptedRevision),
    )?.brief || null
  );
}
function getProjectMetadata(project, brief) {
  const tags = normalizeTags(project.tags || []);
  const dismissed = normalizeTags(project.dismissedTags || []);
  const suggestedTags = deriveSuggestedTags(
    brief === undefined ? currentBrief(project.id) : brief,
  ).filter((tag) => !tags.includes(tag) && !dismissed.includes(tag));
  return {
    category: ["personal", "work"].includes(project.category)
      ? project.category
      : "unclassified",
    tags,
    suggestedTags,
    dismissedTags: dismissed,
    allTags: [...new Set([...tags, ...suggestedTags])],
    metadataVersion: project.metadataVersion || 0,
  };
}
function updateMetadata(id, patch) {
  const projects = registry.loadProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index < 0)
    throw Object.assign(new Error("Project not found"), { code: "NOT_FOUND" });
  const current = projects[index];
  if (
    patch.expectedVersion !== undefined &&
    patch.expectedVersion !== (current.metadataVersion || 0)
  )
    throw Object.assign(
      new Error("Project tags changed; reload before saving"),
      { code: "METADATA_CONFLICT" },
    );
  if (
    patch.category !== undefined &&
    !["personal", "work", "unclassified"].includes(patch.category)
  )
    invalid("Category must be personal, work or unclassified");
  const update = { ...current };
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.tags !== undefined) update.tags = normalizeTags(patch.tags);
  if (patch.dismissedTags !== undefined)
    update.dismissedTags = normalizeTags(patch.dismissedTags);
  update.metadataVersion = (current.metadataVersion || 0) + 1;
  projects[index] = update;
  registry.saveProjects(projects);
  return { ...update, ...getProjectMetadata(update) };
}
module.exports = {
  normalizeTags,
  deriveSuggestedTags,
  getProjectMetadata,
  updateMetadata,
  currentBrief,
};
