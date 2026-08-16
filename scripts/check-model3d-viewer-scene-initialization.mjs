import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerSceneInitializationHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createSceneInitialization = createDashboardThreeDViewerSceneInitializationHelpers;`, runtime, {filename: modulePath});

class Renderer {
  constructor(options) { this.options = options; this.outputColorSpace = null; this.toneMapping = null; }
  setClearColor(...args) { this.clearColor = args; }
  setPixelRatio(value) { this.pixelRatio = value; }
}
class Scene {
  constructor() { this.added = []; this.environment = null; }
  add(...values) { this.added.push(...values); }
}
class Value { constructor(...args) { this.args = args; } }
class Light extends Value {}
class DirectionalLight extends Light {}
class GridHelper extends Value { constructor(...args) { super(...args); this.material = {}; } }
class AxesHelper extends Value { constructor(...args) { super(...args); this.material = {}; } }
class Loader { constructor(manager) { this.manager = manager; } }
class Controls {
  constructor(camera, canvas) { this.camera = camera; this.canvas = canvas; this.listeners = new Map(); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}
const THREE = {
  WebGLRenderer: Renderer,
  Scene,
  Color: Value,
  Fog: Value,
  PerspectiveCamera: Value,
  AmbientLight: Light,
  HemisphereLight: Light,
  DirectionalLight,
  Object3D: Value,
  GridHelper,
  AxesHelper,
  Vector3: Value,
  SRGBColorSpace: "srgb",
  ACESFilmicToneMapping: "aces"
};
const canvasListeners = new Map();
const canvas = {addEventListener: (name, callback) => canvasListeners.set(name, callback)};
const viewer = {};
const calls = [];
const initializer = runtime.createSceneInitialization({
  viewer,
  getDevicePixelRatio: () => 3,
  bindAxisGizmo: () => calls.push("bind-gizmo"),
  switchToManualOrbit: () => calls.push("manual"),
  updateAxisGizmo: () => calls.push("gizmo"),
  updateLightRig: () => calls.push("light"),
  requestInteractionFrames: count => calls.push("frames:" + count),
  updateSceneHelpers: size => calls.push("scene:" + size),
  updateSceneHelperOptions: () => calls.push("helper-options"),
  applyLightingProfile: () => calls.push("lighting-profile")
});
const three = {THREE, GLTFLoader: Loader, FBXLoader: Loader, OBJLoader: Loader, OrbitControls: Controls};
const manager = {id: "manager"};
initializer.initialize(three, canvas, manager, {scene: "#111", gridMajor: "#222", gridMinor: "#333"});

assert.equal(viewer.renderer.options.canvas, canvas);
assert.equal(viewer.renderer.pixelRatio, 2);
assert.equal(viewer.renderer.outputColorSpace, "srgb");
assert.equal(viewer.renderer.toneMapping, "aces");
assert.equal(viewer.renderer.toneMappingExposure, 1.16);
assert.equal(viewer.loaders.gltf.manager, manager);
assert.equal(viewer.controls.enableDamping, true);
assert.equal(viewer.controls.screenSpacePanning, true);
assert.equal(viewer.scene.added.length, 10);
assert.equal(viewer.sceneHelpers.grid.material.opacity, 0.36);
assert.equal(viewer.sceneHelpers.axis.material.depthTest, false);
assert.ok(calls.includes("bind-gizmo"));
assert.ok(calls.includes("scene:1"));
assert.equal(typeof canvasListeners.get("wheel"), "function");
canvasListeners.get("wheel")();
assert.ok(calls.includes("frames:10"));
viewer.controls.listeners.get("change")();
assert.ok(calls.includes("frames:8"));

console.log("3D viewer scene initialization validation passed.");
