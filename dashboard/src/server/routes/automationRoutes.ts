import type { IncomingMessage, ServerResponse } from "node:http";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { deleteDashboardResourcePool, saveDashboardResourcePool } from "@urage/server/services/resourcePools";
import { parseJsonBody, sendJson } from "../http.js";
import { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute } from "../router.js";

function isDashboardResourcePoolKind(value: string | null | undefined): value is "image" | "model3d" | "video" | "audio" | "music" {
  return value === "image" || value === "model3d" || value === "video" || value === "audio" || value === "music";
}

function parseImagePostProcessingOptions(value: unknown): {
  removeBackground: boolean;
  delight: boolean;
  pixelArt: boolean;
  videoConvertToGif?: boolean;
  videoGifPlaybackMode?: "loop" | "pingpong";
  videoGifRemoveBackground?: boolean;
  videoGifPixelArt?: boolean;
  postMode: "combined" | "separate";
  recipes?: Array<{ label: string; steps: Array<"remove-background" | "delight" | "pixel-art">; }>;
} | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const options = value as {
    removeBackground?: unknown;
    delight?: unknown;
    pixelArt?: unknown;
    videoConvertToGif?: unknown;
    videoGifPlaybackMode?: unknown;
    videoGifRemoveBackground?: unknown;
    videoGifPixelArt?: unknown;
    postMode?: unknown;
    recipes?: unknown;
  };
  const normalizeStep = (value: unknown): "remove-background" | "delight" | "pixel-art" | "" => {
    const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
    if (normalized === "remove" || normalized === "remove-bg" || normalized === "remove-background" || normalized === "background-remove" || normalized === "rembg" || normalized === "bg-remove") return "remove-background";
    if (normalized === "pixel" || normalized === "pixel-art" || normalized === "pixelart" || normalized === "pixels") return "pixel-art";
    if (normalized === "delight" || normalized === "de-light") return "delight";
    return "";
  };
  const recipes = Array.isArray(options.recipes)
    ? options.recipes.map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as { label?: unknown; steps?: unknown };
      const steps = Array.isArray(raw.steps)
        ? raw.steps.map(normalizeStep).filter((step): step is "remove-background" | "delight" | "pixel-art" => Boolean(step))
        : [];
      return steps.length > 0
        ? { label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : steps.join(" > "), steps }
        : null;
    }).filter((entry): entry is { label: string; steps: Array<"remove-background" | "delight" | "pixel-art">; } => entry !== null)
    : undefined;
  return {
    removeBackground: options.removeBackground === true,
    delight: options.delight === true,
    pixelArt: options.pixelArt === true,
    videoConvertToGif: options.videoConvertToGif === true,
    videoGifPlaybackMode: options.videoGifPlaybackMode === "pingpong" ? "pingpong" : "loop",
    videoGifRemoveBackground: options.videoGifRemoveBackground === true,
    videoGifPixelArt: options.videoGifPixelArt === true,
    postMode: options.postMode === "separate" ? "separate" : "combined",
    recipes
  };
}

function parseImageVideoWorkflowSettings(value: unknown): {
  workflowPath: string;
  imageWorkflowPath: string;
  negativePrompt: string;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  steps?: number;
} | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as {
    workflowPath?: unknown;
    imageWorkflowPath?: unknown;
    negativePrompt?: unknown;
    width?: unknown;
    height?: unknown;
    frames?: unknown;
    fps?: unknown;
    steps?: unknown;
  };
  const normalizeNumber = (entry: unknown): number | undefined => typeof entry === "number" && Number.isFinite(entry) ? entry : undefined;
  return {
    workflowPath: typeof raw.workflowPath === "string" ? raw.workflowPath.trim() : "",
    imageWorkflowPath: typeof raw.imageWorkflowPath === "string" ? raw.imageWorkflowPath.trim() : "",
    negativePrompt: typeof raw.negativePrompt === "string" ? raw.negativePrompt : "",
    width: normalizeNumber(raw.width),
    height: normalizeNumber(raw.height),
    frames: normalizeNumber(raw.frames),
    fps: normalizeNumber(raw.fps),
    steps: normalizeNumber(raw.steps)
  };
}

