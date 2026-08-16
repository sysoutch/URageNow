// This is a pure formatter used while the shell bootstrap is being composed,
// before the workspace controller exists. Keep it outside the controller.
function getTelegramChatTitle(chat, chatId) {
  return String(chat && chat.title ? chat.title : ("Chat " + chatId)).trim() || ("Chat " + chatId);
}

function createDashboardMessengerWorkspaceHelpers(input) {
  const state = input?.state || {};
  const clearChildren = typeof input?.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback() {};
  const escapeHtml = typeof input?.escapeHtml === "function" ? input.escapeHtml : value => String(value || "");
  const formatDateTime = typeof input?.formatDateTime === "function" ? input.formatDateTime : value => String(value || "");
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() { return {}; };
  const setSelectedTelegramChatId = typeof input?.setSelectedTelegramChatId === "function" ? input.setSelectedTelegramChatId : function setSelectedTelegramChatIdFallback() {};
  const updateMessengerWorkspaceSummary = typeof input?.updateMessengerWorkspaceSummary === "function" ? input.updateMessengerWorkspaceSummary : function updateMessengerWorkspaceSummaryFallback() {};
  const renderMessengerDashboardView = typeof input?.renderMessengerDashboardView === "function" ? input.renderMessengerDashboardView : function renderMessengerDashboardViewFallback() {};

  // Keep this normalizer inside the controller. The messenger workspace used
  // to rely on unrelated bootstrap locals, which made a Telegram render able
  // to abort the complete messenger view.
  function normalizeWorkspaceTelegramChatId(value) {
  return String(value || "").trim();
  }

// This file is assembled into the browser bootstrap as a fragment. Keep this
// lookup local instead of depending on a helper from a different assembly
// stage, otherwise selecting Telegram can stop the entire messenger refresh.
  function getWorkspaceSelectedTelegramChat() {
  const selectedId = normalizeWorkspaceTelegramChatId(state.selectedTelegramChatId);
  if (!selectedId) {
    return null;
  }
  return (Array.isArray(state.telegramChats) ? state.telegramChats : [])
    .find(chat => normalizeWorkspaceTelegramChatId(chat?.chatId) === selectedId) || null;
  }

  function getMessengerBrowserUrl() {
    if (state.selectedMessenger === "telegram") {
      return "https://web.telegram.org/";
    }
    if (state.selectedMessenger === "matrix") {
      return "https://app.element.io/";
    }
    if (state.selectedMessenger === "whatsapp") {
      return "https://web.whatsapp.com/";
    }
    const guildId = String(state.selectedGuildId || "").trim();
    const channelId = String(state.selectedChannelId || "").trim();
    if (guildId && channelId) {
      return "https://discord.com/channels/" + guildId + "/" + channelId;
    }
    if (guildId) {
      return "https://discord.com/channels/" + guildId;
    }
    return "https://discord.com/channels/@me";
  }
  function getTelegramAvatarFallback(title) {
    const normalizedTitle = String(title || "").trim();
    if (!normalizedTitle) {
      return "TG";
    }
    const words = normalizedTitle.split(/\s+/).filter(Boolean);
    const first = words[0] ? words[0].charAt(0) : "";
    const second = words.length > 1
      ? words[words.length - 1].charAt(0)
      : words[0] && words[0].length > 1
        ? words[0].charAt(1)
        : "";
    const fallback = (first + second).trim().toUpperCase();
    return fallback || "TG";
  }
  function buildTelegramChatRow(chat, selectedId) {
    const chatId = normalizeWorkspaceTelegramChatId(chat.chatId);
    const title = getTelegramChatTitle(chat, chatId);
    const typeLabel = String(chat.type || "chat").trim().toUpperCase();
    const metaParts = [];
    if (chat.username) {
      metaParts.push("@" + String(chat.username).trim());
    }
    metaParts.push("ID " + chatId);
    if (chat.lastMessageAt) {
      metaParts.push("Last " + formatDateTime(chat.lastMessageAt));
    }
    const messageSnippet = String(chat.lastMessageText || "").trim();
    const row = document.createElement("button");
    row.className = "bot-message-row" + (chatId && chatId === selectedId ? " active" : "");
    row.innerHTML =
      "<div class='bot-message-row-title'><strong>" + escapeHtml(title) + "</strong><span class='bot-message-row-tag'>" + escapeHtml(typeLabel || "CHAT") + "</span></div>"
      + "<div class='bot-message-row-meta'>" + escapeHtml(metaParts.join(" | ")) + "</div>"
      + "<div class='bot-message-row-meta'>" + escapeHtml(messageSnippet || "No recent message captured yet.") + "</div>";
    row.addEventListener("click", () => {
      setSelectedTelegramChatId(chatId);
      renderTelegramChats();
    });
    return row;
  }
  function buildTelegramSidebarAvatarButton(chat, selectedId) {
    const chatId = normalizeWorkspaceTelegramChatId(chat.chatId);
    const title = getTelegramChatTitle(chat, chatId);
    const avatarSource = [chat.avatarUrl, chat.profilePhotoUrl, chat.photoUrl]
      .find(value => typeof value === "string" && value.trim().length > 0);
    const button = document.createElement("button");
    button.className = "telegram-sidebar-avatar-button" + (chatId && chatId === selectedId ? " active" : "");
    button.type = "button";
    button.title = title + " (" + chatId + ")";
    button.setAttribute("aria-label", "Select Telegram chat " + title);
    const avatar = document.createElement("span");
    avatar.className = "telegram-sidebar-avatar";
    if (avatarSource) {
      const imageNode = document.createElement("img");
      imageNode.src = avatarSource;
      imageNode.alt = title;
      imageNode.loading = "lazy";
      avatar.appendChild(imageNode);
    } else {
      avatar.textContent = getTelegramAvatarFallback(title);
    }
    button.appendChild(avatar);
    button.addEventListener("click", () => {
      setSelectedTelegramChatId(chatId);
      renderTelegramChats();
    });
    return button;
  }
  function renderTelegramChats() {
    const mainListNode = document.getElementById("telegram-chat-list");
    const sidebarListNode = document.getElementById("messenger-sidebar-telegram-chat-list");
    const listNodes = [mainListNode, sidebarListNode].filter(Boolean);
    listNodes.forEach(node => clearChildren(node));
    if (mainListNode) {
      mainListNode.classList.remove("telegram-sidebar-avatar-list");
    }
    if (sidebarListNode) {
      sidebarListNode.classList.add("telegram-sidebar-avatar-list");
    }
    const selectedChips = [
      document.getElementById("telegram-selected-chat-chip"),
      document.getElementById("messenger-sidebar-selected-chat-chip")
    ].filter(Boolean);
    const selectedId = normalizeWorkspaceTelegramChatId(state.selectedTelegramChatId);
    const selectedChat = getWorkspaceSelectedTelegramChat();
    selectedChips.forEach(selectedChip => {
      if (selectedChat) {
        const title = String(selectedChat.title || ("Chat " + selectedId)).trim() || ("Chat " + selectedId);
        selectedChip.textContent = "Selected: " + title + " (" + selectedId + ")";
      } else if (selectedId) {
        selectedChip.textContent = "Selected chat ID: " + selectedId;
      } else {
        selectedChip.textContent = "No Telegram chat selected";
      }
    });
    if (listNodes.length === 0) {
      updateMessengerWorkspaceSummary();
      renderMessengerDashboardView();
      return;
    }
    const chats = Array.isArray(state.telegramChats) ? state.telegramChats : [];
    if (chats.length === 0) {
      if (mainListNode) {
        const empty = document.createElement("div");
        empty.className = "item";
        empty.textContent = "No Telegram chats discovered yet. Send /start to your Telegram bot and click refresh.";
        mainListNode.appendChild(empty);
      }
      if (sidebarListNode) {
        const empty = document.createElement("div");
        empty.className = "telegram-sidebar-empty";
        empty.textContent = "No chats";
        sidebarListNode.appendChild(empty);
      }
      updateMessengerWorkspaceSummary();
      renderMessengerDashboardView();
      return;
    }
    chats.forEach(chat => {
      if (mainListNode) {
        mainListNode.appendChild(buildTelegramChatRow(chat, selectedId));
      }
      if (sidebarListNode) {
        sidebarListNode.appendChild(buildTelegramSidebarAvatarButton(chat, selectedId));
      }
    });
    updateMessengerWorkspaceSummary();
    renderMessengerDashboardView();
  }
  async function loadTelegramChats() {
    const payload = await request("/api/telegram/chats");
    state.telegramChats = Array.isArray(payload.chats) ? payload.chats : [];
    renderTelegramChats();
    return state.telegramChats;
  }
  async function sendTelegramMessageFromUi() {
    const chatIdInput = document.getElementById("telegram-chat-id-input");
    const messageInput = document.getElementById("telegram-message-text");
    const chatId = normalizeWorkspaceTelegramChatId(chatIdInput && typeof chatIdInput.value === "string" ? chatIdInput.value : state.selectedTelegramChatId);
    const text = String(messageInput && typeof messageInput.value === "string" ? messageInput.value : "").trim();
    if (!chatId) {
      throw new Error("Telegram chat ID is required.");
    }
    if (!text) {
      throw new Error("Telegram message text is required.");
    }
    await request("/api/telegram/send-message", {
      chatId,
      text
    });
    setSelectedTelegramChatId(chatId);
    if (messageInput && typeof messageInput.value === "string") {
      messageInput.value = "";
    }
    await loadTelegramChats();
  }
  async function sendWhatsAppMessageFromUi() {
    const targetInput = document.getElementById("whatsapp-to-input");
    const messageInput = document.getElementById("whatsapp-message-text");
    const to = String(targetInput && typeof targetInput.value === "string" ? targetInput.value : "").trim();
    const text = String(messageInput && typeof messageInput.value === "string" ? messageInput.value : "").trim();
    if (!to) {
      throw new Error("WhatsApp recipient number is required.");
    }
    if (!text) {
      throw new Error("WhatsApp message text is required.");
    }
    await request("/api/whatsapp/send-message", {
      to,
      text
    });
    state.selectedWhatsAppRecipient = to;
    window.dispatchEvent(new CustomEvent("dashboard:whatsapp-recipient-saved", {detail: {to, label: to}}));
    if (messageInput && typeof messageInput.value === "string") {
      messageInput.value = "";
    }
  }

  return {
    getMessengerBrowserUrl,
    renderTelegramChats,
    loadTelegramChats,
    sendTelegramMessageFromUi,
    sendWhatsAppMessageFromUi
  };
}
