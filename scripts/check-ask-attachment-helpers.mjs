import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(
  repoRoot,
  "dashboard",
  "src",
  "client",
  "modules",
  "dashboard",
  "media",
  "askAttachmentHelpers.js"
);
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createAttachments = createDashboardAskAttachmentHelpers;`, runtime, {filename: modulePath});

function createNode(tagName = "div") {
  const listeners = new Map();
  const classes = new Set();
  return {
    tagName,
    children: [],
    classList: {
      add: className => classes.add(className),
      contains: className => classes.has(className),
      toggle(className, force) {
        if (force) classes.add(className);
        else classes.delete(className);
      }
    },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatch(name, event = {}) { return listeners.get(name)?.(event); }
  };
}

const elements = new Map([
  ["ask-model-upload-list", createNode("section")],
  ["ask-file-upload-list", createNode("section")],
  ["ask-composer-attachment-tray", createNode("section")],
  ["ask-model-upload-input", {...createNode("input"), value: "selected"}],
  ["ask-file-upload-input", {...createNode("input"), value: "selected"}]
]);
const state = {
  aiImages: [{id: "image-1", name: "reference.png", detail: "Image", previewUrl: "data:image/png;base64,abc"}],
  askFileUploads: [],
  askSkillModelUploads: []
};
const calls = [];
const attachments = runtime.createAttachments({
  state,
  createElement: createNode,
  getElementById: id => elements.get(id),
  clearChildren: node => { node.children = []; },
  detachLazyMedia: node => calls.push(["detach", node]),
  onRemoveImage: id => calls.push(["remove-image", id]),
  readFileAsDataUrl: async file => file.dataUrl
});

attachments.renderModelUploads();
attachments.renderFileUploads();
assert.equal(elements.get("ask-model-upload-list").children[0].textContent, "No uploaded 3D models.");
assert.equal(elements.get("ask-file-upload-list").children[0].textContent, "No uploaded reference files.");
assert.equal(elements.get("ask-composer-attachment-tray").children[0].children.length, 1);

const modelResult = await attachments.addModelUploadsFromFiles([
  {name: "character.glb", type: "model/gltf-binary", size: 2048, dataUrl: "data:model/glb;base64,one"},
  {name: "notes.txt", type: "text/plain", size: 12, dataUrl: "data:text/plain;base64,two"}
]);
assert.deepEqual({...modelResult}, {added: 1, skipped: 1});
assert.equal(state.askSkillModelUploads[0].detail, "model/gltf-binary | 2.0 KB");
const duplicateModelResult = await attachments.addModelUploadsFromFiles([
  {name: "duplicate.glb", type: "model/gltf-binary", size: 2048, dataUrl: "data:model/glb;base64,one"}
]);
assert.deepEqual({...duplicateModelResult}, {added: 0, skipped: 1});

const textResult = await attachments.addFileUploadsFromFiles([
  {name: "readme.md", type: "text/markdown", size: 18, text: async () => "# Useful reference"},
  {name: "binary.exe", type: "application/octet-stream", size: 18, text: async () => "binary"},
  {name: "huge.txt", type: "text/plain", size: 400_000, text: async () => "too large"}
]);
assert.deepEqual({...textResult}, {added: 1, skipped: 2});
assert.equal(state.askFileUploads[0].text, "# Useful reference");
assert.equal(elements.get("ask-composer-attachment-tray").children[0].children.length, 3);

const modelRemoveButton = elements.get("ask-model-upload-list").children[0].children[2];
modelRemoveButton.dispatch("click");
assert.equal(state.askSkillModelUploads.length, 0);
assert.equal(elements.get("ask-model-upload-list").children[0].textContent, "No uploaded 3D models.");

attachments.clearFileUploads();
assert.equal(state.askFileUploads.length, 0);
assert.equal(elements.get("ask-file-upload-input").value, "");
attachments.clearModelUploads();
assert.equal(elements.get("ask-model-upload-input").value, "");

const imageRemoveButton = elements.get("ask-composer-attachment-tray").children[0].children[0].children[2];
imageRemoveButton.dispatch("click");
assert.equal(calls.some(call => call[0] === "remove-image" && call[1] === "image-1"), true);
assert.equal(attachments.isSupportedModelFile("scene.usdz"), true);
assert.equal(attachments.isLikelyTextFile({name: "config.json", type: ""}), true);
assert.equal(attachments.formatFileSize(1024 * 1024), "1.00 MB");

console.log("Ask attachment validation passed.");
