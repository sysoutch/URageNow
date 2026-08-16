import type { IncomingMessage, ServerResponse } from "node:http";
import { appConfig, type DashboardDependencies, type DashboardGuildSettings } from "../../../../server/runtime/botBridge.js";
import { parseJsonBody, sendJson } from "../../../../server/http.js";
import { createDashboardRouteTable, dispatchDashboardRoute, getRoute, postRoute } from "../../../../server/router.js";
import { syncComfySettingsViaRemoteWorker, updateComfyRuntimeSettings } from "../../../../server/runtime/botBridge.js";
import {
  imageOpenAiCompatibleApiKeySecretName,
  model3dOpenAiCompatibleApiKeySecretName,
  openAiCompatibleApiKeySecretName,
  setNativeSecret
} from "@urage/server/security/nativeSecretStore";

function redactGlobalSettingsForResponse(settings: ReturnType<DashboardDependencies["runtimeState"]["getGlobalDashboardSettings"]>) {
  return {
    ...settings,
    lmStudioApiKey: "",
    imageLmStudioApiKey: "",
    model3dLmStudioApiKey: ""
  };
}

async function handleGetApiGuildDashboardSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const guildId = url.searchParams.get("guildId")?.trim() || "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  sendJson(response, 200, dependencies.runtimeState.getGuildDashboardSettings(guildId));
}

