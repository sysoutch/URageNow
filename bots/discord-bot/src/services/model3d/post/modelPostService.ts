import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Channel
} from "discord.js";
import path from "node:path";
import type {
  GeneratedModelPublicRecord
} from "@urage/server/services/model3d";

export type {
  ModelNameSource,
  ModelPostMessageMode,
  ModelPostOptions,
  ModelPostService,
  ModelPostServiceDependencies,
  ModelPostTargetMode,
  ModelTextureUploadTarget,
  ModelThreadNameMode,
  ModelUploadTarget
} from "./modelPostTypes.js";
import type {
  BuildPayloadResult,
  EditableModelMessage,
  ModelPostChannelResolution,
  ModelPostMessageMode,
  ModelPostOptions,
  ModelPostResult,
  ModelPostService,
  ModelPostServiceDependencies,
  ModelTextureMessageLinks,
  SendableGuildChannel
} from "./modelPostTypes.js";
import {
  MODEL_FOLLOW_UP_DELAY_MS,
  asEditableModelMessage,
  asSendableGuildChannel,
  buildDiscordMessageUrl,
  buildLinkedPreviewEmbed,
  extractMessageUrl,
  extractModelMediaUrl,
  extractPreviewMediaUrl,
  extractSourceImageUrl,
  formatLowPolyReference,
  formatRealWorldDimensionsMeters,
  formatTargetFaceCount,
  formatToggleState,
  hasAnyTextureLinks,
  mergeExtraContent,
  normalizeDiscordAttachmentUrl,
  normalizeDiscordMessageUrl,
  parseGifDataUrl,
  sleep
} from "./modelPostHelpers.js";
import { createModelPostAttachmentHelpers } from "./modelPostAttachmentHelpers.js";
import { createModelPostEmbedHelpers } from "./modelPostEmbedHelpers.js";
import { createModelPostLowPolyFollowUpService } from "./modelPostLowPolyFollowUpService.js";
import { createModelPostTextureUploadService } from "./modelPostTextureUploadService.js";
import { listThreadNamesForParent, resolveThreadNameFromOptions } from "./modelPostThreadHelpers.js";
import { createModelPostUiHelpers } from "./modelPostUiHelpers.js";

