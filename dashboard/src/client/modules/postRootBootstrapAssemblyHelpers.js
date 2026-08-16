function createDashboardPostRootBootstrapAssemblyHelpers(input) {
  const {
    state, splitLines, clearChildren, escapeHtml, formatDateTime, attachDashboardLazyMedia, buildAbsoluteDashboardUrl,
    getGeneratedImageFileUrl, getModel3dFileUrl, request, setOutput, createImageId, readBlobAsDataUrl, downloadModel3dArtifact,
    updateModel3dToolQuickActionState, getDashboardGuildChannelRuntimeHelpers, dashboardAiStudioLayoutHelpers,
    dashboardModel3dQuickActionModalHelpers, lateAutomationBootstrapHelpers, renderMessengerDashboardView,
    syncLlmModelSelectionUi, syncWorkflowLlmModelSelectionUi, setElementValue, setElementChecked, normalizeMessenger,
    getActiveView, isDiscordOnlyView, loadUsers, loadImageHistory, loadAudioHistory, loadVideoHistory, convertImageUrlToPixelArt,
    convertImageUrlToNormalMap, sendImageUrlToToolBySourceToken, clearModerationImages, clearAiImages,
    clearAskSkillModelUploads, clearAskFileUploads, uploadModelImageFile, unloadMediaStudioPreviewForFocus,
    syncAudioPreviewForFocus, refreshActiveArtToolImagePoolBridge, dashboardAiMediaStudioHelpers, switchView,
    dashboardAutomationViewHelpers, readModel3dPostOptions, validateModel3dPostOptions, setWorkflowRightSidebarCollapsed
  } = input;
  const dashboardSettingsRuntimeHelpers = createDashboardSettingsRuntimeHelpers({
    state,
    normalizeMessenger,
    renderMessengerDashboardView,
    renderMessengerRuntimePanel: () => input.renderMessengerRuntimePanel(),
    updateMessengerWorkspaceSummary: () => input.updateMessengerWorkspaceSummary(),
    syncLlmModelSelectionUi,
    syncWorkflowLlmModelSelectionUi,
    setOutput,
    clearChildren,
    escapeHtml,
    formatDateTime,
    setElementValue,
    setElementChecked
  });
  const {
    applyGlobalSettingsToUi, loadGlobalSettingsFromState, saveLlmConnectionSettingsFromUi,
    saveImageLlmConnectionSettingsFromUi, saveModel3dLlmConnectionSettingsFromUi, saveComfyPathSettingsFromUi,
    saveMessagingGlobalSettingsFromUi, saveQuickFfmpegSettingsFromUi, saveMessengerRuntimeSettingsFromUi, loadMessengerRuntimes, controlSelectedMessengerRuntime,
    runInstallerFromUi, describeClientError, setRefreshStatus, setComfyPathSettingsStatus,
    setQuickComfyPathSettingsStatus, setQuickFfmpegSettingsStatus, applyQuickComfyPathSettingsToUi,
    applyQuickFfmpegSettingsToUi, readQuickComfyPathSettingsFromUi
  } = createDashboardSettingsRuntimeProxyHelpers({ helpers: dashboardSettingsRuntimeHelpers });
  const resolveMessengerCompatibleView = typeof input.resolveMessengerCompatibleView === "function"
    ? input.resolveMessengerCompatibleView
    : (nextMessenger, currentView) => resolveDashboardMessengerCompatibleView(nextMessenger, currentView, {
        normalizeMessenger,
        getActiveView,
        isDiscordOnlyView
      });
  const resolveRequestedViewForMessenger = typeof input.resolveRequestedViewForMessenger === "function"
    ? input.resolveRequestedViewForMessenger
    : view => resolveDashboardRequestedViewForMessenger(view, state, { isDiscordOnlyView });
  const formatImagePostProcessingRecipes = recipes => formatDashboardImagePostProcessingRecipes(recipes);
  const parseImagePostProcessingRecipes = value => parseDashboardImagePostProcessingRecipes(value);
  const dashboardConsoleHelpers = typeof createDashboardConsoleHelpers === "function"
    ? createDashboardConsoleHelpers({ request, describeClientError, formatDateTime })
    : null;
  const getBotShortLabel = tag => getDashboardBotShortLabel(tag);
  const dashboardShellLayoutHelpers = input.dashboardShellLayoutHelpers || (typeof createDashboardShellLayoutHelpers === "function"
    ? createDashboardShellLayoutHelpers({ state })
    : null);
  const dashboardWorkspacePanelHelpers = input.dashboardWorkspacePanelHelpers || (typeof createDashboardWorkspacePanelHelpers === "function"
    ? createDashboardWorkspacePanelHelpers({
        state,
        setDetailsPaneVisible: visible => input.setDetailsPaneVisible(visible)
      })
    : null);
  const dashboardUserSearchHandlers = input.dashboardUserSearchHandlers || (typeof createDashboardUserSearchHandlers === "function"
    ? createDashboardUserSearchHandlers({ loadUsers })
    : null);
  const dashboardAiActionHelpers = typeof createDashboardAiActionHelpers === "function"
    ? createDashboardAiActionHelpers({
        state,
        request,
        setOutput,
        renderMarkdownInto: (...args) => input.renderMarkdownInto(...args),
        refreshState: (...args) => getDashboardGuildChannelRuntimeHelpers().refreshState(...args),
        loadImageHistory,
        loadModel3dHistory: (...args) => dashboardModel3dViewerHelpers.loadModel3dHistory(...args),
        loadAudioHistory,
        loadVideoHistory,
        loadChannels: (...args) => input.loadChannels(...args),
        convertImageUrlToPixelArt,
        convertImageUrlToNormalMap,
        sendImageUrlToToolBySourceToken,
        renderGuildChannelPlan: (...args) => getDashboardGuildChannelRuntimeHelpers().renderGuildChannelPlan(...args),
        renderModerationSimulation: (...args) => getDashboardGuildChannelRuntimeHelpers().renderModerationSimulation(...args),
        clearModerationImages,
        clearAiImages,
        renderAskComposerAttachments: typeof input.renderAskComposerAttachments === "function"
          ? (...args) => input.renderAskComposerAttachments(...args)
          : function renderAskComposerAttachmentsFallback() {},
        clearAskSkillModelUploads,
        clearAskFileUploads
      })
    : null;
  const bindAiActions = dashboardAiActionHelpers?.bindActions || function bindAiActionsFallback() {};
  const dashboardImagePoolHelpers = typeof createDashboardImagePoolHelpers === "function"
    ? createDashboardImagePoolHelpers({
        state,
        request,
        clearChildren,
        splitLines,
        setOutput,
        uploadModelImageFile,
        buildAbsoluteDashboardUrl,
        getSelectedGeneratedImage: () => dashboardModel3dRuntimeStateHelpers.getSelectedGeneratedImage(),
        getSelectedGeneratedImages: () => dashboardModel3dRuntimeStateHelpers.getSelectedGeneratedImages(),
        getGeneratedImageFileUrl,
        getCurrentModelSource: () => document.getElementById("model3d-image-source")?.value || "",
        openResourcesOverlay: detail => window.dispatchEvent(new CustomEvent("dashboard:open-resources-overlay", { detail }))
      })
    : null;
  const getImagePoolById = dashboardImagePoolHelpers?.getImagePoolById || function getImagePoolByIdFallback() {
    return null;
  };
  const loadImagePoolsBase = dashboardImagePoolHelpers?.loadImagePools || async function loadImagePoolsFallbackBase() {};
  const loadImagePools = async preferredPoolId => {
    await loadImagePoolsBase(preferredPoolId);
    state.imagePoolDataLoaded = true;
    dashboardAiMediaStudioHelpers?.refreshImageEditSourceOptions?.();
    renderModel3dPoolSelectionList();
    refreshActiveArtToolImagePoolBridge();
  };
  const dashboardModel3dBootstrapAssemblyHelpers = typeof createDashboardModel3dBootstrapAssemblyHelpers === "function"
    ? createDashboardModel3dBootstrapAssemblyHelpers({
        state,
        splitLines,
        clearChildren,
        escapeHtml,
        formatDateTime,
        attachDashboardLazyMedia,
        buildAbsoluteDashboardUrl,
        getGeneratedImageFileUrl,
        getImagePoolById: poolId => {
          const targetId = String(poolId || "").trim();
          if (!targetId || !Array.isArray(state.imagePools)) {
            return null;
          }
          return state.imagePools.find(pool => pool.id === targetId) || null;
        },
        getModel3dFileUrl,
        request,
        setOutput,
        createImageId,
        readBlobAsDataUrl,
        downloadModel3dArtifact,
        updateModel3dToolQuickActionState,
        describeClientError,
        getDashboardGuildChannelRuntimeHelpers,
        readModel3dPostOptions,
        validateModel3dPostOptions,
        dashboardAiStudioLayoutHelpers,
        setWorkflowRightSidebarCollapsed,
        dashboardModel3dQuickActionModalHelpers
      })
    : null;
  const {
    dashboardModel3dRuntimeStateHelpers = null,
    updateModel3dEditSelectedModelName = function updateModel3dEditSelectedModelNameFallback() {},
    updateModel3dEditRoughnessValue = function updateModel3dEditRoughnessValueFallback() {},
    getSelectedGeneratedModel = function getSelectedGeneratedModelFallback() { return null; },
    getSelectedGeneratedImage = function getSelectedGeneratedImageFallback() { return null; },
    getSelectedGeneratedVideo = function getSelectedGeneratedVideoFallback() { return null; },
    dashboardModel3dSourceHelpers = null,
    inferModelImageFileNameHint,
    normalizeModel3dLocalImageSourcePath,
    extractUploadedModelImageFileNameFromSource,
    extractGeneratedImagePathFromSource,
    resolveModel3dSourcePreviewUrl,
    getModel3dUploadSources,
    getModel3dSelectedPool,
    syncModel3dSelectedPoolSources,
    renderModel3dSourceList,
    renderModel3dUploadSourceList,
    renderModel3dPoolSelectionList,
    updateModel3dSourceHint,
    setModel3dGenerationBusy,
    collectModel3dSourceCandidates,
    readModel3dLowPolyOptionsFromUi,
    summarizeMetallicDecision,
    summarizeRealWorldHeightDecision,
    postGeneratedModelToExternalMessengerFromStudio,
    dashboardModel3dInspectorHelpers = null,
    dashboardModel3dViewerHelpers = null,
    model3dViewer = null,
    unloadModel3dViewerPreview,
    activateModel3dViewerPreview,
    handleModel3dLowPolyUploadSourceChange,
    loadModel3dHistory,
    scheduleModel3dHistoryRefresh,
    renderModel3dHistory,
    renderModel3dPreviewMedia,
    getModel3dViewerTarget,
    resolveModel3dPreviewMedia,
    renderModel3dViewer,
    renderModel3dPreviewGifDataUrl,
    exportModel3dPreviewGif,
    setModel3dThreeVariant,
    updateModel3dThreeVariantUi,
    setModel3dViewerWireframeEnabled,
    setModel3dViewerMetallicEnabled,
    updateModel3dViewerMaterialToggleButtons,
    updateModel3dViewerRoughnessUi,
    setModel3dViewerRoughness,
    setModel3dViewerTextureEnabled,
    setModel3dViewerMaterialMode,
    setModel3dViewerFlatShadingEnabled,
    setModel3dViewerGridEnabled,
    setModel3dViewerSkyboxEnabled,
    setModel3dViewerRigVisible,
    setModel3dViewerAxisMode,
    getModel3dPreviewRenderOptions,
    applyModel3dPreviewViewSettings,
    describeModel3dScaleDecision,
    setModel3dStatus,
    getModel3dStatusText,
    setModel3dPreviewStatus,
    setModel3dThreeStatus,
    dashboardModel3dViewportModalHelpers = null,
    updateModel3dGifExportBackgroundField,
    openModel3dGifExportModal,
    closeModel3dGifExportModal,
    readModel3dGifExportOptions,
    openSelectedModelInBlender,
    dashboardModel3dStudioActionHelpers,
    requestModel3dGenerationWithPreviewStream,
    runModel3dGenerationFromStudio,
    runModel3dSeparateByLoosePartsForSelectedModel,
    runLowPolyGenerationForSelectedModel,
    runModel3dLlmScaleForSelectedModel,
    renderAutoRigVerification,
    openAutoRigPanelForSelectedModel,
    runAutoRigPreviewForSelectedModel,
    finalizeAutoRigForSelectedModel,
    dashboardModel3dViewportControlHelpers = null,
    dashboardModel3dStudioEventBindingHelpers = null
  } = dashboardModel3dBootstrapAssemblyHelpers || {};
  const dashboardAiWorkflowDataHelpers = typeof createDashboardAiWorkflowDataHelpers === "function"
    ? createDashboardAiWorkflowDataHelpers({
        state,
        loadImagePools,
        loadModel3dHistory,
        loadImageHistory,
        loadAudioHistory,
        loadVideoHistory,
        unloadMediaStudioPreviewForFocus,
        syncAudioPreviewForFocus
      })
    : null;
  const {
    unloadAudioElementPreview,
    unloadInactiveStudioWorkflowPreviews,
    ensureImagePoolDataLoaded,
    ensureAiWorkflowDataLoaded
  } = createDashboardAiWorkflowDataProxyHelpers({ helpers: dashboardAiWorkflowDataHelpers });
  const bindImagePoolEvents = dashboardImagePoolHelpers?.bindEvents || function bindImagePoolEventsFallback() {};
  const {
    bindAutomationStudioEvents,
    loadAutomationPresets,
    refreshAutomationTextSources
  } = createDashboardAutomationBootstrapProxyHelpers({ helpers: lateAutomationBootstrapHelpers });
  const dashboardAutomationTextSourceHelpers = typeof createDashboardAutomationTextSourceHelpers === "function"
    ? createDashboardAutomationTextSourceHelpers({
        state,
        request,
        clearChildren,
        escapeHtml,
        formatDateTime,
        setOutput,
        switchView,
        switchAutomationPanel: panel => dashboardAutomationViewHelpers.switchAutomationPanel(panel),
        refreshAutomationTextSources,
        openResourcesOverlay: detail => window.dispatchEvent(new CustomEvent("dashboard:open-resources-overlay", { detail })),
        closeResourcesOverlay: () => window.dispatchEvent(new CustomEvent("dashboard:close-resources-overlay"))
      })
    : null;
  const fillPresetSelect = dashboardAutomationTextSourceHelpers?.fillPresetSelect || function fillPresetSelectFallback() {};
  const setMultiSelectValues = dashboardAutomationTextSourceHelpers?.setMultiSelectValues || function setMultiSelectValuesFallback() {};
  const addMultiSelectValues = dashboardAutomationTextSourceHelpers?.addMultiSelectValues || function addMultiSelectValuesFallback() {};
  const getMultiSelectValues = dashboardAutomationTextSourceHelpers?.getMultiSelectValues || function getMultiSelectValuesFallback() {
    return [];
  };
  const prefillAutomationTextSource = dashboardAutomationTextSourceHelpers?.prefillAutomationTextSource || function prefillAutomationTextSourceFallback() {};
  const loadAutomationTextSources = dashboardAutomationTextSourceHelpers?.loadAutomationTextSources || async function loadAutomationTextSourcesFallback() {};
  const updateAutomationTextPromptPreset = dashboardAutomationTextSourceHelpers?.updateAutomationTextPromptPreset || function updateAutomationTextPromptPresetFallback() {};
  const bindAutomationTextSourceEvents = dashboardAutomationTextSourceHelpers?.bindEvents || function bindAutomationTextSourceEventsFallback() {};
  return {
    dashboardSettingsRuntimeHelpers,
    applyGlobalSettingsToUi,
    loadGlobalSettingsFromState,
    saveLlmConnectionSettingsFromUi,
    saveImageLlmConnectionSettingsFromUi,
    saveModel3dLlmConnectionSettingsFromUi,
    saveComfyPathSettingsFromUi,
    saveMessagingGlobalSettingsFromUi,
    saveQuickFfmpegSettingsFromUi,
    saveMessengerRuntimeSettingsFromUi,
    loadMessengerRuntimes,
    controlSelectedMessengerRuntime,
    runInstallerFromUi,
    describeClientError,
    setRefreshStatus,
    setComfyPathSettingsStatus,
    setQuickComfyPathSettingsStatus,
    setQuickFfmpegSettingsStatus,
    applyQuickComfyPathSettingsToUi,
    applyQuickFfmpegSettingsToUi,
    readQuickComfyPathSettingsFromUi,
    resolveMessengerCompatibleView,
    resolveRequestedViewForMessenger,
    formatImagePostProcessingRecipes,
    parseImagePostProcessingRecipes,
    dashboardConsoleHelpers,
    getBotShortLabel,
    dashboardShellLayoutHelpers,
    dashboardWorkspacePanelHelpers,
    dashboardUserSearchHandlers,
    dashboardAiActionHelpers,
    bindAiActions,
    dashboardImagePoolHelpers,
    getImagePoolById,
    loadImagePoolsBase,
    loadImagePools,
    dashboardModel3dBootstrapAssemblyHelpers,
    dashboardModel3dRuntimeStateHelpers,
    updateModel3dEditSelectedModelName,
    updateModel3dEditRoughnessValue,
    getSelectedGeneratedModel,
    getSelectedGeneratedImage,
    getSelectedGeneratedVideo,
    dashboardModel3dSourceHelpers,
    inferModelImageFileNameHint,
    normalizeModel3dLocalImageSourcePath,
    extractUploadedModelImageFileNameFromSource,
    extractGeneratedImagePathFromSource,
    resolveModel3dSourcePreviewUrl,
    getModel3dUploadSources,
    getModel3dSelectedPool,
    syncModel3dSelectedPoolSources,
    renderModel3dSourceList,
    renderModel3dUploadSourceList,
    renderModel3dPoolSelectionList,
    updateModel3dSourceHint,
    setModel3dGenerationBusy,
    collectModel3dSourceCandidates,
    readModel3dLowPolyOptionsFromUi,
    summarizeMetallicDecision,
    summarizeRealWorldHeightDecision,
    postGeneratedModelToExternalMessengerFromStudio,
    dashboardModel3dInspectorHelpers,
    dashboardModel3dViewerHelpers,
    model3dViewer,
    unloadModel3dViewerPreview,
    activateModel3dViewerPreview,
    handleModel3dLowPolyUploadSourceChange,
    loadModel3dHistory,
    scheduleModel3dHistoryRefresh,
    renderModel3dHistory,
    renderModel3dPreviewMedia,
    getModel3dViewerTarget,
    resolveModel3dPreviewMedia,
    renderModel3dViewer,
    renderModel3dPreviewGifDataUrl,
    exportModel3dPreviewGif,
    setModel3dThreeVariant,
    updateModel3dThreeVariantUi,
    setModel3dViewerWireframeEnabled,
    setModel3dViewerMetallicEnabled,
    updateModel3dViewerMaterialToggleButtons,
    updateModel3dViewerRoughnessUi,
    setModel3dViewerRoughness,
    setModel3dViewerTextureEnabled,
    setModel3dViewerMaterialMode,
    setModel3dViewerFlatShadingEnabled,
    setModel3dViewerGridEnabled,
    setModel3dViewerSkyboxEnabled,
    setModel3dViewerRigVisible,
    setModel3dViewerAxisMode,
    getModel3dPreviewRenderOptions,
    applyModel3dPreviewViewSettings,
    describeModel3dScaleDecision,
    setModel3dStatus,
    getModel3dStatusText,
    setModel3dPreviewStatus,
    setModel3dThreeStatus,
    dashboardModel3dViewportModalHelpers,
    updateModel3dGifExportBackgroundField,
    openModel3dGifExportModal,
    closeModel3dGifExportModal,
    readModel3dGifExportOptions,
    openSelectedModelInBlender,
    dashboardModel3dStudioActionHelpers,
    requestModel3dGenerationWithPreviewStream,
    runModel3dGenerationFromStudio,
    runModel3dSeparateByLoosePartsForSelectedModel,
    runLowPolyGenerationForSelectedModel,
    runModel3dLlmScaleForSelectedModel,
    renderAutoRigVerification,
    openAutoRigPanelForSelectedModel,
    runAutoRigPreviewForSelectedModel,
    finalizeAutoRigForSelectedModel,
    dashboardModel3dViewportControlHelpers,
    dashboardModel3dStudioEventBindingHelpers,
    dashboardAiWorkflowDataHelpers,
    unloadAudioElementPreview,
    unloadInactiveStudioWorkflowPreviews,
    ensureImagePoolDataLoaded,
    ensureAiWorkflowDataLoaded,
    bindImagePoolEvents,
    bindAutomationStudioEvents,
    loadAutomationPresets,
    refreshAutomationTextSources,
    dashboardAutomationTextSourceHelpers,
    fillPresetSelect,
    setMultiSelectValues,
    addMultiSelectValues,
    getMultiSelectValues,
    prefillAutomationTextSource,
    loadAutomationTextSources,
    updateAutomationTextPromptPreset,
    bindAutomationTextSourceEvents
  };
}
