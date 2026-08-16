import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceExportContext.js");
const source = await readFile(modulePath, "utf8");
const frame = {contentWindow: {}};
const document = {getElementById: id => id === "tools-workspace-frame" ? frame : null};
const runtime = vm.createContext({document});
vm.runInContext(`${source}\nthis.createExportContext = createDashboardToolExportContext;`, runtime, {filename: modulePath});

let inferredDescriptors = [];
let processedImage = null;
const normalizeDescriptor = (descriptor, entry) => ({
  entry,
  resourceKind: descriptor.kind,
  sourceName: descriptor.fileName || descriptor.title,
  sourceDetail: "Normalized descriptor",
  preview: {kind: descriptor.kind, url: descriptor.sourceUrl || descriptor.dataUrl},
  exportedAsset: descriptor.dataUrl ? {kind: descriptor.kind, dataUrl: descriptor.dataUrl, fileName: descriptor.fileName} : null,
  toolCandidates: [],
  sendToToolSupported: Boolean(descriptor.dataUrl),
  sendToEngineSupported: Boolean(descriptor.sourceUrl || descriptor.dataUrl)
});
const buildContextFromOptions = (_entry, contexts, preferredId) => {
  if (!contexts.length) return null;
  return {...contexts[0], selectedResourceId: preferredId || "first"};
};
const exportContext = runtime.createExportContext({
  buildAbsoluteUrl: value => new URL(value, "https://dashboard.test/").href,
  buildContextFromOptions,
  getSelectedResourceId: () => "selected",
  getSendCandidates: () => [{id: "target", title: "Target"}],
  inferDescriptors: () => inferredDescriptors,
  isGifViewer: sourcePath => sourcePath.includes("gif-viewer"),
  isImageTool: sourcePath => sourcePath.includes("image-tool"),
  isModelViewer: sourcePath => sourcePath.includes("model-viewer"),
  normalizeDescriptor,
  requestProcessedImage: async () => processedImage
});

frame.contentWindow = {
  __urageToolDescribeCurrentAssets: async () => [{kind: "video", fileName: "clip.mp4", sourceUrl: "/clip.mp4"}]
};
let result = await exportContext.build({id: "converter", title: "Converter", sourcePath: "/video-tool/"});
assert.equal(result.resourceKind, "video");
assert.equal(result.sourceName, "clip.mp4");
assert.equal(result.selectedResourceId, "selected");

frame.contentWindow = {
  __urageThreeModelViewerCurrentAsset: {
    modelFileName: "robot.glb",
    modelUrl: "/models/robot.glb",
    previewImageUrl: "/models/robot.png"
  }
};
result = await exportContext.build({id: "viewer", title: "Viewer", sourcePath: "/model-viewer/"});
assert.equal(result.resourceKind, "model3d");
assert.equal(result.modelAsset.modelFileName, "robot.glb");
assert.equal(result.preview.url, "https://dashboard.test/models/robot.png");

frame.contentWindow = {};
result = await exportContext.build({id: "viewer", title: "Viewer", sourcePath: "/model-viewer/"});
assert.equal(result.sendToEngineSupported, false);
assert.match(result.sendToEngineReason, /Load a dashboard model/);

processedImage = {dataUrl: "data:image/png;base64,result", fileName: "result.png", width: 128, height: 64};
inferredDescriptors = [];
result = await exportContext.build({id: "image", title: "Image Tool", sourcePath: "/image-tool/"});
assert.equal(result.resourceKind, "image");
assert.equal(result.exportedImage.fileName, "result.png");
assert.equal(result.toolCandidates[0].id, "target");

processedImage = null;
inferredDescriptors = [{kind: "audio", fileName: "sound.wav", sourceUrl: "/sound.wav", metadata: {inferenceSource: "download-link"}}];
result = await exportContext.build({id: "audio", title: "Audio Tool", sourcePath: "/audio-tool/"});
assert.equal(result.resourceKind, "audio");
assert.equal(result.sendToEngineSupported, true);

inferredDescriptors = [];
result = await exportContext.build({id: "unknown", title: "Unknown", sourcePath: "/unknown/"});
assert.equal(result.resourceKind, "unsupported");
assert.equal(result.sendToToolSupported, false);

console.log("Tools workspace export context validation passed.");
