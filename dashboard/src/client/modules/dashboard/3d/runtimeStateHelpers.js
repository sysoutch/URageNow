function createDashboardThreeDRuntimeStateHelpers(input) {
  const state = input?.state || {};
  let viewerHelpers = input?.viewerHelpers || null;

  function bindViewerHelpers(nextViewerHelpers) {
    viewerHelpers = nextViewerHelpers || null;
  }

  function getSelectedGeneratedModel() {
    return Array.isArray(state.generatedModels)
      ? state.generatedModels.find(item => item.id === state.selectedGeneratedModelId) || null
      : null;
  }
  function getSelectedGeneratedModels() {
    if (!Array.isArray(state.generatedModels)) {
      return [];
    }
    const variantModels = getSelectedModel3dVariantModels();
    if (variantModels.length > 0) {
      return variantModels;
    }
    if (typeof createDashboardMediaMultiSelectionHelpers === "function") {
      return createDashboardMediaMultiSelectionHelpers(state).getSelectedRecords(
        state.generatedModels,
        "selectedGeneratedModelIds",
        state.selectedGeneratedModelId
      );
    }
    const selectedIds = Array.isArray(state.selectedGeneratedModelIds) && state.selectedGeneratedModelIds.length > 0
      ? state.selectedGeneratedModelIds
      : [state.selectedGeneratedModelId].filter(Boolean);
    const selectedSet = new Set(selectedIds.map(id => String(id || "").trim()).filter(Boolean));
    return state.generatedModels.filter(item => selectedSet.has(String(item?.id || "").trim()));
  }

  function normalizeModel3dThreeVariant(value) {
    return value === "original" || value === "current" || value === "albedo" ? value : "lowpoly";
  }

  function getModel3dVariantModelIdFromRef(ref) {
    const encodedId = String(ref || "").split("::")[0] || "";
    try {
      return decodeURIComponent(encodedId);
    } catch {
      return encodedId;
    }
  }

  function getModel3dVariantKeyFromRef(ref) {
    return normalizeModel3dThreeVariant(String(ref || "").split("::")[1] || "current");
  }

  function getModel3dVariantFileNameFromRef(ref) {
    const encodedFileName = String(ref || "").split("::")[2] || "";
    try {
      return decodeURIComponent(encodedFileName);
    } catch {
      return encodedFileName;
    }
  }

  function getModel3dRecordVariantFileName(record, variantKey) {
    if (!record) {
      return "";
    }
    return variantKey === "original"
      ? record.originalModelFileName
      : variantKey === "lowpoly"
        ? record.lowPolyModelFileName
        : (variantKey === "albedo" ? record.albedoGeometryModelFileName : record.modelFileName);
  }

  function getSelectedModel3dVariantModels() {
    const refs = Array.from(new Set((Array.isArray(state.selectedGeneratedModelVariantRefs) ? state.selectedGeneratedModelVariantRefs : [])
      .map(ref => String(ref || "").trim())
      .filter(Boolean)));
    return refs.map(ref => {
      const modelId = getModel3dVariantModelIdFromRef(ref);
      const variantKey = getModel3dVariantKeyFromRef(ref);
      const refFileName = getModel3dVariantFileNameFromRef(ref).toLowerCase();
      const records = state.generatedModels.filter(item => String(item?.id || "") === modelId);
      const record = refFileName
        ? records.find(item => String(getModel3dRecordVariantFileName(item, variantKey) || "").trim().toLowerCase() === refFileName) || records[0]
        : records[0];
      if (!record) {
        return null;
      }
      const fileName = getModel3dRecordVariantFileName(record, variantKey);
      return Object.assign({}, record, {
        __model3dVariantKey: variantKey,
        __model3dVariantRef: ref,
        __model3dVariantFileName: fileName || "",
        __model3dVariantTitle: variantKey === "original"
          ? "Original"
          : variantKey === "lowpoly"
            ? "Low Poly"
            : (variantKey === "albedo" ? "Geometry From Albedo" : "Merged")
      });
    }).filter(Boolean);
  }

  function getSelectedGeneratedImage() {
    return Array.isArray(state.generatedImages)
      ? state.generatedImages.find(item => item.id === state.selectedGeneratedImageId) || null
      : null;
  }
  function getSelectedGeneratedImages() {
    if (!Array.isArray(state.generatedImages)) return [];
    if (typeof createDashboardMediaMultiSelectionHelpers !== "function") return getSelectedGeneratedImage() ? [getSelectedGeneratedImage()] : [];
    return createDashboardMediaMultiSelectionHelpers(state).getSelectedRecords(
      state.generatedImages,
      "selectedGeneratedImageIds",
      state.selectedGeneratedImageId
    );
  }

  function getSelectedGeneratedVideo() {
    return Array.isArray(state.generatedVideos)
      ? state.generatedVideos.find(item => item.id === state.selectedGeneratedVideoId) || null
      : null;
  }

  function updateModel3dEditSelectedModelName() {
    const node = document.getElementById("model3d-edit-selected-model-name");
    if (!node) {
      return;
    }
    const selected = getSelectedGeneratedModel();
    node.value = selected
      ? (selected.lowPolyModelFileName || selected.modelFileName || selected.id)
      : "";
    node.placeholder = selected
      ? "Selected generated model ready."
      : "No model selected from history.";
  }

  function updateModel3dEditRoughnessValue() {
    const slider = document.getElementById("model3d-edit-roughness");
    const label = document.getElementById("model3d-edit-roughness-value");
    if (!slider || !label) {
      return;
    }
    const value = Number.parseFloat(slider.value || "0.5");
    label.textContent = Number.isFinite(value) ? value.toFixed(2) : "0.50";
  }

  function describeModel3dScaleDecision(result) {
    if (viewerHelpers && typeof viewerHelpers.describeModel3dScaleDecision === "function") {
      return viewerHelpers.describeModel3dScaleDecision(result);
    }
    const decision = result && result.realWorldHeightDecision ? result.realWorldHeightDecision : null;
    if (!decision) {
      return "";
    }
    const height = typeof decision.heightMeters === "number" && Number.isFinite(decision.heightMeters)
      ? decision.heightMeters.toFixed(2) + "m"
      : "unknown height";
    const reason = typeof decision.reason === "string" && decision.reason.trim() ? " Reason: " + decision.reason.trim() : "";
    return " LLM target height: " + height + "." + reason;
  }

  function setModel3dStatus(text) {
    if (viewerHelpers && typeof viewerHelpers.setModel3dStatus === "function") {
      viewerHelpers.setModel3dStatus(text);
      return;
    }
    const node = document.getElementById("model3d-status");
    if (node) {
      node.textContent = text;
    }
  }

  function getModel3dStatusText() {
    if (viewerHelpers && typeof viewerHelpers.getModel3dStatusText === "function") {
      return viewerHelpers.getModel3dStatusText();
    }
    return String(document.getElementById("model3d-status")?.textContent || "").trim();
  }

  function setModel3dPreviewStatus(text) {
    if (viewerHelpers && typeof viewerHelpers.setModel3dPreviewStatus === "function") {
      viewerHelpers.setModel3dPreviewStatus(text);
      return;
    }
    const node = document.getElementById("model3d-viewer-status");
    if (node) {
      node.textContent = text;
    }
  }

  function setModel3dThreeStatus(text) {
    if (viewerHelpers && typeof viewerHelpers.setModel3dThreeStatus === "function") {
      viewerHelpers.setModel3dThreeStatus(text);
      return;
    }
    const node = document.getElementById("model3d-threejs-status");
    if (node) {
      node.textContent = text;
    }
  }

  return {
    bindViewerHelpers,
    getSelectedGeneratedModel,
    getSelectedGeneratedModels,
    getSelectedGeneratedImage,
    getSelectedGeneratedImages,
    getSelectedGeneratedVideo,
    updateModel3dEditSelectedModelName,
    updateModel3dEditRoughnessValue,
    describeModel3dScaleDecision,
    setModel3dStatus,
    getModel3dStatusText,
    setModel3dPreviewStatus,
    setModel3dThreeStatus
  };
}
