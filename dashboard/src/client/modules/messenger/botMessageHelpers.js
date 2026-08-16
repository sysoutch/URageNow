function createDashboardBotMessageHelpers(input) {
  const state = input?.state || {};
  const clearChildren = typeof input?.clearChildren === "function" ? input.clearChildren : function clearChildrenFallback(node) {
    if (node) {
      node.innerHTML = "";
    }
  };
  const escapeHtml = typeof input?.escapeHtml === "function" ? input.escapeHtml : value => String(value || "");
  const formatDateTime = typeof input?.formatDateTime === "function" ? input.formatDateTime : value => String(value || "Unknown");
  const renderMarkdownInto = typeof input?.renderMarkdownInto === "function" ? input.renderMarkdownInto : function renderMarkdownIntoFallback() {};
  const renderMessengerDashboardView = typeof input?.renderMessengerDashboardView === "function"
    ? input.renderMessengerDashboardView
    : function renderMessengerDashboardViewFallback() {};

  function updateBotMessageSelectionSummary() {
    const selected = state.botMessages.find(item => item.id === state.selectedBotMessageId) || null;
    const idChip = document.getElementById("bot-message-id-chip");
    if (idChip) {
      idChip.textContent = selected ? "Editing " + selected.id.slice(0, 10) + "..." : "No bot message selected";
    }
    const timeChip = document.getElementById("bot-message-time-chip");
    if (timeChip) {
      if (!selected) {
        timeChip.textContent = "Pick a recent bot message to edit";
      } else {
        timeChip.textContent = selected.editedAt
          ? "Edited " + formatDateTime(selected.editedAt)
          : "Posted " + formatDateTime(selected.createdAt);
      }
    }
    renderMarkdownInto("bot-message-preview", selected ? selected.content || "" : "", "Select a recent bot message to preview it here.");
  }

  function renderBotMessageList() {
    const container = document.getElementById("bot-message-list");
    const editor = document.getElementById("bot-message-edit-text");
    if (!container || !editor) {
      return;
    }
    clearChildren(container);
    if (!state.selectedChannelId) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "Select a channel to load recent bot messages.";
      container.appendChild(empty);
      editor.value = "";
      state.selectedBotMessageId = "";
      updateBotMessageSelectionSummary();
      renderMessengerDashboardView();
      return;
    }
    if (state.botMessages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No recent bot messages found in this channel.";
      container.appendChild(empty);
      editor.value = "";
      state.selectedBotMessageId = "";
      updateBotMessageSelectionSummary();
      renderMessengerDashboardView();
      return;
    }
    for (const entry of state.botMessages) {
      const row = document.createElement("button");
      row.className = "bot-message-row" + (entry.id === state.selectedBotMessageId ? " active" : "");
      const previewLine = (entry.content || "").split(/\r?\n/)[0] || "(empty message)";
      const clippedPreview = previewLine.length > 90 ? previewLine.slice(0, 90) + "..." : previewLine;
      const metaDate = entry.editedAt ? "Edited " + formatDateTime(entry.editedAt) : "Posted " + formatDateTime(entry.createdAt);
      row.innerHTML =
        "<div class='bot-message-row-title'><strong>" + escapeHtml(clippedPreview) + "</strong><span class='bot-message-row-tag'>" + escapeHtml(entry.id.slice(0, 8)) + "...</span></div>"
        + "<div class='bot-message-row-meta'>" + escapeHtml(metaDate) + "</div>";
      row.addEventListener("click", () => {
        state.selectedBotMessageId = entry.id;
        editor.value = entry.content || "";
        renderBotMessageList();
      });
      container.appendChild(row);
    }
    const selected = state.botMessages.find(item => item.id === state.selectedBotMessageId) || state.botMessages[0];
    if (selected) {
      state.selectedBotMessageId = selected.id;
      editor.value = selected.content || "";
    }
    updateBotMessageSelectionSummary();
    renderMessengerDashboardView();
  }

  return {
    updateBotMessageSelectionSummary,
    renderBotMessageList
  };
}
