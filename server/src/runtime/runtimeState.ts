import {
  normalizeRuleEntries,
  normalizeWildcardPatterns,
  validateUserRegexPatterns
} from "../services/moderationRules.js";
import { appConfig } from "../config/appConfig.js";
import {
  getNativeSecret,
  imageOpenAiCompatibleApiKeySecretName,
  model3dOpenAiCompatibleApiKeySecretName,
  openAiCompatibleApiKeySecretName,
  setNativeSecret
} from "../security/nativeSecretStore.js";
import type { DashboardLlmConsoleEventInput, DashboardSystemConsoleEventInput } from "../services/dashboardConsoleLogger.js";
import type {
  BotActionEvent,
  BotSnapshot,
  ChatModeDebugStatus,
  DashboardLlmConsoleEvent,
  DashboardRuntimeState,
  DashboardSystemConsoleEvent,
  GlobalDashboardSettings,
  GuildDashboardSettings,
  HoneypotPendingVerificationRecord,
  ModerationEvent,
  PendingDraft,
  SelfTaskReviewRecord,
  StoredDashboardSettings
} from "@urage/shared/dashboard/runtimeContracts";
export type {
  BotActionEvent,
  BotSnapshot,
  ChatModeDebugStatus,
  DashboardLlmConsoleEvent,
  DashboardRuntimeState,
  DashboardSystemConsoleEvent,
  GlobalDashboardSettings,
  GuildDashboardSettings,
  ModerationEvent,
  PendingDraft,
  SelfTaskReviewRecord,
  StoredDashboardSettings
} from "@urage/shared/dashboard/runtimeContracts";

export interface DashboardSettings extends GlobalDashboardSettings, GuildDashboardSettings {}

export interface ModerationVetoRecord {
  id: string;
  createdAt: string;
  guildId: string;
  userId: string;
  username: string;
  channelId: string;
  noticeMessageId: string | null;
  reason: string;
  imageUrls: string[];
  resolvedAt: string | null;
  vetoedByUserId: string | null;
  vetoedByTag: string | null;
}

export interface GuildSignalEvent {
  id: string;
  guildId: string;
  createdAt: string;
  type: "message" | "member-join" | "member-leave" | "interaction" | "moderation";
  summary: string;
}

function coerceChannelId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeHoneypotRecord(record: HoneypotPendingVerificationRecord): HoneypotPendingVerificationRecord {
  return {
    ...record,
    guildId: record.guildId.trim(),
    userId: record.userId.trim(),
    username: record.username.trim(),
    honeypotChannelId: record.honeypotChannelId.trim(),
    sourceChannelId: record.sourceChannelId.trim(),
    sourceMessageId: record.sourceMessageId.trim(),
    sourceContent: String(record.sourceContent || ""),
    sourceAttachmentUrls: normalizeRuleEntries(record.sourceAttachmentUrls),
    reviewChannelId: coerceChannelId(record.reviewChannelId),
    dmMessageId: coerceChannelId(record.dmMessageId),
    dmChannelId: coerceChannelId(record.dmChannelId),
    immediateAction: record.immediateAction === "kick" || record.immediateAction === "ban" ? record.immediateAction : "timeout",
    postVerifyAction: record.postVerifyAction === "remove-timeout" || record.postVerifyAction === "unban" ? record.postVerifyAction : "none",
    unverifiedAction: record.unverifiedAction === "kick" || record.unverifiedAction === "ban" ? record.unverifiedAction : "none",
    resolvedAt: record.resolvedAt || null,
    verifiedAt: record.verifiedAt || null,
    verifiedByUserId: record.verifiedByUserId || null,
    verifiedByTag: record.verifiedByTag || null,
    finalActionTaken: record.finalActionTaken === "kick" || record.finalActionTaken === "ban" || record.finalActionTaken === "none"
      ? record.finalActionTaken
      : null
  };
}

function cloneHoneypotRecord(record: HoneypotPendingVerificationRecord): HoneypotPendingVerificationRecord {
  return {
    ...record,
    sourceAttachmentUrls: [...record.sourceAttachmentUrls]
  };
}


function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function migrateLegacySecret(name: string, legacyValue: unknown): string {
  const storedValue = getNativeSecret(name);
  if (storedValue) {
    return storedValue;
  }
  const legacySecret = typeof legacyValue === "string" ? legacyValue.trim() : "";
  if (!legacySecret) {
    return "";
  }
  try {
    setNativeSecret(name, legacySecret);
  } catch {
    // Preserve the existing runtime configuration if the OS credential store is unavailable.
  }
  return legacySecret;
}

function sanitizeGuildSettings(settings: GuildDashboardSettings): GuildDashboardSettings {
  return {
    ...settings,
    antiSpamDuplicateWindowMs: Math.max(5_000, Math.round(settings.antiSpamDuplicateWindowMs || 60_000)),
    antiSpamTimeoutMs: Math.max(60_000, Math.round(settings.antiSpamTimeoutMs || 7 * 24 * 60 * 60 * 1000)),
    antiSpamTemporaryInvestigationHoldMs: Math.max(0, Math.round(settings.antiSpamTemporaryInvestigationHoldMs || 5_000)),
    antiSpamImageScanChannelIds: normalizeRuleEntries(settings.antiSpamImageScanChannelIds),
    antiSpamExcludedChannelIds: normalizeRuleEntries(settings.antiSpamExcludedChannelIds),
    antiSpamExcludedRoleIds: normalizeRuleEntries(settings.antiSpamExcludedRoleIds),
    antiSpamAlertChannelId: coerceChannelId(settings.antiSpamAlertChannelId),
    antiSpamTextRulePatterns: validateUserRegexPatterns(settings.antiSpamTextRulePatterns),
    antiSpamBlockedLinkPatterns: normalizeWildcardPatterns(settings.antiSpamBlockedLinkPatterns),
    honeypotChannelId: coerceChannelId(settings.honeypotChannelId),
    protectedUserIds: normalizeRuleEntries(settings.protectedUserIds),
    protectedRoleIds: normalizeRuleEntries(settings.protectedRoleIds),
    honeypotExcludedChannelIds: normalizeRuleEntries(settings.honeypotExcludedChannelIds),
    honeypotExcludedRoleIds: normalizeRuleEntries(settings.honeypotExcludedRoleIds),
    honeypotImmediateAction: settings.honeypotImmediateAction === "kick" || settings.honeypotImmediateAction === "ban"
      ? settings.honeypotImmediateAction
      : "timeout",
    honeypotTimeoutMs: Math.max(60_000, Math.round(settings.honeypotTimeoutMs || 7 * 24 * 60 * 60 * 1000)),
    honeypotBackupChannelId: coerceChannelId(settings.honeypotBackupChannelId),
    honeypotDmMessage: String(settings.honeypotDmMessage || "").trim(),
    honeypotReviewChannelId: coerceChannelId(settings.honeypotReviewChannelId),
    honeypotPostVerifyAction: settings.honeypotPostVerifyAction === "remove-timeout" || settings.honeypotPostVerifyAction === "unban"
      ? settings.honeypotPostVerifyAction
      : "none",
    honeypotVerificationWindowMs: Math.max(60_000, Math.round(settings.honeypotVerificationWindowMs || 7 * 24 * 60 * 60 * 1000)),
    honeypotUnverifiedAction: settings.honeypotUnverifiedAction === "kick" || settings.honeypotUnverifiedAction === "ban"
      ? settings.honeypotUnverifiedAction
      : "none"
  };
}

