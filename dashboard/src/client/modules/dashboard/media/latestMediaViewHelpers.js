function createDashboardLatestMediaViewHelpers(input) {
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);

  function getContainer(containerId) {
    return typeof input.getContainer === "function"
      ? input.getContainer(containerId)
      : document.getElementById(containerId);
  }

  function clearMediaContainer(container) {
    input.unobserveMedia(container);
    input.clearChildren(container);
  }

  function appendEmptyState(container, message) {
    const empty = createElement("div");
    empty.className = "item";
    empty.textContent = message;
    container.appendChild(empty);
  }

  function getLatestGifEntries() {
    const generatedEntries = (Array.isArray(input.state.generatedImages) ? input.state.generatedImages : [])
      .filter(entry => /\.gif$/i.test(String(entry.imageFileName || "")))
      .map(entry => ({
        id: "generated:" + entry.id,
        imageId: entry.id,
        fileName: entry.imageFileName,
        url: input.getImageUrl(entry.id, entry.imageFileName),
        createdAt: entry.createdAt,
        source: "Generated"
      }));
    const convertedEntries = (Array.isArray(input.state.mediaConverterGifs) ? input.state.mediaConverterGifs : [])
      .map(entry => ({
        id: "converter:" + String(entry.jobId || "") + ":" + String(entry.fileName || ""),
        fileName: String(entry.fileName || "converted.gif"),
        url: String(entry.url || ""),
        createdAt: entry.createdAt,
        source: "Converted"
      }));
    return generatedEntries.concat(convertedEntries)
      .filter(entry => entry.url)
      .sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""))
      .slice(0, 8);
  }

  function createMediaCard(entry, options = {}) {
    const card = createElement(options.button === true ? "button" : "a");
    card.className = "latest-media-card";
    if (options.mediaOnly === true) card.classList.add("media-only");
    if (options.button === true) {
      card.type = "button";
    } else {
      card.href = input.buildAbsoluteUrl(entry.url);
      card.target = "_blank";
      card.rel = "noopener";
    }
    const media = createElement(options.mediaType === "video" ? "video" : "img");
    input.attachLazyMedia(media, input.buildAbsoluteUrl(entry.url), options.eager === true);
    if (options.mediaType === "video") {
      media.muted = true;
      media.playsInline = true;
      media.preload = "metadata";
      media.setAttribute("aria-hidden", "true");
    } else {
      media.alt = entry.fileName || "Latest media";
      media.loading = "lazy";
      media.decoding = "async";
    }
    card.appendChild(media);
    if (options.mediaOnly !== true) {
      const label = createElement("span");
      label.className = "latest-media-card-label";
      label.textContent = entry.fileName || "media";
      const meta = createElement("span");
      meta.className = "latest-media-card-meta";
      meta.textContent = entry.source || input.formatDateTime(entry.createdAt);
      card.append(label, meta);
    }
    return card;
  }

  function appendDeleteButton(card, label, deleteHandler) {
    if (!card || typeof deleteHandler !== "function") return;
    const action = createElement("span");
    action.className = "latest-media-delete-button";
    action.tabIndex = 0;
    action.title = label || "Delete latest generation";
    action.setAttribute("role", "button");
    action.setAttribute("aria-label", label || "Delete latest generation");
    action.innerHTML = "<span aria-hidden='true'>&#10005;</span>";
    const runDelete = event => {
      event.preventDefault();
      event.stopPropagation();
      void deleteHandler();
    };
    action.addEventListener("click", runDelete);
    action.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") runDelete(event);
    });
    card.appendChild(action);
  }

  function renderGifList(containerId) {
    const container = getContainer(containerId);
    if (!container) return;
    clearMediaContainer(container);
    const entries = getLatestGifEntries();
    if (entries.length === 0) {
      appendEmptyState(container, "No GIFs yet.");
      return;
    }
    entries.forEach(entry => {
      const isStudioList = containerId === "image-latest-gif-list" || containerId === "video-latest-gif-list";
      const card = createMediaCard(entry, isStudioList
        ? {button: true, mediaType: "gif", mediaOnly: true}
        : undefined);
      if (containerId === "image-latest-gif-list") {
        card.title = "Show " + entry.fileName + " in Image Studio preview.";
        if (entry.imageId) {
          appendDeleteButton(card, "Delete generated GIF " + entry.fileName, () => {
            const record = input.state.generatedImages.find(item => item.id === entry.imageId);
            return record ? input.onDeleteImages([record]) : false;
          });
        }
        card.addEventListener("click", event => {
          event.preventDefault();
          input.onShowGif(entry);
        });
        card.addEventListener("dblclick", event => {
          event.preventDefault();
          input.onShowGif(entry);
          input.onOpenFocusViewer(entry);
        });
      }
      container.appendChild(card);
    });
  }

  function renderImageLatestVideoList() {
    const container = getContainer("image-latest-video-list");
    if (!container) return;
    clearMediaContainer(container);
    const entries = input.getLatestVideoEntries().slice(0, 8);
    if (entries.length === 0) {
      appendEmptyState(container, "No videos yet.");
      return;
    }
    entries.forEach(entry => {
      const card = createMediaCard(entry, {button: true, mediaType: "video", mediaOnly: true});
      card.title = "Show " + entry.fileName + " in Image Studio preview.";
      appendDeleteButton(card, "Delete generated video " + entry.fileName, () => {
        const record = input.state.generatedVideos.find(item => item.id === entry.videoId);
        return record ? input.onDeleteVideos([record]) : false;
      });
      card.addEventListener("click", event => {
        event.preventDefault();
        input.onShowVideo(entry);
      });
      card.addEventListener("dblclick", event => {
        event.preventDefault();
        input.onShowVideo(entry);
        input.onOpenFocusViewer(entry);
      });
      container.appendChild(card);
    });
  }

  function renderVideoLatestImageList() {
    const container = getContainer("video-latest-image-list");
    if (!container) return;
    clearMediaContainer(container);
    const entries = (Array.isArray(input.state.generatedImages) ? input.state.generatedImages : []).slice(0, 8);
    if (entries.length === 0) {
      appendEmptyState(container, "No images yet.");
      return;
    }
    entries.forEach(entry => {
      const card = createMediaCard({
        fileName: entry.imageFileName,
        url: input.getImageUrl(entry.id, entry.imageFileName),
        createdAt: entry.createdAt,
        source: input.formatDateTime(entry.createdAt)
      }, {button: true, mediaOnly: true});
      card.title = "Use " + entry.imageFileName + " as the Video Studio start image.";
      appendDeleteButton(card, "Delete generated image " + entry.imageFileName, () => input.onDeleteImages([entry]));
      card.addEventListener("click", event => {
        event.preventDefault();
        void input.onUseImageAsVideoSource(entry);
      });
      container.appendChild(card);
    });
  }

  function renderAskMediaCards(containerId, entries) {
    const container = getContainer(containerId);
    if (!container) return;
    clearMediaContainer(container);
    entries.slice(0, 6).forEach(entry => container.appendChild(createMediaCard(entry)));
  }

  function renderAskAudioList() {
    const container = getContainer("ask-latest-audio-list");
    if (!container) return;
    input.clearChildren(container);
    const entries = (Array.isArray(input.state.generatedAudios) ? input.state.generatedAudios : []).slice(0, 6);
    if (entries.length === 0) {
      appendEmptyState(container, "No audio or music yet.");
      return;
    }
    entries.forEach(entry => {
      const row = createElement("a");
      row.className = "channel-row";
      row.href = input.getAudioUrl(entry.id, entry.audioFileName);
      row.target = "_blank";
      row.rel = "noopener";
      const icon = createElement("span");
      icon.className = "channel-icon";
      icon.textContent = entry.mode === "music" ? "MUS" : "AUD";
      const main = createElement("span");
      main.className = "channel-row-main";
      const name = createElement("span");
      name.className = "channel-row-name";
      name.textContent = entry.audioFileName;
      const kind = createElement("span");
      kind.className = "channel-row-kind";
      kind.textContent = input.formatDateTime(entry.createdAt);
      main.append(name, kind);
      row.append(icon, main);
      container.appendChild(row);
    });
  }

  function renderAskLists() {
    renderAskMediaCards("ask-latest-image-list", (input.state.generatedImages || []).map(entry => ({
      fileName: entry.imageFileName,
      url: input.getImageUrl(entry.id, entry.imageFileName),
      createdAt: entry.createdAt,
      source: "Image"
    })));
    renderAskMediaCards("ask-latest-video-list", (input.state.generatedVideos || []).map(entry => ({
      fileName: entry.videoFileName,
      url: input.getVideoUrl(entry.id, entry.videoFileName),
      createdAt: entry.createdAt,
      source: "Video"
    })));
    renderAskAudioList();
  }

  function render() {
    renderGifList("image-latest-gif-list");
    renderImageLatestVideoList();
    renderGifList("video-latest-gif-list");
    renderGifList("ask-latest-gif-list");
    renderVideoLatestImageList();
    renderAskLists();
  }

  return {getLatestGifEntries, render};
}
