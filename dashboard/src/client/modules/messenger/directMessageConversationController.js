function createDashboardDirectMessageConversationController(input) {
  const state = input?.state || {};
  const request = typeof input?.request === "function" ? input.request : async () => [];
  const switchView = typeof input?.switchView === "function" ? input.switchView : function switchViewFallback() {};
  const updateSelectionDetails = typeof input?.updateSelectionDetails === "function" ? input.updateSelectionDetails : function updateSelectionDetailsFallback() {};

  function setStatus(message, isError) {
    const node = document.getElementById("dm-conversation-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", isError === true);
  }

  function renderAttachment(url, container) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open attachment";
    container.appendChild(link);
  }

  function render() {
    const container = document.getElementById("dm-conversation-list");
    if (!container) return;
    container.replaceChildren();
    const messages = Array.isArray(state.dmMessages) ? state.dmMessages : [];
    if (!state.selectedDmChannelId) {
      const empty = document.createElement("div");
      empty.className = "dm-conversation-empty";
      empty.textContent = "Select a direct-message user from the rail.";
      container.appendChild(empty);
      return;
    }
    if (messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "dm-conversation-empty";
      empty.textContent = "No messages are cached in this conversation yet.";
      container.appendChild(empty);
      return;
    }
    messages.forEach(message => {
      const entry = document.createElement("article");
      entry.className = "dm-conversation-entry";
      const header = document.createElement("div");
      header.className = "dm-conversation-entry-header";
      const author = document.createElement("strong");
      author.textContent = String(message.authorTag || message.authorId || "Unknown user");
      const time = document.createElement("time");
      time.dateTime = String(message.createdAt || "");
      time.textContent = message.createdAt ? new Date(message.createdAt).toLocaleString() : "";
      header.append(author, time);
      const content = document.createElement("p");
      content.textContent = String(message.content || "");
      entry.append(header, content);
      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      if (attachments.length > 0) {
        const attachmentList = document.createElement("div");
        attachmentList.className = "dm-conversation-attachments";
        attachments.forEach(url => renderAttachment(String(url), attachmentList));
        entry.appendChild(attachmentList);
      }
      container.appendChild(entry);
    });
    container.scrollTop = container.scrollHeight;
  }

  async function loadSelectedConversation() {
    const channelId = String(state.selectedDmChannelId || "").trim();
    if (!channelId) {
      state.dmMessages = [];
      render();
      setStatus("Select a direct-message user first.");
      return [];
    }
    setStatus("Loading direct messages...");
    try {
      const payload = await request("/api/dm-messages?channelId=" + encodeURIComponent(channelId));
      state.dmMessages = Array.isArray(payload) ? payload : [];
      render();
      setStatus("Showing " + state.dmMessages.length + " message" + (state.dmMessages.length === 1 ? "" : "s") + ".");
      return state.dmMessages;
    } catch (error) {
      state.dmMessages = [];
      render();
      setStatus(error?.message || "Could not load direct messages.", true);
      return [];
    }
  }

  async function selectConversation(thread) {
    state.selectedDmChannelId = String(thread?.channelId || thread?.id || "").trim();
    state.selectedUserId = String(thread?.userId || "").trim();
    state.selectedUser = state.selectedUserId
      ? {
          id: state.selectedUserId,
          displayName: String(thread?.displayName || thread?.label || thread?.tag || "Discord user"),
          tag: String(thread?.tag || thread?.displayName || thread?.label || state.selectedUserId)
        }
      : null;
    const selectedUserChip = document.getElementById("messaging-selected-user-chip");
    if (selectedUserChip) selectedUserChip.textContent = state.selectedUser?.displayName || "DM recipient unavailable";
    updateSelectionDetails();
    switchView("messaging");
    return loadSelectedConversation();
  }

  render();
  return { render, loadSelectedConversation, selectConversation };
}

if (typeof window !== "undefined") {
  window.createDashboardDirectMessageConversationController = createDashboardDirectMessageConversationController;
}
