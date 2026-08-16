function createDashboardMessengerDashboardFallback() {
  return {
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
}

function createDashboardRefreshMetaState() {
  return {
    guilds: 0,
    channels: 0,
    ollamaModels: 0,
    botMessages: 0,
    automationTextSources: 0
  };
}

function createDashboardGuildRefreshState() {
  return {
    attempts: 0,
    timer: 0
  };
}

function createDashboardShellBootstrapHelpers(input) {
  const dashboardStudioSidebarHelpers = typeof createDashboardStudioSidebarHelpers === "function"
    ? createDashboardStudioSidebarHelpers({
        state: input.state,
        getActiveView: () => input.getActiveView(),
        studioWorkflowSidebarMeta: input.studioWorkflowSidebarMeta,
        workflowRightSidebarTargets: input.workflowRightSidebarTargets,
        studioRailExpandedStorageKey: input.studioRailExpandedStorageKey,
        studioRailHoverModeStorageKey: input.studioRailHoverModeStorageKey,
        studioWorkflowSidebarModeStorageKey: input.studioWorkflowSidebarModeStorageKey,
        workflowRightSidebarStateStorageKey: input.workflowRightSidebarStateStorageKey,
        workflowRightSidebarWidthStorageKey: input.workflowRightSidebarWidthStorageKey
      })
    : null;
  const dashboardShellRuntimeThemeHelpers = typeof createDashboardShellRuntimeThemeHelpers === "function"
    ? createDashboardShellRuntimeThemeHelpers({
        state: input.state,
        request: input.request,
        formatDateTime: input.formatDateTime,
        updateAutomationTargetChips: () => {
          if (typeof input.updateAutomationTargetChips === "function") {
            input.updateAutomationTargetChips();
          }
        },
        renderMessengerDashboardView: () => {
          if (typeof input.renderMessengerDashboardView === "function") {
            input.renderMessengerDashboardView();
          }
        }
      })
    : null;
  const dashboardShellRuntimeThemeFallback = createDashboardShellRuntimeThemeFallback({ state: input.state });
  const dashboardShellRuntimeTheme = dashboardShellRuntimeThemeHelpers || dashboardShellRuntimeThemeFallback;
  const shellRuntimeThemeProxyHelpers = createDashboardShellRuntimeThemeProxyHelpers({ helpers: dashboardShellRuntimeTheme });
  const normalizeMatrixRoomId = value => String(value || "").trim();
  const normalizeScheduledTargetMessenger = value => value === "telegram" || value === "matrix" ? value : "discord";
  const refreshMeta = createDashboardRefreshMetaState();
  const guildRefresh = createDashboardGuildRefreshState();
  const dashboardMessengerDashboardHelpers = typeof createDashboardMessengerDashboardHelpers === "function"
    ? createDashboardMessengerDashboardHelpers({
        state: input.state,
        clearChildren: input.clearChildren,
        escapeHtml: input.escapeHtml,
        formatDateTime: input.formatDateTime,
        setDashboardText: input.setDashboardText,
        getSelectedMessengerRuntime: shellRuntimeThemeProxyHelpers.getSelectedMessengerRuntime,
        normalizeMessenger: shellRuntimeThemeProxyHelpers.normalizeMessenger,
        getMessengerDisplayName: shellRuntimeThemeProxyHelpers.getMessengerDisplayName,
        formatRuntimeMeta: shellRuntimeThemeProxyHelpers.formatRuntimeMeta,
        getSelectedTelegramChat: shellRuntimeThemeProxyHelpers.getSelectedTelegramChat,
        normalizeTelegramChatId: shellRuntimeThemeProxyHelpers.normalizeTelegramChatId,
        getTelegramChatTitle: input.getTelegramChatTitle,
        getRefreshMeta: () => refreshMeta
      })
    : null;
  const dashboardMessengerDashboard = dashboardMessengerDashboardHelpers || createDashboardMessengerDashboardFallback();
  const messengerDashboardProxyHelpers = createDashboardMessengerDashboardProxyHelpers({ helpers: dashboardMessengerDashboard });
  return {
    dashboardStudioSidebarHelpers,
    normalizeMatrixRoomId,
    normalizeScheduledTargetMessenger,
    refreshMeta,
    guildRefresh,
    ...shellRuntimeThemeProxyHelpers,
    ...messengerDashboardProxyHelpers
  };
}
