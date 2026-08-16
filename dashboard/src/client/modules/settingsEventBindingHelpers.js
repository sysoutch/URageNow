function createDashboardSettingsEventBindingHelpers(input) {
  const refreshMeta = input?.refreshMeta || {};
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const setElementValue = typeof input?.setElementValue === "function" ? input.setElementValue : function setElementValueFallback() {};
  const setElementChecked = typeof input?.setElementChecked === "function" ? input.setElementChecked : function setElementCheckedFallback() {};
  const readStudioRailHoverModePreference = typeof input?.readStudioRailHoverModePreference === "function"
    ? input.readStudioRailHoverModePreference
    : function readStudioRailHoverModePreferenceFallback() { return "off"; };
  const setStudioRailHoverMode = typeof input?.setStudioRailHoverMode === "function"
    ? input.setStudioRailHoverMode
    : function setStudioRailHoverModeFallback() {};
  const saveMessagingGlobalSettingsFromUi = typeof input?.saveMessagingGlobalSettingsFromUi === "function"
    ? input.saveMessagingGlobalSettingsFromUi
    : async function saveMessagingGlobalSettingsFromUiFallback() {};
  const loadOllamaModels = typeof input?.loadOllamaModels === "function" ? input.loadOllamaModels : async function loadOllamaModelsFallback() {};
  const saveSelectedLlmModelsFromUi = typeof input?.saveSelectedLlmModelsFromUi === "function"
    ? input.saveSelectedLlmModelsFromUi
    : async function saveSelectedLlmModelsFromUiFallback() {};
  const saveComfyPathSettingsFromUi = typeof input?.saveComfyPathSettingsFromUi === "function"
    ? input.saveComfyPathSettingsFromUi
    : async function saveComfyPathSettingsFromUiFallback() {};
  const loadGlobalSettingsFromState = typeof input?.loadGlobalSettingsFromState === "function"
    ? input.loadGlobalSettingsFromState
    : async function loadGlobalSettingsFromStateFallback() {};
  const saveLlmConnectionSettingsFromUi = typeof input?.saveLlmConnectionSettingsFromUi === "function"
    ? input.saveLlmConnectionSettingsFromUi
    : async function saveLlmConnectionSettingsFromUiFallback() {};
  const saveImageLlmConnectionSettingsFromUi = typeof input?.saveImageLlmConnectionSettingsFromUi === "function"
    ? input.saveImageLlmConnectionSettingsFromUi
    : async function saveImageLlmConnectionSettingsFromUiFallback() {};
  const saveModel3dLlmConnectionSettingsFromUi = typeof input?.saveModel3dLlmConnectionSettingsFromUi === "function"
    ? input.saveModel3dLlmConnectionSettingsFromUi
    : async function saveModel3dLlmConnectionSettingsFromUiFallback() {};
  const loadActiveLlmModels = typeof input?.loadActiveLlmModels === "function"
    ? input.loadActiveLlmModels
    : async function loadActiveLlmModelsFallback() {};
  const refreshState = typeof input?.refreshState === "function" ? input.refreshState : async function refreshStateFallback() {};

  function bindLlmConnectionButton(saveButtonId, reloadButtonId, saveCallback, saveOutputText, reloadOutputText) {
    const saveButton = document.getElementById(saveButtonId);
    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        await saveCallback();
        setOutput(saveOutputText);
      });
    }
    const reloadButton = document.getElementById(reloadButtonId);
    if (reloadButton) {
      reloadButton.addEventListener("click", async () => {
        await loadGlobalSettingsFromState();
        setOutput(reloadOutputText);
      });
    }
  }

  function bindSettingsEvents() {
    const sidebarHoverModeSelect = document.getElementById("settings-sidebar-hover-mode-select");
    if (sidebarHoverModeSelect) {
      setElementValue("settings-sidebar-hover-mode-select", readStudioRailHoverModePreference());
      sidebarHoverModeSelect.addEventListener("change", event => {
        const nextMode = ["off", "temp-expand", "collapse-expand", "collapse-expand-keep-others"].includes(event.currentTarget?.value)
          ? event.currentTarget.value
          : "off";
        setStudioRailHoverMode(nextMode);
        const label = nextMode === "collapse-expand-keep-others"
          ? "Collapse+Expand (keep others)"
          : nextMode === "collapse-expand"
          ? "Collapse+Expand"
          : nextMode === "temp-expand"
            ? "Temp Expand"
            : "Off";
        setOutput("Sidebar hover mode set to " + label + ".");
      });
    }
    ["require-confirmation", "strip-metadata-webui", "strip-metadata-discord", "image-strip-metadata-storage"].forEach(id => {
      const node = document.getElementById(id);
      if (!node) {
        return;
      }
      node.addEventListener("change", async () => {
        if (id === "strip-metadata-webui") {
          setElementChecked("image-strip-metadata-storage", node.checked === true);
        } else if (id === "image-strip-metadata-storage") {
          setElementChecked("strip-metadata-webui", node.checked === true);
        }
        await saveMessagingGlobalSettingsFromUi();
        setOutput("Messaging AI settings saved.");
      });
    });
    document.getElementById("refresh-ollama-models-button")?.addEventListener("click", async () => {
      await loadOllamaModels();
      setOutput("Rod models refreshed.");
    });
    document.getElementById("save-ollama-models-button")?.addEventListener("click", async () => {
      if (refreshMeta.ollamaModels === 0) {
        await loadOllamaModels();
      }
      await saveSelectedLlmModelsFromUi();
      setOutput("Rod model choices saved.");
    });
    [
      {
        saveButtonId: "save-comfy-model-path-settings-button",
        reloadButtonId: "reload-comfy-model-path-settings-button",
        statusId: "comfy-model-path-settings-status",
        saveStatusText: "Saved 3D Comfy endpoint + path settings.",
        saveOutputText: "3D Comfy settings saved.",
        reloadOutputText: "Reloaded saved 3D Comfy settings.",
        requiredFields: ["comfyUiBaseUrl", "comfyUiInputDir", "comfyUiModelBaseUrl", "comfyUiModelWorkflowPath"]
      },
      {
        saveButtonId: "save-comfy-image-path-settings-button",
        reloadButtonId: "reload-comfy-image-path-settings-button",
        statusId: "comfy-image-path-settings-status",
        saveStatusText: "Saved Image Comfy endpoint + path settings.",
        saveOutputText: "Image Comfy settings saved.",
        reloadOutputText: "Reloaded saved Image Comfy settings.",
        requiredFields: ["comfyUiImageBaseUrl", "comfyUiImageWorkflowPath"]
      },
      {
        saveButtonId: "save-comfy-audio-path-settings-button",
        reloadButtonId: "reload-comfy-audio-path-settings-button",
        statusId: "comfy-audio-path-settings-status",
        saveStatusText: "Saved Audio Comfy endpoint + path settings.",
        saveOutputText: "Audio Comfy settings saved.",
        reloadOutputText: "Reloaded saved Audio Comfy settings.",
        requiredFields: ["comfyUiAudioBaseUrl", "comfyUiAudioWorkflowPath"]
      },
      {
        saveButtonId: "save-comfy-music-path-settings-button",
        reloadButtonId: "reload-comfy-music-path-settings-button",
        statusId: "comfy-music-path-settings-status",
        saveStatusText: "Saved Music Comfy endpoint + path settings.",
        saveOutputText: "Music Comfy settings saved.",
        reloadOutputText: "Reloaded saved Music Comfy settings.",
        requiredFields: ["comfyUiMusicBaseUrl", "comfyUiMusicWorkflowPath"]
      },
      {
        saveButtonId: "save-comfy-video-path-settings-button",
        reloadButtonId: "reload-comfy-video-path-settings-button",
        statusId: "comfy-video-path-settings-status",
        saveStatusText: "Saved Video Comfy endpoint + path settings.",
        saveOutputText: "Video Comfy settings saved.",
        reloadOutputText: "Reloaded saved Video Comfy settings.",
        requiredFields: ["comfyUiVideoBaseUrl", "comfyUiVideoWorkflowPath"]
      }
    ].forEach(section => {
      const saveButton = document.getElementById(section.saveButtonId);
      if (saveButton) {
        saveButton.addEventListener("click", async () => {
          await saveComfyPathSettingsFromUi({
            requiredFields: section.requiredFields,
            statusId: section.statusId,
            statusText: section.saveStatusText
          });
          setOutput(section.saveOutputText);
        });
      }
      const reloadButton = document.getElementById(section.reloadButtonId);
      if (reloadButton) {
        reloadButton.addEventListener("click", async () => {
          await loadGlobalSettingsFromState();
          setOutput(section.reloadOutputText);
        });
      }
    });
    bindLlmConnectionButton(
      "save-llm-connection-settings-button",
      "reload-llm-connection-settings-button",
      saveLlmConnectionSettingsFromUi,
      "LLM connection settings saved.",
      "Reloaded saved LLM connection settings."
    );
    bindLlmConnectionButton(
      "save-image-llm-connection-settings-button",
      "reload-image-llm-connection-settings-button",
      saveImageLlmConnectionSettingsFromUi,
      "Image LLM connection settings saved.",
      "Reloaded saved Image LLM connection settings."
    );
    bindLlmConnectionButton(
      "save-model3d-llm-connection-settings-button",
      "reload-model3d-llm-connection-settings-button",
      saveModel3dLlmConnectionSettingsFromUi,
      "3D LLM connection settings saved.",
      "Reloaded saved 3D LLM connection settings."
    );
    document.getElementById("load-text-model-button")?.addEventListener("click", async () => {
      if (refreshMeta.ollamaModels === 0) {
        await loadOllamaModels();
      }
      await loadActiveLlmModels("text", "local");
      setOutput("Text model load requested.");
    });
    document.getElementById("load-vision-model-button")?.addEventListener("click", async () => {
      if (refreshMeta.ollamaModels === 0) {
        await loadOllamaModels();
      }
      await loadActiveLlmModels("vision", "local");
      setOutput("Vision model load requested.");
    });
    document.getElementById("refresh-workspace")?.addEventListener("click", async () => {
      await refreshState();
      setOutput("Workspace refreshed.");
    });
  }

  return {
    bindSettingsEvents
  };
}

