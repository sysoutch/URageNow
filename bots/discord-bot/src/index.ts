import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Colors,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  OAuth2Scopes,
  Partials,
  PermissionsBitField,
  PermissionFlagsBits,
  REST,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { readFile } from "node:fs/promises";
import { handleHelpCommand } from "./commands/help.js";
import { appConfig } from "@urage/server/config/appConfig";
import { startDashboardServer } from "@urage/dashboard/server";
import type {
  DashboardGuildChannelPlan
} from "@urage/shared/dashboard/types";
import { loadDashboardSettings, saveDashboardSettings } from "@urage/server/runtime/dashboardSettingsStore";
import {
  loadCommandSettings,
  saveCommandSettings,
  isCommandEnabledForGuild,
  type CommandSettings
} from "./services/commandSettingsStore.js";
import {
  followUpWithChunks,
  replyWithChunks,
  sendChunkedToTarget
} from "./services/discordMessageUtils.js";
import { createAutomationEngine, validateCronExpression } from "./services/automationEngine.js";
import {
  automationPresets,
  deleteJoinAutomation,
  deleteScheduledAutomation,
  listJoinAutomations,
  listScheduledAutomations,
  saveJoinAutomation,
  saveScheduledAutomation,
  type ImagePostProcessingOptions
} from "@urage/shared/automation/index";
import {
  listAutomationTextSources,
  readAutomationTextSourcePreview,
  saveAutomationTextSource,
  saveGeneratedAutomationText
} from "@urage/server/services/automationTextLibrary";
import {
  deleteGeneratedAudio,
  listGeneratedAudiosPublic,
  readGeneratedAudioFile,
  toGeneratedAudioPublicRecord
} from "@urage/server/services/audioGeneration";
import { comfyFreeMemory } from "@urage/server/services/model3d/comfyClient";
import { interruptComfyWorkflow } from "./services/comfyInterrupts.js";
import {
  applyGeneratedModelAutoRig,
  applyGeneratedModelAlbedoToGeometry,
  captureGeneratedModelArtifact,
  applyGeneratedModelMaterialFinish,
  applyGeneratedModelSeparateByLooseParts,
  deleteGeneratedModel,
  deleteGeneratedModelVariant,
  deriveRealWorldSizeTierFromDimensions,
  getGeneratedModelPublicById,
  indexGeneratedModelStoreWithRust,
  inspectGeneratedModelArtifact,
  importUploadedSourceModel,
  listGeneratedModelsPublic,
  parseRealWorldDimensionsText,
  previewGeneratedModelAutoRig,
  renameGeneratedLowPolyModelFileName,
  renameGeneratedModelFileName,
  updateGeneratedModelDescription,
  resolveGeneratedModelFilePath,
  readGeneratedModelFile,
  setGeneratedModelPreviewGif,
  setGeneratedModelPreviewImage,
  toGeneratedModelPublicRecord,
  validateGeneratedModelArtifact,
  type GeneratedModelPublicRecord,
  type RealWorldDimensions,
  type RealWorldSizeTier
} from "@urage/server/services/model3d";
import { probeGeneratedMediaAssetWithRust } from "@urage/server/services/mediaProbe";
import {
  buildLowPolyInteractionPayload,
  buildLowPolySizePickerComponents,
  getLowPolyTargetFaceCountForTier,
  parseLowPolyInteractionContext,
  parseLowPolyModalValue,
  parseLowPolySizeButtonValue,
  type LowPolyInteractionContext
} from "./services/lowPoly/interaction/lowPolyInteraction.js";
import { type LowPolyComplexityDecision } from "./services/lowPoly/decision/lowPolyComplexity.js";
import {
  classifyRealWorldSizeTierLocal,
  decideLowPolyByVisualComplexityLocal,
  suggestLowPolyByComplexityLocal as suggestLowPolyByComplexityLocalService
} from "./services/lowPoly/decision/lowPolyDecisionLocal.js";
import {
  buildImageDataUrl,
  buildModelSourceImageAttachment,
  contentTypeFromImageFileExtension,
  ensureVisualInterpretationForImage,
  getCachedVisualInterpretationPromptHint,
  normalizeModelDescriptionCandidate,
  normalizeModelNameCandidate,
  suggestModelFileNameAndDescription
} from "@urage/server/services/modelMetadataHelpers";
import { runModelPreviewRender } from "@urage/server/services/model3d/lowPolyModelService";
import {
  deleteGeneratedImage,
  getGeneratedImagePublicById,
  importGeneratedImageArtifact,
  listGeneratedImagesPublic,
  markGeneratedImageModelResult,
  renameGeneratedImageFileName,
  updateGeneratedImageDescription,
  readGeneratedImageFile,
  resolveGeneratedImageFilePath,
  toGeneratedImagePublicRecord,
  type GeneratedImageRecord,
  type GeneratedImagePublicRecord
} from "@urage/server/services/imageGeneration";
import { resolveGeneratedImageApiSourceToFilePath } from "@urage/server/services/internalGeneratedImageSource";
import { createBlenderOpenService } from "@urage/shared/runtime/blenderOpenService";
import { convertImageWithPixelArtTool } from "./services/pixelArtToolConverter.js";
import {
  deleteGeneratedVideo,
  generateVideoFromPrompt as generateVideoFromPromptLocal,
  listGeneratedVideosPublic,
  readGeneratedVideoFile,
  resolveGeneratedVideoFilePath,
  toGeneratedVideoPublicRecord
} from "@urage/server/services/videoGeneration";
import { convertVideoFileToGif, transformGifFrames } from "./services/automationGifProcessing.js";
import {
  generateSpeechToSpeech,
  generateTextToSpeech,
  transcribeSpeechToText
} from "./services/speechGeneration.js";
import {
  deleteImagePool,
  getImagePoolEntries,
  listImagePools,
  saveImagePool
} from "@urage/server/services/imagePoolStore";
import {
  applyModelMetallicWithExecution,
  applyModelScaleToHeightWithExecution,
  describeImageWithVision,
  generateAudioWithExecution,
  generateLowPolyModelWithExecution,
  generate3dModelWithExecution,
  generateImageWithExecution,
  generateMusicWithExecution,
  resolveImagePrompt,
  resolveImagePromptFromBaseImage,
  resolveModelPrompt,
  suggestImageDescription,
  suggestImageFileName
} from "@urage/server/services/generationFacade";
import {
  buildGeneratedAudioAttachment,
  buildGeneratedAudioEmbed,
  buildGeneratedImageAttachment,
  buildGeneratedImageEmbed,
  buildGeneratedMusicEmbed
} from "./services/mediaDiscordEmbeds.js";
import {
  applyAutoRigToModelViaRemoteWorker,
  generateSplitByLoosePartsModelViaRemoteWorker,
  generateLowPolyFromUploadedModelViaRemoteWorker,
  indexGeneratedModelAssetsViaRemoteWorker,
  inspectModelArtifactViaRemoteWorker,
  openAssetsInBlenderViaRemoteWorker,
  openImageInBlenderViaRemoteWorker,
  openModelInBlenderViaRemoteWorker,
  previewAutoRigForModelViaRemoteWorker,
  probeMediaAssetViaRemoteWorker,
  validateModelArtifactViaRemoteWorker
} from "@urage/server/services/remoteGenerationClient";
import { createModelPostService, type ModelPostMessageMode, type ModelPostOptions } from "./services/model3d/post/modelPostService.js";
import { buildModelPostSummaryExtraContent } from "./services/model3d/post/modelPostHelpers.js";
import {
  getGuildSettings,
  renderMemberCounterName,
  renderWelcomeMessage,
  updateGuildSettings
} from "./services/guildSettingsStore.js";
import {
  getCachedGuildFact,
  upsertCachedGuildFact
} from "./services/guildFactCacheStore.js";
import { createDiscordPermissionHelpers } from "./services/discordPermissionHelpers.js";
import { createGuildFactAndSafetyHelpers } from "./services/guildFactAndSafetyHelpers.js";
import { createCommandSyncService } from "./services/commandSyncService.js";
import { createDiscordTextOpsService } from "./services/discordTextOpsService.js";
import { createGuildChannelService } from "./services/guildChannelService.js";
import { createGuildRodPlanningService } from "./services/guildRodPlanningService.js";
import { createGuildMemberService } from "./services/guildMemberService.js";
import { createGuildVoiceService } from "./services/guildVoiceService.js";
import { createSelfTaskExecutionHelpers } from "./services/selfTask/runtime/selfTaskExecutionHelpers.js";
import { createSelfTaskBatchExecutionService } from "./services/selfTask/runtime/selfTaskBatchExecutionService.js";
import { createSelfTaskActionExecutorService } from "./services/selfTask/runtime/selfTaskActionExecutorService.js";
import { createSelfTaskPlanningService } from "./services/selfTask/runtime/selfTaskPlanningService.js";
import { createSelfTaskApprovalService } from "./services/selfTask/runtime/selfTaskApprovalService.js";
import { createModerationRestrictionService } from "./services/moderationRestrictionService.js";
import { createLowPolyReplyService } from "./services/model3d/post/lowPolyReplyService.js";
import { createGeneratedModelInteractionService } from "./services/model3d/post/generatedModelInteractionService.js";
import { createGuildFactAnswerService } from "./services/guild/facts/guildFactAnswerService.js";
import { createAutonomousHeartbeatService } from "./services/automation/runtime/autonomousHeartbeatService.js";
import { suggestModelMetallicDecision, type ModelMetallicDecision } from "@urage/server/services/model3d/modelMetallicDecision";
import { suggestModelRealWorldHeight, type ModelRealWorldHeightDecision } from "@urage/server/services/model3d/modelRealWorldHeightDecision";
import { createSlashCommandHandlerService } from "./services/slash/handlers/slashCommandHandlerService.js";
import { createChatModeRuntimeService } from "./services/chat/chatModeRuntimeService.js";
import { createModerationVetoService } from "./services/moderation/veto/moderationVetoService.js";
import { createHoneypotVerificationService, HONEYPOT_VERIFY_CUSTOM_ID_PREFIX } from "./services/moderationHoneypotVerificationService.js";
import { createModelGenerationStartNoticeService } from "./services/model3d/post/modelGenerationStartNoticeService.js";
import { createPromoPostService } from "./services/promo/promoPostService.js";
import { createAutomationRuntimeService } from "./services/automation/runtime/automationRuntimeService.js";
import { fetchCurrentHumbleSoftwareBundles } from "./services/humbleSoftware.js";
import { createDuplicateSpamGuard, MODERATION_VETO_CUSTOM_ID_PREFIX } from "./services/moderation.js";
import { simulateModerationCheck } from "./services/moderationEvaluator.js";
import {
  canSendMessages,
  describeChannelKind,
  isEditableTextChannelType,
  isVoiceChannelType,
  mergeContentBlocks,
  mergePromptCandidates,
  normalizeLookupName,
  summarizeText
} from "./services/discordRuntimeHelpers.js";
import {
  buildChatModeSystemPrompt,
  buildChatModeUserPrompt,
  evaluateChatModeMessage,
  getChatModeChannelSettings,
  getHeartbeatDueGuildIds,
  shouldPostAutonomousHeartbeatForSignals
} from "./services/botModeService.js";
import {
  askOllama,
  askOllamaDetailed,
  askOllamaDetailedStream,
  askVisionOllama,
  ejectActiveOllamaModels,
  ensureAvailableOllamaModels,
  getActiveOllamaModels,
  loadActiveOllamaModels,
  listOllamaModels,
  setActiveOllamaModels,
  setLlmConnectionSettings,
  type LlmConnectionSettings
} from "@urage/server/services/llm/ollama";
import { recordDashboardSystemConsoleEvent, setDashboardConsoleLogger } from "@urage/server/services/dashboardConsoleLogger";
import { RuntimeState } from "@urage/server/runtime/runtimeState";
import { updateComfyRuntimeSettings } from "@urage/server/services/comfyRuntimeSettings";
import {
  buildChatSelfTaskIntentPrompt,
  buildSelfTaskPlannerPrompt,
  describeSelfTaskAction,
  parseChatSelfTaskIntent,
  parsePlannedSelfTaskBatch,
  safeSelfTaskPermissionNames,
  type PendingSelfTaskBatch,
  type SafeSelfTaskPermissionName,
  type SelfTaskAction
} from "./services/selfTaskService.js";
import {
  buildCommandJsonByNames,
  commandCatalog,
  getAllCommandNames
} from "./services/commandCatalog.js";
import {
  removeCachedGuildUser,
  searchCachedGuildUsers,
  upsertCachedGuildUser,
  upsertCachedGuildUsers
} from "./services/userCacheStore.js";
import { fetchPublisherGift } from "./services/unityPublisherGift.js";
import { createGiftAndHumbleMessageService } from "./services/giftAndHumbleMessageService.js";
import { VoiceManager } from "./services/voiceManager.js";
import { handleMediaAndUtilitySlashCommands } from "./services/slash/commands/mediaAndUtilityCommands.js";
import { handleAdminCoreSlashCommands } from "./services/slash/commands/adminCoreCommands.js";
import {
  ejectActiveLlmModelsViaRemoteWorker,
  loadActiveLlmModelsViaRemoteWorker,
  suggestModelMetallicDecisionViaRemoteWorker,
  suggestModelRealWorldHeightViaRemoteWorker,
  syncComfySettingsViaRemoteWorker,
  suggestLowPolyByComplexityViaRemoteWorker,
  suggestModelMetadataViaRemoteWorker
} from "@urage/server/services/remoteGenerationClient";
import { createMessengerRuntimeManager } from "@urage/server/runtime/messengerRuntimeManager";
import { installInteractiveShutdownPrompt } from "./runtime/interactiveShutdownPrompt.js";
import {
  GIF_FRAME_DOWNLOAD_CUSTOM_ID_PREFIX,
  IMAGE_ADD_TO_POOL_BUTTON_CUSTOM_ID_PREFIX,
  IMAGE_ADD_TO_POOL_SELECT_CUSTOM_ID_PREFIX,
  IMAGE_GENERATE_3D_BUTTON_CUSTOM_ID_PREFIX,
  IMAGE_NEW_BUTTON_CUSTOM_ID_PREFIX,
  IMAGE_NEW_PROMPT_BUTTON_CUSTOM_ID_PREFIX,
  MODEL_DOWNVOTE_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_AUTO_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_AUTO_MODAL_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_AUTO_MODAL_REFERENCE_INPUT_ID,
  MODEL_LOWPOLY_COMPLEXITY_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_COMPLEXITY_MODAL_CONTEXT_INPUT_ID,
  MODEL_LOWPOLY_COMPLEXITY_MODAL_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_DIMENSIONS_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_DIMENSIONS_MODAL_CUSTOM_ID_PREFIX,
  MODEL_LOWPOLY_DIMENSIONS_MODAL_INPUT_ID,
  MODEL_LOWPOLY_SIZE_CUSTOM_ID_PREFIX,
  MODEL_MULTIVIEW_CUSTOM_ID_PREFIX,
  MODEL_NEW_CUSTOM_ID_PREFIX,
  MODEL_NORMAL_CUSTOM_ID_PREFIX,
  MODEL_REFRESH_CUSTOM_ID_PREFIX,
  MODEL_SETTINGS_CUSTOM_ID_PREFIX,
  MODEL_UPVOTE_CUSTOM_ID_PREFIX,
  MODEL_UV_CUSTOM_ID_PREFIX,
  SELF_TASK_APPROVE_CUSTOM_ID_PREFIX,
  SELF_TASK_CANCEL_CUSTOM_ID_PREFIX
} from "./runtime/discordCustomIds.js";
import {
  applyRuntimeLlmSettings,
  resolveImageLlmConnectionSettings,
  resolveModel3dLlmConnectionSettings,
  syncValidatedActiveModelsToRuntimeState
} from "@urage/server/runtime/runtimeLlmSettings";
import {
  addImageSourceToPool as addImageSourceToPoolRuntime,
  addImageSourceToUserUnverifiedPool as addImageSourceToUserUnverifiedPoolRuntime,
  canUseVerifiedImagePools as canUseVerifiedImagePoolsRuntime,
  rememberPendingImagePoolSelection as rememberPendingImagePoolSelectionRuntime,
  type PendingImagePoolSelection
} from "./runtime/imagePoolRuntimeHelpers.js";
import {
  buildDiscordMessageUrl,
  createRuntimeId,
  parseImageActionPayload,
  parseImageAddToPoolButtonCustomId as parseImageAddToPoolButtonCustomIdRuntime,
  trimSelectLabel
} from "./runtime/discordRuntimeFormatters.js";
import { buildGeneratedImageComponents as buildGeneratedImageComponentsRuntime } from "./runtime/generatedImageComponents.js";
import { createLowPolyRuntime } from "./runtime/lowPolyRuntime.js";
import { createModel3dStudioRuntime } from "./runtime/model3dStudioRuntime.js";
import { createMediaReactionRuntime } from "./runtime/mediaReactionRuntime.js";
import { createAutomationMediaRuntime } from "./runtime/automationMediaRuntime.js";
import { createGeneratedImageRuntime } from "./runtime/generatedImageRuntime.js";
import { createGeneratedImageInteractionRuntime } from "./runtime/generatedImageInteractionRuntime.js";
import { createDiscordEventRuntime } from "./runtime/discordEventRuntime.js";
import { createDiscordRuntimeControl } from "./runtime/discordRuntimeControl.js";

