const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function setup() {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "tag-home-"),
  );
  const r = require("../../server/lib/registry");
  return {
    registry: r,
    project: r.addProject(
      fs.mkdtempSync(path.join(os.tmpdir(), "tag-project-")),
    ),
  };
}
test("personal/work is explicit and manual tags survive suggested tags and discovery", () => {
  const { project } = setup();
  const meta = require("../../server/lib/projectMetadata");
  assert.equal(meta.getProjectMetadata(project).category, "unclassified");
  const updated = meta.updateMetadata(project.id, {
    category: "personal",
    tags: ["My Lab", "PUPPET", "puppet"],
    expectedVersion: 0,
  });
  assert.equal(updated.category, "personal");
  assert.deepEqual(updated.tags, ["my-lab", "puppet"]);
  assert.throws(
    () =>
      meta.updateMetadata(project.id, { category: "work", expectedVersion: 0 }),
    (e) => e.code === "METADATA_CONFLICT",
  );
  assert.throws(
    () => meta.updateMetadata(project.id, { category: "guessed" }),
    (e) => e.code === "INVALID_METADATA",
  );
  const suggested = meta.deriveSuggestedTags({
    suggestedTags: ["MCP", "go"],
    assessment: { summary: "Puppet automation using Go and MCP" },
  });
  assert.ok(suggested.includes("mcp"));
  assert.ok(suggested.includes("puppet"));
  const dismissed = meta.updateMetadata(project.id, {
    dismissedTags: ["mcp"],
    expectedVersion: 1,
  });
  assert.deepEqual(dismissed.tags, ["my-lab", "puppet"]);
  assert.equal(dismissed.category, "personal");
  const registry = require("../../server/lib/registry");
  assert.equal(
    meta
      .getProjectMetadata(registry.findProject(project.id), {
        suggestedTags: ["mcp", "go"],
      })
      .suggestedTags.includes("mcp"),
    false,
  );
});
test("related search ranks explained shared topics and respects category and self exclusion", () => {
  const { registry, project } = setup();
  const second = registry.addProject(
    fs.mkdtempSync(path.join(os.tmpdir(), "network-tool-")),
  );
  const third = registry.addProject(
    fs.mkdtempSync(path.join(os.tmpdir(), "unity-game-")),
  );
  const meta = require("../../server/lib/projectMetadata");
  meta.updateMetadata(project.id, {
    category: "work",
    tags: ["puppet", "mcp"],
  });
  meta.updateMetadata(second.id, {
    category: "work",
    tags: ["puppet", "mcp", "automation"],
  });
  meta.updateMetadata(third.id, {
    category: "personal",
    tags: ["unity", "games"],
  });
  const { findRelated } = require("../../server/lib/relatedProjects");
  let results = findRelated({ query: "Puppet MCP automation" });
  assert.equal(results[0].id, second.id);
  assert.deepEqual(results[0].matchedTags, ["puppet", "mcp", "automation"]);
  assert.equal(
    results.some((p) => p.id === third.id),
    false,
  );
  results = findRelated({ projectId: project.id });
  assert.equal(results[0].id, second.id);
  assert.equal(
    results.some((p) => p.id === project.id),
    false,
  );
  assert.equal(
    findRelated({ query: "puppet", category: "personal" }).length,
    0,
  );
});
