function createDashboardAudioUiHelpers(state, deps) {
  const mediaMultiSelectionHelpers = createDashboardMediaMultiSelectionHelpers(state);
  const recentMediaViewHelpers = createDashboardRecentMediaViewHelpers();
  const generationQueuePresenter = createDashboardGenerationQueuePresenter({document});
  function setAudioGenerationStatus(text) {
    if (typeof setStudioStatusPanel === "function") {
      setStudioStatusPanel({
        statusKey: "audiogen",
        text,
        currentId: "audiogen-status",
        stateId: "audiogen-status-state",
        progressTrackId: "audiogen-status-progress-track",
        progressFillId: "audiogen-status-progress",
        historyId: "audiogen-status-history"
      });
      renderAudioBottomQueue();
      return;
    }
    const node = document.getElementById("audiogen-status");
    if (node) {
      node.textContent = text;
    }
    renderAudioBottomQueue();
  }

  function setMusicGenerationStatus(text) {
    if (typeof setStudioStatusPanel === "function") {
      setStudioStatusPanel({
        statusKey: "musicgen",
        text,
        currentId: "musicgen-status",
        stateId: "musicgen-status-state",
        progressTrackId: "musicgen-status-progress-track",
        progressFillId: "musicgen-status-progress",
        historyId: "musicgen-status-history"
      });
      renderMusicBottomQueue();
      return;
    }
    const node = document.getElementById("musicgen-status");
    if (node) {
      node.textContent = text;
    }
    renderMusicBottomQueue();
  }

  function getGeneratedAudioFileUrl(audioId, fileName) {
    return "/api/generated-audio-file?audioId=" + encodeURIComponent(audioId) + "&file=" + encodeURIComponent(fileName);
  }

  function getSelectedGeneratedAudio() {
    return state.generatedAudios.find(item => item.id === state.selectedGeneratedAudioId && item.mode === "audio") || null;
  }

  function getSelectedGeneratedMusic() {
    return state.generatedAudios.find(item => item.id === state.selectedGeneratedMusicId && item.mode === "music") || null;
  }

  function renderGeneratedAudioMeta(record) {
    const output = document.getElementById("audiogen-meta-output");
    const preview = document.getElementById("audiogen-preview");
    if (!output || !preview) {
      return;
    }
    if (!record) {
      output.textContent = "No audio selected.";
      preview.removeAttribute("src");
      preview.load();
      return;
    }
    const lines = [
      "Audio ID: " + record.id,
      "Generated: " + deps.formatDateTime(record.createdAt),
      "Prompt: " + (record.prompt || "(none)"),
      "Length: " + (record.seconds ? (record.seconds + "s") : "unknown"),
      "Seed: " + record.seed,
      "Steps: " + (record.steps || "unknown"),
      "Model: " + (record.model || "unknown"),
      "File: " + record.audioFileName
    ];
    output.textContent = lines.join("\n");
    preview.src = getGeneratedAudioFileUrl(record.id, record.audioFileName);
    preview.load();
  }

  function renderGeneratedMusicMeta(record) {
    const output = document.getElementById("musicgen-meta-output");
    const preview = document.getElementById("musicgen-preview");
    if (!output || !preview) {
      return;
    }
    if (!record) {
      output.textContent = "No music selected.";
      preview.removeAttribute("src");
      preview.load();
      return;
    }
    const lines = [
      "Music ID: " + record.id,
      "Generated: " + deps.formatDateTime(record.createdAt),
      "Tags: " + (record.tags || "(none)"),
      "Lyrics: " + (record.lyrics || "(none)"),
      "Length: " + (record.seconds ? (record.seconds + "s") : "unknown"),
      "Seed: " + record.seed,
      "Steps: " + (record.steps || "unknown"),
      "CFG: " + (record.cfg ?? "unknown"),
      "Model: " + (record.model || "unknown"),
      "File: " + record.audioFileName
    ];
    output.textContent = lines.join("\n");
    preview.src = getGeneratedAudioFileUrl(record.id, record.audioFileName);
    preview.load();
  }

  function renderGeneratedAudioHistory() {
    const container = document.getElementById("audiogen-history-list");
    if (!container) {
      renderGeneratedAudioMeta(getSelectedGeneratedAudio());
      renderAudioBottomDock();
      return;
    }
    const entries = state.generatedAudios.filter(item => item.mode === "audio");
    deps.clearChildren(container);
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No generated audio yet.";
      container.appendChild(empty);
      renderGeneratedAudioMeta(null);
      renderAudioBottomDock();
      return;
    }
    for (const entry of entries) {
      const rowWrap = document.createElement("div");
      rowWrap.className = "media-history-row-wrap";
      const rowInner = document.createElement("div");
      rowInner.className = "media-history-row";
      const row = document.createElement("button");
      row.className = "channel-row" + (mediaMultiSelectionHelpers.isSelected("selectedGeneratedAudioIds", state.selectedGeneratedAudioId, entry.id) ? " active" : "");
      row.innerHTML =
        "<span class='channel-icon'>AUD</span>"
        + "<span class='channel-row-main'>"
        + "<span class='channel-row-name'>" + deps.escapeHtml(entry.audioFileName) + "</span>"
        + "<span class='channel-row-kind'>" + deps.escapeHtml(deps.formatDateTime(entry.createdAt)) + "</span>"
        + "</span>";
      row.addEventListener("click", event => {
        mediaMultiSelectionHelpers.handleSelectionClick({
          entries,
          id: entry.id,
          selectionKey: "selectedGeneratedAudioIds",
          primaryKey: "selectedGeneratedAudioId",
          event
        });
        renderGeneratedAudioHistory();
      });
      const removeButton = document.createElement("button");
      removeButton.className = "secondary media-history-action-button danger";
      removeButton.type = "button";
      removeButton.innerHTML = "<span class='media-history-action-icon' aria-hidden='true'>&#10005;</span>";
      removeButton.title = "Delete audio";
      removeButton.setAttribute("aria-label", "Delete generated audio " + entry.audioFileName);
      removeButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = typeof window.dashboardConfirm === "function"
          && await window.dashboardConfirm({
            title: "Delete Generated Audio",
            message: "Delete generated audio " + entry.audioFileName + "?",
            confirmLabel: "Delete",
            variant: "warning"
          });
        if (!confirmed) {
          return;
        }
        setAudioGenerationStatus("Deleting " + entry.audioFileName + "...");
        try {
          await deps.request("/api/audio-delete", { audioId: entry.id });
          const nextAudioId = state.selectedGeneratedAudioId === entry.id ? "" : state.selectedGeneratedAudioId;
          await loadAudioHistory(nextAudioId, state.selectedGeneratedMusicId);
          setAudioGenerationStatus("Deleted " + entry.audioFileName + ".");
          deps.setOutput("Deleted generated audio " + entry.audioFileName + ".");
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setAudioGenerationStatus("Failed to delete " + entry.audioFileName + ".");
          deps.setOutput("Failed to delete generated audio: " + detail);
        }
      });
      const actionWrap = document.createElement("div");
      actionWrap.className = "media-history-actions";
      actionWrap.appendChild(removeButton);
      rowInner.appendChild(row);
      rowInner.appendChild(actionWrap);
      rowWrap.appendChild(rowInner);
      container.appendChild(rowWrap);
    }
    renderGeneratedAudioMeta(getSelectedGeneratedAudio());
    renderAudioBottomDock();
  }

  function renderGeneratedMusicHistory() {
    const container = document.getElementById("musicgen-history-list");
    if (!container) {
      renderGeneratedMusicMeta(getSelectedGeneratedMusic());
      renderMusicBottomDock();
      return;
    }
    const entries = state.generatedAudios.filter(item => item.mode === "music");
    deps.clearChildren(container);
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.textContent = "No generated music yet.";
      container.appendChild(empty);
      renderGeneratedMusicMeta(null);
      renderMusicBottomDock();
      return;
    }
    for (const entry of entries) {
      const rowWrap = document.createElement("div");
      rowWrap.className = "media-history-row-wrap";
      const rowInner = document.createElement("div");
      rowInner.className = "media-history-row";
      const row = document.createElement("button");
      row.className = "channel-row" + (mediaMultiSelectionHelpers.isSelected("selectedGeneratedMusicIds", state.selectedGeneratedMusicId, entry.id) ? " active" : "");
      row.innerHTML =
        "<span class='channel-icon'>MUS</span>"
        + "<span class='channel-row-main'>"
        + "<span class='channel-row-name'>" + deps.escapeHtml(entry.audioFileName) + "</span>"
        + "<span class='channel-row-kind'>" + deps.escapeHtml(deps.formatDateTime(entry.createdAt)) + "</span>"
        + "</span>";
      row.addEventListener("click", event => {
        mediaMultiSelectionHelpers.handleSelectionClick({
          entries,
          id: entry.id,
          selectionKey: "selectedGeneratedMusicIds",
          primaryKey: "selectedGeneratedMusicId",
          event
        });
        renderGeneratedMusicHistory();
      });
      const removeButton = document.createElement("button");
      removeButton.className = "secondary media-history-action-button danger";
      removeButton.type = "button";
      removeButton.innerHTML = "<span class='media-history-action-icon' aria-hidden='true'>&#10005;</span>";
      removeButton.title = "Delete music";
      removeButton.setAttribute("aria-label", "Delete generated music " + entry.audioFileName);
      removeButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = typeof window.dashboardConfirm === "function"
          && await window.dashboardConfirm({
            title: "Delete Generated Music",
            message: "Delete generated music " + entry.audioFileName + "?",
            confirmLabel: "Delete",
            variant: "warning"
          });
        if (!confirmed) {
          return;
        }
        setMusicGenerationStatus("Deleting " + entry.audioFileName + "...");
        try {
          await deps.request("/api/audio-delete", { audioId: entry.id });
          const nextMusicId = state.selectedGeneratedMusicId === entry.id ? "" : state.selectedGeneratedMusicId;
          await loadAudioHistory(state.selectedGeneratedAudioId, nextMusicId);
          setMusicGenerationStatus("Deleted " + entry.audioFileName + ".");
          deps.setOutput("Deleted generated music " + entry.audioFileName + ".");
        } catch (error) {
          const detail = error && error.message ? error.message : "Unknown error";
          setMusicGenerationStatus("Failed to delete " + entry.audioFileName + ".");
          deps.setOutput("Failed to delete generated music: " + detail);
        }
      });
      const actionWrap = document.createElement("div");
      actionWrap.className = "media-history-actions";
      actionWrap.appendChild(removeButton);
      rowInner.appendChild(row);
      rowInner.appendChild(actionWrap);
      rowWrap.appendChild(rowInner);
      container.appendChild(rowWrap);
    }
    renderGeneratedMusicMeta(getSelectedGeneratedMusic());
    renderMusicBottomDock();
  }

  function renderAudioBottomDock() {
    renderAudioBottomFilmstrip();
    renderAudioBottomQueue();
  }

  function renderMusicBottomDock() {
    renderMusicBottomFilmstrip();
    renderMusicBottomQueue();
  }

  function renderAudioBottomFilmstrip() {
    renderAudioLikeBottomFilmstrip("audio-bottom-filmstrip", state.generatedAudios.filter(item => item.mode === "audio"), "audio");
  }

  function renderMusicBottomFilmstrip() {
    renderAudioLikeBottomFilmstrip("music-bottom-filmstrip", state.generatedAudios.filter(item => item.mode === "music"), "music");
  }

  function renderAudioLikeBottomFilmstrip(containerId, entries, mode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    deps.clearChildren(container);
    const key = mode === "music" ? "music" : "audio";
    const groups = [{key: "prompt", label: mode === "music" ? "Tags" : "Prompt", getValue: entry => mode === "music" ? (entry.tags || entry.prompt) : entry.prompt}];
    const filters = [
      {key: "prompt", label: mode === "music" ? "Tags / Prompt" : "Prompt", getValue: entry => mode === "music" ? [entry.tags, entry.prompt].filter(Boolean).join(" ") : entry.prompt},
      {key: "steps", label: "Steps", type: "number", getValue: entry => entry.steps}
    ];
    recentMediaViewHelpers.renderControls(key + "-recent-media-controls", {
      key,
      mediaContainerId: containerId,
      groups,
      filters,
      onChange: mode === "music" ? renderMusicBottomFilmstrip : renderAudioBottomFilmstrip
    });
    const filteredEntries = recentMediaViewHelpers.filterEntries(entries, key, filters);
    if (filteredEntries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "audio-dock-empty";
      empty.textContent = entries.length === 0
        ? (mode === "music" ? "No generated music yet." : "No generated audio yet.")
        : "No recent media matches the filter.";
      container.appendChild(empty);
      return;
    }
    mediaMultiSelectionHelpers.pruneSelection(
      mode === "music" ? "selectedGeneratedMusicIds" : "selectedGeneratedAudioIds",
      mode === "music" ? "selectedGeneratedMusicId" : "selectedGeneratedAudioId",
      entries
    );
    const renderItems = recentMediaViewHelpers.groupEntries(filteredEntries.slice(0, 24), key, groups)
      .flatMap(group => [{group}, ...group.entries.map(entry => ({entry}))]);
    renderItems.forEach(item => {
      if (item.group) {
        recentMediaViewHelpers.appendGroupHeading(container, item.group.label, item.group.entries.length);
        return;
      }
      const entry = item.entry;
      const card = document.createElement("article");
      card.className = mediaMultiSelectionHelpers.isSelected(
        mode === "music" ? "selectedGeneratedMusicIds" : "selectedGeneratedAudioIds",
        mode === "music" ? state.selectedGeneratedMusicId : state.selectedGeneratedAudioId,
        entry.id
      ) ? "selected" : "";
      const icon = document.createElement("span");
      icon.textContent = mode === "music" ? "MUS" : "AUD";
      const name = document.createElement("strong");
      name.textContent = entry.audioFileName;
      const time = document.createElement("small");
      time.textContent = (entry.seconds ? entry.seconds + "s - " : "") + deps.formatDateTime(entry.createdAt);
      card.append(icon, name, time);
      card.addEventListener("click", event => {
        if (mode === "music") {
          mediaMultiSelectionHelpers.handleSelectionClick({
            entries,
            id: entry.id,
            selectionKey: "selectedGeneratedMusicIds",
            primaryKey: "selectedGeneratedMusicId",
            event
          });
          renderGeneratedMusicHistory();
        } else {
          mediaMultiSelectionHelpers.handleSelectionClick({
            entries,
            id: entry.id,
            selectionKey: "selectedGeneratedAudioIds",
            primaryKey: "selectedGeneratedAudioId",
            event
          });
          renderGeneratedAudioHistory();
        }
      });
      container.appendChild(card);
    });
  }

  function renderAudioBottomQueue() {
    renderAudioLikeBottomQueue("audio-bottom-queue-list", "audiogen", "audio");
  }

  function renderMusicBottomQueue() {
    renderAudioLikeBottomQueue("music-bottom-queue-list", "musicgen", "music");
  }

  function renderAudioLikeBottomQueue(containerId, statusKey, noun) {
    generationQueuePresenter.render({
      containerId,
      statusKey,
      noun,
      studioLabel: noun === "music" ? "Music Studio" : "Audio Studio",
      itemClass: "audio-queue-item"
    });
  }

  async function loadAudioHistory(preferredAudioId, preferredMusicId) {
    state.generatedAudios = await deps.request("/api/audio-history");
    const audioEntries = state.generatedAudios.filter(item => item.mode === "audio");
    const musicEntries = state.generatedAudios.filter(item => item.mode === "music");
    const audioCandidate = preferredAudioId && audioEntries.some(item => item.id === preferredAudioId)
      ? preferredAudioId
      : state.selectedGeneratedAudioId;
    const musicCandidate = preferredMusicId && musicEntries.some(item => item.id === preferredMusicId)
      ? preferredMusicId
      : state.selectedGeneratedMusicId;
    state.selectedGeneratedAudioId = audioEntries.some(item => item.id === audioCandidate)
      ? audioCandidate
      : (audioEntries[0] ? audioEntries[0].id : "");
    state.selectedGeneratedMusicId = musicEntries.some(item => item.id === musicCandidate)
      ? musicCandidate
      : (musicEntries[0] ? musicEntries[0].id : "");
    mediaMultiSelectionHelpers.pruneSelection("selectedGeneratedAudioIds", "selectedGeneratedAudioId", audioEntries);
    mediaMultiSelectionHelpers.pruneSelection("selectedGeneratedMusicIds", "selectedGeneratedMusicId", musicEntries);
    renderGeneratedAudioHistory();
    renderGeneratedMusicHistory();
  }

  function unloadAudioPreview(elementId) {
    const preview = document.getElementById(elementId);
    if (!preview) return;
    if (typeof preview.pause === "function") preview.pause();
    preview.removeAttribute("src");
    preview.load();
  }

  function syncAudioPreviewForFocus(focusedId) {
    const activeId = String(focusedId || "").trim();
    if (activeId === "audio-studio-card") {
      renderGeneratedAudioMeta(getSelectedGeneratedAudio());
    } else {
      unloadAudioPreview("audiogen-preview");
    }
    if (activeId === "music-studio-card") {
      renderGeneratedMusicMeta(getSelectedGeneratedMusic());
    } else {
      unloadAudioPreview("musicgen-preview");
    }
  }

  return {
    setAudioGenerationStatus,
    setMusicGenerationStatus,
    loadAudioHistory,
    syncAudioPreviewForFocus
  };
}
