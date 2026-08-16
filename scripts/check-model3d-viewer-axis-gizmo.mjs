import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerAxisGizmoHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createAxisGizmo = createDashboardThreeDViewerAxisGizmoHelpers;`, runtime, {filename: modulePath});

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }
  project() { return this; }
  setFromSpherical(spherical) {
    const sinPhiRadius = Math.sin(spherical.phi) * spherical.radius;
    this.x = sinPhiRadius * Math.sin(spherical.theta);
    this.y = Math.cos(spherical.phi) * spherical.radius;
    this.z = sinPhiRadius * Math.cos(spherical.theta);
    return this;
  }
  sub(other) {
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    return this;
  }
}

class Spherical {
  setFromVector3(vector) {
    this.radius = Math.hypot(vector.x, vector.y, vector.z);
    this.theta = Math.atan2(vector.x, vector.z);
    this.phi = this.radius === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, vector.y / this.radius)));
    return this;
  }
}

const buttons = new Map(["front", "back", "left", "right", "top", "bottom"].map(view => [view, {style: {}}]));
const listeners = new Map();
const gizmoNode = {
  dataset: {},
  captured: [],
  released: [],
  addEventListener: (name, listener) => listeners.set(name, listener),
  querySelector(selector) {
    const view = selector.match(/"([^"]+)"/)?.[1];
    return buttons.get(view) || null;
  },
  releasePointerCapture(pointerId) { this.released.push(pointerId); },
  setPointerCapture(pointerId) { this.captured.push(pointerId); }
};
const calls = [];
const THREE = {
  MathUtils: {clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))},
  Spherical,
  Vector3
};
const target = new Vector3();
const camera = {
  position: new Vector3(0, 0, 10),
  lookAt: value => calls.push(["lookAt", value]),
  updateMatrixWorld: () => calls.push(["matrix"]),
};
const viewer = {
  camera,
  controls: {target, update: () => calls.push(["controls"])},
  lightRig: {THREE}
};
const controller = runtime.createAxisGizmo({
  viewer,
  getGizmo: () => gizmoNode,
  requestInteractionFrames: count => calls.push(["frames", count]),
  setView: view => calls.push(["view", view]),
  switchToManualOrbit: () => calls.push(["manual"]),
  updateLightRig: () => calls.push(["light"])
});

assert.equal(controller.updateOrientation(), true);
assert.equal(buttons.get("right").style.left, "81%");
assert.equal(buttons.get("right").style.top, "50%");
assert.equal(buttons.get("front").style.zIndex, "3");
assert.equal(controller.bind(), true);
assert.equal(controller.bind(), false);
assert.deepEqual([...listeners.keys()], ["pointerdown", "pointermove", "pointerup", "pointercancel"]);

const pressedTarget = {
  closest: () => ({getAttribute: () => "front"})
};
const downEvent = {
  pointerId: 7,
  clientX: 10,
  clientY: 10,
  target: pressedTarget,
  preventDefault() { this.prevented = true; }
};
listeners.get("pointerdown")(downEvent);
assert.equal(downEvent.prevented, true);
listeners.get("pointerup")({pointerId: 7});
assert.deepEqual(calls.at(-1), ["view", "front"]);
assert.deepEqual(gizmoNode.captured, [7]);
assert.deepEqual(gizmoNode.released, [7]);

listeners.get("pointerdown")({...downEvent, pointerId: 8});
listeners.get("pointermove")({pointerId: 8, clientX: 20, clientY: 14});
assert.notEqual(camera.position.x, 0);
assert.equal(calls.some(call => call[0] === "manual"), true);
assert.equal(calls.some(call => call[0] === "light"), true);
assert.deepEqual(calls.find(call => call[0] === "frames"), ["frames", 8]);
const viewCallCount = calls.filter(call => call[0] === "view").length;
listeners.get("pointerup")({pointerId: 8});
assert.equal(calls.filter(call => call[0] === "view").length, viewCallCount);

console.log("3D viewer axis gizmo validation passed.");
