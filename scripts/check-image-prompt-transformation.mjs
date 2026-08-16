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
  "promptTransformation.js"
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
    checked: false,
    events: [],
    classList: {add() {}, remove() {}, toggle() {}, contains() { return false; }},
    dispatchEvent(event) {
      this.events.push(event.type);
    },
    focus() {},
    setSelectionRange() {},
    getAttribute() { return null; },
    setAttribute() {}
  };
}

const document = {
  body: {classList: {add() {}, remove() {}}},
  getElementById: id => nodes.get(id) || null,
  querySelector: () => null,
  querySelectorAll: () => []
};
const context = vm.createContext({document, Event: TestEvent, window: {setTimeout}});
vm.runInContext(`${source}\nthis.createPromptTransformation = createDashboardImagePromptTransformation;`, context, {filename: modulePath});

const processingMode = createNode("sequential");
const batchSize = createNode("2");
nodes.set("image-prompt-processing-mode", processingMode);
nodes.set("image-prompt-processing-batch-size", batchSize);

const requests = [];
const outputMessages = [];
const statusMessages = [];
const objectPromptState = {items: [], activeIndex: 0, selectedIndices: new Set()};
const transformation = context.createPromptTransformation({
  objectPromptState,
  async request(route, body) {
    requests.push({route, body});
    return {prompt: "cinematic misty castle"};
  },
  setOutput: message => outputMessages.push(message),
  syncActivePromptFromField() {},
  renderObjectPrompts() {},
  setObjectPromptActiveIndex() {},
  setGenerationStatus: message => statusMessages.push(message),
  setElementVisible() {},
  setInputValue() {}
});

async function measureConcurrency(mode, size) {
  processingMode.value = mode;
  batchSize.value = String(size);
  let active = 0;
  let maximum = 0;
  const targets = Array.from({length: 5}, (_, index) => ({index}));
  const results = await transformation.processTasks(targets, async target => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active -= 1;
    return target.index;
  }, "Testing");
  assert.deepEqual(Array.from(results), [0, 1, 2, 3, 4]);
  return maximum;
}

assert.equal(await measureConcurrency("sequential", 2), 1);
assert.equal(await measureConcurrency("batch", 2), 2);
assert.equal(await measureConcurrency("all", 2), 5);

batchSize.value = "99";
assert.deepEqual({...transformation.readProcessingOptions()}, {mode: "all", batchSize: 20});
assert.equal(batchSize.value, "20");

const prompt = createNode("misty castle");
const autoPrompt = createNode();
autoPrompt.checked = true;
const promptTextFile = createNode("ideas.txt");
nodes.set("imagegen-prompt", prompt);
nodes.set("imagegen-negative-prompt", createNode("blurry"));
nodes.set("imagegen-auto-prompt", autoPrompt);
nodes.set("imagegen-prompt-text-file", promptTextFile);
processingMode.value = "sequential";
await transformation.improveFromUi();

assert.deepEqual(JSON.parse(JSON.stringify(requests)), [{
  route: "/api/image-rewrite-prompt",
  body: {currentPrompt: "misty castle", negativePrompt: "blurry", mode: "improve"}
}]);
assert.equal(prompt.value, "cinematic misty castle");
assert.deepEqual(prompt.events, ["input", "change"]);
assert.equal(autoPrompt.checked, false);
assert.equal(promptTextFile.value, "");
assert.equal(outputMessages.at(-1), "Improved 1 selected image prompt.");
assert.equal(statusMessages.at(-1), "Improved 1 image prompt.");

console.log("Image prompt transformation validation passed.");
