import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const toolsRoot = path.join(repoRoot, "tools");
const workspaceHelpersPath = path.join(repoRoot, "dashboard", "src", "client", "modules", "dashboard", "tools", "workspaceHelpers.js");
const interactiveBookMainPath = path.join(toolsRoot, "dev", "interactive-book", "js", "main.js");
const fallbackScriptName = "dashboard-current-output-autodescribe.js";
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

function getToolRoot(indexPath) {
  return path.dirname(indexPath);
}

function getExpectedFallbackSrc(indexPath) {
  const relative = path.relative(path.dirname(indexPath), path.join(toolsRoot, "shared", fallbackScriptName));
  return normalizeWebPath(relative.startsWith(".") ? relative : `./${relative}`);
}

function readScriptSources(html) {
  const sources = [];
  const pattern = /<script\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/gi;
  let match = pattern.exec(html);
  while (match) {
    sources.push(match[2].trim());
    match = pattern.exec(html);
  }
  return sources;
}

async function readBridgeSources(toolRoot) {
  const files = await walk(toolRoot);
  const sources = [];
  for (const filePath of files) {
    if (!/\.(html|js|mjs)$/i.test(filePath)) continue;
    if (filePath.endsWith(fallbackScriptName)) continue;
    sources.push(await fs.readFile(filePath, "utf8"));
  }
  return sources.join("\n");
}

function hasExplicitCurrentDescriptor(source) {
  return source.includes("__urageToolDescribeCurrent") || source.includes("onDescribeCurrentAsset");
}

async function auditTool(indexPath) {
  const html = await fs.readFile(indexPath, "utf8");
  const scriptSources = readScriptSources(html);
  const expectedFallbackSrc = getExpectedFallbackSrc(indexPath);
  const toolRoot = getToolRoot(indexPath);
  const bridgeSource = await readBridgeSources(toolRoot);
  return {
    indexPath,
    relativePath: normalizeWebPath(path.relative(repoRoot, indexPath)),
    expectedFallbackSrc,
    hasFallback: scriptSources.some(source => source === expectedFallbackSrc || source.endsWith(`/${fallbackScriptName}`)),
    hasBlankScriptSource: scriptSources.some(source => source.length === 0),
    hasExplicitDescriptor: hasExplicitCurrentDescriptor(bridgeSource)
  };
}

function formatList(items, mapper) {
  return items.map(mapper).join("\n");
}

async function main() {
  if (!await pathExists(toolsRoot)) {
    throw new Error(`Tools directory not found: ${toolsRoot}`);
  }

  const indexFiles = (await walk(toolsRoot))
    .filter(filePath => path.basename(filePath).toLowerCase() === "index.html")
    .filter(filePath => !filePath.includes(`${path.sep}shared${path.sep}`))
    .sort((a, b) => a.localeCompare(b));
  const audits = [];
  for (const indexPath of indexFiles) {
    audits.push(await auditTool(indexPath));
  }

  const missingFallback = audits.filter(entry => !entry.hasFallback);
  const blankScriptSources = audits.filter(entry => entry.hasBlankScriptSource);
  if (missingFallback.length > 0 || blankScriptSources.length > 0) {
    if (missingFallback.length > 0) {
      console.error("Tools missing the dashboard current-output fallback:");
      console.error(formatList(missingFallback, entry => `- ${entry.relativePath} expected ${entry.expectedFallbackSrc}`));
    }
    if (blankScriptSources.length > 0) {
      console.error("Tools with blank script src attributes:");
      console.error(formatList(blankScriptSources, entry => `- ${entry.relativePath}`));
    }
    process.exitCode = 1;
    return;
  }

  const explicitCount = audits.filter(entry => entry.hasExplicitDescriptor).length;
  const workspaceHelpers = await fs.readFile(workspaceHelpersPath, "utf8");
  if (/dispatchEvent\(new DragEvent\(["']drop["']/.test(workspaceHelpers) || /Object\.defineProperty\(dropEvent,\s*["']dataTransfer["']/.test(workspaceHelpers)) {
    throw new Error("Dashboard tool file injection must not synthesize drop events after dispatching file-input changes.");
  }
  const interactiveBookMain = await fs.readFile(interactiveBookMainPath, "utf8");
  if (!interactiveBookMain.includes("__urageToolLoadAssetPayload") || !interactiveBookMain.includes("sourceKind: 'dashboard-send'")) {
    throw new Error("Interactive Book must expose its direct dashboard asset receiver.");
  }
  console.log(`Dashboard tool bridge audit passed: ${audits.length} HTML tools include the shared Game Engine send fallback.`);
  console.log(`Explicit current-asset descriptors found in ${explicitCount} tools; remaining tools use the fallback descriptor.`);
  console.log("Dashboard asset delivery audit passed: file injection is single-shot and Interactive Book uses its direct receiver.");
}

await main();
