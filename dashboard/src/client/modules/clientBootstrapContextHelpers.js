function createDashboardClientBootstrapContext(input) {
  const normalizedInput = input && typeof input === "object" ? input : {};
  const state = createDashboardClientState();
  const dashboardBootstrapConfig = createDashboardClientBootstrapConfig();
  const dashboardLazyMediaHelpers = createDashboardLazyMediaHelpers();
  let dashboardSettingsRuntimeHelpers = null;
  let dashboardGuildChannelRuntimeHelpers = null;
  const dashboardRuntimeBridgeHelpers = typeof createDashboardClientRuntimeBridgeHelpers === "function"
    ? createDashboardClientRuntimeBridgeHelpers({
        getSettingsRuntimeHelpers: () => dashboardSettingsRuntimeHelpers,
        getGuildChannelRuntimeHelpers: () => dashboardGuildChannelRuntimeHelpers,
        getSwitchView: () => normalizedInput.getSwitchView?.(),
        getConsoleHelpers: () => normalizedInput.getConsoleHelpers?.()
      })
    : null;
  return {
    state,
    dashboardBootstrapConfig,
    attachDashboardLazyMedia: dashboardLazyMediaHelpers.attach,
    pixelArtConversionRequests: new Map(),
    toolWorkspaceImageExportRequests: new Map(),
    pixelArtReadyWaiters: [],
    stageMeta: dashboardBootstrapConfig.stageMeta,
    studioWorkflowSidebarMeta: dashboardBootstrapConfig.studioWorkflowSidebarMeta,
    toolsWorkspaceState: dashboardBootstrapConfig.toolsWorkspaceState,
    toolsWorkspaceStorageKeys: dashboardBootstrapConfig.toolsWorkspaceStorageKeys,
    toolQuickActionStorageKeys: dashboardBootstrapConfig.toolQuickActionStorageKeys,
    toolQuickActionState: dashboardBootstrapConfig.toolQuickActionState,
    studioRailExpandedStorageKey: dashboardBootstrapConfig.studioRailExpandedStorageKey,
    studioRailHoverModeStorageKey: dashboardBootstrapConfig.studioRailHoverModeStorageKey,
    workflowRightSidebarStateStorageKey: dashboardBootstrapConfig.workflowRightSidebarStateStorageKey,
    workflowRightSidebarWidthStorageKey: dashboardBootstrapConfig.workflowRightSidebarWidthStorageKey,
    workflowRightSidebarTargets: dashboardBootstrapConfig.workflowRightSidebarTargets,
    request: dashboardRuntimeBridgeHelpers
      ? dashboardRuntimeBridgeHelpers.request
      : function requestFallback() {
          throw new Error("Dashboard runtime bridge helpers are not ready.");
        },
    getDashboardGuildChannelRuntimeHelpers: dashboardRuntimeBridgeHelpers
      ? dashboardRuntimeBridgeHelpers.getDashboardGuildChannelRuntimeHelpers
      : function getDashboardGuildChannelRuntimeHelpersFallback() {
          throw new Error("Dashboard runtime bridge helpers are not ready.");
        },
    setDashboardText: dashboardRuntimeBridgeHelpers
      ? dashboardRuntimeBridgeHelpers.setDashboardText
      : function setDashboardTextFallback() {},
    switchDashboardView: dashboardRuntimeBridgeHelpers
      ? dashboardRuntimeBridgeHelpers.switchDashboardView
      : function switchDashboardViewFallback(view) {
          const switchView = normalizedInput.getSwitchView?.();
          return typeof switchView === "function" ? switchView(view) : undefined;
        },
    setConsoleOverlayOpen: dashboardRuntimeBridgeHelpers
      ? dashboardRuntimeBridgeHelpers.setConsoleOverlayOpen
      : function setConsoleOverlayOpenFallback() {},
    setDashboardSettingsRuntimeHelpers(value) {
      dashboardSettingsRuntimeHelpers = value || null;
    },
    getDashboardSettingsRuntimeHelpers() {
      return dashboardSettingsRuntimeHelpers;
    },
    setDashboardGuildChannelRuntimeHelpers(value) {
      dashboardGuildChannelRuntimeHelpers = value || null;
    },
    async loadChannelSettings() {
      return;
    },
    async loadChannelPermissionSummary() {
      return;
    }
  };
}
