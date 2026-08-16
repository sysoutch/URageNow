import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceRuntime.js");
const source = await readFile(modulePath, "utf8");
const bootstrapSource = await readFile(
  path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboardClientBootstrap.js"),
  "utf8"
);
assert.match(bootstrapSource, /getModel3dViewerTarget:\s*\(\.\.\.args\)\s*=>\s*getModel3dViewerTarget\(\.\.\.args\)/);
assert.match(bootstrapSource, /resolveModel3dPreviewMedia:\s*\(\.\.\.args\)\s*=>\s*resolveModel3dPreviewMedia\(\.\.\.args\)/);
const context = vm.createContext({document: {getElementById: () => null}});
vm.runInContext(`${source}\nthis.runtimeApi = {
  configureDashboardToolsWorkspaceRuntime,
  state,
  toolsWorkspaceState,
  toolQuickActionState,
  pixelArtConversionRequests,
  pixelArtReadyWaiters,
  request,
  setOutput,
  getModel3dViewerTarget,
  resolveModel3dPreviewMedia
};`, context, {filename: modulePath});

const runtimeApi = context.runtimeApi;
await assert.rejects(() => runtimeApi.request("/api/test"), /request helper is not ready/i);

const state = {activeView: "tools"};
const workspaceState = {activeToolId: "pixel-art"};
const quickActionState = {image: "normal-map"};
const requests = vm.runInContext("new Map()", context);
const waiters = vm.runInContext("[]", context);
const output = [];
const routes = [];
runtimeApi.configureDashboardToolsWorkspaceRuntime({
  state,
  toolsWorkspaceState: workspaceState,
  toolQuickActionState: quickActionState,
  pixelArtConversionRequests: requests,
  pixelArtReadyWaiters: waiters,
  setOutput: message => output.push(message),
  async request(route) {
    routes.push(route);
    return {ok: true};
  },
  getModel3dViewerTarget: record => ({fileName: record.modelFileName}),
  resolveModel3dPreviewMedia: record => ({fileName: record.previewFileName})
});

assert.equal(runtimeApi.state.activeView, "tools");
runtimeApi.state.activeView = "studio";
assert.equal(state.activeView, "studio");
runtimeApi.toolsWorkspaceState.activeToolId = "map-generator";
assert.equal(workspaceState.activeToolId, "map-generator");
runtimeApi.toolQuickActionState.image = "pixel-art";
assert.equal(quickActionState.image, "pixel-art");

runtimeApi.pixelArtConversionRequests.set("job-1", {status: "pending"});
assert.deepEqual({...requests.get("job-1")}, {status: "pending"});
runtimeApi.pixelArtReadyWaiters.push("ready");
assert.deepEqual(Array.from(waiters), ["ready"]);
assert.deepEqual({...await runtimeApi.request("/api/tools")}, {ok: true});
assert.deepEqual(routes, ["/api/tools"]);
runtimeApi.setOutput("runtime configured");
assert.deepEqual(output, ["runtime configured"]);
assert.deepEqual(
  {...runtimeApi.getModel3dViewerTarget({modelFileName: "character.fbx"})},
  {fileName: "character.fbx"}
);
assert.deepEqual(
  {...runtimeApi.resolveModel3dPreviewMedia({previewFileName: "character.png"})},
  {fileName: "character.png"}
);

console.log("Tools workspace runtime validation passed.");
