function createDashboardRecentMediaViewHelpers() {
  const states = new Map();
  function getState(key) {
    if (!states.has(key)) states.set(key, {groupBy: "", filterBy: "", filterValue: ""});
    return states.get(key);
  }
  function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
  }
  function filterEntries(entries, key, filters) {
    const state = getState(key);
    const filter = filters.find(item => item.key === state.filterBy);
    const query = normalize(state.filterValue);
    if (!filter || !query) return entries.slice();
    return entries.filter(entry => {
      const value = filter.getValue(entry);
      if (filter.type === "number") return Number(value) === Number(query);
      return normalize(value).includes(query);
    });
  }
  function groupEntries(entries, key, groups) {
    const state = getState(key);
    const group = groups.find(item => item.key === state.groupBy);
    if (!group) return [{label: "", entries}];
    const grouped = new Map();
    entries.forEach(entry => {
      const rawLabel = String(group.getValue(entry) ?? "").trim();
      const label = rawLabel || group.emptyLabel || "Unspecified";
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(entry);
    });
    return Array.from(grouped, ([label, groupedEntries]) => ({label, entries: groupedEntries}));
  }
  function renderControls(containerId, config) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const state = getState(config.key);
    container.parentElement?.classList.add("recent-media-controls-host");
    const mediaContainer = config.mediaContainerId ? document.getElementById(config.mediaContainerId) : null;
    mediaContainer?.classList.toggle("is-grouped", Boolean(state.groupBy));
    let popup = container.parentElement?.querySelector(`[data-recent-media-options='${config.key}']`);
    const existingGroupSelect = popup?.querySelector("[data-recent-media-group]");
    const existingFilterSelect = popup?.querySelector("[data-recent-media-filter]");
    const existingFilterValue = popup?.querySelector("[data-recent-media-filter-value]");
    const activeOptionCount = Number(Boolean(state.groupBy)) + Number(Boolean(state.filterBy && state.filterValue));
    const existingButton = container.querySelector("[data-recent-media-options-button]");
    if (existingButton) {
      existingButton.classList.toggle("active", activeOptionCount > 0);
      existingButton.textContent = activeOptionCount > 0 ? "Group / Filter (" + activeOptionCount + ")" : "Group / Filter";
    }
    if (container.dataset.recentMediaKey === config.key && existingGroupSelect && existingFilterSelect && existingFilterValue) {
      existingGroupSelect.value = state.groupBy;
      existingFilterSelect.value = state.filterBy;
      if (document.activeElement !== existingFilterValue) existingFilterValue.value = state.filterValue;
      existingFilterValue.disabled = !state.filterBy;
      return;
    }
    container.dataset.recentMediaKey = config.key;
    container.replaceChildren();
    const button = document.createElement("button");
    button.className = "secondary compact recent-media-options-button";
    button.type = "button";
    button.dataset.recentMediaOptionsButton = "true";
    button.textContent = activeOptionCount > 0 ? "Group / Filter (" + activeOptionCount + ")" : "Group / Filter";
    button.classList.toggle("active", activeOptionCount > 0);
    button.setAttribute("aria-label", "Open recent media grouping and filter options");
    popup = document.createElement("div");
    popup.className = "recent-media-options-popup";
    popup.dataset.recentMediaOptions = config.key;
    popup.setAttribute("popover", "auto");
    const header = document.createElement("div");
    header.className = "recent-media-options-header";
    const title = document.createElement("strong");
    title.textContent = "Recent Media View";
    const resetButton = document.createElement("button");
    resetButton.className = "ghost compact";
    resetButton.type = "button";
    resetButton.textContent = "Reset";
    header.append(title, resetButton);
    const groupLabel = document.createElement("label");
    groupLabel.textContent = "Group by";
    const groupSelect = document.createElement("select");
    groupSelect.dataset.recentMediaGroup = "true";
    groupSelect.innerHTML = "<option value=''>None</option>";
    config.groups.forEach(option => groupSelect.add(new Option(option.label, option.key)));
    groupSelect.value = state.groupBy;
    const filterLabel = document.createElement("label");
    filterLabel.textContent = "Filter";
    const filterSelect = document.createElement("select");
    filterSelect.dataset.recentMediaFilter = "true";
    filterSelect.innerHTML = "<option value=''>None</option>";
    config.filters.forEach(option => filterSelect.add(new Option(option.label, option.key)));
    filterSelect.value = state.filterBy;
    const filterValue = document.createElement("input");
    filterValue.dataset.recentMediaFilterValue = "true";
    filterValue.type = "search";
    filterValue.value = state.filterValue;
    filterValue.placeholder = "Filter value";
    filterValue.disabled = !state.filterBy;
    const refresh = () => {
      state.groupBy = groupSelect.value;
      state.filterBy = filterSelect.value;
      state.filterValue = filterValue.value;
      config.onChange();
    };
    button.addEventListener("click", () => {
      if (typeof popup.showPopover === "function") {
        if (popup.matches(":popover-open")) {
          popup.hidePopover();
          return;
        }
        popup.showPopover();
        const rect = button.getBoundingClientRect();
        const width = Math.min(420, Math.max(280, popup.offsetWidth || 320));
        popup.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) + "px";
        popup.style.top = Math.max(8, Math.min(window.innerHeight - popup.offsetHeight - 8, rect.bottom + 6)) + "px";
        return;
      }
      popup.classList.toggle("open");
    });
    groupSelect.addEventListener("change", refresh);
    filterSelect.addEventListener("change", () => {
      state.filterBy = filterSelect.value;
      if (!state.filterBy) state.filterValue = "";
      config.onChange();
    });
    filterValue.addEventListener("input", refresh);
    resetButton.addEventListener("click", () => {
      state.groupBy = "";
      state.filterBy = "";
      state.filterValue = "";
      config.onChange();
    });
    groupLabel.appendChild(groupSelect);
    filterLabel.appendChild(filterSelect);
    popup.append(header, groupLabel, filterLabel, filterValue);
    container.appendChild(button);
    container.parentElement?.appendChild(popup);
  }
  function appendGroupHeading(container, label, count) {
    if (!label) return;
    const heading = document.createElement("div");
    heading.className = "recent-media-group-heading";
    const title = document.createElement("strong");
    title.textContent = label;
    title.title = label;
    const badge = document.createElement("span");
    badge.textContent = String(count);
    heading.append(title, badge);
    container.appendChild(heading);
  }
  return {getState, filterEntries, groupEntries, renderControls, appendGroupHeading};
}
