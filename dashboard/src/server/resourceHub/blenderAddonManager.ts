import { execFile } from "node:child_process";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { appConfig } from "../runtime/botBridge.js";

type BlenderInstall = {
  id: string;
  label: string;
  executablePath: string;
};

type BlenderAddonInfo = {
  module: string;
  name: string;
  version: string;
  category: string;
  enabled: boolean;
};

type BlenderAddonInstallResult = {
  moduleName: string;
  addonPath: string;
  blenderPath: string;
  enabled: boolean;
};

const externalBlenderAddonRoot = "C:\\Files\\github\\URage-suite\\URage Addons\\blender";
const addonDownloadDirectory = path.resolve(appConfig.dataDirectory, "dashboard-blender-addons", "downloads");
const pythonJsonStart = "__URAGE_JSON_START__";
const pythonJsonEnd = "__URAGE_JSON_END__";

function normalizePathInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGithubUrl(value: unknown): string {
  const normalized = normalizePathInput(value);
  if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?(?:\/)?$/i.test(normalized)) return "";
  return normalized.replace(/\/+$/, "");
}

function normalizeAddonModuleName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/[^A-Za-z0-9_.-]/g, "") : "";
}

function toBlenderInstallId(executablePath: string): string {
  return Buffer.from(executablePath, "utf8").toString("base64url");
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

async function collectBlenderExecutableCandidates(): Promise<string[]> {
  const candidates = [
    appConfig.blenderExecutablePath,
    process.env.BLENDER_EXECUTABLE_PATH || "",
    "blender"
  ];
  if (process.platform === "win32") {
    const programFiles = [process.env.ProgramFiles || "", process.env["ProgramFiles(x86)"] || ""].filter(Boolean);
    for (const root of programFiles) {
      const blenderFoundation = path.join(root, "Blender Foundation");
      try {
        for (const entry of await readdir(blenderFoundation, { withFileTypes: true })) {
          if (entry.isDirectory()) candidates.push(path.join(blenderFoundation, entry.name, "blender.exe"));
        }
      } catch {
        continue;
      }
    }
  }
  return uniqueValues(candidates);
}

async function resolveBlenderLabel(executablePath: string): Promise<string> {
  const version = await runProcess(executablePath, ["--version"], { timeoutMs: 8000 }).catch(() => null);
  const firstLine = version?.stdout.split(/\r?\n/).find(line => line.trim())?.trim() || "";
  return firstLine || path.basename(executablePath);
}

async function runProcess(command: string, args: string[], options: { cwd?: string; timeoutMs?: number; } = {}): Promise<{ stdout: string; stderr: string; }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs || 30000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message || "Process failed").trim()));
        return;
      }
      resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

function extractMarkedJson<T>(output: string): T {
  const startIndex = output.indexOf(pythonJsonStart);
  const endIndex = output.indexOf(pythonJsonEnd);
  if (startIndex < 0 || endIndex <= startIndex) throw new Error("Blender did not return a readable JSON payload.");
  const json = output.slice(startIndex + pythonJsonStart.length, endIndex).trim();
  return JSON.parse(json) as T;
}

async function runBlenderJson<T>(blenderPath: string, pythonSource: string): Promise<T> {
  const result = await runProcess(blenderPath, ["--background", "--python-expr", pythonSource], { timeoutMs: 45000 });
  return extractMarkedJson<T>(`${result.stdout}\n${result.stderr}`);
}

function assertExistingBlenderPath(blenderPath: string): void {
  if (!blenderPath) throw new Error("Blender executable path is required.");
  if (blenderPath !== "blender" && !existsSync(blenderPath)) throw new Error("Blender executable was not found.");
}

async function getBlenderUserAddonDirectory(blenderPath: string): Promise<string> {
  assertExistingBlenderPath(blenderPath);
  return runBlenderJson<string>(blenderPath, `
import bpy, json
print("${pythonJsonStart}" + json.dumps(bpy.utils.user_resource('SCRIPTS', path='addons', create=True)) + "${pythonJsonEnd}")
`);
}

async function resolveInstallableAddonSource(sourcePath: string): Promise<{ installPath: string; moduleName: string; isZip: boolean; }> {
  const source = path.resolve(sourcePath);
  if (!existsSync(source)) throw new Error("Addon source was not found.");
  const sourceStat = await stat(source);
  if (sourceStat.isFile()) {
    const extension = path.extname(source).toLowerCase();
    if (extension !== ".py" && extension !== ".zip") throw new Error("Addon source must be a .py file, .zip file, or folder.");
    return {
      installPath: source,
      moduleName: path.basename(source, extension),
      isZip: extension === ".zip"
    };
  }
  const directInit = path.join(source, "__init__.py");
  if (existsSync(directInit)) {
    return {
      installPath: source,
      moduleName: path.basename(source),
      isZip: false
    };
  }
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(source, entry.name);
    if (existsSync(path.join(child, "__init__.py"))) {
      return {
        installPath: child,
        moduleName: entry.name,
        isZip: false
      };
    }
  }
  throw new Error("No installable Blender addon module was found in that folder.");
}

async function copyAddonSource(sourcePath: string, targetDirectory: string, moduleName: string): Promise<string> {
  await mkdir(targetDirectory, { recursive: true });
  const sourceStat = await stat(sourcePath);
  const destination = sourceStat.isDirectory()
    ? path.join(targetDirectory, moduleName)
    : path.join(targetDirectory, path.basename(sourcePath));
  await rm(destination, { recursive: true, force: true });
  await cp(sourcePath, destination, { recursive: true, force: true });
  return destination;
}