function cloneGuildSettings(settings: GuildDashboardSettings): GuildDashboardSettings {
  return {
    ...settings,
    antiSpamImageScanChannelIds: [...settings.antiSpamImageScanChannelIds],
    antiSpamExcludedChannelIds: [...settings.antiSpamExcludedChannelIds],
    antiSpamExcludedRoleIds: [...settings.antiSpamExcludedRoleIds],
    protectedUserIds: [...settings.protectedUserIds],
    protectedRoleIds: [...settings.protectedRoleIds],
    honeypotExcludedChannelIds: [...settings.honeypotExcludedChannelIds],
    honeypotExcludedRoleIds: [...settings.honeypotExcludedRoleIds],
    antiSpamTextRulePatterns: [...settings.antiSpamTextRulePatterns],
    antiSpamBlockedLinkPatterns: [...settings.antiSpamBlockedLinkPatterns]
  };
}

export class RuntimeState implements DashboardRuntimeState {
  private readonly startedAt = new Date().toISOString();
  private readonly actions: BotActionEvent[] = [];
  private readonly llmConsoleEvents: DashboardLlmConsoleEvent[] = [];
  private readonly systemConsoleEvents: DashboardSystemConsoleEvent[] = [];
  private readonly moderationEvents: ModerationEvent[] = [];
  private readonly moderationVetoRecords = new Map<string, ModerationVetoRecord>();
  private readonly honeypotPendingVerifications = new Map<string, HoneypotPendingVerificationRecord>();
  private readonly chatModeDebugByChannelKey = new Map<string, ChatModeDebugStatus>();
  private readonly guildSignalsByGuildId = new Map<string, GuildSignalEvent[]>();
  private readonly pendingDrafts: PendingDraft[] = [];
  private readonly selfTaskReviews: SelfTaskReviewRecord[] = [];
  private readonly globalSettings: GlobalDashboardSettings;
  private readonly defaultGuildSettings: GuildDashboardSettings;
  private readonly guildSettingsByGuildId = new Map<string, GuildDashboardSettings>();

