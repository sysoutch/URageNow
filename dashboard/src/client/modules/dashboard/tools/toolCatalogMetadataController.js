function createToolCatalogMetadataController(input) {
  const request = typeof input?.request === "function"
    ? input.request
    : () => Promise.reject(new Error("Request helper unavailable."));

  function nodes() {
    return {
      overlay: document.getElementById("tool-catalog-metadata-overlay"),
      open: document.getElementById("tools-manage-metadata-button"),
      close: document.getElementById("tool-catalog-metadata-close"),
      backdrop: document.getElementById("tool-catalog-metadata-backdrop"),
      status: document.getElementById("tool-catalog-metadata-status"),
      categoryExisting: document.getElementById("tool-category-existing"),
      categoryId: document.getElementById("tool-category-id"),
      categoryLabel: document.getElementById("tool-category-label"),
      categoryIcon: document.getElementById("tool-category-icon"),
      categoryDescription: document.getElementById("tool-category-description"),
      categorySave: document.getElementById("tool-category-save"),
      categoryVisibility: document.getElementById("tool-category-visibility"),
      categoryDelete: document.getElementById("tool-category-delete"),
      moveTool: document.getElementById("tool-category-move-tool"),
      moveTarget: document.getElementById("tool-category-move-target"),
      moveButton: document.getElementById("tool-category-move"),
      tool: document.getElementById("tool-tags-tool"),
      tags: document.getElementById("tool-tags-values"),
      tagSuggestions: document.getElementById("tool-tag-suggestions"),
      tagsMode: document.getElementById("tool-tags-mode"),
      tagsSave: document.getElementById("tool-tags-save"),
      tagFrom: document.getElementById("tool-tag-from"),
      tagTo: document.getElementById("tool-tag-to"),
      tagRename: document.getElementById("tool-tag-rename"),
      tagRemove: document.getElementById("tool-tag-remove"),
      tagColor: document.getElementById("tool-tag-color"),
      tagColorSave: document.getElementById("tool-tag-color-save")
    };
  }

  function setOpen(open) {
    const current = nodes();
    current.overlay?.classList.toggle("hidden", open !== true);
    current.overlay?.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      syncSelectedToolTags();
      window.setTimeout(() => current.categoryId?.focus(), 0);
    }
  }

  function setStatus(message, isError) {
    const status = nodes().status;
    if (!status) return;
    status.textContent = String(message || "");
    status.classList.toggle("is-error", isError === true);
  }

  function parseTags(value) {
    return String(value || "").split(",").map(tag => tag.trim()).filter(Boolean);
  }

  function syncSelectedToolTags() {
    const current = nodes();
    const selected = Array.from(current.tool?.selectedOptions || []);
    if (current.tags) current.tags.value = selected.length === 1 ? String(selected[0]?.dataset.tags || "") : "";
  }

  function syncTagSuggestions() {
    const current = nodes();
    const chunks = String(current.tags?.value || "").split(",");
    const prefix = chunks.slice(0, -1).map(tag => tag.trim()).filter(Boolean);
    Array.from(current.tagSuggestions?.options || []).forEach(option => {
      const tag = String(option.dataset.tag || option.value || "");
      option.value = prefix.length > 0 ? prefix.join(", ") + ", " + tag : tag;
    });
  }

  function syncSelectedCategory() {
    const current = nodes();
    const option = current.categoryExisting?.selectedOptions?.[0];
    const categoryId = String(option?.value || "");
    if (current.categoryId) {
      current.categoryId.value = categoryId;
      current.categoryId.readOnly = Boolean(categoryId);
    }
    if (current.categoryLabel) current.categoryLabel.value = String(option?.dataset.label || "");
    if (current.categoryIcon) current.categoryIcon.value = String(option?.dataset.icon || "grid");
    if (current.categoryDescription) current.categoryDescription.value = String(option?.dataset.description || "");
    const hidden = option?.dataset.hidden === "true";
    const count = Number(option?.dataset.count || 0);
    if (current.categoryVisibility) {
      current.categoryVisibility.disabled = !categoryId;
      current.categoryVisibility.textContent = hidden ? "Unhide Category" : "Hide Category";
      current.categoryVisibility.dataset.hidden = hidden ? "true" : "false";
      current.categoryVisibility.dataset.count = String(count);
    }
    if (current.categoryDelete) current.categoryDelete.disabled = !categoryId;
  }

  function syncSelectedTagColor() {
    const current = nodes();
    if (current.tagColor) current.tagColor.value = String(current.tagFrom?.selectedOptions?.[0]?.dataset.color || "#b76cff");
  }

  async function run(button, pendingMessage, operation) {
    if (button) button.disabled = true;
    setStatus(pendingMessage);
    try {
      await operation();
      setStatus("Saved. Reloading the tool catalog...");
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      setStatus(error?.message || "Could not update tool metadata.", true);
      if (button) button.disabled = false;
    }
  }

  function bind() {
    const current = nodes();
    if (!current.open || current.open.dataset.bound === "true") return;
    current.open.dataset.bound = "true";
    current.open.addEventListener("click", () => setOpen(true));
    current.close?.addEventListener("click", () => setOpen(false));
    current.backdrop?.addEventListener("click", () => setOpen(false));
    current.tool?.addEventListener("change", syncSelectedToolTags);
    current.tags?.addEventListener("input", syncTagSuggestions);
    current.categoryExisting?.addEventListener("change", syncSelectedCategory);
    current.tagFrom?.addEventListener("change", syncSelectedTagColor);
    current.categorySave?.addEventListener("click", () => run(current.categorySave, "Saving category...", () =>
      request("/api/tools/categories/save", {
        id: current.categoryId?.value,
        label: current.categoryLabel?.value,
        icon: current.categoryIcon?.value,
        description: current.categoryDescription?.value,
        hidden: current.categoryExisting?.selectedOptions?.[0]?.dataset.hidden === "true"
      })
    ));
    current.categoryVisibility?.addEventListener("click", () => {
      const hidden = current.categoryVisibility?.dataset.hidden === "true";
      const assignedCount = Number(current.categoryVisibility?.dataset.count || 0);
      const nextHidden = !hidden;
      if (nextHidden && assignedCount > 0 && !window.confirm(`This category contains ${assignedCount} tool(s). Hide its category filters anyway?`)) return;
      run(current.categoryVisibility, nextHidden ? "Hiding category..." : "Unhiding category...", () =>
        request("/api/tools/categories/visibility", {
          categoryId: current.categoryExisting?.value,
          hidden: nextHidden,
          confirmAssigned: nextHidden && assignedCount > 0
        })
      );
    });
    current.categoryDelete?.addEventListener("click", () => {
      if (!window.confirm("Delete this custom category definition? Assigned tools and presets are protected.")) return;
      run(current.categoryDelete, "Deleting category...", () =>
        request("/api/tools/categories/delete", {categoryId: current.categoryExisting?.value})
      );
    });
    current.moveButton?.addEventListener("click", () => {
      const source = current.moveTool?.value;
      const destination = current.moveTarget?.value;
      if (!window.confirm(`Move ${source} to ${destination}? Its directory, manifest id, and tags will move transactionally.`)) return;
      run(current.moveButton, "Moving tool transactionally...", () =>
        request("/api/tools/categories/move-tool", {toolId: source, destinationCategory: destination})
      );
    });
    current.tagsSave?.addEventListener("click", () => run(current.tagsSave, "Updating selected tool tags...", () =>
      request("/api/tools/tags/bulk", {
        toolIds: Array.from(current.tool?.selectedOptions || []).map(option => option.value),
        tags: parseTags(current.tags?.value),
        mode: current.tagsMode?.value
      })
    ));
    current.tagRename?.addEventListener("click", () => run(current.tagRename, "Renaming tag across tools...", () =>
      request("/api/tools/tags/rename", {from: current.tagFrom?.value, to: current.tagTo?.value})
    ));
    current.tagRemove?.addEventListener("click", () => run(current.tagRemove, "Removing tag across tools...", () =>
      request("/api/tools/tags/remove", {tag: current.tagFrom?.value})
    ));
    current.tagColorSave?.addEventListener("click", () => run(current.tagColorSave, "Saving tag color...", () =>
      request("/api/tools/tags/color", {tag: current.tagFrom?.value, color: current.tagColor?.value})
    ));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !current.overlay?.classList.contains("hidden")) setOpen(false);
    });
    syncSelectedCategory();
    syncSelectedToolTags();
    syncSelectedTagColor();
  }

  return {bind, setOpen};
}
