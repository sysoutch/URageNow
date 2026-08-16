const dashboardLayoutModes = new Set(["cards", "list", "table"]);
const dashboardLayoutStoragePrefix = "urage-dashboard-layout:";
const dashboardDensityStoragePrefix = "urage-dashboard-density:";

function getDashboardLayoutMode(scope) {
  const stored = localStorage.getItem(dashboardLayoutStoragePrefix + scope);
  return dashboardLayoutModes.has(stored) ? stored : "cards";
}

function applyDashboardLayout(panel, mode) {
  const scope = panel.getAttribute("data-dashboard-layout-panel");
  const nextMode = dashboardLayoutModes.has(mode) ? mode : "cards";
  panel.setAttribute("data-dashboard-layout", nextMode);
  panel.querySelectorAll("[data-dashboard-layout-mode]").forEach(button => {
    const active = button.getAttribute("data-dashboard-layout-mode") === nextMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (scope) localStorage.setItem(dashboardLayoutStoragePrefix + scope, nextMode);
}

function getDashboardDensity(scope) {
  const stored = Number.parseInt(localStorage.getItem(dashboardDensityStoragePrefix + scope) || "100", 10);
  return Number.isFinite(stored) ? Math.min(140, Math.max(75, stored)) : 100;
}

function applyDashboardDensity(panel, density) {
  const scope = panel.getAttribute("data-dashboard-layout-panel");
  const nextDensity = Math.min(140, Math.max(75, Number.parseInt(String(density), 10) || 100));
  panel.dataset.dashboardDensity = String(nextDensity);
  panel.style.setProperty("--dashboard-collection-scale", String(nextDensity / 100));
  panel.querySelectorAll("[data-dashboard-density-input]").forEach(input => {
    input.value = String(nextDensity);
  });
  panel.querySelectorAll("[data-dashboard-density-value]").forEach(output => {
    output.value = `${nextDensity}%`;
    output.textContent = `${nextDensity}%`;
  });
  if (scope) localStorage.setItem(dashboardDensityStoragePrefix + scope, String(nextDensity));
}

function bindDashboardLayoutSwitchers() {
  document.querySelectorAll("[data-dashboard-layout-panel]").forEach(panel => {
    const scope = panel.getAttribute("data-dashboard-layout-panel");
    applyDashboardLayout(panel, getDashboardLayoutMode(scope));
    applyDashboardDensity(panel, getDashboardDensity(scope));
  });
  document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest("[data-dashboard-layout-mode]") : null;
    const panel = button?.closest("[data-dashboard-layout-panel]");
    if (!button || !panel) return;
    applyDashboardLayout(panel, button.getAttribute("data-dashboard-layout-mode"));
  });
  document.addEventListener("input", event => {
    const input = event.target instanceof Element ? event.target.closest("[data-dashboard-density-input]") : null;
    const panel = input?.closest("[data-dashboard-layout-panel]");
    if (!input || !panel) return;
    applyDashboardDensity(panel, input.value);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindDashboardLayoutSwitchers, { once: true });
} else {
  bindDashboardLayoutSwitchers();
}
