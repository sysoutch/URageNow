function createDashboardQuickActionsHelpers(input) {
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : function setOutputFallback() {};
  const switchView = typeof input?.switchView === "function" ? input.switchView : function switchViewFallback() {};
  const setResourcesOverlayOpen = typeof input?.setResourcesOverlayOpen === "function" ? input.setResourcesOverlayOpen : function setResourcesOverlayOpenFallback() {};
  const setSkillsOverlayOpen = typeof input?.setSkillsOverlayOpen === "function" ? input.setSkillsOverlayOpen : function setSkillsOverlayOpenFallback() {};
  const setAboutOverlayOpen = typeof input?.setAboutOverlayOpen === "function" ? input.setAboutOverlayOpen : function setAboutOverlayOpenFallback() {};
  const setSettingsOverlayOpen = typeof input?.setSettingsOverlayOpen === "function" ? input.setSettingsOverlayOpen : function setSettingsOverlayOpenFallback() {};
  const setRuntimeOverlayOpen = typeof input?.setRuntimeOverlayOpen === "function" ? input.setRuntimeOverlayOpen : function setRuntimeOverlayOpenFallback() {};
  const setConsoleOverlayOpen = typeof input?.setConsoleOverlayOpen === "function" ? input.setConsoleOverlayOpen : function setConsoleOverlayOpenFallback() {};
  const state = {
    tab: "slash",
    toolQuery: "",
    commandHistory: []
  };
  const frameShortcutMarker = "__urageQuickActionsBridgeBound";

  function getQuickActionsOverlay() {
    return document.getElementById("quick-actions-overlay");
  }

  function getQuickToolOverlay() {
    return document.getElementById("quick-tool-overlay");
  }

  function isOverlayVisible(overlay) {
    return !!(overlay && !overlay.classList.contains("hidden"));
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeSearchText(value) {
    return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getToolCatalogEntriesSafe() {
    if (typeof getToolsCatalogEntries !== "function") {
      return [];
    }
    try {
      return getToolsCatalogEntries();
    } catch {
      return [];
    }
  }

  function normalizeToolEntrySourcePath(entry) {
    return typeof normalizeToolSourcePath === "function"
      ? normalizeToolSourcePath(entry?.sourcePath || "")
      : String(entry?.sourcePath || "").trim().toLowerCase();
  }

  function scoreToolEntry(entry, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return 0;
    }
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    const id = normalizeSearchText(entry?.id || "");
    const title = normalizeSearchText(entry?.title || "");
    const category = normalizeSearchText(entry?.categoryLabel || "");
    const description = normalizeSearchText(entry?.description || "");
    const sourcePath = normalizeSearchText(entry?.sourcePath || "");
    const haystack = [id, title, category, description, sourcePath].filter(Boolean).join(" ");
    if (!haystack) {
      return -1;
    }
    let score = 0;
    if (title === normalizedQuery) score += 220;
    if (id === normalizedQuery) score += 210;
    if (title.startsWith(normalizedQuery)) score += 120;
    if (id.startsWith(normalizedQuery)) score += 110;
    if (sourcePath.includes(normalizedQuery)) score += 60;
    if (category.includes(normalizedQuery)) score += 30;
    queryTokens.forEach((token, index) => {
      if (title.includes(token)) score += 28 - Math.min(index, 10);
      if (id.includes(token)) score += 24 - Math.min(index, 10);
      if (category.includes(token)) score += 12 - Math.min(index, 8);
      if (description.includes(token)) score += 8 - Math.min(index, 6);
      if (sourcePath.includes(token)) score += 10 - Math.min(index, 6);
    });
    return score;
  }

  function findBestToolMatch(query) {
    const entries = getToolCatalogEntriesSafe();
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return null;
    }
    return entries
      .map(entry => ({ entry, score: scoreToolEntry(entry, normalizedQuery) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || String(a.entry.title || "").localeCompare(String(b.entry.title || "")))
      .map(result => result.entry)[0] || null;
  }

  function getFilteredToolEntries() {
    const query = state.toolQuery;
    const entries = getToolCatalogEntriesSafe();
    if (!normalizeText(query)) {
      return entries.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }
    return entries
      .map(entry => ({ entry, score: scoreToolEntry(entry, query) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || String(a.entry.title || "").localeCompare(String(b.entry.title || "")))
      .map(result => result.entry);
  }

  function syncOverlayBodyState() {
    const visibleOverlay = document.querySelector(".runtime-overlay:not(.hidden), .tools-readme-overlay:not(.hidden), .quick-tool-overlay:not(.hidden)");
    document.body.classList.toggle("settings-overlay-open", !!visibleOverlay);
  }

  function closeQuickToolOverlay() {
    const overlay = getQuickToolOverlay();
    if (!overlay) {
      return;
    }
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    const frame = document.getElementById("quick-tool-overlay-frame");
    if (frame) {
      frame.setAttribute("src", "about:blank");
    }
    syncOverlayBodyState();
  }

  function openQuickToolOverlay(entry) {
    const sourcePath = normalizeText(entry?.sourcePath);
    const overlay = getQuickToolOverlay();
    const frame = document.getElementById("quick-tool-overlay-frame");
    const titleNode = document.getElementById("quick-tool-overlay-title");
    const metaNode = document.getElementById("quick-tool-overlay-meta");
    const workspaceButton = document.getElementById("quick-tool-overlay-open-workspace-button");
    if (!overlay || !frame || !sourcePath) {
      return;
    }
    overlay.dataset.toolId = normalizeText(entry?.id);
    overlay.dataset.toolSource = sourcePath;
    if (titleNode) {
      titleNode.textContent = normalizeText(entry?.title) || "Tool Overlay";
    }
    if (metaNode) {
      metaNode.textContent = normalizeText(entry?.description) || normalizeText(entry?.categoryLabel) || "Local tool overlay";
    }
    if (workspaceButton) {
      workspaceButton.disabled = false;
    }
    frame.setAttribute("src", sourcePath);
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    setQuickActionsOverlayOpen(false);
    syncOverlayBodyState();
    setOutput("Opened " + (normalizeText(entry?.title) || "tool") + " as an overlay.");
  }

  function activateToolInWorkspace(entry) {
    const sourcePath = normalizeText(entry?.sourcePath);
    if (!sourcePath) {
      return;
    }
    switchView("tools");
    if (typeof activateToolWorkspaceBySourcePath === "function") {
      activateToolWorkspaceBySourcePath(sourcePath);
    }
    setOutput("Opened " + (normalizeText(entry?.title) || "tool") + " in the tools workspace.");
  }

  function renderSlashCommandExamples() {
    const exampleList = document.getElementById("quick-actions-command-list");
    if (!exampleList) {
      return;
    }
    const entries = [
      { command: "/tool gif viewer", label: "Open GIF Viewer as overlay" },
      { command: "/tool 3d model viewer", label: "Open 3D Model Viewer as overlay" },
      { command: "/resources", label: "Open Resources overlay" },
      { command: "/console", label: "Open Console overlay" },
      { command: "/settings", label: "Open Settings overlay" },
      { command: "/view automation", label: "Switch to Automation" }
    ];
    exampleList.innerHTML = entries.map(entry => {
      return "<button class=\"secondary quick-actions-command-chip\" type=\"button\" data-quick-command=\"" + escapeHtml(entry.command) + "\">"
        + "<strong>" + escapeHtml(entry.command) + "</strong><span>" + escapeHtml(entry.label) + "</span>"
        + "</button>";
    }).join("");
    exampleList.querySelectorAll("[data-quick-command]").forEach(button => {
      button.addEventListener("click", () => {
        const command = normalizeText(button.getAttribute("data-quick-command"));
        const inputNode = document.getElementById("quick-actions-command-input");
        if (inputNode && typeof inputNode.value === "string") {
          inputNode.value = command;
        }
        void runQuickActionCommand(command);
      });
    });
  }

  function renderToolResults() {
    const listNode = document.getElementById("quick-actions-tool-results");
    if (!listNode) {
      return;
    }
    const entries = getFilteredToolEntries();
    if (entries.length === 0) {
      listNode.innerHTML = "<div class=\"empty-state quick-actions-empty\">No tools matched that search.</div>";
      return;
    }
    listNode.innerHTML = entries.map(entry => {
      return "<article class=\"quick-actions-tool-card\" data-quick-tool-id=\"" + escapeHtml(entry.id) + "\">"
        + "<div class=\"quick-actions-tool-card-copy\"><strong>" + escapeHtml(entry.title) + "</strong><span>" + escapeHtml(entry.description || entry.categoryLabel || "Local tool") + "</span><code>" + escapeHtml(normalizeToolEntrySourcePath(entry)) + "</code></div>"
        + "<div class=\"quick-actions-tool-card-actions\"><button class=\"secondary mini-button\" type=\"button\" data-quick-tool-open=\"" + escapeHtml(entry.id) + "\">Open Overlay</button><button class=\"secondary mini-button\" type=\"button\" data-quick-tool-workspace=\"" + escapeHtml(entry.id) + "\">Open Workspace</button></div>"
        + "</article>";
    }).join("");
    listNode.querySelectorAll("[data-quick-tool-open]").forEach(button => {
      button.addEventListener("click", () => {
        const toolId = normalizeText(button.getAttribute("data-quick-tool-open"));
        const entry = getToolCatalogEntriesSafe().find(item => item.id === toolId) || null;
        if (entry) {
          openQuickToolOverlay(entry);
        }
      });
    });
    listNode.querySelectorAll("[data-quick-tool-workspace]").forEach(button => {
      button.addEventListener("click", () => {
        const toolId = normalizeText(button.getAttribute("data-quick-tool-workspace"));
        const entry = getToolCatalogEntriesSafe().find(item => item.id === toolId) || null;
        if (entry) {
          setQuickActionsOverlayOpen(false);
          activateToolInWorkspace(entry);
        }
      });
    });
  }

  function switchQuickActionsTab(tab) {
    state.tab = tab === "tools" ? "tools" : "slash";
    document.querySelectorAll("[data-quick-actions-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-quick-actions-tab") === state.tab);
    });
    document.querySelectorAll("[data-quick-actions-panel]").forEach(panel => {
      panel.classList.toggle("active", panel.getAttribute("data-quick-actions-panel") === state.tab);
    });
    if (state.tab === "tools") {
      renderToolResults();
      document.getElementById("quick-actions-tool-search")?.focus();
      return;
    }
    renderSlashCommandExamples();
    document.getElementById("quick-actions-command-input")?.focus();
  }

  function setQuickActionsOverlayOpen(isOpen, options = {}) {
    const overlay = getQuickActionsOverlay();
    if (!overlay) {
      return;
    }
    overlay.classList.toggle("hidden", !isOpen);
    overlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (isOpen) {
      switchQuickActionsTab(options.tab === "tools" ? "tools" : state.tab);
    }
    syncOverlayBodyState();
  }

  function closeQuickActionsOverlays() {
    const quickActionsOpen = isOverlayVisible(getQuickActionsOverlay());
    const quickToolOpen = isOverlayVisible(getQuickToolOverlay());
    if (!quickActionsOpen && !quickToolOpen) {
      return false;
    }
    if (quickActionsOpen) {
      setQuickActionsOverlayOpen(false);
    }
    if (quickToolOpen) {
      closeQuickToolOverlay();
    }
    return true;
  }

  function toggleQuickActionsOverlay() {
    const quickActionsOpen = isOverlayVisible(getQuickActionsOverlay());
    if (quickActionsOpen) {
      setQuickActionsOverlayOpen(false);
      return;
    }
    setQuickActionsOverlayOpen(true);
  }

  function rememberCommand(command) {
    const normalized = normalizeText(command);
    if (!normalized) {
      return;
    }
    state.commandHistory = [normalized].concat(state.commandHistory.filter(entry => entry !== normalized)).slice(0, 8);
  }

  function openNamedOverlay(command) {
    if (command === "/resources") {
      setQuickActionsOverlayOpen(false);
      setResourcesOverlayOpen(true);
      return "Opened Resources.";
    }
    if (command === "/skills") {
      setQuickActionsOverlayOpen(false);
      setSkillsOverlayOpen(true);
      return "Opened Skills.";
    }
    if (command === "/about") {
      setQuickActionsOverlayOpen(false);
      setAboutOverlayOpen(true);
      return "Opened About.";
    }
    if (command === "/settings") {
      setQuickActionsOverlayOpen(false);
      setSettingsOverlayOpen(true);
      return "Opened Settings.";
    }
    if (command === "/runtime") {
      setQuickActionsOverlayOpen(false);
      setRuntimeOverlayOpen(true);
      return "Opened Runtime controls.";
    }
    if (command === "/console") {
      setQuickActionsOverlayOpen(false);
      setConsoleOverlayOpen(true);
      return "Opened Console.";
    }
    return "";
  }

  function normalizeViewCommandTarget(value) {
    const target = normalizeSearchText(value);
    if (!target) {
      return "";
    }
    if (target === "studio" || target === "ai") return "ai";
    if (target === "tools" || target === "toolbox") return "tools";
    if (target === "dashboard" || target === "discord") return "dashboard";
    if (target === "automation" || target === "schedule") return "automation";
    if (target === "messaging" || target === "messages") return "messaging";
    if (target === "messenger" || target === "telegram" || target === "matrix" || target === "whatsapp") return "messenger";
    if (target === "guild" || target === "server") return "guild";
    if (target === "moderation") return "moderation";
    if (target === "activity") return "activity";
    if (target === "profile") return "profile";
    return "";
  }

  async function runQuickActionCommand(commandText) {
    const rawCommand = normalizeText(commandText);
    const statusNode = document.getElementById("quick-actions-command-status");
    if (!rawCommand) {
      if (statusNode) {
        statusNode.textContent = "Enter a slash command.";
      }
      return;
    }
    rememberCommand(rawCommand);
    const normalizedCommand = rawCommand.toLowerCase();
    const overlayMessage = openNamedOverlay(normalizedCommand);
    if (overlayMessage) {
      if (statusNode) {
        statusNode.textContent = overlayMessage;
      }
      setOutput(overlayMessage);
      return;
    }
    const toolMatch = rawCommand.match(/^\/tool(?:\s+(.+))?$/i);
    if (toolMatch) {
      const query = normalizeText(toolMatch[1]);
      if (!query) {
        if (statusNode) {
          statusNode.textContent = "Add a tool name after /tool.";
        }
        return;
      }
      const entry = findBestToolMatch(query);
      if (!entry) {
        if (statusNode) {
          statusNode.textContent = "No tool matched \"" + query + "\".";
        }
        return;
      }
      if (statusNode) {
        statusNode.textContent = "Opening " + entry.title + "...";
      }
      openQuickToolOverlay(entry);
      return;
    }
    const viewMatch = rawCommand.match(/^\/view(?:\s+(.+))?$/i);
    if (viewMatch) {
      const targetView = normalizeViewCommandTarget(viewMatch[1]);
      if (!targetView) {
        if (statusNode) {
          statusNode.textContent = "Unknown /view target.";
        }
        return;
      }
      setQuickActionsOverlayOpen(false);
      switchView(targetView);
      const message = "Opened " + targetView + ".";
      if (statusNode) {
        statusNode.textContent = message;
      }
      setOutput(message);
      return;
    }
    if (statusNode) {
      statusNode.textContent = "Unknown quick action: " + rawCommand;
    }
  }

  function isQuickActionsShortcut(event) {
    if (!event || !(event.ctrlKey || event.metaKey)) {
      return false;
    }
    const key = String(event.key || "").trim();
    const code = String(event.code || "").trim();
    if (key === "/" || key === "?") {
      return true;
    }
    if (code === "Slash" || code === "NumpadDivide") {
      return true;
    }
    return event.shiftKey && code === "Digit7";
  }

  function handleQuickActionsKeyDown(event) {
    if (isQuickActionsShortcut(event)) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      toggleQuickActionsOverlay();
      return;
    }
    if (event.key === "Escape" && closeQuickActionsOverlays()) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }
  }

  function bindFrameShortcutWindow(targetWindow) {
    if (!targetWindow || targetWindow === window) {
      return;
    }
    try {
      if (targetWindow[frameShortcutMarker]) {
        return;
      }
      targetWindow[frameShortcutMarker] = true;
      targetWindow.addEventListener("keydown", event => {
        if (isQuickActionsShortcut(event)) {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("dashboard:toggle-quick-actions"));
          return;
        }
        if (event.key === "Escape") {
          window.dispatchEvent(new CustomEvent("dashboard:escape-quick-actions"));
        }
      }, true);
    } catch {}
  }

  function bindFrameShortcutBridge(frameNode) {
    if (!frameNode || frameNode.dataset.quickActionsBridgeBound === "1") {
      return;
    }
    frameNode.dataset.quickActionsBridgeBound = "1";
    const bindCurrentWindow = () => {
      try {
        bindFrameShortcutWindow(frameNode.contentWindow);
      } catch {}
    };
    frameNode.addEventListener("load", bindCurrentWindow);
    bindCurrentWindow();
  }

  function observeFrameShortcuts() {
    document.querySelectorAll("iframe").forEach(bindFrameShortcutBridge);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          if (node.tagName === "IFRAME") {
            bindFrameShortcutBridge(node);
          }
          node.querySelectorAll?.("iframe").forEach(bindFrameShortcutBridge);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function bindEvents() {
    window.addEventListener("keydown", handleQuickActionsKeyDown, true);
    document.addEventListener("keydown", handleQuickActionsKeyDown, true);
    window.addEventListener("dashboard:toggle-quick-actions", () => {
      toggleQuickActionsOverlay();
    });
    window.addEventListener("dashboard:escape-quick-actions", () => {
      closeQuickActionsOverlays();
    });
    document.querySelectorAll("[data-quick-actions-tab]").forEach(button => {
      button.addEventListener("click", () => {
        switchQuickActionsTab(button.getAttribute("data-quick-actions-tab"));
      });
    });
    document.getElementById("quick-actions-overlay-backdrop")?.addEventListener("click", () => {
      setQuickActionsOverlayOpen(false);
    });
    document.getElementById("close-quick-actions-overlay-button")?.addEventListener("click", () => {
      setQuickActionsOverlayOpen(false);
    });
    document.getElementById("close-quick-actions-overlay-footer-button")?.addEventListener("click", () => {
      setQuickActionsOverlayOpen(false);
    });
    document.getElementById("quick-actions-command-run-button")?.addEventListener("click", () => {
      const inputNode = document.getElementById("quick-actions-command-input");
      void runQuickActionCommand(inputNode && typeof inputNode.value === "string" ? inputNode.value : "");
    });
    document.getElementById("quick-actions-command-input")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void runQuickActionCommand(event.currentTarget.value);
      }
    });
    document.getElementById("quick-actions-tool-search")?.addEventListener("input", event => {
      state.toolQuery = event.currentTarget.value;
      renderToolResults();
    });
    document.getElementById("quick-actions-open-tools-tab-button")?.addEventListener("click", () => {
      switchQuickActionsTab("tools");
    });
    document.getElementById("quick-tool-overlay-backdrop")?.addEventListener("click", closeQuickToolOverlay);
    document.getElementById("close-quick-tool-overlay-button")?.addEventListener("click", closeQuickToolOverlay);
    document.getElementById("quick-tool-overlay-open-workspace-button")?.addEventListener("click", () => {
      const overlay = getQuickToolOverlay();
      if (!overlay) {
        return;
      }
      const sourcePath = normalizeText(overlay.dataset.toolSource);
      const entry = getToolCatalogEntriesSafe().find(item => normalizeText(item.sourcePath) === sourcePath || item.id === normalizeText(overlay.dataset.toolId)) || null;
      if (entry) {
        closeQuickToolOverlay();
        activateToolInWorkspace(entry);
      }
    });
    observeFrameShortcuts();
    renderSlashCommandExamples();
    renderToolResults();
  }

  return {
    bindEvents,
    setQuickActionsOverlayOpen,
    closeQuickToolOverlay
  };
}

if (typeof window !== "undefined") {
  window.createDashboardQuickActionsHelpers = createDashboardQuickActionsHelpers;
}
