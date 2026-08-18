function createDashboardThreeDViewportControlHelpers(input) {
  const state = input?.state || {};
  const normalizeModel3dPreviewRenderMode = typeof input?.normalizeModel3dPreviewRenderMode === "function"
    ? input.normalizeModel3dPreviewRenderMode
    : value => value;
  const normalizeModel3dPreviewProjection = typeof input?.normalizeModel3dPreviewProjection === "function"
    ? input.normalizeModel3dPreviewProjection
    : value => value;
  const applyModel3dPreviewViewSettings = typeof input?.applyModel3dPreviewViewSettings === "function"
    ? input.applyModel3dPreviewViewSettings
    : function applyModel3dPreviewViewSettingsFallback() {};
  const getModel3dPreviewRenderOptions = typeof input?.getModel3dPreviewRenderOptions === "function"
    ? input.getModel3dPreviewRenderOptions
    : function getModel3dPreviewRenderOptionsFallback() {
      return {};
    };
  const activateModel3dViewerPreview = typeof input?.activateModel3dViewerPreview === "function"
    ? input.activateModel3dViewerPreview
    : async function activateModel3dViewerPreviewFallback() {};
  const setModel3dThreeStatus = typeof input?.setModel3dThreeStatus === "function"
    ? input.setModel3dThreeStatus
    : function setModel3dThreeStatusFallback() {};
  const setModel3dViewerTextureEnabled = typeof input?.setModel3dViewerTextureEnabled === "function"
    ? input.setModel3dViewerTextureEnabled
    : function setModel3dViewerTextureEnabledFallback() {};
  const setModel3dViewerWireframeEnabled = typeof input?.setModel3dViewerWireframeEnabled === "function"
    ? input.setModel3dViewerWireframeEnabled
    : function setModel3dViewerWireframeEnabledFallback() {};
  const setModel3dViewerGridEnabled = typeof input?.setModel3dViewerGridEnabled === "function"
    ? input.setModel3dViewerGridEnabled
    : function setModel3dViewerGridEnabledFallback() {};
  const openModel3dGifExportModal = typeof input?.openModel3dGifExportModal === "function"
    ? input.openModel3dGifExportModal
    : function openModel3dGifExportModalFallback() {};
  const closeModel3dGifExportModal = typeof input?.closeModel3dGifExportModal === "function"
    ? input.closeModel3dGifExportModal
    : function closeModel3dGifExportModalFallback() {};
  const readModel3dGifExportOptions = typeof input?.readModel3dGifExportOptions === "function"
    ? input.readModel3dGifExportOptions
    : function readModel3dGifExportOptionsFallback() {
      return {};
    };
  const exportModel3dPreviewGif = typeof input?.exportModel3dPreviewGif === "function"
    ? input.exportModel3dPreviewGif
    : async function exportModel3dPreviewGifFallback() {};
  const updateModel3dGifExportBackgroundField = typeof input?.updateModel3dGifExportBackgroundField === "function"
    ? input.updateModel3dGifExportBackgroundField
    : function updateModel3dGifExportBackgroundFieldFallback() {};
  const openSelectedModelInBlender = typeof input?.openSelectedModelInBlender === "function"
    ? input.openSelectedModelInBlender
    : async function openSelectedModelInBlenderFallback() {};
  const openModel3dShareOverlay = typeof input?.openModel3dShareOverlay === "function"
    ? input.openModel3dShareOverlay
    : function openModel3dShareOverlayFallback() {};
  const runModel3dLlmScaleForSelectedModel = typeof input?.runModel3dLlmScaleForSelectedModel === "function"
    ? input.runModel3dLlmScaleForSelectedModel
    : async function runModel3dLlmScaleForSelectedModelFallback() {};
  const runModel3dSeparateByLoosePartsForSelectedModel = typeof input?.runModel3dSeparateByLoosePartsForSelectedModel === "function"
    ? input.runModel3dSeparateByLoosePartsForSelectedModel
    : async function runModel3dSeparateByLoosePartsForSelectedModelFallback() {};
  const stopModel3dGeneration = typeof input?.stopModel3dGeneration === "function"
    ? input.stopModel3dGeneration
    : async function stopModel3dGenerationFallback() {};

  function setModel3dSelectValue(id, value) {
    const node = document.getElementById(id);
    if (!node || typeof node.value !== "string") {
      return;
    }
    node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function openModel3dLoosePartsExportOverlay() {
    document.getElementById("model3d-loose-parts-export-overlay")?.remove();
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.id = "model3d-loose-parts-export-overlay";
      overlay.className = "runtime-overlay model3d-share-overlay";
      overlay.innerHTML = "<button class='runtime-overlay-backdrop' type='button' aria-label='Cancel'></button>"
        + "<section class='runtime-overlay-panel model3d-share-overlay-panel' role='dialog' aria-modal='true' aria-labelledby='model3d-loose-parts-export-title'>"
        + "<header class='runtime-overlay-header'><div class='runtime-overlay-title-wrap'><span class='panel-kicker'>3D Quick Action</span><h3 id='model3d-loose-parts-export-title'>Separate By Loose Parts</h3><p class='model3d-share-overlay-message'>Choose how the separated objects should be saved.</p></div><button class='secondary mini-button model3d-loose-parts-export-close' type='button' aria-label='Close'>×</button></header>"
        + "<div class='model3d-share-overlay-body'><div class='field'><label for='model3d-loose-parts-export-mode'>Split Export</label><select id='model3d-loose-parts-export-mode'><option value='per_part' selected>Each part as its own file</option><option value='single_file'>One file with all parts</option></select></div></div>"
        + "<div class='model3d-share-overlay-actions'><button class='secondary model3d-loose-parts-export-cancel' type='button'>Cancel</button><button class='primary model3d-loose-parts-export-submit' type='button'>Separate Model</button></div></section>";
      document.body.appendChild(overlay);
      const close = value => {
        overlay.remove();
        resolve(value);
      };
      overlay.querySelectorAll(".runtime-overlay-backdrop, .model3d-loose-parts-export-close, .model3d-loose-parts-export-cancel").forEach(node => node.addEventListener("click", () => close("")));
      overlay.querySelector(".model3d-loose-parts-export-submit")?.addEventListener("click", () => {
        close(overlay.querySelector("#model3d-loose-parts-export-mode")?.value === "single_file" ? "single_file" : "per_part");
      });
      overlay.querySelector("#model3d-loose-parts-export-mode")?.focus();
    });
  }

  function syncModel3dGizmoProjectionButton() {
    const button = document.getElementById("model3d-gizmo-projection-button");
    const projection = String(document.getElementById("model3d-preview-projection")?.value || state.model3dPreviewProjection || "perspective").toLowerCase();
    const isOrthographic = projection === "orthographic";
    if (!button) return;
    button.dataset.projection = isOrthographic ? "orthographic" : "perspective";
    button.setAttribute("aria-pressed", isOrthographic ? "true" : "false");
    button.setAttribute("aria-label", isOrthographic ? "Switch to perspective projection" : "Switch to orthographic projection");
    button.title = isOrthographic ? "Switch to perspective projection" : "Switch to orthographic projection";
  }

  function handleModel3dViewportAction(id) {
    if (id === "model3d-viewport-perspective-button") {
      setModel3dSelectValue("model3d-preview-projection", "perspective");
      void activateModel3dViewerPreview();
      return true;
    }
    if (id === "model3d-gizmo-projection-button") {
      const current = String(document.getElementById("model3d-preview-projection")?.value || state.model3dPreviewProjection || "perspective").toLowerCase();
      setModel3dSelectValue("model3d-preview-projection", current === "orthographic" ? "perspective" : "orthographic");
      return true;
    }
    if (id === "model3d-viewport-lit-button") {
      setModel3dViewerTextureEnabled(true);
      setModel3dViewerWireframeEnabled(false);
      setModel3dThreeStatus("Preview set to lit textured mode.");
      return true;
    }
    if (id === "model3d-viewport-show-button") {
      const flyout = document.querySelector("#model3d-studio-card .model3d-viewer-flyout");
      if (flyout) {
        flyout.classList.toggle("is-open");
        flyout.scrollIntoView({ block: "nearest" });
      }
      return true;
    }
    if (id === "model3d-viewport-frame-button") {
      setModel3dSelectValue("model3d-preview-render-mode", "current");
      void activateModel3dViewerPreview();
      return true;
    }
    if (id === "model3d-viewport-focus-button") {
      void activateModel3dViewerPreview();
      return true;
    }
    if (id === "model3d-viewport-orbit-button" || id === "model3d-transform-orbit-button") {
      setModel3dSelectValue("model3d-preview-render-mode", "current");
      setModel3dThreeStatus("Orbit mode uses the current view. Drag in the Three.js preview to rotate.");
      return true;
    }
    if (id === "model3d-transform-pan-button") {
      setModel3dThreeStatus("Pan with right mouse or touch drag in the Three.js preview.");
      void activateModel3dViewerPreview();
      return true;
    }
    if (id === "model3d-transform-front-button") {
      setModel3dSelectValue("model3d-preview-render-mode", "front");
      return true;
    }
    if (id === "model3d-transform-turntable-button") {
      setModel3dSelectValue("model3d-preview-render-mode", "turntable");
      return true;
    }
    if (id === "model3d-transform-grid-button") {
      setModel3dViewerGridEnabled(!(state.model3dViewerGridEnabled === true));
      setModel3dThreeStatus("Preview grid " + (state.model3dViewerGridEnabled ? "enabled." : "disabled."));
      return true;
    }
    if (id === "model3d-viewport-export-gif-button" || id === "model3d-export-gif-button") {
      openModel3dGifExportModal();
      return true;
    }
    return false;
  }

  function bindModel3dViewportEvents() {
    const model3dPreviewRenderModeSelect = document.getElementById("model3d-preview-render-mode");
    if (model3dPreviewRenderModeSelect) {
      const applyRenderModeChange = event => {
        state.model3dPreviewRenderMode = normalizeModel3dPreviewRenderMode(event.target.value);
        applyModel3dPreviewViewSettings(getModel3dPreviewRenderOptions());
        setModel3dThreeStatus("Preview mode set to " + state.model3dPreviewRenderMode.replace("-", " ") + ".");
      };
      model3dPreviewRenderModeSelect.addEventListener("change", applyRenderModeChange);
      model3dPreviewRenderModeSelect.addEventListener("input", applyRenderModeChange);
    }
    const model3dPreviewProjectionSelect = document.getElementById("model3d-preview-projection");
    if (model3dPreviewProjectionSelect) {
      const applyProjectionChange = event => {
        state.model3dPreviewProjection = normalizeModel3dPreviewProjection(event.target.value);
        applyModel3dPreviewViewSettings(getModel3dPreviewRenderOptions());
        syncModel3dGizmoProjectionButton();
        setModel3dThreeStatus("Preview projection set to " + state.model3dPreviewProjection + ".");
      };
      model3dPreviewProjectionSelect.addEventListener("change", applyProjectionChange);
      model3dPreviewProjectionSelect.addEventListener("input", applyProjectionChange);
    }
    syncModel3dGizmoProjectionButton();
    ["model3d-open-in-blender-button", "model3d-open-in-blender-selected-button"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", async event => {
        event.preventDefault();
        await openSelectedModelInBlender();
      });
    });
    document.getElementById("model3d-share-button")?.addEventListener("click", event => {
      event.preventDefault();
      openModel3dShareOverlay();
    });
    document.getElementById("model3d-separate-by-loose-parts-button")?.addEventListener("click", async event => {
      event.preventDefault();
      const exportMode = await openModel3dLoosePartsExportOverlay();
      if (exportMode) {
        await runModel3dSeparateByLoosePartsForSelectedModel(exportMode);
      }
    });
    document.getElementById("model3d-gif-export-close-button")?.addEventListener("click", event => {
      event.preventDefault();
      closeModel3dGifExportModal();
    });
    document.getElementById("model3d-gif-export-cancel-button")?.addEventListener("click", event => {
      event.preventDefault();
      closeModel3dGifExportModal();
    });
    document.getElementById("model3d-gif-export-background-mode")?.addEventListener("change", () => {
      updateModel3dGifExportBackgroundField();
    });
    document.getElementById("model3d-gif-export-run-button")?.addEventListener("click", async event => {
      event.preventDefault();
      const button = event.currentTarget;
      if (button) {
        button.disabled = true;
      }
      try {
        await exportModel3dPreviewGif(readModel3dGifExportOptions());
        closeModel3dGifExportModal();
      } finally {
        if (button) {
          button.disabled = false;
        }
      }
    });
    document.addEventListener("click", async event => {
      const viewportTarget = event.target?.closest?.(
        "#model3d-viewport-perspective-button,"
        + "#model3d-gizmo-projection-button,"
        + "#model3d-viewport-lit-button,"
        + "#model3d-viewport-show-button,"
        + "#model3d-viewport-frame-button,"
        + "#model3d-viewport-focus-button,"
        + "#model3d-viewport-orbit-button,"
        + "#model3d-viewport-export-gif-button,"
        + "#model3d-transform-orbit-button,"
        + "#model3d-transform-pan-button,"
        + "#model3d-transform-front-button,"
        + "#model3d-transform-turntable-button,"
        + "[data-model3d-llm-real-height-action],"
        + "#model3d-transform-grid-button,"
        + "#model3d-export-gif-button"
      );
      if (viewportTarget && !event.defaultPrevented) {
        event.preventDefault();
        if (viewportTarget.getAttribute("data-model3d-llm-real-height-action") !== null) {
          await runModel3dLlmScaleForSelectedModel();
          return;
        }
        handleModel3dViewportAction(viewportTarget.id || "");
        return;
      }
      const blenderTarget = event.target?.closest?.("#model3d-open-in-blender-button,#model3d-open-in-blender-selected-button");
      if (blenderTarget && !event.defaultPrevented) {
        event.preventDefault();
        await openSelectedModelInBlender();
        return;
      }
      const stopTarget = event.target?.closest?.("#model3d-queue-cancel-button");
      if (!stopTarget) {
        return;
      }
      event.preventDefault();
      await stopModel3dGeneration();
    });
  }

  return {
    handleModel3dViewportAction,
    bindModel3dViewportEvents
  };
}
