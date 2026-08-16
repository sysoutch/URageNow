import type { RuntimeState } from "./runtimeState.js";
import {
  getActiveOllamaModels,
  setActiveOllamaModels,
  setLlmConnectionSettings,
  type LlmConnectionSettings
} from "../services/llm/ollama.js";

export function applyRuntimeLlmSettings(runtimeState: RuntimeState): void {
  const globalSettings = runtimeState.getGlobalDashboardSettings();
  setLlmConnectionSettings({
    llmProvider: globalSettings.llmProvider,
    ollamaUrl: globalSettings.ollamaUrl,
    lmStudioBaseUrl: globalSettings.lmStudioBaseUrl,
    lmStudioApiKey: globalSettings.lmStudioApiKey,
    lmStudioContextLength: globalSettings.lmStudioContextLength,
    lmStudioTextModelReasoningEnabled: globalSettings.lmStudioTextModelReasoningEnabled
  });
  setActiveOllamaModels({
    textModel: globalSettings.ollamaTextModel,
    visionModel: globalSettings.ollamaTextModelIsVisual === true
      ? globalSettings.ollamaTextModel
      : globalSettings.ollamaVisionModel
  });
}

export function resolveImageLlmConnectionSettings(runtimeState: RuntimeState): LlmConnectionSettings {
  const settings = runtimeState.getGlobalDashboardSettings();
  const textModel = settings.imageLlmTextModel || settings.ollamaTextModel;
  const visionModel = settings.imageLlmVisionModel
    || (settings.ollamaTextModelIsVisual ? textModel : settings.ollamaVisionModel);
  return {
    llmProvider: settings.imageLlmProvider,
    ollamaUrl: settings.imageOllamaUrl || settings.ollamaUrl,
    lmStudioBaseUrl: settings.imageLmStudioBaseUrl || settings.lmStudioBaseUrl,
    lmStudioApiKey: settings.imageLmStudioApiKey || settings.lmStudioApiKey,
    lmStudioTextModelReasoningEnabled: settings.lmStudioTextModelReasoningEnabled,
    textModel,
    visionModel
  };
}

export function resolveModel3dLlmConnectionSettings(runtimeState: RuntimeState): LlmConnectionSettings {
  const settings = runtimeState.getGlobalDashboardSettings();
  const textModel = settings.model3dLlmTextModel || settings.ollamaTextModel;
  const visionModel = settings.model3dLlmVisionModel
    || (settings.ollamaTextModelIsVisual ? textModel : settings.ollamaVisionModel);
  return {
    llmProvider: settings.model3dLlmProvider,
    ollamaUrl: settings.model3dOllamaUrl || settings.ollamaUrl,
    lmStudioBaseUrl: settings.model3dLmStudioBaseUrl || settings.lmStudioBaseUrl,
    lmStudioApiKey: settings.model3dLmStudioApiKey || settings.lmStudioApiKey,
    lmStudioTextModelReasoningEnabled: settings.lmStudioTextModelReasoningEnabled,
    textModel,
    visionModel
  };
}

export function syncValidatedActiveModelsToRuntimeState(runtimeState: RuntimeState): void {
  const validatedActiveModels = getActiveOllamaModels();
  runtimeState.updateOllamaModels({
    ollamaTextModel: validatedActiveModels.textModel,
    ollamaVisionModel: validatedActiveModels.visionModel
  });
}
