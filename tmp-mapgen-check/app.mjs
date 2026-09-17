import { generateMap } from "./generator.js";
import { getModelAssets, importModelFiles } from "./model-assets.js";
import { exportRendererPng, getSceneStats, renderMap, setupScrollZoom } from "./renderer.js";
import { state, syncStateFromControls } from "./state.js";
import { registerToolTheme } from "./theme.js";
import { setCanvasReference, exportZip as doExportZip, buildZipBlob } from "./export-zip.js";

const canvas = document.getElementById("mapCanvas");
const statsNode = document.getElementById("mapStats");
const titleNode = document.getElementById("previewTitle");
const assetListNode = document.getElementById("modelAssetList");

let lastControlSignature = "";
let refreshQueued = false;

function getControl(id) {
  return document.getElementById(id);
}

function updateButtons(selector, valueAttr, value) {
  document.querySelectorAll(selector).forEach(button => {
    button.classList.toggle("active", button.getAttribute(valueAttr) === value);
  });
}

function updateUiText() {
  const modeLabel = state.mode === "sidescroller" ? "Side Scroller" : state.mode === "isometric" ? "Isometric" : "Topdown";
  const projectionLabel = state.projection === "perspective" ? "Perspective" : "Orthographic";
  titleNode.textContent = `${modeLabel} ${projectionLabel} Blockout`;
  const tiles = state.map.flat().filter(tile => tile && tile.kind !== "empty").length;
  const sprites = (state.spriteLayers || []).length;
  statsNode.textContent = `${tiles} solid tiles${sprites ? ` · ${sprites} sprites` : ""}`;
}

function updateAssetList() {
  const assets = getModelAssets();
  if (!assets.length) {
    assetListNode.textContent = "No imported models.";
    return;
  }
  assetListNode.innerHTML = "";
  assets.forEach(asset => {
    const row = document.createElement("div");
    row.className = "asset-row";
    row.innerHTML = `<strong>${asset.name}</strong><span class="asset-pill">${asset.role === "tile" ? "blocks" : "objects"}</span>`;
    assetListNode.appendChild(row);
  });
}

function controlSignature() {
  return JSON.stringify({
    mode: state.mode,
    projection: state.projection,
    palette: state.palette,
    seed: getControl("seedInput")?.value,
    width: getControl("widthInput")?.value,
    depth: getControl("depthInput")?.value,
    density: getControl("densityInput")?.value,
    height: getControl("heightInput")?.value,
    pathWidth: getControl("pathWidthInput")?.value,
    gap: getControl("gapInput")?.value,
    yaw: getControl("yawInput")?.value,
    pitch: getControl("pitchInput")?.value,
    zoom: getControl("zoomInput")?.value,
    mirrorPattern: getControl("mirrorPatternInput")?.value,
    mirrorRepeatX: getControl("mirrorRepeatXInput")?.value,
    mirrorRepeatY: getControl("mirrorRepeatYInput")?.value,
    propDensity: getControl("propDensityInput")?.value
  });
}

function refresh(options = {}) {
  syncStateFromControls();
  if (options.forceNewSeed) {
    const nextSeed = Math.floor(1 + Math.random() * 999999);
    const seedInput = getControl("seedInput");
    if (seedInput) seedInput.value = String(nextSeed);
    state.seed = nextSeed;
  }
  lastControlSignature = controlSignature();
  state.map = generateMap(state);
  renderMap(canvas, state);
  updateUiText();
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    const signature = controlSignature();
    if (signature !== lastControlSignature) {
      refresh();
    }
  });
}

function exportPng() {
  renderMap(canvas, state);
  const link = document.createElement("a");
  link.download = buildMapFileName(".png");
  link.href = exportRendererPng();
  link.click();
}

function exportJson() {
  const payload = buildMapJsonPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.download = buildMapFileName(".json");
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function buildMapFileName(extension) {
  return `3d-game-map-${state.mode === "topdown-flat" ? "topdown" : state.mode}-${state.seed}${extension}`;
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

// Register canvas reference for export-zip module
setCanvasReference(canvas);

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob."));
    reader.readAsDataURL(blob);
  });
}

