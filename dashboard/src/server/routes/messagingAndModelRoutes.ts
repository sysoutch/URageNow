import { rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readAutomationTextSourceLine, type DashboardDependencies } from "../runtime/botBridge.js";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import { stripImageMetadataToPng } from "@urage/server/services/imageSanitizer";
import { generateGeneratedModelLods } from "@urage/server/services/model3d";
import { createGenerationJob, updateGenerationJob } from "@urage/server/services/generationJobStore";
import { appConfig } from "@urage/server/config/appConfig";
import { preflightComfyImageWorkflowNodeTypes } from "@urage/server/services/comfyWorkflowPreflight";
import { parseJsonBody, sendJson } from "../http.js";
import { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute } from "../router.js";
import { interruptDashboardRequest, isDashboardAbortError, registerDashboardRequest } from "../dashboardInterrupts.js";
import { channelMessagingRouteDefinitions } from "./channelMessagingRoutes.js";
import { chatSkillRouteDefinitions } from "./chatSkillRoutes.js";
import { messengerAdminRouteDefinitions } from "./messengerAdminRoutes.js";
import { speechRouteDefinitions } from "./speechRoutes.js";
import {
  createGameEngineExport,
  updateGameEngineExportStatus,
  type GameEngineResourceKind
} from "../gameEngines/exportQueue.js";
import {
  ensureUniqueUploadPath,
  extensionFromMime,
  mergePromptWithRandomLine,
  parseModel3dPostSettings,
  parseOptionalNumericInput,
  readImageWorkflowMetadata,
  resolveRemoveBackgroundWorkflowPath,
  resolveWorkflowPathOverridePath,
  resolveWorkspaceRelativePath,
  sanitizeImportedImageFileName
} from "../messagingAndModel/helpers.js";
import { parseBase64DataUrl } from "../chatSkills/executionHelpers.js";
import { parseIdentifiedImageObjects, type IdentifiedImageObjectPrompt } from "../messagingAndModel/imageObjectIdentification.js";
import { importWebsiteModelArchive } from "../model3d/websiteArchiveImport.js";

function parseTextSourceSelectionMode(value: unknown): "random" | "no-repeat" {
  return value === "no-repeat" ? "no-repeat" : "random";
}

function parseWorkflowInputOverrides(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const overrides: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = String(rawKey || "").trim();
    if (!key) {
      continue;
    }
    if (typeof rawValue === "string") {
      overrides[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "boolean") {
      overrides[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      overrides[key] = rawValue;
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function parseModel3dMultiViewImageInputs(value: unknown): Partial<Record<"front" | "back" | "left" | "right", string>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const inputs: Partial<Record<"front" | "back" | "left" | "right", string>> = {};
  for (const viewName of ["front", "back", "left", "right"] as const) {
    const imageInput = typeof raw[viewName] === "string" ? raw[viewName].trim() : "";
    if (imageInput) {
      inputs[viewName] = imageInput;
    }
  }
  return Object.keys(inputs).length > 0 ? inputs : undefined;
}

function parseAutoRigLandmarks(value: unknown): Record<string, [number, number, number]> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const landmarks: Record<string, [number, number, number]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!Array.isArray(entry) || entry.length !== 3) {
      continue;
    }
    const x = Number(entry[0]);
    const y = Number(entry[1]);
    const z = Number(entry[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }
    landmarks[key] = [x, y, z];
  }
  return Object.keys(landmarks).length > 0 ? landmarks : null;
}

function parseCaptureNumber(value: unknown, options: { min: number; max: number; integer?: boolean; }): number | undefined {
  const parsed = options.integer === false ? Number(value) : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(options.min, Math.min(options.max, parsed));
}

function parseCaptureBackgroundColor(value: unknown): string {
  const color = typeof value === "string" ? value.trim() : "";
  if (/^#[\da-f]{6}$/i.test(color)) {
    return color.toLowerCase();
  }
  const components = color.split(",").map(component => Number(component.trim()));
  if (components.length !== 3 || components.some(component => !Number.isFinite(component))) {
    return "";
  }
  return components.every(component => component >= 0 && component <= 255)
    ? components.map(component => Math.round(component)).join(",")
    : "";
}

function parseModel3dCaptureOptions(action: "rotate" | "delight", value: unknown): Record<string, string | number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const options: Record<string, string | number> = {};
  const width = parseCaptureNumber(raw.width, { min: 64, max: 4096 });
  const height = parseCaptureNumber(raw.height, { min: 64, max: 4096 });
  const quality = parseCaptureNumber(raw.quality, { min: 1, max: 100 });
  const zoom = parseCaptureNumber(raw.zoom, { min: 0.01, max: 10, integer: false });
  const degrees = parseCaptureNumber(raw.degrees, { min: 1, max: 3600, integer: false });
  const frames = parseCaptureNumber(raw.frames, { min: 2, max: 240 });
  const projection = raw.projection === "PERSP" ? "PERSP" : raw.projection === "ORTHO" ? "ORTHO" : "";
  const background = raw.background === "solidcolor" || raw.background === "skybox" ? raw.background : raw.background === "transparent" ? "transparent" : "";
  const bgColor = parseCaptureBackgroundColor(raw.bgColor);
  if (width !== undefined) options.width = width;
  if (height !== undefined) options.height = height;
  if (projection) options.projection = projection;
  if (zoom !== undefined) options.zoom = zoom;
  if (background) options.background = background;
  if (bgColor) options.bgColor = bgColor;
  if (action === "rotate") {
    const engine = raw.engine === "BLENDER_EEVEE_NEXT" || raw.engine === "CYCLES" || raw.engine === "BLENDER_WORKBENCH" ? raw.engine : "";
    const shading = raw.shading === "MATERIAL" ? "MATERIAL" : raw.shading === "TEXTURE" ? "TEXTURE" : "";
    const shadows = raw.shadows === "on" ? "on" : raw.shadows === "off" ? "off" : "";
    const rotateTarget = raw.rotateTarget === "camera" ? "camera" : raw.rotateTarget === "object" ? "object" : "";
    const axis = raw.axis === "X" || raw.axis === "Y" || raw.axis === "Z" ? raw.axis : "";
    if (quality !== undefined) options.quality = quality;
    if (engine) options.engine = engine;
    if (shading) options.shading = shading;
    if (shadows) options.shadows = shadows;
    if (rotateTarget) options.rotateTarget = rotateTarget;
    if (axis) options.axis = axis;
    if (degrees !== undefined) options.degrees = degrees;
    if (frames !== undefined) options.frames = frames;
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

function parseGameEngineResourceKind(value: unknown): GameEngineResourceKind | null {
  return value === "text" || value === "image" || value === "gif" || value === "model3d" || value === "video" || value === "audio" || value === "music" || value === "file"
    ? value
    : null;
}

function normalizeToolSourcePath(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/");
  try {
    return new URL(trimmed, "http://dashboard.local").pathname.replace(/^\/+/, "");
  } catch {
    return trimmed.replace(/^\/+/, "");
  }
}

async function resolveToolsRootDirectory(): Promise<string> {
  try {
    const entry = await stat(toolsRoot);
    if (entry.isDirectory()) {
      return toolsRoot;
    }
  } catch {
    throw new Error("Workspace tools directory was not found.");
  }
  throw new Error("Workspace tools directory was not found.");
}

async function resolveToolThumbnailDirectoryAsync(toolSourcePath: string): Promise<string> {
  const normalized = normalizeToolSourcePath(toolSourcePath);
  if (!normalized.startsWith("tools/")) {
    throw new Error("Tool source path must point inside the tools folder.");
  }
  const toolsRoot = await resolveToolsRootDirectory();
  const relativeToolPath = normalized.replace(/^tools\//, "");
  const sourceAbsolutePath = path.resolve(toolsRoot, relativeToolPath);
  const toolDirectory = path.basename(sourceAbsolutePath).toLowerCase() === "index.html"
    ? path.dirname(sourceAbsolutePath)
    : sourceAbsolutePath;
  const relative = path.relative(toolsRoot, toolDirectory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Tool thumbnail target must stay inside the tools folder.");
  }
  const toolDirectoryStat = await stat(toolDirectory);
  if (!toolDirectoryStat.isDirectory()) {
    throw new Error("Tool thumbnail target directory was not found.");
  }
  return toolDirectory;
}

function createToolThumbnailBackupName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `thumbnail.backup-${stamp}.png`;
}

async function handlePostApiModelImageUpload(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const requestedFileName = typeof body.fileName === "string" ? body.fileName.trim() : "model_source.png";
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    sendJson(response, 400, { error: "A valid image data URL is required." });
    return;
  }
  const mimeType = match[1] || "image/png";
  const base64Data = match[2] || "";
  if (!base64Data) {
    sendJson(response, 400, { error: "Image payload is empty." });
    return;
  }
  const stripMetadata = dependencies.runtimeState.getGlobalDashboardSettings().stripMetadataWebUiImages;
  let imageBytes: Uint8Array = Buffer.from(base64Data, "base64");
  let effectiveFileName = requestedFileName;
  if (stripMetadata) {
    imageBytes = await stripImageMetadataToPng(imageBytes);
    effectiveFileName = `${path.basename(requestedFileName, path.extname(requestedFileName)) || "model_source"}.png`;
  }
  const requestedExt = path.extname(effectiveFileName).toLowerCase();
  const fallbackExt = extensionFromMime(mimeType);
  const finalRequestedName = requestedExt
    ? effectiveFileName
    : `${path.basename(effectiveFileName, path.extname(effectiveFileName)) || "model_source"}${fallbackExt}`;
  const uploadTarget = await ensureUniqueUploadPath(finalRequestedName);
  await writeFile(uploadTarget.absolutePath, imageBytes);
  sendJson(response, 200, {
    fileName: uploadTarget.fileName,
    path: uploadTarget.absolutePath
  });
  return;
}

async function handlePostApiModel3dStartNotice(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
  const skipPromptResolution = body.skipPromptResolution === true;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!channelId || !imageInput) {
    sendJson(response, 400, { error: "channelId and imageInput are required." });
    return;
  }
  const posted = await dependencies.postModelGenerationStartNotice({
    channelId,
    imageInput,
    imageFileNameHint: imageFileNameHint || undefined,
    prompt: prompt || undefined,
    requestedBy: "dashboard"
  });
  dependencies.runtimeState.recordAction(
    "dashboard:model3d-start",
    `Posted source-image start notice for 3D generation in ${channelId}.`
  );
  sendJson(response, 200, {
    ok: true,
    messageId: posted.messageId,
    messageUrl: posted.messageUrl
  });
  return;
}

