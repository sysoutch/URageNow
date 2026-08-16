import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { parseJsonBody, sendBinary, sendJson } from "../http.js";
import { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute } from "../router.js";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import {
  downloadAndInstallBlenderAddon,
  installLocalBlenderAddon,
  listBlenderInstalls,
  listInstalledBlenderAddons,
  setBlenderAddonEnabled
} from "../resourceHub/blenderAddonManager.js";
import { extractDesktopToolIcon, launchDesktopTool } from "../resourceHub/desktopToolManager.js";
import {
  getModel3dPrintApplications,
  launchModelInPrintApplication
} from "../resourceHub/model3dPrintApplicationManager.js";
import {
  downloadLatestGithubReleaseAsset,
  fetchLatestGithubRelease,
  importToolRepositoryFromGithub,
  isReleaseAssetSelectionRequiredError,
  isToolImportTypeRequiredError,
  listImportedToolRepositories,
  type ImportedToolType
} from "../resourceHub/toolRepositoryManager.js";
import {
  buildToolScaffoldPlanningPrompt,
  buildToolScaffoldImplementationPrompt,
  createToolFromScaffold,
  parseToolScaffoldImplementation,
  parseToolScaffoldPlan,
  renderToolScaffoldFiles,
  auditToolScaffoldFiles
} from "../resourceHub/toolScaffoldManager.js";
import {
  applyStagedToolEdit,
  listEditableTools,
  planToolEdit,
  readEditableToolFile,
  rollbackToolEdit,
  stageToolEdit
} from "../resourceHub/toolEditorManager.js";
import {
  changeToolCategoryVisibility,
  deleteToolCategory,
  getToolCatalogMetadata,
  removeToolTag,
  renameToolTag,
  setToolTagColor,
  setToolTags,
  updateToolTagsBulk,
  upsertToolCategory
} from "../resourceHub/toolCatalogMetadataStore.js";
import {moveToolToCategory} from "../resourceHub/toolCategoryMoveTransaction.js";
import {
  downloadImportedAssetRelease,
  importAssetRepositoryFromGithub,
  isImportedAssetPlatform,
  isReleaseAssetSelectionRequiredError as isAssetReleaseAssetSelectionRequiredError,
  listImportedAssetRepositories
} from "../resourceHub/assetRepositoryManager.js";
import {
  addGameEngineProject,
  browseForProjectFolder,
  fetchUnityHubProjects,
  launchGameEngineProject,
  listGameEngineProjects,
  scanGameEngineProjects
} from "../resourceHub/gameEngineProjectManager.js";
import {
  getRemoteAssetCatalog,
  prepareRemoteAssetPackage
} from "../resourceHub/remoteAssetCatalogManager.js";
import {getRemoteBlenderScriptCatalog, prepareRemoteBlenderScriptPackage} from "../resourceHub/remoteBlenderScriptCatalogManager.js";
import {isThreeDSuiteKey, listThreeDSuiteInstalls} from "../resourceHub/threeDSuiteInstallManager.js";
import {browseForComfyUiLauncherBatch, browseForComfyUiLauncherFolder, createComfyUiLauncherBatches, getComfyUiRuntimeStatus, saveComfyUiRuntimeConfiguration, startComfyUiRuntime, stopComfyUiRuntime} from "../comfyUi/comfyUiRuntimeManager.js";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readImportedToolType(value: unknown): ImportedToolType | null {
  return value === "web" || value === "desktop" ? value : null;
}

function readImportedAssetPlatform(value: unknown): "unity" | "godot" | "unreal" | null {
  return isImportedAssetPlatform(value) ? value : null;
}

