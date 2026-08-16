function createDashboardImageHistoryViewHelpers(input) {
  const getContainer = typeof input.getContainer === "function"
    ? input.getContainer
    : () => document.getElementById("imagegen-history-list");
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);
  const initialLimit = Number.isFinite(input.initialLimit) ? input.initialLimit : 80;

  function renderSurrounding(record) {
    input.renderMeta(record);
    input.renderRelated();
  }

  function createActionButton(entry, options) {
    const button = createElement("button");
    button.className = "secondary media-history-action-button" + (options.danger ? " danger" : "");
    button.type = "button";
    button.innerHTML = options.html;
    button.title = options.title;
    button.setAttribute("aria-label", options.ariaLabel + " " + entry.imageFileName);
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      await options.action(entry);
    });
    return button;
  }

  function render() {
    const container = getContainer();
    if (!container) {
      renderSurrounding(input.getSelected());
      return false;
    }
    input.unobserveMedia(container);
    input.clearChildren(container);
    const allEntries = Array.isArray(input.state.generatedImages) ? input.state.generatedImages : [];
    if (allEntries.length === 0) {
      const empty = createElement("div");
      empty.className = "item";
      empty.textContent = "No generated images yet.";
      container.appendChild(empty);
      renderSurrounding(null);
      return true;
    }
    const visibleLimit = Math.max(
      initialLimit,
      Number.parseInt(input.state.imageHistoryVisibleLimit || initialLimit, 10) || initialLimit
    );
    const entries = allEntries.slice(0, visibleLimit);
    input.multiSelection.pruneSelection("selectedGeneratedImageIds", "selectedGeneratedImageId", allEntries);
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
      const addToPoolButton = createElement("button");
      addToPoolButton.className = "secondary";
      addToPoolButton.type = "button";
      addToPoolButton.textContent = "Add " + selectedEntries.length + " To Pool";
      addToPoolButton.addEventListener("click", input.onAddSelectedToPool);
      bulkActions.append(deleteSelectedButton, addToPoolButton);
      container.appendChild(bulkActions);
    }
    for (const entry of entries) {
      const rowWrap = createElement("div");
      rowWrap.className = "media-history-row-wrap";
      rowWrap.setAttribute("data-image-id", entry.id);
      const rowInner = createElement("div");
      rowInner.className = "media-history-row";
      const row = createElement("button");
      row.className = "channel-row" + (input.multiSelection.isSelected(
        "selectedGeneratedImageIds",
        input.state.selectedGeneratedImageId,
        entry.id
      ) ? " active" : "");
      const thumb = createElement("img");
      thumb.className = "media-history-thumb";
      thumb.alt = entry.imageFileName;
      thumb.loading = "lazy";
      thumb.decoding = "async";
      input.attachLazyMedia(thumb, input.getImageUrl(entry.id, entry.imageFileName), {root: container});
      const main = createElement("span");
      main.className = "channel-row-main";
      const name = createElement("span");
      name.className = "channel-row-name";
      name.textContent = entry.imageFileName;
      const time = createElement("span");
      time.className = "channel-row-kind";
      time.textContent = input.formatDateTime(entry.createdAt);
      main.append(name, time);
      row.append(thumb, main);
      row.addEventListener("click", event => {
        input.multiSelection.handleSelectionClick({
          entries: allEntries,
          id: entry.id,
          selectionKey: "selectedGeneratedImageIds",
          primaryKey: "selectedGeneratedImageId",
          event
        });
        render();
        input.scrollSelectedIntoView(entry.id);
      });
      const actionWrap = createElement("div");
      actionWrap.className = "media-history-actions";
      actionWrap.append(
        createActionButton(entry, {
          html: "<span class='media-history-action-icon' aria-hidden='true'>&#9998;</span><span class='media-history-action-label'>Rename</span>",
          title: "Regenerate filename with LLM",
          ariaLabel: "Regenerate generated image filename",
          action: input.onRename
        }),
        createActionButton(entry, {
          html: "<span class='media-history-action-icon' aria-hidden='true'>&#9638;</span><span class='media-history-action-label'>Pixel</span>",
          title: "Convert to pixel art",
          ariaLabel: "Convert generated image to pixel art",
          action: input.onPixelate
        }),
        createActionButton(entry, {
          html: "<span class='media-history-action-icon' aria-hidden='true'>&#10005;</span><span class='media-history-action-label'>Delete</span>",
          title: "Delete image",
          ariaLabel: "Delete generated image",
          danger: true,
          action: entryToDelete => input.onDelete([entryToDelete])
        })
      );
      rowInner.append(row, actionWrap);
      rowWrap.appendChild(rowInner);
      container.appendChild(rowWrap);
    }
    if (allEntries.length > entries.length) {
      const moreButton = createElement("button");
      moreButton.className = "secondary";
      moreButton.type = "button";
      moreButton.textContent = "Show " + Math.min(initialLimit, allEntries.length - entries.length) + " more images";
      moreButton.addEventListener("click", () => {
        input.state.imageHistoryVisibleLimit = entries.length + initialLimit;
        render();
      });
      container.appendChild(moreButton);
    }
    renderSurrounding(input.getSelected());
    return true;
  }

  return {render};
}
