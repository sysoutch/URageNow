function clampToolsSidebarWidth(width) {
  const viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 0);
  const maxWidth = Math.min(520, Math.max(220, Math.round(viewportWidth * 0.42)));
  return Math.max(168, Math.min(maxWidth, Math.round(Number(width) || 238)));
}

function createToolsSidebarResizeController(options) {
  const layoutNode = options?.layoutNode || null;
  const resizeHandle = options?.resizeHandle || null;
  const state = options?.state || {};
  const storageKeys = options?.storageKeys || {};
  const readStoredToolIdValue = typeof options?.readStoredToolId === "function" ? options.readStoredToolId : () => "";
  const writeStoredToolIdValue = typeof options?.writeStoredToolId === "function" ? options.writeStoredToolId : () => {};
  const setStatus = typeof options?.setStatus === "function" ? options.setStatus : () => {};

  const applyWidth = width => {
    const nextWidth = clampToolsSidebarWidth(width);
    state.sidebarWidth = nextWidth;
    if (layoutNode) layoutNode.style.setProperty("--tools-sidebar-width", nextWidth + "px");
    return nextWidth;
  };
  const persistWidth = width => {
    const nextWidth = applyWidth(width);
    writeStoredToolIdValue(storageKeys.sidebarWidth, String(nextWidth));
  };
  const initialize = () => {
    state.sidebarWidth = clampToolsSidebarWidth(readStoredToolIdValue(storageKeys.sidebarWidth) || state.sidebarWidth || 238);
    applyWidth(state.sidebarWidth);
  };
  const bind = () => {
    if (!resizeHandle || !layoutNode) return;
    let resizeStartX = 0;
    let resizeStartWidth = 0;
    let onResizeMove = null;
    const stopResize = () => {
      if (!layoutNode.classList.contains("is-sidebar-resizing")) return;
      layoutNode.classList.remove("is-sidebar-resizing");
      persistWidth(state.sidebarWidth);
      if (onResizeMove) document.removeEventListener("pointermove", onResizeMove);
      document.removeEventListener("pointerup", stopResize);
      document.removeEventListener("pointercancel", stopResize);
    };
    onResizeMove = event => {
      const delta = Number(event.clientX || 0) - resizeStartX;
      applyWidth(resizeStartWidth + delta);
    };
    resizeHandle.addEventListener("pointerdown", event => {
      if (state.sidebarCollapsed === true) return;
      event.preventDefault();
      resizeStartX = Number(event.clientX || 0);
      resizeStartWidth = clampToolsSidebarWidth(state.sidebarWidth || layoutNode.getBoundingClientRect().width || 238);
      layoutNode.classList.add("is-sidebar-resizing");
      resizeHandle.setPointerCapture?.(event.pointerId);
      document.addEventListener("pointermove", onResizeMove);
      document.addEventListener("pointerup", stopResize);
      document.addEventListener("pointercancel", stopResize);
    });
    resizeHandle.addEventListener("dblclick", event => {
      event.preventDefault();
      persistWidth(238);
      setStatus("Reset tools sidebar width.");
    });
    window.addEventListener("resize", () => persistWidth(state.sidebarWidth || 238));
  };

  return { applyWidth, bind, initialize, persistWidth };
}

