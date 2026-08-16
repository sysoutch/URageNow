import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "image", "previewQuickActionController.js");
const mediaPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "aiMediaStudioHelpers.js");
const [moduleSource, mediaSource] = await Promise.all([readFile(modulePath, "utf8"), readFile(mediaPath, "utf8")]);
const elements = new Map();
const runtime = vm.createContext({
  URL,
  window: {location: {origin: "http://dashboard.local"}},
  document: {getElementById: id => elements.get(id) || null}
});
vm.runInContext(`${moduleSource}\nthis.createController = createDashboardImagePreviewQuickActionController;`, runtime, {filename: modulePath});

assert.doesNotMatch(mediaSource, /function createEditSourceTarget/);
assert.match(mediaSource, /imagePreviewQuickActionController\.updateQuickActions\(record\)/);

const selected = {id: "image-1", imageFileName: "result.png", prompt: "A prompt", width: 512, height: 512};
const controller = runtime.createController({
  state: {imageStudioTab: "generate"},
  buildAbsoluteDashboardUrl: value => `http://dashboard.local${value}`,
  getGeneratedImageFileUrl: (id, fileName) => `/api/generated/${id}/${fileName}`,
  getActiveEditSource: () => null,
  getSelectedGeneratedImage: () => selected,
  getSelectedGeneratedImages: () => [selected]
});
const target = controller.getActiveTarget();
assert.equal(target.kind, "generated");
assert.equal(target.fileName, "result.png");
assert.equal(controller.getActionTargets().length, 1);

const button = {disabled: true, title: ""};
const hint = {textContent: ""};
elements.set("image-to-3d-button", button);
elements.set("image-preview-quick-action-hint", hint);
controller.updateQuickActions(selected);
assert.equal(button.disabled, false);
assert.match(button.title, /3D model/);
assert.match(hint.textContent, /result\.png/);
console.log("Image preview quick-action controller validation passed.");
