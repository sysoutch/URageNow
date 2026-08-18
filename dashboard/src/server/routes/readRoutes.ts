import type { IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { getDashboardClientScript } from "../../clientScript.js";
import { dashboardGifWorkerScript, renderDashboardHtml } from "../../page.js";
import { defaultDashboardTheme, normalizeDashboardThemeKey } from "../../shared/dashboardThemes.js";
import { listGameEngineExports, listenForGameEngineExportChanges, readGameEngineExportFile } from "../gameEngines/exportQueue.js";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { appConfig } from "../runtime/botBridge.js";
import { repoRoot, repositoryRootCandidates, resolveRepoPath } from "@urage/server/config/repositoryPaths";
import { getDashboardResourcePoolDetail, listDashboardResourcePools } from "@urage/server/services/resourcePools";
import { listGenerationJobs } from "@urage/server/services/generationJobStore";
import {
  readDashboardThemePreference,
  saveDashboardThemePreference
} from "@urage/server/services/dashboardThemePreference";
import { parseJsonBody, sendBinary, sendJson } from "../http.js";
import { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute } from "../router.js";
import { resolveMessengerRuntimeLaunch } from "@urage/server/runtime/messengerRuntimeLaunch";
import {
  androidCompanionGithubReleasesUrl,
  readLatestAndroidCompanionRelease,
  renderAndroidCompanionDownloadPage,
  selectAndroidCompanionArtifact
} from "../companion/androidReleaseDistribution.js";
import {
  getDashboardNetworkConfiguration,
  saveDashboardNetworkConfiguration
} from "../companion/dashboardNetworkConfiguration.js";
import {getComfyUiRuntimeStatus, saveComfyUiRuntimeConfiguration} from "../comfyUi/comfyUiRuntimeManager.js";
import { getPublishedMediaManifestPath } from "@urage/shared/automation/index";

const uploadedModelImagesDirectory = path.resolve(appConfig.dataDirectory, "uploaded-model-images");
const dashboardLogoRelativePaths = ["dashboard/logo.png"];
const dashboardThemeLogoRelativePaths: Record<string, string[]> = {
  fire: ["dashboard/logo.png"],
  blood: ["dashboard/logo_blood.png"],
  nature: ["dashboard/logo_grass.png"],
  water: ["dashboard/logo_water.png"],
  love: ["dashboard/logo_heart.png"],
  crystal: ["dashboard/logo_diamond.png"],
  purple: ["dashboard/logo_diamond.png"],
  rock: ["dashboard/logo_rock.png"],
  light: ["dashboard/logo_cloud.png"],
  smoke: ["dashboard/logo_smoke.png"]
};
type DashboardThemeTarget = "discord" | "telegram" | "matrix" | "whatsapp" | "studio";
type DashboardThemeInfo = {
  label?: string;
  imagePath?: string;
};
type DashboardThemePayload = {
  target: DashboardThemeTarget;
  resolvedTarget: DashboardThemeTarget;
  variables: Record<string, string>;
  themes: Record<string, DashboardThemeInfo>;
  source: string | null;
};
const dashboardThemeRelativePaths: Record<DashboardThemeTarget, string[]> = {
  discord: ["dashboard/assets/messengers/discord/theme.json"],
  telegram: ["dashboard/assets/messengers/telegram/theme.json"],
  matrix: ["dashboard/assets/messengers/matrix/theme.json"],
  whatsapp: ["dashboard/assets/messengers/whatsapp/theme.json"],
  studio: ["dashboard/dashboard-theme-studio.json"]
};
let latestComfyInstallerLogPath = "";
type DashboardInstallerId = "python" | "ollama" | "lmstudio" | "comfyui" | "blender" | "ffmpeg";
type DashboardInstallerExecutionMode = "standard" | "administrator" | "other-user";
type DashboardInstallerSpec = {
  id: DashboardInstallerId;
  label: string;
  command: string;
  args: string[];
  cwd?: string;
  logPath?: string;
  windowsHide?: boolean;
  windowsVerbatimArguments?: boolean;
  launchesInteractively?: boolean;
  comfyUiInstallRoot?: string;
};

function isDashboardResourcePoolKind(value: string | null | undefined): value is "image" | "model3d" | "video" | "audio" | "music" {
  return value === "image" || value === "model3d" || value === "video" || value === "audio" || value === "music";
}

function isSafeInstallerPath(value: string): boolean {
  return path.isAbsolute(value) && !/["&|<>^%!]/.test(value);
}

function normalizeThemeVariables(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const variables: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const variableName = String(key || "").trim();
    if (!variableName.startsWith("--")) {
      continue;
    }
    if (typeof rawValue !== "string") {
      continue;
    }
    const variableValue = rawValue.trim();
    if (!variableValue) {
      continue;
    }
    variables[variableName] = variableValue;
  }
  return variables;
}

function normalizeThemeInfo(value: unknown): Record<string, DashboardThemeInfo> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const themes: Record<string, DashboardThemeInfo> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = String(rawKey || "").trim().toLowerCase();
    if (!key || !rawValue || typeof rawValue !== "object") {
      continue;
    }
    const input = rawValue as Record<string, unknown>;
    const label = typeof input.label === "string" ? input.label.trim() : "";
    const imagePath = typeof input.imagePath === "string" ? input.imagePath.trim() : "";
    themes[key] = {
      ...(label ? { label } : {}),
      ...(imagePath ? { imagePath } : {})
    };
  }
  return themes;
}

function normalizeDashboardThemeName(value: string | null | undefined): string {
  return normalizeDashboardThemeKey(value) || defaultDashboardTheme;
}

