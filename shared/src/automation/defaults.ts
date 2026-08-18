import {
  model3dDestinationExtraText,
  model3dInitialThreadExtraText
} from "../model3d.postText.js";
import type {
  AutomationAction,
  AutomationTextSourceSelectionMode,
  ImagePostProcessingOptions,
  ImageAutomationPostOptions,
  ImageAutomationPostTargetMode,
  AutomationTargetMessenger,
  ModelAutomationPostOptions,
  ScheduledAutomation
} from "./types.js";

export const defaultJokesFileName = "jokes.txt";

export const defaultAutomationAction: AutomationAction = {
  source: "template",
  template: "Hello from {server}.",
  prompt: "Write one short clean message for the {server} Discord server. Return only the message.",
  promptTextFile: "",
  textSourceSelectionMode: "random",
  jokesFile: defaultJokesFileName,
  textFiles: [defaultJokesFileName],
  modelImage: "",
  modelImagePoolId: "",
  imageAutoPrompt: false,
  imageAutoFileName: false,
  imageAutoDescription: false,
  imageCandidateSelectionEnabled: false,
  imageCandidateCount: 3,
  imageCandidateSelectionMode: "llm",
  imageCandidateQueueMode: "sequential",
  imageCandidateProcessingMode: "selected",
  imageCreateVideo: false,
  imageVideoMode: "text-to-video",
  imageVideoPromptDirection: "",
  imageVideoWorkflowSettings: {
    workflowPath: "comfyui-workflows/video/video_from_text.json",
    imageWorkflowPath: "comfyui-workflows/video/video_from_image_text.json",
    negativePrompt: "",
    width: 512,
    height: 512,
    frames: 13,
    fps: 6,
    steps: 25
  },
  modelAutoPrompt: false,
  imagePostOptions: {
    targetMode: "channel",
    threadNameMode: "fixed",
    threadName: "",
    threadNameBase: "Image Drop",
    forumChannelId: "",
    forumChannelName: "images",
    sendInitialToSelectedChannel: false,
    selectedChannelImageMode: "notice-only",
    selectedChannelImageLabels: [],
    initialExtraText: "",
    destinationExtraText: "",
    includeEmbed: true,
    variantTargets: []
  },
  modelUseLlmMetadata: false,
  modelUseLlmModelFileName: false,
  modelUseLlmModelDescription: false,
  modelAskLlmIfShouldBeMetallic: false,
  modelAskLlmForRealWorldHeightAndScale: false,
  modelGenerationTarget: "local",
  modelMetadataTarget: "local",
  modelMetadataTiming: "before",
  modelUnloadLlmBeforeGenerate: true,
  modelRandomSource: true,
  modelSendStartNotice: true,
  writePublishedMediaManifest: false,
  publishToUrageNetMediaGallery: false,
  modelPostOptions: {
    targetMode: "channel",
    threadNameMode: "fixed",
    threadName: "",
    threadNameBase: "Day",
    modelNameSource: "llm",
    forumChannelId: "",
    forumChannelName: "textures",
    lowPolyForumChannelId: "",
    lowPolyForumChannelName: "",
    sendInitialToSelectedChannel: false,
    sendSourceImageToSelectedChannel: false,
    initialExtraText: model3dInitialThreadExtraText,
    modelUploadTarget: "selected",
    includeModelFile: true,
    includePreviewMedia: true,
    includeSourceImage: true,
    includeEmbed: true,
    includeButtons: true,
    includeEmbedInInitial: true,
    uploadTextureMessages: false,
    uploadMultiViewTextures: true,
    uploadUvMapTextures: true,
    uploadNormalMapTextures: true,
    textureUploadTarget: "target",
    destinationExtraText: model3dDestinationExtraText,
    generateLowPolyVersion: false,
    lowPolyUseLlmTargetFaces: false,
    lowPolyLlmDecisionSource: "input-image",
    lowPolyTargetFaceCount: 1500
  }
};

