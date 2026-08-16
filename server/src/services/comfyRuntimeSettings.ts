import { existsSync } from "node:fs";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { repoRoot, repositoryRootCandidates } from "../config/repositoryPaths.js";

export interface ComfyRuntimeSettings {
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
}

const comfyRuntimeSettings: ComfyRuntimeSettings = {
  comfyUiBaseUrl: appConfig.comfyUiBaseUrl,
  comfyUiModelBaseUrl: appConfig.comfyUiModelBaseUrl,
  comfyUiImageBaseUrl: appConfig.comfyUiImageBaseUrl,
  comfyUiAudioBaseUrl: appConfig.comfyUiAudioBaseUrl,
  comfyUiMusicBaseUrl: appConfig.comfyUiMusicBaseUrl,
  comfyUiVideoBaseUrl: appConfig.comfyUiVideoBaseUrl,
  comfyUiInputDir: "",
  comfyUiModelWorkflowPath: "",
  comfyUiImageWorkflowPath: "",
  comfyUiImageEditWorkflowPath: "",
  comfyUiImageLayeredWorkflowPath: "",
  comfyUiAudioWorkflowPath: "",
  comfyUiMusicWorkflowPath: "",
  comfyUiVideoWorkflowPath: "",
  comfyUiVideoImageWorkflowPath: ""
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePathInput(value: string): string {
  return value.trim().replace(/\//g, path.sep);
}

function isLikelyUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

export function resolveComfyWorkspacePath(rawValue: string): string {
  const normalized = normalizePathInput(rawValue);
  if (!normalized) {
    return "";
  }
  if (isLikelyUrl(normalized)) {
    return normalized;
  }
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  for (const workspaceRoot of repositoryRootCandidates) {
    const candidate = path.resolve(workspaceRoot, normalized);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(repoRoot, normalized);
}

comfyRuntimeSettings.comfyUiInputDir = resolveComfyWorkspacePath(appConfig.comfyUiInputDir);
comfyRuntimeSettings.comfyUiModelWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiModelWorkflowPath);
comfyRuntimeSettings.comfyUiImageWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiImageWorkflowPath);
comfyRuntimeSettings.comfyUiImageEditWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiImageEditWorkflowPath);
comfyRuntimeSettings.comfyUiImageLayeredWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiImageLayeredWorkflowPath);
comfyRuntimeSettings.comfyUiAudioWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiAudioWorkflowPath);
comfyRuntimeSettings.comfyUiMusicWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiMusicWorkflowPath);
comfyRuntimeSettings.comfyUiVideoWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiVideoWorkflowPath);
comfyRuntimeSettings.comfyUiVideoImageWorkflowPath = resolveComfyWorkspacePath(appConfig.comfyUiVideoImageWorkflowPath);

export function getComfyRuntimeSettings(): ComfyRuntimeSettings {
  return {
    ...comfyRuntimeSettings
  };
}

export function updateComfyRuntimeSettings(input: Partial<ComfyRuntimeSettings>): ComfyRuntimeSettings {
  const nextBaseUrl = normalizeString(input.comfyUiBaseUrl);
  if (nextBaseUrl) comfyRuntimeSettings.comfyUiBaseUrl = nextBaseUrl;
  const nextModelBaseUrl = normalizeString(input.comfyUiModelBaseUrl);
  if (nextModelBaseUrl) comfyRuntimeSettings.comfyUiModelBaseUrl = nextModelBaseUrl;
  const nextImageBaseUrl = normalizeString(input.comfyUiImageBaseUrl);
  if (nextImageBaseUrl) comfyRuntimeSettings.comfyUiImageBaseUrl = nextImageBaseUrl;
  const nextAudioBaseUrl = normalizeString(input.comfyUiAudioBaseUrl);
  if (nextAudioBaseUrl) comfyRuntimeSettings.comfyUiAudioBaseUrl = nextAudioBaseUrl;
  const nextMusicBaseUrl = normalizeString(input.comfyUiMusicBaseUrl);
  if (nextMusicBaseUrl) comfyRuntimeSettings.comfyUiMusicBaseUrl = nextMusicBaseUrl;
  const nextVideoBaseUrl = normalizeString(input.comfyUiVideoBaseUrl);
  if (nextVideoBaseUrl) comfyRuntimeSettings.comfyUiVideoBaseUrl = nextVideoBaseUrl;
  const nextInputDir = normalizeString(input.comfyUiInputDir);
  if (nextInputDir) comfyRuntimeSettings.comfyUiInputDir = resolveComfyWorkspacePath(nextInputDir);
  const nextModelWorkflow = normalizeString(input.comfyUiModelWorkflowPath);
  if (nextModelWorkflow) comfyRuntimeSettings.comfyUiModelWorkflowPath = resolveComfyWorkspacePath(nextModelWorkflow);
  const nextImageWorkflow = normalizeString(input.comfyUiImageWorkflowPath);
  if (nextImageWorkflow) comfyRuntimeSettings.comfyUiImageWorkflowPath = resolveComfyWorkspacePath(nextImageWorkflow);
  const nextImageEditWorkflow = normalizeString(input.comfyUiImageEditWorkflowPath);
  if (nextImageEditWorkflow) comfyRuntimeSettings.comfyUiImageEditWorkflowPath = resolveComfyWorkspacePath(nextImageEditWorkflow);
  const nextImageLayeredWorkflow = normalizeString(input.comfyUiImageLayeredWorkflowPath);
  if (nextImageLayeredWorkflow) comfyRuntimeSettings.comfyUiImageLayeredWorkflowPath = resolveComfyWorkspacePath(nextImageLayeredWorkflow);
  const nextAudioWorkflow = normalizeString(input.comfyUiAudioWorkflowPath);
  if (nextAudioWorkflow) comfyRuntimeSettings.comfyUiAudioWorkflowPath = resolveComfyWorkspacePath(nextAudioWorkflow);
  const nextMusicWorkflow = normalizeString(input.comfyUiMusicWorkflowPath);
  if (nextMusicWorkflow) comfyRuntimeSettings.comfyUiMusicWorkflowPath = resolveComfyWorkspacePath(nextMusicWorkflow);
  const nextVideoWorkflow = normalizeString(input.comfyUiVideoWorkflowPath);
  if (nextVideoWorkflow) comfyRuntimeSettings.comfyUiVideoWorkflowPath = resolveComfyWorkspacePath(nextVideoWorkflow);
  const nextVideoImageWorkflow = normalizeString(input.comfyUiVideoImageWorkflowPath);
  if (nextVideoImageWorkflow) comfyRuntimeSettings.comfyUiVideoImageWorkflowPath = resolveComfyWorkspacePath(nextVideoImageWorkflow);
  return getComfyRuntimeSettings();
}
