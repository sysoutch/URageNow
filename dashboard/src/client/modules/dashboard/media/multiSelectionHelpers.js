function createDashboardMediaMultiSelectionHelpers(state) {
  function ensureAnchorStore() {
    if (!state.mediaSelectionAnchors || typeof state.mediaSelectionAnchors !== "object") {
      state.mediaSelectionAnchors = {};
    }
    return state.mediaSelectionAnchors;
  }
  function getSelectedIds(selectionKey, primaryId) {
    const ids = Array.isArray(state[selectionKey]) ? state[selectionKey].map(id => String(id || "").trim()).filter(Boolean) : [];
    const primary = String(primaryId || "").trim();
    return ids.length > 0 ? Array.from(new Set(ids)) : (primary ? [primary] : []);
  }
  function setSelectedIds(selectionKey, primaryKey, ids, primaryId) {
    const nextIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map(id => String(id || "").trim()).filter(Boolean)));
    state[selectionKey] = nextIds;
    state[primaryKey] = String(primaryId || nextIds[0] || "").trim();
  }
  function pruneSelection(selectionKey, primaryKey, entries) {
    const validIds = new Set((Array.isArray(entries) ? entries : []).map(entry => String(entry?.id || "").trim()).filter(Boolean));
    const selectedIds = getSelectedIds(selectionKey, state[primaryKey]).filter(id => validIds.has(id));
    setSelectedIds(selectionKey, primaryKey, selectedIds, validIds.has(String(state[primaryKey] || "").trim()) ? state[primaryKey] : selectedIds[0] || "");
  }
  function handleSelectionClick(config) {
    const entries = Array.isArray(config.entries) ? config.entries : [];
    const id = String(config.id || "").trim();
    if (!id) {
      return [];
    }
    const selectionKey = config.selectionKey;
    const primaryKey = config.primaryKey;
    const event = config.event || {};
    const anchors = ensureAnchorStore();
    const anchorKey = selectionKey || primaryKey;
    const entryIds = entries.map(entry => String(entry?.id || "").trim()).filter(Boolean);
    const currentIds = getSelectedIds(selectionKey, state[primaryKey]);
    let nextIds = [id];
    const anchorId = anchors[anchorKey] || currentIds[currentIds.length - 1] || String(state[primaryKey] || "").trim();
    if (event.shiftKey && anchorId) {
      const anchorIndex = entryIds.indexOf(anchorId);
      const currentIndex = entryIds.indexOf(id);
      if (anchorIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(anchorIndex, currentIndex);
        const end = Math.max(anchorIndex, currentIndex);
        nextIds = entryIds.slice(start, end + 1);
      }
      anchors[anchorKey] = anchorId;
    } else if (event.ctrlKey || event.metaKey) {
      nextIds = currentIds.includes(id) ? currentIds.filter(entryId => entryId !== id) : currentIds.concat(id);
      anchors[anchorKey] = id;
    } else {
      anchors[anchorKey] = id;
    }
    setSelectedIds(selectionKey, primaryKey, nextIds, nextIds.includes(id) ? id : nextIds[0] || "");
    return nextIds;
  }
  function getSelectedRecords(entries, selectionKey, primaryId) {
    const selectedIds = new Set(getSelectedIds(selectionKey, primaryId));
    return (Array.isArray(entries) ? entries : []).filter(entry => selectedIds.has(String(entry?.id || "").trim()));
  }
  function isSelected(selectionKey, primaryId, id) {
    return getSelectedIds(selectionKey, primaryId).includes(String(id || "").trim());
  }
  return {
    getSelectedIds,
    setSelectedIds,
    pruneSelection,
    handleSelectionClick,
    getSelectedRecords,
    isSelected
  };
}