async function handlePostApiSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const normalizeHttpUrl = (value: string, fieldLabel: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`${fieldLabel} is required.`);
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${fieldLabel} must start with http:// or https://`);
    }
    return parsed.toString();
  };
  const normalizeOptionalHttpUrl = (value: string, fieldLabel: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${fieldLabel} must start with http:// or https://`);
    }
    return parsed.toString();
  };
  let settings = dependencies.runtimeState.getGlobalDashboardSettings();
  if ("requireConfirmationForLlmSend" in body) {
    const enabled = body.requireConfirmationForLlmSend === true;
    settings = dependencies.runtimeState.setRequireConfirmationForLlmSend(enabled);
  }
  if ("ffmpegExecutablePath" in body) {
    settings = dependencies.runtimeState.updateFfmpegSettings({
      ffmpegExecutablePath: typeof body.ffmpegExecutablePath === "string" ? body.ffmpegExecutablePath : settings.ffmpegExecutablePath
    });
  }
  if (
    "llmProvider" in body
    || "ollamaUrl" in body
    || "lmStudioBaseUrl" in body
    || "lmStudioApiKey" in body
    || "lmStudioContextLength" in body
    || "lmStudioTextModelReasoningEnabled" in body
  ) {
    try {
      const llmProvider = body.llmProvider === "lmstudio" || body.llmProvider === "llamacpp"
        ? body.llmProvider
        : body.llmProvider === "ollama" ? "ollama" : settings.llmProvider;
      const ollamaUrl = typeof body.ollamaUrl === "string"
        ? normalizeHttpUrl(body.ollamaUrl, "Ollama URL")
        : settings.ollamaUrl;
      const lmStudioBaseUrl = typeof body.lmStudioBaseUrl === "string"
        ? normalizeHttpUrl(body.lmStudioBaseUrl, "LM Studio Base URL")
        : settings.lmStudioBaseUrl;
      const submittedLmStudioApiKey = typeof body.lmStudioApiKey === "string"
        ? body.lmStudioApiKey.trim()
        : "";
      if (submittedLmStudioApiKey) {
        setNativeSecret(openAiCompatibleApiKeySecretName, submittedLmStudioApiKey);
      }
      const lmStudioApiKey = submittedLmStudioApiKey || settings.lmStudioApiKey;
      const lmStudioContextLength = typeof body.lmStudioContextLength === "number" && Number.isFinite(body.lmStudioContextLength)
        ? Math.max(0, Math.round(body.lmStudioContextLength))
        : settings.lmStudioContextLength;
      const lmStudioTextModelReasoningEnabled = typeof body.lmStudioTextModelReasoningEnabled === "boolean"
        ? body.lmStudioTextModelReasoningEnabled
        : settings.lmStudioTextModelReasoningEnabled;
      dependencies.setLlmConnectionSettings({
        llmProvider,
        ollamaUrl,
        lmStudioBaseUrl,
        lmStudioApiKey,
        lmStudioContextLength,
        lmStudioTextModelReasoningEnabled
      });
      settings = dependencies.runtimeState.updateLlmConnectionSettings({
        llmProvider,
        ollamaUrl,
        lmStudioBaseUrl,
        lmStudioApiKey,
        lmStudioContextLength,
        lmStudioTextModelReasoningEnabled
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      sendJson(response, 400, { error: detail });
      return;
    }
  }
  if (
    "imageLlmProvider" in body
    || "imageOllamaUrl" in body
    || "imageLmStudioBaseUrl" in body
    || "imageLmStudioApiKey" in body
    || "imageLlmTextModel" in body
    || "imageLlmVisionModel" in body
  ) {
    try {
      const submittedImageLmStudioApiKey = typeof body.imageLmStudioApiKey === "string"
        ? body.imageLmStudioApiKey.trim()
        : "";
      if (submittedImageLmStudioApiKey) {
        setNativeSecret(imageOpenAiCompatibleApiKeySecretName, submittedImageLmStudioApiKey);
      }
      settings = dependencies.runtimeState.updateImageLlmConnectionSettings({
        llmProvider: body.imageLlmProvider === "lmstudio" || body.imageLlmProvider === "llamacpp"
          ? body.imageLlmProvider
          : body.imageLlmProvider === "ollama"
            ? "ollama"
            : settings.imageLlmProvider,
        ollamaUrl: typeof body.imageOllamaUrl === "string"
          ? normalizeOptionalHttpUrl(body.imageOllamaUrl, "Image Ollama URL")
          : settings.imageOllamaUrl,
        lmStudioBaseUrl: typeof body.imageLmStudioBaseUrl === "string"
          ? normalizeOptionalHttpUrl(body.imageLmStudioBaseUrl, "Image LM Studio Base URL")
          : settings.imageLmStudioBaseUrl,
        lmStudioApiKey: submittedImageLmStudioApiKey || settings.imageLmStudioApiKey,
        textModel: typeof body.imageLlmTextModel === "string"
          ? body.imageLlmTextModel
          : settings.imageLlmTextModel,
        visionModel: typeof body.imageLlmVisionModel === "string"
          ? body.imageLlmVisionModel
          : settings.imageLlmVisionModel
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      sendJson(response, 400, { error: detail });
      return;
    }
  }
  if (
    "model3dLlmProvider" in body
    || "model3dOllamaUrl" in body
    || "model3dLmStudioBaseUrl" in body
    || "model3dLmStudioApiKey" in body
    || "model3dLlmTextModel" in body
    || "model3dLlmVisionModel" in body
  ) {
    try {
      const submittedModel3dLmStudioApiKey = typeof body.model3dLmStudioApiKey === "string"
        ? body.model3dLmStudioApiKey.trim()
        : "";
      if (submittedModel3dLmStudioApiKey) {
        setNativeSecret(model3dOpenAiCompatibleApiKeySecretName, submittedModel3dLmStudioApiKey);
      }
      settings = dependencies.runtimeState.updateModel3dLlmConnectionSettings({
        llmProvider: body.model3dLlmProvider === "lmstudio" || body.model3dLlmProvider === "llamacpp"
          ? body.model3dLlmProvider
          : body.model3dLlmProvider === "ollama"
            ? "ollama"
            : settings.model3dLlmProvider,
        ollamaUrl: typeof body.model3dOllamaUrl === "string"
          ? normalizeOptionalHttpUrl(body.model3dOllamaUrl, "3D Ollama URL")
          : settings.model3dOllamaUrl,
        lmStudioBaseUrl: typeof body.model3dLmStudioBaseUrl === "string"
          ? normalizeOptionalHttpUrl(body.model3dLmStudioBaseUrl, "3D LM Studio Base URL")
          : settings.model3dLmStudioBaseUrl,
        lmStudioApiKey: submittedModel3dLmStudioApiKey || settings.model3dLmStudioApiKey,
        textModel: typeof body.model3dLlmTextModel === "string"
          ? body.model3dLlmTextModel
          : settings.model3dLlmTextModel,
        visionModel: typeof body.model3dLlmVisionModel === "string"
          ? body.model3dLlmVisionModel
          : settings.model3dLlmVisionModel
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      sendJson(response, 400, { error: detail });
      return;
    }
  }
  if ("stripMetadataWebUiImages" in body || "stripMetadataDiscordImages" in body) {
    settings = dependencies.runtimeState.updateImageMetadataStripSettings({
      stripMetadataWebUiImages: typeof body.stripMetadataWebUiImages === "boolean" ? body.stripMetadataWebUiImages : undefined,
      stripMetadataDiscordImages: typeof body.stripMetadataDiscordImages === "boolean" ? body.stripMetadataDiscordImages : undefined
    });
  }
  if (
    "messengerSharedSecretsPath" in body
    || "discordRuntimeAutostart" in body
    || "telegramRuntimeAutostart" in body
    || "matrixRuntimeAutostart" in body
    || "whatsappRuntimeAutostart" in body
  ) {
    settings = dependencies.runtimeState.updateMessengerRuntimeSettings({
      messengerSharedSecretsPath: typeof body.messengerSharedSecretsPath === "string" ? body.messengerSharedSecretsPath : undefined,
      discordRuntimeAutostart: typeof body.discordRuntimeAutostart === "boolean" ? body.discordRuntimeAutostart : undefined,
      telegramRuntimeAutostart: typeof body.telegramRuntimeAutostart === "boolean" ? body.telegramRuntimeAutostart : undefined,
      matrixRuntimeAutostart: typeof body.matrixRuntimeAutostart === "boolean" ? body.matrixRuntimeAutostart : undefined,
      whatsappRuntimeAutostart: typeof body.whatsappRuntimeAutostart === "boolean" ? body.whatsappRuntimeAutostart : undefined
    });
  }
  if ("ollamaTextModel" in body || "ollamaVisionModel" in body || "ollamaTextModelIsVisual" in body || "unloadLlmBeforeModel3dGeneration" in body || "model3dGenerationTarget" in body || "model3dMetadataTarget" in body) {
    const useTextModelAsVisual = typeof body.ollamaTextModelIsVisual === "boolean"
      ? body.ollamaTextModelIsVisual
      : settings.ollamaTextModelIsVisual;
    const unloadBeforeModel3dGeneration = typeof body.unloadLlmBeforeModel3dGeneration === "boolean"
      ? body.unloadLlmBeforeModel3dGeneration
      : settings.unloadLlmBeforeModel3dGeneration;
    const model3dGenerationTarget = body.model3dGenerationTarget === "remote" ? "remote" : body.model3dGenerationTarget === "local" ? "local" : settings.model3dGenerationTarget;
    const model3dMetadataTarget = body.model3dMetadataTarget === "remote" ? "remote" : body.model3dMetadataTarget === "local" ? "local" : settings.model3dMetadataTarget;
    const activeModels = dependencies.setActiveOllamaModels({
      textModel: typeof body.ollamaTextModel === "string" ? body.ollamaTextModel : undefined,
      visionModel: useTextModelAsVisual
        ? (typeof body.ollamaTextModel === "string" ? body.ollamaTextModel : undefined)
        : (typeof body.ollamaVisionModel === "string" ? body.ollamaVisionModel : undefined)
    });
    settings = dependencies.runtimeState.updateOllamaModels({
      ollamaTextModel: activeModels.textModel,
      ollamaVisionModel: activeModels.visionModel,
      ollamaTextModelIsVisual: useTextModelAsVisual,
      unloadLlmBeforeModel3dGeneration: unloadBeforeModel3dGeneration,
      model3dGenerationTarget,
      model3dMetadataTarget
    });
  }
  if (
    "comfyUiBaseUrl" in body
    || "comfyUiModelBaseUrl" in body
    || "comfyUiImageBaseUrl" in body
    || "comfyUiAudioBaseUrl" in body
    || "comfyUiMusicBaseUrl" in body
    || "comfyUiVideoBaseUrl" in body
    || "comfyUiInputDir" in body
    || "comfyUiModelWorkflowPath" in body
    || "comfyUiImageWorkflowPath" in body
    || "comfyUiImageEditWorkflowPath" in body
    || "comfyUiImageLayeredWorkflowPath" in body
    || "comfyUiAudioWorkflowPath" in body
    || "comfyUiMusicWorkflowPath" in body
    || "comfyUiVideoWorkflowPath" in body
    || "comfyUiVideoImageWorkflowPath" in body
  ) {
    settings = dependencies.runtimeState.updateComfyUiSettings({
      comfyUiBaseUrl: typeof body.comfyUiBaseUrl === "string" ? body.comfyUiBaseUrl : undefined,
      comfyUiModelBaseUrl: typeof body.comfyUiModelBaseUrl === "string" ? body.comfyUiModelBaseUrl : undefined,
      comfyUiImageBaseUrl: typeof body.comfyUiImageBaseUrl === "string" ? body.comfyUiImageBaseUrl : undefined,
      comfyUiAudioBaseUrl: typeof body.comfyUiAudioBaseUrl === "string" ? body.comfyUiAudioBaseUrl : undefined,
      comfyUiMusicBaseUrl: typeof body.comfyUiMusicBaseUrl === "string" ? body.comfyUiMusicBaseUrl : undefined,
      comfyUiVideoBaseUrl: typeof body.comfyUiVideoBaseUrl === "string" ? body.comfyUiVideoBaseUrl : undefined,
      comfyUiInputDir: typeof body.comfyUiInputDir === "string" ? body.comfyUiInputDir : undefined,
      comfyUiModelWorkflowPath: typeof body.comfyUiModelWorkflowPath === "string" ? body.comfyUiModelWorkflowPath : undefined,
      comfyUiImageWorkflowPath: typeof body.comfyUiImageWorkflowPath === "string" ? body.comfyUiImageWorkflowPath : undefined,
      comfyUiImageEditWorkflowPath: typeof body.comfyUiImageEditWorkflowPath === "string" ? body.comfyUiImageEditWorkflowPath : undefined,
      comfyUiImageLayeredWorkflowPath: typeof body.comfyUiImageLayeredWorkflowPath === "string" ? body.comfyUiImageLayeredWorkflowPath : undefined,
      comfyUiAudioWorkflowPath: typeof body.comfyUiAudioWorkflowPath === "string" ? body.comfyUiAudioWorkflowPath : undefined,
      comfyUiMusicWorkflowPath: typeof body.comfyUiMusicWorkflowPath === "string" ? body.comfyUiMusicWorkflowPath : undefined,
      comfyUiVideoWorkflowPath: typeof body.comfyUiVideoWorkflowPath === "string" ? body.comfyUiVideoWorkflowPath : undefined,
      comfyUiVideoImageWorkflowPath: typeof body.comfyUiVideoImageWorkflowPath === "string" ? body.comfyUiVideoImageWorkflowPath : undefined
    });
    updateComfyRuntimeSettings({
      comfyUiBaseUrl: settings.comfyUiBaseUrl,
      comfyUiModelBaseUrl: settings.comfyUiModelBaseUrl,
      comfyUiImageBaseUrl: settings.comfyUiImageBaseUrl,
      comfyUiAudioBaseUrl: settings.comfyUiAudioBaseUrl,
      comfyUiMusicBaseUrl: settings.comfyUiMusicBaseUrl,
      comfyUiVideoBaseUrl: settings.comfyUiVideoBaseUrl,
      comfyUiInputDir: settings.comfyUiInputDir,
      comfyUiModelWorkflowPath: settings.comfyUiModelWorkflowPath,
      comfyUiImageWorkflowPath: settings.comfyUiImageWorkflowPath,
      comfyUiImageEditWorkflowPath: settings.comfyUiImageEditWorkflowPath,
      comfyUiImageLayeredWorkflowPath: settings.comfyUiImageLayeredWorkflowPath,
      comfyUiAudioWorkflowPath: settings.comfyUiAudioWorkflowPath,
      comfyUiMusicWorkflowPath: settings.comfyUiMusicWorkflowPath,
      comfyUiVideoWorkflowPath: settings.comfyUiVideoWorkflowPath,
      comfyUiVideoImageWorkflowPath: settings.comfyUiVideoImageWorkflowPath
    });
    if (appConfig.remoteWorkerBaseUrl.trim().length > 0) {
      try {
        await syncComfySettingsViaRemoteWorker({
          comfyUiBaseUrl: settings.comfyUiBaseUrl,
          comfyUiModelBaseUrl: settings.comfyUiModelBaseUrl,
          comfyUiImageBaseUrl: settings.comfyUiImageBaseUrl,
          comfyUiAudioBaseUrl: settings.comfyUiAudioBaseUrl,
          comfyUiMusicBaseUrl: settings.comfyUiMusicBaseUrl,
          comfyUiVideoBaseUrl: settings.comfyUiVideoBaseUrl,
          comfyUiInputDir: settings.comfyUiInputDir,
          comfyUiModelWorkflowPath: settings.comfyUiModelWorkflowPath,
          comfyUiImageWorkflowPath: settings.comfyUiImageWorkflowPath,
          comfyUiImageEditWorkflowPath: settings.comfyUiImageEditWorkflowPath,
          comfyUiImageLayeredWorkflowPath: settings.comfyUiImageLayeredWorkflowPath,
          comfyUiAudioWorkflowPath: settings.comfyUiAudioWorkflowPath,
          comfyUiMusicWorkflowPath: settings.comfyUiMusicWorkflowPath,
          comfyUiVideoWorkflowPath: settings.comfyUiVideoWorkflowPath,
          comfyUiVideoImageWorkflowPath: settings.comfyUiVideoImageWorkflowPath
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.warn("Failed to sync Comfy settings to remote worker.", detail);
        dependencies.runtimeState.recordAction("dashboard:comfy-remote-sync-error", detail);
      }
    }
  }
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  if (
    "antiSpamEnabled" in body
    || "antiSpamDuplicateWindowMs" in body
    || "antiSpamTimeoutMs" in body
    || "antiSpamApplyTimeouts" in body
    || "antiSpamAnalyzeImages" in body
    || "antiSpamTemporaryInvestigationHoldEnabled" in body
    || "antiSpamTemporaryInvestigationHoldMs" in body
    || "antiSpamImageScanChannelIds" in body
    || "antiSpamImageScanChannelId" in body
    || "antiSpamExcludedChannelIds" in body
    || "antiSpamExcludedRoleIds" in body
    || "antiSpamAlertChannelId" in body
    || "antiSpamTextRulePatterns" in body
    || "antiSpamBlockedLinkPatterns" in body
    || "antiSpamImageFlagSpam" in body
    || "antiSpamImageFlagNsfw" in body
    || "antiSpamImageFlagCryptoSpam" in body
    || "antiSpamImageFlagCryptoImage" in body
    || "honeypotEnabled" in body
    || "honeypotChannelId" in body
    || "honeypotTriggerOnText" in body
    || "honeypotTriggerOnFiles" in body
    || "honeypotTriggerOnLinks" in body
    || "honeypotImmediateAction" in body
    || "honeypotTimeoutMs" in body
    || "honeypotRemoveMessage" in body
    || "protectedUserIds" in body
    || "protectedRoleIds" in body
    || "honeypotExcludedChannelIds" in body
    || "honeypotExcludedRoleIds" in body
    || "honeypotBackupChannelId" in body
    || "honeypotDmEnabled" in body
    || "honeypotDmMessage" in body
    || "honeypotReviewChannelId" in body
    || "honeypotPostVerifyAction" in body
    || "honeypotVerificationWindowMs" in body
    || "honeypotUnverifiedAction" in body
  ) {
    if (!guildId) {
      sendJson(response, 400, { error: "guildId is required for guild moderation settings." });
      return;
    }
    const guildSettings = dependencies.runtimeState.updateGuildDashboardSettings(guildId, {
      antiSpamEnabled: typeof body.antiSpamEnabled === "boolean" ? body.antiSpamEnabled : undefined,
      antiSpamDuplicateWindowMs: typeof body.antiSpamDuplicateWindowMs === "number" ? body.antiSpamDuplicateWindowMs : undefined,
      antiSpamTimeoutMs: typeof body.antiSpamTimeoutMs === "number" ? body.antiSpamTimeoutMs : undefined,
      antiSpamApplyTimeouts: typeof body.antiSpamApplyTimeouts === "boolean" ? body.antiSpamApplyTimeouts : undefined,
      antiSpamAnalyzeImages: typeof body.antiSpamAnalyzeImages === "boolean" ? body.antiSpamAnalyzeImages : undefined,
      antiSpamTemporaryInvestigationHoldEnabled: typeof body.antiSpamTemporaryInvestigationHoldEnabled === "boolean"
        ? body.antiSpamTemporaryInvestigationHoldEnabled
        : undefined,
      antiSpamTemporaryInvestigationHoldMs: typeof body.antiSpamTemporaryInvestigationHoldMs === "number"
        ? body.antiSpamTemporaryInvestigationHoldMs
        : undefined,
      antiSpamImageScanChannelIds: Array.isArray(body.antiSpamImageScanChannelIds)
        ? body.antiSpamImageScanChannelIds.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      antiSpamImageScanChannelId: typeof body.antiSpamImageScanChannelId === "string"
        ? body.antiSpamImageScanChannelId
        : body.antiSpamImageScanChannelId === null
          ? null
          : undefined,
      antiSpamExcludedChannelIds: Array.isArray(body.antiSpamExcludedChannelIds)
        ? body.antiSpamExcludedChannelIds.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      antiSpamExcludedRoleIds: Array.isArray(body.antiSpamExcludedRoleIds)
        ? body.antiSpamExcludedRoleIds.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      antiSpamAlertChannelId: typeof body.antiSpamAlertChannelId === "string"
        ? body.antiSpamAlertChannelId
        : body.antiSpamAlertChannelId === null
          ? null
          : undefined,
      antiSpamTextRulePatterns: Array.isArray(body.antiSpamTextRulePatterns)
        ? body.antiSpamTextRulePatterns.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      antiSpamBlockedLinkPatterns: Array.isArray(body.antiSpamBlockedLinkPatterns)
        ? body.antiSpamBlockedLinkPatterns.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      antiSpamImageFlagSpam: typeof body.antiSpamImageFlagSpam === "boolean" ? body.antiSpamImageFlagSpam : undefined,
      antiSpamImageFlagNsfw: typeof body.antiSpamImageFlagNsfw === "boolean" ? body.antiSpamImageFlagNsfw : undefined,
      antiSpamImageFlagCryptoSpam: typeof body.antiSpamImageFlagCryptoSpam === "boolean" ? body.antiSpamImageFlagCryptoSpam : undefined,
      antiSpamImageFlagCryptoImage: typeof body.antiSpamImageFlagCryptoImage === "boolean" ? body.antiSpamImageFlagCryptoImage : undefined,
      honeypotEnabled: typeof body.honeypotEnabled === "boolean" ? body.honeypotEnabled : undefined,
      honeypotChannelId: typeof body.honeypotChannelId === "string"
        ? body.honeypotChannelId
        : body.honeypotChannelId === null
          ? null
          : undefined,
      honeypotTriggerOnText: typeof body.honeypotTriggerOnText === "boolean" ? body.honeypotTriggerOnText : undefined,
      honeypotTriggerOnFiles: typeof body.honeypotTriggerOnFiles === "boolean" ? body.honeypotTriggerOnFiles : undefined,
      honeypotTriggerOnLinks: typeof body.honeypotTriggerOnLinks === "boolean" ? body.honeypotTriggerOnLinks : undefined,
      honeypotImmediateAction: body.honeypotImmediateAction === "kick" || body.honeypotImmediateAction === "ban" || body.honeypotImmediateAction === "timeout"
        ? body.honeypotImmediateAction
        : undefined,
      honeypotTimeoutMs: typeof body.honeypotTimeoutMs === "number" ? body.honeypotTimeoutMs : undefined,
      honeypotRemoveMessage: typeof body.honeypotRemoveMessage === "boolean" ? body.honeypotRemoveMessage : undefined,
      protectedUserIds: Array.isArray(body.protectedUserIds)
        ? body.protectedUserIds.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      protectedRoleIds: Array.isArray(body.protectedRoleIds)
        ? body.protectedRoleIds.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      honeypotExcludedChannelIds: Array.isArray(body.honeypotExcludedChannelIds)
        ? body.honeypotExcludedChannelIds.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      honeypotExcludedRoleIds: Array.isArray(body.honeypotExcludedRoleIds)
        ? body.honeypotExcludedRoleIds.filter((entry): entry is string => typeof entry === "string")
        : undefined,
      honeypotBackupChannelId: typeof body.honeypotBackupChannelId === "string"
        ? body.honeypotBackupChannelId
        : body.honeypotBackupChannelId === null
          ? null
          : undefined,
      honeypotDmEnabled: typeof body.honeypotDmEnabled === "boolean" ? body.honeypotDmEnabled : undefined,
      honeypotDmMessage: typeof body.honeypotDmMessage === "string" ? body.honeypotDmMessage : undefined,
      honeypotReviewChannelId: typeof body.honeypotReviewChannelId === "string"
        ? body.honeypotReviewChannelId
        : body.honeypotReviewChannelId === null
          ? null
          : undefined,
      honeypotPostVerifyAction: body.honeypotPostVerifyAction === "remove-timeout" || body.honeypotPostVerifyAction === "unban" || body.honeypotPostVerifyAction === "none"
        ? body.honeypotPostVerifyAction
        : undefined,
      honeypotVerificationWindowMs: typeof body.honeypotVerificationWindowMs === "number" ? body.honeypotVerificationWindowMs : undefined,
      honeypotUnverifiedAction: body.honeypotUnverifiedAction === "kick" || body.honeypotUnverifiedAction === "ban" || body.honeypotUnverifiedAction === "none"
        ? body.honeypotUnverifiedAction
        : undefined
    });
    dependencies.runtimeState.recordAction(
      "dashboard:guild-moderation-settings",
      `guild=${guildId} antiSpam=${guildSettings.antiSpamEnabled} window=${guildSettings.antiSpamDuplicateWindowMs} timeout=${guildSettings.antiSpamTimeoutMs} honeypot=${guildSettings.honeypotEnabled} honeypotChannel=${guildSettings.honeypotChannelId ?? "none"} honeypotAction=${guildSettings.honeypotImmediateAction} honeypotReview=${guildSettings.honeypotReviewChannelId ?? "none"} tempHold=${guildSettings.antiSpamTemporaryInvestigationHoldEnabled}:${guildSettings.antiSpamTemporaryInvestigationHoldMs} imageChannels=${guildSettings.antiSpamImageScanChannelIds.length} excludedChannels=${guildSettings.antiSpamExcludedChannelIds.length} excludedRoles=${guildSettings.antiSpamExcludedRoleIds.length} alertChannel=${guildSettings.antiSpamAlertChannelId ?? "none"} regex=${guildSettings.antiSpamTextRulePatterns.length} links=${guildSettings.antiSpamBlockedLinkPatterns.length}`
    );
    await dependencies.saveDashboardSettings(dependencies.runtimeState.getStoredDashboardSettings());
    sendJson(response, 200, {
      globalSettings: redactGlobalSettingsForResponse(settings),
      guildSettings
    });
    return;
  }
  dependencies.runtimeState.recordAction(
    "dashboard:settings",
    `provider=${settings.llmProvider} ollamaUrl=${settings.ollamaUrl} lmStudioBase=${settings.lmStudioBaseUrl} lmStudioCtx=${settings.lmStudioContextLength} lmStudioReasoning=${settings.lmStudioTextModelReasoningEnabled} imageProvider=${settings.imageLlmProvider} imageOllamaUrl=${settings.imageOllamaUrl || "default"} model3dProvider=${settings.model3dLlmProvider} model3dOllamaUrl=${settings.model3dOllamaUrl || "default"} model3dLmStudioBase=${settings.model3dLmStudioBaseUrl || "default"} ffmpeg=${settings.ffmpegExecutablePath || "auto"} confirm=${settings.requireConfirmationForLlmSend} stripWebUi=${settings.stripMetadataWebUiImages} stripDiscord=${settings.stripMetadataDiscordImages} textModel=${settings.ollamaTextModel} visionModel=${settings.ollamaVisionModel} textVisual=${settings.ollamaTextModelIsVisual} unloadBefore3d=${settings.unloadLlmBeforeModel3dGeneration} model3dTarget=${settings.model3dGenerationTarget} metadataTarget=${settings.model3dMetadataTarget} comfyDefault=${settings.comfyUiBaseUrl} comfy3d=${settings.comfyUiModelBaseUrl} comfyImage=${settings.comfyUiImageBaseUrl} comfyAudio=${settings.comfyUiAudioBaseUrl} comfyMusic=${settings.comfyUiMusicBaseUrl} comfyVideo=${settings.comfyUiVideoBaseUrl} imageWorkflow=${settings.comfyUiImageWorkflowPath} imageEditWorkflow=${settings.comfyUiImageEditWorkflowPath} imageLayeredWorkflow=${settings.comfyUiImageLayeredWorkflowPath} videoWorkflow=${settings.comfyUiVideoWorkflowPath}`
  );
  await dependencies.saveDashboardSettings(dependencies.runtimeState.getStoredDashboardSettings());
  sendJson(response, 200, redactGlobalSettingsForResponse(settings));
  return;
}

async function handlePostApiGuildSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  const settings = await dependencies.saveGuildSettings(guildId, {
    welcomeEnabled: typeof body.welcomeEnabled === "boolean" ? body.welcomeEnabled : undefined,
    welcomeChannelId: typeof body.welcomeChannelId === "string" ? body.welcomeChannelId.trim() || null : undefined,
    welcomeMessage: typeof body.welcomeMessage === "string" ? body.welcomeMessage : undefined,
    investigationRoleId: typeof body.investigationRoleId === "string"
      ? body.investigationRoleId.trim() || null
      : body.investigationRoleId === null
        ? null
        : undefined,
    temporaryImageBlockRoleId: typeof body.temporaryImageBlockRoleId === "string"
      ? body.temporaryImageBlockRoleId.trim() || null
      : body.temporaryImageBlockRoleId === null
        ? null
        : undefined,
    memberCounterChannelId: typeof body.memberCounterChannelId === "string"
      ? body.memberCounterChannelId.trim() || null
      : body.memberCounterChannelId === null
        ? null
        : undefined,
    memberCounterTemplate: typeof body.memberCounterTemplate === "string"
      ? body.memberCounterTemplate
      : undefined,
    botMode: body.botMode === "act-on-user-behalf" || body.botMode === "act-on-itself" || body.botMode === "normal"
      ? body.botMode
      : undefined,
    botActingPreset: body.botActingPreset === "mod" || body.botActingPreset === "admin" || body.botActingPreset === "user"
      ? body.botActingPreset
      : undefined,
    botSafetyRequireMentionOrReply: typeof body.botSafetyRequireMentionOrReply === "boolean"
      ? body.botSafetyRequireMentionOrReply
      : undefined,
    botSafetySuggestOnly: typeof body.botSafetySuggestOnly === "boolean"
      ? body.botSafetySuggestOnly
      : undefined,
    botSafetyAllowChatSelfTasks: typeof body.botSafetyAllowChatSelfTasks === "boolean"
      ? body.botSafetyAllowChatSelfTasks
      : undefined,
    botSafetyChatSelfTasksAdminOnly: typeof body.botSafetyChatSelfTasksAdminOnly === "boolean"
      ? body.botSafetyChatSelfTasksAdminOnly
      : undefined,
    botSafetyChatSelfTaskMinConfidence: typeof body.botSafetyChatSelfTaskMinConfidence === "number"
      ? body.botSafetyChatSelfTaskMinConfidence
      : undefined,
    botSafetyAllowRoleSuggestions: typeof body.botSafetyAllowRoleSuggestions === "boolean"
      ? body.botSafetyAllowRoleSuggestions
      : undefined,
    botSafetyAllowChannelSuggestions: typeof body.botSafetyAllowChannelSuggestions === "boolean"
      ? body.botSafetyAllowChannelSuggestions
      : undefined,
    botSafetyAllowPromotionSuggestions: typeof body.botSafetyAllowPromotionSuggestions === "boolean"
      ? body.botSafetyAllowPromotionSuggestions
      : undefined,
    autonomousStatusChannelId: typeof body.autonomousStatusChannelId === "string"
      ? body.autonomousStatusChannelId.trim() || null
      : body.autonomousStatusChannelId === null
        ? null
        : undefined,
    autonomousHeartbeatEnabled: typeof body.autonomousHeartbeatEnabled === "boolean"
      ? body.autonomousHeartbeatEnabled
      : undefined,
    autonomousHeartbeatMinutes: typeof body.autonomousHeartbeatMinutes === "number"
      ? body.autonomousHeartbeatMinutes
      : undefined,
    autonomousReplyToMentions: typeof body.autonomousReplyToMentions === "boolean"
      ? body.autonomousReplyToMentions
      : undefined,
    imagePoolVerifiedRoleIds: Array.isArray(body.imagePoolVerifiedRoleIds)
      ? body.imagePoolVerifiedRoleIds.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    imagePoolVerifiedUserIds: Array.isArray(body.imagePoolVerifiedUserIds)
      ? body.imagePoolVerifiedUserIds.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    selfTaskDryRunOnly: typeof body.selfTaskDryRunOnly === "boolean"
      ? body.selfTaskDryRunOnly
      : undefined,
    selfTaskAllowedActionTypes: Array.isArray(body.selfTaskAllowedActionTypes)
      ? body.selfTaskAllowedActionTypes.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    mediaReactionRules: Array.isArray(body.mediaReactionRules)
      ? body.mediaReactionRules as DashboardGuildSettings["mediaReactionRules"]
      : undefined,
    chatModeChannels: typeof body.chatModeChannels === "object" && body.chatModeChannels !== null
      ? body.chatModeChannels as DashboardGuildSettings["chatModeChannels"]
      : undefined
  });
  dependencies.runtimeState.recordAction("dashboard:guild-settings", `Saved guild bot settings for ${guildId}.`);
  sendJson(response, 200, settings);
  return;
}

async function handlePostApiCommandSettingsGlobal(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const commandNames = Array.isArray(body.commandNames)
    ? body.commandNames.filter((entry): entry is string => typeof entry === "string")
    : [];
  const settings = await dependencies.saveGlobalCommandSettings(commandNames);
  dependencies.runtimeState.recordAction("dashboard:commands-global", `Saved ${settings.globalEnabledCommands.length} global command(s).`);
  sendJson(response, 200, settings);
  return;
}

async function handlePostApiCommandSettingsGuild(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  const settings = await dependencies.saveGuildCommandSettings(guildId, {
    guildEnabledCommands: Array.isArray(body.guildEnabledCommands)
      ? body.guildEnabledCommands.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    guildDisabledInheritedCommands: Array.isArray(body.guildDisabledInheritedCommands)
      ? body.guildDisabledInheritedCommands.filter((entry): entry is string => typeof entry === "string")
      : undefined
  });
  dependencies.runtimeState.recordAction("dashboard:commands-guild", `Saved command overrides for ${guildId}.`);
  sendJson(response, 200, settings);
  return;
}

async function handlePostApiCommandSyncGlobal(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const result = await dependencies.syncGlobalCommands();
  dependencies.runtimeState.recordAction("dashboard:commands-sync-global", `Synced ${result.syncedCount} global command(s).`);
  sendJson(response, 200, result);
  return;
}

async function handlePostApiCommandSyncGuild(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  const result = await dependencies.syncGuildCommands(guildId);
  dependencies.runtimeState.recordAction("dashboard:commands-sync-guild", `Synced ${result.syncedCount} guild command(s) for ${guildId}.`);
  sendJson(response, 200, result);
  return;
}

async function handlePostApiRolesCreateInvestigation(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const roleName = typeof body.roleName === "string" ? body.roleName.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  const role = await dependencies.createInvestigationRole(guildId, roleName || undefined);
  dependencies.runtimeState.recordAction("dashboard:role-create-investigation", `Created investigation role ${role.id} in ${guildId}.`);
  sendJson(response, 200, role);
  return;
}

async function handlePostApiRolesCreateTempBlock(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const roleName = typeof body.roleName === "string" ? body.roleName.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  const role = await dependencies.createTemporaryImageBlockRole(guildId, roleName || undefined);
  dependencies.runtimeState.recordAction("dashboard:role-create-temp-block", `Created temp image block role ${role.id} in ${guildId}.`);
  sendJson(response, 200, role);
  return;
}

async function handlePostApiMemberCounterRefresh(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  await dependencies.refreshMemberCounter(guildId);
  dependencies.runtimeState.recordAction("dashboard:member-counter-refresh", `Refreshed member counter for ${guildId}.`);
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiChannelSettings(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!guildId || !channelId) {
    sendJson(response, 400, { error: "guildId and channelId are required." });
    return;
  }
  const settings = await dependencies.saveChannelSettings(guildId, channelId, {
    name: typeof body.name === "string" ? body.name : undefined,
    topic: typeof body.topic === "string" ? body.topic : undefined,
    nsfw: typeof body.nsfw === "boolean" ? body.nsfw : undefined,
    slowmodeSeconds: typeof body.slowmodeSeconds === "number" ? body.slowmodeSeconds : undefined,
    defaultAutoArchiveDuration: typeof body.defaultAutoArchiveDuration === "number" ? body.defaultAutoArchiveDuration : undefined,
    parentId: typeof body.parentId === "string"
      ? body.parentId
      : body.parentId === null
        ? null
        : undefined
  });
  sendJson(response, 200, settings);
  return;
}

async function handlePostApiChannelsReorder(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const kind = body.kind;
  const position = typeof body.position === "number" ? body.position : NaN;
  if (!guildId || !channelId || !["channel", "category"].includes(String(kind)) || Number.isNaN(position)) {
    sendJson(response, 400, { error: "guildId, channelId, kind, and position are required." });
    return;
  }
  await dependencies.reorderGuildChannel(guildId, {
    kind: kind as "channel" | "category",
    channelId,
    parentId: typeof body.parentId === "string"
      ? body.parentId.trim() || null
      : body.parentId === null
        ? null
        : undefined,
    position
  });
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiChannelsCreate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type;
  if (!guildId || !name || !["category", "text", "announcement", "voice"].includes(String(type))) {
    sendJson(response, 400, { error: "guildId, name, and a valid type are required." });
    return;
  }
  const created = await dependencies.createGuildChannel(guildId, {
    name,
    type: type as "category" | "text" | "announcement" | "voice",
    topic: typeof body.topic === "string" ? body.topic : undefined,
    parentId: typeof body.parentId === "string"
      ? body.parentId.trim() || null
      : body.parentId === null
        ? null
        : undefined
  });
  sendJson(response, 200, created);
  return;
}

async function handlePostApiThreadsCreate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const starterMessage = typeof body.starterMessage === "string" ? body.starterMessage : "";
  if (!guildId || !channelId || !name || !starterMessage.trim()) {
    sendJson(response, 400, { error: "guildId, channelId, name, and starterMessage are required." });
    return;
  }
  const created = await dependencies.createThread(guildId, {
    channelId,
    name,
    starterMessage,
    autoArchiveDuration: typeof body.autoArchiveDuration === "number" ? body.autoArchiveDuration : undefined
  });
  sendJson(response, 200, created);
  return;
}

async function handlePostApiPostsCreate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!guildId || !channelId || !content.trim()) {
    sendJson(response, 400, { error: "guildId, channelId, and content are required." });
    return;
  }
  const created = await dependencies.createPost(guildId, {
    channelId,
    title: typeof body.title === "string" ? body.title : undefined,
    content
  });
  sendJson(response, 200, created);
  return;
}

async function handlePostApiGuildInvitesCreate(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!guildId || !channelId) {
    sendJson(response, 400, { error: "guildId and channelId are required." });
    return;
  }
  const invite = await dependencies.createGuildInvite(guildId, {
    channelId,
    maxAgeSeconds: typeof body.maxAgeSeconds === "number" ? body.maxAgeSeconds : undefined,
    maxUses: typeof body.maxUses === "number" ? body.maxUses : undefined,
    temporary: typeof body.temporary === "boolean" ? body.temporary : undefined,
    unique: typeof body.unique === "boolean" ? body.unique : undefined
  });
  sendJson(response, 200, invite);
  return;
}

async function handlePostApiGuildInvitesReplace(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!guildId || !code || !channelId) {
    sendJson(response, 400, { error: "guildId, code, and channelId are required." });
    return;
  }
  const invite = await dependencies.replaceGuildInvite(guildId, code, {
    channelId,
    maxAgeSeconds: typeof body.maxAgeSeconds === "number" ? body.maxAgeSeconds : undefined,
    maxUses: typeof body.maxUses === "number" ? body.maxUses : undefined,
    temporary: typeof body.temporary === "boolean" ? body.temporary : undefined,
    unique: typeof body.unique === "boolean" ? body.unique : undefined
  });
  sendJson(response, 200, invite);
  return;
}

async function handlePostApiGuildInvitesDelete(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!guildId || !code) {
    sendJson(response, 400, { error: "guildId and code are required." });
    return;
  }
  const deleted = await dependencies.deleteGuildInvite(guildId, code);
  sendJson(response, 200, { deleted });
  return;
}

