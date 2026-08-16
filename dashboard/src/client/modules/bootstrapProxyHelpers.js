function createDashboardStudioSidebarProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    readStudioRailExpandedPreference: (...args) => helpers?.readStudioRailExpandedPreference?.(...args) ?? false,
    readStudioRailHoverModePreference: (...args) => helpers?.readStudioRailHoverModePreference?.(...args) ?? "temp-expand",
    applyStudioRailExpandedState: (...args) => helpers?.applyStudioRailExpandedState?.(...args),
    setStudioRailHoverMode: (...args) => helpers?.setStudioRailHoverMode?.(...args),
    setStudioRailExpanded: (...args) => helpers?.setStudioRailExpanded?.(...args),
    setWorkflowSidebarMode: (...args) => helpers?.setWorkflowSidebarMode?.(...args),
    readWorkflowRightSidebarPreference: (...args) => helpers?.readWorkflowRightSidebarPreference?.(...args) ?? { ask: false, model3d: false, image: false },
    applyWorkflowRightSidebarCollapsedState: (...args) => helpers?.applyWorkflowRightSidebarCollapsedState?.(...args),
    setWorkflowRightSidebarCollapsed: (...args) => helpers?.setWorkflowRightSidebarCollapsed?.(...args),
    readWorkflowRightSidebarWidthPreference: (...args) => helpers?.readWorkflowRightSidebarWidthPreference?.(...args) ?? { ask: 360, model3d: 380, image: 340, audio: 332, music: 332, video: 340 },
    applyWorkflowRightSidebarWidthState: (...args) => helpers?.applyWorkflowRightSidebarWidthState?.(...args),
    bindWorkflowRightSidebarResizers: (...args) => helpers?.bindWorkflowRightSidebarResizers?.(...args),
    bindStudioRailHoverExpansion: (...args) => helpers?.bindStudioRailHoverExpansion?.(...args),
    updateStudioWorkflowSidebar: (...args) => helpers?.updateStudioWorkflowSidebar?.(...args)
  };
}

function createDashboardAiStudioLayoutProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    openAiSection: (...args) => helpers?.openAiSection?.(...args),
    clearAiSectionFocus: (...args) => helpers?.clearAiSectionFocus?.(...args),
    applyAiSectionFocusState: (...args) => helpers?.applyAiSectionFocusState?.(...args)
  };
}

function createDashboardShellLayoutProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    applyShellPaneState: (...args) => helpers?.applyShellPaneState?.(...args),
    enhanceShellChrome: (...args) => helpers?.enhanceShellChrome?.(...args),
    setDetailsPaneVisible: (...args) => helpers?.setDetailsPaneVisible?.(...args),
    setWorkspacePaneVisible: (...args) => helpers?.setWorkspacePaneVisible?.(...args),
    syncResponsiveShell: (...args) => helpers?.syncResponsiveShell?.(...args),
    bindShellOverlayEvents: (...args) => helpers?.bindOverlayEvents?.(...args)
  };
}

function createDashboardDiscordWorkspaceProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    applySelectedUser: (...args) => helpers?.applySelectedUser?.(...args),
    getUserSearchQuery: (...args) => helpers?.getUserSearchQuery?.(...args) ?? "",
    renderUserResults: (...args) => helpers?.renderUserResults?.(...args),
    loadUsers: async (...args) => helpers?.loadUsers?.(...args),
    renderGuildRail: (...args) => helpers?.renderGuildRail?.(...args),
    selectGuild: async (...args) => helpers?.selectGuild?.(...args),
    updateSelectionDetails: (...args) => helpers?.updateSelectionDetails?.(...args),
    loadChannels: async (...args) => helpers?.loadChannels?.(...args),
    renderChannelBrowser: (...args) => helpers?.renderChannelBrowser?.(...args),
    selectChannel: (...args) => helpers?.selectChannel?.(...args)
  };
}

