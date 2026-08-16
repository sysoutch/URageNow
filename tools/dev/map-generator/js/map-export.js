(function() {
  function countEntries(list, value) {
    var total = 0;
    for (var row = 0; row < list.length; row++) {
      for (var col = 0; col < (list[row] || []).length; col++) {
        if (list[row][col] === value) total++;
      }
    }
    return total;
  }

  function countItems(items) {
    var total = 0;
    for (var row = 0; row < items.length; row++) {
      for (var col = 0; col < (items[row] || []).length; col++) {
        if (items[row][col]) total++;
      }
    }
    return total;
  }

  function getDimensions(map) {
    var rows = Array.isArray(map) ? map.length : 0;
    var cols = 0;
    for (var row = 0; row < rows; row++) {
      cols = Math.max(cols, map[row] ? map[row].length : 0);
    }
    return { cols: cols, rows: rows };
  }

  function cloneGrid(grid) {
    return Array.isArray(grid) ? grid.map(function(row) {
      return Array.isArray(row) ? row.slice() : [];
    }) : [];
  }

  function buildSpriteSummary(spriteTypes) {
    return Array.isArray(spriteTypes) ? spriteTypes.map(function(type) {
      return {
        id: type.id,
        name: type.name,
        role: type.role,
        minPercent: type.minPercent,
        maxPercent: type.maxPercent,
        confidence: type.confidence,
        placement: type.placement || "anywhere",
        placeAboveSupport: type.placeAboveSupport !== false
      };
    }) : [];
  }

  function buildPayload(options) {
    var map = cloneGrid(options.currentMap);
    var items = cloneGrid(options.currentItems);
    var players = Array.isArray(options.currentPlayers) ? options.currentPlayers.map(function(player) {
      return { id: player.id || "player", col: player.col, row: player.row, variantIndex: player.variantIndex || 0 };
    }) : [];
    var dimensions = getDimensions(map);
    return {
      version: 1,
      generatorMode: options.generatorMode || "topdown",
      seed: options.lastGenerationSeedLabel || "random",
      dimensions: dimensions,
      stats: {
        platforms: countEntries(map, "platform"),
        holes: countEntries(map, "hole"),
        items: countItems(items),
        players: players.length
      },
      map: map,
      items: items,
      players: players,
      sprites: buildSpriteSummary(options.spriteTypes),
      setup: options.setupPayload || null
    };
  }

  function registerApi() {
    window.MapGeneratorExport = {
      buildPayload: buildPayload
    };
  }

  registerApi();
})();
