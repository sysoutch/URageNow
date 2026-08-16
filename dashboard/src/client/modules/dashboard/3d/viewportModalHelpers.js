function createDashboardThreeDViewportModalHelpers(input) {
  const state = input?.state || {};
  const request = typeof input?.request === "function"
    ? input.request
    : async function requestFallback() {
      return {};
    };
  const setOutput = typeof input?.setOutput === "function"
    ? input.setOutput
    : function setOutputFallback() {};
  const setModel3dStatus = typeof input?.setModel3dStatus === "function"
    ? input.setModel3dStatus
    : function setModel3dStatusFallback() {};
  const escapeHtml = typeof input?.escapeHtml === "function" ? input.escapeHtml : value => String(value || "");
  const getSelectedGeneratedModel = typeof input?.getSelectedGeneratedModel === "function"
    ? input.getSelectedGeneratedModel
    : function getSelectedGeneratedModelFallback() {
      return null;
    };
  const getSelectedGeneratedModels = typeof input?.getSelectedGeneratedModels === "function"
    ? input.getSelectedGeneratedModels
    : function getSelectedGeneratedModelsFallback() {
      const selected = getSelectedGeneratedModel();
      return selected ? [selected] : [];
    };
  const getModel3dViewerTarget = typeof input?.getModel3dViewerTarget === "function"
    ? input.getModel3dViewerTarget
    : function getModel3dViewerTargetFallback() {
      return {};
    };
  const getModel3dFileUrl = typeof input?.getModel3dFileUrl === "function"
    ? input.getModel3dFileUrl
    : function getModel3dFileUrlFallback(modelId, fileName) {
      return "/api/model3d-file?modelId=" + encodeURIComponent(modelId || "") + "&file=" + encodeURIComponent(fileName || "");
    };
  const getModel3dPreviewRenderOptions = typeof input?.getModel3dPreviewRenderOptions === "function"
    ? input.getModel3dPreviewRenderOptions
    : function getModel3dPreviewRenderOptionsFallback() {
      return { renderMode: "current", projection: "current" };
    };

  function updateModel3dGifExportBackgroundField() {
    const mode = document.getElementById("model3d-gif-export-background-mode")?.value || "solid";
    document.getElementById("model3d-gif-export-solid-color-field")?.classList.toggle("hidden", mode !== "solid");
  }

  function openModel3dGifExportModal() {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      setOutput("Select a generated model first.");
      return;
    }
    const modal = document.getElementById("model3d-gif-export-modal");
    if (!modal) {
      return;
    }
    const viewerTarget = getModel3dViewerTarget(selected);
    const renderOptions = getModel3dPreviewRenderOptions();
    const sourceName = document.getElementById("model3d-gif-export-source-name");
    const sourceDetail = document.getElementById("model3d-gif-export-source-detail");
    if (sourceName) {
      sourceName.textContent = viewerTarget.fileName || selected.modelFileName || "Selected model";
    }
    if (sourceDetail) {
      sourceDetail.textContent = "View: " + renderOptions.renderMode.replace("-", " ") + " | Projection: " + renderOptions.projection;
    }
    const frameInput = document.getElementById("model3d-gif-export-frames");
    if (frameInput && typeof frameInput.value === "string") {
      frameInput.value = renderOptions.renderMode === "turntable" ? "48" : "2";
    }
    const delayInput = document.getElementById("model3d-gif-export-delay");
    if (delayInput && typeof delayInput.value === "string") {
      delayInput.value = "60";
    }
    const sizeSelect = document.getElementById("model3d-gif-export-size");
    if (sizeSelect && typeof sizeSelect.value === "string") {
      sizeSelect.value = "512";
    }
    const backgroundModeSelect = document.getElementById("model3d-gif-export-background-mode");
    if (backgroundModeSelect && typeof backgroundModeSelect.value === "string") {
      backgroundModeSelect.value = state.model3dViewerSkyboxEnabled === true ? "skybox" : "solid";
    }
    const includeGrid = document.getElementById("model3d-gif-export-include-grid");
    const includeAxes = document.getElementById("model3d-gif-export-include-axes");
    const includeRig = document.getElementById("model3d-gif-export-include-rig");
    if (includeGrid && typeof includeGrid.checked === "boolean") {
      includeGrid.checked = false;
    }
    if (includeAxes && typeof includeAxes.checked === "boolean") {
      includeAxes.checked = false;
    }
    if (includeRig && typeof includeRig.checked === "boolean") {
      includeRig.checked = false;
    }
    updateModel3dGifExportBackgroundField();
    modal.classList.remove("hidden");
    window.setTimeout(() => document.getElementById("model3d-gif-export-run-button")?.focus(), 0);
  }

  function closeModel3dGifExportModal() {
    document.getElementById("model3d-gif-export-modal")?.classList.add("hidden");
  }

  function readModel3dGifExportOptions() {
    return {
      size: Number.parseInt(document.getElementById("model3d-gif-export-size")?.value || "512", 10) || 512,
      frameCount: Number.parseInt(document.getElementById("model3d-gif-export-frames")?.value || "48", 10) || 48,
      frameDelay: Number.parseInt(document.getElementById("model3d-gif-export-delay")?.value || "60", 10) || 60,
      backgroundMode: document.getElementById("model3d-gif-export-background-mode")?.value || "solid",
      backgroundColor: document.getElementById("model3d-gif-export-solid-color")?.value || "#0b0d1f",
      includeGrid: document.getElementById("model3d-gif-export-include-grid")?.checked === true,
      includeAxes: document.getElementById("model3d-gif-export-include-axes")?.checked === true,
      includeRig: document.getElementById("model3d-gif-export-include-rig")?.checked === true
    };
  }

  function getModel3dShareDefaultName(record, viewerTarget) {
    const fileName = String(viewerTarget?.fileName || record?.modelFileName || "shared-model").trim();
    return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Shared 3D Model";
  }

  function ensureModel3dShareToolFrame() {
    return new Promise(resolve => {
      let frame = document.getElementById("model3d-share-tool-frame");
      if (!frame) {
        frame = document.createElement("iframe");
        frame.id = "model3d-share-tool-frame";
        frame.className = "hidden";
        frame.title = "3D Models Sharer background bridge";
        frame.setAttribute("aria-hidden", "true");
        document.body.appendChild(frame);
      }
      if (frame.getAttribute("src") === "/tools/dev/3d-model-sharer/index.html" && frame.contentWindow) {
        resolve(frame);
        return;
      }
      frame.addEventListener("load", () => resolve(frame), { once: true });
      frame.setAttribute("src", "/tools/dev/3d-model-sharer/index.html");
    });
  }

  async function runModel3dShareTool(payload) {
    const frame = await ensureModel3dShareToolFrame();
    const requestId = "model3d-share-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    return await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("3D Models Sharer timed out."));
      }, 120_000);
      const onMessage = event => {
        if (event.origin !== window.location.origin || event.source !== frame.contentWindow) {
          return;
        }
        const message = event.data || {};
        if (message.type === "dashboard:model3d-share-status") {
          setModel3dStatus(String(message.status || "Sharing model..."));
          return;
        }
        if (message.type !== "dashboard:model3d-share-result" || message.requestId !== requestId) {
          return;
        }
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        if (message.ok) {
          resolve(message);
          return;
        }
        reject(new Error(message.status || "3D model share failed."));
      };
      window.addEventListener("message", onMessage);
      window.setTimeout(() => {
        frame.contentWindow?.postMessage({
          type: "dashboard:model3d-share",
          requestId,
          ...payload
        }, window.location.origin);
      }, 180);
    });
  }

  function closeModel3dShareOverlay(overlay) {
    overlay?.remove();
    document.body.classList.remove("runtime-overlay-open");
  }

  function openModel3dShareOverlay() {
    const selected = getSelectedGeneratedModel();
    if (!selected?.id) {
      setOutput("Select a generated model first.");
      return;
    }
    const viewerTarget = getModel3dViewerTarget(selected);
    const fileName = String(viewerTarget?.fileName || selected.modelFileName || "").trim();
    if (!fileName) {
      setOutput("Selected model has no shareable model file.");
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "runtime-overlay model3d-share-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      "<button class='runtime-overlay-backdrop model3d-share-overlay-backdrop' type='button' aria-label='Cancel'></button>"
      + "<section class='runtime-overlay-panel model3d-share-overlay-panel'>"
      + "<header class='runtime-overlay-header'><div class='runtime-overlay-title-wrap'><span class='panel-kicker'>3D Model Share</span><h3>Share Model</h3><p class='model3d-share-overlay-message'>Send the selected model to a publishing target through the 3D Models Sharer tool.</p></div><button class='secondary mini-button model3d-share-close' type='button'>✕</button></header>"
      + "<div class='model3d-share-overlay-body'>"
      + "<div class='field'><label for='model3d-share-name'>Name</label><input id='model3d-share-name' type='text'></div>"
      + "<div class='field'><label for='model3d-share-description'>Description</label><textarea id='model3d-share-description' rows='4'></textarea></div>"
      + "<div class='field'><label for='model3d-share-target'>Target</label><select id='model3d-share-target'><option value='sketchfab'>Sketchfab</option></select></div>"
      + "<div class='hint model3d-share-selected-file'>File: " + escapeHtml(fileName) + "</div>"
      + "</div>"
      + "<div class='model3d-share-overlay-actions'><button class='secondary model3d-share-cancel' type='button'>Cancel</button><button class='primary model3d-share-submit' type='button'>Share Model</button></div>"
      + "</section>";
    document.body.appendChild(overlay);
    document.body.classList.add("runtime-overlay-open");
    const nameInput = overlay.querySelector("#model3d-share-name");
    const descriptionInput = overlay.querySelector("#model3d-share-description");
    const targetInput = overlay.querySelector("#model3d-share-target");
    if (nameInput) nameInput.value = getModel3dShareDefaultName(selected, viewerTarget);
    if (descriptionInput) descriptionInput.value = String(selected.description || selected.prompt || "").trim();
    overlay.querySelectorAll(".model3d-share-overlay-backdrop,.model3d-share-close,.model3d-share-cancel").forEach(node => {
      node.addEventListener("click", () => closeModel3dShareOverlay(overlay));
    });
    overlay.querySelector(".model3d-share-submit")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      if (button) button.disabled = true;
      try {
        const result = await runModel3dShareTool({
          target: targetInput?.value || "sketchfab",
          modelUrl: new URL(getModel3dFileUrl(selected.id, fileName), window.location.origin).toString(),
          fileName,
          name: String(nameInput?.value || "").trim(),
          description: String(descriptionInput?.value || "").trim()
        });
        closeModel3dShareOverlay(overlay);
        setModel3dStatus(result.status || "Model share submitted.");
        setOutput(result.modelUrl ? ("Shared model to Sketchfab: " + result.modelUrl) : (result.status || "Model share submitted."));
      } catch (error) {
        setModel3dStatus("Model share failed.");
        setOutput("Model share failed: " + (error?.message || "Unknown error"));
      } finally {
        if (button) button.disabled = false;
      }
    });
    window.setTimeout(() => nameInput?.focus(), 0);
  }

  async function openSelectedModelInBlender() {
    const selectedModels = getSelectedGeneratedModels().filter(model => model?.id);
    const targets = selectedModels.length > 0 ? selectedModels : [getSelectedGeneratedModel()].filter(model => model?.id);
    if (targets.length === 0) {
      setOutput("Select a generated model first.");
      return;
    }
    const executionTarget = document.getElementById("model3d-generation-target")?.value === "remote" ? "remote" : "local";
    const resolveTargetPayload = selected => {
      const viewerTarget = getModel3dViewerTarget(selected);
      const variant = viewerTarget.variantLabel === "low poly"
        ? "lowpoly"
        : (viewerTarget.variantLabel === "merged" ? "current" : "original");
      return {
        selected,
        viewerTarget,
        variant,
        requestItem: {
          modelId: selected.id,
          variant,
          fileName: viewerTarget.fileName || undefined
        }
      };
    };
    if (targets.length > 1) {
      const blenderMode = await openDashboardChoiceOverlay({
        kicker: "Blender Import",
        title: "Open " + targets.length + " models in Blender",
        message: "Choose whether the selected models should share one Blender scene or open separately.",
        detail: "One scene places the models into a simple grid. Separate windows keeps the current one-file-per-model behavior.",
        oneLabel: "One Blender Scene",
        separateLabel: "Separate Windows"
      });
      if (!blenderMode) {
        return;
      }
      if (blenderMode === "one") {
        const result = await request("/api/blender-open-models", {
          items: targets.map(selected => resolveTargetPayload(selected).requestItem),
          executionTarget
        });
        const count = Array.isArray(result?.fileNames) ? result.fileNames.length : targets.length;
        setModel3dStatus("Opened " + count + " models in one Blender scene.");
        setOutput("Opened " + count + " models in one Blender scene.");
        return;
      }
    }
    const openedNames = [];
    for (const selected of targets) {
      const target = resolveTargetPayload(selected);
      const result = await request("/api/blender-open-model", {
        modelId: selected.id,
        variant: target.variant,
        fileName: target.viewerTarget.fileName || undefined,
        executionTarget
      });
      openedNames.push(result?.fileName || target.viewerTarget.fileName || selected.modelFileName || "selected model");
    }
    const label = openedNames.length === 1 ? openedNames[0] : openedNames.length + " models";
    setModel3dStatus("Opened " + label + " in Blender.");
    setOutput("Opened " + label + " in Blender.");
  }

  return {
    updateModel3dGifExportBackgroundField,
    openModel3dGifExportModal,
    closeModel3dGifExportModal,
    readModel3dGifExportOptions,
    openSelectedModelInBlender,
    openModel3dShareOverlay
  };
}
