import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "image", "quickActionModalExecution.js");
const mediaPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "aiMediaStudioHelpers.js");
const [moduleSource, mediaSource] = await Promise.all([readFile(modulePath, "utf8"), readFile(mediaPath, "utf8")]);
const elements = new Map([
  ["image-quick-action-prompt", {value: "Animate this"}],
  ["image-quick-action-mode", {value: "tool"}],
  ["image-quick-action-model-filename", {checked: true}],
  ["image-quick-action-model-description", {checked: false}],
  ["image-quick-action-model-scale", {checked: true}],
  ["image-quick-action-model-lowpoly", {checked: false}]
]);
const runtime = vm.createContext({document: {getElementById: id => elements.get(id) || null}});
vm.runInContext(`${moduleSource}\nthis.createExecution = createDashboardImageQuickActionModalExecution;`, runtime, {filename: modulePath});

const executionDelegate = mediaSource.slice(
  mediaSource.indexOf("function readImageQuickActionVideoOptions()"),
  mediaSource.indexOf("function applyVideoPreviewQuickActionOptions(options)")
);
assert.doesNotMatch(executionDelegate, /actionKey === "model3d"/);
assert.match(executionDelegate, /imageQuickActionModalExecution\.execute\(\)/);

let actionKey = "model3d";
const calls = [];
const execution = runtime.createExecution({
  getActionKey: () => actionKey,
  readOptionalNumberInput: id => id.length,
  closeModal: () => calls.push(["close"]),
  runModel3dAction: async options => calls.push(["model3d", options]),
  runImageAction: async (...args) => calls.push(["image", ...args]),
  runDelightInBlender: async () => calls.push(["blender"]),
  runDelightInTool: async () => calls.push(["tool"]),
  runRotate360Action: async options => calls.push(["rotate360", options]),
  runVideoAction: async options => calls.push(["video", options])
});

await execution.execute();
assert.equal(calls[0][0], "model3d");
assert.equal(calls[0][1].useLlmModelFileName, true);
assert.equal(calls.at(-1)[0], "close");

calls.length = 0;
actionKey = "delight";
await execution.execute();
assert.deepEqual(calls.map(call => call[0]), ["tool", "close"]);

calls.length = 0;
actionKey = "video";
await execution.execute();
assert.equal(calls[0][0], "video");
assert.equal(calls[0][1].prompt, "Animate this");
assert.equal(calls.at(-1)[0], "close");
console.log("Image quick-action modal execution validation passed.");
