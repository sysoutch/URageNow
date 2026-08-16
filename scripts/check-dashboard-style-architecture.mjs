import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const stylesRoot = path.join(repoRoot, "dashboard", "src", "styles");
const stylesEntryPath = path.join(repoRoot, "dashboard", "src", "styles.scss");
const studioIndexPath = path.join(stylesRoot, "studio", "_index.scss");
const mediaAiIndexPath = path.join(stylesRoot, "_media-ai.scss");
const model3dStylesPath = path.join(stylesRoot, "media-ai", "_model3d.scss");
const mediaDocksPath = path.join(stylesRoot, "media-ai", "_media-docks.scss");
const workflowTabsPath = path.join(stylesRoot, "studio", "_workflow-tabs.scss");
const focusedWorkflowPath = path.join(stylesRoot, "studio", "_focused-workflow.scss");
const focusedWorkflowResponsivePath = path.join(stylesRoot, "studio", "_focused-workflow-responsive.scss");
const focusedWorkflowModel3dPath = path.join(stylesRoot, "studio", "_focused-workflow-model3d.scss");
const sharedStudioComponentsPath = path.join(stylesRoot, "shared", "_studio-components.scss");
const sharedPopupPath = path.join(stylesRoot, "shared", "_popup.scss");
const legacyWorkflowStylesPath = path.join(stylesRoot, "media-ai", "_workflow-active.scss");
const stylesheetLineBudgets = new Map([
  ["shared/_studio-components.scss", 3492],
  ["media-ai/_model3d.scss", 2783],
  ["studio/_focused-workflow.scss", 2509],
  ["_cards-components.scss", 2495],
  ["studio/_core.scss", 2299],
  ["_content-layout.scss", 2171],
  ["_tools.scss", 2063]
]);

async function collectScssFiles(directory) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const nestedFiles = await Promise.all(entries.map(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectScssFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".scss") ? [entryPath] : [];
  }));
  return nestedFiles.flat();
}

const stylesEntry = await fs.readFile(stylesEntryPath, "utf8");
const executableEntryLines = stylesEntry.split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith("//"));
assert.ok(executableEntryLines.every(line => /^@use\s+"styles\/[a-z-]+";$/.test(line)), "styles.scss must remain a layer loading map.");

const studioIndex = await fs.readFile(studioIndexPath, "utf8");
assert.match(studioIndex, /@use "workflow-tabs";[\s\S]*@use "focused-workflow";/, "Studio workflow tabs must load before focused workflow placement overrides.");
assert.match(studioIndex, /@use "focused-workflow";[\s\S]*@use "focused-workflow-responsive";[\s\S]*@use "focused-workflow-model3d";[\s\S]*@use "about-overlay";/, "Focused responsive and 3D refinements must preserve their cascade order before the about overlay.");

const mediaAiIndex = await fs.readFile(mediaAiIndexPath, "utf8");
assert.match(mediaAiIndex, /@use "media-ai\/model3d";[\s\S]*@use "media-ai\/media-docks";[\s\S]*@use "media-ai\/image";/, "Shared media docks must preserve their cascade position between model3d and image styles.");

const model3dStyles = await fs.readFile(model3dStylesPath, "utf8");
const mediaDocks = await fs.readFile(mediaDocksPath, "utf8");
assert.doesNotMatch(model3dStyles, /\.audio-queue-list/, "Cross-media queue and filmstrip styling does not belong in media-ai/_model3d.scss.");
assert.match(mediaDocks, /\.audio-queue-list/, "Shared media dock queue styling must remain in media-ai/_media-docks.scss.");

const workflowTabs = await fs.readFile(workflowTabsPath, "utf8");
assert.match(workflowTabs, /\.workspace-tabs-new\.studio-primary-tabs/, "Studio workflow tab geometry must live in studio/_workflow-tabs.scss.");

const legacyWorkflowStyles = await fs.readFile(legacyWorkflowStylesPath, "utf8");
assert.doesNotMatch(legacyWorkflowStyles, /studio-primary-tabs/, "Studio workflow tab geometry must not drift back into the transitional media-ai stylesheet.");

const focusedWorkflow = await fs.readFile(focusedWorkflowPath, "utf8");
const focusedWorkflowResponsive = await fs.readFile(focusedWorkflowResponsivePath, "utf8");
const focusedWorkflowModel3d = await fs.readFile(focusedWorkflowModel3dPath, "utf8");
const sharedStudioComponents = await fs.readFile(sharedStudioComponentsPath, "utf8");
const sharedPopup = await fs.readFile(sharedPopupPath, "utf8");
assert.doesNotMatch(focusedWorkflow, /@media \(max-width: 1500px\)/, "Focused workflow responsive layout belongs in studio/_focused-workflow-responsive.scss.");
assert.match(focusedWorkflowResponsive, /@media \(max-width: 1500px\)/, "Focused workflow responsive layout must remain in its dedicated partial.");
assert.doesNotMatch(focusedWorkflow, /#model3d-tool-picker-menu/, "Focused 3D tool-picker styling belongs in studio/_focused-workflow-model3d.scss.");
assert.match(focusedWorkflowModel3d, /#model3d-tool-picker-menu/, "Focused 3D tool-picker styling must remain in its dedicated partial.");
assert.doesNotMatch(sharedStudioComponents, /\.dashboard-popup-overlay/, "Global popup styling does not belong in shared/_studio-components.scss.");
assert.match(sharedPopup, /\.dashboard-popup-overlay/, "Global popup styling must remain in shared/_popup.scss.");

const scssFiles = await collectScssFiles(stylesRoot);
for (const scssPath of scssFiles) {
  const source = await fs.readFile(scssPath, "utf8");
  const relativeStylePath = path.relative(stylesRoot, scssPath).replaceAll(path.sep, "/");
  assert.doesNotMatch(source, /(?:\r?\n[ \t]*){4}/, `${path.relative(repoRoot, scssPath)} contains more than two consecutive blank lines.`);
  const lineBudget = stylesheetLineBudgets.get(relativeStylePath);
  if (lineBudget) {
    const lineCount = source.split(/\r?\n/).length - (source.endsWith("\n") ? 1 : 0);
    assert.ok(lineCount <= lineBudget, `${relativeStylePath} grew to ${lineCount} lines; its cleanup baseline is ${lineBudget}. Extract owned components instead of expanding it.`);
  }
}

console.log("Dashboard stylesheet architecture validation passed.");
