(function() {
  "use strict";

  function getMapFileName(extension) {
    if (typeof buildMapExportName === "function") {
      return buildMapExportName(extension);
    }
    var mode = typeof generatorMode === "string" && generatorMode ? generatorMode : "map";
    return "map-" + mode + extension;
  }

  function buildGeneratedMapPayload() {
    if (!window.MapGeneratorExport || typeof window.MapGeneratorExport.buildPayload !== "function") {
      return null;
    }
    return window.MapGeneratorExport.buildPayload({
      generatorMode: typeof generatorMode !== "undefined" ? generatorMode : "topdown",
      lastGenerationSeedLabel: typeof lastGenerationSeedLabel !== "undefined" ? lastGenerationSeedLabel : "random",
      currentMap: typeof currentMap !== "undefined" ? currentMap : [],
      currentItems: typeof currentItems !== "undefined" ? currentItems : [],
      currentPlayers: typeof currentPlayers !== "undefined" ? currentPlayers : [],
      spriteTypes: typeof spriteTypes !== "undefined" ? spriteTypes : [],
      setupPayload: typeof buildSetupPayload === "function" ? buildSetupPayload() : null
    });
  }

  function buildCanvasDescriptor() {
    if (typeof canvas === "undefined" || !canvas || !canvas.width || !canvas.height) {
      return null;
    }
    try {
      var dataUrl = canvas.toDataURL("image/png");
      return {
        kind: "image",
        title: "Generated 2D Map PNG",
        fileName: getMapFileName(".png"),
        mimeType: "image/png",
        dataUrl: dataUrl,
        width: canvas.width,
        height: canvas.height,
        previewKind: "image",
        previewUrl: dataUrl,
        sourceDetail: "Rendered PNG from the 2D Map Generator.",
        metadata: {
          sourceTool: "map-generator",
          generatorMode: typeof generatorMode !== "undefined" ? generatorMode : ""
        }
      };
    } catch (_) {
      return null;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = function() { reject(reader.error || new Error("Failed to read blob.")); };
      reader.readAsDataURL(blob);
    });
  }

  function buildZipDescriptor() {
    if (typeof window.buildMapZipBlob !== "function") {
      return Promise.resolve(null);
    }
    return window.buildMapZipBlob().then(function(result) {
      if (!result || !result.blob) return null;
      return blobToDataUrl(result.blob).then(function(dataUrl) {
        return {
          kind: "file",
          title: "2D Map Generator ZIP",
          fileName: result.fileName || getMapFileName(".zip"),
          mimeType: "application/zip",
          dataUrl: dataUrl,
          previewKind: "file",
          sourceDetail: "Complete 2D map package with JSON, preview image, settings, and sprites.",
          metadata: {
            sourceTool: "map-generator",
            resourceFormat: "map-generator-zip",
            generatorMode: typeof generatorMode !== "undefined" ? generatorMode : ""
          }
        };
      });
    });
  }

  function buildJsonDescriptor(title, fileName, payload, format) {
    if (!payload) {
      return null;
    }
    var text = JSON.stringify(payload, null, 2);
    return {
      kind: "text",
      title: title,
      fileName: fileName,
      mimeType: "application/json",
      textContent: text,
      previewKind: "text",
      previewText: text,
      sourceDetail: title + " from the 2D Map Generator.",
      metadata: {
        sourceTool: "map-generator",
        resourceFormat: format,
        generatorMode: typeof generatorMode !== "undefined" ? generatorMode : ""
      }
    };
  }

  function describeCurrentAssets() {
    var descriptors = [];
    var canvasDescriptor = buildCanvasDescriptor();
    var generatedMapPayload = buildGeneratedMapPayload();
    var setupPayload = typeof buildSetupPayload === "function" ? buildSetupPayload() : null;
    if (canvasDescriptor) {
      descriptors.push(canvasDescriptor);
    }
    var mapDescriptor = buildJsonDescriptor("Generated 2D Map JSON", getMapFileName(".json"), generatedMapPayload, "map-generator-json");
    var setupDescriptor = buildJsonDescriptor("2D Map Generator Setup JSON", "map-generator-setup.json", setupPayload, "map-generator-setup-json");
    if (mapDescriptor) {
      descriptors.push(mapDescriptor);
    }
    if (setupDescriptor) {
      descriptors.push(setupDescriptor);
    }
    return buildZipDescriptor().then(function(zipDescriptor) {
      if (zipDescriptor) {
        descriptors.push(zipDescriptor);
      }
      return descriptors;
    }).catch(function(error) {
      console.warn("[MapGenerator 2D] Could not describe ZIP output.", error);
      return descriptors;
    });
  }

  if (typeof window.registerDashboardToolBridge === "function") {
    window.registerDashboardToolBridge({
      onDescribeCurrentAssets: describeCurrentAssets,
      onExportImage: function() {
        var descriptor = buildCanvasDescriptor();
        return descriptor ? {
          fileName: descriptor.fileName,
          mimeType: descriptor.mimeType,
          dataUrl: descriptor.dataUrl,
          width: descriptor.width,
          height: descriptor.height
        } : null;
      }
    });
  } else {
    window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
    window.__urageToolDescribeCurrentAsset = function() {
      return describeCurrentAssets().then(function(descriptors) { return descriptors[0] || null; });
    };
  }
})();
