import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [manager, routes, page, client, styles] = await Promise.all([
  readFile(new URL("../dashboard/src/server/resourceHub/remoteBlenderScriptCatalogManager.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/server/routes/resourceHubRoutes.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/pageSections/resourceHubView.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/resourceHubViewHelpers.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/styles/studio/_blender-addons-assets.scss", import.meta.url), "utf8")
]);

assert.match(manager, /https:\/\/github\.com\/sysoutch\/URage-Blender-Scripts/);
assert.match(routes, /getRoute\("\/api\/blender-script-catalog"/);
assert.match(routes, /getRoute\("\/api\/blender-script-catalog\/download"/);
assert.match(page, /data-suite-main-nav="scripts"/);
assert.match(page, /global-scripts-panel/);
assert.match(page, /data-blender-script-catalog-list/);
assert.match(page, /global-scripts-panel[\s\S]*resource-hub-section active/);
assert.match(page, /Local Starter Collections/);
assert.match(page, /maya-scripts/);
assert.match(page, /3dsmax-scripts/);
assert.match(page, /houdini-scripts/);
assert.match(page, /cinema4d-scripts/);
assert.match(client, /loadRemoteBlenderScriptCatalog\(false\)/);
assert.match(client, /tab !== "scripts"/);
assert.match(styles, /\.global-scripts-panel/);

const addonsPanelIndex = page.indexOf('class="resource-hub-content-wrap global-addons-panel');
const scriptsPanelIndex = page.indexOf('class="resource-hub-content-wrap global-scripts-panel');
assert.ok(scriptsPanelIndex > addonsPanelIndex, "Scripts panel must follow the Addons panel.");
assert.ok(
  page.lastIndexOf("</div>", scriptsPanelIndex) > addonsPanelIndex,
  "The Addons panel must close before the Scripts panel begins."
);

console.log("Remote Blender Scripts catalog validation passed.");
