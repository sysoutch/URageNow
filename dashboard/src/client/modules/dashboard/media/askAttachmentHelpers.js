function createDashboardAskAttachmentHelpers(input) {
  const modelFilePattern = /\.(glb|gltf|fbx|obj|stl|ply|usdz)$/i;
  const textFilePattern = /\.(txt|md|markdown|json|jsonc|csv|tsv|js|jsx|ts|tsx|css|scss|html|xml|yaml|yml|toml|ini|py|cs|cpp|c|h|hpp|java|rs|go|php|rb|lua|sh|bat|ps1|sql|log)$/i;
  const maxTextFileBytes = Number.isFinite(input.maxTextFileBytes) ? input.maxTextFileBytes : 384 * 1024;
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);
  const getElementById = typeof input.getElementById === "function"
    ? input.getElementById
    : id => document.getElementById(id);

  function createUploadId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function formatFileSize(size) {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes < 1) return "Unknown size";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function isSupportedModelFile(fileName) {
    return modelFilePattern.test(String(fileName || "").trim());
  }

  function isLikelyTextFile(file) {
    const name = String(file?.name || "").trim();
    const type = String(file?.type || "").toLowerCase();
    return type.startsWith("text/") || type.includes("json") || type.includes("xml") || textFilePattern.test(name);
  }

  function createUploadRow(entry, options) {
    const row = createElement("div");
    row.className = "ask-model-upload-entry";
    const icon = createElement("div");
    icon.className = "ask-model-upload-icon";
    icon.textContent = options.badge;
    const meta = createElement("div");
    meta.className = "ask-model-upload-meta";
    const name = createElement("div");
    name.className = "ask-model-upload-name";
    name.textContent = String(entry.fileName || options.fallbackName);
    const kind = createElement("div");
    kind.className = "ask-model-upload-kind";
    kind.textContent = String(entry.detail || options.fallbackDetail);
    meta.append(name, kind);
    const removeButton = createElement("button");
    removeButton.className = "secondary mini-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => options.onRemove(entry.id));
    row.append(icon, meta, removeButton);
    return row;
  }

  function renderModelUploads() {
    const container = getElementById("ask-model-upload-list");
    if (!container) {
      renderComposerAttachments();
      return;
    }
    input.detachLazyMedia(container);
    input.clearChildren(container);
    const entries = Array.isArray(input.state.askSkillModelUploads) ? input.state.askSkillModelUploads : [];
    if (entries.length === 0) {
      appendEmptyState(container, "No uploaded 3D models.");
      renderComposerAttachments();
      return;
    }
    entries.forEach(entry => {
      container.appendChild(createUploadRow(entry, {
        badge: "3D",
        fallbackName: "uploaded-model",
        fallbackDetail: "3D model file",
        onRemove(id) {
          input.state.askSkillModelUploads = entries.filter(item => item.id !== id);
          renderModelUploads();
        }
      }));
    });
    renderComposerAttachments();
  }

  function renderFileUploads() {
    const container = getElementById("ask-file-upload-list");
    if (!container) {
      renderComposerAttachments();
      return;
    }
    input.clearChildren(container);
    const entries = Array.isArray(input.state.askFileUploads) ? input.state.askFileUploads : [];
    if (entries.length === 0) {
      appendEmptyState(container, "No uploaded reference files.");
      renderComposerAttachments();
      return;
    }
    entries.forEach(entry => {
      container.appendChild(createUploadRow(entry, {
        badge: "TXT",
        fallbackName: "uploaded-file",
        fallbackDetail: "reference file",
        onRemove(id) {
          input.state.askFileUploads = entries.filter(item => item.id !== id);
          renderFileUploads();
        }
      }));
    });
    renderComposerAttachments();
  }

  function appendEmptyState(container, message) {
    const empty = createElement("div");
    empty.className = "item";
    empty.textContent = message;
    container.appendChild(empty);
  }

  function clearModelUploads() {
    input.state.askSkillModelUploads = [];
    const fileInput = getElementById("ask-model-upload-input");
    if (fileInput) fileInput.value = "";
    renderModelUploads();
  }

  function clearFileUploads() {
    input.state.askFileUploads = [];
    const fileInput = getElementById("ask-file-upload-input");
    if (fileInput) fileInput.value = "";
    renderFileUploads();
  }

  function createComposerAttachmentCard(data) {
    const card = createElement("div");
    card.className = "ask-composer-attachment-card" + (data.kind === "image" ? " is-image" : "");
    const thumbWrap = createElement("div");
    thumbWrap.className = "ask-composer-attachment-thumb-wrap";
    if (data.previewUrl) {
      const thumb = createElement("img");
      thumb.className = "ask-composer-attachment-thumb";
      thumb.src = data.previewUrl;
      thumb.alt = "";
      thumb.loading = "lazy";
      thumbWrap.appendChild(thumb);
    } else {
      const fallback = createElement("div");
      fallback.className = "ask-composer-attachment-fallback";
      fallback.textContent = data.badge;
      thumbWrap.appendChild(fallback);
    }
    const meta = createElement("div");
    meta.className = "ask-composer-attachment-meta";
    const kind = createElement("div");
    kind.className = "ask-composer-attachment-kind";
    kind.textContent = data.kindLabel;
    const name = createElement("div");
    name.className = "ask-composer-attachment-name";
    name.textContent = data.name;
    const detail = createElement("div");
    detail.className = "ask-composer-attachment-detail";
    detail.textContent = data.detail;
    meta.append(kind, name, detail);
    const removeButton = createElement("button");
    removeButton.className = "secondary mini-button ask-composer-attachment-remove";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", data.onRemove);
    card.append(thumbWrap, meta, removeButton);
    return card;
  }

  function renderComposerAttachments() {
    const tray = getElementById("ask-composer-attachment-tray");
    if (!tray) return;
    input.clearChildren(tray);
    const items = [];
    (Array.isArray(input.state.aiImages) ? input.state.aiImages : []).forEach(entry => {
      items.push(createComposerAttachmentCard({
        kind: "image",
        kindLabel: "Image",
        badge: "IMG",
        previewUrl: entry.previewUrl || entry.value || "",
        name: String(entry.name || "attached-image").trim() || "attached-image",
        detail: String(entry.detail || "Chat image").trim() || "Chat image",
        onRemove: () => input.onRemoveImage(entry.id)
      }));
    });
    (Array.isArray(input.state.askFileUploads) ? input.state.askFileUploads : []).forEach(entry => {
      items.push(createComposerAttachmentCard({
        kind: "file",
        kindLabel: "File",
        badge: "FILE",
        previewUrl: "",
        name: String(entry.fileName || "uploaded-file").trim() || "uploaded-file",
        detail: String(entry.detail || "Reference file").trim() || "Reference file",
        onRemove: () => {
          input.state.askFileUploads = input.state.askFileUploads.filter(item => item.id !== entry.id);
          renderFileUploads();
        }
      }));
    });
    (Array.isArray(input.state.askSkillModelUploads) ? input.state.askSkillModelUploads : []).forEach(entry => {
      items.push(createComposerAttachmentCard({
        kind: "model3d",
        kindLabel: "3D Model",
        badge: "3D",
        previewUrl: "",
        name: String(entry.fileName || "uploaded-model").trim() || "uploaded-model",
        detail: String(entry.detail || "3D model file").trim() || "3D model file",
        onRemove: () => {
          input.state.askSkillModelUploads = input.state.askSkillModelUploads.filter(item => item.id !== entry.id);
          renderModelUploads();
        }
      }));
    });
    (Array.isArray(input.state.askAudioUploads) ? input.state.askAudioUploads : []).forEach(entry => {
      items.push(createComposerAttachmentCard({
        kind: "audio",
        kindLabel: "Audio",
        badge: "AUD",
        previewUrl: "",
        name: String(entry.fileName || "recorded-audio.webm").trim() || "recorded-audio.webm",
        detail: String(entry.detail || "Voice recording").trim() || "Voice recording",
        onRemove: () => {
          input.state.askAudioUploads = input.state.askAudioUploads.filter(item => item.id !== entry.id);
          renderComposerAttachments();
        }
      }));
    });
    tray.classList.toggle("hidden", items.length === 0);
    if (items.length === 0) return;
    const list = createElement("div");
    list.className = "ask-composer-attachment-list";
    items.forEach(item => list.appendChild(item));
    tray.appendChild(list);
  }

  async function addModelUploadsFromFiles(files) {
    const fileEntries = Array.from(files || []);
    if (fileEntries.length === 0) return {added: 0, skipped: 0};
    const uploads = Array.isArray(input.state.askSkillModelUploads) ? input.state.askSkillModelUploads : [];
    input.state.askSkillModelUploads = uploads;
    let added = 0;
    let skipped = 0;
    for (const file of fileEntries) {
      const fileName = String(file?.name || "").trim();
      if (!fileName || !isSupportedModelFile(fileName)) {
        skipped += 1;
        continue;
      }
      const dataUrl = await input.readFileAsDataUrl(file);
      if (!dataUrl || uploads.some(existing => existing.dataUrl === dataUrl)) {
        skipped += 1;
        continue;
      }
      const contentType = String(file.type || "").trim() || "application/octet-stream";
      uploads.push({
        id: createUploadId("ask-model"),
        fileName,
        contentType,
        fileSizeBytes: Number(file.size) || 0,
        detail: contentType + " | " + formatFileSize(file.size),
        dataUrl
      });
      added += 1;
    }
    renderModelUploads();
    return {added, skipped};
  }

  async function addFileUploadsFromFiles(files) {
    const uploads = Array.isArray(input.state.askFileUploads) ? input.state.askFileUploads : [];
    input.state.askFileUploads = uploads;
    let added = 0;
    let skipped = 0;
    for (const file of Array.from(files || [])) {
      const fileName = String(file?.name || "").trim();
      if (!fileName || !isLikelyTextFile(file) || Number(file.size) > maxTextFileBytes) {
        skipped += 1;
        continue;
      }
      const text = await file.text();
      if (!text.trim() || uploads.some(existing => existing.fileName === fileName && existing.text === text)) {
        skipped += 1;
        continue;
      }
      const contentType = String(file.type || "").trim() || "text/plain";
      uploads.push({
        id: createUploadId("ask-file"),
        fileName,
        contentType,
        fileSizeBytes: Number(file.size) || 0,
        detail: contentType + " | " + formatFileSize(file.size),
        text
      });
      added += 1;
    }
    renderFileUploads();
    return {added, skipped};
  }

  return {
    addFileUploadsFromFiles,
    addModelUploadsFromFiles,
    clearFileUploads,
    clearModelUploads,
    formatFileSize,
    isLikelyTextFile,
    isSupportedModelFile,
    renderComposerAttachments,
    renderFileUploads,
    renderModelUploads
  };
}
