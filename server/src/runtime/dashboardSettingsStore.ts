import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import type { DashboardSettings } from "./runtimeState.js";
import type {
  GlobalDashboardSettings,
  GuildDashboardSettings,
  HoneypotPendingVerificationRecord,
  StoredDashboardSettings
} from "@urage/shared/dashboard/runtimeContracts";

const dashboardSettingsWriteRetryCount = 4;
const dashboardSettingsWriteRetryDelayMs = 160;

export interface DashboardSettingsStore {
  load: () => Promise<StoredDashboardSettings>;
  save: (settings: StoredDashboardSettings) => Promise<void>;
}

function shouldRetryDashboardSettingsWrite(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code || "").trim().toUpperCase() : "";
  return code === "EPERM" || code === "EBUSY" || code === "EACCES";
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function createDashboardSettingsStore(input: { storePath?: string } = {}): DashboardSettingsStore {
  const storePath = path.resolve(input.storePath ?? path.join(appConfig.dataDirectory, "dashboard-settings.json"));
  const dataDirectory = path.dirname(storePath);
  let mutationQueue: Promise<unknown> = Promise.resolve();

  async function writeStoreFile(jsonText: string): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= dashboardSettingsWriteRetryCount; attempt += 1) {
      try {
        await writeFile(storePath, jsonText, "utf8");
        return;
      } catch (error) {
        lastError = error;
        if (!shouldRetryDashboardSettingsWrite(error) || attempt >= dashboardSettingsWriteRetryCount) {
          throw error;
        }
        await sleep(dashboardSettingsWriteRetryDelayMs * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Failed to write dashboard settings.");
  }

  async function ensureStoreFile(): Promise<void> {
    await mkdir(dataDirectory, { recursive: true });

    try {
      await readFile(storePath, "utf8");
    } catch {
      const initial: StoredDashboardSettings = {
        globalSettings: {},
        defaultGuildSettings: {},
        guildSettings: {},
        honeypotPendingVerifications: []
      };
      await writeStoreFile(JSON.stringify(initial, null, 2));
    }
  }

  async function load(): Promise<StoredDashboardSettings> {
    await ensureStoreFile();
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as {
      settings?: Partial<DashboardSettings>;
      globalSettings?: Partial<GlobalDashboardSettings>;
      defaultGuildSettings?: Partial<GuildDashboardSettings>;
      guildSettings?: Record<string, Partial<GuildDashboardSettings>>;
      honeypotPendingVerifications?: HoneypotPendingVerificationRecord[];
    };

    const globalSettings = typeof parsed.globalSettings === "object" && parsed.globalSettings !== null
      ? parsed.globalSettings
      : {};
    const defaultGuildSettings = typeof parsed.defaultGuildSettings === "object" && parsed.defaultGuildSettings !== null
      ? parsed.defaultGuildSettings
      : {};
    const guildSettings = typeof parsed.guildSettings === "object" && parsed.guildSettings !== null
      ? parsed.guildSettings
      : {};
    const honeypotPendingVerifications = Array.isArray(parsed.honeypotPendingVerifications)
      ? parsed.honeypotPendingVerifications
      : [];

    if (typeof parsed.settings === "object" && parsed.settings !== null) {
      const legacy = parsed.settings;
      return {
        globalSettings: {
          requireConfirmationForLlmSend: legacy.requireConfirmationForLlmSend,
          ollamaTextModel: legacy.ollamaTextModel,
          ollamaVisionModel: legacy.ollamaVisionModel,
          ollamaTextModelIsVisual: false,
          unloadLlmBeforeModel3dGeneration: true,
          model3dGenerationTarget: "local",
          model3dMetadataTarget: "local",
          stripMetadataWebUiImages: legacy.stripMetadataWebUiImages,
          stripMetadataDiscordImages: legacy.stripMetadataDiscordImages,
          ...globalSettings
        },
        defaultGuildSettings: {
          antiSpamEnabled: legacy.antiSpamEnabled,
          antiSpamDuplicateWindowMs: legacy.antiSpamDuplicateWindowMs,
          antiSpamTimeoutMs: legacy.antiSpamTimeoutMs,
          antiSpamApplyTimeouts: legacy.antiSpamApplyTimeouts,
          antiSpamAnalyzeImages: legacy.antiSpamAnalyzeImages,
          antiSpamTemporaryInvestigationHoldEnabled: legacy.antiSpamTemporaryInvestigationHoldEnabled,
          antiSpamTemporaryInvestigationHoldMs: legacy.antiSpamTemporaryInvestigationHoldMs,
          antiSpamImageScanChannelIds: legacy.antiSpamImageScanChannelIds,
          antiSpamExcludedChannelIds: legacy.antiSpamExcludedChannelIds,
          antiSpamExcludedRoleIds: legacy.antiSpamExcludedRoleIds,
          antiSpamAlertChannelId: legacy.antiSpamAlertChannelId,
          antiSpamTextRulePatterns: legacy.antiSpamTextRulePatterns,
          antiSpamBlockedLinkPatterns: legacy.antiSpamBlockedLinkPatterns,
          antiSpamImageFlagSpam: legacy.antiSpamImageFlagSpam,
          antiSpamImageFlagNsfw: legacy.antiSpamImageFlagNsfw,
          antiSpamImageFlagCryptoSpam: legacy.antiSpamImageFlagCryptoSpam,
          antiSpamImageFlagCryptoImage: legacy.antiSpamImageFlagCryptoImage,
          honeypotEnabled: legacy.honeypotEnabled,
          honeypotChannelId: legacy.honeypotChannelId,
          honeypotTriggerOnText: legacy.honeypotTriggerOnText,
          honeypotTriggerOnFiles: legacy.honeypotTriggerOnFiles,
          honeypotTriggerOnLinks: legacy.honeypotTriggerOnLinks,
          honeypotImmediateAction: legacy.honeypotImmediateAction,
          honeypotTimeoutMs: legacy.honeypotTimeoutMs,
          honeypotRemoveMessage: legacy.honeypotRemoveMessage,
          honeypotExcludedChannelIds: legacy.honeypotExcludedChannelIds,
          honeypotExcludedRoleIds: legacy.honeypotExcludedRoleIds,
          honeypotBackupChannelId: legacy.honeypotBackupChannelId,
          honeypotDmEnabled: legacy.honeypotDmEnabled,
          honeypotDmMessage: legacy.honeypotDmMessage,
          honeypotReviewChannelId: legacy.honeypotReviewChannelId,
          honeypotPostVerifyAction: legacy.honeypotPostVerifyAction,
          honeypotVerificationWindowMs: legacy.honeypotVerificationWindowMs,
          honeypotUnverifiedAction: legacy.honeypotUnverifiedAction,
          ...defaultGuildSettings
        },
        guildSettings,
        honeypotPendingVerifications
      };
    }

    return {
      globalSettings,
      defaultGuildSettings,
      guildSettings,
      honeypotPendingVerifications
    };
  }

  async function save(settings: StoredDashboardSettings): Promise<void> {
    const snapshot: StoredDashboardSettings = {
      globalSettings: { ...settings.globalSettings },
      defaultGuildSettings: { ...settings.defaultGuildSettings },
      guildSettings: Object.fromEntries(
        Object.entries(settings.guildSettings).map(([guildId, guildSettings]) => [
          guildId,
          { ...guildSettings }
        ])
      ),
      honeypotPendingVerifications: settings.honeypotPendingVerifications.map(record => ({
        ...record,
        sourceAttachmentUrls: [...record.sourceAttachmentUrls]
      }))
    };

    const task = mutationQueue.then(async () => {
      await ensureStoreFile();
      await writeStoreFile(JSON.stringify(snapshot, null, 2));
    });

    mutationQueue = task.catch(() => undefined);
    await task;
  }

  return {load, save};
}

const dashboardSettingsStore = createDashboardSettingsStore();

export const loadDashboardSettings = dashboardSettingsStore.load;
export const saveDashboardSettings = dashboardSettingsStore.save;
