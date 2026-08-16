import { ApplicationCommandOptionType } from "discord.js";
import type { ActionRowBuilder, ButtonBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import type { GenerateAudioInput, GenerateMusicInput, GeneratedAudioPublicRecord, GeneratedAudioRecord } from "@urage/server/services/audioGeneration";
import { splitLongMessage } from "../../discordMessageUtils.js";
import type { GenerateModelInput, GeneratedModelPublicRecord, GeneratedModelRecord } from "@urage/server/services/model3d";
import type { GenerateImageInput, GeneratedImagePublicRecord, GeneratedImageRecord } from "@urage/server/services/imageGeneration";
import type { GenerateVideoInput, GeneratedVideoPublicRecord, GeneratedVideoRecord } from "@urage/server/services/videoGeneration";
import type { ModelPostOptions } from "../../model3d/post/modelPostService.js";

interface MediaAndUtilityCommandDependencies {
  buildGiftMessage: () => Promise<string>;
  buildHumbleMessages: () => Promise<string[]>;
  replyWithChunks: (interaction: ChatInputCommandInteraction, text: string) => Promise<void>;
  followUpWithChunks: (interaction: ChatInputCommandInteraction, text: string) => Promise<void>;
  buildBotInviteUrl: (guildId?: string | null) => string;
  resolveModelPrompt: (input: { prompt?: string; autoPrompt?: boolean; }) => Promise<string>;
  resolveImagePrompt: (input: { prompt?: string; autoPrompt?: boolean; }) => Promise<string>;
  describeImageWithVision: (input: { imageInput: string; prompt?: string; }) => Promise<string>;
  resolveImagePromptFromBaseImage: (input: { imageInput: string; prompt?: string; detailMode?: "precise" | "normal" | "vague"; direction?: string; }) => Promise<string>;
  generateAudioWithExecution: (input: GenerateAudioInput) => Promise<GeneratedAudioRecord>;
  generateMusicWithExecution: (input: GenerateMusicInput) => Promise<GeneratedAudioRecord>;
  generate3dModelWithExecution: (input: GenerateModelInput) => Promise<GeneratedModelRecord>;
  generateLowPolyFromUploadedModel: (input: {
    fileName: string;
    fileData: Buffer;
    contentType?: string;
    useLlmTargetFaces?: boolean;
    targetFaceCount?: number;
    prompt?: string;
    context?: string;
    renameLowPolyModelWithLlm?: boolean;
  }) => Promise<{
    generated: GeneratedModelPublicRecord;
    targetFaceCount: number;
    suggestionReason: string | null;
    usedLlmTargetFaces: boolean;
    decisionPreviewModelId?: string | null;
    decisionPreviewImageFileName?: string | null;
    renamedLowPolyFileName?: string | null;
  }>;
  loadActiveLlmModels?: (input: { scope?: "text" | "vision" | "both"; contextLength?: number; }) => Promise<unknown>;
  generateImageWithExecution: (input: GenerateImageInput) => Promise<GeneratedImageRecord>;
  generateVideoFromPrompt: (input: GenerateVideoInput) => Promise<GeneratedVideoRecord>;
  toGeneratedAudioPublicRecord: (record: GeneratedAudioRecord) => GeneratedAudioPublicRecord;
  toGeneratedModelPublicRecord: (record: GeneratedModelRecord) => GeneratedModelPublicRecord;
  toGeneratedImagePublicRecord: (record: GeneratedImageRecord) => GeneratedImagePublicRecord;
  toGeneratedVideoPublicRecord: (record: GeneratedVideoRecord) => GeneratedVideoPublicRecord;
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  resolveGeneratedVideoFilePath: (videoId: string, fileName: string) => Promise<string>;
  buildModelReadyContent: () => string;
  buildGeneratedModelEmbed: (record: GeneratedModelPublicRecord) => EmbedBuilder;
  buildGeneratedModelAttachments: (record: GeneratedModelPublicRecord, mode: "detailed" | "public", options: Required<ModelPostOptions>) => Promise<Array<{ attachment: string; name: string }>>;
  buildGeneratedModelComponents: (
    record: GeneratedModelPublicRecord,
    mode: "detailed" | "public",
    options: Required<ModelPostOptions>
  ) => Array<ActionRowBuilder<ButtonBuilder>>;
  normalizeModelPostOptions: (input: ModelPostOptions | undefined) => Required<ModelPostOptions>;
  buildGeneratedImageEmbed: (record: GeneratedImagePublicRecord) => EmbedBuilder;
  buildGeneratedImageAttachment: (record: GeneratedImagePublicRecord) => Promise<{ attachment: string; name: string }>;
  buildGeneratedImageComponents: (
    record: GeneratedImagePublicRecord,
    requestedByUserId: string
  ) => Array<ActionRowBuilder<ButtonBuilder>>;
  buildGeneratedAudioEmbed: (record: GeneratedAudioPublicRecord) => EmbedBuilder;
  buildGeneratedMusicEmbed: (record: GeneratedAudioPublicRecord) => EmbedBuilder;
  buildGeneratedAudioAttachment: (record: GeneratedAudioPublicRecord) => Promise<{ attachment: string; name: string }>;
  listImagePools: () => Promise<Array<{ id: string; name: string; images: string[] }>>;
  addImageToPool: (input: {
    poolId: string;
    imageSource: string;
    requestedBy: string;
    reason: string;
  }) => Promise<{ pool: { id: string; name: string; images: string[] }; added: boolean; }>;
  stripMetadataDiscordImages: () => boolean;
  recordAction: (type: string, summary: string) => void;
}

export async function handleMediaAndUtilitySlashCommands(
  interaction: ChatInputCommandInteraction,
  dependencies: MediaAndUtilityCommandDependencies
): Promise<boolean> {
  function isLikely3dModelAttachment(fileName: string, contentType?: string | null): boolean {
    const normalizedType = (contentType ?? "").toLowerCase();
    if (normalizedType.startsWith("image/") || normalizedType.startsWith("video/") || normalizedType.startsWith("audio/")) {
      return false;
    }
    if (normalizedType.startsWith("model/")) {
      return true;
    }
    return /\.(glb|gltf|fbx|obj|stl|ply|dae|3ds|blend|usd|usdz)$/i.test(fileName);
  }
  function isLikelyImageAttachment(fileName: string, contentType?: string | null): boolean {
    const normalizedType = (contentType ?? "").toLowerCase();
    if (normalizedType.startsWith("image/")) {
      return true;
    }
    return /\.(png|jpe?g|webp|gif|bmp|tiff?|avif)$/i.test(fileName);
  }

  function getOptionStringValue(name: string): string {
    const direct = interaction.options.getString(name)?.trim() ?? "";
    if (direct) {
      return direct;
    }
    const raw = interaction.options.data.find(option => option.name === name && option.type === ApplicationCommandOptionType.String);
    return typeof raw?.value === "string" ? raw.value.trim() : "";
  }
  function getOptionAttachmentValue(primaryName: string, fallbackNames: string[] = []): NonNullable<ReturnType<ChatInputCommandInteraction["options"]["getAttachment"]>> | null {
    const names = [primaryName, ...fallbackNames];
    for (const name of names) {
      const direct = interaction.options.getAttachment(name);
      if (direct) {
        return direct;
      }
    }
    const firstAttachmentOption = interaction.options.data.find(option => option.type === ApplicationCommandOptionType.Attachment && option.attachment);
    return firstAttachmentOption?.attachment ?? null;
  }

  function resolvePromptFromOptions(primaryName: string, fallbackNames: string[]): string {
    const primary = getOptionStringValue(primaryName);
    if (primary) {
      return primary;
    }
    for (const name of fallbackNames) {
      const value = getOptionStringValue(name);
      if (value) {
        return value;
      }
    }
    const firstStringOption = interaction.options.data.find(option => option.type === ApplicationCommandOptionType.String && typeof option.value === "string");
    return typeof firstStringOption?.value === "string" ? firstStringOption.value.trim() : "";
  }

  if (interaction.commandName === "gift") {
    await interaction.deferReply();
    const message = await dependencies.buildGiftMessage();
    dependencies.recordAction("slash:/gift", `${interaction.user.tag} posted the current gift lookup.`);
    await dependencies.replyWithChunks(interaction, message);
    return true;
  }
  if (interaction.commandName === "humble") {
    await interaction.deferReply();
    const messages = await dependencies.buildHumbleMessages();
    dependencies.recordAction("slash:/humble", `${interaction.user.tag} requested the current Humble bundle list.`);
    await dependencies.replyWithChunks(interaction, messages[0] ?? "No Humble data available.");
    for (const messageText of messages.slice(1)) {
      await dependencies.followUpWithChunks(interaction, messageText);
    }
    return true;
  }
  if (interaction.commandName === "model") {
    const attachment = getOptionAttachmentValue("image", ["source_image", "source", "input", "file"]);
    if (!attachment) {
      await interaction.reply({
        content: "Please provide an image attachment for `/model`.",
        ephemeral: true
      });
      return true;
    }
    const providedPrompt = interaction.options.getString("prompt")?.trim() ?? "";
    const autoPrompt = interaction.options.getBoolean("auto_prompt") === true;
    const looksLikeImage = attachment.contentType?.startsWith("image/")
      || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(attachment.name ?? "");
    if (!looksLikeImage) {
      await interaction.reply({
        content: "Please provide an image attachment for `/model`.",
        ephemeral: true
      });
      return true;
    }
    await interaction.deferReply();
    const sourceName = attachment.name ?? "attachment";
    const resolvedPrompt = await dependencies.resolveModelPrompt({
      prompt: providedPrompt,
      autoPrompt
    });
    await interaction.editReply({
      content: `I generate your 3D model now from this image: \`${sourceName}\``,
      files: [
        {
          attachment: attachment.url,
          name: sourceName
        }
      ]
    });
    try {
      const generated = dependencies.toGeneratedModelPublicRecord(await dependencies.generate3dModelWithExecution({
        imageInput: attachment.url,
        imageFileNameHint: sourceName,
        prompt: resolvedPrompt,
        stripMetadata: dependencies.stripMetadataDiscordImages()
      }));
      dependencies.recordAction(
        "slash:/model",
        `${interaction.user.tag} generated 3D model ${generated.id} from ${sourceName}.`
      );
      const modelOptions = dependencies.normalizeModelPostOptions(undefined);
      await interaction.editReply({
        content: dependencies.buildModelReadyContent(),
        embeds: [dependencies.buildGeneratedModelEmbed(generated)],
        files: await dependencies.buildGeneratedModelAttachments(generated, "detailed", modelOptions),
        components: dependencies.buildGeneratedModelComponents(generated, "detailed", modelOptions)
      });
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      dependencies.recordAction(
        "slash:/model-error",
        `${interaction.user.tag} failed 3D model generation from ${sourceName}: ${errorDetail || "unknown error"}`
      );
      await interaction.editReply({
        content: [
          "Something went wrong while generating the model.",
          errorDetail ? `\nError detail:\n\`\`\`\n${errorDetail.slice(0, 1500)}\n\`\`\`` : ""
        ].join("")
      });
    }
    return true;
  }
  if (interaction.commandName === "lowpoly") {
    const attachment = getOptionAttachmentValue("model", ["source_model", "source", "input", "file"]);
    if (!attachment) {
      await interaction.reply({
        content: "Please upload a 3D model file (for example `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`).",
        ephemeral: true
      });
      return true;
    }
    const sourceName = attachment.name?.trim() || "uploaded-model";
    const useLlmTargetFaces = interaction.options.getBoolean("llm_target_faces") === true;
    const requestedTargetFaces = interaction.options.getInteger("target_faces");
    const renameLowPolyModelWithLlm = interaction.options.getBoolean("rename") === true;
    if (!isLikely3dModelAttachment(sourceName, attachment.contentType)) {
      await interaction.reply({
        content: "Please upload a 3D model file (for example `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`).",
        ephemeral: true
      });
      return true;
    }
    await interaction.deferReply();
    await interaction.editReply({
      content: `I generate a low poly version now from: \`${sourceName}\``
    });
    try {
      await dependencies.loadActiveLlmModels?.({ scope: "text" });
      const sourceResponse = await fetch(attachment.url);
      if (!sourceResponse.ok) {
        throw new Error(`Could not download source model (${sourceResponse.status}).`);
      }
      const sourceBytes = Buffer.from(await sourceResponse.arrayBuffer());
      const generated = await dependencies.generateLowPolyFromUploadedModel({
        fileName: sourceName,
        fileData: sourceBytes,
        contentType: attachment.contentType ?? undefined,
        useLlmTargetFaces,
        targetFaceCount: typeof requestedTargetFaces === "number" && Number.isFinite(requestedTargetFaces)
          ? Math.max(1, Math.round(requestedTargetFaces))
          : undefined,
        prompt: `Create a low poly version of this uploaded model: ${sourceName}`,
        context: sourceName,
        renameLowPolyModelWithLlm
      });
      const files: Array<{ attachment: string; name: string }> = [];
      if (generated.decisionPreviewModelId && generated.decisionPreviewImageFileName) {
        files.push({
          attachment: await dependencies.resolveGeneratedModelFilePath(generated.decisionPreviewModelId, generated.decisionPreviewImageFileName),
          name: generated.decisionPreviewImageFileName
        });
      }
      if (generated.generated.lowPolyPreviewGifFileName) {
        files.push({
          attachment: await dependencies.resolveGeneratedModelFilePath(generated.generated.id, generated.generated.lowPolyPreviewGifFileName),
          name: generated.generated.lowPolyPreviewGifFileName
        });
      } else if (generated.generated.lowPolyPreviewImageFileName) {
        files.push({
          attachment: await dependencies.resolveGeneratedModelFilePath(generated.generated.id, generated.generated.lowPolyPreviewImageFileName),
          name: generated.generated.lowPolyPreviewImageFileName
        });
      }
      if (generated.generated.lowPolyModelFileName) {
        files.push({
          attachment: await dependencies.resolveGeneratedModelFilePath(generated.generated.id, generated.generated.lowPolyModelFileName),
          name: generated.generated.lowPolyModelFileName
        });
      }
      dependencies.recordAction(
        "slash:/lowpoly",
        `${interaction.user.tag} generated lowpoly for ${sourceName} (${generated.generated.id}, ${generated.targetFaceCount} faces).`
      );
      const reasonSuffix = generated.suggestionReason ? `\nReason: ${generated.suggestionReason}` : "";
      const previewSuffix = generated.decisionPreviewImageFileName ? "\nAI analyzed preview is attached for transparency." : "";
      const renameSuffix = generated.renamedLowPolyFileName ? `\nRenamed low poly file: **${generated.renamedLowPolyFileName}**` : "";
      await interaction.editReply({
        content: `Low poly model ready.\nTarget faces: **${generated.targetFaceCount}**${reasonSuffix}${previewSuffix}${renameSuffix}`,
        files
      });
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      dependencies.recordAction(
        "slash:/lowpoly-error",
        `${interaction.user.tag} failed lowpoly generation from ${sourceName}: ${errorDetail || "unknown error"}`
      );
      await interaction.editReply({
        content: [
          "Something went wrong while generating the low poly model.",
          errorDetail ? `\nError detail:\n\`\`\`\n${errorDetail.slice(0, 1500)}\n\`\`\`` : ""
        ].join("")
      });
    }
    return true;
  }
  if (interaction.commandName === "image") {
    const providedPrompt = resolvePromptFromOptions("prompt", ["text", "message", "input", "query"]);
    const baseImageAttachment = getOptionAttachmentValue("base_image", ["image", "source_image", "source", "input", "file"]);
    const baseImageFile = baseImageAttachment
      ? {
        attachment: baseImageAttachment.url,
        name: baseImageAttachment.name ?? "base-image.png"
      }
      : null;
    const autoPrompt = interaction.options.getBoolean("auto_prompt") === true;
    if (baseImageAttachment && !isLikelyImageAttachment(baseImageAttachment.name ?? "", baseImageAttachment.contentType)) {
      await interaction.reply({
        content: "Please provide an image attachment for `base_image`.",
        ephemeral: true
      });
      return true;
    }
    if (!providedPrompt && !autoPrompt && !baseImageAttachment) {
      await interaction.reply({
        content: "Provide a prompt, attach `base_image`, or set `auto_prompt` to true.",
        ephemeral: true
      });
      return true;
    }
    await interaction.reply({
      content: baseImageAttachment
        ? "I ask the vision model to interpret your base image into a reusable prompt. I will update this message when the prompt is ready."
        : autoPrompt
          ? "I ask the LLM for a new image prompt now. I will update this message when the prompt is ready."
          : "I start image generation now from your prompt."
    });
    const statusMessage = await interaction.fetchReply();
    try {
      const prompt = baseImageAttachment
        ? await (async () => {
          const basePrompt = await dependencies.resolveImagePromptFromBaseImage({
            imageInput: baseImageAttachment.url,
            prompt: providedPrompt
          });
          if (!autoPrompt) {
            return basePrompt;
          }
          return dependencies.resolveImagePrompt({
            prompt: basePrompt,
            autoPrompt: true
          });
        })()
        : await dependencies.resolveImagePrompt({
          prompt: providedPrompt,
          autoPrompt
        });
      await interaction.editReply({
        content: baseImageAttachment
          ? autoPrompt
            ? `Vision + LLM prompt ready from \`${baseImageAttachment.name ?? "base image"}\`: \`${prompt}\`\nI generate your image now. Your source image is attached for transparency.`
            : `Vision prompt ready from \`${baseImageAttachment.name ?? "base image"}\`: \`${prompt}\`\nI generate your image now. Your source image is attached for transparency.`
          : autoPrompt
            ? `LLM prompt ready: \`${prompt}\`\nI generate your image now.`
            : `I generate your image now with this prompt: \`${prompt}\``,
        files: baseImageFile ? [baseImageFile] : []
      });
      const generated = dependencies.toGeneratedImagePublicRecord(await dependencies.generateImageWithExecution({
        prompt,
        imageInput: baseImageAttachment?.url,
        imageFileNameHint: baseImageAttachment?.name ?? undefined
      }));
      dependencies.recordAction(
        "slash:/image",
        `${interaction.user.tag} generated image ${generated.id}${baseImageAttachment ? ` from base image ${baseImageAttachment.name ?? "attachment"}` : ""}.`
      );
      const readyPayload = {
        content: baseImageAttachment
          ? "Your image is ready! Source image attached for transparency."
          : "Your image is ready!",
        embeds: [dependencies.buildGeneratedImageEmbed(generated)],
        files: [
          ...(baseImageFile ? [baseImageFile] : []),
          await dependencies.buildGeneratedImageAttachment(generated)
        ],
        components: dependencies.buildGeneratedImageComponents(generated, interaction.user.id)
      };
      let postedAsReply = false;
      if (interaction.channel?.isTextBased() && "send" in interaction.channel) {
        try {
          await interaction.channel.send({
            ...readyPayload,
            reply: {
              messageReference: statusMessage.id,
              failIfNotExists: false
            }
          });
          postedAsReply = true;
        } catch {
          postedAsReply = false;
        }
      }
      if (postedAsReply) {
        await interaction.editReply({
          content: baseImageAttachment
            ? autoPrompt
              ? "Base-image prompt enrichment finished and image generation finished. I posted the result in a reply below."
              : "Base-image prompt ready and image generation finished. I posted the result in a reply below."
            : autoPrompt
              ? "Prompt ready and image generation finished. I posted the result in a reply below."
              : "Image generation finished. I posted the result in a reply below."
        });
      } else {
        await interaction.editReply(readyPayload);
      }
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      dependencies.recordAction(
        "slash:/image-error",
        `${interaction.user.tag} failed image generation: ${errorDetail || "unknown error"}`
      );
      await interaction.editReply({
        content: [
          "Something went wrong while generating the image.",
          errorDetail ? `\nError detail:\n\`\`\`\n${errorDetail.slice(0, 1500)}\n\`\`\`` : ""
        ].join("")
      });
    }
    return true;
  }
  if (interaction.commandName === "video") {
    const prompt = resolvePromptFromOptions("prompt", ["text", "message", "input", "query"]);
    const startImage = getOptionAttachmentValue("start_image", ["image", "base_image", "source_image", "source", "input", "file"]);
    if (!prompt) {
      await interaction.reply({
        content: "Provide a prompt for `/video`.",
        ephemeral: true
      });
      return true;
    }
    if (startImage && !isLikelyImageAttachment(startImage.name ?? "", startImage.contentType)) {
      await interaction.reply({
        content: "Please provide an image attachment for `start_image`.",
        ephemeral: true
      });
      return true;
    }
    const secondsOption = interaction.options.getNumber("seconds");
    const framesOption = interaction.options.getInteger("frames");
    const fpsOption = interaction.options.getInteger("fps");
    const widthOption = interaction.options.getInteger("width");
    const heightOption = interaction.options.getInteger("height");
    const stepsOption = interaction.options.getInteger("steps");
    const negativePrompt = interaction.options.getString("negative_prompt")?.trim() || undefined;
    await interaction.deferReply();
    await interaction.editReply({
      content: startImage
        ? `I generate your video now from \`${startImage.name ?? "start image"}\` with prompt: \`${prompt}\``
        : `I generate your video now with prompt: \`${prompt}\``,
      files: startImage ? [{ attachment: startImage.url, name: startImage.name ?? "video-start.png" }] : []
    });
    try {
      const imageDataUrl = startImage
        ? await (async () => {
          const response = await fetch(startImage.url);
          if (!response.ok) throw new Error(`Could not download start image (${response.status}).`);
          const bytes = Buffer.from(await response.arrayBuffer());
          return `data:${startImage.contentType || "image/png"};base64,${bytes.toString("base64")}`;
        })()
        : undefined;
      const generated = dependencies.toGeneratedVideoPublicRecord(await dependencies.generateVideoFromPrompt({
        prompt,
        negativePrompt,
        seconds: typeof secondsOption === "number" && Number.isFinite(secondsOption) ? secondsOption : undefined,
        frames: typeof framesOption === "number" && Number.isFinite(framesOption) ? framesOption : undefined,
        fps: typeof fpsOption === "number" && Number.isFinite(fpsOption) ? fpsOption : undefined,
        width: typeof widthOption === "number" && Number.isFinite(widthOption) ? widthOption : undefined,
        height: typeof heightOption === "number" && Number.isFinite(heightOption) ? heightOption : undefined,
        steps: typeof stepsOption === "number" && Number.isFinite(stepsOption) ? stepsOption : undefined,
        imageDataUrl,
        imageFileName: startImage?.name ?? undefined
      }));
      dependencies.recordAction(
        "slash:/video",
        `${interaction.user.tag} generated video ${generated.id}${startImage ? ` from ${startImage.name ?? "start image"}` : ""}.`
      );
      await interaction.editReply({
        content: [
          "🎬 Your video is ready!",
          `Prompt: ${generated.prompt}`,
          generated.seconds ? `Duration: ${generated.seconds}s` : "",
          `File: ${generated.videoFileName}`
        ].filter(Boolean).join("\n"),
        files: [{
          attachment: await dependencies.resolveGeneratedVideoFilePath(generated.id, generated.videoFileName),
          name: generated.videoFileName
        }]
      });
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      dependencies.recordAction(
        "slash:/video-error",
        `${interaction.user.tag} failed video generation: ${errorDetail || "unknown error"}`
      );
      await interaction.editReply({
        content: [
          "Something went wrong while generating the video.",
          errorDetail ? `\nError detail:\n\`\`\`\n${errorDetail.slice(0, 1500)}\n\`\`\`` : ""
        ].join("")
      });
    }
    return true;
  }
  if (interaction.commandName === "describe") {
    const attachment = getOptionAttachmentValue("image", ["base_image", "source_image", "source", "input", "file"]);
    if (!attachment) {
      await interaction.reply({
        content: "Please provide an image attachment for `/describe`.",
        ephemeral: true
      });
      return true;
    }
    const sourceName = attachment.name ?? "attachment";
    const sourceFile = {
      attachment: attachment.url,
      name: sourceName
    };
    if (!isLikelyImageAttachment(sourceName, attachment.contentType)) {
      await interaction.reply({
        content: "Please provide an image attachment for `/describe`.",
        ephemeral: true
      });
      return true;
    }
    await interaction.deferReply();
    await interaction.editReply({
      content: `I describe this image now: \`${sourceName}\``
    });
    try {
      const description = await dependencies.describeImageWithVision({
        imageInput: attachment.url
      });
      dependencies.recordAction(
        "slash:/describe",
        `${interaction.user.tag} described image ${sourceName}.`
      );
      const descriptionChunks = splitLongMessage(`Image description for \`${sourceName}\`:\n\n${description}`, 2000);
      await interaction.editReply({
        content: descriptionChunks[0] || `Image description for \`${sourceName}\`:\n\nNo description returned.`,
        files: [sourceFile]
      });
      for (const chunk of descriptionChunks.slice(1)) {
        await interaction.followUp({ content: chunk });
      }
    } catch (error) {
      dependencies.recordAction(
        "slash:/describe-error",
        `${interaction.user.tag} failed image description for ${sourceName}: ${error instanceof Error ? error.message : "unknown error"}`
      );
      await interaction.editReply({
        content: "Something went wrong while describing the image."
      });
    }
    return true;
  }
  if (interaction.commandName === "imagepooladd") {
    const poolLookup = interaction.options.getString("pool", true).trim();
    const imageAttachment = interaction.options.getAttachment("image");
    const imageUrlRaw = interaction.options.getString("image_url")?.trim() ?? "";
    const imageSource = imageAttachment?.url?.trim() || imageUrlRaw;
    if (!imageSource) {
      await interaction.reply({
        content: "Provide either `image` or `image_url`.",
        ephemeral: true
      });
      return true;
    }
    const pools = await dependencies.listImagePools();
    const normalizedLookup = poolLookup.toLowerCase();
    const pool = pools.find(entry => entry.id === poolLookup)
      || pools.find(entry => entry.name.trim().toLowerCase() === normalizedLookup)
      || null;
    if (!pool) {
      const knownPools = pools.slice(0, 8).map(entry => `\`${entry.name}\``).join(", ");
      await interaction.reply({
        content: pools.length === 0
          ? "No image pools exist yet. Create one in Image Studio first."
          : `Pool \`${poolLookup}\` was not found. Known pools: ${knownPools}`,
        ephemeral: true
      });
      return true;
    }
    const result = await dependencies.addImageToPool({
      poolId: pool.id,
      imageSource,
      requestedBy: interaction.user.tag,
      reason: "slash:/imagepooladd"
    });
    dependencies.recordAction(
      "slash:/imagepooladd",
      `${interaction.user.tag} -> ${result.pool.name} (${result.added ? "added" : "already present"})`
    );
    await interaction.reply({
      content: result.added
        ? `Added image to pool **${result.pool.name}**. Total images: **${result.pool.images.length}**.`
        : `Image was already in pool **${result.pool.name}**. Total images: **${result.pool.images.length}**.`,
      ephemeral: true
    });
    return true;
  }
  if (interaction.commandName === "audio") {
    const prompt = interaction.options.getString("prompt", true).trim();
    const secondsOption = interaction.options.getNumber("seconds");
    const seconds = typeof secondsOption === "number" && Number.isFinite(secondsOption)
      ? Math.max(1, Math.min(120, Math.round(secondsOption)))
      : undefined;
    await interaction.deferReply();
    await interaction.editReply({
      content: `I generate your audio now with this prompt: \`${prompt}\``
    });
    try {
      const generated = dependencies.toGeneratedAudioPublicRecord(await dependencies.generateAudioWithExecution({
        prompt,
        seconds
      }));
      dependencies.recordAction(
        "slash:/audio",
        `${interaction.user.tag} generated audio ${generated.id}.`
      );
      await interaction.editReply({
        content: "ðŸŽµ Your audio is ready!",
        embeds: [dependencies.buildGeneratedAudioEmbed(generated)],
        files: [await dependencies.buildGeneratedAudioAttachment(generated)]
      });
    } catch (error) {
      dependencies.recordAction(
        "slash:/audio-error",
        `${interaction.user.tag} failed audio generation: ${error instanceof Error ? error.message : "unknown error"}`
      );
      await interaction.editReply({
        content: "Something went wrong while generating the audio."
      });
    }
    return true;
  }
  if (interaction.commandName === "music") {
    const secondsOption = interaction.options.getNumber("seconds", true);
    const tags = interaction.options.getString("tags")?.trim() ?? "";
    const lyrics = interaction.options.getString("lyrics")?.trim() ?? "";
    const seconds = Math.max(1, Math.min(120, Math.round(secondsOption)));
    await interaction.deferReply();
    await interaction.editReply({
      content: `I generate your music now (${seconds}s).`
    });
    try {
      const generated = dependencies.toGeneratedAudioPublicRecord(await dependencies.generateMusicWithExecution({
        seconds,
        tags,
        lyrics
      }));
      dependencies.recordAction(
        "slash:/music",
        `${interaction.user.tag} generated music ${generated.id}.`
      );
      await interaction.editReply({
        content: "ðŸŽ¶ Your music is ready!",
        embeds: [dependencies.buildGeneratedMusicEmbed(generated)],
        files: [await dependencies.buildGeneratedAudioAttachment(generated)]
      });
    } catch (error) {
      dependencies.recordAction(
        "slash:/music-error",
        `${interaction.user.tag} failed music generation: ${error instanceof Error ? error.message : "unknown error"}`
      );
      await interaction.editReply({
        content: "Something went wrong while generating the music."
      });
    }
    return true;
  }
  if (interaction.commandName === "invite") {
    const inviteUrl = dependencies.buildBotInviteUrl(interaction.guildId);
    dependencies.recordAction("slash:/invite", `${interaction.user.tag} generated an invite link.`);
    await interaction.reply({
      content: `Invite Discrod with this link:\n${inviteUrl}`,
      ephemeral: true
    });
    return true;
  }
  return false;
}
