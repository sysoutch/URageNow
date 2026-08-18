import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { dataRoot, repositoryRootCandidates, resolveRepoPath } from "./repositoryPaths.js";
import {
  dashboardAccessTokenSecretName,
  discordTokenSecretName,
  getNativeSecret,
  messengerAdminSharedSecretName,
  openAiCompatibleApiKeySecretName,
  remoteWorkerSharedSecretName
} from "../security/nativeSecretStore.js";

type DotenvConfig = (input?: { path?: string; override?: boolean }) => void;
export interface AppConfigEnvFile {
  relativePath: string;
  override: boolean;
}

const loadEnvFile = loadEnv as DotenvConfig;
export const appConfigEnvFiles: readonly AppConfigEnvFile[] = [
  {relativePath: ".env.public", override: false},
  {relativePath: "bots/discord-bot/.env.public", override: false},
  {relativePath: "bots/discord-bot/.env.public.local", override: true},
  {relativePath: ".env.public.local", override: true},
  {relativePath: "bots/discord-bot/.env.main.local", override: true},
  {relativePath: ".env.main.local", override: true}
];

function loadEnvFromCandidates(relativePath: string, override = false): void {
  for (const root of repositoryRootCandidates) {
    const candidatePath = path.resolve(root, relativePath);
    if (!existsSync(candidatePath)) {
      continue;
    }
    loadEnvFile({ path: candidatePath, override });
  }
}

