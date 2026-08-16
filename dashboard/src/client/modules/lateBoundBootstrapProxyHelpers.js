function createDashboardLateBoundBootstrapProxyHelpers(input) {
  return {
    dashboardSettingsRuntimeHelpersProxy: createLazyDashboardHelperProxy(
      () => input.getDashboardSettingsRuntimeHelpers(),
      { readLlmConnectionSettingsFromUi() {} }
    ),
    dashboardWorkspacePanelHelpersProxy: createLazyDashboardHelperProxy(
      () => input.getDashboardWorkspacePanelHelpers(),
      {}
    ),
    dashboardUserSearchHandlersProxy: createLazyDashboardHelperProxy(
      () => input.getDashboardUserSearchHandlers(),
      { bind() {} }
    ),
    dashboardConsoleHelpersProxy: createLazyDashboardHelperProxy(
      () => input.getDashboardConsoleHelpers(),
      {}
    ),
    dashboardModel3dStudioEventBindingHelpersProxy: createLazyDashboardHelperProxy(
      () => input.getDashboardModel3dStudioEventBindingHelpers(),
      {}
    )
  };
}