const discordTokenRuntime = appConfig.discordToken.trim();
const canStartDiscordRuntime = discordTokenRuntime.length > 0;
if (!canStartDiscordRuntime) {
  console.warn("DISCORD_TOKEN_RUNTIME is empty. Discord runtime will stay stopped until a token is configured.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});
const voiceManager = new VoiceManager();
const persistedDashboardSettings = await loadDashboardSettings();
const messengerAutostartDisabled = process.env.URAGE_DISABLE_MESSENGER_AUTOSTART?.trim().toLowerCase() === "true";

const runtimeState = new RuntimeState({
  globalSettings: {
    llmProvider: appConfig.llmProvider,
    ollamaUrl: appConfig.ollamaUrl,
    lmStudioBaseUrl: appConfig.lmStudioBaseUrl,
    lmStudioApiKey: appConfig.lmStudioApiKey,
    ollamaTextModel: appConfig.ollamaModel,
    ollamaVisionModel: appConfig.ollamaVisionModel,
    model3dGenerationTarget: appConfig.model3dExecutionMode,
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
    ...persistedDashboardSettings.globalSettings
  },
  defaultGuildSettings: {
    antiSpamEnabled: true,
    antiSpamDuplicateWindowMs: appConfig.duplicateWindowMs,
    antiSpamTimeoutMs: 7 * 24 * 60 * 60 * 1000,
    antiSpamApplyTimeouts: true,
    antiSpamAnalyzeImages: true,
    ...persistedDashboardSettings.defaultGuildSettings
  },
  guildSettings: persistedDashboardSettings.guildSettings
});
setDashboardConsoleLogger({
  recordLlm: event => runtimeState.recordLlmConsoleEvent(event),
  recordSystem: event => runtimeState.recordSystemConsoleEvent(event)
});

applyRuntimeLlmSettings(runtimeState);
const resolveImageLlmConnectionSettingsFromState = (): LlmConnectionSettings => resolveImageLlmConnectionSettings(runtimeState);
const resolveModel3dLlmConnectionSettingsFromState = (): LlmConnectionSettings => resolveModel3dLlmConnectionSettings(runtimeState);
const blenderOpenService = createBlenderOpenService({
  config: {
    blenderExecutablePath: appConfig.blenderExecutablePath,
    dataDirectory: appConfig.dataDirectory,
    blenderOpenScriptPath: appConfig.blenderOpenScriptPath,
    blenderModelAutoRigScriptPath: appConfig.blenderModelAutoRigScriptPath,
    blenderLowPolyScriptPath: appConfig.blenderLowPolyScriptPath
  },
  recordConsoleEvent: recordDashboardSystemConsoleEvent
});

function getImageMimeTypeFromFileName(fileName: string): string {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".bmp")) return "image/bmp";
  if (normalized.endsWith(".tif") || normalized.endsWith(".tiff")) return "image/tiff";
  return "image/png";
}

async function readImageAssetDataUrlForRemoteWorker(assetPath: string, fileName: string): Promise<string> {
  const data = await readFile(assetPath);
  return `data:${getImageMimeTypeFromFileName(fileName)};base64,${data.toString("base64")}`;
}

await ensureAvailableOllamaModels();
syncValidatedActiveModelsToRuntimeState(runtimeState);
try {
  await saveDashboardSettings(runtimeState.getStoredDashboardSettings());
} catch (error) {
  console.warn("Failed to persist dashboard settings during startup. Continuing with in-memory settings.", error);
}
let commandSettings = await loadCommandSettings();
const commandRest = new REST({ version: "10" }).setToken(appConfig.discordToken);

