function syncAutomationTargetsWithSelectedChannel(input, channelId) {
  const nextChannelId = String(channelId || "").trim();
  if (!nextChannelId) {
    return;
  }
  if (!input.state.selectedScheduledAutomationId && input.state.scheduledTargetMessenger === "discord") {
    input.state.scheduledTargetChannelId = nextChannelId;
  }
  if (!input.state.selectedJoinAutomationId) {
    input.state.joinTargetChannelId = nextChannelId;
  }
  if (typeof input.updateAutomationTargetChips === "function") {
    input.updateAutomationTargetChips();
  }
}

function createDashboardDiscordWorkspaceBootstrapHelpers(input) {
  const dashboardDiscordWorkspaceHelpers = typeof createDashboardDiscordWorkspaceHelpers === "function"
    ? createDashboardDiscordWorkspaceHelpers({
        state: input.state,
        request: input.request,
        setOutput: input.setOutput,
        clearChildren: input.clearChildren,
        escapeHtml: input.escapeHtml,
        loadBotMessages: (...args) => input.loadBotMessages(...args),
        setWorkspacePaneVisible: input.setWorkspacePaneVisible,
        updateImageScanChannelChip: () => input.dashboardGuildSettingsUiHelpers.updateImageScanChannelChip(),
        updateChatModeForm: () => input.dashboardGuildSettingsUiHelpers.updateChatModeForm(),
        loadChatModeDebug: (...args) => input.dashboardGuildSettingsUiHelpers.loadChatModeDebug(...args),
        updateChatModeUserChip: () => input.dashboardGuildSettingsUiHelpers.updateChatModeUserChip(),
        updateImagePoolVerifiedRoleChip: () => input.dashboardGuildSettingsUiHelpers.updateImagePoolVerifiedRoleChip(),
        updateImagePoolVerifiedUserChip: () => input.dashboardGuildSettingsUiHelpers.updateImagePoolVerifiedUserChip(),
        loadGuildSettings: input.loadSelectedGuildSettings,
        syncAutomationTargetsWithSelectedChannel: channelId => syncAutomationTargetsWithSelectedChannel(input, channelId),
        getActiveView: input.getActiveView,
        onChannelsLoaded: () => {
          input.refreshMeta.channels = Date.now();
        },
        openChannelSettings: input.openChannelSettings,
        refreshState: (...args) => input.refreshState(...args),
        loadAutomations: input.loadAutomations,
        refreshAutomationAndModelChannelSelectors: input.refreshAutomationAndModelChannelSelectors
      })
    : null;
  return {
    dashboardDiscordWorkspaceHelpers,
    ...createDashboardDiscordWorkspaceProxyHelpers({ helpers: dashboardDiscordWorkspaceHelpers })
  };
}
