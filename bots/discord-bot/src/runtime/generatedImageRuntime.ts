import path from "node:path";
import { ChannelType, Client, Message } from "discord.js";
import type { LlmConnectionSettings } from "@urage/server/services/llm/ollama";
import type { GeneratedImagePublicRecord } from "@urage/server/services/imageGeneration";

type GeneratedImageRuntimeInput = {
  client: Client;
  getGlobalSettings: () => {
    model3dMetadataTarget: "local" | "remote";
    ollamaTextModelIsVisual?: boolean;
    stripMetadataWebUiImages?: boolean;
  };
  resolveImageLlmConnectionSettingsFromState: () => LlmConnectionSettings;
  resolveModel3dLlmConnectionSettingsFromState: () => LlmConnectionSettings;
  suggestImageFileName: (input: {
    prompt: string;
    llmConnectionSettings: LlmConnectionSettings;
  }) => Promise<string>;
  suggestImageDescription: (input: {
    prompt: string;
    llmConnectionSettings: LlmConnectionSettings;
  }) => Promise<string>;
  renameGeneratedImageFileName: (imageId: string, fileName: string) => Promise<any>;
  updateGeneratedImageDescription: (imageId: string, description: string) => Promise<any>;
  getGeneratedImagePublicById: (imageId: string) => Promise<GeneratedImagePublicRecord | null>;
  toGeneratedImagePublicRecord: (record: any) => GeneratedImagePublicRecord;
  getGeneratedModelPublicById: (modelId: string) => Promise<any>;
  readGeneratedModelFile: (modelId: string, fileName: string) => Promise<{ data: Buffer; contentType: string; }>;
  buildImageDataUrl: (input: { bytes: Buffer; contentType: string; }) => string;
  suggestModelMetadataViaRemoteWorker: (input: {
    prompt: string;
    imageInput?: string;
    preferVisualModel?: boolean;
  }) => Promise<{ fileName?: string | null; }>;
  suggestModelFileNameAndDescription: (input: {
    prompt: string;
    sourceImageInput?: string;
    preferVisualModel?: boolean;
    llmConnectionSettings: LlmConnectionSettings;
  }) => Promise<{ fileName?: string | null; }>;
  normalizeModelNameCandidate: (value: string | null | undefined) => string | null;
  renameGeneratedModelFileName: (modelId: string, fileName: string) => Promise<any>;
  updateGeneratedModelDescription: (modelId: string, description: string) => Promise<any>;
  resolveImagePromptFromBaseImage: (input: {
    imageInput: string;
    prompt?: string;
    detailMode?: "precise" | "normal" | "vague";
    direction?: string;
    llmConnectionSettings: LlmConnectionSettings;
  }) => Promise<string>;
  resolveImagePrompt: (input: {
    prompt?: string;
    autoPrompt?: boolean;
    llmConnectionSettings: LlmConnectionSettings;
  }) => Promise<string>;
  resolveWorkspaceRelativeAssetPath: (assetPath?: string) => string | undefined;
  generateImageWithExecution: (input: any) => Promise<any>;
  buildGeneratedImageEmbed: (record: GeneratedImagePublicRecord) => any;
  buildGeneratedImageAttachment: (record: GeneratedImagePublicRecord) => Promise<any>;
  requireSendableChannel: (channelId: string) => Promise<{ send: (input: any) => Promise<unknown>; }>;
  readGeneratedImageFile: (imageId: string, fileName: string) => Promise<{ data: Buffer; contentType: string; }>;
  convertImageWithPixelArtTool: (input: { data: Buffer; contentType: string; fileName: string; }) => Promise<{
    data: Buffer;
    fileName: string;
    width?: number | null;
    height?: number | null;
  }>;
  importGeneratedImageArtifact: (input: any) => Promise<any>;
  recordAction: (type: string, summary: string) => void;
};

