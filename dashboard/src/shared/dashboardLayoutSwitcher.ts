function escapeLayoutScope(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderDashboardLayoutSwitcher(scope: string): string {
  const safeScope = escapeLayoutScope(scope);
  return `
              <div class="dashboard-layout-toolbar">
                <span class="dashboard-layout-label">Layout</span>
                <div class="dashboard-layout-switcher" data-dashboard-layout-switcher="${safeScope}" role="group" aria-label="Choose layout">
                  <button class="active" data-dashboard-layout-mode="cards" type="button" aria-pressed="true">Cards</button>
                  <button data-dashboard-layout-mode="list" type="button" aria-pressed="false">List</button>
                  <button data-dashboard-layout-mode="table" type="button" aria-pressed="false">Table</button>
                </div>
                <label class="dashboard-density-control" for="dashboard-density-${safeScope}">
                  <span>Size</span>
                  <input id="dashboard-density-${safeScope}" data-dashboard-density-input type="range" min="75" max="140" step="5" value="100" aria-label="Adjust card and row size">
                  <output data-dashboard-density-value>100%</output>
                </label>
              </div>`;
}
