function createDashboardThreeDInspectorHelpers(input) {
  const state = input?.state || {};
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const getSelectedGeneratedModel = typeof input?.getSelectedGeneratedModel === "function"
    ? input.getSelectedGeneratedModel
    : function getSelectedGeneratedModelFallback() {
      return null;
    };
  const setModel3dStatus = typeof input?.setModel3dStatus === "function" ? input.setModel3dStatus : function setModel3dStatusFallback() {};
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  let activeInspectionRequestKey = "";

  function getExecutionTarget() {
    return document.getElementById("model3d-metadata-target")?.value === "remote" ? "remote" : "local";
  }

  function getVariant() {
    return state.model3dThreeVariant === "original" || state.model3dThreeVariant === "lowpoly" || state.model3dThreeVariant === "albedo"
      ? state.model3dThreeVariant
      : "merged";
  }

  function getInspectionCacheKey(modelId, variant, executionTarget) {
    return [String(modelId || "").trim(), String(variant || "").trim(), String(executionTarget || "").trim()].join("|");
  }

  function getViewerDerivedInspection(modelId, variant) {
    const cache = state.model3dViewerDerivedInspectionByKey;
    if (!cache || typeof cache !== "object") {
      return null;
    }
    const key = [String(modelId || "").trim(), String(variant || "").trim()].join("|");
    return cache[key] || null;
  }

  function getSelectedRecord(record) {
    return record?.id ? record : getSelectedGeneratedModel();
  }

  function setInputValue(id, value) {
    const node = document.getElementById(id);
    if (node && typeof node.value === "string") {
      node.value = value;
    }
  }

  function setSelectOptions(id, values, fallback) {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }
    const items = Array.isArray(values) && values.length > 0 ? values : [fallback];
    node.innerHTML = items.map(value => "<option>" + String(value || "") + "</option>").join("");
    node.value = items[0] || fallback;
  }

  function summarizeTextureLabel(texture) {
    if (!texture) {
      return "Unknown texture";
    }
    const name = String(texture.name || texture.reference || "Unnamed texture").trim();
    const size = texture.width && texture.height ? " " + texture.width + "x" + texture.height : "";
    const usage = texture.usageCount > 0 ? " used " + texture.usageCount + "x" : "";
    return name + size + usage;
  }

  function collectMaterialTags(material) {
    if (!material || !material.textureSlots) {
      return [];
    }
    const slots = material.textureSlots;
    return [
      slots.baseColor ? "Base" : "",
      slots.normal ? "Normal" : "",
      slots.metallicRoughness ? "Metal/Rough" : "",
      slots.emissive ? "Emissive" : "",
      slots.occlusion ? "Occlusion" : ""
    ].filter(Boolean);
  }

  function renderMaterialList(inspection) {
    const container = document.querySelector(".model3d-material-list");
    if (!container) {
      return;
    }
    if (!inspection) {
      container.innerHTML = "<span>No material data loaded.</span>";
      return;
    }
    const parser = inspection.parser || "unknown";
    const materialCount = inspection?.stats?.resources?.materialCount ?? 0;
    const textureCount = inspection?.stats?.resources?.textureCount ?? 0;
    const materialRows = Array.isArray(inspection?.stats?.materials)
      ? inspection.stats.materials.slice(0, 4).map(material => {
        const tags = collectMaterialTags(material);
        const label = String(material?.name || "Unnamed material");
        return "<span>" + label + (tags.length > 0 ? " [" + tags.join(", ") + "]" : "") + "</span>";
      })
      : [];
    const textureRows = Array.isArray(inspection?.stats?.textures)
      ? inspection.stats.textures.slice(0, 3).map(texture => "<span>" + summarizeTextureLabel(texture) + "</span>")
      : [];
    container.innerHTML = [
      "<span>Parser: " + parser + "</span>",
      "<span>Materials: " + materialCount + "</span>",
      "<span>Textures: " + textureCount + "</span>",
      ...materialRows,
      ...textureRows
    ].join("");
  }

  function renderLodArtifacts(record) {
    const container = document.getElementById("model3d-inspector-lod-results");
    if (!container) {
      return;
    }
    const artifacts = Array.isArray(record?.lodArtifacts) ? record.lodArtifacts : [];
    container.replaceChildren();
    if (artifacts.length === 0) {
      container.textContent = record ? "No generated LODs." : "";
      return;
    }
    artifacts.forEach(artifact => {
      const row = document.createElement("a");
      row.className = "model3d-inspector-lod-result";
      row.href = String(artifact.url || "");
      row.download = String(artifact.fileName || "");
      row.textContent = "LOD" + artifact.level + " · " + Number(artifact.targetFaceCount || 0).toLocaleString() + " faces";
      if (!artifact.url) {
        row.removeAttribute("href");
        row.removeAttribute("download");
      }
      container.appendChild(row);
    });
  }

  function renderInspection(record, inspection, validation) {
    if (!record) {
      setInputValue("model3d-inspector-mesh-name", "");
      setSelectOptions("model3d-inspector-uv", ["Unknown"], "Unknown");
      setSelectOptions("model3d-inspector-texture-resolution", ["Unknown"], "Unknown");
      renderMaterialList(null);
      renderLodArtifacts(null);
      return;
    }
    const variant = getVariant();
    const fallbackInspection = getViewerDerivedInspection(record.id, variant);
    const effectiveInspection = inspection?.inspected === true || inspection?.stats ? inspection : fallbackInspection;
    setInputValue("model3d-inspector-mesh-name", record.modelFileName || record.originalModelFileName || record.lowPolyModelFileName || "Selected model");
    const geometry = effectiveInspection?.stats?.geometry || null;
    const textures = Array.isArray(effectiveInspection?.stats?.textures) ? effectiveInspection.stats.textures : [];
    const lodGroup = document.getElementById("model3d-inspector-lod-group");
    const autoLod = document.getElementById("model3d-inspector-auto-lod");
    if (lodGroup && autoLod?.checked) {
      lodGroup.value = (geometry?.faceCount ?? 0) > 25000 ? "Hero Asset" : ((geometry?.faceCount ?? 0) > 5000 ? "Prop" : "None");
    }
    renderLodArtifacts(record);
    setSelectOptions("model3d-inspector-uv", [(geometry?.uvChannelCount ?? 0) > 0 ? String(geometry.uvChannelCount) : "Unknown"], "Unknown");
    setSelectOptions(
      "model3d-inspector-texture-resolution",
      textures.length > 0 ? textures.slice(0, 3).map(texture => summarizeTextureLabel(texture)) : ["Unknown"],
      "Unknown"
    );
    renderMaterialList(effectiveInspection);
  }

  async function inspectSelectedModel(options) {
    const record = getSelectedRecord(options?.record);
    if (!record?.id) {
      renderInspection(null, null);
      return null;
    }
    const variant = options?.variant || getVariant();
    const executionTarget = options?.executionTarget || getExecutionTarget();
    const cacheKey = getInspectionCacheKey(record.id, variant, executionTarget);
    const cache = state.model3dInspectionByKey && typeof state.model3dInspectionByKey === "object" ? state.model3dInspectionByKey : (state.model3dInspectionByKey = {});
    if (!options?.force && cache[cacheKey]) {
      renderInspection(record, cache[cacheKey].inspection, cache[cacheKey].validation);
      return cache[cacheKey];
    }
    activeInspectionRequestKey = cacheKey;
    renderInspection(record, null, null);
    const [inspection, validation] = await Promise.all([
      request("/api/model3d-inspect", {
        modelId: record.id,
        variant,
        executionTarget
      }),
      request("/api/model3d-validate", {
        modelId: record.id,
        variant,
        executionTarget
      })
    ]);
    cache[cacheKey] = { inspection, validation };
    if (activeInspectionRequestKey === cacheKey) {
      renderInspection(record, inspection, validation);
    }
    return cache[cacheKey];
  }

  function invalidateModelInspection(modelId) {
    const normalized = String(modelId || "").trim();
    if (!normalized || !state.model3dInspectionByKey || typeof state.model3dInspectionByKey !== "object") {
      return;
    }
    Object.keys(state.model3dInspectionByKey).forEach(key => {
      if (key.startsWith(normalized + "|")) {
        delete state.model3dInspectionByKey[key];
      }
    });
  }

  function refreshForCurrentVariant() {
    const selected = getSelectedGeneratedModel();
    if (!selected?.id) {
      return;
    }
    void inspectSelectedModel({ record: selected }).catch(error => {
      const detail = error instanceof Error ? error.message : "Rust model inspection failed.";
      setModel3dStatus("3D model inspection failed.");
      setOutput("Failed to inspect selected model: " + detail);
    });
  }

  return {
    renderInspection,
    renderLodArtifacts,
    inspectSelectedModel,
    invalidateModelInspection,
    refreshForCurrentVariant
  };
}
