function createDashboardGuildSettingsUiHelpers(input) {
  const {
    state,
    request,
    setOutput,
    clearChildren,
    escapeHtml,
    switchView,
    switchSubview,
    updateSelectionDetails,
    renderChannelBrowser,
    loadBotMessages,
    loadChannelSettings,
    loadChannelPermissionSummary,
    selectChannel,
    setElementValue,
    setElementChecked
  } = input;
  function getDefaultChatModeSettings() {
    return {
      enabled: false,
      allowedRoleIds: [],
      allowedUserIds: [],
      requireMentionOrReply: true,
      cooldownSeconds: 30,
      systemPrompt: ""
    };
  }
  function getChannelLabel(channel) {
    if (!channel) {
      return "";
    }
    return (channel.isVoice ? "Voice " : "#") + channel.name + " | " + channel.id;
  }
  function getRoleLabel(role) {
    return role.colorHex ? role.name + " (" + role.colorHex + ")" : role.name;
  }
  function setChipText(id, text) {
    const chip = document.getElementById(id);
    if (chip) {
      chip.textContent = text;
    }
  }
  function getChannelNameList(channelIds) {
    return (channelIds || []).reduce((items, channelId) => {
      const selected = state.channels.find(item => item.id === channelId);
      if (selected) {
        items.push("#" + selected.name);
      }
      return items;
    }, []);
  }
  function getRoleNameList(roleIds) {
    return (roleIds || []).reduce((items, roleId) => {
      const selected = state.roles.find(item => item.id === roleId);
      if (selected) {
        items.push(selected.name);
      }
      return items;
    }, []);
  }
  function getSelectedChannelLabel(channelId) {
    const selected = channelId ? state.channels.find(item => item.id === channelId) : null;
    return selected ? getChannelLabel(selected) : "Disabled";
  }
  function parseMediaReactionRulesJson() {
    const raw = document.getElementById("media-reaction-rules-json")?.value || "[]";
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      setOutput("Media reaction rules JSON is invalid. Keeping previous saved rules.");
      return state.mediaReactionRules || [];
    }
  }
  function renderPermissionSummary(options) {
    const summary = document.getElementById(options.summaryId);
    const container = document.getElementById(options.containerId);
    if (!summary || !container) {
      return;
    }
    clearChildren(container);
    if (!options.permissionState) {
      summary.textContent = options.emptySummary;
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = options.emptyText;
      container.appendChild(empty);
      return;
    }
    summary.textContent = options.permissionState.missingCriticalPermissions.length > 0
      ? options.missingPrefix + options.permissionState.missingCriticalPermissions.join(", ")
      : options.okSummary;
    for (const permission of options.permissionState.permissions) {
      const row = document.createElement("div");
      row.className = "permission-row";
      row.innerHTML = "<strong>" + escapeHtml(permission.label) + "</strong>";
      const badge = document.createElement("span");
      badge.className = "permission-state " + (permission.allowed ? "ok" : "missing");
      badge.textContent = permission.allowed ? "OK" : "Missing";
      row.appendChild(badge);
      container.appendChild(row);
    }
  }
  function getModel3dInitialExtraSampleText() {
    const node = document.getElementById("model3d-initial-extra");
    if (!node || typeof node.defaultValue !== "string") {
      return "";
    }
    return node.defaultValue.trim();
  }
  function getModel3dDestinationExtraSampleText() {
    const node = document.getElementById("model3d-destination-extra");
    if (!node || typeof node.defaultValue !== "string") {
      return "";
    }
    return node.defaultValue.trim();
  }
  function getScheduledModelPostOptionsModule() {
    if (!window.DashboardScheduledModelPostOptions) {
      return null;
    }
    return window.DashboardScheduledModelPostOptions;
  }
  function getAutomationScopeId() {
    return state.selectedMessenger === "discord"
      ? String(state.selectedGuildId || "").trim()
      : `messenger:${state.selectedMessenger}`;
  }
  function setHeroBotTag(text) {
    const node = document.getElementById("hero-bot-tag");
    if (node) {
      node.textContent = text;
    }
  }
  async function loadSelectedGuildSettings() {
    if (!state.selectedGuildId) {
      state.imagePoolVerifiedRoleIds = [];
      state.imagePoolVerifiedUserIds = [];
      state.antiSpamImageScanChannelIds = [];
      state.antiSpamExcludedChannelIds = [];
      state.antiSpamExcludedRoleIds = [];
      state.antiSpamAlertChannelId = "";
      state.protectedUserIds = [];
      state.protectedRoleIds = [];
      state.honeypotExcludedChannelIds = [];
      state.honeypotExcludedRoleIds = [];
      state.honeypotChannelId = "";
      state.honeypotBackupChannelId = "";
      state.honeypotReviewChannelId = "";
      updateImagePoolVerifiedRoleChip();
      updateImagePoolVerifiedUserChip();
      updateImageScanChannelChip();
      updateExcludedChannelChip();
      updateExcludedRoleChip();
      updateAlertChannelChip();
      updateProtectedUserChip();
      updateProtectedRoleChip();
      updateHoneypotExcludedChannelChip();
      updateHoneypotExcludedRoleChip();
      updateHoneypotChannelChip();
      updateHoneypotBackupChannelChip();
      updateHoneypotReviewChannelChip();
      return;
    }
    const moderationSettings = await request("/api/guild-dashboard-settings?guildId=" + encodeURIComponent(state.selectedGuildId));
    const settings = await request("/api/guild-settings?guildId=" + encodeURIComponent(state.selectedGuildId));
    state.antiSpamImageScanChannelIds = Array.isArray(moderationSettings.antiSpamImageScanChannelIds) ? moderationSettings.antiSpamImageScanChannelIds : [];
    state.antiSpamExcludedChannelIds = Array.isArray(moderationSettings.antiSpamExcludedChannelIds) ? moderationSettings.antiSpamExcludedChannelIds : [];
    state.antiSpamExcludedRoleIds = Array.isArray(moderationSettings.antiSpamExcludedRoleIds) ? moderationSettings.antiSpamExcludedRoleIds : [];
    state.antiSpamAlertChannelId = moderationSettings.antiSpamAlertChannelId || "";
    state.honeypotEnabled = moderationSettings.honeypotEnabled === true;
    state.honeypotChannelId = moderationSettings.honeypotChannelId || "";
    state.honeypotTriggerOnText = moderationSettings.honeypotTriggerOnText !== false;
    state.honeypotTriggerOnFiles = moderationSettings.honeypotTriggerOnFiles !== false;
    state.honeypotTriggerOnLinks = moderationSettings.honeypotTriggerOnLinks !== false;
    state.honeypotImmediateAction = moderationSettings.honeypotImmediateAction || "timeout";
    state.honeypotTimeoutMinutes = Math.max(1, Math.round((Number(moderationSettings.honeypotTimeoutMs) || 604800000) / 60000));
    state.honeypotRemoveMessage = moderationSettings.honeypotRemoveMessage !== false;
    state.protectedUserIds = Array.isArray(moderationSettings.protectedUserIds) ? moderationSettings.protectedUserIds : [];
    state.protectedRoleIds = Array.isArray(moderationSettings.protectedRoleIds) ? moderationSettings.protectedRoleIds : [];
    state.honeypotExcludedChannelIds = Array.isArray(moderationSettings.honeypotExcludedChannelIds) ? moderationSettings.honeypotExcludedChannelIds : [];
    state.honeypotExcludedRoleIds = Array.isArray(moderationSettings.honeypotExcludedRoleIds) ? moderationSettings.honeypotExcludedRoleIds : [];
    state.honeypotBackupChannelId = moderationSettings.honeypotBackupChannelId || "";
    state.honeypotDmEnabled = moderationSettings.honeypotDmEnabled !== false;
    state.honeypotDmMessage = moderationSettings.honeypotDmMessage || "";
    state.honeypotReviewChannelId = moderationSettings.honeypotReviewChannelId || "";
    state.honeypotPostVerifyAction = moderationSettings.honeypotPostVerifyAction || "remove-timeout";
    state.honeypotVerificationWindowDays = Math.max(1, Math.round((Number(moderationSettings.honeypotVerificationWindowMs) || 604800000) / 86400000));
    state.honeypotUnverifiedAction = moderationSettings.honeypotUnverifiedAction || "ban";
    setElementChecked("anti-spam-enabled", moderationSettings.antiSpamEnabled !== false);
    setElementChecked("anti-spam-timeouts", moderationSettings.antiSpamApplyTimeouts !== false);
    setElementChecked("anti-spam-images", moderationSettings.antiSpamAnalyzeImages !== false);
    setElementChecked("anti-spam-temp-hold-enabled", moderationSettings.antiSpamTemporaryInvestigationHoldEnabled === true);
    setElementChecked("anti-spam-image-flag-spam", moderationSettings.antiSpamImageFlagSpam !== false);
    setElementChecked("anti-spam-image-flag-nsfw", moderationSettings.antiSpamImageFlagNsfw !== false);
    setElementChecked("anti-spam-image-flag-crypto-spam", moderationSettings.antiSpamImageFlagCryptoSpam !== false);
    setElementChecked("anti-spam-image-flag-crypto-image", moderationSettings.antiSpamImageFlagCryptoImage !== false);
    setElementValue("anti-spam-text-rules", (moderationSettings.antiSpamTextRulePatterns || []).join("\n"));
    setElementValue("anti-spam-link-rules", (moderationSettings.antiSpamBlockedLinkPatterns || []).join("\n"));
    setElementValue("anti-spam-window-seconds", String(Math.max(5, Math.round((Number(moderationSettings.antiSpamDuplicateWindowMs) || 60000) / 1000))));
    setElementValue("anti-spam-timeout-minutes", String(Math.max(1, Math.round((Number(moderationSettings.antiSpamTimeoutMs) || 604800000) / 60000))));
    setElementValue("anti-spam-temp-hold-seconds", String(Math.max(0, Math.round((Number(moderationSettings.antiSpamTemporaryInvestigationHoldMs) || 5000) / 1000))));
    setElementChecked("honeypot-enabled", state.honeypotEnabled);
    setElementChecked("honeypot-trigger-text", state.honeypotTriggerOnText);
    setElementChecked("honeypot-trigger-files", state.honeypotTriggerOnFiles);
    setElementChecked("honeypot-trigger-links", state.honeypotTriggerOnLinks);
    setElementValue("honeypot-immediate-action", state.honeypotImmediateAction);
    setElementValue("honeypot-timeout-minutes", String(state.honeypotTimeoutMinutes));
    setElementChecked("honeypot-remove-message", state.honeypotRemoveMessage);
    setElementChecked("honeypot-dm-enabled", state.honeypotDmEnabled);
    setElementValue("honeypot-dm-message", state.honeypotDmMessage);
    setElementValue("honeypot-post-verify-action", state.honeypotPostVerifyAction);
    setElementValue("honeypot-verification-window-days", String(state.honeypotVerificationWindowDays));
    setElementValue("honeypot-unverified-action", state.honeypotUnverifiedAction);
    state.botMode = settings.botMode || "normal";
    state.botActingPreset = settings.botActingPreset || "user";
    state.botSafetyRequireMentionOrReply = settings.botSafetyRequireMentionOrReply !== false;
    state.botSafetySuggestOnly = settings.botSafetySuggestOnly !== false;
    state.botSafetyAllowChatSelfTasks = settings.botSafetyAllowChatSelfTasks === true;
    state.botSafetyChatSelfTasksAdminOnly = settings.botSafetyChatSelfTasksAdminOnly !== false;
    state.botSafetyChatSelfTaskMinConfidence = Number.isFinite(settings.botSafetyChatSelfTaskMinConfidence) ? settings.botSafetyChatSelfTaskMinConfidence : 85;
    state.botSafetyAllowRoleSuggestions = settings.botSafetyAllowRoleSuggestions === true;
    state.botSafetyAllowChannelSuggestions = settings.botSafetyAllowChannelSuggestions === true;
    state.botSafetyAllowPromotionSuggestions = settings.botSafetyAllowPromotionSuggestions === true;
    state.autonomousStatusChannelId = settings.autonomousStatusChannelId || "";
    state.autonomousHeartbeatEnabled = settings.autonomousHeartbeatEnabled === true;
    state.autonomousHeartbeatMinutes = Number.isFinite(settings.autonomousHeartbeatMinutes) ? settings.autonomousHeartbeatMinutes : 30;
    state.autonomousReplyToMentions = settings.autonomousReplyToMentions !== false;
    state.imagePoolVerifiedRoleIds = Array.isArray(settings.imagePoolVerifiedRoleIds) ? settings.imagePoolVerifiedRoleIds : [];
    state.imagePoolVerifiedUserIds = Array.isArray(settings.imagePoolVerifiedUserIds) ? settings.imagePoolVerifiedUserIds : [];
    state.mediaReactionRules = Array.isArray(settings.mediaReactionRules) ? settings.mediaReactionRules : [];
    setElementValue("media-reaction-rules-json", JSON.stringify(state.mediaReactionRules, null, 2));
    state.selfTaskDryRunOnly = settings.selfTaskDryRunOnly === true;
    state.selfTaskAllowedActionTypes = Array.isArray(settings.selfTaskAllowedActionTypes) ? settings.selfTaskAllowedActionTypes : state.selfTaskAllowedActionTypes;
    state.chatModeChannels = settings.chatModeChannels || {};
    setElementValue("bot-mode-select", state.botMode);
    setElementValue("bot-acting-preset-select", state.botActingPreset);
    setElementChecked("bot-safety-require-mention", state.botSafetyRequireMentionOrReply);
    setElementChecked("bot-safety-suggest-only", state.botSafetySuggestOnly);
    setElementChecked("bot-safety-role-suggestions", state.botSafetyAllowRoleSuggestions);
    setElementChecked("bot-safety-chat-self-tasks", state.botSafetyAllowChatSelfTasks);
    setElementChecked("bot-safety-chat-self-tasks-admin-only", state.botSafetyChatSelfTasksAdminOnly);
    setElementValue("bot-safety-chat-task-confidence", String(state.botSafetyChatSelfTaskMinConfidence));
    setElementChecked("bot-safety-channel-suggestions", state.botSafetyAllowChannelSuggestions);
    setElementChecked("bot-safety-promotion-suggestions", state.botSafetyAllowPromotionSuggestions);
    setElementChecked("autonomous-heartbeat-enabled", state.autonomousHeartbeatEnabled);
    setElementValue("autonomous-heartbeat-minutes", String(state.autonomousHeartbeatMinutes));
    setElementChecked("autonomous-reply-to-mentions", state.autonomousReplyToMentions);
    document.querySelectorAll("[data-self-task-action]").forEach(node => {
      const actionType = node.getAttribute("data-self-task-action");
      node.checked = state.selfTaskAllowedActionTypes.includes(actionType);
    });
    updateImageScanChannelChip();
    updateExcludedChannelChip();
    updateExcludedRoleChip();
    updateAlertChannelChip();
    updateProtectedUserChip();
    updateProtectedRoleChip();
    updateHoneypotExcludedChannelChip();
    updateHoneypotExcludedRoleChip();
    updateHoneypotChannelChip();
    updateHoneypotBackupChannelChip();
    updateHoneypotReviewChannelChip();
    updateAutonomousStatusChannelChip();
    updateChatModeForm();
    updateImagePoolVerifiedRoleChip();
    updateImagePoolVerifiedUserChip();
  }
  async function openChannelSettings(channelId) {
    const nextChannelId = String(channelId || "").trim();
    if (!nextChannelId) {
      return;
    }
    const channel = state.channels.find(item => item.id === nextChannelId) || null;
    if (!channel) {
      setOutput("Channel not found in the selected guild.");
      return;
    }
    state.selectedChannelId = nextChannelId;
    switchView("guild");
    switchSubview("guild", "guild-channels");
    updateSelectionDetails();
    renderChannelBrowser();
    updateImageScanChannelChip();
    updateChatModeForm();
    await loadBotMessages();
    await loadChannelSettings();
    await loadChannelPermissionSummary();
    setOutput("Opened settings for #" + channel.name + ".");
  }
  function renderGuildPermissions() {
    renderPermissionSummary({
      summaryId: "guild-permissions-summary",
      containerId: "guild-permissions-list",
      permissionState: state.selectedGuildId ? state.guildPermissions : null,
      emptySummary: "Select a server to inspect the bot permissions there.",
      emptyText: "No guild permission summary loaded.",
      missingPrefix: "Missing critical permissions: ",
      okSummary: "Core bot permissions look good for this server."
    });
  }
  function renderChannelPermissions() {
    renderPermissionSummary({
      summaryId: "channel-permissions-summary",
      containerId: "channel-permissions-list",
      permissionState: state.selectedGuildId && state.selectedChannelId ? state.channelPermissions : null,
      emptySummary: "Select a channel to inspect bot access there.",
      emptyText: "No channel permission summary loaded.",
      missingPrefix: "Missing critical channel permissions: ",
      okSummary: "Bot can use the main actions in this channel."
    });
  }
  function updateImageScanChannelChip() {
    const labels = getChannelNameList(state.antiSpamImageScanChannelIds);
    setChipText("anti-spam-image-scan-channel-chip", labels.length > 0 ? labels.join(", ") : "Disabled");
  }
  function updateExcludedChannelChip() {
    const labels = getChannelNameList(state.antiSpamExcludedChannelIds);
    setChipText("anti-spam-excluded-channel-chip", labels.length > 0 ? labels.join(", ") : "Disabled");
  }
  function updateExcludedRoleChip() {
    const labels = getRoleNameList(state.antiSpamExcludedRoleIds);
    setChipText("anti-spam-excluded-role-chip", labels.length > 0 ? labels.join(", ") : "Disabled");
  }
  function updateAlertChannelChip() {
    const selected = state.antiSpamAlertChannelId
      ? state.channels.find(item => item.id === state.antiSpamAlertChannelId)
      : null;
    setChipText("anti-spam-alert-channel-chip", selected ? "#" + selected.name + " | " + selected.id : "Disabled");
  }
  function updateProtectedRoleChip() {
    const labels = getRoleNameList(state.protectedRoleIds);
    setChipText("protected-roles-chip", labels.length > 0 ? labels.join(", ") : "Discord permissions only");
  }
  function updateProtectedUserChip() {
    const labels = (state.protectedUserIds || [])
      .map(userId => state.users.find(item => item.id === userId) || (state.selectedUser && state.selectedUser.id === userId ? state.selectedUser : null) || { displayName: userId, tag: userId })
      .filter(Boolean)
      .map(user => user.displayName + (user.tag && user.tag !== user.displayName ? " | " + user.tag : ""));
    setChipText("protected-users-chip", labels.length > 0 ? labels.join(", ") : "Discord permissions only");
  }
  function updateHoneypotExcludedChannelChip() {
    const labels = getChannelNameList(state.honeypotExcludedChannelIds);
    setChipText("honeypot-excluded-channel-chip", labels.length > 0 ? labels.join(", ") : "Disabled");
  }
  function updateHoneypotExcludedRoleChip() {
    const labels = getRoleNameList(state.honeypotExcludedRoleIds);
    setChipText("honeypot-excluded-role-chip", labels.length > 0 ? labels.join(", ") : "Disabled");
  }
  function updateHoneypotChannelChip() {
    setChipText("honeypot-channel-chip", getSelectedChannelLabel(state.honeypotChannelId));
  }
  function updateHoneypotBackupChannelChip() {
    setChipText("honeypot-backup-channel-chip", getSelectedChannelLabel(state.honeypotBackupChannelId));
  }
  function updateHoneypotReviewChannelChip() {
    setChipText("honeypot-review-channel-chip", getSelectedChannelLabel(state.honeypotReviewChannelId));
  }
  function updateInvestigationRoleChip() {
    const selected = state.investigationRoleId ? state.roles.find(item => item.id === state.investigationRoleId) : null;
    setChipText("investigation-role-chip", selected ? selected.colorHex ? selected.name + " | " + selected.colorHex : selected.name : "Disabled");
  }
  function updateTemporaryImageBlockRoleChip() {
    const selected = state.temporaryImageBlockRoleId ? state.roles.find(item => item.id === state.temporaryImageBlockRoleId) : null;
    setChipText("temp-block-role-chip", selected ? selected.colorHex ? selected.name + " | " + selected.colorHex : selected.name : "Disabled");
  }
  function fillMemberCounterChannelOptions() {
    const select = document.getElementById("member-counter-channel-select");
    if (!select) {
      return;
    }
    const previous = state.memberCounterChannelId || "";
    clearChildren(select);
    const disabledOption = document.createElement("option");
    disabledOption.value = "";
    disabledOption.textContent = "Disabled";
    select.appendChild(disabledOption);
    state.channels
      .filter(channel => channel.canSendMessages)
      .forEach(channel => {
        const option = document.createElement("option");
        option.value = channel.id;
        option.textContent = "#" + channel.name;
        select.appendChild(option);
      });
    select.value = previous;
  }
  function updateMemberCounterChip() {
    const channel = state.memberCounterChannelId ? state.channels.find(item => item.id === state.memberCounterChannelId) : null;
    setChipText("member-counter-channel-chip", channel ? "#" + channel.name + " | " + channel.id : "Disabled");
  }
  function getSelectedChatModeSettings() {
    if (!state.selectedChannelId) {
      return getDefaultChatModeSettings();
    }
    return state.chatModeChannels[state.selectedChannelId] || getDefaultChatModeSettings();
  }
  function syncRoleSelectOptions() {
    const select = document.getElementById("role-select");
    if (!select) {
      return;
    }
    const previousSelectedRoleId = state.selectedRoleId || (typeof select.value === "string" ? select.value.trim() : "");
    clearChildren(select);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose role";
    select.appendChild(placeholder);
    for (const role of state.roles) {
      const option = document.createElement("option");
      option.value = role.id;
      option.textContent = role.colorHex ? role.name + " (" + role.colorHex + ")" : role.name;
      select.appendChild(option);
    }
    if (previousSelectedRoleId && state.roles.some(item => item.id === previousSelectedRoleId)) {
      select.value = previousSelectedRoleId;
      state.selectedRoleId = previousSelectedRoleId;
      return;
    }
    select.value = "";
    state.selectedRoleId = "";
  }
  function getSelectedRoleIdFromUi() {
    const roleSelect = document.getElementById("role-select");
    const roleIdFromSelect = roleSelect && typeof roleSelect.value === "string" ? roleSelect.value.trim() : "";
    return roleIdFromSelect || String(state.selectedRoleId || "").trim();
  }
  function getSelectedUserIdForChatMode() {
    return String(state.selectedUserId || state.selectedUser?.id || "").trim();
  }
  async function ensureGuildRolesLoaded() {
    if (!state.selectedGuildId || (Array.isArray(state.roles) && state.roles.length > 0)) {
      return;
    }
    const payload = await request("/api/roles?guildId=" + encodeURIComponent(state.selectedGuildId));
    state.roles = Array.isArray(payload) ? payload : [];
    if (!state.roles.some(item => item.id === state.selectedRoleId)) {
      state.selectedRoleId = "";
    }
    syncRoleSelectOptions();
  }
  function updateAutonomousStatusChannelChip() {
    const selected = state.autonomousStatusChannelId
      ? state.channels.find(item => item.id === state.autonomousStatusChannelId)
      : null;
    setChipText("autonomous-status-channel-chip", selected ? getChannelLabel(selected) : "Disabled");
  }
  function updateImagePoolVerifiedRoleChip() {
    const labels = (state.imagePoolVerifiedRoleIds || [])
      .map(roleId => state.roles.find(item => item.id === roleId))
      .filter(Boolean)
      .map(getRoleLabel);
    setChipText("image-pool-verified-roles-chip", labels.length > 0 ? labels.join(", ") : "Admins only");
  }
  function updateImagePoolVerifiedUserChip() {
    const labels = (state.imagePoolVerifiedUserIds || [])
      .map(userId => state.users.find(item => item.id === userId) || (state.selectedUser && state.selectedUser.id === userId ? state.selectedUser : null) || { displayName: userId, tag: userId })
      .filter(Boolean)
      .map(user => user.displayName + (user.tag && user.tag !== user.displayName ? " | " + user.tag : ""));
    setChipText("image-pool-verified-users-chip", labels.length > 0 ? labels.join(", ") : "Admins only");
  }
  function updateChatModeRoleChip() {
    const labels = getSelectedChatModeSettings().allowedRoleIds
      .map(roleId => state.roles.find(item => item.id === roleId))
      .filter(Boolean)
      .map(getRoleLabel);
    setChipText("chat-mode-allowed-roles-chip", labels.length > 0 ? labels.join(", ") : "None");
  }
  function updateChatModeUserChip() {
    const labels = getSelectedChatModeSettings().allowedUserIds
      .map(userId => state.users.find(item => item.id === userId) || (state.selectedUser && state.selectedUser.id === userId ? state.selectedUser : null))
      .filter(Boolean)
      .map(user => user.displayName + " | " + user.tag);
    setChipText("chat-mode-allowed-users-chip", labels.length > 0 ? labels.join(", ") : "None");
  }
  function updateChatModeForm() {
    syncRoleSelectOptions();
    const channelChip = document.getElementById("chat-mode-channel-chip");
    if (!channelChip) {
      return;
    }
    if (!state.selectedChannelId) {
      channelChip.textContent = "No channel selected";
      setElementChecked("chat-mode-enabled", false);
      setElementChecked("chat-mode-require-mention", true);
      setElementValue("chat-mode-cooldown-seconds", "30");
      setElementValue("chat-mode-system-prompt", "");
      updateChatModeRoleChip();
      updateChatModeUserChip();
      updateChatModeDebugCard();
      return;
    }
    const channel = state.channels.find(item => item.id === state.selectedChannelId);
    channelChip.textContent = channel ? getChannelLabel(channel) : state.selectedChannelId;
    const selectedSettings = getSelectedChatModeSettings();
    setElementChecked("chat-mode-enabled", selectedSettings.enabled);
    setElementChecked("chat-mode-require-mention", selectedSettings.requireMentionOrReply);
    setElementValue("chat-mode-cooldown-seconds", String(selectedSettings.cooldownSeconds));
    setElementValue("chat-mode-system-prompt", selectedSettings.systemPrompt);
    updateChatModeRoleChip();
    updateChatModeUserChip();
    updateChatModeDebugCard();
  }
  function updateChatModeDebugCard() {
    const statusNode = document.getElementById("chat-mode-debug-status");
    const reasonNode = document.getElementById("chat-mode-debug-reason");
    const metaNode = document.getElementById("chat-mode-debug-meta");
    if (!statusNode || !reasonNode || !metaNode) {
      return;
    }
    if (!state.selectedChannelId) {
      statusNode.textContent = "No channel selected.";
      reasonNode.textContent = "Pick a text channel to inspect chat mode.";
      metaNode.textContent = "No recent event.";
      return;
    }
    if (!state.chatModeDebug) {
      statusNode.textContent = "No chat-mode activity yet.";
      reasonNode.textContent = "No saved decision for this channel yet.";
      metaNode.textContent = "No recent event.";
      return;
    }
    statusNode.textContent = state.chatModeDebug.status === "responded"
      ? "Responded"
      : state.chatModeDebug.status === "error"
        ? "Rod Error"
        : "Ignored";
    reasonNode.textContent = state.chatModeDebug.reason || "No reason recorded.";
    const parts = [];
    if (state.chatModeDebug.username) {
      parts.push(state.chatModeDebug.username);
    }
    if (state.chatModeDebug.messagePreview) {
      parts.push(state.chatModeDebug.messagePreview);
    }
    if (state.chatModeDebug.updatedAt) {
      parts.push(new Date(state.chatModeDebug.updatedAt).toLocaleString());
    }
    metaNode.textContent = parts.length > 0 ? parts.join(" | ") : "No recent event.";
  }
  async function loadChatModeDebug() {
    if (!state.selectedGuildId || !state.selectedChannelId) {
      state.chatModeDebug = null;
      updateChatModeDebugCard();
      return;
    }
    state.chatModeDebug = await request(
      "/api/chat-mode-debug?guildId=" + encodeURIComponent(state.selectedGuildId) + "&channelId=" + encodeURIComponent(state.selectedChannelId)
    );
    updateChatModeDebugCard();
  }
  function updateSelectedChatModeSettings(update) {
    if (!state.selectedChannelId) {
      return getSelectedChatModeSettings();
    }
    const current = getSelectedChatModeSettings();
    const next = { ...current, ...update };
    state.chatModeChannels[state.selectedChannelId] = next;
    updateChatModeForm();
    return next;
  }
  async function persistSelectedChatModeSettings(outputText) {
    if (!state.selectedGuildId) return void setOutput("Select a guild first.");
    if (!state.selectedChannelId) return void setOutput("Select a channel first.");
    const current = getSelectedChatModeSettings();
    await request("/api/guild-settings", {
      guildId: state.selectedGuildId,
      chatModeChannels: {
        ...state.chatModeChannels,
        [state.selectedChannelId]: current
      }
    });
    if (outputText) {
      setOutput(outputText);
    }
  }
  async function sanitizeGuildScopedModerationSelections() {
    if (!state.selectedGuildId) {
      return;
    }
    const channelIds = new Set(state.channels.map(item => item.id));
    const roleIds = new Set(state.roles.map(item => item.id));
    const nextImageScanChannelIds = (state.antiSpamImageScanChannelIds || []).filter(channelId => channelIds.has(channelId));
    const nextExcludedChannelIds = (state.antiSpamExcludedChannelIds || []).filter(channelId => channelIds.has(channelId));
    const nextExcludedRoleIds = (state.antiSpamExcludedRoleIds || []).filter(roleId => roleIds.has(roleId));
    const nextAlertChannelId = state.antiSpamAlertChannelId && channelIds.has(state.antiSpamAlertChannelId) ? state.antiSpamAlertChannelId : "";
    const nextProtectedRoleIds = (state.protectedRoleIds || []).filter(roleId => roleIds.has(roleId));
    const nextHoneypotExcludedChannelIds = (state.honeypotExcludedChannelIds || []).filter(channelId => channelIds.has(channelId));
    const nextHoneypotExcludedRoleIds = (state.honeypotExcludedRoleIds || []).filter(roleId => roleIds.has(roleId));
    const nextHoneypotChannelId = state.honeypotChannelId && channelIds.has(state.honeypotChannelId) ? state.honeypotChannelId : "";
    const nextHoneypotBackupChannelId = state.honeypotBackupChannelId && channelIds.has(state.honeypotBackupChannelId) ? state.honeypotBackupChannelId : "";
    const nextHoneypotReviewChannelId = state.honeypotReviewChannelId && channelIds.has(state.honeypotReviewChannelId) ? state.honeypotReviewChannelId : "";
    const changed =
      nextImageScanChannelIds.length !== state.antiSpamImageScanChannelIds.length
      || nextExcludedChannelIds.length !== state.antiSpamExcludedChannelIds.length
      || nextExcludedRoleIds.length !== state.antiSpamExcludedRoleIds.length
      || nextAlertChannelId !== state.antiSpamAlertChannelId
      || nextProtectedRoleIds.length !== state.protectedRoleIds.length
      || nextHoneypotExcludedChannelIds.length !== state.honeypotExcludedChannelIds.length
      || nextHoneypotExcludedRoleIds.length !== state.honeypotExcludedRoleIds.length
      || nextHoneypotChannelId !== state.honeypotChannelId
      || nextHoneypotBackupChannelId !== state.honeypotBackupChannelId
      || nextHoneypotReviewChannelId !== state.honeypotReviewChannelId;
    state.antiSpamImageScanChannelIds = nextImageScanChannelIds;
    state.antiSpamExcludedChannelIds = nextExcludedChannelIds;
    state.antiSpamExcludedRoleIds = nextExcludedRoleIds;
    state.antiSpamAlertChannelId = nextAlertChannelId;
    state.protectedRoleIds = nextProtectedRoleIds;
    state.honeypotExcludedChannelIds = nextHoneypotExcludedChannelIds;
    state.honeypotExcludedRoleIds = nextHoneypotExcludedRoleIds;
    state.honeypotChannelId = nextHoneypotChannelId;
    state.honeypotBackupChannelId = nextHoneypotBackupChannelId;
    state.honeypotReviewChannelId = nextHoneypotReviewChannelId;
    updateImageScanChannelChip();
    updateExcludedChannelChip();
    updateExcludedRoleChip();
    updateAlertChannelChip();
    updateProtectedUserChip();
    updateProtectedRoleChip();
    updateHoneypotExcludedChannelChip();
    updateHoneypotExcludedRoleChip();
    updateHoneypotChannelChip();
    updateHoneypotBackupChannelChip();
    updateHoneypotReviewChannelChip();
    if (!changed) {
      return;
    }
    await request("/api/settings", {
      guildId: state.selectedGuildId,
      antiSpamImageScanChannelIds: state.antiSpamImageScanChannelIds,
      antiSpamExcludedChannelIds: state.antiSpamExcludedChannelIds,
      antiSpamExcludedRoleIds: state.antiSpamExcludedRoleIds,
      antiSpamAlertChannelId: state.antiSpamAlertChannelId || null,
      protectedUserIds: state.protectedUserIds,
      protectedRoleIds: state.protectedRoleIds,
      honeypotExcludedChannelIds: state.honeypotExcludedChannelIds,
      honeypotExcludedRoleIds: state.honeypotExcludedRoleIds,
      honeypotChannelId: state.honeypotChannelId || null,
      honeypotBackupChannelId: state.honeypotBackupChannelId || null,
      honeypotReviewChannelId: state.honeypotReviewChannelId || null
    });
  }
  async function sanitizeGuildScopedGuildSettings(settings) {
    if (!state.selectedGuildId) {
      return;
    }
    const validSendChannelIds = new Set(state.channels.filter(item => item.canSendMessages).map(item => item.id));
    const validChannelIds = new Set(state.channels.map(item => item.id));
    const validRoleIds = new Set(state.roles.map(item => item.id));
    const nextWelcomeChannelId = settings.welcomeChannelId && validSendChannelIds.has(settings.welcomeChannelId) ? settings.welcomeChannelId : null;
    const nextInvestigationRoleId = state.investigationRoleId && validRoleIds.has(state.investigationRoleId) ? state.investigationRoleId : "";
    const nextTemporaryImageBlockRoleId = state.temporaryImageBlockRoleId && validRoleIds.has(state.temporaryImageBlockRoleId) ? state.temporaryImageBlockRoleId : "";
    const nextMemberCounterChannelId = state.memberCounterChannelId && validChannelIds.has(state.memberCounterChannelId) ? state.memberCounterChannelId : "";
    const nextAutonomousStatusChannelId = state.autonomousStatusChannelId && validChannelIds.has(state.autonomousStatusChannelId) ? state.autonomousStatusChannelId : "";
    const nextImagePoolVerifiedRoleIds = (state.imagePoolVerifiedRoleIds || []).filter(roleId => validRoleIds.has(roleId));
    const nextChatModeChannels = Object.fromEntries(
      Object.entries(state.chatModeChannels || {})
        .filter(([channelId]) => validChannelIds.has(channelId))
        .map(([channelId, entry]) => [
          channelId,
          {
            enabled: entry.enabled === true,
            allowedRoleIds: (entry.allowedRoleIds || []).filter(roleId => validRoleIds.has(roleId)),
            allowedUserIds: entry.allowedUserIds || [],
            requireMentionOrReply: entry.requireMentionOrReply !== false,
            cooldownSeconds: Math.max(0, Number.parseInt(String(entry.cooldownSeconds || 30), 10) || 30),
            systemPrompt: String(entry.systemPrompt || "")
          }
        ])
    );
    const changed =
      nextWelcomeChannelId !== (settings.welcomeChannelId || null)
      || nextInvestigationRoleId !== state.investigationRoleId
      || nextTemporaryImageBlockRoleId !== state.temporaryImageBlockRoleId
      || nextMemberCounterChannelId !== state.memberCounterChannelId
      || nextAutonomousStatusChannelId !== state.autonomousStatusChannelId
      || JSON.stringify(nextImagePoolVerifiedRoleIds) !== JSON.stringify(state.imagePoolVerifiedRoleIds || [])
      || JSON.stringify(nextChatModeChannels) !== JSON.stringify(state.chatModeChannels || {});
    state.investigationRoleId = nextInvestigationRoleId;
    state.temporaryImageBlockRoleId = nextTemporaryImageBlockRoleId;
    state.memberCounterChannelId = nextMemberCounterChannelId;
    state.autonomousStatusChannelId = nextAutonomousStatusChannelId;
    state.imagePoolVerifiedRoleIds = nextImagePoolVerifiedRoleIds;
    state.chatModeChannels = nextChatModeChannels;
    setElementValue("investigation-role-select", state.investigationRoleId);
    setElementValue("temp-block-role-select", state.temporaryImageBlockRoleId);
    setElementValue("member-counter-channel-select", state.memberCounterChannelId);
    updateInvestigationRoleChip();
    updateTemporaryImageBlockRoleChip();
    fillMemberCounterChannelOptions();
    updateMemberCounterChip();
    updateAutonomousStatusChannelChip();
    updateImagePoolVerifiedRoleChip();
    updateChatModeForm();
    if (nextWelcomeChannelId && state.selectedChannelId !== nextWelcomeChannelId) {
      selectChannel(nextWelcomeChannelId);
    }
    if (!changed) {
      return;
    }
    await request("/api/guild-settings", {
      guildId: state.selectedGuildId,
      welcomeChannelId: nextWelcomeChannelId,
      investigationRoleId: state.investigationRoleId || null,
      temporaryImageBlockRoleId: state.temporaryImageBlockRoleId || null,
      memberCounterChannelId: state.memberCounterChannelId || null,
      autonomousStatusChannelId: state.autonomousStatusChannelId || null,
      imagePoolVerifiedRoleIds: state.imagePoolVerifiedRoleIds,
      imagePoolVerifiedUserIds: state.imagePoolVerifiedUserIds,
      mediaReactionRules: parseMediaReactionRulesJson(),
      chatModeChannels: state.chatModeChannels
    });
  }
  function parseRuleLines(id) {
    const raw = document.getElementById(id)?.value || "";
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  }
  function setSelectedModerationChannel(fieldName, updateChip, successText) {
    if (!state.selectedChannelId) {
      setOutput("Select a channel first.");
      return;
    }
    state[fieldName] = state.selectedChannelId;
    updateChip();
    setOutput(successText);
  }
  function clearSelectedModerationChannel(fieldName, updateChip, successText) {
    state[fieldName] = "";
    updateChip();
    setOutput(successText);
  }
  function addSelectedModerationChannel(fieldName, updateChip, successText) {
    if (!state.selectedChannelId) {
      setOutput("Select a channel first.");
      return;
    }
    const existing = Array.isArray(state[fieldName]) ? state[fieldName] : [];
    if (existing.includes(state.selectedChannelId)) {
      setOutput("Selected channel is already listed.");
      return;
    }
    state[fieldName] = [...existing, state.selectedChannelId];
    updateChip();
    setOutput(successText);
  }
  function removeSelectedModerationChannel(fieldName, updateChip, successText) {
    if (!state.selectedChannelId) {
      setOutput("Select a channel first.");
      return;
    }
    const existing = Array.isArray(state[fieldName]) ? state[fieldName] : [];
    if (!existing.includes(state.selectedChannelId)) {
      setOutput("Selected channel is not listed.");
      return;
    }
    state[fieldName] = existing.filter(channelId => channelId !== state.selectedChannelId);
    updateChip();
    setOutput(successText);
  }
  function clearModerationChannelList(fieldName, updateChip, successText) {
    state[fieldName] = [];
    updateChip();
    setOutput(successText);
  }
  function addSelectedModerationRole(fieldName, updateChip, successText) {
    const roleId = getSelectedRoleIdFromUi();
    if (!roleId) {
      setOutput("Choose a role first.");
      return;
    }
    const existing = Array.isArray(state[fieldName]) ? state[fieldName] : [];
    if (existing.includes(roleId)) {
      setOutput("Selected role is already listed.");
      return;
    }
    state[fieldName] = [...existing, roleId];
    updateChip();
    setOutput(successText);
  }
  function removeSelectedModerationRole(fieldName, updateChip, successText) {
    const roleId = getSelectedRoleIdFromUi();
    if (!roleId) {
      setOutput("Choose a role first.");
      return;
    }
    const existing = Array.isArray(state[fieldName]) ? state[fieldName] : [];
    if (!existing.includes(roleId)) {
      setOutput("Selected role is not listed.");
      return;
    }
    state[fieldName] = existing.filter(item => item !== roleId);
    updateChip();
    setOutput(successText);
  }
  function clearModerationRoleList(fieldName, updateChip, successText) {
    state[fieldName] = [];
    updateChip();
    setOutput(successText);
  }
  async function saveModerationSettings(outputText) {
    if (!state.selectedGuildId) {
      return void setOutput("Select a guild first.");
    }
    await request("/api/settings", {
      guildId: state.selectedGuildId,
      antiSpamEnabled: document.getElementById("anti-spam-enabled")?.checked === true,
      antiSpamApplyTimeouts: document.getElementById("anti-spam-timeouts")?.checked === true,
      antiSpamAnalyzeImages: document.getElementById("anti-spam-images")?.checked === true,
      antiSpamTextRulePatterns: parseRuleLines("anti-spam-text-rules"),
      antiSpamBlockedLinkPatterns: parseRuleLines("anti-spam-link-rules"),
      antiSpamImageScanChannelIds: state.antiSpamImageScanChannelIds,
      antiSpamExcludedChannelIds: state.antiSpamExcludedChannelIds,
      antiSpamExcludedRoleIds: state.antiSpamExcludedRoleIds,
      antiSpamAlertChannelId: state.antiSpamAlertChannelId || null,
      antiSpamTemporaryInvestigationHoldEnabled: document.getElementById("anti-spam-temp-hold-enabled")?.checked === true,
      antiSpamTemporaryInvestigationHoldMs: Math.max(0, Number.parseInt(document.getElementById("anti-spam-temp-hold-seconds")?.value || "0", 10) || 0) * 1000,
      antiSpamImageFlagSpam: document.getElementById("anti-spam-image-flag-spam")?.checked === true,
      antiSpamImageFlagNsfw: document.getElementById("anti-spam-image-flag-nsfw")?.checked === true,
      antiSpamImageFlagCryptoSpam: document.getElementById("anti-spam-image-flag-crypto-spam")?.checked === true,
      antiSpamImageFlagCryptoImage: document.getElementById("anti-spam-image-flag-crypto-image")?.checked === true,
      antiSpamDuplicateWindowMs: Math.max(5, Number.parseInt(document.getElementById("anti-spam-window-seconds")?.value || "60", 10) || 60) * 1000,
      antiSpamTimeoutMs: Math.max(1, Number.parseInt(document.getElementById("anti-spam-timeout-minutes")?.value || "10080", 10) || 10080) * 60000,
      honeypotEnabled: document.getElementById("honeypot-enabled")?.checked === true,
      honeypotChannelId: state.honeypotChannelId || null,
      honeypotTriggerOnText: document.getElementById("honeypot-trigger-text")?.checked === true,
      honeypotTriggerOnFiles: document.getElementById("honeypot-trigger-files")?.checked === true,
      honeypotTriggerOnLinks: document.getElementById("honeypot-trigger-links")?.checked === true,
      honeypotImmediateAction: document.getElementById("honeypot-immediate-action")?.value || "timeout",
      honeypotTimeoutMs: Math.max(1, Number.parseInt(document.getElementById("honeypot-timeout-minutes")?.value || "10080", 10) || 10080) * 60000,
      honeypotRemoveMessage: document.getElementById("honeypot-remove-message")?.checked === true,
      protectedUserIds: state.protectedUserIds,
      protectedRoleIds: state.protectedRoleIds,
      honeypotExcludedChannelIds: state.honeypotExcludedChannelIds,
      honeypotExcludedRoleIds: state.honeypotExcludedRoleIds,
      honeypotBackupChannelId: state.honeypotBackupChannelId || null,
      honeypotDmEnabled: document.getElementById("honeypot-dm-enabled")?.checked === true,
      honeypotDmMessage: document.getElementById("honeypot-dm-message")?.value || "",
      honeypotReviewChannelId: state.honeypotReviewChannelId || null,
      honeypotPostVerifyAction: document.getElementById("honeypot-post-verify-action")?.value || "remove-timeout",
      honeypotVerificationWindowMs: Math.max(1, Number.parseInt(document.getElementById("honeypot-verification-window-days")?.value || "7", 10) || 7) * 86400000,
      honeypotUnverifiedAction: document.getElementById("honeypot-unverified-action")?.value || "ban"
    });
    if (outputText) {
      setOutput(outputText);
    }
  }
  function bindModerationSettingsEvents() {
    const bindClick = (id, handler) => {
      const node = document.getElementById(id);
      if (node) {
        node.addEventListener("click", handler);
      }
    };
    bindClick("anti-spam-set-image-channel-button", () => {
      addSelectedModerationChannel("antiSpamImageScanChannelIds", updateImageScanChannelChip, "Added selected channel to the image scan list.");
    });
    bindClick("anti-spam-remove-image-channel-button", () => {
      removeSelectedModerationChannel("antiSpamImageScanChannelIds", updateImageScanChannelChip, "Removed selected channel from the image scan list.");
    });
    bindClick("anti-spam-clear-image-channel-button", () => {
      clearModerationChannelList("antiSpamImageScanChannelIds", updateImageScanChannelChip, "Cleared image scan channels.");
    });
    bindClick("anti-spam-add-excluded-channel-button", () => {
      addSelectedModerationChannel("antiSpamExcludedChannelIds", updateExcludedChannelChip, "Excluded selected channel from anti-spam checks.");
    });
    bindClick("anti-spam-remove-excluded-channel-button", () => {
      removeSelectedModerationChannel("antiSpamExcludedChannelIds", updateExcludedChannelChip, "Removed selected channel from excluded anti-spam channels.");
    });
    bindClick("anti-spam-clear-excluded-channels-button", () => {
      clearModerationChannelList("antiSpamExcludedChannelIds", updateExcludedChannelChip, "Cleared excluded anti-spam channels.");
    });
    bindClick("anti-spam-add-excluded-role-button", () => {
      addSelectedModerationRole("antiSpamExcludedRoleIds", updateExcludedRoleChip, "Excluded selected role from anti-spam checks.");
    });
    bindClick("anti-spam-remove-excluded-role-button", () => {
      removeSelectedModerationRole("antiSpamExcludedRoleIds", updateExcludedRoleChip, "Removed selected role from excluded anti-spam roles.");
    });
    bindClick("anti-spam-clear-excluded-roles-button", () => {
      clearModerationRoleList("antiSpamExcludedRoleIds", updateExcludedRoleChip, "Cleared excluded anti-spam roles.");
    });
    bindClick("anti-spam-set-alert-channel-button", () => {
      setSelectedModerationChannel("antiSpamAlertChannelId", updateAlertChannelChip, "Set moderation alert channel from the selected channel.");
    });
    bindClick("anti-spam-clear-alert-channel-button", () => {
      clearSelectedModerationChannel("antiSpamAlertChannelId", updateAlertChannelChip, "Disabled moderation alert channel.");
    });
    bindClick("honeypot-set-channel-button", () => {
      setSelectedModerationChannel("honeypotChannelId", updateHoneypotChannelChip, "Set honeypot channel from the selected channel.");
    });
    bindClick("honeypot-clear-channel-button", () => {
      clearSelectedModerationChannel("honeypotChannelId", updateHoneypotChannelChip, "Cleared honeypot channel.");
    });
    bindClick("honeypot-add-excluded-channel-button", () => {
      addSelectedModerationChannel("honeypotExcludedChannelIds", updateHoneypotExcludedChannelChip, "Whitelisted selected channel for honeypot.");
    });
    bindClick("honeypot-remove-excluded-channel-button", () => {
      removeSelectedModerationChannel("honeypotExcludedChannelIds", updateHoneypotExcludedChannelChip, "Removed selected channel from honeypot whitelist.");
    });
    bindClick("honeypot-clear-excluded-channels-button", () => {
      clearModerationChannelList("honeypotExcludedChannelIds", updateHoneypotExcludedChannelChip, "Cleared honeypot whitelisted channels.");
    });
    bindClick("honeypot-add-excluded-role-button", () => {
      addSelectedModerationRole("honeypotExcludedRoleIds", updateHoneypotExcludedRoleChip, "Whitelisted selected role for honeypot.");
    });
    bindClick("honeypot-remove-excluded-role-button", () => {
      removeSelectedModerationRole("honeypotExcludedRoleIds", updateHoneypotExcludedRoleChip, "Removed selected role from honeypot whitelist.");
    });
    bindClick("honeypot-clear-excluded-roles-button", () => {
      clearModerationRoleList("honeypotExcludedRoleIds", updateHoneypotExcludedRoleChip, "Cleared honeypot whitelisted roles.");
    });
    bindClick("honeypot-set-backup-channel-button", () => {
      setSelectedModerationChannel("honeypotBackupChannelId", updateHoneypotBackupChannelChip, "Set honeypot backup channel from the selected channel.");
    });
    bindClick("honeypot-clear-backup-channel-button", () => {
      clearSelectedModerationChannel("honeypotBackupChannelId", updateHoneypotBackupChannelChip, "Cleared honeypot backup channel.");
    });
    bindClick("honeypot-set-review-channel-button", () => {
      setSelectedModerationChannel("honeypotReviewChannelId", updateHoneypotReviewChannelChip, "Set honeypot review channel from the selected channel.");
    });
    bindClick("honeypot-clear-review-channel-button", () => {
      clearSelectedModerationChannel("honeypotReviewChannelId", updateHoneypotReviewChannelChip, "Cleared honeypot review channel.");
    });
    bindClick("save-anti-spam-button", async () => {
      await saveModerationSettings("Saved moderation rules.");
    });
  }
  return {
    getModel3dInitialExtraSampleText,
    getModel3dDestinationExtraSampleText,
    getScheduledModelPostOptionsModule,
    getAutomationScopeId,
    setHeroBotTag,
    loadSelectedGuildSettings,
    openChannelSettings,
    parseMediaReactionRulesJson,
    renderGuildPermissions,
    renderChannelPermissions,
    updateImageScanChannelChip,
    updateExcludedChannelChip,
    updateExcludedRoleChip,
    updateAlertChannelChip,
    updateProtectedUserChip,
    updateProtectedRoleChip,
    updateInvestigationRoleChip,
    updateTemporaryImageBlockRoleChip,
    fillMemberCounterChannelOptions,
    updateMemberCounterChip,
    getSelectedChatModeSettings,
    syncRoleSelectOptions,
    getSelectedRoleIdFromUi,
    getSelectedUserIdForChatMode,
    ensureGuildRolesLoaded,
    updateAutonomousStatusChannelChip,
    updateImagePoolVerifiedRoleChip,
    updateImagePoolVerifiedUserChip,
    updateChatModeRoleChip,
    updateChatModeUserChip,
    updateChatModeForm,
    updateChatModeDebugCard,
    loadChatModeDebug,
    bindModerationSettingsEvents,
    saveModerationSettings,
    updateSelectedChatModeSettings,
    persistSelectedChatModeSettings,
    sanitizeGuildScopedModerationSelections,
    sanitizeGuildScopedGuildSettings,
    updateHoneypotChannelChip,
    updateHoneypotBackupChannelChip,
    updateHoneypotReviewChannelChip
  };
}
