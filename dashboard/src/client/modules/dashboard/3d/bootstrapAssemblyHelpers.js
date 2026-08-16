function createDashboardModel3dBootstrapAssemblyHelpers(input) {
  const {
    state, splitLines, clearChildren, escapeHtml, formatDateTime, attachDashboardLazyMedia, buildAbsoluteDashboardUrl,
    getGeneratedImageFileUrl, getImagePoolById, getModel3dFileUrl, request, setOutput, createImageId, readBlobAsDataUrl,
    downloadModel3dArtifact, updateModel3dToolQuickActionState, describeClientError, getDashboardGuildChannelRuntimeHelpers,
    readModel3dPostOptions, validateModel3dPostOptions, dashboardAiStudioLayoutHelpers, setWorkflowRightSidebarCollapsed,
    dashboardModel3dQuickActionModalHelpers
  } = input;
  const dashboardModel3dRuntimeStateHelpers = typeof createDashboardThreeDRuntimeStateHelpers === "function"
    ? createDashboardThreeDRuntimeStateHelpers({ state })
    : null;
  const updateModel3dEditSelectedModelName = dashboardModel3dRuntimeStateHelpers
    ? () => dashboardModel3dRuntimeStateHelpers.updateModel3dEditSelectedModelName()
    : function updateModel3dEditSelectedModelNameFallback() {};
  const updateModel3dEditRoughnessValue = dashboardModel3dRuntimeStateHelpers
    ? () => dashboardModel3dRuntimeStateHelpers.updateModel3dEditRoughnessValue()
    : function updateModel3dEditRoughnessValueFallback() {};
  const getSelectedGeneratedModel = dashboardModel3dRuntimeStateHelpers
    ? () => dashboardModel3dRuntimeStateHelpers.getSelectedGeneratedModel()
    : function getSelectedGeneratedModelFallback() {
      return null;
    };
  const getSelectedGeneratedModels = dashboardModel3dRuntimeStateHelpers
    ? () => dashboardModel3dRuntimeStateHelpers.getSelectedGeneratedModels()
    : function getSelectedGeneratedModelsFallback() {
      return getSelectedGeneratedModel() ? [getSelectedGeneratedModel()] : [];
    };
  const getSelectedGeneratedImage = dashboardModel3dRuntimeStateHelpers
    ? () => dashboardModel3dRuntimeStateHelpers.getSelectedGeneratedImage()
    : function getSelectedGeneratedImageFallback() {
      return null;
    };
  const getSelectedGeneratedVideo = dashboardModel3dRuntimeStateHelpers
    ? () => dashboardModel3dRuntimeStateHelpers.getSelectedGeneratedVideo()
    : function getSelectedGeneratedVideoFallback() {
      return null;
    };
  const dashboardModel3dSourceHelpers = createDashboardThreeDSourceHelpers({
    state,
    splitLines,
    clearChildren,
    escapeHtml,
    buildAbsoluteDashboardUrl,
    getGeneratedImageFileUrl,
    getImagePoolById,
    getModel3dFileUrl,
    request
  });
  const {
    inferModelImageFileNameHint, normalizeModel3dLocalImageSourcePath, extractUploadedModelImageFileNameFromSource,
    extractGeneratedImagePathFromSource, resolveModel3dSourcePreviewUrl, getModel3dUploadSources, getModel3dSelectedPool,
    syncModel3dSelectedPoolSources, renderModel3dSourceList, renderModel3dUploadSourceList, renderModel3dPoolSelectionList,
    updateModel3dSourceHint, setModel3dGenerationBusy, collectModel3dSourceCandidates, readModel3dLowPolyOptionsFromUi,
    summarizeMetallicDecision, summarizeRealWorldHeightDecision, postGeneratedModelToExternalMessengerFromStudio
  } = createDashboardModel3dSourceProxyHelpers({ helpers: dashboardModel3dSourceHelpers });
  const dashboardModel3dInspectorHelpers = createDashboardThreeDInspectorHelpers({
    state,
    request,
    getSelectedGeneratedModel,
    setModel3dStatus: text => dashboardModel3dViewerHelpers.setModel3dStatus(text),
    setOutput
  });
  const dashboardModel3dViewerHelpers = createDashboardThreeDViewerHelpers({
    state,
    clearChildren,
    formatDateTime,
    attachDashboardLazyMedia,
    buildAbsoluteDashboardUrl,
    getModel3dFileUrl,
    getSelectedGeneratedModel,
    request,
    setOutput,
    createImageId,
    readBlobAsDataUrl,
    downloadModel3dArtifact,
    updateModel3dEditSelectedModelName,
    updateModel3dToolQuickActionState,
    inspectSelectedModel: inputValue => dashboardModel3dInspectorHelpers.inspectSelectedModel(inputValue),
    renderModel3dInspection: (record, inspection) => dashboardModel3dInspectorHelpers.renderInspection(record, inspection),
    invalidateModelInspection: modelId => dashboardModel3dInspectorHelpers.invalidateModelInspection(modelId)
  });
  dashboardModel3dRuntimeStateHelpers?.bindViewerHelpers(dashboardModel3dViewerHelpers);
  const model3dViewer = dashboardModel3dViewerHelpers.model3dViewer;
  const {
    unloadModel3dViewerPreview, activateModel3dViewerPreview, handleModel3dLowPolyUploadSourceChange,
    loadModel3dHistory, scheduleModel3dHistoryRefresh, renderModel3dHistory, renderModel3dPreviewMedia,
    getModel3dViewerTarget, resolveModel3dPreviewMedia, renderModel3dViewer, renderModel3dPreviewGifDataUrl,
    exportModel3dPreviewGif, setModel3dThreeVariant, updateModel3dThreeVariantUi, setModel3dViewerWireframeEnabled,
    setModel3dViewerMetallicEnabled, updateModel3dViewerMaterialToggleButtons, updateModel3dViewerRoughnessUi,
    setModel3dViewerRoughness, setModel3dViewerTextureEnabled, setModel3dViewerMaterialMode,
    setModel3dViewerFlatShadingEnabled, setModel3dViewerGridEnabled, setModel3dViewerSkyboxEnabled,
    setModel3dViewerRigVisible, setModel3dViewerAxisMode, getModel3dPreviewRenderOptions, applyModel3dPreviewViewSettings
  } = createDashboardModel3dViewerProxyHelpers({ helpers: dashboardModel3dViewerHelpers });
  const dashboardModel3dSendDestinationHelpers = typeof createDashboardModel3dSendDestinationHelpers === "function"
    ? createDashboardModel3dSendDestinationHelpers({
        request,
        clearChildren,
        setOutput,
        getSelectedGeneratedModel,
        getModel3dViewerTarget,
        getModel3dFileUrl,
        buildAbsoluteDashboardUrl
      })
    : null;
  const describeModel3dScaleDecision = dashboardModel3dRuntimeStateHelpers
    ? result => dashboardModel3dRuntimeStateHelpers.describeModel3dScaleDecision(result)
    : result => dashboardModel3dViewerHelpers.describeModel3dScaleDecision(result);
  const setModel3dStatus = dashboardModel3dRuntimeStateHelpers
    ? text => dashboardModel3dRuntimeStateHelpers.setModel3dStatus(text)
    : text => dashboardModel3dViewerHelpers.setModel3dStatus(text);
  const getModel3dStatusText = dashboardModel3dRuntimeStateHelpers
    ? () => dashboardModel3dRuntimeStateHelpers.getModel3dStatusText()
    : () => dashboardModel3dViewerHelpers.getModel3dStatusText();
  const setModel3dPreviewStatus = dashboardModel3dRuntimeStateHelpers
    ? text => dashboardModel3dRuntimeStateHelpers.setModel3dPreviewStatus(text)
    : text => dashboardModel3dViewerHelpers.setModel3dPreviewStatus(text);
  const setModel3dThreeStatus = dashboardModel3dRuntimeStateHelpers
    ? text => dashboardModel3dRuntimeStateHelpers.setModel3dThreeStatus(text)
    : text => dashboardModel3dViewerHelpers.setModel3dThreeStatus(text);
  const dashboardModel3dViewportModalHelpers = typeof createDashboardThreeDViewportModalHelpers === "function"
    ? createDashboardThreeDViewportModalHelpers({
        state,
        request,
        setOutput,
        setModel3dStatus,
        getSelectedGeneratedModel,
        getSelectedGeneratedModels,
        getModel3dViewerTarget,
        getModel3dPreviewRenderOptions,
        getModel3dFileUrl,
        escapeHtml
      })
    : null;
  const {
    updateModel3dGifExportBackgroundField,
    openModel3dGifExportModal,
    closeModel3dGifExportModal,
    readModel3dGifExportOptions,
    openSelectedModelInBlender,
    openModel3dShareOverlay
  } = createDashboardModel3dViewportModalProxyHelpers({ helpers: dashboardModel3dViewportModalHelpers });
  const normalizeModel3dPreviewRenderMode = value => {
    const mode = String(value || "").trim();
    return ["turntable", "current", "front", "back", "left", "right", "top", "three-quarter"].includes(mode) ? mode : "current";
  };
  const normalizeModel3dPreviewProjection = value => {
    const projection = String(value || "").trim();
    return projection === "perspective" || projection === "orthographic" || projection === "current" ? projection : "current";
  };
  const dashboardModel3dStudioActionHelpers = createDashboardThreeDStudioActionHelpers({
    state,
    request,
    setOutput,
    setModel3dStatus,
    setModel3dThreeStatus,
    setModel3dGenerationBusy,
    describeClientError,
    describeModel3dScaleDecision,
    loadModel3dHistory,
    scheduleModel3dHistoryRefresh,
    renderModel3dViewer,
    refreshState: (...args) => getDashboardGuildChannelRuntimeHelpers().refreshState(...args),
    loadBotMessages: (...args) => getDashboardGuildChannelRuntimeHelpers().loadBotMessages(...args),
    getSelectedGeneratedModel,
    collectModel3dSourceCandidates,
    readModel3dPostOptions,
    validateModel3dPostOptions,
    readModel3dLowPolyOptionsFromUi,
    inferModelImageFileNameHint,
    summarizeMetallicDecision,
    summarizeRealWorldHeightDecision,
    postGeneratedModelToExternalMessengerFromStudio,
    escapeHtml,
    buildAbsoluteDashboardUrl,
    getModel3dFileUrl,
    switchModel3dStudioTab: tab => dashboardAiStudioLayoutHelpers.switchModel3dStudioTab(tab),
    setWorkflowRightSidebarCollapsed
  });
  const {
    requestModel3dGenerationWithPreviewStream,
    runModel3dGenerationFromStudio,
    runModel3dSeparateByLoosePartsForSelectedModel,
    runLowPolyGenerationForSelectedModel,
    runModel3dLlmScaleForSelectedModel,
    renderAutoRigVerification,
    openAutoRigPanelForSelectedModel,
    runAutoRigPreviewForSelectedModel,
    finalizeAutoRigForSelectedModel
  } = createDashboardModel3dStudioActionProxyHelpers({ helpers: dashboardModel3dStudioActionHelpers });
  const dashboardModel3dViewportControlHelpers = typeof createDashboardThreeDViewportControlHelpers === "function"
    ? createDashboardThreeDViewportControlHelpers({
        state,
        normalizeModel3dPreviewRenderMode,
        normalizeModel3dPreviewProjection,
        applyModel3dPreviewViewSettings,
        getModel3dPreviewRenderOptions,
        activateModel3dViewerPreview,
        setModel3dThreeStatus,
        setModel3dViewerTextureEnabled,
        setModel3dViewerWireframeEnabled,
        setModel3dViewerGridEnabled,
        openModel3dGifExportModal,
        closeModel3dGifExportModal,
        readModel3dGifExportOptions,
        exportModel3dPreviewGif,
        updateModel3dGifExportBackgroundField,
        openSelectedModelInBlender,
        openModel3dShareOverlay,
        runModel3dLlmScaleForSelectedModel,
        runModel3dSeparateByLoosePartsForSelectedModel,
        stopModel3dGeneration: () => dashboardModel3dStudioActionHelpers.stopModel3dGeneration()
      })
    : null;
  const dashboardModel3dStudioEventBindingHelpers = typeof createDashboardThreeDStudioEventBindingHelpers === "function"
    ? createDashboardThreeDStudioEventBindingHelpers({
        state,
        model3dViewer,
        request,
        refreshState: (...args) => getDashboardGuildChannelRuntimeHelpers().refreshState(...args),
        getSelectedGeneratedModel,
        setOutput,
        setModel3dStatus,
        setModel3dThreeStatus,
        runModel3dGenerationFromStudio,
        runLowPolyGenerationForSelectedModel,
        openAutoRigPanelForSelectedModel,
        runAutoRigPreviewForSelectedModel,
        finalizeAutoRigForSelectedModel,
        renderAutoRigVerification,
        activateModel3dViewerPreview,
        setModel3dThreeVariant,
        setModel3dViewerWireframeEnabled,
        setModel3dViewerMetallicEnabled,
        updateModel3dViewerRoughnessUi,
        setModel3dViewerRoughness,
        setModel3dViewerTextureEnabled,
        setModel3dViewerMaterialMode,
        setModel3dViewerFlatShadingEnabled,
        setModel3dViewerGridEnabled,
        setModel3dViewerSkyboxEnabled,
        setModel3dViewerRigVisible,
        setModel3dViewerAxisMode,
        runModel3dLlmScaleForSelectedModel,
        dashboardModel3dStudioActionHelpers,
        dashboardModel3dQuickActionModalHelpers,
        dashboardModel3dInspectorHelpers,
        dashboardModel3dViewportControlHelpers,
        dashboardModel3dSendDestinationHelpers,
        dashboardAiStudioLayoutHelpers
      })
    : null;
  return {
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
    openModel3dShareOverlay,
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
    dashboardModel3dSendDestinationHelpers,
    dashboardModel3dStudioEventBindingHelpers
  };
}