export function normalizeImagePostProcessingOptions(options?: Partial<ImagePostProcessingOptions>): ImagePostProcessingOptions | undefined {
  if (!options) {
    return undefined;
  }
  const recipes = Array.isArray(options.recipes)
    ? options.recipes.map(recipe => ({
      label: recipe.label?.trim() || recipe.steps?.join(" > ") || "Image version",
      steps: Array.isArray(recipe.steps)
        ? recipe.steps.filter(step => step === "remove-background" || step === "delight" || step === "pixel-art")
        : []
    })).filter(recipe => recipe.steps.length > 0)
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

export function normalizeImagePostOptions(options?: Partial<ImageAutomationPostOptions>): ImageAutomationPostOptions {
  const targetMode = options?.targetMode === "thread" || options?.targetMode === "forum-post" || options?.targetMode === "forum-create-and-post"
    ? options.targetMode
    : "channel";
  const threadNameMode = options?.threadNameMode === "increment" || options?.threadNameMode === "image-name" ? options.threadNameMode : "fixed";
  const variantTargets = Array.isArray(options?.variantTargets)
    ? options.variantTargets.map(route => {
      const routeTargetMode: ImageAutomationPostTargetMode = route.targetMode === "thread" || route.targetMode === "forum-post" || route.targetMode === "forum-create-and-post" ? route.targetMode : "channel";
      const routePostMode: "combined" | "separate" | undefined = route.postMode === "separate" ? "separate" : route.postMode === "combined" ? "combined" : undefined;
      return {
        labels: Array.isArray(route.labels) ? route.labels.map(label => label.trim()).filter(Boolean) : [],
        channelId: route.channelId?.trim() || "",
        targetMode: routeTargetMode,
        threadName: route.threadName?.trim() || "",
        forumChannelId: route.forumChannelId?.trim() || "",
        forumChannelName: route.forumChannelName?.trim() || "",
        ...(routePostMode ? { postMode: routePostMode } : {})
      };
    }).filter(route => route.labels.length > 0 && (route.channelId || route.forumChannelId || route.forumChannelName))
    : [];
  return {
    targetMode,
    threadNameMode,
    threadName: options?.threadName?.trim() ?? "",
    threadNameBase: options?.threadNameBase?.trim() || "Image Drop",
    forumChannelId: options?.forumChannelId?.trim() || "",
    forumChannelName: options?.forumChannelName?.trim() || "images",
    sendInitialToSelectedChannel: options?.sendInitialToSelectedChannel === true,
    selectedChannelImageMode: options?.selectedChannelImageMode === "original" || options?.selectedChannelImageMode === "all" || options?.selectedChannelImageMode === "custom"
      ? options.selectedChannelImageMode
      : "notice-only",
    selectedChannelImageLabels: Array.isArray(options?.selectedChannelImageLabels)
      ? options.selectedChannelImageLabels.map(entry => entry.trim()).filter(Boolean)
      : [],
    initialExtraText: options?.initialExtraText?.trim() ?? "",
    destinationExtraText: options?.destinationExtraText?.trim() ?? "",
    includeEmbed: options?.includeEmbed !== false,
    variantTargets
  };
}

export function normalizeModelPostOptions(options?: Partial<ModelAutomationPostOptions>): ModelAutomationPostOptions {
  const targetMode = options?.targetMode === "thread" || options?.targetMode === "forum-post" || options?.targetMode === "forum-create-and-post"
    ? options.targetMode
    : "channel";
  const threadNameMode = options?.threadNameMode === "increment" || options?.threadNameMode === "model-name" ? options.threadNameMode : "fixed";
  const modelNameSource = options?.modelNameSource === "filename" ? "filename" : "llm";
  const textureUploadTarget = options?.textureUploadTarget === "selected" ? "selected" : "target";
  const modelUploadTarget = options?.modelUploadTarget === "target" ? "target" : "selected";
  const lowPolyLlmDecisionSource = options?.lowPolyLlmDecisionSource === "model-render" ? "model-render" : "input-image";
  const lowPolyTargetFaceCount = typeof options?.lowPolyTargetFaceCount === "number" && Number.isFinite(options.lowPolyTargetFaceCount)
    ? Math.max(1, Math.round(options.lowPolyTargetFaceCount))
    : 1500;
  return {
    targetMode,
    threadNameMode,
    threadName: options?.threadName?.trim() ?? "",
    threadNameBase: options?.threadNameBase?.trim() || "Day",
    modelNameSource,
    forumChannelId: options?.forumChannelId?.trim() || "",
    forumChannelName: options?.forumChannelName?.trim() || "textures",
    lowPolyForumChannelId: options?.lowPolyForumChannelId?.trim() || "",
    lowPolyForumChannelName: options?.lowPolyForumChannelName?.trim() || "",
    sendInitialToSelectedChannel: options?.sendInitialToSelectedChannel === true,
    sendSourceImageToSelectedChannel: options?.sendSourceImageToSelectedChannel === true,
    initialExtraText: options?.initialExtraText?.trim() ?? model3dInitialThreadExtraText,
    modelUploadTarget,
    includeModelFile: options?.includeModelFile !== false,
    includePreviewMedia: options?.includePreviewMedia !== false,
    includeSourceImage: options?.includeSourceImage !== false,
    includeEmbed: options?.includeEmbed !== false,
    includeButtons: options?.includeButtons !== false,
    includeEmbedInInitial: options?.includeEmbedInInitial !== false,
    uploadTextureMessages: options?.uploadTextureMessages === true,
    uploadMultiViewTextures: options?.uploadMultiViewTextures !== false,
    uploadUvMapTextures: options?.uploadUvMapTextures !== false,
    uploadNormalMapTextures: options?.uploadNormalMapTextures !== false,
    textureUploadTarget,
    destinationExtraText: options?.destinationExtraText?.trim() ?? model3dDestinationExtraText,
    generateLowPolyVersion: options?.generateLowPolyVersion === true,
    lowPolyUseLlmTargetFaces: options?.lowPolyUseLlmTargetFaces === true,
    lowPolyLlmDecisionSource,
    lowPolyTargetFaceCount
  };
}

function normalizeImageCandidateCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(12, Math.max(1, Math.round(value)))
    : 3;
}

