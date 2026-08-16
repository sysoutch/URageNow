function createDashboardStudioPostTargets(input) {
  function normalizeMessenger(value) {
    if (value === "discord" || value === "telegram" || value === "matrix" || value === "whatsapp") {
      return value;
    }
    return "none";
  }

  function getMessengerLabel(messenger) {
    if (messenger === "telegram") return "Telegram";
    if (messenger === "matrix") return "Matrix";
    if (messenger === "whatsapp") return "WhatsApp";
    if (messenger === "discord") return "Discord";
    return "nowhere";
  }

  function getPostTarget(prefix, assetLabel) {
    const messengerNode = document.getElementById(prefix + "-post-messenger-select");
    const destinationNode = document.getElementById(prefix + "-post-destination-input");
    const messenger = normalizeMessenger(messengerNode && typeof messengerNode.value === "string" ? messengerNode.value : "none");
    let destinationId = destinationNode && typeof destinationNode.value === "string" ? destinationNode.value.trim() : "";
    if (!destinationId && messenger === "discord") {
      destinationId = String(input.state.selectedChannelId || "").trim();
      if (destinationNode && destinationId) destinationNode.value = destinationId;
    }
    if (!destinationId && messenger === "telegram") {
      destinationId = String(input.state.selectedTelegramChatId || "").trim();
      if (destinationNode && destinationId) destinationNode.value = destinationId;
    }
    if (messenger !== "none" && !destinationId) {
      return { messenger, destinationId: "", error: "Choose a destination before posting generated " + assetLabel + "." };
    }
    if (messenger === "matrix") {
      return { messenger, destinationId, error: "Matrix posting from LazyDev is not wired yet." };
    }
    return { messenger, destinationId, error: "" };
  }

  function isForumChannel(channel) {
    return Boolean(channel && String(channel.kind || "").toLowerCase().includes("forum"));
  }

  function buildDiscordOptions() {
    const channels = Array.isArray(input.state.channels) ? input.state.channels : [];
    return channels
      .filter(channel => Boolean(channel && channel.canSendMessages && !channel.isVoice && !isForumChannel(channel)))
      .map(channel => ({ id: String(channel.id || "").trim(), label: "#" + String(channel.name || "channel") + " | " + String(channel.id || "") }))
      .filter(entry => entry.id);
  }

  function buildTelegramOptions(chats) {
    if (!Array.isArray(chats)) return [];
    return chats
      .map(chat => {
        const chatId = String(chat && (chat.chatId ?? chat.id ?? "") || "").trim();
        const title = String(chat && (chat.title ?? chat.name ?? "") || "").trim() || ("Chat " + chatId);
        return chatId ? { id: chatId, label: title + " | " + chatId } : null;
      })
      .filter(Boolean);
  }

  function buildWhatsAppOptions(contacts) {
    if (!Array.isArray(contacts)) return [];
    return contacts
      .map(contact => {
        const destinationId = String(
          contact && (contact.to || contact.phoneNumber || contact.phone || contact.e164 || contact.waId || contact.id || "") || ""
        ).trim();
        const name = String(contact && (contact.name || contact.displayName || contact.label || "") || "").trim();
        return destinationId ? { id: destinationId, label: (name || "Contact") + " | " + destinationId } : null;
      })
      .filter(Boolean);
  }

  function appendCustomDestinationOption(selectNode, destinationId) {
    if (!selectNode || !destinationId) return;
    const existing = Array.from(selectNode.options || []).find(option => String(option.value || "").trim() === destinationId);
    if (existing) return;
    const option = document.createElement("option");
    option.value = destinationId;
    option.textContent = "Custom destination | " + destinationId;
    selectNode.appendChild(option);
  }

  function refillDestinationSelect(selectNode, options, emptyLabel, selectedValue) {
    if (!selectNode) return;
    const normalizedSelection = String(selectedValue || "").trim();
    input.clearChildren(selectNode);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = emptyLabel;
    selectNode.appendChild(emptyOption);
    options.forEach(entry => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      selectNode.appendChild(option);
    });
    if (!normalizedSelection) {
      selectNode.value = "";
      return;
    }
    if (!options.some(entry => entry.id === normalizedSelection)) appendCustomDestinationOption(selectNode, normalizedSelection);
    selectNode.value = normalizedSelection;
  }

  async function loadDestinations(messenger) {
    if (messenger === "discord") return buildDiscordOptions();
    if (messenger === "telegram") {
      let chats = Array.isArray(input.state.telegramChats) ? input.state.telegramChats : [];
      if (chats.length === 0) {
        const payload = await input.request("/api/telegram/chats");
        chats = Array.isArray(payload.chats) ? payload.chats : [];
        input.state.telegramChats = chats;
      }
      return buildTelegramOptions(chats);
    }
    if (messenger === "whatsapp") {
      const payload = await input.request("/api/whatsapp/contacts");
      return buildWhatsAppOptions(Array.isArray(payload.contacts) ? payload.contacts : []);
    }
    return [];
  }

  async function refreshDestinationSelect(prefix, messenger, destinationNode) {
    const normalizedMessenger = normalizeMessenger(messenger);
    if (!destinationNode || normalizedMessenger === "none") return;
    if (normalizedMessenger === "matrix") {
      refillDestinationSelect(destinationNode, [], "Matrix posting is not wired yet", "");
      return;
    }
    const fallbackDestinationId = normalizedMessenger === "discord"
      ? String(input.state.selectedChannelId || "").trim()
      : normalizedMessenger === "telegram"
        ? String(input.state.selectedTelegramChatId || "").trim()
        : "";
    const currentDestinationId = String(destinationNode.value || "").trim() || fallbackDestinationId;
    try {
      const options = await loadDestinations(normalizedMessenger);
      const emptyLabel = normalizedMessenger === "discord"
        ? "Choose Discord channel"
        : normalizedMessenger === "telegram"
          ? "Choose Telegram chat"
          : "Choose WhatsApp contact";
      refillDestinationSelect(destinationNode, options, emptyLabel, currentDestinationId);
    } catch (error) {
      refillDestinationSelect(destinationNode, [], "Failed to load destinations", currentDestinationId);
      const detail = error && error.message ? error.message : "Unknown error";
      input.setOutput("Failed to load " + getMessengerLabel(normalizedMessenger) + " destinations for " + prefix + ": " + detail);
    }
  }

  async function syncPostTargetUi(prefix) {
    const messengerNode = document.getElementById(prefix + "-post-messenger-select");
    const destinationNode = document.getElementById(prefix + "-post-destination-input");
    const hintNode = document.getElementById(prefix + "-post-destination-hint");
    const selectedMessengerRow = document.getElementById(prefix + "-post-use-selected-discord-row");
    const selectedMessengerButton = document.getElementById(prefix + "-post-use-selected-discord-button");
    const messenger = normalizeMessenger(messengerNode && typeof messengerNode.value === "string" ? messengerNode.value : "none");
    const postDisabled = messenger === "none" || messenger === "matrix";
    if (destinationNode) {
      destinationNode.classList.toggle("hidden", messenger === "none");
      destinationNode.disabled = postDisabled;
      await refreshDestinationSelect(prefix, messenger, destinationNode);
    }
    if (selectedMessengerRow) selectedMessengerRow.classList.toggle("hidden", messenger !== "discord" && messenger !== "telegram");
    if (selectedMessengerButton) {
      selectedMessengerButton.textContent = messenger === "telegram" ? "Use Selected Telegram Chat" : "Use Selected Discord Channel";
    }
    if (hintNode) {
      hintNode.textContent = messenger === "discord"
        ? "Choose a Discord channel from the list."
        : messenger === "telegram"
          ? "Choose a Telegram chat from the list."
          : messenger === "whatsapp"
            ? "Choose a WhatsApp contact from the list."
            : messenger === "matrix"
              ? "Matrix posting is not wired yet."
              : "Pick a messenger and choose a destination.";
    }
  }

  function bindPostTargetUi(prefix) {
    const messengerNode = document.getElementById(prefix + "-post-messenger-select");
    const selectedMessengerButton = document.getElementById(prefix + "-post-use-selected-discord-button");
    const destinationNode = document.getElementById(prefix + "-post-destination-input");
    messengerNode?.addEventListener("change", () => void syncPostTargetUi(prefix));
    selectedMessengerButton?.addEventListener("click", event => {
      event.preventDefault();
      const messenger = normalizeMessenger(messengerNode && typeof messengerNode.value === "string" ? messengerNode.value : "none");
      const selectedChannelId = String(input.state.selectedChannelId || "").trim();
      const selectedTelegramChatId = String(input.state.selectedTelegramChatId || "").trim();
      const selectedDestinationId = messenger === "telegram" ? selectedTelegramChatId : selectedChannelId;
      if (!selectedDestinationId) {
        input.setOutput(messenger === "telegram" ? "Select a Telegram chat first." : "Select a Discord channel first.");
        return;
      }
      if (destinationNode && typeof destinationNode.value === "string") {
        appendCustomDestinationOption(destinationNode, selectedDestinationId);
        destinationNode.value = selectedDestinationId;
      }
      void syncPostTargetUi(prefix);
      input.setOutput(messenger === "telegram"
        ? "Using selected Telegram chat ID as post destination."
        : "Using selected Discord channel ID as post destination.");
    });
    void syncPostTargetUi(prefix);
  }

  function refreshPostTargetOptions() {
    ["imagegen", "audiogen", "musicgen", "videogen"].forEach(prefix => void syncPostTargetUi(prefix));
  }

  async function postToExternalTarget(target, messageText) {
    if (target.messenger === "telegram") {
      await input.request("/api/telegram/send-message", { chatId: target.destinationId, text: messageText });
      input.state.selectedTelegramChatId = String(target.destinationId || "").trim();
      return true;
    }
    if (target.messenger === "whatsapp") {
      await input.request("/api/whatsapp/send-message", { to: target.destinationId, text: messageText });
      return true;
    }
    return false;
  }

  return {
    bindPostTargetUi,
    getPostTarget,
    postToExternalTarget,
    refreshPostTargetOptions
  };
}
