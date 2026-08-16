import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerRenderLoopHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createRenderLoop = createDashboardThreeDViewerRenderLoopHelpers;`, runtime, {filename: modulePath});

const callbacks = new Map();
const cancelled = [];
let nextHandle = 1;
const viewer = {
  animateHandle: 0,
  autoRotate: false,
  camera: {},
  controls: {updates: 0, update() { this.updates += 1; }},
  interactionFrames: 0,
  renderer: {renders: 0, render() { this.renders += 1; }},
  root: {rotation: {y: 0}},
  scene: {}
};
let lightUpdates = 0;
const loop = runtime.createRenderLoop({
  viewer,
  updateLightRig: () => { lightUpdates += 1; },
  requestAnimationFrame(callback) {
    const handle = nextHandle++;
    callbacks.set(handle, callback);
    return handle;
  },
  cancelAnimationFrame(handle) {
    cancelled.push(handle);
    callbacks.delete(handle);
  }
});

assert.equal(loop.renderFrame(), true);
assert.equal(viewer.renderer.renders, 1);
assert.equal(viewer.controls.updates, 1);
assert.equal(lightUpdates, 1);

loop.requestInteractionFrames(2);
assert.equal(viewer.interactionFrames, 2);
assert.equal(callbacks.size, 1);
for (let index = 0; index < 3; index += 1) {
  const [handle, callback] = callbacks.entries().next().value;
  callbacks.delete(handle);
  callback();
}
assert.equal(viewer.interactionFrames, 0);
assert.equal(callbacks.size, 0);
assert.equal(viewer.renderer.renders, 4);

viewer.autoRotate = true;
assert.equal(loop.schedule(), true);
const [autoHandle, autoCallback] = callbacks.entries().next().value;
callbacks.delete(autoHandle);
autoCallback();
assert.equal(viewer.root.rotation.y, 0.004);
assert.equal(callbacks.size, 1);
assert.equal(loop.schedule(), false);
const activeHandle = viewer.animateHandle;
assert.equal(loop.cancel(), true);
assert.deepEqual(cancelled, [activeHandle]);
assert.equal(viewer.animateHandle, 0);

viewer.renderer = null;
assert.equal(loop.renderFrame(), false);
assert.equal(loop.schedule(), false);

console.log("3D viewer render loop validation passed.");
