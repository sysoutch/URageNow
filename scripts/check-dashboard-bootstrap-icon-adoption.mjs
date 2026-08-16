import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const [
  dashboardIconsSource,
  aiStudioLayoutSource,
  aiActionSource,
  desktopToolsSource,
  iconMarkupSource,
  pageSource,
  studioSidebarSource
] = await Promise.all([
  read("dashboard/src/shared/dashboardIcons.ts"),
  read("dashboard/src/client/modules/aiStudioLayoutHelpers.js"),
  read("dashboard/src/client/modules/aiActionHelpers.js"),
  read("dashboard/src/client/modules/dashboard/tools/desktopToolsHelpers.js"),
  read("dashboard/src/client/modules/iconMarkupHelpers.js"),
  read("dashboard/src/page.ts"),
  read("dashboard/src/client/modules/studioSidebarHelpers.js")
]);

assert.match(dashboardIconsSource, /const workflowBootstrapIconNames/);
assert.match(dashboardIconsSource, /const toolsBootstrapIconNames/);
assert.match(dashboardIconsSource, /renderBootstrapIcon\(workflowBootstrapIconNames\[iconKey\]\)/);
assert.doesNotMatch(dashboardIconsSource, /const workflowIconPaths/);

assert.match(pageSource, /renderWorkflowIcon\(iconKey\)/);
assert.match(pageSource, /renderDashboardNavigationIcon\("resources"\)/);
assert.doesNotMatch(pageSource, /renderWorkflowIconSvg|renderToolsIconSvg/);

assert.match(iconMarkupSource, /dashboardClientBootstrapIconNames/);
assert.match(iconMarkupSource, /bi bi-/);
assert.doesNotMatch(iconMarkupSource, /const dashboardClientIconPaths/);
assert.doesNotMatch(iconMarkupSource, /renderDashboardClientSvgMarkup/);

assert.match(aiActionSource, /askQuickActionBootstrapIconNameByKey/);
assert.match(aiActionSource, /<i class=\\"bi bi-/);
assert.doesNotMatch(aiActionSource, /askQuickActionIconMarkupByKey/);
assert.match(desktopToolsSource, /bi bi-' \+ iconName/);
assert.doesNotMatch(desktopToolsSource, /<svg/);
assert.match(studioSidebarSource, /bi bi-stars/);
assert.match(studioSidebarSource, /bi bi-pencil-square/);
assert.match(studioSidebarSource, /bi bi-diagram-3/);
assert.doesNotMatch(studioSidebarSource, /<svg/);
assert.equal((pageSource.match(/<svg viewBox="0 0 64 64"/g) || []).length, 5);
assert.doesNotMatch(aiStudioLayoutSource, /innerHTML\s*=\s*['"`][\s\S]*<svg/);
assert.match(aiStudioLayoutSource, /createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "svg"\)/);

const clientModulesRoot = fileURLToPath(new URL("../dashboard/src/client/modules/", import.meta.url));
const clientModulePaths = (await readdir(clientModulesRoot, {recursive: true}))
  .filter(relativePath => relativePath.endsWith(".js"));
const dynamicSvgModules = [];
for (const relativePath of clientModulePaths) {
  const source = await readFile(path.join(clientModulesRoot, relativePath), "utf8");
  assert.doesNotMatch(source, /<svg\b/i, `${relativePath} contains an ordinary inline SVG outside the allowlist.`);
  if (source.includes("createElementNS(\"http://www.w3.org/2000/svg\"")) {
    dynamicSvgModules.push(relativePath.replaceAll(path.sep, "/"));
  }
}
assert.deepEqual(dynamicSvgModules, ["aiStudioLayoutHelpers.js"]);

console.log("Dashboard Bootstrap Icon adoption validation passed.");
