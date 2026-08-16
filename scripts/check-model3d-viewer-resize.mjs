import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerResizeHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createResize = createDashboardThreeDViewerResizeHelpers;`, runtime, {filename: modulePath});

const listeners = new Map();
const removed = [];
const browserWindow = {
  addEventListener: (name, callback) => listeners.set(name, callback),
  removeEventListener: (name, callback) => removed.push({name, callback})
};
const observed = [];
let disconnected = 0;
class ResizeObserver {
  constructor(callback) { this.callback = callback; }
  observe(node) { observed.push(node); }
  disconnect() { disconnected += 1; }
}
const camera = {
  aspect: 1,
  isPerspectiveCamera: true,
  isOrthographicCamera: false,
  projections: 0,
  updateProjectionMatrix() { this.projections += 1; }
};
const renderer = {
  renders: 0,
  sizes: [],
  setSize(...values) { this.sizes.push(values); },
  render() { this.renders += 1; }
};
const controls = {updates: 0, update() { this.updates += 1; }};
const viewer = {camera, controls, renderer, resizeHandler: null, resizeObserver: null, scene: {}};
const parent = {clientWidth: 900, clientHeight: 450};
const canvas = {clientWidth: 300, clientHeight: 150, parentElement: parent};
const bounds = [];
let lightUpdates = 0;
const resize = runtime.createResize({
  viewer,
  window: browserWindow,
  ResizeObserver,
  updateOrthographicBounds: (_camera, options) => bounds.push(options),
  getViewerMaxSize: () => 7,
  updateLightRig: () => { lightUpdates += 1; }
});

resize.bind(canvas, {});
assert.deepEqual(renderer.sizes[0], [900, 450, false]);
assert.equal(camera.aspect, 2);
assert.equal(camera.projections, 1);
assert.equal(controls.updates, 1);
assert.equal(renderer.renders, 1);
assert.equal(lightUpdates, 1);
assert.deepEqual(observed, [canvas, parent]);
assert.equal(typeof listeners.get("resize"), "function");

camera.isPerspectiveCamera = false;
camera.isOrthographicCamera = true;
listeners.get("resize")();
assert.equal(bounds[0].aspect, 2);
assert.equal(bounds[0].maxSize, 7);

resize.unbind();
assert.equal(disconnected, 1);
assert.equal(removed[0].name, "resize");
assert.equal(viewer.resizeHandler, null);
assert.equal(viewer.resizeObserver, null);

console.log("3D viewer resize validation passed.");
