function createDashboardAiStudioLayoutHelpers(input) {
  const clearChildren = typeof input.clearChildren === "function"
    ? input.clearChildren
    : node => {
        if (node) {
          node.textContent = "";
        }
      };
  let studioHomeDataLoaded = false;
  let studioHomeDataLoading = false;
  const studioHomeFilters = {
    usage: "all",
    activity: "all",
    actions: "all"
  };
  const homeMediaFallbackIcons = {
    image: "bi-image",
    model3d: "bi-box",
    audio: "bi-soundwave",
    music: "bi-music-note-beamed",
    video: "bi-camera-video"
  };

  function formatHomeDate(value) {
    if (!value) {
      return "";
    }
    return typeof input.formatDateTime === "function" ? input.formatDateTime(value) : String(value);
  }

  function getHomeDateMs(entry) {
    const parsed = Date.parse(entry?.createdAt || entry?.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getHomeTitle(entry, fileName, fallbackTitle) {
    const candidates = [entry?.title, entry?.name, entry?.prompt, fileName, fallbackTitle];
    const title = candidates.map(value => String(value || "").trim()).find(Boolean) || fallbackTitle;
    return title.length > 86 ? title.slice(0, 83).trim() + "..." : title;
  }

  function getModel3dPreviewUrl(entry) {
    if (!entry?.id) {
      return "";
    }
    const directCandidates = [entry.lowPolyPreviewImageUrl, entry.previewImageUrl, entry.lowPolyPreviewGifUrl, entry.previewGifUrl];
    const directUrl = directCandidates.map(value => String(value || "").trim()).find(Boolean);
    if (directUrl) {
      return directUrl;
    }
    const fileCandidates = [
      entry.lowPolyPreviewGifFileName,
      entry.lowPolyPreviewImageFileName,
      entry.previewGifFileName,
      entry.previewImageFileName,
      entry.sourceImageFileName
    ];
    const fileName = fileCandidates.map(value => String(value || "").trim()).find(Boolean);
    return fileName && typeof input.getModel3dFileUrl === "function" ? input.getModel3dFileUrl(entry.id, fileName) : "";
  }

  function buildHomeMediaRecords() {
    const imageRecords = (Array.isArray(input.state.generatedImages) ? input.state.generatedImages : [])
      .filter(entry => entry?.id)
      .map(entry => {
        const fileName = String(entry.imageFileName || "").trim();
        return {
          id: entry.id,
          kind: "image",
          label: "Image",
          title: getHomeTitle(entry, fileName, "Generated image"),
          date: entry.createdAt || "",
          dateMs: getHomeDateMs(entry),
          url: fileName && typeof input.getGeneratedImageFileUrl === "function" ? input.getGeneratedImageFileUrl(entry.id, fileName) : "",
          targetId: "image-studio-card",
          entry
        };
      });
    const modelRecords = (Array.isArray(input.state.generatedModels) ? input.state.generatedModels : [])
      .filter(entry => entry?.id)
      .map(entry => {
        const fileName = String(entry.modelFileName || entry.originalModelFileName || entry.lowPolyModelFileName || "").trim();
        return {
          id: entry.id,
          kind: "model3d",
          label: "3D Model",
          title: getHomeTitle(entry, fileName, "Generated 3D model"),
          date: entry.createdAt || "",
          dateMs: getHomeDateMs(entry),
          url: getModel3dPreviewUrl(entry),
          targetId: "model3d-studio-card",
          entry
        };
      });
    const audioRecords = (Array.isArray(input.state.generatedAudios) ? input.state.generatedAudios : [])
      .filter(entry => entry?.id)
      .map(entry => {
        const isMusic = entry.mode === "music";
        const fileName = String(entry.audioFileName || "").trim();
        return {
          id: entry.id,
          kind: isMusic ? "music" : "audio",
          label: isMusic ? "Music" : "Audio",
          title: getHomeTitle(entry, fileName, isMusic ? "Generated music" : "Generated audio"),
          date: entry.createdAt || "",
          dateMs: getHomeDateMs(entry),
          url: "",
          targetId: isMusic ? "music-studio-card" : "audio-studio-card",
          entry
        };
      });
    const videoRecords = (Array.isArray(input.state.generatedVideos) ? input.state.generatedVideos : [])
      .filter(entry => entry?.id)
      .map(entry => {
        const fileName = String(entry.videoFileName || "").trim();
        return {
          id: entry.id,
          kind: "video",
          label: "Video",
          title: getHomeTitle(entry, fileName, "Generated video"),
          date: entry.createdAt || "",
          dateMs: getHomeDateMs(entry),
          url: fileName && typeof input.getGeneratedVideoFileUrl === "function" ? input.getGeneratedVideoFileUrl(entry.id, fileName) : "",
          targetId: "video-studio-card",
          entry
        };
      });
    return imageRecords.concat(modelRecords, audioRecords, videoRecords).sort((left, right) => right.dateMs - left.dateMs);
  }

  function normalizeHomeFilter(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "image" || normalized === "model3d" || normalized === "audio" || normalized === "music" || normalized === "video" || normalized === "chat" || normalized === "tools" ? normalized : "all";
  }

  function matchesHomeMediaFilter(record, filter) {
    const normalized = normalizeHomeFilter(filter);
    if (normalized === "all") return true;
    if (normalized === "audio") return record.kind === "audio" || record.kind === "music";
    return record.kind === normalized;
  }

  function getHomeFilteredRecords(records, scope) {
    const filter = normalizeHomeFilter(studioHomeFilters[scope] || "all");
    return records.filter(record => matchesHomeMediaFilter(record, filter));
  }

  function getHomeRecordDurationMs(record) {
    const entry = record?.entry || {};
    const seconds = Number(entry.generationDurationSeconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
    const millisecondCandidates = [entry.generationDurationMs, entry.durationMs, entry.elapsedMs];
    const durationMs = millisecondCandidates.map(Number).find(value => Number.isFinite(value) && value > 0);
    return durationMs || 0;
  }

  function getHomeRecordFileSizeBytes(record) {
    const entry = record?.entry || {};
    const sizeCandidates = [entry.fileSizeBytes, entry.sizeBytes, entry.bytes, entry.outputFileSizeBytes];
    const size = sizeCandidates.map(Number).find(value => Number.isFinite(value) && value > 0);
    return size || 0;
  }

  function formatHomeCompactNumber(value) {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    if (safeValue >= 1_000_000) return (safeValue / 1_000_000).toFixed(safeValue >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (safeValue >= 1_000) return (safeValue / 1_000).toFixed(safeValue >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(Math.round(safeValue));
  }

  function formatHomeDuration(ms) {
    const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    if (safeMs <= 0) return "0m";
    const seconds = safeMs / 1000;
    if (seconds < 60) return Math.round(seconds) + "s";
    const minutes = seconds / 60;
    if (minutes < 60) return minutes.toFixed(minutes >= 10 ? 0 : 1).replace(/\.0$/, "") + "m";
    const hours = minutes / 60;
    return hours.toFixed(hours >= 10 ? 0 : 1).replace(/\.0$/, "") + "h";
  }

  function formatHomeStorage(bytes) {
    const safeBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
    if (safeBytes <= 0) return "0 B";
    if (safeBytes >= 1024 * 1024 * 1024) return (safeBytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, "") + " GB";
    if (safeBytes >= 1024 * 1024) return (safeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "") + " MB";
    if (safeBytes >= 1024) return (safeBytes / 1024).toFixed(1).replace(/\.0$/, "") + " KB";
    return Math.round(safeBytes) + " B";
  }

  function createHomeSparkline(values, className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className || "lazydev-home-sparkline");
    svg.setAttribute("viewBox", "0 0 120 42");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const safeValues = values.length > 0 ? values : [0];
    const maxValue = Math.max(1, ...safeValues);
    const points = safeValues.map((value, index) => {
      const x = safeValues.length <= 1 ? 0 : (index / (safeValues.length - 1)) * 120;
      const y = 36 - (Math.max(0, value) / maxValue) * 30;
      return [x, y];
    });
    const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const linePath = points.map((point, index) => (index === 0 ? "M" : "L") + point[0].toFixed(1) + " " + point[1].toFixed(1)).join(" ");
    const areaPath = linePath + " L 120 42 L 0 42 Z";
    area.setAttribute("class", "lazydev-home-sparkline-area");
    area.setAttribute("d", areaPath);
    line.setAttribute("class", "lazydev-home-sparkline-line");
    line.setAttribute("d", linePath);
    svg.append(area, line);
    return svg;
  }

  function getHomeUsageStartDate(records) {
    const latestMs = Math.max(...records.map(record => record.dateMs || 0), 0) || Date.now();
    const start = new Date(latestMs);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return start;
  }

  function getHomeUsageBuckets(records, metric, startDate = getHomeUsageStartDate(records)) {
    const start = new Date(startDate);
    return Array.from({ length: 7 }, (_, index) => {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + index);
      const minMs = dayStart.getTime();
      const maxMs = minMs + 24 * 60 * 60 * 1000;
      return records.reduce((sum, record) => {
        if (!record.dateMs || record.dateMs < minMs || record.dateMs >= maxMs) return sum;
        if (metric === "duration") return sum + getHomeRecordDurationMs(record);
        if (metric === "storage") return sum + getHomeRecordFileSizeBytes(record);
        return sum + 1;
      }, 0);
    });
  }

  function createHomeUsageMetric(input) {
    const card = document.createElement("article");
    card.className = "lazydev-home-usage-card is-" + input.styleKey;
    const label = document.createElement("span");
    label.className = "lazydev-home-usage-label";
    label.textContent = input.label;
    const value = document.createElement("strong");
    value.textContent = input.value;
    const detail = document.createElement("small");
    detail.textContent = input.detail;
    card.append(label, value, detail, createHomeSparkline(input.series, "lazydev-home-sparkline"));
    return card;
  }

  function createHomeUsageMix(records) {
    const card = document.createElement("article");
    card.className = "lazydev-home-usage-card lazydev-home-mix-card is-mix";
    const label = document.createElement("span");
    label.className = "lazydev-home-usage-label";
    label.textContent = "Media Mix";
    const value = document.createElement("strong");
    const counts = ["image", "model3d", "audio", "music", "video"].map(kind => ({
      kind,
      label: kind === "model3d" ? "3D" : kind.charAt(0).toUpperCase() + kind.slice(1),
      count: records.filter(record => record.kind === kind).length
    })).filter(entry => entry.count > 0);
    const mixSummary = counts.map(entry => entry.label + " " + entry.count).join(" / ");
    value.textContent = counts.length > 0 ? counts[0].label + " leads · " + formatHomeCompactNumber(counts[0].count) : "No media yet";
    value.title = mixSummary;
    const bars = document.createElement("div");
    bars.className = "lazydev-home-mix-bars";
    const total = Math.max(1, records.length);
    counts.forEach(entry => {
      const segment = document.createElement("span");
      segment.className = "is-" + entry.kind;
      segment.style.setProperty("--mix-size", Math.max(6, (entry.count / total) * 100).toFixed(2) + "%");
      segment.title = entry.label + ": " + entry.count;
      bars.appendChild(segment);
    });
    if (counts.length === 0) {
      const segment = document.createElement("span");
      segment.className = "is-empty";
      segment.style.setProperty("--mix-size", "100%");
      bars.appendChild(segment);
    }
    const detail = document.createElement("small");
    detail.textContent = records.length > 0 ? records.length + " generated asset" + (records.length === 1 ? "" : "s") + " indexed" : "Create media to fill this chart";
    card.append(label, value, bars, detail);
    return card;
  }

  function getHomePeakDay(series, records, startDate = getHomeUsageStartDate(records)) {
    const peak = Math.max(0, ...series);
    if (peak <= 0) return "No peak yet";
    const index = series.indexOf(peak);
    const peakDate = new Date(startDate);
    peakDate.setDate(peakDate.getDate() + index);
    const label = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][peakDate.getDay()] || "Day";
    return label + " peaked at " + formatHomeCompactNumber(peak);
  }

  function renderHomeUsageActivityChart(records, filter, startDate) {
    const container = document.getElementById("lazydev-home-activity-chart");
    if (!container || typeof renderLazydevHomeUsageChart !== "function") {
      return;
    }
    const mediaKinds = [
      { key: "image", label: "Image" },
      { key: "model3d", label: "3D Model" },
      { key: "audio", label: "Audio" },
      { key: "music", label: "Music" },
      { key: "video", label: "Video" }
    ];
    const visibleKinds = filter === "all" ? mediaKinds : mediaKinds.filter(entry => entry.key === filter);
    const labels = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    });
    renderLazydevHomeUsageChart(container, {
      labels,
      series: visibleKinds.map(kind => ({
        ...kind,
        values: getHomeUsageBuckets(records.filter(record => record.kind === kind.key), "count", startDate)
      })),
      accessibleLabel: (filter === "all" ? "All media" : visibleKinds[0]?.label || "Media") + " generation activity for the recent seven days"
    });
  }

  function renderHomeUsageOverview(records) {
    const container = document.getElementById("lazydev-home-usage-overview");
    if (!container) {
      return;
    }
    clearChildren(container);
    const rangeLabel = document.getElementById("lazydev-home-usage-range");
    if (rangeLabel) {
      rangeLabel.textContent = records.length > 0 ? "Recent 7 days" : "No activity yet";
    }
    const filteredRecords = getHomeFilteredRecords(records, "usage");
    const filter = normalizeHomeFilter(studioHomeFilters.usage);
    const usageStartDate = getHomeUsageStartDate(records);
    const generationSeries = getHomeUsageBuckets(filteredRecords, "count", usageStartDate);
    const durationSeries = getHomeUsageBuckets(filteredRecords, "duration", usageStartDate);
    const totalDurationMs = filteredRecords.reduce((sum, record) => sum + getHomeRecordDurationMs(record), 0);
    const timedRecords = filteredRecords.filter(record => getHomeRecordDurationMs(record) > 0);
    const totalStorageBytes = filteredRecords.reduce((sum, record) => sum + getHomeRecordFileSizeBytes(record), 0);
    const activeDays = generationSeries.filter(value => value > 0).length;
    const averagePerActiveDay = activeDays > 0 ? filteredRecords.length / activeDays : 0;
    const latestRecord = filteredRecords[0] || null;
    container.append(
      createHomeUsageMetric({
        label: "Generations",
        value: formatHomeCompactNumber(filteredRecords.length),
        detail: activeDays > 0 ? activeDays + " active day" + (activeDays === 1 ? "" : "s") + " in range" : "No recent generations",
        series: generationSeries,
        styleKey: "generations"
      }),
      createHomeUsageMetric({
        label: "Generation Time",
        value: formatHomeDuration(totalDurationMs),
        detail: timedRecords.length > 0 ? formatHomeDuration(totalDurationMs / timedRecords.length) + " average when tracked" : "No tracked durations yet",
        series: durationSeries,
        styleKey: "duration"
      }),
      createHomeUsageMetric({
        label: "Avg / Active Day",
        value: averagePerActiveDay > 0 ? averagePerActiveDay.toFixed(averagePerActiveDay >= 10 ? 0 : 1).replace(/\.0$/, "") : "0",
        detail: getHomePeakDay(generationSeries, filteredRecords, usageStartDate),
        series: generationSeries,
        styleKey: "velocity"
      }),
      createHomeUsageMix(filteredRecords),
      createHomeUsageMetric({
        label: "Known Storage",
        value: formatHomeStorage(totalStorageBytes),
        detail: totalStorageBytes > 0 ? "From records with file-size metadata" : "Waiting for size metadata",
        series: getHomeUsageBuckets(filteredRecords, "storage", usageStartDate),
        styleKey: "storage"
      }),
      createHomeUsageMetric({
        label: "Latest Output",
        value: latestRecord ? latestRecord.label : "None",
        detail: latestRecord ? formatHomeDate(latestRecord.date) || "Recently indexed" : "No " + (filter === "all" ? "media" : filter) + " records yet",
        series: generationSeries,
        styleKey: "latest"
      })
    );
    renderHomeUsageActivityChart(records, filter, usageStartDate);
  }

  function selectHomeMediaRecord(record) {
    if (!record?.id) {
      return;
    }
    if (record.kind === "image") {
      input.state.selectedGeneratedImageId = record.id;
      input.state.selectedGeneratedImageIds = [record.id];
    } else if (record.kind === "model3d") {
      input.state.selectedGeneratedModelId = record.id;
      input.state.selectedGeneratedModelIds = [record.id];
    } else if (record.kind === "video") {
      input.state.selectedGeneratedVideoId = record.id;
      input.state.selectedGeneratedVideoIds = [record.id];
    } else if (record.kind === "music") {
      input.state.selectedGeneratedMusicId = record.id;
      input.state.selectedGeneratedMusicIds = [record.id];
    } else if (record.kind === "audio") {
      input.state.selectedGeneratedAudioId = record.id;
      input.state.selectedGeneratedAudioIds = [record.id];
    }
    openAiSection(record.targetId, { focusOnly: true });
  }

  function appendHomeThumb(parent, record, className = "studio-home-project-thumb") {
    const thumb = document.createElement("span");
    thumb.className = className + " is-" + record.kind;
    if (record.url && (record.kind === "image" || record.kind === "model3d")) {
      const image = document.createElement("img");
      image.alt = record.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.src = record.url;
      thumb.appendChild(image);
    } else if (record.url && record.kind === "video") {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = record.url;
      thumb.appendChild(video);
    } else {
      const fallbackIcon = document.createElement("i");
      fallbackIcon.className = "bi " + (homeMediaFallbackIcons[record.kind] || "bi-file-earmark") + " studio-home-media-fallback-icon";
      fallbackIcon.setAttribute("aria-hidden", "true");
      thumb.appendChild(fallbackIcon);
    }
    parent.appendChild(thumb);
  }

  function createHomeProjectCard(record) {
    const button = document.createElement("button");
    button.className = "studio-home-project-card";
    button.type = "button";
    button.addEventListener("click", () => {
      selectHomeMediaRecord(record);
    });
    appendHomeThumb(button, record);
    const copy = document.createElement("span");
    copy.className = "studio-home-project-copy";
    const title = document.createElement("strong");
    title.textContent = record.title;
    const meta = document.createElement("span");
    const formattedDate = formatHomeDate(record.date);
    meta.textContent = record.label + (formattedDate ? " - " + formattedDate : "");
    copy.append(title, meta);
    const more = document.createElement("span");
    more.className = "studio-home-more-button";
    more.setAttribute("aria-hidden", "true");
    more.textContent = "...";
    button.append(copy, more);
    return button;
  }

  function renderHomeProjectList(listId, emptyId, records, limit, emptyText) {
    const list = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    if (!list) {
      return;
    }
    clearChildren(list);
    const visibleRecords = records.slice(0, limit);
    if (empty) {
      empty.textContent = emptyText;
      empty.classList.toggle("hidden", visibleRecords.length > 0);
    }
    visibleRecords.forEach(record => {
      list.appendChild(createHomeProjectCard(record));
    });
  }

  function createHomeCurrentProjectCard(record, classPrefix) {
    const button = document.createElement("button");
    button.className = classPrefix + "-card";
    button.type = "button";
    button.addEventListener("click", () => {
      selectHomeMediaRecord(record);
    });
    appendHomeThumb(button, record, classPrefix + "-thumb");
    const copy = document.createElement("span");
    copy.className = classPrefix + "-copy";
    const eyebrow = document.createElement("small");
    eyebrow.textContent = record.label + (record.date ? " · " + formatHomeDate(record.date) : "");
    const title = document.createElement("strong");
    title.textContent = record.title;
    const action = document.createElement("span");
    action.className = classPrefix + "-action";
    action.textContent = "Open in " + record.label;
    copy.append(eyebrow, title, action);
    button.append(copy);
    return button;
  }

  function createLazydevCurrentProjectCard(record) {
    return createHomeCurrentProjectCard(record, "lazydev-home-current-project");
  }

  function renderHomeCurrentProject(containerId, emptyId, records, emptyText) {
    const container = document.getElementById(containerId);
    const empty = document.getElementById(emptyId);
    if (!container) {
      return;
    }
    clearChildren(container);
    const currentRecord = records[0];
    if (empty) {
      empty.textContent = emptyText;
      empty.classList.toggle("hidden", Boolean(currentRecord));
    }
    if (currentRecord) {
      container.appendChild(createHomeCurrentProjectCard(currentRecord, "studio-home-current-project"));
    }
  }

  function renderLazydevHomeContinue(records, emptyText) {
    const current = document.getElementById("lazydev-home-current-project");
    const recent = document.getElementById("lazydev-home-recent-projects");
    const empty = document.getElementById("lazydev-home-recent-projects-empty");
    if (!current || !recent) {
      return;
    }
    clearChildren(current);
    clearChildren(recent);
    const hasRecords = records.length > 0;
    if (empty) {
      empty.textContent = emptyText;
      empty.classList.toggle("hidden", hasRecords);
    }
    if (!hasRecords) {
      return;
    }
    current.appendChild(createLazydevCurrentProjectCard(records[0]));
    records.slice(1, 5).forEach(record => {
      recent.appendChild(createHomeProjectCard(record));
    });
  }

  function createHomeActivityItem(record) {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => {
      selectHomeMediaRecord(record);
    });
    const copy = document.createElement("span");
    copy.className = "studio-home-activity-copy";
    const title = document.createElement("strong");
    title.textContent = record.title;
    const detail = document.createElement("small");
    detail.textContent = record.label + (record.date ? " - " + formatHomeDate(record.date) : "");
    copy.append(title, detail);
    const time = document.createElement("small");
    time.className = "studio-home-activity-time";
    time.textContent = formatHomeDate(record.date);
    button.append(copy, time);
    appendHomeThumb(button, record, "studio-home-activity-preview");
    return button;
  }

  function renderHomeActivity(records) {
    const container = document.getElementById("lazydev-home-activity-list");
    if (!container) {
      return;
    }
    clearChildren(container);
    // Keep the timeline scannable inside the fixed home workspace; the full
    // history remains available from the relevant studio.
    const visibleRecords = getHomeFilteredRecords(records, "activity").slice(0, 5);
    if (visibleRecords.length === 0) {
      const empty = document.createElement("div");
      empty.className = "studio-home-empty";
      empty.textContent = "No recent activity yet.";
      container.appendChild(empty);
      return;
    }
    visibleRecords.forEach(record => {
      container.appendChild(createHomeActivityItem(record));
    });
  }

  function renderHomePinnedItems() {
    const container = document.getElementById("lazydev-home-pinned-list");
    if (!container) {
      return;
    }
    clearChildren(container);
    const empty = document.createElement("div");
    empty.className = "studio-home-empty";
    empty.textContent = "No pinned items yet.";
    container.appendChild(empty);
  }

  function syncHomeFilterTabs() {
    document.querySelectorAll("[data-lazydev-home-filter-scope]").forEach(button => {
      const scope = String(button.getAttribute("data-lazydev-home-filter-scope") || "").trim();
      const filter = normalizeHomeFilter(button.getAttribute("data-lazydev-home-filter"));
      const active = normalizeHomeFilter(studioHomeFilters[scope] || "all") === filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const actionFilter = normalizeHomeFilter(studioHomeFilters.actions);
    document.querySelectorAll("[data-lazydev-home-action-kind]").forEach(button => {
      const kind = normalizeHomeFilter(button.getAttribute("data-lazydev-home-action-kind"));
      button.classList.toggle("hidden", actionFilter !== "all" && actionFilter !== kind);
    });
  }

  function getStudioHomeSearchTargets(scope) {
    const selector = scope === "workflow"
      ? ".lazydev-home-card .lazydev-home-workflow-button, .lazydev-home-card .lazydev-home-current-project-card, .lazydev-home-card .studio-home-project-card, .lazydev-home-activity-list button"
      : ".studio-home-overview-only .studio-workflow-quick-tile, .studio-home-feature-grid .studio-home-feature-card, .studio-home-workbench .studio-home-current-project-card, .studio-home-workbench .studio-home-project-card";
    return document.querySelectorAll(selector);
  }

  function applyStudioHomeSearch(searchInput) {
    const scope = String(searchInput?.getAttribute("data-studio-home-search") || "studio").trim();
    const query = String(searchInput?.value || "").trim().toLocaleLowerCase();
    getStudioHomeSearchTargets(scope).forEach(target => {
      const searchableText = String(target.textContent || "").toLocaleLowerCase();
      target.hidden = Boolean(query) && !searchableText.includes(query);
    });
  }

  function bindStudioHomeSearch() {
    document.querySelectorAll("[data-studio-home-search]").forEach(searchInput => {
      searchInput.addEventListener("input", () => applyStudioHomeSearch(searchInput));
      searchInput.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !searchInput.value) return;
        searchInput.value = "";
        applyStudioHomeSearch(searchInput);
      });
    });
  }

  function renderStudioHome() {
    const records = buildHomeMediaRecords();
    const emptyText = "No generated projects yet. Open a workflow and create media to populate this list.";
    renderHomeProjectList("studio-home-recent-projects", "studio-home-recent-projects-empty", records, 4, emptyText);
    renderHomeCurrentProject("studio-home-current-project", "studio-home-current-project-empty", records, emptyText);
    renderLazydevHomeContinue(records, emptyText);
    renderHomeActivity(records);
    renderHomeUsageOverview(records);
    renderHomePinnedItems();
    syncHomeFilterTabs();
    document.querySelectorAll("[data-studio-home-search]").forEach(applyStudioHomeSearch);
  }

  function bindLazyDevHomeFilters() {
    document.addEventListener("click", event => {
      const button = event.target instanceof Element ? event.target.closest("[data-lazydev-home-filter-scope][data-lazydev-home-filter]") : null;
      if (!button) return;
      const scope = String(button.getAttribute("data-lazydev-home-filter-scope") || "").trim();
      if (!Object.prototype.hasOwnProperty.call(studioHomeFilters, scope)) return;
      studioHomeFilters[scope] = normalizeHomeFilter(button.getAttribute("data-lazydev-home-filter"));
      renderStudioHome();
    });
  }

  async function ensureStudioHomeDataLoaded() {
    if (studioHomeDataLoaded || studioHomeDataLoading) {
      renderStudioHome();
      return;
    }
    studioHomeDataLoading = true;
    try {
      const tasks = [];
      if (typeof input.loadImageHistory === "function") tasks.push(input.loadImageHistory(input.state.selectedGeneratedImageId || ""));
      if (typeof input.loadModel3dHistory === "function") tasks.push(input.loadModel3dHistory(input.state.selectedGeneratedModelId || ""));
      if (typeof input.loadAudioHistory === "function") tasks.push(input.loadAudioHistory(input.state.selectedGeneratedAudioId || "", input.state.selectedGeneratedMusicId || ""));
      if (typeof input.loadVideoHistory === "function") tasks.push(input.loadVideoHistory(input.state.selectedGeneratedVideoId || ""));
      await Promise.allSettled(tasks);
      studioHomeDataLoaded = true;
    } finally {
      studioHomeDataLoading = false;
      renderStudioHome();
    }
  }

  function applyAiSectionFocusState() {
    const focusedId = String(input.state.aiFocusedSectionId || "").trim();
    const overviewMode = focusedId.length === 0;
    const focusedMode = focusedId.length > 0;
    const workflowHomeMode = !focusedMode && input.state.aiHomeMode === "workflow";
    const studioHomeMode = !focusedMode && input.state.aiHomeMode !== "workflow";
    let focusedTitle = "Studio Workflow";
    let focusedSummary = "Focused workflow details are shown here for quick context.";
    if (focusedMode) {
      const focusedCard = document.getElementById(focusedId);
      const titleNode = focusedCard ? focusedCard.querySelector("h3") : null;
      const summaryNode = focusedCard ? focusedCard.querySelector(".panel-subtitle") : null;
      focusedTitle = titleNode ? String(titleNode.textContent || "").trim() || focusedTitle : focusedTitle;
      focusedSummary = summaryNode ? String(summaryNode.textContent || "").trim() || focusedSummary : focusedSummary;
    }
    document.body.classList.toggle("studio-workflow-focused", focusedMode);
    document.body.classList.toggle("studio-workflow-home-active", workflowHomeMode);
    document.body.classList.toggle("studio-home-active", studioHomeMode);
    const aiGrid = document.querySelector(".ai-grid");
    if (aiGrid) {
      aiGrid.classList.toggle("ai-overview-mode", overviewMode);
      aiGrid.classList.toggle("ai-focused-mode", focusedMode);
    }
    document.querySelectorAll(".studio-workflow-quick-card, .studio-view-hero-card, .studio-home-overview-only, .lazydev-home-only").forEach(card => {
      const hideForWorkflowHome = workflowHomeMode && card.classList.contains("studio-home-secondary-card");
      const hideOverview = workflowHomeMode && card.classList.contains("studio-home-overview-only");
      const hideLazyDev = !workflowHomeMode && card.classList.contains("lazydev-home-only");
      const hideLegacy = card.classList.contains("studio-home-legacy-card");
      card.classList.toggle("hidden", focusedMode || hideForWorkflowHome || hideOverview || hideLazyDev || hideLegacy);
    });
    document.querySelectorAll("[data-studio-workflow-detail='true']").forEach(card => {
      card.classList.toggle("hidden", !focusedMode);
      card.querySelectorAll(".detail-studio-workflow-name").forEach(node => {
        node.textContent = focusedTitle;
      });
      card.querySelectorAll(".detail-studio-workflow-summary").forEach(node => {
        node.textContent = focusedSummary;
      });
    });
    document.querySelectorAll(".ai-section-target").forEach(card => {
      const shouldHide = focusedMode ? card.id !== focusedId : true;
      card.classList.toggle("ai-section-hidden", shouldHide);
      card.setAttribute("aria-hidden", shouldHide ? "true" : "false");
      if (shouldHide) {
        card.style.setProperty("display", "none", "important");
      } else {
        card.style.removeProperty("display");
      }
    });
    document.querySelectorAll("[data-ai-scroll-target]").forEach(button => {
      const targetId = button.getAttribute("data-ai-scroll-target") || "";
      const isActiveTarget = focusedId.length > 0 && targetId === focusedId;
      button.classList.toggle("active-focus", isActiveTarget);
      if (button.classList.contains("nav-link")) {
        button.classList.toggle("active", isActiveTarget);
      }
    });
    const clearButton = document.getElementById("ai-clear-focus-button");
    if (clearButton) {
      clearButton.classList.toggle("hidden", focusedId.length === 0);
    }
    renderStudioHome();
  }

  function setAiSectionFocus(sectionId) {
    input.state.aiFocusedSectionId = String(sectionId || "").trim();
    applyAiSectionFocusState();
    resetAiFocusScroll();
    if (typeof input.onFocusChanged === "function") {
      input.onFocusChanged(input.state.aiFocusedSectionId);
    }
  }

  function resetAiFocusScroll() {
    [document.querySelector(".content-shell"), document.querySelector(".view[data-view-panel='ai']")].forEach(node => {
      if (node) {
        node.scrollTop = 0;
        node.scrollLeft = 0;
      }
    });
  }

  function clearAiSectionFocus() {
    setAiSectionFocus("");
  }

  function getAiSectionTargetForNode(node) {
    return node instanceof HTMLElement ? node.closest(".ai-section-target") : null;
  }

  function revealStudioSidebarTarget(targetNode) {
    if (!(targetNode instanceof HTMLElement)) {
      return;
    }
    targetNode.closest(".studio-side-foldout")?.setAttribute("open", "");
    const bottomPanel = targetNode.closest("[data-sidebar-bottom-panel]");
    const shell = targetNode.closest("[data-sidebar-split-shell]");
    if (bottomPanel instanceof HTMLElement && shell instanceof HTMLElement) {
      const activeTab = String(bottomPanel.getAttribute("data-sidebar-bottom-panel") || "preview").trim() || "preview";
      shell.querySelectorAll("[data-sidebar-bottom-tab]").forEach(button => {
        const isActive = button.getAttribute("data-sidebar-bottom-tab") === activeTab;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      shell.querySelectorAll("[data-sidebar-bottom-panel]").forEach(panel => {
        panel.classList.toggle("hidden", panel.getAttribute("data-sidebar-bottom-panel") !== activeTab);
      });
    }
  }

  function openAiSection(sectionId, options) {
    const targetId = String(sectionId || "").trim();
    if (!targetId) {
      return;
    }
    const targetNode = document.getElementById(targetId);
    const isWorkflowTarget = !!(targetNode && targetNode.classList.contains("ai-section-target"));
    const workflowParent = isWorkflowTarget ? targetNode : getAiSectionTargetForNode(targetNode);
    const focusOnly = options && typeof options.focusOnly === "boolean" ? options.focusOnly : isWorkflowTarget;
    if (focusOnly) {
      setAiSectionFocus(targetId);
    } else if (workflowParent instanceof HTMLElement) {
      setAiSectionFocus(workflowParent.id);
    }
    input.switchView("ai");
    setTimeout(() => {
      if (!targetNode) {
        return;
      }
      if (focusOnly) {
        resetAiFocusScroll();
        return;
      }
      revealStudioSidebarTarget(targetNode);
      targetNode.scrollIntoView({ block: "start", behavior: "smooth" });
      targetNode.classList.add("ai-target-active");
      setTimeout(() => {
        targetNode.classList.remove("ai-target-active");
      }, 1_100);
    }, 20);
  }

  function moveModel3dAdvancedStackToSourceCard() {
    const advancedButton = document.getElementById("model3d-advanced-settings-button");
    const advancedStack = document.getElementById("model3d-advanced-stack");
    if (!advancedButton || !advancedStack || advancedStack.previousElementSibling === advancedButton) {
      return;
    }
    advancedButton.insertAdjacentElement("afterend", advancedStack);
  }

  function moveImageAdvancedStackToSidebar() {
    const sidebarStack = document.getElementById("image-sidebar-advanced-stack");
    const advancedStack = document.getElementById("image-advanced-stack");
    if (!sidebarStack || !advancedStack || advancedStack.parentElement === sidebarStack) {
      return;
    }
    sidebarStack.appendChild(advancedStack);
  }

  function switchModel3dSourceTab(tab) {
    input.state.model3dSourceTab = tab === "pool" ? "pool" : "upload";
    document.querySelectorAll("[data-model3d-source-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-model3d-source-tab") === input.state.model3dSourceTab);
    });
    document.querySelectorAll("[data-model3d-source-panel]").forEach(panel => {
      panel.classList.toggle("hidden", panel.getAttribute("data-model3d-source-panel") !== input.state.model3dSourceTab);
    });
    input.renderModel3dUploadSourceList();
    if (input.state.imagePoolDataLoaded !== true) {
      void input.ensureImagePoolDataLoaded().catch(() => {});
    }
    input.renderModel3dPoolSelectionList();
  }

  function switchModel3dEditTargetMode(mode) {
    input.state.model3dEditTargetMode = mode === "upload" ? "upload" : "selected";
    document.querySelectorAll("[data-model3d-edit-target]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-model3d-edit-target") === input.state.model3dEditTargetMode);
    });
    const selectedField = document.getElementById("model3d-edit-selected-target-field");
    const uploadField = document.getElementById("model3d-edit-upload-target-field");
    if (selectedField) {
      selectedField.classList.toggle("hidden", input.state.model3dEditTargetMode !== "selected");
    }
    if (uploadField) {
      uploadField.classList.toggle("hidden", input.state.model3dEditTargetMode !== "upload");
    }
  }

  function switchModel3dStudioTab(tab) {
    input.state.model3dStudioTab = tab === "edit" || tab === "rigging" ? tab : "generate";
    document.querySelectorAll("[data-model3d-studio-tab]").forEach(button => {
      const active = button.getAttribute("data-model3d-studio-tab") === input.state.model3dStudioTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-model3d-action-tab]").forEach(button => {
      const active = button.getAttribute("data-model3d-action-tab") === input.state.model3dStudioTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const generatePanel = document.getElementById("model3d-studio-panel-generate");
    if (generatePanel) {
      generatePanel.classList.toggle("active", input.state.model3dStudioTab === "generate");
    }
    const workflowField = document.getElementById("model3d-generate-workflow-field");
    if (workflowField) {
      workflowField.classList.toggle("hidden", input.state.model3dStudioTab !== "generate");
    }
    const editPanel = document.getElementById("model3d-studio-panel-edit");
    if (editPanel) {
      editPanel.classList.toggle("active", input.state.model3dStudioTab === "edit");
    }
    const riggingPanel = document.getElementById("model3d-studio-panel-rigging");
    if (riggingPanel) {
      riggingPanel.classList.toggle("active", input.state.model3dStudioTab === "rigging");
    }
    const sidebarAdvancedStack = document.getElementById("model3d-sidebar-advanced-stack");
    if (sidebarAdvancedStack) {
      sidebarAdvancedStack.classList.toggle("hidden", input.state.model3dStudioTab !== "generate");
    }
    input.updateModel3dPostOptionsUi();
    void input.renderModel3dViewer();
  }

  function switchModel3dGenerateWorkflow(value) {
    input.state.model3dGenerateWorkflow = value === "multiview" ? "multiview" : "single-image";
    const select = document.getElementById("model3d-generate-workflow-select");
    if (select && typeof select.value === "string") {
      select.value = input.state.model3dGenerateWorkflow;
    }
    const hint = document.getElementById("model3d-generate-workflow-hint");
    if (hint) {
      hint.textContent = input.state.model3dGenerateWorkflow === "multiview"
        ? "MultiView uses the selected sources as Front, Back, Left, and Right. Front and Back are required, while Left and Right are optional."
        : "Single Image uses the standard 3D model workflow.";
    }
    if (typeof input.updateModel3dSourceHint === "function") {
      input.updateModel3dSourceHint();
    }
  }

  function switchImageStudioTab(tab) {
    input.state.imageStudioTab = tab === "edit" ? "edit" : "generate";
    const imageStudioCard = document.getElementById("image-studio-card");
    if (imageStudioCard) {
      imageStudioCard.classList.toggle("image-studio-edit-mode", input.state.imageStudioTab === "edit");
      imageStudioCard.classList.toggle("image-studio-generate-mode", input.state.imageStudioTab !== "edit");
    }
    document.querySelectorAll("[data-image-studio-tab]").forEach(button => {
      const active = button.getAttribute("data-image-studio-tab") === input.state.imageStudioTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-image-action-tab]").forEach(button => {
      const active = button.getAttribute("data-image-action-tab") === input.state.imageStudioTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const generatePanel = document.getElementById("image-studio-panel-generate");
    if (generatePanel) {
      generatePanel.classList.toggle("active", input.state.imageStudioTab === "generate");
    }
    const editPanel = document.getElementById("image-studio-panel-edit");
    if (editPanel) {
      editPanel.classList.toggle("active", input.state.imageStudioTab === "edit");
    }
    updateGenerateImageButtonLabel();
    const sidebarAdvancedStack = document.getElementById("image-sidebar-advanced-stack");
    if (sidebarAdvancedStack) {
      sidebarAdvancedStack.classList.toggle("hidden", input.state.imageStudioTab !== "generate");
    }
    if (input.state.imageStudioTab === "edit" && typeof input.refreshImageEditSourceOptions === "function") {
      input.refreshImageEditSourceOptions();
    }
    if (typeof input.syncImageStudioPreviewTarget === "function") {
      input.syncImageStudioPreviewTarget();
    }
  }

  function updateGenerateImageButtonLabel() {
    const generateImageButton = document.getElementById("generate-image-button");
    if (!generateImageButton) {
      return;
    }
    const separateImages = document.getElementById("image-identify-objects-toggle")?.checked === true;
    const label = input.state.imageStudioTab === "edit"
      ? "Apply Edit"
      : (separateImages ? "Generate separate Images" : "Generate Image");
    const labelNode = generateImageButton.querySelector("span:not(.button-icon)");
    if (labelNode) {
      labelNode.textContent = label;
      return;
    }
    generateImageButton.textContent = label;
  }

  function switchAudioStudioTab(tab) {
    const allowedTab = ["sfx", "tts", "stt", "sts"].includes(tab) ? tab : "sfx";
    input.state.audioStudioTab = allowedTab;
    document.querySelectorAll("[data-audio-studio-tab]").forEach(button => {
      button.classList.toggle("active", button.getAttribute("data-audio-studio-tab") === input.state.audioStudioTab);
    });
    document.querySelectorAll("[id^='audio-studio-panel-']").forEach(panel => {
      panel.classList.toggle("active", panel.id === ("audio-studio-panel-" + input.state.audioStudioTab));
    });
  }

  // =========================================================
  // TAB EVENT BINDING FUNCTIONS
  // =========================================================

  function bindModel3dStudioTabs() {
    document.querySelectorAll("[data-model3d-studio-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.getAttribute("data-model3d-studio-tab") || "";
        switchModel3dStudioTab(tab);
      });
    });
    document.querySelectorAll("[data-model3d-action-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.getAttribute("data-model3d-action-tab") || "";
        switchModel3dStudioTab(tab);
      });
    });
    const workflowSelect = document.getElementById("model3d-generate-workflow-select");
    if (workflowSelect) {
      workflowSelect.addEventListener("change", () => {
        switchModel3dGenerateWorkflow(workflowSelect.value);
      });
      switchModel3dGenerateWorkflow(input.state.model3dGenerateWorkflow);
    }
  }

  function bindImageStudioTabs() {
    document.querySelectorAll("[data-image-studio-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.getAttribute("data-image-studio-tab") || "";
        switchImageStudioTab(tab);
      });
    });
    document.querySelectorAll("[data-image-action-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.getAttribute("data-image-action-tab") || "";
        switchImageStudioTab(tab);
      });
    });
  }

  function bindAudioStudioTabs() {
    document.querySelectorAll("[data-audio-studio-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.getAttribute("data-audio-studio-tab") || "";
        switchAudioStudioTab(tab);
      });
    });
  }

  function bindModel3dSourceTabs() {
    document.querySelectorAll("[data-model3d-source-tab]").forEach(button => {
      button.addEventListener("click", () => {
        const tab = button.getAttribute("data-model3d-source-tab") || "";
        switchModel3dSourceTab(tab);
      });
    });
  }

  function bindModel3dEditTargetMode() {
    document.querySelectorAll("[data-model3d-edit-target]").forEach(button => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-model3d-edit-target") || "selected";
        switchModel3dEditTargetMode(mode);
      });
    });
  }

  function bindAllStudioTabs() {
    bindLazyDevHomeFilters();
    bindStudioHomeSearch();
    bindModel3dStudioTabs();
    bindImageStudioTabs();
    bindAudioStudioTabs();
    bindModel3dSourceTabs();
    bindModel3dEditTargetMode();
  }

  bindAllStudioTabs();

  return {
    applyAiSectionFocusState,
    renderStudioHome,
    ensureStudioHomeDataLoaded,
    setAiSectionFocus,
    clearAiSectionFocus,
    openAiSection,
    moveModel3dAdvancedStackToSourceCard,
    moveModel3dAdvancedStackToSidebar: moveModel3dAdvancedStackToSourceCard,
    moveImageAdvancedStackToSidebar,
    switchModel3dSourceTab,
    switchModel3dEditTargetMode,
    switchModel3dStudioTab,
    switchModel3dGenerateWorkflow,
    switchImageStudioTab,
    updateGenerateImageButtonLabel,
    switchAudioStudioTab,
    bindAllStudioTabs,
    bindModel3dStudioTabs,
    bindImageStudioTabs,
    bindAudioStudioTabs,
    bindModel3dSourceTabs,
    bindModel3dEditTargetMode
  };
}
