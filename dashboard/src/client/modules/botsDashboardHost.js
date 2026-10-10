(() => {
  const frame = document.getElementById("bots-dashboard-frame");
  if (!frame) return;

  const mount = () => {
    if (!frame.src) frame.src = frame.dataset.src || "/bots-dashboard";
  };
  const dashboardPanel = frame.closest("[data-view-panel='dashboard']");
  const sync = () => {
    if (dashboardPanel?.classList.contains("active") || document.body.classList.contains("view-dashboard-active")) mount();
  };
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-rail-category='bots'], [data-view='dashboard']") : null;
    if (target) mount();
    const messengerButton = event.target instanceof Element ? event.target.closest("[data-messenger]") : null;
    if (messengerButton) {
      mount();
      const messenger = messengerButton.getAttribute("data-messenger") || "discord";
      frame.addEventListener("load", () => frame.contentWindow?.postMessage({ type: "urage:select-bot", messenger }, window.location.origin), { once: true });
      frame.contentWindow?.postMessage({ type: "urage:select-bot", messenger }, window.location.origin);
    }
  });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  sync();
})();
