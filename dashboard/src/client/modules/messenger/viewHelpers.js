function resolveDashboardMessengerCompatibleView(nextMessenger, currentView, helpers) {
  const normalizedMessenger = helpers.normalizeMessenger(nextMessenger);
  const activeView = String(currentView || helpers.getActiveView() || "dashboard").trim();
  if (normalizedMessenger === "discord") {
    return activeView === "messenger" ? "messaging" : activeView;
  }
  if (activeView === "messaging") {
    return "messenger";
  }
  if (helpers.isDiscordOnlyView(activeView)) {
    return "dashboard";
  }
  return activeView;
}

function resolveDashboardRequestedViewForMessenger(view, state, helpers) {
  const requested = String(view || "ai").trim() || "ai";
  if (requested === "messaging" && state.selectedMessenger !== "discord") {
    return "messenger";
  }
  if (state.selectedMessenger !== "discord" && helpers.isDiscordOnlyView(requested)) {
    return "dashboard";
  }
  return requested;
}

function getDashboardBotShortLabel(tag) {
  const value = String(tag || "Discrod").trim();
  const stem = value.split("#")[0] || value;
  return (stem.slice(0, 2) || "DR").toUpperCase();
}
