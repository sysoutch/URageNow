import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const toolsRoot = path.join(repoRoot, "tools");
const workspaceHelpersPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceHelpers.js");
const resourceHubStylesPath = path.join(repoRoot, "dashboard", "src", "styles", "studio", "_blender-addons-assets.scss");
const skippedDirectoryNames = new Set(["bak", "vendor", "vendors", "node_modules", ".git"]);

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skippedDirectoryNames.has(entry.name)) continue;
      files.push(...await walk(nextPath));
      continue;
    }
    files.push(nextPath);
  }
  return files;
}

function normalizeWebPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function countSidebarMarkers(html) {
  return html.match(/\bdata-dashboard-tool-sidebar(?:\s|=|>)/g)?.length || 0;
}

async function auditTool(indexPath) {
  const html = await fs.readFile(indexPath, "utf8");
  const sidebarMarkerCount = countSidebarMarkers(html);
  return {
    relativePath: normalizeWebPath(path.relative(repoRoot, indexPath)),
    sidebarMarkerCount
  };
}

function formatList(items, mapper) {
  return items.map(mapper).join("\n");
}

async function main() {
  if (!await pathExists(toolsRoot)) throw new Error(`Tools directory not found: ${toolsRoot}`);
  const indexFiles = (await walk(toolsRoot))
    .filter(filePath => path.basename(filePath).toLowerCase() === "index.html")
    .filter(filePath => !filePath.includes(`${path.sep}shared${path.sep}`))
    .sort((a, b) => a.localeCompare(b));
  const audits = [];
  for (const indexPath of indexFiles) audits.push(await auditTool(indexPath));

  const multipleMarkers = audits.filter(entry => entry.sidebarMarkerCount > 1);
  if (multipleMarkers.length > 0) {
    if (multipleMarkers.length > 0) {
      console.error("Tools with more than one dashboard sidebar marker:");
      console.error(formatList(multipleMarkers, entry => `- ${entry.relativePath} (${entry.sidebarMarkerCount})`));
    }
    process.exitCode = 1;
    return;
  }

  const sidebarCount = audits.filter(entry => entry.sidebarMarkerCount > 0).length;
  const workspaceHelpers = await fs.readFile(workspaceHelpersPath, "utf8");
  if (!workspaceHelpers.includes("renderMainToolsCatalogFilter(entries)") || !workspaceHelpers.includes('catalogNode.querySelectorAll(".tools-catalog-group")')) {
    throw new Error("Tools workspace filters must update the visible main catalog.");
  }
  const resourceHubStyles = await fs.readFile(resourceHubStylesPath, "utf8");
  const hasBoundedAssetManager = /\.resource-hub-main\.asset-manager\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?max-height:\s*100%;[\s\S]*?overflow:\s*hidden\s*!important;/.test(resourceHubStyles);
  const hasWorkspaceScroller = /\.asset-manager \.game-engine-workspace-panel\s*\{[\s\S]*?flex:\s*1 1 0;[\s\S]*?height:\s*0;[\s\S]*?overflow-y:\s*auto;/.test(resourceHubStyles);
  if (!hasBoundedAssetManager || !hasWorkspaceScroller) {
    throw new Error("Game Engine workspace panels must use a bounded zero-basis flex scroller.");
  }
  console.log(`Dashboard tool sidebar audit passed: ${sidebarCount} tools expose at most one embedded sidebar marker.`);
  console.log("Dashboard workspace navigation audit passed: tool filtering and Game Engine asset scrolling are wired.");
}

await main();
