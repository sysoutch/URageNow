function createDashboardAutomationChannelHelpers(input) {
  const state = input?.state || {};
  const clearChildren = typeof input?.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback(node) {
    if (node) {
      node.innerHTML = "";
    }
  };
  const getScheduledModelPostOptionsModule = typeof input?.getScheduledModelPostOptionsModule === "function"
    ? input.getScheduledModelPostOptionsModule
    : () => null;
  const refreshModel3dPostDestinationOptions = typeof input?.refreshModel3dPostDestinationOptions === "function"
    ? input.refreshModel3dPostDestinationOptions
    : async function refreshModel3dPostDestinationOptionsFallback() {};
  const refreshStudioPostTargetOptions = typeof input?.refreshStudioPostTargetOptions === "function"
    ? input.refreshStudioPostTargetOptions
    : function refreshStudioPostTargetOptionsFallback() {};
  const updateAutomationTargetChipsBase = typeof input?.updateAutomationTargetChipsBase === "function"
    ? input.updateAutomationTargetChipsBase
    : function updateAutomationTargetChipsBaseFallback() {};
  const updateScheduledTargetModeUi = typeof input?.updateScheduledTargetModeUi === "function"
    ? input.updateScheduledTargetModeUi
    : function updateScheduledTargetModeUiFallback() {};

  function isForumChannel(channel) {
    return Boolean(channel && String(channel.kind || "").toLowerCase().includes("forum"));
  }

  function isSendableTargetChannel(channel) {
    return Boolean(channel && channel.canSendMessages && !channel.isVoice && !isForumChannel(channel));
  }

  function buildChannelOptionLabel(channel) {
    if (!channel) {
      return "Unknown channel";
    }
    if (isForumChannel(channel)) {
      return "Forum " + channel.name + " | " + channel.id;
    }
    const prefix = channel.isVoice ? "Voice " : "#";
    return prefix + channel.name + " | " + channel.id;
  }

  function refillChannelSelect(selectId, options, emptyLabel, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) {
      return;
    }
    clearChildren(select);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = emptyLabel;
    select.appendChild(emptyOption);
    for (const channel of options) {
      const option = document.createElement("option");
      option.value = channel.id;
      option.textContent = buildChannelOptionLabel(channel);
      select.appendChild(option);
    }
    const normalized = String(selectedValue || "").trim();
    select.value = normalized && options.some(channel => channel.id === normalized) ? normalized : "";
  }

  function refreshAutomationAndModelChannelSelectors() {
    const channels = Array.isArray(state.channels) ? state.channels : [];
    const sendableChannels = channels.filter(isSendableTargetChannel);
    const forumChannels = channels.filter(isForumChannel);
    refillChannelSelect("scheduled-target-channel-select", sendableChannels, "Choose channel", state.scheduledTargetChannelId || state.selectedChannelId || "");
    refillChannelSelect("join-target-channel-select", sendableChannels, "Choose channel", state.joinTargetChannelId || state.selectedChannelId || "");
    refillChannelSelect("model3d-forum-channel-id", forumChannels, "Choose forum channel below", document.getElementById("model3d-forum-channel-id")?.value || "");
    refillChannelSelect("model3d-lowpoly-forum-channel-id", forumChannels, "Post lowpoly in same destination", document.getElementById("model3d-lowpoly-forum-channel-id")?.value || "");
    refillChannelSelect("scheduled-image-forum-channel-id", forumChannels, "Choose forum channel below", document.getElementById("scheduled-image-forum-channel-id")?.value || "");
    refillChannelSelect("scheduled-model-forum-channel-id", forumChannels, "Choose forum channel below", document.getElementById("scheduled-model-forum-channel-id")?.value || "");
    refillChannelSelect("scheduled-model-lowpoly-forum-channel-id", forumChannels, "Post lowpoly in same destination", document.getElementById("scheduled-model-lowpoly-forum-channel-id")?.value || "");
    getScheduledModelPostOptionsModule()?.refreshImageVariantTargetBuilder?.();
    void refreshModel3dPostDestinationOptions();
    refreshStudioPostTargetOptions();
  }

  function updateAutomationTargetChips() {
    updateAutomationTargetChipsBase();
    updateScheduledTargetModeUi();
    refreshAutomationAndModelChannelSelectors();
  }

  return {
    refreshAutomationAndModelChannelSelectors,
    updateAutomationTargetChips
  };
}
