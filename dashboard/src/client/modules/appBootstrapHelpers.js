function createDashboardAppBootstrapHelpers(input) {
  const {
    state,
    dashboardOverlayHelpers,
    dashboardConsoleHelpers,
    dashboardQuickActionsHelpers,
    dashboardGameEngineHelpers,
    dashboardMessagingHandlers,
    dashboardSettingsEventBindingHelpers,
    dashboardModel3dStudioEventBindingHelpers,
    handlePixelArtToolMessage,
    handleToolWorkspaceBridgeMessage,
    bindAiActions,
    bindAiMediaStudioEvents,
    bindImagePoolEvents,
    bindAutomationTextSourceEvents,
    bindToolsViewEvents,
    bindAiToolQuickActionEvents,
    bindShellOverlayEvents,
    enhanceShellChrome,
    applyAiSectionFocusState,
    updateStudioWorkflowSidebar,
    initializeFoldAccordions,
    setStudioRailExpanded,
    readStudioRailExpandedPreference,
    readWorkflowRightSidebarPreference,
    readWorkflowRightSidebarWidthPreference,
    applyWorkflowRightSidebarCollapsedState,
    applyWorkflowRightSidebarWidthState,
    bindWorkflowRightSidebarResizers,
    bindStudioRailHoverExpansion,
    syncResponsiveShell,
    applyStudioRailExpandedState,
    setRuntimeOverlayOpen,
    setSettingsOverlayOpen,
    setResourcesOverlayOpen,
    setSkillsOverlayOpen,
    setDashboardTheme,
    readDashboardThemePreference,
    setSelectedMessenger,
    refreshState,
    initializeWorkspace,
    dashboardAutomationViewHelpers,
    updateScheduledSourceFields,
    updateJoinSourceFields,
    updateAutomationTargetChips,
    updateAutomationTextPromptPreset,
    dashboardAiStudioLayoutHelpers,
    switchDetailTab,
    switchSubview,
    bindSubviewTabs,
    renderAiImageList,
    renderModerationImageList,
    renderGuildChannelPlan,
    renderMarkdownInto,
    updateModel3dPostOptionsUi,
    setModel3dStatus,
    setImageGenerationStatus,
    setAudioGenerationStatus,
    setMusicGenerationStatus,
    setVideoGenerationStatus,
    updateModel3dThreeVariantUi,
    updateModel3dViewerMaterialToggleButtons,
    setModel3dPreviewStatus,
    setModel3dThreeStatus,
    switchView,
    renderMessengerRuntimePanel,
    renderTelegramChats,
    updateMessengerWorkspaceSummary,
    loadMessengerRuntimes
  } = input;
  function bindRuntimeEvents() {
    dashboardOverlayHelpers?.bindEvents();
    dashboardConsoleHelpers?.bindEvents();
    dashboardQuickActionsHelpers?.bindEvents();
    window.addEventListener("message", event => {
      void handlePixelArtToolMessage(event);
      handleToolWorkspaceBridgeMessage(event);
    });
    bindAiActions();
    bindAiMediaStudioEvents();
    dashboardGameEngineHelpers?.bindActions();
    bindImagePoolEvents();
    bindAutomationTextSourceEvents();
    bindToolsViewEvents();
    bindAiToolQuickActionEvents();
    bindShellOverlayEvents();
    dashboardMessagingHandlers?.bind();
    dashboardSettingsEventBindingHelpers?.bindSettingsEvents();
    dashboardModel3dStudioEventBindingHelpers?.bindModel3dStudioEvents();
  }
  async function bootstrap() {
    enhanceShellChrome();
    applyAiSectionFocusState();
    updateStudioWorkflowSidebar();
    initializeFoldAccordions();
    setStudioRailExpanded(readStudioRailExpandedPreference(), { persist: false });
    state.workflowRightSidebarCollapsed = readWorkflowRightSidebarPreference();
    state.workflowRightSidebarWidth = readWorkflowRightSidebarWidthPreference();
    applyWorkflowRightSidebarCollapsedState();
    applyWorkflowRightSidebarWidthState();
    bindWorkflowRightSidebarResizers();
    bindStudioRailHoverExpansion();
    syncResponsiveShell();
    window.addEventListener("resize", () => {
      syncResponsiveShell();
      applyStudioRailExpandedState();
    });
    setRuntimeOverlayOpen(false);
    setSettingsOverlayOpen(false);
    setResourcesOverlayOpen(false);
    setSkillsOverlayOpen(false);
    setDashboardTheme(readDashboardThemePreference(), { persist: false, animate: false });
    setSelectedMessenger(state.selectedMessenger);
    await refreshState();
    await initializeWorkspace();
    await dashboardAiStudioLayoutHelpers?.ensureStudioHomeDataLoaded?.();
    dashboardAiStudioLayoutHelpers?.renderStudioHome?.();
    dashboardAutomationViewHelpers?.switchAutomationPanel("scheduled");
    dashboardAutomationViewHelpers?.switchScheduleMode("basic");
    updateScheduledSourceFields();
    updateJoinSourceFields();
    updateAutomationTargetChips();
    updateAutomationTextPromptPreset();
    dashboardAutomationViewHelpers?.switchChannelSettingsTab("discord");
    dashboardAiStudioLayoutHelpers?.switchModel3dStudioTab("generate");
    dashboardAiStudioLayoutHelpers?.switchImageStudioTab("generate");
    switchDetailTab("current");
    switchSubview("guild", state.guildSubview);
    switchSubview("moderation", state.moderationSubview);
    bindSubviewTabs();
    renderAiImageList();
    renderModerationImageList();
    renderGuildChannelPlan();
    renderMarkdownInto("main-output", "Ready.", "Ready.");
    renderMarkdownInto("ask-output", "", "No LazyDev reply yet.");
    renderMarkdownInto("guild-ai-output", "", "No LazyDev guild action run yet.");
    renderMarkdownInto("bot-message-preview", "", "Select a recent bot message to preview it here.");
    updateModel3dPostOptionsUi();
    setModel3dStatus("Ready for 3D model generation.");
    setImageGenerationStatus("Ready for image generation.");
    setAudioGenerationStatus("Ready for audio generation.");
    setMusicGenerationStatus("Ready for music generation.");
    setVideoGenerationStatus("Ready for video generation.");
    updateModel3dThreeVariantUi();
    updateModel3dViewerMaterialToggleButtons();
    if (!state.selectedGeneratedModelId) {
      setModel3dPreviewStatus("Select a generated model to preview it here.");
      setModel3dThreeStatus("Select a generated model to preview it here.");
    }
    switchView("ai");
    applyStudioRailExpandedState();
    renderMessengerRuntimePanel();
    renderTelegramChats();
    updateMessengerWorkspaceSummary();
    window.setInterval(() => {
      void loadMessengerRuntimes().catch(() => {});
    }, 5_000);
  }
  async function start() {
    bindRuntimeEvents();
    await bootstrap();
  }
  return { start };
}
