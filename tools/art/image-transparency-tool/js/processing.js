export function applyDashboardTheme(theme) {
  if (typeof window.applyDashboardThemeVars === "function") {
    window.applyDashboardThemeVars(theme || document.body.getAttribute("data-dashboard-theme") || "fire");
    return;
  }
  document.body.setAttribute("data-dashboard-theme", String(theme || "fire").trim() || "fire");
}

export function setStatus(elements, text, tone) {
  if (!elements?.status) {
    return;
  }
  elements.status.textContent = String(text || "").trim() || "Ready.";
  elements.status.dataset.statusTone = tone || "idle";
}

export function updateControls(elements) {
  elements.opacityValue.textContent = `${elements.opacityRange.value}%`;
  elements.alphaThresholdValue.textContent = `< ${elements.alphaThreshold.value}`;
  elements.replacementColorField.classList.toggle("is-disabled", elements.cleanupMode.value !== "color");
}

export function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "").padEnd(6, "0").slice(0, 6);
  return {
    r: Number.parseInt(value.slice(0, 2), 16) || 0,
    g: Number.parseInt(value.slice(2, 4), 16) || 0,
    b: Number.parseInt(value.slice(4, 6), 16) || 0
  };
}

export function syncCanvasPreview(elements, state) {
  if (!elements?.canvas || !state?.processedCanvas) {
    return;
  }
  const previewCanvas = elements.canvas;
  const processedCanvas = state.processedCanvas;
  previewCanvas.width = processedCanvas.width || 1;
  previewCanvas.height = processedCanvas.height || 1;
  const previewContext = previewCanvas.getContext("2d");
  if (!previewContext) {
    return;
  }
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.drawImage(processedCanvas, 0, 0);
}

function getProcessedAlpha(alpha, targetOpacity, maxAlphaInImage) {
  if (maxAlphaInImage <= 0) {
    return 0;
  }
  return Math.min(255, Math.round((alpha / maxAlphaInImage) * 255 * targetOpacity));
}

export async function renderProcessedImage(elements, state) {
  if (!state?.originalPixels || !state.originalCanvas.width || !state.originalCanvas.height) {
    return;
  }
  if (state.processing) {
    state.renderQueued = true;
    return;
  }
  state.processing = true;
  state.renderQueued = false;
  setStatus(elements, "Processing image...", "busy");
  updateControls(elements);
  const targetOpacity = Number(elements.opacityRange.value) / 100;
  const threshold = Number(elements.alphaThreshold.value);
  const mode = elements.cleanupMode.value;
  const color = hexToRgb(elements.replacementColor.value);
  const width = state.originalCanvas.width;
  const height = state.originalCanvas.height;
  const processedContext = state.processedContext;
  const newImageData = processedContext.createImageData(width, height);
  const data = newImageData.data;
  const source = state.originalPixels;
  for (let index = 0; index < source.length; index += 4) {
    const originalAlpha = source[index + 3];
    const shouldClean = mode !== "none" && originalAlpha < threshold;
    if (shouldClean && mode === "transparent") {
      data[index] = source[index];
      data[index + 1] = source[index + 1];
      data[index + 2] = source[index + 2];
      data[index + 3] = 0;
      continue;
    }
    if (shouldClean && mode === "color") {
      data[index] = color.r;
      data[index + 1] = color.g;
      data[index + 2] = color.b;
      data[index + 3] = 255;
      continue;
    }
    data[index] = source[index];
    data[index + 1] = source[index + 1];
    data[index + 2] = source[index + 2];
    data[index + 3] = getProcessedAlpha(originalAlpha, targetOpacity, state.maxAlphaInImage);
    if (index > 0 && index % (4 * 120000) === 0) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }
  processedContext.putImageData(newImageData, 0, 0);
  syncCanvasPreview(elements, state);
  setStatus(elements, `Ready: ${state.sourceFileName || "image"}`, "ok");
  state.processing = false;
  if (state.renderQueued) {
    state.renderQueued = false;
    void renderProcessedImage(elements, state);
  }
}

export function exportCanvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("Export failed."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read exported image."));
    reader.readAsDataURL(blob);
  });
}

export async function exportImagePayload(state) {
  if (!state?.processedCanvas || !state.processedCanvas.width || !state.processedCanvas.height) {
    throw new Error("Load an image before exporting.");
  }
  const blob = await exportCanvasToBlob(state.processedCanvas);
  return {
    dataUrl: await readBlobAsDataUrl(blob),
    fileName: buildExportFileName(state.sourceFileName),
    width: state.processedCanvas.width,
    height: state.processedCanvas.height
  };
}

function buildExportFileName(sourceFileName) {
  const safeName = String(sourceFileName || "").trim();
  const base = safeName ? safeName.replace(/\.[^.]+$/, "") : "transparent-result";
  return `${base}-transparent.png`;
}
