import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { dataRoot, repoRoot } from "@urage/server/config/repositoryPaths";

type RemoteAssetPlatform = "unity" | "godot" | "unreal";

type RemoteAssetCatalogEntry = {
  id: string;
  platform: RemoteAssetPlatform;
  title: string;
  relativePath: string;
  githubUrl: string;
  iconUrl: string;
  fileCount: number;
  directoryCount: number;
};

type RemoteAssetCatalog = {
  repositoryUrl: string;
  repositoryRef: string;
  revision: string;
  cachedAt: string;
  entries: RemoteAssetCatalogEntry[];
};

const repositoryUrl = "https://github.com/sysoutch/URage-Assets";
const repositoryRef = "sysoutch/URage-Assets";
const iconManifest = JSON.parse(readFileSync(
  path.join(repoRoot, "dashboard", "assets", "config", "remote-asset-icons.json"),
  "utf8"
)) as Record<string, string>;
const catalogRoot = path.join(dataRoot, "remote-asset-catalog", "urage-assets");
const checkoutPath = path.join(catalogRoot, "repository");
const downloadsPath = path.join(catalogRoot, "downloads");
const platformRoots: Record<RemoteAssetPlatform, string> = {
  unity: "Unity/Assets/URage",
  godot: "Godot",
  unreal: "Unreal"
};
let refreshPromise: Promise<void> | null = null;
const archivePromises = new Map<string, Promise<void>>();

function runGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, {
      cwd,
      env: {...process.env, GIT_TERMINAL_PROMPT: "0"},
      timeout: 180_000,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message || "Git operation failed.").trim()));
        return;
      }
      resolve(String(stdout || "").trim());
    });
  });
}

function toTitle(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function encodeEntryId(platform: RemoteAssetPlatform, relativePath: string): string {
  return Buffer.from(`${platform}:${relativePath}`, "utf8").toString("base64url");
}

function assertCachedPath(relativePath: string): string {
  const root = path.resolve(checkoutPath);
  const target = path.resolve(checkoutPath, relativePath);
  if (target === root || target.startsWith(`${root}${path.sep}`)) {
    return target;
  }
  throw new Error("Asset path escaped the managed GitHub cache.");
}

async function countTree(root: string): Promise<{ fileCount: number; directoryCount: number; }> {
  let fileCount = 0;
  let directoryCount = 0;
  const queue = [root];
  while (queue.length > 0) {
    const directory = queue.shift();
    if (!directory) continue;
    const entries = await readdir(directory, {withFileTypes: true});
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      if (entry.isDirectory()) {
        directoryCount += 1;
        queue.push(path.join(directory, entry.name));
      } else {
        fileCount += 1;
      }
    }
  }
  return {fileCount, directoryCount};
}

async function replaceCheckoutFromGithub(): Promise<void> {
  await mkdir(catalogRoot, {recursive: true});
  const suffix = `${Date.now().toString(36)}-${process.pid}`;
  const temporaryPath = path.join(catalogRoot, `repository-${suffix}.tmp`);
  const backupPath = path.join(catalogRoot, `repository-${suffix}.bak`);
  try {
    await runGit(["clone", "--depth", "1", repositoryUrl, temporaryPath]);
    if (existsSync(checkoutPath)) {
      await rename(checkoutPath, backupPath);
    }
    await rename(temporaryPath, checkoutPath);
    await rm(downloadsPath, {recursive: true, force: true}).catch(() => {});
    if (existsSync(backupPath)) {
      await rm(backupPath, {recursive: true, force: true});
    }
  } catch (error) {
    if (!existsSync(checkoutPath) && existsSync(backupPath)) {
      await rename(backupPath, checkoutPath).catch(() => {});
    }
    throw error;
  } finally {
    await rm(temporaryPath, {recursive: true, force: true}).catch(() => {});
    await rm(backupPath, {recursive: true, force: true}).catch(() => {});
  }
}

