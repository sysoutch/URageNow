function createDashboardGuildRuntimeProxyHelpers(getRuntimeHelpers) {
  function withRuntime(method, args) {
    return getRuntimeHelpers()[method](...args);
  }
  return {
    loadGuilds(...args) {
      return withRuntime("loadGuilds", args);
    },
    scheduleGuildRefreshRetry(...args) {
      return withRuntime("scheduleGuildRefreshRetry", args);
    },
    loadDashboardDiscordChannels(...args) {
      return withRuntime("loadDashboardDiscordChannels", args);
    },
    loadDashboardDiscordMessages(...args) {
      return withRuntime("loadDashboardDiscordMessages", args);
    },
    renderGuildChannelPlan(...args) {
      return withRuntime("renderGuildChannelPlan", args);
    },
    renderModerationSimulation(...args) {
      return withRuntime("renderModerationSimulation", args);
    },
    loadBotMessages(...args) {
      return withRuntime("loadBotMessages", args);
    },
    refreshState(...args) {
      return withRuntime("refreshState", args);
    },
    initializeWorkspace(...args) {
      return withRuntime("initializeWorkspace", args);
    }
  };
}
