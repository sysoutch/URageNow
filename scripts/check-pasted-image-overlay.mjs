import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRepoFile = async relativePath => readFile(path.join(repoRoot, relativePath), "utf8");

// =========================================================
// STATIC WIRING ASSERTIONS
// =========================================================
const manifestSource = await readRepoFile("dashboard/src/client/clientScriptManifest.ts");
const overlayEntryIndex = manifestSource.indexOf('relativePath: "client/modules/dashboard/image/pastedImageOverlay.js"');
assert.ok(overlayEntryIndex >= 0, "manifest must include the pasted image overlay module");
const helpersEntryIndex = manifestSource.indexOf('relativePath: "client/modules/aiMediaStudioHelpers.js"');
assert.ok(helpersEntryIndex > overlayEntryIndex, "pasted image overlay must load before aiMediaStudioHelpers");

const workspaceSource = await readRepoFile("dashboard/src/client/modules/dashboard/image/editSourceWorkspace.js");
assert.match(workspaceSource, /function commitPastedImageFiles/, "workspace must expose the paste commit seam");
assert.match(workspaceSource, /typeof input\.onPastedImages === "function"/, "workspace must route pasted images through onPastedImages when provided");

const helpersSource = await readRepoFile("dashboard/src/client/modules/aiMediaStudioHelpers.js");
assert.match(helpersSource, /createDashboardPastedImageOverlay\(\{/, "helpers must instantiate the paste overlay");
assert.match(helpersSource, /onPastedImages: files => pastedImageOverlay\.show\(files\)/, "helpers must wire onPastedImages into the workspace input");

// =========================================================
// STUB DOM + RUNTIME BEHAVIOR TESTS
// =========================================================
function createStubNode(tagName) {
  const classes = new Set();
  const node = {
    tagName: String(tagName || "div").toUpperCase(),
    children: [],
    attributes: {},
    listeners: {},
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    src: "",
    setAttribute(key, val) { this.attributes[key] = String(val ?? ""); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null; },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; },
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
    focus() {}
  };
  Object.defineProperty(node, "className", {
    get: () => [...classes].join(" "),
    set(value) { classes.clear(); String(value || "").split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); }
  });
  node.classList = {
    contains: c => classes.has(c),
    add: (...cs) => cs.forEach(c => classes.add(c)),
    remove: (...cs) => cs.forEach(c => classes.delete(c)),
    toggle(c, force) {
      if (force === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); }
      else if (force) classes.add(c);
      else classes.delete(c);
      return classes.has(c);
    }
  };
  return node;
}

const studioPoolSelect = createStubNode("select");
studioPoolSelect.value = "pool-1";
const documentStub = {
  body: createStubNode("body"),
  elementsById: new Map([["imagegen-image-pool-select", studioPoolSelect]]),
  listeners: {},
  createElement(tag) { return createStubNode(tag); },
  getElementById(id) { return this.elementsById.get(id) || null; },
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
};

const overlaySource = await readRepoFile("dashboard/src/client/modules/dashboard/image/pastedImageOverlay.js");
const sandbox = {document: documentStub, Date};
vm.createContext(sandbox);
vm.runInContext(overlaySource + "\n;this.overlayFactory = createDashboardPastedImageOverlay;\n", sandbox);
assert.equal(typeof sandbox.overlayFactory, "function", "module must define createDashboardPastedImageOverlay");

const state = {
  imagePools: [{id: "pool-1", name: "Test Pool", images: ["http://dashboard.local/api/generated-image-file?id=a&file=b.png"]}],
  selectedImagePoolId: ""
};
const requestCalls = [];
let importCounter = 0;
async function fakeRequest(route, body) {
  requestCalls.push({route, body});
  if (route === "/api/image-import") {
    importCounter += 1;
    return {id: `imported-${importCounter}`, imageFileName: `imported-${importCounter}.png`};
  }
  if (route === "/api/image-pools") {
    return {id: body.id, name: body.name, images: [...body.images]};
  }
  throw new Error("Unexpected route " + route);
}
const outputs = [];
let sourceFilesUsed = null;
let historyImportId = null;
let poolRefreshCount = 0;

