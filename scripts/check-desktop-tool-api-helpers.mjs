import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "desktopToolApiHelpers.js");
const source = await readFile(modulePath, "utf8");
const runtime = vm.createContext({});
vm.runInContext(`${source}\nthis.createApi = createDashboardDesktopToolApiHelpers;`, runtime, {filename: modulePath});

const requests = [];
const responses = [
  {ok: true, json: async () => ({imports: [{id: "one"}]})},
  {ok: true, json: async () => ({entry: {id: "two"}})},
  {ok: false, json: async () => ({error: "Choose a tool type.", requiresToolType: true})},
  {ok: false, json: async () => { throw new Error("invalid json"); }}
];
const api = runtime.createApi({
  fetchRequest: async (url, options) => {
    requests.push({url, options});
    return responses.shift();
  }
});

assert.deepEqual(await api.get("/api/tool-repos"), {imports: [{id: "one"}]});
assert.equal(requests[0].options, undefined);
assert.deepEqual(await api.post("/api/tool-repos/import", {repository: "owner/repo"}), {entry: {id: "two"}});
assert.equal(requests[1].options.method, "POST");
assert.equal(requests[1].options.headers["content-type"], "application/json");
assert.equal(requests[1].options.body, JSON.stringify({repository: "owner/repo"}));

await assert.rejects(
  api.post("/api/tool-repos/import", {}),
  error => error.message === "Choose a tool type." && error.payload.requiresToolType === true
);
await assert.rejects(
  api.get("/api/tool-repos"),
  error => error.message === "Request failed." && typeof error.payload === "object"
);

console.log("Desktop tool API helper validation passed.");
