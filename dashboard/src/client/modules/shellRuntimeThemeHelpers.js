function createDashboardShellRuntimeThemeHelpers(input) {
  class DashboardShellRuntimeThemeController {
    constructor(options) {
      this.input = options || {};
      this.state = this.input.state || {};
      this.discordOnlyViews = new Set(["guild", "moderation"]);
      this.dashboardThemeOrder = (window.dashboardThemeOrder || []).slice();
      this.dashboardThemes = new Set(this.dashboardThemeOrder);
      this.dashboardThemeStorageKey = "urage-dashboard-theme";
      this.dashboardThemeInfo = Object.fromEntries((window.dashboardThemes || []).map(theme => [theme.id, {
        label: theme.label,
        imagePath: theme.imagePath
      }]));
      this.studioSurfaceViews = new Set(["ai", "tools"]);
      this.studioSidebarOrigins = new WeakMap();
      document.addEventListener("change", event => {
        if (event.target?.id === "messenger-runtime-credential-source") {
          this.updateMessengerRuntimeLaunchUi();
        }
      });
    }

    formatDateTime(value) {
      if (typeof this.input.formatDateTime === "function") {
        return this.input.formatDateTime(value);
      }
      return String(value || "").trim() || "Unknown";
    }

    normalizeDashboardTheme(value) {
      return (window.normalizeDashboardThemeKey || function(v) { return v; })(value);
    }

    getDashboardThemeLabel(value) {
      return (window.getDashboardThemeLabel || function() { return "URage"; })(value);
    }

    mergeDashboardThemeInfo(inputValue) {
      if (!inputValue || typeof inputValue !== "object") {
        return;
      }
      Object.entries(inputValue).forEach(([rawTheme, rawInfo]) => {
        const theme = this.normalizeDashboardTheme(rawTheme);
        if (!rawInfo || typeof rawInfo !== "object") {
          return;
        }
        const label = typeof rawInfo.label === "string" ? rawInfo.label.trim() : "";
        const imagePath = typeof rawInfo.imagePath === "string" ? rawInfo.imagePath.trim() : "";
        this.dashboardThemeInfo[theme] = {
          ...(this.dashboardThemeInfo[theme] || {}),
          ...(label ? { label } : {}),
          ...(imagePath ? { imagePath } : {})
        };
      });
    }

    getDashboardThemeInfo(value) {
      const normalized = this.normalizeDashboardTheme(value);
      var _getDashboardThemeMeta = window.getDashboardThemeMeta;
      return this.dashboardThemeInfo[normalized] || (_getDashboardThemeMeta ? _getDashboardThemeMeta(window.defaultDashboardTheme || "urage") : {}) || {};
    }

    updateDashboardThemeLogo(theme) {
      const normalized = this.normalizeDashboardTheme(theme);
      const themeInfo = this.getDashboardThemeInfo(normalized);
      var _getDashboardThemeMeta2 = window.getDashboardThemeMeta;
      var _defaultDashboardTheme2 = window.defaultDashboardTheme || "urage";
      const imagePath = String(themeInfo.imagePath || "").trim() || (_getDashboardThemeMeta2 ? _getDashboardThemeMeta2(_defaultDashboardTheme2)?.imagePath : "") || "/assets/dashboard-theme-logo.png?theme=fire";
      const label = String(themeInfo.label || this.getDashboardThemeLabel(normalized) || "URage").trim();
      document.querySelectorAll("[data-dashboard-theme-logo=\"studio\"]").forEach(image => {
        if (image.getAttribute("src") !== imagePath) {
          image.setAttribute("src", imagePath);
        }
        image.setAttribute("alt", label + " Studio");
      });
    }

    async ensureStudioThemeConfigLoaded() {
      if (this.state.studioThemeConfigLoaded) {
        return;
      }
      this.state.studioThemeConfigLoaded = true;
      try {
        const payload = await this.loadThemeConfig("studio");
        this.mergeDashboardThemeInfo(payload && payload.themes ? payload.themes : {});
        this.updateDashboardThemeLogo(this.state.dashboardTheme);
      } catch (error) {
        console.warn("Failed to load studio theme config.", error);
      }
    }

    readDashboardThemePreference() {
      try {
        return this.normalizeDashboardTheme(window.localStorage.getItem(this.dashboardThemeStorageKey));
      } catch {
        return window.defaultDashboardTheme || "urage";
      }
    }

    shouldAnimateDashboardThemeTransition(options) {
      if (options && options.animate === false) {
        return false;
      }
      if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return false;
      }
      return true;
    }

    setDashboardThemeTransitionEnabled(enabled) {
      document.body.classList.toggle("theme-transition-disabled", enabled === false);
    }

    updateDashboardThemeButtons() {
      const selectedTheme = this.normalizeDashboardTheme(this.state.dashboardTheme);
      document.querySelectorAll("[data-dashboard-theme-button]").forEach(button => {
        const buttonTheme = this.normalizeDashboardTheme(button.getAttribute("data-dashboard-theme-button"));
        const isActive = buttonTheme === selectedTheme;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    setDashboardTheme(nextTheme, options) {
      const normalizedTheme = this.normalizeDashboardTheme(nextTheme);
      const shouldPersist = !options || options.persist !== false;
      const shouldAnimate = this.shouldAnimateDashboardThemeTransition(options);
      this.setDashboardThemeTransitionEnabled(shouldAnimate);
      this.state.dashboardTheme = normalizedTheme;
      document.body.setAttribute("data-dashboard-theme", normalizedTheme);
      this.updateDashboardThemeButtons();
      this.updateDashboardThemeLogo(normalizedTheme);
      if (!shouldAnimate) {
        window.requestAnimationFrame(() => {
          this.setDashboardThemeTransitionEnabled(true);
        });
      }
      if (shouldPersist) {
        try {
          window.localStorage.setItem(this.dashboardThemeStorageKey, normalizedTheme);
        } catch {}
      }
      if (!options || options.publish !== false) {
        void this.publishDashboardThemePreference(normalizedTheme);
      }
      this.syncActiveToolFrameTheme(normalizedTheme);
      void this.ensureStudioThemeConfigLoaded();
      window.dispatchEvent(new CustomEvent("dashboard:theme-changed", { detail: { theme: normalizedTheme } }));
    }

    async publishDashboardThemePreference(theme) {
      try {
        await this.input.request("/api/theme-preference", { theme: this.normalizeDashboardTheme(theme) });
      } catch (error) {
        console.warn("Failed to publish dashboard theme preference.", error);
      }
    }

    syncActiveToolFrameTheme(theme) {
      const frameNode = document.getElementById("tools-workspace-frame");
      if (!frameNode || !frameNode.contentWindow) {
        return;
      }
      frameNode.contentWindow.postMessage({
        source: "urage-dashboard",
        type: "tool:theme",
        payload: { theme }
      }, "*");
    }

    getNextDashboardTheme(currentTheme) {
      const normalizedTheme = this.normalizeDashboardTheme(currentTheme);
      const currentIndex = this.dashboardThemeOrder.indexOf(normalizedTheme);
      if (currentIndex < 0) {
        return this.dashboardThemeOrder[0];
      }
      return this.dashboardThemeOrder[(currentIndex + 1) % this.dashboardThemeOrder.length];
    }

    normalizeMessenger(value) {
      if (value === "telegram" || value === "matrix" || value === "whatsapp" || value === "discord") {
        return value;
      }
      return "discord";
    }

    isDiscordOnlyView(view) {
      return this.discordOnlyViews.has(String(view || "").trim());
    }

    getActiveView() {
      const panel = document.querySelector("[data-view-panel].active");
      if (!panel) {
        return "ai";
      }
      return panel.getAttribute("data-view-panel") || "ai";
    }

    restoreStudioRightSidebarAsides() {
      const movedAsides = Array.from(document.querySelectorAll("[data-studio-sidebar-relocated=\"true\"]"));
      movedAsides.forEach(aside => {
        const origin = this.studioSidebarOrigins.get(aside);
        if (!origin || !origin.parent) {
          return;
        }
        this.clearStudioRightSidebarRuntimeStyles(aside);
        if (origin.nextSibling && origin.nextSibling.parentNode === origin.parent) {
          origin.parent.insertBefore(aside, origin.nextSibling);
        } else {
          origin.parent.appendChild(aside);
        }
        aside.removeAttribute("data-studio-sidebar-relocated");
      });
    }

    clearStudioRightSidebarRuntimeStyles(sidebar) {
      const properties = [
        "align-content", "display", "flex", "flex-direction", "grid-template-rows",
        "height", "inset", "max-height", "min-height", "overflow", "overflow-x",
        "overflow-y", "overscroll-behavior", "position", "scrollbar-gutter"
      ];
      [sidebar, ...Array.from(sidebar?.querySelectorAll("[style]") || [])].forEach(node => {
        properties.forEach(property => node?.style?.removeProperty(property));
      });
    }

    setStudioRightSidebarRuntimeStyle(node, property, value) {
      node?.style?.setProperty(property, value, "important");
    }

    constrainStudioRightSidebarRuntime(sidebarHost) {
      const hostStack = sidebarHost?.closest(".studio-right-sidebar-stack") || sidebarHost;
      const rightSidebar = sidebarHost?.closest(".studio-right-sidebar");
      const detailPane = rightSidebar?.closest(".details-pane, .side-panel.side-panel-right");
      const structuralNodes = [
        detailPane,
        rightSidebar,
        hostStack,
        sidebarHost
      ].filter(Boolean);
      structuralNodes.forEach(node => {
        this.setStudioRightSidebarRuntimeStyle(node, "height", "100%");
        this.setStudioRightSidebarRuntimeStyle(node, "min-height", "0");
        this.setStudioRightSidebarRuntimeStyle(node, "max-height", "100%");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow-x", "hidden");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow-y", "hidden");
        this.setStudioRightSidebarRuntimeStyle(node, "scrollbar-gutter", "auto");
        this.setStudioRightSidebarRuntimeStyle(node, "overscroll-behavior", "contain");
      });
      Array.from(sidebarHost?.querySelectorAll("[data-studio-sidebar-relocated=\"true\"]") || []).forEach(node => {
        const hasSplitShell = Boolean(node.querySelector(":scope > .studio-sidebar-split-shell"));
        this.setStudioRightSidebarRuntimeStyle(node, "height", "100%");
        this.setStudioRightSidebarRuntimeStyle(node, "min-height", "0");
        this.setStudioRightSidebarRuntimeStyle(node, "max-height", "100%");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow-x", "hidden");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow-y", hasSplitShell ? "hidden" : "auto");
        this.setStudioRightSidebarRuntimeStyle(node, "scrollbar-gutter", "stable");
        this.setStudioRightSidebarRuntimeStyle(node, "overscroll-behavior", "contain");
      });
      Array.from(sidebarHost?.querySelectorAll(".studio-sidebar-split-shell") || []).forEach(node => {
        this.setStudioRightSidebarRuntimeStyle(node, "display", "grid");
        this.setStudioRightSidebarRuntimeStyle(node, "grid-template-rows", "minmax(0, 1fr) 8px minmax(132px, min(var(--studio-sidebar-bottom-height), 68%))");
        this.setStudioRightSidebarRuntimeStyle(node, "height", "100%");
        this.setStudioRightSidebarRuntimeStyle(node, "min-height", "0");
        this.setStudioRightSidebarRuntimeStyle(node, "max-height", "100%");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow", "hidden");
      });
      Array.from(sidebarHost?.querySelectorAll(".studio-sidebar-split-main") || []).forEach(node => {
        this.setStudioRightSidebarRuntimeStyle(node, "display", "flex");
        this.setStudioRightSidebarRuntimeStyle(node, "flex-direction", "column");
        this.setStudioRightSidebarRuntimeStyle(node, "min-height", "0");
        this.setStudioRightSidebarRuntimeStyle(node, "max-height", "100%");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow-x", "hidden");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow-y", "scroll");
        this.setStudioRightSidebarRuntimeStyle(node, "scrollbar-gutter", "stable");
        this.setStudioRightSidebarRuntimeStyle(node, "overscroll-behavior", "contain");
      });
      Array.from(sidebarHost?.querySelectorAll(".studio-sidebar-split-main .studio-side-foldout[open]") || []).forEach(node => {
        this.setStudioRightSidebarRuntimeStyle(node, "flex", "0 0 auto");
        this.setStudioRightSidebarRuntimeStyle(node, "min-height", "max-content");
        this.setStudioRightSidebarRuntimeStyle(node, "height", "auto");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow", "visible");
      });
      Array.from(sidebarHost?.querySelectorAll(".studio-sidebar-split-main .studio-side-foldout-content") || []).forEach(node => {
        this.setStudioRightSidebarRuntimeStyle(node, "flex", "0 0 auto");
        this.setStudioRightSidebarRuntimeStyle(node, "min-height", "max-content");
        this.setStudioRightSidebarRuntimeStyle(node, "height", "auto");
        this.setStudioRightSidebarRuntimeStyle(node, "max-height", "none");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow", "visible");
      });
      Array.from(sidebarHost?.querySelectorAll(".studio-sidebar-split-bottom") || []).forEach(node => {
        this.setStudioRightSidebarRuntimeStyle(node, "max-height", "min(var(--studio-sidebar-bottom-height), 68vh)");
        this.setStudioRightSidebarRuntimeStyle(node, "min-height", "112px");
        this.setStudioRightSidebarRuntimeStyle(node, "overflow", "hidden");
      });
      Array.from(sidebarHost?.querySelectorAll(".studio-sidebar-split-resizer") || []).forEach(node => {
        this.setStudioRightSidebarRuntimeStyle(node, "display", "block");
      });
    }

    syncStudioRightSidebar(view) {
      const activeView = String(view || this.getActiveView() || "ai");
      const studioViewActive = activeView === "ai";
      const focusedAiSectionId = studioViewActive ? String(this.state.aiFocusedSectionId || "").trim() : "";
      const sidebarTarget = this.state.selectedMessenger === "discord" ? "discord" : "messenger";
      const sidebarCards = Array.from(document.querySelectorAll("[data-studio-right-sidebar]"));
      const defaultPanels = Array.from(document.querySelectorAll("[data-detail-panel-default]"));
      this.restoreStudioRightSidebarAsides();
      if (studioViewActive) {
        sidebarCards.forEach(card => {
          card.classList.toggle("hidden", true);
        });
        defaultPanels.forEach(panel => {
          panel.classList.toggle("hidden", false);
        });
        document.body.classList.toggle("studio-right-sidebar-active", false);
        return;
      }
      if (!studioViewActive) {
        sidebarCards.forEach(card => {
          card.classList.toggle("hidden", true);
        });
        defaultPanels.forEach(panel => {
          panel.classList.toggle("hidden", false);
        });
        document.body.classList.toggle("studio-right-sidebar-active", false);
        return;
      }
      if (!focusedAiSectionId) {
        sidebarCards.forEach(card => {
          card.classList.toggle("hidden", true);
        });
        defaultPanels.forEach(panel => {
          panel.classList.toggle("hidden", false);
        });
        document.body.classList.toggle("studio-right-sidebar-active", false);
        return;
      }
      const sidebarHost = document.querySelector("[data-studio-right-sidebar-host=\"" + sidebarTarget + "\"]");
      const activePanel = document.querySelector("[data-view-panel=\"" + activeView + "\"].active");
      if (!sidebarHost || !activePanel) {
        sidebarCards.forEach(card => {
          card.classList.toggle("hidden", true);
        });
        defaultPanels.forEach(panel => {
          panel.classList.toggle("hidden", false);
        });
        document.body.classList.toggle("studio-right-sidebar-active", false);
        return;
      }
      const allPanelAsides = Array.from(activePanel.querySelectorAll("aside[data-studio-inspector-panel=\"true\"]"))
        .filter(aside => !aside.closest(".details-pane"));
      let panelAsides = [];
      const focusedCard = document.getElementById(focusedAiSectionId);
      if (focusedCard && activePanel.contains(focusedCard)) {
        panelAsides = allPanelAsides.filter(aside => aside.closest(".ai-section-target") === focusedCard);
      }
      const hasStudioSidebarContent = panelAsides.length > 0;
      sidebarCards.forEach(card => {
        const cardTarget = String(card.getAttribute("data-studio-right-sidebar") || "");
        const visible = hasStudioSidebarContent && cardTarget === sidebarTarget;
        card.classList.toggle("hidden", !visible);
      });
      defaultPanels.forEach(panel => {
        panel.classList.toggle("hidden", hasStudioSidebarContent);
      });
      panelAsides.forEach(aside => {
        if (!this.studioSidebarOrigins.has(aside)) {
          this.studioSidebarOrigins.set(aside, { parent: aside.parentNode, nextSibling: aside.nextSibling });
        }
        aside.setAttribute("data-studio-sidebar-relocated", "true");
        sidebarHost.appendChild(aside);
      });
      this.constrainStudioRightSidebarRuntime(sidebarHost);
      document.body.classList.toggle("studio-right-sidebar-active", hasStudioSidebarContent);
    }

    getMessengerDisplayName(messenger) {
      if (messenger === "telegram") {
        return "Telegram";
      }
      if (messenger === "matrix") {
        return "Matrix";
      }
      if (messenger === "whatsapp") {
        return "WhatsApp";
      }
      return "Discord";
    }

    normalizeThemeTarget(value) {
      if (value === "studio") {
        return "studio";
      }
      return this.normalizeMessenger(value);
    }

    applyMessengerThemeVariables(inputValue) {
      const rootNode = document.documentElement;
      const previousNames = Array.isArray(this.state.appliedThemeVariableNames) ? this.state.appliedThemeVariableNames : [];
      previousNames.forEach(variableName => {
        rootNode.style.removeProperty(variableName);
      });
      const variables = inputValue && typeof inputValue === "object" ? inputValue : {};
      const nextNames = [];
      Object.entries(variables).forEach(([key, rawValue]) => {
        const variableName = String(key || "").trim();
        if (!variableName.startsWith("--")) {
          return;
        }
        const variableValue = typeof rawValue === "string" ? rawValue.trim() : "";
        if (!variableValue) {
          return;
        }
        rootNode.style.setProperty(variableName, variableValue);
        nextNames.push(variableName);
      });
      this.state.appliedThemeVariableNames = nextNames;
    }

    async loadThemeConfig(target) {
      const normalizedTarget = this.normalizeThemeTarget(target);
      if (this.state.messengerThemeConfigs && this.state.messengerThemeConfigs[normalizedTarget]) {
        return this.state.messengerThemeConfigs[normalizedTarget];
      }
      if (typeof this.input.request !== "function") {
        return { variables: {} };
      }
      const payload = await this.input.request("/api/theme-config?target=" + encodeURIComponent(normalizedTarget));
      this.state.messengerThemeConfigs = this.state.messengerThemeConfigs || {};
      this.state.messengerThemeConfigs[normalizedTarget] = payload;
      return payload;
    }

    async applyThemeForCurrentContext(messenger) {
      // Messenger selection controls data and capabilities only. The dashboard
      // itself always inherits the user's active Studio theme.
      this.applyMessengerThemeVariables({});
    }

    getSelectedMessengerRuntime() {
      return (this.state.messengerRuntimes || []).find(item => item.messenger === this.state.selectedMessenger) || null;
    }

    normalizeTelegramChatId(value) {
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      return String(value || "").trim();
    }

    getSelectedTelegramChat() {
      const selectedId = this.normalizeTelegramChatId(this.state.selectedTelegramChatId);
      if (!selectedId) {
        return null;
      }
      return (this.state.telegramChats || []).find(entry => this.normalizeTelegramChatId(entry.chatId) === selectedId) || null;
    }

    setSelectedTelegramChatId(value) {
      const normalized = this.normalizeTelegramChatId(value);
      this.state.selectedTelegramChatId = normalized;
      if (this.state.scheduledTargetMessenger === "telegram" && !this.state.selectedScheduledAutomationId && normalized) {
        this.state.scheduledTargetChannelId = normalized;
        if (typeof this.input.updateAutomationTargetChips === "function") {
          this.input.updateAutomationTargetChips();
        }
      }
      const inputNode = document.getElementById("telegram-chat-id-input");
      if (inputNode && typeof inputNode.value === "string") {
        inputNode.value = normalized;
      }
    }

    setRuntimeOverlayOpen(isOpen) {
      const overlayNode = document.getElementById("runtime-overlay");
      if (!overlayNode) {
        return;
      }
      overlayNode.classList.toggle("hidden", !isOpen);
      overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
      document.body.classList.toggle("runtime-overlay-open", isOpen);
      if (isOpen) {
        const credentialSource = document.getElementById("messenger-runtime-credential-source");
        if (credentialSource) {
          credentialSource.onchange = () => this.updateMessengerRuntimeLaunchUi();
        }
        this.updateMessengerRuntimeLaunchUi();
      }
    }

    setSettingsOverlayOpen(isOpen) {
      const overlayNode = document.getElementById("settings-overlay");
      if (!overlayNode) {
        return;
      }
      overlayNode.classList.toggle("hidden", !isOpen);
      overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
      document.body.classList.toggle("settings-overlay-open", isOpen);
    }

    getRuntimeProgressValue(status) {
      if (status === "running") {
        return 100;
      }
      if (status === "starting" || status === "stopping") {
        return 62;
      }
      if (status === "error") {
        return 100;
      }
      return 0;
    }

    formatRuntimeMeta(runtime) {
      if (!runtime) {
        return "No runtime data available yet.";
      }
      const parts = [];
      if (runtime.message) {
        parts.push(runtime.message);
      }
      if (runtime.pid) {
        parts.push("PID " + runtime.pid);
      }
      if (runtime.startedAt) {
        parts.push("Started " + this.formatDateTime(runtime.startedAt));
      } else if (runtime.stoppedAt) {
        parts.push("Updated " + this.formatDateTime(runtime.stoppedAt));
      }
      return parts.join(" | ") || "No runtime data available yet.";
    }

    updateMessengerRuntimeLaunchUi() {
      const messenger = this.state.selectedMessenger || "discord";
      const autostartCheckbox = document.getElementById("messenger-runtime-autostart-checkbox");
      if (autostartCheckbox) {
        autostartCheckbox.checked = this.state.globalSettings?.[messenger + "RuntimeAutostart"] === true;
      }
      const autostartLabel = document.getElementById("messenger-runtime-autostart-label");
      if (autostartLabel) {
        autostartLabel.textContent = "Start " + this.getMessengerDisplayName(messenger) + " automatically with the dashboard runtime";
      }
      const credentialSource = document.getElementById("messenger-runtime-credential-source")?.value || "default";
      const defaultCredentialLabel = messenger === "telegram"
        ? "Bot token from OS Credential Store"
        : messenger === "matrix"
          ? "Matrix token from OS Credential Store"
          : messenger === "discord"
            ? "Discord token from OS Credential Store"
            : "Access token from OS Credential Store";
      const defaultOption = document.querySelector("#messenger-runtime-credential-source option[value='default']");
      if (defaultOption) defaultOption.textContent = defaultCredentialLabel;
      const sourceLabel = credentialSource === "manual" ? "Manual Entry" : credentialSource === "safe-file" ? "Safe Env File" : defaultCredentialLabel;
      const safePathField = document.getElementById("messenger-runtime-shared-path-input");
      if (safePathField) {
        safePathField.disabled = credentialSource !== "safe-file";
      }
      ["discord", "telegram", "matrix", "whatsapp"].forEach(key => {
        const panel = document.getElementById("messenger-runtime-manual-" + key);
        if (!panel) {
          return;
        }
        panel.classList.toggle("hidden", !(credentialSource === "manual" && messenger === key));
      });
      const sourceNode = document.getElementById("messenger-runtime-launch-source");
      if (sourceNode) {
        sourceNode.textContent = "Selected source: " + sourceLabel;
      }
      const noteNode = document.getElementById("messenger-runtime-launch-note");
      if (!noteNode) {
        return;
      }
      if (credentialSource === "manual") {
        noteNode.textContent = "Manual entry is used only for this start or restart request, is not saved in dashboard settings, and should immediately show the fields for the active messenger below.";
        return;
      }
      if (credentialSource === "safe-file") {
        noteNode.textContent = "Safe Env File reads the selected messenger credentials from the shared .env-style file path above and uses them only when you press Start or Restart.";
        return;
      }
      noteNode.textContent = messenger === "discord"
        ? "Current User Credentials uses the dashboard user's native Discord token, with environment values as overrides."
        : messenger === "telegram"
          ? "Telegram uses a BotFather token. The dashboard reads it from the OS credential store, with environment values as service overrides."
          : messenger === "matrix"
            ? "Matrix uses a homeserver URL plus access token. The token is read from the OS credential store, with environment values as service overrides."
            : "The selected messenger token is read from the OS credential store, with environment values as service overrides.";
    }

    renderMessengerRuntimePanel() {
      const runtime = this.getSelectedMessengerRuntime();
      const messengerLabel = this.getMessengerDisplayName(this.state.selectedMessenger);
      const nextStatus = runtime ? runtime.status : "stopped";
      const runtimeMeta = this.formatRuntimeMeta(runtime);
      const labelNode = document.getElementById("messenger-runtime-label");
      if (labelNode) {
        labelNode.textContent = messengerLabel + " Runtime";
      }
      const overlayTitleNode = document.getElementById("runtime-overlay-title");
      if (overlayTitleNode) {
        overlayTitleNode.textContent = messengerLabel + " Runtime";
      }
      const stateNode = document.getElementById("messenger-runtime-state");
      if (stateNode) {
        stateNode.className = "messenger-runtime-state is-" + nextStatus;
        stateNode.textContent = nextStatus.toUpperCase();
      }
      const compactLabelNode = document.getElementById("messenger-runtime-compact-label");
      if (compactLabelNode) {
        compactLabelNode.textContent = messengerLabel + " Runtime";
      }
      const compactStateNode = document.getElementById("messenger-runtime-compact-state");
      if (compactStateNode) {
        compactStateNode.className = "runtime-launcher-state is-" + nextStatus;
        compactStateNode.textContent = nextStatus.toUpperCase();
      }
      const compactMetaNode = document.getElementById("messenger-runtime-compact-meta");
      if (compactMetaNode) {
        compactMetaNode.textContent = runtimeMeta;
      }
      const detailRuntimeStateNode = document.getElementById("detail-messenger-runtime-state");
      if (detailRuntimeStateNode) {
        detailRuntimeStateNode.textContent = nextStatus.toUpperCase();
      }
      const detailRuntimeMetaNode = document.getElementById("detail-messenger-runtime-meta");
      if (detailRuntimeMetaNode) {
        detailRuntimeMetaNode.textContent = runtimeMeta;
      }
      const trackNode = document.getElementById("messenger-runtime-progress-track");
      const fillNode = document.getElementById("messenger-runtime-progress-fill");
      const progressValue = this.getRuntimeProgressValue(nextStatus);
      if (trackNode) {
        trackNode.setAttribute("aria-valuenow", String(progressValue));
      }
      if (fillNode) {
        fillNode.style.width = progressValue + "%";
        fillNode.className = "messenger-runtime-progress-fill";
        if (runtime && runtime.status === "running") {
          fillNode.classList.add("is-running");
        } else if (runtime && runtime.status === "error") {
          fillNode.classList.add("is-error");
        }
      }
      const metaNode = document.getElementById("messenger-runtime-meta");
      if (metaNode) {
        metaNode.textContent = runtimeMeta;
      }
      const startButton = document.getElementById("messenger-runtime-start-button");
      const stopButton = document.getElementById("messenger-runtime-stop-button");
      const restartButton = document.getElementById("messenger-runtime-restart-button");
      if (startButton) {
        startButton.disabled = !runtime || !runtime.configured || runtime.status === "running" || runtime.status === "starting" || runtime.status === "stopping";
      }
      if (stopButton) {
        stopButton.disabled = !runtime || runtime.status === "stopped" || runtime.status === "stopping";
      }
      if (restartButton) {
        restartButton.disabled = !runtime || !runtime.configured || runtime.status === "starting" || runtime.status === "stopping";
      }
      const historyNode = document.getElementById("messenger-runtime-history");
      if (historyNode) {
        const lines = (this.state.messengerRuntimeEvents || [])
          .filter(event => event.messenger === this.state.selectedMessenger)
          .slice(0, 36)
          .reverse()
          .map(event => "[" + this.formatDateTime(event.createdAt) + "] " + (event.level === "error" ? "ERROR" : "INFO") + " " + event.message);
        historyNode.value = lines.length > 0 ? lines.join("\n") : "No runtime history yet.";
        historyNode.scrollTop = historyNode.scrollHeight;
      }
      this.updateMessengerRuntimeLaunchUi();
      if (typeof this.input.renderMessengerDashboardView === "function") {
        this.input.renderMessengerDashboardView();
      }
    }

    updateMessengerWorkspaceSummary() {
      const messengerLabel = this.getMessengerDisplayName(this.state.selectedMessenger);
      const activeView = this.getActiveView();
      const aiViewActive = activeView === "ai";
      const selectedId = this.normalizeTelegramChatId(this.state.selectedTelegramChatId);
      const selectedChat = this.getSelectedTelegramChat();
      const selectedChatLabel = selectedChat
        ? String(selectedChat.title || ("Chat " + selectedId)).trim() || ("Chat " + selectedId)
        : selectedId
          ? "Chat ID " + selectedId
          : "None";
      let sidebarKicker = "Messenger Workspace";
      let sidebarTitle = messengerLabel + " Workspace";
      let sidebarDescription = messengerLabel + " runtime and chat context.";
      let sidebarActiveChip = messengerLabel;
      let hintText = messengerLabel + " dashboard mode is active.";
      let detailSubtitle = "Use this pane to track " + messengerLabel + " runtime context.";
      let detailChatText = this.state.selectedMessenger === "telegram"
        ? selectedChatLabel
        : this.state.selectedMessenger === "matrix"
          ? "Matrix room controls pending"
          : this.state.selectedMessenger === "whatsapp"
            ? "Manual phone target in composer"
            : "Discord channels are managed in Discord views";
      if (aiViewActive) {
        sidebarKicker = "Rod Workspace";
        sidebarTitle = "LazyDev";
        sidebarDescription = "Workflow shortcuts are active in this sidebar while LazyDev is selected.";
        sidebarActiveChip = "LazyDev";
        hintText = "Pick a workflow shortcut to jump directly to that studio card.";
        detailSubtitle = "LazyDev is active. Use workflow shortcuts from the left sidebar.";
        detailChatText = "LazyDev workflows";
      } else if (this.state.selectedMessenger === "telegram") {
        sidebarDescription = "Telegram chats and runtime context stay synced in this sidebar.";
        detailSubtitle = "Track Telegram runtime state and the selected chat.";
        if (selectedChat) {
          hintText = "Selected Telegram chat: " + selectedChatLabel + ".";
        } else if (selectedId) {
          hintText = "Manual Telegram chat ID selected: " + selectedId + ".";
        } else {
          hintText = "Select Telegram to load chats, then click one chat to route messages.";
        }
      } else if (this.state.selectedMessenger === "matrix") {
        sidebarDescription = "Matrix runtime context is active. Room controls can be added next.";
        detailSubtitle = "Track Matrix runtime while room list/send actions are being wired.";
        hintText = "Matrix runtime selected. Add Matrix admin endpoints to unlock room list + send actions.";
      } else if (this.state.selectedMessenger === "whatsapp") {
        sidebarDescription = "WhatsApp runtime context is active. Use E.164 phone numbers in the messaging composer.";
        detailSubtitle = "Track WhatsApp runtime and send message status through the admin runtime.";
        hintText = "WhatsApp mode selected. Set recipient phone number and send from Messaging view.";
      } else {
        sidebarDescription = "Discord runtime controls stay available while Discord views stay separate.";
        detailSubtitle = "Track Discord runtime status from this inspector when needed.";
        hintText = "Discord mode selected. Use Discord tabs for guild channels and messaging workflows.";
      }
      const sidebarKickerNode = document.getElementById("messenger-sidebar-kicker");
      if (sidebarKickerNode) {
        sidebarKickerNode.textContent = sidebarKicker;
      }
      const activeChip = document.getElementById("messenger-active-chip");
      if (activeChip) {
        activeChip.textContent = messengerLabel;
      }
      const hintNode = document.getElementById("messenger-chat-hint");
      if (hintNode) {
        hintNode.textContent = hintText;
      }
      const sidebarTitleNode = document.getElementById("messenger-sidebar-title");
      if (sidebarTitleNode) {
        sidebarTitleNode.textContent = sidebarTitle;
      }
      const sidebarDescriptionNode = document.getElementById("messenger-sidebar-description");
      if (sidebarDescriptionNode) {
        sidebarDescriptionNode.textContent = sidebarDescription;
      }
      const sidebarActiveChipNode = document.getElementById("messenger-sidebar-active-chip");
      if (sidebarActiveChipNode) {
        sidebarActiveChipNode.textContent = sidebarActiveChip;
      }
      const sidebarHintNode = document.getElementById("messenger-sidebar-hint");
      if (sidebarHintNode) {
        sidebarHintNode.textContent = hintText;
      }
      const detailActiveNode = document.getElementById("detail-messenger-active");
      if (detailActiveNode) {
        detailActiveNode.textContent = messengerLabel;
      }
      const detailNameNode = document.getElementById("detail-messenger-name");
      if (detailNameNode) {
        detailNameNode.textContent = messengerLabel;
      }
      const detailSubtitleNode = document.getElementById("detail-messenger-subtitle");
      if (detailSubtitleNode) {
        detailSubtitleNode.textContent = detailSubtitle;
      }
      const detailHintNode = document.getElementById("detail-messenger-hint");
      if (detailHintNode) {
        detailHintNode.textContent = hintText;
      }
      const detailChatNode = document.getElementById("detail-messenger-chat");
      if (detailChatNode) {
        detailChatNode.textContent = detailChatText;
      }
      const telegramRefreshEnabled = this.state.selectedMessenger === "telegram" && !aiViewActive;
      const refreshChatsButtons = [
        document.getElementById("telegram-refresh-chats-button"),
        document.getElementById("messenger-sidebar-refresh-chats-button")
      ];
      refreshChatsButtons.forEach(button => {
        if (!button) {
          return;
        }
        button.disabled = !telegramRefreshEnabled;
      });
    }

    applyMessengerSelectionUi() {
      const messenger = this.normalizeMessenger(this.state.selectedMessenger);
      const activeView = this.getActiveView();
      const suppressSidebarActiveState = activeView === "ai";
      this.state.selectedMessenger = messenger;
      document.body.classList.remove("messenger-discord", "messenger-telegram", "messenger-matrix", "messenger-whatsapp");
      document.body.classList.add("messenger-" + messenger);
      document.querySelectorAll("[data-messenger]").forEach(node => {
        const isActiveMessenger = node.getAttribute("data-messenger") === messenger;
        const suppressForStudioSidebar = suppressSidebarActiveState && node.classList.contains("sidebar-messenger-button");
        node.classList.toggle("active", isActiveMessenger && !suppressForStudioSidebar);
      });
      this.syncStudioRightSidebar(activeView);
    }
  }

  const controller = new DashboardShellRuntimeThemeController(input);
  return {
    normalizeDashboardTheme: value => controller.normalizeDashboardTheme(value),
    getDashboardThemeLabel: value => controller.getDashboardThemeLabel(value),
    readDashboardThemePreference: () => controller.readDashboardThemePreference(),
    shouldAnimateDashboardThemeTransition: options => controller.shouldAnimateDashboardThemeTransition(options),
    setDashboardThemeTransitionEnabled: enabled => controller.setDashboardThemeTransitionEnabled(enabled),
    updateDashboardThemeButtons: () => controller.updateDashboardThemeButtons(),
    setDashboardTheme: (nextTheme, options) => controller.setDashboardTheme(nextTheme, options),
    getNextDashboardTheme: currentTheme => controller.getNextDashboardTheme(currentTheme),
    normalizeMessenger: value => controller.normalizeMessenger(value),
    isDiscordOnlyView: view => controller.isDiscordOnlyView(view),
    getActiveView: () => controller.getActiveView(),
    restoreStudioRightSidebarAsides: () => controller.restoreStudioRightSidebarAsides(),
    syncStudioRightSidebar: view => controller.syncStudioRightSidebar(view),
    getMessengerDisplayName: messenger => controller.getMessengerDisplayName(messenger),
    normalizeThemeTarget: value => controller.normalizeThemeTarget(value),
    applyMessengerThemeVariables: inputValue => controller.applyMessengerThemeVariables(inputValue),
    loadThemeConfig: target => controller.loadThemeConfig(target),
    applyThemeForCurrentContext: messenger => controller.applyThemeForCurrentContext(messenger),
    getSelectedMessengerRuntime: () => controller.getSelectedMessengerRuntime(),
    normalizeTelegramChatId: value => controller.normalizeTelegramChatId(value),
    getSelectedTelegramChat: () => controller.getSelectedTelegramChat(),
    setSelectedTelegramChatId: value => controller.setSelectedTelegramChatId(value),
    setRuntimeOverlayOpen: isOpen => controller.setRuntimeOverlayOpen(isOpen),
    setSettingsOverlayOpen: isOpen => controller.setSettingsOverlayOpen(isOpen),
    getRuntimeProgressValue: status => controller.getRuntimeProgressValue(status),
    formatRuntimeMeta: runtime => controller.formatRuntimeMeta(runtime),
    updateMessengerRuntimeLaunchUi: () => controller.updateMessengerRuntimeLaunchUi(),
    renderMessengerRuntimePanel: () => controller.renderMessengerRuntimePanel(),
    updateMessengerWorkspaceSummary: () => controller.updateMessengerWorkspaceSummary(),
    applyMessengerSelectionUi: () => controller.applyMessengerSelectionUi()
  };
}
