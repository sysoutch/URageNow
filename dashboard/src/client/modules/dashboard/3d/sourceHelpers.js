function createDashboardThreeDSourceHelpers(input) {
  const state = input && input.state ? input.state : {};
  let model3dGenerationBusy = false;
  const splitLines = input && typeof input.splitLines === "function" ? input.splitLines : function splitLinesFallback(value) {
    return String(value || "").split(/\r?\n/).map(entry => entry.trim()).filter(Boolean);
  };
  const clearChildren = input && typeof input.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback() {};
  const escapeHtml = input && typeof input.escapeHtml === "function" ? input.escapeHtml : value => String(value || "");
  const buildAbsoluteDashboardUrl = input && typeof input.buildAbsoluteDashboardUrl === "function" ? input.buildAbsoluteDashboardUrl : value => String(value || "").trim();
  const getGeneratedImageFileUrl = input && typeof input.getGeneratedImageFileUrl === "function" ? input.getGeneratedImageFileUrl : function getGeneratedImageFileUrlFallback() {
    return "";
  };
  const getImagePoolById = input && typeof input.getImagePoolById === "function" ? input.getImagePoolById : function getImagePoolByIdFallback() {
    return null;
  };
  const getModel3dFileUrl = input && typeof input.getModel3dFileUrl === "function" ? input.getModel3dFileUrl : function getModel3dFileUrlFallback() {
    return "";
  };
  const request = input && typeof input.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const multiViewSlots = ["front", "back", "left", "right"];

  function inferModelImageFileNameHint(source) {
    const value = String(source || "").trim();
    if (!value) {
      return "";
    }
    if (/^https?:\/\//i.test(value)) {
      try {
        const parsed = new URL(value);
        const fromUrl = parsed.pathname.split("/").pop()?.trim();
        return fromUrl || "";
      } catch {
        return "";
      }
    }
    const parts = value.replace(/\//g, "\\").split("\\").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "";
  }

  function normalizeModel3dLocalImageSourcePath(source) {
    const trimmed = String(source || "").trim();
    if (!trimmed) {
      return "";
    }
    if (/^file:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        const pathname = decodeURIComponent(parsed.pathname || "");
        const windowsPath = /^\/[a-z]:/i.test(pathname) ? pathname.slice(1) : pathname;
        return windowsPath.replace(/\//g, "\\");
      } catch {
        return trimmed.replace(/^file:\/+/i, "").replace(/\//g, "\\");
      }
    }
    return trimmed.replace(/\//g, "\\");
  }

  function extractUploadedModelImageFileNameFromSource(source) {
    const normalized = normalizeModel3dLocalImageSourcePath(source);
    if (!normalized) {
      return "";
    }
    const marker = "\\uploaded-model-images\\";
    const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
    if (markerIndex === -1) {
      return "";
    }
    const suffix = normalized.slice(markerIndex + marker.length);
    const parts = suffix.split("\\").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "";
  }

  function extractGeneratedImagePathFromSource(source) {
    const normalized = normalizeModel3dLocalImageSourcePath(source);
    if (!normalized) {
      return null;
    }
    const marker = "\\generated-images\\";
    const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
    if (markerIndex === -1) {
      return null;
    }
    const suffix = normalized.slice(markerIndex + marker.length);
    const parts = suffix.split("\\").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return {
      imageId: parts[0],
      fileName: parts[parts.length - 1]
    };
  }

  function resolveModel3dSourcePreviewUrl(source) {
    const normalized = String(source || "").trim();
    if (!normalized) {
      return "";
    }
    if (/^data:image\//i.test(normalized) || /^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    if (/^\/api\//i.test(normalized)) {
      return buildAbsoluteDashboardUrl(normalized);
    }
    const generatedImagePath = extractGeneratedImagePathFromSource(normalized);
    if (generatedImagePath) {
      return buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(generatedImagePath.imageId, generatedImagePath.fileName));
    }
    const uploadedFileName = extractUploadedModelImageFileNameFromSource(normalized);
    if (uploadedFileName) {
      return buildAbsoluteDashboardUrl("/api/uploaded-model-image-file?file=" + encodeURIComponent(uploadedFileName));
    }
    return "";
  }

  function getModel3dUploadSources() {
    return splitLines(document.getElementById("model3d-image-source")?.value || "");
  }

  function syncModel3dMultiViewAssignments(sources) {
    const current = state.model3dMultiViewAssignments && typeof state.model3dMultiViewAssignments === "object"
      ? state.model3dMultiViewAssignments
      : {};
    const next = {};
    const claimed = new Set();
    sources.forEach(source => {
      const slot = String(current[source] || "").trim().toLowerCase();
      if (multiViewSlots.includes(slot) && !claimed.has(slot)) {
        next[source] = slot;
        claimed.add(slot);
      } else if (Object.prototype.hasOwnProperty.call(current, source) && !slot) {
        next[source] = "";
      }
    });
    sources.forEach((source, index) => {
      if (Object.prototype.hasOwnProperty.call(next, source)) {
        return;
      }
      const preferredSlot = multiViewSlots[index];
      const availableSlot = !claimed.has(preferredSlot) ? preferredSlot : multiViewSlots.find(slot => !claimed.has(slot));
      if (availableSlot) {
        next[source] = availableSlot;
        claimed.add(availableSlot);
      }
    });
    state.model3dMultiViewAssignments = next;
    return next;
  }

  function setModel3dMultiViewAssignment(source, value) {
    const slot = String(value || "").trim().toLowerCase();
    const sources = getModel3dUploadSources();
    const assignments = syncModel3dMultiViewAssignments(sources);
    if (multiViewSlots.includes(slot)) {
      Object.keys(assignments).forEach(key => {
        if (key !== source && assignments[key] === slot) {
          assignments[key] = "";
        }
      });
      assignments[source] = slot;
    } else {
      assignments[source] = "";
    }
    state.model3dMultiViewAssignments = assignments;
    syncModel3dMultiViewAssignments(sources);
    renderModel3dUploadSourceList();
    updateModel3dGenerateActionState();
  }

  function getModel3dSelectedPool() {
    const selectedPoolId = document.getElementById("model3d-image-pool-select")?.value || "";
    return selectedPoolId ? getImagePoolById(selectedPoolId) : null;
  }

  function syncModel3dSelectedPoolSources() {
    const selectedPool = getModel3dSelectedPool();
    const available = new Set(Array.isArray(selectedPool?.images) ? selectedPool.images.map(entry => String(entry || "").trim()).filter(Boolean) : []);
    state.model3dSelectedPoolSources = state.model3dSelectedPoolSources.filter(entry => available.has(entry));
  }

  function renderModel3dSourceList(containerId, sources, options) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }
    clearChildren(container);
    const normalizedSources = Array.isArray(sources) ? sources.map(entry => String(entry || "").trim()).filter(Boolean) : [];
    if (normalizedSources.length === 0) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    const multiViewAssignments = containerId === "model3d-source-upload-list" && state.model3dGenerateWorkflow === "multiview"
      ? syncModel3dMultiViewAssignments(normalizedSources)
      : null;
    normalizedSources.forEach((source, index) => {
      const item = document.createElement("article");
      item.className = "model3d-source-item";
      const previewUrl = resolveModel3dSourcePreviewUrl(source);
      const name = inferModelImageFileNameHint(source) || ("Source " + (index + 1));
      item.innerHTML =
        "<div class='model3d-source-item-thumb-wrap'>"
        + (previewUrl
          ? ("<img class='model3d-source-item-thumb' src='" + escapeHtml(previewUrl) + "' alt='" + escapeHtml(name) + "'>")
          : "<div class='model3d-source-item-thumb model3d-source-item-thumb-fallback'>No preview</div>")
        + "</div>"
        + "<div class='model3d-source-item-body'>"
        + "<div class='model3d-source-item-name'>" + escapeHtml(name) + "</div>"
        + "<div class='model3d-source-item-meta'>" + escapeHtml(source) + "</div>"
        + "</div>";
      const actions = document.createElement("div");
      actions.className = "model3d-source-item-actions";
      if (multiViewAssignments) {
        const slotField = document.createElement("label");
        slotField.className = "model3d-multiview-slot-field";
        slotField.textContent = "View";
        const slotSelect = document.createElement("select");
        slotSelect.setAttribute("aria-label", "Assign " + name + " to a MultiView direction");
        slotSelect.appendChild(new Option("Not used", ""));
        multiViewSlots.forEach(slot => slotSelect.appendChild(new Option(slot[0].toUpperCase() + slot.slice(1), slot)));
        slotSelect.value = multiViewAssignments[source] || "";
        slotSelect.addEventListener("change", () => setModel3dMultiViewAssignment(source, slotSelect.value));
        slotField.appendChild(slotSelect);
        actions.appendChild(slotField);
      }
      if (options?.selectable === true) {
        const selected = state.model3dSelectedPoolSources.includes(source);
        item.classList.toggle("active", selected);
        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "secondary mini-button";
        toggleButton.textContent = selected ? "Selected" : "Select";
        toggleButton.addEventListener("click", () => {
          if (state.model3dSelectedPoolSources.includes(source)) {
            state.model3dSelectedPoolSources = state.model3dSelectedPoolSources.filter(entry => entry !== source);
          } else {
            state.model3dSelectedPoolSources = [...state.model3dSelectedPoolSources, source];
          }
          renderModel3dPoolSelectionList();
        });
        actions.appendChild(toggleButton);
      }
      if (options?.removable === true) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "secondary mini-button";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
          const nextSources = getModel3dUploadSources().filter(entry => entry !== source);
          const field = document.getElementById("model3d-image-source");
          if (field && typeof field.value === "string") {
            field.value = nextSources.join("\n");
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        actions.appendChild(removeButton);
      }
      if (actions.childElementCount > 0) {
        item.appendChild(actions);
      }
      container.appendChild(item);
    });
  }

  function renderModel3dUploadSourceList() {
    renderModel3dSourceList("model3d-source-upload-list", getModel3dUploadSources(), { removable: true });
  }

  function updateModel3dPoolActionState() {
    const selectedPool = getModel3dSelectedPool();
    const poolImages = Array.isArray(selectedPool?.images) ? selectedPool.images.map(entry => String(entry || "").trim()).filter(Boolean) : [];
    const hasPoolImages = poolImages.length > 0;
    const hasPoolSelection = Array.isArray(state.model3dSelectedPoolSources) && state.model3dSelectedPoolSources.length > 0;
    const selectAllButton = document.getElementById("model3d-pool-select-all-button");
    const clearSelectionButton = document.getElementById("model3d-pool-clear-selection-button");
    setElementVisible(selectAllButton, hasPoolImages);
    setElementVisible(clearSelectionButton, hasPoolSelection);
  }

  function setElementVisible(element, visible) {
    if (!element) {
      return;
    }
    element.hidden = visible !== true;
    element.classList.toggle("hidden", visible !== true);
  }

  function setModel3dGenerationBusy(value) {
    model3dGenerationBusy = value === true;
    updateModel3dGenerateActionState();
  }

  function updateModel3dGenerateActionState() {
    const uploadSources = getModel3dUploadSources();
    const allSources = collectModel3dSourceCandidates();
    const clearButton = document.getElementById("model3d-image-clear-button");
    const generateButton = document.getElementById("generate-model3d-button");
    const stopButton = document.getElementById("stop-model3d-generation-button");
    const hasUploadSource = uploadSources.length > 0;
    const multiViewAssignments = state.model3dGenerateWorkflow === "multiview" ? syncModel3dMultiViewAssignments(allSources) : {};
    const hasRequiredSources = state.model3dGenerateWorkflow === "multiview"
      ? Object.values(multiViewAssignments).includes("front") && Object.values(multiViewAssignments).includes("back")
      : allSources.length >= 1;
    updateModel3dPoolActionState();
    setElementVisible(stopButton, model3dGenerationBusy);
    setElementVisible(clearButton, !model3dGenerationBusy && hasUploadSource);
    if (generateButton) {
      generateButton.disabled = model3dGenerationBusy || !hasRequiredSources;
    }
  }

  function renderModel3dPoolSelectionList() {
    syncModel3dSelectedPoolSources();
    const selectedPool = getModel3dSelectedPool();
    renderModel3dSourceList("model3d-image-pool-list", Array.isArray(selectedPool?.images) ? selectedPool.images : [], { selectable: true });
    updateModel3dPoolActionState();
    updateModel3dGenerateActionState();
  }

  function updateModel3dSourceHint() {
    const sourceInput = document.getElementById("model3d-image-source");
    const sourceHint = document.getElementById("model3d-image-source-hint");
    const browseButton = document.getElementById("model3d-image-browse-button");
    const previewNode = document.getElementById("model3d-image-upload-preview");
    const sourceField = document.querySelector(".model3d-source-field");
    if (!sourceHint || !sourceInput || !browseButton || !previewNode) {
      return;
    }
    const sourceValue = typeof sourceInput.value === "string" ? sourceInput.value.trim() : "";
    if (!sourceValue) {
      sourceHint.textContent = "No source image selected yet.";
      browseButton.classList.remove("has-source");
      browseButton.classList.remove("has-preview");
      if (sourceField) {
        sourceField.classList.remove("has-source-preview");
      }
      previewNode.classList.add("hidden");
      previewNode.removeAttribute("src");
      renderModel3dUploadSourceList();
      updateModel3dGenerateActionState();
      return;
    }
    const sources = splitLines(sourceValue);
    const sourceName = sources.length > 1
      ? (sources.length + " source images selected")
      : (inferModelImageFileNameHint(sourceValue) || sourceValue);
    sourceHint.textContent = "Selected source: " + sourceName;
    browseButton.classList.add("has-source");
    const previewUrl = resolveModel3dSourcePreviewUrl(sources[0] || sourceValue);
    if (previewUrl) {
      previewNode.src = previewUrl;
      previewNode.classList.remove("hidden");
      browseButton.classList.add("has-preview");
      if (sourceField) {
        sourceField.classList.add("has-source-preview");
      }
    } else {
      previewNode.classList.add("hidden");
      previewNode.removeAttribute("src");
      browseButton.classList.remove("has-preview");
      if (sourceField) {
        sourceField.classList.remove("has-source-preview");
      }
    }
    renderModel3dUploadSourceList();
    updateModel3dGenerateActionState();
  }

  function collectModel3dSourceCandidates() {
    const sources = [];
    const unique = new Set();
    for (const entry of splitLines(document.getElementById("model3d-image-source")?.value || "")) {
      const normalized = String(entry || "").trim();
      if (!normalized || unique.has(normalized)) {
        continue;
      }
      unique.add(normalized);
      sources.push(normalized);
    }
    for (const entry of state.model3dSelectedPoolSources) {
      const normalized = String(entry || "").trim();
      if (!normalized || unique.has(normalized)) {
        continue;
      }
      unique.add(normalized);
      sources.push(normalized);
    }
    return sources;
  }

  function readModel3dLowPolyOptionsFromUi() {
    const lowPolyUseLlmTargetFaces = document.getElementById("model3d-lowpoly-use-llm-target-faces")?.checked === true;
    const lowPolyLlmDecisionSource = document.getElementById("model3d-lowpoly-llm-decision-source")?.value === "model-render"
      ? "model-render"
      : "input-image";
    const lowPolyTargetFaceCountRaw = document.getElementById("model3d-lowpoly-target-face-count")?.value || "1500";
    const parsedLowPolyTargetFaceCount = Number.parseInt(lowPolyTargetFaceCountRaw, 10);
    const lowPolyTargetFaceCount = Number.isFinite(parsedLowPolyTargetFaceCount) && parsedLowPolyTargetFaceCount > 0
      ? Math.max(1, Math.round(parsedLowPolyTargetFaceCount))
      : 1500;
    return {
      lowPolyUseLlmTargetFaces,
      lowPolyLlmDecisionSource,
      lowPolyTargetFaceCount
    };
  }

  function summarizeMetallicDecision(decision) {
    if (!decision || typeof decision !== "object") {
      return "";
    }
    const classification = typeof decision.classification === "string" ? decision.classification.trim().toLowerCase() : "";
    const action = typeof decision.action === "string" ? decision.action.trim().toLowerCase() : "";
    const reason = typeof decision.reason === "string" ? decision.reason.trim() : "";
    if (!classification) {
      return "";
    }
    const actionLabel = action === "enabled"
      ? "metallic enabled"
      : (action === "disabled" ? "metallic disabled" : "metallic unchanged");
    const classificationLabel = classification === "non-metallic" ? "non-metallic" : (classification === "metallic" ? "metallic" : "mixed");
    return "LLM metallic decision: " + classificationLabel + " (" + actionLabel + ")" + (reason ? " - " + reason : "");
  }

  function summarizeRealWorldHeightDecision(decision) {
    if (!decision || typeof decision !== "object") {
      return "";
    }
    const action = typeof decision.action === "string" ? decision.action.trim().toLowerCase() : "";
    const reason = typeof decision.reason === "string" ? decision.reason.trim() : "";
    const objectLabel = typeof decision.objectLabel === "string" ? decision.objectLabel.trim() : "";
    const heightMeters = typeof decision.heightMeters === "number" && Number.isFinite(decision.heightMeters)
      ? decision.heightMeters
      : null;
    if (heightMeters === null) {
      return "";
    }
    const label = objectLabel ? objectLabel + ", " : "";
    const actionLabel = action === "scaled" ? "model scaled" : "scale skipped";
    return "LLM real-world size: " + label + "height " + heightMeters.toFixed(2) + "m (" + actionLabel + ")" + (reason ? " - " + reason : "");
  }

  async function postGeneratedModelToExternalMessengerFromStudio(messenger, generated, destinationId) {
    const normalizedMessenger = messenger === "telegram" || messenger === "whatsapp" ? messenger : "";
    if (!normalizedMessenger) {
      return;
    }
    const modelUrl = buildAbsoluteDashboardUrl(generated.modelUrl || getModel3dFileUrl(generated.id, generated.modelFileName));
    const previewImageUrl = generated.previewImageUrl ? buildAbsoluteDashboardUrl(generated.previewImageUrl) : "";
    const previewGifUrl = generated.previewGifUrl ? buildAbsoluteDashboardUrl(generated.previewGifUrl) : "";
    const previewLine = previewGifUrl
      ? "Preview GIF: " + previewGifUrl
      : (previewImageUrl ? "Preview image: " + previewImageUrl : "");
    const message = [
      "Generated 3D model ready:",
      modelUrl,
      previewLine
    ].filter(Boolean).join("\n");
    if (normalizedMessenger === "telegram") {
      await request("/api/telegram/send-message", {
        chatId: destinationId,
        text: message
      });
      state.selectedTelegramChatId = String(destinationId || "").trim();
      return;
    }
    await request("/api/whatsapp/send-message", {
      to: destinationId,
      text: message
    });
  }

  return {
    inferModelImageFileNameHint,
    normalizeModel3dLocalImageSourcePath,
    extractUploadedModelImageFileNameFromSource,
    extractGeneratedImagePathFromSource,
    resolveModel3dSourcePreviewUrl,
    getModel3dUploadSources,
    getModel3dSelectedPool,
    syncModel3dSelectedPoolSources,
    renderModel3dSourceList,
    renderModel3dUploadSourceList,
    renderModel3dPoolSelectionList,
    updateModel3dSourceHint,
    updateModel3dGenerateActionState,
    updateModel3dPoolActionState,
    setModel3dGenerationBusy,
    collectModel3dSourceCandidates,
    readModel3dLowPolyOptionsFromUi,
    summarizeMetallicDecision,
    summarizeRealWorldHeightDecision,
    postGeneratedModelToExternalMessengerFromStudio
  };
}
