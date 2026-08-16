function setAutoGenerateMapInterval() {
      autoGenerateMapIntervalInSeconds = parseFloat(document.getElementById("autoGenerateMapIntervalId").value) || 1;
    }

    function stopAutoGenerate() {
      document.getElementById("stopAutoGenerate").style.display = "none";
      document.getElementById("generateMap").style.display = "inline-flex";
      autoGenerateMap = false;
    }

    function startAutoGenerateMap() {
      autoGenerateMap = true;
      document.getElementById("stopAutoGenerate").style.display = "inline-flex";
      document.getElementById("generateMap").style.display = "none";
      runAutoGenerateLoop();
    }

    function runAutoGenerateLoop() {
      if (!autoGenerateMap) {
        return;
      }

      generateMap();
      setTimeout(runAutoGenerateLoop, autoGenerateMapIntervalInSeconds * 1000);
    }

    function drawSprite(img, x, z) {
      if (!img || !img.complete && !img.src) {
        return;
      }
      ctx.drawImage(img, x, z, getDrawWidth(img), getDrawHeight(img));
    }

    function drawMirroredSprite(img, x, z, i, k, stepX, stepY) {
      var cells = getMirrorCells(i, k);
      for (var c = 0; c < cells.length; c++) {
        drawSprite(img, mapStartX + cells[c].col * stepX, mapStartY + cells[c].row * stepY);
      }
    }

    function registerMirroredPlayers(i, k, maxPlayers) {
      if (!window.MapGeneratorCatalog) {
        return;
      }
      var cells = getMirrorCells(i, k);
      for (var c = 0; c < cells.length; c++) {
        if (currentPlayers.length >= maxPlayers) {
          break;
        }
        if (!currentItems[cells[c].row]) {
          currentItems[cells[c].row] = [];
        }
        currentItems[cells[c].row][cells[c].col] = window.MapGeneratorCatalog.getPlayerMarkerItemId();
        currentPlayers.push(window.MapGeneratorCatalog.createPlayerPlacement(cells[c].col, cells[c].row, currentPlayers.length));
      }
    }

    function getPlayerMarkerSpriteForCell(col, row) {
      return window.MapGeneratorCatalog ? window.MapGeneratorCatalog.getPlayerMarkerSpriteForCell(col, row) : null;
    }

    function drawAnchoredTileSprite(img, x, y, stepX, stepY) {
      if (!img || !img.complete && !img.src) {
        return;
      }
      var width = getDrawWidth(img);
      var height = getDrawHeight(img);
      drawSprite(img, x + (stepX - width) / 2, y + stepY - height);
    }

    function drawTopdownMapFromData(cols, rows, platformImg, holeImg, stepX, stepY) {
      clearAndDrawBackground();
      var drawCells = getOrderedCells(cols, rows, mapDirection);
      for (var cellIndex = 0; cellIndex < drawCells.length; cellIndex++) {
        var col = drawCells[cellIndex].col;
        var row = drawCells[cellIndex].row;
        {
          var x = mapStartX + col * stepX;
          var y = mapStartY + row * stepY;
          if (currentMap[row] && currentMap[row][col] === "platform") {
            drawSprite(platformImg, x, y);
          } else if (holeImg && holeImg.src) {
            drawSprite(holeImg, x, y);
          }
        }
      }
      for (var itemRow = 0; itemRow < rows; itemRow++) {
        for (var itemCol = 0; itemCol < cols; itemCol++) {
          var itemId = currentItems[itemRow] && currentItems[itemRow][itemCol];
          if (!itemId) {
            continue;
          }
          if (window.MapGeneratorCatalog && window.MapGeneratorCatalog.isPlayerMarkerItemId(itemId)) {
            continue;
          }
          var itemImg = window.MapGeneratorCatalog && window.MapGeneratorCatalog.isPlayerMarkerItemId(itemId) ? getPlayerMarkerSpriteForCell(itemCol, itemRow) : getSpriteImage(getSpriteType(itemId));
          drawAnchoredTileSprite(itemImg, mapStartX + itemCol * stepX, mapStartY + itemRow * stepY, stepX, stepY);
        }
      }
      for (var playerIndex = 0; playerIndex < currentPlayers.length; playerIndex++) {
        var player = currentPlayers[playerIndex];
        var playerImg = window.MapGeneratorCatalog ? window.MapGeneratorCatalog.getPlayerMarkerSpriteForIndex(player.variantIndex) : null;
        drawAnchoredTileSprite(playerImg, mapStartX + player.col * stepX, mapStartY + player.row * stepY, stepX, stepY);
      }
    }

    function shouldPlace(current, min, max, confidence, loopsLeft) {
      if (current >= max) {
        return false;
      }

      var place = randomValue() >= confidence;
      if (!place && current + loopsLeft < min && current < max) {
        place = true;
      }

      return place;
    }

    function pickItemSprite(currentCounts, maxCounts, minCounts, loopsLeft) {
      var itemTypes = spriteTypes.filter(function(type) {
        return type.role === "item";
      });

      for (var s = 0; s < itemTypes.length; s++) {
        var type = itemTypes[s];
        if (shouldPlace(currentCounts[type.id] || 0, minCounts[type.id] || 0, maxCounts[type.id] || 0, type.confidence, loopsLeft)) {
          return type;
        }
      }

      return null;
    }

    function pickConfiguredSpriteForCell(context, currentCounts, maxCounts, minCounts, loopsLeft) {
      if (!window.MapSpritePlacement) {
        return null;
      }
      return window.MapSpritePlacement.pickSpriteForCell({
        spriteTypes: spriteTypes,
        map: context.map,
        items: context.items,
        col: context.col,
        supportRow: context.supportRow,
        canPlaceAbove: context.canPlaceAbove,
        requiresVisibleSupport: context.requiresVisibleSupport,
        supportTileKindOverride: context.supportTileKindOverride,
        targetTileKindOverride: context.targetTileKindOverride,
        aboveRowOffset: context.aboveRowOffset,
        shouldPlace: function(type) {
          return shouldPlace(currentCounts[type.id] || 0, minCounts[type.id] || 0, maxCounts[type.id] || 0, type.confidence, loopsLeft);
        }
      });
    }
    window.pickConfiguredSpriteForCell = pickConfiguredSpriteForCell;

    function generateMap() {
      beginGenerationRandom();
      if (generatorMode === "sidescroller") {
        generateSidescrollerMap();
        updatePreviewStats();
        return;
      }
      if (generatorMode === "isometric") {
        generateIsometricMap();
        updatePreviewStats();
        return;
      }

      var platformType = getSpriteType("platform");
      var platformImg = getSpriteImage(platformType);
      var stepX = getDrawWidth(platformImg);
      var stepY = getDrawHeight(platformImg);
      var startX = mapStartX;
      var x = startX;
      var z = mapStartY;
      var totalSlots = groundWidth * groundHeight;
      var onePercent = totalSlots / 100;
      var currentPlatforms = 0;
      var currentHoles = 0;
      var currentCounts = {};
      var minCounts = {};
      var maxCounts = {};
      var playersPlaced = 0;

      spriteTypes.forEach(function(type) {
        var base = type.role === "platform" ? totalSlots : totalSlots * platformType.maxPercent / 100;
        minCounts[type.id] = base / 100 * type.minPercent;
        maxCounts[type.id] = base / 100 * type.maxPercent;
        currentCounts[type.id] = 0;
      });

      currentMap = [];
      currentItems = [];
      setCurrentPlayers([]);
      updateMirrorShapePreview();
      var topdownSize = getMirrorGridSizeFor(groundWidth, groundHeight, mirrorPattern, mirrorRepeatX, mirrorRepeatY, mirrorCenterRowOnce, mirrorCenterColOnce);
      resizeCanvasForMap(topdownSize.cols, topdownSize.rows, mapStartX, mapStartY, stepX, stepY, mapEndX, mapEndY);
      clearAndDrawBackground();

      for (var k = 0; k < groundHeight; k++) {
        var loopsLeftK = groundHeight - 1 - k;
        var tmpMap = [];
        var tmpItems = [];

        for (var i = 0; i < groundWidth; i++) {
          var loopsLeftI = groundWidth - 1 - i;
          var loopsLeft = loopsLeftI + groundWidth * loopsLeftK;
          var placePlatform = shouldPlace(currentPlatforms, minCounts.platform, maxCounts.platform, platformType.confidence, loopsLeft);

          if (placePlatform) {
            currentPlatforms++;
            currentCounts.platform++;
            drawMirroredSprite(platformImg, x, z, i, k, stepX, stepY);

            if (placePlayers && playersPlaced < topdownPlayerCount && window.MapGeneratorCatalog && window.MapGeneratorCatalog.getPlayerMarkerItemId()) {
              setMirroredTileData(i, k, "platform", "");
              registerMirroredPlayers(i, k, topdownPlayerCount);
              playersPlaced = currentPlayers.length;
            } else {
              var itemPlacement = pickConfiguredSpriteForCell({ map: currentMap, items: currentItems, col: i, supportRow: k, canPlaceAbove: false, requiresVisibleSupport: false, supportTileKindOverride: "platform", targetTileKindOverride: "platform" }, currentCounts, maxCounts, minCounts, loopsLeft);
              var itemType = itemPlacement ? itemPlacement.type : (!window.MapSpritePlacement ? pickItemSprite(currentCounts, maxCounts, minCounts, loopsLeft) : null);
              if (itemType) {
                currentCounts[itemType.id]++;
                setMirroredTileData(i, k, "platform", itemType.id);
                drawMirroredSprite(getSpriteImage(itemType), x, z, i, k, stepX, stepY);
              } else {
                setMirroredTileData(i, k, "platform", "");
              }
            }
          } else {
            var holeType = getSpriteType("hole");
            if (holeType && getSpriteImage(holeType).src) {
              drawMirroredSprite(getSpriteImage(holeType), x, z, i, k, stepX, stepY);
            }
            var holePlacement = pickConfiguredSpriteForCell({ map: currentMap, items: currentItems, col: i, supportRow: k, canPlaceAbove: false, requiresVisibleSupport: false, supportTileKindOverride: "hole", targetTileKindOverride: "hole" }, currentCounts, maxCounts, minCounts, loopsLeft);
            var holeItemType = holePlacement && holePlacement.type || null;
            if (holeItemType) {
              currentCounts[holeItemType.id]++;
              setMirroredTileData(i, k, "hole", holeItemType.id);
              drawMirroredSprite(getSpriteImage(holeItemType), x, z, i, k, stepX, stepY);
            } else {
              setMirroredTileData(i, k, "hole", "");
            }
            currentHoles++;
          }

          x += stepX;
        }

        x = startX;
        z += stepY;
      }

      var renderStyle = document.getElementById("topdownRenderStyle");
      if (renderStyle && renderStyle.value === "threequarter" && window.ThreeQuarterMapGenerator && typeof window.ThreeQuarterMapGenerator.renderExisting === "function") {
        window.ThreeQuarterMapGenerator.renderExisting();
      } else {
        drawTopdownMapFromData(topdownSize.cols, topdownSize.rows, platformImg, getSpriteImage(getSpriteType("hole")), stepX, stepY);
      }
      updatePreviewStats();
    }