async function tryLoadThemeForTarget(target: DashboardThemeTarget): Promise<{ variables: Record<string, string>; themes: Record<string, DashboardThemeInfo>; source: string; } | null> {
  const relativePaths = dashboardThemeRelativePaths[target] || [];
  for (const workspaceRoot of repositoryRootCandidates) {
    for (const relativePath of relativePaths) {
      const absolutePath = path.resolve(workspaceRoot, relativePath);
      try {
        const raw = await readFile(absolutePath, "utf8");
        const parsed = JSON.parse(raw) as { variables?: unknown; themes?: unknown; };
        return {
          variables: normalizeThemeVariables(parsed?.variables),
          themes: normalizeThemeInfo(parsed?.themes),
          source: absolutePath
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function resolveThemePayload(target: DashboardThemeTarget): Promise<DashboardThemePayload> {
  const current = await tryLoadThemeForTarget(target);
  if (current) {
    return {
      target,
      resolvedTarget: target,
      variables: current.variables,
      themes: current.themes,
      source: current.source
    };
  }
  const fallback = target === "discord" ? null : await tryLoadThemeForTarget("discord");
  if (fallback) {
    return {
      target,
      resolvedTarget: "discord",
      variables: fallback.variables,
      themes: fallback.themes,
      source: fallback.source
    };
  }
  return {
    target,
    resolvedTarget: target,
    variables: {},
    themes: {},
    source: null
  };
}

async function canAccessPath(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function handleGetAndroidCompanionPage(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const release = await readLatestAndroidCompanionRelease();
  if (!release) {
    response.writeHead(302, {location: androidCompanionGithubReleasesUrl, "cache-control": "no-store"});
    response.end();
    return;
  }
  const html = renderAndroidCompanionDownloadPage(release);
  response.writeHead(200, {"content-type": "text/html; charset=utf-8", "content-length": String(Buffer.byteLength(html))});
  response.end(html);
}

async function handleGetAndroidCompanionQr(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const downloadUrl = `${appConfig.dashboardPublicBaseUrl.replace(/\/+$/, "")}/android-companion`;
  const svg = await QRCode.toString(downloadUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: {dark: "#160b20", light: "#ffffff"}
  });
  response.writeHead(200, {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "no-store",
    "content-length": String(Buffer.byteLength(svg))
  });
  response.end(svg);
}

function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = String(request.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1" || address === "localhost";
}

async function handleGetDashboardNetworkConfiguration(request: IncomingMessage, response: ServerResponse, _url: URL, dependencies: DashboardDependencies): Promise<void> {
  if (!isLoopbackRequest(request)) {
    sendJson(response, 403, {error: "Network configuration may only be viewed from the dashboard host."});
    return;
  }
  sendJson(response, 200, getDashboardNetworkConfiguration(dependencies.port, dependencies.host));
}

async function handlePostDashboardNetworkConfiguration(request: IncomingMessage, response: ServerResponse, _url: URL, dependencies: DashboardDependencies): Promise<void> {
  if (!isLoopbackRequest(request)) {
    sendJson(response, 403, {error: "Network configuration may only be changed from the dashboard host."});
    return;
  }
  try {
    const result = await saveDashboardNetworkConfiguration(await parseJsonBody(request), dependencies.port);
    sendJson(response, 200, {
      saved: true,
      applyingLive: typeof dependencies.applyDashboardNetworkConfig === "function",
      generatedAccessToken: result.generatedAccessToken,
      publicBaseUrl: result.runtimeConfig.publicBaseUrl
    });
    if (dependencies.applyDashboardNetworkConfig) {
      setTimeout(() => {
        void Promise.resolve(dependencies.applyDashboardNetworkConfig?.(result.runtimeConfig));
      }, 120);
    }
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not save network configuration."});
  }
}

async function handlePostDashboardAccessToken(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!isLoopbackRequest(request)) {
    sendJson(response, 403, {error: "The dashboard access token may only be copied from the dashboard host."});
    return;
  }
  const accessToken = appConfig.dashboardAccessToken.trim();
  if (!accessToken) {
    sendJson(response, 404, {error: "No dashboard access token is configured. Generate one in Network Settings first."});
    return;
  }
  sendJson(response, 200, {accessToken});
}

async function handlePostDashboardAccessTokenQr(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!isLoopbackRequest(request)) {
    sendJson(response, 403, {error: "The dashboard access-token QR may only be generated on the dashboard host."});
    return;
  }
  const body = await parseJsonBody(request);
  const accessToken = (typeof body.accessToken === "string" ? body.accessToken : appConfig.dashboardAccessToken).trim();
  if (!accessToken) {
    sendJson(response, 404, {error: "No dashboard access token is configured. Generate one in Network Settings first."});
    return;
  }
  const svg = await QRCode.toString(accessToken, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: {dark: "#160b20", light: "#ffffff"}
  });
  response.writeHead(200, {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    "content-length": String(Buffer.byteLength(svg))
  });
  response.end(svg);
}

async function handleGetAndroidCompanionRelease(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const release = await readLatestAndroidCompanionRelease();
  if (!release) {
    sendJson(response, 404, {error: "No signed Android companion release is available."});
    return;
  }
  sendJson(response, 200, {
    versionName: release.versionName,
    versionCode: release.versionCode,
    fileName: release.fileName,
    size: release.size,
    sha256: release.sha256,
    builtAt: release.builtAt,
    downloadUrl: "/downloads/android-companion",
    artifacts: release.artifacts.map(artifact => ({
      type: artifact.type,
      abi: artifact.abi,
      fileName: artifact.fileName,
      size: artifact.size,
      sha256: artifact.sha256,
      downloadUrl: `/downloads/android-companion?abi=${artifact.type === "aab" ? "bundle" : encodeURIComponent(artifact.abi)}`
    }))
  });
}

async function handleGetAndroidCompanionDownload(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const release = await readLatestAndroidCompanionRelease();
  if (!release) {
    sendJson(response, 404, {error: "No signed Android companion release is available."});
    return;
  }
  const artifact = url.searchParams.get("abi") === "bundle"
    ? release.artifacts.find(candidate => candidate.type === "aab") || selectAndroidCompanionArtifact(release, "universal")
    : selectAndroidCompanionArtifact(release, url.searchParams.get("abi") || "universal");
  const payload = await readFile(artifact.filePath);
  response.writeHead(200, {
    "content-type": artifact.type === "aab" ? "application/octet-stream" : "application/vnd.android.package-archive",
    "content-length": String(payload.length),
    "content-disposition": `attachment; filename="${artifact.fileName}"`,
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=300"
  });
  response.end(payload);
}

async function resolveComfyInstallerScriptPath(): Promise<string | null> {
  for (const workspaceRoot of repositoryRootCandidates) {
    const candidate = path.resolve(
      workspaceRoot,
      "installers",
      "comfyui",
      "Install_ComfyUI_Hunyuan3D-2_Hunyuan3D-Wrapper.bat"
    );
    if (await canAccessPath(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function stageComfyInstallerScript(sourcePath: string, installRoot: string): Promise<string> {
  await mkdir(installRoot, {recursive: true});
  const stagedPath = path.join(installRoot, path.basename(sourcePath));
  await copyFile(sourcePath, stagedPath);
  return stagedPath;
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function createInteractiveWindowsInstallerSpec(id: DashboardInstallerId, label: string, command: string, args: string[], executionMode: DashboardInstallerExecutionMode, runAsUser: string): DashboardInstallerSpec {
  const commandLine = [command, ...args].map(value => /\s/.test(value) ? `"${value}"` : value).join(" ");
  if (executionMode === "administrator") {
    return {
      id, label, command: "powershell.exe",
      args: ["-NoProfile", "-Command", `Start-Process -FilePath ${quotePowerShellLiteral(command)} -ArgumentList @(${args.map(quotePowerShellLiteral).join(", ")}) -Verb RunAs`],
      windowsHide: false, launchesInteractively: true
    };
  }
  return {
    id, label, command: "powershell.exe",
    args: ["-NoProfile", "-Command", `Start-Process -FilePath 'runas.exe' -ArgumentList @(${quotePowerShellLiteral(`/user:${runAsUser}`)}, ${quotePowerShellLiteral(`cmd.exe /d /s /k ${commandLine}`)})`],
    windowsHide: false, launchesInteractively: true
  };
}

async function resolveInstallerSpec(installerId: DashboardInstallerId, installPath = "", executionMode: DashboardInstallerExecutionMode = "standard", runAsUser = ""): Promise<DashboardInstallerSpec | null> {
  const locationArgs = installPath ? ["--location", installPath] : [];
  if (installerId === "python") {
    const args = ["install", "--id", "Python.Python.3.12", "-e", "--accept-package-agreements", "--accept-source-agreements", ...locationArgs];
    if (executionMode !== "standard") {
      return createInteractiveWindowsInstallerSpec("python", "Python 3.12", "winget", args, executionMode, runAsUser);
    }
    return {
      id: "python",
      label: "Python 3.12",
      command: "winget",
      args
    };
  }
  if (installerId === "ollama") {
    return {
      id: "ollama",
      label: "Ollama",
      command: "winget",
      args: ["install", "--id", "Ollama.Ollama", "-e", "--accept-package-agreements", "--accept-source-agreements", ...locationArgs]
    };
  }
  if (installerId === "lmstudio") {
    return {
      id: "lmstudio",
      label: "LM Studio",
      command: "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        `winget install --id LMStudio.LMStudio -e --accept-package-agreements --accept-source-agreements ${installPath ? `--location "${installPath}"` : ""} || winget install --id ElementLabs.LMStudio -e --accept-package-agreements --accept-source-agreements ${installPath ? `--location "${installPath}"` : ""}`
      ]
    };
  }
  if (installerId === "blender") {
    return {
      id: "blender",
      label: "Blender",
      command: "winget",
      args: ["install", "--id", "BlenderFoundation.Blender", "-e", "--accept-package-agreements", "--accept-source-agreements", ...locationArgs]
    };
  }
  if (installerId === "ffmpeg") {
    const scriptPath = resolveRepoPath("scripts", "_install", "install-ffmpeg.ps1");
    return {
      id: "ffmpeg",
      label: "FFmpeg",
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...(installPath ? ["-InstallDirectory", installPath] : [])]
    };
  }
  if (installerId === "comfyui") {
    const scriptPath = await resolveComfyInstallerScriptPath();
    if (!scriptPath) {
      return null;
    }
    const configuredRuntime = await getComfyUiRuntimeStatus();
    const configuredRoot = configuredRuntime.workingDirectory && await canAccessPath(configuredRuntime.workingDirectory)
      ? configuredRuntime.workingDirectory
      : "";
    const comfyUiInstallRoot = installPath || configuredRoot || resolveRepoPath("data", "comfyui");
    const stagedScriptPath = await stageComfyInstallerScript(scriptPath, comfyUiInstallRoot);
    const commandTail = `call "${stagedScriptPath}" "${comfyUiInstallRoot}"`;
    const logPath = path.join(comfyUiInstallRoot, "install-comfyui.log");
    const interactiveCommand = `& cmd.exe /d /s /c ${quotePowerShellLiteral(commandTail)} 2>&1 | Tee-Object -FilePath ${quotePowerShellLiteral(logPath)} -Append`;
    if (executionMode === "administrator") {
      return {
        id: "comfyui", label: "ComfyUI", command: "powershell.exe",
        args: ["-NoProfile", "-Command", `Start-Process -FilePath 'powershell.exe' -WorkingDirectory ${quotePowerShellLiteral(comfyUiInstallRoot)} -ArgumentList @('-NoExit', '-NoProfile', '-Command', ${quotePowerShellLiteral(interactiveCommand)}) -Verb RunAs`],
        logPath, windowsHide: false, launchesInteractively: true, comfyUiInstallRoot
      };
    }
    if (executionMode === "other-user") {
      return {
        id: "comfyui", label: "ComfyUI", command: "powershell.exe",
        args: ["-NoProfile", "-Command", `Start-Process -FilePath 'runas.exe' -ArgumentList @(${quotePowerShellLiteral(`/user:${runAsUser}`)}, ${quotePowerShellLiteral(`powershell.exe -NoExit -NoProfile -Command ${interactiveCommand}`)})`],
        logPath, windowsHide: false, launchesInteractively: true, comfyUiInstallRoot
      };
    }
    return {
      id: "comfyui",
      label: "ComfyUI",
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `call "${stagedScriptPath}" "${comfyUiInstallRoot}"`],
      cwd: comfyUiInstallRoot,
      logPath,
      windowsHide: false,
      // cmd.exe parses its command tail itself. Let it receive the nested path
      // quotes unchanged instead of Node escaping them for a normal executable.
      windowsVerbatimArguments: process.platform === "win32",
      comfyUiInstallRoot
    };
  }
  return null;
}

async function runInstaller(spec: DashboardInstallerSpec): Promise<{
  ok: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}> {
  return await new Promise(resolve => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd || repoRoot,
      env: process.env,
      windowsHide: spec.windowsHide ?? true,
      windowsVerbatimArguments: spec.windowsVerbatimArguments
    });
    const log = spec.logPath ? createWriteStream(spec.logPath, {flags: "a"}) : null;
    if (log) {
      log.write(`\n\n=== ${spec.label} installer started ${new Date().toISOString()} ===\n`);
    }
    let stdout = "";
    let stderr = "";
    const maxOutputLength = 12_000;
    const appendOutput = (current: string, chunk: unknown): string => {
      const next = current + String(chunk ?? "");
      return next.length <= maxOutputLength ? next : next.slice(next.length - maxOutputLength);
    };
    child.stdout?.on("data", chunk => {
      stdout = appendOutput(stdout, chunk);
      log?.write(chunk);
    });
    child.stderr?.on("data", chunk => {
      stderr = appendOutput(stderr, chunk);
      log?.write(chunk);
    });
    child.once("error", error => {
      log?.write(`\n[launcher error] ${error instanceof Error ? error.message : String(error)}\n`);
      log?.end();
      resolve({
        ok: false,
        exitCode: null,
        signal: null,
        stdout,
        stderr: appendOutput(stderr, error instanceof Error ? error.message : String(error))
      });
    });
    child.once("close", (exitCode, signal) => {
      log?.write(`\n=== ${spec.label} installer finished (exit ${exitCode ?? "unknown"}) ===\n`);
      log?.end();
      resolve({
        ok: exitCode === 0,
        exitCode: typeof exitCode === "number" ? exitCode : null,
        signal,
        stdout,
        stderr
      });
    });
  });
}

function sanitizeUploadedModelImageFileName(input: string): string {
  const base = path.basename((input || "").trim());
  const cleaned = base
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 100);
  return cleaned || "";
}

function imageExtensionToContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  return "application/octet-stream";
}

async function handleGetVendorGifWorkerJs(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  if (!dashboardGifWorkerScript) {
    sendJson(response, 404, { error: "GIF worker script not found." });
    return;
  }
  response.writeHead(200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(dashboardGifWorkerScript);
  return;
}

async function handleGetRoot(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(renderDashboardHtml(dependencies.port, getDashboardClientScript()));
  return;
}

async function handleGetDashboardLogo(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  for (const workspaceRoot of repositoryRootCandidates) {
    for (const relativePath of dashboardLogoRelativePaths) {
      const absolutePath = path.resolve(workspaceRoot, relativePath);
      try {
        const data = await readFile(absolutePath);
        sendBinary(response, 200, "image/png", data);
        return;
      } catch {
        continue;
      }
    }
  }
  sendJson(response, 404, { error: "Dashboard logo not found." });
  return;
}

async function handleGetDashboardThemeLogo(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const theme = normalizeDashboardThemeName(url.searchParams.get("theme"));
  const relativePaths = dashboardThemeLogoRelativePaths[theme] || dashboardThemeLogoRelativePaths.fire || dashboardLogoRelativePaths;
  for (const workspaceRoot of repositoryRootCandidates) {
    for (const relativePath of relativePaths) {
      const absolutePath = path.resolve(workspaceRoot, relativePath);
      try {
        const data = await readFile(absolutePath);
        sendBinary(response, 200, "image/png", data);
        return;
      } catch {
        continue;
      }
    }
  }
  await handleGetDashboardLogo(request, response, url, dependencies);
}

async function handleGetApiState(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, dependencies.runtimeState.snapshot(dependencies.getBotSnapshot()));
  return;
}

