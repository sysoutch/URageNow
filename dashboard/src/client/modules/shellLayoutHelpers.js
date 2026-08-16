function createDashboardShellLayoutHelpers(input) {
  let lastShellBand = "";

  function isOverlayShell() {
    return window.innerWidth <= 1380;
  }

  function getShellBand() {
    if (window.innerWidth <= 980) {
      return "compact";
    }
    if (window.innerWidth <= 1380) {
      return "overlay";
    }
    if (window.innerWidth <= 1680) {
      return "split";
    }
    return "wide";
  }

  function applyShellButtonState(button, visible, kind) {
    const usesMessengerLabel = button.getAttribute("data-non-discord-only") === "true";
    const paneLabel = kind === "workspace"
      ? (usesMessengerLabel ? "sidebar" : "servers")
      : "inspector";
    button.classList.toggle("is-open", visible);
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.setAttribute("aria-expanded", visible ? "true" : "false");
    button.dataset.shellState = visible ? "open" : "closed";
    const title = visible
      ? "Hide " + paneLabel
      : "Show " + paneLabel;
    button.setAttribute("title", title);
    button.setAttribute("aria-label", title);
  }

  function syncShellButtons() {
    document.querySelectorAll("[data-shell-toggle='workspace']").forEach(button => {
      applyShellButtonState(button, input.state.workspacePaneVisible, "workspace");
    });
    document.querySelectorAll("[data-shell-toggle='details']").forEach(button => {
      applyShellButtonState(button, input.state.detailPaneVisible, "details");
    });
  }

  function applyShellPaneState() {
    const overlay = isOverlayShell();
    const compact = window.innerWidth <= 980;
    const split = !overlay && window.innerWidth <= 1680;
    const detailsOverlay = overlay && input.state.detailPaneVisible;
    const workspaceOverlay = overlay && input.state.workspacePaneVisible;
    document.body.classList.toggle("compact-workspace", overlay && !input.state.workspacePaneVisible);
    document.body.classList.toggle("compact-details", (overlay || split) && !input.state.detailPaneVisible);
    document.body.classList.toggle("details-collapsed", !input.state.detailPaneVisible);
    document.body.classList.toggle("workspace-collapsed", !input.state.workspacePaneVisible);
    document.body.classList.toggle("details-open", detailsOverlay);
    document.body.classList.toggle("workspace-open", workspaceOverlay);
    document.body.classList.toggle("shell-overlay-open", workspaceOverlay || detailsOverlay);
    document.body.classList.toggle("shell-overlay-mode", overlay);
    document.body.classList.toggle("shell-split-mode", split);
    document.body.classList.toggle("shell-compact-mode", compact);
    const workspaceScrim = document.getElementById("workspace-scrim");
    if (workspaceScrim) {
      workspaceScrim.classList.toggle("hidden", !workspaceOverlay);
    }
    const detailsScrim = document.getElementById("details-scrim");
    if (detailsScrim) {
      detailsScrim.classList.toggle("hidden", !detailsOverlay);
    }
    syncShellButtons();
  }

  function setDetailsPaneVisible(visible) {
    input.state.detailPaneVisible = visible;
    if (isOverlayShell() && visible) {
      input.state.workspacePaneVisible = false;
    }
    applyShellPaneState();
  }

  function setWorkspacePaneVisible(visible) {
    input.state.workspacePaneVisible = visible;
    if (isOverlayShell() && visible) {
      input.state.detailPaneVisible = false;
    }
    applyShellPaneState();
  }

  function enhanceShellChrome() {
    const settingsButton = document.getElementById("open-guild-settings-button");
    if (settingsButton) {
      settingsButton.innerHTML = "<span class='icon-only' aria-hidden='true'>&#9881;</span>";
    }
    const refreshButton = document.getElementById("refresh-workspace");
    if (refreshButton) {
      refreshButton.innerHTML = "<span class='icon-only' aria-hidden='true'>&#10227;</span>";
    }
    const tabConfig = [
      ["messaging", "&#9993;", "Messaging"],
      ["automation", "&#9201;", "Automation"],
      ["guild", "&#9881;", "Guild"],
      ["moderation", "&#128737;", "Moderation"],
      ["activity", "&#128203;", "Activity"]
    ];
    for (const [view, icon, label] of tabConfig) {
      const tab = document.querySelector(".tab-link[data-view='" + view + "']");
      if (tab) {
        tab.innerHTML = "<span class='tab-icon' aria-hidden='true'>" + icon + "</span><span>" + label + "</span>";
      }
    }
    const guildPrompt = document.getElementById("guild-ai-prompt");
    if (guildPrompt) {
      guildPrompt.placeholder = "Create a cozy indie game server with categories for announcements, devlogs, media sharing, bug reports, off-topic chat, and voice hangouts. Also point out permission mistakes or missing channels if you are auditing instead.";
    }
    const auditButton = document.getElementById("run-guild-audit-button");
    if (auditButton) {
      auditButton.textContent = "Run Permission + Structure Audit";
    }
    syncShellButtons();
  }

  function syncResponsiveShell() {
    const shellBand = getShellBand();
    if (shellBand !== lastShellBand) {
      input.state.workspacePaneVisible = shellBand === "wide" || shellBand === "split";
      input.state.detailPaneVisible = shellBand === "wide";
      lastShellBand = shellBand;
    }
    applyShellPaneState();
  }

  function bindOverlayEvents() {
    document.querySelectorAll("[data-shell-toggle='workspace']").forEach(button => {
      button.addEventListener("click", () => {
        setWorkspacePaneVisible(!input.state.workspacePaneVisible);
      });
    });
    document.querySelectorAll("[data-shell-toggle='details']").forEach(button => {
      button.addEventListener("click", () => {
        setDetailsPaneVisible(!input.state.detailPaneVisible);
      });
    });
    const workspaceScrim = document.getElementById("workspace-scrim");
    if (workspaceScrim) {
      workspaceScrim.addEventListener("click", () => {
        setWorkspacePaneVisible(false);
      });
    }
    const detailsScrim = document.getElementById("details-scrim");
    if (detailsScrim) {
      detailsScrim.addEventListener("click", () => {
        setDetailsPaneVisible(false);
      });
    }
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") {
        return;
      }
      if (input.state.workspacePaneVisible && isOverlayShell()) {
        setWorkspacePaneVisible(false);
      }
      if (input.state.detailPaneVisible && (isOverlayShell() || window.innerWidth <= 1680)) {
        setDetailsPaneVisible(false);
      }
    });
  }

  return {
    applyShellPaneState,
    setDetailsPaneVisible,
    setWorkspacePaneVisible,
    enhanceShellChrome,
    syncResponsiveShell,
    bindOverlayEvents
  };
}

if (typeof window !== "undefined") {
  window.createDashboardShellLayoutHelpers = createDashboardShellLayoutHelpers;
}
