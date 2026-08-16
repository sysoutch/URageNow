function createDashboardOverlayHelpers(input) {
  const state = input?.state || {};
  const dashboardAppearanceStorageKey = "urage-dashboard-appearance";
  const refreshMeta = input?.refreshMeta || {};
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const clearChildren = typeof input?.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback(node) {
    if (node) {
      node.innerHTML = "";
    }
  };
  const describeClientError = typeof input?.describeClientError === "function" ? input.describeClientError : function describeClientErrorFallback(error, fallback) {
    return error instanceof Error ? error.message : (fallback || "Unknown error.");
  };
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const renderMarkdownInto = typeof input?.renderMarkdownInto === "function" ? input.renderMarkdownInto : function renderMarkdownIntoFallback() {};
  const workflowSidebarModeStorageKey = "urage-studio-workflow-sidebar-mode";
  const normalizeMessenger = typeof input?.normalizeMessenger === "function" ? input.normalizeMessenger : value => value === "telegram" || value === "matrix" || value === "whatsapp" ? value : "discord";
  const setSelectedMessenger = typeof input?.setSelectedMessenger === "function" ? input.setSelectedMessenger : function setSelectedMessengerFallback() {};
  const getMessengerDisplayName = typeof input?.getMessengerDisplayName === "function" ? input.getMessengerDisplayName : messenger => messenger === "telegram" ? "Telegram" : messenger === "whatsapp" ? "WhatsApp" : messenger === "matrix" ? "Matrix" : "Discord";
  const loadMessengerRuntimes = typeof input?.loadMessengerRuntimes === "function" ? input.loadMessengerRuntimes : async function loadMessengerRuntimesFallback() {};
  const loadTelegramChats = typeof input?.loadTelegramChats === "function" ? input.loadTelegramChats : async function loadTelegramChatsFallback() {};
  const refreshState = typeof input?.refreshState === "function" ? input.refreshState : async function refreshStateFallback() {};
  const controlSelectedMessengerRuntime = typeof input?.controlSelectedMessengerRuntime === "function" ? input.controlSelectedMessengerRuntime : async function controlSelectedMessengerRuntimeFallback() {};
  const switchView = typeof input?.switchView === "function" ? input.switchView : function switchViewFallback() {};
  const loadAutomationPresets = typeof input?.loadAutomationPresets === "function" ? input.loadAutomationPresets : async function loadAutomationPresetsFallback() {};
  const refreshAutomationTextSources = typeof input?.refreshAutomationTextSources === "function" ? input.refreshAutomationTextSources : async function refreshAutomationTextSourcesFallback() {};
  const setRuntimeOverlayOpen = typeof input?.setRuntimeOverlayOpen === "function" ? input.setRuntimeOverlayOpen : function setRuntimeOverlayOpenFallback() {};
  const setSettingsOverlayOpen = typeof input?.setSettingsOverlayOpen === "function" ? input.setSettingsOverlayOpen : function setSettingsOverlayOpenFallback() {};
  const clearAiImages = typeof input?.clearAiImages === "function" ? input.clearAiImages : function clearAiImagesFallback() {};
  const clearAskSkillModelUploads = typeof input?.clearAskSkillModelUploads === "function" ? input.clearAskSkillModelUploads : function clearAskSkillModelUploadsFallback() {};
  const clearAskFileUploads = typeof input?.clearAskFileUploads === "function" ? input.clearAskFileUploads : function clearAskFileUploadsFallback() {};
  const renderTelegramChats = typeof input?.renderTelegramChats === "function" ? input.renderTelegramChats : function renderTelegramChatsFallback() {};
  const sendTelegramMessageFromUi = typeof input?.sendTelegramMessageFromUi === "function" ? input.sendTelegramMessageFromUi : async function sendTelegramMessageFromUiFallback() {};
  const sendWhatsAppMessageFromUi = typeof input?.sendWhatsAppMessageFromUi === "function" ? input.sendWhatsAppMessageFromUi : async function sendWhatsAppMessageFromUiFallback() {};
  const setSelectedTelegramChatId = typeof input?.setSelectedTelegramChatId === "function" ? input.setSelectedTelegramChatId : function setSelectedTelegramChatIdFallback() {};
  const normalizeTelegramChatId = typeof input?.normalizeTelegramChatId === "function" ? input.normalizeTelegramChatId : value => String(value || "").trim();
  const getMessengerBrowserUrl = typeof input?.getMessengerBrowserUrl === "function" ? input.getMessengerBrowserUrl : () => "";
  const loadGuilds = typeof input?.loadGuilds === "function" ? input.loadGuilds : async function loadGuildsFallback() {};
  const updateSelectionDetails = typeof input?.updateSelectionDetails === "function" ? input.updateSelectionDetails : function updateSelectionDetailsFallback() {};
  const renderGuildPermissions = typeof input?.renderGuildPermissions === "function" ? input.renderGuildPermissions : function renderGuildPermissionsFallback() {};
  const renderChannelPermissions = typeof input?.renderChannelPermissions === "function" ? input.renderChannelPermissions : function renderChannelPermissionsFallback() {};
  const renderMessengerDashboardView = typeof input?.renderMessengerDashboardView === "function" ? input.renderMessengerDashboardView : function renderMessengerDashboardViewFallback() {};
  const updateMessengerRuntimeLaunchUi = typeof input?.updateMessengerRuntimeLaunchUi === "function" ? input.updateMessengerRuntimeLaunchUi : function updateMessengerRuntimeLaunchUiFallback() {};
  const saveMessengerRuntimeSettingsFromUi = typeof input?.saveMessengerRuntimeSettingsFromUi === "function" ? input.saveMessengerRuntimeSettingsFromUi : async function saveMessengerRuntimeSettingsFromUiFallback() {};
  const loadDashboardDiscordChannels = typeof input?.loadDashboardDiscordChannels === "function" ? input.loadDashboardDiscordChannels : async function loadDashboardDiscordChannelsFallback() {};
  const loadDashboardDiscordMessages = typeof input?.loadDashboardDiscordMessages === "function" ? input.loadDashboardDiscordMessages : async function loadDashboardDiscordMessagesFallback() {};
  const openAiSection = typeof input?.openAiSection === "function" ? input.openAiSection : function openAiSectionFallback() {};
  const clearAiSectionFocus = typeof input?.clearAiSectionFocus === "function" ? input.clearAiSectionFocus : function clearAiSectionFocusFallback() {};
  const updateStudioWorkflowSidebar = typeof input?.updateStudioWorkflowSidebar === "function" ? input.updateStudioWorkflowSidebar : function updateStudioWorkflowSidebarFallback() {};
  const loadOllamaModels = typeof input?.loadOllamaModels === "function" ? input.loadOllamaModels : async function loadOllamaModelsFallback() {};
  const refreshActiveArtToolImagePoolBridge = typeof input?.refreshActiveArtToolImagePoolBridge === "function"
    ? input.refreshActiveArtToolImagePoolBridge
    : function refreshActiveArtToolImagePoolBridgeFallback() {};
  const ensureImagePoolDataLoaded = typeof input?.ensureImagePoolDataLoaded === "function"
    ? input.ensureImagePoolDataLoaded
    : async function ensureImagePoolDataLoadedFallback() {};
  const getDashboardThemeLabel = typeof input?.getDashboardThemeLabel === "function" ? input.getDashboardThemeLabel : () => "Default";
  const setDashboardTheme = typeof input?.setDashboardTheme === "function" ? input.setDashboardTheme : function setDashboardThemeFallback() {};
  const getNextDashboardTheme = typeof input?.getNextDashboardTheme === "function" ? input.getNextDashboardTheme : () => "obsidian";
  const setStudioRailExpanded = typeof input?.setStudioRailExpanded === "function" ? input.setStudioRailExpanded : function setStudioRailExpandedFallback() {};
  const setWorkflowSidebarMode = typeof input?.setWorkflowSidebarMode === "function" ? input.setWorkflowSidebarMode : function setWorkflowSidebarModeFallback() {};
  const workflowRightSidebarTargets = Array.isArray(input?.workflowRightSidebarTargets) ? input.workflowRightSidebarTargets : [];
  const setWorkflowRightSidebarCollapsed = typeof input?.setWorkflowRightSidebarCollapsed === "function"
    ? input.setWorkflowRightSidebarCollapsed
    : function setWorkflowRightSidebarCollapsedFallback() {};

  function setResourcesOverlayOpen(isOpen, options = {}) {
    const overlayNode = document.getElementById("resources-overlay");
    if (!overlayNode) {
      return;
    }
    if (isOpen && options.tab === "image-pools") {
      void ensureImagePoolDataLoaded().catch(() => {});
    }
    if (options.tab) {
      switchResourcesTab(options.tab);
    }
    overlayNode.classList.toggle("hidden", !isOpen);
    overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
    document.body.classList.toggle("settings-overlay-open", isOpen);
  }

  function switchResourcesTab(tab) {
    const nextTab = tab === "image-pools" ? "image-pools" : "text-sources";
    document.querySelectorAll("[data-resources-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-resources-tab") === nextTab);
    });
    const textPanel = document.getElementById("resources-panel-text-sources");
    const poolPanel = document.getElementById("resources-panel-image-pools");
    if (textPanel) {
      textPanel.classList.toggle("active", nextTab === "text-sources");
    }
    if (poolPanel) {
      poolPanel.classList.toggle("active", nextTab === "image-pools");
    }
  }

  function setSkillsStatus(message) {
    const statusNode = document.getElementById("skills-refresh-status");
    if (statusNode) {
      statusNode.textContent = message;
    }
  }

  function setSkillsOutput(message) {
    const outputNode = document.getElementById("skills-output");
    if (outputNode) {
      outputNode.textContent = message;
    }
  }

  function createSkillTemplate() {
    return [
      "---",
      "outputKind: utility",
      "inputMode: optional",
      "supportsMultiple: false",
      "allowedFollowUps:",
      "routerHint:",
      "---",
      "",
      "# New Skill",
      "",
      "Describe what this skill does, when it should be used, and the exact workflow the model should follow."
    ].join("\n");
  }

  function renderSkillsOverlayList(skills) {
    const listNode = document.getElementById("skills-list");
    if (!listNode) {
      return;
    }
    clearChildren(listNode);
    if (!Array.isArray(skills) || skills.length === 0) {
      const emptyNode = document.createElement("div");
      emptyNode.className = "hint";
      emptyNode.textContent = "No skills found yet.";
      listNode.appendChild(emptyNode);
      return;
    }
    for (const skill of skills) {
      const button = document.createElement("button");
      const metadata = skill && skill.metadata ? skill.metadata : {};
      button.type = "button";
      button.className = "secondary skills-list-row";
      button.classList.toggle("active", skill.id === state.selectedSkillEditorId);
      button.addEventListener("click", () => {
        void loadSkillIntoEditor(skill.id);
      });
      const title = document.createElement("strong");
      title.textContent = skill.name || skill.id;
      const id = document.createElement("span");
      id.className = "hint";
      id.textContent = skill.id;
      const description = document.createElement("span");
      description.className = "skills-list-description";
      description.textContent = skill.description || "No description.";
      const meta = document.createElement("span");
      meta.className = "skills-list-meta";
      meta.textContent = [metadata.outputKind, metadata.inputMode].filter(Boolean).join(" / ");
      button.append(title, id, description, meta);
      listNode.appendChild(button);
    }
  }

  async function refreshSkillsOverlay(preferredSkillId = state.selectedSkillEditorId) {
    try {
      setSkillsStatus("Loading skills...");
      const payload = await request("/api/chat-skills");
      state.chatSkills = Array.isArray(payload.skills) ? payload.skills : [];
      renderSkillsOverlayList(state.chatSkills);
      setSkillsStatus("Loaded " + state.chatSkills.length + " skill" + (state.chatSkills.length === 1 ? "." : "s."));
      if (preferredSkillId && state.chatSkills.some(skill => skill.id === preferredSkillId)) {
        await loadSkillIntoEditor(preferredSkillId, { skipRefresh: true });
      }
    } catch (error) {
      setSkillsStatus("Failed to load skills.");
      setSkillsOutput(describeClientError(error, "Failed to load skills."));
    }
  }

  async function loadSkillIntoEditor(skillId, options = {}) {
    const normalizedId = String(skillId || "").trim();
    if (!normalizedId) {
      return;
    }
    try {
      const payload = await request("/api/chat-skill?skillId=" + encodeURIComponent(normalizedId));
      state.selectedSkillEditorId = payload.id || normalizedId;
      const idInput = document.getElementById("skill-editor-id");
      const contentInput = document.getElementById("skill-editor-content");
      if (idInput) {
        idInput.value = state.selectedSkillEditorId;
      }
      if (contentInput) {
        contentInput.value = payload.content || "";
      }
      renderSkillsOverlayList(state.chatSkills);
      setSkillsOutput("Loaded " + state.selectedSkillEditorId + "/skill.md.");
      if (!options.skipRefresh) {
        setSkillsStatus("Selected " + state.selectedSkillEditorId + ".");
      }
    } catch (error) {
      setSkillsOutput(describeClientError(error, "Failed to load skill."));
    }
  }

  async function saveSkillFromEditor() {
    const idInput = document.getElementById("skill-editor-id");
    const contentInput = document.getElementById("skill-editor-content");
    const skillId = idInput ? idInput.value.trim() : "";
    const content = contentInput ? contentInput.value : "";
    if (!skillId || !content.trim()) {
      setSkillsOutput("Skill ID and skill.md content are required.");
      return;
    }
    try {
      const payload = await request("/api/chat-skill", { skillId, content });
      state.selectedSkillEditorId = payload.id || skillId;
      setSkillsOutput("Saved " + state.selectedSkillEditorId + "/skill.md.");
      await refreshSkillsOverlay(state.selectedSkillEditorId);
      setOutput("Saved chat skill " + state.selectedSkillEditorId + ".");
    } catch (error) {
      setSkillsOutput(describeClientError(error, "Failed to save skill."));
    }
  }

  function startNewSkillEditor() {
    state.selectedSkillEditorId = "";
    const idInput = document.getElementById("skill-editor-id");
    const contentInput = document.getElementById("skill-editor-content");
    if (idInput) {
      idInput.value = "";
      idInput.focus();
    }
    if (contentInput) {
      contentInput.value = createSkillTemplate();
    }
    renderSkillsOverlayList(state.chatSkills);
    setSkillsOutput("Drafting a new skill. Pick a unique Skill ID, then save.");
  }

  function setSkillsOverlayOpen(isOpen) {
    const overlayNode = document.getElementById("skills-overlay");
    if (!overlayNode) {
      return;
    }
    overlayNode.classList.toggle("hidden", !isOpen);
    overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
    document.body.classList.toggle("settings-overlay-open", isOpen);
    if (isOpen) {
      void refreshSkillsOverlay();
    }
  }

  function setAboutOverlayOpen(isOpen) {
    const overlayNode = document.getElementById("about-overlay");
    if (!overlayNode) {
      return;
    }
    overlayNode.classList.toggle("hidden", !isOpen);
    overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
    document.body.classList.toggle("settings-overlay-open", isOpen);
  }

  function setWorkflowSettingsOverlayOpen(isOpen, options = {}) {
    const overlayNode = document.getElementById("workflow-settings-overlay");
    if (!overlayNode) {
      return;
    }
    const panelId = String(options.panel || "").trim();
    const title = String(options.title || "Connection And Path Settings").trim() || "Connection And Path Settings";
    const kicker = String(options.kicker || "Workflow Settings").trim() || "Workflow Settings";
    overlayNode.classList.toggle("hidden", !isOpen);
    overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
    document.body.classList.toggle("settings-overlay-open", isOpen);
    const titleNode = document.getElementById("workflow-settings-overlay-title");
    if (titleNode) {
      titleNode.textContent = title;
    }
    const kickerNode = document.getElementById("workflow-settings-overlay-kicker");
    if (kickerNode) {
      kickerNode.textContent = kicker;
    }
    document.querySelectorAll("[data-workflow-settings-panel]").forEach(panelNode => {
      const isActive = isOpen && panelId && panelNode.getAttribute("data-workflow-settings-panel") === panelId;
      panelNode.classList.toggle("hidden", !isActive);
    });
  }

  function switchAboutTab(tab) {
    const nextTab = tab === "about" ? "about" : "how";
    document.querySelectorAll("[data-about-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-about-tab") === nextTab);
    });
    const howPanel = document.getElementById("about-panel-how");
    const aboutPanel = document.getElementById("about-panel-about");
    if (howPanel) {
      howPanel.classList.toggle("active", nextTab === "how");
    }
    if (aboutPanel) {
      aboutPanel.classList.toggle("active", nextTab === "about");
    }
  }

  function switchSettingsTab(tab) {
    const settingsTabs = {
      setup: "Setup And Paths",
      network: "Network And Devices",
      ui: "Interface",
      themes: "Themes And Appearance"
    };
    const nextTab = Object.hasOwn(settingsTabs, tab) ? tab : "setup";
    document.querySelectorAll("[data-settings-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-settings-tab") === nextTab);
      button.setAttribute("aria-selected", button.getAttribute("data-settings-tab") === nextTab ? "true" : "false");
    });
    document.querySelectorAll("[data-settings-panel]").forEach(panel => {
      panel.classList.toggle("active", panel.getAttribute("data-settings-panel") === nextTab);
    });
    if (nextTab === "setup") {
      switchSettingsSubtab("install");
    }
    if (nextTab === "network" && !document.querySelector("[data-network-settings-subtab].active")) {
      switchNetworkSettingsSubtab("connection");
    }
    const title = document.getElementById("settings-overlay-title");
    if (title) title.textContent = settingsTabs[nextTab];
  }

  function switchSettingsSubtab(tab) {
    const allowedTabs = new Set(["install", "comfyui", "ffmpeg", "workflows", "messengers"]);
    const nextTab = allowedTabs.has(tab) ? tab : "install";
    document.querySelectorAll("[data-settings-subtab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-settings-subtab") === nextTab);
    });
    document.querySelectorAll("[data-settings-subpanel]").forEach(panel => {
      panel.classList.toggle("active", panel.getAttribute("data-settings-subpanel") === nextTab);
    });
  }

  function switchNetworkSettingsSubtab(tab) {
    const allowedTabs = new Set(["connection", "remote-access", "devices"]);
    const nextTab = allowedTabs.has(tab) ? tab : "connection";
    document.querySelectorAll("[data-network-settings-subtab]").forEach(button => {
      const active = button.getAttribute("data-network-settings-subtab") === nextTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-network-settings-subpanel]").forEach(panel => {
      panel.classList.toggle("active", panel.getAttribute("data-network-settings-subpanel") === nextTab);
    });
  }

  function switchThemeManagerGroup(group) {
    const nextGroup = group === "core" || group === "mood" ? group : "all";
    document.querySelectorAll("[data-theme-manager-group]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-theme-manager-group") === nextGroup);
    });
    document.querySelectorAll("[data-theme-manager-card]").forEach(card => {
      const cardGroup = card.getAttribute("data-theme-group-panel") || "all";
      card.classList.toggle("hidden", nextGroup !== "all" && cardGroup !== nextGroup);
    });
  }

  const dashboardAppearanceComponents = [
    "tabs",
    "buttons",
    "selections",
    "inputs",
    "textareas",
    "selects",
    "ranges",
    "checkboxes",
    "chips",
    "cards",
    "foldouts",
    "sidebars",
    "toolbars",
    "lists",
    "tables",
    "badges",
    "modals",
    "overlays",
    "previews",
    "outputs",
    "rails"
  ];
  const dashboardAppearanceProps = ["radius", "padding", "margin"];

  function normalizeDashboardRange(value, maxValue) {
    const parsed = Number.parseInt(String(value || "0"), 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(maxValue, parsed)) : 0;
  }

  function normalizeDashboardOptionalRange(value, maxValue) {
    if (value === "" || value === null || typeof value === "undefined") {
      return null;
    }
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.max(0, Math.min(maxValue, parsed)) : null;
  }

  function normalizeDashboardAppearance(appearance = {}) {
    const components = {};
    const inputComponents = appearance && typeof appearance.components === "object" ? appearance.components : {};
    dashboardAppearanceComponents.forEach(component => {
      const source = inputComponents && typeof inputComponents[component] === "object" ? inputComponents[component] : {};
      const nextComponent = {};
      dashboardAppearanceProps.forEach(prop => {
        const maxValue = prop === "radius" ? 32 : 40;
        const nextValue = normalizeDashboardOptionalRange(source[prop], maxValue);
        if (nextValue !== null) {
          nextComponent[prop] = nextValue;
        }
      });
      components[component] = nextComponent;
    });
    return {
      borderRadiusPx: normalizeDashboardRange(appearance?.borderRadiusPx, 18),
      paddingPx: normalizeDashboardRange(appearance?.paddingPx, 28),
      marginPx: normalizeDashboardRange(appearance?.marginPx, 28),
      components
    };
  }

  function setAppearanceStatus(message) {
    const statusNode = document.getElementById("dashboard-appearance-status");
    if (statusNode) {
      statusNode.textContent = message;
    }
  }

  function applyDashboardAppearance(appearance, options = {}) {
    const nextAppearance = normalizeDashboardAppearance({ ...(state.dashboardAppearance || {}), ...(appearance || {}) });
    state.dashboardAppearance = nextAppearance;
    const rootStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const setRootAndBody = (name, value) => {
      rootStyle.setProperty(name, value);
      bodyStyle.setProperty(name, value);
    };
    setRootAndBody("--dashboard-border-radius", nextAppearance.borderRadiusPx + "px");
    setRootAndBody("--dashboard-padding", nextAppearance.paddingPx + "px");
    setRootAndBody("--dashboard-margin", nextAppearance.marginPx + "px");
    dashboardAppearanceComponents.forEach(component => {
      dashboardAppearanceProps.forEach(prop => {
        const fallback = prop === "radius" ? nextAppearance.borderRadiusPx : prop === "padding" ? nextAppearance.paddingPx : nextAppearance.marginPx;
        const value = nextAppearance.components[component][prop];
        setRootAndBody("--dashboard-" + component + "-" + prop, (typeof value === "number" ? value : fallback) + "px");
      });
    });
    syncDashboardAppearanceControls(nextAppearance);
    if (options.persist !== false) {
      try {
        window.localStorage.setItem(dashboardAppearanceStorageKey, JSON.stringify(nextAppearance));
      } catch (error) {
        setAppearanceStatus("Appearance could not be saved locally.");
      }
    }
  }

  function syncDashboardRangeControl(inputId, valueId, value) {
    const inputNode = document.getElementById(inputId);
    const valueNode = document.getElementById(valueId);
    if (inputNode) {
      inputNode.value = String(value);
      syncDashboardRangeProgress(inputNode);
    }
    if (valueNode) {
      valueNode.textContent = value + "px";
    }
  }

  function syncDashboardRangeProgress(inputNode) {
    if (!inputNode || inputNode.type !== "range") {
      return;
    }
    const min = Number.parseFloat(inputNode.min || "0");
    const max = Number.parseFloat(inputNode.max || "100");
    const value = Number.parseFloat(inputNode.value || "0");
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    inputNode.style.setProperty("--range-progress", Math.max(0, Math.min(100, progress)) + "");
  }

  function getDashboardAppearanceValueLabel(value) {
    return typeof value === "number" ? value + "px" : "Global";
  }

  function syncDashboardAppearanceControls(appearance) {
    syncDashboardRangeControl("dashboard-border-radius-input", "dashboard-border-radius-value", appearance.borderRadiusPx);
    syncDashboardRangeControl("dashboard-padding-input", "dashboard-padding-value", appearance.paddingPx);
    syncDashboardRangeControl("dashboard-margin-input", "dashboard-margin-value", appearance.marginPx);
    const componentOverrideCounts = {};
    document.querySelectorAll("[data-appearance-component-input]").forEach(inputNode => {
      const component = inputNode.getAttribute("data-appearance-component-input");
      const prop = inputNode.getAttribute("data-appearance-component-prop");
      const value = appearance.components?.[component]?.[prop];
      if (typeof value === "number") {
        componentOverrideCounts[component] = (componentOverrideCounts[component] || 0) + 1;
      }
      inputNode.value = typeof value === "number" ? String(value) : "-1";
      syncDashboardRangeProgress(inputNode);
      const valueNode = document.querySelector(`[data-appearance-component-value="${component}"][data-appearance-component-prop="${prop}"]`);
      if (valueNode) {
        valueNode.textContent = getDashboardAppearanceValueLabel(value);
      }
    });
    document.querySelectorAll("[data-theme-component-summary]").forEach(summaryNode => {
      const component = summaryNode.getAttribute("data-theme-component-summary");
      const count = componentOverrideCounts[component] || 0;
      summaryNode.textContent = count > 0 ? count + (count === 1 ? " override" : " overrides") : "Global";
    });
  }

  function updateDashboardAppearanceGlobal(prop, value) {
    const current = normalizeDashboardAppearance(state.dashboardAppearance || {});
    const key = prop === "padding" ? "paddingPx" : prop === "margin" ? "marginPx" : "borderRadiusPx";
    current[key] = normalizeDashboardRange(value, prop === "radius" ? 18 : 28);
    applyDashboardAppearance(current);
  }

  function updateDashboardAppearanceComponent(component, prop, value) {
    if (!dashboardAppearanceComponents.includes(component) || !dashboardAppearanceProps.includes(prop)) {
      return;
    }
    const current = normalizeDashboardAppearance(state.dashboardAppearance || {});
    const nextValue = normalizeDashboardOptionalRange(value, prop === "radius" ? 32 : 40);
    if (nextValue === null) {
      delete current.components[component][prop];
    } else {
      current.components[component][prop] = nextValue;
    }
    applyDashboardAppearance(current);
  }

  function loadDashboardAppearance() {
    let savedAppearance = {};
    try {
      savedAppearance = JSON.parse(window.localStorage.getItem(dashboardAppearanceStorageKey) || "{}");
    } catch (error) {
      savedAppearance = {};
    }
    applyDashboardAppearance(savedAppearance, { persist: false });
  }

  async function runSelectedMessengerRuntimeAction(action) {
    const messengerLabel = getMessengerDisplayName(state.selectedMessenger);
    await controlSelectedMessengerRuntime(action);
    setOutput(messengerLabel + " runtime " + action + " requested.");
  }

  async function refreshMessengerDataFromUi() {
    await loadMessengerRuntimes();
    if (state.selectedMessenger === "telegram") {
      await loadTelegramChats();
      return;
    }
    renderTelegramChats();
  }

  function showStudioHome(homeView = "studio") {
    state.aiHomeMode = homeView === "workflow" ? "workflow" : "studio";
    state.aiWorkflowSidebarVisible = false;
    if (state.aiHomeMode === "studio") {
      // URage NOW Home is the top-level overview. A previous LazyDev hover
      // must not keep its child rail open after returning here.
      document.body.classList.remove("studio-rail-hover-active");
      delete document.body.dataset.studioRailHoverGroup;
      delete document.body.dataset.studioRailHoverLeavingGroup;
    }
    clearAiSectionFocus();
    switchView("ai");
  }

  function showAllStudioCards() {
    showStudioHome("studio");
  }

  function openAiScrollTarget(targetId) {
    const normalizedTargetId = String(targetId || "").trim();
    if (!normalizedTargetId) {
      return;
    }
    const targetNode = document.getElementById(normalizedTargetId);
    const isWorkflowTarget = !!(targetNode && targetNode.classList.contains("ai-section-target"));
    if (isWorkflowTarget) {
      state.aiHomeMode = "studio";
      state.aiWorkflowSidebarVisible = true;
    }
    openAiSection(normalizedTargetId, { focusOnly: isWorkflowTarget });
  }

  function applyPromptPreset(targetId, presetValue) {
    if (!targetId || !presetValue) {
      return;
    }
    const targetNode = document.getElementById(targetId);
    if (!targetNode || typeof targetNode.value !== "string") {
      return;
    }
    targetNode.value = presetValue;
    targetNode.dispatchEvent(new Event("input", { bubbles: true }));
    targetNode.dispatchEvent(new Event("change", { bubbles: true }));
    targetNode.focus();
    targetNode.setSelectionRange(targetNode.value.length, targetNode.value.length);
    const label = targetId === "imagegen-prompt"
      ? "Image prompt"
      : targetId === "speech-tts-text"
        ? "TTS text"
        : "Ask LazyDev prompt";
    setOutput(label + " preset applied.");
  }

  function applyFieldPreset(source, label) {
    if (!source) {
      return;
    }
    source.split("|").map(entry => entry.trim()).filter(Boolean).forEach(entry => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0) {
        return;
      }
      const targetId = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      const targetNode = document.getElementById(targetId);
      if (!targetNode || typeof targetNode.value !== "string") {
        return;
      }
      targetNode.value = value;
      targetNode.dispatchEvent(new Event("input", { bubbles: true }));
      targetNode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    setOutput((String(label || "").trim() || "Preset") + " preset applied.");
  }

  async function restartDashboard() {
    const restartButtons = Array.from(document.querySelectorAll("[data-restart-dashboard=\"true\"]"));
    const activeButton = restartButtons.find(button => button.disabled);
    if (activeButton) {
      return;
    }
    restartButtons.forEach(button => {
      button.disabled = true;
    });
    setOutput("Restarting dashboard server...");
    try {
      await request("/api/dashboard/restart", { requestedBy: "webui" });
    } catch (error) {
      const detail = describeClientError(error, "Dashboard restart request failed.");
      setOutput(detail + " Reloading dashboard UI instead.");
      window.setTimeout(() => {
        window.location.reload();
      }, 240);
      return;
    }
    window.setTimeout(() => {
      window.location.reload();
    }, 900);
  }

  function bindClick(id, handler) {
    const node = document.getElementById(id);
    if (node) {
      node.addEventListener("click", handler);
    }
  }

  function bindEvents() {
    loadDashboardAppearance();
    document.querySelectorAll("[data-feed]").forEach(button => {
      button.addEventListener("click", event => {
        const feed = event.currentTarget.getAttribute("data-feed");
        document.querySelectorAll("[data-feed]").forEach(entry => entry.classList.remove("active"));
        event.currentTarget.classList.add("active");
        document.getElementById("feed-actions")?.classList.toggle("hidden", feed !== "actions");
        document.getElementById("feed-reviews")?.classList.toggle("hidden", feed !== "reviews");
        document.getElementById("feed-drafts")?.classList.toggle("hidden", feed !== "drafts");
      });
    });
    document.querySelectorAll("[data-view]").forEach(button => {
      button.addEventListener("click", event => {
        const view = event.currentTarget.getAttribute("data-view");
        if (view === "ai") {
          showStudioHome(event.currentTarget.getAttribute("data-studio-home-view") || "studio");
          if (refreshMeta.ollamaModels === 0) {
            void loadOllamaModels();
          }
          return;
        }
        switchView(view);
        if (view === "tools") {
          window.dispatchEvent(new CustomEvent("dashboard:tools-home-requested"));
        }
        if (view === "automation") {
          void loadAutomationPresets();
          if (refreshMeta.automationTextSources === 0) {
            void refreshAutomationTextSources();
          }
        }
      });
    });
    document.querySelectorAll("[data-messenger]").forEach(button => {
      button.addEventListener("click", async event => {
        const nextMessenger = normalizeMessenger(event.currentTarget.getAttribute("data-messenger"));
        setSelectedMessenger(nextMessenger);
        try {
          await loadMessengerRuntimes();
          if (nextMessenger === "telegram") {
            await loadTelegramChats();
          }
          if (nextMessenger === "discord") {
            await refreshState();
          }
          setOutput("Switched dashboard to " + getMessengerDisplayName(nextMessenger) + ".");
        } catch (error) {
          setOutput(error.message || "Failed to switch messenger dashboard.");
        }
      });
    });
    bindClick("rail-about-button", () => {
      setRuntimeOverlayOpen(false);
      setSettingsOverlayOpen(false);
      setResourcesOverlayOpen(false);
      setSkillsOverlayOpen(false);
      setWorkflowSettingsOverlayOpen(false);
      setAboutOverlayOpen(true);
    });
    bindClick("rail-resources-button", () => {
      setRuntimeOverlayOpen(false);
      setSettingsOverlayOpen(false);
      setAboutOverlayOpen(false);
      setSkillsOverlayOpen(false);
      setWorkflowSettingsOverlayOpen(false);
      setResourcesOverlayOpen(true);
    });
    bindClick("rail-skills-button", () => {
      setRuntimeOverlayOpen(false);
      setSettingsOverlayOpen(false);
      setAboutOverlayOpen(false);
      setResourcesOverlayOpen(false);
      setWorkflowSettingsOverlayOpen(false);
      setSkillsOverlayOpen(true);
    });
    document.querySelectorAll("[data-workflow-global-action]").forEach(button => {
      button.addEventListener("click", event => {
        const action = String(event.currentTarget.getAttribute("data-workflow-global-action") || "").trim();
        if (action !== "image-pools") {
          return;
        }
        setRuntimeOverlayOpen(false);
        setSettingsOverlayOpen(false);
        setAboutOverlayOpen(false);
        setSkillsOverlayOpen(false);
        setWorkflowSettingsOverlayOpen(false);
        setResourcesOverlayOpen(true, { tab: "image-pools" });
      });
    });
    window.addEventListener("dashboard:open-resources-overlay", event => {
      const detail = event.detail || {};
      setRuntimeOverlayOpen(false);
      setSettingsOverlayOpen(false);
      setAboutOverlayOpen(false);
      setSkillsOverlayOpen(false);
      setWorkflowSettingsOverlayOpen(false);
      setResourcesOverlayOpen(true, detail);
    });
    window.addEventListener("dashboard:close-resources-overlay", () => {
      setResourcesOverlayOpen(false);
    });
    document.querySelectorAll("[data-resources-tab]").forEach(button => {
      button.addEventListener("click", event => {
        switchResourcesTab(event.currentTarget.getAttribute("data-resources-tab"));
      });
    });
    ["close-resources-overlay-button", "close-resources-overlay-footer-button"].forEach(id => {
      bindClick(id, () => {
        setResourcesOverlayOpen(false);
      });
    });
    document.getElementById("resources-overlay-backdrop")?.addEventListener("click", () => {
      setResourcesOverlayOpen(false);
    });
    bindClick("refresh-skills-button", () => {
      void refreshSkillsOverlay();
    });
    bindClick("new-skill-button", () => {
      startNewSkillEditor();
    });
    bindClick("save-skill-button", () => {
      void saveSkillFromEditor();
    });
    bindClick("reload-skill-button", () => {
      const idInput = document.getElementById("skill-editor-id");
      void loadSkillIntoEditor(idInput ? idInput.value : state.selectedSkillEditorId);
    });
    ["close-skills-overlay-button", "close-skills-overlay-footer-button"].forEach(id => {
      bindClick(id, () => {
        setSkillsOverlayOpen(false);
      });
    });
    document.getElementById("skills-overlay-backdrop")?.addEventListener("click", () => {
      setSkillsOverlayOpen(false);
    });
    document.querySelectorAll("[data-about-tab]").forEach(button => {
      button.addEventListener("click", event => {
        switchAboutTab(event.currentTarget.getAttribute("data-about-tab"));
      });
    });
    document.querySelectorAll("[data-settings-tab]").forEach(button => {
      button.addEventListener("click", event => {
        switchSettingsTab(event.currentTarget.getAttribute("data-settings-tab"));
      });
    });
    let networkDiagnostics = null;
    let shouldGenerateNetworkToken = false;
    const setNetworkStatus = message => {
      const node = document.getElementById("network-settings-status");
      if (node) node.textContent = message;
    };
    const updateNetworkConfigPreview = () => {
      const mode = document.getElementById("network-dashboard-mode")?.value || "local";
      const publicUrl = String(document.getElementById("network-dashboard-public-url")?.value || "").trim();
      const certificatePin = String(document.getElementById("network-companion-certificate-pin")?.value || "").trim();
      const token = String(document.getElementById("network-dashboard-token")?.value || "").trim();
      const allowedClients = String(document.getElementById("network-dashboard-allowed-clients")?.value || "").trim();
      const workerUrl = String(document.getElementById("network-worker-url")?.value || "").trim();
      const preview = document.getElementById("network-config-preview");
      if (!preview) return;
      const lines = mode === "internet"
        ? ["# Terminate HTTPS at your reverse proxy or managed host.", "DASHBOARD_BIND_HOST=0.0.0.0", `DASHBOARD_PUBLIC_BASE_URL=${publicUrl}`, "DASHBOARD_EXPOSE_API=true", `DASHBOARD_ACCESS_TOKEN=${token}`, `DASHBOARD_ALLOWED_CLIENTS=${allowedClients}`]
        : mode === "lan"
        ? ["DASHBOARD_BIND_HOST=0.0.0.0", `DASHBOARD_PUBLIC_BASE_URL=${publicUrl}`, `COMPANION_TLS_CERTIFICATE_SHA256=${certificatePin}`, "DASHBOARD_EXPOSE_API=true", `DASHBOARD_ACCESS_TOKEN=${token}`, `DASHBOARD_ALLOWED_CLIENTS=${allowedClients}`]
        : ["DASHBOARD_BIND_HOST=127.0.0.1", "DASHBOARD_EXPOSE_API=false"];
      if (workerUrl) lines.push(`REMOTE_WORKER_BASE_URL=${workerUrl}`);
      preview.textContent = lines.join("\n");
    };
    const renderNetworkDiagnostics = diagnostics => {
      networkDiagnostics = diagnostics;
      const mode = document.getElementById("network-dashboard-mode");
      const publicUrl = document.getElementById("network-dashboard-public-url");
      const certificatePin = document.getElementById("network-companion-certificate-pin");
      const allowedClients = document.getElementById("network-dashboard-allowed-clients");
      if (mode) mode.value = diagnostics.mode || "local";
      if (publicUrl) publicUrl.value = diagnostics.publicBaseUrl || "";
      if (certificatePin) certificatePin.value = diagnostics.certificateSha256 || "";
      if (allowedClients) allowedClients.value = Array.isArray(diagnostics.allowedClients) ? diagnostics.allowedClients.join(", ") : "";
      const token = document.getElementById("network-dashboard-token");
      if (token) token.placeholder = diagnostics.accessTokenConfigured ? "Keep the configured token" : "Generate a secure token";

      const addressSelect = document.getElementById("network-interface-select");
      if (addressSelect) {
        addressSelect.replaceChildren();
        const addresses = Array.isArray(diagnostics.addresses) ? diagnostics.addresses : [];
        if (!addresses.length) {
          addressSelect.add(new Option("No LAN IPv4 addresses detected", ""));
        } else {
          addresses.forEach(address => {
            const option = new Option(`${address.interfaceName}: ${address.address}`, address.recommendedUrl);
            option.dataset.allowedClients = address.recommendedAllowedClients || "";
            addressSelect.add(option);
          });
        }
      }
      const checks = document.getElementById("network-readiness-checks");
      if (checks) {
        checks.replaceChildren();
        (diagnostics.checks || []).forEach(check => {
          const row = document.createElement("div");
          row.className = "row settings-list-row";
          const icon = document.createElement("i");
          icon.className = `bi ${check.passed ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`;
          icon.setAttribute("aria-hidden", "true");
          const message = document.createElement("span");
          message.textContent = check.message;
          row.append(icon, message);
          checks.appendChild(row);
        });
      }
      const firewall = document.getElementById("network-firewall-preview");
      if (firewall) firewall.textContent = (diagnostics.firewallCommands || []).join("\n");
      setNetworkStatus(diagnostics.readyForAndroid
        ? "Ready for Android. Scan from the phone, then show a pairing code below."
        : "Android access is not ready yet. Use Recommended, then Save & Apply.");
      updateNetworkConfigPreview();
    };
    const loadNetworkDiagnostics = async () => {
      setNetworkStatus("Detecting this PC and checking the dashboard listener...");
      try {
        renderNetworkDiagnostics(await request("/api/settings/network"));
      } catch (error) {
        setNetworkStatus(describeClientError(error, "Could not inspect dashboard network settings."));
      }
    };
    const useSelectedNetworkAddress = () => {
      const addressSelect = document.getElementById("network-interface-select");
      const option = addressSelect?.selectedOptions?.[0];
      const url = option?.value || networkDiagnostics?.recommendedPublicUrl || "";
      const allowed = option?.dataset?.allowedClients || networkDiagnostics?.recommendedAllowedClients || "";
      const mode = document.getElementById("network-dashboard-mode");
      const publicUrl = document.getElementById("network-dashboard-public-url");
      const allowedClients = document.getElementById("network-dashboard-allowed-clients");
      if (mode) mode.value = "lan";
      if (publicUrl) publicUrl.value = url;
      if (allowedClients) allowedClients.value = allowed;
      updateNetworkConfigPreview();
      setNetworkStatus(url ? `Selected ${url}. Save & Apply to make it reachable.` : "No usable LAN address was detected.");
    };
    ["network-dashboard-mode", "network-dashboard-public-url", "network-companion-certificate-pin", "network-dashboard-token", "network-dashboard-allowed-clients", "network-worker-url"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", updateNetworkConfigPreview);
      document.getElementById(id)?.addEventListener("change", updateNetworkConfigPreview);
    });
    bindClick("network-copy-env-button", async () => {
      const text = document.getElementById("network-config-preview")?.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        setOutput("Copied the equivalent environment configuration.");
      } catch (error) {
        setOutput(describeClientError(error, "Could not copy network configuration."));
      }
    });
    bindClick("network-detect-button", loadNetworkDiagnostics);
    bindClick("network-use-recommended-button", useSelectedNetworkAddress);
    document.getElementById("network-interface-select")?.addEventListener("change", useSelectedNetworkAddress);
    bindClick("network-generate-token-button", () => {
      shouldGenerateNetworkToken = true;
      const token = document.getElementById("network-dashboard-token");
      if (token) {
        token.value = "";
        token.placeholder = "A secure token will be generated when saved";
      }
      setNetworkStatus("A new secure access token will be generated and stored in the operating-system credential store.");
    });
    bindClick("network-copy-token-button", async () => {
      try {
        let token = String(document.getElementById("network-dashboard-token")?.value || "").trim();
        if (!token) {
          const result = await request("/api/settings/network/access-token", {});
          token = String(result.accessToken || "").trim();
        }
        if (!token) throw new Error("No dashboard access token is configured.");
        await navigator.clipboard.writeText(token);
        setNetworkStatus("Copied the dashboard access token. Treat it like a password.");
      } catch (error) {
        setNetworkStatus(describeClientError(error, "Could not copy the dashboard access token."));
      }
    });
    let dashboardTokenQrObjectUrl = "";
    const hideDashboardTokenQr = () => {
      const qrNode = document.getElementById("network-dashboard-token-qr");
      const button = document.getElementById("network-show-token-qr-button");
      const image = qrNode?.querySelector("img");
      if (dashboardTokenQrObjectUrl) URL.revokeObjectURL(dashboardTokenQrObjectUrl);
      dashboardTokenQrObjectUrl = "";
      if (image) image.removeAttribute("src");
      if (qrNode) qrNode.hidden = true;
      if (button) {
        button.setAttribute("aria-expanded", "false");
        const label = button.querySelector("span");
        if (label) label.textContent = "Show Token QR";
      }
    };
    bindClick("network-show-token-qr-button", async () => {
      const qrNode = document.getElementById("network-dashboard-token-qr");
      const button = document.getElementById("network-show-token-qr-button");
      if (qrNode && !qrNode.hidden) {
        hideDashboardTokenQr();
        return;
      }
      try {
        const response = await fetch("/api/settings/network/access-token/qr.svg", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({
            accessToken: String(document.getElementById("network-dashboard-token")?.value || "").trim()
          })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `QR request failed (${response.status}).`);
        }
        hideDashboardTokenQr();
        dashboardTokenQrObjectUrl = URL.createObjectURL(await response.blob());
        const image = qrNode?.querySelector("img");
        if (image) image.src = dashboardTokenQrObjectUrl;
        if (qrNode) qrNode.hidden = false;
        if (button) {
          button.setAttribute("aria-expanded", "true");
          const label = button.querySelector("span");
          if (label) label.textContent = "Hide Token QR";
        }
        setNetworkStatus("Token QR shown. Hide it as soon as the receiving device has scanned it.");
      } catch (error) {
        hideDashboardTokenQr();
        setNetworkStatus(describeClientError(error, "Could not generate the dashboard access-token QR."));
      }
    });
    bindClick("network-register-urage-now-protocol-button", async () => {
      const button = document.getElementById("network-register-urage-now-protocol-button");
      if (button) button.disabled = true;
      try {
        const response = await fetch("/api/settings/urage-now/register-protocol", { method: "POST" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Could not enable URage NOW links.");
        setNetworkStatus(payload?.message || "URage NOW links are enabled for this Windows user.");
      } catch (error) {
        setNetworkStatus(describeClientError(error, "Could not enable URage NOW links."));
      } finally {
        if (button) button.disabled = false;
      }
    });
    bindClick("network-test-urage-now-protocol-button", async () => {
      try {
        const response = await fetch("/api/settings/urage-now/test-protocol", { method: "POST" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Could not test URage NOW links.");
        setNetworkStatus(payload?.message || "Opened a URage NOW protocol test.");
      } catch (error) {
        setNetworkStatus(describeClientError(error, "Could not test URage NOW links."));
      }
    });
    bindClick("network-save-apply-button", async () => {
      const button = document.getElementById("network-save-apply-button");
      const mode = document.getElementById("network-dashboard-mode")?.value || "local";
      if (button) button.disabled = true;
      setNetworkStatus("Saving and applying network settings...");
      try {
        const result = await request("/api/settings/network", {
          mode,
          publicBaseUrl: String(document.getElementById("network-dashboard-public-url")?.value || "").trim(),
          certificateSha256: String(document.getElementById("network-companion-certificate-pin")?.value || "").trim(),
          accessToken: String(document.getElementById("network-dashboard-token")?.value || "").trim(),
          generateAccessToken: shouldGenerateNetworkToken,
          allowedClients: String(document.getElementById("network-dashboard-allowed-clients")?.value || "")
            .split(",").map(value => value.trim()).filter(Boolean)
        });
        shouldGenerateNetworkToken = false;
        const token = document.getElementById("network-dashboard-token");
        if (token && result.generatedAccessToken) token.value = result.generatedAccessToken;
        setNetworkStatus(result.generatedAccessToken
          ? (mode === "internet" ? "Internet server access applied. The new token is shown above; store it securely." : "LAN access applied. The new token is shown above; use Copy Token, then enter it on the remote browser login page.")
          : "Network settings saved and applied. Use Copy Token if you entered a replacement token.");
        window.setTimeout(() => void loadNetworkDiagnostics(), 900);
      } catch (error) {
        setNetworkStatus(describeClientError(error, "Could not save dashboard network settings."));
      } finally {
        if (button) button.disabled = false;
      }
    });
    bindClick("network-copy-firewall-button", async () => {
      const text = document.getElementById("network-firewall-preview")?.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        setNetworkStatus("Copied the Private-network Windows Firewall commands.");
      } catch (error) {
        setNetworkStatus(describeClientError(error, "Could not copy firewall commands."));
      }
    });
    bindClick("network-companion-pairing-code-button", async () => {
      const codeNode = document.getElementById("network-companion-pairing-code");
      const expiryNode = document.getElementById("network-companion-pairing-expiry");
      const qrNode = document.getElementById("network-companion-pairing-qr");
      try {
        const [pairing, payload] = await Promise.all([
          request("/api/companion/pairing-code"),
          request("/api/companion/pairing-payload")
        ]);
        if (codeNode) codeNode.textContent = String(pairing.code || "").replace(/(\d{3})(\d{3})/, "$1 $2") || "Unavailable";
        if (expiryNode) expiryNode.textContent = pairing.expiresAt ? "Expires " + new Date(pairing.expiresAt).toLocaleTimeString() + "." : "";
        const image = qrNode?.querySelector("img");
        if (image) image.src = `/api/companion/pairing-qr.svg?expires=${encodeURIComponent(payload.expiresAt || Date.now())}`;
        if (qrNode) qrNode.hidden = false;
      } catch (error) {
        if (codeNode) codeNode.textContent = "Enable LAN API and restart";
        if (expiryNode) expiryNode.textContent = describeClientError(error, "Could not load a pairing code.");
      }
    });
    const companionPermissionDefinitions = [
      ["media.list", "Browse", "GET"],
      ["media.download", "Download", "GET"],
      ["media.upload", "Upload", "POST / PATCH"],
      ["media.metadata.update", "Metadata", "PATCH / PUT"],
      ["media.delete", "Delete", "DELETE"],
      ["tools.browse", "Browse Tools", "GET"],
      ["workflow.chat", "Chat Studio", "POST"],
      ["workflow.image.generate", "Image Studio", "POST"],
      ["workflow.audio.generate", "Audio Studio", "POST"],
      ["workflow.music.generate", "Music Studio", "POST"],
      ["workflow.video.generate", "Video Studio", "POST"],
      ["workflow.model3d.generate", "3D Studio", "POST"],
      ["application.3d-print.launch", "Open Bambu Studio", "POST"]
    ];
    const readPermissionInputs = selector => Object.fromEntries(
      Array.from(document.querySelectorAll(selector)).map(inputNode => [inputNode.dataset.companionDefaultPermission || inputNode.value, inputNode.checked])
    );
    const setAccessPolicyStatus = message => {
      const node = document.getElementById("network-access-policy-status");
      if (node) node.textContent = message;
    };
    const refreshCompanionDevices = async () => {
      const list = document.getElementById("network-companion-devices");
      if (list) list.textContent = "Loading paired devices and permissions...";
      setAccessPolicyStatus("Loading access policy...");
      try {
        const payload = await request("/api/companion/access-policy");
        const devices = Array.isArray(payload.devices) ? payload.devices : [];
        document.querySelectorAll("[data-companion-default-permission]").forEach(inputNode => {
          inputNode.checked = payload.defaults?.[inputNode.dataset.companionDefaultPermission] === true;
        });
        setAccessPolicyStatus("Default policy loaded.");
        if (!list) return;
        list.replaceChildren();
        if (!devices.length) {
          const empty = document.createElement("span");
          empty.className = "hint";
          empty.textContent = "No Android companion devices are paired.";
          list.appendChild(empty);
          return;
        }
        devices.forEach(device => {
          const row = document.createElement("div");
          row.className = "companion-device-policy";
          const head = document.createElement("div");
          head.className = "row";
          const copy = document.createElement("span");
          const name = document.createElement("strong");
          name.textContent = device.name || "Android companion";
          const seen = document.createElement("small");
          seen.textContent = "Last seen " + new Date(device.lastSeenAt || device.pairedAt).toLocaleString();
          copy.append(name, seen);
          head.appendChild(copy);
          const permissionGrid = document.createElement("div");
          permissionGrid.className = "network-permission-grid";
          companionPermissionDefinitions.forEach(([permission, label, method]) => {
            const control = document.createElement("label");
            const inputNode = document.createElement("input");
            inputNode.type = "checkbox";
            inputNode.value = permission;
            inputNode.checked = device.effectivePermissions?.[permission] === true;
            inputNode.dataset.devicePermission = device.id;
            const copyNode = document.createElement("span");
            const strong = document.createElement("strong");
            strong.textContent = label;
            const small = document.createElement("small");
            small.textContent = method;
            copyNode.append(strong, small);
            control.append(inputNode, copyNode);
            permissionGrid.appendChild(control);
          });
          const actions = document.createElement("div");
          actions.className = "row";
          const save = document.createElement("button");
          save.type = "button";
          save.className = "compact";
          save.innerHTML = '<i class="bi bi-shield-check" aria-hidden="true"></i><span>Save Permissions</span>';
          save.addEventListener("click", async () => {
            save.disabled = true;
            try {
              const permissions = readPermissionInputs(`[data-device-permission="${device.id}"]`);
              await request("/api/companion/access-policy/device", {deviceId: device.id, permissions});
              setAccessPolicyStatus(`Saved permissions for ${device.name || "Android companion"}.`);
            } catch (error) {
              setAccessPolicyStatus(describeClientError(error, "Could not save device permissions."));
            } finally {
              save.disabled = false;
            }
          });
          const inherit = document.createElement("button");
          inherit.type = "button";
          inherit.className = "secondary compact";
          inherit.innerHTML = '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>Use Defaults</span>';
          inherit.addEventListener("click", async () => {
            inherit.disabled = true;
            try {
              await request("/api/companion/access-policy/device", {deviceId: device.id, permissions: null});
              await refreshCompanionDevices();
            } catch (error) {
              setAccessPolicyStatus(describeClientError(error, "Could not restore inherited permissions."));
              inherit.disabled = false;
            }
          });
          const revoke = document.createElement("button");
          revoke.className = "danger compact";
          revoke.type = "button";
          revoke.innerHTML = '<i class="bi bi-x-circle" aria-hidden="true"></i><span>Revoke</span>';
          revoke.addEventListener("click", async () => {
            revoke.disabled = true;
            try {
              await request("/api/companion/devices/revoke", {deviceId: device.id});
              await refreshCompanionDevices();
            } catch (error) {
              setOutput(describeClientError(error, "Could not revoke the companion device."));
              revoke.disabled = false;
            }
          });
          actions.append(save, inherit, revoke);
          row.append(head, permissionGrid, actions);
          list.appendChild(row);
        });
      } catch (error) {
        list.textContent = describeClientError(error, "Could not load paired devices.");
      }
    };
    bindClick("network-companion-devices-refresh-button", refreshCompanionDevices);
    bindClick("network-refresh-access-policy-button", refreshCompanionDevices);
    bindClick("network-save-default-permissions-button", async () => {
      const button = document.getElementById("network-save-default-permissions-button");
      if (button) button.disabled = true;
      try {
        const permissions = readPermissionInputs("[data-companion-default-permission]");
        await request("/api/companion/access-policy/defaults", {permissions});
        setAccessPolicyStatus("Saved default permissions. Devices without an override inherit them immediately.");
        await refreshCompanionDevices();
      } catch (error) {
        setAccessPolicyStatus(describeClientError(error, "Could not save default permissions."));
      } finally {
        if (button) button.disabled = false;
      }
    });
    const refreshCompanionAccessAudit = async () => {
      const list = document.getElementById("network-companion-access-audit");
      if (!list) return;
      list.textContent = "Loading recent access decisions...";
      try {
        const payload = await request("/api/companion/access-audit?limit=200");
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        list.replaceChildren();
        if (!entries.length) {
          const empty = document.createElement("span");
          empty.className = "hint";
          empty.textContent = "No companion access has been recorded yet.";
          list.appendChild(empty);
          return;
        }
        entries.forEach(entry => {
          const row = document.createElement("div");
          row.className = "companion-audit-entry";
          const outcome = document.createElement("i");
          outcome.className = `bi ${entry.allowed ? "bi-check-circle" : "bi-x-circle"}`;
          outcome.setAttribute("aria-hidden", "true");
          const copy = document.createElement("span");
          const title = document.createElement("strong");
          title.textContent = `${entry.event || "access"} · ${entry.deviceName || entry.deviceId || "Dashboard"}`;
          const detail = document.createElement("small");
          detail.textContent = [entry.permission, entry.method, entry.path, entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""]
            .filter(Boolean).join(" · ");
          copy.append(title, detail);
          row.append(outcome, copy);
          list.appendChild(row);
        });
      } catch (error) {
        list.textContent = describeClientError(error, "Could not load the access audit.");
      }
    };
    bindClick("network-refresh-access-audit-button", refreshCompanionAccessAudit);
    bindClick("network-import-access-policy-button", () => {
      document.getElementById("network-import-access-policy-input")?.click();
    });
    document.getElementById("network-import-access-policy-input")?.addEventListener("change", async event => {
      const inputNode = event.currentTarget;
      const file = inputNode.files?.[0];
      if (!file) return;
      try {
        const policy = JSON.parse(await file.text());
        const result = await request("/api/companion/access-policy/import", {policy});
        setAccessPolicyStatus(`Imported policy. Updated ${result.updatedDevices || 0} known device override(s).`);
        await refreshCompanionDevices();
        await refreshCompanionAccessAudit();
      } catch (error) {
        setAccessPolicyStatus(describeClientError(error, "Could not import the access policy."));
      } finally {
        inputNode.value = "";
      }
    });
    updateNetworkConfigPreview();
    void loadNetworkDiagnostics();
    void refreshCompanionDevices();
    document.querySelectorAll("[data-settings-subtab]").forEach(button => {
      button.addEventListener("click", event => {
        switchSettingsSubtab(event.currentTarget.getAttribute("data-settings-subtab"));
      });
    });
    document.querySelectorAll("[data-network-settings-subtab]").forEach(button => {
      button.addEventListener("click", event => {
        switchNetworkSettingsSubtab(event.currentTarget.getAttribute("data-network-settings-subtab"));
      });
    });
    document.querySelectorAll("[data-theme-manager-group]").forEach(button => {
      button.addEventListener("click", event => {
        switchThemeManagerGroup(event.currentTarget.getAttribute("data-theme-manager-group"));
      });
    });
    [
      ["dashboard-border-radius-input", "radius"],
      ["dashboard-padding-input", "padding"],
      ["dashboard-margin-input", "margin"]
    ].forEach(([id, prop]) => {
      const inputNode = document.getElementById(id);
      if (inputNode) {
        inputNode.addEventListener("input", event => {
          updateDashboardAppearanceGlobal(prop, event.currentTarget.value);
          setAppearanceStatus(prop.charAt(0).toUpperCase() + prop.slice(1) + " updated.");
        });
      }
    });
    document.querySelectorAll("[data-appearance-component-input]").forEach(inputNode => {
      inputNode.addEventListener("input", event => {
        const component = event.currentTarget.getAttribute("data-appearance-component-input");
        const prop = event.currentTarget.getAttribute("data-appearance-component-prop");
        updateDashboardAppearanceComponent(component, prop, event.currentTarget.value);
        setAppearanceStatus(component + " " + prop + " updated.");
      });
    });
    bindClick("dashboard-border-radius-reset-button", () => {
      applyDashboardAppearance({ borderRadiusPx: 0, paddingPx: 0, marginPx: 0, components: {} });
      setAppearanceStatus("Appearance reset.");
    });
    bindClick("close-about-overlay-button", () => {
      setAboutOverlayOpen(false);
    });
    document.getElementById("about-overlay-backdrop")?.addEventListener("click", () => {
      setAboutOverlayOpen(false);
    });
    document.querySelectorAll("[data-workflow-settings-open]").forEach(button => {
      button.addEventListener("click", event => {
        setRuntimeOverlayOpen(false);
        setSettingsOverlayOpen(false);
        setAboutOverlayOpen(false);
        setResourcesOverlayOpen(false);
        setSkillsOverlayOpen(false);
        setWorkflowSettingsOverlayOpen(true, {
          panel: event.currentTarget.getAttribute("data-workflow-settings-open"),
          title: event.currentTarget.getAttribute("data-workflow-settings-title"),
          kicker: event.currentTarget.getAttribute("data-workflow-settings-kicker")
        });
      });
    });
    ["close-workflow-settings-overlay-button", "close-workflow-settings-overlay-footer-button"].forEach(id => {
      bindClick(id, () => {
        setWorkflowSettingsOverlayOpen(false);
      });
    });
    document.getElementById("workflow-settings-overlay-backdrop")?.addEventListener("click", () => {
      setWorkflowSettingsOverlayOpen(false);
    });
    bindClick("rail-settings-button", () => {
      input.applyQuickComfyPathSettingsToUi?.(state.globalSettings || {});
      input.applyQuickFfmpegSettingsToUi?.(state.globalSettings || {});
      applyDashboardAppearance(state.dashboardAppearance || {}, { persist: false });
      switchSettingsTab("setup");
      switchThemeManagerGroup("all");
      setRuntimeOverlayOpen(false);
      setAboutOverlayOpen(false);
      setResourcesOverlayOpen(false);
      setSkillsOverlayOpen(false);
      setWorkflowSettingsOverlayOpen(false);
      setSettingsOverlayOpen(true);
    });
    ["close-settings-overlay-button", "close-settings-overlay-footer-button"].forEach(id => {
      bindClick(id, () => {
        setSettingsOverlayOpen(false);
      });
    });
    document.getElementById("settings-overlay-backdrop")?.addEventListener("click", () => {
      setSettingsOverlayOpen(false);
    });
    bindClick("open-full-settings-view-button", () => {
      setSettingsOverlayOpen(false);
      switchView("ai");
    });
    bindClick("quick-save-comfy-path-settings-button", async () => {
      try {
        const payload = input.readQuickComfyPathSettingsFromUi?.() || {};
        const saved = await request("/api/settings", payload);
        input.applyGlobalSettingsToUi?.(saved);
        input.setComfyPathSettingsStatus?.("Saved Comfy endpoint + path settings.");
        input.setQuickComfyPathSettingsStatus?.("Saved workflow paths.");
        setOutput("Saved workflow paths.");
      } catch (error) {
        const detail = describeClientError(error, "Failed to save workflow paths.");
        input.setQuickComfyPathSettingsStatus?.("Failed to save workflow paths.");
        setOutput(detail);
      }
    });
    bindClick("quick-save-ffmpeg-settings-button", async () => {
      try {
        await input.saveQuickFfmpegSettingsFromUi?.();
        setOutput("Saved FFmpeg path.");
      } catch (error) {
        setOutput(describeClientError(error, "Failed to save FFmpeg path."));
      }
    });
    bindClick("quick-install-ffmpeg-button", () => {
      document.querySelector("[data-installer-review-button=\"true\"][data-installer-id=\"ffmpeg\"]")?.click();
    });
    const setComfyRuntimeStatus = runtime => {
      const node = document.getElementById("comfy-runtime-status");
      if (!node) return;
      node.textContent = runtime?.error || (runtime?.status === "running" ? `Running${runtime.pid ? ` · PID ${runtime.pid}` : ""}` : "Stopped") + (runtime?.launcherPath ? ` · ${runtime.launcherPath}` : " · choose a launcher batch.");
    };
    const setComfyRuntimeProgress = runtime => {
      const progress = document.getElementById("comfy-runtime-progress");
      const fill = document.getElementById("comfy-runtime-progress-fill");
      const label = document.getElementById("comfy-runtime-progress-label");
      const output = document.getElementById("comfy-runtime-output");
      if (!progress || !fill || !label || !output) return;
      const hasError = Boolean(runtime?.error);
      const running = runtime?.status === "running";
      progress.classList.toggle("is-running", running);
      progress.classList.toggle("has-error", hasError);
      fill.style.width = hasError ? "100%" : running ? "78%" : "0%";
      label.textContent = hasError ? "Launcher error" : running ? `ComfyUI is running${runtime?.pid ? ` (PID ${runtime.pid})` : ""}. Live launcher output:` : "Waiting to start.";
      const lines = Array.isArray(runtime?.output) ? runtime.output.slice(-80) : [];
      output.textContent = lines.length > 0 ? lines.join("\n") : "No ComfyUI output yet.";
      output.scrollTop = output.scrollHeight;
    };
    const loadComfyRuntime = async (syncFields = true) => {
      const runtime = await request("/api/comfyui/runtime");
      if (syncFields) {
        document.getElementById("comfy-runtime-root-input").value = runtime.workingDirectory || "";
        document.getElementById("comfy-runtime-launcher-input").value = runtime.launcherPath || "";
      }
      setComfyRuntimeStatus(runtime);
      setComfyRuntimeProgress(runtime);
      return runtime;
    };
    bindClick("comfy-runtime-refresh-button", () => void loadComfyRuntime().catch(error => setComfyRuntimeStatus({error: describeClientError(error, "Failed to read ComfyUI runtime.")})));
    bindClick("comfy-runtime-save-button", () => void request("/api/comfyui/runtime", {workingDirectory: document.getElementById("comfy-runtime-root-input").value.trim(), launcherPath: document.getElementById("comfy-runtime-launcher-input").value.trim()}).then(runtime => { setComfyRuntimeStatus(runtime); setOutput("Saved ComfyUI runtime."); }).catch(error => setComfyRuntimeStatus({error: describeClientError(error, "Failed to save ComfyUI runtime.")})));
    bindClick("comfy-runtime-browse-folder-button", () => void request("/api/comfyui/runtime/browse-folder", {}).then(result => { if (!result.canceled) document.getElementById("comfy-runtime-root-input").value = result.workingDirectory || ""; }).catch(error => setComfyRuntimeStatus({error: describeClientError(error, "Failed to browse for a ComfyUI folder.")})));
    bindClick("comfy-runtime-browse-launcher-button", () => void request("/api/comfyui/runtime/browse-launcher", {}).then(result => { if (!result.canceled) document.getElementById("comfy-runtime-launcher-input").value = result.launcherPath || ""; }).catch(error => setComfyRuntimeStatus({error: describeClientError(error, "Failed to browse for a ComfyUI launcher.")})));
    bindClick("comfy-runtime-create-launchers-button", () => void request("/api/comfyui/runtime/create-launchers", {rootPath: document.getElementById("comfy-runtime-root-input").value.trim()}).then(result => { document.getElementById("comfy-runtime-launcher-input").value = result.selectedLauncherPath; setComfyRuntimeStatus({status: "stopped", launcherPath: result.selectedLauncherPath}); setOutput(`Created ${result.files.length} URage ComfyUI launcher batches.`); }).catch(error => setComfyRuntimeStatus({error: describeClientError(error, "Failed to create launchers.")})));
    bindClick("comfy-runtime-start-button", () => void request("/api/comfyui/runtime/start", {}).then(runtime => { setComfyRuntimeStatus(runtime); setOutput("Started ComfyUI."); }).catch(error => setComfyRuntimeStatus({error: describeClientError(error, "Failed to start ComfyUI.")})));
    bindClick("comfy-runtime-stop-button", () => void request("/api/comfyui/runtime/stop", {}).then(runtime => { setComfyRuntimeStatus(runtime); setOutput("Stopped ComfyUI."); }).catch(error => setComfyRuntimeStatus({error: describeClientError(error, "Failed to stop ComfyUI.")})));
    void loadComfyRuntime().catch(() => {});
    window.setInterval(() => void loadComfyRuntime(false).catch(() => {}), 1500);
    bindClick("quick-reload-comfy-path-settings-button", async () => {
      try {
        await input.loadGlobalSettingsFromState?.();
        input.setQuickComfyPathSettingsStatus?.("Reloaded saved workflow paths.");
        setOutput("Reloaded saved workflow paths.");
      } catch (error) {
        const detail = describeClientError(error, "Failed to reload workflow paths.");
        input.setQuickComfyPathSettingsStatus?.("Failed to reload workflow paths.");
        setOutput(detail);
      }
    });
    const installerDetails = {
      python: {label: "Python 3.12", description: "Installs the required Python runtime for ComfyUI and its Hunyuan 3D extensions. Install this before ComfyUI."},
      ollama: {label: "Ollama", description: "Installs the local model runtime used for text and vision models."},
      lmstudio: {label: "LM Studio", description: "Installs the local model server and desktop model manager."},
      comfyui: {label: "ComfyUI", description: "Creates a Python environment, clones ComfyUI and the configured Hunyuan 3D extensions. This can download several GB."},
      blender: {label: "Blender", description: "Installs Blender for model previews, conversion, and automation scripts."},
      ffmpeg: {label: "FFmpeg", description: "Installs media conversion tools used by Audio, Video, and image processing workflows."}
    };
    let selectedInstallerId = "";
    const reviewCard = document.getElementById("installer-review-card");
    const reviewTitle = document.getElementById("installer-review-title");
    const reviewDescription = document.getElementById("installer-review-description");
    const locationMode = document.getElementById("installer-location-mode-select");
    const customPathField = document.getElementById("installer-custom-path-field");
    const customPathInput = document.getElementById("installer-custom-path-input");
    const executionModeField = document.getElementById("installer-execution-mode-field");
    const executionModeSelect = document.getElementById("installer-execution-mode-select");
    const runAsUserField = document.getElementById("installer-run-as-user-field");
    const runAsUserInput = document.getElementById("installer-run-as-user-input");
    const refreshComfyInstallerLog = async () => {
      const output = document.getElementById("comfy-installer-log-output");
      if (!output) return;
      const payload = await request("/api/installers/comfyui/log");
      output.textContent = String(payload.output || "No ComfyUI installer log yet.");
      output.scrollTop = output.scrollHeight;
    };
    bindClick("comfy-installer-log-refresh-button", () => void refreshComfyInstallerLog().catch(error => setOutput(describeClientError(error, "Failed to load the ComfyUI installer log."))));
    void refreshComfyInstallerLog().catch(() => {});
    window.setInterval(() => void refreshComfyInstallerLog().catch(() => {}), 1_500);
    const updateInstallerLocationUi = () => {
      const usesCustomPath = locationMode?.value === "custom";
      customPathField?.classList.toggle("hidden", !usesCustomPath);
      if (usesCustomPath) customPathInput?.focus();
    };
    locationMode?.addEventListener("change", updateInstallerLocationUi);
    const updateInstallerExecutionUi = () => {
      const supportsAlternateLaunch = selectedInstallerId === "python" || selectedInstallerId === "comfyui";
      executionModeField?.classList.toggle("hidden", !supportsAlternateLaunch);
      if (!supportsAlternateLaunch && executionModeSelect) executionModeSelect.value = "standard";
      const usesOtherUser = supportsAlternateLaunch && executionModeSelect?.value === "other-user";
      runAsUserField?.classList.toggle("hidden", !usesOtherUser);
      if (usesOtherUser) runAsUserInput?.focus();
    };
    executionModeSelect?.addEventListener("change", updateInstallerExecutionUi);
    document.querySelectorAll("[data-installer-review-button=\"true\"]").forEach(button => {
      button.addEventListener("click", event => {
        const installerId = String(event.currentTarget.getAttribute("data-installer-id") || "").trim().toLowerCase();
        const detail = installerDetails[installerId];
        if (!detail) return;
        selectedInstallerId = installerId;
        if (reviewTitle) reviewTitle.textContent = `Install ${detail.label}`;
        if (reviewDescription) reviewDescription.textContent = `${detail.description} Default is recommended. A custom path is passed to the installer when it supports one.`;
        if (locationMode) locationMode.value = "default";
        if (customPathInput) customPathInput.value = "";
        if (executionModeSelect) executionModeSelect.value = "standard";
        if (runAsUserInput) runAsUserInput.value = "";
        reviewCard?.classList.remove("hidden");
        updateInstallerLocationUi();
        updateInstallerExecutionUi();
        reviewCard?.scrollIntoView({block: "nearest", behavior: "smooth"});
      });
    });
    bindClick("installer-cancel-button", () => {
      selectedInstallerId = "";
      reviewCard?.classList.add("hidden");
    });
    bindClick("installer-confirm-button", async () => {
      if (!selectedInstallerId) return;
      const installPath = locationMode?.value === "custom" ? String(customPathInput?.value || "").trim() : "";
      const executionMode = selectedInstallerId === "python" || selectedInstallerId === "comfyui" ? String(executionModeSelect?.value || "standard") : "standard";
      const runAsUser = executionMode === "other-user" ? String(runAsUserInput?.value || "").trim() : "";
      if (locationMode?.value === "custom" && !installPath) {
        setOutput("Enter an absolute installation folder or choose the default location.");
        customPathInput?.focus();
        return;
      }
      if (executionMode === "other-user" && !runAsUser) {
        setOutput("Enter the Windows account to use.");
        runAsUserInput?.focus();
        return;
      }
      await input.runInstallerFromUi?.(selectedInstallerId, installPath, executionMode, runAsUser);
      if (selectedInstallerId === "comfyui") {
        void refreshComfyInstallerLog().catch(() => {});
      }
    });
    bindClick("open-runtime-overlay-button", () => {
      setSettingsOverlayOpen(false);
      setResourcesOverlayOpen(false);
      setSkillsOverlayOpen(false);
      setWorkflowSettingsOverlayOpen(false);
      setRuntimeOverlayOpen(true);
      updateMessengerRuntimeLaunchUi();
      void input.loadRuntimeReadiness?.();
    });
    bindClick("close-runtime-overlay-button", () => {
      setRuntimeOverlayOpen(false);
    });
    document.getElementById("runtime-overlay-backdrop")?.addEventListener("click", () => {
      setRuntimeOverlayOpen(false);
    });
    document.getElementById("messenger-runtime-credential-source")?.addEventListener("change", () => {
      updateMessengerRuntimeLaunchUi();
    });
    bindClick("messenger-runtime-refresh-readiness-button", () => {
      void input.loadRuntimeReadiness?.();
    });
    bindClick("messenger-runtime-save-shared-path-button", async () => {
      try {
        await saveMessengerRuntimeSettingsFromUi();
        updateMessengerRuntimeLaunchUi();
        setOutput("Saved messenger runtime settings. Autostart changes apply on the next dashboard launch.");
      } catch (error) {
        setOutput(describeClientError(error, "Failed to save messenger safe env file path."));
      }
    });
    bindClick("settings-save-discord-runtime-autostart", async () => {
      try {
        await input.saveDiscordRuntimeAutostartFromSettings?.();
        updateMessengerRuntimeLaunchUi();
        setOutput("Saved Discord startup preference. It applies on the next dashboard launch.");
      } catch (error) {
        setOutput(describeClientError(error, "Failed to save Discord startup preference."));
      }
    });
    bindClick("settings-open-runtime-control", () => {
      setSettingsOverlayOpen(false);
      setRuntimeOverlayOpen(true);
      updateMessengerRuntimeLaunchUi();
      void input.loadRuntimeReadiness?.();
    });
    bindClick("messenger-runtime-start-button", async () => {
      try {
        await runSelectedMessengerRuntimeAction("start");
      } catch (error) {
        setOutput(error.message || "Failed to start messenger runtime.");
      }
    });
    bindClick("messenger-runtime-stop-button", async () => {
      try {
        await runSelectedMessengerRuntimeAction("stop");
        if (state.selectedMessenger === "discord") {
          await refreshState();
        }
      } catch (error) {
        setOutput(error.message || "Failed to stop messenger runtime.");
      }
    });
    bindClick("messenger-runtime-restart-button", async () => {
      try {
        await runSelectedMessengerRuntimeAction("restart");
        if (state.selectedMessenger === "discord") {
          await refreshState();
        }
      } catch (error) {
        setOutput(error.message || "Failed to restart messenger runtime.");
      }
    });
    bindClick("messenger-dashboard-runtime-button", () => {
      setRuntimeOverlayOpen(true);
      updateMessengerRuntimeLaunchUi();
      void input.loadRuntimeReadiness?.();
    });
    bindClick("messenger-dashboard-quick-runtime-button", async () => {
      try {
        const action = state.messengerRuntimes?.find(entry => entry?.messenger === state.selectedMessenger)?.status === "running"
          ? "restart"
          : "start";
        await runSelectedMessengerRuntimeAction(action);
        renderMessengerDashboardView();
      } catch (error) {
        setOutput(describeClientError(error, "Failed to start the selected messenger runtime."));
      }
    });
    ["telegram-refresh-chats-button", "messenger-sidebar-refresh-chats-button"].forEach(id => {
      bindClick(id, async () => {
        try {
          await loadTelegramChats();
          setOutput("Telegram chats refreshed.");
        } catch (error) {
          setOutput(error.message || "Failed to refresh Telegram chats.");
        }
      });
    });
    bindClick("detail-messenger-refresh-button", async () => {
      try {
        await refreshMessengerDataFromUi();
        setOutput(getMessengerDisplayName(state.selectedMessenger) + " runtime and chat data refreshed.");
      } catch (error) {
        setOutput(error.message || "Failed to refresh messenger data.");
      }
    });
    bindClick("telegram-send-message-button", async () => {
      try {
        await sendTelegramMessageFromUi();
        setOutput("Telegram message sent.");
      } catch (error) {
        setOutput(error.message || "Failed to send Telegram message.");
      }
    });
    const refreshMatrixActivity = async () => {
      const [healthPayload, eventsPayload] = await Promise.all([
        request("/api/matrix/health"),
        request("/api/matrix/events")
      ]);
      const healthChip = document.getElementById("matrix-runtime-health-chip");
      if (healthChip) {
        const configured = healthPayload?.configured === true;
        const botUserId = String(healthPayload?.botUserId || "").trim();
        healthChip.textContent = configured
          ? (botUserId ? "Configured as " + botUserId : "Configured; waiting for bot identity")
          : "Matrix runtime is not configured";
      }
      const list = document.getElementById("matrix-activity-list");
      if (!list) return;
      const events = Array.isArray(eventsPayload?.events) ? eventsPayload.events.slice(0, 24) : [];
      list.replaceChildren();
      if (!events.length) {
        const empty = document.createElement("div");
        empty.className = "hint";
        empty.textContent = "No Matrix runtime activity yet.";
        list.appendChild(empty);
        return;
      }
      events.forEach(entry => {
        const row = document.createElement("div");
        row.className = "channel-row messenger-activity-row";
        const message = document.createElement("strong");
        message.textContent = String(entry?.message || "Matrix event");
        const meta = document.createElement("small");
        meta.textContent = [String(entry?.level || "info").toUpperCase(), entry?.createdAt ? new Date(entry.createdAt).toLocaleString() : ""]
          .filter(Boolean).join(" · ");
        row.append(message, meta);
        list.appendChild(row);
      });
    };
    let matrixWorkflowPermissions = {};
    const renderMatrixWorkflowPermissions = () => {
      const roomInput = document.getElementById("matrix-workflow-room-id");
      const roomId = String(roomInput?.value || state.selectedMatrixRoomId || "").trim();
      const rule = matrixWorkflowPermissions[roomId] && typeof matrixWorkflowPermissions[roomId] === "object" ? matrixWorkflowPermissions[roomId] : {};
      const workflows = Array.isArray(rule.workflows) ? rule.workflows : [];
      document.querySelectorAll("#matrix-workflow-permission-actions input[type=checkbox]").forEach(input => {
        input.checked = workflows.includes(input.value);
      });
      const allowAllMembers = document.getElementById("matrix-workflow-allow-all-members");
      if (allowAllMembers) allowAllMembers.checked = rule.allowAllMembers === true;
      const summary = document.getElementById("matrix-workflow-permission-summary");
      if (summary) summary.textContent = roomId
        ? (workflows.length ? (rule.allowAllMembers === true ? "Allowed: " : "Draft only: ") + workflows.join(", ") : "No room rule: legacy allowlist applies.")
        : "Select a room to configure.";
    };
    const loadMatrixWorkflowPermissions = async () => {
      const payload = await request("/api/matrix/workflow-permissions");
      matrixWorkflowPermissions = payload?.rooms && typeof payload.rooms === "object" ? payload.rooms : {};
      renderMatrixWorkflowPermissions();
    };
    bindClick("matrix-refresh-rooms-button", async () => {
      try {
        const payload = await request("/api/matrix/rooms/refresh", { method: "POST" });
        state.matrixRooms = Array.isArray(payload.rooms) ? payload.rooms : [];
        window.dispatchEvent(new CustomEvent("dashboard:matrix-rooms-refreshed", { detail: { rooms: state.matrixRooms } }));
        const selectedRoom = state.matrixRooms.find(room => String(room?.roomId || room?.id || "").trim() === String(state.selectedMatrixRoomId || "").trim());
        const chip = document.getElementById("matrix-selected-room-chip");
        if (chip) chip.textContent = selectedRoom ? "Selected: " + String(selectedRoom.title || selectedRoom.name || state.selectedMatrixRoomId) : (state.selectedMatrixRoomId ? "Selected room: " + state.selectedMatrixRoomId : "No Matrix room selected");
        renderMessengerDashboardView();
        await refreshMatrixActivity();
        setOutput("Matrix rooms refreshed.");
      } catch (error) {
        setOutput(error.message || "Failed to refresh Matrix rooms.");
      }
    });
    bindClick("matrix-refresh-activity-button", async () => {
      try {
        await refreshMatrixActivity();
        setOutput("Matrix runtime activity refreshed.");
      } catch (error) {
        setOutput(error.message || "Failed to refresh Matrix runtime activity.");
      }
    });
    bindClick("matrix-load-workflow-permissions-button", async () => {
      try {
        await loadMatrixWorkflowPermissions();
        setOutput("Matrix room workflow permissions loaded.");
      } catch (error) {
        setOutput(error.message || "Failed to load Matrix workflow permissions.");
      }
    });
    bindClick("matrix-save-workflow-permissions-button", async () => {
      try {
        const roomInput = document.getElementById("matrix-workflow-room-id");
        const roomId = String(roomInput?.value || state.selectedMatrixRoomId || "").trim();
        if (!roomId) throw new Error("Select or enter a Matrix room ID first.");
        const workflows = Array.from(document.querySelectorAll("#matrix-workflow-permission-actions input[type=checkbox]:checked"))
          .map(input => input.value);
        const allowAllMembers = document.getElementById("matrix-workflow-allow-all-members")?.checked === true;
        const payload = await request("/api/matrix/workflow-permissions", { method: "POST", roomId, workflows, allowAllMembers });
        matrixWorkflowPermissions = payload?.rooms && typeof payload.rooms === "object" ? payload.rooms : {};
        state.selectedMatrixRoomId = roomId;
        renderMatrixWorkflowPermissions();
        setOutput(workflows.length ? (allowAllMembers ? "Matrix workflow permissions saved." : "Saved as a disabled draft; enable member access to activate it.") : "Matrix room rule removed; legacy allowlist applies.");
      } catch (error) {
        setOutput(error.message || "Failed to save Matrix workflow permissions.");
      }
    });
    bindClick("matrix-send-message-button", async () => {
      try {
        const roomInput = document.getElementById("matrix-room-id-input");
        const messageInput = document.getElementById("matrix-message-text");
        const roomId = String(roomInput?.value || state.selectedMatrixRoomId || "").trim();
        const text = String(messageInput?.value || "").trim();
        if (!roomId) throw new Error("Matrix room ID is required.");
        if (!text) throw new Error("Matrix message text is required.");
        await request("/api/matrix/send-message", { roomId, text });
        state.selectedMatrixRoomId = roomId;
        if (messageInput && typeof messageInput.value === "string") messageInput.value = "";
        document.getElementById("matrix-refresh-rooms-button")?.click();
        setOutput("Matrix message sent.");
      } catch (error) {
        setOutput(error.message || "Failed to send Matrix message.");
      }
    });
    bindClick("whatsapp-send-message-button", async () => {
      try {
        await sendWhatsAppMessageFromUi();
        setOutput("WhatsApp message sent.");
      } catch (error) {
        setOutput(error.message || "Failed to send WhatsApp message.");
      }
    });
    document.getElementById("telegram-chat-id-input")?.addEventListener("input", event => {
      setSelectedTelegramChatId(event.currentTarget.value);
      renderTelegramChats();
    });
    document.getElementById("telegram-message-text")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        document.getElementById("telegram-send-message-button")?.click();
      }
    });
    document.getElementById("matrix-room-id-input")?.addEventListener("input", event => {
      state.selectedMatrixRoomId = String(event.currentTarget.value || "").trim();
      const chip = document.getElementById("matrix-selected-room-chip");
      if (chip) chip.textContent = state.selectedMatrixRoomId ? "Selected room: " + state.selectedMatrixRoomId : "No Matrix room selected";
    });
    document.getElementById("matrix-workflow-room-id")?.addEventListener("input", renderMatrixWorkflowPermissions);
    document.getElementById("matrix-message-text")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        document.getElementById("matrix-send-message-button")?.click();
      }
    });
    window.addEventListener("dashboard:matrix-room-selected", () => {
      renderMessengerDashboardView();
    });
    document.getElementById("whatsapp-message-text")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        document.getElementById("whatsapp-send-message-button")?.click();
      }
    });
    bindClick("messaging-new-chat-button", () => {
      ["channel-message", "llm-prompt", "bot-message-edit-text", "dm-message"].forEach(id => {
        const node = document.getElementById(id);
        if (node && typeof node.value === "string") {
          node.value = "";
        }
      });
      renderMarkdownInto("main-output", "Ready.", "Ready.");
      setOutput("Started a new Discord chat draft.");
    });
    bindClick("messenger-new-chat-button", () => {
      const selectedTelegramChatId = normalizeTelegramChatId(state.selectedTelegramChatId);
      const chatIdInput = document.getElementById("telegram-chat-id-input");
      if (chatIdInput && typeof chatIdInput.value === "string") {
        chatIdInput.value = selectedTelegramChatId;
      }
      const messageInput = document.getElementById("telegram-message-text");
      if (messageInput && typeof messageInput.value === "string") {
        messageInput.value = "";
      }
      const whatsappMessageInput = document.getElementById("whatsapp-message-text");
      if (whatsappMessageInput && typeof whatsappMessageInput.value === "string") {
        whatsappMessageInput.value = "";
      }
      setOutput("Started a new " + getMessengerDisplayName(state.selectedMessenger) + " message draft.");
    });
    bindClick("messenger-dashboard-send-message-button", () => {
      switchView(state.selectedMessenger === "discord" ? "messaging" : "messenger");
    });
    bindClick("messenger-dashboard-open-browser-button", () => {
      const url = getMessengerBrowserUrl();
      window.open(url, "_blank", "noopener,noreferrer");
      setOutput("Opened " + getMessengerDisplayName(state.selectedMessenger) + " in browser.");
    });
    bindClick("messenger-dashboard-refresh-guilds-button", async () => {
      try {
        if (state.selectedMessenger !== "discord") {
          return void setOutput("Guild refresh is only available in Discord mode.");
        }
        await loadGuilds();
        updateSelectionDetails();
        renderGuildPermissions();
        renderChannelPermissions();
        renderMessengerDashboardView();
        setOutput("Discord guild cache refreshed.");
      } catch (error) {
        setOutput(error.message || "Failed to refresh guild cache.");
      }
    });
    bindClick("messenger-dashboard-load-channels-button", async () => {
      try {
        if (state.selectedMessenger !== "discord") {
          return void setOutput("Channel loading is only available in Discord mode.");
        }
        await loadDashboardDiscordChannels();
        setOutput("Loaded cached Discord channels for the selected guild.");
      } catch (error) {
        setOutput(error.message || "Failed to load cached Discord channels.");
      }
    });
    bindClick("messenger-dashboard-load-messages-button", async () => {
      try {
        if (state.selectedMessenger !== "discord") {
          return void setOutput("Message loading is only available in Discord mode.");
        }
        await loadDashboardDiscordMessages();
        setOutput("Loaded cached bot messages for the selected channel.");
      } catch (error) {
        setOutput(error.message || "Failed to load cached bot messages.");
      }
    });
    bindClick("messenger-dashboard-view-bot-button", () => {
      switchView("profile");
    });
    bindClick("messenger-dashboard-view-server-button", () => {
      switchView(state.selectedMessenger === "discord" ? "guild" : "messenger");
    });
    const askNewChatButton = document.getElementById("ask-new-chat-button");
    const legacyAskOutput = document.getElementById("ask-output");
    if (askNewChatButton && legacyAskOutput) {
      askNewChatButton.addEventListener("click", () => {
        const askPrompt = document.getElementById("ask-prompt");
        if (askPrompt && typeof askPrompt.value === "string") {
          askPrompt.value = "";
        }
        const askUserPreview = document.getElementById("ask-user-preview");
        if (askUserPreview) {
          askUserPreview.textContent = "";
        }
        renderMarkdownInto("ask-output", "", "No LazyDev reply yet.");
        document.getElementById("ask-user-bubble")?.classList.add("hidden");
        document.getElementById("ask-assistant-bubble")?.classList.add("hidden");
        document.getElementById("ask-output-actions")?.classList.add("hidden");
        const thinkFoldout = document.getElementById("ask-think-foldout");
        if (thinkFoldout) {
          thinkFoldout.classList.add("hidden");
          thinkFoldout.open = false;
        }
        const thinkOutput = document.getElementById("ask-think-output");
        if (thinkOutput) {
          thinkOutput.textContent = "No reasoning trace yet.";
        }
        clearAiImages();
        clearAskSkillModelUploads();
        clearAskFileUploads();
        setOutput("Started a new Ask LazyDev chat.");
      });
    }
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") {
        return;
      }
      const settingsOverlay = document.getElementById("settings-overlay");
      if (settingsOverlay && !settingsOverlay.classList.contains("hidden")) {
        setSettingsOverlayOpen(false);
        return;
      }
      const resourcesOverlay = document.getElementById("resources-overlay");
      if (resourcesOverlay && !resourcesOverlay.classList.contains("hidden")) {
        setResourcesOverlayOpen(false);
        return;
      }
      const skillsOverlay = document.getElementById("skills-overlay");
      if (skillsOverlay && !skillsOverlay.classList.contains("hidden")) {
        setSkillsOverlayOpen(false);
        return;
      }
      const aboutOverlay = document.getElementById("about-overlay");
      if (aboutOverlay && !aboutOverlay.classList.contains("hidden")) {
        setAboutOverlayOpen(false);
        return;
      }
      const workflowSettingsOverlay = document.getElementById("workflow-settings-overlay");
      if (workflowSettingsOverlay && !workflowSettingsOverlay.classList.contains("hidden")) {
        setWorkflowSettingsOverlayOpen(false);
        return;
      }
      const runtimeOverlay = document.getElementById("runtime-overlay");
      if (runtimeOverlay && !runtimeOverlay.classList.contains("hidden")) {
        setRuntimeOverlayOpen(false);
      }
    });
    document.querySelectorAll("[data-ai-scroll-target]").forEach(button => {
      button.addEventListener("click", event => {
        openAiScrollTarget(event.currentTarget.getAttribute("data-ai-scroll-target"));
      });
    });
    document.querySelectorAll("[data-ai-open-messenger]").forEach(button => {
      button.addEventListener("click", async event => {
        const nextMessenger = normalizeMessenger(event.currentTarget.getAttribute("data-ai-open-messenger"));
        const defaultView = nextMessenger === "discord" ? "dashboard" : "messenger";
        setSelectedMessenger(nextMessenger);
        switchView(defaultView);
        try {
          await loadMessengerRuntimes();
          if (nextMessenger === "telegram") {
            await loadTelegramChats();
          }
          if (nextMessenger === "discord") {
            await refreshState();
          }
        } catch {}
        setOutput("Opened " + getMessengerDisplayName(nextMessenger) + " workspace.");
      });
    });
    document.querySelectorAll("[data-dashboard-theme-button]").forEach(button => {
      button.addEventListener("click", event => {
        const nextTheme = event.currentTarget.getAttribute("data-dashboard-theme-button");
        setDashboardTheme(nextTheme);
        refreshActiveArtToolImagePoolBridge();
        setOutput("Studio theme set to " + getDashboardThemeLabel(nextTheme) + ".");
      });
    });
    document.querySelectorAll("[data-dashboard-theme-cycle]").forEach(button => {
      button.addEventListener("click", () => {
        const nextTheme = getNextDashboardTheme(state.dashboardTheme);
        setDashboardTheme(nextTheme);
        refreshActiveArtToolImagePoolBridge();
        setOutput("Studio theme set to " + getDashboardThemeLabel(nextTheme) + ".");
      });
    });
    bindClick("rail-workflow-expand-button", event => {
      event.preventDefault();
      const nextExpanded = !(state.studioRailExpanded === true);
      setStudioRailExpanded(nextExpanded);
      setOutput(nextExpanded ? "Expanded Studio workflow rail." : "Collapsed Studio workflow rail.");
    });
    document.querySelectorAll("[data-workflow-sidebar-toggle]").forEach(button => {
      button.addEventListener("click", event => {
        const target = String(event.currentTarget.getAttribute("data-workflow-sidebar-toggle") || "").trim();
        if (!workflowRightSidebarTargets.includes(target)) {
          return;
        }
        const nextCollapsed = !(state.workflowRightSidebarCollapsed && state.workflowRightSidebarCollapsed[target] === true);
        setWorkflowRightSidebarCollapsed(target, nextCollapsed);
      });
    });
    bindClick("studio-workflow-sidebar-mode-button", event => {
      event.preventDefault();
      const nextMode = state.aiWorkflowSidebarMode === "sticky" ? "floaty" : "sticky";
      state.aiWorkflowSidebarMode = nextMode;
      try {
        window.localStorage.setItem(workflowSidebarModeStorageKey, nextMode);
      } catch {}
      setWorkflowSidebarMode(nextMode);
      updateStudioWorkflowSidebar();
      setOutput(nextMode === "sticky" ? "Pinned workflow sidebar." : "Workflow sidebar will float and auto-hide.");
    });
    document.addEventListener("pointerdown", event => {
      if (state.aiWorkflowSidebarMode === "sticky" || state.aiWorkflowSidebarVisible !== true) {
        return;
      }
      const sidebar = document.querySelector(".studio-workflow-sidebar");
      const modeButton = document.getElementById("studio-workflow-sidebar-mode-button");
      const collapseButton = document.getElementById("studio-workflow-sidebar-collapse-button");
      const target = event.target;
      if (sidebar?.contains(target) || modeButton?.contains(target) || collapseButton?.contains(target)) {
        return;
      }
      state.aiWorkflowSidebarVisible = false;
      updateStudioWorkflowSidebar();
    }, true);
    document.querySelectorAll("[data-prompt-preset-target][data-prompt-preset-value]").forEach(button => {
      button.addEventListener("click", event => {
        const targetId = String(event.currentTarget.getAttribute("data-prompt-preset-target") || "").trim();
        const presetValue = String(event.currentTarget.getAttribute("data-prompt-preset-value") || "").trim();
        applyPromptPreset(targetId, presetValue);
      });
    });
    document.querySelectorAll("[data-field-preset-values]").forEach(button => {
      button.addEventListener("click", event => {
        const source = String(event.currentTarget.getAttribute("data-field-preset-values") || "").trim();
        const label = String(event.currentTarget.getAttribute("data-field-preset-label") || "Preset").trim();
        applyFieldPreset(source, label);
      });
    });
    document.querySelectorAll("[data-restart-dashboard=\"true\"]").forEach(button => {
      button.addEventListener("click", () => {
        void restartDashboard();
      });
    });
    bindClick("ai-clear-focus-button", showAllStudioCards);
    bindClick("studio-workflow-sidebar-overview-button", showAllStudioCards);
    bindClick("studio-workflow-sidebar-collapse-button", () => {
      state.aiWorkflowSidebarVisible = false;
      updateStudioWorkflowSidebar();
    });
  }

  return {
    setResourcesOverlayOpen,
    setSkillsOverlayOpen,
    setAboutOverlayOpen,
    bindEvents,
    showAllStudioCards
  };
}
