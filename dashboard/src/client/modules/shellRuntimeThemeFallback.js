function createDashboardShellRuntimeThemeFallback(input) {
  const state = input && input.state ? input.state : {};
  return {
    normalizeDashboardTheme(value) {
      return normalizeDashboardThemeKey(value);
    },
    getDashboardThemeLabel(value) {
      return getDashboardThemeLabel(value);
    },
    readDashboardThemePreference() {
      return defaultDashboardTheme;
    },
    shouldAnimateDashboardThemeTransition(options) {
      return !options || options.animate !== false;
    },
    setDashboardThemeTransitionEnabled(enabled) {
      document.body.classList.toggle("theme-transition-disabled", enabled === false);
    },
    updateDashboardThemeButtons() {},
    setDashboardTheme(nextTheme) {
      state.dashboardTheme = this.normalizeDashboardTheme(nextTheme);
      document.body.setAttribute("data-dashboard-theme", state.dashboardTheme);
      const themeInfo = getDashboardThemeMeta(state.dashboardTheme) || {};
      const imagePath = themeInfo.imagePath || ("/assets/dashboard-theme-logo.png?theme=" + encodeURIComponent(state.dashboardTheme));
      document.querySelectorAll("[data-dashboard-theme-logo=\"studio\"]").forEach(image => {
        image.setAttribute("src", imagePath);
        image.setAttribute("alt", this.getDashboardThemeLabel(state.dashboardTheme) + " Studio");
      });
      document.querySelectorAll("[data-dashboard-theme-favicon]").forEach(icon => {
        icon.setAttribute("href", imagePath);
      });
      window.dispatchEvent(new CustomEvent("dashboard:theme-changed", { detail: { theme: state.dashboardTheme } }));
    },
    getNextDashboardTheme(currentTheme) {
      const currentIndex = dashboardThemeOrder.indexOf(this.normalizeDashboardTheme(currentTheme));
      if (currentIndex < 0) {
        return dashboardThemeOrder[0] || defaultDashboardTheme;
      }
      return dashboardThemeOrder[(currentIndex + 1) % dashboardThemeOrder.length] || defaultDashboardTheme;
    },
    normalizeMessenger(value) {
      if (value === "telegram" || value === "matrix" || value === "whatsapp" || value === "discord") {
        return value;
      }
      return "discord";
    },
    isDiscordOnlyView(view) {
      return ["guild", "moderation"].includes(String(view || "").trim());
    },
    getActiveView() {
      const panel = document.querySelector("[data-view-panel].active");
      return panel ? (panel.getAttribute("data-view-panel") || "ai") : "ai";
    },
    restoreStudioRightSidebarAsides() {},
    syncStudioRightSidebar() {},
    getMessengerDisplayName(messenger) {
      return messenger === "telegram" ? "Telegram" : messenger === "matrix" ? "Matrix" : messenger === "whatsapp" ? "WhatsApp" : "Discord";
    },
    normalizeThemeTarget(value) {
      return this.normalizeMessenger(value);
    },
    applyMessengerThemeVariables() {},
    async loadThemeConfig() {
      return { variables: {} };
    },
    async applyThemeForCurrentContext() {},
    getSelectedMessengerRuntime() {
      return (state.messengerRuntimes || []).find(item => item.messenger === state.selectedMessenger) || null;
    },
    normalizeTelegramChatId(value) {
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      return String(value || "").trim();
    },
    getSelectedTelegramChat() {
      return null;
    },
    setSelectedTelegramChatId(value) {
      state.selectedTelegramChatId = String(value || "").trim();
    },
    setRuntimeOverlayOpen() {},
    setSettingsOverlayOpen(isOpen) {
      const overlayNode = document.getElementById("settings-overlay");
      if (!overlayNode) {
        return;
      }
      overlayNode.classList.toggle("hidden", !isOpen);
      overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
      document.body.classList.toggle("settings-overlay-open", isOpen);
    },
    getRuntimeProgressValue() {
      return 0;
    },
    formatRuntimeMeta() {
      return "No runtime data available yet.";
    },
    renderMessengerRuntimePanel() {},
    updateMessengerWorkspaceSummary() {},
    applyMessengerSelectionUi() {}
  };
}
