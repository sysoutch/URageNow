function createDashboardImageQuickActionModalPresentation(dependencies) {
  const {
    clearChildren,
    getActionTargets,
    getActiveTarget,
    layeredPreflight,
    setCheckboxValue,
    setInputValue,
    setOutput
  } = dependencies;
  const state = {
    actionKey: "",
    target: null,
    mode: ""
  };

  function getDefaultPrompt(actionKey, target) {
    if (actionKey === "rotate360") {
      return "The subject performs a fast in-place 360 degree rotation, physically turning around its vertical axis, consistent proportions, stable anatomy, rigid object motion, no deformation, clean turntable spin, even lighting, fixed camera.";
    }
    if (actionKey === "video") {
      const sourcePrompt = String(target?.prompt || "").trim();
      return sourcePrompt
        ? sourcePrompt + "\nSmooth camera motion, coherent subject movement, stable details, polished short video."
        : "Animate the subject with smooth camera motion, coherent movement, stable details, and polished lighting.";
    }
    return "";
  }

  function setPromptMeta(label, placeholder, hint) {
    const labelNode = document.querySelector("label[for='image-quick-action-prompt']");
    const promptNode = document.getElementById("image-quick-action-prompt");
    const hintNode = document.getElementById("image-quick-action-prompt-hint");
    if (labelNode) labelNode.textContent = label;
    if (promptNode) promptNode.placeholder = placeholder;
    if (hintNode) hintNode.textContent = hint;
  }

  function setRunLabel(label) {
    const labelNode = document.getElementById("image-quick-action-run-button")?.querySelector("span:last-child");
    if (labelNode) {
      labelNode.textContent = label;
    }
  }

  function setFieldVisibility(fieldId, visible) {
    document.getElementById(fieldId)?.classList.toggle("hidden", visible !== true);
  }

  function setModeOptions(options) {
    const selectNode = document.getElementById("image-quick-action-mode");
    if (!selectNode) {
      return;
    }
    const currentValue = String(selectNode.value || "").trim();
    selectNode.innerHTML = options.map(option => "<option value=\"" + option.value + "\">" + option.label + "</option>").join("");
    selectNode.value = options.some(option => option.value === currentValue) ? currentValue : options[0]?.value || "";
    state.mode = selectNode.value;
  }

  function syncModeUi() {
    if (state.actionKey !== "delight") {
      return;
    }
    const modeField = document.getElementById("image-quick-action-mode-field");
    const modeSelect = document.getElementById("image-quick-action-mode");
    const modeHint = document.getElementById("image-quick-action-mode-hint");
    const toolNote = document.getElementById("image-quick-action-tool-note");
    const mode = String(modeSelect?.value || state.mode || "comfyui").trim() || "comfyui";
    state.mode = mode;
    const isBlender = mode === "blender";
    const isTool = mode === "tool";
    modeField?.classList.remove("hidden");
    if (modeHint) {
      modeHint.classList.remove("hidden");
      modeHint.textContent = isBlender
        ? "Blender mode opens the selected image on a plane in Blender for manual delight work."
        : isTool
          ? "Tool mode opens Toon Image Shader with the selected image already loaded."
          : "ComfyUI mode runs the delight workflow on the selected image source.";
    }
    toolNote?.classList.toggle("hidden", !isTool);
    document.querySelectorAll("#image-quick-action-modal .image-quick-model-field").forEach(node => node.classList.toggle("hidden", true));
    [
      "image-quick-action-prompt-field",
      "image-quick-action-length-field",
      "image-quick-action-fps-field",
      "image-quick-action-steps-field",
      "image-quick-action-cfg-field",
      "image-quick-action-seed-field",
      "image-quick-action-width-field",
      "image-quick-action-height-field"
    ].forEach(fieldId => setFieldVisibility(fieldId, false));
    setRunLabel(isBlender ? "Open In Blender" : isTool ? "Open Tool" : "Run Delight");
  }

  function setModalMode(actionKey) {
    const modal = document.getElementById("image-quick-action-modal");
    if (!modal) {
      return;
    }
    const isModel = actionKey === "model3d";
    const isLayered = actionKey === "layered";
    const isVideo = !isModel && !isLayered;
    modal.classList.toggle("is-model-action", isModel);
    modal.classList.toggle("is-video-action", isVideo);
    modal.classList.toggle("is-layered-action", isLayered);
    layeredPreflight.hide();
    document.querySelectorAll("#image-quick-action-modal .image-quick-model-field").forEach(node => node.classList.toggle("hidden", !isModel));
    setFieldVisibility("image-quick-action-mode-field", false);
    document.getElementById("image-quick-action-mode-hint")?.classList.add("hidden");
    document.getElementById("image-quick-action-tool-note")?.classList.add("hidden");
    setFieldVisibility("image-quick-action-prompt-field", !isModel);
    setFieldVisibility("image-quick-action-length-field", isVideo);
    setFieldVisibility("image-quick-action-fps-field", isVideo);
    setFieldVisibility("image-quick-action-steps-field", !isModel);
    setFieldVisibility("image-quick-action-cfg-field", isLayered);
    setFieldVisibility("image-quick-action-layers-field", isLayered);
    setFieldVisibility("image-quick-action-seed-field", !isModel);
    setFieldVisibility("image-quick-action-width-field", isVideo);
    setFieldVisibility("image-quick-action-height-field", isVideo);
    if (isModel) {
      setPromptMeta("Prompt", "Describe the motion or result you want.", "Describe the motion or result you want.");
      setRunLabel("Create 3D");
      return;
    }
    if (isLayered) {
      setPromptMeta(
        "Optional Prompt",
        "Optional: describe the image content if you want to guide the separation.",
        "This workflow uses the selected source image directly. Add a prompt only if you want to guide how the separation should read."
      );
      setRunLabel("Split Layers");
      return;
    }
    if (actionKey === "delight") {
      setModeOptions([
        { value: "comfyui", label: "ComfyUI" },
        { value: "blender", label: "Blender" },
        { value: "tool", label: "Tool" }
      ]);
      syncModeUi();
      return;
    }
    setPromptMeta("Prompt", "Describe the motion or result you want.", "Describe the motion or result you want.");
    setRunLabel(actionKey === "rotate360" ? "Create 360 Clip" : "Generate Video");
  }

  function setRunState(running) {
    const labels = { rotate360: "Create 360 Clip", video: "Generate Video", layered: "Split Layers", delight: "Delight Image", model3d: "Create 3D Model" };
    const actionLabel = labels[state.actionKey] || "Run Action";
    const button = document.getElementById("image-quick-action-run-button");
    const statusNode = document.getElementById("image-quick-action-run-status");
    if (button) button.disabled = running === true;
    setRunLabel(running ? "Working..." : actionLabel);
    if (statusNode) {
      statusNode.textContent = running ? actionLabel + " is running. This can take a moment." : "";
      statusNode.classList.toggle("hidden", running !== true);
    }
    document.getElementById("image-quick-action-modal")?.classList.toggle("is-running", running === true);
  }

  function renderPreviewGallery(targets) {
    const previewGallery = document.getElementById("image-quick-action-preview-gallery");
    if (!previewGallery) {
      return;
    }
    clearChildren(previewGallery);
    targets.forEach((entry, index) => {
      const item = document.createElement("figure");
      item.className = "image-quick-action-preview-item";
      const image = document.createElement("img");
      image.src = entry.imageUrl;
      image.alt = entry.fileName || entry.label || "Selected source " + (index + 1);
      const caption = document.createElement("figcaption");
      caption.textContent = entry.fileName || entry.label || "Image " + (index + 1);
      item.append(image, caption);
      previewGallery.appendChild(item);
    });
  }

  function open(actionKey) {
    const targets = actionKey === "model3d" ? getActionTargets() : [getActiveTarget()].filter(Boolean);
    const target = targets[0] || null;
    if (!target?.imageUrl) {
      setOutput("Select a generated image or uploaded edit source first.");
      return;
    }
    const modal = document.getElementById("image-quick-action-modal");
    if (!modal) {
      return;
    }
    state.actionKey = actionKey;
    state.target = target;
    setModalMode(actionKey);
    const titles = {
      rotate360: ["Rotate 360 Clip", "Configure motion before generation"],
      video: ["Generate Video From Image", "Configure image-to-video before generation"],
      delight: ["Delight Image", "Choose how this delight run should execute"],
      layered: ["Separate Layers", "Configure image-to-layer separation before generation"],
      model3d: ["Create 3D From Preview", "Configure 3D generation before processing"]
    };
    const title = titles[actionKey] || titles.video;
    const titleNode = document.getElementById("image-quick-action-modal-title");
    const kickerNode = document.getElementById("image-quick-action-kicker");
    const nameNode = document.getElementById("image-quick-action-source-name");
    const detailNode = document.getElementById("image-quick-action-source-detail");
    if (titleNode) titleNode.textContent = title[0];
    if (kickerNode) kickerNode.textContent = title[1];
    renderPreviewGallery(targets);
    if (nameNode) nameNode.textContent = targets.length > 1 ? targets.length + " selected images" : target.fileName || target.label || "Selected source";
    if (detailNode) detailNode.textContent = targets.length > 1 ? "All selected images will be processed." : target.label || "Current Image Studio preview";
    setInputValue("image-quick-action-prompt", getDefaultPrompt(actionKey, target));
    setInputValue("image-quick-action-length", actionKey === "rotate360" ? "13" : "150");
    setInputValue("image-quick-action-fps", actionKey === "rotate360" ? "8" : "30");
    setInputValue("image-quick-action-steps", actionKey === "layered" ? "20" : "25");
    setInputValue("image-quick-action-cfg", "2.5");
    setInputValue("image-quick-action-layers", "2");
    setInputValue("image-quick-action-width", document.getElementById("imagegen-width")?.value || "720");
    setInputValue("image-quick-action-height", document.getElementById("imagegen-height")?.value || "720");
    setInputValue("image-quick-action-seed", "");
    setCheckboxValue("image-quick-action-model-filename", true);
    setCheckboxValue("image-quick-action-model-description", true);
    setCheckboxValue("image-quick-action-model-scale", true);
    setCheckboxValue("image-quick-action-model-lowpoly", false);
    modal.classList.remove("hidden");
    document.body.classList.add("image-quick-action-modal-open");
    if (actionKey === "layered") {
      void layeredPreflight.refresh(() => state.actionKey === "layered");
    }
    window.setTimeout(() => {
      const focusNode = actionKey === "model3d"
        ? document.getElementById("image-quick-action-run-button")
        : actionKey === "delight"
          ? document.getElementById("image-quick-action-mode")
          : document.getElementById("image-quick-action-prompt");
      focusNode?.focus?.();
    }, 0);
  }

  function close() {
    document.getElementById("image-quick-action-modal")?.classList.add("hidden");
    document.body.classList.remove("image-quick-action-modal-open");
    state.actionKey = "";
    state.target = null;
    state.mode = "";
    layeredPreflight.cancel();
  }

  return {
    close,
    getActionKey: () => state.actionKey,
    open,
    setRunState,
    syncModeUi
  };
}