async function handleGetApiConsoleHistory(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, dependencies.runtimeState.getConsoleSnapshot());
  return;
}

async function handleGetApiMessengerRuntimes(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, dependencies.getMessengerRuntimeSnapshot());
  return;
}

async function handleGetApiThemeConfig(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const requestedTarget = url.searchParams.get("target")?.trim();
  const requestedMessenger = url.searchParams.get("messenger")?.trim();
  const target: DashboardThemeTarget = requestedTarget === "studio" || requestedTarget === "telegram" || requestedTarget === "matrix" || requestedTarget === "whatsapp" || requestedTarget === "discord"
    ? requestedTarget
    : (requestedMessenger === "telegram" || requestedMessenger === "matrix" || requestedMessenger === "whatsapp" || requestedMessenger === "discord" ? requestedMessenger : "discord");
  sendJson(response, 200, await resolveThemePayload(target));
  return;
}

async function handleGetApiThemePreference(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, await readDashboardThemePreference());
}

async function handlePostApiThemePreference(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  sendJson(response, 200, await saveDashboardThemePreference(body.theme));
}

async function handlePostApiMessengerRuntimesControl(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const messenger = body.messenger === "telegram" || body.messenger === "matrix" || body.messenger === "whatsapp" || body.messenger === "discord"
    ? body.messenger
    : null;
  const action = body.action === "start" || body.action === "stop" || body.action === "restart"
    ? body.action
    : null;
  if (!messenger || !action) {
    sendJson(response, 400, { error: "messenger and action are required." });
    return;
  }
  let resolvedLaunchConfig;
  if (action === "start" || action === "restart") {
    try {
      const resolvedLaunch = await resolveMessengerRuntimeLaunch({
        messenger,
        globalSafeSecretsPath: dependencies.runtimeState.getGlobalDashboardSettings().messengerSharedSecretsPath,
        launchConfig: {
          credentialSource: body.credentialSource === "manual" || body.credentialSource === "safe-file" ? body.credentialSource : "default",
          safeSecretsPath: typeof body.safeSecretsPath === "string" ? body.safeSecretsPath : "",
          discordToken: typeof body.discordToken === "string" ? body.discordToken : "",
          telegramBotToken: typeof body.telegramBotToken === "string" ? body.telegramBotToken : "",
          matrixHomeserverUrl: typeof body.matrixHomeserverUrl === "string" ? body.matrixHomeserverUrl : "",
          matrixAccessToken: typeof body.matrixAccessToken === "string" ? body.matrixAccessToken : "",
          matrixBotUserId: typeof body.matrixBotUserId === "string" ? body.matrixBotUserId : "",
          whatsappAccessToken: typeof body.whatsappAccessToken === "string" ? body.whatsappAccessToken : "",
          whatsappPhoneNumberId: typeof body.whatsappPhoneNumberId === "string" ? body.whatsappPhoneNumberId : "",
          whatsappApiVersion: typeof body.whatsappApiVersion === "string" ? body.whatsappApiVersion : ""
        }
      });
      resolvedLaunchConfig = {
        credentialSource: resolvedLaunch.credentialSource,
        discordToken: resolvedLaunch.discordToken || undefined,
        telegramBotToken: resolvedLaunch.env.TELEGRAM_BOT_TOKEN,
        matrixHomeserverUrl: resolvedLaunch.env.MATRIX_HOMESERVER_URL,
        matrixAccessToken: resolvedLaunch.env.MATRIX_ACCESS_TOKEN,
        matrixBotUserId: resolvedLaunch.env.MATRIX_BOT_USER_ID,
        whatsappAccessToken: resolvedLaunch.env.WHATSAPP_ACCESS_TOKEN,
        whatsappPhoneNumberId: resolvedLaunch.env.WHATSAPP_PHONE_NUMBER_ID,
        whatsappApiVersion: resolvedLaunch.env.WHATSAPP_API_VERSION
      };
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Messenger credentials are invalid." });
      return;
    }
  }
  const runtime = await dependencies.controlMessengerRuntime({ messenger, action, launchConfig: resolvedLaunchConfig });
  dependencies.runtimeState.recordAction(
    "dashboard:messenger-runtime",
    `${action} ${runtime.label} runtime -> ${runtime.status}${resolvedLaunchConfig?.credentialSource ? ` (${resolvedLaunchConfig.credentialSource})` : ""}`
  );
  sendJson(response, 200, {
    runtime,
    snapshot: dependencies.getMessengerRuntimeSnapshot()
  });
  return;
}

