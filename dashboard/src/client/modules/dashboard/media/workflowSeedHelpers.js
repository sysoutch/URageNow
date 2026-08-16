function createDashboardWorkflowSeedHelpers(input) {
  const options = input && typeof input === "object" ? input : {};
  const seedMax = typeof options.seedMax === "number" ? options.seedMax : 0xffffffffffff;
  function createRandomSeed() {
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const values = new Uint8Array(6);
      globalThis.crypto.getRandomValues(values);
      return values.reduce((seed, value) => (seed * 256) + value, 0);
    }
    return Math.floor(Math.random() * seedMax);
  }
  function normalizeSeed(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.max(0, Math.min(seedMax, Math.round(numeric)));
  }
  function getInputNode(id) {
    const node = document.getElementById(id);
    return node && typeof node.value === "string" ? node : null;
  }
  function setSeedInputs(ids, seed) {
    const normalized = normalizeSeed(seed);
    if (normalized === null) {
      return;
    }
    ids.forEach(id => {
      const node = getInputNode(id);
      if (!node) {
        return;
      }
      node.value = String(normalized);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  function readSeed(ids) {
    const sourceIds = Array.isArray(ids) ? ids : [ids];
    for (const id of sourceIds) {
      const node = getInputNode(id);
      const seed = normalizeSeed(node && node.value.trim() ? node.value : NaN);
      if (seed !== null) {
        setSeedInputs(sourceIds, seed);
        return seed;
      }
    }
    const seed = createRandomSeed();
    setSeedInputs(sourceIds, seed);
    return seed;
  }
  function readControlMode(controlId) {
    const mode = String(document.getElementById(controlId)?.value || "randomize").trim();
    return ["fixed", "increase", "decrease", "randomize"].includes(mode) ? mode : "randomize";
  }
  function applyControlAfterGenerate(ids, controlId, usedSeed) {
    const seed = normalizeSeed(usedSeed);
    if (seed === null) {
      return;
    }
    const mode = readControlMode(controlId);
    const nextSeed = mode === "increase"
      ? Math.min(seedMax, seed + 1)
      : mode === "decrease"
        ? Math.max(0, seed - 1)
        : mode === "randomize"
          ? createRandomSeed()
          : seed;
    setSeedInputs(Array.isArray(ids) ? ids : [ids], nextSeed);
  }
  function syncControl(sourceId, targetId) {
    const source = getInputNode(sourceId);
    const target = getInputNode(targetId);
    if (!source || !target) {
      return;
    }
    const sync = (from, to) => {
      if (to.value !== from.value) {
        to.value = from.value;
      }
    };
    source.addEventListener("change", () => sync(source, target));
    target.addEventListener("change", () => sync(target, source));
    sync(source, target);
  }
  function syncInputs(sourceId, targetId) {
    const source = getInputNode(sourceId);
    const target = getInputNode(targetId);
    if (!source || !target) {
      return;
    }
    const sync = (from, to) => {
      const seed = normalizeSeed(from.value);
      const nextValue = seed === null ? "" : String(seed);
      if (to.value !== nextValue) {
        to.value = nextValue;
      }
    };
    source.addEventListener("change", () => sync(source, target));
    target.addEventListener("change", () => sync(target, source));
  }
  return {
    createRandomSeed,
    normalizeSeed,
    setSeedInputs,
    readSeed,
    readControlMode,
    applyControlAfterGenerate,
    syncControl,
    syncInputs
  };
}
