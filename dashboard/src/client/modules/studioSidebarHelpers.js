function createDashboardStudioSidebarHelpers(input) {
  const {
    state,
    getActiveView,
    studioWorkflowSidebarMeta,
    workflowRightSidebarTargets,
    studioRailExpandedStorageKey,
    studioRailHoverModeStorageKey = "urage-studio-rail-hover-mode",
    studioWorkflowSidebarModeStorageKey,
    studioWorkflowSidebarWidthStorageKey = "urage-studio-workflow-sidebar-width",
    workflowRightSidebarStateStorageKey,
    workflowRightSidebarWidthStorageKey
  } = input;
  let workflowSidebarResizersBound = false;
  let studioRailHoverBound = false;
  let studioRailHoverClearTimer = 0;
  let studioRailHoverLeavingTimer = 0;
  let studioRailHoverFrame = 0;
  let studioRailPointerClientX = -1;
  let studioRailPointerClientY = -1;
  const workflowSidebarWidthRange = { min: 220, max: 460, defaultWidth: 280 };
  const studioRailHoverClearDelayMs = 260;
  const studioRailHoverTransitionMs = 360;
  const studioRailHoverGroupSelectors = [
    ["workflow", '.rail-home[data-studio-home-view="workflow"], .rail-studio-workflows'],
    ["tools", ".rail-tools-button, .rail-tools-categories"],
    ["blender-addons", ".rail-3d-suites-button, .rail-resource-sections[data-resource-rail-group=\"blender-addons\"]"],
    ["assets", ".rail-assets-button, .rail-resource-sections[data-resource-rail-group=\"assets\"]"],
    ["bots", ".rail-profile-button, .rail-resource-sections[data-resource-rail-group=\"bots\"]"]
  ];
  const studioRailSelectionSelectors = {
    workflow: {
      active: ".rail-studio-workflows [data-ai-scroll-target].active-focus, .rail-studio-workflows [data-ai-scroll-target].active",
      fallback: '.rail-home[data-studio-home-view="workflow"]'
    },
    tools: {
      active: ".rail-tools-categories [data-tools-filter].active",
      fallback: ".rail-tools-button"
    },
    "blender-addons": {
      active: '[data-resource-rail-group="blender-addons"] [data-3d-suite].active',
      fallback: ".rail-3d-suites-button"
    },
    assets: {
      active: '[data-resource-rail-group="assets"] [data-asset-platform].active',
      fallback: ".rail-assets-button"
    },
    bots: {
      active: '[data-resource-rail-group="bots"] [data-messenger].active',
      fallback: ".rail-profile-button"
    }
  };
  function readStudioRailExpandedPreference() {
    try {
      return window.localStorage.getItem(studioRailExpandedStorageKey) === "1";
    } catch {
      return false;
    }
  }
  function normalizeStudioRailHoverMode(value) {
    if (value === "temp-expand" || value === "collapse-expand" || value === "collapse-expand-keep-others") {
      return value;
    }
    return "off";
  }
  function readStudioRailHoverModePreference() {
    try {
      return normalizeStudioRailHoverMode(window.localStorage.getItem(studioRailHoverModeStorageKey));
    } catch {
      return "off";
    }
  }
  function applyStudioRailHoverModeState() {
    state.studioRailHoverMode = normalizeStudioRailHoverMode(state.studioRailHoverMode);
    document.body.dataset.studioRailHoverMode = state.studioRailHoverMode;
    if (state.studioRailHoverMode !== "temp-expand") {
      delete document.body.dataset.studioRailHoverLeavingGroup;
    }
    applyStudioRailHoverGroupState();
  }
  function updateStudioRailExpandButton() {
    const button = document.getElementById("rail-workflow-expand-button");
    if (!button) {
      return;
    }
    const expanded = state.studioRailExpanded === true;
    button.classList.toggle("active", expanded);
    button.setAttribute("aria-pressed", expanded ? "true" : "false");
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
    button.setAttribute("title", expanded ? "Collapse workflow rail" : "Expand workflow rail");
    button.setAttribute("aria-label", expanded ? "Collapse workflow rail" : "Expand workflow rail");
  }
  function applyStudioRailExpandedState() {
    document.body.classList.toggle("studio-rail-expanded", state.studioRailExpanded === true);
    document.body.classList.remove("studio-rail-hover-expanded");
    delete document.body.dataset.studioRailHoverExpanded;
    updateStudioRailExpandButton();
  }
  function normalizeStudioRailHoverGroup(group) {
    const value = typeof group === "string" ? group.trim() : "";
    return studioRailHoverGroupSelectors.some(([key]) => key === value) ? value : "";
  }
  function applyStudioRailHoverGroupState() {
    const hoverMode = normalizeStudioRailHoverMode(state.studioRailHoverMode);
    const canUseRailHover = hoverMode !== "off" && window.innerWidth > 980;
    const hoverGroup = canUseRailHover ? normalizeStudioRailHoverGroup(document.body.dataset.studioRailHoverGroup) : "";
    const leavingGroup = canUseRailHover ? normalizeStudioRailHoverGroup(document.body.dataset.studioRailHoverLeavingGroup) : "";
    if (hoverGroup) {
      document.body.dataset.studioRailHoverGroup = hoverGroup;
    } else {
      delete document.body.dataset.studioRailHoverGroup;
    }
    if (leavingGroup) {
      document.body.dataset.studioRailHoverLeavingGroup = leavingGroup;
    } else {
      delete document.body.dataset.studioRailHoverLeavingGroup;
    }
    document.body.classList.toggle("studio-rail-hover-active", Boolean(hoverGroup || leavingGroup));
    document.body.classList.toggle("studio-rail-hover-expanded", Boolean(hoverGroup) && hoverMode === "temp-expand");
  }
  function clearStudioRailHoverTimers() {
    if (studioRailHoverClearTimer) {
      window.clearTimeout(studioRailHoverClearTimer);
      studioRailHoverClearTimer = 0;
    }
    if (studioRailHoverLeavingTimer) {
      window.clearTimeout(studioRailHoverLeavingTimer);
      studioRailHoverLeavingTimer = 0;
    }
    if (studioRailHoverFrame) {
      window.cancelAnimationFrame(studioRailHoverFrame);
      studioRailHoverFrame = 0;
    }
    delete document.body.dataset.studioRailHoverLeavingGroup;
  }
  function clearStudioRailLeavingGroupIfMatches(group) {
    if (normalizeStudioRailHoverGroup(document.body.dataset.studioRailHoverLeavingGroup) === group) {
      delete document.body.dataset.studioRailHoverLeavingGroup;
    }
  }
  function scheduleStudioRailLeavingGroup(group) {
    const leavingGroup = normalizeStudioRailHoverGroup(group);
    if (!leavingGroup) {
      delete document.body.dataset.studioRailHoverLeavingGroup;
      applyStudioRailHoverGroupState();
      return;
    }
    document.body.dataset.studioRailHoverLeavingGroup = leavingGroup;
    applyStudioRailHoverGroupState();
    studioRailHoverLeavingTimer = window.setTimeout(() => {
      studioRailHoverLeavingTimer = 0;
      clearStudioRailLeavingGroupIfMatches(leavingGroup);
      applyStudioRailHoverGroupState();
      scheduleStudioRailHoverReconcile();
    }, studioRailHoverTransitionMs);
  }
  function setStudioRailHoverGroup(group, options) {
    clearStudioRailHoverTimers();
    if (normalizeStudioRailHoverMode(state.studioRailHoverMode) === "off") {
      delete document.body.dataset.studioRailHoverGroup;
      applyStudioRailHoverGroupState();
      return;
    }
    const currentGroup = normalizeStudioRailHoverGroup(document.body.dataset.studioRailHoverGroup);
    const nextGroup = normalizeStudioRailHoverGroup(group);
    const activateSelection = options?.activateSelection === true;
    if (currentGroup && nextGroup && currentGroup !== nextGroup && normalizeStudioRailHoverMode(state.studioRailHoverMode) === "temp-expand") {
      scheduleStudioRailLeavingGroup(currentGroup);
    } else if (nextGroup) {
      clearStudioRailLeavingGroupIfMatches(nextGroup);
    } else {
      delete document.body.dataset.studioRailHoverLeavingGroup;
    }
    if (nextGroup) {
      document.body.dataset.studioRailHoverGroup = nextGroup;
    } else {
      delete document.body.dataset.studioRailHoverGroup;
    }
    applyStudioRailHoverGroupState();
    if (activateSelection && nextGroup && nextGroup !== currentGroup) {
      activateStudioRailSelection(nextGroup);
    }
  }
  function hideStudioRailHoverGroup() {
    clearStudioRailHoverTimers();
    const currentGroup = normalizeStudioRailHoverGroup(document.body.dataset.studioRailHoverGroup);
    delete document.body.dataset.studioRailHoverGroup;
    scheduleStudioRailLeavingGroup(currentGroup);
  }
  function getStudioRailHoverGroup(target) {
    if (!(target instanceof Element)) {
      return "";
    }
    const match = studioRailHoverGroupSelectors.find(([, selector]) => target.closest(selector));
    return match ? match[0] : "";
  }
  function setStudioRailPointerPosition(event) {
    const nextX = Number(event?.clientX);
    const nextY = Number(event?.clientY);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      return;
    }
    studioRailPointerClientX = nextX;
    studioRailPointerClientY = nextY;
  }
  function getStudioRailHoverGroupFromPoint() {
    if (!Number.isFinite(studioRailPointerClientX) || !Number.isFinite(studioRailPointerClientY)) {
      return "";
    }
    return getStudioRailHoverGroup(document.elementFromPoint(studioRailPointerClientX, studioRailPointerClientY));
  }
  function getStudioRailSelectionTarget(group) {
    const normalizedGroup = normalizeStudioRailHoverGroup(group);
    const selectors = normalizedGroup ? studioRailSelectionSelectors[normalizedGroup] : null;
    if (!selectors) {
      return null;
    }
    return document.querySelector(selectors.active) || document.querySelector(selectors.fallback) || null;
  }
  function activateStudioRailSelection(group) {
    const target = getStudioRailSelectionTarget(group);
    if (!(target instanceof HTMLElement)) {
      return;
    }
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }
  function scheduleStudioRailHoverReconcile() {
    if (studioRailHoverFrame) {
      return;
    }
    studioRailHoverFrame = window.requestAnimationFrame(() => {
      studioRailHoverFrame = 0;
      const nextGroup = getStudioRailHoverGroupFromPoint();
      if (!nextGroup) {
        return;
      }
      setStudioRailHoverGroup(nextGroup, {
        activateSelection: ["collapse-expand", "collapse-expand-keep-others"].includes(normalizeStudioRailHoverMode(state.studioRailHoverMode))
      });
    });
  }
  function promoteStudioRailSelection(target) {
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-ai-scroll-target]")) {
      document.querySelector('.rail-home[data-studio-home-view="workflow"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      setStudioRailHoverGroup("");
      return;
    }
    if (target.closest("[data-tools-filter]")) {
      document.querySelector(".rail-tools-button")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      setStudioRailHoverGroup("");
      return;
    }
    if (target.closest("[data-3d-suite]")) {
      document.querySelector(".rail-3d-suites-button")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      setStudioRailHoverGroup("");
      return;
    }
    if (target.closest("[data-asset-platform]")) {
      document.querySelector(".rail-assets-button")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      setStudioRailHoverGroup("");
      return;
    }
    if (target.closest("[data-messenger]")) {
      document.querySelector(".rail-profile-button")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      setStudioRailHoverGroup("");
    }
  }
  function collapseRepeatedStudioRailCategoryClick(event) {
    if (normalizeStudioRailHoverMode(state.studioRailHoverMode) !== "collapse-expand-keep-others") return false;
    const group = getStudioRailHoverGroup(event.target);
    const isCategoryButton = event.target instanceof Element && event.target.closest(".rail-home[data-studio-home-view='workflow'], .rail-tools-button, .rail-3d-suites-button, .rail-assets-button, .rail-profile-button");
    if (!group || !isCategoryButton || group !== normalizeStudioRailHoverGroup(document.body.dataset.studioRailHoverGroup)) return false;
    event.preventDefault();
    event.stopPropagation();
    setStudioRailHoverGroup("");
    return true;
  }
  function setStudioRailExpanded(expanded, options) {
    state.studioRailExpanded = expanded === true;
    if (!options || options.persist !== false) {
      try {
        window.localStorage.setItem(studioRailExpandedStorageKey, state.studioRailExpanded ? "1" : "0");
      } catch {}
    }
    applyStudioRailExpandedState();
    if (state.studioRailExpanded === true) {
      setStudioRailHoverGroup("");
    }
  }
  function setStudioRailHoverMode(mode, options) {
    state.studioRailHoverMode = normalizeStudioRailHoverMode(mode);
    if (!options || options.persist !== false) {
      try {
        window.localStorage.setItem(studioRailHoverModeStorageKey, state.studioRailHoverMode);
      } catch {}
    }
    applyStudioRailHoverModeState();
  }
  function normalizeWorkflowSidebarMode(value) {
    return value === "sticky" ? "sticky" : "floaty";
  }
  function readWorkflowSidebarModePreference() {
    try {
      return normalizeWorkflowSidebarMode(window.localStorage.getItem(studioWorkflowSidebarModeStorageKey));
    } catch {
      return "floaty";
    }
  }
  function clampWorkflowSidebarWidth(width) {
    if (!Number.isFinite(width)) {
      return workflowSidebarWidthRange.defaultWidth;
    }
    return Math.min(workflowSidebarWidthRange.max, Math.max(workflowSidebarWidthRange.min, Math.round(width)));
  }
  function readWorkflowSidebarWidthPreference() {
    try {
      const raw = window.localStorage.getItem(studioWorkflowSidebarWidthStorageKey);
      return raw ? clampWorkflowSidebarWidth(Number(raw)) : workflowSidebarWidthRange.defaultWidth;
    } catch {
      return workflowSidebarWidthRange.defaultWidth;
    }
  }
  function applyWorkflowSidebarWidthState() {
    state.aiWorkflowSidebarWidth = clampWorkflowSidebarWidth(Number(state.aiWorkflowSidebarWidth));
    document.body.style.setProperty("--studio-workflow-sidebar-pin-width", state.aiWorkflowSidebarWidth + "px");
    const handle = document.getElementById("studio-workflow-sidebar-resizer");
    if (handle) {
      handle.setAttribute("title", "Drag to resize workflow sidebar");
      handle.setAttribute("aria-label", "Resize workflow sidebar");
    }
  }
  function setWorkflowSidebarWidth(width, options) {
    state.aiWorkflowSidebarWidth = clampWorkflowSidebarWidth(Number(width));
    if (!options || options.persist !== false) {
      try {
        window.localStorage.setItem(studioWorkflowSidebarWidthStorageKey, String(state.aiWorkflowSidebarWidth));
      } catch {}
    }
    applyWorkflowSidebarWidthState();
  }
  function updateWorkflowSidebarModeButton() {
    const button = document.getElementById("studio-workflow-sidebar-mode-button");
    if (!button) {
      return;
    }
    const sticky = normalizeWorkflowSidebarMode(state.aiWorkflowSidebarMode) === "sticky";
    const label = sticky ? "Make workflow sidebar floaty" : "Pin workflow sidebar as sticky";
    button.classList.toggle("active", sticky);
    button.setAttribute("aria-pressed", sticky ? "true" : "false");
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
  }
  function applyWorkflowSidebarModeState() {
    state.aiWorkflowSidebarMode = normalizeWorkflowSidebarMode(state.aiWorkflowSidebarMode);
    applyWorkflowSidebarWidthState();
    document.body.classList.toggle("studio-workflow-sidebar-sticky", state.aiWorkflowSidebarMode === "sticky");
    document.body.classList.toggle("studio-workflow-sidebar-floaty", state.aiWorkflowSidebarMode !== "sticky");
    updateWorkflowSidebarModeButton();
  }
  function setWorkflowSidebarMode(mode, options) {
    state.aiWorkflowSidebarMode = normalizeWorkflowSidebarMode(mode);
    if (!options || options.persist !== false) {
      try {
        window.localStorage.setItem(studioWorkflowSidebarModeStorageKey, state.aiWorkflowSidebarMode);
      } catch {}
    }
    applyWorkflowSidebarModeState();
  }
  function normalizeWorkflowRightSidebarCollapsedMap(value) {
    const next = {};
    workflowRightSidebarTargets.forEach(target => {
      next[target] = false;
    });
    if (!value || typeof value !== "object") {
      return next;
    }
    workflowRightSidebarTargets.forEach(target => {
      next[target] = value[target] === true;
    });
    return next;
  }
  function getDefaultWorkflowRightSidebarWidthMap() {
    const defaults = {};
    const source = state && state.workflowRightSidebarWidth && typeof state.workflowRightSidebarWidth === "object"
      ? state.workflowRightSidebarWidth
      : {};
    workflowRightSidebarTargets.forEach(target => {
      defaults[target] = getWorkflowRightSidebarWidthRange(target).defaultWidth;
      if (Number.isFinite(source[target])) {
        defaults[target] = clampWorkflowRightSidebarWidth(target, Number(source[target]));
      }
    });
    return defaults;
  }
  function getWorkflowRightSidebarWidthRange(target) {
    if (target === "model3d") {
      return { min: 300, max: 560, defaultWidth: 380 };
    }
    if (target === "ask") {
      return { min: 300, max: 520, defaultWidth: 360 };
    }
    return { min: 280, max: 460, defaultWidth: target === "image" || target === "video" ? 340 : 332 };
  }
  function clampWorkflowRightSidebarWidth(target, width) {
    const range = getWorkflowRightSidebarWidthRange(target);
    if (!Number.isFinite(width)) {
      return range.defaultWidth;
    }
    return Math.min(range.max, Math.max(range.min, Math.round(width)));
  }
  function normalizeWorkflowRightSidebarWidthMap(value) {
    const defaults = getDefaultWorkflowRightSidebarWidthMap();
    if (!value || typeof value !== "object") {
      return defaults;
    }
    workflowRightSidebarTargets.forEach(target => {
      defaults[target] = clampWorkflowRightSidebarWidth(target, Number(value[target]));
    });
    return defaults;
  }
  function readWorkflowRightSidebarPreference() {
    try {
      const raw = window.localStorage.getItem(workflowRightSidebarStateStorageKey);
      if (!raw) {
        return normalizeWorkflowRightSidebarCollapsedMap(null);
      }
      return normalizeWorkflowRightSidebarCollapsedMap(JSON.parse(raw));
    } catch {
      return normalizeWorkflowRightSidebarCollapsedMap(null);
    }
  }
  function readWorkflowRightSidebarWidthPreference() {
    try {
      const raw = window.localStorage.getItem(workflowRightSidebarWidthStorageKey);
      if (!raw) {
        return normalizeWorkflowRightSidebarWidthMap(null);
      }
      return normalizeWorkflowRightSidebarWidthMap(JSON.parse(raw));
    } catch {
      return normalizeWorkflowRightSidebarWidthMap(null);
    }
  }
  function persistWorkflowRightSidebarPreference() {
    try {
      window.localStorage.setItem(workflowRightSidebarStateStorageKey, JSON.stringify(state.workflowRightSidebarCollapsed));
    } catch {}
  }
  function persistWorkflowRightSidebarWidthPreference() {
    try {
      window.localStorage.setItem(workflowRightSidebarWidthStorageKey, JSON.stringify(state.workflowRightSidebarWidth));
    } catch {}
  }
  function updateWorkflowRightSidebarToggleButtons(target, collapsed) {
    const targetLabel = target === "ask"
      ? "Ask LazyDev"
      : target === "model3d"
        ? "3D Studio"
        : target === "image"
          ? "Image Studio"
          : target === "audio"
            ? "Audio Studio"
            : target === "music"
              ? "Music Studio"
              : target === "video"
                ? "Video Studio"
                : "Studio";
    const buttonLabel = collapsed ? "Show Sidebar" : "Hide Sidebar";
    const buttonTitle = (collapsed ? "Show" : "Hide") + " " + targetLabel + " right sidebar";
    document.querySelectorAll("[data-workflow-sidebar-toggle=\"" + target + "\"]").forEach(button => {
      button.classList.toggle("is-collapsed", collapsed);
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      button.setAttribute("aria-pressed", collapsed ? "true" : "false");
      button.setAttribute("title", buttonTitle);
      button.setAttribute("aria-label", buttonTitle);
      const labelNode = button.querySelector("[data-workflow-sidebar-toggle-label]");
      if (labelNode) {
        labelNode.textContent = buttonLabel;
      }
    });
  }
  function applyWorkflowRightSidebarWidthState() {
    state.workflowRightSidebarWidth = normalizeWorkflowRightSidebarWidthMap(state.workflowRightSidebarWidth);
    workflowRightSidebarTargets.forEach(target => {
      const width = clampWorkflowRightSidebarWidth(target, state.workflowRightSidebarWidth[target]);
      const workspaceNode = document.querySelector("[data-workflow-sidebar-workspace=\"" + target + "\"]");
      const panelNode = document.querySelector("[data-workflow-sidebar-panel=\"" + target + "\"]");
      const resizerNode = document.querySelector("[data-workflow-sidebar-resizer=\"" + target + "\"]");
      state.workflowRightSidebarWidth[target] = width;
      if (workspaceNode) {
        workspaceNode.style.setProperty("--workflow-side-width", width + "px");
      }
      if (panelNode) {
        panelNode.style.setProperty("--workflow-side-width", width + "px");
      }
      if (resizerNode) {
        resizerNode.setAttribute("title", "Drag to resize sidebar");
        resizerNode.setAttribute("aria-label", "Resize " + target + " sidebar");
      }
    });
  }
  function applyWorkflowRightSidebarCollapsedState() {
    state.workflowRightSidebarCollapsed = normalizeWorkflowRightSidebarCollapsedMap(state.workflowRightSidebarCollapsed);
    workflowRightSidebarTargets.forEach(target => {
      const collapsed = state.workflowRightSidebarCollapsed[target] === true;
      const workspaceNode = document.querySelector("[data-workflow-sidebar-workspace=\"" + target + "\"]");
      const panelNode = document.querySelector("[data-workflow-sidebar-panel=\"" + target + "\"]");
      const resizerNode = document.querySelector("[data-workflow-sidebar-resizer=\"" + target + "\"]");
      if (workspaceNode) {
        workspaceNode.classList.toggle("workflow-side-collapsed", collapsed);
      }
      if (panelNode) {
        panelNode.classList.toggle("hidden", collapsed);
        panelNode.setAttribute("aria-hidden", collapsed ? "true" : "false");
      }
      if (resizerNode) {
        resizerNode.classList.toggle("hidden", collapsed);
      }
      updateWorkflowRightSidebarToggleButtons(target, collapsed);
    });
  }
  function setWorkflowRightSidebarCollapsed(target, collapsed, options) {
    const normalizedTarget = workflowRightSidebarTargets.includes(target) ? target : "";
    if (!normalizedTarget) {
      return;
    }
    state.workflowRightSidebarCollapsed = normalizeWorkflowRightSidebarCollapsedMap(state.workflowRightSidebarCollapsed);
    state.workflowRightSidebarCollapsed[normalizedTarget] = collapsed === true;
    if (!options || options.persist !== false) {
      persistWorkflowRightSidebarPreference();
    }
    applyWorkflowRightSidebarCollapsedState();
  }
  function setWorkflowRightSidebarWidth(target, width, options) {
    const normalizedTarget = workflowRightSidebarTargets.includes(target) ? target : "";
    if (!normalizedTarget) {
      return;
    }
    state.workflowRightSidebarWidth = normalizeWorkflowRightSidebarWidthMap(state.workflowRightSidebarWidth);
    state.workflowRightSidebarWidth[normalizedTarget] = clampWorkflowRightSidebarWidth(normalizedTarget, Number(width));
    if (!options || options.persist !== false) {
      persistWorkflowRightSidebarWidthPreference();
    }
    applyWorkflowRightSidebarWidthState();
  }
  function bindWorkflowRightSidebarResizers() {
    if (workflowSidebarResizersBound) {
      return;
    }
    workflowSidebarResizersBound = true;
    const workflowSidebarHandle = document.getElementById("studio-workflow-sidebar-resizer");
    if (workflowSidebarHandle) {
      workflowSidebarHandle.addEventListener("pointerdown", event => {
        if (state.aiWorkflowSidebarMode !== "sticky" || state.aiWorkflowSidebarVisible !== true) {
          return;
        }
        const pointerId = event.pointerId;
        const getRailRight = () => {
          const railNode = document.querySelector(".server-rail, .side-nav");
          const railRect = railNode ? railNode.getBoundingClientRect() : null;
          return railRect ? railRect.right : 0;
        };
        const updateWidth = clientX => {
          setWorkflowSidebarWidth(clientX - getRailRight());
        };
        event.preventDefault();
        workflowSidebarHandle.classList.add("is-dragging");
        document.body.classList.add("studio-workflow-sidebar-resizing");
        workflowSidebarHandle.setPointerCapture?.(pointerId);
        updateWidth(event.clientX);
        const onPointerMove = moveEvent => {
          if (moveEvent.pointerId !== pointerId) {
            return;
          }
          updateWidth(moveEvent.clientX);
        };
        const stopResize = endEvent => {
          if (endEvent.pointerId !== pointerId) {
            return;
          }
          workflowSidebarHandle.classList.remove("is-dragging");
          document.body.classList.remove("studio-workflow-sidebar-resizing");
          workflowSidebarHandle.releasePointerCapture?.(pointerId);
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", stopResize);
          document.removeEventListener("pointercancel", stopResize);
        };
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", stopResize);
        document.addEventListener("pointercancel", stopResize);
      });
    }
    document.querySelectorAll("[data-workflow-sidebar-resizer]").forEach(handle => {
      handle.addEventListener("pointerdown", event => {
        const target = String(handle.getAttribute("data-workflow-sidebar-resizer") || "").trim();
        if (!workflowRightSidebarTargets.includes(target)) {
          return;
        }
        if (state.workflowRightSidebarCollapsed && state.workflowRightSidebarCollapsed[target] === true) {
          return;
        }
        const workspaceNode = document.querySelector("[data-workflow-sidebar-workspace=\"" + target + "\"]");
        if (!workspaceNode) {
          return;
        }
        const pointerId = event.pointerId;
        const updateWidth = clientX => {
          const rect = workspaceNode.getBoundingClientRect();
          const nextWidth = rect.right - clientX;
          setWorkflowRightSidebarWidth(target, nextWidth);
        };
        event.preventDefault();
        handle.classList.add("is-dragging");
        document.body.classList.add("workflow-sidebar-resizing");
        handle.setPointerCapture?.(pointerId);
        updateWidth(event.clientX);
        const onPointerMove = moveEvent => {
          if (moveEvent.pointerId !== pointerId) {
            return;
          }
          updateWidth(moveEvent.clientX);
        };
        const stopResize = endEvent => {
          if (endEvent.pointerId !== pointerId) {
            return;
          }
          handle.classList.remove("is-dragging");
          document.body.classList.remove("workflow-sidebar-resizing");
          handle.releasePointerCapture?.(pointerId);
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", stopResize);
          document.removeEventListener("pointercancel", stopResize);
        };
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", stopResize);
        document.addEventListener("pointercancel", stopResize);
      });
    });
  }
  function bindStudioRailHoverExpansion() {
    if (studioRailHoverBound) {
      return;
    }
    const rail = document.querySelector(".server-rail, .side-nav");
    if (!(rail instanceof HTMLElement)) {
      return;
    }
    studioRailHoverBound = true;
    document.body.dataset.studioRailHoverBound = "true";
    const updateHoverGroup = event => {
      setStudioRailPointerPosition(event);
      const nextGroup = event.type === "focusin" ? getStudioRailHoverGroup(event.target) : (getStudioRailHoverGroupFromPoint() || getStudioRailHoverGroup(event.target));
      if (!nextGroup) {
        return;
      }
      setStudioRailHoverGroup(nextGroup, {
        activateSelection: event.type !== "focusin" && ["collapse-expand", "collapse-expand-keep-others"].includes(normalizeStudioRailHoverMode(state.studioRailHoverMode))
      });
      scheduleStudioRailHoverReconcile();
    };
    const deactivate = event => {
      const nextTarget = event?.relatedTarget;
      if (nextTarget instanceof Node && rail.contains(nextTarget)) {
        return;
      }
      clearStudioRailHoverTimers();
      studioRailHoverClearTimer = window.setTimeout(() => {
        studioRailHoverClearTimer = 0;
        hideStudioRailHoverGroup();
      }, studioRailHoverClearDelayMs);
    };
    const handleFocusOut = event => {
      const nextTarget = event?.relatedTarget;
      if (nextTarget instanceof Node && rail.contains(nextTarget)) {
        setStudioRailHoverGroup(getStudioRailHoverGroup(nextTarget));
        return;
      }
      deactivate(event);
    };
    rail.addEventListener("pointerenter", updateHoverGroup);
    rail.addEventListener("pointermove", updateHoverGroup);
    rail.addEventListener("focusin", updateHoverGroup);
    rail.addEventListener("click", event => {
      if (!collapseRepeatedStudioRailCategoryClick(event)) promoteStudioRailSelection(event.target);
    }, true);
    rail.addEventListener("pointerleave", deactivate);
    rail.addEventListener("focusout", handleFocusOut);
    window.addEventListener("resize", () => {
      clearStudioRailHoverTimers();
      delete document.body.dataset.studioRailHoverGroup;
      delete document.body.dataset.studioRailHoverLeavingGroup;
      applyStudioRailHoverGroupState();
    });
  }
  function normalizeWorkflowActionTab(tabName) {
    const validTabs = ["generate", "edit", "rigging"];
    return validTabs.includes(tabName) ? tabName : "generate";
  }

  function readWorkflowActionTabPreference(focusedId) {
    try {
      const key = "urage-studio-workflow-action-tab-" + focusedId;
      const raw = window.localStorage.getItem(key);
      return normalizeWorkflowActionTab(raw);
    } catch {
      return "generate";
    }
  }

  function persistWorkflowActionTab(focusedId, tab) {
    try {
      const key = "urage-studio-workflow-action-tab-" + focusedId;
      window.localStorage.setItem(key, tab);
    } catch {}
  }

  function getWorkflowActionTabsForWorkflow(focusedId) {
    if (focusedId === "image-studio-card") {
      return ["generate", "edit"];
    }
    if (focusedId === "model3d-studio-card") {
      return ["generate", "edit", "rigging"];
    }
    return ["generate"];
  }

  function getWorkflowActionTabIcon(tab) {
    if (tab === "generate") {
      return '<i class="bi bi-stars" aria-hidden="true"></i>';
    }
    if (tab === "edit") {
      return '<i class="bi bi-pencil-square" aria-hidden="true"></i>';
    }
    if (tab === "rigging") {
      return '<i class="bi bi-diagram-3" aria-hidden="true"></i>';
    }
    return "";
  }

  function renderWorkflowActionTabs(focusedId, activeTab) {
    const tabsContainer = document.getElementById("studio-workflow-action-tabs");
    if (!tabsContainer) return;

    // Show/hide the correct tab group based on focused workflow
    tabsContainer.querySelectorAll("[data-studio-action-target]").forEach(group => {
      const targetId = String(group.getAttribute("data-studio-action-target") || "").trim();
      group.classList.toggle("hidden", targetId !== focusedId);
    });

    // Update active state on the visible tab buttons
    const visibleGroup = tabsContainer.querySelector("[data-studio-action-target]:not(.hidden)");
    if (visibleGroup) {
      visibleGroup.querySelectorAll(".dashboard-tab").forEach(btn => {
        const btnTab = String(btn.getAttribute("data-image-studio-tab") ||
          btn.getAttribute("data-model3d-studio-tab") || "").trim();
        btn.classList.toggle("active", btnTab === activeTab);
      });

      // Bind click handlers for tab switching
      visibleGroup.querySelectorAll(".dashboard-tab").forEach(btn => {
        const existing = btn.getAttribute("_tab-bound");
        if (existing) return;
        btn.setAttribute("_tab-bound", "1");
        btn.addEventListener("click", () => {
          const tab = String(btn.getAttribute("data-image-studio-tab") ||
            btn.getAttribute("data-model3d-studio-tab") || "").trim();
          if (tab.length === 0) return;
          setWorkflowActionTab(focusedId, tab);
        });
      });
    }
  }

  function setWorkflowActionTab(focusedId, tab, options) {
    const normalizedTab = normalizeWorkflowActionTab(tab);
    state.aiWorkflowActionTabs = state.aiWorkflowActionTabs || {};
    state.aiWorkflowActionTabs[focusedId] = normalizedTab;
    if (!options || options.persist !== false) {
      persistWorkflowActionTab(focusedId, normalizedTab);
    }
  }

  function getActiveWorkflowActionTab(focusedId) {
    if (state && state.aiWorkflowActionTabs && state.aiWorkflowActionTabs[focusedId]) {
      return normalizeWorkflowActionTab(state.aiWorkflowActionTabs[focusedId]);
    }
    return readWorkflowActionTabPreference(focusedId);
  }

  function updateStudioWorkflowSidebar() {
    const activeView = getActiveView();
    const studioViewActive = activeView === "ai";
    const focusedId = String(state.aiFocusedSectionId || "").trim();
    const sidebarOpen = studioViewActive && focusedId.length > 0 && state.aiWorkflowSidebarVisible === true;

    // Get and render workflow action tabs
    let activeTab = getActiveWorkflowActionTab(focusedId);
    renderWorkflowActionTabs(focusedId, activeTab);

    applyWorkflowSidebarModeState();
    document.body.classList.toggle("studio-workflow-sidebar-open", sidebarOpen);
    const workflowSidebarNode = document.querySelector(".studio-workflow-sidebar");
    if (workflowSidebarNode) {
      if (sidebarOpen) {
        workflowSidebarNode.style.removeProperty("display");
      } else {
        workflowSidebarNode.style.display = "none";
      }
    }
    const titleNode = document.getElementById("studio-workflow-sidebar-title");
    const summaryNode = document.getElementById("studio-workflow-sidebar-summary");
    const fallbackMeta = studioWorkflowSidebarMeta[focusedId] || null;
    let nextTitle = fallbackMeta ? fallbackMeta.title : "Focused Workflow";
    let nextSummary = fallbackMeta
      ? fallbackMeta.summary
      : "Pick a workflow from the left rail to show targeted navigation and helper notes.";
    if (focusedId) {
      const focusedCard = document.getElementById(focusedId);
      if (focusedCard) {
        const cardTitleNode = focusedCard.querySelector("h3");
        const cardSummaryNode = focusedCard.querySelector(".panel-subtitle");
        const cardTitle = cardTitleNode ? String(cardTitleNode.textContent || "").trim() : "";
        const cardSummary = cardSummaryNode ? String(cardSummaryNode.textContent || "").trim() : "";
        if (cardTitle) {
          nextTitle = cardTitle;
        }
        if (cardSummary) {
          nextSummary = cardSummary;
        }
      }
    }
    if (titleNode) {
      titleNode.textContent = nextTitle;
    }
    if (summaryNode) {
      summaryNode.textContent = nextSummary;
    }
    document.querySelectorAll("[data-studio-workflow-nav-group]").forEach(group => {
      const targetId = String(group.getAttribute("data-studio-workflow-nav-group") || "").trim();
      group.classList.toggle("hidden", focusedId.length === 0 || targetId !== focusedId);
    });
    document.querySelectorAll("[data-studio-workflow-context]").forEach(node => {
      const contextId = String(node.getAttribute("data-studio-workflow-context") || "").trim();
      const showNode = focusedId.length > 0 && contextId === focusedId;
      node.classList.toggle("hidden", !showNode);
    });
    applyWorkflowRightSidebarWidthState();
    applyWorkflowRightSidebarCollapsedState();
  }
  state.studioRailHoverMode = readStudioRailHoverModePreference();
  state.aiWorkflowSidebarMode = readWorkflowSidebarModePreference();
  state.aiWorkflowSidebarWidth = readWorkflowSidebarWidthPreference();
  return {
    readStudioRailExpandedPreference,
    readStudioRailHoverModePreference,
    readWorkflowSidebarModePreference,
    readWorkflowSidebarWidthPreference,
    applyStudioRailExpandedState,
    applyStudioRailHoverModeState,
    applyWorkflowSidebarModeState,
    applyWorkflowSidebarWidthState,
    setStudioRailHoverMode,
    setStudioRailExpanded,
    setWorkflowSidebarMode,
    setWorkflowSidebarWidth,
    readWorkflowRightSidebarPreference,
    readWorkflowRightSidebarWidthPreference,
    applyWorkflowRightSidebarCollapsedState,
    applyWorkflowRightSidebarWidthState,
    setWorkflowRightSidebarCollapsed,
    setWorkflowRightSidebarWidth,
    bindWorkflowRightSidebarResizers,
    bindStudioRailHoverExpansion,
    updateStudioWorkflowSidebar
  };
}