export function createModelPostService(dependencies: ModelPostServiceDependencies): ModelPostService {
  const modelPostUiHelpers = createModelPostUiHelpers(dependencies.buttonPrefixes);
  const buildGeneratedModelComponents = modelPostUiHelpers.buildGeneratedModelComponents;
  const buildLowPolyModelComponents = modelPostUiHelpers.buildLowPolyModelComponents;
  const buildModelReadyContent = modelPostUiHelpers.buildModelReadyContent;
  const normalizeModelPostOptions = modelPostUiHelpers.normalizeModelPostOptions;
  const modelPostEmbedHelpers = createModelPostEmbedHelpers({
    formatTargetFaceCount,
    formatRealWorldDimensionsMeters,
    formatLowPolyReference,
    formatToggleState,
    normalizeDiscordAttachmentUrl,
    normalizeDiscordMessageUrl
  });
  const buildGeneratedModelEmbed = modelPostEmbedHelpers.buildGeneratedModelEmbed;
  const buildLowPolyModelEmbed = modelPostEmbedHelpers.buildLowPolyModelEmbed;
  const modelPostAttachmentHelpers = createModelPostAttachmentHelpers({
    resolveGeneratedModelFilePath: dependencies.resolveGeneratedModelFilePath
  });
  const buildGeneratedModelAttachments = modelPostAttachmentHelpers.buildGeneratedModelAttachments;
  const modelPostTextureUploadService = createModelPostTextureUploadService({
    resolveGeneratedModelFilePath: dependencies.resolveGeneratedModelFilePath,
    asEditableModelMessage,
    buildDiscordMessageUrl,
    sleep,
    followUpDelayMs: MODEL_FOLLOW_UP_DELAY_MS
  });
  const uploadGeneratedModelTextureMessages = modelPostTextureUploadService.uploadGeneratedModelTextureMessages;
  const modelPostLowPolyFollowUpService = createModelPostLowPolyFollowUpService({
    generateLowPolyModel: dependencies.generateLowPolyModel,
    suggestLowPolyByComplexity: dependencies.suggestLowPolyByComplexity,
    resolveGeneratedModelFilePath: dependencies.resolveGeneratedModelFilePath,
    normalizeModelPostOptions,
    buildGeneratedModelAttachments,
    buildLowPolyModelEmbed,
    buildLowPolyModelComponents,
    asEditableModelMessage,
    resolveLowPolyFollowUpTarget,
    sleep,
    followUpDelayMs: MODEL_FOLLOW_UP_DELAY_MS,
    formatTargetFaceCount
  });
  const maybePostLowPolyFollowUp = modelPostLowPolyFollowUpService.maybePostLowPolyFollowUp;
  async function createThreadChannel(parentChannel: { id: string; guildId: string; threads: { create: (options: { name: string; autoArchiveDuration: 1440; reason: string; }) => Promise<unknown>; }; }, record: GeneratedModelPublicRecord, options: Required<ModelPostOptions>): Promise<SendableGuildChannel> {
    const existingNames = await listThreadNamesForParent(dependencies.client, parentChannel.guildId, parentChannel.id);
    const threadName = resolveThreadNameFromOptions(record, options, existingNames);
    const createdThread = await parentChannel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: "Created from Discrod model studio"
    });
    const sendable = asSendableGuildChannel(createdThread);
    if (!sendable) {
      throw new Error("Thread was created but is not sendable.");
    }
    return sendable;
  }

  async function createForumThreadFromModelPost(forumChannel: import("discord.js").ForumChannel, messagePayload: BuildPayloadResult, record: GeneratedModelPublicRecord, options: Required<ModelPostOptions>): Promise<ModelPostChannelResolution> {
    const existingNames = await listThreadNamesForParent(dependencies.client, forumChannel.guildId, forumChannel.id);
    const threadName = resolveThreadNameFromOptions(record, options, existingNames);
    const createdThread = await forumChannel.threads.create({
      name: threadName,
      message: messagePayload,
      reason: "Created from Discrod model studio"
    });
    const targetChannel = asSendableGuildChannel(createdThread);
    if (!targetChannel) {
      throw new Error("Forum post thread was created but is not sendable.");
    }
    const starterMessageRaw = await createdThread.fetchStarterMessage().catch(() => null);
    const starterMessage = asEditableModelMessage(starterMessageRaw);
    return {
      selectedChannel: null,
      targetChannel,
      starterMessage: starterMessage ?? undefined,
      starterMessageRaw: starterMessageRaw ?? undefined
    };
  }

  async function ensureForumChannel(guildId: string, forumChannelName: string): Promise<import("discord.js").ForumChannel> {
    const guild = dependencies.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error("Guild not found.");
    }
    const normalizedName = forumChannelName.trim().toLowerCase();
    const channels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch();
    for (const channel of channels.values()) {
      if (!channel || channel.type !== ChannelType.GuildForum || !("name" in channel) || typeof channel.name !== "string") {
        continue;
      }
      if (channel.name.toLowerCase() === normalizedName) {
        return channel;
      }
    }
    dependencies.ensureGuildPermission(await dependencies.requireGuildBotMember(guildId), PermissionFlagsBits.ManageChannels, "Manage Channels");
    const created = await guild.channels.create({
      name: forumChannelName.trim(),
      type: ChannelType.GuildForum,
      reason: "Created from Discrod model studio"
    });
    if (created.type !== ChannelType.GuildForum) {
      throw new Error("Failed to create forum channel.");
    }
    return created;
  }

  async function resolveExistingForumChannel(guildId: string, forumChannelId: string): Promise<import("discord.js").ForumChannel> {
    const channel = await dependencies.client.channels.fetch(forumChannelId.trim());
    if (!channel || channel.type !== ChannelType.GuildForum) {
      throw new Error("Selected forum channel was not found.");
    }
    if (!("guildId" in channel) || channel.guildId !== guildId) {
      throw new Error("Selected forum channel is not part of the selected guild.");
    }
    return channel;
  }

  function buildLowPolyForumPostName(record: GeneratedModelPublicRecord): string {
    const sourceStem = path.basename(record.modelFileName, path.extname(record.modelFileName)).trim() || "model";
    const normalized = `${sourceStem} lowpoly`.replace(/\s+/g, " ").trim();
    return normalized.slice(0, 90);
  }

  async function resolveLowPolyFollowUpTarget(input: {
    generated: GeneratedModelPublicRecord;
    options: Required<ModelPostOptions>;
    postedChannel: SendableGuildChannel | null;
  }): Promise<{ progressMessage: EditableModelMessage | null; postChannel: SendableGuildChannel | null }> {
    if (!input.postedChannel) {
      return { progressMessage: null, postChannel: null };
    }
    const lowPolyForumChannelId = input.options.lowPolyForumChannelId.trim();
    const lowPolyForumChannelName = input.options.lowPolyForumChannelName.trim();
    if (!lowPolyForumChannelId && !lowPolyForumChannelName) {
      const progressRawMessage = await input.postedChannel.send("🧩 I also create a Low Poly version of this model now...");
      return {
        progressMessage: asEditableModelMessage(progressRawMessage),
        postChannel: input.postedChannel
      };
    }
    const forumChannel = lowPolyForumChannelId
      ? await resolveExistingForumChannel(input.postedChannel.guildId, lowPolyForumChannelId)
      : await ensureForumChannel(input.postedChannel.guildId, lowPolyForumChannelName);
    const postName = buildLowPolyForumPostName(input.generated);
    const createdThread = await forumChannel.threads.create({
      name: postName,
      message: {
        content: "🧩 I also create a Low Poly version of this model now..."
      },
      reason: "Created from Discrod model studio"
    });
    const postChannel = asSendableGuildChannel(createdThread);
    if (!postChannel) {
      throw new Error("Low Poly forum post thread was created but is not sendable.");
    }
    const starterMessageRaw = await createdThread.fetchStarterMessage().catch(() => null);
    const progressMessage = asEditableModelMessage(starterMessageRaw);
    if (progressMessage) {
      return { progressMessage, postChannel };
    }
    const fallbackProgressRaw = await postChannel.send("🧩 I also create a Low Poly version of this model now...");
    return {
      progressMessage: asEditableModelMessage(fallbackProgressRaw),
      postChannel
    };
  }

  async function buildGeneratedModelMessagePayloadWithOptions(
    record: GeneratedModelPublicRecord,
    mode: ModelPostMessageMode,
    options: Required<ModelPostOptions>,
    extraContent?: string,
    textureLinks?: ModelTextureMessageLinks,
    includeEmbedOverride?: boolean,
    includePublicTextureButtons = true,
    previewMediaUrl?: string
  ): Promise<BuildPayloadResult> {
    const extra = extraContent?.trim();
    const shouldIncludeEmbed = includeEmbedOverride ?? options.includeEmbed;
    const previewEmbed = !options.includePreviewMedia && previewMediaUrl
      ? buildLinkedPreviewEmbed(previewMediaUrl)
      : null;
    const embeds: EmbedBuilder[] = [];
    if (shouldIncludeEmbed) {
      embeds.push(buildGeneratedModelEmbed(record, textureLinks));
    }
    if (previewEmbed) {
      embeds.push(previewEmbed);
    }
    return {
      content: extra
        ? `${buildModelReadyContent(mode, includePublicTextureButtons)}\n\n${extra}`
        : buildModelReadyContent(mode, includePublicTextureButtons),
      embeds,
      files: await buildGeneratedModelAttachments(record, mode, options),
      components: buildGeneratedModelComponents(record, mode, options, textureLinks, includePublicTextureButtons)
    };
  }

  async function resolveModelPostChannels(generated: GeneratedModelPublicRecord, channelId: string, options: Required<ModelPostOptions>, messagePayload: BuildPayloadResult): Promise<ModelPostChannelResolution> {
    if (options.targetMode === "channel") {
      const channel = await dependencies.requireSendableChannel(channelId);
      const sendable = asSendableGuildChannel(channel);
      if (!sendable) {
        throw new Error("Select a server channel for model posting.");
      }
      return {
        selectedChannel: sendable,
        targetChannel: sendable
      };
    }
    const selectedChannel = await dependencies.client.channels.fetch(channelId);
    if (!selectedChannel || !("guildId" in selectedChannel) || typeof selectedChannel.guildId !== "string") {
      throw new Error("Select a server channel for model posting.");
    }
    const botMember = await dependencies.requireGuildBotMember(selectedChannel.guildId);
    if (options.targetMode === "thread") {
      if (selectedChannel.type !== ChannelType.GuildText && selectedChannel.type !== ChannelType.GuildAnnouncement) {
        throw new Error("Thread mode requires a selected text or announcement channel.");
      }
      dependencies.ensureChannelPermission(botMember, selectedChannel, PermissionFlagsBits.CreatePublicThreads, "Create Public Threads");
      dependencies.ensureChannelPermission(botMember, selectedChannel, PermissionFlagsBits.SendMessagesInThreads, "Send Messages In Threads");
      return {
        selectedChannel: asSendableGuildChannel(selectedChannel),
        targetChannel: await createThreadChannel(selectedChannel, generated, options)
      };
    }
    if (options.targetMode === "forum-post") {
      const forumChannel = options.forumChannelId
        ? await resolveExistingForumChannel(selectedChannel.guildId, options.forumChannelId)
        : selectedChannel;
      if (forumChannel.type !== ChannelType.GuildForum) {
        throw new Error("Forum post mode requires a selected forum channel or explicit forum channel id.");
      }
      dependencies.ensureChannelPermission(botMember, forumChannel, PermissionFlagsBits.CreatePublicThreads, "Create Public Threads");
      dependencies.ensureChannelPermission(botMember, forumChannel, PermissionFlagsBits.SendMessages, "Send Messages");
      return createForumThreadFromModelPost(forumChannel, messagePayload, generated, options);
    }
    const forumChannel = options.forumChannelId
      ? await resolveExistingForumChannel(selectedChannel.guildId, options.forumChannelId)
      : await (async () => {
        const forumChannelName = options.forumChannelName.trim();
        if (!forumChannelName) {
          throw new Error("Forum channel id or forum channel name is required for forum create mode.");
        }
        return ensureForumChannel(selectedChannel.guildId, forumChannelName);
      })();
    dependencies.ensureChannelPermission(botMember, forumChannel, PermissionFlagsBits.CreatePublicThreads, "Create Public Threads");
    dependencies.ensureChannelPermission(botMember, forumChannel, PermissionFlagsBits.SendMessages, "Send Messages");
    return createForumThreadFromModelPost(forumChannel, messagePayload, generated, options);
  }


  async function postGeneratedModelToChannel(input: {
    channelId: string;
    generated: GeneratedModelPublicRecord;
    requestedBy?: string;
    messageMode?: ModelPostMessageMode;
    postOptions?: ModelPostOptions;
    extraContent?: string;
    sharedTextureLinks?: ModelTextureMessageLinks;
    skipTextureUploads?: boolean;
    includeEmbedOverride?: boolean;
    includePublicTextureButtons?: boolean;
    previewMediaUrl?: string;
    replyToMessageId?: string;
  }): Promise<ModelPostResult> {
    const messageMode = input.messageMode ?? "detailed";
    const options = normalizeModelPostOptions(input.postOptions);
    const initialLinks = input.sharedTextureLinks ?? {};
    const messagePayload = await buildGeneratedModelMessagePayloadWithOptions(
      input.generated,
      messageMode,
      options,
      input.extraContent,
      hasAnyTextureLinks(initialLinks) ? initialLinks : undefined,
      input.includeEmbedOverride,
      input.includePublicTextureButtons ?? true,
      input.previewMediaUrl
    );
    const resolution = await resolveModelPostChannels(input.generated, input.channelId, options, messagePayload);
    let postedMessage = resolution.starterMessage;
    let postedMessageRaw: unknown = resolution.starterMessageRaw;
    if (!postedMessage) {
      const shouldReplyInTargetChannel = Boolean(input.replyToMessageId && resolution.targetChannel.id === input.channelId);
      const sendPayload = shouldReplyInTargetChannel
        ? {
          ...messagePayload,
          messageReference: {
            messageId: input.replyToMessageId
          },
          allowedMentions: {
            repliedUser: false
          }
        }
        : messagePayload;
      const sent = await resolution.targetChannel.send(sendPayload);
      postedMessageRaw = sent;
      postedMessage = asEditableModelMessage(sent) ?? undefined;
    }
    let textureLinks = initialLinks;
    if (!input.skipTextureUploads && messageMode === "public" && options.uploadTextureMessages) {
      textureLinks = {
        ...textureLinks,
        ...await uploadGeneratedModelTextureMessages({
          generated: input.generated,
          options,
          selectedChannel: resolution.selectedChannel,
          targetChannel: resolution.targetChannel
        })
      };
    }
    if (postedMessage && messageMode === "public" && hasAnyTextureLinks(textureLinks)) {
      const updatedPayload = await buildGeneratedModelMessagePayloadWithOptions(
        input.generated,
        messageMode,
        options,
        input.extraContent,
        textureLinks,
        input.includeEmbedOverride,
        input.includePublicTextureButtons ?? true,
        input.previewMediaUrl
      );
      await postedMessage.edit({
        embeds: updatedPayload.embeds,
        components: updatedPayload.components
      });
    }
    return {
      textureLinks,
      postedMessage,
      messageUrl: extractMessageUrl(postedMessageRaw)
        || (postedMessage ? buildDiscordMessageUrl(resolution.targetChannel.guildId, resolution.targetChannel.id, postedMessage.id) : undefined),
      previewMediaUrl: extractPreviewMediaUrl(postedMessageRaw),
      modelMediaUrl: extractModelMediaUrl(postedMessageRaw, input.generated.modelFileName),
      sourceImageUrl: extractSourceImageUrl(postedMessageRaw, input.generated.sourceImageFileName),
      postedChannel: resolution.targetChannel
    };
  }

  async function postGeneratedModelWithRouting(input: { channelId: string; generated: GeneratedModelPublicRecord; requestedBy?: string; messageMode?: ModelPostMessageMode; postOptions?: ModelPostOptions; extraContent?: string; replyToMessageId?: string; }): Promise<GeneratedModelPublicRecord> {
    const options = normalizeModelPostOptions(input.postOptions);
    let postedModel = input.generated;
    const destinationExtra = input.extraContent?.trim() || options.destinationExtraText.trim();
    const initialExtra = options.initialExtraText.trim();
    if (options.targetMode !== "channel" && options.sendInitialToSelectedChannel) {
      let selectedResult: ModelPostResult = { textureLinks: {} };
      const selectedMirrorBaseExtra = mergeExtraContent([initialExtra, destinationExtra]);
      const selectedMirrorOptions: ModelPostOptions = {
        targetMode: "channel",
        modelUploadTarget: options.modelUploadTarget,
        includeModelFile: options.modelUploadTarget === "selected" && options.includeModelFile,
        includePreviewMedia: true,
        includeSourceImage: false,
        includeEmbed: false,
        includeButtons: options.includeButtons,
        uploadTextureMessages: false
      };
      try {
        selectedResult = await postGeneratedModelToChannel({
          channelId: input.channelId,
          generated: input.generated,
          requestedBy: input.requestedBy,
          messageMode: "public",
          postOptions: selectedMirrorOptions,
          extraContent: selectedMirrorBaseExtra,
          skipTextureUploads: true,
          includeEmbedOverride: false,
          replyToMessageId: input.replyToMessageId
        });
      } catch (error) {
        console.warn("Failed to post mirrored selected-channel model message.", error);
      }
      const destinationPreviewMediaUrl = selectedResult.previewMediaUrl
        ? normalizeDiscordAttachmentUrl(selectedResult.previewMediaUrl)
        : undefined;
      const destinationModelMediaUrl = selectedResult.modelMediaUrl
        ? normalizeDiscordAttachmentUrl(selectedResult.modelMediaUrl)
        : undefined;
      const destinationSourceImageUrl = selectedResult.sourceImageUrl
        ? normalizeDiscordAttachmentUrl(selectedResult.sourceImageUrl)
        : undefined;
      const destinationLink = destinationPreviewMediaUrl || selectedResult.messageUrl;
      await sleep(MODEL_FOLLOW_UP_DELAY_MS);
      const destinationResult = await postGeneratedModelToChannel({
        channelId: input.channelId,
        generated: input.generated,
        requestedBy: input.requestedBy,
        messageMode: input.messageMode,
        postOptions: {
          ...options,
          sendInitialToSelectedChannel: false,
          includeSourceImage: !destinationSourceImageUrl && options.includeSourceImage,
          includePreviewMedia: !destinationLink && options.includePreviewMedia,
          includeModelFile: options.includeModelFile && (options.modelUploadTarget === "target" || !destinationModelMediaUrl),
          includeEmbed: options.includeEmbed,
          includeButtons: selectedResult.postedMessage ? false : options.includeButtons
        },
        extraContent: mergeExtraContent([
          destinationExtra,
          selectedResult.messageUrl ? `🔗 Initial post:\n${normalizeDiscordMessageUrl(selectedResult.messageUrl)}` : undefined,
          destinationModelMediaUrl ? `📦 Model:\n${destinationModelMediaUrl}` : undefined,
          destinationLink ? `🖼️ Preview:\n${destinationLink}` : undefined,
          destinationSourceImageUrl ? `🧾 Source image:\n${destinationSourceImageUrl}` : undefined
        ]),
        sharedTextureLinks: selectedResult.textureLinks,
        includePublicTextureButtons: false,
        previewMediaUrl: destinationPreviewMediaUrl
      });
      const finalModelMediaUrl = destinationModelMediaUrl || destinationResult.modelMediaUrl;
      if (selectedResult.postedMessage) {
        const shouldLinkModelFromTarget = options.includeModelFile && options.modelUploadTarget === "target" && Boolean(finalModelMediaUrl);
        const shouldUpdateTextureButtons = options.includeButtons && hasAnyTextureLinks(destinationResult.textureLinks);
        if (shouldLinkModelFromTarget || shouldUpdateTextureButtons) {
          const selectedUpdatePayload = await buildGeneratedModelMessagePayloadWithOptions(
            input.generated,
            "public",
            normalizeModelPostOptions(selectedMirrorOptions),
            shouldLinkModelFromTarget
              ? mergeExtraContent([selectedMirrorBaseExtra, `📦 Model:\n${finalModelMediaUrl}`])
              : selectedMirrorBaseExtra,
            shouldUpdateTextureButtons ? destinationResult.textureLinks : undefined,
            false
          );
          await selectedResult.postedMessage.edit({
            content: selectedUpdatePayload.content,
            embeds: selectedUpdatePayload.embeds,
            components: selectedUpdatePayload.components
          });
        }
      }
      postedModel = await maybePostLowPolyFollowUp({
        generated: postedModel,
        options,
        postedChannel: destinationResult.postedChannel ?? null,
        highPolyModelUrl: finalModelMediaUrl || selectedResult.modelMediaUrl || input.generated.modelUrl,
        highPolyMessageUrl: destinationResult.messageUrl || selectedResult.messageUrl
      });
      return postedModel;
    }
    const directResult = await postGeneratedModelToChannel({
      channelId: input.channelId,
      generated: postedModel,
      requestedBy: input.requestedBy,
      messageMode: input.messageMode,
      postOptions: options,
      extraContent: destinationExtra || undefined,
      replyToMessageId: input.replyToMessageId
    });
    postedModel = await maybePostLowPolyFollowUp({
      generated: postedModel,
      options,
      postedChannel: directResult.postedChannel ?? null,
      highPolyModelUrl: directResult.modelMediaUrl || input.generated.modelUrl,
      highPolyMessageUrl: directResult.messageUrl
    });
    return postedModel;
  }

  async function generateModelAndPostToChannel(input: { channelId: string; imageInput: string; prompt?: string; stripMetadata?: boolean; requestedBy?: string; messageMode?: ModelPostMessageMode; postOptions?: ModelPostOptions; extraContent?: string; }): Promise<GeneratedModelPublicRecord> {
    const generated = dependencies.toGeneratedModelPublicRecord(await dependencies.generate3dModelFromImage({
      imageInput: input.imageInput,
      prompt: input.prompt,
      stripMetadata: input.stripMetadata
    }));
    return postGeneratedModelWithRouting({
      channelId: input.channelId,
      generated,
      requestedBy: input.requestedBy,
      messageMode: input.messageMode,
      postOptions: input.postOptions,
      extraContent: input.extraContent
    });
  }

  async function postExistingGeneratedModelToChannel(input: { modelId: string; channelId: string; requestedBy?: string; messageMode?: ModelPostMessageMode; postOptions?: ModelPostOptions; extraContent?: string; previewGifDataUrl?: string; replyToMessageId?: string; }): Promise<GeneratedModelPublicRecord> {
    const modelId = input.modelId.trim();
    if (!modelId) {
      throw new Error("modelId is required.");
    }
    let generated = await dependencies.getGeneratedModelPublicById(modelId);
    if (!generated) {
      throw new Error("Generated model not found.");
    }
    if (input.previewGifDataUrl?.trim()) {
      const previewGifBytes = parseGifDataUrl(input.previewGifDataUrl);
      generated = await dependencies.setGeneratedModelPreviewGif(modelId, previewGifBytes, "preview-threejs.gif");
    }
    return postGeneratedModelWithRouting({
      channelId: input.channelId,
      generated,
      requestedBy: input.requestedBy,
      messageMode: input.messageMode,
      postOptions: input.postOptions,
      extraContent: input.extraContent,
      replyToMessageId: input.replyToMessageId
    });
  }

  return {
    normalizeModelPostOptions,
    buildModelReadyContent,
    buildGeneratedModelEmbed,
    buildLowPolyModelEmbed,
    buildGeneratedModelAttachments,
    buildGeneratedModelComponents,
    buildLowPolyModelComponents,
    postGeneratedModelWithRouting,
    generateModelAndPostToChannel,
    postExistingGeneratedModelToChannel
  };
}








