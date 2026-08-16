if (typeof window.registerDashboardThemeSync === "function") {
      window.registerDashboardThemeSync(function(themeName, tokens) {
        var root = document.documentElement;
        root.style.setProperty("--bg", tokens.bg);
        root.style.setProperty("--panel", tokens.surface);
        root.style.setProperty("--panel-soft", tokens.surfaceStrong);
        root.style.setProperty("--panel-strong", tokens.surfaceStrong);
        root.style.setProperty("--text", tokens.text);
        root.style.setProperty("--muted", tokens.muted);
        root.style.setProperty("--accent", tokens.accent);
        root.style.setProperty("--accent-2", tokens.accentStrong);
        root.style.setProperty("--border", tokens.line);
      });
    }
    var background;
    var backgrounds = {};
    var autoGenerateMap = true;
    var autoGenerateMapIntervalInSeconds = 1;
    var groundWidth = 13;
    var groundHeight = 7;
    var mapStartX = 128;
    var mapStartY = 122;
    var mapEndX = 96;
    var mapEndY = 96;
    var mapDirection = "row-right-down";
    var canvasScale = 0.5;
    var exportQuality = 65;
    var placePlayers = true;
    var defaultSpriteWidth = 64;
    var defaultSpriteHeight = 64;
    var autoScaleSprites = true;
    var mirrorPattern = "xy";
    var mirrorRepeatX = 1;
    var mirrorRepeatY = 1;
    var mirrorCenterRowOnce = true;
    var mirrorCenterColOnce = false;
    var currentMap = [];
    var currentItems = [];
    var currentPlayers = [];
    var generationSeed = "";
    var generationRandom = Math.random;
    var lastGenerationSeedLabel = "random";
    var canvas;
    var ctx;
    var generatorMode = "topdown";
    var sideTilesX = 26;
    var sideTilesY = 13;
    var sideStartX = 64;
    var sideStartY = 64;
    var sideEndX = 96;
    var sideEndY = 64;
    var sideDirection = "right-up";
    var sideGroundRow = 4;
    var sideTerrainVariation = 3;
    var sideFloatingPlatforms = 8;
    var sidePlatformMinWidth = 2;
    var sidePlatformMaxWidth = 5;
    var sideFillGround = true;
    var sidePlacePlayers = true;
    var sideRequireEmptyAbove = true;
    var sideMirrorPattern = "none";
    var sideMirrorRepeatX = 0;
    var sideMirrorRepeatY = 0;
    var sideMirrorCenterRowOnce = false;
    var sideMirrorCenterColOnce = false;
    var isoTilesX = 14;
    var isoTilesY = 10;
    var isoStartX = 520;
    var isoStartY = 0;
    var isoEndX = 96;
    var isoEndY = 96;
    var isoDirection = "row-right-down";
    var isoTileWidth = 96;
    var isoTileHeight = 48;
    var isoBlockHeight = 34;
    var isoFillPercent = 92;
    var isoExportQuality = 70;
    var isoPlacePlayers = true;
    var isoRaisedEdges = true;
    var isoMirrorPattern = "none";
    var isoMirrorRepeatX = 0;
    var isoMirrorRepeatY = 0;
    var isoMirrorCenterRowOnce = false;
    var isoMirrorCenterColOnce = false;
    var topdownPlayerCount = 1;
    var sidePlayerCount = 1;
    var isoPlayerCount = 1;
    var canvasBaseWidth = 960;
    var canvasBaseHeight = 540;
    var canvasPadding = 96;
    var isoRenderStartX = 0;
    var isoRenderStartY = 0;
    var defaultMapGeneratorCatalog = window.MapGeneratorCatalog ? window.MapGeneratorCatalog.readDefaultCatalog() : { sprites: [], playerMarker: null };
    if (window.MapGeneratorCatalog) {
      window.MapGeneratorCatalog.ensureCatalogAssets(defaultMapGeneratorCatalog.sprites, defaultMapGeneratorCatalog.playerMarker);
    }
    var spriteTypes = window.MapGeneratorCatalog ? window.MapGeneratorCatalog.buildSpriteTypes(defaultMapGeneratorCatalog.sprites) : [];
    var playerMarkerConfig = window.MapGeneratorCatalog ? window.MapGeneratorCatalog.buildPlayerMarker(defaultMapGeneratorCatalog.playerMarker) : null;
    window.spriteTypes = spriteTypes;
    window.playerMarkerConfig = playerMarkerConfig;

    window.onload = function() {
      canvas = document.getElementById("canvas");
      ctx = canvas.getContext("2d");
      setCanvasScale();

      setupSpriteUploads();
      initSidebarSections();
      renderSpriteSettings();
      if (window.MapGeneratorStarterLibraries) {
        window.MapGeneratorStarterLibraries.render("starterAssetLibraryList");
      }

      document.getElementById("autoGenerateMapIntervalId").addEventListener("change", setAutoGenerateMapInterval);
      document.getElementById("importGeneratorSetupInput").addEventListener("change", importGeneratorSetupFromFile);
      setDefaultSpriteSize();
      setAutoScaleSprites();
      setGenerationSeed();
      setMirrorOptions();
      setGeneratorOptions();
      setSidescrollerOptions();
      setIsometricOptions();
      if (window.ThreeQuarterMapGenerator) {
        window.ThreeQuarterMapGenerator.setOptions(false);
      }
      setGeneratorMode("topdown");
      setupCanvasDragPan();

      setModeBackgroundSource("topdown", "images/bg.png", generateMapIfReady);
      setModeBackgroundSource("threequarter", "images/bg.png", generateMapIfReady);
      setModeBackgroundSource("isometric", "images/bg.png", generateMapIfReady);
      setModeBackgroundSource("sidescroller", "images/bg.png", generateMapIfReady);
    };