  constructor(initialSettings?: {
    globalSettings?: Partial<GlobalDashboardSettings>;
    defaultGuildSettings?: Partial<GuildDashboardSettings>;
    guildSettings?: Record<string, Partial<GuildDashboardSettings>>;
    honeypotPendingVerifications?: HoneypotPendingVerificationRecord[];
  }) {
    const {
      lmStudioApiKey: legacyLmStudioApiKey,
      imageLmStudioApiKey: legacyImageLmStudioApiKey,
      model3dLmStudioApiKey: legacyModel3dLmStudioApiKey,
      ...initialGlobalSettings
    } = initialSettings?.globalSettings || {};
    const storedGlobalLmStudioApiKey = migrateLegacySecret(openAiCompatibleApiKeySecretName, legacyLmStudioApiKey);
    const storedImageLmStudioApiKey = migrateLegacySecret(imageOpenAiCompatibleApiKeySecretName, legacyImageLmStudioApiKey);
    const storedModel3dLmStudioApiKey = migrateLegacySecret(model3dOpenAiCompatibleApiKeySecretName, legacyModel3dLmStudioApiKey);
    this.globalSettings = {
      requireConfirmationForLlmSend: true,
      ffmpegExecutablePath: appConfig.ffmpegExecutablePath,
      llmProvider: appConfig.llmProvider,
      ollamaUrl: appConfig.ollamaUrl,
      lmStudioBaseUrl: appConfig.lmStudioBaseUrl,
      lmStudioApiKey: appConfig.lmStudioApiKey === "lm-studio" ? storedGlobalLmStudioApiKey || appConfig.lmStudioApiKey : appConfig.lmStudioApiKey,
      lmStudioContextLength: 0,
      lmStudioTextModelReasoningEnabled: true,
      imageLlmProvider: appConfig.llmProvider,
      imageOllamaUrl: "",
      imageLmStudioBaseUrl: "",
      imageLmStudioApiKey: storedImageLmStudioApiKey,
      imageLlmTextModel: "",
      imageLlmVisionModel: "",
      model3dLlmProvider: appConfig.llmProvider,
      model3dOllamaUrl: "",
      model3dLmStudioBaseUrl: "",
      model3dLmStudioApiKey: storedModel3dLmStudioApiKey,
      model3dLlmTextModel: "",
      model3dLlmVisionModel: "",
      ollamaTextModel: "unset",
      ollamaVisionModel: "unset",
      ollamaTextModelIsVisual: false,
      unloadLlmBeforeModel3dGeneration: true,
      model3dGenerationTarget: "local",
      model3dMetadataTarget: "local",
      comfyUiBaseUrl: appConfig.comfyUiBaseUrl,
      comfyUiModelBaseUrl: appConfig.comfyUiModelBaseUrl,
      comfyUiImageBaseUrl: appConfig.comfyUiImageBaseUrl,
      comfyUiAudioBaseUrl: appConfig.comfyUiAudioBaseUrl,
      comfyUiMusicBaseUrl: appConfig.comfyUiMusicBaseUrl,
      comfyUiVideoBaseUrl: appConfig.comfyUiVideoBaseUrl,
      comfyUiInputDir: appConfig.comfyUiInputDir,
      comfyUiModelWorkflowPath: appConfig.comfyUiModelWorkflowPath,
      comfyUiImageWorkflowPath: appConfig.comfyUiImageWorkflowPath,
      comfyUiImageEditWorkflowPath: appConfig.comfyUiImageEditWorkflowPath,
      comfyUiImageLayeredWorkflowPath: appConfig.comfyUiImageLayeredWorkflowPath,
      comfyUiAudioWorkflowPath: appConfig.comfyUiAudioWorkflowPath,
      comfyUiMusicWorkflowPath: appConfig.comfyUiMusicWorkflowPath,
      comfyUiVideoWorkflowPath: appConfig.comfyUiVideoWorkflowPath,
      comfyUiVideoImageWorkflowPath: appConfig.comfyUiVideoImageWorkflowPath,
      stripMetadataWebUiImages: true,
      stripMetadataDiscordImages: true,
      messengerSharedSecretsPath: "",
      discordRuntimeAutostart: appConfig.discordRuntimeAutostart,
      telegramRuntimeAutostart: appConfig.telegramBotAutostart,
      matrixRuntimeAutostart: appConfig.matrixBotAutostart,
      whatsappRuntimeAutostart: appConfig.whatsappBotAutostart,
      ...initialGlobalSettings
    };
    this.defaultGuildSettings = sanitizeGuildSettings({
      antiSpamEnabled: true,
      antiSpamDuplicateWindowMs: 60_000,
      antiSpamTimeoutMs: 7 * 24 * 60 * 60 * 1000,
      antiSpamApplyTimeouts: true,
      antiSpamAnalyzeImages: true,
      antiSpamTemporaryInvestigationHoldEnabled: false,
      antiSpamTemporaryInvestigationHoldMs: 5_000,
      antiSpamImageScanChannelIds: [],
      antiSpamExcludedChannelIds: [],
      antiSpamExcludedRoleIds: [],
      antiSpamAlertChannelId: null,
      antiSpamTextRulePatterns: [],
      antiSpamBlockedLinkPatterns: [],
      antiSpamImageFlagSpam: true,
      antiSpamImageFlagNsfw: true,
      antiSpamImageFlagCryptoSpam: true,
      antiSpamImageFlagCryptoImage: true,
      honeypotEnabled: false,
      honeypotChannelId: null,
      honeypotTriggerOnText: true,
      honeypotTriggerOnFiles: true,
      honeypotTriggerOnLinks: true,
      honeypotImmediateAction: "timeout",
      honeypotTimeoutMs: 7 * 24 * 60 * 60 * 1000,
      honeypotRemoveMessage: true,
      protectedUserIds: [],
      protectedRoleIds: [],
      honeypotExcludedChannelIds: [],
      honeypotExcludedRoleIds: [],
      honeypotBackupChannelId: null,
      honeypotDmEnabled: true,
      honeypotDmMessage: "Your message triggered the server honeypot. If this was a mistake, use the button below so the moderators can review it.",
      honeypotReviewChannelId: null,
      honeypotPostVerifyAction: "remove-timeout",
      honeypotVerificationWindowMs: 7 * 24 * 60 * 60 * 1000,
      honeypotUnverifiedAction: "ban",
      ...initialSettings?.defaultGuildSettings
    });

    for (const [guildId, settings] of Object.entries(initialSettings?.guildSettings ?? {})) {
      const trimmedGuildId = guildId.trim();
      if (!trimmedGuildId) {
        continue;
      }
      this.guildSettingsByGuildId.set(trimmedGuildId, sanitizeGuildSettings({
        ...this.defaultGuildSettings,
        ...settings
      }));
    }

    for (const record of initialSettings?.honeypotPendingVerifications ?? []) {
      const sanitized = sanitizeHoneypotRecord(record);
      if (!sanitized.id.trim() || !sanitized.guildId || !sanitized.userId) {
        continue;
      }
      this.honeypotPendingVerifications.set(sanitized.id, sanitized);
    }
  }

  recordAction(type: string, summary: string): void {
    this.actions.unshift({
      id: createId(),
      createdAt: new Date().toISOString(),
      type,
      summary
    });
    this.actions.splice(25);
  }

  recordLlmConsoleEvent(event: DashboardLlmConsoleEventInput): void {
    this.llmConsoleEvents.unshift({
      id: createId(),
      createdAt: new Date().toISOString(),
      ...event,
      ok: !event.error
    });
    this.llmConsoleEvents.splice(200);
  }

  recordSystemConsoleEvent(event: DashboardSystemConsoleEventInput): void {
    this.systemConsoleEvents.unshift({
      id: createId(),
      createdAt: new Date().toISOString(),
      ...event,
      level: event.level
    });
    this.systemConsoleEvents.splice(500);
  }

  getConsoleSnapshot(): {
    llm: DashboardLlmConsoleEvent[];
    system: DashboardSystemConsoleEvent[];
  } {
    return {
      llm: this.llmConsoleEvents.map(event => ({ ...event })),
      system: this.systemConsoleEvents.map(event => ({ ...event }))
    };
  }

  recordModeration(event: Omit<ModerationEvent, "id" | "createdAt">): void {
    this.moderationEvents.unshift({
      id: createId(),
      createdAt: new Date().toISOString(),
      ...event,
      imageUrls: [...event.imageUrls],
      protectionReasons: Array.isArray(event.protectionReasons) ? [...event.protectionReasons] : undefined
    });
    this.moderationEvents.splice(50);
  }

  recordGuildSignal(
    guildId: string,
    type: GuildSignalEvent["type"],
    summary: string
  ): void {
    const trimmedGuildId = guildId.trim();
    if (!trimmedGuildId) {
      return;
    }

    const nextEvent: GuildSignalEvent = {
      id: createId(),
      guildId: trimmedGuildId,
      createdAt: new Date().toISOString(),
      type,
      summary
    };

    const events = this.guildSignalsByGuildId.get(trimmedGuildId) ?? [];
    events.unshift(nextEvent);
    events.splice(50);
    this.guildSignalsByGuildId.set(trimmedGuildId, events);
  }

