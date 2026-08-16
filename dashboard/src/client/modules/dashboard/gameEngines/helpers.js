function createDashboardGameEngineHelpers(input) {
  const preferredEngineStorageKey = "urage-game-engine-preferred-target";
  const clearChildren = typeof input?.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback(node) {
    while (node?.firstChild) node.removeChild(node.firstChild);
  };
  let activeContext = null;

  function toAbsoluteUrl(value) {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (/^(?:https?:)?\/\//i.test(normalized) || /^data:/i.test(normalized)) return normalized;
    return typeof input.buildAbsoluteDashboardUrl === "function" ? input.buildAbsoluteDashboardUrl(normalized) : normalized;
  }

  function readPreferredEngine() {
    try {
      const stored = window.localStorage.getItem(preferredEngineStorageKey);
      return stored === "unity" || stored === "unreal" || stored === "godot" ? stored : "unity";
    } catch {
      return "unity";
    }
  }

  function writePreferredEngine(value) {
    try {
      window.localStorage.setItem(preferredEngineStorageKey, value);
    } catch {}
  }

  function getEngineLabel(value) {
    if (value === "godot") return "Godot";
    if (value === "unreal") return "Unreal";
    return "Unity";
  }

  function inferMimeTypeFromFileName(fileName, fallback) {
    const normalized = String(fileName || "").trim().toLowerCase();
    if (normalized.endsWith(".png")) return "image/png";
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
    if (normalized.endsWith(".webp")) return "image/webp";
    if (normalized.endsWith(".gif")) return "image/gif";
    if (normalized.endsWith(".glb")) return "model/gltf-binary";
    if (normalized.endsWith(".gltf")) return "model/gltf+json";
    if (normalized.endsWith(".fbx")) return "model/fbx";
    if (normalized.endsWith(".obj")) return "model/obj";
    if (normalized.endsWith(".mp4")) return "video/mp4";
    if (normalized.endsWith(".webm")) return "video/webm";
    if (normalized.endsWith(".mov")) return "video/quicktime";
    if (normalized.endsWith(".mp3")) return "audio/mpeg";
    if (normalized.endsWith(".wav")) return "audio/wav";
    if (normalized.endsWith(".ogg")) return "audio/ogg";
    if (normalized.endsWith(".txt")) return "text/plain";
    if (normalized.endsWith(".md")) return "text/markdown";
    return String(fallback || "").trim();
  }

  function isImageResourceKind(value) {
    return value === "image" || value === "gif";
  }

  function createPreviewElement(entry) {
    const resourceKind = String(entry?.previewKind || entry?.resourceKind || "").trim().toLowerCase();
    const sourceUrl = toAbsoluteUrl(entry?.previewUrl || entry?.sourceUrl);
    if (sourceUrl && isImageResourceKind(resourceKind)) {
      const image = document.createElement("img");
      image.className = "game-engine-send-preview-media is-image";
      image.alt = String(entry?.fileName || entry?.title || "Selected resource preview");
      image.loading = "eager";
      image.src = sourceUrl;
      return image;
    }
    if (sourceUrl && resourceKind === "video") {
      const video = document.createElement("video");
      video.className = "game-engine-send-preview-media is-video";
      video.src = sourceUrl;
      video.controls = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      return video;
    }
    if (sourceUrl && (resourceKind === "audio" || resourceKind === "music")) {
      const audio = document.createElement("audio");
      audio.className = "game-engine-send-preview-audio";
      audio.src = sourceUrl;
      audio.controls = true;
      audio.preload = "metadata";
      return audio;
    }
    if (resourceKind === "text") {
      const pre = document.createElement("pre");
      pre.className = "game-engine-send-preview-text";
      pre.textContent = String(entry?.previewText || entry?.textContent || "No text preview available.");
      return pre;
    }
    const placeholder = document.createElement("div");
    placeholder.className = "game-engine-send-preview-placeholder";
    const badge = document.createElement("span");
    badge.className = "game-engine-send-preview-badge";
    badge.textContent = resourceKind === "model3d" ? "3D Model" : (entry?.resourceKind || "File");
    placeholder.appendChild(badge);
    const label = document.createElement("strong");
    label.textContent = String(entry?.fileName || entry?.title || "Selected resource");
    placeholder.appendChild(label);
    const hint = document.createElement("small");
    hint.textContent = sourceUrl
      ? "This file will be queued as-is for the selected engine importer."
      : "Preview is not available for this resource type yet.";
    placeholder.appendChild(hint);
    return placeholder;
  }

  function resolveSelectedOption() {
    if (!activeContext) return null;
    const optionId = String(document.getElementById("game-engine-send-option")?.value || "").trim();
    return activeContext.options.find(option => option.id === optionId) || activeContext.options[0] || null;
  }

  function updateOverlayPreview() {
    const previewStage = document.getElementById("game-engine-send-preview-stage");
    const previewLabel = document.getElementById("game-engine-send-preview-label");
    const previewMeta = document.getElementById("game-engine-send-preview-meta");
    if (!previewStage) return;
    clearChildren(previewStage);
    const selectedOption = resolveSelectedOption();
    const entry = selectedOption?.entries?.[0] || null;
    if (!selectedOption || !entry) {
      const empty = document.createElement("div");
      empty.className = "game-engine-send-preview-placeholder";
      const label = document.createElement("strong");
      label.textContent = "No preview available";
      empty.appendChild(label);
      const hint = document.createElement("small");
      hint.textContent = "Choose a studio resource first.";
      empty.appendChild(hint);
      previewStage.appendChild(empty);
      if (previewLabel) previewLabel.textContent = "No resource selected";
      if (previewMeta) previewMeta.textContent = "";
      return;
    }
    previewStage.appendChild(createPreviewElement(entry));
    if (previewLabel) previewLabel.textContent = String(entry.fileName || entry.title || selectedOption.label || "Selected resource");
    if (previewMeta) {
      const extraCount = Array.isArray(selectedOption.entries) ? selectedOption.entries.length : 0;
      const resourceKindLabel = String(entry.resourceKind || "file").toUpperCase();
      previewMeta.textContent = extraCount > 1
        ? `${resourceKindLabel} • ${extraCount} files will be queued`
        : resourceKindLabel;
    }
  }

  function openOverlay(context) {
    const overlay = document.getElementById("game-engine-send-overlay");
    const sourceName = document.getElementById("game-engine-send-source-name");
    const sourceDetail = document.getElementById("game-engine-send-source-detail");
    const titleInput = document.getElementById("game-engine-send-title");
    const engineSelect = document.getElementById("game-engine-send-engine");
    const optionField = document.getElementById("game-engine-send-option-field");
    const optionSelect = document.getElementById("game-engine-send-option");
    const optionHint = document.getElementById("game-engine-send-option-hint");
    const help = document.getElementById("game-engine-send-help");
    if (!overlay || !engineSelect) {
      return;
    }
    activeContext = context;
    if (sourceName) sourceName.textContent = context.sourceName;
    if (sourceDetail) sourceDetail.textContent = context.sourceDetail;
    if (titleInput) titleInput.value = context.title;
    engineSelect.value = readPreferredEngine();
    if (optionSelect) {
      clearChildren(optionSelect);
      context.options.forEach(option => {
        const node = document.createElement("option");
        node.value = option.id;
        node.textContent = option.label;
        optionSelect.appendChild(node);
      });
      optionSelect.value = context.defaultOptionId || (context.options[0]?.id || "");
    }
    if (optionField) optionField.classList.toggle("hidden", context.options.length <= 1);
    if (optionHint) {
      const currentOption = context.options.find(option => option.id === (optionSelect?.value || context.defaultOptionId)) || context.options[0] || null;
      optionHint.textContent = currentOption ? currentOption.hint : "";
    }
    if (help) {
      help.textContent = "The dashboard already acts as the local export server. Unity and Godot importer support are ready now; Unreal queue entries stay ready until its importer is added.";
    }
    updateOverlayPreview();
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("runtime-overlay-open");
    window.setTimeout(() => {
      titleInput?.focus();
      titleInput?.select?.();
    }, 0);
  }

  function closeOverlay() {
    const overlay = document.getElementById("game-engine-send-overlay");
    if (!overlay) {
      return;
    }
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("runtime-overlay-open");
    activeContext = null;
  }

  function getSelectedGeneratedImage() {
    return Array.isArray(input.state.generatedImages)
      ? input.state.generatedImages.find(entry => entry.id === input.state.selectedGeneratedImageId) || null
      : null;
  }

  function getSelectedGeneratedVideo() {
    return Array.isArray(input.state.generatedVideos)
      ? input.state.generatedVideos.find(entry => entry.id === input.state.selectedGeneratedVideoId) || null
      : null;
  }

  function getSelectedGeneratedAudio(mode) {
    const targetId = mode === "music" ? input.state.selectedGeneratedMusicId : input.state.selectedGeneratedAudioId;
    return Array.isArray(input.state.generatedAudios)
      ? input.state.generatedAudios.find(entry => entry.id === targetId && entry.mode === mode) || null
      : null;
  }

  function buildAskContext() {
    const promptValue = String(document.getElementById("ask-prompt")?.value || "").trim();
    const latestBody = document.querySelector("#ask-chat-messages [data-ask-message-id]:last-child .chat-bubble-body");
    const latestText = String(latestBody?.textContent || "").trim();
    const text = latestText || promptValue;
    if (!text) {
      input.setOutput("No Ask LazyDev text is ready to send.");
      return null;
    }
    return {
      sourceStudio: "ask",
      title: "LazyDev-chat-note",
      sourceName: "Ask LazyDev Text",
      sourceDetail: latestText ? "Using the latest visible chat bubble text." : "Using the current Ask prompt composer text.",
      options: [{
        id: "text",
        label: "Text Note",
        hint: "Creates a text asset in the engine import pool.",
        entries: [{
          title: "Ask LazyDev Text",
          resourceKind: "text",
          fileName: "LazyDev-chat-note.txt",
          mimeType: "text/plain",
          textContent: text,
          previewKind: "text",
          previewText: text,
          metadata: { source: latestText ? "chat-message" : "composer" }
        }]
      }],
      defaultOptionId: "text"
    };
  }

  function buildImageContext() {
    const previewPanel = document.getElementById("image-studio-preview-panel");
    const previewKind = String(previewPanel?.dataset.enginePreviewKind || "").trim();
    const previewUrl = String(previewPanel?.dataset.enginePreviewUrl || "").trim();
    const previewFileName = String(previewPanel?.dataset.enginePreviewFileName || "").trim();
    const selected = getSelectedGeneratedImage();
    const selectedUrl = selected?.id && selected?.imageFileName
      ? input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(selected.id, selected.imageFileName))
      : "";
    if (previewUrl && (previewKind === "gif" || previewKind === "video")) {
      return {
        sourceStudio: "image",
        title: previewFileName || "image-preview",
        sourceName: previewFileName || "Current Preview Media",
        sourceDetail: "Using the active Image Studio preview media.",
        options: [{
          id: "preview",
          label: previewKind === "gif" ? "Preview GIF" : "Preview Video",
          hint: previewKind === "gif" ? "Sends the current GIF preview." : "Sends the current video preview.",
          entries: [{
            title: previewFileName || "Image Studio Preview",
            resourceKind: previewKind === "gif" ? "gif" : "video",
            fileName: previewFileName || (previewKind === "gif" ? "image-preview.gif" : "image-preview.mp4"),
            mimeType: inferMimeTypeFromFileName(previewFileName, previewKind === "gif" ? "image/gif" : "video/mp4"),
            sourceUrl: input.buildAbsoluteDashboardUrl(previewUrl),
            previewKind,
            previewUrl: input.buildAbsoluteDashboardUrl(previewUrl),
            metadata: { selectedImageId: selected?.id || "" }
          }]
        }],
        defaultOptionId: "preview"
      };
    }
    if (!selected || !selected.id || !selected.imageFileName) {
      input.setOutput("Select a generated image or preview media first.");
      return null;
    }
    return {
      sourceStudio: "image",
      title: selected.imageFileName,
      sourceName: selected.imageFileName,
      sourceDetail: "Using the selected generated image.",
      options: [{
        id: "image",
        label: "Generated Image",
        hint: "Sends the selected generated image file.",
        entries: [{
          title: selected.imageFileName,
          resourceKind: "image",
          fileName: selected.imageFileName,
          mimeType: inferMimeTypeFromFileName(selected.imageFileName, "image/png"),
          sourceUrl: selectedUrl,
          previewKind: "image",
          previewUrl: selectedUrl,
          metadata: { imageId: selected.id }
        }]
      }],
      defaultOptionId: "image"
    };
  }

  function buildModelOption(selected, option) {
    const previewImageUrl = toAbsoluteUrl(selected.lowPolyPreviewImageUrl || selected.previewImageUrl || "");
    const previewGifUrl = toAbsoluteUrl(selected.lowPolyPreviewGifUrl || selected.previewGifUrl || "");
    return {
      ...option,
      sourceName: selected.modelFileName || selected.originalModelFileName || "Selected Model",
      sourceDetail: selected.id ? "Model ID: " + selected.id : "Selected 3D model.",
      entries: Array.isArray(option.entries) ? option.entries.map(entry => ({
        previewKind: entry.resourceKind === "gif" ? "gif" : (entry.resourceKind === "image" ? "image" : "model3d"),
        previewUrl: entry.resourceKind === "gif"
          ? toAbsoluteUrl(entry.sourceUrl || previewGifUrl || previewImageUrl)
          : (entry.resourceKind === "image" ? toAbsoluteUrl(entry.sourceUrl || previewImageUrl || previewGifUrl) : (previewImageUrl || previewGifUrl || "")),
        ...entry
      })) : []
    };
  }

  function buildModelContext() {
    const selected = typeof input.getSelectedGeneratedModel === "function" ? input.getSelectedGeneratedModel() : null;
    if (!selected || !selected.id) {
      input.setOutput("Select a generated 3D model first.");
      return null;
    }
    const options = [];
    const addSingleFileOption = (id, label, hint, resourceKind, fileName, fallbackMime, metadata) => {
      if (!fileName) {
        return;
      }
      options.push(buildModelOption(selected, {
        id,
        label,
        hint,
        entries: [{
          title: fileName,
          resourceKind,
          fileName,
          mimeType: inferMimeTypeFromFileName(fileName, fallbackMime),
          sourceUrl: input.buildAbsoluteDashboardUrl(input.getModel3dFileUrl(selected.id, fileName)),
          metadata
        }]
      }));
    };
    addSingleFileOption("current-model", "Current Model", "Sends the current generated model asset.", "model3d", selected.modelFileName, "model/gltf-binary", { modelId: selected.id, variant: "current" });
    addSingleFileOption("original-model", "Original Model", "Sends the original pre-edit model file.", "model3d", selected.originalModelFileName, "model/gltf-binary", { modelId: selected.id, variant: "original" });
    addSingleFileOption("lowpoly-model", "Lowpoly Model", "Sends the lowpoly variant if one exists.", "model3d", selected.lowPolyModelFileName, "model/gltf-binary", { modelId: selected.id, variant: "lowpoly" });
    addSingleFileOption("preview-gif", "Preview GIF", "Sends the main turntable GIF preview.", "gif", selected.previewGifFileName, "image/gif", { modelId: selected.id, variant: "preview-gif" });
    addSingleFileOption("preview-image", "Preview Image", "Sends the main preview render image.", "image", selected.previewImageFileName, "image/png", { modelId: selected.id, variant: "preview-image" });
    addSingleFileOption("lowpoly-preview-gif", "Lowpoly GIF", "Sends the lowpoly turntable GIF preview.", "gif", selected.lowPolyPreviewGifFileName, "image/gif", { modelId: selected.id, variant: "lowpoly-preview-gif" });
    addSingleFileOption("lowpoly-preview-image", "Lowpoly Preview Image", "Sends the lowpoly preview image.", "image", selected.lowPolyPreviewImageFileName, "image/png", { modelId: selected.id, variant: "lowpoly-preview-image" });
    addSingleFileOption("uv-map", "UV Map", "Sends the UV map texture.", "image", selected.uvMapFileName, "image/png", { modelId: selected.id, variant: "uv-map" });
    addSingleFileOption("uv-map-inpaint", "UV Map Inpaint", "Sends the UV inpaint texture.", "image", selected.uvMapInpaintFileName, "image/png", { modelId: selected.id, variant: "uv-map-inpaint" });
    addSingleFileOption("normal-map", "Normal Map", "Sends the generated normal map texture.", "image", selected.normalMapFileName, "image/png", { modelId: selected.id, variant: "normal-map" });
    if (Array.isArray(selected.multiViewFileNames) && selected.multiViewFileNames.length > 0) {
      options.push(buildModelOption(selected, {
        id: "multi-view",
        label: "All Multi View Images",
        hint: "Queues every generated multi view texture image as separate imports.",
        entries: selected.multiViewFileNames.map((fileName, index) => ({
          title: fileName || ("multi-view-" + (index + 1) + ".png"),
          resourceKind: "image",
          fileName: fileName || ("multi-view-" + (index + 1) + ".png"),
          mimeType: inferMimeTypeFromFileName(fileName, "image/png"),
          sourceUrl: input.buildAbsoluteDashboardUrl(input.getModel3dFileUrl(selected.id, fileName)),
          previewKind: "image",
          previewUrl: input.buildAbsoluteDashboardUrl(input.getModel3dFileUrl(selected.id, fileName)),
          metadata: { modelId: selected.id, variant: "multi-view", viewIndex: index + 1 }
        }))
      }));
    }
    if (options.length === 0) {
      input.setOutput("The selected model does not expose a sendable file yet.");
      return null;
    }
    return {
      sourceStudio: "model3d",
      title: selected.modelFileName || selected.originalModelFileName || "selected-model",
      sourceName: selected.modelFileName || selected.originalModelFileName || "Selected Model",
      sourceDetail: "Choose which 3D artifact to send into the engine import pool.",
      options,
      defaultOptionId: options[0].id
    };
  }

  function buildVideoContext() {
    const selected = getSelectedGeneratedVideo();
    if (!selected || !selected.id || !selected.videoFileName) {
      input.setOutput("Select a generated video first.");
      return null;
    }
    return {
      sourceStudio: "video",
      title: selected.videoFileName,
      sourceName: selected.videoFileName,
      sourceDetail: "Using the selected generated video.",
      options: [{
        id: "video",
        label: "Generated Video",
        hint: "Sends the selected generated video file.",
        entries: [{
          title: selected.videoFileName,
          resourceKind: "video",
          fileName: selected.videoFileName,
          mimeType: inferMimeTypeFromFileName(selected.videoFileName, "video/mp4"),
          sourceUrl: input.buildAbsoluteDashboardUrl(input.getGeneratedVideoFileUrl(selected.id, selected.videoFileName)),
          previewKind: "video",
          previewUrl: input.buildAbsoluteDashboardUrl(input.getGeneratedVideoFileUrl(selected.id, selected.videoFileName)),
          metadata: { videoId: selected.id }
        }]
      }],
      defaultOptionId: "video"
    };
  }

  function buildAudioContext(mode) {
    const selected = getSelectedGeneratedAudio(mode);
    if (!selected || !selected.id || !selected.audioFileName) {
      input.setOutput("Select a generated " + (mode === "music" ? "music track" : "audio clip") + " first.");
      return null;
    }
    return {
      sourceStudio: mode,
      title: selected.audioFileName,
      sourceName: selected.audioFileName,
      sourceDetail: "Using the selected generated " + (mode === "music" ? "music track." : "audio clip."),
      options: [{
        id: mode,
        label: mode === "music" ? "Generated Music" : "Generated Audio",
        hint: "Sends the selected " + (mode === "music" ? "music" : "audio") + " file.",
        entries: [{
          title: selected.audioFileName,
          resourceKind: mode === "music" ? "music" : "audio",
          fileName: selected.audioFileName,
          mimeType: inferMimeTypeFromFileName(selected.audioFileName, "audio/mpeg"),
          sourceUrl: input.buildAbsoluteDashboardUrl(input.getGeneratedAudioFileUrl(selected.id, selected.audioFileName)),
          previewKind: mode === "music" ? "music" : "audio",
          previewUrl: input.buildAbsoluteDashboardUrl(input.getGeneratedAudioFileUrl(selected.id, selected.audioFileName)),
          metadata: { audioId: selected.id, mode }
        }]
      }],
      defaultOptionId: mode
    };
  }

  function buildContext(kind) {
    if (kind === "ask") return buildAskContext();
    if (kind === "image") return buildImageContext();
    if (kind === "model3d") return buildModelContext();
    if (kind === "video") return buildVideoContext();
    if (kind === "music") return buildAudioContext("music");
    return buildAudioContext("audio");
  }

  async function submitActiveContext() {
    const engine = String(document.getElementById("game-engine-send-engine")?.value || "").trim();
    const optionId = String(document.getElementById("game-engine-send-option")?.value || "").trim();
    const customTitle = String(document.getElementById("game-engine-send-title")?.value || "").trim();
    const button = document.getElementById("game-engine-send-submit-button");
    if (!activeContext || !engine) {
      return;
    }
    const selectedOption = activeContext.options.find(option => option.id === optionId) || activeContext.options[0] || null;
    if (!selectedOption || !Array.isArray(selectedOption.entries) || selectedOption.entries.length === 0) {
      input.setOutput("No engine export payload is ready.");
      return;
    }
    writePreferredEngine(engine);
    if (button) button.disabled = true;
    try {
      for (let index = 0; index < selectedOption.entries.length; index += 1) {
        const entry = selectedOption.entries[index];
        await input.request("/api/game-engine-export", {
          engine,
          sourceStudio: activeContext.sourceStudio,
          resourceKind: entry.resourceKind,
          title: customTitle || entry.title || activeContext.title,
          fileName: entry.fileName,
          mimeType: entry.mimeType,
          sourceUrl: entry.sourceUrl,
          textContent: entry.textContent,
          metadata: entry.metadata
        });
      }
      input.setOutput("Queued " + selectedOption.entries.length + " resource" + (selectedOption.entries.length === 1 ? "" : "s") + " for " + getEngineLabel(engine) + ".");
      closeOverlay();
    } catch (error) {
      input.setOutput("Failed to queue engine export: " + ((error && error.message) || "Unknown error"));
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindTrigger(buttonId, kind) {
    const button = document.getElementById(buttonId);
    if (!button) {
      return;
    }
    button.addEventListener("click", event => {
      event.preventDefault();
      const context = buildContext(kind);
      if (context) {
        openOverlay(context);
      }
    });
  }

  function bindActions() {
    bindTrigger("image-send-to-game-engine-button", "image");
    bindTrigger("video-send-to-game-engine-button", "video");
    bindTrigger("audio-send-to-game-engine-button", "audio");
    bindTrigger("music-send-to-game-engine-button", "music");
    document.getElementById("game-engine-send-overlay-backdrop")?.addEventListener("click", closeOverlay);
    document.getElementById("game-engine-send-close-button")?.addEventListener("click", closeOverlay);
    document.getElementById("game-engine-send-cancel-button")?.addEventListener("click", closeOverlay);
    document.getElementById("game-engine-send-submit-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await submitActiveContext();
    });
    document.getElementById("game-engine-send-option")?.addEventListener("change", () => {
      if (!activeContext) {
        return;
      }
      const option = resolveSelectedOption();
      const hint = document.getElementById("game-engine-send-option-hint");
      if (hint) {
        hint.textContent = option ? option.hint : "";
      }
      updateOverlayPreview();
    });
  }

  return { bindActions };
}