async function handlePostApiDashboardRestart(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  if (typeof dependencies.restartDashboardServer !== "function") {
    sendJson(response, 501, { error: "Dashboard restart is unavailable." });
    return;
  }
  const body = await parseJsonBody(request);
  const requestedBy = typeof body.requestedBy === "string" ? body.requestedBy.trim() : "";
  sendJson(response, 200, { ok: true, restarting: true });
  setTimeout(() => {
    void Promise.resolve(dependencies.restartDashboardServer?.(requestedBy || "webui"));
  }, 80);
  return;
}

async function handlePostApiInstallersRun(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const installerId: DashboardInstallerId | null =
    body.installerId === "python" || body.installerId === "ollama" || body.installerId === "lmstudio" || body.installerId === "comfyui" || body.installerId === "blender" || body.installerId === "ffmpeg"
      ? body.installerId
      : null;
  if (!installerId) {
    sendJson(response, 400, { error: "installerId is required. Supported values: ollama, lmstudio, comfyui, blender, ffmpeg." });
    return;
  }
  const requestedInstallPath = typeof body.installPath === "string" ? body.installPath.trim() : "";
  const executionMode: DashboardInstallerExecutionMode = body.executionMode === "administrator" || body.executionMode === "other-user" ? body.executionMode : "standard";
  const runAsUser = typeof body.runAsUser === "string" ? body.runAsUser.trim() : "";
  if (requestedInstallPath && !isSafeInstallerPath(requestedInstallPath)) {
    sendJson(response, 400, { error: "installPath must be an absolute folder path without command characters." });
    return;
  }
  if (executionMode !== "standard" && installerId !== "comfyui" && installerId !== "python") {
    sendJson(response, 400, {error: "Elevation and alternate-user launches are currently supported for Python and ComfyUI only."});
    return;
  }
  if (executionMode === "other-user" && !/^[A-Za-z0-9_.-]+(?:\\[A-Za-z0-9_.-]+)?$/.test(runAsUser)) {
    sendJson(response, 400, {error: "Enter a Windows user name such as user, COMPUTER\\user, or DOMAIN\\user."});
    return;
  }
  if (executionMode !== "standard" && !isLoopbackRequest(request)) {
    sendJson(response, 403, {error: "Elevated and alternate-user installers must be started from the dashboard host."});
    return;
  }
  const spec = await resolveInstallerSpec(installerId, requestedInstallPath, executionMode, runAsUser);
  if (!spec) {
    sendJson(response, 404, { error: `Installer script/config for "${installerId}" was not found.` });
    return;
  }
  if (spec.id === "comfyui" && spec.logPath) {
    latestComfyInstallerLogPath = spec.logPath;
  }
  dependencies.runtimeState.recordAction("dashboard:installer:start", `Running installer for ${spec.label}${requestedInstallPath ? ` at ${requestedInstallPath}` : " using the default location"}.`);
  const result = await runInstaller(spec);
  const comfyUiRuntime = result.ok && spec.comfyUiInstallRoot
    ? await saveComfyUiRuntimeConfiguration({workingDirectory: spec.comfyUiInstallRoot})
    : null;
  const summary = result.ok
    ? `${spec.label} installer completed successfully.`
    : `${spec.label} installer failed (exit ${result.exitCode ?? "unknown"}).`;
  dependencies.runtimeState.recordAction("dashboard:installer:finish", summary);
  const errorDetail = !result.ok
    ? ((result.stderr || result.stdout || summary).trim().slice(0, 1200) || summary)
    : "";
  sendJson(response, result.ok ? 200 : 500, {
    ok: result.ok,
    error: result.ok ? undefined : errorDetail,
    installerId: spec.id,
    label: spec.label,
    exitCode: result.exitCode,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    logPath: spec.logPath,
    launchesInteractively: spec.launchesInteractively === true,
    comfyUiRuntime
  });
}

async function handleGetComfyInstallerLog(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const configuredRuntime = await getComfyUiRuntimeStatus();
  const logPath = latestComfyInstallerLogPath
    || path.join(configuredRuntime.workingDirectory || resolveRepoPath("data", "comfyui"), "install-comfyui.log");
  try {
    const output = await readFile(logPath, "utf8");
    sendJson(response, 200, {logPath, output: output.slice(-24_000), available: true});
  } catch {
    sendJson(response, 200, {logPath, output: "No ComfyUI installer log yet.", available: false});
  }
}

