function createDashboardImagePoolHelpers(input) {
  let forceCreateNewImagePool = false;
  const imagePoolLazyObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const image = entry.target;
        if (!image || !image.dataset) return;
        const source = image.dataset.src || "";
        if (entry.isIntersecting) {
          if (source && image.getAttribute("src") !== source) {
            image.src = source;
          }
          return;
        }
        if (image.getAttribute("src")) {
          image.removeAttribute("src");
        }
      });
    }, { root: null, rootMargin: "180px 0px", threshold: 0.01 })
    : null;

  function normalizeImagePoolSources(value) {
    const unique = new Set();
    const normalized = [];
    for (const entry of input.splitLines(value)) {
      if (!entry || unique.has(entry)) {
        continue;
      }
      unique.add(entry);
      normalized.push(entry);
    }
    return normalized;
  }

  function getImagePoolById(poolId) {
    const targetId = String(poolId || "").trim();
    if (!targetId) {
      return null;
    }
    return input.state.imagePools.find(pool => pool.id === targetId) || null;
  }

  function fillImagePoolSelect(id, selectedValue, noneLabel) {
    const select = document.getElementById(id);
    if (!select) {
      return "";
    }
    input.clearChildren(select);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = noneLabel || "No image pool selected";
    select.appendChild(emptyOption);
    for (const pool of input.state.imagePools) {
      const option = document.createElement("option");
      option.value = pool.id;
      option.textContent = pool.name + " (" + pool.images.length + ")";
      select.appendChild(option);
    }
    const hasSelected = input.state.imagePools.some(pool => pool.id === selectedValue);
    select.value = hasSelected ? selectedValue : "";
    return select.value;
  }
  function extractUploadedModelImageFileName(source) {
    const normalized = normalizeLocalImageSourcePath(source);
    if (!normalized) {
      return "";
    }
    const marker = "\\uploaded-model-images\\";
    const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
    if (markerIndex === -1) {
      return "";
    }
    const suffix = normalized.slice(markerIndex + marker.length);
    const parts = suffix.split("\\").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "";
  }
  function normalizeLocalImageSourcePath(source) {
    const trimmed = String(source || "").trim();
    if (!trimmed) {
      return "";
    }
    if (/^file:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        const pathname = decodeURIComponent(parsed.pathname || "");
        const windowsPath = /^\/[a-z]:/i.test(pathname) ? pathname.slice(1) : pathname;
        return windowsPath.replace(/\//g, "\\");
      } catch {
        return trimmed.replace(/^file:\/+/i, "").replace(/\//g, "\\");
      }
    }
    return trimmed.replace(/\//g, "\\");
  }
  function extractGeneratedImagePathParts(source) {
    const normalized = normalizeLocalImageSourcePath(source);
    if (!normalized) {
      return null;
    }
    const marker = "\\generated-images\\";
    const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
    if (markerIndex === -1) {
      return null;
    }
    const suffix = normalized.slice(markerIndex + marker.length);
    const parts = suffix.split("\\").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return {
      imageId: parts[0],
      fileName: parts[parts.length - 1]
    };
  }
  function extractGeneratedModelPathParts(source) {
    const normalized = normalizeLocalImageSourcePath(source);
    if (!normalized) {
      return null;
    }
    const marker = "\\generated-models\\";
    const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
    if (markerIndex === -1) {
      return null;
    }
    const suffix = normalized.slice(markerIndex + marker.length);
    const parts = suffix.split("\\").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return {
      modelId: parts[0],
      fileName: parts[parts.length - 1]
    };
  }
  function parseGeneratedPoolApiSource(source) {
    const trimmed = String(source || "").trim();
    if (!trimmed) {
      return null;
    }
    let parsed;
    try {
      parsed = new URL(trimmed, window.location.origin);
    } catch {
      return null;
    }
    const pathname = parsed.pathname.toLowerCase();
    const isAbsolute = /^https?:\/\//i.test(trimmed);
    if (pathname.endsWith("/api/generated-image-file")) {
      const imageId = parsed.searchParams.get("imageId") || "";
      const fileName = parsed.searchParams.get("file") || "";
      if (!imageId || !fileName) {
        return null;
      }
      return {
        kind: "image",
        id: imageId,
        fileName,
        sourceType: isAbsolute ? "api-absolute" : "api-relative",
        parsedUrl: parsed
      };
    }
    if (pathname.endsWith("/api/model3d-file")) {
      const modelId = parsed.searchParams.get("modelId") || "";
      const fileName = parsed.searchParams.get("file") || "";
      if (!modelId || !fileName) {
        return null;
      }
      return {
        kind: "model",
        id: modelId,
        fileName,
        sourceType: isAbsolute ? "api-absolute" : "api-relative",
        parsedUrl: parsed
      };
    }
    return null;
  }
  function resolveGeneratedPoolSource(source) {
    const fromApi = parseGeneratedPoolApiSource(source);
    if (fromApi) {
      return fromApi;
    }
    const generatedImagePath = extractGeneratedImagePathParts(source);
    if (generatedImagePath) {
      return {
        kind: "image",
        id: generatedImagePath.imageId,
        fileName: generatedImagePath.fileName,
        sourceType: "local-image",
        sourceValue: normalizeLocalImageSourcePath(source)
      };
    }
    const generatedModelPath = extractGeneratedModelPathParts(source);
    if (generatedModelPath) {
      return {
        kind: "model",
        id: generatedModelPath.modelId,
        fileName: generatedModelPath.fileName,
        sourceType: "local-model",
        sourceValue: normalizeLocalImageSourcePath(source)
      };
    }
    return null;
  }
  function buildUpdatedGeneratedPoolSource(reference, nextFileName) {
    if (!reference || !nextFileName) {
      return "";
    }
    if (reference.sourceType === "api-absolute" || reference.sourceType === "api-relative") {
      const url = new URL(reference.parsedUrl.toString());
      url.searchParams.set("file", nextFileName);
      if (reference.sourceType === "api-relative") {
        return url.pathname + (url.search ? url.search : "");
      }
      return url.toString();
    }
    if (reference.sourceType === "local-image") {
      const marker = "\\generated-images\\";
      const markerIndex = reference.sourceValue.toLowerCase().lastIndexOf(marker);
      if (markerIndex !== -1) {
        const prefix = reference.sourceValue.slice(0, markerIndex + marker.length);
        return `${prefix}${reference.id}\\${nextFileName}`;
      }
    }
    if (reference.sourceType === "local-model") {
      const marker = "\\generated-models\\";
      const markerIndex = reference.sourceValue.toLowerCase().lastIndexOf(marker);
      if (markerIndex !== -1) {
        const prefix = reference.sourceValue.slice(0, markerIndex + marker.length);
        return `${prefix}${reference.id}\\${nextFileName}`;
      }
    }
    return "";
  }
  function resolveImagePoolPreviewUrl(source) {
    const normalized = String(source || "").trim();
    if (!normalized) {
      return "";
    }
    const generatedApiSource = parseGeneratedPoolApiSource(normalized);
    if (generatedApiSource) {
      if (generatedApiSource.kind === "image") {
        return input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(generatedApiSource.id, generatedApiSource.fileName));
      }
      return "";
    }
    if (/^data:image\//i.test(normalized) || /^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    if (/^\/api\//i.test(normalized)) {
      return input.buildAbsoluteDashboardUrl(normalized);
    }
    const generatedImagePath = extractGeneratedImagePathParts(normalized);
    if (generatedImagePath) {
      return input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(generatedImagePath.imageId, generatedImagePath.fileName));
    }
    const uploadedFileName = extractUploadedModelImageFileName(normalized);
    if (uploadedFileName) {
      return input.buildAbsoluteDashboardUrl("/api/uploaded-model-image-file?file=" + encodeURIComponent(uploadedFileName));
    }
    return "";
  }
  function getImagePoolSourceLabel(source) {
    const trimmed = String(source || "").trim();
    if (!trimmed) {
      return "Image source";
    }
    try {
      const parsed = new URL(trimmed, window.location.origin);
      const fileParam = parsed.searchParams.get("file");
      if (fileParam) {
        return fileParam.split(/[\\/]/).filter(Boolean).pop() || fileParam;
      }
      const pathLabel = decodeURIComponent(parsed.pathname || "").split(/[\\/]/).filter(Boolean).pop();
      if (pathLabel) {
        return pathLabel;
      }
    } catch {
      const pathLabel = trimmed.split(/[\\/]/).filter(Boolean).pop();
      if (pathLabel) {
        return pathLabel;
      }
    }
    return trimmed.length > 80 ? trimmed.slice(0, 77) + "..." : trimmed;
  }
  function closeImagePoolPreviewOverlay() {
    const overlay = document.getElementById("image-pool-preview-overlay");
    if (!overlay) {
      return;
    }
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }
  function ensureImagePoolPreviewOverlay() {
    let overlay = document.getElementById("image-pool-preview-overlay");
    if (overlay) {
      return overlay;
    }
    overlay = document.createElement("div");
    overlay.id = "image-pool-preview-overlay";
    overlay.className = "image-pool-preview-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <button class="image-pool-preview-backdrop" type="button" aria-label="Close image preview"></button>
      <div class="image-pool-preview-panel" role="dialog" aria-modal="true" aria-labelledby="image-pool-preview-title">
        <div class="image-pool-preview-header">
          <div>
            <div class="panel-kicker">Image Pool Preview</div>
            <h3 id="image-pool-preview-title">Image preview</h3>
          </div>
          <button class="ghost compact image-pool-preview-close" type="button" aria-label="Close image preview">&#10005;</button>
        </div>
        <img id="image-pool-preview-full-image" alt="Image pool full preview">
        <div class="item-meta image-pool-preview-source" id="image-pool-preview-source"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".image-pool-preview-backdrop")?.addEventListener("click", closeImagePoolPreviewOverlay);
    overlay.querySelector(".image-pool-preview-close")?.addEventListener("click", closeImagePoolPreviewOverlay);
    return overlay;
  }
  function openImagePoolPreviewOverlay(previewUrl, title, source) {
    if (!previewUrl) {
      return;
    }
    const overlay = ensureImagePoolPreviewOverlay();
    const image = overlay.querySelector("#image-pool-preview-full-image");
    const titleNode = overlay.querySelector("#image-pool-preview-title");
    const sourceNode = overlay.querySelector("#image-pool-preview-source");
    if (image) {
      image.src = previewUrl;
    }
    if (titleNode) {
      titleNode.textContent = title || "Image preview";
    }
    if (sourceNode) {
      sourceNode.textContent = source || previewUrl;
    }
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
  }
  function countImagePoolSources(pool) {
    return Array.isArray(pool?.images) ? pool.images.length : 0;
  }
  async function confirmImagePoolDelete(options) {
    if (typeof window.dashboardConfirm !== "function") return false;
    return window.dashboardConfirm({
      title: options?.title || "Delete Image Pool",
      message: options?.message || "This image pool action cannot be undone.",
      details: options?.details || [],
      confirmLabel: options?.confirmLabel || "Delete",
      variant: "warning"
    });
  }
  async function removeImageFromPoolByIndex(poolId, imageIndex) {
    const pool = getImagePoolById(poolId);
    if (!pool) {
      return void input.setOutput("Selected image pool was not found.");
    }
    const images = Array.isArray(pool.images) ? [...pool.images] : [];
    if (imageIndex < 0 || imageIndex >= images.length) {
      return void input.setOutput("Selected pool image was not found.");
    }
    const removedSource = String(images[imageIndex] || "").trim();
    const isLastImage = images.length <= 1;
    if (!await confirmImagePoolDelete({
      title: isLastImage ? "Delete Image Pool" : "Remove Pool Image",
      message: isLastImage
        ? "Removing the last image will also delete pool " + pool.name + "."
        : "Remove this image from pool " + pool.name + "?",
      details: removedSource ? [removedSource] : [],
      confirmLabel: isLastImage ? "Delete Pool" : "Remove"
    })) {
      return;
    }
    if (isLastImage) {
      await input.request("/api/image-pools/delete", { id: pool.id });
      if (input.state.selectedImagePoolId === pool.id) {
        applyImagePoolEditor(null);
      }
      await loadImagePools("");
      input.setOutput("Removed last image and deleted pool " + pool.name + ".");
      return;
    }
    images.splice(imageIndex, 1);
    const saved = await input.request("/api/image-pools", {
      id: pool.id,
      name: pool.name,
      images
    });
    await loadImagePools(saved.id);
    const librarySelect = document.getElementById("image-pool-library-select");
    if (librarySelect) {
      librarySelect.value = saved.id;
    }
    input.setOutput("Removed image from pool " + saved.name + ": " + removedSource);
  }
  async function regeneratePoolImageFileNameByIndex(poolId, imageIndex) {
    const pool = getImagePoolById(poolId);
    if (!pool) {
      return void input.setOutput("Selected image pool was not found.");
    }
    const images = Array.isArray(pool.images) ? [...pool.images] : [];
    if (imageIndex < 0 || imageIndex >= images.length) {
      return void input.setOutput("Selected pool image was not found.");
    }
    const source = String(images[imageIndex] || "").trim();
    const reference = resolveGeneratedPoolSource(source);
    if (!reference) {
      return void input.setOutput("This pool entry is not a generated image/model source that can be renamed.");
    }
    input.setOutput("Regenerating filename with LLM...");
    const renamed = reference.kind === "image"
      ? await input.request("/api/image-regenerate-filename", { imageId: reference.id })
      : await input.request("/api/model3d-regenerate-filename", { modelId: reference.id });
    const renamedFileName = reference.kind === "image"
      ? String(renamed.imageFileName || "").trim()
      : String(renamed.modelFileName || "").trim();
    if (!renamedFileName) {
      return void input.setOutput("LLM did not return a valid filename.");
    }
    const nextSource = buildUpdatedGeneratedPoolSource(reference, renamedFileName);
    if (!nextSource) {
      return void input.setOutput("Failed to rebuild pool source after filename regeneration.");
    }
    images[imageIndex] = nextSource;
    const saved = await input.request("/api/image-pools", {
      id: pool.id,
      name: pool.name,
      images
    });
    await loadImagePools(saved.id);
    input.setOutput("Regenerated filename and updated pool entry in " + saved.name + ".");
  }
  async function deleteLibrarySelectedImagePool(selectId) {
    const librarySelect = document.getElementById(selectId || "image-pool-library-select");
    const poolId = librarySelect && typeof librarySelect.value === "string" ? librarySelect.value.trim() : "";
    if (!poolId) {
      return void input.setOutput("Select an image pool in Image Pool Browser first.");
    }
    const pool = getImagePoolById(poolId);
    if (!pool) {
      return void input.setOutput("Selected image pool was not found.");
    }
    const imageCount = countImagePoolSources(pool);
    if (!await confirmImagePoolDelete({
      message: "Delete image pool " + pool.name + "? This removes " + imageCount + " image source" + (imageCount === 1 ? "" : "s") + " from the pool.",
      details: Array.isArray(pool.images) ? pool.images : []
    })) {
      return;
    }
    await input.request("/api/image-pools/delete", { id: pool.id });
    if (input.state.selectedImagePoolId === pool.id) {
      applyImagePoolEditor(null);
    }
    await loadImagePools("");
    input.setOutput("Deleted image pool " + pool.name + ".");
  }
  function renderImagePoolLibraryInstance(selectId, containerId) {
    const select = document.getElementById(selectId);
    const container = document.getElementById(containerId);
    if (!select || !container) {
      return;
    }
    const selectedId = String(select.value || "").trim();
    const selectedPool = getImagePoolById(selectedId) || (!forceCreateNewImagePool ? (input.state.imagePools[0] || null) : null);
    if (selectedPool && select.value !== selectedPool.id) {
      select.value = selectedPool.id;
    }
    input.clearChildren(container);
    if (!selectedPool) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = input.state.imagePools.length > 0
        ? "Select an image pool to browse."
        : "No image pools yet.";
      container.appendChild(empty);
      return;
    }
    if (!Array.isArray(selectedPool.images) || selectedPool.images.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "This pool has no images.";
      container.appendChild(empty);
      return;
    }
    for (let index = 0; index < selectedPool.images.length; index += 1) {
      const source = String(selectedPool.images[index] || "").trim();
      if (!source) {
        continue;
      }
      const row = document.createElement("div");
      row.className = "item image-pool-library-item";
      const header = document.createElement("div");
      const sourceLabel = getImagePoolSourceLabel(source);
      header.className = "image-pool-library-title";
      header.textContent = sourceLabel;
      header.title = source;
      row.appendChild(header);
      const previewUrl = resolveImagePoolPreviewUrl(source);
      const actions = document.createElement("div");
      actions.className = "image-pool-library-actions";
      if (previewUrl) {
        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "image-pool-preview-button";
        previewButton.setAttribute("aria-label", "Open full preview for " + sourceLabel);
        const preview = document.createElement("img");
        preview.dataset.src = previewUrl;
        if (!imagePoolLazyObserver) {
          preview.src = previewUrl;
        } else {
          imagePoolLazyObserver.observe(preview);
        }
        preview.loading = "lazy";
        preview.alt = sourceLabel;
        previewButton.appendChild(preview);
        previewButton.addEventListener("click", () => {
          openImagePoolPreviewOverlay(previewUrl, sourceLabel, source);
        });
        row.appendChild(previewButton);
      } else {
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = "Preview unavailable for this source type.";
        row.appendChild(hint);
      }
      const generatedReference = resolveGeneratedPoolSource(source);
      if (generatedReference) {
        const renameButton = document.createElement("button");
        renameButton.type = "button";
        renameButton.className = "secondary";
        renameButton.textContent = "Rename With LLM";
        renameButton.addEventListener("click", async () => {
          try {
            await regeneratePoolImageFileNameByIndex(selectedPool.id, index);
          } catch (error) {
            input.setOutput("Failed to regenerate filename in pool: " + ((error && error.message) || "Unknown error"));
          }
        });
        actions.appendChild(renameButton);
      }
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "secondary";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", async () => {
        try {
          await removeImageFromPoolByIndex(selectedPool.id, index);
        } catch (error) {
          input.setOutput("Failed to remove image from pool: " + ((error && error.message) || "Unknown error"));
        }
      });
      actions.appendChild(removeButton);
      row.appendChild(actions);
      container.appendChild(row);
    }
  }

  function renderImagePoolLibrary() {
    renderImagePoolLibraryInstance("image-pool-library-select", "image-pool-library-list");
    renderImagePoolLibraryInstance("resources-image-pool-library-select", "resources-image-pool-library-list");
  }

  function renderImagePoolSelects() {
    input.state.selectedImagePoolId = fillImagePoolSelect("image-pool-select", input.state.selectedImagePoolId, "Select image pool");
    fillImagePoolSelect("model3d-image-pool-select", document.getElementById("model3d-image-pool-select")?.value || "", "No image pool selected");
    fillImagePoolSelect("scheduled-model-image-pool", document.getElementById("scheduled-model-image-pool")?.value || "", "No image pool selected");
    fillImagePoolSelect("join-model-image-pool", document.getElementById("join-model-image-pool")?.value || "", "No image pool selected");
    fillImagePoolSelect("imagegen-image-pool-select", document.getElementById("imagegen-image-pool-select")?.value || "", "No image pool selected");
    fillImagePoolSelect("image-pool-library-select", document.getElementById("image-pool-library-select")?.value || "", "Select image pool to browse");
    fillImagePoolSelect("resources-image-pool-library-select", document.getElementById("resources-image-pool-library-select")?.value || "", "Select image pool to browse");
    renderImagePoolLibrary();
  }

  function applyImagePoolEditor(pool) {
    const nameInput = document.getElementById("image-pool-name");
    const imagesInput = document.getElementById("image-pool-images");
    if (!nameInput || !imagesInput) {
      return;
    }
    if (!pool) {
      input.state.selectedImagePoolId = "";
      nameInput.value = "";
      imagesInput.value = "";
      const select = document.getElementById("image-pool-select");
      if (select) {
        select.value = "";
      }
      renderImagePoolSelects();
      return;
    }
    forceCreateNewImagePool = false;
    input.state.selectedImagePoolId = pool.id;
    renderImagePoolSelects();
    nameInput.value = pool.name || "";
    imagesInput.value = Array.isArray(pool.images) ? pool.images.join("\n") : "";
    const librarySelect = document.getElementById("image-pool-library-select");
    if (librarySelect && pool.id) {
      librarySelect.value = pool.id;
      renderImagePoolLibrary();
    }
    const resourcesLibrarySelect = document.getElementById("resources-image-pool-library-select");
    if (resourcesLibrarySelect && pool.id) {
      resourcesLibrarySelect.value = pool.id;
      renderImagePoolLibrary();
    }
  }

  async function loadImagePools(preferredPoolId) {
    const previousManualPoolId = document.getElementById("model3d-image-pool-select")?.value || "";
    const previousScheduledPoolId = document.getElementById("scheduled-model-image-pool")?.value || "";
    const previousJoinPoolId = document.getElementById("join-model-image-pool")?.value || "";
    const previousImageStudioPoolId = document.getElementById("imagegen-image-pool-select")?.value || "";
    const previousLibraryPoolId = document.getElementById("image-pool-library-select")?.value || "";
    const previousResourcesLibraryPoolId = document.getElementById("resources-image-pool-library-select")?.value || "";
    const preferredId = String(preferredPoolId || "").trim();
    input.state.imagePools = await input.request("/api/image-pools");
    const hasValidPreferred = preferredId && input.state.imagePools.some(pool => pool.id === preferredId);
    if (hasValidPreferred) {
      input.state.selectedImagePoolId = preferredId;
    } else if (!input.state.imagePools.some(pool => pool.id === input.state.selectedImagePoolId)) {
      input.state.selectedImagePoolId = "";
    }
    renderImagePoolSelects();
    if (hasValidPreferred) {
      const selectIds = [
        "model3d-image-pool-select",
        "scheduled-model-image-pool",
        "join-model-image-pool",
        "imagegen-image-pool-select",
        "image-pool-library-select",
        "resources-image-pool-library-select"
      ];
      for (const selectId of selectIds) {
        const select = document.getElementById(selectId);
        if (select) {
          select.value = preferredId;
        }
      }
    } else {
      if (previousManualPoolId && input.state.imagePools.some(pool => pool.id === previousManualPoolId)) {
        document.getElementById("model3d-image-pool-select").value = previousManualPoolId;
      }
      if (previousScheduledPoolId && input.state.imagePools.some(pool => pool.id === previousScheduledPoolId)) {
        document.getElementById("scheduled-model-image-pool").value = previousScheduledPoolId;
      }
      if (previousJoinPoolId && input.state.imagePools.some(pool => pool.id === previousJoinPoolId)) {
        document.getElementById("join-model-image-pool").value = previousJoinPoolId;
      }
      if (previousImageStudioPoolId && input.state.imagePools.some(pool => pool.id === previousImageStudioPoolId)) {
        document.getElementById("imagegen-image-pool-select").value = previousImageStudioPoolId;
      }
      if (previousLibraryPoolId && input.state.imagePools.some(pool => pool.id === previousLibraryPoolId)) {
        document.getElementById("image-pool-library-select").value = previousLibraryPoolId;
      }
      if (previousResourcesLibraryPoolId && input.state.imagePools.some(pool => pool.id === previousResourcesLibraryPoolId)) {
        document.getElementById("resources-image-pool-library-select").value = previousResourcesLibraryPoolId;
      }
    }
    const selectedPool = getImagePoolById(input.state.selectedImagePoolId);
    applyImagePoolEditor(selectedPool);
    renderImagePoolLibrary();
  }

  function appendUniqueLinesToInput(inputId, entries) {
    const node = document.getElementById(inputId);
    if (!node) {
      return;
    }
    const existing = normalizeImagePoolSources(node.value);
    const unique = new Set(existing);
    for (const entry of entries) {
      const value = String(entry || "").trim();
      if (!value || unique.has(value)) {
        continue;
      }
      unique.add(value);
      existing.push(value);
    }
    node.value = existing.join("\n");
  }

  async function appendUploadedFilesToImagePool(fileList) {
    const files = Array.from(fileList || []).filter(file => file && (file.type || "").startsWith("image/"));
    if (files.length === 0) {
      return;
    }
    const uploadedPaths = [];
    for (const file of files) {
      const uploaded = await input.uploadModelImageFile(file);
      if (uploaded && uploaded.path) {
        uploadedPaths.push(uploaded.path);
      }
    }
    appendUniqueLinesToInput("image-pool-images", uploadedPaths);
    if (uploadedPaths.length > 0) {
      input.setOutput("Added " + uploadedPaths.length + " image(s) to pool editor.");
    }
  }

  async function saveImagePoolFromEditor() {
    const nameInput = document.getElementById("image-pool-name");
    const imagesInput = document.getElementById("image-pool-images");
    if (!nameInput || !imagesInput) {
      return void input.setOutput("Image pool editor is not available.");
    }
    const name = nameInput.value.trim();
    const images = normalizeImagePoolSources(imagesInput.value);
    if (!name) {
      return void input.setOutput("Pool name is required.");
    }
    const editorSelectedPoolId = document.getElementById("image-pool-select")?.value || "";
    const shouldCreateNewPool = forceCreateNewImagePool === true || !editorSelectedPoolId;
    const targetPoolId = shouldCreateNewPool ? "" : editorSelectedPoolId;
    const payload = await input.request("/api/image-pools", {
      createNew: shouldCreateNewPool,
      id: targetPoolId || undefined,
      name,
      images
    });
    forceCreateNewImagePool = false;
    await loadImagePools(payload.id);
    const modelPoolSelect = document.getElementById("model3d-image-pool-select");
    if (modelPoolSelect) {
      modelPoolSelect.value = payload.id;
    }
    input.setOutput(
      (shouldCreateNewPool ? "Created image pool " : "Updated image pool ")
      + payload.name
      + " ("
      + payload.id
      + "). Total pools: "
      + input.state.imagePools.length
      + "."
    );
  }

  async function deleteSelectedImagePool() {
    if (!input.state.selectedImagePoolId) {
      return void input.setOutput("Select an image pool first.");
    }
    const deletedId = input.state.selectedImagePoolId;
    const pool = getImagePoolById(deletedId);
    if (!pool) {
      return void input.setOutput("Selected image pool was not found.");
    }
    const imageCount = countImagePoolSources(pool);
    if (!await confirmImagePoolDelete({
      message: "Delete image pool " + pool.name + "? This removes " + imageCount + " image source" + (imageCount === 1 ? "" : "s") + " from the pool.",
      details: Array.isArray(pool.images) ? pool.images : []
    })) {
      return;
    }
    await input.request("/api/image-pools/delete", { id: deletedId });
    if (document.getElementById("model3d-image-pool-select")?.value === deletedId) {
      document.getElementById("model3d-image-pool-select").value = "";
    }
    if (document.getElementById("scheduled-model-image-pool")?.value === deletedId) {
      document.getElementById("scheduled-model-image-pool").value = "";
    }
    if (document.getElementById("join-model-image-pool")?.value === deletedId) {
      document.getElementById("join-model-image-pool").value = "";
    }
    if (document.getElementById("imagegen-image-pool-select")?.value === deletedId) {
      document.getElementById("imagegen-image-pool-select").value = "";
    }
    applyImagePoolEditor(null);
    await loadImagePools("");
    input.setOutput("Image pool deleted.");
  }

  function getGeneratedImagePoolSource(image) {
    if (!image) {
      return "";
    }
    const fromRecord = typeof image.imageUrl === "string" ? image.imageUrl.trim() : "";
    if (fromRecord) {
      return input.buildAbsoluteDashboardUrl(fromRecord);
    }
    if (!image.id || !image.imageFileName) {
      return "";
    }
    return input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(image.id, image.imageFileName));
  }

  function getSelectedGeneratedImagePoolSource() {
    return getGeneratedImagePoolSource(input.getSelectedGeneratedImage());
  }

  function getSelectedGeneratedImagePoolSources() {
    const images = typeof input.getSelectedGeneratedImages === "function"
      ? input.getSelectedGeneratedImages()
      : [input.getSelectedGeneratedImage()].filter(Boolean);
    return images
      .map(image => ({ image, source: getGeneratedImagePoolSource(image) }))
      .filter(item => item.source);
  }

  async function addSelectedGeneratedImageToPool() {
    const poolId = document.getElementById("imagegen-image-pool-select")?.value || "";
    if (!poolId) {
      return void input.setOutput("Select an image pool in Image Studio first.");
    }
    const pool = getImagePoolById(poolId);
    if (!pool) {
      return void input.setOutput("Selected image pool was not found.");
    }
    const selectedItems = getSelectedGeneratedImagePoolSources();
    if (selectedItems.length === 0) return void input.setOutput("Select one or more generated images first.");
    const existingEntries = Array.isArray(pool.images) ? pool.images : [];
    const existingSet = new Set(existingEntries.map(entry => String(entry || "").trim()).filter(Boolean));
    const newSources = selectedItems.map(item => item.source).filter(source => !existingSet.has(source));
    if (newSources.length === 0) {
      return void input.setOutput("Selected image" + (selectedItems.length === 1 ? " is" : "s are") + " already part of this pool.");
    }
    const saved = await input.request("/api/image-pools", {
      id: pool.id,
      name: pool.name,
      images: [...existingEntries, ...newSources]
    });
    await loadImagePools(saved.id);
    document.getElementById("imagegen-image-pool-select").value = saved.id;
    input.setOutput("Added " + newSources.length + " selected image" + (newSources.length === 1 ? "" : "s") + " to pool " + saved.name + ".");
  }
  function startNewImagePoolFromLibrary() {
    forceCreateNewImagePool = true;
    if (typeof input.openResourcesOverlay === "function") {
      input.openResourcesOverlay({ tab: "image-pools" });
    }
    applyImagePoolEditor(null);
    for (const selectId of ["image-pool-library-select", "resources-image-pool-library-select"]) {
      const librarySelect = document.getElementById(selectId);
      if (librarySelect) {
        librarySelect.value = "";
      }
    }
    renderImagePoolLibrary();
    const managerFold = document.getElementById("image-pool-manager-fold");
    if (managerFold && managerFold.open !== true) {
      managerFold.open = true;
    }
    const nameInput = document.getElementById("image-pool-name");
    if (nameInput && typeof nameInput.focus === "function") {
      nameInput.focus();
    }
    if (managerFold && typeof managerFold.scrollIntoView === "function") {
      managerFold.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (nameInput && typeof nameInput.scrollIntoView === "function") {
      nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    input.setOutput("Ready to create a new image pool. Fill name and image sources, then save.");
  }

  function bindEvents() {
    const bindClick = (id, handler) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener("click", handler);
      }
    };
    const bindChange = (id, handler) => {
      const node = document.getElementById(id);
      if (node) {
        node.addEventListener("change", handler);
      }
    };
    bindChange("image-pool-select", event => {
      forceCreateNewImagePool = false;
      input.state.selectedImagePoolId = event.target.value || "";
      applyImagePoolEditor(getImagePoolById(input.state.selectedImagePoolId));
    });
    bindClick("new-image-pool-button", () => {
      startNewImagePoolFromLibrary();
    });
    bindClick("save-image-pool-button", async () => {
      await saveImagePoolFromEditor();
    });
    bindClick("delete-image-pool-button", async () => {
      await deleteSelectedImagePool();
    });
    bindClick("image-pool-browse-button", () => {
      document.getElementById("image-pool-files")?.click();
    });
    bindChange("image-pool-files", async event => {
      try {
        await appendUploadedFilesToImagePool(event.target.files);
        event.target.value = "";
      } catch (error) {
        input.setOutput("Image pool upload failed: " + ((error && error.message) || "Unknown error"));
      }
    });
    bindClick("image-pool-add-current-source-button", () => {
      appendUniqueLinesToInput("image-pool-images", input.splitLines(input.getCurrentModelSource()));
      input.setOutput("Added current model source entries to pool editor.");
    });
    bindClick("imagegen-add-selected-to-pool-button", async () => {
      await addSelectedGeneratedImageToPool();
    });
    const handleLibrarySelectionChange = event => {
      const poolId = event.target.value || "";
      if (poolId && getImagePoolById(poolId)) {
        forceCreateNewImagePool = false;
        input.state.selectedImagePoolId = poolId;
        applyImagePoolEditor(getImagePoolById(poolId));
        return;
      }
      renderImagePoolLibrary();
    };
    bindChange("image-pool-library-select", handleLibrarySelectionChange);
    bindChange("resources-image-pool-library-select", handleLibrarySelectionChange);
    bindClick("image-pool-library-new-button", () => {
      startNewImagePoolFromLibrary();
    });
    bindClick("resources-image-pool-library-new-button", () => {
      startNewImagePoolFromLibrary();
    });
    bindClick("image-pool-library-delete-button", async () => {
      await deleteLibrarySelectedImagePool("image-pool-library-select");
    });
    bindClick("resources-image-pool-library-delete-button", async () => {
      await deleteLibrarySelectedImagePool("resources-image-pool-library-select");
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") {
        return;
      }
      const overlay = document.getElementById("image-pool-preview-overlay");
      if (overlay && !overlay.classList.contains("hidden")) {
        closeImagePoolPreviewOverlay();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  return {
    normalizeImagePoolSources,
    getImagePoolById,
    resolveImagePoolPreviewUrl,
    renderImagePoolSelects,
    applyImagePoolEditor,
    loadImagePools,
    appendUniqueLinesToInput,
    appendUploadedFilesToImagePool,
    saveImagePoolFromEditor,
    deleteSelectedImagePool,
    getSelectedGeneratedImagePoolSource,
    addSelectedGeneratedImageToPool,
    bindEvents
  };
}
