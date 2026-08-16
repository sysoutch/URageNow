function bindModel3dPostOptionEvents(input) {
  const {
    state,
    setOutput,
    updateModel3dPostOptionsUi,
    applyModel3dLowPolyPresetToFaceCount,
    syncModel3dLowPolyPresetFromFaceCount
  } = input;
  const bindElementEvent = (id, eventName, handler) => {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.addEventListener(eventName, handler);
  };
  bindElementEvent("model3d-lowpoly-target-face-preset", "change", () => {
    applyModel3dLowPolyPresetToFaceCount();
  });
  bindElementEvent("model3d-lowpoly-target-face-count", "input", () => {
    syncModel3dLowPolyPresetFromFaceCount();
  });
  bindElementEvent("model3d-lowpoly-use-llm-target-faces", "change", () => {
    updateModel3dPostOptionsUi();
  });
  [
    "model3d-post-messenger-select",
    "model3d-post-target-mode",
    "model3d-thread-name-mode",
    "model3d-send-initial",
    "model3d-include-model",
    "model3d-upload-textures",
    "model3d-generate-lowpoly",
    "model3d-create-lowpoly-after-generation"
  ].forEach(id => {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.addEventListener("change", () => {
      updateModel3dPostOptionsUi();
    });
  });
  const model3dUseSelectedDiscordButton = document.getElementById("model3d-post-use-selected-discord-button");
  if (!model3dUseSelectedDiscordButton) {
    return;
  }
  model3dUseSelectedDiscordButton.addEventListener("click", event => {
    event.preventDefault();
    const messengerNode = document.getElementById("model3d-post-messenger-select");
    const postMessenger = messengerNode && typeof messengerNode.value === "string"
      ? messengerNode.value
      : "discord";
    const selectedChannelId = String(state.selectedChannelId || "").trim();
    const selectedTelegramChatId = String(state.selectedTelegramChatId || "").trim();
    const selectedDestinationId = postMessenger === "telegram" ? selectedTelegramChatId : selectedChannelId;
    if (!selectedDestinationId) {
      return void setOutput(postMessenger === "telegram" ? "Select a Telegram chat first." : "Select a Discord channel first.");
    }
    const destinationInput = document.getElementById("model3d-post-destination-input");
    if (destinationInput && typeof destinationInput.value === "string") {
      if (destinationInput.tagName === "SELECT" && !Array.from(destinationInput.options || []).some(option => option.value === selectedDestinationId)) {
        const option = document.createElement("option");
        option.value = selectedDestinationId;
        option.textContent = "Selected destination | " + selectedDestinationId;
        destinationInput.appendChild(option);
      }
      destinationInput.value = selectedDestinationId;
    }
    updateModel3dPostOptionsUi();
    setOutput(
      postMessenger === "telegram"
        ? "Using selected Telegram chat as 3D post destination."
        : "Using selected Discord channel as 3D post destination."
    );
  });
}