async function handlePostApiModel3dGenerate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
  const workflowPathOverride = typeof body.workflowPathOverride === "string" ? body.workflowPathOverride.trim() : "";
  const multiViewImageInputs = parseModel3dMultiViewImageInputs(body.multiViewImageInputs);
  const autoPrompt = body.autoPrompt === true;
  const askLlmIfModelShouldBeMetallic = body.askLlmIfModelShouldBeMetallic === true;
  const askLlmForRealWorldHeightAndScale = body.askLlmForRealWorldHeightAndScale === true;
  const legacyUseLlmMetadata = body.useLlmMetadata === true;
  const useLlmModelFileName = typeof body.useLlmModelFileName === "boolean" ? body.useLlmModelFileName : legacyUseLlmMetadata;
  const useLlmModelDescription = typeof body.useLlmModelDescription === "boolean" ? body.useLlmModelDescription : legacyUseLlmMetadata;
  const useLlmMetadata = useLlmModelFileName || useLlmModelDescription;
  const metadataTiming = body.metadataTiming === "before" || body.metadataTiming === "parallel"
    ? body.metadataTiming
    : "after";
  const metadataExecutionTarget = body.metadataExecutionTarget === "remote" ? "remote" : "local";
  const unloadLlmBeforeGenerate = typeof body.unloadLlmBeforeGenerate === "boolean" ? body.unloadLlmBeforeGenerate : undefined;
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const stripMetadata = typeof body.stripMetadata === "boolean" ? body.stripMetadata : undefined;
  const seed = parseOptionalNumericInput(body.seed, { min: 0, max: Number.MAX_SAFE_INTEGER });
  const streamEvents = body.streamEvents === true;
  const shouldPostToChannel = body.postToChannel === true;
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const modelPostSettings = parseModel3dPostSettings(body as Record<string, unknown>);
  if (!imageInput) {
    sendJson(response, 400, { error: "imageInput is required." });
    return;
  }
  if (shouldPostToChannel && !channelId) {
    sendJson(response, 400, { error: "channelId is required when postToChannel is true." });
    return;
  }
  const dashboardRequest = registerDashboardRequest({ requestId: body.dashboardRequestId, workflow: "model3d" });
  const generationJob = await createGenerationJob({kind: "model3d", executionTarget, requestId: dashboardRequest.requestId});
  await updateGenerationJob(generationJob.id, {status: "running"});
  const writeStreamEvent = (type: string, payload: unknown): void => {
    const eventPayload = typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? { type, ...(payload as Record<string, unknown>) }
      : { type, payload };
    response.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
  };
  if (streamEvents) {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    writeStreamEvent("status", { message: "3D generation started." });
  }
  try {
    const generated = await dependencies.generate3dModelFromImage({
      imageInput,
      imageFileNameHint: imageFileNameHint || undefined,
      workflowPathOverride: workflowPathOverride || undefined,
      multiViewImageInputs,
      seed,
      autoPrompt,
      askLlmIfModelShouldBeMetallic,
      askLlmForRealWorldHeightAndScale,
      useLlmMetadata,
      useLlmModelFileName,
      useLlmModelDescription,
      metadataTiming,
      metadataExecutionTarget,
      unloadLlmBeforeGenerate,
      executionTarget,
      stripMetadata,
      channelId: shouldPostToChannel ? channelId : null,
      postTargetMode: modelPostSettings.postTargetMode,
      threadNameMode: modelPostSettings.threadNameMode,
      threadName: modelPostSettings.threadName || undefined,
      threadNameBase: modelPostSettings.threadNameBase || undefined,
      modelNameSource: modelPostSettings.modelNameSource,
      forumChannelId: modelPostSettings.forumChannelId || undefined,
      forumChannelName: modelPostSettings.forumChannelName || undefined,
      lowPolyForumChannelId: modelPostSettings.lowPolyForumChannelId || undefined,
      lowPolyForumChannelName: modelPostSettings.lowPolyForumChannelName || undefined,
      extraContent: modelPostSettings.extraContent || undefined,
      initialExtraContent: modelPostSettings.initialExtraContent || undefined,
      sendInitialToSelectedChannel: modelPostSettings.sendInitialToSelectedChannel,
      modelUploadTarget: modelPostSettings.modelUploadTarget,
      includeModelFile: modelPostSettings.includeModelFile,
      includePreviewMedia: modelPostSettings.includePreviewMedia,
      includeEmbed: modelPostSettings.includeEmbed,
      includeEmbedInInitial: modelPostSettings.includeEmbedInInitial,
      includeButtons: modelPostSettings.includeButtons,
      uploadTextureMessages: modelPostSettings.uploadTextureMessages,
      uploadMultiViewTextures: modelPostSettings.uploadMultiViewTextures,
      uploadUvMapTextures: modelPostSettings.uploadUvMapTextures,
      uploadNormalMapTextures: modelPostSettings.uploadNormalMapTextures,
      textureUploadTarget: modelPostSettings.textureUploadTarget,
      generateLowPolyVersion: modelPostSettings.generateLowPolyVersion,
      lowPolyExecutionTarget: modelPostSettings.lowPolyExecutionTarget,
      lowPolyUseLlmTargetFaces: modelPostSettings.lowPolyUseLlmTargetFaces,
      lowPolyLlmDecisionSource: modelPostSettings.lowPolyLlmDecisionSource,
      lowPolyTargetFaceCount: modelPostSettings.lowPolyTargetFaceCount,
      onPromptQueued: dashboardRequest.markPromptQueued,
      signal: dashboardRequest.signal,
      onModelReady: streamEvents
        ? record => {
          writeStreamEvent("model-ready", { model: record });
        }
        : undefined
    });
    await updateGenerationJob(generationJob.id, {status: "succeeded", artifactId: generated.id});
    dependencies.runtimeState.recordAction(
      "dashboard:model3d",
      `Generated 3D model ${generated.id}${shouldPostToChannel ? ` and posted to ${channelId}` : ""}.`
    );
    if (streamEvents) {
      writeStreamEvent("done", { model: generated });
      response.end();
      return;
    }
    sendJson(response, 200, generated);
  } catch (error) {
    await updateGenerationJob(generationJob.id, {
      status: isDashboardAbortError(error) ? "cancelled" : "failed",
      error: error instanceof Error ? error.message : "3D model generation failed."
    });
    if (isDashboardAbortError(error)) {
      if (streamEvents) {
        writeStreamEvent("stopped", { message: "3D model generation stopped." });
        response.end();
        return;
      }
      sendJson(response, 499, { error: "3D model generation stopped." });
      return;
    }
    if (streamEvents) {
      const detail = error instanceof Error ? error.message : String(error);
      writeStreamEvent("error", { message: detail || "3D model generation failed." });
      response.end();
      return;
    }
    throw error;
  } finally {
    dashboardRequest.finish();
  }
  return;
}

