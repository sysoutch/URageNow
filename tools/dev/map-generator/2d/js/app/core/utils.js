function slugify(value) {
      return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    function getSpriteType(typeId) {
      return spriteTypes.find(function(type) {
        return type.id === typeId;
      });
    }
    window.getSpriteType = getSpriteType;

    function getSpriteImage(type) {
      return document.getElementById(type.imageId);
    }
    window.getSpriteImage = getSpriteImage;

    function setSpriteTypes(nextTypes) {
      spriteTypes = Array.isArray(nextTypes) ? nextTypes : [];
      window.spriteTypes = spriteTypes;
    }
    window.setSpriteTypes = setSpriteTypes;

    function setPlayerMarkerConfig(nextConfig) {
      playerMarkerConfig = nextConfig || null;
      window.playerMarkerConfig = playerMarkerConfig;
    }
    window.setPlayerMarkerConfig = setPlayerMarkerConfig;

    function setCurrentPlayers(nextPlayers) {
      currentPlayers = Array.isArray(nextPlayers) ? nextPlayers : [];
      window.currentPlayers = currentPlayers;
    }
    window.setCurrentPlayers = setCurrentPlayers;

    function rebuildCurrentPlayersFromItems(maxPlayers) {
      setCurrentPlayers([]);
      if (!window.MapGeneratorCatalog) {
        return;
      }
      for (var row = 0; row < currentItems.length; row++) {
        for (var col = 0; col < (currentItems[row] || []).length; col++) {
          var itemId = currentItems[row] && currentItems[row][col];
          if (!window.MapGeneratorCatalog.isPlayerMarkerItemId(itemId)) {
            continue;
          }
          if (currentPlayers.length < maxPlayers) {
            currentPlayers.push(window.MapGeneratorCatalog.createPlayerPlacement(col, row, currentPlayers.length));
          } else {
            currentItems[row][col] = "";
          }
        }
      }
    }
    window.rebuildCurrentPlayersFromItems = rebuildCurrentPlayersFromItems;

    function normalizeBackgroundMode(mode) {
      return mode === "sidescroller" || mode === "isometric" || mode === "threequarter" ? mode : "topdown";
    }

    function getActiveBackgroundMode() {
      return normalizeBackgroundMode(generatorMode);
    }

    function getActiveBackground() {
      return backgrounds[getActiveBackgroundMode()] || backgrounds.topdown || background || null;
    }

    function setModeBackgroundSource(mode, src, onload) {
      var key = normalizeBackgroundMode(mode);
      var nextBackground = new Image();
      nextBackground.dataset.source = src;
      nextBackground.onload = function() {
        if (backgrounds[key] === nextBackground && typeof onload === "function") {
          onload();
        }
      };
      nextBackground.src = src;
      backgrounds[key] = nextBackground;
      if (key === "topdown") {
        background = nextBackground;
      }
      if (getActiveBackgroundMode() === key) {
        background = nextBackground;
      }
    }

    function buildBackgroundSetupPayload() {
      var payload = {};
      ["topdown", "threequarter", "isometric", "sidescroller"].forEach(function(mode) {
        var item = backgrounds[mode];
        payload[mode] = item && item.dataset ? item.dataset.source || "" : "";
      });
      return payload;
    }

    function readNumber(id, fallback, min) {
      var input = document.getElementById(id);
      if (!input) {
        return fallback;
      }
      var value = parseFloat(input.value);
      if (isNaN(value)) {
        value = fallback;
      }
      value = Math.max(min, value);
      input.value = value;
      return value;
    }

    function readText(id, fallback) {
      var input = document.getElementById(id);
      if (!input) {
        return fallback;
      }
      return String(input.value || fallback || "").trim();
    }

    function setInputValue(id, value) {
      var input = document.getElementById(id);
      if (input) {
        input.value = value;
      }
    }

    function setCheckboxValue(id, checked) {
      var input = document.getElementById(id);
      if (input) {
        input.checked = !!checked;
      }
    }

    function getOrderedCells(cols, rows, direction) {
      var cells = [];
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          cells.push({ col: col, row: row });
        }
      }
      if (direction === "row-left-down") {
        cells.sort(function(a, b) { return a.row - b.row || b.col - a.col; });
      } else if (direction === "row-right-up") {
        cells.sort(function(a, b) { return b.row - a.row || a.col - b.col; });
      } else if (direction === "row-left-up") {
        cells.sort(function(a, b) { return b.row - a.row || b.col - a.col; });
      } else if (direction === "column-down-right") {
        cells.sort(function(a, b) { return a.col - b.col || a.row - b.row; });
      } else if (direction === "column-up-right" || direction === "right-up") {
        cells.sort(function(a, b) { return a.col - b.col || b.row - a.row; });
      } else if (direction === "column-down-left") {
        cells.sort(function(a, b) { return b.col - a.col || a.row - b.row; });
      } else if (direction === "column-up-left" || direction === "left-up") {
        cells.sort(function(a, b) { return b.col - a.col || b.row - a.row; });
      }
      return cells;
    }
    window.getOrderedCells = getOrderedCells;
