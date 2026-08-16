import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page = readFileSync("dashboard/src/page.ts", "utf8");
const controller = readFileSync("dashboard/src/client/modules/dashboardOverlayHelpers.js", "utf8");

assert.doesNotMatch(page, /data-settings-tab="remote-access"/);
assert.doesNotMatch(page, /data-settings-tab="devices"/);
for (const tab of ["setup", "network", "ui", "themes"]) {
  assert.match(page, new RegExp(`data-settings-tab="${tab}"`));
  assert.match(page, new RegExp(`data-settings-panel="${tab}"`));
}
for (const tab of ["connection", "remote-access", "devices"]) {
  assert.match(page, new RegExp(`data-network-settings-subtab="${tab}"`));
  assert.match(page, new RegExp(`data-network-settings-subpanel="${tab}"`));
}
assert.match(controller, /function switchNetworkSettingsSubtab/);
assert.match(controller, /allowedTabs = new Set\(\["connection", "remote-access", "devices"\]\)/);
assert.match(controller, /panel\.classList\.toggle\("active"/);
assert.match(controller, /settings-overlay-title/);
assert.match(controller, /querySelectorAll\("\[data-network-settings-subtab\]"\)/);

console.log("Dashboard settings navigation validation passed.");