async function handleGetComfyUiRuntime(_request: IncomingMessage, response: ServerResponse): Promise<void> { sendJson(response, 200, await getComfyUiRuntimeStatus()); }
async function handlePostComfyUiRuntime(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try { const body = await parseJsonBody(request) as Record<string, unknown>; sendJson(response, 200, await saveComfyUiRuntimeConfiguration({launcherPath: readString(body.launcherPath), workingDirectory: readString(body.workingDirectory)})); }
  catch (error) { sendJson(response, 400, {error: error instanceof Error ? error.message : "Failed to save ComfyUI runtime settings."}); }
}
async function handlePostComfyUiRuntimeStart(_request: IncomingMessage, response: ServerResponse): Promise<void> { try { sendJson(response, 200, await startComfyUiRuntime()); } catch (error) { sendJson(response, 400, {error: error instanceof Error ? error.message : "Failed to start ComfyUI."}); } }
async function handlePostComfyUiRuntimeStop(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    sendJson(response, 200, await stopComfyUiRuntime());
  } catch (error) {
    sendJson(response, 500, {error: error instanceof Error ? error.message : "Failed to stop ComfyUI."});
  }
}
async function handlePostComfyUiRuntimeCreateLaunchers(request: IncomingMessage, response: ServerResponse): Promise<void> { try { const body = await parseJsonBody(request) as Record<string, unknown>; sendJson(response, 200, await createComfyUiLauncherBatches(readString(body.rootPath))); } catch (error) { sendJson(response, 400, {error: error instanceof Error ? error.message : "Failed to create ComfyUI launchers."}); } }
async function handlePostComfyUiRuntimeBrowseFolder(_request: IncomingMessage, response: ServerResponse): Promise<void> { try { const workingDirectory = await browseForComfyUiLauncherFolder(); sendJson(response, 200, workingDirectory ? {workingDirectory} : {canceled: true}); } catch (error) { sendJson(response, 400, {error: error instanceof Error ? error.message : "Failed to browse for a ComfyUI folder."}); } }
async function handlePostComfyUiRuntimeBrowseLauncher(_request: IncomingMessage, response: ServerResponse): Promise<void> { try { const launcherPath = await browseForComfyUiLauncherBatch(); sendJson(response, 200, launcherPath ? {launcherPath} : {canceled: true}); } catch (error) { sendJson(response, 400, {error: error instanceof Error ? error.message : "Failed to browse for a ComfyUI launcher."}); } }

async function handlePostApiToolScaffoldPlan(
  request: IncomingMessage,
  response: ServerResponse,
  _url: URL,
  dependencies: DashboardDependencies
): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  const requestText = readString(body.request);
  if (!requestText) {
    sendJson(response, 400, {error: "Describe the tool you want to create."});
    return;
  }
  try {
    const spec = parseToolScaffoldPlan(await dependencies.askModel(buildToolScaffoldPlanningPrompt(requestText)));
    const implementation = parseToolScaffoldImplementation(
      await dependencies.askModel(buildToolScaffoldImplementationPrompt(spec, requestText)),
      spec
    );
    const audit = auditToolScaffoldFiles(implementation.files);
    if (audit.some(item => !item.passed)) {
      throw new Error(`LazyDev implementation broke required integrations: ${audit.filter(item => !item.passed).map(item => item.label).join(", ")}.`);
    }
    sendJson(response, 200, {spec, audit, implementation});
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Failed to plan the tool."});
  }
}

async function handlePostApiToolScaffoldCreate(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    const result = await createToolFromScaffold(body.spec, body.files);
    sendJson(response, 201, result);
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Failed to create the tool."});
  }
}

async function handleGetApiToolCatalogMetadata(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, getToolCatalogMetadata());
}

async function handlePostApiToolCategory(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    sendJson(response, 200, await upsertToolCategory(await parseJsonBody(request)));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not save the category."});
  }
}

async function handlePostApiToolCategoryVisibility(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await changeToolCategoryVisibility(body.categoryId, body.hidden, body.confirmAssigned === true));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not change category visibility."});
  }
}

async function handlePostApiToolCategoryDelete(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await deleteToolCategory(body.categoryId));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not delete the category."});
  }
}