function createDashboardFinalBootstrapAssemblyHelpers(input) {
  const {
    state,
    request,
    setOutput,
    refreshMeta,
    clearChildren,
    renderMarkdownInto,
    switchView,
    switchSubview,
    openChannelSettings,
    dashboardUserSearchHandlers,
    dashboardGuildSettingsUiHelpers,
    bindAutomationStudioEvents,
    loadBotMessages,
    dashboardAutomationViewHelpers,
    dashboardAiStudioLayoutHelpers,
    dashboardConsoleHelpers,
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
    setWorkflowSidebarMode,
    setDashboardTheme,
    readDashboardThemePreference,
    setSelectedMessenger,
    refreshState,
    initializeWorkspace,
    updateScheduledSourceFields,
    updateJoinSourceFields,
    updateAutomationTargetChips,
    updateAutomationTextPromptPreset,
    switchDetailTab,
    bindSubviewTabs,
    renderAiImageList,
    renderModerationImageList,
    renderGuildChannelPlan,
    updateModel3dPostOptionsUi,
    applyModel3dLowPolyPresetToFaceCount,
    syncModel3dLowPolyPresetFromFaceCount,
    setModel3dStatus,
    setImageGenerationStatus,
    setAudioGenerationStatus,
    setMusicGenerationStatus,
    setVideoGenerationStatus,
    updateModel3dThreeVariantUi,
    updateModel3dViewerMaterialToggleButtons,
    setModel3dPreviewStatus,
    setModel3dThreeStatus,
    renderMessengerRuntimePanel,
    renderTelegramChats,
    updateMessengerWorkspaceSummary,
    loadMessengerRuntimes,
    setRuntimeOverlayOpen,
    setSettingsOverlayOpen,
    wireModelImagePicker,
    getModel3dSelectedPool,
    renderModel3dPoolSelectionList,
    updateModel3dSourceHint,
    updateModel3dEditRoughnessValue,
    loadAutomationPresets,
    applyGlobalSettingsToUi,
    describeClientError,
    normalizeMessenger,
    getMessengerDisplayName,
    controlSelectedMessengerRuntime,
    loadTelegramChats,
    setSelectedTelegramChatId,
    normalizeTelegramChatId,
    getMessengerBrowserUrl,
    loadGuilds,
    updateSelectionDetails,
    renderMessengerDashboardView,
    clearAiSectionFocus,
    refreshActiveArtToolImagePoolBridge,
    ensureImagePoolDataLoaded,
    getDashboardThemeLabel,
    getNextDashboardTheme,
    workflowRightSidebarTargets,
    setWorkflowRightSidebarCollapsed,
    applyQuickComfyPathSettingsToUi,
    applyQuickFfmpegSettingsToUi,
    readQuickComfyPathSettingsFromUi,
    setComfyPathSettingsStatus,
    setQuickComfyPathSettingsStatus,
    saveQuickFfmpegSettingsFromUi,
    loadGlobalSettingsFromState,
    runInstallerFromUi,
    loadOllamaModels
  } = input;
  const guildSettingsUiHelpers = dashboardGuildSettingsUiHelpers || {};
  const getGuildSettingsFunction = (name, fallback) => typeof guildSettingsUiHelpers[name] === "function"
    ? (...args) => guildSettingsUiHelpers[name](...args)
    : fallback;

  const dashboardStudioBootstrapBindingHelpers = typeof createDashboardStudioBootstrapBindingHelpers === "function"
    ? createDashboardStudioBootstrapBindingHelpers({
        state,
        dashboardAutomationViewHelpers,
        dashboardAiStudioLayoutHelpers,
        wireModelImagePicker,
        getModel3dSelectedPool,
        renderModel3dPoolSelectionList,
        updateModel3dSourceHint,
        setOutput,
        updateModel3dEditRoughnessValue
      })
    : null;
  const dashboardGuildChannelWorkspaceHelpers = typeof createGuildChannelWorkspaceHelpers === "function"
    ? createGuildChannelWorkspaceHelpers({
        state,
        request,
        setOutput,
        renderMarkdownInto,
        switchView,
        switchSubview,
        openChannelSettings,
        loadBotMessages,
        ensureGuildRolesLoaded: getGuildSettingsFunction("ensureGuildRolesLoaded", async function ensureGuildRolesLoadedFallback() {}),
        getSelectedRoleIdFromUi: getGuildSettingsFunction("getSelectedRoleIdFromUi", function getSelectedRoleIdFromUiFallback() {
          return "";
        }),
        getSelectedChatModeSettings: getGuildSettingsFunction("getSelectedChatModeSettings", function getSelectedChatModeSettingsFallback() {
          return null;
        }),
        updateSelectedChatModeSettings: getGuildSettingsFunction("updateSelectedChatModeSettings", function updateSelectedChatModeSettingsFallback() {}),
        persistSelectedChatModeSettings: getGuildSettingsFunction("persistSelectedChatModeSettings", async function persistSelectedChatModeSettingsFallback() {}),
        getSelectedUserIdForChatMode: getGuildSettingsFunction("getSelectedUserIdForChatMode", function getSelectedUserIdForChatModeFallback() {
          return "";
        }),
        updateImagePoolVerifiedRoleChip: getGuildSettingsFunction("updateImagePoolVerifiedRoleChip", function updateImagePoolVerifiedRoleChipFallback() {}),
        updateImagePoolVerifiedUserChip: getGuildSettingsFunction("updateImagePoolVerifiedUserChip", function updateImagePoolVerifiedUserChipFallback() {}),
        updateProtectedRoleChip: getGuildSettingsFunction("updateProtectedRoleChip", function updateProtectedRoleChipFallback() {}),
        updateProtectedUserChip: getGuildSettingsFunction("updateProtectedUserChip", function updateProtectedUserChipFallback() {})
      })
    : null;
  const dashboardOverlayHelpers = typeof createDashboardOverlayHelpers === "function"
    ? createDashboardOverlayHelpers({
        state,
        refreshMeta,
        request,
        clearChildren,
        describeClientError,
        setOutput,
        renderMarkdownInto,
        normalizeMessenger,
        setSelectedMessenger,
        getMessengerDisplayName,
        loadMessengerRuntimes,
        loadTelegramChats,
        refreshState,
        controlSelectedMessengerRuntime,
        switchView,
        loadAutomationPresets,
        refreshAutomationTextSources: input.refreshAutomationTextSources,
        setRuntimeOverlayOpen,
        setSettingsOverlayOpen,
        clearAiImages: input.clearAiImages,
        clearAskSkillModelUploads: input.clearAskSkillModelUploads,
        clearAskFileUploads: input.clearAskFileUploads,
        renderTelegramChats,
        sendTelegramMessageFromUi: input.sendTelegramMessageFromUi,
        sendWhatsAppMessageFromUi: input.sendWhatsAppMessageFromUi,
        setSelectedTelegramChatId,
        normalizeTelegramChatId,
        getMessengerBrowserUrl,
        loadGuilds,
        updateSelectionDetails,
        renderGuildPermissions: getGuildSettingsFunction("renderGuildPermissions", function renderGuildPermissionsFallback() {}),
        renderChannelPermissions: getGuildSettingsFunction("renderChannelPermissions", function renderChannelPermissionsFallback() {}),
        renderMessengerDashboardView,
        loadDashboardDiscordChannels: input.loadDashboardDiscordChannels,
        loadDashboardDiscordMessages: input.loadDashboardDiscordMessages,
        openAiSection: input.openAiSection,
        clearAiSectionFocus,
        updateStudioWorkflowSidebar,
        refreshActiveArtToolImagePoolBridge,
        ensureImagePoolDataLoaded,
        getDashboardThemeLabel,
        setDashboardTheme,
        getNextDashboardTheme,
        setStudioRailExpanded,
        setWorkflowSidebarMode,
        workflowRightSidebarTargets,
        setWorkflowRightSidebarCollapsed,
        applyQuickComfyPathSettingsToUi,
        applyQuickFfmpegSettingsToUi,
        readQuickComfyPathSettingsFromUi,
        applyGlobalSettingsToUi,
        setComfyPathSettingsStatus,
        setQuickComfyPathSettingsStatus,
        saveQuickFfmpegSettingsFromUi,
        saveMessengerRuntimeSettingsFromUi: input.saveMessengerRuntimeSettingsFromUi,
        updateMessengerRuntimeLaunchUi: input.updateMessengerRuntimeLaunchUi,
        loadGlobalSettingsFromState,
        runInstallerFromUi,
        loadOllamaModels
      })
    : null;
  const dashboardOverlayStateProxyHelpers = typeof createDashboardOverlayStateProxyHelpers === "function"
    ? createDashboardOverlayStateProxyHelpers({ helpers: dashboardOverlayHelpers })
    : createDashboardOverlayStateProxyHelpers();
  const { setResourcesOverlayOpen, setSkillsOverlayOpen, setAboutOverlayOpen } = dashboardOverlayStateProxyHelpers;
  const dashboardQuickActionsHelpers = typeof createDashboardQuickActionsHelpers === "function"
    ? createDashboardQuickActionsHelpers({
        setOutput,
        switchView,
        setResourcesOverlayOpen,
        setSkillsOverlayOpen,
        setAboutOverlayOpen,
        setSettingsOverlayOpen,
        setRuntimeOverlayOpen,
        setConsoleOverlayOpen: input.setConsoleOverlayOpen
      })
    : null;
  const dashboardAppBootstrapHelpers = typeof createDashboardAppBootstrapHelpers === "function"
    ? createDashboardAppBootstrapHelpers({
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
      })
    : null;

  function bindWorkspaceAssembly() {
    const runBindingStep = (label, bindStep) => {
      if (typeof bindStep !== "function") {
        return;
      }
      try {
        bindStep();
      } catch (error) {
        console.error("Dashboard bootstrap binding failed for " + label + ".", error);
      }
    };
    runBindingStep("studio bootstrap", () => dashboardStudioBootstrapBindingHelpers?.bindStudioBootstrapEvents());
    runBindingStep("user search", () => dashboardUserSearchHandlers?.bind());
    runBindingStep("guild workspace", () => dashboardGuildChannelWorkspaceHelpers?.bindEvents());
    runBindingStep("moderation settings", () => dashboardGuildSettingsUiHelpers?.bindModerationSettingsEvents?.());
    runBindingStep("automation studio", bindAutomationStudioEvents);
    runBindingStep("3d post options", () => bindModel3dPostOptionEvents({
      state,
      setOutput,
      updateModel3dPostOptionsUi,
      applyModel3dLowPolyPresetToFaceCount,
      syncModel3dLowPolyPresetFromFaceCount
    }));
  }

  async function start() {
    bindWorkspaceAssembly();
    if (!dashboardAppBootstrapHelpers) {
      return;
    }
    await dashboardAppBootstrapHelpers.start();
  }

  return { start };
}
