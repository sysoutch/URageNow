import type { TextSourcePreview, TextSourceSummary } from "../automation/textSources.js";
import type {
  AutomationPreset,
  JoinAutomation,
  ScheduledAutomation
} from "../automation/index.js";
import type {
  DashboardRuntimeState,
  ChatModeDebugStatus,
  GlobalDashboardSettings,
  GuildDashboardSettings,
  StoredDashboardSettings
} from "./runtimeContracts.js";
import type { GeneratedModelPublicRecord } from "../model3d/contracts.js";
import type {
  GeneratedAudioPublicRecord,
  GeneratedImagePublicRecord,
  GeneratedVideoPublicRecord
} from "../media/generatedRecords.js";
import type { ProbeGeneratedMediaInput, RustMediaProbeResult } from "../media/probeContracts.js";
import type { ImagePool } from "../resourcePools/imagePoolContracts.js";
import type { RustAssetIndexResult } from "../model3d/assetIndexContracts.js";
import type { RustAssetValidationResult, RustModelInspectionResult } from "../model3d/inspectionContracts.js";
import type { ModerationSimulationResult } from "../moderation/contracts.js";

export interface DashboardGuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  memberCount: number;
  channelCount: number;
  textChannelCount: number;
  voiceChannelCount: number;
}

export interface DashboardChannelSummary {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  parentName: string | null;
  settingsEditable: boolean;
  canSendMessages: boolean;
  isVoice: boolean;
  botConnected: boolean;
  connectedMembers: Array<{
    id: string;
    displayName: string;
    tag: string;
    isBot: boolean;
  }>;
}

export interface DashboardUserSummary {
  id: string;
  username: string;
  displayName: string;
  tag: string;
  lastSeenAt: string;
}

export interface DashboardRoleSummary {
  id: string;
  name: string;
  colorHex: string | null;
}

export interface DashboardGuildSettings {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
  investigationRoleId: string | null;
  temporaryImageBlockRoleId: string | null;
  memberCounterChannelId: string | null;
  memberCounterTemplate: string;
  botMode: "normal" | "act-on-user-behalf" | "act-on-itself";
  botActingPreset: "user" | "mod" | "admin";
  botSafetyRequireMentionOrReply: boolean;
  botSafetySuggestOnly: boolean;
  botSafetyAllowChatSelfTasks: boolean;
  botSafetyChatSelfTasksAdminOnly: boolean;
  botSafetyChatSelfTaskMinConfidence: number;
  botSafetyAllowRoleSuggestions: boolean;
  botSafetyAllowChannelSuggestions: boolean;
  botSafetyAllowPromotionSuggestions: boolean;
  autonomousStatusChannelId: string | null;
  autonomousHeartbeatEnabled: boolean;
  autonomousHeartbeatMinutes: number;
  autonomousReplyToMentions: boolean;
  imagePoolVerifiedRoleIds: string[];
  imagePoolVerifiedUserIds: string[];
  selfTaskDryRunOnly: boolean;
  selfTaskAllowedActionTypes: string[];
  mediaReactionRules: Array<{
    enabled: boolean;
    sourceChannelId: string;
    resultChannelId: string;
    allowedRoleIds: string[];
    allowedUserIds: string[];
    imageActions: string[];
    modelActions: string[];
  }>;
  chatModeChannels: Record<string, {
    enabled: boolean;
    allowedRoleIds: string[];
    allowedUserIds: string[];
    requireMentionOrReply: boolean;
    cooldownSeconds: number;
    systemPrompt: string;
  }>;
}

export interface DashboardDirectMessageSummary {
  channelId: string;
  userId: string | null;
  displayName: string;
  tag: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
}

export interface DashboardDirectMessageEntry {
  id: string;
  authorId: string;
  authorTag: string;
  content: string;
  attachments: string[];
  createdAt: string;
}

