import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dataRoot } from "@urage/server/config/repositoryPaths";

export type GameEngineProject = {
  id: string;
  title: string;
  engine: "unity";
  executablePath: string;
  projectPath: string;
  version: string;
  source: "configured" | "manual" | "scan" | "unity-hub";
  lastModified: number | null;
  available: boolean;
};

type GameEngineProjectCache = {
  version: 1;
  updatedAt: string;
  projects: GameEngineProject[];
};

const cachePath = path.join(dataRoot, "game-engine-projects.json");
const ignoredScanDirectories = new Set([".git", ".svn", "Library", "Logs", "node_modules", "obj", "Temp", "UserSettings"]);

function resolveUnityHubProjectsPath(): string {
  const configuredPath = (process.env.UNITY_HUB_PROJECTS_PATH || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }
  return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "UnityHub", "projects-v1.json");
}

function describeCurrentWindowsUser(): string {
  const domain = (process.env.USERDOMAIN || "").trim();
  const user = (process.env.USERNAME || "").trim() || os.userInfo().username;
  return domain ? `${domain}\\${user}` : user;
}

// Pre-configured Unity projects (can be overridden via environment variables).
// Format: JSON array of GameEngineProject objects, one per line after the CONFIGURED_PROJECTS_ prefix.
function parseConfiguredProjects(): GameEngineProject[] {
  const envValue = process.env.CONFIGURED_UNITY_PROJECTS;
  if (!envValue) return [];
  try {
    const parsed = JSON.parse(envValue);
    if (Array.isArray(parsed)) return parsed.filter(p => p && typeof p.projectPath === "string");
  } catch {
    console.warn("Invalid CONFIGURED_UNITY_PROJECTS JSON, ignoring.");
  }
  return [];
}

// Default configured projects — fallback when no env override is set.
const defaultConfiguredProjects: GameEngineProject[] = [{
  id: "unity-aithingy",
  title: "AIThingy",
  engine: "unity" as const,
  executablePath: "C:\\Program Files\\Unity\\Hub\\Editor\\6000.3.15f1\\Editor\\Unity.exe",
  projectPath: "C:\\Files\\git\\AIThingy",
  version: "6000.3.15f1",
  source: "configured" as const,
  lastModified: null,
  available: true
}];

// Merge env override with defaults; env takes priority.
const configuredProjects: GameEngineProject[] = (() => {
  const fromEnv = parseConfiguredProjects();
  return fromEnv.length > 0 ? fromEnv : defaultConfiguredProjects;
})();

function normalizeProjectPath(value: string): string {
  return path.resolve(value).replace(/[\\/]+$/, "");
}

// Create a stable project ID that preserves case to avoid collisions on case-insensitive filesystems.
function createProjectId(projectPath: string): string {
  const normalized = normalizeProjectPath(projectPath);
  // Include both the resolved path hash and an uppercase variant so IDs are unique even when paths differ only in case.
  const hashInput = normalized + "|" + normalized.toUpperCase();
  return "unity-" + Buffer.from(hashInput).toString("base64url").slice(0, 48);
}

function resolveUnityExecutable(version: string): string {
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  return version ? path.join(programFiles, "Unity", "Hub", "Editor", version, "Editor", "Unity.exe") : "";
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isFile();
  } catch {
    return false;
  }
}

async function isUnityProject(projectPath: string): Promise<boolean> {
  return await isDirectory(path.join(projectPath, "Assets")) && await isDirectory(path.join(projectPath, "ProjectSettings"));
}

async function readUnityProjectVersion(projectPath: string): Promise<string> {
  try {
    const content = await readFile(path.join(projectPath, "ProjectSettings", "ProjectVersion.txt"), "utf8");
    const line = content.split(/\r?\n/).find(entry => entry.startsWith("m_EditorVersion:"));
    return line ? line.slice("m_EditorVersion:".length).trim() : "";
  } catch {
    return "";
  }
}

async function normalizeProject(project: GameEngineProject): Promise<GameEngineProject> {
  const projectPath = path.resolve(project.projectPath);
  const version = project.version || await readUnityProjectVersion(projectPath);
  const executablePath = project.executablePath || resolveUnityExecutable(version);
  return {
    ...project,
    id: project.id || createProjectId(projectPath),
    title: project.title || path.basename(projectPath),
    executablePath,
    projectPath,
    version,
    available: await isUnityProject(projectPath) && await isFile(executablePath)
  };
}

async function readCache(): Promise<GameEngineProjectCache> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8")) as Partial<GameEngineProjectCache>;
    return { version: 1, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "", projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch {
    return { version: 1, updatedAt: "", projects: [] };
  }
}

async function writeCache(projects: GameEngineProject[]): Promise<GameEngineProjectCache> {
  const cache = { version: 1 as const, updatedAt: new Date().toISOString(), projects };
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");
  return cache;
}

// Chain writes through a promise queue to prevent race conditions on concurrent cache access.
let previousCacheWrite: Promise<GameEngineProjectCache | undefined> = Promise.resolve(undefined);

async function mergeProjects(incoming: GameEngineProject[]): Promise<GameEngineProjectCache> {
  // Chain writes through a promise queue to prevent race conditions.
  const writePromise = previousCacheWrite.then(async (): Promise<GameEngineProjectCache> => {
    const cache = await readCache();
    const byPath = new Map<string, GameEngineProject>();
    for (const project of [...configuredProjects, ...cache.projects, ...incoming]) {
      if (!project?.projectPath) continue;
      byPath.set(normalizeProjectPath(project.projectPath), await normalizeProject(project));
    }
    const projects = [...byPath.values()].sort((a, b) => a.title.localeCompare(b.title));
    return await writeCache(projects);
  });

  previousCacheWrite = writePromise.catch(() => undefined);
  return writePromise;
}

