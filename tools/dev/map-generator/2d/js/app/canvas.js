function setGeneratorOptions() {
  groundWidth = readNumber("mapTilesX", 13, 1);
  groundHeight = readNumber("mapTilesY", 7, 1);
  mapStartX = readNumber("mapStartX", 128, -9999);
  mapStartY = readNumber("mapStartY", 122, -9999);
  canvasScale = readNumber("canvasScale", 0.5, 0.1);
  exportQuality = Math.min(100, Math.max(1, readNumber("exportQuality", 65, 1)));
  var characterInput = document.getElementById("placePlayers");
  placePlayers = !characterInput || characterInput.checked;
  setCanvasScale();
  updateMirrorShapePreview();
  generateMapIfReady();
}

function generateMapIfReady() {
  if (canvas && ctx) {
    generateMap();
  }
}
window.generateMapIfReady = generateMapIfReady;
window.renderSpriteSettings = renderSpriteSettings;

function setGeneratorMode(mode) {
  generatorMode = mode === "sidescroller" || mode === "isometric" || mode === "threequarter" ? mode : "topdown";
  var topdownTab = document.getElementById("topdownModeTab");
  var threeQuarterTab = document.getElementById("threeQuarterModeTab");
  var isometricTab = document.getElementById("isometricModeTab");
  var sidescrollerTab = document.getElementById("sidescrollerModeTab");
  var topdownPanel = document.getElementById("topdownModePanel");
  var threeQuarterPanel = document.getElementById("threeQuarterModePanel");
  var isometricPanel = document.getElementById("isometricModePanel");
  var sidescrollerPanel = document.getElementById("sidescrollerModePanel");
  if (topdownTab) {
    topdownTab.classList.toggle("active", generatorMode === "topdown");
  }
  if (threeQuarterTab) {
    threeQuarterTab.classList.toggle("active", generatorMode === "threequarter");
  }
  if (isometricTab) {
    isometricTab.classList.toggle("active", generatorMode === "isometric");
  }
  if (sidescrollerTab) {
    sidescrollerTab.classList.toggle("active", generatorMode === "sidescroller");
  }
  if (topdownPanel) {
    topdownPanel.hidden = generatorMode !== "topdown";
  }
  if (threeQuarterPanel) {
    threeQuarterPanel.hidden = generatorMode !== "threequarter";
  }
  if (isometricPanel) {
    isometricPanel.hidden = generatorMode !== "isometric";
  }
  if (sidescrollerPanel) {
    sidescrollerPanel.hidden = generatorMode !== "sidescroller";
  }
  updateCanvasScrollHint();
  generateMapIfReady();
}

function updateCanvasScrollHint() {
  var hint = document.getElementById("canvasScrollHint");
  if (!hint) {
    return;
  }
  if (generatorMode === "sidescroller") {
    hint.textContent = "Sidescroller maps can run wide. Drag the preview or use the quick scroll buttons.";
    return;
  }
  if (generatorMode === "threequarter") {
    hint.textContent = "3/4 RPG previews keep top sprites readable while adding raised front and right faces for stylized depth.";
    return;
  }
  if (generatorMode === "isometric") {
    hint.textContent = "Isometric previews keep the floating arena centered while still respecting your tile and block sizing.";
    return;
  }
  hint.textContent = "Topdown previews reflect the current mirroring pattern, repeat counts, and sprite placement rules.";
}

function setSidescrollerOptions() {
  sideTilesX = readNumber("sideTilesX", 26, 1);
  sideTilesY = readNumber("sideTilesY", 13, 1);
  sideStartX = readNumber("sideStartX", 64, -9999);
  sideStartY = readNumber("sideStartY", 64, -9999);
  sideGroundRow = Math.min(sideTilesY - 1, Math.max(0, readNumber("sideGroundRow", 4, 0)));
  sideTerrainVariation = readNumber("sideTerrainVariation", 3, 0);
  sideFloatingPlatforms = readNumber("sideFloatingPlatforms", 8, 0);
  sidePlatformMinWidth = readNumber("sidePlatformMinWidth", 2, 1);
  sidePlatformMaxWidth = Math.max(sidePlatformMinWidth, readNumber("sidePlatformMaxWidth", 5, 1));
  exportQuality = Math.min(100, Math.max(1, readNumber("sideExportQuality", 65, 1)));
  var fillInput = document.getElementById("sideFillGround");
  var characterInput = document.getElementById("sidePlacePlayers");
  var emptyAboveInput = document.getElementById("sideRequireEmptyAbove");
  var sidePatternInput = document.getElementById("sideMirrorPattern");
  var sideRowInput = document.getElementById("sideMirrorCenterRowOnce");
  var sideColInput = document.getElementById("sideMirrorCenterColOnce");
  sideFillGround = !fillInput || fillInput.checked;
  sidePlacePlayers = !characterInput || characterInput.checked;
  sideRequireEmptyAbove = !emptyAboveInput || emptyAboveInput.checked;
  sideMirrorPattern = sidePatternInput ? sidePatternInput.value : "none";
  sideMirrorRepeatX = readNumber("sideMirrorRepeatX", 0, 0);
  sideMirrorRepeatY = readNumber("sideMirrorRepeatY", 0, 0);
  sideMirrorCenterRowOnce = !!(sideRowInput && sideRowInput.checked);
  sideMirrorCenterColOnce = !!(sideColInput && sideColInput.checked);
  updateSideMirrorShapePreview();
  generateMapIfReady();
}

function setIsometricOptions() {
  isoTilesX = readNumber("isoTilesX", 14, 1);
  isoTilesY = readNumber("isoTilesY", 10, 1);
  isoStartX = readNumber("isoStartX", 520, 0);
  isoStartY = readNumber("isoStartY", 80, 0);
  isoTileWidth = readNumber("isoTileWidth", 96, 16);
  isoTileHeight = readNumber("isoTileHeight", 48, 8);
  isoBlockHeight = readNumber("isoBlockHeight", 34, 0);
  isoFillPercent = Math.min(100, readNumber("isoFillPercent", 92, 0));
  isoExportQuality = Math.min(100, Math.max(1, readNumber("isoExportQuality", 70, 1)));
  exportQuality = isoExportQuality;
  var characterInput = document.getElementById("isoPlacePlayers");
  var raisedInput = document.getElementById("isoRaisedEdges");
  isoPlacePlayers = !characterInput || characterInput.checked;
  isoRaisedEdges = !raisedInput || raisedInput.checked;
  generateMapIfReady();
}
