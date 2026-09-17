import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerCameraGeometryHelpers.js");
const source = await readFile(modulePath, "utf8");
const document = {getElementById: id => id === "model3d-canvas" ? {clientWidth: 800, clientHeight: 400} : null};
const runtime = vm.createContext({document});
vm.runInContext(`${source}\nthis.createCameraGeometry = createDashboardThreeDViewerCameraGeometryHelpers;`, runtime, {filename: modulePath});

function vector(x = 0, y = 0, z = 0) {
  return {
    x, y, z,
    clone() { return vector(this.x, this.y, this.z); },
    copy(value) { this.x = value.x; this.y = value.y; this.z = value.z; return this; },
    set(nextX, nextY, nextZ) { this.x = nextX; this.y = nextY; this.z = nextZ; return this; },
    add(value) { this.x += value.x; this.y += value.y; this.z += value.z; return this; },
    normalize() {
      const length = Math.hypot(this.x, this.y, this.z);
      if (length > 0) {
        this.x /= length;
        this.y /= length;
        this.z /= length;
      }
      return this;
    },
    multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; },
    distanceTo(value) { return Math.hypot(this.x - value.x, this.y - value.y, this.z - value.z); }
  };
}

const camera = {
  position: vector(1, 2, 3),
  quaternion: vector(0, 0, 1),
  userData: {orthoFrustumHeight: 8},
  isOrthographicCamera: true,
  zoom: 1,
  lookAt() {},
  updateProjectionMatrixCalls: 0,
  updateProjectionMatrix() { this.updateProjectionMatrixCalls += 1; }
};
const controls = {target: vector(), updateCalls: 0, update() { this.updateCalls += 1; }};
const viewer = {
  camera,
  controls,
  root: {position: vector(), rotation: vector(0.1, 0.2, 0.3)},
  renderer: {renderCalls: 0, render() { this.renderCalls += 1; }},
  scene: {}
};
const sceneSizes = [];
let lightUpdates = 0;
const geometry = runtime.createCameraGeometry({
  viewer,
  updateSceneHelpers: size => sceneSizes.push(size),
  updateLightRig: () => { lightUpdates += 1; }
});

assert.equal(geometry.getModel3dViewerAspect(), 2);
geometry.updateModel3dOrthographicCameraBounds(camera, {aspect: 2, maxSize: 4});
assert.equal(camera.left, -8);
assert.equal(camera.right, 8);
assert.equal(camera.top, 4);
assert.equal(camera.bottom, -4);

const captured = geometry.captureModel3dViewerCameraState();
camera.position.set(9, 9, 9);
camera.zoom = 3;
controls.target.set(4, 5, 6);
viewer.root.rotation.set(1, 1, 1);
geometry.restoreModel3dViewerCameraState(captured);
assert.equal(camera.position.x, 1);
assert.equal(camera.position.y, 2);
assert.equal(camera.position.z, 3);
assert.equal(camera.zoom, 1);
assert.equal(controls.target.x, 0);
assert.equal(viewer.root.rotation.x, 0.1);
assert.equal(lightUpdates, 1);
assert.equal(viewer.renderer.renderCalls, 1);

class Box3 {
  constructor() {
    this.min = {x: 0, y: 0.5, z: 0};
    this.max = {x: 2, y: 4.5, z: 3};
  }
  setFromObject() { return this; }
  isEmpty() { return false; }
  getSize(target) { return target.set(2, 4, 3); }
  getCenter(target) { return target.set(1, 2, 1.5); }
}
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, vector(x, y, z)); }
}

geometry.fitModelInCamera({Box3, Vector3}, camera, viewer.root, controls);
assert.equal(sceneSizes[0], 4);
// The fitted root is re-centered on the bounds center and grounded at min-Y.
assert.equal(viewer.root.position.x, -1);
assert.equal(viewer.root.position.y, -0.5);
assert.equal(viewer.root.position.z, -1.5);

// Orthographic path: vertical/horizontal distances are size-derived (no FOV),
// the camera sits on the normalized (1.35, 0.82, 1.35) direction at the
// derived fit distance plus target offset, and near/far/controls scale from
// the final camera-to-target distance. Mirror the exact float operations so
// expectations stay deterministic without hardcoding magic constants.
const fitSize = {x: 2, y: 4, z: 3};
const fitMaxSize = Math.max(fitSize.x, fitSize.y, fitSize.z, 0.01);
const fitTargetY = Math.max(0, fitSize.y * 0.5);
const fitDistance = Math.max(fitMaxSize * 0.9, fitMaxSize * 2.4, fitMaxSize * 2.4) * 1.3 + fitSize.z * 0.4;
const directionLength = Math.hypot(1.35, 0.82, 1.35);
const directionScale = Math.max(fitDistance, fitMaxSize * 2.5);
const fittedPosition = {
  x: (1.35 / directionLength) * directionScale + 0,
  y: (0.82 / directionLength) * directionScale + fitTargetY,
  z: (1.35 / directionLength) * directionScale + 0
};
const fittedDistance = Math.max(Math.hypot(fittedPosition.x - 0, fittedPosition.y - fitTargetY, fittedPosition.z - 0), fitMaxSize);

assert.equal(camera.position.x, fittedPosition.x);
assert.equal(camera.position.y, fittedPosition.y);
assert.equal(camera.position.z, fittedPosition.z);
assert.equal(camera.near, Math.max(0.0001, fittedDistance / 1000));
assert.equal(camera.far, Math.max(10, fittedDistance + fitMaxSize * 40));
assert.equal(controls.minDistance, Math.max(0.0001, fittedDistance / 80));
assert.equal(controls.maxDistance, Math.max(8, fittedDistance * 12, fitMaxSize * 20));

console.log("3D viewer camera geometry validation passed.");