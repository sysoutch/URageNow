window.onload = function() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  setCanvasScale();

  setupSpriteUploads();
  initSidebarSections();
  renderSpriteSettings();
  if (window.MapGeneratorStarterLibraries) {
    window.MapGeneratorStarterLibraries.render("starterAssetLibraryList");
  }

  document.getElementById("autoGenerateMapIntervalId").addEventListener("change", setAutoGenerateMapInterval);
  document.getElementById("importGeneratorSetupInput").addEventListener("change", importGeneratorSetupFromFile);
  setDefaultSpriteSize();
  setAutoScaleSprites();
  setGenerationSeed();
  setMirrorOptions();
  setGeneratorOptions();
  setSidescrollerOptions();
  setIsometricOptions();
  if (window.ThreeQuarterMapGenerator) {
    window.ThreeQuarterMapGenerator.setOptions(false);
  }
  setGeneratorMode("topdown");
  setupCanvasDragPan();

  setModeBackgroundSource("topdown", "images/bg.png", generateMapIfReady);
  setModeBackgroundSource("threequarter", "images/bg.png", generateMapIfReady);
  setModeBackgroundSource("isometric", "images/bg.png", generateMapIfReady);
  setModeBackgroundSource("sidescroller", "images/bg.png", generateMapIfReady);
};
