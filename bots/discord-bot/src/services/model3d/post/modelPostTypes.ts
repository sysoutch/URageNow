import type {
  ActionRowBuilder,
  ButtonBuilder,
  Client,
  EmbedBuilder,
  GuildMember,
  MessageCreateOptions,
  PermissionsBitField
} from "discord.js";
import type {
  GenerateModelInput,
  GeneratedModelPublicRecord,
  GeneratedModelRecord
} from "@urage/server/services/model3d";

export type ModelPostMessageMode = "detailed" | "public";
export type ModelPostTargetMode = "channel" | "thread" | "forum-post" | "forum-create-and-post";
export type ModelThreadNameMode = "fixed" | "increment" | "model-name";
export type ModelTextureUploadTarget = "selected" | "target";
export type ModelUploadTarget = "selected" | "target";
export type ModelNameSource = "llm" | "filename";

export interface ModelPostOptions {
  targetMode?: ModelPostTargetMode;
  threadNameMode?: ModelThreadNameMode;
  threadName?: string;
  threadNameBase?: string;
  modelNameSource?: ModelNameSource;
  forumChannelId?: string;
  forumChannelName?: string;
  lowPolyForumChannelId?: string;
  lowPolyForumChannelName?: string;
  sendInitialToSelectedChannel?: boolean;
  initialExtraText?: string;
  destinationExtraText?: string;
  modelUploadTarget?: ModelUploadTarget;
  includeModelFile?: boolean;
  includePreviewMedia?: boolean;
  includeSourceImage?: boolean;
  includeEmbed?: boolean;
  includeEmbedInInitial?: boolean;
  includeButtons?: boolean;
  uploadTextureMessages?: boolean;
  uploadMultiViewTextures?: boolean;
  uploadUvMapTextures?: boolean;
  uploadNormalMapTextures?: boolean;
  textureUploadTarget?: ModelTextureUploadTarget;
  generateLowPolyVersion?: boolean;
  lowPolyExecutionTarget?: "local" | "remote";
  lowPolyUseLlmTargetFaces?: boolean;
  lowPolyLlmDecisionSource?: "input-image" | "model-render";
  lowPolyTargetFaceCount?: number;
}

export interface SendableChannel {
  send: (content: string | MessageCreateOptions) => Promise<unknown>;
}

export interface SendableGuildChannel extends SendableChannel {
  id: string;
  guildId: string;
}

export interface EditableModelMessage {
  id: string;
  edit: (payload: {
    content?: string;
    files?: Array<{ attachment: string; name: string }>;
    components?: Array<ActionRowBuilder<ButtonBuilder>>;
    embeds?: EmbedBuilder[];
  }) => Promise<unknown>;
}

export interface ModelTextureMessageLinks {
  multiViewUrl?: string;
  uvMapUrl?: string;
  normalMapUrl?: string;
}

export interface LowPolyEmbedLinks {
  highPolyModelUrl?: string;
  highPolyMessageUrl?: string;
}

export interface ModelPostResult {
  textureLinks: ModelTextureMessageLinks;
  postedMessage?: EditableModelMessage;
  messageUrl?: string;
  previewMediaUrl?: string;
  modelMediaUrl?: string;
  sourceImageUrl?: string;
  postedChannel?: SendableGuildChannel;
}

export interface ModelPostChannelResolution {
  selectedChannel: SendableGuildChannel | null;
  targetChannel: SendableGuildChannel;
  starterMessage?: EditableModelMessage;
  starterMessageRaw?: unknown;
}

export interface ModelPostButtonPrefixes {
  upvote: string;
  downvote: string;
  refresh: string;
  newModel: string;
  settings: string;
  lowPoly: string;
  multiView: string;
  uvMap: string;
  normalMap: string;
}

export interface ModelPostServiceDependencies {
  client: Client;
  buttonPrefixes: ModelPostButtonPrefixes;
  requireSendableChannel: (channelId: string) => Promise<SendableChannel>;
  requireGuildBotMember: (guildId: string) => Promise<GuildMember>;
  ensureGuildPermission: (member: GuildMember, permission: bigint, label: string) => void;
  ensureChannelPermission: (member: GuildMember, channel: { permissionsFor: (member: GuildMember) => PermissionsBitField | null }, permission: bigint, label: string) => void;
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  generate3dModelFromImage: (input: GenerateModelInput) => Promise<GeneratedModelRecord>;
  generateLowPolyModel: (input: { modelId: string; targetFaceCount?: number; executionTarget?: "local" | "remote"; }) => Promise<GeneratedModelPublicRecord>;
  suggestLowPolyByComplexity: (input: {
    promptContext?: string;
    sourceImageInput?: string;
    extraContext?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<{ targetFaceCount: number }>;
  toGeneratedModelPublicRecord: (record: GeneratedModelRecord) => GeneratedModelPublicRecord;
  getGeneratedModelPublicById: (modelId: string) => Promise<GeneratedModelPublicRecord | null>;
  setGeneratedModelPreviewGif: (modelId: string, gifBytes: Buffer, fileNameHint?: string) => Promise<GeneratedModelPublicRecord>;
}

export interface BuildPayloadResult {
  content: string;
  embeds: EmbedBuilder[];
  files: Array<{ attachment: string; name: string }>;
  components: Array<ActionRowBuilder<ButtonBuilder>>;
}

export interface ModelPostService {
  normalizeModelPostOptions: (options: ModelPostOptions | undefined) => Required<ModelPostOptions>;
  buildModelReadyContent: (mode?: ModelPostMessageMode, includePublicTextureButtons?: boolean) => string;
  buildGeneratedModelEmbed: (record: GeneratedModelPublicRecord, textureLinks?: ModelTextureMessageLinks) => EmbedBuilder;
  buildLowPolyModelEmbed: (record: GeneratedModelPublicRecord, links?: LowPolyEmbedLinks) => EmbedBuilder;
  buildGeneratedModelAttachments: (record: GeneratedModelPublicRecord, mode: ModelPostMessageMode, options: Required<ModelPostOptions>) => Promise<Array<{ attachment: string; name: string }>>;
  buildGeneratedModelComponents: (record: GeneratedModelPublicRecord, mode?: ModelPostMessageMode, options?: Required<ModelPostOptions>, textureLinks?: ModelTextureMessageLinks, includePublicTextureButtons?: boolean) => Array<ActionRowBuilder<ButtonBuilder>>;
  buildLowPolyModelComponents: (record: GeneratedModelPublicRecord, includeButtons?: boolean) => Array<ActionRowBuilder<ButtonBuilder>>;
  postGeneratedModelWithRouting: (input: {
    channelId: string;
    generated: GeneratedModelPublicRecord;
    requestedBy?: string;
    messageMode?: ModelPostMessageMode;
    postOptions?: ModelPostOptions;
    extraContent?: string;
    replyToMessageId?: string;
  }) => Promise<GeneratedModelPublicRecord>;
  generateModelAndPostToChannel: (input: {
    channelId: string;
    imageInput: string;
    prompt?: string;
    stripMetadata?: boolean;
    requestedBy?: string;
    messageMode?: ModelPostMessageMode;
    postOptions?: ModelPostOptions;
    extraContent?: string;
  }) => Promise<GeneratedModelPublicRecord>;
  postExistingGeneratedModelToChannel: (input: {
    modelId: string;
    channelId: string;
    requestedBy?: string;
    messageMode?: ModelPostMessageMode;
    postOptions?: ModelPostOptions;
    extraContent?: string;
    previewGifDataUrl?: string;
    replyToMessageId?: string;
  }) => Promise<GeneratedModelPublicRecord>;
}
