function createDashboardModel3dLoosePartsPreviewHelpers(input) {
  const state = input?.state || {};
  const colorPalette = [
    0xb9d38b,
    0xe48b4b,
    0xf1d6a2,
    0x8f6b45,
    0x9fc8e8,
    0xc89bd8,
    0xd9655b,
    0x78b7a4
  ];
  function isLoosePartsFileName(fileName) {
    return /(?:loose[_-]?parts|_part_\d{3})/i.test(String(fileName || ""));
  }
  function isLoosePartsFbxFileName(fileName) {
    return isLoosePartsFileName(fileName) && /\.fbx$/i.test(String(fileName || ""));
  }
  function getStablePaletteIndex(seed) {
    const text = String(seed || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) % colorPalette.length;
  }
  function hasUsableTexture(material) {
    const mapImage = material?.map?.image || null;
    return Boolean(material?.map && mapImage && (
      mapImage.width > 1
      || mapImage.videoWidth > 1
      || mapImage.naturalWidth > 1
    ));
  }
  function hasTextureReference(material) {
    return Boolean(material?.map || material?.normalMap || material?.emissiveMap || material?.aoMap);
  }
  function getMaterialLuminance(material) {
    const red = typeof material?.color?.r === "number" ? material.color.r : 0;
    const green = typeof material?.color?.g === "number" ? material.color.g : 0;
    const blue = typeof material?.color?.b === "number" ? material.color.b : 0;
    return (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
  }
  function isBrokenMaterial(material) {
    if (!material || typeof material !== "object") {
      return true;
    }
    if (hasUsableTexture(material) || hasTextureReference(material)) {
      return false;
    }
    const luminance = getMaterialLuminance(material);
    return luminance < 0.18 || luminance > 0.88 || material.vertexColors === true;
  }
  function getRoughness() {
    return Number.isFinite(state.model3dViewerRoughness)
      ? Math.max(0, Math.min(1, state.model3dViewerRoughness))
      : 0.68;
  }
  function tuneSourceMaterial(material) {
    if (!material || typeof material !== "object") {
      return;
    }
    const flatShadingEnabled = state.model3dViewerFlatShadingEnabled === true;
    if ("flatShading" in material) material.flatShading = flatShadingEnabled;
    if ("vertexColors" in material) material.vertexColors = false;
    if ("wireframe" in material) material.wireframe = state.model3dViewerWireframeEnabled === true;
    if ("metalness" in material) material.metalness = 0;
    if ("roughness" in material) material.roughness = getRoughness();
    if ("metalnessMap" in material) material.metalnessMap = null;
    if ("roughnessMap" in material) material.roughnessMap = null;
    if (flatShadingEnabled) {
      ["normalMap", "bumpMap", "displacementMap"].forEach(key => {
        if (key in material) material[key] = null;
      });
    }
    material.needsUpdate = true;
  }
  function createFallbackMaterial(THREE, sourceMaterial, seed) {
    const color = colorPalette[getStablePaletteIndex(seed)];
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.18,
      metalness: 0,
      roughness: getRoughness(),
      flatShading: state.model3dViewerFlatShadingEnabled === true,
      wireframe: state.model3dViewerWireframeEnabled === true,
      transparent: sourceMaterial?.transparent === true,
      opacity: typeof sourceMaterial?.opacity === "number" ? sourceMaterial.opacity : 1,
      side: sourceMaterial?.side
    });
    material.userData = {
      ...(sourceMaterial?.userData || {}),
      model3dLoosePartsPreviewRepair: true,
      model3dViewportOverride: true
    };
    return material;
  }
  function repair(root, fileName, helpers, options) {
    if (!isLoosePartsFileName(fileName)) {
      return;
    }
    const materialMode = String(options?.materialMode || state.model3dViewerMaterialMode || "textured").trim().toLowerCase();
    if (materialMode !== "textured" && materialMode !== "material") {
      return;
    }
    const THREE = window.DiscrodThree?.THREE;
    if (!THREE?.MeshStandardMaterial || typeof helpers?.forEachModel3dMesh !== "function") {
      return;
    }
    const forceFallback = materialMode === "material" && isLoosePartsFbxFileName(fileName);
    helpers.forEachModel3dMesh(root, (mesh, meshIndex) => {
      if (!mesh || !mesh.material) {
        return;
      }
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const repairedMaterials = sourceMaterials.map((material, materialIndex) => {
        const seed = [fileName, mesh.name, meshIndex, material?.name, materialIndex].join("|");
        if (!forceFallback && !isBrokenMaterial(material)) {
          tuneSourceMaterial(material);
          return material;
        }
        return createFallbackMaterial(THREE, material, seed);
      });
      mesh.material = Array.isArray(mesh.material) ? repairedMaterials : repairedMaterials[0];
    });
  }
  return {
    isLoosePartsFileName,
    repair
  };
}
