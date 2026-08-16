import {copyFile, mkdir, readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "dashboard", "assets", "config", "remote-asset-icons.json");
const sourceRoot = path.join(repoRoot, "node_modules", "bootstrap-icons", "icons");
const cacheRoot = path.join(repoRoot, "dashboard", "assets", "vendor", "bootstrap-icons", "icons");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const iconNames = [...new Set(Object.values(manifest))].sort();

await mkdir(cacheRoot, {recursive: true});
await Promise.all(iconNames.map(iconName => copyFile(
  path.join(sourceRoot, `${iconName}.svg`),
  path.join(cacheRoot, `${iconName}.svg`)
)));

console.log(`Cached ${iconNames.length} official Bootstrap tool icons.`);
