function createDashboardWorkspacePanelHelpers(input) {
  const { state, setDetailsPaneVisible } = input;
  function switchSubview(group, panel) {
    const stateKey = group === "guild" ? "guildSubview" : "moderationSubview";
    state[stateKey] = panel;
    document.querySelectorAll("[data-subview]").forEach(button => {
      const value = button.getAttribute("data-subview") || "";
      if (!value.startsWith(group + "-")) {
        return;
      }
      button.classList.toggle("active", value === panel);
    });
    document.querySelectorAll("[data-subview-panel]").forEach(node => {
      const value = node.getAttribute("data-subview-panel") || "";
      if (!value.startsWith(group + "-")) {
        return;
      }
      node.classList.toggle("hidden-by-subview", value !== panel);
    });
  }
  function switchDetailTab(tab) {
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
    if (window.innerWidth <= 1550) {
      setDetailsPaneVisible(true);
    }
  }
  function bindSubviewTabs() {
    document.querySelectorAll("[data-subview]").forEach(button => {
      button.addEventListener("click", event => {
        const value = event.currentTarget.getAttribute("data-subview") || "";
        if (value.startsWith("guild-")) {
          switchSubview("guild", value);
          return;
        }
        if (value.startsWith("moderation-")) {
          switchSubview("moderation", value);
        }
      });
    });
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
