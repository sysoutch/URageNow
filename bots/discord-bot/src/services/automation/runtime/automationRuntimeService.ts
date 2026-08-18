import { normalizeImagePostOptions, type ImageAutomationPostOptions, type ImagePostProcessingOptions } from "@urage/shared/automation/index";
import { buildModelPostSummaryExtraContent } from "../../model3d/post/modelPostHelpers.js";

function inferImageFileNameHint(imageInput: string): string | undefined {
  const trimmed = imageInput.trim();
  if (!trimmed) {
    return undefined;
  }
  const generatedImageMatch = trimmed.match(/[?&]file=([^&#]+)/i);
  if (generatedImageMatch?.[1]) {
    return decodeURIComponent(generatedImageMatch[1]);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const fromUrl = parsed.pathname.split("/").pop()?.trim();
      return fromUrl || undefined;
    } catch {
      return undefined;
    }
  }
  if (!trimmed.includes("\\") && !trimmed.includes("/")) {
    return undefined;
  }
  return trimmed.split(/[\\/]/).pop()?.trim() || undefined;
}

function buildMetadataPrompt(resolvedPrompt: string, imageInput: string): string {
  const promptText = resolvedPrompt.trim();
  if (promptText) {
    return promptText;
  }
  return imageInput.trim()
    ? "Generate a concise file name and one short Discord description for this source image."
    : "";
}

function formatMetersTriplet(widthMeters: number | null | undefined, heightMeters: number | null | undefined, depthMeters: number | null | undefined): string {
  const width = typeof widthMeters === "number" && Number.isFinite(widthMeters) && widthMeters > 0 ? widthMeters : null;
  const height = typeof heightMeters === "number" && Number.isFinite(heightMeters) && heightMeters > 0 ? heightMeters : null;
  const depth = typeof depthMeters === "number" && Number.isFinite(depthMeters) && depthMeters > 0 ? depthMeters : null;
  if (width === null || height === null || depth === null) {
    return "";
  }
  return `${width.toFixed(2)}m × ${height.toFixed(2)}m × ${depth.toFixed(2)}m`;
}

function buildModelFollowUpProgressText(input: {
  askLlmIfShouldBeMetallic?: boolean;
  askLlmForRealWorldHeightAndScale?: boolean;
  useLlmModelDescription?: boolean;
  plannedModelDescription?: string | null;
  generated: {
    modelFileName?: string;
    lowPolyRealWorldWidthMeters?: number | null;
    lowPolyRealWorldHeightMeters?: number | null;
    lowPolyRealWorldDepthMeters?: number | null;
  };
}): string {
  const pendingTasks: string[] = [];
  if (input.askLlmForRealWorldHeightAndScale === true) pendingTasks.push("size and real-world dimensions");
  if (input.askLlmIfShouldBeMetallic === true) pendingTasks.push("metallic material");
  if (input.useLlmModelDescription === true) pendingTasks.push("Discord description");
  const dimensionsText = formatMetersTriplet(
    input.generated.lowPolyRealWorldWidthMeters,
    input.generated.lowPolyRealWorldHeightMeters,
    input.generated.lowPolyRealWorldDepthMeters
  );
  const descriptionText = String(input.plannedModelDescription || "").trim();
  const lines = [
    `🧊 The 3D model is created: \`${String(input.generated.modelFileName || "model.glb").trim() || "model.glb"}\``
  ];
  if (pendingTasks.length > 0) {
    lines.push(`✨ I already checked ${pendingTasks.join(", ")} so I can prepare the final post cleanly.`);
  } else {
    lines.push("✨ The render preview is already ready and I am posting the final files next.");
  }
  if (descriptionText) lines.push(`📝 ${descriptionText}`);
  if (dimensionsText) lines.push(`📏 ${dimensionsText}`);
  return lines.join("\n");
}

type AutomationRuntimeServiceDependencies = {
  createAutomationEngine: (input: {
    askModel: (prompt: string) => Promise<string>;
    buildGiftMessageIfAvailable?: () => Promise<string | null>;
    sendMessageToChannel: (channelId: string, content: string) => Promise<void>;
    sendTelegramMessage?: (chatId: string, text: string) => Promise<void>;
    sendTelegramPhoto?: (input: { chatId: string; imageUrl: string; caption?: string; }) => Promise<void>;
    sendMatrixMessage?: (roomId: string, text: string) => Promise<void>;
    generateImageForAutomation?: (input: {
      prompt?: string;
      autoPrompt?: boolean;
      source: "scheduled" | "join";
    }) => Promise<{
      imageUrl: string;
      prompt: string;
    }>;
    sendImageToChannel: (input: any) => Promise<any[]>;
    resolveImagePoolEntries: (poolId: string) => Promise<any[]>;
    sendModelToChannel: (input: any) => Promise<any[]>;
    runtimeState: any;
    getGuildName: (guildId: string) => string | null;
  }) => any;
  askText: (prompt: string) => Promise<string>;
  buildGiftMessageIfAvailable: () => Promise<string | null>;
  sendMessageToChannel: (channelId: string, content: string) => Promise<void>;
  sendTelegramMessage: (chatId: string, text: string) => Promise<void>;
  sendTelegramPhoto: (input: { chatId: string; imageUrl: string; caption?: string; }) => Promise<void>;
  sendMatrixMessage: (roomId: string, text: string) => Promise<void>;
  generateImageFromPrompt: (input: {
    prompt?: string;
    negativePrompt?: string;
    autoPrompt?: boolean;
    autoFileName?: boolean;
    autoFileNameTiming?: "before" | "after" | "parallel";
    imageInput?: string;
    imageFileNameHint?: string;
    workflowPathOverride?: string;
    skipPromptResolution?: boolean;
    batchSize?: number;
    channelId?: string | null;
    requestedBy?: string;
  }) => Promise<any>;
  generateVideoFromPrompt: (input: {
    prompt: string;
    negativePrompt?: string;
    workflowPath?: string;
    imageDataUrl?: string;
    imageFileName?: string;
    contentLabel?: string;
    width?: number;
    height?: number;
    frames?: number;
    fps?: number;
    steps?: number;
    channelId?: string | null;
    requestedBy?: string;
  }) => Promise<any>;
  processGeneratedVideoFollowUp: (input: {
    channelId: string;
    video: any;
    postProcessingOptions?: ImagePostProcessingOptions;
    imagePostOptions?: ImageAutomationPostOptions;
    fps?: number;
    width?: number;
  }) => Promise<void>;
  resolveImagePrompt: (input: { prompt?: string; autoPrompt?: boolean }) => Promise<string>;
  suggestImageDescription: (input: { prompt: string }) => Promise<string>;
  postGeneratedImagesToChannel: (input: {
    channelId: string;
    images: Array<{ label: string; record: any; }>;
    postMode: "combined" | "separate";
    content: string;
    postOptions?: ImageAutomationPostOptions;
  }) => Promise<any[]>;
  convertGeneratedImageToPixelArt: (record: any) => Promise<any>;
  getImagePoolEntries: (poolId: string) => Promise<any[]>;
  runtimeState: any;
  resolvePublicAssetUrl: (assetPath: string) => string;
  resolveModelPrompt: (input: { prompt?: string; autoPrompt?: boolean }) => Promise<string>;
  suggestModelMetadataRemote: (input: { prompt: string; imageInput?: string; preferVisualModel: boolean }) => Promise<{ fileName: string | null; description: string | null }>;
  suggestModelMetadataLocal: (input: { prompt: string; sourceImageInput?: string; preferVisualModel: boolean }) => Promise<{ fileName: string | null; description: string | null }>;
  suggestLowPolyByComplexity: (input: {
    promptContext?: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<{ targetFaceCount: number }>;
  suggestModelMetallicDecisionRemote: (input: { promptContext?: string; sourceImageInput?: string; extraContext?: string; preferVisualModel?: boolean }) => Promise<{
    classification: "metallic" | "non-metallic" | "mixed";
    reason: string;
    usedVisionModel: boolean;
  }>;
  suggestModelMetallicDecisionLocal: (input: { promptContext?: string; sourceImageInput?: string; extraContext?: string; preferVisualModel?: boolean }) => Promise<{
    classification: "metallic" | "non-metallic" | "mixed";
    reason: string;
    usedVisionModel: boolean;
  }>;
  suggestModelRealWorldHeightRemote: (input: { promptContext?: string; sourceImageInput?: string; extraContext?: string; preferVisualModel?: boolean }) => Promise<{
    objectLabel: string;
    heightMeters: number;
    reason: string;
    usedVisionModel: boolean;
  }>;
  suggestModelRealWorldHeightLocal: (input: { promptContext?: string; sourceImageInput?: string; extraContext?: string; preferVisualModel?: boolean }) => Promise<{
    objectLabel: string;
    heightMeters: number;
    reason: string;
    usedVisionModel: boolean;
  }>;
  applyModelMetallicWithExecution: (input: { modelId: string; metallicEnabled: boolean }, executionTarget: "local" | "remote") => Promise<any>;
  applyModelScaleToHeightWithExecution: (input: { modelId: string; targetHeightMeters: number }, executionTarget: "local" | "remote") => Promise<any>;
  ejectActiveLlmModelsViaRemoteWorker: () => Promise<any>;
  ejectActiveOllamaModels: () => Promise<any>;
  postModelGenerationStartNotice: (input: {
    channelId: string;
    imageInput: string;
    imageFileNameHint?: string;
    prompt?: string;
    requestedBy?: string;
  }) => Promise<{ messageId: string | null; messageUrl: string | null }>;
  generate3dModelWithExecution: (input: { imageInput: string; prompt?: string; stripMetadata: boolean }, executionTarget: "local" | "remote") => Promise<any>;
  toGeneratedModelPublicRecord: (input: any) => any;
  renameGeneratedModelFileName: (modelId: string, fileName: string) => Promise<any>;
  mergeContentBlocks: (segments: any[]) => string | undefined;
  postExistingGeneratedModelToChannel: (input: any) => Promise<any>;
  getGuildName: (guildId: string) => string | null;
};

type AutomationRuntimeService = {
  createAutomationEngineInstance: () => any;
};

const automationRemoveBackgroundWorkflowPath = "comfyui-workflows/image/lora_rembg.json";
const automationDelightWorkflowPath = "comfyui-workflows/image/image_delight.json";
type ImagePostProcessingRecipeRuntime = { label: string; steps: Array<"remove-background" | "delight" | "pixel-art">; };

function hasImagePostProcessingOptions(options: ImagePostProcessingOptions | undefined): boolean {
  return options?.removeBackground === true || options?.delight === true || options?.pixelArt === true || Boolean(options?.recipes && options.recipes.length > 0);
}

function hasImagePostRoutingOptions(options: ImageAutomationPostOptions | undefined): boolean {
  return Boolean(options && (options.targetMode !== "channel" || options.sendInitialToSelectedChannel === true || String(options.destinationExtraText || "").trim() || options.includeEmbed === false || (options.variantTargets && options.variantTargets.length > 0)));
}

function normalizeImageCandidateCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(12, Math.max(1, Math.round(value)))
    : 3;
}

function getGeneratedImageRecordLabel(record: any, index: number): string {
  return [
    `Candidate ${index + 1}`,
    String(record?.imageFileName || "").trim(),
    String(record?.prompt || "").trim()
  ].filter(Boolean).join(" | ");
}

function buildGeneratedImageApiSource(record: any): string {
  const imageId = String(record?.id || "").trim();
  const fileName = String(record?.imageFileName || "").trim();
  return imageId && fileName
    ? `/api/generated-image-file?imageId=${encodeURIComponent(imageId)}&file=${encodeURIComponent(fileName)}`
    : String(record?.imageUrl || "").trim();
}

function parseCandidateSelectionIndex(value: string, max: number): number {
  const direct = Number.parseInt(value.trim(), 10);
  if (Number.isFinite(direct) && direct >= 1 && direct <= max) {
    return direct - 1;
  }
  const match = value.match(/\b(?:candidate|image|option)\s*([0-9]{1,2})\b/i);
  const parsed = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= max ? parsed - 1 : 0;
}

export function createAutomationRuntimeService(dependencies: AutomationRuntimeServiceDependencies): AutomationRuntimeService {
  function createAutomationEngineInstance(): any {
    const transformGeneratedImage = async (record: any, step: "remove-background" | "delight" | "pixel-art"): Promise<any> => {
      if (step === "pixel-art") {
        return dependencies.convertGeneratedImageToPixelArt(record);
      }
      const imageInput = buildGeneratedImageApiSource(record);
      return dependencies.generateImageFromPrompt({
        prompt: "",
        imageInput: imageInput || dependencies.resolvePublicAssetUrl(String(record.imageUrl || "")),
        imageFileNameHint: String(record.imageFileName || "automation-image.png"),
        workflowPathOverride: step === "delight" ? automationDelightWorkflowPath : automationRemoveBackgroundWorkflowPath,
        skipPromptResolution: true,
        autoPrompt: false,
        autoFileName: false,
        channelId: null,
        requestedBy: "automation"
      });
    };
    const createVideoFollowUpPrompt = async (input: { imagePrompt: string; direction?: string; }): Promise<string> => {
      const imagePrompt = String(input.imagePrompt || "").trim();
      const direction = String(input.direction || "").trim();
      const prompt = [
        "Write exactly one high quality video generation prompt for a Discord automation follow-up.",
        "Return plain prompt text only, no markdown, no quotes, no explanation.",
        "Focus on visible motion, camera movement, subject action, atmosphere, and temporal change.",
        imagePrompt ? "Base image prompt: " + imagePrompt : "",
        direction ? "Direction: " + direction : ""
      ].filter(Boolean).join("\n");
      const generated = await dependencies.askText(prompt);
      return String(generated || "").trim().replace(/^["'`]+|["'`]+$/g, "") || imagePrompt || direction || "A short cinematic motion clip with gentle camera movement.";
    };
    const maybeGenerateVideoFollowUp = async (input: { channelId: string; imagePrompt: string; direction?: string; enabled?: boolean; videoMode?: string; workflowSettings?: any; sourceImageUrl?: string; imagePostOptions?: ImageAutomationPostOptions; }): Promise<void> => {
      if (input.enabled !== true) {
        return;
      }
      const videoPrompt = await createVideoFollowUpPrompt({
        imagePrompt: input.imagePrompt,
        direction: input.direction
      });
      const settings = input.workflowSettings || {};
      const mode = input.videoMode === "text-image-to-video" || input.videoMode === "both" ? input.videoMode : "text-to-video";
      const generatedVideos: any[] = [];
      const generateVariant = async (variantInput: any, label: string): Promise<void> => {
        try {
          generatedVideos.push(await dependencies.generateVideoFromPrompt(variantInput));
        } catch (error) {
          console.warn(`Automation video follow-up ${label} failed. Continuing with remaining video work.`, error);
        }
      };
      if (mode === "text-to-video" || mode === "both") {
        await generateVariant({
          prompt: videoPrompt,
          negativePrompt: settings.negativePrompt,
          workflowPath: settings.workflowPath,
          width: settings.width,
          height: settings.height,
          frames: settings.frames,
          fps: settings.fps,
          steps: settings.steps,
          channelId: input.channelId,
          requestedBy: "automation",
          contentLabel: "Automated text-to-video follow-up is ready!"
        }, "text-to-video");
      }
      if ((mode === "text-image-to-video" || mode === "both") && input.sourceImageUrl) {
        await generateVariant({
          prompt: videoPrompt,
          negativePrompt: settings.negativePrompt,
          workflowPath: settings.imageWorkflowPath,
          imageDataUrl: input.sourceImageUrl,
          imageFileName: "automation-source-image.png",
          width: settings.width,
          height: settings.height,
          frames: settings.frames,
          fps: settings.fps,
          steps: settings.steps,
          channelId: input.channelId,
          requestedBy: "automation",
          contentLabel: "Automated text + image video follow-up is ready!"
        }, "text-image-to-video");
      }
      if (mode === "text-image-to-video" && !input.sourceImageUrl) {
        await generateVariant({
          prompt: videoPrompt,
          negativePrompt: settings.negativePrompt,
          workflowPath: settings.workflowPath,
          width: settings.width,
          height: settings.height,
          frames: settings.frames,
          fps: settings.fps,
          steps: settings.steps,
          channelId: input.channelId,
          requestedBy: "automation",
          contentLabel: "Automated video follow-up is ready!"
        }, "text-to-video fallback");
      }
      for (const generated of generatedVideos) {
        try {
          await dependencies.processGeneratedVideoFollowUp({
            channelId: input.channelId,
            video: generated,
            postProcessingOptions: settings.postProcessingOptions,
            imagePostOptions: input.imagePostOptions,
            fps: settings.fps,
            width: settings.width
          });
        } catch (error) {
          console.warn("Automation post-video GIF processing failed. Continuing with remaining video work.", error);
        }
      }
    };
    const getDefaultImageRecipeSteps = (options: ImagePostProcessingOptions | undefined): ImagePostProcessingRecipeRuntime["steps"] => {
      const orderedSteps: ImagePostProcessingRecipeRuntime["steps"] = [];
      if (options?.delight === true) orderedSteps.push("delight");
      if (options?.removeBackground === true) orderedSteps.push("remove-background");
      if (options?.pixelArt === true) orderedSteps.push("pixel-art");
      return orderedSteps;
    };
    const isLegacyToggleRecipeSet = (options: ImagePostProcessingOptions | undefined): boolean => {
      const recipes = options?.recipes || [];
      const defaultSteps = getDefaultImageRecipeSteps(options);
      if (recipes.length === 0 || defaultSteps.length === 0 || recipes.length !== defaultSteps.length) return false;
      const recipeSteps = recipes.map(recipe => recipe.steps.length === 1 ? recipe.steps[0] : "").filter(Boolean).sort();
      return recipeSteps.length === defaultSteps.length && [...defaultSteps].sort().every((step, index) => step === recipeSteps[index]);
    };
    const buildImageRecipes = (options: ImagePostProcessingOptions | undefined): ImagePostProcessingRecipeRuntime[] => {
      if (options?.recipes && options.recipes.length > 0 && !isLegacyToggleRecipeSet(options)) {
        return options.recipes.map(recipe => ({
          label: recipe.label || recipe.steps.join(" > "),
          steps: recipe.steps
        })).filter(recipe => recipe.steps.length > 0);
      }
      const recipes: ImagePostProcessingRecipeRuntime[] = [];
      const orderedSteps = getDefaultImageRecipeSteps(options);
      if (orderedSteps.length > 0) {
        recipes.push({ label: orderedSteps.join(" > "), steps: orderedSteps });
      }
      return recipes;
    };
    const generateAutomationImageCandidates = async (input: any, resolvedPrompt?: string): Promise<any[]> => {
      const count = input.imageCandidateSelectionEnabled === true ? normalizeImageCandidateCount(input.imageCandidateCount) : 1;
      const queueMode = input.imageCandidateQueueMode === "comfy" ? "comfy" : "sequential";
      const prompt = resolvedPrompt ?? await dependencies.resolveImagePrompt({
        prompt: input.prompt,
        autoPrompt: input.autoPrompt
      });
      const generateOne = () => dependencies.generateImageFromPrompt({
        prompt: prompt || input.prompt,
        autoPrompt: false,
        autoFileName: input.imageAutoFileName === true,
        autoFileNameTiming: input.imageAutoFileName === true ? "before" : undefined,
        batchSize: 1,
        channelId: null,
        requestedBy: "automation"
      });
      if (count <= 1) {
        return [await generateOne()];
      }
      if (queueMode === "comfy") {
        return Promise.all(Array.from({ length: count }, () => generateOne()));
      }
      const records: any[] = [];
      for (let index = 0; index < count; index += 1) {
        records.push(await generateOne());
      }
      return records;
    };
    const selectAutomationImageCandidate = async (input: any, records: any[], resolvedPrompt?: string): Promise<any> => {
      if (records.length <= 1 || input.imageCandidateSelectionMode === "first") {
        return records[0];
      }
      const prompt = [
        "Choose the best generated image candidate for this Discord automation.",
        "Return only the candidate number.",
        resolvedPrompt ? "Image prompt: " + resolvedPrompt : "",
        records.map((record, index) => `${index + 1}. ${getGeneratedImageRecordLabel(record, index)}`).join("\n")
      ].filter(Boolean).join("\n\n");
      try {
        const selection = await dependencies.askText(prompt);
        return records[parseCandidateSelectionIndex(String(selection || ""), records.length)] || records[0];
      } catch (error) {
        console.warn("Failed to choose automation image candidate. Using the first candidate.", error);
        return records[0];
      }
    };
    const buildImagesForAutomationCandidates = async (input: any, records: any[], selectedRecord: any, postOptions: ImagePostProcessingOptions | undefined): Promise<Array<{ label: string; record: any; }>> => {
      const processAll = String(input.imageCandidateProcessingMode || "").trim() === "all" && records.length > 1;
      const sourceRecords = processAll ? records : [selectedRecord];
      const images: Array<{ label: string; record: any; }> = [];
      for (let index = 0; index < sourceRecords.length; index += 1) {
        const sourceRecord = sourceRecords[index];
        const prefix = processAll ? `Candidate ${index + 1} ` : "";
        images.push({ label: `${prefix}Original`.trim(), record: sourceRecord });
        for (const recipe of buildImageRecipes(postOptions)) {
          let current = sourceRecord;
          for (const step of recipe.steps) {
            current = await transformGeneratedImage(current, step);
          }
          images.push({
            label: `${prefix}${recipe.label}`.trim(),
            record: current
          });
        }
      }
      return images;
    };
    return dependencies.createAutomationEngine({
      askModel: async prompt => dependencies.askText(prompt),
      buildGiftMessageIfAvailable: dependencies.buildGiftMessageIfAvailable,
      sendMessageToChannel: dependencies.sendMessageToChannel,
      sendTelegramMessage: dependencies.sendTelegramMessage,
      sendTelegramPhoto: dependencies.sendTelegramPhoto,
      sendMatrixMessage: dependencies.sendMatrixMessage,
      generateImageForAutomation: async input => {
        const generated = await dependencies.generateImageFromPrompt({
          prompt: input.prompt,
          autoPrompt: input.autoPrompt,
          channelId: null,
          requestedBy: "automation"
        });
        return {
          imageUrl: dependencies.resolvePublicAssetUrl(String(generated.imageUrl || "")),
          prompt: String(generated.prompt || "")
        };
      },
      sendImageToChannel: async input => {
        const postOptions = input.imagePostProcessingOptions as ImagePostProcessingOptions | undefined;
        const imagePostOptions = input.imagePostOptions as ImageAutomationPostOptions | undefined;
        const usesCandidateSelection = input.imageCandidateSelectionEnabled === true && normalizeImageCandidateCount(input.imageCandidateCount) > 1;
        if (!usesCandidateSelection && !hasImagePostProcessingOptions(postOptions) && !hasImagePostRoutingOptions(imagePostOptions) && input.writePublishedMediaManifest !== true) {
          const generated = await dependencies.generateImageFromPrompt({
            prompt: input.prompt,
            autoPrompt: input.autoPrompt,
            autoFileName: input.imageAutoFileName === true,
            channelId: input.channelId,
            requestedBy: "automation"
          });
          await maybeGenerateVideoFollowUp({
            channelId: input.channelId,
            imagePrompt: String(generated.prompt || input.prompt || ""),
            direction: input.imageVideoPromptDirection,
          enabled: input.imageCreateVideo === true,
          videoMode: input.imageVideoMode,
          workflowSettings: { ...(input.imageVideoWorkflowSettings || {}), postProcessingOptions: postOptions },
          sourceImageUrl: buildGeneratedImageApiSource(generated) || dependencies.resolvePublicAssetUrl(String(generated.imageUrl || "")),
          imagePostOptions
        });
          return [];
        }
        const resolvedPrompt = await dependencies.resolveImagePrompt({
          prompt: input.prompt,
          autoPrompt: input.autoPrompt
        });
        const plannedDescription = input.imageAutoDescription === true
          ? await dependencies.suggestImageDescription({ prompt: resolvedPrompt }).catch(error => {
            console.warn("Failed to prepare automation image description. Continuing without it.", error);
            return "";
          })
          : "";
        const candidates = await generateAutomationImageCandidates(input, resolvedPrompt);
        const original = await selectAutomationImageCandidate(input, candidates, resolvedPrompt);
        const images = await buildImagesForAutomationCandidates(input, candidates, original, postOptions);
        const publishedAssets = await dependencies.postGeneratedImagesToChannel({
          channelId: input.channelId,
          images,
          postMode: postOptions?.postMode === "separate" ? "separate" : "combined",
          content: "🖼️ Automated image drop is ready!",
          postOptions: plannedDescription
            ? { ...normalizeImagePostOptions(imagePostOptions), destinationExtraText: [plannedDescription, imagePostOptions?.destinationExtraText].map(part => String(part || "").trim()).filter(Boolean).join("\n\n") }
            : imagePostOptions
        });
        await maybeGenerateVideoFollowUp({
          channelId: input.channelId,
          imagePrompt: String(original.prompt || resolvedPrompt || input.prompt || ""),
          direction: input.imageVideoPromptDirection,
          enabled: input.imageCreateVideo === true,
          videoMode: input.imageVideoMode,
          workflowSettings: { ...(input.imageVideoWorkflowSettings || {}), postProcessingOptions: postOptions },
          sourceImageUrl: buildGeneratedImageApiSource(original) || dependencies.resolvePublicAssetUrl(String(original.imageUrl || "")),
          imagePostOptions
        });
        return publishedAssets;
      },
      resolveImagePoolEntries: dependencies.getImagePoolEntries,
      sendModelToChannel: async input => {
        const globalSettings = dependencies.runtimeState.getGlobalDashboardSettings();
        const resolvedPrompt = await dependencies.resolveModelPrompt({
          prompt: input.prompt,
          autoPrompt: input.autoPrompt
        });
        const generationExecutionTarget = input.generationExecutionTarget ?? globalSettings.model3dGenerationTarget;
        const metadataExecutionTarget = input.metadataExecutionTarget ?? globalSettings.model3dMetadataTarget;
        const metadataTiming = input.metadataTiming === "after" || input.metadataTiming === "parallel" ? input.metadataTiming : "before";
        const useLlmModelFileName = input.useLlmModelFileName === true || (input.useLlmMetadata === true && input.useLlmModelFileName !== false);
        const useLlmModelDescription = input.useLlmModelDescription === true || (input.useLlmMetadata === true && input.useLlmModelDescription !== false);
        const useLlmMetadata = useLlmModelFileName || useLlmModelDescription;
        let plannedModelFileName: string | null = null;
        let plannedModelDescription: string | null = null;
        let plannedLowPolyTargetFaceCount: number | null = null;
        const planLlmMetadata = async (): Promise<void> => {
          try {
            const preferVisual = globalSettings.ollamaTextModelIsVisual;
            if (useLlmMetadata) {
              const metadataPrompt = buildMetadataPrompt(
                dependencies.mergeContentBlocks([resolvedPrompt]) ?? "",
                input.imageInput
              );
              const metadataImageInput = metadataPrompt ? undefined : input.imageInput;
              const suggestion = metadataExecutionTarget === "remote"
                ? await dependencies.suggestModelMetadataRemote({
                  prompt: metadataPrompt,
                  imageInput: metadataImageInput,
                  preferVisualModel: preferVisual
                })
                : await dependencies.suggestModelMetadataLocal({
                  prompt: metadataPrompt,
                  sourceImageInput: metadataImageInput,
                  preferVisualModel: preferVisual
                });
              plannedModelFileName = suggestion.fileName;
              plannedModelDescription = suggestion.description;
            }
            const lowPolyDecisionSource = input.modelPostOptions?.lowPolyLlmDecisionSource === "model-render" ? "model-render" : "input-image";
            if (input.modelPostOptions?.generateLowPolyVersion && input.modelPostOptions?.lowPolyUseLlmTargetFaces && lowPolyDecisionSource === "input-image") {
              const complexityDecision = await dependencies.suggestLowPolyByComplexity({
                promptContext: resolvedPrompt,
                sourceImageInput: input.imageInput,
                extraContext: input.modelPostOptions?.destinationExtraText,
                preferVisualModel: preferVisual,
                executionTarget: metadataExecutionTarget
              });
              plannedLowPolyTargetFaceCount = complexityDecision.targetFaceCount;
            }
          } catch (error) {
            console.warn("Failed to prepare LLM metadata planning. Continuing without planned metadata.", error);
          }
        };
        let metadataPlanPromise: Promise<void> | null = null;
        if (useLlmMetadata && metadataTiming === "before") {
          await planLlmMetadata();
        } else if (useLlmMetadata && metadataTiming === "parallel") {
          metadataPlanPromise = planLlmMetadata();
        }
        const skipUnloadForParallelMetadata = useLlmMetadata && metadataTiming === "parallel";
        if (input.unloadLlmBeforeGenerate !== false && !skipUnloadForParallelMetadata) {
          const unloadResult = metadataExecutionTarget === "remote" ? await dependencies.ejectActiveLlmModelsViaRemoteWorker() : await dependencies.ejectActiveOllamaModels();
          if (Array.isArray(unloadResult?.failed) && unloadResult.failed.length > 0) {
            console.warn("Automation pre-generation LLM unload had failures.", unloadResult.failed);
          }
        }
        let startNoticeMessageId = "";
        if (input.sendStartNotice !== false || input.modelPostOptions?.sendSourceImageToSelectedChannel === true) {
          try {
            const startNotice = await dependencies.postModelGenerationStartNotice({
              channelId: input.channelId,
              imageInput: input.imageInput,
              imageFileNameHint: inferImageFileNameHint(input.imageInput),
              prompt: resolvedPrompt || undefined,
              requestedBy: "automation"
            });
            startNoticeMessageId = startNotice.messageId || "";
          } catch (error) {
            console.warn("Failed to send automation model generation start notice.", error);
          }
        }
        let generated = dependencies.toGeneratedModelPublicRecord(await dependencies.generate3dModelWithExecution({
          imageInput: input.imageInput,
          prompt: resolvedPrompt || undefined,
          stripMetadata: globalSettings.stripMetadataWebUiImages
        }, generationExecutionTarget));
        if (useLlmMetadata && metadataTiming === "after") {
          await planLlmMetadata();
        } else if (useLlmMetadata && metadataTiming === "parallel" && metadataPlanPromise) {
          await metadataPlanPromise;
        }
        if (input.askLlmIfShouldBeMetallic === true) {
          try {
            const preferVisual = globalSettings.ollamaTextModelIsVisual;
            const decision = metadataExecutionTarget === "remote"
              ? await dependencies.suggestModelMetallicDecisionRemote({
                promptContext: resolvedPrompt,
                sourceImageInput: input.imageInput,
                extraContext: input.modelPostOptions?.destinationExtraText,
                preferVisualModel: preferVisual
              })
              : await dependencies.suggestModelMetallicDecisionLocal({
                promptContext: resolvedPrompt,
                sourceImageInput: input.imageInput,
                extraContext: input.modelPostOptions?.destinationExtraText,
                preferVisualModel: preferVisual
              });
            if (decision.classification === "metallic" || decision.classification === "non-metallic") {
              generated = dependencies.toGeneratedModelPublicRecord(await dependencies.applyModelMetallicWithExecution({
                modelId: generated.id,
                metallicEnabled: decision.classification === "metallic"
              }, generationExecutionTarget));
            }
          } catch (error) {
            console.warn("Failed automation metallic decision/apply flow. Continuing without metallic override.", error);
          }
        }
        if (input.askLlmForRealWorldHeightAndScale === true) {
          try {
            const preferVisual = globalSettings.ollamaTextModelIsVisual;
            const decision = metadataExecutionTarget === "remote"
              ? await dependencies.suggestModelRealWorldHeightRemote({
                promptContext: resolvedPrompt,
                sourceImageInput: input.imageInput,
                extraContext: input.modelPostOptions?.destinationExtraText,
                preferVisualModel: preferVisual
              })
              : await dependencies.suggestModelRealWorldHeightLocal({
                promptContext: resolvedPrompt,
                sourceImageInput: input.imageInput,
                extraContext: input.modelPostOptions?.destinationExtraText,
                preferVisualModel: preferVisual
              });
            generated = dependencies.toGeneratedModelPublicRecord(await dependencies.applyModelScaleToHeightWithExecution({
              modelId: generated.id,
              targetHeightMeters: decision.heightMeters
            }, generationExecutionTarget));
          } catch (error) {
            console.warn("Failed automation real-world scale decision/apply flow. Continuing without scale override.", error);
          }
        }
        let modelId = generated.id;
        let extraContent = input.modelPostOptions?.destinationExtraText;
        if (useLlmModelFileName && plannedModelFileName) {
          try {
            const renamed = await dependencies.renameGeneratedModelFileName(modelId, plannedModelFileName);
            modelId = renamed.id;
            generated = renamed;
          } catch (error) {
            console.warn("Failed to apply planned model filename. Continuing with original file name.", error);
          }
        }
        if (useLlmModelDescription && plannedModelDescription) {
          extraContent = input.modelPostOptions?.destinationExtraText;
        }
        extraContent = buildModelPostSummaryExtraContent({
          modelFileName: generated.modelFileName,
          description: plannedModelDescription,
          prompt: generated.prompt,
          extraContent
        });
        const posted = await dependencies.postExistingGeneratedModelToChannel({
          modelId,
          channelId: input.channelId,
          requestedBy: "automation",
          messageMode: input.source === "scheduled" ? "public" : "detailed",
          postOptions: {
            targetMode: input.modelPostOptions?.targetMode,
            threadNameMode: input.modelPostOptions?.threadNameMode,
            threadName: input.modelPostOptions?.threadName,
            threadNameBase: input.modelPostOptions?.threadNameBase,
            modelNameSource: input.modelPostOptions?.modelNameSource,
            forumChannelId: input.modelPostOptions?.forumChannelId,
            forumChannelName: input.modelPostOptions?.forumChannelName,
            lowPolyForumChannelId: input.modelPostOptions?.lowPolyForumChannelId,
            lowPolyForumChannelName: input.modelPostOptions?.lowPolyForumChannelName,
            sendInitialToSelectedChannel: input.modelPostOptions?.sendInitialToSelectedChannel,
            initialExtraText: input.modelPostOptions?.initialExtraText,
            destinationExtraText: extraContent ?? input.modelPostOptions?.destinationExtraText,
            modelUploadTarget: input.modelPostOptions?.modelUploadTarget,
            includeModelFile: input.modelPostOptions?.includeModelFile,
            includePreviewMedia: input.modelPostOptions?.includePreviewMedia,
            includeSourceImage: input.modelPostOptions?.includeSourceImage,
            includeEmbed: input.modelPostOptions?.includeEmbed,
            includeButtons: input.modelPostOptions?.includeButtons,
            includeEmbedInInitial: input.modelPostOptions?.includeEmbedInInitial,
            uploadTextureMessages: false,
            uploadMultiViewTextures: false,
            uploadUvMapTextures: false,
            uploadNormalMapTextures: false,
            textureUploadTarget: input.modelPostOptions?.textureUploadTarget,
            generateLowPolyVersion: input.modelPostOptions?.generateLowPolyVersion,
            lowPolyExecutionTarget: generationExecutionTarget,
            lowPolyUseLlmTargetFaces: input.modelPostOptions?.lowPolyUseLlmTargetFaces,
            lowPolyLlmDecisionSource: input.modelPostOptions?.lowPolyLlmDecisionSource,
            lowPolyTargetFaceCount: plannedLowPolyTargetFaceCount ?? input.modelPostOptions?.lowPolyTargetFaceCount
          },
          extraContent,
          replyToMessageId: startNoticeMessageId || undefined
        });
        return [
          posted.modelUrl ? { kind: "model", fileName: posted.modelFileName, directUrl: posted.modelUrl } : null,
          (posted.previewGifUrl || posted.previewImageUrl) ? { kind: "preview", directUrl: posted.previewGifUrl || posted.previewImageUrl } : null,
          posted.sourceImageUrl ? { kind: "image", directUrl: posted.sourceImageUrl } : null
        ].filter(Boolean);
      },
      runtimeState: dependencies.runtimeState,
      getGuildName: dependencies.getGuildName
    });
  }

  return {
    createAutomationEngineInstance
  };
}