async function handlePostApiModel3dLowPolyUpload(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const requestedFileName = typeof body.fileName === "string" ? body.fileName.trim() : "uploaded-model.glb";
  const useLlmTargetFaces = body.llmTargetFaces === true;
  const targetFaceCount = typeof body.targetFaces === "number" && Number.isFinite(body.targetFaces)
    ? Math.max(1, Math.round(body.targetFaces))
    : undefined;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const parsedDataUrl = parseBase64DataUrl(dataUrl);
  if (!parsedDataUrl) {
    sendJson(response, 400, { error: "A valid base64 data URL is required." });
    return;
  }
  const fileData = Buffer.from(parsedDataUrl.base64Data, "base64");
  if (fileData.length === 0) {
    sendJson(response, 400, { error: "Uploaded model payload is empty." });
    return;
  }
  try {
    const generated = await dependencies.generateLowPolyFromUploadedModel({
      fileName: requestedFileName,
      fileData,
      contentType: parsedDataUrl.mimeType,
      useLlmTargetFaces,
      targetFaceCount,
      prompt: prompt || undefined,
      context: context || undefined
    });
    dependencies.runtimeState.recordAction(
      "dashboard:model3d-lowpoly-upload",
      `Generated uploaded low poly model ${generated.generated.id} (${generated.targetFaceCount} faces).`
    );
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    const detail = error instanceof Error
      ? (error.message?.trim() || "Uploaded low poly generation failed.")
      : (String(error).trim() || "Uploaded low poly generation failed.");
    console.error("Dashboard uploaded low poly generation failed:", {
      fileName: requestedFileName,
      contentType: parsedDataUrl.mimeType,
      fileSizeBytes: fileData.length,
      llmTargetFaces: useLlmTargetFaces,
      targetFaceCount,
      prompt,
      context,
      detail,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(detail);
  }
}
async function handlePostApiModel3dInspect(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const variant = body.variant === "original" || body.variant === "lowpoly" || body.variant === "albedo" ? body.variant : "merged";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.inspectGeneratedModel({
    modelId,
    variant,
    executionTarget
  }));
  return;
}
async function handlePostApiModel3dValidate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const variant = body.variant === "original" || body.variant === "lowpoly" ? body.variant : "merged";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  sendJson(response, 200, await dependencies.validateGeneratedModel({
    modelId,
    variant,
    executionTarget
  }));
  return;
}
async function handlePostApiModel3dIndex(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  sendJson(response, 200, await dependencies.indexGeneratedModelAssets({ executionTarget }));
  return;
}
async function handlePostApiModel3dCapture(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const action = body.action === "delight" ? "delight" : body.action === "rotate" ? "rotate" : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const variant = body.variant === "original" || body.variant === "lowpoly" ? body.variant : "merged";
  const captureOptions = action ? parseModel3dCaptureOptions(action, body.captureOptions) : undefined;
  if (!modelId || !action) {
    sendJson(response, 400, { error: "modelId and action are required." });
    return;
  }
  const captured = await dependencies.captureGeneratedModelArtifact({
    modelId,
    variant,
    action,
    executionTarget,
    options: captureOptions
  });
  const imported = await dependencies.importGeneratedImage({
    imageFileName: captured.fileName,
    imageData: captured.data,
    prompt: action === "rotate" ? "3D model rotate capture" : "3D model delight capture",
    model: action === "rotate" ? "Blender Rotate Capture" : "Blender Delight Capture",
    metadata: {
      sourceKind: "model3d-capture",
      sourceModelId: modelId,
      captureAction: action
    }
  });
  dependencies.runtimeState.recordAction(
    "dashboard:model3d-capture",
    `Captured ${action} image ${imported.id} from model ${modelId}.`
  );
  sendJson(response, 200, imported);
  return;
}
async function handlePostApiMediaProbe(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request) as Record<string, unknown>;
  const assetKind = body.assetKind === "audio" || body.assetKind === "video" ? body.assetKind : body.assetKind === "image" ? "image" : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  if (!assetKind || !fileName) {
    sendJson(response, 400, { error: "assetKind and fileName are required." });
    return;
  }
  sendJson(response, 200, await dependencies.probeMediaAsset({
    assetKind,
    imageId: typeof body.imageId === "string" ? body.imageId.trim() : undefined,
    audioId: typeof body.audioId === "string" ? body.audioId.trim() : undefined,
    videoId: typeof body.videoId === "string" ? body.videoId.trim() : undefined,
    fileName,
    executionTarget
  }));
  return;
}
async function handlePostApiModel3dSeparateByLooseParts(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const exportMode = body.exportMode === "single_file" ? "single_file" : "per_part";
  const mergeDistance = typeof body.mergeDistance === "number" && Number.isFinite(body.mergeDistance)
    ? Math.max(0, body.mergeDistance)
    : undefined;
  const context = typeof body.context === "string" ? body.context.trim() : "";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  try {
    const generated = await dependencies.applyModelSeparateByLooseParts({
      modelId,
      executionTarget,
      exportMode,
      mergeDistance
    });
    dependencies.runtimeState.recordAction(
      "dashboard:model3d-separate-by-loose-parts",
      `Applied Separate By Loose Parts to ${modelId} (${exportMode}).`
    );
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    const detail = error instanceof Error
      ? (error.message?.trim() || "Separate By Loose Parts follow-up failed.")
      : (String(error).trim() || "Separate By Loose Parts follow-up failed.");
    console.error("Dashboard Separate By Loose Parts follow-up failed:", {
      modelId,
      executionTarget,
      context,
      detail,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(detail);
  }
}

async function handlePostApiModel3dAlbedoToGeometry(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const strength = typeof body.strength === "number" && Number.isFinite(body.strength) ? Math.max(0, Math.min(10, body.strength)) : undefined;
  const subdivisions = typeof body.subdivisions === "number" && Number.isFinite(body.subdivisions) ? Math.max(0, Math.min(8, Math.round(body.subdivisions))) : undefined;
  const topologyMode = body.topologyMode === "multiresolution" ? "multiresolution" : "subdivision";
  const blur = typeof body.blur === "number" && Number.isFinite(body.blur) ? Math.max(0, Math.min(10, Math.round(body.blur))) : undefined;
  const mergeDistance = typeof body.mergeDistance === "number" && Number.isFinite(body.mergeDistance) ? Math.max(0, Math.min(0.1, body.mergeDistance)) : undefined;
  const sourceVariant = body.sourceVariant === "original" || body.sourceVariant === "lowpoly" || body.sourceVariant === "albedo"
    ? body.sourceVariant
    : "merged";
  try {
    const generated = await dependencies.applyModelAlbedoToGeometry({
      modelId,
      sourceVariant,
      strength,
      subdivisions,
      topologyMode,
      blur,
      autoSmooth: body.autoSmooth !== false,
      selectedFacesOnly: body.selectedFacesOnly === true,
      mergeBeforeSubdivide: body.mergeBeforeSubdivide !== false,
      mergeAfterSubdivide: body.mergeAfterSubdivide !== false,
      mergeDistance
    });
    dependencies.runtimeState.recordAction(
      "dashboard:model3d-albedo-to-geometry",
      `Applied albedo-to-geometry to ${modelId}.`
    );
    sendJson(response, 200, generated);
  } catch (error) {
    const detail = error instanceof Error
      ? (error.message?.trim() || "Albedo-to-geometry failed.")
      : (String(error).trim() || "Albedo-to-geometry failed.");
    console.error("Dashboard albedo-to-geometry failed:", { modelId, detail, stack: error instanceof Error ? error.stack : undefined });
    throw new Error(detail);
  }
}

async function handlePostApiModel3dLowPolyGenerate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const useLlmTargetFaces = body.llmTargetFaces === true;
  const lowPolyLlmDecisionSource = body.llmDecisionSource === "model-render" ? "model-render" : "input-image";
  const targetFaceCount = typeof body.targetFaces === "number" && Number.isFinite(body.targetFaces)
    ? Math.max(1, Math.round(body.targetFaces))
    : undefined;
  const llmMinTargetFaceCount = typeof body.llmMinTargetFaces === "number" && Number.isFinite(body.llmMinTargetFaces)
    ? Math.max(1, Math.round(body.llmMinTargetFaces))
    : undefined;
  const llmMaxTargetFaceCount = typeof body.llmMaxTargetFaces === "number" && Number.isFinite(body.llmMaxTargetFaces)
    ? Math.max(llmMinTargetFaceCount ?? 1, Math.round(body.llmMaxTargetFaces))
    : undefined;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  try {
    const generated = await dependencies.generateLowPolyForModel({
      modelId,
      useLlmTargetFaces,
      targetFaceCount,
      llmMinTargetFaceCount,
      llmMaxTargetFaceCount,
      executionTarget,
      llmDecisionSource: lowPolyLlmDecisionSource,
      prompt: prompt || undefined,
      context: context || undefined
    });
    dependencies.runtimeState.recordAction(
      "dashboard:model3d-lowpoly-generate",
      `Generated low poly follow-up for ${modelId} (${generated.targetFaceCount} faces).`
    );
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    const detail = error instanceof Error
      ? (error.message?.trim() || "Low poly follow-up failed.")
      : (String(error).trim() || "Low poly follow-up failed.");
    console.error("Dashboard low poly follow-up failed:", {
      modelId,
      executionTarget,
      llmTargetFaces: useLlmTargetFaces,
      llmDecisionSource: lowPolyLlmDecisionSource,
      targetFaceCount,
      prompt,
      context,
      detail,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(detail);
  }
}

async function handlePostApiModel3dGenerateLods(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const targetFaceCounts = Array.isArray(body.targetFaceCounts)
    ? body.targetFaceCounts.map(value => Number(value)).filter(value => Number.isFinite(value) && value > 0)
    : [];
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  if (executionTarget === "remote") {
    sendJson(response, 400, { error: "LOD generation currently requires the local Blender runtime." });
    return;
  }
  if (targetFaceCounts.length === 0) {
    sendJson(response, 400, { error: "targetFaceCounts must include at least one positive number." });
    return;
  }
  try {
    const generated = await generateGeneratedModelLods({ modelId, targetFaceCounts });
    dependencies.runtimeState.recordAction(
      "dashboard:model3d-generate-lods",
      `Generated ${generated.lodArtifacts.length} LODs for ${modelId}.`
    );
    sendJson(response, 200, generated);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Dashboard LOD generation failed:", { modelId, detail, stack: error instanceof Error ? error.stack : undefined });
    throw new Error(detail || "LOD generation failed.");
  }
}

async function handlePostApiModel3dAutoRig(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const rigProfile = typeof body.rigProfile === "string" ? body.rigProfile.trim() : "auto";
  const useVision = typeof body.useVision === "boolean" ? body.useVision : true;
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const landmarks = parseAutoRigLandmarks(body.landmarks);
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  try {
    const generated = await dependencies.applyAutoRigToModel({
      modelId,
      rigProfile: rigProfile || "auto",
      useVision,
      landmarks,
      executionTarget
    });
    dependencies.runtimeState.recordAction(
      "dashboard:model3d-autorig",
      `Applied AutoRig to ${modelId} (${rigProfile || "auto"}).`
    );
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    const detail = error instanceof Error
      ? (error.message?.trim() || "AutoRig failed.")
      : (String(error).trim() || "AutoRig failed.");
    console.error("Dashboard AutoRig failed:", {
      modelId,
      rigProfile,
      useVision,
      executionTarget,
      landmarkCount: landmarks ? Object.keys(landmarks).length : 0,
      detail,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(detail);
  }
}

async function handlePostApiModel3dAutoRigPreview(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const rigProfile = typeof body.rigProfile === "string" ? body.rigProfile.trim() : "auto";
  const useVision = typeof body.useVision === "boolean" ? body.useVision : true;
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const landmarks = parseAutoRigLandmarks(body.landmarks);
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  try {
    const preview = await dependencies.previewAutoRigForModel({
      modelId,
      rigProfile: rigProfile || "auto",
      useVision,
      landmarks,
      executionTarget
    });
    dependencies.runtimeState.recordAction(
      "dashboard:model3d-autorig-preview",
      `Prepared AutoRig verification preview for ${modelId} (${preview.rigProfile || rigProfile || "auto"}).`
    );
    sendJson(response, 200, preview);
    return;
  } catch (error) {
    const detail = error instanceof Error
      ? (error.message?.trim() || "AutoRig preview failed.")
      : (String(error).trim() || "AutoRig preview failed.");
    console.error("Dashboard AutoRig preview failed:", {
      modelId,
      rigProfile,
      useVision,
      executionTarget,
      detail,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(detail);
  }
}

async function handlePostApiBlenderOpenModel(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const variant = body.variant === "lowpoly" || body.variant === "original" ? body.variant : "current";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  try {
    const result = await dependencies.openGeneratedModelInBlender({
      modelId,
      variant,
      fileName: fileName || undefined,
      executionTarget
    });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Failed to open model in Blender." });
  }
}

async function handlePostApiBlenderOpenModels(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems.map(item => ({
    modelId: typeof item?.modelId === "string" ? item.modelId.trim() : "",
    variant: item?.variant === "lowpoly" || item?.variant === "original" ? item.variant : "current",
    fileName: typeof item?.fileName === "string" ? item.fileName.trim() : undefined
  })).filter(item => item.modelId);
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  if (items.length === 0) {
    sendJson(response, 400, { error: "items are required." });
    return;
  }
  try {
    const result = await dependencies.openGeneratedModelsInBlender({ items, executionTarget });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Failed to open models in Blender." });
  }
}

async function handlePostApiBlenderOpenImage(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageId = typeof body.imageId === "string" ? body.imageId.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  try {
    if (imageId) {
      const result = await dependencies.openGeneratedImageInBlender({ imageId, fileName: fileName || undefined, executionTarget });
      sendJson(response, 200, result);
      return;
    }
    if (imageDataUrl) {
      const result = await dependencies.openImageDataInBlender({
        dataUrl: imageDataUrl,
        fileName: fileName || undefined,
        label: fileName || "Image Studio import",
        executionTarget
      });
      sendJson(response, 200, result);
      return;
    }
    sendJson(response, 400, { error: "Provide imageId or imageDataUrl." });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Failed to import image into Blender." });
  }
}

async function handlePostApiBlenderOpenImages(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems.map(item => ({
    imageId: typeof item?.imageId === "string" ? item.imageId.trim() : undefined,
    imageDataUrl: typeof item?.imageDataUrl === "string" ? item.imageDataUrl.trim() : undefined,
    fileName: typeof item?.fileName === "string" ? item.fileName.trim() : undefined,
    label: typeof item?.label === "string" ? item.label.trim() : undefined
  })).filter(item => item.imageId || item.imageDataUrl);
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  if (items.length === 0) {
    sendJson(response, 400, { error: "items are required." });
    return;
  }
  try {
    const result = await dependencies.openImagesInBlender({ items, executionTarget });
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Failed to import images into Blender." });
  }
}

async function handlePostApiModel3dSuggestMetadata(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const preferVisualModel = body.preferVisualModel === true;
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const suggestion = await dependencies.suggestModelMetadata({
    prompt: prompt || undefined,
    imageInput: imageInput || undefined,
    preferVisualModel,
    executionTarget
  });
  sendJson(response, 200, suggestion);
  return;
}

async function handleGetApiImageWorkflowMetadata(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const workflowPath = url.searchParams.get("workflowPath")?.trim() || "";
  const resolvedWorkflowPath = workflowPath ? await resolveWorkflowPathOverridePath(workflowPath) : await resolveWorkspaceRelativePath("comfyui-workflows/image/image_qwen_image.json");
  if (!resolvedWorkflowPath) {
    sendJson(response, 404, { error: "Image workflow not found." });
    return;
  }
  const metadata = await readImageWorkflowMetadata(resolvedWorkflowPath);
  sendJson(response, 200, {
    workflowPath: resolvedWorkflowPath,
    width: metadata?.width ?? null,
    height: metadata?.height ?? null,
    seed: metadata?.seed ?? null,
    steps: metadata?.steps ?? null,
    cfg: metadata?.cfg ?? null,
    usesSubgraphs: metadata?.usesSubgraphs === true,
    nodeTypes: metadata?.nodeTypes ?? []
  });
  dependencies.runtimeState.recordAction("dashboard:image-workflow", `Read image workflow metadata from ${path.basename(resolvedWorkflowPath)}.`);
  return;
}
async function handleGetApiImageWorkflowPreflight(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const workflowPath = url.searchParams.get("workflowPath")?.trim() || "";
  const resolvedWorkflowPath = workflowPath ? await resolveWorkflowPathOverridePath(workflowPath) : await resolveWorkspaceRelativePath("comfyui-workflows/image/image_qwen_image.json");
  if (!resolvedWorkflowPath) {
    sendJson(response, 404, { error: "Image workflow not found." });
    return;
  }
  const metadata = await readImageWorkflowMetadata(resolvedWorkflowPath);
  const preflight = await preflightComfyImageWorkflowNodeTypes(metadata?.nodeTypes ?? [], metadata?.modelFileInputs ?? []);
  sendJson(response, 200, {
    workflowPath: resolvedWorkflowPath,
    usesSubgraphs: metadata?.usesSubgraphs === true,
    requiredNodeTypes: metadata?.nodeTypes ?? [],
    requiredModelFiles: metadata?.modelFileInputs.map(input => input.modelFile) ?? [],
    ...preflight
  });
  dependencies.runtimeState.recordAction("dashboard:image-workflow-preflight", `Validated ComfyUI nodes for ${path.basename(resolvedWorkflowPath)}.`);
  return;
}
async function handlePostApiModel3dEdit(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "uploaded-model.glb";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const dimensionMode = body.dimensionMode === "llm" || body.dimensionMode === "manual" ? body.dimensionMode : "keep";
  const targetHeightMeters = typeof body.targetHeightMeters === "number" && Number.isFinite(body.targetHeightMeters)
    ? Math.max(0.03, Math.min(4000, body.targetHeightMeters))
    : undefined;
  const metallicMode = body.metallicMode === "enable" || body.metallicMode === "disable" ? body.metallicMode : "keep";
  const roughnessMode = body.roughnessMode === "set" ? "set" : "keep";
  const roughnessValue = typeof body.roughnessValue === "number" && Number.isFinite(body.roughnessValue)
    ? Math.max(0, Math.min(1, body.roughnessValue))
    : undefined;
  const metallicEnabled = metallicMode === "keep" ? null : metallicMode === "enable";
  const shouldScaleWithLlm = dimensionMode === "llm";
  const shouldScaleManually = dimensionMode === "manual" && typeof targetHeightMeters === "number";
  const shouldApplyMaterial = typeof metallicEnabled === "boolean" || (roughnessMode === "set" && typeof roughnessValue === "number");
  if (!modelId && !dataUrl) {
    sendJson(response, 400, { error: "modelId or uploaded model dataUrl is required." });
    return;
  }
  if (!shouldScaleWithLlm && !shouldScaleManually && !shouldApplyMaterial) {
    sendJson(response, 400, { error: "Choose at least one edit action for dimension, metallic, or roughness." });
    return;
  }
  if (modelId) {
    const result = await dependencies.editGeneratedModel({
      modelId,
      prompt: prompt || undefined,
      context: context || undefined,
      useLlmHeight: shouldScaleWithLlm,
      targetHeightMeters: shouldScaleManually ? targetHeightMeters : undefined,
      executionTarget,
      metallicEnabled,
      roughnessValue: roughnessMode === "set" ? roughnessValue : null
    });
    sendJson(response, 200, result);
    return;
  }
  const parsedDataUrl = parseBase64DataUrl(dataUrl);
  if (!parsedDataUrl) {
    sendJson(response, 400, { error: "A valid uploaded model data URL is required." });
    return;
  }
  const fileData = Buffer.from(parsedDataUrl.base64Data, "base64");
  const result = await dependencies.editUploadedModel({
    fileName,
    fileData,
    contentType: parsedDataUrl.mimeType,
    prompt: prompt || undefined,
    context: context || undefined,
    useLlmHeight: shouldScaleWithLlm,
    targetHeightMeters: shouldScaleManually ? targetHeightMeters : undefined,
    executionTarget,
    metallicEnabled,
    roughnessValue: roughnessMode === "set" ? roughnessValue : null
  });
  sendJson(response, 200, result);
  return;
}
async function handlePostApiModel3dTexture(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const meshDataUrl = typeof body.meshDataUrl === "string" ? body.meshDataUrl.trim() : "";
  const meshFileName = typeof body.meshFileName === "string" ? body.meshFileName.trim() : "textured-model.glb";
  const sourceImageDataUrl = typeof body.sourceImageDataUrl === "string" ? body.sourceImageDataUrl.trim() : "";
  const sourceImageFileName = typeof body.sourceImageFileName === "string" ? body.sourceImageFileName.trim() : "texture-source.png";
  if (!sourceImageDataUrl || (!modelId && !meshDataUrl)) {
    sendJson(response, 400, { error: "Choose one 3D model and one source image for texturing." });
    return;
  }
  let meshInput = meshDataUrl;
  let resolvedMeshFileName = meshFileName;
  if (modelId) {
    const model = (await dependencies.listGeneratedModels()).find(entry => entry.id === modelId);
    if (!model) {
      sendJson(response, 404, { error: "The selected 3D model no longer exists." });
      return;
    }
    const modelFile = await dependencies.readGeneratedModelFile(model.id, model.modelFileName);
    meshInput = `data:${modelFile.contentType};base64,${modelFile.data.toString("base64")}`;
    resolvedMeshFileName = model.modelFileName;
  }
  const generated = await dependencies.generate3dModelFromImage({
    imageInput: sourceImageDataUrl,
    imageFileNameHint: sourceImageFileName,
    meshInput,
    meshFileNameHint: resolvedMeshFileName,
    workflowPathOverride: "comfyui-workflows/3d/3dmodel_edit.json",
    workflowImageInputNodeId: "247",
    workflowMeshInputNodeId: "252",
    workflowOutputNodeId: "296",
    workflowPreviewNodeId: "294",
    autoPrompt: false,
    executionTarget: "local"
  });
  sendJson(response, 200, { generated });
}
async function handlePostApiModel3dWebsiteImport(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await parseJsonBody(request);
  const downloadUrl = typeof body.downloadUrl === "string" ? body.downloadUrl.trim() : "";
  const modelName = typeof body.modelName === "string" ? body.modelName.trim().slice(0, 120) : "Sketchfab model";
  if (!downloadUrl) {
    sendJson(response, 400, { error: "A one-time URage.net model download URL is required." });
    return;
  }
  sendJson(response, 200, { imported: await importWebsiteModelArchive({ downloadUrl, modelName }) });
}
async function handlePostApiModel3dSuggestLowPoly(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const preferVisualModel = body.preferVisualModel === true;
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const suggestion = await dependencies.suggestLowPolyTargetFaceCount({
    prompt: prompt || undefined,
    imageInput: imageInput || undefined,
    context: context || undefined,
    preferVisualModel,
    executionTarget
  });
  sendJson(response, 200, suggestion);
  return;
}

async function handlePostApiComfyFree(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const unloadModels = typeof body.unloadModels === "boolean" ? body.unloadModels : true;
  const freeMemory = typeof body.freeMemory === "boolean" ? body.freeMemory : true;
  await dependencies.freeComfyUiMemory({ unloadModels, freeMemory });
  dependencies.runtimeState.recordAction("dashboard:comfy-free", `unload=${unloadModels} free=${freeMemory}`);
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiLlmEjectActive(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const result = await dependencies.ejectActiveLlmModels(executionTarget);
  dependencies.runtimeState.recordAction(
    "dashboard:llm-eject",
    `target=${executionTarget} attempted=${result.attempted.length} unloaded=${result.unloaded.length} failed=${result.failed.length}`
  );
  sendJson(response, 200, result);
  return;
}
async function handlePostApiLlmLoadActive(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const executionTarget = body.executionTarget === "remote" ? "remote" : "local";
  const scope = body.scope === "text" || body.scope === "vision" ? body.scope : "both";
  const textModel = typeof body.textModel === "string" ? body.textModel : undefined;
  const visionModel = typeof body.visionModel === "string" ? body.visionModel : undefined;
  if (textModel || visionModel) {
    dependencies.setActiveOllamaModels({ textModel, visionModel });
  }
  const contextLength = typeof body.contextLength === "number" && Number.isFinite(body.contextLength)
    ? Math.max(0, Math.round(body.contextLength))
    : undefined;
  const result = await dependencies.loadActiveLlmModels({
    executionTarget,
    scope,
    textModel,
    visionModel,
    contextLength
  });
  dependencies.runtimeState.recordAction(
    "dashboard:llm-load",
    `target=${executionTarget} scope=${scope} ctx=${contextLength ?? 0} attempted=${result.attempted.length} loaded=${result.loaded.length} failed=${result.failed.length}`
  );
  sendJson(response, 200, result);
  return;
}

async function handlePostApiImageGenerate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  let dashboardRequest: ReturnType<typeof registerDashboardRequest> | null = null;
  let generationJobId = "";
  try {
    const body = await parseJsonBody(request);
    dashboardRequest = registerDashboardRequest({ requestId: body.dashboardRequestId, workflow: "image" });
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const promptTextFile = typeof body.promptTextFile === "string" ? body.promptTextFile.trim() : "";
    const promptTextSelectionMode = parseTextSourceSelectionMode(body.promptTextSelectionMode);
    const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt.trim() : "";
    const autoPrompt = body.autoPrompt === true;
    const autoFileName = typeof body.autoFileName === "boolean" ? body.autoFileName : undefined;
    const autoDescription = typeof body.autoDescription === "boolean" ? body.autoDescription : undefined;
    const autoFileNameTiming = body.autoFileNameTiming === "before" || body.autoFileNameTiming === "parallel"
      ? body.autoFileNameTiming
      : "after";
    const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
    const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
    const workflowPathOverride = typeof body.workflowPathOverride === "string" ? body.workflowPathOverride.trim() : "";
    const workflowInputOverrides = parseWorkflowInputOverrides(body.workflowInputOverrides);
    const preserveEmptyPrompt = body.preserveEmptyPrompt === true;
    const skipPromptResolution = body.skipPromptResolution === true;
    const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
    const overwriteImageId = typeof body.overwriteImageId === "string" ? body.overwriteImageId.trim() : "";
    const width = parseOptionalNumericInput(body.width, { min: 64, max: 4096 });
    const height = parseOptionalNumericInput(body.height, { min: 64, max: 4096 });
    const seed = parseOptionalNumericInput(body.seed, { min: 0, max: Number.MAX_SAFE_INTEGER });
    const steps = parseOptionalNumericInput(body.steps, { min: 1, max: 250 });
    const cfg = parseOptionalNumericInput(body.cfg, { min: 0, max: 30, integer: false });
    const stripMetadata = typeof body.stripMetadata === "boolean"
      ? body.stripMetadata
      : dependencies.runtimeState.getGlobalDashboardSettings().stripMetadataWebUiImages;
    let resolvedPrompt = prompt;
    if (promptTextFile) {
      try {
        const randomLine = await readAutomationTextSourceLine(promptTextFile, promptTextSelectionMode);
        resolvedPrompt = mergePromptWithRandomLine(prompt, randomLine);
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to load prompt text file." });
        return;
      }
    }
    let resolvedWorkflowPathOverride = "";
    if (workflowPathOverride) {
      const resolved = await resolveWorkflowPathOverridePath(workflowPathOverride);
      if (!resolved) {
        sendJson(response, 400, { error: `workflowPathOverride not found: ${workflowPathOverride}` });
        return;
      }
      resolvedWorkflowPathOverride = resolved;
    }
    if (overwriteImageId) {
      const existingImage = (await dependencies.listGeneratedImages()).find(entry => entry.id === overwriteImageId);
      if (!existingImage) {
        sendJson(response, 404, { error: "The image selected for overwrite was not found." });
        return;
      }
    }
    const generationJob = await createGenerationJob({
      kind: "image",
      executionTarget: appConfig.imageExecutionMode,
      requestId: dashboardRequest.requestId
    });
    generationJobId = generationJob.id;
    await updateGenerationJob(generationJobId, {status: "running"});
    const generated = await dependencies.generateImageFromPrompt({
      prompt: resolvedPrompt || undefined,
      negativePrompt: negativePrompt || undefined,
      autoPrompt,
      autoFileName,
      autoDescription,
      autoFileNameTiming,
      imageInput: imageInput || undefined,
      imageFileNameHint: imageFileNameHint || undefined,
      workflowPathOverride: resolvedWorkflowPathOverride || undefined,
      workflowInputOverrides,
      preserveEmptyPrompt,
      skipPromptResolution,
      width,
      height,
      seed,
      steps,
      cfg,
      channelId: channelId || null,
      requestedBy: "dashboard",
      stripMetadata,
      onPromptQueued: dashboardRequest.markPromptQueued,
      signal: dashboardRequest.signal
    });
    if (overwriteImageId) {
      const generatedFile = await dependencies.readGeneratedImageFile(generated.id, generated.imageFileName);
      await dependencies.deleteGeneratedImage(overwriteImageId);
      const overwritten = await dependencies.importGeneratedImage({
        desiredId: overwriteImageId,
        imageFileName: generated.imageFileName,
        imageData: generatedFile.data,
        prompt: generated.prompt,
        description: generated.description,
        width: generated.width || undefined,
        height: generated.height || undefined,
        seed: generated.seed,
        steps: generated.steps,
        cfg: generated.cfg,
        model: generated.model,
        metadata: {
          ...(generated.metadata || {}),
          overwrittenFromGeneratedImageId: generated.id,
          overwrittenAt: new Date().toISOString()
        }
      });
      if (generated.id !== overwriteImageId) {
        await dependencies.deleteGeneratedImage(generated.id);
      }
      dependencies.runtimeState.recordAction(
        "dashboard:image",
        `Overwrote generated image ${overwriteImageId}${channelId ? ` and posted to ${channelId}` : ""}.`
      );
      await updateGenerationJob(generationJobId, {status: "succeeded", artifactId: overwritten.id});
      sendJson(response, 200, overwritten);
      return;
    }
    dependencies.runtimeState.recordAction(
      "dashboard:image",
      `Generated image ${generated.id}${channelId ? ` and posted to ${channelId}` : ""}.`
    );
    await updateGenerationJob(generationJobId, {status: "succeeded", artifactId: generated.id});
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    if (generationJobId) {
      await updateGenerationJob(generationJobId, {
        status: isDashboardAbortError(error) ? "cancelled" : "failed",
        error: error instanceof Error ? error.message : "Image generation failed."
      });
    }
    sendJson(response, isDashboardAbortError(error) ? 499 : 500, {
      error: isDashboardAbortError(error) ? "Image generation stopped." : (error instanceof Error ? error.message : "Image generation failed.")
    });
    return;
  } finally {
    dashboardRequest?.finish();
  }
}
async function handlePostApiImageRemoveBackground(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!imageInput) {
    sendJson(response, 400, { error: "imageInput is required." });
    return;
  }
  const selectedWorkflow = await resolveRemoveBackgroundWorkflowPath(mode);
  const generated = await dependencies.generateImageFromPrompt({
    prompt: selectedWorkflow.mode === "source" ? "" : "remove background, transparent background",
    imageInput,
    imageFileNameHint,
    workflowPathOverride: selectedWorkflow.workflowPath,
    skipPromptResolution: true,
    autoPrompt: false,
    autoFileName: false
  });
  dependencies.runtimeState.recordAction(
    "dashboard:image-remove-background",
    `Removed background from image with ${selectedWorkflow.mode} workflow -> ${generated.id}.`
  );
  sendJson(response, 200, {
    ...generated,
    workflowMode: selectedWorkflow.mode,
    workflowPath: selectedWorkflow.workflowPath
  });
  return;
}
async function handlePostApiImageInterpretPrompt(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const detailMode = body.detailMode === "precise" || body.detailMode === "vague" ? body.detailMode : "normal";
  const direction = typeof body.direction === "string" ? body.direction.trim() : "";
  if (!imageInput) {
    sendJson(response, 400, { error: "imageInput is required." });
    return;
  }
  const resolvedPrompt = await dependencies.resolveImagePromptFromBaseImage({
    imageInput,
    prompt: prompt || undefined,
    detailMode,
    direction: direction || undefined
  });
  dependencies.runtimeState.recordAction(
    "dashboard:image-interpret-prompt",
    `Interpreted ${imageFileNameHint || "source image"} into an image prompt.`
  );
  sendJson(response, 200, { prompt: resolvedPrompt });
  return;
}
async function handlePostApiImageRewritePrompt(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const currentPrompt = typeof body.currentPrompt === "string" ? body.currentPrompt.trim() : "";
  const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt.trim() : "";
  const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
  const sourceLanguage = typeof body.sourceLanguage === "string" ? body.sourceLanguage.trim() : "";
  const targetLanguage = typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : "";
  const mode = body.mode === "add" || body.mode === "replace" || body.mode === "translate" ? body.mode : "improve";
  if (!currentPrompt) {
    sendJson(response, 400, { error: "currentPrompt is required." });
    return;
  }
  if (mode !== "improve" && mode !== "translate" && !instructions) {
    sendJson(response, 400, { error: "instructions are required for prompt changes." });
    return;
  }
  if (mode === "translate" && !targetLanguage) {
    sendJson(response, 400, { error: "targetLanguage is required for prompt translation." });
    return;
  }
  const modeInstruction = mode === "replace"
    ? "Apply the requested replacements. Replace only the specified parts and preserve unrelated details."
    : mode === "add"
      ? "Integrate the requested additions while preserving the existing subject and visual direction."
      : mode === "translate"
        ? "Translate the prompt into the requested language while preserving its meaning, structure, and image-generation usefulness. Do not add, remove, or reinterpret prompt details."
        : "Strengthen the prompt while preserving its core subject and intent. Add useful visual details, composition, lighting, materials, camera, or style cues.";
  const taskPrompt = [
    mode === "translate" ? "Translate one image-generation prompt." : "Rewrite one image-generation prompt.",
    "Return plain prompt text only. Do not use markdown, quotes, labels, or explanations.",
    modeInstruction,
    "Keep the result coherent, visually specific, and suitable for image generation.",
    "Do not move negative prompt content into the positive prompt.",
    mode === "translate" && sourceLanguage ? "Source language: " + sourceLanguage : "",
    mode === "translate" ? "Target language: " + targetLanguage : "",
    "Current prompt: " + currentPrompt,
    instructions ? "Requested changes: " + instructions : "",
    negativePrompt ? "Negative prompt context to avoid: " + negativePrompt : ""
  ].filter(Boolean).join("\n");
  const rewrittenPrompt = (await dependencies.askModel(taskPrompt)).trim().replace(/^[\"'`]+|[\"'`]+$/g, "");
  if (!rewrittenPrompt) {
    sendJson(response, 502, { error: "The text model returned an empty prompt." });
    return;
  }
  dependencies.runtimeState.recordAction(
    "dashboard:image-rewrite-prompt",
    mode === "translate"
      ? `Translated an Image Studio prompt to ${targetLanguage} without chat context.`
      : `Rewrote an Image Studio prompt in ${mode} mode without chat context.`
  );
  sendJson(response, 200, { prompt: rewrittenPrompt });
  return;
}
async function handlePostApiImageIdentifyObjects(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageInput = typeof body.imageInput === "string" ? body.imageInput.trim() : "";
  const imageFileNameHint = typeof body.imageFileNameHint === "string" ? body.imageFileNameHint.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const direction = typeof body.direction === "string" ? body.direction.trim() : "";
  const maxObjects = parseOptionalNumericInput(body.maxObjects, { min: 1, max: 20 }) || 5;
  if (!imageInput) {
    sendJson(response, 400, { error: "imageInput is required." });
    return;
  }
  const instruction = [
    "Identify distinct visible objects in the attached image that are useful as standalone image-generation subjects.",
    "Each prompt must describe exactly one object isolated on a clean neutral background, preserving visible style details, material, color and shape from the source image.",
    "Do not include explanations, markdown, comments, or extra keys.",
    "You must include the object's visual style (e.g. real life, stylized, lowpoly, painting, cartoon, 3D render, pixel art, etc.).",
    "Avoid vague prompts. Include distinguishing visual characteristics that are clearly visible in the source image.",
    "Do not describe surrounding scene elements, other objects, lighting setup, camera framing, shadows, reflections, text overlays, or background details unless they are part of the object itself.",
    "If multiple similar objects appear, return only visually distinct object types.",
    "Object names should be short, singular, and descriptive.",
    "Maximum objects: " + maxObjects + ".",
    'Return JSON only with this exact shape: {"objects":[{"name":"object name","prompt":"standalone image prompt"}]}',
    direction ? "User direction: " + direction : "",
    prompt ? "Existing Image Studio prompt context: " + prompt : ""
  ].filter(Boolean).join("\n");
  let raw = await dependencies.askVisionModel(instruction, [imageInput]);
  let objects: IdentifiedImageObjectPrompt[] = parseIdentifiedImageObjects(raw, maxObjects);
  if (objects.length === 0) {
    const retryInstruction = [
      instruction,
      "The previous response was not valid parseable JSON.",
      "Retry once. Return one complete JSON object only, with all string quotes escaped and no trailing commas."
    ].join("\n");
    raw = await dependencies.askVisionModel(retryInstruction, [imageInput]);
    objects = parseIdentifiedImageObjects(raw, maxObjects);
  }
  dependencies.runtimeState.recordAction(
    "dashboard:image-identify-objects",
    `Identified ${objects.length} object prompt(s) from ${imageFileNameHint || "source image"}.`
  );
  sendJson(response, 200, { objects, raw: objects.length > 0 ? undefined : raw });
  return;
}
async function handlePostApiImageImport(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const parsed = parseBase64DataUrl(dataUrl);
  if (!parsed || !parsed.mimeType.toLowerCase().startsWith("image/")) {
    sendJson(response, 400, { error: "A valid image dataUrl is required." });
    return;
  }
  const fileName = sanitizeImportedImageFileName(
    typeof body.fileName === "string" ? body.fileName : "",
    parsed.mimeType
  );
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const width = parseOptionalNumericInput(body.width, { min: 1, max: 8192 });
  const height = parseOptionalNumericInput(body.height, { min: 1, max: 8192 });
  const model = typeof body.model === "string" ? body.model.trim() : "Pixel Art Converter";
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? body.metadata as Record<string, string | number | boolean>
    : undefined;
  const stripMetadata = dependencies.runtimeState.getGlobalDashboardSettings().stripMetadataWebUiImages;
  let imageData = Buffer.from(parsed.base64Data, "base64");
  let effectiveFileName = fileName;
  if (imageData.length === 0) {
    sendJson(response, 400, { error: "Image data is empty." });
    return;
  }
  if (stripMetadata) {
    try {
      imageData = Buffer.from(await stripImageMetadataToPng(imageData));
      effectiveFileName = `${path.basename(fileName, path.extname(fileName)) || "imported-image"}.png`;
    } catch (error) {
      console.warn("Image import metadata stripping failed; storing original image bytes.", error);
    }
  }
  const imported = await dependencies.importGeneratedImage({
    imageFileName: effectiveFileName,
    imageData,
    prompt,
    width,
    height,
    model,
    metadata
  });
  dependencies.runtimeState.recordAction(
    "dashboard:image-import",
    `Imported generated image ${imported.id} (${imported.imageFileName}).`
  );
  sendJson(response, 200, imported);
  return;
}
async function handlePostApiToolThumbnail(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageId = typeof body.imageId === "string" ? body.imageId.trim() : "";
  const imageFileName = typeof body.imageFileName === "string" ? body.imageFileName.trim() : "";
  const toolSourcePath = typeof body.toolSourcePath === "string" ? body.toolSourcePath.trim() : "";
  if (!imageId || !imageFileName || !toolSourcePath) {
    sendJson(response, 400, { error: "imageId, imageFileName, and toolSourcePath are required." });
    return;
  }
  const toolDirectory = await resolveToolThumbnailDirectoryAsync(toolSourcePath);
  const imageFile = await dependencies.readGeneratedImageFile(imageId, imageFileName);
  const thumbnailBytes = await stripImageMetadataToPng(imageFile.data);
  const targetPath = path.join(toolDirectory, "thumbnail.png");
  let backupFileName = "";
  try {
    const existing = await stat(targetPath);
    if (existing.isFile()) {
      backupFileName = createToolThumbnailBackupName();
      await rename(targetPath, path.join(toolDirectory, backupFileName));
    }
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code || "") : "";
    if (code !== "ENOENT") {
      throw error;
    }
  }
  await writeFile(targetPath, thumbnailBytes);
  dependencies.runtimeState.recordAction(
    "dashboard:tool-thumbnail",
    `Updated thumbnail.png for ${normalizeToolSourcePath(toolSourcePath)} from generated image ${imageId}.`
  );
  sendJson(response, 200, {
    ok: true,
    thumbnailPath: path.join(toolDirectory, "thumbnail.png"),
    backupFileName: backupFileName || null
  });
  return;
}
async function handlePostApiDashboardRequestStop(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) {
    sendJson(response, 400, { error: "requestId is required." });
    return;
  }
  const result = await interruptDashboardRequest(requestId, dependencies);
  dependencies.runtimeState.recordAction(
    "dashboard:request-stop",
    result.interrupted
      ? `Stopped dashboard request ${requestId}${result.workflow ? ` (${result.workflow})` : ""}.`
      : `Stop requested for inactive dashboard request ${requestId}.`
  );
  sendJson(response, 200, { ok: true, ...result });
  return;
}
async function handlePostApiImageDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageId = typeof body.imageId === "string" ? body.imageId.trim() : "";
  if (!imageId) {
    sendJson(response, 400, { error: "imageId is required." });
    return;
  }
  const deleted = await dependencies.deleteGeneratedImage(imageId);
  if (!deleted) {
    sendJson(response, 404, { error: "Generated image was not found." });
    return;
  }
  dependencies.runtimeState.recordAction(
    "dashboard:image-delete",
    `Deleted generated image ${imageId}.`
  );
  sendJson(response, 200, { ok: true, imageId });
  return;
}
async function handlePostApiModel3dDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const deleteScope = body.deleteScope === "model-entry" ? body.deleteScope : "";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  if (!deleteScope) {
    sendJson(response, 400, { error: "Whole-model deletion requires deleteScope: 'model-entry'. Use /api/model3d-variant-delete to delete one artifact variant." });
    return;
  }
  const deleted = await dependencies.deleteGeneratedModel(modelId);
  if (!deleted) {
    sendJson(response, 404, { error: "Generated model was not found." });
    return;
  }
  dependencies.runtimeState.recordAction(
    "dashboard:model3d-delete",
    `Deleted generated model ${modelId}.`
  );
  sendJson(response, 200, { ok: true, modelId });
  return;
}
async function handlePostApiModel3dVariantDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const variant = body.variant === "merged" || body.variant === "original" || body.variant === "lowpoly" || body.variant === "albedo"
    ? body.variant
    : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!modelId || !variant || !fileName) {
    sendJson(response, 400, { error: "modelId, variant, and fileName are required." });
    return;
  }
  const model = await dependencies.deleteGeneratedModelVariant(modelId, variant, fileName);
  dependencies.runtimeState.recordAction(
    "dashboard:model3d-variant-delete",
    model
      ? `Deleted ${variant} variant from generated model ${modelId}.`
      : `Deleted generated model ${modelId}; its ${variant} artifact was the only remaining variant.`
  );
  sendJson(response, 200, { ok: true, modelId, variant, model, deletedModelEntry: model === null });
  return;
}
async function handlePostApiAudioDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const audioId = typeof body.audioId === "string" ? body.audioId.trim() : "";
  if (!audioId) {
    sendJson(response, 400, { error: "audioId is required." });
    return;
  }
  const deleted = await dependencies.deleteGeneratedAudio(audioId);
  if (!deleted) {
    sendJson(response, 404, { error: "Generated audio was not found." });
    return;
  }
  dependencies.runtimeState.recordAction(
    "dashboard:audio-delete",
    `Deleted generated audio ${audioId}.`
  );
  sendJson(response, 200, { ok: true, audioId });
  return;
}
async function handlePostApiVideoDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
  if (!videoId) {
    sendJson(response, 400, { error: "videoId is required." });
    return;
  }
  const deleted = await dependencies.deleteGeneratedVideo(videoId);
  if (!deleted) {
    sendJson(response, 404, { error: "Generated video was not found." });
    return;
  }
  dependencies.runtimeState.recordAction(
    "dashboard:video-delete",
    `Deleted generated video ${videoId}.`
  );
  sendJson(response, 200, { ok: true, videoId });
  return;
}
async function handlePostApiImageRegenerateFilename(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const imageId = typeof body.imageId === "string" ? body.imageId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!imageId) {
    sendJson(response, 400, { error: "imageId is required." });
    return;
  }
  const renamed = await dependencies.regenerateGeneratedImageFileName({
    imageId,
    prompt: prompt || undefined
  });
  dependencies.runtimeState.recordAction("dashboard:image-rename", `Regenerated image filename with LLM for ${imageId}.`);
  sendJson(response, 200, renamed);
  return;
}
async function handlePostApiModel3dRegenerateFilename(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!modelId) {
    sendJson(response, 400, { error: "modelId is required." });
    return;
  }
  const renamed = await dependencies.regenerateGeneratedModelFileName({
    modelId,
    prompt: prompt || undefined
  });
  dependencies.runtimeState.recordAction("dashboard:model3d-rename", `Regenerated 3D model filename with LLM for ${modelId}.`);
  sendJson(response, 200, renamed);
  return;
}