const pendingSelfTaskBatches = new Map<string, PendingSelfTaskBatch>();
const pendingImagePoolSelections = new Map<string, PendingImagePoolSelection>();
const pendingImageModelGenerations = new Set<string>();
const guildFactAndSafetyHelpers = createGuildFactAndSafetyHelpers({
  getGuildDashboardSettings: guildId => runtimeState.getGuildDashboardSettings(guildId)
});
{
  const globalSettings = runtimeState.getGlobalDashboardSettings();
  updateComfyRuntimeSettings({
    comfyUiBaseUrl: globalSettings.comfyUiBaseUrl,
    comfyUiModelBaseUrl: globalSettings.comfyUiModelBaseUrl,
    comfyUiImageBaseUrl: globalSettings.comfyUiImageBaseUrl,
    comfyUiAudioBaseUrl: globalSettings.comfyUiAudioBaseUrl,
    comfyUiMusicBaseUrl: globalSettings.comfyUiMusicBaseUrl,
    comfyUiVideoBaseUrl: globalSettings.comfyUiVideoBaseUrl,
    comfyUiInputDir: globalSettings.comfyUiInputDir,
    comfyUiModelWorkflowPath: globalSettings.comfyUiModelWorkflowPath,
    comfyUiImageWorkflowPath: globalSettings.comfyUiImageWorkflowPath,
    comfyUiImageEditWorkflowPath: globalSettings.comfyUiImageEditWorkflowPath,
    comfyUiImageLayeredWorkflowPath: globalSettings.comfyUiImageLayeredWorkflowPath,
    comfyUiAudioWorkflowPath: globalSettings.comfyUiAudioWorkflowPath,
    comfyUiMusicWorkflowPath: globalSettings.comfyUiMusicWorkflowPath,
    comfyUiVideoWorkflowPath: globalSettings.comfyUiVideoWorkflowPath,
    comfyUiVideoImageWorkflowPath: globalSettings.comfyUiVideoImageWorkflowPath
  });
  if (appConfig.remoteWorkerBaseUrl.trim().length > 0) {
    void syncComfySettingsViaRemoteWorker({
      comfyUiBaseUrl: globalSettings.comfyUiBaseUrl,
      comfyUiModelBaseUrl: globalSettings.comfyUiModelBaseUrl,
      comfyUiImageBaseUrl: globalSettings.comfyUiImageBaseUrl,
      comfyUiAudioBaseUrl: globalSettings.comfyUiAudioBaseUrl,
      comfyUiMusicBaseUrl: globalSettings.comfyUiMusicBaseUrl,
      comfyUiVideoBaseUrl: globalSettings.comfyUiVideoBaseUrl,
      comfyUiInputDir: globalSettings.comfyUiInputDir,
      comfyUiModelWorkflowPath: globalSettings.comfyUiModelWorkflowPath,
      comfyUiImageWorkflowPath: globalSettings.comfyUiImageWorkflowPath,
      comfyUiImageEditWorkflowPath: globalSettings.comfyUiImageEditWorkflowPath,
      comfyUiImageLayeredWorkflowPath: globalSettings.comfyUiImageLayeredWorkflowPath,
      comfyUiAudioWorkflowPath: globalSettings.comfyUiAudioWorkflowPath,
      comfyUiMusicWorkflowPath: globalSettings.comfyUiMusicWorkflowPath,
      comfyUiVideoWorkflowPath: globalSettings.comfyUiVideoWorkflowPath,
      comfyUiVideoImageWorkflowPath: globalSettings.comfyUiVideoImageWorkflowPath
    }).catch(error => {
      const detail = error instanceof Error ? error.message : String(error);
      runtimeState.recordAction("dashboard:comfy-remote-sync-error", detail);
      console.warn("Failed to sync Comfy settings to remote worker on startup.", detail);
    });
  }
}
const isProtectedMember = guildFactAndSafetyHelpers.isProtectedMember;
const isProtectedGuildMember = guildFactAndSafetyHelpers.isProtectedGuildMember;
const getProtectedMemberReasons = guildFactAndSafetyHelpers.getProtectedMemberReasons;
const buildMemberPromptContext = guildFactAndSafetyHelpers.buildMemberPromptContext;
const stripDiscrodReplyFooter = guildFactAndSafetyHelpers.stripDiscrodReplyFooter;
const shouldRefreshGuildFactQuery = guildFactAndSafetyHelpers.shouldRefreshGuildFactQuery;
const formatCheckedAt = guildFactAndSafetyHelpers.formatCheckedAt;
const matchesOwnerFactQuery = guildFactAndSafetyHelpers.matchesOwnerFactQuery;
const matchesRolesFactQuery = guildFactAndSafetyHelpers.matchesRolesFactQuery;
const matchesAuthorityFactQuery = guildFactAndSafetyHelpers.matchesAuthorityFactQuery;
const matchesChannelFactQuery = guildFactAndSafetyHelpers.matchesChannelFactQuery;
const matchesMemberCountFactQuery = guildFactAndSafetyHelpers.matchesMemberCountFactQuery;
const matchesInviteFactQuery = guildFactAndSafetyHelpers.matchesInviteFactQuery;
const buildAuthorityLabelsForMember = guildFactAndSafetyHelpers.buildAuthorityLabelsForMember;
const permissionHelpers = createDiscordPermissionHelpers({ client });
const requireGuildBotMember = permissionHelpers.requireGuildBotMember;
const ensureGuildPermission = permissionHelpers.ensureGuildPermission;
const ensureChannelPermission = permissionHelpers.ensureChannelPermission;
const getGuildPermissionSummary = permissionHelpers.getGuildPermissionSummary;
const getChannelPermissionSummary = permissionHelpers.getChannelPermissionSummary;
const commandSyncService = createCommandSyncService({
  appClientId: appConfig.discordClientId,
  commandRest,
  getCommandSettings: () => commandSettings,
  setCommandSettings: settings => {
    commandSettings = settings;
  },
  saveCommandSettings,
  buildCommandJsonByNames
});
const persistCommandSettings = commandSyncService.persistCommandSettings;
const getCommandScopeState = commandSyncService.getCommandScopeState;
const syncGlobalCommands = commandSyncService.syncGlobalCommands;
const syncGuildCommands = commandSyncService.syncGuildCommands;
const discordTextOpsService = createDiscordTextOpsService({
  client,
  canSendMessages,
  requireGuildBotMember,
  ensureChannelPermission,
  sendChunkedToTarget,
  summarizeText
});
const describeChannel = discordTextOpsService.describeChannel;
const sendChunkedToChannel = discordTextOpsService.sendChunkedToChannel;
const requireSendableChannel = discordTextOpsService.requireSendableChannel;
const sendMessageToChannel = discordTextOpsService.sendMessageToChannel;
const sendDirectMessage = discordTextOpsService.sendDirectMessage;
const listRecentBotMessages = discordTextOpsService.listRecentBotMessages;
const editBotAuthoredMessage = discordTextOpsService.editBotAuthoredMessage;
const listDirectMessages = discordTextOpsService.listDirectMessages;
const getDirectMessageEntries = discordTextOpsService.getDirectMessageEntries;
const giftAndHumbleMessageService = createGiftAndHumbleMessageService({
  humbleRoleId: appConfig.humbleRoleId,
  fetchPublisherGift,
  fetchCurrentHumbleSoftwareBundles
});
const buildGiftMessage = giftAndHumbleMessageService.buildGiftMessage;
const buildGiftMessageIfAvailable = giftAndHumbleMessageService.buildGiftMessageIfAvailable;
const buildHumbleMessages = giftAndHumbleMessageService.buildHumbleMessages;
const guildChannelService = createGuildChannelService({
  client,
  appClientId: appConfig.discordClientId,
  requireGuildBotMember,
  ensureGuildPermission,
  ensureChannelPermission,
  getConnectedVoiceChannelId: guildId => voiceManager.getConnectedChannelId(guildId)
});
const listGuilds = guildChannelService.listGuilds;
const buildBotInviteUrl = guildChannelService.buildBotInviteUrl;
const listChannels = guildChannelService.listChannels;
const reorderGuildChannelInGuild = guildChannelService.reorderGuildChannelInGuild;
const getChannelSettingsForGuild = guildChannelService.getChannelSettingsForGuild;
const saveChannelSettingsForGuild = guildChannelService.saveChannelSettingsForGuild;
const createGuildChannelInGuild = guildChannelService.createGuildChannelInGuild;
const createThreadInGuild = guildChannelService.createThreadInGuild;
const createPostInGuild = guildChannelService.createPostInGuild;
const listGuildInvitesForGuild = guildChannelService.listGuildInvitesForGuild;
const createGuildInviteForGuild = guildChannelService.createGuildInviteForGuild;
const deleteGuildInviteForGuild = guildChannelService.deleteGuildInviteForGuild;
const replaceGuildInviteForGuild = guildChannelService.replaceGuildInviteForGuild;
const guildFactAnswerService = createGuildFactAnswerService({
  shouldRefreshGuildFactQuery,
  matchesOwnerFactQuery,
  matchesRolesFactQuery,
  matchesAuthorityFactQuery,
  matchesChannelFactQuery,
  matchesMemberCountFactQuery,
  matchesInviteFactQuery,
  getCachedGuildFact,
  upsertCachedGuildFact,
  listChannels,
  listGuildInvitesForGuild,
  buildAuthorityLabelsForMember,
  formatCheckedAt
});
const tryAnswerCachedGuildFactQuestion = guildFactAnswerService.tryAnswerCachedGuildFactQuestion;
const guildMemberService = createGuildMemberService({
  client,
  requireGuildBotMember,
  ensureGuildPermission,
  searchCachedGuildUsers,
  upsertCachedGuildUser,
  upsertCachedGuildUsers,
  getGuildSettings,
  renderMemberCounterName,
  updateGuildSettings
});
const searchUsers = guildMemberService.searchUsers;
const toDashboardUserSummary = guildMemberService.toDashboardUserSummary;
const cacheGuildMember = guildMemberService.cacheGuildMember;
const fetchUsers = guildMemberService.fetchUsers;
const updateMemberCounterChannelForGuild = guildMemberService.updateMemberCounterChannelForGuild;
const refreshConfiguredMemberCounters = guildMemberService.refreshConfiguredMemberCounters;
const listRoles = guildMemberService.listRoles;
const assignRoleToUser = guildMemberService.assignRoleToUser;
const removeRoleFromUser = guildMemberService.removeRoleFromUser;
const createInvestigationRoleForGuild = guildMemberService.createInvestigationRoleForGuild;
const createTemporaryImageBlockRoleForGuild = guildMemberService.createTemporaryImageBlockRoleForGuild;
const guildVoiceService = createGuildVoiceService({
  client,
  voiceManager,
  isVoiceChannelType
});
const joinVoiceChannelForGuild = guildVoiceService.joinVoiceChannelForGuild;
const disconnectVoiceChannelForGuild = guildVoiceService.disconnectVoiceChannelForGuild;
const guildRodPlanningService = createGuildRodPlanningService({
  client,
  askText: (prompt, systemPrompt) => askOllama(prompt, systemPrompt),
  listChannels,
  listRoles: guildId => guildMemberService.listRoles(guildId)
});
const planGuildChannelsWithRod = guildRodPlanningService.planGuildChannelsWithRod;
const applyGuildChannelPlan = guildRodPlanningService.applyGuildChannelPlan;
const auditGuildWithRod = guildRodPlanningService.auditGuildWithRod;
const selfTaskExecutionHelpers = createSelfTaskExecutionHelpers({
  normalizeLookupName,
  canSendMessages,
  requireGuildBotMember,
  describeChannel
});
const resolveGuildCategoryId = selfTaskExecutionHelpers.resolveGuildCategoryId;
const resolveGuildTextChannelId = selfTaskExecutionHelpers.resolveGuildTextChannelId;
const resolveGuildChannelId = selfTaskExecutionHelpers.resolveGuildChannelId;
const resolveGuildRoleId = selfTaskExecutionHelpers.resolveGuildRoleId;
const resolveGuildMemberId = selfTaskExecutionHelpers.resolveGuildMemberId;
const explainChannelPermissionsForTarget = selfTaskExecutionHelpers.explainChannelPermissionsForTarget;
const resolveSelfTaskPermissions = selfTaskExecutionHelpers.resolveSelfTaskPermissions;
const selfTaskActionExecutorService = createSelfTaskActionExecutorService({
  client,
  requireGuildBotMember,
  ensureGuildPermission,
  ensureChannelPermission,
  requireSendableChannel,
  sendChunkedToChannel,
  describeChannel,
  describeChannelKind,
  canSendMessages,
  resolveGuildCategoryId,
  resolveGuildTextChannelId,
  resolveGuildChannelId,
  resolveGuildRoleId,
  resolveGuildMemberId,
  resolveSelfTaskPermissions,
  explainChannelPermissionsForTarget,
  createGuildChannelInGuild,
  createThreadInGuild,
  createPostInGuild,
  saveChannelSettingsForGuild,
  reorderGuildChannelInGuild,
  listRoles,
  searchCachedGuildUsers,
  listGuildInvitesForGuild,
  createGuildInviteForGuild,
  deleteGuildInviteForGuild,
  replaceGuildInviteForGuild,
  updateGuildSettings: async (guildId, update) => {
    await updateGuildSettings(guildId, update);
  },
  updateMemberCounterChannelForGuild,
  getGuildSettings: async guildId => {
    const settings = await getGuildSettings(guildId);
    return {
      chatModeChannels: settings.chatModeChannels
    };
  },
  listRecentBotMessages,
  editBotAuthoredMessage
});
const executeSelfTaskAction = selfTaskActionExecutorService.executeSelfTaskAction;
const selfTaskPlanningService = createSelfTaskPlanningService({
  client,
  getGuildSettings,
  askText: prompt => askOllama(prompt, false),
  buildSelfTaskPlannerPrompt,
  parsePlannedSelfTaskBatch,
  describeSelfTaskAction,
  recordSelfTaskReview: input => runtimeState.recordSelfTaskReview(input),
  createRuntimeId
});
const buildSelfTaskEmbed = selfTaskPlanningService.buildSelfTaskEmbed;
const buildPendingSelfTaskBatchForRequest = selfTaskPlanningService.buildPendingSelfTaskBatchForRequest;
const buildPendingSelfTaskBatch = selfTaskPlanningService.buildPendingSelfTaskBatch;
const selfTaskBatchExecutionService = createSelfTaskBatchExecutionService({
  getGuildSettings,
  describeSelfTaskAction,
  executeSelfTaskAction,
  resolveSelfTaskReview: (reviewId, payload) => {
    runtimeState.resolveSelfTaskReview(reviewId, payload);
  }
});
const applyPendingSelfTaskBatch = selfTaskBatchExecutionService.applyPendingSelfTaskBatch;
const selfTaskApprovalService = createSelfTaskApprovalService({
  approvePrefix: SELF_TASK_APPROVE_CUSTOM_ID_PREFIX,
  cancelPrefix: SELF_TASK_CANCEL_CUSTOM_ID_PREFIX,
  pendingSelfTaskBatches,
  isProtectedGuildMember,
  buildSelfTaskEmbed,
  applyPendingSelfTaskBatch,
  resolveSelfTaskReview: (reviewId, payload) => {
    runtimeState.resolveSelfTaskReview(reviewId, payload);
  },
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const handleSelfTaskApproval = selfTaskApprovalService.handleSelfTaskApproval;
const moderationRestrictionService = createModerationRestrictionService({
  getGuildSettings,
  canSendMessages,
  sendChunkedToTarget,
  recordModeration: entry => {
    runtimeState.recordModeration(entry);
  }
});
const containsRestrictedLinkContent = moderationRestrictionService.containsRestrictedLinkContent;
const enforceModerationRoleRestrictions = moderationRestrictionService.enforceModerationRoleRestrictions;
const autonomousHeartbeatService = createAutonomousHeartbeatService({
  client,
  getGuildSettings,
  getHeartbeatDueGuildIds,
  shouldPostAutonomousHeartbeatForSignals,
  canSendMessages,
  sendChunkedToTarget,
  getGuildPermissionSummary,
  getRecentGuildSignals: (guildId, lookbackMs) => runtimeState.getRecentGuildSignals(guildId, lookbackMs),
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const runAutonomousHeartbeatPass = autonomousHeartbeatService.runAutonomousHeartbeatPass;

const imagePoolRuntimeStoreDeps = {
  listImagePools,
  saveImagePool,
  resolveGeneratedImageApiSourceToFilePath
};
const imagePoolRuntimePermissionDeps = {
  getGuildSettings,
  isProtectedGuildMember
};
const rememberPendingImagePoolSelection = (input: PendingImagePoolSelection): string => rememberPendingImagePoolSelectionRuntime({
  selections: pendingImagePoolSelections,
  createRuntimeId,
  selection: input
});
const addImageSourceToPool = (input: { poolId: string; imageSource: string; }) => addImageSourceToPoolRuntime(input, imagePoolRuntimeStoreDeps);
const addImageSourceToUserUnverifiedPool = (input: {
  userId: string;
  username: string;
  displayName?: string | null;
  imageSource: string;
}) => addImageSourceToUserUnverifiedPoolRuntime(input, imagePoolRuntimeStoreDeps);
const canUseVerifiedImagePools = (member: GuildMember | null | undefined) => canUseVerifiedImagePoolsRuntime(member, imagePoolRuntimePermissionDeps);
const parseImageAddToPoolButtonCustomId = (customId: string) => parseImageAddToPoolButtonCustomIdRuntime(customId, IMAGE_ADD_TO_POOL_BUTTON_CUSTOM_ID_PREFIX);

function buildGeneratedImageComponents(record: GeneratedImagePublicRecord, requestedByUserId: string): Array<ActionRowBuilder<ButtonBuilder>> {
  return buildGeneratedImageComponentsRuntime({
    record,
    requestedByUserId,
    imageGenerate3dPrefix: IMAGE_GENERATE_3D_BUTTON_CUSTOM_ID_PREFIX,
    imageNewPrefix: IMAGE_NEW_BUTTON_CUSTOM_ID_PREFIX,
    imageNewPromptPrefix: IMAGE_NEW_PROMPT_BUTTON_CUSTOM_ID_PREFIX,
    imageAddToPoolPrefix: IMAGE_ADD_TO_POOL_BUTTON_CUSTOM_ID_PREFIX
  });
}
const mediaReactionRuntime = createMediaReactionRuntime({
  getGuildSettings,
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const maybeOfferMediaReactionActions = mediaReactionRuntime.maybeOfferMediaReactionActions;

const lowPolyRuntime = createLowPolyRuntime({
  defaultFaceCount: appConfig.lowPolyDefaultTargetFaceCount,
  askText: (prompt: string) => askOllama(prompt, false),
  askVision: askVisionOllama,
  readGeneratedModelFile,
  classifyRealWorldSizeTierLocal,
  suggestLowPolyByComplexityLocal: suggestLowPolyByComplexityLocalService,
  suggestLowPolyByComplexityViaRemoteWorker,
  decideLowPolyByVisualComplexityLocal
});
const LOW_POLY_SIZE_CHOICES = lowPolyRuntime.lowPolySizeChoices;
const classifyRealWorldSizeTier = lowPolyRuntime.classifyRealWorldSizeTier;
const formatRealWorldDimensions = lowPolyRuntime.formatRealWorldDimensions;
const suggestLowPolyByComplexity = lowPolyRuntime.suggestLowPolyByComplexity;
const decideLowPolyByVisualComplexity = lowPolyRuntime.decideLowPolyByVisualComplexity;
const model3dStudioRuntime = createModel3dStudioRuntime({
  getGlobalSettings: () => runtimeState.getGlobalDashboardSettings(),
  remoteWorkerBaseUrl: appConfig.remoteWorkerBaseUrl,
  resolveGeneratedModelFilePath,
  runModelPreviewRender,
  setGeneratedModelPreviewImage,
  buildImageDataUrl,
  contentTypeFromImageFileExtension,
  importUploadedSourceModel,
  generateLowPolyFromUploadedModelViaRemoteWorker,
  suggestModelFileNameAndDescription,
  normalizeModelNameCandidate,
  renameGeneratedLowPolyModelFileName,
  listGeneratedModelsPublic,
  ensureVisualInterpretationForImage,
  getCachedVisualInterpretationPromptHint,
  mergeContentBlocks: parts => mergeContentBlocks(parts.map(part => part ?? undefined)),
  suggestLowPolyByComplexity,
  generateLowPolyModelWithExecution,
  suggestModelRealWorldHeightViaRemoteWorker,
  suggestModelRealWorldHeight,
  resolveModel3dLlmConnectionSettingsFromState,
  getGeneratedModelPublicById,
  applyModelScaleToHeightWithExecution,
  applyGeneratedModelMaterialFinish,
  applyGeneratedModelAutoRig,
  previewGeneratedModelAutoRig,
  defaultLowPolyTargetFaceCount: appConfig.lowPolyDefaultTargetFaceCount
});
const renderUploadedModelPreviewForLowPolyDecision = model3dStudioRuntime.renderUploadedModelPreviewForLowPolyDecision;
const generateLowPolyFromUploadedModel = model3dStudioRuntime.generateLowPolyFromUploadedModel;
const generateLowPolyForModel = model3dStudioRuntime.generateLowPolyForModel;
const suggestStudioModelRealWorldHeight = model3dStudioRuntime.suggestStudioModelRealWorldHeight;
const applyStudioModelEdits = model3dStudioRuntime.applyStudioModelEdits;
const applyAutoRigToGeneratedModel = model3dStudioRuntime.applyAutoRigToGeneratedModel;
const previewAutoRigForGeneratedModel = model3dStudioRuntime.previewAutoRigForGeneratedModel;
const editUploadedModel = model3dStudioRuntime.editUploadedModel;
const editGeneratedModel = model3dStudioRuntime.editGeneratedModel;

const modelGenerationStartNoticeService = createModelGenerationStartNoticeService({
  requireSendableChannel,
  buildModelSourceImageAttachment,
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const postModelGenerationStartNotice = modelGenerationStartNoticeService.postModelGenerationStartNotice;

const chatModeRuntimeService = createChatModeRuntimeService({
  canSendMessages,
  getGuildSettings,
  getChatModeChannelSettings,
  evaluateChatModeMessage,
  askText: (prompt, options) => askOllama(prompt, options ?? false),
  buildChatModeSystemPrompt,
  buildChatModeUserPrompt,
  stripDiscrodReplyFooter,
  summarizeText,
  sendChunkedToTarget,
  buildMemberPromptContext,
  buildChatSelfTaskIntentPrompt,
  parseChatSelfTaskIntent,
  buildPendingSelfTaskBatchForRequest,
  describeSelfTaskAction,
  applyPendingSelfTaskBatch,
  isProtectedGuildMember,
  tryAnswerCachedGuildFactQuestion,
  resolveSelfTaskReview: (reviewId, payload) => {
    runtimeState.resolveSelfTaskReview(reviewId, payload);
  },
  setChatModeDebugStatus: input => {
    runtimeState.setChatModeDebugStatus(input);
  },
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  },
  getClientUserId: () => client.user?.id ?? null
});
const maybeHandleChatModeMessage = chatModeRuntimeService.maybeHandleChatModeMessage;

const promoPostService = createPromoPostService({
  sendMessageToChannel,
  buildGiftMessage,
  requireSendableChannel,
  buildHumbleMessages,
  sendChunkedToChannel
});
const postGiftToChannel = promoPostService.postGiftToChannel;
const postHumbleToChannel = promoPostService.postHumbleToChannel;

const modelPostService = createModelPostService({
  client,
  buttonPrefixes: {
    upvote: MODEL_UPVOTE_CUSTOM_ID_PREFIX,
    downvote: MODEL_DOWNVOTE_CUSTOM_ID_PREFIX,
    refresh: MODEL_REFRESH_CUSTOM_ID_PREFIX,
    newModel: MODEL_NEW_CUSTOM_ID_PREFIX,
    settings: MODEL_SETTINGS_CUSTOM_ID_PREFIX,
    lowPoly: MODEL_LOWPOLY_CUSTOM_ID_PREFIX,
    multiView: MODEL_MULTIVIEW_CUSTOM_ID_PREFIX,
    uvMap: MODEL_UV_CUSTOM_ID_PREFIX,
    normalMap: MODEL_NORMAL_CUSTOM_ID_PREFIX
  },
  requireSendableChannel,
  requireGuildBotMember,
  ensureGuildPermission,
  ensureChannelPermission,
  resolveGeneratedModelFilePath,
  generate3dModelFromImage: generate3dModelWithExecution,
  generateLowPolyModel: input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    return generateLowPolyModelWithExecution({
      ...input,
      shouldDecimate: true
    }, globalSettings.model3dGenerationTarget === "remote" ? "remote" : "local");
  },
  suggestLowPolyByComplexity: input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    return suggestLowPolyByComplexity({
      ...input,
      executionTarget: input.executionTarget ?? globalSettings.model3dMetadataTarget
    });
  },
  toGeneratedModelPublicRecord,
  getGeneratedModelPublicById,
  setGeneratedModelPreviewGif
});
const normalizeModelPostOptions = modelPostService.normalizeModelPostOptions;
const buildModelReadyContent = modelPostService.buildModelReadyContent;
const buildGeneratedModelEmbed = modelPostService.buildGeneratedModelEmbed;
const buildLowPolyModelEmbed = modelPostService.buildLowPolyModelEmbed;
const buildGeneratedModelAttachments = modelPostService.buildGeneratedModelAttachments;
const buildGeneratedModelComponents = modelPostService.buildGeneratedModelComponents;
const buildLowPolyModelComponents = modelPostService.buildLowPolyModelComponents;
const postGeneratedModelWithRouting = modelPostService.postGeneratedModelWithRouting;
const generateModelAndPostToChannel = modelPostService.generateModelAndPostToChannel;
const postExistingGeneratedModelToChannel = modelPostService.postExistingGeneratedModelToChannel;
const lowPolyReplyService = createLowPolyReplyService({
  generateLowPolyModel: input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    return generateLowPolyModelWithExecution({
      ...input,
      shouldDecimate: true
    }, globalSettings.model3dGenerationTarget === "remote" ? "remote" : "local");
  },
  resolveGeneratedModelFilePath,
  normalizeModelPostOptions,
  buildLowPolyModelEmbed,
  buildLowPolyModelComponents,
  buildDiscordMessageUrl,
  defaultTargetFaceCount: appConfig.lowPolyDefaultTargetFaceCount
});
const runLowPolyGenerationReply = lowPolyReplyService.runLowPolyGenerationReply;
const generatedModelInteractionService = createGeneratedModelInteractionService({
  ids: {
    upvotePrefix: MODEL_UPVOTE_CUSTOM_ID_PREFIX,
    downvotePrefix: MODEL_DOWNVOTE_CUSTOM_ID_PREFIX,
    refreshPrefix: MODEL_REFRESH_CUSTOM_ID_PREFIX,
    newPrefix: MODEL_NEW_CUSTOM_ID_PREFIX,
    settingsPrefix: MODEL_SETTINGS_CUSTOM_ID_PREFIX,
    lowPolyPrefix: MODEL_LOWPOLY_CUSTOM_ID_PREFIX,
    lowPolySizePrefix: MODEL_LOWPOLY_SIZE_CUSTOM_ID_PREFIX,
    lowPolyDimensionsPrefix: MODEL_LOWPOLY_DIMENSIONS_CUSTOM_ID_PREFIX,
    lowPolyAutoPrefix: MODEL_LOWPOLY_AUTO_CUSTOM_ID_PREFIX,
    lowPolyComplexityPrefix: MODEL_LOWPOLY_COMPLEXITY_CUSTOM_ID_PREFIX,
    lowPolyAutoModalPrefix: MODEL_LOWPOLY_AUTO_MODAL_CUSTOM_ID_PREFIX,
    lowPolyDimensionsModalPrefix: MODEL_LOWPOLY_DIMENSIONS_MODAL_CUSTOM_ID_PREFIX,
    lowPolyComplexityModalPrefix: MODEL_LOWPOLY_COMPLEXITY_MODAL_CUSTOM_ID_PREFIX,
    lowPolyDimensionsModalInputId: MODEL_LOWPOLY_DIMENSIONS_MODAL_INPUT_ID,
    lowPolyAutoModalReferenceInputId: MODEL_LOWPOLY_AUTO_MODAL_REFERENCE_INPUT_ID,
    lowPolyComplexityModalContextInputId: MODEL_LOWPOLY_COMPLEXITY_MODAL_CONTEXT_INPUT_ID,
    multiViewPrefix: MODEL_MULTIVIEW_CUSTOM_ID_PREFIX,
    uvPrefix: MODEL_UV_CUSTOM_ID_PREFIX,
    normalPrefix: MODEL_NORMAL_CUSTOM_ID_PREFIX
  },
  lowPolySizeChoices: LOW_POLY_SIZE_CHOICES,
  defaultLowPolyTargetFaceCount: appConfig.lowPolyDefaultTargetFaceCount,
  listGeneratedModelsPublic,
  resolveGeneratedModelFilePath,
  parseLowPolySizeButtonValue,
  parseLowPolyInteractionContext,
  buildLowPolyInteractionPayload,
  parseLowPolyModalValue,
  parseRealWorldDimensionsText,
  deriveRealWorldSizeTierFromDimensions,
  getLowPolyTargetFaceCountForTier,
  buildLowPolySizePickerComponents,
  runLowPolyGenerationReply,
  classifyRealWorldSizeTier,
  decideLowPolyByVisualComplexity,
  formatRealWorldDimensions
});
const handleGeneratedModelButton = generatedModelInteractionService.handleGeneratedModelButton;
const handleGeneratedModelModal = generatedModelInteractionService.handleGeneratedModelModal;
const slashCommandHandlerService = createSlashCommandHandlerService({
  isCommandEnabled: (guildId, commandName) => isCommandEnabledForGuild(commandSettings, guildId, commandName),
  handleHelpCommand,
  handleAdminCoreSlashCommands,
  adminCoreContext: {
    canSendMessages,
    sendChunkedToChannel,
    sendDirectMessage,
    describeChannel,
    summarizeText,
    recordAction: (type: string, summary: string) => {
      runtimeState.recordAction(type, summary);
    }
  },
  tryAnswerCachedGuildFactQuestion,
  summarizeText,
  buildMemberPromptContext,
  askText: prompt => askOllama(prompt, false),
  replyWithChunks,
  handleMediaAndUtilitySlashCommands,
  mediaAndUtilityContext: {
    buildGiftMessage,
    buildHumbleMessages,
    replyWithChunks,
    followUpWithChunks,
    buildBotInviteUrl,
    resolveModelPrompt: (input: { prompt?: string; autoPrompt?: boolean; }) => resolveModelPrompt({
      ...input,
      llmConnectionSettings: resolveModel3dLlmConnectionSettingsFromState()
    }),
    resolveImagePrompt: (input: { prompt?: string; autoPrompt?: boolean; }) => resolveImagePrompt({
      ...input,
      llmConnectionSettings: resolveImageLlmConnectionSettingsFromState()
    }),
    describeImageWithVision: (input: { imageInput: string; prompt?: string; }) => describeImageWithVision({
      ...input,
      llmConnectionSettings: resolveImageLlmConnectionSettingsFromState()
    }),
    resolveImagePromptFromBaseImage: (input: { imageInput: string; prompt?: string; detailMode?: "precise" | "normal" | "vague"; direction?: string; }) => resolveImagePromptFromBaseImage({
      ...input,
      llmConnectionSettings: resolveImageLlmConnectionSettingsFromState()
    }),
    generateAudioWithExecution,
    generateMusicWithExecution,
    generate3dModelWithExecution,
    generateLowPolyFromUploadedModel,
    loadActiveLlmModels: async (input: { scope?: "text" | "vision" | "both"; textModel?: string; visionModel?: string; contextLength?: number; }) => {
      const globalSettings = runtimeState.getGlobalDashboardSettings();
      const contextLength = typeof input?.contextLength === "number" && Number.isFinite(input.contextLength)
        ? Math.max(0, Math.round(input.contextLength))
        : globalSettings.lmStudioContextLength;
      if (input?.textModel || input?.visionModel) {
        setActiveOllamaModels({ textModel: input.textModel, visionModel: input.visionModel });
      }
      if (globalSettings.model3dMetadataTarget === "remote") {
        return loadActiveLlmModelsViaRemoteWorker(input?.scope === "text" || input?.scope === "vision" ? input.scope : "both", contextLength, {
          textModel: input?.textModel,
          visionModel: input?.visionModel
        });
      }
      return loadActiveOllamaModels(input?.scope === "text" || input?.scope === "vision" ? input.scope : "both", { lmStudioContextLength: contextLength });
    },
    generateImageWithExecution,
    generateVideoFromPrompt: generateVideoFromPromptLocal,
    toGeneratedAudioPublicRecord,
    toGeneratedModelPublicRecord,
    toGeneratedImagePublicRecord,
    toGeneratedVideoPublicRecord,
    resolveGeneratedModelFilePath,
    resolveGeneratedVideoFilePath,
    buildModelReadyContent,
    buildGeneratedModelEmbed,
    buildGeneratedModelAttachments,
    buildGeneratedModelComponents,
    normalizeModelPostOptions,
    buildGeneratedImageEmbed,
    buildGeneratedImageAttachment,
    buildGeneratedImageComponents,
    buildGeneratedAudioEmbed,
    buildGeneratedMusicEmbed,
    buildGeneratedAudioAttachment,
    listImagePools,
    addImageToPool: addImageSourceToPool,
    stripMetadataDiscordImages: () => runtimeState.getGlobalDashboardSettings().stripMetadataDiscordImages,
    recordAction: (type: string, summary: string) => {
      runtimeState.recordAction(type, summary);
    }
  },
  buildPendingSelfTaskBatch,
  pendingSelfTaskBatches,
  buildSelfTaskEmbed,
  selfTaskApprovePrefix: SELF_TASK_APPROVE_CUSTOM_ID_PREFIX,
  selfTaskCancelPrefix: SELF_TASK_CANCEL_CUSTOM_ID_PREFIX,
  recordAction: (type: string, summary: string) => {
    runtimeState.recordAction(type, summary);
  }
});
const handleSlashCommand = slashCommandHandlerService.handleSlashCommand;

const moderationVetoService = createModerationVetoService({
  client,
  vetoPrefix: MODERATION_VETO_CUSTOM_ID_PREFIX,
  getModerationVetoRecord: id => runtimeState.getModerationVetoRecord(id),
  resolveModerationVetoRecord: (id, input) => runtimeState.resolveModerationVetoRecord(id, input),
  isProtectedGuildMember,
  getGuildSettings,
  canSendMessages,
  sendChunkedToTarget,
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const handleModerationVeto = moderationVetoService.handleModerationVeto;

const honeypotVerificationService = createHoneypotVerificationService({
  client,
  runtimeState,
  verifyPrefix: HONEYPOT_VERIFY_CUSTOM_ID_PREFIX,
  canSendMessages,
  sendChunkedToTarget,
  persistRuntimeState: async () => {
    await saveDashboardSettings(runtimeState.getStoredDashboardSettings());
  },
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const handleHoneypotVerify = honeypotVerificationService.handleHoneypotVerify;

const duplicateSpamGuard = createDuplicateSpamGuard({
  client,
  runtimeState,
  persistRuntimeState: async () => {
    await saveDashboardSettings(runtimeState.getStoredDashboardSettings());
  },
  isProtectedMember,
  getProtectedMemberReasons,
  getGuildModerationRoles: async guildId => {
    const settings = await getGuildSettings(guildId);
    return {
      investigationRoleId: settings.investigationRoleId,
      temporaryImageBlockRoleId: settings.temporaryImageBlockRoleId
    };
  }
});

let automationMediaRuntime: ReturnType<typeof createAutomationMediaRuntime> | null = null;
const generatedImageRuntime = createGeneratedImageRuntime({
  client,
  getGlobalSettings: () => runtimeState.getGlobalDashboardSettings(),
  resolveImageLlmConnectionSettingsFromState,
  resolveModel3dLlmConnectionSettingsFromState,
  suggestImageFileName,
  suggestImageDescription,
  updateGeneratedImageDescription,
  renameGeneratedImageFileName,
  getGeneratedImagePublicById,
  toGeneratedImagePublicRecord,
  getGeneratedModelPublicById,
  readGeneratedModelFile,
  buildImageDataUrl,
  suggestModelMetadataViaRemoteWorker,
  suggestModelFileNameAndDescription,
  normalizeModelNameCandidate,
  renameGeneratedModelFileName,
  updateGeneratedModelDescription,
  resolveImagePromptFromBaseImage,
  resolveImagePrompt,
  resolveWorkspaceRelativeAssetPath: assetPath => automationMediaRuntime?.resolveWorkspaceRelativeAssetPath(assetPath) || String(assetPath || "").trim() || undefined,
  generateImageWithExecution,
  buildGeneratedImageEmbed,
  buildGeneratedImageAttachment,
  requireSendableChannel,
  readGeneratedImageFile,
  convertImageWithPixelArtTool,
  importGeneratedImageArtifact,
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const suggestAndRenameGeneratedImageFileName = generatedImageRuntime.suggestAndRenameGeneratedImageFileName;
const regenerateGeneratedImageFileNameWithLlm = generatedImageRuntime.regenerateGeneratedImageFileNameWithLlm;
const regenerateGeneratedModelFileNameWithLlm = generatedImageRuntime.regenerateGeneratedModelFileNameWithLlm;
const generateImageFromPrompt = generatedImageRuntime.generateImageFromPrompt;
const postGeneratedImagesToChannel = generatedImageRuntime.postGeneratedImagesToChannel;
const convertGeneratedImageToPixelArt = generatedImageRuntime.convertGeneratedImageToPixelArt;
automationMediaRuntime = createAutomationMediaRuntime({
  appConfig,
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  },
  getGlobalSettings: () => runtimeState.getGlobalDashboardSettings(),
  resolveGeneratedImageApiSourceToFilePath,
  contentTypeFromImageFileExtension,
  importGeneratedImageArtifact,
  toGeneratedImagePublicRecord,
    readGeneratedImageFile,
    convertImageWithPixelArtTool,
    generateImageFromPrompt,
    resolveGeneratedVideoFilePath,
    convertVideoFileToGif,
    transformGifFrames,
    requireSendableChannel,
    postGeneratedImagesToChannel,
    generateVideoFromPromptLocal,
    toGeneratedVideoPublicRecord,
    gifFrameDownloadPrefix: GIF_FRAME_DOWNLOAD_CUSTOM_ID_PREFIX
  });
const resolvePublicAssetUrl = automationMediaRuntime.resolvePublicAssetUrl;
const resolveWorkspaceRelativeAssetPath = automationMediaRuntime.resolveWorkspaceRelativeAssetPath;
const sendTelegramAutomationMessage = automationMediaRuntime.sendTelegramAutomationMessage;
const sendTelegramAutomationPhoto = automationMediaRuntime.sendTelegramAutomationPhoto;
const sendMatrixAutomationMessage = automationMediaRuntime.sendMatrixAutomationMessage;
const processGeneratedVideoFollowUp = automationMediaRuntime.processGeneratedVideoFollowUp;
const handleGifFrameDownloadButton = automationMediaRuntime.handleGifFrameDownloadButton;

const automationRuntimeService = createAutomationRuntimeService({
  createAutomationEngine,
  askText: prompt => askOllama(prompt, false),
  buildGiftMessageIfAvailable,
  sendMessageToChannel,
  sendTelegramMessage: sendTelegramAutomationMessage,
  sendTelegramPhoto: sendTelegramAutomationPhoto,
  sendMatrixMessage: sendMatrixAutomationMessage,
  generateImageFromPrompt,
  generateVideoFromPrompt: input => automationMediaRuntime.generateVideoFromPromptForAutomation(input),
  processGeneratedVideoFollowUp,
  resolveImagePrompt: (input: { prompt?: string; autoPrompt?: boolean; }) => resolveImagePrompt({
    ...input,
    llmConnectionSettings: resolveImageLlmConnectionSettingsFromState()
  }),
  suggestImageDescription: (input: { prompt: string; }) => suggestImageDescription({
    ...input,
    llmConnectionSettings: resolveImageLlmConnectionSettingsFromState()
  }),
  convertGeneratedImageToPixelArt,
  postGeneratedImagesToChannel,
  getImagePoolEntries,
  runtimeState,
  resolvePublicAssetUrl,
  resolveModelPrompt,
  suggestModelMetadataRemote: suggestModelMetadataViaRemoteWorker,
  suggestModelMetadataLocal: suggestModelFileNameAndDescription,
  suggestLowPolyByComplexity,
  suggestModelMetallicDecisionRemote: suggestModelMetallicDecisionViaRemoteWorker,
  suggestModelMetallicDecisionLocal: suggestModelMetallicDecision,
  suggestModelRealWorldHeightRemote: suggestModelRealWorldHeightViaRemoteWorker,
  suggestModelRealWorldHeightLocal: suggestModelRealWorldHeight,
  applyModelMetallicWithExecution,
  applyModelScaleToHeightWithExecution,
  ejectActiveLlmModelsViaRemoteWorker,
  ejectActiveOllamaModels,
  postModelGenerationStartNotice,
  generate3dModelWithExecution,
  toGeneratedModelPublicRecord,
  renameGeneratedModelFileName,
  mergeContentBlocks,
  postExistingGeneratedModelToChannel,
  getGuildName: guildId => client.guilds.cache.get(guildId)?.name ?? null
});
const automationEngine = automationRuntimeService.createAutomationEngineInstance();
automationEngine.start();
const generatedImageInteractionRuntime = createGeneratedImageInteractionRuntime({
  imageGenerate3dPrefix: IMAGE_GENERATE_3D_BUTTON_CUSTOM_ID_PREFIX,
  imageNewPrefix: IMAGE_NEW_BUTTON_CUSTOM_ID_PREFIX,
  imageNewPromptPrefix: IMAGE_NEW_PROMPT_BUTTON_CUSTOM_ID_PREFIX,
  imageAddToPoolButtonPrefix: IMAGE_ADD_TO_POOL_BUTTON_CUSTOM_ID_PREFIX,
  imageAddToPoolSelectPrefix: IMAGE_ADD_TO_POOL_SELECT_CUSTOM_ID_PREFIX,
  pendingImageModelGenerations,
  pendingImagePoolSelections,
  isProtectedGuildMember,
  canUseVerifiedImagePools,
  parseImageActionPayload,
  parseImageAddToPoolButtonCustomId,
  getGeneratedImagePublicById,
  readGeneratedImageFile,
  buildImageDataUrl,
  resolveModelPrompt,
  resolveModel3dLlmConnectionSettingsFromState,
  generate3dModelWithExecution,
  toGeneratedModelPublicRecord,
  getGlobalSettings: () => runtimeState.getGlobalDashboardSettings(),
  suggestModelMetadataViaRemoteWorker,
  suggestModelFileNameAndDescription,
  renameGeneratedModelFileName,
  markGeneratedImageModelResult,
  toGeneratedImagePublicRecord,
  buildGeneratedImageComponents,
  normalizeModelPostOptions,
  buildModelReadyContent,
  buildGeneratedModelEmbed,
  buildGeneratedModelAttachments,
  buildGeneratedModelComponents,
  resolveImagePrompt,
  resolveImageLlmConnectionSettingsFromState,
  generateImageWithExecution,
  buildGeneratedImageEmbed,
  buildGeneratedImageAttachment,
  summarizeText,
  resolveGeneratedImageApiSourceToFilePath,
  addImageSourceToUserUnverifiedPool,
  listImagePools,
  rememberPendingImagePoolSelection,
  trimSelectLabel,
  addImageSourceToPool,
  recordAction: (type, summary) => {
    runtimeState.recordAction(type, summary);
  }
});
const discordEventRuntime = createDiscordEventRuntime({
  client,
  runtimeState,
  canSendMessages,
  summarizeText,
  refreshConfiguredMemberCounters,
  runAutonomousHeartbeatPass,
  cacheGuildMember,
  updateMemberCounterChannelForGuild,
  getGuildSettings,
  renderWelcomeMessage,
  sendChunkedToChannel,
  automationEngine,
  removeCachedGuildUser,
  selfTaskApprovePrefix: SELF_TASK_APPROVE_CUSTOM_ID_PREFIX,
  selfTaskCancelPrefix: SELF_TASK_CANCEL_CUSTOM_ID_PREFIX,
  imageGenerate3dPrefix: IMAGE_GENERATE_3D_BUTTON_CUSTOM_ID_PREFIX,
  imageNewPrefix: IMAGE_NEW_BUTTON_CUSTOM_ID_PREFIX,
  imageNewPromptPrefix: IMAGE_NEW_PROMPT_BUTTON_CUSTOM_ID_PREFIX,
  modelActionPrefixes: [
    MODEL_UPVOTE_CUSTOM_ID_PREFIX,
    MODEL_DOWNVOTE_CUSTOM_ID_PREFIX,
    MODEL_REFRESH_CUSTOM_ID_PREFIX,
    MODEL_NEW_CUSTOM_ID_PREFIX,
    MODEL_SETTINGS_CUSTOM_ID_PREFIX,
    MODEL_LOWPOLY_CUSTOM_ID_PREFIX,
    MODEL_LOWPOLY_SIZE_CUSTOM_ID_PREFIX,
    MODEL_LOWPOLY_DIMENSIONS_CUSTOM_ID_PREFIX,
    MODEL_LOWPOLY_AUTO_CUSTOM_ID_PREFIX,
    MODEL_LOWPOLY_COMPLEXITY_CUSTOM_ID_PREFIX,
    MODEL_MULTIVIEW_CUSTOM_ID_PREFIX,
    MODEL_UV_CUSTOM_ID_PREFIX,
    MODEL_NORMAL_CUSTOM_ID_PREFIX
  ],
  moderationVetoPrefix: MODERATION_VETO_CUSTOM_ID_PREFIX,
  honeypotVerifyPrefix: HONEYPOT_VERIFY_CUSTOM_ID_PREFIX,
  imageAddToPoolButtonPrefix: IMAGE_ADD_TO_POOL_BUTTON_CUSTOM_ID_PREFIX,
  imageAddToPoolSelectPrefix: IMAGE_ADD_TO_POOL_SELECT_CUSTOM_ID_PREFIX,
  gifFrameDownloadPrefix: GIF_FRAME_DOWNLOAD_CUSTOM_ID_PREFIX,
  handleSelfTaskApproval,
  generatedImageInteractionRuntime,
  handleGifFrameDownloadButton,
  handleGeneratedModelButton,
  handleGeneratedModelModal,
  handleModerationVeto,
  handleHoneypotVerify,
  handleSlashCommand,
  enforceModerationRoleRestrictions,
  duplicateSpamGuard,
  maybeOfferMediaReactionActions,
  maybeHandleChatModeMessage
});
const discordRuntimeControl = createDiscordRuntimeControl({
  client,
  canStartDiscordRuntime,
  discordTokenRuntime,
  getGlobalSettings: () => runtimeState.getGlobalDashboardSettings(),
  dashboardBaseUrl: appConfig.dashboardPublicBaseUrl,
  messengerAdminSharedSecret: appConfig.messengerAdminSharedSecret,
  telegramAdminBaseUrl: appConfig.telegramAdminBaseUrl,
  telegramAdminHost: appConfig.telegramAdminHost,
  telegramAdminPort: appConfig.telegramAdminPort,
  whatsappAdminBaseUrl: appConfig.whatsappAdminBaseUrl,
  whatsappAdminHost: appConfig.whatsappAdminHost,
  whatsappAdminPort: appConfig.whatsappAdminPort
});
const startDiscordRuntime = (tokenOverride?: string) => discordRuntimeControl.startDiscordRuntime(tokenOverride);
const stopDiscordRuntime = () => discordRuntimeControl.stopDiscordRuntime();
const resolveSharedMessengerEnvironment = () => discordRuntimeControl.resolveSharedMessengerEnvironment();
const messengerRuntimeSettings = runtimeState.getGlobalDashboardSettings();
const createLocalMessengerHealthCheck = (baseUrl: string) => async (): Promise<boolean> => {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
      headers: appConfig.messengerAdminSharedSecret ? {"x-messenger-admin-secret": appConfig.messengerAdminSharedSecret} : undefined,
      signal: AbortSignal.timeout(1_500)
    });
    return response.ok;
  } catch {
    return false;
  }
};
const messengerRuntimeManager = createMessengerRuntimeManager({
  startDiscord: startDiscordRuntime,
  stopDiscord: stopDiscordRuntime,
  isDiscordRunning: () => client.isReady(),
  resolveSharedEnvironment: resolveSharedMessengerEnvironment,
  telegram: {
    entryPath: appConfig.telegramBotEntryPath,
    workingDirectory: appConfig.telegramBotWorkingDirectory,
    autoStart: !messengerAutostartDisabled && messengerRuntimeSettings.telegramRuntimeAutostart,
    healthCheck: createLocalMessengerHealthCheck(appConfig.telegramAdminBaseUrl)
  },
  matrix: {
    entryPath: appConfig.matrixBotEntryPath,
    workingDirectory: appConfig.matrixBotWorkingDirectory,
    autoStart: !messengerAutostartDisabled && messengerRuntimeSettings.matrixRuntimeAutostart,
    healthCheck: createLocalMessengerHealthCheck(appConfig.matrixAdminBaseUrl)
  },
  whatsapp: {
    entryPath: appConfig.whatsappBotEntryPath,
    workingDirectory: appConfig.whatsappBotWorkingDirectory,
    autoStart: !messengerAutostartDisabled && messengerRuntimeSettings.whatsappRuntimeAutostart,
    healthCheck: createLocalMessengerHealthCheck(appConfig.whatsappAdminBaseUrl)
  }
});

const dashboardServer = startDashboardServer({
  enabled: appConfig.dashboardEnabled,
  port: appConfig.dashboardPort,
  host: appConfig.dashboardBindHost,
  runtimeState,
  saveDashboardSettings,
  setLlmConnectionSettings: input => {
    setLlmConnectionSettings(input);
  },
  getMessengerRuntimeSnapshot: () => messengerRuntimeManager.getSnapshot(),
  controlMessengerRuntime: async input => messengerRuntimeManager.control(input),
  getBotSnapshot: () => ({
    id: client.user?.id ?? null,
    tag: client.user?.tag ?? null,
    avatarUrl: client.user?.displayAvatarURL({ size: 128, extension: "png" }) ?? null,
    guildCount: client.guilds.cache.size,
    startedAt: new Date().toISOString(),
    dashboardPort: appConfig.dashboardPort
  }),
  askModel: async prompt => {
    const response = await askOllama(prompt, false);
    runtimeState.recordAction("dashboard:ask", summarizeText(prompt));
    return response;
  },
  askModelDetailed: async prompt => {
    const detailed = await askOllamaDetailed(prompt, false);
    runtimeState.recordAction("dashboard:ask", summarizeText(prompt));
    return {
      response: detailed.response,
      reasoning: detailed.reasoning
    };
  },
  askModelDetailedStream: async (prompt, callbacks) => {
    const detailed = await askOllamaDetailedStream(prompt, {
      onReasoningDelta: callbacks.onReasoningDelta,
      onResponseDelta: callbacks.onResponseDelta,
      signal: callbacks.signal
    });
    runtimeState.recordAction("dashboard:ask", summarizeText(prompt));
    return {
      response: detailed.response,
      reasoning: detailed.reasoning
    };
  },
  askVisionModel: async (prompt, images, options) => {
    const response = await askVisionOllama(prompt, images);
    runtimeState.recordAction("dashboard:ask-vision", `${summarizeText(prompt)} | images=${images.length}`);
    return response;
  },
  sendMessageToChannel: async (channelId, content) => {
    await sendMessageToChannel(channelId, content);
    runtimeState.recordAction("dashboard:send-message", `${channelId}: ${summarizeText(content)}`);
  },
  sendDirectMessage: async (userId, content) => {
    await sendDirectMessage(userId, content);
    runtimeState.recordAction("dashboard:send-dm", `${userId}: ${summarizeText(content)}`);
  },
  postGiftToChannel: async channelId => {
    await postGiftToChannel(channelId);
    runtimeState.recordAction("dashboard:post-gift", `Posted gift info to ${channelId}.`);
  },
  postHumbleToChannel: async channelId => {
    await postHumbleToChannel(channelId);
    runtimeState.recordAction("dashboard:post-humble", `Posted Humble bundles to ${channelId}.`);
  },
  listGuilds,
  getGuildPermissionSummary,
  getChannelPermissionSummary,
  listCommandDefinitions: () => commandCatalog.map(entry => ({
    name: entry.name,
    description: entry.description,
    adminOnly: entry.adminOnly
  })),
  getCommandSettings: guildId => {
    const scope = getCommandScopeState(guildId);
    return {
      globalEnabledCommands: scope.globalEnabledCommands,
      guildEnabledCommands: scope.guildEnabledCommands,
      guildDisabledInheritedCommands: scope.guildDisabledInheritedCommands
    };
  },
  saveGlobalCommandSettings: async commandNames => {
    await persistCommandSettings({
      ...commandSettings,
      globalEnabledCommands: [...new Set(commandNames)]
    });
    return getCommandScopeState(null);
  },
  saveGuildCommandSettings: async (guildId, input) => {
    const nextSettings: CommandSettings = {
      ...commandSettings,
      globalEnabledCommands: [...commandSettings.globalEnabledCommands],
      guildEnabledCommands: {
        ...commandSettings.guildEnabledCommands,
        [guildId]: input.guildEnabledCommands ? [...new Set(input.guildEnabledCommands)] : [...(commandSettings.guildEnabledCommands[guildId] ?? [])]
      },
      guildDisabledInheritedCommands: {
        ...commandSettings.guildDisabledInheritedCommands,
        [guildId]: input.guildDisabledInheritedCommands ? [...new Set(input.guildDisabledInheritedCommands)] : [...(commandSettings.guildDisabledInheritedCommands[guildId] ?? [])]
      }
    };
    await persistCommandSettings(nextSettings);
    return getCommandScopeState(guildId);
  },
  syncGlobalCommands: async () => ({ syncedCount: await syncGlobalCommands() }),
  syncGuildCommands: async guildId => ({ syncedCount: await syncGuildCommands(guildId) }),
  getBotInviteUrl: guildId => buildBotInviteUrl(guildId),
  getGuildDashboardSettings: guildId => runtimeState.getGuildDashboardSettings(guildId),
  getChatModeDebugStatus: (guildId, channelId) => runtimeState.getChatModeDebugStatus(guildId, channelId),
  listChannels,
  getChannelSettings: getChannelSettingsForGuild,
  saveChannelSettings: async (guildId, channelId, update) => {
    const settings = await saveChannelSettingsForGuild(guildId, channelId, update);
    runtimeState.recordAction("dashboard:channel-settings", `Saved channel settings for ${channelId} in ${guildId}.`);
    return settings;
  },
  reorderGuildChannel: async (guildId, input) => {
    await reorderGuildChannelInGuild(guildId, input);
    runtimeState.recordAction("dashboard:reorder-channel", `Moved ${input.kind} ${input.channelId} in ${guildId} to ${input.position}.`);
  },
  createGuildChannel: async (guildId, input) => {
    const created = await createGuildChannelInGuild(guildId, input);
    runtimeState.recordAction("dashboard:create-channel", `Created ${created.kind.toLowerCase()} ${created.name} in ${guildId}.`);
    return created;
  },
  createThread: async (guildId, input) => {
    const created = await createThreadInGuild(guildId, input);
    runtimeState.recordAction("dashboard:create-thread", `Created thread ${created.name} in ${input.channelId}.`);
    return created;
  },
  createPost: async (guildId, input) => {
    const created = await createPostInGuild(guildId, input);
    runtimeState.recordAction("dashboard:create-post", `Created post in ${input.channelId}.`);
    return created;
  },
  listGuildInvites: async guildId => listGuildInvitesForGuild(guildId),
  createGuildInvite: async (guildId, input) => {
    const invite = await createGuildInviteForGuild(guildId, input);
    runtimeState.recordAction("dashboard:create-invite", `Created invite ${invite.code} in ${guildId}.`);
    return invite;
  },
  replaceGuildInvite: async (guildId, code, input) => {
    const invite = await replaceGuildInviteForGuild(guildId, code, input);
    runtimeState.recordAction("dashboard:replace-invite", `Replaced invite ${code} in ${guildId} with ${invite.code}.`);
    return invite;
  },
  deleteGuildInvite: async (guildId, code) => {
    const deleted = await deleteGuildInviteForGuild(guildId, code);
    runtimeState.recordAction("dashboard:delete-invite", `Deleted invite ${code} in ${guildId}.`);
    return deleted;
  },
  planGuildChannels: async (guildId, prompt) => {
    const plan = await planGuildChannelsWithRod(guildId, prompt);
    runtimeState.recordAction("dashboard:guild-plan", `Planned ${plan.entries.reduce((count, entry) => count + entry.channels.length, 0)} channel(s) for ${guildId}.`);
    return plan;
  },
  applyGuildChannelPlan: async (guildId, plan) => {
    const result = await applyGuildChannelPlan(guildId, plan);
    runtimeState.recordAction("dashboard:guild-plan-apply", `Created ${result.createdChannels} channel(s) and ${result.createdCategories} categor${result.createdCategories === 1 ? "y" : "ies"} in ${guildId}.`);
    return result;
  },
  auditGuildWithLlm: async (guildId, prompt) => {
    const result = await auditGuildWithRod(guildId, prompt);
    runtimeState.recordAction("dashboard:guild-audit", `Audited guild ${guildId} with LazyDev.`);
    return result;
  },
  joinVoiceChannel: async (guildId, channelId) => {
    await joinVoiceChannelForGuild(guildId, channelId);
    runtimeState.recordAction("dashboard:voice-join", `Joined voice channel ${channelId} in ${guildId}.`);
  },
  disconnectVoiceChannel: async guildId => {
    const previousChannelId = voiceManager.getConnectedChannelId(guildId);
    await disconnectVoiceChannelForGuild(guildId);
    runtimeState.recordAction("dashboard:voice-disconnect", `Disconnected from ${previousChannelId ?? "voice"} in ${guildId}.`);
  },
  simulateModeration: async input => {
    const result = await simulateModerationCheck(
      input.text,
      input.images,
      input.guildId
        ? runtimeState.getGuildDashboardSettings(input.guildId)
        : runtimeState.getGuildDashboardSettings("default")
    );
    runtimeState.recordAction(
      "dashboard:moderation-simulate",
      `duplicate=${result.wouldFlagDuplicatePost} monitoredImage=${result.wouldFlagMonitoredImageChannel} images=${input.images.length}`
    );
    return result;
  },
  searchUsers,
  fetchUsers,
  listRoles,
  getGuildSettings,
  saveGuildSettings: async (guildId, update) => {
    const settings = await updateGuildSettings(guildId, update);
    if ("memberCounterChannelId" in update || "memberCounterTemplate" in update) {
      await updateMemberCounterChannelForGuild(guildId);
    }
    return settings;
  },
  assignRoleToUser,
  removeRoleFromUser,
  createInvestigationRole: createInvestigationRoleForGuild,
  createTemporaryImageBlockRole: createTemporaryImageBlockRoleForGuild,
  refreshMemberCounter: async guildId => {
    await updateMemberCounterChannelForGuild(guildId);
  },
  listRecentBotMessages: async channelId => listRecentBotMessages(channelId),
  editBotMessage: async (channelId, messageId, content) => {
    const edited = await editBotAuthoredMessage(channelId, messageId, content);
    runtimeState.recordAction("dashboard:edit-message", `Edited bot message ${messageId} in ${channelId}.`);
    return edited;
  },
  listDirectMessages,
  getDirectMessageEntries,
  listOllamaModels,
  getActiveOllamaModels,
  setActiveOllamaModels,
  describeImageWithVision: async input => describeImageWithVision({
    ...input,
    llmConnectionSettings: resolveImageLlmConnectionSettingsFromState()
  }),
  resolveImagePromptFromBaseImage: async input => resolveImagePromptFromBaseImage({
    ...input,
    llmConnectionSettings: resolveImageLlmConnectionSettingsFromState()
  }),
  listAutomationPresets: async () => automationPresets,
  listAutomationTextSources,
  readAutomationTextSourcePreview,
  saveAutomationTextSource,
  listImagePools,
  saveImagePool,
  deleteImagePool,
  generateAutomationTextSource: async input => {
    const content = await askOllama(input.prompt);
    const summary = await saveGeneratedAutomationText({
      fileName: input.fileName,
      content,
      mode: input.mode
    });
    return {
      summary,
      content
    };
  },
  listGeneratedModels: async () => listGeneratedModelsPublic(),
  inspectGeneratedModel: async input => {
    const executionTarget = input.executionTarget ?? runtimeState.getGlobalDashboardSettings().model3dMetadataTarget;
    if (executionTarget === "remote") {
      return inspectModelArtifactViaRemoteWorker({
        modelId: input.modelId,
        variant: input.variant
      });
    }
    return inspectGeneratedModelArtifact({
      modelId: input.modelId,
      variant: input.variant
    });
  },
  validateGeneratedModel: async input => {
    const executionTarget = input.executionTarget ?? runtimeState.getGlobalDashboardSettings().model3dMetadataTarget;
    if (executionTarget === "remote") {
      return validateModelArtifactViaRemoteWorker({
        modelId: input.modelId,
        variant: input.variant
      });
    }
    return validateGeneratedModelArtifact({
      modelId: input.modelId,
      variant: input.variant
    });
  },
  indexGeneratedModelAssets: async input => {
    const executionTarget = input?.executionTarget ?? runtimeState.getGlobalDashboardSettings().model3dMetadataTarget;
    return executionTarget === "remote" ? indexGeneratedModelAssetsViaRemoteWorker() : indexGeneratedModelStoreWithRust();
  },
  captureGeneratedModelArtifact: async input => {
    const executionTarget = input.executionTarget ?? "local";
    if (executionTarget === "remote") {
      throw new Error("Remote Blender capture is not wired yet. Use local Blender mode for this 3D quick action.");
    }
    return captureGeneratedModelArtifact({
      modelId: input.modelId,
      variant: input.variant,
      action: input.action,
      options: input.options
    });
  },
  probeMediaAsset: async input => {
    const executionTarget = input.executionTarget ?? "local";
    if (executionTarget === "remote") {
      return probeMediaAssetViaRemoteWorker(input);
    }
    return probeGeneratedMediaAssetWithRust(input);
  },
  postModelGenerationStartNotice: async input => {
    return postModelGenerationStartNotice({
      channelId: input.channelId,
      imageInput: input.imageInput,
      imageFileNameHint: input.imageFileNameHint,
      prompt: input.prompt,
      requestedBy: input.requestedBy ?? "dashboard"
    });
  },
  suggestModelMetadata: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const model3dLlmConnectionSettings = resolveModel3dLlmConnectionSettingsFromState();
    const promptText = input.prompt?.trim() || "";
    const preferVisual = input.preferVisualModel === true || globalSettings.ollamaTextModelIsVisual;
    const fallbackPrompt = promptText || (input.imageInput?.trim()
      ? "Generate a concise file name and one short Discord description for this source image."
      : "");
    if (!fallbackPrompt) {
      return {
        fileName: null,
        description: null
      };
    }
    const sourceImageInput = !promptText ? (input.imageInput?.trim() || "") : "";
    const executionTarget = input.executionTarget ?? globalSettings.model3dMetadataTarget;
    if (executionTarget === "remote") {
      return suggestModelMetadataViaRemoteWorker({
        prompt: fallbackPrompt,
        imageInput: sourceImageInput || undefined,
        preferVisualModel: preferVisual
      });
    }
    return suggestModelFileNameAndDescription({
      prompt: fallbackPrompt,
      sourceImageInput: sourceImageInput || undefined,
      preferVisualModel: preferVisual,
      llmConnectionSettings: model3dLlmConnectionSettings
    });
  },
  suggestLowPolyTargetFaceCount: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input.executionTarget ?? globalSettings.model3dMetadataTarget;
    const preferVisual = input.preferVisualModel === true || globalSettings.ollamaTextModelIsVisual;
    return suggestLowPolyByComplexity({
      promptContext: input.prompt?.trim() || "",
      sourceImageInput: input.imageInput?.trim() || "",
      extraContext: input.context?.trim() || "",
      preferVisualModel: preferVisual,
      executionTarget
    });
  },
  suggestModelRealWorldHeight: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const model3dLlmConnectionSettings = resolveModel3dLlmConnectionSettingsFromState();
    const promptContext = input.prompt?.trim() || "";
    const executionTarget = input.executionTarget ?? globalSettings.model3dMetadataTarget;
    const preferVisual = input.preferVisualModel === true || globalSettings.ollamaTextModelIsVisual;
    if (executionTarget === "remote") {
      return suggestModelRealWorldHeightViaRemoteWorker({
        prompt: promptContext,
        imageInput: input.imageInput?.trim() || undefined,
        context: input.context?.trim() || undefined,
        preferVisualModel: preferVisual
      });
    }
    return suggestModelRealWorldHeight({
      promptContext,
      sourceImageInput: input.imageInput?.trim() || undefined,
      extraContext: input.context?.trim() || undefined,
      preferVisualModel: preferVisual,
      llmConnectionSettings: model3dLlmConnectionSettings
    });
  },
  generateLowPolyFromUploadedModel: async input => {
    return generateLowPolyFromUploadedModel({
      fileName: input.fileName,
      fileData: input.fileData,
      contentType: input.contentType,
      useLlmTargetFaces: input.useLlmTargetFaces,
      targetFaceCount: input.targetFaceCount,
      prompt: input.prompt,
      context: input.context
    });
  },
  generateLowPolyForModel: async input => {
    return generateLowPolyForModel({
      modelId: input.modelId,
      useLlmTargetFaces: input.useLlmTargetFaces,
      targetFaceCount: input.targetFaceCount,
      llmMinTargetFaceCount: input.llmMinTargetFaceCount,
      llmMaxTargetFaceCount: input.llmMaxTargetFaceCount,
      executionTarget: input.executionTarget,
      llmDecisionSource: input.llmDecisionSource,
      prompt: input.prompt,
      context: input.context
    });
  },
  applyModelSeparateByLooseParts: async input => {
    const executionTarget = input.executionTarget ?? runtimeState.getGlobalDashboardSettings().model3dGenerationTarget;
    if (executionTarget === "remote" && appConfig.remoteWorkerBaseUrl.trim()) {
      try {
        return await generateSplitByLoosePartsModelViaRemoteWorker({
          modelId: input.modelId,
          exportMode: input.exportMode,
          mergeDistance: input.mergeDistance
        });
      } catch (error) {
        console.warn("Remote separate-by-loose-parts failed. Falling back to local execution.", error);
      }
    }
    return applyGeneratedModelSeparateByLooseParts({
      modelId: input.modelId,
      exportMode: input.exportMode,
      mergeDistance: input.mergeDistance
    });
  },
  applyModelAlbedoToGeometry: async input => {
    return applyGeneratedModelAlbedoToGeometry(input);
  },
  applyMaterialToModel: async input => {
    return applyGeneratedModelMaterialFinish({
      modelId: input.modelId,
      metallicEnabled: typeof input.metallicEnabled === "boolean" ? input.metallicEnabled : null,
      roughnessValue: typeof input.roughnessValue === "number" && Number.isFinite(input.roughnessValue)
        ? input.roughnessValue
        : null
    });
  },
  applyModelScaleToHeight: async input => {
    return applyModelScaleToHeightWithExecution({
      modelId: input.modelId,
      targetHeightMeters: input.targetHeightMeters
    }, input.executionTarget);
  },
  applyAutoRigToModel: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    if (executionTarget === "remote") {
      return applyAutoRigToModelViaRemoteWorker({
        modelId: input.modelId,
        rigProfile: input.rigProfile,
        useVision: input.useVision,
        landmarks: input.landmarks ?? null
      });
    }
    return applyAutoRigToGeneratedModel({
      modelId: input.modelId,
      rigProfile: input.rigProfile,
      useVision: input.useVision,
      landmarks: input.landmarks ?? null
    });
  },
  previewAutoRigForModel: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    if (executionTarget === "remote") {
      return previewAutoRigForModelViaRemoteWorker({
        modelId: input.modelId,
        rigProfile: input.rigProfile,
        useVision: input.useVision,
        landmarks: input.landmarks ?? null
      });
    }
    return previewAutoRigForGeneratedModel({
      modelId: input.modelId,
      rigProfile: input.rigProfile,
      useVision: input.useVision,
      landmarks: input.landmarks ?? null
    });
  },
  openGeneratedModelInBlender: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const record = await getGeneratedModelPublicById(input.modelId);
    if (!record) {
      throw new Error("Generated model was not found.");
    }
    const requestedFileName = String(input.fileName || "").trim();
    const variant = input.variant === "lowpoly" || input.variant === "original" || input.variant === "albedo" ? input.variant : "current";
    const fileName = requestedFileName
      || (variant === "lowpoly"
        ? record.lowPolyModelFileName || record.modelFileName
        : variant === "albedo"
          ? record.albedoGeometryModelFileName || record.modelFileName
          : (variant === "original" ? record.originalModelFileName || record.modelFileName : record.modelFileName));
    const assetPath = await resolveGeneratedModelFilePath(record.id, fileName);
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    if (executionTarget === "remote") {
      return {
        ...(await openModelInBlenderViaRemoteWorker({ assetPath, label: fileName })),
        fileName
      };
    }
    return {
      ...(await blenderOpenService.openAssetInBlender({ mode: "model", assetPath, label: fileName })),
      fileName
    };
  },
  openGeneratedModelsInBlender: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    const assets = [];
    const fileNames = [];
    for (const item of input.items) {
      const record = await getGeneratedModelPublicById(item.modelId);
      if (!record) {
        throw new Error("Generated model was not found.");
      }
      const requestedFileName = String(item.fileName || "").trim();
      const variant = item.variant === "lowpoly" || item.variant === "original" || item.variant === "albedo" ? item.variant : "current";
      const fileName = requestedFileName
        || (variant === "lowpoly"
          ? record.lowPolyModelFileName || record.modelFileName
          : variant === "albedo"
            ? record.albedoGeometryModelFileName || record.modelFileName
            : (variant === "original" ? record.originalModelFileName || record.modelFileName : record.modelFileName));
      const assetPath = await resolveGeneratedModelFilePath(record.id, fileName);
      assets.push({ mode: "model" as const, assetPath, label: fileName });
      fileNames.push(fileName);
    }
    if (executionTarget === "remote") {
      return {
        ...(await openAssetsInBlenderViaRemoteWorker({ assets })),
        fileNames
      };
    }
    return {
      ...(await blenderOpenService.openAssetsInBlender({ assets })),
      fileNames
    };
  },
  openGeneratedImageInBlender: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const record = await getGeneratedImagePublicById(input.imageId);
    if (!record) {
      throw new Error("Generated image was not found.");
    }
    const fileName = String(input.fileName || "").trim() || record.imageFileName;
    const assetPath = await resolveGeneratedImageFilePath(record.id, fileName);
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    if (executionTarget === "remote") {
      return {
        ...(await openImageInBlenderViaRemoteWorker({
          dataUrl: await readImageAssetDataUrlForRemoteWorker(assetPath, fileName),
          fileName,
          label: fileName
        })),
        fileName
      };
    }
    return {
      ...(await blenderOpenService.openAssetInBlender({ mode: "image-plane", assetPath, label: fileName })),
      fileName
    };
  },
  openImagesInBlender: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    const assets = [];
    const fileNames = [];
    for (const item of input.items) {
      const imageId = String(item.imageId || "").trim();
      const dataUrl = String(item.imageDataUrl || "").trim();
      if (imageId) {
        const record = await getGeneratedImagePublicById(imageId);
        if (!record) {
          throw new Error("Generated image was not found.");
        }
        const fileName = String(item.fileName || "").trim() || record.imageFileName;
        const assetPath = await resolveGeneratedImageFilePath(record.id, fileName);
        assets.push(executionTarget === "remote"
          ? { mode: "image-plane" as const, dataUrl: await readImageAssetDataUrlForRemoteWorker(assetPath, fileName), fileName, label: fileName }
          : { mode: "image-plane" as const, assetPath, label: fileName });
        fileNames.push(fileName);
        continue;
      }
      if (dataUrl) {
        const fileName = String(item.fileName || "").trim() || "image-plane.png";
        assets.push({ mode: "image-plane" as const, dataUrl, fileName, label: item.label || fileName });
        fileNames.push(fileName);
      }
    }
    if (assets.length === 0) {
      throw new Error("No images were provided for Blender import.");
    }
    if (executionTarget === "remote") {
      return {
        ...(await openAssetsInBlenderViaRemoteWorker({ assets })),
        fileNames
      };
    }
    return {
      ...(await blenderOpenService.openAssetsInBlender({ assets })),
      fileNames
    };
  },
  openImageDataInBlender: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    if (executionTarget === "remote") {
      return openImageInBlenderViaRemoteWorker({
        dataUrl: input.dataUrl,
        fileName: input.fileName,
        label: input.label
      });
    }
    return blenderOpenService.openImageDataInBlender({
      dataUrl: input.dataUrl,
      fileName: input.fileName,
      label: input.label
    });
  },
  editUploadedModel: async input => {
    return editUploadedModel({
      fileName: input.fileName,
      fileData: input.fileData,
      contentType: input.contentType,
      prompt: input.prompt,
      context: input.context,
      useLlmHeight: input.useLlmHeight,
      targetHeightMeters: input.targetHeightMeters,
      executionTarget: input.executionTarget,
      metallicEnabled: input.metallicEnabled,
      roughnessValue: input.roughnessValue
    });
  },
  editGeneratedModel: async input => {
    return editGeneratedModel({
      modelId: input.modelId,
      prompt: input.prompt,
      context: input.context,
      useLlmHeight: input.useLlmHeight,
      targetHeightMeters: input.targetHeightMeters,
      executionTarget: input.executionTarget,
      metallicEnabled: input.metallicEnabled,
      roughnessValue: input.roughnessValue
    });
  },
  ejectActiveLlmModels: async executionTarget => {
    if (executionTarget === "remote") {
      return ejectActiveLlmModelsViaRemoteWorker();
    }
    return ejectActiveOllamaModels();
  },
  loadActiveLlmModels: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input?.executionTarget ?? globalSettings.model3dMetadataTarget;
    const scope = input?.scope === "text" || input?.scope === "vision" ? input.scope : "both";
    const contextLength = typeof input?.contextLength === "number" && Number.isFinite(input.contextLength)
      ? Math.max(0, Math.round(input.contextLength))
      : globalSettings.lmStudioContextLength;
    if (input?.textModel || input?.visionModel) {
      setActiveOllamaModels({ textModel: input.textModel, visionModel: input.visionModel });
    }
    if (executionTarget === "remote") {
      return loadActiveLlmModelsViaRemoteWorker(scope, contextLength, {
        textModel: input?.textModel,
        visionModel: input?.visionModel
      });
    }
    return loadActiveOllamaModels(scope, { lmStudioContextLength: contextLength });
  },
  listGeneratedImages: async () => listGeneratedImagesPublic(),
  importGeneratedImage: async input => {
    const now = new Date().toISOString();
    const imported = await importGeneratedImageArtifact({
      record: {
        id: input.desiredId || `imported-${Date.now()}`,
        createdAt: now,
        prompt: input.prompt || "",
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        comfyPromptId: "dashboard-import",
        generationDurationSeconds: null,
        imageFileName: input.imageFileName,
        seed: typeof input.seed === "number" && Number.isFinite(input.seed) ? Math.max(0, Math.round(input.seed)) : 1,
        steps: typeof input.steps === "number" && Number.isFinite(input.steps) ? Math.max(1, Math.round(input.steps)) : null,
        cfg: typeof input.cfg === "number" && Number.isFinite(input.cfg) ? Math.max(0, input.cfg) : null,
        width: typeof input.width === "number" && Number.isFinite(input.width) ? Math.max(1, Math.round(input.width)) : null,
        height: typeof input.height === "number" && Number.isFinite(input.height) ? Math.max(1, Math.round(input.height)) : null,
        model: input.model || "dashboard-import",
        modelGeneratedAt: null,
        modelGeneratedModelId: null,
        ...(input.metadata ? { metadata: input.metadata } : {})
      },
      imageData: input.imageData
    });
    return toGeneratedImagePublicRecord(imported);
  },
  listGeneratedAudios: async () => listGeneratedAudiosPublic(),
  listGeneratedVideos: async () => listGeneratedVideosPublic(),
  generate3dModelFromImage: async input => {
    const globalSettings = runtimeState.getGlobalDashboardSettings();
    const executionTarget = input.executionTarget ?? globalSettings.model3dGenerationTarget;
    const metadataExecutionTarget = input.metadataExecutionTarget ?? globalSettings.model3dMetadataTarget;
    const askLlmIfModelShouldBeMetallic = input.askLlmIfModelShouldBeMetallic === true;
    const askLlmForRealWorldHeightAndScale = input.askLlmForRealWorldHeightAndScale === true;
    const legacyUseLlmMetadata = input.useLlmMetadata === true;
    const useLlmModelFileName = typeof input.useLlmModelFileName === "boolean" ? input.useLlmModelFileName : legacyUseLlmMetadata;
    const useLlmModelDescription = typeof input.useLlmModelDescription === "boolean" ? input.useLlmModelDescription : legacyUseLlmMetadata;
    const useLlmMetadata = useLlmModelFileName || useLlmModelDescription;
    const metadataTiming = input.metadataTiming === "before" || input.metadataTiming === "parallel"
      ? input.metadataTiming
      : "after";
    const shouldUnloadLlmBeforeGenerate = (typeof input.unloadLlmBeforeGenerate === "boolean"
      ? input.unloadLlmBeforeGenerate
      : globalSettings.unloadLlmBeforeModel3dGeneration) && !(useLlmMetadata && metadataTiming === "parallel");
    if (shouldUnloadLlmBeforeGenerate) {
      const llmExecutionTarget = metadataExecutionTarget;
      const unloadResult = llmExecutionTarget === "remote"
        ? await ejectActiveLlmModelsViaRemoteWorker()
        : await ejectActiveOllamaModels();
      if (unloadResult.failed.length > 0) {
        console.warn("Pre-generation LLM unload had failures.", unloadResult.failed);
      }
    }
    const promptText = await resolveModelPrompt({
      prompt: input.prompt,
      autoPrompt: input.autoPrompt,
      llmConnectionSettings: resolveModel3dLlmConnectionSettingsFromState()
    });
    const providedPromptText = input.prompt?.trim() || "";
    const metadataPromptText = providedPromptText || promptText.trim();
    const metadataPrompt = metadataPromptText || "Generate a concise file name and one short Discord description for this source image.";
    const metadataSourceImageInput = !metadataPromptText ? (input.imageInput?.trim() || "") : "";
    type ModelMetallicDecisionAction = "enabled" | "disabled" | "skipped";
    type ModelRealWorldHeightDecisionAction = "scaled" | "skipped";
    const runModelMetallicDecision = async (): Promise<ModelMetallicDecision> => {
      const promptContext = metadataPromptText || promptText.trim() || providedPromptText;
      const sourceImageInput = input.imageInput?.trim() || "";
      const extraContext = input.imageFileNameHint?.trim() || "";
      if (metadataExecutionTarget === "remote") {
        return suggestModelMetallicDecisionViaRemoteWorker({
          prompt: promptContext || undefined,
          imageInput: sourceImageInput || undefined,
          context: extraContext || undefined,
          preferVisualModel: true
        });
      }
      return suggestModelMetallicDecision({
        promptContext: promptContext || undefined,
        sourceImageInput: sourceImageInput || undefined,
        extraContext: extraContext || undefined,
        preferVisualModel: true,
        llmConnectionSettings: resolveModel3dLlmConnectionSettingsFromState()
      });
    };
    const runModelRealWorldHeightDecision = async (): Promise<ModelRealWorldHeightDecision> => {
      const promptContext = metadataPromptText || promptText.trim() || providedPromptText;
      const sourceImageInput = input.imageInput?.trim() || "";
      const extraContext = input.imageFileNameHint?.trim() || "";
      if (metadataExecutionTarget === "remote") {
        return suggestModelRealWorldHeightViaRemoteWorker({
          prompt: promptContext || undefined,
          imageInput: sourceImageInput || undefined,
          context: extraContext || undefined,
          preferVisualModel: true
        });
      }
      return suggestModelRealWorldHeight({
        promptContext: promptContext || undefined,
        sourceImageInput: sourceImageInput || undefined,
        extraContext: extraContext || undefined,
        preferVisualModel: true,
        llmConnectionSettings: resolveModel3dLlmConnectionSettingsFromState()
      });
    };
    const runModelMetadataSuggestion = async (): Promise<{ fileName: string | null; description: string | null; }> => {
      if (!useLlmMetadata) {
        return {
          fileName: null,
          description: null
        };
      }
      if (metadataExecutionTarget === "remote") {
        return suggestModelMetadataViaRemoteWorker({
          prompt: metadataPrompt,
          imageInput: metadataSourceImageInput || undefined,
          preferVisualModel: globalSettings.ollamaTextModelIsVisual
        });
      }
      return suggestModelFileNameAndDescription({
        prompt: metadataPrompt,
        sourceImageInput: metadataSourceImageInput || undefined,
        preferVisualModel: globalSettings.ollamaTextModelIsVisual,
        llmConnectionSettings: resolveModel3dLlmConnectionSettingsFromState()
      });
    };
    let plannedMetadata: { fileName: string | null; description: string | null; } = {
      fileName: null,
      description: null
    };
    let plannedMetadataPromise: Promise<{ fileName: string | null; description: string | null; }> | null = null;
    if (useLlmMetadata && metadataTiming === "before") {
      try {
        plannedMetadata = await runModelMetadataSuggestion();
      } catch (error) {
        console.warn("Failed to generate model metadata before 3D generation.", error);
      }
    } else if (useLlmMetadata && metadataTiming === "parallel") {
      plannedMetadataPromise = runModelMetadataSuggestion();
    }
    let generated = toGeneratedModelPublicRecord(await generate3dModelWithExecution({
      imageInput: input.imageInput,
      multiViewImageInputs: input.multiViewImageInputs,
      imageFileNameHint: input.imageFileNameHint,
      meshInput: input.meshInput,
      meshFileNameHint: input.meshFileNameHint,
      workflowPathOverride: input.workflowPathOverride,
      workflowImageInputNodeId: input.workflowImageInputNodeId,
      workflowMeshInputNodeId: input.workflowMeshInputNodeId,
      workflowOutputNodeId: input.workflowOutputNodeId,
      workflowPreviewNodeId: input.workflowPreviewNodeId,
      prompt: promptText || undefined,
      seed: input.seed,
      stripMetadata: typeof input.stripMetadata === "boolean" ? input.stripMetadata : globalSettings.stripMetadataWebUiImages,
      onPromptQueued: input.onPromptQueued,
      signal: input.signal,
      onModelReady: input.onModelReady
        ? async record => {
          await input.onModelReady?.(toGeneratedModelPublicRecord(record));
        }
        : undefined
    }, executionTarget));
    let metallicDecision: (ModelMetallicDecision & { action: ModelMetallicDecisionAction }) | null = null;
    let realWorldHeightDecision: (ModelRealWorldHeightDecision & { action: ModelRealWorldHeightDecisionAction }) | null = null;
    let postExtraContent = input.extraContent;
    if (useLlmMetadata && metadataTiming === "before") {
      if (useLlmModelFileName && plannedMetadata.fileName) {
        try {
          generated = await renameGeneratedModelFileName(generated.id, plannedMetadata.fileName);
        } catch (error) {
          console.warn("Failed to apply pre-generated model filename metadata.", error);
        }
      }
      if (useLlmModelDescription && plannedMetadata.description) {
        generated = await updateGeneratedModelDescription(generated.id, plannedMetadata.description);
      }
    }
    postExtraContent = buildModelPostSummaryExtraContent({
      modelFileName: generated.modelFileName,
      description: useLlmModelDescription ? plannedMetadata.description : null,
      prompt: generated.prompt,
      extraContent: postExtraContent
    });
    if (askLlmIfModelShouldBeMetallic) {
      try {
        const decision = await runModelMetallicDecision();
        if (decision.classification === "metallic") {
          generated = await applyModelMetallicWithExecution({
            modelId: generated.id,
            metallicEnabled: true
          }, executionTarget);
          metallicDecision = {
            ...decision,
            action: "enabled"
          };
        } else if (decision.classification === "non-metallic") {
          generated = await applyModelMetallicWithExecution({
            modelId: generated.id,
            metallicEnabled: false
          }, executionTarget);
          metallicDecision = {
            ...decision,
            action: "disabled"
          };
        } else {
          metallicDecision = {
            ...decision,
            action: "skipped"
          };
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message.trim() : String(error).trim();
        metallicDecision = {
          classification: "mixed",
          reason: detail || "Metallic decision failed; skipped.",
          usedVisionModel: false,
          action: "skipped"
        };
        console.warn("Failed metallic decision/apply flow. Continuing without metallic override.", error);
      }
    }
    if (askLlmForRealWorldHeightAndScale) {
      try {
        const decision = await runModelRealWorldHeightDecision();
        generated = await applyModelScaleToHeightWithExecution({
          modelId: generated.id,
          targetHeightMeters: decision.heightMeters
        }, executionTarget);
        realWorldHeightDecision = {
          ...decision,
          action: "scaled"
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message.trim() : String(error).trim();
        realWorldHeightDecision = {
          objectLabel: "object",
          heightMeters: 1.8,
          reason: detail || "Real-world scale decision failed; skipped.",
          usedVisionModel: false,
          action: "skipped"
        };
        console.warn("Failed real-world height/scale flow. Continuing without scaling override.", error);
      }
    }
    if (useLlmMetadata && metadataTiming !== "before") {
      const generatedModelId = generated.id;
      setTimeout(() => {
        void (async () => {
          const metadata = metadataTiming === "parallel" && plannedMetadataPromise
            ? await plannedMetadataPromise
            : await runModelMetadataSuggestion();
          if (!metadata.fileName && !metadata.description) {
            return;
          }
          if (useLlmModelFileName && metadata.fileName) {
            const renamed = await renameGeneratedModelFileName(generatedModelId, metadata.fileName);
            runtimeState.recordAction("dashboard:model3d-filename", `Updated model filename via LLM for ${renamed.id}.`);
          }
          if (useLlmModelDescription && metadata.description) {
            const described = await updateGeneratedModelDescription(generatedModelId, metadata.description);
            runtimeState.recordAction("dashboard:model3d-description", `Updated model description via LLM for ${described.id}.`);
          }
        })().catch(error => {
          console.warn("Failed to generate model metadata after/parallel 3D generation.", error);
        });
      }, 0);
    }
    if (input.channelId) {
      await postGeneratedModelWithRouting({
        channelId: input.channelId,
        generated,
        requestedBy: input.requestedBy ?? "dashboard",
        messageMode: "public",
        postOptions: {
          targetMode: input.postTargetMode,
          threadNameMode: input.threadNameMode,
          threadName: input.threadName,
          threadNameBase: input.threadNameBase,
          modelNameSource: input.modelNameSource,
          forumChannelId: input.forumChannelId,
          forumChannelName: input.forumChannelName,
          lowPolyForumChannelId: input.lowPolyForumChannelId,
          lowPolyForumChannelName: input.lowPolyForumChannelName,
          sendInitialToSelectedChannel: input.sendInitialToSelectedChannel,
          initialExtraText: input.initialExtraContent,
          destinationExtraText: postExtraContent,
          modelUploadTarget: input.modelUploadTarget,
          includeModelFile: input.includeModelFile,
          includePreviewMedia: input.includePreviewMedia,
          includeEmbed: input.includeEmbed,
          includeEmbedInInitial: input.includeEmbedInInitial,
          includeButtons: input.includeButtons,
          uploadTextureMessages: input.uploadTextureMessages,
          uploadMultiViewTextures: input.uploadMultiViewTextures,
          uploadUvMapTextures: input.uploadUvMapTextures,
          uploadNormalMapTextures: input.uploadNormalMapTextures,
          textureUploadTarget: input.textureUploadTarget,
          generateLowPolyVersion: input.generateLowPolyVersion,
          lowPolyUseLlmTargetFaces: input.lowPolyUseLlmTargetFaces,
          lowPolyLlmDecisionSource: input.lowPolyLlmDecisionSource,
          lowPolyTargetFaceCount: input.lowPolyTargetFaceCount
        }
      });
    }
    const response: GeneratedModelPublicRecord & {
      metallicDecision?: {
        classification: "metallic" | "non-metallic" | "mixed";
        reason: string;
        usedVisionModel: boolean;
        action: "enabled" | "disabled" | "skipped";
      } | null;
      realWorldHeightDecision?: {
        objectLabel: string;
        heightMeters: number;
        reason: string;
        usedVisionModel: boolean;
        action: "scaled" | "skipped";
      } | null;
    } = metallicDecision || realWorldHeightDecision
      ? { ...generated, metallicDecision, realWorldHeightDecision }
      : generated;
    return response;
  },
  generateImageFromPrompt,
  regenerateGeneratedImageFileName: async input => {
    return regenerateGeneratedImageFileNameWithLlm(input);
  },
  regenerateGeneratedModelFileName: async input => {
    return regenerateGeneratedModelFileNameWithLlm(input);
  },
  generateAudioFromPrompt: async input => {
    const prompt = input.prompt?.trim() ?? "";
    if (!prompt) {
      throw new Error("Prompt is required for audio generation.");
    }
    const generated = toGeneratedAudioPublicRecord(await generateAudioWithExecution({
      prompt,
      seconds: input.seconds,
      onPromptQueued: input.onPromptQueued,
      signal: input.signal
    }));
    if (input.channelId) {
      const channel = await requireSendableChannel(input.channelId);
      await channel.send({
        content: "🎵 Your audio is ready!",
        embeds: [buildGeneratedAudioEmbed(generated)],
        files: [await buildGeneratedAudioAttachment(generated)]
      });
    }
    return generated;
  },
    generateMusicFromPrompt: async input => {
      const seconds = Math.max(1, Math.min(120, Math.round(input.seconds)));
      const generated = toGeneratedAudioPublicRecord(await generateMusicWithExecution({
        seconds,
        tags: input.tags,
        lyrics: input.lyrics,
        onPromptQueued: input.onPromptQueued,
        signal: input.signal
      }));
      if (input.channelId) {
        const channel = await requireSendableChannel(input.channelId);
        await channel.send({
          content: "🎶 Your music is ready!",
          embeds: [buildGeneratedMusicEmbed(generated)],
          files: [await buildGeneratedAudioAttachment(generated)]
        });
      }
      return generated;
    },
    generateVideoFromPrompt: async input => {
      const prompt = input.prompt?.trim() ?? "";
      if (!prompt) {
        throw new Error("Prompt is required for video generation.");
      }
      const seconds = typeof input.seconds === "number" && Number.isFinite(input.seconds)
        ? Math.max(1, Math.min(300, Math.round(input.seconds)))
        : undefined;
      const generated = toGeneratedVideoPublicRecord(await generateVideoFromPromptLocal({
        prompt,
        negativePrompt: input.negativePrompt,
        seconds,
        frames: input.frames,
        fps: input.fps,
        width: input.width,
        height: input.height,
        steps: input.steps,
        workflowPath: input.workflowPath,
        imageDataUrl: input.imageDataUrl,
        imageFileName: input.imageFileName,
        onPromptQueued: input.onPromptQueued,
        signal: input.signal
      }));
      if (input.channelId) {
        const channel = await requireSendableChannel(input.channelId);
        await channel.send({
          content: "🎬 Your video is ready!",
          files: [{
            attachment: await resolveGeneratedVideoFilePath(generated.id, generated.videoFileName),
            name: generated.videoFileName
          }]
        });
      }
      return generated;
    },
    generateTextToSpeech: async input => {
      const text = input.text?.trim() ?? "";
      if (!text) {
        throw new Error("Text is required for text to speech.");
      }
      return generateTextToSpeech({
        text,
        mode: input.mode,
        speaker: input.speaker,
        speed: input.speed,
        workflowPath: input.workflowPath,
        referenceAudioDataUrl: input.referenceAudioDataUrl,
        referenceAudioFileName: input.referenceAudioFileName,
        referenceText: input.referenceText,
        instruct: input.instruct,
        language: input.language
      });
    },
    transcribeSpeechToText: async input => {
      return transcribeSpeechToText({
        audioDataUrl: input.audioDataUrl,
        fileName: input.fileName,
        workflowPath: input.workflowPath,
        language: input.language
      });
    },
    generateSpeechToSpeech: async input => {
      return generateSpeechToSpeech({
        audioDataUrl: input.audioDataUrl,
        fileName: input.fileName,
        speaker: input.speaker,
        speed: input.speed,
        workflowPath: input.workflowPath
      });
    },
    deleteGeneratedImage: async imageId => {
      return deleteGeneratedImage(imageId);
    },
    deleteGeneratedModel: async modelId => {
      return deleteGeneratedModel(modelId);
    },
    deleteGeneratedModelVariant: async (modelId, variant, fileName) => {
      return deleteGeneratedModelVariant(modelId, variant, fileName);
    },
    deleteGeneratedAudio: async audioId => {
      return deleteGeneratedAudio(audioId);
    },
    deleteGeneratedVideo: async videoId => {
      return deleteGeneratedVideo(videoId);
    },
    freeComfyUiMemory: async input => {
      await comfyFreeMemory({
        unloadModels: input.unloadModels,
        freeMemory: input.freeMemory
      });
    },
    interruptComfyWorkflow: async input => {
      await interruptComfyWorkflow(input);
    },
    readGeneratedImageFile,
  readGeneratedAudioFile,
  readGeneratedVideoFile,
  postGeneratedModel: async input => {
    let modelId = input.modelId;
    let extraContent = input.extraContent;
    let descriptionContent: string | null = null;
    const requireThreeJsPreviewGif = input.requireThreeJsPreviewGif === true;
    if (requireThreeJsPreviewGif && input.includePreviewMedia !== false && !(input.previewGifDataUrl?.trim())) {
      throw new Error("Three.js preview GIF is required but missing. Generate and attach the browser GIF before posting.");
    }
    if (input.useLlmMetadata) {
      try {
        const suggestedFileName = normalizeModelNameCandidate(input.suggestedModelFileName);
        const suggestedDescription = normalizeModelDescriptionCandidate(input.suggestedModelDescription);
        if (suggestedFileName) {
          const renamed = await renameGeneratedModelFileName(modelId, suggestedFileName);
          modelId = renamed.id;
        }
        if (suggestedDescription) {
          extraContent = input.extraContent;
          descriptionContent = suggestedDescription;
        }
      } catch (error) {
        console.warn("Failed to apply pre-planned LLM model metadata. Continuing with original model metadata.", error);
      }
    }
    const existingModel = await getGeneratedModelPublicById(modelId);
    extraContent = buildModelPostSummaryExtraContent({
      modelFileName: existingModel?.modelFileName,
      description: descriptionContent,
      prompt: existingModel?.prompt,
      extraContent
    });
    const posted = await postExistingGeneratedModelToChannel({
      modelId,
      channelId: input.channelId,
      requestedBy: input.requestedBy ?? "dashboard",
      messageMode: "public",
      postOptions: {
        targetMode: input.postTargetMode,
        threadNameMode: input.threadNameMode,
        threadName: input.threadName,
        threadNameBase: input.threadNameBase,
        modelNameSource: input.modelNameSource,
        forumChannelId: input.forumChannelId,
        forumChannelName: input.forumChannelName,
        lowPolyForumChannelId: input.lowPolyForumChannelId,
        lowPolyForumChannelName: input.lowPolyForumChannelName,
        sendInitialToSelectedChannel: input.sendInitialToSelectedChannel,
        initialExtraText: input.initialExtraContent,
        destinationExtraText: input.extraContent,
        modelUploadTarget: input.modelUploadTarget,
        includeModelFile: input.includeModelFile,
        includePreviewMedia: input.includePreviewMedia,
        includeEmbed: input.includeEmbed,
        includeEmbedInInitial: input.includeEmbedInInitial,
        uploadTextureMessages: input.uploadTextureMessages,
        uploadMultiViewTextures: input.uploadMultiViewTextures,
        uploadUvMapTextures: input.uploadUvMapTextures,
        uploadNormalMapTextures: input.uploadNormalMapTextures,
        textureUploadTarget: input.textureUploadTarget,
        generateLowPolyVersion: input.generateLowPolyVersion,
        lowPolyUseLlmTargetFaces: input.lowPolyUseLlmTargetFaces,
        lowPolyLlmDecisionSource: input.lowPolyLlmDecisionSource,
        lowPolyTargetFaceCount: input.lowPolyTargetFaceCount,
        includeButtons: input.includeButtons
      },
      extraContent,
      previewGifDataUrl: input.previewGifDataUrl,
      replyToMessageId: input.replyToMessageId
    });
    if (requireThreeJsPreviewGif && posted.previewGifFileName !== "preview-threejs.gif") {
      throw new Error(`Expected Three.js preview GIF, but got "${posted.previewGifFileName || "none"}".`);
    }
    return posted;
  },
  resolveGeneratedModelFilePath,
  readGeneratedModelFile,
  listScheduledAutomations,
  saveScheduledAutomation: async input => {
    if (input.triggerMode === "interval") {
      if (!Number.isFinite(input.intervalValue) || input.intervalValue < 1) {
        throw new Error("Interval value must be at least 1.");
      }
    } else {
      validateCronExpression(input.cron);
    }
    return saveScheduledAutomation(input);
  },
  deleteScheduledAutomation,
  listJoinAutomations,
  saveJoinAutomation,
  deleteJoinAutomation
});

