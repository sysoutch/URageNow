(function registerScheduledModelPostOptionsModule(global) {
  const LOW_POLY_FACE_PRESETS = [500, 1000, 1500, 3000, 5000];

  function getNode(id) {
    return document.getElementById(id);
  }

  function getValue(id, fallback = "") {
    const node = getNode(id);
    if (!node || typeof node.value !== "string") {
      return fallback;
    }
    return node.value;
  }

  function getChecked(id) {
    const node = getNode(id);
    if (!node || typeof node.checked !== "boolean") {
      return false;
    }
    return node.checked;
  }

  function setValue(id, value) {
    const node = getNode(id);
    if (!node || typeof node.value !== "string") {
      return;
    }
    node.value = value;
  }

  function setChecked(id, checked) {
    const node = getNode(id);
    if (!node || typeof node.checked !== "boolean") {
      return;
    }
    node.checked = checked;
  }

  function setHidden(id, hidden) {
    const node = getNode(id);
    if (!node) {
      return;
    }
    node.classList.toggle("hidden", hidden);
  }

  function setClosestFieldHidden(id, hidden) {
    const node = getNode(id);
    if (!node) {
      return;
    }
    const field = node.closest(".field");
    if (!field) {
      return;
    }
    field.classList.toggle("hidden", hidden);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function normalizeTextureUploadTarget(value) {
    return value === "selected" ? "selected" : "target";
  }

  function normalizeThreadNameMode(value) {
    return value === "increment" || value === "model-name" ? value : "fixed";
  }

  function normalizeFaceCount(value, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }
    return Math.max(1, Math.round(parsed));
  }

  function resolveLowPolyPresetId(faceCount) {
    const normalized = normalizeFaceCount(faceCount, 1500);
    return LOW_POLY_FACE_PRESETS.includes(normalized) ? String(normalized) : "custom";
  }

  function syncLowPolyPresetFromFaceCount() {
    const presetSelect = getNode("scheduled-model-lowpoly-target-face-preset");
    const faceInput = getNode("scheduled-model-lowpoly-target-face-count");
    if (!presetSelect || !faceInput || typeof presetSelect.value !== "string" || typeof faceInput.value !== "string") {
      return;
    }
    const presetId = resolveLowPolyPresetId(faceInput.value);
    presetSelect.value = presetId;
    if (typeof faceInput.disabled === "boolean") {
      faceInput.disabled = presetId !== "custom";
    }
  }

  function applyLowPolyPresetToFaceCount() {
    const presetSelect = getNode("scheduled-model-lowpoly-target-face-preset");
    const faceInput = getNode("scheduled-model-lowpoly-target-face-count");
    if (!presetSelect || !faceInput || typeof presetSelect.value !== "string" || typeof faceInput.value !== "string") {
      return;
    }
    if (presetSelect.value !== "custom") {
      faceInput.value = String(normalizeFaceCount(presetSelect.value, 1500));
    }
    if (typeof faceInput.disabled === "boolean") {
      faceInput.disabled = presetSelect.value !== "custom";
    }
  }

  function apply(options, samples) {
    const value = options || {};
    setValue("scheduled-model-post-target-mode", value.targetMode || "channel");
    setChecked("scheduled-model-send-initial", value.sendInitialToSelectedChannel === true);
    setChecked("scheduled-model-send-source-image-selected", value.sendSourceImageToSelectedChannel === true);
    setValue("scheduled-model-thread-name-mode", normalizeThreadNameMode(value.threadNameMode));
    setValue("scheduled-model-thread-name", value.threadName || "");
    setValue("scheduled-model-thread-base", value.threadNameBase || "Day");
    setValue("scheduled-model-model-name-source", value.modelNameSource === "filename" ? "filename" : "llm");
    setValue("scheduled-model-forum-channel-id", value.forumChannelId || "");
    setValue("scheduled-model-forum-channel-name", value.forumChannelName || "textures");
    setValue("scheduled-model-lowpoly-forum-channel-id", value.lowPolyForumChannelId || "");
    setValue("scheduled-model-initial-extra", value.initialExtraText || samples.initialExtraText);
    setValue("scheduled-model-model-upload-target", value.modelUploadTarget === "target" ? "target" : "selected");
    setValue("scheduled-model-destination-extra", value.destinationExtraText || samples.destinationExtraText);
    setChecked("scheduled-model-include-model", value.includeModelFile !== false);
    setChecked("scheduled-model-include-preview", value.includePreviewMedia !== false);
    setChecked("scheduled-model-include-source-image", value.includeSourceImage !== false);
    setChecked("scheduled-model-include-embed", value.includeEmbed !== false);
    setChecked("scheduled-model-include-buttons", value.includeButtons !== false);
    setChecked("scheduled-model-embed-in-initial", value.includeEmbedInInitial !== false);
    setChecked("scheduled-model-upload-textures", value.uploadTextureMessages === true);
    setValue("scheduled-model-texture-upload-target", normalizeTextureUploadTarget(value.textureUploadTarget));
    setChecked("scheduled-model-upload-multiview", value.uploadMultiViewTextures !== false);
    setChecked("scheduled-model-upload-uv", value.uploadUvMapTextures !== false);
    setChecked("scheduled-model-upload-normal", value.uploadNormalMapTextures !== false);
    setChecked("scheduled-model-generate-lowpoly", value.generateLowPolyVersion === true);
    setChecked("scheduled-model-lowpoly-use-llm-target-faces", value.lowPolyUseLlmTargetFaces === true);
    setValue("scheduled-model-lowpoly-llm-decision-source", value.lowPolyLlmDecisionSource === "model-render" ? "model-render" : "input-image");
    setValue("scheduled-model-lowpoly-target-face-count", Number.isFinite(value.lowPolyTargetFaceCount) ? String(Math.max(1, Math.round(value.lowPolyTargetFaceCount))) : "1500");
    syncLowPolyPresetFromFaceCount();
  }

  function read() {
    const threadNameMode = normalizeThreadNameMode(getValue("scheduled-model-thread-name-mode", "fixed"));
    const lowPolyTargetFaceCount = Number.parseInt(getValue("scheduled-model-lowpoly-target-face-count", "1500"), 10);
    return {
      targetMode: getValue("scheduled-model-post-target-mode", "channel") || "channel",
      sendInitialToSelectedChannel: getChecked("scheduled-model-send-initial"),
      sendSourceImageToSelectedChannel: getChecked("scheduled-model-send-source-image-selected"),
      threadNameMode,
      threadName: getValue("scheduled-model-thread-name").trim(),
      threadNameBase: getValue("scheduled-model-thread-base").trim(),
      modelNameSource: getValue("scheduled-model-model-name-source", "llm") === "filename" ? "filename" : "llm",
      forumChannelId: getValue("scheduled-model-forum-channel-id").trim(),
      forumChannelName: getValue("scheduled-model-forum-channel-name").trim(),
      lowPolyForumChannelId: getValue("scheduled-model-lowpoly-forum-channel-id").trim(),
      initialExtraText: getValue("scheduled-model-initial-extra").trim(),
      modelUploadTarget: getValue("scheduled-model-model-upload-target", "selected") === "target" ? "target" : "selected",
      includeModelFile: getChecked("scheduled-model-include-model"),
      includePreviewMedia: getChecked("scheduled-model-include-preview"),
      includeSourceImage: getChecked("scheduled-model-include-source-image"),
      includeEmbed: getChecked("scheduled-model-include-embed"),
      includeButtons: getChecked("scheduled-model-include-buttons"),
      includeEmbedInInitial: getChecked("scheduled-model-embed-in-initial"),
      uploadTextureMessages: getChecked("scheduled-model-upload-textures"),
      uploadMultiViewTextures: getChecked("scheduled-model-upload-multiview"),
      uploadUvMapTextures: getChecked("scheduled-model-upload-uv"),
      uploadNormalMapTextures: getChecked("scheduled-model-upload-normal"),
      textureUploadTarget: normalizeTextureUploadTarget(getValue("scheduled-model-texture-upload-target", "target")),
      destinationExtraText: getValue("scheduled-model-destination-extra").trim(),
      generateLowPolyVersion: getChecked("scheduled-model-generate-lowpoly"),
      lowPolyUseLlmTargetFaces: getChecked("scheduled-model-lowpoly-use-llm-target-faces"),
      lowPolyLlmDecisionSource: getValue("scheduled-model-lowpoly-llm-decision-source", "input-image") === "model-render" ? "model-render" : "input-image",
      lowPolyTargetFaceCount: Number.isFinite(lowPolyTargetFaceCount) && lowPolyTargetFaceCount > 0 ? lowPolyTargetFaceCount : 1500
    };
  }

  function updateUi(source) {
    if (source !== "model-3d") {
      return;
    }
    const targetMode = getValue("scheduled-model-post-target-mode", "channel");
    const threadNameMode = normalizeThreadNameMode(getValue("scheduled-model-thread-name-mode", "fixed"));
    const useModelNameMode = threadNameMode === "model-name";
    const sendInitialToSelectedChannel = getChecked("scheduled-model-send-initial");
    const uploadTextures = getChecked("scheduled-model-upload-textures");
    const generateLowPoly = getChecked("scheduled-model-generate-lowpoly");
    const lowPolyUseLlmTargetFaces = getChecked("scheduled-model-lowpoly-use-llm-target-faces");
    const showLowPolyDecisionSource = generateLowPoly && lowPolyUseLlmTargetFaces;
    const showLowPolyManualTarget = generateLowPoly && !lowPolyUseLlmTargetFaces;
    const includeModelFile = getChecked("scheduled-model-include-model");
    const useThreadNaming = targetMode === "thread" || targetMode === "forum-post" || targetMode === "forum-create-and-post";
    const useForumPost = targetMode === "forum-post";
    const useForumCreate = targetMode === "forum-create-and-post";
    setHidden("scheduled-model-initial-post-toggle", !useThreadNaming);
    setClosestFieldHidden("scheduled-model-initial-extra", !useThreadNaming || !sendInitialToSelectedChannel);
    setHidden("scheduled-model-embed-in-initial-toggle", !useThreadNaming || !sendInitialToSelectedChannel);
    setHidden("scheduled-model-model-upload-target-field", !(useThreadNaming && sendInitialToSelectedChannel && includeModelFile));
    setHidden("scheduled-model-thread-name-mode-field", !useThreadNaming);
    setHidden("scheduled-model-model-name-source-field", !useThreadNaming || !useModelNameMode);
    setHidden("scheduled-model-thread-name-field", !useThreadNaming || threadNameMode === "increment" || useModelNameMode);
    setHidden("scheduled-model-thread-base-field", !useThreadNaming || threadNameMode !== "increment");
    setHidden("scheduled-model-forum-channel-id-field", !(useForumPost || useForumCreate));
    setHidden("scheduled-model-forum-channel-name-field", !useForumCreate);
    setHidden("scheduled-model-upload-textures-toggle", false);
    setHidden("scheduled-model-texture-upload-target-field", !uploadTextures);
    setHidden("scheduled-model-upload-multiview-toggle", !uploadTextures);
    setHidden("scheduled-model-upload-uv-toggle", !uploadTextures);
    setHidden("scheduled-model-upload-normal-toggle", !uploadTextures);
    setHidden("scheduled-model-generate-lowpoly-toggle", false);
    setHidden("scheduled-model-lowpoly-use-llm-target-faces-toggle", !generateLowPoly);
    setHidden("scheduled-model-lowpoly-llm-decision-source-field", !showLowPolyDecisionSource);
    setClosestFieldHidden("scheduled-model-lowpoly-target-face-preset", !showLowPolyManualTarget);
    setClosestFieldHidden("scheduled-model-lowpoly-target-face-count", !showLowPolyManualTarget);
    setHidden("scheduled-model-lowpoly-forum-channel-id-field", !generateLowPoly);
    syncLowPolyPresetFromFaceCount();
  }

  function normalizeImageThreadNameMode(value) {
    return value === "increment" || value === "image-name" ? value : "fixed";
  }

  function normalizeImageTargetMode(value) {
    return value === "thread" || value === "forum-post" || value === "forum-create-and-post" ? value : "channel";
  }

  function normalizeImagePostMode(value) {
    return value === "separate" ? "separate" : "combined";
  }

  function normalizeImageRecipeStep(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
    if (["remove", "remove-bg", "remove-background", "background-remove", "rembg", "bg-remove"].includes(normalized)) return "remove-background";
    if (["pixel", "pixel-art", "pixelart", "pixels"].includes(normalized)) return "pixel-art";
    if (normalized === "delight" || normalized === "de-light") return "delight";
    return "";
  }

  function getImageRecipeStepLabel(step) {
    if (step === "remove-background") return "Remove background";
    if (step === "pixel-art") return "Pixel art";
    if (step === "delight") return "Delight";
    return "Version step";
  }

  function formatImageRecipeSteps(steps) {
    return (steps || []).map(getImageRecipeStepLabel).join(" > ");
  }

  function normalizeImageRecipeRows(rows) {
    return (rows || []).map(steps => (steps || []).map(normalizeImageRecipeStep).filter(Boolean)).filter(steps => steps.length > 0);
  }

  function readImageRecipeRowsFromStore() {
    return getValue("scheduled-image-variant-recipes").split(/\r?\n/)
      .map(line => line.split(">").map(normalizeImageRecipeStep).filter(Boolean))
      .filter(steps => steps.length > 0);
  }

  function writeImageRecipeRowsToStore(rows) {
    setValue("scheduled-image-variant-recipes", (rows || []).map(steps => steps.join(" > ")).join("\n"));
  }

  function getDefaultImageRecipeSteps() {
    const steps = [];
    if (getChecked("scheduled-image-variant-delight")) steps.push("delight");
    if (getChecked("scheduled-image-variant-remove-background")) steps.push("remove-background");
    if (getChecked("scheduled-image-variant-pixel-art")) steps.push("pixel-art");
    return steps;
  }

  function getNewImageRecipeSteps() {
    const defaultSteps = getDefaultImageRecipeSteps();
    return defaultSteps.length > 0 ? defaultSteps : ["delight", "remove-background"];
  }

  function commitImageRecipeRows(rows) {
    const normalized = normalizeImageRecipeRows(rows);
    writeImageRecipeRowsToStore(normalized);
    renderImageRecipeBuilder(normalized);
    refreshImageVariantTargetBuilder();
  }

  function renderImageRecipeBuilder(rows) {
    const container = getNode("scheduled-image-variant-recipe-builder");
    if (!container) return;
    const recipeRows = Array.isArray(rows) ? normalizeImageRecipeRows(rows) : readImageRecipeRowsFromStore();
    container.innerHTML = "";
    if (recipeRows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "variant-route-empty variant-recipe-empty";
      const defaultSteps = getDefaultImageRecipeSteps();
      empty.textContent = defaultSteps.length > 0
        ? "Default toggle chain: " + formatImageRecipeSteps(defaultSteps) + "."
        : "No extra versions yet. Turn on toggles above or add a custom version.";
      container.appendChild(empty);
      writeImageRecipeRowsToStore([]);
      return;
    }
    recipeRows.forEach((steps, index) => {
      const row = document.createElement("div");
      row.className = "variant-recipe-card";
      row.innerHTML =
        "<div class='variant-route-head'><div><strong>Custom Version " + (index + 1) + "</strong><div class='variant-route-summary'>" + escapeHtml(formatImageRecipeSteps(steps)) + "</div></div><button type='button' data-recipe-remove>Remove</button></div>"
        + "<div class='variant-recipe-steps'>" + steps.map((step, stepIndex) =>
          "<span class='variant-recipe-step'><span>" + escapeHtml(getImageRecipeStepLabel(step)) + "</span><button type='button' data-step-remove='" + stepIndex + "' aria-label='Remove " + escapeAttribute(getImageRecipeStepLabel(step)) + "'>x</button></span>"
        ).join("<span class='variant-recipe-arrow'>&gt;</span>") + "</div>"
        + "<div class='row variant-route-actions'>"
        + "<button class='secondary mini-button' type='button' data-add-step='delight'>Add Delight</button>"
        + "<button class='secondary mini-button' type='button' data-add-step='remove-background'>Add Remove BG</button>"
        + "<button class='secondary mini-button' type='button' data-add-step='pixel-art'>Add Pixel Art</button>"
        + "</div>";
      container.appendChild(row);
      row.querySelector("[data-recipe-remove]").addEventListener("click", () => {
        const next = readImageRecipeRowsFromStore();
        next.splice(index, 1);
        commitImageRecipeRows(next);
      });
      row.querySelectorAll("[data-step-remove]").forEach(button => {
        button.addEventListener("click", () => {
          const stepIndex = Number.parseInt(button.getAttribute("data-step-remove") || "-1", 10);
          const next = readImageRecipeRowsFromStore();
          next[index] = (next[index] || []).filter((_, currentIndex) => currentIndex !== stepIndex);
          commitImageRecipeRows(next);
        });
      });
      row.querySelectorAll("[data-add-step]").forEach(button => {
        button.addEventListener("click", () => {
          const next = readImageRecipeRowsFromStore();
          const step = normalizeImageRecipeStep(button.getAttribute("data-add-step"));
          if (!next[index]) next[index] = [];
          if (step) next[index].push(step);
          commitImageRecipeRows(next);
        });
      });
    });
  }

  function ensureImageRecipeBuilderBound() {
    if (ensureImageRecipeBuilderBound.bound === true) return;
    ensureImageRecipeBuilderBound.bound = true;
    getNode("scheduled-image-add-variant-recipe-button")?.addEventListener("click", () => {
      const next = readImageRecipeRowsFromStore();
      next.push(getNewImageRecipeSteps());
      commitImageRecipeRows(next);
    });
    getNode("scheduled-image-add-default-variant-recipe-button")?.addEventListener("click", () => {
      const defaultSteps = getDefaultImageRecipeSteps();
      if (defaultSteps.length === 0) return;
      const next = readImageRecipeRowsFromStore();
      next.push(defaultSteps);
      commitImageRecipeRows(next);
    });
    document.querySelectorAll("[data-image-variant-recipe-preset]").forEach(button => {
      button.addEventListener("click", () => {
        const preset = String(button.getAttribute("data-image-variant-recipe-preset") || "");
        const steps = preset.split(">").map(normalizeImageRecipeStep).filter(Boolean);
        if (steps.length === 0) return;
        const next = readImageRecipeRowsFromStore();
        next.push(steps);
        commitImageRecipeRows(next);
      });
    });
    getNode("scheduled-image-clear-variant-recipes-button")?.addEventListener("click", () => {
      commitImageRecipeRows([]);
    });
  }

  function getImageVersionLabelOptions() {
    const labels = ["Original"];
    const recipeLines = readImageRecipeRowsFromStore().map(steps => steps.join(" > "));
    if (recipeLines.length > 0) {
      recipeLines.forEach(line => labels.push(line));
    } else {
      const steps = [];
      if (getChecked("scheduled-image-variant-delight")) steps.push("delight");
      if (getChecked("scheduled-image-variant-remove-background")) steps.push("remove-background");
      if (getChecked("scheduled-image-variant-pixel-art")) steps.push("pixel-art");
      if (steps.length > 0) labels.push(steps.join(" > "));
    }
    return Array.from(new Set(labels));
  }

  function getImageVersionDisplayLabel(label) {
    if (label === "__step:pixel-art") return "Any pixel art version";
    if (label === "__step:remove-background") return "Any remove-background version";
    if (label === "__step:delight") return "Any delight version";
    if (label === "Original") return "Original";
    const steps = String(label || "").split(">").map(normalizeImageRecipeStep).filter(Boolean);
    return steps.length > 0 ? formatImageRecipeSteps(steps) : String(label || "Image version");
  }
  function collectImageRecipeSteps() {
    const steps = new Set();
    readImageRecipeRowsFromStore().forEach(row => row.forEach(step => steps.add(step)));
    getDefaultImageRecipeSteps().forEach(step => steps.add(step));
    return steps;
  }
  function getImageVersionRouteOptions() {
    const labels = getImageVersionLabelOptions();
    const steps = collectImageRecipeSteps();
    if (steps.has("pixel-art")) labels.push("__step:pixel-art");
    if (steps.has("remove-background")) labels.push("__step:remove-background");
    if (steps.has("delight")) labels.push("__step:delight");
    return Array.from(new Set(labels));
  }
  function getSelectOptions(selectId, selectedValue) {
    const sourceSelect = getNode(selectId);
    const options = Array.from(sourceSelect?.options || []).map(option => ({
      value: String(option.value || "").trim(),
      label: String(option.textContent || option.value || "").trim()
    })).filter(option => option.value);
    const normalizedSelected = String(selectedValue || "").trim();
    if (normalizedSelected && !options.some(option => option.value === normalizedSelected)) {
      options.push({ value: normalizedSelected, label: normalizedSelected });
    }
    return options;
  }
  function renderScheduledChannelSelect(attributeName, selectedValue, placeholderLabel) {
    const normalizedSelected = String(selectedValue || "").trim();
    const options = getSelectOptions("scheduled-target-channel-select", normalizedSelected);
    return "<select " + attributeName + ">"
      + "<option value=''>" + escapeHtml(placeholderLabel) + "</option>"
      + options.map(option => "<option value='" + escapeAttribute(option.value) + "'" + (option.value === normalizedSelected ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>").join("")
      + "</select>";
  }
  function renderScheduledForumChannelSelect(attributeName, selectedValue, placeholderLabel) {
    const normalizedSelected = String(selectedValue || "").trim();
    const options = getSelectOptions("scheduled-image-forum-channel-id", normalizedSelected);
    return "<select " + attributeName + ">"
      + "<option value=''>" + escapeHtml(placeholderLabel) + "</option>"
      + options.map(option => "<option value='" + escapeAttribute(option.value) + "'" + (option.value === normalizedSelected ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>").join("")
      + "</select>";
  }

  function readImageVariantTargetRows() {
    return Array.from(document.querySelectorAll("[data-image-variant-route]")).map(row => {
      const labels = Array.from(row.querySelectorAll("[data-route-label]:checked")).map(input => input.value).filter(Boolean);
      const targetMode = normalizeImageTargetMode(row.querySelector("[data-route-target-mode]")?.value);
      return {
        labels,
        channelId: row.querySelector("[data-route-channel-id]")?.value.trim() || "",
        targetMode,
        threadName: row.querySelector("[data-route-name]")?.value.trim() || "",
        forumChannelId: row.querySelector("[data-route-forum-id]")?.value.trim() || "",
        forumChannelName: targetMode === "forum-create-and-post" ? row.querySelector("[data-route-name]")?.value.trim() || "" : "",
        postMode: normalizeImagePostMode(row.querySelector("[data-route-post-mode]")?.value)
      };
    }).filter(route => route.labels.length > 0 && (route.channelId || route.forumChannelId || route.forumChannelName));
  }

  function setImageVariantTargetStore(routes) {
    setValue("scheduled-image-variant-targets", JSON.stringify(routes || []));
  }

  function getStoredImageVariantTargets() {
    try {
      const parsed = JSON.parse(getValue("scheduled-image-variant-targets", "[]"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function syncImageVariantTargetStore() {
    setImageVariantTargetStore(readImageVariantTargetRows());
  }

  function renderImageVariantTargetBuilder(routes) {
    const list = getNode("scheduled-image-variant-target-list");
    if (!list) return;
    const labels = getImageVersionRouteOptions();
    const normalizedRoutes = Array.isArray(routes) ? routes : getStoredImageVariantTargets();
    list.innerHTML = "";
    if (normalizedRoutes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "variant-route-empty";
      empty.textContent = "No extra destination routes. Versions will post to the main image destination unless you add a route here.";
      list.appendChild(empty);
      setImageVariantTargetStore([]);
      return;
    }
    normalizedRoutes.forEach((route, index) => {
      const targetMode = normalizeImageTargetMode(route.targetMode);
      const row = document.createElement("div");
      row.className = "variant-route-card";
      row.dataset.imageVariantRoute = String(index);
      row.innerHTML =
        "<div class='variant-route-head'><div><strong>Destination Route " + (index + 1) + "</strong><div class='variant-route-summary'>Choose the versions, then choose where those files should be posted.</div></div><button type='button' data-route-remove>Remove</button></div>"
        + "<div class='variant-route-section-label'>Versions sent by this route</div>"
        + "<div class='variant-route-labels'>" + labels.map(label => "<label class='variant-route-chip'><input data-route-label type='checkbox' value='" + escapeAttribute(label) + "'" + (Array.isArray(route.labels) && route.labels.includes(label) ? " checked" : "") + "> <span>" + escapeHtml(getImageVersionDisplayLabel(label)) + "</span></label>").join("") + "</div>"
        + "<div class='variant-route-grid'>"
        + "<label class='field'><span>Discord Channel</span>" + renderScheduledChannelSelect("data-route-channel-id", route.channelId || "", "Use main scheduled channel") + "</label>"
        + "<label class='field'><span>Post As</span><select data-route-target-mode><option value='channel'>Channel message</option><option value='thread'>New thread</option><option value='forum-post'>Existing forum post</option><option value='forum-create-and-post'>Create/find forum post</option></select></label>"
        + "<label class='field'><span>Forum Channel</span>" + renderScheduledForumChannelSelect("data-route-forum-id", route.forumChannelId || "", "Choose forum channel when needed") + "</label>"
        + "<label class='field'><span>Thread/Post Name</span><input data-route-name value='" + escapeAttribute(route.threadName || route.forumChannelName || "") + "' placeholder='Optional name'></label>"
        + "<label class='field'><span>Message Layout</span><select data-route-post-mode><option value='combined'>One message</option><option value='separate'>Separate messages</option></select></label>"
        + "</div>"
        + "<div class='row variant-route-actions'><button class='secondary mini-button' type='button' data-route-use-selected>Use Scheduled Channel</button><button class='secondary mini-button' type='button' data-route-use-forum>Use Image Forum</button></div>";
      list.appendChild(row);
      row.querySelector("[data-route-target-mode]").value = targetMode;
      row.querySelector("[data-route-post-mode]").value = normalizeImagePostMode(route.postMode);
      row.querySelector("[data-route-remove]").addEventListener("click", () => {
        const next = readImageVariantTargetRows();
        next.splice(index, 1);
        renderImageVariantTargetBuilder(next);
      });
      row.querySelector("[data-route-use-selected]").addEventListener("click", () => {
        const channelInput = row.querySelector("[data-route-channel-id]");
        if (channelInput) channelInput.value = getValue("scheduled-target-channel-select");
        syncImageVariantTargetStore();
      });
      row.querySelector("[data-route-use-forum]").addEventListener("click", () => {
        const forumInput = row.querySelector("[data-route-forum-id]");
        if (forumInput) forumInput.value = getValue("scheduled-image-forum-channel-id");
        syncImageVariantTargetStore();
      });
      row.querySelectorAll("input, select").forEach(input => input.addEventListener("change", syncImageVariantTargetStore));
      row.querySelectorAll("input").forEach(input => input.addEventListener("input", syncImageVariantTargetStore));
    });
    syncImageVariantTargetStore();
  }

  function addImageVariantTargetRoute() {
    const labels = getImageVersionLabelOptions();
    const current = readImageVariantTargetRows();
    current.push({
      labels: labels.slice(0, 1),
      channelId: getValue("scheduled-target-channel-select"),
      targetMode: "channel",
      threadName: "",
      forumChannelId: "",
      forumChannelName: "",
      postMode: "combined"
    });
    renderImageVariantTargetBuilder(current);
  }

  function refreshImageVariantTargetBuilder() {
    const existing = readImageVariantTargetRows();
    const allowed = new Set(getImageVersionRouteOptions());
    const reconciled = existing.map(route => ({ ...route, labels: route.labels.filter(label => allowed.has(label)) })).filter(route => route.labels.length > 0);
    renderImageVariantTargetBuilder(reconciled);
  }

  function applyImage(options) {
    const value = options || {};
    setValue("scheduled-image-post-target-mode", value.targetMode || "channel");
    setChecked("scheduled-image-send-initial", value.sendInitialToSelectedChannel === true);
    setValue("scheduled-image-thread-name-mode", normalizeImageThreadNameMode(value.threadNameMode));
    setValue("scheduled-image-thread-name", value.threadName || "");
    setValue("scheduled-image-thread-base", value.threadNameBase || "Image Drop");
    setValue("scheduled-image-forum-channel-id", value.forumChannelId || "");
    setValue("scheduled-image-forum-channel-name", value.forumChannelName || "images");
    setValue("scheduled-image-selected-channel-image-mode", value.selectedChannelImageMode || "notice-only");
    setValue("scheduled-image-selected-channel-labels", Array.isArray(value.selectedChannelImageLabels) ? value.selectedChannelImageLabels.join(", ") : "");
    setValue("scheduled-image-initial-extra", value.initialExtraText || "");
    setValue("scheduled-image-destination-extra", value.destinationExtraText || "");
    setImageVariantTargetStore(value.variantTargets || []);
    ensureImageRecipeBuilderBound();
    renderImageRecipeBuilder();
    renderImageVariantTargetBuilder(value.variantTargets || []);
    setChecked("scheduled-image-include-embed", value.includeEmbed !== false);
  }

  function readImage() {
    const threadNameMode = normalizeImageThreadNameMode(getValue("scheduled-image-thread-name-mode", "fixed"));
    return {
      targetMode: getValue("scheduled-image-post-target-mode", "channel") || "channel",
      sendInitialToSelectedChannel: getChecked("scheduled-image-send-initial"),
      threadNameMode,
      threadName: getValue("scheduled-image-thread-name").trim(),
      threadNameBase: getValue("scheduled-image-thread-base").trim(),
      forumChannelId: getValue("scheduled-image-forum-channel-id").trim(),
      forumChannelName: getValue("scheduled-image-forum-channel-name").trim(),
      selectedChannelImageMode: ["original", "all", "custom"].includes(getValue("scheduled-image-selected-channel-image-mode", "notice-only"))
        ? getValue("scheduled-image-selected-channel-image-mode", "notice-only")
        : "notice-only",
      selectedChannelImageLabels: getValue("scheduled-image-selected-channel-labels").split(",").map(entry => entry.trim()).filter(Boolean),
      initialExtraText: getValue("scheduled-image-initial-extra").trim(),
      destinationExtraText: getValue("scheduled-image-destination-extra").trim(),
      includeEmbed: getChecked("scheduled-image-include-embed"),
      variantTargets: readImageVariantTargetRows()
    };
  }

  function updateImageUi(source) {
    if (source !== "image") {
      return;
    }
    const targetMode = getValue("scheduled-image-post-target-mode", "channel");
    const threadNameMode = normalizeImageThreadNameMode(getValue("scheduled-image-thread-name-mode", "fixed"));
    const useThreadNaming = targetMode === "thread" || targetMode === "forum-post" || targetMode === "forum-create-and-post";
    const sendInitialToSelectedChannel = getChecked("scheduled-image-send-initial");
    const selectedChannelImageMode = getValue("scheduled-image-selected-channel-image-mode", "notice-only");
    const useForumPost = targetMode === "forum-post";
    const useForumCreate = targetMode === "forum-create-and-post";
    setHidden("scheduled-image-initial-post-toggle", !useThreadNaming);
    setHidden("scheduled-image-selected-channel-image-mode-field", !useThreadNaming || !sendInitialToSelectedChannel);
    setHidden("scheduled-image-selected-channel-labels-field", !useThreadNaming || !sendInitialToSelectedChannel || selectedChannelImageMode !== "custom");
    setClosestFieldHidden("scheduled-image-initial-extra", !useThreadNaming || !sendInitialToSelectedChannel);
    setHidden("scheduled-image-thread-name-mode-field", !useThreadNaming);
    setHidden("scheduled-image-thread-name-field", !useThreadNaming || threadNameMode === "increment" || threadNameMode === "image-name");
    setHidden("scheduled-image-thread-base-field", !useThreadNaming || threadNameMode !== "increment");
    setHidden("scheduled-image-forum-channel-id-field", !(useForumPost || useForumCreate));
    setHidden("scheduled-image-forum-channel-name-field", !useForumCreate);
    setHidden("scheduled-image-destination-extra-field", false);
    setHidden("scheduled-image-include-embed-toggle", false);
    ensureImageRecipeBuilderBound();
    renderImageRecipeBuilder();
    refreshImageVariantTargetBuilder();
  }

  global.DashboardScheduledModelPostOptions = {
    apply,
    applyImage,
    read,
    readImage,
    updateUi,
    updateImageUi,
    addImageVariantTargetRoute,
    refreshImageVariantTargetBuilder,
    syncLowPolyPresetFromFaceCount,
    applyLowPolyPresetToFaceCount
  };
})(window);
