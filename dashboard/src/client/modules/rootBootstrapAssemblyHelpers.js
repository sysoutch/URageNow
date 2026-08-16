function createDashboardRootBootstrapAssemblyHelpers(input) {
  const {
    state,
    request,
    stageMeta,
    studioWorkflowSidebarMeta,
    workflowRightSidebarTargets,
    studioRailExpandedStorageKey,
    studioRailHoverModeStorageKey,
    studioWorkflowSidebarModeStorageKey,
    workflowRightSidebarStateStorageKey,
    workflowRightSidebarWidthStorageKey,
    setDashboardText,
    setOutput,
    loadChannelSettings,
    loadChannelPermissionSummary,
    filesToAiImages,
    parseImageTextInputs,
    readFileAsDataUrl,
    renderImageList,
    getDashboardGuildChannelRuntimeHelpers,
    getSetModel3dStatus,
    getResolveMessengerCompatibleView,
    getSwitchView,
    getUpdateAutomationTargetChips,
    getRenderMessengerDashboardView,
    getDashboardAiMediaStudioHelpers,
    getDashboardAutomationViewHelpers,
    getUpdateScheduledSourceFields,
    getRenderModel3dViewer,
    getRefreshState,
    getLoadBotMessages,
    getLoadChannels,
    getEnsureAiWorkflowDataLoaded,
    getEnsureImagePoolDataLoaded,
    getRenderModel3dPoolSelectionList,
    getRefreshImageEditSourceOptions,
    getSyncImageStudioPreviewTarget,
    getRenderModel3dUploadSourceList,
    getResolveModel3dPreviewMedia,
    getRenderModel3dPreviewGifDataUrl,
    getLoadTelegramChats,
    getRenderTelegramChats,
    clearChildren,
    escapeHtml,
    formatDateTime,
    setElementValue,
    setElementChecked,
    splitLines,
    createImageId,
    readBlobAsDataUrl,
    attachDashboardLazyMedia,
    downloadModel3dArtifact,
    renderMarkdownInto,
    collectDroppedImages,
    collectPastedImages,
    switchSubview,
    updateSelectionDetails,
    renderChannelBrowser,
    renderImageList: renderImageListDirect,
    selectChannel,
    loadUsers,
    unloadModel3dViewerPreview,
    unloadInactiveStudioWorkflowPreviews,
    applyStudioRailExpandedState,
    updateStudioWorkflowSidebar,
    getToolQuickActionSelection,
    updateVideoToolQuickActionState,
    convertImageUrlToPixelArt,
    convertImageUrlToNormalMap,
    openImageInPixelArtTool,
    openImageInNormalMapTool,
    handleModel3dLowPolyUploadSourceChange,
    loadModel3dHistory,
    setDetailsPaneVisible,
    updateModel3dSourceHint,
    loadGlobalSettingsFromState,
    getMessengerBrowserUrl,
    fillPresetSelect,
    setMultiSelectValues,
    getMultiSelectValues,
    setRefreshStatus,
    setComfyPathSettingsStatus,
    setQuickComfyPathSettingsStatus,
    setQuickFfmpegSettingsStatus,
    saveQuickFfmpegSettingsFromUi,
    runInstallerFromUi,
    openAiSection,
    setConsoleOverlayOpen
  } = input;

  const dashboardPresentationHelpers = createDashboardPresentationHelpers();
  const dashboardMediaArtifactHelpers = createDashboardMediaArtifactHelpers({
    setModel3dStatus: text => {
      const applyStatus = getSetModel3dStatus();
      if (typeof applyStatus === "function") {
        applyStatus(text);
      }
    },
    setOutput
  });
  const dashboardImageTransferHelpers = createDashboardImageTransferHelpers({ filesToAiImages, parseImageTextInputs, setOutput });
  const dashboardStudioSidebarHelpers = typeof createDashboardStudioSidebarHelpers === "function"
    ? createDashboardStudioSidebarHelpers({
        state,
        getActiveView: () => getActiveView(),
        studioWorkflowSidebarMeta,
        workflowRightSidebarTargets,
        studioRailExpandedStorageKey,
        studioRailHoverModeStorageKey,
        studioWorkflowSidebarModeStorageKey,
        workflowRightSidebarStateStorageKey,
        workflowRightSidebarWidthStorageKey
      })
    : null;
  const dashboardShellRuntimeThemeHelpers = typeof createDashboardShellRuntimeThemeHelpers === "function"
    ? createDashboardShellRuntimeThemeHelpers({
        state,
        request,
        formatDateTime: dashboardPresentationHelpers.formatDateTime,
        updateAutomationTargetChips: () => {
          const updateTargetChips = getUpdateAutomationTargetChips();
          if (typeof updateTargetChips === "function") {
            updateTargetChips();
          }
        },
        renderMessengerDashboardView: () => {
          const renderView = getRenderMessengerDashboardView();
          if (typeof renderView === "function") {
            renderView();
          }
        }
      })
    : null;
  const dashboardShellRuntimeTheme = dashboardShellRuntimeThemeHelpers || createDashboardShellRuntimeThemeFallback({ state });
  const {
    normalizeDashboardTheme,
    getDashboardThemeLabel,
    readDashboardThemePreference,
    shouldAnimateDashboardThemeTransition,
    setDashboardThemeTransitionEnabled,
    updateDashboardThemeButtons,
    setDashboardTheme,
    getNextDashboardTheme,
    normalizeMessenger,
    isDiscordOnlyView,
    getActiveView,
    restoreStudioRightSidebarAsides,
    syncStudioRightSidebar,
    getMessengerDisplayName,
    normalizeThemeTarget,
    applyMessengerThemeVariables,
    loadThemeConfig,
    applyThemeForCurrentContext,
    getSelectedMessengerRuntime,
    normalizeTelegramChatId,
    getSelectedTelegramChat,
    setSelectedTelegramChatId,
    setRuntimeOverlayOpen,
    setSettingsOverlayOpen,
    getRuntimeProgressValue,
    formatRuntimeMeta,
    renderMessengerRuntimePanel,
    updateMessengerWorkspaceSummary,
    applyMessengerSelectionUi
  } = createDashboardShellRuntimeThemeProxyHelpers({ helpers: dashboardShellRuntimeTheme });
  const normalizeMatrixRoomId = value => String(value || "").trim();
  const normalizeScheduledTargetMessenger = value => value === "telegram" || value === "matrix" ? value : "discord";
  const refreshMeta = { guilds: 0, channels: 0, ollamaModels: 0, botMessages: 0, automationTextSources: 0 };
  const guildRefresh = { attempts: 0, timer: 0 };
  const dashboardMessengerDashboard = typeof createDashboardMessengerDashboardHelpers === "function"
    ? createDashboardMessengerDashboardHelpers({
        state,
        clearChildren: dashboardPresentationHelpers.clearChildren,
        escapeHtml: dashboardPresentationHelpers.escapeHtml,
        formatDateTime: dashboardPresentationHelpers.formatDateTime,
        setDashboardText,
        getSelectedMessengerRuntime,
        normalizeMessenger,
        getMessengerDisplayName,
        formatRuntimeMeta,
        getSelectedTelegramChat,
        normalizeTelegramChatId,
        getTelegramChatTitle,
        getRefreshMeta: () => refreshMeta
      })
    : {
        getDashboardMessengerSubtitle() {
          return "Connect, manage, and interact with your messenger runtime.";
        },
        formatRelativeTime() {
          return "Unknown";
        },
        getMessengerDashboardRecords() {
          return [];
        },
        renderMessengerDashboardRecentMessages() {},
        renderMessengerDashboardActivityBars() {},
        renderMessengerDashboardCommandList() {},
        renderMessengerDashboardView() {}
      };
  const {
    getDashboardMessengerSubtitle,
    formatRelativeTime,
    getMessengerDashboardRecords,
    renderMessengerDashboardRecentMessages,
    renderMessengerDashboardActivityBars,
    renderMessengerDashboardCommandList,
    renderMessengerDashboardView
  } = createDashboardMessengerDashboardProxyHelpers({ helpers: dashboardMessengerDashboard });
  const resolveMessengerCompatibleView = typeof getResolveMessengerCompatibleView === "function" && typeof getResolveMessengerCompatibleView() === "function"
    ? (...args) => getResolveMessengerCompatibleView()(...args)
    : (nextMessenger, currentView) => resolveDashboardMessengerCompatibleView(nextMessenger, currentView, {
        normalizeMessenger,
        getActiveView,
        isDiscordOnlyView
      });
  const resolveRequestedViewForMessenger = view => resolveDashboardRequestedViewForMessenger(view, state, { isDiscordOnlyView });
  const dashboardShellLayoutHelpers = typeof createDashboardShellLayoutHelpers === "function" ? createDashboardShellLayoutHelpers({ state }) : null;
  const dashboardWorkspacePanelHelpers = typeof createDashboardWorkspacePanelHelpers === "function"
    ? createDashboardWorkspacePanelHelpers({ state, setDetailsPaneVisible: visible => setDetailsPaneVisible(visible) })
    : null;
  const dashboardUserSearchHandlers = typeof createDashboardUserSearchHandlers === "function" ? createDashboardUserSearchHandlers({ loadUsers }) : null;
  const dashboardStudioRoutingMediaBootstrapHelpers = typeof createDashboardStudioRoutingMediaBootstrapHelpers === "function"
    ? createDashboardStudioRoutingMediaBootstrapHelpers({
        state,
        request,
        setOutput,
        clearChildren: dashboardPresentationHelpers.clearChildren,
        escapeHtml: dashboardPresentationHelpers.escapeHtml,
        formatDateTime: dashboardPresentationHelpers.formatDateTime,
        setElementValue,
        setElementChecked,
        getActiveView,
        normalizeMessenger,
        applyThemeForCurrentContext,
        applyMessengerSelectionUi,
        updateMessengerWorkspaceSummary,
        getMessengerDisplayName,
        resolveMessengerCompatibleView,
        switchDashboardView: view => {
          const switchView = getSwitchView();
          return typeof switchView === "function" ? switchView(view) : undefined;
        },
        normalizeTelegramChatId,
        normalizeMatrixRoomId,
        renderMessengerRuntimePanel,
        stageMeta,
        unloadModel3dViewerPreview,
        unloadInactiveStudioWorkflowPreviews,
        applyStudioRailExpandedState,
        updateStudioWorkflowSidebar,
        studioSidebarHelpers: dashboardStudioSidebarHelpers,
        shellLayoutHelpers: dashboardShellLayoutHelpers,
        renderImageList: renderImageListDirect || renderImageList,
        filesToAiImages,
        readFileAsDataUrl,
        collectDroppedImages: dashboardImageTransferHelpers.collectDroppedImages,
        collectPastedImages: dashboardImageTransferHelpers.collectPastedImages,
        getGeneratedImageFileUrl: dashboardMediaArtifactHelpers.getGeneratedImageFileUrl,
        getGeneratedAudioFileUrl: dashboardMediaArtifactHelpers.getGeneratedAudioFileUrl,
        getGeneratedVideoFileUrl: dashboardMediaArtifactHelpers.getGeneratedVideoFileUrl,
        getModel3dFileUrl: dashboardMediaArtifactHelpers.getModel3dFileUrl,
        buildAbsoluteDashboardUrl: dashboardMediaArtifactHelpers.buildAbsoluteDashboardUrl,
        getSelectedGeneratedModel: input.getSelectedGeneratedModel,
        getToolQuickActionSelection,
        updateVideoToolQuickActionState,
        convertImageUrlToPixelArt,
        convertImageUrlToNormalMap,
        openImageInPixelArtTool,
        openImageInNormalMapTool,
        handleModel3dLowPolyUploadSourceChange,
        setModel3dStatus: text => {
          const applyStatus = getSetModel3dStatus();
          if (typeof applyStatus === "function") {
            applyStatus(text);
          }
        },
        loadModel3dHistory,
        refreshState: (...args) => getRefreshState()(...args),
        loadBotMessages: (...args) => getLoadBotMessages()(...args),
        renderChannelBrowser,
        loadChannelSettings,
        loadChannelPermissionSummary,
        selectChannel,
        switchSubview,
        updateSelectionDetails,
        loadTelegramChats: () => getLoadTelegramChats()(),
        renderTelegramChats: () => getRenderTelegramChats()(),
        renderMessengerDashboardView,
        loadChannels: () => getLoadChannels()(),
        ensureAiWorkflowDataLoaded: (...args) => getEnsureAiWorkflowDataLoaded()(...args),
        syncStudioRightSidebar,
        ensureImagePoolDataLoaded: (...args) => getEnsureImagePoolDataLoaded()(...args),
        renderModel3dPoolSelectionList: (...args) => getRenderModel3dPoolSelectionList()(...args),
        updateModel3dSourceHint,
        setDetailsPaneVisible,
        refreshImageEditSourceOptions: (...args) => getRefreshImageEditSourceOptions()(...args),
        syncImageStudioPreviewTarget: (...args) => getSyncImageStudioPreviewTarget()(...args),
        workflowRightSidebarTargets,
        studioRailExpandedStorageKey,
        studioWorkflowSidebarModeStorageKey,
        workflowRightSidebarStateStorageKey,
        workflowRightSidebarWidthStorageKey,
        studioWorkflowSidebarMeta,
        dashboardAutomationViewHelpers: () => getDashboardAutomationViewHelpers(),
        updateScheduledSourceFields: () => getUpdateScheduledSourceFields()(),
        updateAutomationTargetChips: () => {
          const updateTargetChips = getUpdateAutomationTargetChips();
          if (typeof updateTargetChips === "function") {
            updateTargetChips();
          }
        },
        resolveRequestedViewForMessenger,
        renderModel3dUploadSourceList: (...args) => getRenderModel3dUploadSourceList()(...args),
        renderModel3dViewer: (...args) => getRenderModel3dViewer()(...args),
        resolveModel3dPreviewMedia: (...args) => getResolveModel3dPreviewMedia()(...args),
        renderModel3dPreviewGifDataUrl: (...args) => getRenderModel3dPreviewGifDataUrl()(...args)
      })
    : null;
  const dashboardDiscordWorkspaceHelpers = typeof createDashboardDiscordWorkspaceHelpers === "function"
    ? createDashboardDiscordWorkspaceHelpers({
        state,
        request,
        setOutput,
        clearChildren: dashboardPresentationHelpers.clearChildren,
        escapeHtml: dashboardPresentationHelpers.escapeHtml,
        loadBotMessages: (...args) => getLoadBotMessages()(...args),
        setWorkspacePaneVisible: (...args) => dashboardStudioRoutingMediaBootstrapHelpers?.setWorkspacePaneVisible?.(...args),
        updateImageScanChannelChip: () => dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGuildSettingsUiHelpers?.updateImageScanChannelChip(),
        updateChatModeForm: () => dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGuildSettingsUiHelpers?.updateChatModeForm(),
        loadChatModeDebug: (...args) => dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGuildSettingsUiHelpers?.loadChatModeDebug?.(...args),
        updateChatModeUserChip: () => dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGuildSettingsUiHelpers?.updateChatModeUserChip(),
        updateImagePoolVerifiedRoleChip: () => dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGuildSettingsUiHelpers?.updateImagePoolVerifiedRoleChip(),
        updateImagePoolVerifiedUserChip: () => dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGuildSettingsUiHelpers?.updateImagePoolVerifiedUserChip(),
        loadGuildSettings: (...args) => dashboardStudioRoutingMediaBootstrapHelpers?.loadSelectedGuildSettings?.(...args),
        syncAutomationTargetsWithSelectedChannel: channelId => {
          const nextChannelId = String(channelId || "").trim();
          if (!nextChannelId) {
            return;
          }
          if (!state.selectedScheduledAutomationId && state.scheduledTargetMessenger === "discord") {
            state.scheduledTargetChannelId = nextChannelId;
          }
          if (!state.selectedJoinAutomationId) {
            state.joinTargetChannelId = nextChannelId;
          }
          const updateTargetChips = getUpdateAutomationTargetChips();
          if (typeof updateTargetChips === "function") {
            updateTargetChips();
          }
        },
        getActiveView,
        onChannelsLoaded: () => {
          refreshMeta.channels = Date.now();
        },
        openChannelSettings: (...args) => dashboardStudioRoutingMediaBootstrapHelpers?.openChannelSettings?.(...args),
        refreshState: (...args) => getRefreshState()(...args),
        loadAutomations: (...args) => input.getLoadAutomations()(...args),
        refreshAutomationAndModelChannelSelectors: (...args) => dashboardStudioRoutingMediaBootstrapHelpers?.refreshAutomationAndModelChannelSelectors?.(...args)
      })
    : null;

  return {
    escapeHtml: dashboardPresentationHelpers.escapeHtml,
    renderMarkdownHtml: dashboardPresentationHelpers.renderMarkdownHtml,
    renderMarkdownInto: dashboardPresentationHelpers.renderMarkdownInto,
    setOutput: dashboardPresentationHelpers.setOutput,
    formatDateTime: dashboardPresentationHelpers.formatDateTime,
    clearChildren: dashboardPresentationHelpers.clearChildren,
    setElementValue: dashboardPresentationHelpers.setElementValue,
    setElementChecked: dashboardPresentationHelpers.setElementChecked,
    getModel3dFileUrl: dashboardMediaArtifactHelpers.getModel3dFileUrl,
    getGeneratedImageFileUrl: dashboardMediaArtifactHelpers.getGeneratedImageFileUrl,
    getGeneratedAudioFileUrl: dashboardMediaArtifactHelpers.getGeneratedAudioFileUrl,
    getGeneratedVideoFileUrl: dashboardMediaArtifactHelpers.getGeneratedVideoFileUrl,
    buildAbsoluteDashboardUrl: dashboardMediaArtifactHelpers.buildAbsoluteDashboardUrl,
    downloadModel3dArtifact: dashboardMediaArtifactHelpers.downloadModel3dArtifact,
    collectPastedImages: dashboardImageTransferHelpers.collectPastedImages,
    collectDroppedImages: dashboardImageTransferHelpers.collectDroppedImages,
    dashboardStudioSidebarHelpers,
    normalizeDashboardTheme,
    getDashboardThemeLabel,
    readDashboardThemePreference,
    shouldAnimateDashboardThemeTransition,
    setDashboardThemeTransitionEnabled,
    updateDashboardThemeButtons,
    setDashboardTheme,
    getNextDashboardTheme,
    normalizeMessenger,
    isDiscordOnlyView,
    getActiveView,
    restoreStudioRightSidebarAsides,
    syncStudioRightSidebar,
    getMessengerDisplayName,
    normalizeThemeTarget,
    applyMessengerThemeVariables,
    loadThemeConfig,
    applyThemeForCurrentContext,
    getSelectedMessengerRuntime,
    normalizeTelegramChatId,
    getSelectedTelegramChat,
    setSelectedTelegramChatId,
    setRuntimeOverlayOpen,
    setSettingsOverlayOpen,
    getRuntimeProgressValue,
    formatRuntimeMeta,
    renderMessengerRuntimePanel,
    updateMessengerWorkspaceSummary,
    applyMessengerSelectionUi,
    normalizeMatrixRoomId,
    normalizeScheduledTargetMessenger,
    refreshMeta,
    guildRefresh,
    getDashboardMessengerSubtitle,
    formatRelativeTime,
    getMessengerDashboardRecords,
    renderMessengerDashboardRecentMessages,
    renderMessengerDashboardActivityBars,
    renderMessengerDashboardCommandList,
    renderMessengerDashboardView,
    resolveMessengerCompatibleView,
    resolveRequestedViewForMessenger,
    dashboardShellLayoutHelpers,
    dashboardWorkspacePanelHelpers,
    dashboardUserSearchHandlers,
    dashboardMessagingHandlers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardMessagingHandlers || null,
    dashboardGuildSettingsUiHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGuildSettingsUiHelpers || null,
    setHeroBotTag: dashboardStudioRoutingMediaBootstrapHelpers?.setHeroBotTag,
    setSelectedMessenger: dashboardStudioRoutingMediaBootstrapHelpers?.setSelectedMessenger,
    loadSelectedGuildSettings: dashboardStudioRoutingMediaBootstrapHelpers?.loadSelectedGuildSettings,
    openChannelSettings: dashboardStudioRoutingMediaBootstrapHelpers?.openChannelSettings,
    readStudioRailExpandedPreference: dashboardStudioRoutingMediaBootstrapHelpers?.readStudioRailExpandedPreference,
    readStudioRailHoverModePreference: dashboardStudioRoutingMediaBootstrapHelpers?.readStudioRailHoverModePreference,
    applyStudioRailExpandedState: dashboardStudioRoutingMediaBootstrapHelpers?.applyStudioRailExpandedState,
    setStudioRailHoverMode: dashboardStudioRoutingMediaBootstrapHelpers?.setStudioRailHoverMode,
    setStudioRailExpanded: dashboardStudioRoutingMediaBootstrapHelpers?.setStudioRailExpanded,
    setWorkflowSidebarMode: dashboardStudioRoutingMediaBootstrapHelpers?.setWorkflowSidebarMode,
    readWorkflowRightSidebarPreference: dashboardStudioRoutingMediaBootstrapHelpers?.readWorkflowRightSidebarPreference,
    applyWorkflowRightSidebarCollapsedState: dashboardStudioRoutingMediaBootstrapHelpers?.applyWorkflowRightSidebarCollapsedState,
    setWorkflowRightSidebarCollapsed: dashboardStudioRoutingMediaBootstrapHelpers?.setWorkflowRightSidebarCollapsed,
    readWorkflowRightSidebarWidthPreference: dashboardStudioRoutingMediaBootstrapHelpers?.readWorkflowRightSidebarWidthPreference,
    applyWorkflowRightSidebarWidthState: dashboardStudioRoutingMediaBootstrapHelpers?.applyWorkflowRightSidebarWidthState,
    bindWorkflowRightSidebarResizers: dashboardStudioRoutingMediaBootstrapHelpers?.bindWorkflowRightSidebarResizers,
    bindStudioRailHoverExpansion: dashboardStudioRoutingMediaBootstrapHelpers?.bindStudioRailHoverExpansion,
    updateStudioWorkflowSidebar: dashboardStudioRoutingMediaBootstrapHelpers?.updateStudioWorkflowSidebar,
    getModel3dInitialExtraSampleText: dashboardStudioRoutingMediaBootstrapHelpers?.getModel3dInitialExtraSampleText,
    getModel3dDestinationExtraSampleText: dashboardStudioRoutingMediaBootstrapHelpers?.getModel3dDestinationExtraSampleText,
    getScheduledModelPostOptionsModule: dashboardStudioRoutingMediaBootstrapHelpers?.getScheduledModelPostOptionsModule,
    getAutomationScopeId: dashboardStudioRoutingMediaBootstrapHelpers?.getAutomationScopeId,
    updateToolsPixelSliderReadouts: dashboardStudioRoutingMediaBootstrapHelpers?.updateToolsPixelSliderReadouts,
    renderToolsPixelArt: dashboardStudioRoutingMediaBootstrapHelpers?.renderToolsPixelArt,
    maybeAutoConvertToolsPixel: dashboardStudioRoutingMediaBootstrapHelpers?.maybeAutoConvertToolsPixel,
    loadToolsPixelSourceFile: dashboardStudioRoutingMediaBootstrapHelpers?.loadToolsPixelSourceFile,
    downloadToolsPixelResult: dashboardStudioRoutingMediaBootstrapHelpers?.downloadToolsPixelResult,
    resetToolsPixelTool: dashboardStudioRoutingMediaBootstrapHelpers?.resetToolsPixelTool,
    dashboardModel3dPostUiHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardModel3dPostUiHelpers || null,
    updateModel3dPostOptionsUi: dashboardStudioRoutingMediaBootstrapHelpers?.updateModel3dPostOptionsUi,
    syncModel3dLowPolyPresetFromFaceCount: dashboardStudioRoutingMediaBootstrapHelpers?.syncModel3dLowPolyPresetFromFaceCount,
    applyModel3dLowPolyPresetToFaceCount: dashboardStudioRoutingMediaBootstrapHelpers?.applyModel3dLowPolyPresetToFaceCount,
    readModel3dPostOptions: dashboardStudioRoutingMediaBootstrapHelpers?.readModel3dPostOptions,
    validateModel3dPostOptions: dashboardStudioRoutingMediaBootstrapHelpers?.validateModel3dPostOptions,
    refreshModel3dPostDestinationOptions: dashboardStudioRoutingMediaBootstrapHelpers?.refreshModel3dPostDestinationOptions,
    dashboardAutomationChannelHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardAutomationChannelHelpers || null,
    refreshAutomationAndModelChannelSelectors: dashboardStudioRoutingMediaBootstrapHelpers?.refreshAutomationAndModelChannelSelectors,
    switchView: dashboardStudioRoutingMediaBootstrapHelpers?.switchView,
    dashboardAiStudioLayoutHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardAiStudioLayoutHelpers || null,
    openAiSection: dashboardStudioRoutingMediaBootstrapHelpers?.openAiSection,
    clearAiSectionFocus: dashboardStudioRoutingMediaBootstrapHelpers?.clearAiSectionFocus,
    applyAiSectionFocusState: dashboardStudioRoutingMediaBootstrapHelpers?.applyAiSectionFocusState,
    applyShellPaneState: dashboardStudioRoutingMediaBootstrapHelpers?.applyShellPaneState,
    enhanceShellChrome: dashboardStudioRoutingMediaBootstrapHelpers?.enhanceShellChrome,
    setDetailsPaneVisible: dashboardStudioRoutingMediaBootstrapHelpers?.setDetailsPaneVisible || setDetailsPaneVisible,
    setWorkspacePaneVisible: dashboardStudioRoutingMediaBootstrapHelpers?.setWorkspacePaneVisible,
    syncResponsiveShell: dashboardStudioRoutingMediaBootstrapHelpers?.syncResponsiveShell,
    bindShellOverlayEvents: dashboardStudioRoutingMediaBootstrapHelpers?.bindShellOverlayEvents,
    dashboardAudioUiHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardAudioUiHelpers || null,
    setAudioGenerationStatus: dashboardStudioRoutingMediaBootstrapHelpers?.setAudioGenerationStatus,
    setMusicGenerationStatus: dashboardStudioRoutingMediaBootstrapHelpers?.setMusicGenerationStatus,
    loadAudioHistory: dashboardStudioRoutingMediaBootstrapHelpers?.loadAudioHistory,
    syncAudioPreviewForFocus: dashboardStudioRoutingMediaBootstrapHelpers?.syncAudioPreviewForFocus,
    dashboardAiMediaStudioHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardAiMediaStudioHelpers || null,
    mergeAiImages: dashboardStudioRoutingMediaBootstrapHelpers?.mergeAiImages,
    clearAiImages: dashboardStudioRoutingMediaBootstrapHelpers?.clearAiImages,
    renderAiImageList: dashboardStudioRoutingMediaBootstrapHelpers?.renderAiImageList,
    renderAskComposerAttachments: dashboardStudioRoutingMediaBootstrapHelpers?.renderAskComposerAttachments,
    clearAskSkillModelUploads: dashboardStudioRoutingMediaBootstrapHelpers?.clearAskSkillModelUploads,
    clearAskFileUploads: dashboardStudioRoutingMediaBootstrapHelpers?.clearAskFileUploads,
    mergeModerationImages: dashboardStudioRoutingMediaBootstrapHelpers?.mergeModerationImages,
    clearModerationImages: dashboardStudioRoutingMediaBootstrapHelpers?.clearModerationImages,
    renderModerationImageList: dashboardStudioRoutingMediaBootstrapHelpers?.renderModerationImageList,
    setImageGenerationStatus: dashboardStudioRoutingMediaBootstrapHelpers?.setImageGenerationStatus,
    loadImageHistory: dashboardStudioRoutingMediaBootstrapHelpers?.loadImageHistory,
    setVideoGenerationStatus: dashboardStudioRoutingMediaBootstrapHelpers?.setVideoGenerationStatus,
    loadVideoHistory: dashboardStudioRoutingMediaBootstrapHelpers?.loadVideoHistory,
    dashboardGameEngineHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardGameEngineHelpers || null,
    dashboardModel3dQuickActionModalHelpers: dashboardStudioRoutingMediaBootstrapHelpers?.dashboardModel3dQuickActionModalHelpers || null,
    unloadMediaStudioPreviewForFocus: dashboardStudioRoutingMediaBootstrapHelpers?.unloadMediaStudioPreviewForFocus,
    refreshStudioPostTargetOptions: dashboardStudioRoutingMediaBootstrapHelpers?.refreshStudioPostTargetOptions,
    bindAiMediaStudioEvents: dashboardStudioRoutingMediaBootstrapHelpers?.bindAiMediaStudioEvents,
    applySelectedUser: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).applySelectedUser : undefined,
    getUserSearchQuery: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).getUserSearchQuery : undefined,
    renderUserResults: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).renderUserResults : undefined,
    loadUsers: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).loadUsers : loadUsers,
    renderGuildRail: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).renderGuildRail : undefined,
    selectGuild: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).selectGuild : undefined,
    updateSelectionDetails: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).updateSelectionDetails : updateSelectionDetails,
    loadChannels: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).loadChannels : undefined,
    renderChannelBrowser: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).renderChannelBrowser : renderChannelBrowser,
    selectChannel: dashboardDiscordWorkspaceHelpers ? createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers }).selectChannel : selectChannel
  };
}