function parseImagePostOptions(value: unknown): {
  targetMode: "channel" | "thread" | "forum-post" | "forum-create-and-post";
  threadNameMode: "fixed" | "increment" | "image-name";
  threadName: string;
  threadNameBase: string;
  forumChannelId: string;
  forumChannelName: string;
  sendInitialToSelectedChannel: boolean;
  initialExtraText: string;
  destinationExtraText: string;
  includeEmbed: boolean;
  selectedChannelImageMode: "notice-only" | "original" | "all" | "custom";
  selectedChannelImageLabels: string[];
  variantTargets: Array<{
    labels: string[];
    channelId: string;
    targetMode: "channel" | "thread" | "forum-post" | "forum-create-and-post";
    threadName: string;
    forumChannelId: string;
    forumChannelName: string;
    postMode?: "combined" | "separate";
  }>;
} | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const options = value as {
    targetMode?: unknown;
    threadNameMode?: unknown;
    threadName?: unknown;
    threadNameBase?: unknown;
    forumChannelId?: unknown;
    forumChannelName?: unknown;
    sendInitialToSelectedChannel?: unknown;
    initialExtraText?: unknown;
    destinationExtraText?: unknown;
    includeEmbed?: unknown;
    selectedChannelImageMode?: unknown;
    selectedChannelImageLabels?: unknown;
    variantTargets?: unknown;
  };
  const targetMode = options.targetMode === "thread"
    || options.targetMode === "forum-post"
    || options.targetMode === "forum-create-and-post"
    ? options.targetMode
    : "channel";
  const threadNameMode = options.threadNameMode === "increment" || options.threadNameMode === "image-name" ? options.threadNameMode : "fixed";
  return {
    targetMode,
    threadNameMode,
    threadName: typeof options.threadName === "string" ? options.threadName : "",
    threadNameBase: typeof options.threadNameBase === "string" ? options.threadNameBase : "",
    forumChannelId: typeof options.forumChannelId === "string" ? options.forumChannelId : "",
    forumChannelName: typeof options.forumChannelName === "string" ? options.forumChannelName : "",
    sendInitialToSelectedChannel: options.sendInitialToSelectedChannel === true,
    initialExtraText: typeof options.initialExtraText === "string" ? options.initialExtraText : "",
    destinationExtraText: typeof options.destinationExtraText === "string" ? options.destinationExtraText : "",
    includeEmbed: options.includeEmbed !== false,
    selectedChannelImageMode: options.selectedChannelImageMode === "original" || options.selectedChannelImageMode === "all" || options.selectedChannelImageMode === "custom"
      ? options.selectedChannelImageMode
      : "notice-only",
    selectedChannelImageLabels: Array.isArray(options.selectedChannelImageLabels)
      ? options.selectedChannelImageLabels.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
    variantTargets: Array.isArray(options.variantTargets)
      ? options.variantTargets.map(entry => {
        if (!entry || typeof entry !== "object") return null;
        const route = entry as {
          labels?: unknown;
          channelId?: unknown;
          targetMode?: unknown;
          threadName?: unknown;
          forumChannelId?: unknown;
          forumChannelName?: unknown;
          postMode?: unknown;
        };
        const routeTargetMode: "channel" | "thread" | "forum-post" | "forum-create-and-post" = route.targetMode === "thread" || route.targetMode === "forum-post" || route.targetMode === "forum-create-and-post" ? route.targetMode : "channel";
        const routePostMode: "combined" | "separate" | undefined = route.postMode === "combined" || route.postMode === "separate" ? route.postMode : undefined;
        const labels = Array.isArray(route.labels) ? route.labels.filter((label): label is string => typeof label === "string" && label.trim().length > 0) : [];
        if (labels.length === 0) return null;
        return {
          labels,
          channelId: typeof route.channelId === "string" ? route.channelId : "",
          targetMode: routeTargetMode,
          threadName: typeof route.threadName === "string" ? route.threadName : "",
          forumChannelId: typeof route.forumChannelId === "string" ? route.forumChannelId : "",
          forumChannelName: typeof route.forumChannelName === "string" ? route.forumChannelName : "",
          ...(routePostMode ? { postMode: routePostMode } : {})
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : []
  };
}

function parseModelPostOptions(value: unknown): {
  targetMode: "channel" | "thread" | "forum-post" | "forum-create-and-post";
  threadNameMode: "fixed" | "increment" | "model-name";
  threadName: string;
  threadNameBase: string;
  modelNameSource: "llm" | "filename";
  forumChannelId: string;
  forumChannelName: string;
  lowPolyForumChannelId: string;
  lowPolyForumChannelName: string;
  sendInitialToSelectedChannel: boolean;
  initialExtraText: string;
  modelUploadTarget: "selected" | "target";
  includeModelFile: boolean;
  includePreviewMedia: boolean;
  includeSourceImage: boolean;
  includeEmbed: boolean;
  includeButtons: boolean;
  includeEmbedInInitial: boolean;
  uploadTextureMessages: boolean;
  uploadMultiViewTextures: boolean;
  uploadUvMapTextures: boolean;
  uploadNormalMapTextures: boolean;
  textureUploadTarget: "target" | "selected";
  destinationExtraText: string;
  generateLowPolyVersion: boolean;
  lowPolyUseLlmTargetFaces: boolean;
  lowPolyLlmDecisionSource: "input-image" | "model-render";
  lowPolyTargetFaceCount: number;
  sendSourceImageToSelectedChannel: boolean;
} | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const options = value as {
    targetMode?: unknown;
    threadNameMode?: unknown;
    threadName?: unknown;
    threadNameBase?: unknown;
    modelNameSource?: unknown;
    forumChannelId?: unknown;
    forumChannelName?: unknown;
    lowPolyForumChannelId?: unknown;
    lowPolyForumChannelName?: unknown;
    sendInitialToSelectedChannel?: unknown;
    initialExtraText?: unknown;
    modelUploadTarget?: unknown;
    includeModelFile?: unknown;
    includePreviewMedia?: unknown;
    includeSourceImage?: unknown;
    includeEmbed?: unknown;
    includeButtons?: unknown;
    includeEmbedInInitial?: unknown;
    uploadTextureMessages?: unknown;
    uploadMultiViewTextures?: unknown;
    uploadUvMapTextures?: unknown;
    uploadNormalMapTextures?: unknown;
    textureUploadTarget?: unknown;
    destinationExtraText?: unknown;
    generateLowPolyVersion?: unknown;
    lowPolyUseLlmTargetFaces?: unknown;
    lowPolyLlmDecisionSource?: unknown;
    lowPolyTargetFaceCount?: unknown;
    sendSourceImageToSelectedChannel?: unknown;
  };
  const targetMode = options.targetMode === "thread"
    || options.targetMode === "forum-post"
    || options.targetMode === "forum-create-and-post"
    ? options.targetMode
    : "channel";
  const threadNameMode = options.threadNameMode === "increment" || options.threadNameMode === "model-name" ? options.threadNameMode : "fixed";
  const modelNameSource = options.modelNameSource === "filename" ? "filename" : "llm";
  const textureUploadTarget = options.textureUploadTarget === "selected" ? "selected" : "target";
  const modelUploadTarget = options.modelUploadTarget === "target" ? "target" : "selected";
  const lowPolyLlmDecisionSource = options.lowPolyLlmDecisionSource === "model-render" ? "model-render" : "input-image";
  return {
    targetMode,
    threadNameMode,
    threadName: typeof options.threadName === "string" ? options.threadName : "",
    threadNameBase: typeof options.threadNameBase === "string" ? options.threadNameBase : "",
    modelNameSource,
    forumChannelId: typeof options.forumChannelId === "string" ? options.forumChannelId : "",
    forumChannelName: typeof options.forumChannelName === "string" ? options.forumChannelName : "",
    lowPolyForumChannelId: typeof options.lowPolyForumChannelId === "string" ? options.lowPolyForumChannelId : "",
    lowPolyForumChannelName: typeof options.lowPolyForumChannelName === "string" ? options.lowPolyForumChannelName : "",
    sendInitialToSelectedChannel: options.sendInitialToSelectedChannel === true,
    initialExtraText: typeof options.initialExtraText === "string" ? options.initialExtraText : "",
    modelUploadTarget,
    includeModelFile: options.includeModelFile !== false,
    includePreviewMedia: options.includePreviewMedia !== false,
    includeSourceImage: options.includeSourceImage !== false,
    includeEmbed: options.includeEmbed !== false,
    includeButtons: options.includeButtons !== false,
    includeEmbedInInitial: options.includeEmbedInInitial !== false,
    uploadTextureMessages: options.uploadTextureMessages === true,
    uploadMultiViewTextures: options.uploadMultiViewTextures !== false,
    uploadUvMapTextures: options.uploadUvMapTextures !== false,
    uploadNormalMapTextures: options.uploadNormalMapTextures !== false,
    textureUploadTarget,
    destinationExtraText: typeof options.destinationExtraText === "string" ? options.destinationExtraText : "",
    generateLowPolyVersion: options.generateLowPolyVersion === true,
    lowPolyUseLlmTargetFaces: options.lowPolyUseLlmTargetFaces === true,
    lowPolyLlmDecisionSource,
    lowPolyTargetFaceCount: typeof options.lowPolyTargetFaceCount === "number" && Number.isFinite(options.lowPolyTargetFaceCount)
      ? Math.max(1, Math.round(options.lowPolyTargetFaceCount))
      : 1500,
    sendSourceImageToSelectedChannel: options.sendSourceImageToSelectedChannel === true
  };
}

async function handlePostApiScheduledAutomations(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const triggerMode = body.triggerMode === "interval" ? "interval" : "cron";
  const targetMessenger = body.targetMessenger === "telegram" || body.targetMessenger === "matrix" ? body.targetMessenger : "discord";
  const cron = typeof body.cron === "string" ? body.cron.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";
  if (!guildId || !channelId || !name || !source) {
    sendJson(response, 400, { error: "guildId, channelId (Discord channel, Telegram chat, or Matrix room), name, and source are required." });
    return;
  }
  if ((targetMessenger === "telegram" || targetMessenger === "matrix") && source === "model-3d") {
    sendJson(response, 400, { error: `3D model scheduled automations are not supported for ${targetMessenger === "telegram" ? "Telegram" : "Matrix"} yet.` });
    return;
  }
  const saved = await dependencies.saveScheduledAutomation({
    id: typeof body.id === "string" ? body.id.trim() : undefined,
    guildId,
    channelId,
    targetMessenger,
    name,
    enabled: body.enabled !== false,
    triggerMode,
    cron,
    intervalValue: typeof body.intervalValue === "number" ? body.intervalValue : 1,
    intervalUnit: body.intervalUnit === "minutes"
      || body.intervalUnit === "hours"
      || body.intervalUnit === "days"
      || body.intervalUnit === "weeks"
      ? body.intervalUnit
      : "days",
    repeatCount: typeof body.repeatCount === "number" ? body.repeatCount : 1,
    repeatDelaySeconds: typeof body.repeatDelaySeconds === "number" ? body.repeatDelaySeconds : 0,
    action: {
      source: source as "template" | "jokes-file" | "ollama" | "image" | "model-3d" | "unity-publisher-gift",
      template: typeof body.template === "string" ? body.template : "",
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      promptTextFile: typeof body.promptTextFile === "string" ? body.promptTextFile : "",
      textSourceSelectionMode: body.textSourceSelectionMode === "no-repeat" ? "no-repeat" : "random",
      jokesFile: typeof body.jokesFile === "string" ? body.jokesFile : "jokes.txt",
      textFiles: Array.isArray(body.textFiles)
        ? body.textFiles.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : undefined,
      modelImage: typeof body.modelImage === "string" ? body.modelImage : "",
      modelImagePoolId: typeof body.modelImagePoolId === "string" ? body.modelImagePoolId : "",
      imageAutoPrompt: body.imageAutoPrompt === true,
      imageAutoFileName: body.imageAutoFileName === true,
      imageAutoDescription: body.imageAutoDescription === true,
      imageCandidateSelectionEnabled: body.imageCandidateSelectionEnabled === true,
      imageCandidateCount: typeof body.imageCandidateCount === "number" ? body.imageCandidateCount : 3,
      imageCandidateSelectionMode: body.imageCandidateSelectionMode === "first" ? "first" : "llm",
      imageCandidateQueueMode: body.imageCandidateQueueMode === "comfy" ? "comfy" : "sequential",
      imageCandidateProcessingMode: body.imageCandidateProcessingMode === "all" ? "all" : "selected",
      imageCreateVideo: body.imageCreateVideo === true,
      imageVideoMode: body.imageVideoMode === "text-image-to-video" || body.imageVideoMode === "both" ? body.imageVideoMode : "text-to-video",
      imageVideoPromptDirection: typeof body.imageVideoPromptDirection === "string" ? body.imageVideoPromptDirection : "",
      imageVideoWorkflowSettings: parseImageVideoWorkflowSettings(body.imageVideoWorkflowSettings),
      imagePostProcessingOptions: parseImagePostProcessingOptions(body.imagePostProcessingOptions),
      imagePostOptions: parseImagePostOptions(body.imagePostOptions),
      modelAutoPrompt: body.modelAutoPrompt === true,
      modelUseLlmMetadata: body.modelUseLlmMetadata === true || body.modelUseLlmModelFileName === true || body.modelUseLlmModelDescription === true,
      modelUseLlmModelFileName: body.modelUseLlmModelFileName === true || (body.modelUseLlmMetadata === true && body.modelUseLlmModelFileName !== false),
      modelUseLlmModelDescription: body.modelUseLlmModelDescription === true || (body.modelUseLlmMetadata === true && body.modelUseLlmModelDescription !== false),
      modelAskLlmIfShouldBeMetallic: body.modelAskLlmIfShouldBeMetallic === true,
      modelAskLlmForRealWorldHeightAndScale: body.modelAskLlmForRealWorldHeightAndScale === true,
      modelGenerationTarget: body.modelGenerationTarget === "remote" ? "remote" : "local",
      modelMetadataTarget: body.modelMetadataTarget === "remote" ? "remote" : "local",
      modelMetadataTiming: body.modelMetadataTiming === "after" || body.modelMetadataTiming === "parallel" ? body.modelMetadataTiming : "before",
      modelUnloadLlmBeforeGenerate: body.modelUnloadLlmBeforeGenerate !== false,
      modelRandomSource: body.modelRandomSource !== false,
      modelSendStartNotice: body.modelSendStartNotice !== false,
      modelPostOptions: parseModelPostOptions(body.modelPostOptions)
    },
    createdAt: typeof body.createdAt === "string" ? body.createdAt : undefined,
    lastRunAt: typeof body.lastRunAt === "string" ? body.lastRunAt : null
  });
  dependencies.runtimeState.recordAction("dashboard:automation-schedule", `Saved scheduled automation ${saved.name}.`);
  sendJson(response, 200, saved);
  return;
}

async function handlePostApiScheduledAutomationsDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    sendJson(response, 400, { error: "id is required." });
    return;
  }
  const deleted = await dependencies.deleteScheduledAutomation(id);
  sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Automation not found." });
  return;
}

