function clearAndDrawBackground() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setCanvasScale();
  background = getActiveBackground();
  if (background && background.complete && background.naturalWidth > 0) {
    ctx.drawImage(background, 0, 0, canvas.width / canvasScale, canvas.height / canvasScale);
  }
}

function getGeneratedMapDimensions() {
  var rows = currentMap.length;
  var cols = 0;
  for (var row = 0; row < currentMap.length; row++) {
    cols = Math.max(cols, currentMap[row] ? currentMap[row].length : 0);
  }
  return { cols: cols, rows: rows };
}

function countGeneratedMapStats() {
  var platforms = 0;
  var holes = 0;
  var items = 0;
  for (var row = 0; row < currentMap.length; row++) {
    for (var col = 0; col < (currentMap[row] || []).length; col++) {
      if (currentMap[row][col] === "platform") {
        platforms++;
      } else if (currentMap[row][col] === "hole") {
        holes++;
      }
      if (currentItems[row] && currentItems[row][col]) {
        items++;
      }
    }
  }
  return { platforms: platforms, holes: holes, items: items };
}

function updatePreviewStats() {
  var statsRoot = document.getElementById("previewStats");
  if (!statsRoot) {
    return;
  }
  var dims = getGeneratedMapDimensions();
  var counts = countGeneratedMapStats();
  var modeLabel = generatorMode === "threequarter" ? "3/4 RPG" : generatorMode;
  statsRoot.innerHTML = ""
    + "<span class='preview-stat-pill'><strong>Mode</strong> " + modeLabel + "</span>"
    + "<span class='preview-stat-pill'><strong>Size</strong> " + dims.cols + " x " + dims.rows + "</span>"
    + "<span class='preview-stat-pill'><strong>Platforms</strong> " + counts.platforms + "</span>"
    + "<span class='preview-stat-pill'><strong>Items</strong> " + counts.items + "</span>"
    + "<span class='preview-stat-pill'><strong>Seed</strong> " + lastGenerationSeedLabel + "</span>";
}

function buildSetupPayload() {
  return {
    version: 1,
    generatorMode: generatorMode,
    generationSeed: generationSeed,
    backgrounds: buildBackgroundSetupPayload(),
    topdown: {
      tilesX: groundWidth,
      tilesY: groundHeight,
      startX: mapStartX,
      startY: mapStartY,
      canvasScale: canvasScale,
      exportQuality: exportQuality,
      placePlayers: placePlayers,
      mirrorPattern: mirrorPattern,
      mirrorRepeatX: mirrorRepeatX,
      mirrorRepeatY: mirrorRepeatY,
      mirrorCenterRowOnce: mirrorCenterRowOnce,
      mirrorCenterColOnce: mirrorCenterColOnce
    },
    sidescroller: {
      tilesX: sideTilesX,
      tilesY: sideTilesY,
      startX: sideStartX,
      startY: sideStartY,
      groundRow: sideGroundRow,
      terrainVariation: sideTerrainVariation,
      floatingPlatforms: sideFloatingPlatforms,
      platformMinWidth: sidePlatformMinWidth,
      platformMaxWidth: sidePlatformMaxWidth,
      exportQuality: exportQuality,
      fillGround: sideFillGround,
      placePlayers: sidePlacePlayers,
      requireEmptyAbove: sideRequireEmptyAbove,
      mirrorPattern: sideMirrorPattern,
      mirrorRepeatX: sideMirrorRepeatX,
      mirrorRepeatY: sideMirrorRepeatY,
      mirrorCenterRowOnce: sideMirrorCenterRowOnce,
      mirrorCenterColOnce: sideMirrorCenterColOnce
    },
    isometric: {
      tilesX: isoTilesX,
      tilesY: isoTilesY,
      startX: isoStartX,
      startY: isoStartY,
      tileWidth: isoTileWidth,
      tileHeight: isoTileHeight,
      blockHeight: isoBlockHeight,
      fillPercent: isoFillPercent,
      exportQuality: isoExportQuality,
      placePlayers: isoPlacePlayers,
      raisedEdges: isoRaisedEdges
    },
    threeQuarter: window.ThreeQuarterMapGenerator ? window.ThreeQuarterMapGenerator.buildSetupPayload() : null,
    sprites: {
      defaultWidth: defaultSpriteWidth,
      defaultHeight: defaultSpriteHeight,
      autoScale: autoScaleSprites,
      types: spriteTypes.map(function(type) {
        return {
          id: type.id,
          minPercent: type.minPercent,
          maxPercent: type.maxPercent,
          confidence: type.confidence,
          placement: type.placement || "anywhere",
          requiredSupportType: type.requiredSupportType || "",
          onTopOfType: type.onTopOfType || "",
          placeAboveSupport: type.placeAboveSupport !== false
        };
      })
    }
  };
}

