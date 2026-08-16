function createDashboardPopupHelpers() {
  const popupState = {
    queue: [],
    active: null,
    previousFocus: null
  };

  function normalizePopupOptions(options, fallbackVariant) {
    if (typeof options === "string") {
      return { message: options, variant: fallbackVariant || "info" };
    }
    return { ...(options || {}), variant: options?.variant || fallbackVariant || "info" };
  }

  function getPopupText(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function appendPopupDetails(container, details) {
    const entries = Array.isArray(details)
      ? details.map(entry => String(entry || "").trim()).filter(Boolean)
      : String(details || "").split(/\r?\n/).map(entry => entry.trim()).filter(Boolean);
    if (entries.length === 0) {
      return;
    }
    const list = document.createElement("div");
    list.className = "dashboard-popup-details";
    entries.forEach(entry => {
      const item = document.createElement("div");
      item.textContent = entry;
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function closeActivePopup(result) {
    const active = popupState.active;
    if (!active) {
      return;
    }
    popupState.active = null;
    active.overlay.remove();
    document.body.classList.remove("dashboard-popup-open");
    if (popupState.previousFocus && typeof popupState.previousFocus.focus === "function") {
      popupState.previousFocus.focus();
    }
    popupState.previousFocus = null;
    active.resolve(result);
    showNextPopup();
  }

  function bindPopupKeys(overlay, kind) {
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeActivePopup(kind === "confirm" ? false : true);
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusables = Array.from(overlay.querySelectorAll("button")).filter(button => button.disabled !== true);
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function createPopupOverlay(entry) {
    const options = entry.options;
    const kind = options.kind === "confirm" ? "confirm" : "message";
    const variant = ["info", "warning", "error", "success"].includes(options.variant) ? options.variant : "info";
    const overlay = document.createElement("div");
    overlay.className = "dashboard-popup-overlay";
    overlay.dataset.popupVariant = variant;
    overlay.setAttribute("role", kind === "confirm" || variant === "error" ? "alertdialog" : "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      "<button class='dashboard-popup-backdrop' type='button' aria-label='Close popup'></button>"
      + "<section class='dashboard-popup-panel' tabindex='-1'>"
      + "<div class='dashboard-popup-head'>"
      + "<div class='dashboard-popup-mark' aria-hidden='true'></div>"
      + "<div><div class='panel-kicker dashboard-popup-kicker'></div><h3 class='dashboard-popup-title'></h3></div>"
      + "</div>"
      + "<div class='dashboard-popup-body'><p class='dashboard-popup-message'></p></div>"
      + "<div class='dashboard-popup-actions'></div>"
      + "</section>";
    const titleNode = overlay.querySelector(".dashboard-popup-title");
    const kickerNode = overlay.querySelector(".dashboard-popup-kicker");
    const messageNode = overlay.querySelector(".dashboard-popup-message");
    const bodyNode = overlay.querySelector(".dashboard-popup-body");
    const actionsNode = overlay.querySelector(".dashboard-popup-actions");
    const titleFallback = kind === "confirm" ? "Confirm Action" : (variant === "error" ? "Error" : variant === "warning" ? "Warning" : "Information");
    titleNode.textContent = getPopupText(options.title, titleFallback);
    kickerNode.textContent = getPopupText(options.kicker, variant);
    messageNode.textContent = getPopupText(options.message, kind === "confirm" ? "Are you sure?" : "");
    appendPopupDetails(bodyNode, options.details);
    if (kind === "confirm") {
      const cancelButton = document.createElement("button");
      cancelButton.className = "secondary dashboard-popup-cancel";
      cancelButton.type = "button";
      cancelButton.textContent = getPopupText(options.cancelLabel, "Cancel");
      cancelButton.addEventListener("click", () => closeActivePopup(false));
      const confirmButton = document.createElement("button");
      confirmButton.className = "dashboard-popup-confirm" + (variant === "error" || variant === "warning" ? " danger" : "");
      confirmButton.type = "button";
      confirmButton.textContent = getPopupText(options.confirmLabel, "Confirm");
      confirmButton.addEventListener("click", () => closeActivePopup(true));
      actionsNode.append(cancelButton, confirmButton);
    } else {
      const okButton = document.createElement("button");
      okButton.className = "dashboard-popup-confirm";
      okButton.type = "button";
      okButton.textContent = getPopupText(options.confirmLabel, "OK");
      okButton.addEventListener("click", () => closeActivePopup(true));
      actionsNode.appendChild(okButton);
    }
    overlay.querySelector(".dashboard-popup-backdrop")?.addEventListener("click", () => closeActivePopup(kind === "confirm" ? false : true));
    bindPopupKeys(overlay, kind);
    return overlay;
  }

  function showNextPopup() {
    if (popupState.active || popupState.queue.length === 0 || typeof document === "undefined") {
      return;
    }
    const entry = popupState.queue.shift();
    const overlay = createPopupOverlay(entry);
    popupState.previousFocus = document.activeElement;
    popupState.active = { ...entry, overlay };
    document.body.appendChild(overlay);
    document.body.classList.add("dashboard-popup-open");
    window.setTimeout(() => {
      const focusTarget = overlay.querySelector(".dashboard-popup-confirm") || overlay.querySelector(".dashboard-popup-panel");
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus();
      }
    }, 0);
  }

  function showPopup(options) {
    if (typeof document === "undefined") {
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      popupState.queue.push({ options: normalizePopupOptions(options, "info"), resolve });
      showNextPopup();
    });
  }

  function showConfirm(options) {
    const normalized = normalizePopupOptions(options, "warning");
    return showPopup({ ...normalized, kind: "confirm" });
  }

  return {
    popup: showPopup,
    confirm: showConfirm,
    info: options => showPopup({ ...normalizePopupOptions(options, "info"), kind: "message" }),
    warning: options => showPopup({ ...normalizePopupOptions(options, "warning"), kind: "message" }),
    error: options => showPopup({ ...normalizePopupOptions(options, "error"), kind: "message" })
  };
}

const dashboardPopupHelpers = createDashboardPopupHelpers();
window.dashboardPopup = dashboardPopupHelpers.popup;
window.dashboardConfirm = dashboardPopupHelpers.confirm;
window.dashboardInfo = dashboardPopupHelpers.info;
window.dashboardWarning = dashboardPopupHelpers.warning;
window.dashboardError = dashboardPopupHelpers.error;
