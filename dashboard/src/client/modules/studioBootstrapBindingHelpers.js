function createDashboardStudioBootstrapBindingHelpers(input) {
  const state = input?.state || {};
  const dashboardAutomationViewHelpers = input?.dashboardAutomationViewHelpers || null;
  const dashboardAiStudioLayoutHelpers = input?.dashboardAiStudioLayoutHelpers || null;
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const wireModelImagePicker = typeof input?.wireModelImagePicker === "function" ? input.wireModelImagePicker : null;
  const getModel3dSelectedPool = typeof input?.getModel3dSelectedPool === "function" ? input.getModel3dSelectedPool : function getModel3dSelectedPoolFallback() {
    return null;
  };
  const renderModel3dPoolSelectionList = typeof input?.renderModel3dPoolSelectionList === "function"
    ? input.renderModel3dPoolSelectionList
    : function renderModel3dPoolSelectionListFallback() {};
  const updateModel3dSourceHint = typeof input?.updateModel3dSourceHint === "function"
    ? input.updateModel3dSourceHint
    : function updateModel3dSourceHintFallback() {};
  const updateModel3dEditRoughnessValue = typeof input?.updateModel3dEditRoughnessValue === "function"
    ? input.updateModel3dEditRoughnessValue
    : function updateModel3dEditRoughnessValueFallback() {};

  function bindStudioBootstrapEvents() {
    document.querySelectorAll("[data-channel-settings-tab]").forEach(button => {
      button.addEventListener("click", event => {
        dashboardAutomationViewHelpers?.switchChannelSettingsTab(event.currentTarget.getAttribute("data-channel-settings-tab"));
      });
    });
    document.querySelectorAll("[data-model3d-studio-tab]").forEach(button => {
      button.addEventListener("click", event => {
        dashboardAiStudioLayoutHelpers?.switchModel3dStudioTab(event.currentTarget.getAttribute("data-model3d-studio-tab"));
      });
    });
    document.querySelectorAll("[data-model3d-source-tab]").forEach(button => {
      button.addEventListener("click", event => {
        dashboardAiStudioLayoutHelpers?.switchModel3dSourceTab(event.currentTarget.getAttribute("data-model3d-source-tab"));
      });
    });
    document.querySelectorAll("[data-model3d-edit-target]").forEach(button => {
      button.addEventListener("click", event => {
        dashboardAiStudioLayoutHelpers?.switchModel3dEditTargetMode(event.currentTarget.getAttribute("data-model3d-edit-target"));
      });
    });
    dashboardAiStudioLayoutHelpers?.moveModel3dAdvancedStackToSourceCard();
    dashboardAiStudioLayoutHelpers?.moveImageAdvancedStackToSidebar();
    dashboardAiStudioLayoutHelpers?.switchModel3dSourceTab(state.model3dSourceTab);
    dashboardAiStudioLayoutHelpers?.switchModel3dEditTargetMode(state.model3dEditTargetMode);
    document.querySelectorAll("[data-image-studio-tab]").forEach(button => {
      button.addEventListener("click", event => {
        dashboardAiStudioLayoutHelpers?.switchImageStudioTab(event.currentTarget.getAttribute("data-image-studio-tab"));
      });
    });
    document.querySelectorAll("[data-audio-studio-tab]").forEach(button => {
      button.addEventListener("click", event => {
        dashboardAiStudioLayoutHelpers?.switchAudioStudioTab(event.currentTarget.getAttribute("data-audio-studio-tab"));
      });
    });
    dashboardAiStudioLayoutHelpers?.switchAudioStudioTab(state.audioStudioTab);
    dashboardAutomationViewHelpers?.bindCoreEvents?.();
    if (wireModelImagePicker) {
      wireModelImagePicker("model3d-image-browse-button", "model3d-image-file", "model3d-image-source", "3D model source", ["model3d-image-browse-button"], "model3d-image-paste-button");
      wireModelImagePicker("scheduled-model-image-browse-button", "scheduled-model-image-file", "scheduled-model-image", "Scheduled model source", ["scheduled-model-image"]);
      wireModelImagePicker("join-model-image-browse-button", "join-model-image-file", "join-model-image", "Join model source", ["join-model-image"]);
    }
    document.getElementById("model3d-image-webcam-button")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const fileInput = document.getElementById("model3d-image-file");
      if (!fileInput) {
        return;
      }
      if (button) {
        button.disabled = true;
      }
      try {
        const result = await openDashboardWebcamCaptureOverlay({
          kicker: "3D Model Studio",
          title: "Capture 3D Source Image",
          message: "Capture one webcam frame and add it to the 3D model source image queue.",
          fileNamePrefix: "model3d-webcam-source",
          captureLabel: "Add Source"
        });
        if (!result) {
          return;
        }
        if (result.error) {
          throw new Error(result.error);
        }
        const transfer = new DataTransfer();
        transfer.items.add(result.file);
        fileInput.files = transfer.files;
        fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        setOutput("Captured webcam image for 3D model source.");
      } catch (error) {
        setOutput("3D webcam source failed: " + ((error && error.message) || "Unknown error"));
      } finally {
        if (button) {
          button.disabled = false;
        }
      }
    });
    const model3dSourceInput = document.getElementById("model3d-image-source");
    if (model3dSourceInput) {
      model3dSourceInput.addEventListener("input", updateModel3dSourceHint);
      model3dSourceInput.addEventListener("change", updateModel3dSourceHint);
    }
    document.getElementById("model3d-image-clear-button")?.addEventListener("click", () => {
      const model3dSourceField = document.getElementById("model3d-image-source");
      const model3dFileField = document.getElementById("model3d-image-file");
      if (model3dSourceField && typeof model3dSourceField.value === "string") {
        model3dSourceField.value = "";
        model3dSourceField.dispatchEvent(new Event("input", { bubbles: true }));
        model3dSourceField.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (model3dFileField) {
        model3dFileField.value = "";
      }
    });
    const model3dPoolSelect = document.getElementById("model3d-image-pool-select");
    if (model3dPoolSelect) {
      model3dPoolSelect.addEventListener("change", () => {
        state.model3dSelectedPoolSources = [];
        renderModel3dPoolSelectionList();
      });
    }
    document.getElementById("model3d-pool-select-all-button")?.addEventListener("click", () => {
      const selectedPool = getModel3dSelectedPool();
      state.model3dSelectedPoolSources = Array.isArray(selectedPool?.images)
        ? selectedPool.images.map(entry => String(entry || "").trim()).filter(Boolean)
        : [];
      renderModel3dPoolSelectionList();
    });
    document.getElementById("model3d-pool-clear-selection-button")?.addEventListener("click", () => {
      state.model3dSelectedPoolSources = [];
      renderModel3dPoolSelectionList();
    });
    document.getElementById("model3d-edit-roughness")?.addEventListener("input", updateModel3dEditRoughnessValue);
    updateModel3dEditRoughnessValue();
    updateModel3dSourceHint();
    renderModel3dPoolSelectionList();
  }

  return {
    bindStudioBootstrapEvents
  };
}