type GeneratedImageRouteTarget = {
  labels?: string[];
  channelId?: string;
  targetMode?: "channel" | "thread" | "forum-post" | "forum-create-and-post";
  threadName?: string;
  forumChannelId?: string;
  forumChannelName?: string;
  postMode?: "combined" | "separate";
};

type PostGeneratedImagesInput = {
  channelId: string;
  images: Array<{ label: string; record: GeneratedImagePublicRecord; }>;
  postMode: "combined" | "separate";
  content: string;
  postOptions?: {
    targetMode?: "channel" | "thread" | "forum-post" | "forum-create-and-post";
    threadNameMode?: "fixed" | "increment" | "image-name";
    threadName?: string;
    threadNameBase?: string;
    forumChannelId?: string;
    forumChannelName?: string;
    sendInitialToSelectedChannel?: boolean;
    selectedChannelImageMode?: "notice-only" | "original" | "all" | "custom";
    selectedChannelImageLabels?: string[];
    initialExtraText?: string;
    destinationExtraText?: string;
    includeEmbed?: boolean;
    variantTargets?: GeneratedImageRouteTarget[];
  };
};

type GeneratedImageRouteLabelMeta = {
  normalizedLabel: string;
  isOriginal: boolean;
  stepSet: Set<string>;
  canonicalRecipeLabel: string;
};

const generatedImageRouteSteps = ["delight", "remove-background", "pixel-art"] as const;

