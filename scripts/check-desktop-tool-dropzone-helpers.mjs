import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "desktopToolDropzoneHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createDropzone = createDashboardDesktopToolDropzoneHelpers;`, runtime, {filename: modulePath});

function createNode() {
  const listeners = new Map();
  const classes = new Set();
  return {
    listeners,
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    },
    addEventListener: (name, listener) => {
      const entries = listeners.get(name) || [];
      entries.push(listener);
      listeners.set(name, entries);
    },
    dispatch(name, event = {}) {
      (listeners.get(name) || []).forEach(listener => listener(event));
    }
  };
}

const dropzone = createNode();
const fileInput = createNode();
fileInput.files = [];
fileInput.click = () => calls.push(["browse"]);
const pathInput = createNode();
pathInput.value = "";
const browseButton = createNode();
const addPathButton = createNode();
const nodes = new Map([
  ["[data-desktop-tool-dropzone]", dropzone],
  ["[data-desktop-tool-file-input]", fileInput],
  ["[data-desktop-tool-path-input]", pathInput],
  ["[data-desktop-tool-browse]", browseButton],
  ["[data-desktop-tool-add-path]", addPathButton]
]);
const calls = [];
const controller = runtime.createDropzone({
  query: selector => nodes.get(selector),
  getFilePath: file => file?.path || file?.name || "",
  pinTool(toolPath) {
    if (toolPath === "bad") throw new Error("Invalid tool path.");
    calls.push(["pin", toolPath]);
  },
  setStatus: (message, tone) => calls.push(["status", message, tone])
});

assert.equal(controller.bind(), true);
browseButton.dispatch("click");
assert.deepEqual(calls.at(-1), ["browse"]);

fileInput.files = [{name: "tool.exe"}];
fileInput.dispatch("change");
assert.equal(pathInput.value, "tool.exe");
assert.match(calls.at(-1)[1], /full path/);

fileInput.files = [{path: "C:\\Tools\\tool.exe"}];
fileInput.dispatch("change");
assert.deepEqual(calls.at(-1), ["pin", "C:\\Tools\\tool.exe"]);

pathInput.value = "bad";
addPathButton.dispatch("click");
assert.deepEqual(calls.at(-1), ["status", "Invalid tool path.", "error"]);

const dragEvent = {preventDefault() { this.prevented = true; }};
dropzone.dispatch("dragover", dragEvent);
assert.equal(dragEvent.prevented, true);
assert.equal(dropzone.classList.contains("is-dragging"), true);
dropzone.dispatch("dragleave");
assert.equal(dropzone.classList.contains("is-dragging"), false);

dropzone.dispatch("drop", {
  dataTransfer: {files: [{path: "/opt/tools/run.sh"}]},
  preventDefault() { this.prevented = true; }
});
assert.equal(dropzone.classList.contains("is-dragging"), false);
assert.deepEqual(calls.at(-1), ["pin", "/opt/tools/run.sh"]);

console.log("Desktop tool dropzone validation passed.");
