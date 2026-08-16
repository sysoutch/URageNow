if (typeof window.registerDashboardThemeSync === "function") {
  window.registerDashboardThemeSync(function(themeName, tokens) {
    var root = document.documentElement;
    root.style.setProperty("--bg", tokens.bg);
    root.style.setProperty("--panel", tokens.surface);
    root.style.setProperty("--panel-soft", tokens.surfaceStrong);
    root.style.setProperty("--panel-strong", tokens.surfaceStrong);
    root.style.setProperty("--text", tokens.text);
    root.style.setProperty("--muted", tokens.muted);
    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--accent-2", tokens.accentStrong);
    root.style.setProperty("--border", tokens.line);
  });
}
var background;
var backgrounds = {};
var autoGenerateMap = true;
var autoGenerateMapIntervalInSeconds = 1;
var groundWidth = 13;
var groundHeight = 7;
var mapStartX = 128;
var mapStartY = 122;
var canvasScale = 0.5;
var exportQuality = 65;
var placePlayers = true;
var defaultSpriteWidth = 64;
var defaultSpriteHeight = 64;
var autoScaleSprites = true;
var mirrorPattern = "xy";
var mirrorRepeatX = 1;
var mirrorRepeatY = 1;
var mirrorCenterRowOnce = true;
var mirrorCenterColOnce = false;
var currentMap = [];
var currentItems = [];
var generationSeed = "";
var generationRandom = Math.random;
var lastGenerationSeedLabel = "random";
var canvas;
var ctx;
var generatorMode = "topdown";
var sideTilesX = 26;
var sideTilesY = 13;
var sideStartX = 64;
var sideStartY = 64;
var sideGroundRow = 4;
var sideTerrainVariation = 3;
var sideFloatingPlatforms = 8;
var sidePlatformMinWidth = 2;
var sidePlatformMaxWidth = 5;
var sideFillGround = true;
var sidePlacePlayers = true;
var sideRequireEmptyAbove = true;
var sideMirrorPattern = "none";
var sideMirrorRepeatX = 0;
var sideMirrorRepeatY = 0;
var sideMirrorCenterRowOnce = false;
var sideMirrorCenterColOnce = false;
var isoTilesX = 14;
var isoTilesY = 10;
var isoStartX = 520;
var isoStartY = 80;
var isoTileWidth = 96;
var isoTileHeight = 48;
var isoBlockHeight = 34;
var isoFillPercent = 92;
var isoExportQuality = 70;
var isoPlacePlayers = true;
var isoRaisedEdges = true;
var canvasBaseWidth = 960;
var canvasBaseHeight = 540;
var canvasPadding = 96;

var spriteTypes = [
  { id: "platform", name: "Platforms", imageId: "ground-o", role: "platform", minPercent: 60, maxPercent: 100, confidence: 0.5, removable: false },
  { id: "hole", name: "Holes", imageId: "hole-o", role: "hole", minPercent: 0, maxPercent: 100, confidence: 0, removable: false },
  { id: "brick", name: "Bricks", imageId: "brick-o", role: "item", minPercent: 0, maxPercent: 10, confidence: 0.75, removable: false, placement: "surface", placeAboveSupport: true },
  { id: "vase", name: "Vases", imageId: "vase-o", role: "item", minPercent: 0, maxPercent: 5, confidence: 0.1, removable: false, placement: "surface", placeAboveSupport: true },
  { id: "chest", name: "Chests", imageId: "chest-o", role: "item", minPercent: 0, maxPercent: 3, confidence: 0.9, removable: false, placement: "surface", placeAboveSupport: true }
];
