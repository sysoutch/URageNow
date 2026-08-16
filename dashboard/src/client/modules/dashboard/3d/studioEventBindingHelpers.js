function createDashboardThreeDStudioEventBindingHelpers(input) {
  const state = input?.state || {};
  const model3dViewer = input?.model3dViewer || {};
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const refreshState = typeof input?.refreshState === "function" ? input.refreshState : async function refreshStateFallback() {};
  const getSelectedGeneratedModel = typeof input?.getSelectedGeneratedModel === "function"
    ? input.getSelectedGeneratedModel
    : function getSelectedGeneratedModelFallback() {
      return null;
    };
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const setModel3dStatus = typeof input?.setModel3dStatus === "function" ? input.setModel3dStatus : function setModel3dStatusFallback() {};
  const setModel3dThreeStatus = typeof input?.setModel3dThreeStatus === "function" ? input.setModel3dThreeStatus : function setModel3dThreeStatusFallback() {};
  const runModel3dGenerationFromStudio = typeof input?.runModel3dGenerationFromStudio === "function"
    ? input.runModel3dGenerationFromStudio
    : async function runModel3dGenerationFromStudioFallback() {};
  const runLowPolyGenerationForSelectedModel = typeof input?.runLowPolyGenerationForSelectedModel === "function"
    ? input.runLowPolyGenerationForSelectedModel
    : async function runLowPolyGenerationForSelectedModelFallback() {};
  const openAutoRigPanelForSelectedModel = typeof input?.openAutoRigPanelForSelectedModel === "function"
    ? input.openAutoRigPanelForSelectedModel
    : async function openAutoRigPanelForSelectedModelFallback() {};
  const runAutoRigPreviewForSelectedModel = typeof input?.runAutoRigPreviewForSelectedModel === "function"
    ? input.runAutoRigPreviewForSelectedModel
    : async function runAutoRigPreviewForSelectedModelFallback() {};
  const finalizeAutoRigForSelectedModel = typeof input?.finalizeAutoRigForSelectedModel === "function"
    ? input.finalizeAutoRigForSelectedModel
    : async function finalizeAutoRigForSelectedModelFallback() {};
  const renderAutoRigVerification = typeof input?.renderAutoRigVerification === "function"
    ? input.renderAutoRigVerification
    : function renderAutoRigVerificationFallback() {};
  const activateModel3dViewerPreview = typeof input?.activateModel3dViewerPreview === "function"
    ? input.activateModel3dViewerPreview
    : async function activateModel3dViewerPreviewFallback() {};
  const setModel3dThreeVariant = typeof input?.setModel3dThreeVariant === "function"
    ? input.setModel3dThreeVariant
    : function setModel3dThreeVariantFallback() {};
  const setModel3dViewerWireframeEnabled = typeof input?.setModel3dViewerWireframeEnabled === "function"
    ? input.setModel3dViewerWireframeEnabled
    : function setModel3dViewerWireframeEnabledFallback() {};
  const setModel3dViewerMetallicEnabled = typeof input?.setModel3dViewerMetallicEnabled === "function"
    ? input.setModel3dViewerMetallicEnabled
    : function setModel3dViewerMetallicEnabledFallback() {};
  const setModel3dViewerRoughness = typeof input?.setModel3dViewerRoughness === "function"
    ? input.setModel3dViewerRoughness
    : function setModel3dViewerRoughnessFallback() {};
  const updateModel3dViewerRoughnessUi = typeof input?.updateModel3dViewerRoughnessUi === "function"
    ? input.updateModel3dViewerRoughnessUi
    : function updateModel3dViewerRoughnessUiFallback() {};
  const setModel3dViewerTextureEnabled = typeof input?.setModel3dViewerTextureEnabled === "function"
    ? input.setModel3dViewerTextureEnabled
    : function setModel3dViewerTextureEnabledFallback() {};
  const setModel3dViewerFlatShadingEnabled = typeof input?.setModel3dViewerFlatShadingEnabled === "function"
    ? input.setModel3dViewerFlatShadingEnabled
    : function setModel3dViewerFlatShadingEnabledFallback() {};
  const setModel3dViewerMaterialMode = typeof input?.setModel3dViewerMaterialMode === "function"
    ? input.setModel3dViewerMaterialMode
    : function setModel3dViewerMaterialModeFallback() {};
  const setModel3dViewerSkyboxEnabled = typeof input?.setModel3dViewerSkyboxEnabled === "function"
    ? input.setModel3dViewerSkyboxEnabled
    : function setModel3dViewerSkyboxEnabledFallback() {};
  const setModel3dViewerGridEnabled = typeof input?.setModel3dViewerGridEnabled === "function"
    ? input.setModel3dViewerGridEnabled
    : function setModel3dViewerGridEnabledFallback() {};
  const setModel3dViewerRigVisible = typeof input?.setModel3dViewerRigVisible === "function"
    ? input.setModel3dViewerRigVisible
    : function setModel3dViewerRigVisibleFallback() {};
  const setModel3dViewerAxisMode = typeof input?.setModel3dViewerAxisMode === "function"
    ? input.setModel3dViewerAxisMode
    : function setModel3dViewerAxisModeFallback() {};
  const runModel3dLlmScaleForSelectedModel = typeof input?.runModel3dLlmScaleForSelectedModel === "function"
    ? input.runModel3dLlmScaleForSelectedModel
    : async function runModel3dLlmScaleForSelectedModelFallback() {};
  const dashboardModel3dStudioActionHelpers = input?.dashboardModel3dStudioActionHelpers || null;
  const dashboardModel3dQuickActionModalHelpers = input?.dashboardModel3dQuickActionModalHelpers || null;
  const dashboardModel3dInspectorHelpers = input?.dashboardModel3dInspectorHelpers || null;
  const dashboardModel3dViewportControlHelpers = input?.dashboardModel3dViewportControlHelpers || null;
  const dashboardModel3dSendDestinationHelpers = input?.dashboardModel3dSendDestinationHelpers || null;
  const dashboardAiStudioLayoutHelpers = input?.dashboardAiStudioLayoutHelpers || null;

  function getLodTargetFaceCounts(group) {
    if (group === "Hero Asset") {
      return [50000, 25000, 10000];
    }
    if (group === "Prop") {
      return [10000, 5000, 2000];
    }
    return [5000, 2000, 750];
  }

  function getAutomaticLodTargetFaceCounts(modelId) {
    const inspectionCache = state.model3dInspectionByKey && typeof state.model3dInspectionByKey === "object"
      ? state.model3dInspectionByKey
      : {};
    const prefix = String(modelId || "") + "|";
    const cacheKeys = Object.keys(inspectionCache).filter(key => key.startsWith(prefix));
    const cacheKey = cacheKeys.find(key => key.startsWith(prefix + "merged|")) || cacheKeys[0];
    const faceCount = Number(cacheKey ? inspectionCache[cacheKey]?.inspection?.stats?.geometry?.faceCount : 0);
    if (!Number.isFinite(faceCount) || faceCount <= 0) {
      return null;
    }
    return [0.5, 0.25, 0.1]
      .map(ratio => Math.max(100, Math.round(faceCount * ratio)))
      .filter((value, index, values) => index === 0 || value < values[index - 1]);
  }

  async function generateLodsForSelectedModel() {
    const selected = getSelectedGeneratedModel();
    if (!selected?.id) {
      setModel3dStatus("Select a 3D model before generating LODs.");
      return;
    }
    const button = document.getElementById("model3d-inspector-generate-lods-button");
    const group = document.getElementById("model3d-inspector-lod-group")?.value || "None";
    const autoLod = document.getElementById("model3d-inspector-auto-lod")?.checked === true;
    const targetFaceCounts = (autoLod ? getAutomaticLodTargetFaceCounts(selected.id) : null) || getLodTargetFaceCounts(group);
    if (button) {
      button.disabled = true;
      button.textContent = "Generating LODs...";
    }
    setModel3dStatus("Generating " + targetFaceCounts.length + " LODs in Blender...");
    try {
      const generated = await request("/api/model3d-generate-lods", {
        modelId: selected.id,
        executionTarget: document.getElementById("model3d-metadata-target")?.value === "remote" ? "remote" : "local",
        targetFaceCounts
      });
      const index = Array.isArray(state.generatedModels) ? state.generatedModels.findIndex(record => record?.id === generated?.id) : -1;
      if (index >= 0) {
        state.generatedModels[index] = generated;
      }
      dashboardModel3dInspectorHelpers?.renderLodArtifacts(generated);
      await refreshState();
      setModel3dStatus("Generated " + (generated?.lodArtifacts?.length || 0) + " LODs.");
      setOutput("Generated LOD files for " + (generated?.modelFileName || selected.modelFileName || selected.id) + ".");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setModel3dStatus("LOD generation failed.");
      setOutput("Failed to generate LODs: " + detail);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Generate LODs";
      }
    }
  }

  function bindModel3dStudioEvents() {
    const comfyFreeButton = document.getElementById("comfy-free-button");
    if (comfyFreeButton) {
      comfyFreeButton.addEventListener("click", async () => {
        await request("/api/comfy-free", { unloadModels: true, freeMemory: true });
        setModel3dStatus("Requested ComfyUI unload/free memory.");
        setOutput("ComfyUI memory free requested.");
      });
    }
    const generateModel3dButton = document.getElementById("generate-model3d-button");
    if (generateModel3dButton) {
      generateModel3dButton.addEventListener("click", async () => {
        await runModel3dGenerationFromStudio();
      });
    }
    document.getElementById("stop-model3d-generation-button")?.addEventListener("click", async () => {
      if (dashboardModel3dStudioActionHelpers && typeof dashboardModel3dStudioActionHelpers.stopModel3dGeneration === "function") {
        await dashboardModel3dStudioActionHelpers.stopModel3dGeneration();
      }
    });
    const generateModel3dLowPolySelectedButton = document.getElementById("generate-model3d-lowpoly-selected-button");
    if (generateModel3dLowPolySelectedButton) {
      generateModel3dLowPolySelectedButton.addEventListener("click", async () => {
        await runLowPolyGenerationForSelectedModel();
      });
    }
    document.getElementById("model3d-create-lowpoly-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await runLowPolyGenerationForSelectedModel();
    });
    document.getElementById("model3d-inspector-generate-lods-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await generateLodsForSelectedModel();
    });
    document.getElementById("model3d-inspector-rebuild-textures-button")?.addEventListener("click", event => {
      event.preventDefault();
      dashboardAiStudioLayoutHelpers?.switchModel3dStudioTab("edit");
      const metallicMode = document.getElementById("model3d-edit-metallic-mode");
      const roughnessEnabled = document.getElementById("model3d-edit-roughness-enabled");
      if (metallicMode && typeof metallicMode.value === "string") {
        metallicMode.value = "keep";
      }
      if (roughnessEnabled && typeof roughnessEnabled.checked === "boolean") {
        roughnessEnabled.checked = true;
      }
      document.getElementById("model3d-edit-roughness")?.focus();
      setModel3dStatus("Texture rebuild uses the Model Finish controls. Adjust roughness/materials, then Apply Model Edit.");
    });
    function ensureModel3dAdvancedStackPlacement() {
      const stack = document.getElementById("model3d-advanced-stack");
      const button = document.getElementById("model3d-advanced-settings-button");
      if (!stack || !button || stack.previousElementSibling === button) {
        return stack;
      }
      button.insertAdjacentElement("afterend", stack);
      return stack;
    }
    function setModel3dAdvancedOptionsVisible(visible) {
      const stack = ensureModel3dAdvancedStackPlacement();
      const details = stack?.querySelector("details");
      if (!stack || !details) {
        return;
      }
      stack.classList.toggle("is-open", visible === true);
      details.open = visible === true;
      ["model3d-toggle-advanced-button", "model3d-advanced-settings-button"].forEach(id => {
        const button = document.getElementById(id);
        button?.classList.toggle("active", visible === true);
        button?.setAttribute("aria-expanded", visible === true ? "true" : "false");
      });
      if (visible === true) {
        const scroller = stack.parentElement?.closest(".model3d-studio-main, #model3d-sidebar-panel");
        if (scroller) {
          scroller.scrollTop = Math.max(0, stack.offsetTop - 16);
        }
        stack.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
    document.getElementById("model3d-toggle-advanced-button")?.addEventListener("click", event => {
      event.preventDefault();
      const details = document.querySelector("#model3d-advanced-stack details");
      setModel3dAdvancedOptionsVisible(!(details && details.open));
    });
    document.getElementById("model3d-advanced-settings-button")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dAdvancedOptionsVisible(true);
      setModel3dStatus("Advanced 3D generation options opened.");
    });
    document.getElementById("model3d-rotate-button")?.addEventListener("click", event => {
      event.preventDefault();
      dashboardModel3dQuickActionModalHelpers?.openModel3dQuickActionModal("rotate");
    });
    document.getElementById("model3d-delight-button")?.addEventListener("click", event => {
      event.preventDefault();
      dashboardModel3dQuickActionModalHelpers?.openModel3dQuickActionModal("delight");
    });
    document.getElementById("model3d-albedo-to-geometry-button")?.addEventListener("click", event => {
      event.preventDefault();
      dashboardModel3dQuickActionModalHelpers?.openModel3dQuickActionModal("albedo-to-geometry");
    });
    document.getElementById("model3d-quick-action-mode")?.addEventListener("change", () => {
      dashboardModel3dQuickActionModalHelpers?.syncQuickActionModeUi();
    });
    document.getElementById("model3d-quick-action-background")?.addEventListener("change", () => {
      dashboardModel3dQuickActionModalHelpers?.syncQuickActionModeUi();
    });
    document.getElementById("model3d-quick-action-bg-color")?.addEventListener("input", () => {
      dashboardModel3dQuickActionModalHelpers?.syncBlenderBackgroundColorUi();
    });
    document.querySelectorAll("[data-model3d-background-color]").forEach(button => {
      button.addEventListener("click", () => dashboardModel3dQuickActionModalHelpers?.setBlenderBackgroundColor(button.dataset.model3dBackgroundColor));
    });
    document.getElementById("model3d-quick-action-studio-background")?.addEventListener("change", () => {
      dashboardModel3dQuickActionModalHelpers?.syncQuickActionModeUi();
    });
    ["model3d-quick-action-albedo-topology-mode", "model3d-quick-action-albedo-subdivisions"].forEach(id => {
      const node = document.getElementById(id);
      node?.addEventListener("input", () => dashboardModel3dQuickActionModalHelpers?.updateAlbedoFaceCountEstimate());
      node?.addEventListener("change", () => dashboardModel3dQuickActionModalHelpers?.updateAlbedoFaceCountEstimate());
    });
    ["model3d-quick-action-close-button", "model3d-quick-action-cancel-button", "model3d-quick-action-backdrop"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", event => {
        event.preventDefault();
        dashboardModel3dQuickActionModalHelpers?.closeModel3dQuickActionModal();
      });
    });
    document.getElementById("model3d-quick-action-run-button")?.addEventListener("click", async event => {
      event.preventDefault();
      dashboardModel3dQuickActionModalHelpers?.setQuickActionRunState(true);
      try {
        await dashboardModel3dQuickActionModalHelpers?.runModel3dQuickAction();
        dashboardModel3dQuickActionModalHelpers?.closeModel3dQuickActionModal();
      } catch (error) {
        setModel3dStatus("3D quick action failed.");
        setOutput(error && error.message ? error.message : "3D quick action failed.");
      } finally {
        dashboardModel3dQuickActionModalHelpers?.setQuickActionRunState(false);
      }
    });
    ["model3d-autorig-button", "model3d-autorig-selected-button"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", async () => {
        await openAutoRigPanelForSelectedModel();
      });
    });
    ["model3d-rigging-open-panel-button", "model3d-rigging-open-markers-button"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", async event => {
        event.preventDefault();
        await openAutoRigPanelForSelectedModel();
      });
    });
    document.getElementById("model3d-rigging-preview-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await runAutoRigPreviewForSelectedModel({ useVision: true });
    });
    document.getElementById("model3d-rigging-update-preview-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await runAutoRigPreviewForSelectedModel({ useEditedLandmarks: true, useVision: true });
    });
    document.getElementById("model3d-rigging-finalize-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await finalizeAutoRigForSelectedModel();
    });
    document.getElementById("model3d-autorig-refresh-preview-button")?.addEventListener("click", async () => {
      await runAutoRigPreviewForSelectedModel({ useEditedLandmarks: true, useVision: true });
    });
    document.getElementById("model3d-autorig-manual-refresh-button")?.addEventListener("click", async () => {
      await runAutoRigPreviewForSelectedModel({ useEditedLandmarks: true, useVision: false });
    });
    document.getElementById("model3d-autorig-finalize-button")?.addEventListener("click", async () => {
      await finalizeAutoRigForSelectedModel();
    });
    document.getElementById("model3d-autorig-clear-button")?.addEventListener("click", () => {
      renderAutoRigVerification(null);
    });
    document.getElementById("model3d-autorig-back-button")?.addEventListener("click", () => {
      renderAutoRigVerification(null);
    });
    document.querySelectorAll("[data-autorig-tab]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        dashboardModel3dStudioActionHelpers?.setAutoRigMode(button.getAttribute("data-autorig-tab") || "basic");
      });
    });
    [["model3d-three-variant-lowpoly", "lowpoly"], ["model3d-three-variant-albedo", "albedo"], ["model3d-three-variant-current", "current"], ["model3d-three-variant-original", "original"]].forEach(([id, variant]) => {
      document.getElementById(id)?.addEventListener("click", event => {
        event.preventDefault();
        model3dViewer.previewActive = true;
        setModel3dThreeVariant(variant);
        dashboardModel3dInspectorHelpers?.refreshForCurrentVariant();
      });
    });
    document.getElementById("model3d-canvas")?.addEventListener("click", () => {
      void activateModel3dViewerPreview();
    });
    document.getElementById("model3d-threejs-status")?.addEventListener("click", () => {
      void activateModel3dViewerPreview();
    });
    document.getElementById("model3d-three-wireframe-button")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerWireframeEnabled(!(state.model3dViewerWireframeEnabled === true));
      setModel3dThreeStatus("Preview wireframe " + (state.model3dViewerWireframeEnabled ? "enabled." : "disabled."));
    });
    document.getElementById("model3d-three-metallic-button")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerMetallicEnabled(state.model3dViewerMetallicEnabled === false);
      setModel3dThreeStatus("Preview metallic " + (state.model3dViewerMetallicEnabled ? "enabled." : "disabled."));
    });
    const model3dThreeRoughnessSlider = document.getElementById("model3d-three-roughness-slider");
    if (model3dThreeRoughnessSlider) {
      const applyRoughnessChange = event => {
        const nextValue = Number.parseFloat(event.target.value || "0.5");
        setModel3dViewerRoughness(nextValue);
        setModel3dThreeStatus("Preview roughness set to " + state.model3dViewerRoughness.toFixed(2) + ".");
      };
      model3dThreeRoughnessSlider.addEventListener("input", applyRoughnessChange);
      model3dThreeRoughnessSlider.addEventListener("change", applyRoughnessChange);
      updateModel3dViewerRoughnessUi();
    }
    document.querySelectorAll("[data-model3d-roughness-slider]").forEach(slider => {
      if (slider.id === "model3d-three-roughness-slider") {
        return;
      }
      const applyRoughnessChange = event => {
        const nextValue = Number.parseFloat(event.target.value || "0.5");
        setModel3dViewerRoughness(nextValue);
        setModel3dThreeStatus("Preview roughness set to " + state.model3dViewerRoughness.toFixed(2) + ".");
      };
      slider.addEventListener("input", applyRoughnessChange);
      slider.addEventListener("change", applyRoughnessChange);
    });
    document.getElementById("model3d-three-texture-button")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerTextureEnabled(state.model3dViewerTextureEnabled === false);
      setModel3dThreeStatus("Preview material mode set to " + (state.model3dViewerTextureEnabled ? "textured." : "material colors."));
    });
    document.getElementById("model3d-three-flat-shading-button")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerFlatShadingEnabled(!(state.model3dViewerFlatShadingEnabled === true));
      setModel3dThreeStatus("Preview normals set to " + (state.model3dViewerFlatShadingEnabled ? "flat." : "smooth."));
    });
    document.querySelectorAll("[data-model3d-material-mode]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const mode = String(button.getAttribute("data-model3d-material-mode") || "textured");
        setModel3dViewerMaterialMode(mode);
        setModel3dThreeStatus("Preview material mode set to " + mode + ".");
      });
    });
    document.querySelectorAll("[data-model3d-viewer-toggle]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const action = String(button.getAttribute("data-model3d-viewer-toggle") || "");
        if (action === "wireframe") {
          setModel3dViewerWireframeEnabled(!(state.model3dViewerWireframeEnabled === true));
          setModel3dThreeStatus("Preview wireframe " + (state.model3dViewerWireframeEnabled ? "enabled." : "disabled."));
        }
        if (action === "metallic") {
          setModel3dViewerMetallicEnabled(state.model3dViewerMetallicEnabled === false);
          setModel3dThreeStatus("Preview metallic " + (state.model3dViewerMetallicEnabled ? "enabled." : "disabled."));
        }
        if (action === "flat") {
          setModel3dViewerFlatShadingEnabled(!(state.model3dViewerFlatShadingEnabled === true));
          setModel3dThreeStatus("Preview normals set to " + (state.model3dViewerFlatShadingEnabled ? "flat." : "smooth."));
        }
        if (action === "skybox") {
          setModel3dViewerSkyboxEnabled(!(state.model3dViewerSkyboxEnabled === true));
          setModel3dThreeStatus("Preview skybox " + (state.model3dViewerSkyboxEnabled ? "enabled." : "disabled."));
        }
      });
    });
    document.getElementById("model3d-three-shade-flat")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerFlatShadingEnabled(true);
      setModel3dThreeStatus("Preview shading set to flat.");
    });
    document.getElementById("model3d-three-shade-smooth")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerFlatShadingEnabled(false);
      setModel3dThreeStatus("Preview shading set to smooth.");
    });
    const model3dGridToggle = document.getElementById("model3d-grid-toggle");
    if (model3dGridToggle) {
      model3dGridToggle.checked = state.model3dViewerGridEnabled === true;
      model3dGridToggle.addEventListener("change", event => {
        setModel3dViewerGridEnabled(event.target.checked === true);
        setModel3dThreeStatus("Preview grid " + (state.model3dViewerGridEnabled ? "enabled." : "disabled."));
      });
    }
    const model3dRigToggle = document.getElementById("model3d-rig-toggle");
    if (model3dRigToggle) {
      model3dRigToggle.checked = state.model3dViewerRigVisible === true;
      model3dRigToggle.addEventListener("change", event => {
        setModel3dViewerRigVisible(event.target.checked === true);
        setModel3dThreeStatus("Preview rig " + (state.model3dViewerRigVisible ? "visible." : "hidden."));
      });
    }
    document.getElementById("model3d-three-axis-blender-button")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerAxisMode("blender");
      setModel3dThreeStatus("Preview axis set to Blender.");
    });
    document.getElementById("model3d-three-axis-gameengine-button")?.addEventListener("click", event => {
      event.preventDefault();
      setModel3dViewerAxisMode("gameengine");
      setModel3dThreeStatus("Preview axis set to game engine.");
    });
    document.getElementById("model3d-three-scale-llm-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await runModel3dLlmScaleForSelectedModel();
    });
    dashboardModel3dViewportControlHelpers?.bindModel3dViewportEvents();
    dashboardModel3dSendDestinationHelpers?.bind();
  }

  return {
    bindModel3dStudioEvents
  };
}