async function handlePostApiToolCategoryMove(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await moveToolToCategory(readString(body.toolId), readString(body.destinationCategory)));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not move the tool."});
  }
}

async function handlePostApiToolTags(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await setToolTags(body.toolId, body.tags));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not save tool tags."});
  }
}

async function handlePostApiToolTagsBulk(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await updateToolTagsBulk(body.toolIds, body.tags, body.mode));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not update tool tags."});
  }
}

async function handlePostApiToolTagColor(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await setToolTagColor(body.tag, body.color));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not save tag color."});
  }
}

async function handlePostApiToolTagRename(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await renameToolTag(body.from, body.to));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not rename the tag."});
  }
}

async function handlePostApiToolTagRemove(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await removeToolTag(body.tag));
  } catch (error) {
    sendJson(response, 400, {error: error instanceof Error ? error.message : "Could not remove the tag."});
  }
}

async function handleGetApiToolEditCatalog(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, { tools: await listEditableTools() });
}

async function handleGetApiToolEditFile(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  try {
    sendJson(response, 200, await readEditableToolFile(readString(url.searchParams.get("toolId")), readString(url.searchParams.get("fileName"))));
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Could not read the tool file." });
  }
}

async function handlePostApiToolEditPlan(request: IncomingMessage, response: ServerResponse, _url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  const toolId = readString(body.toolId);
  const editRequest = readString(body.request);
  if (!toolId || !editRequest) {
    sendJson(response, 400, { error: "toolId and request are required." });
    return;
  }
  try {
    sendJson(response, 200, await planToolEdit(toolId, editRequest, dependencies.askModel));
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Could not plan the tool edit." });
  }
}

async function handlePostApiToolEditStage(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  const toolId = readString(body.toolId);
  const files = body.files && typeof body.files === "object" && !Array.isArray(body.files)
    ? body.files as Record<string, string>
    : {};
  try {
    sendJson(response, 201, await stageToolEdit(toolId, files));
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Could not stage the tool edit." });
  }
}

async function handlePostApiToolEditApply(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await applyStagedToolEdit(readString(body.stageId)));
  } catch (error) {
    sendJson(response, 409, { error: error instanceof Error ? error.message : "Could not apply the staged tool edit." });
  }
}

async function handlePostApiToolEditRollback(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  try {
    sendJson(response, 200, await rollbackToolEdit(readString(body.transactionId)));
  } catch (error) {
    sendJson(response, 409, { error: error instanceof Error ? error.message : "Could not roll back the tool edit." });
  }
}

async function handleGetApiDesktopToolIcon(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const toolPath = url.searchParams.get("path")?.trim() ?? "";
  if (!toolPath) {
    sendJson(response, 400, { error: "path is required." });
    return;
  }

  const resolvedPath = path.resolve(toolPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const allowedExts = new Set([".exe", ".bat", ".cmd", ".sh", ".ps1", ".lnk", ".app", ".command"]);

  if (!allowedExts.has(ext)) {
    sendJson(response, 400, { error: "Unsupported file type." });
    return;
  }

  // Only extract icons for .exe and .lnk files on Windows
  if (process.platform === "win32" && ![".exe", ".lnk"].includes(ext)) {
    sendJson(response, 200, { icon: null, fallback: true });
    return;
  }

  try {
    await readFile(resolvedPath);
  } catch {
    sendJson(response, 404, { error: "File not found." });
    return;
  }

  if (process.platform === "win32" && ext === ".exe") {
    const iconData = await extractDesktopToolIcon(resolvedPath);
    if (iconData) {
      sendBinary(response, 200, "image/png", iconData);
    } else {
      // Fall back to default icon
      try {
        const defaultIconPath = path.join(__dirname, "..", "..", "..", "dashboard", "logo.png");
        const data = await readFile(defaultIconPath);
        sendBinary(response, 200, "image/png", data);
      } catch {
        sendJson(response, 404, { error: "Icon not found." });
      }
    }
  } else if (process.platform === "win32" && ext === ".lnk") {
    // For .lnk files, try to get the target's icon
    const iconData = await extractDesktopToolIcon(resolvedPath);
    if (iconData) {
      sendBinary(response, 200, "image/png", iconData);
    } else {
      sendJson(response, 200, { icon: null, fallback: true });
    }
  } else {
    sendJson(response, 200, { icon: null, fallback: true });
  }
}

async function handleGetApiBlenderInstalls(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, { blenders: await listBlenderInstalls() });
}

