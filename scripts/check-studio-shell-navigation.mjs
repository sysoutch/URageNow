import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const helperPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboardOverlayHelpers.js");
const railHelperPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "studioSidebarHelpers.js");
const settingsPath = path.join(repoRoot, "dashboard", "src", "page.ts");
const railCategoryStylePath = path.join(repoRoot, "dashboard", "src", "styles", "shared", "_rail-category-cards.scss");
const [source, railHelper, settings, railCategoryStyles] = await Promise.all([
  fs.readFile(helperPath, "utf8"),
  fs.readFile(railHelperPath, "utf8"),
  fs.readFile(settingsPath, "utf8"),
  fs.readFile(railCategoryStylePath, "utf8")
]);
const start = source.indexOf("  function showStudioHome(");
const end = source.indexOf("\n  function showAllStudioCards()", start);

assert.ok(start >= 0 && end > start, "Studio home navigation helper must exist.");
const showStudioHomeSource = source.slice(start, end);
assert.doesNotMatch(showStudioHomeSource, /setStudioRailExpanded\(/, "Studio home navigation must preserve the explicit rail expansion state.");
assert.match(railHelper, /return "off";/, "Rail hover must default to the stable disabled mode.");
assert.match(railHelper, /value === "temp-expand" \|\| value === "collapse-expand"/, "Both explicit legacy hover modes must remain available.");
assert.match(railHelper, /hoverMode !== "off"/, "Hover activation must be gated by the saved mode.");
assert.doesNotMatch(railHelper, /hoverMode !== "off" && window\.innerWidth > 980 && state\.studioRailExpanded/, "Expanded rails must retain the explicitly enabled hover modes.");
assert.match(settings, /<option value="off">Off \(stable rail\)<\/option>/, "Settings must expose the stable rail hover default.");
assert.equal((settings.match(/data-settings-subtab="messengers"/g) || []).length, 1, "Setup must expose one Messengers subtab.");
assert.equal((settings.match(/data-settings-subpanel="messengers"/g) || []).length, 1, "Setup must render one Messenger Startup panel.");
assert.match(settings, /data-rail-category="bots"/, "Rail categories must expose stable styling hooks.");
assert.match(railCategoryStyles, /data-rail-category="studio"\] \{ --rail-category-color: var\(--rail-sidebar-accent\); \}/, "URage Now must inherit the active theme instead of a hardcoded fire-orange rail color.");
assert.match(railCategoryStyles, /min-height: 56px/, "Category cards must retain their 56px hierarchy height.");
assert.match(railCategoryStyles, /min-height: 38px/, "Child destinations must remain compact subordinate rows.");
assert.match(railCategoryStyles, /--server-rail-width: 224px !important/, "Every expanded category, including Bots, must share the desktop rail width.");
assert.match(railCategoryStyles, /font-family: "bootstrap-icons"/, "Category chevrons must use the shared Bootstrap Icons font.");
assert.doesNotMatch(railCategoryStyles, /content: "\\\\2304"/, "Category chevrons must not render an escaped text glyph.");
assert.match(railCategoryStyles, /padding: 0 !important;/, "Expanded category children must stay flush with adjoining category headers.");
assert.match(railCategoryStyles, /font-size: 13px !important;/, "Expanded child rows must share one readable text scale.");
assert.match(railCategoryStyles, /font-size: 18px !important;/, "Expanded child icons must share one icon scale.");
assert.match(railCategoryStyles, /rail-studio-workflow-button\.is-chat \{ --rail-icon-color/, "Workflow child colors must be tokenized rather than inherit the category color.");
assert.match(railCategoryStyles, /data-3d-suite="houdini".*--rail-icon-color: #75e2a0/, "3D suite child icons must retain explicit colors.");
assert.match(railCategoryStyles, /data-messenger="matrix".*--rail-icon-color: #67dfa1/, "Messenger child icons must retain explicit colors.");
assert.match(railCategoryStyles, /is-chat \{ --rail-icon-color: var\(--rail-icon-chat\) !important/, "Workflow icon colors must override legacy rail defaults.");
assert.match(railCategoryStyles, /data-resource-rail-group="bots"\] \{[\s\S]*border: 0 !important/, "Bots must share the same borderless child-list treatment.");
assert.match(railCategoryStyles, /data-resource-rail-group="bots"\]\s*\.rail-resource-section-button::before[\s\S]*content: none !important/, "Bots must not render tree connectors between flat messenger entries.");
assert.match(railCategoryStyles, /data-dashboard-theme="light"\]:is\(#\{\$rail-category-views\}\)\.studio-rail-expanded \[data-rail-category\]/, "The light-theme rail must have an explicit category treatment.");
assert.match(railCategoryStyles, /var\(--rail-category-color\) 8%, #ffffff 92%/, "Light-theme category cards should be restrained rather than dark slabs.");
assert.match(railCategoryStyles, /rail-bottom::before/, "Secondary rail actions must be visually separated.");

console.log("Studio shell navigation validation passed.");
