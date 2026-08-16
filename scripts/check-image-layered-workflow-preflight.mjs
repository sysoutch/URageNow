import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "image", "layeredWorkflowPreflight.js");
const mediaPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "aiMediaStudioHelpers.js");
const [moduleSource, mediaSource] = await Promise.all([readFile(modulePath, "utf8"), readFile(mediaPath, "utf8")]);
const classes = new Set(["hidden"]);
const statusNode = {
  classList: {toggle: (name, force) => force ? classes.add(name) : classes.delete(name)},
  dataset: {},
  textContent: ""
};
const runButton = {disabled: false};
const runtime = vm.createContext({
  document: {getElementById: id => id === "image-quick-action-preflight" ? statusNode : id === "image-quick-action-run-button" ? runButton : null},
  encodeURIComponent
});
vm.runInContext(`${moduleSource}\nthis.createPreflight = createDashboardImageLayeredWorkflowPreflight;`, runtime, {filename: modulePath});

assert.doesNotMatch(mediaSource, /async function refreshImageLayeredWorkflowPreflight/);
assert.match(mediaSource, /imageLayeredWorkflowPreflight\.getFailure\(\)/);

const requests = [];
const preflight = runtime.createPreflight({
  getWorkflowPath: () => "workflows/layered.json",
  request: async route => {
    requests.push(route);
    return route.startsWith("/api/image-workflow-metadata")
      ? {usesSubgraphs: false}
      : {status: "ready", missingNodeTypes: [], missingModelFiles: []};
  }
});
assert.equal(await preflight.getFailure(), "");
assert.ok(requests.every(route => route.includes("workflowPath=workflows%2Flayered.json")));
await preflight.refresh();
assert.equal(statusNode.dataset.state, "ready");
assert.equal(runButton.disabled, false);
assert.match(statusNode.textContent, /ready for layer separation/);
preflight.hide();
assert.equal(classes.has("hidden"), true);

const blocked = runtime.createPreflight({
  getWorkflowPath: () => "",
  request: async route => route.includes("metadata") ? {usesSubgraphs: true} : {}
});
assert.match(await blocked.getFailure(), /API-format or flattened/);
console.log("Image layered-workflow preflight validation passed.");