async function handlePostApiGuildAiPlanChannels(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!guildId || !prompt) {
    sendJson(response, 400, { error: "guildId and prompt are required." });
    return;
  }
  const plan = await dependencies.planGuildChannels(guildId, prompt);
  sendJson(response, 200, plan);
  return;
}

async function handlePostApiGuildAiApplyChannelPlan(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const plan = body.plan;
  if (!guildId || !plan || typeof plan !== "object") {
    sendJson(response, 400, { error: "guildId and plan are required." });
    return;
  }
  const result = await dependencies.applyGuildChannelPlan(guildId, plan as Parameters<typeof dependencies.applyGuildChannelPlan>[1]);
  sendJson(response, 200, result);
  return;
}

async function handlePostApiGuildAiAudit(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!guildId) {
    sendJson(response, 400, { error: "guildId is required." });
    return;
  }
  const result = await dependencies.auditGuildWithLlm(guildId, prompt);
  sendJson(response, 200, { result });
  return;
}

async function handlePostApiRolesAssign(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const roleId = typeof body.roleId === "string" ? body.roleId.trim() : "";
  if (!guildId || !userId || !roleId) {
    sendJson(response, 400, { error: "guildId, userId, and roleId are required." });
    return;
  }
  await dependencies.assignRoleToUser(guildId, userId, roleId);
  dependencies.runtimeState.recordAction("dashboard:role-assign", `Assigned role ${roleId} to ${userId} in ${guildId}.`);
  sendJson(response, 200, { ok: true });
  return;
}

