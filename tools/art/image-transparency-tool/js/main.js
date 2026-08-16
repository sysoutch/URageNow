import { bindDashboardBridge } from "./bridge.js";
import { loadDashboardPayload, loadFile } from "./imageLoader.js";
import { applyDashboardTheme, exportCanvasToBlob, exportImagePayload, renderProcessedImage, setStatus, updateControls } from "./processing.js";
import { createToolState, getDomElements } from "./state.js";

function registerDashboardApi(elements, state) {
  window.__imageTransparencyToolReady = false;
  window.__urageToolLoadAssetPayload = payload => loadDashboardPayload(payload, elements, state);
  window.__urageToolRequestExportImage = () => exportImagePayload(state);
  window.__imageTransparencyToolLoadAssetPayload = payload => loadDashboardPayload(payload, elements, state);
  window.__imageTransparencyToolRequestExportImage = () => exportImagePayload(state);
}

function bindUploadEvents(elements, state) {
  if (!elements.upload) {
    setStatus(elements, "Upload control is missing.", "error");
    return;
  }
  elements.upload.addEventListener("change", async event => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }
    try {
      await loadFile(file, elements, state);
    } catch (error) {
      setStatus(elements, error?.message || "Failed to load image.", "error");
    } finally {
      elements.upload.value = "";
    }
  });
  if (!elements.dropZone) {
    return;
  }
  elements.dropZone.addEventListener("dragover", event => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
  elements.dropZone.addEventListener("dragleave", () => {
    elements.dropZone.classList.remove("is-dragging");
  });
  elements.dropZone.addEventListener("drop", async event => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
    try {
      await loadFile(event.dataTransfer?.files?.[0], elements, state);
    } catch (error) {
      setStatus(elements, error?.message || "Failed to load image.", "error");
    }
  });
}

function bindControlEvents(elements, state) {
  [elements.opacityRange, elements.alphaThreshold, elements.cleanupMode, elements.replacementColor].forEach(control => {
    control.addEventListener("input", () => {
      void renderProcessedImage(elements, state).catch(error => {
        setStatus(elements, error?.message || "Failed to process image.", "error");
      });
    });
  });
  elements.cleanupMode.addEventListener("change", () => {
    void renderProcessedImage(elements, state).catch(error => {
      setStatus(elements, error?.message || "Failed to process image.", "error");
    });
  });
}

function bindDownload(elements, state) {
  elements.downloadBtn.addEventListener("click", async () => {
    if (!state.processedCanvas.width || !state.processedCanvas.height) {
      setStatus(elements, "Load an image first.", "error");
      return;
    }
    try {
      const blob = await exportCanvasToBlob(state.processedCanvas);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${(state.sourceFileName || "transparent-result").replace(/\.[^.]+$/, "")}-transparent.png`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setStatus(elements, `Downloaded ${link.download}`, "ok");
    } catch (error) {
      setStatus(elements, error?.message || "Failed to download image.", "error");
    }
  });
}

export function initTransparencyTool() {
  const elements = getDomElements();
  const state = createToolState();
  state.originalContext = state.originalCanvas.getContext("2d", { willReadFrequently: true });
  state.processedContext = state.processedCanvas.getContext("2d", { willReadFrequently: true });
  updateControls(elements);
  setStatus(elements, "Ready. Load an image to begin.", "idle");
  applyDashboardTheme(document.body.getAttribute("data-dashboard-theme") || "fire");
  bindUploadEvents(elements, state);
  bindControlEvents(elements, state);
  bindDownload(elements, state);
  bindDashboardBridge(elements, state);
  registerDashboardApi(elements, state);
  window.__imageTransparencyToolReady = true;
}
