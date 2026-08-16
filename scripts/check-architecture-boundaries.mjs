import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["shared/src", "server/src", "dashboard/src", "bots/discord-bot/src", "workers/remote-worker/src"];
const ignoredDirectories = new Set(["dist", "node_modules", "target"]);
const sourceExtensions = new Set([".ts", ".js", ".mjs", ".cjs"]);
const forbiddenTargets = {
  shared: new Set(["server", "dashboard", "bots", "workers"]),
  server: new Set(["dashboard", "bots"]),
  dashboard: new Set(["bots"]),
  workers: new Set(["dashboard", "bots"])
};
const packageLayers = {
  "@urage/shared": "shared",
  "@urage/server": "server",
  "@urage/dashboard": "dashboard",
  "@urage/discord-bot": "bots"
};

async function collectSourceFiles(directory) {
  const files = [];
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...await collectSourceFiles(path.join(directory, entry.name)));
      }
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function getLayer(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath.split(path.sep)[0] || "";
}

function extractImports(source) {
  const imports = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
  }
  return imports;
}

const violations = [];
for (const sourceRoot of sourceRoots) {
  const files = await collectSourceFiles(path.join(repoRoot, sourceRoot));
  for (const filePath of files) {
    const sourceLayer = getLayer(filePath);
    const forbidden = forbiddenTargets[sourceLayer];
    if (!forbidden) {
      continue;
    }
    const source = await readFile(filePath, "utf8");
    for (const importPath of extractImports(source)) {
      const packageName = Object.keys(packageLayers).find(name => importPath === name || importPath.startsWith(`${name}/`));
      const targetLayer = packageName
        ? packageLayers[packageName]
        : importPath.startsWith(".")
          ? getLayer(path.resolve(path.dirname(filePath), importPath))
          : "";
      if (forbidden.has(targetLayer)) {
        violations.push(`${path.relative(repoRoot, filePath)} -> ${importPath} (${targetLayer})`);
      }
      if (/(?:^|\/)(?:shared|server|dashboard)\/src\//.test(importPath)) {
        violations.push(`${path.relative(repoRoot, filePath)} -> ${importPath} (deep workspace source import)`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:");
  violations.forEach(violation => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log("Architecture boundary validation passed.");
}