async function handlePostApiAudioGenerate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const promptTextFile = typeof body.promptTextFile === "string" ? body.promptTextFile.trim() : "";
  const promptTextSelectionMode = parseTextSourceSelectionMode(body.promptTextSelectionMode);
  const seconds = typeof body.seconds === "number" && Number.isFinite(body.seconds) ? Math.max(1, Math.min(120, Math.round(body.seconds))) : undefined;
  const steps = typeof body.steps === "number" && Number.isFinite(body.steps) ? Math.max(1, Math.min(250, Math.round(body.steps))) : undefined;
  const cfg = typeof body.cfg === "number" && Number.isFinite(body.cfg) ? Math.max(0, Math.min(30, body.cfg)) : undefined;
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  let resolvedPrompt = prompt;
  if (promptTextFile) {
    try {
      const randomLine = await readAutomationTextSourceLine(promptTextFile, promptTextSelectionMode);
      resolvedPrompt = mergePromptWithRandomLine(prompt, randomLine);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to load prompt text file." });
      return;
    }
  }
  if (!resolvedPrompt) {
    sendJson(response, 400, { error: "prompt is required." });
    return;
  }
  const dashboardRequest = registerDashboardRequest({ requestId: body.dashboardRequestId, workflow: "audio" });
  try {
    const generated = await dependencies.generateAudioFromPrompt({
      prompt: resolvedPrompt,
      seconds,
      steps,
      cfg,
      channelId: channelId || null,
      requestedBy: "dashboard",
      onPromptQueued: dashboardRequest.markPromptQueued,
      signal: dashboardRequest.signal
    });
    dependencies.runtimeState.recordAction(
      "dashboard:audio",
      `Generated audio ${generated.id}${channelId ? ` and posted to ${channelId}` : ""}.`
    );
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    if (isDashboardAbortError(error)) {
      sendJson(response, 499, { error: "Audio generation stopped." });
      return;
    }
    throw error;
  } finally {
    dashboardRequest.finish();
  }
}

