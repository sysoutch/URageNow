function createDashboardAiMediaStudioHelpers(input) {
  const recentMediaViewHelpers = createDashboardRecentMediaViewHelpers();
  const attachDashboardLazyMedia = typeof input?.attachDashboardLazyMedia === "function"
    ? input.attachDashboardLazyMedia
    : function attachDashboardLazyMediaFallback(media, source) {
      if (media && source) media.src = source;
    };
  const detachDashboardLazyMedia = typeof attachDashboardLazyMedia.detach === "function"
    ? target => attachDashboardLazyMedia.detach(target)
    : function detachDashboardLazyMediaFallback() {};
  const escapeHtml = typeof input?.escapeHtml === "function"
    ? input.escapeHtml
    : value => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  let selectedModel3dLowPolyUploadFile = null;
  let selectedModel3dEditUploadFiles = [];
  let selectedModel3dEditUploadFileId = "";
  let draggedModel3dEditUploadFileId = "";
  let studioBottomWheelScrollBound = false;
  let imageEditorAspectRatio = 1;
  let syncingImageEditorAspectRatio = false;
  const imageDelightWorkflowPath = String(globalThis.dashboardComfyWorkflowPaths?.image?.delight || "");
  const imageUpscaleWorkflowPath = String(globalThis.dashboardComfyWorkflowPaths?.image?.upscale || "");
  const imageLayeredWorkflowPath = String(globalThis.dashboardComfyWorkflowPaths?.image?.layered || "");
  const imagePreviewRevealState = {
    sourceUrl: "",
    resultUrl: "",
    value: 50
  };
  const imagePreviewMediaState = {
    kind: "image",
    url: "",
    gifFrames: [],
    gifFrameIndex: 0,
    gifPlayTimer: 0,
    gifDecodeToken: 0,
    gifPlaying: false,
    videoMetadataReady: false,
    videoFps: 30
  };
  const imagePreviewFocusState = {
    items: [],
    index: 0
  };
  const imageRegenerateModeState = {
    selectedImageId: "",
    prompt: ""
  };
  const speechRecordedAudioSourceByKey = new Map();
  const speechSourceHelpers = createDashboardSpeechSourceHelpers({ ...input, recordedSources: speechRecordedAudioSourceByKey });
  const readAudioFileAsSpeechDataUrl = speechSourceHelpers.readSpeechDataUrl;
  const importSpeechSourceFile = speechSourceHelpers.importSourceFile;
  const handleSpeechMicRecordedFile = speechSourceHelpers.handleRecordedFile;
  const imageVariantHelpers = createDashboardImageVariantHelpers({
    state: input.state,
    clearChildren: input.clearChildren,
    getGeneratedImageFileUrl: input.getGeneratedImageFileUrl,
    getSelectedGeneratedImage,
    onSelectRecord: selectGeneratedImageRecord,
    onDeleteRecord: record => deleteGeneratedImages([record]),
    renderGeneratedImageHistory
  });
  const workflowSeedHelpers = createDashboardWorkflowSeedHelpers();
  const {
    readOptionalNumberInput,
    readGenerateCount,
    bindMirroredNumberInputs,
    setInputValue,
    setCheckboxValue,
    parseResolutionValue
  } = createDashboardWorkflowFormHelpers();
  const audioMicCaptureHelpers = createDashboardAudioMicCaptureHelpers({
    clearChildren: input.clearChildren,
    setOutput: input.setOutput,
    setFileInputFiles,
    onRecordedFile: handleSpeechMicRecordedFile
  });
  const mediaMultiSelectionHelpers = createDashboardMediaMultiSelectionHelpers(input.state);
  const askAttachmentHelpers = createDashboardAskAttachmentHelpers({
    state: input.state,
    clearChildren: input.clearChildren,
    detachLazyMedia: detachDashboardLazyMedia,
    onRemoveImage: removeAiImage,
    readFileAsDataUrl: input.readFileAsDataUrl
  });
  const {
    addFileUploadsFromFiles: addAskFileUploads,
    addModelUploadsFromFiles: addAskModelUploads,
    clearFileUploads: clearAskFiles,
    clearModelUploads: clearAskModels,
    formatFileSize: formatAskSkillModelFileSize,
    renderComposerAttachments: renderAskAttachments,
    renderFileUploads: renderAskFiles,
    renderModelUploads: renderAskModels
  } = askAttachmentHelpers;
  const imageBottomDockHelpers = createDashboardImageBottomDockHelpers({
    state: input.state,
    attachLazyMedia: attachDashboardLazyMedia,
    clearChildren: input.clearChildren,
    detachLazyMedia: detachDashboardLazyMedia,
    formatDateTime: input.formatDateTime,
    getImageUrl: input.getGeneratedImageFileUrl,
    multiSelection: mediaMultiSelectionHelpers,
    recentMedia: recentMediaViewHelpers,
    renderSelectedMeta: () => renderGeneratedImageMeta(getSelectedGeneratedImage()),
    scrollSelectedIntoView: scrollSelectedGeneratedImageIntoView
  });
  const {
    renderDock: renderImageBottomDock,
    renderFilmstrip: renderImageBottomFilmstrip,
    renderQueue: renderImageBottomQueue
  } = imageBottomDockHelpers;
  const studioPostTargets = createDashboardStudioPostTargets(input);
  const {
    bindPostTargetUi: bindStudioPostTargetUi,
    getPostTarget: getStudioPostTarget,
    postToExternalTarget: postStudioResultToExternalTarget,
    refreshPostTargetOptions: refreshStudioPostTargetOptions
  } = studioPostTargets;
  const studioSidebarSplitLayout = createDashboardStudioSidebarSplitLayout({ escapeHtml });
  const setupStudioSidebarSplitPanes = studioSidebarSplitLayout.setup;
  const studioSidebarFoldouts = createDashboardStudioSidebarFoldouts({
    setupSplitPanes: setupStudioSidebarSplitPanes
  });
  const startStudioSidebarFoldoutRefreshes = studioSidebarFoldouts.start;
  const imageEditSourceWorkspace = createDashboardImageEditSourceWorkspace({
    appState: input.state,
    bindSortableItem,
    buildAbsoluteDashboardUrl: input.buildAbsoluteDashboardUrl,
    clearChildren: input.clearChildren,
    createBatchItemState,
    createId: createStudioUploadId,
    escapeHtml: input.escapeHtml,
    getClipboardImageFiles,
    getImagePoolById: poolId => input.getImagePoolById?.(poolId) || null,
    moveListEntryById,
    readFileAsDataUrl: input.readFileAsDataUrl,
    resolveImagePoolPreviewUrl: input.resolveImagePoolPreviewUrl,
    setOutput: input.setOutput,
    syncPreviewTarget: syncImageStudioPreviewTarget
  });
  const {
    getActive: getActiveImageEditSource,
    getExecutionSources: getImageEditExecutionSources,
    refreshOptions: refreshImageEditSourceOptions,
    resetRunStates: resetImageEditSourceRunStates,
    updateRunState: updateImageEditSourceRunState
  } = imageEditSourceWorkspace;
  const imageGenerationOrchestrator = createDashboardImageGenerationOrchestrator({
    app: {
      state: input.state,
      request: input.request,
      setOutput: input.setOutput,
      refreshState: input.refreshState,
      loadBotMessages: input.loadBotMessages,
      buildAbsoluteDashboardUrl: input.buildAbsoluteDashboardUrl,
      getGeneratedImageFileUrl: input.getGeneratedImageFileUrl
    },
    editSources: {
      getExecutionSources: getImageEditExecutionSources,
      resetRunStates: resetImageEditSourceRunStates,
      updateRunState: updateImageEditSourceRunState
    },
    form: { readOptionalNumberInput, readGenerateCount },
    generation: {
      setStatus: setImageGenerationStatus,
      startRequest: startGenerationRequest,
      finishRequest: finishGenerationRequest
    },
    history: {
      getBatchEntries: getGeneratedImageBatchEntries,
      load: loadImageHistory,
      scheduleRefresh: scheduleImageHistoryRefresh
    },
    postTargets: {
      get: getStudioPostTarget,
      postExternal: postStudioResultToExternalTarget
    },
    preview: {
      applyWorkflowDimensions: applyImagePreviewWorkflowDimensions,
      applyWorkflowDimensionsFromWorkflow: applyImagePreviewWorkflowDimensionsFromWorkflow,
      setLoading: setImagePreviewLoading
    },
    workflow: {
      readSeed: readWorkflowSeed,
      applySeedAfterGenerate: applySeedControlAfterGenerate
    }
  });
  const imagePreviewQuickActionController = createDashboardImagePreviewQuickActionController({
    state: input.state,
    buildAbsoluteDashboardUrl: input.buildAbsoluteDashboardUrl,
    getGeneratedImageFileUrl: input.getGeneratedImageFileUrl,
    getActiveEditSource: getActiveImageEditSource,
    getSelectedGeneratedImage,
    getSelectedGeneratedImages
  });
  const imageSendDestinationHelpers = typeof createDashboardImageSendDestinationHelpers === "function"
    ? createDashboardImageSendDestinationHelpers({})
    : null;
  const imageLayeredWorkflowPreflight = createDashboardImageLayeredWorkflowPreflight({
    getWorkflowPath: getConfiguredImageLayeredWorkflowPath,
    request: input.request
  });
  const imageQuickActionModalPresentation = createDashboardImageQuickActionModalPresentation({
    clearChildren: input.clearChildren,
    getActionTargets: getImageQuickActionTargets,
    getActiveTarget: getActiveImageQuickActionTarget,
    layeredPreflight: imageLayeredWorkflowPreflight,
    setCheckboxValue,
    setInputValue,
    setOutput: input.setOutput
  });
  const imageQuickActionModalExecution = createDashboardImageQuickActionModalExecution({
    getActionKey: imageQuickActionModalPresentation.getActionKey,
    readOptionalNumberInput,
    closeModal: imageQuickActionModalPresentation.close,
    runModel3dAction: triggerModel3dFromSelectedPreview,
    runImageAction: runImagePreviewQuickAction,
    runDelightInBlender: importSelectedImageIntoBlender,
    runDelightInTool: runImageDelightToolQuickAction,
    runRotate360Action: triggerRotate360ClipFromSelectedPreview,
    runVideoAction: triggerVideoFromSelectedPreview
  });
  const imageObjectPrompts = createDashboardImageObjectPromptCollection({
    setElementVisible,
    syncProcessingControls: () => imagePromptTransformation.syncProcessingControls(),
    getPromptSource: () => imagePromptInterpretation.getSource(),
    request: (route, body) => input.request(route, body),
    setGenerationStatus: setImageGenerationStatus,
    setOutput: message => input.setOutput(message),
    generateImage: options => generateImageFromUi(options),
    getStudioTab: () => input.state.imageStudioTab
  });
  const imageObjectPromptState = imageObjectPrompts.state;
  const {
    addPrompt: addImageObjectPrompt,
    deleteSelectedPrompts: deleteSelectedImageObjectPrompts,
    disableIdentificationMode: disableImageObjectIdentificationMode,
    generateFromUi: generateIdentifiedImageObjectsFromUi,
    interpretObjects: runImageObjectPromptInterpretation,
    readMaxAmount: readImageIdentifyMaxAmount,
    render: renderImageObjectPrompts,
    setActiveIndex: setImageObjectPromptActiveIndex,
    syncActivePromptFromField: syncActiveImageObjectPromptFromField,
    syncGenerateButtonLabel: syncGenerateImageButtonLabel,
    syncMaxAmountVisibility: syncImageIdentifyMaxAmountVisibility
  } = imageObjectPrompts;
  const imagePromptTransformation = createDashboardImagePromptTransformation({
    objectPromptState: imageObjectPromptState,
    request: (route, body) => input.request(route, body),
    setOutput: message => input.setOutput(message),
    syncActivePromptFromField: syncActiveImageObjectPromptFromField,
    renderObjectPrompts: renderImageObjectPrompts,
    setObjectPromptActiveIndex: setImageObjectPromptActiveIndex,
    setGenerationStatus: setImageGenerationStatus,
    setElementVisible,
    setInputValue
  });
  const {
    applyChangesFromUi: applyImagePromptChangesFromUi,
    applyTranslationFromUi: applyImagePromptTranslationFromUi,
    closeChangeModal: closeImageChangePromptModal,
    closeTranslateModal: closeImageTranslatePromptModal,
    improveFromUi: improveImagePromptFromUi,
    openChangeModal: openImageChangePromptModal,
    openTranslateModal: openImageTranslatePromptModal,
    processTasks: processImagePromptTasks,
    readProcessingOptions: readImagePromptProcessingOptions,
    setChangeMode: setImageChangePromptMode,
    syncProcessingControls: syncImagePromptProcessingControls,
    syncTranslateLanguageField: syncImageTranslatePromptLanguageField
  } = imagePromptTransformation;
  const imagePromptInterpretation = createDashboardImagePromptInterpretation({
    readFileAsDataUrl: file => input.readFileAsDataUrl(file),
    setOutput: message => input.setOutput(message),
    request: (route, body) => input.request(route, body),
    setElementVisible,
    getClipboardImageFiles,
    getWorkflowDimensions: getImagePreviewWorkflowDimensions,
    setEditorDimensions: setImageEditorDimensions,
    setGenerationStatus: setImageGenerationStatus,
    captureWebcam: options => openDashboardWebcamCaptureOverlay(options),
    interpretObjects: runImageObjectPromptInterpretation
  });
  const {
    applySourceAspectRatio: applyImagePromptInterpretSourceAspectRatio,
    captureSourceFromWebcam: captureImagePromptInterpretSourceFromWebcam,
    clearSource: clearImagePromptInterpretSource,
    getSource: getImagePromptInterpretSource,
    interpretSource: runImagePromptInterpretation,
    readClipboardImage: readImagePromptInterpretClipboardImage,
    renderSource: renderImagePromptInterpretSource,
    setDetailMode: setImagePromptInterpretDetailMode,
    setSourceFromClipboardEvent: setImagePromptInterpretSourceFromClipboardEvent,
    setSourceFromFile: setImagePromptInterpretSourceFromFile
  } = imagePromptInterpretation;
  const imageHistoryInitialRenderLimit = 80;
  const videoHistoryInitialRenderLimit = 48;
  const imageHistoryViewHelpers = createDashboardImageHistoryViewHelpers({
    state: input.state,
    initialLimit: imageHistoryInitialRenderLimit,
    attachLazyMedia: attachDashboardLazyMedia,
    clearChildren: input.clearChildren,
    formatDateTime: input.formatDateTime,
    getImageUrl: input.getGeneratedImageFileUrl,
    getSelected: getSelectedGeneratedImage,
    getSelectedMany: getSelectedGeneratedImages,
    multiSelection: mediaMultiSelectionHelpers,
    onAddSelectedToPool: () => document.getElementById("imagegen-add-selected-to-pool-button")?.click(),
    onDelete: deleteGeneratedImages,
    onPixelate: convertGeneratedImageHistoryEntryToPixelArt,
    onRename: renameGeneratedImageHistoryEntry,
    renderMeta: renderGeneratedImageMeta,
    renderRelated: () => {
      renderLatestMediaSections();
      renderImageBottomDock();
      renderModel3dRecentImageSources();
    },
    scrollSelectedIntoView: scrollSelectedGeneratedImageIntoView,
    unobserveMedia: unobserveImageHistoryMedia
  });
  const imageStylePresetText = {
    "3d-render": "stylized 3D render, polished materials, soft studio lighting, appealing forms",
    photography: "photography, realistic lens rendering, natural light, detailed texture",
    "digital-art": "digital art, crisp detail, strong composition, polished lighting",
    anime: "anime key visual, clean linework, expressive lighting, vibrant color",
    "concept-art": "concept art, readable silhouette, production design, atmospheric detail",
    painting: "painterly illustration, visible brush texture, rich color, composed lighting"
  };
  const videoPresetText = {
    cinematic: "cinematic lighting, smooth camera motion, polished composition",
    animation: "stylized animation, clean motion arcs, expressive timing",
    realistic: "realistic motion, natural camera movement, coherent physical detail",
    anime: "anime animation style, expressive motion, clean key visual composition"
  };
  const imageStylePresetPhrases = Object.values(imageStylePresetText);
  const videoPresetPhrases = Object.values(videoPresetText);
  const generationRequestController = createDashboardKeyedRequestController({
    toggleBusy(kind, visible) {
      setGenerationStopVisible(kind, visible);
    }
  });
  function getConfiguredImageUpscaleWorkflowPath() {
    const configuredValue = String(
      input.state?.globalSettings?.comfyUiImageUpscaleWorkflowPath
      || document.getElementById("comfy-image-upscale-workflow-path-input")?.value
      || document.getElementById("quick-comfy-image-upscale-workflow-path-input")?.value
      || ""
    ).trim();
    return configuredValue || imageUpscaleWorkflowPath;
  }
  function getConfiguredImageLayeredWorkflowPath() {
    const configuredValue = String(
      input.state?.globalSettings?.comfyUiImageLayeredWorkflowPath
      || document.getElementById("comfy-image-layered-workflow-path-input")?.value
      || document.getElementById("quick-comfy-image-layered-workflow-path-input")?.value
      || ""
    ).trim();
    return configuredValue || imageLayeredWorkflowPath;
  }
  const sidebarMediaLazyObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const media = entry.target;
        if (!media || !media.dataset) {
          return;
        }
        const source = media.dataset.src || "";
        if (entry.isIntersecting) {
          if (source && media.getAttribute("src") !== source) {
            media.src = source;
            media.dataset.lazyLoaded = "true";
            if (typeof media.load === "function") {
              media.load();
            }
          }
          return;
        }
        if (media.tagName === "VIDEO" && typeof media.pause === "function") {
          media.pause();
        }
        if (media.getAttribute("src")) {
          media.removeAttribute("src");
          if (typeof media.load === "function") {
            media.load();
          }
        }
      });
    }, { root: null, rootMargin: "180px 0px", threshold: 0.01 })
    : null;
  const videoBottomDockHelpers = createDashboardVideoBottomDockHelpers({
    state: input.state,
    clearChildren: input.clearChildren,
    formatDateTime: input.formatDateTime,
    getLazyObserver: () => sidebarMediaLazyObserver,
    getVideoUrl: input.getGeneratedVideoFileUrl,
    multiSelection: mediaMultiSelectionHelpers,
    recentMedia: recentMediaViewHelpers,
    renderHistory: renderGeneratedVideoHistory,
    unobserveMedia: unobserveSidebarMedia
  });
  const {
    renderDock: renderVideoBottomDock,
    renderFilmstrip: renderVideoBottomFilmstrip,
    renderQueue: renderVideoBottomQueue
  } = videoBottomDockHelpers;
  const videoHistoryViewHelpers = createDashboardVideoHistoryViewHelpers({
    state: input.state,
    initialLimit: videoHistoryInitialRenderLimit,
    clearChildren: input.clearChildren,
    formatDateTime: input.formatDateTime,
    getLazyObserver: () => sidebarMediaLazyObserver,
    getSelectedMany: getSelectedGeneratedVideos,
    getVideoUrl: input.getGeneratedVideoFileUrl,
    multiSelection: mediaMultiSelectionHelpers,
    onContainerMissing: () => {
      renderGeneratedVideoMeta(getSelectedGeneratedVideo());
      renderLatestMediaSections();
      renderVideoBottomDock();
      updateVideoPreviewActionButtons();
      refreshVideoToolQuickActionState();
    },
    onDelete: deleteGeneratedVideos,
    onEmpty: () => {
      renderGeneratedVideoMeta(null);
      renderLatestMediaSections();
      renderVideoBottomDock();
      updateVideoPreviewActionButtons();
    },
    onRendered: () => {
      renderGeneratedVideoMeta(getSelectedGeneratedVideo());
      refreshVideoToolQuickActionState();
      renderLatestMediaSections();
      renderVideoBottomDock();
      updateVideoPreviewActionButtons();
    },
    onSelected: entry => {
      syncGeneratedVideoHistorySelection();
      renderGeneratedVideoMeta(entry);
      refreshVideoToolQuickActionState();
      updateVideoPreviewActionButtons();
    },
    unobserveMedia: unobserveSidebarMedia
  });
  const latestMediaViewHelpers = createDashboardLatestMediaViewHelpers({
    state: input.state,
    attachLazyMedia: attachDashboardLazyMedia,
    buildAbsoluteUrl: input.buildAbsoluteDashboardUrl,
    clearChildren: input.clearChildren,
    formatDateTime: input.formatDateTime,
    getAudioUrl: buildGeneratedAudioFileUrl,
    getImageUrl: input.getGeneratedImageFileUrl,
    getLatestVideoEntries: getImageLatestVideoEntries,
    getVideoUrl: input.getGeneratedVideoFileUrl,
    onDeleteImages: deleteGeneratedImages,
    onDeleteVideos: deleteGeneratedVideos,
    onOpenFocusViewer: entry => openImagePreviewFocusViewer(input.buildAbsoluteDashboardUrl(entry.url)),
    onShowGif: showLatestGifInImagePreview,
    onShowVideo: showLatestVideoInImagePreview,
    onUseImageAsVideoSource: useLatestImageAsVideoSource,
    unobserveMedia: unobserveSidebarMedia
  });
  let activeVideoPreviewUrl = "";
  let activeVideoSourcePreviewUrl = "";

  function setGenerationStopVisible(kind, visible) {
    const stopButton = document.getElementById("stop-" + kind + "-generation-button");
    const generateButtonId = kind === "model3d" ? "generate-model3d-button" : "generate-" + kind + "-button";
    const generateButton = document.getElementById(generateButtonId);
    if (kind === "model3d") {
      const sourceField = document.getElementById("model3d-image-source");
      const clearButton = document.getElementById("model3d-image-clear-button");
      const hasUploadSource = typeof sourceField?.value === "string"
        && sourceField.value.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean).length > 0;
      const isBusy = visible === true;
      setElementVisible(stopButton, isBusy);
      setElementVisible(clearButton, !isBusy && hasUploadSource);
      if (generateButton) {
        generateButton.disabled = isBusy || !hasUploadSource;
      }
      return;
    }
    setElementVisible(stopButton, visible === true);
    if (generateButton) {
      generateButton.disabled = visible === true;
    }
  }
  function setElementVisible(element, visible) {
    if (!element) {
      return;
    }
    element.hidden = visible !== true;
    element.classList.toggle("hidden", visible !== true);
  }
  function startGenerationRequest(kind) {
    return generationRequestController.start(kind);
  }
  function finishGenerationRequest(kind, requestId) {
    generationRequestController.finish(kind, requestId);
  }
  async function stopGenerationRequest(kind, statusText) {
    const requestId = generationRequestController.get(kind);
    if (!requestId) {
      return;
    }
    if (statusText) {
      if (kind === "image") setImageGenerationStatus(statusText);
      if (kind === "audio") input.setAudioGenerationStatus(statusText);
      if (kind === "music") input.setMusicGenerationStatus(statusText);
      if (kind === "video") setVideoGenerationStatus(statusText);
    }
    await generationRequestController.stop(kind);
  }

  function createBatchItemState() {
    return {
      selected: true,
      runState: "idle",
      runMessage: ""
    };
  }
  function setFileInputFiles(inputNode, files) {
    if (!inputNode || !Array.isArray(files) || files.length === 0) return;
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    inputNode.files = transfer.files;
    inputNode.dispatchEvent(new Event("input", { bubbles: true }));
    inputNode.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function getClipboardImageFiles(event) {
    const directFiles = Array.from(event?.clipboardData?.files || []).filter(file => file && (file.type || "").startsWith("image/"));
    if (directFiles.length > 0) {
      return directFiles;
    }
    return Array.from(event?.clipboardData?.items || [])
      .filter(item => item && item.kind === "file" && (item.type || "").startsWith("image/"))
      .map(item => item.getAsFile())
      .filter(file => file && (file.type || "").startsWith("image/"));
  }
  function applyVideoSourceImageFiles(files) {
    const imageFiles = Array.from(files || []).filter(file => file && (file.type || "").startsWith("image/"));
    if (imageFiles.length === 0) {
      return false;
    }
    const inputNode = document.getElementById("videogen-source-image-input");
    if (!inputNode) {
      throw new Error("Video Studio start image input is unavailable.");
    }
    setVideoWorkflowMode("image-text");
    setFileInputFiles(inputNode, [imageFiles[0]]);
    return true;
  }
  function clearVideoSourcePreviewUrl() {
    if (!activeVideoSourcePreviewUrl || !activeVideoSourcePreviewUrl.startsWith("blob:")) {
      activeVideoSourcePreviewUrl = "";
      return;
    }
    URL.revokeObjectURL(activeVideoSourcePreviewUrl);
    activeVideoSourcePreviewUrl = "";
  }
  function renderVideoSourceImagePreview(file) {
    const previewWrap = document.getElementById("videogen-source-image-preview");
    const previewImage = document.getElementById("videogen-source-image-preview-image");
    const previewName = document.getElementById("videogen-source-image-preview-name");
    if (!previewWrap || !previewImage || !previewName) {
      return;
    }
    if (!file) {
      clearVideoSourcePreviewUrl();
      previewWrap.classList.add("hidden");
      previewImage.removeAttribute("src");
      previewName.textContent = "No start image selected.";
      return;
    }
    clearVideoSourcePreviewUrl();
    activeVideoSourcePreviewUrl = URL.createObjectURL(file);
    previewImage.src = activeVideoSourcePreviewUrl;
    previewName.textContent = String(file.name || "video-start-image").trim() || "video-start-image";
    previewWrap.classList.remove("hidden");
  }
  function unobserveSidebarMedia(container) {
    if (!container) {
      return;
    }
    detachDashboardLazyMedia(container);
    if (!sidebarMediaLazyObserver) return;
    container.querySelectorAll("[data-src]").forEach(media => {
      sidebarMediaLazyObserver.unobserve(media);
      if (media.tagName === "VIDEO" && typeof media.pause === "function") media.pause();
      media.removeAttribute("src");
      if (typeof media.load === "function") media.load();
    });
  }
  function unobserveImageHistoryMedia(container) {
    if (!container) return;
    detachDashboardLazyMedia(container);
  }
  async function refreshAudioMicDeviceOptions(prefix) {
    await audioMicCaptureHelpers.refreshDevices(prefix);
  }
  function bindAudioMicCaptureUi(prefix) {
    audioMicCaptureHelpers.bind(prefix);
  }

  function getSelectedGeneratedImage() {
    return input.state.generatedImages.find(item => item.id === input.state.selectedGeneratedImageId) || null;
  }
  function getSelectedGeneratedImages() {
    return mediaMultiSelectionHelpers.getSelectedRecords(input.state.generatedImages, "selectedGeneratedImageIds", input.state.selectedGeneratedImageId);
  }
  function selectGeneratedImageRecord(record) {
    const imageId = String(record?.id || "").trim();
    if (!imageId) {
      return;
    }
    if (!input.state.generatedImages.some(item => item.id === imageId)) {
      input.state.generatedImages = [record].concat(input.state.generatedImages || []);
    }
    ensureGeneratedImageVisibleInLists(imageId);
    mediaMultiSelectionHelpers.setSelectedIds("selectedGeneratedImageIds", "selectedGeneratedImageId", [imageId], imageId);
    renderGeneratedImageHistory();
    scrollSelectedGeneratedImageIntoView(imageId);
  }
  function mergeGeneratedImageRecords(records) {
    const nextRecords = (Array.isArray(records) ? records : [records]).filter(record => record?.id);
    if (nextRecords.length === 0) {
      return;
    }
    const current = Array.isArray(input.state.generatedImages) ? input.state.generatedImages : [];
    const byId = new Map(current.map(record => [String(record.id || ""), record]));
    nextRecords.forEach(record => byId.set(String(record.id || ""), record));
    input.state.generatedImages = Array.from(byId.values()).sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  }
  function createGeneratedImageQuickActionTarget(record) {
    return imagePreviewQuickActionController.createGeneratedTarget(record);
  }
  function getSelectedGeneratedImageTargets() {
    return imagePreviewQuickActionController.getSelectedGeneratedTargets();
  }
  function getImageQuickActionTargets() {
    return imagePreviewQuickActionController.getActionTargets();
  }
  async function confirmMediaDelete(label, count, names) {
    const targetCount = Math.max(1, Number.parseInt(count || 1, 10) || 1);
    const targetNames = Array.isArray(names) ? names.map(name => String(name || "").trim()).filter(Boolean) : [];
    if (typeof window.dashboardConfirm !== "function") return false;
    return window.dashboardConfirm({
      title: "Delete " + label + (targetCount === 1 ? "" : "s"),
      message: "This will permanently delete " + targetCount + " " + label + (targetCount === 1 ? "" : "s") + ".",
      details: targetNames,
      confirmLabel: "Delete",
      variant: "warning"
    });
  }
  function resolveImageVariantSourceRecord(selectedOverride) {
    return imageVariantHelpers.resolveSourceRecord(selectedOverride);
  }
  function getImageVariantActionKey(actionKey, options) {
    return imageVariantHelpers.getActionKey(actionKey, options);
  }
  function rememberImageVariantResult(sourceId, variantKey, record) {
    imageVariantHelpers.rememberResult(sourceId, variantKey, record);
  }
  function renderImageVariantGallery() {
    imageVariantHelpers.renderGallery();
  }
  function ensureGeneratedImageVisibleInLists(imageId) {
    const selectedId = String(imageId || "").trim();
    if (!selectedId || !Array.isArray(input.state.generatedImages)) {
      return;
    }
    const index = input.state.generatedImages.findIndex(item => item.id === selectedId);
    if (index < 0) {
      return;
    }
    const bottomLimit = Math.ceil((index + 1) / 24) * 24;
    const historyLimit = Math.ceil((index + 1) / imageHistoryInitialRenderLimit) * imageHistoryInitialRenderLimit;
    input.state.imageBottomVisibleLimit = Math.max(Number.parseInt(input.state.imageBottomVisibleLimit || 24, 10) || 24, bottomLimit);
    input.state.imageHistoryVisibleLimit = Math.max(Number.parseInt(input.state.imageHistoryVisibleLimit || imageHistoryInitialRenderLimit, 10) || imageHistoryInitialRenderLimit, historyLimit);
  }
  function scrollSelectedGeneratedImageIntoView(imageId) {
    const selectedId = String(imageId || input.state.selectedGeneratedImageId || "").trim();
    if (!selectedId) {
      return;
    }
    requestAnimationFrame(() => {
      const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(selectedId) : selectedId.replace(/'/g, "\\'");
      const bottomCard = document.querySelector("#image-bottom-filmstrip [data-image-id='" + escapedId + "']");
      const historyRow = document.querySelector("#imagegen-history-list [data-image-id='" + escapedId + "']");
      bottomCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      historyRow?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
  }
  function getImageFileNameFromUrl(value, fallback) {
    return imagePreviewQuickActionController.getFileNameFromUrl(value, fallback);
  }
  function getActiveImageQuickActionTarget() {
    return imagePreviewQuickActionController.getActiveTarget();
  }
  function renderImagePreviewContext(target) {
    imagePreviewQuickActionController.renderContext(target);
  }
  function renderImagePreviewMetaForTarget(record, target) {
    const output = document.getElementById("imagegen-meta-output");
    if (!output) {
      return;
    }
    if (target && target.kind === "edit-source") {
      output.textContent = [
        "Preview Target: Edit source",
        "Name: " + (target.fileName || target.label || "source-image"),
        "Source: " + (target.label || "Uploaded source image"),
        "Detail: " + (getActiveImageEditSource()?.detail || target.imageUrl)
      ].join("\n");
      return;
    }
    if (target && target.kind === "multi-selection") {
      const entries = Array.isArray(target.entries) ? target.entries : [];
      output.textContent = [
        "Preview Target: Multi-selection",
        "Selected images: " + entries.length,
        "Files:",
        entries.map(entry => "- " + (entry?.imageFileName || entry?.fileName || entry?.id || "image")).join("\n")
      ].join("\n");
      return;
    }
    if (!record) {
      output.textContent = "No image selected.";
      return;
    }
    const sizeText = record.width && record.height ? record.width + " x " + record.height : "unknown";
    const generationDuration = formatGenerationDuration(record.generationDurationSeconds || record.generationDurationMs);
    output.textContent = [
      "Image ID: " + record.id,
      "Generated: " + input.formatDateTime(record.createdAt),
      "Generation duration: " + generationDuration,
      "Size: " + sizeText,
      "Seed: " + record.seed,
      "Steps: " + (record.steps || "unknown"),
      "CFG: " + (record.cfg || "unknown"),
      "Description: " + (record.description || "(none)"),
      "Prompt: " + (record.prompt || "(none)"),
      "Model: " + (record.model || "unknown"),
      "File: " + record.imageFileName
    ].join("\n");
  }
  function formatGenerationDuration(value) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "unknown";
    }
    const totalSeconds = Math.floor(
      numeric > 1000 ? numeric / 1000 : numeric
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  function getGeneratedImageBatchEntries(payload) {
    if (Array.isArray(payload?.generatedImages) && payload.generatedImages.length > 0) {
      return payload.generatedImages.filter(entry => entry && entry.id && entry.imageFileName);
    }
    return payload && payload.id && payload.imageFileName ? [payload] : [];
  }
  function isVideoPreviewUrl(value) {
    return /\.(mp4|webm|mov|m4v|ogg)(?:[?#].*)?$/i.test(String(value || "").trim());
  }
  function isGifPreviewUrl(value) {
    return /\.gif(?:[?#].*)?$/i.test(String(value || "").trim());
  }
  function getImagePreviewMediaNodes() {
    return {
      image: document.getElementById("imagegen-preview"),
      video: document.getElementById("imagegen-preview-video"),
      canvas: document.getElementById("imagegen-preview-canvas"),
      overlay: document.getElementById("image-preview-play-overlay"),
      hint: document.getElementById("image-preview-scrub-hint")
    };
  }
  function stopImagePreviewGifPlayback() {
    if (imagePreviewMediaState.gifPlayTimer) {
      window.clearInterval(imagePreviewMediaState.gifPlayTimer);
      imagePreviewMediaState.gifPlayTimer = 0;
    }
    imagePreviewMediaState.gifPlaying = false;
  }
  function releaseImagePreviewGifFrames(frames = imagePreviewMediaState.gifFrames) {
    frames.forEach(frame => frame?.image?.close?.());
    if (frames === imagePreviewMediaState.gifFrames) {
      imagePreviewMediaState.gifFrames = [];
    }
  }
  function startImagePreviewGifPlayback() {
    const frames = imagePreviewMediaState.gifFrames;
    if (frames.length === 0) return;
    stopImagePreviewGifPlayback();
    imagePreviewMediaState.gifPlaying = true;
    imagePreviewMediaState.gifPlayTimer = window.setInterval(() => {
      if (!imagePreviewMediaState.gifPlaying || frames.length === 0) {
        stopImagePreviewGifPlayback();
        return;
      }
      const nextIndex = (imagePreviewMediaState.gifFrameIndex + 1) % frames.length;
      drawImagePreviewGifFrame(nextIndex);
    }, 66);
  }
  function resumeImagePreviewGifAnimation() {
    const nodes = getImagePreviewMediaNodes();
    stopImagePreviewGifPlayback();
    nodes.canvas?.classList.add("hidden");
    nodes.image?.classList.remove("hidden");
  }
  function drawImagePreviewGifFrame(index) {
    const canvas = document.getElementById("imagegen-preview-canvas");
    const frames = imagePreviewMediaState.gifFrames;
    if (!canvas || frames.length === 0) return;
    const nextIndex = ((index % frames.length) + frames.length) % frames.length;
    if (nextIndex === imagePreviewMediaState.gifFrameIndex && canvas.width > 0 && canvas.height > 0) return;
    const frame = frames[nextIndex];
    const bitmap = frame?.image;
    if (!bitmap) return;
    imagePreviewMediaState.gifFrameIndex = nextIndex;
    const nextWidth = bitmap.displayWidth || bitmap.width || canvas.width || 1;
    const nextHeight = bitmap.displayHeight || bitmap.height || canvas.height || 1;
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  function captureCurrentImagePreviewStillFrame() {
    const nodes = getImagePreviewMediaNodes();
    const image = nodes.image;
    const canvas = nodes.canvas;
    if (!image || !canvas || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return false;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    if (canvas.width !== image.naturalWidth) canvas.width = image.naturalWidth;
    if (canvas.height !== image.naturalHeight) canvas.height = image.naturalHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return true;
  }
  function showPausedImagePreviewGifFrame(index) {
    const nodes = getImagePreviewMediaNodes();
    if (imagePreviewMediaState.gifFrames.length === 0) {
      if (!captureCurrentImagePreviewStillFrame()) {
        input.setOutput("GIF frames are still loading. Try again in a moment.");
        return false;
      }
      stopImagePreviewGifPlayback();
      nodes.image?.classList.add("hidden");
      nodes.canvas?.classList.remove("hidden");
      input.setOutput("Paused GIF preview. Frame stepping will unlock as soon as decoded frames are ready.");
      return true;
    }
    stopImagePreviewGifPlayback();
    drawImagePreviewGifFrame(index === undefined ? imagePreviewMediaState.gifFrameIndex : index);
    nodes.image?.classList.add("hidden");
    nodes.canvas?.classList.remove("hidden");
    return true;
  }
  function getImagePreviewDownloadName(extension) {
    const panel = document.getElementById("image-studio-preview-panel");
    const fallback = extension === "gif" ? "image-preview.gif" : extension === "mp4" ? "image-preview.mp4" : "image-preview.png";
    const sourceName = String(panel?.dataset?.enginePreviewFileName || getImageFileNameFromUrl(imagePreviewMediaState.url, fallback) || fallback).trim();
    const withoutQuery = sourceName.split(/[?#]/)[0] || fallback;
    const baseName = withoutQuery.replace(/\.[^.\\/]+$/, "").trim() || "image-preview";
    return baseName + "." + extension;
  }
  function getImagePreviewUrlExtension(fallback) {
    const source = String(imagePreviewMediaState.url || "").split(/[?#]/)[0] || "";
    const extension = (source.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
    return extension || fallback;
  }
  function downloadImagePreviewUrl(url, fileName) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  function downloadCurrentImagePreviewPng() {
    const nodes = getImagePreviewMediaNodes();
    const canvas = nodes.canvas;
    if (imagePreviewMediaState.kind === "gif") {
      if (!showPausedImagePreviewGifFrame()) return;
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        input.setOutput("Current GIF frame is not ready to export yet.");
        return;
      }
      canvas.toBlob(blob => {
        if (!blob) {
          input.setOutput("Could not export the current GIF frame.");
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        downloadImagePreviewUrl(objectUrl, getImagePreviewDownloadName("png"));
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }, "image/png");
      return;
    }
    const imageUrl = String(nodes.image?.getAttribute("src") || nodes.image?.src || imagePreviewMediaState.url || "").trim();
    if (!imageUrl) {
      input.setOutput("No image preview is ready to download.");
      return;
    }
    downloadImagePreviewUrl(imageUrl, getImagePreviewDownloadName("png"));
  }
  async function decodeImagePreviewGifFrames(url) {
    const nodes = getImagePreviewMediaNodes();
    const token = imagePreviewMediaState.gifDecodeToken + 1;
    imagePreviewMediaState.gifDecodeToken = token;
    releaseImagePreviewGifFrames();
    imagePreviewMediaState.gifFrameIndex = 0;
    if (typeof ImageDecoder !== "function" || !nodes.canvas) return;
    let decoder = null;
    let frames = [];
    try {
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      const contentType = String(response.headers.get("content-type") || "").trim();
      const decoderType = isGifPreviewUrl(url) ? "image/gif" : (/^image\//i.test(contentType) ? contentType : "image/gif");
      decoder = new ImageDecoder({ data, type: decoderType });
      const completed = decoder.tracks?.ready ? await decoder.tracks.ready : null;
      const frameCount = Math.max(1, Number.parseInt(completed?.selectedTrack?.frameCount || decoder.tracks?.selectedTrack?.frameCount || "1", 10) || 1);
      for (let index = 0; index < Math.min(frameCount, 240); index += 1) {
        const decoded = await decoder.decode({ frameIndex: index });
        const duration = Math.max(20, Math.round((decoded.image.duration || 100000) / 1000));
        let bitmap = null;
        try {
          bitmap = await createImageBitmap(decoded.image);
        } finally {
          decoded.image.close?.();
        }
        frames.push({ image: bitmap, duration });
      }
      if (imagePreviewMediaState.gifDecodeToken !== token || imagePreviewMediaState.url !== url || frames.length === 0) {
        releaseImagePreviewGifFrames(frames);
        return;
      }
      imagePreviewMediaState.gifFrames = frames;
      nodes.overlay?.classList.remove("hidden");
      nodes.hint?.classList.remove("hidden");
      drawImagePreviewGifFrame(0);
    } catch {
      releaseImagePreviewGifFrames(frames);
      releaseImagePreviewGifFrames();
    } finally {
      decoder?.close?.();
    }
  }
  function setImagePreviewMedia(target) {
    const nodes = getImagePreviewMediaNodes();
    const url = String(target?.imageUrl || "").trim();
    const panel = document.getElementById("image-studio-preview-panel");
    stopImagePreviewGifPlayback();
    imagePreviewMediaState.gifDecodeToken += 1;
    releaseImagePreviewGifFrames();
    imagePreviewMediaState.url = url;
    imagePreviewMediaState.gifFrameIndex = 0;
    imagePreviewMediaState.videoMetadataReady = false;
    imagePreviewMediaState.videoFps = Math.max(1, Number.parseInt(String(target?.fps || ""), 10) || 30);
    nodes.overlay?.classList.add("hidden");
    nodes.hint?.classList.add("hidden");
    nodes.canvas?.classList.add("hidden");
    if (nodes.video) {
      nodes.video.pause();
      nodes.video.removeAttribute("src");
      nodes.video.load();
      nodes.video.classList.add("hidden");
    }
    if (!nodes.image) return;
    nodes.image.classList.add("hidden");
    nodes.image.removeAttribute("src");
    if (!url) {
      imagePreviewMediaState.kind = "image";
      if (panel?.dataset) {
        delete panel.dataset.enginePreviewKind;
        delete panel.dataset.enginePreviewUrl;
        delete panel.dataset.enginePreviewFileName;
      }
      return;
    }
    if (isVideoPreviewUrl(url) && nodes.video) {
      imagePreviewMediaState.kind = "video";
      nodes.video.preload = "metadata";
      nodes.video.src = url;
      nodes.video.classList.remove("hidden");
      nodes.video.addEventListener("loadedmetadata", () => {
        if (imagePreviewMediaState.url === url) {
          imagePreviewMediaState.videoMetadataReady = true;
        }
      }, { once: true });
      nodes.video.load();
      if (panel?.dataset) {
        panel.dataset.enginePreviewKind = "video";
        panel.dataset.enginePreviewUrl = url;
        panel.dataset.enginePreviewFileName = String(target?.fileName || target?.label || "image-preview.mp4").trim() || "image-preview.mp4";
      }
      nodes.overlay?.classList.remove("hidden");
      nodes.hint?.classList.remove("hidden");
      return;
    }
    imagePreviewMediaState.kind = isGifPreviewUrl(url) ? "gif" : "image";
    nodes.image.src = url;
    nodes.image.classList.remove("hidden");
    if (panel?.dataset) {
      panel.dataset.enginePreviewKind = imagePreviewMediaState.kind;
      panel.dataset.enginePreviewUrl = url;
      panel.dataset.enginePreviewFileName = String(target?.fileName || target?.label || (imagePreviewMediaState.kind === "gif" ? "image-preview.gif" : "preview-image.png")).trim()
        || (imagePreviewMediaState.kind === "gif" ? "image-preview.gif" : "preview-image.png");
    }
    if (imagePreviewMediaState.kind === "gif") {
      nodes.overlay?.classList.remove("hidden");
      nodes.hint?.classList.remove("hidden");
      if (nodes.hint) nodes.hint.textContent = "Click to pause the GIF, then drag left or right to step frames. Hold Ctrl before dragging to jump quarter turns.";
      if (nodes.hint) nodes.hint.textContent = "Click to pause the GIF, then drag left or right to step frames. Hold Ctrl before dragging; each 48px moves one quarter turn.";
      void decodeImagePreviewGifFrames(url);
    }
  }
  function ensureImagePreviewMultiSelectionNode() {
    const panel = document.getElementById("image-studio-preview-panel");
    if (!panel) {
      return null;
    }
    const existing = document.getElementById("image-preview-multi-selection");
    if (existing) {
      return existing;
    }
    const node = document.createElement("div");
    node.id = "image-preview-multi-selection";
    node.className = "image-preview-multi-selection hidden";
    const preview = document.getElementById("imagegen-preview");
    if (preview && preview.parentNode === panel) {
      panel.insertBefore(node, preview);
    } else {
      panel.appendChild(node);
    }
    return node;
  }
  function renderImagePreviewMultiSelection(targets) {
    const node = ensureImagePreviewMultiSelectionNode();
    const selectedTargets = Array.isArray(targets) ? targets.filter(target => target?.imageUrl) : [];
    const panel = document.getElementById("image-studio-preview-panel");
    if (!node) {
      return false;
    }
    input.clearChildren(node);
    const isMulti = selectedTargets.length > 1;
    node.classList.toggle("hidden", !isMulti);
    panel?.classList.toggle("has-multi-selection", isMulti);
    if (!isMulti) {
      return false;
    }
    setImagePreviewMedia(null);
    hideImagePreviewReveal();
    const heading = document.createElement("div");
    heading.className = "image-preview-multi-selection-heading";
    const title = document.createElement("strong");
    title.textContent = selectedTargets.length + " selected images";
    const detail = document.createElement("span");
    detail.textContent = "Quick actions and Blender import apply to the full selection.";
    heading.append(title, detail);
    node.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "image-preview-multi-selection-grid";
    const visibleCount = selectedTargets.length;
    grid.style.setProperty("--image-preview-selection-columns", String(Math.min(6, Math.max(2, Math.ceil(Math.sqrt(visibleCount))))));
    grid.dataset.dense = visibleCount > 6 ? "true" : "false";
    selectedTargets.slice(0, visibleCount).forEach(target => {
      const card = document.createElement("article");
      card.className = "image-preview-multi-selection-card";
      const thumb = document.createElement("img");
      thumb.alt = target.label || target.fileName || "Selected image";
      thumb.loading = "lazy";
      thumb.decoding = "async";
      thumb.src = target.imageUrl;
      const label = document.createElement("span");
      label.textContent = target.label || target.fileName || "Selected image";
      card.append(thumb, label);
      grid.appendChild(card);
    });
    node.appendChild(grid);
    return true;
  }
  function writeImageStudioToolTarget(target) {
    const panel = document.getElementById("image-studio-preview-panel");
    if (!panel) return;
    if (!target || !target.imageUrl) {
      delete panel.dataset.toolKind;
      delete panel.dataset.toolImageId;
      delete panel.dataset.toolImageUrl;
      delete panel.dataset.toolFileName;
      delete panel.dataset.toolPrompt;
      delete panel.dataset.toolWidth;
      delete panel.dataset.toolHeight;
      return;
    }
    panel.dataset.toolKind = String(target.kind || "image").trim() || "image";
    panel.dataset.toolImageId = String(target.record?.id || "").trim();
    panel.dataset.toolImageUrl = String(target.imageUrl || "").trim();
    panel.dataset.toolFileName = String(target.fileName || target.label || "tool-source.png").trim() || "tool-source.png";
    panel.dataset.toolPrompt = String(target.prompt || "").trim();
    if (target.width) panel.dataset.toolWidth = String(target.width);
    else delete panel.dataset.toolWidth;
    if (target.height) panel.dataset.toolHeight = String(target.height);
    else delete panel.dataset.toolHeight;
  }
  function renderImagePreviewMetadataBadge(record, target) {
    const setText = (id, text) => {
      const node = document.getElementById(id);
      if (node) node.textContent = text;
    };
    const width = Number(record?.width || target?.width);
    const height = Number(record?.height || target?.height);
    const size = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? Math.round(width) + " x " + Math.round(height)
      : "Size: unknown";
    const formatValue = value => value === null || value === undefined || value === "" ? "unknown" : String(value);
    setText("image-preview-metadata-size", size);
    setText("image-preview-metadata-steps", "Steps: " + formatValue(record?.steps));
    setText("image-preview-metadata-cfg", "CFG: " + formatValue(record?.cfg));
    setText("image-preview-metadata-seed", "Seed: " + formatValue(record?.seed));
  }
  function syncImageStudioPreviewTarget(recordOverride) {
    const preview = document.getElementById("imagegen-preview");
    const multiTargets = getSelectedGeneratedImageTargets();
    const isMultiSelection = multiTargets.length > 1;
    const target = isMultiSelection ? {
      kind: "multi-selection",
      label: multiTargets.length + " selected images",
      entries: multiTargets.map(item => item.record).filter(Boolean)
    } : getActiveImageQuickActionTarget();
    const record = recordOverride === undefined ? getSelectedGeneratedImage() : recordOverride;
    applyImagePreviewWorkflowDimensions(record?.width, record?.height);
    renderImagePreviewContext(target);
    renderImagePreviewMetadataBadge(record, target);
    renderImagePreviewMetaForTarget(record, target);
    writeImageStudioToolTarget(isMultiSelection ? multiTargets[0] : target);
    const renderedMultiSelection = renderImagePreviewMultiSelection(multiTargets);
    if (!preview) {
      updateImagePreviewQuickActions(record);
      renderImageVariantGallery();
      return;
    }
    if (renderedMultiSelection) {
      updateImagePreviewQuickActions(record);
      renderImageVariantGallery();
      return;
    }
    if (!target || !target.imageUrl) {
      setImagePreviewMedia(null);
      hideImagePreviewReveal();
      updateImagePreviewQuickActions(record);
      renderImageVariantGallery();
      return;
    }
    setImagePreviewMedia(target);
    if (imagePreviewRevealState.resultUrl && preview.src !== imagePreviewRevealState.resultUrl) {
      hideImagePreviewReveal();
    }
    updateImagePreviewQuickActions(record);
    renderImageVariantGallery();
  }
  function getSelectedGeneratedVideo() {
    return input.state.generatedVideos.find(item => item.id === input.state.selectedGeneratedVideoId) || null;
  }
  function getSelectedGeneratedVideos() {
    return mediaMultiSelectionHelpers.getSelectedRecords(input.state.generatedVideos, "selectedGeneratedVideoIds", input.state.selectedGeneratedVideoId);
  }
  function isEditableTargetActive(event) {
    const target = event?.target;
    const tag = String(target?.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);
  }
  async function deleteGeneratedImages(records) {
    const targets = (Array.isArray(records) ? records : [records]).filter(record => record?.id);
    if (targets.length === 0) return false;
    if (!await confirmMediaDelete("generated image", targets.length, targets.map(record => record.imageFileName || record.id))) return false;
    setImageGenerationStatus("Deleting " + targets.length + " image" + (targets.length === 1 ? "" : "s") + "...");
    try {
      for (const record of targets) {
        await input.request("/api/image-delete", { imageId: record.id });
      }
      const deletedIds = new Set(targets.map(record => String(record.id)));
      const nextSelectedId = deletedIds.has(String(input.state.selectedGeneratedImageId || "")) ? "" : input.state.selectedGeneratedImageId;
      await loadImageHistory(nextSelectedId);
      setImageGenerationStatus("Deleted " + targets.length + " image" + (targets.length === 1 ? "" : "s") + ".");
      input.setOutput("Deleted generated image" + (targets.length === 1 ? "" : "s") + ": " + targets.map(record => record.imageFileName || record.id).join(", "));
      return true;
    } catch (error) {
      const detail = error && error.message ? error.message : "Unknown error";
      setImageGenerationStatus("Failed to delete selected image" + (targets.length === 1 ? "" : "s") + ".");
      input.setOutput("Failed to delete generated image" + (targets.length === 1 ? "" : "s") + ": " + detail);
      return false;
    }
  }
  async function deleteGeneratedVideos(records) {
    const targets = (Array.isArray(records) ? records : [records]).filter(record => record?.id);
    if (targets.length === 0) return false;
    if (!await confirmMediaDelete("generated video", targets.length, targets.map(record => record.videoFileName || record.id))) return false;
    setVideoGenerationStatus("Deleting " + targets.length + " video" + (targets.length === 1 ? "" : "s") + "...");
    try {
      for (const record of targets) {
        await input.request("/api/video-delete", { videoId: record.id });
      }
      const deletedIds = new Set(targets.map(record => String(record.id)));
      const nextSelectedId = deletedIds.has(String(input.state.selectedGeneratedVideoId || "")) ? "" : input.state.selectedGeneratedVideoId;
      await loadVideoHistory(nextSelectedId);
      setVideoGenerationStatus("Deleted " + targets.length + " video" + (targets.length === 1 ? "" : "s") + ".");
      input.setOutput("Deleted generated video" + (targets.length === 1 ? "" : "s") + ": " + targets.map(record => record.videoFileName || record.id).join(", "));
      return true;
    } catch (error) {
      const detail = error && error.message ? error.message : "Unknown error";
      setVideoGenerationStatus("Failed to delete selected video" + (targets.length === 1 ? "" : "s") + ".");
      input.setOutput("Failed to delete generated video" + (targets.length === 1 ? "" : "s") + ": " + detail);
      return false;
    }
  }
  async function deleteFocusedGeneratedSelections() {
    const focusedId = String(input.state.aiFocusedSectionId || "").trim();
    if (focusedId === "image-studio-card") return deleteGeneratedImages(getSelectedGeneratedImages());
    if (focusedId === "video-studio-card") return deleteGeneratedVideos(getSelectedGeneratedVideos());
    if (focusedId === "model3d-studio-card") {
      const record = input.getSelectedGeneratedModel?.();
      const selectedVariant = state.model3dThreeVariant === "original" || state.model3dThreeVariant === "lowpoly" || state.model3dThreeVariant === "albedo"
        ? state.model3dThreeVariant
        : "merged";
      const fileName = selectedVariant === "original"
        ? record?.originalModelFileName
        : selectedVariant === "lowpoly"
          ? record?.lowPolyModelFileName
          : selectedVariant === "albedo"
            ? record?.albedoGeometryModelFileName
            : record?.modelFileName;
      if (!record?.id || !fileName) {
        input.setOutput("Select an available 3D model variant before pressing Delete.");
        return false;
      }
      if (!await confirmMediaDelete("3D model variant", 1, [fileName])) return false;
      try {
        await input.request("/api/model3d-variant-delete", {
          modelId: record.id,
          variant: selectedVariant,
          fileName
        });
        await input.loadModel3dHistory(record.id);
        input.setOutput("Deleted 3D model variant: " + fileName);
        return true;
      } catch (error) {
        input.setOutput("Failed to delete 3D model variant: " + ((error && error.message) || "Unknown error"));
        return false;
      }
    }
    if ((focusedId === "audio-studio-card" || focusedId === "music-studio-card") && typeof input.loadAudioHistory === "function") {
      const isMusic = focusedId === "music-studio-card";
      const entries = (input.state.generatedAudios || []).filter(record => record?.mode === (isMusic ? "music" : "audio"));
      const targets = mediaMultiSelectionHelpers.getSelectedRecords(entries, isMusic ? "selectedGeneratedMusicIds" : "selectedGeneratedAudioIds", isMusic ? input.state.selectedGeneratedMusicId : input.state.selectedGeneratedAudioId).filter(record => record?.id);
      if (targets.length === 0) return false;
      if (!await confirmMediaDelete("generated " + (isMusic ? "music file" : "audio file"), targets.length, targets.map(record => record.audioFileName || record.id))) return false;
      try {
        for (const record of targets) await input.request("/api/audio-delete", { audioId: record.id });
        const deletedIds = new Set(targets.map(record => String(record.id)));
        const nextAudioId = !isMusic && deletedIds.has(String(input.state.selectedGeneratedAudioId || "")) ? "" : input.state.selectedGeneratedAudioId;
        const nextMusicId = isMusic && deletedIds.has(String(input.state.selectedGeneratedMusicId || "")) ? "" : input.state.selectedGeneratedMusicId;
        await input.loadAudioHistory(nextAudioId, nextMusicId);
        input.setOutput("Deleted generated " + (isMusic ? "music" : "audio") + " file" + (targets.length === 1 ? "" : "s") + ": " + targets.map(record => record.audioFileName || record.id).join(", "));
        return true;
      } catch (error) {
        input.setOutput("Failed to delete generated " + (isMusic ? "music" : "audio") + " file" + (targets.length === 1 ? "" : "s") + ": " + ((error && error.message) || "Unknown error"));
        return false;
      }
    }
    return false;
  }
  function bindGeneratedDeleteHotkey() {
    if (bindGeneratedDeleteHotkey.bound === true) return;
    bindGeneratedDeleteHotkey.bound = true;
    document.addEventListener("keydown", event => {
      if (event.key !== "Delete" || isEditableTargetActive(event)) return;
      event.preventDefault();
      void deleteFocusedGeneratedSelections();
    });
  }
  function createStudioUploadId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function moveListEntryById(items, draggedId, targetId) {
    const nextDraggedId = String(draggedId || "").trim();
    const nextTargetId = String(targetId || "").trim();
    if (!nextDraggedId || !nextTargetId || nextDraggedId === nextTargetId || !Array.isArray(items) || items.length <= 1) return null;
    const fromIndex = items.findIndex(item => item.id === nextDraggedId);
    const toIndex = items.findIndex(item => item.id === nextTargetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;
    const nextItems = items.slice();
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    return nextItems;
  }
  function clearSortableState(container) {
    if (!container) return;
    container.querySelectorAll(".is-dragging, .drop-target").forEach(node => {
      node.classList.remove("is-dragging", "drop-target");
    });
  }
  function bindSortableItem(item, container, options) {
    const entryId = String(options?.entryId || "").trim();
    if (!item || !container || !entryId) return;
    item.draggable = true;
    item.addEventListener("dragstart", event => {
      options.setDraggedId(entryId);
      item.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", entryId);
      }
    });
    item.addEventListener("dragover", event => {
      const draggedId = String(options.getDraggedId() || "").trim();
      if (!draggedId || draggedId === entryId) return;
      event.preventDefault();
      item.classList.add("drop-target");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drop-target");
    });
    item.addEventListener("drop", event => {
      const draggedId = String(options.getDraggedId() || "").trim();
      item.classList.remove("drop-target");
      if (!draggedId || draggedId === entryId) return;
      event.preventDefault();
      options.onMove(draggedId, entryId);
    });
    item.addEventListener("dragend", () => {
      options.setDraggedId("");
      clearSortableState(container);
    });
  }
  function mergeAiImages(entries) {
    for (const entry of entries) {
      if (!entry || !entry.value) {
        continue;
      }
      if (input.state.aiImages.some(existing => existing.value === entry.value)) {
        continue;
      }
      input.state.aiImages.push(entry);
    }
    renderAiImageList();
  }

  function removeAiImage(imageId) {
    input.state.aiImages = input.state.aiImages.filter(item => item.id !== imageId);
    renderAiImageList();
  }

  function clearAiImages() {
    input.state.aiImages = [];
    const node = document.getElementById("ai-image-input");
    if (node) {
      node.value = "";
    }
    renderAiImageList();
  }

  function renderAiImageList() {
    input.renderImageList("ai-image-list", input.state.aiImages, "No uploaded chat images.", removeAiImage);
    renderAskComposerAttachments();
  }
  function renderAskSkillModelUploads() {
    return renderAskModels();
  }
  function clearAskSkillModelUploads() {
    return clearAskModels();
  }
  async function addAskSkillModelUploadsFromFiles(files) {
    return addAskModelUploads(files);
  }
  function renderAskFileUploads() {
    return renderAskFiles();
  }
  function clearAskFileUploads() {
    return clearAskFiles();
  }
  function renderAskComposerAttachments() {
    return renderAskAttachments();
  }
  async function addAskFileUploadsFromFiles(files) {
    return addAskFileUploads(files);
  }

  function mergeModerationImages(entries) {
    for (const entry of entries) {
      if (!entry || !entry.value) {
        continue;
      }
      if (input.state.moderationTestImages.some(existing => existing.value === entry.value)) {
        continue;
      }
      input.state.moderationTestImages.push(entry);
    }
    renderModerationImageList();
  }

  function removeModerationImage(imageId) {
    input.state.moderationTestImages = input.state.moderationTestImages.filter(item => item.id !== imageId);
    renderModerationImageList();
  }

  function clearModerationImages() {
    input.state.moderationTestImages = [];
    const node = document.getElementById("moderation-image-input");
    if (node) {
      node.value = "";
    }
    renderModerationImageList();
  }

  function renderModerationImageList() {
    input.renderImageList(
      "moderation-image-list",
      input.state.moderationTestImages,
      "No moderation test images attached.",
      removeModerationImage
    );
  }

  function setImageGenerationStatus(text) {
    if (typeof setStudioStatusPanel === "function") {
      setStudioStatusPanel({
        statusKey: "imagegen",
        text,
        currentId: "imagegen-status",
        stateId: "imagegen-status-state",
        progressTrackId: "imagegen-status-progress-track",
        progressFillId: "imagegen-status-progress",
        historyId: "imagegen-status-history"
      });
      renderImageBottomQueue();
      return;
    }
    const node = document.getElementById("imagegen-status");
    if (node) {
      node.textContent = text;
    }
    renderImageBottomQueue();
  }
  function setVideoGenerationStatus(text) {
    if (typeof setStudioStatusPanel === "function") {
      setStudioStatusPanel({
        statusKey: "videogen",
        text,
        currentId: "videogen-status",
        stateId: "videogen-status-state",
        progressTrackId: "videogen-status-progress-track",
        progressFillId: "videogen-status-progress",
        historyId: "videogen-status-history"
      });
      renderVideoBottomQueue();
      return;
    }
    const node = document.getElementById("videogen-status");
    if (node) {
      node.textContent = text;
    }
    renderVideoBottomQueue();
  }

  function setModel3dLowPolyUploadSourceName(value) {
    const node = document.getElementById("model3d-lowpoly-upload-source-name");
    if (node) {
      node.value = value || "";
    }
  }

  function syncModel3dLowPolyUploadFaceInput() {
    const useLlmToggle = document.getElementById("model3d-lowpoly-upload-use-llm");
    const facesInput = document.getElementById("model3d-lowpoly-upload-target-faces");
    if (!useLlmToggle || !facesInput) {
      return;
    }
    facesInput.disabled = useLlmToggle.checked === true;
  }
  function isSupportedModel3dLowPolyUploadFile(fileName) {
    return /\.(glb|gltf|fbx|obj)$/i.test(String(fileName || "").trim());
  }

  function clearModel3dLowPolyUploadSource() {
    selectedModel3dLowPolyUploadFile = null;
    const fileInput = document.getElementById("model3d-lowpoly-upload-source-file");
    if (fileInput) {
      fileInput.value = "";
    }
    setModel3dLowPolyUploadSourceName("");
    if (typeof input.onModel3dLowPolyUploadSourceChange === "function") {
      input.onModel3dLowPolyUploadSourceChange(null);
    }
  }
  function setModel3dEditUploadSourceName(value) {
    const node = document.getElementById("model3d-edit-upload-source-name");
    if (node) {
      node.value = value || "";
    }
  }
  function getSelectedModel3dEditUploadFile() {
    return selectedModel3dEditUploadFiles.find(entry => entry.id === selectedModel3dEditUploadFileId) || selectedModel3dEditUploadFiles[0] || null;
  }
  function moveModel3dEditUploadFile(draggedId, targetId) {
    const nextItems = moveListEntryById(selectedModel3dEditUploadFiles, draggedId, targetId);
    if (!nextItems) return;
    selectedModel3dEditUploadFiles = nextItems;
    renderModel3dEditUploadSourceList();
  }
  function renderModel3dEditUploadSourceList() {
    const list = document.getElementById("model3d-edit-upload-source-list");
    const active = getSelectedModel3dEditUploadFile();
    setModel3dEditUploadSourceName(active ? active.file.name || "" : "");
    const batchControls = document.getElementById("model3d-edit-batch-controls");
    if (batchControls) {
      batchControls.classList.toggle("hidden", !isModel3dEditBatchEnabled() || selectedModel3dEditUploadFiles.length === 0);
    }
    if (!list) {
      return;
    }
    input.clearChildren(list);
    if (!selectedModel3dEditUploadFiles.length) {
      const empty = document.createElement("div");
      empty.className = "model3d-source-item";
      empty.innerHTML =
        "<div class='model3d-source-item-thumb-wrap'><div class='model3d-source-item-thumb-fallback'>3D</div></div>"
        + "<div class='model3d-source-item-body'><div class='model3d-source-item-name'>No uploaded model selected yet.</div><div class='model3d-source-item-meta'>Choose one or more 3D files, then activate the one you want to edit.</div></div>";
      list.appendChild(empty);
      return;
    }
    for (const entry of selectedModel3dEditUploadFiles) {
      const item = document.createElement("div");
      item.className = "model3d-source-item" + (entry.id === selectedModel3dEditUploadFileId ? " active" : "");
      bindSortableItem(item, list, {
        entryId: entry.id,
        getDraggedId: () => draggedModel3dEditUploadFileId,
        setDraggedId: value => {
          draggedModel3dEditUploadFileId = value;
        },
        onMove: moveModel3dEditUploadFile
      });
      const batchState = entry.batchState || createBatchItemState();
      const runStateClass = batchState.runState && batchState.runState !== "idle" ? (" model3d-source-item-state-" + input.escapeHtml(batchState.runState)) : "";
      const runStateLabel = batchState.runState === "success"
        ? "Done"
        : (batchState.runState === "error" ? "Failed" : (batchState.runState === "running" ? "Running" : "Idle"));
      item.innerHTML =
        "<div class='model3d-source-item-thumb-wrap'><div class='model3d-source-item-thumb-fallback'>3D</div></div>"
        + "<div class='model3d-source-item-body'>"
        + "<div class='model3d-source-item-topline'>"
        + "<label class='model3d-source-item-checkbox'><input data-model3d-edit-upload-selected='" + input.escapeHtml(entry.id) + "' type='checkbox'" + (batchState.selected !== false ? " checked" : "") + "><span>Run</span></label>"
        + "<span class='model3d-source-item-state" + runStateClass + "'>" + runStateLabel + "</span>"
        + "</div>"
        + "<div class='model3d-source-item-name'>" + input.escapeHtml(entry.file.name || "uploaded-model") + "</div><div class='model3d-source-item-meta'>" + input.escapeHtml(entry.detail) + "</div>"
        + (batchState.runMessage ? ("<div class='model3d-source-item-run-message'>" + input.escapeHtml(batchState.runMessage) + "</div>") : "")
        + "</div>"
        + "<div class='model3d-source-item-actions'>"
        + "<button class='secondary mini-button' data-model3d-edit-upload-use='" + input.escapeHtml(entry.id) + "' type='button'>Use</button>"
        + "<button class='secondary mini-button' data-model3d-edit-upload-remove='" + input.escapeHtml(entry.id) + "' type='button'>Remove</button>"
        + "</div>";
      list.appendChild(item);
    }
    list.querySelectorAll("[data-model3d-edit-upload-selected]").forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        setModel3dEditUploadSelection(checkbox.getAttribute("data-model3d-edit-upload-selected") || "", checkbox.checked === true);
      });
    });
    list.querySelectorAll("[data-model3d-edit-upload-use]").forEach(button => {
      button.addEventListener("click", () => {
        const nextId = String(button.getAttribute("data-model3d-edit-upload-use") || "").trim();
        if (!nextId) return;
        selectedModel3dEditUploadFileId = nextId;
        renderModel3dEditUploadSourceList();
      });
    });
    list.querySelectorAll("[data-model3d-edit-upload-remove]").forEach(button => {
      button.addEventListener("click", () => {
        const nextId = String(button.getAttribute("data-model3d-edit-upload-remove") || "").trim();
        selectedModel3dEditUploadFiles = selectedModel3dEditUploadFiles.filter(entry => entry.id !== nextId);
        if (selectedModel3dEditUploadFileId === nextId) selectedModel3dEditUploadFileId = selectedModel3dEditUploadFiles[0]?.id || "";
        renderModel3dEditUploadSourceList();
      });
    });
  }
  function addModel3dEditUploadFiles(files) {
    const nextFiles = Array.from(files || []).filter(Boolean);
    if (!nextFiles.length) return;
    for (const file of nextFiles) {
      const fileName = String(file?.name || "").trim();
      if (!fileName) continue;
      if (selectedModel3dEditUploadFiles.some(entry => entry.file.name === fileName && entry.file.size === file.size && entry.file.lastModified === file.lastModified)) continue;
      selectedModel3dEditUploadFiles.push({
        id: createStudioUploadId("model3d-edit-upload"),
        file,
        detail: ((file.type || "application/octet-stream") + " | " + formatAskSkillModelFileSize(file.size)).trim(),
        batchState: createBatchItemState()
      });
    }
    if (!selectedModel3dEditUploadFileId) selectedModel3dEditUploadFileId = selectedModel3dEditUploadFiles[0]?.id || "";
    renderModel3dEditUploadSourceList();
  }
  function clearModel3dEditUploadSource() {
    selectedModel3dEditUploadFiles = [];
    selectedModel3dEditUploadFileId = "";
    const fileInput = document.getElementById("model3d-edit-upload-source-file");
    if (fileInput) {
      fileInput.value = "";
    }
    renderModel3dEditUploadSourceList();
    if (typeof input.onModel3dLowPolyUploadSourceChange === "function") {
      input.onModel3dLowPolyUploadSourceChange(null);
    }
  }
  function isModel3dEditBatchEnabled() {
    return document.getElementById("model3d-edit-batch-enabled")?.checked === true;
  }
  function getModel3dEditExecutionUploads() {
    if (!isModel3dEditBatchEnabled()) {
      const selectedUpload = getSelectedModel3dEditUploadFile();
      return selectedUpload ? [selectedUpload] : [];
    }
    return selectedModel3dEditUploadFiles.filter(entry => entry.batchState?.selected !== false);
  }
  function setModel3dEditUploadSelection(sourceId, selected) {
    const normalizedId = String(sourceId || "").trim();
    const entry = selectedModel3dEditUploadFiles.find(item => item.id === normalizedId);
    if (!entry) return;
    entry.batchState = entry.batchState || createBatchItemState();
    entry.batchState.selected = selected === true;
    renderModel3dEditUploadSourceList();
  }
  function setAllModel3dEditUploadSelections(selected) {
    selectedModel3dEditUploadFiles.forEach(entry => {
      entry.batchState = entry.batchState || createBatchItemState();
      entry.batchState.selected = selected === true;
    });
    renderModel3dEditUploadSourceList();
  }
  function updateModel3dEditUploadRunState(sourceId, runState, runMessage) {
    const normalizedId = String(sourceId || "").trim();
    const entry = selectedModel3dEditUploadFiles.find(item => item.id === normalizedId);
    if (!entry) return;
    entry.batchState = entry.batchState || createBatchItemState();
    entry.batchState.runState = String(runState || "idle").trim() || "idle";
    entry.batchState.runMessage = String(runMessage || "").trim();
    renderModel3dEditUploadSourceList();
  }
  function resetModel3dEditUploadRunStates() {
    selectedModel3dEditUploadFiles.forEach(entry => {
      entry.batchState = entry.batchState || createBatchItemState();
      entry.batchState.runState = "idle";
      entry.batchState.runMessage = "";
    });
    renderModel3dEditUploadSourceList();
  }
  function getModel3dEditPayload() {
    const targetMode = document.querySelector("[data-model3d-edit-target].active")?.getAttribute("data-model3d-edit-target") === "upload"
      ? "upload"
      : "selected";
    const dimensionMode = document.getElementById("model3d-edit-dimension-mode")?.value === "llm"
      ? "llm"
      : (document.getElementById("model3d-edit-dimension-mode")?.value === "manual" ? "manual" : "keep");
    const targetHeightMetersRaw = document.getElementById("model3d-edit-target-height")?.value || "";
    const parsedTargetHeightMeters = Number.parseFloat(String(targetHeightMetersRaw).replace(",", "."));
    const targetHeightMeters = Number.isFinite(parsedTargetHeightMeters)
      ? Math.max(0.03, Math.min(4000, parsedTargetHeightMeters))
      : undefined;
    const metallicMode = document.getElementById("model3d-edit-metallic-mode")?.value === "enable"
      ? "enable"
      : (document.getElementById("model3d-edit-metallic-mode")?.value === "disable" ? "disable" : "keep");
    const roughnessEnabled = document.getElementById("model3d-edit-roughness-enabled")?.checked === true;
    const roughnessRaw = Number.parseFloat(document.getElementById("model3d-edit-roughness")?.value || "0.5");
    const roughnessValue = Number.isFinite(roughnessRaw) ? Math.max(0, Math.min(1, roughnessRaw)) : 0.5;
    return {
      targetMode,
      dimensionMode,
      targetHeightMeters,
      metallicMode,
      roughnessMode: roughnessEnabled ? "set" : "keep",
      roughnessValue
    };
  }
  function updateImagePreviewQuickActions(record) {
    imagePreviewQuickActionController.updateQuickActions(record);
  }
  function readWorkflowSeed(ids) {
    return workflowSeedHelpers.readSeed(ids);
  }
  function applySeedControlAfterGenerate(ids, controlId, usedSeed) {
    workflowSeedHelpers.applyControlAfterGenerate(ids, controlId, usedSeed);
  }
  function syncWorkflowSeedControl(sourceId, targetId) {
    workflowSeedHelpers.syncControl(sourceId, targetId);
  }
  function syncWorkflowSeedInputs(sourceId, targetId) {
    workflowSeedHelpers.syncInputs(sourceId, targetId);
  }
  function syncImageEditorResolutionSelect(width, height) {
    const select = document.getElementById("image-editor-resolution-select");
    if (!select) {
      return;
    }
    const exactValue = width + "x" + height;
    const hasOption = Array.from(select.options || []).some(option => option.value === exactValue);
    select.value = hasOption ? exactValue : "custom";
  }
  function updateImageEditorAspectRatio(width, height) {
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      imageEditorAspectRatio = width / height;
    }
  }
  function normalizeImageEditorDimension(value) {
    const clamped = Math.min(4096, Math.max(64, Number(value) || 512));
    return Math.min(4096, Math.max(64, Math.round(clamped / 8) * 8));
  }
  function setImageEditorDimensions(width, height) {
    const normalizedWidth = normalizeImageEditorDimension(width);
    const normalizedHeight = normalizeImageEditorDimension(height);
    syncingImageEditorAspectRatio = true;
    setInputValue("image-editor-resolution-width", normalizedWidth);
    setInputValue("image-editor-resolution-height", normalizedHeight);
    syncingImageEditorAspectRatio = false;
    setInputValue("imagegen-width", normalizedWidth);
    setInputValue("imagegen-height", normalizedHeight);
    updateImageEditorAspectRatio(normalizedWidth, normalizedHeight);
    syncImageEditorResolutionSelect(normalizedWidth, normalizedHeight);
    applyImagePreviewWorkflowDimensions(normalizedWidth, normalizedHeight);
  }
  function syncImageEditorResolutionDimension(sourceId, targetId) {
    if (syncingImageEditorAspectRatio) {
      return;
    }
    const sourceValue = readOptionalNumberInput(sourceId, {min: 64, max: 4096});
    if (typeof sourceValue !== "number") {
      return;
    }
    setInputValue(targetId, sourceValue);
    let width = readOptionalNumberInput("image-editor-resolution-width", {min: 64, max: 4096}) || 512;
    let height = readOptionalNumberInput("image-editor-resolution-height", {min: 64, max: 4096}) || 512;
    const lockEnabled = document.getElementById("image-editor-resolution-lock")?.checked === true;
    if (lockEnabled) {
      const counterpartId = sourceId === "image-editor-resolution-width" ? "image-editor-resolution-height" : "image-editor-resolution-width";
      const counterpartTargetId = sourceId === "image-editor-resolution-width" ? "imagegen-height" : "imagegen-width";
      const counterpartValue = normalizeImageEditorDimension(sourceId === "image-editor-resolution-width"
        ? sourceValue / imageEditorAspectRatio
        : sourceValue * imageEditorAspectRatio);
      syncingImageEditorAspectRatio = true;
      setInputValue(counterpartId, counterpartValue);
      syncingImageEditorAspectRatio = false;
      setInputValue(counterpartTargetId, counterpartValue);
      width = sourceId === "image-editor-resolution-width" ? sourceValue : counterpartValue;
      height = sourceId === "image-editor-resolution-height" ? sourceValue : counterpartValue;
    } else {
      updateImageEditorAspectRatio(width, height);
    }
    syncImageEditorResolutionSelect(width, height);
    applyImagePreviewWorkflowDimensions(width, height);
  }
  function syncImageEditorNumber(sourceId, targetId, options) {
    const value = readOptionalNumberInput(sourceId, options);
    if (typeof value === "number") {
      setInputValue(targetId, value);
    }
  }
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function applyPromptPreset(promptNode, text, presetPhrases) {
    if (!text || !promptNode || typeof promptNode.value !== "string") {
      return;
    }
    const knownPhrases = presetPhrases.filter(Boolean).map(escapeRegExp);
    const presetPattern = new RegExp("(?:^|\\s*,\\s*)(?:" + knownPhrases.join("|") + ")(?=\\s*,\\s*|$)", "gi");
    const basePrompt = promptNode.value
      .replace(presetPattern, "")
      .replace(/\s*,\s*,+/g, ", ")
      .replace(/^\s*,\s*|\s*,\s*$/g, "")
      .trim();
    promptNode.value = basePrompt ? basePrompt + ", " + text : text;
    promptNode.dispatchEvent(new Event("input", { bubbles: true }));
    promptNode.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function applyImageStylePreset(preset) {
    applyPromptPreset(document.getElementById("imagegen-prompt"), imageStylePresetText[preset] || "", imageStylePresetPhrases);
  }
  function bindImageCreativeControls() {
    document.querySelectorAll("[data-image-style-preset]").forEach(button => {
      button.addEventListener("click", event => {
        const preset = String(event.currentTarget.getAttribute("data-image-style-preset") || "").trim();
        document.querySelectorAll("[data-image-style-preset]").forEach(item => item.classList.toggle("active", item === event.currentTarget));
        applyImageStylePreset(preset);
      });
    });
    document.querySelectorAll("[data-image-aspect-ratio]").forEach(button => {
      button.addEventListener("click", event => {
        document.querySelectorAll("[data-image-aspect-ratio]").forEach(item => item.classList.toggle("active", item === event.currentTarget));
        setImageEditorDimensions(event.currentTarget.getAttribute("data-image-aspect-width"), event.currentTarget.getAttribute("data-image-aspect-height"));
      });
    });
    const resolutionSelect = document.getElementById("image-editor-resolution-select");
    if (resolutionSelect) {
      resolutionSelect.addEventListener("change", () => {
        const resolution = parseResolutionValue(resolutionSelect.value);
        if (resolution) {
          setImageEditorDimensions(resolution.width, resolution.height);
        }
      });
    }
    [["image-editor-resolution-width", "imagegen-width"], ["image-editor-resolution-height", "imagegen-height"]].forEach(([sourceId, targetId]) => {
      const node = document.getElementById(sourceId);
      if (node) {
        node.addEventListener("input", () => syncImageEditorResolutionDimension(sourceId, targetId));
      }
    });
    document.getElementById("image-editor-resolution-lock")?.addEventListener("change", event => {
      if (!event.currentTarget.checked) {
        return;
      }
      const width = readOptionalNumberInput("image-editor-resolution-width", {min: 64, max: 4096}) || 512;
      const height = readOptionalNumberInput("image-editor-resolution-height", {min: 64, max: 4096}) || 512;
      updateImageEditorAspectRatio(width, height);
    });
    [["image-editor-seed", "imagegen-seed", { min: 0, max: Number.MAX_SAFE_INTEGER }], ["image-editor-steps", "imagegen-steps", { min: 1, max: 250 }], ["image-editor-cfg", "imagegen-cfg", { min: 0, max: 30, float: true }]].forEach(([sourceId, targetId, options]) => {
      const node = document.getElementById(sourceId);
      if (node) {
        node.addEventListener("input", () => syncImageEditorNumber(sourceId, targetId, options));
      }
    });
    setImageEditorDimensions(512, 512);
    syncImageEditorNumber("image-editor-seed", "imagegen-seed", { min: 0, max: Number.MAX_SAFE_INTEGER });
    syncImageEditorNumber("image-editor-steps", "imagegen-steps", { min: 1, max: 250 });
    syncImageEditorNumber("image-editor-cfg", "imagegen-cfg", { min: 0, max: 30, float: true });
    syncWorkflowSeedInputs("image-editor-seed", "imagegen-seed");
    syncWorkflowSeedControl("image-editor-seed-control", "imagegen-seed-control");
  }
  function getActiveVideoEditorValue(selector, attributeName, fallback) {
    const active = document.querySelector(selector + ".active");
    return String(active?.getAttribute(attributeName) || fallback || "").trim();
  }
  function setActiveEditorButton(button, selector) {
    document.querySelectorAll(selector).forEach(item => item.classList.toggle("active", item === button));
  }
  function applyVideoPresetPrompt(preset) {
    applyPromptPreset(document.getElementById("videogen-prompt"), videoPresetText[preset] || "", videoPresetPhrases);
  }
  function getVideoEditorDimensions(aspect, resolution) {
    const size = Math.max(64, Math.min(2160, Number.parseInt(resolution, 10) || 1080));
    if (aspect === "9:16") return { width: size, height: Math.round(size * 16 / 9) };
    if (aspect === "1:1") return { width: size, height: size };
    if (aspect === "4:5") return { width: Math.round(size * 4 / 5), height: size };
    if (aspect === "21:9") return { width: Math.round(size * 21 / 9), height: size };
    return { width: Math.round(size * 16 / 9), height: size };
  }
  function syncVideoEditorDimensions() {
    const aspect = getActiveVideoEditorValue("[data-video-aspect-ratio]", "data-video-aspect-ratio", "16:9");
    const resolution = getActiveVideoEditorValue("[data-video-resolution]", "data-video-resolution", "1080");
    if (aspect === "custom") {
      return;
    }
    const dimensions = getVideoEditorDimensions(aspect, resolution);
    setInputValue("videogen-width", Math.min(4096, dimensions.width));
    setInputValue("videogen-height", Math.min(4096, dimensions.height));
  }
  function syncVideoEditorFrames() {
    const seconds = Number.parseInt(getActiveVideoEditorValue("[data-video-duration-seconds]", "data-video-duration-seconds", "5"), 10) || 5;
    const fps = Number.parseInt(getActiveVideoEditorValue("[data-video-fps]", "data-video-fps", "30"), 10) || 30;
    setInputValue("videogen-frames", Math.max(1, Math.min(512, seconds * fps)));
  }
  function bindVideoCreativeControls() {
    document.querySelectorAll("[data-video-preset]").forEach(button => {
      button.addEventListener("click", event => {
        setActiveEditorButton(event.currentTarget, "[data-video-preset]");
        applyVideoPresetPrompt(String(event.currentTarget.getAttribute("data-video-preset") || "").trim());
      });
    });
    document.querySelectorAll("[data-video-aspect-ratio]").forEach(button => {
      button.addEventListener("click", event => {
        setActiveEditorButton(event.currentTarget, "[data-video-aspect-ratio]");
        syncVideoEditorDimensions();
      });
    });
    document.querySelectorAll("[data-video-resolution]").forEach(button => {
      button.addEventListener("click", event => {
        setActiveEditorButton(event.currentTarget, "[data-video-resolution]");
        syncVideoEditorDimensions();
      });
    });
    document.querySelectorAll("[data-video-duration-seconds]").forEach(button => {
      button.addEventListener("click", event => {
        setActiveEditorButton(event.currentTarget, "[data-video-duration-seconds]");
        syncVideoEditorFrames();
      });
    });
    document.querySelectorAll("[data-video-fps]").forEach(button => {
      button.addEventListener("click", event => {
        setActiveEditorButton(event.currentTarget, "[data-video-fps]");
        setInputValue("videogen-fps", String(event.currentTarget.getAttribute("data-video-fps") || "30"));
        syncVideoEditorFrames();
      });
    });
    const stepsNode = document.getElementById("video-editor-steps");
    if (stepsNode) {
      stepsNode.addEventListener("input", () => syncImageEditorNumber("video-editor-steps", "videogen-steps", { min: 1, max: 250 }));
    }
    syncVideoEditorDimensions();
    syncVideoEditorFrames();
    setInputValue("videogen-fps", getActiveVideoEditorValue("[data-video-fps]", "data-video-fps", "30"));
    syncImageEditorNumber("video-editor-steps", "videogen-steps", { min: 1, max: 250 });
  }
  function getImagePreviewWorkflowDimensions(widthOverride, heightOverride) {
    const width = Number.isFinite(Number(widthOverride))
      ? Number(widthOverride)
      : readOptionalNumberInput("imagegen-width", { min: 64, max: 4096 });
    const height = Number.isFinite(Number(heightOverride))
      ? Number(heightOverride)
      : readOptionalNumberInput("imagegen-height", { min: 64, max: 4096 });
    return width && height ? { width, height } : null;
  }
  function applyImagePreviewWorkflowDimensions(widthOverride, heightOverride) {
    const panel = document.getElementById("image-studio-preview-panel");
    const dimensions = getImagePreviewWorkflowDimensions(widthOverride, heightOverride);
    if (!panel) {
      return;
    }
    if (!dimensions) {
      panel.classList.remove("has-workflow-size");
      panel.style.removeProperty("--image-preview-workflow-width");
      panel.style.removeProperty("--image-preview-workflow-height");
      panel.style.removeProperty("--image-preview-workflow-aspect");
      return;
    }
    panel.classList.add("has-workflow-size");
    panel.style.setProperty("--image-preview-workflow-width", String(dimensions.width));
    panel.style.setProperty("--image-preview-workflow-height", String(dimensions.height));
    panel.style.setProperty("--image-preview-workflow-aspect", dimensions.width + " / " + dimensions.height);
  }
  async function applyImagePreviewWorkflowDimensionsFromWorkflow() {
    const explicitDimensions = getImagePreviewWorkflowDimensions();
    const workflowPath = String(document.getElementById("comfy-image-workflow-path-input")?.value || "").trim();
    const query = workflowPath ? "?workflowPath=" + encodeURIComponent(workflowPath) : "";
    try {
      const metadata = await input.request("/api/image-workflow-metadata" + query);
      [
        ["imagegen-width", metadata.width],
        ["imagegen-height", metadata.height],
        ["imagegen-seed", metadata.seed],
        ["imagegen-steps", metadata.steps],
        ["imagegen-cfg", metadata.cfg]
      ].forEach(([id, value]) => {
        const node = document.getElementById(id);
        if (!node) {
          return;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
          node.setAttribute("placeholder", String(value));
        } else {
          node.removeAttribute("placeholder");
        }
      });
      if (explicitDimensions) {
        applyImagePreviewWorkflowDimensions(explicitDimensions.width, explicitDimensions.height);
        return explicitDimensions;
      }
      const width = Number(metadata.width);
      const height = Number(metadata.height);
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        applyImagePreviewWorkflowDimensions(width, height);
        return { width, height };
      }
    } catch (error) {
      console.warn("Failed to read image workflow dimensions.", error);
    }
    applyImagePreviewWorkflowDimensions();
    return null;
  }
  function setImagePreviewLoading(active) {
    const panel = document.getElementById("image-studio-preview-panel");
    const preview = document.getElementById("imagegen-preview");
    const placeholder = document.getElementById("image-generation-placeholder");
    document.querySelectorAll("#image-studio-preview-panel .image-studio-preview-tools, #image-preview-quick-action-hint").forEach(node => {
      node.classList.toggle("hidden", active === true);
      node.setAttribute("aria-hidden", active === true ? "true" : "false");
    });
    if (panel) {
      panel.classList.toggle("is-generating", active === true);
      panel.setAttribute("aria-busy", active === true ? "true" : "false");
    }
    if (placeholder) placeholder.classList.toggle("hidden", active !== true);
    if (!preview) {
      return;
    }
    preview.classList.toggle("is-loading", active === true);
  }
  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read image data."));
      reader.readAsDataURL(blob);
    });
  }
  async function resolveImageTargetDataUrl(target) {
    const source = String(target?.imageUrl || "").trim();
    if (!source) {
      throw new Error("No image source is selected.");
    }
    if (source.startsWith("data:image/")) {
      return source;
    }
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error("Failed to read image source for Blender import.");
    }
    return await readBlobAsDataUrl(await response.blob());
  }
  async function importImageTargetIntoBlender(target, executionTarget) {
    if (target.kind === "generated" && target.record?.id && target.record?.imageFileName) {
      await input.request("/api/blender-open-image", {
        imageId: target.record.id,
        fileName: target.record.imageFileName,
        executionTarget
      });
      return target.record.imageFileName;
    }
    const imageDataUrl = await resolveImageTargetDataUrl(target);
    const fileName = target.fileName || target.label || "image-plane.png";
    await input.request("/api/blender-open-image", {
      imageDataUrl,
      fileName,
      executionTarget
    });
    return fileName;
  }
  async function importImageTargetsIntoOneBlenderFile(targets, executionTarget) {
    const items = [];
    for (const target of targets) {
      if (target.kind === "generated" && target.record?.id && target.record?.imageFileName) {
        items.push({
          imageId: target.record.id,
          fileName: target.record.imageFileName
        });
        continue;
      }
      items.push({
        imageDataUrl: await resolveImageTargetDataUrl(target),
        fileName: target.fileName || target.label || "image-plane.png",
        label: target.label || target.fileName || "image-plane.png"
      });
    }
    return await input.request("/api/blender-open-images", {
      items,
      executionTarget
    });
  }
  async function importSelectedImageIntoBlender() {
    const targets = getImageQuickActionTargets();
    if (targets.length === 0) {
      return void input.setOutput("Select a generated image or uploaded source first.");
    }
    const executionTarget = document.getElementById("model3d-generation-target")?.value === "remote" ? "remote" : "local";
    if (targets.length > 1) {
      const blenderMode = await openDashboardChoiceOverlay({
        kicker: "Blender Import",
        title: "Open " + targets.length + " images in Blender",
        message: "Choose whether the selected images should share one Blender scene or open separately.",
        detail: "One scene lays the image planes out together. Separate windows keeps the current one-file-per-image behavior.",
        oneLabel: "One Blender Scene",
        separateLabel: "Separate Windows"
      });
      if (!blenderMode) {
        return;
      }
      if (blenderMode === "one") {
        const result = await importImageTargetsIntoOneBlenderFile(targets, executionTarget);
        const count = Array.isArray(result?.fileNames) ? result.fileNames.length : targets.length;
        input.setOutput("Imported " + count + " images into one Blender scene.");
        return;
      }
    }
    const importedNames = [];
    for (const target of targets) {
      importedNames.push(await importImageTargetIntoBlender(target, executionTarget));
    }
    const importedLabel = importedNames.length === 1 ? importedNames[0] : importedNames.length + " images";
    input.setOutput("Imported " + importedLabel + " into Blender on image planes.");
  }
  async function useSelectedImageAsToolLogo() {
    const actionTarget = getActiveImageQuickActionTarget();
    const record = actionTarget && actionTarget.kind === "generated" ? actionTarget.record : null;
    if (!record || !record.id || !record.imageFileName) {
      return void input.setOutput("Select a generated Image Studio image first.");
    }
    const toolSelection = typeof input.getToolQuickActionSelection === "function"
      ? input.getToolQuickActionSelection("image")
      : null;
    if (!toolSelection || !toolSelection.sourcePath) {
      return;
    }
    setImageGenerationStatus("Updating " + toolSelection.title + " logo...");
    const payload = await input.request("/api/tool-thumbnail", {
      imageId: record.id,
      imageFileName: record.imageFileName,
      toolSourcePath: toolSelection.sourcePath
    });
    const backupText = payload.backupFileName ? " Previous thumbnail backed up as " + payload.backupFileName + "." : "";
    setImageGenerationStatus("Updated " + toolSelection.title + " logo.");
    input.setOutput("Used " + record.imageFileName + " as " + toolSelection.title + " thumbnail.png." + backupText);
  }
  function applyImagePreviewRevealValue(value) {
    const slider = document.getElementById("image-preview-reveal-slider");
    const valueNode = document.getElementById("image-preview-reveal-value");
    const overlay = document.getElementById("image-preview-reveal-overlay");
    const divider = document.getElementById("image-preview-reveal-divider");
    const clamped = Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : imagePreviewRevealState.value));
    imagePreviewRevealState.value = clamped;
    if (slider) {
      slider.value = String(clamped);
    }
    if (valueNode) {
      valueNode.textContent = String(clamped);
    }
    if (overlay) {
      overlay.style.clipPath = "inset(0 0 0 " + clamped + "%)";
    }
    if (divider) {
      divider.style.left = clamped + "%";
    }
  }
  function applyImagePreviewRevealValueFromClientX(clientX) {
    const stage = document.getElementById("image-preview-reveal-stage");
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return;
    }
    const ratio = (Number(clientX) - rect.left) / rect.width;
    applyImagePreviewRevealValue(Math.round(Math.max(0, Math.min(1, ratio)) * 100));
  }
  function updateImagePreviewRevealAspectRatio(sourceUrl) {
    const stage = document.getElementById("image-preview-reveal-stage");
    const source = String(sourceUrl || "").trim();
    if (!stage) {
      return;
    }
    if (!source) {
      stage.style.removeProperty("--image-preview-reveal-aspect");
      return;
    }
    const dimensions = getImagePreviewWorkflowDimensions();
    if (dimensions) {
      stage.style.setProperty("--image-preview-reveal-aspect", dimensions.width + " / " + dimensions.height);
      return;
    }
    const probe = new Image();
    probe.onload = () => {
      if (!probe.naturalWidth || !probe.naturalHeight) {
        return;
      }
      stage.style.setProperty("--image-preview-reveal-aspect", probe.naturalWidth + " / " + probe.naturalHeight);
    };
    probe.onerror = () => {
      stage.style.removeProperty("--image-preview-reveal-aspect");
    };
    probe.src = source;
  }
  function hideImagePreviewReveal() {
    const panel = document.getElementById("image-preview-reveal");
    const previewPanel = document.getElementById("image-studio-preview-panel");
    const sourceNode = document.getElementById("image-preview-reveal-source");
    const resultNode = document.getElementById("image-preview-reveal-result");
    const previewNode = document.getElementById("imagegen-preview");
    imagePreviewRevealState.sourceUrl = "";
    imagePreviewRevealState.resultUrl = "";
    if (panel) {
      panel.classList.add("hidden");
      panel.style.display = "";
    }
    if (previewPanel) {
      previewPanel.classList.remove("has-reveal-preview");
    }
    if (previewNode) {
      previewNode.classList.remove("hidden");
      previewNode.style.removeProperty("display");
    }
    if (sourceNode) {
      sourceNode.removeAttribute("src");
    }
    if (resultNode) {
      resultNode.removeAttribute("src");
    }
    updateImagePreviewRevealAspectRatio("");
  }
  function showImagePreviewRevealComparison(sourceUrl, resultUrl, options) {
    const panel = document.getElementById("image-preview-reveal");
    const previewPanel = document.getElementById("image-studio-preview-panel");
    const sourceNode = document.getElementById("image-preview-reveal-source");
    const resultNode = document.getElementById("image-preview-reveal-result");
    const previewNode = document.getElementById("imagegen-preview");
    if (!panel || !sourceNode || !resultNode) {
      return;
    }
    const normalizedSourceUrl = String(sourceUrl || "").trim();
    const normalizedResultUrl = String(resultUrl || "").trim();
    if (!normalizedSourceUrl || !normalizedResultUrl) {
      hideImagePreviewReveal();
      return;
    }
    imagePreviewRevealState.sourceUrl = normalizedSourceUrl;
    imagePreviewRevealState.resultUrl = normalizedResultUrl;
    sourceNode.src = normalizedSourceUrl;
    resultNode.src = normalizedResultUrl;
    updateImagePreviewRevealAspectRatio(normalizedSourceUrl);
    panel.classList.remove("hidden");
    panel.style.display = "grid";
    if (previewPanel) {
      previewPanel.classList.add("has-reveal-preview");
    }
    if (previewNode) {
      previewNode.classList.add("hidden");
      previewNode.style.setProperty("display", "none", "important");
    }
    const preferredValue = options && Number.isFinite(Number(options.value)) ? Number(options.value) : imagePreviewRevealState.value;
    applyImagePreviewRevealValue(preferredValue);
  }
  function getImageRecordMetadata(record) {
    const metadata = record?.metadata;
    const topLevelMetadata = {};
    ["imageVariantSourceId", "imageVariantSourceFileName", "sourceImageId", "sourceImageFileName"].forEach(key => {
      const value = String(record?.[key] || "").trim();
      if (value) {
        topLevelMetadata[key] = value;
      }
    });
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      return { ...topLevelMetadata, ...metadata };
    }
    if (typeof metadata === "string") {
      try {
        const parsed = JSON.parse(metadata);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...topLevelMetadata, ...parsed } : topLevelMetadata;
      } catch {
        return topLevelMetadata;
      }
    }
    return topLevelMetadata;
  }
  function findGeneratedImageByFileName(fileName) {
    const normalizedFileName = String(fileName || "").trim();
    if (!normalizedFileName || !Array.isArray(input.state.generatedImages)) {
      return null;
    }
    return input.state.generatedImages.find(record => String(record?.imageFileName || "").trim() === normalizedFileName) || null;
  }
  function buildImagePreviewRevealSourceFromMetadata(selected) {
    const metadata = getImageRecordMetadata(selected);
    const sourceId = String(metadata.imageVariantSourceId || metadata.sourceImageId || "").trim();
    const sourceFileName = String(metadata.imageVariantSourceFileName || metadata.sourceImageFileName || "").trim();
    if (!sourceId || !sourceFileName || sourceId === String(selected?.id || "").trim()) {
      return null;
    }
    return {
      id: sourceId,
      imageFileName: sourceFileName,
      label: sourceFileName
    };
  }
  function showSelectedImageVariantRevealSlider() {
    const selected = getSelectedGeneratedImage();
    const resolvedSource = resolveImageVariantSourceRecord(selected);
    const metadataSource = buildImagePreviewRevealSourceFromMetadata(selected) || findGeneratedImageByFileName(getImageRecordMetadata(selected).imageVariantSourceFileName);
    const source = resolvedSource?.id && resolvedSource.id !== selected?.id ? resolvedSource : (metadataSource || resolvedSource);
    if (!selected?.id || !selected?.imageFileName || !source?.id || !source?.imageFileName) {
      input.setOutput("Select an image variant first.");
      return;
    }
    if (selected.id === source.id) {
      input.setOutput("Select a generated image variant to compare it with the original.");
      return;
    }
    const sourceUrl = input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(source.id, source.imageFileName));
    const selectedUrl = input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(selected.id, selected.imageFileName));
    showImagePreviewRevealComparison(sourceUrl, selectedUrl, { value: imagePreviewRevealState.value || 50 });
    setImageGenerationStatus("Reveal slider compares " + selected.imageFileName + " with original " + source.imageFileName + ".");
  }
  function setModel3dSourceFromSelectedImage(record) {
    if (!record || !record.id || !record.imageFileName) {
      return "";
    }
    const sourceUrl = input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(record.id, record.imageFileName));
    if (!sourceUrl) {
      return "";
    }
    const modelSourceField = document.getElementById("model3d-image-source");
    if (modelSourceField && typeof modelSourceField.value === "string") {
      modelSourceField.value = sourceUrl;
      modelSourceField.dispatchEvent(new Event("input", { bubbles: true }));
      modelSourceField.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return sourceUrl;
  }
  function renderModel3dRecentImageSources() {
    const container = document.getElementById("model3d-recent-image-list");
    if (!container) {
      return;
    }
    detachDashboardLazyMedia(container);
    input.clearChildren(container);
    const entries = (Array.isArray(input.state.generatedImages) ? input.state.generatedImages : []).slice(0, 12);
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "studio-sidebar-preview-empty";
      empty.textContent = "No generated images yet.";
      container.appendChild(empty);
      return;
    }
    const selectedSource = String(document.getElementById("model3d-image-source")?.value || "").trim();
    entries.forEach(entry => {
      const sourceUrl = input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(entry.id, entry.imageFileName));
      const button = document.createElement("button");
      button.className = "model3d-recent-image-button" + (selectedSource === sourceUrl ? " active" : "");
      button.type = "button";
      button.title = entry.imageFileName;
      const image = document.createElement("img");
      image.alt = entry.imageFileName;
      image.loading = "lazy";
      image.decoding = "async";
      attachDashboardLazyMedia(image, sourceUrl, false);
      const name = document.createElement("span");
      name.textContent = entry.imageFileName;
      button.append(image, name);
      button.addEventListener("click", () => {
        if (!setModel3dSourceFromSelectedImage(entry)) {
          return void input.setOutput("Failed to select recent image as 3D source.");
        }
        renderModel3dRecentImageSources();
        input.setOutput("Selected " + entry.imageFileName + " as the 3D model source image.");
      });
      container.appendChild(button);
    });
  }
  function normalizeModel3dImageSourcePath(source) {
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
  function getModel3dUploadedImageFileName(source) {
    const normalized = normalizeModel3dImageSourcePath(source);
    const marker = "\\uploaded-model-images\\";
    const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
    if (markerIndex === -1) {
      return "";
    }
    const parts = normalized.slice(markerIndex + marker.length).split("\\").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "";
  }
  function getModel3dGeneratedImageSourceParts(source) {
    const normalized = normalizeModel3dImageSourcePath(source);
    const marker = "\\generated-images\\";
    const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
    if (markerIndex === -1) {
      return null;
    }
    const parts = normalized.slice(markerIndex + marker.length).split("\\").filter(Boolean);
    return parts.length >= 2 ? { imageId: parts[0], fileName: parts[parts.length - 1] } : null;
  }
  function getModel3dSourceName(source) {
    const normalized = String(source || "").trim();
    if (!normalized) {
      return "model3d-source.png";
    }
    const clean = normalized.replace(/[?#].*$/, "");
    const parts = clean.split(/[\\/]/).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "model3d-source.png";
  }
  function resolveModel3dSourceUrlForTool(source) {
    const normalized = String(source || "").trim();
    if (!normalized) {
      return "";
    }
    if (/^data:image\//i.test(normalized) || /^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    if (/^\/api\//i.test(normalized)) {
      return input.buildAbsoluteDashboardUrl(normalized);
    }
    const generated = getModel3dGeneratedImageSourceParts(normalized);
    if (generated) {
      return input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(generated.imageId, generated.fileName));
    }
    const uploadedFileName = getModel3dUploadedImageFileName(normalized);
    if (uploadedFileName) {
      return input.buildAbsoluteDashboardUrl("/api/uploaded-model-image-file?file=" + encodeURIComponent(uploadedFileName));
    }
    return "";
  }
  async function prepareModel3dSourceInSplitCombineTool() {
    const sourceField = document.getElementById("model3d-image-source");
    const source = String(sourceField?.value || "").split(/\r?\n/).map(entry => entry.trim()).filter(Boolean)[0] || "";
    const imageUrl = resolveModel3dSourceUrlForTool(source);
    if (!source || !imageUrl) {
      return void input.setOutput("Upload or select a 3D source image before opening Split + Combine.");
    }
    const openTool = typeof window.openDashboardToolWithAssetPayload === "function"
      ? window.openDashboardToolWithAssetPayload
      : null;
    if (!openTool) {
      return void input.setOutput("Image Split + Combine handoff is not ready yet.");
    }
    const fileName = getModel3dSourceName(source);
    await openTool("/tools/art/image-split-and-combine/", {
      kind: "image",
      imageUrl,
      previewImageUrl: imageUrl,
      imageFileName: fileName,
      fileName
    }, { switchView: true });
    input.setOutput("Opened Image Split + Combine with the current 3D source image.");
  }
  async function triggerModel3dFromSelectedPreview(options) {
    const targets = getImageQuickActionTargets();
    if (targets.length === 0) {
      input.setOutput("Select a generated image or uploaded edit source first.");
      return;
    }
    const sourceUrls = targets.map(target => {
      if (target.kind === "generated" && target.record) {
        return input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(target.record.id, target.record.imageFileName));
      }
      return target.imageUrl;
    }).map(source => String(source || "").trim()).filter(Boolean);
    if (sourceUrls.length === 0) {
      input.setOutput("Failed to prepare selected image as 3D source.");
      return;
    }
    const modelSourceField = document.getElementById("model3d-image-source");
    if (modelSourceField && typeof modelSourceField.value === "string") {
      modelSourceField.value = sourceUrls.join("\n");
      modelSourceField.dispatchEvent(new Event("input", { bubbles: true }));
      modelSourceField.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const batchSourcesToggle = document.getElementById("model3d-batch-sources");
    if (batchSourcesToggle && typeof batchSourcesToggle.checked === "boolean") {
      batchSourcesToggle.checked = sourceUrls.length > 1;
      batchSourcesToggle.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setCheckboxValue("model3d-llm-filename", options?.useLlmModelFileName !== false);
    setCheckboxValue("model3d-llm-description", options?.useLlmModelDescription !== false);
    setCheckboxValue("model3d-auto-scale-real-height", options?.askLlmForRealWorldHeightAndScale === true);
    setCheckboxValue("model3d-create-lowpoly-after-generation", options?.createLowPolyAfterGeneration === true);
    if (options?.focusStudio !== false && typeof input.openAiSection === "function") {
      input.openAiSection("model3d-studio-card", { focusOnly: true });
    } else if (options?.focusStudio !== false) {
      const modelCard = document.getElementById("model3d-studio-card");
      if (modelCard && typeof modelCard.scrollIntoView === "function") {
        modelCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    const generateModelButton = document.getElementById("generate-model3d-button");
    if (!generateModelButton) {
      input.setOutput("3D generation button is unavailable.");
      return;
    }
    setImageGenerationStatus("Starting 3D generation from " + sourceUrls.length + " selected image" + (sourceUrls.length === 1 ? "" : "s") + "...");
    generateModelButton.click();
    input.setOutput("Started 3D generation from " + sourceUrls.length + " selected image" + (sourceUrls.length === 1 ? "" : "s") + ".");
  }
  function setVideoWorkflowMode(mode) {
    const nextMode = mode === "image-text" ? "image-text" : "text";
    const videoStudioCard = document.getElementById("video-studio-card");
    if (videoStudioCard) {
      videoStudioCard.classList.toggle("video-studio-image-text-mode", nextMode === "image-text");
      videoStudioCard.classList.toggle("video-studio-text-mode", nextMode !== "image-text");
    }
    document.querySelectorAll("[data-video-workflow-mode]").forEach(button => {
      const active = String(button.getAttribute("data-video-workflow-mode") || "") === nextMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.getElementById("videogen-image-source-field")?.classList.toggle("hidden", nextMode !== "image-text");
  }
  async function createFileFromImageUrl(imageUrl, fileName) {
    const sourceUrl = input.buildAbsoluteDashboardUrl(imageUrl);
    const response = await fetch(sourceUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load preview image (" + response.status + ").");
    }
    const blob = await response.blob();
    const nextFileName = String(fileName || "video-start.png").trim() || "video-start.png";
    return new File([blob], nextFileName, { type: blob.type || "image/png" });
  }
  async function setVideoSourceImageFromPreview(target) {
    const inputNode = document.getElementById("videogen-source-image-input");
    if (!inputNode) {
      throw new Error("Video Studio start image input is unavailable.");
    }
    const transfer = new DataTransfer();
    transfer.items.add(await createFileFromImageUrl(target.imageUrl, target.fileName));
    inputNode.files = transfer.files;
    inputNode.dispatchEvent(new Event("input", { bubbles: true }));
    inputNode.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function syncImageQuickActionModeUi() {
    imageQuickActionModalPresentation.syncModeUi();
  }
  function setImageQuickActionRunState(running) {
    imageQuickActionModalPresentation.setRunState(running);
  }
  function getImageLayeredWorkflowPreflightFailure() {
    return imageLayeredWorkflowPreflight.getFailure();
  }
  function openImageQuickActionModal(actionKey) {
    imageQuickActionModalPresentation.open(actionKey);
  }
  function closeImageQuickActionModal() {
    imageQuickActionModalPresentation.close();
  }
  function readImageQuickActionVideoOptions() {
    return imageQuickActionModalExecution.readVideoOptions();
  }
  function readImageQuickActionLayeredOptions() {
    return imageQuickActionModalExecution.readLayeredOptions();
  }
  function readImageQuickActionModelOptions() {
    return imageQuickActionModalExecution.readModelOptions();
  }
  function runImageQuickActionModal() {
    return imageQuickActionModalExecution.execute();
  }
  function applyVideoPreviewQuickActionOptions(options) {
    if (!options) {
      return;
    }
    [
      ["videogen-frames", options.frames],
      ["videogen-fps", options.fps],
      ["videogen-steps", options.steps],
      ["videogen-width", options.width],
      ["videogen-height", options.height],
      ["video-editor-seed", options.seed]
    ].forEach(entry => {
      if (entry[1] !== undefined && entry[1] !== null && String(entry[1]).trim()) {
        setInputValue(entry[0], entry[1]);
      }
    });
  }
  async function triggerVideoFromSelectedPreview(options) {
    const target = getActiveImageQuickActionTarget();
    if (!target || !target.imageUrl) {
      input.setOutput("Select a generated image or uploaded edit source first.");
      return;
    }
    setVideoWorkflowMode("image-text");
    await setVideoSourceImageFromPreview(target);
    const promptNode = document.getElementById("videogen-prompt");
    const prompt = String(options?.prompt !== undefined ? options.prompt : target.prompt || "").trim();
    if (promptNode && typeof promptNode.value === "string" && (options?.replacePrompt === true || !String(promptNode.value || "").trim()) && prompt) {
      promptNode.value = prompt;
      promptNode.dispatchEvent(new Event("input", { bubbles: true }));
    }
    applyVideoPreviewQuickActionOptions(options);
    if (options?.focusStudio !== false && typeof input.openAiSection === "function") {
      input.openAiSection("video-studio-card", { focusOnly: true });
    } else if (options?.focusStudio !== false) {
      const videoCard = document.getElementById("video-studio-card");
      if (videoCard && typeof videoCard.scrollIntoView === "function") {
        videoCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    if (options?.generate === true) {
      const generateButton = document.getElementById("generate-video-button");
      if (!generateButton) {
        input.setOutput("Video generation button is unavailable.");
        return;
      }
      setVideoGenerationStatus("Starting image + text video generation...");
      generateButton.click();
      input.setOutput("Started video generation from " + target.fileName + ".");
      return;
    }
    setVideoGenerationStatus("Start image loaded. Describe the motion you want, then generate the video.");
    input.setOutput("Loaded " + target.fileName + " into Video Studio. Add a video prompt before generating.");
  }
  async function triggerRotate360ClipFromSelectedPreview(options) {
    const target = getActiveImageQuickActionTarget();
    if (!target || !target.imageUrl) {
      input.setOutput("Select a generated image or uploaded edit source first.");
      return;
    }
    setVideoWorkflowMode("image-text");
    await setVideoSourceImageFromPreview(target);
    const promptNode = document.getElementById("videogen-prompt");
    const prompt = String(options?.prompt || "The subject performs a fast in-place 360 degree rotation, physically turning around its vertical axis, consistent proportions, stable anatomy, rigid object motion, no deformation, clean turntable spin, even lighting, fixed camera.").trim();
    if (promptNode && typeof promptNode.value === "string") {
      promptNode.value = prompt;
      promptNode.dispatchEvent(new Event("input", { bubbles: true }));
    }
    applyVideoPreviewQuickActionOptions({
      frames: options?.frames || "13",
      fps: options?.fps || "8",
      steps: options?.steps || "25",
      width: options?.width,
      height: options?.height,
      seed: options?.seed
    });
    if (options?.focusStudio !== false && typeof input.openAiSection === "function") {
      input.openAiSection("video-studio-card", { focusOnly: true });
    }
    const generateButton = document.getElementById("generate-video-button");
    if (!generateButton) {
      input.setOutput("Video generation button is unavailable.");
      return;
    }
    setVideoGenerationStatus("Starting 360 image + text video generation...");
    generateButton.click();
    input.setOutput("Started 360 clip generation from " + target.fileName + ".");
  }
  async function runImageDelightToolQuickAction() {
    const target = getActiveImageQuickActionTarget();
    if (!target || !target.imageUrl) {
      throw new Error("Select a generated image or uploaded edit source first.");
    }
    if (typeof sendImageUrlToToolBySourceToken !== "function") {
      throw new Error("Tool bridge is unavailable for Toon Image Shader.");
    }
    await sendImageUrlToToolBySourceToken("/tools/art/toon-image-shader/", {
      imageFileName: target.fileName,
      fileName: target.fileName,
      imageUrl: target.imageUrl,
      prompt: target.prompt
    }, {
      switchView: true
    });
    setImageGenerationStatus("Opened Toon Image Shader with the selected image.");
    input.setOutput("Opened Toon Image Shader with " + target.fileName + ".");
  }
  function getImageQuickActionPrompt(actionKey, selected, options) {
    const sourcePrompt = String(selected && selected.prompt ? selected.prompt : "").trim();
    if (actionKey === "remove-background") {
      return "Remove the background from this image. Keep the main subject clean, centered, and sharply cut out on a transparent or plain neutral background. Preserve the subject shape and details." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
    }
    if (actionKey === "delight") {
      return "Delight this image for texture use: remove baked shadows, strong directional lighting, highlights, and color casts while preserving the original surface color and details. Make it evenly lit and neutral." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
    }
    if (actionKey === "upscale") {
      return "Upscale this image." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
    }
    if (actionKey === "layered") {
      return String(options?.prompt || "").trim();
    }
    if (actionKey === "normal-map") {
      return "Create a tangent-space normal map from this image. Output only a clean crystal-blue normal map texture with readable surface relief and no labels or extra objects." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
    }
    return sourcePrompt || "Create an improved version of this image.";
  }
  async function runImagePreviewQuickAction(actionKey, options) {
    const targets = actionKey === "layered" ? [getActiveImageQuickActionTarget()].filter(Boolean) : getImageQuickActionTargets();
    if (targets.length === 0) {
      return void input.setOutput("Select a generated image or uploaded edit source first.");
    }
    if (actionKey === "layered") {
      const failure = await getImageLayeredWorkflowPreflightFailure();
      if (failure) throw new Error(failure);
    }
    const variantKey = getImageVariantActionKey(actionKey, options);
    const actionLabel = actionKey === "remove-background"
      ? "Removing background"
      : actionKey === "delight"
        ? "Delighting image"
        : actionKey === "upscale"
          ? "Upscaling image"
          : actionKey === "layered"
            ? "Separating layers"
            : "Creating normal map";
    setImagePreviewLoading(true);
    const savedEntries = [];
    let lastPayload = null;
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        const imageUrl = target.imageUrl;
        const sourceRecord = resolveImageVariantSourceRecord(target.record || getSelectedGeneratedImage());
        const sourceId = String(sourceRecord?.id || target.record?.id || imageVariantHelpers.state.sourceId || "").trim();
        setImageGenerationStatus(actionLabel + (targets.length > 1 ? " " + (index + 1) + "/" + targets.length : "") + "...");
        const prompt = getImageQuickActionPrompt(actionKey, target.record || { prompt: target.prompt }, options);
        const workflowPathOverride = actionKey === "delight"
          ? (imageDelightWorkflowPath || undefined)
          : actionKey === "layered"
            ? (getConfiguredImageLayeredWorkflowPath() || undefined)
            : actionKey === "upscale"
              ? (getConfiguredImageUpscaleWorkflowPath() || imageUpscaleWorkflowPath || undefined)
              : undefined;
        lastPayload = actionKey === "remove-background"
          ? await input.request("/api/image-remove-background", {
            imageInput: imageUrl,
            imageFileNameHint: target.fileName,
            mode: options && options.mode ? options.mode : "source"
          })
          : await input.request("/api/image-generate", {
            prompt,
            autoPrompt: false,
            autoFileName: false,
            imageInput: imageUrl,
            imageFileNameHint: target.fileName,
            workflowPathOverride,
            preserveEmptyPrompt: actionKey === "layered",
            skipPromptResolution: actionKey === "delight" || actionKey === "layered",
            workflowInputOverrides: actionKey === "layered" && options?.layers ? { layers: options.layers } : undefined,
            steps: actionKey === "layered" ? options?.steps : undefined,
            cfg: actionKey === "layered" ? options?.cfg : undefined,
            seed: actionKey === "layered" ? options?.seed : undefined,
            width: actionKey === "layered" ? undefined : target.width,
            height: actionKey === "layered" ? undefined : target.height
          });
        const generatedEntries = getGeneratedImageBatchEntries(lastPayload);
        savedEntries.push(...generatedEntries);
        if (generatedEntries[0]?.id) {
          rememberImageVariantResult(sourceId, variantKey, generatedEntries[0]);
        }
      }
    } finally {
      setImagePreviewLoading(false);
    }
    if (savedEntries[0]?.id) {
      await loadImageHistory(savedEntries[savedEntries.length - 1].id);
    }
    const savedCount = savedEntries.length || (lastPayload?.id ? 1 : 0);
    setImageGenerationStatus(actionLabel + " complete" + (savedCount > 1 ? ": " + savedCount + " images saved." : "."));
    input.setOutput(actionLabel + " complete" + (targets.length > 1 ? " for " + targets.length + " images." : "."));
    await input.refreshState();
    return lastPayload;
  }
  async function runImageNormalMapToolQuickAction() {
    const targets = getImageQuickActionTargets();
    if (targets.length === 0) {
      return void input.setOutput("Select a generated image or uploaded edit source first.");
    }
    if (typeof input.convertImageUrlToNormalMap !== "function") {
      return void input.setOutput("Normal Map Maker bridge is unavailable.");
    }
    setImageGenerationStatus("Creating normal map" + (targets.length > 1 ? "s for " + targets.length + " images" : " from " + targets[0].fileName) + "...");
    setImagePreviewLoading(true);
    const convertedItems = [];
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        const sourceRecord = resolveImageVariantSourceRecord(target.record || getSelectedGeneratedImage());
        const sourceId = String(sourceRecord?.id || target.record?.id || imageVariantHelpers.state.sourceId || "").trim();
        setImageGenerationStatus("Creating normal map " + (index + 1) + "/" + targets.length + " from " + target.fileName + "...");
        const converted = await input.convertImageUrlToNormalMap({
          imageUrl: target.imageUrl,
          fileName: target.fileName,
          prompt: target.prompt,
          sourceImageId: sourceId,
          sourceImageFileName: sourceRecord?.imageFileName || target.record?.imageFileName || target.fileName,
          switchView: false
        });
        mergeGeneratedImageRecords(converted);
        convertedItems.push({ converted, sourceUrl: target.imageUrl, sourceId });
        rememberImageVariantResult(sourceId, "normal-map", converted);
      }
    } finally {
      setImagePreviewLoading(false);
    }
    const latest = convertedItems[convertedItems.length - 1];
    const convertedUrl = input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(latest.converted.id, latest.converted.imageFileName));
    showImagePreviewRevealComparison(latest.sourceUrl, convertedUrl, { value: 50 });
    input.state.selectedGeneratedImageId = latest.converted.id;
    input.state.selectedGeneratedImageIds = convertedItems.map(item => item.converted.id);
    await loadImageHistory(latest.converted.id);
    mergeGeneratedImageRecords(convertedItems.map(item => item.converted));
    mediaMultiSelectionHelpers.setSelectedIds("selectedGeneratedImageIds", "selectedGeneratedImageId", convertedItems.map(item => item.converted.id), latest.converted.id);
    renderGeneratedImageHistory();
    scrollSelectedGeneratedImageIntoView(latest.converted.id);
    await input.refreshState();
    setImageGenerationStatus("Normal map conversion complete: " + convertedItems.length + " image" + (convertedItems.length === 1 ? "" : "s") + ".");
    input.setOutput("Converted " + convertedItems.length + " image" + (convertedItems.length === 1 ? "" : "s") + " to normal maps.");
    return latest.converted;
  }
  async function runImagePixelArtQuickAction(selectedOverride) {
    const selected = selectedOverride || getSelectedGeneratedImage();
    const target = selectedOverride
      ? {
        kind: "generated",
        imageUrl: input.buildAbsoluteDashboardUrl(input.getGeneratedImageFileUrl(selectedOverride.id, selectedOverride.imageFileName)),
        fileName: selectedOverride.imageFileName,
        prompt: String(selectedOverride.prompt || "").trim(),
        width: selectedOverride.width || undefined,
        height: selectedOverride.height || undefined,
        label: selectedOverride.imageFileName,
        record: selectedOverride
      }
      : getActiveImageQuickActionTarget();
    const targets = selectedOverride ? [target] : getImageQuickActionTargets();
    if (targets.length === 0) {
      return void input.setOutput("Select a generated image or uploaded edit source first.");
    }
    if (typeof input.convertImageUrlToPixelArt !== "function") {
      return void input.setOutput("Pixel Art conversion bridge is unavailable.");
    }
    setImageGenerationStatus("Converting " + targets.length + " image" + (targets.length === 1 ? "" : "s") + " to pixel art...");
    setImagePreviewLoading(true);
    const convertedItems = [];
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        const sourceRecord = resolveImageVariantSourceRecord(target.record || selected || getSelectedGeneratedImage());
        const sourceId = String(sourceRecord?.id || target.record?.id || imageVariantHelpers.state.sourceId || "").trim();
        setImageGenerationStatus("Converting " + (index + 1) + "/" + targets.length + " to pixel art: " + target.fileName + "...");
        const converted = await input.convertImageUrlToPixelArt({
          imageUrl: target.imageUrl,
          fileName: target.fileName,
          prompt: target.prompt,
          sourceImageId: sourceId,
          sourceImageFileName: sourceRecord?.imageFileName || target.record?.imageFileName || target.fileName,
          switchView: false
        });
        mergeGeneratedImageRecords(converted);
        convertedItems.push(converted);
        rememberImageVariantResult(sourceId, "pixel-art", converted);
      }
    } finally {
      setImagePreviewLoading(false);
    }
    hideImagePreviewReveal();
    input.state.selectedGeneratedImageId = convertedItems[convertedItems.length - 1].id;
    input.state.selectedGeneratedImageIds = convertedItems.map(item => item.id);
    await loadImageHistory(convertedItems[convertedItems.length - 1].id);
    mergeGeneratedImageRecords(convertedItems);
    mediaMultiSelectionHelpers.setSelectedIds("selectedGeneratedImageIds", "selectedGeneratedImageId", convertedItems.map(item => item.id), convertedItems[convertedItems.length - 1].id);
    renderGeneratedImageHistory();
    scrollSelectedGeneratedImageIntoView(convertedItems[convertedItems.length - 1].id);
    await input.refreshState();
    setImageGenerationStatus("Pixel art conversion complete: " + convertedItems.length + " image" + (convertedItems.length === 1 ? "" : "s") + ".");
    input.setOutput("Converted " + convertedItems.length + " image" + (convertedItems.length === 1 ? "" : "s") + " to pixel art.");
    return convertedItems[convertedItems.length - 1];
  }

  function renderGeneratedImageMeta(record) {
    const preview = document.getElementById("imagegen-preview");
    if (!preview) {
      return;
    }
    if (input.state.aiFocusedSectionId !== "image-studio-card") {
      unloadImageStudioPreview();
      return;
    }
    if (!record) {
      syncImageStudioPreviewTarget(null);
      return;
    }
    syncImageStudioPreviewTarget(record);
  }

  function bindStudioBottomWheelScroll() {
    if (studioBottomWheelScrollBound) {
      return;
    }
    studioBottomWheelScrollBound = true;
    const selector = "#image-bottom-filmstrip, #video-bottom-filmstrip, #audio-bottom-filmstrip, #music-bottom-filmstrip, #model3d-history-list, .model3d-recent-scroll";
    document.addEventListener("wheel", event => {
      const target = event.target instanceof Element ? event.target.closest(selector) : null;
      if (!target) {
        return;
      }
      const maxScrollLeft = target.scrollWidth - target.clientWidth;
      if (maxScrollLeft <= 1 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }
      event.preventDefault();
      target.scrollLeft = Math.max(0, Math.min(maxScrollLeft, target.scrollLeft + event.deltaY));
    }, { passive: false });
  }

  async function renameGeneratedImageHistoryEntry(entry) {
    setImageGenerationStatus("Regenerating filename for " + entry.imageFileName + "...");
    try {
      const renamed = await input.request("/api/image-regenerate-filename", {imageId: entry.id});
      await loadImageHistory(renamed.id || entry.id);
      setImageGenerationStatus("Renamed to " + renamed.imageFileName + ".");
      input.setOutput("Regenerated image filename: " + renamed.imageFileName + ".");
    } catch (error) {
      const detail = error?.message || "Unknown error";
      setImageGenerationStatus("Failed to regenerate filename.");
      input.setOutput("Failed to regenerate image filename: " + detail);
    }
  }

  async function convertGeneratedImageHistoryEntryToPixelArt(entry) {
    try {
      await runImagePixelArtQuickAction(entry);
    } catch (error) {
      const detail = error?.message || "Unknown error";
      setImageGenerationStatus("Pixel art conversion failed.");
      input.setOutput("Pixel art conversion failed: " + detail);
    }
  }

  function renderGeneratedImageHistory() {
    return imageHistoryViewHelpers.render();
  }
  function renderGeneratedVideoMeta(record) {
    const panel = document.getElementById("videogen-meta-output");
    const preview = document.getElementById("videogen-preview");
    if (!panel || !preview) {
      return;
    }
    const renderEmpty = () => {
      input.clearChildren(panel);
      const title = document.createElement("strong");
      title.textContent = "Video Info";
      const empty = document.createElement("span");
      empty.textContent = "No video selected.";
      panel.append(title, empty);
    };
    const appendInfo = (label, value) => {
      const row = document.createElement("span");
      const text = document.createTextNode(label + " ");
      const detail = document.createElement("b");
      detail.textContent = String(value || "unknown");
      row.append(text, detail);
      panel.appendChild(row);
    };
    if (input.state.aiFocusedSectionId !== "video-studio-card") {
      renderEmpty();
      unloadVideoStudioPreview();
      return;
    }
    if (!record) {
      renderEmpty();
      preview.pause();
      activeVideoPreviewUrl = "";
      preview.removeAttribute("src");
      preview.load();
      return;
    }
    input.clearChildren(panel);
    const title = document.createElement("strong");
    title.textContent = "Video Info";
    panel.appendChild(title);
    appendInfo("Video ID", record.id);
    appendInfo("Generated", input.formatDateTime(record.createdAt));
    appendInfo("Generation duration", formatGenerationDuration(record.generationDurationSeconds || record.generationDurationMs));
    appendInfo("Length", record.seconds ? (record.seconds + "s") : "unknown");
    appendInfo("Seed", record.seed);
    appendInfo("Steps", record.steps || "unknown");
    appendInfo("Prompt", record.prompt || "(none)");
    appendInfo("Model", record.model || "unknown");
    appendInfo("File", record.videoFileName);
    const nextUrl = input.getGeneratedVideoFileUrl(record.id, record.videoFileName);
    preview.addEventListener("loadedmetadata", () => {
      if (preview.videoWidth > 0 && preview.videoHeight > 0) {
        preview.style.setProperty("--video-preview-aspect", preview.videoWidth + " / " + preview.videoHeight);
      }
    }, { once: true });
    if (activeVideoPreviewUrl !== nextUrl) {
      preview.pause();
      preview.src = nextUrl;
      preview.load();
      activeVideoPreviewUrl = nextUrl;
    }
  }
  function unloadImageStudioPreview() {
    const preview = document.getElementById("imagegen-preview");
    if (preview) {
      preview.removeAttribute("src");
      preview.classList.remove("is-loading");
    }
    setImagePreviewMedia(null);
    writeImageStudioToolTarget(null);
    hideImagePreviewReveal();
    renderImagePreviewContext(null);
    renderImagePreviewMetaForTarget(null, null);
    updateImagePreviewQuickActions(null);
  }
  function unloadVideoStudioPreview() {
    const preview = document.getElementById("videogen-preview");
    if (!preview) return;
    preview.pause();
    activeVideoPreviewUrl = "";
    preview.removeAttribute("src");
    preview.load();
  }
  function bindVideoPreviewScrubber() {
    globalThis.createDashboardImagePreviewMediaControls?.().bindVideoScrubber();
  }
  function bindImagePreviewMediaControls() {
    globalThis.createDashboardImagePreviewMediaControls?.({
      getNodes: getImagePreviewMediaNodes,
      mediaState: imagePreviewMediaState,
      drawGifFrame: drawImagePreviewGifFrame,
      showPausedGifFrame: showPausedImagePreviewGifFrame,
      stopGifPlayback: stopImagePreviewGifPlayback,
      resumeGifAnimation: resumeImagePreviewGifAnimation,
      openFocusViewer: openImagePreviewFocusViewer
    }).bind();
  }
  function closeImageGifExportModal() {
    const modal = document.getElementById("image-gif-export-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
    document.body.classList.remove("image-quick-action-modal-open");
  }
  function openImageGifExportModal() {
    const modal = document.getElementById("image-gif-export-modal");
    const summary = document.getElementById("image-gif-export-summary");
    if (!modal) return;
    const fileName = getImagePreviewDownloadName("gif");
    if (summary) {
      summary.textContent = "Download " + fileName + " as the animated GIF, or export only the current preview frame as a PNG.";
    }
    modal.classList.remove("hidden");
    document.body.classList.add("image-quick-action-modal-open");
    window.setTimeout(() => document.getElementById("image-gif-export-original-button")?.focus?.(), 0);
  }
  function downloadImagePreviewOriginal() {
    const url = String(imagePreviewMediaState.url || "").trim();
    if (!url) {
      input.setOutput("No preview media is ready to download.");
      return;
    }
    const extension = imagePreviewMediaState.kind === "video" ? getImagePreviewUrlExtension("mp4") : imagePreviewMediaState.kind === "gif" ? "gif" : getImagePreviewUrlExtension("png");
    downloadImagePreviewUrl(url, getImagePreviewDownloadName(extension));
  }
  function handleImagePreviewDownload() {
    if (imagePreviewMediaState.kind === "gif") {
      openImageGifExportModal();
      return;
    }
    if (imagePreviewMediaState.kind === "video") {
      downloadImagePreviewOriginal();
      return;
    }
    downloadCurrentImagePreviewPng();
  }
  function getImageLatestVideoEntries() {
    return (Array.isArray(input.state.generatedVideos) ? input.state.generatedVideos : []).slice(0, 12).map(entry => ({
      id: entry.id,
      fileName: entry.videoFileName,
      url: input.getGeneratedVideoFileUrl(entry.id, entry.videoFileName),
      createdAt: entry.createdAt,
      source: "Generated video",
      fps: entry.fps,
      videoId: entry.id,
      mediaType: "video"
    })).filter(entry => entry.url);
  }
  function getImagePreviewFocusCurrentEntry() {
    const url = String(imagePreviewMediaState.url || "").trim();
    if (!url) return null;
    const type = imagePreviewMediaState.kind === "video" ? "video" : "image";
    return {
      id: "current:" + url,
      fileName: getImageFileNameFromUrl(url, type === "video" ? "current-video.mp4" : "current-image.png"),
      url,
      source: "Current preview",
      mediaType: type
    };
  }
  function getImagePreviewFocusEntries() {
    const entries = [];
    const current = getImagePreviewFocusCurrentEntry();
    if (current) entries.push(current);
    // GIF history belongs to the shared latest-media view. Keep the focus
    // viewer dependent on that public API instead of reaching for a helper
    // that only exists inside the latest-media module's closure.
    latestMediaViewHelpers.getLatestGifEntries().forEach(entry => entries.push({
      ...entry,
      url: input.buildAbsoluteDashboardUrl(entry.url),
      mediaType: "image"
    }));
    getImageLatestVideoEntries().forEach(entry => entries.push({
      ...entry,
      url: input.buildAbsoluteDashboardUrl(entry.url),
      mediaType: "video"
    }));
    const seen = new Set();
    return entries.filter(entry => {
      const key = String(entry.url || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function ensureImagePreviewFocusViewer() {
    let viewer = document.getElementById("image-preview-focus-viewer");
    if (viewer) return viewer;
    viewer = document.createElement("div");
    viewer.id = "image-preview-focus-viewer";
    viewer.className = "image-preview-focus-viewer hidden";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Focused image preview");
    viewer.tabIndex = -1;
    viewer.innerHTML = [
      '<div class="image-preview-focus-backdrop" data-image-preview-focus-close="true"></div>',
      '<div class="image-preview-focus-shell">',
      '<div class="image-preview-focus-toolbar">',
      '<div class="image-preview-focus-title"><strong id="image-preview-focus-title">Preview</strong><span id="image-preview-focus-detail"></span></div>',
      '<div class="image-preview-focus-actions">',
      '<button class="secondary mini-button" id="image-preview-focus-prev" type="button">Prev</button>',
      '<button class="secondary mini-button" id="image-preview-focus-next" type="button">Next</button>',
      '<button class="secondary mini-button" id="image-preview-focus-close" type="button">Close</button>',
      '</div>',
      '</div>',
      '<div class="image-preview-focus-stage" id="image-preview-focus-stage"></div>',
      '</div>'
    ].join("");
    document.body.appendChild(viewer);
    viewer.querySelector("#image-preview-focus-close")?.addEventListener("click", closeImagePreviewFocusViewer);
    viewer.querySelector("[data-image-preview-focus-close]")?.addEventListener("click", closeImagePreviewFocusViewer);
    viewer.querySelector("#image-preview-focus-prev")?.addEventListener("click", () => showImagePreviewFocusItem(imagePreviewFocusState.index - 1));
    viewer.querySelector("#image-preview-focus-next")?.addEventListener("click", () => showImagePreviewFocusItem(imagePreviewFocusState.index + 1));
    viewer.addEventListener("keydown", event => {
      if (event.key === "Escape") closeImagePreviewFocusViewer();
      if (event.key === "ArrowLeft") showImagePreviewFocusItem(imagePreviewFocusState.index - 1);
      if (event.key === "ArrowRight") showImagePreviewFocusItem(imagePreviewFocusState.index + 1);
    });
    return viewer;
  }
  function showImagePreviewFocusItem(index) {
    const viewer = ensureImagePreviewFocusViewer();
    const stage = viewer.querySelector("#image-preview-focus-stage");
    const title = viewer.querySelector("#image-preview-focus-title");
    const detail = viewer.querySelector("#image-preview-focus-detail");
    const items = imagePreviewFocusState.items;
    if (!stage || items.length === 0) return;
    const nextIndex = ((index % items.length) + items.length) % items.length;
    const item = items[nextIndex];
    imagePreviewFocusState.index = nextIndex;
    input.clearChildren(stage);
    if (item.mediaType === "video") {
      const video = document.createElement("video");
      video.src = item.url;
      video.controls = true;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      stage.appendChild(video);
      void video.play().catch(() => {});
    } else {
      const image = document.createElement("img");
      image.src = item.url;
      image.alt = item.fileName || "Focused preview";
      image.decoding = "async";
      stage.appendChild(image);
    }
    if (title) title.textContent = item.fileName || "Preview";
    if (detail) detail.textContent = (item.source || "Media") + " " + (items.length > 1 ? (nextIndex + 1) + " / " + items.length : "");
  }
  function openImagePreviewFocusViewer(preferredUrl) {
    const items = getImagePreviewFocusEntries();
    if (items.length === 0) {
      input.setOutput("No Image Studio preview media is available yet.");
      return;
    }
    const normalizedPreferred = String(preferredUrl || imagePreviewMediaState.url || "").trim();
    const index = Math.max(0, items.findIndex(item => item.url === normalizedPreferred || input.buildAbsoluteDashboardUrl(item.url) === normalizedPreferred));
    imagePreviewFocusState.items = items;
    const viewer = ensureImagePreviewFocusViewer();
    viewer.classList.remove("hidden");
    document.body.classList.add("image-preview-focus-open");
    showImagePreviewFocusItem(index);
    viewer.focus();
  }
  function closeImagePreviewFocusViewer() {
    const viewer = document.getElementById("image-preview-focus-viewer");
    if (!viewer) return;
    const stage = viewer.querySelector("#image-preview-focus-stage");
    if (stage) input.clearChildren(stage);
    viewer.classList.add("hidden");
    document.body.classList.remove("image-preview-focus-open");
  }
  function unloadMediaStudioPreviewForFocus(focusedId) {
    const activeId = String(focusedId || "").trim();
    if (activeId === "image-studio-card") {
      syncImageStudioPreviewTarget();
    } else {
      unloadImageStudioPreview();
    }
    if (activeId === "video-studio-card") {
      renderGeneratedVideoMeta(getSelectedGeneratedVideo());
    } else {
      unloadVideoStudioPreview();
    }
  }
  function syncGeneratedVideoHistorySelection() {
    document.querySelectorAll("#videogen-history-list .channel-row").forEach(row => {
      row.classList.toggle("active", mediaMultiSelectionHelpers.isSelected("selectedGeneratedVideoIds", input.state.selectedGeneratedVideoId, row.getAttribute("data-video-id")));
    });
    document.querySelectorAll("#video-bottom-filmstrip article[data-video-id]").forEach(card => {
      card.classList.toggle("selected", mediaMultiSelectionHelpers.isSelected("selectedGeneratedVideoIds", input.state.selectedGeneratedVideoId, card.getAttribute("data-video-id")));
    });
  }
  function updateVideoPreviewActionButtons() {
    const selected = getSelectedGeneratedVideo();
    const hasVideo = Boolean(selected && selected.id);
    document.querySelectorAll("[data-video-preview-action]").forEach(button => {
      button.disabled = !hasVideo;
      button.title = hasVideo ? "Use selected video: " + selected.videoFileName : "Select a generated video first.";
    });
  }
  function setVideoPromptFromSelected(prefix) {
    const selected = getSelectedGeneratedVideo();
    if (!selected) {
      input.setOutput("Select a generated video first.");
      return null;
    }
    const promptNode = document.getElementById("videogen-prompt");
    const sourcePrompt = String(selected.prompt || "").trim();
    const nextPrompt = [prefix, sourcePrompt].filter(Boolean).join("\n\nSource prompt:\n");
    if (promptNode && typeof promptNode.value === "string") {
      promptNode.value = nextPrompt;
      promptNode.dispatchEvent(new Event("input", { bubbles: true }));
      promptNode.focus?.();
    }
    return selected;
  }
  function runVideoPreviewAction(actionKey) {
    const selected = getSelectedGeneratedVideo();
    if (!selected) {
      input.setOutput("Select a generated video first.");
      return;
    }
    if (actionKey === "upscale") {
      const preview = document.getElementById("videogen-preview");
      const aspect = preview && preview.videoWidth > 0 && preview.videoHeight > 0 ? preview.videoWidth / preview.videoHeight : 16 / 9;
      const height = 2160;
      const width = Math.max(64, Math.min(4096, Math.round((height * aspect) / 8) * 8));
      setInputValue("videogen-width", width);
      setInputValue("videogen-height", height);
      setInputValue("videogen-steps", "35");
      setVideoPromptFromSelected("Create a cleaner higher-resolution version of this video with stable details, smooth motion, consistent lighting, and no flicker.");
      setVideoGenerationStatus("Prepared upscale settings for " + selected.videoFileName + ".");
      input.setOutput("Upscale settings prepared. Review the prompt/settings, then generate.");
      return;
    }
    if (actionKey === "extend") {
      const fps = Number.parseInt(document.getElementById("videogen-fps")?.value || String(selected.fps || "30"), 10) || 30;
      const currentSeconds = Number.parseInt(String(selected.seconds || selected.durationSeconds || "5"), 10) || 5;
      setInputValue("videogen-frames", Math.max(1, Math.min(512, (currentSeconds + 5) * fps)));
      setInputValue("videogen-fps", fps);
      setVideoPromptFromSelected("Continue and extend this clip naturally, preserving the same subject, camera direction, lighting, style, and motion continuity.");
      setVideoGenerationStatus("Prepared extension settings for " + selected.videoFileName + ".");
      input.setOutput("Extension settings prepared. Review the prompt/settings, then generate.");
      return;
    }
    if (actionKey === "edit") {
      setVideoPromptFromSelected("Edit this video while preserving the subject identity, style, and temporal coherence. Apply the requested change cleanly:");
      setVideoGenerationStatus("Loaded selected video prompt for editing.");
      input.setOutput("Edit prompt prepared. Add the exact change you want, then generate.");
      return;
    }
    if (actionKey === "delight") {
      setVideoPromptFromSelected("Delight this video by running the ComfyUI 'Delight' model on it, which can enhance details, reduce noise, and improve overall quality while maintaining the original style and motion.");
      setVideoGenerationStatus("Prepared delight settings for " + selected.videoFileName + ".");
      input.setOutput("delight prompt prepared. Review it, then generate.")
    }
    if (actionKey === "remove-bg") {
      setVideoPromptFromSelected("Remove or replace the background with a clean neutral backdrop while preserving the subject, edges, motion, and lighting consistency.");
      setVideoGenerationStatus("Prepared remove-background video prompt.");
      input.setOutput("Remove-background prompt prepared. Review it, then generate.");
      return;
    }
    if (actionKey === "reframe") {
      setInputValue("videogen-width", "1080");
      setInputValue("videogen-height", "1920");
      setVideoPromptFromSelected("Reframe this clip for a vertical composition, keeping the main subject centered and fully visible with smooth camera framing.");
      setVideoGenerationStatus("Prepared vertical reframe settings for " + selected.videoFileName + ".");
      input.setOutput("Reframe settings prepared. Review the prompt/settings, then generate.");
      return;
    }
    if (actionKey === "add-audio") {
      if (typeof input.openAiSection === "function") {
        input.openAiSection("audio-studio-card", { focusOnly: true });
      }
      input.setOutput("Opened Audio Studio. Use the selected video as the timing/reference for audio generation.");
    }
  }
  function refreshVideoToolQuickActionState() {
    if (typeof input.updateVideoToolQuickActionState === "function") {
      input.updateVideoToolQuickActionState();
    }
  }

  function renderGeneratedVideoHistory() {
    return videoHistoryViewHelpers.render();
  }

  function showLatestGifInImagePreview(entry) {
    const output = document.getElementById("imagegen-meta-output");
    if (!entry || !entry.url) return;
    input.state.selectedGeneratedImageId = "";
    hideImagePreviewReveal();
    const imageUrl = input.buildAbsoluteDashboardUrl(entry.url);
    setImagePreviewMedia({ imageUrl });
    const target = {
      kind: "gif",
      imageUrl,
      fileName: entry.fileName || "latest.gif",
      label: entry.fileName || "latest.gif"
    };
    writeImageStudioToolTarget(target);
    renderImagePreviewContext(target);
    if (output) {
      output.textContent = [
        "Preview Target: GIF",
        "Name: " + (entry.fileName || "latest.gif"),
        "Source: " + (entry.source || "Latest GIF"),
        "Generated: " + input.formatDateTime(entry.createdAt)
      ].join("\n");
    }
    updateImagePreviewQuickActions(null);
  }
  function showLatestVideoInImagePreview(entry) {
    const output = document.getElementById("imagegen-meta-output");
    if (!entry || !entry.url) return;
    input.state.selectedGeneratedImageId = "";
    hideImagePreviewReveal();
    const imageUrl = input.buildAbsoluteDashboardUrl(entry.url);
    setImagePreviewMedia({ imageUrl });
    imagePreviewMediaState.videoFps = Math.max(1, Number.parseInt(String(entry.fps || ""), 10) || 30);
    writeImageStudioToolTarget(null);
    renderImagePreviewContext({
      kind: "video",
      imageUrl,
      fileName: entry.fileName || "latest-video.mp4",
      label: entry.fileName || "latest-video.mp4"
    });
    if (output) {
      output.textContent = [
        "Preview Target: Video",
        "Name: " + (entry.fileName || "latest-video.mp4"),
        "Source: " + (entry.source || "Latest video"),
        "Generated: " + input.formatDateTime(entry.createdAt)
      ].join("\n");
    }
    updateImagePreviewQuickActions(null);
  }
  async function useLatestImageAsVideoSource(entry) {
    try {
      setVideoWorkflowMode("image-text");
      await setVideoSourceImageFromPreview({
        imageUrl: input.getGeneratedImageFileUrl(entry.id, entry.imageFileName),
        fileName: entry.imageFileName
      });
      setVideoGenerationStatus("Start image loaded from latest images.");
      input.setOutput("Loaded " + entry.imageFileName + " as the Video Studio start image.");
    } catch (error) {
      input.setOutput("Failed to load image into Video Studio: " + (error?.message || "Unknown error"));
    }
  }
  function renderLatestMediaSections() {
    return latestMediaViewHelpers.render();
  }
  async function loadMediaConverterGifHistory() {
    input.state.mediaConverterGifs = await input.request("/api/media-converter-gifs?limit=24");
    input.state.mediaConverterGifHistoryLoaded = true;
    renderLatestMediaSections();
  }
  async function ensureMediaConverterGifHistoryLoaded() {
    if (input.state.mediaConverterGifHistoryLoaded === true) {
      return;
    }
    await loadMediaConverterGifHistory();
  }
  function bindMediaConverterGifHistoryEvents() {
    if (bindMediaConverterGifHistoryEvents.bound === true) {
      return;
    }
    bindMediaConverterGifHistoryEvents.bound = true;
    window.addEventListener("dashboard:media-converter-gifs-updated", () => {
      void loadMediaConverterGifHistory().catch(() => {});
    });
  }

  async function loadImageHistory(preferredImageId) {
    const [images] = await Promise.all([
      input.request("/api/image-history"),
      ensureMediaConverterGifHistoryLoaded().catch(() => {})
    ]);
    input.state.generatedImages = images;
    const candidateId = preferredImageId && input.state.generatedImages.some(item => item.id === preferredImageId)
      ? preferredImageId
      : input.state.selectedGeneratedImageId;
    input.state.selectedGeneratedImageId = input.state.generatedImages.some(item => item.id === candidateId)
      ? candidateId
      : (input.state.generatedImages[0] ? input.state.generatedImages[0].id : "");
    ensureGeneratedImageVisibleInLists(input.state.selectedGeneratedImageId);
    mediaMultiSelectionHelpers.pruneSelection("selectedGeneratedImageIds", "selectedGeneratedImageId", input.state.generatedImages);
    renderGeneratedImageHistory();
    scrollSelectedGeneratedImageIntoView(input.state.selectedGeneratedImageId);
  }
  async function loadVideoHistory(preferredVideoId) {
    const [videos] = await Promise.all([
      input.request("/api/video-history"),
      ensureMediaConverterGifHistoryLoaded().catch(() => {})
    ]);
    input.state.generatedVideos = videos;
    const candidateId = preferredVideoId && input.state.generatedVideos.some(item => item.id === preferredVideoId)
      ? preferredVideoId
      : input.state.selectedGeneratedVideoId;
    input.state.selectedGeneratedVideoId = input.state.generatedVideos.some(item => item.id === candidateId)
      ? candidateId
      : (input.state.generatedVideos[0] ? input.state.generatedVideos[0].id : "");
    const selectedIndex = input.state.generatedVideos.findIndex(item => item.id === input.state.selectedGeneratedVideoId);
    if (selectedIndex >= 0) {
      const requiredLimit = Math.ceil((selectedIndex + 1) / videoHistoryInitialRenderLimit) * videoHistoryInitialRenderLimit;
      input.state.videoHistoryVisibleLimit = Math.max(Number.parseInt(input.state.videoHistoryVisibleLimit || videoHistoryInitialRenderLimit, 10) || videoHistoryInitialRenderLimit, requiredLimit);
    }
    mediaMultiSelectionHelpers.pruneSelection("selectedGeneratedVideoIds", "selectedGeneratedVideoId", input.state.generatedVideos);
    renderGeneratedVideoHistory();
  }
  function updateSpeechTtsModeUi() {
    const mode = document.getElementById("speech-tts-mode")?.value || "standard";
    const standardControls = document.getElementById("speech-tts-standard-controls");
    const voiceCloneFileField = document.getElementById("speech-tts-voice-clone-file-field");
    const referenceTextField = document.getElementById("speech-tts-reference-text-field");
    const instructField = document.getElementById("speech-tts-instruct-field");
    if (standardControls) {
      standardControls.classList.toggle("hidden", mode !== "standard");
    }
    if (voiceCloneFileField) {
      voiceCloneFileField.classList.toggle("hidden", mode !== "voice-clone");
    }
    if (referenceTextField) {
      referenceTextField.classList.toggle("hidden", mode !== "voice-clone");
    }
    if (instructField) {
      instructField.classList.toggle("hidden", mode !== "custom-voice" && mode !== "design-voice");
    }
  }
  async function loadSpeechTtsVoices() {
    const select = document.getElementById("speech-tts-speaker");
    if (!select) return;
    const previousVoice = select.value;
    select.disabled = true;
    try {
      const response = await fetch("/api/speech-tts-voices");
      const payload = await response.json();
      const voices = Array.isArray(payload?.voices) ? payload.voices.filter(voice => typeof voice === "string" && voice.trim()) : [];
      if (!response.ok || !voices.length) throw new Error(payload?.error || "ComfyUI did not return any Kokoro voices.");
      input.clearChildren(select);
      for (const voice of voices) {
        const option = document.createElement("option");
        option.value = voice;
        option.textContent = voice;
        select.appendChild(option);
      }
      select.value = voices.includes(previousVoice) ? previousVoice : (voices.includes("zm_yunxi") ? "zm_yunxi" : voices[0]);
      select.disabled = false;
    } catch (error) {
      input.clearChildren(select);
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "ComfyUI voice list unavailable";
      select.appendChild(option);
      select.disabled = true;
    }
  }
  function scheduleImageHistoryRefresh(preferredImageId, previousFileName) {
    let attempts = 0;
    const maxAttempts = 12;
    const refresh = async () => {
      attempts += 1;
      try {
        await loadImageHistory(preferredImageId);
        const refreshed = input.state.generatedImages.find(item => item.id === preferredImageId) || null;
        if (refreshed && previousFileName && refreshed.imageFileName && refreshed.imageFileName !== previousFileName) {
          setImageGenerationStatus("Generated image metadata updated: " + refreshed.imageFileName + ".");
          return;
        }
      } catch {}
      if (attempts < maxAttempts) {
        setTimeout(() => {
          void refresh();
        }, 1500);
      }
    };
    setTimeout(() => {
      void refresh();
    }, 1500);
  }

  function buildGeneratedAudioFileUrl(audioId, fileName) {
    return "/api/generated-audio-file?audioId=" + encodeURIComponent(audioId) + "&file=" + encodeURIComponent(fileName);
  }

  function bindMediaInputEvents() {
    bindVideoPreviewScrubber();
    bindImagePreviewMediaControls();
    bindGeneratedDeleteHotkey();
    const byId = id => document.getElementById(id);
    const bind = (id, eventName, listener) => {
      const node = byId(id);
      if (!node) {
        return null;
      }
      node.addEventListener(eventName, listener);
      return node;
    };
    const clickInput = (buttonId, inputId) => {
      bind(buttonId, "click", () => {
        const field = byId(inputId);
        if (field && typeof field.click === "function") {
          field.click();
        }
      });
    };
    const bindDropzone = (dropzoneId, fileInputId, onDrop) => {
      bind(dropzoneId, "click", () => {
        const field = byId(fileInputId);
        if (field && typeof field.click === "function") {
          field.click();
        }
      });
      bind(dropzoneId, "dragenter", event => {
        event.preventDefault();
        const dropzone = byId(dropzoneId);
        if (dropzone) {
          dropzone.classList.add("dragging");
        }
      });
      bind(dropzoneId, "dragover", event => {
        event.preventDefault();
        const dropzone = byId(dropzoneId);
        if (dropzone) {
          dropzone.classList.add("dragging");
        }
      });
      bind(dropzoneId, "dragleave", event => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        const dropzone = byId(dropzoneId);
        if (dropzone) {
          dropzone.classList.remove("dragging");
        }
      });
      bind(dropzoneId, "drop", onDrop);
    };

    clickInput("browse-ai-images-button", "ai-image-input");
    bind("clear-ai-images-button", "click", () => {
      clearAiImages();
      input.setOutput("Cleared attached images.");
    });
    bind("ai-image-input", "change", async event => {
      mergeAiImages(await input.filesToAiImages(event.target.files));
      event.target.value = "";
      input.setOutput("Added images from file picker.");
    });
    bindDropzone("ai-dropzone", "ai-image-input", async event => {
      await input.collectDroppedImages(event, "ai-dropzone", mergeAiImages, "AI tray");
    });
    bind("ai-dropzone", "paste", async event => {
      await input.collectPastedImages(event, mergeAiImages, "AI tray");
    });
    bind("ask-prompt", "paste", async event => {
      await input.collectPastedImages(event, mergeAiImages, "AI tray");
    });

    clickInput("ask-model-upload-browse-button", "ask-model-upload-input");
    bind("ask-model-upload-clear-button", "click", () => {
      clearAskSkillModelUploads();
      input.setOutput("Cleared uploaded chat 3D model files.");
    });
    bind("ask-model-upload-input", "change", async event => {
      const result = await addAskSkillModelUploadsFromFiles(event.target.files);
      event.target.value = "";
      if (result.added > 0) {
        const skippedSuffix = result.skipped > 0 ? " Skipped " + result.skipped + " unsupported or duplicate file(s)." : "";
        input.setOutput("Added " + result.added + " chat 3D model file(s)." + skippedSuffix);
        return;
      }
      input.setOutput("No supported 3D model files were added. Supported: .glb, .gltf, .fbx, .obj, .stl, .ply, .usdz.");
    });
    clickInput("ask-file-upload-browse-button", "ask-file-upload-input");
    bind("ask-file-upload-clear-button", "click", () => {
      clearAskFileUploads();
      input.setOutput("Cleared uploaded chat reference files.");
    });
    bind("ask-file-upload-input", "change", async event => {
      const result = await addAskFileUploadsFromFiles(event.target.files);
      event.target.value = "";
      if (result.added > 0) {
        const skippedSuffix = result.skipped > 0 ? " Skipped " + result.skipped + " unsupported, duplicate, or oversized file(s)." : "";
        input.setOutput("Added " + result.added + " chat reference file(s)." + skippedSuffix);
        return;
      }
      input.setOutput("No reference files were added. Use text-like files up to 384 KB.");
    });

    clickInput("browse-moderation-images-button", "moderation-image-input");
    bind("clear-moderation-images-button", "click", () => {
      clearModerationImages();
      input.setOutput("Cleared moderation test images.");
    });
    bind("moderation-image-input", "change", async event => {
      mergeModerationImages(await input.filesToAiImages(event.target.files));
      event.target.value = "";
      input.setOutput("Added moderation test images from file picker.");
    });
    bindDropzone("moderation-dropzone", "moderation-image-input", async event => {
      await input.collectDroppedImages(event, "moderation-dropzone", mergeModerationImages, "Moderation simulator");
    });
    bind("moderation-dropzone", "paste", async event => {
      await input.collectPastedImages(event, mergeModerationImages, "Moderation simulator");
    });
    bind("moderation-test-text", "paste", async event => {
      await input.collectPastedImages(event, mergeModerationImages, "Moderation simulator");
    });

    clickInput("image-interpret-source-browse-button", "image-interpret-source-file");
    bind("image-prompt-interpret-preview", "paste", async event => {
      try {
        const loaded = await setImagePromptInterpretSourceFromClipboardEvent(event);
        if (loaded) event.preventDefault();
      } catch (error) {
        input.setOutput("Prompt source paste failed: " + ((error && error.message) || "Unknown error"));
      }
    });
    bind("image-interpret-source-paste-button", "click", async event => {
      const button = event.currentTarget;
      if (button) {
        button.disabled = true;
      }
      try {
        await readImagePromptInterpretClipboardImage();
      } catch (error) {
        input.setOutput("Clipboard prompt source failed: " + ((error && error.message) || "Unknown error"));
      } finally {
        if (button) {
          button.disabled = false;
        }
      }
    });
    document.querySelectorAll("[data-image-interpret-detail]").forEach(button => {
      button.addEventListener("click", event => {
        setImagePromptInterpretDetailMode(event.currentTarget?.getAttribute("data-image-interpret-detail"));
      });
    });
    bind("image-interpret-source-webcam-button", "click", async event => {
      const button = event.currentTarget;
      if (button) {
        button.disabled = true;
      }
      try {
        await captureImagePromptInterpretSourceFromWebcam();
      } catch (error) {
        input.setOutput("Webcam prompt source failed: " + ((error && error.message) || "Unknown error"));
      } finally {
        if (button) {
          button.disabled = false;
        }
      }
    });
    bind("image-interpret-source-clear-button", "click", () => {
      clearImagePromptInterpretSource();
      input.setOutput("Cleared Image Studio prompt source image.");
    });
    bind("image-interpret-source-aspect-button", "click", async event => {
      const button = event.currentTarget;
      if (button) {
        button.disabled = true;
      }
      try {
        await applyImagePromptInterpretSourceAspectRatio();
      } catch (error) {
        input.setOutput("Failed to use source image aspect ratio: " + ((error && error.message) || "Unknown error"));
      } finally {
        if (button) {
          button.disabled = false;
        }
      }
    });
    bind("image-interpret-source-file", "change", async event => {
      const file = event.target?.files && event.target.files[0] ? event.target.files[0] : null;
      if (!file) {
        return;
      }
      try {
        await setImagePromptInterpretSourceFromFile(file);
        input.setOutput("Loaded " + (file.name || "source image") + " for prompt interpretation.");
      } catch (error) {
        input.setOutput("Prompt source upload failed: " + ((error && error.message) || "Unknown error"));
      } finally {
        event.target.value = "";
      }
    });
    bind("image-interpret-with-llm-button", "click", async event => {
      const button = event.currentTarget;
      if (button) {
        button.disabled = true;
      }
      try {
        await processImagePromptTasks([{ name: "Source image" }], () => runImagePromptInterpretation(), "Interpreting");
        disableImageObjectIdentificationMode();
      } catch (error) {
        setImageGenerationStatus("Prompt interpretation failed.");
        input.setOutput("Prompt interpretation failed: " + ((error && error.message) || "Unknown error"));
      } finally {
        if (button) {
          button.disabled = false;
        }
      }
    });
    setImagePromptInterpretDetailMode(getImagePromptInterpretSource().detailMode);
    renderImagePromptInterpretSource();
    imageEditSourceWorkspace.bind({bind, bindDropzone, clickInput});

    bind("videogen-source-image-input", "change", event => {
      const file = event.target?.files && event.target.files[0] ? event.target.files[0] : null;
      renderVideoSourceImagePreview(file);
      if (!file) {
        return;
      }
      setVideoWorkflowMode("image-text");
      setVideoGenerationStatus("Start image loaded. Add motion and generate the video.");
      input.setOutput("Loaded " + (file.name || "start image") + " into Video Studio.");
    });
    ["videogen-image-source-field", "videogen-source-image-input"].forEach(id => {
      bind(id, "paste", event => {
        const files = getClipboardImageFiles(event);
        if (files.length === 0) {
          return;
        }
        event.preventDefault();
        try {
          if (!applyVideoSourceImageFiles(files)) {
            return;
          }
          const file = files[0];
          setVideoGenerationStatus("Start image loaded from clipboard. Add motion and generate the video.");
          input.setOutput("Loaded " + (file.name || "clipboard image") + " into Video Studio from clipboard.");
        } catch (error) {
          input.setOutput("Video start image paste failed: " + ((error && error.message) || "Unknown error"));
        }
      });
    });

    clickInput("model3d-lowpoly-upload-browse-button", "model3d-lowpoly-upload-source-file");
    clickInput("model3d-edit-upload-browse-button", "model3d-edit-upload-source-file");
    bind("model3d-lowpoly-upload-clear-button", "click", () => {
      clearModel3dLowPolyUploadSource();
      input.setOutput("Cleared uploaded low poly source model.");
    });
    bind("model3d-edit-upload-clear-button", "click", () => {
      clearModel3dEditUploadSource();
      input.setOutput("Cleared uploaded model edit sources.");
    });
    bind("model3d-lowpoly-upload-source-file", "change", event => {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      selectedModel3dLowPolyUploadFile = file;
      setModel3dLowPolyUploadSourceName(file ? (file.name || "uploaded-model") : "");
      if (typeof input.onModel3dLowPolyUploadSourceChange === "function") {
        input.onModel3dLowPolyUploadSourceChange(file);
      }
      if (file) {
        const selectedName = file.name || "uploaded-model";
        if (isSupportedModel3dLowPolyUploadFile(selectedName)) {
          input.setOutput("Selected source model file: " + selectedName);
        } else {
          input.setOutput("Selected source model file: " + selectedName + ". Low poly generation supports .glb, .gltf, .fbx, and .obj.");
        }
      }
    });
    bind("model3d-edit-upload-source-file", "change", event => {
      const files = Array.from(event.target.files || []).filter(Boolean);
      addModel3dEditUploadFiles(files);
      event.target.value = "";
      if (files.length) input.setOutput("Selected " + files.length + " model edit source file(s).");
    });
    bind("model3d-edit-batch-enabled", "change", () => {
      renderModel3dEditUploadSourceList();
    });
    bind("model3d-edit-select-all-button", "click", () => {
      setAllModel3dEditUploadSelections(true);
    });
    bind("model3d-edit-deselect-all-button", "click", () => {
      setAllModel3dEditUploadSelections(false);
    });
    bind("model3d-lowpoly-upload-use-llm", "change", () => {
      syncModel3dLowPolyUploadFaceInput();
    });
    ["imagegen", "audiogen", "musicgen", "videogen"].forEach(prefix => {
      bindStudioPostTargetUi(prefix);
    });
    syncModel3dLowPolyUploadFaceInput();
    applyImagePreviewRevealValue(imagePreviewRevealState.value);
    hideImagePreviewReveal();
    updateImagePreviewQuickActions(getSelectedGeneratedImage());
    renderAskSkillModelUploads();
    renderAskFileUploads();
    renderModel3dEditUploadSourceList();
  }

  function generateImageFromUi(options) {
    return imageGenerationOrchestrator.generate(options);
  }
  function closeImageRegenerateModeModal() {
    imageRegenerateModeState.selectedImageId = "";
    imageRegenerateModeState.prompt = "";
    const modal = document.getElementById("image-regenerate-mode-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
  }
  function openImageRegenerateModeModal(selected) {
    const selectedPrompt = String(selected?.prompt || "").trim();
    imageRegenerateModeState.selectedImageId = String(selected?.id || "").trim();
    imageRegenerateModeState.prompt = selectedPrompt;
    const summary = document.getElementById("image-regenerate-mode-summary");
    if (summary) {
      const fileName = String(selected?.imageFileName || "selected image").trim();
      summary.textContent = "Regenerate from " + fileName + ". Add keeps the current image and creates another result. Overwrite replaces this image record.";
    }
    const modal = document.getElementById("image-regenerate-mode-modal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.focus();
    }
  }
  async function runImageRegenerateFromPrompt(mode) {
    const prompt = String(imageRegenerateModeState.prompt || "").trim();
    const selectedImageId = String(imageRegenerateModeState.selectedImageId || "").trim();
    if (!prompt || !selectedImageId) {
      closeImageRegenerateModeModal();
      return void input.setOutput("Select a generated image with a saved prompt first.");
    }
    const promptNode = document.getElementById("imagegen-prompt");
    if (promptNode && typeof promptNode.value === "string") {
      promptNode.value = prompt;
    }
    const autoPromptToggle = document.getElementById("imagegen-auto-prompt");
    if (autoPromptToggle && typeof autoPromptToggle.checked === "boolean") {
      autoPromptToggle.checked = false;
    }
    const promptTextFileSelect = document.getElementById("imagegen-prompt-text-file");
    if (promptTextFileSelect && typeof promptTextFileSelect.value === "string") {
      promptTextFileSelect.value = "";
    }
    closeImageRegenerateModeModal();
    setImageGenerationStatus(mode === "overwrite" ? "Regenerating and overwriting selected image..." : "Regenerating image from selected prompt...");
    await generateImageFromUi({
      promptOverride: prompt,
      promptTextFileOverride: "",
      autoPromptOverride: false,
      overwriteImageId: mode === "overwrite" ? selectedImageId : undefined
    });
  }
  function bindGenerationActions() {
    imageSendDestinationHelpers?.bind();
    startStudioSidebarFoldoutRefreshes();
    bindStudioBottomWheelScroll();
    bindMediaConverterGifHistoryEvents();
    bindImageCreativeControls();
    bindVideoCreativeControls();
    bindMirroredNumberInputs("image-generate-count", "imagegen-batch-size");
    bindMirroredNumberInputs("video-generate-count", "videogen-batch-size");
    ["imagegen-width", "imagegen-height"].forEach(id => {
      const node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", () => applyImagePreviewWorkflowDimensions());
        node.addEventListener("change", () => applyImagePreviewWorkflowDimensions());
      }
    });
    const imageWorkflowPathInput = document.getElementById("comfy-image-workflow-path-input");
    if (imageWorkflowPathInput) {
      imageWorkflowPathInput.addEventListener("change", () => {
        void applyImagePreviewWorkflowDimensionsFromWorkflow();
      });
    }
    document.getElementById("image-identify-objects-toggle")?.addEventListener("change", event => {
      syncGenerateImageButtonLabel();
      syncImageIdentifyMaxAmountVisibility();
      syncImagePromptProcessingControls();
    });
    document.getElementById("image-identify-max-amount")?.addEventListener("change", readImageIdentifyMaxAmount);
    document.getElementById("image-object-prompt-add-button")?.addEventListener("click", addImageObjectPrompt);
    document.getElementById("image-object-prompt-delete-button")?.addEventListener("click", deleteSelectedImageObjectPrompts);
    document.getElementById("image-prompt-processing-mode")?.addEventListener("change", syncImagePromptProcessingControls);
    document.getElementById("image-prompt-processing-batch-size")?.addEventListener("change", readImagePromptProcessingOptions);
    document.getElementById("imagegen-prompt")?.addEventListener("input", syncActiveImageObjectPromptFromField);
    syncGenerateImageButtonLabel();
    syncImagePromptProcessingControls();
    syncImageIdentifyMaxAmountVisibility();
    renderImageObjectPrompts();
    document.getElementById("model3d-image-source")?.addEventListener("change", renderModel3dRecentImageSources);
    renderModel3dRecentImageSources();
    void applyImagePreviewWorkflowDimensionsFromWorkflow();
    document.getElementById("generate-image-button").addEventListener("click", async () => {
      if (document.getElementById("image-identify-objects-toggle")?.checked === true || imageObjectPromptState.items.length > 1) {
        await generateIdentifiedImageObjectsFromUi();
        return;
      }
      await generateImageFromUi();
    });
    document.getElementById("model3d-prepare-source-split-combine-button")?.addEventListener("click", async event => {
      event.preventDefault();
      const button = event.currentTarget;
      if (button) button.disabled = true;
      try {
        await prepareModel3dSourceInSplitCombineTool();
      } catch (error) {
        input.setOutput("Failed to open Split + Combine for 3D source: " + ((error && error.message) || "Unknown error"));
      } finally {
        if (button) button.disabled = false;
      }
    });
    document.getElementById("image-generate-from-prompt-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await generateImageFromUi({ promptTextFileOverride: "", autoPromptOverride: false });
    });
    const imageImprovePromptButton = document.getElementById("image-improve-prompt-button");
    if (imageImprovePromptButton) {
      imageImprovePromptButton.addEventListener("click", async event => {
        event.preventDefault();
        imageImprovePromptButton.disabled = true;
        try {
          await improveImagePromptFromUi();
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setImageGenerationStatus("Image prompt improvement failed.");
          input.setOutput("Failed to improve image prompt: " + detail);
        } finally {
          imageImprovePromptButton.disabled = false;
        }
      });
    }
    document.getElementById("image-change-prompt-button")?.addEventListener("click", event => {
      event.preventDefault();
      openImageChangePromptModal();
    });
    document.getElementById("image-translate-prompt-button")?.addEventListener("click", event => {
      event.preventDefault();
      openImageTranslatePromptModal();
    });
    document.querySelectorAll("[data-image-change-prompt-mode]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        setImageChangePromptMode(button.getAttribute("data-image-change-prompt-mode"));
      });
    });
    const imageChangePromptModal = document.getElementById("image-change-prompt-modal");
    const imageChangePromptApplyButton = document.getElementById("image-change-prompt-apply-button");
    [
      document.getElementById("image-change-prompt-close-button"),
      document.getElementById("image-change-prompt-cancel-button")
    ].forEach(button => {
      button?.addEventListener("click", event => {
        event.preventDefault();
        closeImageChangePromptModal();
      });
    });
    imageChangePromptModal?.addEventListener("click", event => {
      if (event.target === imageChangePromptModal) {
        closeImageChangePromptModal();
      }
    });
    imageChangePromptModal?.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeImageChangePromptModal();
      }
    });
    imageChangePromptApplyButton?.addEventListener("click", async event => {
      event.preventDefault();
      imageChangePromptApplyButton.disabled = true;
      try {
        await applyImagePromptChangesFromUi();
      } catch (error) {
        const detail = error && error.message ? error.message : "Unknown error";
        setImageGenerationStatus("Image prompt change failed.");
        input.setOutput("Failed to change image prompt: " + detail);
      } finally {
        imageChangePromptApplyButton.disabled = false;
      }
    });
    const imageTranslatePromptModal = document.getElementById("image-translate-prompt-modal");
    const imageTranslatePromptApplyButton = document.getElementById("image-translate-prompt-apply-button");
    document.getElementById("image-translate-prompt-language-select")?.addEventListener("change", syncImageTranslatePromptLanguageField);
    [
      document.getElementById("image-translate-prompt-close-button"),
      document.getElementById("image-translate-prompt-cancel-button")
    ].forEach(button => {
      button?.addEventListener("click", event => {
        event.preventDefault();
        closeImageTranslatePromptModal();
      });
    });
    imageTranslatePromptModal?.addEventListener("click", event => {
      if (event.target === imageTranslatePromptModal) {
        closeImageTranslatePromptModal();
      }
    });
    imageTranslatePromptModal?.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeImageTranslatePromptModal();
      }
    });
    imageTranslatePromptApplyButton?.addEventListener("click", async event => {
      event.preventDefault();
      imageTranslatePromptApplyButton.disabled = true;
      try {
        await applyImagePromptTranslationFromUi();
      } catch (error) {
        const detail = error && error.message ? error.message : "Unknown error";
        setImageGenerationStatus("Image prompt translation failed.");
        input.setOutput("Failed to translate image prompt: " + detail);
      } finally {
        imageTranslatePromptApplyButton.disabled = false;
      }
    });
    document.getElementById("stop-image-generation-button")?.addEventListener("click", async () => {
      await stopGenerationRequest("image", "Stopping image generation...");
    });
    const imageTo3dButton = document.getElementById("image-to-3d-button");
    if (imageTo3dButton) {
      imageTo3dButton.addEventListener("click", event => {
        event.preventDefault();
        openImageQuickActionModal("model3d");
      });
    }
    const imageImportBlenderButton = document.getElementById("image-import-blender-button");
    if (imageImportBlenderButton) {
      imageImportBlenderButton.addEventListener("click", async event => {
        event.preventDefault();
        imageImportBlenderButton.disabled = true;
        try {
          await importSelectedImageIntoBlender();
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          input.setOutput("Blender image import failed: " + detail);
        } finally {
          updateImagePreviewQuickActions(getSelectedGeneratedImage());
        }
      });
    }
    const imageToVideoButton = document.getElementById("image-to-video-button");
    if (imageToVideoButton) {
      imageToVideoButton.addEventListener("click", event => {
        event.preventDefault();
        openImageQuickActionModal("video");
      });
    }
    const imageRotateButton = document.getElementById("image-rotate-button");
    if (imageRotateButton) {
      imageRotateButton.addEventListener("click", event => {
        event.preventDefault();
        openImageQuickActionModal("rotate360");
      });
    }
    const imagePreviewDownloadButton = document.getElementById("image-preview-download-button");
    if (imagePreviewDownloadButton) {
      imagePreviewDownloadButton.addEventListener("click", event => {
        event.preventDefault();
        handleImagePreviewDownload();
      });
    }
    const imageGifExportModal = document.getElementById("image-gif-export-modal");
    const imageGifExportCloseButton = document.getElementById("image-gif-export-close-button");
    const imageGifExportCancelButton = document.getElementById("image-gif-export-cancel-button");
    const imageGifExportOriginalButton = document.getElementById("image-gif-export-original-button");
    const imageGifExportFrameButton = document.getElementById("image-gif-export-frame-button");
    [imageGifExportCloseButton, imageGifExportCancelButton].forEach(button => {
      button?.addEventListener("click", event => {
        event.preventDefault();
        closeImageGifExportModal();
      });
    });
    imageGifExportModal?.addEventListener("click", event => {
      if (event.target === imageGifExportModal) {
        closeImageGifExportModal();
      }
    });
    imageGifExportModal?.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeImageGifExportModal();
      }
    });
    imageGifExportOriginalButton?.addEventListener("click", event => {
      event.preventDefault();
      downloadImagePreviewOriginal();
      closeImageGifExportModal();
    });
    imageGifExportFrameButton?.addEventListener("click", event => {
      event.preventDefault();
      downloadCurrentImagePreviewPng();
      closeImageGifExportModal();
    });
    const imageQuickActionAlwaysShowRotateConfirm = document.getElementById("image-quick-action-always-show-rotate-confirm");
    const imageQuickActionCloseButton = document.getElementById("image-quick-action-close-button");
    const imageQuickActionCancelButton = document.getElementById("image-quick-action-cancel-button");
    const imageQuickActionRunButton = document.getElementById("image-quick-action-run-button");
    if (imageQuickActionAlwaysShowRotateConfirm) {
      imageQuickActionAlwaysShowRotateConfirm.addEventListener("click", event => {
        if (event.target === imageQuickActionAlwaysShowRotateConfirm) {
          const currentValue = imageQuickActionAlwaysShowRotateConfirm.checked === true;
          if (currentValue) {
            input.setOutput("Rotate 360 confirmation will always be shown before running the tool.");
          } else {
            input.setOutput("Rotate 360 confirmation will be skipped if the tool is run from the image preview context menu.");
          }
        }
      })
    }
    [imageQuickActionCloseButton, imageQuickActionCancelButton].forEach(button => {
      if (!button) {
        return;
      }
      button.addEventListener("click", event => {
        event.preventDefault();
        closeImageQuickActionModal();
      });
    });
    const imageQuickActionModal = document.getElementById("image-quick-action-modal");
    if (imageQuickActionModal) {
      imageQuickActionModal.addEventListener("click", event => {
        if (event.target === imageQuickActionModal) {
          closeImageQuickActionModal();
        }
      });
      imageQuickActionModal.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeImageQuickActionModal();
        }
      });
    }
    if (imageQuickActionRunButton) {
      imageQuickActionRunButton.addEventListener("click", async event => {
        event.preventDefault();
        setImageQuickActionRunState(true);
        try {
          await runImageQuickActionModal();
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setImageGenerationStatus("Image quick action failed: " + detail);
          setVideoGenerationStatus("Image quick action failed: " + detail);
          input.setOutput("Image quick action failed: " + detail);
        } finally {
          setImageQuickActionRunState(false);
        }
      });
    }
    document.getElementById("image-quick-action-mode")?.addEventListener("change", () => {
      syncImageQuickActionModeUi();
    });
    const imageRegenerateFromPromptButton = document.getElementById("image-regenerate-from-prompt-button");
    if (imageRegenerateFromPromptButton) {
      imageRegenerateFromPromptButton.addEventListener("click", () => {
        const selected = getSelectedGeneratedImage();
        if (!selected) {
          return void input.setOutput("Select a generated image first.");
        }
        const selectedPrompt = String(selected.prompt || "").trim();
        if (!selectedPrompt) {
          return void input.setOutput("Selected image has no saved prompt to regenerate from.");
        }
        openImageRegenerateModeModal(selected);
      });
    }
    const imageRegenerateModeModal = document.getElementById("image-regenerate-mode-modal");
    const imageRegenerateCloseButton = document.getElementById("image-regenerate-mode-close-button");
    const imageRegenerateCancelButton = document.getElementById("image-regenerate-mode-cancel-button");
    const imageRegenerateAddButton = document.getElementById("image-regenerate-add-button");
    const imageRegenerateOverwriteButton = document.getElementById("image-regenerate-overwrite-button");
    [imageRegenerateCloseButton, imageRegenerateCancelButton].forEach(button => {
      button?.addEventListener("click", event => {
        event.preventDefault();
        closeImageRegenerateModeModal();
      });
    });
    imageRegenerateModeModal?.addEventListener("click", event => {
      if (event.target === imageRegenerateModeModal) {
        closeImageRegenerateModeModal();
      }
    });
    imageRegenerateModeModal?.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeImageRegenerateModeModal();
      }
    });
    imageRegenerateAddButton?.addEventListener("click", async event => {
      event.preventDefault();
      imageRegenerateAddButton.disabled = true;
      imageRegenerateOverwriteButton.disabled = true;
      try {
        await runImageRegenerateFromPrompt("add");
      } finally {
        imageRegenerateAddButton.disabled = false;
        imageRegenerateOverwriteButton.disabled = false;
      }
    });
    imageRegenerateOverwriteButton?.addEventListener("click", async event => {
      event.preventDefault();
      imageRegenerateAddButton.disabled = true;
      imageRegenerateOverwriteButton.disabled = true;
      try {
        await runImageRegenerateFromPrompt("overwrite");
      } finally {
        imageRegenerateAddButton.disabled = false;
        imageRegenerateOverwriteButton.disabled = false;
      }
    });
    const imageQuickActionBindings = [
      ["image-separate-layers-tab-button", "layered"],
      ["image-separate-layers-button", "layered"],
      ["image-remove-background-button", "remove-background", { mode: "lora" }],
      ["image-remove-background-crop-button", "remove-background", { mode: "lora-crop" }],
      ["image-remove-background-button", "remove-background", { mode: "lora" }],
      ["image-delight-button", "delight"],
      ["image-upscale-button", "upscale"],
      ["image-normal-map-button", "normal-map"]
    ];
    imageQuickActionBindings.forEach(binding => {
      const button = document.getElementById(binding[0]);
      if (!button) {
        return;
      }
      button.addEventListener("click", async event => {
        event.preventDefault();
        try {
          if (binding[1] === "layered" || binding[1] === "delight") {
            openImageQuickActionModal(binding[1]);
            return;
          }
          if (binding[1] === "normal-map") {
            await runImageNormalMapToolQuickAction();
            return;
          }
          await runImagePreviewQuickAction(binding[1], binding[2] || {});
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setImageGenerationStatus("Image quick action failed: " + detail);
          input.setOutput("Image quick action failed: " + detail);
        }
      });
    });
    document.getElementById("image-preview-focus-button")?.addEventListener("click", event => {
      event.preventDefault();
      openImagePreviewFocusViewer();
    });
    document.getElementById("image-preview-reveal-button")?.addEventListener("click", event => {
      event.preventDefault();
      showSelectedImageVariantRevealSlider();
    });
    document.querySelectorAll("[data-video-preview-action]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        runVideoPreviewAction(String(button.getAttribute("data-video-preview-action") || ""));
      });
    });
    updateVideoPreviewActionButtons();
    const imageUseAsToolLogoButton = document.getElementById("image-use-as-tool-logo-button");
    if (imageUseAsToolLogoButton) {
      imageUseAsToolLogoButton.addEventListener("click", async event => {
        event.preventDefault();
        try {
          await useSelectedImageAsToolLogo();
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setImageGenerationStatus("Tool logo update failed.");
          input.setOutput("Tool logo update failed: " + detail);
        }
      });
    }
    const imagePreviewRevealSlider = document.getElementById("image-preview-reveal-slider");
    if (imagePreviewRevealSlider) {
      imagePreviewRevealSlider.addEventListener("input", event => {
        const target = event.currentTarget;
        applyImagePreviewRevealValue(target && typeof target.value === "string" ? target.value : imagePreviewRevealState.value);
      });
      imagePreviewRevealSlider.addEventListener("change", event => {
        const target = event.currentTarget;
        applyImagePreviewRevealValue(target && typeof target.value === "string" ? target.value : imagePreviewRevealState.value);
      });
    }
    const imagePreviewRevealStage = document.getElementById("image-preview-reveal-stage");
    if (imagePreviewRevealStage) {
      let revealPointerActive = false;
      const onRevealPointerDown = event => {
        if (!event) {
          return;
        }
        revealPointerActive = true;
        if (typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (event.currentTarget && typeof event.currentTarget.setPointerCapture === "function" && typeof event.pointerId === "number") {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {}
        }
        applyImagePreviewRevealValueFromClientX(event.clientX);
      };
      const onRevealPointerMove = event => {
        if (!revealPointerActive || !event) {
          return;
        }
        if (typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        applyImagePreviewRevealValueFromClientX(event.clientX);
      };
      const onRevealPointerUp = event => {
        if (!revealPointerActive) {
          return;
        }
        revealPointerActive = false;
        if (event && event.currentTarget && typeof event.currentTarget.releasePointerCapture === "function" && typeof event.pointerId === "number") {
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {}
        }
      };
      imagePreviewRevealStage.addEventListener("pointerdown", onRevealPointerDown);
      imagePreviewRevealStage.addEventListener("pointermove", onRevealPointerMove);
      imagePreviewRevealStage.addEventListener("pointerup", onRevealPointerUp);
      imagePreviewRevealStage.addEventListener("pointercancel", onRevealPointerUp);
      imagePreviewRevealStage.addEventListener("pointerleave", onRevealPointerUp);
    }
    const imagePixelArtButton = document.getElementById("image-pixel-art-button");
    if (imagePixelArtButton) {
      imagePixelArtButton.addEventListener("click", async event => {
        event.preventDefault();
        try {
          await runImagePixelArtQuickAction();
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setImageGenerationStatus("Pixel art conversion failed.");
          input.setOutput("Pixel art conversion failed: " + detail);
        }
      });
    }
    document.getElementById("speech-tts-mode")?.addEventListener("change", updateSpeechTtsModeUi);
    updateSpeechTtsModeUi();
    void loadSpeechTtsVoices();
    bindAudioMicCaptureUi("speech-stt");
    bindAudioMicCaptureUi("speech-sts");
    if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === "function") {
      navigator.mediaDevices.addEventListener("devicechange", () => {
        void refreshAudioMicDeviceOptions("speech-stt");
        void refreshAudioMicDeviceOptions("speech-sts");
      });
    }
    document.getElementById("speech-tts-button").addEventListener("click", async () => {
      const text = document.getElementById("speech-tts-text").value.trim();
      const mode = document.getElementById("speech-tts-mode")?.value || "standard";
      const speaker = document.getElementById("speech-tts-speaker").value.trim();
      const speedRaw = Number.parseFloat(document.getElementById("speech-tts-speed").value.trim());
      const speed = Number.isFinite(speedRaw) ? Math.max(0.5, Math.min(2, speedRaw)) : 1;
      const referenceText = document.getElementById("speech-tts-reference-text")?.value.trim() || "";
      const instruct = document.getElementById("speech-tts-instruct")?.value.trim() || "";
      const referenceAudioInput = document.getElementById("speech-tts-voice-clone-file");
      const referenceAudioFile = referenceAudioInput && referenceAudioInput.files && referenceAudioInput.files[0] ? referenceAudioInput.files[0] : null;
      if (!text) {
        return void input.setOutput("Provide text for TTS.");
      }
      if (mode === "voice-clone" && !referenceAudioFile) {
        return void input.setOutput("Choose a reference audio file for voice clone TTS.");
      }
      if ((mode === "custom-voice" || mode === "design-voice") && !instruct) {
        return void input.setOutput("Provide voice instructions for the selected Qwen TTS mode.");
      }
      input.setAudioGenerationStatus("Generating speech...");
      const payload = await input.request("/api/speech-tts", {
        text,
        mode,
        speaker: speaker || undefined,
        speed: mode === "standard" ? speed : undefined,
        referenceAudioDataUrl: referenceAudioFile ? await readAudioFileAsSpeechDataUrl(referenceAudioFile) : undefined,
        referenceAudioFileName: referenceAudioFile ? (referenceAudioFile.name || "tts-reference") : undefined,
        referenceText: referenceText || undefined,
        instruct: instruct || undefined
      });
      const preview = document.getElementById("speech-tts-preview");
      const output = document.getElementById("speech-tts-output");
      if (preview) preview.src = payload.audioDataUrl || "";
      if (output) {
        output.textContent = `Generated ${payload.fileName || "speech.mp3"} with ${payload.speaker || "default"} using ${mode} mode.`;
      }
      input.setAudioGenerationStatus("Generated TTS audio successfully.");
      input.setOutput("Generated text to speech in Audio Studio.");
    });
    document.getElementById("speech-stt-button").addEventListener("click", async () => {
      const fileInput = document.getElementById("speech-stt-file");
      const languageInput = document.getElementById("speech-stt-language");
      const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (!file) {
        return void input.setOutput("Choose an audio or video file for STT.");
      }
      input.setAudioGenerationStatus("Transcribing speech...");
      try {
        const audioDataUrl = await readAudioFileAsSpeechDataUrl(file);
        const savedSource = await importSpeechSourceFile(file, "STT source audio");
        if (savedSource?.id) {
          await input.loadAudioHistory(savedSource.id, input.state.selectedGeneratedMusicId);
        }
        const payload = await input.request("/api/speech-stt", {
          audioDataUrl,
          fileName: file.name || "speech-input",
          language: languageInput && languageInput.value ? languageInput.value.trim() : "auto",
          saveSource: false
        });
        const output = document.getElementById("speech-stt-output");
        if (output) {
          output.textContent = payload.transcript || "No transcript returned.";
        }
        if (payload.sourceAudio?.id) {
          await input.loadAudioHistory(payload.sourceAudio.id, input.state.selectedGeneratedMusicId);
        }
        input.setAudioGenerationStatus("Speech transcription complete.");
        input.setOutput("Transcribed speech to text in Audio Studio and saved the source audio.");
        await input.refreshState();
      } catch (error) {
        const detail = error && error.message ? error.message : "Unknown error";
        input.setAudioGenerationStatus("Speech transcription failed.");
        input.setOutput("Speech transcription failed: " + detail);
      }
    });
    document.getElementById("speech-sts-button").addEventListener("click", async () => {
      const fileInput = document.getElementById("speech-sts-file");
      const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      const speaker = document.getElementById("speech-sts-speaker").value.trim();
      const speedRaw = Number.parseFloat(document.getElementById("speech-sts-speed").value.trim());
      const speed = Number.isFinite(speedRaw) ? Math.max(0.5, Math.min(2, speedRaw)) : 0.9;
      if (!file) {
        return void input.setOutput("Choose an audio or video file for STS.");
      }
      input.setAudioGenerationStatus("Generating speech-to-speech audio...");
      const payload = await input.request("/api/speech-sts", {
        audioDataUrl: await readAudioFileAsSpeechDataUrl(file),
        fileName: file.name || "speech-input",
        speaker: speaker || undefined,
        speed
      });
      const preview = document.getElementById("speech-sts-preview");
      const output = document.getElementById("speech-sts-output");
      if (preview) preview.src = payload.audioDataUrl || "";
      if (output) {
        output.textContent = payload.transcript
          ? `Transcript: ${payload.transcript}`
          : `Generated ${payload.fileName || "speech.mp3"} with speaker ${payload.speaker || "default"}.`;
      }
      input.setAudioGenerationStatus("Speech-to-speech generation complete.");
      input.setOutput("Generated speech to speech in Audio Studio.");
    });
    const resetAudioFormButton = document.getElementById("reset-audio-form-button");
    if (resetAudioFormButton) {
      resetAudioFormButton.addEventListener("click", () => {
        const promptInput = document.getElementById("audiogen-prompt");
        const promptTextFileInput = document.getElementById("audiogen-prompt-text-file");
        const secondsInput = document.getElementById("audiogen-seconds");
        const stepsInput = document.getElementById("audiogen-steps");
        const cfgInput = document.getElementById("audiogen-cfg");
        const messengerInput = document.getElementById("audiogen-post-messenger-select");
        const destinationInput = document.getElementById("audiogen-post-destination-input");
        if (promptInput) promptInput.value = "";
        if (promptTextFileInput) promptTextFileInput.value = "";
        if (secondsInput) secondsInput.value = "";
        if (stepsInput) stepsInput.value = "50";
        if (cfgInput) cfgInput.value = "4.98";
        if (messengerInput) messengerInput.value = "none";
        if (destinationInput) destinationInput.value = "";
        input.setAudioGenerationStatus("Ready for audio generation.");
      });
    }
    document.getElementById("generate-audio-button").addEventListener("click", async () => {
      const prompt = document.getElementById("audiogen-prompt").value.trim();
      const promptTextFile = document.getElementById("audiogen-prompt-text-file")?.value || "";
      const promptTextSelectionMode = document.getElementById("audiogen-prompt-text-no-repeat")?.checked === true ? "no-repeat" : "random";
      const secondsRaw = document.getElementById("audiogen-seconds").value.trim();
      const stepsRaw = document.getElementById("audiogen-steps").value.trim();
      const cfgRaw = document.getElementById("audiogen-cfg").value.trim();
      const postTarget = getStudioPostTarget("audiogen", "audio");
      if (postTarget.error) {
        return void input.setOutput(postTarget.error);
      }
      const discordChannelId = postTarget.messenger === "discord" ? postTarget.destinationId : "";
      if (!prompt && !promptTextFile) {
        return void input.setOutput("Provide an audio prompt or choose a prompt text source.");
      }
      const parsedSeconds = secondsRaw ? Number.parseInt(secondsRaw, 10) : Number.NaN;
      const seconds = Number.isFinite(parsedSeconds) ? Math.max(1, Math.min(120, parsedSeconds)) : undefined;
      const parsedSteps = stepsRaw ? Number.parseInt(stepsRaw, 10) : Number.NaN;
      const steps = Number.isFinite(parsedSteps) ? Math.max(1, Math.min(250, parsedSteps)) : undefined;
      const parsedCfg = cfgRaw ? Number.parseFloat(cfgRaw) : Number.NaN;
      const cfg = Number.isFinite(parsedCfg) ? Math.max(0, Math.min(30, parsedCfg)) : undefined;
      input.setAudioGenerationStatus("Generating audio...");
      const dashboardRequestId = startGenerationRequest("audio");
      let payload;
      try {
        payload = await input.request("/api/audio-generate", {
          prompt,
          promptTextFile: promptTextFile || undefined,
          promptTextSelectionMode,
          seconds,
          channelId: discordChannelId || undefined,
          dashboardRequestId
        });
      } finally {
        finishGenerationRequest("audio", dashboardRequestId);
      }
      await input.loadAudioHistory(payload.id, input.state.selectedGeneratedMusicId);
      input.setAudioGenerationStatus("Generated " + payload.audioFileName + " successfully.");
      let postSummary = "Generated audio in Audio Studio.";
      if (postTarget.messenger === "discord") {
        postSummary = "Generated audio and posted it to Discord.";
      } else if (postTarget.messenger === "telegram") {
        const audioUrl = input.buildAbsoluteDashboardUrl(buildGeneratedAudioFileUrl(payload.id, payload.audioFileName));
        await postStudioResultToExternalTarget(
          postTarget,
          "Generated audio ready:\n" + audioUrl + "\n\nPrompt: " + prompt
        );
        postSummary = "Generated audio and posted it to Telegram.";
      } else if (postTarget.messenger === "whatsapp") {
        const audioUrl = input.buildAbsoluteDashboardUrl(buildGeneratedAudioFileUrl(payload.id, payload.audioFileName));
        await postStudioResultToExternalTarget(
          postTarget,
          "Generated audio ready:\n" + audioUrl + "\n\nPrompt: " + prompt
        );
        postSummary = "Generated audio and posted it to WhatsApp.";
      }
      input.setOutput(postSummary);
      await input.refreshState();
      if (postTarget.messenger === "discord") {
        await input.loadBotMessages();
      }
    });
    document.getElementById("stop-audio-generation-button")?.addEventListener("click", async () => {
      await stopGenerationRequest("audio", "Stopping audio generation...");
    });
    globalThis.createDashboardMusicThinkingHelpers?.({
      request: input.request,
      setMusicGenerationStatus: input.setMusicGenerationStatus,
      setOutput: input.setOutput
    }).bindMusicThinkingActions();
    document.getElementById("generate-music-button").addEventListener("click", async () => {
      const tags = document.getElementById("musicgen-tags").value.trim();
      const lyrics = document.getElementById("musicgen-lyrics").value.trim();
      const tagsTextFile = document.getElementById("musicgen-tags-text-file")?.value || "";
      const lyricsTextFile = document.getElementById("musicgen-lyrics-text-file")?.value || "";
      const tagsTextSelectionMode = document.getElementById("musicgen-tags-text-no-repeat")?.checked === true ? "no-repeat" : "random";
      const lyricsTextSelectionMode = document.getElementById("musicgen-lyrics-text-no-repeat")?.checked === true ? "no-repeat" : "random";
      const secondsRaw = document.getElementById("musicgen-seconds").value.trim();
      const stepsRaw = document.getElementById("musicgen-steps")?.value.trim() || "";
      const cfgRaw = document.getElementById("musicgen-cfg")?.value.trim() || "";
      const postTarget = getStudioPostTarget("musicgen", "music");
      if (postTarget.error) {
        return void input.setOutput(postTarget.error);
      }
      const discordChannelId = postTarget.messenger === "discord" ? postTarget.destinationId : "";
      const parsedSeconds = Number.parseInt(secondsRaw, 10);
      if (!Number.isFinite(parsedSeconds) || parsedSeconds < 1) {
        return void input.setOutput("Provide a valid music length in seconds.");
      }
      const parsedSteps = Number.parseInt(stepsRaw, 10);
      if (!Number.isFinite(parsedSteps) || parsedSteps < 1 || parsedSteps > 250) {
        return void input.setOutput("Provide music steps between 1 and 250.");
      }
      const parsedCfg = Number.parseFloat(cfgRaw);
      if (!Number.isFinite(parsedCfg) || parsedCfg < 0 || parsedCfg > 30) {
        return void input.setOutput("Provide a music CFG value between 0 and 30.");
      }
      const seconds = Math.max(1, Math.min(120, parsedSeconds));
      const steps = Math.round(parsedSteps);
      const cfg = parsedCfg;
      const seed = readWorkflowSeed("musicgen-seed");
      input.setMusicGenerationStatus("Generating music...");
      const dashboardRequestId = startGenerationRequest("music");
      let payload;
      try {
        payload = await input.request("/api/music-generate", {
          seconds,
          steps,
          cfg,
          steps,
          cfg,
          seed,
          tags: tags || undefined,
          lyrics: lyrics || undefined,
          tagsTextFile: tagsTextFile || undefined,
          lyricsTextFile: lyricsTextFile || undefined,
          tagsTextSelectionMode,
          lyricsTextSelectionMode,
          channelId: discordChannelId || undefined,
          dashboardRequestId
        });
      } finally {
        finishGenerationRequest("music", dashboardRequestId);
      }
      await input.loadAudioHistory(input.state.selectedGeneratedAudioId, payload.id);
      applySeedControlAfterGenerate("musicgen-seed", "musicgen-seed-control", seed);
      input.setMusicGenerationStatus("Generated " + payload.audioFileName + " successfully.");
      let postSummary = "Generated music in Music Studio.";
      if (postTarget.messenger === "discord") {
        postSummary = "Generated music and posted it to Discord.";
      } else if (postTarget.messenger === "telegram") {
        const audioUrl = input.buildAbsoluteDashboardUrl(buildGeneratedAudioFileUrl(payload.id, payload.audioFileName));
        const tagsLine = tags ? "\nTags: " + tags : "";
        await postStudioResultToExternalTarget(
          postTarget,
          "Generated music ready:\n" + audioUrl + tagsLine
        );
        postSummary = "Generated music and posted it to Telegram.";
      } else if (postTarget.messenger === "whatsapp") {
        const audioUrl = input.buildAbsoluteDashboardUrl(buildGeneratedAudioFileUrl(payload.id, payload.audioFileName));
        const tagsLine = tags ? "\nTags: " + tags : "";
        await postStudioResultToExternalTarget(
          postTarget,
          "Generated music ready:\n" + audioUrl + tagsLine
        );
        postSummary = "Generated music and posted it to WhatsApp.";
      }
      input.setOutput(postSummary);
      await input.refreshState();
      if (postTarget.messenger === "discord") {
        await input.loadBotMessages();
      }
    });
    document.getElementById("stop-music-generation-button")?.addEventListener("click", async () => {
      await stopGenerationRequest("music", "Stopping music generation...");
    });
    document.querySelectorAll("[data-video-workflow-mode]").forEach(button => {
      button.addEventListener("click", event => {
        const mode = String(event.currentTarget?.getAttribute("data-video-workflow-mode") || "text").trim() === "image-text" ? "image-text" : "text";
        setVideoWorkflowMode(mode);
      });
    });
    document.getElementById("videogen-create-ai-prompt-button")?.addEventListener("click", async event => {
      event.preventDefault();
      const direction = document.getElementById("videogen-auto-prompt-direction")?.value.trim() || "";
      const existingPrompt = document.getElementById("videogen-prompt")?.value.trim() || "";
      const prompt = [
        "Write exactly one high quality video generation prompt.",
        "Return plain prompt text only, no markdown, no quotes, no explanation.",
        "Focus on visible motion, camera movement, subject action, atmosphere, and temporal change.",
        existingPrompt ? "Use this current prompt as context: " + existingPrompt : "",
        direction ? "Follow this direction: " + direction : ""
      ].filter(Boolean).join("\n");
      setVideoGenerationStatus("Asking LazyDev for a video prompt...");
      try {
        const response = await input.request("/api/ask", { prompt });
        const generatedPrompt = String(response && response.response ? response.response : "").trim().replace(/^["'`]+|["'`]+$/g, "");
        if (!generatedPrompt) {
          throw new Error("LazyDev returned an empty prompt.");
        }
        const promptNode = document.getElementById("videogen-prompt");
        if (promptNode && typeof promptNode.value === "string") {
          promptNode.value = generatedPrompt;
          promptNode.dispatchEvent(new Event("input", { bubbles: true }));
        }
        setVideoGenerationStatus("Video prompt drafted.");
        input.setOutput("LazyDev wrote a video prompt.");
      } catch (error) {
        const detail = error && error.message ? error.message : "Unknown error";
        setVideoGenerationStatus("Video prompt draft failed.");
        input.setOutput("Failed to create video prompt: " + detail);
      }
    });
    document.getElementById("generate-video-button").addEventListener("click", async () => {
      const mode = document.querySelector("[data-video-workflow-mode].active")?.getAttribute("data-video-workflow-mode") === "image-text" ? "image-text" : "text";
      const prompt = document.getElementById("videogen-prompt").value.trim();
      const autoPrompt = document.getElementById("videogen-auto-prompt")?.checked === true;
      const promptDirection = document.getElementById("videogen-auto-prompt-direction")?.value.trim() || "";
      const promptTextFile = document.getElementById("videogen-prompt-text-file")?.value || "";
      const promptTextSelectionMode = document.getElementById("videogen-prompt-text-no-repeat")?.checked === true ? "no-repeat" : "random";
      const negativePrompt = document.getElementById("videogen-negative-prompt")?.value.trim() || "";
      const framesRaw = document.getElementById("videogen-frames")?.value.trim() || "";
      const widthRaw = document.getElementById("videogen-width")?.value.trim() || "";
      const heightRaw = document.getElementById("videogen-height")?.value.trim() || "";
      const fpsRaw = document.getElementById("videogen-fps")?.value.trim() || "";
      const stepsRaw = document.getElementById("videogen-steps")?.value.trim() || "";
      const imageInput = document.getElementById("videogen-source-image-input");
      const imageFile = mode === "image-text" && imageInput && imageInput.files ? imageInput.files[0] : null;
      const postTarget = getStudioPostTarget("videogen", "videos");
      if (postTarget.error) {
        return void input.setOutput(postTarget.error);
      }
      const discordChannelId = postTarget.messenger === "discord" ? postTarget.destinationId : "";
      if (!prompt && !promptTextFile && !autoPrompt) {
        return void input.setOutput("Provide a video prompt, choose a prompt text source, or enable LazyDev's video prompt.");
      }
      if (mode === "image-text" && !imageFile) {
        return void input.setOutput("Choose a start image for Image + Text video mode.");
      }
      const parseIntOption = (raw, min, max) => {
        const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
        return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : undefined;
      };
      const frames = parseIntOption(framesRaw, 1, 512);
      const width = parseIntOption(widthRaw, 64, 4096);
      const height = parseIntOption(heightRaw, 64, 4096);
      const fps = parseIntOption(fpsRaw, 1, 60);
      const steps = parseIntOption(stepsRaw, 1, 250);
      const seed = readWorkflowSeed("video-editor-seed");
      const generationCount = readGenerateCount(["video-generate-count", "videogen-batch-size"], { max: 8 });
      const workflowPath = mode === "image-text"
        ? (document.getElementById("comfy-video-image-workflow-path-input")?.value.trim() || "comfyui-workflows/video/video_from_image_text.json")
        : (document.getElementById("comfy-video-workflow-path-input")?.value.trim() || "comfyui-workflows/video/video_from_text.json");
      let resolvedPrompt = prompt;
      if (autoPrompt) {
        const aiPrompt = [
          "Write exactly one high quality video generation prompt.",
          "Return plain prompt text only, no markdown, no quotes, no explanation.",
          "Focus on visible motion, camera movement, subject action, atmosphere, and temporal change.",
          prompt ? "Use this user prompt as the core context: " + prompt : "",
          promptDirection ? "Follow this direction: " + promptDirection : ""
        ].filter(Boolean).join("\n");
        setVideoGenerationStatus("Asking LazyDev for a video prompt...");
        const response = await input.request("/api/ask", { prompt: aiPrompt });
        resolvedPrompt = String(response && response.response ? response.response : "").trim().replace(/^["'`]+|["'`]+$/g, "") || prompt;
      }
      setVideoGenerationStatus(generationCount > 1 ? "Generating video 1/" + generationCount + "..." : (mode === "image-text" ? "Generating image + text video..." : "Generating text video..."));
      const dashboardRequestId = startGenerationRequest("video");
      const generatedPayloads = [];
      try {
        const imageDataUrl = imageFile ? await input.readFileAsDataUrl(imageFile) : undefined;
        for (let index = 0; index < generationCount; index += 1) {
          const runSeed = index === 0 ? seed : readWorkflowSeed("video-editor-seed");
          if (generationCount > 1) {
            setVideoGenerationStatus("Generating video " + (index + 1) + "/" + generationCount + "...");
          }
          const payload = await input.request("/api/video-generate", {
            prompt: resolvedPrompt,
            promptTextFile: promptTextFile || undefined,
            promptTextSelectionMode,
            negativePrompt,
            frames,
            width,
            height,
            fps,
            steps,
            seed: runSeed,
            workflowPath,
            imageDataUrl,
            imageFileName: imageFile ? imageFile.name : undefined,
            channelId: discordChannelId || undefined,
            dashboardRequestId
          });
          generatedPayloads.push(payload);
          await loadVideoHistory(payload.id);
          applySeedControlAfterGenerate("video-editor-seed", "video-editor-seed-control", runSeed);
        }
      } finally {
        finishGenerationRequest("video", dashboardRequestId);
      }
      const payload = generatedPayloads[generatedPayloads.length - 1];
      setVideoGenerationStatus(generationCount > 1 ? "Generated " + generationCount + " videos successfully." : "Generated " + payload.videoFileName + " successfully.");
      let postSummary = generationCount > 1 ? "Generated " + generationCount + " videos in Video Studio." : "Generated video in Video Studio.";
      if (postTarget.messenger === "discord") {
        postSummary = generationCount > 1 ? "Generated " + generationCount + " videos and posted them to Discord." : "Generated video and posted it to Discord.";
      } else if (postTarget.messenger === "telegram") {
        const videoUrl = input.buildAbsoluteDashboardUrl(input.getGeneratedVideoFileUrl(payload.id, payload.videoFileName));
        await postStudioResultToExternalTarget(
          postTarget,
          "Generated video ready:\n" + videoUrl + "\n\nPrompt: " + resolvedPrompt
        );
        postSummary = generationCount > 1 ? "Generated " + generationCount + " videos and posted the latest to Telegram." : "Generated video and posted it to Telegram.";
      } else if (postTarget.messenger === "whatsapp") {
        const videoUrl = input.buildAbsoluteDashboardUrl(input.getGeneratedVideoFileUrl(payload.id, payload.videoFileName));
        await postStudioResultToExternalTarget(
          postTarget,
          "Generated video ready:\n" + videoUrl + "\n\nPrompt: " + resolvedPrompt
        );
        postSummary = generationCount > 1 ? "Generated " + generationCount + " videos and posted the latest to WhatsApp." : "Generated video and posted it to WhatsApp.";
      }
      input.setOutput(postSummary);
      await input.refreshState();
      if (postTarget.messenger === "discord") {
        await input.loadBotMessages();
      }
    });
    document.getElementById("stop-video-generation-button")?.addEventListener("click", async () => {
      await stopGenerationRequest("video", "Stopping video generation...");
    });
    document.getElementById("generate-model3d-lowpoly-upload-button").addEventListener("click", async () => {
      const file = selectedModel3dLowPolyUploadFile;
      if (!file) {
        return void input.setOutput("Choose a 3D source file first.");
      }
      if (!isSupportedModel3dLowPolyUploadFile(file.name || "")) {
        return void input.setOutput("Low poly generation currently supports uploaded .glb, .gltf, .fbx, and .obj files.");
      }
      const useLlmTargetFaces = document.getElementById("model3d-lowpoly-upload-use-llm").checked;
      const targetFacesRaw = document.getElementById("model3d-lowpoly-upload-target-faces").value.trim();
      const parsedTargetFaces = Number.parseInt(targetFacesRaw, 10);
      if (!useLlmTargetFaces && (!Number.isFinite(parsedTargetFaces) || parsedTargetFaces < 1)) {
        return void input.setOutput("Provide a valid target face count or enable LLM target faces.");
      }
      if (typeof input.setModel3dStatus === "function") {
        input.setModel3dStatus("Generating low poly from uploaded source model...");
      }
      try {
        const dataUrl = await input.readFileAsDataUrl(file);
        const payload = await input.request("/api/model3d-lowpoly-upload", {
          fileName: file.name || "uploaded-model",
          dataUrl,
          llmTargetFaces: useLlmTargetFaces,
          targetFaces: useLlmTargetFaces ? undefined : parsedTargetFaces,
          prompt: "Create a low poly version of uploaded model file " + (file.name || "uploaded-model"),
          context: file.name || "uploaded-model"
        });
        if (typeof input.loadModel3dHistory === "function") {
          await input.loadModel3dHistory(payload.generated && payload.generated.id ? payload.generated.id : "");
        }
        const reasonSuffix = payload.suggestionReason ? (" Reason: " + payload.suggestionReason) : "";
        if (typeof input.setModel3dStatus === "function") {
          input.setModel3dStatus("Low poly model generated successfully.");
        }
        input.setOutput("Low poly model ready with target faces " + payload.targetFaceCount + "." + reasonSuffix);
        await input.refreshState();
      } catch (error) {
        if (typeof input.setModel3dStatus === "function") {
          input.setModel3dStatus("Low poly generation failed.");
        }
        input.setOutput("Failed to generate low poly model: " + ((error && error.message) || "Unknown error"));
      }
    });
    let selectedModel3dTextureSourceImage = null;
    const textureImageInput = document.getElementById("model3d-texture-source-image-file");
    const textureImageName = document.getElementById("model3d-texture-source-image-name");
    const textureImageDropzone = document.getElementById("model3d-texture-source-image-dropzone");
    const setTextureImageName = value => {
      if (textureImageName) textureImageName.textContent = value || "PNG, JPG, or WebP";
      textureImageDropzone?.classList.toggle("has-file", Boolean(value));
    };
    const selectTextureImage = file => {
      selectedModel3dTextureSourceImage = file || null;
      setTextureImageName(selectedModel3dTextureSourceImage?.name || "");
    };
    document.getElementById("model3d-texture-source-image-browse-button").addEventListener("click", () => textureImageInput?.click());
    document.getElementById("model3d-texture-source-image-clear-button").addEventListener("click", () => {
      selectTextureImage(null);
      if (textureImageInput) textureImageInput.value = "";
    });
    textureImageInput?.addEventListener("change", () => {
      selectTextureImage(textureImageInput.files?.[0] || null);
    });
    textureImageDropzone?.addEventListener("click", () => textureImageInput?.click());
    textureImageDropzone?.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        textureImageInput?.click();
      }
    });
    ["dragenter", "dragover"].forEach(eventName => textureImageDropzone?.addEventListener(eventName, event => {
      event.preventDefault();
      textureImageDropzone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach(eventName => textureImageDropzone?.addEventListener(eventName, event => {
      event.preventDefault();
      textureImageDropzone.classList.remove("dragging");
    }));
    textureImageDropzone?.addEventListener("drop", event => {
      const file = event.dataTransfer?.files?.[0] || null;
      if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        input.setOutput("Choose a PNG, JPG, or WebP source image.");
        return;
      }
      selectTextureImage(file);
    });
    document.getElementById("texture-model3d-button").addEventListener("click", async () => {
      const targetMode = document.querySelector("[data-model3d-edit-target].active")?.getAttribute("data-model3d-edit-target") === "upload" ? "upload" : "selected";
      if (!selectedModel3dTextureSourceImage) return void input.setOutput("Choose the source image that should texture the model.");
      const requestBody = {
        sourceImageDataUrl: await input.readFileAsDataUrl(selectedModel3dTextureSourceImage),
        sourceImageFileName: selectedModel3dTextureSourceImage.name || "texture-source.png"
      };
      if (typeof input.setModel3dStatus === "function") input.setModel3dStatus("Texturing 3D model with ComfyUI...");
      try {
        if (targetMode === "upload") {
          const mesh = getSelectedModel3dEditUploadFile()?.file || null;
          if (!mesh) return void input.setOutput("Choose the one 3D model to texture first.");
          requestBody.meshDataUrl = await input.readFileAsDataUrl(mesh);
          requestBody.meshFileName = mesh.name || "texture-source.glb";
        } else {
          const selectedModel = input.getSelectedGeneratedModel?.() || null;
          if (!selectedModel?.id) return void input.setOutput("Select the one generated 3D model to texture first.");
          requestBody.modelId = selectedModel.id;
        }
        const responsePayload = await input.request("/api/model3d-texture", requestBody);
        const generatedId = responsePayload?.generated?.id || "";
        if (generatedId && typeof input.loadModel3dHistory === "function") await input.loadModel3dHistory(generatedId);
        if (typeof input.setModel3dStatus === "function") input.setModel3dStatus("Texture generation finished successfully.");
        input.setOutput("Textured 3D model generated successfully.");
        await input.refreshState();
      } catch (error) {
        if (typeof input.setModel3dStatus === "function") input.setModel3dStatus("Texture generation failed.");
        input.setOutput("Failed to texture 3D model: " + ((error && error.message) || "Unknown error"));
      }
    });
    document.getElementById("apply-model3d-edit-button").addEventListener("click", async () => {
      const payload = getModel3dEditPayload();
      const hasDimensionEdit = payload.dimensionMode === "llm" || (payload.dimensionMode === "manual" && typeof payload.targetHeightMeters === "number");
      const hasMaterialEdit = payload.metallicMode !== "keep" || payload.roughnessMode === "set";
      if (!hasDimensionEdit && !hasMaterialEdit) {
        return void input.setOutput("Choose at least one model edit: dimension, metallic, or roughness.");
      }
      const requestBody = {
        prompt: "Apply studio edits to this 3D model.",
        context: payload.targetMode === "upload"
          ? (getSelectedModel3dEditUploadFile()?.file?.name || "uploaded-model")
          : (input.getSelectedGeneratedModel?.()?.modelFileName || "selected-model"),
        dimensionMode: payload.dimensionMode,
        targetHeightMeters: payload.targetHeightMeters,
        metallicMode: payload.metallicMode,
        roughnessMode: payload.roughnessMode,
        roughnessValue: payload.roughnessValue
      };
      if (typeof input.setModel3dStatus === "function") {
        input.setModel3dStatus("Applying Blender model edit...");
      }
      let responsePayloads = [];
      try {
        if (payload.targetMode === "upload") {
          resetModel3dEditUploadRunStates();
          const uploadTargets = getModel3dEditExecutionUploads();
          if (!uploadTargets.length) {
            return void input.setOutput("Choose one or more uploaded model files first.");
          }
          for (let index = 0; index < uploadTargets.length; index += 1) {
            const target = uploadTargets[index];
            const file = target?.file || null;
            if (!file) {
              continue;
            }
            if (typeof input.setModel3dStatus === "function") {
              input.setModel3dStatus(uploadTargets.length > 1
                ? ("Applying Blender model edit to " + (index + 1) + "/" + uploadTargets.length + ": " + (file.name || "uploaded-model") + "...")
                : "Applying Blender model edit...");
            }
            if (target.id) {
              updateModel3dEditUploadRunState(target.id, "running", "Applying edit...");
            }
            const responsePayload = await input.request("/api/model3d-edit", {
              ...requestBody,
              fileName: file.name || "uploaded-model",
              dataUrl: await input.readFileAsDataUrl(file)
            });
            responsePayloads.push(responsePayload);
            if (target.id) {
              updateModel3dEditUploadRunState(target.id, "success", responsePayload?.generated?.modelFileName || "Edited successfully.");
            }
            const generatedId = responsePayload?.generated?.id || "";
            if (generatedId && typeof input.loadModel3dHistory === "function") {
              await input.loadModel3dHistory(generatedId);
            }
          }
        } else {
          const selectedModel = input.getSelectedGeneratedModel?.() || null;
          if (!selectedModel || !selectedModel.id) {
            return void input.setOutput("Select a generated 3D model first.");
          }
          const responsePayload = await input.request("/api/model3d-edit", {
            ...requestBody,
            modelId: selectedModel.id
          });
          responsePayloads.push(responsePayload);
          const generatedId = responsePayload?.generated?.id || "";
          if (generatedId && typeof input.loadModel3dHistory === "function") {
            await input.loadModel3dHistory(generatedId);
          }
        }
        const responsePayload = responsePayloads[responsePayloads.length - 1] || null;
        if (typeof input.setModel3dStatus === "function") {
          input.setModel3dStatus(responsePayloads.length > 1 ? ("Applied Blender model edits to " + responsePayloads.length + " files.") : "Model edit finished successfully.");
        }
        const decision = responsePayload?.realWorldHeightDecision;
        const decisionLine = responsePayloads.length > 1
          ? ""
          : (decision && typeof decision.heightMeters === "number" ? (" LLM height: " + decision.heightMeters.toFixed(2) + "m.") : "");
        input.setOutput(responsePayloads.length > 1
          ? ("Applied 3D model edit to " + responsePayloads.length + " uploaded files successfully.")
          : ("Applied 3D model edit successfully." + decisionLine));
        await input.refreshState();
      } catch (error) {
        if (payload.targetMode === "upload") {
          const uploadTargets = getModel3dEditExecutionUploads();
          const failedTarget = uploadTargets[responsePayloads.length] || null;
          if (failedTarget?.id) {
            updateModel3dEditUploadRunState(failedTarget.id, "error", ((error && error.message) || "Edit failed."));
          }
        }
        if (typeof input.setModel3dStatus === "function") {
          input.setModel3dStatus("Model edit failed.");
        }
        input.setOutput("Failed to apply 3D model edit: " + ((error && error.message) || "Unknown error"));
      }
    });
  }

  return {
    mergeAiImages,
    clearAiImages,
    renderAiImageList,
    clearAskSkillModelUploads,
    clearAskFileUploads,
    renderAskFileUploads,
    renderAskSkillModelUploads,
    renderAskComposerAttachments,
    mergeModerationImages,
    clearModerationImages,
    renderModerationImageList,
    setImageGenerationStatus,
    setVideoGenerationStatus,
    loadImageHistory,
    loadVideoHistory,
    getSelectedGeneratedImage,
    getSelectedGeneratedImages,
    unloadMediaStudioPreviewForFocus,
    syncImageStudioPreviewTarget,
    refreshStudioPostTargetOptions,
    refreshImageEditSourceOptions,
    bindMediaInputEvents,
    bindGenerationActions
  };
}
