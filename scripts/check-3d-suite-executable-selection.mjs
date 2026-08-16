import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath => readFileSync(path.join(root, relativePath), "utf8");
const manager = read("dashboard/src/server/resourceHub/threeDSuiteInstallManager.ts");
const routes = read("dashboard/src/server/routes/resourceHubRoutes.ts");
const page = read("dashboard/src/pageSections/resourceHubView.ts");
const client = read("dashboard/src/client/modules/resourceHubViewHelpers.js");

for (const suite of ["3ds-max", "houdini", "cinema-4d"]) {
  assert.match(manager, new RegExp(`"${suite}"`), `${suite} needs executable discovery support.`);
}
assert.match(routes, /getRoute\("\/api\/3d-suites\/installs"/, "Suite install discovery route is missing.");
assert.match(page, /data-suite-executable-select/, "The shared suite executable picker is missing.");
assert.match(page, /non-blender-addon-panel/, "Non-Blender addon state must not show Blender controls.");
assert.match(client, /SUITE_EXECUTABLE_STORAGE_PREFIX/, "Per-suite picker persistence is missing.");
assert.match(client, /loadActiveSuiteInstalls/, "The picker must follow the selected suite.");
assert.match(client, /install and discovery controls will appear once/, "Unsupported addon actions must be described honestly.");

console.log("3D suite executable selection validation passed.");
