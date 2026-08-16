import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerAssetLoaderHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({Uint8Array});
vm.runInContext(`${source}\nthis.createAssetLoader = createDashboardThreeDViewerAssetLoaderHelpers;`, runtime, {filename: modulePath});

const statuses = [];
const viewer = {loaders: {gltf: {id: "gltf"}, fbx: {id: "fbx"}, obj: {id: "obj"}}, lastFbxTexturePatch: null};
const fbxBytes = new Uint8Array([0xff, 0xd8, 0xff, 0, 46, 102, 98, 109, 0]);
const loader = runtime.createAssetLoader({
  viewer,
  setStatus: value => statuses.push(value),
  fetch: async () => ({ok: true, arrayBuffer: async () => fbxBytes.buffer})
});

assert.equal(loader.resolveFormat("MODEL.GLB"), "gltf");
assert.equal(loader.resolveFormat("mesh.fbx"), "fbx");
assert.equal(loader.resolveFormat("mesh.obj"), "obj");
assert.equal(loader.resolveFormat("mesh.stl"), "");
assert.equal(loader.isPreviewable("mesh.gltf"), true);
assert.equal(loader.getLoader("mesh.obj").id, "obj");
assert.equal(loader.resolveRoot("mesh.glb", {scene: {id: "scene"}}).id, "scene");
assert.equal(loader.resolveRoot("mesh.obj", {id: "root"}).id, "root");

assert.equal(loader.inferEmbeddedTextureExtension(fbxBytes.buffer), "jpg");
const patch = loader.patchFbxTextureReferences(fbxBytes.buffer, "jpg");
assert.equal(patch.replacements, 1);
assert.equal(patch.replacement, ".jpg");
assert.deepEqual(Array.from(new Uint8Array(patch.buffer).slice(4, 8)), [46, 106, 112, 103]);

let parsedBytes = null;
const loaded = await loader.load({parse: buffer => { parsedBytes = new Uint8Array(buffer); return {id: "fbx-result"}; }}, "mesh.fbx", "/mesh.fbx");
assert.equal(loaded.id, "fbx-result");
assert.equal(viewer.lastFbxTexturePatch.replacements, 1);
assert.deepEqual(Array.from(parsedBytes.slice(4, 8)), [46, 106, 112, 103]);
assert.match(statuses.at(-1), /Patched 1 embedded/);

const genericLoaded = await loader.load({load: (_url, resolve) => resolve({id: "obj-result"})}, "mesh.obj", "/mesh.obj");
assert.equal(genericLoaded.id, "obj-result");
assert.equal(viewer.lastFbxTexturePatch, null);

console.log("3D viewer asset loader validation passed.");
