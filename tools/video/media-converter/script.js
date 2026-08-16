(() => {
  const state = {
    mode: "video-to-gif",
    sourceFile: null,
    sourceDataUrl: "",
    result: null,
    framePreviewTimerId: 0,
    framePreviewIndex: 0
  };

  const inputNode = document.getElementById("media-source-input");
  const fpsNode = document.getElementById("media-fps-input");
  const widthNode = document.getElementById("media-width-input");
  const convertButton = document.getElementById("media-convert-button");
  const clearButton = document.getElementById("media-clear-button");
  const statusNode = document.getElementById("media-status-line");
  const sourceVideoNode = document.getElementById("media-source-preview");
  const sourceGifNode = document.getElementById("media-source-gif-preview");
  const resultTitleNode = document.getElementById("media-result-title");
  const resultImageNode = document.getElementById("media-result-image");
  const resultMetaNode = document.getElementById("media-result-meta");
  const downloadResultLink = document.getElementById("media-download-result-link");
  const downloadArchiveLink = document.getElementById("media-download-archive-link");
  const previewFramesButton = document.getElementById("media-preview-frames-button");
  const framesPanel = document.getElementById("media-frames-panel");
  const framesGrid = document.getElementById("media-frames-grid");
  const frameCountNode = document.getElementById("media-frame-count");

  function applyDashboardTheme(themeName) {
    document.body.setAttribute("data-dashboard-theme", themeName || "fire");
  }
  function describeCurrentAssets() {
    if (!state.result) {
      return [];
    }
    if (state.result.mode === "video-to-gif" && state.result.resultUrl) {
      return [{
        kind: "gif",
        title: state.result.resultFileName || "converted.gif",
        fileName: state.result.resultFileName || "converted.gif",
        mimeType: "image/gif",
        sourceUrl: state.result.resultUrl,
        previewKind: "gif",
        previewUrl: state.result.resultUrl,
        metadata: {
          inferenceSource: "media-converter",
          mode: state.result.mode,
          sourceFileName: state.result.sourceFileName || ""
        }
      }];
    }
    if (state.result.mode === "video-to-png-frames") {
      const descriptors = [];
      const previewUrl = Array.isArray(state.result.frameUrls) ? String(state.result.frameUrls[0] || "").trim() : "";
      if (state.result.archiveUrl) {
        descriptors.push({
          kind: "file",
          title: state.result.archiveFileName || "frames.zip",
          fileName: state.result.archiveFileName || "frames.zip",
          mimeType: "application/zip",
          sourceUrl: state.result.archiveUrl,
          previewKind: previewUrl ? "image" : "file",
          previewUrl,
          metadata: {
            inferenceSource: "media-converter",
            mode: state.result.mode,
            frameCount: Array.isArray(state.result.frameUrls) ? state.result.frameUrls.length : 0,
            sourceFileName: state.result.sourceFileName || ""
          }
        });
      }
      if (previewUrl) {
        descriptors.push({
          kind: "image",
          title: state.result.sourceFileName || "frame-preview.png",
          fileName: "frame-preview.png",
          mimeType: "image/png",
          sourceUrl: previewUrl,
          previewKind: "image",
          previewUrl,
          metadata: {
            inferenceSource: "media-converter",
            mode: state.result.mode,
            frameCount: Array.isArray(state.result.frameUrls) ? state.result.frameUrls.length : 0
          }
        });
      }
      return descriptors;
    }
    return [];
  }
  function describeCurrentAsset() {
    const described = describeCurrentAssets();
    return Array.isArray(described) ? described[0] || null : described || null;
  }

  function setStatus(text) {
    if (statusNode) {
      statusNode.textContent = String(text || "").trim() || "Ready.";
    }
  }

  function postDashboardMessage(type, payload, requestId) {
    if (!window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage({
      source: "media-converter",
      type,
      requestId: String(requestId || "").trim(),
      payload: payload || {}
    }, "*");
  }

  function clearFramePreviewTimer() {
    if (state.framePreviewTimerId) {
      window.clearTimeout(state.framePreviewTimerId);
      state.framePreviewTimerId = 0;
    }
  }

  function resetResultUi() {
    clearFramePreviewTimer();
    state.result = null;
    state.framePreviewIndex = 0;
    if (resultTitleNode) resultTitleNode.textContent = "Converted Output";
    if (resultMetaNode) resultMetaNode.textContent = "No conversion has run yet.";
    if (resultImageNode) {
      resultImageNode.hidden = true;
      resultImageNode.removeAttribute("src");
    }
    if (downloadResultLink) {
      downloadResultLink.classList.add("hidden");
      downloadResultLink.removeAttribute("href");
      downloadResultLink.removeAttribute("download");
    }
    if (downloadArchiveLink) {
      downloadArchiveLink.classList.add("hidden");
      downloadArchiveLink.removeAttribute("href");
      downloadArchiveLink.removeAttribute("download");
    }
    if (previewFramesButton) {
      previewFramesButton.classList.add("hidden");
      previewFramesButton.textContent = "Preview Frames";
    }
    if (framesPanel) framesPanel.classList.add("hidden");
    if (framesGrid) framesGrid.innerHTML = "";
    if (frameCountNode) frameCountNode.textContent = "0 frames";
  }

  function resetSourcePreview() {
    if (sourceVideoNode) {
      sourceVideoNode.hidden = true;
      sourceVideoNode.pause();
      sourceVideoNode.removeAttribute("src");
      sourceVideoNode.load();
    }
    if (sourceGifNode) {
      sourceGifNode.hidden = true;
      sourceGifNode.removeAttribute("src");
    }
  }

  function renderSourcePreview() {
    resetSourcePreview();
    if (!state.sourceDataUrl || !state.sourceFile) {
      return;
    }
    if (/\.gif$/i.test(state.sourceFile.name) || String(state.sourceFile.type || "").toLowerCase() === "image/gif") {
      if (sourceGifNode) {
        sourceGifNode.hidden = false;
        sourceGifNode.src = state.sourceDataUrl;
      }
      return;
    }
    if (sourceVideoNode) {
      sourceVideoNode.hidden = false;
      sourceVideoNode.src = state.sourceDataUrl;
      sourceVideoNode.load();
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error || new Error("Failed to read media file."));
      reader.readAsDataURL(file);
    });
  }

  async function fetchSourceAsDataUrl(sourceUrl) {
    if (!sourceUrl) {
      throw new Error("No media source URL was provided.");
    }
    const response = await fetch(sourceUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load media source (" + response.status + ").");
    }
    const blob = await response.blob();
    return await readFileAsDataUrl(blob);
  }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : "Request failed.");
    }
    return payload;
  }

  function updateModeUi() {
    document.querySelectorAll("[data-mode]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-mode") === state.mode);
    });
    if (resultTitleNode) {
      resultTitleNode.textContent = state.mode === "video-to-gif" ? "GIF Result" : "PNG Frames Result";
    }
  }

  function renderFrameGrid(frameUrls) {
    if (!framesGrid || !framesPanel || !frameCountNode) {
      return;
    }
    framesGrid.innerHTML = "";
    frameCountNode.textContent = `${frameUrls.length} frame${frameUrls.length === 1 ? "" : "s"}`;
    if (frameUrls.length === 0) {
      framesPanel.classList.add("hidden");
      return;
    }
    frameUrls.forEach((frameUrl, index) => {
      const tile = document.createElement("article");
      tile.className = "frame-tile";
      const image = document.createElement("img");
      image.src = frameUrl;
      image.alt = `Frame ${index + 1}`;
      image.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = `Frame ${index + 1}`;
      tile.appendChild(image);
      tile.appendChild(label);
      framesGrid.appendChild(tile);
    });
    framesPanel.classList.remove("hidden");
  }

  function startFramePreview() {
    clearFramePreviewTimer();
    if (!state.result || !Array.isArray(state.result.frameUrls) || state.result.frameUrls.length === 0 || !resultImageNode) {
      return;
    }
    const frameUrls = state.result.frameUrls;
    const nextFrame = () => {
      if (!resultImageNode || !state.result || !Array.isArray(state.result.frameUrls) || state.result.frameUrls.length === 0) {
        clearFramePreviewTimer();
        return;
      }
      resultImageNode.hidden = false;
      resultImageNode.src = frameUrls[state.framePreviewIndex] || frameUrls[0];
      state.framePreviewIndex = (state.framePreviewIndex + 1) % frameUrls.length;
      state.framePreviewTimerId = window.setTimeout(nextFrame, 1000 / Math.max(1, Number(fpsNode && fpsNode.value) || 12));
    };
    nextFrame();
  }

  function renderConversionResult(result) {
    clearFramePreviewTimer();
    state.result = result;
    state.framePreviewIndex = 0;
    if (result.mode === "video-to-gif") {
      if (resultTitleNode) resultTitleNode.textContent = "GIF Result";
      if (resultMetaNode) resultMetaNode.textContent = `Created GIF from ${result.sourceFileName}.`;
      if (resultImageNode) {
        resultImageNode.hidden = false;
        resultImageNode.src = result.resultUrl;
      }
      if (downloadResultLink) {
        downloadResultLink.classList.remove("hidden");
        downloadResultLink.href = result.resultUrl;
        downloadResultLink.download = result.resultFileName || "converted.gif";
        downloadResultLink.textContent = "Download GIF";
      }
      if (downloadArchiveLink) {
        downloadArchiveLink.classList.add("hidden");
      }
      if (previewFramesButton) {
        previewFramesButton.classList.add("hidden");
      }
      if (framesPanel) {
        framesPanel.classList.add("hidden");
      }
      return;
    }
    if (resultTitleNode) resultTitleNode.textContent = "PNG Frames Result";
    if (resultMetaNode) resultMetaNode.textContent = `Extracted ${result.frameUrls.length} frames from ${result.sourceFileName}.`;
    renderFrameGrid(Array.isArray(result.frameUrls) ? result.frameUrls : []);
    if (downloadResultLink) {
      downloadResultLink.classList.add("hidden");
    }
    if (downloadArchiveLink) {
      if (result.archiveUrl) {
        downloadArchiveLink.classList.remove("hidden");
        downloadArchiveLink.href = result.archiveUrl;
        downloadArchiveLink.download = result.archiveFileName || "frames.zip";
        downloadArchiveLink.textContent = "Download Frame ZIP";
      } else {
        downloadArchiveLink.classList.add("hidden");
      }
    }
    if (previewFramesButton) {
      previewFramesButton.classList.remove("hidden");
      previewFramesButton.textContent = "Preview Frames";
    }
    startFramePreview();
  }

  async function handleFileSelection(file) {
    state.sourceFile = file || null;
    state.sourceDataUrl = file ? await readFileAsDataUrl(file) : "";
    resetResultUi();
    renderSourcePreview();
    setStatus(file ? `Loaded ${file.name}.` : "Upload a video or GIF to begin.");
  }

  async function handleConvert() {
    if (!state.sourceFile || !state.sourceDataUrl) {
      setStatus("Upload a video or GIF first.");
      return;
    }
    try {
      convertButton.disabled = true;
      setStatus("Converting media with ffmpeg...");
      resetResultUi();
      const result = await requestJson("/api/media-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: state.mode,
          sourceDataUrl: state.sourceDataUrl,
          sourceFileName: state.sourceFile.name,
          fps: Number(fpsNode && fpsNode.value) || 12,
          width: Number(widthNode && widthNode.value) || 512
        })
      });
      renderConversionResult(result);
      setStatus(state.mode === "video-to-gif" ? "GIF created successfully." : "PNG frames created successfully from the uploaded media.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Media conversion failed.");
    } finally {
      convertButton.disabled = false;
    }
  }

  async function loadAutomationSource(payload) {
    const input = payload && typeof payload === "object" ? payload : {};
    const sourceDataUrl = String(input.sourceDataUrl || "").trim() || await fetchSourceAsDataUrl(String(input.sourceUrl || input.mediaUrl || input.videoUrl || "").trim());
    const sourceFileName = String(input.sourceFileName || input.fileName || input.videoFileName || "dashboard-video.mp4").trim() || "dashboard-video.mp4";
    state.mode = input.mode === "video-to-png-frames" ? "video-to-png-frames" : "video-to-gif";
    state.sourceFile = {
      name: sourceFileName,
      type: sourceDataUrl.match(/^data:([^;,]+)/i)?.[1] || "video/mp4"
    };
    state.sourceDataUrl = sourceDataUrl;
    if (fpsNode && input.fps) fpsNode.value = String(input.fps);
    if (widthNode && input.width) widthNode.value = String(input.width);
    updateModeUi();
    resetResultUi();
    renderSourcePreview();
    setStatus("Loaded " + sourceFileName + ".");
  }

  async function convertAutomationSource(payload) {
    await loadAutomationSource(payload);
    setStatus("Converting media with ffmpeg...");
    const result = await requestJson("/api/media-convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: state.mode,
        sourceDataUrl: state.sourceDataUrl,
        sourceFileName: state.sourceFile.name,
        fps: Number(fpsNode && fpsNode.value) || 12,
        width: Number(widthNode && widthNode.value) || 512
      })
    });
    renderConversionResult(result);
    setStatus(state.mode === "video-to-gif" ? "GIF created successfully." : "PNG frames created successfully from the uploaded media.");
    return result;
  }

  function clearAll() {
    clearFramePreviewTimer();
    state.sourceFile = null;
    state.sourceDataUrl = "";
    if (inputNode) {
      inputNode.value = "";
    }
    resetSourcePreview();
    resetResultUi();
    setStatus("Upload a video or GIF to begin.");
  }

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => {
      state.mode = button.getAttribute("data-mode") === "video-to-png-frames" ? "video-to-png-frames" : "video-to-gif";
      updateModeUi();
      resetResultUi();
    });
  });

  if (inputNode) {
    inputNode.addEventListener("change", async event => {
      const nextFile = event.currentTarget && event.currentTarget.files ? event.currentTarget.files[0] : null;
      if (!nextFile) {
        return;
      }
      await handleFileSelection(nextFile);
    });
  }

  if (convertButton) {
    convertButton.addEventListener("click", () => {
      void handleConvert();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", clearAll);
  }

  if (previewFramesButton) {
    previewFramesButton.addEventListener("click", () => {
      if (state.framePreviewTimerId) {
        clearFramePreviewTimer();
        previewFramesButton.textContent = "Preview Frames";
        return;
      }
      previewFramesButton.textContent = "Stop Preview";
      state.framePreviewIndex = 0;
      startFramePreview();
    });
  }

  window.__URAGE_MEDIA_CONVERTER_AUTOMATION_RECEIVE__ = async payload => {
    try {
      const result = await convertAutomationSource(payload);
      postDashboardMessage("media-converter:converted", result, payload && payload.requestId);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media conversion failed.";
      setStatus(message);
      postDashboardMessage("media-converter:error", { error: message }, payload && payload.requestId);
      throw error;
    }
  };

  window.addEventListener("message", event => {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== "urage-dashboard" || (message.type !== "media-converter:convert" && message.type !== "tool:load-asset")) {
      return;
    }
    const requestId = String(message.requestId || "").trim();
    if (message.type === "tool:load-asset") {
      void loadAutomationSource(message.payload || {}).catch(error => {
        setStatus(error instanceof Error ? error.message : "Failed to load dashboard media.");
      });
      return;
    }
    void window.__URAGE_MEDIA_CONVERTER_AUTOMATION_RECEIVE__({
      ...(message.payload || {}),
      requestId
    }).catch(() => undefined);
  });

  updateModeUi();
  if (typeof window.registerDashboardToolBridge === "function") {
    window.registerDashboardToolBridge({
      onDescribeCurrentAssets: describeCurrentAssets,
      onDescribeCurrentAsset: describeCurrentAsset,
      onTheme: applyDashboardTheme
    });
  } else {
    window.__urageToolDescribeCurrentAsset = describeCurrentAsset;
  }
  if (typeof window.registerDashboardThemeSync === "function") {
    window.registerDashboardThemeSync((themeName, tokens) => {
      document.documentElement.style.setProperty("--tool-bg", tokens.bg);
      document.documentElement.style.setProperty("--tool-surface", tokens.surface);
      document.documentElement.style.setProperty("--tool-surface-strong", tokens.surfaceStrong);
      document.documentElement.style.setProperty("--tool-line", tokens.line);
      document.documentElement.style.setProperty("--tool-line-strong", tokens.lineStrong);
      document.documentElement.style.setProperty("--tool-text", tokens.text);
      document.documentElement.style.setProperty("--tool-muted", tokens.muted);
      document.documentElement.style.setProperty("--tool-accent", tokens.accent);
      document.documentElement.style.setProperty("--tool-accent-strong", tokens.accentStrong);
      applyDashboardTheme(themeName);
    });
  } else {
    applyDashboardTheme(document.body.getAttribute("data-dashboard-theme") || "fire");
  }
})();