async function handlePostApiMusicGenerate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const secondsRaw = typeof body.seconds === "number" && Number.isFinite(body.seconds) ? body.seconds : Number.NaN;
  const seconds = Math.max(1, Math.min(120, Math.round(secondsRaw)));
  const stepsRaw = typeof body.steps === "number" && Number.isFinite(body.steps) ? body.steps : Number.NaN;
  const steps = Math.max(1, Math.min(250, Math.round(stepsRaw)));
  const cfgRaw = typeof body.cfg === "number" && Number.isFinite(body.cfg) ? body.cfg : Number.NaN;
  const cfg = Math.max(0, Math.min(30, cfgRaw));
  const seedRaw = typeof body.seed === "number" && Number.isFinite(body.seed) ? body.seed : Number.NaN;
  const seed = Math.max(0, Math.min(0xffffffffffff, Math.round(seedRaw)));
  const tags = typeof body.tags === "string" ? body.tags.trim() : "";
  const lyrics = typeof body.lyrics === "string" ? body.lyrics.trim() : "";
  const tagsTextFile = typeof body.tagsTextFile === "string" ? body.tagsTextFile.trim() : "";
  const lyricsTextFile = typeof body.lyricsTextFile === "string" ? body.lyricsTextFile.trim() : "";
  const tagsTextSelectionMode = parseTextSourceSelectionMode(body.tagsTextSelectionMode);
  const lyricsTextSelectionMode = parseTextSourceSelectionMode(body.lyricsTextSelectionMode);
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!Number.isFinite(secondsRaw)) {
    sendJson(response, 400, { error: "seconds is required." });
    return;
  }
  if (!Number.isFinite(stepsRaw) || stepsRaw < 1 || stepsRaw > 250) {
    sendJson(response, 400, { error: "steps must be between 1 and 250." });
    return;
  }
  if (!Number.isFinite(cfgRaw) || cfgRaw < 0 || cfgRaw > 30) {
    sendJson(response, 400, { error: "cfg must be between 0 and 30." });
    return;
  }
  if (!Number.isFinite(seedRaw) || seedRaw < 0 || seedRaw > 0xffffffffffff) {
    sendJson(response, 400, { error: "seed must be a non-negative 48-bit integer." });
    return;
  }
  let resolvedTags = tags;
  let resolvedLyrics = lyrics;
  try {
    if (tagsTextFile) {
      resolvedTags = mergePromptWithRandomLine(tags, await readAutomationTextSourceLine(tagsTextFile, tagsTextSelectionMode));
    }
    if (lyricsTextFile) {
      resolvedLyrics = mergePromptWithRandomLine(lyrics, await readAutomationTextSourceLine(lyricsTextFile, lyricsTextSelectionMode));
    }
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to load text source file." });
    return;
  }
  const dashboardRequest = registerDashboardRequest({ requestId: body.dashboardRequestId, workflow: "music" });
  try {
    const generated = await dependencies.generateMusicFromPrompt({
      seconds,
      steps,
      cfg,
      seed,
      tags: resolvedTags,
      lyrics: resolvedLyrics,
      channelId: channelId || null,
      requestedBy: "dashboard",
      onPromptQueued: dashboardRequest.markPromptQueued,
      signal: dashboardRequest.signal
    });
    dependencies.runtimeState.recordAction(
      "dashboard:music",
      `Generated music ${generated.id}${channelId ? ` and posted to ${channelId}` : ""}.`
    );
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    if (isDashboardAbortError(error)) {
      sendJson(response, 499, { error: "Music generation stopped." });
      return;
    }
    throw error;
  } finally {
    dashboardRequest.finish();
  }
}