async function installZipAddon(blenderPath: string, zipPath: string): Promise<void> {
  await runBlenderJson<boolean>(blenderPath, `
import bpy, json
bpy.ops.preferences.addon_install(filepath=${JSON.stringify(zipPath)}, overwrite=True)
bpy.ops.wm.save_userpref()
print("${pythonJsonStart}" + json.dumps(True) + "${pythonJsonEnd}")
`);
}

async function setBlenderAddonEnabled(blenderPath: string, moduleName: string, enabled: boolean): Promise<BlenderAddonInfo> {
  assertExistingBlenderPath(blenderPath);
  const safeModuleName = normalizeAddonModuleName(moduleName);
  if (!safeModuleName) throw new Error("Addon module name is required.");
  return runBlenderJson<BlenderAddonInfo>(blenderPath, `
import addon_utils, bpy, json
module_name = ${JSON.stringify(safeModuleName)}
if ${enabled ? "True" : "False"}:
    addon_utils.enable(module_name, default_set=True, persistent=True)
else:
    addon_utils.disable(module_name, default_set=True)
bpy.ops.wm.save_userpref()
module = next((candidate for candidate in addon_utils.modules(refresh=True) if candidate.__name__ == module_name), None)
info = addon_utils.module_bl_info(module) if module else {}
is_enabled = addon_utils.check(module_name)[0]
payload = {"module": module_name, "name": info.get("name") or module_name, "version": ".".join(str(part) for part in info.get("version", ())) if info.get("version") else "", "category": info.get("category") or "", "enabled": bool(is_enabled)}
print("${pythonJsonStart}" + json.dumps(payload) + "${pythonJsonEnd}")
`);
}

async function cloneGithubRepository(repositoryUrl: string): Promise<string> {
  const normalizedUrl = normalizeGithubUrl(repositoryUrl);
  if (!normalizedUrl) throw new Error("A valid GitHub repository URL is required.");
  await mkdir(addonDownloadDirectory, { recursive: true });
  const repoName = normalizedUrl.split("/").pop()?.replace(/\.git$/i, "") || "addon";
  const destination = path.join(addonDownloadDirectory, `${repoName}-${Date.now().toString(36)}`);
  await runProcess("git", ["clone", "--depth", "1", normalizedUrl, destination], { timeoutMs: 120000 });
  return destination;
}

async function listBlenderInstalls(): Promise<BlenderInstall[]> {
  const candidates = await collectBlenderExecutableCandidates();
  const installs: BlenderInstall[] = [];
  for (const executablePath of candidates) {
    if (executablePath !== "blender" && !existsSync(executablePath)) continue;
    const label = await resolveBlenderLabel(executablePath).catch(() => path.basename(executablePath));
    installs.push({
      id: toBlenderInstallId(executablePath),
      label,
      executablePath
    });
  }
  return installs;
}

async function listInstalledBlenderAddons(blenderPath: string): Promise<BlenderAddonInfo[]> {
  assertExistingBlenderPath(blenderPath);
  return runBlenderJson<BlenderAddonInfo[]>(blenderPath, `
import addon_utils, json
rows = []
for module in addon_utils.modules(refresh=True):
    info = addon_utils.module_bl_info(module) or {}
    version = info.get("version", ())
    rows.append({
        "module": module.__name__,
        "name": info.get("name") or module.__name__,
        "version": ".".join(str(part) for part in version) if version else "",
        "category": info.get("category") or "",
        "enabled": bool(addon_utils.check(module.__name__)[0])
    })
rows.sort(key=lambda item: (not item["enabled"], item["name"].lower()))
print("${pythonJsonStart}" + json.dumps(rows) + "${pythonJsonEnd}")
`);
}

async function installLocalBlenderAddon(blenderPath: string, sourcePath: string, enable = true): Promise<BlenderAddonInstallResult> {
  assertExistingBlenderPath(blenderPath);
  const source = await resolveInstallableAddonSource(sourcePath);
  if (source.isZip) {
    await installZipAddon(blenderPath, source.installPath);
  } else {
    const addonsDirectory = await getBlenderUserAddonDirectory(blenderPath);
    await copyAddonSource(source.installPath, addonsDirectory, source.moduleName);
  }
  if (enable) await setBlenderAddonEnabled(blenderPath, source.moduleName, true);
  return {
    moduleName: source.moduleName,
    addonPath: source.installPath,
    blenderPath,
    enabled: enable
  };
}

async function downloadAndInstallBlenderAddon(blenderPath: string, repositoryUrl: string, enable = true): Promise<BlenderAddonInstallResult> {
  const clonedPath = await cloneGithubRepository(repositoryUrl);
  return installLocalBlenderAddon(blenderPath, clonedPath, enable);
}

function getExternalBlenderAddonRoot(): string {
  return externalBlenderAddonRoot;
}

export {
  downloadAndInstallBlenderAddon,
  getExternalBlenderAddonRoot,
  installLocalBlenderAddon,
  listBlenderInstalls,
  listInstalledBlenderAddons,
  setBlenderAddonEnabled
};
export type { BlenderAddonInfo, BlenderAddonInstallResult, BlenderInstall };
