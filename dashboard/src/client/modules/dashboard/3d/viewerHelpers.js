function createDashboardThreeDViewerHelpers(input) {
  const state = input?.state || {};
  const recentMediaViewHelpers = createDashboardRecentMediaViewHelpers();
  const generationQueuePresenter = createDashboardGenerationQueuePresenter({document});
  const clearChildren = typeof input?.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback() {};
  const formatDateTime = typeof input?.formatDateTime === "function" ? input.formatDateTime : function formatDateTimeFallback(value) {
    return value ? new Date(value).toLocaleString() : "Unknown";
  };
  const attachDashboardLazyMedia = typeof input?.attachDashboardLazyMedia === "function"
    ? input.attachDashboardLazyMedia
    : function attachDashboardLazyMediaFallback(node, url) {
      if (node) {
        node.src = url || "";
      }
    };
  const buildAbsoluteDashboardUrl = typeof input?.buildAbsoluteDashboardUrl === "function"
    ? input.buildAbsoluteDashboardUrl
    : value => String(value || "").trim();
  const escapeHtml = typeof input?.escapeHtml === "function"
    ? input.escapeHtml
    : function escapeHtmlFallback(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };
  const getModel3dFileUrl = typeof input?.getModel3dFileUrl === "function"
    ? input.getModel3dFileUrl
    : () => "";
  const getSelectedGeneratedModel = typeof input?.getSelectedGeneratedModel === "function"
    ? input.getSelectedGeneratedModel
    : () => null;
  function getSelectedGeneratedModels() {
    const variantModels = getSelectedModel3dVariantModels();
    return variantModels.length > 0
      ? variantModels
      : mediaMultiSelectionHelpers.getSelectedRecords(state.generatedModels, "selectedGeneratedModelIds", state.selectedGeneratedModelId);
  }
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const createImageId = typeof input?.createImageId === "function"
    ? input.createImageId
    : function createImageIdFallback() {
      return "img-" + Math.random().toString(36).slice(2, 10);
    };
  const readBlobAsDataUrl = typeof input?.readBlobAsDataUrl === "function"
    ? input.readBlobAsDataUrl
    : async function readBlobAsDataUrlFallback() {
      return "";
    };
  const updateModel3dEditSelectedModelName = typeof input?.updateModel3dEditSelectedModelName === "function"
    ? input.updateModel3dEditSelectedModelName
    : function updateModel3dEditSelectedModelNameFallback() {};
  const updateModel3dToolQuickActionState = typeof input?.updateModel3dToolQuickActionState === "function"
    ? input.updateModel3dToolQuickActionState
    : function updateModel3dToolQuickActionStateFallback() {};
  const inspectSelectedModel = typeof input?.inspectSelectedModel === "function"
    ? input.inspectSelectedModel
    : async function inspectSelectedModelFallback() {
      return null;
    };
  const renderModel3dInspection = typeof input?.renderModel3dInspection === "function"
    ? input.renderModel3dInspection
    : function renderModel3dInspectionFallback() {};
  const invalidateModelInspection = typeof input?.invalidateModelInspection === "function"
    ? input.invalidateModelInspection
    : function invalidateModelInspectionFallback() {};
  const mediaMultiSelectionHelpers = createDashboardMediaMultiSelectionHelpers(state);
  const loosePartsPreviewHelpers = typeof createDashboardModel3dLoosePartsPreviewHelpers === "function"
    ? createDashboardModel3dLoosePartsPreviewHelpers({ state })
    : {
      isLoosePartsFileName: value => /(?:loose[_-]?parts|_part_\d{3})/i.test(String(value || "")),
      repair() {}
    };
  const model3dDefaultSkyboxUrl = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_06_puresky_1k.hdr";
  const model3dViewer = {
    ready: false,
    renderer: null,
    scene: null,
    camera: null,
    loaders: null,
    loadingManager: null,
    controls: null,
    root: null,
    loadedModelId: "",
    loadedModelKey: "",
    loadedModelFileName: "",
    currentLoadId: "",
    animateHandle: 0,
    autoRotate: false,
    lightRig: null,
    defaultBackground: null,
    defaultEnvironment: null,
    skyboxTexture: null,
    skyboxEnvironmentTexture: null,
    skyboxLoadingPromise: null,
    materialDefaults: new WeakMap(),
    meshGeometryDefaults: new WeakMap(),
    meshMaterialDefaults: new WeakMap(),
    rigHelper: null,
    resizeObserver: null,
    resizeHandler: null,
    sceneHelpers: null,
    previewActive: false,
    resourceContext: null,
    interactionFrames: 0
  };
  const model3dViewerRenderLoop = createDashboardThreeDViewerRenderLoopHelpers({
    viewer: model3dViewer,
    updateLightRig: updateModel3dViewerLightRig
  });
  const {
    cancel: cancelModel3dViewerAnimationFrame,
    renderFrame: renderModel3dViewerFrame,
    requestInteractionFrames: requestModel3dViewerInteractionFrames,
    schedule: scheduleModel3dViewerAnimationFrame
  } = model3dViewerRenderLoop;
  const model3dHistoryInitialRenderLimit = 80;
  const model3dUploadViewerSource = {
    fileName: "",
    fileSizeBytes: 0,
    key: "",
    objectUrl: "",
    previewable: false
  };

  function describeModel3dScaleDecision(result) {
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

  const model3dViewerAssetLoader = createDashboardThreeDViewerAssetLoaderHelpers({
    viewer: model3dViewer,
    setStatus: setModel3dThreeStatus
  });
  const {
    getLoader: getModel3dViewerLoader,
    isPreviewable: isModel3dUploadPreviewable,
    load: loadModel3dViewerAsset,
    resolveFormat: resolveModel3dViewerFormat,
    resolveRoot: resolveModel3dViewerRoot
  } = model3dViewerAssetLoader;

  function getModel3dViewportStatsNode() {
    return document.getElementById("model3d-viewport-stats");
  }

  function formatModel3dInteger(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString() : "unknown";
  }

  function formatModel3dTextureSize(textures) {
    if (!Array.isArray(textures) || textures.length === 0) {
      return "unknown";
    }
    let bestArea = 0;
    let bestLabel = "";
    textures.forEach(texture => {
      const width = Number(texture?.width);
      const height = Number(texture?.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return;
      }
      const area = width * height;
      if (area > bestArea) {
        bestArea = area;
        bestLabel = `${Math.round(width)} x ${Math.round(height)}`;
      }
    });
    return bestLabel || "unknown";
  }

  function renderModel3dViewportStats(stats) {
    const node = getModel3dViewportStatsNode();
    if (!node) {
      return;
    }
    const values = stats && typeof stats === "object" ? stats : {};
    node.innerHTML = [
      "<strong>Model Stats</strong>",
      `<span>Vertices <b>${formatModel3dInteger(values.vertexCount)}</b></span>`,
      `<span>Triangles <b>${formatModel3dInteger(values.triangleCount)}</b></span>`,
      `<span>Faces <b>${formatModel3dInteger(values.faceCount)}</b></span>`,
      `<span>UV Sets <b>${formatModel3dInteger(values.uvChannelCount)}</b></span>`,
      `<span>Materials <b>${formatModel3dInteger(values.materialCount)}</b></span>`,
      `<span>Texture Size <b>${String(values.textureSizeLabel || "unknown")}</b></span>`
    ].join("");
  }

  function buildModel3dViewportStatsFromInspection(inspection) {
    if (!inspection?.stats) {
      return null;
    }
    return {
      vertexCount: inspection.stats.geometry?.vertexCount,
      triangleCount: inspection.stats.geometry?.faceCount,
      faceCount: inspection.stats.geometry?.faceCount,
      uvChannelCount: inspection.stats.geometry?.uvChannelCount,
      materialCount: inspection.stats.resources?.materialCount,
      textureSizeLabel: formatModel3dTextureSize(inspection.stats.textures)
    };
  }

  function countModel3dGeometryUvs(geometry) {
    if (!geometry || !geometry.attributes) {
      return 0;
    }
    let count = 0;
    if (geometry.attributes.uv) count += 1;
    if (geometry.attributes.uv1) count += 1;
    if (geometry.attributes.uv2) count += 1;
    if (geometry.attributes.uv3) count += 1;
    return count;
  }

  function extractModel3dTextureFactsFromMaterial(material, usageMap, textures) {
    if (!material || typeof material !== "object") {
      return;
    }
    const slots = ["map", "emissiveMap", "normalMap", "metalnessMap", "roughnessMap", "aoMap", "alphaMap", "bumpMap", "displacementMap"];
    slots.forEach(slot => {
      const texture = material[slot];
      if (!texture || typeof texture !== "object") {
        return;
      }
      const key = texture.uuid || texture.id || texture.name || `${slot}-${textures.length}`;
      const current = usageMap.get(key) || { texture, usageCount: 0 };
      current.usageCount += 1;
      usageMap.set(key, current);
    });
  }

  function buildModel3dDerivedInspection(root, input) {
    const THREE = window.DiscrodThree?.THREE;
    if (!root || !THREE) {
      return null;
    }
    const geometryStats = {
      meshCount: 0,
      primitiveCount: 0,
      vertexCount: 0,
      faceCount: 0,
      triangleCount: 0,
      normalCount: 0,
      uvChannelCount: 0
    };
    const materialNames = new Set();
    const usageMap = new Map();
    const materialFacts = [];
    const seenMaterialKeys = new Set();
    forEachModel3dMesh(root, mesh => {
      geometryStats.meshCount += 1;
      const geometry = mesh.geometry;
      const positionCount = Number(geometry?.attributes?.position?.count || 0);
      const normalCount = Number(geometry?.attributes?.normal?.count || 0);
      const faceCount = geometry?.index
        ? Math.floor(Number(geometry.index.count || 0) / 3)
        : Math.floor(positionCount / 3);
      geometryStats.vertexCount += positionCount;
      geometryStats.faceCount += faceCount;
      geometryStats.triangleCount += faceCount;
      geometryStats.normalCount += normalCount;
      geometryStats.primitiveCount += Array.isArray(mesh.material) ? mesh.material.length : 1;
      geometryStats.uvChannelCount = Math.max(geometryStats.uvChannelCount, countModel3dGeometryUvs(geometry));
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => {
        if (!material || typeof material !== "object") {
          return;
        }
        extractModel3dTextureFactsFromMaterial(material, usageMap, materialFacts);
        const materialKey = material.uuid || material.id || material.name || `material-${materialFacts.length}`;
        if (seenMaterialKeys.has(materialKey)) {
          return;
        }
        seenMaterialKeys.add(materialKey);
        if (material.name) {
          materialNames.add(material.name);
        }
        materialFacts.push({
          name: material.name || null,
          alphaMode: material.transparent ? "BLEND" : "OPAQUE",
          doubleSided: material.side === THREE.DoubleSide,
          textureSlots: {
            baseColor: material.map?.name || material.map?.image?.currentSrc || material.map?.image?.src || null,
            normal: material.normalMap?.name || material.normalMap?.image?.currentSrc || material.normalMap?.image?.src || null,
            metallicRoughness: material.metalnessMap?.name || material.roughnessMap?.name || null,
            emissive: material.emissiveMap?.name || material.emissiveMap?.image?.currentSrc || material.emissiveMap?.image?.src || null,
            occlusion: material.aoMap?.name || material.aoMap?.image?.currentSrc || material.aoMap?.image?.src || null
          }
        });
      });
    });
    const textures = Array.from(usageMap.values()).map(entry => {
      const texture = entry.texture;
      const image = texture.image || null;
      return {
        name: texture.name || null,
        reference: image?.currentSrc || image?.src || null,
        mimeType: null,
        width: Number(image?.naturalWidth || image?.videoWidth || image?.width || 0) || null,
        height: Number(image?.naturalHeight || image?.videoHeight || image?.height || 0) || null,
        usageCount: entry.usageCount
      };
    });
    const box = new THREE.Box3().setFromObject(root);
    const bounds = Number.isFinite(box.min.x) && Number.isFinite(box.max.x)
      ? {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z }
      }
      : null;
    return {
      inputPath: input?.sourceUrl || "",
      file: {
        exists: true,
        extension: input?.fileName ? (input.fileName.split(".").pop() || null) : null,
        fileName: input?.fileName || null,
        sizeBytes: null
      },
      kind: resolveModel3dViewerFormat(input?.fileName || "") || "unknown",
      inspected: true,
      parser: "threejs",
      stats: {
        geometry: {
          meshCount: geometryStats.meshCount,
          primitiveCount: geometryStats.primitiveCount,
          vertexCount: geometryStats.vertexCount,
          faceCount: geometryStats.faceCount,
          normalCount: geometryStats.normalCount,
          uvChannelCount: geometryStats.uvChannelCount
        },
        resources: {
          sceneCount: 1,
          nodeCount: Math.max(geometryStats.meshCount, 1),
          materialCount: Math.max(materialFacts.length, materialNames.size),
          textureCount: textures.length,
          animationCount: 0
        },
        bounds,
        materials: materialFacts,
        textures
      },
      warnings: []
    };
  }

  function storeModel3dDerivedInspection(record, viewerTarget, derivedInspection) {
    if (!record?.id || !viewerTarget?.fileName || !derivedInspection) {
      return;
    }
    const variant = viewerTarget.variantLabel === "original"
      ? "original"
      : viewerTarget.variantLabel === "low poly"
        ? "lowpoly"
        : (viewerTarget.variantLabel === "geometry from albedo" ? "albedo" : "merged");
    const cache = state.model3dViewerDerivedInspectionByKey && typeof state.model3dViewerDerivedInspectionByKey === "object"
      ? state.model3dViewerDerivedInspectionByKey
      : (state.model3dViewerDerivedInspectionByKey = {});
    cache[`${record.id}|${variant}`] = derivedInspection;
    renderModel3dViewportStats({
      vertexCount: derivedInspection.stats?.geometry?.vertexCount,
      triangleCount: derivedInspection.stats?.geometry?.faceCount,
      faceCount: derivedInspection.stats?.geometry?.faceCount,
      uvChannelCount: derivedInspection.stats?.geometry?.uvChannelCount,
      materialCount: derivedInspection.stats?.resources?.materialCount,
      textureSizeLabel: formatModel3dTextureSize(derivedInspection.stats?.textures)
    });
  }

  function clearModel3dDerivedInspection(recordId) {
    if (!recordId || !state.model3dViewerDerivedInspectionByKey || typeof state.model3dViewerDerivedInspectionByKey !== "object") {
      renderModel3dViewportStats(null);
      return;
    }
    Object.keys(state.model3dViewerDerivedInspectionByKey).forEach(key => {
      if (key.startsWith(`${recordId}|`)) {
        delete state.model3dViewerDerivedInspectionByKey[key];
      }
    });
    renderModel3dViewportStats(null);
  }

  function setModel3dViewerResourceContext(context) {
    model3dViewer.resourceContext = context || null;
  }

  function getModel3dViewerTransparentTextureUrl() {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnS9E8AAAAASUVORK5CYII=";
  }

  function normalizeModel3dViewerResourcePath(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed || /^blob:|^data:|^\/api\/model3d-file/i.test(trimmed)) {
      return "";
    }
    let resourcePath = trimmed.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    // FileLoader resolves image URLs from a glTF loaded through
    // `/api/model3d-file` to a same-origin `/api/<sidecar>` URL before the
    // LoadingManager sees them. Keep the relative artifact path in that case
    // so it can be served through the model-file endpoint below.
    if (/^https?:/i.test(resourcePath)) {
      try {
        const resolvedUrl = new URL(resourcePath, window.location.origin);
        if (resolvedUrl.origin !== window.location.origin) {
          return "";
        }
        resourcePath = resolvedUrl.pathname;
      } catch {
        return "";
      }
    }
    if (/^[a-z]+:/i.test(resourcePath) || /^[a-z]:\//i.test(resourcePath)) {
      resourcePath = resourcePath.split("/").pop() || "";
    }
    resourcePath = resourcePath.replace(/^(\.\/)+/, "").replace(/^\/+/, "");
    // GLTFLoader resolves a relative sidecar from the API endpoint's `/api/`
    // base before the loading-manager modifier runs. Imported glTF resources
    // live under the model directory, not beneath that endpoint path.
    resourcePath = resourcePath.replace(/^api\//i, "");
    const segments = resourcePath.split("/").map(segment => segment.trim()).filter(Boolean);
    if (!segments.length || segments.some(segment => segment === "." || segment === "..")) {
      return "";
    }
    return segments.join("/");
  }

  function buildModel3dViewerResourceCandidates(rawUrl) {
    const resourcePath = normalizeModel3dViewerResourcePath(rawUrl);
    if (!resourcePath) {
      return [];
    }
    const candidates = [];
    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tga"];
    const pushCandidate = value => {
      const normalized = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
      if (!normalized || normalized === "." || normalized === ".." || candidates.includes(normalized)) {
        return;
      }
      candidates.push(normalized);
    };
    const pushCandidateVariants = value => {
      const normalized = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
      if (!normalized) {
        return;
      }
      pushCandidate(normalized);
      const baseName = normalized.split("/").pop() || "";
      if (/\.[a-z0-9]+$/i.test(baseName)) {
        return;
      }
      imageExtensions.forEach(extension => {
        pushCandidate(normalized + extension);
      });
    };
    const pathSegments = resourcePath.split("/").filter(Boolean);
    const fileName = pathSegments[pathSegments.length - 1] || "";
    const contextFileName = String(model3dViewer.resourceContext?.fileName || "").trim();
    const ancillaryTextureNames = new Set([
      model3dViewer.resourceContext?.sourceImageFileName,
      model3dViewer.resourceContext?.previewImageFileName,
      model3dViewer.resourceContext?.previewGifFileName,
      model3dViewer.resourceContext?.uvMapFileName,
      model3dViewer.resourceContext?.uvMapInpaintFileName,
      model3dViewer.resourceContext?.normalMapFileName,
      ...(Array.isArray(model3dViewer.resourceContext?.multiViewFileNames) ? model3dViewer.resourceContext.multiViewFileNames : [])
    ].map(value => String(value || "").trim().toLowerCase()).filter(Boolean));
    const isFbx = /\.fbx$/i.test(contextFileName);
    const lowerResourcePath = resourcePath.toLowerCase();
    const lowerContextFileName = contextFileName.toLowerCase();
    const lowerFileName = fileName.toLowerCase();
    const shouldPreferEmbeddedTextureFallback = isFbx && (ancillaryTextureNames.has(lowerResourcePath) || ancillaryTextureNames.has(lowerFileName));
    if (shouldPreferEmbeddedTextureFallback && fileName) {
      pushCandidate(`__fbx-texture-fallback__/${fileName}`);
    }
    if (isFbx && lowerResourcePath.includes(".fbm/")) {
      const nestedPath = resourcePath.slice(lowerResourcePath.lastIndexOf(".fbm/") + 5);
      pushCandidateVariants(`textures/${fileName}`);
      pushCandidateVariants(nestedPath);
      pushCandidateVariants(fileName);
    } else if (isFbx && /\.fbm\/?$/i.test(resourcePath)) {
      return [];
    } else if (isFbx && fileName) {
      pushCandidateVariants(`textures/${fileName}`);
    }
    if (isFbx && lowerContextFileName.endsWith(".fbx") && fileName) {
      const fbxBaseName = contextFileName.replace(/\.[^.]+$/, "");
      pushCandidateVariants(`${fbxBaseName}.fbm/${fileName}`);
      pushCandidateVariants(`${fbxBaseName}.fbm/textures/${fileName}`);
    }
    pushCandidateVariants(resourcePath);
    if (fileName && fileName !== resourcePath) {
      pushCandidateVariants(fileName);
    }
    return candidates;
  }

  function resolveModel3dViewerResourceUrl(rawUrl) {
    const url = String(rawUrl || "").trim();
    if (!url || /^blob:|^data:|^\/api\/model3d-file/i.test(url)) {
      return url;
    }
    if (/^https?:/i.test(url)) {
      try {
        const resolvedUrl = new URL(url, window.location.origin);
        if (resolvedUrl.origin !== window.location.origin || resolvedUrl.pathname === "/api/model3d-file") {
          return url;
        }
      } catch {
        return url;
      }
    }
    const context = model3dViewer.resourceContext;
    if (!context?.modelId) {
      return url;
    }
    const resourceCandidates = buildModel3dViewerResourceCandidates(url);
    if (resourceCandidates.length === 0) {
      return getModel3dViewerTransparentTextureUrl();
    }
    return getModel3dFileUrl(context.modelId, resourceCandidates[0]);
  }

  function clearModel3dUploadViewerSource() {
    if (model3dUploadViewerSource.objectUrl) {
      URL.revokeObjectURL(model3dUploadViewerSource.objectUrl);
    }
    model3dUploadViewerSource.fileName = "";
    model3dUploadViewerSource.fileSizeBytes = 0;
    model3dUploadViewerSource.key = "";
    model3dUploadViewerSource.objectUrl = "";
    model3dUploadViewerSource.previewable = false;
  }

  function setModel3dUploadViewerSource(file) {
    clearModel3dUploadViewerSource();
    if (!file) {
      return;
    }
    const fileName = String(file.name || "uploaded-model").trim() || "uploaded-model";
    model3dUploadViewerSource.fileName = fileName;
    model3dUploadViewerSource.fileSizeBytes = Number.isFinite(file.size) ? Math.max(0, Math.round(file.size)) : 0;
    model3dUploadViewerSource.key = [fileName, String(model3dUploadViewerSource.fileSizeBytes), String(Number.isFinite(file.lastModified) ? file.lastModified : 0)].join("|");
    model3dUploadViewerSource.previewable = isModel3dUploadPreviewable(fileName);
    if (model3dUploadViewerSource.previewable) {
      model3dUploadViewerSource.objectUrl = URL.createObjectURL(file);
    }
  }

  function getActiveModel3dUploadViewerSource() {
    if (state.model3dStudioTab !== "edit") {
      return null;
    }
    if (!model3dUploadViewerSource.previewable || !model3dUploadViewerSource.objectUrl) {
      return null;
    }
    return model3dUploadViewerSource;
  }

  function renderModel3dTextureGallery(record) {
    const container = document.getElementById("model3d-texture-gallery");
    if (!container) {
      return;
    }
    clearChildren(container);
    if (!record || !record.id) {
      const empty = document.createElement("div");
      empty.className = "item model3d-texture-empty";
      empty.textContent = "Select a generated model to view texture outputs.";
      container.appendChild(empty);
      return;
    }
    const multiViewFileNames = Array.isArray(record.multiViewFileNames)
      ? record.multiViewFileNames.filter(fileName => typeof fileName === "string" && fileName.trim().length > 0)
      : [];
    const uvMapFileNames = [
      typeof record.uvMapFileName === "string" ? record.uvMapFileName.trim() : "",
      typeof record.uvMapInpaintFileName === "string" ? record.uvMapInpaintFileName.trim() : ""
    ].filter(fileName => fileName.length > 0);
    const normalMapFileNames = [typeof record.normalMapFileName === "string" ? record.normalMapFileName.trim() : ""].filter(fileName => fileName.length > 0);
    const sections = [
      { title: "Multi View", fileNames: multiViewFileNames },
      { title: "UV Maps", fileNames: uvMapFileNames },
      { title: "Normal Maps", fileNames: normalMapFileNames }
    ];
    let hasAnyTexture = false;
    for (const section of sections) {
      if (!Array.isArray(section.fileNames) || section.fileNames.length === 0) {
        continue;
      }
      hasAnyTexture = true;
      const sectionNode = document.createElement("div");
      sectionNode.className = "model3d-texture-section";
      const header = document.createElement("div");
      header.className = "model3d-texture-section-header";
      const title = document.createElement("span");
      title.className = "model3d-texture-section-title";
      title.textContent = section.title;
      const count = document.createElement("span");
      count.className = "model3d-texture-section-count";
      count.textContent = section.fileNames.length + " file" + (section.fileNames.length === 1 ? "" : "s");
      header.appendChild(title);
      header.appendChild(count);
      const grid = document.createElement("div");
      grid.className = "model3d-texture-grid";
      for (const fileName of section.fileNames) {
        const sourceUrl = getModel3dFileUrl(record.id, fileName);
        const card = document.createElement("a");
        card.className = "model3d-texture-card";
        card.href = sourceUrl;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.title = "Open " + fileName;
        const image = document.createElement("img");
        image.className = "model3d-texture-image";
        attachDashboardLazyMedia(image, sourceUrl, false);
        image.alt = fileName;
        image.loading = "lazy";
        const caption = document.createElement("span");
        caption.className = "model3d-texture-caption";
        caption.textContent = fileName;
        card.appendChild(image);
        card.appendChild(caption);
        grid.appendChild(card);
      }
      sectionNode.appendChild(header);
      sectionNode.appendChild(grid);
      container.appendChild(sectionNode);
    }
    if (!hasAnyTexture) {
      const empty = document.createElement("div");
      empty.className = "item model3d-texture-empty";
      empty.textContent = "No multi-view, UV, or normal-map textures were generated for this model.";
      container.appendChild(empty);
    }
  }

  function renderModel3dVariantGallery(record) {
    const container = document.getElementById("model3d-variant-gallery");
    if (!container) {
      return;
    }
    clearChildren(container);
    if (!record || !record.id) {
      const empty = document.createElement("div");
      empty.className = "item model3d-variant-empty";
      empty.textContent = "Select a generated model to view its artifact variants.";
      container.appendChild(empty);
      return;
    }
    const variants = getModel3dRecordVariants(record);
    if (variants.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item model3d-variant-empty";
      empty.textContent = "No model artifacts are available for this entry.";
      container.appendChild(empty);
      return;
    }
    const activeVariant = resolveModel3dThreeVariantForRecord(record);
    for (const variant of variants) {
      const previewUrl = resolveModel3dVariantPreviewUrl(record, variant.key, { preferGif: true }) || resolveModel3dHistoryThumbnailUrl(record, variant.key);
      const card = document.createElement("div");
      card.className = "model3d-variant-card";
      card.classList.toggle("active", variant.key === activeVariant);
      const previewButton = document.createElement("button");
      previewButton.className = "model3d-variant-preview";
      previewButton.type = "button";
      previewButton.title = "Preview " + variant.title.toLowerCase() + " model";
      previewButton.setAttribute("aria-label", "Select 3D model variant " + variant.title);
      const badge = document.createElement("span");
      badge.className = "model3d-variant-badge";
      badge.textContent = variant.badge;
      previewButton.appendChild(badge);
      if (previewUrl) {
        const image = document.createElement("img");
        image.alt = variant.title + " model variant preview";
        image.loading = "lazy";
        image.decoding = "async";
        attachDashboardLazyMedia(image, previewUrl, variant.key === activeVariant);
        previewButton.appendChild(image);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "model3d-variant-preview-fallback";
        fallback.textContent = "3D";
        previewButton.appendChild(fallback);
      }
      previewButton.addEventListener("click", () => {
        selectModel3dVariant(record, variant.key);
      });
      const body = document.createElement("div");
      body.className = "model3d-variant-body";
      const title = document.createElement("strong");
      title.textContent = variant.title;
      const fileName = document.createElement("small");
      fileName.textContent = variant.fileName || variant.hint;
      body.append(title, fileName);
      const actions = document.createElement("div");
      actions.className = "model3d-variant-actions";
      const selectButton = document.createElement("button");
      selectButton.className = "model3d-variant-select";
      selectButton.classList.toggle("active", variant.key === activeVariant);
      selectButton.type = "button";
      selectButton.textContent = variant.key === activeVariant ? "Selected" : "Select";
      selectButton.addEventListener("click", () => {
        selectModel3dVariant(record, variant.key);
      });
      actions.appendChild(selectButton);
      const download = document.createElement("a");
      download.className = "model3d-variant-download";
      download.href = getModel3dFileUrl(record.id, variant.fileName);
      download.target = "_blank";
      download.rel = "noopener noreferrer";
      download.download = variant.fileName || "";
      download.textContent = "Download";
      download.title = "Open " + variant.fileName;
      actions.appendChild(download);
      const remove = document.createElement("button");
      remove.className = "model3d-variant-delete";
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = typeof window.dashboardConfirm === "function"
          && await window.dashboardConfirm({
            title: "Delete Model Variant",
            message: "Delete only the " + variant.title + " variant " + variant.fileName + "?",
            confirmLabel: "Delete Variant",
            variant: "warning"
          });
        if (!confirmed) {
          return;
        }
        const result = await request("/api/model3d-variant-delete", {
          modelId: record.id,
          variant: variant.key === "current" ? "merged" : variant.key,
          fileName: variant.fileName
        });
        invalidateModelInspection(record.id);
        if (!await applyDeletedModel3dVariant(result?.model)) {
          await loadModel3dHistory(record.id);
        }
        const deletedModelEntry = result?.deletedModelEntry === true;
        setModel3dStatus(deletedModelEntry ? "Deleted model entry." : "Deleted " + variant.title + " variant.");
        setOutput(deletedModelEntry ? "Deleted the model entry because " + variant.fileName + " was its only remaining variant." : "Deleted only model variant " + variant.fileName + ".");
      });
      actions.appendChild(remove);
      card.append(previewButton, body, actions);
      container.appendChild(card);
    }
  }

  function getModel3dRecordVariants(record) {
    if (!record) {
      return [];
    }
    const seenFileNames = new Set();
    return [
      { key: "current", title: "Merged", badge: "MRG", hint: "Vertex-merged current artifact", fileName: record.modelFileName },
      { key: "lowpoly", title: "Low Poly", badge: "LOW", hint: "Derived low-poly artifact", fileName: record.lowPolyModelFileName },
      { key: "original", title: "Original", badge: "SRC", hint: "ComfyUI source artifact", fileName: record.originalModelFileName },
      { key: "albedo", title: "Geometry From Albedo", badge: "ALB", hint: "Geometry displaced from albedo brightness", fileName: record.albedoGeometryModelFileName }
    ].filter(variant => {
      const fileName = typeof variant.fileName === "string" ? variant.fileName.trim() : "";
      const fileKey = fileName.toLowerCase();
      if (!fileName || seenFileNames.has(fileKey)) {
        return false;
      }
      seenFileNames.add(fileKey);
      return true;
    });
  }

  function getModel3dVariantRef(modelId, variantKey, fileName) {
    const id = String(modelId || "").trim();
    const fileKey = String(fileName || "").trim();
    return id
      ? encodeURIComponent(id) + "::" + normalizeModel3dThreeVariant(variantKey) + (fileKey ? "::" + encodeURIComponent(fileKey) : "")
      : "";
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

  function findModel3dRecordForVariantRef(ref) {
    if (!Array.isArray(state.generatedModels)) {
      return null;
    }
    const modelId = getModel3dVariantModelIdFromRef(ref);
    const variantKey = getModel3dVariantKeyFromRef(ref);
    const fileName = getModel3dVariantFileNameFromRef(ref).toLowerCase();
    const records = state.generatedModels.filter(item => String(item?.id || "") === modelId);
    if (!fileName) {
      return records[0] || null;
    }
    return records.find(record => getModel3dRecordVariants(record).some(variant => {
      const candidateFileName = String(variant.fileName || "").trim().toLowerCase();
      return variant.key === variantKey && candidateFileName === fileName;
    })) || records[0] || null;
  }

  function decorateModel3dVariantRecord(record, variantKey, fileName) {
    if (!record) {
      return null;
    }
    const normalizedVariant = normalizeModel3dThreeVariant(variantKey);
    const variants = getModel3dRecordVariants(record);
    const normalizedFileName = String(fileName || "").trim().toLowerCase();
    const variant = variants.find(item => {
      const candidateFileName = String(item.fileName || "").trim().toLowerCase();
      return item.key === normalizedVariant && (!normalizedFileName || candidateFileName === normalizedFileName);
    }) || variants.find(item => item.key === normalizedVariant) || variants[0] || null;
    return Object.assign({}, record, {
      __model3dVariantKey: variant?.key || normalizedVariant,
      __model3dVariantRef: getModel3dVariantRef(record.id, variant?.key || normalizedVariant, variant?.fileName || fileName),
      __model3dVariantFileName: variant?.fileName || "",
      __model3dVariantTitle: variant?.title || "Model"
    });
  }

  function getSelectedModel3dVariantRefs() {
    return Array.from(new Set((Array.isArray(state.selectedGeneratedModelVariantRefs) ? state.selectedGeneratedModelVariantRefs : [])
      .map(ref => String(ref || "").trim())
      .filter(Boolean)));
  }

  function getSelectedModel3dVariantModels() {
    if (!Array.isArray(state.generatedModels)) {
      return [];
    }
    return getSelectedModel3dVariantRefs()
      .map(ref => {
        const record = findModel3dRecordForVariantRef(ref);
        return decorateModel3dVariantRecord(record, getModel3dVariantKeyFromRef(ref), getModel3dVariantFileNameFromRef(ref));
      })
      .filter(Boolean);
  }

  function getSelectedModel3dVariantKeyForModel(modelId) {
    const selectedId = String(modelId || "").trim();
    if (!selectedId) {
      return "";
    }
    const ref = getSelectedModel3dVariantRefs().find(item => getModel3dVariantModelIdFromRef(item) === selectedId);
    return ref ? getModel3dVariantKeyFromRef(ref) : "";
  }

  function getModel3dHistoryVariants(record) {
    const variants = getModel3dRecordVariants(record);
    const order = { current: 0, lowpoly: 1, albedo: 2, original: 3 };
    return variants.slice().sort((left, right) => (order[left.key] ?? 99) - (order[right.key] ?? 99));
  }

  function syncModel3dRecordSelectionFromVariantRefs(primaryRef) {
    const selectedRefs = getSelectedModel3dVariantRefs();
    const modelIds = Array.from(new Set(selectedRefs.map(getModel3dVariantModelIdFromRef).filter(Boolean)));
    state.selectedGeneratedModelVariantRefs = selectedRefs;
    state.selectedGeneratedModelIds = modelIds;
    const primaryModelId = getModel3dVariantModelIdFromRef(primaryRef) || modelIds[0] || "";
    state.selectedGeneratedModelId = modelIds.includes(primaryModelId) ? primaryModelId : modelIds[0] || "";
  }

  function getAllModel3dVariantRefs(records) {
    return (Array.isArray(records) ? records : []).flatMap(record => {
      const variants = getModel3dHistoryVariants(record);
      const historyVariants = variants.length > 0 ? variants : [{ key: "current", fileName: record?.modelFileName || record?.originalModelFileName || record?.lowPolyModelFileName || "" }];
      return historyVariants.map(variant => getModel3dVariantRef(record?.id, variant.key, variant.fileName)).filter(Boolean);
    });
  }

  function pruneModel3dVariantSelection() {
    const validRefs = new Set(getAllModel3dVariantRefs(state.generatedModels));
    let selectedRefs = getSelectedModel3dVariantRefs().filter(ref => validRefs.has(ref));
    if (selectedRefs.length === 0) {
      const selectedIds = mediaMultiSelectionHelpers.getSelectedIds("selectedGeneratedModelIds", state.selectedGeneratedModelId);
      selectedRefs = selectedIds.map(id => {
        const record = state.generatedModels.find(item => String(item?.id || "") === id);
        const variantKey = record ? resolveDefaultModel3dThreeVariantForRecord(record) : "";
        const variant = record ? getModel3dRecordVariants(record).find(item => item.key === variantKey) : null;
        return record ? getModel3dVariantRef(id, variantKey, variant?.fileName || "") : "";
      }).filter(ref => validRefs.has(ref));
    }
    state.selectedGeneratedModelVariantRefs = selectedRefs;
    syncModel3dRecordSelectionFromVariantRefs(selectedRefs[0] || "");
  }

  function handleModel3dVariantSelectionClick(inputValue) {
    const variantRef = inputValue?.variantRef || "";
    if (!variantRef) {
      return;
    }
    const event = inputValue?.event || {};
    const visibleRefs = Array.isArray(inputValue?.visibleVariantRefs) ? inputValue.visibleVariantRefs : [];
    const currentRefs = getSelectedModel3dVariantRefs();
    let nextRefs = [variantRef];
    const variantModelId = getModel3dVariantModelIdFromRef(variantRef);
    const anchorRef = state.model3dVariantSelectionAnchorRef || currentRefs[currentRefs.length - 1] || "";
    if (event.ctrlKey || event.metaKey) {
      nextRefs = currentRefs.includes(variantRef) ? currentRefs.filter(ref => ref !== variantRef) : currentRefs.concat(variantRef);
      state.model3dVariantSelectionAnchorRef = variantRef;
    } else if (event.shiftKey && anchorRef && visibleRefs.includes(anchorRef) && visibleRefs.includes(variantRef)) {
      const start = Math.min(visibleRefs.indexOf(anchorRef), visibleRefs.indexOf(variantRef));
      const end = Math.max(visibleRefs.indexOf(anchorRef), visibleRefs.indexOf(variantRef));
      nextRefs = visibleRefs.slice(start, end + 1);
    } else {
      nextRefs = [variantRef];
      state.model3dVariantSelectionAnchorRef = variantRef;
    }
    state.selectedGeneratedModelVariantRefs = Array.from(new Set(nextRefs));
    syncModel3dRecordSelectionFromVariantRefs(variantRef);
    return getSelectedModel3dVariantRefs().includes(variantRef)
      ? variantRef
      : getSelectedModel3dVariantRefs()[0] || "";
  }

  function normalizeModel3dThreeVariant(nextVariant) {
    return nextVariant === "original" || nextVariant === "current" || nextVariant === "albedo" ? nextVariant : "lowpoly";
  }

  function scrollSelectedModel3dHistoryIntoView(modelId, variantKey) {
    const selectedId = String(modelId || state.selectedGeneratedModelId || "").trim();
    if (!selectedId) {
      return;
    }
    window.requestAnimationFrame(() => {
      const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(selectedId) : selectedId.replace(/'/g, "\\'");
      const normalizedVariant = normalizeModel3dThreeVariant(variantKey || state.model3dThreeVariant);
      const escapedVariant = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(normalizedVariant) : normalizedVariant.replace(/'/g, "\\'");
      const row = document.querySelector("#model3d-history-list [data-model-id='" + escapedId + "'][data-model-variant-key='" + escapedVariant + "']")
        || document.querySelector("#model3d-history-list [data-model-id='" + escapedId + "']");
      row?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  }

  function ensureModel3dHistoryEntryVisible(modelId) {
    const selectedId = String(modelId || "").trim();
    if (!selectedId || !Array.isArray(state.generatedModels)) {
      return;
    }
    const index = state.generatedModels.findIndex(item => item.id === selectedId);
    if (index < 0) {
      return;
    }
    const nextLimit = Math.ceil((index + 1) / model3dHistoryInitialRenderLimit) * model3dHistoryInitialRenderLimit;
    state.model3dHistoryVisibleLimit = Math.max(Number.parseInt(state.model3dHistoryVisibleLimit || model3dHistoryInitialRenderLimit, 10) || model3dHistoryInitialRenderLimit, nextLimit);
  }

  function selectModel3dVariant(record, variantKey) {
    const modelId = String(record?.id || "").trim();
    if (!modelId) {
      return;
    }
    ensureModel3dHistoryEntryVisible(modelId);
    state.selectedGeneratedModelId = modelId;
    state.selectedGeneratedModelIds = [modelId];
    state.model3dThreeVariant = normalizeModel3dThreeVariant(variantKey);
    const selectedRecord = state.generatedModels.find(item => String(item?.id || "") === String(modelId || "")) || record;
    const variant = selectedRecord ? getModel3dRecordVariants(selectedRecord).find(item => item.key === normalizeModel3dThreeVariant(state.model3dThreeVariant)) : null;
    state.selectedGeneratedModelVariantRefs = [getModel3dVariantRef(modelId, state.model3dThreeVariant, variant?.fileName || "")];
    state.model3dVariantSelectionAnchorRef = state.selectedGeneratedModelVariantRefs[0] || "";
    updateModel3dThreeVariantUi();
    renderModel3dHistory();
    renderModel3dPreviewMedia();
    updateModel3dEditSelectedModelName();
    scrollSelectedModel3dHistoryIntoView(modelId, state.model3dThreeVariant);
    void activateModel3dViewerPreview();
  }

  function renderModel3dUploadSourceMeta(source) {
    const output = document.getElementById("model3d-meta-output");
    renderModel3dVariantGallery(null);
    renderModel3dTextureGallery(null);
    renderModel3dViewportStats(null);
    renderModel3dSourceImageCard(null);
    if (!output) {
      return;
    }
    if (!source) {
      setModel3dMetaOutput(output, [{ value: "No model selected.", full: true }]);
      return;
    }
    const sizeMb = source.fileSizeBytes > 0 ? (source.fileSizeBytes / (1024 * 1024)).toFixed(2) + " MB" : "unknown";
    setModel3dMetaOutput(output, [
      { key: "Uploaded source model", value: source.fileName || "unknown" },
      { key: "Source type", value: "local uploaded file (Edit tab)" },
      { key: "File size", value: sizeMb },
      { key: "Preview mode", value: "Three.js original mesh" },
      { value: "Tip: Clear file to return preview to the selected generated model.", full: true }
    ]);
  }
  function setModel3dMetaOutput(output, rows) {
    if (!(output instanceof HTMLElement)) {
      return;
    }
    const items = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (items.length === 0) {
      output.textContent = "";
      return;
    }
    output.classList.add("studio-sidebar-meta-output");
    output.dataset.sidebarMetaRaw = items.map(entry => entry.key ? (entry.key + ": " + entry.value) : entry.value).filter(Boolean).join("\n");
    output.dataset.sidebarMetaSignature = "";
    output.innerHTML = "<div class=\"studio-sidebar-meta-grid\">"
      + items.map(entry => {
        if (entry.full) {
          return "<div class=\"studio-sidebar-meta-row is-full\"><span class=\"studio-sidebar-meta-value\">"
            + escapeHtml(entry.value || "")
            + "</span></div>";
        }
        return "<div class=\"studio-sidebar-meta-row\">"
          + "<span class=\"studio-sidebar-meta-key\">" + escapeHtml(entry.key || "") + "</span>"
          + "<span class=\"studio-sidebar-meta-value\">" + escapeHtml(entry.value || "none") + "</span>"
          + "</div>";
      }).join("")
      + "</div>";
  }
  function resolveModel3dSourceImageUrl(record) {
    if (!record?.id) {
      return "";
    }
    const directUrl = String(record.sourceImageUrl || "").trim();
    if (directUrl) {
      return buildAbsoluteDashboardUrl(directUrl);
    }
    const fileName = String(record.sourceImageFileName || "").trim();
    return fileName ? buildAbsoluteDashboardUrl(getModel3dFileUrl(record.id, fileName)) : "";
  }
  function renderModel3dSourceImageCard(record) {
    const image = document.getElementById("model3d-source-image-preview");
    const empty = document.getElementById("model3d-source-image-empty");
    const name = document.getElementById("model3d-source-image-name");
    const sourceImageUrl = resolveModel3dSourceImageUrl(record);
    const fileName = String(record?.sourceImageFileName || "").trim();
    if (image instanceof HTMLImageElement) {
      if (sourceImageUrl) {
        attachDashboardLazyMedia(image, sourceImageUrl);
      } else {
        image.removeAttribute("src");
      }
      image.classList.toggle("hidden", !sourceImageUrl);
    }
    if (empty) {
      empty.classList.toggle("hidden", Boolean(sourceImageUrl));
      empty.textContent = record
        ? "No stored source image was found for this model."
        : "Select a generated model to view its stored source image.";
    }
    if (name) {
      name.textContent = sourceImageUrl ? (fileName || "Stored source image") : "No source image available.";
    }
  }

  function setModel3dStatus(text) {
    if (typeof setStudioStatusPanel === "function") {
      setStudioStatusPanel({
        statusKey: "model3d",
        text,
        currentId: "model3d-status",
        stateId: "model3d-status-state",
        progressTrackId: "model3d-status-progress-track",
        progressFillId: "model3d-status-progress",
        historyId: "model3d-status-history"
      });
      renderModel3dBottomQueue();
      return;
    }
    const node = document.getElementById("model3d-status");
    if (node) {
      node.textContent = text;
    }
    renderModel3dBottomQueue();
  }

  function getModel3dStatusText() {
    if (typeof getStudioStatusCurrentText === "function") {
      return String(getStudioStatusCurrentText("model3d") || "").trim();
    }
    return String(document.getElementById("model3d-status")?.textContent || "").trim();
  }

  function setModel3dPreviewStatus(text) {
    const node = document.getElementById("model3d-viewer-status");
    if (node) {
      node.textContent = text;
    }
  }

  function setModel3dThreeStatus(text) {
    const node = document.getElementById("model3d-threejs-status");
    if (node) {
      node.textContent = text;
    }
  }

  function forEachModel3dMaterial(root, onMaterial) {
    if (!root || typeof root.traverse !== "function" || typeof onMaterial !== "function") {
      return;
    }
    root.traverse(node => {
      if (!node || !node.material) {
        return;
      }
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        if (!material || typeof material !== "object") {
          return;
        }
        onMaterial(material, node);
      });
    });
  }

  function forEachModel3dMesh(root, onMesh) {
    if (!root || typeof root.traverse !== "function" || typeof onMesh !== "function") {
      return;
    }
    let meshIndex = 0;
    root.traverse(node => {
      if (!node || !node.isMesh || !node.geometry) {
        return;
      }
      onMesh(node, meshIndex);
      meshIndex += 1;
    });
  }
  function normalizeModel3dViewerMaterialMode(value) {
    const mode = String(value || "").trim();
    return ["textured", "material", "clay", "normal"].includes(mode) ? mode : "textured";
  }

  const model3dViewerResourceDisposal = createDashboardThreeDViewerResourceDisposalHelpers({
    viewer: model3dViewer,
    forEachMesh: forEachModel3dMesh,
    forEachMaterial: forEachModel3dMaterial,
    setStatus: setModel3dThreeStatus,
    cancelAnimation: cancelModel3dViewerAnimationFrame
  });
  const {
    disposeOverrideMaterial: disposeModel3dOverrideMaterial,
    disposeRootResources: disposeModel3dRootResources,
    disposeViewerRoot: disposeModel3dViewerRoot,
    removeRigHelper: removeModel3dRigHelper,
    resetMaterialCaches: resetModel3dViewerMaterialCaches,
    restoreMeshGeometry: restoreModel3dMeshGeometry,
    restoreMeshMaterial: restoreModel3dMeshMaterial,
    unloadPreview: unloadModel3dViewerPreview
  } = model3dViewerResourceDisposal;
  const model3dViewerModelLifecycle = createDashboardThreeDViewerModelLifecycleHelpers({
    viewer: model3dViewer,
    disposeRootResources: disposeModel3dRootResources,
    removeRigHelper: removeModel3dRigHelper,
    resetMaterialCaches: resetModel3dViewerMaterialCaches,
    resolveRoot: resolveModel3dViewerRoot
  });
  const {
    beginLoad: beginModel3dViewerLoad,
    clearLoadedIdentity: clearModel3dViewerLoadedIdentity,
    discardIfStale: discardStaleModel3dViewerLoad,
    replaceRoot: replaceModel3dViewerRoot
  } = model3dViewerModelLifecycle;

  async function activateModel3dViewerPreview() {
    model3dViewer.previewActive = true;
    await renderModel3dViewer();
  }

  function handleModel3dLowPolyUploadSourceChange(file) {
    setModel3dUploadViewerSource(file);
    if (!file) {
      void renderModel3dViewer();
      return;
    }
    if (!model3dUploadViewerSource.previewable) {
      setModel3dThreeStatus("Uploaded preview supports .glb, .gltf, .fbx, and .obj files. Selected: " + model3dUploadViewerSource.fileName + ".");
      return;
    }
    void renderModel3dViewer();
  }

  function renderModel3dMeta(record) {
    const output = document.getElementById("model3d-meta-output");
    if (!output) {
      return;
    }
    renderModel3dVariantGallery(record);
    renderModel3dTextureGallery(record);
    renderModel3dSourceImageCard(record);
    if (!record) {
      renderModel3dViewportStats(null);
      renderModel3dInspection(null, null);
      setModel3dMetaOutput(output, [{ value: "No model selected.", full: true }]);
      return;
    }
    setModel3dMetaOutput(output, [
      { key: "Model ID", value: record.id || "unknown" },
      { key: "Generated", value: formatDateTime(record.createdAt) },
      { key: "Generation duration", value: formatModel3dGenerationDuration(record.generationDurationSeconds || record.generationDurationMs) },
      { key: "Source image", value: record.sourceImageFileName || "none" },
      { key: "Merged/current file", value: record.modelFileName || "none" },
      { key: "Original file", value: record.originalModelFileName || "none" },
      { key: "Low Poly file", value: record.lowPolyModelFileName || "none" },
      { key: "Low Poly target faces", value: record.lowPolyTargetFaceCount || "unknown" },
      { key: "Description", value: record.description || "(none)" },
      { key: "Prompt", value: record.prompt || "(none)" },
      { key: "Multi-view images", value: record.multiViewFileNames.length > 0 ? record.multiViewFileNames.join(", ") : "none" },
      { key: "UV map", value: record.uvMapFileName || "none" },
      { key: "UV map (in-painted)", value: record.uvMapInpaintFileName || "none" },
      { key: "Normal map", value: record.normalMapFileName || "none" }
    ]);
    void inspectSelectedModel({ record }).catch(() => {});
  }

  function formatModel3dGenerationDuration(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "unknown";
    }
    const seconds = numeric > 1000 ? numeric / 1000 : numeric;
    return seconds >= 10 ? seconds.toFixed(1) + "s" : seconds.toFixed(2) + "s";
  }

  function model3dHasFileName(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function shouldPreferOriginalModel3dPreview(record) {
    const currentFileName = typeof record?.modelFileName === "string" ? record.modelFileName.trim() : "";
    const originalFileName = typeof record?.originalModelFileName === "string" ? record.originalModelFileName.trim() : "";
    return /\.fbx$/i.test(currentFileName) && /\.(glb|gltf)$/i.test(originalFileName);
  }

  function resolveDefaultModel3dThreeVariantForRecord(record) {
    const lowPolyFileName = typeof record?.lowPolyModelFileName === "string" ? record.lowPolyModelFileName.trim() : "";
    const albedoFileName = typeof record?.albedoGeometryModelFileName === "string" ? record.albedoGeometryModelFileName.trim() : "";
    const currentFileName = typeof record?.modelFileName === "string" ? record.modelFileName.trim() : "";
    const originalFileName = typeof record?.originalModelFileName === "string" ? record.originalModelFileName.trim() : "";
    if (originalFileName && shouldPreferOriginalModel3dPreview(record)) return "original";
    if (currentFileName) return "current";
    if (originalFileName) return "original";
    if (lowPolyFileName) return "lowpoly";
    return "current";
  }

  function resolveModel3dThreeVariantForRecord(record) {
    const lowPolyFileName = typeof record?.lowPolyModelFileName === "string" ? record.lowPolyModelFileName.trim() : "";
    const albedoFileName = typeof record?.albedoGeometryModelFileName === "string" ? record.albedoGeometryModelFileName.trim() : "";
    const currentFileName = typeof record?.modelFileName === "string" ? record.modelFileName.trim() : "";
    const originalFileName = typeof record?.originalModelFileName === "string" ? record.originalModelFileName.trim() : "";
    const hasLowPoly = model3dHasFileName(lowPolyFileName);
    const hasAlbedo = model3dHasFileName(albedoFileName);
    const hasCurrent = model3dHasFileName(currentFileName);
    const hasOriginal = model3dHasFileName(originalFileName);
    if (state.model3dThreeVariant === "original" && hasOriginal) return "original";
    if (state.model3dThreeVariant === "current" && hasCurrent) return "current";
    if (state.model3dThreeVariant === "lowpoly" && hasLowPoly) return "lowpoly";
    if (state.model3dThreeVariant === "albedo" && hasAlbedo) return "albedo";
    if (hasOriginal && shouldPreferOriginalModel3dPreview(record)) return "original";
    if (hasCurrent) return "current";
    if (hasOriginal) return "original";
    if (hasLowPoly) return "lowpoly";
    if (hasAlbedo) return "albedo";
    return "current";
  }

  function updateModel3dThreeVariantUi() {
    const lowPolyButton = document.getElementById("model3d-three-variant-lowpoly");
    const albedoButton = document.getElementById("model3d-three-variant-albedo");
    const currentButton = document.getElementById("model3d-three-variant-current");
    const originalButton = document.getElementById("model3d-three-variant-original");
    if (!lowPolyButton || !albedoButton || !currentButton || !originalButton) {
      return;
    }
    const activeUploadSource = getActiveModel3dUploadViewerSource();
    if (activeUploadSource) {
      state.model3dThreeVariant = "original";
      lowPolyButton.disabled = true;
      albedoButton.disabled = true;
      currentButton.disabled = true;
      originalButton.disabled = false;
      lowPolyButton.classList.remove("active");
      albedoButton.classList.remove("active");
      currentButton.classList.remove("active");
      originalButton.classList.add("active");
      lowPolyButton.title = "Low poly variant is unavailable for uploaded source preview.";
      albedoButton.title = "Geometry from albedo variant is unavailable for uploaded source preview.";
      currentButton.title = "Merged variant is unavailable for uploaded source preview.";
      originalButton.title = "Preview uploaded source model in Three.js viewer";
      return;
    }
    const selected = getSelectedGeneratedModel();
    const hasLowPoly = model3dHasFileName(selected?.lowPolyModelFileName);
    const hasAlbedo = model3dHasFileName(selected?.albedoGeometryModelFileName);
    const hasCurrent = model3dHasFileName(selected?.modelFileName);
    const hasOriginal = model3dHasFileName(selected?.originalModelFileName);
    const effectiveVariant = resolveModel3dThreeVariantForRecord(selected);
    if (effectiveVariant !== state.model3dThreeVariant) {
      state.model3dThreeVariant = effectiveVariant;
    }
    lowPolyButton.disabled = !hasLowPoly;
    albedoButton.disabled = !hasAlbedo;
    currentButton.disabled = !hasCurrent;
    originalButton.disabled = !hasOriginal;
    lowPolyButton.classList.toggle("active", effectiveVariant === "lowpoly");
    albedoButton.classList.toggle("active", effectiveVariant === "albedo");
    currentButton.classList.toggle("active", effectiveVariant === "current");
    originalButton.classList.toggle("active", effectiveVariant === "original");
    lowPolyButton.title = hasLowPoly ? "Preview low poly model in Three.js viewer" : "Low poly model is not available for this entry";
    albedoButton.title = hasAlbedo ? "Preview geometry generated from albedo" : "Geometry from albedo is not available for this entry";
    currentButton.title = hasCurrent ? "Preview merged current model in Three.js viewer" : "Merged current model is not available for this entry";
    originalButton.title = hasOriginal ? "Preview original model in Three.js viewer" : "Original model is not available for this entry";
  }

  function setModel3dThreeVariant(nextVariant) {
    const normalized = nextVariant === "original" || nextVariant === "current" || nextVariant === "albedo" ? nextVariant : "lowpoly";
    if (state.model3dThreeVariant === normalized) {
      updateModel3dThreeVariantUi();
      renderModel3dVariantGallery(getSelectedGeneratedModel());
      return;
    }
    state.model3dThreeVariant = normalized;
    updateModel3dThreeVariantUi();
    renderModel3dVariantGallery(getSelectedGeneratedModel());
    void renderModel3dViewer();
  }

  function updateModel3dViewerRoughnessUi() {
    const slider = document.getElementById("model3d-three-roughness-slider");
    const label = document.getElementById("model3d-three-roughness-value");
    const value = Number.isFinite(state.model3dViewerRoughness) ? Math.max(0, Math.min(1, state.model3dViewerRoughness)) : 0.5;
    if (slider) {
      slider.value = value.toFixed(2);
    }
    document.querySelectorAll("[data-model3d-roughness-slider]").forEach(node => {
      node.value = value.toFixed(2);
    });
    if (label) {
      label.textContent = value.toFixed(2);
    }
    document.querySelectorAll("[data-model3d-roughness-value]").forEach(node => {
      node.textContent = value.toFixed(2);
    });
  }

  function updateModel3dViewerSceneHelperOptions() {
    const helpers = model3dViewer.sceneHelpers || {};
    const grid = helpers.grid;
    const axis = helpers.axis;
    const axisMode = state.model3dViewerAxisMode === "blender" ? "blender" : "gameengine";
    const gridEnabled = state.model3dViewerGridEnabled === true;
    if (grid) {
      grid.visible = gridEnabled;
      grid.rotation.set(axisMode === "blender" ? Math.PI / 2 : 0, 0, 0);
      grid.position.set(0, axisMode === "blender" ? 0 : -0.002, axisMode === "blender" ? -0.002 : 0);
    }
    if (axis) {
      axis.visible = true;
      axis.rotation.set(axisMode === "blender" ? Math.PI / 2 : 0, 0, 0);
    }
    const gridToggle = document.getElementById("model3d-grid-toggle");
    if (gridToggle) {
      gridToggle.checked = gridEnabled;
    }
    const blenderButton = document.getElementById("model3d-three-axis-blender-button");
    const gameButton = document.getElementById("model3d-three-axis-gameengine-button");
    if (blenderButton) {
      blenderButton.classList.toggle("active", axisMode === "blender");
      blenderButton.setAttribute("aria-pressed", axisMode === "blender" ? "true" : "false");
    }
    if (gameButton) {
      gameButton.classList.toggle("active", axisMode === "gameengine");
      gameButton.setAttribute("aria-pressed", axisMode === "gameengine" ? "true" : "false");
    }
    document.querySelectorAll('[data-model3d-viewer-toggle="skybox"]').forEach(button => {
      const enabled = state.model3dViewerSkyboxEnabled === true;
      button.classList.toggle("active", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    });
    if (model3dViewer.renderer && model3dViewer.scene && model3dViewer.camera) {
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
    }
  }

  function updateModel3dSceneHelpers(maxSizeInput) {
    if (!model3dViewer.sceneHelpers) {
      return;
    }
    const sceneSize = Math.max(0.5, Number(maxSizeInput) || 1);
    const axisScale = Math.max(0.75, Math.min(4.5, sceneSize * 0.55));
    const gridScale = Math.max(0.8, Math.min(5.2, sceneSize * 0.58));
    const axis = model3dViewer.sceneHelpers.axis;
    const grid = model3dViewer.sceneHelpers.grid;
    if (axis) {
      axis.scale.setScalar(axisScale);
      axis.position.set(0, 0, 0);
    }
    if (grid) {
      grid.scale.setScalar(gridScale);
      grid.position.y = -0.002;
    }
    updateModel3dViewerSceneHelperOptions();
  }

  function updateModel3dViewerMaterialToggleButtons() {
    const wireframeButton = document.getElementById("model3d-three-wireframe-button");
    const metallicButton = document.getElementById("model3d-three-metallic-button");
    const textureButton = document.getElementById("model3d-three-texture-button");
    const flatShadingButton = document.getElementById("model3d-three-flat-shading-button");
    const shadeFlatButton = document.getElementById("model3d-three-shade-flat");
    const shadeSmoothButton = document.getElementById("model3d-three-shade-smooth");
    const materialMode = normalizeModel3dViewerMaterialMode(state.model3dViewerMaterialMode);
    const setButtonLabel = (button, enabled, onLabel, offLabel) => {
      if (!button) {
        return;
      }
      const textNode = button.querySelector("span:last-child");
      if (textNode) {
        textNode.textContent = enabled ? onLabel : offLabel;
      }
    };
    if (wireframeButton) {
      const enabled = state.model3dViewerWireframeEnabled === true;
      wireframeButton.classList.toggle("active", enabled);
      setButtonLabel(wireframeButton, enabled, "Wire On", "Wire Off");
      wireframeButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    document.querySelectorAll('[data-model3d-viewer-toggle="wireframe"]').forEach(button => {
      const enabled = state.model3dViewerWireframeEnabled === true;
      button.classList.toggle("active", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    });
    if (metallicButton) {
      const enabled = state.model3dViewerMetallicEnabled !== false;
      metallicButton.classList.toggle("active", enabled);
      setButtonLabel(metallicButton, enabled, "Metallic On", "Metallic Off");
      metallicButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    document.querySelectorAll('[data-model3d-viewer-toggle="metallic"]').forEach(button => {
      const enabled = state.model3dViewerMetallicEnabled !== false;
      button.classList.toggle("active", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    });
    if (textureButton) {
      const enabled = state.model3dViewerTextureEnabled !== false;
      textureButton.classList.toggle("active", enabled);
      setButtonLabel(textureButton, enabled, "Texture On", "Texture Off");
      textureButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    document.querySelectorAll("[data-model3d-material-mode]").forEach(button => {
      const active = String(button.getAttribute("data-model3d-material-mode") || "") === materialMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (flatShadingButton) {
      const enabled = state.model3dViewerFlatShadingEnabled === true;
      flatShadingButton.classList.toggle("active", enabled);
      setButtonLabel(flatShadingButton, enabled, "Flat On", "Flat Off");
      flatShadingButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    document.querySelectorAll('[data-model3d-viewer-toggle="flat"]').forEach(button => {
      const enabled = state.model3dViewerFlatShadingEnabled === true;
      button.classList.toggle("active", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    });
    document.querySelectorAll('[data-model3d-viewer-toggle="skybox"]').forEach(button => {
      const enabled = state.model3dViewerSkyboxEnabled === true;
      button.classList.toggle("active", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    });
    if (shadeFlatButton) {
      const enabled = state.model3dViewerFlatShadingEnabled === true;
      shadeFlatButton.classList.toggle("active", enabled);
      shadeFlatButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    if (shadeSmoothButton) {
      const enabled = state.model3dViewerFlatShadingEnabled !== true;
      shadeSmoothButton.classList.toggle("active", enabled);
      shadeSmoothButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    updateModel3dViewerRoughnessUi();
  }

  function updateModel3dRigHelper() {
    const rigToggle = document.getElementById("model3d-rig-toggle");
    if (rigToggle) {
      rigToggle.checked = state.model3dViewerRigVisible === true;
    }
    removeModel3dRigHelper();
    if (!(state.model3dViewerRigVisible === true) || !model3dViewer.root || !model3dViewer.scene || !window.DiscrodThree?.THREE) {
      return;
    }
    let hasBones = false;
    if (typeof model3dViewer.root.traverse === "function") {
      model3dViewer.root.traverse(node => {
        if (node?.isBone || (node?.isSkinnedMesh && node.skeleton?.bones?.length > 0)) {
          hasBones = true;
        }
      });
    }
    if (!hasBones) {
      return;
    }
    const THREE = window.DiscrodThree.THREE;
    model3dViewer.rigHelper = new THREE.SkeletonHelper(model3dViewer.root);
    model3dViewer.rigHelper.name = "Model3D_Rig_Helper";
    model3dViewer.rigHelper.visible = true;
    model3dViewer.rigHelper.material.depthTest = false;
    model3dViewer.rigHelper.material.transparent = true;
    model3dViewer.rigHelper.material.opacity = 0.95;
    model3dViewer.rigHelper.renderOrder = 50;
    model3dViewer.scene.add(model3dViewer.rigHelper);
  }

  function applyModel3dViewerLightingProfile() {
    if (!model3dViewer.lightRig) {
      return;
    }
    const rig = model3dViewer.lightRig;
    rig.ambient.intensity = rig.defaultAmbientIntensity;
    rig.hemisphere.intensity = rig.defaultHemisphereIntensity;
    rig.key.intensity = rig.defaultKeyIntensity;
    rig.fill.intensity = rig.defaultFillIntensity;
    rig.rim.intensity = rig.defaultRimIntensity;
  }

  function applyModel3dViewerGeometryShading() {
    const flatShadingEnabled = state.model3dViewerFlatShadingEnabled === true;
    forEachModel3dMesh(model3dViewer.root, mesh => {
      if (!model3dViewer.meshGeometryDefaults.has(mesh)) {
        model3dViewer.meshGeometryDefaults.set(mesh, mesh.geometry);
      }
      const originalGeometry = restoreModel3dMeshGeometry(mesh);
      if (flatShadingEnabled && originalGeometry && typeof originalGeometry.toNonIndexed === "function") {
        const flatGeometry = originalGeometry.index ? originalGeometry.toNonIndexed() : originalGeometry.clone();
        if (flatGeometry.attributes?.normal && typeof flatGeometry.deleteAttribute === "function") {
          flatGeometry.deleteAttribute("normal");
        }
        if (typeof flatGeometry.computeVertexNormals === "function") {
          flatGeometry.computeVertexNormals();
        }
        mesh.geometry = flatGeometry;
        return;
      }
      if (!flatShadingEnabled && mesh.geometry && typeof mesh.geometry.computeVertexNormals === "function") {
        mesh.geometry.computeVertexNormals();
        if (mesh.geometry.attributes?.normal) {
          mesh.geometry.attributes.normal.needsUpdate = true;
        }
      }
    });
  }

  function getModel3dMaterialDefaults(material) {
    const existing = model3dViewer.materialDefaults.get(material);
    if (existing) {
      return existing;
    }
    const textureKeys = ["map", "alphaMap", "aoMap", "bumpMap", "displacementMap", "emissiveMap", "lightMap", "metalnessMap", "normalMap", "roughnessMap"];
    const defaults = {
      textures: {},
      metalness: typeof material.metalness === "number" ? material.metalness : null,
      roughness: typeof material.roughness === "number" ? material.roughness : null,
      envMapIntensity: typeof material.envMapIntensity === "number" ? material.envMapIntensity : null,
      flatShading: material.flatShading === true
    };
    textureKeys.forEach(key => {
      if (key in material) {
        defaults.textures[key] = material[key] || null;
      }
    });
    model3dViewer.materialDefaults.set(material, defaults);
    return defaults;
  }
  function createModel3dViewportOverrideMaterial(THREE, mode, options) {
    const roughness = typeof options?.roughness === "number" ? options.roughness : 0.5;
    const wireframe = options?.wireframe === true;
    const flatShading = options?.flatShading === true;
    if (mode === "normal" && THREE.MeshNormalMaterial) {
      const material = new THREE.MeshNormalMaterial({ flatShading, wireframe });
      material.userData.model3dViewportOverride = true;
      return material;
    }
    const material = new THREE.MeshStandardMaterial({
      color: mode === "clay" ? 0xb8b1a6 : 0xd8d1c4,
      metalness: 0,
      roughness,
      flatShading,
      wireframe
    });
    material.userData.model3dViewportOverride = true;
    return material;
  }
  function isModel3dPbrControllableMaterial(material) {
    return Boolean(material && typeof material === "object" && "metalness" in material && "roughness" in material);
  }
  function repairLoosePartsPreviewMaterials(root, fileName, options) {
    loosePartsPreviewHelpers.repair(root, fileName, { forEachModel3dMesh }, options);
  }
  function createModel3dStandardPreviewMaterial(THREE, originalMaterial, options) {
    if (!THREE?.MeshStandardMaterial) {
      return originalMaterial;
    }
    const textureEnabled = options?.textureEnabled !== false;
    const flatShading = options?.flatShading === true;
    const material = new THREE.MeshStandardMaterial({
      color: originalMaterial?.color && typeof originalMaterial.color.clone === "function" ? originalMaterial.color.clone() : 0xd8d1c4,
      map: textureEnabled ? originalMaterial?.map || null : null,
      alphaMap: textureEnabled ? originalMaterial?.alphaMap || null : null,
      normalMap: textureEnabled && !flatShading ? originalMaterial?.normalMap || null : null,
      transparent: originalMaterial?.transparent === true,
      opacity: typeof originalMaterial?.opacity === "number" ? originalMaterial.opacity : 1,
      side: originalMaterial?.side,
      metalness: options?.metallic === false ? 0 : 1,
      roughness: typeof options?.roughness === "number" ? options.roughness : 0.5,
      flatShading,
      wireframe: options?.wireframe === true
    });
    material.userData.model3dViewportOverride = true;
    return material;
  }
  function createModel3dFlatMaterialOverride(originalMaterial, options) {
    const THREE = window.DiscrodThree?.THREE;
    if (options?.flatShading === true && THREE?.MeshStandardMaterial) {
      return createModel3dStandardPreviewMaterial(THREE, originalMaterial, options);
    }
    const material = isModel3dPbrControllableMaterial(originalMaterial) && typeof originalMaterial.clone === "function"
      ? originalMaterial.clone()
      : createModel3dStandardPreviewMaterial(THREE, originalMaterial, options);
    if (!material || typeof material !== "object") {
      return material;
    }
    material.userData = {
      ...(material.userData || {}),
      model3dViewportOverride: true
    };
    if ("flatShading" in material) {
      material.flatShading = true;
    }
    if ("wireframe" in material) {
      material.wireframe = options?.wireframe === true;
    }
    if ("metalness" in material && options?.metallic === false) {
      material.metalness = 0;
    } else if ("metalness" in material) {
      material.metalness = 1;
    }
    if ("roughness" in material && typeof options?.roughness === "number") {
      material.roughness = options.roughness;
    }
    ["metalnessMap", "roughnessMap", "normalMap", "bumpMap", "displacementMap"].forEach(key => {
      if (key in material && (key === "metalnessMap" || key === "roughnessMap" || options?.flatShading === true)) {
        material[key] = null;
      }
    });
    material.needsUpdate = true;
    return material;
  }
  function applyModel3dViewerMaterialMode(mode) {
    const THREE = window.DiscrodThree?.THREE;
    const normalized = normalizeModel3dViewerMaterialMode(mode);
    const flatShadingEnabled = state.model3dViewerFlatShadingEnabled === true;
    const materialOptions = {
      roughness: Number.isFinite(state.model3dViewerRoughness) ? Math.max(0, Math.min(1, state.model3dViewerRoughness)) : 0.5,
      wireframe: state.model3dViewerWireframeEnabled === true,
      flatShading: flatShadingEnabled,
      metallic: state.model3dViewerMetallicEnabled !== false,
      textureEnabled: state.model3dViewerTextureEnabled !== false && normalized === "textured"
    };
    forEachModel3dMesh(model3dViewer.root, mesh => {
      const originalMaterial = restoreModel3dMeshMaterial(mesh);
      if (!model3dViewer.meshMaterialDefaults.has(mesh) && originalMaterial) {
        model3dViewer.meshMaterialDefaults.set(mesh, originalMaterial);
      }
      if (normalized === "textured" || normalized === "material") {
        const originalMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
        const needsPreviewOverride = flatShadingEnabled || originalMaterials.some(material => !isModel3dPbrControllableMaterial(material));
        if (needsPreviewOverride) {
          const createOverride = material => createModel3dFlatMaterialOverride(material, materialOptions);
          mesh.material = Array.isArray(originalMaterial) ? originalMaterial.map(createOverride) : createOverride(originalMaterial);
        }
        return;
      }
      if (!THREE) {
        return;
      }
      const createOverride = () => createModel3dViewportOverrideMaterial(THREE, normalized, materialOptions);
      mesh.material = Array.isArray(originalMaterial) ? originalMaterial.map(createOverride) : createOverride();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(material => {
          material.userData.model3dViewportOverride = true;
        });
      }
    });
  }

  function updateModel3dViewerLightRig(cameraOverride) {
    const camera = cameraOverride || model3dViewer.camera;
    if (!model3dViewer.lightRig || !camera) {
      return;
    }
    const rig = model3dViewer.lightRig;
    const focusTarget = model3dViewer.controls && model3dViewer.controls.target
      ? model3dViewer.controls.target
      : new rig.THREE.Vector3(0, 0, 0);
    const keyOffset = rig.keyOffset.clone().applyQuaternion(camera.quaternion);
    const fillOffset = rig.fillOffset.clone().applyQuaternion(camera.quaternion);
    const rimOffset = rig.rimOffset.clone().applyQuaternion(camera.quaternion);
    rig.key.position.copy(camera.position).add(keyOffset);
    rig.fill.position.copy(camera.position).add(fillOffset);
    rig.rim.position.copy(camera.position).add(rimOffset);
    rig.keyTarget.position.copy(focusTarget);
    rig.fillTarget.position.copy(focusTarget);
    rig.rimTarget.position.copy(focusTarget);
  }

  async function loadModel3dViewerSkyboxTexture() {
    if (model3dViewer.skyboxTexture) {
      return model3dViewer.skyboxTexture;
    }
    if (model3dViewer.skyboxLoadingPromise) {
      return await model3dViewer.skyboxLoadingPromise;
    }
    const three = await waitForThreeLibrary(12_000);
    const THREE = three.THREE;
    const RGBELoader = three.RGBELoader;
    if (!RGBELoader) {
      throw new Error("Three.js RGBE loader is not available.");
    }
    model3dViewer.skyboxLoadingPromise = new Promise((resolve, reject) => {
      new RGBELoader().load(
        model3dDefaultSkyboxUrl,
        texture => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          model3dViewer.skyboxTexture = texture;
          model3dViewer.skyboxLoadingPromise = null;
          resolve(texture);
        },
        undefined,
        error => {
          model3dViewer.skyboxLoadingPromise = null;
          reject(error instanceof Error ? error : new Error("Skybox failed to load."));
        }
      );
    });
    return await model3dViewer.skyboxLoadingPromise;
  }

  async function applyModel3dViewerSkybox() {
    updateModel3dViewerMaterialToggleButtons();
    if (!model3dViewer.scene || !model3dViewer.renderer || !window.DiscrodThree?.THREE) {
      return;
    }
    const THREE = window.DiscrodThree.THREE;
    if (state.model3dViewerSkyboxEnabled !== true) {
      const sceneColor = getModel3dThemeSceneColor();
      model3dViewer.scene.background = model3dViewer.defaultBackground || new THREE.Color(sceneColor);
      model3dViewer.scene.environment = model3dViewer.defaultEnvironment || null;
      if (model3dViewer.renderer) model3dViewer.renderer.setClearColor(sceneColor, 1);
      if (model3dViewer.renderer && model3dViewer.camera) {
        model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
      }
      return;
    }
    setModel3dThreeStatus("Loading Poly Haven skybox...");
    try {
      const texture = await loadModel3dViewerSkyboxTexture();
      if (state.model3dViewerSkyboxEnabled !== true) {
        return;
      }
      model3dViewer.scene.background = texture;
      if (!model3dViewer.skyboxEnvironmentTexture && typeof THREE.PMREMGenerator === "function") {
        const pmrem = new THREE.PMREMGenerator(model3dViewer.renderer);
        model3dViewer.skyboxEnvironmentTexture = pmrem.fromEquirectangular(texture).texture;
        pmrem.dispose();
      }
      model3dViewer.scene.environment = model3dViewer.skyboxEnvironmentTexture || texture;
      updateModel3dViewerLightRig();
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
      setModel3dThreeStatus("Skybox enabled: Poly Haven Kloppenheim 06 Pure Sky.");
    } catch (error) {
      state.model3dViewerSkyboxEnabled = false;
      updateModel3dViewerMaterialToggleButtons();
      setModel3dThreeStatus("Skybox failed to load: " + ((error && error.message) || "Unknown error"));
    }
  }

  function applyModel3dViewerMaterialOptions() {
    updateModel3dViewerMaterialToggleButtons();
    if (!model3dViewer.root) {
      return;
    }
    const wireframeEnabled = state.model3dViewerWireframeEnabled === true;
    const metallicEnabled = state.model3dViewerMetallicEnabled !== false;
    const materialMode = normalizeModel3dViewerMaterialMode(state.model3dViewerMaterialMode);
    const textureEnabled = state.model3dViewerTextureEnabled !== false && materialMode === "textured";
    const flatShadingEnabled = state.model3dViewerFlatShadingEnabled === true;
    const roughnessOverride = Number.isFinite(state.model3dViewerRoughness) ? Math.max(0, Math.min(1, state.model3dViewerRoughness)) : 0.5;
    applyModel3dViewerLightingProfile();
    applyModel3dViewerGeometryShading();
    applyModel3dViewerMaterialMode(materialMode);
    updateModel3dRigHelper();
    forEachModel3dMaterial(model3dViewer.root, material => {
      const defaults = getModel3dMaterialDefaults(material);
      if ("wireframe" in material) {
        material.wireframe = wireframeEnabled;
      }
      if ("flatShading" in material) {
        material.flatShading = flatShadingEnabled ? true : defaults.flatShading === true;
      }
      ["normalMap", "bumpMap", "displacementMap"].forEach(key => {
        if (flatShadingEnabled && key in material) {
          material[key] = null;
        }
      });
      if (defaults && defaults.textures) {
        Object.entries(defaults.textures).forEach(([key, value]) => {
          if (key in material) {
            if (flatShadingEnabled && (key === "normalMap" || key === "bumpMap" || key === "displacementMap")) {
              return;
            }
            material[key] = textureEnabled ? value : null;
          }
        });
      }
      if ("metalnessMap" in material) {
        material.metalnessMap = null;
      }
      if ("roughnessMap" in material) {
        material.roughnessMap = null;
      }
      if (typeof defaults.metalness === "number" && "metalness" in material) {
        material.metalness = metallicEnabled ? Math.max(defaults.metalness, 1) : defaults.metalness;
      }
      if (typeof defaults.roughness === "number" && "roughness" in material) {
        material.roughness = roughnessOverride;
      }
      if (typeof defaults.envMapIntensity === "number" && "envMapIntensity" in material) {
        material.envMapIntensity = metallicEnabled ? Math.max(defaults.envMapIntensity, 1) : 0.15;
      }
      material.needsUpdate = true;
    });
    repairLoosePartsPreviewMaterials(model3dViewer.root, model3dViewer.loadedModelFileName || model3dViewer.resourceContext?.fileName || "", { materialMode });
    if (model3dViewer.renderer && model3dViewer.scene && model3dViewer.camera) {
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
    }
  }

  function setModel3dViewerWireframeEnabled(enabled) {
    state.model3dViewerWireframeEnabled = enabled === true;
    applyModel3dViewerMaterialOptions();
  }

  function setModel3dViewerMetallicEnabled(enabled) {
    state.model3dViewerMetallicEnabled = enabled !== false;
    applyModel3dViewerMaterialOptions();
  }

  function setModel3dViewerRoughness(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
    state.model3dViewerRoughness = normalized;
    updateModel3dViewerRoughnessUi();
    applyModel3dViewerMaterialOptions();
  }

  function setModel3dViewerTextureEnabled(enabled) {
    state.model3dViewerTextureEnabled = enabled !== false;
    state.model3dViewerMaterialMode = state.model3dViewerTextureEnabled === false ? "material" : "textured";
    applyModel3dViewerMaterialOptions();
  }
  function setModel3dViewerMaterialMode(mode) {
    const normalized = normalizeModel3dViewerMaterialMode(mode);
    state.model3dViewerMaterialMode = normalized;
    state.model3dViewerTextureEnabled = normalized === "textured";
    applyModel3dViewerMaterialOptions();
  }

  function setModel3dViewerFlatShadingEnabled(enabled) {
    state.model3dViewerFlatShadingEnabled = enabled === true;
    applyModel3dViewerMaterialOptions();
  }

  function setModel3dViewerGridEnabled(enabled) {
    state.model3dViewerGridEnabled = enabled === true;
    updateModel3dViewerSceneHelperOptions();
  }

  function setModel3dViewerSkyboxEnabled(enabled) {
    state.model3dViewerSkyboxEnabled = enabled === true;
    void applyModel3dViewerSkybox();
  }

  function setModel3dViewerRigVisible(enabled) {
    state.model3dViewerRigVisible = enabled === true;
    updateModel3dRigHelper();
    if (model3dViewer.renderer && model3dViewer.scene && model3dViewer.camera) {
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
    }
  }

  function setModel3dViewerAxisMode(mode) {
    state.model3dViewerAxisMode = mode === "blender" ? "blender" : "gameengine";
    updateModel3dViewerSceneHelperOptions();
  }

  function getModel3dViewerTarget(record) {
    const lowPolyFileName = typeof record?.lowPolyModelFileName === "string" ? record.lowPolyModelFileName.trim() : "";
    const albedoFileName = typeof record?.albedoGeometryModelFileName === "string" ? record.albedoGeometryModelFileName.trim() : "";
    const currentFileName = typeof record?.modelFileName === "string" ? record.modelFileName.trim() : "";
    const originalFileName = typeof record?.originalModelFileName === "string" ? record.originalModelFileName.trim() : "";
    const requestedVariant = record?.__model3dVariantKey ? normalizeModel3dThreeVariant(record.__model3dVariantKey) : "";
    const effectiveVariant = requestedVariant || resolveModel3dThreeVariantForRecord(record);
    if (effectiveVariant === "original" && originalFileName) {
      return { fileName: originalFileName, key: String(record.id || "") + "|" + originalFileName, variantLabel: "original", variantSuffix: " (original)" };
    }
    if (effectiveVariant === "current" && currentFileName) {
      return { fileName: currentFileName, key: String(record.id || "") + "|" + currentFileName, variantLabel: "merged", variantSuffix: " (merged)" };
    }
    if (effectiveVariant === "lowpoly" && lowPolyFileName) {
      return { fileName: lowPolyFileName, key: String(record.id || "") + "|" + lowPolyFileName, variantLabel: "low poly", variantSuffix: " (low poly)" };
    }
    if (effectiveVariant === "albedo" && albedoFileName) {
      return { fileName: albedoFileName, key: String(record.id || "") + "|" + albedoFileName, variantLabel: "geometry from albedo", variantSuffix: " (geometry from albedo)" };
    }
    if (currentFileName) {
      return { fileName: currentFileName, key: String(record.id || "") + "|" + currentFileName, variantLabel: "merged", variantSuffix: " (merged)" };
    }
    if (originalFileName) {
      return { fileName: originalFileName, key: String(record.id || "") + "|" + originalFileName, variantLabel: "original", variantSuffix: " (original)" };
    }
    if (albedoFileName) {
      return { fileName: albedoFileName, key: String(record.id || "") + "|" + albedoFileName, variantLabel: "geometry from albedo", variantSuffix: " (geometry from albedo)" };
    }
    return { fileName: lowPolyFileName, key: String(record.id || "") + "|" + lowPolyFileName, variantLabel: "low poly", variantSuffix: " (low poly)" };
  }

  function scoreModel3dHistoryEntry(entry) {
    let score = 0;
    if (entry?.lowPolyModelFileName) score += 30;
    if (entry?.lowPolyPreviewGifFileName || entry?.lowPolyPreviewImageFileName) score += 18;
    if (entry?.previewGifFileName || entry?.previewImageFileName) score += 10;
    if (Array.isArray(entry?.multiViewFileNames) && entry.multiViewFileNames.length > 0) score += Math.min(6, entry.multiViewFileNames.length);
    return score;
  }

  function buildModel3dHistoryDedupKey(entry) {
    return [String(entry?.modelFileName || "").trim(), String(entry?.createdAt || "").trim(), String(entry?.sourceImageFileName || "").trim()].join("|");
  }

  function dedupeModel3dHistory(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    const byKey = new Map();
    for (const entry of entries) {
      if (!entry || !entry.id) {
        continue;
      }
      const key = buildModel3dHistoryDedupKey(entry);
      const existing = byKey.get(key);
      if (!existing || scoreModel3dHistoryEntry(entry) > scoreModel3dHistoryEntry(existing)) {
        byKey.set(key, entry);
      }
    }
    return Array.from(byKey.values());
  }

  function resolveModel3dPreviewMedia(record) {
    if (!record) {
      return { fileName: "", variantLabel: "none" };
    }
    const activeVariant = resolveModel3dThreeVariantForRecord(record);
    const lowPolyGif = typeof record.lowPolyPreviewGifFileName === "string" ? record.lowPolyPreviewGifFileName.trim() : "";
    const lowPolyImage = typeof record.lowPolyPreviewImageFileName === "string" ? record.lowPolyPreviewImageFileName.trim() : "";
    const albedoGif = typeof record.albedoGeometryPreviewGifFileName === "string" ? record.albedoGeometryPreviewGifFileName.trim() : "";
    const albedoImage = typeof record.albedoGeometryPreviewImageFileName === "string" ? record.albedoGeometryPreviewImageFileName.trim() : "";
    const defaultGif = typeof record.previewGifFileName === "string" ? record.previewGifFileName.trim() : "";
    const defaultImage = typeof record.previewImageFileName === "string" ? record.previewImageFileName.trim() : "";
    if (activeVariant === "albedo" && albedoGif) return { fileName: albedoGif, variantLabel: "geometry from albedo" };
    if (activeVariant === "albedo" && albedoImage) return { fileName: albedoImage, variantLabel: "geometry from albedo" };
    if (activeVariant === "lowpoly" && lowPolyGif) return { fileName: lowPolyGif, variantLabel: "low poly" };
    if (activeVariant === "lowpoly" && lowPolyImage) return { fileName: lowPolyImage, variantLabel: "low poly" };
    if (defaultGif) return { fileName: defaultGif, variantLabel: "original" };
    if (defaultImage) return { fileName: defaultImage, variantLabel: "original" };
    if (albedoGif) return { fileName: albedoGif, variantLabel: "geometry from albedo" };
    if (albedoImage) return { fileName: albedoImage, variantLabel: "geometry from albedo" };
    if (lowPolyGif) return { fileName: lowPolyGif, variantLabel: "low poly" };
    if (lowPolyImage) return { fileName: lowPolyImage, variantLabel: "low poly" };
    return { fileName: "", variantLabel: "none" };
  }
  function resolveModel3dVariantPreviewUrl(record, variantKey, options = {}) {
    if (!record || !record.id) {
      return "";
    }
    const normalizedVariant = normalizeModel3dThreeVariant(variantKey);
    const preferGif = options.preferGif === true;
    const sourceImageFileName = typeof record.sourceImageFileName === "string" ? record.sourceImageFileName.trim() : "";
    const lowPolyCandidates = preferGif
      ? [record.lowPolyPreviewGifUrl, record.lowPolyPreviewImageUrl, record.lowPolyPreviewGifFileName, record.lowPolyPreviewImageFileName]
      : [record.lowPolyPreviewImageUrl, record.lowPolyPreviewGifUrl, record.lowPolyPreviewImageFileName, record.lowPolyPreviewGifFileName];
    const albedoCandidates = preferGif
      ? [record.albedoGeometryPreviewGifUrl, record.albedoGeometryPreviewImageUrl, record.albedoGeometryPreviewGifFileName, record.albedoGeometryPreviewImageFileName]
      : [record.albedoGeometryPreviewImageUrl, record.albedoGeometryPreviewGifUrl, record.albedoGeometryPreviewImageFileName, record.albedoGeometryPreviewGifFileName];
    const defaultCandidates = preferGif
      ? [record.previewGifUrl, record.previewImageUrl, record.previewGifFileName, record.previewImageFileName]
      : [record.previewImageUrl, record.previewGifUrl, record.previewImageFileName, record.previewGifFileName];
    const candidates = normalizedVariant === "lowpoly"
      ? [...lowPolyCandidates, ...defaultCandidates, sourceImageFileName]
      : normalizedVariant === "albedo"
        ? [...albedoCandidates, ...defaultCandidates, sourceImageFileName]
        : [...defaultCandidates, sourceImageFileName];
    for (const candidate of candidates) {
      const value = typeof candidate === "string" ? candidate.trim() : "";
      if (!value) continue;
      if (/^(https?:|data:|blob:|\/)/i.test(value)) return buildAbsoluteDashboardUrl(value);
      return buildAbsoluteDashboardUrl(getModel3dFileUrl(record.id, value));
    }
    return "";
  }

  function resolveModel3dHistoryThumbnailUrl(record, variantKey = "") {
    if (!record || !record.id) {
      return "";
    }
    if (variantKey) {
      const variantPreviewUrl = resolveModel3dVariantPreviewUrl(record, variantKey);
      if (variantPreviewUrl) return variantPreviewUrl;
    }
    const directPreviewUrlCandidates = [record.lowPolyPreviewImageUrl, record.previewImageUrl, record.lowPolyPreviewGifUrl, record.previewGifUrl];
    for (const candidate of directPreviewUrlCandidates) {
      const normalizedCandidate = typeof candidate === "string" ? candidate.trim() : "";
      if (normalizedCandidate) {
        return buildAbsoluteDashboardUrl(normalizedCandidate);
      }
    }
    const resolvedPreview = resolveModel3dPreviewMedia(record);
    if (resolvedPreview.fileName) {
      return buildAbsoluteDashboardUrl(getModel3dFileUrl(record.id, resolvedPreview.fileName));
    }
    const sourceImageFileName = typeof record.sourceImageFileName === "string" ? record.sourceImageFileName.trim() : "";
    if (sourceImageFileName) {
      return buildAbsoluteDashboardUrl(getModel3dFileUrl(record.id, sourceImageFileName));
    }
    return "";
  }
  function resolveModel3dRotatingPreviewUrl(record) {
    if (!record || !record.id) {
      return "";
    }
    const variantKey = record.__model3dVariantKey || resolveModel3dThreeVariantForRecord(record);
    return resolveModel3dVariantPreviewUrl(record, variantKey, {preferGif: true})
      || resolveModel3dHistoryThumbnailUrl(record, variantKey);
  }
  function getModel3dSelectedVariantLabel(record) {
    return record?.__model3dVariantFileName || record?.modelFileName || record?.originalModelFileName || record?.lowPolyModelFileName || record?.id || "Selected model";
  }
  function ensureModel3dPreviewMultiSelectionNode(preview) {
    const shell = preview?.parentElement || document.querySelector(".model3d-side-preview-shell");
    if (!shell) {
      return null;
    }
    const existing = document.getElementById("model3d-preview-multi-selection");
    if (existing) {
      return existing;
    }
    const node = document.createElement("div");
    node.id = "model3d-preview-multi-selection";
    node.className = "model3d-preview-multi-selection hidden";
    if (preview && preview.parentNode === shell) {
      shell.insertBefore(node, preview);
    } else {
      shell.appendChild(node);
    }
    return node;
  }
  function renderModel3dPreviewMultiSelection(selectedModels) {
    const preview = document.getElementById("model3d-preview-media");
    const node = ensureModel3dPreviewMultiSelectionNode(preview);
    const entries = Array.isArray(selectedModels) ? selectedModels.filter(model => model?.id) : [];
    if (!node) {
      return false;
    }
    clearChildren(node);
    const isMultiSelection = entries.length > 1;
    node.classList.toggle("hidden", !isMultiSelection);
    preview?.parentElement?.classList.toggle("has-multi-selection", isMultiSelection);
    if (!isMultiSelection) {
      return false;
    }
    const heading = document.createElement("div");
    heading.className = "model3d-preview-multi-selection-heading";
    const title = document.createElement("strong");
    title.textContent = entries.length + " selected models";
    const detail = document.createElement("span");
    detail.textContent = "Open in Blender runs for every selected model.";
    heading.append(title, detail);
    node.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "model3d-preview-multi-selection-grid";
    const visibleCount = entries.length;
    entries.slice(0, visibleCount).forEach(entry => {
      const card = document.createElement("article");
      card.className = "model3d-preview-multi-selection-card";
      const thumb = document.createElement("img");
      const thumbnailUrl = resolveModel3dRotatingPreviewUrl(entry) || resolveModel3dHistoryThumbnailUrl(entry);
      thumb.alt = getModel3dSelectedVariantLabel(entry);
      thumb.loading = "lazy";
      thumb.decoding = "async";
      if (thumbnailUrl) {
        thumb.src = thumbnailUrl;
      } else {
        thumb.classList.add("hidden");
      }
      const fallback = document.createElement("span");
      fallback.className = "model3d-preview-multi-selection-fallback";
      fallback.textContent = "3D";
      const label = document.createElement("strong");
      label.textContent = getModel3dSelectedVariantLabel(entry);
      card.append(thumb, fallback, label);
      grid.appendChild(card);
    });
    node.appendChild(grid);
    return true;
  }
  function ensureModel3dMainMultiSelectionNode() {
    const shell = document.querySelector(".model3d-main-viewer-shell");
    if (!shell) {
      return null;
    }
    const existing = document.getElementById("model3d-main-multi-selection");
    if (existing) {
      return existing;
    }
    const node = document.createElement("div");
    node.id = "model3d-main-multi-selection";
    node.className = "model3d-main-multi-selection hidden";
    const canvasStage = shell.querySelector(".model3d-canvas-stage");
    if (canvasStage && canvasStage.parentNode === shell) {
      shell.insertBefore(node, canvasStage);
    } else {
      shell.appendChild(node);
    }
    return node;
  }
  function renderModel3dMainMultiSelection(selectedModels) {
    const node = ensureModel3dMainMultiSelectionNode();
    const shell = document.querySelector(".model3d-main-viewer-shell");
    const entries = Array.isArray(selectedModels) ? selectedModels.filter(model => model?.id) : [];
    if (!node) {
      return false;
    }
    clearChildren(node);
    const isMultiSelection = entries.length > 1;
    node.classList.toggle("hidden", !isMultiSelection);
    shell?.classList.toggle("has-multi-selection", isMultiSelection);
    if (!isMultiSelection) {
      return false;
    }
    disposeModel3dViewerRoot();
    const heading = document.createElement("div");
    heading.className = "model3d-main-multi-selection-heading";
    const title = document.createElement("strong");
    title.textContent = entries.length + " selected models";
    const detail = document.createElement("span");
    detail.textContent = "Showing generated turntable previews instead of loading a single Three.js model.";
    heading.append(title, detail);
    node.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "model3d-main-multi-selection-grid";
    const visibleCount = entries.length;
    entries.slice(0, visibleCount).forEach(entry => {
      const card = document.createElement("article");
      card.className = "model3d-main-multi-selection-card";
      const preview = document.createElement("img");
      const previewUrl = resolveModel3dRotatingPreviewUrl(entry) || resolveModel3dHistoryThumbnailUrl(entry);
      preview.alt = getModel3dSelectedVariantLabel(entry);
      preview.loading = "lazy";
      preview.decoding = "async";
      if (previewUrl) {
        preview.src = previewUrl;
      } else {
        preview.classList.add("hidden");
      }
      const fallback = document.createElement("span");
      fallback.className = "model3d-main-multi-selection-fallback";
      fallback.textContent = "3D";
      const name = document.createElement("strong");
      name.textContent = getModel3dSelectedVariantLabel(entry);
      const meta = document.createElement("small");
      meta.textContent = formatDateTime(entry.createdAt);
      card.append(preview, fallback, name, meta);
      grid.appendChild(card);
    });
    node.appendChild(grid);
    setModel3dThreeStatus(entries.length + " models selected. Multi-preview grid is active.");
    return true;
  }

  function renderModel3dPreviewMedia() {
    const preview = document.getElementById("model3d-preview-media");
    if (!preview) {
      return;
    }
    const selectedModels = getSelectedGeneratedModels();
    const isMultiSelection = selectedModels.length > 1;
    renderModel3dMainMultiSelection(selectedModels);
    renderModel3dPreviewMultiSelection(selectedModels);
    if (isMultiSelection) {
      preview.removeAttribute("src");
      preview.classList.add("hidden");
      setModel3dPreviewStatus(selectedModels.length + " models selected. Quick actions use the full selection where supported.");
      return;
    }
    preview.classList.remove("hidden");
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      preview.removeAttribute("src");
      setModel3dPreviewStatus("Select a generated model to preview it here.");
      return;
    }
    const resolved = resolveModel3dPreviewMedia(selected);
    if (!resolved.fileName) {
      preview.removeAttribute("src");
      setModel3dPreviewStatus("No preview media is available for " + selected.modelFileName + ".");
      return;
    }
    preview.src = getModel3dFileUrl(selected.id, resolved.fileName);
    setModel3dPreviewStatus("Previewing " + resolved.fileName + (resolved.variantLabel === "low poly" ? " (low poly)." : "."));
  }

  async function loadModel3dHistory(preferredModelId) {
    const history = await request("/api/model3d-history");
    const dedupedHistory = dedupeModel3dHistory(history);
    state.generatedModels = dedupedHistory;
    const allHistory = Array.isArray(history) ? history : [];
    const resolveCandidateId = inputId => {
      const normalized = String(inputId || "").trim();
      if (!normalized) return "";
      if (dedupedHistory.some(item => item.id === normalized)) return normalized;
      const original = allHistory.find(item => item && item.id === normalized);
      if (!original) return normalized;
      const mapped = dedupedHistory.find(item => buildModel3dHistoryDedupKey(item) === buildModel3dHistoryDedupKey(original));
      return mapped?.id || normalized;
    };
    const candidateIdFromPreferred = resolveCandidateId(preferredModelId);
    const candidateIdFromCurrent = resolveCandidateId(state.selectedGeneratedModelId);
    const candidateId = candidateIdFromPreferred || candidateIdFromCurrent;
    state.selectedGeneratedModelId = state.generatedModels.some(item => item.id === candidateId)
      ? candidateId
      : (state.generatedModels[0] ? state.generatedModels[0].id : "");
    mediaMultiSelectionHelpers.pruneSelection("selectedGeneratedModelIds", "selectedGeneratedModelId", state.generatedModels);
    renderModel3dHistory();
    renderModel3dPreviewMedia();
    if (model3dViewer.previewActive === true) {
      await renderModel3dViewer();
    } else {
      setModel3dThreeStatus("Click the preview to load the selected model in Three.js.");
    }
    renderModel3dBottomQueue();
  }

  function renderModel3dBottomQueue() {
    generationQueuePresenter.render({
      containerId: "model3d-bottom-queue-list",
      statusKey: "model3d",
      noun: "3D model",
      studioLabel: "3D Model Studio",
      itemClass: "model3d-queue-item",
      iconClass: "model3d-queue-thumb",
      createActiveAction() {
        const cancel = document.createElement("button");
        cancel.className = "secondary mini-button";
        cancel.id = "model3d-queue-cancel-button";
        cancel.type = "button";
        cancel.textContent = "Cancel";
        return cancel;
      }
    });
  }

  async function applyDeletedModel3dVariant(updatedRecord) {
    if (!updatedRecord || !updatedRecord.id) {
      return false;
    }
    state.generatedModels = state.generatedModels.map(entry => entry && entry.id === updatedRecord.id ? updatedRecord : entry);
    mediaMultiSelectionHelpers.pruneSelection("selectedGeneratedModelIds", "selectedGeneratedModelId", state.generatedModels);
    if (state.selectedGeneratedModelId === updatedRecord.id) {
      const nextVariant = resolveModel3dThreeVariantForRecord(updatedRecord);
      const nextVariantRecord = getModel3dRecordVariants(updatedRecord).find(variant => variant.key === nextVariant);
      state.model3dThreeVariant = nextVariant;
      state.selectedGeneratedModelVariantRefs = nextVariantRecord
        ? [getModel3dVariantRef(updatedRecord.id, nextVariant, nextVariantRecord.fileName)]
        : [];
      state.model3dVariantSelectionAnchorRef = state.selectedGeneratedModelVariantRefs[0] || "";
    }
    renderModel3dHistory();
    if (model3dViewer.previewActive === true) {
      await renderModel3dViewer();
    }
    return true;
  }

  function renderModel3dHistory() {
    const container = document.getElementById("model3d-history-list");
    if (!container) {
      renderModel3dBottomQueue();
      return;
    }
    if (typeof attachDashboardLazyMedia.detach === "function") {
      attachDashboardLazyMedia.detach(container);
    }
    clearChildren(container);
    if (state.generatedModels.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No generated 3D models yet.";
      container.appendChild(empty);
      renderModel3dInspection(null, null);
      renderModel3dMeta(null);
      setModel3dPreviewStatus("Generate a model to preview it.");
      setModel3dThreeStatus("Generate a model to preview it.");
      updateModel3dThreeVariantUi();
      updateModel3dToolQuickActionState();
      updateModel3dEditSelectedModelName();
      renderModel3dBottomQueue();
      return;
    }
    const visibleLimit = Math.max(model3dHistoryInitialRenderLimit, Number.parseInt(state.model3dHistoryVisibleLimit || model3dHistoryInitialRenderLimit, 10) || model3dHistoryInitialRenderLimit);
    const limitedEntries = state.generatedModels.slice(0, visibleLimit);
    const groups = [{key: "image", label: "Image", getValue: item => item.record.sourceImageFileName || "(no source image)"}];
    const filters = [
      {key: "variant", label: "Variant", getValue: item => item.variant.key},
      {key: "image", label: "Image", getValue: item => item.record.sourceImageFileName},
      {key: "faces", label: "Faces", type: "number", getValue: item => item.variant.key === "lowpoly" ? item.record.lowPolyTargetFaceCount : item.record.targetFaceCount}
    ];
    recentMediaViewHelpers.renderControls("model3d-recent-media-controls", {
      key: "models",
      mediaContainerId: "model3d-history-list",
      groups,
      filters,
      onChange: renderModel3dHistory
    });
    const viewState = recentMediaViewHelpers.getState("models");
    const viewActive = Boolean(viewState.groupBy || (viewState.filterBy && viewState.filterValue));
    const entries = viewActive ? state.generatedModels : limitedEntries;
    mediaMultiSelectionHelpers.pruneSelection("selectedGeneratedModelIds", "selectedGeneratedModelId", state.generatedModels);
    pruneModel3dVariantSelection();
    const visibleVariantRefs = getAllModel3dVariantRefs(entries);
    const selectedVariantRefs = new Set(getSelectedModel3dVariantRefs());
    const variantEntries = entries.flatMap(entry => {
      const variants = getModel3dHistoryVariants(entry);
      const historyVariants = variants.length > 0 ? variants : [{key: "current", title: "Model", badge: "3D", hint: "Generated model", fileName: entry.modelFileName || entry.originalModelFileName || entry.lowPolyModelFileName || ""}];
      return historyVariants.map(variant => ({record: entry, variant}));
    });
    const filteredVariantEntries = recentMediaViewHelpers.filterEntries(variantEntries, "models", filters);
    if (filteredVariantEntries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No recent model variants match the filter.";
      container.appendChild(empty);
    }
    const renderItems = recentMediaViewHelpers.groupEntries(filteredVariantEntries, "models", groups)
      .flatMap(group => [{group}, ...group.entries.map(entry => ({entry}))]);
    for (const item of renderItems) {
      if (item.group) {
        recentMediaViewHelpers.appendGroupHeading(container, item.group.label, item.group.entries.length);
        continue;
      }
      const entry = item.entry.record;
      const variant = item.entry.variant;
      const rowSelectedVariant = getSelectedModel3dVariantKeyForModel(entry.id);
      const activeVariant = entry.id === state.selectedGeneratedModelId
        ? resolveModel3dThreeVariantForRecord(entry)
        : (rowSelectedVariant || resolveDefaultModel3dThreeVariantForRecord(entry));
      const variantRef = getModel3dVariantRef(entry.id, variant.key, variant.fileName);
      const isActiveVariant = entry.id === state.selectedGeneratedModelId && variant.key === activeVariant;
      const isSelectedVariant = selectedVariantRefs.has(variantRef);
      const rowWrap = document.createElement("div");
      rowWrap.className = "media-history-row-wrap" + (isSelectedVariant ? " multi-selected" : "") + (isActiveVariant ? " preview-active" : "");
      rowWrap.setAttribute("data-model-id", entry.id);
      rowWrap.setAttribute("data-model-variant-key", variant.key);
      rowWrap.setAttribute("data-selected-variant", isSelectedVariant ? "true" : "false");
      rowWrap.setAttribute("data-preview-active", isActiveVariant ? "true" : "false");
      const rowInner = document.createElement("div");
      rowInner.className = "media-history-row";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "channel-row" + (isSelectedVariant ? " active" : "");
      const thumbnailWrap = document.createElement("span");
      thumbnailWrap.className = "media-history-thumb-wrap";
      const thumbnail = document.createElement("img");
      thumbnail.className = "media-history-thumb media-history-thumb-model";
      thumbnail.alt = variant.title + " 3D model preview";
      const fallback = document.createElement("span");
      fallback.className = "media-history-thumb-fallback";
      fallback.textContent = variant.badge || "3D";
      const thumbnailUrl = resolveModel3dHistoryThumbnailUrl(entry, variant.key);
      if (thumbnailUrl) {
        attachDashboardLazyMedia(thumbnail, thumbnailUrl, false);
        thumbnail.addEventListener("load", () => {
          thumbnail.classList.remove("hidden");
          thumbnailWrap.classList.add("has-image");
        });
        thumbnail.addEventListener("error", () => {
          thumbnail.classList.add("hidden");
          thumbnailWrap.classList.remove("has-image");
        });
      } else {
        thumbnail.classList.add("hidden");
      }
      const main = document.createElement("span");
      main.className = "channel-row-main";
      const name = document.createElement("span");
      name.className = "channel-row-name";
      name.textContent = variant.fileName || entry.modelFileName || "(unnamed model)";
      const time = document.createElement("span");
      time.className = "channel-row-kind";
      time.textContent = variant.title + " - " + formatDateTime(entry.createdAt);
      main.appendChild(name);
      main.appendChild(time);
      thumbnailWrap.appendChild(thumbnail);
      thumbnailWrap.appendChild(fallback);
      row.appendChild(thumbnailWrap);
      row.appendChild(main);
      row.addEventListener("click", async event => {
        const activeRef = handleModel3dVariantSelectionClick({ variantRef, visibleVariantRefs, event });
        state.model3dThreeVariant = activeRef ? getModel3dVariantKeyFromRef(activeRef) : normalizeModel3dThreeVariant(variant.key);
        renderModel3dHistory();
        renderModel3dPreviewMedia();
        updateModel3dEditSelectedModelName();
        await activateModel3dViewerPreview();
      });
      const renameButton = document.createElement("button");
      renameButton.className = "secondary media-history-action-button";
      renameButton.type = "button";
      renameButton.innerHTML = "<span class='media-history-action-icon' aria-hidden='true'>&#9998;</span><span class='media-history-action-label'>Rename</span>";
      renameButton.title = "Regenerate model filename with LLM";
      renameButton.setAttribute("aria-label", "Regenerate model filename " + entry.modelFileName);
      renameButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        setModel3dStatus("Regenerating filename for " + entry.modelFileName + "...");
        try {
          const renamed = await request("/api/model3d-regenerate-filename", { modelId: entry.id });
          invalidateModelInspection(entry.id);
          await loadModel3dHistory(renamed.id || entry.id);
          setModel3dStatus("Renamed to " + renamed.modelFileName + ".");
          setOutput("Regenerated model filename: " + renamed.modelFileName + ".");
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setModel3dStatus("Failed to regenerate model filename.");
          setOutput("Failed to regenerate model filename: " + detail);
        }
      });
      const modelDownloadButton = document.createElement("button");
      modelDownloadButton.className = "secondary media-history-action-button";
      modelDownloadButton.type = "button";
      modelDownloadButton.innerHTML = "<span class='media-history-action-icon' aria-hidden='true'>&#8681;</span><span class='media-history-action-label'>Model</span>";
      modelDownloadButton.title = "Download " + variant.title.toLowerCase() + " model file";
      modelDownloadButton.setAttribute("aria-label", "Download " + variant.title.toLowerCase() + " model file for " + entry.modelFileName);
      modelDownloadButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (!model3dHasFileName(variant.fileName)) {
          setOutput("No model file is available for " + entry.id + ".");
          return;
        }
        input.downloadModel3dArtifact(entry.id, variant.fileName, variant.title.toLowerCase() + " model");
      });
      const actionWrap = document.createElement("div");
      actionWrap.className = "media-history-actions";
      const removeButton = document.createElement("button");
      removeButton.className = "secondary media-history-action-button danger";
      removeButton.type = "button";
      removeButton.innerHTML = "<span class='media-history-action-icon' aria-hidden='true'>&#10005;</span><span class='media-history-action-label'>Delete</span>";
      removeButton.title = "Delete model variant";
      removeButton.setAttribute("aria-label", "Delete " + variant.title + " model variant " + variant.fileName);
      removeButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = typeof window.dashboardConfirm === "function"
          && await window.dashboardConfirm({
            title: "Delete Model Variant",
            message: "Delete only the " + variant.title + " variant " + variant.fileName + "?",
            confirmLabel: "Delete Variant",
            variant: "warning"
          });
        if (!confirmed) {
          return;
        }
        setModel3dStatus("Deleting " + variant.title + " variant...");
        try {
          const result = await request("/api/model3d-variant-delete", {
            modelId: entry.id,
            variant: variant.key === "current" ? "merged" : variant.key,
            fileName: variant.fileName
          });
          invalidateModelInspection(entry.id);
          if (!await applyDeletedModel3dVariant(result?.model)) {
            await loadModel3dHistory(entry.id);
          }
          const deletedModelEntry = result?.deletedModelEntry === true;
          setModel3dStatus(deletedModelEntry ? "Deleted model entry." : "Deleted " + variant.title + " variant.");
          setOutput(deletedModelEntry ? "Deleted the model entry because " + variant.fileName + " was its only remaining variant." : "Deleted only model variant " + variant.fileName + ".");
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setModel3dStatus("Failed to delete " + variant.title + " variant.");
          setOutput("Failed to delete model variant: " + detail);
        }
      });
      actionWrap.appendChild(modelDownloadButton);
      actionWrap.appendChild(renameButton);
      actionWrap.appendChild(removeButton);
      rowInner.appendChild(row);
      rowInner.appendChild(actionWrap);
      rowWrap.appendChild(rowInner);
      container.appendChild(rowWrap);
    }
    if (!viewActive && state.generatedModels.length > entries.length) {
      const moreButton = document.createElement("button");
      moreButton.className = "secondary";
      moreButton.type = "button";
      moreButton.textContent = "Show " + Math.min(model3dHistoryInitialRenderLimit, state.generatedModels.length - entries.length) + " more models";
      moreButton.addEventListener("click", () => {
        state.model3dHistoryVisibleLimit = entries.length + model3dHistoryInitialRenderLimit;
        renderModel3dHistory();
      });
      container.appendChild(moreButton);
    }
    renderModel3dMeta(getSelectedGeneratedModel());
    renderModel3dPreviewMedia();
    updateModel3dThreeVariantUi();
    updateModel3dToolQuickActionState();
    updateModel3dEditSelectedModelName();
    renderModel3dBottomQueue();
  }

  function waitForThreeLibrary(timeoutMs) {
    if (window.DiscrodThree && window.DiscrodThree.THREE && window.DiscrodThree.GLTFLoader && window.DiscrodThree.FBXLoader && window.DiscrodThree.OBJLoader && window.DiscrodThree.OrbitControls) {
      return Promise.resolve(window.DiscrodThree);
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = value => {
        if (settled) return;
        settled = true;
        window.removeEventListener("discrod-three-ready", onReady);
        clearTimeout(timer);
        resolve(value);
      };
      const fail = error => {
        if (settled) return;
        settled = true;
        window.removeEventListener("discrod-three-ready", onReady);
        clearTimeout(timer);
        reject(error);
      };
      const onReady = () => {
        if (window.DiscrodThree && window.DiscrodThree.THREE && window.DiscrodThree.GLTFLoader && window.DiscrodThree.FBXLoader && window.DiscrodThree.OBJLoader && window.DiscrodThree.OrbitControls) {
          done(window.DiscrodThree);
        }
      };
      const timer = setTimeout(() => {
        fail(new Error("Three.js did not finish loading."));
      }, timeoutMs);
      window.addEventListener("discrod-three-ready", onReady, { once: true });
    });
  }

  const model3dViewerCameraGeometry = createDashboardThreeDViewerCameraGeometryHelpers({
    viewer: model3dViewer,
    updateSceneHelpers: updateModel3dSceneHelpers,
    updateLightRig: updateModel3dViewerLightRig
  });
  const {
    captureModel3dViewerCameraState,
    fitModelInCamera,
    getModel3dViewerAspect,
    getModel3dViewerMaxSize,
    restoreModel3dViewerCameraState,
    updateModel3dOrthographicCameraBounds
  } = model3dViewerCameraGeometry;
  const model3dViewerResize = createDashboardThreeDViewerResizeHelpers({
    viewer: model3dViewer,
    updateOrthographicBounds: updateModel3dOrthographicCameraBounds,
    getViewerMaxSize: getModel3dViewerMaxSize,
    updateLightRig: updateModel3dViewerLightRig
  });
  const model3dViewerAxisGizmo = createDashboardThreeDViewerAxisGizmoHelpers({
    viewer: model3dViewer,
    requestInteractionFrames: requestModel3dViewerInteractionFrames,
    setView: setModel3dViewerGizmoView,
    switchToManualOrbit: switchModel3dViewerToManualOrbit,
    updateLightRig: updateModel3dViewerLightRig
  });
  const {
    bind: bindModel3dViewportAxisGizmo,
    updateOrientation: updateModel3dViewportAxisGizmoOrientation
  } = model3dViewerAxisGizmo;
  const model3dViewerSceneInitialization = createDashboardThreeDViewerSceneInitializationHelpers({
    viewer: model3dViewer,
    getDevicePixelRatio: () => window.devicePixelRatio || 1,
    bindAxisGizmo: bindModel3dViewportAxisGizmo,
    switchToManualOrbit: switchModel3dViewerToManualOrbit,
    updateAxisGizmo: updateModel3dViewportAxisGizmoOrientation,
    updateLightRig: updateModel3dViewerLightRig,
    requestInteractionFrames: requestModel3dViewerInteractionFrames,
    updateSceneHelpers: updateModel3dSceneHelpers,
    updateSceneHelperOptions: updateModel3dViewerSceneHelperOptions,
    applyLightingProfile: applyModel3dViewerLightingProfile
  });
  const model3dViewerCanvasInput = createDashboardThreeDViewerCanvasInputHelpers({
    bindManualOrbitGuards: bindModel3dManualOrbitGuards,
    focusViewer: focusModel3dViewer,
    resetCamera: resetModel3dViewerCamera
  });

  function focusModel3dViewer() {
    const THREE = model3dViewer.lightRig?.THREE;
    const camera = model3dViewer.camera;
    const object = model3dViewer.root;
    if (!THREE || !camera || !object) {
      setModel3dThreeStatus("Load a 3D model before focusing the viewport.");
      return false;
    }
    if (!fitModelInCamera(THREE, camera, object, model3dViewer.controls)) {
      setModel3dThreeStatus("Could not calculate usable bounds for the current 3D model.");
      return false;
    }
    updateModel3dViewerLightRig();
    requestModel3dViewerInteractionFrames(8);
    setModel3dThreeStatus("Focused the current 3D model.");
    return true;
  }

  function resetModel3dViewerCamera() {
    const THREE = model3dViewer.lightRig?.THREE;
    if (!THREE || !model3dViewer.camera || !model3dViewer.root) {
      setModel3dThreeStatus("Load a 3D model before resetting the camera.");
      return false;
    }
    fitModelInCamera(THREE, model3dViewer.camera, model3dViewer.root, model3dViewer.controls);
    updateModel3dViewerLightRig();
    requestModel3dViewerInteractionFrames(8);
    setModel3dThreeStatus("Reset the 3D viewport camera.");
    return true;
  }

  function setModel3dViewerGizmoView(view) {
    const THREE = model3dViewer.lightRig?.THREE;
    const camera = model3dViewer.camera;
    const controls = model3dViewer.controls;
    if (view === "reset") return resetModel3dViewerCamera();
    if (!THREE || !camera || !model3dViewer.root) {
      setModel3dThreeStatus("Load a 3D model before using axis controls.");
      return false;
    }
    const directions = {
      front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.001], bottom: [0, -1, 0.001]
    };
    const values = directions[view];
    if (!values) return false;
    const target = controls?.target?.clone() || new THREE.Vector3(0, 0, 0);
    const currentDistance = camera.position.distanceTo(target);
    const distance = Math.max(currentDistance || 0, getModel3dViewerMaxSize(THREE) * 2.2);
    camera.position.copy(new THREE.Vector3(...values).normalize().multiplyScalar(distance).add(target));
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    switchModel3dViewerToManualOrbit();
    controls?.update();
    updateModel3dViewportAxisGizmoOrientation();
    updateModel3dViewerLightRig();
    requestModel3dViewerInteractionFrames(8);
    setModel3dThreeStatus("Viewport set to " + view + " view.");
    return true;
  }

  function drawSquaredModel3dGifFrame(frameCanvas, sourceCanvas) {
    const context = frameCanvas.getContext("2d");
    if (!context) {
      return;
    }
    const size = frameCanvas.width;
    const sourceWidth = Math.max(1, sourceCanvas.width || sourceCanvas.clientWidth || size);
    const sourceHeight = Math.max(1, sourceCanvas.height || sourceCanvas.clientHeight || size);
    const cropSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = Math.floor((sourceWidth - cropSize) / 2);
    const sourceY = Math.floor((sourceHeight - cropSize) / 2);
    context.clearRect(0, 0, size, size);
    context.drawImage(sourceCanvas, sourceX, sourceY, cropSize, cropSize, 0, 0, size, size);
  }

  function normalizeModel3dPreviewRenderMode(value) {
    const mode = String(value || "").trim();
    return ["turntable", "current", "front", "back", "left", "right", "top", "three-quarter"].includes(mode) ? mode : "current";
  }

  function normalizeModel3dPreviewProjection(value) {
    const projection = String(value || "").trim();
    return projection === "perspective" || projection === "orthographic" || projection === "current" ? projection : "current";
  }
  function normalizeModel3dGifBackgroundMode(value) {
    const mode = String(value || "").trim();
    return ["scene", "skybox", "solid", "transparent"].includes(mode) ? mode : "solid";
  }
  function normalizeModel3dGifExportOptions(options, renderOptions) {
    const fallbackFrameCount = renderOptions?.renderMode === "turntable" ? 48 : 2;
    return {
      frameCount: Math.max(2, Math.min(120, Number.parseInt(String(options?.frameCount ?? fallbackFrameCount), 10) || fallbackFrameCount)),
      frameDelay: Math.max(20, Math.min(1000, Number.parseInt(String(options?.frameDelay ?? 60), 10) || 60)),
      size: Math.max(128, Math.min(1024, Number.parseInt(String(options?.size ?? 512), 10) || 512)),
      includeGrid: options?.includeGrid === true,
      includeAxes: options?.includeAxes === true,
      includeRig: options?.includeRig === true,
      backgroundMode: normalizeModel3dGifBackgroundMode(options?.backgroundMode),
      backgroundColor: String(options?.backgroundColor || "#0b0d1f").trim() || "#0b0d1f"
    };
  }

  function getModel3dPreviewRenderOptions() {
    const renderModeNode = document.getElementById("model3d-preview-render-mode");
    const projectionNode = document.getElementById("model3d-preview-projection");
    state.model3dPreviewRenderMode = normalizeModel3dPreviewRenderMode(renderModeNode && typeof renderModeNode.value === "string" ? renderModeNode.value : state.model3dPreviewRenderMode);
    state.model3dPreviewProjection = normalizeModel3dPreviewProjection(projectionNode && typeof projectionNode.value === "string" ? projectionNode.value : state.model3dPreviewProjection);
    return {
      renderMode: state.model3dPreviewRenderMode,
      projection: state.model3dPreviewProjection
    };
  }

  function resolveModel3dGifRenderOptions(options) {
    const current = getModel3dPreviewRenderOptions();
    return {
      renderMode: options && Object.prototype.hasOwnProperty.call(options, "renderMode")
        ? normalizeModel3dPreviewRenderMode(options.renderMode)
        : current.renderMode,
      projection: options && Object.prototype.hasOwnProperty.call(options, "projection")
        ? normalizeModel3dPreviewProjection(options.projection)
        : current.projection
    };
  }

  async function applyModel3dGifExportOverrides(exportOptions) {
    const helpers = model3dViewer.sceneHelpers || {};
    const axis = helpers.axis || null;
    const grid = helpers.grid || null;
    const rigHelper = model3dViewer.rigHelper || null;
    const renderer = model3dViewer.renderer;
    const scene = model3dViewer.scene;
    const THREE = window.DiscrodThree && window.DiscrodThree.THREE;
    const original = {
      gridVisible: grid ? grid.visible === true : null,
      axisVisible: axis ? axis.visible === true : null,
      rigVisible: rigHelper ? rigHelper.visible === true : null,
      background: scene?.background ?? null,
      environment: scene?.environment ?? null,
      clearAlpha: renderer && typeof renderer.getClearAlpha === "function" ? renderer.getClearAlpha() : 1,
      clearColor: renderer && typeof renderer.getClearColor === "function" && THREE ? renderer.getClearColor(new THREE.Color()).clone() : null,
      skyboxEnabled: state.model3dViewerSkyboxEnabled === true
    };
    if (grid) {
      grid.visible = exportOptions.includeGrid === true;
    }
    if (axis) {
      axis.visible = exportOptions.includeAxes === true;
    }
    if (rigHelper) {
      rigHelper.visible = exportOptions.includeRig === true;
    }
    if (exportOptions.backgroundMode === "skybox") {
      state.model3dViewerSkyboxEnabled = true;
      await applyModel3dViewerSkybox();
    } else if (scene && renderer) {
      if (exportOptions.backgroundMode === "transparent") {
        scene.background = null;
        if (typeof renderer.setClearAlpha === "function") {
          renderer.setClearAlpha(0);
        }
      } else if (exportOptions.backgroundMode === "solid" && THREE) {
        scene.background = new THREE.Color(exportOptions.backgroundColor);
        if (typeof renderer.setClearColor === "function") {
          renderer.setClearColor(exportOptions.backgroundColor, 1);
        }
      }
    }
    if (renderer && scene && model3dViewer.camera) {
      renderer.render(scene, model3dViewer.camera);
    }
    return async function restoreModel3dGifExportOverrides() {
      state.model3dViewerSkyboxEnabled = original.skyboxEnabled;
      if (scene) {
        scene.background = original.background;
        scene.environment = original.environment;
      }
      if (grid && original.gridVisible !== null) {
        grid.visible = original.gridVisible;
      }
      if (axis && original.axisVisible !== null) {
        axis.visible = original.axisVisible;
      }
      if (rigHelper && original.rigVisible !== null) {
        rigHelper.visible = original.rigVisible;
      }
      if (renderer) {
        if (typeof renderer.setClearAlpha === "function") {
          renderer.setClearAlpha(original.clearAlpha);
        }
        if (original.clearColor && typeof renderer.setClearColor === "function") {
          renderer.setClearColor(original.clearColor, original.clearAlpha);
        }
      }
      if (renderer && scene && model3dViewer.camera) {
        renderer.render(scene, model3dViewer.camera);
      }
    };
  }

  function setModel3dViewerProjectionMode(nextProjection) {
    const normalized = normalizeModel3dPreviewProjection(nextProjection);
    if (!model3dViewer.ready || !model3dViewer.scene || !model3dViewer.camera || !model3dViewer.renderer || !window.DiscrodThree?.THREE) {
      return;
    }
    const currentCamera = model3dViewer.camera;
    const currentProjection = currentCamera.isOrthographicCamera ? "orthographic" : "perspective";
    const requestedProjection = normalized === "current" ? currentProjection : normalized;
    if (requestedProjection === currentProjection) {
      if (currentCamera.isOrthographicCamera) {
        updateModel3dOrthographicCameraBounds(currentCamera, {
          aspect: getModel3dViewerAspect(),
          maxSize: getModel3dViewerMaxSize(window.DiscrodThree.THREE)
        });
        currentCamera.updateProjectionMatrix();
      }
      return;
    }
    const THREE = window.DiscrodThree.THREE;
    const controls = model3dViewer.controls;
    const target = controls && controls.target ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
    const maxSize = getModel3dViewerMaxSize(THREE);
    const aspect = getModel3dViewerAspect();
    const near = Math.max(0.01, maxSize / 200);
    const far = Math.max(10, maxSize * 30);
    const fov = currentCamera.isPerspectiveCamera && Number.isFinite(currentCamera.fov) ? currentCamera.fov : 45;
    const replacement = requestedProjection === "orthographic"
      ? new THREE.OrthographicCamera(-maxSize * aspect, maxSize * aspect, maxSize, -maxSize, near, far)
      : new THREE.PerspectiveCamera(fov, aspect, near, far);
    replacement.position.copy(currentCamera.position);
    replacement.quaternion.copy(currentCamera.quaternion);
    replacement.up.copy(currentCamera.up);
    replacement.lookAt(target);
    if (replacement.isOrthographicCamera) {
      replacement.userData = replacement.userData || {};
      replacement.userData.orthoFrustumHeight = Math.max(0.25, maxSize * 2.25);
      updateModel3dOrthographicCameraBounds(replacement, { aspect, maxSize });
    }
    replacement.updateProjectionMatrix();
    model3dViewer.camera = replacement;
    if (controls) {
      controls.object = replacement;
      controls.update();
    }
  }

  function getModel3dRenderDirection(THREE, renderMode, fallbackCamera) {
    if (renderMode === "front") return new THREE.Vector3(0, 0, 1);
    if (renderMode === "back") return new THREE.Vector3(0, 0, -1);
    if (renderMode === "left") return new THREE.Vector3(-1, 0, 0);
    if (renderMode === "right") return new THREE.Vector3(1, 0, 0);
    if (renderMode === "top") return new THREE.Vector3(0, 1, 0.001).normalize();
    if (renderMode === "three-quarter") return new THREE.Vector3(1.6, 1.1, 1.7).normalize();
    const direction = fallbackCamera && fallbackCamera.position ? fallbackCamera.position.clone() : new THREE.Vector3(1.6, 1.1, 1.7);
    if (direction.lengthSq() < 0.001) direction.set(1.6, 1.1, 1.7);
    return direction.normalize();
  }

  function applyModel3dPreviewViewSettings(options) {
    if (!model3dViewer.ready || !model3dViewer.renderer || !model3dViewer.scene || !model3dViewer.camera) {
      return;
    }
    const THREE = window.DiscrodThree && window.DiscrodThree.THREE;
    const renderOptions = options || getModel3dPreviewRenderOptions();
    const renderMode = normalizeModel3dPreviewRenderMode(renderOptions.renderMode);
    const projection = normalizeModel3dPreviewProjection(renderOptions.projection);
    setModel3dViewerProjectionMode(projection);
    const camera = model3dViewer.camera;
    const controls = model3dViewer.controls;
    model3dViewer.autoRotate = renderMode === "turntable";
    if (model3dViewer.autoRotate) {
      scheduleModel3dViewerAnimationFrame();
    } else {
      cancelModel3dViewerAnimationFrame();
    }
    if (!THREE || !model3dViewer.root || !camera) {
      updateModel3dViewerLightRig();
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
      return;
    }
    if (renderMode !== "turntable" && renderMode !== "current") {
      const direction = getModel3dRenderDirection(THREE, renderMode, camera);
      const maxSize = getModel3dViewerMaxSize(THREE);
      const distance = maxSize * 2.7;
      const target = controls && controls.target ? controls.target : new THREE.Vector3(0, 0, 0);
      camera.position.copy(direction.multiplyScalar(distance)).add(target);
      camera.near = Math.max(0.01, maxSize / 200);
      camera.far = Math.max(10, maxSize * 30);
      if (camera.isOrthographicCamera) {
        camera.userData = camera.userData || {};
        camera.userData.orthoFrustumHeight = Math.max(0.25, maxSize * 2.25);
        updateModel3dOrthographicCameraBounds(camera, { aspect: getModel3dViewerAspect(), maxSize });
      }
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      if (controls) {
        controls.update();
      }
    }
    updateModel3dViewerLightRig();
    model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
  }
  function switchModel3dViewerToManualOrbit() {
    state.model3dPreviewRenderMode = "current";
    const renderModeNode = document.getElementById("model3d-preview-render-mode");
    if (renderModeNode && typeof renderModeNode.value === "string" && renderModeNode.value !== "current") {
      renderModeNode.value = "current";
    }
    model3dViewer.autoRotate = false;
    cancelModel3dViewerAnimationFrame();
  }
  function keepCurrentModel3dViewerIfAlreadyLoaded(viewerKey, statusText) {
    if (!model3dViewer.root || model3dViewer.loadedModelKey !== viewerKey) {
      return false;
    }
    applyModel3dViewerMaterialOptions();
    updateModel3dViewerLightRig();
    if (model3dViewer.renderer && model3dViewer.scene && model3dViewer.camera) {
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
    }
    if (statusText) {
      setModel3dThreeStatus(statusText);
    }
    return true;
  }
  function bindModel3dManualOrbitGuards(canvas) {
    if (!canvas || canvas.dataset.model3dManualOrbitGuardBound === "true") return;
    canvas.dataset.model3dManualOrbitGuardBound = "true";
    ["pointerdown", "mousedown", "touchstart", "wheel"].forEach(eventName => {
      canvas.addEventListener(eventName, switchModel3dViewerToManualOrbit, { passive: true });
    });
  }

  function createModel3dCaptureCamera(THREE, renderMode, projection, aspect, root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z, 0.01);
    const cameraProjection = projection === "orthographic" || projection === "perspective"
      ? projection
      : (model3dViewer.camera && model3dViewer.camera.isOrthographicCamera ? "orthographic" : "perspective");
    const distance = maxSize * 2.7;
    const direction = getModel3dRenderDirection(THREE, renderMode, model3dViewer.camera);
    const camera = cameraProjection === "orthographic"
      ? new THREE.OrthographicCamera(-maxSize * aspect, maxSize * aspect, maxSize, -maxSize, 0.01, Math.max(10, maxSize * 30))
      : new THREE.PerspectiveCamera(model3dViewer.camera && model3dViewer.camera.fov ? model3dViewer.camera.fov : 45, aspect, 0.01, Math.max(10, maxSize * 30));
    camera.position.copy(direction.multiplyScalar(distance));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    return camera;
  }

  function renderModel3dCaptureFrame(captureCamera) {
    updateModel3dViewerLightRig(captureCamera || model3dViewer.camera);
    model3dViewer.renderer.render(model3dViewer.scene, captureCamera || model3dViewer.camera);
  }

  function getModel3dThemeFallbackSceneColor() {
    const theme = String(state.dashboardTheme || "fire").trim().toLowerCase();
    if (theme === "light") return 0xf0f5fb;
    if (theme === "smoke") return 0x15181d;
    if (theme === "blood") return 0x150407;
    if (theme === "love") return 0x1b0717;
    if (theme === "water") return 0x0d1522;
    if (theme === "crystal") return 0x1a0d22;
    if (theme === "nature") return 0x11170f;
    if (theme === "rock") return 0x151515;
    return 0x120d0d;
  }

  function parseModel3dCssColor(value) {
    const text = String(value || "").trim();
    const hexMatch = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const raw = hexMatch[1].length === 3 ? hexMatch[1].split("").map(part => part + part).join("") : hexMatch[1];
      return Number.parseInt(raw, 16);
    }
    if (/^rgba?\(/i.test(text)) {
      const parts = text.match(/-?\d*\.?\d+/g) || [];
      if (parts.length >= 3) {
        const r = Math.max(0, Math.min(255, Math.round(Number(parts[0]) || 0)));
        const g = Math.max(0, Math.min(255, Math.round(Number(parts[1]) || 0)));
        const b = Math.max(0, Math.min(255, Math.round(Number(parts[2]) || 0)));
        return (r << 16) + (g << 8) + b;
      }
    }
    return null;
  }

  function readModel3dCssColor(names, fallback) {
    const style = window.getComputedStyle?.(document.body || document.documentElement);
    for (const name of names) {
      const parsed = parseModel3dCssColor(style?.getPropertyValue(name));
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  function getModel3dThemeScenePalette() {
    const fallback = getModel3dThemeFallbackSceneColor();
    return {
      scene: readModel3dCssColor(["--model3d-scene-bg", "--studio-panel-bg-soft", "--studio-panel-bg", "--panel-alt", "--panel"], fallback),
      gridMajor: readModel3dCssColor(["--model3d-grid-major", "--studio-accent-1", "--accent", "--rail-icon-model3d"], 0xffa56d),
      gridMinor: readModel3dCssColor(["--model3d-grid-minor", "--studio-panel-border", "--line", "--muted"], 0x48688e)
    };
  }

  function getModel3dThemeSceneColor() {
    return getModel3dThemeScenePalette().scene;
  }

  function applyModel3dViewerHelperTheme(THREE, palette) {
    const grid = model3dViewer.sceneHelpers?.grid || null;
    const colorAttr = grid?.geometry?.getAttribute?.("color") || grid?.geometry?.attributes?.color || null;
    if (!grid || !colorAttr) return;
    const major = new THREE.Color(palette.gridMajor);
    const minor = new THREE.Color(palette.gridMinor);
    const divisions = Math.max(1, Math.round((Number(colorAttr.count) || 0) / 4) - 1);
    const center = divisions / 2;
    for (let index = 0; index < colorAttr.count; index += 1) {
      const group = Math.floor(index / 4);
      const color = group === center ? major : minor;
      colorAttr.setXYZ(index, color.r, color.g, color.b);
    }
    colorAttr.needsUpdate = true;
  }

  function applyModel3dViewerTheme() {
    const THREE = window.DiscrodThree && window.DiscrodThree.THREE;
    if (!THREE || !model3dViewer.scene) {
      return;
    }
    const palette = getModel3dThemeScenePalette();
    model3dViewer.scene.background = new THREE.Color(palette.scene);
    model3dViewer.defaultBackground = model3dViewer.scene.background;
    model3dViewer.scene.fog = new THREE.Fog(palette.scene, 8, 38);
    applyModel3dViewerHelperTheme(THREE, palette);
    if (model3dViewer.renderer) {
      model3dViewer.renderer.setClearColor(palette.scene, 1);
    }
    if (model3dViewer.renderer && model3dViewer.camera) {
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
    }
  }

  window.addEventListener("dashboard:theme-changed", () => {
    applyModel3dViewerTheme();
  });

  async function ensureModel3dViewer() {
    if (model3dViewer.ready) {
      return true;
    }
    const canvas = document.getElementById("model3d-canvas");
    if (!canvas) {
      return false;
    }
    try {
      const three = await waitForThreeLibrary(12_000);
      const THREE = three.THREE;
      const loadingManager = new THREE.LoadingManager();
      loadingManager.setURLModifier(resolveModel3dViewerResourceUrl);
      model3dViewerCanvasInput.bind(canvas);
      model3dViewerSceneInitialization.initialize(three, canvas, loadingManager, getModel3dThemeScenePalette());
      model3dViewerResize.bind(canvas, THREE);
      model3dViewer.ready = true;
      applyModel3dPreviewViewSettings(getModel3dPreviewRenderOptions());
      updateModel3dViewerMaterialToggleButtons();
      void applyModel3dViewerSkybox();
      return true;
    } catch (error) {
      setModel3dThreeStatus((error && error.message) || "Three.js viewer failed to initialize.");
      return false;
    }
  }

  async function renderModel3dViewer() {
    const activeUploadSource = getActiveModel3dUploadViewerSource();
    const selectedModels = getSelectedGeneratedModels();
    if (!activeUploadSource && renderModel3dMainMultiSelection(selectedModels)) {
      return;
    }
    if (model3dViewer.previewActive !== true) {
      setModel3dThreeStatus("Click the preview to load the selected model in Three.js.");
      return;
    }
    if (activeUploadSource) {
      renderModel3dUploadSourceMeta(activeUploadSource);
      updateModel3dThreeVariantUi();
      const viewerReady = await ensureModel3dViewer();
      if (!viewerReady || !model3dViewer.scene || !model3dViewer.camera) {
        return;
      }
      const uploadLoader = getModel3dViewerLoader(activeUploadSource.fileName);
      if (!uploadLoader) {
        setModel3dThreeStatus("Preview for uploaded file is not supported. Use .glb, .gltf, .fbx, or .obj.");
        return;
      }
      const viewerTarget = { fileName: activeUploadSource.fileName, key: "uploaded|" + activeUploadSource.key, variantSuffix: " (uploaded)" };
      if (keepCurrentModel3dViewerIfAlreadyLoaded(viewerTarget.key, "Previewing uploaded model " + viewerTarget.fileName + ".")) {
        return;
      }
      setModel3dViewerResourceContext(null);
      const loadId = createImageId();
      beginModel3dViewerLoad(loadId);
      setModel3dThreeStatus("Loading uploaded model " + viewerTarget.fileName + "...");
      try {
        const loadedAsset = await loadModel3dViewerAsset(uploadLoader, activeUploadSource.fileName, activeUploadSource.objectUrl);
        if (discardStaleModel3dViewerLoad(loadId, activeUploadSource.fileName, loadedAsset)) {
          return;
        }
        const THREE = window.DiscrodThree.THREE;
        const nextRoot = resolveModel3dViewerRoot(activeUploadSource.fileName, loadedAsset);
        if (!nextRoot) {
          clearModel3dViewerLoadedIdentity();
          model3dViewer.root = null;
          setModel3dThreeStatus("Loaded file did not contain a previewable mesh.");
          return;
        }
        replaceModel3dViewerRoot(nextRoot);
        fitModelInCamera(THREE, model3dViewer.camera, model3dViewer.root, model3dViewer.controls);
        applyModel3dPreviewViewSettings(getModel3dPreviewRenderOptions());
        applyModel3dViewerMaterialOptions();
        const derivedInspection = buildModel3dDerivedInspection(model3dViewer.root, {
          fileName: viewerTarget.fileName,
          sourceUrl: activeUploadSource.objectUrl
        });
        renderModel3dViewportStats(buildModel3dViewportStatsFromInspection(derivedInspection));
        model3dViewer.loadedModelId = "uploaded";
        model3dViewer.loadedModelKey = viewerTarget.key;
        model3dViewer.loadedModelFileName = viewerTarget.fileName;
        const patchText = model3dViewer.lastFbxTexturePatch?.replacements > 0
          ? " Patched " + model3dViewer.lastFbxTexturePatch.replacements + " embedded .fbm texture reference(s) to " + model3dViewer.lastFbxTexturePatch.replacement + "."
          : "";
        setModel3dThreeStatus("Previewing uploaded model " + viewerTarget.fileName + "." + patchText);
      } catch (error) {
        if (model3dViewer.currentLoadId !== loadId) {
          return;
        }
        clearModel3dViewerLoadedIdentity();
        model3dViewer.root = null;
        setModel3dThreeStatus("Failed to load uploaded model: " + ((error && error.message) || "Unknown loader error."));
      }
      return;
    }
    const selected = getSelectedGeneratedModel();
    renderModel3dMeta(selected);
    updateModel3dThreeVariantUi();
    if (!selected) {
      if (model3dViewer.scene && model3dViewer.root) {
        removeModel3dRigHelper();
        model3dViewer.scene.remove(model3dViewer.root);
        resetModel3dViewerMaterialCaches();
      }
      model3dViewer.root = null;
      model3dViewer.loadedModelId = "";
      model3dViewer.loadedModelKey = "";
      model3dViewer.loadedModelFileName = "";
      updateModel3dSceneHelpers(1);
      setModel3dThreeStatus("Select a generated model to preview it here.");
      return;
    }
    const viewerTarget = getModel3dViewerTarget(selected);
    if (!viewerTarget.fileName) {
      if (model3dViewer.scene && model3dViewer.root) {
        removeModel3dRigHelper();
        model3dViewer.scene.remove(model3dViewer.root);
        resetModel3dViewerMaterialCaches();
      }
      model3dViewer.root = null;
      model3dViewer.loadedModelId = "";
      model3dViewer.loadedModelKey = "";
      model3dViewer.loadedModelFileName = "";
      updateModel3dSceneHelpers(1);
      setModel3dThreeStatus("Selected entry has no model file to preview.");
      return;
    }
    const viewerReady = await ensureModel3dViewer();
    if (!viewerReady || !model3dViewer.scene || !model3dViewer.camera) {
      return;
    }
    const selectedLoader = getModel3dViewerLoader(viewerTarget.fileName);
    if (!selectedLoader) {
      setModel3dThreeStatus("Preview for " + viewerTarget.fileName + " is not supported in browser viewer.");
      return;
    }
    if (keepCurrentModel3dViewerIfAlreadyLoaded(viewerTarget.key, "Previewing " + viewerTarget.fileName + viewerTarget.variantSuffix + ".")) {
      model3dViewer.loadedModelId = selected.id;
      model3dViewer.loadedModelFileName = viewerTarget.fileName;
      return;
    }
    clearModel3dDerivedInspection(selected.id);
    setModel3dViewerResourceContext({
      modelId: selected.id,
      fileName: viewerTarget.fileName,
      sourceImageFileName: selected.sourceImageFileName,
      previewImageFileName: selected.previewImageFileName,
      previewGifFileName: selected.previewGifFileName,
      uvMapFileName: selected.uvMapFileName,
      uvMapInpaintFileName: selected.uvMapInpaintFileName,
      normalMapFileName: selected.normalMapFileName,
      multiViewFileNames: selected.multiViewFileNames
    });
    const loadId = createImageId();
    beginModel3dViewerLoad(loadId);
    setModel3dThreeStatus("Loading " + viewerTarget.fileName + viewerTarget.variantSuffix + "...");
    try {
      const sourceUrl = getModel3dFileUrl(selected.id, viewerTarget.fileName);
      const loadedAsset = await loadModel3dViewerAsset(selectedLoader, viewerTarget.fileName, sourceUrl);
      if (discardStaleModel3dViewerLoad(loadId, viewerTarget.fileName, loadedAsset)) {
        return;
      }
      const THREE = window.DiscrodThree.THREE;
      const nextRoot = resolveModel3dViewerRoot(viewerTarget.fileName, loadedAsset);
      if (!nextRoot) {
        clearModel3dViewerLoadedIdentity();
        model3dViewer.root = null;
        setModel3dThreeStatus("Loaded file did not contain a previewable mesh.");
        return;
      }
      replaceModel3dViewerRoot(nextRoot, root => {
        repairLoosePartsPreviewMaterials(root, viewerTarget.fileName, { materialMode: state.model3dViewerMaterialMode });
      });
      fitModelInCamera(THREE, model3dViewer.camera, model3dViewer.root, model3dViewer.controls);
      applyModel3dPreviewViewSettings(getModel3dPreviewRenderOptions());
      // A camera captured from another asset can be several orders of magnitude
      // too near or far for an imported model. Always frame a newly selected
      // asset from its own world bounds instead of restoring that stale camera.
      applyModel3dViewerMaterialOptions();
      const derivedInspection = buildModel3dDerivedInspection(model3dViewer.root, {
        fileName: viewerTarget.fileName,
        sourceUrl
      });
      storeModel3dDerivedInspection(selected, viewerTarget, derivedInspection);
      model3dViewer.loadedModelId = selected.id;
      model3dViewer.loadedModelKey = viewerTarget.key;
      model3dViewer.loadedModelFileName = viewerTarget.fileName;
      const patchText = model3dViewer.lastFbxTexturePatch?.replacements > 0
        ? " Patched " + model3dViewer.lastFbxTexturePatch.replacements + " embedded .fbm texture reference(s) to " + model3dViewer.lastFbxTexturePatch.replacement + "."
        : "";
      setModel3dThreeStatus("Previewing " + viewerTarget.fileName + viewerTarget.variantSuffix + "." + patchText);
      void inspectSelectedModel({ record: selected }).catch(() => {});
    } catch (error) {
      if (model3dViewer.currentLoadId !== loadId) {
        return;
      }
      clearModel3dViewerLoadedIdentity();
      model3dViewer.root = null;
      setModel3dThreeStatus("Failed to load model: " + ((error && error.message) || "Unknown loader error."));
    }
  }

  async function renderModel3dPreviewGifBlob(options) {
    model3dViewer.previewActive = true;
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      setOutput("Select a generated model first.");
      return null;
    }
    const viewerTarget = getModel3dViewerTarget(selected);
    if (model3dViewer.loadedModelKey !== viewerTarget.key) {
      await renderModel3dViewer();
    }
    const viewerReady = await ensureModel3dViewer();
    if (!viewerReady || !model3dViewer.renderer || !model3dViewer.scene || !model3dViewer.camera || !model3dViewer.root || model3dViewer.loadedModelKey !== viewerTarget.key) {
      setOutput("Three.js preview is not ready yet.");
      return null;
    }
    if (typeof window.GIF !== "function") {
      setOutput("GIF exporter library is not loaded.");
      return null;
    }
    const canvas = document.getElementById("model3d-canvas");
    if (!canvas) {
      setOutput("Preview canvas is missing.");
      return null;
    }
      const renderOptions = resolveModel3dGifRenderOptions(options);
    const exportOptions = normalizeModel3dGifExportOptions(options, renderOptions);
    const isTurntable = renderOptions.renderMode === "turntable";
    const frameCount = exportOptions.frameCount;
    const frameDelay = exportOptions.frameDelay;
    const startRotation = model3dViewer.root.rotation.y;
    const gifSize = exportOptions.size;
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = gifSize;
    frameCanvas.height = gifSize;
    const gif = new window.GIF({
      workers: 4,
      quality: 10,
      width: gifSize,
      height: gifSize,
      workerScript: "/vendor/gif.worker.js"
    });
    const THREE = window.DiscrodThree && window.DiscrodThree.THREE;
    const captureCamera = THREE && (renderOptions.renderMode !== "current" || renderOptions.projection !== "current")
      ? createModel3dCaptureCamera(THREE, renderOptions.renderMode, renderOptions.projection, 1, model3dViewer.root)
      : null;
    const previousAutoRotate = model3dViewer.autoRotate === true;
    const restoreExportOverrides = await applyModel3dGifExportOverrides(exportOptions);
    model3dViewer.autoRotate = false;
    const renderLabel = isTurntable ? "turntable" : renderOptions.renderMode.replace("-", " ");
    const projectionLabel = renderOptions.projection === "current" ? "current projection" : renderOptions.projection;
    setModel3dStatus("Rendering " + renderLabel + " preview GIF...");
    setModel3dThreeStatus("Rendering " + renderLabel + " GIF frames (" + projectionLabel + ")...");
    try {
      for (let index = 0; index < frameCount; index += 1) {
        model3dViewer.root.rotation.y = isTurntable ? startRotation + ((Math.PI * 2 * index) / frameCount) : startRotation;
        renderModel3dCaptureFrame(captureCamera || model3dViewer.camera);
        drawSquaredModel3dGifFrame(frameCanvas, canvas);
        gif.addFrame(frameCanvas, { copy: true, delay: isTurntable ? frameDelay : 350 });
      }
      const blob = await new Promise((resolve, reject) => {
        gif.on("finished", result => resolve(result));
        gif.on("abort", () => reject(new Error("GIF rendering aborted.")));
        gif.render();
      });
      const normalizedBlob = blob instanceof Blob ? blob : new Blob([blob], { type: "image/gif" });
      const gifBlob = normalizedBlob.type === "image/gif" ? normalizedBlob : new Blob([normalizedBlob], { type: "image/gif" });
      setModel3dThreeStatus("Previewing " + viewerTarget.fileName + viewerTarget.variantSuffix + ".");
      return { selected, viewerTarget, blob: gifBlob, renderOptions };
    } catch (error) {
      setModel3dStatus("GIF export failed.");
      setOutput("Failed to export rotating GIF: " + ((error && error.message) || "Unknown error"));
      return null;
    } finally {
      await restoreExportOverrides();
      model3dViewer.root.rotation.y = startRotation;
      model3dViewer.renderer.render(model3dViewer.scene, model3dViewer.camera);
      model3dViewer.autoRotate = previousAutoRotate && normalizeModel3dPreviewRenderMode(state.model3dPreviewRenderMode) === "turntable";
      if (model3dViewer.autoRotate) {
        scheduleModel3dViewerAnimationFrame();
      }
    }
  }

  async function renderModel3dPreviewGifDataUrl(options) {
    const rendered = await renderModel3dPreviewGifBlob(options);
    if (!rendered) {
      return "";
    }
    const typedBlob = rendered.blob.type === "image/gif" ? rendered.blob : new Blob([rendered.blob], { type: "image/gif" });
    const dataUrl = await readBlobAsDataUrl(typedBlob);
    if (!dataUrl) {
      setOutput("Failed to encode rotating GIF.");
      return "";
    }
    setModel3dStatus("Rotating GIF rendered.");
    return dataUrl;
  }

  async function exportModel3dPreviewGif(options) {
    const rendered = await renderModel3dPreviewGifBlob(options);
    if (!rendered) {
      return;
    }
    const gifBlob = rendered.blob.type === "image/gif" ? rendered.blob : new Blob([rendered.blob], { type: "image/gif" });
    const downloadUrl = URL.createObjectURL(gifBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "model-preview-" + rendered.selected.id + ".gif";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setModel3dStatus("Rotating GIF exported.");
    setModel3dThreeStatus("Previewing " + rendered.viewerTarget.fileName + rendered.viewerTarget.variantSuffix + ".");
    const modeLabel = rendered.renderOptions && rendered.renderOptions.renderMode !== "turntable"
      ? rendered.renderOptions.renderMode.replace("-", " ") + " preview"
      : "rotating GIF";
    setOutput("Exported " + modeLabel + " for " + rendered.viewerTarget.fileName + rendered.viewerTarget.variantSuffix + ".");
    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 10_000);
  }

  function scheduleModel3dHistoryRefresh(preferredModelId, previousFileName) {
    let attempts = 0;
    const maxAttempts = 24;
    const refresh = async () => {
      attempts += 1;
      try {
        await loadModel3dHistory(preferredModelId);
        const refreshed = state.generatedModels.find(item => item.id === preferredModelId) || null;
        if (refreshed && previousFileName && refreshed.modelFileName && refreshed.modelFileName !== previousFileName) {
          setModel3dStatus("3D model metadata updated: " + refreshed.modelFileName + ".");
          return;
        }
      } catch {}
      if (attempts < maxAttempts) {
        setTimeout(() => {
          void refresh();
        }, 2000);
      }
    };
    setTimeout(() => {
      void refresh();
    }, 2000);
  }

  return {
    model3dViewer,
    describeModel3dScaleDecision,
    getModel3dStatusText,
    setModel3dStatus,
    setModel3dPreviewStatus,
    setModel3dThreeStatus,
    unloadModel3dViewerPreview,
    activateModel3dViewerPreview,
    handleModel3dLowPolyUploadSourceChange,
    loadModel3dHistory,
    scheduleModel3dHistoryRefresh,
    renderModel3dHistory,
    renderModel3dBottomQueue,
    renderModel3dPreviewMedia,
    getModel3dViewerTarget,
    resolveModel3dPreviewMedia,
    renderModel3dViewer,
    renderModel3dPreviewGifDataUrl,
    exportModel3dPreviewGif,
    setModel3dThreeVariant,
    updateModel3dThreeVariantUi,
    setModel3dViewerWireframeEnabled,
    setModel3dViewerMetallicEnabled,
    updateModel3dViewerMaterialToggleButtons,
    updateModel3dViewerRoughnessUi,
    setModel3dViewerRoughness,
    setModel3dViewerTextureEnabled,
    setModel3dViewerMaterialMode,
    setModel3dViewerFlatShadingEnabled,
    setModel3dViewerGridEnabled,
    setModel3dViewerSkyboxEnabled,
    setModel3dViewerRigVisible,
    setModel3dViewerAxisMode,
    applyModel3dPreviewViewSettings,
    getModel3dPreviewRenderOptions,
    focusModel3dViewer,
    resetModel3dViewerCamera,
    setModel3dViewerGizmoView
  };
}