function createDashboardShellRuntimeThemeProxyHelpers(input) {
  const helpers = input?.helpers || input || null;
  return {
    normalizeDashboardTheme: value => helpers?.normalizeDashboardTheme?.(value) ?? "fire",
    getDashboardThemeLabel: value => helpers?.getDashboardThemeLabel?.(value) ?? String(value || "Theme"),
    readDashboardThemePreference: () => helpers?.readDashboardThemePreference?.() ?? "fire",
    shouldAnimateDashboardThemeTransition: options => helpers?.shouldAnimateDashboardThemeTransition?.(options) ?? false,
    setDashboardThemeTransitionEnabled: enabled => helpers?.setDashboardThemeTransitionEnabled?.(enabled),
    updateDashboardThemeButtons: () => helpers?.updateDashboardThemeButtons?.(),
    setDashboardTheme: (nextTheme, options) => helpers?.setDashboardTheme?.(nextTheme, options),
    getNextDashboardTheme: currentTheme => helpers?.getNextDashboardTheme?.(currentTheme) ?? "fire",
    normalizeMessenger: value => helpers?.normalizeMessenger?.(value) ?? String(value || "discord"),
    isDiscordOnlyView: view => helpers?.isDiscordOnlyView?.(view) ?? false,
    getActiveView: () => helpers?.getActiveView?.() ?? "",
    restoreStudioRightSidebarAsides: () => helpers?.restoreStudioRightSidebarAsides?.(),
    syncStudioRightSidebar: view => helpers?.syncStudioRightSidebar?.(view),
    getMessengerDisplayName: messenger => helpers?.getMessengerDisplayName?.(messenger) ?? String(messenger || "Messenger"),
    normalizeThemeTarget: value => helpers?.normalizeThemeTarget?.(value) ?? String(value || "dashboard"),
    applyMessengerThemeVariables: inputValue => helpers?.applyMessengerThemeVariables?.(inputValue),
    loadThemeConfig: target => helpers?.loadThemeConfig?.(target),
    applyThemeForCurrentContext: messenger => helpers?.applyThemeForCurrentContext?.(messenger),
    getSelectedMessengerRuntime: () => helpers?.getSelectedMessengerRuntime?.() ?? null,
    normalizeTelegramChatId: value => helpers?.normalizeTelegramChatId?.(value) ?? String(value || ""),
    getSelectedTelegramChat: () => helpers?.getSelectedTelegramChat?.() ?? null,
    setSelectedTelegramChatId: value => helpers?.setSelectedTelegramChatId?.(value),
    setRuntimeOverlayOpen: isOpen => helpers?.setRuntimeOverlayOpen?.(isOpen),
    setSettingsOverlayOpen: isOpen => helpers?.setSettingsOverlayOpen?.(isOpen),
    getRuntimeProgressValue: status => helpers?.getRuntimeProgressValue?.(status) ?? 0,
    formatRuntimeMeta: runtime => helpers?.formatRuntimeMeta?.(runtime) ?? "",
    updateMessengerRuntimeLaunchUi: () => helpers?.updateMessengerRuntimeLaunchUi?.(),
    renderMessengerRuntimePanel: () => helpers?.renderMessengerRuntimePanel?.(),
    updateMessengerWorkspaceSummary: () => helpers?.updateMessengerWorkspaceSummary?.(),
    applyMessengerSelectionUi: () => helpers?.applyMessengerSelectionUi?.()
  };
}

function createDashboardMessengerDashboardProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    getDashboardMessengerSubtitle: messenger => helpers?.getDashboardMessengerSubtitle?.(messenger) ?? "",
    formatRelativeTime: value => helpers?.formatRelativeTime?.(value) ?? "",
    getMessengerDashboardRecords: () => helpers?.getMessengerDashboardRecords?.() ?? [],
    renderMessengerDashboardRecentMessages: records => helpers?.renderMessengerDashboardRecentMessages?.(records),
    renderMessengerDashboardActivityBars: records => helpers?.renderMessengerDashboardActivityBars?.(records),
    renderMessengerDashboardCommandList: records => helpers?.renderMessengerDashboardCommandList?.(records),
    renderMessengerDashboardView: () => helpers?.renderMessengerDashboardView?.()
  };
}

function createDashboardSettingsRuntimeProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    applyGlobalSettingsToUi: settings => helpers?.applyGlobalSettingsToUi?.(settings),
    loadGlobalSettingsFromState: () => helpers?.loadGlobalSettingsFromState?.(),
    saveLlmConnectionSettingsFromUi: () => helpers?.saveLlmConnectionSettingsFromUi?.(),
    saveImageLlmConnectionSettingsFromUi: () => helpers?.saveImageLlmConnectionSettingsFromUi?.(),
    saveModel3dLlmConnectionSettingsFromUi: () => helpers?.saveModel3dLlmConnectionSettingsFromUi?.(),
    saveComfyPathSettingsFromUi: inputValue => helpers?.saveComfyPathSettingsFromUi?.(inputValue),
    saveMessagingGlobalSettingsFromUi: () => helpers?.saveMessagingGlobalSettingsFromUi?.(),
    saveQuickFfmpegSettingsFromUi: () => helpers?.saveQuickFfmpegSettingsFromUi?.(),
    saveMessengerRuntimeSettingsFromUi: () => helpers?.saveMessengerRuntimeSettingsFromUi?.(),
    loadMessengerRuntimes: () => helpers?.loadMessengerRuntimes?.(),
    controlSelectedMessengerRuntime: action => helpers?.controlSelectedMessengerRuntime?.(action),
    runInstallerFromUi: (...args) => helpers?.runInstallerFromUi?.(...args),
    describeClientError: (error, fallback) => helpers?.describeClientError?.(error, fallback) ?? fallback ?? String(error?.message || error || "Unknown error"),
    setRefreshStatus: (id, label, value) => helpers?.setRefreshStatus?.(id, label, value),
    setComfyPathSettingsStatus: (text, statusId) => helpers?.setComfyPathSettingsStatus?.(text, statusId),
    setQuickComfyPathSettingsStatus: text => helpers?.setQuickComfyPathSettingsStatus?.(text),
    setQuickFfmpegSettingsStatus: text => helpers?.setQuickFfmpegSettingsStatus?.(text),
    applyQuickComfyPathSettingsToUi: settings => helpers?.applyQuickComfyPathSettingsToUi?.(settings),
    applyQuickFfmpegSettingsToUi: settings => helpers?.applyQuickFfmpegSettingsToUi?.(settings),
    readQuickComfyPathSettingsFromUi: () => helpers?.readQuickComfyPathSettingsFromUi?.() ?? {}
  };
}

function createDashboardWorkspacePanelProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    switchSubview(...args) {
      return helpers?.switchSubview(...args);
    },
    switchDetailTab(...args) {
      return helpers?.switchDetailTab(...args);
    },
    bindSubviewTabs(...args) {
      return helpers?.bindSubviewTabs(...args);
    },
    initializeFoldAccordions(...args) {
      return helpers?.initializeFoldAccordions(...args);
    }
  };
}

function createDashboardAutomationStudioProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    renderScheduledAutomationList(...args) {
      return helpers?.renderScheduledAutomationList(...args);
    },
    renderJoinAutomationList(...args) {
      return helpers?.renderJoinAutomationList(...args);
    },
    setScheduledForm(...args) {
      return helpers?.setScheduledForm(...args);
    },
    setJoinForm(...args) {
      return helpers?.setJoinForm(...args);
    },
    loadAutomations(...args) {
      return helpers?.loadAutomations(...args);
    }
  };
}

function createDashboardGuildRuntimeProxyBindings(input) {
  const helpers = input?.helpers || null;
  return {
    loadGuilds: (...args) => helpers?.loadGuilds(...args),
    scheduleGuildRefreshRetry: (...args) => helpers?.scheduleGuildRefreshRetry(...args),
    loadDashboardDiscordChannels: (...args) => helpers?.loadDashboardDiscordChannels(...args),
    loadDashboardDiscordMessages: (...args) => helpers?.loadDashboardDiscordMessages(...args),
    renderGuildChannelPlan: (...args) => helpers?.renderGuildChannelPlan(...args),
    renderModerationSimulation: (...args) => helpers?.renderModerationSimulation(...args),
    loadBotMessages: (...args) => helpers?.loadBotMessages(...args),
    refreshState: (...args) => helpers?.refreshState(...args),
    initializeWorkspace: (...args) => helpers?.initializeWorkspace(...args)
  };
}

function createDashboardOverlayStateProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    setResourcesOverlayOpen(...args) {
      return helpers?.setResourcesOverlayOpen(...args);
    },
    setSkillsOverlayOpen(...args) {
      return helpers?.setSkillsOverlayOpen(...args);
    },
    setAboutOverlayOpen(...args) {
      return helpers?.setAboutOverlayOpen(...args);
    }
  };
}

