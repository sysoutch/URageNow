function createDashboardImageSendDestinationHelpers(input) {
  const getElementById = typeof input?.getElementById === "function" ? input.getElementById : id => document.getElementById(id);
  const queryAll = typeof input?.queryAll === "function" ? input.queryAll : selector => Array.from(document.querySelectorAll(selector));
  const createElement = typeof input?.createElement === "function" ? input.createElement : tagName => document.createElement(tagName);
  let activeTab = "tool";
  let overlayBackdrop = null;

  function panel() {
    return getElementById("image-send-destination-panel");
  }

  function mountAtOverlayRoot() {
    const destinationPanel = panel();
    const overlayRoot = input?.overlayRoot || document.body;
    if (!destinationPanel || !overlayRoot) return;
    if (!overlayBackdrop) {
      overlayBackdrop = createElement("div");
      overlayBackdrop.className = "studio-send-destination-backdrop hidden";
      overlayRoot.appendChild(overlayBackdrop);
    }
    if (destinationPanel.parentElement !== overlayBackdrop) overlayBackdrop.appendChild(destinationPanel);
  }

  function setOpen(open) {
    const destinationPanel = panel();
    if (!destinationPanel) return;
    destinationPanel.classList.toggle("hidden", open !== true);
    overlayBackdrop?.classList.toggle("hidden", open !== true);
    getElementById("image-send-menu-toggle")?.setAttribute("aria-expanded", open === true ? "true" : "false");
    if (open === true) getElementById("image-send-destination-close")?.focus();
    else getElementById("image-send-menu-toggle")?.focus();
  }

  function selectTab(tab) {
    activeTab = ["tool", "game-engine", "3d-suite"].includes(tab) ? tab : "tool";
    queryAll("[data-image-send-tab]").forEach(button => {
      const selected = button.getAttribute("data-image-send-tab") === activeTab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    queryAll("[data-image-send-pane]").forEach(pane => {
      const selected = pane.getAttribute("data-image-send-pane") === activeTab;
      pane.classList.toggle("active", selected);
      pane.classList.toggle("hidden", !selected);
    });
  }

  function bind() {
    mountAtOverlayRoot();
    const bindOnce = (id, handler) => {
      const button = getElementById(id);
      if (!button || button.dataset.imageSendDestinationBound === "true") return;
      button.dataset.imageSendDestinationBound = "true";
      button.addEventListener("click", handler);
    };
    bindOnce("image-send-menu-toggle", event => {
      event.preventDefault();
      setOpen(panel()?.classList.contains("hidden"));
    });
    bindOnce("image-send-destination-close", event => {
      event.preventDefault();
      setOpen(false);
    });
    ["image-send-to-game-engine-button", "image-import-blender-button"].forEach(id => bindOnce(id, () => setOpen(false)));
    queryAll("[data-image-send-tab]").forEach(button => {
      if (button.dataset.imageSendDestinationBound === "true") return;
      button.dataset.imageSendDestinationBound = "true";
      button.addEventListener("click", () => selectTab(String(button.getAttribute("data-image-send-tab") || "tool")));
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !panel()?.classList.contains("hidden")) setOpen(false);
    });
    document.addEventListener("pointerdown", event => {
      const destinationPanel = panel();
      const toggle = getElementById("image-send-menu-toggle");
      if (!destinationPanel?.classList.contains("hidden") && !destinationPanel.contains(event.target) && !toggle?.contains(event.target)) setOpen(false);
    });
    selectTab(activeTab);
  }

  return {bind, selectTab, setOpen};
}
