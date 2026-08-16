function createDashboardStudioSidebarFoldouts(input) {
  let refreshScheduled = false;
  let refreshRunning = false;
  let observerBound = false;

  function getSidebarId(sidebar) {
    return String(sidebar?.dataset?.sidebarId || sidebar?.id || "").trim();
  }

  function getTargets() {
    const splitTargets = Array.from(document.querySelectorAll("[data-sidebar-split-main]"));
    return splitTargets.length > 0
      ? splitTargets.concat(Array.from(document.querySelectorAll("#ask-rod-sidebar-panel")))
      : Array.from(document.querySelectorAll("#ask-rod-sidebar-panel, #image-sidebar-panel, #audio-sidebar-panel, #music-sidebar-panel, #video-sidebar-panel, #model3d-sidebar-panel"));
  }

  function getTitle(sidebarId, child) {
    if (!(child instanceof HTMLElement)) return "";
    if (child.classList.contains("studio-status") || child.querySelector(":scope > .studio-status")) return "Status";
    if (child.id === "image-sidebar-advanced-stack") return "Image Tools";
    if (child.id === "imagegen-meta-output") return "Image Metadata";
    if (child.id === "audiogen-meta-output") return "Audio Info";
    if (child.id === "musicgen-meta-output") return "Music Info";
    if (child.id === "videogen-meta-output") return "Video Info";
    if (child.classList.contains("studio-inspector-tabs")) return "Inspector";
    if (child.classList.contains("image-history-search")) return "History Search";
    if (child.classList.contains("model3d-inspector-section")) {
      const sectionTitle = child.querySelector(":scope > .model3d-inspector-section-head span");
      if (sectionTitle instanceof HTMLElement) return String(sectionTitle.textContent || "").trim();
      const sectionSiblings = Array.from(child.parentElement?.children || []).filter(node => node instanceof HTMLElement && node.classList.contains("model3d-inspector-section"));
      const sectionIndex = sectionSiblings.indexOf(child);
      const sectionFallbacks = ["Transform", "Mesh", "Materials", "UV & Textures"];
      if (sectionFallbacks[sectionIndex]) return sectionFallbacks[sectionIndex];
    }
    if (sidebarId === "model3d-sidebar-panel" && child.classList.contains("model3d-side-card")) {
      if (child.querySelector(":scope #model3d-variant-gallery")) return "Model Variants";
      if (child.querySelector(":scope #model3d-texture-gallery")) return "Texture Outputs";
      const cardTitle = child.querySelector(":scope > .model3d-side-card-head label, :scope > label, :scope .studio-status-caption, :scope .studio-status-head strong");
      if (cardTitle instanceof HTMLElement) return String(cardTitle.textContent || "").trim();
    }
    if (child.classList.contains("image-side-card")) {
      if (child.querySelector(":scope #image-variant-gallery")) return "Image Variants";
      const cardTitle = child.querySelector(":scope > .image-side-card-head label, :scope > label");
      if (cardTitle instanceof HTMLElement) return String(cardTitle.textContent || "").trim();
    }
    const directLabel = child.querySelector(":scope > label");
    if (directLabel instanceof HTMLElement) return String(directLabel.textContent || "").trim();
    const directStrong = child.querySelector(":scope > strong");
    if (directStrong instanceof HTMLElement) return String(directStrong.textContent || "").trim();
    if (sidebarId === "ask-rod-sidebar-panel" && child.classList.contains("field")) {
      const askTitle = child.querySelector(":scope > label, :scope > strong, :scope .section-label");
      if (askTitle instanceof HTMLElement) return String(askTitle.textContent || "").trim();
    }
    if (sidebarId === "audio-sidebar-panel" && child.classList.contains("audio-preview-card")) return "Latest Preview";
    if (sidebarId === "music-sidebar-panel" && child.classList.contains("music-side-card")) return "Latest Preview";
    if (sidebarId === "video-sidebar-panel" && child.classList.contains("video-queue-panel")) return "Generation Queue";
    return "";
  }

  function shouldSkip(child) {
    if (!(child instanceof HTMLElement)) return true;
    if (child.classList.contains("model3d-gif-export-modal")) return true;
    if (child.classList.contains("studio-sidebar-preview-source-hidden")) return true;
    return child.id === "model3d-autorig-verification-card" && child.classList.contains("hidden");
  }

  function markRepeatedHeading(child) {
    if (!(child instanceof HTMLElement)) return;
    child.querySelectorAll(":scope > label, :scope > strong").forEach(node => {
      if (node instanceof HTMLElement) node.classList.add("studio-side-foldout-repeated-heading");
    });
  }

  function isInitiallyOpen(sidebarId, title) {
    if (title === "Status") return true;
    if (sidebarId === "ask-rod-sidebar-panel") return title === "Images" || title === "Models";
    if (sidebarId === "image-sidebar-panel") return title === "Inspector" || title === "History Search";
    if (sidebarId === "audio-sidebar-panel" || sidebarId === "music-sidebar-panel") return title === "Latest Preview";
    if (sidebarId === "video-sidebar-panel") return title === "Latest Images" || title === "Video Info";
    if (sidebarId === "model3d-sidebar-panel") return title === "Model Preview" || title === "Model Variants" || title === "Status";
    return false;
  }

  function syncLayout(sidebar) {
    if (!(sidebar instanceof HTMLElement)) return;
    const foldouts = Array.from(sidebar.querySelectorAll(":scope > .studio-side-foldout"));
    let lastExpandedIndex = -1;
    foldouts.forEach((foldout, index) => {
      if (foldout instanceof HTMLDetailsElement && foldout.open) lastExpandedIndex = index;
    });
    foldouts.forEach((foldout, index) => {
      const isOpen = foldout instanceof HTMLDetailsElement && foldout.open;
      const isBottomStack = lastExpandedIndex >= 0 && index > lastExpandedIndex && !isOpen;
      const previousFoldout = index > 0 ? foldouts[index - 1] : null;
      const isBottomStackStart = isBottomStack && !(previousFoldout instanceof HTMLElement && previousFoldout.classList.contains("is-bottom-stack"));
      foldout.classList.toggle("is-last-expanded", isOpen && index === lastExpandedIndex);
      foldout.classList.toggle("is-bottom-stack", isBottomStack);
      foldout.classList.toggle("is-bottom-stack-start", isBottomStackStart);
    });
  }

  function unwrap(sidebar) {
    if (!(sidebar instanceof HTMLElement)) return;
    Array.from(sidebar.querySelectorAll(":scope > .studio-side-foldout[data-sidebar-foldout-generated='true']")).forEach(foldout => {
      const content = foldout.querySelector(":scope > .studio-side-foldout-content");
      if (!(content instanceof HTMLElement)) return;
      Array.from(content.children).forEach(child => {
        if (child instanceof HTMLElement) delete child.dataset.sidebarFoldoutWrapped;
        sidebar.insertBefore(child, foldout);
      });
      foldout.remove();
    });
  }

  function wrap(sidebar) {
    if (!(sidebar instanceof HTMLElement)) return;
    const openStateByTitle = new Map(Array.from(sidebar.querySelectorAll(":scope > .studio-side-foldout")).map(foldout => {
      const title = String(foldout.querySelector(":scope > summary")?.textContent || "").trim();
      return [title, foldout instanceof HTMLDetailsElement && foldout.open];
    }).filter(entry => entry[0]));
    unwrap(sidebar);
    Array.from(sidebar.children).forEach(child => {
      if (!(child instanceof HTMLElement) || shouldSkip(child)) return;
      if (child.classList.contains("studio-side-foldout")) {
        if (child.dataset.sidebarFoldoutToggleBound !== "true") {
          child.dataset.sidebarFoldoutToggleBound = "true";
          child.addEventListener("toggle", () => syncLayout(sidebar));
        }
        return;
      }
      const sidebarId = getSidebarId(sidebar);
      const title = getTitle(sidebarId, child);
      if (!title) return;
      markRepeatedHeading(child);
      child.dataset.sidebarFoldoutWrapped = "1";
      const foldout = document.createElement("details");
      foldout.className = "studio-side-foldout";
      foldout.dataset.sidebarFoldoutGenerated = "true";
      foldout.open = openStateByTitle.has(title) ? openStateByTitle.get(title) === true : isInitiallyOpen(sidebarId, title);
      const summary = document.createElement("summary");
      summary.textContent = title;
      const content = document.createElement("div");
      content.className = "studio-side-foldout-content";
      sidebar.insertBefore(foldout, child);
      content.appendChild(child);
      foldout.append(summary, content);
      foldout.addEventListener("toggle", () => syncLayout(sidebar));
    });
    syncLayout(sidebar);
  }

  function initialize() {
    input.setupSplitPanes();
    getTargets().forEach(wrap);
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(() => {
      refreshScheduled = false;
      refreshRunning = true;
      try {
        initialize();
      } finally {
        refreshRunning = false;
      }
    });
  }

  function bindRefreshObserver() {
    if (observerBound || !document.body || typeof MutationObserver !== "function") return;
    observerBound = true;
    const sidebarSelector = "#ask-rod-sidebar-panel, #image-sidebar-panel, #audio-sidebar-panel, #music-sidebar-panel, #video-sidebar-panel, #model3d-sidebar-panel, [data-sidebar-split-main]";
    const touchesSidebar = node => node instanceof HTMLElement && (node.matches(sidebarSelector) || Boolean(node.querySelector(sidebarSelector)));
    const observer = new MutationObserver(mutations => {
      if (refreshRunning) return;
      const shouldRefresh = mutations.some(mutation => {
        if (mutation.type === "attributes") return mutation.target !== document.body && touchesSidebar(mutation.target);
        return Array.from(mutation.addedNodes).some(touchesSidebar);
      });
      if (shouldRefresh) scheduleRefresh();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-studio-sidebar-relocated"] });
  }

  function start() {
    bindRefreshObserver();
    initialize();
    scheduleRefresh();
    [120, 420, 1000].forEach(delay => window.setTimeout(scheduleRefresh, delay));
  }

  return { getTitle, isInitiallyOpen, start, wrap };
}