function createDashboardModel3dSourceProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    inferModelImageFileNameHint: source => helpers?.inferModelImageFileNameHint?.(source) ?? "",
    normalizeModel3dLocalImageSourcePath: source => helpers?.normalizeModel3dLocalImageSourcePath?.(source) ?? "",
    extractUploadedModelImageFileNameFromSource: source => helpers?.extractUploadedModelImageFileNameFromSource?.(source) ?? "",
    extractGeneratedImagePathFromSource: source => helpers?.extractGeneratedImagePathFromSource?.(source) ?? "",
    resolveModel3dSourcePreviewUrl: source => helpers?.resolveModel3dSourcePreviewUrl?.(source) ?? "",
    getModel3dUploadSources: () => helpers?.getModel3dUploadSources?.() ?? [],
    getModel3dSelectedPool: () => helpers?.getModel3dSelectedPool?.() ?? null,
    syncModel3dSelectedPoolSources: () => helpers?.syncModel3dSelectedPoolSources?.(),
    renderModel3dSourceList: (containerId, sources, options) => helpers?.renderModel3dSourceList?.(containerId, sources, options),
    renderModel3dUploadSourceList: () => helpers?.renderModel3dUploadSourceList?.(),
    renderModel3dPoolSelectionList: () => helpers?.renderModel3dPoolSelectionList?.(),
    updateModel3dSourceHint: () => helpers?.updateModel3dSourceHint?.(),
    setModel3dGenerationBusy: value => helpers?.setModel3dGenerationBusy?.(value),
    collectModel3dSourceCandidates: () => helpers?.collectModel3dSourceCandidates?.() ?? [],
    readModel3dLowPolyOptionsFromUi: () => helpers?.readModel3dLowPolyOptionsFromUi?.() ?? {},
    summarizeMetallicDecision: decision => helpers?.summarizeMetallicDecision?.(decision) ?? "",
    summarizeRealWorldHeightDecision: decision => helpers?.summarizeRealWorldHeightDecision?.(decision) ?? "",
    postGeneratedModelToExternalMessengerFromStudio: (messenger, generated, destinationId) => helpers?.postGeneratedModelToExternalMessengerFromStudio?.(messenger, generated, destinationId)
  };
}

function createDashboardModel3dViewerProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    unloadModel3dViewerPreview: (...args) => helpers?.unloadModel3dViewerPreview?.(...args),
    activateModel3dViewerPreview: (...args) => helpers?.activateModel3dViewerPreview?.(...args),
    handleModel3dLowPolyUploadSourceChange: (...args) => helpers?.handleModel3dLowPolyUploadSourceChange?.(...args),
    loadModel3dHistory: (...args) => helpers?.loadModel3dHistory?.(...args),
    scheduleModel3dHistoryRefresh: (...args) => helpers?.scheduleModel3dHistoryRefresh?.(...args),
    renderModel3dHistory: (...args) => helpers?.renderModel3dHistory?.(...args),
    renderModel3dPreviewMedia: (...args) => helpers?.renderModel3dPreviewMedia?.(...args),
    getModel3dViewerTarget: (...args) => helpers?.getModel3dViewerTarget?.(...args),
    resolveModel3dPreviewMedia: (...args) => helpers?.resolveModel3dPreviewMedia?.(...args),
    renderModel3dViewer: (...args) => helpers?.renderModel3dViewer?.(...args),
    renderModel3dPreviewGifDataUrl: (...args) => helpers?.renderModel3dPreviewGifDataUrl?.(...args),
    exportModel3dPreviewGif: (...args) => helpers?.exportModel3dPreviewGif?.(...args),
    setModel3dThreeVariant: (...args) => helpers?.setModel3dThreeVariant?.(...args),
    updateModel3dThreeVariantUi: (...args) => helpers?.updateModel3dThreeVariantUi?.(...args),
    setModel3dViewerWireframeEnabled: (...args) => helpers?.setModel3dViewerWireframeEnabled?.(...args),
    setModel3dViewerMetallicEnabled: (...args) => helpers?.setModel3dViewerMetallicEnabled?.(...args),
    updateModel3dViewerMaterialToggleButtons: (...args) => helpers?.updateModel3dViewerMaterialToggleButtons?.(...args),
    updateModel3dViewerRoughnessUi: (...args) => helpers?.updateModel3dViewerRoughnessUi?.(...args),
    setModel3dViewerRoughness: (...args) => helpers?.setModel3dViewerRoughness?.(...args),
    setModel3dViewerTextureEnabled: (...args) => helpers?.setModel3dViewerTextureEnabled?.(...args),
    setModel3dViewerMaterialMode: (...args) => helpers?.setModel3dViewerMaterialMode?.(...args),
    setModel3dViewerFlatShadingEnabled: (...args) => helpers?.setModel3dViewerFlatShadingEnabled?.(...args),
    setModel3dViewerGridEnabled: (...args) => helpers?.setModel3dViewerGridEnabled?.(...args),
    setModel3dViewerSkyboxEnabled: (...args) => helpers?.setModel3dViewerSkyboxEnabled?.(...args),
    setModel3dViewerRigVisible: (...args) => helpers?.setModel3dViewerRigVisible?.(...args),
    setModel3dViewerAxisMode: (...args) => helpers?.setModel3dViewerAxisMode?.(...args),
    getModel3dPreviewRenderOptions: (...args) => helpers?.getModel3dPreviewRenderOptions?.(...args) ?? {},
    applyModel3dPreviewViewSettings: (...args) => helpers?.applyModel3dPreviewViewSettings?.(...args)
  };
}

