export interface GlobalDashboardSettings {
  requireConfirmationForLlmSend: boolean;
  ffmpegExecutablePath: string;
  llmProvider: "ollama" | "lmstudio" | "llamacpp";
  ollamaUrl: string;
  lmStudioBaseUrl: string;
  lmStudioApiKey: string;
  lmStudioContextLength: number;
  lmStudioTextModelReasoningEnabled: boolean;
  imageLlmProvider: "ollama" | "lmstudio" | "llamacpp";
  imageOllamaUrl: string;
  imageLmStudioBaseUrl: string;
  imageLmStudioApiKey: string;
  imageLlmTextModel: string;
  imageLlmVisionModel: string;
  model3dLlmProvider: "ollama" | "lmstudio" | "llamacpp";
  model3dOllamaUrl: string;
  model3dLmStudioBaseUrl: string;
  model3dLmStudioApiKey: string;
  model3dLlmTextModel: string;
  model3dLlmVisionModel: string;
  ollamaTextModel: string;
  ollamaVisionModel: string;
  ollamaTextModelIsVisual: boolean;
  unloadLlmBeforeModel3dGeneration: boolean;
  model3dGenerationTarget: "local" | "remote";
  model3dMetadataTarget: "local" | "remote";
  comfyUiBaseUrl: string;
  comfyUiModelBaseUrl: string;
  comfyUiImageBaseUrl: string;
  comfyUiAudioBaseUrl: string;
  comfyUiMusicBaseUrl: string;
  comfyUiVideoBaseUrl: string;
  comfyUiInputDir: string;
  comfyUiModelWorkflowPath: string;
  comfyUiImageWorkflowPath: string;
  comfyUiImageEditWorkflowPath: string;
  comfyUiImageLayeredWorkflowPath: string;
  comfyUiAudioWorkflowPath: string;
  comfyUiMusicWorkflowPath: string;
  comfyUiVideoWorkflowPath: string;
  comfyUiVideoImageWorkflowPath: string;
  stripMetadataWebUiImages: boolean;
  stripMetadataDiscordImages: boolean;
  messengerSharedSecretsPath: string;
  discordRuntimeAutostart: boolean;
  telegramRuntimeAutostart: boolean;
  matrixRuntimeAutostart: boolean;
  whatsappRuntimeAutostart: boolean;
}

export interface GuildDashboardSettings {
  antiSpamEnabled: boolean;
  antiSpamDuplicateWindowMs: number;
  antiSpamTimeoutMs: number;
  antiSpamApplyTimeouts: boolean;
  antiSpamAnalyzeImages: boolean;
  antiSpamTemporaryInvestigationHoldEnabled: boolean;
  antiSpamTemporaryInvestigationHoldMs: number;
  antiSpamImageScanChannelIds: string[];
  antiSpamExcludedChannelIds: string[];
  antiSpamExcludedRoleIds: string[];
  antiSpamAlertChannelId: string | null;
  antiSpamTextRulePatterns: string[];
  antiSpamBlockedLinkPatterns: string[];
  antiSpamImageFlagSpam: boolean;
  antiSpamImageFlagNsfw: boolean;
  antiSpamImageFlagCryptoSpam: boolean;
  antiSpamImageFlagCryptoImage: boolean;
  honeypotEnabled: boolean;
  honeypotChannelId: string | null;
  honeypotTriggerOnText: boolean;
  honeypotTriggerOnFiles: boolean;
  honeypotTriggerOnLinks: boolean;
  honeypotImmediateAction: "timeout" | "kick" | "ban";
  honeypotTimeoutMs: number;
  honeypotRemoveMessage: boolean;
  protectedUserIds: string[];
  protectedRoleIds: string[];
  honeypotExcludedChannelIds: string[];
  honeypotExcludedRoleIds: string[];
  honeypotBackupChannelId: string | null;
  honeypotDmEnabled: boolean;
  honeypotDmMessage: string;
  honeypotReviewChannelId: string | null;
  honeypotPostVerifyAction: "none" | "remove-timeout" | "unban";
  honeypotVerificationWindowMs: number;
  honeypotUnverifiedAction: "none" | "kick" | "ban";
}

export interface HoneypotPendingVerificationRecord {
  id: string;
  createdAt: string;
  guildId: string;
  userId: string;
  username: string;
  honeypotChannelId: string;
  sourceChannelId: string;
  sourceMessageId: string;
  sourceContent: string;
  sourceAttachmentUrls: string[];
  immediateAction: "timeout" | "kick" | "ban";
  postVerifyAction: "none" | "remove-timeout" | "unban";
  unverifiedAction: "none" | "kick" | "ban";
  verifyByAt: string;
  reviewChannelId: string | null;
  dmMessageId: string | null;
  dmChannelId: string | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  verifiedByTag: string | null;
  finalActionTaken: "none" | "kick" | "ban" | null;
}

export interface StoredDashboardSettings {
  globalSettings: Partial<GlobalDashboardSettings>;
  defaultGuildSettings: Partial<GuildDashboardSettings>;
  guildSettings: Record<string, Partial<GuildDashboardSettings>>;
  honeypotPendingVerifications: HoneypotPendingVerificationRecord[];
}

export interface ChatModeDebugStatus {
  guildId: string;
  channelId: string;
  updatedAt: string;
  status: "idle" | "ignored" | "responded" | "error";
  reason: string;
  username: string | null;
  userId: string | null;
  messagePreview: string | null;
}

export interface BotActionEvent {
  id: string;
  createdAt: string;
  type: string;
  summary: string;
}

