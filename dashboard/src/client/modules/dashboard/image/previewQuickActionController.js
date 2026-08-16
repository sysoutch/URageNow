function createDashboardImagePreviewQuickActionController(dependencies) {
  const {
    buildAbsoluteDashboardUrl,
    getActiveEditSource,
    getGeneratedImageFileUrl,
    getSelectedGeneratedImage,
    getSelectedGeneratedImages,
    state
  } = dependencies;

  function createGeneratedTarget(record) {
    if (!record?.id || !record?.imageFileName) {
      return null;
    }
    return {
      kind: "generated",
      imageUrl: buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(record.id, record.imageFileName)),
      fileName: record.imageFileName,
      prompt: String(record.prompt || "").trim(),
      width: record.width || undefined,
      height: record.height || undefined,
      label: record.imageFileName,
      record
    };
  }

  function createEditSourceTarget(source) {
    if (!source?.value) {
      return null;
    }
    const fallbackName = String(source.fileNameHint || source.label || "source-image").trim() || "source-image";
    return {
      kind: "edit-source",
      imageUrl: String(source.value).trim(),
      fileName: fallbackName,
      prompt: "",
      width: undefined,
      height: undefined,
      label: String(source.label || fallbackName).trim() || "uploaded source image"
    };
  }

  function getFileNameFromUrl(value, fallback) {
    const source = String(value || "").trim();
    if (!source) {
      return fallback;
    }
    try {
      const parsed = new URL(source, window.location.origin);
      return decodeURIComponent(parsed.pathname.split("/").pop() || "").trim() || fallback;
    } catch {
      return source.split(/[/?#]/).filter(Boolean).pop()?.trim() || fallback;
    }
  }

  function getSelectedGeneratedTargets() {
    return getSelectedGeneratedImages().map(createGeneratedTarget).filter(Boolean);
  }

  function getActiveTarget() {
    const selected = getSelectedGeneratedImage();
    const activeEditSource = getActiveEditSource();
    if (state.imageStudioTab === "edit") {
      const editTarget = createEditSourceTarget(activeEditSource);
      if (editTarget) {
        return editTarget;
      }
    }
    const generatedTarget = createGeneratedTarget(selected);
    if (generatedTarget) {
      return generatedTarget;
    }
    const editTarget = createEditSourceTarget(activeEditSource);
    if (editTarget) {
      return editTarget;
    }
    const previewNode = document.getElementById("imagegen-preview");
    const previewUrl = String(previewNode?.getAttribute("src") || previewNode?.src || "").trim();
    return previewUrl ? {
      kind: "preview",
      imageUrl: buildAbsoluteDashboardUrl(previewUrl),
      fileName: getFileNameFromUrl(previewUrl, "preview-image.png"),
      prompt: "",
      width: undefined,
      height: undefined,
      label: "current preview image"
    } : null;
  }

  function getActionTargets() {
    const selectedTargets = getSelectedGeneratedTargets();
    if (selectedTargets.length > 1) {
      return selectedTargets;
    }
    const target = getActiveTarget();
    return target?.imageUrl ? [target] : [];
  }

  function renderContext(target) {
    const badgeNode = document.getElementById("image-preview-context-badge");
    const nameNode = document.getElementById("image-preview-context-name");
    const detailNode = document.getElementById("image-preview-context-detail");
    const isEditSource = target?.kind === "edit-source";
    const isMultiSelection = target?.kind === "multi-selection";
    if (badgeNode) {
      badgeNode.textContent = isMultiSelection ? "Multi Select" : (isEditSource ? "Edit Source" : "Generated");
      badgeNode.classList.toggle("is-edit-source", isEditSource);
      badgeNode.classList.toggle("is-multi-selection", isMultiSelection);
    }
    if (nameNode) {
      nameNode.textContent = target?.label || "No image selected";
    }
    if (detailNode) {
      detailNode.textContent = isMultiSelection
        ? "Preview and quick actions use every selected generated image."
        : target?.imageUrl
          ? isEditSource
            ? "Preview follows the active uploaded source. Quick actions will use this source."
            : "Preview follows the selected generated image from history."
          : "Select a generated image or add an edit source to start working.";
    }
  }

  function updateQuickActions(record) {
    const actionTarget = getActiveTarget();
    const hasRecord = Boolean(record?.id && record?.imageFileName);
    const hasPrompt = hasRecord && Boolean(String(record.prompt || "").trim());
    const hasActionTarget = Boolean(actionTarget?.imageUrl);
    const hasGeneratedToolLogoTarget = Boolean(actionTarget?.kind === "generated" && actionTarget.record?.id && actionTarget.record?.imageFileName);
    const setActionState = (id, enabledTitle) => {
      const button = document.getElementById(id);
      if (!button) return null;
      button.disabled = !hasActionTarget;
      button.title = hasActionTarget ? enabledTitle : "Select a generated image or uploaded edit source first.";
      return button;
    };

    setActionState("image-to-3d-button", "Create a 3D model from the current image source.");
    setActionState("image-to-video-button", "Load the current image source into Video Studio image + text mode without starting generation.");
    setActionState("image-rotate-button", "Start a 360 image + text video clip from the current image source.");
    [
      ["image-remove-background-button", "Remove the background from the selected image."],
      ["image-remove-background-crop-button", "Remove the background from the selected image and crop to the main subject."],
      ["image-separate-layers-tab-button", "Split the current image source into separate layer images with the layered Qwen workflow."],
      ["image-separate-layers-button", "Split the current image source into separate layer images with the layered Qwen workflow."],
      ["image-pixel-art-button", "Convert the current image source to pixel art in the background."],
      ["image-import-blender-button", "Open the current image source on a plane in Blender."],
      ["image-send-menu-toggle", "Choose where to send the current image source."],
      ["image-send-to-tool-button", "Send the current image source to the chosen local tool."],
      ["image-send-to-game-engine-button", "Queue the current image source for game-engine import."],
      ["image-delight-button", "Remove baked lighting and create a flatter delight texture."],
      ["image-upscale-button", "Upscale the current image source using the upscale image workflow."],
      ["image-normal-map-button", "Create a normal map from the current image source in the background."]
    ].forEach(([id, title]) => setActionState(id, title));

    const regenerateButton = document.getElementById("image-regenerate-from-prompt-button");
    if (regenerateButton) {
      regenerateButton.disabled = !hasPrompt;
      regenerateButton.title = hasPrompt
        ? "Run a new generation using this image's saved prompt."
        : "Selected image source has no saved prompt.";
    }
    const useAsToolLogoButton = document.getElementById("image-use-as-tool-logo-button");
    if (useAsToolLogoButton) {
      useAsToolLogoButton.disabled = !hasGeneratedToolLogoTarget;
      useAsToolLogoButton.title = hasGeneratedToolLogoTarget
        ? "Use this generated image as thumbnail.png for the selected local tool."
        : "Select a generated image first. Uploaded edit sources are not stored as tool logos directly.";
    }
    setActionState("image-tool-picker-toggle", "Select which local tool should receive the image.");

    const hintNode = document.getElementById("image-preview-quick-action-hint");
    if (hintNode) {
      hintNode.textContent = !hasActionTarget
        ? "Select a generated image or uploaded edit source to unlock quick actions."
        : !hasPrompt
          ? "Quick actions are ready. Prompt-based regenerate needs a saved prompt for the selected image source."
          : "Quick actions target: " + actionTarget.label;
    }
  }

  return {
    createGeneratedTarget,
    getActionTargets,
    getActiveTarget,
    getFileNameFromUrl,
    getSelectedGeneratedTargets,
    renderContext,
    updateQuickActions
  };
}
