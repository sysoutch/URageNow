function createDashboardVideoHistoryViewHelpers(input) {
  const getContainer = typeof input.getContainer === "function"
    ? input.getContainer
    : () => document.getElementById("videogen-history-list");
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);
  const initialLimit = Number.isFinite(input.initialLimit) ? input.initialLimit : 48;

  function render() {
    const container = getContainer();
    if (!container) {
      input.onContainerMissing();
      return false;
    }
    input.unobserveMedia(container);
    input.clearChildren(container);
    const allEntries = Array.isArray(input.state.generatedVideos) ? input.state.generatedVideos : [];
    input.multiSelection.pruneSelection("selectedGeneratedVideoIds", "selectedGeneratedVideoId", allEntries);
    if (allEntries.length === 0) {
      const empty = createElement("div");
      empty.className = "item";
      empty.textContent = "No generated videos yet.";
      container.appendChild(empty);
      input.onEmpty();
      return true;
    }
    const selectedEntries = input.getSelectedMany();
    if (selectedEntries.length > 1) {
      const bulkActions = createElement("div");
      bulkActions.className = "media-history-bulk-actions";
      const deleteSelectedButton = createElement("button");
      deleteSelectedButton.className = "secondary danger";
      deleteSelectedButton.type = "button";
      deleteSelectedButton.textContent = "Delete " + selectedEntries.length + " Selected";
      deleteSelectedButton.addEventListener("click", () => {
        void input.onDelete(selectedEntries);
      });
      bulkActions.appendChild(deleteSelectedButton);
      container.appendChild(bulkActions);
    }
    const visibleLimit = Math.max(
      initialLimit,
      Number.parseInt(input.state.videoHistoryVisibleLimit || initialLimit, 10) || initialLimit
    );
    const entries = allEntries.slice(0, visibleLimit);
    for (const entry of entries) {
      const rowWrap = createElement("div");
      rowWrap.className = "media-history-row-wrap";
      const rowInner = createElement("div");
      rowInner.className = "media-history-row";
      const row = createElement("button");
      row.className = "channel-row" + (input.multiSelection.isSelected(
        "selectedGeneratedVideoIds",
        input.state.selectedGeneratedVideoId,
        entry.id
      ) ? " active" : "");
      row.setAttribute("data-video-id", entry.id);
      const thumb = createElement("video");
      thumb.className = "media-history-thumb media-history-video-thumb";
      thumb.dataset.src = input.getVideoUrl(entry.id, entry.videoFileName);
      const lazyObserver = input.getLazyObserver();
      if (!lazyObserver) thumb.src = thumb.dataset.src;
      thumb.muted = true;
      thumb.playsInline = true;
      thumb.preload = "metadata";
      thumb.dataset.lazyUnload = "true";
      thumb.setAttribute("aria-hidden", "true");
      lazyObserver?.observe(thumb);
      const main = createElement("span");
      main.className = "channel-row-main";
      const name = createElement("span");
      name.className = "channel-row-name";
      name.textContent = entry.videoFileName;
      const time = createElement("span");
      time.className = "channel-row-kind";
      time.textContent = input.formatDateTime(entry.createdAt);
      main.append(name, time);
      row.append(thumb, main);
      row.addEventListener("click", event => {
        input.multiSelection.handleSelectionClick({
          entries: allEntries,
          id: entry.id,
          selectionKey: "selectedGeneratedVideoIds",
          primaryKey: "selectedGeneratedVideoId",
          event
        });
        input.onSelected(entry);
      });
      const removeButton = createElement("button");
      removeButton.className = "secondary media-history-action-button danger";
      removeButton.type = "button";
      removeButton.innerHTML = "<span class='media-history-action-icon' aria-hidden='true'>&#10005;</span>";
      removeButton.title = "Delete video";
      removeButton.setAttribute("aria-label", "Delete generated video " + entry.videoFileName);
      removeButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await input.onDelete([entry]);
      });
      const actionWrap = createElement("div");
      actionWrap.className = "media-history-actions";
      actionWrap.appendChild(removeButton);
      rowInner.append(row, actionWrap);
      rowWrap.appendChild(rowInner);
      container.appendChild(rowWrap);
    }
    if (allEntries.length > entries.length) {
      const moreButton = createElement("button");
      moreButton.className = "secondary";
      moreButton.type = "button";
      moreButton.textContent = "Show " + Math.min(initialLimit, allEntries.length - entries.length) + " more videos";
      moreButton.addEventListener("click", () => {
        input.state.videoHistoryVisibleLimit = entries.length + initialLimit;
        render();
      });
      container.appendChild(moreButton);
    }
    input.onRendered();
    return true;
  }

  return {render};
}