for (const envFile of appConfigEnvFiles) {
  loadEnvFromCandidates(envFile.relativePath, envFile.override);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalSnowflake(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function optionalString(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed;
}

function optionalRepositoryPath(name: string, fallback: string): string {
  const configuredPath = optionalString(name, fallback);
  return path.isAbsolute(configuredPath) ? configuredPath : resolveRepoPath(configuredPath);
}

export function optionalAliasedString(primaryName: string, legacyName: string, fallback: string): string {
  return optionalString(primaryName, optionalString(legacyName, fallback));
}

function optionalList(name: string): string[] {
  return optionalString(name, "").split(",").map(value => value.trim()).filter(Boolean);
}

function optionalBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function optionalEnum<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  const matched = allowed.find(entry => entry.toLowerCase() === normalized);
  return matched ?? fallback;
}

function defaultRelativePath(candidates: string[]): string {
  const normalizedCandidates = candidates
    .map(entry => String(entry || "").trim().replace(/\\/g, "/"))
    .filter(Boolean);
  if (normalizedCandidates.length === 0) {
    return "";
  }
  const firstCandidate = normalizedCandidates[0] || "";
  for (const root of repositoryRootCandidates) {
    for (const relativePath of normalizedCandidates) {
      const absolutePath = path.resolve(root, relativePath);
      if (existsSync(absolutePath)) {
        return relativePath;
      }
    }
  }
  return firstCandidate;
}

const defaultComfyUiBaseUrl = optionalString("COMFYUI_BASE_URL", "http://127.0.0.1:8188");
const storedDiscordToken = getNativeSecret(discordTokenSecretName) || optionalString("DISCORD_TOKEN_SECURE_STORE", "");
const storedOpenAiCompatibleApiKey = getNativeSecret(openAiCompatibleApiKeySecretName) || "lm-studio";
const storedRemoteWorkerSharedSecret = getNativeSecret(remoteWorkerSharedSecretName);
const storedDashboardAccessToken = getNativeSecret(dashboardAccessTokenSecretName);
const storedMessengerAdminSharedSecret = getNativeSecret(messengerAdminSharedSecretName);

export const appConfig = {
  discordToken: optionalString("DISCORD_TOKEN_RUNTIME", storedDiscordToken),
  discordRuntimeAutostart: optionalBoolean("DISCORD_RUNTIME_AUTOSTART", false),
  discordClientId: optionalSnowflake("DISCORD_CLIENT_ID"),
  discordGuildId: optionalSnowflake("DISCORD_GUILD_ID"),
  humbleRoleId: optionalSnowflake("HUMBLE_ROLE_ID"),
  llmProvider: optionalEnum("LLM_PROVIDER", ["ollama", "lmstudio", "llamacpp"] as const, "ollama"),
  ollamaUrl: process.env.OLLAMA_URL?.trim() || "http://localhost:11434/api/generate",
  ollamaModel: process.env.OLLAMA_MODEL?.trim() || "qwen3-coder:30b",
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL?.trim() || "llava:13b",
  lmStudioBaseUrl: optionalAliasedString("OPENAI_COMPATIBLE_BASE_URL", "LMSTUDIO_BASE_URL", "http://127.0.0.1:1234/v1"),
  lmStudioApiKey: optionalAliasedString("OPENAI_COMPATIBLE_API_KEY", "LMSTUDIO_API_KEY", storedOpenAiCompatibleApiKey),
  lmStudioModel: optionalAliasedString("OPENAI_COMPATIBLE_MODEL", "LMSTUDIO_MODEL", ""),
  lmStudioVisionModel: optionalAliasedString("OPENAI_COMPATIBLE_VISION_MODEL", "LMSTUDIO_VISION_MODEL", ""),
  remoteWorkerBaseUrl: optionalString("REMOTE_WORKER_BASE_URL", ""),
  remoteWorkerSharedSecret: optionalString("REMOTE_WORKER_SHARED_SECRET", storedRemoteWorkerSharedSecret || ""),
  remoteWorkerPort: optionalNumber("REMOTE_WORKER_PORT", 5581),
  remoteWorkerBindHost: optionalString("REMOTE_WORKER_BIND_HOST", "0.0.0.0"),
  model3dExecutionMode: optionalEnum("MODEL3D_EXECUTION_MODE", ["local", "remote"] as const, "local"),
  imageExecutionMode: optionalEnum("IMAGE_EXECUTION_MODE", ["local", "remote"] as const, "local"),
  telegramBotEntryPath: optionalString("TELEGRAM_BOT_ENTRY_PATH", resolveRepoPath("bots", "telegram-bot", "bot.js")),
  telegramBotWorkingDirectory: optionalString("TELEGRAM_BOT_WORKDIR", resolveRepoPath("bots", "telegram-bot")),
  telegramBotAutostart: optionalBoolean("TELEGRAM_BOT_AUTOSTART", false),
  telegramAdminBaseUrl: optionalString("TELEGRAM_ADMIN_BASE_URL", "http://127.0.0.1:4791"),
  telegramAdminHost: optionalString("TELEGRAM_ADMIN_HOST", "127.0.0.1"),
  telegramAdminPort: optionalNumber("TELEGRAM_ADMIN_PORT", 4791),
  matrixBotEntryPath: optionalString("MATRIX_BOT_ENTRY_PATH", resolveRepoPath("bots", "matrix-bot", "bot.js")),
  matrixBotWorkingDirectory: optionalString("MATRIX_BOT_WORKDIR", resolveRepoPath("bots", "matrix-bot")),
  matrixBotAutostart: optionalBoolean("MATRIX_BOT_AUTOSTART", false),
  matrixAdminBaseUrl: optionalString("MATRIX_ADMIN_BASE_URL", "http://127.0.0.1:4792"),
  matrixAdminHost: optionalString("MATRIX_ADMIN_HOST", "127.0.0.1"),
  matrixAdminPort: optionalNumber("MATRIX_ADMIN_PORT", 4792),
  whatsappBotEntryPath: optionalString("WHATSAPP_BOT_ENTRY_PATH", resolveRepoPath("bots", "whatsapp-bot", "bot.js")),
  whatsappBotWorkingDirectory: optionalString("WHATSAPP_BOT_WORKDIR", resolveRepoPath("bots", "whatsapp-bot")),
  whatsappBotAutostart: optionalBoolean("WHATSAPP_BOT_AUTOSTART", false),
  whatsappAdminBaseUrl: optionalString("WHATSAPP_ADMIN_BASE_URL", "http://127.0.0.1:4793"),
  whatsappAdminHost: optionalString("WHATSAPP_ADMIN_HOST", "127.0.0.1"),
  whatsappAdminPort: optionalNumber("WHATSAPP_ADMIN_PORT", 4793),
  dashboardEnabled: optionalBoolean("DASHBOARD_ENABLED", true),
  dashboardPort: optionalNumber("DASHBOARD_PORT", 4782),
  dashboardBindHost: optionalString("DASHBOARD_BIND_HOST", "127.0.0.1"),
  dashboardPublicBaseUrl: optionalString("DASHBOARD_PUBLIC_BASE_URL", "http://127.0.0.1:4782"),
  urageNetMediaApiBaseUrl: optionalString("URAGENET_MEDIA_API_BASE_URL", ""),
  urageNetMediaApiUsername: optionalString("URAGENET_MEDIA_API_USERNAME", ""),
  urageNetMediaApiPassword: optionalString("URAGENET_MEDIA_API_PASSWORD", ""),
  companionTlsCertificateSha256: optionalString("COMPANION_TLS_CERTIFICATE_SHA256", ""),
  dashboardExposeApi: optionalBoolean("DASHBOARD_EXPOSE_API", false),
  dashboardAccessToken: optionalString("DASHBOARD_ACCESS_TOKEN", storedDashboardAccessToken || ""),
  dashboardAllowedClients: optionalList("DASHBOARD_ALLOWED_CLIENTS"),
  messengerAdminSharedSecret: optionalString("MESSENGER_ADMIN_SHARED_SECRET", storedMessengerAdminSharedSecret || ""),
  dataDirectory: optionalString("DASHBOARD_DATA_DIR", dataRoot),
  duplicateWindowMs: optionalNumber("DUPLICATE_WINDOW_MS", 60_000),
  spamTimeoutMs: optionalNumber("SPAM_TIMEOUT_MS", 3_600_000),
  comfyUiBaseUrl: defaultComfyUiBaseUrl,
  comfyUiModelBaseUrl: optionalString("COMFYUI_MODEL_BASE_URL", defaultComfyUiBaseUrl),
  comfyUiImageBaseUrl: optionalString("COMFYUI_IMAGE_BASE_URL", defaultComfyUiBaseUrl),
  comfyUiAudioBaseUrl: optionalString("COMFYUI_AUDIO_BASE_URL", defaultComfyUiBaseUrl),
  comfyUiMusicBaseUrl: optionalString("COMFYUI_MUSIC_BASE_URL", defaultComfyUiBaseUrl),
  comfyUiVideoBaseUrl: optionalString("COMFYUI_VIDEO_BASE_URL", defaultComfyUiBaseUrl),
  comfyUiInputDir: optionalString("COMFYUI_INPUT_DIR", resolveRepoPath("data", "comfyui", "input")),
  comfyUiModelWorkflowPath: optionalString("COMFYUI_3D_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/3d/3dmodel_redone.json",
    "comfyui-workflows/3d/3d-model.json",
    "data/comfyui/workflows/3d-model.json"
  ])),
  comfyUiModelImageInputNodeId: optionalString("COMFYUI_3D_IMAGE_NODE_ID", "204"),
  comfyUiModelPromptNodeId: optionalString("COMFYUI_3D_PROMPT_NODE_ID", ""),
  comfyUiModelPromptInputKey: optionalString("COMFYUI_3D_PROMPT_INPUT_KEY", "text"),
  comfyUiModelOutputNodeId: optionalString("COMFYUI_3D_OUTPUT_NODE_ID", "221"),
  comfyUiModelPreviewNodeId: optionalString("COMFYUI_3D_PREVIEW_NODE_ID", "194"),
  comfyUiModelMultiViewNodeId: optionalString("COMFYUI_3D_MULTIVIEW_NODE_ID", "212"),
  comfyUiModelUvNodeId: optionalString("COMFYUI_3D_UV_NODE_ID", "190"),
  comfyUiModelUvInpaintNodeId: optionalString("COMFYUI_3D_UV_INPAINT_NODE_ID", "217"),
  comfyUiModelNormalNodeId: optionalString("COMFYUI_3D_NORMAL_NODE_ID", ""),
  comfyUiModelTargetFaceNodeId: optionalString("COMFYUI_3D_TARGET_FACE_NODE_ID", ""),
  comfyUiModelTargetFaceInputKey: optionalString("COMFYUI_3D_TARGET_FACE_INPUT_KEY", ""),
  comfyUiModelPollMs: optionalNumber("COMFYUI_3D_POLL_MS", 7_500),
  comfyUiModelTimeoutMs: optionalNumber("COMFYUI_3D_TIMEOUT_MS", 15 * 60_000),
  blenderExecutablePath: optionalString("BLENDER_EXECUTABLE_PATH", "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe"),
  bambuStudioExecutablePath: optionalString("BAMBU_STUDIO_EXECUTABLE_PATH", ""),
  cargoExecutablePath: optionalString("CARGO_EXECUTABLE_PATH", "cargo"),
  rustWorkerWorkspacePath: optionalString("RUST_WORKER_WORKSPACE_PATH", resolveRepoPath("workers", "rust")),
  rustModelInspectorExecutablePath: optionalString("RUST_MODEL_INSPECTOR_EXECUTABLE_PATH", ""),
  rustAssetValidatorExecutablePath: optionalString("RUST_ASSET_VALIDATOR_EXECUTABLE_PATH", ""),
  rustAssetIndexerExecutablePath: optionalString("RUST_ASSET_INDEXER_EXECUTABLE_PATH", ""),
  rustMediaProbeExecutablePath: optionalString("RUST_MEDIA_PROBE_EXECUTABLE_PATH", ""),
  ffmpegExecutablePath: optionalString("FFMPEG_EXECUTABLE_PATH", "ffmpeg"),
  blenderOpenScriptPath: optionalRepositoryPath("BLENDER_OPEN_SCRIPT_PATH", resolveRepoPath("blender-scripts", "import.py")),
  blenderLowPolyScriptPath: optionalRepositoryPath("BLENDER_LOWPOLY_SCRIPT_PATH", resolveRepoPath("blender-scripts", "LowPolyUV.py")),
  blenderModelPreviewScriptPath: optionalRepositoryPath("BLENDER_MODEL_PREVIEW_SCRIPT_PATH", resolveRepoPath("blender-scripts", "RenderModelPreview.py")),
  blenderModelCaptureScriptPath: optionalRepositoryPath("BLENDER_MODEL_CAPTURE_SCRIPT_PATH", resolveRepoPath("blender-scripts", "capture", "capture.py")),
  blenderModelDelightScriptPath: optionalRepositoryPath("BLENDER_MODEL_DELIGHT_SCRIPT_PATH", resolveRepoPath("blender-scripts", "delight.py")),
  blenderModelSeparateByLoosePartsScriptPath: optionalRepositoryPath("BLENDER_MODEL_SEPARATE_BY_LOOSE_PARTS_SCRIPT_PATH", resolveRepoPath("blender-scripts", "separate", "separate_by_loose_parts.py")),
  blenderModelDecimateScriptPath: optionalRepositoryPath("BLENDER_MODEL_DECIMATE_SCRIPT_PATH", resolveRepoPath("blender-scripts", "decimate", "decimateToFaces.py")),
  blenderModelMergeVerticesScriptPath: optionalRepositoryPath("BLENDER_MODEL_MERGE_VERTICES_SCRIPT_PATH", resolveRepoPath("blender-scripts", "merge_vertices.py")),
  blenderModelMetallicScriptPath: optionalRepositoryPath("BLENDER_MODEL_METALLIC_SCRIPT_PATH", resolveRepoPath("blender-scripts", "apply_metallic.py")),
  blenderModelMaterialScriptPath: optionalRepositoryPath("BLENDER_MODEL_MATERIAL_SCRIPT_PATH", resolveRepoPath("blender-scripts", "apply_material_finish.py")),
  blenderModelAlbedoToGeometryScriptPath: optionalRepositoryPath("BLENDER_MODEL_ALBEDO_TO_GEOMETRY_SCRIPT_PATH", resolveRepoPath("blender-scripts", "albedo_to_geometry.py")),
  blenderModelScaleScriptPath: optionalRepositoryPath("BLENDER_MODEL_SCALE_SCRIPT_PATH", resolveRepoPath("blender-scripts", "transform", "scale.py")),
  blenderModelAutoRigScriptPath: optionalRepositoryPath("BLENDER_MODEL_AUTORIG_SCRIPT_PATH", resolveRepoPath("blender-scripts", "rig", "autorigger", "autorig.py")),
  blenderModelPreviewTimeoutMs: optionalNumber("BLENDER_MODEL_PREVIEW_TIMEOUT_MS", 3 * 60_000),
  blenderModelCaptureTimeoutMs: optionalNumber("BLENDER_MODEL_CAPTURE_TIMEOUT_MS", 5 * 60_000),
  blenderModelSeparateByLoosePartsTimeoutMs: optionalNumber("BLENDER_MODEL_SEPARATE_BY_LOOSE_PARTS_TIMEOUT_MS", 10 * 60_000),
  blenderModelDecimateTimeoutMs: optionalNumber("BLENDER_MODEL_DECIMATE_TIMEOUT_MS", 10 * 60_000),
  blenderModelMergeVerticesTimeoutMs: optionalNumber("BLENDER_MODEL_MERGE_VERTICES_TIMEOUT_MS", 10 * 60_000),
  blenderModelMetallicTimeoutMs: optionalNumber("BLENDER_MODEL_METALLIC_TIMEOUT_MS", 10 * 60_000),
  blenderModelAlbedoToGeometryTimeoutMs: optionalNumber("BLENDER_MODEL_ALBEDO_TO_GEOMETRY_TIMEOUT_MS", 20 * 60_000),
  blenderModelScaleTimeoutMs: optionalNumber("BLENDER_MODEL_SCALE_TIMEOUT_MS", 10 * 60_000),
  blenderModelAutoRigTimeoutMs: optionalNumber("BLENDER_MODEL_AUTORIG_TIMEOUT_MS", 20 * 60_000),
  blenderLowPolyTimeoutMs: optionalNumber("BLENDER_LOWPOLY_TIMEOUT_MS", 20 * 60_000),
  blenderLowPolyMergeVertices: optionalBoolean("BLENDER_LOWPOLY_MERGE_VERTICES", true),
  blenderLowPolyShouldDecimate: optionalBoolean("BLENDER_LOWPOLY_SHOULD_DECIMATE", true),
  blenderLowPolyMaxColors: optionalNumber("BLENDER_LOWPOLY_MAX_COLORS", 16),
  blenderLowPolyBlockSize: optionalNumber("BLENDER_LOWPOLY_BLOCK_SIZE", 8),
  lowPolyDefaultTargetFaceCount: optionalNumber("LOWPOLY_DEFAULT_TARGET_FACE_COUNT", 1500),
  comfyUiImageWorkflowPath: optionalString("COMFYUI_IMAGE_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/image/image_qwen_image.json",
    "comfyui-workflows/image/image.json",
    "data/comfyui/workflows/image.json"
  ])),
  comfyUiImageEditWorkflowPath: optionalString("COMFYUI_IMAGE_EDIT_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/image/image_edit.json",
    "data/comfyui/workflows/image_edit.json"
  ])),
  comfyUiImageUpscaleWorkflowPath: optionalString("COMFYUI_IMAGE_UPSCALE_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/image/upscale.json",
    "data/comfyui/workflows/upscaled.json"
  ])),
  comfyUiImageLayeredWorkflowPath: optionalString("COMFYUI_IMAGE_LAYERED_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/image/image_qwen_image_layered.json",
    "data/comfyui/workflows/image_qwen_image_layered.json"
  ])),
  comfyUiImagePromptNodeId: optionalString("COMFYUI_IMAGE_PROMPT_NODE_ID", "6"),
  comfyUiImagePromptInputKey: optionalString("COMFYUI_IMAGE_PROMPT_INPUT_KEY", "text"),
  comfyUiImageSeedNodeId: optionalString("COMFYUI_IMAGE_SEED_NODE_ID", "3"),
  comfyUiImageSeedInputKey: optionalString("COMFYUI_IMAGE_SEED_INPUT_KEY", "seed"),
  comfyUiImageOutputNodeId: optionalString("COMFYUI_IMAGE_OUTPUT_NODE_ID", ""),
  comfyUiImageSizeNodeId: optionalString("COMFYUI_IMAGE_SIZE_NODE_ID", "5"),
  comfyUiImageStepsNodeId: optionalString("COMFYUI_IMAGE_STEPS_NODE_ID", "3"),
  comfyUiImageModelName: optionalString("COMFYUI_IMAGE_MODEL_NAME", "DreamShaper_8"),
  comfyUiImagePollMs: optionalNumber("COMFYUI_IMAGE_POLL_MS", 7_500),
  comfyUiImageTimeoutMs: optionalNumber("COMFYUI_IMAGE_TIMEOUT_MS", 10 * 60_000),
  comfyUiAudioWorkflowPath: optionalString("COMFYUI_AUDIO_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/audio/audio.json",
    "data/comfyui/workflows/audio.json"
  ])),
  comfyUiAudioPromptNodeId: optionalString("COMFYUI_AUDIO_PROMPT_NODE_ID", "6"),
  comfyUiAudioPromptInputKey: optionalString("COMFYUI_AUDIO_PROMPT_INPUT_KEY", "text"),
  comfyUiAudioSecondsNodeId: optionalString("COMFYUI_AUDIO_SECONDS_NODE_ID", "11"),
  comfyUiAudioSecondsInputKey: optionalString("COMFYUI_AUDIO_SECONDS_INPUT_KEY", "seconds"),
  comfyUiAudioSeedNodeId: optionalString("COMFYUI_AUDIO_SEED_NODE_ID", "3"),
  comfyUiAudioSeedInputKey: optionalString("COMFYUI_AUDIO_SEED_INPUT_KEY", "seed"),
  comfyUiAudioStepsNodeId: optionalString("COMFYUI_AUDIO_STEPS_NODE_ID", "3"),
  comfyUiAudioStepsInputKey: optionalString("COMFYUI_AUDIO_STEPS_INPUT_KEY", "steps"),
  comfyUiAudioCfgNodeId: optionalString("COMFYUI_AUDIO_CFG_NODE_ID", "3"),
  comfyUiAudioCfgInputKey: optionalString("COMFYUI_AUDIO_CFG_INPUT_KEY", "cfg"),
  comfyUiAudioOutputNodeId: optionalString("COMFYUI_AUDIO_OUTPUT_NODE_ID", "13"),
  comfyUiAudioOutputKey: optionalString("COMFYUI_AUDIO_OUTPUT_KEY", "audio"),
  comfyUiAudioModelName: optionalString("COMFYUI_AUDIO_MODEL_NAME", "Stable Audio Open 1.0"),
  comfyUiAudioPollMs: optionalNumber("COMFYUI_AUDIO_POLL_MS", 7_500),
  comfyUiAudioTimeoutMs: optionalNumber("COMFYUI_AUDIO_TIMEOUT_MS", 15 * 60_000),
  comfyUiMusicWorkflowPath: optionalString("COMFYUI_MUSIC_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/music/music.json",
    "data/comfyui/workflows/music.json"
  ])),
  comfyUiVideoWorkflowPath: optionalString("COMFYUI_VIDEO_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/video/video_from_text.json",
    "data/comfyui/workflows/video.json"
  ])),
  comfyUiVideoImageWorkflowPath: optionalString("COMFYUI_VIDEO_IMAGE_WORKFLOW_PATH", defaultRelativePath([
    "comfyui-workflows/video/video_from_image_text.json",
    "data/comfyui/workflows/video_image.json"
  ])),
  comfyUiVideoPromptNodeId: optionalString("COMFYUI_VIDEO_PROMPT_NODE_ID", "6"),
  comfyUiVideoPromptInputKey: optionalString("COMFYUI_VIDEO_PROMPT_INPUT_KEY", "text"),
  comfyUiVideoSecondsNodeId: optionalString("COMFYUI_VIDEO_SECONDS_NODE_ID", ""),
  comfyUiVideoSecondsInputKey: optionalString("COMFYUI_VIDEO_SECONDS_INPUT_KEY", "seconds"),
  comfyUiVideoSeedNodeId: optionalString("COMFYUI_VIDEO_SEED_NODE_ID", "3"),
  comfyUiVideoSeedInputKey: optionalString("COMFYUI_VIDEO_SEED_INPUT_KEY", "seed"),
  comfyUiVideoStepsNodeId: optionalString("COMFYUI_VIDEO_STEPS_NODE_ID", ""),
  comfyUiVideoStepsInputKey: optionalString("COMFYUI_VIDEO_STEPS_INPUT_KEY", "steps"),
  comfyUiVideoOutputNodeId: optionalString("COMFYUI_VIDEO_OUTPUT_NODE_ID", ""),
  comfyUiVideoOutputKey: optionalString("COMFYUI_VIDEO_OUTPUT_KEY", "videos"),
  comfyUiVideoModelName: optionalString("COMFYUI_VIDEO_MODEL_NAME", "ComfyUI Video"),
  comfyUiVideoPollMs: optionalNumber("COMFYUI_VIDEO_POLL_MS", 7_500),
  comfyUiVideoTimeoutMs: optionalNumber("COMFYUI_VIDEO_TIMEOUT_MS", 20 * 60_000),
  comfyUiMusicTagsNodeId: optionalString("COMFYUI_MUSIC_TAGS_NODE_ID", "14"),
  comfyUiMusicTagsInputKey: optionalString("COMFYUI_MUSIC_TAGS_INPUT_KEY", "tags"),
  comfyUiMusicLyricsNodeId: optionalString("COMFYUI_MUSIC_LYRICS_NODE_ID", "14"),
  comfyUiMusicLyricsInputKey: optionalString("COMFYUI_MUSIC_LYRICS_INPUT_KEY", "lyrics"),
  comfyUiMusicSecondsNodeId: optionalString("COMFYUI_MUSIC_SECONDS_NODE_ID", "17"),
  comfyUiMusicSecondsInputKey: optionalString("COMFYUI_MUSIC_SECONDS_INPUT_KEY", "seconds"),
  comfyUiMusicSeedNodeId: optionalString("COMFYUI_MUSIC_SEED_NODE_ID", "52"),
  comfyUiMusicSeedInputKey: optionalString("COMFYUI_MUSIC_SEED_INPUT_KEY", "seed"),
  comfyUiMusicStepsNodeId: optionalString("COMFYUI_MUSIC_STEPS_NODE_ID", "52"),
  comfyUiMusicStepsInputKey: optionalString("COMFYUI_MUSIC_STEPS_INPUT_KEY", "steps"),
  comfyUiMusicCfgNodeId: optionalString("COMFYUI_MUSIC_CFG_NODE_ID", "52"),
  comfyUiMusicCfgInputKey: optionalString("COMFYUI_MUSIC_CFG_INPUT_KEY", "cfg"),
  comfyUiMusicOutputNodeId: optionalString("COMFYUI_MUSIC_OUTPUT_NODE_ID", "59"),
  comfyUiMusicOutputKey: optionalString("COMFYUI_MUSIC_OUTPUT_KEY", "audio"),
  comfyUiMusicModelName: optionalString("COMFYUI_MUSIC_MODEL_NAME", "Ace Step v1 3.5b"),
  comfyUiMusicPollMs: optionalNumber("COMFYUI_MUSIC_POLL_MS", 7_500),
  comfyUiMusicTimeoutMs: optionalNumber("COMFYUI_MUSIC_TIMEOUT_MS", 15 * 60_000)
} as const;

export function applyDashboardNetworkRuntimeConfig(config: {
  bindHost: string;
  publicBaseUrl: string;
  exposeApi: boolean;
  allowedClients: string[];
  certificateSha256: string;
  accessToken: string;
}): void {
  Object.assign(appConfig, {
    dashboardBindHost: config.bindHost,
    dashboardPublicBaseUrl: config.publicBaseUrl,
    dashboardExposeApi: config.exposeApi,
    dashboardAllowedClients: config.allowedClients,
    companionTlsCertificateSha256: config.certificateSha256,
    dashboardAccessToken: config.accessToken
  });
}
