function valueOrFallback(value, fallback) {
      return value === undefined || value === null || value === "" ? fallback : value;
    }

    function createSeededRandom(seedText) {
      var seed = 2166136261 >>> 0;
      for (var i = 0; i < seedText.length; i++) {
        seed ^= seedText.charCodeAt(i);
        seed = Math.imul(seed, 16777619);
      }
      return function() {
        seed += 0x6D2B79F5;
        var t = seed;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    function beginGenerationRandom() {
      var seedText = generationSeed;
      if (!seedText) {
        generationRandom = Math.random;
        lastGenerationSeedLabel = "random";
        return;
      }
      generationRandom = createSeededRandom(seedText);
      lastGenerationSeedLabel = seedText;
    }

    function randomValue() {
      return generationRandom();
    }

    function setGenerationSeed() {
      generationSeed = readText("generationSeed", "");
      setInputValue("generationSeed", generationSeed);
      generateMapIfReady();
    }

    function randomizeGenerationSeed() {
      generationSeed = String(Date.now());
      setInputValue("generationSeed", generationSeed);
      generateMapIfReady();
    }

    function clearGenerationSeed() {
      generationSeed = "";
      setInputValue("generationSeed", "");
      generateMapIfReady();
    }
