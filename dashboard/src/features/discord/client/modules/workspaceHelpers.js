function createDashboardDiscordWorkspaceHelpers(input) {
  function setNodeText(id, text) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = text;
    }
  }

  function getDefaultTextChannelId() {
    const firstTextChannel = input.state.channels.find(item => item.canSendMessages);
    return firstTextChannel ? firstTextChannel.id : "";
  }

  function getGuildShortLabel(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    const letters = (parts.length > 1 ? parts.slice(0, 2).map(part => part[0]) : [String(name || "").trim().slice(0, 2)]).join("");
    return (letters || "?").toUpperCase();
  }

  function getUserSearchQuery() {
    const inputNode = document.getElementById("user-search");
    return inputNode && typeof inputNode.value === "string" ? inputNode.value.trim() : "";
  }

  function setUserResultsSummary(text) {
    const summary = document.getElementById("user-results-summary");
    if (summary) {
      summary.textContent = text;
    }
  }

  function applySelectedUser(user) {
    input.state.selectedUserId = user ? user.id : "";
    input.state.selectedUser = user || null;
    const chip = document.getElementById("user-chip");
    const cardTitle = document.querySelector("#selected-user-card .selected-user-title");
    if (cardTitle) {
      cardTitle.textContent = user ? user.displayName : "No user selected";
    }
    if (chip) {
      chip.textContent = user ? user.tag + " | " + user.id : "Pick a cached or fetched member to use them across Discrod.";
    }
    updateSelectionDetails();
    input.updateChatModeUserChip();
    if (typeof input.updateImagePoolVerifiedUserChip === "function") {
      input.updateImagePoolVerifiedUserChip();
    }
  }

  function renderUserResults() {
    const container = document.getElementById("user-results");
    if (!container) {
      return;
    }
    input.clearChildren(container);
    if (!input.state.users || input.state.users.length === 0) {
      setUserResultsSummary("No users loaded yet.");
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No cached users yet.";
      container.appendChild(empty);
      return;
    }
    setUserResultsSummary("Showing " + input.state.users.length + " cached user" + (input.state.users.length === 1 ? "" : "s") + ".");
    for (const user of input.state.users) {
      const card = document.createElement("div");
      card.className = "user-result-card";
      const top = document.createElement("div");
      top.className = "user-result-top";
      const copy = document.createElement("div");
      copy.className = "user-result-copy";
      const name = document.createElement("div");
      name.className = "user-result-name";
      name.textContent = user.displayName || user.username || user.tag || user.id;
      const tag = document.createElement("div");
      tag.className = "user-result-tag";
      tag.textContent = user.tag || user.id;
      copy.appendChild(name);
      copy.appendChild(tag);
      const actions = document.createElement("div");
      actions.className = "user-result-actions";
      const selectButton = document.createElement("button");
      selectButton.textContent = "Use";
      selectButton.addEventListener("click", () => applySelectedUser(user));
      const copyButton = document.createElement("button");
      copyButton.className = "secondary";
      copyButton.textContent = "Copy ID";
      copyButton.addEventListener("click", () => {
        void navigator.clipboard?.writeText(user.id || "");
        input.setOutput("Copied user ID to clipboard.");
      });
      actions.appendChild(selectButton);
      actions.appendChild(copyButton);
      top.appendChild(copy);
      top.appendChild(actions);
      const meta = document.createElement("div");
      meta.className = "user-result-meta";
      meta.textContent = user.id || "";
      card.appendChild(top);
      card.appendChild(meta);
      container.appendChild(card);
    }
  }

  async function loadUsers(mode) {
    if (!input.state.selectedGuildId) {
      input.state.users = [];
      renderUserResults();
      return;
    }
    const query = getUserSearchQuery();
    if (!query) {
      setUserResultsSummary("Type a name, tag, or ID first.");
      input.state.users = [];
      renderUserResults();
      return;
    }
    const isFetch = mode === "fetch";
    const payload = isFetch
      ? await input.request("/api/users/fetch", { guildId: input.state.selectedGuildId, query })
      : await input.request("/api/users?guildId=" + encodeURIComponent(input.state.selectedGuildId) + "&query=" + encodeURIComponent(query));
    input.state.users = Array.isArray(payload) ? payload : [];
    renderUserResults();
    input.setOutput(isFetch ? "Fetched users from Discord." : "Loaded cached users.");
  }

  function getChannelIcon(channel) {
    if (channel.isVoice) return "♪";
    if (String(channel.kind).toLowerCase().includes("forum")) return "◫";
    if (String(channel.kind).toLowerCase().includes("announcement")) return "!";
    if (String(channel.kind).toLowerCase().includes("thread")) return "↳";
    return "#";
  }

  function getChannelGroups() {
    const groups = [];
    const map = new Map();
    for (const channel of input.state.channels) {
      const key = channel.parentId || "__uncategorized__";
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          parentId: channel.parentId || null,
          label: channel.parentName || "Channels",
          channels: []
        };
        map.set(key, group);
        groups.push(group);
      }
      group.channels.push(channel);
    }
    return groups;
  }

  function toggleChannelGroup(groupKey) {
    input.state.collapsedChannelGroups[groupKey] = !input.state.collapsedChannelGroups[groupKey];
    renderChannelBrowser();
  }

  async function loadChannels() {
    if (!input.state.selectedGuildId) {
      input.state.channels = [];
      input.state.channelsGuildId = "";
      input.state.roles = [];
      input.state.selectedChannelId = "";
      input.state.selectedRoleId = "";
      if (typeof input.onChannelsLoaded === "function") {
        input.onChannelsLoaded(0);
      }
      renderChannelBrowser();
      if (typeof input.updateChatModeForm === "function") {
        input.updateChatModeForm();
      }
      return;
    }
    const [channelPayload, rolePayload] = await Promise.all([
      input.request("/api/channels?guildId=" + encodeURIComponent(input.state.selectedGuildId)),
      input.request("/api/roles?guildId=" + encodeURIComponent(input.state.selectedGuildId))
    ]);
    input.state.channels = Array.isArray(channelPayload) ? channelPayload : [];
    input.state.channelsGuildId = input.state.selectedGuildId;
    input.state.roles = Array.isArray(rolePayload) ? rolePayload : [];
    if (!input.state.roles.some(item => item.id === input.state.selectedRoleId)) {
      input.state.selectedRoleId = "";
    }
    if (!input.state.channels.some(item => item.id === input.state.selectedChannelId)) {
      input.state.selectedChannelId = getDefaultTextChannelId();
    }
    renderChannelBrowser();
    if (typeof input.updateChatModeForm === "function") {
      input.updateChatModeForm();
    }
    if (typeof input.updateImagePoolVerifiedRoleChip === "function") {
      input.updateImagePoolVerifiedRoleChip();
    }
    if (typeof input.onChannelsLoaded === "function") {
      input.onChannelsLoaded(input.state.channels.length);
    }
  }

  async function reorderSidebarChannel(channelId, parentId, position) {
    if (!input.state.selectedGuildId) {
      return;
    }
    await input.request("/api/channels/reorder", {
      guildId: input.state.selectedGuildId,
      kind: "channel",
      channelId,
      parentId,
      position
    });
    await loadChannels();
    input.setOutput("Channel order updated.");
  }

  async function reorderSidebarCategory(channelId, position) {
    if (!input.state.selectedGuildId) {
      return;
    }
    await input.request("/api/channels/reorder", {
      guildId: input.state.selectedGuildId,
      kind: "category",
      channelId,
      position
    });
    await loadChannels();
    input.setOutput("Category order updated.");
  }

  function renderGuildRail() {
    const container = document.getElementById("guild-rail-list");
    input.clearChildren(container);
    if (input.state.guilds.length === 0) {
      const empty = document.createElement("div");
      empty.className = "guild-rail-button";
      empty.title = "No guilds";
      empty.innerHTML = "<span class='guild-rail-avatar'>?</span>";
      container.appendChild(empty);
      return;
    }
    for (const guild of input.state.guilds) {
      const button = document.createElement("button");
      button.className = "guild-rail-button" + (guild.id === input.state.selectedGuildId ? " active" : "");
      button.title = guild.name;
      button.setAttribute("aria-label", guild.name);
      if (guild.iconUrl) {
        const image = document.createElement("img");
        image.className = "guild-rail-icon";
        image.src = guild.iconUrl;
        image.alt = guild.name;
        button.appendChild(image);
      } else {
        button.innerHTML = "<span class='guild-rail-avatar'>" + getGuildShortLabel(guild.name) + "</span>";
      }
      button.addEventListener("click", async () => {
        if (input.state.selectedGuildId === guild.id) {
          return;
        }
        await selectGuild(guild.id, { hydrate: true });
        input.setOutput("Switched to guild " + guild.name + ".");
      });
      container.appendChild(button);
    }
  }

  async function selectGuild(guildId, options) {
    const guild = input.state.guilds.find(item => item.id === guildId);
    if (!guild) {
      return;
    }
    const shouldHydrate = !options || options.hydrate !== false;
    input.state.selectedGuildId = guildId;
    input.state.selectedChannelId = "";
    renderGuildRail();
    if (shouldHydrate) {
      await loadChannels();
      if (typeof input.loadGuildSettings === "function") {
        await input.loadGuildSettings();
      }
    } else {
      input.state.channels = [];
      input.state.channelsGuildId = "";
      input.state.roles = [];
      input.state.selectedRoleId = "";
      if (typeof input.onChannelsLoaded === "function") {
        input.onChannelsLoaded(0);
      }
      renderChannelBrowser();
    }
    updateSelectionDetails();
    if (shouldHydrate && typeof input.refreshAutomationAndModelChannelSelectors === "function") {
      input.refreshAutomationAndModelChannelSelectors();
    }
    if (shouldHydrate && typeof input.loadAutomations === "function") {
      await input.loadAutomations();
    }
  }

  function buildChannelFlagList(channel) {
    if (!channel) {
      return "None";
    }
    const flags = [];
    if (channel.settingsEditable) {
      flags.push("Editable");
    }
    if (channel.canSendMessages) {
      flags.push("Sendable");
    }
    if (input.state.chatModeChannels[channel.id]?.enabled) {
      flags.push("Chat Mode");
    }
    if (input.state.autonomousStatusChannelId === channel.id) {
      flags.push("Pulse");
    }
    return flags.length > 0 ? flags.join(", ") : "None";
  }

  function renderChannelMemberFocus(channel) {
    const summary = document.getElementById("detail-channel-members-summary");
    const container = document.getElementById("detail-channel-members");
    if (!container || !summary) {
      return;
    }
    input.clearChildren(container);
    if (!channel) {
      summary.textContent = "Pick a text channel to see member context.";
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No channel selected yet.";
      container.appendChild(empty);
      return;
    }
    if (channel.connectedMembers && channel.connectedMembers.length > 0) {
      summary.textContent = channel.connectedMembers.length + " live member" + (channel.connectedMembers.length === 1 ? "" : "s") + " in this channel.";
      for (const member of channel.connectedMembers) {
        const row = document.createElement("div");
        row.className = "selected-user-card";
        row.innerHTML = "<div class='selected-user-title'>" + input.escapeHtml(member.displayName) + "</div><div class='selected-user-meta'>" + input.escapeHtml(member.tag) + "</div>";
        container.appendChild(row);
      }
      return;
    }
    summary.textContent = "Text channels do not load a live member list by default. Use the cached user tools below when you want to pin someone into the current context.";
    const empty = document.createElement("div");
    empty.className = "item";
    empty.textContent = "No live member list for this channel.";
    container.appendChild(empty);
  }

  function updateSelectionDetails() {
    const guild = input.state.guilds.find(item => item.id === input.state.selectedGuildId);
    const channel = input.state.channels.find(item => item.id === input.state.selectedChannelId && item.canSendMessages);
    const user = input.state.selectedUser || input.state.users.find(item => item.id === input.state.selectedUserId) || null;
    const guildDescription = guild && guild.description ? guild.description : "No server description available.";
    const detailChannelName = document.getElementById("detail-channel-name");
    if (detailChannelName) {
      detailChannelName.textContent = channel ? "#" + channel.name : "None";
    }
    const detailChannelKind = document.getElementById("detail-channel-kind");
    if (detailChannelKind) {
      detailChannelKind.textContent = channel ? channel.kind : "None";
    }
    const detailChannelParent = document.getElementById("detail-channel-parent");
    if (detailChannelParent) {
      detailChannelParent.textContent = channel ? (channel.parentName || "No category") : "None";
    }
    const detailChannelSendState = document.getElementById("detail-channel-send-state");
    if (detailChannelSendState) {
      detailChannelSendState.textContent = channel ? (channel.canSendMessages ? "Bot can post here" : "Bot cannot post here") : "Unavailable";
    }
    const detailChannelFlags = document.getElementById("detail-channel-flags");
    if (detailChannelFlags) {
      detailChannelFlags.textContent = buildChannelFlagList(channel);
    }
    const detailChannelId = document.getElementById("detail-channel-id");
    if (detailChannelId) {
      detailChannelId.textContent = channel ? channel.id : "None";
    }
    const detailChannelHint = document.getElementById("detail-channel-hint");
    if (detailChannelHint) {
      detailChannelHint.textContent = channel ? "Viewing details for #" + channel.name + "." : "Pick a text channel to see more details.";
    }
    const detailUserName = document.getElementById("detail-user-name");
    if (detailUserName) {
      detailUserName.textContent = user ? user.displayName : "None";
    }
    const detailUserTag = document.getElementById("detail-user-tag");
    if (detailUserTag) {
      detailUserTag.textContent = user ? user.tag : "None";
    }
    renderChannelMemberFocus(channel);
    setNodeText("sidebar-guild-title", guild ? guild.name : "Discrod");
    setNodeText("sidebar-guild-description", guild ? guildDescription : "Select a server to see its description.");
    setNodeText("channel-settings-chip", channel ? "#" + channel.name + " | " + channel.kind + " | " + channel.id : "No text channel selected");
    const messagingChannelChip = document.getElementById("messaging-selected-channel-chip");
    if (messagingChannelChip) {
      messagingChannelChip.textContent = channel ? "#" + channel.name : "No channel selected";
    }
    const messagingUserChip = document.getElementById("messaging-selected-user-chip");
    if (messagingUserChip) {
      messagingUserChip.textContent = user ? user.displayName + " | " + user.tag : "No user selected";
    }
  }

  function renderChannelBrowser() {
    const container = document.getElementById("channel-browser");
    input.clearChildren(container);
    if (input.state.channels.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No channels available.";
      container.appendChild(empty);
      return;
    }
    const groups = getChannelGroups();
    groups.forEach((groupEntry, groupIndex) => {
      const group = document.createElement("div");
      group.className = "channel-group";
      const label = document.createElement("div");
      label.className = "channel-group-label";
      label.innerHTML = "<button class='channel-group-toggle' type='button'><span class='channel-group-chevron'>" + (input.state.collapsedChannelGroups[groupEntry.key] ? ">" : "v") + "</span><span>" + input.escapeHtml(groupEntry.label) + "</span></button>";
      const toggleButton = label.querySelector(".channel-group-toggle");
      toggleButton.addEventListener("click", () => {
        toggleChannelGroup(groupEntry.key);
      });
      if (groupEntry.parentId) {
        label.draggable = true;
        label.classList.add("channel-group-label-draggable");
        label.addEventListener("dragstart", event => {
          input.state.draggingSidebarItem = { type: "category", channelId: groupEntry.parentId };
          event.dataTransfer.effectAllowed = "move";
        });
        label.addEventListener("dragover", event => {
          if (input.state.draggingSidebarItem?.type === "category") {
            event.preventDefault();
            label.classList.add("drag-target");
          }
        });
        label.addEventListener("dragleave", () => {
          label.classList.remove("drag-target");
        });
        label.addEventListener("drop", async event => {
          event.preventDefault();
          label.classList.remove("drag-target");
          if (input.state.draggingSidebarItem?.type !== "category" || !input.state.draggingSidebarItem.channelId) {
            return;
          }
          const draggedCategoryId = input.state.draggingSidebarItem.channelId;
          input.state.draggingSidebarItem = null;
          await reorderSidebarCategory(draggedCategoryId, groupIndex);
        });
        label.addEventListener("dragend", () => {
          label.classList.remove("drag-target");
          input.state.draggingSidebarItem = null;
        });
      }
      group.appendChild(label);
      if (!input.state.collapsedChannelGroups[groupEntry.key]) {
        for (const [channelIndex, channel] of groupEntry.channels.entries()) {
          const row = document.createElement("div");
          row.className = "channel-row-wrap" + (channel.botConnected ? " voice-bot-connected" : "");
          row.draggable = true;
          row.addEventListener("dragstart", event => {
            input.state.draggingSidebarItem = { type: "channel", channelId: channel.id };
            event.dataTransfer.effectAllowed = "move";
          });
          row.addEventListener("dragover", event => {
            if (input.state.draggingSidebarItem?.type === "channel") {
              event.preventDefault();
              row.classList.add("drag-target");
            }
          });
          row.addEventListener("dragleave", () => {
            row.classList.remove("drag-target");
          });
          row.addEventListener("drop", async event => {
            event.preventDefault();
            row.classList.remove("drag-target");
            if (input.state.draggingSidebarItem?.type !== "channel") {
              return;
            }
            const draggedChannelId = input.state.draggingSidebarItem.channelId;
            input.state.draggingSidebarItem = null;
            await reorderSidebarChannel(draggedChannelId, groupEntry.parentId, channelIndex);
          });
          row.addEventListener("dragend", () => {
            row.classList.remove("drag-target");
            input.state.draggingSidebarItem = null;
          });
          const button = document.createElement("button");
          button.className = "channel-row" + (!channel.isVoice && channel.id === input.state.selectedChannelId ? " active" : "") + (channel.isVoice ? " voice-row" : "");
          button.innerHTML = "<span class='channel-icon'>" + getChannelIcon(channel) + "</span><span class='channel-row-main'><span class='channel-row-name'>" + input.escapeHtml(channel.name) + "</span><span class='channel-row-kind'>" + input.escapeHtml(channel.kind) + "</span></span>";
          const hasChatMode = !!(input.state.chatModeChannels[channel.id] && input.state.chatModeChannels[channel.id].enabled);
          const isAutonomousStatusChannel = input.state.autonomousStatusChannelId === channel.id;
          let meta = null;
          if (channel.isVoice || hasChatMode || isAutonomousStatusChannel) {
            meta = document.createElement("div");
            meta.className = "channel-row-badges";
          }
          if (hasChatMode && meta) {
            const chatBadge = document.createElement("span");
            chatBadge.className = "channel-badge chat";
            chatBadge.textContent = "Chat";
            meta.appendChild(chatBadge);
          }
          if (isAutonomousStatusChannel && meta) {
            const pulseBadge = document.createElement("span");
            pulseBadge.className = "channel-badge pulse";
            pulseBadge.textContent = "Pulse";
            meta.appendChild(pulseBadge);
          }
          if (channel.settingsEditable) {
            const settingsButton = document.createElement("button");
            settingsButton.className = "channel-settings-button";
            settingsButton.title = "Channel settings";
            settingsButton.innerHTML = "<span class='channel-settings-button-text'>&#9881;</span>";
            settingsButton.addEventListener("click", event => {
              event.stopPropagation();
              input.openChannelSettings(channel.id);
            });
            button.appendChild(settingsButton);
          }
          if (channel.canSendMessages) {
            button.addEventListener("click", () => {
              selectChannel(channel.id);
            });
          } else {
            button.addEventListener("click", () => {
              if (String(channel.kind).toLowerCase().includes("forum")) {
                input.setOutput("Forum channels do not accept direct chat messages. Use model post target options to create forum posts there.");
                return;
              }
              input.setOutput("Use Join or Disconnect to manage the bot in " + channel.name + ".");
            });
          }
          if (channel.isVoice) {
            const occupancy = document.createElement("span");
            occupancy.className = "channel-badge";
            occupancy.textContent = channel.connectedMembers.length + " connected";
            meta.appendChild(occupancy);
            if (channel.botConnected) {
              const botBadge = document.createElement("span");
              botBadge.className = "channel-badge live";
              botBadge.textContent = "Bot in";
              meta.appendChild(botBadge);
            }
            button.appendChild(meta);
            const actions = document.createElement("div");
            actions.className = "voice-row-actions";
            const joinButton = document.createElement("button");
            joinButton.className = "voice-action-button";
            joinButton.textContent = channel.botConnected ? "Joined" : "Join";
            joinButton.disabled = channel.botConnected;
            joinButton.addEventListener("click", async event => {
              event.stopPropagation();
              if (!input.state.selectedGuildId) return void input.setOutput("Select a guild first.");
              await input.request("/api/voice/join", { guildId: input.state.selectedGuildId, channelId: channel.id });
              await loadChannels();
              await input.refreshState();
              input.setOutput("Bot joined voice channel " + channel.name + ".");
            });
            actions.appendChild(joinButton);
            const disconnectButton = document.createElement("button");
            disconnectButton.className = "voice-action-button secondary";
            disconnectButton.textContent = "Disconnect";
            disconnectButton.disabled = !channel.botConnected;
            disconnectButton.addEventListener("click", async event => {
              event.stopPropagation();
              if (!input.state.selectedGuildId) return void input.setOutput("Select a guild first.");
              await input.request("/api/voice/disconnect", { guildId: input.state.selectedGuildId });
              await loadChannels();
              await input.refreshState();
              input.setOutput("Bot disconnected from voice.");
            });
            actions.appendChild(disconnectButton);
            row.appendChild(button);
            row.appendChild(actions);
            if (channel.connectedMembers.length > 0) {
              const members = document.createElement("div");
              members.className = "voice-member-list";
              for (const member of channel.connectedMembers) {
                const pill = document.createElement("span");
                pill.className = "voice-member-pill" + (member.isBot ? " bot" : "");
                pill.textContent = member.displayName;
                pill.title = member.tag;
                members.appendChild(pill);
              }
              row.appendChild(members);
            }
          } else {
            if (meta) {
              button.appendChild(meta);
            }
            row.appendChild(button);
          }
          group.appendChild(row);
        }
      }
      group.addEventListener("dragover", event => {
        if (input.state.draggingSidebarItem?.type === "channel") {
          event.preventDefault();
        }
      });
      group.addEventListener("drop", async event => {
        if (input.state.draggingSidebarItem?.type !== "channel") {
          return;
        }
        event.preventDefault();
        const draggedChannelId = input.state.draggingSidebarItem.channelId;
        input.state.draggingSidebarItem = null;
        await reorderSidebarChannel(draggedChannelId, groupEntry.parentId, groupEntry.channels.length);
      });
      container.appendChild(group);
    });
  }

  function selectChannel(channelId) {
    const channel = input.state.channels.find(item => item.id === channelId && item.canSendMessages);
    if (!channel) {
      return;
    }
    input.state.selectedChannelId = channelId;
    const select = document.getElementById("channel-select");
    if (select) {
      select.value = channelId;
    }
    setNodeText("channel-chip", channel ? "#" + channel.name + " | " + channel.id : "No channel selected");
    renderChannelBrowser();
    input.updateImageScanChannelChip();
    if (typeof input.syncAutomationTargetsWithSelectedChannel === "function") {
      input.syncAutomationTargetsWithSelectedChannel(channelId);
    }
    updateSelectionDetails();
    input.updateChatModeForm();
    void input.loadBotMessages();
    void input.loadChatModeDebug();
    if (window.innerWidth <= 1380) {
      input.setWorkspacePaneVisible(false);
    }
  }

  return {
    applySelectedUser,
    getUserSearchQuery,
    setUserResultsSummary,
    renderUserResults,
    loadUsers,
    renderGuildRail,
    selectGuild,
    loadChannels,
    renderChannelBrowser,
    selectChannel,
    updateSelectionDetails
  };
}

if (typeof window !== "undefined") {
  window.createDashboardDiscordWorkspaceHelpers = createDashboardDiscordWorkspaceHelpers;
}
