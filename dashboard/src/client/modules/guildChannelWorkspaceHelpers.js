function createGuildChannelWorkspaceHelpers(input) {
  const state = input?.state || {};
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const renderMarkdownInto = typeof input?.renderMarkdownInto === "function" ? input.renderMarkdownInto : function renderMarkdownIntoFallback() {};
  const switchView = typeof input?.switchView === "function" ? input.switchView : function switchViewFallback() {};
  const switchSubview = typeof input?.switchSubview === "function" ? input.switchSubview : function switchSubviewFallback() {};
  const openChannelSettings = typeof input?.openChannelSettings === "function" ? input.openChannelSettings : function openChannelSettingsFallback() {};
  const loadBotMessages = typeof input?.loadBotMessages === "function" ? input.loadBotMessages : async function loadBotMessagesFallback() {};
  const ensureGuildRolesLoaded = typeof input?.ensureGuildRolesLoaded === "function" ? input.ensureGuildRolesLoaded : async function ensureGuildRolesLoadedFallback() {};
  const getSelectedRoleIdFromUi = typeof input?.getSelectedRoleIdFromUi === "function" ? input.getSelectedRoleIdFromUi : () => "";
  const getSelectedChatModeSettings = typeof input?.getSelectedChatModeSettings === "function" ? input.getSelectedChatModeSettings : () => ({ allowedRoleIds: [], allowedUserIds: [] });
  const updateSelectedChatModeSettings = typeof input?.updateSelectedChatModeSettings === "function" ? input.updateSelectedChatModeSettings : function updateSelectedChatModeSettingsFallback() {};
  const persistSelectedChatModeSettings = typeof input?.persistSelectedChatModeSettings === "function"
    ? input.persistSelectedChatModeSettings
    : async function persistSelectedChatModeSettingsFallback() {};
  const getSelectedUserIdForChatMode = typeof input?.getSelectedUserIdForChatMode === "function" ? input.getSelectedUserIdForChatMode : () => "";
  const updateImagePoolVerifiedRoleChip = typeof input?.updateImagePoolVerifiedRoleChip === "function"
    ? input.updateImagePoolVerifiedRoleChip
    : function updateImagePoolVerifiedRoleChipFallback() {};
  const updateImagePoolVerifiedUserChip = typeof input?.updateImagePoolVerifiedUserChip === "function"
    ? input.updateImagePoolVerifiedUserChip
    : function updateImagePoolVerifiedUserChipFallback() {};
  const updateProtectedRoleChip = typeof input?.updateProtectedRoleChip === "function"
    ? input.updateProtectedRoleChip
    : function updateProtectedRoleChipFallback() {};
  const updateProtectedUserChip = typeof input?.updateProtectedUserChip === "function"
    ? input.updateProtectedUserChip
    : function updateProtectedUserChipFallback() {};

  function bindClick(id, handler) {
    const node = document.getElementById(id);
    if (node) {
      node.addEventListener("click", handler);
    }
  }

  function requireSelectedGuild() {
    if (!state.selectedGuildId) {
      setOutput("Select a guild first.");
      return false;
    }
    return true;
  }

  function requireSelectedChannel() {
    if (!requireSelectedGuild()) {
      return false;
    }
    if (!state.selectedChannelId) {
      setOutput("Select a channel first.");
      return false;
    }
    return true;
  }

  function requireSelectedRole() {
    const roleId = getSelectedRoleIdFromUi();
    if (!roleId) {
      setOutput("Choose a role first in Guild > Overview > Role Actions.");
      return "";
    }
    return roleId;
  }

  function requireSelectedChatModeUser() {
    const userId = getSelectedUserIdForChatMode();
    if (!userId) {
      setOutput("Select a user first in the right-side user panel.");
      return "";
    }
    return userId;
  }

  async function saveImagePoolAccessSettings() {
    await request("/api/guild-settings", {
      guildId: state.selectedGuildId,
      imagePoolVerifiedRoleIds: state.imagePoolVerifiedRoleIds,
      imagePoolVerifiedUserIds: state.imagePoolVerifiedUserIds
    });
  }

  async function saveProtectedMemberSettings() {
    await request("/api/settings", {
      guildId: state.selectedGuildId,
      protectedUserIds: state.protectedUserIds,
      protectedRoleIds: state.protectedRoleIds
    });
  }

  async function refreshSelectedChannelBotMessages(outputText) {
    if (!requireSelectedChannel()) {
      return;
    }
    await loadBotMessages();
    setOutput(outputText);
  }

  async function saveSelectedBotMessage() {
    if (!requireSelectedChannel()) {
      return;
    }
    if (!state.selectedBotMessageId) {
      return void setOutput("Select a recent bot message first.");
    }
    const editor = document.getElementById("bot-message-edit-text");
    const content = editor ? editor.value : "";
    if (!content.trim()) {
      return void setOutput("Edited bot message content cannot be empty.");
    }
    const edited = await request("/api/edit-bot-message", {
      channelId: state.selectedChannelId,
      messageId: state.selectedBotMessageId,
      content
    });
    state.selectedBotMessageId = edited && edited.id ? edited.id : state.selectedBotMessageId;
    await loadBotMessages();
    setOutput("Bot message updated.");
  }

  async function addChatModeRole() {
    if (!requireSelectedChannel()) {
      return;
    }
    await ensureGuildRolesLoaded();
    const roleId = requireSelectedRole();
    if (!roleId) {
      return;
    }
    if (!state.roles.some(item => item.id === roleId)) {
      return void setOutput("Selected role is not available in this server.");
    }
    const current = getSelectedChatModeSettings();
    if (current.allowedRoleIds.includes(roleId)) {
      return void setOutput("Selected role is already allowed.");
    }
    updateSelectedChatModeSettings({ allowedRoleIds: [...current.allowedRoleIds, roleId] });
    await persistSelectedChatModeSettings("Added selected role to chat mode allow-list.");
  }

  async function removeChatModeRole() {
    if (!requireSelectedChannel()) {
      return;
    }
    const roleId = requireSelectedRole();
    if (!roleId) {
      return;
    }
    const current = getSelectedChatModeSettings();
    if (!current.allowedRoleIds.includes(roleId)) {
      return void setOutput("Selected role is not in the allow-list.");
    }
    updateSelectedChatModeSettings({ allowedRoleIds: current.allowedRoleIds.filter(item => item !== roleId) });
    await persistSelectedChatModeSettings("Removed selected role from chat mode allow-list.");
  }

  async function clearChatModeRoles() {
    if (!requireSelectedChannel()) {
      return;
    }
    const current = getSelectedChatModeSettings();
    if (!Array.isArray(current.allowedRoleIds) || current.allowedRoleIds.length === 0) {
      return void setOutput("No allowed roles to clear.");
    }
    updateSelectedChatModeSettings({ allowedRoleIds: [] });
    await persistSelectedChatModeSettings("Cleared chat mode role allow-list.");
  }

  async function addChatModeUser() {
    if (!requireSelectedChannel()) {
      return;
    }
    const userId = requireSelectedChatModeUser();
    if (!userId) {
      return;
    }
    const current = getSelectedChatModeSettings();
    if (current.allowedUserIds.includes(userId)) {
      return void setOutput("Selected user is already allowed.");
    }
    updateSelectedChatModeSettings({ allowedUserIds: [...current.allowedUserIds, userId] });
    await persistSelectedChatModeSettings("Added selected user to chat mode allow-list.");
  }

  async function removeChatModeUser() {
    if (!requireSelectedChannel()) {
      return;
    }
    const userId = requireSelectedChatModeUser();
    if (!userId) {
      return;
    }
    const current = getSelectedChatModeSettings();
    if (!current.allowedUserIds.includes(userId)) {
      return void setOutput("Selected user is not in the allow-list.");
    }
    updateSelectedChatModeSettings({ allowedUserIds: current.allowedUserIds.filter(item => item !== userId) });
    await persistSelectedChatModeSettings("Removed selected user from chat mode allow-list.");
  }

  async function clearChatModeUsers() {
    if (!requireSelectedChannel()) {
      return;
    }
    const current = getSelectedChatModeSettings();
    if (!Array.isArray(current.allowedUserIds) || current.allowedUserIds.length === 0) {
      return void setOutput("No allowed users to clear.");
    }
    updateSelectedChatModeSettings({ allowedUserIds: [] });
    await persistSelectedChatModeSettings("Cleared chat mode user allow-list.");
  }

  async function addImagePoolRole() {
    if (!requireSelectedGuild()) {
      return;
    }
    await ensureGuildRolesLoaded();
    const roleId = requireSelectedRole();
    if (!roleId) {
      return;
    }
    if (!state.roles.some(item => item.id === roleId)) {
      return void setOutput("Selected role is not available in this server.");
    }
    if ((state.imagePoolVerifiedRoleIds || []).includes(roleId)) {
      return void setOutput("Selected role already has verified pool access.");
    }
    state.imagePoolVerifiedRoleIds = [...(state.imagePoolVerifiedRoleIds || []), roleId];
    updateImagePoolVerifiedRoleChip();
    await saveImagePoolAccessSettings();
    setOutput("Added selected role to verified image pool access.");
  }

  async function removeImagePoolRole() {
    if (!requireSelectedGuild()) {
      return;
    }
    const roleId = requireSelectedRole();
    if (!roleId) {
      return;
    }
    if (!(state.imagePoolVerifiedRoleIds || []).includes(roleId)) {
      return void setOutput("Selected role does not have verified pool access.");
    }
    state.imagePoolVerifiedRoleIds = state.imagePoolVerifiedRoleIds.filter(item => item !== roleId);
    updateImagePoolVerifiedRoleChip();
    await saveImagePoolAccessSettings();
    setOutput("Removed selected role from verified image pool access.");
  }

  async function clearImagePoolRoles() {
    if (!requireSelectedGuild()) {
      return;
    }
    if (!Array.isArray(state.imagePoolVerifiedRoleIds) || state.imagePoolVerifiedRoleIds.length === 0) {
      return void setOutput("No verified image-pool roles to clear.");
    }
    state.imagePoolVerifiedRoleIds = [];
    updateImagePoolVerifiedRoleChip();
    await saveImagePoolAccessSettings();
    setOutput("Cleared verified image pool roles.");
  }

  async function addImagePoolUser() {
    if (!requireSelectedGuild()) {
      return;
    }
    const userId = requireSelectedChatModeUser();
    if (!userId) {
      return;
    }
    if ((state.imagePoolVerifiedUserIds || []).includes(userId)) {
      return void setOutput("Selected user already has verified pool access.");
    }
    state.imagePoolVerifiedUserIds = [...(state.imagePoolVerifiedUserIds || []), userId];
    updateImagePoolVerifiedUserChip();
    await saveImagePoolAccessSettings();
    setOutput("Added selected user to verified image pool access.");
  }

  async function removeImagePoolUser() {
    if (!requireSelectedGuild()) {
      return;
    }
    const userId = requireSelectedChatModeUser();
    if (!userId) {
      return;
    }
    if (!(state.imagePoolVerifiedUserIds || []).includes(userId)) {
      return void setOutput("Selected user does not have verified pool access.");
    }
    state.imagePoolVerifiedUserIds = state.imagePoolVerifiedUserIds.filter(item => item !== userId);
    updateImagePoolVerifiedUserChip();
    await saveImagePoolAccessSettings();
    setOutput("Removed selected user from verified image pool access.");
  }

  async function clearImagePoolUsers() {
    if (!requireSelectedGuild()) {
      return;
    }
    if (!Array.isArray(state.imagePoolVerifiedUserIds) || state.imagePoolVerifiedUserIds.length === 0) {
      return void setOutput("No verified image-pool users to clear.");
    }
    state.imagePoolVerifiedUserIds = [];
    updateImagePoolVerifiedUserChip();
    await saveImagePoolAccessSettings();
    setOutput("Cleared verified image pool users.");
  }

  async function addProtectedRole() {
    if (!requireSelectedGuild()) {
      return;
    }
    await ensureGuildRolesLoaded();
    const roleId = requireSelectedRole();
    if (!roleId) {
      return;
    }
    if (!state.roles.some(item => item.id === roleId)) {
      return void setOutput("Selected role is not available in this server.");
    }
    if ((state.protectedRoleIds || []).includes(roleId)) {
      return void setOutput("Selected role is already protected.");
    }
    state.protectedRoleIds = [...(state.protectedRoleIds || []), roleId];
    updateProtectedRoleChip();
    await saveProtectedMemberSettings();
    setOutput("Added selected role to protected members.");
  }

  async function removeProtectedRole() {
    if (!requireSelectedGuild()) {
      return;
    }
    const roleId = requireSelectedRole();
    if (!roleId) {
      return;
    }
    if (!(state.protectedRoleIds || []).includes(roleId)) {
      return void setOutput("Selected role is not protected.");
    }
    state.protectedRoleIds = state.protectedRoleIds.filter(item => item !== roleId);
    updateProtectedRoleChip();
    await saveProtectedMemberSettings();
    setOutput("Removed selected role from protected members.");
  }

  async function clearProtectedRoles() {
    if (!requireSelectedGuild()) {
      return;
    }
    if (!Array.isArray(state.protectedRoleIds) || state.protectedRoleIds.length === 0) {
      return void setOutput("No protected roles to clear.");
    }
    state.protectedRoleIds = [];
    updateProtectedRoleChip();
    await saveProtectedMemberSettings();
    setOutput("Cleared protected roles.");
  }

  async function addProtectedUser() {
    if (!requireSelectedGuild()) {
      return;
    }
    const userId = requireSelectedChatModeUser();
    if (!userId) {
      return;
    }
    if ((state.protectedUserIds || []).includes(userId)) {
      return void setOutput("Selected user is already protected.");
    }
    state.protectedUserIds = [...(state.protectedUserIds || []), userId];
    updateProtectedUserChip();
    await saveProtectedMemberSettings();
    setOutput("Added selected user to protected members.");
  }

  async function removeProtectedUser() {
    if (!requireSelectedGuild()) {
      return;
    }
    const userId = requireSelectedChatModeUser();
    if (!userId) {
      return;
    }
    if (!(state.protectedUserIds || []).includes(userId)) {
      return void setOutput("Selected user is not protected.");
    }
    state.protectedUserIds = state.protectedUserIds.filter(item => item !== userId);
    updateProtectedUserChip();
    await saveProtectedMemberSettings();
    setOutput("Removed selected user from protected members.");
  }

  async function clearProtectedUsers() {
    if (!requireSelectedGuild()) {
      return;
    }
    if (!Array.isArray(state.protectedUserIds) || state.protectedUserIds.length === 0) {
      return void setOutput("No protected users to clear.");
    }
    state.protectedUserIds = [];
    updateProtectedUserChip();
    await saveProtectedMemberSettings();
    setOutput("Cleared protected users.");
  }

  async function saveChatModeSettings() {
    if (!requireSelectedChannel()) {
      return;
    }
    const cooldown = Math.max(0, Number.parseInt(document.getElementById("chat-mode-cooldown-seconds").value, 10) || 0);
    updateSelectedChatModeSettings({
      enabled: document.getElementById("chat-mode-enabled").checked,
      requireMentionOrReply: document.getElementById("chat-mode-require-mention").checked,
      cooldownSeconds: cooldown,
      systemPrompt: document.getElementById("chat-mode-system-prompt").value || ""
    });
    await persistSelectedChatModeSettings("Saved selected channel chat mode.");
  }

  function bindEvents() {
    bindClick("refresh-bot-messages-button", async () => {
      await refreshSelectedChannelBotMessages("Loaded recent bot messages for the selected channel.");
    });
    bindClick("save-bot-message-button", async () => {
      await saveSelectedBotMessage();
    });
    document.getElementById("bot-message-edit-text")?.addEventListener("input", event => {
      renderMarkdownInto(
        "bot-message-preview",
        event && event.target ? event.target.value || "" : "",
        "Select a recent bot message to preview it here."
      );
    });
    bindClick("detail-open-messaging-button", () => {
      switchView("messaging");
    });
    bindClick("detail-open-channel-settings-button", () => {
      switchView("guild");
      switchSubview("guild", "guild-channels");
      if (state.selectedChannelId) {
        openChannelSettings(state.selectedChannelId);
      }
    });
    bindClick("detail-refresh-bot-messages-button", async () => {
      await refreshSelectedChannelBotMessages("Loaded recent bot messages for the selected channel.");
    });
    document.getElementById("role-select")?.addEventListener("change", event => {
      state.selectedRoleId = event.currentTarget && typeof event.currentTarget.value === "string"
        ? event.currentTarget.value.trim()
        : "";
    });
    bindClick("chat-mode-add-role-button", async () => {
      await addChatModeRole();
    });
    bindClick("chat-mode-remove-role-button", async () => {
      await removeChatModeRole();
    });
    bindClick("chat-mode-clear-roles-button", async () => {
      await clearChatModeRoles();
    });
    bindClick("chat-mode-add-user-button", async () => {
      await addChatModeUser();
    });
    bindClick("chat-mode-remove-user-button", async () => {
      await removeChatModeUser();
    });
    bindClick("chat-mode-clear-users-button", async () => {
      await clearChatModeUsers();
    });
    bindClick("image-pool-add-role-button", async () => {
      await addImagePoolRole();
    });
    bindClick("image-pool-remove-role-button", async () => {
      await removeImagePoolRole();
    });
    bindClick("image-pool-clear-roles-button", async () => {
      await clearImagePoolRoles();
    });
    bindClick("image-pool-add-user-button", async () => {
      await addImagePoolUser();
    });
    bindClick("image-pool-remove-user-button", async () => {
      await removeImagePoolUser();
    });
    bindClick("image-pool-clear-users-button", async () => {
      await clearImagePoolUsers();
    });
    bindClick("protected-add-role-button", async () => {
      await addProtectedRole();
    });
    bindClick("protected-remove-role-button", async () => {
      await removeProtectedRole();
    });
    bindClick("protected-clear-roles-button", async () => {
      await clearProtectedRoles();
    });
    bindClick("protected-add-user-button", async () => {
      await addProtectedUser();
    });
    bindClick("protected-remove-user-button", async () => {
      await removeProtectedUser();
    });
    bindClick("protected-clear-users-button", async () => {
      await clearProtectedUsers();
    });
    bindClick("save-chat-mode-button", async () => {
      await saveChatModeSettings();
    });
  }

  return {
    bindEvents
  };
}
