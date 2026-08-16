import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "3d", "viewerCanvasInputHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createCanvasInput = createDashboardThreeDViewerCanvasInputHelpers;`, runtime, {filename: modulePath});

function createCanvas() {
  const listeners = new Map();
  return {
    attributes: new Map(),
    focusOptions: null,
    listeners,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
    focus(options) { this.focusOptions = options; },
    setAttribute(name, value) { this.attributes.set(name, value); }
  };
}
const calls = [];
const input = runtime.createCanvasInput({
  bindManualOrbitGuards: canvas => calls.push(["guards", canvas]),
  focusViewer: () => calls.push(["focus"]),
  resetCamera: () => calls.push(["reset"])
});
const canvas = createCanvas();
assert.equal(input.bind(canvas), true);
assert.equal(canvas.tabIndex, 0);
assert.match(canvas.attributes.get("aria-label"), /Press F/);
assert.equal(canvas.listeners.size, 2);
canvas.listeners.get("pointerdown")();
assert.equal(canvas.focusOptions.preventScroll, true);

const focusEvent = {key: "F", code: "KeyF", defaultPrevented: false, repeat: false, preventDefault() { this.prevented = true; }};
canvas.listeners.get("keydown")(focusEvent);
assert.equal(focusEvent.prevented, true);
assert.equal(calls.at(-1)[0], "focus");
const resetEvent = {key: ".", code: "Period", defaultPrevented: false, repeat: false, preventDefault() { this.prevented = true; }};
canvas.listeners.get("keydown")(resetEvent);
assert.equal(calls.at(-1)[0], "reset");

assert.equal(input.bind(canvas), true);
assert.equal(calls.filter(call => call[0] === "guards").length, 1);
assert.equal(input.unbind(), true);
assert.equal(canvas.listeners.size, 0);
assert.equal(input.unbind(), false);

console.log("3D viewer canvas input validation passed.");
