function createDashboardStudioSidebarSplitLayout(input) {
  const escapeHtml = input.escapeHtml;
  const studioSidebarSplitConfigs = [
    { key: "model3d", sidebarId: "model3d-sidebar-panel", previewKind: "image", previewImageId: "model3d-preview-media", metaId: "model3d-meta-output", metaWrapperSelector: ".model3d-meta-card", previewTitle: "Preview", metaTitle: "Meta" },
    { key: "image", sidebarId: "image-sidebar-panel", previewKind: "image-dynamic", previewImageId: "imagegen-preview", previewVideoId: "imagegen-preview-video", metaId: "imagegen-meta-output", previewTitle: "Preview", metaTitle: "Meta" },
    { key: "audio", sidebarId: "audio-sidebar-panel", previewKind: "audio", previewAudioId: "audiogen-preview", metaId: "audiogen-meta-output", previewTitle: "Preview", metaTitle: "Meta" },
    { key: "music", sidebarId: "music-sidebar-panel", previewKind: "audio", previewAudioId: "musicgen-preview", metaId: "musicgen-meta-output", previewTitle: "Preview", metaTitle: "Meta" },
    { key: "video", sidebarId: "video-sidebar-panel", previewKind: "video", previewVideoId: "videogen-preview", metaId: "videogen-meta-output", previewTitle: "Preview", metaTitle: "Meta" }
  ];
  function getStudioSidebarSplitHeightStorageKey(key) {
    return "urage-studio-sidebar-bottom-height-" + key;
  }
  function readStudioSidebarSplitHeight(key) {
    try {
      const value = Number.parseInt(localStorage.getItem(getStudioSidebarSplitHeightStorageKey(key)) || "", 10);
      return Number.isFinite(value) && value > 0 ? value : 220;
    } catch {
      return 220;
    }
  }
  function writeStudioSidebarSplitHeight(key, value) {
    try {
      localStorage.setItem(getStudioSidebarSplitHeightStorageKey(key), String(Math.round(value)));
    } catch {}
  }
  function setStudioSidebarBottomTab(shell, tabName) {
    const activeTab = tabName === "meta" ? "meta" : "preview";
    shell.querySelectorAll("[data-sidebar-bottom-tab]").forEach(button => {
      const isActive = button.getAttribute("data-sidebar-bottom-tab") === activeTab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    shell.querySelectorAll("[data-sidebar-bottom-panel]").forEach(panel => {
      panel.classList.toggle("hidden", panel.getAttribute("data-sidebar-bottom-panel") !== activeTab);
    });
  }
  function bindStudioSidebarSplitResizer(handle, shell, key) {
    if (!(handle instanceof HTMLElement) || handle.dataset.sidebarSplitBound === "true") {
      return;
    }
    handle.dataset.sidebarSplitBound = "true";
    handle.addEventListener("pointerdown", event => {
      const pointerId = event.pointerId;
      const bottom = shell.querySelector(":scope > .studio-sidebar-split-bottom");
      if (!(bottom instanceof HTMLElement)) {
        return;
      }
      const updateHeight = clientY => {
        const rect = shell.getBoundingClientRect();
        const min = 140;
        const max = Math.max(min, Math.round(rect.height * 0.68));
        const nextHeight = Math.max(min, Math.min(max, rect.bottom - Number(clientY)));
        shell.style.setProperty("--studio-sidebar-bottom-height", nextHeight + "px");
        writeStudioSidebarSplitHeight(key, nextHeight);
      };
      event.preventDefault();
      handle.classList.add("is-dragging");
      document.body.classList.add("studio-sidebar-split-resizing");
      handle.setPointerCapture?.(pointerId);
      updateHeight(event.clientY);
      const onPointerMove = moveEvent => {
        if (moveEvent.pointerId === pointerId) updateHeight(moveEvent.clientY);
      };
      const stopResize = endEvent => {
        if (endEvent.pointerId !== pointerId) return;
        handle.classList.remove("is-dragging");
        document.body.classList.remove("studio-sidebar-split-resizing");
        handle.releasePointerCapture?.(pointerId);
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", stopResize);
        document.removeEventListener("pointercancel", stopResize);
      };
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", stopResize);
      document.addEventListener("pointercancel", stopResize);
    });
  }
  function getStudioSidebarPreviewSourceUrl(node) {
    return node instanceof HTMLMediaElement || node instanceof HTMLImageElement
      ? String(node.currentSrc || node.getAttribute("src") || "").trim()
      : "";
  }
  function bindStudioSidebarMediaPreview(panel, config) {
    const empty = document.createElement("div");
    empty.className = "studio-sidebar-preview-empty";
    empty.textContent = "No media selected.";
    const image = document.createElement("img");
    image.className = "studio-sidebar-preview-media hidden";
    image.alt = config.key === "model3d" ? "Generated model rotating preview" : "Generated image preview";
    const video = document.createElement("video");
    video.className = "studio-sidebar-preview-media hidden";
    video.controls = true;
    video.playsInline = true;
    video.muted = config.key === "image";
    const audio = document.createElement("audio");
    audio.className = "studio-sidebar-preview-media hidden";
    audio.controls = true;
    panel.append(empty, image, video, audio);
    const sourceImage = config.previewImageId ? document.getElementById(config.previewImageId) : null;
    const sourceVideo = config.previewVideoId ? document.getElementById(config.previewVideoId) : null;
    const sourceAudio = config.previewAudioId ? document.getElementById(config.previewAudioId) : null;
    if (config.key === "model3d") {
      sourceImage?.closest(".model3d-side-card")?.classList.add("studio-sidebar-preview-source-hidden");
    }
    const setMediaSource = (node, sourceUrl) => {
      if (node.getAttribute("src") !== sourceUrl) {
        if (sourceUrl) node.setAttribute("src", sourceUrl);
        else node.removeAttribute("src");
      }
    };
    const sync = () => {
      const sourceVideoUrl = getStudioSidebarPreviewSourceUrl(sourceVideo);
      const sourceImageUrl = getStudioSidebarPreviewSourceUrl(sourceImage);
      const sourceAudioUrl = getStudioSidebarPreviewSourceUrl(sourceAudio);
      const useVideo = Boolean(sourceVideoUrl && (config.previewKind === "video" || !sourceVideo?.classList.contains("hidden")));
      const useAudio = Boolean(sourceAudioUrl);
      const useImage = Boolean(sourceImageUrl && !useVideo && !useAudio);
      setMediaSource(image, useImage ? sourceImageUrl : "");
      setMediaSource(video, useVideo ? sourceVideoUrl : "");
      setMediaSource(audio, useAudio ? sourceAudioUrl : "");
      image.classList.toggle("hidden", !useImage);
      video.classList.toggle("hidden", !useVideo);
      audio.classList.toggle("hidden", !useAudio);
      empty.classList.toggle("hidden", useImage || useVideo || useAudio);
    };
    const observer = new MutationObserver(sync);
    [sourceImage, sourceVideo, sourceAudio].forEach(node => {
      if (!node) return;
      observer.observe(node, { attributes: true, childList: true, subtree: true, attributeFilter: ["src", "class"] });
      ["load", "loadedmetadata", "emptied"].forEach(eventName => node.addEventListener(eventName, sync));
    });
    sync();
  }
  function bindStudioSidebarMetaPanel(metaNode) {
    if (!(metaNode instanceof HTMLElement) || metaNode.dataset.sidebarMetaBound === "true") {
      return;
    }
    metaNode.dataset.sidebarMetaBound = "true";
    const generatedClasses = ["studio-sidebar-meta-grid", "studio-sidebar-meta-note"];
    const hasOnlyGeneratedChildren = () => {
      const children = Array.from(metaNode.children);
      return children.length > 0 && children.every(child => child instanceof HTMLElement && generatedClasses.some(name => child.classList.contains(name)));
    };
    const readRawText = () => {
      if (hasOnlyGeneratedChildren()) {
        return String(metaNode.dataset.sidebarMetaRaw || "").trim();
      }
      return String(metaNode.textContent || "").trim();
    };
    const render = () => {
      if (metaNode.dataset.sidebarMetaRendering === "true") {
        return;
      }
      const hasForeignChildren = Array.from(metaNode.children).some(child => child instanceof HTMLElement && !generatedClasses.some(name => child.classList.contains(name)));
      if (hasForeignChildren) {
        metaNode.classList.remove("studio-sidebar-meta-output");
        return;
      }
      const rawText = readRawText();
      if (!rawText) {
        metaNode.dataset.sidebarMetaRaw = "";
        metaNode.classList.remove("studio-sidebar-meta-output");
        metaNode.textContent = "";
        return;
      }
      const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        metaNode.dataset.sidebarMetaRaw = "";
        metaNode.classList.remove("studio-sidebar-meta-output");
        metaNode.textContent = "";
        return;
      }
      const looksStructured = lines.some(line => line.includes(":"));
      const nextSignature = rawText + "|" + (looksStructured ? "structured" : "note");
      if (metaNode.dataset.sidebarMetaSignature === nextSignature && hasOnlyGeneratedChildren()) {
        metaNode.classList.add("studio-sidebar-meta-output");
        return;
      }
      metaNode.dataset.sidebarMetaRaw = rawText;
      metaNode.dataset.sidebarMetaRendering = "true";
      metaNode.dataset.sidebarMetaSignature = nextSignature;
      metaNode.classList.add("studio-sidebar-meta-output");
      if (!looksStructured) {
        metaNode.innerHTML = "<div class=\"studio-sidebar-meta-note\">" + escapeHtml(lines.join("\n")) + "</div>";
        metaNode.dataset.sidebarMetaRendering = "false";
        return;
      }
      metaNode.innerHTML = "<div class=\"studio-sidebar-meta-grid\">"
        + lines.map(line => {
          const colonIndex = line.indexOf(":");
          if (colonIndex === -1) {
            return "<div class=\"studio-sidebar-meta-row is-full\"><span class=\"studio-sidebar-meta-value\">"
              + escapeHtml(line)
              + "</span></div>";
          }
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim() || "none";
          return "<div class=\"studio-sidebar-meta-row\">"
            + "<span class=\"studio-sidebar-meta-key\">" + escapeHtml(key) + "</span>"
            + "<span class=\"studio-sidebar-meta-value\">" + escapeHtml(value) + "</span>"
            + "</div>";
        }).join("")
        + "</div>";
      metaNode.dataset.sidebarMetaRendering = "false";
    };
    const observer = new MutationObserver(() => {
      if (metaNode.dataset.sidebarMetaRendering === "true") {
        return;
      }
      render();
    });
    observer.observe(metaNode, { childList: true, characterData: true, subtree: true });
    render();
  }
  function syncExistingStudioSidebarSplitPane(config, sidebar) {
    const shell = sidebar.querySelector(":scope > .studio-sidebar-split-shell");
    if (!(shell instanceof HTMLElement)) {
      return false;
    }
    const main = shell.querySelector(":scope > .studio-sidebar-split-main");
    const previewPanel = shell.querySelector(":scope > .studio-sidebar-split-bottom > [data-sidebar-bottom-panel='preview']");
    const metaPanel = shell.querySelector(":scope > .studio-sidebar-split-bottom > [data-sidebar-bottom-panel='meta']");
    if (!(main instanceof HTMLElement) || !(previewPanel instanceof HTMLElement) || !(metaPanel instanceof HTMLElement)) {
      return true;
    }
    const metaNode = document.getElementById(config.metaId);
    const metaWrapper = metaNode instanceof HTMLElement && config.metaWrapperSelector ? metaNode.closest(config.metaWrapperSelector) : null;
    const previewSourceNode = config.previewImageId ? document.getElementById(config.previewImageId) : null;
    const previewSourceCard = config.key === "model3d" ? previewSourceNode?.closest(".model3d-side-card") : null;
    Array.from(sidebar.children).forEach(child => {
      if (!(child instanceof HTMLElement) || child === shell) {
        return;
      }
      if (previewSourceCard instanceof HTMLElement && child === previewSourceCard) {
        previewSourceCard.classList.add("studio-sidebar-preview-source-card");
        previewPanel.appendChild(previewSourceCard);
        return;
      }
      if (child !== metaNode && child !== metaWrapper) {
        main.appendChild(child);
      }
    });
    if (metaNode instanceof HTMLElement && metaNode.parentElement !== metaPanel) {
      metaPanel.appendChild(metaNode);
    }
    if (metaWrapper instanceof HTMLElement && metaWrapper.parentElement === sidebar) {
      metaWrapper.remove();
    }
    metaNode?.classList?.add("studio-sidebar-info-panel");
    bindStudioSidebarMetaPanel(metaNode);
    return true;
  }
  function setupStudioSidebarSplitPane(config) {
    const sidebar = document.getElementById(config.sidebarId);
    if (!(sidebar instanceof HTMLElement)) {
      return;
    }
    if (syncExistingStudioSidebarSplitPane(config, sidebar)) {
      return;
    }
    const metaNode = document.getElementById(config.metaId);
    const metaWrapper = metaNode instanceof HTMLElement && config.metaWrapperSelector ? metaNode.closest(config.metaWrapperSelector) : null;
    const previewSourceNode = config.previewImageId ? document.getElementById(config.previewImageId) : null;
    const previewSourceCard = config.key === "model3d" ? previewSourceNode?.closest(".model3d-side-card") : null;
    const shell = document.createElement("div");
    shell.className = "studio-sidebar-split-shell";
    shell.dataset.sidebarSplitShell = config.key;
    shell.style.setProperty("--studio-sidebar-bottom-height", readStudioSidebarSplitHeight(config.key) + "px");
    const main = document.createElement("div");
    main.className = "studio-sidebar-split-main";
    main.dataset.sidebarSplitMain = config.key;
    main.dataset.sidebarId = config.sidebarId;
    const resizer = document.createElement("div");
    resizer.className = "studio-sidebar-split-resizer";
    resizer.dataset.sidebarSplitResizer = config.key;
    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "horizontal");
    resizer.setAttribute("title", "Drag to resize Preview/Meta pane");
    const bottom = document.createElement("div");
    bottom.className = "studio-sidebar-split-bottom";
    const tabs = document.createElement("div");
    tabs.className = "studio-tabs studio-sidebar-bottom-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Sidebar bottom pane");
    const previewTab = document.createElement("button");
    previewTab.className = "active";
    previewTab.type = "button";
    previewTab.textContent = config.previewTitle;
    previewTab.dataset.sidebarBottomTab = "preview";
    previewTab.setAttribute("aria-selected", "true");
    const metaTab = document.createElement("button");
    metaTab.type = "button";
    metaTab.textContent = config.metaTitle;
    metaTab.dataset.sidebarBottomTab = "meta";
    metaTab.setAttribute("aria-selected", "false");
    tabs.append(previewTab, metaTab);
    const previewPanel = document.createElement("div");
    previewPanel.className = "studio-sidebar-bottom-panel studio-sidebar-preview-panel";
    previewPanel.dataset.sidebarBottomPanel = "preview";
    const metaPanel = document.createElement("div");
    metaPanel.className = "studio-sidebar-bottom-panel hidden";
    metaPanel.dataset.sidebarBottomPanel = "meta";
    Array.from(sidebar.children).forEach(child => {
      if (previewSourceCard instanceof HTMLElement && child === previewSourceCard) {
        return;
      }
      if (child !== metaNode && child !== metaWrapper) main.appendChild(child);
    });
    if (previewSourceCard instanceof HTMLElement) {
      previewSourceCard.classList.add("studio-sidebar-preview-source-card");
      previewPanel.appendChild(previewSourceCard);
    } else {
      bindStudioSidebarMediaPreview(previewPanel, config);
    }
    if (metaNode instanceof HTMLElement) metaPanel.appendChild(metaNode);
    if (metaWrapper instanceof HTMLElement && metaWrapper.parentElement === sidebar) metaWrapper.remove();
    metaNode?.classList?.add("studio-sidebar-info-panel");
    bindStudioSidebarMetaPanel(metaNode);
    bottom.append(tabs, previewPanel, metaPanel);
    shell.append(main, resizer, bottom);
    sidebar.appendChild(shell);
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    previewTab.addEventListener("click", () => setStudioSidebarBottomTab(shell, "preview"));
    metaTab.addEventListener("click", () => setStudioSidebarBottomTab(shell, "meta"));
    bindStudioSidebarSplitResizer(resizer, shell, config.key);
  }
  function setupStudioSidebarSplitPanes() {
    studioSidebarSplitConfigs.forEach(setupStudioSidebarSplitPane);
  }

  return {
    readHeight: readStudioSidebarSplitHeight,
    setBottomTab: setStudioSidebarBottomTab,
    setup: setupStudioSidebarSplitPanes
  };
}
