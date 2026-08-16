// =========================================================
// Export ZIP - Bundle images + map JSON into a downloadable zip
// =========================================================

(function() {
  "use strict";

  var jsZipLoaded = false;

  function ensureJsZip(callback, errorCallback) {
    if (typeof JSZip !== "undefined") {
      callback();
      return;
    }
    var script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = function() { jsZipLoaded = true; callback(); };
    script.onerror = function() {
      var error = new Error("[MapGenerator 2D] Failed to load JSZip from CDN.");
      console.error(error.message);
      if (typeof errorCallback === "function") errorCallback(error);
    };
    document.head.appendChild(script);
  }

  function getMode() {
    return window.generatorMode || "topdown";
  }

  function buildFileName() {
    var mode = getMode();
    var seed = window.lastGenerationSeedLabel || "random";
    return "2d-game-map-" + mode + "-" + seed;
  }

  function getSpriteImageSrc(type) {
    if (!type || !type.imageId) return null;
    var img = document.getElementById(type.imageId);
    return img ? img.src : null;
  }

  function collectSpriteImages() {
    var sprites = window.spriteTypes || [];
    var images = {};
    sprites.forEach(function(type) {
      var src = getSpriteImageSrc(type);
      if (src && src !== "" && !src.startsWith("data:")) return;
      if (src) {
        images[type.imageId + "." + getImageExtension(src)] = src;
      }
    });

    // Also collect player marker variants
    var playerMarker = window.playerMarkerConfig;
    if (playerMarker && Array.isArray(playerMarker.variantImageIds)) {
      playerMarker.variantImageIds.forEach(function(imgId, idx) {
        var img = document.getElementById(imgId);
        if (img && img.src && !img.src.startsWith("data:")) return;
        if (img && img.src) {
          images[imgId + "." + getImageExtension(img.src)] = img.src;
        }
      });
    }

    return images;
  }

  function getImageExtension(dataUrl) {
    if (!dataUrl) return "png";
    var m = dataUrl.match(/data:image\/(\w+)/);
    return m ? m[1] : "png";
  }

  function collectBackgroundImages() {
    var mode = getMode();
    var bgKey = mode + "BackgroundImage";
    var bgImg = window[bgKey];
    if (bgImg && bgImg.src) {
      return { "background.png": bgImg.src };
    }
    // Try common background image IDs
    var bgId = mode === "topdown" ? "ground-o" : mode + "-bg";
    var bgEl = document.getElementById(bgId);
    if (bgEl && bgEl.src) {
      return { "background.png": bgEl.src };
    }
    return {};
  }

  // =========================================================
  // Default sprite images - bundled with ZIP export
  // =========================================================

  function getDefaultImageRefs() {
    var base = "images/";
    return [
      { name: "ground.png", src: base + "ground.png", imageId: "ground-o" },
      { name: "hole.png", src: base + "hole.png", imageId: "hole-o" },
      { name: "brick.png", src: base + "brick.png", imageId: "brick-o" },
      { name: "vase.png", src: base + "vase.png", imageId: "vase-o" },
      { name: "chest.png", src: base + "chest.png", imageId: "chest-o" },
      { name: "char-red.png", src: base + "char-red.png", imageId: "player-marker-red" },
      { name: "char-blue.png", src: base + "char-blue.png", imageId: "player-marker-blue" },
      { name: "char-green.png", src: base + "char-green.png", imageId: "player-marker-green" },
      { name: "char-pink.png", src: base + "char-pink.png", imageId: "player-marker-pink" }
    ];
  }

  function imageElementToDataUrl(imgEl) {
    if (!imgEl || !imgEl.src) return null;
    try {
      var canvas = document.createElement("canvas");
      canvas.width = imgEl.naturalWidth || imgEl.width || 64;
      canvas.height = imgEl.naturalHeight || imgEl.height || 64;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(imgEl, 0, 0);
      return canvas.toDataURL("image/png");
    } catch (e) {
      if (imgEl.src && imgEl.src.startsWith("data:")) return imgEl.src;
      return null;
    }
  }

  function collectDefaultSpritesSync() {
    var defaults = getDefaultImageRefs();
    var collected = {};
    defaults.forEach(function(ref) {
      var existingImg = document.getElementById(ref.imageId);
      if (existingImg) {
        var dataUrl = imageElementToDataUrl(existingImg);
        if (dataUrl) {
          collected[ref.name] = dataUrl;
        }
      }
    });
    return collected;
  }

  // =========================================================
  // Export ZIP - bundles images, map JSON, and settings
  // =========================================================
  window.exportMapZip = function() {
    window.buildMapZipBlob().then(function(result) {
      downloadBlob(result.blob, result.fileName);
    }).catch(function(error) {
      console.error("[MapGenerator 2D] ZIP export failed.", error);
    });
  };

  window.buildMapZipBlob = function() {
    return new Promise(function(resolve, reject) {
      ensureJsZip(function doExport() {
        var zip = new JSZip();
        var folderName = buildFileName();
        var root = zip.folder(folderName);

        // Add map JSON
        var mapJson = buildMapJsonPayload();
        root.file("map.json", JSON.stringify(mapJson, null, 2));

        // Add settings summary
        var settingsJson = buildSettingsJson();
        root.file("settings.json", JSON.stringify(settingsJson, null, 2));

        // Collect default sprites (with async fallback)
        collectDefaultSpritesAsync(zip, folderName, function(blob) {
          resolve({ blob: blob, fileName: folderName + ".zip", folderName: folderName });
        }, reject);
      }, reject);
    });
  };

  function collectDefaultSpritesAsync(zip, folderName, onDone, onError) {
    var defaults = getDefaultImageRefs();
    var collectedCount = 0;
    var totalToLoad = defaults.length;
    var loadedAsDataUrl = {};
    var finalized = false;

    function finish() {
      if (finalized) return;
      finalized = true;
      finalizeZipExport(zip, folderName, loadedAsDataUrl, onDone, onError);
    }

    // First pass: grab any already-available data URLs synchronously
    var syncDefaults = collectDefaultSpritesSync();
    Object.keys(syncDefaults).forEach(function(name) {
      loadedAsDataUrl[name] = syncDefaults[name];
      collectedCount++;
    });

    // If all defaults were already available, proceed to finalize ZIP
    if (collectedCount >= totalToLoad) {
      finish();
      return;
    }

    // Otherwise load remaining default sprites via temp img elements
    var pending = [];
    defaults.forEach(function(ref) {
      if (loadedAsDataUrl[ref.name]) return;

      var deferred = {};
      pending.push(deferred.promise);

      var tempImg = new Image();
      tempImg.crossOrigin = "anonymous";
      tempImg.onload = function() {
        try {
          var canvas = document.createElement("canvas");
          canvas.width = tempImg.naturalWidth || 64;
          canvas.height = tempImg.naturalHeight || 64;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(tempImg, 0, 0);
          loadedAsDataUrl[ref.name] = canvas.toDataURL("image/png");
        } catch (e) {
          // Tainted - skip this image
        }
        collectedCount++;
        if (collectedCount >= totalToLoad) {
          finish();
        }
      };
      tempImg.onerror = function() {
        collectedCount++;
        if (collectedCount >= totalToLoad) {
          finish();
        }
      };
      tempImg.src = ref.src;
    });

    // Safety timeout: finalize after 5 seconds even if some images fail to load
    setTimeout(function() {
      finish();
    }, 5000);
  }

  function finalizeZipExport(zip, folderName, loadedImages, onDone, onError) {
    var root = zip.folder(folderName);
    var imagesFolder = root.folder("images");

    // Write all collected data URL images to the ZIP
    Object.keys(loadedImages).forEach(function(fileName) {
      var dataUrl = loadedImages[fileName];
      if (dataUrl && dataUrl.startsWith("data:")) {
        var base64 = dataUrl.split(",")[1] || "";
        imagesFolder.file(fileName, base64, { base64: true });
      }
    });

    // Add canvas render as preview
    renderCurrentMap();
    var canvasDataUrl = getCanvasDataUrl();
    if (canvasDataUrl) {
      var canvasBase64 = canvasDataUrl.split(",")[1] || "";
      root.file("preview.png", canvasBase64, { base64: true });
    }

    // Add sprite catalog JSON
    var sprites = window.spriteTypes || [];
    var catalog = {
      sprites: sprites.map(function(s) {
        return {
          id: s.id,
          name: s.name,
          imageId: s.imageId,
          role: s.role,
          assetSource: s.assetSource || ""
        };
      }),
      playerMarker: window.playerMarkerConfig ? {
        id: window.playerMarkerConfig.id,
        itemId: window.playerMarkerConfig.itemId,
        name: window.playerMarkerConfig.name,
        variantImageIds: window.playerMarkerConfig.variantImageIds || [],
        variantSources: (window.playerMarkerConfig.variantSources || []).map(function(src) { return src || ""; })
      } : null
    };
    root.file("sprite-catalog.json", JSON.stringify(catalog, null, 2));

    // Generate zip for download or dashboard handoff
    zip.generateAsync({ type: "blob" }).then(function(blob) {
      if (typeof onDone === "function") {
        onDone(blob);
        return;
      }
      downloadBlob(blob, folderName + ".zip");
    }).catch(function(error) {
      if (typeof onError === "function") {
        onError(error);
      } else {
        console.error("[MapGenerator 2D] ZIP generation failed.", error);
      }
    });
  }

  function downloadBlob(blob, fileName) {
    var link = document.createElement("a");
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
  }

  function buildMapJsonPayload() {
    if (window.MapGeneratorExport && window.MapGeneratorExport.buildPayload) {
      return window.MapGeneratorExport.buildPayload({
        currentMap: window.currentMap || [],
        currentItems: window.currentItems || [],
        currentPlayers: window.currentPlayers || [],
        generatorMode: getMode(),
        lastGenerationSeedLabel: window.lastGenerationSeedLabel || "random",
        spriteTypes: window.spriteTypes || [],
        setupPayload: typeof buildSetupPayload === "function" ? buildSetupPayload() : null
      });
    }
    return {
      tool: "map-generator",
      version: 1,
      mode: "2d",
      map: window.currentMap || [],
      items: window.currentItems || [],
      players: window.currentPlayers || [],
      seed: window.lastGenerationSeedLabel || "random"
    };
  }

  function buildSettingsJson() {
    var settings = {
      tool: "map-generator",
      version: 1,
      mode: getMode(),
      seed: window.lastGenerationSeedLabel || "random",
      spriteCount: (window.spriteTypes || []).length
    };
    if (typeof defaultSpriteWidth !== "undefined") settings.defaultSpriteWidth = defaultSpriteWidth;
    if (typeof defaultSpriteHeight !== "undefined") settings.defaultSpriteHeight = defaultSpriteHeight;
    if (typeof autoScaleSprites !== "undefined") settings.autoScaleSprites = autoScaleSprites;

    // Collect mode-specific options
    if (getMode() === "topdown") {
      settings.mapTilesX = document.getElementById("mapTilesX")?.value;
      settings.mapTilesY = document.getElementById("mapTilesY")?.value;
      settings.renderStyle = document.getElementById("topdownRenderStyle")?.value;
      settings.canvasScale = document.getElementById("canvasScale")?.value;
    } else if (getMode() === "isometric") {
      settings.tilesX = document.getElementById("isoTilesX")?.value;
      settings.tilesY = document.getElementById("isoTilesY")?.value;
      settings.tileWidth = document.getElementById("isoTileWidth")?.value;
      settings.tileHeight = document.getElementById("isoTileHeight")?.value;
    } else if (getMode() === "sidescroller") {
      settings.tilesX = document.getElementById("sideTilesX")?.value;
      settings.tilesY = document.getElementById("sideTilesY")?.value;
      settings.groundRow = document.getElementById("sideGroundRow")?.value;
    }

    return settings;
  }

  function getCanvas() {
    return document.getElementById("canvas");
  }

  function renderCurrentMap() {
    if (typeof generateMap === "function") {
      generateMap();
    } else if (typeof generateMapIfReady === "function") {
      generateMapIfReady();
    }
  }

  function getCanvasDataUrl() {
    var canvas = getCanvas();
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }

})();
