(function bindDesktopWindowChrome() {
  const query = new URLSearchParams(window.location.search);
  if (query.get("desktopShell") !== "tauri") return;

  const invoke = window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;
  document.body.classList.add("tauri-desktop-shell");
  const titlebar = document.getElementById("desktop-window-titlebar");
  if (titlebar) titlebar.hidden = false;
  const dragRegion = titlebar?.querySelector(".desktop-window-drag-region");

  function invokeDesktop(command) {
    if (typeof invoke !== "function") return Promise.resolve(null);
    return Promise.resolve(invoke(command));
  }

  if (dragRegion) {
    dragRegion.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.detail > 1) return;
      event.preventDefault();
      invokeDesktop("desktop_start_dragging")
        .catch(error => console.error("Desktop window dragging failed.", error));
    });
    dragRegion.addEventListener("dblclick", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      invokeDesktop("desktop_toggle_maximize")
        .then(updateMaximizePresentation)
        .catch(error => console.error("Desktop maximize command failed.", error));
    });
  }

  function bind(id, command) {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", event => {
      event.stopPropagation();
      if (typeof invoke === "function") {
        Promise.resolve(invoke(command)).catch(error => console.error(`Desktop command ${command} failed.`, error));
      }
    });
  }

  bind("desktop-window-minimize", "desktop_minimize");
  const maximize = document.getElementById("desktop-window-maximize");
  function updateMaximizePresentation(isMaximized) {
    if (!maximize) return;
    const icon = maximize.querySelector("i");
    icon?.classList.toggle("bi-square", !isMaximized);
    icon?.classList.toggle("bi-copy", Boolean(isMaximized));
    maximize.title = isMaximized ? "Restore" : "Maximize";
    maximize.setAttribute("aria-label", maximize.title + " window");
  }
  if (maximize) {
    maximize.addEventListener("click", event => {
      event.stopPropagation();
      if (typeof invoke !== "function") return;
      invokeDesktop("desktop_toggle_maximize")
        .then(updateMaximizePresentation)
        .catch(error => console.error("Desktop maximize command failed.", error));
    });
  }
  bind("desktop-window-close", "desktop_hide");
})();
