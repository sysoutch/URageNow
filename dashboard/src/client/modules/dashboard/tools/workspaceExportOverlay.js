function createDashboardToolExportOverlay(input) {
  const state = input.state;
  const clearChildren = input.clearChildren;
  const readPreferredEngine = input.readPreferredEngine;
  const getPreferredSendTargetId = input.getPreferredSendTargetId;
  const buildExportContext = input.buildExportContext;
  const getActiveEntry = input.getActiveEntry;
  const setStatus = input.setStatus;

  function setSelectedResource(resourceId) {
    const normalizedId = String(resourceId || "").trim();
    const current = state.context;
    const options = Array.isArray(current?.resourceOptions) ? current.resourceOptions : [];
    const selectedOption = options.find(option => option.id === normalizedId) || options[0] || null;
    state.selectedResourceId = selectedOption?.id || "";
    if (!current || !selectedOption) {
      return;
    }
    state.context = {
      ...selectedOption.context,
      resourceOptions: options,
      selectedResourceId: selectedOption.id
    };
  }

  function createPreviewElement(context) {
    const entry = context && context.preview ? context.preview : null;
    if (entry && (entry.kind === "image" || entry.kind === "gif") && entry.url) {
      const image = document.createElement("img");
      image.className = "tools-workspace-export-preview-media is-image";
      image.alt = String(entry.label || context.sourceName || "Tool resource preview");
      image.loading = "eager";
      image.src = entry.url;
      return image;
    }
    if (entry && entry.kind === "video" && entry.url) {
      const video = document.createElement("video");
      video.className = "tools-workspace-export-preview-media is-video";
      video.src = entry.url;
      video.controls = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      return video;
    }
    if (entry && (entry.kind === "audio" || entry.kind === "music") && entry.url) {
      const audio = document.createElement("audio");
      audio.className = "tools-workspace-export-preview-audio";
      audio.src = entry.url;
      audio.controls = true;
      audio.preload = "metadata";
      return audio;
    }
    if (entry && entry.kind === "text" && entry.text) {
      const pre = document.createElement("pre");
      pre.className = "tools-workspace-export-preview-text";
      pre.textContent = entry.text;
      return pre;
    }
    const placeholder = document.createElement("div");
    placeholder.className = "tools-workspace-export-preview-placeholder";
    const badge = document.createElement("span");
    badge.className = "tools-workspace-export-preview-badge";
    badge.textContent = context?.resourceKind === "model3d" ? "3D Model" : "Tool Output";
    placeholder.appendChild(badge);
    const label = document.createElement("strong");
    label.textContent = String(context?.preview?.label || context?.sourceName || "No preview available");
    placeholder.appendChild(label);
    const hint = document.createElement("small");
    hint.textContent = String(context?.preview?.hint || "Preview is not available for this tool resource yet.");
    placeholder.appendChild(hint);
    return placeholder;
  }

  function setTab(tab) {
    const nextTab = tab === "game-engine" || tab === "lazydev" ? tab : "tool";
    state.activeTab = nextTab;
    document.querySelectorAll("[data-tools-export-tab]").forEach(button => {
      const active = String(button.getAttribute("data-tools-export-tab") || "") === nextTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-tools-export-panel]").forEach(panel => {
      const active = String(panel.getAttribute("data-tools-export-panel") || "") === nextTab;
      panel.classList.toggle("hidden", !active);
      panel.classList.toggle("active", active);
    });
    const submitButton = document.getElementById("tools-workspace-export-submit-button");
    if (submitButton) {
      submitButton.textContent = nextTab === "game-engine" ? "Queue Export" : nextTab === "lazydev" ? "Send To LazyDev" : "Send To Tool";
    }
    updateUi();
  }

  function updateUi() {
    const context = state.context;
    const previewStage = document.getElementById("tools-workspace-export-preview-stage");
    const sourceName = document.getElementById("tools-workspace-export-source-name");
    const sourceDetail = document.getElementById("tools-workspace-export-source-detail");
    const resourceField = document.getElementById("tools-workspace-export-resource-field");
    const resourceSelect = document.getElementById("tools-workspace-export-resource-select");
    const resourceHint = document.getElementById("tools-workspace-export-resource-hint");
    const previewLabel = document.getElementById("tools-workspace-export-preview-label");
    const previewMeta = document.getElementById("tools-workspace-export-preview-meta");
    const statusNode = document.getElementById("tools-workspace-export-status");
    const toolTargetSelect = document.getElementById("tools-workspace-export-tool-target");
    const toolHint = document.getElementById("tools-workspace-export-tool-hint");
    const engineSelect = document.getElementById("tools-workspace-export-engine-target");
    const engineTitleInput = document.getElementById("tools-workspace-export-engine-title");
    const engineHint = document.getElementById("tools-workspace-export-engine-hint");
    const lazyDevTarget = document.getElementById("tools-workspace-export-lazydev-target");
    const lazyDevHint = document.getElementById("tools-workspace-export-lazydev-hint");
    const submitButton = document.getElementById("tools-workspace-export-submit-button");
    if (previewStage) {
      clearChildren(previewStage);
      previewStage.appendChild(createPreviewElement(context || {}));
    }
    if (sourceName) sourceName.textContent = context ? context.sourceName : "No active tool resource";
    if (sourceDetail) sourceDetail.textContent = context ? context.sourceDetail : "Open a supported tool first.";
    if (resourceField) resourceField.classList.toggle("hidden", !Array.isArray(context?.resourceOptions) || context.resourceOptions.length < 2);
    if (resourceSelect) {
      clearChildren(resourceSelect);
      const options = Array.isArray(context?.resourceOptions) ? context.resourceOptions : [];
      if (options.length < 2) {
        resourceSelect.appendChild(new Option(context?.sourceName || "Single output", ""));
        resourceSelect.disabled = true;
      } else {
        options.forEach(option => resourceSelect.appendChild(new Option(option.label, option.id)));
        resourceSelect.disabled = false;
        resourceSelect.value = String(context?.selectedResourceId || options[0]?.id || "").trim();
      }
    }
    if (resourceHint) {
      const count = Array.isArray(context?.resourceOptions) ? context.resourceOptions.length : 0;
      resourceHint.textContent = count > 1 ? "Choose which processed result to send." : "This tool currently exposes one sendable result.";
    }
    if (previewLabel) previewLabel.textContent = context?.preview?.label || "No preview available";
    if (previewMeta) previewMeta.textContent = context?.resourceKind ? String(context.resourceKind).toUpperCase() : "";
    if (toolTargetSelect) {
      clearChildren(toolTargetSelect);
      const candidates = Array.isArray(context?.toolCandidates) ? context.toolCandidates : [];
      if (candidates.length === 0) {
        toolTargetSelect.appendChild(new Option("No compatible target tools", ""));
        toolTargetSelect.disabled = true;
      } else {
        candidates.forEach(candidate => toolTargetSelect.appendChild(new Option(candidate.title + " (" + candidate.categoryLabel + ")", candidate.id)));
        toolTargetSelect.disabled = false;
        toolTargetSelect.value = getPreferredSendTargetId(context.entry, candidates);
      }
    }
    if (toolHint) {
      toolHint.textContent = context?.sendToToolSupported
        ? "Export the current processed result and open it in another compatible tool."
        : (context?.sendToToolReason || "This tool cannot send a result to another tool yet.");
    }
    if (engineSelect) engineSelect.value = readPreferredEngine();
    if (engineTitleInput) {
      engineTitleInput.value = context ? context.sourceName : "";
      engineTitleInput.disabled = !context?.sendToEngineSupported;
    }
    if (engineHint) {
      engineHint.textContent = context?.sendToEngineSupported
        ? "Queue the current tool resource for the dashboard game-engine importer."
        : (context?.sendToEngineReason || "No exportable tool output was found yet. Create or select an output first.");
    }
    const lazyDevSupported = context?.resourceKind === "image" && Boolean(context?.exportedImage?.dataUrl || context?.assetDescriptor?.dataUrl || context?.assetDescriptor?.sourceUrl || context?.preview?.url);
    if (lazyDevTarget) lazyDevTarget.disabled = !lazyDevSupported;
    if (lazyDevHint) {
      const lazyDevResourceCount = Array.isArray(context?.resourceOptions) ? context.resourceOptions.filter(option => option.context?.resourceKind === "image").length : 1;
      lazyDevHint.textContent = lazyDevSupported
        ? (lazyDevResourceCount > 1 ? "Import all " + lazyDevResourceCount + " exported images into LazyDev. In 3D Studio, assign their Front, Back, Left, and Right roles." : "Import the processed image into LazyDev, select it, and open the target studio ready to use it.")
        : "LazyDev handoff currently accepts exported images. Create or select an image output first.";
    }
    const activeTab = state.activeTab;
    const canSubmit = !!context && (activeTab === "game-engine" ? context.sendToEngineSupported : activeTab === "lazydev" ? lazyDevSupported : context.sendToToolSupported) && state.loading !== true;
    if (submitButton) submitButton.disabled = !canSubmit;
    if (statusNode) {
      statusNode.textContent = state.loading === true
        ? "Preparing current tool resource..."
        : activeTab === "game-engine"
          ? (context?.sendToEngineSupported ? "Queue the active tool resource for a game engine importer." : (context?.sendToEngineReason || "No exportable engine resource is available."))
          : activeTab === "lazydev"
            ? (lazyDevSupported ? "Send the active processed image back into LazyDev Studio." : "No exported image is available for LazyDev yet.")
            : (context?.sendToToolSupported ? "Send the active tool result into another compatible tool." : (context?.sendToToolReason || "No tool-to-tool send target is available."));
    }
  }

  function open() {
    const overlay = document.getElementById("tools-workspace-export-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("runtime-overlay-open");
    updateUi();
  }

  function close() {
    const overlay = document.getElementById("tools-workspace-export-overlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("runtime-overlay-open");
    state.loading = false;
    updateUi();
  }

  async function openForEntry(entry) {
    const contextEntry = entry || getActiveEntry();
    if (!contextEntry) {
      setStatus("Open a tool first.");
      return;
    }
    state.loading = true;
    state.context = {
      sourceName: contextEntry.title || "Loading tool resource...",
      sourceDetail: "Preparing current tool resource...",
      preview: {kind: "placeholder", label: "Loading resource preview", hint: "Preparing current tool resource..."}
    };
    open();
    try {
      const context = await buildExportContext(contextEntry);
      state.context = context;
      state.selectedResourceId = String(context?.selectedResourceId || "").trim();
      if (state.activeTab === "tool" && !context?.sendToToolSupported && context?.sendToEngineSupported) {
        setTab("game-engine");
      } else {
        updateUi();
      }
      setStatus("Prepared " + (context?.sourceName || contextEntry.title || "tool resource") + " for export.");
    } catch (error) {
      state.context = {
        sourceName: contextEntry.title || "Tool Resource",
        sourceDetail: error && error.message ? error.message : "Failed to prepare current tool resource.",
        preview: {kind: "placeholder", label: contextEntry.title || "Tool Resource", hint: error && error.message ? error.message : "Failed to prepare current tool resource."},
        sendToToolSupported: false,
        sendToEngineSupported: false
      };
      updateUi();
      setStatus(error && error.message ? error.message : "Failed to prepare current tool resource.");
    } finally {
      state.loading = false;
      updateUi();
    }
  }

  return {close, open, openForEntry, setSelectedResource, setTab, updateUi};
}
