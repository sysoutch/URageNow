function createDashboardThreeDViewerAssetLoaderHelpers(input) {
  const viewer = input.viewer;
  const fetchResource = input.fetch || fetch;

  function resolveFormat(fileName) {
    const normalized = String(fileName || "").trim().toLowerCase();
    if (normalized.endsWith(".glb") || normalized.endsWith(".gltf")) return "gltf";
    if (normalized.endsWith(".fbx")) return "fbx";
    if (normalized.endsWith(".obj")) return "obj";
    return "";
  }

  function isPreviewable(fileName) {
    return resolveFormat(fileName).length > 0;
  }

  function getLoader(fileName) {
    const format = resolveFormat(fileName);
    return format && viewer.loaders ? viewer.loaders[format] || null : null;
  }

  function resolveRoot(fileName, loadedAsset) {
    return resolveFormat(fileName) === "gltf" ? loadedAsset?.scene || null : loadedAsset || null;
  }

  function inferEmbeddedTextureExtension(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const hasPattern = pattern => {
      for (let index = 0; index <= bytes.length - pattern.length; index += 1) {
        if (pattern.every((value, offset) => bytes[index + offset] === value)) return true;
      }
      return false;
    };
    if (hasPattern([0x89, 0x50, 0x4e, 0x47])) return "png";
    if (hasPattern([0xff, 0xd8, 0xff])) return "jpg";
    if (hasPattern([0x42, 0x4d])) return "bmp";
    return "png";
  }

  function normalizeEmbeddedTextureExtension(ext) {
    const normalized = String(ext || "").trim().toLowerCase().replace(/^\./, "");
    if (normalized === "jpg" || normalized === "jpeg") return ".jpg";
    if (normalized === "tga") return ".tga";
    if (normalized === "bmp") return ".bmp";
    return ".png";
  }

  function patchFbxTextureReferences(arrayBuffer, extensionHint) {
    const replacement = normalizeEmbeddedTextureExtension(extensionHint);
    const outputBytes = new Uint8Array(new Uint8Array(arrayBuffer));
    const replacementBytes = replacement.split("").map(char => char.charCodeAt(0));
    const patterns = [[46, 102, 98, 109], [46, 70, 66, 77], [46, 70, 98, 109]];
    let replacements = 0;
    for (let index = 0; index <= outputBytes.length - 4; index += 1) {
      for (const pattern of patterns) {
        if (!pattern.every((value, offset) => outputBytes[index + offset] === value)) continue;
        replacementBytes.forEach((value, offset) => { outputBytes[index + offset] = value; });
        replacements += 1;
        break;
      }
    }
    return {buffer: outputBytes.buffer, replacements, replacement};
  }

  async function loadFbxWithTexturePatch(loader, url, name) {
    const response = await fetchResource(url, {cache: "no-store"});
    if (!response.ok) throw new Error("Failed to load FBX file: HTTP " + response.status);
    const originalBuffer = await response.arrayBuffer();
    const patch = patchFbxTextureReferences(originalBuffer, inferEmbeddedTextureExtension(originalBuffer));
    const loadedAsset = loader.parse(patch.replacements > 0 ? patch.buffer : originalBuffer, "");
    viewer.lastFbxTexturePatch = patch;
    if (patch.replacements > 0) {
      input.setStatus("Patched " + patch.replacements + " embedded .fbm texture reference(s) to " + patch.replacement + " for " + name + ".");
    }
    return loadedAsset;
  }

  async function load(loader, fileName, url) {
    viewer.lastFbxTexturePatch = null;
    if (resolveFormat(fileName) === "fbx" && typeof loader?.parse === "function") return loadFbxWithTexturePatch(loader, url, fileName);
    return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  }

  return {getLoader, inferEmbeddedTextureExtension, isPreviewable, load, patchFbxTextureReferences, resolveFormat, resolveRoot};
}