  getRecentGuildSignals(guildId: string, lookbackMs: number): GuildSignalEvent[] {
    const trimmedGuildId = guildId.trim();
    if (!trimmedGuildId) {
      return [];
    }

    const cutoff = Date.now() - Math.max(0, lookbackMs);
    return (this.guildSignalsByGuildId.get(trimmedGuildId) ?? [])
      .filter(event => new Date(event.createdAt).getTime() >= cutoff)
      .map(event => ({ ...event }));
  }

  setChatModeDebugStatus(input: {
    guildId: string;
    channelId: string;
    status: ChatModeDebugStatus["status"];
    reason: string;
    username?: string | null;
    userId?: string | null;
    messagePreview?: string | null;
  }): ChatModeDebugStatus {
    const record: ChatModeDebugStatus = {
      guildId: input.guildId.trim(),
      channelId: input.channelId.trim(),
      updatedAt: new Date().toISOString(),
      status: input.status,
      reason: input.reason,
      username: input.username ?? null,
      userId: input.userId ?? null,
      messagePreview: input.messagePreview ?? null
    };
    this.chatModeDebugByChannelKey.set(`${record.guildId}:${record.channelId}`, record);
    return { ...record };
  }

  getChatModeDebugStatus(guildId: string, channelId: string): ChatModeDebugStatus | null {
    const record = this.chatModeDebugByChannelKey.get(`${guildId.trim()}:${channelId.trim()}`);
    return record ? { ...record } : null;
  }

  createModerationVetoRecord(input: {
    guildId: string;
    userId: string;
    username: string;
    channelId: string;
    reason: string;
    imageUrls: string[];
  }): ModerationVetoRecord {
    const record: ModerationVetoRecord = {
      id: createId(),
      createdAt: new Date().toISOString(),
      guildId: input.guildId,
      userId: input.userId,
      username: input.username,
      channelId: input.channelId,
      noticeMessageId: null,
      reason: input.reason,
      imageUrls: [...input.imageUrls],
      resolvedAt: null,
      vetoedByUserId: null,
      vetoedByTag: null
    };

    this.moderationVetoRecords.set(record.id, record);
    if (this.moderationVetoRecords.size > 50) {
      const oldestKey = [...this.moderationVetoRecords.entries()]
        .sort((left, right) => left[1].createdAt.localeCompare(right[1].createdAt))[0]?.[0];
      if (oldestKey) {
        this.moderationVetoRecords.delete(oldestKey);
      }
    }
    return { ...record, imageUrls: [...record.imageUrls] };
  }

  attachModerationVetoNoticeMessage(vetoId: string, noticeMessageId: string): void {
    const record = this.moderationVetoRecords.get(vetoId);
    if (!record) {
      return;
    }

    record.noticeMessageId = noticeMessageId;
  }

  getModerationVetoRecord(vetoId: string): ModerationVetoRecord | null {
    const record = this.moderationVetoRecords.get(vetoId);
    if (!record) {
      return null;
    }

    return {
      ...record,
      imageUrls: [...record.imageUrls]
    };
  }

  resolveModerationVetoRecord(vetoId: string, input: {
    vetoedByUserId: string;
    vetoedByTag: string;
  }): ModerationVetoRecord | null {
    const record = this.moderationVetoRecords.get(vetoId);
    if (!record || record.resolvedAt) {
      return null;
    }

    record.resolvedAt = new Date().toISOString();
    record.vetoedByUserId = input.vetoedByUserId;
    record.vetoedByTag = input.vetoedByTag;
    return {
      ...record,
      imageUrls: [...record.imageUrls]
    };
  }

  createHoneypotPendingVerification(input: Omit<HoneypotPendingVerificationRecord, "id" | "createdAt" | "resolvedAt" | "verifiedAt" | "verifiedByUserId" | "verifiedByTag" | "finalActionTaken" | "dmMessageId" | "dmChannelId">): HoneypotPendingVerificationRecord {
    const record = sanitizeHoneypotRecord({
      id: createId(),
      createdAt: new Date().toISOString(),
      ...input,
      dmMessageId: null,
      dmChannelId: null,
      resolvedAt: null,
      verifiedAt: null,
      verifiedByUserId: null,
      verifiedByTag: null,
      finalActionTaken: null
    });
    this.honeypotPendingVerifications.set(record.id, record);
    return cloneHoneypotRecord(record);
  }

  attachHoneypotVerificationMessage(recordId: string, input: { dmMessageId: string | null; dmChannelId: string | null }): void {
    const record = this.honeypotPendingVerifications.get(recordId);
    if (!record) {
      return;
    }
    record.dmMessageId = coerceChannelId(input.dmMessageId);
    record.dmChannelId = coerceChannelId(input.dmChannelId);
  }

  getHoneypotPendingVerification(recordId: string): HoneypotPendingVerificationRecord | null {
    const record = this.honeypotPendingVerifications.get(recordId);
    return record ? cloneHoneypotRecord(record) : null;
  }

  resolveHoneypotPendingVerification(recordId: string, input: { verifiedByUserId: string; verifiedByTag: string }): HoneypotPendingVerificationRecord | null {
    const record = this.honeypotPendingVerifications.get(recordId);
    if (!record || record.resolvedAt) {
      return null;
    }
    record.resolvedAt = new Date().toISOString();
    record.verifiedAt = record.resolvedAt;
    record.verifiedByUserId = input.verifiedByUserId.trim();
    record.verifiedByTag = input.verifiedByTag.trim();
    record.finalActionTaken = "none";
    return cloneHoneypotRecord(record);
  }

  finalizeExpiredHoneypotPendingVerification(recordId: string, finalActionTaken: "none" | "kick" | "ban"): HoneypotPendingVerificationRecord | null {
    const record = this.honeypotPendingVerifications.get(recordId);
    if (!record || record.resolvedAt) {
      return null;
    }
    record.resolvedAt = new Date().toISOString();
    record.finalActionTaken = finalActionTaken;
    return cloneHoneypotRecord(record);
  }

  listExpiredHoneypotPendingVerifications(now = Date.now()): HoneypotPendingVerificationRecord[] {
    return [...this.honeypotPendingVerifications.values()]
      .filter(record => !record.resolvedAt && new Date(record.verifyByAt).getTime() <= now)
      .map(record => cloneHoneypotRecord(record));
  }

  setRequireConfirmationForLlmSend(enabled: boolean): GlobalDashboardSettings {
    this.globalSettings.requireConfirmationForLlmSend = enabled;
    return this.getGlobalDashboardSettings();
  }

