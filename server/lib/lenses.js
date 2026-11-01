const path = require("node:path");
const crypto = require("node:crypto");
const { gsdWebDir } = require("./paths");
const { readJson, writeJsonAtomic } = require("./atomicStore");
const registry = require("./registry");
const builtins = [
  [
    "puppetworks",
    "PuppetWorks",
    "Executive investment, strategic reuse and responsible delivery for PuppetWorks.",
    require("../resources/executive-review-v1"),
  ],
  [
    "souldo-games",
    "Souldo Games",
    "The games being developed: player experience, a finishable scope and credible commercial potential.",
    `Assess this game as part of Souldo Games. Establish what the game is: genre, player fantasy, core loop, intended audience, platform and current playable state. Distinguish implemented play from design intent, prototypes and a shippable release. Evaluate what makes it enjoyable or distinctive, playtest evidence, scope, production/art/audio needs, accessibility and usability, target performance, distribution and licensing uncertainties, support and maintenance. Explore sellability through an identified player segment, comparable alternatives, discovery channels, pricing hypotheses and validation steps; never invent players, demand, revenue or publishing commitments. A hobby game can be justified by enjoyment and learning. Propose a smallest playable vertical slice, effort/spending bounds, observable playtest criteria and stop/change gates. Identify reusable gameplay/editor/networking/art-pipeline components without claiming they are interchangeable. Label confirmed/hypothesis/proposed/unknown statements and cite supplied evidence. Do not apply PuppetWorks pillars or require enterprise buyers.`,
  ],
  [
    "personal",
    "Personal",
    "Distinguish a sellable product from useful home/homelab work, or a combination of both.",
    `Explain what this project does and for whom, in plain language. Evaluate two independent value paths: (1) a potentially sellable product, supported by a specific external audience/problem, alternatives, differentiation, willingness-to-pay evidence, distribution and a smallest market-validation experiment; (2) home/homelab utility, convenience, reliability, learning, avoided operational effort, and sustainable personal maintenance. It may be commercial, home-homelab, learning, community, mixed or unclear. Do not force household projects into a business case or invent customer demand/revenue. Make a clearly labelled best guess if purpose is uncertain. Name the smallest useful improvement, dependencies, actual versus proposed costs, maintenance risks, documentation/recovery needs and stop criteria. Suggest reusable components and possible future directions without assuming organizational ownership. Label confirmed/hypothesis/proposed/unknown and cite evidence. Do not apply PuppetWorks pillars.`,
  ],
  [
    "experimental",
    "Experimental",
    "Bounded learning, feasibility, useful experiments and possible future directions.",
    `Describe what this experiment appears to be, the hypothesis it tests, what is actually implemented, and what remains unknown. Make an explicitly labelled best guess rather than fabricate certainty when context is thin. Evaluate technical feasibility, alternatives/reuse, learning value and plausible future directions: a product, community capability, reusable component, internal tool or personal utility. These directions are hypotheses, not evidence of demand. Propose the smallest informative experiment with time/spending boundaries, observable success/failure and an off-ramp. Separate implementation tests from historical reports; no code is executed by this review. Do not force commercialization or PuppetWorks alignment. State unresolved ownership, cost and evidence questions in proportion to investment; cite supplied evidence and label confirmed/hypothesis/proposed/unknown.`,
  ],
];
function file() {
  return path.join(gsdWebDir(), "assessment-lenses.json");
}
function error(message, code = "INVALID_LENS") {
  throw Object.assign(new Error(message), { code });
}
function load() {
  let state = readJson(file(), null);
  if (!state) {
    const now = new Date().toISOString();
    state = {
      schemaVersion: 1,
      lenses: builtins.map(([id, name, description, charter]) => ({
        id,
        version: 1,
        name,
        description,
        charter,
        createdAt: now,
        updatedAt: now,
        revisions: [{ version: 1, name, description, charter, createdAt: now }],
      })),
    };
    writeJsonAtomic(file(), state);
  }
  return state;
}
function listLenses() {
  return load()
    .lenses.filter((l) => !l.deletedAt)
    .map(({ revisions, ...lens }) => ({
      ...lens,
      assignedProjects: registry
        .loadProjects()
        .filter((p) => p.lensId === lens.id).length,
    }));
}
function getLensSnapshot(id, version) {
  const lens = load().lenses.find((l) => l.id === id);
  if (!lens) error("Assessment lens not found", "NOT_FOUND");
  const revision = lens.revisions.find(
    (r) => r.version === (version || lens.version),
  );
  if (!revision) error("Lens revision not found", "NOT_FOUND");
  return {
    id,
    ...revision,
    charterHash: crypto
      .createHash("sha256")
      .update(revision.charter)
      .digest("hex"),
  };
}
function validated(input, base = {}) {
  const v = { ...base, ...input };
  if (
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.length > 80 ||
    typeof v.charter !== "string" ||
    v.charter.trim().length < 20 ||
    v.charter.length > 60000 ||
    typeof (v.description || "") !== "string" ||
    (v.description || "").length > 1000
  )
    error(
      "Use a name (up to 80 characters) and a charter of 20–60,000 characters",
    );
  return {
    name: v.name.trim(),
    description: v.description || "",
    charter: v.charter,
  };
}
function unique(state, name, id) {
  if (
    state.lenses.some(
      (l) =>
        !l.deletedAt &&
        l.id !== id &&
        l.name.toLowerCase() === name.toLowerCase(),
    )
  )
    error("A lens with that name already exists", "LENS_CONFLICT");
}
function createLens(input) {
  const state = load();
  const values = validated(input);
  unique(state, values.name);
  const now = new Date().toISOString();
  const lens = {
    id: crypto.randomUUID(),
    version: 1,
    ...values,
    createdAt: now,
    updatedAt: now,
    revisions: [{ version: 1, ...values, createdAt: now }],
  };
  state.lenses.push(lens);
  writeJsonAtomic(file(), state);
  return { ...getLensSnapshot(lens.id), assignedProjects: 0 };
}
function updateLens(id, input) {
  const state = load();
  const lens = state.lenses.find((l) => l.id === id && !l.deletedAt);
  if (!lens) error("Lens not found", "NOT_FOUND");
  if (input.expectedVersion !== lens.version)
    error("Lens changed; reload before editing", "LENS_CONFLICT");
  const values = validated(input, lens);
  unique(state, values.name, id);
  Object.assign(lens, values, {
    version: lens.version + 1,
    updatedAt: new Date().toISOString(),
  });
  lens.revisions.push({
    version: lens.version,
    ...values,
    createdAt: lens.updatedAt,
  });
  writeJsonAtomic(file(), state);
  return getLensSnapshot(id);
}
function deleteLens(id, expectedVersion) {
  const state = load();
  const lens = state.lenses.find((l) => l.id === id && !l.deletedAt);
  if (!lens) error("Lens not found", "NOT_FOUND");
  if (expectedVersion !== lens.version)
    error("Lens changed; reload before deletion", "LENS_CONFLICT");
  if (registry.loadProjects().some((p) => p.lensId === id))
    error("Reassign projects before deleting this lens", "LENS_IN_USE");
  if (state.lenses.filter((l) => !l.deletedAt).length === 1)
    error("Keep at least one assessment lens", "LENS_IN_USE");
  lens.deletedAt = new Date().toISOString();
  writeJsonAtomic(file(), state);
  return { deleted: true };
}
function resolveLens(project, brief) {
  const active = load().lenses.filter((l) => !l.deletedAt);
  let id = project.lensId;
  let reason = "Selected by user";
  if (!id) {
    const text = [
      project.name,
      ...(project.tags || []),
      ...(brief?.suggestedTags || []),
    ].join(" ");
    if (
      /unity|\bgames?\b|doom|wrestl|slinger|player-select|arcade/i.test(text)
    ) {
      id = "souldo-games";
      reason = "Game identity or explicit game tags";
    } else if (
      project.category === "personal" ||
      ((!project.category || project.category === "unclassified") &&
        brief?.purpose === "personal")
    ) {
      id = "personal";
      reason = "Personal classification or prior personal-purpose assessment";
    } else if (
      /(?:^|[-_\s])(puppet|openvox|bolt|hiera|facter|pdk|sce)(?:[-_\s]|$)|^pe-mcp$/i.test(
        text,
      )
    ) {
      id = "puppetworks";
      reason = "Puppet ecosystem identity or explicit tags";
    } else {
      id = "experimental";
      reason = "Purpose not explicitly assigned to another lens";
    }
    if (!active.some((l) => l.id === id))
      id = active.find((l) => l.id === "experimental")?.id || active[0]?.id;
  }
  if (!active.some((l) => l.id === id))
    error("Selected lens is unavailable; choose another lens", "NOT_FOUND");
  return {
    ...getLensSnapshot(id),
    assignment: project.lensId ? "explicit" : "auto",
    reason,
  };
}
module.exports = {
  listLenses,
  getLensSnapshot,
  createLens,
  updateLens,
  deleteLens,
  resolveLens,
};
