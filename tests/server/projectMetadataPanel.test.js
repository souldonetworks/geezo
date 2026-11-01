const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const React = require("../../web/node_modules/react");
const renderer = require("../../web/node_modules/react-test-renderer");
const { MemoryRouter } = require("../../web/node_modules/react-router-dom");
const esbuild = require("../../web/node_modules/esbuild");
const file = path.resolve(
  __dirname,
  "../../web/src/components/ProjectMetadataPanel.jsx",
);
const code = esbuild.buildSync({
  entryPoints: [file],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  jsx: "automatic",
  external: ["react", "react/jsx-runtime", "react-router-dom"],
}).outputFiles[0].text;
const compiled = new Module(file, module);
compiled.filename = file;
compiled.paths = Module._nodeModulePaths(path.dirname(file));
compiled._compile(code, file);
const Panel = compiled.exports.default;
const { act } = renderer;
const projects = [
  {
    id: "a",
    category: "personal",
    tags: ["private-a"],
    suggestedTags: [],
    dismissedTags: [],
    allTags: ["private-a"],
    metadataVersion: 0,
  },
  {
    id: "b",
    category: "work",
    tags: ["team-b"],
    suggestedTags: [],
    dismissedTags: [],
    allTags: ["team-b"],
    metadataVersion: 0,
  },
  {
    id: "c",
    category: "work",
    tags: ["team-c"],
    suggestedTags: [],
    dismissedTags: [],
    allTags: ["team-c"],
    metadataVersion: 0,
  },
];
const response = (data) => ({ ok: true, status: 200, json: async () => data });
function setup(t) {
  const original = global.fetch;
  const loads = [];
  const writes = [];
  let root;
  global.fetch = (url, options = {}) => {
    if (url === "/api/briefings")
      return new Promise((resolve) =>
        loads.push(() => resolve(response(projects))),
      );
    if (options.method === "PATCH") {
      writes.push({ url, body: JSON.parse(options.body) });
      return Promise.resolve(
        response(projects.find((p) => url.includes(p.id))),
      );
    }
    return Promise.resolve(response([]));
  };
  t.after(() => {
    if (root) act(() => root.unmount());
    global.fetch = original;
  });
  const tree = (id) =>
    React.createElement(
      MemoryRouter,
      { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
      React.createElement(Panel, { projectId: id }),
    );
  return {
    loads,
    writes,
    mount(id) {
      act(() => {
        root = renderer.create(tree(id));
      });
    },
    navigate(id) {
      act(() => root.update(tree(id)));
    },
    root: () => root,
    async resolve(index) {
      await act(async () => {
        loads[index]();
        await Promise.resolve();
      });
    },
  };
}
test("switching projects hides stale metadata controls before the new project loads", async (t) => {
  const ui = setup(t);
  ui.mount("a");
  await ui.resolve(0);
  assert.equal(ui.root().root.findByType("input").props.value, "private-a");
  ui.navigate("b");
  const saves = ui
    .root()
    .root.findAllByType("button")
    .filter((b) => b.children.includes("Save project context"));
  assert.equal(saves.length, 0);
  await ui.resolve(1);
  assert.equal(ui.root().root.findByType("input").props.value, "team-b");
});
test("late responses from a previous project cannot overwrite the current project tags", async (t) => {
  const ui = setup(t);
  ui.mount("a");
  await ui.resolve(0);
  ui.navigate("b");
  ui.navigate("c");
  await ui.resolve(2);
  assert.equal(ui.root().root.findByType("input").props.value, "team-c");
  await ui.resolve(1);
  assert.equal(ui.root().root.findByType("input").props.value, "team-c");
});
