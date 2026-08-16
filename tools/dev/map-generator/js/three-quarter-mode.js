(function() {
  const defaults = {
    tilesX: 14,
    tilesY: 9,
    startX: 160,
    startY: 122,
    endX: 96,
    endY: 96,
    direction: "row-right-down",
    fillPercent: 88,
    edgeHeight: 22,
    edgeDepth: 16,
    exportQuality: 70,
    placePlayers: true,
    playerCount: 1,
    frameEdges: true,
    mirrorPattern: "xy",
    mirrorRepeatX: 1,
    mirrorRepeatY: 1,
    mirrorCenterRowOnce: true,
    mirrorCenterColOnce: false
  };

  const state = { ...defaults };

  function readNumber(id, fallback, min) {
    const input = document.getElementById(id);
    const value = Number(input && input.value);
    if (!Number.isFinite(value)) return fallback;
    return typeof min === "number" ? Math.max(min, value) : value;
  }

  function readChecked(id, fallback) {
    const input = document.getElementById(id);
    return input ? !!input.checked : fallback;
  }

  function readValue(id, fallback) {
    const input = document.getElementById(id);
    const value = String(input && input.value || "").trim();
    return value || fallback;
  }

  function getCssColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function clampFillPercent(value) {
    return Math.max(0, Math.min(100, value));
  }

  function syncFromDom(triggerGenerate) {
    state.tilesX = readNumber("mapTilesX", defaults.tilesX, 1);
    state.tilesY = readNumber("mapTilesY", defaults.tilesY, 1);
    state.startX = readNumber("mapStartX", defaults.startX, -9999);
    state.startY = readNumber("mapStartY", defaults.startY, -9999);
    state.endX = readNumber("mapEndX", defaults.endX, 0);
    state.endY = readNumber("mapEndY", defaults.endY, 0);
    state.direction = readValue("mapDirection", defaults.direction);
    state.fillPercent = defaults.fillPercent;
    state.edgeHeight = readNumber("threeQuarterEdgeHeight", defaults.edgeHeight, 0);
    state.edgeDepth = readNumber("threeQuarterEdgeDepth", defaults.edgeDepth, 0);
    state.exportQuality = Math.max(1, Math.min(100, readNumber("exportQuality", defaults.exportQuality, 1)));
    state.placePlayers = readChecked("threeQuarterPlacePlayers", defaults.placePlayers);
    state.playerCount = readNumber("threeQuarterPlayerCount", defaults.playerCount, 0);
    state.frameEdges = readChecked("threeQuarterFrameEdges", defaults.frameEdges);
    state.mirrorPattern = readValue("mirrorPattern", defaults.mirrorPattern);
    state.mirrorRepeatX = readNumber("mirrorRepeatX", defaults.mirrorRepeatX, 0);
    state.mirrorRepeatY = readNumber("mirrorRepeatY", defaults.mirrorRepeatY, 0);
    state.mirrorCenterRowOnce = readChecked("mirrorCenterRowOnce", defaults.mirrorCenterRowOnce);
    state.mirrorCenterColOnce = readChecked("mirrorCenterColOnce", defaults.mirrorCenterColOnce);
    updateMirrorShapePreview();
    if (window.generatorMode === "threequarter") {
      window.exportQuality = state.exportQuality;
    }
    if (triggerGenerate !== false && typeof window.generateMapIfReady === "function") {
      window.generateMapIfReady();
    }
  }

  function updateMirrorShapePreview() {
    const preview = document.getElementById("mirrorShapePreview");
    if (!preview || typeof window.getMirrorGridSizeFor !== "function") return;
    const size = window.getMirrorGridSizeFor(
      state.tilesX,
      state.tilesY,
      state.mirrorPattern,
      state.mirrorRepeatX,
      state.mirrorRepeatY,
      state.mirrorCenterRowOnce,
      state.mirrorCenterColOnce
    );
    preview.value = size.cols + " x " + size.rows;
  }

  function shouldPlace(current, min, max, confidence, loopsLeft) {
    if (current >= max) return false;
    let place = window.randomValue() >= confidence;
    if (!place && current + loopsLeft < min && current < max) place = true;
    return place;
  }

  function pickItemSprite(currentCounts, maxCounts, minCounts, loopsLeft) {
    const itemTypes = window.spriteTypes.filter(type => type.role === "item");
    for (let i = 0; i < itemTypes.length; i += 1) {
      const type = itemTypes[i];
      if (shouldPlace(currentCounts[type.id] || 0, minCounts[type.id] || 0, maxCounts[type.id] || 0, type.confidence, loopsLeft)) {
        return type;
      }
    }
    return null;
  }

  function setTileData(targetMap, targetItems, col, row, mapValue, itemValue) {
    if (!targetMap[row]) targetMap[row] = [];
    if (!targetItems[row]) targetItems[row] = [];
    targetMap[row][col] = mapValue;
    targetItems[row][col] = itemValue || "";
  }

  function isPlatform(targetMap, col, row) {
    return !!(targetMap[row] && targetMap[row][col] === "platform");
  }

  function mirrorBaseChunk(baseMap, baseItems) {
    const size = window.getMirrorGridSizeFor(
      state.tilesX,
      state.tilesY,
      state.mirrorPattern,
      state.mirrorRepeatX,
      state.mirrorRepeatY,
      state.mirrorCenterRowOnce,
      state.mirrorCenterColOnce
    );
    window.currentMap = [];
    window.currentItems = [];
    for (let baseRow = 0; baseRow < state.tilesY; baseRow += 1) {
      for (let baseCol = 0; baseCol < state.tilesX; baseCol += 1) {
        const cells = window.getMirrorCellsFor(
          baseCol,
          baseRow,
          state.tilesX,
          state.tilesY,
          state.mirrorPattern,
          state.mirrorRepeatX,
          state.mirrorRepeatY,
          state.mirrorCenterRowOnce,
          state.mirrorCenterColOnce
        );
        for (let i = 0; i < cells.length; i += 1) {
          const cell = cells[i];
          if (cell.col < 0 || cell.row < 0 || cell.col >= size.cols || cell.row >= size.rows) continue;
          setTileData(window.currentMap, window.currentItems, cell.col, cell.row, baseMap[baseRow][baseCol], baseItems[baseRow][baseCol]);
        }
      }
    }
    return size;
  }

  function drawFrontFace(x, y, width, height) {
    window.ctx.fillStyle = getCssColor("--accent-2", "#ff6136");
    window.ctx.fillRect(x, y, width, height);
    window.ctx.fillStyle = "rgba(0,0,0,0.14)";
    window.ctx.fillRect(x, y + height - 4, width, 4);
  }

  function drawRightFace(x, y, width, height) {
    window.ctx.fillStyle = getCssColor("--panel-soft", "#2b1d1d");
    window.ctx.beginPath();
    window.ctx.moveTo(x, y);
    window.ctx.lineTo(x + width, y + 6);
    window.ctx.lineTo(x + width, y + height + 6);
    window.ctx.lineTo(x, y + height);
    window.ctx.closePath();
    window.ctx.fill();
  }

  function drawTileTop(img, x, y) {
    if (img && (img.complete || img.src)) {
      window.drawSprite(img, x, y);
      return;
    }
    window.ctx.fillStyle = getCssColor("--accent", "#8fd36a");
    window.ctx.fillRect(x, y, window.getDrawWidth(window.getSpriteImage(window.getSpriteType("platform"))), window.getDrawHeight(window.getSpriteImage(window.getSpriteType("platform"))));
  }

  function renderMap(platformImg, holeImg) {
    const stepX = window.getDrawWidth(platformImg);
    const stepY = window.getDrawHeight(platformImg);
    const dims = { cols: 0, rows: window.currentMap.length };
    for (let row = 0; row < window.currentMap.length; row += 1) {
      dims.cols = Math.max(dims.cols, (window.currentMap[row] || []).length);
    }
    const width = Math.ceil((Math.max(0, state.startX) + dims.cols * stepX + state.edgeDepth + state.endX) * window.canvasScale);
    const height = Math.ceil((Math.max(0, state.startY) + dims.rows * stepY + state.edgeHeight + state.edgeDepth + state.endY) * window.canvasScale);
    window.canvas.width = Math.max(window.canvasBaseWidth, width);
    window.canvas.height = Math.max(window.canvasBaseHeight, height);
    window.canvas.style.width = window.canvas.width + "px";
    window.canvas.style.height = window.canvas.height + "px";
    window.setCanvasScale();
    window.clearAndDrawBackground();

    const drawCells = typeof window.getOrderedCells === "function" ? window.getOrderedCells(dims.cols, dims.rows, state.direction) : [];
    for (const cell of drawCells) {
      const col = cell.col;
      const row = cell.row;
      {
        const tile = window.currentMap[row] && window.currentMap[row][col];
        const x = state.startX + col * stepX;
        const baseY = state.startY + row * stepY;
        if (tile === "hole" && holeImg && holeImg.src) {
          window.drawSprite(holeImg, x, baseY + state.edgeHeight);
          continue;
        }
        if (tile !== "platform") continue;
        const topY = baseY;
        const frontVisible = !isPlatform(window.currentMap, col, row + 1);
        const rightVisible = !isPlatform(window.currentMap, col + 1, row);
        if (frontVisible) {
          drawFrontFace(x, topY + stepY - 8, stepX, state.edgeHeight);
        }
        if (rightVisible) {
          drawRightFace(x + stepX - 8, topY + 4, state.edgeDepth, stepY + state.edgeHeight - 8);
        }
        drawTileTop(platformImg, x, topY);
        window.ctx.strokeStyle = "rgba(255,255,255,0.12)";
        window.ctx.strokeRect(x + 0.5, topY + 0.5, stepX - 1, stepY - 1);
      }
    }

    for (let row = 0; row < dims.rows; row += 1) {
      for (let col = 0; col < dims.cols; col += 1) {
        const itemId = window.currentItems[row] && window.currentItems[row][col];
        if (!itemId || window.currentMap[row][col] !== "platform") continue;
        const x = state.startX + col * stepX;
        const topY = state.startY + row * stepY - Math.round(state.edgeHeight * 0.45);
        if (window.MapGeneratorCatalog && window.MapGeneratorCatalog.isPlayerMarkerItemId(itemId)) {
          continue;
        }
        const itemType = window.getSpriteType(itemId);
        if (itemType) {
          window.drawSprite(window.getSpriteImage(itemType), x, topY);
        }
      }
    }
    for (let playerIndex = 0; playerIndex < window.currentPlayers.length; playerIndex += 1) {
      const player = window.currentPlayers[playerIndex];
      const x = state.startX + player.col * stepX;
      const topY = state.startY + player.row * stepY - Math.round(state.edgeHeight * 0.45);
      window.drawSprite(window.MapGeneratorCatalog.getPlayerMarkerSpriteForIndex(player.variantIndex), x, topY);
    }
  }

  function renderExisting() {
    syncFromDom(false);
    const platformType = window.getSpriteType("platform");
    const platformImg = window.getSpriteImage(platformType);
    const holeType = window.getSpriteType("hole");
    const holeImg = holeType ? window.getSpriteImage(holeType) : null;
    renderMap(platformImg, holeImg);
  }

  function generate() {
    syncFromDom(false);
    const platformType = window.getSpriteType("platform");
    const platformImg = window.getSpriteImage(platformType);
    const holeType = window.getSpriteType("hole");
    const holeImg = holeType ? window.getSpriteImage(holeType) : null;
    const totalSlots = state.tilesX * state.tilesY;
    const currentCounts = {};
    const minCounts = {};
    const maxCounts = {};
    const baseMap = [];
    const baseItems = [];
    let playersPlaced = 0;
    window.setCurrentPlayers([]);

    window.spriteTypes.forEach(type => {
      currentCounts[type.id] = 0;
      const base = type.role === "platform" ? totalSlots : totalSlots;
      minCounts[type.id] = base / 100 * type.minPercent;
      maxCounts[type.id] = base / 100 * type.maxPercent;
    });

    for (let row = 0; row < state.tilesY; row += 1) {
      for (let col = 0; col < state.tilesX; col += 1) {
        const edge = row === 0 || col === 0 || row === state.tilesY - 1 || col === state.tilesX - 1;
        const filled = state.frameEdges && edge ? true : window.randomValue() * 100 <= state.fillPercent;
        setTileData(baseMap, baseItems, col, row, filled ? "platform" : "hole", "");
      }
    }

    for (let row = 0; row < state.tilesY; row += 1) {
      for (let col = 0; col < state.tilesX; col += 1) {
        if (baseMap[row][col] !== "platform") continue;
        currentCounts.platform += 1;
        const loopsLeft = Math.max(0, totalSlots - (row * state.tilesX + col) - 1);
        if (state.placePlayers && playersPlaced < state.playerCount && window.MapGeneratorCatalog && window.MapGeneratorCatalog.getPlayerMarkerItemId()) {
          baseItems[row][col] = window.MapGeneratorCatalog.getPlayerMarkerItemId();
          playersPlaced += 1;
          continue;
        }
        const itemPlacement = typeof window.pickConfiguredSpriteForCell === "function"
          ? window.pickConfiguredSpriteForCell({ map: baseMap, items: baseItems, col, supportRow: row, canPlaceAbove: false, requiresVisibleSupport: false }, currentCounts, maxCounts, minCounts, loopsLeft)
          : null;
        const itemType = itemPlacement ? itemPlacement.type : (typeof window.pickConfiguredSpriteForCell === "function" ? null : pickItemSprite(currentCounts, maxCounts, minCounts, loopsLeft));
        if (itemType) {
          currentCounts[itemType.id] += 1;
          baseItems[row][col] = itemType.id;
        }
      }
    }

    mirrorBaseChunk(baseMap, baseItems);
    if (typeof window.rebuildCurrentPlayersFromItems === "function") {
      window.rebuildCurrentPlayersFromItems(state.playerCount);
    }
    renderMap(platformImg, holeImg);
  }

  function buildSetupPayload() {
    syncFromDom(false);
    return { ...state };
  }

  function applySetupPayload(payload) {
    if (!payload || typeof payload !== "object") return;
    const assign = (id, value, checked) => {
      const input = document.getElementById(id);
      if (!input) return;
      if (checked) input.checked = !!value;
      else input.value = value;
    };
    assign("mapTilesX", payload.tilesX ?? state.tilesX);
    assign("mapTilesY", payload.tilesY ?? state.tilesY);
    assign("mapStartX", payload.startX ?? state.startX);
    assign("mapStartY", payload.startY ?? state.startY);
    assign("mapEndX", payload.endX ?? state.endX);
    assign("mapEndY", payload.endY ?? state.endY);
    assign("mapDirection", payload.direction ?? state.direction);
    // Fill percent is intentionally not applied here. 3/4 RPG depth now uses the normal Topdown generation logic.
    assign("threeQuarterEdgeHeight", payload.edgeHeight ?? state.edgeHeight);
    assign("threeQuarterEdgeDepth", payload.edgeDepth ?? state.edgeDepth);
    assign("exportQuality", payload.exportQuality ?? state.exportQuality);
    assign("threeQuarterPlacePlayers", payload.placePlayers !== false, true);
    assign("threeQuarterPlayerCount", payload.playerCount ?? state.playerCount);
    assign("threeQuarterFrameEdges", payload.frameEdges !== false, true);
    assign("mirrorPattern", payload.mirrorPattern || state.mirrorPattern);
    assign("mirrorRepeatX", payload.mirrorRepeatX ?? state.mirrorRepeatX);
    assign("mirrorRepeatY", payload.mirrorRepeatY ?? state.mirrorRepeatY);
    assign("mirrorCenterRowOnce", !!payload.mirrorCenterRowOnce, true);
    assign("mirrorCenterColOnce", !!payload.mirrorCenterColOnce, true);
    syncFromDom(false);
  }

  window.ThreeQuarterMapGenerator = {
    defaults,
    state,
    setOptions: syncFromDom,
    updateMirrorShapePreview,
    generate,
    renderExisting,
    buildSetupPayload,
    applySetupPayload
  };
})();
