import {execFile} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdir, readdir, rename, rm, stat} from "node:fs/promises";
import path from "node:path";
import {dataRoot} from "@urage/server/config/repositoryPaths";

const repositoryUrl = "https://github.com/sysoutch/URage-Blender-Scripts";
const catalogRoot = path.join(dataRoot, "remote-script-catalog", "urage-blender-scripts");
const checkoutPath = path.join(catalogRoot, "repository");
const downloadsPath = path.join(catalogRoot, "downloads");
type ScriptEntry = {id: string; title: string; relativePath: string; githubUrl: string; icon: string; fileCount: number; directoryCount: number;};
type ScriptCatalog = {repositoryUrl: string; revision: string; cachedAt: string; entries: ScriptEntry[];};
let refreshPromise: Promise<void> | null = null;

function git(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => execFile("git", args, {cwd, env: {...process.env, GIT_TERMINAL_PROMPT: "0"}, timeout: 180000, windowsHide: true, maxBuffer: 8 * 1024 * 1024}, (error, stdout, stderr) => {
    if (error) return reject(new Error(String(stderr || error.message).trim()));
    resolve(String(stdout || "").trim());
  }));
}
function title(value: string): string { return value.replace(/[-_]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\b\w/g, letter => letter.toUpperCase()); }
async function countTree(root: string): Promise<{fileCount: number; directoryCount: number}> {
  let fileCount = 0; let directoryCount = 0; const queue = [root];
  while (queue.length) { const current = queue.shift(); if (!current) continue; for (const entry of await readdir(current, {withFileTypes: true})) {
    if (entry.name === ".git") continue;
    if (entry.isDirectory()) { directoryCount += 1; queue.push(path.join(current, entry.name)); } else fileCount += 1;
  }}
  return {fileCount, directoryCount};
}
async function refreshRemoteBlenderScriptCatalog(): Promise<void> {
  if (!refreshPromise) refreshPromise = (async () => {
    await mkdir(catalogRoot, {recursive: true}); const suffix = `${Date.now().toString(36)}-${process.pid}`;
    const temporary = path.join(catalogRoot, `repository-${suffix}.tmp`); const backup = path.join(catalogRoot, `repository-${suffix}.bak`);
    try { await git(["clone", "--depth", "1", repositoryUrl, temporary]); if (existsSync(checkoutPath)) await rename(checkoutPath, backup); await rename(temporary, checkoutPath); await rm(downloadsPath, {recursive: true, force: true}).catch(() => {}); }
    catch (error) { if (!existsSync(checkoutPath) && existsSync(backup)) await rename(backup, checkoutPath).catch(() => {}); throw error; }
    finally { await rm(temporary, {recursive: true, force: true}).catch(() => {}); await rm(backup, {recursive: true, force: true}).catch(() => {}); }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
async function getRemoteBlenderScriptCatalog(refresh = false): Promise<ScriptCatalog> {
  if (refresh || !existsSync(path.join(checkoutPath, ".git"))) await refreshRemoteBlenderScriptCatalog();
  const revision = await git(["rev-parse", "HEAD"], checkoutPath); const checkout = await stat(checkoutPath);
  const entries: ScriptEntry[] = [];
  for (const child of (await readdir(checkoutPath, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
    if (child.name.startsWith(".")) continue;
    const relativePath = child.name;
    if (child.isDirectory()) {
      const counts = await countTree(path.join(checkoutPath, child.name));
      entries.push({id: Buffer.from(relativePath).toString("base64url"), title: title(child.name), relativePath, githubUrl: `${repositoryUrl}/tree/main/${encodeURIComponent(relativePath)}`, icon: "code-slash", ...counts});
      continue;
    }
    if (!child.isFile() || path.extname(child.name).toLowerCase() !== ".py") continue;
    entries.push({
      id: Buffer.from(relativePath).toString("base64url"),
      title: title(path.basename(child.name, ".py")),
      relativePath,
      githubUrl: `${repositoryUrl}/blob/main/${encodeURIComponent(relativePath)}`,
      icon: "code-slash",
      fileCount: 1,
      directoryCount: 0
    });
  }
  return {repositoryUrl, revision, cachedAt: checkout.mtime.toISOString(), entries};
}
async function prepareRemoteBlenderScriptPackage(id: string): Promise<{fileName: string; filePath: string; size: number}> {
  const catalog = await getRemoteBlenderScriptCatalog(); const entry = catalog.entries.find(item => item.id === id);
  if (!entry) throw new Error("The selected Blender script package was not found in the cached catalog.");
  const folder = path.join(downloadsPath, catalog.revision); await mkdir(folder, {recursive: true}); const fileName = `blender-${entry.title.replace(/[^A-Za-z0-9._-]+/g, "-")}.zip`; const filePath = path.join(folder, fileName);
  if (!existsSync(filePath)) await git(["archive", "--format=zip", `--output=${filePath}`, "HEAD", entry.relativePath], checkoutPath);
  return {fileName, filePath, size: (await stat(filePath)).size};
}
export {getRemoteBlenderScriptCatalog, prepareRemoteBlenderScriptPackage};