async function handlePostApiJoinAutomations(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";
  if (!guildId || !channelId || !name || !source) {
    sendJson(response, 400, { error: "guildId, channelId, name, and source are required." });
    return;
  }
  const saved = await dependencies.saveJoinAutomation({
    id: typeof body.id === "string" ? body.id.trim() : undefined,
    guildId,
    channelId,
    name,
    enabled: body.enabled !== false,
    delaySeconds: typeof body.delaySeconds === "number" ? body.delaySeconds : 0,
    action: {
      source: source as "template" | "jokes-file" | "ollama" | "image" | "model-3d" | "unity-publisher-gift",
      template: typeof body.template === "string" ? body.template : "",
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      promptTextFile: typeof body.promptTextFile === "string" ? body.promptTextFile : "",
      textSourceSelectionMode: body.textSourceSelectionMode === "no-repeat" ? "no-repeat" : "random",
      jokesFile: typeof body.jokesFile === "string" ? body.jokesFile : "jokes.txt",
      textFiles: Array.isArray(body.textFiles)
        ? body.textFiles.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : undefined,
      modelImage: typeof body.modelImage === "string" ? body.modelImage : "",
      modelImagePoolId: typeof body.modelImagePoolId === "string" ? body.modelImagePoolId : "",
      imageAutoPrompt: body.imageAutoPrompt === true,
      imageCandidateSelectionEnabled: body.imageCandidateSelectionEnabled === true,
      imageCandidateCount: typeof body.imageCandidateCount === "number" ? body.imageCandidateCount : 3,
      imageCandidateSelectionMode: body.imageCandidateSelectionMode === "first" ? "first" : "llm",
      imageCandidateQueueMode: body.imageCandidateQueueMode === "comfy" ? "comfy" : "sequential",
      imageCandidateProcessingMode: body.imageCandidateProcessingMode === "all" ? "all" : "selected",
      imageCreateVideo: body.imageCreateVideo === true,
      imageVideoMode: body.imageVideoMode === "text-image-to-video" || body.imageVideoMode === "both" ? body.imageVideoMode : "text-to-video",
      imageVideoPromptDirection: typeof body.imageVideoPromptDirection === "string" ? body.imageVideoPromptDirection : "",
      imageVideoWorkflowSettings: parseImageVideoWorkflowSettings(body.imageVideoWorkflowSettings),
      imagePostProcessingOptions: parseImagePostProcessingOptions(body.imagePostProcessingOptions),
      imagePostOptions: parseImagePostOptions(body.imagePostOptions),
      modelAutoPrompt: body.modelAutoPrompt === true,
      modelUseLlmMetadata: body.modelUseLlmMetadata === true || body.modelUseLlmModelFileName === true || body.modelUseLlmModelDescription === true,
      modelUseLlmModelFileName: body.modelUseLlmModelFileName === true || (body.modelUseLlmMetadata === true && body.modelUseLlmModelFileName !== false),
      modelUseLlmModelDescription: body.modelUseLlmModelDescription === true || (body.modelUseLlmMetadata === true && body.modelUseLlmModelDescription !== false),
      modelAskLlmIfShouldBeMetallic: body.modelAskLlmIfShouldBeMetallic === true,
      modelAskLlmForRealWorldHeightAndScale: body.modelAskLlmForRealWorldHeightAndScale === true,
      modelGenerationTarget: body.modelGenerationTarget === "remote" ? "remote" : "local",
      modelMetadataTarget: body.modelMetadataTarget === "remote" ? "remote" : "local",
      modelMetadataTiming: body.modelMetadataTiming === "after" || body.modelMetadataTiming === "parallel" ? body.modelMetadataTiming : "before",
      modelUnloadLlmBeforeGenerate: body.modelUnloadLlmBeforeGenerate !== false,
      modelRandomSource: body.modelRandomSource !== false,
      modelSendStartNotice: body.modelSendStartNotice !== false,
      modelPostOptions: parseModelPostOptions(body.modelPostOptions)
    }
  });
  dependencies.runtimeState.recordAction("dashboard:automation-join", `Saved join automation ${saved.name}.`);
  sendJson(response, 200, saved);
  return;
}

