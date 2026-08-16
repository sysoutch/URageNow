function createDashboardImageEditSourceWorkspace(input) {
  const state = {items: [], activeId: ""};
  const getElementById = typeof input?.getElementById === "function"
    ? input.getElementById
    : id => document.getElementById(id);
  let draggedSourceId = "";

  function getActive() {
    return state.items.find(item => item.id === state.activeId) || state.items[0] || null;
  }

  function isBatchEnabled() {
    return getElementById("image-edit-batch-enabled")?.checked === true;
  }

  function getExecutionSources() {
    if (!isBatchEnabled()) {
      const activeSource = getActive();
      return activeSource ? [activeSource] : [];
    }
    return state.items.filter(item => item.batchState?.selected !== false);
  }

  function getPreviewUrl(source) {
    const normalized = String(source || "").trim();
    if (!normalized) return "";
    if (/^data:image\//i.test(normalized) || /^https?:\/\//i.test(normalized)) return normalized;
    if (/^\/api\//i.test(normalized)) return input.buildAbsoluteDashboardUrl(normalized);
    return typeof input.resolveImagePoolPreviewUrl === "function"
      ? input.resolveImagePoolPreviewUrl(normalized) || ""
      : "";
  }

  function getSourceName(value, fallback) {
    const source = String(value || "").trim();
    if (!source) return String(fallback || "").trim();
    if (/^data:image\//i.test(source)) {
      return String(fallback || "clipboard-image.png").trim() || "clipboard-image.png";
    }
    const parts = source.replace(/[?#].*$/, "").split(/[\\/]/).filter(Boolean);
    return parts.at(-1) || String(fallback || "source-image").trim() || "source-image";
  }

  function createEntry(nextSource) {
    const value = String(nextSource?.value || "").trim();
    if (!value) return null;
    const fileNameHint = getSourceName(value, nextSource?.fileNameHint || nextSource?.label || "");
    const existingState = nextSource?.batchState && typeof nextSource.batchState === "object"
      ? nextSource.batchState
      : null;
    return {
      id: String(nextSource?.id || input.createId("image-edit-source")).trim(),
      value,
      previewUrl: String(nextSource?.previewUrl || "").trim() || getPreviewUrl(value),
      fileNameHint,
      label: String(nextSource?.label || fileNameHint || "Selected source image").trim(),
      detail: String(nextSource?.detail || value).trim(),
      batchState: existingState
        ? {
            selected: existingState.selected !== false,
            runState: String(existingState.runState || "idle").trim() || "idle",
            runMessage: String(existingState.runMessage || "").trim()
          }
        : input.createBatchItemState()
    };
  }

  function syncSourceInput() {
    const active = getActive();
    const urlInput = getElementById("image-edit-source-url");
    if (urlInput && typeof urlInput.value === "string") {
      urlInput.value = active && !/^data:image\//i.test(active.value) ? active.value : "";
    }
  }

  function addSources(entries, options = {}) {
    const nextEntries = Array.isArray(entries) ? entries.map(createEntry).filter(Boolean) : [];
    if (options.replace === true) {
      state.items = [];
      state.activeId = "";
    }
    for (const entry of nextEntries) {
      if (!state.items.some(existing => existing.value === entry.value)) state.items.push(entry);
    }
    if (!state.activeId && state.items[0]) state.activeId = state.items[0].id;
    if (options.makeActiveId && state.items.some(item => item.id === options.makeActiveId)) {
      state.activeId = String(options.makeActiveId).trim();
    }
    syncSourceInput();
    render();
  }

  function setActive(sourceId) {
    const normalizedId = String(sourceId || "").trim();
    if (!state.items.some(item => item.id === normalizedId)) return;
    state.activeId = normalizedId;
    syncSourceInput();
    render();
  }

  function moveSource(draggedId, targetId) {
    const nextItems = input.moveListEntryById(state.items, draggedId, targetId);
    if (!nextItems) return;
    state.items = nextItems;
    syncSourceInput();
    render();
  }

  function removeSource(sourceId) {
    const normalizedId = String(sourceId || "").trim();
    state.items = state.items.filter(item => item.id !== normalizedId);
    if (state.activeId === normalizedId) state.activeId = state.items[0]?.id || "";
    syncSourceInput();
    render();
  }

  function clear() {
    state.items = [];
    state.activeId = "";
    const fileInput = getElementById("image-edit-source-file");
    const urlInput = getElementById("image-edit-source-url");
    if (fileInput) fileInput.value = "";
    if (urlInput && typeof urlInput.value === "string") urlInput.value = "";
    render();
  }

  function setSelection(sourceId, selected) {
    const entry = state.items.find(item => item.id === String(sourceId || "").trim());
    if (!entry) return;
    entry.batchState ||= input.createBatchItemState();
    entry.batchState.selected = selected === true;
    render();
  }

  function setAllSelections(selected) {
    state.items.forEach(entry => {
      entry.batchState ||= input.createBatchItemState();
      entry.batchState.selected = selected === true;
    });
    render();
  }

  function updateRunState(sourceId, runState, runMessage) {
    const entry = state.items.find(item => item.id === String(sourceId || "").trim());
    if (!entry) return;
    entry.batchState ||= input.createBatchItemState();
    entry.batchState.runState = String(runState || "idle").trim() || "idle";
    entry.batchState.runMessage = String(runMessage || "").trim();
    render();
  }

  function resetRunStates() {
    state.items.forEach(entry => {
      entry.batchState ||= input.createBatchItemState();
      entry.batchState.runState = "idle";
      entry.batchState.runMessage = "";
    });
    render();
  }

  function renderSourceList(list) {
    input.clearChildren(list);
    if (!state.items.length) {
      const empty = document.createElement("div");
      empty.className = "image-edit-source-selection-empty";
      empty.textContent = "No uploaded or selected source images yet.";
      list.appendChild(empty);
      return;
    }
    for (const entry of state.items) {
      const item = document.createElement("div");
      item.className = "image-edit-source-selection-item" + (entry.id === state.activeId ? " active" : "");
      input.bindSortableItem(item, list, {
        entryId: entry.id,
        getDraggedId: () => draggedSourceId,
        setDraggedId: value => { draggedSourceId = value; },
        onMove: moveSource
      });
      const batchState = entry.batchState || input.createBatchItemState();
      const thumb = entry.previewUrl
        ? `<img class="image-edit-source-selection-thumb" src="${input.escapeHtml(entry.previewUrl)}" alt="${input.escapeHtml(entry.label || entry.fileNameHint || "Source image")}">`
        : `<div class="image-edit-source-selection-thumb image-edit-source-selection-thumb-fallback">IMG</div>`;
      const stateClass = batchState.runState && batchState.runState !== "idle"
        ? " image-edit-source-selection-state-" + input.escapeHtml(batchState.runState)
        : "";
      const stateLabel = batchState.runState === "success"
        ? "Done"
        : batchState.runState === "error"
          ? "Failed"
          : batchState.runState === "running" ? "Running" : "Idle";
      item.innerHTML = thumb
        + "<div class='image-edit-source-selection-body'>"
        + "<div class='image-edit-source-selection-topline'>"
        + "<label class='image-edit-source-selection-checkbox'><input data-image-edit-source-selected='" + input.escapeHtml(entry.id) + "' type='checkbox'" + (batchState.selected !== false ? " checked" : "") + "><span>Run</span></label>"
        + "<span class='image-edit-source-selection-state" + stateClass + "'>" + stateLabel + "</span>"
        + "</div>"
        + "<div class='image-edit-source-selection-name'>" + input.escapeHtml(entry.label || entry.fileNameHint || "Source image") + "</div>"
        + "<div class='image-edit-source-selection-detail'>" + input.escapeHtml(entry.detail || entry.value) + "</div>"
        + (batchState.runMessage ? "<div class='image-edit-source-selection-run-message'>" + input.escapeHtml(batchState.runMessage) + "</div>" : "")
        + "</div>"
        + "<div class='image-edit-source-selection-actions'>"
        + "<button class='secondary mini-button' data-image-edit-source-use='" + input.escapeHtml(entry.id) + "' type='button'>Use</button>"
        + "<button class='secondary mini-button' data-image-edit-source-remove='" + input.escapeHtml(entry.id) + "' type='button'>Remove</button>"
        + "</div>";
      list.appendChild(item);
    }
    list.querySelectorAll("[data-image-edit-source-selected]").forEach(checkbox => {
      checkbox.addEventListener("change", () => setSelection(
        checkbox.getAttribute("data-image-edit-source-selected") || "",
        checkbox.checked === true
      ));
    });
    list.querySelectorAll("[data-image-edit-source-use]").forEach(button => {
      button.addEventListener("click", () => setActive(button.getAttribute("data-image-edit-source-use") || ""));
    });
    list.querySelectorAll("[data-image-edit-source-remove]").forEach(button => {
      button.addEventListener("click", () => removeSource(button.getAttribute("data-image-edit-source-remove") || ""));
    });
  }

  function render() {
    const active = getActive();
    const hasSource = Boolean(active?.value);
    const empty = getElementById("image-edit-source-preview-empty");
    const name = getElementById("image-edit-source-preview-name");
    const detail = getElementById("image-edit-source-preview-detail");
    if (empty) {
      empty.classList.toggle("hidden", hasSource);
      empty.textContent = hasSource ? "This source is active in the main preview above." : "No source image selected.";
    }
    if (name) name.textContent = hasSource ? active.label || active.fileNameHint || "Selected source image" : "Waiting for source image.";
    if (detail) detail.textContent = hasSource ? active.detail || active.value : "Pick a source from upload, paste, URL, or image pool.";
    const batchControls = getElementById("image-edit-batch-controls");
    if (batchControls) batchControls.classList.toggle("hidden", !isBatchEnabled() || state.items.length === 0);
    const list = getElementById("image-edit-source-selection-list");
    if (list) renderSourceList(list);
    input.syncPreviewTarget();
  }

  function describePoolSource(source, index) {
    const name = getSourceName(source, "");
    return `${index + 1}. ${name || "Pool image"}`;
  }

  function refreshPoolImageOptions() {
    const poolSelect = getElementById("image-edit-source-pool-select");
    const imageSelect = getElementById("image-edit-source-pool-image-select");
    if (!poolSelect || !imageSelect) return;
    const pool = input.getImagePoolById(String(poolSelect.value || "").trim());
    const previousSource = String(imageSelect.value || "").trim();
    input.clearChildren(imageSelect);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = pool?.images?.length ? "Select pool image" : "No images in this pool";
    imageSelect.appendChild(emptyOption);
    if (!Array.isArray(pool?.images)) return;
    pool.images.forEach((source, index) => {
      const option = document.createElement("option");
      option.value = String(source || "").trim();
      option.textContent = describePoolSource(source, index);
      imageSelect.appendChild(option);
    });
    imageSelect.value = pool.images.some(source => String(source || "").trim() === previousSource) ? previousSource : "";
  }

  function refreshOptions() {
    const poolSelect = getElementById("image-edit-source-pool-select");
    const imageSelect = getElementById("image-edit-source-pool-image-select");
    if (!poolSelect || !imageSelect) return;
    const previousPoolId = String(poolSelect.value || "").trim();
    const pools = Array.isArray(input.appState.imagePools) ? input.appState.imagePools : [];
    input.clearChildren(poolSelect);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No image pool selected";
    poolSelect.appendChild(emptyOption);
    pools.forEach(pool => {
      const option = document.createElement("option");
      option.value = pool.id;
      option.textContent = `${pool.name} (${Array.isArray(pool.images) ? pool.images.length : 0})`;
      poolSelect.appendChild(option);
    });
    poolSelect.value = pools.some(pool => pool.id === previousPoolId) ? previousPoolId : pools[0]?.id || "";
    refreshPoolImageOptions();
  }

  async function addFiles(files) {
    const images = Array.from(files || []).filter(file => file && String(file.type || "").startsWith("image/"));
    if (!images.length) throw new Error("Please choose one or more image files.");
    const entries = [];
    for (const file of images) {
      const dataUrl = await input.readFileAsDataUrl(file);
      entries.push(createEntry({
        value: dataUrl,
        previewUrl: dataUrl,
        fileNameHint: file.name || "source-image.png",
        label: file.name || "Uploaded source image",
        detail: "Uploaded from disk"
      }));
    }
    addSources(entries, {makeActiveId: entries[0]?.id || ""});
  }

  function addUrl(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) throw new Error("Provide a source URL or local path first.");
    addSources([{
      value,
      previewUrl: getPreviewUrl(value),
      fileNameHint: getSourceName(value, "source-image"),
      label: getSourceName(value, "Source image"),
      detail: /^https?:\/\//i.test(value) ? "Loaded from URL" : /^data:image\//i.test(value) ? "Loaded from data URL" : "Loaded from path"
    }]);
  }

  function addPoolSelection() {
    const poolId = String(getElementById("image-edit-source-pool-select")?.value || "").trim();
    const source = String(getElementById("image-edit-source-pool-image-select")?.value || "").trim();
    if (!poolId) throw new Error("Select an image pool first.");
    if (!source) throw new Error("Select an image from the chosen pool first.");
    const poolName = String(input.getImagePoolById(poolId)?.name || "Image pool").trim() || "Image pool";
    addSources([{
      value: source,
      previewUrl: getPreviewUrl(source),
      fileNameHint: getSourceName(source, "pool-image"),
      label: getSourceName(source, "Pool image"),
      detail: "Loaded from pool: " + poolName
    }]);
  }

  async function handlePaste(event) {
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    for (const item of clipboardItems) {
      const file = item.kind === "file" ? item.getAsFile() : null;
      if (!file || !String(file.type || "").startsWith("image/")) continue;
      event.preventDefault();
      await addFiles([file]);
      input.setOutput("Loaded edit source image from clipboard.");
      return true;
    }
    const text = String(event.clipboardData?.getData("text/plain") || "").trim();
    if (!text) return false;
    event.preventDefault();
    addUrl(text.split(/\r?\n/).find(Boolean) || text);
    input.setOutput("Loaded edit source image reference from clipboard.");
    return true;
  }

  async function handleDocumentPaste(event) {
    if (!event || event.defaultPrevented) return;
    const files = input.getClipboardImageFiles(event);
    if (!files.length) return;
    const imageStudio = getElementById("image-studio-card");
    const eventTarget = event.target?.nodeType === 1 ? event.target : null;
    if (input.appState.aiFocusedSectionId !== "image-studio-card" && !imageStudio?.contains(eventTarget)) return;
    event.preventDefault();
    try {
      await addFiles(files);
      input.setOutput(`Loaded ${files.length} Image Studio source image${files.length === 1 ? "" : "s"} from clipboard.`);
    } catch (error) {
      input.setOutput("Image Studio paste failed: " + (error?.message || "Unknown error"));
    }
  }

  async function handleDrop(event) {
    event.preventDefault();
    getElementById("image-edit-source-dropzone")?.classList.remove("dragging");
    const files = Array.from(event.dataTransfer?.files || []).filter(file => String(file.type || "").startsWith("image/"));
    if (files.length) {
      await addFiles(files);
      input.setOutput("Loaded edit source image from drop.");
      return;
    }
    const text = String(event.dataTransfer?.getData("text/plain") || event.dataTransfer?.getData("text/uri-list") || "").trim();
    if (!text) return;
    addUrl(text.split(/\r?\n/).find(Boolean) || text);
    input.setOutput("Loaded edit source image reference from drop.");
  }

  function reportFailure(prefix, error) {
    input.setOutput(prefix + (error?.message || "Unknown error"));
  }

  function bind(bindings) {
    const bindEvent = bindings?.bind;
    const bindDropzone = bindings?.bindDropzone;
    const clickInput = bindings?.clickInput;
    if (typeof bindEvent !== "function" || typeof bindDropzone !== "function" || typeof clickInput !== "function") {
      throw new Error("Image edit source workspace binding helpers are unavailable.");
    }
    clickInput("image-edit-source-browse-button", "image-edit-source-file");
    bindEvent("image-edit-source-clear-button", "click", () => {
      clear();
      input.setOutput("Cleared Image Studio edit source.");
    });
    bindEvent("image-edit-source-file", "change", async event => {
      const files = Array.from(event.target.files || []).filter(Boolean);
      if (!files.length) return;
      try {
        await addFiles(files);
        input.setOutput(`Loaded ${files.length} edit source image(s) from disk.`);
      } catch (error) {
        reportFailure("Edit source upload failed: ", error);
      } finally {
        event.target.value = "";
      }
    });
    bindDropzone("image-edit-source-dropzone", "image-edit-source-file", async event => {
      try {
        await handleDrop(event);
      } catch (error) {
        reportFailure("Edit source drop failed: ", error);
      }
    });
    for (const id of ["image-edit-source-dropzone", "image-edit-source-url"]) {
      bindEvent(id, "paste", async event => {
        try {
          await handlePaste(event);
        } catch (error) {
          reportFailure("Edit source paste failed: ", error);
        }
      });
    }
    document.addEventListener("paste", handleDocumentPaste);
    bindEvent("image-edit-source-url-apply-button", "click", () => {
      try {
        addUrl(getElementById("image-edit-source-url")?.value || "");
        input.setOutput("Loaded edit source from URL / path.");
      } catch (error) {
        reportFailure("Failed to use source URL / path: ", error);
      }
    });
    bindEvent("image-edit-source-pool-select", "change", refreshPoolImageOptions);
    bindEvent("image-edit-source-pool-load-button", "click", () => {
      try {
        addPoolSelection();
        input.setOutput("Loaded edit source image from selected pool.");
      } catch (error) {
        reportFailure("Failed to load source from image pool: ", error);
      }
    });
    bindEvent("image-edit-batch-enabled", "change", render);
    bindEvent("image-edit-select-all-button", "click", () => setAllSelections(true));
    bindEvent("image-edit-deselect-all-button", "click", () => setAllSelections(false));
    refreshOptions();
    render();
  }

  return {
    addFiles,
    addPoolSelection,
    addSources,
    addUrl,
    bind,
    clear,
    getActive,
    getExecutionSources,
    refreshOptions,
    render,
    resetRunStates,
    setAllSelections,
    updateRunState
  };
}
