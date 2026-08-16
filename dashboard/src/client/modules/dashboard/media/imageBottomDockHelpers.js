function createDashboardImageBottomDockHelpers(input) {
  const getElementById = typeof input.getElementById === "function"
    ? input.getElementById
    : id => document.getElementById(id);
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);
  const queuePresenter = createDashboardGenerationQueuePresenter({
    document: {getElementById, createElement}
  });
  const groups = [{key: "prompt", label: "Prompt", getValue: entry => entry.prompt || "(no prompt)"}];
  const filters = [
    {key: "prompt", label: "Prompt", getValue: entry => entry.prompt},
    {key: "steps", label: "Steps", type: "number", getValue: entry => entry.steps},
    {key: "cfg", label: "CFG", type: "number", getValue: entry => entry.cfg},
    {key: "width", label: "Width", type: "number", getValue: entry => entry.width},
    {key: "height", label: "Height", type: "number", getValue: entry => entry.height}
  ];

  function renderFilmstrip() {
    const container = getElementById("image-bottom-filmstrip");
    if (!container) return false;
    input.detachLazyMedia(container);
    input.clearChildren(container);
    const allEntries = Array.isArray(input.state.generatedImages) ? input.state.generatedImages : [];
    input.recentMedia.renderControls("image-recent-media-controls", {
      key: "images",
      mediaContainerId: "image-bottom-filmstrip",
      groups,
      filters,
      onChange: renderFilmstrip
    });
    const filteredEntries = input.recentMedia.filterEntries(allEntries, "images", filters);
    const visibleLimit = Math.max(24, Number.parseInt(input.state.imageBottomVisibleLimit || 24, 10) || 24);
    const entries = filteredEntries.slice(0, visibleLimit);
    input.multiSelection.pruneSelection("selectedGeneratedImageIds", "selectedGeneratedImageId", allEntries);
    if (entries.length === 0) {
      const empty = createElement("div");
      empty.className = "image-dock-empty";
      empty.textContent = allEntries.length === 0 ? "No generated images yet." : "No recent images match the filter.";
      container.appendChild(empty);
      return true;
    }
    const renderItems = input.recentMedia.groupEntries(entries, "images", groups)
      .flatMap(group => [{group}, ...group.entries.map(entry => ({entry}))]);
    for (const item of renderItems) {
      if (item.group) {
        input.recentMedia.appendGroupHeading(container, item.group.label, item.group.entries.length);
        continue;
      }
      const entry = item.entry;
      const card = createElement("article");
      card.className = input.multiSelection.isSelected(
        "selectedGeneratedImageIds",
        input.state.selectedGeneratedImageId,
        entry.id
      ) ? "selected" : "";
      card.setAttribute("data-image-id", entry.id);
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.title = "Show " + entry.imageFileName + " in Image Studio preview.";
      const thumb = createElement("img");
      thumb.alt = entry.imageFileName;
      thumb.loading = "lazy";
      thumb.decoding = "async";
      input.attachLazyMedia(thumb, input.getImageUrl(entry.id, entry.imageFileName), {root: container});
      const name = createElement("strong");
      name.textContent = entry.imageFileName;
      const time = createElement("small");
      time.textContent = input.formatDateTime(entry.createdAt);
      card.append(thumb, name, time);
      const selectCard = event => {
        input.multiSelection.handleSelectionClick({
          entries,
          id: entry.id,
          selectionKey: "selectedGeneratedImageIds",
          primaryKey: "selectedGeneratedImageId",
          event
        });
        input.renderSelectedMeta();
        renderFilmstrip();
        input.scrollSelectedIntoView(entry.id);
      };
      card.addEventListener("click", event => {
        event.preventDefault();
        selectCard(event);
      });
      card.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selectCard(event);
      });
      container.appendChild(card);
    }
    if (filteredEntries.length > entries.length) {
      const moreButton = createElement("button");
      moreButton.className = "secondary image-bottom-show-more-button";
      moreButton.type = "button";
      moreButton.textContent = "Show " + Math.min(24, filteredEntries.length - entries.length) + " more";
      moreButton.addEventListener("click", event => {
        event.preventDefault();
        input.state.imageBottomVisibleLimit = entries.length + 24;
        renderFilmstrip();
      });
      container.appendChild(moreButton);
    }
    return true;
  }

  function renderQueue() {
    return Boolean(queuePresenter.render({
      containerId: "image-bottom-queue-list",
      statusKey: "imagegen",
      noun: "image",
      studioLabel: "Image Studio",
      itemClass: "image-queue-item"
    }));
  }

  function renderDock() {
    renderFilmstrip();
    renderQueue();
  }

  return {renderDock, renderFilmstrip, renderQueue};
}