export interface DashboardLlmConsoleEvent {
  id: string;
  createdAt: string;
  source: string;
  provider: string;
  model: string;
  prompt: string;
  response: string;
  reasoning?: string;
  imageCount?: number;
  durationMs: number;
  error?: string;
  ok: boolean;
}

export interface DashboardSystemConsoleEvent {
  id: string;
  createdAt: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  detail?: string;
}

export interface ModerationEvent {
  id: string;
  createdAt: string;
  type: "duplicate-text" | "duplicate-image" | "image-channel-scan" | "duplicate-text-rule" | "investigation-role" | "honeypot";
  userId: string;
  username: string;
  channels: string[];
  timedOut: boolean;
  deletedCount: number;
  reason: string;
  imageUrls: string[];
  protectionReasons?: string[];
}

export interface BotSnapshot {
  id: string | null;
  tag: string | null;
  avatarUrl: string | null;
  guildCount: number;
  startedAt: string;
  dashboardPort: number;
}

export interface PendingDraft {
  id: string;
  createdAt: string;
  channelId: string;
  prompt: string;
  response: string;
}

export interface SelfTaskReviewRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  guildId: string;
  requestedByTag: string;
  requestText: string;
  summary: string;
  actionDescriptions: string[];
  status: "planned" | "approved" | "cancelled" | "failed";
  resolutionNote: string | null;
}

export interface DashboardRuntimeState {
  recordAction(type: string, summary: string): void;
  recordSystemConsoleEvent(event: {
    source: string;
    level: "info" | "warn" | "error";
    message: string;
    detail?: string;
  }): void;
  getConsoleSnapshot(): {
    llm: DashboardLlmConsoleEvent[];
    system: DashboardSystemConsoleEvent[];
  };
  setRequireConfirmationForLlmSend(enabled: boolean): GlobalDashboardSettings;
  updateFfmpegSettings(input: { ffmpegExecutablePath?: string }): GlobalDashboardSettings;
  updateLlmConnectionSettings(input: {
    llmProvider?: "ollama" | "lmstudio" | "llamacpp";
    ollamaUrl?: string;
    lmStudioBaseUrl?: string;
    lmStudioApiKey?: string;
    lmStudioContextLength?: number;
    lmStudioTextModelReasoningEnabled?: boolean;
  }): GlobalDashboardSettings;
  updateImageLlmConnectionSettings(input: {
    llmProvider?: "ollama" | "lmstudio" | "llamacpp";
    ollamaUrl?: string;
    lmStudioBaseUrl?: string;
    lmStudioApiKey?: string;
    textModel?: string;
    visionModel?: string;
  }): GlobalDashboardSettings;
  updateModel3dLlmConnectionSettings(input: {
    llmProvider?: "ollama" | "lmstudio" | "llamacpp";
    ollamaUrl?: string;
    lmStudioBaseUrl?: string;
    lmStudioApiKey?: string;
    textModel?: string;
    visionModel?: string;
  }): GlobalDashboardSettings;
  updateOllamaModels(input: {
    ollamaTextModel?: string;
    ollamaVisionModel?: string;
    ollamaTextModelIsVisual?: boolean;
    unloadLlmBeforeModel3dGeneration?: boolean;
    model3dGenerationTarget?: "local" | "remote";
    model3dMetadataTarget?: "local" | "remote";
  }): GlobalDashboardSettings;
  updateImageMetadataStripSettings(input: {
    stripMetadataWebUiImages?: boolean;
    stripMetadataDiscordImages?: boolean;
  }): GlobalDashboardSettings;
  updateMessengerRuntimeSettings(input: {
    messengerSharedSecretsPath?: string;
    discordRuntimeAutostart?: boolean;
    telegramRuntimeAutostart?: boolean;
    matrixRuntimeAutostart?: boolean;
    whatsappRuntimeAutostart?: boolean;
  }): GlobalDashboardSettings;
  updateComfyUiSettings(input: {
    comfyUiBaseUrl?: string;
    comfyUiModelBaseUrl?: string;
    comfyUiImageBaseUrl?: string;
    comfyUiAudioBaseUrl?: string;
    comfyUiMusicBaseUrl?: string;
    comfyUiVideoBaseUrl?: string;
    comfyUiInputDir?: string;
    comfyUiModelWorkflowPath?: string;
    comfyUiImageWorkflowPath?: string;
    comfyUiImageEditWorkflowPath?: string;
    comfyUiImageLayeredWorkflowPath?: string;
    comfyUiAudioWorkflowPath?: string;
    comfyUiMusicWorkflowPath?: string;
    comfyUiVideoWorkflowPath?: string;
    comfyUiVideoImageWorkflowPath?: string;
  }): GlobalDashboardSettings;
  updateGuildDashboardSettings(guildId: string, input: Partial<GuildDashboardSettings> & {
    antiSpamImageScanChannelId?: string | null;
  }): GuildDashboardSettings;
  getGlobalDashboardSettings(): GlobalDashboardSettings;
  getGuildDashboardSettings(guildId: string): GuildDashboardSettings;
  getStoredDashboardSettings(): StoredDashboardSettings;
  createPendingDraft(channelId: string, prompt: string, response: string): PendingDraft;
  consumePendingDraft(draftId: string): PendingDraft | null;
  snapshot(bot: BotSnapshot): {
    bot: BotSnapshot;
    settings: GlobalDashboardSettings;
    actions: BotActionEvent[];
    moderationEvents: ModerationEvent[];
    pendingDrafts: PendingDraft[];
    selfTaskReviews: SelfTaskReviewRecord[];
  };
}
