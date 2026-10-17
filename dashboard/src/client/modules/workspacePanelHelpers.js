let dashboardWorkspaceSubviewState = null;
const dashboardWorkspacePendingSubview = { guild: null, moderation: null };

function switchDashboardWorkspaceSubview(group, panel) {
  const stateKey = group === "guild" ? "guildSubview" : "moderationSubview";
  dashboardWorkspacePendingSubview[group] = panel;
  if (dashboardWorkspaceSubviewState) dashboardWorkspaceSubviewState[stateKey] = panel;
  document.querySelectorAll("[data-subview]").forEach(button => {
    const value = button.getAttribute("data-subview") || "";
    if (!value.startsWith(group + "-")) return;
    button.classList.toggle("active", value === panel);
  });
  document.querySelectorAll("[data-subview-panel]").forEach(node => {
    const value = node.getAttribute("data-subview-panel") || "";
    if (!value.startsWith(group + "-")) return;
    node.classList.toggle("hidden-by-subview", value !== panel);
  });
}

function bindDashboardWorkspaceSubviewClicks() {
  if (document.documentElement.dataset.subviewTabsBound === "true") return;
  document.documentElement.dataset.subviewTabsBound = "true";
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-subview]") : null;
    if (!target) return;
    const value = target.getAttribute("data-subview") || "";
    if (value.startsWith("guild-")) {
      event.preventDefault();
      switchDashboardWorkspaceSubview("guild", value);
    } else if (value.startsWith("moderation-")) {
      event.preventDefault();
      switchDashboardWorkspaceSubview("moderation", value);
    }
  });
}

// Bind independently of the dashboard's asynchronous startup so these tabs remain usable
// even when an unrelated startup request or panel initialization fails.
bindDashboardWorkspaceSubviewClicks();

function createDashboardWorkspacePanelHelpers(input) {
  const { state, setDetailsPaneVisible } = input;
  if (dashboardWorkspacePendingSubview.guild) state.guildSubview = dashboardWorkspacePendingSubview.guild;
  if (dashboardWorkspacePendingSubview.moderation) state.moderationSubview = dashboardWorkspacePendingSubview.moderation;
  dashboardWorkspaceSubviewState = state;
  function switchSubview(group, panel) {
    switchDashboardWorkspaceSubview(group, panel);
  }
  function switchDetailTab(tab, options = {}) {
    state.detailTab = tab;
    document.querySelectorAll("[data-detail-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-detail-tab") === tab);
    });
    const currentPanel = document.getElementById("detail-panel-current");
    if (currentPanel) {
      currentPanel.classList.toggle("hidden", tab !== "current");
    }
    const usersPanel = document.getElementById("detail-panel-users");
    if (usersPanel) {
      usersPanel.classList.toggle("hidden", tab !== "users");
    }
    // Initialization only selects the tab; opening the overlay inspector on
    // load dimmed the whole page behind its scrim at compact widths.
    if (options.reveal !== false && window.innerWidth <= 1550) {
      setDetailsPaneVisible(true);
    }
  }
  function bindSubviewTabs() {
    bindDashboardWorkspaceSubviewClicks();
  }
  function initializeFoldAccordions() {
    document.querySelectorAll("details.fold-card").forEach(card => {
      card.classList.toggle("is-open", card.open);
      card.addEventListener("toggle", () => {
        card.classList.toggle("is-open", card.open);
      });
    });
  }
  return {
    switchSubview,
    switchDetailTab,
    bindSubviewTabs,
    initializeFoldAccordions
  };
}