async function describeCurrentAssets() {
  renderMap(canvas, state);
  const pngDataUrl = exportRendererPng();
  const jsonText = JSON.stringify(buildMapJsonPayload(), null, 2);
  const descriptors = [
    {
      kind: "image",
      title: "3D Game Map PNG",
      fileName: buildMapFileName(".png"),
      mimeType: "image/png",
      dataUrl: pngDataUrl,
      width: canvas.width,
      height: canvas.height,
      previewKind: "image",
      previewUrl: pngDataUrl,
      sourceDetail: "Rendered blockout preview from Map Generator 3D mode.",
      metadata: { sourceTool: "map-generator", mode: "3d", mapMode: state.mode, projection: state.projection }
    },
    {
      kind: "text",
      title: "3D Game Map JSON",
      fileName: buildMapFileName(".json"),
      mimeType: "application/json",
      textContent: jsonText,
      previewKind: "text",
      previewText: jsonText,
      sourceDetail: "Structured 3D blockout data from Map Generator 3D mode.",
      metadata: { sourceTool: "map-generator", mode: "3d", resourceFormat: "blockout-json" }
    }
  ];
  try {
    const zipResult = await buildZipBlob();
    descriptors.push({
      kind: "file",
      title: "3D Game Map ZIP",
      fileName: zipResult.fileName,
      mimeType: "application/zip",
      dataUrl: await blobToDataUrl(zipResult.blob),
      previewKind: "file",
      sourceDetail: "Complete 3D blockout package with JSON, preview image, settings, and model metadata.",
      metadata: { sourceTool: "map-generator", mode: "3d", resourceFormat: "map-generator-zip" }
    });
  } catch (error) {
    console.warn("[MapGenerator 3D] Could not describe ZIP output.", error);
  }
  return descriptors;
}

function bindControls() {
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.matches("[data-mode]")) {
      state.mode = button.getAttribute("data-mode") || "topdown-flat";
      updateButtons("[data-mode]", "data-mode", state.mode);
      refresh();
      return;
    }
    if (button.matches("[data-projection]")) {
      state.projection = button.getAttribute("data-projection") || "orthographic";
      updateButtons("[data-projection]", "data-projection", state.projection);
      refresh();
      return;
    }
    if (button.matches("[data-palette]")) {
      state.palette = button.getAttribute("data-palette") || "ruins";
      updateButtons("[data-palette]", "data-palette", state.palette);
      refresh();
      return;
    }
    if (button.id === "generateButton") {
      state.spriteLayers = [];
      refresh({ forceNewSeed: true });
      return;
    }
    if (button.id === "randomizeSeedButton") {
      state.spriteLayers = [];
      refresh({ forceNewSeed: true });
      return;
    }
    if (button.id === "exportPngButton") {
      exportPng();
      return;
    }
    if (button.id === "exportJsonButton") {
      exportJson();
      return;
    }
    if (button.id === "exportZipButton") {
      doExportZip();
      return;
    }
  });

  document.addEventListener("input", event => {
    if (event.target.matches("input, select")) queueRefresh();
  });
  document.addEventListener("change", event => {
    if (!event.target.matches("input, select")) return;
    if (event.target.id === "modelFileInput") return;
    if (event.target.id === "spriteToggleInput") {
      state.showSprites = event.target.checked;
      renderMap(canvas, state);
      updateUiText();
      return;
    }
    refresh();
  });

  getControl("modelFileInput")?.addEventListener("change", async event => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const role = getControl("modelRoleInput")?.value === "prop" ? "prop" : "tile";
    const scale = Math.max(0.1, Number(getControl("modelScaleInput")?.value) || 1);
    await importModelFiles(files, { role, scale });
    event.target.value = "";
    updateAssetList();
    refresh();
  });

  window.addEventListener("resize", () => renderMap(canvas, state));
}

