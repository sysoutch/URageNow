function downloadDataUrl(dataUrl, filename) {
      var link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      link.click();
    }

    function buildMapExportName(extension) {
      var mode = generatorMode || "map";
      var seedLabel = (generationSeed || "random").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "random";
      return "map-" + mode + "-" + seedLabel + extension;
    }

    function drawTileAt(img, col, row, startX, startY, stepX, stepY) {
      drawSprite(img, startX + col * stepX, startY + row * stepY);
    }

    function getBottomOriginY(row, totalRows, startY, stepY) {
      return startY + (totalRows - 1 - row) * stepY;
    }

    function getBottomAlignedStartY(totalRows, bottomPadding, stepY) {
      var logicalHeight = canvas.height / canvasScale;
      var topY = logicalHeight - Math.max(0, bottomPadding) - totalRows * stepY;
      return Math.max(0, topY);
    }

    function getSideRenderStartX() {
      return Math.max(canvasPadding, sideStartX);
    }

    function drawBottomOriginTileAt(img, col, row, totalRows, startX, startY, stepX, stepY) {
      drawSprite(img, startX + col * stepX, getBottomOriginY(row, totalRows, startY, stepY));
    }

    function drawBottomOriginSurfaceSprite(img, col, row, totalRows, startX, startY, stepX, stepY) {
      var supportRow = row > 0 && currentMap[row - 1] && currentMap[row - 1][col] === "platform" ? row - 1 : row;
      var supportY = getBottomOriginY(supportRow, totalRows, startY, stepY);
      drawAnchoredTileSprite(img, startX + col * stepX, supportY - stepY, stepX, stepY);
    }

    function isPlatformCell(col, row) {
      return currentMap[row] && currentMap[row][col] === "platform";
    }

    function setTileData(col, row, mapValue, itemValue) {
      if (!currentMap[row]) {
        currentMap[row] = [];
      }
      if (!currentItems[row]) {
        currentItems[row] = [];
      }
      currentMap[row][col] = mapValue;
      currentItems[row][col] = itemValue || "";
    }

    function mirrorPatternUsesX(pattern) {
      return pattern === "x" || pattern === "xy" || pattern === "all";
    }

    function mirrorPatternUsesY(pattern) {
      return pattern === "y" || pattern === "xy" || pattern === "all";
    }

    function mirrorPatternUsesMainDiagonal(pattern) {
      return pattern === "diagonal-main" || pattern === "diagonal-both" || pattern === "all";
    }

    function mirrorPatternUsesAntiDiagonal(pattern) {
      return pattern === "diagonal-anti" || pattern === "diagonal-both" || pattern === "all";
    }

    function getMirrorGridSizeFor(cols, rows, pattern, repeatX, repeatY, centerRowOnce, centerColOnce) {
      var outCols = mirrorPatternUsesX(pattern) ? getAxisSpan(cols, repeatX, centerColOnce) : cols;
      var outRows = mirrorPatternUsesY(pattern) ? getAxisSpan(rows, repeatY, centerRowOnce) : rows;
      if (mirrorPatternUsesMainDiagonal(pattern) || mirrorPatternUsesAntiDiagonal(pattern)) {
        var square = Math.max(outCols, outRows);
        outCols = square;
        outRows = square;
      }
      return { cols: outCols, rows: outRows };
    }

    function getMirrorCellsFor(colIndex, rowIndex, cols, rows, pattern, repeatX, repeatY, centerRowOnce, centerColOnce) {
      var xValues = makeAxisIndexes(colIndex, cols, repeatX, mirrorPatternUsesX(pattern), centerColOnce);
      var yValues = makeAxisIndexes(rowIndex, rows, repeatY, mirrorPatternUsesY(pattern), centerRowOnce);
      var cells = [];
      var size = getMirrorGridSizeFor(cols, rows, pattern, repeatX, repeatY, centerRowOnce, centerColOnce);
      var square = Math.max(size.cols, size.rows);
      for (var y = 0; y < yValues.length; y++) {
        for (var x = 0; x < xValues.length; x++) {
          var col = xValues[x];
          var row = yValues[y];
          pushUniqueCell(cells, col, row);
          if (mirrorPatternUsesMainDiagonal(pattern)) {
            pushUniqueCell(cells, row, col);
          }
          if (mirrorPatternUsesAntiDiagonal(pattern)) {
            pushUniqueCell(cells, square - 1 - row, square - 1 - col);
          }
          if (pattern === "diagonal-both" || pattern === "all") {
            pushUniqueCell(cells, square - 1 - col, square - 1 - row);
          }
        }
      }
      return cells;
    }

    function updateSideMirrorShapePreview() {
      var preview = document.getElementById("sideMirrorShapePreview");
      if (!preview) {
        return;
      }
      var size = getMirrorGridSizeFor(sideTilesX, sideTilesY, sideMirrorPattern, sideMirrorRepeatX, sideMirrorRepeatY, sideMirrorCenterRowOnce, sideMirrorCenterColOnce);
      preview.value = size.cols + " x " + size.rows;
    }

    function generateSidescrollerMap() {
      var platformType = getSpriteType("platform");
      var holeType = getSpriteType("hole");
      var platformImg = getSpriteImage(platformType);
      var holeImg = getSpriteImage(holeType);
      var stepX = getDrawWidth(platformImg);
      var stepY = getDrawHeight(platformImg);
      var currentCounts = {};
      var minCounts = {};
      var maxCounts = {};
      var totalSlots = sideTilesX * sideTilesY;
      var platformSlots = 0;
      var playersPlaced = 0;
      var baseMap = [];
      var baseItems = [];
      setCurrentPlayers([]);

      spriteTypes.forEach(function(type) {
        currentCounts[type.id] = 0;
        minCounts[type.id] = 0;
        maxCounts[type.id] = 0;
      });

      function setBaseTile(col, row, mapValue, itemValue) {
        if (!baseMap[row]) {
          baseMap[row] = [];
        }
        if (!baseItems[row]) {
          baseItems[row] = [];
        }
        baseMap[row][col] = mapValue;
        baseItems[row][col] = itemValue || "";
      }

      function isBasePlatform(col, row) {
        return baseMap[row] && baseMap[row][col] === "platform";
      }

      function isBaseEmpty(col, row) {
        return row >= 0 && row < sideTilesY && baseMap[row] && baseMap[row][col] !== "platform" && !baseItems[row][col];
      }

      var surface = Math.min(sideTilesY - 1, Math.max(0, sideGroundRow));
      for (var col = 0; col < sideTilesX; col++) {
        var delta = Math.floor(randomValue() * 3) - 1;
        surface += delta;
        surface = Math.min(sideTilesY - 1, Math.max(0, surface));
        if (sideTerrainVariation > 0) {
          surface = Math.min(sideTilesY - 1, Math.max(0, Math.min(sideGroundRow + sideTerrainVariation, Math.max(sideGroundRow - sideTerrainVariation, surface))));
        }

        for (var row = 0; row < sideTilesY; row++) {
          var isGround = sideFillGround ? row <= surface : row === surface;
          if (isGround) {
            setBaseTile(col, row, "platform", "");
            platformSlots++;
          } else {
            setBaseTile(col, row, "hole", "");
          }
        }
      }

      for (var p = 0; p < sideFloatingPlatforms; p++) {
        var width = Math.floor(sidePlatformMinWidth + randomValue() * (sidePlatformMaxWidth - sidePlatformMinWidth + 1));
        var startCol = Math.max(0, Math.floor(randomValue() * Math.max(1, sideTilesX - width)));
        var minPlatformRow = Math.min(sideTilesY - 1, sideGroundRow + 1);
        var platformRow = minPlatformRow + Math.floor(randomValue() * Math.max(1, sideTilesY - minPlatformRow));
        for (var span = 0; span < width && startCol + span < sideTilesX; span++) {
          if (!isBasePlatform(startCol + span, platformRow)) {
            platformSlots++;
          }
          setBaseTile(startCol + span, platformRow, "platform", "");
        }
      }

      spriteTypes.forEach(function(type) {
        var base = type.role === "platform" ? totalSlots : Math.max(1, platformSlots);
        minCounts[type.id] = base / 100 * type.minPercent;
        maxCounts[type.id] = base / 100 * type.maxPercent;
      });

      for (var supportRow = 0; supportRow < sideTilesY; supportRow++) {
        for (var supportCol = 0; supportCol < sideTilesX; supportCol++) {
          if (!isBasePlatform(supportCol, supportRow)) {
            continue;
          }

          currentCounts.platform++;
          var drawRow = supportRow + 1;
          var canPlaceAbove = drawRow < sideTilesY && isBaseEmpty(supportCol, drawRow);

          if (sidePlacePlayers && playersPlaced < sidePlayerCount && canPlaceAbove && window.MapGeneratorCatalog && window.MapGeneratorCatalog.getPlayerMarkerItemId()) {
            baseItems[drawRow][supportCol] = window.MapGeneratorCatalog.getPlayerMarkerItemId();
            playersPlaced++;
            continue;
          }

          if (sideRequireEmptyAbove && !canPlaceAbove) {
            continue;
          }

          var loopsLeft = Math.max(0, totalSlots - (supportRow * sideTilesX + supportCol) - 1);
          var itemPlacement = pickConfiguredSpriteForCell({ map: baseMap, items: baseItems, col: supportCol, supportRow: supportRow, canPlaceAbove: canPlaceAbove, requiresVisibleSupport: sideRequireEmptyAbove, aboveRowOffset: 1 }, currentCounts, maxCounts, minCounts, loopsLeft);
          var itemType = itemPlacement && itemPlacement.type || null;
          if (itemType) {
            currentCounts[itemType.id]++;
            baseItems[itemPlacement.targetRow][itemPlacement.targetCol] = itemType.id;
          }
        }
      }

      var outputSize = getMirrorGridSizeFor(sideTilesX, sideTilesY, sideMirrorPattern, sideMirrorRepeatX, sideMirrorRepeatY, sideMirrorCenterRowOnce, sideMirrorCenterColOnce);
      currentMap = [];
      currentItems = [];

      for (var baseRow = 0; baseRow < sideTilesY; baseRow++) {
        for (var baseCol = 0; baseCol < sideTilesX; baseCol++) {
          var cells = getMirrorCellsFor(baseCol, baseRow, sideTilesX, sideTilesY, sideMirrorPattern, sideMirrorRepeatX, sideMirrorRepeatY, sideMirrorCenterRowOnce, sideMirrorCenterColOnce);
          for (var c = 0; c < cells.length; c++) {
            var outCol = cells[c].col;
            var outRow = cells[c].row;
            if (outCol < 0 || outRow < 0 || outCol >= outputSize.cols || outRow >= outputSize.rows) {
              continue;
            }
            if (!currentMap[outRow]) {
              currentMap[outRow] = [];
            }
            if (!currentItems[outRow]) {
              currentItems[outRow] = [];
            }
            currentMap[outRow][outCol] = baseMap[baseRow][baseCol];
            currentItems[outRow][outCol] = baseItems[baseRow][baseCol] || "";
          }
        }
      }
      if (typeof rebuildCurrentPlayersFromItems === "function") {
        rebuildCurrentPlayersFromItems(sidePlayerCount);
      }

      var sideDrawStartX = getSideRenderStartX();
      resizeCanvasForMap(outputSize.cols, outputSize.rows, sideDrawStartX, sideStartY, stepX, stepY, sideEndX, sideEndY);
      var sideTopY = getBottomAlignedStartY(outputSize.rows, sideStartY, stepY);
      clearAndDrawBackground();

      var drawCells = getOrderedCells(outputSize.cols, outputSize.rows, sideDirection);
      for (var cellIndex = 0; cellIndex < drawCells.length; cellIndex++) {
        var x = drawCells[cellIndex].col;
        var y = drawCells[cellIndex].row;
        {
          if (currentMap[y] && currentMap[y][x] === "platform") {
            drawBottomOriginTileAt(platformImg, x, y, outputSize.rows, sideDrawStartX, sideTopY, stepX, stepY);
          } else if (holeImg && holeImg.src) {
            drawBottomOriginTileAt(holeImg, x, y, outputSize.rows, sideDrawStartX, sideTopY, stepX, stepY);
          }
        }
      }

      for (var itemY = 0; itemY < outputSize.rows; itemY++) {
        for (var itemX = 0; itemX < outputSize.cols; itemX++) {
          var itemId = currentItems[itemY] && currentItems[itemY][itemX];
          if (!itemId) {
            continue;
          }
          if (window.MapGeneratorCatalog && window.MapGeneratorCatalog.isPlayerMarkerItemId(itemId)) {
            continue;
          }
          var itemType = getSpriteType(itemId);
          if (itemType) {
            drawBottomOriginSurfaceSprite(getSpriteImage(itemType), itemX, itemY, outputSize.rows, sideDrawStartX, sideTopY, stepX, stepY);
          }
        }
      }
      for (var playerIndex = 0; playerIndex < currentPlayers.length; playerIndex++) {
        var player = currentPlayers[playerIndex];
        drawBottomOriginSurfaceSprite(window.MapGeneratorCatalog.getPlayerMarkerSpriteForIndex(player.variantIndex), player.col, player.row, outputSize.rows, sideDrawStartX, sideTopY, stepX, stepY);
      }

      updatePreviewStats();
    }

    function makeImageOfCanvas() {
      var imageUrl = canvas.toDataURL();
      document.getElementById("source_img").src = imageUrl;
      var sourceImg = document.getElementById("source_img");
      var targetImg = document.getElementById("target_img");
      var quality = exportQuality;
      var outputFormat = "jpg";
      var downloadUrl = imageUrl;
      var extension = ".png";

      if (typeof jic !== "undefined") {
        targetImg.src = jic.compress(sourceImg, quality, outputFormat).src;
        downloadUrl = targetImg.src;
        extension = ".jpg";
      }

      downloadDataUrl(downloadUrl, buildMapExportName(extension));
    }
