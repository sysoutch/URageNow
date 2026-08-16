function createDashboardGuildChannelRuntimeHelpers(input) {
  const state = input.state;
  const refreshMeta = input.refreshMeta;
  const guildRefresh = input.guildRefresh;
  const request = input.request;
  const setOutput = input.setOutput;
  const clearChildren = input.clearChildren;
  const escapeHtml = input.escapeHtml;
  const setHeroBotTag = input.setHeroBotTag;
  const renderGuildRail = input.renderGuildRail;
  const renderChannelBrowser = input.renderChannelBrowser;
  const updateSelectionDetails = input.updateSelectionDetails;
  const renderGuildPermissions = input.renderGuildPermissions;
  const renderChannelPermissions = input.renderChannelPermissions;
  const refreshAutomationAndModelChannelSelectors = input.refreshAutomationAndModelChannelSelectors;
  const renderMessengerDashboardView = input.renderMessengerDashboardView;
  const renderBotMessageList = input.renderBotMessageList;
  const setRefreshStatus = input.setRefreshStatus;
  const loadMessengerRuntimes = input.loadMessengerRuntimes;
  const loadChannels = input.loadChannels;
  const getMessengerDisplayName = input.getMessengerDisplayName;
  const loadGlobalSettingsFromState = input.loadGlobalSettingsFromState;
  const refreshAutomationTextSources = input.refreshAutomationTextSources;

  async function loadGuilds() {
    if (state.selectedMessenger !== "discord") {
      return;
    }
    setHeroBotTag("Connecting...");
    const payload = await request("/api/guilds");
    state.guilds = Array.isArray(payload) ? payload : [];
    refreshMeta.guilds = Date.now();
    if (state.guilds.length === 0) {
      setHeroBotTag("Waiting for Discord...");
      scheduleGuildRefreshRetry();
    } else {
      setHeroBotTag("Connected");
    }
    if (!state.guilds.some(item => item.id === state.selectedGuildId)) {
      state.selectedGuildId = "";
      state.selectedChannelId = "";
      state.channels = [];
      state.channelsGuildId = "";
      state.roles = [];
    }
    renderGuildRail();
    refreshAutomationAndModelChannelSelectors();
  }

  function scheduleGuildRefreshRetry() {
    if (guildRefresh.timer) {
      return;
    }
    if (guildRefresh.attempts >= 6) {
      setHeroBotTag("No servers found");
      return;
    }
    guildRefresh.attempts += 1;
    guildRefresh.timer = window.setTimeout(async () => {
      guildRefresh.timer = 0;
      if (state.selectedMessenger !== "discord") {
        return;
      }
      try {
        await loadGuilds();
      } catch (error) {
        setOutput(error.message || "Failed to refresh servers.");
      }
    }, 5000);
  }

  async function loadDashboardDiscordChannels() {
    if (state.selectedMessenger !== "discord") {
      return;
    }
    if (!state.selectedGuildId) {
      if (state.guilds.length === 0) {
        await loadGuilds();
      }
      if (!state.selectedGuildId && state.guilds.length > 0) {
        state.selectedGuildId = state.guilds[0].id;
      }
      if (!state.selectedGuildId) {
        throw new Error("No guild selected. Refresh guilds first.");
      }
    }
    await loadChannels();
    updateSelectionDetails();
    renderGuildPermissions();
    renderChannelPermissions();
    refreshAutomationAndModelChannelSelectors();
    renderGuildChannelPlan();
    renderMessengerDashboardView();
  }

  async function loadDashboardDiscordMessages() {
    if (state.selectedMessenger !== "discord") {
      return;
    }
    if (!state.selectedChannelId) {
      throw new Error("Load channels first, then choose a channel.");
    }
    await loadBotMessages();
    renderMessengerDashboardView();
  }

  function getChannelIcon(channel) {
    if (!channel) return "#";
    if (channel.isVoice) return "A";
    const kind = String(channel.kind || "").toLowerCase();
    if (kind.includes("forum")) return "F";
    if (kind.includes("announcement")) return "!";
    if (kind.includes("thread")) return "T";
    return "#";
  }

  function getChannelGroups() {
    const groups = [];
    const map = new Map();
    for (const channel of state.channels || []) {
      const key = channel.parentId || "__uncategorized__";
      let group = map.get(key);
      if (!group) {
        group = { key, parentId: channel.parentId || null, label: channel.parentName || "Channels", channels: [] };
        map.set(key, group);
        groups.push(group);
      }
      group.channels.push(channel);
    }
    return groups;
  }

  function toggleChannelGroup(groupKey) {
    state.collapsedChannelGroups[groupKey] = !state.collapsedChannelGroups[groupKey];
    renderChannelBrowser();
    renderGuildChannelPlan();
  }

  async function renderGuildChannelPlan() {
    const container = document.getElementById("guild-channel-plan");
    if (!container) {
      return;
    }
    clearChildren(container);
    if (!state.selectedGuildId) {
      appendPlanEmptyState(container, "Select a server to view its channel plan.");
      return;
    }
    if (state.channels.length === 0) {
      appendPlanEmptyState(container, "No channels found for this server.");
      return;
    }
    for (const group of getChannelGroups()) {
      container.appendChild(createChannelGroupNode(group));
    }
  }

  function appendPlanEmptyState(container, text) {
    const empty = document.createElement("div");
    empty.className = "item";
    empty.textContent = text;
    container.appendChild(empty);
  }

  function createChannelGroupNode(group) {
    const groupNode = document.createElement("div");
    groupNode.className = "channel-group" + (group.parentId ? "" : " uncategorized");
    const header = document.createElement("div");
    header.className = "channel-group-header";
    header.innerHTML = "<span>" + escapeHtml(group.label) + "</span><button class='toggle-button'>" + (state.collapsedChannelGroups[group.key] ? "Expand" : "Collapse") + "</button>";
    header.addEventListener("click", () => toggleChannelGroup(group.key));
    groupNode.appendChild(header);
    if (!state.collapsedChannelGroups[group.key]) {
      for (const channel of group.channels) {
        groupNode.appendChild(createChannelNode(channel));
      }
    }
    return groupNode;
  }

  function createChannelNode(channel) {
    const channelNode = document.createElement("div");
    channelNode.className = "channel-entry" + (channel.id === state.selectedChannelId ? " active" : "");
    channelNode.innerHTML = "<span class='channel-icon'>" + getChannelIcon(channel) + "</span><span class='channel-name'>" + escapeHtml(channel.name) + "</span>";
    channelNode.addEventListener("click", async () => {
      if (state.selectedChannelId === channel.id) return;
      state.selectedChannelId = channel.id;
      renderChannelBrowser();
      updateSelectionDetails();
      await loadBotMessages();
      setOutput("Switched to channel #" + channel.name + ".");
    });
    return channelNode;
  }

  async function renderModerationSimulation() {
    const container = document.getElementById("moderation-simulation");
    if (!container) {
      return;
    }
    clearChildren(container);
    if (!state.selectedGuildId) {
      appendPlanEmptyState(container, "Select a server to simulate moderation actions.");
      return;
    }
    const simulation = state.moderationSimulation;
    if (!simulation) {
      appendPlanEmptyState(container, "No moderation simulation data available for this server.");
      return;
    }
    container.appendChild(createModerationSimulationSummary(simulation));
    if (Array.isArray(simulation.details) && simulation.details.length > 0) {
      container.appendChild(createModerationSimulationDetails(simulation.details));
    }
  }

  function createModerationSimulationSummary(simulation) {
    const summary = document.createElement("div");
    summary.className = "moderation-simulation-summary";
    summary.innerHTML =
      "<div><strong>Action:</strong> " + escapeHtml(simulation.action) + "</div>"
      + "<div><strong>Reason:</strong> " + escapeHtml(simulation.reason || "(none)") + "</div>"
      + "<div><strong>Allowed:</strong> " + (simulation.allowed ? "<span class='ok'>Yes</span>" : "<span class='missing'>No</span>") + "</div>";
    return summary;
  }

  function createModerationSimulationDetails(details) {
    const detailsList = document.createElement("div");
    detailsList.className = "moderation-simulation-details";
    for (const detail of details) {
      const detailNode = document.createElement("div");
      detailNode.className = "moderation-simulation-detail";
      detailNode.innerHTML =
        "<div><strong>" + escapeHtml(detail.label) + ":</strong> " + escapeHtml(detail.value) + "</div>"
        + "<div><strong>Allowed:</strong> " + (detail.allowed ? "<span class='ok'>Yes</span>" : "<span class='missing'>No</span>") + "</div>";
      detailsList.appendChild(detailNode);
    }
    return detailsList;
  }

  async function loadBotMessages() {
    if (!state.selectedChannelId) {
      state.botMessages = [];
      state.selectedBotMessageId = "";
      renderBotMessageList();
      const node = document.getElementById("bot-messages-refresh-status");
      if (node) {
        node.textContent = "Bot messages not loaded yet.";
      }
      return;
    }
    const payload = await request("/api/channel-bot-messages?channelId=" + encodeURIComponent(state.selectedChannelId));
    state.botMessages = Array.isArray(payload) ? payload : [];
    if (!state.botMessages.some(item => item.id === state.selectedBotMessageId)) {
      state.selectedBotMessageId = state.botMessages[0] ? state.botMessages[0].id : "";
    }
    renderBotMessageList();
    refreshMeta.botMessages = Date.now();
    setRefreshStatus("bot-messages-refresh-status", "Bot messages refreshed at ", refreshMeta.botMessages);
  }

  async function refreshState() {
    try {
      await loadGlobalSettingsFromState();
      await loadMessengerRuntimes();
      if (state.selectedMessenger !== "discord") {
        setHeroBotTag(getMessengerDisplayName(state.selectedMessenger) + " Mode");
        renderMessengerDashboardView();
        return;
      }
      await loadGuilds();
      renderGuildRail();
      renderChannelBrowser();
      updateSelectionDetails();
      renderGuildPermissions();
      renderChannelPermissions();
      refreshAutomationAndModelChannelSelectors();
      renderMessengerDashboardView();
    } catch (error) {
      setHeroBotTag("Disconnected");
      setOutput(error.message || "Failed to load Discord data.");
    }
  }

  async function initializeWorkspace() {
    await loadGlobalSettingsFromState();
    await Promise.allSettled([refreshAutomationTextSources()]);
    renderBotMessageList();
    renderGuildPermissions();
    renderChannelPermissions();
  }

  return {
    loadGuilds,
    scheduleGuildRefreshRetry,
    loadDashboardDiscordChannels,
    loadDashboardDiscordMessages,
    renderGuildChannelPlan,
    renderModerationSimulation,
    loadBotMessages,
    refreshState,
    initializeWorkspace
  };
}