async function handleGetApiThreeDSuiteInstalls(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const suite = readString(url.searchParams.get("suite"));
  if (!isThreeDSuiteKey(suite)) {
    sendJson(response, 400, {error: "A supported non-Blender 3D suite is required."});
    return;
  }
  sendJson(response, 200, {installs: await listThreeDSuiteInstalls(suite)});
}

async function handleGetApiBlenderInstalledAddons(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const blenderPath = readString(url.searchParams.get("blenderPath"));
  if (!blenderPath) {
    sendJson(response, 400, { error: "blenderPath is required." });
    return;
  }
  sendJson(response, 200, { addons: await listInstalledBlenderAddons(blenderPath) });
}

async function handlePostApiBlenderInstallLocal(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const blenderPath = readString(body.blenderPath);
  const sourcePath = readString(body.sourcePath);
  if (!blenderPath || !sourcePath) {
    sendJson(response, 400, { error: "blenderPath and sourcePath are required." });
    return;
  }
  const result = await installLocalBlenderAddon(blenderPath, sourcePath, readBoolean(body.enable, true));
  sendJson(response, 200, { result });
}

async function handlePostApiBlenderInstallGithub(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const blenderPath = readString(body.blenderPath);
  const repositoryUrl = readString(body.repositoryUrl);
  if (!blenderPath || !repositoryUrl) {
    sendJson(response, 400, { error: "blenderPath and repositoryUrl are required." });
    return;
  }
  const result = await downloadAndInstallBlenderAddon(blenderPath, repositoryUrl, readBoolean(body.enable, true));
  sendJson(response, 200, { result });
}

async function handlePostApiBlenderToggleAddon(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const blenderPath = readString(body.blenderPath);
  const moduleName = readString(body.moduleName);
  if (!blenderPath || !moduleName) {
    sendJson(response, 400, { error: "blenderPath and moduleName are required." });
    return;
  }
  const addon = await setBlenderAddonEnabled(blenderPath, moduleName, readBoolean(body.enabled, true));
  sendJson(response, 200, { addon });
}

