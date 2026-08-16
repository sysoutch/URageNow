import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerResourceDisposalHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createDisposal = createDashboardThreeDViewerResourceDisposalHelpers;`, runtime, {filename: modulePath});

const disposed = [];
const originalGeometry = {dispose: () => disposed.push("original-geometry")};
const overrideGeometry = {dispose: () => disposed.push("override-geometry")};
const texture = {dispose: () => disposed.push("texture")};
const originalMaterial = {map: texture, dispose: () => disposed.push("original-material")};
const overrideMaterial = {userData: {model3dViewportOverride: true}, dispose: () => disposed.push("override-material")};
const mesh = {geometry: overrideGeometry, material: overrideMaterial};
const root = {meshes: [mesh]};
const removed = [];
const cancelled = [];
const statuses = [];
const viewer = {
  animateHandle: 42,
  currentLoadId: "load",
  loadedModelId: "model",
  loadedModelKey: "key",
  materialDefaults: new WeakMap(),
  meshGeometryDefaults: new WeakMap([[mesh, originalGeometry]]),
  meshMaterialDefaults: new WeakMap([[mesh, originalMaterial]]),
  previewActive: true,
  rigHelper: {id: "rig"},
  root,
  scene: {remove: value => removed.push(value)}
};
const disposal = runtime.createDisposal({
  viewer,
  forEachMesh: (target, callback) => target.meshes.forEach(callback),
  forEachMaterial: (target, callback) => target.meshes.forEach(item => callback(item.material)),
  setStatus: value => statuses.push(value),
  cancelAnimation() {
    cancelled.push(viewer.animateHandle);
    viewer.animateHandle = 0;
  }
});

disposal.disposeViewerRoot();
assert.deepEqual(cancelled, [42]);
assert.equal(viewer.animateHandle, 0);
assert.deepEqual(removed, [{id: "rig"}, root]);
assert.deepEqual(disposed, ["override-geometry", "override-material", "original-geometry", "texture", "original-material"]);
assert.equal(viewer.root, null);
assert.equal(viewer.loadedModelId, "");
assert.equal(viewer.loadedModelKey, "");
assert.equal(viewer.currentLoadId, "");
assert.equal(viewer.rigHelper, null);

viewer.previewActive = true;
viewer.root = null;
disposal.unloadPreview();
assert.equal(viewer.previewActive, false);
assert.match(statuses.at(-1), /preview unloaded/);

console.log("3D viewer resource disposal validation passed.");
