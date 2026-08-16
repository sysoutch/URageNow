(function() {
  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function readDefaultCatalog() {
    var script = document.getElementById("defaultMapGeneratorCatalog");
    if (!script || !script.textContent) {
      return { sprites: [], playerMarker: null };
    }
    try {
      var parsed = JSON.parse(script.textContent);
      return parsed && typeof parsed === "object" ? parsed : { sprites: [], playerMarker: null };
    } catch (error) {
      console.error("Failed to parse default map generator catalog.", error);
      return { sprites: [], playerMarker: null };
    }
  }

  function ensureImageAsset(imageId, src, alt) {
    if (!imageId) {
      return null;
    }
    var root = document.getElementById("hiddenAssets");
    if (!root) {
      return null;
    }
    var image = document.getElementById(imageId);
    if (!image) {
      image = document.createElement("img");
      image.id = imageId;
      image.alt = alt || imageId;
      image.style.display = "none";
      root.appendChild(image);
    }
    if (typeof src === "string") {
      image.src = src;
    }
    return image;
  }

  function buildSpriteTypes(definitions) {
    return (definitions || []).map(function(definition) {
      var type = clone(definition) || {};
      if (!type.id) {
        return null;
      }
      type.name = type.name || type.id;
      type.imageId = type.imageId || ("sprite-" + type.id);
      if (typeof type.removable !== "boolean") {
        type.removable = type.role !== "platform" && type.role !== "hole";
      }
      if (typeof type.assetSource !== "string") {
        type.assetSource = "";
      }
      return type;
    }).filter(Boolean);
  }

  function buildPlayerMarker(definition) {
    if (!definition || typeof definition !== "object") {
      return null;
    }
    var marker = clone(definition);
    marker.id = marker.id || "player-marker";
    marker.itemId = marker.itemId || marker.id;
    marker.name = marker.name || "Players";
    marker.variantImageIds = Array.isArray(marker.variantImageIds) ? marker.variantImageIds.slice() : [];
    marker.variantSources = Array.isArray(marker.variantSources) ? marker.variantSources.slice() : [];
    marker.variantNames = Array.isArray(marker.variantNames) ? marker.variantNames.slice() : [];
    for (var i = 0; i < marker.variantSources.length; i++) {
      if (!marker.variantImageIds[i]) {
        marker.variantImageIds[i] = marker.id + "-variant-" + i;
      }
      if (!marker.variantNames[i]) {
        marker.variantNames[i] = marker.name + " " + (i + 1);
      }
    }
    return marker;
  }

  function ensureCatalogAssets(spriteDefinitions, playerMarker) {
    buildSpriteTypes(spriteDefinitions).forEach(function(type) {
      ensureImageAsset(type.imageId, type.assetSource || "", type.name || type.id);
    });
    var marker = buildPlayerMarker(playerMarker);
    if (!marker) {
      return;
    }
    for (var i = 0; i < marker.variantImageIds.length; i++) {
      ensureImageAsset(marker.variantImageIds[i], marker.variantSources[i] || "", marker.variantNames[i] || marker.name || marker.id);
    }
  }

  function getPlayerMarkerSpriteForIndex(index) {
    var marker = window.playerMarkerConfig;
    if (!marker || !Array.isArray(marker.variantImageIds) || !marker.variantImageIds.length) {
      return null;
    }
    return document.getElementById(marker.variantImageIds[Math.abs(index || 0) % marker.variantImageIds.length]);
  }

  function getPlayerMarkerSpriteForCell(col, row) {
    return getPlayerMarkerSpriteForIndex(Math.abs((col || 0) + (row || 0)));
  }

  function createPlayerPlacement(col, row, variantIndex) {
    var marker = window.playerMarkerConfig;
    return {
      id: marker && marker.itemId ? marker.itemId : "player",
      col: col,
      row: row,
      variantIndex: Math.max(0, Number(variantIndex) || 0)
    };
  }

  window.MapGeneratorCatalog = {
    readDefaultCatalog: readDefaultCatalog,
    ensureImageAsset: ensureImageAsset,
    ensureCatalogAssets: ensureCatalogAssets,
    buildSpriteTypes: buildSpriteTypes,
    buildPlayerMarker: buildPlayerMarker,
    getPlayerMarkerSpriteForIndex: getPlayerMarkerSpriteForIndex,
    getPlayerMarkerSpriteForCell: getPlayerMarkerSpriteForCell,
    createPlayerPlacement: createPlayerPlacement,
    getPlayerMarkerItemId: function() {
      return window.playerMarkerConfig ? window.playerMarkerConfig.itemId : "";
    },
    isPlayerMarkerItemId: function(itemId) {
      return !!(window.playerMarkerConfig && itemId && itemId === window.playerMarkerConfig.itemId);
    },
    serializeSpriteType: clone,
    serializePlayerMarker: clone
  };
})();
