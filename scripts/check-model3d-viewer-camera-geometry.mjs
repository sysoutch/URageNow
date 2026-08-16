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
    set(nextX, nextY, nextZ) { this.x = nextX; this.y = nextY; this.z = nextZ; return this; }
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
assert.deepEqual({...camera.position, clone: undefined, copy: undefined, set: undefined}, {x: 1, y: 2, z: 3, clone: undefined, copy: undefined, set: undefined});
assert.equal(camera.zoom, 1);
assert.equal(controls.target.x, 0);
assert.equal(viewer.root.rotation.x, 0.1);
assert.equal(lightUpdates, 1);
assert.equal(viewer.renderer.renderCalls, 1);

class Box3 {
  constructor() { this.min = {y: 0.5}; }
  setFromObject() { return this; }
  getSize(target) { return target.set(2, 4, 3); }
  getCenter(target) { return target.set(1, 2, 1.5); }
}
geometry.fitModelInCamera({Box3, Vector3: class { constructor() { return vector(); } }}, camera, viewer.root, controls);
assert.equal(sceneSizes[0], 4);
assert.equal(viewer.root.position.x, -1);
assert.equal(viewer.root.position.y, -0.5);
assert.equal(camera.near, 0.02);
assert.equal(camera.far, 120);
assert.equal(controls.minDistance, 4 / 30);

console.log("3D viewer camera geometry validation passed.");
