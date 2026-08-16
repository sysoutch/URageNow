function createDashboardAiWorkflowDataHelpers(input) {
  const state = input?.state && typeof input.state === "object" ? input.state : {};
  const loadImagePools = typeof input?.loadImagePools === "function"
    ? input.loadImagePools
    : async function loadImagePoolsFallback() {};
  const loadModel3dHistory = typeof input?.loadModel3dHistory === "function"
    ? input.loadModel3dHistory
    : async function loadModel3dHistoryFallback() {};
  const loadImageHistory = typeof input?.loadImageHistory === "function"
    ? input.loadImageHistory
    : async function loadImageHistoryFallback() {};
  const loadAudioHistory = typeof input?.loadAudioHistory === "function"
    ? input.loadAudioHistory
    : async function loadAudioHistoryFallback() {};
  const loadVideoHistory = typeof input?.loadVideoHistory === "function"
    ? input.loadVideoHistory
    : async function loadVideoHistoryFallback() {};
  const unloadMediaStudioPreviewForFocus = typeof input?.unloadMediaStudioPreviewForFocus === "function"
    ? input.unloadMediaStudioPreviewForFocus
    : function unloadMediaStudioPreviewForFocusFallback() {};
  const syncAudioPreviewForFocus = typeof input?.syncAudioPreviewForFocus === "function"
    ? input.syncAudioPreviewForFocus
    : function syncAudioPreviewForFocusFallback() {};

  function unloadAudioElementPreview(elementId) {
    const preview = document.getElementById(elementId);
    if (!preview) return;
    if (typeof preview.pause === "function") {
      preview.pause();
    }
    preview.removeAttribute("src");
    if (typeof preview.load === "function") {
      preview.load();
    }
  }

  function unloadInactiveStudioWorkflowPreviews(focusedId) {
    const activeId = String(focusedId || "").trim();
    unloadMediaStudioPreviewForFocus(activeId);
    syncAudioPreviewForFocus(activeId);
  }

  async function ensureImagePoolDataLoaded(options = {}) {
    const force = options.force === true;
    if (!force && state.imagePoolDataLoaded === true) {
      return;
    }
    await loadImagePools(state.selectedImagePoolId || "");
  }

  function resolveAiWorkflowId(focusedId) {
    const cardId = String(focusedId || "").trim();
    return cardId === "ask-rod-card"
      ? "ask"
      : cardId === "model3d-studio-card"
        ? "model3d"
        : cardId === "image-studio-card"
          ? "image"
          : cardId === "audio-studio-card"
            ? "audio"
            : cardId === "music-studio-card"
              ? "music"
              : cardId === "video-studio-card"
                ? "video"
                : "";
  }

  function getAiWorkflowLoadedMap() {
    return state.aiWorkflowDataLoaded && typeof state.aiWorkflowDataLoaded === "object"
      ? state.aiWorkflowDataLoaded
      : (state.aiWorkflowDataLoaded = { ask: false, model3d: false, image: false, audio: false, music: false, video: false });
  }

  async function ensureAiWorkflowDataLoaded(focusedId, options = {}) {
    const workflowId = resolveAiWorkflowId(focusedId);
    if (!workflowId) {
      return;
    }
    const force = options.force === true;
    const loadedMap = getAiWorkflowLoadedMap();
    if (!force && loadedMap[workflowId] === true) {
      return;
    }
    const tasks = [];
    if (workflowId === "model3d") {
      tasks.push(loadModel3dHistory(state.selectedGeneratedModelId || ""));
    } else if (workflowId === "image") {
      tasks.push(loadImageHistory(state.selectedGeneratedImageId || ""));
      tasks.push(loadVideoHistory(state.selectedGeneratedVideoId || ""));
    } else if (workflowId === "audio" || workflowId === "music") {
      tasks.push(loadAudioHistory(state.selectedGeneratedAudioId || "", state.selectedGeneratedMusicId || ""));
    } else if (workflowId === "video") {
      tasks.push(loadVideoHistory(state.selectedGeneratedVideoId || ""));
    }
    const results = tasks.length > 0 ? await Promise.allSettled(tasks) : [];
    if (results.some(result => result.status === "rejected")) {
      loadedMap[workflowId] = false;
      if (workflowId === "audio" || workflowId === "music") {
        loadedMap.audio = false;
        loadedMap.music = false;
      }
      return;
    }
    loadedMap[workflowId] = true;
    if (workflowId === "audio" || workflowId === "music") {
      loadedMap.audio = true;
      loadedMap.music = true;
    }
  }

  return {
    unloadAudioElementPreview,
    unloadInactiveStudioWorkflowPreviews,
    ensureImagePoolDataLoaded,
    ensureAiWorkflowDataLoaded
  };
}
