function createDashboardGenerationQueuePresenter(input) {
  const documentRef = input?.document || document;

  function render(config) {
    const container = documentRef.getElementById(config.containerId);
    if (!container) {
      return null;
    }
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    const message = String(documentRef.getElementById(config.statusKey + "-status")?.textContent || "").trim();
    const stateNode = documentRef.getElementById(config.statusKey + "-status-state");
    const isActive = Boolean(message && stateNode && !stateNode.classList.contains("is-idle"));
    const item = documentRef.createElement("div");
    item.className = [
      "studio-generation-queue-item",
      config.itemClass || "",
      isActive ? "active" : "studio-component-empty-state"
    ].filter(Boolean).join(" ");
    const icon = documentRef.createElement("span");
    icon.className = config.iconClass || "studio-generation-queue-icon";
    icon.setAttribute("aria-hidden", "true");
    const text = documentRef.createElement("strong");
    text.textContent = isActive ? message : `No active ${config.noun} jobs.`;
    const detail = documentRef.createElement("small");
    detail.textContent = isActive ? `Current ${config.studioLabel} status` : "Queue is clear";
    text.appendChild(detail);
    item.append(icon, text);
    if (isActive && typeof config.createActiveAction === "function") {
      const action = config.createActiveAction();
      if (action) {
        item.appendChild(action);
      }
    }
    container.appendChild(item);
    return {container, isActive, item};
  }

  return {render};
}
