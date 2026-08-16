function createDashboardChatReplyStyleEditor(input) {
  const request = typeof input?.request === "function"
    ? input.request
    : function requestFallback() {
      return Promise.reject(new Error("Dashboard request helper is unavailable."));
    };
  let state = {activeReplyStyleId: "empty", replyStyles: []};
  let editingId = "empty";
  let pendingSave = Promise.resolve();
  const subscribers = new Set();

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getNodes() {
    return {
      select: document.getElementById("ask-reply-style-select"),
      labelInput: document.getElementById("ask-reply-style-label"),
      promptInput: document.getElementById("ask-reply-style-prompt"),
      saveButton: document.getElementById("ask-reply-style-save-button"),
      addButton: document.getElementById("ask-reply-style-add-button"),
      deleteButton: document.getElementById("ask-reply-style-delete-button"),
      status: document.getElementById("ask-reply-style-status")
    };
  }

  function setStatus(message) {
    const status = getNodes().status;
    if (status) status.textContent = String(message || "");
  }

  function getActiveStyle() {
    const activeId = normalizeId(state.activeReplyStyleId || "empty");
    return state.replyStyles.find(entry => normalizeId(entry?.id) === activeId) || state.replyStyles[0] || null;
  }

  function getSnapshot() {
    return {
      activeReplyStyleId: state.activeReplyStyleId,
      replyStyles: state.replyStyles.map(entry => ({...entry}))
    };
  }

  function notifySubscribers() {
    const snapshot = getSnapshot();
    subscribers.forEach(subscriber => subscriber(snapshot));
  }

  function subscribe(subscriber) {
    if (typeof subscriber !== "function") return () => {};
    subscribers.add(subscriber);
    subscriber(getSnapshot());
    return () => subscribers.delete(subscriber);
  }

  function render() {
    const nodes = getNodes();
    if (!nodes.select) return;
    while (nodes.select.firstChild) nodes.select.removeChild(nodes.select.firstChild);
    state.replyStyles.forEach(style => {
      const option = document.createElement("option");
      option.value = style.id;
      option.textContent = style.label || style.id;
      nodes.select.appendChild(option);
    });
    nodes.select.value = state.activeReplyStyleId || state.replyStyles[0]?.id || "";
    editingId = normalizeId(nodes.select.value || state.activeReplyStyleId || "empty");
    const active = getActiveStyle();
    if (nodes.labelInput) nodes.labelInput.value = active?.label || "";
    if (nodes.promptInput) nodes.promptInput.value = active?.prompt || "";
    if (nodes.deleteButton) nodes.deleteButton.disabled = !active || active.isBuiltIn === true;
    notifySubscribers();
  }

  function capture() {
    const nodes = getNodes();
    const selectedId = normalizeId(nodes.select?.value || state.activeReplyStyleId || "empty");
    const currentEditingId = normalizeId(editingId || selectedId);
    const replyStyles = state.replyStyles.map(entry => {
      if (normalizeId(entry?.id) !== currentEditingId) return entry;
      return {
        ...entry,
        label: nodes.labelInput?.value.trim() || entry.label,
        prompt: nodes.promptInput?.value.trim() || ""
      };
    });
    return {
      activeReplyStyleId: selectedId || currentEditingId || "empty",
      replyStyles
    };
  }

  async function load() {
    const response = await fetch("/api/chat-reply-style", {headers: {accept: "application/json"}});
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Failed to load reply style settings.");
    }
    state = {
      activeReplyStyleId: payload.activeReplyStyleId || "empty",
      replyStyles: Array.isArray(payload.replyStyles) ? payload.replyStyles : []
    };
    render();
    setStatus("Loaded reply styles from SOUL.md.");
  }

  async function save() {
    const next = capture();
    const payload = await request("/api/chat-reply-style", next);
    state = {
      activeReplyStyleId: payload.activeReplyStyleId || next.activeReplyStyleId,
      replyStyles: Array.isArray(payload.replyStyles) ? payload.replyStyles : next.replyStyles
    };
    render();
    setStatus("Saved reply style to SOUL.md.");
  }

  function add() {
    const next = capture();
    const existingIds = new Set(next.replyStyles.map(entry => normalizeId(entry?.id)));
    let id = "custom-reply-style";
    let suffix = 2;
    while (existingIds.has(id)) {
      id = "custom-reply-style-" + suffix;
      suffix += 1;
    }
    next.replyStyles.push({
      id,
      label: "Custom Reply Style",
      prompt: "Describe exactly how LazyDev should format every reply.",
      isBuiltIn: false
    });
    next.activeReplyStyleId = id;
    state = next;
    render();
    setStatus("Added a custom reply style. Edit it, then save.");
  }

  function remove() {
    const active = getActiveStyle();
    if (!active || active.isBuiltIn === true) {
      setStatus("Built-in reply styles cannot be deleted.");
      return;
    }
    const next = capture();
    next.replyStyles = next.replyStyles.filter(entry => normalizeId(entry?.id) !== normalizeId(active.id));
    next.activeReplyStyleId = next.replyStyles[0]?.id || "empty";
    state = next;
    render();
    setStatus("Deleted the custom reply style. Save to persist.");
  }

  function bind() {
    const nodes = getNodes();
    if (!nodes.select) return;
    nodes.select.addEventListener("change", () => {
      state = capture();
      state.activeReplyStyleId = normalizeId(nodes.select.value) || "empty";
      editingId = state.activeReplyStyleId;
      render();
      setStatus("Saving selected reply style...");
      pendingSave = save().catch(error => {
        setStatus(error?.message || "Failed to activate reply style.");
      });
    });
    nodes.saveButton?.addEventListener("click", () => {
      pendingSave = save().catch(error => {
        setStatus(error?.message || "Failed to save reply style.");
      });
    });
    nodes.addButton?.addEventListener("click", add);
    nodes.deleteButton?.addEventListener("click", remove);
    void load().catch(error => setStatus(error?.message || "Failed to load reply styles."));
  }

  return {
    bind,
    capture,
    render,
    load,
    save,
    add,
    remove,
    getSnapshot,
    subscribe,
    flush: () => pendingSave
  };
}
