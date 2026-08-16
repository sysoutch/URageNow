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

function getIsoPoint(col, row, height) {
  return {
    x: isoStartX + (col - row) * isoTileWidth / 2,
    y: isoStartY + (col + row) * isoTileHeight / 2 - height
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

function drawIsoBlock(col, row, height, kind) {
  var top = getIsoPoint(col, row, height);
  var halfW = isoTileWidth / 2;
  var halfH = isoTileHeight / 2;
  var base = kind === "hole" ? getCssColor("--panel-strong", "#11160f") : getCssColor("--accent", "#8fd36a");
  base = normalizeHexColor(base, "#8fd36a");
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
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(diamond[0].x, diamond[0].y + 4);
  ctx.lineTo(diamond[1].x - 8, diamond[1].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawIsoSprite(img, col, row, height, maxWidth, maxHeight) {
  if (!img || !img.complete && !img.src) {
    return;
  }
  var point = getIsoPoint(col, row, height);
  var width = Math.min(getDrawWidth(img), maxWidth);
  var heightPx = Math.min(getDrawHeight(img), maxHeight);
  ctx.drawImage(img, point.x - width / 2, point.y + isoTileHeight / 2 - heightPx + 10, width, heightPx);
}

function generateIsometricMap() {
  var totalSlots = isoTilesX * isoTilesY;
  var platformSlots = 0;
  var characterPlaced = false;
  var currentCounts = {};
  var minCounts = {};
  var maxCounts = {};
  var floorWidth = (isoTilesX + isoTilesY) * isoTileWidth / 2;
  var floorHeight = (isoTilesX + isoTilesY) * isoTileHeight / 2 + isoBlockHeight * 3;
  var leftEdge = isoStartX - isoTilesY * isoTileWidth / 2;

  canvas.width = Math.max(canvasBaseWidth, Math.ceil((Math.max(0, leftEdge) + floorWidth + canvasPadding) * canvasScale));
  canvas.height = Math.max(canvasBaseHeight, Math.ceil((isoStartY + floorHeight + canvasPadding) * canvasScale));
  canvas.style.width = canvas.width + "px";
  canvas.style.height = canvas.height + "px";
  setCanvasScale();
  clearAndDrawBackground();
  currentMap = [];
  currentItems = [];

  spriteTypes.forEach(function(type) {
    currentCounts[type.id] = 0;
    minCounts[type.id] = 0;
    maxCounts[type.id] = 0;
  });

  for (var row = 0; row < isoTilesY; row++) {
    for (var col = 0; col < isoTilesX; col++) {
      var edge = col === 0 || row === 0 || col === isoTilesX - 1 || row === isoTilesY - 1;
      var filled = edge || randomValue() * 100 <= isoFillPercent;
      if (filled) {
        platformSlots++;
      }
      setTileData(col, row, filled ? "platform" : "hole", "");
    }
  }

  spriteTypes.forEach(function(type) {
    var base = type.role === "platform" ? totalSlots : Math.max(1, platformSlots);
    minCounts[type.id] = base / 100 * type.minPercent;
    maxCounts[type.id] = base / 100 * type.maxPercent;
  });

  for (var y = 0; y < isoTilesY; y++) {
    for (var x = 0; x < isoTilesX; x++) {
      var isPlatform = currentMap[y] && currentMap[y][x] === "platform";
      var isEdge = x === 0 || y === 0 || x === isoTilesX - 1 || y === isoTilesY - 1;
      var blockHeight = isPlatform ? isoBlockHeight * (isoRaisedEdges && isEdge ? 1.45 : 1) : 0;
      drawIsoBlock(x, y, blockHeight, isPlatform ? "platform" : "hole");
      if (!isPlatform) {
        var holePlacement = pickConfiguredSpriteForCell({ map: currentMap, items: currentItems, col: x, supportRow: y, canPlaceAbove: false, requiresVisibleSupport: false }, currentCounts, maxCounts, minCounts, Math.max(0, totalSlots - (y * isoTilesX + x) - 1));
        var holeItemType = holePlacement && holePlacement.type || null;
        if (holeItemType && !isEdge) {
          currentCounts[holeItemType.id]++;
          currentItems[y][x] = holeItemType.id;
          drawIsoSprite(getSpriteImage(holeItemType), x, y, blockHeight, isoTileWidth * 0.68, isoTileHeight * 1.45);
        }
        continue;
      }

      currentCounts.platform++;
      if (isoPlacePlayers && !characterPlaced && Math.abs(x - Math.floor(isoTilesX / 2)) <= 1 && Math.abs(y - Math.floor(isoTilesY / 2)) <= 1) {
        currentItems[y][x] = "character";
        drawIsoSprite(document.getElementById("characterRed"), x, y, blockHeight, isoTileWidth * 0.75, isoTileHeight * 1.7);
        characterPlaced = true;
        continue;
      }

      var loopsLeft = Math.max(0, totalSlots - (y * isoTilesX + x) - 1);
      var itemPlacement = pickConfiguredSpriteForCell({ map: currentMap, items: currentItems, col: x, supportRow: y, canPlaceAbove: false, requiresVisibleSupport: false }, currentCounts, maxCounts, minCounts, loopsLeft);
      var itemType = itemPlacement && itemPlacement.type || null;
      if (itemType && !isEdge) {
        currentCounts[itemType.id]++;
        currentItems[y][x] = itemType.id;
        drawIsoSprite(getSpriteImage(itemType), x, y, blockHeight, isoTileWidth * 0.68, isoTileHeight * 1.45);
      }
    }
  }
}
