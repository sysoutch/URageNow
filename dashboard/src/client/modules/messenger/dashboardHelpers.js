function createDashboardMessengerDashboardHelpers(input) {
  class DashboardMessengerDashboardController {
    constructor(options) {
      this.input = options || {};
      this.state = this.input.state || {};
    }

    getDashboardMessengerSubtitle(messenger) {
      if (messenger === "telegram") {
        return "Connect, manage, and interact with your Telegram bot and chats.";
      }
      if (messenger === "matrix") {
        return "Connect, manage, and interact with your Matrix bot and rooms.";
      }
      if (messenger === "whatsapp") {
        return "Connect, manage, and interact with your WhatsApp runtime and phone targets.";
      }
      return "Connect, manage, and interact with your Discord bot and server.";
    }

    formatRelativeTime(value) {
      if (!value) {
        return "Unknown";
      }
      const timestamp = new Date(value).getTime();
      if (!Number.isFinite(timestamp)) {
        return "Unknown";
      }
      const deltaMs = Date.now() - timestamp;
      const absoluteMs = Math.abs(deltaMs);
      if (absoluteMs < 60_000) {
        return "Just now";
      }
      const minute = 60_000;
      const hour = 60 * minute;
      const day = 24 * hour;
      if (absoluteMs < hour) {
        return Math.round(absoluteMs / minute) + "m ago";
      }
      if (absoluteMs < day) {
        return Math.round(absoluteMs / hour) + "h ago";
      }
      return Math.round(absoluteMs / day) + "d ago";
    }

    getMessengerDashboardRecords() {
      if (this.state.selectedMessenger === "telegram") {
        const chats = Array.isArray(this.state.telegramChats) ? this.state.telegramChats : [];
        const selectedChatId = this.input.normalizeTelegramChatId(this.state.selectedTelegramChatId);
        const scopedChats = selectedChatId
          ? chats.filter(chat => this.input.normalizeTelegramChatId(chat.chatId) === selectedChatId)
          : chats;
        return scopedChats
          .map(chat => {
            const chatId = this.input.normalizeTelegramChatId(chat.chatId);
            const title = this.input.getTelegramChatTitle(chat, chatId);
            return {
              id: chatId,
              label: title,
              preview: String(chat.lastMessageText || "").trim() || "No recent message captured yet.",
              createdAt: chat.lastMessageAt || ""
            };
          })
          .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
      }
      if (this.state.selectedMessenger === "matrix") {
        return (this.state.messengerRuntimeEvents || [])
          .filter(entry => entry.messenger === "matrix")
          .map(entry => ({
            id: entry.id || "",
            label: "Runtime",
            preview: String(entry.message || "").trim() || "No runtime message available.",
            createdAt: entry.createdAt || ""
          }))
          .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
      }
      if (this.state.selectedMessenger === "whatsapp") {
        return (this.state.messengerRuntimeEvents || [])
          .filter(entry => entry.messenger === "whatsapp")
          .map(entry => ({
            id: entry.id || "",
            label: "Runtime",
            preview: String(entry.message || "").trim() || "No runtime message available.",
            createdAt: entry.createdAt || ""
          }))
          .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
      }
      return (this.state.botMessages || [])
        .map(entry => ({
          id: entry.id,
          label: "URage Bot",
          preview: String(entry.content || "").trim() || "(empty message)",
          createdAt: entry.editedAt || entry.createdAt || ""
        }))
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
    }

    renderMessengerDashboardRecentMessages(records) {
      const container = document.getElementById("messenger-dashboard-recent-list");
      if (!container) {
        return;
      }
      this.input.clearChildren(container);
      const items = Array.isArray(records) ? records.slice(0, 6) : [];
      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "messenger-dashboard-message-item is-empty";
        empty.textContent = "No recent messages available yet.";
        container.appendChild(empty);
        return;
      }
      items.forEach(entry => {
        const row = document.createElement("div");
        row.className = "messenger-dashboard-message-item";
        row.innerHTML =
          "<div class='messenger-dashboard-message-top'><strong>" + this.input.escapeHtml(entry.label || "Message") + "</strong><span>" + this.input.escapeHtml(this.formatRelativeTime(entry.createdAt)) + "</span></div>"
          + "<div class='messenger-dashboard-message-preview'>" + this.input.escapeHtml(entry.preview || "(empty message)") + "</div>";
        container.appendChild(row);
      });
    }

    renderMessengerDashboardActivityBars(records) {
      const container = document.getElementById("messenger-dashboard-activity-bars");
      if (!container) {
        return;
      }
      this.input.clearChildren(container);
      const bucketCount = 12;
      const now = Date.now();
      const rangeMs = 24 * 60 * 60 * 1000;
      const stepMs = rangeMs / bucketCount;
      const counts = Array.from({ length: bucketCount }, () => 0);
      (Array.isArray(records) ? records : []).forEach(entry => {
        const timestamp = new Date(entry.createdAt || 0).getTime();
        if (!Number.isFinite(timestamp)) {
          return;
        }
        const delta = now - timestamp;
        if (delta < 0 || delta > rangeMs) {
          return;
        }
        const index = Math.min(bucketCount - 1, Math.max(0, bucketCount - 1 - Math.floor(delta / stepMs)));
        counts[index] += 1;
      });
      const maxCount = Math.max(1, ...counts);
      counts.forEach((count, index) => {
        const bar = document.createElement("span");
        bar.className = "messenger-dashboard-activity-bar";
        const percentage = Math.max(8, Math.round((count / maxCount) * 100));
        bar.style.height = percentage + "%";
        bar.title = "Bucket " + (index + 1) + ": " + count + " event" + (count === 1 ? "" : "s");
        container.appendChild(bar);
      });
    }

    renderMessengerDashboardCommandList(records) {
      const container = document.getElementById("messenger-dashboard-command-list");
      if (!container) {
        return;
      }
      this.input.clearChildren(container);
      const commandCounts = new Map();
      (Array.isArray(records) ? records : []).forEach(entry => {
        const content = String(entry.preview || "");
        const matches = content.match(/\/[a-z0-9_-]+/gi) || [];
        matches.forEach(raw => {
          const command = raw.toLowerCase();
          commandCounts.set(command, (commandCounts.get(command) || 0) + 1);
        });
      });
      if (commandCounts.size === 0) {
        if (this.state.selectedMessenger === "discord" && Array.isArray(this.state.commandDefinitions) && this.state.commandDefinitions.length > 0) {
          this.state.commandDefinitions.slice(0, 5).forEach(definition => {
            const commandName = String(definition?.name || "").trim();
            if (!commandName) {
              return;
            }
            commandCounts.set(commandName.startsWith("/") ? commandName : "/" + commandName, 0);
          });
        } else if (this.state.selectedMessenger === "telegram") {
          commandCounts.set("/message", 0);
          commandCounts.set("/automation", 0);
          commandCounts.set("/runtime", 0);
        } else if (this.state.selectedMessenger === "whatsapp") {
          commandCounts.set("/send", 0);
          commandCounts.set("/template", 0);
          commandCounts.set("/runtime", 0);
        } else {
          commandCounts.set("/room", 0);
          commandCounts.set("/automation", 0);
          commandCounts.set("/runtime", 0);
        }
      }
      const sorted = [...commandCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6);
      const maxCount = Math.max(1, ...sorted.map(entry => entry[1]));
      sorted.forEach(([command, count]) => {
        const row = document.createElement("div");
        row.className = "messenger-dashboard-command-row";
        row.innerHTML =
          "<div class='messenger-dashboard-command-head'><strong>" + this.input.escapeHtml(command) + "</strong><span>" + count + "</span></div>";
        const meter = document.createElement("div");
        meter.className = "messenger-dashboard-command-meter";
        const fill = document.createElement("span");
        fill.className = "messenger-dashboard-command-meter-fill";
        fill.style.width = Math.max(6, Math.round((count / maxCount) * 100)) + "%";
        meter.appendChild(fill);
        row.appendChild(meter);
        container.appendChild(row);
      });
    }

    renderMessengerDashboardView() {
      const runtime = this.input.getSelectedMessengerRuntime();
      const messenger = this.input.normalizeMessenger(this.state.selectedMessenger);
      const messengerLabel = this.input.getMessengerDisplayName(messenger);
      const iconNode = document.getElementById("messenger-dashboard-icon-badge");
      if (iconNode) {
        iconNode.className = "messenger-dashboard-icon is-" + messenger;
        iconNode.textContent = messenger === "telegram" ? "T" : messenger === "matrix" ? "M" : messenger === "whatsapp" ? "W" : "D";
      }
      this.input.setDashboardText("messenger-dashboard-title", messengerLabel);
      this.input.setDashboardText("messenger-dashboard-subtitle", this.getDashboardMessengerSubtitle(messenger));
      const enabledPill = document.getElementById("messenger-dashboard-enabled-pill");
      if (enabledPill) {
        const status = runtime ? runtime.status : "stopped";
        enabledPill.className = "messenger-dashboard-enabled is-" + status;
        enabledPill.textContent = status === "running" ? "Enabled" : status.charAt(0).toUpperCase() + status.slice(1);
      }
      const runtimeNode = document.getElementById("messenger-dashboard-runtime-state");
      if (runtimeNode) {
        const status = runtime ? runtime.status : "stopped";
        runtimeNode.className = "messenger-dashboard-runtime-state is-" + status;
        runtimeNode.textContent = status.toUpperCase();
      }
      this.input.setDashboardText("messenger-dashboard-runtime-meta", runtime ? this.input.formatRuntimeMeta(runtime) : "Runtime is currently offline.");
      const quickRuntimeButton = document.getElementById("messenger-dashboard-quick-runtime-button");
      if (quickRuntimeButton) {
        const action = runtime?.status === "running" ? "Restart" : "Start";
        quickRuntimeButton.textContent = action + " " + messengerLabel;
        quickRuntimeButton.setAttribute("aria-label", action + " " + messengerLabel + " runtime");
      }
      const browserButton = document.getElementById("messenger-dashboard-open-browser-button");
      if (browserButton) {
        // Matrix rooms have no stable web URL unless a particular homeserver
        // exposes one. Keep its dashboard honest and route room work through
        // the Matrix workspace instead of opening a Discord/Telegram URL.
        browserButton.hidden = messenger === "matrix";
      }
      this.input.setDashboardText("messenger-dashboard-member-label", messenger === "matrix" ? "Participants" : messenger === "whatsapp" ? "Recipients" : "Members");
      this.input.setDashboardText("messenger-dashboard-channel-label", messenger === "matrix" ? "Room Events" : messenger === "whatsapp" ? "Conversations" : "Channels");
      this.input.setDashboardText("messenger-dashboard-recent-title", messenger === "matrix" ? "Matrix Runtime Activity" : "Recent Messages");
      this.input.setDashboardText("messenger-dashboard-command-title", messenger === "matrix" ? "Matrix Actions (24h)" : "Top Commands (24h)");
      this.input.setDashboardText("messenger-dashboard-space-title", messenger === "matrix" ? "Room Info" : messenger === "telegram" ? "Chat Info" : messenger === "whatsapp" ? "Recipient Info" : "Server Info");
      this.input.setDashboardText("messenger-dashboard-view-server-button", messenger === "matrix" ? "Open Matrix Rooms" : messenger === "telegram" ? "Open Chat View" : messenger === "whatsapp" ? "Open Recipient View" : "Open Server View");

      const records = this.getMessengerDashboardRecords();
      const recent24h = records.filter(entry => {
        const timestamp = new Date(entry.createdAt || 0).getTime();
        return Number.isFinite(timestamp) && (Date.now() - timestamp) <= 24 * 60 * 60 * 1000;
      }).length;
      const selectedGuild = (this.state.guilds || []).find(item => item.id === this.state.selectedGuildId) || null;
      const selectedGuildMemberCount = selectedGuild && Number.isFinite(Number(selectedGuild.memberCount))
        ? Number(selectedGuild.memberCount)
        : null;
      const selectedGuildTextChannelCount = selectedGuild && Number.isFinite(Number(selectedGuild.textChannelCount))
        ? Number(selectedGuild.textChannelCount)
        : 0;
      const selectedGuildVoiceChannelCount = selectedGuild && Number.isFinite(Number(selectedGuild.voiceChannelCount))
        ? Number(selectedGuild.voiceChannelCount)
        : 0;
      const selectedGuildChannelCount = selectedGuild && Number.isFinite(Number(selectedGuild.channelCount))
        ? Number(selectedGuild.channelCount)
        : (selectedGuildTextChannelCount + selectedGuildVoiceChannelCount);
      const selectedTelegramChat = this.input.getSelectedTelegramChat();
      const telegramChats = Array.isArray(this.state.telegramChats) ? this.state.telegramChats : [];
      const matrixRooms = Array.isArray(this.state.matrixRooms) ? this.state.matrixRooms : [];
      const selectedMatrixRoom = matrixRooms.find(room => String(room?.roomId || room?.id || "").trim() === String(this.state.selectedMatrixRoomId || "").trim()) || null;
      const selectedTelegramMemberCount = selectedTelegramChat && Number.isFinite(Number(selectedTelegramChat.memberCount))
        ? Number(selectedTelegramChat.memberCount)
        : null;
      const telegramMemberTotal = telegramChats.reduce((sum, chat) => {
        const count = Number(chat && chat.memberCount);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0);
      const channels = Array.isArray(this.state.channels) ? this.state.channels : [];
      const channelsBelongToSelectedGuild = String(this.state.channelsGuildId || "") === String(this.state.selectedGuildId || "");
      const loadedTextChannels = channels.filter(channel => !channel.isVoice && channel.kind !== "category").length;
      const loadedVoiceChannels = channels.filter(channel => channel.isVoice).length;
      const loadedTotalChannels = loadedTextChannels + loadedVoiceChannels;
      const textChannels = messenger === "discord"
        ? (channelsBelongToSelectedGuild ? loadedTextChannels : selectedGuildTextChannelCount)
        : loadedTextChannels;
      const voiceChannels = messenger === "discord"
        ? (channelsBelongToSelectedGuild ? loadedVoiceChannels : selectedGuildVoiceChannelCount)
        : loadedVoiceChannels;
      const totalChannels = messenger === "discord"
        ? (channelsBelongToSelectedGuild ? loadedTotalChannels : selectedGuildChannelCount)
        : loadedTotalChannels;

      const spaceLabel = messenger === "telegram"
        ? "Chats"
        : messenger === "matrix"
          ? "Rooms"
          : messenger === "whatsapp"
            ? "Targets"
            : "Selected Guild";
      const spaceCount = messenger === "telegram"
        ? telegramChats.length
        : messenger === "matrix"
          ? matrixRooms.length
          : messenger === "whatsapp"
            ? 0
          : (selectedGuild ? 1 : 0);
      const spaceSubtitle = messenger === "telegram"
        ? (selectedTelegramChat ? String(selectedTelegramChat.title || "Selected Telegram chat") : "No chat selected")
        : messenger === "matrix"
          ? (selectedMatrixRoom ? String(selectedMatrixRoom.title || selectedMatrixRoom.name || selectedMatrixRoom.roomId || selectedMatrixRoom.id) : "Refresh rooms to discover joined rooms")
          : messenger === "whatsapp"
            ? "Use phone numbers in composer"
          : (selectedGuild ? selectedGuild.name : "No guild selected");

      const memberCount = messenger === "discord"
        ? (selectedGuildMemberCount !== null ? selectedGuildMemberCount : 0)
        : messenger === "telegram"
          ? (selectedTelegramMemberCount !== null ? selectedTelegramMemberCount : telegramMemberTotal)
          : messenger === "whatsapp"
            ? 0
          : 0;
      const channelCount = messenger === "discord"
        ? totalChannels
        : messenger === "telegram"
          ? (selectedTelegramChat ? 1 : telegramChats.length)
          : messenger === "whatsapp"
            ? 0
          : 0;

      if (messenger === "matrix") {
        const roomEventCount = records.length;
        this.input.setDashboardText("messenger-dashboard-member-count", selectedMatrixRoom && Number.isFinite(Number(selectedMatrixRoom.memberCount)) ? String(selectedMatrixRoom.memberCount) : "--");
        this.input.setDashboardText("messenger-dashboard-member-subtitle", selectedMatrixRoom ? "Selected room participants" : "Select a room to inspect participants");
        this.input.setDashboardText("messenger-dashboard-channel-count", String(roomEventCount));
        this.input.setDashboardText("messenger-dashboard-channel-subtitle", roomEventCount > 0 ? "Captured Matrix runtime events" : "No Matrix runtime events yet");
      }

      this.input.setDashboardText("messenger-dashboard-space-label", spaceLabel);
      this.input.setDashboardText("messenger-dashboard-space-count", String(spaceCount));
      this.input.setDashboardText("messenger-dashboard-space-subtitle", spaceSubtitle);
      if (messenger !== "matrix") {
        this.input.setDashboardText("messenger-dashboard-member-count", String(memberCount));
      }
      if (messenger !== "matrix") {
        this.input.setDashboardText(
          "messenger-dashboard-member-subtitle",
        messenger === "discord"
          ? (selectedGuild ? "Selected guild members" : "Select a guild to see member count")
          : messenger === "telegram"
            ? (selectedTelegramChat
                ? (selectedTelegramMemberCount !== null
                    ? "Selected chat member count"
                    : "Selected chat member count unavailable")
                : "Member counts from chat metadata")
            : messenger === "whatsapp"
              ? "Phone target list is manual"
            : (selectedMatrixRoom && Number.isFinite(Number(selectedMatrixRoom.memberCount)) ? "Selected room member count" : "Member counts depend on Matrix room metadata")
        );
        this.input.setDashboardText("messenger-dashboard-channel-count", String(channelCount));
        this.input.setDashboardText(
          "messenger-dashboard-channel-subtitle",
        messenger === "discord"
          ? (selectedGuild
              ? "Text: " + textChannels + " | Voice: " + voiceChannels
              : "Select a guild to load channel counts")
          : messenger === "telegram"
            ? (selectedTelegramChat ? "Selected Telegram chat" : "Chats currently discovered")
          : messenger === "whatsapp"
            ? "Manual phone target mode"
            : (selectedMatrixRoom ? "Selected Matrix room" : "Refresh joined Matrix rooms")
        );
      }
      this.input.setDashboardText("messenger-dashboard-message-count", String(recent24h));
      this.input.setDashboardText(
        "messenger-dashboard-message-subtitle",
        recent24h > 0 ? "Last 24h activity" : "No activity in the last 24h"
      );

      const snapshot = this.state.botSnapshot && typeof this.state.botSnapshot === "object" ? this.state.botSnapshot : {};
      this.input.setDashboardText("messenger-dashboard-bot-name", String(snapshot.tag || (messengerLabel + " Bot")));
      this.input.setDashboardText("messenger-dashboard-bot-id", String(snapshot.id || "Unknown"));
      this.input.setDashboardText("messenger-dashboard-connected-since", runtime && runtime.startedAt ? this.input.formatDateTime(runtime.startedAt) : (snapshot.startedAt ? this.input.formatDateTime(snapshot.startedAt) : "Unknown"));
      this.input.setDashboardText("messenger-dashboard-permissions", messenger === "discord" ? "Administrator" : "Configured");

      this.input.setDashboardText("messenger-dashboard-server-name-label", messenger === "telegram" ? "Chat Name" : messenger === "matrix" ? "Room Name" : messenger === "whatsapp" ? "Target Type" : "Guild Name");
      this.input.setDashboardText("messenger-dashboard-server-id-label", messenger === "telegram" ? "Chat ID" : messenger === "matrix" ? "Room ID" : messenger === "whatsapp" ? "Phone ID" : "Guild ID");
      this.input.setDashboardText("messenger-dashboard-server-members-label", messenger === "telegram" ? (selectedTelegramChat ? "Members" : "Chats") : messenger === "matrix" ? "Rooms" : messenger === "whatsapp" ? "Targets" : "Members");
      this.input.setDashboardText("messenger-dashboard-server-name", messenger === "telegram" ? String(selectedTelegramChat?.title || "None") : messenger === "matrix" ? String(selectedMatrixRoom?.title || selectedMatrixRoom?.name || "None") : messenger === "whatsapp" ? "Manual Phone Target" : String(selectedGuild?.name || "None"));
      this.input.setDashboardText("messenger-dashboard-server-id", messenger === "telegram" ? String(selectedTelegramChat?.chatId || "None") : messenger === "matrix" ? String(selectedMatrixRoom?.roomId || selectedMatrixRoom?.id || "None") : messenger === "whatsapp" ? "None" : String(selectedGuild?.id || "None"));
      this.input.setDashboardText("messenger-dashboard-server-region", messenger === "telegram" ? "Telegram" : messenger === "matrix" ? "Matrix" : messenger === "whatsapp" ? "WhatsApp" : "Discord");
      this.input.setDashboardText(
        "messenger-dashboard-server-members",
        messenger === "telegram"
          ? (selectedTelegramChat
              ? (selectedTelegramMemberCount !== null ? String(selectedTelegramMemberCount) : "Unknown")
              : String(telegramChats.length))
          : messenger === "matrix"
            ? (Number.isFinite(Number(selectedMatrixRoom?.memberCount)) ? String(selectedMatrixRoom.memberCount) : String(matrixRooms.length))
          : messenger === "whatsapp"
            ? "0"
              : String(selectedGuildMemberCount !== null ? selectedGuildMemberCount : 0)
      );
      const fetchStatusNode = document.getElementById("messenger-dashboard-fetch-status");
      if (fetchStatusNode) {
        if (messenger !== "discord") {
          fetchStatusNode.textContent = "Use the messenger-specific refresh controls for this workspace.";
        } else {
          const refreshMeta = typeof this.input.getRefreshMeta === "function" ? this.input.getRefreshMeta() : { guilds: 0, channels: 0, botMessages: 0 };
          const guildsStatus = refreshMeta.guilds > 0 ? ("Guilds refreshed " + this.formatRelativeTime(refreshMeta.guilds) + ".") : "Guilds not loaded yet.";
          const channelsStatus = refreshMeta.channels > 0
            ? ("Channels cached: " + (channelsBelongToSelectedGuild ? channels.length : totalChannels) + ".")
            : "Channels not loaded.";
          const messagesStatus = refreshMeta.botMessages > 0
            ? ("Messages cached: " + (this.state.botMessages || []).length + ".")
            : "Messages not loaded.";
          fetchStatusNode.textContent = guildsStatus + " " + channelsStatus + " " + messagesStatus;
        }
      }

      this.input.setDashboardText("messenger-dashboard-activity-label", messenger === "discord" ? "Messages" : messenger === "telegram" ? "Chats" : messenger === "whatsapp" ? "Runtime" : "Runtime");
      this.renderMessengerDashboardRecentMessages(records);
      this.renderMessengerDashboardActivityBars(records);
      this.renderMessengerDashboardCommandList(records);
    }
  }

  const controller = new DashboardMessengerDashboardController(input);
  return {
    getDashboardMessengerSubtitle: messenger => controller.getDashboardMessengerSubtitle(messenger),
    formatRelativeTime: value => controller.formatRelativeTime(value),
    getMessengerDashboardRecords: () => controller.getMessengerDashboardRecords(),
    renderMessengerDashboardRecentMessages: records => controller.renderMessengerDashboardRecentMessages(records),
    renderMessengerDashboardActivityBars: records => controller.renderMessengerDashboardActivityBars(records),
    renderMessengerDashboardCommandList: records => controller.renderMessengerDashboardCommandList(records),
    renderMessengerDashboardView: () => controller.renderMessengerDashboardView()
  };
}