async function handleGetApiGuilds(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listGuilds());
  return;
}

async function handleGetApiGuildPermissions(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.getGuildPermissionSummary(guildId));
  return;
}

async function handleGetApiChannelPermissions(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  const channelId = url.searchParams.get("channelId")?.trim() ?? "";
  if (!guildId || !channelId) {
    sendJson(response, 400, { error: "guildId and channelId are required." });
    return;
  }
  sendJson(response, 200, await dependencies.getChannelPermissionSummary(guildId, channelId));
  return;
}

async function handleGetApiCommandDefinitions(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, dependencies.listCommandDefinitions());
  return;
}

async function handleGetApiCommandSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  sendJson(response, 200, dependencies.getCommandSettings(guildId || null));
  return;
}

async function handleGetApiInviteLink(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId");
  sendJson(response, 200, { url: dependencies.getBotInviteUrl(guildId) });
  return;
}

async function handleGetApiGuildInvites(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId");
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.listGuildInvites(guildId));
  return;
}

async function handleGetApiOllamaModels(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listOllamaModels());
  return;
}

async function handleGetApiChannels(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.listChannels(guildId));
  return;
}

async function handleGetApiChannelSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  const channelId = url.searchParams.get("channelId")?.trim() ?? "";
  if (!guildId || !channelId) {
    sendJson(response, 400, { error: "guildId and channelId are required." });
    return;
  }
  sendJson(response, 200, await dependencies.getChannelSettings(guildId, channelId));
  return;
}

async function handleGetApiChannelBotMessages(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const channelId = url.searchParams.get("channelId")?.trim() ?? "";
  if (!channelId) {
    sendJson(response, 400, { error: "channelId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.listRecentBotMessages(channelId));
  return;
}

async function handlePostApiVoiceJoin(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!guildId || !channelId) {
    sendJson(response, 400, { error: "guildId and channelId are required." });
    return;
  }
  await dependencies.joinVoiceChannel(guildId, channelId);
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiVoiceDisconnect(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  await dependencies.disconnectVoiceChannel(guildId);
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiModerationSimulate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";
  const images = Array.isArray(body.images)
    ? body.images.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  sendJson(response, 200, await dependencies.simulateModeration({ guildId, text, images }));
  return;
}

async function handleGetApiUsers(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  const query = url.searchParams.get("query")?.trim() ?? "";
  sendJson(response, 200, await dependencies.searchUsers(guildId, query));
  return;
}

async function handlePostApiUsersFetch(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!guildId || !query) {
    sendJson(response, 400, { error: "guildId and query are required." });
    return;
  }
  const users = await dependencies.fetchUsers(guildId, query);
  dependencies.runtimeState.recordAction(
    "dashboard:user-fetch",
    `Fetched ${users.length} user${users.length === 1 ? "" : "s"} into the cache for ${guildId}.`
  );
  sendJson(response, 200, users);
  return;
}

async function handleGetApiRoles(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.listRoles(guildId));
  return;
}

async function handleGetApiGuildSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.getGuildSettings(guildId));
  return;
}

async function handleGetApiGuildDashboardSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, dependencies.getGuildDashboardSettings(guildId));
  return;
}

async function handleGetApiChatModeDebug(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  const channelId = url.searchParams.get("channelId")?.trim() ?? "";
  if (!guildId || !channelId) {
    sendJson(response, 400, { error: "guildId and channelId are required." });
    return;
  }
  sendJson(response, 200, dependencies.getChatModeDebugStatus(guildId, channelId));
  return;
}

async function handleGetApiDms(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listDirectMessages());
  return;
}

async function handleGetApiDmMessages(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const channelId = url.searchParams.get("channelId")?.trim() ?? "";
  if (!channelId) {
    sendJson(response, 400, { error: "channelId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.getDirectMessageEntries(channelId));
  return;
}

async function handleGetApiAutomationPresets(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listAutomationPresets());
  return;
}

async function handleGetApiAutomationTextSources(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listAutomationTextSources());
  return;
}

async function handleGetApiAutomationTextSourceContent(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const fileName = url.searchParams.get("fileName")?.trim() ?? "";
  const maxLines = Number.parseInt(url.searchParams.get("maxLines") ?? "", 10);
  if (!fileName) {
    sendJson(response, 400, { error: "fileName is required." });
    return;
  }
  sendJson(response, 200, await dependencies.readAutomationTextSourcePreview({
    fileName,
    maxLines: Number.isFinite(maxLines) ? maxLines : undefined
  }));
  return;
}

async function handleGetApiImagePools(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listImagePools());
  return;
}

async function handleGetApiResourcePools(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const kind = url.searchParams.get("kind")?.trim();
  if (!isDashboardResourcePoolKind(kind)) {
    sendJson(response, 400, { error: "kind must be image, model3d, video, audio, or music." });
    return;
  }
  sendJson(response, 200, await listDashboardResourcePools(kind));
  return;
}

async function handleGetApiResourcePool(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const kind = url.searchParams.get("kind")?.trim();
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!isDashboardResourcePoolKind(kind) || !id) {
    sendJson(response, 400, { error: "kind and id are required." });
    return;
  }
  const origin = `${url.protocol}//${url.host}`;
  const pool = await getDashboardResourcePoolDetail(kind, id, origin);
  if (!pool) {
    sendJson(response, 404, { error: "Pool not found." });
    return;
  }
  sendJson(response, 200, pool);
  return;
}

async function handleGetApiModel3dHistory(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listGeneratedModels());
  return;
}

async function handleGetApiImageHistory(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listGeneratedImages());
  return;
}

async function handleGetApiAudioHistory(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listGeneratedAudios());
  return;
}
async function handleGetApiVideoHistory(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  sendJson(response, 200, await dependencies.listGeneratedVideos());
  return;
}

async function handleGetApiGenerationJobs(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const limit = Number.parseInt(url.searchParams.get("limit") || "", 10);
  sendJson(response, 200, await listGenerationJobs(Number.isFinite(limit) ? limit : undefined));
  return;
}

