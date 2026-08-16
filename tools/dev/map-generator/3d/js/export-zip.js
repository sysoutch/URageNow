// =========================================================
// Export ZIP - Bundle PNG + JSON + models into a downloadable zip
// =========================================================

import { exportRendererPng, renderMap } from "./renderer.js";
import { getModelAssets } from "./model-assets.js";
import { state } from "./state.js";

let jsZipLoaded = false;

function ensureJsZip(callback, errorCallback) {
  if (typeof JSZip !== "undefined") {
    callback();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  script.onload = () => { jsZipLoaded = true; callback(); };
  script.onerror = () => {
    const error = new Error("[MapGenerator] Failed to load JSZip from CDN.");
    console.error(error.message);
    if (typeof errorCallback === "function") errorCallback(error);
  };
  document.head.appendChild(script);
}

function ensureJsZipAsync() {
  return new Promise((resolve, reject) => {
    ensureJsZip(resolve, reject);
  });
}

let _canvasRef = null;

export function setCanvasReference(canvasEl) {
  _canvasRef = canvasEl;
}

function getCanvas() {
  return _canvasRef || document.getElementById("mapCanvas");
}

function buildFileName() {
  const canvas = getCanvas();
  return `3d-game-map-${state.mode === "topdown-flat" ? "topdown" : state.mode}-${state.seed}`;
}

export function exportPngOnly() {
  const canvas = getCanvas();
  renderMap(canvas, state);
  const link = document.createElement("a");
  link.download = `${buildFileName()}.png`;
  link.href = exportRendererPng();
  link.click();
}

export function exportJsonOnly() {
  const payload = buildMapJsonPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.download = `${buildFileName()}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function exportZip() {
  buildZipBlob().then(result => {
    const link = document.createElement("a");
    link.download = result.fileName;
    link.href = URL.createObjectURL(result.blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }).catch(error => {
    console.error("[MapGenerator] ZIP export failed.", error);
  });
}

export async function buildZipBlob() {
  await ensureJsZipAsync();
  const canvas = getCanvas();
  const zip = new JSZip();
  const folderName = buildFileName();
  const root = zip.folder(folderName);

  // Add PNG render
  renderMap(canvas, state);
  const pngDataUrl = exportRendererPng();
  const pngBase64 = pngDataUrl.split(",")[1] || "";
  root.file("preview.png", pngBase64, { base64: true });

  // Add JSON map data
  const jsonPayload = buildMapJsonPayload();
  root.file("map.json", JSON.stringify(jsonPayload, null, 2));

  // Add uploaded models to a models/ folder
  const modelAssets = getModelAssets();
  if (modelAssets.length > 0) {
    const modelsFolder = root.folder("models");
    modelAssets.forEach(asset => {
      // Store metadata about each model asset
      modelsFolder.file(`${asset.name}.meta.json`, JSON.stringify({
        name: asset.name,
        role: asset.role,
        scale: asset.scale,
        id: asset.id
      }, null, 2));
    });
  }

  // Add settings summary
  root.file("settings.json", JSON.stringify({
    tool: "map-generator",
    version: 2,
    mode: state.mode,
    projection: state.projection,
    palette: state.palette,
    seed: state.seed,
    width: state.width,
    depth: state.depth,
    density: state.density,
    height: state.height,
    pathWidth: state.pathWidth,
    gap: state.gap,
    yaw: state.yaw,
    pitch: state.pitch,
    zoom: state.zoom,
    mirrorPattern: state.mirrorPattern,
    mirrorRepeatX: state.mirrorRepeatX,
    mirrorRepeatY: state.mirrorRepeatY,
    propDensity: state.propDensity,
    modelCount: modelAssets.length
  }, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, fileName: `${folderName}.zip`, folderName };
}

function buildMapJsonPayload() {
  return {
    tool: "map-generator",
    version: 2,
    mode: "3d",
    settings: { ...state, map: undefined },
    map: state.map
  };
}

// Export for auto-describe bridge
export function describeCurrentAssets() {
  const canvas = getCanvas();
  renderMap(canvas, state);
  const pngDataUrl = exportRendererPng();
  const jsonText = JSON.stringify(buildMapJsonPayload(), null, 2);
  return [
    {
      kind: "image",
      title: "3D Game Map PNG",
      fileName: `${buildFileName()}.png`,
      mimeType: "image/png",
      dataUrl: pngDataUrl,
      width: canvas?.width || 0,
      height: canvas?.height || 0,
      previewKind: "image",
      previewUrl: pngDataUrl,
      sourceDetail: "Rendered blockout preview from Map Generator 3D mode.",
      metadata: { sourceTool: "map-generator", mode: "3d", mapMode: state.mode, projection: state.projection }
    },
    {
      kind: "text",
      title: "3D Game Map JSON",
      fileName: `${buildFileName()}.json`,
      mimeType: "application/json",
      textContent: jsonText,
      previewKind: "text",
      previewText: jsonText,
      sourceDetail: "Structured 3D blockout data from Map Generator 3D mode.",
      metadata: { sourceTool: "map-generator", mode: "3d", resourceFormat: "blockout-json" }
    }
  ];
}

// Exported for testing
export { buildMapJsonPayload };