async function readUnityHubProjects(): Promise<GameEngineProject[]> {
  const unityHubProjectsPath = resolveUnityHubProjectsPath();
  let content = "";
  try {
    content = await readFile(unityHubProjectsPath, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      throw new Error(
        `Unity Hub project catalog was not found for Windows user "${describeCurrentWindowsUser()}" at "${unityHubProjectsPath}". ` +
        `Run the dashboard as the same standard desktop user that uses Unity Hub, open Unity Hub once for that profile, or set UNITY_HUB_PROJECTS_PATH to the correct projects-v1.json location.`
      );
    }
    throw error;
  }
  let parsed: { data?: Record<string, Record<string, unknown>> };
  try {
    parsed = JSON.parse(content) as { data?: Record<string, Record<string, unknown>> };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Unity Hub project catalog at "${unityHubProjectsPath}" could not be parsed. ${message}`);
  }
  const rows = parsed.data && typeof parsed.data === "object" ? Object.entries(parsed.data) : [];
  return rows.map(([projectKey, value]) => {
    const projectPath = typeof value.path === "string" ? value.path : projectKey;
    const version = typeof value.version === "string" ? value.version : "";
    return {
      id: createProjectId(projectPath),
      title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : path.basename(projectPath),
      engine: "unity",
      executablePath: resolveUnityExecutable(version),
      projectPath,
      version,
      source: "unity-hub",
      lastModified: typeof value.lastModified === "number" ? value.lastModified : null,
      available: false
    };
  });
}

export async function listGameEngineProjects(options?: { refreshUnityHub?: boolean; }): Promise<GameEngineProjectCache> {
  const cache = await readCache();
  if (options?.refreshUnityHub === true || cache.projects.length === 0) {
    try {
      return await mergeProjects(await readUnityHubProjects());
    } catch {
      return await mergeProjects([]);
    }
  }
  return await mergeProjects([]);
}

export async function fetchUnityHubProjects(): Promise<GameEngineProjectCache> {
  return await mergeProjects(await readUnityHubProjects());
}

export async function addGameEngineProject(projectPath: string, source: "manual" | "scan"): Promise<GameEngineProjectCache> {
  const resolvedPath = path.resolve(projectPath);
  if (!path.isAbsolute(projectPath)) throw new Error("Project path must be absolute.");
  if (!await isUnityProject(resolvedPath)) throw new Error("The selected directory is not a valid Unity project.");
  const version = await readUnityProjectVersion(resolvedPath);
  return await mergeProjects([{
    id: createProjectId(resolvedPath),
    title: path.basename(resolvedPath),
    engine: "unity",
    executablePath: resolveUnityExecutable(version),
    projectPath: resolvedPath,
    version,
    source,
    lastModified: Date.now(),
    available: false
  }]);
}

async function collectUnityProjects(rootPath: string, recursive: boolean): Promise<string[]> {
  const root = path.resolve(rootPath);
  if (!path.isAbsolute(rootPath) || !await isDirectory(root)) throw new Error("Scan folder does not exist.");
  const found: string[] = [];
  const queue: Array<{ directory: string; depth: number; }> = [{ directory: root, depth: 0 }];
  while (queue.length > 0 && found.length < 500) {
    const current = queue.shift();
    if (!current) break;
    if (await isUnityProject(current.directory)) {
      found.push(current.directory);
      continue;
    }
    if (!recursive || current.depth >= 12) continue;
    let entries;
    try {
      entries = await readdir(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !ignoredScanDirectories.has(entry.name)) {
        queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
      }
    }
  }
  return found;
}

export async function scanGameEngineProjects(rootPath: string, recursive: boolean): Promise<GameEngineProjectCache> {
  const projects = await collectUnityProjects(rootPath, recursive);
  // Use Promise.allSettled to ensure all projects are attempted even if some fail.
  const results = await Promise.allSettled(projects.map(p => addGameEngineProject(p, "scan")));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(`Scan completed with ${failures.length} failure(s):`, failures.map(r => (r.reason as Error)?.message));
  }
  return await listGameEngineProjects();
}

export async function browseForProjectFolder(): Promise<string> {
  if (process.platform !== "win32") throw new Error("The native folder browser is currently available on Windows only.");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select a Unity project folder'",
    "$dialog.ShowNewFolderButton = $false",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }"
  ].join("; ");
  return await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-Command", script], { windowsHide: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => stdout += String(chunk));
    child.stderr.on("data", chunk => stderr += String(chunk));
    child.once("error", reject);
    child.once("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "Folder browser failed."));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export async function launchGameEngineProject(projectId: string): Promise<{ projectId: string; launched: boolean; }> {
  const cache = await listGameEngineProjects();
  const project = cache.projects.find(entry => entry.id === projectId);
  if (!project) throw new Error("Project was not found in the cached catalog.");
  const normalized = await normalizeProject(project);
  if (!normalized.available) throw new Error("The Unity editor or project directory is unavailable.");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(normalized.executablePath, ["-projectPath", normalized.projectPath], {
      cwd: normalized.projectPath,
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
    child.once("error", reject);
  });
  return { projectId, launched: true };
}
