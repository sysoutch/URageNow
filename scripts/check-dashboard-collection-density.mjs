import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [switcher, helper, styles, railStyles] = await Promise.all([
  readFile(path.join(root, "dashboard/src/shared/dashboardLayoutSwitcher.ts"), "utf8"),
  readFile(path.join(root, "dashboard/src/client/modules/dashboardLayoutSwitcherHelpers.js"), "utf8"),
  readFile(path.join(root, "dashboard/src/styles/legacy/_collection-density.scss"), "utf8"),
  readFile(path.join(root, "dashboard/src/styles/shared/_studio-components.scss"), "utf8")
]);

assert.match(switcher, /data-dashboard-density-input/);
assert.match(switcher, /min="75" max="140" step="5"/);
assert.match(helper, /urage-dashboard-density:/);
assert.match(helper, /applyDashboardDensity/);
assert.match(helper, /Math\.min\(140, Math\.max\(75/);
assert.match(styles, /--dashboard-collection-scale/);
assert.match(styles, /dashboard-density-control/);
assert.match(railStyles, /body\.view-dashboard-active \.rail-bot-sections/);
assert.match(railStyles, /body:not\(\.view-dashboard-active\) \.rail-bot-sections/);
assert.doesNotMatch(railStyles, /body\.view-assets-active,[\s\S]{0,200}\.rail-bot-sections/);

console.log("Dashboard collection density and Bots rail validation passed.");
