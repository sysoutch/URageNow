import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(
  new URL("../dashboard/src/client/modules/dashboard/tools/toolScaffoldController.js", import.meta.url),
  "utf8"
);
assert.match(source, /\/api\/tools\/scaffold\/plan/);
assert.match(source, /\/api\/tools\/scaffold\/create/);
assert.match(source, /plannedImplementation/);
assert.match(source, /payload\.implementation/);
assert.match(source, /specification changed after implementation/i);
assert.match(source, /renderImplementationPreview/);
assert.match(source, /renderImplementationFile/);
assert.match(source, /Name, category, folder slug, description, and purpose are required/);
assert.match(source, /window\.location\.reload/);
assert.doesNotMatch(source, /innerHTML\s*=/);

console.log("Tool scaffold controller validation passed.");