async function handleGetApiGameEngineExports(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const engine = url.searchParams.get("engine")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const limitRaw = Number.parseInt(url.searchParams.get("limit") || "", 10);
  sendJson(response, 200, await listGameEngineExports({
    engine: engine === "unity" || engine === "unreal" || engine === "godot" ? engine : null,
    status: status === "pending" || status === "imported" || status === "failed" ? status : null,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined
  }));
  return;
}

async function handleGetApiGameEngineExportsListen(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const engine = url.searchParams.get("engine")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const sinceVersionRaw = Number.parseInt(url.searchParams.get("sinceVersion") || "", 10);
  const timeoutSecondsRaw = Number.parseInt(url.searchParams.get("timeoutSeconds") || "", 10);
  sendJson(response, 200, await listenForGameEngineExportChanges({
    engine: engine === "unity" || engine === "unreal" || engine === "godot" ? engine : null,
    status: status === "pending" || status === "imported" || status === "failed" ? status : null,
    sinceVersion: Number.isFinite(sinceVersionRaw) ? sinceVersionRaw : 0,
    timeoutMs: Number.isFinite(timeoutSecondsRaw) ? timeoutSecondsRaw * 1_000 : undefined
  }));
  return;
}

async function handleGetApiGameEngineExportFile(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const exportId = url.searchParams.get("exportId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!exportId || !fileName) {
    sendJson(response, 400, { error: "exportId and file are required." });
    return;
  }
  try {
    const file = await readGameEngineExportFile({ exportId, fileName });
    sendBinary(response, 200, file.contentType, file.data);
  } catch (error) {
    sendJson(response, 404, { error: error instanceof Error ? error.message : "Game engine export file was not found." });
  }
  return;
}

async function handleGetApiModel3dFile(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const modelId = url.searchParams.get("modelId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!modelId || !fileName) {
    sendJson(response, 400, { error: "modelId and file are required." });
    return;
  }
  try {
    const file = await dependencies.readGeneratedModelFile(modelId, fileName);
    sendBinary(response, 200, file.contentType, file.data);
  } catch (error) {
    sendJson(response, 404, { error: error instanceof Error ? error.message : "Model file was not found." });
  }
  return;
}

async function handleGetApiGeneratedImageFile(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const imageId = url.searchParams.get("imageId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!imageId || !fileName) {
    sendJson(response, 400, { error: "imageId and file are required." });
    return;
  }
  const file = await dependencies.readGeneratedImageFile(imageId, fileName);
  sendBinary(response, 200, file.contentType, file.data);
  return;
}

async function handleGetApiUploadedModelImageFile(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const requestedFileName = url.searchParams.get("file")?.trim() ?? "";
  const safeFileName = sanitizeUploadedModelImageFileName(requestedFileName);
  if (!requestedFileName || !safeFileName || safeFileName !== requestedFileName) {
    sendJson(response, 400, { error: "A valid uploaded image file name is required." });
    return;
  }
  const absolutePath = path.resolve(uploadedModelImagesDirectory, safeFileName);
  const allowedPrefix = path.resolve(uploadedModelImagesDirectory) + path.sep;
  if (!absolutePath.startsWith(allowedPrefix)) {
    sendJson(response, 400, { error: "Invalid uploaded image file path." });
    return;
  }
  try {
    await stat(absolutePath);
    const data = await readFile(absolutePath);
    sendBinary(response, 200, imageExtensionToContentType(safeFileName), data);
  } catch {
    sendJson(response, 404, { error: "Uploaded image file was not found." });
  }
  return;
}

async function handleGetApiGeneratedAudioFile(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const audioId = url.searchParams.get("audioId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!audioId || !fileName) {
    sendJson(response, 400, { error: "audioId and file are required." });
    return;
  }
  const file = await dependencies.readGeneratedAudioFile(audioId, fileName);
  sendBinary(response, 200, file.contentType, file.data);
  return;
}
async function handleGetApiGeneratedVideoFile(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const videoId = url.searchParams.get("videoId")?.trim() ?? "";
  const fileName = url.searchParams.get("file")?.trim() ?? "";
  if (!videoId || !fileName) {
    sendJson(response, 400, { error: "videoId and file are required." });
    return;
  }
  const file = await dependencies.readGeneratedVideoFile(videoId, fileName);
  sendBinary(response, 200, file.contentType, file.data);
  return;
}

async function handleGetApiAutomationPublishedMedia(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  try {
    const raw = await readFile(getPublishedMediaManifestPath(appConfig.dataDirectory), "utf8");
    sendJson(response, 200, JSON.parse(raw));
  } catch (error) {
    sendJson(response, 404, { error: error instanceof Error ? error.message : "Automation feed is unavailable." });
  }
}

async function handleGetApiScheduledAutomations(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.listScheduledAutomations(guildId));
  return;
}

async function handleGetApiJoinAutomations(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() ?? "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.listJoinAutomations(guildId));
  return;
}

