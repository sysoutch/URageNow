import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "dashboard", "src", "client", "clientScriptManifest.ts");
const modulesRoot = path.join(repoRoot, "dashboard", "src", "client", "modules");
const manifestSource = readFileSync(manifestPath, "utf8");

function walkJsFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walkJsFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

function toClientRelativePath(fullPath) {
  return path.relative(path.join(repoRoot, "dashboard", "src"), fullPath).replaceAll(path.sep, "/");
}

function getManifestPaths() {
  return new Set([...manifestSource.matchAll(/relativePath:\s*"([^"]+)"/g)].map(match => match[1]));
}

function getMissingManifestEntries() {
  const manifestPaths = getManifestPaths();
  return walkJsFiles(modulesRoot)
    .map(toClientRelativePath)
    .filter(relativePath => !manifestPaths.has(relativePath));
}

function getMissingManifestFiles() {
  return [...getManifestPaths()]
    .filter(relativePath => relativePath.startsWith("client/"))
    .filter(relativePath => !existsSync(path.join(repoRoot, "dashboard", "src", relativePath)));
}

function getEagerBootstrapProxyReads() {
  const proxyPath = path.join(modulesRoot, "bootstrapProxyHelpers.js");
  const source = readFileSync(proxyPath, "utf8");
  return source.split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter(entry => /helpers\?\.[A-Za-z0-9_]+\s*(\|\||,|$)/.test(entry.text))
    .map(entry => `${toClientRelativePath(proxyPath)}:${entry.line}: ${entry.text.trim()}`);
}

const failures = [
  ...getMissingManifestEntries().map(relativePath => `Missing manifest entry: ${relativePath}`),
  ...getMissingManifestFiles().map(relativePath => `Manifest points to missing file: ${relativePath}`),
  ...getEagerBootstrapProxyReads().map(message => `Eager bootstrap proxy read: ${message}`)
];

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Dashboard client module manifest/proxy validation passed.");