export function normalizeTargetMessenger(value: unknown): AutomationTargetMessenger {
  return value === "telegram" || value === "matrix" ? value : "discord";
}

export function normalizeTextSourceSelectionMode(value: unknown): AutomationTextSourceSelectionMode {
  return value === "no-repeat" ? "no-repeat" : "random";
}

export function normalizeAction(action?: Partial<AutomationAction>): AutomationAction {
  const normalizedFiles = Array.isArray(action?.textFiles)
    ? action.textFiles.map(entry => entry.trim()).filter(Boolean)
    : [];
  const fallbackFile = action?.jokesFile?.trim() || defaultAutomationAction.jokesFile;
  const useLegacyLlmMetadata = action?.modelUseLlmMetadata === true;
  const useLlmModelFileName = action?.modelUseLlmModelFileName === true || (useLegacyLlmMetadata && action?.modelUseLlmModelFileName !== false);
  const useLlmModelDescription = action?.modelUseLlmModelDescription === true || (useLegacyLlmMetadata && action?.modelUseLlmModelDescription !== false);
  const modelMetadataTiming = action?.modelMetadataTiming === "after" || action?.modelMetadataTiming === "parallel"
    ? action.modelMetadataTiming
    : "before";
  return {
    source: action?.source ?? defaultAutomationAction.source,
    template: action?.template ?? defaultAutomationAction.template,
    prompt: action?.prompt ?? defaultAutomationAction.prompt,
    promptTextFile: action?.promptTextFile?.trim() ?? defaultAutomationAction.promptTextFile,
    textSourceSelectionMode: normalizeTextSourceSelectionMode(action?.textSourceSelectionMode),
    jokesFile: fallbackFile,
    textFiles: normalizedFiles.length > 0 ? normalizedFiles : [fallbackFile],
    modelImage: action?.modelImage ?? defaultAutomationAction.modelImage,
    modelImagePoolId: action?.modelImagePoolId?.trim() ?? defaultAutomationAction.modelImagePoolId,
    imageAutoPrompt: action?.imageAutoPrompt === true,
    imageAutoFileName: action?.imageAutoFileName === true,
    imageAutoDescription: action?.imageAutoDescription === true,
    imageCandidateSelectionEnabled: action?.imageCandidateSelectionEnabled === true,
    imageCandidateCount: normalizeImageCandidateCount(action?.imageCandidateCount),
    imageCandidateSelectionMode: action?.imageCandidateSelectionMode === "first" ? "first" : "llm",
    imageCandidateQueueMode: action?.imageCandidateQueueMode === "comfy" ? "comfy" : "sequential",
    imageCandidateProcessingMode: action?.imageCandidateProcessingMode === "all" ? "all" : "selected",
    imageCreateVideo: action?.imageCreateVideo === true,
    imageVideoMode: action?.imageVideoMode === "text-image-to-video" || action?.imageVideoMode === "both" ? action.imageVideoMode : "text-to-video",
    imageVideoPromptDirection: action?.imageVideoPromptDirection?.trim() ?? "",
    imageVideoWorkflowSettings: {
      workflowPath: action?.imageVideoWorkflowSettings?.workflowPath?.trim() || defaultAutomationAction.imageVideoWorkflowSettings?.workflowPath || "",
      imageWorkflowPath: action?.imageVideoWorkflowSettings?.imageWorkflowPath?.trim() || defaultAutomationAction.imageVideoWorkflowSettings?.imageWorkflowPath || "",
      negativePrompt: action?.imageVideoWorkflowSettings?.negativePrompt?.trim() || "",
      width: typeof action?.imageVideoWorkflowSettings?.width === "number" ? action.imageVideoWorkflowSettings.width : defaultAutomationAction.imageVideoWorkflowSettings?.width,
      height: typeof action?.imageVideoWorkflowSettings?.height === "number" ? action.imageVideoWorkflowSettings.height : defaultAutomationAction.imageVideoWorkflowSettings?.height,
      frames: typeof action?.imageVideoWorkflowSettings?.frames === "number" ? action.imageVideoWorkflowSettings.frames : defaultAutomationAction.imageVideoWorkflowSettings?.frames,
      fps: typeof action?.imageVideoWorkflowSettings?.fps === "number" ? action.imageVideoWorkflowSettings.fps : defaultAutomationAction.imageVideoWorkflowSettings?.fps,
      steps: typeof action?.imageVideoWorkflowSettings?.steps === "number" ? action.imageVideoWorkflowSettings.steps : defaultAutomationAction.imageVideoWorkflowSettings?.steps
    },
    imagePostProcessingOptions: normalizeImagePostProcessingOptions(action?.imagePostProcessingOptions),
    imagePostOptions: normalizeImagePostOptions(action?.imagePostOptions),
    modelAutoPrompt: action?.modelAutoPrompt === true,
    modelUseLlmMetadata: useLlmModelFileName || useLlmModelDescription,
    modelUseLlmModelFileName: useLlmModelFileName,
    modelUseLlmModelDescription: useLlmModelDescription,
    modelAskLlmIfShouldBeMetallic: action?.modelAskLlmIfShouldBeMetallic === true,
    modelAskLlmForRealWorldHeightAndScale: action?.modelAskLlmForRealWorldHeightAndScale === true,
    modelGenerationTarget: action?.modelGenerationTarget === "remote" ? "remote" : "local",
    modelMetadataTarget: action?.modelMetadataTarget === "remote" ? "remote" : "local",
    modelMetadataTiming,
    modelUnloadLlmBeforeGenerate: action?.modelUnloadLlmBeforeGenerate !== false,
    modelRandomSource: action?.modelRandomSource !== false,
    modelSendStartNotice: action?.modelSendStartNotice !== false,
    writePublishedMediaManifest: action?.writePublishedMediaManifest === true,
    publishToUrageNetMediaGallery: action?.publishToUrageNetMediaGallery === true,
    modelPostOptions: normalizeModelPostOptions(action?.modelPostOptions)
  };
}

export function normalizeScheduledAutomation(entry: ScheduledAutomation): ScheduledAutomation {
  return {
    ...entry,
    targetMessenger: normalizeTargetMessenger(entry.targetMessenger),
    channelId: String(entry.channelId || "").trim(),
    triggerMode: entry.triggerMode === "interval" ? "interval" : "cron",
    cron: entry.cron?.trim() || "0 9 * * *",
    intervalValue: Math.max(1, Math.floor(entry.intervalValue || 1)),
    intervalUnit: entry.intervalUnit ?? "days",
    repeatCount: Math.max(1, Math.floor(entry.repeatCount || 1)),
    repeatDelaySeconds: Math.max(0, Math.floor(entry.repeatDelaySeconds || 0)),
    action: normalizeAction(entry.action),
    createdAt: entry.createdAt || new Date().toISOString(),
    lastRunAt: entry.lastRunAt ?? null
  };
}
