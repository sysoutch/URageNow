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
  "objectPromptCollection.js"
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
    dispatchEvent(event) {
      this.events.push(event.type);
    },
    focus() {}
  };
}

const document = {
  getElementById: id => nodes.get(id) || null,
  querySelectorAll: () => [],
  createElement: () => createNode()
};
const context = vm.createContext({document, Event: TestEvent});
vm.runInContext(`${source}\nthis.createObjectPrompts = createDashboardImageObjectPromptCollection;`, context, {filename: modulePath});

nodes.set("image-identify-max-amount", createNode("2"));
nodes.set("image-interpret-direction-input", createNode("separate the props"));
nodes.set("imagegen-prompt", createNode("retain the studio lighting"));

const requests = [];
const generated = [];
const statuses = [];
const outputs = [];
const collection = context.createObjectPrompts({
  setElementVisible() {},
  syncProcessingControls() {},
  getPromptSource: () => ({value: "data:image/png;base64,source", fileName: "props.png"}),
  async request(route, body) {
    requests.push({route, body});
    return {
      objects: [
        {name: "Lamp", prompt: "red ceramic lamp"},
        {name: "Chair", prompt: ""},
        {name: "Ignored", prompt: "third object"},
        {name: "", prompt: ""}
      ]
    };
  },
  setGenerationStatus: message => statuses.push(message),
  setOutput: message => outputs.push(message),
  async generateImage(options) {
    generated.push(options);
  },
  getStudioTab: () => "create"
});

const identified = await collection.identifyFromUi();
assert.deepEqual(Array.from(identified, entry => ({...entry})), [
  {name: "Lamp", prompt: "red ceramic lamp"},
  {name: "Chair", prompt: "Chair"}
]);
assert.deepEqual(JSON.parse(JSON.stringify(requests)), [{
  route: "/api/image-identify-objects",
  body: {
    imageInput: "data:image/png;base64,source",
    imageFileNameHint: "props.png",
    direction: "separate the props",
    prompt: "retain the studio lighting",
    maxObjects: 2
  }
}]);

collection.state.items = identified.map(entry => ({...entry}));
collection.state.activeIndex = 0;
nodes.get("imagegen-prompt").value = "edited red ceramic lamp";
await collection.generateFromUi();
assert.deepEqual(JSON.parse(JSON.stringify(generated)), [
  {promptOverride: "edited red ceramic lamp", promptTextFileOverride: "", autoPromptOverride: false, count: 1},
  {promptOverride: "Chair", promptTextFileOverride: "", autoPromptOverride: false, count: 1}
]);
assert.equal(statuses.at(-1), "Generated 2 separate image(s).");
assert.equal(outputs.at(-1), "Generated 2 separate image(s).");

nodes.get("image-identify-max-amount").value = "99";
assert.equal(collection.readMaxAmount(), 20);
assert.equal(nodes.get("image-identify-max-amount").value, "20");

console.log("Image object prompt collection validation passed.");
