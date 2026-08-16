import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerModelLifecycleHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createLifecycle = createDashboardThreeDViewerModelLifecycleHelpers;`, runtime, {filename: modulePath});

const calls = [];
const originalRoot = {name: "original"};
const viewer = {
  currentLoadId: "old-load",
  loadedModelId: "model-1",
  loadedModelKey: "model-1|merged",
  loadedModelFileName: "model.glb",
  root: originalRoot,
  scene: {
    add: root => calls.push(["add", root]),
    remove: root => calls.push(["remove", root])
  }
};
const lifecycle = runtime.createLifecycle({
  viewer,
  removeRigHelper: () => calls.push(["rig"]),
  disposeRootResources: root => calls.push(["dispose", root]),
  resetMaterialCaches: () => calls.push(["reset"]),
  resolveRoot: (fileName, asset) => asset?.roots?.[fileName] || null
});

lifecycle.beginLoad("load-2");
assert.equal(viewer.currentLoadId, "load-2");
assert.equal(viewer.loadedModelId, "");
assert.equal(viewer.loadedModelKey, "");
assert.equal(viewer.loadedModelFileName, "");
assert.equal(viewer.root, null);
assert.deepEqual(calls.map(call => call[0]), ["rig", "remove", "dispose", "reset"]);

const staleRoot = {name: "stale"};
assert.equal(lifecycle.discardIfStale("load-1", "stale.glb", {roots: {"stale.glb": staleRoot}}), true);
assert.deepEqual(calls.at(-1), ["dispose", staleRoot]);
assert.equal(lifecycle.discardIfStale("load-2", "current.glb", {}), false);

const nextRoot = {name: "next"};
lifecycle.replaceRoot(nextRoot);
assert.equal(viewer.root, nextRoot);
assert.deepEqual(calls.at(-1), ["add", nextRoot]);

const finalRoot = {name: "final"};
let preparedRoot = null;
lifecycle.replaceRoot(finalRoot, root => {
  preparedRoot = root;
  calls.push(["prepare", root]);
});
assert.equal(viewer.root, finalRoot);
assert.equal(preparedRoot, finalRoot);
assert.deepEqual(calls.slice(-6).map(call => call[0]), ["rig", "remove", "dispose", "reset", "prepare", "add"]);

console.log("3D viewer model lifecycle validation passed.");
