async function uploadModelImageFile(file) {
  if (!file || !(file.type || "").startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const dataUrl = await readFileAsDataUrl(file);
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(dataUrl)) {
    throw new Error("Only image files are supported.");
  }
  return request("/api/model-image-upload", {
    fileName: file.name || "model-source.png",
    dataUrl
  });
}

function getClipboardImageFiles(event) {
  const files = Array.from(event?.clipboardData?.files || []).filter(file => file && (file.type || "").startsWith("image/"));
  if (files.length > 0) {
    return files;
  }
  return Array.from(event?.clipboardData?.items || [])
    .filter(item => item && item.kind === "file" && (item.type || "").startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(file => file && (file.type || "").startsWith("image/"));
}

async function readClipboardImageFiles() {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
    throw new Error("This browser cannot read clipboard images from a button. Focus the source image area and press Ctrl+V instead.");
  }
  const files = [];
  const clipboardItems = await navigator.clipboard.read();
  for (const item of clipboardItems) {
    const imageType = Array.from(item.types || []).find(type => String(type || "").startsWith("image/"));
    if (!imageType) continue;
    const blob = await item.getType(imageType);
    const extension = imageType.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") || "png";
    files.push(new File([blob], "clipboard-model-source." + extension, {type: imageType}));
  }
  return files;
}

async function applyUploadedModelImageFiles(files, targetInputId, label, allowMultiple) {
  const targetInput = document.getElementById(targetInputId);
  if (!targetInput) {
    return;
  }
  const imageFiles = Array.from(files || []).filter(file => file && (file.type || "").startsWith("image/"));
  if (imageFiles.length === 0) {
    return;
  }
  const uploadedPaths = [];
  for (const file of imageFiles) {
    const uploaded = await uploadModelImageFile(file);
    if (uploaded && uploaded.path) {
      uploadedPaths.push(uploaded.path);
    }
  }
  if (uploadedPaths.length === 0) {
    return;
  }
  if (allowMultiple === true) {
    const existing = String(targetInput.value || "").split(/\r?\n/).map(entry => entry.trim()).filter(Boolean);
    const unique = new Set(existing);
    uploadedPaths.forEach(entry => unique.add(entry));
    targetInput.value = Array.from(unique).join("\n");
  } else {
    targetInput.value = uploadedPaths[0] || "";
  }
  targetInput.dispatchEvent(new Event("input", { bubbles: true }));
  targetInput.dispatchEvent(new Event("change", { bubbles: true }));
  setOutput(label + " image" + (uploadedPaths.length === 1 ? "" : "s") + " uploaded.");
}

async function applyUploadedModelImage(fileInputId, targetInputId, label) {
  const fileInput = document.getElementById(fileInputId);
  if (!fileInput) {
    return;
  }
  await applyUploadedModelImageFiles(fileInput.files || [], targetInputId, label, fileInput.multiple === true);
  fileInput.value = "";
}

function wireModelImagePicker(buttonId, fileInputId, targetInputId, label, pasteTargetIds = [], pasteButtonId = "") {
  const browseButton = document.getElementById(buttonId);
  const fileInput = document.getElementById(fileInputId);
  if (!browseButton || !fileInput) {
    return;
  }
  browseButton.addEventListener("click", () => {
    fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    try {
      await applyUploadedModelImage(fileInputId, targetInputId, label);
    } catch (error) {
      setOutput((label || "Model source") + " upload failed: " + ((error && error.message) || "Unknown error"));
    }
  });
  [buttonId, ...pasteTargetIds].forEach(targetId => {
    const targetNode = document.getElementById(targetId);
    if (!targetNode) {
      return;
    }
    targetNode.addEventListener("paste", async event => {
      const files = getClipboardImageFiles(event);
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      try {
        await applyUploadedModelImageFiles(files, targetInputId, label, fileInput.multiple === true);
        setOutput((label || "Model source") + " image" + (files.length === 1 ? "" : "s") + " pasted from clipboard.");
      } catch (error) {
        setOutput((label || "Model source") + " paste failed: " + ((error && error.message) || "Unknown error"));
      }
    });
  });
  const pasteButton = pasteButtonId ? document.getElementById(pasteButtonId) : null;
  pasteButton?.addEventListener("click", async () => {
    pasteButton.disabled = true;
    try {
      const files = await readClipboardImageFiles();
      if (files.length === 0) {
        throw new Error("Clipboard does not contain an image.");
      }
      await applyUploadedModelImageFiles(files, targetInputId, label, fileInput.multiple === true);
      setOutput((label || "Model source") + " image" + (files.length === 1 ? "" : "s") + " pasted from clipboard.");
    } catch (error) {
      setOutput((label || "Model source") + " paste failed: " + ((error && error.message) || "Unknown error"));
    } finally {
      pasteButton.disabled = false;
    }
  });
}

async function filesToAiImages(files) {
  const images = [];
  for (const file of Array.from(files || [])) {
    if (!file || !(file.type || "").startsWith("image/")) {
      continue;
    }
    const dataUrl = await readFileAsDataUrl(file);
    images.push({
      id: createImageId(),
      sourceType: "file",
      value: dataUrl,
      name: file.name || "Dropped image",
      detail: file.type || "Image file",
      previewUrl: dataUrl
    });
  }
  return images;
}

function renderImageList(containerId, images, emptyText, removeImage) {
  const container = document.getElementById(containerId);
  clearChildren(container);
  if (images.length === 0) {
    const empty = document.createElement("div");
    empty.className = "item";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  for (const image of images) {
    const row = document.createElement("div");
    row.className = "ai-image-entry";
    if (image.previewUrl) {
      const preview = document.createElement("img");
      preview.className = "ai-image-preview";
      preview.src = image.previewUrl;
      preview.alt = image.name;
      row.appendChild(preview);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "ai-image-fallback";
      fallback.textContent = "🖼️";
      row.appendChild(fallback);
    }
    const meta = document.createElement("div");
    meta.className = "ai-image-meta";
    const name = document.createElement("div");
    name.className = "ai-image-name";
    name.textContent = image.name || "";
    const detail = document.createElement("div");
    detail.className = "ai-image-kind";
    detail.textContent = image.detail || "";
    meta.append(name, detail);
    row.appendChild(meta);
    const removeButton = document.createElement("button");
    removeButton.className = "secondary mini-button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      removeImage(image.id);
    });
    row.appendChild(removeButton);
    container.appendChild(row);
  }
}
