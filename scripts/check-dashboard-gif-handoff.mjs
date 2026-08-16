import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const workspacePath = path.join(root, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceHelpers.js");
const exportDescriptorsPath = path.join(root, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceExportDescriptors.js");
const converterPath = path.join(root, "tools", "video", "media-converter", "script.js");
const viewerPath = path.join(root, "tools", "art", "gif-viewer", "script.js");
const [workspace, exportDescriptors, converter, viewer] = await Promise.all(
  [workspacePath, exportDescriptorsPath, converterPath, viewerPath].map(filePath => fs.readFile(filePath, "utf8"))
);

assert.match(converter, /kind:\s*"gif"/, "Media Converter must expose converted GIF resources.");
assert.match(exportDescriptors, /resourceKind === "gif"/, "Tool workspace must preserve GIF resources.");
assert.match(workspace, /isGifViewerToolSourcePath/, "Tool workspace must route GIF resources to GIF Viewer.");
assert.match(viewer, /tool:load-asset/, "GIF Viewer must accept dashboard-loaded resources.");

console.log("Dashboard GIF handoff validation passed.");
