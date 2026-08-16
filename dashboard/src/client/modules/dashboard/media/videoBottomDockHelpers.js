function createDashboardVideoBottomDockHelpers(input) {
  const getElementById = typeof input.getElementById === "function"
    ? input.getElementById
    : id => document.getElementById(id);
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);
  const queuePresenter = createDashboardGenerationQueuePresenter({
    document: {getElementById, createElement}
  });
  const groups = [
    {key: "prompt", label: "Prompt", getValue: entry => entry.prompt || "(no prompt)"},
    {
      key: "image",
      label: "Image",
      getValue: entry => entry.sourceImageFileName
        || entry.imageFileName
        || entry.metadata?.sourceImageFileName
        || entry.metadata?.imageFileNameHint
        || "(no source image)"
    }
  ];
  const filters = [
    {key: "prompt", label: "Prompt", getValue: entry => entry.prompt},
    {
      key: "image",
      label: "Image",
      getValue: entry => entry.sourceImageFileName
        || entry.imageFileName
        || entry.metadata?.sourceImageFileName
        || entry.metadata?.imageFileNameHint
    },
    {key: "steps", label: "Steps", type: "number", getValue: entry => entry.steps},
    {key: "cfg", label: "CFG", type: "number", getValue: entry => entry.cfg},
    {key: "width", label: "Width", type: "number", getValue: entry => entry.width},
    {key: "height", label: "Height", type: "number", getValue: entry => entry.height}
  ];

  function getDurationLabel(entry) {
    const frames = Number.parseInt(String(entry?.frames || entry?.length || ""), 10);
    const fps = Number.parseInt(String(entry?.fps || ""), 10);
    if (Number.isFinite(frames) && frames > 0 && Number.isFinite(fps) && fps > 0) {
      return Math.max(1, Math.round(frames / fps)) + "s";
    }
    const seconds = Number.parseInt(String(entry?.durationSeconds || entry?.seconds || ""), 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds + "s" : "Video";
  }

  function renderFilmstrip() {
    const container = getElementById("video-bottom-filmstrip");
    if (!container) return false;
    input.unobserveMedia(container);
    input.clearChildren(container);
    const allEntries = Array.isArray(input.state.generatedVideos) ? input.state.generatedVideos : [];
    input.recentMedia.renderControls("video-recent-media-controls", {
      key: "videos",
      mediaContainerId: "video-bottom-filmstrip",
      groups,
      filters,
      onChange: renderFilmstrip
    });
    const entries = input.recentMedia.filterEntries(allEntries, "videos", filters).slice(0, 24);
    input.multiSelection.pruneSelection("selectedGeneratedVideoIds", "selectedGeneratedVideoId", allEntries);
    if (entries.length === 0) {
      const empty = createElement("div");
      empty.className = "video-dock-empty";
      empty.textContent = allEntries.length === 0 ? "No generated videos yet." : "No recent videos match the filter.";
      container.appendChild(empty);
      return true;
    }
    const renderItems = input.recentMedia.groupEntries(entries, "videos", groups)
      .flatMap(group => [{group}, ...group.entries.map(entry => ({entry}))]);
    for (const item of renderItems) {
      if (item.group) {
        input.recentMedia.appendGroupHeading(container, item.group.label, item.group.entries.length);
        continue;
      }
      const entry = item.entry;
      const card = createElement("article");
      card.className = input.multiSelection.isSelected(
        "selectedGeneratedVideoIds",
        input.state.selectedGeneratedVideoId,
        entry.id
      ) ? "selected" : "";
      card.title = "Show " + entry.videoFileName + " in Video Studio preview.";
      card.setAttribute("data-video-id", entry.id);
      const thumb = createElement("video");
      thumb.className = "video-filmstrip-thumb";
      thumb.dataset.src = input.getVideoUrl(entry.id, entry.videoFileName);
      const lazyObserver = input.getLazyObserver();
      if (!lazyObserver) thumb.src = thumb.dataset.src;
      thumb.muted = true;
      thumb.playsInline = true;
      thumb.preload = "metadata";
      thumb.dataset.lazyUnload = "true";
      thumb.setAttribute("aria-hidden", "true");
      lazyObserver?.observe(thumb);
      const name = createElement("strong");
      name.textContent = entry.videoFileName;
      const time = createElement("small");
      time.textContent = getDurationLabel(entry) + " - " + input.formatDateTime(entry.createdAt);
      card.append(thumb, name, time);
      card.addEventListener("click", event => {
        input.multiSelection.handleSelectionClick({
          entries,
          id: entry.id,
          selectionKey: "selectedGeneratedVideoIds",
          primaryKey: "selectedGeneratedVideoId",
          event
        });
        input.renderHistory();
      });
      container.appendChild(card);
    }
    return true;
  }

  function renderQueue() {
    return Boolean(queuePresenter.render({
      containerId: "video-bottom-queue-list",
      statusKey: "videogen",
      noun: "video",
      studioLabel: "Video Studio",
      itemClass: "video-queue-item"
    }));
  }

  function renderDock() {
    renderFilmstrip();
    renderQueue();
  }

  return {getDurationLabel, renderDock, renderFilmstrip, renderQueue};
}