  updateFfmpegSettings(input: {
    ffmpegExecutablePath?: string;
  }): GlobalDashboardSettings {
    if (typeof input.ffmpegExecutablePath === "string") {
      this.globalSettings.ffmpegExecutablePath = input.ffmpegExecutablePath.trim();
    }
    return this.getGlobalDashboardSettings();
  }

  updateLlmConnectionSettings(input: {
    llmProvider?: "ollama" | "lmstudio" | "llamacpp";
    ollamaUrl?: string;
    lmStudioBaseUrl?: string;
    lmStudioApiKey?: string;
    lmStudioContextLength?: number;
    lmStudioTextModelReasoningEnabled?: boolean;
  }): GlobalDashboardSettings {
    if (input.llmProvider === "ollama" || input.llmProvider === "lmstudio" || input.llmProvider === "llamacpp") {
      this.globalSettings.llmProvider = input.llmProvider;
    }
    if (typeof input.ollamaUrl === "string" && input.ollamaUrl.trim().length > 0) {
      this.globalSettings.ollamaUrl = input.ollamaUrl.trim();
    }
    if (typeof input.lmStudioBaseUrl === "string" && input.lmStudioBaseUrl.trim().length > 0) {
      this.globalSettings.lmStudioBaseUrl = input.lmStudioBaseUrl.trim();
    }
    if (typeof input.lmStudioApiKey === "string") {
      this.globalSettings.lmStudioApiKey = input.lmStudioApiKey.trim();
    }
    if (typeof input.lmStudioContextLength === "number" && Number.isFinite(input.lmStudioContextLength)) {
      this.globalSettings.lmStudioContextLength = Math.max(0, Math.round(input.lmStudioContextLength));
    }
    if (typeof input.lmStudioTextModelReasoningEnabled === "boolean") {
      this.globalSettings.lmStudioTextModelReasoningEnabled = input.lmStudioTextModelReasoningEnabled;
    }
    return this.getGlobalDashboardSettings();
  }
  updateImageLlmConnectionSettings(input: {
    llmProvider?: "ollama" | "lmstudio" | "llamacpp";
    ollamaUrl?: string;
    lmStudioBaseUrl?: string;
    lmStudioApiKey?: string;
    textModel?: string;
    visionModel?: string;
  }): GlobalDashboardSettings {
    if (input.llmProvider === "ollama" || input.llmProvider === "lmstudio" || input.llmProvider === "llamacpp") {
      this.globalSettings.imageLlmProvider = input.llmProvider;
    }
    if (typeof input.ollamaUrl === "string") {
      this.globalSettings.imageOllamaUrl = input.ollamaUrl.trim();
    }
    if (typeof input.lmStudioBaseUrl === "string") {
      this.globalSettings.imageLmStudioBaseUrl = input.lmStudioBaseUrl.trim();
    }
    if (typeof input.lmStudioApiKey === "string") {
      this.globalSettings.imageLmStudioApiKey = input.lmStudioApiKey.trim();
    }
    if (typeof input.textModel === "string") {
      this.globalSettings.imageLlmTextModel = input.textModel.trim();
    }
    if (typeof input.visionModel === "string") {
      this.globalSettings.imageLlmVisionModel = input.visionModel.trim();
    }
    return this.getGlobalDashboardSettings();
  }
  updateModel3dLlmConnectionSettings(input: {
    llmProvider?: "ollama" | "lmstudio" | "llamacpp";
    ollamaUrl?: string;
    lmStudioBaseUrl?: string;
    lmStudioApiKey?: string;
    textModel?: string;
    visionModel?: string;
  }): GlobalDashboardSettings {
    if (input.llmProvider === "ollama" || input.llmProvider === "lmstudio" || input.llmProvider === "llamacpp") {
      this.globalSettings.model3dLlmProvider = input.llmProvider;
    }
    if (typeof input.ollamaUrl === "string") {
      this.globalSettings.model3dOllamaUrl = input.ollamaUrl.trim();
    }
    if (typeof input.lmStudioBaseUrl === "string") {
      this.globalSettings.model3dLmStudioBaseUrl = input.lmStudioBaseUrl.trim();
    }
    if (typeof input.lmStudioApiKey === "string") {
      this.globalSettings.model3dLmStudioApiKey = input.lmStudioApiKey.trim();
    }
    if (typeof input.textModel === "string") {
      this.globalSettings.model3dLlmTextModel = input.textModel.trim();
    }
    if (typeof input.visionModel === "string") {
      this.globalSettings.model3dLlmVisionModel = input.visionModel.trim();
    }
    return this.getGlobalDashboardSettings();
  }

  updateOllamaModels(input: {
    ollamaTextModel?: string;
    ollamaVisionModel?: string;
    ollamaTextModelIsVisual?: boolean;
    unloadLlmBeforeModel3dGeneration?: boolean;
    model3dGenerationTarget?: "local" | "remote";
    model3dMetadataTarget?: "local" | "remote";
  }): GlobalDashboardSettings {
    if (typeof input.ollamaTextModel === "string" && input.ollamaTextModel.trim().length > 0) {
      this.globalSettings.ollamaTextModel = input.ollamaTextModel.trim();
    }

    if (typeof input.ollamaVisionModel === "string" && input.ollamaVisionModel.trim().length > 0) {
      this.globalSettings.ollamaVisionModel = input.ollamaVisionModel.trim();
    }
    if (typeof input.ollamaTextModelIsVisual === "boolean") {
      this.globalSettings.ollamaTextModelIsVisual = input.ollamaTextModelIsVisual;
    }
    if (typeof input.unloadLlmBeforeModel3dGeneration === "boolean") {
      this.globalSettings.unloadLlmBeforeModel3dGeneration = input.unloadLlmBeforeModel3dGeneration;
    }
    if (input.model3dGenerationTarget === "local" || input.model3dGenerationTarget === "remote") {
      this.globalSettings.model3dGenerationTarget = input.model3dGenerationTarget;
    }
    if (input.model3dMetadataTarget === "local" || input.model3dMetadataTarget === "remote") {
      this.globalSettings.model3dMetadataTarget = input.model3dMetadataTarget;
    }

    return this.getGlobalDashboardSettings();
  }