const dashboardReadRouteTable = createDashboardRouteTable([
  getRoute("/vendor/gif.worker.js", handleGetVendorGifWorkerJs),
  getRoute("/assets/dashboard-logo.png", handleGetDashboardLogo),
  getRoute("/assets/dashboard-theme-logo.png", handleGetDashboardThemeLogo),
  getRoute("/", handleGetRoot),
  getRoute("/android-companion", handleGetAndroidCompanionPage),
  getRoute("/android-companion/qr.svg", handleGetAndroidCompanionQr),
  getRoute("/api/settings/network", handleGetDashboardNetworkConfiguration),
  postRoute("/api/settings/network", handlePostDashboardNetworkConfiguration),
  postRoute("/api/settings/network/access-token", handlePostDashboardAccessToken),
  postRoute("/api/settings/network/access-token/qr.svg", handlePostDashboardAccessTokenQr),
  getRoute("/api/companion/android-release", handleGetAndroidCompanionRelease),
  getRoute("/downloads/android-companion", handleGetAndroidCompanionDownload),
  getRoute("/api/state", handleGetApiState),
  getRoute("/api/console-history", handleGetApiConsoleHistory),
  getRoute("/api/messenger-runtimes", handleGetApiMessengerRuntimes),
  getRoute("/api/theme-config", handleGetApiThemeConfig),
  getRoute("/api/theme-preference", handleGetApiThemePreference),
  postRoute("/api/theme-preference", handlePostApiThemePreference),
  postRoute("/api/messenger-runtimes/control", handlePostApiMessengerRuntimesControl),
  postRoute("/api/dashboard/restart", handlePostApiDashboardRestart),
  postRoute("/api/installers/run", handlePostApiInstallersRun),
  getRoute("/api/installers/comfyui/log", handleGetComfyInstallerLog),
  getRoute("/api/guilds", handleGetApiGuilds),
  getRoute("/api/guild-permissions", handleGetApiGuildPermissions),
  getRoute("/api/channel-permissions", handleGetApiChannelPermissions),
  getRoute("/api/command-definitions", handleGetApiCommandDefinitions),
  getRoute("/api/command-settings", handleGetApiCommandSettings),
  getRoute("/api/invite-link", handleGetApiInviteLink),
  getRoute("/api/guild-invites", handleGetApiGuildInvites),
  getRoute("/api/ollama-models", handleGetApiOllamaModels),
  getRoute("/api/channels", handleGetApiChannels),
  getRoute("/api/channel-settings", handleGetApiChannelSettings),
  getRoute("/api/channel-bot-messages", handleGetApiChannelBotMessages),
  postRoute("/api/voice/join", handlePostApiVoiceJoin),
  postRoute("/api/voice/disconnect", handlePostApiVoiceDisconnect),
  postRoute("/api/moderation/simulate", handlePostApiModerationSimulate),
  getRoute("/api/users", handleGetApiUsers),
  postRoute("/api/users/fetch", handlePostApiUsersFetch),
  getRoute("/api/roles", handleGetApiRoles),
  getRoute("/api/guild-settings", handleGetApiGuildSettings),
  getRoute("/api/guild-dashboard-settings", handleGetApiGuildDashboardSettings),
  getRoute("/api/chat-mode-debug", handleGetApiChatModeDebug),
  getRoute("/api/dms", handleGetApiDms),
  getRoute("/api/dm-messages", handleGetApiDmMessages),
  getRoute("/api/automation-presets", handleGetApiAutomationPresets),
  getRoute("/api/automation-text-sources", handleGetApiAutomationTextSources),
  getRoute("/api/automation-text-sources/content", handleGetApiAutomationTextSourceContent),
  getRoute("/api/image-pools", handleGetApiImagePools),
  getRoute("/api/resource-pools", handleGetApiResourcePools),
  getRoute("/api/resource-pool", handleGetApiResourcePool),
  getRoute("/api/model3d-history", handleGetApiModel3dHistory),
  getRoute("/api/image-history", handleGetApiImageHistory),
  getRoute("/api/audio-history", handleGetApiAudioHistory),
  getRoute("/api/video-history", handleGetApiVideoHistory),
  getRoute("/api/generation-jobs", handleGetApiGenerationJobs),
  getRoute("/api/game-engine-exports", handleGetApiGameEngineExports),
  getRoute("/api/game-engine-exports/listen", handleGetApiGameEngineExportsListen),
  getRoute("/api/game-engine-export-file", handleGetApiGameEngineExportFile),
  getRoute("/api/model3d-file", handleGetApiModel3dFile),
  getRoute("/api/generated-image-file", handleGetApiGeneratedImageFile),
  getRoute("/api/uploaded-model-image-file", handleGetApiUploadedModelImageFile),
  getRoute("/api/generated-audio-file", handleGetApiGeneratedAudioFile),
  getRoute("/api/generated-video-file", handleGetApiGeneratedVideoFile),
  getRoute("/api/automation-published-media", handleGetApiAutomationPublishedMedia),
  getRoute("/api/scheduled-automations", handleGetApiScheduledAutomations),
  getRoute("/api/join-automations", handleGetApiJoinAutomations),
  postRoute("/api/settings/urage-now/register-protocol", handlePostApiRegisterUriageNowProtocol),
  postRoute("/api/settings/urage-now/test-protocol", handlePostApiTestUriageNowProtocol),
  postRoute("/api/explorer/open", handlePostApiExplorerOpen)
]);

async function handlePostApiExplorerOpen(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const targetPath = typeof body?.path === "string" && body.path.trim() ? body.path.trim() : "";
  if (!targetPath) {
    sendJson(response, 400, { error: "path is required." });
    return;
  }
  spawn("explorer", [targetPath], { detached: true }).unref();
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiRegisterUriageNowProtocol(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const scriptPath = path.join(repoRoot, "scripts", "register-urage-now-protocol.cmd");
  try { await stat(scriptPath); } catch {
    sendJson(response, 404, { error: "The URage NOW protocol installer is not available." });
    return;
  }
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn("cmd.exe", ["/d", "/s", "/c", scriptPath], { cwd: repoRoot, windowsHide: true });
    let stderr = "";
    child.stderr?.on("data", chunk => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", code => resolve({ code, stderr }));
  }).catch(error => ({ code: -1, stderr: error instanceof Error ? error.message : String(error) }));
  if (result.code !== 0) {
    sendJson(response, 500, { error: result.stderr.trim() || "Windows could not register the URage NOW link protocol." });
    return;
  }
  sendJson(response, 200, { ok: true, message: "URage NOW links are enabled for this Windows user." });
}

async function handlePostApiTestUriageNowProtocol(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const scriptPath = path.join(repoRoot, "scripts", "test-urage-now-link.ps1");
  try { await stat(scriptPath); } catch {
    sendJson(response, 404, { error: "The URage NOW protocol test is not available." });
    return;
  }
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], { cwd: repoRoot, windowsHide: true, detached: true, stdio: "ignore" });
  child.unref();
  sendJson(response, 200, { ok: true, message: "Opened a URage NOW protocol test. Look for the dashboard import overlay." });
}

export async function handleDashboardReadRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: DashboardDependencies
): Promise<boolean>{
  return dispatchDashboardRoute(dashboardReadRouteTable, {
    request,
    response,
    url,
    dependencies
  });
}