async function handlePostApiDesktopToolLaunch(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const toolPath = readString(body.toolPath);
  if (!toolPath) {
    sendJson(response, 400, { error: "toolPath is required." });
    return;
  }
  try {
    sendJson(response, 200, { result: launchDesktopTool(toolPath) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to launch desktop tool.";
    sendJson(response, 400, { error: message });
  }
}

async function handleGetApiModel3dPrintApplications(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, {
    platform: process.platform,
    applications: getModel3dPrintApplications()
  });
}

async function handlePostApiModel3dPrintApplicationLaunch(
  request: IncomingMessage,
  response: ServerResponse,
  _url: URL,
  dependencies: DashboardDependencies
): Promise<void> {
  const body = await parseJsonBody(request);
  const applicationId = readString(body.applicationId);
  const modelId = readString(body.modelId);
  const fileName = readString(body.fileName);
  if (!applicationId || !modelId || !fileName) {
    sendJson(response, 400, {error: "applicationId, modelId, and fileName are required."});
    return;
  }
  try {
    const modelPath = await dependencies.resolveGeneratedModelFilePath(modelId, fileName);
    const result = await launchModelInPrintApplication({applicationId, modelPath});
    sendJson(response, 200, {
      result: {
        applicationId: result.applicationId,
        executablePath: result.executablePath,
        fileName: path.basename(result.modelPath),
        launched: result.launched
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open the model in the 3D print application.";
    sendJson(response, 400, {error: message});
  }
}

async function handleGetApiToolRepos(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, { imports: await listImportedToolRepositories() });
}

async function handlePostApiToolReposImport(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const repository = readString(body.repository);
  if (!repository) {
    sendJson(response, 400, { error: "repository is required." });
    return;
  }
  try {
    const entry = await importToolRepositoryFromGithub(repository, readImportedToolType(body.toolType));
    sendJson(response, 200, { entry });
  } catch (error) {
    if (isToolImportTypeRequiredError(error)) {
      sendJson(response, 409, {
        error: error.message,
        requiresToolType: true,
        analysis: error.payload
      });
      return;
    }
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to import GitHub tool repository." });
  }
}

async function handlePostApiToolReposLatestRelease(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const repository = readString(body.repository);
  if (!repository) {
    sendJson(response, 400, { error: "repository is required." });
    return;
  }
  try {
    sendJson(response, 200, { release: await fetchLatestGithubRelease(repository) });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to fetch the latest release." });
  }
}

async function handlePostApiToolReposDownloadRelease(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const repository = readString(body.repository);
  if (!repository) {
    sendJson(response, 400, { error: "repository is required." });
    return;
  }
  try {
    const asset = await downloadLatestGithubReleaseAsset(repository, readString(body.assetName) || null);
    sendJson(response, 200, { asset });
  } catch (error) {
    if (isReleaseAssetSelectionRequiredError(error)) {
      sendJson(response, 409, {
        error: error.message,
        requiresAssetSelection: true,
        release: error.payload
      });
      return;
    }
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to download the latest release asset." });
  }
}

async function handleGetApiAssetRepos(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  sendJson(response, 200, { imports: await listImportedAssetRepositories(readImportedAssetPlatform(url.searchParams.get("platform"))) });
}

async function handlePostApiAssetReposImport(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const repository = readString(body.repository);
  const platform = readImportedAssetPlatform(body.platform);
  if (!repository || !platform) {
    sendJson(response, 400, { error: "repository and platform are required." });
    return;
  }
  try {
    sendJson(response, 200, { entry: await importAssetRepositoryFromGithub(platform, repository) });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to import GitHub asset repository." });
  }
}

async function handlePostApiAssetReposLatestRelease(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const repository = readString(body.repository);
  if (!repository) {
    sendJson(response, 400, { error: "repository is required." });
    return;
  }
  try {
    sendJson(response, 200, { release: await fetchLatestGithubRelease(repository) });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to fetch the latest release." });
  }
}

async function handlePostApiAssetReposDownloadRelease(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const repository = readString(body.repository);
  const platform = readImportedAssetPlatform(body.platform);
  if (!repository || !platform) {
    sendJson(response, 400, { error: "repository and platform are required." });
    return;
  }
  try {
    sendJson(response, 200, { asset: await downloadImportedAssetRelease(platform, repository, readString(body.assetName) || null) });
  } catch (error) {
    if (isAssetReleaseAssetSelectionRequiredError(error)) {
      sendJson(response, 409, {
        error: error.message,
        requiresAssetSelection: true,
        release: error.payload
      });
      return;
    }
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to download the latest release asset." });
  }
}

async function handleGetApiRemoteAssetCatalog(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  try {
    sendJson(response, 200, await getRemoteAssetCatalog(url.searchParams.get("refresh") === "true"));
  } catch (error) {
    sendJson(response, 502, {
      error: error instanceof Error ? error.message : "Failed to fetch the URage Assets catalog from GitHub."
    });
  }
}

async function handleGetApiRemoteAssetDownload(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const id = readString(url.searchParams.get("id"));
  if (!id) {
    sendJson(response, 400, {error: "id is required."});
    return;
  }
  try {
    const archive = await prepareRemoteAssetPackage(id);
    response.writeHead(200, {
      "content-type": "application/zip",
      "content-length": archive.size,
      "content-disposition": `attachment; filename="${archive.fileName}"`
    });
    await pipeline(createReadStream(archive.filePath), response);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }
    sendJson(response, 404, {
      error: error instanceof Error ? error.message : "Failed to create the selected URage asset download."
    });
  }
}

async function handleGetApiBlenderScriptCatalog(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  try { sendJson(response, 200, await getRemoteBlenderScriptCatalog(url.searchParams.get("refresh") === "true")); }
  catch (error) { sendJson(response, 502, {error: error instanceof Error ? error.message : "Failed to fetch the Blender Scripts catalog."}); }
}
async function handleGetApiBlenderScriptDownload(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const id = readString(url.searchParams.get("id"));
  if (!id) return void sendJson(response, 400, {error: "id is required."});
  try {
    const archive = await prepareRemoteBlenderScriptPackage(id);
    response.writeHead(200, {"content-type": "application/zip", "content-length": archive.size, "content-disposition": `attachment; filename="${archive.fileName}"`});
    await pipeline(createReadStream(archive.filePath), response);
  } catch (error) { if (response.headersSent) response.destroy(error instanceof Error ? error : undefined); else sendJson(response, 404, {error: error instanceof Error ? error.message : "Failed to create the Blender script download."}); }
}

async function handlePostApiGameEngineProjectLaunch(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const projectId = readString(body.projectId);
  if (!projectId) {
    sendJson(response, 400, { error: "projectId is required." });
    return;
  }
  try {
    sendJson(response, 200, { result: await launchGameEngineProject(projectId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to launch game engine project.";
    sendJson(response, 400, { error: message });
  }
}

async function handleGetApiGameEngineProjects(_request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  sendJson(response, 200, await listGameEngineProjects({ refreshUnityHub: url.searchParams.get("refreshUnityHub") === "true" }));
}

async function handlePostApiGameEngineProjectsFetchUnityHub(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    sendJson(response, 200, await fetchUnityHubProjects());
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to read Unity Hub projects." });
  }
}

async function handlePostApiGameEngineProjectsBrowse(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const projectPath = await browseForProjectFolder();
    if (!projectPath) {
      sendJson(response, 200, { canceled: true });
      return;
    }
    sendJson(response, 200, { projectPath, ...(await addGameEngineProject(projectPath, "manual")) });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to browse for a project." });
  }
}

async function handlePostApiGameEngineProjectsScan(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const rootPath = readString(body.rootPath);
  if (!rootPath) {
    sendJson(response, 400, { error: "rootPath is required." });
    return;
  }
  try {
    sendJson(response, 200, await scanGameEngineProjects(rootPath, readBoolean(body.recursive, false)));
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to scan for projects." });
  }
}

const dashboardResourceHubRouteTable = createDashboardRouteTable([
  getRoute("/api/comfyui/runtime", handleGetComfyUiRuntime),
  postRoute("/api/comfyui/runtime", handlePostComfyUiRuntime),
  postRoute("/api/comfyui/runtime/start", handlePostComfyUiRuntimeStart),
  postRoute("/api/comfyui/runtime/stop", handlePostComfyUiRuntimeStop),
  postRoute("/api/comfyui/runtime/create-launchers", handlePostComfyUiRuntimeCreateLaunchers),
  postRoute("/api/comfyui/runtime/browse-folder", handlePostComfyUiRuntimeBrowseFolder),
  postRoute("/api/comfyui/runtime/browse-launcher", handlePostComfyUiRuntimeBrowseLauncher),
  getRoute("/api/blender/installs", handleGetApiBlenderInstalls),
  getRoute("/api/3d-suites/installs", handleGetApiThreeDSuiteInstalls),
  getRoute("/api/blender/addons", handleGetApiBlenderInstalledAddons),
  postRoute("/api/blender/addons/install-local", handlePostApiBlenderInstallLocal),
  postRoute("/api/blender/addons/install-github", handlePostApiBlenderInstallGithub),
  postRoute("/api/blender/addons/toggle", handlePostApiBlenderToggleAddon),
  getRoute("/api/desktop-tools/icon", handleGetApiDesktopToolIcon),
  postRoute("/api/desktop-tools/launch", handlePostApiDesktopToolLaunch),
  getRoute("/api/model3d/print-applications", handleGetApiModel3dPrintApplications),
  postRoute("/api/model3d/print-applications/launch", handlePostApiModel3dPrintApplicationLaunch),
  getRoute("/api/tool-repos", handleGetApiToolRepos),
  postRoute("/api/tool-repos/import", handlePostApiToolReposImport),
  postRoute("/api/tool-repos/latest-release", handlePostApiToolReposLatestRelease),
  postRoute("/api/tool-repos/download-release", handlePostApiToolReposDownloadRelease),
  postRoute("/api/tools/scaffold/plan", handlePostApiToolScaffoldPlan),
  postRoute("/api/tools/scaffold/create", handlePostApiToolScaffoldCreate),
  getRoute("/api/tools/catalog/metadata", handleGetApiToolCatalogMetadata),
  postRoute("/api/tools/categories/save", handlePostApiToolCategory),
  postRoute("/api/tools/categories/visibility", handlePostApiToolCategoryVisibility),
  postRoute("/api/tools/categories/delete", handlePostApiToolCategoryDelete),
  postRoute("/api/tools/categories/move-tool", handlePostApiToolCategoryMove),
  postRoute("/api/tools/tags/save", handlePostApiToolTags),
  postRoute("/api/tools/tags/bulk", handlePostApiToolTagsBulk),
  postRoute("/api/tools/tags/color", handlePostApiToolTagColor),
  postRoute("/api/tools/tags/rename", handlePostApiToolTagRename),
  postRoute("/api/tools/tags/remove", handlePostApiToolTagRemove),
  getRoute("/api/tools/edit/catalog", handleGetApiToolEditCatalog),
  getRoute("/api/tools/edit/file", handleGetApiToolEditFile),
  postRoute("/api/tools/edit/plan", handlePostApiToolEditPlan),
  postRoute("/api/tools/edit/stage", handlePostApiToolEditStage),
  postRoute("/api/tools/edit/apply", handlePostApiToolEditApply),
  postRoute("/api/tools/edit/rollback", handlePostApiToolEditRollback),
  getRoute("/api/asset-repos", handleGetApiAssetRepos),
  getRoute("/api/asset-catalog", handleGetApiRemoteAssetCatalog),
  getRoute("/api/asset-catalog/download", handleGetApiRemoteAssetDownload),
  getRoute("/api/blender-script-catalog", handleGetApiBlenderScriptCatalog),
  getRoute("/api/blender-script-catalog/download", handleGetApiBlenderScriptDownload),
  postRoute("/api/asset-repos/import", handlePostApiAssetReposImport),
  postRoute("/api/asset-repos/latest-release", handlePostApiAssetReposLatestRelease),
  postRoute("/api/asset-repos/download-release", handlePostApiAssetReposDownloadRelease),
  getRoute("/api/game-engine-projects", handleGetApiGameEngineProjects),
  postRoute("/api/game-engine-projects/fetch-unity-hub", handlePostApiGameEngineProjectsFetchUnityHub),
  postRoute("/api/game-engine-projects/browse", handlePostApiGameEngineProjectsBrowse),
  postRoute("/api/game-engine-projects/scan", handlePostApiGameEngineProjectsScan),
  postRoute("/api/game-engine-projects/launch", handlePostApiGameEngineProjectLaunch)
]);

export async function handleDashboardResourceHubRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: DashboardDependencies
): Promise<boolean>{
  return dispatchDashboardRoute(dashboardResourceHubRouteTable, {
    request,
    response,
    url,
    dependencies
  });
}
