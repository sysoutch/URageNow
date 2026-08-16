function createDashboardThreeDQuickActionModalHelpers(input) {
  const state = input?.state || {};
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const setModel3dStatus = typeof input?.setModel3dStatus === "function" ? input.setModel3dStatus : function setModel3dStatusFallback() {};
  const loadImageHistory = typeof input?.loadImageHistory === "function" ? input.loadImageHistory : async function loadImageHistoryFallback() {};
  const refreshState = typeof input?.refreshState === "function" ? input.refreshState : async function refreshStateFallback() {};
  const openAiSection = typeof input?.openAiSection === "function" ? input.openAiSection : function openAiSectionFallback() {};
  const getSelectedGeneratedModel = typeof input?.getSelectedGeneratedModel === "function" ? input.getSelectedGeneratedModel : function getSelectedGeneratedModelFallback() {
    return null;
  };
  const resolveModel3dPreviewMedia = typeof input?.resolveModel3dPreviewMedia === "function" ? input.resolveModel3dPreviewMedia : function resolveModel3dPreviewMediaFallback() {
    return null;
  };
  const getModel3dFileUrl = typeof input?.getModel3dFileUrl === "function" ? input.getModel3dFileUrl : function getModel3dFileUrlFallback() {
    return "";
  };
  const buildAbsoluteDashboardUrl = typeof input?.buildAbsoluteDashboardUrl === "function" ? input.buildAbsoluteDashboardUrl : value => String(value || "").trim();
  const renderModel3dPreviewGifDataUrl = typeof input?.renderModel3dPreviewGifDataUrl === "function"
    ? input.renderModel3dPreviewGifDataUrl
    : async function renderModel3dPreviewGifDataUrlFallback() {
      throw new Error("Three.js GIF export helper is unavailable.");
    };
  let activeAlbedoFaceCountRequest = 0;
  const readOptionalNumberInput = (inputId, options) => {
    const raw = String(document.getElementById(inputId)?.value || "").trim();
    if (!raw) {
      return undefined;
    }
    const parsed = options?.integer === false ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    const min = Number.isFinite(options?.min) ? options.min : parsed;
    const max = Number.isFinite(options?.max) ? options.max : parsed;
    return Math.max(min, Math.min(max, parsed));
  };
  const setSelectOptions = (selectNode, options) => {
    if (!selectNode) {
      return;
    }
    const current = String(selectNode.value || "").trim();
    selectNode.innerHTML = options.map(option => "<option value=\"" + option.value + "\">" + option.label + "</option>").join("");
    selectNode.value = options.some(option => option.value === current) ? current : options[0]?.value || "";
  };
  const setFieldVisibility = (fieldId, visible) => {
    document.getElementById(fieldId)?.classList.toggle("hidden", visible !== true);
  };
  const setInputValue = (inputId, value) => {
    const node = document.getElementById(inputId);
    if (!node) {
      return;
    }
    node.value = value;
  };
  const setCheckboxValue = (inputId, value) => {
    const node = document.getElementById(inputId);
    if (!node || typeof node.checked !== "boolean") {
      return;
    }
    node.checked = value === true;
  };
  function syncBlenderBackgroundColorUi() {
    const picker = document.getElementById("model3d-quick-action-bg-color");
    const output = document.getElementById("model3d-quick-action-bg-color-value");
    const color = /^#[\da-f]{6}$/i.test(String(picker?.value || "")) ? picker.value.toUpperCase() : "#320000";
    if (picker && picker.value !== color) {
      picker.value = color;
    }
    if (output) {
      output.textContent = color;
    }
    document.querySelectorAll("[data-model3d-background-color]").forEach(button => {
      const isActive = String(button.dataset.model3dBackgroundColor || "").toUpperCase() === color;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }
  function setBlenderBackgroundColor(value) {
    const picker = document.getElementById("model3d-quick-action-bg-color");
    if (!picker || !/^#[\da-f]{6}$/i.test(String(value || ""))) {
      return;
    }
    picker.value = String(value).toLowerCase();
    syncBlenderBackgroundColorUi();
  }

  function getActionConfig(actionKey) {
    if (actionKey === "albedo-to-geometry") {
      return {
        title: "Albedo To Geometry",
        kicker: "3D Surface Detail",
        runLabel: "Create Geometry",
        modes: ["blender"],
        modeHints: {
          blender: "Displaces UV-mapped mesh vertices from albedo brightness. Higher subdivision levels can increase processing time and polygon count sharply."
        }
      };
    }
    if (actionKey === "rotate") {
      return {
        title: "Rotate",
        kicker: "3D Rotate",
        runLabel: "Create Rotate",
        modes: ["blender", "studio"],
        modeHints: {
          blender: "Blender mode renders a local turntable capture with the selected camera and background settings.",
          studio: "Studio mode creates a GIF from the current Three.js preview setup or from the generated multi-view preview."
        }
      };
    }
    return {
      title: "Delight",
      kicker: "3D Delight",
      runLabel: "Create Delight",
      modes: ["blender", "comfyui", "tool"],
      modeHints: {
        blender: "Blender mode captures a flat delight render using the selected camera and background settings.",
        comfyui: "ComfyUI mode runs the delight image workflow on the selected preview image.",
        tool: "Tool mode opens Toon Image Shader with the selected preview image loaded."
      }
    };
  }

  function getBlenderFieldDefaults() {
    return {
      width: "1080",
      height: "1080",
      quality: "90",
      engine: "BLENDER_WORKBENCH",
      projection: "ORTHO",
      shading: "TEXTURE",
      shadows: "off",
      zoom: "1.35",
      rotateTarget: "object",
      axis: "Z",
      degrees: "360",
      frames: "32",
      background: "transparent",
      bgColor: "#320000"
    };
  }

  function applyBlenderFieldDefaults() {
    const defaults = getBlenderFieldDefaults();
    setInputValue("model3d-quick-action-width", defaults.width);
    setInputValue("model3d-quick-action-height", defaults.height);
    setInputValue("model3d-quick-action-quality", defaults.quality);
    setInputValue("model3d-quick-action-engine", defaults.engine);
    setInputValue("model3d-quick-action-projection", defaults.projection);
    setInputValue("model3d-quick-action-shading", defaults.shading);
    setInputValue("model3d-quick-action-shadows", defaults.shadows);
    setInputValue("model3d-quick-action-zoom", defaults.zoom);
    setInputValue("model3d-quick-action-rotate-target", defaults.rotateTarget);
    setInputValue("model3d-quick-action-axis", defaults.axis);
    setInputValue("model3d-quick-action-degrees", defaults.degrees);
    setInputValue("model3d-quick-action-frames", defaults.frames);
    setInputValue("model3d-quick-action-background", defaults.background);
    setInputValue("model3d-quick-action-bg-color", defaults.bgColor);
  }

  function applyStudioFieldDefaults() {
    setInputValue("model3d-quick-action-studio-size", "512");
    setInputValue("model3d-quick-action-studio-frames", "48");
    setInputValue("model3d-quick-action-studio-delay", "60");
    setInputValue("model3d-quick-action-studio-background", "solid");
    setInputValue("model3d-quick-action-studio-solid-color", "#0b0d1f");
    setCheckboxValue("model3d-quick-action-studio-grid", false);
    setCheckboxValue("model3d-quick-action-studio-axes", false);
    setCheckboxValue("model3d-quick-action-studio-rig", false);
    setCheckboxValue("model3d-quick-action-studio-use-multiview", false);
  }

  function applyAlbedoFieldDefaults() {
    setInputValue("model3d-quick-action-albedo-strength", "0.05");
    setInputValue("model3d-quick-action-albedo-topology-mode", "subdivision");
    setInputValue("model3d-quick-action-albedo-subdivisions", "0");
    setInputValue("model3d-quick-action-albedo-blur", "1");
    setInputValue("model3d-quick-action-albedo-merge-distance", "0.000001");
    setCheckboxValue("model3d-quick-action-albedo-auto-smooth", true);
    setCheckboxValue("model3d-quick-action-albedo-selected-faces-only", false);
    setCheckboxValue("model3d-quick-action-albedo-merge-before-subdivide", true);
    setCheckboxValue("model3d-quick-action-albedo-merge-after-subdivide", true);
  }

  function formatFaceCount(value) {
    return Number.isFinite(value) ? new Intl.NumberFormat().format(Math.max(0, Math.round(value))) : "...";
  }

  function getAlbedoFaceRisk(faceCount) {
    if (!Number.isFinite(faceCount)) {
      return { key: "loading", label: "Inspecting" };
    }
    if (faceCount <= 50000) {
      return { key: "green", label: "Green" };
    }
    if (faceCount <= 300000) {
      return { key: "yellow", label: "Yellow" };
    }
    if (faceCount <= 1200000) {
      return { key: "orange", label: "Orange" };
    }
    return { key: "red", label: "Red" };
  }

  function renderAlbedoFaceCountEstimate(currentFaceCount) {
    const budget = document.getElementById("model3d-quick-action-albedo-face-budget");
    const currentNode = document.getElementById("model3d-quick-action-albedo-current-faces");
    const targetNode = document.getElementById("model3d-quick-action-albedo-target-faces");
    const riskNode = document.getElementById("model3d-quick-action-albedo-face-risk");
    const hintNode = document.getElementById("model3d-quick-action-albedo-face-hint");
    const barNode = document.getElementById("model3d-quick-action-albedo-face-bar");
    const trackNode = budget?.querySelector(".model3d-face-budget-track");
    const levels = readOptionalNumberInput("model3d-quick-action-albedo-subdivisions", { min: 0, max: 8 }) || 0;
    const multiplier = Math.pow(4, levels);
    const estimatedFaceCount = Number.isFinite(currentFaceCount) ? currentFaceCount * multiplier : null;
    const isLoading = currentFaceCount === undefined;
    const risk = getAlbedoFaceRisk(estimatedFaceCount);
    if (budget) budget.dataset.risk = risk.key;
    if (currentNode) currentNode.textContent = formatFaceCount(currentFaceCount);
    if (targetNode) targetNode.textContent = formatFaceCount(estimatedFaceCount);
    if (riskNode) riskNode.textContent = risk.label;
    if (hintNode) {
      hintNode.textContent = isLoading
        ? "Reading the selected model variant."
        : Number.isFinite(estimatedFaceCount)
        ? `Approx. ${formatFaceCount(currentFaceCount)} x ${formatFaceCount(multiplier)}. The final Blender count can differ after welding and modifier conversion.`
        : "Could not read the selected variant's face count.";
    }
    const barPercent = Number.isFinite(estimatedFaceCount) ? Math.min(100, Math.max(2, estimatedFaceCount / 2400000 * 100)) : 0;
    if (barNode) barNode.style.width = barPercent + "%";
    if (trackNode) trackNode.setAttribute("aria-valuenow", String(Number.isFinite(estimatedFaceCount) ? Math.round(estimatedFaceCount) : 0));
  }

  function getCachedSelectedVariantFaceCount(modelId, variant) {
    const inspection = state.model3dInspectionByKey?.[[modelId, variant, "local"].join("|")]?.inspection;
    const inspectedFaceCount = Number(inspection?.stats?.geometry?.faceCount);
    if (Number.isFinite(inspectedFaceCount)) {
      return inspectedFaceCount;
    }
    const viewerFaceCount = Number(state.model3dViewerDerivedInspectionByKey?.[[modelId, variant].join("|")]?.stats?.geometry?.faceCount);
    return Number.isFinite(viewerFaceCount) ? viewerFaceCount : null;
  }

  async function updateAlbedoFaceCountEstimate(options) {
    if (state.model3dQuickActionKey !== "albedo-to-geometry") {
      return;
    }
    const selected = getSelectedGeneratedModel();
    const variant = getSelectedModelVariant();
    if (!selected?.id) {
      renderAlbedoFaceCountEstimate(null);
      return;
    }
    const cachedFaceCount = getCachedSelectedVariantFaceCount(selected.id, variant);
    if (Number.isFinite(cachedFaceCount) && options?.force !== true) {
      renderAlbedoFaceCountEstimate(cachedFaceCount);
      return;
    }
    if (Number.isFinite(cachedFaceCount)) {
      renderAlbedoFaceCountEstimate(cachedFaceCount);
    } else {
      renderAlbedoFaceCountEstimate(undefined);
    }
    const requestId = ++activeAlbedoFaceCountRequest;
    try {
      const inspection = await request("/api/model3d-inspect", { modelId: selected.id, variant, executionTarget: "local" });
      if (requestId !== activeAlbedoFaceCountRequest) {
        return;
      }
      const cache = state.model3dInspectionByKey && typeof state.model3dInspectionByKey === "object"
        ? state.model3dInspectionByKey
        : (state.model3dInspectionByKey = {});
      const cacheKey = [selected.id, variant, "local"].join("|");
      cache[cacheKey] = { ...(cache[cacheKey] || {}), inspection };
      const faceCount = Number(inspection?.stats?.geometry?.faceCount);
      renderAlbedoFaceCountEstimate(Number.isFinite(faceCount) ? faceCount : null);
    } catch {
      if (requestId === activeAlbedoFaceCountRequest) {
        renderAlbedoFaceCountEstimate(cachedFaceCount);
      }
    }
  }

  function syncStudioSolidColorVisibility(mode) {
    setFieldVisibility("model3d-quick-action-studio-solid-color-field", mode === "studio"
      && String(document.getElementById("model3d-quick-action-studio-background")?.value || "solid").trim() === "solid");
  }

  function syncQuickActionFieldVisibility(actionKey, mode) {
    const isAlbedoToGeometry = actionKey === "albedo-to-geometry";
    const isBlender = mode === "blender";
    const isStudio = mode === "studio";
    const isRotate = actionKey === "rotate";
    const background = String(document.getElementById("model3d-quick-action-background")?.value || "transparent").trim();
    setFieldVisibility("model3d-quick-action-mode-field", !isAlbedoToGeometry);
    setFieldVisibility("model3d-quick-action-tool-note", mode === "tool");
    setFieldVisibility("model3d-quick-action-blender-settings", isBlender && !isAlbedoToGeometry);
    setFieldVisibility("model3d-quick-action-studio-settings", isStudio && isRotate);
    setFieldVisibility("model3d-quick-action-albedo-settings", isAlbedoToGeometry);
    setFieldVisibility("model3d-quick-action-quality-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-engine-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-shading-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-shadows-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-rotate-target-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-axis-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-degrees-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-frames-field", isBlender && isRotate);
    setFieldVisibility("model3d-quick-action-bg-color-field", isBlender && background === "solidcolor");
    syncBlenderBackgroundColorUi();
    syncStudioSolidColorVisibility(mode);
  }

  function readModel3dAlbedoToGeometryOptions() {
    return {
      strength: readOptionalNumberInput("model3d-quick-action-albedo-strength", { min: 0, max: 10, integer: false }),
      topologyMode: document.getElementById("model3d-quick-action-albedo-topology-mode")?.value === "multiresolution" ? "multiresolution" : "subdivision",
      subdivisions: readOptionalNumberInput("model3d-quick-action-albedo-subdivisions", { min: 0, max: 8 }),
      blur: readOptionalNumberInput("model3d-quick-action-albedo-blur", { min: 0, max: 10 }),
      autoSmooth: document.getElementById("model3d-quick-action-albedo-auto-smooth")?.checked !== false,
      selectedFacesOnly: document.getElementById("model3d-quick-action-albedo-selected-faces-only")?.checked === true,
      mergeBeforeSubdivide: document.getElementById("model3d-quick-action-albedo-merge-before-subdivide")?.checked !== false,
      mergeAfterSubdivide: document.getElementById("model3d-quick-action-albedo-merge-after-subdivide")?.checked !== false,
      mergeDistance: readOptionalNumberInput("model3d-quick-action-albedo-merge-distance", { min: 0, max: 0.1, integer: false })
    };
  }

  function readModel3dBlenderQuickActionOptions(actionKey) {
    const options = {
      width: readOptionalNumberInput("model3d-quick-action-width", { min: 64, max: 4096 }),
      height: readOptionalNumberInput("model3d-quick-action-height", { min: 64, max: 4096 }),
      projection: String(document.getElementById("model3d-quick-action-projection")?.value || "ORTHO").trim() || "ORTHO",
      zoom: readOptionalNumberInput("model3d-quick-action-zoom", { min: 0.01, max: 10, integer: false }),
      background: String(document.getElementById("model3d-quick-action-background")?.value || "transparent").trim() || "transparent",
      bgColor: String(document.getElementById("model3d-quick-action-bg-color")?.value || "#320000").trim() || "#320000"
    };
    if (actionKey !== "rotate") {
      return options;
    }
    return {
      ...options,
      quality: readOptionalNumberInput("model3d-quick-action-quality", { min: 1, max: 100 }),
      engine: String(document.getElementById("model3d-quick-action-engine")?.value || "BLENDER_WORKBENCH").trim() || "BLENDER_WORKBENCH",
      shading: String(document.getElementById("model3d-quick-action-shading")?.value || "TEXTURE").trim() || "TEXTURE",
      shadows: String(document.getElementById("model3d-quick-action-shadows")?.value || "off").trim() || "off",
      rotateTarget: String(document.getElementById("model3d-quick-action-rotate-target")?.value || "object").trim() || "object",
      axis: String(document.getElementById("model3d-quick-action-axis")?.value || "Z").trim() || "Z",
      degrees: readOptionalNumberInput("model3d-quick-action-degrees", { min: 1, max: 3600, integer: false }),
      frames: readOptionalNumberInput("model3d-quick-action-frames", { min: 2, max: 240 })
    };
  }

  function readModel3dStudioRotateOptions() {
    return {
      size: readOptionalNumberInput("model3d-quick-action-studio-size", { min: 128, max: 1024 }),
      frameCount: readOptionalNumberInput("model3d-quick-action-studio-frames", { min: 2, max: 120 }),
      frameDelay: readOptionalNumberInput("model3d-quick-action-studio-delay", { min: 20, max: 1000 }),
      backgroundMode: String(document.getElementById("model3d-quick-action-studio-background")?.value || "solid").trim() || "solid",
      backgroundColor: String(document.getElementById("model3d-quick-action-studio-solid-color")?.value || "#0b0d1f").trim() || "#0b0d1f",
      includeGrid: document.getElementById("model3d-quick-action-studio-grid")?.checked === true,
      includeAxes: document.getElementById("model3d-quick-action-studio-axes")?.checked === true,
      includeRig: document.getElementById("model3d-quick-action-studio-rig")?.checked === true,
      useMultiViewTextures: document.getElementById("model3d-quick-action-studio-use-multiview")?.checked === true
    };
  }

  function getSelectedModelVariant() {
    if (state.model3dThreeVariant === "original") {
      return "original";
    }
    if (state.model3dThreeVariant === "lowpoly") {
      return "lowpoly";
    }
    if (state.model3dThreeVariant === "albedo") {
      return "albedo";
    }
    return "merged";
  }

  function getSelectedModelPreviewSource() {
    const selected = getSelectedGeneratedModel();
    if (!selected || !selected.id) {
      return null;
    }
    const preview = resolveModel3dPreviewMedia(selected);
    const previewFileName = String(preview?.fileName || "").trim();
    if (!previewFileName) {
      return null;
    }
    const imageUrl = buildAbsoluteDashboardUrl(getModel3dFileUrl(selected.id, previewFileName));
    if (!imageUrl) {
      return null;
    }
    return {
      model: selected,
      imageUrl,
      fileName: previewFileName,
      prompt: String(selected.prompt || "").trim()
    };
  }

  function buildImportedStudioGifFileName(selected, suffix) {
    const sourceFileName = String(selected?.modelFileName || selected?.originalModelFileName || selected?.lowPolyModelFileName || "model").trim();
    const normalized = sourceFileName.replace(/\.[^.]+$/, "").trim() || "model";
    return normalized + suffix + ".gif";
  }

  function syncQuickActionModeUi() {
    const requestedActionKey = String(state.model3dQuickActionKey || "delight").trim();
    const actionKey = requestedActionKey === "rotate" || requestedActionKey === "albedo-to-geometry" ? requestedActionKey : "delight";
    const config = getActionConfig(actionKey);
    const modeSelect = document.getElementById("model3d-quick-action-mode");
    const runButton = document.getElementById("model3d-quick-action-run-button");
    const titleNode = document.getElementById("model3d-quick-action-modal-title");
    const kickerNode = document.getElementById("model3d-quick-action-kicker");
    const sourceName = document.getElementById("model3d-quick-action-source-name");
    const sourceDetail = document.getElementById("model3d-quick-action-source-detail");
    const hintNode = document.getElementById("model3d-quick-action-mode-hint");
    const selected = getSelectedGeneratedModel();
    if (titleNode) {
      titleNode.textContent = config.title;
    }
    if (kickerNode) {
      kickerNode.textContent = config.kicker;
    }
    if (sourceName) {
      sourceName.textContent = selected?.modelFileName || selected?.originalModelFileName || selected?.lowPolyModelFileName || "Selected model";
    }
    if (sourceDetail) {
      sourceDetail.textContent = selected?.id ? "Model ID: " + selected.id : "Select a model to continue.";
    }
    if (modeSelect) {
      setSelectOptions(modeSelect, config.modes.map(mode => ({
        value: mode,
        label: mode === "blender" ? "Blender" : mode === "studio" ? "Studio" : mode === "comfyui" ? "ComfyUI" : "Tool"
      })));
      state.model3dQuickActionMode = modeSelect.value;
    }
    const selectedMode = String(modeSelect?.value || config.modes[0]).trim();
    syncQuickActionFieldVisibility(actionKey, selectedMode);
    if (hintNode) {
      hintNode.textContent = config.modeHints[selectedMode] || "Choose how this quick action should run.";
    }
    if (runButton) {
      runButton.textContent = config.runLabel;
    }
  }

  function setQuickActionRunState(running) {
    const actionKey = String(state.model3dQuickActionKey || "delight").trim();
    const config = getActionConfig(actionKey === "rotate" || actionKey === "albedo-to-geometry" ? actionKey : "delight");
    const runButton = document.getElementById("model3d-quick-action-run-button");
    const statusNode = document.getElementById("model3d-quick-action-run-status");
    const modal = document.getElementById("model3d-quick-action-modal");
    if (runButton) {
      runButton.disabled = running === true;
      runButton.textContent = running ? "Working..." : config.runLabel;
    }
    if (statusNode) {
      statusNode.textContent = running ? (config.title + " is running. This can take a moment.") : "";
      statusNode.classList.toggle("hidden", running !== true);
    }
    modal?.classList.toggle("is-running", running === true);
  }

  function openModel3dQuickActionModal(actionKey) {
    const selected = getSelectedGeneratedModel();
    if (!selected || !selected.id) {
      setOutput("Select a generated 3D model first.");
      return;
    }
    state.model3dQuickActionKey = actionKey === "rotate" || actionKey === "albedo-to-geometry" ? actionKey : "delight";
    const modal = document.getElementById("model3d-quick-action-modal");
    if (!modal) {
      return;
    }
    applyBlenderFieldDefaults();
    applyStudioFieldDefaults();
    applyAlbedoFieldDefaults();
    syncQuickActionModeUi();
    modal.classList.remove("hidden");
    document.body.classList.add("runtime-overlay-open");
    if (state.model3dQuickActionKey === "albedo-to-geometry") {
      void updateAlbedoFaceCountEstimate({ force: true });
    }
    window.setTimeout(() => document.getElementById("model3d-quick-action-run-button")?.focus(), 0);
  }

  function closeModel3dQuickActionModal() {
    document.getElementById("model3d-quick-action-modal")?.classList.add("hidden");
    document.body.classList.remove("runtime-overlay-open");
  }

  async function runBlenderQuickAction(actionKey) {
    const selected = getSelectedGeneratedModel();
    if (!selected || !selected.id) {
      throw new Error("Select a generated 3D model first.");
    }
    setModel3dStatus(actionKey === "rotate" ? "Rendering Blender rotate capture..." : "Rendering Blender delight capture...");
    const imported = await request("/api/model3d-capture", {
      modelId: selected.id,
      variant: getSelectedModelVariant(),
      action: actionKey,
      executionTarget: "local",
      captureOptions: readModel3dBlenderQuickActionOptions(actionKey)
    });
    if (!imported?.id) {
      throw new Error("Blender quick action finished without an imported image.");
    }
    await loadImageHistory(imported.id);
    await refreshState();
    openAiSection("image-studio-card", { focusOnly: true });
    setModel3dStatus(actionKey === "rotate" ? "Blender rotate capture finished." : "Blender delight capture finished.");
    setOutput((actionKey === "rotate" ? "Rotate" : "Delight") + " capture imported into Generated Images.");
  }

  async function runAlbedoToGeometryQuickAction() {
    const selected = getSelectedGeneratedModel();
    if (!selected || !selected.id) {
      throw new Error("Select a generated 3D model first.");
    }
    setModel3dStatus("Generating geometry from the selected model albedo...");
    const generated = await request("/api/model3d-albedo-to-geometry", {
      modelId: selected.id,
      sourceVariant: getSelectedModelVariant(),
      ...readModel3dAlbedoToGeometryOptions()
    });
    if (!generated?.id) {
      throw new Error("Albedo-to-geometry finished without an updated model.");
    }
    state.model3dThreeVariant = "albedo";
    await refreshState();
    setModel3dStatus("Albedo-to-geometry finished.");
    setOutput("Generated surface geometry from the albedo texture for " + (generated.modelFileName || selected.modelFileName || "the selected model") + ".");
  }

  async function importModel3dGifToImageStudio(selected, dataUrl, fileName, modelLabel) {
    const imported = await request("/api/image-import", {
      dataUrl,
      fileName,
      prompt: "3D model rotate preview",
      model: modelLabel
    });
    if (!imported?.id) {
      throw new Error("Studio rotate finished without an imported GIF.");
    }
    await loadImageHistory(imported.id);
    await refreshState();
    openAiSection("image-studio-card", { focusOnly: true });
    setModel3dStatus("Studio rotate finished.");
    setOutput("Imported a rotate GIF for " + (selected.modelFileName || selected.originalModelFileName || "selected model") + ".");
  }

  async function runStudioRotateQuickAction() {
    const selected = getSelectedGeneratedModel();
    if (!selected || !selected.id) {
      throw new Error("Select a generated 3D model first.");
    }
    const options = readModel3dStudioRotateOptions();
    const useMultiViewTextures = options.useMultiViewTextures === true;
    if (useMultiViewTextures) {
      const previewGifFileName = typeof selected.previewGifFileName === "string" ? selected.previewGifFileName.trim() : "";
      const hasMultiViewTextures = Array.isArray(selected.multiViewFileNames) && selected.multiViewFileNames.length > 0;
      if (!hasMultiViewTextures || !previewGifFileName) {
        throw new Error("This model does not have a generated multi-view preview GIF yet.");
      }
      if (typeof fetchImageAsDataUrl !== "function") {
        throw new Error("Image import bridge is unavailable for multi-view rotate.");
      }
      setModel3dStatus("Importing multi-view rotate preview...");
      const previewUrl = buildAbsoluteDashboardUrl(getModel3dFileUrl(selected.id, previewGifFileName));
      const previewDataUrl = await fetchImageAsDataUrl(previewUrl);
      await importModel3dGifToImageStudio(
        selected,
        previewDataUrl,
        buildImportedStudioGifFileName(selected, "-rotate-multiview"),
        "3D Multi View Rotate"
      );
      return;
    }
    setModel3dStatus("Rendering Three.js rotate preview...");
      const gifDataUrl = await renderModel3dPreviewGifDataUrl({
        ...options,
        renderMode: "turntable"
      });
    if (!gifDataUrl) {
      throw new Error("Three.js preview GIF rendering returned no data.");
    }
    await importModel3dGifToImageStudio(
      selected,
      gifDataUrl,
      buildImportedStudioGifFileName(selected, "-rotate-studio"),
      "Three.js Rotate Preview"
    );
  }

  async function runComfyUiDelightQuickAction(source) {
    const workflowPath = String(globalThis.dashboardComfyWorkflowPaths?.image?.delight || "").trim();
    const payload = await request("/api/image-generate", {
      prompt: "Delight this image for texture use: remove baked shadows, strong directional lighting, highlights, and color casts while preserving the original surface color and details. Make it evenly lit and neutral.",
      autoPrompt: false,
      autoFileName: false,
      imageInput: source.imageUrl,
      imageFileNameHint: source.fileName,
      workflowPathOverride: workflowPath || undefined,
      skipPromptResolution: true
    });
    if (!payload?.id) {
      throw new Error("ComfyUI delight finished without a generated image.");
    }
    await loadImageHistory(payload.id);
    await refreshState();
    openAiSection("image-studio-card", { focusOnly: true });
    setModel3dStatus("ComfyUI delight finished.");
    setOutput("Created a delighted image from the selected 3D preview.");
  }

  async function runToolDelightQuickAction(source) {
    if (typeof sendImageUrlToToolBySourceToken !== "function") {
      throw new Error("Tool bridge is unavailable for Toon Image Shader.");
    }
    await sendImageUrlToToolBySourceToken("/tools/art/toon-image-shader/", {
      imageFileName: source.fileName,
      fileName: source.fileName,
      imageUrl: source.imageUrl,
      prompt: source.prompt
    }, {
      switchView: true
    });
    setModel3dStatus("Opened Toon Image Shader with the selected 3D preview.");
  }

  async function runModel3dQuickAction() {
    const requestedActionKey = String(state.model3dQuickActionKey || "delight").trim();
    const actionKey = requestedActionKey === "rotate" || requestedActionKey === "albedo-to-geometry" ? requestedActionKey : "delight";
    const mode = String(document.getElementById("model3d-quick-action-mode")?.value || "blender").trim();
    const source = getSelectedModelPreviewSource();
    if (actionKey === "albedo-to-geometry") {
      await runAlbedoToGeometryQuickAction();
      return;
    }
    if (actionKey === "rotate") {
      if (mode === "studio") {
        await runStudioRotateQuickAction();
        return;
      }
      await runBlenderQuickAction(actionKey);
      return;
    }
    if ((mode === "comfyui" || mode === "tool") && !source) {
      throw new Error("This action needs a preview image for the selected model.");
    }
    if (mode === "blender") {
      await runBlenderQuickAction(actionKey);
      return;
    }
    if (mode === "tool") {
      await runToolDelightQuickAction(source);
      return;
    }
    await runComfyUiDelightQuickAction(source);
  }

  return {
    openModel3dQuickActionModal,
    closeModel3dQuickActionModal,
    setQuickActionRunState,
    setBlenderBackgroundColor,
    syncBlenderBackgroundColorUi,
    syncQuickActionModeUi,
    updateAlbedoFaceCountEstimate,
    runModel3dQuickAction
  };
}
