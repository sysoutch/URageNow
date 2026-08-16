function getCssColor(name, fallback) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function normalizeHexColor(hex, fallback) {
      hex = (hex || fallback || "#ffffff").trim();
      if (hex.charAt(0) !== "#") {
        return fallback || "#ffffff";
      }
      if (hex.length === 4) {
        return "#" + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3);
      }
      return hex.length === 7 ? hex : fallback || "#ffffff";
    }

    function shadeHex(hex, amount) {
      hex = normalizeHexColor(hex, "#ffffff").slice(1);
      var out = "#";
      for (var i = 0; i < 3; i++) {
        var value = parseInt(hex.substr(i * 2, 2), 16);
        value = Math.max(0, Math.min(255, value + amount));
        out += ("0" + value.toString(16)).slice(-2);
      }
      return out;
    }

    function getIsoVisibleBaseWidth() {
      var wrap = document.getElementById("canvasScrollWrap");
      return Math.max(canvasBaseWidth, wrap ? wrap.clientWidth : canvasBaseWidth);
    }

    function getIsoVisibleBaseHeight() {
      var wrap = document.getElementById("canvasScrollWrap");
      return Math.max(canvasBaseHeight, wrap ? wrap.clientHeight : canvasBaseHeight);
    }

    function getIsoFloorBounds(size) {
      size = size || getIsoOutputSize();
      var halfW = isoTileWidth / 2;
      var minX = -size.rows * halfW;
      var maxX = size.cols * halfW;
      return { minX: minX, maxX: maxX, width: maxX - minX };
    }

    function getIsoRenderStartX(size) {
      size = size || getIsoOutputSize();
      var bounds = getIsoFloorBounds(size);
      if (isoStartX === 0) {
        var viewWidth = Math.max(bounds.width + isoEndX * 2, getIsoVisibleBaseWidth());
        return (viewWidth - bounds.width) / 2 - bounds.minX;
      }
      return isoStartX - bounds.minX;
    }

    function getIsoRenderStartY(size, floorHeight) {
      if (isoStartY === 0) {
        var viewHeight = Math.max(floorHeight + isoEndY * 2, getIsoVisibleBaseHeight());
        return Math.max(0, (viewHeight - floorHeight) / 2);
      }
      return isoStartY;
    }

    function getIsoPoint(col, row, height) {
      var originX = typeof isoRenderStartX === "number" ? isoRenderStartX : getIsoRenderStartX();
      var originY = typeof isoRenderStartY === "number" ? isoRenderStartY : isoStartY;
      return {
        x: originX + (col - row) * isoTileWidth / 2,
        y: originY + (col + row) * isoTileHeight / 2 - height
      };
    }

    function drawIsoPolygon(points, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (var i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    function drawIsoSurfaceTexture(img, diamond) {
      if (!img || !img.complete && !img.src) {
        return;
      }
      var sourceWidth = img.naturalWidth || img.width || 1;
      var sourceHeight = img.naturalHeight || img.height || 1;
      var left = diamond[3];
      var top = diamond[0];
      var bottom = diamond[2];

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(diamond[0].x, diamond[0].y);
      ctx.lineTo(diamond[1].x, diamond[1].y);
      ctx.lineTo(diamond[2].x, diamond[2].y);
      ctx.lineTo(diamond[3].x, diamond[3].y);
      ctx.closePath();
      ctx.clip();
      ctx.transform(
        (top.x - left.x) / sourceWidth,
        (top.y - left.y) / sourceWidth,
        (bottom.x - left.x) / sourceHeight,
        (bottom.y - left.y) / sourceHeight,
        left.x,
        left.y
      );
      ctx.drawImage(img, 0, 0, sourceWidth, sourceHeight);
      ctx.restore();
    }


    function getSpriteAverageColor(img, fallback) {
      if (!img) {
        return fallback || "#8fd36a";
      }
      if (img.dataset && img.dataset.isoAverageColor) {
        return img.dataset.isoAverageColor;
      }
      try {
        var sampleCanvas = document.createElement("canvas");
        var size = 16;
        sampleCanvas.width = size;
        sampleCanvas.height = size;
        var sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
        sampleCtx.drawImage(img, 0, 0, size, size);
        var data = sampleCtx.getImageData(0, 0, size, size).data;
        var r = 0;
        var g = 0;
        var b = 0;
        var count = 0;
        for (var i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 24) {
            continue;
          }
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (!count) {
          return fallback || "#8fd36a";
        }
        var color = "#" + [r / count, g / count, b / count].map(function(value) {
          return ("0" + Math.round(value).toString(16)).slice(-2);
        }).join("");
        if (img.dataset) {
          img.dataset.isoAverageColor = color;
        }
        return color;
      } catch (error) {
        return fallback || "#8fd36a";
      }
    }



    function getSpriteIsoColor(type, img, fallback) {
      if (type && type.isoUseCustomColor && type.isoColor) {
        return normalizeHexColor(type.isoColor, fallback || "#8fd36a");
      }
      return normalizeHexColor(getSpriteAverageColor(img, fallback || "#8fd36a"), fallback || "#8fd36a");
    }

    function drawIsoSurface(type, img, diamond, fallback) {
      if (type && type.isoSolidSurface) {
        var base = getSpriteIsoColor(type, img, fallback || "#8fd36a");
        drawIsoPolygon(diamond, shadeHex(base, 18), shadeHex(base, -54));
        drawIsoSurfaceTexture(img, diamond);
        return;
      }
      drawIsoSurfaceTexture(img, diamond);
    }

    function scaleIsoDiamond(diamond, scale) {
      scale = Math.max(0.05, Number(scale) || 1);
      if (scale === 1) {
        return diamond;
      }
      var center = {
        x: (diamond[0].x + diamond[1].x + diamond[2].x + diamond[3].x) / 4,
        y: (diamond[0].y + diamond[1].y + diamond[2].y + diamond[3].y) / 4
      };
      return diamond.map(function(point) {
        return {
          x: center.x + (point.x - center.x) * scale,
          y: center.y + (point.y - center.y) * scale
        };
      });
    }

    function drawIsoRaisedSpriteBlock(col, row, baseHeight, extraHeight, type, img) {
      if (extraHeight <= 0) {
        return;
      }
      var top = getIsoPoint(col, row, baseHeight + extraHeight);
      var halfW = isoTileWidth / 2;
      var halfH = isoTileHeight / 2;
      var base = getSpriteIsoColor(type, img, getCssColor("--accent", "#8fd36a"));
      var topColor = shadeHex(base, 18);
      var leftColor = shadeHex(base, -42);
      var rightColor = shadeHex(base, -24);
      var stroke = shadeHex(base, -66);
      var diamond = [
        { x: top.x, y: top.y },
        { x: top.x + halfW, y: top.y + halfH },
        { x: top.x, y: top.y + isoTileHeight },
        { x: top.x - halfW, y: top.y + halfH }
      ];

      drawIsoPolygon([
        diamond[3],
        diamond[2],
        { x: diamond[2].x, y: diamond[2].y + extraHeight },
        { x: diamond[3].x, y: diamond[3].y + extraHeight }
      ], leftColor, stroke);
      drawIsoPolygon([
        diamond[1],
        diamond[2],
        { x: diamond[2].x, y: diamond[2].y + extraHeight },
        { x: diamond[1].x, y: diamond[1].y + extraHeight }
      ], rightColor, stroke);
      drawIsoPolygon(diamond, topColor, stroke);
    }

    function drawIsoBlock(col, row, height, kind) {
      var top = getIsoPoint(col, row, height);
      var halfW = isoTileWidth / 2;
      var halfH = isoTileHeight / 2;
      var surfaceType = getSpriteType(kind === "hole" ? "hole" : "platform");
      var surfaceImg = getSpriteImage(surfaceType);
      var base = getSpriteIsoColor(surfaceType, surfaceImg, kind === "hole" ? getCssColor("--panel-strong", "#11160f") : getCssColor("--accent", "#8fd36a"));
      var topColor = kind === "hole" ? shadeHex(base, -18) : shadeHex(base, 22);
      var leftColor = shadeHex(base, -38);
      var rightColor = shadeHex(base, -18);
      var stroke = shadeHex(base, -62);
      var diamond = [
        { x: top.x, y: top.y },
        { x: top.x + halfW, y: top.y + halfH },
        { x: top.x, y: top.y + isoTileHeight },
        { x: top.x - halfW, y: top.y + halfH }
      ];

      if (height > 0) {
        drawIsoPolygon([
          diamond[3],
          diamond[2],
          { x: diamond[2].x, y: diamond[2].y + height },
          { x: diamond[3].x, y: diamond[3].y + height }
        ], leftColor, stroke);
        drawIsoPolygon([
          diamond[1],
          diamond[2],
          { x: diamond[2].x, y: diamond[2].y + height },
          { x: diamond[1].x, y: diamond[1].y + height }
        ], rightColor, stroke);
      }

      drawIsoPolygon(diamond, topColor, stroke);
      if (!surfaceType || surfaceType.isoBehavior !== "hidden") {
        drawIsoSurface(surfaceType, surfaceImg, diamond, base);
      }
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(diamond[0].x, diamond[0].y + 4);
      ctx.lineTo(diamond[1].x - 8, diamond[1].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawIsoSprite(img, col, row, height, maxWidth, maxHeight, type) {
      if (!img || !img.complete && !img.src) {
        return;
      }
      var behavior = type && type.isoBehavior || "billboard";
      if (behavior === "hidden") {
        return;
      }
      var point = getIsoPoint(col, row, height);
      if (behavior === "surface") {
        var halfW = isoTileWidth / 2;
        var diamond = [
          { x: point.x, y: point.y },
          { x: point.x + halfW, y: point.y + isoTileHeight / 2 },
          { x: point.x, y: point.y + isoTileHeight },
          { x: point.x - halfW, y: point.y + isoTileHeight / 2 }
        ];
        drawIsoSurface(type, img, scaleIsoDiamond(diamond, type && type.isoSurfaceScale), getCssColor("--accent", "#8fd36a"));
        return;
      }
      var width = Math.min(getDrawWidth(img), maxWidth) * (type && type.isoWidthScale || 1);
      var heightPx = Math.min(getDrawHeight(img), maxHeight) * (type && type.isoHeightScale || 1);
      if (behavior === "flat") {
        ctx.drawImage(img, point.x - width / 2, point.y + isoTileHeight / 2 - heightPx / 2, width, heightPx);
        return;
      }
      ctx.drawImage(img, point.x - width / 2, point.y + isoTileHeight / 2 - heightPx + 10, width, heightPx);
    }

    function getIsoOutputSize() {
      if (typeof getMirrorGridSizeFor === "function") {
        return getMirrorGridSizeFor(isoTilesX, isoTilesY, isoMirrorPattern, isoMirrorRepeatX, isoMirrorRepeatY, isoMirrorCenterRowOnce, isoMirrorCenterColOnce);
      }
      return { cols: isoTilesX, rows: isoTilesY };
    }

    function updateIsoMirrorShapePreview() {
      var preview = document.getElementById("isoMirrorShapePreview");
      if (!preview) {
        return;
      }
      var size = getIsoOutputSize();
      preview.value = size.cols + " x " + size.rows;
    }
    window.updateIsoMirrorShapePreview = updateIsoMirrorShapePreview;

    function getIsoMirrorCells(col, row) {
      if (typeof getMirrorCellsFor !== "function") {
        return [{ col: col, row: row }];
      }
      return getMirrorCellsFor(col, row, isoTilesX, isoTilesY, isoMirrorPattern, isoMirrorRepeatX, isoMirrorRepeatY, isoMirrorCenterRowOnce, isoMirrorCenterColOnce);
    }

    function ensureIsoMapRows(size) {
      currentMap = [];
      currentItems = [];
      for (var row = 0; row < size.rows; row++) {
        currentMap[row] = [];
        currentItems[row] = [];
        for (var col = 0; col < size.cols; col++) {
          currentMap[row][col] = "hole";
          currentItems[row][col] = "";
        }
      }
    }

    function setIsoMirroredTileData(col, row, mapValue, itemValue) {
      var cells = getIsoMirrorCells(col, row);
      for (var i = 0; i < cells.length; i++) {
        if (!currentMap[cells[i].row]) {
          currentMap[cells[i].row] = [];
        }
        if (!currentItems[cells[i].row]) {
          currentItems[cells[i].row] = [];
        }
        currentMap[cells[i].row][cells[i].col] = mapValue;
        currentItems[cells[i].row][cells[i].col] = itemValue || "";
      }
    }

    function setIsoMirroredItemData(col, row, itemValue) {
      var cells = getIsoMirrorCells(col, row);
      for (var i = 0; i < cells.length; i++) {
        if (currentItems[cells[i].row]) {
          currentItems[cells[i].row][cells[i].col] = itemValue || "";
        }
      }
    }

    function resizeIsometricCanvas() {
      var size = getIsoOutputSize();
      var floorWidth = (size.cols + size.rows) * isoTileWidth / 2;
      var floorHeight = (size.cols + size.rows) * isoTileHeight / 2 + isoBlockHeight * 3;
      isoRenderStartX = getIsoRenderStartX(size);
      isoRenderStartY = getIsoRenderStartY(size, floorHeight);
      var bounds = getIsoFloorBounds(size);
      var leftEdge = isoRenderStartX + bounds.minX;
      var visibleWidth = getIsoVisibleBaseWidth();
      var visibleHeight = getIsoVisibleBaseHeight();
      var widthEnd = isoStartX === 0 ? Math.max(visibleWidth, floorWidth + isoEndX * 2) : leftEdge + floorWidth + isoEndX;
      var heightEnd = isoStartY === 0 ? Math.max(visibleHeight, floorHeight + isoEndY * 2) : isoRenderStartY + floorHeight + isoEndY;
      canvas.width = Math.ceil(widthEnd * canvasScale);
      canvas.height = Math.ceil(heightEnd * canvasScale);
      canvas.style.width = canvas.width + "px";
      canvas.style.height = canvas.height + "px";
      setCanvasScale();
    }

    function drawStoredIsometricMap() {
      resizeIsometricCanvas();
      clearAndDrawBackground();
      var size = getIsoOutputSize();
      var drawCells = getOrderedCells(size.cols, size.rows, isoDirection);
      for (var cellIndex = 0; cellIndex < drawCells.length; cellIndex++) {
        var x = drawCells[cellIndex].col;
        var y = drawCells[cellIndex].row;
        {
          var isPlatform = currentMap[y] && currentMap[y][x] === "platform";
          var isEdge = x === 0 || y === 0 || x === size.cols - 1 || y === size.rows - 1;
          var blockHeight = isPlatform ? isoBlockHeight * (isoRaisedEdges && isEdge ? 1.45 : 1) : 0;
          drawIsoBlock(x, y, blockHeight, isPlatform ? "platform" : "hole");
          var itemId = currentItems[y] && currentItems[y][x] || "";
          if (!itemId) continue;
          if (window.MapGeneratorCatalog && window.MapGeneratorCatalog.isPlayerMarkerItemId(itemId)) {
            continue;
          }
          var itemType = getSpriteType(itemId);
          if (!itemType) continue;
          var itemImg = getSpriteImage(itemType);
          var extraHeight = itemType.isoCreateBlock ? isoBlockHeight * (itemType.isoBlockHeightScale || 1) : 0;
          if (extraHeight) {
            drawIsoRaisedSpriteBlock(x, y, blockHeight, extraHeight, itemType, itemImg);
          }
          drawIsoSprite(itemImg, x, y, blockHeight + extraHeight, isoTileWidth * 0.68, isoTileHeight * 1.45, itemType);
        }
      }
      for (var playerIndex = 0; playerIndex < currentPlayers.length; playerIndex++) {
        var player = currentPlayers[playerIndex];
        var playerHeight = currentMap[player.row] && currentMap[player.row][player.col] === "platform" ? isoBlockHeight * ((isoRaisedEdges && (player.col === 0 || player.row === 0 || player.col === size.cols - 1 || player.row === size.rows - 1)) ? 1.45 : 1) : 0;
        drawIsoSprite(window.MapGeneratorCatalog.getPlayerMarkerSpriteForIndex(player.variantIndex), player.col, player.row, playerHeight, isoTileWidth * 0.75, isoTileHeight * 1.7, { isoBehavior: "billboard" });
      }
    }

    function refreshIsometricPreviewOnly() {
      if (!canvas || !ctx || generatorMode !== "isometric" || !currentMap.length) {
        generateMapIfReady();
        return;
      }
      drawStoredIsometricMap();
      updatePreviewStats();
    }
    window.refreshIsometricPreviewOnly = refreshIsometricPreviewOnly;

    function generateIsometricMap() {
      var outputSize = getIsoOutputSize();
      var baseTotalSlots = isoTilesX * isoTilesY;
      var totalSlots = outputSize.cols * outputSize.rows;
      var platformSlots = 0;
      var playersPlaced = 0;
      var currentCounts = {};
      var minCounts = {};
      var maxCounts = {};
      setCurrentPlayers([]);

      resizeIsometricCanvas();
      clearAndDrawBackground();
      ensureIsoMapRows(outputSize);
      updateIsoMirrorShapePreview();

      spriteTypes.forEach(function(type) {
        currentCounts[type.id] = 0;
        minCounts[type.id] = 0;
        maxCounts[type.id] = 0;
      });

      for (var row = 0; row < isoTilesY; row++) {
        for (var col = 0; col < isoTilesX; col++) {
          var edge = col === 0 || row === 0 || col === isoTilesX - 1 || row === isoTilesY - 1;
          var filled = edge || randomValue() * 100 <= isoFillPercent;
          setIsoMirroredTileData(col, row, filled ? "platform" : "hole", "");
        }
      }

      for (var countRow = 0; countRow < outputSize.rows; countRow++) {
        for (var countCol = 0; countCol < outputSize.cols; countCol++) {
          if (currentMap[countRow] && currentMap[countRow][countCol] === "platform") {
            platformSlots++;
          }
        }
      }

      spriteTypes.forEach(function(type) {
        var base = type.role === "platform" ? totalSlots : Math.max(1, platformSlots);
        minCounts[type.id] = base / 100 * type.minPercent;
        maxCounts[type.id] = base / 100 * type.maxPercent;
      });

      for (var y = 0; y < isoTilesY; y++) {
        for (var x = 0; x < isoTilesX; x++) {
          var baseIsPlatform = currentMap[y] && currentMap[y][x] === "platform";
          var baseIsEdge = x === 0 || y === 0 || x === isoTilesX - 1 || y === isoTilesY - 1;
          if (!baseIsPlatform) {
            var holePlacement = pickConfiguredSpriteForCell({ map: currentMap, items: currentItems, col: x, supportRow: y, canPlaceAbove: false, requiresVisibleSupport: false }, currentCounts, maxCounts, minCounts, Math.max(0, baseTotalSlots - (y * isoTilesX + x) - 1));
            var holeItemType = holePlacement && holePlacement.type || null;
            if (holeItemType && !baseIsEdge) {
              currentCounts[holeItemType.id]++;
              setIsoMirroredItemData(x, y, holeItemType.id);
            }
            continue;
          }

          currentCounts.platform++;
          if (isoPlacePlayers && playersPlaced < isoPlayerCount && window.MapGeneratorCatalog && window.MapGeneratorCatalog.getPlayerMarkerItemId() && Math.abs(x - Math.floor(isoTilesX / 2)) <= 1 && Math.abs(y - Math.floor(isoTilesY / 2)) <= 1) {
            setIsoMirroredItemData(x, y, window.MapGeneratorCatalog.getPlayerMarkerItemId());
            playersPlaced++;
            continue;
          }

          var loopsLeft = Math.max(0, baseTotalSlots - (y * isoTilesX + x) - 1);
          var itemPlacement = pickConfiguredSpriteForCell({ map: currentMap, items: currentItems, col: x, supportRow: y, canPlaceAbove: false, requiresVisibleSupport: false }, currentCounts, maxCounts, minCounts, loopsLeft);
          var itemType = itemPlacement && itemPlacement.type || null;
          if (itemType && !baseIsEdge) {
            currentCounts[itemType.id]++;
            setIsoMirroredItemData(x, y, itemType.id);
          }
        }
      }
      if (typeof rebuildCurrentPlayersFromItems === "function") {
        rebuildCurrentPlayersFromItems(isoPlayerCount);
      }

      drawStoredIsometricMap();
    }
