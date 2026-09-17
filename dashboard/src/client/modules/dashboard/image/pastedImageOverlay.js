function createDashboardPastedImageOverlay(input) {
  const state = input?.state && typeof input.state === "object" ? input.state : {};
  const request = typeof input?.request === "function"
    ? input.request
    : async function requestFallback() {
      throw new Error("Dashboard request helper is not available.");
    };
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const buildAbsoluteDashboardUrl = typeof input?.buildAbsoluteDashboardUrl === "function"
    ? input.buildAbsoluteDashboardUrl
    : value => String(value || "");
  const getGeneratedImageFileUrl = typeof input?.getGeneratedImageFileUrl === "function"
    ? input.getGeneratedImageFileUrl
    : () => "";
  const readFileAsDataUrl = typeof input?.readFileAsDataUrl === "function"
    ? input.readFileAsDataUrl
    : async function readFileAsDataUrlFallback() {
      throw new Error("Clipboard image reader is not available.");
    };
  const onUseAsSource = typeof input?.onUseAsSource === "function" ? input.onUseAsSource : null;
  const onImportedToHistory = typeof input?.onImportedToHistory === "function"
    ? input.onImportedToHistory
    : async function onImportedToHistoryFallback() {};
  const refreshEditSourcePoolOptions = typeof input?.refreshEditSourcePoolOptions === "function"
    ? input.refreshEditSourcePoolOptions
    : () => {};

  let overlayRoot = null;
  let previewNode = null;
  let hintNode = null;
  let sourceRadio = null;
  let importRadio = null;
  let poolRowNode = null;
  let poolCheckbox = null;
  let poolSelect = null;
  let statusNode = null;
  let confirmNode = null;
  let pendingFiles = [];
  let pendingDataUrls = [];
  let busy = false;

  function createRadioOption(value, label) {
    const optionLabel = document.createElement("label");
    optionLabel.className = "pasted-image-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "pasted-image-overlay-action";
    radio.value = value;
    if (value === "source") {
      radio.checked = true;
    }
    optionLabel.appendChild(radio);
    const text = document.createElement("span");
    text.textContent = label;
    optionLabel.appendChild(text);
    return {optionLabel, radio};
  }

  function buildOverlay() {
    const root = document.createElement("div");
    root.id = "pasted-image-overlay";
    root.className = "pasted-image-overlay hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "pasted-image-overlay-title");

    const panel = document.createElement("div");
    panel.className = "pasted-image-panel";
    panel.tabIndex = -1;

    const head = document.createElement("div");
    head.className = "pasted-image-head";
    const title = document.createElement("h4");
    title.id = "pasted-image-overlay-title";
    title.textContent = "Pasted image";
    const closeNode = document.createElement("span");
    closeNode.className = "pasted-image-close";
    closeNode.textContent = "x";
    closeNode.setAttribute("role", "button");
    closeNode.setAttribute("tabindex", "0");
    closeNode.title = "Cancel paste action";
    head.appendChild(title);
    head.appendChild(closeNode);

    const body = document.createElement("div");
    body.className = "pasted-image-body";
    previewNode = document.createElement("img");
    previewNode.id = "pasted-image-overlay-preview";
    previewNode.className = "pasted-image-preview";
    previewNode.alt = "Pasted image preview";
    hintNode = document.createElement("p");
    hintNode.id = "pasted-image-overlay-hint";
    hintNode.className = "hint pasted-image-hint";

    const options = document.createElement("div");
    options.className = "pasted-image-options";
    const sourceOption = createRadioOption("source", "Use as the edit source image in Image Studio");
    const importOption = createRadioOption("import", "Import into the dashboard (Recent Images)");
    sourceRadio = sourceOption.radio;
    importRadio = importOption.radio;
    options.appendChild(sourceOption.optionLabel);
    options.appendChild(importOption.optionLabel);

    poolRowNode = document.createElement("div");
    poolRowNode.className = "pasted-image-pool-row hidden";
    const poolLabel = document.createElement("label");
    poolLabel.className = "pasted-image-pool-label";
    poolCheckbox = document.createElement("input");
    poolCheckbox.type = "checkbox";
    poolCheckbox.id = "pasted-image-overlay-pool-enabled";
    poolLabel.appendChild(poolCheckbox);
    const poolLabelText = document.createElement("span");
    poolLabelText.textContent = "Also add to an image pool";
    poolLabel.appendChild(poolLabelText);
    poolSelect = document.createElement("select");
    poolSelect.id = "pasted-image-overlay-pool-select";
    poolSelect.className = "pasted-image-pool-select";
    poolRowNode.appendChild(poolLabel);
    poolRowNode.appendChild(poolSelect);

    statusNode = document.createElement("div");
    statusNode.id = "pasted-image-overlay-status";
    statusNode.className = "hint pasted-image-status hidden";

    body.appendChild(previewNode);
    body.appendChild(hintNode);
    body.appendChild(options);
    body.appendChild(poolRowNode);
    body.appendChild(statusNode);

    const foot = document.createElement("div");
    foot.className = "pasted-image-foot";
    const cancelNode = document.createElement("button");
    cancelNode.type = "button";
    cancelNode.className = "secondary";
    cancelNode.textContent = "Cancel";
    confirmNode = document.createElement("button");
    confirmNode.type = "button";
    confirmNode.id = "pasted-image-overlay-confirm-button";
    confirmNode.textContent = "Continue";
    foot.appendChild(cancelNode);
    foot.appendChild(confirmNode);

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    root.appendChild(panel);

    cancelNode.addEventListener("click", () => close());
    confirmNode.addEventListener("click", handleConfirm);
    sourceRadio.addEventListener("change", syncPoolRowVisibility);
    importRadio.addEventListener("change", syncPoolRowVisibility);
    closeNode.addEventListener("click", () => close());
    closeNode.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        close();
      }
    });
    root.addEventListener("click", event => {
      if (event.target === root) close();
    });

    document.body.appendChild(root);
    overlayRoot = root;
  }

  function ensureOverlay() {
    if (!overlayRoot) buildOverlay();
    return overlayRoot;
  }

  function isVisible() {
    return Boolean(overlayRoot && !overlayRoot.classList.contains("hidden"));
  }

  function getImagePools() {
    return Array.isArray(state.imagePools) ? state.imagePools : [];
  }

  function renderPoolOptions(preferredId) {
    const pools = getImagePools();
    while (poolSelect.children.length > 0) poolSelect.removeChild(poolSelect.children[0]);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No image pool selected";
    poolSelect.appendChild(emptyOption);
    pools.forEach(pool => {
      const option = document.createElement("option");
      option.value = String(pool.id || "");
      option.textContent = `${String(pool.name || "Image pool")} (${Array.isArray(pool.images) ? pool.images.length : 0})`;
      poolSelect.appendChild(option);
    });
    const preferred = String(preferredId || "").trim();
    poolSelect.value = pools.some(pool => pool.id === preferred) ? preferred : "";
  }

  function getDefaultPoolId() {
    const pools = getImagePools();
    const studioSelect = document.getElementById("imagegen-image-pool-select");
    for (const candidate of [studioSelect?.value, state.selectedImagePoolId]) {
      const poolId = String(candidate || "").trim();
      if (poolId && pools.some(pool => pool.id === poolId)) return poolId;
    }
    return "";
  }

  function syncPoolRowVisibility() {
    poolRowNode.classList.toggle("hidden", importRadio.checked !== true);
  }

  function setStatus(message, isError) {
    statusNode.textContent = String(message || "");
    statusNode.classList.toggle("error", isError === true);
    statusNode.classList.toggle("hidden", !String(message || ""));
  }

  function getPoolSourceForImportedRecord(record) {
    if (!record || typeof record !== "object") return "";
    const fromUrl = typeof record.imageUrl === "string" ? record.imageUrl.trim() : "";
    if (fromUrl) return buildAbsoluteDashboardUrl(fromUrl);
    if (record.id && record.imageFileName) {
      return buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(record.id, record.imageFileName));
    }
    return "";
  }

  function syncSavedPool(saved) {
    const pools = getImagePools();
    const savedId = String(saved?.id || "").trim();
    if (!savedId) return;
    const index = pools.findIndex(pool => pool && String(pool.id).trim() === savedId);
    if (index >= 0) pools[index] = saved;
    else pools.push(saved);
  }

  async function addImportedImagesToPool(records, poolId) {
    const pools = getImagePools();
    const normalizedPoolId = String(poolId || "").trim();
    const pool = pools.find(candidate => candidate && String(candidate.id).trim() === normalizedPoolId);
    if (!pool) throw new Error("Select a valid image pool first.");
    const existingSources = (Array.isArray(pool.images) ? pool.images : [])
      .map(entry => String(entry || "").trim())
      .filter(Boolean);
    const seenSources = new Set(existingSources);
    const newSources = [];
    for (const record of records) {
      const source = getPoolSourceForImportedRecord(record);
      if (!source || seenSources.has(source)) continue;
      seenSources.add(source);
      newSources.push(source);
    }
    if (!newSources.length) return {added: 0, poolName: String(pool.name || "image pool")};
    const saved = await request("/api/image-pools", {
      id: pool.id,
      name: String(pool.name || "").trim() || "Image pool",
      images: [...existingSources, ...newSources]
    });
    syncSavedPool(saved && typeof saved === "object" ? saved : {...pool, images: [...existingSources, ...newSources]});
    renderPoolOptions(String((saved && saved.id) || normalizedPoolId));
    await refreshEditSourcePoolOptions();
    return {added: newSources.length, poolName: String((saved && saved.name) || pool.name || "image pool")};
  }

  async function handleConfirm() {
    if (busy || !isVisible()) return;
    const files = pendingFiles.slice();
    const dataUrls = pendingDataUrls.slice();
    if (!files.length) return close();
    const useImport = importRadio.checked === true;
    if (!useImport) {
      if (!onUseAsSource) return void setStatus("The Image Studio edit source workspace is not available.", true);
      busy = true;
      confirmNode.disabled = true;
      try {
        await onUseAsSource(files);
        setOutput(`Used ${files.length} pasted image${files.length === 1 ? "" : "s"} as the Image Studio edit source.`);
        close();
      } catch (error) {
        setStatus("Could not use the pasted image as a source: " + (error?.message || "Unknown error"), true);
      } finally {
        busy = false;
        if (isVisible()) confirmNode.disabled = false;
      }
      return;
    }
    const poolId = String(poolSelect.value || "").trim();
    if (poolCheckbox.checked === true && !poolId) {
      return void setStatus("Choose an image pool for the imported image, or uncheck the pool option.", true);
    }
    busy = true;
    confirmNode.disabled = true;
    setStatus(`Importing ${files.length} image${files.length === 1 ? "" : "s"} into the dashboard...`, false);
    try {
      const importedRecords = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const dataUrl = String(dataUrls[index] || "");
        if (!dataUrl.startsWith("data:image/")) throw new Error("The pasted image could not be read from the clipboard.");
        const fileName = String(file.name || "").trim()
          || `pasted-image-${Date.now()}${files.length > 1 ? "-" + (index + 1) : ""}.png`;
        const imported = await request("/api/image-import", {dataUrl, fileName, prompt: "Pasted from clipboard"});
        if (!imported?.id) throw new Error("Image import did not return a record.");
        importedRecords.push(imported);
      }
      await onImportedToHistory(importedRecords.at(-1));
      let poolSummary = "";
      if (poolCheckbox.checked === true && poolId) {
        const poolResult = await addImportedImagesToPool(importedRecords, poolId);
        if (poolResult.added > 0) {
          poolSummary = ` Added ${poolResult.added} image${poolResult.added === 1 ? "" : "s"} to pool ${poolResult.poolName}.`;
        }
      }
      setOutput(`Imported ${importedRecords.length} image${importedRecords.length === 1 ? "" : "s"} into Recent Images.${poolSummary}`);
      close();
    } catch (error) {
      setStatus("Image import failed: " + (error?.message || "Unknown error"), true);
      busy = false;
      confirmNode.disabled = false;
    }
  }

  async function show(files) {
    const images = Array.from(files || []).filter(file => file && String(file.type || "").startsWith("image/"));
    if (!images.length) return false;
    ensureOverlay();
    pendingFiles = images;
    pendingDataUrls = await Promise.all(images.map(async (file, index) => {
      const dataUrl = await readFileAsDataUrl(file);
      const normalized = String(dataUrl || "");
      if (!normalized.startsWith("data:image/")) throw new Error(`Pasted image ${index + 1} could not be read from the clipboard.`);
      return normalized;
    }));
    previewNode.src = pendingDataUrls[0];
    hintNode.textContent = images.length === 1
      ? `1 image pasted from the clipboard: ${String(images[0].name || "").trim() || "clipboard-image.png"}`
      : `${images.length} images pasted from the clipboard.`;
    sourceRadio.checked = true;
    importRadio.checked = false;
    poolCheckbox.checked = false;
    syncPoolRowVisibility();
    renderPoolOptions(getDefaultPoolId());
    setStatus("", false);
    busy = false;
    confirmNode.disabled = false;
    overlayRoot.classList.remove("hidden");
    if (typeof confirmNode.focus === "function") confirmNode.focus();
    return true;
  }

  function close() {
    if (!overlayRoot) return;
    overlayRoot.classList.add("hidden");
    pendingFiles = [];
    pendingDataUrls = [];
    busy = false;
    if (confirmNode) confirmNode.disabled = false;
  }

  document.addEventListener("keydown", event => {
    if (!isVisible()) return;
    const tag = String(event.target?.tagName || "").toUpperCase();
    if (event.key === "Escape") {
      event.preventDefault?.();
      close();
      return;
    }
    if (event.key !== "Enter") return;
    if (tag === "BUTTON" || tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" || tag === "A") return;
    event.preventDefault?.();
    handleConfirm();
  });

  return {show, close};
}