async function handlePostApiRolesRemove(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const roleId = typeof body.roleId === "string" ? body.roleId.trim() : "";
  if (!guildId || !userId || !roleId) {
    sendJson(response, 400, { error: "guildId, userId, and roleId are required." });
    return;
  }
  await dependencies.removeRoleFromUser(guildId, userId, roleId);
  dependencies.runtimeState.recordAction("dashboard:role-remove", `Removed role ${roleId} from ${userId} in ${guildId}.`);
  sendJson(response, 200, { ok: true });
  return;
}

const dashboardSettingsAndGuildRouteTable = createDashboardRouteTable([
  getRoute("/api/guild-dashboard-settings", handleGetApiGuildDashboardSettings),
  postRoute("/api/settings", handlePostApiSettings),
  postRoute("/api/guild-settings", handlePostApiGuildSettings),
  postRoute("/api/command-settings/global", handlePostApiCommandSettingsGlobal),
  postRoute("/api/command-settings/guild", handlePostApiCommandSettingsGuild),
  postRoute("/api/command-sync/global", handlePostApiCommandSyncGlobal),
  postRoute("/api/command-sync/guild", handlePostApiCommandSyncGuild),
  postRoute("/api/roles/create-investigation", handlePostApiRolesCreateInvestigation),
  postRoute("/api/roles/create-temp-block", handlePostApiRolesCreateTempBlock),
  postRoute("/api/member-counter/refresh", handlePostApiMemberCounterRefresh),
  postRoute("/api/channel-settings", handlePostApiChannelSettings),
  postRoute("/api/channels/reorder", handlePostApiChannelsReorder),
  postRoute("/api/channels/create", handlePostApiChannelsCreate),
  postRoute("/api/threads/create", handlePostApiThreadsCreate),
  postRoute("/api/posts/create", handlePostApiPostsCreate),
  postRoute("/api/guild-invites/create", handlePostApiGuildInvitesCreate),
  postRoute("/api/guild-invites/replace", handlePostApiGuildInvitesReplace),
  postRoute("/api/guild-invites/delete", handlePostApiGuildInvitesDelete),
  postRoute("/api/guild-ai/plan-channels", handlePostApiGuildAiPlanChannels),
  postRoute("/api/guild-ai/apply-channel-plan", handlePostApiGuildAiApplyChannelPlan),
  postRoute("/api/guild-ai/audit", handlePostApiGuildAiAudit),
  postRoute("/api/roles/assign", handlePostApiRolesAssign),
  postRoute("/api/roles/remove", handlePostApiRolesRemove)
]);

export async function handleDashboardSettingsAndGuildRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: DashboardDependencies
): Promise<boolean>{
  return dispatchDashboardRoute(dashboardSettingsAndGuildRouteTable, {
    request,
    response,
    url,
    dependencies
  });
}