export interface DashboardBotMessageSummary {
  id: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

export interface DashboardChannelSettings {
  guildId: string;
  channelId: string;
  kind: string;
  name: string;
  topic: string;
  nsfw: boolean;
  slowmodeSeconds: number;
  defaultAutoArchiveDuration: number;
  parentId: string | null;
  canEdit: boolean;
  availableCategories: Array<{
    id: string;
    name: string;
  }>;
}

export interface DashboardGuildChannelPlanEntry {
  categoryName: string;
  channels: Array<{
    name: string;
    type: "text" | "voice" | "announcement";
    topic: string | null;
  }>;
}

export interface DashboardGuildChannelPlan {
  summary: string;
  entries: DashboardGuildChannelPlanEntry[];
}

export interface DashboardGuildInviteSummary {
  code: string;
  url: string;
  channelId: string | null;
  channelName: string | null;
  inviterTag: string | null;
  uses: number | null;
  maxUses: number;
  maxAgeSeconds: number;
  temporary: boolean;
  createdAt: string | null;
  expiresAt: string | null;
}

export interface DashboardGuildPermissionSummary {
  guildId: string;
  serverName: string;
  manageable: boolean;
  missingCriticalPermissions: string[];
  permissions: Array<{
    key: string;
    label: string;
    allowed: boolean;
  }>;
}

export interface DashboardChannelPermissionSummary {
  guildId: string;
  channelId: string;
  channelName: string;
  channelKind: string;
  manageable: boolean;
  missingCriticalPermissions: string[];
  permissions: Array<{
    key: string;
    label: string;
    allowed: boolean;
  }>;
}

export interface DashboardCommandDefinition {
  name: string;
  description: string;
  adminOnly: boolean;
}

export interface DashboardCommandSettings {
  globalEnabledCommands: string[];
  guildEnabledCommands: string[];
  guildDisabledInheritedCommands: string[];
}

export type DashboardLlmProvider = "ollama" | "lmstudio" | "llamacpp";

export interface DashboardLlmModelProviderCatalog {
  provider: DashboardLlmProvider;
  label: string;
  models: string[];
}

export interface DashboardLlmModelCatalog {
  available: string[];
  providers: DashboardLlmModelProviderCatalog[];
  active: {
    textModel: string;
    visionModel: string;
  };
}

export type DashboardMessengerRuntimeKey = "discord" | "telegram" | "matrix" | "whatsapp";
export type DashboardMessengerRuntimeStatus = "running" | "stopped" | "starting" | "stopping" | "error";
export type DashboardMessengerRuntimeMode = "embedded" | "process";
export type DashboardMessengerRuntimeControlAction = "start" | "stop" | "restart";
export type DashboardMessengerCredentialSource = "default" | "safe-file" | "manual";
export type DashboardComfyWorkflowKey = "model3d" | "image" | "audio" | "music" | "video";

export interface DashboardMessengerRuntimeLaunchConfig {
  credentialSource?: DashboardMessengerCredentialSource;
  safeSecretsPath?: string;
  discordToken?: string;
  telegramBotToken?: string;
  matrixHomeserverUrl?: string;
  matrixAccessToken?: string;
  matrixBotUserId?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappApiVersion?: string;
}

export interface DashboardMessengerRuntimeRecord {
  messenger: DashboardMessengerRuntimeKey;
  label: string;
  mode: DashboardMessengerRuntimeMode;
  configured: boolean;
  status: DashboardMessengerRuntimeStatus;
  message: string;
  pid: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  lastExitCode: number | null;
  lastExitSignal: string | null;
}

export interface DashboardMessengerRuntimeEvent {
  id: string;
  createdAt: string;
  messenger: DashboardMessengerRuntimeKey;
  level: "info" | "error";
  message: string;
}

export interface DashboardImagePool extends ImagePool {}
export type DashboardModel3dPostTargetMode = "channel" | "thread" | "forum-post" | "forum-create-and-post";
export type DashboardModel3dThreadNameMode = "fixed" | "increment" | "model-name";
export interface DashboardModelMetallicDecision {
  classification: "metallic" | "non-metallic" | "mixed";
  reason: string;
  usedVisionModel: boolean;
  action: "enabled" | "disabled" | "skipped";
}
export interface DashboardModelRealWorldHeightDecision {
  objectLabel: string;
  heightMeters: number;
  reason: string;
  usedVisionModel: boolean;
  action: "scaled" | "skipped";
}

export interface DashboardDependencies {
  port: number;
  host: string;
  enabled?: boolean;
  restartDashboardServer?: (requestedBy?: string) => Promise<void> | void;
  applyDashboardNetworkConfig?: (config: {
    bindHost: string;
    publicBaseUrl: string;
    exposeApi: boolean;
    allowedClients: string[];
    certificateSha256: string;
    accessToken: string;
  }) => Promise<void> | void;
  runtimeState: DashboardRuntimeState;
  saveDashboardSettings: (settings: StoredDashboardSettings) => Promise<void>;
  setLlmConnectionSettings: (input: {
    llmProvider?: DashboardLlmProvider;
    ollamaUrl?: string;
    lmStudioBaseUrl?: string;
    lmStudioApiKey?: string;
    lmStudioContextLength?: number;
    lmStudioTextModelReasoningEnabled?: boolean;
  }) => void;
  getMessengerRuntimeSnapshot: () => {
    runtimes: DashboardMessengerRuntimeRecord[];
    events: DashboardMessengerRuntimeEvent[];
  };
  controlMessengerRuntime: (input: {
    messenger: DashboardMessengerRuntimeKey;
    action: DashboardMessengerRuntimeControlAction;
    launchConfig?: DashboardMessengerRuntimeLaunchConfig;
  }) => Promise<DashboardMessengerRuntimeRecord>;
  getBotSnapshot: () => {
    id: string | null;
    tag: string | null;
    avatarUrl: string | null;
    guildCount: number;
    startedAt: string;
    dashboardPort: number;
  };
  askModel: (prompt: string) => Promise<string>;
  askModelDetailed?: (prompt: string) => Promise<{
    response: string;
    reasoning?: string;
  }>;
  askModelDetailedStream?: (
    prompt: string,
    callbacks: {
      onReasoningDelta?: (delta: string) => void;
      onResponseDelta?: (delta: string) => void;
      signal?: AbortSignal;
    }
  ) => Promise<{
    response: string;
    reasoning?: string;
  }>;
  askVisionModel: (prompt: string, images: string[], options?: { signal?: AbortSignal }) => Promise<string>;
  sendMessageToChannel: (channelId: string, content: string) => Promise<void>;
  sendDirectMessage: (userId: string, content: string) => Promise<void>;
  postGiftToChannel: (channelId: string) => Promise<void>;
  postHumbleToChannel: (channelId: string) => Promise<void>;
  listGuilds: () => Promise<DashboardGuildSummary[]>;
  getGuildPermissionSummary: (guildId: string) => Promise<DashboardGuildPermissionSummary>;
  getChannelPermissionSummary: (guildId: string, channelId: string) => Promise<DashboardChannelPermissionSummary>;
  listCommandDefinitions: () => DashboardCommandDefinition[];
  getCommandSettings: (guildId?: string | null) => DashboardCommandSettings;
  saveGlobalCommandSettings: (commandNames: string[]) => Promise<DashboardCommandSettings>;
  saveGuildCommandSettings: (
    guildId: string,
    input: {
      guildEnabledCommands?: string[];
      guildDisabledInheritedCommands?: string[];
    }
  ) => Promise<DashboardCommandSettings>;
  syncGlobalCommands: () => Promise<{ syncedCount: number }>;
  syncGuildCommands: (guildId: string) => Promise<{ syncedCount: number }>;
  getBotInviteUrl: (guildId?: string | null) => string;
  getGuildDashboardSettings: (guildId: string) => GuildDashboardSettings;
  getChatModeDebugStatus: (guildId: string, channelId: string) => ChatModeDebugStatus | null;
  listChannels: (guildId: string) => Promise<DashboardChannelSummary[]>;
  getChannelSettings: (guildId: string, channelId: string) => Promise<DashboardChannelSettings>;
  saveChannelSettings: (
    guildId: string,
    channelId: string,
    update: {
      name?: string;
      topic?: string;
      nsfw?: boolean;
      slowmodeSeconds?: number;
      defaultAutoArchiveDuration?: number;
      parentId?: string | null;
    }
  ) => Promise<DashboardChannelSettings>;
  reorderGuildChannel: (
    guildId: string,
    input: {
      kind: "channel" | "category";
      channelId: string;
      parentId?: string | null;
      position: number;
    }
  ) => Promise<void>;
  createGuildChannel: (
    guildId: string,
    input: {
      name: string;
      type: "category" | "text" | "announcement" | "voice";
      topic?: string;
      parentId?: string | null;
    }
  ) => Promise<{ id: string; name: string; kind: string }>;
  createThread: (
    guildId: string,
    input: {
      channelId: string;
      name: string;
      starterMessage: string;
      autoArchiveDuration?: number;
    }
  ) => Promise<{ id: string; name: string }>;
  createPost: (
    guildId: string,
    input: {
      channelId: string;
      title?: string;
      content: string;
    }
  ) => Promise<{ id: string }>;
  listGuildInvites: (guildId: string) => Promise<DashboardGuildInviteSummary[]>;
  createGuildInvite: (
    guildId: string,
    input: {
      channelId: string;
      maxAgeSeconds?: number;
      maxUses?: number;
      temporary?: boolean;
      unique?: boolean;
    }
  ) => Promise<DashboardGuildInviteSummary>;
  replaceGuildInvite: (
    guildId: string,
    code: string,
    input: {
      channelId: string;
      maxAgeSeconds?: number;
      maxUses?: number;
      temporary?: boolean;
      unique?: boolean;
    }
  ) => Promise<DashboardGuildInviteSummary>;
  deleteGuildInvite: (guildId: string, code: string) => Promise<boolean>;
  planGuildChannels: (guildId: string, prompt: string) => Promise<DashboardGuildChannelPlan>;
  applyGuildChannelPlan: (guildId: string, plan: DashboardGuildChannelPlan) => Promise<{
    createdCategories: number;
    createdChannels: number;
  }>;
  auditGuildWithLlm: (guildId: string, prompt: string) => Promise<string>;
  joinVoiceChannel: (guildId: string, channelId: string) => Promise<void>;
  disconnectVoiceChannel: (guildId: string) => Promise<void>;
  simulateModeration: (input: { guildId?: string; text: string; images: string[] }) => Promise<ModerationSimulationResult>;
  searchUsers: (guildId: string, query: string) => Promise<DashboardUserSummary[]>;
  fetchUsers: (guildId: string, query: string) => Promise<DashboardUserSummary[]>;
  listRoles: (guildId: string) => Promise<DashboardRoleSummary[]>;
  getGuildSettings: (guildId: string) => Promise<DashboardGuildSettings>;
  saveGuildSettings: (
    guildId: string,
    update: Partial<Omit<DashboardGuildSettings, "guildId">>
  ) => Promise<DashboardGuildSettings>;
  assignRoleToUser: (guildId: string, userId: string, roleId: string) => Promise<void>;
  removeRoleFromUser: (guildId: string, userId: string, roleId: string) => Promise<void>;
  createInvestigationRole: (guildId: string, roleName?: string) => Promise<DashboardRoleSummary>;
  createTemporaryImageBlockRole: (guildId: string, roleName?: string) => Promise<DashboardRoleSummary>;
  refreshMemberCounter: (guildId: string) => Promise<void>;
  listRecentBotMessages: (channelId: string) => Promise<DashboardBotMessageSummary[]>;
  editBotMessage: (channelId: string, messageId: string, content: string) => Promise<DashboardBotMessageSummary>;
  listDirectMessages: () => Promise<DashboardDirectMessageSummary[]>;
  getDirectMessageEntries: (channelId: string) => Promise<DashboardDirectMessageEntry[]>;
  listOllamaModels: () => Promise<DashboardLlmModelCatalog>;
  getActiveOllamaModels: () => { textModel: string; visionModel: string };
  setActiveOllamaModels: (input: { textModel?: string; visionModel?: string }) => { textModel: string; visionModel: string };
  describeImageWithVision: (input: {
    imageInput: string;
    prompt?: string;
  }) => Promise<string>;
  resolveImagePromptFromBaseImage: (input: {
    imageInput: string;
    prompt?: string;
    detailMode?: "precise" | "normal" | "vague";
    direction?: string;
  }) => Promise<string>;
  listAutomationPresets: () => Promise<AutomationPreset[]>;
  listAutomationTextSources: () => Promise<TextSourceSummary[]>;
  readAutomationTextSourcePreview: (input: { fileName: string; maxLines?: number; }) => Promise<TextSourcePreview>;
  saveAutomationTextSource: (input: {
    fileName: string;
    mode: "append" | "replace";
    content: string;
  }) => Promise<TextSourceSummary>;
  listImagePools: () => Promise<DashboardImagePool[]>;
  saveImagePool: (input: { id?: string; name: string; images: string[]; }) => Promise<DashboardImagePool>;
  deleteImagePool: (id: string) => Promise<boolean>;
  generateAutomationTextSource: (input: {
    fileName: string;
    mode: "append" | "replace";
    prompt: string;
  }) => Promise<{ summary: TextSourceSummary; content: string }>;
  listGeneratedModels: () => Promise<GeneratedModelPublicRecord[]>;
  inspectGeneratedModel: (input: {
    modelId: string;
    variant?: "merged" | "original" | "lowpoly" | "albedo";
    executionTarget?: "local" | "remote";
  }) => Promise<RustModelInspectionResult>;
  validateGeneratedModel: (input: {
    modelId: string;
    variant?: "merged" | "original" | "lowpoly" | "albedo";
    executionTarget?: "local" | "remote";
  }) => Promise<RustAssetValidationResult>;
  indexGeneratedModelAssets: (input?: {
    executionTarget?: "local" | "remote";
  }) => Promise<RustAssetIndexResult>;
  probeMediaAsset: (input: ProbeGeneratedMediaInput & { executionTarget?: "local" | "remote" }) => Promise<RustMediaProbeResult>;
  postModelGenerationStartNotice: (input: {
    channelId: string;
    imageInput: string;
    imageFileNameHint?: string;
    prompt?: string;
    requestedBy?: string;
  }) => Promise<{
    messageId: string | null;
    messageUrl: string | null;
  }>;
  suggestModelMetadata: (input: {
    prompt?: string;
    imageInput?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<{
    fileName: string | null;
    description: string | null;
  }>;
  suggestLowPolyTargetFaceCount: (input: {
    prompt?: string;
    imageInput?: string;
    context?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<{
    targetFaceCount: number;
    sizeTier: "tiny" | "small" | "medium" | "large" | "huge";
    complexity: "simple" | "moderate" | "detailed";
    reason: string;
    usedVisionModel: boolean;
  }>;
  suggestModelRealWorldHeight: (input: {
    prompt?: string;
    imageInput?: string;
    context?: string;
    preferVisualModel?: boolean;
    executionTarget?: "local" | "remote";
  }) => Promise<{
    objectLabel: string;
    heightMeters: number;
    reason: string;
    usedVisionModel: boolean;
    subjectKind?: string;
    pose?: string;
  }>;
  generateLowPolyFromUploadedModel: (input: {
    fileName: string;
    fileData: Buffer;
    contentType?: string;
    useLlmTargetFaces?: boolean;
    targetFaceCount?: number;
    prompt?: string;
    context?: string;
  }) => Promise<{
    generated: GeneratedModelPublicRecord;
    targetFaceCount: number;
    suggestionReason: string | null;
    usedLlmTargetFaces: boolean;
  }>;
  generateLowPolyForModel: (input: {
    modelId: string;
    useLlmTargetFaces?: boolean;
    targetFaceCount?: number;
    llmMinTargetFaceCount?: number;
    llmMaxTargetFaceCount?: number;
    executionTarget?: "local" | "remote";
    llmDecisionSource?: "input-image" | "model-render";
    prompt?: string;
    context?: string;
  }) => Promise<{
    generated: GeneratedModelPublicRecord;
    targetFaceCount: number;
    suggestionReason: string | null;
    usedLlmTargetFaces: boolean;
  }>;
  applyMaterialToModel: (input: {
    modelId: string;
    metallicEnabled?: boolean | null;
    roughnessValue?: number | null;
  }) => Promise<GeneratedModelPublicRecord>;
  applyModelAlbedoToGeometry: (input: {
    modelId: string;
    sourceVariant?: "merged" | "original" | "lowpoly" | "albedo";
    strength?: number;
    subdivisions?: number;
    topologyMode?: "subdivision" | "multiresolution";
    blur?: number;
    autoSmooth?: boolean;
    selectedFacesOnly?: boolean;
    mergeBeforeSubdivide?: boolean;
    mergeAfterSubdivide?: boolean;
    mergeDistance?: number;
  }) => Promise<GeneratedModelPublicRecord>;
  applyModelSeparateByLooseParts: (input: {
    modelId: string;
    executionTarget?: "local" | "remote";
    exportMode?: "per_part" | "single_file";
    mergeDistance?: number;
  }) => Promise<{
    generated: GeneratedModelPublicRecord | null;
    models: GeneratedModelPublicRecord[];
    partCount: number;
    exportMode: "per_part" | "single_file";
  }>;
  applyModelScaleToHeight: (input: {
    modelId: string;
    targetHeightMeters: number;
    executionTarget?: "local" | "remote";
  }) => Promise<GeneratedModelPublicRecord>;
  applyAutoRigToModel: (input: {
    modelId: string;
    rigProfile?: string;
    useVision?: boolean;
    landmarks?: Record<string, [number, number, number]> | null;
    executionTarget?: "local" | "remote";
  }) => Promise<GeneratedModelPublicRecord>;
  previewAutoRigForModel: (input: {
    modelId: string;
    rigProfile?: string;
    useVision?: boolean;
    landmarks?: Record<string, [number, number, number]> | null;
    executionTarget?: "local" | "remote";
  }) => Promise<{
    modelId: string;
    classification: Record<string, unknown>;
    rigProfile: string;
    landmarks: Record<string, [number, number, number]>;
    markerProjection: { centerX: number; centerZ: number; orthoScale: number } | null;
    editableLandmarks: string[];
    previewImages: Array<{ view: string; dataUrl: string }>;
  }>;
  openGeneratedModelInBlender: (input: {
    modelId: string;
    variant?: "current" | "original" | "lowpoly" | "albedo";
    fileName?: string;
    executionTarget?: "local" | "remote";
  }) => Promise<{ launched: boolean; pid: number | null; assetPath: string; fileName: string }>;
  openGeneratedModelsInBlender: (input: {
    items: Array<{ modelId: string; variant?: "current" | "original" | "lowpoly" | "albedo"; fileName?: string }>;
    executionTarget?: "local" | "remote";
  }) => Promise<{ launched: boolean; pid: number | null; assetPaths: string[]; fileNames: string[] }>;
  openGeneratedImageInBlender: (input: {
    imageId: string;
    fileName?: string;
    executionTarget?: "local" | "remote";
  }) => Promise<{ launched: boolean; pid: number | null; assetPath: string; fileName: string }>;
  openImagesInBlender: (input: {
    items: Array<{ imageId?: string; imageDataUrl?: string; fileName?: string; label?: string }>;
    executionTarget?: "local" | "remote";
  }) => Promise<{ launched: boolean; pid: number | null; assetPaths: string[]; fileNames: string[] }>;
  openImageDataInBlender: (input: {
    dataUrl: string;
    fileName?: string;
    label?: string;
    executionTarget?: "local" | "remote";
  }) => Promise<{ launched: boolean; pid: number | null; assetPath: string }>;
  editUploadedModel: (input: {
    fileName: string;
    fileData: Buffer;
    contentType?: string;
    prompt?: string;
    context?: string;
    useLlmHeight?: boolean;
    targetHeightMeters?: number;
    executionTarget?: "local" | "remote";
    metallicEnabled?: boolean | null;
    roughnessValue?: number | null;
  }) => Promise<{
    generated: GeneratedModelPublicRecord;
    realWorldHeightDecision?: DashboardModelRealWorldHeightDecision | null;
  }>;
  editGeneratedModel: (input: {
    modelId: string;
    prompt?: string;
    context?: string;
    useLlmHeight?: boolean;
    targetHeightMeters?: number;
    executionTarget?: "local" | "remote";
    metallicEnabled?: boolean | null;
    roughnessValue?: number | null;
  }) => Promise<{
    generated: GeneratedModelPublicRecord;
    realWorldHeightDecision?: DashboardModelRealWorldHeightDecision | null;
  }>;
  ejectActiveLlmModels: (executionTarget?: "local" | "remote") => Promise<{
    attempted: Array<{ provider: DashboardLlmProvider; model: string }>;
    unloaded: Array<{ provider: DashboardLlmProvider; model: string }>;
    failed: Array<{ provider: DashboardLlmProvider; model: string; error: string }>;
  }>;
  loadActiveLlmModels: (input?: {
    executionTarget?: "local" | "remote";
    scope?: "text" | "vision" | "both";
    textModel?: string;
    visionModel?: string;
    contextLength?: number;
  }) => Promise<{
    attempted: Array<{ provider: DashboardLlmProvider; model: string }>;
    loaded: Array<{ provider: DashboardLlmProvider; model: string }>;
    failed: Array<{ provider: DashboardLlmProvider; model: string; error: string }>;
  }>;
  generate3dModelFromImage: (input: {
    imageInput: string;
    imageFileNameHint?: string;
    meshInput?: string;
    meshFileNameHint?: string;
    workflowPathOverride?: string;
    workflowImageInputNodeId?: string;
    workflowMeshInputNodeId?: string;
    workflowOutputNodeId?: string;
    workflowPreviewNodeId?: string;
    multiViewImageInputs?: Partial<Record<"front" | "back" | "left" | "right", string>>;
    prompt?: string;
    seed?: number;
    autoPrompt?: boolean;
    askLlmIfModelShouldBeMetallic?: boolean;
    askLlmForRealWorldHeightAndScale?: boolean;
    useLlmMetadata?: boolean;
    useLlmModelFileName?: boolean;
    useLlmModelDescription?: boolean;
    metadataTiming?: "before" | "after" | "parallel";
    metadataExecutionTarget?: "local" | "remote";
    unloadLlmBeforeGenerate?: boolean;
    executionTarget?: "local" | "remote";
    stripMetadata?: boolean;
    channelId?: string | null;
    requestedBy?: string;
    postTargetMode?: DashboardModel3dPostTargetMode;
    threadNameMode?: DashboardModel3dThreadNameMode;
    threadName?: string;
    threadNameBase?: string;
    modelNameSource?: "llm" | "filename";
    forumChannelId?: string;
    forumChannelName?: string;
    lowPolyForumChannelId?: string;
    lowPolyForumChannelName?: string;
    extraContent?: string;
    initialExtraContent?: string;
    sendInitialToSelectedChannel?: boolean;
    modelUploadTarget?: "selected" | "target";
    includeModelFile?: boolean;
    includePreviewMedia?: boolean;
    includeEmbed?: boolean;
    includeEmbedInInitial?: boolean;
    includeButtons?: boolean;
    uploadTextureMessages?: boolean;
    uploadMultiViewTextures?: boolean;
    uploadUvMapTextures?: boolean;
    uploadNormalMapTextures?: boolean;
    textureUploadTarget?: "selected" | "target";
    generateLowPolyVersion?: boolean;
    lowPolyExecutionTarget?: "local" | "remote";
    lowPolyUseLlmTargetFaces?: boolean;
    lowPolyLlmDecisionSource?: "input-image" | "model-render";
    lowPolyTargetFaceCount?: number;
    onModelReady?: (record: GeneratedModelPublicRecord) => void | Promise<void>;
    onPromptQueued?: (promptId: string) => void | Promise<void>;
    signal?: AbortSignal;
  }) => Promise<GeneratedModelPublicRecord & {
    metallicDecision?: DashboardModelMetallicDecision | null;
    realWorldHeightDecision?: DashboardModelRealWorldHeightDecision | null;
  }>;
  listGeneratedImages: () => Promise<GeneratedImagePublicRecord[]>;
  importGeneratedImage: (input: {
    desiredId?: string;
    imageFileName: string;
    imageData: Buffer;
    prompt?: string;
    description?: string;
    width?: number;
    height?: number;
    seed?: number;
    steps?: number | null;
    cfg?: number | null;
    model?: string;
    metadata?: Record<string, string | number | boolean>;
  }) => Promise<GeneratedImagePublicRecord>;
  listGeneratedAudios: () => Promise<GeneratedAudioPublicRecord[]>;
  listGeneratedVideos: () => Promise<GeneratedVideoPublicRecord[]>;
  generateImageFromPrompt: (input: {
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
    channelId?: string | null;
    requestedBy?: string;
    stripMetadata?: boolean;
    onPromptQueued?: (promptId: string) => void | Promise<void>;
    signal?: AbortSignal;
  }) => Promise<GeneratedImagePublicRecord>;
  regenerateGeneratedImageFileName: (input: {
    imageId: string;
    prompt?: string;
  }) => Promise<GeneratedImagePublicRecord>;
  regenerateGeneratedModelFileName: (input: {
    modelId: string;
    prompt?: string;
  }) => Promise<GeneratedModelPublicRecord>;
  generateAudioFromPrompt: (input: {
    prompt?: string;
    seconds?: number;
    steps?: number;
    cfg?: number;
    channelId?: string | null;
    requestedBy?: string;
    onPromptQueued?: (promptId: string) => void | Promise<void>;
    signal?: AbortSignal;
  }) => Promise<GeneratedAudioPublicRecord>;
  generateMusicFromPrompt: (input: {
    seconds: number;
    steps?: number;
    cfg?: number;
    seed?: number;
    tags?: string;
    lyrics?: string;
    channelId?: string | null;
    requestedBy?: string;
    onPromptQueued?: (promptId: string) => void | Promise<void>;
    signal?: AbortSignal;
  }) => Promise<GeneratedAudioPublicRecord>;
  generateVideoFromPrompt: (input: {
    prompt?: string;
    negativePrompt?: string;
    seconds?: number;
    frames?: number;
    fps?: number;
    width?: number;
    height?: number;
    steps?: number;
    seed?: number;
    workflowPath?: string;
    imageDataUrl?: string;
    imageFileName?: string;
    channelId?: string | null;
    requestedBy?: string;
    onPromptQueued?: (promptId: string) => void | Promise<void>;
    signal?: AbortSignal;
  }) => Promise<GeneratedVideoPublicRecord>;
  interruptComfyWorkflow: (input: { workflow: DashboardComfyWorkflowKey; promptId?: string | null; }) => Promise<void>;
  generateTextToSpeech: (input: {
    text: string;
    mode?: "standard" | "voice-clone" | "custom-voice" | "design-voice";
    speaker?: string;
    speed?: number;
    workflowPath: string;
    referenceAudioDataUrl?: string;
    referenceAudioFileName?: string;
    referenceText?: string;
    instruct?: string;
    language?: string;
    requestedBy?: string;
  }) => Promise<{
    fileName: string;
    mimeType: string;
    audioDataUrl: string;
    speaker: string;
    speed: number;
    transcript: string;
  }>;
  transcribeSpeechToText: (input: {
    audioDataUrl: string;
    fileName?: string;
    workflowPath: string;
    language?: string;
    requestedBy?: string;
  }) => Promise<{
    transcript: string;
    sourceAudio?: GeneratedAudioPublicRecord;
  }>;
  generateSpeechToSpeech: (input: {
    audioDataUrl: string;
    fileName?: string;
    speaker?: string;
    speed?: number;
    workflowPath: string;
    requestedBy?: string;
  }) => Promise<{
    fileName: string;
    mimeType: string;
    audioDataUrl: string;
    speaker: string;
    speed: number;
    transcript: string;
  }>;
  deleteGeneratedImage: (imageId: string) => Promise<boolean>;
  deleteGeneratedModel: (modelId: string) => Promise<boolean>;
  deleteGeneratedModelVariant: (modelId: string, variant: "merged" | "original" | "lowpoly" | "albedo", fileName?: string) => Promise<GeneratedModelPublicRecord | null>;
  deleteGeneratedAudio: (audioId: string) => Promise<boolean>;
  deleteGeneratedVideo: (videoId: string) => Promise<boolean>;
  freeComfyUiMemory: (input: { unloadModels: boolean; freeMemory: boolean }) => Promise<void>;
  readGeneratedImageFile: (imageId: string, fileName: string) => Promise<{ data: Buffer; contentType: string }>;
  readGeneratedAudioFile: (audioId: string, fileName: string) => Promise<{ data: Buffer; contentType: string }>;
  readGeneratedVideoFile: (videoId: string, fileName: string) => Promise<{ data: Buffer; contentType: string }>;
  postGeneratedModel: (input: {
    modelId: string;
    channelId: string;
    requestedBy?: string;
    postTargetMode?: DashboardModel3dPostTargetMode;
    threadNameMode?: DashboardModel3dThreadNameMode;
    threadName?: string;
    threadNameBase?: string;
    modelNameSource?: "llm" | "filename";
    forumChannelId?: string;
    forumChannelName?: string;
    lowPolyForumChannelId?: string;
    lowPolyForumChannelName?: string;
    extraContent?: string;
    initialExtraContent?: string;
    sendInitialToSelectedChannel?: boolean;
    modelUploadTarget?: "selected" | "target";
    includeModelFile?: boolean;
    includePreviewMedia?: boolean;
    includeEmbed?: boolean;
    includeEmbedInInitial?: boolean;
    includeButtons?: boolean;
    uploadTextureMessages?: boolean;
    uploadMultiViewTextures?: boolean;
    uploadUvMapTextures?: boolean;
    uploadNormalMapTextures?: boolean;
    textureUploadTarget?: "selected" | "target";
    generateLowPolyVersion?: boolean;
    lowPolyExecutionTarget?: "local" | "remote";
    lowPolyUseLlmTargetFaces?: boolean;
    lowPolyLlmDecisionSource?: "input-image" | "model-render";
    lowPolyTargetFaceCount?: number;
    previewGifDataUrl?: string;
    requireThreeJsPreviewGif?: boolean;
    useLlmMetadata?: boolean;
    llmMetadataPrompt?: string;
    suggestedModelFileName?: string;
    suggestedModelDescription?: string;
    replyToMessageId?: string;
  }) => Promise<GeneratedModelPublicRecord>;
  readGeneratedModelFile: (modelId: string, fileName: string) => Promise<{ data: Buffer; contentType: string }>;
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  captureGeneratedModelArtifact: (input: {
    modelId: string;
    variant?: "merged" | "original" | "lowpoly" | "albedo";
    action: "rotate" | "delight";
    executionTarget?: "local" | "remote";
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      engine?: "BLENDER_EEVEE_NEXT" | "CYCLES" | "BLENDER_WORKBENCH";
      projection?: "ORTHO" | "PERSP";
      shading?: "TEXTURE" | "MATERIAL";
      shadows?: "on" | "off";
      zoom?: number;
      rotateTarget?: "camera" | "object";
      axis?: "X" | "Y" | "Z";
      degrees?: number;
      frames?: number;
      background?: "transparent" | "solidcolor" | "skybox";
      bgColor?: string;
    };
  }) => Promise<{ data: Buffer; mimeType: "image/png" | "image/gif"; fileName: string }>;
  listScheduledAutomations: (guildId: string) => Promise<ScheduledAutomation[]>;
  saveScheduledAutomation: (input: Omit<ScheduledAutomation, "id" | "createdAt" | "lastRunAt"> & { id?: string; createdAt?: string; lastRunAt?: string | null }) => Promise<ScheduledAutomation>;
  deleteScheduledAutomation: (id: string) => Promise<boolean>;
  listJoinAutomations: (guildId: string) => Promise<JoinAutomation[]>;
  saveJoinAutomation: (input: Omit<JoinAutomation, "id"> & { id?: string }) => Promise<JoinAutomation>;
  deleteJoinAutomation: (id: string) => Promise<boolean>;
}
