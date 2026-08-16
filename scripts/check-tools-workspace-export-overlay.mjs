import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceExportOverlay.js");
const source = await readFile(modulePath, "utf8");

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    toggle(value, force) {
      if (force === undefined ? !values.has(value) : force) values.add(value);
      else values.delete(value);
    },
    contains: value => values.has(value)
  };
}

function createElement(tagName = "div") {
  const attributes = new Map();
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    classList: createClassList(),
    className: "",
    disabled: false,
    textContent: "",
    value: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    getAttribute: name => attributes.get(name) || "",
    setAttribute: (name, value) => attributes.set(name, String(value))
  };
}

class Option {
  constructor(text, value) {
    this.textContent = text;
    this.value = value;
  }
}

const nodes = new Map();
const getNode = id => {
  if (!nodes.has(id)) nodes.set(id, createElement());
  return nodes.get(id);
};
const toolTab = createElement("button");
toolTab.setAttribute("data-tools-export-tab", "tool");
const engineTab = createElement("button");
engineTab.setAttribute("data-tools-export-tab", "game-engine");
const toolPanel = createElement();
toolPanel.setAttribute("data-tools-export-panel", "tool");
const enginePanel = createElement();
enginePanel.setAttribute("data-tools-export-panel", "game-engine");
const document = {
  body: createElement("body"),
  createElement,
  getElementById: getNode,
  querySelectorAll(selector) {
    if (selector === "[data-tools-export-tab]") return [toolTab, engineTab];
    if (selector === "[data-tools-export-panel]") return [toolPanel, enginePanel];
    return [];
  }
};
const context = vm.createContext({document, Option});
vm.runInContext(`${source}\nthis.createExportOverlay = createDashboardToolExportOverlay;`, context, {filename: modulePath});

const imageContext = {
  entry: {id: "source-tool"},
  resourceKind: "image",
  sourceName: "result.png",
  sourceDetail: "Processed result",
  preview: {kind: "image", url: "data:image/png;base64,result", label: "Result"},
  exportedImage: {dataUrl: "data:image/png;base64,result"},
  toolCandidates: [{id: "target-tool", title: "Target Tool", categoryLabel: "Art"}],
  sendToToolSupported: true,
  sendToEngineSupported: true
};
const textContext = {
  resourceKind: "text",
  sourceName: "notes.txt",
  sendToToolSupported: false,
  sendToEngineSupported: true
};
const state = {
  activeTab: "tool",
  context: {
    ...imageContext,
    resourceOptions: [
      {id: "image", label: "Image", context: imageContext},
      {id: "text", label: "Text", context: textContext}
    ],
    selectedResourceId: "image"
  },
  loading: false,
  selectedResourceId: "image"
};
const statuses = [];
const overlay = context.createExportOverlay({
  state,
  clearChildren: node => { node.children.length = 0; },
  readPreferredEngine: () => "godot",
  getPreferredSendTargetId: () => "target-tool",
  buildExportContext: async entry => ({...textContext, entry}),
  getActiveEntry: () => ({id: "active-tool", title: "Active Tool"}),
  setStatus: value => statuses.push(value)
});

overlay.updateUi();
assert.equal(getNode("tools-workspace-export-preview-stage").children[0].tagName, "IMG");
assert.equal(getNode("tools-workspace-export-source-name").textContent, "result.png");
assert.equal(getNode("tools-workspace-export-resource-select").children.length, 2);
assert.equal(getNode("tools-workspace-export-tool-target").value, "target-tool");
assert.equal(getNode("tools-workspace-export-engine-target").value, "godot");
assert.equal(getNode("tools-workspace-export-submit-button").disabled, false);

overlay.setSelectedResource("text");
assert.equal(state.context.sourceName, "notes.txt");
assert.equal(state.selectedResourceId, "text");

overlay.setTab("game-engine");
assert.equal(state.activeTab, "game-engine");
assert.equal(engineTab.classList.contains("active"), true);
assert.equal(toolPanel.classList.contains("hidden"), true);
assert.equal(getNode("tools-workspace-export-submit-button").textContent, "Queue Export");

overlay.open();
assert.equal(getNode("tools-workspace-export-overlay").getAttribute("aria-hidden"), "false");
assert.equal(document.body.classList.contains("runtime-overlay-open"), true);
overlay.close();
assert.equal(getNode("tools-workspace-export-overlay").getAttribute("aria-hidden"), "true");
assert.equal(document.body.classList.contains("runtime-overlay-open"), false);

state.activeTab = "tool";
await overlay.openForEntry();
assert.equal(state.activeTab, "game-engine");
assert.equal(state.context.sourceName, "notes.txt");
assert.match(statuses.at(-1), /Prepared notes\.txt/);

console.log("Tools workspace export overlay validation passed.");
