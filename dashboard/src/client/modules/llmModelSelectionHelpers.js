function createDashboardLlmModelSelectionHelpers(input) {
  const {
    state,
    refreshMeta,
    request,
    setRefreshStatus,
    readLlmConnectionSettingsFromUi
  } = input;
  function fillWorkflowModelSelect(id, providers, selectedValue) {
    fillModelSelect(id, providers, selectedValue, "No LazyDev models found");
  }
  async function loadOllamaModels() {
    setRefreshStatus("ollama-models-refresh-status", "Loading LazyDev models... ", Date.now());
    const payload = await request("/api/ollama-models");
    state.ollamaModelProviders = normalizeModelProviderCatalog(payload.providers);
    state.ollamaModels = Array.isArray(payload.available)
      ? payload.available
      : flattenModelSelectionValues(state.ollamaModelProviders);
    fillWorkflowModelSelect("ollama-text-model-select", state.ollamaModelProviders, payload.active?.textModel || "");
    fillWorkflowModelSelect("ollama-vision-model-select", state.ollamaModelProviders, payload.active?.visionModel || "");
    syncLlmModelSelectionUi();
    syncWorkflowLlmModelSelectionUi(state.globalSettings || {});
    refreshMeta.ollamaModels = Date.now();
    setRefreshStatus("ollama-models-refresh-status", "Rod models refreshed at ", refreshMeta.ollamaModels);
  }
  function syncWorkflowLlmModelSelectionUi(settings) {
    const configured = settings || {};
    fillWorkflowModelSelect("image-llm-text-model-select", state.ollamaModelProviders, configured.imageLlmTextModel || configured.ollamaTextModel || "");
    fillWorkflowModelSelect("image-llm-vision-model-select", state.ollamaModelProviders, configured.imageLlmVisionModel || configured.ollamaVisionModel || "");
    fillWorkflowModelSelect("model3d-llm-text-model-select", state.ollamaModelProviders, configured.model3dLlmTextModel || configured.ollamaTextModel || "");
    fillWorkflowModelSelect("model3d-llm-vision-model-select", state.ollamaModelProviders, configured.model3dLlmVisionModel || configured.ollamaVisionModel || "");
  }
  function syncLlmModelSelectionUi() {
    const textSelect = document.getElementById("ollama-text-model-select");
    const visionSelect = document.getElementById("ollama-vision-model-select");
    const visualToggle = document.getElementById("ollama-text-model-visual");
    const visionField = document.getElementById("ollama-vision-model-field");
    if (!textSelect || !visionSelect || !visualToggle) {
      return;
    }
    const useTextAsVision = visualToggle.checked;
    if (useTextAsVision && textSelect.value) {
      visionSelect.value = textSelect.value;
    }
    visionSelect.disabled = useTextAsVision;
    if (visionField) {
      visionField.classList.toggle("hidden", useTextAsVision);
    }
  }
  function getSelectedLlmModelsFromUi() {
    const ollamaTextModel = document.getElementById("ollama-text-model-select")?.value || "";
    const visualModelToggle = document.getElementById("ollama-text-model-visual");
    const useTextModelAsVisual = Boolean(visualModelToggle && visualModelToggle.checked);
    const selectedVisionModel = document.getElementById("ollama-vision-model-select")?.value || "";
    const ollamaVisionModel = useTextModelAsVisual ? ollamaTextModel : selectedVisionModel;
    return { ollamaTextModel, ollamaVisionModel, useTextModelAsVisual };
  }
  async function saveSelectedLlmModelsFromUi() {
    const selection = getSelectedLlmModelsFromUi();
    if (!selection.ollamaTextModel || (!selection.useTextModelAsVisual && !selection.ollamaVisionModel)) {
      throw new Error("Choose a LazyDev text model and, if needed, a LazyDev vision model.");
    }
    await request("/api/settings", {
      ollamaTextModel: selection.ollamaTextModel,
      ollamaVisionModel: selection.ollamaVisionModel,
      ollamaTextModelIsVisual: selection.useTextModelAsVisual
    });
    return selection;
  }
  async function loadActiveLlmModels(scope, executionTargetOverride) {
    const metadataExecutionTargetSelect = document.getElementById("model3d-metadata-target");
    const executionTarget = executionTargetOverride || (metadataExecutionTargetSelect && metadataExecutionTargetSelect.value === "remote" ? "remote" : "local");
    const selectedModels = await saveSelectedLlmModelsFromUi();
    const settings = readLlmConnectionSettingsFromUi();
    const result = await request("/api/llm-load-active", {
      executionTarget,
      scope,
      textModel: selectedModels.ollamaTextModel,
      visionModel: selectedModels.ollamaVisionModel,
      contextLength: settings.lmStudioContextLength
    });
    if (Array.isArray(result.failed) && result.failed.length > 0) {
      console.warn("Some LLM model load calls failed.", result.failed);
    }
    return result;
  }
  return {
    loadOllamaModels,
    syncWorkflowLlmModelSelectionUi,
    syncLlmModelSelectionUi,
    getSelectedLlmModelsFromUi,
    saveSelectedLlmModelsFromUi,
    loadActiveLlmModels
  };
}
