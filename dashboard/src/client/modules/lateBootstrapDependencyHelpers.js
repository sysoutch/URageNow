function createDashboardLateBootstrapDependencyHelpers(input) {
  const {
    state,
    request,
    refreshMeta,
    guildRefresh,
    clearChildren,
    escapeHtml,
    formatDateTime,
    renderMarkdownInto,
    renderMessengerDashboardView,
    setOutput,
    setHeroBotTag,
    renderGuildRail,
    renderChannelBrowser,
    updateSelectionDetails,
    dashboardGuildSettingsUiHelpers,
    refreshAutomationAndModelChannelSelectors,
    setRefreshStatus,
    loadMessengerRuntimes,
    loadChannels,
    getMessengerDisplayName,
    loadGlobalSettingsFromState,
    refreshAutomationTextSources,
    dashboardSettingsRuntimeHelpers,
    getScheduledModelPostOptionsModule,
    getModel3dInitialExtraSampleText,
    getModel3dDestinationExtraSampleText,
    getAutomationScopeId,
    normalizeScheduledTargetMessenger,
    normalizeTelegramChatId,
    normalizeMatrixRoomId,
    formatImagePostProcessingRecipes,
    parseImagePostProcessingRecipes,
    setMultiSelectValues,
    getMultiSelectValues,
    setElementValue,
    setElementChecked,
    fillPresetSelect,
    loadAutomationTextSources
  } = input;

  const dashboardAutomationViewHelpers = typeof createDashboardAutomationViewHelpers === "function"
    ? createDashboardAutomationViewHelpers({
        state,
        getScheduledModelPostOptionsModule
      })
    : null;
  const resolveChannelLabel = dashboardAutomationViewHelpers
    ? dashboardAutomationViewHelpers.resolveChannelLabel
    : function resolveChannelLabelFallback(channelId, fallback, messenger) {
        if (messenger === "telegram") {
          return fallback || (channelId ? "Telegram chat " + channelId : "No Telegram chat selected");
        }
        return fallback || channelId || "No channel selected";
      };
  const updateScheduledTargetModeUi = dashboardAutomationViewHelpers
    ? dashboardAutomationViewHelpers.updateScheduledTargetModeUi
    : function updateScheduledTargetModeUiFallback() {};
  const updateScheduledSourceFields = dashboardAutomationViewHelpers
    ? dashboardAutomationViewHelpers.updateScheduledSourceFields
    : function updateScheduledSourceFieldsFallback() {};
  const updateScheduledModelPostOptionsUi = dashboardAutomationViewHelpers
    ? dashboardAutomationViewHelpers.updateScheduledModelPostOptionsUi
    : function updateScheduledModelPostOptionsUiFallback() {};
  const updateJoinSourceFields = dashboardAutomationViewHelpers
    ? dashboardAutomationViewHelpers.updateJoinSourceFields
    : function updateJoinSourceFieldsFallback() {};
  const updateAutomationTargetChips = input.dashboardAutomationChannelHelpers
    ? input.dashboardAutomationChannelHelpers.updateAutomationTargetChips
    : function updateAutomationTargetChipsFallback() {};
  const dashboardAutomationStudioHelpers = typeof createDashboardAutomationStudioHelpers === "function"
    ? createDashboardAutomationStudioHelpers({
        state,
        request,
        clearChildren,
        escapeHtml,
        resolveChannelLabel,
        normalizeScheduledTargetMessenger,
        normalizeTelegramChatId,
        normalizeMatrixRoomId,
        formatImagePostProcessingRecipes,
        parseImagePostProcessingRecipes,
        getModel3dInitialExtraSampleText,
        getModel3dDestinationExtraSampleText,
        getScheduledModelPostOptionsModule,
        getAutomationScopeId,
        setMultiSelectValues,
        getMultiSelectValues,
        switchScheduledTriggerMode: mode => dashboardAutomationViewHelpers.switchScheduledTriggerMode(mode),
        switchScheduleMode: mode => dashboardAutomationViewHelpers.switchScheduleMode(mode),
        parseCronToBasic: cron => dashboardAutomationViewHelpers.parseCronToBasic(cron),
        updateScheduledSourceFields,
        updateScheduledModelPostOptionsUi,
        updateJoinSourceFields,
        updateAutomationTargetChips,
        setOutput,
        setElementValue,
        setElementChecked
      })
    : null;
  const dashboardAutomationBootstrapHelpers = typeof createDashboardAutomationBootstrapHelpers === "function"
    ? createDashboardAutomationBootstrapHelpers({
        state,
        refreshMeta,
        request,
        fillPresetSelect,
        loadAutomationTextSources,
        setRefreshStatus,
        bindAutomationStudioEvents: () => dashboardAutomationStudioHelpers?.bindEvents()
      })
    : null;
  const dashboardLlmModelSelectionHelpers = typeof createDashboardLlmModelSelectionHelpers === "function"
    ? createDashboardLlmModelSelectionHelpers({
        state,
        refreshMeta,
        request,
        setRefreshStatus,
        readLlmConnectionSettingsFromUi: () => dashboardSettingsRuntimeHelpers.readLlmConnectionSettingsFromUi()
      })
    : null;
  const {
    loadOllamaModels,
    syncWorkflowLlmModelSelectionUi,
    syncLlmModelSelectionUi,
    getSelectedLlmModelsFromUi,
    saveSelectedLlmModelsFromUi,
    loadActiveLlmModels
  } = createDashboardLlmModelSelectionProxyHelpers({ helpers: dashboardLlmModelSelectionHelpers });
  const dashboardWorkspacePanelProxyHelpers = typeof createDashboardWorkspacePanelProxyHelpers === "function"
    ? createDashboardWorkspacePanelProxyHelpers({ helpers: input.dashboardWorkspacePanelHelpers })
    : createDashboardWorkspacePanelProxyHelpers();
  const { switchSubview, switchDetailTab, bindSubviewTabs, initializeFoldAccordions } = dashboardWorkspacePanelProxyHelpers;
  const dashboardMessengerWorkspaceBootstrapHelpers = typeof createDashboardMessengerWorkspaceBootstrapHelpers === "function"
    ? createDashboardMessengerWorkspaceBootstrapHelpers({
        state,
        clearChildren,
        escapeHtml,
        formatDateTime,
        renderMarkdownInto,
        renderMessengerDashboardView,
        refreshMeta,
        guildRefresh,
        request,
        setOutput,
        setHeroBotTag,
        renderGuildRail,
        renderChannelBrowser,
        updateSelectionDetails,
        dashboardGuildSettingsUiHelpers,
        refreshAutomationAndModelChannelSelectors,
        setRefreshStatus,
        loadMessengerRuntimes,
        loadChannels,
        getMessengerDisplayName,
        loadGlobalSettingsFromState,
        refreshAutomationTextSources,
        dashboardAutomationStudioHelpers
      })
    : null;
  const {
    updateBotMessageSelectionSummary = function updateBotMessageSelectionSummaryFallback() {},
    renderBotMessageList = function renderBotMessageListFallback() {},
    guildRuntimeHelpers = null,
    loadGuilds,
    scheduleGuildRefreshRetry,
    loadDashboardDiscordChannels,
    loadDashboardDiscordMessages,
    renderGuildChannelPlan,
    renderModerationSimulation,
    loadBotMessages,
    refreshState,
    initializeWorkspace,
    renderScheduledAutomationList,
    renderJoinAutomationList,
    setScheduledForm,
    setJoinForm,
    loadAutomations
  } = dashboardMessengerWorkspaceBootstrapHelpers || {};

  return {
    dashboardAutomationViewHelpers,
    updateScheduledTargetModeUi,
    updateScheduledSourceFields,
    updateScheduledModelPostOptionsUi,
    updateJoinSourceFields,
    updateAutomationTargetChips,
    dashboardAutomationStudioHelpers,
    dashboardAutomationBootstrapHelpers,
    loadOllamaModels,
    syncWorkflowLlmModelSelectionUi,
    syncLlmModelSelectionUi,
    getSelectedLlmModelsFromUi,
    saveSelectedLlmModelsFromUi,
    loadActiveLlmModels,
    switchSubview,
    switchDetailTab,
    bindSubviewTabs,
    initializeFoldAccordions,
    updateBotMessageSelectionSummary,
    renderBotMessageList,
    guildRuntimeHelpers,
    loadGuilds,
    scheduleGuildRefreshRetry,
    loadDashboardDiscordChannels,
    loadDashboardDiscordMessages,
    renderGuildChannelPlan,
    renderModerationSimulation,
    loadBotMessages,
    refreshState,
    initializeWorkspace,
    renderScheduledAutomationList,
    renderJoinAutomationList,
    setScheduledForm,
    setJoinForm,
    loadAutomations
  };
}
