function createDashboardDirectMessageRailHelpers(input) {
  const state = input?.state || {};
  const request = typeof input?.request === "function" ? input.request : async () => [];
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const normalizeTelegramChatId = typeof input?.normalizeTelegramChatId === "function"
    ? input.normalizeTelegramChatId
    : value => String(value || "").trim();
  const setSelectedTelegramChatId = typeof input?.setSelectedTelegramChatId === "function"
    ? input.setSelectedTelegramChatId
    : value => {
        state.selectedTelegramChatId = normalizeTelegramChatId(value);
      };
  const renderTelegramChats = typeof input?.renderTelegramChats === "function"
    ? input.renderTelegramChats
    : function renderTelegramChatsFallback() {};
  const updateSelectionDetails = typeof input?.updateSelectionDetails === "function"
    ? input.updateSelectionDetails
    : function updateSelectionDetailsFallback() {};
  const selectDiscordDirectMessage = typeof input?.selectDiscordDirectMessage === "function"
    ? input.selectDiscordDirectMessage
    : null;
  let loading = false;
  let loadError = "";
  const whatsAppHistoryKey = "urage-whatsapp-recipient-history";

  function readWhatsAppHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(whatsAppHistoryKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter(entry => entry && typeof entry.to === "string") : [];
    } catch {
      return [];
    }
  }

  function mergeWhatsAppRecipients(contacts) {
    const merged = new Map();
    [...readWhatsAppHistory(), ...(Array.isArray(contacts) ? contacts : [])].forEach(contact => {
      const to = String(contact?.to || contact?.phone || contact?.id || "").trim();
      if (to) merged.set(to, { ...contact, to, label: String(contact?.label || contact?.name || to) });
    });
    state.whatsappRecipients = [...merged.values()];
    try {
      localStorage.setItem(whatsAppHistoryKey, JSON.stringify(state.whatsappRecipients.slice(0, 50)));
    } catch {
      // The current session still keeps recipients when browser persistence is unavailable.
    }
  }

  function getInitials(label, fallback) {
    const words = String(label || "").trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map(word => word.charAt(0)).join("").toUpperCase();
    return initials || fallback;
  }

  function getDirectMessages() {
    if (state.selectedMessenger === "discord") {
      return (Array.isArray(state.dmThreads) ? state.dmThreads : []).map(thread => ({
        id: String(thread.channelId || "").trim(),
        userId: String(thread.userId || "").trim(),
        label: String(thread.displayName || thread.tag || "Unknown user").trim(),
        meta: String(thread.lastMessagePreview || thread.tag || "Discord DM").trim(),
        selected: String(thread.channelId || "") === String(state.selectedDmChannelId || ""),
        initials: getInitials(thread.displayName || thread.tag, "DM"),
        source: thread
      })).filter(item => item.id);
    }
    if (state.selectedMessenger === "telegram") {
      const selectedId = normalizeTelegramChatId(state.selectedTelegramChatId);
      return (Array.isArray(state.telegramChats) ? state.telegramChats : []).map(chat => {
        const id = normalizeTelegramChatId(chat?.chatId);
        const label = String(chat?.title || chat?.username || ("Chat " + id)).trim();
        return {
          id,
          label,
          meta: String(chat?.lastMessageText || chat?.username || "Telegram chat").trim(),
          selected: id === selectedId,
          initials: getInitials(label, "TG"),
          avatarUrl: [chat?.avatarUrl, chat?.profilePhotoUrl, chat?.photoUrl].find(value => typeof value === "string" && value.trim()),
          source: chat
        };
      }).filter(item => item.id);
    }
    if (state.selectedMessenger === "matrix") {
      return (Array.isArray(state.matrixRooms) ? state.matrixRooms : []).map(room => {
        const id = String(room?.roomId || room?.id || "").trim();
        return {
          id,
          label: String(room?.title || room?.name || id).trim(),
          meta: String(room?.lastMessageText || "Matrix room").trim(),
          selected: id === String(state.selectedMatrixRoomId || ""),
          initials: getInitials(room?.title || room?.name, "MX"),
          source: room
        };
      }).filter(item => item.id);
    }
    if (state.selectedMessenger === "whatsapp") {
      return (Array.isArray(state.whatsappRecipients) ? state.whatsappRecipients : []).map(contact => ({
        id: String(contact?.to || "").trim(),
        label: String(contact?.label || contact?.name || contact?.to || "WhatsApp recipient").trim(),
        meta: String(contact?.to || "").trim(),
        selected: String(contact?.to || "") === String(state.selectedWhatsAppRecipient || ""),
        initials: getInitials(contact?.label || contact?.name, "WA"),
        source: contact
      })).filter(item => item.id);
    }
    return [];
  }

  function getEmptyMessage() {
    if (loading) return "Loading";
    if (loadError) return "Unavailable";
    if (state.selectedMessenger === "matrix") return "No joined rooms discovered";
    if (state.selectedMessenger === "whatsapp") return "No saved recipients";
    return "No direct messages";
  }

  function getMatrixRoomGroups(items) {
    const spaces = items.filter(item => item.source?.isSpace);
    const rooms = items.filter(item => !item.source?.isSpace);
    const nestedRoomIds = new Set();
    const groups = spaces.map(space => {
      const children = rooms.filter(room => {
        const parentIds = Array.isArray(room.source?.parentSpaceIds) ? room.source.parentSpaceIds : [];
        const spaceChildIds = Array.isArray(space.source?.childRoomIds) ? space.source.childRoomIds : [];
        const belongsToSpace = parentIds.includes(space.id) || spaceChildIds.includes(room.id);
        if (belongsToSpace) nestedRoomIds.add(room.id);
        return belongsToSpace;
      });
      return {space, rooms: children};
    });
    return {groups, ungrouped: rooms.filter(room => !nestedRoomIds.has(room.id))};
  }

  function selectDirectMessage(item) {
    if (state.selectedMessenger === "telegram") {
      setSelectedTelegramChatId(item.id);
      renderTelegramChats();
      render();
      return;
    }
    if (state.selectedMessenger === "matrix") {
      state.selectedMatrixRoomId = item.id;
      const roomInput = document.getElementById("matrix-room-id-input");
      if (roomInput) roomInput.value = item.id;
      const roomChip = document.getElementById("matrix-selected-room-chip");
      if (roomChip) roomChip.textContent = "Selected: " + item.label;
      updateSelectionDetails();
      window.dispatchEvent(new CustomEvent("dashboard:matrix-room-selected", {detail: {roomId: item.id}}));
      render();
      return;
    }
    if (state.selectedMessenger === "whatsapp") {
      state.selectedWhatsAppRecipient = item.id;
      const recipientInput = document.getElementById("whatsapp-to-input");
      if (recipientInput) recipientInput.value = item.id;
      updateSelectionDetails();
      render();
      return;
    }
    if (selectDiscordDirectMessage) {
      void selectDiscordDirectMessage(item.source);
      render();
      return;
    }
    state.selectedDmChannelId = item.id;
    state.selectedUserId = item.userId;
    state.selectedUser = item.userId
      ? { id: item.userId, displayName: item.label, tag: String(item.source?.tag || item.label) }
      : null;
    const selectedUserChip = document.getElementById("messaging-selected-user-chip");
    if (selectedUserChip) {
      selectedUserChip.textContent = item.userId ? item.label : "DM recipient unavailable";
    }
    updateSelectionDetails();
    render();
  }

  function renderAvatar(item, button) {
    const avatar = document.createElement("span");
    avatar.className = "rail-direct-message-avatar";
    if (item.avatarUrl) {
      const image = document.createElement("img");
      image.src = item.avatarUrl;
      image.alt = "";
      image.loading = "lazy";
      avatar.appendChild(image);
    } else {
      avatar.textContent = item.initials;
    }
    button.appendChild(avatar);
  }

  function renderItemButton(item, container, kind = "direct-message") {
    const button = document.createElement("button");
    button.className = "rail-direct-message-button rail-" + kind + "-button" + (item.selected ? " active" : "");
    button.type = "button";
    button.title = item.label + (item.meta ? " — " + item.meta : "");
    const noun = state.selectedMessenger === "matrix" ? "Matrix room" : "direct message";
    button.setAttribute("aria-label", "Open " + noun + " " + item.label);
    button.setAttribute("aria-pressed", item.selected ? "true" : "false");
    renderAvatar(item, button);
    const copy = document.createElement("span");
    copy.className = "rail-direct-message-copy";
    const label = document.createElement("strong");
    label.textContent = item.label;
    const meta = document.createElement("span");
    meta.textContent = item.meta;
    copy.append(label, meta);
    button.appendChild(copy);
    button.addEventListener("click", () => selectDirectMessage(item));
    container.appendChild(button);
  }

  function renderMatrixRooms(container, items) {
    const {groups, ungrouped} = getMatrixRoomGroups(items);
    const appendGroup = (title, rooms, ungroupedGroup = false) => {
      const group = document.createElement("section");
      group.className = "rail-matrix-space-group" + (ungroupedGroup ? " is-ungrouped" : "");
      const heading = document.createElement("div");
      heading.className = "rail-matrix-space-heading";
      heading.textContent = title;
      heading.title = title;
      group.appendChild(heading);
      rooms.forEach(room => renderItemButton(room, group, "matrix-room"));
      container.appendChild(group);
    };
    groups.forEach(({space, rooms}) => appendGroup(space.label, rooms));
    if (ungrouped.length > 0 || groups.length === 0) appendGroup("Rooms", ungrouped, true);
  }

  function render() {
    const container = document.getElementById("rail-direct-message-list");
    const section = document.getElementById("rail-direct-messages");
    if (!container || !section) return;
    section.dataset.messenger = String(state.selectedMessenger || "discord");
    const labelNode = document.getElementById("rail-direct-messages-label");
    if (labelNode) labelNode.textContent = state.selectedMessenger === "matrix" ? "Spaces & rooms" : "Direct messages";
    container.replaceChildren();
    const items = getDirectMessages();
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rail-direct-messages-empty";
      empty.textContent = getEmptyMessage();
      empty.title = loadError || empty.textContent;
      container.appendChild(empty);
      return;
    }
    if (state.selectedMessenger === "matrix") {
      renderMatrixRooms(container, items.slice(0, 24));
      return;
    }
    items.slice(0, 12).forEach(item => {
      const button = document.createElement("button");
      button.className = "rail-direct-message-button" + (item.selected ? " active" : "");
      button.type = "button";
      button.title = item.label + (item.meta ? " — " + item.meta : "");
      button.setAttribute("aria-label", "Open direct message with " + item.label);
      button.setAttribute("aria-pressed", item.selected ? "true" : "false");
      renderAvatar(item, button);
      const copy = document.createElement("span");
      copy.className = "rail-direct-message-copy";
      const label = document.createElement("strong");
      label.textContent = item.label;
      const meta = document.createElement("span");
      meta.textContent = item.meta;
      copy.append(label, meta);
      button.appendChild(copy);
      button.addEventListener("click", () => selectDirectMessage(item));
      container.appendChild(button);
    });
  }

  async function refresh() {
    loading = true;
    loadError = "";
    render();
    try {
      if (state.selectedMessenger === "discord") {
        const payload = await request("/api/dms");
        state.dmThreads = Array.isArray(payload) ? payload : [];
        if (!state.selectedDmChannelId && state.selectedUserId) {
          const selectedThread = state.dmThreads.find(thread => String(thread.userId || "") === String(state.selectedUserId));
          if (selectedThread) state.selectedDmChannelId = String(selectedThread.channelId || "");
        }
      } else if (state.selectedMessenger === "telegram" && typeof input?.loadTelegramChats === "function") {
        await input.loadTelegramChats();
      } else if (state.selectedMessenger === "matrix") {
        const payload = await request("/api/matrix/rooms");
        state.matrixRooms = Array.isArray(payload.rooms) ? payload.rooms : [];
      } else if (state.selectedMessenger === "whatsapp") {
        const payload = await request("/api/whatsapp/contacts");
        mergeWhatsAppRecipients(payload.contacts);
      }
    } catch (error) {
      loadError = error?.message || "Could not load direct messages.";
      setOutput(loadError);
    } finally {
      loading = false;
      render();
    }
  }

  function bind() {
    const refreshButton = document.getElementById("rail-direct-messages-refresh");
    if (!refreshButton || refreshButton.dataset.bound === "true") return;
    refreshButton.dataset.bound = "true";
    refreshButton.addEventListener("click", () => void refresh());
    window.addEventListener("dashboard:whatsapp-recipient-saved", event => {
      const to = String(event?.detail?.to || "").trim();
      if (!to) return;
      mergeWhatsAppRecipients([{ to, label: String(event?.detail?.label || to) }]);
      render();
    });
    window.addEventListener("dashboard:matrix-rooms-refreshed", event => {
      const rooms = Array.isArray(event?.detail?.rooms) ? event.detail.rooms : [];
      state.matrixRooms = rooms;
      render();
    });
  }

  bind();
  render();
  return { bind, render, refresh };
}

if (typeof window !== "undefined") {
  window.createDashboardDirectMessageRailHelpers = createDashboardDirectMessageRailHelpers;
}