async function handlePostApiAutomationTextSourcesGenerate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const mode = body.mode === "replace" ? "replace" : "append";
  if (!fileName || !prompt) {
    sendJson(response, 400, { error: "fileName and prompt are required." });
    return;
  }
  const generated = await dependencies.generateAutomationTextSource({
    fileName,
    mode,
    prompt
  });
  dependencies.runtimeState.recordAction("dashboard:automation-text-source", `${mode} ${generated.summary.fileName}`);
  sendJson(response, 200, generated);
  return;
}

async function handlePostApiAutomationTextSources(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const mode = body.mode === "replace" ? "replace" : "append";
  if (!fileName || !content) {
    sendJson(response, 400, { error: "fileName and content are required." });
    return;
  }
  const summary = await dependencies.saveAutomationTextSource({
    fileName,
    mode,
    content
  });
  dependencies.runtimeState.recordAction("dashboard:automation-text-source", `${mode} ${summary.fileName}`);
  sendJson(response, 200, { summary, content });
  return;
}

async function handlePostApiImagePools(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const createNew = body.createNew === true;
  const images = Array.isArray(body.images)
    ? body.images.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  if (!name) {
    sendJson(response, 400, { error: "name is required." });
    return;
  }
  const saved = await dependencies.saveImagePool({
    id: createNew ? undefined : (typeof body.id === "string" ? body.id.trim() : undefined),
    name,
    images
  });
  dependencies.runtimeState.recordAction("dashboard:image-pool-save", `Saved image pool ${saved.name}.`);
  sendJson(response, 200, saved);
  return;
}

async function handlePostApiImagePoolsDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    sendJson(response, 400, { error: "id is required." });
    return;
  }
  const deleted = await dependencies.deleteImagePool(id);
  if (!deleted) {
    sendJson(response, 404, { error: "Image pool not found." });
    return;
  }
  dependencies.runtimeState.recordAction("dashboard:image-pool-delete", `Deleted image pool ${id}.`);
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiResourcePools(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const requestedKind = typeof body.kind === "string" ? body.kind : null;
  const kind = isDashboardResourcePoolKind(requestedKind) ? requestedKind : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const createNew = body.createNew === true;
  const entries = Array.isArray(body.entries)
    ? body.entries.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  if (!kind || !name) {
    sendJson(response, 400, { error: "kind and name are required." });
    return;
  }
  const saved = await saveDashboardResourcePool({
    kind,
    id: createNew ? undefined : (typeof body.id === "string" ? body.id.trim() : undefined),
    name,
    entries
  });
  dependencies.runtimeState.recordAction("dashboard:resource-pool-save", `Saved ${kind} pool ${saved.name}.`);
  sendJson(response, 200, saved);
  return;
}

async function handlePostApiResourcePoolsDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const requestedKind = typeof body.kind === "string" ? body.kind : null;
  const kind = isDashboardResourcePoolKind(requestedKind) ? requestedKind : null;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!kind || !id) {
    sendJson(response, 400, { error: "kind and id are required." });
    return;
  }
  const deleted = await deleteDashboardResourcePool(kind, id);
  if (!deleted) {
    sendJson(response, 404, { error: "Pool not found." });
    return;
  }
  dependencies.runtimeState.recordAction("dashboard:resource-pool-delete", `Deleted ${kind} pool ${id}.`);
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiJoinAutomationsDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    sendJson(response, 400, { error: "id is required." });
    return;
  }
  const deleted = await dependencies.deleteJoinAutomation(id);
  sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Automation not found." });
  return;
}

const dashboardAutomationRouteTable = createDashboardRouteTable([
  postRoute("/api/scheduled-automations", handlePostApiScheduledAutomations),
  postRoute("/api/scheduled-automations/delete", handlePostApiScheduledAutomationsDelete),
  postRoute("/api/join-automations", handlePostApiJoinAutomations),
  postRoute("/api/automation-text-sources", handlePostApiAutomationTextSources),
  postRoute("/api/automation-text-sources/generate", handlePostApiAutomationTextSourcesGenerate),
  postRoute("/api/image-pools", handlePostApiImagePools),
  postRoute("/api/image-pools/delete", handlePostApiImagePoolsDelete),
  postRoute("/api/resource-pools", handlePostApiResourcePools),
  postRoute("/api/resource-pools/delete", handlePostApiResourcePoolsDelete),
  postRoute("/api/join-automations/delete", handlePostApiJoinAutomationsDelete)
]);

export async function handleDashboardAutomationRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: DashboardDependencies
): Promise<boolean>{
  return dispatchDashboardRoute(dashboardAutomationRouteTable, {
    request,
    response,
    url,
    dependencies
  });
}
