function createDashboardMessengerSelectionHelpers(input) {
  const state = input?.state || {};
  const getActiveView = typeof input?.getActiveView === "function" ? input.getActiveView : () => "ai";
  const normalizeMessenger = typeof input?.normalizeMessenger === "function" ? input.normalizeMessenger : value => String(value || "discord").trim() || "discord";
  const applyThemeForCurrentContext = typeof input?.applyThemeForCurrentContext === "function" ? input.applyThemeForCurrentContext : async function applyThemeForCurrentContextFallback() {};
  const applyMessengerSelectionUi = typeof input?.applyMessengerSelectionUi === "function" ? input.applyMessengerSelectionUi : function applyMessengerSelectionUiFallback() {};
  const updateMessengerWorkspaceSummary = typeof input?.updateMessengerWorkspaceSummary === "function" ? input.updateMessengerWorkspaceSummary : function updateMessengerWorkspaceSummaryFallback() {};
  const setHeroBotTag = typeof input?.setHeroBotTag === "function" ? input.setHeroBotTag : function setHeroBotTagFallback() {};
  const getMessengerDisplayName = typeof input?.getMessengerDisplayName === "function" ? input.getMessengerDisplayName : messenger => String(messenger || "Discord");
  const resolveMessengerCompatibleView = typeof input?.resolveMessengerCompatibleView === "function" ? input.resolveMessengerCompatibleView : (_messenger, view) => view;
  const switchView = typeof input?.switchView === "function" ? input.switchView : function switchViewFallback() {};
  const switchAutomationPanel = typeof input?.switchAutomationPanel === "function" ? input.switchAutomationPanel : function switchAutomationPanelFallback() {};
  const normalizeTelegramChatId = typeof input?.normalizeTelegramChatId === "function" ? input.normalizeTelegramChatId : value => String(value || "").trim();
  const normalizeMatrixRoomId = typeof input?.normalizeMatrixRoomId === "function" ? input.normalizeMatrixRoomId : value => String(value || "").trim();
  const updateScheduledSourceFields = typeof input?.updateScheduledSourceFields === "function" ? input.updateScheduledSourceFields : function updateScheduledSourceFieldsFallback() {};
  const updateAutomationTargetChips = typeof input?.updateAutomationTargetChips === "function" ? input.updateAutomationTargetChips : function updateAutomationTargetChipsFallback() {};
  const loadTelegramChats = typeof input?.loadTelegramChats === "function" ? input.loadTelegramChats : async function loadTelegramChatsFallback() {};
  const renderTelegramChats = typeof input?.renderTelegramChats === "function" ? input.renderTelegramChats : function renderTelegramChatsFallback() {};
  const renderMessengerRuntimePanel = typeof input?.renderMessengerRuntimePanel === "function" ? input.renderMessengerRuntimePanel : function renderMessengerRuntimePanelFallback() {};
  const refreshDirectMessageRail = typeof input?.refreshDirectMessageRail === "function" ? input.refreshDirectMessageRail : async function refreshDirectMessageRailFallback() {};

  function syncNonDiscordScheduledTarget() {
    if (!((state.selectedMessenger === "telegram" || state.selectedMessenger === "matrix") && !state.selectedScheduledAutomationId)) {
      return;
    }
    state.scheduledTargetMessenger = state.selectedMessenger;
    state.scheduledTargetChannelId = state.selectedMessenger === "telegram"
      ? normalizeTelegramChatId(state.selectedTelegramChatId)
      : normalizeMatrixRoomId(state.selectedMatrixRoomId);
    updateScheduledSourceFields();
    updateAutomationTargetChips();
  }

  function refreshNonDiscordMessengerState(activeView) {
    if (state.selectedMessenger === "discord") {
      return;
    }
    if (activeView === "automation" && state.automationPanel === "join") {
      switchAutomationPanel("scheduled");
    }
    syncNonDiscordScheduledTarget();
    if (state.selectedMessenger === "telegram") {
      void loadTelegramChats().catch(() => {});
    }
  }

  function setSelectedMessenger(nextMessenger) {
    const previousView = getActiveView();
    state.selectedMessenger = normalizeMessenger(nextMessenger);
    void applyThemeForCurrentContext(state.selectedMessenger);
    applyMessengerSelectionUi();
    updateMessengerWorkspaceSummary();
    if (state.selectedMessenger === "discord") {
      setHeroBotTag(Array.isArray(state.guilds) && state.guilds.length > 0 ? "Connected" : "Connecting...");
    } else {
      setHeroBotTag(getMessengerDisplayName(state.selectedMessenger) + " Mode");
    }
    const compatibleView = resolveMessengerCompatibleView(state.selectedMessenger, previousView);
    if (compatibleView !== previousView) {
      switchView(compatibleView);
    }
    // Render the selected runtime before any optional messenger refresh. A
    // Telegram-only UI problem must never leave Matrix/WhatsApp displaying a
    // stale Discord runtime label.
    renderMessengerRuntimePanel();
    refreshNonDiscordMessengerState(getActiveView());
    void refreshDirectMessageRail().catch(() => {});
  }

  return {
    setSelectedMessenger
  };
}
