import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helperPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "media", "recentMediaViewHelpers.js");
const source = await readFile(helperPath, "utf8");
const context = vm.createContext({});
vm.runInContext(`${source}\nthis.createHelpers = createDashboardRecentMediaViewHelpers;`, context);
const helpers = context.createHelpers();
const entries = [
  {prompt: "Stone arch", steps: 24, variant: "merged", image: "arch.png"},
  {prompt: "Stone arch", steps: 12, variant: "lowpoly", image: "arch.png"},
  {prompt: "Forest", steps: 24, variant: "merged", image: "forest.png"}
];

helpers.getState("test").filterBy = "variant";
helpers.getState("test").filterValue = "lowpoly";
assert.deepEqual(
  Array.from(helpers.filterEntries(entries, "test", [{key: "variant", getValue: entry => entry.variant}]), entry => entry.variant),
  ["lowpoly"]
);
helpers.getState("test").filterBy = "steps";
helpers.getState("test").filterValue = "24";
assert.equal(helpers.filterEntries(entries, "test", [{key: "steps", type: "number", getValue: entry => entry.steps}]).length, 2);
helpers.getState("test").groupBy = "image";
const grouped = helpers.groupEntries(entries, "test", [{key: "image", getValue: entry => entry.image}]);
assert.deepEqual(Array.from(grouped, group => [group.label, group.entries.length]), [["arch.png", 2], ["forest.png", 1]]);

console.log("Recent media grouping and filtering validation passed.");