function buildMusicThinkingPrompt(kind: "tags" | "lyrics", existing: string): string {
  if (kind === "tags") {
    return [
      "Output only a comma-separated music tag list.",
      "Output schema: tag, tag, tag",
      "Include only tags needed to guide music generation. Exclude introductions, explanations, labels, tool names, instructions, markdown, bullets, quotes, lyrics, and production notes.",
      "Preserve the current tags and add complementary genre, mood, instrumentation, vocal, tempo, and production tags when helpful.",
      existing ? `Current tags: ${existing}` : "No current tags were provided; propose a balanced starting tag set."
    ].join("\n");
  }
  return [
    "Output only complete song lyrics.",
    "Start with [verse]. Use only these bracketed section labels: [verse], [chorus], [bridge], [outro]. Include at least [verse] and [chorus].",
    "Include only section labels and lyric lines. Exclude introductions, explanations, titles, tool names, instructions, stage directions, production notes, quotes, and markdown fences.",
    "When existing lyrics are provided, preserve their intent and wording, then build a coherent song around them rather than starting over.",
    existing ? `Existing lyrics to build on:\n${existing}` : "No existing lyrics were provided; write an original, concise song."
  ].join("\n\n");
}

async function handlePostApiMusicThink(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const kind = body.kind === "lyrics" ? "lyrics" : body.kind === "tags" ? "tags" : "";
  const existing = typeof body.existing === "string" ? body.existing.trim().slice(0, 12_000) : "";
  if (!kind) {
    sendJson(response, 400, { error: "kind must be tags or lyrics." });
    return;
  }
  const prompt = buildMusicThinkingPrompt(kind, existing);
  const detailed = typeof dependencies.askModelDetailed === "function" ? await dependencies.askModelDetailed(prompt) : null;
  const result = String(detailed?.response || await dependencies.askModel(prompt)).trim();
  if (!result) {
    sendJson(response, 502, { error: "The music assistant returned an empty response." });
    return;
  }
  dependencies.runtimeState.recordAction("dashboard:music-think", `Drafted music ${kind}.`);
  sendJson(response, 200, { result });
}
async function handlePostApiVideoGenerate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const promptTextFile = typeof body.promptTextFile === "string" ? body.promptTextFile.trim() : "";
  const promptTextSelectionMode = parseTextSourceSelectionMode(body.promptTextSelectionMode);
  const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt.trim() : "";
  const seconds = typeof body.seconds === "number" && Number.isFinite(body.seconds) ? Math.max(1, Math.min(300, Math.round(body.seconds))) : undefined;
  const frames = typeof body.frames === "number" && Number.isFinite(body.frames) ? Math.max(1, Math.min(512, Math.round(body.frames))) : undefined;
  const fps = typeof body.fps === "number" && Number.isFinite(body.fps) ? Math.max(1, Math.min(60, Math.round(body.fps))) : undefined;
  const width = typeof body.width === "number" && Number.isFinite(body.width) ? Math.max(64, Math.min(4096, Math.round(body.width))) : undefined;
  const height = typeof body.height === "number" && Number.isFinite(body.height) ? Math.max(64, Math.min(4096, Math.round(body.height))) : undefined;
  const steps = typeof body.steps === "number" && Number.isFinite(body.steps) ? Math.max(1, Math.min(250, Math.round(body.steps))) : undefined;
  const seed = typeof body.seed === "number" && Number.isFinite(body.seed) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(body.seed))) : undefined;
  const workflowPath = typeof body.workflowPath === "string" ? body.workflowPath.trim() : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl.trim() : "";
  const imageFileName = typeof body.imageFileName === "string" ? body.imageFileName.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  let resolvedPrompt = prompt;
  if (promptTextFile) {
    try {
      const randomLine = await readAutomationTextSourceLine(promptTextFile, promptTextSelectionMode);
      resolvedPrompt = mergePromptWithRandomLine(prompt, randomLine);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Failed to load prompt text file." });
      return;
    }
  }
  if (!resolvedPrompt) {
    sendJson(response, 400, { error: "prompt is required." });
    return;
  }
  const resolvedWorkflowPath = workflowPath ? await resolveWorkflowPathOverridePath(workflowPath) : "";
  if (workflowPath && !resolvedWorkflowPath) {
    sendJson(response, 400, { error: `workflowPath not found: ${workflowPath}` });
    return;
  }
  const dashboardRequest = registerDashboardRequest({ requestId: body.dashboardRequestId, workflow: "video" });
  try {
    const generated = await dependencies.generateVideoFromPrompt({
      prompt: resolvedPrompt,
      negativePrompt,
      seconds,
      frames,
      fps,
      width,
      height,
      steps,
      seed,
      workflowPath: resolvedWorkflowPath || undefined,
      imageDataUrl: imageDataUrl || undefined,
      imageFileName: imageFileName || undefined,
      channelId: channelId || null,
      requestedBy: "dashboard",
      onPromptQueued: dashboardRequest.markPromptQueued,
      signal: dashboardRequest.signal
    });
    dependencies.runtimeState.recordAction(
      "dashboard:video",
      `Generated video ${generated.id}${channelId ? ` and posted to ${channelId}` : ""}.`
    );
    sendJson(response, 200, generated);
    return;
  } catch (error) {
    if (isDashboardAbortError(error)) {
      sendJson(response, 499, { error: "Video generation stopped." });
      return;
    }
    throw error;
  } finally {
    dashboardRequest.finish();
  }
}

