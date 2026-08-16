const desktopToolQuickPickerStorageKey = "urage-tools-desktop-pinned";

function getToolQuickActionUi(kind) {
    if (kind === "video") {
      return {
        pickerRootId: "video-tool-picker",
        pickerToggleId: "video-tool-picker-toggle",
        pickerLabelId: "video-tool-picker-label",
        pickerMenuId: "video-tool-picker-menu",
        sendButtonId: "video-send-to-tool-button",
        quickActionsId: "video-tool-quick-actions",
        assetLabel: "video"
      };
    }
    if (kind === "model3d") {
      return {
        pickerRootId: "model3d-tool-picker",
        pickerToggleId: "model3d-tool-picker-toggle",
        pickerLabelId: "model3d-tool-picker-label",
        pickerMenuId: "model3d-tool-picker-menu",
        sendButtonId: "model3d-send-to-tool-button",
        quickActionsId: "model3d-tool-quick-actions",
        assetLabel: "3D model"
      };
    }
    return {
      pickerRootId: "image-tool-picker",
      pickerToggleId: "image-tool-picker-toggle",
      pickerLabelId: "image-tool-picker-label",
      pickerMenuId: "image-tool-picker-menu",
      sendButtonId: "image-send-to-tool-button",
      quickActionsId: "image-tool-quick-actions",
      assetLabel: "image"
    };
  }
  function normalizeToolQuickActionKind(kind) {
    if (kind === "model3d" || kind === "video") {
      return kind;
    }
    return "image";
  }
  function getPreferredToolEntryForKind(entries, kind) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const list = Array.isArray(entries) ? entries : [];
    if (normalizedKind === "video") return list.find(entry => normalizeToolSourcePath(entry.sourcePath).includes("/tools/video/media-converter/")) || null;
    if (normalizedKind === "model3d") return list.find(entry => isThreeModelViewerToolSourcePath(entry.sourcePath)) || list.find(entry => isImageToolTargetSourcePath(entry.sourcePath)) || null;
    return getPreferredDefaultToolEntry(list);
  }
  function isToolEntryCompatibleWithQuickAction(entry, kind) {
    const sourcePath = String(entry?.sourcePath || "").trim();
    const normalizedKind = normalizeToolQuickActionKind(kind);
    if (!sourcePath) return false;
    if (normalizedKind === "video") return normalizeToolSourcePath(sourcePath).includes("/tools/video/media-converter/");
    if (normalizedKind === "model3d") return isThreeModelViewerToolSourcePath(sourcePath) || isImageToolTargetSourcePath(sourcePath);
    return isImageToolTargetSourcePath(sourcePath) && !isThreeModelViewerToolSourcePath(sourcePath) && !isGifViewerToolSourcePath(sourcePath);
  }
  function getCompatibleToolQuickActionEntries(kind, entries) {
    const list = Array.isArray(entries) ? entries : getToolsCatalogEntries();
    return list.filter(entry => isToolEntryCompatibleWithQuickAction(entry, kind));
  }
  function readPinnedDesktopQuickActionTools() {
    try {
      const parsed = JSON.parse(localStorage.getItem(desktopToolQuickPickerStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter(entry => entry && typeof entry.path === "string") : [];
    } catch {
      return [];
    }
  }
  function getToolQuickActionPickerTab(kind) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    if (normalizedKind === "model3d") {
      return toolQuickActionState.modelPickerTab === "desktop" ? "desktop" : "web";
    }
    return toolQuickActionState.imagePickerTab === "desktop" ? "desktop" : "web";
  }
  function setToolQuickActionPickerTab(kind, tab, options) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const nextTab = tab === "desktop" ? "desktop" : "web";
    if (normalizedKind === "model3d") {
      toolQuickActionState.modelPickerTab = nextTab;
      writeStoredToolId(toolQuickActionStorageKeys.modelPickerTab, nextTab);
    } else if (normalizedKind === "image") {
      toolQuickActionState.imagePickerTab = nextTab;
      writeStoredToolId(toolQuickActionStorageKeys.imagePickerTab, nextTab);
    } else {
      return;
    }
    if (!options || options.render !== false) {
      renderToolPickerMenu(normalizedKind);
    }
  }
  function syncToolQuickActionPreferences(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length === 0) {
      toolQuickActionState.imagePinnedIds = readStoredToolIdList(toolQuickActionStorageKeys.imagePinned);
      toolQuickActionState.modelPinnedIds = readStoredToolIdList(toolQuickActionStorageKeys.modelPinned);
      toolQuickActionState.videoPinnedIds = readStoredToolIdList(toolQuickActionStorageKeys.videoPinned);
      toolQuickActionState.imagePickerTab = readStoredToolId(toolQuickActionStorageKeys.imagePickerTab) === "desktop" ? "desktop" : "web";
      toolQuickActionState.modelPickerTab = readStoredToolId(toolQuickActionStorageKeys.modelPickerTab) === "desktop" ? "desktop" : "web";
      const storedImageSelectedId = String(readStoredToolId(toolQuickActionStorageKeys.imageSelected) || "").trim();
      const storedModelSelectedId = String(readStoredToolId(toolQuickActionStorageKeys.modelSelected) || "").trim();
      const storedVideoSelectedId = String(readStoredToolId(toolQuickActionStorageKeys.videoSelected) || "").trim();
      const storedImageSelectedExplicit = readStoredToolId(toolQuickActionStorageKeys.imageSelectedExplicit) === "1";
      const storedModelSelectedExplicit = readStoredToolId(toolQuickActionStorageKeys.modelSelectedExplicit) === "1";
      const storedVideoSelectedExplicit = readStoredToolId(toolQuickActionStorageKeys.videoSelectedExplicit) === "1";
      toolQuickActionState.imageSelectedExplicit = storedImageSelectedExplicit && !!storedImageSelectedId;
      toolQuickActionState.modelSelectedExplicit = storedModelSelectedExplicit && !!storedModelSelectedId;
      toolQuickActionState.videoSelectedExplicit = storedVideoSelectedExplicit && !!storedVideoSelectedId;
      toolQuickActionState.imageSelectedId = storedImageSelectedId;
      toolQuickActionState.modelSelectedId = storedModelSelectedId;
      toolQuickActionState.videoSelectedId = storedVideoSelectedId;
      return;
    }
    const imageEntries = getCompatibleToolQuickActionEntries("image", list);
    const modelEntries = getCompatibleToolQuickActionEntries("model3d", list);
    const videoEntries = getCompatibleToolQuickActionEntries("video", list);
    const imageIds = new Set(imageEntries.map(entry => entry.id));
    const modelIds = new Set(modelEntries.map(entry => entry.id));
    const videoIds = new Set(videoEntries.map(entry => entry.id));
    const defaultImageEntry = getPreferredToolEntryForKind(imageEntries, "image");
    const defaultModelEntry = getPreferredToolEntryForKind(modelEntries, "model3d");
    const defaultVideoEntry = getPreferredToolEntryForKind(videoEntries, "video");
    const normalizeIdList = (values, validIds) => Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(value => validIds.has(value))));
    toolQuickActionState.imagePinnedIds = normalizeIdList(readStoredToolIdList(toolQuickActionStorageKeys.imagePinned), imageIds);
    toolQuickActionState.modelPinnedIds = normalizeIdList(readStoredToolIdList(toolQuickActionStorageKeys.modelPinned), modelIds);
    toolQuickActionState.videoPinnedIds = normalizeIdList(readStoredToolIdList(toolQuickActionStorageKeys.videoPinned), videoIds);
    toolQuickActionState.imagePickerTab = readStoredToolId(toolQuickActionStorageKeys.imagePickerTab) === "desktop" ? "desktop" : "web";
    toolQuickActionState.modelPickerTab = readStoredToolId(toolQuickActionStorageKeys.modelPickerTab) === "desktop" ? "desktop" : "web";
    const storedImageSelectedId = String(readStoredToolId(toolQuickActionStorageKeys.imageSelected) || "").trim();
    const storedModelSelectedId = String(readStoredToolId(toolQuickActionStorageKeys.modelSelected) || "").trim();
    const storedVideoSelectedId = String(readStoredToolId(toolQuickActionStorageKeys.videoSelected) || "").trim();
    const storedImageSelectedExplicit = readStoredToolId(toolQuickActionStorageKeys.imageSelectedExplicit) === "1";
    const storedModelSelectedExplicit = readStoredToolId(toolQuickActionStorageKeys.modelSelectedExplicit) === "1";
    const storedVideoSelectedExplicit = readStoredToolId(toolQuickActionStorageKeys.videoSelectedExplicit) === "1";
    toolQuickActionState.imageSelectedExplicit = imageIds.has(storedImageSelectedId) && storedImageSelectedExplicit;
    toolQuickActionState.modelSelectedExplicit = modelIds.has(storedModelSelectedId) && storedModelSelectedExplicit;
    toolQuickActionState.videoSelectedExplicit = videoIds.has(storedVideoSelectedId) && storedVideoSelectedExplicit;
    toolQuickActionState.imageSelectedId = toolQuickActionState.imageSelectedExplicit
      ? storedImageSelectedId
      : (defaultImageEntry ? defaultImageEntry.id : "");
    toolQuickActionState.modelSelectedId = toolQuickActionState.modelSelectedExplicit
      ? storedModelSelectedId
      : (defaultModelEntry ? defaultModelEntry.id : "");
    toolQuickActionState.videoSelectedId = toolQuickActionState.videoSelectedExplicit
      ? storedVideoSelectedId
      : (defaultVideoEntry ? defaultVideoEntry.id : "");
    writeStoredToolIdList(toolQuickActionStorageKeys.imagePinned, toolQuickActionState.imagePinnedIds);
    writeStoredToolIdList(toolQuickActionStorageKeys.modelPinned, toolQuickActionState.modelPinnedIds);
    writeStoredToolIdList(toolQuickActionStorageKeys.videoPinned, toolQuickActionState.videoPinnedIds);
    writeStoredToolId(toolQuickActionStorageKeys.imageSelected, toolQuickActionState.imageSelectedId);
    writeStoredToolId(toolQuickActionStorageKeys.modelSelected, toolQuickActionState.modelSelectedId);
    writeStoredToolId(toolQuickActionStorageKeys.videoSelected, toolQuickActionState.videoSelectedId);
    writeStoredToolId(toolQuickActionStorageKeys.imageSelectedExplicit, toolQuickActionState.imageSelectedExplicit ? "1" : "");
    writeStoredToolId(toolQuickActionStorageKeys.modelSelectedExplicit, toolQuickActionState.modelSelectedExplicit ? "1" : "");
    writeStoredToolId(toolQuickActionStorageKeys.videoSelectedExplicit, toolQuickActionState.videoSelectedExplicit ? "1" : "");
    writeStoredToolId(toolQuickActionStorageKeys.imagePickerTab, toolQuickActionState.imagePickerTab === "desktop" ? "desktop" : "web");
    writeStoredToolId(toolQuickActionStorageKeys.modelPickerTab, toolQuickActionState.modelPickerTab === "desktop" ? "desktop" : "web");
  }
  function getSelectedToolQuickActionEntry(kind) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const entries = getCompatibleToolQuickActionEntries(normalizedKind);
    const selectedId = normalizedKind === "model3d"
      ? toolQuickActionState.modelSelectedId
      : normalizedKind === "video"
        ? toolQuickActionState.videoSelectedId
        : toolQuickActionState.imageSelectedId;
    const selected = entries.find(entry => entry.id === selectedId) || null;
    if (selected) {
      return selected;
    }
    return getPreferredToolEntryForKind(entries, normalizedKind);
  }
  function getToolPickerPortalRoot() {
    let root = document.getElementById("studio-tool-picker-portal-root");
    if (root) {
      return root;
    }
    root = document.createElement("div");
    root.id = "studio-tool-picker-portal-root";
    root.className = "studio-tool-picker-portal-root";
    document.body.appendChild(root);
    return root;
  }
  function getToolPickerOriginalParent(menu) {
    const parentId = menu?.getAttribute("data-picker-parent-id") || "";
    return parentId ? document.getElementById(parentId) : null;
  }
  function ensureToolPickerParentId(menu) {
    const parent = menu?.parentElement || null;
    if (!menu || !parent || parent.id === "studio-tool-picker-portal-root") {
      return;
    }
    if (!parent.id) {
      parent.id = "studio-tool-picker-parent-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    }
    menu.setAttribute("data-picker-parent-id", parent.id);
  }
  function restoreToolPickerMenu(menu) {
    if (!menu) {
      return;
    }
    const parent = getToolPickerOriginalParent(menu);
    if (parent && menu.parentElement !== parent) {
      parent.appendChild(menu);
    }
    menu.classList.remove("is-portaled");
    menu.style.removeProperty("left");
    menu.style.removeProperty("top");
    menu.style.removeProperty("width");
    menu.style.removeProperty("max-height");
  }
  function positionToolPickerMenu(menu, toggle) {
    if (!menu || !toggle) {
      return;
    }
    ensureToolPickerParentId(menu);
    getToolPickerPortalRoot().appendChild(menu);
    menu.classList.add("is-portaled");
    const rect = toggle.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const width = Math.min(360, Math.max(240, rect.width));
    const left = Math.max(8, Math.min(viewportWidth - width - 8, rect.left));
    const belowTop = rect.bottom + 8;
    const aboveTop = rect.top - 8;
    const spaceBelow = viewportHeight - belowTop - 8;
    const spaceAbove = aboveTop - 8;
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(420, openAbove ? spaceAbove : spaceBelow));
    menu.style.left = left + "px";
    menu.style.top = (openAbove ? Math.max(8, aboveTop - maxHeight) : belowTop) + "px";
    menu.style.width = width + "px";
    menu.style.maxHeight = maxHeight + "px";
  }
  function setToolPickerOpen(kind, open) {
    const nextKind = normalizeToolQuickActionKind(kind);
    const nextUi = getToolQuickActionUi(nextKind);
    const nextMenu = document.getElementById(nextUi.pickerMenuId);
    const nextToggle = document.getElementById(nextUi.pickerToggleId);
    ["image", "model3d", "video"].filter(entry => entry !== nextKind).forEach(otherKind => {
      const otherUi = getToolQuickActionUi(otherKind);
      const otherMenu = document.getElementById(otherUi.pickerMenuId);
      const otherToggle = document.getElementById(otherUi.pickerToggleId);
      if (otherMenu) {
        otherMenu.classList.add("hidden");
        restoreToolPickerMenu(otherMenu);
      }
      if (otherToggle) otherToggle.setAttribute("aria-expanded", "false");
    });
    if (!nextMenu) {
      return;
    }
    nextMenu.classList.toggle("hidden", open !== true);
    if (open === true) {
      positionToolPickerMenu(nextMenu, nextToggle);
    } else {
      restoreToolPickerMenu(nextMenu);
    }
    if (nextToggle) {
      nextToggle.setAttribute("aria-expanded", open === true ? "true" : "false");
    }
  }
  function closeAllToolPickers() {
    setToolPickerOpen("image", false);
    setToolPickerOpen("model3d", false);
    setToolPickerOpen("video", false);
  }
  function setSelectedToolQuickAction(kind, toolId, options) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const normalizedId = String(toolId || "").trim();
    if (!normalizedId) {
      return;
    }
    if (normalizedKind === "model3d") {
      toolQuickActionState.modelSelectedId = normalizedId;
      toolQuickActionState.modelSelectedExplicit = true;
      writeStoredToolId(toolQuickActionStorageKeys.modelSelected, normalizedId);
      writeStoredToolId(toolQuickActionStorageKeys.modelSelectedExplicit, "1");
    } else if (normalizedKind === "video") {
      toolQuickActionState.videoSelectedId = normalizedId;
      toolQuickActionState.videoSelectedExplicit = true;
      writeStoredToolId(toolQuickActionStorageKeys.videoSelected, normalizedId);
      writeStoredToolId(toolQuickActionStorageKeys.videoSelectedExplicit, "1");
    } else {
      toolQuickActionState.imageSelectedId = normalizedId;
      toolQuickActionState.imageSelectedExplicit = true;
      writeStoredToolId(toolQuickActionStorageKeys.imageSelected, normalizedId);
      writeStoredToolId(toolQuickActionStorageKeys.imageSelectedExplicit, "1");
    }
    refreshToolQuickActionUi();
    if (!options || options.silent !== true) {
      const selectedEntry = getSelectedToolQuickActionEntry(normalizedKind);
      if (selectedEntry) {
        setOutput("Selected " + selectedEntry.title + " for " + (normalizedKind === "model3d" ? "3D model" : normalizedKind) + " quick actions.");
      }
    }
    if (options && options.closePicker === true) {
      setToolPickerOpen(normalizedKind, false);
    }
  }
  function togglePinnedToolQuickAction(kind, toolId) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const normalizedId = String(toolId || "").trim();
    if (!normalizedId) {
      return;
    }
    const source = normalizedKind === "model3d"
      ? toolQuickActionState.modelPinnedIds
      : normalizedKind === "video"
        ? toolQuickActionState.videoPinnedIds
        : toolQuickActionState.imagePinnedIds;
    const next = source.includes(normalizedId)
      ? source.filter(entry => entry !== normalizedId)
      : source.concat([normalizedId]);
    if (normalizedKind === "model3d") {
      toolQuickActionState.modelPinnedIds = next;
      writeStoredToolIdList(toolQuickActionStorageKeys.modelPinned, next);
    } else if (normalizedKind === "video") {
      toolQuickActionState.videoPinnedIds = next;
      writeStoredToolIdList(toolQuickActionStorageKeys.videoPinned, next);
    } else {
      toolQuickActionState.imagePinnedIds = next;
      writeStoredToolIdList(toolQuickActionStorageKeys.imagePinned, next);
    }
    refreshToolQuickActionUi();
  }
  function activateToolWorkspaceButton(button, options) {
    if (!button || typeof toolsWorkspaceState.setActiveToolButton !== "function") {
      return false;
    }
    toolsWorkspaceState.setActiveToolButton(button, options);
    return true;
  }
  function activateToolWorkspaceBySourcePath(sourcePath) {
    const button = findToolCatalogButtonBySourcePath(sourcePath);
    if (!button) {
      return null;
    }
    activateToolWorkspaceButton(button);
    return button;
  }
  function renderStudioHomeToolCards() {
    const gridNode = document.getElementById("studio-tools-quick-grid");
    if (!gridNode) {
      return;
    }
    clearChildren(gridNode);
    const entries = getToolsCatalogEntries();
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.id = "studio-tools-quick-empty";
      empty.innerHTML = "No local tools with <code>index.html</code> detected yet.";
      gridNode.appendChild(empty);
      return;
    }
    entries.forEach(entry => {
      const tile = document.createElement("article");
      tile.className = "studio-workflow-quick-tile is-tool";
      const icon = document.createElement("div");
      icon.className = "studio-workflow-quick-tile-icon";
      if (entry.thumbnailPath) {
        const image = document.createElement("img");
        image.className = "studio-tool-quick-tile-thumb";
        image.src = entry.thumbnailPath;
        image.alt = "";
        image.loading = "lazy";
        icon.appendChild(image);
      } else {
        setDashboardClientSvgIcon(icon, "tools");
      }
      const title = document.createElement("h4");
      title.textContent = entry.title;
      const subtitle = document.createElement("div");
      subtitle.className = "panel-subtitle";
      subtitle.textContent = entry.description;
      const openButton = document.createElement("button");
      openButton.className = "studio-workflow-quick-tile-open";
      openButton.type = "button";
      openButton.innerHTML = renderDashboardClientButtonIcon("expand") + "<span>Open</span>";
      openButton.addEventListener("click", () => {
        switchView("tools");
        activateToolWorkspaceBySourcePath(entry.sourcePath);
        setOutput("Opened " + entry.title + " in the tools workspace.");
      });
      tile.appendChild(icon);
      tile.appendChild(title);
      tile.appendChild(subtitle);
      tile.appendChild(openButton);
      gridNode.appendChild(tile);
    });
  }
  function renderToolPickerMenu(kind) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const ui = getToolQuickActionUi(normalizedKind);
    const menuNode = document.getElementById(ui.pickerMenuId);
    const labelNode = document.getElementById(ui.pickerLabelId);
    const entries = getCompatibleToolQuickActionEntries(normalizedKind);
    const desktopTools = readPinnedDesktopQuickActionTools();
    const selected = getSelectedToolQuickActionEntry(normalizedKind);
    const hasSurfaceTabs = normalizedKind === "image" || normalizedKind === "model3d";
    const activeTab = hasSurfaceTabs ? getToolQuickActionPickerTab(normalizedKind) : "web";
    if (labelNode) {
      labelNode.textContent = selected ? selected.title : "Select Tool";
    }
    if (!menuNode) {
      return;
    }
    clearChildren(menuNode);
    if (hasSurfaceTabs) {
      const tabs = document.createElement("div");
      tabs.className = "studio-tool-picker-tabs";
      [["web", "Web"], ["desktop", "Desktop"]].forEach(([tabId, label]) => {
        const button = document.createElement("button");
        button.className = "studio-tool-picker-tab" + (activeTab === tabId ? " active" : "");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-pressed", activeTab === tabId ? "true" : "false");
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          setToolQuickActionPickerTab(normalizedKind, tabId);
        });
        tabs.appendChild(button);
      });
      menuNode.appendChild(tabs);
    }
    if (activeTab === "desktop") {
      if (desktopTools.length === 0) {
        const emptyNode = document.createElement("div");
        emptyNode.className = "studio-tool-picker-empty";
        emptyNode.textContent = "No pinned desktop launchers yet. Add one in Tools > Desktop.";
        menuNode.appendChild(emptyNode);
        return;
      }
      desktopTools.forEach(tool => {
        const row = document.createElement("div");
        row.className = "studio-tool-picker-row";
        const selectButton = document.createElement("button");
        selectButton.className = "secondary mini-button studio-tool-picker-select";
        selectButton.type = "button";
        selectButton.textContent = String(tool.title || tool.path || "Desktop Tool").trim() || "Desktop Tool";
        selectButton.title = String(tool.path || "").trim();
        selectButton.addEventListener("click", async event => {
          event.preventDefault();
          event.stopPropagation();
          try {
            const response = await fetch("/api/desktop-tools/launch", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ toolPath: tool.path })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload && payload.error ? payload.error : "Failed to launch desktop tool.");
            }
            setOutput("Launched " + (tool.title || "desktop tool") + ".");
            setToolPickerOpen(normalizedKind, false);
          } catch (error) {
            setOutput(error && error.message ? error.message : "Failed to launch desktop tool.");
          }
        });
        const hintButton = document.createElement("button");
        hintButton.className = "secondary mini-button studio-tool-picker-pin";
        hintButton.type = "button";
        hintButton.textContent = "Path";
        hintButton.title = String(tool.path || "").trim();
        hintButton.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          setOutput(String(tool.path || "").trim() || "Desktop tool path unavailable.");
        });
        row.append(selectButton, hintButton);
        menuNode.appendChild(row);
      });
      return;
    }
    if (entries.length === 0) {
      const emptyNode = document.createElement("div");
      emptyNode.className = "studio-tool-picker-empty";
      emptyNode.textContent = "No compatible tools detected for " + ui.assetLabel + ".";
      menuNode.appendChild(emptyNode);
      return;
    }
    const pinnedIds = normalizedKind === "model3d"
      ? toolQuickActionState.modelPinnedIds
      : normalizedKind === "video"
        ? toolQuickActionState.videoPinnedIds
        : toolQuickActionState.imagePinnedIds;
    entries.forEach(entry => {
      const row = document.createElement("div");
      row.className = "studio-tool-picker-row";
      const selectButton = document.createElement("button");
      selectButton.className = "secondary mini-button studio-tool-picker-select";
      selectButton.type = "button";
      selectButton.textContent = entry.title + " (" + entry.categoryLabel + ")";
      selectButton.classList.toggle("active", selected ? selected.id === entry.id : false);
      selectButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedToolQuickAction(normalizedKind, entry.id, { closePicker: true });
      });
      const pinButton = document.createElement("button");
      pinButton.className = "secondary mini-button studio-tool-picker-pin";
      pinButton.type = "button";
      pinButton.textContent = pinnedIds.includes(entry.id) ? "Unpin" : "Quick";
      pinButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        togglePinnedToolQuickAction(normalizedKind, entry.id);
      });
      row.appendChild(selectButton);
      row.appendChild(pinButton);
      menuNode.appendChild(row);
    });
  }
  function renderPinnedToolQuickActions(kind) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const ui = getToolQuickActionUi(normalizedKind);
    const container = document.getElementById(ui.quickActionsId);
    if (!container) {
      return;
    }
    clearChildren(container);
    const entries = getToolsCatalogEntries();
    const pinnedIds = normalizedKind === "model3d"
      ? toolQuickActionState.modelPinnedIds
      : normalizedKind === "video"
        ? toolQuickActionState.videoPinnedIds
        : toolQuickActionState.imagePinnedIds;
    const pinnedEntries = pinnedIds
      .map(toolId => entries.find(entry => entry.id === toolId) || null)
      .filter(Boolean);
    container.classList.toggle("hidden", pinnedEntries.length === 0);
    pinnedEntries.forEach(entry => {
      const button = document.createElement("button");
      button.className = "secondary mini-button tool-quick-action-button";
      button.type = "button";
      button.textContent = "Send To " + entry.title;
      button.title = "Send selected " + ui.assetLabel + " to " + entry.title + ".";
      button.addEventListener("click", async () => {
        if (normalizedKind === "model3d") {
          await sendSelectedModelToToolById(entry.id, { switchView: true });
          return;
        }
        if (normalizedKind === "video") {
          await sendSelectedVideoToToolById(entry.id, { switchView: true });
          return;
        }
        await sendSelectedImageToToolById(entry.id, { switchView: true });
      });
      container.appendChild(button);
    });
  }
  function refreshToolQuickActionUi() {
    renderStudioHomeToolCards();
    renderToolPickerMenu("image");
    renderToolPickerMenu("model3d");
    renderToolPickerMenu("video");
    renderPinnedToolQuickActions("image");
    renderPinnedToolQuickActions("model3d");
    renderPinnedToolQuickActions("video");
    bindAiToolQuickActionEvents();
    updateModel3dToolQuickActionState();
    updateVideoToolQuickActionState();
  }
  async function ensureToolWorkspaceFrameForEntry(entry, options) {
    const sourcePath = String(entry && entry.sourcePath ? entry.sourcePath : "").trim();
    if (!sourcePath) {
      throw new Error("Selected tool has no source path.");
    }
    if (options && options.switchView === true) {
      switchView("tools");
    }
    const frameNode = document.getElementById("tools-workspace-frame");
    if (!frameNode) {
      throw new Error("Tools workspace frame is unavailable.");
    }
    if (options && options.defaultImage === false) {
      frameNode.setAttribute("data-suppress-default-art-image", "1");
    } else {
      frameNode.removeAttribute("data-suppress-default-art-image");
    }
    const normalizedSourcePath = normalizeToolSourcePath(sourcePath);
    const previousFrameSource = normalizeToolSourcePath(frameNode.getAttribute("src"));
    const button = activateToolWorkspaceBySourcePath(sourcePath);
    const currentFrameSource = normalizeToolSourcePath(frameNode.getAttribute("src"));
    if (currentFrameSource !== normalizedSourcePath) {
      const loadPromise = waitForToolFrameLoad(frameNode, 12_000);
      frameNode.setAttribute("src", sourcePath);
      await loadPromise;
    } else if (previousFrameSource !== normalizedSourcePath || (button && !frameNode.contentWindow)) {
      await waitForToolFrameLoad(frameNode, 12_000);
    }
    await waitForToolBridgeReady(frameNode, 12_000).catch(() => null);
    sendToolWorkspaceTheme(frameNode.contentWindow);
    refreshActiveArtToolImagePoolBridge();
    if (!options || options.defaultImage !== false) {
      await primeArtToolDefaultInputImage(frameNode, entry);
    }
    return frameNode;
  }
  function getToolBackgroundFrameId(entry) {
    const sourcePath = String(entry && entry.sourcePath ? entry.sourcePath : "").trim();
    const entryId = String(entry && entry.id ? entry.id : "").trim();
    const seed = (entryId || sourcePath || "tool").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    return "urage-tool-background-frame-" + (seed || "tool");
  }
  function getToolBackgroundFrameRoot() {
    let root = document.getElementById(toolBackgroundFrameRootId);
    if (root) {
      return root;
    }
    root = document.createElement("div");
    root.id = toolBackgroundFrameRootId;
    root.setAttribute("aria-hidden", "true");
    root.style.position = "fixed";
    root.style.left = "-10000px";
    root.style.top = "0";
    root.style.width = "1px";
    root.style.height = "1px";
    root.style.overflow = "hidden";
    root.style.pointerEvents = "none";
    root.style.opacity = "0";
    document.body.appendChild(root);
    return root;
  }
  function getToolBackgroundFrame(entry) {
    const root = getToolBackgroundFrameRoot();
    const frameId = getToolBackgroundFrameId(entry);
    let frameNode = document.getElementById(frameId);
    if (frameNode) {
      return frameNode;
    }
    frameNode = document.createElement("iframe");
    frameNode.id = frameId;
    frameNode.title = "Background " + (entry && entry.title ? entry.title : "tool");
    frameNode.setAttribute("data-background-tool-frame", "true");
    frameNode.style.width = "1px";
    frameNode.style.height = "1px";
    frameNode.style.border = "0";
    frameNode.style.display = "block";
    root.appendChild(frameNode);
    return frameNode;
  }
  function isToolFrameReadyForSource(frameNode, sourcePath) {
    if (!frameNode || normalizeToolSourcePath(frameNode.getAttribute("src")) !== normalizeToolSourcePath(sourcePath)) {
      return false;
    }
    try {
      return !!(frameNode.contentDocument && frameNode.contentDocument.readyState === "complete" && frameNode.contentWindow);
    } catch {
      return false;
    }
  }
  function isToolBridgeReady(frameNode) {
    try {
      const targetWindow = frameNode && frameNode.contentWindow ? frameNode.contentWindow : null;
      return !!targetWindow && (
        typeof targetWindow.__urageToolLoadAssetPayload === "function"
        || typeof targetWindow.__urageToolRequestExportImage === "function"
        || typeof targetWindow.__urageToolDescribeCurrentAssets === "function"
        || typeof targetWindow.__urageToolDescribeCurrentAsset === "function"
      );
    } catch {
      return false;
    }
  }
  function waitForToolBridgeReady(frameNode, timeoutMs) {
    if (isToolBridgeReady(frameNode)) {
      return Promise.resolve(frameNode);
    }
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const limit = Math.max(500, Number(timeoutMs) || 5000);
      const check = () => {
        if (isToolBridgeReady(frameNode)) {
          resolve(frameNode);
          return;
        }
        if (Date.now() - startedAt >= limit) {
          reject(new Error("Tool bridge did not become ready in time."));
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
  }
  function waitForToolWindowFunction(frameNode, functionName, timeoutMs) {
    const safeFunctionName = String(functionName || "").trim();
    if (!safeFunctionName) {
      return Promise.reject(new Error("Tool function name is required."));
    }
    const hasFunction = () => {
      try {
        const targetWindow = frameNode && frameNode.contentWindow ? frameNode.contentWindow : null;
        return !!targetWindow && typeof targetWindow[safeFunctionName] === "function";
      } catch {
        return false;
      }
    };
    if (hasFunction()) {
      return Promise.resolve(frameNode);
    }
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const limit = Math.max(500, Number(timeoutMs) || 5000);
      const check = () => {
        if (hasFunction()) {
          resolve(frameNode);
          return;
        }
        if (Date.now() - startedAt >= limit) {
          reject(new Error("Tool function " + safeFunctionName + " did not become ready in time."));
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
  }
  async function ensureToolBackgroundFrameForEntry(entry) {
    const sourcePath = String(entry && entry.sourcePath ? entry.sourcePath : "").trim();
    if (!sourcePath) {
      throw new Error("Selected tool has no source path.");
    }
    const frameNode = getToolBackgroundFrame(entry);
    if (isToolFrameReadyForSource(frameNode, sourcePath) && isToolBridgeReady(frameNode)) {
      return frameNode;
    }
    const loadPromise = waitForToolFrameLoad(frameNode, 15_000);
    frameNode.setAttribute("src", sourcePath);
    await loadPromise;
    await waitForToolBridgeReady(frameNode, 15_000);
    return frameNode;
  }
  async function probeToolAssetPayload(payload) {
    const normalizedPayload = payload && typeof payload === "object" ? payload : {};
    const kind = normalizedPayload.kind === "audio" || normalizedPayload.kind === "video" ? normalizedPayload.kind : normalizedPayload.kind === "image" ? "image" : "";
    if (!kind) {
      return null;
    }
    const fileName = String(
      kind === "audio"
        ? normalizedPayload.audioFileName || normalizedPayload.fileName
        : kind === "video"
          ? normalizedPayload.videoFileName || normalizedPayload.fileName
          : normalizedPayload.imageFileName || normalizedPayload.fileName
    ).trim();
    if (!fileName) {
      return null;
    }
    const body = {
      assetKind: kind,
      imageId: kind === "image" ? String(normalizedPayload.imageId || "").trim() || undefined : undefined,
      audioId: kind === "audio" ? String(normalizedPayload.audioId || "").trim() || undefined : undefined,
      videoId: kind === "video" ? String(normalizedPayload.videoId || "").trim() || undefined : undefined,
      fileName
    };
    if (!body.imageId && !body.audioId && !body.videoId) {
      return null;
    }
    const response = await fetch("/api/media-probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const parsed = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof parsed?.error === "string" ? parsed.error : "Failed to probe media asset.");
    }
    return parsed;
  }
  async function sendAssetToToolWorkspace(entry, payload, options) {
    const sourcePath = String(entry && entry.sourcePath ? entry.sourcePath : "").trim();
    const usePixelArtLoader = isPixelArtToolSourcePath(sourcePath);
    const frameNode = usePixelArtLoader
      ? await ensurePixelArtToolFrame({ switchView: !options || options.switchView !== false })
      : await ensureToolWorkspaceFrameForEntry(entry, {
        switchView: !options || options.switchView !== false,
        defaultImage: false
      });
    try {
      if (isInteractiveBookToolSourcePath(sourcePath)) {
        await waitForToolWindowFunction(frameNode, "__urageToolLoadAssetPayload", 12_000);
      }
      const targetWindow = frameNode.contentWindow;
      if (!targetWindow) {
        throw new Error("Tool workspace did not expose a content window.");
      }
      const requestId = "tool-asset-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      const normalizedPayload = payload && typeof payload === "object" ? { ...payload } : {};
      const mediaProbe = await probeToolAssetPayload(normalizedPayload).catch(error => {
        console.warn("Tool asset media probe failed.", error);
        return null;
      });
      if (mediaProbe) {
        normalizedPayload.mediaProbe = mediaProbe;
        if (normalizedPayload.kind === "image" && mediaProbe.image) {
          if (!(normalizedPayload.width > 0)) normalizedPayload.width = mediaProbe.image.width;
          if (!(normalizedPayload.height > 0)) normalizedPayload.height = mediaProbe.image.height;
        }
        if (mediaProbe.file && mediaProbe.file.exists === false) {
          throw new Error("Selected asset file does not exist anymore.");
        }
      }
      if (isPixelArtToolSourcePath(sourcePath)) {
        const imageUrl = String(normalizedPayload.imageUrl || normalizedPayload.previewImageUrl || "").trim();
        const dataUrl = String(normalizedPayload.dataUrl || (imageUrl ? await fetchImageAsDataUrl(imageUrl) : "")).trim();
        if (imageUrl || dataUrl) {
          await waitForPixelArtToolReady(frameNode, 15000);
          sendToolWorkspaceTheme(targetWindow);
          await sendPixelArtLoadImage(frameNode, {
            source: "urage-dashboard",
            type: "pixel-art:load-image",
            requestId,
            payload: {
              url: imageUrl,
              dataUrl,
              fileName: String(normalizedPayload.fileName || normalizedPayload.imageFileName || normalizedPayload.previewFileName || "tool-source.png").trim() || "tool-source.png",
              autoConvert: false,
              focusReveal: normalizedPayload.focusReveal === true
            }
          }, 15000);
          setOutput("Sent " + (normalizedPayload.kind === "model3d" ? "model preview image" : "image") + " to " + entry.title + ".");
          return;
        }
      }
      if (normalizeToolSourcePath(sourcePath).includes("/tools/art/image-split-and-combine/")) {
        sendToolWorkspaceTheme(targetWindow);
        if (typeof targetWindow.__imageSplitAndCombineLoadAssetPayload === "function") {
          await targetWindow.__imageSplitAndCombineLoadAssetPayload(normalizedPayload);
          setOutput("Loaded " + (normalizedPayload.kind === "model3d" ? "model preview image" : "image") + " into " + entry.title + ".");
          return;
        }
      }
      if (isImageToolTargetSourcePath(sourcePath) && !isThreeModelViewerToolSourcePath(sourcePath)) {
        sendToolWorkspaceTheme(targetWindow);
        if (isArtToolSourcePath(sourcePath) && !isGifViewerToolSourcePath(sourcePath)) {
          sendGenericToolImagePools(targetWindow);
          mountArtToolImagePoolBridge(frameNode, entry);
        }
        if (typeof targetWindow.__urageToolLoadAssetPayload === "function") {
          await targetWindow.__urageToolLoadAssetPayload(normalizedPayload);
          setOutput("Loaded " + (normalizedPayload.kind === "model3d" ? "model preview image" : "image") + " into " + entry.title + ".");
          return;
        }
        if (typeof targetWindow.__imageTransparencyToolLoadAssetPayload === "function") {
          await targetWindow.__imageTransparencyToolLoadAssetPayload(normalizedPayload);
          setOutput("Loaded " + (normalizedPayload.kind === "model3d" ? "model preview image" : "image") + " into " + entry.title + ".");
          return;
        }
        const fallbackImageSource = String(normalizedPayload.imageUrl || normalizedPayload.previewImageUrl || normalizedPayload.dataUrl || "").trim();
        if (fallbackImageSource && !isGifViewerToolSourcePath(sourcePath)) {
          try {
            await injectImageIntoArtToolInput(
              frameNode.contentDocument,
              fallbackImageSource,
              String(normalizedPayload.imageFileName || normalizedPayload.fileName || normalizedPayload.previewFileName || "tool-source.png").trim() || "tool-source.png"
            );
            setOutput("Loaded " + (normalizedPayload.kind === "model3d" ? "model preview image" : "image") + " into " + entry.title + ".");
            return;
          } catch {}
        }
      }
      sendToolWorkspaceTheme(targetWindow);
      targetWindow.postMessage({
        source: "urage-dashboard",
        type: "tool:load-asset",
        requestId,
        payload: normalizedPayload
      }, "*");
      const noun = normalizedPayload.kind === "model3d" ? "3D model" : normalizedPayload.kind === "video" ? "video" : "image";
      setOutput("Sent " + noun + " payload to " + entry.title + ".");
    } finally {
      frameNode.removeAttribute("data-suppress-default-art-image");
    }
  }
  async function openDashboardToolWithAssetPayload(sourceToken, payload, options) {
    const entry = findToolEntryBySourceToken(sourceToken);
    if (!entry) {
      throw new Error("Requested tool is unavailable.");
    }
    await sendAssetToToolWorkspace(entry, payload, options || { switchView: true });
    return entry;
  }
  if (typeof window !== "undefined") {
    window.openDashboardToolWithAssetPayload = openDashboardToolWithAssetPayload;
  }
  async function sendPixelArtLoadImage(frameNode, message, timeoutMs) {
    const targetWindow = frameNode && frameNode.contentWindow ? frameNode.contentWindow : null;
    if (!targetWindow) {
      throw new Error("Pixel Art tool frame is unavailable.");
    }
    const payload = message && message.payload ? message.payload : {};
    const requestId = String(message && message.requestId ? message.requestId : "").trim();
    try {
      if (typeof targetWindow.__pixelArtLoadImagePayload === "function") {
        return await targetWindow.__pixelArtLoadImagePayload(payload, requestId);
      }
    } catch (error) {
      throw new Error(error && error.message ? error.message : "Pixel Art tool failed to load the image.");
    }
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Pixel Art tool did not confirm the image load."));
      }, Math.max(1500, Number(timeoutMs) || 8000));
      const onMessage = event => {
        const reply = event && event.data ? event.data : null;
        if (event.source !== targetWindow || !reply || reply.source !== "pixel-art-converter") {
          return;
        }
        if (String(reply.requestId || "").trim() !== requestId) {
          return;
        }
        if (reply.type !== "pixel-art:loaded" && reply.type !== "pixel-art:error") {
          return;
        }
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        if (reply.type === "pixel-art:error") {
          reject(new Error(String(reply.payload && reply.payload.error ? reply.payload.error : "Pixel Art tool failed to load the image.")));
          return;
        }
        resolve(reply.payload || { loaded: true });
      };
      window.addEventListener("message", onMessage);
      targetWindow.postMessage(message, "*");
    });
  }
  function readActiveImageStudioToolTarget() {
    const panel = document.getElementById("image-studio-preview-panel");
    const imageUrl = String(panel?.dataset.toolImageUrl || "").trim();
    if (!imageUrl) return null;
    const readNumber = key => {
      const parsed = Number.parseInt(String(panel?.dataset[key] || ""), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    };
    return {
      kind: String(panel?.dataset.toolKind || "image").trim() || "image",
      imageId: String(panel?.dataset.toolImageId || "").trim(),
      imageUrl,
      fileName: String(panel?.dataset.toolFileName || "tool-source.png").trim() || "tool-source.png",
      prompt: String(panel?.dataset.toolPrompt || "").trim(),
      width: readNumber("toolWidth"),
      height: readNumber("toolHeight")
    };
  }
  async function sendSelectedImageToToolById(toolId, options) {
    const entries = getToolsCatalogEntries();
    const entry = entries.find(item => item.id === String(toolId || "").trim()) || null;
    if (!entry) {
      setOutput("Selected tool is unavailable.");
      return;
    }
    if (!isToolEntryCompatibleWithQuickAction(entry, "image")) {
      setOutput(entry.title + " cannot receive Image Studio sources.");
      return;
    }
    const activeTarget = readActiveImageStudioToolTarget();
    const selected = activeTarget ? null : getSelectedGeneratedImage();
    if (!activeTarget && !selected) {
      setOutput("Select a generated image or uploaded edit source first.");
      return;
    }
    const imageUrl = activeTarget
      ? buildAbsoluteDashboardUrl(activeTarget.imageUrl)
      : buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(selected.id, selected.imageFileName));
    const imageFileName = activeTarget ? activeTarget.fileName : selected.imageFileName;
    await sendAssetToToolWorkspace(entry, {
      kind: "image",
      imageId: activeTarget ? activeTarget.imageId : selected.id,
      imageFileName,
      fileName: imageFileName,
      imageUrl,
      focusReveal: options && options.focusReveal === true,
      prompt: activeTarget ? activeTarget.prompt : String(selected.prompt || "").trim(),
      width: activeTarget ? activeTarget.width : selected.width || undefined,
      height: activeTarget ? activeTarget.height : selected.height || undefined
    }, {
      switchView: !options || options.switchView !== false
    });
  }
  async function sendImageUrlToToolBySourceToken(sourceToken, payload, options) {
    const entry = findToolEntryBySourceToken(sourceToken);
    if (!entry) {
      throw new Error("Requested tool is unavailable: " + sourceToken);
    }
    const normalizedPayload = payload && typeof payload === "object" ? payload : {};
    const imageUrl = buildAbsoluteDashboardUrl(String(normalizedPayload.imageUrl || "").trim());
    const dataUrl = String(normalizedPayload.dataUrl || "").trim();
    if (!imageUrl && !dataUrl) {
      throw new Error("No image URL was provided.");
    }
    await sendAssetToToolWorkspace(entry, {
      kind: "image",
      imageId: String(normalizedPayload.imageId || "").trim(),
      imageFileName: String(normalizedPayload.imageFileName || normalizedPayload.fileName || "tool-source.png").trim() || "tool-source.png",
      fileName: String(normalizedPayload.fileName || normalizedPayload.imageFileName || "tool-source.png").trim() || "tool-source.png",
      imageUrl,
      dataUrl,
      prompt: String(normalizedPayload.prompt || "").trim(),
      width: normalizedPayload.width || undefined,
      height: normalizedPayload.height || undefined
    }, {
      switchView: !options || options.switchView !== false
    });
  }
  async function openImageInNormalMapTool(imageRecord, options) {
    const selected = imageRecord && imageRecord.id && imageRecord.imageFileName ? imageRecord : getSelectedGeneratedImage();
    if (!selected) {
      throw new Error("Select a generated image first.");
    }
    await sendImageUrlToToolBySourceToken("/tools/art/normalmap-maker/", {
      imageId: selected.id,
      imageFileName: selected.imageFileName,
      imageUrl: getGeneratedImageFileUrl(selected.id, selected.imageFileName),
      prompt: String(selected.prompt || "").trim(),
      width: selected.width || undefined,
      height: selected.height || undefined
    }, options);
  }
  async function openImageInPixelArtTool(imageRecord, options) {
    const selected = imageRecord && imageRecord.id && imageRecord.imageFileName ? imageRecord : getSelectedGeneratedImage();
    if (!selected) {
      throw new Error("Select a generated image first.");
    }
    const entries = getToolsCatalogEntries();
    const pixelEntry = entries.find(entry => isPixelArtToolSourcePath(entry.sourcePath)) || null;
    if (!pixelEntry) {
      throw new Error("Pixel Art Converter tool is unavailable.");
    }
    const imageUrl = buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(selected.id, selected.imageFileName));
    await sendAssetToToolWorkspace(pixelEntry, {
      kind: "image",
      imageId: selected.id,
      imageFileName: selected.imageFileName,
      imageUrl,
      focusReveal: options && options.focusReveal === true,
      prompt: String(selected.prompt || "").trim(),
      width: selected.width || undefined,
      height: selected.height || undefined
    }, {
      switchView: true
    });
  }
  async function sendSelectedModelToToolById(toolId, options) {
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      setOutput("Select a generated 3D model first.");
      return;
    }
    const entries = getToolsCatalogEntries();
    const entry = entries.find(item => item.id === String(toolId || "").trim()) || null;
    if (!entry) {
      setOutput("Selected tool is unavailable.");
      return;
    }
    if (!isToolEntryCompatibleWithQuickAction(entry, "model3d")) {
      setOutput(entry.title + " cannot receive 3D model assets.");
      return;
    }
    let viewerTarget = getModel3dViewerTarget(selected);
    const preview = resolveModel3dPreviewMedia(selected);
    if (isThreeModelViewerToolSourcePath(entry.sourcePath)) {
      const candidateFileName = String(viewerTarget && viewerTarget.fileName ? viewerTarget.fileName : "").trim();
      if (!isThreeModelViewerCompatibleModelFile(candidateFileName)) {
        const currentFileName = String(selected.modelFileName || "").trim();
        if (isThreeModelViewerCompatibleModelFile(currentFileName)) {
          viewerTarget = {
            fileName: currentFileName,
            key: String(selected.id || "") + "|" + currentFileName,
            variantLabel: "merged",
            variantSuffix: " (viewer compatible merged)"
          };
          setOutput("3D Model Viewer supports GLB, GLTF, and OBJ. Sent merged model variant.");
        }
      }
    }
    const modelFileName = String(viewerTarget && viewerTarget.fileName ? viewerTarget.fileName : "").trim();
    if (!modelFileName) {
      setOutput("Selected model has no file to send.");
      return;
    }
    if (isThreeModelViewerToolSourcePath(entry.sourcePath) && !isThreeModelViewerCompatibleModelFile(modelFileName)) {
      setOutput("3D Model Viewer currently supports GLB, GLTF, or OBJ model files.");
      return;
    }
    await sendAssetToToolWorkspace(entry, {
      kind: "model3d",
      modelId: selected.id,
      modelFileName,
      modelUrl: buildAbsoluteDashboardUrl(getModel3dFileUrl(selected.id, modelFileName)),
      previewFileName: preview && preview.fileName ? preview.fileName : "",
      previewImageUrl: preview && preview.fileName ? buildAbsoluteDashboardUrl(getModel3dFileUrl(selected.id, preview.fileName)) : "",
      prompt: String(selected.prompt || "").trim(),
      variant: state.model3dThreeVariant === "original"
        ? "original"
        : (state.model3dThreeVariant === "current" ? "current" : "lowpoly")
    }, {
      switchView: !options || options.switchView !== false
    });
  }
  async function sendSelectedVideoToToolById(toolId, options) {
    const selected = getSelectedGeneratedVideo();
    if (!selected) {
      setOutput("Select a generated video first.");
      return;
    }
    const entries = getToolsCatalogEntries();
    const entry = entries.find(item => item.id === String(toolId || "").trim()) || null;
    if (!entry) {
      setOutput("Selected tool is unavailable.");
      return;
    }
    if (!isToolEntryCompatibleWithQuickAction(entry, "video")) {
      setOutput(entry.title + " cannot receive video assets.");
      return;
    }
    const videoUrl = buildAbsoluteDashboardUrl(getGeneratedVideoFileUrl(selected.id, selected.videoFileName));
    await sendAssetToToolWorkspace(entry, {
      kind: "video",
      videoId: selected.id,
      videoFileName: selected.videoFileName,
      fileName: selected.videoFileName,
      videoUrl,
      mediaUrl: videoUrl,
      prompt: String(selected.prompt || "").trim(),
      width: selected.width || undefined,
      height: selected.height || undefined,
      fps: selected.fps || undefined,
      seconds: selected.seconds || undefined
    }, {
      switchView: !options || options.switchView !== false
    });
  }
  async function runMediaConverterAutomation(frameNode, payload, timeoutMs) {
    const targetWindow = frameNode && frameNode.contentWindow ? frameNode.contentWindow : null;
    if (!targetWindow) {
      throw new Error("Media Converter frame is unavailable.");
    }
    if (typeof targetWindow.__URAGE_MEDIA_CONVERTER_AUTOMATION_RECEIVE__ === "function") {
      return await targetWindow.__URAGE_MEDIA_CONVERTER_AUTOMATION_RECEIVE__(payload);
    }
    await new Promise(resolve => window.setTimeout(resolve, 50));
    if (typeof targetWindow.__URAGE_MEDIA_CONVERTER_AUTOMATION_RECEIVE__ === "function") {
      return await targetWindow.__URAGE_MEDIA_CONVERTER_AUTOMATION_RECEIVE__(payload);
    }
    const requestId = "media-convert-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    return await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Media Converter did not confirm the conversion."));
      }, Math.max(3000, Number(timeoutMs) || 120000));
      const onMessage = event => {
        const reply = event && event.data ? event.data : null;
        if (event.source !== targetWindow || !reply || reply.source !== "media-converter") {
          return;
        }
        if (String(reply.requestId || "").trim() !== requestId) {
          return;
        }
        if (reply.type !== "media-converter:converted" && reply.type !== "media-converter:error") {
          return;
        }
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        if (reply.type === "media-converter:error") {
          reject(new Error(String(reply.payload && reply.payload.error ? reply.payload.error : "Media conversion failed.")));
          return;
        }
        resolve(reply.payload || {});
      };
      window.addEventListener("message", onMessage);
      targetWindow.postMessage({
        source: "urage-dashboard",
        type: "media-converter:convert",
        requestId,
        payload
      }, "*");
    });
  }
  async function convertSelectedVideoToGifWithMediaConverter() {
    const selected = getSelectedGeneratedVideo();
    if (!selected) {
      setOutput("Select a generated video first.");
      return;
    }
    const entry = findToolEntryBySourceToken("/tools/video/media-converter/");
    if (!entry) {
      setOutput("Media Converter tool is unavailable.");
      return;
    }
    const button = document.getElementById("video-convert-gif-button");
    try {
      if (button) button.disabled = true;
      setOutput("Creating GIF with Media Converter...");
      const frameNode = await ensureToolBackgroundFrameForEntry(entry);
      sendToolWorkspaceTheme(frameNode.contentWindow);
      const result = await runMediaConverterAutomation(frameNode, {
        mode: "video-to-gif",
        sourceUrl: buildAbsoluteDashboardUrl(getGeneratedVideoFileUrl(selected.id, selected.videoFileName)),
        sourceFileName: selected.videoFileName,
        fps: 12,
        width: 512
      }, 180000);
      const resultUrl = String(result && result.resultUrl ? result.resultUrl : "").trim();
      const absoluteUrl = resultUrl ? buildAbsoluteDashboardUrl(resultUrl) : "";
      setOutput(absoluteUrl
        ? "Created GIF with Media Converter:\n" + absoluteUrl
        : "Created GIF with Media Converter.");
      window.dispatchEvent(new CustomEvent("dashboard:media-converter-gifs-updated"));
    } catch (error) {
      setOutput(error && error.message ? error.message : "Failed to create GIF with Media Converter.");
    } finally {
      if (button) button.disabled = false;
    }
  }
  function getToolQuickActionSelection(kind) {
    const normalizedKind = normalizeToolQuickActionKind(kind);
    const selected = getSelectedToolQuickActionEntry(normalizedKind);
    if (!selected) {
      setOutput("No local tool is selected for " + (normalizedKind === "model3d" ? "3D model" : normalizedKind) + " quick action.");
      return null;
    }
    return selected;
  }
  async function sendSelectedImageToSelectedTool() {
    const selected = getToolQuickActionSelection("image");
    if (!selected) {
      return;
    }
    await sendSelectedImageToToolById(selected.id);
  }
  async function sendSelectedModelToSelectedTool() {
    const selected = getToolQuickActionSelection("model3d");
    if (!selected) {
      return;
    }
    await sendSelectedModelToToolById(selected.id);
  }
  async function sendSelectedVideoToSelectedTool() {
    const selected = getToolQuickActionSelection("video");
    if (!selected) {
      return;
    }
    await sendSelectedVideoToToolById(selected.id);
  }
  function updateModel3dToolQuickActionState() {
    const selectedModel = getSelectedGeneratedModel();
    const hasModel = Boolean(selectedModel && selectedModel.id);
    const sendButton = document.getElementById("model3d-send-to-tool-button");
    const pickerToggle = document.getElementById("model3d-tool-picker-toggle");
    if (sendButton) {
      sendButton.disabled = !hasModel;
      sendButton.title = hasModel ? "Send selected model or preview to the chosen local tool." : "Select a generated 3D model first.";
    }
    if (pickerToggle) {
      pickerToggle.disabled = !hasModel;
      pickerToggle.title = hasModel ? "Select which local tool should receive the 3D model." : "Select a generated 3D model first.";
    }
  }
  function updateVideoToolQuickActionState() {
    const selectedVideo = getSelectedGeneratedVideo();
    const hasVideo = Boolean(selectedVideo && selectedVideo.id);
    const sendButton = document.getElementById("video-send-to-tool-button");
    const pickerToggle = document.getElementById("video-tool-picker-toggle");
    const gifButton = document.getElementById("video-convert-gif-button");
    if (sendButton) {
      sendButton.disabled = !hasVideo;
      sendButton.title = hasVideo ? "Send selected video to the chosen local tool." : "Select a generated video first.";
    }
    if (pickerToggle) {
      pickerToggle.disabled = !hasVideo;
      pickerToggle.title = hasVideo ? "Select which local tool should receive the video." : "Select a generated video first.";
    }
    if (gifButton) {
      gifButton.disabled = !hasVideo;
      gifButton.title = hasVideo ? "Create a GIF from the selected video through Media Converter." : "Select a generated video first.";
    }
  }
  let aiToolQuickActionGlobalEventsBound = false;
  let toolWorkspaceThemeEventsBound = false;
  function bindToolWorkspaceThemeEvents() {
    if (toolWorkspaceThemeEventsBound) {
      return;
    }
    toolWorkspaceThemeEventsBound = true;
    window.addEventListener("dashboard:theme-changed", () => {
      refreshActiveArtToolImagePoolBridge();
    });
  }
  function bindAiToolQuickActionEvents() {
    const bindButtonOnce = (button, bindingKey, handler) => {
      if (!button || button.dataset[bindingKey] === "true") return;
      button.dataset[bindingKey] = "true";
      button.addEventListener("click", handler);
    };
    const imageSendButton = document.getElementById("image-send-to-tool-button");
    bindButtonOnce(imageSendButton, "toolQuickActionBound", async event => {
        event.preventDefault();
        await sendSelectedImageToSelectedTool();
    });
    const modelSendButton = document.getElementById("model3d-send-to-tool-button");
    bindButtonOnce(modelSendButton, "toolQuickActionBound", async event => {
        event.preventDefault();
        await sendSelectedModelToSelectedTool();
    });
    const videoSendButton = document.getElementById("video-send-to-tool-button");
    bindButtonOnce(videoSendButton, "toolQuickActionBound", async event => {
        event.preventDefault();
        await sendSelectedVideoToSelectedTool();
    });
    const videoGifButton = document.getElementById("video-convert-gif-button");
    bindButtonOnce(videoGifButton, "toolQuickActionBound", async event => {
        event.preventDefault();
        await convertSelectedVideoToGifWithMediaConverter();
    });
    const imagePickerToggle = document.getElementById("image-tool-picker-toggle");
    bindButtonOnce(imagePickerToggle, "toolQuickActionBound", event => {
        event.preventDefault();
        event.stopPropagation();
        const imageMenu = document.getElementById("image-tool-picker-menu");
        const isOpen = imageMenu && !imageMenu.classList.contains("hidden");
        setToolPickerOpen("image", !isOpen);
    });
    const modelPickerToggle = document.getElementById("model3d-tool-picker-toggle");
    bindButtonOnce(modelPickerToggle, "toolQuickActionBound", event => {
        event.preventDefault();
        event.stopPropagation();
        const modelMenu = document.getElementById("model3d-tool-picker-menu");
        const isOpen = modelMenu && !modelMenu.classList.contains("hidden");
        setToolPickerOpen("model3d", !isOpen);
    });
    const videoPickerToggle = document.getElementById("video-tool-picker-toggle");
    bindButtonOnce(videoPickerToggle, "toolQuickActionBound", event => {
        event.preventDefault();
        event.stopPropagation();
        const videoMenu = document.getElementById("video-tool-picker-menu");
        const isOpen = videoMenu && !videoMenu.classList.contains("hidden");
        setToolPickerOpen("video", !isOpen);
    });
    if (aiToolQuickActionGlobalEventsBound) {
      return;
    }
    aiToolQuickActionGlobalEventsBound = true;
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        closeAllToolPickers();
        return;
      }
      const insidePicker = target.closest(".studio-tool-picker");
      const insidePickerMenu = target.closest(".studio-tool-picker-menu");
      if (!insidePicker && !insidePickerMenu) {
        closeAllToolPickers();
      }
    });
    window.addEventListener("resize", closeAllToolPickers);
    window.addEventListener("scroll", event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && (target.closest(".studio-tool-picker-menu") || target.closest(".studio-tool-picker"))) {
        return;
      }
      closeAllToolPickers();
    }, true);
  }
  function bindToolsViewEvents() {
    bindToolWorkspaceThemeEvents();
    const toolButtons = getToolsCatalogButtons();
    const layoutNode = document.querySelector(".tools-workspace-card");
    const frameNode = document.getElementById("tools-workspace-frame");
    const homeNode = document.getElementById("tools-workspace-home");
    const homeGridNode = document.getElementById("tools-workspace-home-grid");
    const homeButton = document.getElementById("tools-catalog-home-button");
    const sidebarToggleButton = document.getElementById("tools-catalog-collapse-button");
    const sidebarResizeHandle = document.getElementById("tools-sidebar-resize-handle");
    const sidebarToolListNode = document.getElementById("tools-sidebar-tool-list");
    const emptyNode = document.getElementById("tools-workspace-empty");
    const statusNode = document.getElementById("tools-workspace-status");
    const titleNode = document.getElementById("tools-active-title");
    const categoryNode = document.getElementById("tools-active-category");
    const descriptionNode = document.getElementById("tools-active-description");
    const openLinkNode = document.getElementById("tools-workspace-open-link");
    const setStatus = text => {
      if (statusNode) {
        statusNode.textContent = text;
      }
    };
    const applyToolsCatalogSidebarState = () => {
      const collapsed = toolsWorkspaceState.sidebarCollapsed === true;
      if (layoutNode) {
        layoutNode.classList.toggle("is-catalog-collapsed", collapsed);
      }
      if (sidebarToggleButton) {
        sidebarToggleButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
        sidebarToggleButton.setAttribute("aria-pressed", collapsed ? "true" : "false");
        sidebarToggleButton.setAttribute("title", collapsed ? "Expand tools sidebar" : "Collapse tools sidebar");
        const label = sidebarToggleButton.querySelector("[data-tools-catalog-toggle-label]");
        if (label) {
          label.textContent = collapsed ? "Show Sidebar" : "Hide Sidebar";
        }
      }
    };
    const clearExternalToolSidebar = () => {};
    const hydrateExternalToolSidebar = () => {};
    const setToolsCatalogHiddenForActiveTool = hidden => {
      if (layoutNode) layoutNode.classList.toggle("is-tool-active-sidebar-hidden", hidden === true);
    };
    const sidebarResizeController = createToolsSidebarResizeController({
      layoutNode,
      readStoredToolId,
      resizeHandle: sidebarResizeHandle,
      setStatus,
      state: toolsWorkspaceState,
      storageKeys: toolsWorkspaceStorageKeys,
      writeStoredToolId
    });
    const setToolsCatalogSidebarCollapsed = collapsed => {
      toolsWorkspaceState.sidebarCollapsed = collapsed === true;
      writeStoredToolId(toolsWorkspaceStorageKeys.sidebarCollapsed, toolsWorkspaceState.sidebarCollapsed ? "1" : "");
      applyToolsCatalogSidebarState();
    };
    toolsWorkspaceState.sidebarCollapsed = readStoredToolId(toolsWorkspaceStorageKeys.sidebarCollapsed) === "1";
    sidebarResizeController.initialize();
    applyToolsCatalogSidebarState();
    const searchInput = document.getElementById("tools-search-input");
    const filterButtons = Array.from(document.querySelectorAll("[data-tools-filter]"));
    const tagFilterButtons = Array.from(document.querySelectorAll("[data-tools-tag-filter]"));
    const renderToolsToolbarState = () => {
      const activeFilter = toolsWorkspaceState.activeFilter || "all";
      filterButtons.forEach(button => {
        button.classList.toggle("active", String(button.getAttribute("data-tools-filter") || "") === activeFilter);
      });
      tagFilterButtons.forEach(button => {
        button.classList.toggle("active", String(button.getAttribute("data-tools-tag-filter") || "") === String(toolsWorkspaceState.activeTag || ""));
      });
      if (searchInput && searchInput.value !== toolsWorkspaceState.searchQuery) {
        searchInput.value = toolsWorkspaceState.searchQuery;
      }
    };
    const toolScaffoldController = typeof createDashboardToolScaffoldController === "function"
      ? createDashboardToolScaffoldController({request, setOutput})
      : null;
    toolScaffoldController?.bind();
    const toolCatalogMetadataController = typeof createToolCatalogMetadataController === "function"
      ? createToolCatalogMetadataController({request})
      : null;
    toolCatalogMetadataController?.bind();
    const toolEditorController = typeof createDashboardToolEditorController === "function"
      ? createDashboardToolEditorController({request, setOutput})
      : null;
    toolEditorController?.bind();
    const setToolsWorkspaceToolActive = active => {
      if (!layoutNode) {
        return;
      }
      layoutNode.classList.toggle("is-tool-active", active === true);
    };
    const getToolsWorkspaceFilterLabel = filter => {
      const normalizedFilter = String(filter || "all").trim() || "all";
      if (normalizedFilter === "all") return "Tools Dashboard";
      if (normalizedFilter === "favorites") return "Favorite Tools";
      if (normalizedFilter === "recent") return "Recent Tools";
      const matchingButton = filterButtons.find(button => String(button.getAttribute("data-tools-filter") || "") === normalizedFilter);
      const label = matchingButton ? String(matchingButton.textContent || "").trim().replace(/\s+\d+\s*$/, "") : "";
      return label || "Filtered Tools";
    };
    const setToolsWorkspaceFilter = filter => {
      toolsWorkspaceState.activeFilter = String(filter || "all").trim() || "all";
      const filterLabel = getToolsWorkspaceFilterLabel(toolsWorkspaceState.activeFilter);
      toolButtons.forEach(node => {
        node.classList.remove("active");
      });
      if (homeNode) {
        homeNode.classList.remove("hidden");
      }
      if (frameNode) {
        frameNode.classList.add("hidden");
        removeArtToolImagePoolBridge(frameNode);
        removeToolWorkspaceRecentBridge(frameNode);
        removeToolWorkspaceSendBridge(frameNode);
      }
      setToolsWorkspaceToolActive(false);
      setToolsCatalogHiddenForActiveTool(false);
      syncToolWorkspaceFooterState(null);
      if (emptyNode) {
        emptyNode.classList.add("hidden");
      }
      if (openLinkNode) {
        openLinkNode.classList.add("hidden");
        openLinkNode.setAttribute("href", "#");
      }
      clearExternalToolSidebar();
      if (titleNode) {
        titleNode.textContent = toolsWorkspaceState.activeFilter === "all" ? "Toolbox Dashboard" : filterLabel;
      }
      if (categoryNode) {
        categoryNode.textContent = filterLabel;
      }
      if (descriptionNode) {
        descriptionNode.textContent = toolsWorkspaceState.activeFilter === "all"
          ? "Search, pin, and open local tools in the workspace."
          : "Browsing tools in the " + filterLabel + " category.";
      }
      renderToolsToolbarState();
      renderToolsSidebarList();
      renderWorkspaceHomeCards();
      setStatus("Tools dashboard ready.");
    };
    const getFilteredToolEntries = entries => {
      const activeFilter = toolsWorkspaceState.activeFilter || "all";
      const query = String(toolsWorkspaceState.searchQuery || "").trim().toLowerCase();
      const activeTag = String(toolsWorkspaceState.activeTag || "").trim().toLocaleLowerCase();
      return entries.filter(entry => {
        const matchesFilter = activeFilter === "all"
          || (activeFilter === "favorites" && toolsWorkspaceState.favoriteToolIds.includes(entry.id))
          || (activeFilter === "recent" && toolsWorkspaceState.recentToolIds.includes(entry.id))
          || activeFilter === entry.categoryId;
        if (!matchesFilter) {
          return false;
        }
        if (activeTag && !(Array.isArray(entry.tags) ? entry.tags : []).some(tag => String(tag).toLocaleLowerCase() === activeTag)) {
          return false;
        }
        if (!query) {
          return true;
        }
        return [
          entry.title,
          entry.description,
          entry.categoryLabel,
          ...(Array.isArray(entry.tags) ? entry.tags : []),
          getToolWorkspaceKindLabel(entry)
        ].join(" ").toLowerCase().includes(query);
      });
    };
    const renderMainToolsCatalogFilter = entries => {
      const catalogNode = document.getElementById("tools-main-catalog");
      if (!catalogNode) {
        return;
      }
      const visibleIds = new Set(getFilteredToolEntries(entries).map(entry => entry.id));
      catalogNode.querySelectorAll(".tools-catalog-group").forEach(group => {
        let visibleCount = 0;
        group.querySelectorAll("[data-tools-tool]").forEach(button => {
          const visible = visibleIds.has(String(button.getAttribute("data-tools-tool") || "").trim());
          button.classList.toggle("hidden", !visible);
          if (visible) visibleCount += 1;
        });
        group.classList.toggle("hidden", visibleCount === 0);
      });
    };
    const createToolsSidebarToolButton = entry => {
      const button = document.createElement("button");
      button.className = "tools-catalog-button";
      button.type = "button";
      button.setAttribute("data-tools-sidebar-tool", entry.id);
      const icon = document.createElement("span");
      icon.className = "tools-catalog-button-icon";
      if (entry.thumbnailPath) {
        const image = document.createElement("img");
        image.src = entry.thumbnailPath;
        image.alt = "";
        image.loading = "lazy";
        icon.appendChild(image);
      } else {
        setDashboardClientSvgIcon(icon, "tools");
      }
      const copy = document.createElement("span");
      copy.className = "tools-catalog-button-copy";
      const title = document.createElement("strong");
      title.textContent = entry.title;
      copy.appendChild(title);
      button.appendChild(icon);
      button.appendChild(copy);
      button.addEventListener("click", event => {
        event.preventDefault();
        const registryButton = findToolCatalogButtonById(entry.id);
        if (!registryButton) {
          return;
        }
        setActiveTool(registryButton);
        setOutput("Opened " + entry.title + " in the tools workspace.");
      });
      return button;
    };
    const renderToolsSidebarList = () => {
      if (!sidebarToolListNode) {
        return;
      }
      clearChildren(sidebarToolListNode);
      const entries = getToolsCatalogEntries();
      const filteredEntries = getFilteredToolEntries(entries);
      const activeFilter = toolsWorkspaceState.activeFilter || "all";
      const title = document.createElement("div");
      title.className = "section-label";
      title.textContent = activeFilter === "favorites"
        ? "Favorite Tools"
        : activeFilter === "recent"
          ? "Recent Tools"
          : activeFilter === "all"
            ? "All Tools"
            : (filteredEntries[0]?.categoryLabel || "Tools");
      sidebarToolListNode.appendChild(title);
      if (filteredEntries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tools-catalog-hint";
        empty.textContent = "No tools match this category.";
        sidebarToolListNode.appendChild(empty);
        return;
      }
      const list = document.createElement("div");
      list.className = "tools-catalog-list";
      filteredEntries.slice().sort((a, b) => a.title.localeCompare(b.title)).forEach(entry => {
        list.appendChild(createToolsSidebarToolButton(entry));
      });
      sidebarToolListNode.appendChild(list);
    };
    const createToolHomeCard = (entry, options) => {
      const button = findToolCatalogButtonById(entry.id);
      const card = document.createElement("article");
      card.className = "tools-workspace-home-card" + (options && options.featured ? " is-featured" : "");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Open " + entry.title);
      const icon = document.createElement("div");
      icon.className = "tools-workspace-home-card-icon";
      if (entry.thumbnailPath) {
        const image = document.createElement("img");
        image.src = entry.thumbnailPath;
        image.alt = "";
        image.loading = "lazy";
        icon.appendChild(image);
      } else {
        setDashboardClientSvgIcon(icon, "tools");
      }
      const favoriteButton = document.createElement("button");
      favoriteButton.className = "tools-card-favorite";
      favoriteButton.type = "button";
      favoriteButton.textContent = toolsWorkspaceState.favoriteToolIds.includes(entry.id) ? "*" : "+";
      favoriteButton.title = "Toggle favorite";
      favoriteButton.setAttribute("aria-label", "Toggle favorite for " + entry.title);
      favoriteButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        toggleToolsWorkspaceFavorite(entry.id);
        renderWorkspaceHomeCards();
        renderToolsSidebarList();
      });
      const title = document.createElement("h4");
      title.textContent = entry.title;
      const description = document.createElement("p");
      description.textContent = getToolWorkspaceShortDescription(entry.description);
      const meta = document.createElement("div");
      meta.className = "tools-card-meta";
      const categoryTag = document.createElement("span");
      categoryTag.textContent = getToolWorkspaceKindLabel(entry);
      meta.appendChild(categoryTag);
      const arrow = document.createElement("span");
      arrow.className = "tools-card-open-arrow";
      arrow.textContent = "Open";
      meta.appendChild(arrow);
      const openTool = () => {
        if (!button) {
          return;
        }
        setActiveTool(button);
        setOutput("Opened " + entry.title + " in the tools workspace.");
      };
      card.addEventListener("click", openTool);
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openTool();
        }
      });
      card.appendChild(icon);
      card.appendChild(favoriteButton);
      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(meta);
      return card;
    };
    const appendToolsSection = (title, subtitle, entries, options) => {
      if (!homeGridNode || entries.length === 0) {
        return;
      }
      const section = document.createElement("section");
      section.className = "tools-home-section" + (options && options.featured ? " is-featured" : "");
      const head = document.createElement("div");
      head.className = "tools-home-section-head";
      const copy = document.createElement("div");
      const heading = document.createElement("h4");
      heading.textContent = title;
      const summary = document.createElement("p");
      summary.textContent = subtitle;
      copy.appendChild(heading);
      copy.appendChild(summary);
      head.appendChild(copy);
      section.appendChild(head);
      const grid = document.createElement("div");
      grid.className = "tools-home-card-grid";
      entries.forEach(entry => {
        grid.appendChild(createToolHomeCard(entry, options));
      });
      section.appendChild(grid);
      homeGridNode.appendChild(section);
    };
    const renderWorkspaceHomeCards = () => {
      if (!homeGridNode) {
        return;
      }
      clearChildren(homeGridNode);
      const entries = getToolsCatalogEntries();
      syncToolsWorkspaceCollections(entries);
      renderToolsToolbarState();
      renderMainToolsCatalogFilter(entries);
      if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "hint";
        empty.innerHTML = "No local tools with <code>index.html</code> detected yet.";
        homeGridNode.appendChild(empty);
        return;
      }
      const filteredEntries = getFilteredToolEntries(entries);
      if (filteredEntries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tools-home-empty";
        empty.textContent = "No tools match the current filter.";
        homeGridNode.appendChild(empty);
        return;
      }
      const query = String(toolsWorkspaceState.searchQuery || "").trim();
      const activeFilter = toolsWorkspaceState.activeFilter || "all";
      if (query || activeFilter !== "all") {
        const label = activeFilter === "favorites" ? "Favorites" : activeFilter === "recent" ? "Recent" : "Matching Tools";
        appendToolsSection(label, filteredEntries.length + " tools found", filteredEntries, { featured: false });
        return;
      }
      const preferredFeatured = ["pixel-art-converter", "svg-editor", "3d-model-viewer", "seamless-texture", "audio", "favicon"];
      const featuredEntries = entries
        .slice()
        .sort((a, b) => {
          const aScore = (toolsWorkspaceState.favoriteToolIds.includes(a.id) ? 20 : 0)
            + preferredFeatured.reduce((score, token, index) => score + (normalizeToolSourcePath(a.sourcePath).includes(token) || a.title.toLowerCase().includes(token) ? 12 - index : 0), 0);
          const bScore = (toolsWorkspaceState.favoriteToolIds.includes(b.id) ? 20 : 0)
            + preferredFeatured.reduce((score, token, index) => score + (normalizeToolSourcePath(b.sourcePath).includes(token) || b.title.toLowerCase().includes(token) ? 12 - index : 0), 0);
          return bScore - aScore || a.title.localeCompare(b.title);
        })
        .slice(0, Math.min(5, entries.length));
      appendToolsSection("Featured Tools", "Fast paths for the tools you are most likely to reach for.", featuredEntries, { featured: true });
      const recentEntries = toolsWorkspaceState.recentToolIds.map(id => entries.find(entry => entry.id === id) || null).filter(Boolean).slice(0, 6);
      appendToolsSection("Recent", "Tools opened from this dashboard.", recentEntries, { featured: false });
      const favoriteEntries = toolsWorkspaceState.favoriteToolIds.map(id => entries.find(entry => entry.id === id) || null).filter(Boolean).slice(0, 6);
      appendToolsSection("Favorites", "Pinned tools for one-click access.", favoriteEntries, { featured: false });
      const grouped = new Map();
      entries.forEach(entry => {
        if (!grouped.has(entry.categoryLabel)) {
          grouped.set(entry.categoryLabel, []);
        }
        grouped.get(entry.categoryLabel).push(entry);
      });
      grouped.forEach((groupEntries, groupLabel) => {
        appendToolsSection(groupLabel, groupEntries.length + " available tools", groupEntries.slice().sort((a, b) => a.title.localeCompare(b.title)), { featured: false });
      });
    };
    const setWorkspaceHome = () => {
      toolButtons.forEach(node => {
        node.classList.remove("active");
      });
      if (homeButton) {
        homeButton.classList.add("active");
      }
      if (titleNode) {
        titleNode.textContent = "Toolbox Dashboard";
      }
      if (categoryNode) {
        categoryNode.textContent = "Tools Dashboard";
      }
      if (descriptionNode) {
        descriptionNode.textContent = "Search, pin, and open local tools in the workspace.";
      }
      if (openLinkNode) {
        openLinkNode.classList.add("hidden");
        openLinkNode.setAttribute("href", "#");
      }
      clearExternalToolSidebar();
      if (homeNode) {
        homeNode.classList.remove("hidden");
      }
      if (frameNode) {
        frameNode.classList.add("hidden");
        removeArtToolImagePoolBridge(frameNode);
      }
      setToolsWorkspaceToolActive(false);
      setToolsCatalogHiddenForActiveTool(false);
      if (emptyNode) {
        emptyNode.classList.add("hidden");
      }
      renderWorkspaceHomeCards();
      renderToolsSidebarList();
      setStatus("Tools home ready. Select a tool to open it here.");
    };
    const setActiveTool = (button, options) => {
      if (!button) {
        setWorkspaceHome();
        return;
      }
      const skipFrameLoad = !!(options && options.skipFrameLoad);
      const sourcePath = String(button.getAttribute("data-tools-src") || "").trim();
      const toolId = String(button.getAttribute("data-tools-tool") || "").trim();
      const title = String(button.getAttribute("data-tools-title") || "").trim() || "Tool";
      const categoryLabel = String(button.getAttribute("data-tools-category") || "").trim() || "Tool Workspace";
      const description = String(button.getAttribute("data-tools-description") || "").trim() || "Local tool loaded from tools folder.";
      if (homeButton) {
        homeButton.classList.remove("active");
      }
      rememberRecentTool(toolId);
      toolButtons.forEach(node => {
        node.classList.toggle("active", node === button);
      });
      document.querySelectorAll("[data-tools-sidebar-tool]").forEach(node => {
        node.classList.toggle("active", String(node.getAttribute("data-tools-sidebar-tool") || "") === toolId);
      });
      if (titleNode) {
        titleNode.textContent = title;
      }
      if (categoryNode) {
        categoryNode.textContent = categoryLabel;
      }
      if (descriptionNode) {
        descriptionNode.textContent = description;
      }
      if (openLinkNode) {
        openLinkNode.classList.toggle("hidden", !sourcePath);
        openLinkNode.setAttribute("href", sourcePath || "#");
      }
      if (homeNode) {
        homeNode.classList.add("hidden");
      }
      setToolsWorkspaceToolActive(Boolean(sourcePath));
      setToolsCatalogHiddenForActiveTool(true);
      if (!frameNode) {
        return;
      }
      frameNode.classList.toggle("hidden", !sourcePath);
      if (emptyNode) {
        emptyNode.classList.toggle("hidden", !!sourcePath);
      }
      if (!sourcePath) {
        setStatus("No tool selected.");
        clearExternalToolSidebar();
        removeArtToolImagePoolBridge(frameNode);
        removeToolWorkspaceSendBridge(frameNode);
        syncToolWorkspaceFooterState(null);
        return;
      }
      syncToolWorkspaceFooterState(getToolEntryBySourcePath(sourcePath));
      if (skipFrameLoad) {
        setStatus("Preparing " + title + "...");
        return;
      }
      setStatus("Loading " + title + "...");
      if (frameNode.getAttribute("src") !== sourcePath) {
        frameNode.removeAttribute("data-default-art-image-primed");
        frameNode.setAttribute("src", sourcePath);
      } else {
        setStatus("Loaded " + title + ".");
        sendToolWorkspaceTheme(frameNode.contentWindow);
        hydrateExternalToolSidebar();
        refreshActiveArtToolImagePoolBridge();
        primeArtToolDefaultInputImage(frameNode, getToolEntryBySourcePath(sourcePath)).catch(() => {});
      }
    };
    toolsWorkspaceState.setActiveToolButton = setActiveTool;
    if (frameNode) {
      frameNode.addEventListener("load", () => {
        if (homeButton && homeButton.classList.contains("active")) {
          return;
        }
        const activeButton = toolButtons.find(button => button.classList.contains("active"));
        const activeTitle = activeButton ? String(activeButton.getAttribute("data-tools-title") || "").trim() : "";
        setStatus(activeTitle ? ("Loaded " + activeTitle + ".") : "Tool ready.");
        sendToolWorkspaceTheme(frameNode.contentWindow);
        hydrateExternalToolSidebar();
        refreshActiveArtToolImagePoolBridge();
        const activeSourcePath = activeButton ? String(activeButton.getAttribute("data-tools-src") || "").trim() : "";
        primeArtToolDefaultInputImage(frameNode, getToolEntryBySourcePath(activeSourcePath)).catch(() => {});
      });
      frameNode.addEventListener("error", () => {
        const activeButton = toolButtons.find(button => button.classList.contains("active"));
        const activeTitle = activeButton ? String(activeButton.getAttribute("data-tools-title") || "").trim() : "tool";
        setStatus("Failed to load " + activeTitle + ".");
      });
    }
    document.getElementById("tools-workspace-export-toggle")?.addEventListener("click", async event => {
      event.preventDefault();
      const activeEntry = getActiveToolWorkspaceEntry();
      await openToolsWorkspaceExportForEntry(activeEntry);
    });
    document.getElementById("tools-workspace-pools-toggle")?.addEventListener("click", event => {
      event.preventDefault();
      const activeEntry = getActiveToolWorkspaceEntry();
      if (activeEntry && isFloatingMediaTrayToolSourcePath(activeEntry.sourcePath)) {
        sendFloatingMediaTrayCommand(frameNode, activeEntry.sourcePath, "pools");
        syncToolWorkspaceFooterState(activeEntry);
        setStatus("Opened media tray on Image Pools.");
        return;
      }
      toolWorkspaceBridgeState.poolsVisible = toolWorkspaceBridgeState.poolsVisible === false;
      if (!setToolBridgeVisibility(frameNode, artToolImagePoolBridgeRootId, toolWorkspaceBridgeState.poolsVisible) && toolWorkspaceBridgeState.poolsVisible) {
        refreshActiveArtToolImagePoolBridge();
      }
      syncToolWorkspaceFooterState(activeEntry);
      setStatus((toolWorkspaceBridgeState.poolsVisible ? "Showing" : "Hiding") + " Dashboard Image Pools bridge.");
    });
    document.getElementById("tools-workspace-recent-toggle")?.addEventListener("click", event => {
      event.preventDefault();
      const activeEntry = getActiveToolWorkspaceEntry();
      if (activeEntry && isFloatingMediaTrayToolSourcePath(activeEntry.sourcePath)) {
        sendFloatingMediaTrayCommand(frameNode, activeEntry.sourcePath, "recent");
        syncToolWorkspaceFooterState(activeEntry);
        setStatus("Opened media tray on Recent Generated.");
        return;
      }
      toolWorkspaceBridgeState.recentVisible = toolWorkspaceBridgeState.recentVisible === false;
      if (!setToolBridgeVisibility(frameNode, toolWorkspaceRecentBridgeRootId, toolWorkspaceBridgeState.recentVisible) && toolWorkspaceBridgeState.recentVisible) {
        refreshActiveArtToolImagePoolBridge();
      }
      syncToolWorkspaceFooterState(activeEntry);
      setStatus((toolWorkspaceBridgeState.recentVisible ? "Showing" : "Hiding") + " Recent Media bridge.");
    });
    document.getElementById("tools-workspace-show-readme-button")?.addEventListener("click", event => {
      event.preventDefault();
      const activeEntry = getActiveToolWorkspaceEntry();
      if (!activeEntry || !activeEntry.readmePath) {
        setStatus("No README available for this tool.");
        setOutput("No README.md is available for the active tool.");
        return;
      }
      showToolReadmeOverlay(activeEntry);
      setStatus("Showing README for " + activeEntry.title + ".");
    });
    document.getElementById("tools-workspace-export-overlay-backdrop")?.addEventListener("click", closeToolsWorkspaceExportOverlay);
    document.getElementById("tools-workspace-export-close-button")?.addEventListener("click", closeToolsWorkspaceExportOverlay);
    document.getElementById("tools-workspace-export-cancel-button")?.addEventListener("click", closeToolsWorkspaceExportOverlay);
    document.querySelectorAll("[data-tools-export-tab]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        setToolsWorkspaceExportTab(String(event.currentTarget?.getAttribute("data-tools-export-tab") || "tool").trim());
      });
    });
    document.getElementById("tools-workspace-export-engine-target")?.addEventListener("change", () => {
      updateToolsWorkspaceExportUi();
    });
    document.getElementById("tools-workspace-export-resource-select")?.addEventListener("change", event => {
      const nextId = String(event.currentTarget?.value || "").trim();
      setSelectedToolWorkspaceExportResource(nextId);
      updateToolsWorkspaceExportUi();
    });
    document.getElementById("tools-workspace-export-submit-button")?.addEventListener("click", async event => {
      event.preventDefault();
      await submitToolsWorkspaceExport();
    });
    if (homeButton) {
      homeButton.addEventListener("click", event => {
        event.preventDefault();
        toolsWorkspaceState.activeFilter = "all";
        toolsWorkspaceState.activeTag = "";
        toolsWorkspaceState.searchQuery = "";
        setWorkspaceHome();
      });
    }
    window.addEventListener("dashboard:tools-home-requested", () => {
      toolsWorkspaceState.activeFilter = "all";
      toolsWorkspaceState.activeTag = "";
      toolsWorkspaceState.searchQuery = "";
      setWorkspaceHome();
    });
    filterButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const filter = event.currentTarget ? event.currentTarget.getAttribute("data-tools-filter") : "all";
        setToolsWorkspaceFilter(filter || "all");
      });
    });
    if (searchInput) {
      searchInput.addEventListener("input", event => {
        toolsWorkspaceState.searchQuery = event.currentTarget && typeof event.currentTarget.value === "string"
          ? event.currentTarget.value
          : "";
        setToolsWorkspaceFilter(toolsWorkspaceState.activeFilter);
      });
    }
    if (sidebarToggleButton) {
      sidebarToggleButton.addEventListener("click", event => {
        event.preventDefault();
        setToolsCatalogHiddenForActiveTool(false);
        setToolsCatalogSidebarCollapsed(toolsWorkspaceState.sidebarCollapsed !== true);
        setStatus((toolsWorkspaceState.sidebarCollapsed ? "Collapsed" : "Expanded") + " tools sidebar.");
      });
    }
    sidebarResizeController.bind();
    toolButtons.forEach(button => {
      button.addEventListener("click", () => {
        setActiveTool(button);
      });
    });
    if (toolButtons.length === 0) {
      setStatus("No local tools detected.");
      if (frameNode) {
        frameNode.classList.add("hidden");
        removeArtToolImagePoolBridge(frameNode);
      }
      if (emptyNode) {
        emptyNode.classList.remove("hidden");
      }
      if (openLinkNode) {
        openLinkNode.classList.add("hidden");
        openLinkNode.setAttribute("href", "#");
      }
      syncToolQuickActionPreferences([]);
      refreshToolQuickActionUi();
      setWorkspaceHome();
      return;
    }
    syncToolQuickActionPreferences(getToolsCatalogEntries());
    refreshToolQuickActionUi();
    setWorkspaceHome();
  }
  function findPixelArtToolButton() {
    return getToolsCatalogButtons()
      .find(button => isPixelArtToolSourcePath(button.getAttribute("data-tools-src"))) || null;
  }
  function resolveImagePoolSourceUrl(source) {
    const normalized = String(source || "").trim();
    if (!normalized) {
      return "";
    }
    if (/^data:image\//i.test(normalized) || /^https?:\/\//i.test(normalized)) {
      return buildAbsoluteDashboardUrl(normalized);
    }
    if (/^\/api\//i.test(normalized)) {
      return buildAbsoluteDashboardUrl(normalized);
    }
    let parsed;
    try {
      parsed = new URL(normalized, window.location.origin);
    } catch {
      parsed = null;
    }
    if (parsed && parsed.pathname.toLowerCase().endsWith("/api/generated-image-file")) {
      return buildAbsoluteDashboardUrl(parsed.pathname + parsed.search);
    }
    const generatedMatch = normalized.replace(/\//g, "\\").match(/\\generated-images\\([^\\]+)\\([^\\]+)$/i);
    if (generatedMatch) {
      return buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(generatedMatch[1], generatedMatch[2]));
    }
    const uploadedMatch = normalized.replace(/\//g, "\\").match(/\\uploaded-model-images\\([^\\]+)$/i);
    if (uploadedMatch) {
      return buildAbsoluteDashboardUrl("/api/uploaded-model-image-file?file=" + encodeURIComponent(uploadedMatch[1]));
    }
    return "";
  }
  function buildDashboardImagePoolPayload() {
    const pools = Array.isArray(state.imagePools) ? state.imagePools : [];
    return pools.map(pool => ({
      id: pool.id,
      name: pool.name,
      images: (Array.isArray(pool.images) ? pool.images : [])
        .map((source, index) => {
          const url = resolveImagePoolSourceUrl(source);
          if (!url) {
            return null;
          }
          return {
            source,
            url,
            fileName: "pool-image-" + (index + 1) + ".png"
          };
        })
        .filter(Boolean)
    }));
  }
  function buildRecentGeneratedImagePayload() {
    return (Array.isArray(state.generatedImages) ? state.generatedImages : [])
      .map((image, index) => {
        const id = String(image?.id || "").trim();
        const fileName = String(image?.imageFileName || image?.fileName || ("generated-image-" + (index + 1) + ".png")).trim();
        if (!id || !fileName) {
          return null;
        }
        return {
          id,
          fileName,
          url: buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(id, fileName)),
          detail: String(image?.prompt || "").trim() || "Generated image"
        };
      })
      .filter(Boolean);
  }
  function buildRecentGeneratedModelPayload() {
    return (Array.isArray(state.generatedModels) ? state.generatedModels : [])
      .map((model, index) => {
        const id = String(model?.id || "").trim();
        const fileName = String(model?.lowPolyModelFileName || model?.modelFileName || ("generated-model-" + (index + 1) + ".glb")).trim();
        if (!id || !fileName) {
          return null;
        }
        return {
          id,
          fileName,
          url: buildAbsoluteDashboardUrl(getModel3dFileUrl(id, fileName)),
          detail: String(model?.prompt || "").trim() || "Generated 3D model"
        };
      })
      .filter(Boolean);
  }
  function buildPixelArtImagePoolPayload() {
    return buildDashboardImagePoolPayload();
  }
  function sendPixelArtImagePools(targetWindow) {
    if (!targetWindow) {
      return;
    }
    targetWindow.postMessage({
      source: "urage-dashboard",
      type: "pixel-art:image-pools",
      payload: {
        pools: buildDashboardImagePoolPayload()
      }
    }, "*");
  }
  function sendToolWorkspaceTheme(targetWindow) {
    if (!targetWindow) {
      return;
    }
    const theme = String(state.dashboardTheme || "fire").trim() || "fire";
    targetWindow.postMessage({
      source: "urage-dashboard",
      type: "tool:theme",
      payload: {
        theme,
        tokens: getDashboardToolBridgeThemeTokens()
      }
    }, "*");
  }
  function getDashboardToolBridgeThemeTokens() {
    const theme = String(state.dashboardTheme || "fire").trim().toLowerCase();
    const themes = {
      fire: {
        accent: "#ff8a4d",
        accentStrong: "#ff6136",
        surface: "rgba(24, 14, 14, 0.94)",
        surfaceStrong: "rgba(18, 11, 11, 0.98)",
        line: "rgba(255, 180, 128, 0.26)",
        lineStrong: "rgba(255, 138, 77, 0.46)",
        text: "#f6f1ee",
        muted: "#c8b6ae"
      },
      blood: {
        accent: "#ff596b",
        accentStrong: "#d31938",
        surface: "rgba(20, 6, 9, 0.95)",
        surfaceStrong: "rgba(10, 3, 5, 0.98)",
        line: "rgba(225, 42, 70, 0.3)",
        lineStrong: "rgba(255, 89, 107, 0.52)",
        text: "#fff0f2",
        muted: "#d8a5ad"
      },
      love: {
        accent: "#ff9bd8",
        accentStrong: "#ec4ca8",
        surface: "rgba(28, 8, 24, 0.94)",
        surfaceStrong: "rgba(18, 5, 17, 0.98)",
        line: "rgba(255, 130, 205, 0.3)",
        lineStrong: "rgba(255, 155, 216, 0.52)",
        text: "#fff0fa",
        muted: "#ddb0cf"
      },
      water: {
        accent: "#59b6ff",
        accentStrong: "#2b95e6",
        surface: "rgba(12, 21, 37, 0.94)",
        surfaceStrong: "rgba(10, 17, 29, 0.98)",
        line: "rgba(114, 190, 255, 0.26)",
        lineStrong: "rgba(89, 182, 255, 0.48)",
        text: "#eef5ff",
        muted: "#a9bfd8"
      },
      crystal: {
        accent: "#d16aff",
        accentStrong: "#a836e6",
        surface: "rgba(12, 21, 37, 0.94)",
        surfaceStrong: "rgba(10, 17, 29, 0.98)",
        line: "rgba(209, 106, 255, 0.26)",
        lineStrong: "rgba(209, 106, 255, 0.48)",
        text: "#f5eaff",
        muted: "#c9a0e6"
      },
      nature: {
        accent: "#82cd5f",
        accentStrong: "#63b341",
        surface: "rgba(18, 24, 16, 0.94)",
        surfaceStrong: "rgba(13, 19, 11, 0.98)",
        line: "rgba(146, 213, 120, 0.26)",
        lineStrong: "rgba(130, 205, 95, 0.48)",
        text: "#f2f8ee",
        muted: "#bccfaf"
      },
      rock: {
        accent: "#c4ae8a",
        accentStrong: "#a9926e",
        surface: "rgba(24, 24, 24, 0.95)",
        surfaceStrong: "rgba(16, 16, 16, 0.98)",
        line: "rgba(196, 190, 176, 0.26)",
        lineStrong: "rgba(196, 174, 138, 0.48)",
        text: "#f2efea",
        muted: "#b7aea2"
      }
    };
    const fallback = themes[theme] || themes.fire;
    const styles = window.getComputedStyle ? window.getComputedStyle(document.body || document.documentElement) : null;
    const readVar = (name, fallbackValue) => {
      const value = styles ? String(styles.getPropertyValue(name) || "").trim() : "";
      return value || fallbackValue;
    };
    return {
      accent: readVar("--studio-accent-1", fallback.accent),
      accentStrong: readVar("--studio-accent-2", fallback.accentStrong),
      bg: readVar("--studio-surface-bg", fallback.surfaceStrong),
      surface: readVar("--studio-panel-bg", fallback.surface),
      surfaceStrong: readVar("--studio-panel-bg-soft", fallback.surfaceStrong),
      line: readVar("--studio-panel-border", fallback.line),
      lineStrong: readVar("--studio-accent-soft", fallback.lineStrong),
      text: readVar("--ink", fallback.text),
      muted: readVar("--muted", fallback.muted)
    };
  }
  function applyDashboardToolBridgeTheme(root) {
    if (!root || !root.style) {
      return;
    }
    const theme = getDashboardToolBridgeThemeTokens();
    root.style.setProperty("--tool-accent", theme.accent);
    root.style.setProperty("--tool-accent-strong", theme.accentStrong);
    root.style.setProperty("--tool-surface", theme.surface);
    root.style.setProperty("--tool-surface-strong", theme.surfaceStrong);
    root.style.setProperty("--tool-line", theme.line);
    root.style.setProperty("--tool-line-strong", theme.lineStrong);
    root.style.setProperty("--tool-text", theme.text);
    root.style.setProperty("--tool-muted", theme.muted);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-3", theme.accent);
    root.style.setProperty("--panel", theme.surface);
    root.style.setProperty("--panel-strong", theme.surfaceStrong);
    root.style.setProperty("--panel-alt", theme.surfaceStrong);
    root.style.setProperty("--line", theme.line);
    root.style.setProperty("--text", theme.text);
    root.style.setProperty("--ink", theme.text);
    root.style.setProperty("--muted", theme.muted);
  }
  function sendGenericToolImagePools(targetWindow) {
    if (!targetWindow) {
      return;
    }
    targetWindow.postMessage({
      source: "urage-dashboard",
      type: "tool:image-pools",
      payload: {
        pools: buildDashboardImagePoolPayload()
      }
    }, "*");
  }
  function sendFloatingMediaTrayCommand(frameNode, sourcePath, tab) {
    const targetWindow = frameNode && frameNode.contentWindow ? frameNode.contentWindow : null;
    if (!targetWindow) {
      return;
    }
    const type = isTilemapCreatorToolSourcePath(sourcePath) ? "tilemap-creator:media-tray" : "interactive-book:media-tray";
    targetWindow.postMessage({
      source: "urage-dashboard",
      type,
      payload: {
        open: true,
        tab: tab === "recent" ? "recent" : "pools",
        pools: buildDashboardImagePoolPayload(),
        recentImages: buildRecentGeneratedImagePayload()
      }
    }, "*");
  }
  function removeToolWorkspaceSendBridge(frameNode) {
    const doc = frameNode && frameNode.contentDocument ? frameNode.contentDocument : null;
    if (!doc) {
      return;
    }
    const root = doc.getElementById(toolWorkspaceSendBridgeRootId);
    if (root && root.parentElement) {
      root.parentElement.removeChild(root);
    }
  }
  function setToolBridgeVisibility(frameNode, bridgeId, visible) {
    const doc = frameNode && frameNode.contentDocument ? frameNode.contentDocument : null;
    const root = doc ? doc.getElementById(bridgeId) : null;
    if (!root) {
      return false;
    }
    root.style.display = visible === true ? "" : "none";
    return true;
  }
  function applyToolBridgePosition(root, key, fallback) {
    const saved = toolWorkspaceBridgeState.positions && toolWorkspaceBridgeState.positions[key] ? toolWorkspaceBridgeState.positions[key] : null;
    root.style.left = "";
    root.style.top = "";
    root.style.right = "";
    root.style.bottom = "";
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      const width = Math.max(1, root.getBoundingClientRect().width || 320);
      const height = Math.max(1, root.getBoundingClientRect().height || 140);
      const maxLeft = Math.max(8, root.ownerDocument.documentElement.clientWidth - width - 8);
      const maxTop = Math.max(8, root.ownerDocument.documentElement.clientHeight - height - 8);
      const avoidHeader = key === "recent-images" || key === "recent-models" || key === "pools";
      const nextLeft = Math.max(8, Math.min(maxLeft, saved.left));
      const nextTop = Math.max(avoidHeader ? 72 : 8, Math.min(maxTop, saved.top));
      root.style.left = nextLeft + "px";
      root.style.top = nextTop + "px";
      toolWorkspaceBridgeState.positions[key] = { left: nextLeft, top: nextTop };
      return;
    }
    Object.keys(fallback || {}).forEach(name => {
      root.style[name] = fallback[name];
    });
  }
  function applyToolBridgeShellStyle(root, width) {
    root.style.position = "fixed";
    root.style.width = width;
    root.style.maxWidth = "calc(100vw - 24px)";
    root.style.maxHeight = "min(260px, calc(100vh - 96px))";
    root.style.overflow = "auto";
    root.style.boxSizing = "border-box";
    root.style.backdropFilter = "blur(18px)";
  }
  function bindToolBridgeDrag(root, handle, key) {
    if (!root || !handle || handle.getAttribute("data-drag-bound") === "1") {
      return;
    }
    handle.setAttribute("data-drag-bound", "1");
    handle.style.cursor = "move";
    handle.style.userSelect = "none";
    handle.addEventListener("pointerdown", event => {
      if (event.target && event.target.closest && event.target.closest("button,select,input,textarea,a")) {
        return;
      }
      event.preventDefault();
      const doc = root.ownerDocument;
      const rect = root.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const move = moveEvent => {
        const nextLeft = Math.max(8, Math.min(doc.documentElement.clientWidth - rect.width - 8, moveEvent.clientX - offsetX));
        const nextTop = Math.max(8, Math.min(doc.documentElement.clientHeight - rect.height - 8, moveEvent.clientY - offsetY));
        root.style.left = nextLeft + "px";
        root.style.top = nextTop + "px";
        root.style.right = "auto";
        root.style.bottom = "auto";
        toolWorkspaceBridgeState.positions[key] = { left: nextLeft, top: nextTop };
      };
      const up = () => {
        doc.removeEventListener("pointermove", move);
        doc.removeEventListener("pointerup", up);
        doc.removeEventListener("pointercancel", up);
      };
      doc.addEventListener("pointermove", move);
      doc.addEventListener("pointerup", up);
      doc.addEventListener("pointercancel", up);
    });
  }
  function hideToolBridge(frameNode, bridgeId, key) {
    if (key === "send") {
      toolWorkspaceBridgeState.sendVisible = false;
    } else if (key === "pools") {
      toolWorkspaceBridgeState.poolsVisible = false;
    }
    setToolBridgeVisibility(frameNode, bridgeId, false);
    syncToolWorkspaceFooterState(getActiveToolWorkspaceEntry());
  }
  function getToolReadmeViewerUrl(entry) {
    const readmePath = String(entry && entry.readmePath ? entry.readmePath : "").trim();
    if (!readmePath) {
      return "";
    }
    const basePath = readmePath.replace(/[^/]+$/, "");
    const params = new URLSearchParams({
      src: readmePath,
      title: String(entry.title || "Tool README"),
      base: basePath
    });
    return "/tools/dev/markdown-viewer/index.html?" + params.toString();
  }
  function closeToolsReadmeOverlay() {
    const overlay = document.getElementById("tools-readme-overlay");
    if (!overlay) {
      return;
    }
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    const frame = overlay.querySelector("#tools-readme-frame");
    if (frame) {
      frame.setAttribute("src", "about:blank");
    }
  }
  function ensureToolsReadmeOverlay() {
    let overlay = document.getElementById("tools-readme-overlay");
    if (overlay) {
      return overlay;
    }
    overlay = document.createElement("section");
    overlay.id = "tools-readme-overlay";
    overlay.className = "tools-readme-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = [
      "<div class=\"tools-readme-panel\">",
      "  <header class=\"tools-readme-panel-head\" data-tools-readme-drag-handle=\"true\">",
      "    <div><span class=\"panel-kicker\">README.md</span><h3 id=\"tools-readme-title\">Tool README</h3></div>",
      "    <button class=\"ghost compact\" id=\"tools-readme-close-button\" type=\"button\" aria-label=\"Close README\">&#10005;</button>",
      "  </header>",
      "  <iframe id=\"tools-readme-frame\" title=\"Tool README viewer\" loading=\"lazy\" src=\"about:blank\"></iframe>",
      "</div>"
    ].join("");
    document.body.appendChild(overlay);
    overlay.querySelector("#tools-readme-close-button")?.addEventListener("click", closeToolsReadmeOverlay);
    const panel = overlay.querySelector(".tools-readme-panel");
    if (panel) {
      applyToolBridgePosition(panel, "readme", { right: "24px", top: "84px" });
      bindToolBridgeDrag(panel, overlay.querySelector("[data-tools-readme-drag-handle]"), "readme");
    }
    return overlay;
  }
  function showToolReadmeOverlay(entry) {
    const viewerUrl = getToolReadmeViewerUrl(entry);
    if (!viewerUrl) {
      setOutput("No README.md is available for this tool.");
      return;
    }
    const overlay = ensureToolsReadmeOverlay();
    const titleNode = overlay.querySelector("#tools-readme-title");
    const frame = overlay.querySelector("#tools-readme-frame");
    if (titleNode) {
      titleNode.textContent = String(entry.title || "Tool") + " README";
    }
    if (frame) {
      frame.setAttribute("src", viewerUrl);
    }
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    setOutput("Opened README.md for " + String(entry.title || "the active tool") + ".");
  }
  function syncToolWorkspaceFooterState(entry) {
    const footer = document.getElementById("tools-workspace-footer");
    const titleNode = document.getElementById("tools-workspace-footer-title");
    const statusNode = document.getElementById("tools-workspace-footer-status");
    const exportButton = document.getElementById("tools-workspace-export-toggle");
    const poolsButton = document.getElementById("tools-workspace-pools-toggle");
    const recentButton = document.getElementById("tools-workspace-recent-toggle");
    const showReadmeButton = document.getElementById("tools-workspace-show-readme-button");
    const hasEntry = !!entry;
    const isInteractiveBook = hasEntry && isInteractiveBookToolSourcePath(entry.sourcePath);
    const isGifViewer = hasEntry && isGifViewerToolSourcePath(entry.sourcePath);
    const supportsPools = hasEntry && isImageToolTargetSourcePath(entry.sourcePath) && !isGifViewer;
    const supportsRecent = hasEntry && (isImageToolTargetSourcePath(entry.sourcePath) || isThreeModelViewerToolSourcePath(entry.sourcePath)) && !isGifViewer;
    if (footer) {
      footer.classList.toggle("hidden", !hasEntry);
    }
    if (titleNode) {
      titleNode.textContent = hasEntry ? (entry.title || "Tool Controls") : "Tool Controls";
    }
    if (statusNode) {
      statusNode.textContent = supportsPools
        ? (isInteractiveBook ? "Open Media Tray tabs inside the active book tool." : "Send the current tool resource or open dashboard bridges for this image tool.")
        : "Send the current tool resource or open dashboard bridges for this tool.";
    }
    if (exportButton) {
      exportButton.disabled = !hasEntry;
      exportButton.classList.toggle("hidden", !hasEntry);
      exportButton.textContent = isInteractiveBook ? "Send Resource" : "Send Resource";
    }
    if (poolsButton) {
      poolsButton.disabled = !supportsPools;
      poolsButton.classList.toggle("hidden", !supportsPools);
      poolsButton.setAttribute("aria-pressed", toolWorkspaceBridgeState.poolsVisible === false ? "false" : "true");
      poolsButton.textContent = isInteractiveBook ? "Media Tray Pools" : "Image Pools";
    }
    if (recentButton) {
      recentButton.disabled = !supportsRecent;
      recentButton.classList.toggle("hidden", !supportsRecent);
      recentButton.setAttribute("aria-pressed", toolWorkspaceBridgeState.recentVisible === false ? "false" : "true");
      recentButton.textContent = isInteractiveBook ? "Media Tray Recent" : "Recent Media";
    }
    if (showReadmeButton) {
      showReadmeButton.disabled = !hasEntry || !entry.readmePath;
      showReadmeButton.classList.toggle("hidden", !hasEntry || !entry.readmePath);
    }
  }
  const toolWorkspaceEngineStorageKey = "urage-tools-workspace-engine-target";
  const toolsWorkspaceExportState = {
    activeTab: "tool",
    context: null,
    loading: false,
    selectedResourceId: ""
  };
  const toolWorkspaceExportDescriptors = createDashboardToolExportDescriptors({
    buildAbsoluteUrl: value => buildAbsoluteDashboardUrl(value),
    getSendCandidates: (entry, kind) => getToolWorkspaceSendCandidates(entry, kind),
    getActiveTab: () => toolsWorkspaceExportState.activeTab
  });
  const {
    buildExportContextFromOptions: buildToolWorkspaceExportContextFromOptions,
    inferCurrentAssetDescriptors: inferToolWorkspaceCurrentAssetDescriptors,
    inferMimeType: inferToolWorkspaceMimeType,
    normalizeAssetKind: normalizeToolWorkspaceAssetKind,
    normalizeCurrentAssetDescriptor: normalizeToolWorkspaceCurrentAssetDescriptor
  } = toolWorkspaceExportDescriptors;
  function readPreferredToolWorkspaceEngine() {
    try {
      const stored = window.localStorage.getItem(toolWorkspaceEngineStorageKey);
      return stored === "unity" || stored === "unreal" || stored === "godot" ? stored : "unity";
    } catch {
      return "unity";
    }
  }
  function writePreferredToolWorkspaceEngine(value) {
    try {
      window.localStorage.setItem(toolWorkspaceEngineStorageKey, value);
    } catch {}
  }
  function getToolWorkspaceEngineLabel(value) {
    if (value === "godot") return "Godot";
    if (value === "unreal") return "Unreal";
    return "Unity";
  }
  const toolWorkspaceExportContext = createDashboardToolExportContext({
    buildAbsoluteUrl: buildAbsoluteDashboardUrl,
    buildContextFromOptions: buildToolWorkspaceExportContextFromOptions,
    getSelectedResourceId: () => toolsWorkspaceExportState.selectedResourceId,
    getSendCandidates: getToolWorkspaceSendCandidates,
    inferDescriptors: inferToolWorkspaceCurrentAssetDescriptors,
    isGifViewer: isGifViewerToolSourcePath,
    isImageTool: isImageToolTargetSourcePath,
    isModelViewer: isThreeModelViewerToolSourcePath,
    normalizeDescriptor: normalizeToolWorkspaceCurrentAssetDescriptor,
    requestProcessedImage: requestProcessedImageFromTool
  });
  const {build: buildToolWorkspaceExportContext} = toolWorkspaceExportContext;
  const toolWorkspaceExportOverlay = createDashboardToolExportOverlay({
    state: toolsWorkspaceExportState,
    clearChildren,
    readPreferredEngine: readPreferredToolWorkspaceEngine,
    getPreferredSendTargetId: getPreferredToolWorkspaceSendTargetId,
    buildExportContext: buildToolWorkspaceExportContext,
    getActiveEntry: getActiveToolWorkspaceEntry,
    setStatus
  });
  const {
    close: closeToolsWorkspaceExportOverlay,
    openForEntry: openToolsWorkspaceExportForEntry,
    setSelectedResource: setSelectedToolWorkspaceExportResource,
    setTab: setToolsWorkspaceExportTab,
    updateUi: updateToolsWorkspaceExportUi
  } = toolWorkspaceExportOverlay;
  async function readToolWorkspaceBlobSourceAsDataUrl(sourceUrl) {
    const normalized = String(sourceUrl || "").trim();
    if (!/^blob:/i.test(normalized)) {
      return "";
    }
    const response = await fetch(normalized, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to read browser-local tool output (" + response.status + ").");
    }
    return await readBlobAsDataUrl(await response.blob());
  }
  async function importToolWorkspaceImageForLazyDev(context) {
    const exportedImage = context?.exportedImage || null;
    const descriptor = context?.assetDescriptor || null;
    let dataUrl = String(exportedImage?.dataUrl || descriptor?.dataUrl || "").trim();
    if (!dataUrl) {
      const sourceUrl = String(descriptor?.sourceUrl || context?.preview?.url || "").trim();
      if (!sourceUrl) {
        throw new Error("This tool did not expose an image to import into LazyDev.");
      }
      const response = await fetch(sourceUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to read the current tool image (" + response.status + ").");
      }
      dataUrl = await readBlobAsDataUrl(await response.blob());
    }
    return request("/api/image-import", {
      dataUrl,
      fileName: String(exportedImage?.fileName || descriptor?.fileName || context?.sourceName || "tool-output.png").trim() || "tool-output.png",
      prompt: "",
      width: exportedImage?.width || undefined,
      height: exportedImage?.height || undefined,
      model: String(context?.entry?.title || "Tool Workspace").trim() || "Tool Workspace",
      metadata: {
        sourceToolId: String(context?.entry?.id || "").trim(),
        sourceToolTitle: String(context?.entry?.title || "").trim()
      }
    });
    tagFilterButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const tag = String(event.currentTarget?.getAttribute("data-tools-tag-filter") || "");
        toolsWorkspaceState.activeTag = toolsWorkspaceState.activeTag === tag ? "" : tag;
        setToolsWorkspaceFilter(toolsWorkspaceState.activeFilter || "all");
      });
    });
  }
  async function sendToolWorkspaceImageToLazyDev(context, target) {
    const resourceContexts = Array.isArray(context?.resourceOptions)
      ? context.resourceOptions.map(option => option.context).filter(option => option?.resourceKind === "image")
      : [context];
    const importedImages = [];
    for (const resourceContext of resourceContexts) {
      const imported = await importToolWorkspaceImageForLazyDev(resourceContext);
      if (!imported?.id || !imported?.imageFileName) {
        throw new Error("LazyDev import did not return an image resource.");
      }
      importedImages.push(imported);
    }
    if (importedImages.length === 0) {
      throw new Error("This tool did not expose any split images to import into LazyDev.");
    }
    const latestImported = importedImages[importedImages.length - 1];
    await loadImageHistory(latestImported.id);
    await refreshState();
    state.selectedGeneratedImageId = latestImported.id;
    state.selectedGeneratedImageIds = importedImages.map(image => image.id);
    const studioTarget = target === "model3d" ? "model3d-studio-card" : "image-studio-card";
    if (target === "model3d") {
      const sourceField = document.getElementById("model3d-image-source");
      const sourceUrls = importedImages.map(image => buildAbsoluteDashboardUrl(getGeneratedImageFileUrl(image.id, image.imageFileName))).filter(Boolean);
      if (sourceField && sourceUrls.length > 0) {
        sourceField.value = sourceUrls.join("\n");
        sourceField.dispatchEvent(new Event("input", { bubbles: true }));
        sourceField.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    switchView("ai");
    window.setTimeout(() => document.querySelector('[data-ai-scroll-target="' + studioTarget + '"]')?.click(), 0);
    return importedImages;
  }
  const toolWorkspaceExportSubmission = createDashboardToolExportSubmission({
    state: toolsWorkspaceExportState,
    updateUi: updateToolsWorkspaceExportUi,
    closeOverlay: closeToolsWorkspaceExportOverlay,
    setStatus,
    setOutput,
    sendImageToLazyDev: sendToolWorkspaceImageToLazyDev,
    sendAssetToTool: sendAssetToToolWorkspace,
    writePreferredEngine: writePreferredToolWorkspaceEngine,
    getEngineLabel: getToolWorkspaceEngineLabel,
    request,
    inferMimeType: inferToolWorkspaceMimeType,
    buildAbsoluteUrl: buildAbsoluteDashboardUrl,
    getGeneratedImageFileUrl,
    readBlobSourceAsDataUrl: readToolWorkspaceBlobSourceAsDataUrl
  });
  const {submit: submitToolsWorkspaceExport} = toolWorkspaceExportSubmission;
  function getToolWorkspaceSendCandidates(currentEntry, resourceKind = "image") {
    const currentId = String(currentEntry && currentEntry.id ? currentEntry.id : "").trim();
    const kind = normalizeToolWorkspaceAssetKind(resourceKind);
    return getToolsCatalogEntries().filter(entry => {
      if (entry.id === currentId) {
        return false;
      }
      return kind === "gif" ? isGifViewerToolSourcePath(entry.sourcePath) : isImageToolTargetSourcePath(entry.sourcePath);
    });
  }
  function getPreferredToolWorkspaceSendTargetId(currentEntry, candidates) {
    const selectedId = String(toolQuickActionState.imageSelectedId || "").trim();
    if (selectedId && Array.isArray(candidates) && candidates.some(entry => entry.id === selectedId)) {
      return selectedId;
    }
    const fallbackEntry = Array.isArray(candidates) && candidates.length > 0 ? candidates[0] : null;
    return fallbackEntry ? fallbackEntry.id : "";
  }
  function requestProcessedImageFromTool(frameNode, entry, timeoutMs) {
    return new Promise((resolve, reject) => {
      const targetWindow = frameNode && frameNode.contentWindow ? frameNode.contentWindow : null;
      if (!frameNode || !targetWindow) {
        reject(new Error("Tool frame is unavailable."));
        return;
      }
      if (typeof targetWindow.__urageToolRequestExportImage === "function") {
        Promise.resolve()
          .then(() => targetWindow.__urageToolRequestExportImage())
          .then(resolve)
          .catch(error => reject(new Error(error && error.message ? error.message : "This tool does not expose a processed image yet.")));
        return;
      }
      if (typeof targetWindow.__imageTransparencyToolRequestExportImage === "function") {
        Promise.resolve()
          .then(() => targetWindow.__imageTransparencyToolRequestExportImage())
          .then(resolve)
          .catch(error => reject(new Error(error && error.message ? error.message : "This tool does not expose a processed image yet.")));
        return;
      }
      const requestId = "tool-export-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      const timeoutId = window.setTimeout(() => {
        toolWorkspaceImageExportRequests.delete(requestId);
        reject(new Error("This tool does not expose a processed image yet."));
      }, Math.max(1500, Number(timeoutMs) || 5000));
      toolWorkspaceImageExportRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        sourceWindow: targetWindow,
        entryId: String(entry && entry.id ? entry.id : "").trim()
      });
      targetWindow.postMessage({
        source: "urage-dashboard",
        type: "tool:request-export-image",
        requestId,
        payload: {}
      }, "*");
    });
  }
  function mountToolWorkspaceSendBridge(frameNode, entry) {
    const doc = frameNode && frameNode.contentDocument ? frameNode.contentDocument : null;
    if (!frameNode || !doc || !doc.body || !entry) {
      removeToolWorkspaceSendBridge(frameNode);
      return;
    }
    const candidates = getToolWorkspaceSendCandidates(entry);
    let root = doc.getElementById(toolWorkspaceSendBridgeRootId);
    if (!root) {
      root = doc.createElement("div");
      root.id = toolWorkspaceSendBridgeRootId;
      root.style.zIndex = "2147483601";
      root.style.border = "1px solid var(--tool-line-strong, rgba(255,136,78,0.34))";
      root.style.borderRadius = "14px";
      root.style.background = "var(--tool-surface-strong, rgba(16,9,10,0.96))";
      root.style.color = "var(--tool-text, #f5f5f5)";
      root.style.padding = "12px";
      root.style.boxShadow = "0 14px 28px rgba(0,0,0,0.35)";
      root.style.fontFamily = "Inter, Segoe UI, sans-serif";
      doc.body.appendChild(root);
    }
    applyToolBridgeShellStyle(root, "min(280px, calc(100vw - 24px))");
    applyDashboardToolBridgeTheme(root);
    applyToolBridgePosition(root, "send", { right: "14px", bottom: "14px" });
    root.style.display = toolWorkspaceBridgeState.sendVisible === false ? "none" : "";
    const defaultTargetId = getPreferredToolWorkspaceSendTargetId(entry, candidates);
    root.innerHTML = ""
      + "<div data-bridge-drag-handle='send' style='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;'>"
      + "<strong style='font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--tool-muted, #cbb9ad);'>Send To Tool</strong>"
      + "<span style='display:flex;align-items:center;gap:8px;'><span style='font-size:11px;color:var(--tool-muted, #cbb9ad);'>Processed image</span><button type='button' data-send-close='true' style='background:transparent;border:0;color:var(--tool-muted, #d7d7d7);cursor:pointer;font-size:16px;line-height:1;'>x</button></span>"
      + "</div>"
      + "<div style='display:grid;gap:8px;'>"
      + "<select data-send-target='true' style='width:100%;background:rgba(8,10,16,0.86);color:var(--tool-text, #f5f5f5);border:1px solid var(--tool-line, rgba(255,136,78,0.35));border-radius:10px;padding:8px;'></select>"
      + "<button type='button' data-send-action='true' style='width:100%;border:1px solid var(--tool-line-strong, rgba(255,136,78,0.45));background:linear-gradient(180deg, color-mix(in srgb, var(--tool-accent, #ff8a4d) 44%, transparent) 0%, color-mix(in srgb, var(--tool-accent-strong, #ff6136) 18%, rgba(255,255,255,0.02)) 100%);color:var(--tool-text, #fff);border-radius:10px;padding:9px;cursor:pointer;'>Send Current Result</button>"
      + "<div data-send-status='true' style='font-size:11px;color:var(--tool-muted, #cbb9ad);'>Export the current processed image and open it in another tool.</div>"
      + "</div>";
    const targetSelect = root.querySelector("[data-send-target='true']");
    const sendButton = root.querySelector("[data-send-action='true']");
    const closeButton = root.querySelector("[data-send-close='true']");
    const statusNode = root.querySelector("[data-send-status='true']");
    bindToolBridgeDrag(root, root.querySelector("[data-bridge-drag-handle='send']"), "send");
    const setStatus = text => {
      if (statusNode) {
        statusNode.textContent = text;
      }
    };
    if (!targetSelect || !sendButton) {
      return;
    }
    closeButton?.addEventListener("click", event => {
      event.preventDefault();
      hideToolBridge(frameNode, toolWorkspaceSendBridgeRootId, "send");
    });
    targetSelect.innerHTML = "";
    if (candidates.length === 0) {
      targetSelect.appendChild(new Option("No compatible target tools", ""));
      targetSelect.disabled = true;
      sendButton.disabled = true;
      setStatus("No other image-capable tools are available right now.");
      return;
    }
    candidates.forEach(candidate => {
      targetSelect.appendChild(new Option(candidate.title + " (" + candidate.categoryLabel + ")", candidate.id));
    });
    targetSelect.value = defaultTargetId;
    sendButton.disabled = false;
    sendButton.addEventListener("click", async event => {
      event.preventDefault();
      const targetEntry = candidates.find(candidate => candidate.id === String(targetSelect.value || "").trim()) || null;
      if (!targetEntry) {
        setStatus("Select a target tool first.");
        return;
      }
      try {
        sendButton.disabled = true;
        setStatus("Exporting current processed image...");
        const exported = await requestProcessedImageFromTool(frameNode, entry, 5000);
        if (!exported || !exported.dataUrl) {
          throw new Error("This tool did not return an image to send.");
        }
        setStatus("Opening " + targetEntry.title + "...");
        await sendAssetToToolWorkspace(targetEntry, {
          kind: "image",
          dataUrl: String(exported.dataUrl || "").trim(),
          imageFileName: String(exported.fileName || "tool-output.png").trim() || "tool-output.png",
          fileName: String(exported.fileName || "tool-output.png").trim() || "tool-output.png",
          width: exported.width || undefined,
          height: exported.height || undefined,
          prompt: ""
        }, { switchView: true });
        setStatus("Sent current result to " + targetEntry.title + ".");
      } catch (error) {
        setStatus(error && error.message ? error.message : "Failed to send image to another tool.");
      } finally {
        sendButton.disabled = false;
      }
    });
  }
  function removeArtToolImagePoolBridge(frameNode) {
    const doc = frameNode && frameNode.contentDocument ? frameNode.contentDocument : null;
    if (!doc) {
      return;
    }
    const root = doc.getElementById(artToolImagePoolBridgeRootId);
    if (root && root.parentElement) {
      root.parentElement.removeChild(root);
    }
  }
  function removeToolWorkspaceRecentBridge(frameNode) {
    const doc = frameNode && frameNode.contentDocument ? frameNode.contentDocument : null;
    if (!doc) {
      return;
    }
    const root = doc.getElementById(toolWorkspaceRecentBridgeRootId);
    if (root && root.parentElement) {
      root.parentElement.removeChild(root);
    }
  }
  function findPreferredArtToolImageInput(toolDocument) {
    if (!toolDocument) {
      return null;
    }
    const inputs = Array.from(toolDocument.querySelectorAll("input[type='file']"));
    if (inputs.length === 0) {
      return null;
    }
    const acceptingImage = inputs.filter(inputNode => String(inputNode.getAttribute("accept") || "").toLowerCase().includes("image"));
    return acceptingImage.find(inputNode => !inputNode.disabled) || null;
  }
  function fileMatchesAcceptToken(file, token) {
    const normalizedToken = String(token || "").trim().toLowerCase();
    if (!normalizedToken) {
      return true;
    }
    const fileName = String(file?.name || "").trim().toLowerCase();
    const fileType = String(file?.type || "").trim().toLowerCase();
    if (normalizedToken === "*/*") {
      return true;
    }
    if (normalizedToken.endsWith("/*")) {
      const group = normalizedToken.slice(0, -1);
      return fileType.startsWith(group);
    }
    if (normalizedToken.startsWith(".")) {
      return fileName.endsWith(normalizedToken);
    }
    return fileType === normalizedToken;
  }
  function fileMatchesAccept(file, acceptValue) {
    const normalizedAccept = String(acceptValue || "").trim();
    if (!normalizedAccept) {
      return true;
    }
    const tokens = normalizedAccept.split(",").map(token => token.trim()).filter(Boolean);
    if (tokens.length === 0) {
      return true;
    }
    return tokens.some(token => fileMatchesAcceptToken(file, token));
  }
  function findPreferredToolFileInput(toolDocument, files) {
    if (!toolDocument) {
      return null;
    }
    const availableInputs = Array.from(toolDocument.querySelectorAll("input[type='file']")).filter(inputNode => !inputNode.disabled);
    if (availableInputs.length === 0) {
      return null;
    }
    const nextFiles = Array.from(files || []).filter(Boolean);
    if (nextFiles.length === 0) {
      return availableInputs[0] || null;
    }
    const matchingInput = availableInputs.find(inputNode => nextFiles.every(file => fileMatchesAccept(file, inputNode.getAttribute("accept") || "")));
    if (matchingInput) {
      return matchingInput;
    }
    return availableInputs.find(inputNode => nextFiles.some(file => fileMatchesAccept(file, inputNode.getAttribute("accept") || ""))) || availableInputs[0] || null;
  }
  function buildFileTransfer(files, allowMultiple) {
    const nextFiles = Array.from(files || []).filter(Boolean);
    if (nextFiles.length === 0) {
      return null;
    }
    const transfer = new DataTransfer();
    const selectedFiles = allowMultiple ? nextFiles : [nextFiles[0]];
    selectedFiles.forEach(file => {
      transfer.items.add(file);
    });
    return transfer;
  }
  function injectFilesIntoToolInput(toolDocument, files) {
    const nextFiles = Array.from(files || []).filter(Boolean);
    if (nextFiles.length === 0) {
      throw new Error("No files were provided.");
    }
    const inputNode = findPreferredToolFileInput(toolDocument, nextFiles);
    if (!inputNode) {
      throw new Error("This tool has no file input to receive dropped or pasted files.");
    }
    const transfer = buildFileTransfer(nextFiles, inputNode.multiple === true);
    if (!transfer) {
      throw new Error("Failed to prepare the dropped files.");
    }
    inputNode.files = transfer.files;
    inputNode.dispatchEvent(new Event("input", { bubbles: true }));
    inputNode.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      inputNode,
      acceptedCount: transfer.files.length
    };
  }
  function guessFileNameFromUrl(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return "pool-image.png";
    }
    try {
      const parsed = new URL(normalized, window.location.origin);
      const base = (parsed.pathname.split("/").pop() || "").trim();
      return base || "pool-image.png";
    } catch {
      return "pool-image.png";
    }
  }
  async function injectImageIntoArtToolInput(toolDocument, imageUrl, fileName) {
    const sourceUrl = buildAbsoluteDashboardUrl(imageUrl);
    const response = await fetch(sourceUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load pool image (" + response.status + ").");
    }
    const blob = await response.blob();
    const extension = String(fileName || "").includes(".")
      ? ""
      : (blob.type && blob.type.includes("png") ? ".png" : (blob.type && blob.type.includes("jpeg") ? ".jpg" : ""));
    const nextFileName = String(fileName || guessFileNameFromUrl(imageUrl) || "pool-image").trim() || "pool-image";
    injectFilesIntoToolInput(toolDocument, [new File([blob], nextFileName + extension, { type: blob.type || "image/png" })]);
  }
  async function injectUrlIntoToolInput(toolDocument, url, fileName, fallbackType) {
    const sourceUrl = buildAbsoluteDashboardUrl(url);
    const response = await fetch(sourceUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load generated media (" + response.status + ").");
    }
    const blob = await response.blob();
    const nextFileName = String(fileName || guessFileNameFromUrl(url) || "generated-media").trim() || "generated-media";
    injectFilesIntoToolInput(toolDocument, [new File([blob], nextFileName, { type: blob.type || fallbackType || "application/octet-stream" })]);
  }
  async function injectUrlsAsFilesIntoToolInput(toolDocument, items, fallbackType) {
    const files = [];
    for (const item of Array.isArray(items) ? items : []) {
      const sourceUrl = buildAbsoluteDashboardUrl(item?.url || "");
      if (!sourceUrl) {
        continue;
      }
      const response = await fetch(sourceUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load " + (item?.fileName || "generated media") + " (" + response.status + ").");
      }
      const blob = await response.blob();
      const fileName = String(item?.fileName || guessFileNameFromUrl(sourceUrl) || "generated-media").trim() || "generated-media";
      files.push(new File([blob], fileName, { type: blob.type || fallbackType || "application/octet-stream" }));
    }
    injectFilesIntoToolInput(toolDocument, files);
  }
  function toolDocumentAllowsDefaultArtImage(toolDocument) {
    const root = toolDocument?.body || toolDocument?.documentElement || null;
    if (!root) {
      return false;
    }
    return String(root.getAttribute("data-dashboard-default-image") || "").trim().toLowerCase() === "true";
  }
  function shouldPrimeArtToolWithDefaultImage(sourcePath, toolDocument) {
    return isArtToolSourcePath(sourcePath)
      && !isThreeModelViewerToolSourcePath(sourcePath)
      && !isPixelArtToolSourcePath(sourcePath)
      && !isGifViewerToolSourcePath(sourcePath)
      && toolDocumentAllowsDefaultArtImage(toolDocument);
  }
  async function primeArtToolDefaultInputImage(frameNode, entry) {
    const sourcePath = String(entry && entry.sourcePath ? entry.sourcePath : frameNode?.getAttribute("src") || "").trim();
    const toolDocument = frameNode?.contentDocument || null;
    if (!frameNode || !shouldPrimeArtToolWithDefaultImage(sourcePath, toolDocument)) {
      return false;
    }
    if (String(frameNode.getAttribute("data-suppress-default-art-image") || "") === "1") {
      return false;
    }
    if (!toolDocument || !findPreferredArtToolImageInput(toolDocument)) {
      return false;
    }
    const normalizedSourcePath = normalizeToolSourcePath(sourcePath);
    const primedKey = normalizedSourcePath + "::" + defaultArtToolInputImageFileName;
    if (String(frameNode.getAttribute("data-default-art-image-primed") || "") === primedKey) {
      return false;
    }
    await injectImageIntoArtToolInput(toolDocument, defaultArtToolInputImageUrl, defaultArtToolInputImageFileName);
    frameNode.setAttribute("data-default-art-image-primed", primedKey);
    return true;
  }
  function getClipboardFiles(event) {
    const clipboardFiles = Array.from(event?.clipboardData?.files || []).filter(Boolean);
    if (clipboardFiles.length > 0) {
      return clipboardFiles;
    }
    const items = Array.from(event?.clipboardData?.items || []).filter(Boolean);
    return items
      .map(item => (typeof item.getAsFile === "function" ? item.getAsFile() : null))
      .filter(Boolean);
  }
  function bindToolWorkspaceFileBridge(frameNode, entry) {
    const doc = frameNode?.contentDocument;
    const body = doc?.body;
    const entryId = String(entry?.id || "").trim();
    if (!doc || !body || !entryId) {
      return;
    }
    if (body.getAttribute("data-urage-file-bridge") === entryId) {
      return;
    }
    body.setAttribute("data-urage-file-bridge", entryId);
    const loadFilesIntoTool = (files, sourceLabel) => {
      const nextFiles = Array.from(files || []).filter(Boolean);
      if (nextFiles.length === 0) {
        return false;
      }
      try {
        const result = injectFilesIntoToolInput(doc, nextFiles);
        const noun = result.acceptedCount === 1 ? "file" : "files";
        setOutput("Loaded " + result.acceptedCount + " " + noun + " into " + (entry.title || "tool") + " from " + sourceLabel + ".");
        return true;
      } catch {
        return false;
      }
    };
    doc.addEventListener("dragover", event => {
      if (!findPreferredToolFileInput(doc, Array.from(event.dataTransfer?.files || []))) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    });
    doc.addEventListener("drop", event => {
      const droppedFiles = Array.from(event.dataTransfer?.files || []).filter(Boolean);
      if (!loadFilesIntoTool(droppedFiles, "drag and drop")) {
        return;
      }
      event.preventDefault();
    });
    doc.addEventListener("paste", event => {
      const pastedFiles = getClipboardFiles(event);
      if (!loadFilesIntoTool(pastedFiles, "paste")) {
        return;
      }
      event.preventDefault();
    });
  }
  function mountToolWorkspaceRecentBridge(frameNode, entry) {
    const sourcePath = String(entry && entry.sourcePath ? entry.sourcePath : "").trim();
    const isModelTool = isThreeModelViewerToolSourcePath(sourcePath);
    const isImageTool = isImageToolTargetSourcePath(sourcePath) && !isModelTool && !isInteractiveBookToolSourcePath(sourcePath) && !isGifViewerToolSourcePath(sourcePath);
    if (!frameNode || (!isImageTool && !isModelTool)) {
      removeToolWorkspaceRecentBridge(frameNode);
      return;
    }
    const doc = frameNode.contentDocument;
    if (!doc || !doc.body || !findPreferredToolFileInput(doc, [])) {
      removeToolWorkspaceRecentBridge(frameNode);
      return;
    }
    const items = isModelTool ? buildRecentGeneratedModelPayload() : buildRecentGeneratedImagePayload();
    let root = doc.getElementById(toolWorkspaceRecentBridgeRootId);
    if (!root) {
      root = doc.createElement("div");
      root.id = toolWorkspaceRecentBridgeRootId;
      root.style.zIndex = "2147483599";
      root.style.border = "1px solid var(--line, rgba(255,136,78,0.34))";
      root.style.borderRadius = "12px";
      root.style.background = "var(--panel, rgba(16,9,10,0.95))";
      root.style.color = "var(--text, var(--ink, #f5f5f5))";
      root.style.padding = "10px";
      root.style.boxShadow = "0 14px 28px rgba(0,0,0,0.35)";
      root.style.fontFamily = "Inter, Segoe UI, sans-serif";
      doc.body.appendChild(root);
    }
    applyDashboardToolBridgeTheme(root);
    applyToolBridgeShellStyle(root, "min(300px, calc(100vw - 24px))");
    applyToolBridgePosition(root, isModelTool ? "recent-models" : "recent-images", { left: "14px", bottom: "14px" });
    root.style.display = toolWorkspaceBridgeState.recentVisible === false ? "none" : "";
    root.innerHTML = ""
      + "<div data-bridge-drag-handle='recent' style='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;'>"
      + "<strong style='font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent, var(--accent-3, #ffbe93));'>" + (isModelTool ? "Recent Generated Models" : "Recent Generated Images") + "</strong>"
      + "<button type='button' data-recent-close='true' style='background:transparent;border:0;color:var(--muted, #d7d7d7);cursor:pointer;font-size:16px;line-height:1;'>x</button>"
      + "</div>"
      + "<div style='display:grid;gap:8px;'>"
      + "<select data-recent-item='true' style='width:100%;background:var(--panel-strong, var(--panel-alt, #170e10));color:var(--text, var(--ink, #f5f5f5));border:1px solid var(--line, rgba(255,136,78,0.35));border-radius:8px;padding:7px;'></select>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr;gap:6px;'><button type='button' data-recent-load='true' style='border:1px solid color-mix(in srgb, var(--accent, var(--accent-3, #ff884e)) 56%, transparent);background:color-mix(in srgb, var(--accent, var(--accent-3, #ff884e)) 18%, transparent);color:var(--text, var(--ink, #fff));border-radius:8px;padding:8px;cursor:pointer;'>Load Selected</button><button type='button' data-recent-load-all='true' style='border:1px solid var(--line, rgba(255,136,78,0.35));background:rgba(255,255,255,0.04);color:var(--text, var(--ink, #fff));border-radius:8px;padding:8px;cursor:pointer;'>Load All</button></div>"
      + "<div data-recent-status='true' style='font-size:11px;color:var(--muted, #cbb9ad);'>Choose generated media and load it into this tool.</div>"
      + "</div>";
    const itemSelect = root.querySelector("[data-recent-item='true']");
    const loadButton = root.querySelector("[data-recent-load='true']");
    const loadAllButton = root.querySelector("[data-recent-load-all='true']");
    const closeButton = root.querySelector("[data-recent-close='true']");
    const statusNode = root.querySelector("[data-recent-status='true']");
    bindToolBridgeDrag(root, root.querySelector("[data-bridge-drag-handle='recent']"), isModelTool ? "recent-models" : "recent-images");
    const setStatus = text => {
      if (statusNode) {
        statusNode.textContent = text;
      }
    };
    closeButton?.addEventListener("click", event => {
      event.preventDefault();
      toolWorkspaceBridgeState.recentVisible = false;
      setToolBridgeVisibility(frameNode, toolWorkspaceRecentBridgeRootId, false);
    });
    if (!itemSelect || !loadButton || !loadAllButton) {
      return;
    }
    if (items.length === 0) {
      itemSelect.innerHTML = "<option>No recent generated media</option>";
      loadButton.disabled = true;
      loadAllButton.disabled = true;
      setStatus(isModelTool ? "No generated models available yet." : "No generated images available yet.");
      return;
    }
    items.forEach((item, index) => {
      const option = doc.createElement("option");
      option.value = String(index);
      option.textContent = item.fileName;
      itemSelect.appendChild(option);
    });
    const loadItems = async selectedItems => {
      const validItems = selectedItems.filter(item => item && item.url);
      if (validItems.length === 0) {
        setStatus("Select generated media first.");
        return;
      }
      setStatus("Loading " + validItems.length + " item(s) into tool...");
      await injectUrlsAsFilesIntoToolInput(doc, validItems, isModelTool ? "model/gltf-binary" : "image/png");
      setStatus("Loaded " + validItems.length + " generated item(s) into tool.");
    };
    loadButton.addEventListener("click", async event => {
      event.preventDefault();
      try {
        await loadItems([items[Number.parseInt(String(itemSelect.value || "0"), 10)]]);
      } catch (error) {
        setStatus(error && error.message ? error.message : "Failed to load generated media.");
      }
    });
    loadAllButton.addEventListener("click", async event => {
      event.preventDefault();
      try {
        await loadItems(items);
      } catch (error) {
        setStatus(error && error.message ? error.message : "Failed to load all generated media.");
      }
    });
  }
  function mountArtToolImagePoolBridge(frameNode, entry) {
    const sourcePath = String(entry && entry.sourcePath ? entry.sourcePath : "").trim();
    if (!frameNode || !isImageToolTargetSourcePath(sourcePath) || isInteractiveBookToolSourcePath(sourcePath) || isGifViewerToolSourcePath(sourcePath)) {
      removeArtToolImagePoolBridge(frameNode);
      return;
    }
    const usePixelArtLoader = isPixelArtToolSourcePath(sourcePath);
    const doc = frameNode.contentDocument;
    if (!doc || !doc.body) {
      return;
    }
    if (!usePixelArtLoader && !findPreferredArtToolImageInput(doc)) {
      removeArtToolImagePoolBridge(frameNode);
      return;
    }
    let root = doc.getElementById(artToolImagePoolBridgeRootId);
    if (!root) {
      root = doc.createElement("div");
      root.id = artToolImagePoolBridgeRootId;
      root.style.zIndex = "2147483600";
      root.style.border = "1px solid var(--line, rgba(255,136,78,0.34))";
      root.style.borderRadius = "12px";
      root.style.background = "var(--panel, rgba(16,9,10,0.95))";
      root.style.color = "var(--text, var(--ink, #f5f5f5))";
      root.style.padding = "10px";
      root.style.boxShadow = "0 14px 28px rgba(0,0,0,0.35)";
      root.style.fontFamily = "Inter, Segoe UI, sans-serif";
      doc.body.appendChild(root);
    }
    applyDashboardToolBridgeTheme(root);
    applyToolBridgeShellStyle(root, "min(300px, calc(100vw - 24px))");
    applyToolBridgePosition(root, "pools", { left: "14px", bottom: "166px" });
    root.style.display = toolWorkspaceBridgeState.poolsVisible === false ? "none" : "";
    const pools = buildDashboardImagePoolPayload()
      .map(pool => ({
        id: pool.id,
        name: pool.name,
        images: (Array.isArray(pool.images) ? pool.images : []).filter(Boolean)
      }))
      .filter(pool => Array.isArray(pool.images) && pool.images.length > 0);
    root.innerHTML = ""
      + "<div data-bridge-drag-handle='pools' style='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;'>"
      + "<strong style='font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent, var(--accent-3, #ffbe93));'>Dashboard Image Pools</strong>"
      + "<button type='button' data-bridge-close='true' style='background:transparent;border:0;color:var(--muted, #d7d7d7);cursor:pointer;font-size:16px;line-height:1;'>x</button>"
      + "</div>"
      + "<div style='display:grid;gap:8px;'>"
      + "<select data-bridge-pool='true' style='width:100%;background:var(--panel-strong, var(--panel-alt, #170e10));color:var(--text, var(--ink, #f5f5f5));border:1px solid var(--line, rgba(255,136,78,0.35));border-radius:8px;padding:7px;'></select>"
      + "<select data-bridge-image='true' style='width:100%;background:var(--panel-strong, var(--panel-alt, #170e10));color:var(--text, var(--ink, #f5f5f5));border:1px solid var(--line, rgba(255,136,78,0.35));border-radius:8px;padding:7px;'></select>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr;gap:6px;'><button type='button' data-bridge-load='true' style='border:1px solid color-mix(in srgb, var(--accent, var(--accent-3, #ff884e)) 56%, transparent);background:linear-gradient(180deg, color-mix(in srgb, var(--accent, var(--accent-3, #ff884e)) 32%, transparent) 0%, color-mix(in srgb, var(--accent, var(--accent-3, #ff884e)) 14%, transparent) 100%);color:var(--text, var(--ink, #fff));border-radius:8px;padding:8px;cursor:pointer;'>Load Selected</button><button type='button' data-bridge-load-all='true' style='border:1px solid var(--line, rgba(255,136,78,0.35));background:rgba(255,255,255,0.04);color:var(--text, var(--ink, #fff));border-radius:8px;padding:8px;cursor:pointer;'>Load All</button></div>"
      + "<div data-bridge-status='true' style='font-size:11px;color:var(--muted, #cbb9ad);'>Choose a pool image and load it into this tool.</div>"
      + "</div>";
    const poolSelect = root.querySelector("[data-bridge-pool='true']");
    const imageSelect = root.querySelector("[data-bridge-image='true']");
    const loadButton = root.querySelector("[data-bridge-load='true']");
    const loadAllButton = root.querySelector("[data-bridge-load-all='true']");
    const closeButton = root.querySelector("[data-bridge-close='true']");
    const statusNode = root.querySelector("[data-bridge-status='true']");
    bindToolBridgeDrag(root, root.querySelector("[data-bridge-drag-handle='pools']"), "pools");
    const setStatus = text => {
      if (statusNode) {
        statusNode.textContent = text;
      }
    };
    if (!poolSelect || !imageSelect || !loadButton || !loadAllButton) {
      return;
    }
    closeButton?.addEventListener("click", event => {
      event.preventDefault();
      hideToolBridge(frameNode, artToolImagePoolBridgeRootId, "pools");
    });
    if (pools.length === 0) {
      poolSelect.innerHTML = "<option>No image pools available</option>";
      imageSelect.innerHTML = "<option>Add images to a pool in Studio first</option>";
      loadButton.disabled = true;
      loadAllButton.disabled = true;
      setStatus("No pool images available yet.");
      return;
    }
    pools.forEach(pool => {
      const option = doc.createElement("option");
      option.value = pool.id;
      option.textContent = pool.name || pool.id;
      poolSelect.appendChild(option);
    });
    const renderImageOptions = () => {
      const selectedPoolId = String(poolSelect.value || "").trim();
      const selectedPool = pools.find(pool => pool.id === selectedPoolId) || pools[0];
      imageSelect.innerHTML = "";
      const images = selectedPool && Array.isArray(selectedPool.images) ? selectedPool.images : [];
      images.forEach((image, index) => {
        const option = doc.createElement("option");
        option.value = String(index);
        option.textContent = image.fileName || ("pool-image-" + (index + 1));
        imageSelect.appendChild(option);
      });
      loadButton.disabled = images.length === 0;
      loadAllButton.disabled = images.length === 0;
      setStatus(images.length > 0
        ? "Pool ready: " + (selectedPool && selectedPool.name ? selectedPool.name : "Unnamed") + "."
        : "This pool has no valid image URLs.");
    };
    poolSelect.addEventListener("change", renderImageOptions);
    loadButton.addEventListener("click", async event => {
      event.preventDefault();
      const selectedPoolId = String(poolSelect.value || "").trim();
      const selectedPool = pools.find(pool => pool.id === selectedPoolId) || null;
      const imageIndex = Number.parseInt(String(imageSelect.value || "0"), 10);
      const selectedImage = selectedPool && Array.isArray(selectedPool.images) ? selectedPool.images[imageIndex] : null;
      if (!selectedImage || !selectedImage.url) {
        setStatus("Select a pool image first.");
        return;
      }
      try {
        setStatus("Loading image into tool...");
        if (usePixelArtLoader) {
          await waitForPixelArtToolReady(frameNode, 15000);
          await sendPixelArtLoadImage(frameNode, {
            source: "urage-dashboard",
            type: "pixel-art:load-image",
            requestId: getPixelArtRequestId(),
            payload: {
              url: buildAbsoluteDashboardUrl(selectedImage.url),
              dataUrl: await fetchImageAsDataUrl(selectedImage.url),
              fileName: selectedImage.fileName || "pool-image.png",
              autoConvert: false,
              focusReveal: false
            }
          }, 20000);
        } else {
          await injectImageIntoArtToolInput(doc, selectedImage.url, selectedImage.fileName || "pool-image.png");
        }
        setStatus("Loaded " + (selectedImage.fileName || "pool image") + " into tool.");
      } catch (error) {
        const detail = error && error.message ? error.message : "Failed to load image into tool.";
        setStatus(detail);
      }
    });
    loadAllButton.addEventListener("click", async event => {
      event.preventDefault();
      const selectedPoolId = String(poolSelect.value || "").trim();
      const selectedPool = pools.find(pool => pool.id === selectedPoolId) || null;
      const images = selectedPool && Array.isArray(selectedPool.images) ? selectedPool.images.filter(image => image && image.url) : [];
      if (images.length === 0) {
        setStatus("Select a pool with images first.");
        return;
      }
      try {
        if (usePixelArtLoader) {
          setStatus("Pixel Art uses one source at a time. Loading the first pool image...");
          const firstImage = images[0];
          await waitForPixelArtToolReady(frameNode, 15000);
          await sendPixelArtLoadImage(frameNode, {
            source: "urage-dashboard",
            type: "pixel-art:load-image",
            requestId: getPixelArtRequestId(),
            payload: {
              url: buildAbsoluteDashboardUrl(firstImage.url),
              dataUrl: await fetchImageAsDataUrl(firstImage.url),
              fileName: firstImage.fileName || "pool-image.png",
              autoConvert: false,
              focusReveal: false
            }
          }, 20000);
          setStatus("Loaded " + (firstImage.fileName || "first pool image") + " into Pixel Art.");
          return;
        }
        setStatus("Loading " + images.length + " pool image(s) into tool input...");
        await injectUrlsAsFilesIntoToolInput(doc, images, "image/png");
        setStatus("Loaded " + images.length + " pool image(s) into tool input.");
      } catch (error) {
        const detail = error && error.message ? error.message : "Failed to load pool images into tool.";
        setStatus(detail);
      }
    });
    renderImageOptions();
  }
  function getActiveToolWorkspaceEntry() {
    const frameNode = document.getElementById("tools-workspace-frame");
    if (!frameNode) {
      return null;
    }
    const sourcePath = String(frameNode.getAttribute("src") || "").trim();
    if (!sourcePath || sourcePath === "about:blank") {
      return null;
    }
    const entries = getToolsCatalogEntries();
    return entries.find(entry => normalizeToolSourcePath(entry.sourcePath) === normalizeToolSourcePath(sourcePath)) || null;
  }
  function refreshActiveArtToolImagePoolBridge() {
    const frameNode = document.getElementById("tools-workspace-frame");
    if (!frameNode) {
      return;
    }
    const activeEntry = getActiveToolWorkspaceEntry();
    if (!activeEntry) {
      removeArtToolImagePoolBridge(frameNode);
      removeToolWorkspaceRecentBridge(frameNode);
      removeToolWorkspaceSendBridge(frameNode);
      syncToolWorkspaceFooterState(null);
      return;
    }
    syncToolWorkspaceFooterState(activeEntry);
    bindToolWorkspaceFileBridge(frameNode, activeEntry);
    mountToolWorkspaceSendBridge(frameNode, activeEntry);
    mountToolWorkspaceRecentBridge(frameNode, activeEntry);
    sendToolWorkspaceTheme(frameNode.contentWindow);
    if (isPixelArtToolSourcePath(activeEntry.sourcePath)) {
      mountArtToolImagePoolBridge(frameNode, activeEntry);
      syncToolWorkspaceFooterState(activeEntry);
      return;
    }
    if (isImageToolTargetSourcePath(activeEntry.sourcePath)) {
      if (!isGifViewerToolSourcePath(activeEntry.sourcePath)) {
        sendGenericToolImagePools(frameNode.contentWindow);
        mountArtToolImagePoolBridge(frameNode, activeEntry);
      } else {
        removeArtToolImagePoolBridge(frameNode);
      }
      if (isFloatingMediaTrayToolSourcePath(activeEntry.sourcePath)) {
        removeToolWorkspaceRecentBridge(frameNode);
      }
      syncToolWorkspaceFooterState(activeEntry);
      return;
    }
    removeArtToolImagePoolBridge(frameNode);
    if (!isThreeModelViewerToolSourcePath(activeEntry.sourcePath)) {
      removeToolWorkspaceRecentBridge(frameNode);
    }
    syncToolWorkspaceFooterState(activeEntry);
  }
  function waitForToolFrameLoad(frameNode, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!frameNode) {
        reject(new Error("Tools iframe is unavailable."));
        return;
      }
      const timeout = setTimeout(() => {
        frameNode.removeEventListener("load", onLoad);
        reject(new Error("Tool frame did not load in time."));
      }, timeoutMs);
      const onLoad = () => {
        clearTimeout(timeout);
        resolve(frameNode);
      };
      frameNode.addEventListener("load", onLoad, { once: true });
    });
  }
  function isPixelArtToolFrameReady(frameNode) {
    return !!(frameNode && String(frameNode.getAttribute("data-pixel-art-ready") || "").trim() === "1");
  }
  function setPixelArtToolFrameReady(frameNode, ready) {
    if (!frameNode) {
      return;
    }
    frameNode.setAttribute("data-pixel-art-ready", ready === true ? "1" : "0");
  }
  function flushPixelArtReadyWaiters() {
    if (pixelArtReadyWaiters.length === 0) {
      return;
    }
    for (let index = pixelArtReadyWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = pixelArtReadyWaiters[index];
      if (!waiter || !waiter.frameNode || !isPixelArtToolFrameReady(waiter.frameNode)) {
        continue;
      }
      pixelArtReadyWaiters.splice(index, 1);
      clearTimeout(waiter.timeoutId);
      waiter.resolve(waiter.frameNode);
    }
  }
  function waitForPixelArtToolReady(frameNode, timeoutMs) {
    if (!frameNode) {
      return Promise.reject(new Error("Pixel Art tool frame is unavailable."));
    }
    if (isPixelArtToolFrameReady(frameNode)) {
      return Promise.resolve(frameNode);
    }
    try {
      const frameWindow = frameNode.contentWindow;
      const frameDocument = frameNode.contentDocument;
      if (frameWindow && frameDocument && frameDocument.readyState === "complete" && frameWindow.__pixelArtToolReady === true) {
        setPixelArtToolFrameReady(frameNode, true);
        return Promise.resolve(frameNode);
      }
    } catch {}
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const waiterIndex = pixelArtReadyWaiters.findIndex(waiter => waiter && waiter.frameNode === frameNode && waiter.resolve === resolve);
        if (waiterIndex >= 0) {
          pixelArtReadyWaiters.splice(waiterIndex, 1);
        }
        reject(new Error("Pixel Art tool did not report ready in time."));
      }, timeoutMs);
      pixelArtReadyWaiters.push({ frameNode, resolve, reject, timeoutId });
    });
  }
  async function loadPixelArtToolFrameSource(frameNode, sourcePath) {
    setPixelArtToolFrameReady(frameNode, false);
    const currentSource = normalizeToolSourcePath(frameNode.getAttribute("src"));
    const nextSource = normalizeToolSourcePath(sourcePath);
    if (currentSource === nextSource) {
      const blankPromise = waitForToolFrameLoad(frameNode, 5000).catch(() => null);
      frameNode.setAttribute("src", "about:blank");
      await blankPromise;
    }
    const loadPromise = waitForToolFrameLoad(frameNode, 15000);
    frameNode.setAttribute("src", sourcePath);
    await loadPromise;
    await waitForPixelArtToolReady(frameNode, 15000);
  }
  async function ensurePixelArtToolFrame(options) {
    const button = findPixelArtToolButton();
    if (!button) {
      throw new Error("Pixel Art Converter tool was not found in the tools catalog.");
    }
    const sourcePath = String(button.getAttribute("data-tools-src") || "").trim();
    if (!sourcePath) {
      throw new Error("Pixel Art Converter tool has no source path.");
    }
    if (options && options.switchView === true) {
      switchView("tools");
      const frameNode = document.getElementById("tools-workspace-frame");
      if (!frameNode) {
        throw new Error("Tools workspace frame is unavailable.");
      }
      activateToolWorkspaceButton(button, { skipFrameLoad: true });
      const needsLoad = normalizeToolSourcePath(frameNode.getAttribute("src")) !== normalizeToolSourcePath(sourcePath);
      if (needsLoad) {
        await loadPixelArtToolFrameSource(frameNode, sourcePath);
      } else if (!isPixelArtToolFrameReady(frameNode)) {
        await loadPixelArtToolFrameSource(frameNode, sourcePath);
      }
      sendToolWorkspaceTheme(frameNode.contentWindow);
      return frameNode;
    }
    const entry = getToolsCatalogEntries().find(item => item.id === String(button.getAttribute("data-tools-tool") || "").trim()) || {
      id: String(button.getAttribute("data-tools-tool") || "pixel-art-converter").trim(),
      title: String(button.getAttribute("data-tools-title") || "Pixel Art Converter").trim(),
      sourcePath
    };
    const frameNode = getToolBackgroundFrame(entry);
    const needsLoad = normalizeToolSourcePath(frameNode.getAttribute("src")) !== normalizeToolSourcePath(sourcePath);
    if (needsLoad) {
      await loadPixelArtToolFrameSource(frameNode, sourcePath);
    } else if (!isPixelArtToolFrameReady(frameNode)) {
      await loadPixelArtToolFrameSource(frameNode, sourcePath);
    }
    sendToolWorkspaceTheme(frameNode.contentWindow);
    return frameNode;
  }
  function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image data."));
      reader.readAsDataURL(blob);
    });
  }
  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }
  async function fetchImageAsDataUrl(imageUrl) {
    const sourceUrl = String(imageUrl || "").trim();
    if (!sourceUrl) {
      throw new Error("No source image URL was provided.");
    }
    if (/^data:image\//i.test(sourceUrl)) {
      return sourceUrl;
    }
    const fetchUrl = /^blob:/i.test(sourceUrl) ? sourceUrl : buildAbsoluteDashboardUrl(sourceUrl);
    const response = await fetch(fetchUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load source image (" + response.status + ").");
    }
    return await readBlobAsDataUrl(await response.blob());
  }
  function loadImageElementFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to decode source image."));
      image.src = dataUrl;
    });
  }
  function canvasToDataUrl(canvas, mimeType) {
    return canvas.toDataURL(mimeType || "image/png");
  }
  async function createFallbackPixelArtImage(dataUrl, fileName) {
    const image = await loadImageElementFromDataUrl(dataUrl);
    const width = Math.max(1, image.naturalWidth || image.width || 1);
    const height = Math.max(1, image.naturalHeight || image.height || 1);
    const maxPixelEdge = 128;
    const pixelScale = Math.min(1, maxPixelEdge / Math.max(width, height));
    const smallWidth = Math.max(1, Math.round(width * pixelScale));
    const smallHeight = Math.max(1, Math.round(height * pixelScale));
    const smallCanvas = document.createElement("canvas");
    smallCanvas.width = smallWidth;
    smallCanvas.height = smallHeight;
    const smallContext = smallCanvas.getContext("2d");
    if (!smallContext) {
      throw new Error("Pixel art fallback canvas is unavailable.");
    }
    smallContext.imageSmoothingEnabled = false;
    smallContext.drawImage(image, 0, 0, smallWidth, smallHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Pixel art fallback output canvas is unavailable.");
    }
    context.imageSmoothingEnabled = false;
    context.drawImage(smallCanvas, 0, 0, width, height);
    return {
      dataUrl: canvasToDataUrl(canvas, "image/png"),
      fileName: fileName.replace(/\.[^.]+$/, "") + "-pixel.png",
      width,
      height
    };
  }
  async function createFallbackNormalMapImage(dataUrl, fileName) {
    const image = await loadImageElementFromDataUrl(dataUrl);
    const width = Math.max(1, image.naturalWidth || image.width || 1);
    const height = Math.max(1, image.naturalHeight || image.height || 1);
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) {
      throw new Error("Normal map fallback source canvas is unavailable.");
    }
    sourceContext.drawImage(image, 0, 0, width, height);
    const sourceData = sourceContext.getImageData(0, 0, width, height).data;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Normal map fallback output canvas is unavailable.");
    }
    const output = context.createImageData(width, height);
    const luminanceAt = (x, y) => {
      const clampedX = Math.max(0, Math.min(width - 1, x));
      const clampedY = Math.max(0, Math.min(height - 1, y));
      const index = (clampedY * width + clampedX) * 4;
      return (sourceData[index] * 0.2126 + sourceData[index + 1] * 0.7152 + sourceData[index + 2] * 0.0722) / 255;
    };
    const strength = 2.2;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = (luminanceAt(x + 1, y) - luminanceAt(x - 1, y)) * strength;
        const dy = (luminanceAt(x, y + 1) - luminanceAt(x, y - 1)) * strength;
        const length = Math.hypot(-dx, -dy, 1) || 1;
        const index = (y * width + x) * 4;
        output.data[index] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
        output.data[index + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
        output.data[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
        output.data[index + 3] = sourceData[index + 3];
      }
    }
    context.putImageData(output, 0, 0);
    return {
      dataUrl: canvasToDataUrl(canvas, "image/png"),
      fileName: fileName.replace(/\.[^.]+$/, "") + "-normal-map.png",
      width,
      height
    };
  }
  function getPixelArtRequestId() {
    return "pixel-art-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }
  async function convertImageUrlToPixelArt(options) {
    const imageUrl = String(options && options.imageUrl ? options.imageUrl : "").trim();
    const fileName = String(options && options.fileName ? options.fileName : "pixel-source.png").trim() || "pixel-source.png";
    const sourcePrompt = String(options && options.prompt ? options.prompt : "").trim();
    const sourceImageId = String(options && options.sourceImageId ? options.sourceImageId : "").trim();
    const sourceImageFileName = String(options && options.sourceImageFileName ? options.sourceImageFileName : fileName).trim();
    const variantMetadata = sourceImageId ? {
      imageVariantRole: "variant",
      imageVariantKey: "pixel-art",
      imageVariantSourceId: sourceImageId,
      imageVariantSourceFileName: sourceImageFileName
    } : undefined;
    const dataUrl = await fetchImageAsDataUrl(imageUrl);
    let converted;
    try {
      const frameNode = await ensurePixelArtToolFrame({ switchView: options && options.switchView === true });
      const requestId = getPixelArtRequestId();
      const resultPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pixelArtConversionRequests.delete(requestId);
          reject(new Error("Pixel Art conversion timed out."));
        }, 60000);
        pixelArtConversionRequests.set(requestId, {
          resolve: value => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: error => {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
      const message = {
        source: "urage-dashboard",
        type: "pixel-art:load-image",
        requestId,
        payload: {
          dataUrl,
          fileName,
          autoConvert: true
        }
      };
      const directResult = await sendPixelArtLoadImage(frameNode, message, 60000);
      if (directResult && directResult.dataUrl) {
        const pending = pixelArtConversionRequests.get(requestId);
        if (pending) {
          pixelArtConversionRequests.delete(requestId);
          pending.resolve(directResult);
        }
      }
      converted = await resultPromise;
    } catch (error) {
      console.warn("Pixel Art tool conversion failed; using dashboard fallback.", error);
      converted = await createFallbackPixelArtImage(dataUrl, fileName);
    }
    const imported = await request("/api/image-import", {
      dataUrl: converted.dataUrl,
      fileName: converted.fileName || fileName.replace(/\.[^.]+$/, "") + "-pixel.png",
      prompt: sourcePrompt ? "Pixel art conversion of: " + sourcePrompt : "Pixel art conversion",
      width: converted.width || undefined,
      height: converted.height || undefined,
      model: "Pixel Art Converter",
      metadata: variantMetadata
    });
    const frameRecords = [];
    if (Array.isArray(converted.frames) && converted.frames.length > 0) {
      for (const frame of converted.frames) {
        if (!frame || !frame.dataUrl) {
          continue;
        }
        frameRecords.push(await request("/api/image-import", {
          dataUrl: frame.dataUrl,
          fileName: frame.fileName || imported.imageFileName.replace(/\.[^.]+$/, "") + "-frame.png",
          prompt: sourcePrompt ? "Pixel art GIF frame of: " + sourcePrompt : "Pixel art GIF frame",
          width: frame.width || undefined,
          height: frame.height || undefined,
          model: "Pixel Art Converter",
          metadata: sourceImageId ? {
            ...variantMetadata,
            imageVariantRole: "variant-frame",
            imageVariantKey: "pixel-art-frame"
          } : undefined
        }));
      }
    }
    await loadImageHistory(imported.id);
    await refreshState();
    return {
      ...imported,
      pixelArtFrameRecords: frameRecords
    };
  }
  async function convertImageUrlToNormalMap(options) {
    const imageUrl = String(options && options.imageUrl ? options.imageUrl : "").trim();
    const fileName = String(options && options.fileName ? options.fileName : "normal-source.png").trim() || "normal-source.png";
    const sourcePrompt = String(options && options.prompt ? options.prompt : "").trim();
    const sourceImageId = String(options && options.sourceImageId ? options.sourceImageId : "").trim();
    const sourceImageFileName = String(options && options.sourceImageFileName ? options.sourceImageFileName : fileName).trim();
    const variantMetadata = sourceImageId ? {
      imageVariantRole: "variant",
      imageVariantKey: "normal-map",
      imageVariantSourceId: sourceImageId,
      imageVariantSourceFileName: sourceImageFileName
    } : undefined;
    const dataUrl = await fetchImageAsDataUrl(imageUrl);
    const entry = findToolEntryBySourceToken("/tools/art/normalmap-maker/");
    let frameNode = null;
    let exported;
    try {
      if (entry) {
        frameNode = options && options.switchView === true
          ? await ensureToolWorkspaceFrameForEntry(entry, { switchView: true, defaultImage: false })
          : await ensureToolBackgroundFrameForEntry(entry);
      }
      if (!frameNode) {
        throw new Error("Normal Map Maker tool is unavailable.");
      }
      await waitForToolWindowFunction(frameNode, "__urageToolLoadAssetPayload", 15_000);
      await waitForToolWindowFunction(frameNode, "__urageToolRequestExportImage", 15_000);
      const targetWindow = frameNode.contentWindow;
      sendToolWorkspaceTheme(targetWindow);
      if (targetWindow && typeof targetWindow.__urageToolLoadAssetPayload === "function") {
        await targetWindow.__urageToolLoadAssetPayload({
          kind: "image",
          dataUrl,
          fileName,
          imageFileName: fileName,
          prompt: sourcePrompt
        });
      } else {
        await injectImageIntoArtToolInput(frameNode.contentDocument, imageUrl, fileName);
      }
      await wait(180);
      exported = await requestProcessedImageFromTool(frameNode, entry, 60_000);
      if (!exported || !exported.dataUrl) {
        throw new Error("Normal Map Maker did not return an image.");
      }
    } catch (error) {
      console.warn("Normal Map Maker conversion failed; using dashboard fallback.", error);
      exported = await createFallbackNormalMapImage(dataUrl, fileName);
    } finally {
      if (frameNode && typeof frameNode.removeAttribute === "function") {
        frameNode.removeAttribute("data-suppress-default-art-image");
      }
    }
    const imported = await request("/api/image-import", {
      dataUrl: exported.dataUrl,
      fileName: exported.fileName || fileName.replace(/\.[^.]+$/, "") + "-normal-map.png",
      prompt: sourcePrompt ? "Normal map conversion of: " + sourcePrompt : "Normal map conversion",
      width: exported.width || undefined,
      height: exported.height || undefined,
      model: "Normal Map Maker",
      metadata: variantMetadata
    });
    await loadImageHistory(imported.id);
    await refreshState();
    return imported;
  }
  async function handlePixelArtToolMessage(event) {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== "pixel-art-converter") {
      return;
    }
    const pixelFrames = Array.from(document.querySelectorAll("iframe")).filter(frameNode => {
      return isPixelArtToolSourcePath(String(frameNode.getAttribute("src") || "").trim());
    });
    const pixelFrame = pixelFrames.find(frameNode => event.source === frameNode.contentWindow) || null;
    const isPixelFrameMessage = !!pixelFrame;
    if (message.type === "pixel-art:ready") {
      if (isPixelFrameMessage) {
        setPixelArtToolFrameReady(pixelFrame, true);
        flushPixelArtReadyWaiters();
        sendToolWorkspaceTheme(event.source);
      }
      return;
    }
    if (message.type === "pixel-art:request-image-pools") {
      try {
        await loadImagePools();
      } catch {}
      sendPixelArtImagePools(event.source);
      return;
    }
    const requestId = String(message.requestId || "").trim();
    const pending = requestId ? pixelArtConversionRequests.get(requestId) : null;
    if (!pending) {
      return;
    }
    pixelArtConversionRequests.delete(requestId);
    if (message.type === "pixel-art:error") {
      pending.reject(new Error(String(message.payload && message.payload.error ? message.payload.error : "Pixel Art conversion failed.")));
      return;
    }
    if (message.type === "pixel-art:converted") {
      pending.resolve(message.payload || {});
    }
  }
  function handleToolWorkspaceBridgeMessage(event) {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== "urage-tool") {
      return;
    }
    if (message.type === "tool:ready" || message.type === "tool:theme-request") {
      sendToolWorkspaceTheme(event.source);
      return;
    }
    const requestId = String(message.requestId || "").trim();
    const pending = requestId ? toolWorkspaceImageExportRequests.get(requestId) : null;
    if (!pending) {
      return;
    }
    if (pending.sourceWindow && event.source !== pending.sourceWindow) {
      return;
    }
    toolWorkspaceImageExportRequests.delete(requestId);
    window.clearTimeout(pending.timeoutId);
    if (message.type === "tool:error") {
      pending.reject(new Error(String(message.payload && message.payload.error ? message.payload.error : "Tool export failed.")));
      return;
    }
    if (message.type === "tool:export-image") {
      pending.resolve(message.payload || {});
      return;
    }
    pending.reject(new Error("Tool returned an unsupported bridge response."));
  }
  
