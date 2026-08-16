function setGeneratorOptions() {
      groundWidth = readNumber("mapTilesX", 13, 1);
      groundHeight = readNumber("mapTilesY", 7, 1);
      mapStartX = readNumber("mapStartX", 128, -9999);
      mapStartY = readNumber("mapStartY", 122, -9999);
      mapEndX = readNumber("mapEndX", 96, 0);
      mapEndY = readNumber("mapEndY", 96, 0);
      mapDirection = readSelectValue("mapDirection", "row-right-down");
      canvasScale = readNumber("canvasScale", 0.5, 0.1);
      exportQuality = Math.min(100, Math.max(1, readNumber("exportQuality", 65, 1)));
      var playerInput = document.getElementById("placePlayers");
      placePlayers = !playerInput || playerInput.checked;
      topdownPlayerCount = readNumber("topdownPlayerCount", 1, 0);
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

    function readSelectValue(id, fallback) {
      var input = document.getElementById(id);
      return input ? input.value : fallback;
    }

    function setGeneratorMode(mode) {
      generatorMode = mode === "sidescroller" || mode === "isometric" ? mode : "topdown";
      var renderStyle = document.getElementById("topdownRenderStyle");
      if (renderStyle && generatorMode === "topdown" && renderStyle.value !== "threequarter") {
        renderStyle.value = "topdown";
      }
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
        threeQuarterTab.classList.toggle("active", false);
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
        threeQuarterPanel.hidden = generatorMode !== "topdown" || !(renderStyle && renderStyle.value === "threequarter");
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
      if (generatorMode === "topdown") {
        var renderStyle = document.getElementById("topdownRenderStyle");
        if (renderStyle && renderStyle.value === "threequarter") {
          hint.textContent = "3/4 RPG previews use the same Topdown generation with extra raised front and right faces.";
          return;
        }
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
      sideEndX = readNumber("sideEndX", 96, 0);
      sideEndY = readNumber("sideEndY", 64, 0);
      sideDirection = readSelectValue("sideDirection", "right-up");
      sideGroundRow = Math.min(sideTilesY - 1, Math.max(0, readNumber("sideGroundRow", 4, 0)));
      sideTerrainVariation = readNumber("sideTerrainVariation", 3, 0);
      sideFloatingPlatforms = readNumber("sideFloatingPlatforms", 8, 0);
      sidePlatformMinWidth = readNumber("sidePlatformMinWidth", 2, 1);
      sidePlatformMaxWidth = Math.max(sidePlatformMinWidth, readNumber("sidePlatformMaxWidth", 5, 1));
      exportQuality = Math.min(100, Math.max(1, readNumber("sideExportQuality", 65, 1)));
      var fillInput = document.getElementById("sideFillGround");
      var playerInput = document.getElementById("sidePlacePlayers");
      var emptyAboveInput = document.getElementById("sideRequireEmptyAbove");
      var sidePatternInput = document.getElementById("sideMirrorPattern");
      var sideRowInput = document.getElementById("sideMirrorCenterRowOnce");
      var sideColInput = document.getElementById("sideMirrorCenterColOnce");
      sideFillGround = !fillInput || fillInput.checked;
      sidePlacePlayers = !playerInput || playerInput.checked;
      sidePlayerCount = readNumber("sidePlayerCount", 1, 0);
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
      var oldTilesX = isoTilesX;
      var oldTilesY = isoTilesY;
      var oldPlacePlayers = isoPlacePlayers;
      isoTilesX = readNumber("isoTilesX", 14, 1);
      isoTilesY = readNumber("isoTilesY", 10, 1);
      isoStartX = readNumber("isoStartX", 0, -9999);
      isoStartY = readNumber("isoStartY", 0, -9999);
      isoEndX = readNumber("isoEndX", 96, 0);
      isoEndY = readNumber("isoEndY", 96, 0);
      isoDirection = readSelectValue("isoDirection", "row-right-down");
      isoTileWidth = readNumber("isoTileWidth", 96, 16);
      isoTileHeight = readNumber("isoTileHeight", 48, 8);
      isoBlockHeight = readNumber("isoBlockHeight", 34, 0);
      isoExportQuality = Math.min(100, Math.max(1, readNumber("isoExportQuality", 70, 1)));
      exportQuality = isoExportQuality;
      var playerInput = document.getElementById("isoPlacePlayers");
      var raisedInput = document.getElementById("isoRaisedEdges");
      var mirrorPatternInput = document.getElementById("isoMirrorPattern");
      var mirrorRowInput = document.getElementById("isoMirrorCenterRowOnce");
      var mirrorColInput = document.getElementById("isoMirrorCenterColOnce");
      var oldMirrorPattern = isoMirrorPattern;
      var oldMirrorRepeatX = isoMirrorRepeatX;
      var oldMirrorRepeatY = isoMirrorRepeatY;
      var oldMirrorCenterRowOnce = isoMirrorCenterRowOnce;
      var oldMirrorCenterColOnce = isoMirrorCenterColOnce;
      isoPlacePlayers = !playerInput || playerInput.checked;
      isoPlayerCount = readNumber("isoPlayerCount", 1, 0);
      isoRaisedEdges = !raisedInput || raisedInput.checked;
      isoMirrorPattern = mirrorPatternInput ? mirrorPatternInput.value : "none";
      isoMirrorRepeatX = readNumber("isoMirrorRepeatX", 0, 0);
      isoMirrorRepeatY = readNumber("isoMirrorRepeatY", 0, 0);
      isoMirrorCenterRowOnce = !!(mirrorRowInput && mirrorRowInput.checked);
      isoMirrorCenterColOnce = !!(mirrorColInput && mirrorColInput.checked);
      if (typeof window.updateIsoMirrorShapePreview === "function") {
        window.updateIsoMirrorShapePreview();
      }
      var mirrorChanged = oldMirrorPattern !== isoMirrorPattern || oldMirrorRepeatX !== isoMirrorRepeatX || oldMirrorRepeatY !== isoMirrorRepeatY || oldMirrorCenterRowOnce !== isoMirrorCenterRowOnce || oldMirrorCenterColOnce !== isoMirrorCenterColOnce;
      var needsNewLayout = oldTilesX !== isoTilesX || oldTilesY !== isoTilesY || oldPlacePlayers !== isoPlacePlayers || mirrorChanged || !currentMap.length;
      if (!needsNewLayout && generatorMode === "isometric" && typeof window.refreshIsometricPreviewOnly === "function") {
        window.refreshIsometricPreviewOnly();
        return;
      }
      generateMapIfReady();
    }

    function getDrawWidth(img) {
      return autoScaleSprites ? defaultSpriteWidth : img.width;
    }

    function getDrawHeight(img) {
      return autoScaleSprites ? defaultSpriteHeight : img.height;
    }

    function setDefaultSpriteSize() {
      defaultSpriteWidth = readNumber("defaultSpriteWidth", 64, 1);
      defaultSpriteHeight = readNumber("defaultSpriteHeight", 64, 1);
      generateMapIfReady();
    }

    function setAutoScaleSprites() {
      var input = document.getElementById("autoScaleSprites");
      autoScaleSprites = !input || input.checked;
      generateMapIfReady();
    }

    function applyPlatformSpriteSize() {
      var img = getSpriteImage(getSpriteType("platform"));
      if (!img || !img.width || !img.height) {
        return;
      }
      document.getElementById("defaultSpriteWidth").value = img.width;
      document.getElementById("defaultSpriteHeight").value = img.height;
      setDefaultSpriteSize();
    }

    function replaceBackgroundFromDisk(file, mode) {
      if (!file) {
        return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        setModeBackgroundSource(mode || getActiveBackgroundMode(), e.target.result, generateMapIfReady);
      };
      reader.readAsDataURL(file);
    }

    function replaceBackgroundFromUrl(url, mode) {
      if (!url) {
        return;
      }
      setModeBackgroundSource(mode || getActiveBackgroundMode(), url, generateMapIfReady);
    }
    window.replaceBackgroundFromUrl = replaceBackgroundFromUrl;

    function setTopdownRenderStyle() {
      var input = document.getElementById("topdownRenderStyle");
      var threeQuarterPanel = document.getElementById("threeQuarterModePanel");
      if (threeQuarterPanel) {
        threeQuarterPanel.hidden = generatorMode !== "topdown" || !(input && input.value === "threequarter");
      }
      updateCanvasScrollHint();
      if (window.ThreeQuarterMapGenerator) {
        window.ThreeQuarterMapGenerator.setOptions(false);
      }
      generateMapIfReady();
    }
    window.setTopdownRenderStyle = setTopdownRenderStyle;
