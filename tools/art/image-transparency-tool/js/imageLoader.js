import { renderProcessedImage, setStatus } from "./processing.js";

function normalizeFileName(name) {
  const trimmed = String(name || "").trim();
  return trimmed || "tool-image.png";
}

async function createBitmapFromBlob(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {}
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("Failed to decode image."));
      node.src = objectUrl;
    });
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = image.naturalWidth || image.width || 1;
    fallbackCanvas.height = image.naturalHeight || image.height || 1;
    const fallbackContext = fallbackCanvas.getContext("2d", { willReadFrequently: true });
    fallbackContext.drawImage(image, 0, 0);
    return fallbackCanvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createBitmapFromUrl(source) {
  const normalized = String(source || "").trim();
  if (!normalized) {
    throw new Error("No image source was provided.");
  }
  const image = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = () => reject(new Error("Failed to decode image."));
    node.src = normalized;
  });
  const fallbackCanvas = document.createElement("canvas");
  fallbackCanvas.width = image.naturalWidth || image.width || 1;
  fallbackCanvas.height = image.naturalHeight || image.height || 1;
  const fallbackContext = fallbackCanvas.getContext("2d", { willReadFrequently: true });
  fallbackContext.drawImage(image, 0, 0);
  return fallbackCanvas;
}

async function decodeSourceBlob(source) {
  if (source instanceof Blob) {
    return createBitmapFromBlob(source);
  }
  const normalized = String(source || "").trim();
  if (!normalized) {
    throw new Error("No image source was provided.");
  }
  if (/^(data:image\/|blob:|https?:\/\/|\/)/i.test(normalized)) {
    return createBitmapFromUrl(normalized);
  }
  const response = await fetch(normalized, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load image (${response.status}).`);
  }
  return createBitmapFromBlob(await response.blob());
}

function releaseBitmap(bitmap) {
  if (bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }
}

export async function loadImageSource(source, fileName, elements, state) {
  setStatus(elements, "Loading image...", "busy");
  const bitmap = await decodeSourceBlob(source);
  try {
    const width = bitmap.width || bitmap.naturalWidth || 1;
    const height = bitmap.height || bitmap.naturalHeight || 1;
    state.originalCanvas.width = width;
    state.originalCanvas.height = height;
    state.processedCanvas.width = width;
    state.processedCanvas.height = height;
    state.originalContext.clearRect(0, 0, width, height);
    state.originalContext.drawImage(bitmap, 0, 0, width, height);
    const imageData = state.originalContext.getImageData(0, 0, width, height);
    state.originalPixels = new Uint8ClampedArray(imageData.data);
    state.maxAlphaInImage = 0;
    for (let index = 3; index < state.originalPixels.length; index += 4) {
      state.maxAlphaInImage = Math.max(state.maxAlphaInImage, state.originalPixels[index]);
    }
    state.maxAlphaInImage = state.maxAlphaInImage || 255;
    state.sourceFileName = normalizeFileName(fileName);
    state.sourceInfo = { width, height };
    elements.imageInfo.textContent = `${width} × ${height}px`;
    const detectedOpacity = Math.round((state.maxAlphaInImage / 255) * 100);
    elements.opacityRange.value = String(detectedOpacity);
    await renderProcessedImage(elements, state);
  } finally {
    releaseBitmap(bitmap);
  }
}

export async function loadFile(file, elements, state) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }
  await loadImageSource(file, file.name, elements, state);
}

export async function loadDashboardPayload(payload, elements, state) {
  const dataUrl = String(payload?.dataUrl || "").trim();
  const imageUrl = String(payload?.imageUrl || payload?.previewImageUrl || payload?.url || "").trim();
  const fileName = normalizeFileName(payload?.imageFileName || payload?.fileName || payload?.previewFileName);
  const source = dataUrl || imageUrl;
  if (!source) {
    throw new Error("Dashboard did not provide an image payload.");
  }
  await loadImageSource(source, fileName, elements, state);
}
