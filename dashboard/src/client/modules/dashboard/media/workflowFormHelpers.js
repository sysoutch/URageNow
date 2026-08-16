function createDashboardWorkflowFormHelpers() {
  function getInputNode(id) {
    return document.getElementById(id);
  }
  function dispatchInputChange(node) {
    node.dispatchEvent(new Event("input", {bubbles: true}));
    node.dispatchEvent(new Event("change", {bubbles: true}));
  }
  function readOptionalNumberInput(id, options) {
    const node = getInputNode(id);
    const raw = node && typeof node.value === "string" ? node.value.trim() : "";
    if (!raw) return undefined;
    const parsed = options?.float === true ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return undefined;
    const min = typeof options?.min === "number" ? options.min : -Number.MAX_SAFE_INTEGER;
    const max = typeof options?.max === "number" ? options.max : Number.MAX_SAFE_INTEGER;
    return Math.min(max, Math.max(min, parsed));
  }
  function readGenerateCount(ids, options) {
    const sourceIds = Array.isArray(ids) ? ids : [ids];
    for (const id of sourceIds) {
      const value = readOptionalNumberInput(id, {min: options?.min || 1, max: options?.max || 8});
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(options?.min || 1, Math.min(options?.max || 8, Math.round(value)));
      }
    }
    return 1;
  }
  function bindMirroredNumberInputs(firstId, secondId) {
    const first = getInputNode(firstId);
    const second = getInputNode(secondId);
    if (!first || !second) return;
    const sync = (source, target) => {
      if (target.value === source.value) return;
      target.value = source.value;
      dispatchInputChange(target);
    };
    first.addEventListener("input", () => sync(first, second));
    second.addEventListener("input", () => sync(second, first));
    first.addEventListener("change", () => sync(first, second));
    second.addEventListener("change", () => sync(second, first));
  }
  function setInputValue(id, value) {
    const node = getInputNode(id);
    if (!node || typeof node.value !== "string") return;
    node.value = String(value);
    dispatchInputChange(node);
  }
  function setCheckboxValue(id, value) {
    const node = getInputNode(id);
    if (!node || typeof node.checked !== "boolean") return;
    node.checked = value === true;
    dispatchInputChange(node);
  }
  function parseResolutionValue(value) {
    const match = String(value || "").trim().match(/^(\d+)x(\d+)$/i);
    if (!match) return null;
    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    return Number.isFinite(width) && Number.isFinite(height) ? {width, height} : null;
  }
  return {
    readOptionalNumberInput,
    readGenerateCount,
    bindMirroredNumberInputs,
    setInputValue,
    setCheckboxValue,
    parseResolutionValue
  };
}
