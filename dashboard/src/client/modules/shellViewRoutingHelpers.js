function createDashboardShellViewRoutingHelpers(input) {
  const dashboardViewNames = ["ai", "tools", "blender-addons", "assets", "dashboard", "messaging", "automation", "guild", "moderation", "messenger", "activity", "profile"];

  function getFocusedStudioWorkflowId(selected) {
    return selected === "ai" ? String(input.state.aiFocusedSectionId || "").trim() : "";
  }

  function syncBodyViewState(selected, focusedId) {
    dashboardViewNames.forEach(name => {
      document.body.classList.toggle("view-" + name + "-active", selected === name);
    });
    const focusedStudioWorkflow = selected === "ai" && focusedId.length > 0;
    const aiHomeMode = input.state.aiHomeMode === "workflow" ? "workflow" : "studio";
    const workflowSidebarMode = input.state.aiWorkflowSidebarMode === "sticky" ? "sticky" : "floaty";
    document.body.classList.toggle("studio-workflow-focused", focusedStudioWorkflow);
    document.body.classList.toggle("studio-workflow-sidebar-open", focusedStudioWorkflow && input.state.aiWorkflowSidebarVisible === true);
    document.body.classList.toggle("studio-workflow-sidebar-sticky", workflowSidebarMode === "sticky");
    document.body.classList.toggle("studio-workflow-sidebar-floaty", workflowSidebarMode !== "sticky");
    document.body.classList.toggle("studio-home-active", selected === "ai" && !focusedStudioWorkflow && aiHomeMode === "studio");
    document.body.classList.toggle("studio-workflow-home-active", selected === "ai" && !focusedStudioWorkflow && aiHomeMode === "workflow");
  }

  function syncActiveViewControls(selected) {
    const activeTabView = selected === "messenger" ? "messaging" : selected;
    const aiHomeMode = input.state.aiHomeMode === "workflow" ? "workflow" : "studio";
    const focusedId = String(input.state.aiFocusedSectionId || "").trim();
    document.querySelectorAll("[data-view]").forEach(button => {
      const buttonView = button.getAttribute("data-view");
      const homeView = button.getAttribute("data-studio-home-view");
      const isAiHomeButton = buttonView === "ai" && homeView;
      const isActive = isAiHomeButton
        ? selected === "ai" && focusedId.length === 0 && homeView === aiHomeMode
        : buttonView === activeTabView;
      button.classList.toggle("active", isActive);
    });
    document.querySelectorAll("[data-view-panel]").forEach(panel => {
      panel.classList.toggle("active", panel.getAttribute("data-view-panel") === selected);
    });
  }

  function syncStageHeader(selected) {
    const meta = input.stageMeta[selected] || input.stageMeta.ai;
    const kickerNode = document.getElementById("stage-kicker");
    const titleNode = document.getElementById("stage-title");
    if (kickerNode) {
      kickerNode.textContent = meta.kicker;
    }
    if (titleNode) {
      titleNode.textContent = meta.title;
    }
  }

  function unloadInactivePreviews(selected, focusedId) {
    if (!(selected === "ai" && focusedId === "model3d-studio-card")) {
      input.unloadModel3dViewerPreview();
    }
    input.unloadInactiveStudioWorkflowPreviews(focusedId);
  }

  function refreshMessengerViewIfNeeded(selected) {
    if (selected !== "messenger") {
      return;
    }
    if (input.state.selectedMessenger === "telegram") {
      void input.loadTelegramChats().catch(() => {});
      return;
    }
    input.renderTelegramChats();
  }

  function refreshDiscordWorkspaceIfNeeded(selected) {
    if (input.state.selectedMessenger !== "discord" || selected === "dashboard" || selected === "activity" || selected === "profile" || selected === "tools" || selected === "blender-addons" || selected === "assets") {
      return;
    }
    if (!input.state.selectedGuildId && input.state.guilds.length > 0) {
      input.state.selectedGuildId = input.state.guilds[0].id;
    }
    if (!input.state.selectedGuildId || (Array.isArray(input.state.channels) && input.state.channels.length > 0)) {
      return;
    }
    void input.loadChannels().then(() => {
      input.refreshAutomationAndModelChannelSelectors();
      input.updateSelectionDetails();
      input.renderMessengerDashboardView();
    }).catch(() => {});
  }

  function switchView(view) {
    const selected = input.resolveRequestedViewForMessenger(view);
    const focusedId = getFocusedStudioWorkflowId(selected);
    syncBodyViewState(selected, focusedId);
    unloadInactivePreviews(selected, focusedId);
    syncActiveViewControls(selected);
    input.applyMessengerSelectionUi();
    syncStageHeader(selected);
    refreshMessengerViewIfNeeded(selected);
    refreshDiscordWorkspaceIfNeeded(selected);
    input.updateMessengerWorkspaceSummary();
    input.renderMessengerDashboardView();
    void input.applyThemeForCurrentContext(input.state.selectedMessenger);
    input.applyStudioRailExpandedState();
    input.updateStudioWorkflowSidebar();
  }

  return {
    dashboardViewNames,
    switchView
  };
}