function normalizeGeneratedImageRouteLabel(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeGeneratedImageRouteRecipeLabel(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(">")
    .map(part => part.trim())
    .filter(Boolean)
    .join(" > ");
}

function resolveGeneratedImageRouteRecipeSteps(label: string): string[] {
  const normalizedLabel = normalizeGeneratedImageRouteLabel(label);
  const firstStepIndex = generatedImageRouteSteps.reduce((bestIndex, step) => {
    const nextIndex = normalizedLabel.indexOf(step);
    if (nextIndex < 0) {
      return bestIndex;
    }
    return bestIndex < 0 ? nextIndex : Math.min(bestIndex, nextIndex);
  }, -1);
  if (firstStepIndex < 0) {
    return [];
  }
  return normalizedLabel
    .slice(firstStepIndex)
    .split(">")
    .map(part => {
      const normalizedPart = part.trim();
      return generatedImageRouteSteps.find(step => normalizedPart.includes(step)) || "";
    })
    .filter(Boolean);
}

function buildGeneratedImageRouteLabelMeta(label: string): GeneratedImageRouteLabelMeta {
  const normalizedLabel = normalizeGeneratedImageRouteLabel(label);
  const steps = resolveGeneratedImageRouteRecipeSteps(label);
  return {
    normalizedLabel,
    isOriginal: normalizedLabel === "original" || normalizedLabel.endsWith(" original"),
    stepSet: new Set(steps),
    canonicalRecipeLabel: normalizeGeneratedImageRouteRecipeLabel(steps.join(" > "))
  };
}

function matchesGeneratedImageRouteLabel(routeLabels: Set<string>, entryLabel: string): boolean {
  const meta = buildGeneratedImageRouteLabelMeta(entryLabel);
  if (routeLabels.has(meta.normalizedLabel)) {
    return true;
  }
  if (routeLabels.has("original") && meta.isOriginal) {
    return true;
  }
  if (meta.canonicalRecipeLabel && routeLabels.has(meta.canonicalRecipeLabel)) {
    return true;
  }
  for (const routeLabel of routeLabels) {
    if (!routeLabel.startsWith("__step:")) {
      continue;
    }
    if (meta.stepSet.has(routeLabel.slice(7))) {
      return true;
    }
  }
  return false;
}

export function createGeneratedImageRuntime(input: GeneratedImageRuntimeInput) {
  const suggestAndRenameGeneratedImageFileName = async (runtimeInput: {
    imageId: string;
    prompt: string;
  }) => {
    const suggestedFileName = `${await input.suggestImageFileName({
      prompt: runtimeInput.prompt,
      llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
    })}.png`;
    return input.renameGeneratedImageFileName(runtimeInput.imageId, suggestedFileName);
  };

  const suggestAndStoreGeneratedImageDescription = async (runtimeInput: {
    imageId: string;
    prompt: string;
  }) => {
    const description = await input.suggestImageDescription({
      prompt: runtimeInput.prompt,
      llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
    });
    return description
      ? input.updateGeneratedImageDescription(runtimeInput.imageId, description)
      : input.getGeneratedImagePublicById(runtimeInput.imageId);
  };

  const regenerateGeneratedImageFileNameWithLlm = async (runtimeInput: {
    imageId: string;
    prompt?: string;
  }) => {
    const imageId = runtimeInput.imageId.trim();
    if (!imageId) {
      throw new Error("Image id is required.");
    }
    const existing = await input.getGeneratedImagePublicById(imageId);
    if (!existing) {
      throw new Error("Generated image entry was not found.");
    }
    const prompt = runtimeInput.prompt?.trim() || existing.prompt?.trim() || "generated image";
    const renamed = await suggestAndRenameGeneratedImageFileName({
      imageId: existing.id,
      prompt
    });
    return input.toGeneratedImagePublicRecord(renamed);
  };

  const regenerateGeneratedModelFileNameWithLlm = async (runtimeInput: {
    modelId: string;
    prompt?: string;
  }) => {
    const modelId = runtimeInput.modelId.trim();
    if (!modelId) {
      throw new Error("Model id is required.");
    }
    const existing = await input.getGeneratedModelPublicById(modelId);
    if (!existing) {
      throw new Error("Generated model entry was not found.");
    }
    const globalSettings = input.getGlobalSettings();
    const metadataExecutionTarget = globalSettings.model3dMetadataTarget;
    const promptText = runtimeInput.prompt?.trim() || existing.prompt?.trim() || "";
    const metadataPrompt = promptText || "Generate a concise file name and one short Discord description for this source image.";
    let sourceImageInput: string | undefined;
    if (!promptText) {
      try {
        const sourceImage = await input.readGeneratedModelFile(existing.id, existing.sourceImageFileName);
        sourceImageInput = input.buildImageDataUrl({
          bytes: sourceImage.data,
          contentType: sourceImage.contentType
        });
      } catch (error) {
        console.warn("Failed to load generated model source image for filename regeneration.", error);
      }
    }
    const suggestion = metadataExecutionTarget === "remote"
      ? await input.suggestModelMetadataViaRemoteWorker({
        prompt: metadataPrompt,
        imageInput: sourceImageInput,
        preferVisualModel: globalSettings.ollamaTextModelIsVisual
      })
      : await input.suggestModelFileNameAndDescription({
        prompt: metadataPrompt,
        sourceImageInput,
        preferVisualModel: globalSettings.ollamaTextModelIsVisual,
        llmConnectionSettings: input.resolveModel3dLlmConnectionSettingsFromState()
      });
    const suggestedFileName = input.normalizeModelNameCandidate(suggestion.fileName);
    if (!suggestedFileName) {
      throw new Error("LLM did not return a valid model filename.");
    }
    return input.renameGeneratedModelFileName(existing.id, suggestedFileName);
  };

  const generateImageFromPrompt = async (runtimeInput: {
    prompt?: string;
    negativePrompt?: string;
    autoPrompt?: boolean;
    autoFileName?: boolean;
    autoDescription?: boolean;
    autoFileNameTiming?: "before" | "after" | "parallel";
    imageInput?: string;
    imageFileNameHint?: string;
    workflowPathOverride?: string;
    workflowInputOverrides?: Record<string, string | number | boolean>;
    preserveEmptyPrompt?: boolean;
    skipPromptResolution?: boolean;
    width?: number;
    height?: number;
    seed?: number;
    steps?: number;
    cfg?: number;
    batchSize?: number;
    channelId?: string | null;
    requestedBy?: string;
    stripMetadata?: boolean;
  }) => {
    const toGeneratedImagePublicResult = (record: any): any => {
      const primary = input.toGeneratedImagePublicRecord(record);
      const generatedImages = Array.isArray(record?.generatedImages)
        ? record.generatedImages.map((entry: any) => input.toGeneratedImagePublicRecord(entry))
        : [];
      return generatedImages.length > 0 ? { ...primary, generatedImages } : primary;
    };
    const sourceImageInput = runtimeInput.imageInput?.trim() || "";
    const explicitPrompt = runtimeInput.prompt?.trim() || "";
    const prompt = runtimeInput.skipPromptResolution === true
      ? ""
      : sourceImageInput && runtimeInput.preserveEmptyPrompt === true && !explicitPrompt
      ? ""
      : sourceImageInput
      ? await (async () => {
        const basePrompt = await input.resolveImagePromptFromBaseImage({
          imageInput: sourceImageInput,
          prompt: runtimeInput.prompt,
          llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
        });
        if (!runtimeInput.autoPrompt) {
          return basePrompt;
        }
        return input.resolveImagePrompt({
          prompt: basePrompt,
          autoPrompt: true,
          llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
        });
      })()
      : await input.resolveImagePrompt({
        prompt: runtimeInput.prompt,
        autoPrompt: runtimeInput.autoPrompt,
        llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
      });
    const fileNamePrompt = runtimeInput.prompt?.trim() || prompt;
    const shouldAutoFileName = runtimeInput.autoFileName === true || (runtimeInput.autoFileName !== false && runtimeInput.autoPrompt === true);
    const shouldAutoDescription = runtimeInput.autoDescription === true || (runtimeInput.autoDescription !== false && runtimeInput.autoPrompt === true);
    const autoFileNameTiming = runtimeInput.autoFileNameTiming === "before" || runtimeInput.autoFileNameTiming === "parallel"
      ? runtimeInput.autoFileNameTiming
      : "after";
    let plannedFileNamePromise: Promise<string> | null = null;
    let plannedDescriptionPromise: Promise<string> | null = null;
    if (shouldAutoFileName && (autoFileNameTiming === "before" || autoFileNameTiming === "parallel")) {
      plannedFileNamePromise = input.suggestImageFileName({
        prompt: fileNamePrompt,
        llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
      }).then(stem => `${stem}.png`);
    }
    if (shouldAutoDescription && (autoFileNameTiming === "before" || autoFileNameTiming === "parallel")) {
      plannedDescriptionPromise = input.suggestImageDescription({
        prompt: fileNamePrompt,
        llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
      });
    }
    const generatedRecord = await input.generateImageWithExecution({
      prompt,
      negativePrompt: runtimeInput.negativePrompt,
      imageInput: sourceImageInput || undefined,
      imageFileNameHint: runtimeInput.imageFileNameHint?.trim() || undefined,
      width: runtimeInput.width,
      height: runtimeInput.height,
      seed: runtimeInput.seed,
      steps: runtimeInput.steps,
      cfg: runtimeInput.cfg,
      batchSize: runtimeInput.batchSize,
      workflowPathOverride: input.resolveWorkspaceRelativeAssetPath(runtimeInput.workflowPathOverride),
      workflowInputOverrides: runtimeInput.workflowInputOverrides,
      stripMetadata: typeof runtimeInput.stripMetadata === "boolean"
        ? runtimeInput.stripMetadata
        : input.getGlobalSettings().stripMetadataWebUiImages
    });
    const generated = toGeneratedImagePublicResult(generatedRecord);
    if (runtimeInput.channelId) {
      const channel = await input.requireSendableChannel(runtimeInput.channelId);
      const generatedImages = Array.isArray(generated.generatedImages) && generated.generatedImages.length > 0
        ? generated.generatedImages
        : [generated];
      await channel.send({
        content: runtimeInput.requestedBy === "automation"
          ? (generatedImages.length > 1 ? "🖼️ Automated layered image drop is ready!" : "🖼️ Automated image drop is ready!")
          : (generatedImages.length > 1 ? "🎉 Your layered image set is ready!" : "🎉 Your generated image is ready!"),
        embeds: [input.buildGeneratedImageEmbed(generated)],
        files: await Promise.all(generatedImages.map((entry: any) => input.buildGeneratedImageAttachment(entry)))
      });
    }
    const generatedRecords = Array.isArray((generatedRecord as any).generatedImages) && (generatedRecord as any).generatedImages.length > 0
      ? (generatedRecord as any).generatedImages
      : [generatedRecord];
    if (shouldAutoFileName || shouldAutoDescription) {
      const applyGeneratedImageMetadata = async (record: any): Promise<void> => {
        const generatedImageId = String(record?.id || "").trim();
        if (!generatedImageId) return;
        if (shouldAutoFileName) {
          const nextFileName = plannedFileNamePromise
            ? await plannedFileNamePromise
            : `${await input.suggestImageFileName({
              prompt: fileNamePrompt,
              llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
            })}.png`;
          const renamed = await input.renameGeneratedImageFileName(generatedImageId, nextFileName);
          input.recordAction("dashboard:image-filename", `Updated image filename via LLM for ${renamed.id}.`);
        }
        if (shouldAutoDescription) {
          const description = plannedDescriptionPromise
            ? await plannedDescriptionPromise
            : await input.suggestImageDescription({
              prompt: fileNamePrompt,
              llmConnectionSettings: input.resolveImageLlmConnectionSettingsFromState()
            });
          if (description) {
            const described = await input.updateGeneratedImageDescription(generatedImageId, description);
            input.recordAction("dashboard:image-description", `Updated image description via LLM for ${described.id}.`);
          }
        }
      };
      const applyAllGeneratedImageMetadata = async (): Promise<void> => {
        // The JSON-backed media index uses read/modify/write mutations. Keep batch
        // enrichment serialized so one record cannot overwrite another record's update.
        for (const record of generatedRecords) {
          await applyGeneratedImageMetadata(record);
        }
      };
      if (autoFileNameTiming === "parallel") {
        setTimeout(() => {
          void applyAllGeneratedImageMetadata().catch(error => {
            console.warn("Failed to enrich generated image metadata.", error);
          });
        }, 0);
      } else if (autoFileNameTiming === "after") {
        setTimeout(() => {
          void applyAllGeneratedImageMetadata().catch(error => {
            console.warn("Failed to enrich generated image metadata.", error);
          });
        }, 0);
      } else {
        await applyAllGeneratedImageMetadata();
        const refreshedRecords = await Promise.all(generatedRecords.map((record: any) => input.getGeneratedImagePublicById(record.id)));
        const refreshed = refreshedRecords.filter(Boolean);
        if (refreshed.length > 0) {
          return refreshed.length > 1 ? { ...refreshed[0], generatedImages: refreshed } : refreshed[0];
        }
      }
    }
    return generated;
  };

  const postGeneratedImagesToChannel = async (runtimeInput: PostGeneratedImagesInput): Promise<void> => {
    let images = runtimeInput.images.filter(entry => entry && entry.record);
    if (images.length === 0) {
      throw new Error("No generated images are available to post.");
    }
    images = await Promise.all(images.map(async entry => {
      const refreshed = await input.getGeneratedImagePublicById(entry.record.id).catch(() => null);
      return refreshed ? { ...entry, record: refreshed } : entry;
    }));
    const options = runtimeInput.postOptions || {};
    const variantTargets = Array.isArray(options.variantTargets) ? options.variantTargets : [];
    if (variantTargets.length > 0) {
      const routedLabels = new Set<string>();
      for (const route of variantTargets) {
        const wanted = new Set((route.labels || []).map(label => String(label || "").trim().toLowerCase()).filter(Boolean));
        if (wanted.size === 0) continue;
        const routeImages = images.filter(entry => matchesGeneratedImageRouteLabel(wanted, entry.label));
        if (routeImages.length === 0) continue;
        routeImages.forEach(entry => routedLabels.add(entry.label.trim().toLowerCase()));
        await postGeneratedImagesToChannel({
          channelId: String(route.channelId || runtimeInput.channelId).trim() || runtimeInput.channelId,
          images: routeImages,
          postMode: route.postMode === "separate" ? "separate" : route.postMode === "combined" ? "combined" : runtimeInput.postMode,
          content: runtimeInput.content,
          postOptions: {
            ...options,
            targetMode: route.targetMode || "channel",
            threadName: route.threadName || options.threadName,
            threadNameMode: route.threadName ? "fixed" : options.threadNameMode,
            forumChannelId: route.forumChannelId || options.forumChannelId,
            forumChannelName: route.forumChannelName || options.forumChannelName,
            sendInitialToSelectedChannel: false,
            variantTargets: []
          }
        });
      }
      images = images.filter(entry => !routedLabels.has(entry.label.trim().toLowerCase()));
      if (images.length === 0) {
        return;
      }
    }
    const targetMode = options.targetMode === "thread" || options.targetMode === "forum-post" || options.targetMode === "forum-create-and-post"
      ? options.targetMode
      : "channel";
    const firstImageName = String(images[0]?.record?.imageFileName || "Image Drop").replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N} _.-]+/gu, " ").trim();
    const resolveThreadName = (): string => {
      if (options.threadNameMode === "image-name" && firstImageName) return firstImageName.slice(0, 90);
      if (options.threadNameMode === "increment") return `${String(options.threadNameBase || "Image Drop").trim() || "Image Drop"} ${Date.now()}`;
      return String(options.threadName || firstImageName || "Image Drop").trim().slice(0, 90) || "Image Drop";
    };
    const destinationExtra = String(options.destinationExtraText || "").trim();
    const initialExtra = String(options.initialExtraText || "").trim();
    const buildPayload = async (entries: Array<{ label: string; record: GeneratedImagePublicRecord; }>, content: string) => ({
      content,
      embeds: options.includeEmbed === false ? [] : entries.map(entry => input.buildGeneratedImageEmbed(entry.record).setTitle(`🖼️ ${entry.label}`)),
      files: await Promise.all(entries.map(entry => input.buildGeneratedImageAttachment(entry.record)))
    });
    const buildContent = (label?: string): string => [runtimeInput.content, label, destinationExtra].map(part => String(part || "").trim()).filter(Boolean).join("\n\n");
    const selectInitialImages = (): Array<{ label: string; record: GeneratedImagePublicRecord; }> => {
      if (options.selectedChannelImageMode === "all") return images;
      if (options.selectedChannelImageMode === "original") return images.slice(0, 1);
      if (options.selectedChannelImageMode === "custom") {
        const wanted = new Set((options.selectedChannelImageLabels || []).map(label => label.trim().toLowerCase()).filter(Boolean));
        return wanted.size > 0 ? images.filter(entry => matchesGeneratedImageRouteLabel(wanted, entry.label)) : [];
      }
      return [];
    };
    const selectedChannel = await input.requireSendableChannel(runtimeInput.channelId);
    const sendToChannel = async (channel: { send: (payload: any) => Promise<unknown>; }): Promise<void> => {
      if (runtimeInput.postMode === "separate") {
        for (const entry of images) {
          await channel.send(await buildPayload([entry], buildContent(entry.label)));
        }
        return;
      }
      const message = await channel.send({ content: "🖼️ Automated image versions are ready. Preparing Discord attachments..." });
      if (message && typeof message === "object" && "edit" in message && typeof (message as { edit?: unknown }).edit === "function") {
        await (message as Message).edit(await buildPayload(images, buildContent()));
        return;
      }
      await channel.send(await buildPayload(images, buildContent()));
    };
    if (targetMode === "channel") {
      await sendToChannel(selectedChannel);
      return;
    }
    const selectedFetched = await input.client.channels.fetch(runtimeInput.channelId);
    if (!selectedFetched || !("guildId" in selectedFetched) || typeof selectedFetched.guildId !== "string") {
      throw new Error("Select a server channel for image automation posting.");
    }
    if (options.sendInitialToSelectedChannel === true) {
      const initialImages = selectInitialImages();
      if (initialImages.length > 0) {
        await selectedChannel.send(await buildPayload(initialImages, [runtimeInput.content, initialExtra].filter(Boolean).join("\n\n")));
      } else {
        await selectedChannel.send({ content: [runtimeInput.content, initialExtra || "Image automation is posting in the configured destination."].filter(Boolean).join("\n\n") });
      }
    }
    if (targetMode === "thread") {
      if (selectedFetched.type !== ChannelType.GuildText && selectedFetched.type !== ChannelType.GuildAnnouncement) {
        throw new Error("Thread mode requires a selected text or announcement channel.");
      }
      const thread = await selectedFetched.threads.create({
        name: resolveThreadName(),
        autoArchiveDuration: 1440
      });
      await sendToChannel(thread);
      return;
    }
    const forumChannel = options.forumChannelId
      ? await input.client.channels.fetch(options.forumChannelId)
      : targetMode === "forum-post"
        ? selectedFetched
        : await (async () => {
          const name = String(options.forumChannelName || "").trim();
          if (!name || !("guild" in selectedFetched)) throw new Error("Forum channel id or forum channel name is required for forum create mode.");
          return await selectedFetched.guild.channels.create({
            name,
            type: ChannelType.GuildForum
          });
        })();
    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      throw new Error("Image forum post mode requires a forum channel.");
    }
    if (runtimeInput.postMode === "separate") {
      const [first, ...rest] = images;
      if (!first) return;
      const thread = await forumChannel.threads.create({
        name: resolveThreadName(),
        message: await buildPayload([first], buildContent(first.label))
      });
      for (const entry of rest) {
        await thread.send(await buildPayload([entry], buildContent(entry.label)));
      }
      return;
    }
    await forumChannel.threads.create({
      name: resolveThreadName(),
      message: await buildPayload(images, buildContent())
    });
  };

  const convertGeneratedImageToPixelArt = async (record: GeneratedImagePublicRecord): Promise<GeneratedImagePublicRecord> => {
    const source = await input.readGeneratedImageFile(record.id, record.imageFileName);
    const converted = await input.convertImageWithPixelArtTool({
      data: source.data,
      contentType: source.contentType,
      fileName: record.imageFileName
    });
    const stem = path.basename(record.imageFileName, path.extname(record.imageFileName)) || "automation-image";
    const imported = await input.importGeneratedImageArtifact({
      record: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
        createdAt: new Date().toISOString(),
        prompt: `${record.prompt || ""}`.trim(),
        comfyPromptId: "local-pixel-art",
        imageFileName: converted.fileName || `${stem}-pixel.png`,
        seed: record.seed || 0,
        steps: null,
        width: converted.width || record.width || null,
        height: converted.height || record.height || null,
        model: "Pixel Art Converter",
        modelGeneratedAt: null,
        modelGeneratedModelId: null
      },
      imageData: converted.data
    });
    input.recordAction("automation:pixel-art", `Converted ${record.imageFileName} with Pixel Art Converter as ${imported.imageFileName}.`);
    return input.toGeneratedImagePublicRecord(imported);
  };

  return {
    suggestAndRenameGeneratedImageFileName,
    suggestAndStoreGeneratedImageDescription,
    regenerateGeneratedImageFileNameWithLlm,
    regenerateGeneratedModelFileNameWithLlm,
    generateImageFromPrompt,
    postGeneratedImagesToChannel,
    convertGeneratedImageToPixelArt
  };
}
