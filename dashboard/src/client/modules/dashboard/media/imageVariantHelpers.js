function createDashboardImageVariantHelpers(input) {
  const state = input && input.state ? input.state : {};
  const storageKey = "urage-image-studio-variants";
  const definitions = [
    { key: "original", label: "Original", badge: "SRC", detail: "Source image for this variant set." },
    { key: "remove-background", label: "Rem BG", badge: "BG", detail: "Transparent subject cutout." },
    { key: "remove-background-crop", label: "Rem BG + Crop", badge: "CUT", detail: "Cutout with cropped framing." },
    { key: "pixel-art", label: "Pixel", badge: "PXL", detail: "Pixel-art version of the source." },
    { key: "delight", label: "Delight", badge: "LIT", detail: "Texture delight / lighting cleanup." },
    { key: "upscale", label: "Upscale", badge: "2X", detail: "Higher-resolution variant." },
    { key: "normal-map", label: "Normal Map", badge: "NRM", detail: "Generated normal map texture." }
  ];
  const variantState = { sourceId: "" };
  const recordCache = new Map();
  let store = readStore();
  function readStore() {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  function writeStore() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {}
  }
  function clearChildren(node) {
    if (typeof input.clearChildren === "function") {
      input.clearChildren(node);
      return;
    }
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }
  function getSelectedRecord() {
    return typeof input.getSelectedGeneratedImage === "function"
      ? input.getSelectedGeneratedImage()
      : getGeneratedImageById(state.selectedGeneratedImageId);
  }
  function getGeneratedImageById(id) {
    const nextId = String(id || "").trim();
    if (!nextId) {
      return null;
    }
    const record = Array.isArray(state.generatedImages)
      ? state.generatedImages.find(item => item.id === nextId) || null
      : null;
    if (record) {
      rememberRecord(record);
      return record;
    }
    return recordCache.get(nextId) || null;
  }
  function rememberRecord(record) {
    const imageId = String(record?.id || "").trim();
    if (imageId) {
      recordCache.set(imageId, record);
      rememberRecordVariantMetadata(record);
    }
  }
  function getRecordMetadata(record) {
    const metadata = record?.metadata;
    return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  }
  function isKnownVariantKey(key) {
    return definitions.some(definition => definition.key === key && key !== "original");
  }
  function rememberRecordVariantMetadata(record) {
    const imageId = String(record?.id || "").trim();
    const metadata = getRecordMetadata(record);
    const sourceId = String(metadata.imageVariantSourceId || metadata.sourceImageId || "").trim();
    const variantKey = String(metadata.imageVariantKey || "").trim();
    const role = String(metadata.imageVariantRole || "").trim();
    if (!imageId || !sourceId || imageId === sourceId || !isKnownVariantKey(variantKey) || (role && !role.startsWith("variant"))) {
      return;
    }
    const currentMap = getVariantMap(sourceId);
    if (currentMap[variantKey] === imageId) {
      return;
    }
    store = {
      ...store,
      [sourceId]: {
        ...currentMap,
        [variantKey]: imageId
      }
    };
    writeStore();
  }
  function findSourceIdForKnownVariant(imageId) {
    const selectedId = String(imageId || "").trim();
    if (!selectedId) {
      return "";
    }
    for (const [sourceId, map] of Object.entries(store)) {
      const nextSourceId = String(sourceId || "").trim();
      if (!nextSourceId) {
        continue;
      }
      const knownIds = [nextSourceId].concat(Object.values(map && typeof map === "object" && !Array.isArray(map) ? map : {}))
        .map(value => String(value || "").trim())
        .filter(Boolean);
      if (knownIds.includes(selectedId)) {
        return nextSourceId;
      }
    }
    return "";
  }
  function getVariantMap(sourceId) {
    const nextSourceId = String(sourceId || "").trim();
    const map = nextSourceId ? store[nextSourceId] : null;
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }
  function getKnownIds(sourceId) {
    const nextSourceId = String(sourceId || "").trim();
    const map = getVariantMap(nextSourceId);
    return [nextSourceId].concat(Object.values(map)).map(value => String(value || "").trim()).filter(Boolean);
  }
  function resolveSourceRecord(selectedOverride) {
    const selected = selectedOverride || getSelectedRecord();
    const selectedId = String(selected?.id || "").trim();
    rememberRecord(selected);
    const existingSource = getGeneratedImageById(variantState.sourceId);
    if (existingSource && (!selectedId || getKnownIds(existingSource.id).includes(selectedId))) {
      return existingSource;
    }
    const reverseSourceId = findSourceIdForKnownVariant(selectedId);
    const reverseSource = getGeneratedImageById(reverseSourceId);
    if (reverseSource) {
      variantState.sourceId = reverseSourceId;
      return reverseSource;
    }
    if (selectedId) {
      variantState.sourceId = selectedId;
    }
    return selected || null;
  }
  function getActionKey(actionKey, options) {
    if (actionKey === "remove-background") {
      return options?.mode === "lora-crop" ? "remove-background-crop" : "remove-background";
    }
    if (["delight", "upscale", "normal-map", "pixel-art"].includes(actionKey)) {
      return actionKey;
    }
    return "";
  }
  function rememberResult(sourceId, variantKey, record) {
    const nextSourceId = String(sourceId || "").trim();
    const nextVariantKey = String(variantKey || "").trim();
    const imageId = String(record?.id || "").trim();
    if (!nextSourceId || !nextVariantKey || !imageId || nextSourceId === imageId) {
      return;
    }
    rememberRecord(record);
    store = {
      ...store,
      [nextSourceId]: {
        ...getVariantMap(nextSourceId),
        [nextVariantKey]: imageId
      }
    };
    variantState.sourceId = nextSourceId;
    writeStore();
    renderGallery();
  }
  function selectRecord(record) {
    if (!record?.id) {
      return;
    }
    if (typeof input.onSelectRecord === "function") {
      input.onSelectRecord(record);
      return;
    }
    state.selectedGeneratedImageId = record.id;
    state.selectedGeneratedImageIds = [record.id];
    if (typeof input.renderGeneratedImageHistory === "function") {
      input.renderGeneratedImageHistory();
    }
  }
  function createVariantCard(variant) {
    const definition = variant.definition;
    const record = variant.record;
    const card = document.createElement("div");
    card.className = "image-variant-card" + (record?.id && record.id === state.selectedGeneratedImageId ? " active" : "");
    const previewWrap = document.createElement("button");
    previewWrap.className = "image-variant-preview";
    previewWrap.type = "button";
    previewWrap.setAttribute("aria-label", "Select image variant " + definition.label);
    const badge = document.createElement("span");
    badge.className = "image-variant-badge";
    badge.textContent = definition.badge;
    previewWrap.appendChild(badge);
    const img = document.createElement("img");
    img.alt = definition.label + " variant preview";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = input.getGeneratedImageFileUrl(record.id, record.imageFileName);
    previewWrap.appendChild(img);
    previewWrap.addEventListener("click", () => selectRecord(record));
    const body = document.createElement("div");
    body.className = "image-variant-body";
    const title = document.createElement("strong");
    title.textContent = definition.label;
    const detail = document.createElement("small");
    detail.textContent = record.imageFileName || definition.detail;
    body.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "image-variant-actions";
    const select = document.createElement("button");
    select.className = "image-variant-select" + (record.id === state.selectedGeneratedImageId ? " active" : "");
    select.type = "button";
    select.textContent = record.id === state.selectedGeneratedImageId ? "Selected" : "Select";
    select.addEventListener("click", () => selectRecord(record));
    actions.appendChild(select);
    const download = document.createElement("a");
    download.className = "image-variant-download";
    download.href = input.getGeneratedImageFileUrl(record.id, record.imageFileName);
    download.download = record.imageFileName || definition.key + ".png";
    download.textContent = "Download";
    actions.appendChild(download);
    const remove = document.createElement("button");
    remove.className = "image-variant-delete";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (typeof input.onDeleteRecord !== "function") {
        return;
      }
      const deleted = await input.onDeleteRecord(record);
      if (deleted) {
        renderGallery();
      }
    });
    actions.appendChild(remove);
    card.append(previewWrap, body, actions);
    return card;
  }
  function renderGallery() {
    const container = document.getElementById("image-variant-gallery");
    if (!container) {
      return;
    }
    clearChildren(container);
    if (Array.isArray(state.generatedImages)) {
      state.generatedImages.forEach(rememberRecord);
    }
    const source = resolveSourceRecord(getSelectedRecord());
    if (!source?.id) {
      const empty = document.createElement("div");
      empty.className = "image-variant-empty";
      empty.textContent = "Select a generated image to build variants.";
      container.appendChild(empty);
      return;
    }
    const map = getVariantMap(source.id);
    definitions
      .map(definition => ({ definition, record: definition.key === "original" ? source : getGeneratedImageById(map[definition.key]) }))
      .filter(variant => Boolean(variant.record?.id))
      .forEach(variant => container.appendChild(createVariantCard(variant)));
  }
  return {
    getActionKey,
    rememberResult,
    renderGallery,
    resolveSourceRecord,
    state: variantState
  };
}
