import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const toolsRoot = path.join(repoRoot, "tools");
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

async function auditTool(indexPath) {
  const html = await fs.readFile(indexPath, "utf8");
  const scriptSources = readScriptSources(html);
  return {
    relativePath: normalizeWebPath(path.relative(repoRoot, indexPath)),
    hasThemeScript: scriptSources.some(source => source.endsWith("/dashboard-theme.js") || source.endsWith("dashboard-theme.js")),
    hasThemeAttribute: /\bdata-dashboard-theme\s*=/.test(html)
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

  const missingThemeScript = audits.filter(entry => !entry.hasThemeScript);
  const missingThemeAttribute = audits.filter(entry => !entry.hasThemeAttribute);
  if (missingThemeScript.length > 0 || missingThemeAttribute.length > 0) {
    if (missingThemeScript.length > 0) {
      console.error("Tools missing the shared dashboard theme bridge:");
      console.error(formatList(missingThemeScript, entry => `- ${entry.relativePath}`));
    }
    if (missingThemeAttribute.length > 0) {
      console.error("Tools missing a data-dashboard-theme host attribute:");
      console.error(formatList(missingThemeAttribute, entry => `- ${entry.relativePath}`));
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Dashboard tool theme audit passed: ${audits.length} HTML tools include the shared theme bridge and theme host attribute.`);
}

await main();