async function refreshRemoteAssetCatalog(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = replaceCheckoutFromGithub().finally(() => {
      refreshPromise = null;
    });
  }
  await refreshPromise;
}

async function ensureCheckout(refresh: boolean): Promise<void> {
  if (refresh || !existsSync(path.join(checkoutPath, ".git"))) {
    await refreshRemoteAssetCatalog();
  }
}

async function listPlatformEntries(platform: RemoteAssetPlatform): Promise<RemoteAssetCatalogEntry[]> {
  const relativeRoot = platformRoots[platform];
  const absoluteRoot = assertCachedPath(relativeRoot);
  if (!existsSync(absoluteRoot)) return [];
  const children = await readdir(absoluteRoot, {withFileTypes: true});
  const entries: RemoteAssetCatalogEntry[] = [];
  for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!child.isDirectory() || child.name.startsWith(".")) continue;
    const relativePath = path.posix.join(relativeRoot, child.name);
    const title = toTitle(child.name);
    const counts = await countTree(path.join(absoluteRoot, child.name));
    entries.push({
      id: encodeEntryId(platform, relativePath),
      platform,
      title,
      relativePath,
      githubUrl: `${repositoryUrl}/tree/main/${relativePath.split("/").map(encodeURIComponent).join("/")}`,
      iconUrl: `/assets/vendor/bootstrap-icons/icons/${iconManifest[title] || iconManifest.__fallback}.svg`,
      ...counts
    });
  }
  return entries;
}

async function getRemoteAssetCatalog(refresh = false): Promise<RemoteAssetCatalog> {
  await ensureCheckout(refresh);
  const revision = await runGit(["rev-parse", "HEAD"], checkoutPath);
  const checkout = await stat(checkoutPath);
  const entries = (
    await Promise.all((Object.keys(platformRoots) as RemoteAssetPlatform[]).map(listPlatformEntries))
  ).flat();
  return {
    repositoryUrl,
    repositoryRef,
    revision,
    cachedAt: checkout.mtime.toISOString(),
    entries
  };
}

async function prepareRemoteAssetPackage(id: string): Promise<{ fileName: string; filePath: string; size: number; }> {
  const catalog = await getRemoteAssetCatalog(false);
  const entry = catalog.entries.find(candidate => candidate.id === id);
  if (!entry) {
    throw new Error("The selected URage asset package was not found in the cached catalog.");
  }
  assertCachedPath(entry.relativePath);
  const revisionDownloadsPath = path.join(downloadsPath, catalog.revision);
  await mkdir(revisionDownloadsPath, {recursive: true});
  const safeName = entry.title.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "urage-asset";
  const fileName = `${entry.platform}-${safeName}.zip`;
  const archivePath = path.join(revisionDownloadsPath, fileName);
  if (!existsSync(archivePath)) {
    const archiveKey = `${catalog.revision}:${entry.id}`;
    let archivePromise = archivePromises.get(archiveKey);
    if (!archivePromise) {
      archivePromise = (async () => {
        const temporaryArchivePath = `${archivePath}.${process.pid}.tmp`;
        try {
          await runGit(["archive", "--format=zip", `--output=${temporaryArchivePath}`, "HEAD", entry.relativePath], checkoutPath);
          await rename(temporaryArchivePath, archivePath);
        } finally {
          await rm(temporaryArchivePath, {force: true}).catch(() => {});
        }
      })().finally(() => archivePromises.delete(archiveKey));
      archivePromises.set(archiveKey, archivePromise);
    }
    await archivePromise;
  }
  return {fileName, filePath: archivePath, size: (await stat(archivePath)).size};
}

export {
  getRemoteAssetCatalog,
  prepareRemoteAssetPackage,
  refreshRemoteAssetCatalog
};
export type {
  RemoteAssetCatalog,
  RemoteAssetCatalogEntry,
  RemoteAssetPlatform
};