async function handlePostApiModel3dPost(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const modelPostSettings = parseModel3dPostSettings(body as Record<string, unknown>);
  const previewGifDataUrl = typeof body.previewGifDataUrl === "string" ? body.previewGifDataUrl.trim() : "";
  const requireThreeJsPreviewGif = body.requireThreeJsPreviewGif === true;
  const useLlmMetadata = body.useLlmMetadata === true;
  const llmMetadataPrompt = typeof body.llmMetadataPrompt === "string" ? body.llmMetadataPrompt.trim() : "";
  const suggestedModelFileName = typeof body.suggestedModelFileName === "string" ? body.suggestedModelFileName.trim() : "";
  const suggestedModelDescription = typeof body.suggestedModelDescription === "string" ? body.suggestedModelDescription.trim() : "";
  const replyToMessageId = typeof body.replyToMessageId === "string" ? body.replyToMessageId.trim() : "";
  if (!modelId || !channelId) {
    sendJson(response, 400, { error: "modelId and channelId are required." });
    return;
  }
  const posted = await dependencies.postGeneratedModel({
    modelId,
    channelId,
    postTargetMode: modelPostSettings.postTargetMode,
    threadNameMode: modelPostSettings.threadNameMode,
    threadName: modelPostSettings.threadName || undefined,
    threadNameBase: modelPostSettings.threadNameBase || undefined,
    modelNameSource: modelPostSettings.modelNameSource,
    forumChannelId: modelPostSettings.forumChannelId || undefined,
    forumChannelName: modelPostSettings.forumChannelName || undefined,
    lowPolyForumChannelId: modelPostSettings.lowPolyForumChannelId || undefined,
    lowPolyForumChannelName: modelPostSettings.lowPolyForumChannelName || undefined,
    extraContent: modelPostSettings.extraContent || undefined,
    initialExtraContent: modelPostSettings.initialExtraContent || undefined,
    sendInitialToSelectedChannel: modelPostSettings.sendInitialToSelectedChannel,
    modelUploadTarget: modelPostSettings.modelUploadTarget,
    includeModelFile: modelPostSettings.includeModelFile,
    includePreviewMedia: modelPostSettings.includePreviewMedia,
    includeEmbed: modelPostSettings.includeEmbed,
    includeEmbedInInitial: modelPostSettings.includeEmbedInInitial,
    includeButtons: modelPostSettings.includeButtons,
    uploadTextureMessages: modelPostSettings.uploadTextureMessages,
    uploadMultiViewTextures: modelPostSettings.uploadMultiViewTextures,
    uploadUvMapTextures: modelPostSettings.uploadUvMapTextures,
    uploadNormalMapTextures: modelPostSettings.uploadNormalMapTextures,
    textureUploadTarget: modelPostSettings.textureUploadTarget,
    generateLowPolyVersion: modelPostSettings.generateLowPolyVersion,
    lowPolyExecutionTarget: modelPostSettings.lowPolyExecutionTarget,
    lowPolyUseLlmTargetFaces: modelPostSettings.lowPolyUseLlmTargetFaces,
    lowPolyLlmDecisionSource: modelPostSettings.lowPolyLlmDecisionSource,
    lowPolyTargetFaceCount: modelPostSettings.lowPolyTargetFaceCount,
    previewGifDataUrl: previewGifDataUrl || undefined,
    requireThreeJsPreviewGif,
    useLlmMetadata,
    llmMetadataPrompt: llmMetadataPrompt || undefined,
    suggestedModelFileName: suggestedModelFileName || undefined,
    suggestedModelDescription: suggestedModelDescription || undefined,
    replyToMessageId: replyToMessageId || undefined
  });
  dependencies.runtimeState.recordAction(
    "dashboard:model3d-post",
    `Posted 3D model ${modelId} to ${channelId}.`
  );
  sendJson(response, 200, posted);
  return;
}

