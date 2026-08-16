function createDashboardMessengerWorkspaceBootstrapHelpers(input) {
  const state = input?.state || {};
  const clearChildren = input?.clearChildren;
  const escapeHtml = input?.escapeHtml;
  const formatDateTime = input?.formatDateTime;
  const renderMarkdownInto = input?.renderMarkdownInto;
  const renderMessengerDashboardView = input?.renderMessengerDashboardView;
  const refreshMeta = input?.refreshMeta;
  const guildRefresh = input?.guildRefresh;
  const request = input?.request;
  const setOutput = input?.setOutput;
  const setHeroBotTag = input?.setHeroBotTag;
  const renderGuildRail = input?.renderGuildRail;
  const renderChannelBrowser = input?.renderChannelBrowser;
  const updateSelectionDetails = input?.updateSelectionDetails;
  const dashboardGuildSettingsUiHelpers = input?.dashboardGuildSettingsUiHelpers || {};
  const refreshAutomationAndModelChannelSelectors = input?.refreshAutomationAndModelChannelSelectors;
  const setRefreshStatus = input?.setRefreshStatus;
  const loadMessengerRuntimes = input?.loadMessengerRuntimes;
  const loadChannels = input?.loadChannels;
  const getMessengerDisplayName = input?.getMessengerDisplayName;
  const loadGlobalSettingsFromState = input?.loadGlobalSettingsFromState;
  const refreshAutomationTextSources = input?.refreshAutomationTextSources;
  const dashboardAutomationStudioHelpers = input?.dashboardAutomationStudioHelpers || null;

  const dashboardBotMessageHelpers = typeof createDashboardBotMessageHelpers === "function"
    ? createDashboardBotMessageHelpers({
      state,
      clearChildren,
      escapeHtml,
      formatDateTime,
      renderMarkdownInto,
      renderMessengerDashboardView
    })
    : null;
  const updateBotMessageSelectionSummary = dashboardBotMessageHelpers
    ? dashboardBotMessageHelpers.updateBotMessageSelectionSummary
    : function updateBotMessageSelectionSummaryFallback() {};
  const renderBotMessageList = dashboardBotMessageHelpers
    ? dashboardBotMessageHelpers.renderBotMessageList
    : function renderBotMessageListFallback() {};

  const guildRuntimeHelpers = createDashboardGuildChannelRuntimeHelpers({
    state,
    refreshMeta,
    guildRefresh,
    request,
    setOutput,
    clearChildren,
    escapeHtml,
    setHeroBotTag,
    renderGuildRail,
    renderChannelBrowser,
    updateSelectionDetails,
    renderGuildPermissions: () => dashboardGuildSettingsUiHelpers.renderGuildPermissions(),
    renderChannelPermissions: () => dashboardGuildSettingsUiHelpers.renderChannelPermissions(),
    refreshAutomationAndModelChannelSelectors,
    renderMessengerDashboardView,
    renderBotMessageList,
    setRefreshStatus,
    loadMessengerRuntimes,
    loadChannels,
    getMessengerDisplayName,
    loadGlobalSettingsFromState,
    refreshAutomationTextSources
  });
  const guildRuntimeProxyHelpers = typeof createDashboardGuildRuntimeProxyHelpers === "function"
    ? createDashboardGuildRuntimeProxyHelpers(() => guildRuntimeHelpers)
    : null;
  const {
    loadGuilds,
    scheduleGuildRefreshRetry,
    loadDashboardDiscordChannels,
    loadDashboardDiscordMessages,
    renderGuildChannelPlan,
    renderModerationSimulation,
    loadBotMessages,
    refreshState,
    initializeWorkspace
  } = createDashboardGuildRuntimeProxyBindings({ helpers: guildRuntimeProxyHelpers });

  const dashboardAutomationStudioProxyHelpers = typeof createDashboardAutomationStudioProxyHelpers === "function"
    ? createDashboardAutomationStudioProxyHelpers({ helpers: dashboardAutomationStudioHelpers })
    : createDashboardAutomationStudioProxyHelpers();
  const { renderScheduledAutomationList, renderJoinAutomationList, setScheduledForm, setJoinForm, loadAutomations } =
    dashboardAutomationStudioProxyHelpers;

  return {
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