function downloadTextFile(content, filename, type) {
  var blob = new Blob([content], { type: type || "text/plain" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(function() {
    URL.revokeObjectURL(url);
  }, 0);
}

function exportGeneratorSetup() {
  downloadTextFile(JSON.stringify(buildSetupPayload(), null, 2), "map-generator-setup.json", "application/json");
}

function exportGeneratedMapJson() {
  if (!window.MapGeneratorExport) {
    return;
  }
  var payload = window.MapGeneratorExport.buildPayload({
    generatorMode: generatorMode,
    lastGenerationSeedLabel: lastGenerationSeedLabel,
    currentMap: currentMap,
    currentItems: currentItems,
    spriteTypes: spriteTypes,
    setupPayload: buildSetupPayload()
  });
  downloadTextFile(JSON.stringify(payload, null, 2), buildMapExportName(".json"), "application/json");
}

function openGeneratorSetupImport() {
  var input = document.getElementById("importGeneratorSetupInput");
  if (input) {
    input.click();
  }
}

function applySetupPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  if (payload.sprites) {
    setInputValue("defaultSpriteWidth", payload.sprites.defaultWidth || defaultSpriteWidth);
    setInputValue("defaultSpriteHeight", payload.sprites.defaultHeight || defaultSpriteHeight);
    setCheckboxValue("autoScaleSprites", payload.sprites.autoScale !== false);
    if (Array.isArray(payload.sprites.types)) {
      payload.sprites.types.forEach(function(entry) {
        var type = getSpriteType(entry.id);
        if (!type) {
          return;
        }
        type.minPercent = Math.max(0, Number(entry.minPercent));
        type.maxPercent = Math.max(type.minPercent, Number(entry.maxPercent));
        type.confidence = Math.max(0, Math.min(1, Number(entry.confidence)));
        type.placement = entry.placement || type.placement || "anywhere";
        type.requiredSupportType = entry.requiredSupportType || "";
        type.onTopOfType = entry.onTopOfType || "";
        type.placeAboveSupport = entry.placeAboveSupport !== false;
      });
    }
  }
  if (payload.backgrounds) {
    ["topdown", "threequarter", "isometric", "sidescroller"].forEach(function(mode) {
      if (payload.backgrounds[mode]) {
        setModeBackgroundSource(mode, payload.backgrounds[mode], generateMapIfReady);
      }
    });
  }
  if (payload.topdown) {
    setInputValue("mapTilesX", valueOrFallback(payload.topdown.tilesX, groundWidth));
    setInputValue("mapTilesY", valueOrFallback(payload.topdown.tilesY, groundHeight));
    setInputValue("mapStartX", valueOrFallback(payload.topdown.startX, mapStartX));
    setInputValue("mapStartY", valueOrFallback(payload.topdown.startY, mapStartY));
    setInputValue("canvasScale", valueOrFallback(payload.topdown.canvasScale, canvasScale));
    setInputValue("exportQuality", valueOrFallback(payload.topdown.exportQuality, exportQuality));
    setCheckboxValue("placePlayers", payload.topdown.placePlayers !== false);
    setInputValue("mirrorPattern", valueOrFallback(payload.topdown.mirrorPattern, mirrorPattern));
    setInputValue("mirrorRepeatX", valueOrFallback(payload.topdown.mirrorRepeatX, 0));
    setInputValue("mirrorRepeatY", valueOrFallback(payload.topdown.mirrorRepeatY, 0));
    setCheckboxValue("mirrorCenterRowOnce", payload.topdown.mirrorCenterRowOnce !== false);
    setCheckboxValue("mirrorCenterColOnce", !!payload.topdown.mirrorCenterColOnce);
  }
  if (payload.sidescroller) {
    setInputValue("sideTilesX", valueOrFallback(payload.sidescroller.tilesX, sideTilesX));
    setInputValue("sideTilesY", valueOrFallback(payload.sidescroller.tilesY, sideTilesY));
    setInputValue("sideStartX", valueOrFallback(payload.sidescroller.startX, sideStartX));
    setInputValue("sideStartY", valueOrFallback(payload.sidescroller.startY, sideStartY));
    setInputValue("sideGroundRow", valueOrFallback(payload.sidescroller.groundRow, sideGroundRow));
    setInputValue("sideTerrainVariation", valueOrFallback(payload.sidescroller.terrainVariation, sideTerrainVariation));
    setInputValue("sideFloatingPlatforms", valueOrFallback(payload.sidescroller.floatingPlatforms, sideFloatingPlatforms));
    setInputValue("sidePlatformMinWidth", valueOrFallback(payload.sidescroller.platformMinWidth, sidePlatformMinWidth));
    setInputValue("sidePlatformMaxWidth", valueOrFallback(payload.sidescroller.platformMaxWidth, sidePlatformMaxWidth));
    setInputValue("sideExportQuality", valueOrFallback(payload.sidescroller.exportQuality, exportQuality));
    setCheckboxValue("sideFillGround", payload.sidescroller.fillGround !== false);
    setCheckboxValue("sidePlacePlayers", payload.sidescroller.placePlayers !== false);
    setCheckboxValue("sideRequireEmptyAbove", payload.sidescroller.requireEmptyAbove !== false);
    setInputValue("sideMirrorPattern", valueOrFallback(payload.sidescroller.mirrorPattern, sideMirrorPattern));
    setInputValue("sideMirrorRepeatX", valueOrFallback(payload.sidescroller.mirrorRepeatX, 0));
    setInputValue("sideMirrorRepeatY", valueOrFallback(payload.sidescroller.mirrorRepeatY, 0));
    setCheckboxValue("sideMirrorCenterRowOnce", !!payload.sidescroller.mirrorCenterRowOnce);
    setCheckboxValue("sideMirrorCenterColOnce", !!payload.sidescroller.mirrorCenterColOnce);
  }
  if (payload.isometric) {
    setInputValue("isoTilesX", valueOrFallback(payload.isometric.tilesX, isoTilesX));
    setInputValue("isoTilesY", valueOrFallback(payload.isometric.tilesY, isoTilesY));
    setInputValue("isoStartX", valueOrFallback(payload.isometric.startX, isoStartX));
    setInputValue("isoStartY", valueOrFallback(payload.isometric.startY, isoStartY));
    setInputValue("isoTileWidth", valueOrFallback(payload.isometric.tileWidth, isoTileWidth));
    setInputValue("isoTileHeight", valueOrFallback(payload.isometric.tileHeight, isoTileHeight));
    setInputValue("isoBlockHeight", valueOrFallback(payload.isometric.blockHeight, isoBlockHeight));
    setInputValue("isoFillPercent", valueOrFallback(payload.isometric.fillPercent, isoFillPercent));
    setInputValue("isoExportQuality", valueOrFallback(payload.isometric.exportQuality, isoExportQuality));
    setCheckboxValue("isoPlacePlayers", payload.isometric.placePlayers !== false);
    setCheckboxValue("isoRaisedEdges", payload.isometric.raisedEdges !== false);
  }
  if (payload.threeQuarter && window.ThreeQuarterMapGenerator) {
    window.ThreeQuarterMapGenerator.applySetupPayload(payload.threeQuarter);
  }
  setInputValue("generationSeed", payload.generationSeed || "");
  renderSpriteSettings();
  setDefaultSpriteSize();
  setAutoScaleSprites();
  setGenerationSeed();
  setMirrorOptions();
  setGeneratorOptions();
  setSidescrollerOptions();
  setIsometricOptions();
  setGeneratorMode(payload.generatorMode || generatorMode);
}

function importGeneratorSetupFromFile(event) {
  var file = event && event.target && event.target.files ? event.target.files[0] : null;
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(loadEvent) {
    try {
      var payload = JSON.parse(loadEvent.target.result);
      applySetupPayload(payload);
    } catch (error) {
      console.error(error);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}
