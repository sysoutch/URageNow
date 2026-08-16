import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceExportSubmission.js");
const source = await readFile(modulePath, "utf8");

const nodes = new Map();
const getNode = id => {
  if (!nodes.has(id)) nodes.set(id, {disabled: false, textContent: "", value: ""});
  return nodes.get(id);
};
const document = {getElementById: getNode};
const runtime = vm.createContext({document});
vm.runInContext(`${source}\nthis.createExportSubmission = createDashboardToolExportSubmission;`, runtime, {filename: modulePath});

const state = {activeTab: "tool", context: null, loading: false};
const calls = {
  close: 0,
  outputs: [],
  requests: [],
  statuses: [],
  toolAssets: [],
  ui: 0,
  writtenEngines: []
};
const submission = runtime.createExportSubmission({
  state,
  updateUi: () => { calls.ui += 1; },
  closeOverlay: () => { calls.close += 1; },
  setStatus: value => calls.statuses.push(value),
  setOutput: value => calls.outputs.push(value),
  sendImageToLazyDev: async () => [{id: "one"}, {id: "two"}],
  sendAssetToTool: async (target, asset, options) => calls.toolAssets.push({target, asset, options}),
  writePreferredEngine: engine => calls.writtenEngines.push(engine),
  getEngineLabel: engine => engine === "godot" ? "Godot" : "Unity",
  request: async (route, body) => {
    calls.requests.push({route, body});
    if (route === "/api/image-import") return {id: "image-id", imageFileName: "imported.png"};
    return {ok: true};
  },
  inferMimeType: (fileName, fallback) => fileName?.endsWith(".txt") ? "text/plain" : fallback,
  buildAbsoluteUrl: value => new URL(value, "https://dashboard.test/").href,
  getGeneratedImageFileUrl: (id, fileName) => `/generated/${id}/${fileName}`,
  readBlobSourceAsDataUrl: async () => "data:application/octet-stream;base64,blob"
});

state.context = {
  resourceKind: "image",
  sourceName: "result.png",
  exportedAsset: {kind: "image", dataUrl: "data:image/png;base64,result", fileName: "result.png", width: 64, height: 32},
  toolCandidates: [{id: "target", title: "Target Tool"}],
  sendToToolSupported: true
};
getNode("tools-workspace-export-tool-target").value = "target";
await submission.submit();
assert.equal(calls.toolAssets.length, 1);
assert.equal(calls.toolAssets[0].asset.fileName, "result.png");
assert.deepEqual({...calls.toolAssets[0].options}, {switchView: true});
assert.match(calls.outputs.at(-1), /Target Tool/);

state.activeTab = "lazydev";
getNode("tools-workspace-export-lazydev-target").value = "model3d";
await submission.submit();
assert.match(calls.outputs.at(-1), /2 images to 3D Model Studio/);

state.activeTab = "game-engine";
state.context = {
  entry: {id: "writer", title: "Text Writer"},
  resourceKind: "text",
  sourceName: "notes.txt",
  assetDescriptor: {
    resourceKind: "text",
    title: "Notes",
    fileName: "notes.txt",
    textContent: "Hello",
    metadata: {source: "editor"}
  }
};
getNode("tools-workspace-export-engine-target").value = "godot";
getNode("tools-workspace-export-engine-title").value = "Custom Notes";
await submission.submit();
const textExport = calls.requests.at(-1);
assert.equal(textExport.route, "/api/game-engine-export");
assert.equal(textExport.body.engine, "godot");
assert.equal(textExport.body.title, "Custom Notes");
assert.equal(textExport.body.textContent, "Hello");
assert.equal(textExport.body.metadata.sourceToolId, "writer");
assert.equal(calls.writtenEngines.at(-1), "godot");

state.context = {
  entry: {id: "viewer", title: "Model Viewer"},
  resourceKind: "model3d",
  sourceName: "robot.glb",
  modelAsset: {modelFileName: "robot.glb", modelUrl: "/models/robot.glb"}
};
await submission.submit();
const modelExport = calls.requests.at(-1);
assert.equal(modelExport.body.resourceKind, "model3d");
assert.equal(modelExport.body.sourceUrl, "https://dashboard.test/models/robot.glb");

state.activeTab = "tool";
state.context = {resourceKind: "image", toolCandidates: [], sendToToolReason: "No target available."};
await submission.submit();
assert.equal(calls.statuses.at(-1), "No target available.");
assert.equal(state.loading, false);
assert.equal(getNode("tools-workspace-export-submit-button").disabled, true);
assert.ok(calls.ui >= 10);

console.log("Tools workspace export submission validation passed.");
