const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
function home() {
  process.env.GSD_WEB_HOME_OVERRIDE = fs.mkdtempSync(
    path.join(os.tmpdir(), "lens-home-"),
  );
}
test("lens CRUD preserves exact charter revisions and prevents deleting assignments", () => {
  home();
  const s = require("../../server/lib/lenses");
  assert.deepEqual(
    s.listLenses().map((l) => l.name),
    ["PuppetWorks", "Souldo Games", "Personal", "Experimental"],
  );
  const created = s.createLens({
    name: "Commercial tools",
    description: "Business validation",
    charter: "Assess a real buyer problem before significant investment.",
  });
  const original = s.getLensSnapshot(created.id);
  const edited = s.updateLens(created.id, {
    name: "Commercial products",
    charter: "Validate demand, alternatives, delivery and ownership.",
    expectedVersion: 1,
  });
  assert.equal(edited.version, 2);
  assert.equal(s.getLensSnapshot(created.id, 1).charter, original.charter);
  assert.throws(
    () => s.updateLens(created.id, { name: "Stale", expectedVersion: 1 }),
    (e) => e.code === "LENS_CONFLICT",
  );
  const r = require("../../server/lib/registry");
  const p = r.addProject(
    fs.mkdtempSync(path.join(os.tmpdir(), "lens-project-")),
  );
  r.saveProjects([{ ...p, lensId: created.id }]);
  assert.throws(
    () => s.deleteLens(created.id, 2),
    (e) => e.code === "LENS_IN_USE",
  );
  r.saveProjects([{ ...p, lensId: null }]);
  s.deleteLens(created.id, 2);
  assert.equal(
    s.listLenses().some((l) => l.id === created.id),
    false,
  );
  assert.equal(s.getLensSnapshot(created.id, 1).charter, original.charter);
});
test("auto lenses distinguish games, personal utility, Puppet and experimentation without changing category", () => {
  home();
  const { resolveLens } = require("../../server/lib/lenses");
  assert.equal(
    resolveLens({ name: "puppet-widget", category: "work" }).id,
    "puppetworks",
  );
  assert.equal(
    resolveLens({ name: "doom-park", category: "personal" }).id,
    "souldo-games",
  );
  assert.equal(
    resolveLens({ name: "homelab-monitor", category: "personal" }).id,
    "personal",
  );
  assert.equal(resolveLens({ name: "unknown-idea" }).id, "experimental");
  assert.equal(
    resolveLens({ name: "puppet-widget", lensId: "personal" }).id,
    "personal",
  );
});
test("human descriptions override AI guesses and survive metadata changes", () => {
  home();
  const {
    getProjectDescription,
  } = require("../../server/lib/projectDescription");
  assert.equal(
    getProjectDescription(
      { description: "A home media scheduler" },
      {
        description: {
          text: "An AI guess",
          status: "hypothesis",
          evidenceRefs: [],
        },
      },
    ).text,
    "A home media scheduler",
  );
  const guessed = getProjectDescription(
    {},
    {
      description: {
        text: "A possible media scheduler",
        status: "hypothesis",
        evidenceRefs: [],
      },
    },
  );
  assert.equal(guessed.source, "ai");
  assert.equal(guessed.status, "hypothesis");
  assert.equal(
    getProjectDescription({ name: "new-project" }, null).status,
    "unknown",
  );
});
