function createDashboardAudioUiRuntime(input) {
  const { state, request, clearChildren, escapeHtml, formatDateTime } = input;
  const dashboardAudioUiHelpers = typeof createDashboardAudioUiHelpers === "function"
    ? createDashboardAudioUiHelpers(state, { request, clearChildren, escapeHtml, formatDateTime })
    : null;
  return {
    dashboardAudioUiHelpers,
    setAudioGenerationStatus: dashboardAudioUiHelpers ? dashboardAudioUiHelpers.setAudioGenerationStatus : function setAudioGenerationStatusFallback() {},
    setMusicGenerationStatus: dashboardAudioUiHelpers ? dashboardAudioUiHelpers.setMusicGenerationStatus : function setMusicGenerationStatusFallback() {},
    loadAudioHistory: dashboardAudioUiHelpers ? dashboardAudioUiHelpers.loadAudioHistory : async function loadAudioHistoryFallback() {},
    syncAudioPreviewForFocus: dashboardAudioUiHelpers ? dashboardAudioUiHelpers.syncAudioPreviewForFocus : function syncAudioPreviewForFocusFallback() {}
  };
}

function createDashboardAiMediaStudioRuntime(input) {
  const {
    state,
    request,
    setOutput,
    clearChildren,
    escapeHtml,
    formatDateTime,
    renderImageList,
    filesToAiImages,
    readFileAsDataUrl,
    collectDroppedImages,
    collectPastedImages,
    attachDashboardLazyMedia,
    getGeneratedImageFileUrl,
    getGeneratedVideoFileUrl,
    buildAbsoluteDashboardUrl,
    getSelectedGeneratedModel,
    getToolQuickActionSelection,
    updateVideoToolQuickActionState,
    openAiSection,
    convertImageUrlToPixelArt,
    convertImageUrlToNormalMap,
    openImageInPixelArtTool,
    openImageInNormalMapTool,
    handleModel3dLowPolyUploadSourceChange,
    setModel3dStatus,
    loadModel3dHistory,
    setAudioGenerationStatus,
    setMusicGenerationStatus,
    loadAudioHistory,
    stateImagePools,
    loadBotMessages,
    refreshState
  } = input;
  const dashboardAiMediaStudioHelpers = typeof createDashboardAiMediaStudioHelpers === "function"
    ? createDashboardAiMediaStudioHelpers({
        state,
        request,
        setOutput,
        clearChildren,
        escapeHtml,
        formatDateTime,
        renderImageList,
        filesToAiImages,
        readFileAsDataUrl,
        collectDroppedImages,
        collectPastedImages,
        attachDashboardLazyMedia,
        getGeneratedImageFileUrl,
        getGeneratedVideoFileUrl,
        buildAbsoluteDashboardUrl,
        getSelectedGeneratedModel,
        getToolQuickActionSelection: typeof getToolQuickActionSelection === "function" ? getToolQuickActionSelection : null,
        updateVideoToolQuickActionState: typeof updateVideoToolQuickActionState === "function" ? updateVideoToolQuickActionState : null,
        openAiSection,
        getImagePoolById: poolId => {
          const targetId = String(poolId || "").trim();
          if (!targetId || !Array.isArray(stateImagePools())) {
            return null;
          }
          return stateImagePools().find(pool => pool.id === targetId) || null;
        },
        convertImageUrlToPixelArt,
        convertImageUrlToNormalMap,
        openImageInPixelArtTool,
        openImageInNormalMapTool,
        onModel3dLowPolyUploadSourceChange: handleModel3dLowPolyUploadSourceChange,
        setModel3dStatus,
        loadModel3dHistory,
        setAudioGenerationStatus,
        setMusicGenerationStatus,
        loadAudioHistory,
        loadBotMessages: (...args) => loadBotMessages(...args),
        refreshState: (...args) => refreshState(...args)
      })
    : null;
  return {
    dashboardAiMediaStudioHelpers,
    mergeAiImages: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.mergeAiImages : function mergeAiImagesFallback() {},
    clearAiImages: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.clearAiImages : function clearAiImagesFallback() {},
    renderAiImageList: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.renderAiImageList : function renderAiImageListFallback() {},
    renderAskComposerAttachments: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.renderAskComposerAttachments : function renderAskComposerAttachmentsFallback() {},
    clearAskSkillModelUploads: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.clearAskSkillModelUploads : function clearAskSkillModelUploadsFallback() {},
    clearAskFileUploads: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.clearAskFileUploads : function clearAskFileUploadsFallback() {},
    mergeModerationImages: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.mergeModerationImages : function mergeModerationImagesFallback() {},
    clearModerationImages: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.clearModerationImages : function clearModerationImagesFallback() {},
    renderModerationImageList: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.renderModerationImageList : function renderModerationImageListFallback() {},
    setImageGenerationStatus: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.setImageGenerationStatus : function setImageGenerationStatusFallback() {},
    loadImageHistory: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.loadImageHistory : async function loadImageHistoryFallback() {},
    setVideoGenerationStatus: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.setVideoGenerationStatus : function setVideoGenerationStatusFallback() {},
    loadVideoHistory: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.loadVideoHistory : async function loadVideoHistoryFallback() {},
    unloadMediaStudioPreviewForFocus: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.unloadMediaStudioPreviewForFocus : function unloadMediaStudioPreviewForFocusFallback() {},
    refreshStudioPostTargetOptions: dashboardAiMediaStudioHelpers ? dashboardAiMediaStudioHelpers.refreshStudioPostTargetOptions : function refreshStudioPostTargetOptionsFallback() {},
    bindAiMediaStudioEvents: dashboardAiMediaStudioHelpers
      ? function bindAiMediaStudioEvents() {
          dashboardAiMediaStudioHelpers.bindMediaInputEvents();
          dashboardAiMediaStudioHelpers.bindGenerationActions();
        }
      : function bindAiMediaStudioEventsFallback() {}
  };
}

