import { applyBrushMirror, flipBrushTiles, getBrushSize, normalizeBrushTiles } from "./js/brushTransforms.js";
import { drawOrderCells, gridModeLabel, gridNodePoint, mapPixelSize, normalizeGridMode, pointToCell, tileDrawRect, traceCellPath } from "./js/gridProjection.js";
import { renderLayerPanel } from "./js/layerPanel.js";
import { normalizePaintSourceMode, paintOptionsLabel, pickPaintTile, selectedPaintTiles } from "./js/paintOptions.js";
import { renderSmartActionSvg } from "./js/smartActionIcons.js";
import { getTilesetEntriesFromPayload, restoreTilesetsFromPayload as restoreTilesetsFromEntries, serializeTilesetsForExport } from "./js/tilesetPersistence.js";
import { composeTilesetFromImages, loadTilesetImagesFromFiles } from "./js/tilesetUploads.js";

(function() {
  const $ = id => document.getElementById(id);
  const state = {
    projectName: "tilemap",
    image: new Image(), imageLoaded: false, tileSize: 32, columns: 0, rows: 0,
    tilesets: [], activeTilesetIndex: 0,
    selectedTile: 0, brushTiles: [[0]], mirrorX: false, mirrorY: false, brushMirrorX: false, brushMirrorY: false, tilesetSelectMode: "single", tilesetDrag: null, tilesetHovered: false,
    smartBrush: { enabled: false, activeProfileId: "default", profiles: [{ id: "default", name: "Brush 1", roles: {} }], paintToken: 0 },
    layers: [], layerMeta: [], currentLayer: 0, brushMode: "paint", mapShapeMode: "single", gridMode: "orthogonal", showGrid: true,
    paintOptions: { sourceMode: "stamp", sequenceIndex: 0, lastCellKey: "", lastTile: -1 },
    scale: 1, offsetX: 0, offsetY: 0, drawing: false, panning: false,
    lastX: 0, lastY: 0, hoverX: -1, hoverY: -1, dragStartCell: null, lineAnchor: null, mapSelection: null, moveDrag: null,
    history: [], historyIndex: -1, maxHistory: 80,
    imagePools: [], recentImages: [], mediaTrayTab: "pools",
    trayDrag: { active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0, pointerId: null, handle: null },
    overlayDrag: { active: false, panel: null, key: "", startX: 0, startY: 0, origLeft: 0, origTop: 0, pointerId: null, handle: null },
    overlayZ: 10
  };

  const els = {
    projectNameInput: $("projectNameInput"), uploadInput: $("uploadInput"), uploadModeSelect: $("uploadModeSelect"), tileSizeInput: $("tileSizeInput"), gridWidthInput: $("gridWidthInput"), gridHeightInput: $("gridHeightInput"), gridModeSelect: $("gridModeSelect"),
    createGridButton: $("createGridButton"), layerSelect: $("layerSelect"), addLayerButton: $("addLayerButton"), duplicateLayerButton: $("duplicateLayerButton"), clearLayerButton: $("clearLayerButton"), clearAllButton: $("clearAllButton"), resetViewButton: $("resetViewButton"), fitViewButton: $("fitViewButton"),
    importJsonButton: $("importJsonButton"), importJsonInput: $("importJsonInput"), exportJsonButton: $("exportJsonButton"), exportTiledButton: $("exportTiledButton"), exportPngButton: $("exportPngButton"),
    mapCanvas: $("mapCanvas"), tilesetCanvas: $("tilesetCanvas"), canvasStage: $("canvasStage"), statusOutput: $("statusOutput"),
    tilesetStats: $("tilesetStats"), tilesetTabs: $("tilesetTabs"), activeTilesetTileSizeInput: $("activeTilesetTileSizeInput"), duplicateTilesetButton: $("duplicateTilesetButton"), tilesetTabPreview: $("tilesetTabPreview"), layerStats: $("layerStats"), layerList: $("layerList"), toggleTilesetPanelButton: $("toggleTilesetPanelButton"),
    toggleLayersPanelButton: $("toggleLayersPanelButton"), toggleSmartWallPanelButton: $("toggleSmartWallPanelButton"), smartWallPanel: document.querySelector(".smart-wall-panel"), tilesetPanel: document.querySelector(".tileset-panel"), layersPanel: document.querySelector(".layers-panel"), openMediaTrayButton: $("openMediaTrayButton"), closeMediaTrayButton: $("closeMediaTrayButton"),
    refreshDashboardMediaButton: $("refreshDashboardMediaButton"), floatingMediaTray: $("floatingMediaTray"), imagePoolSelect: $("imagePoolSelect"),
    imagePoolList: $("imagePoolList"), recentMediaList: $("recentMediaList"),
    mirrorXInput: $("mirrorXInput"), mirrorYInput: $("mirrorYInput"), brushMirrorXInput: $("brushMirrorXInput"), brushMirrorYInput: $("brushMirrorYInput"), showGridInput: $("showGridInput"), smartBrushEnabledInput: $("smartBrushEnabledInput"), smartBrushMirrorXInput: $("smartBrushMirrorXInput"), smartBrushMirrorYInput: $("smartBrushMirrorYInput"),
    flipBrushXButton: $("flipBrushXButton"), flipBrushYButton: $("flipBrushYButton"),
    selectAllMapButton: $("selectAllMapButton"), flipSelectionXButton: $("flipSelectionXButton"), flipSelectionYButton: $("flipSelectionYButton"),
    smartBrushRoleGrid: $("smartBrushRoleGrid"), smartBrushProfileTabs: $("smartBrushProfileTabs"), addSmartBrushProfileButton: $("addSmartBrushProfileButton"), duplicateSmartBrushProfileButton: $("duplicateSmartBrushProfileButton"), renameSmartBrushProfileButton: $("renameSmartBrushProfileButton"), deleteSmartBrushProfileButton: $("deleteSmartBrushProfileButton"), smartBrushFromSelectionButton: $("smartBrushFromSelectionButton"), smartBrushAddVariantsFromSelectionButton: $("smartBrushAddVariantsFromSelectionButton"), smartBrushClearButton: $("smartBrushClearButton"),
    mediaTrayTabs: Array.from(document.querySelectorAll("[data-media-tray-tab]")), mediaTrayPanels: Array.from(document.querySelectorAll("[data-media-tray-panel]"))
  };
  const mapCtx = els.mapCanvas.getContext("2d");
  const tilesetCtx = els.tilesetCanvas.getContext("2d");


  function activeTileset() { return state.tilesets[state.activeTilesetIndex] || null; }

  function tilesetTileSize(tileset) {
    return clampNumber(tileset && tileset.tileSize, 1, 4096, state.tileSize);
  }

  function tileGridSpan(tile) {
    const hit = resolveTile(tile);
    const size = hit ? tilesetTileSize(hit.tileset) : state.tileSize;
    return Math.max(1, Math.round(size / Math.max(1, state.tileSize)));
  }

  function activeTilesetTileSize() {
    return tilesetTileSize(activeTileset());
  }

  function syncActiveTilesetTileSizeInput() {
    if (els.activeTilesetTileSizeInput) els.activeTilesetTileSizeInput.value = activeTilesetTileSize();
  }

  function updateTilesetMetrics(tileset) {
    const size = tilesetTileSize(tileset);
    tileset.tileSize = size;
    tileset.columns = Math.max(1, Math.floor(tileset.image.width / size));
    tileset.rows = Math.max(1, Math.floor(tileset.image.height / size));
    tileset.tileCount = tileset.columns * tileset.rows;
  }

  function setActiveTilesetTileSize(value) {
    const tileset = activeTileset();
    if (!tileset) return;
    tileset.tileSize = clampNumber(value, 1, 4096, tileset.tileSize || state.tileSize);
    updateTilesetMetrics(tileset);
    recalcTilesetOffsets();
    state.selectedTile = tileset.firstTile;
    state.brushTiles = [[state.selectedTile]];
    renderTilesetTabs();
    syncActiveTilesetTileSizeInput();
    drawTileset();
    drawMap();
    updateStats();
    setStatus(tileset.label + " source tile size: " + tileset.tileSize + "px. Map grid remains " + state.tileSize + "px.");
  }

  function syncActiveTilesetFields() {
    const tileset = activeTileset();
    state.imageLoaded = !!tileset;
    state.image = tileset ? tileset.image : new Image();
    state.columns = tileset ? tileset.columns : 0;
    state.rows = tileset ? tileset.rows : 0;
    syncActiveTilesetTileSizeInput();
  }

  function recalcTilesetOffsets() {
    let firstTile = 0;
    state.tilesets.forEach(tileset => {
      updateTilesetMetrics(tileset);
      tileset.firstTile = firstTile;
      firstTile += tileset.tileCount;
    });
    syncActiveTilesetFields();
  }

  function resolveTile(tile) {
    for (const tileset of state.tilesets) {
      if (tile >= tileset.firstTile && tile < tileset.firstTile + tileset.tileCount) return { tileset, local: tile - tileset.firstTile };
    }
    return null;
  }

  function activeLocalToGlobal(localTile) {
    const tileset = activeTileset();
    return tileset ? tileset.firstTile + localTile : localTile;
  }

  function selectedTileLocal() {
    const tileset = activeTileset();
    return tileset ? state.selectedTile - tileset.firstTile : state.selectedTile;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function projectFileStem(extension) {
    const rawName = String(els.projectNameInput && els.projectNameInput.value || state.projectName || "tilemap").trim();
    const safeName = rawName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "tilemap";
    return extension ? safeName + extension : safeName;
  }

  function setStatus(text) { els.statusOutput.textContent = text; }

  function cloneLayers() { return state.layers.map(layer => layer.map(row => row.slice())); }
  function ensureLayerMeta() {
    while (state.layerMeta.length < state.layers.length) state.layerMeta.push({ visible: true, opacity: 1 });
    state.layerMeta = state.layerMeta.slice(0, state.layers.length).map(meta => ({ visible: meta.visible !== false, opacity: Number.isFinite(Number(meta.opacity)) ? Math.max(0, Math.min(1, Number(meta.opacity))) : 1 }));
  }

  function pushHistory(label) {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ label, layers: cloneLayers(), layerMeta: state.layerMeta.map(meta => ({ ...meta })) });
    if (state.history.length > state.maxHistory) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function restoreHistory(index) {
    if (index < 0 || index >= state.history.length) return;
    const snapshot = state.history[index];
    state.historyIndex = index;
    state.layers = snapshot.layers.map(layer => layer.map(row => row.slice()));
    state.layerMeta = snapshot.layerMeta.map(meta => ({ ...meta })); state.mapSelection = null; state.moveDrag = null;
    ensureLayerMeta(); updateLayerSelect(); updateLayerList(); updateStats(); drawMap();
    setStatus(snapshot.label + ".");
  }

  function undo() { restoreHistory(state.historyIndex - 1); }
  function redo() { restoreHistory(state.historyIndex + 1); }

  function applyTheme(themeName, tokens) {
    const root = document.documentElement;
    root.style.setProperty("--bg", tokens.bg); root.style.setProperty("--panel", tokens.surface); root.style.setProperty("--panel-soft", tokens.surfaceStrong);
    root.style.setProperty("--line", tokens.line); root.style.setProperty("--line-strong", tokens.lineStrong); root.style.setProperty("--text", tokens.text);
    root.style.setProperty("--muted", tokens.muted); root.style.setProperty("--accent", tokens.accent); root.style.setProperty("--accent-2", tokens.accentStrong);
    document.body.setAttribute("data-dashboard-theme", themeName || "fire");
  }

  function sidebarSectionStorageKey(section) {
    return "tilemapCreator.sidebar." + String(section && section.dataset.sidebarSection || "");
  }

  function setSidebarSectionCollapsed(section, collapsed) {
    if (!section) return;
    section.classList.toggle("collapsed", !!collapsed);
    const button = section.querySelector(".sidebar-section-toggle");
    if (button) button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    try {
      localStorage.setItem(sidebarSectionStorageKey(section), collapsed ? "1" : "0");
    } catch {}
  }

  function initSidebarSections() {
    const sections = Array.from(document.querySelectorAll(".side-panel > .panel"));
    sections.forEach((section, index) => {
      const heading = section.querySelector(":scope > h2");
      if (!heading || section.dataset.sidebarEnhanced === "true") return;
      section.dataset.sidebarEnhanced = "true";
      section.dataset.sidebarSection = section.dataset.sidebarSection || ("section-" + index);
      section.classList.add("sidebar-section");

      const title = heading.textContent || "Section";
      const body = document.createElement("div");
      body.className = "sidebar-section-body";
      Array.from(section.children).forEach(child => {
        if (child !== heading) body.appendChild(child);
      });

      const toggle = document.createElement("button");
      toggle.className = "sidebar-section-toggle";
      toggle.type = "button";
      toggle.innerHTML = "<span class='sidebar-section-toggle-text'><h2>" + title + "</h2></span><span class='sidebar-section-toggle-icon' aria-hidden='true'>▾</span>";
      toggle.addEventListener("click", () => setSidebarSectionCollapsed(section, !section.classList.contains("collapsed")));

      section.innerHTML = "";
      section.appendChild(toggle);
      section.appendChild(body);

      let collapsed = false;
      try {
        collapsed = localStorage.getItem(sidebarSectionStorageKey(section)) === "1";
      } catch {}
      setSidebarSectionCollapsed(section, collapsed);
    });
  }

  function syncTheme() {
    if (typeof window.registerDashboardThemeSync === "function") { window.registerDashboardThemeSync(applyTheme); return; }
    const tokens = typeof window.getDashboardThemeTokens === "function" ? window.getDashboardThemeTokens("fire") : null;
    if (tokens) applyTheme("fire", tokens);
  }

  function resizeMapCanvas() {
    const rect = els.canvasStage.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));
    if (els.mapCanvas.width !== width || els.mapCanvas.height !== height) { els.mapCanvas.width = width; els.mapCanvas.height = height; drawMap(); }
  }

  function resetView() { state.scale = 1; state.offsetX = 24; state.offsetY = 24; drawMap(); }
  function fitView() {
    const d = getMapDimensions();
    if (!d.width || !d.height) return;
    const margin = 44;
    const mapSize = mapPixelSize(d.width, d.height, state.tileSize, state.gridMode);
    const mapWidth = mapSize.width;
    const mapHeight = mapSize.height;
    const scaleX = (els.mapCanvas.width - margin * 2) / Math.max(1, mapWidth);
    const scaleY = (els.mapCanvas.height - margin * 2) / Math.max(1, mapHeight);
    state.scale = Math.max(0.2, Math.min(6, Math.min(scaleX, scaleY)));
    state.offsetX = (els.mapCanvas.width - mapWidth * state.scale) / 2;
    state.offsetY = (els.mapCanvas.height - mapHeight * state.scale) / 2;
    drawMap();
    setStatus("Fitted map to view.");
  }
  function getMapDimensions() {
    const first = state.layers[0] || [];
    return { width: first[0] ? first[0].length : 0, height: first.length };
  }

  function createLayer(width, height) { return Array.from({ length: height }, () => Array(width).fill(-1)); }

  function resizeLayer(layer, width, height) {
    const resized = createLayer(width, height);
    const oldHeight = Math.min(height, layer.length);
    for (let y = 0; y < oldHeight; y++) {
      const oldWidth = Math.min(width, layer[y].length);
      for (let x = 0; x < oldWidth; x++) resized[y][x] = layer[y][x];
    }
    return resized;
  }


  function refreshTilesetMetrics() {
    state.tilesets.forEach(updateTilesetMetrics);
    recalcTilesetOffsets();
  }

  function createGrid() {
    const width = clampNumber(els.gridWidthInput.value, 1, 512, 30);
    const height = clampNumber(els.gridHeightInput.value, 1, 512, 20);
    state.tileSize = clampNumber(els.tileSizeInput.value, 4, 256, 32);
    state.gridMode = normalizeGridMode(els.gridModeSelect && els.gridModeSelect.value || state.gridMode);
    refreshTilesetMetrics();
    if (state.layers.length) {
      state.layers = state.layers.map(layer => resizeLayer(layer, width, height));
      ensureLayerMeta(); state.mapSelection = null; state.moveDrag = null;
      pushHistory("Resized grid"); updateLayerSelect(); updateLayerList(); drawMap(); updateStats();
      return;
    }
    state.layers = [createLayer(width, height)]; state.layerMeta = [{ visible: true, opacity: 1 }]; state.currentLayer = 0;
    pushHistory("Created grid"); updateLayerSelect(); updateLayerList(); resetView(); updateStats();
  }

  function addLayer() {
    const dimensions = getMapDimensions();
    const width = dimensions.width || clampNumber(els.gridWidthInput.value, 1, 512, 30);
    const height = dimensions.height || clampNumber(els.gridHeightInput.value, 1, 512, 20);
    state.layers.push(createLayer(width, height)); state.layerMeta.push({ visible: true, opacity: 1 }); state.currentLayer = state.layers.length - 1;
    pushHistory("Added layer"); updateLayerSelect(); updateLayerList(); drawMap();
  }

  function duplicateLayer() {
    const source = activeLayer();
    if (!source) return;
    const insertAt = state.currentLayer + 1;
    state.layers.splice(insertAt, 0, source.map(row => row.slice()));
    const meta = state.layerMeta[state.currentLayer] || { visible: true, opacity: 1 };
    state.layerMeta.splice(insertAt, 0, { ...meta });
    state.currentLayer = insertAt;
    pushHistory("Duplicated layer");
    updateLayerSelect();
    updateLayerList();
    drawMap();
    updateStats();
  }

  function updateLayerSelect() {
    els.layerSelect.innerHTML = "";
    state.layers.forEach((layer, index) => {
      const option = document.createElement("option");
      option.value = String(index); option.textContent = "Layer " + (index + 1); els.layerSelect.appendChild(option);
    });
    els.layerSelect.value = String(state.currentLayer);
  }

  function moveLayer(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.layers.length || toIndex >= state.layers.length) return;
    const [layer] = state.layers.splice(fromIndex, 1);
    const [meta] = state.layerMeta.splice(fromIndex, 1);
    state.layers.splice(toIndex, 0, layer);
    state.layerMeta.splice(toIndex, 0, meta);
    if (state.currentLayer === fromIndex) state.currentLayer = toIndex;
    else if (fromIndex < state.currentLayer && toIndex >= state.currentLayer) state.currentLayer -= 1;
    else if (fromIndex > state.currentLayer && toIndex <= state.currentLayer) state.currentLayer += 1;
    pushHistory("Reordered layers");
    updateLayerSelect(); updateLayerList(); drawMap(); updateStats();
  }

  function updateLayerList() {
    ensureLayerMeta();
    els.layerStats.textContent = state.layers.length + (state.layers.length === 1 ? " layer" : " layers");
    renderLayerPanel(els.layerList, {
      layers: state.layers,
      layerMeta: state.layerMeta,
      currentLayer: state.currentLayer,
      onSelect: selectLayer,
      onToggleVisible: toggleLayerVisibility,
      onClear: clearLayer,
      onMoveUp: index => moveLayer(index, Math.min(state.layers.length - 1, index + 1)),
      onMoveDown: index => moveLayer(index, Math.max(0, index - 1)),
      onOpacityInput: setLayerOpacityPreview,
      onOpacityCommit: commitLayerOpacity,
      onStartReorder: startLayerPointerReorder
    });
  }

  function layerRowFromEvent(event) {
    const row = event.target && event.target.closest ? event.target.closest(".layer-row") : null;
    if (!row || !els.layerList.contains(row)) return null;
    const index = Number(row.dataset.layerIndex);
    return Number.isInteger(index) ? { row, index } : null;
  }

  function eventTargetClosest(event, selector) {
    return event && event.target && event.target.closest ? event.target.closest(selector) : null;
  }

  function selectLayer(index) {
    if (index < 0 || index >= state.layers.length) return;
    state.currentLayer = index;
    updateLayerSelect();
    updateLayerList();
    drawMap();
  }

  function toggleLayerVisibility(index) {
    ensureLayerMeta();
    if (!state.layerMeta[index]) return;
    state.layerMeta[index].visible = !state.layerMeta[index].visible;
    pushHistory("Changed layer visibility");
    updateLayerList();
    drawMap();
  }

  function setLayerOpacityPreview(index, value) {
    ensureLayerMeta();
    if (!state.layerMeta[index]) return;
    state.layerMeta[index].opacity = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
    drawMap();
  }

  function commitLayerOpacity(index, value) {
    setLayerOpacityPreview(index, value);
    pushHistory("Changed layer opacity");
    updateLayerList();
  }

  function startLayerPointerReorder(event, index) {
    const handle = event.currentTarget || eventTargetClosest(event, ".layer-drag-handle");
    const hit = Number.isInteger(index) ? { index } : layerRowFromEvent(event);
    if (!handle || !hit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectLayer(hit.index);
    state.layerReorderDrag = { pointerId: event.pointerId, fromIndex: hit.index, currentIndex: hit.index, startY: event.clientY, active: true };
    try { handle.setPointerCapture(event.pointerId); } catch {}
    document.addEventListener("pointermove", onLayerPointerReorder);
    document.addEventListener("pointerup", stopLayerPointerReorder, { once: true });
    document.addEventListener("pointercancel", stopLayerPointerReorder, { once: true });
  }

  function onLayerPointerReorder(event) {
    const drag = state.layerReorderDrag;
    if (!drag || !drag.active || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rows = Array.from(els.layerList.querySelectorAll(".layer-row"));
    const targetRow = rows.find(row => {
      const rect = row.getBoundingClientRect();
      return event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    if (!targetRow) return;
    const toIndex = Number(targetRow.dataset.layerIndex);
    if (!Number.isInteger(toIndex) || toIndex === drag.currentIndex) return;
    moveLayer(drag.currentIndex, toIndex);
    drag.currentIndex = toIndex;
    state.layerReorderDrag = drag;
  }

  function stopLayerPointerReorder(event) {
    const drag = state.layerReorderDrag;
    if (!drag) return;
    state.layerReorderDrag = null;
    document.removeEventListener("pointermove", onLayerPointerReorder);
    document.removeEventListener("pointercancel", stopLayerPointerReorder);
  }

  function updateStats() {
    const dimensions = getMapDimensions();
    const totalPainted = state.layers.reduce((sum, layer) => sum + layer.reduce((layerSum, row) => layerSum + row.filter(tile => tile >= 0).length, 0), 0);
    els.tilesetStats.textContent = activeTileset() ? activeTileset().label + " / " + state.columns + " x " + state.rows + " tiles" : "No image";
    renderTilesetTabs();
    setStatus(dimensions.width + " x " + dimensions.height + " map, " + totalPainted + " painted tiles, " + modeLabel() + ".");
  }

  function modeLabel() {
    const brushMirrorLabel = []
      .concat(state.brushMirrorX ? ["brush X"] : [])
      .concat(state.brushMirrorY ? ["brush Y"] : []);
    const source = state.paintOptions && state.paintOptions.sourceMode !== "stamp" ? " / " + paintOptionsLabel(state.paintOptions.sourceMode) : "";
    return state.brushMode + " / " + state.mapShapeMode + " / " + gridModeLabel(state.gridMode) + source + (brushMirrorLabel.length ? " / " + brushMirrorLabel.join(" + ") : "");
  }

  function setGridMode(mode) {
    state.gridMode = normalizeGridMode(mode);
    if (els.gridModeSelect) els.gridModeSelect.value = state.gridMode;
    resetPaintSourceSequenceTracking();
    updateStats();
    drawMap();
    setStatus("Grid projection set to " + gridModeLabel(state.gridMode) + ".");
  }

  function setBrushMode(mode) {
    state.brushMode = ["paint", "erase", "fill", "pick", "move"].includes(mode) ? mode : "paint";
    document.querySelectorAll("[data-brush-mode]").forEach(node => node.classList.toggle("active", node.getAttribute("data-brush-mode") === state.brushMode));
    updateStats(); drawMap();
  }

  function setPaintSourceMode(mode) {
    state.paintOptions.sourceMode = normalizePaintSourceMode(mode);
    state.paintOptions.sequenceIndex = 0;
    state.paintOptions.lastCellKey = "";
    state.paintOptions.lastTile = -1;
    document.querySelectorAll("[data-paint-source-mode]").forEach(node => node.classList.toggle("active", node.getAttribute("data-paint-source-mode") === state.paintOptions.sourceMode));
    updateStats();
    setStatus("Paint source set to " + paintOptionsLabel(state.paintOptions.sourceMode) + ".");
  }

  function resetPaintSourceSequenceTracking() {
    state.paintOptions.lastCellKey = "";
    state.paintOptions.lastTile = -1;
  }

  function setMapShapeMode(mode) {
    state.mapShapeMode = ["single", "rect", "rectOutline", "circle"].includes(mode) ? mode : "single";
    document.querySelectorAll("[data-map-shape-mode]").forEach(node => node.classList.toggle("active", node.getAttribute("data-map-shape-mode") === state.mapShapeMode));
    updateStats(); drawMap();
  }

  function setTilesetSelectMode(mode) {
    state.tilesetSelectMode = ["single", "rect", "rectOutline", "circle"].includes(mode) ? mode : "single";
    document.querySelectorAll("[data-tileset-select-mode]").forEach(node => node.classList.toggle("active", node.getAttribute("data-tileset-select-mode") === state.tilesetSelectMode));
    drawTileset();
  }


  function normalizeSmartBrushProfiles() {
    if (!state.smartBrush || typeof state.smartBrush !== "object") state.smartBrush = {};
    if (!Array.isArray(state.smartBrush.profiles) || !state.smartBrush.profiles.length) {
      state.smartBrush.profiles = [{ id: "default", name: "Brush 1", roles: state.smartBrush.roles && typeof state.smartBrush.roles === "object" ? state.smartBrush.roles : {} }];
    }
    state.smartBrush.profiles = state.smartBrush.profiles.map((profile, index) => ({
      id: String(profile.id || ("profile-" + Date.now() + "-" + index)),
      name: String(profile.name || ("Brush " + (index + 1))),
      roles: profile.roles && typeof profile.roles === "object" ? profile.roles : {},
      mirrorX: !!profile.mirrorX,
      mirrorY: !!profile.mirrorY
    }));
    if (!state.smartBrush.profiles.some(profile => profile.id === state.smartBrush.activeProfileId)) state.smartBrush.activeProfileId = state.smartBrush.profiles[0].id;
    delete state.smartBrush.roles;
  }

  function activeSmartBrushProfile() {
    normalizeSmartBrushProfiles();
    return state.smartBrush.profiles.find(profile => profile.id === state.smartBrush.activeProfileId) || state.smartBrush.profiles[0];
  }

  function activeSmartBrushRoles() {
    return activeSmartBrushProfile().roles;
  }

  function syncSmartBrushOrientationInputs() {
    const profile = activeSmartBrushProfile();
    if (els.smartBrushMirrorXInput) els.smartBrushMirrorXInput.checked = !!profile.mirrorX;
    if (els.smartBrushMirrorYInput) els.smartBrushMirrorYInput.checked = !!profile.mirrorY;
  }

  function setSmartBrushRoleMirror(axis, enabled) {
    const profile = activeSmartBrushProfile();
    if (axis === "x") profile.mirrorX = !!enabled;
    if (axis === "y") profile.mirrorY = !!enabled;
    syncSmartBrushOrientationInputs();
    setStatus("Smart wall inner-corner source mirror " + axis.toUpperCase() + " " + (enabled ? "enabled." : "disabled."));
  }

  function uniqueSmartBrushProfileId() {
    return "profile-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function renderSmartBrushProfiles() {
    if (!els.smartBrushProfileTabs) return;
    normalizeSmartBrushProfiles();
    els.smartBrushProfileTabs.innerHTML = "";
    state.smartBrush.profiles.forEach(profile => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "smart-profile-tab";
      button.classList.toggle("active", profile.id === state.smartBrush.activeProfileId);
      button.textContent = profile.name;
      button.addEventListener("click", () => { state.smartBrush.activeProfileId = profile.id; renderSmartBrushManager(); setStatus("Active smart brush: " + profile.name + "."); });
      els.smartBrushProfileTabs.appendChild(button);
    });
  }

  function addSmartBrushProfile(copyActive = false) {
    normalizeSmartBrushProfiles();
    const source = copyActive ? activeSmartBrushProfile() : null;
    const profile = {
      id: uniqueSmartBrushProfileId(),
      name: (copyActive && source ? source.name + " Copy" : "Brush " + (state.smartBrush.profiles.length + 1)),
      roles: source ? { ...source.roles } : {},
      mirrorX: !!(source && source.mirrorX),
      mirrorY: !!(source && source.mirrorY)
    };
    state.smartBrush.profiles.push(profile);
    state.smartBrush.activeProfileId = profile.id;
    renderSmartBrushManager();
    setStatus("Added smart brush profile: " + profile.name + ".");
  }

  function renameSmartBrushProfile() {
    const profile = activeSmartBrushProfile();
    const next = prompt("Smart brush profile name", profile.name);
    if (next === null) return;
    const name = next.trim();
    if (!name) return;
    profile.name = name;
    renderSmartBrushManager();
  }

  function deleteSmartBrushProfile() {
    normalizeSmartBrushProfiles();
    if (state.smartBrush.profiles.length <= 1) {
      activeSmartBrushProfile().roles = {};
      renderSmartBrushManager();
      setSmartBrushEnabled(false);
      setStatus("Cleared the only smart brush profile.");
      return;
    }
    const index = state.smartBrush.profiles.findIndex(profile => profile.id === state.smartBrush.activeProfileId);
    state.smartBrush.profiles.splice(Math.max(0, index), 1);
    state.smartBrush.activeProfileId = state.smartBrush.profiles[Math.max(0, index - 1)].id;
    renderSmartBrushManager();
  }

  const smartBrushRoles = [
    { role: "single", label: "Single", hint: "Dot or isolated post", mask: 0, icon: "connect" },
    { role: "hStart", label: "Line left cap", hint: "Connects right", mask: 2, visualMask: 8, icon: "connect" },
    { role: "hMid", label: "Line middle", hint: "Connects left + right", mask: 10, icon: "connect" },
    { role: "hEnd", label: "Line right cap", hint: "Connects left", mask: 8, visualMask: 2, icon: "connect" },
    { role: "vStart", label: "Line top cap", hint: "Connects down", mask: 4, visualMask: 1, icon: "connect" },
    { role: "vMid", label: "Line middle", hint: "Connects up + down", mask: 5, icon: "connect" },
    { role: "vEnd", label: "Line bottom cap", hint: "Connects up", mask: 1, visualMask: 4, icon: "connect" },
    { role: "cornerSE", label: "Corner up-left", hint: "Visible top + left corner", mask: 6, visualMask: 9, icon: "edge" },
    { role: "cornerSW", label: "Corner up-right", hint: "Visible top + right corner", mask: 12, visualMask: 3, icon: "edge" },
    { role: "cornerNE", label: "Corner down-left", hint: "Visible bottom + left corner", mask: 3, visualMask: 12, icon: "edge" },
    { role: "cornerNW", label: "Corner down-right", hint: "Visible bottom + right corner", mask: 9, visualMask: 6, icon: "edge" },
    { role: "innerNW", label: "Inner corner up-left", hint: "Hole/cutout at top-left", mask: 15, visualMask: 9, icon: "inner" },
    { role: "innerNE", label: "Inner corner up-right", hint: "Hole/cutout at top-right", mask: 15, visualMask: 3, icon: "inner" },
    { role: "innerSE", label: "Inner corner down-right", hint: "Hole/cutout at bottom-right", mask: 15, visualMask: 6, icon: "inner" },
    { role: "innerSW", label: "Inner corner down-left", hint: "Hole/cutout at bottom-left", mask: 15, visualMask: 12, icon: "inner" },
    { role: "cross", label: "Center", hint: "Fully surrounded tile", mask: 15, visualMask: 0, icon: "edge" },
    { role: "teeN", label: "Top edge", hint: "Visible top edge", mask: 14, visualMask: 1, icon: "edge" },
    { role: "teeE", label: "Right edge", hint: "Visible right edge", mask: 13, visualMask: 2, icon: "edge" },
    { role: "teeS", label: "Bottom edge", hint: "Visible bottom edge", mask: 11, visualMask: 4, icon: "edge" },
    { role: "teeW", label: "Left edge", hint: "Visible left edge", mask: 7, visualMask: 8, icon: "edge" }
  ];

  function transformedBrushTiles() {
    return applyBrushMirror(normalizeBrushTiles(state.brushTiles, state.selectedTile), {
      mirrorX: state.brushMirrorX,
      mirrorY: state.brushMirrorY
    });
  }

  function brushSize(brush) {
    return getBrushSize(brush);
  }

  function setBrushMirror(axis, enabled) {
    if (axis === "x") state.brushMirrorX = !!enabled;
    if (axis === "y") state.brushMirrorY = !!enabled;
    if (els.brushMirrorXInput) els.brushMirrorXInput.checked = state.brushMirrorX;
    if (els.brushMirrorYInput) els.brushMirrorYInput.checked = state.brushMirrorY;
    updateStats();
    drawMap();
    setStatus("Brush mirror " + (state.brushMirrorX ? "X" : "") + (state.brushMirrorX && state.brushMirrorY ? " + " : "") + (state.brushMirrorY ? "Y" : "") + ((!state.brushMirrorX && !state.brushMirrorY) ? "off" : "") + ".");
  }

  function flipCurrentBrush(axis) {
    state.brushTiles = flipBrushTiles(state.brushTiles, axis);
    drawTileset();
    drawMap();
    setStatus("Flipped brush " + (axis === "y" ? "vertically." : "horizontally."));
  }

  function mirroredAnchorsForBrush(x, y, brush) {
    const d = getMapDimensions();
    const size = brushSize(brush);
    const anchors = [{ x, y }];
    const add = (mx, my) => {
      const key = mx + "," + my;
      if (!anchors.some(anchor => anchor.x + "," + anchor.y === key)) anchors.push({ x: mx, y: my });
    };
    if (state.mirrorX) add(d.width - x - size.width, y);
    if (state.mirrorY) add(x, d.height - y - size.height);
    if (state.mirrorX && state.mirrorY) add(d.width - x - size.width, d.height - y - size.height);
    return anchors;
  }

  function mirroredCells(cells) {
    const d = getMapDimensions();
    const unique = new Map();
    const add = (x, y) => { if (inBounds(x, y)) unique.set(x + "," + y, { x, y }); };
    cells.forEach(cell => {
      add(cell.x, cell.y);
      if (state.mirrorX) add(d.width - 1 - cell.x, cell.y);
      if (state.mirrorY) add(cell.x, d.height - 1 - cell.y);
      if (state.mirrorX && state.mirrorY) add(d.width - 1 - cell.x, d.height - 1 - cell.y);
    });
    return Array.from(unique.values());
  }

  function setMirror(axis, enabled) {
    if (axis === "x") state.mirrorX = !!enabled;
    if (axis === "y") state.mirrorY = !!enabled;
    if (els.mirrorXInput) els.mirrorXInput.checked = state.mirrorX;
    if (els.mirrorYInput) els.mirrorYInput.checked = state.mirrorY;
    drawMap();
    setStatus("Map mirror " + (state.mirrorX ? "X" : "") + (state.mirrorX && state.mirrorY ? " + " : "") + (state.mirrorY ? "Y" : "") + ((!state.mirrorX && !state.mirrorY) ? "off" : "") + ".");
  }

  function setSmartBrushEnabled(enabled) {
    state.smartBrush.enabled = !!enabled;
    if (els.smartBrushEnabledInput) els.smartBrushEnabledInput.checked = state.smartBrush.enabled;
    updateStats();
    drawMap();
  }

  function normalizeSmartRoleTiles(value) {
    const unique = [];
    function visit(entry) {
      if (Array.isArray(entry)) {
        entry.forEach(visit);
        return;
      }
      const id = Number(entry);
      if (Number.isFinite(id) && id >= 0 && !unique.includes(id)) unique.push(id);
    }
    visit(value);
    return unique;
  }

  function smartRoleTileList(role) {
    return normalizeSmartRoleTiles(activeSmartBrushRoles()[role]);
  }

  function setSmartRoleTileList(role, tiles) {
    const list = normalizeSmartRoleTiles(tiles);
    if (!list.length) {
      delete activeSmartBrushRoles()[role];
    } else {
      activeSmartBrushRoles()[role] = list.length === 1 ? list[0] : list;
    }
  }

  function addSmartRoleTile(role, tile) {
    if (!Number.isFinite(tile) || tile < 0) {
      setStatus("Select a tileset tile before adding a smart brush variant.");
      return;
    }
    setSmartRoleTileList(role, [...smartRoleTileList(role), tile]);
  }

  function removeSmartRoleTile(role, tile) {
    setSmartRoleTileList(role, smartRoleTileList(role).filter(value => value !== tile));
  }

  function replaceSmartRoleTile(role, tile) {
    if (!Number.isFinite(tile) || tile < 0) {
      setStatus("Select a tileset tile before replacing a smart brush role.");
      return;
    }
    setSmartRoleTileList(role, [tile]);
  }

  function selectedBrushTileList() {
    return normalizeSmartRoleTiles(cropBrushToContent(state.brushTiles).flat());
  }

  function replaceSmartRoleSelection(role) {
    const tiles = selectedBrushTileList();
    if (!tiles.length) {
      setStatus("Select one or more tiles in the tileset before replacing this role.");
      return false;
    }
    setSmartRoleTileList(role, tiles);
    return true;
  }

  function addSmartRoleSelection(role) {
    const tiles = selectedBrushTileList();
    if (!tiles.length) {
      setStatus("Select one or more tiles in the tileset before adding variants.");
      return false;
    }
    setSmartRoleTileList(role, [...smartRoleTileList(role), ...tiles]);
    return true;
  }

  function smartVariantIndex(role, x, y, count) {
    if (count <= 1) return 0;
    const hash = Math.abs((((x + 101) * 73856093) ^ ((y + 37) * 19349663) ^ (role.length * 83492791)) | 0);
    return hash % count;
  }

  function mirroredInnerCornerRole(role) {
    const profile = activeSmartBrushProfile();
    let mapped = role;
    if (profile.mirrorX) {
      const mapX = {
        innerNW: "innerNE", innerNE: "innerNW",
        innerSW: "innerSE", innerSE: "innerSW"
      };
      mapped = mapX[mapped] || mapped;
    }
    if (profile.mirrorY) {
      const mapY = {
        innerNW: "innerSW", innerSW: "innerNW",
        innerNE: "innerSE", innerSE: "innerNE"
      };
      mapped = mapY[mapped] || mapped;
    }
    return mapped;
  }

  function pickSmartRoleTile(role, x = 0, y = 0) {
    const tiles = smartRoleTileList(role);
    return tiles.length ? tiles[smartVariantIndex(role, x, y, tiles.length)] : undefined;
  }

  function smartRoleTiles() {
    return Array.from(new Set(Object.values(activeSmartBrushRoles()).flatMap(normalizeSmartRoleTiles)));
  }

  function isSmartTile(tile) {
    return tile >= 0 && smartRoleTiles().includes(tile);
  }

  function smartFallbackAt(x, y, ...roles) {
    for (const role of roles) {
      const tile = pickSmartRoleTile(role, x, y);
      if (Number.isFinite(tile) && tile >= 0) return tile;
    }
    return Number.isFinite(state.selectedTile) ? state.selectedTile : 0;
  }

  function smartFallback(...roles) {
    return smartFallbackAt(0, 0, ...roles);
  }

  function smartCellKey(x, y) {
    return x + "," + y;
  }

  function cellSetFromList(cells) {
    const set = new Set();
    (Array.isArray(cells) ? cells : []).forEach(cell => {
      if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y) || !inBounds(cell.x, cell.y)) return;
      set.add(smartCellKey(cell.x, cell.y));
    });
    return set;
  }

  function chooseSmartTile(mask, x = 0, y = 0) {
    const n = !!(mask & 1), e = !!(mask & 2), s = !!(mask & 4), w = !!(mask & 8);
    const nw = !!(mask & 16), ne = !!(mask & 32), se = !!(mask & 64), sw = !!(mask & 128);
    const count = [n, e, s, w].filter(Boolean).length;
    if (count === 0) return smartFallbackAt(x, y, "single", "cross", "hMid", "vMid");
    // Four cardinal neighbors with a missing diagonal means this tile borders an inner hole/cutout.
    if (count === 4) {
      if (!nw) return smartFallbackAt(x, y, "innerNW", "cross", "single", "hMid", "vMid");
      if (!ne) return smartFallbackAt(x, y, "innerNE", "cross", "single", "hMid", "vMid");
      if (!se) return smartFallbackAt(x, y, "innerSE", "cross", "single", "hMid", "vMid");
      if (!sw) return smartFallbackAt(x, y, "innerSW", "cross", "single", "hMid", "vMid");
      return smartFallbackAt(x, y, "cross", "single", "hMid", "vMid");
    }
    // Three neighbors means one exposed side. These double as terrain edge roles when a 3x3 tile block is auto-mapped.
    if (count === 3) {
      if (!n) return smartFallbackAt(x, y, "teeN", "cross", "single", "hMid", "vMid");
      if (!e) return smartFallbackAt(x, y, "teeE", "cross", "single", "vMid", "hMid");
      if (!s) return smartFallbackAt(x, y, "teeS", "cross", "single", "hMid", "vMid");
      return smartFallbackAt(x, y, "teeW", "cross", "single", "vMid", "hMid");
    }
    if (n && s && !e && !w) return smartFallbackAt(x, y, "vMid", "single", "cross");
    if (e && w && !n && !s) return smartFallbackAt(x, y, "hMid", "single", "cross");
    if (e && s) return smartFallbackAt(x, y, "cornerSE", "teeN", "teeW", "hMid", "vMid", "single");
    if (w && s) return smartFallbackAt(x, y, "cornerSW", "teeN", "teeE", "hMid", "vMid", "single");
    if (e && n) return smartFallbackAt(x, y, "cornerNE", "teeS", "teeW", "hMid", "vMid", "single");
    if (w && n) return smartFallbackAt(x, y, "cornerNW", "teeS", "teeE", "hMid", "vMid", "single");
    if (e) return smartFallbackAt(x, y, "hStart", "hMid", "single", "cross");
    if (w) return smartFallbackAt(x, y, "hEnd", "hMid", "single", "cross");
    if (s) return smartFallbackAt(x, y, "vStart", "vMid", "single", "cross");
    if (n) return smartFallbackAt(x, y, "vEnd", "vMid", "single", "cross");
    return smartFallbackAt(x, y, "single", "cross", "hMid", "vMid");
  }

  function isSmartOccupied(layer, x, y, extraFilled = null) {
    if (!inBounds(x, y)) return false;
    if (extraFilled && extraFilled.has(smartCellKey(x, y))) return true;
    return isSmartTile(layer[y][x]);
  }

  function smartMaskAt(layer, x, y, extraFilled = null) {
    let mask = 0;
    if (isSmartOccupied(layer, x, y - 1, extraFilled)) mask |= 1;
    if (isSmartOccupied(layer, x + 1, y, extraFilled)) mask |= 2;
    if (isSmartOccupied(layer, x, y + 1, extraFilled)) mask |= 4;
    if (isSmartOccupied(layer, x - 1, y, extraFilled)) mask |= 8;
    if (isSmartOccupied(layer, x - 1, y - 1, extraFilled)) mask |= 16;
    if (isSmartOccupied(layer, x + 1, y - 1, extraFilled)) mask |= 32;
    if (isSmartOccupied(layer, x + 1, y + 1, extraFilled)) mask |= 64;
    if (isSmartOccupied(layer, x - 1, y + 1, extraFilled)) mask |= 128;
    return mask;
  }

  function refreshSmartCell(layer, x, y, extraFilled = null) {
    if (!inBounds(x, y) || !isSmartTile(layer[y][x])) return false;
    const next = chooseSmartTile(smartMaskAt(layer, x, y, extraFilled), x, y);
    if (layer[y][x] === next) return false;
    layer[y][x] = next;
    return true;
  }

  function refreshSmartTilesAcrossLayers() {
    let changed = false;
    state.layers.forEach(layer => {
      layer.forEach((row, y) => row.forEach((tile, x) => {
        if (!isSmartTile(tile)) return;
        if (refreshSmartCell(layer, x, y)) changed = true;
      }));
    });
    return changed;
  }

  function paintSmartCells(cells, erase, options = {}) {
    const layer = activeLayer();
    if (!layer) return false;
    const extraFilled = erase ? null : cellSetFromList(options.extraFilledCells);
    const unique = new Map();
    cells.forEach(cell => { if (inBounds(cell.x, cell.y)) unique.set(cell.x + "," + cell.y, cell); });
    if (!unique.size) return false;
    let changed = false;
    const affected = new Map();
    unique.forEach(cell => {
      const next = erase ? -1 : smartFallbackAt(cell.x, cell.y, "single", "hMid", "vMid");
      if (layer[cell.y][cell.x] !== next) { layer[cell.y][cell.x] = next; changed = true; }
      [
        {x:cell.x,y:cell.y},{x:cell.x+1,y:cell.y},{x:cell.x-1,y:cell.y},{x:cell.x,y:cell.y+1},{x:cell.x,y:cell.y-1},
        {x:cell.x-1,y:cell.y-1},{x:cell.x+1,y:cell.y-1},{x:cell.x+1,y:cell.y+1},{x:cell.x-1,y:cell.y+1}
      ].forEach(c => affected.set(c.x + "," + c.y, c));
    });
    affected.forEach(cell => { if (refreshSmartCell(layer, cell.x, cell.y, extraFilled)) changed = true; });
    return changed;
  }

  function smartCellsForBrushAt(x, y) {
    const brush = transformedBrushTiles();
    const cells = [];
    mirroredAnchorsForBrush(x, y, brush).forEach(anchor => {
      brush.forEach((row, by) => row.forEach((tile, bx) => { if (tile >= 0) cells.push({ x: anchor.x + bx, y: anchor.y + by }); }));
    });
    return cells;
  }

  function cropBrushToContent(brush) {
    const normalized = normalizeBrushTiles(brush);
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    normalized.forEach((row, y) => row.forEach((tile, x) => {
      if (Number.isFinite(tile) && tile >= 0) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }));
    if (maxX < 0 || maxY < 0) return [];
    const cropped = [];
    for (let y = minY; y <= maxY; y++) cropped.push(normalized[y].slice(minX, maxX + 1));
    return cropped;
  }

  function brushIslands(brush) {
    const normalized = normalizeBrushTiles(brush, -1);
    const visited = new Set();
    const islands = [];
    const key = (x, y) => x + "," + y;
    const tileAt = (x, y) => normalized[y] && Number.isFinite(normalized[y][x]) && normalized[y][x] >= 0 ? normalized[y][x] : undefined;
    normalized.forEach((row, y) => row.forEach((tile, x) => {
      if (!Number.isFinite(tile) || tile < 0 || visited.has(key(x, y))) return;
      const cells = [];
      const stack = [{ x, y }];
      visited.add(key(x, y));
      while (stack.length) {
        const cell = stack.pop();
        cells.push({ ...cell, tile: tileAt(cell.x, cell.y) });
        [{x:cell.x + 1,y:cell.y},{x:cell.x - 1,y:cell.y},{x:cell.x,y:cell.y + 1},{x:cell.x,y:cell.y - 1}].forEach(next => {
          const nextKey = key(next.x, next.y);
          if (visited.has(nextKey) || !Number.isFinite(tileAt(next.x, next.y))) return;
          visited.add(nextKey);
          stack.push(next);
        });
      }
      const xs = cells.map(cell => cell.x), ys = cells.map(cell => cell.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const mapped = new Map(cells.map(cell => [key(cell.x, cell.y), cell.tile]));
      const islandBrush = [];
      for (let by = minY; by <= maxY; by++) {
        const outRow = [];
        for (let bx = minX; bx <= maxX; bx++) outRow.push(mapped.has(key(bx, by)) ? mapped.get(key(bx, by)) : -1);
        islandBrush.push(outRow);
      }
      islands.push({ brush: islandBrush, width: maxX - minX + 1, height: maxY - minY + 1, tileCount: cells.length });
    }));
    return islands;
  }

  function brushTileMap(brush) {
    const normalized = normalizeBrushTiles(brush, -1);
    const cells = new Map();
    normalized.forEach((row, y) => row.forEach((tile, x) => {
      if (Number.isFinite(tile) && tile >= 0) cells.set(smartCellKey(x, y), { x, y, tile });
    }));
    return cells;
  }

  function brushFromTileMap(cells) {
    const list = Array.from(cells.values());
    if (!list.length) return [];
    const xs = list.map(cell => cell.x), ys = list.map(cell => cell.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const brush = [];
    for (let y = minY; y <= maxY; y++) {
      const row = [];
      for (let x = minX; x <= maxX; x++) {
        const hit = cells.get(smartCellKey(x, y));
        row.push(hit ? hit.tile : -1);
      }
      brush.push(row);
    }
    return brush;
  }

  function extractInlineInnerCornerBrushes(brush) {
    const normalized = normalizeBrushTiles(brush, -1);
    const width = Math.max(1, ...normalized.map(row => row.length));
    const height = Math.max(1, normalized.length);
    if (width < 4 || height < 3) return null;
    const tileAt = (x, y) => normalized[y] && Number.isFinite(normalized[y][x]) && normalized[y][x] >= 0 ? normalized[y][x] : undefined;
    for (let y = 0; y <= height - 2; y++) {
      for (let x = 0; x <= width - 2; x++) {
        const innerBrush = [
          [tileAt(x, y), tileAt(x + 1, y)],
          [tileAt(x, y + 1), tileAt(x + 1, y + 1)]
        ];
        if (normalizeSmartRoleTiles(innerBrush).length !== 4) continue;
        const remaining = brushTileMap(normalized);
        remaining.delete(smartCellKey(x, y));
        remaining.delete(smartCellKey(x + 1, y));
        remaining.delete(smartCellKey(x, y + 1));
        remaining.delete(smartCellKey(x + 1, y + 1));
        const mainBrush = brushFromTileMap(remaining);
        const islands = brushIslands(mainBrush).sort((a, b) => b.tileCount - a.tileCount);
        const main = islands[0];
        const isFilledRectangle = !!main && main.tileCount === main.width * main.height;
        if (!main || islands.length !== 1 || main.width < 3 || main.height < 3 || !isFilledRectangle) continue;
        return { mainBrush: main.brush, innerCornerBrushes: [innerBrush] };
      }
    }
    return null;
  }

  function smartAutoMapBrushParts(brush) {
    const inlineInnerCorners = extractInlineInnerCornerBrushes(brush);
    if (inlineInnerCorners) return inlineInnerCorners;
    const islands = brushIslands(brush).sort((a, b) => b.tileCount - a.tileCount);
    const main = islands[0] || null;
    const innerCornerBrushes = islands
      .filter((island, index) => index > 0 && island.width === 2 && island.height === 2 && island.tileCount === 4)
      .map(island => island.brush);
    return { mainBrush: main ? main.brush : cropBrushToContent(brush), innerCornerBrushes };
  }

  function mapInnerCornerBrush(brush, put) {
    const at = (x, y) => brush[y] && Number.isFinite(brush[y][x]) && brush[y][x] >= 0 ? brush[y][x] : undefined;
    put(mirroredInnerCornerRole("innerNW"), at(0, 0));
    put(mirroredInnerCornerRole("innerNE"), at(1, 0));
    put(mirroredInnerCornerRole("innerSE"), at(1, 1));
    put(mirroredInnerCornerRole("innerSW"), at(0, 1));
  }

  function autoMapSmartBrushFromSelection(appendVariants = false) {
    const brushParts = smartAutoMapBrushParts(state.brushTiles);
    const brush = cropBrushToContent(brushParts.mainBrush);
    if (!brush.length) {
      setStatus("Select a 3x3+ block, a 3-tile line, or one tile in the tileset before auto-mapping.");
      return;
    }
    const at = (x, y) => brush[y] && Number.isFinite(brush[y][x]) && brush[y][x] >= 0 ? brush[y][x] : undefined;
    const cleanTiles = tiles => normalizeSmartRoleTiles(tiles);
    const put = (roles, tiles) => {
      const list = cleanTiles(tiles);
      if (!list.length) return;
      (Array.isArray(roles) ? roles : [roles]).forEach(role => {
        const current = appendVariants ? normalizeSmartRoleTiles(mapped[role] ?? smartRoleTileList(role)) : [];
        const next = appendVariants ? [...current, ...list] : list;
        const unique = normalizeSmartRoleTiles(next);
        mapped[role] = unique.length === 1 ? unique[0] : unique;
      });
    };
    const rowTiles = (y, x0, x1) => {
      const tiles = [];
      for (let x = x0; x <= x1; x++) tiles.push(at(x, y));
      return cleanTiles(tiles);
    };
    const colTiles = (x, y0, y1) => {
      const tiles = [];
      for (let y = y0; y <= y1; y++) tiles.push(at(x, y));
      return cleanTiles(tiles);
    };
    const rectTiles = (x0, y0, x1, y1) => {
      const tiles = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push(at(x, y));
      return cleanTiles(tiles);
    };
    const all = cleanTiles(brush.flat());
    const width = Math.max(1, ...brush.map(row => row.length));
    const height = Math.max(1, brush.length);
    const mapped = {};

    if (!all.length) {
      setStatus("The selected brush does not contain any tiles to auto-map.");
      return;
    }

    if (width >= 3 && height >= 3) {
      const top = rowTiles(0, 1, width - 2);
      const bottom = rowTiles(height - 1, 1, width - 2);
      const left = colTiles(0, 1, height - 2);
      const right = colTiles(width - 1, 1, height - 2);
      const center = rectTiles(1, 1, width - 2, height - 2);
      put(["cornerSE", "hStart", "vStart"], at(0, 0));
      put(["cornerSW", "hEnd"], at(width - 1, 0));
      put(["cornerNE", "vEnd"], at(0, height - 1));
      put("cornerNW", at(width - 1, height - 1));
      put(["teeN", "hMid"], top);
      put("teeS", bottom);
      put(["teeW", "vMid"], left);
      put("teeE", right);
      put(["cross", "single"], center.length ? center : all[Math.floor(all.length / 2)]);
      const midX = Math.floor(width / 2), midY = Math.floor(height / 2);
      if (!Number.isFinite(at(midX, midY))) {
        put("innerSE", at(midX - 1, midY - 1));
        put("innerSW", at(midX + 1, midY - 1));
        put("innerNE", at(midX - 1, midY + 1));
        put("innerNW", at(midX + 1, midY + 1));
      }
    } else if (width >= 3) {
      put("hStart", at(0, 0));
      put("hMid", rowTiles(0, 1, width - 2));
      put("hEnd", at(width - 1, 0));
      put("single", mapped.hMid || all[0]);
    } else if (height >= 3) {
      put("vStart", at(0, 0));
      put("vMid", colTiles(0, 1, height - 2));
      put("vEnd", at(0, height - 1));
      put("single", mapped.vMid || all[0]);
    } else {
      put(["single", "hMid", "vMid", "cross"], all);
    }
    (brushParts.innerCornerBrushes || []).forEach(innerBrush => mapInnerCornerBrush(innerBrush, put));

    if (!Object.keys(mapped).length) {
      setStatus("Could not auto-map that selection. Try a 3x3+ block, a 3-tile strip, or use the role buttons manually.");
      return;
    }
    Object.entries(mapped).forEach(([role, value]) => setSmartRoleTileList(role, value));
    renderSmartBrushManager();
    setSmartBrushEnabled(true);
    const assignedRoles = Object.keys(mapped).filter(role => smartRoleTileList(role).length);
    const variantCount = assignedRoles.reduce((sum, role) => sum + smartRoleTileList(role).length, 0);
    setStatus((appendVariants ? "Added variants to " : "Auto-mapped ") + assignedRoles.length + " roles with " + variantCount + " assigned tile" + (variantCount === 1 ? "" : "s") + ".");
  }

  function drawSmartConnectionIcon(canvas, mask, mode = "connect") {
    const ctx = canvas.getContext("2d");
    const size = 54;
    canvas.width = size; canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff8a4d";
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1; ctx.strokeRect(9.5, 9.5, 35, 35);
    ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineCap = "round";
    const line = (x1, y1, x2, y2, width = 7) => { ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    if (mode === "edge" || mode === "inner") {
      if (mask === 0) { ctx.fillRect(19, 19, 16, 16); return; }
      if (mode === "inner") {
        ctx.fillRect(15, 15, 24, 24);
        ctx.clearRect(20, 20, 14, 14);
      }
      if (mask & 1) line(16, 14, 38, 14, 6);
      if (mask & 2) line(40, 16, 40, 38, 6);
      if (mask & 4) line(16, 40, 38, 40, 6);
      if (mask & 8) line(14, 16, 14, 38, 6);
      return;
    }
    ctx.beginPath(); ctx.arc(27, 27, 4, 0, Math.PI * 2); ctx.fill();
    if (mask & 1) line(27, 27, 27, 8);
    if (mask & 2) line(27, 27, 46, 27);
    if (mask & 4) line(27, 27, 27, 46);
    if (mask & 8) line(27, 27, 8, 27);
  }

  function drawSmartTilePreview(canvas, tileValue) {
    const ctx = canvas.getContext("2d");
    canvas.width = 54; canvas.height = 54;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 54, 54);
    ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(0, 0, 54, 54);
    const tiles = normalizeSmartRoleTiles(tileValue);
    if (!tiles.length) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.strokeRect(0.5, 0.5, 53, 53);
      ctx.fillStyle = "rgba(255,255,255,0.42)"; ctx.font = "20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", 27, 27);
      return;
    }
    const drawTile = (tile, x, y, w, h) => {
      const resolved = resolveTile(tile);
      if (!resolved) return;
      const size = tilesetTileSize(resolved.tileset);
      const sx = (resolved.local % resolved.tileset.columns) * size;
      const sy = Math.floor(resolved.local / resolved.tileset.columns) * size;
      ctx.drawImage(resolved.tileset.image, sx, sy, size, size, x, y, w, h);
    };
    if (tiles.length === 1) {
      drawTile(tiles[0], 3, 3, 48, 48);
      return;
    }
    tiles.slice(0, 4).forEach((tile, index) => drawTile(tile, 3 + (index % 2) * 24, 3 + Math.floor(index / 2) * 24, 23, 23));
    if (tiles.length > 4) {
      ctx.fillStyle = "rgba(0,0,0,0.68)"; ctx.fillRect(28, 35, 23, 16);
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+" + (tiles.length - 4), 39.5, 43);
    }
  }

  function drawSmartVariantChip(canvas, tile) {
    const ctx = canvas.getContext("2d");
    canvas.width = 24; canvas.height = 24;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 24, 24);
    ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(0, 0, 24, 24);
    const resolved = resolveTile(tile);
    if (resolved) {
      const size = tilesetTileSize(resolved.tileset);
      const sx = (resolved.local % resolved.tileset.columns) * size;
      const sy = Math.floor(resolved.local / resolved.tileset.columns) * size;
      ctx.drawImage(resolved.tileset.image, sx, sy, size, size, 2, 2, 20, 20);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.strokeRect(0.5, 0.5, 23, 23);
  }


  function renderSmartBrushManager() {
    normalizeSmartBrushProfiles();
    renderSmartBrushProfiles();
    syncSmartBrushOrientationInputs();
    if (!els.smartBrushRoleGrid) return;
    els.smartBrushRoleGrid.innerHTML = "";
    smartBrushRoles.forEach(({ role, label, hint, mask, visualMask, icon }) => {
      const row = document.createElement("article");
      row.className = "smart-role-card";
      const tiles = smartRoleTileList(role);
      const hasTile = tiles.length > 0;
      row.classList.toggle("is-set", hasTile);
      const tileText = !hasTile ? "Not set" : tiles.length === 1 ? "Tile " + tiles[0] : tiles.length + " variants: " + tiles.join(", ");
      row.innerHTML = "<div class='smart-role-visuals'><canvas data-act='icon' aria-hidden='true'></canvas><canvas data-act='preview' aria-hidden='true'></canvas></div><div class='smart-role-copy'><strong>" + label + "</strong><span>" + hint + "</span><em title='" + tileText + "'>" + tileText + "</em></div><div class='smart-variant-list' data-act='variants'></div><div class='smart-role-actions'><button class='smart-action-button' type='button' data-act='use'>" + renderSmartActionSvg("replace") + "<span>Replace Tile</span></button><button class='smart-action-button' type='button' data-act='add'>" + renderSmartActionSvg("add") + "<span>Add Tile</span></button><button class='smart-action-button' type='button' data-act='replaceSelection'>" + renderSmartActionSvg("selectionReplace") + "<span>Replace Selection</span></button><button class='smart-action-button' type='button' data-act='addSelection'>" + renderSmartActionSvg("selectionAdd") + "<span>Add Selection</span></button><button class='smart-action-button smart-action-clear' type='button' data-act='clear' title='Clear role'>" + renderSmartActionSvg("clear") + "<span>Clear</span></button></div>";
      drawSmartConnectionIcon(row.querySelector("[data-act='icon']"), Number.isFinite(visualMask) ? visualMask : mask, icon);
      drawSmartTilePreview(row.querySelector("[data-act='preview']"), tiles);
      const variantList = row.querySelector("[data-act='variants']");
      if (tiles.length) {
        tiles.forEach((tile, index) => {
          const pill = document.createElement("button");
          pill.type = "button";
          pill.className = "smart-variant-pill";
          pill.title = "Remove tile " + tile + " from " + label;
          const chipCanvas = document.createElement("canvas");
          const chipLabel = document.createElement("span");
          chipLabel.textContent = (index + 1) + ": " + tile + " ×";
          pill.append(chipCanvas, chipLabel);
          drawSmartVariantChip(chipCanvas, tile);
          pill.addEventListener("click", () => { removeSmartRoleTile(role, tile); renderSmartBrushManager(); setStatus("Removed tile " + tile + " from " + label + "."); });
          variantList.appendChild(pill);
        });
      } else {
        const empty = document.createElement("span");
        empty.className = "smart-variant-empty";
        empty.textContent = "No variants yet";
        variantList.appendChild(empty);
      }
      row.querySelector("[data-act='use']").addEventListener("click", () => { replaceSmartRoleTile(role, state.selectedTile); renderSmartBrushManager(); setSmartBrushEnabled(true); });
      row.querySelector("[data-act='add']").addEventListener("click", () => { addSmartRoleTile(role, state.selectedTile); renderSmartBrushManager(); setSmartBrushEnabled(true); });
      row.querySelector("[data-act='replaceSelection']").addEventListener("click", () => { if (replaceSmartRoleSelection(role)) { renderSmartBrushManager(); setSmartBrushEnabled(true); } });
      row.querySelector("[data-act='addSelection']").addEventListener("click", () => { if (addSmartRoleSelection(role)) { renderSmartBrushManager(); setSmartBrushEnabled(true); } });
      row.querySelector("[data-act='clear']").addEventListener("click", () => { setSmartRoleTileList(role, []); renderSmartBrushManager(); });
      els.smartBrushRoleGrid.appendChild(row);
    });
  }

  function setSingleSelectedTile(tile) {
    const max = Math.max(0, state.columns * state.rows - 1);
    const local = Math.max(0, Math.min(max, tile));
    state.selectedTile = activeLocalToGlobal(local);
    state.brushTiles = [[state.selectedTile]];
    drawTileset();
  }

  function tilesetCellFromEvent(event) {
    const rect = els.tilesetCanvas.getBoundingClientRect();
    const scaleX = els.tilesetCanvas.width / Math.max(1, rect.width);
    const scaleY = els.tilesetCanvas.height / Math.max(1, rect.height);
    const size = activeTilesetTileSize();
    return { x: Math.max(0, Math.min(state.columns - 1, Math.floor(((event.clientX - rect.left) * scaleX) / size))), y: Math.max(0, Math.min(state.rows - 1, Math.floor(((event.clientY - rect.top) * scaleY) / size))) };
  }

  function isCircleCell(x, y, minX, maxX, minY, maxY) {
    const width = maxX - minX + 1, height = maxY - minY + 1;
    if (width <= 1 && height <= 1) return true;
    if (width <= 2 && height <= 2) return true;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const rx = Math.max(0.5, width / 2 - 0.25), ry = Math.max(0.5, height / 2 - 0.25);
    return (((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2)) <= 1;
  }

  function makeTilesetSelection(start, end, shape) {
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x), minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    if (shape === "single") return [[activeLocalToGlobal(start.y * state.columns + start.x)]];
    const brush = [];
    for (let y = minY; y <= maxY; y++) {
      const row = [];
      for (let x = minX; x <= maxX; x++) {
        const onOutline = x === minX || x === maxX || y === minY || y === maxY;
        const inside = shape === "circle" ? isCircleCell(x, y, minX, maxX, minY, maxY) : shape === "rectOutline" ? onOutline : true;
        row.push(inside ? activeLocalToGlobal(y * state.columns + x) : -1);
      }
      brush.push(row);
    }
    return normalizeBrushTiles(brush);
  }

  function collectActiveTilesetBrushTiles(brush) {
    const tileset = activeTileset();
    const collected = new Map();
    if (!tileset) return collected;
    normalizeBrushTiles(brush, -1).forEach(row => row.forEach(tile => {
      if (!Number.isFinite(tile) || tile < tileset.firstTile || tile >= tileset.firstTile + tileset.tileCount) return;
      const local = tile - tileset.firstTile;
      collected.set(local, tileset.firstTile + local);
    }));
    return collected;
  }

  function buildActiveTilesetBrushFromMap(tileMap) {
    const locals = Array.from(tileMap.keys());
    if (!locals.length) return [[state.selectedTile]];
    const xs = locals.map(local => local % state.columns);
    const ys = locals.map(local => Math.floor(local / state.columns));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const brush = [];
    for (let y = minY; y <= maxY; y++) {
      const row = [];
      for (let x = minX; x <= maxX; x++) {
        const local = y * state.columns + x;
        row.push(tileMap.has(local) ? tileMap.get(local) : -1);
      }
      brush.push(row);
    }
    return normalizeBrushTiles(brush, -1);
  }

  function mergeTilesetSelection(selection) {
    const merged = collectActiveTilesetBrushTiles(state.brushTiles);
    collectActiveTilesetBrushTiles(selection).forEach((tile, local) => merged.set(local, tile));
    return buildActiveTilesetBrushFromMap(merged);
  }


  function renderTilesetTabs() {
    if (!els.tilesetTabs) return;
    els.tilesetTabs.innerHTML = "";
    state.tilesets.forEach((tileset, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tileset-tab" + (index === state.activeTilesetIndex ? " active" : "");
      button.dataset.tilesetIndex = String(index);
      button.textContent = (index + 1) + ": " + tileset.label;
      button.addEventListener("pointerdown", event => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        switchTileset(index);
      }, { capture: true });
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        switchTileset(index);
      });
      button.addEventListener("mouseenter", event => showTilesetPreview(index, event));
      button.addEventListener("mousemove", event => moveTilesetPreview(event));
      button.addEventListener("mouseleave", hideTilesetPreview);
      els.tilesetTabs.appendChild(button);
    });
  }

  function switchTileset(index) {
    if (!state.tilesets.length) return;
    state.activeTilesetIndex = (index + state.tilesets.length) % state.tilesets.length;
    syncActiveTilesetFields();
    const tileset = activeTileset();
    state.selectedTile = tileset.firstTile;
    state.brushTiles = [[state.selectedTile]];
    renderTilesetTabs(); drawTileset(); drawMap(); updateStats();
    setStatus("Active tileset: " + tileset.label + ".");
  }

  function showTilesetPreview(index, event) {
    const tileset = state.tilesets[index];
    if (!tileset || !els.tilesetTabPreview) return;
    els.tilesetTabPreview.querySelector("img").src = tileset.url;
    els.tilesetTabPreview.querySelector("strong").textContent = tileset.label;
    els.tilesetTabPreview.querySelector("span").textContent = tileset.columns + " x " + tileset.rows + " tiles";
    els.tilesetTabPreview.classList.remove("hidden");
    moveTilesetPreview(event);
  }

  function moveTilesetPreview(event) {
    if (!els.tilesetTabPreview || els.tilesetTabPreview.classList.contains("hidden")) return;
    const width = els.tilesetTabPreview.offsetWidth || 210;
    const height = els.tilesetTabPreview.offsetHeight || 190;
    els.tilesetTabPreview.style.left = Math.max(10, Math.min(window.innerWidth - width - 10, event.clientX + 14)) + "px";
    els.tilesetTabPreview.style.top = Math.max(10, Math.min(window.innerHeight - height - 10, event.clientY + 14)) + "px";
  }

  function hideTilesetPreview() {
    if (els.tilesetTabPreview) els.tilesetTabPreview.classList.add("hidden");
  }

  function addTileset(image, label, url, options = {}) {
    const tileSize = clampNumber(options.tileSize, 1, 4096, state.tileSize);
    const columns = Math.max(1, Math.floor(image.width / tileSize));
    const rows = Math.max(1, Math.floor(image.height / tileSize));
    state.tilesets.push({ image, label: label || "Tileset " + (state.tilesets.length + 1), url: url || image.src, sourceDataUrl: String(image.src || "").startsWith("data:") ? image.src : "", tileSize, columns, rows, tileCount: columns * rows, firstTile: 0 });
    state.activeTilesetIndex = state.tilesets.length - 1;
    recalcTilesetOffsets();
    state.selectedTile = activeTileset().firstTile;
    state.brushTiles = [[state.selectedTile]];
    renderTilesetTabs(); drawTileset(); drawMap(); updateStats();
    if (options.announce !== false) setStatus("Added tileset " + activeTileset().label + ".");
  }

  function duplicateActiveTileset() {
    const source = activeTileset();
    if (!source) {
      setStatus("Load or select a tileset before duplicating.");
      return;
    }
    const local = Math.max(0, Math.min(source.tileCount - 1, selectedTileLocal()));
    const baseLabel = source.label.replace(/\s+copy(?:\s+\d+)?$/i, "");
    const existing = new Set(state.tilesets.map(tileset => tileset.label));
    let label = baseLabel + " copy";
    for (let i = 2; existing.has(label); i++) label = baseLabel + " copy " + i;
    state.tilesets.push({
      image: source.image,
      label,
      url: source.url,
      sourceDataUrl: source.sourceDataUrl || "",
      tileSize: tilesetTileSize(source),
      columns: source.columns,
      rows: source.rows,
      tileCount: source.tileCount,
      firstTile: 0
    });
    state.activeTilesetIndex = state.tilesets.length - 1;
    recalcTilesetOffsets();
    const duplicate = activeTileset();
    state.selectedTile = duplicate.firstTile + local;
    state.brushTiles = [[state.selectedTile]];
    state.smartBrush.enabled = false;
    if (els.smartBrushEnabledInput) els.smartBrushEnabledInput.checked = false;
    renderTilesetTabs();
    drawTileset();
    drawMap();
    updateStats();
    setStatus("Duplicated tileset " + source.label + " as " + duplicate.label + ".");
  }

  async function addUploadedTilesets(files) {
    if (!files.length) return;
    const uploadMode = String(els.uploadModeSelect && els.uploadModeSelect.value || "separate");
    if (uploadMode === "combined") {
      const combined = await composeTilesetFromImages(files, state.tileSize);
      addTileset(combined.image, combined.label, combined.url, { announce: false });
      setStatus("Combined " + files.length + " images into one tileset.");
      return;
    }
    const uploads = await loadTilesetImagesFromFiles(files);
    uploads.forEach(entry => addTileset(entry.image, entry.file.name, entry.url, { announce: false }));
    setStatus("Added " + uploads.length + (uploads.length === 1 ? " tileset." : " tilesets."));
  }

  async function restoreTilesetsFromPayload(entries) {
    state.tilesets = await restoreTilesetsFromEntries(entries, state.tileSize);
    state.activeTilesetIndex = 0;
    recalcTilesetOffsets();
    syncActiveTilesetFields();
    state.selectedTile = activeTileset() ? activeTileset().firstTile : 0;
    state.brushTiles = [[state.selectedTile]];
    drawTileset();
  }

  function drawTileset() {
    const canvas = els.tilesetCanvas;
    if (!state.imageLoaded) {
      canvas.width = 320; canvas.height = 160; tilesetCtx.setTransform(1, 0, 0, 1, 0, 0); tilesetCtx.clearRect(0, 0, canvas.width, canvas.height);
      tilesetCtx.fillStyle = "rgba(255,255,255,0.08)"; tilesetCtx.fillRect(0, 0, canvas.width, canvas.height);
      tilesetCtx.fillStyle = "#d7c7bd"; tilesetCtx.font = "14px system-ui"; tilesetCtx.fillText("Load a spritesheet to select tiles.", 18, 34); return;
    }
    canvas.width = state.image.width; canvas.height = state.image.height; tilesetCtx.setTransform(1, 0, 0, 1, 0, 0); tilesetCtx.imageSmoothingEnabled = false; tilesetCtx.clearRect(0, 0, canvas.width, canvas.height); drawTransparencyCheckerboard(tilesetCtx, canvas.width, canvas.height, 12); tilesetCtx.drawImage(state.image, 0, 0);
    const tileSize = activeTilesetTileSize();
    tilesetCtx.strokeStyle = "rgba(255,255,255,0.18)"; tilesetCtx.lineWidth = 1;
    for (let x = 0; x <= state.columns; x++) { tilesetCtx.beginPath(); tilesetCtx.moveTo(x * tileSize, 0); tilesetCtx.lineTo(x * tileSize, state.rows * tileSize); tilesetCtx.stroke(); }
    for (let y = 0; y <= state.rows; y++) { tilesetCtx.beginPath(); tilesetCtx.moveTo(0, y * tileSize); tilesetCtx.lineTo(state.columns * tileSize, y * tileSize); tilesetCtx.stroke(); }
    const drawCell = (tile, alpha) => {
      if (tile < 0) return;
      const local = tile - (activeTileset()?.firstTile || 0);
      if (local < 0 || local >= state.columns * state.rows) return;
      const x = local % state.columns, y = Math.floor(local / state.columns);
      tilesetCtx.fillStyle = "rgba(255,255,255," + alpha + ")"; tilesetCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      tilesetCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff8a4d"; tilesetCtx.lineWidth = 3; tilesetCtx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
    };
    state.brushTiles.flat().forEach(tile => drawCell(tile, 0.18));
    if (state.tilesetDrag) makeTilesetSelection(state.tilesetDrag.start, state.tilesetDrag.end, state.tilesetSelectMode).flat().forEach(tile => drawCell(tile, 0.28));
  }

  function worldPoint(event) { return { x: (event.offsetX - state.offsetX) / state.scale, y: (event.offsetY - state.offsetY) / state.scale }; }
  function cellFromEvent(event) { const d = getMapDimensions(); return pointToCell(worldPoint(event), d.width, d.height, state.tileSize, state.gridMode); }
  function inBounds(x, y) { const d = getMapDimensions(); return x >= 0 && y >= 0 && x < d.width && y < d.height; }
  function activeLayer() { return state.layers[state.currentLayer]; }

  function paintSourceTiles(brush) {
    return selectedPaintTiles(brush, state.selectedTile);
  }

  function usesPaintSourcePool(brush = transformedBrushTiles()) {
    return state.paintOptions.sourceMode !== "stamp" && paintSourceTiles(brush).length > 0;
  }

  function shouldPaintWithSourcePool(brush = transformedBrushTiles()) {
    return state.brushMode !== "erase" && usesPaintSourcePool(brush);
  }

  function pickPaintSourceTile(x, y, brush) {
    const cellKey = x + "," + y;
    if (state.paintOptions.sourceMode !== "random" && state.paintOptions.sourceMode !== "noise" && state.paintOptions.lastCellKey === cellKey && state.paintOptions.lastTile >= 0) {
      return state.paintOptions.lastTile;
    }
    const pick = pickPaintTile({
      mode: state.paintOptions.sourceMode,
      tiles: paintSourceTiles(brush),
      fallbackTile: state.selectedTile,
      sequenceIndex: state.paintOptions.sequenceIndex,
      x,
      y
    });
    state.paintOptions.sequenceIndex = pick.sequenceIndex;
    state.paintOptions.lastCellKey = cellKey;
    state.paintOptions.lastTile = pick.tile;
    return pick.tile;
  }

  function paintSingleSourceAt(layer, anchor, brush, erase) {
    const tile = erase ? -1 : pickPaintSourceTile(anchor.x, anchor.y, brush);
    if (!erase && tile < 0) return false;
    if (layer[anchor.y][anchor.x] === tile) return false;
    layer[anchor.y][anchor.x] = tile;
    return true;
  }

  function placeBrushAt(x, y, erase) {
    const layer = activeLayer();
    if (!layer) return false;
    let changed = false;
    const brush = transformedBrushTiles();
    const useSourcePool = !erase && shouldPaintWithSourcePool(brush);
    const anchorBrush = useSourcePool ? [[state.selectedTile]] : brush;
    mirroredAnchorsForBrush(x, y, anchorBrush).forEach(anchor => {
      if (useSourcePool) {
        if (inBounds(anchor.x, anchor.y) && paintSingleSourceAt(layer, anchor, brush, erase)) changed = true;
        return;
      }
      const span = tileGridSpan(brush.flat().find(tile => tile >= 0));
      brush.forEach((row, by) => row.forEach((tile, bx) => {
        if (!erase && tile < 0) return;
        const tx = anchor.x + bx * span, ty = anchor.y + by * span;
        if (!inBounds(tx, ty)) return;
        const next = erase ? -1 : tile;
        if (layer[ty][tx] !== next) { layer[ty][tx] = next; changed = true; }
      }));
    });
    return changed;
  }

  function lineCells(a, b) {
    const cells = [];
    let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      cells.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return cells;
  }

  function floodFill(x, y) {
    const layer = activeLayer();
    if (!layer || !inBounds(x, y)) return false;
    const target = layer[y][x];
    const brush = transformedBrushTiles();
    const useSourcePool = state.brushMode !== "erase" && shouldPaintWithSourcePool(brush);
    const replacement = state.brushMode === "erase" ? -1 : useSourcePool ? pickPaintSourceTile(x, y, brush) : state.selectedTile;
    if (!useSourcePool && target === replacement) return false;
    const stack = [{ x, y }];
    while (stack.length) {
      const c = stack.pop();
      if (!inBounds(c.x, c.y) || layer[c.y][c.x] !== target) continue;
      layer[c.y][c.x] = state.brushMode === "erase" ? -1 : useSourcePool ? pickPaintSourceTile(c.x, c.y, brush) : replacement;
      stack.push({ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 });
    }
    return true;
  }

  function paintCell(cell, event) {
    if (!inBounds(cell.x, cell.y)) return false;
    const brush = transformedBrushTiles();
    const useSourcePool = shouldPaintWithSourcePool(brush);
    if (state.brushMode === "pick") {
      const tile = activeLayer()?.[cell.y]?.[cell.x];
      if (tile >= 0) { setSingleSelectedTile(tile); setBrushMode("paint"); setStatus("Picked tile " + tile + "."); }
      return false;
    }
    if (state.brushMode === "fill") { let changed = false; mirroredCells([cell]).forEach(c => { if (floodFill(c.x, c.y)) changed = true; }); return changed; }
    if (!useSourcePool && state.smartBrush.enabled && smartRoleTiles().length && (state.brushMode === "paint" || state.brushMode === "erase" || isEraseGesture(event))) {
      return paintSmartCells(smartCellsForBrushAt(cell.x, cell.y), isEraseGesture(event));
    }
    return placeBrushAt(cell.x, cell.y, isEraseGesture(event));
  }

  function isEraseGesture(event) {
    return state.brushMode === "erase" || event.buttons === 2 || event.button === 2;
  }

  function paintLine(from, to, event) {
    let changed = false;
    lineCells(from, to).forEach(cell => { if (paintCell(cell, event)) changed = true; });
    return changed;
  }

  function applyCtrlBrush(start, end, event) {
    return paintLine(start, end, event);
  }

  function shapeCells(start, end, shape) {
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x), minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    const cells = [];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const onOutline = x === minX || x === maxX || y === minY || y === maxY;
      const inside = shape === "circle" ? isCircleCell(x, y, minX, maxX, minY, maxY) : shape === "rectOutline" ? onOutline : true;
      if (inside) cells.push({ x, y });
    }
    return cells;
  }

  function applyShapeBrush(start, end, event) {
    if (!shouldPaintWithSourcePool() && state.smartBrush.enabled && smartRoleTiles().length && (state.brushMode === "paint" || state.brushMode === "erase" || isEraseGesture(event))) {
      const outlineCells = shapeCells(start, end, state.mapShapeMode);
      const extraFilledCells = state.mapShapeMode === "rectOutline" && !isEraseGesture(event) ? mirroredCells(shapeCells(start, end, "rect")) : null;
      return paintSmartCells(mirroredCells(outlineCells), isEraseGesture(event), { extraFilledCells });
    }
    let changed = false;
    shapeCells(start, end, state.mapShapeMode).forEach(cell => { if (paintCell(cell, event)) changed = true; });
    return changed;
  }

  function pickShapeBrush(start, end) {
    const layer = activeLayer();
    if (!layer) return false;
    const rect = rectFromCells(start, end);
    const cells = new Set(shapeCells(start, end, state.mapShapeMode).map(c => c.x + "," + c.y));
    const brush = Array.from({ length: rect.height }, (_, y) => Array.from({ length: rect.width }, (_, x) => {
      const tx = rect.x + x, ty = rect.y + y;
      return cells.has(tx + "," + ty) && inBounds(tx, ty) ? layer[ty][tx] : -1;
    }));
    state.brushTiles = normalizeBrushTiles(brush);
    const first = state.brushTiles.flat().find(tile => tile >= 0);
    if (first >= 0) state.selectedTile = first;
    setBrushMode("paint"); setStatus("Picked map area as brush."); drawTileset();
    return false;
  }

  function rectFromCells(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1 };
  }

  function selectionContains(selection, cell) {
    return selection && cell.x >= selection.x && cell.y >= selection.y && cell.x < selection.x + selection.width && cell.y < selection.y + selection.height;
  }

  function captureSelection(selection) {
    const layer = activeLayer();
    if (!layer || !selection) return [];
    return Array.from({ length: selection.height }, (_, y) => Array.from({ length: selection.width }, (_, x) => {
      const tx = selection.x + x, ty = selection.y + y;
      return inBounds(tx, ty) ? layer[ty][tx] : -1;
    }));
  }

  function selectAllMapTiles() {
    const d = getMapDimensions();
    if (!d.width || !d.height) return;
    state.mapSelection = { x: 0, y: 0, width: d.width, height: d.height };
    setBrushMode("move"); setStatus("Selected entire map layer."); drawMap();
  }

  function selectEntireTileset() {
    if (!state.imageLoaded) return;
    state.brushTiles = makeTilesetSelection({ x: 0, y: 0 }, { x: state.columns - 1, y: state.rows - 1 }, "rect");
    state.selectedTile = state.brushTiles.flat().find(tile => tile >= 0) ?? 0;
    setStatus("Selected entire tileset as brush."); drawTileset();
  }

  function applySelectionTransform(label, transform) {
    const layer = activeLayer();
    const selection = state.mapSelection;
    if (!layer || !selection) {
      setStatus("Select map tiles first.");
      return;
    }
    const snapshot = captureSelection(selection);
    if (!snapshot.length || !snapshot[0].length) {
      setStatus("Selection is empty.");
      return;
    }
    const transformed = transform(snapshot.map(row => row.slice()));
    let changed = false;
    for (let y = 0; y < selection.height; y++) {
      for (let x = 0; x < selection.width; x++) {
        const tx = selection.x + x;
        const ty = selection.y + y;
        const next = transformed[y] && Number.isFinite(transformed[y][x]) ? transformed[y][x] : -1;
        if (!inBounds(tx, ty) || layer[ty][tx] === next) continue;
        layer[ty][tx] = next;
        changed = true;
      }
    }
    if (!changed) {
      setStatus("Selection already matched that transform.");
      return;
    }
    pushHistory(label);
    updateLayerList();
    updateStats();
    drawMap();
    setStatus(label + ".");
  }

  function flipSelectionHorizontal() {
    applySelectionTransform("Flipped selection horizontally", snapshot => snapshot.map(row => row.slice().reverse()));
  }

  function flipSelectionVertical() {
    applySelectionTransform("Flipped selection vertically", snapshot => snapshot.slice().reverse().map(row => row.slice()));
  }

  function clearLayer(index) {
    const layer = state.layers[index];
    if (!layer) return;
    let changed = false;
    layer.forEach(row => row.forEach((tile, x) => { if (tile !== -1) { row[x] = -1; changed = true; } }));
    if (!changed) return;
    state.mapSelection = null; pushHistory("Erased layer"); updateLayerList(); updateStats(); drawMap();
  }

  function clearAllLayers() {
    let changed = false;
    state.layers.forEach(layer => layer.forEach(row => row.forEach((tile, x) => { if (tile !== -1) { row[x] = -1; changed = true; } })));
    if (!changed) return;
    state.mapSelection = null; pushHistory("Erased all layers"); updateLayerList(); updateStats(); drawMap();
  }


  function deleteSelectedTiles() {
    const layer = activeLayer();
    const selection = state.mapSelection;
    if (!layer || !selection) {
      setStatus("No map tiles selected.");
      return;
    }

    let changed = false;
    for (let y = 0; y < selection.height; y++) {
      for (let x = 0; x < selection.width; x++) {
        const tx = selection.x + x, ty = selection.y + y;
        if (!inBounds(tx, ty) || layer[ty][tx] < 0) continue;
        layer[ty][tx] = -1;
        changed = true;
      }
    }

    if (!changed) {
      setStatus("Selected area was already empty.");
      return;
    }

    state.mapSelection = null;
    state.moveDrag = null;
    pushHistory("Deleted selected tiles");
    updateLayerList();
    updateStats();
    drawMap();
  }

  function startMoveDrag(cell) {
    const layer = activeLayer();
    if (!layer || !inBounds(cell.x, cell.y)) return false;
    let selection = state.mapSelection;
    if (!selectionContains(selection, cell)) selection = { x: cell.x, y: cell.y, width: 1, height: 1 };
    const data = captureSelection(selection);
    if (!data.flat().some(tile => tile >= 0)) return false;
    state.mapSelection = selection;
    state.moveDrag = { selection, data, offsetX: cell.x - selection.x, offsetY: cell.y - selection.y, targetX: selection.x, targetY: selection.y };
    return true;
  }

  function finishMoveDrag() {
    const drag = state.moveDrag, layer = activeLayer();
    if (!drag || !layer) return false;
    const target = { x: drag.targetX, y: drag.targetY, width: drag.selection.width, height: drag.selection.height };
    let changed = target.x !== drag.selection.x || target.y !== drag.selection.y;
    if (!changed) { state.moveDrag = null; return false; }
    for (let y = 0; y < drag.selection.height; y++) for (let x = 0; x < drag.selection.width; x++) {
      const tx = drag.selection.x + x, ty = drag.selection.y + y;
      if (inBounds(tx, ty)) layer[ty][tx] = -1;
    }
    drag.data.forEach((row, y) => row.forEach((tile, x) => {
      const tx = target.x + x, ty = target.y + y;
      if (tile >= 0 && inBounds(tx, ty)) layer[ty][tx] = tile;
    }));
    state.mapSelection = target; state.moveDrag = null;
    return true;
  }

  function drawGrid(width, height, ctx = mapCtx, scale = state.scale) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = Math.max(1 / Math.max(0.001, scale), 0.5);
    if (state.gridMode === "isometric") {
      ctx.beginPath();
      for (let y = 0; y <= height; y++) {
        const start = gridNodePoint(0, y, width, height, state.tileSize, state.gridMode);
        const end = gridNodePoint(width, y, width, height, state.tileSize, state.gridMode);
        ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
      }
      for (let x = 0; x <= width; x++) {
        const start = gridNodePoint(x, 0, width, height, state.tileSize, state.gridMode);
        const end = gridNodePoint(x, height, width, height, state.tileSize, state.gridMode);
        ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
      }
      ctx.stroke();
      return;
    }
    for (let x = 0; x <= width; x++) { ctx.beginPath(); ctx.moveTo(x * state.tileSize, 0); ctx.lineTo(x * state.tileSize, height * state.tileSize); ctx.stroke(); }
    for (let y = 0; y <= height; y++) { ctx.beginPath(); ctx.moveTo(0, y * state.tileSize); ctx.lineTo(width * state.tileSize, y * state.tileSize); ctx.stroke(); }
  }

  function drawTransparencyCheckerboard(ctx, width, height, squareSize = 16) {
    ctx.fillStyle = "rgba(10, 12, 14, 0.78)";
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += squareSize) {
      for (let x = 0; x < width; x += squareSize) {
        if (((x / squareSize) + (y / squareSize)) % 2 !== 0) continue;
        ctx.fillStyle = "rgba(255,255,255,0.055)";
        ctx.fillRect(x, y, squareSize, squareSize);
      }
    }
  }

  function drawTileLayers(ctx) {
    ensureLayerMeta();
    const d = getMapDimensions();
    state.layers.forEach((layer, index) => {
      const meta = state.layerMeta[index];
      if (!meta.visible) return;
      ctx.globalAlpha = meta.opacity;
      drawOrderCells(d.width, d.height, state.gridMode).forEach(cell => {
        const x = cell.x, y = cell.y;
        const tile = layer[y] && layer[y][x];
        if (tile < 0) return;
        const hit = resolveTile(tile);
        if (!hit) return;
        const sourceSize = tilesetTileSize(hit.tileset);
        const sx = (hit.local % hit.tileset.columns) * sourceSize, sy = Math.floor(hit.local / hit.tileset.columns) * sourceSize;
        const dest = tileDrawRect(x, y, d.width, d.height, state.tileSize, sourceSize, state.gridMode);
        ctx.drawImage(hit.tileset.image, sx, sy, sourceSize, sourceSize, dest.x, dest.y, dest.width, dest.height);
      });
      ctx.globalAlpha = 1;
    });
  }

  function renderMapToCanvas(options = {}) {
    const d = getMapDimensions();
    const size = mapPixelSize(d.width, d.height, state.tileSize, state.gridMode);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(size.width));
    canvas.height = Math.max(1, Math.ceil(size.height));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (options.background) drawTransparencyCheckerboard(ctx, canvas.width, canvas.height);
    drawTileLayers(ctx);
    if (options.grid) drawGrid(d.width, d.height, ctx, 1);
    return canvas;
  }

  function drawCellOverlay(cells, fillStyle, strokeStyle) {
    const d = getMapDimensions();
    mapCtx.fillStyle = fillStyle;
    mapCtx.strokeStyle = strokeStyle;
    mapCtx.lineWidth = 2 / state.scale;
    cells.forEach(cell => {
      if (!inBounds(cell.x, cell.y)) return;
      if (state.gridMode === "isometric") {
        traceCellPath(mapCtx, cell.x, cell.y, d.width, d.height, state.tileSize, state.gridMode);
        mapCtx.fill();
        mapCtx.stroke();
        return;
      }
      mapCtx.fillRect(cell.x * state.tileSize, cell.y * state.tileSize, state.tileSize, state.tileSize);
      mapCtx.strokeRect(cell.x * state.tileSize, cell.y * state.tileSize, state.tileSize, state.tileSize);
    });
  }

  function drawPreviewRect(start, end) {
    if (!start || !end) return;
    const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x), minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
    const stroke = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff8a4d";
    if (state.gridMode === "isometric") { drawCellOverlay(shapeCells(start, end, "rect"), "rgba(255,255,255,0.12)", stroke); return; }
    mapCtx.fillStyle = "rgba(255,255,255,0.12)"; mapCtx.fillRect(minX * state.tileSize, minY * state.tileSize, (maxX - minX + 1) * state.tileSize, (maxY - minY + 1) * state.tileSize);
    mapCtx.strokeStyle = stroke; mapCtx.lineWidth = 2 / state.scale;
    mapCtx.strokeRect(minX * state.tileSize, minY * state.tileSize, (maxX - minX + 1) * state.tileSize, (maxY - minY + 1) * state.tileSize);
  }

  function drawPreviewShape(start, end, shape) {
    if (!start || !end) return;
    if (shape === "rect") { drawPreviewRect(start, end); return; }
    const cells = shapeCells(start, end, shape);
    drawCellOverlay(cells, "rgba(255,255,255,0.12)", getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff8a4d");
  }

  function drawPreviewLine(start, end) {
    drawCellOverlay(lineCells(start, end), "rgba(255,255,255,0.16)", getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff8a4d");
  }

  function drawMirrorAxes(d) {
    if (!state.mirrorX && !state.mirrorY) return;
    if (state.gridMode === "isometric") return;
    mapCtx.save();
    mapCtx.strokeStyle = "rgba(120, 210, 255, 0.72)";
    mapCtx.setLineDash([8 / state.scale, 6 / state.scale]);
    mapCtx.lineWidth = 2 / state.scale;
    if (state.mirrorX) {
      const x = (d.width * state.tileSize) / 2;
      mapCtx.beginPath(); mapCtx.moveTo(x, 0); mapCtx.lineTo(x, d.height * state.tileSize); mapCtx.stroke();
    }
    if (state.mirrorY) {
      const y = (d.height * state.tileSize) / 2;
      mapCtx.beginPath(); mapCtx.moveTo(0, y); mapCtx.lineTo(d.width * state.tileSize, y); mapCtx.stroke();
    }
    mapCtx.restore();
  }

  function drawMap() {
    mapCtx.setTransform(1, 0, 0, 1, 0, 0); mapCtx.clearRect(0, 0, els.mapCanvas.width, els.mapCanvas.height);
    mapCtx.imageSmoothingEnabled = false;
    mapCtx.setTransform(state.scale, 0, 0, state.scale, state.offsetX, state.offsetY);
    const d = getMapDimensions();
    if (!d.width || !d.height) return;
    const mapSize = mapPixelSize(d.width, d.height, state.tileSize, state.gridMode);
    drawTransparencyCheckerboard(mapCtx, mapSize.width, mapSize.height);
    drawTileLayers(mapCtx);
    if (state.showGrid) drawGrid(d.width, d.height);
    drawMirrorAxes(d);
    if (state.drawing && state.dragStartCell && state.mapShapeMode !== "single" && !state.lineAnchor && state.brushMode !== "move") drawPreviewShape(state.dragStartCell, { x: state.hoverX, y: state.hoverY }, state.mapShapeMode);
    if (state.drawing && state.lineAnchor) drawPreviewLine(state.lineAnchor, { x: state.hoverX, y: state.hoverY });
    if (state.mapSelection) drawPreviewRect(state.mapSelection, { x: state.mapSelection.x + state.mapSelection.width - 1, y: state.mapSelection.y + state.mapSelection.height - 1 });
    if (state.moveDrag) drawPreviewRect({ x: state.moveDrag.targetX, y: state.moveDrag.targetY }, { x: state.moveDrag.targetX + state.moveDrag.selection.width - 1, y: state.moveDrag.targetY + state.moveDrag.selection.height - 1 });
    if (state.hoverX >= 0 && state.hoverY >= 0 && state.hoverX < d.width && state.hoverY < d.height) {
      drawCellOverlay([{ x: state.hoverX, y: state.hoverY }], state.brushMode === "erase" ? "rgba(255,100,80,0.18)" : "rgba(255,255,255,0.16)", getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff8a4d");
    }
  }

  function downloadJson(payload, name) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; link.click(); URL.revokeObjectURL(link.href);
  }

  function downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function buildTilemapProjectPayload() {
    const d = getMapDimensions();
    const tilesets = await serializeTilesetsForExport(state.tilesets);
    return { name: String(els.projectNameInput && els.projectNameInput.value || state.projectName || "tilemap").trim() || "tilemap", tileSize: state.tileSize, width: d.width, height: d.height, gridMode: state.gridMode, showGrid: state.showGrid, layers: state.layers, layerMeta: state.layerMeta, mirrorX: state.mirrorX, mirrorY: state.mirrorY, brushMirrorX: state.brushMirrorX, brushMirrorY: state.brushMirrorY, paintOptions: { sourceMode: state.paintOptions.sourceMode }, smartBrush: state.smartBrush, tilesets };
  }

  async function buildTiledMapPayload() {
    const d = getMapDimensions();
    const serializedTilesets = await serializeTilesetsForExport(state.tilesets);
    const layers = state.layers.map((layer, index) => ({
      id: index + 1, name: "Layer " + (index + 1), type: "tilelayer", visible: state.layerMeta[index].visible, opacity: state.layerMeta[index].opacity,
      width: d.width, height: d.height, x: 0, y: 0, data: layer.flat().map(tile => tile < 0 ? 0 : tile + 1)
    }));
    const tilesets = serializedTilesets.length ? serializedTilesets.map(t => ({ firstgid: t.firstTile + 1, name: t.name, tilewidth: t.tileSize || state.tileSize, tileheight: t.tileSize || state.tileSize, columns: t.columns, tilecount: t.tileCount, image: t.name, imagewidth: t.columns * (t.tileSize || state.tileSize), imageheight: t.rows * (t.tileSize || state.tileSize), sourceUrl: t.sourceUrl, sourceDataUrl: t.sourceDataUrl })) : [{ firstgid: 1, name: "spritesheet", tilewidth: state.tileSize, tileheight: state.tileSize, columns: state.columns, tilecount: state.columns * state.rows, image: "spritesheet.png", imagewidth: state.columns * state.tileSize, imageheight: state.rows * state.tileSize }];
    const tiledTileHeight = state.gridMode === "isometric" ? Math.max(1, Math.round(state.tileSize / 2)) : state.tileSize;
    return { compressionlevel: -1, height: d.height, width: d.width, tileheight: tiledTileHeight, tilewidth: state.tileSize, infinite: false, orientation: state.gridMode === "isometric" ? "isometric" : "orthogonal", renderorder: "right-down", tiledversion: "1.10", type: "map", version: "1.10", layers, tilesets };
  }

  async function exportJson() {
    downloadJson(await buildTilemapProjectPayload(), projectFileStem(".json"));
    setStatus("Exported tilemap project JSON.");
  }

  async function exportTiledJson() {
    downloadJson(await buildTiledMapPayload(), projectFileStem(".tiled.json"));
    setStatus("Exported Tiled-compatible JSON.");
  }

  function exportPng() {
    const d = getMapDimensions();
    if (!d.width || !d.height) return;
    const canvas = renderMapToCanvas({ grid: false, background: false });
    try {
      canvas.toBlob(blob => {
        if (!blob) { setStatus("PNG export failed."); return; }
        downloadBlob(blob, projectFileStem(".png"));
        setStatus("Exported PNG preview.");
      }, "image/png");
    } catch (error) {
      setStatus("PNG export failed. Try a local spritesheet or a dashboard-hosted image.");
    }
  }

  async function describeCurrentAssets() {
    const d = getMapDimensions();
    const descriptors = [];
    if (d.width && d.height) {
      const canvas = renderMapToCanvas({ grid: false, background: false });
      const dataUrl = canvas.toDataURL("image/png");
      descriptors.push({
        kind: "image",
        title: "Tilemap PNG",
        fileName: projectFileStem(".png"),
        mimeType: "image/png",
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        previewKind: "image",
        previewUrl: dataUrl,
        sourceDetail: "Rendered PNG preview from Tilemap Creator.",
        metadata: { sourceTool: "tilemap-creator", gridMode: state.gridMode, width: d.width, height: d.height }
      });
    }
    const projectPayload = await buildTilemapProjectPayload();
    const tiledPayload = await buildTiledMapPayload();
    descriptors.push({
      kind: "text",
      title: "Tilemap Project JSON",
      fileName: projectFileStem(".json"),
      mimeType: "application/json",
      textContent: JSON.stringify(projectPayload, null, 2),
      previewKind: "text",
      previewText: JSON.stringify(projectPayload, null, 2),
      sourceDetail: "Native Tilemap Creator project JSON.",
      metadata: { sourceTool: "tilemap-creator", resourceFormat: "tilemap-project-json" }
    });
    descriptors.push({
      kind: "text",
      title: "Tiled Map JSON",
      fileName: projectFileStem(".tiled.json"),
      mimeType: "application/json",
      textContent: JSON.stringify(tiledPayload, null, 2),
      previewKind: "text",
      previewText: JSON.stringify(tiledPayload, null, 2),
      sourceDetail: "Tiled-compatible map JSON from Tilemap Creator.",
      metadata: { sourceTool: "tilemap-creator", resourceFormat: "tiled-json" }
    });
    return descriptors;
  }

  window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
  window.__urageToolDescribeCurrentAsset = async () => (await describeCurrentAssets())[0] || null;

  async function importMap(payload) {
    if (payload && payload.name && els.projectNameInput) {
      els.projectNameInput.value = String(payload.name || "tilemap");
      state.projectName = els.projectNameInput.value;
    }
    if (payload && payload.type === "map" && Array.isArray(payload.layers)) {
      state.tileSize = clampNumber(payload.tilewidth || payload.tileheight, 4, 256, state.tileSize);
      els.tileSizeInput.value = state.tileSize;
      state.gridMode = payload.orientation === "isometric" ? "isometric" : "orthogonal";
      els.gridWidthInput.value = payload.width || 30; els.gridHeightInput.value = payload.height || 20;
      state.layers = payload.layers.filter(layer => layer.type === "tilelayer" && Array.isArray(layer.data)).map(layer => {
        const data = layer.data.map(tile => Math.max(-1, Number(tile) - 1));
        return Array.from({ length: payload.height }, (_, y) => data.slice(y * payload.width, y * payload.width + payload.width));
      });
      state.layerMeta = payload.layers.filter(layer => layer.type === "tilelayer" && Array.isArray(layer.data)).map(layer => ({ visible: layer.visible !== false, opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1 }));
    } else {
      state.tileSize = clampNumber(payload.tileSize, 4, 256, state.tileSize); els.tileSizeInput.value = state.tileSize;
      els.gridWidthInput.value = payload.width || 30; els.gridHeightInput.value = payload.height || 20;
      state.layers = Array.isArray(payload.layers) ? payload.layers : [];
      state.layerMeta = Array.isArray(payload.layerMeta) ? payload.layerMeta : state.layers.map(() => ({ visible: true, opacity: 1 }));
      state.mirrorX = !!payload.mirrorX; state.mirrorY = !!payload.mirrorY; state.brushMirrorX = !!payload.brushMirrorX; state.brushMirrorY = !!payload.brushMirrorY; state.gridMode = normalizeGridMode(payload.gridMode); state.showGrid = payload.showGrid !== false; if (payload.smartBrush && typeof payload.smartBrush === "object") { state.smartBrush = { enabled: !!payload.smartBrush.enabled, activeProfileId: payload.smartBrush.activeProfileId || "default", profiles: Array.isArray(payload.smartBrush.profiles) ? payload.smartBrush.profiles : [{ id: "default", name: "Brush 1", roles: payload.smartBrush.roles || {} }], paintToken: 0 }; normalizeSmartBrushProfiles(); }
    }
    state.paintOptions = { sourceMode: normalizePaintSourceMode(payload.paintOptions && payload.paintOptions.sourceMode), sequenceIndex: 0 };
    if (els.gridModeSelect) els.gridModeSelect.value = state.gridMode;
    if (els.showGridInput) els.showGridInput.checked = state.showGrid;
    if (els.mirrorXInput) els.mirrorXInput.checked = state.mirrorX;
    if (els.mirrorYInput) els.mirrorYInput.checked = state.mirrorY;
    if (els.brushMirrorXInput) els.brushMirrorXInput.checked = state.brushMirrorX;
    if (els.brushMirrorYInput) els.brushMirrorYInput.checked = state.brushMirrorY;
    setPaintSourceMode(state.paintOptions.sourceMode);
    if (!state.layers.length) state.layers = [createLayer(clampNumber(els.gridWidthInput.value, 1, 512, 30), clampNumber(els.gridHeightInput.value, 1, 512, 20))];
    await restoreTilesetsFromPayload(getTilesetEntriesFromPayload(payload));
    state.currentLayer = 0; refreshTilesetMetrics(); ensureLayerMeta(); pushHistory("Imported map"); updateLayerSelect(); updateLayerList(); updateStats(); drawTileset(); resetView();
    setStatus(state.tilesets.length ? "Imported map and restored tilesets." : "Imported map.");
  }

  function loadSpritesheetFromUrl(url, label) {
    const source = String(url || "").trim();
    if (!source) return;
    const image = new Image(); image.crossOrigin = "anonymous";
    image.onload = () => addTileset(image, label || "dashboard image", source);
    image.onerror = () => setStatus("Could not load dashboard media as a tileset."); image.src = source;
  }

  function finishSpritesheetLoad(label) {
    syncActiveTilesetFields(); drawTileset(); drawMap(); updateStats(); setStatus("Loaded " + (label || "spritesheet") + ".");
  }

  function getGeneratedImageUrl(image) {
    const explicitUrl = String(image && image.url || "").trim();
    if (explicitUrl) return explicitUrl;
    const imageId = String(image && image.id || "").trim(); const fileName = String(image && (image.imageFileName || image.fileName) || "").trim();
    return imageId && fileName ? "/api/generated-image-file?imageId=" + encodeURIComponent(imageId) + "&file=" + encodeURIComponent(fileName) : "";
  }

  function normalizeGeneratedImage(image, index) {
    const url = getGeneratedImageUrl(image);
    if (!url) return null;
    return { id: String(image && image.id || "recent-" + index), name: String(image && (image.imageFileName || image.fileName) || "Generated " + (index + 1)).trim(), url, detail: String(image && image.prompt || "").trim() };
  }

  function normalizePoolImage(poolId, image, index) {
    if (typeof image === "string") { const url = image.trim(); return url ? { id: poolId + ":" + index, name: "Pool Image " + (index + 1), url, detail: url } : null; }
    const url = String(image && (image.url || image.source) || "").trim();
    if (!url) return null;
    return { id: poolId + ":" + index, name: String(image && (image.fileName || image.name) || "Pool Image " + (index + 1)).trim(), url, detail: String(image && image.source || url).trim() };
  }

  function renderMediaList(container, items, emptyText) {
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) { const empty = document.createElement("div"); empty.className = "media-empty"; empty.textContent = emptyText; container.appendChild(empty); return; }
    items.forEach(item => {
      const card = document.createElement("div"); card.className = "media-card"; card.innerHTML = "<img alt=''><strong></strong><span></span><button type='button'>Add as tileset</button>";
      card.querySelector("img").src = item.url; card.querySelector("img").alt = item.name; card.querySelector("strong").textContent = item.name; card.querySelector("span").textContent = item.detail || "";
      card.querySelector("button").addEventListener("click", () => loadSpritesheetFromUrl(item.url, item.name)); container.appendChild(card);
    });
  }

  function renderDashboardMedia() {
    const selectedPoolId = String(els.imagePoolSelect && els.imagePoolSelect.value || "").trim();
    const pool = state.imagePools.find(entry => entry.id === selectedPoolId) || null;
    const poolImages = pool ? pool.images.map((image, index) => normalizePoolImage(pool.id, image, index)).filter(Boolean) : [];
    renderMediaList(els.imagePoolList, poolImages, "No pool images available."); renderMediaList(els.recentMediaList, state.recentImages, "No recent generated images loaded yet.");
  }

  function populatePoolSelect() {
    if (!els.imagePoolSelect) return;
    const previous = String(els.imagePoolSelect.value || "").trim(); els.imagePoolSelect.innerHTML = "";
    if (state.imagePools.length === 0) { els.imagePoolSelect.appendChild(new Option("No image pools loaded", "")); renderDashboardMedia(); return; }
    state.imagePools.forEach(pool => els.imagePoolSelect.appendChild(new Option(pool.name + " (" + pool.images.length + ")", pool.id)));
    els.imagePoolSelect.value = state.imagePools.some(pool => pool.id === previous) ? previous : state.imagePools[0].id; renderDashboardMedia();
  }

  function applyDashboardMediaPayload(payload) {
    if (Array.isArray(payload && payload.pools)) {
      state.imagePools = payload.pools.map(pool => ({ id: String(pool && pool.id || "").trim(), name: String(pool && pool.name || "Image Pool").trim() || "Image Pool", images: Array.isArray(pool && pool.images) ? pool.images : [] })).filter(pool => pool.id);
      populatePoolSelect();
    }
    if (Array.isArray(payload && payload.recentImages)) { state.recentImages = payload.recentImages.map(normalizeGeneratedImage).filter(Boolean); renderDashboardMedia(); }
  }

  async function refreshDashboardMedia() {
    setStatus("Refreshing image pools and recent media...");
    try {
      const [poolsResponse, recentResponse] = await Promise.all([fetch("/api/image-pools"), fetch("/api/image-history")]);
      if (!poolsResponse.ok || !recentResponse.ok) throw new Error("Dashboard media APIs failed.");
      applyDashboardMediaPayload({ pools: await poolsResponse.json(), recentImages: (await recentResponse.json()).slice(0, 24) }); setStatus("Dashboard media refreshed.");
    } catch (error) { setStatus("Dashboard media refresh failed: " + (error && error.message || "Unknown error")); }
  }

  function setMediaTrayTab(tab) {
    state.mediaTrayTab = tab === "recent" ? "recent" : "pools";
    els.mediaTrayTabs.forEach(button => button.classList.toggle("active", button.getAttribute("data-media-tray-tab") === state.mediaTrayTab));
    els.mediaTrayPanels.forEach(panel => panel.classList.toggle("active", panel.getAttribute("data-media-tray-panel") === state.mediaTrayTab));
  }

  function setMediaTrayOpen(open, tab) {
    if (tab) setMediaTrayTab(tab);
    els.floatingMediaTray.classList.toggle("hidden", open !== true);
    if (open === true) void refreshDashboardMedia();
  }

  function setTrayPosition(left, top) { els.floatingMediaTray.style.left = left + "px"; els.floatingMediaTray.style.top = top + "px"; els.floatingMediaTray.style.right = "auto"; }
  function startTrayDrag(event) {
    if (event.button !== 0 || event.target.closest("button,select,input,textarea,a")) return;
    event.preventDefault(); const rect = els.floatingMediaTray.getBoundingClientRect();
    state.trayDrag = { active: true, startX: event.clientX, startY: event.clientY, origLeft: rect.left, origTop: rect.top, pointerId: event.pointerId, handle: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    els.floatingMediaTray.classList.add("dragging"); document.addEventListener("pointermove", onTrayDrag); document.addEventListener("pointerup", stopTrayDrag, { once: true }); document.addEventListener("pointercancel", stopTrayDrag, { once: true });
  }

  function onTrayDrag(event) {
    if (!state.trayDrag.active || state.trayDrag.pointerId !== event.pointerId) return;
    const width = els.floatingMediaTray.offsetWidth, height = els.floatingMediaTray.offsetHeight;
    const left = Math.max(12, Math.min(document.documentElement.clientWidth - width - 12, state.trayDrag.origLeft + event.clientX - state.trayDrag.startX));
    const top = Math.max(12, Math.min(document.documentElement.clientHeight - height - 12, state.trayDrag.origTop + event.clientY - state.trayDrag.startY)); setTrayPosition(left, top);
  }

  function stopTrayDrag() {
    if (!state.trayDrag.active) return;
    try { state.trayDrag.handle.releasePointerCapture(state.trayDrag.pointerId); } catch {}
    state.trayDrag.active = false; els.floatingMediaTray.classList.remove("dragging"); document.removeEventListener("pointermove", onTrayDrag); document.removeEventListener("pointercancel", stopTrayDrag);
  }


  function panelStorageKey(panel) {
    return "tilemapCreator.panel." + (panel && panel.dataset.panelKey || "overlay");
  }

  function readOverlayPanelState(panel) {
    try { return JSON.parse(localStorage.getItem(panelStorageKey(panel)) || "null"); } catch { return null; }
  }

  function persistOverlayPanelState(panel) {
    if (!panel) return;
    const rect = panelRectLocal(panel);
    try {
      localStorage.setItem(panelStorageKey(panel), JSON.stringify({
        left: rect.left,
        top: rect.top,
        width: panel.offsetWidth,
        height: panel.offsetHeight
      }));
    } catch {}
  }

  function applyOverlayPanelState(panel) {
    if (!panel || !els.canvasStage) return;
    const saved = readOverlayPanelState(panel);
    if (!saved) return;
    const stage = els.canvasStage.getBoundingClientRect();
    if (Number.isFinite(saved.width)) {
      const width = Math.max(180, saved.width);
      panel.style.width = width + "px";
    }
    if (Number.isFinite(saved.height)) {
      const height = Math.max(120, saved.height);
      panel.style.height = height + "px";
    }
    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) setOverlayPanelPosition(panel, saved.left, saved.top, false);
  }

  function panelRectLocal(panel) {
    const stageRect = els.canvasStage.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    return { left: rect.left - stageRect.left, top: rect.top - stageRect.top, right: rect.right - stageRect.left, bottom: rect.bottom - stageRect.top, width: rect.width, height: rect.height };
  }

  function rectOverlapArea(a, b) {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
  }

  function setOverlayPanelPosition(panel, left, top, persist = true) {
    if (!panel || !els.canvasStage) return;
    const stage = els.canvasStage.getBoundingClientRect();
    const width = panel.offsetWidth || 240;
    const height = panel.offsetHeight || 160;
    const margin = 10;
    const maxLeft = Math.max(margin, stage.width - width - margin);
    const maxTop = Math.max(margin, stage.height - height - margin);
    const nextLeft = Math.max(margin, Math.min(maxLeft, left));
    const nextTop = Math.max(margin, Math.min(maxTop, top));
    panel.style.left = nextLeft + "px";
    panel.style.top = nextTop + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    if (persist) persistOverlayPanelState(panel);
  }

  function bringOverlayPanelToFront(panel) {
    if (!panel) return;
    state.overlayZ += 1;
    panel.style.zIndex = String(state.overlayZ);
  }

  function candidateOverlayPositions(panel) {
    const stage = els.canvasStage.getBoundingClientRect();
    const w = panel.offsetWidth || 320;
    const h = panel.offsetHeight || 220;
    const m = 16;
    return [
      { left: stage.width - w - m, top: stage.height - h - m },
      { left: m, top: m },
      { left: m, top: stage.height - h - m },
      { left: stage.width - w - m, top: m },
      { left: Math.max(m, (stage.width - w) / 2), top: Math.max(m, stage.height - h - m) }
    ];
  }

  function placeSmartWallPanelDefault() {
    const panel = els.smartWallPanel;
    if (!panel || !els.canvasStage) return;
    const saved = readOverlayPanelState(panel);
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      setOverlayPanelPosition(panel, saved.left, saved.top, false);
      return;
    }
    const blockers = [els.tilesetPanel, els.layersPanel].filter(Boolean).filter(other => other !== panel && !other.classList.contains("collapsed"));
    let best = null;
    for (const candidate of candidateOverlayPositions(panel)) {
      setOverlayPanelPosition(panel, candidate.left, candidate.top, false);
      const current = panelRectLocal(panel);
      const overlap = blockers.reduce((sum, other) => sum + rectOverlapArea(current, panelRectLocal(other)), 0);
      const score = overlap + Math.max(0, -candidate.left) * 1000 + Math.max(0, -candidate.top) * 1000;
      if (!best || score < best.score) best = { ...candidate, score };
    }
    if (best) setOverlayPanelPosition(panel, best.left, best.top, false);
  }

  function overlayPanelList() {
    return [els.smartWallPanel, els.tilesetPanel, els.layersPanel].filter(Boolean);
  }

  function layoutCollapsedOverlayPanels() {
    if (!els.canvasStage) return;
    const margin = 16;
    const gap = 8;
    let left = margin;
    overlayPanelList().filter(panel => panel.classList.contains("collapsed")).forEach(panel => {
      panel.style.left = left + "px";
      panel.style.right = "auto";
      panel.style.top = "auto";
      panel.style.bottom = margin + "px";
      left += panel.offsetWidth + gap;
    });
  }

  function rememberExpandedOverlayPanelRect(panel) {
    if (!panel || !els.canvasStage || panel.classList.contains("collapsed")) return;
    const rect = panel.getBoundingClientRect();
    const stageRect = els.canvasStage.getBoundingClientRect();
    panel.dataset.expandedLeft = String(rect.left - stageRect.left);
    panel.dataset.expandedTop = String(rect.top - stageRect.top);
    panel.dataset.expandedWidth = String(rect.width);
    panel.dataset.expandedHeight = String(rect.height);
  }

  function restoreExpandedOverlayPanelRect(panel) {
    if (!panel) return;
    const width = parseFloat(panel.dataset.expandedWidth);
    const height = parseFloat(panel.dataset.expandedHeight);
    if (Number.isFinite(width)) panel.style.width = width + "px";
    if (Number.isFinite(height)) panel.style.height = height + "px";
    panel.style.bottom = "auto";
    const left = parseFloat(panel.dataset.expandedLeft);
    const top = parseFloat(panel.dataset.expandedTop);
    if (Number.isFinite(left) && Number.isFinite(top)) setOverlayPanelPosition(panel, left, top, false);
    else setOverlayPanelPosition(panel, parseFloat(panel.style.left) || 16, parseFloat(panel.style.top) || 16, false);
  }

  function setOverlayPanelCollapsed(panel, collapsed) {
    if (!panel) return;
    const isCollapsed = panel.classList.contains("collapsed");
    if (collapsed === isCollapsed) return;
    if (collapsed) {
      rememberExpandedOverlayPanelRect(panel);
      panel.classList.add("collapsed");
      layoutCollapsedOverlayPanels();
      return;
    }
    panel.classList.remove("collapsed");
    restoreExpandedOverlayPanelRect(panel);
    layoutCollapsedOverlayPanels();
  }

  function toggleOverlayPanelCollapsed(panel) {
    setOverlayPanelCollapsed(panel, !panel.classList.contains("collapsed"));
  }

  function constrainOverlayPanels() {
    overlayPanelList().forEach(panel => {
      if (panel.classList.contains("collapsed")) return;
      if (panel.style.left && panel.style.top) setOverlayPanelPosition(panel, parseFloat(panel.style.left), parseFloat(panel.style.top), false);
    });
    layoutCollapsedOverlayPanels();
  }

  function startOverlayPanelDrag(event) {
    const panel = event.currentTarget.closest(".overlay-panel");
    if (!panel || event.button !== 0 || event.target.closest("button,select,input,textarea,a")) return;
    event.preventDefault();
    bringOverlayPanelToFront(panel);
    const rect = panel.getBoundingClientRect();
    const stageRect = els.canvasStage.getBoundingClientRect();
    state.overlayDrag = { active: true, panel, key: panelStorageKey(panel), startX: event.clientX, startY: event.clientY, origLeft: rect.left - stageRect.left, origTop: rect.top - stageRect.top, pointerId: event.pointerId, handle: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    panel.classList.add("dragging");
    document.addEventListener("pointermove", onOverlayPanelDrag);
    document.addEventListener("pointerup", stopOverlayPanelDrag, { once: true });
    document.addEventListener("pointercancel", stopOverlayPanelDrag, { once: true });
  }

  function onOverlayPanelDrag(event) {
    if (!state.overlayDrag.active || state.overlayDrag.pointerId !== event.pointerId) return;
    const left = state.overlayDrag.origLeft + event.clientX - state.overlayDrag.startX;
    const top = state.overlayDrag.origTop + event.clientY - state.overlayDrag.startY;
    setOverlayPanelPosition(state.overlayDrag.panel, left, top, true);
  }

  function stopOverlayPanelDrag() {
    if (!state.overlayDrag.active) return;
    try { state.overlayDrag.handle.releasePointerCapture(state.overlayDrag.pointerId); } catch {}
    if (state.overlayDrag.panel) state.overlayDrag.panel.classList.remove("dragging");
    state.overlayDrag.active = false;
    document.removeEventListener("pointermove", onOverlayPanelDrag);
    document.removeEventListener("pointercancel", stopOverlayPanelDrag);
  }

  function bindOverlayPanelWindow(panel) {
    if (!panel) return;
    panel.dataset.panelKey = panel.dataset.panelKey || (panel.classList.contains("smart-wall-panel") ? "smartWall" : panel.classList.contains("tileset-panel") ? "tileset" : panel.classList.contains("layers-panel") ? "layers" : "panel");
    applyOverlayPanelState(panel);
    const head = panel.querySelector(".overlay-head");
    if (head) head.addEventListener("pointerdown", startOverlayPanelDrag);
    panel.addEventListener("pointerdown", () => bringOverlayPanelToFront(panel));
    if (window.ResizeObserver && !panel._tilemapResizeObserver) {
      let resizeFrame = 0;
      let lastWidth = panel.offsetWidth;
      let lastHeight = panel.offsetHeight;
      panel._tilemapResizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (panel.classList.contains("collapsed")) return;
          const widthChanged = Math.abs(panel.offsetWidth - lastWidth) > 1;
          const heightChanged = Math.abs(panel.offsetHeight - lastHeight) > 1;
          lastWidth = panel.offsetWidth;
          lastHeight = panel.offsetHeight;
          if (!widthChanged && !heightChanged) return;

          // Important: resizing should behave like Blender-style floating panels.
          // Keep the panel's top-left anchor fixed while the user pulls the resize
          // handle. Only persist the new size here; position clamping is reserved
          // for actual dragging and browser/window resizes. Calling
          // setOverlayPanelPosition during resize made panels appear to slide.
          persistOverlayPanelState(panel);
        });
      });
      panel._tilemapResizeObserver.observe(panel);
    }
  }

  function bindEvents() {
    [els.tilesetPanel, els.layersPanel, els.smartWallPanel].filter(Boolean).forEach(bindOverlayPanelWindow);
    if (els.layersPanel && !els.layersPanel._tilemapPanelGuardBound) {
      els.layersPanel._tilemapPanelGuardBound = true;
      // Do NOT stop propagation in capture here: that prevents the delegated
      // layer-list handlers from ever seeing Select/Hide/Reorder clicks.
      // The map canvas is a sibling under this overlay, so normal overlay controls
      // do not need this guard. Only suppress the browser context menu inside rows.
      els.layersPanel.addEventListener("contextmenu", event => {
        if (event.target.closest(".layer-row")) event.preventDefault();
      });
    }
    if (els.layerList && !els.layerList._tilemapLayerEventsBound) {
      els.layerList._tilemapLayerEventsBound = true;
    }
    placeSmartWallPanelDefault();
    constrainOverlayPanels();
    if (els.tilesetTabPreview && els.tilesetTabPreview.parentElement !== document.body) document.body.appendChild(els.tilesetTabPreview);
    els.uploadInput.addEventListener("change", async event => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      setStatus("Loading uploaded images...");
      try { await addUploadedTilesets(files); } catch (error) { setStatus(error && error.message || "Could not load uploaded images."); }
      event.target.value = "";
    });
    els.tilesetCanvas.addEventListener("pointerenter", () => { state.tilesetHovered = true; });
    els.tilesetCanvas.addEventListener("pointerleave", () => { state.tilesetHovered = false; });
    els.tilesetCanvas.addEventListener("pointerdown", event => {
      if (!state.imageLoaded || event.button !== 0) return;
      event.preventDefault(); const cell = tilesetCellFromEvent(event);
      state.tilesetDrag = { start: cell, end: cell, pointerId: event.pointerId, additive: event.ctrlKey || event.metaKey };
      try { els.tilesetCanvas.setPointerCapture(event.pointerId); } catch {}
      if (state.tilesetSelectMode === "single" && !state.tilesetDrag.additive) setSingleSelectedTile(cell.y * state.columns + cell.x);
      drawTileset();
    });
    els.tilesetCanvas.addEventListener("pointermove", event => {
      if (!state.tilesetDrag || state.tilesetDrag.pointerId !== event.pointerId) return;
      state.tilesetDrag.end = tilesetCellFromEvent(event); drawTileset();
    });
    els.tilesetCanvas.addEventListener("pointerup", event => {
      if (!state.tilesetDrag || state.tilesetDrag.pointerId !== event.pointerId) return;
      state.tilesetDrag.end = tilesetCellFromEvent(event);
      const selection = makeTilesetSelection(state.tilesetDrag.start, state.tilesetDrag.end, state.tilesetSelectMode);
      state.brushTiles = state.tilesetDrag.additive ? mergeTilesetSelection(selection) : selection;
      state.selectedTile = state.brushTiles.flat().find(tile => tile >= 0) ?? 0; state.tilesetDrag = null; drawTileset();
      setStatus("Selected " + state.brushTiles.flat().filter(tile => tile >= 0).length + " tile brush.");
    });
    if (els.activeTilesetTileSizeInput) {
      els.activeTilesetTileSizeInput.addEventListener("change", () => setActiveTilesetTileSize(els.activeTilesetTileSizeInput.value));
      els.activeTilesetTileSizeInput.addEventListener("keydown", event => { if (event.key === "Enter") setActiveTilesetTileSize(els.activeTilesetTileSizeInput.value); });
    }
    if (els.duplicateTilesetButton) els.duplicateTilesetButton.addEventListener("click", duplicateActiveTileset);
    els.createGridButton.addEventListener("click", createGrid); els.addLayerButton.addEventListener("click", addLayer);
    if (els.duplicateLayerButton) els.duplicateLayerButton.addEventListener("click", duplicateLayer);
    els.clearLayerButton.addEventListener("click", () => clearLayer(state.currentLayer)); els.clearAllButton.addEventListener("click", clearAllLayers);
    els.layerSelect.addEventListener("change", () => { state.currentLayer = clampNumber(els.layerSelect.value, 0, Math.max(0, state.layers.length - 1), 0); updateLayerList(); drawMap(); });
    document.querySelectorAll("[data-brush-mode]").forEach(button => button.addEventListener("click", () => setBrushMode(button.getAttribute("data-brush-mode") || "paint")));
    document.querySelectorAll("[data-map-shape-mode]").forEach(button => button.addEventListener("click", () => setMapShapeMode(button.getAttribute("data-map-shape-mode") || "single")));
    document.querySelectorAll("[data-tileset-select-mode]").forEach(button => button.addEventListener("click", () => setTilesetSelectMode(button.getAttribute("data-tileset-select-mode") || "single")));
    if (els.mirrorXInput) els.mirrorXInput.addEventListener("change", event => setMirror("x", event.target.checked));
    if (els.mirrorYInput) els.mirrorYInput.addEventListener("change", event => setMirror("y", event.target.checked));
    if (els.brushMirrorXInput) els.brushMirrorXInput.addEventListener("change", event => setBrushMirror("x", event.target.checked));
    if (els.brushMirrorYInput) els.brushMirrorYInput.addEventListener("change", event => setBrushMirror("y", event.target.checked));
    if (els.flipBrushXButton) els.flipBrushXButton.addEventListener("click", () => flipCurrentBrush("x"));
    if (els.flipBrushYButton) els.flipBrushYButton.addEventListener("click", () => flipCurrentBrush("y"));
    if (els.gridModeSelect) els.gridModeSelect.addEventListener("change", event => setGridMode(event.target.value));
    document.querySelectorAll("[data-paint-source-mode]").forEach(button => {
      button.addEventListener("pointerup", event => {
        if (event.button !== 0) return;
        event.preventDefault();
        button.dataset.pointerHandled = "1";
        setPaintSourceMode(button.getAttribute("data-paint-source-mode") || "stamp");
      });
      button.addEventListener("click", event => {
        if (button.dataset.pointerHandled === "1") {
          delete button.dataset.pointerHandled;
          event.preventDefault();
          return;
        }
        setPaintSourceMode(button.getAttribute("data-paint-source-mode") || "stamp");
      });
    });
    if (els.showGridInput) els.showGridInput.addEventListener("change", event => { state.showGrid = event.target.checked; drawMap(); setStatus(state.showGrid ? "Grid shown." : "Grid hidden."); });
    if (els.selectAllMapButton) els.selectAllMapButton.addEventListener("click", selectAllMapTiles);
    if (els.flipSelectionXButton) els.flipSelectionXButton.addEventListener("click", flipSelectionHorizontal);
    if (els.flipSelectionYButton) els.flipSelectionYButton.addEventListener("click", flipSelectionVertical);
    if (els.projectNameInput) els.projectNameInput.addEventListener("input", () => { state.projectName = String(els.projectNameInput.value || "tilemap").trim() || "tilemap"; });
    if (els.smartBrushEnabledInput) els.smartBrushEnabledInput.addEventListener("change", event => setSmartBrushEnabled(event.target.checked));
    if (els.smartBrushMirrorXInput) els.smartBrushMirrorXInput.addEventListener("change", event => setSmartBrushRoleMirror("x", event.target.checked));
    if (els.smartBrushMirrorYInput) els.smartBrushMirrorYInput.addEventListener("change", event => setSmartBrushRoleMirror("y", event.target.checked));
    if (els.addSmartBrushProfileButton) els.addSmartBrushProfileButton.addEventListener("click", () => addSmartBrushProfile(false));
    if (els.duplicateSmartBrushProfileButton) els.duplicateSmartBrushProfileButton.addEventListener("click", () => addSmartBrushProfile(true));
    if (els.renameSmartBrushProfileButton) els.renameSmartBrushProfileButton.addEventListener("click", renameSmartBrushProfile);
    if (els.deleteSmartBrushProfileButton) els.deleteSmartBrushProfileButton.addEventListener("click", deleteSmartBrushProfile);
    if (els.smartBrushFromSelectionButton) els.smartBrushFromSelectionButton.addEventListener("click", () => autoMapSmartBrushFromSelection(false));
    if (els.smartBrushAddVariantsFromSelectionButton) els.smartBrushAddVariantsFromSelectionButton.addEventListener("click", () => autoMapSmartBrushFromSelection(true));
    if (els.smartBrushClearButton) els.smartBrushClearButton.addEventListener("click", () => { activeSmartBrushProfile().roles = {}; renderSmartBrushManager(); setSmartBrushEnabled(false); setStatus("Smart brush profile cleared."); });
    renderSmartBrushManager();
    function handleTilesetTabSwitch(event) {
      const tab = event.target.closest(".tileset-tab");
      if (!tab || !els.tilesetTabs.contains(tab)) return;
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      switchTileset(Number(tab.dataset.tilesetIndex || 0));
    }

    if (els.tilesetTabs) {
      els.tilesetTabs.addEventListener("pointerdown", handleTilesetTabSwitch, { capture: true });
      els.tilesetTabs.addEventListener("mousedown", handleTilesetTabSwitch, { capture: true });
      els.tilesetTabs.addEventListener("click", handleTilesetTabSwitch, { capture: true });
      els.tilesetTabs.addEventListener("touchstart", handleTilesetTabSwitch, { capture: true, passive: false });
    }
    els.resetViewButton.addEventListener("click", resetView); if (els.fitViewButton) els.fitViewButton.addEventListener("click", fitView); els.exportJsonButton.addEventListener("click", exportJson); els.exportTiledButton.addEventListener("click", exportTiledJson); if (els.exportPngButton) els.exportPngButton.addEventListener("click", exportPng);
    els.importJsonButton.addEventListener("click", () => els.importJsonInput.click());
    els.importJsonInput.addEventListener("change", async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try { await importMap(JSON.parse(await file.text())); } catch (error) { setStatus("Import failed: " + (error && error.message || "Invalid JSON")); }
      event.target.value = "";
    });
    els.mapCanvas.addEventListener("mousedown", event => {
      state.panning = event.button === 1 || event.shiftKey; state.drawing = !state.panning; state.lastX = event.clientX; state.lastY = event.clientY;
      resetPaintSourceSequenceTracking();
      const cell = cellFromEvent(event); state.hoverX = cell.x; state.hoverY = cell.y; state.dragStartCell = cell; state.lineAnchor = event.ctrlKey ? cell : null; state.ctrlErase = event.ctrlKey && isEraseGesture(event);
      if (state.drawing && state.brushMode === "move") {
        if (state.mapShapeMode === "single" || selectionContains(state.mapSelection, cell)) { startMoveDrag(cell); drawMap(); return; }
        drawMap(); return;
      }
      if (state.drawing && state.mapShapeMode === "single" && !event.ctrlKey) { if (paintCell(cell, event)) pushHistory("Painted map"); updateLayerList(); updateStats(); drawMap(); }
    });
    els.mapCanvas.addEventListener("mousemove", event => {
      const cell = cellFromEvent(event); state.hoverX = cell.x; state.hoverY = cell.y;
      if (state.panning) { state.offsetX += event.clientX - state.lastX; state.offsetY += event.clientY - state.lastY; state.lastX = event.clientX; state.lastY = event.clientY; drawMap(); return; }
      if (state.moveDrag) { state.moveDrag.targetX = cell.x - state.moveDrag.offsetX; state.moveDrag.targetY = cell.y - state.moveDrag.offsetY; drawMap(); return; }
      if (state.drawing && state.mapShapeMode === "single" && !state.lineAnchor && state.brushMode !== "move") { if (paintCell(cell, event)) { updateLayerList(); updateStats(); } drawMap(); return; }
      drawMap();
    });
    window.addEventListener("mouseup", event => {
      if (state.moveDrag) { if (finishMoveDrag()) pushHistory("Moved tiles"); }
      else if (state.drawing) {
        const cell = { x: state.hoverX, y: state.hoverY };
        let changed = false;
        if (state.lineAnchor) changed = applyCtrlBrush(state.lineAnchor, cell, event);
        else if (state.dragStartCell && state.mapShapeMode !== "single") {
          if (state.brushMode === "pick") changed = pickShapeBrush(state.dragStartCell, cell);
          else if (state.brushMode === "move") { state.mapSelection = rectFromCells(state.dragStartCell, cell); setStatus("Selected area for moving."); }
          else changed = applyShapeBrush(state.dragStartCell, cell, event);
        }
        if (changed) pushHistory("Painted map");
      }
      resetPaintSourceSequenceTracking();
      state.drawing = false; state.panning = false; state.dragStartCell = null; state.lineAnchor = null; state.ctrlErase = false; updateLayerList(); updateStats(); drawMap();
    });
    els.mapCanvas.addEventListener("mouseleave", () => { resetPaintSourceSequenceTracking(); state.drawing = false; state.panning = false; state.dragStartCell = null; state.lineAnchor = null; state.ctrlErase = false; drawMap(); });
    els.mapCanvas.addEventListener("wheel", event => {
      event.preventDefault(); const before = worldPoint(event);
      state.scale = Math.max(0.2, Math.min(6, state.scale * (event.deltaY < 0 ? 1.1 : 0.9)));
      state.offsetX = event.offsetX - before.x * state.scale; state.offsetY = event.offsetY - before.y * state.scale; drawMap();
    }, { passive: false });
    els.mapCanvas.addEventListener("contextmenu", event => event.preventDefault());
    document.addEventListener("keydown", event => {
      if (event.target && event.target.matches("input,select,textarea")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redo(); return; }
      if ((event.ctrlKey || event.metaKey) && key === "a") { event.preventDefault(); state.tilesetHovered ? selectEntireTileset() : selectAllMapTiles(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelectedTiles(); return; }
      if (key === "tab" && state.tilesets.length) { event.preventDefault(); switchTileset(state.activeTilesetIndex + (event.shiftKey ? -1 : 1)); return; }
      const shortcuts = { p: "paint", e: "erase", f: "fill", i: "pick", m: "move" };
      const shapeShortcuts = { "1": "single", "2": "rect", "3": "circle", "4": "rectOutline", r: "rect", o: "rectOutline", c: "circle" };
      if (key === "x") { event.preventDefault(); setMirror("x", !state.mirrorX); return; }
      if (key === "y") { event.preventDefault(); setMirror("y", !state.mirrorY); return; }
      if (key === "g") { event.preventDefault(); state.showGrid = !state.showGrid; if (els.showGridInput) els.showGridInput.checked = state.showGrid; drawMap(); setStatus(state.showGrid ? "Grid shown." : "Grid hidden."); return; }
      if (key === "w") { event.preventDefault(); setSmartBrushEnabled(!state.smartBrush.enabled); return; }
      if (key === "[") { event.preventDefault(); flipCurrentBrush("x"); return; }
      if (key === "]") { event.preventDefault(); flipCurrentBrush("y"); return; }
      if (shortcuts[key]) { event.preventDefault(); setBrushMode(shortcuts[key]); return; }
      if (shapeShortcuts[key]) { event.preventDefault(); setMapShapeMode(shapeShortcuts[key]); }
    });
    els.toggleTilesetPanelButton.addEventListener("click", () => toggleOverlayPanelCollapsed(els.toggleTilesetPanelButton.closest(".overlay-panel")));
    els.toggleLayersPanelButton.addEventListener("click", () => toggleOverlayPanelCollapsed(els.toggleLayersPanelButton.closest(".overlay-panel")));
    if (els.toggleSmartWallPanelButton) els.toggleSmartWallPanelButton.addEventListener("click", () => toggleOverlayPanelCollapsed(els.toggleSmartWallPanelButton.closest(".overlay-panel")));
    els.openMediaTrayButton.addEventListener("click", () => setMediaTrayOpen(true)); els.closeMediaTrayButton.addEventListener("click", () => setMediaTrayOpen(false));
    els.refreshDashboardMediaButton.addEventListener("click", () => refreshDashboardMedia()); els.imagePoolSelect.addEventListener("change", renderDashboardMedia);
    els.mediaTrayTabs.forEach(button => button.addEventListener("click", () => setMediaTrayTab(button.getAttribute("data-media-tray-tab") || "pools")));
    els.floatingMediaTray.querySelector(".tray-head").addEventListener("pointerdown", startTrayDrag);
    window.addEventListener("message", event => {
      const message = event && event.data ? event.data : null;
      if (!message || message.source !== "urage-dashboard") return;
      if (message.type === "tool:image-pools") applyDashboardMediaPayload({ pools: message.payload && message.payload.pools });
      if (message.type === "tilemap-creator:media-tray") { applyDashboardMediaPayload(message.payload || {}); setMediaTrayOpen(message.payload && message.payload.open !== false, message.payload && message.payload.tab || "pools"); }
    });
    window.addEventListener("resize", () => { resizeMapCanvas(); constrainOverlayPanels(); });
  }

  function init() {
    syncTheme(); initSidebarSections(); bindEvents(); createGrid(); renderSmartBrushManager(); drawTileset(); resizeMapCanvas();
    if (els.brushMirrorXInput) els.brushMirrorXInput.checked = state.brushMirrorX;
    if (els.brushMirrorYInput) els.brushMirrorYInput.checked = state.brushMirrorY;
    if (els.gridModeSelect) els.gridModeSelect.value = state.gridMode;
    setPaintSourceMode(state.paintOptions.sourceMode);
    setStatus("Load a spritesheet, select a tile, then paint the map."); refreshDashboardMedia();
  }

  init();
})();