setupScrollZoom(canvas);
bindControls();
updateAssetList();
refresh();
registerToolTheme(() => renderMap(canvas, state));
if (typeof window.registerDashboardToolBridge === "function") {
  window.registerDashboardToolBridge({
    onDescribeCurrentAssets: describeCurrentAssets,
    onExportImage: () => {
      renderMap(canvas, state);
      return {
        fileName: buildMapFileName(".png"),
        mimeType: "image/png",
        dataUrl: exportRendererPng(),
        width: canvas.width,
        height: canvas.height
      };
    }
  });
} else {
  window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
  window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets().then(descriptors => descriptors[0] || null);
}

function sharedSnapshot() {
  return { version: 1, mode: state.mode, seed: String(state.seed), map: state.map.map(row => row.map(tile => tile && tile.kind === "block" ? "platform" : "hole")), items: [], players: [], sprites: [] };
}

function resolveSpriteSrc(sprite) {
  return (sprite && (sprite.dataUrl || sprite.src)) || "";
}

function applySharedMap(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.map)) return;
  const rows = snapshot.map.filter(Array.isArray);
  const width = Math.max(1, ...rows.map(row => row.length));
  const spritesById = new Map((snapshot.sprites || []).filter(sprite => sprite && sprite.id).map(sprite => [sprite.id, sprite]));
  state.mode = snapshot.mode === "sidescroller" ? "sidescroller" : snapshot.mode === "isometric" ? "isometric" : "topdown-flat";
  state.seed = Math.max(1, Number(snapshot.seed) || state.seed);
  state.width = width;
  state.depth = Math.max(1, rows.length);
  state.map = rows.map((row, z) => Array.from({ length: width }, (_, x) => ({ x, z, y: 0, height: row[x] === "platform" ? 1 : 0.04, kind: row[x] === "platform" ? "block" : "ground" })));
  // Sprites + players from the shared map, drawn as upright game-space billboards.
  state.spriteLayers = [];
  (snapshot.items || []).forEach((row, z) => (row || []).forEach((itemId, x) => { const src = resolveSpriteSrc(spritesById.get(itemId)); if (src) state.spriteLayers.push({ x, z, src }); }));
  const playerSprites = Array.isArray(snapshot.playerSprites) ? snapshot.playerSprites : [];
  (snapshot.players || []).forEach(player => {
    const sprite = playerSprites.length ? playerSprites[(player.variantIndex || 0) % playerSprites.length] : null;
    const src = resolveSpriteSrc(sprite) || resolveSpriteSrc({ src: snapshot.playerSprite });
    if (src) state.spriteLayers.push({ x: player.col, z: player.row, src, player: true });
  });
  ["seedInput", "widthInput", "depthInput"].forEach((id, index) => { const control = getControl(id); if (control) control.value = String([state.seed, state.width, state.depth][index]); });
  updateButtons("[data-mode]", "data-mode", state.mode);
  lastControlSignature = controlSignature();
  renderMap(canvas, state);
  updateUiText();
}

window.__urageGetSharedMap = sharedSnapshot;
window.__urageApplySharedMap = applySharedMap;
window.__urageMapGeneratorBecameVisible = () => renderMap(canvas, state);

const existingGenerateButton = getControl("generateButton");
existingGenerateButton?.addEventListener("click", () => {
  requestAnimationFrame(() => window.parent.postMessage({ type: "urage-map-generator-snapshot", source: "3d", snapshot: sharedSnapshot() }, "*"));
});

// Reset the orbit camera back to the configured yaw/pitch/zoom by re-rendering.
getControl("resetViewButton")?.addEventListener("click", () => renderMap(canvas, state));

// Debug/verification accessor (used by automated checks). Reports what the live scene
// actually contains when available, falling back to pending state before first render.
window.__urageDebugScene = () => {
  const scene = getSceneStats();
  return { tiles: (state.map || []).flat().filter(Boolean).length, spriteLayers: scene ? scene.sprites : (state.spriteLayers || []).length, mode: state.mode, showSprites: state.showSprites !== false };
};