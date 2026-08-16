import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceExportDescriptors.js");
const source = await readFile(modulePath, "utf8");
const window = {
  location: {href: "https://dashboard.test/tools/"},
  getComputedStyle: () => ({display: "block", visibility: "visible", opacity: "1"})
};
const context = vm.createContext({window, URL});
vm.runInContext(`${source}\nthis.createExportDescriptors = createDashboardToolExportDescriptors;`, context, {filename: modulePath});

let activeTab = "tool";
const compatibleTarget = {id: "normal-map", title: "Normal Map"};
const descriptors = context.createExportDescriptors({
  buildAbsoluteUrl: value => new URL(value, "https://dashboard.test/").href,
  getSendCandidates: (_entry, kind) => kind === "image" ? [compatibleTarget] : [],
  getActiveTab: () => activeTab
});

assert.equal(descriptors.inferMimeType("asset.GLB", ""), "model/gltf-binary");
assert.equal(descriptors.inferMimeType("voice.ogg", ""), "audio/ogg");
assert.equal(descriptors.normalizeAssetKind("MODEL3D"), "model3d");
assert.equal(descriptors.normalizeAssetKind("unknown"), "file");
assert.equal(descriptors.toAbsoluteUrl("exports/result.png"), "https://dashboard.test/exports/result.png");

const ownerDocument = {defaultView: window};
const downloadLink = {
  nodeType: 1,
  hidden: false,
  href: "/exports/result.png",
  download: "result.png",
  textContent: "Download PNG",
  ownerDocument,
  getAttribute(name) {
    if (name === "href") return "/exports/result.png";
    if (name === "download") return "result.png";
    return "";
  },
  hasAttribute: name => name === "download",
  getBoundingClientRect: () => ({width: 180, height: 32})
};
const document = {
  defaultView: window,
  querySelectorAll(selector) {
    return selector === "a[href]" ? [downloadLink] : [];
  }
};
const inferred = descriptors.inferCurrentAssetDescriptors({contentDocument: document}, {id: "converter", title: "Converter"});
assert.equal(inferred.length, 1);
assert.deepEqual({...inferred[0], metadata: {...inferred[0].metadata}}, {
  kind: "image",
  title: "result.png",
  fileName: "result.png",
  mimeType: "image/png",
  sourceUrl: "https://dashboard.test/exports/result.png",
  previewKind: "image",
  previewUrl: "https://dashboard.test/exports/result.png",
  metadata: {inferenceSource: "download-link"}
});

const normalized = descriptors.normalizeCurrentAssetDescriptor({
  kind: "image",
  title: "Processed Image",
  fileName: "processed.png",
  dataUrl: "data:image/png;base64,output",
  width: 512,
  height: 256
}, {id: "converter", title: "Converter"});
assert.equal(normalized.resourceKind, "image");
assert.equal(normalized.sendToToolSupported, true);
assert.equal(normalized.sendToEngineSupported, true);
assert.equal(normalized.toolCandidates[0], compatibleTarget);
assert.deepEqual({...normalized.exportedImage}, {
  dataUrl: "data:image/png;base64,output",
  fileName: "processed.png",
  width: 512,
  height: 256
});

const engineOnly = {
  resourceKind: "text",
  sourceName: "Notes",
  sendToToolSupported: false,
  sendToEngineSupported: true
};
const toolReady = normalized;
activeTab = "tool";
let selected = descriptors.buildExportContextFromOptions({id: "converter"}, [engineOnly, toolReady], "");
assert.equal(selected.sourceName, "processed.png");
activeTab = "engine";
selected = descriptors.buildExportContextFromOptions({id: "converter"}, [engineOnly, toolReady], "");
assert.equal(selected.sourceName, "Notes");
assert.equal(selected.resourceOptions.length, 2);

console.log("Tools workspace export descriptor validation passed.");
