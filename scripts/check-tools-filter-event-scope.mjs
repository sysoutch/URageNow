import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../dashboard/src/client/modules/studioSidebarHelpers.js", import.meta.url), "utf8");
const workspaceSource = await readFile(new URL("../dashboard/src/client/modules/dashboard/tools/workspaceHelpers.js", import.meta.url), "utf8");

assert.match(source, /target\.closest\("\.rail-tools-categories \[data-tools-filter\]"\)/);
assert.doesNotMatch(source, /target\.closest\("\[data-tools-filter\]"\)/);
assert.match(workspaceSource, /let toolsViewEventsBound = false;/);
assert.match(workspaceSource, /if \(toolsViewEventsBound\) \{\s*return;\s*\}/);
assert.match(workspaceSource, /document\.addEventListener\("DOMContentLoaded", bindToolsViewEvents, \{ once: true \}\)/);

console.log("Tools filter event scope validation passed.");
