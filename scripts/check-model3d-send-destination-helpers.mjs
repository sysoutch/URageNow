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
  "3d",
  "sendDestinationHelpers.js"
);
const source = await readFile(modulePath, "utf8");
const pageSource = await readFile(path.join(repoRoot, "dashboard", "src", "pageSections", "aiView.ts"), "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createSendDestinations = createDashboardModel3dSendDestinationHelpers;`, runtime, {filename: modulePath});

assert.match(pageSource, /id="model3d-send-menu-toggle"[\s\S]*?<span>Send To \.\.\.<\/span>/);
assert.match(pageSource, /class="studio-send-destination-panel hidden" id="model3d-send-destination-panel" role="dialog" aria-modal="true"/);
assert.match(source, /overlayBackdrop\.className = "studio-send-destination-backdrop hidden"/);
assert.match(pageSource, /id="model3d-send-destination-close"/);
for (const tab of ["tool", "game-engine", "3d-suite", "3d-print"]) {
  assert.match(pageSource, new RegExp(`data-model3d-send-tab="${tab}"`));
}
assert.match(pageSource, /<option value="bambu-studio">BambuLab Studio<\/option>/);
assert.match(pageSource, /id="model3d-game-engine-select"/);
assert.match(pageSource, /id="model3d-game-engine-title"/);
assert.match(pageSource, /id="model3d-game-engine-send-status"/);
assert.match(pageSource, /<span>Queue Model Export<\/span>/);
assert.doesNotMatch(source, /bindTrigger\("model3d-send-to-game-engine-button", "model3d"\)/);

function createNode(attributes = {}) {
  const listeners = new Map();
  const classes = new Set(attributes.classNames || []);
  return {
    value: attributes.value || "",
    dataset: {},
    children: [],
    attributes: new Map(Object.entries(attributes.attributes || {})),
    classList: {
      contains: className => classes.has(className),
      toggle(className, force) {
        if (force) classes.add(className);
        else classes.delete(className);
      }
    },
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
      if (!this.value) this.value = child.value || "";
      return child;
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
    getAttribute(name) { return this.attributes.get(name) || null; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    dispatch(name, event = {}) { return listeners.get(name)?.(event); },
    click() { return listeners.get("click")?.({preventDefault() {}}); },
    focus() {}
  };
}

const toggle = createNode();
const panel = createNode({classNames: ["hidden"]});
panel.contains = () => false;
panel.parentElement = null;
const closeButton = createNode();
const overlayRoot = createNode();
const toolTab = createNode({classNames: ["active"], attributes: {"data-model3d-send-tab": "tool"}});
const printTab = createNode({attributes: {"data-model3d-send-tab": "3d-print"}});
const toolPane = createNode({classNames: ["active"], attributes: {"data-model3d-send-pane": "tool"}});
const printPane = createNode({classNames: ["hidden"], attributes: {"data-model3d-send-pane": "3d-print"}});
const printSelect = createNode({value: "bambu-studio"});
const printPath = createNode();
const printStatus = createNode();
const printButton = createNode();
const suiteButton = createNode();
const gameEngineButton = createNode();
const gameEngineSelect = createNode({value: "godot"});
const gameEngineTitle = createNode({value: "Ashtray Export"});
const gameEngineStatus = createNode();
const blenderButton = createNode();
const elements = new Map([
  ["model3d-send-menu-toggle", toggle],
  ["model3d-send-destination-panel", panel],
  ["model3d-send-destination-close", closeButton],
  ["model3d-print-application-select", printSelect],
  ["model3d-print-executable-path", printPath],
  ["model3d-print-send-status", printStatus],
  ["model3d-send-to-3d-print-button", printButton],
  ["model3d-send-to-3d-suite-button", suiteButton],
  ["model3d-send-to-game-engine-button", gameEngineButton],
  ["model3d-game-engine-select", gameEngineSelect],
  ["model3d-game-engine-title", gameEngineTitle],
  ["model3d-game-engine-send-status", gameEngineStatus],
  ["model3d-open-in-blender-button", blenderButton]
]);
const selected = {id: "model-1", modelFileName: "ashtray.stl"};
const calls = [];
const helper = runtime.createSendDestinations({
  getElementById: id => elements.get(id),
  overlayRoot,
  queryAll: selector => selector.includes("send-tab") ? [toolTab, printTab] : [toolPane, printPane],
  createElement: () => createNode(),
  clearChildren: node => { node.children = []; node.value = ""; },
  getSelectedGeneratedModel: () => selected,
  getModel3dViewerTarget: () => ({fileName: "ashtray.stl"}),
  getModel3dFileUrl: (modelId, fileName) => `/api/model3d/${modelId}/${fileName}`,
  buildAbsoluteDashboardUrl: value => `http://127.0.0.1:4782${value}`,
  setOutput: message => calls.push(["output", message]),
  request: async (url, body) => {
    calls.push(["request", url, body]);
    if (!body) {
      return {
        applications: [{
          id: "bambu-studio",
          label: "BambuLab Studio",
          executablePath: "C:\\Program Files\\Bambu Studio\\bambu-studio.exe",
          executableDetected: true
        }]
      };
    }
    return {result: {launched: true}};
  }
});

await helper.loadPrintApplications();
assert.equal(printPath.value, "C:\\Program Files\\Bambu Studio\\bambu-studio.exe");
assert.equal(printStatus.textContent, "BambuLab Studio is ready.");
helper.bind();
const backdrop = overlayRoot.children.find(child => child.id === "model3d-send-destination-backdrop");
assert.ok(backdrop);
assert.equal(backdrop.parentElement, overlayRoot);
assert.equal(panel.parentElement, backdrop);
toggle.click();
assert.equal(panel.classList.contains("hidden"), false);
assert.equal(backdrop.classList.contains("hidden"), false);
closeButton.click();
assert.equal(panel.classList.contains("hidden"), true);
assert.equal(backdrop.classList.contains("hidden"), true);
toggle.click();
printTab.click();
assert.equal(printTab.classList.contains("active"), true);
assert.equal(printPane.classList.contains("hidden"), false);

await helper.sendSelectedModelToPrintApplication();
const launchCall = calls.find(call => call[0] === "request" && call[2]);
assert.deepEqual({...launchCall[2]}, {
  applicationId: "bambu-studio",
  modelId: "model-1",
  fileName: "ashtray.stl"
});
assert.equal(calls.some(call => call[0] === "output" && call[1].includes("BambuLab Studio")), true);

await helper.queueSelectedModelForGameEngine();
const engineExportCall = calls.find(call => call[0] === "request" && call[1] === "/api/game-engine-export");
assert.deepEqual(JSON.parse(JSON.stringify(engineExportCall[2])), {
  engine: "godot",
  sourceStudio: "model3d",
  resourceKind: "model3d",
  title: "Ashtray Export",
  fileName: "ashtray.stl",
  mimeType: "model/stl",
  sourceUrl: "http://127.0.0.1:4782/api/model3d/model-1/ashtray.stl",
  metadata: {modelId: "model-1", variant: "current"}
});
assert.equal(gameEngineStatus.textContent, "Queued ashtray.stl for Godot.");

suiteButton.click();
assert.equal(panel.classList.contains("hidden"), true);

console.log("Model 3D send destination validation passed.");
