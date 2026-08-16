function createDashboardAutomationBootstrapHelpers(input) {
  const state = input?.state && typeof input.state === "object" ? input.state : {};
  const refreshMeta = input?.refreshMeta && typeof input.refreshMeta === "object" ? input.refreshMeta : {};
  const request = typeof input?.request === "function" ? input.request : async function requestFallback() {
    throw new Error("Dashboard request helper is not available.");
  };
  const fillPresetSelect = typeof input?.fillPresetSelect === "function" ? input.fillPresetSelect : function fillPresetSelectFallback() {};
  const loadAutomationTextSources = typeof input?.loadAutomationTextSources === "function" ? input.loadAutomationTextSources : async function loadAutomationTextSourcesFallback() {};
  const setRefreshStatus = typeof input?.setRefreshStatus === "function" ? input.setRefreshStatus : function setRefreshStatusFallback() {};
  const bindAutomationStudioEvents = typeof input?.bindAutomationStudioEvents === "function" ? input.bindAutomationStudioEvents : function bindAutomationStudioEventsFallback() {};

  function bindEvents() {
    bindAutomationStudioEvents();
  }

  async function loadAutomationPresets() {
    const payload = await request("/api/automation-presets");
    state.automationPresets = Array.isArray(payload) ? payload : [];
    fillPresetSelect("schedule-preset-select", state.automationPresets.filter(item => item.scope === "schedule"), "Choose a schedule preset");
    fillPresetSelect("join-preset-select", state.automationPresets.filter(item => item.scope === "member-join"), "Choose a join preset");
  }

  async function refreshAutomationTextSources() {
    await loadAutomationTextSources();
    refreshMeta.automationTextSources = Date.now();
    setRefreshStatus("automation-text-sources-refresh-status", "Text sources refreshed at ", refreshMeta.automationTextSources);
  }

  return {
    bindEvents,
    loadAutomationPresets,
    refreshAutomationTextSources
  };
}

if (typeof window !== "undefined") {
  window.createDashboardAutomationBootstrapHelpers = createDashboardAutomationBootstrapHelpers;
}