async function handlePostApiGameEngineExport(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const engine = body.engine === "unity" || body.engine === "unreal" || body.engine === "godot" ? body.engine : null;
  const resourceKind = parseGameEngineResourceKind(body.resourceKind);
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const textContent = typeof body.textContent === "string" ? body.textContent : "";
  if (!engine || !resourceKind) {
    sendJson(response, 400, { error: "engine and resourceKind are required." });
    return;
  }
  if (!sourceUrl && !dataUrl && !textContent) {
    sendJson(response, 400, { error: "sourceUrl, dataUrl, or textContent is required." });
    return;
  }
  const created = await createGameEngineExport({
    engine,
    sourceStudio: typeof body.sourceStudio === "string" ? body.sourceStudio.trim() : "studio",
    resourceKind,
    title: typeof body.title === "string" ? body.title.trim() : "",
    fileName: typeof body.fileName === "string" ? body.fileName.trim() : "",
    mimeType: typeof body.mimeType === "string" ? body.mimeType.trim() : "",
    sourceUrl,
    dataUrl,
    publicBaseUrl: `${url.protocol}//${url.host}`,
    textContent,
    metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, string | number | boolean> : undefined
  });
  dependencies.runtimeState.recordAction(
    "dashboard:game-engine-export",
    `Queued ${created.resourceKind} for ${created.engine} from ${created.sourceStudio}.`
  );
  sendJson(response, 200, created);
  return;
}

async function handlePostApiGameEngineExportStatus(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const exportId = typeof body.exportId === "string" ? body.exportId.trim() : "";
  const status = body.status === "pending" || body.status === "imported" || body.status === "failed" ? body.status : null;
  if (!exportId || !status) {
    sendJson(response, 400, { error: "exportId and status are required." });
    return;
  }
  const updated = await updateGameEngineExportStatus({
    exportId,
    status,
    importerNotes: typeof body.importerNotes === "string" ? body.importerNotes.trim() : ""
  });
  dependencies.runtimeState.recordAction(
    "dashboard:game-engine-export-status",
    `Marked engine export ${updated.id} as ${updated.status}.`
  );
  sendJson(response, 200, updated);
  return;
}

const dashboardMessagingAndModelRouteTable = createDashboardRouteTable([
  ...chatSkillRouteDefinitions,
  ...messengerAdminRouteDefinitions,
  ...speechRouteDefinitions,
  postRoute("/api/model-image-upload", handlePostApiModelImageUpload),
  postRoute("/api/model3d-start-notice", handlePostApiModel3dStartNotice),
  getRoute("/api/image-workflow-metadata", handleGetApiImageWorkflowMetadata),
  getRoute("/api/image-workflow-preflight", handleGetApiImageWorkflowPreflight),
  postRoute("/api/model3d-suggest-metadata", handlePostApiModel3dSuggestMetadata),
  postRoute("/api/model3d-suggest-lowpoly", handlePostApiModel3dSuggestLowPoly),
  postRoute("/api/model3d-edit", handlePostApiModel3dEdit),
  postRoute("/api/model3d-texture", handlePostApiModel3dTexture),
  postRoute("/api/model3d-website-import", handlePostApiModel3dWebsiteImport),
  postRoute("/api/model3d-inspect", handlePostApiModel3dInspect),
  postRoute("/api/model3d-validate", handlePostApiModel3dValidate),
  postRoute("/api/model3d-index", handlePostApiModel3dIndex),
  postRoute("/api/model3d-capture", handlePostApiModel3dCapture),
  postRoute("/api/media-probe", handlePostApiMediaProbe),
  postRoute("/api/model3d-lowpoly-upload", handlePostApiModel3dLowPolyUpload),
  postRoute("/api/model3d-lowpoly-generate", handlePostApiModel3dLowPolyGenerate),
  postRoute("/api/model3d-generate-lods", handlePostApiModel3dGenerateLods),
  postRoute("/api/model3d-albedo-to-geometry", handlePostApiModel3dAlbedoToGeometry),
  postRoute("/api/model3d-separate-loose-parts", handlePostApiModel3dSeparateByLooseParts),
  postRoute("/api/model3d-separate-by-loose-parts", handlePostApiModel3dSeparateByLooseParts),
  postRoute("/api/model3d-autorig-preview", handlePostApiModel3dAutoRigPreview),
  postRoute("/api/model3d-autorig", handlePostApiModel3dAutoRig),
  postRoute("/api/blender-open-model", handlePostApiBlenderOpenModel),
  postRoute("/api/blender-open-models", handlePostApiBlenderOpenModels),
  postRoute("/api/blender-open-image", handlePostApiBlenderOpenImage),
  postRoute("/api/blender-open-images", handlePostApiBlenderOpenImages),
  postRoute("/api/comfy-free", handlePostApiComfyFree),
  postRoute("/api/dashboard-request-stop", handlePostApiDashboardRequestStop),
  postRoute("/api/llm-eject-active", handlePostApiLlmEjectActive),
  postRoute("/api/llm-load-active", handlePostApiLlmLoadActive),
  postRoute("/api/model3d-generate", handlePostApiModel3dGenerate),
  postRoute("/api/model3d-post", handlePostApiModel3dPost),
  postRoute("/api/image-generate", handlePostApiImageGenerate),
  postRoute("/api/image-remove-background", handlePostApiImageRemoveBackground),
  postRoute("/api/image-interpret-prompt", handlePostApiImageInterpretPrompt),
  postRoute("/api/image-rewrite-prompt", handlePostApiImageRewritePrompt),
  postRoute("/api/image-identify-objects", handlePostApiImageIdentifyObjects),
  postRoute("/api/image-import", handlePostApiImageImport),
  postRoute("/api/tool-thumbnail", handlePostApiToolThumbnail),
  postRoute("/api/image-delete", handlePostApiImageDelete),
  postRoute("/api/model3d-delete", handlePostApiModel3dDelete),
  postRoute("/api/model3d-variant-delete", handlePostApiModel3dVariantDelete),
  postRoute("/api/audio-delete", handlePostApiAudioDelete),
  postRoute("/api/video-delete", handlePostApiVideoDelete),
  postRoute("/api/image-regenerate-filename", handlePostApiImageRegenerateFilename),
  postRoute("/api/model3d-regenerate-filename", handlePostApiModel3dRegenerateFilename),
  postRoute("/api/audio-generate", handlePostApiAudioGenerate),
  postRoute("/api/music-generate", handlePostApiMusicGenerate),
  postRoute("/api/music-think", handlePostApiMusicThink),
  postRoute("/api/video-generate", handlePostApiVideoGenerate),
  postRoute("/api/game-engine-export", handlePostApiGameEngineExport),
  postRoute("/api/game-engine-export-status", handlePostApiGameEngineExportStatus),
  ...channelMessagingRouteDefinitions
]);

export async function handleDashboardMessagingAndModelRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: DashboardDependencies
): Promise<boolean>{
  return dispatchDashboardRoute(dashboardMessagingAndModelRouteTable, {
    request,
    response,
    url,
    dependencies
  });
}
