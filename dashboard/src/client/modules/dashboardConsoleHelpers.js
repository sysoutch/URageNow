function createDashboardConsoleHelpers(input) {
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const describeClientError = typeof input?.describeClientError === "function" ? input.describeClientError : function describeClientErrorFallback(error, fallback) {
    return error instanceof Error ? error.message : (fallback || "Unknown error.");
  };
  const formatDateTime = typeof input?.formatDateTime === "function" ? input.formatDateTime : value => String(value || "");
  const state = {
    tab: "llm",
    selectedId: "",
    llm: [],
    system: []
  };

  function setConsoleOverlayOpen(isOpen) {
    const overlayNode = document.getElementById("console-overlay");
    if (!overlayNode) {
      return;
    }
    overlayNode.classList.toggle("hidden", !isOpen);
    overlayNode.setAttribute("aria-hidden", isOpen ? "false" : "true");
    document.body.classList.toggle("settings-overlay-open", isOpen);
    if (isOpen) {
      void refreshConsoleHistory();
    }
  }

  function getActiveEntries() {
    return state.tab === "system" ? state.system : state.llm;
  }

  function summarizeText(value, fallback) {
    const trimmed = String(value || "").replace(/\s+/g, " ").trim();
    if (!trimmed) {
      return fallback;
    }
    return trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
  }

  function renderConsoleList() {
    const titleNode = document.getElementById("console-list-title");
    if (titleNode) {
      titleNode.textContent = state.tab === "system" ? "System Logs" : "Prompt History";
    }
    document.querySelectorAll("[data-console-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-console-tab") === state.tab);
    });
    const listNode = document.getElementById("console-event-list");
    if (!listNode) {
      return;
    }
    listNode.innerHTML = "";
    const entries = getActiveEntries();
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = state.tab === "system" ? "No system logs captured yet." : "No LLM prompts captured yet.";
      listNode.appendChild(empty);
      renderConsoleDetail(null);
      return;
    }
    if (!entries.some(entry => entry.id === state.selectedId)) {
      state.selectedId = entries[0].id;
    }
    entries.forEach(entry => {
      const button = document.createElement("button");
      button.className = "console-event-row";
      button.type = "button";
      button.classList.toggle("active", entry.id === state.selectedId);
      button.dataset.consoleEventId = entry.id;
      const title = document.createElement("strong");
      title.textContent = state.tab === "system"
        ? summarizeText(entry.message, "System log")
        : summarizeText(entry.prompt, "LLM prompt");
      const meta = document.createElement("span");
      meta.textContent = state.tab === "system"
        ? [entry.source || "system", entry.level || "info", formatDateTime(entry.createdAt)].filter(Boolean).join(" | ")
        : [entry.provider || "llm", entry.model || "model", entry.ok === false ? "error" : "ok", formatDateTime(entry.createdAt)].filter(Boolean).join(" | ");
      button.append(title, meta);
      button.addEventListener("click", () => {
        state.selectedId = entry.id;
        renderConsoleList();
        renderConsoleDetail(entry);
      });
      listNode.appendChild(button);
    });
    renderConsoleDetail(entries.find(entry => entry.id === state.selectedId) || entries[0]);
  }

  function renderConsoleDetail(entry) {
    const titleNode = document.getElementById("console-detail-title");
    const metaNode = document.getElementById("console-detail-meta");
    const promptNode = document.getElementById("console-prompt-output");
    const responseNode = document.getElementById("console-response-output");
    const reasoningNode = document.getElementById("console-reasoning-output");
    const reasoningBlock = document.getElementById("console-reasoning-block");
    if (!entry) {
      if (titleNode) titleNode.textContent = "Select an entry";
      if (metaNode) metaNode.textContent = "No console entry selected.";
      if (promptNode) promptNode.textContent = "No prompt selected.";
      if (responseNode) responseNode.textContent = "Select an LLM prompt or system log to inspect it.";
      if (reasoningNode) reasoningNode.textContent = "No reasoning captured.";
      if (reasoningBlock) reasoningBlock.classList.toggle("hidden", state.tab === "system");
      return;
    }
    const isSystem = state.tab === "system";
    if (titleNode) {
      titleNode.textContent = isSystem ? (entry.source || "System log") : summarizeText(entry.prompt, "LLM prompt");
    }
    if (metaNode) {
      metaNode.textContent = isSystem
        ? [entry.level || "info", formatDateTime(entry.createdAt)].filter(Boolean).join(" | ")
        : [entry.provider || "llm", entry.model || "model", `${entry.durationMs || 0}ms`, entry.imageCount ? `${entry.imageCount} image(s)` : ""].filter(Boolean).join(" | ");
    }
    if (promptNode) {
      promptNode.textContent = isSystem ? (entry.source || "system") : (entry.prompt || "(empty prompt)");
    }
    if (responseNode) {
      responseNode.textContent = isSystem
        ? [entry.message || "", entry.detail || ""].filter(Boolean).join("\n\n") || "(empty log)"
        : (entry.error ? "Error: " + entry.error : (entry.response || "(empty response)"));
    }
    if (reasoningNode) {
      reasoningNode.textContent = entry.reasoning || "No reasoning captured.";
    }
    if (reasoningBlock) {
      reasoningBlock.classList.toggle("hidden", isSystem);
    }
  }

  async function refreshConsoleHistory() {
    const refreshButton = document.getElementById("console-refresh-button");
    if (refreshButton) {
      refreshButton.disabled = true;
    }
    try {
      const data = await request("/api/console-history");
      state.llm = Array.isArray(data.llm) ? data.llm : [];
      state.system = Array.isArray(data.system) ? data.system : [];
      renderConsoleList();
    } catch (error) {
      const responseNode = document.getElementById("console-response-output");
      if (responseNode) {
        responseNode.textContent = describeClientError(error, "Failed to load console history.");
      }
    } finally {
      if (refreshButton) {
        refreshButton.disabled = false;
      }
    }
  }

  function switchConsoleTab(tab) {
    state.tab = tab === "system" ? "system" : "llm";
    state.selectedId = "";
    renderConsoleList();
  }

  function bindEvents() {
    document.getElementById("rail-console-button")?.addEventListener("click", () => {
      setConsoleOverlayOpen(true);
    });
    ["close-console-overlay-button", "close-console-overlay-footer-button"].forEach(id => {
      document.getElementById(id)?.addEventListener("click", () => {
        setConsoleOverlayOpen(false);
      });
    });
    document.getElementById("console-overlay-backdrop")?.addEventListener("click", () => {
      setConsoleOverlayOpen(false);
    });
    document.getElementById("console-refresh-button")?.addEventListener("click", () => {
      void refreshConsoleHistory();
    });
    document.querySelectorAll("[data-console-tab]").forEach(button => {
      button.addEventListener("click", () => {
        switchConsoleTab(button.getAttribute("data-console-tab"));
      });
    });
  }

  return {
    bindEvents,
    refreshConsoleHistory,
    setConsoleOverlayOpen
  };
}
