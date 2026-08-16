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
  "image",
  "promptInterpretation.js"
);
const source = await readFile(modulePath, "utf8");
const nodes = new Map();

class TestEvent {
  constructor(type) {
    this.type = type;
  }
}

function createNode(value = "") {
  return {
    value,
    src: "",
    checked: false,
    disabled: false,
    textContent: "",
    events: [],
    classList: {toggle() {}},
    dispatchEvent(event) {
      this.events.push(event.type);
    },
    focus() {},
    getAttribute() { return null; },
    setAttribute() {}
  };
}

const document = {
  getElementById: id => nodes.get(id) || null,
  querySelectorAll: () => []
};
const context = vm.createContext({document, Event: TestEvent});
vm.runInContext(`${source}\nthis.createPromptInterpretation = createDashboardImagePromptInterpretation;`, context, {filename: modulePath});

[
  "image-prompt-interpret-preview-image",
  "image-prompt-interpret-preview-empty",
  "image-prompt-interpret-preview-name",
  "image-prompt-interpret-preview-detail",
  "image-interpret-source-clear-button",
  "image-interpret-with-llm-button",
  "image-interpret-source-aspect-button",
  "image-interpret-source-file",
  "image-identify-objects-toggle",
  "image-interpret-direction-input",
  "imagegen-prompt",
  "imagegen-auto-prompt"
].forEach(id => nodes.set(id, createNode()));

const requests = [];
const outputs = [];
const statuses = [];
let objectInterpretationCount = 0;
const interpretation = context.createPromptInterpretation({
  readFileAsDataUrl: async () => "data:image/png;base64,source",
  setOutput: message => outputs.push(message),
  async request(route, body) {
    requests.push({route, body});
    return {prompt: "a glass observatory above the clouds"};
  },
  setElementVisible() {},
  getClipboardImageFiles: () => [],
  getWorkflowDimensions: () => ({width: 512, height: 512}),
  setEditorDimensions() {},
  setGenerationStatus: message => statuses.push(message),
  captureWebcam: async () => null,
  interpretObjects() {
    objectInterpretationCount += 1;
    return "objects";
  }
});

await assert.rejects(() => interpretation.setSourceFromFile({name: "notes.txt", type: "text/plain"}), /choose an image file/i);
await interpretation.setSourceFromFile({name: "observatory.png", type: "image/png"});
assert.deepEqual({...interpretation.getSource()}, {
  value: "data:image/png;base64,source",
  previewUrl: "data:image/png;base64,source",
  fileName: "observatory.png",
  detailMode: "normal"
});
assert.equal(nodes.get("image-prompt-interpret-preview-image").src, "data:image/png;base64,source");
assert.equal(nodes.get("image-prompt-interpret-preview-name").textContent, "observatory.png");
assert.deepEqual({...interpretation.fitDimensionsToAspectRatio(1600, 900)}, {width: 680, height: 384});

nodes.get("image-interpret-direction-input").value = "focus on architecture";
nodes.get("imagegen-auto-prompt").checked = true;
const prompt = await interpretation.interpretSource();
assert.equal(prompt, "a glass observatory above the clouds");
assert.deepEqual(JSON.parse(JSON.stringify(requests)), [{
  route: "/api/image-interpret-prompt",
  body: {
    imageInput: "data:image/png;base64,source",
    imageFileNameHint: "observatory.png",
    detailMode: "normal",
    direction: "focus on architecture"
  }
}]);
assert.equal(nodes.get("imagegen-prompt").value, prompt);
assert.deepEqual(nodes.get("imagegen-prompt").events, ["input", "change"]);
assert.equal(nodes.get("imagegen-auto-prompt").checked, false);
assert.deepEqual(nodes.get("imagegen-auto-prompt").events, ["change"]);
assert.equal(statuses.at(-1), "Prompt updated from source image.");
assert.equal(outputs.at(-1), "Image prompt replaced from observatory.png.");

nodes.get("image-identify-objects-toggle").checked = true;
assert.equal(await interpretation.interpretSource(), "objects");
assert.equal(objectInterpretationCount, 1);
assert.equal(requests.length, 1);

interpretation.clearSource();
assert.equal(interpretation.getSource().value, "");
assert.equal(nodes.get("image-interpret-source-file").value, "");

console.log("Image prompt interpretation validation passed.");