function createDashboardModel3dViewportModalProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    updateModel3dGifExportBackgroundField: (...args) => helpers?.updateModel3dGifExportBackgroundField(...args),
    openModel3dGifExportModal: (...args) => helpers?.openModel3dGifExportModal(...args),
    closeModel3dGifExportModal: (...args) => helpers?.closeModel3dGifExportModal(...args),
    readModel3dGifExportOptions: (...args) => helpers?.readModel3dGifExportOptions(...args),
    openSelectedModelInBlender: (...args) => helpers?.openSelectedModelInBlender(...args),
    openModel3dShareOverlay: (...args) => helpers?.openModel3dShareOverlay(...args)
  };
}

function createDashboardModel3dStudioActionProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    requestModel3dGenerationWithPreviewStream: (...args) => helpers?.requestModel3dGenerationWithPreviewStream(...args),
    runModel3dGenerationFromStudio: (...args) => helpers?.runModel3dGenerationFromStudio(...args),
    runModel3dSeparateByLoosePartsForSelectedModel: (...args) => helpers?.runModel3dSeparateByLoosePartsForSelectedModel(...args),
    runLowPolyGenerationForSelectedModel: (...args) => helpers?.runLowPolyGenerationForSelectedModel(...args),
    runModel3dLlmScaleForSelectedModel: (...args) => helpers?.runModel3dLlmScaleForSelectedModel(...args),
    renderAutoRigVerification: (...args) => helpers?.renderAutoRigVerification(...args),
    openAutoRigPanelForSelectedModel: (...args) => helpers?.openAutoRigPanelForSelectedModel(...args),
    runAutoRigPreviewForSelectedModel: (...args) => helpers?.runAutoRigPreviewForSelectedModel(...args),
    finalizeAutoRigForSelectedModel: (...args) => helpers?.finalizeAutoRigForSelectedModel(...args)
  };
}

function createDashboardAiWorkflowDataProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    unloadAudioElementPreview: (...args) => helpers?.unloadAudioElementPreview(...args),
    unloadInactiveStudioWorkflowPreviews: (...args) => helpers?.unloadInactiveStudioWorkflowPreviews(...args),
    ensureImagePoolDataLoaded: (...args) => helpers?.ensureImagePoolDataLoaded(...args),
    ensureAiWorkflowDataLoaded: (...args) => helpers?.ensureAiWorkflowDataLoaded(...args)
  };
}

function createDashboardAutomationBootstrapProxyHelpers(input) {
  const resolveHelpers = () => input?.getHelpers ? input.getHelpers() : input?.helpers || null;
  return {
    bindAutomationStudioEvents: (...args) => resolveHelpers()?.bindEvents(...args),
    loadAutomationPresets: (...args) => resolveHelpers()?.loadAutomationPresets(...args),
    refreshAutomationTextSources: (...args) => resolveHelpers()?.refreshAutomationTextSources(...args)
  };
}

function createDashboardLlmModelSelectionProxyHelpers(input) {
  const helpers = input?.helpers || null;
  return {
    loadOllamaModels: (...args) => helpers?.loadOllamaModels(...args),
    syncWorkflowLlmModelSelectionUi: (...args) => helpers?.syncWorkflowLlmModelSelectionUi(...args),
    syncLlmModelSelectionUi: (...args) => helpers?.syncLlmModelSelectionUi(...args),
    getSelectedLlmModelsFromUi: (...args) => helpers?.getSelectedLlmModelsFromUi(...args) || {
      ollamaTextModel: "",
      ollamaVisionModel: "",
      useTextModelAsVisual: false
    },
    saveSelectedLlmModelsFromUi: (...args) => helpers?.saveSelectedLlmModelsFromUi(...args),
    loadActiveLlmModels: (...args) => helpers?.loadActiveLlmModels(...args)
  };
}