const isComfyUiReachable = async (): Promise<boolean> => {
  const configuredBaseUrl = runtimeState.getGlobalDashboardSettings().comfyUiBaseUrl.trim();
  if (!configuredBaseUrl) {
    return false;
  }
  try {
    const response = await fetch(`${configuredBaseUrl.replace(/\/+$/, "")}/system_stats`, {
      signal: AbortSignal.timeout(1_500)
    });
    return response.ok;
  } catch {
    return false;
  }
};

installInteractiveShutdownPrompt({
  runtimeName: appConfig.dashboardEnabled ? "Dashboard" : "Headless server",
  getDependencies: async () => {
    const dependencies = messengerRuntimeManager.getSnapshot().runtimes
      .filter(runtime => runtime.status === "running" || runtime.status === "starting")
      .map(runtime => ({
        label: runtime.label,
        detail: runtime.messenger === "discord"
          ? "embedded in this dashboard process and will stop with it."
          : "runs in a separate process and can operate without the dashboard; this dashboard session will no longer manage it."
      }));

    if (await isComfyUiReachable()) {
      dependencies.push({
        label: "ComfyUI",
        detail: "is reachable and runs independently; it will remain available after the dashboard stops."
      });
    }
    return dependencies;
  },
  stop: async () => {
    await dashboardServer.close();
    if (client.isReady()) {
      await stopDiscordRuntime();
    }
  }
});

