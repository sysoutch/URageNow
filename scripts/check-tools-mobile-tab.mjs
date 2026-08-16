import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [viewSource, modeSource, styleSource] = await Promise.all([
  readFile(new URL("../dashboard/src/pageSections/toolsView.ts", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/client/modules/dashboard/tools/desktopToolsHelpers.js", import.meta.url), "utf8"),
  readFile(new URL("../dashboard/src/styles/_tools.scss", import.meta.url), "utf8")
]);

const repositoryUrl = "https://github.com/sysoutch/urage-now-android-companion";

assert.match(viewSource, /data-tools-mode-tab="desktop"[\s\S]*data-tools-mode-tab="mobile"/);
assert.match(viewSource, /class="tools-mobile-panel hidden" data-tools-mode-panel="mobile"/);
assert.match(viewSource, /URage Now Android Companion/);
assert.ok(viewSource.includes(`const repositoryUrl = "${repositoryUrl}"`));
assert.ok(viewSource.includes('href="${repositoryUrl}/releases/latest"'));
assert.ok(viewSource.includes('href="${repositoryUrl}"'));
assert.match(modeSource, /\["desktop", "mobile"\]\.includes\(mode\)/);
assert.match(modeSource, /tools-mobile-mode/);
assert.match(modeSource, /catalog\.classList\.toggle\("hidden", nextMode !== "browser"\)/);
assert.match(styleSource, /\.tools-desktop-panel,\s*\.tools-mobile-panel/);
assert.match(styleSource, /body\.tools-mobile-mode :is\(\.tools-dashboard-toolbar, \.tool-import-panel\)/);

console.log("Tools mobile tab validation passed.");
