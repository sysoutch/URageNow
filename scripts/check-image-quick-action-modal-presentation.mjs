import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "image", "quickActionModalPresentation.js");
const mediaPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "aiMediaStudioHelpers.js");
const [moduleSource, mediaSource] = await Promise.all([readFile(modulePath, "utf8"), readFile(mediaPath, "utf8")]);

function createNode() {
  const classes = new Set(["hidden"]);
  return {
    append() {},
    appendChild() {},
    className: "",
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name)
    },
    focus() {},
    innerHTML: "",
    placeholder: "",
    querySelector: () => ({textContent: ""}),
    textContent: "",
    value: ""
  };
}
const elementIds = [
  "image-quick-action-modal", "image-quick-action-modal-title", "image-quick-action-kicker",
  "image-quick-action-preview-gallery", "image-quick-action-source-name", "image-quick-action-source-detail",
  "imagegen-width", "imagegen-height", "image-quick-action-run-button", "image-quick-action-run-status"
];
const elements = new Map(elementIds.map(id => [id, createNode()]));
elements.get("imagegen-width").value = "512";
elements.get("imagegen-height").value = "768";
const bodyClasses = new Set();
const runtime = vm.createContext({
  document: {
    body: {classList: {add: name => bodyClasses.add(name), remove: name => bodyClasses.delete(name)}},
    createElement: () => createNode(),
    getElementById: id => elements.get(id) || null,
    querySelector: () => createNode(),
    querySelectorAll: () => []
  },
  window: {setTimeout: callback => callback()}
});
vm.runInContext(`${moduleSource}\nthis.createPresentation = createDashboardImageQuickActionModalPresentation;`, runtime, {filename: modulePath});

assert.doesNotMatch(mediaSource, /const imageQuickActionModalState/);
assert.doesNotMatch(mediaSource, /function setImageQuickActionModalMode/);
assert.match(mediaSource, /imageQuickActionModalPresentation\.open\(actionKey\)/);

const inputValues = new Map();
let preflightRefreshes = 0;
let preflightCancels = 0;
const presentation = runtime.createPresentation({
  clearChildren() {},
  getActionTargets: () => [],
  getActiveTarget: () => ({kind: "generated", imageUrl: "/image.png", fileName: "image.png", label: "image.png", prompt: "Source prompt"}),
  layeredPreflight: {
    cancel: () => { preflightCancels += 1; },
    hide() {},
    refresh: async () => { preflightRefreshes += 1; }
  },
  setCheckboxValue() {},
  setInputValue: (id, value) => inputValues.set(id, value),
  setOutput() {}
});

presentation.open("video");
assert.equal(presentation.getActionKey(), "video");
assert.equal(elements.get("image-quick-action-modal-title").textContent, "Generate Video From Image");
assert.match(inputValues.get("image-quick-action-prompt"), /Source prompt/);
assert.equal(preflightRefreshes, 0);
assert.equal(bodyClasses.has("image-quick-action-modal-open"), true);
presentation.close();
assert.equal(presentation.getActionKey(), "");
assert.equal(preflightCancels, 1);
assert.equal(bodyClasses.has("image-quick-action-modal-open"), false);
console.log("Image quick-action modal presentation validation passed.");