client.once(Events.ClientReady, readyClient => {
  void discordEventRuntime.handleClientReady(readyClient);
  setInterval(() => {
    void runAutonomousHeartbeatPass().catch(error => {
      console.error("Failed autonomous heartbeat pass", error);
    });
  }, 60_000);
  setInterval(() => {
    void honeypotVerificationService.processExpiredHoneypotVerifications().catch(error => {
      console.error("Failed honeypot expiry pass", error);
    });
  }, 60_000);
});

client.on(Events.GuildMemberAdd, async member => {
  await discordEventRuntime.handleGuildMemberAdd(member);
});

client.on(Events.GuildMemberRemove, async member => {
  await discordEventRuntime.handleGuildMemberRemove(member);
});

client.on(Events.InteractionCreate, async interaction => {
  await discordEventRuntime.handleInteractionCreate(interaction);
});

client.on(Events.MessageCreate, async message => {
  await discordEventRuntime.handleMessageCreate(message);
});

if (!messengerAutostartDisabled && runtimeState.getGlobalDashboardSettings().discordRuntimeAutostart && canStartDiscordRuntime) {
  void messengerRuntimeManager.control({
    messenger: "discord",
    action: "start"
  }).catch(error => {
    const detail = error instanceof Error ? error.message : String(error);
    runtimeState.recordAction("runtime:discord-start-error", detail);
    console.warn("Failed to autostart Discord runtime.", detail);
  });
} else if (!canStartDiscordRuntime) {
  runtimeState.recordAction("runtime:discord-disabled", "Discord runtime is disabled because DISCORD_TOKEN_RUNTIME is not set.");
} else if (messengerAutostartDisabled) {
  runtimeState.recordAction("runtime:messenger-autostart-disabled", "Messenger autostart is disabled for the headless server role.");
}
void messengerRuntimeManager.autoStartConfiguredRuntimes().catch(error => {
  const detail = error instanceof Error ? error.message : String(error);
  runtimeState.recordAction("runtime:messenger-autostart-error", detail);
  console.warn("Failed to autostart one or more external messengers.", detail);
});