const overlay = sandbox.overlayFactory({
  state,
  request: fakeRequest,
  setOutput: message => outputs.push(message),
  buildAbsoluteDashboardUrl: value => `http://dashboard.local${String(value || "")}`,
  getGeneratedImageFileUrl: (id, file) => `/api/generated-image-file?id=${encodeURIComponent(id)}&file=${encodeURIComponent(file)}`,
  readFileAsDataUrl: async file => `data:image/png;base64,FAKE-${file.name}`,
  onUseAsSource: files => { sourceFilesUsed = files; },
  onImportedToHistory: async importedRecord => { historyImportId = importedRecord?.id || null; },
  refreshEditSourcePoolOptions: () => { poolRefreshCount += 1; }
});

const flush = () => new Promise(resolve => setTimeout(resolve, 5));
function findNode(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}
const dispatch = (node, type) => { (node.listeners[type] || []).forEach(handler => handler({target: node})); };

// =========================================================
// FLOW 1 - USE PASTED IMAGE AS EDIT SOURCE
// =========================================================
let shown = await overlay.show([{name: "pasted-one.png", type: "image/png"}]);
assert.equal(shown, true, "show must accept pasted image files");
const root = documentStub.body.children[0];
assert.equal(root.id, "pasted-image-overlay");
assert.ok(!root.classList.contains("hidden"), "overlay must be visible after show()");

const previewNode = findNode(root, node => node.tagName === "IMG");
assert.match(previewNode.src, /^data:image\/png;base64,FAKE-pasted-one\.png$/, "preview must use the first pasted data URL");
const hintNode = findNode(root, node => /pasted from the clipboard/.test(node.textContent));
assert.ok(hintNode, "hint text must describe the paste");

let confirmButton = findNode(root, node => node.id === "pasted-image-overlay-confirm-button");
dispatch(confirmButton, "click");
await flush();
assert.deepEqual(structuredClone(sourceFilesUsed).map(file => file.name), ["pasted-one.png"], "onUseAsSource must receive the pasted files");
assert.match(outputs.at(-1), /Used 1 pasted image as the Image Studio edit source\./);
assert.ok(root.classList.contains("hidden"), "overlay must close after using the source");

// =========================================================
// FLOW 2 - IMPORT INTO DASHBOARD + OPTIONAL POOL ADD
// =========================================================
shown = await overlay.show([{name: "pasted-two.png", type: "image/png"}]);
assert.equal(shown, true);
const importRadio = findNode(root, node => node.tagName === "INPUT" && node.value === "import");
importRadio.checked = true;
dispatch(importRadio, "change");
await flush();
const poolRow = findNode(root, node => node.classList.contains("pasted-image-pool-row"));
assert.ok(poolRow && !poolRow.classList.contains("hidden"), "pool row must appear when import is selected");

const poolSelect = findNode(root, node => node.id === "pasted-image-overlay-pool-select");
assert.equal(poolSelect.value, "pool-1", "default pool must follow the Image Studio pool selection");
const poolCheckbox = findNode(root, node => node.id === "pasted-image-overlay-pool-enabled");
poolCheckbox.checked = true;

confirmButton = findNode(root, node => node.id === "pasted-image-overlay-confirm-button");
dispatch(confirmButton, "click");
await flush();
await flush();

const importCalls = requestCalls.filter(call => call.route === "/api/image-import");
assert.equal(importCalls.length, 1, "each pasted image must hit /api/image-import once");
assert.deepEqual(structuredClone(importCalls[0].body), {dataUrl: "data:image/png;base64,FAKE-pasted-two.png", fileName: "pasted-two.png", prompt: "Pasted from clipboard"});
assert.equal(historyImportId, "imported-1", "history refresh must target the imported record");

const poolCalls = requestCalls.filter(call => call.route === "/api/image-pools");
assert.equal(poolCalls.length, 1, "pool add must post /api/image-pools once");
assert.equal(poolCalls[0].body.id, "pool-1");
assert.equal(poolCalls[0].body.images.length, 2, "pool images must merge existing + imported sources");
assert.match(poolCalls[0].body.images.at(-1), /^http:\/\/dashboard\.local\/api\/generated-image-file\?id=imported-1&file=imported-1\.png$/);

const syncedPool = state.imagePools.find(pool => pool.id === "pool-1");
assert.equal(syncedPool.images.length, 2, "state.imagePools must sync with the saved pool record in place");
assert.ok(poolRefreshCount >= 1, "edit source pool options must refresh after a pool add");
assert.match(outputs.at(-1), /Imported 1 image into Recent Images\. Added 1 image to pool Test Pool\./);
assert.ok(root.classList.contains("hidden"), "overlay must close after import completes");

console.log("Pasted image overlay checks passed.");