  updateImageMetadataStripSettings(input: {
    stripMetadataWebUiImages?: boolean;
    stripMetadataDiscordImages?: boolean;
  }): GlobalDashboardSettings {
    if (typeof input.stripMetadataWebUiImages === "boolean") {
      this.globalSettings.stripMetadataWebUiImages = input.stripMetadataWebUiImages;
    }
    if (typeof input.stripMetadataDiscordImages === "boolean") {
      this.globalSettings.stripMetadataDiscordImages = input.stripMetadataDiscordImages;
    }
    return this.getGlobalDashboardSettings();
  }

  updateMessengerRuntimeSettings(input: {
    messengerSharedSecretsPath?: string;
    discordRuntimeAutostart?: boolean;
    telegramRuntimeAutostart?: boolean;
    matrixRuntimeAutostart?: boolean;
    whatsappRuntimeAutostart?: boolean;
  }): GlobalDashboardSettings {
    if (typeof input.messengerSharedSecretsPath === "string") {
      this.globalSettings.messengerSharedSecretsPath = input.messengerSharedSecretsPath.trim();
    }
    if (typeof input.discordRuntimeAutostart === "boolean") {
      this.globalSettings.discordRuntimeAutostart = input.discordRuntimeAutostart;
    }
    if (typeof input.telegramRuntimeAutostart === "boolean") {
      this.globalSettings.telegramRuntimeAutostart = input.telegramRuntimeAutostart;
    }
    if (typeof input.matrixRuntimeAutostart === "boolean") {
      this.globalSettings.matrixRuntimeAutostart = input.matrixRuntimeAutostart;
    }
    if (typeof input.whatsappRuntimeAutostart === "boolean") {
      this.globalSettings.whatsappRuntimeAutostart = input.whatsappRuntimeAutostart;
    }
    return this.getGlobalDashboardSettings();
  }

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
  }): GlobalDashboardSettings {
    const comfyUiBaseUrl = typeof input.comfyUiBaseUrl === "string" ? input.comfyUiBaseUrl.trim() : "";
    const comfyUiModelBaseUrl = typeof input.comfyUiModelBaseUrl === "string" ? input.comfyUiModelBaseUrl.trim() : "";
    const comfyUiImageBaseUrl = typeof input.comfyUiImageBaseUrl === "string" ? input.comfyUiImageBaseUrl.trim() : "";
    const comfyUiAudioBaseUrl = typeof input.comfyUiAudioBaseUrl === "string" ? input.comfyUiAudioBaseUrl.trim() : "";
    const comfyUiMusicBaseUrl = typeof input.comfyUiMusicBaseUrl === "string" ? input.comfyUiMusicBaseUrl.trim() : "";
    const comfyUiVideoBaseUrl = typeof input.comfyUiVideoBaseUrl === "string" ? input.comfyUiVideoBaseUrl.trim() : "";
    const comfyUiInputDir = typeof input.comfyUiInputDir === "string" ? input.comfyUiInputDir.trim() : "";
    const comfyUiModelWorkflowPath = typeof input.comfyUiModelWorkflowPath === "string" ? input.comfyUiModelWorkflowPath.trim() : "";
    const comfyUiImageWorkflowPath = typeof input.comfyUiImageWorkflowPath === "string" ? input.comfyUiImageWorkflowPath.trim() : "";
    const comfyUiImageEditWorkflowPath = typeof input.comfyUiImageEditWorkflowPath === "string" ? input.comfyUiImageEditWorkflowPath.trim() : "";
    const comfyUiImageLayeredWorkflowPath = typeof input.comfyUiImageLayeredWorkflowPath === "string" ? input.comfyUiImageLayeredWorkflowPath.trim() : "";
    const comfyUiAudioWorkflowPath = typeof input.comfyUiAudioWorkflowPath === "string" ? input.comfyUiAudioWorkflowPath.trim() : "";
    const comfyUiMusicWorkflowPath = typeof input.comfyUiMusicWorkflowPath === "string" ? input.comfyUiMusicWorkflowPath.trim() : "";
    const comfyUiVideoWorkflowPath = typeof input.comfyUiVideoWorkflowPath === "string" ? input.comfyUiVideoWorkflowPath.trim() : "";
    const comfyUiVideoImageWorkflowPath = typeof input.comfyUiVideoImageWorkflowPath === "string" ? input.comfyUiVideoImageWorkflowPath.trim() : "";
    if (comfyUiBaseUrl) {
      this.globalSettings.comfyUiBaseUrl = comfyUiBaseUrl;
    }
    if (comfyUiModelBaseUrl) {
      this.globalSettings.comfyUiModelBaseUrl = comfyUiModelBaseUrl;
    }
    if (comfyUiImageBaseUrl) {
      this.globalSettings.comfyUiImageBaseUrl = comfyUiImageBaseUrl;
    }
    if (comfyUiAudioBaseUrl) {
      this.globalSettings.comfyUiAudioBaseUrl = comfyUiAudioBaseUrl;
    }
    if (comfyUiMusicBaseUrl) {
      this.globalSettings.comfyUiMusicBaseUrl = comfyUiMusicBaseUrl;
    }
    if (comfyUiVideoBaseUrl) {
      this.globalSettings.comfyUiVideoBaseUrl = comfyUiVideoBaseUrl;
    }
    if (comfyUiInputDir) {
      this.globalSettings.comfyUiInputDir = comfyUiInputDir;
    }
    if (comfyUiModelWorkflowPath) {
      this.globalSettings.comfyUiModelWorkflowPath = comfyUiModelWorkflowPath;
    }
    if (comfyUiImageWorkflowPath) {
      this.globalSettings.comfyUiImageWorkflowPath = comfyUiImageWorkflowPath;
    }
    if (comfyUiImageEditWorkflowPath) {
      this.globalSettings.comfyUiImageEditWorkflowPath = comfyUiImageEditWorkflowPath;
    }
    if (comfyUiImageLayeredWorkflowPath) {
      this.globalSettings.comfyUiImageLayeredWorkflowPath = comfyUiImageLayeredWorkflowPath;
    }
    if (comfyUiAudioWorkflowPath) {
      this.globalSettings.comfyUiAudioWorkflowPath = comfyUiAudioWorkflowPath;
    }
    if (comfyUiMusicWorkflowPath) {
      this.globalSettings.comfyUiMusicWorkflowPath = comfyUiMusicWorkflowPath;
    }
    if (comfyUiVideoWorkflowPath) {
      this.globalSettings.comfyUiVideoWorkflowPath = comfyUiVideoWorkflowPath;
    }
    if (comfyUiVideoImageWorkflowPath) {
      this.globalSettings.comfyUiVideoImageWorkflowPath = comfyUiVideoImageWorkflowPath;
    }
    return this.getGlobalDashboardSettings();
  }

  updateGuildDashboardSettings(
    guildId: string,
    input: Partial<GuildDashboardSettings> & {
      antiSpamImageScanChannelId?: string | null;
    }
  ): GuildDashboardSettings {
    const trimmedGuildId = guildId.trim();
    if (!trimmedGuildId) {
      throw new Error("guildId is required.");
    }

    const settings = this.getGuildDashboardSettings(trimmedGuildId);

    if (typeof input.antiSpamEnabled === "boolean") {
      settings.antiSpamEnabled = input.antiSpamEnabled;
    }

    if (typeof input.antiSpamDuplicateWindowMs === "number" && input.antiSpamDuplicateWindowMs > 0) {
      settings.antiSpamDuplicateWindowMs = input.antiSpamDuplicateWindowMs;
    }

    if (typeof input.antiSpamTimeoutMs === "number" && input.antiSpamTimeoutMs > 0) {
      settings.antiSpamTimeoutMs = input.antiSpamTimeoutMs;
    }

    if (typeof input.antiSpamApplyTimeouts === "boolean") {
      settings.antiSpamApplyTimeouts = input.antiSpamApplyTimeouts;
    }

    if (typeof input.antiSpamAnalyzeImages === "boolean") {
      settings.antiSpamAnalyzeImages = input.antiSpamAnalyzeImages;
    }

    if (typeof input.antiSpamTemporaryInvestigationHoldEnabled === "boolean") {
      settings.antiSpamTemporaryInvestigationHoldEnabled = input.antiSpamTemporaryInvestigationHoldEnabled;
    }

    if (typeof input.antiSpamTemporaryInvestigationHoldMs === "number" && input.antiSpamTemporaryInvestigationHoldMs >= 0) {
      settings.antiSpamTemporaryInvestigationHoldMs = input.antiSpamTemporaryInvestigationHoldMs;
    }

    if (Array.isArray(input.antiSpamImageScanChannelIds)) {
      settings.antiSpamImageScanChannelIds = normalizeRuleEntries(input.antiSpamImageScanChannelIds);
    } else if (typeof input.antiSpamImageScanChannelId === "string") {
      const trimmed = input.antiSpamImageScanChannelId.trim();
      settings.antiSpamImageScanChannelIds = trimmed.length > 0 ? [trimmed] : [];
    } else if (input.antiSpamImageScanChannelId === null) {
      settings.antiSpamImageScanChannelIds = [];
    }

    if (Array.isArray(input.antiSpamExcludedChannelIds)) {
      settings.antiSpamExcludedChannelIds = normalizeRuleEntries(input.antiSpamExcludedChannelIds);
    }

    if (Array.isArray(input.antiSpamExcludedRoleIds)) {
      settings.antiSpamExcludedRoleIds = normalizeRuleEntries(input.antiSpamExcludedRoleIds);
    }

    if (typeof input.antiSpamAlertChannelId === "string") {
      const trimmed = input.antiSpamAlertChannelId.trim();
      settings.antiSpamAlertChannelId = trimmed.length > 0 ? trimmed : null;
    } else if (input.antiSpamAlertChannelId === null) {
      settings.antiSpamAlertChannelId = null;
    }

    if (Array.isArray(input.antiSpamTextRulePatterns)) {
      settings.antiSpamTextRulePatterns = validateUserRegexPatterns(input.antiSpamTextRulePatterns);
    }

    if (Array.isArray(input.antiSpamBlockedLinkPatterns)) {
      settings.antiSpamBlockedLinkPatterns = normalizeWildcardPatterns(input.antiSpamBlockedLinkPatterns);
    }

    if (typeof input.antiSpamImageFlagSpam === "boolean") {
      settings.antiSpamImageFlagSpam = input.antiSpamImageFlagSpam;
    }

    if (typeof input.antiSpamImageFlagNsfw === "boolean") {
      settings.antiSpamImageFlagNsfw = input.antiSpamImageFlagNsfw;
    }

    if (typeof input.antiSpamImageFlagCryptoSpam === "boolean") {
      settings.antiSpamImageFlagCryptoSpam = input.antiSpamImageFlagCryptoSpam;
    }

    if (typeof input.antiSpamImageFlagCryptoImage === "boolean") {
      settings.antiSpamImageFlagCryptoImage = input.antiSpamImageFlagCryptoImage;
    }

    if (typeof input.honeypotEnabled === "boolean") {
      settings.honeypotEnabled = input.honeypotEnabled;
    }
    if (typeof input.honeypotChannelId === "string") {
      settings.honeypotChannelId = coerceChannelId(input.honeypotChannelId);
    } else if (input.honeypotChannelId === null) {
      settings.honeypotChannelId = null;
    }
    if (typeof input.honeypotTriggerOnText === "boolean") {
      settings.honeypotTriggerOnText = input.honeypotTriggerOnText;
    }
    if (typeof input.honeypotTriggerOnFiles === "boolean") {
      settings.honeypotTriggerOnFiles = input.honeypotTriggerOnFiles;
    }
    if (typeof input.honeypotTriggerOnLinks === "boolean") {
      settings.honeypotTriggerOnLinks = input.honeypotTriggerOnLinks;
    }
    if (input.honeypotImmediateAction === "timeout" || input.honeypotImmediateAction === "kick" || input.honeypotImmediateAction === "ban") {
      settings.honeypotImmediateAction = input.honeypotImmediateAction;
    }
    if (typeof input.honeypotTimeoutMs === "number" && input.honeypotTimeoutMs > 0) {
      settings.honeypotTimeoutMs = input.honeypotTimeoutMs;
    }
    if (typeof input.honeypotRemoveMessage === "boolean") {
      settings.honeypotRemoveMessage = input.honeypotRemoveMessage;
    }
    if (Array.isArray(input.protectedUserIds)) {
      settings.protectedUserIds = normalizeRuleEntries(input.protectedUserIds);
    }
    if (Array.isArray(input.protectedRoleIds)) {
      settings.protectedRoleIds = normalizeRuleEntries(input.protectedRoleIds);
    }
    if (Array.isArray(input.honeypotExcludedChannelIds)) {
      settings.honeypotExcludedChannelIds = normalizeRuleEntries(input.honeypotExcludedChannelIds);
    }
    if (Array.isArray(input.honeypotExcludedRoleIds)) {
      settings.honeypotExcludedRoleIds = normalizeRuleEntries(input.honeypotExcludedRoleIds);
    }
    if (typeof input.honeypotBackupChannelId === "string") {
      settings.honeypotBackupChannelId = coerceChannelId(input.honeypotBackupChannelId);
    } else if (input.honeypotBackupChannelId === null) {
      settings.honeypotBackupChannelId = null;
    }
    if (typeof input.honeypotDmEnabled === "boolean") {
      settings.honeypotDmEnabled = input.honeypotDmEnabled;
    }
    if (typeof input.honeypotDmMessage === "string") {
      settings.honeypotDmMessage = input.honeypotDmMessage.trim();
    }
    if (typeof input.honeypotReviewChannelId === "string") {
      settings.honeypotReviewChannelId = coerceChannelId(input.honeypotReviewChannelId);
    } else if (input.honeypotReviewChannelId === null) {
      settings.honeypotReviewChannelId = null;
    }
    if (input.honeypotPostVerifyAction === "none" || input.honeypotPostVerifyAction === "remove-timeout" || input.honeypotPostVerifyAction === "unban") {
      settings.honeypotPostVerifyAction = input.honeypotPostVerifyAction;
    }
    if (typeof input.honeypotVerificationWindowMs === "number" && input.honeypotVerificationWindowMs > 0) {
      settings.honeypotVerificationWindowMs = input.honeypotVerificationWindowMs;
    }
    if (input.honeypotUnverifiedAction === "none" || input.honeypotUnverifiedAction === "kick" || input.honeypotUnverifiedAction === "ban") {
      settings.honeypotUnverifiedAction = input.honeypotUnverifiedAction;
    }

    const sanitized = sanitizeGuildSettings(settings);
    this.guildSettingsByGuildId.set(trimmedGuildId, sanitized);
    return cloneGuildSettings(sanitized);
  }

  getGlobalDashboardSettings(): GlobalDashboardSettings {
    return {
      ...this.globalSettings
    };
  }

  getGuildDashboardSettings(guildId: string): GuildDashboardSettings {
    const trimmedGuildId = guildId.trim();
    const settings = this.guildSettingsByGuildId.get(trimmedGuildId);
    if (!settings) {
      return cloneGuildSettings(this.defaultGuildSettings);
    }
    return cloneGuildSettings(settings);
  }

  getStoredDashboardSettings(): StoredDashboardSettings {
    const guildSettings: Record<string, Partial<GuildDashboardSettings>> = {};
    for (const [guildId, settings] of this.guildSettingsByGuildId.entries()) {
      guildSettings[guildId] = cloneGuildSettings(settings);
    }

    const {
      lmStudioApiKey: _lmStudioApiKey,
      imageLmStudioApiKey: _imageLmStudioApiKey,
      model3dLmStudioApiKey: _model3dLmStudioApiKey,
      ...storedGlobalSettings
    } = this.globalSettings;
    return {
      globalSettings: storedGlobalSettings,
      defaultGuildSettings: cloneGuildSettings(this.defaultGuildSettings),
      guildSettings,
      honeypotPendingVerifications: [...this.honeypotPendingVerifications.values()].map(record => cloneHoneypotRecord(record))
    };
  }

  createPendingDraft(channelId: string, prompt: string, response: string): PendingDraft {
    const draft: PendingDraft = {
      id: createId(),
      createdAt: new Date().toISOString(),
      channelId,
      prompt,
      response
    };

    this.pendingDrafts.unshift(draft);
    this.pendingDrafts.splice(10);
    return draft;
  }

  recordSelfTaskReview(input: {
    guildId: string;
    requestedByTag: string;
    requestText: string;
    summary: string;
    actionDescriptions: string[];
  }): SelfTaskReviewRecord {
    const record: SelfTaskReviewRecord = {
      id: createId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      guildId: input.guildId,
      requestedByTag: input.requestedByTag,
      requestText: input.requestText,
      summary: input.summary,
      actionDescriptions: [...input.actionDescriptions],
      status: "planned",
      resolutionNote: null
    };
    this.selfTaskReviews.unshift(record);
    this.selfTaskReviews.splice(30);
    return {
      ...record,
      actionDescriptions: [...record.actionDescriptions]
    };
  }

  resolveSelfTaskReview(reviewId: string, input: {
    status: SelfTaskReviewRecord["status"];
    resolutionNote?: string | null;
  }): SelfTaskReviewRecord | null {
    const record = this.selfTaskReviews.find(item => item.id === reviewId);
    if (!record) {
      return null;
    }

    record.status = input.status;
    record.updatedAt = new Date().toISOString();
    record.resolutionNote = input.resolutionNote ?? null;
    return {
      ...record,
      actionDescriptions: [...record.actionDescriptions]
    };
  }

  consumePendingDraft(draftId: string): PendingDraft | null {
    const index = this.pendingDrafts.findIndex(entry => entry.id === draftId);
    if (index === -1) {
      return null;
    }

    const [draft] = this.pendingDrafts.splice(index, 1);
    return draft ?? null;
  }

  snapshot(bot: BotSnapshot): {
    bot: BotSnapshot;
    settings: GlobalDashboardSettings;
    actions: BotActionEvent[];
    moderationEvents: ModerationEvent[];
    pendingDrafts: PendingDraft[];
    selfTaskReviews: SelfTaskReviewRecord[];
  } {
    return {
      bot: {
        ...bot,
        startedAt: this.startedAt
      },
      settings: this.getGlobalDashboardSettings(),
      actions: [...this.actions],
      moderationEvents: this.moderationEvents.map(event => ({
        ...event,
        imageUrls: [...event.imageUrls],
        protectionReasons: Array.isArray(event.protectionReasons) ? [...event.protectionReasons] : undefined
      })),
      pendingDrafts: [...this.pendingDrafts],
      selfTaskReviews: this.selfTaskReviews.map(record => ({
        ...record,
        actionDescriptions: [...record.actionDescriptions]
      }))
    };
  }
}