function createDashboardStudioRoutingMediaBootstrapHelpers(input) {
  const {
    state,
    request,
    setOutput,
    clearChildren,
    escapeHtml,
    formatDateTime,
    setElementValue,
    setElementChecked,
    getActiveView,
    normalizeMessenger,
    applyThemeForCurrentContext,
    applyMessengerSelectionUi,
    updateMessengerWorkspaceSummary,
    getMessengerDisplayName,
    resolveMessengerCompatibleView,
    switchDashboardView,
    normalizeTelegramChatId,
    normalizeMatrixRoomId,
    renderMessengerRuntimePanel,
    stageMeta,
    unloadModel3dViewerPreview,
    unloadInactiveStudioWorkflowPreviews,
    applyStudioRailExpandedState,
    updateStudioWorkflowSidebar,
    studioSidebarHelpers,
    shellLayoutHelpers,
    renderImageList,
    filesToAiImages,
    readFileAsDataUrl,
    collectDroppedImages,
    collectPastedImages,
    attachDashboardLazyMedia,
    getGeneratedImageFileUrl,
    getGeneratedAudioFileUrl,
    getGeneratedVideoFileUrl,
    getModel3dFileUrl,
    buildAbsoluteDashboardUrl,
    getSelectedGeneratedModel,
    getToolQuickActionSelection,
    updateVideoToolQuickActionState,
    convertImageUrlToPixelArt,
    convertImageUrlToNormalMap,
    openImageInPixelArtTool,
    openImageInNormalMapTool,
    handleModel3dLowPolyUploadSourceChange,
    setModel3dStatus,
    loadModel3dHistory,
    refreshState,
    loadBotMessages,
    renderChannelBrowser,
    loadChannelSettings,
    loadChannelPermissionSummary,
    selectChannel,
    switchSubview,
    updateSelectionDetails,
    loadTelegramChats,
    renderTelegramChats,
    renderMessengerDashboardView,
    loadChannels,
    ensureAiWorkflowDataLoaded,
    syncStudioRightSidebar,
    ensureImagePoolDataLoaded,
    renderModel3dPoolSelectionList,
    updateModel3dSourceHint,
    setDetailsPaneVisible,
    refreshImageEditSourceOptions,
    syncImageStudioPreviewTarget,
    workflowRightSidebarTargets,
    studioRailExpandedStorageKey,
    workflowRightSidebarStateStorageKey,
    workflowRightSidebarWidthStorageKey,
    studioWorkflowSidebarMeta
  } = input;

  const dashboardDirectMessageConversationController = typeof createDashboardDirectMessageConversationController === "function"
    ? createDashboardDirectMessageConversationController({
        state,
        request,
        switchView: switchDashboardView,
        updateSelectionDetails
      })
    : null;
  const dashboardDirectMessageRailHelpers = typeof createDashboardDirectMessageRailHelpers === "function"
    ? createDashboardDirectMessageRailHelpers({
        state,
        request,
        setOutput,
        normalizeTelegramChatId,
        setSelectedTelegramChatId: input.setSelectedTelegramChatId,
        loadTelegramChats,
        renderTelegramChats,
        updateSelectionDetails,
        selectDiscordDirectMessage: thread => dashboardDirectMessageConversationController?.selectConversation(thread)
      })
    : null;
  const dashboardMessagingHandlers = typeof createDashboardMessagingHandlers === "function"
    ? createDashboardMessagingHandlers({
        state,
        request,
        setOutput,
        loadBotMessages: (...args) => loadBotMessages(...args),
        refreshDirectMessageRail: () => dashboardDirectMessageRailHelpers?.refresh(),
        refreshDirectMessageConversation: () => dashboardDirectMessageConversationController?.loadSelectedConversation()
      })
    : null;
  const dashboardGuildSettingsUiHelpers = createDashboardGuildSettingsUiHelpers({
    state,
    request,
    setOutput,
    clearChildren,
    escapeHtml,
    switchView: switchDashboardView,
    switchSubview,
    updateSelectionDetails: () => updateSelectionDetails(),
    renderChannelBrowser: () => renderChannelBrowser(),
    loadBotMessages,
    loadChannelSettings,
    loadChannelPermissionSummary,
    selectChannel: channelId => selectChannel(channelId),
    setElementValue,
    setElementChecked
  });
  const setHeroBotTag = dashboardGuildSettingsUiHelpers.setHeroBotTag;
  const dashboardMessengerSelectionHelpers = typeof createDashboardMessengerSelectionHelpers === "function"
    ? createDashboardMessengerSelectionHelpers({
        state,
        getActiveView,
        normalizeMessenger,
        applyThemeForCurrentContext,
        applyMessengerSelectionUi,
        updateMessengerWorkspaceSummary,
        setHeroBotTag,
        getMessengerDisplayName,
        resolveMessengerCompatibleView,
        switchView: switchDashboardView,
        switchAutomationPanel: panel => input.dashboardAutomationViewHelpers().switchAutomationPanel(panel),
        normalizeTelegramChatId,
        normalizeMatrixRoomId,
        updateScheduledSourceFields: () => input.updateScheduledSourceFields(),
        updateAutomationTargetChips: () => input.updateAutomationTargetChips(),
        loadTelegramChats: () => loadTelegramChats(),
        renderTelegramChats: () => renderTelegramChats(),
        renderMessengerRuntimePanel,
        refreshDirectMessageRail: () => dashboardDirectMessageRailHelpers?.refresh()
      })
    : null;
  const setSelectedMessenger = dashboardMessengerSelectionHelpers
    ? dashboardMessengerSelectionHelpers.setSelectedMessenger
    : function setSelectedMessengerFallback(nextMessenger) {
        state.selectedMessenger = normalizeMessenger(nextMessenger);
        applyMessengerSelectionUi();
        updateMessengerWorkspaceSummary();
        renderMessengerRuntimePanel();
      };
  const loadSelectedGuildSettings = dashboardGuildSettingsUiHelpers.loadSelectedGuildSettings;
  const openChannelSettings = dashboardGuildSettingsUiHelpers.openChannelSettings;
  const dashboardStudioSidebarProxyHelpers = typeof createDashboardStudioSidebarProxyHelpers === "function"
    ? createDashboardStudioSidebarProxyHelpers({ helpers: studioSidebarHelpers })
    : createDashboardStudioSidebarProxyHelpers();
  const {
    readStudioRailExpandedPreference,
    readStudioRailHoverModePreference,
    applyStudioRailExpandedState: applyStudioRailExpandedStateProxy,
    setStudioRailHoverMode,
    setStudioRailExpanded,
    setWorkflowSidebarMode,
    readWorkflowRightSidebarPreference,
    applyWorkflowRightSidebarCollapsedState,
    setWorkflowRightSidebarCollapsed,
    readWorkflowRightSidebarWidthPreference,
    applyWorkflowRightSidebarWidthState,
    bindWorkflowRightSidebarResizers,
    bindStudioRailHoverExpansion,
    updateStudioWorkflowSidebar: updateStudioWorkflowSidebarProxy
  } = dashboardStudioSidebarProxyHelpers;
  const getModel3dInitialExtraSampleText = dashboardGuildSettingsUiHelpers.getModel3dInitialExtraSampleText;
  const getModel3dDestinationExtraSampleText = dashboardGuildSettingsUiHelpers.getModel3dDestinationExtraSampleText;
  const getScheduledModelPostOptionsModule = dashboardGuildSettingsUiHelpers.getScheduledModelPostOptionsModule;
  const getAutomationScopeId = dashboardGuildSettingsUiHelpers.getAutomationScopeId;
  const dashboardToolsPixelHelpers = createDashboardToolsPixelHelpers();
  const dashboardModel3dPostUiHelpers = typeof createDashboardThreeDPostUiHelpers === "function"
    ? createDashboardThreeDPostUiHelpers({ state, request, setOutput })
    : null;
  const dashboardModel3dPostUi = dashboardModel3dPostUiHelpers || createDashboardThreeDPostUiFallback();
  const {
    updateModel3dPostOptionsUi,
    syncLowPolyPresetFromFaceCount: syncModel3dLowPolyPresetFromFaceCount,
    applyLowPolyPresetToFaceCount: applyModel3dLowPolyPresetToFaceCount,
    readModel3dPostOptions,
    validateModel3dPostOptions,
    refreshModel3dPostDestinationOptions
  } = dashboardModel3dPostUi;
  const dashboardAutomationChannelHelpers = typeof createDashboardAutomationChannelHelpers === "function"
    ? createDashboardAutomationChannelHelpers({
        state,
        clearChildren,
        getScheduledModelPostOptionsModule,
        refreshModel3dPostDestinationOptions,
        refreshStudioPostTargetOptions: function refreshStudioPostTargetOptionsFallback() {},
        updateAutomationTargetChipsBase: function updateAutomationTargetChipsBaseFallback() {},
        updateScheduledTargetModeUi: function updateScheduledTargetModeUiFallback() {}
      })
    : null;
  const refreshAutomationAndModelChannelSelectors = dashboardAutomationChannelHelpers
    ? dashboardAutomationChannelHelpers.refreshAutomationAndModelChannelSelectors
    : function refreshAutomationAndModelChannelSelectorsFallback() {};
  const dashboardShellViewRoutingHelpers = createDashboardShellViewRoutingHelpers({
    state,
    stageMeta,
    resolveRequestedViewForMessenger: input.resolveRequestedViewForMessenger,
    unloadModel3dViewerPreview,
    unloadInactiveStudioWorkflowPreviews,
    applyMessengerSelectionUi,
    loadTelegramChats: () => loadTelegramChats(),
    renderTelegramChats: () => renderTelegramChats(),
    loadChannels: () => loadChannels(),
    refreshAutomationAndModelChannelSelectors,
    updateSelectionDetails: () => updateSelectionDetails(),
    renderMessengerDashboardView,
    updateMessengerWorkspaceSummary,
    applyThemeForCurrentContext,
    applyStudioRailExpandedState: applyStudioRailExpandedStateProxy || applyStudioRailExpandedState,
    updateStudioWorkflowSidebar: updateStudioWorkflowSidebarProxy || updateStudioWorkflowSidebar
  });
  const switchView = dashboardShellViewRoutingHelpers.switchView;
  let audioUiRuntime = null;
  let aiMediaStudioRuntime = null;
  const dashboardAiStudioLayoutHelpers = typeof createDashboardAiStudioLayoutHelpers === "function"
    ? createDashboardAiStudioLayoutHelpers({
        state,
        switchView,
        clearChildren,
        formatDateTime,
        getGeneratedImageFileUrl,
        getGeneratedVideoFileUrl,
        getGeneratedAudioFileUrl,
        getModel3dFileUrl,
        loadImageHistory: (...args) => aiMediaStudioRuntime?.loadImageHistory?.(...args),
        loadVideoHistory: (...args) => aiMediaStudioRuntime?.loadVideoHistory?.(...args),
        loadAudioHistory: (...args) => audioUiRuntime?.loadAudioHistory?.(...args),
        loadModel3dHistory: (...args) => loadModel3dHistory(...args),
        renderModel3dUploadSourceList: () => input.renderModel3dUploadSourceList(),
        ensureImagePoolDataLoaded: () => ensureImagePoolDataLoaded(),
        renderModel3dPoolSelectionList: () => renderModel3dPoolSelectionList(),
        updateModel3dPostOptionsUi: () => updateModel3dPostOptionsUi(),
        renderModel3dViewer: () => input.renderModel3dViewer(),
        refreshImageEditSourceOptions: () => refreshImageEditSourceOptions(),
        syncImageStudioPreviewTarget: () => syncImageStudioPreviewTarget(),
        onFocusChanged: focusedId => {
          unloadModel3dViewerPreview();
          void ensureAiWorkflowDataLoaded(focusedId).catch(() => {});
          unloadInactiveStudioWorkflowPreviews(focusedId);
          syncStudioRightSidebar(getActiveView());
          updateStudioWorkflowSidebarProxy ? updateStudioWorkflowSidebarProxy() : updateStudioWorkflowSidebar();
        }
      })
    : null;
  const { openAiSection, clearAiSectionFocus, applyAiSectionFocusState } = createDashboardAiStudioLayoutProxyHelpers({ helpers: dashboardAiStudioLayoutHelpers });
  const { applyShellPaneState, enhanceShellChrome, setDetailsPaneVisible: setDetailsPaneVisibleProxy, setWorkspacePaneVisible, syncResponsiveShell, bindShellOverlayEvents } = createDashboardShellLayoutProxyHelpers({ helpers: shellLayoutHelpers });
  audioUiRuntime = createDashboardAudioUiRuntime({ state, request, clearChildren, escapeHtml, formatDateTime });
  aiMediaStudioRuntime = createDashboardAiMediaStudioRuntime({
    state,
    request,
    setOutput,
    clearChildren,
    escapeHtml,
    formatDateTime,
    renderImageList,
    filesToAiImages,
    readFileAsDataUrl,
    collectDroppedImages,
    collectPastedImages,
    attachDashboardLazyMedia,
    getGeneratedImageFileUrl,
    getGeneratedVideoFileUrl,
    buildAbsoluteDashboardUrl,
    getSelectedGeneratedModel,
    getToolQuickActionSelection,
    openAiSection,
    convertImageUrlToPixelArt,
    convertImageUrlToNormalMap,
    openImageInPixelArtTool,
    openImageInNormalMapTool,
    handleModel3dLowPolyUploadSourceChange,
    setModel3dStatus,
    loadModel3dHistory,
    setAudioGenerationStatus: audioUiRuntime.setAudioGenerationStatus,
    setMusicGenerationStatus: audioUiRuntime.setMusicGenerationStatus,
    loadAudioHistory: audioUiRuntime.loadAudioHistory,
    stateImagePools: () => state.imagePools,
    loadBotMessages,
    refreshState
  });
  if (document.documentElement.dataset.studioVisibilityCleanupBound !== "true") {
    document.documentElement.dataset.studioVisibilityCleanupBound = "true";
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        unloadModel3dViewerPreview();
        aiMediaStudioRuntime.unloadMediaStudioPreviewForFocus("");
        return;
      }
      aiMediaStudioRuntime.unloadMediaStudioPreviewForFocus(state.aiFocusedSectionId || "");
    });
  }
  const dashboardGameEngineHelpers = typeof createDashboardGameEngineHelpers === "function"
    ? createDashboardGameEngineHelpers({
        state,
        request,
        setOutput,
        clearChildren,
        buildAbsoluteDashboardUrl,
        getGeneratedImageFileUrl,
        getGeneratedAudioFileUrl,
        getGeneratedVideoFileUrl,
        getModel3dFileUrl,
        getSelectedGeneratedModel
      })
    : null;
  const dashboardModel3dQuickActionModalHelpers = typeof createDashboardThreeDQuickActionModalHelpers === "function"
    ? createDashboardThreeDQuickActionModalHelpers({
        state,
        request,
        setOutput,
        setModel3dStatus,
        loadImageHistory: aiMediaStudioRuntime.loadImageHistory,
        refreshState: (...args) => refreshState(...args),
        openAiSection,
        getSelectedGeneratedModel,
        resolveModel3dPreviewMedia: input.resolveModel3dPreviewMedia,
        getModel3dFileUrl,
        buildAbsoluteDashboardUrl,
        renderModel3dPreviewGifDataUrl: input.renderModel3dPreviewGifDataUrl
      })
    : null;

  return {
    dashboardMessagingHandlers,
    dashboardGuildSettingsUiHelpers,
    setHeroBotTag,
    setSelectedMessenger,
    loadSelectedGuildSettings,
    openChannelSettings,
    readStudioRailExpandedPreference,
    readStudioRailHoverModePreference,
    applyStudioRailExpandedState: applyStudioRailExpandedStateProxy,
    setStudioRailHoverMode,
    setStudioRailExpanded,
    setWorkflowSidebarMode,
    readWorkflowRightSidebarPreference,
    applyWorkflowRightSidebarCollapsedState,
    setWorkflowRightSidebarCollapsed,
    readWorkflowRightSidebarWidthPreference,
    applyWorkflowRightSidebarWidthState,
    bindWorkflowRightSidebarResizers,
    bindStudioRailHoverExpansion,
    updateStudioWorkflowSidebar: updateStudioWorkflowSidebarProxy,
    getModel3dInitialExtraSampleText,
    getModel3dDestinationExtraSampleText,
    getScheduledModelPostOptionsModule,
    getAutomationScopeId,
    updateToolsPixelSliderReadouts: dashboardToolsPixelHelpers.updateSliderReadouts,
    renderToolsPixelArt: dashboardToolsPixelHelpers.render,
    maybeAutoConvertToolsPixel: dashboardToolsPixelHelpers.maybeAutoConvert,
    loadToolsPixelSourceFile: dashboardToolsPixelHelpers.loadSourceFile,
    downloadToolsPixelResult: dashboardToolsPixelHelpers.downloadResult,
    resetToolsPixelTool: dashboardToolsPixelHelpers.reset,
    dashboardModel3dPostUiHelpers,
    updateModel3dPostOptionsUi,
    syncModel3dLowPolyPresetFromFaceCount,
    applyModel3dLowPolyPresetToFaceCount,
    readModel3dPostOptions,
    validateModel3dPostOptions,
    refreshModel3dPostDestinationOptions,
    dashboardAutomationChannelHelpers,
    refreshAutomationAndModelChannelSelectors,
    switchView,
    dashboardAiStudioLayoutHelpers,
    openAiSection,
    clearAiSectionFocus,
    applyAiSectionFocusState,
    applyShellPaneState,
    enhanceShellChrome,
    setDetailsPaneVisible: setDetailsPaneVisibleProxy || setDetailsPaneVisible,
    setWorkspacePaneVisible,
    syncResponsiveShell,
    bindShellOverlayEvents,
    dashboardAudioUiHelpers: audioUiRuntime.dashboardAudioUiHelpers,
    setAudioGenerationStatus: audioUiRuntime.setAudioGenerationStatus,
    setMusicGenerationStatus: audioUiRuntime.setMusicGenerationStatus,
    loadAudioHistory: audioUiRuntime.loadAudioHistory,
    syncAudioPreviewForFocus: audioUiRuntime.syncAudioPreviewForFocus,
    dashboardAiMediaStudioHelpers: aiMediaStudioRuntime.dashboardAiMediaStudioHelpers,
    mergeAiImages: aiMediaStudioRuntime.mergeAiImages,
    clearAiImages: aiMediaStudioRuntime.clearAiImages,
    renderAiImageList: aiMediaStudioRuntime.renderAiImageList,
    clearAskSkillModelUploads: aiMediaStudioRuntime.clearAskSkillModelUploads,
    clearAskFileUploads: aiMediaStudioRuntime.clearAskFileUploads,
    mergeModerationImages: aiMediaStudioRuntime.mergeModerationImages,
    clearModerationImages: aiMediaStudioRuntime.clearModerationImages,
    renderModerationImageList: aiMediaStudioRuntime.renderModerationImageList,
    setImageGenerationStatus: aiMediaStudioRuntime.setImageGenerationStatus,
    loadImageHistory: aiMediaStudioRuntime.loadImageHistory,
    setVideoGenerationStatus: aiMediaStudioRuntime.setVideoGenerationStatus,
    loadVideoHistory: aiMediaStudioRuntime.loadVideoHistory,
    dashboardGameEngineHelpers,
    dashboardModel3dQuickActionModalHelpers,
    unloadMediaStudioPreviewForFocus: aiMediaStudioRuntime.unloadMediaStudioPreviewForFocus,
    refreshStudioPostTargetOptions: aiMediaStudioRuntime.refreshStudioPostTargetOptions,
    bindAiMediaStudioEvents: aiMediaStudioRuntime.bindAiMediaStudioEvents
  };
}
