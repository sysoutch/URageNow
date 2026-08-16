function createDashboardToolExportDescriptors(input) {
  const buildAbsoluteDashboardUrl = input.buildAbsoluteUrl;
  const getToolWorkspaceSendCandidates = input.getSendCandidates;
  const toolsWorkspaceExportState = {
    get activeTab() {
      return input.getActiveTab();
    }
  };
  function inferToolWorkspaceMimeType(fileName, fallback) {
    const normalized = String(fileName || "").trim().toLowerCase();
    if (normalized.endsWith(".png")) return "image/png";
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
    if (normalized.endsWith(".webp")) return "image/webp";
    if (normalized.endsWith(".gif")) return "image/gif";
    if (normalized.endsWith(".glb")) return "model/gltf-binary";
    if (normalized.endsWith(".gltf")) return "model/gltf+json";
    if (normalized.endsWith(".fbx")) return "model/fbx";
    if (normalized.endsWith(".obj")) return "model/obj";
    if (normalized.endsWith(".mp4")) return "video/mp4";
    if (normalized.endsWith(".webm")) return "video/webm";
    if (normalized.endsWith(".mp3")) return "audio/mpeg";
    if (normalized.endsWith(".wav")) return "audio/wav";
    if (normalized.endsWith(".ogg")) return "audio/ogg";
    return String(fallback || "").trim();
  }
  function toAbsoluteToolWorkspaceUrl(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return "";
    }
    if (/^(?:https?:|blob:|data:)/i.test(normalized) || /^\/\//.test(normalized)) {
      return normalized;
    }
    return buildAbsoluteDashboardUrl(normalized);
  }
  function normalizeToolWorkspaceAssetKind(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "image" || normalized === "gif" || normalized === "video" || normalized === "audio" || normalized === "music" || normalized === "text" || normalized === "model3d") {
      return normalized;
    }
    return "file";
  }
  function inferToolWorkspaceAssetKindFromMimeType(mimeType, fallbackKind) {
    const normalized = String(mimeType || "").trim().toLowerCase();
    if (normalized === "image/gif") return "gif";
    if (normalized.startsWith("image/")) return "image";
    if (normalized.startsWith("video/")) return "video";
    if (normalized.startsWith("audio/")) return normalizeToolWorkspaceAssetKind(fallbackKind) === "music" ? "music" : "audio";
    if (normalized.startsWith("text/")) return "text";
    if (normalized.startsWith("model/")) return "model3d";
    return normalizeToolWorkspaceAssetKind(fallbackKind);
  }
  function buildToolWorkspaceFileStem(value, fallback) {
    const cleaned = String(value || "").trim().replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
    return cleaned || fallback;
  }
  function buildToolWorkspaceFallbackFileName(entry, extension, fallbackStem) {
    const stem = buildToolWorkspaceFileStem(entry?.title || entry?.id || fallbackStem, fallbackStem);
    return stem + extension;
  }
  function inferToolWorkspaceFileNameFromUrl(sourceUrl, fallbackName) {
    const normalized = String(sourceUrl || "").trim();
    if (!normalized) {
      return String(fallbackName || "").trim();
    }
    try {
      const parsed = new URL(normalized, window.location.href);
      const candidate = decodeURIComponent((parsed.pathname.split("/").pop() || "").trim());
      return candidate || String(fallbackName || "").trim();
    } catch {
      const candidate = normalized.split("?")[0]?.split("#")[0]?.split("/").pop() || "";
      return candidate.trim() || String(fallbackName || "").trim();
    }
  }
  function isToolWorkspaceElementVisible(node) {
    if (!node || node.nodeType !== 1 || node.hidden) {
      return false;
    }
    try {
      const view = node.ownerDocument?.defaultView || window;
      const style = view.getComputedStyle(node);
      if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0) {
        return false;
      }
      const rect = typeof node.getBoundingClientRect === "function" ? node.getBoundingClientRect() : null;
      return !!rect && rect.width > 6 && rect.height > 6;
    } catch {
      return false;
    }
  }
  function inferToolWorkspaceDescriptorFromLink(link, entry) {
    const rawHref = String(link?.getAttribute("href") || link?.href || "").trim();
    if (!rawHref || /^(?:javascript|mailto|tel):/i.test(rawHref)) {
      return null;
    }
    const href = toAbsoluteToolWorkspaceUrl(link?.href || rawHref);
    if (!href) {
      return null;
    }
    const fileName = inferToolWorkspaceFileNameFromUrl(href, String(link?.download || "").trim() || buildToolWorkspaceFallbackFileName(entry, ".bin", "tool-output"));
    const mimeType = inferToolWorkspaceMimeType(fileName, "");
    const kind = inferToolWorkspaceAssetKindFromMimeType(mimeType, "file");
    const previewKind = kind === "file" ? "file" : kind;
    return {
      kind,
      title: fileName || entry?.title || "Tool Resource",
      fileName,
      mimeType,
      sourceUrl: href,
      previewKind,
      previewUrl: kind === "text" || kind === "file" ? "" : href,
      metadata: { inferenceSource: "download-link" }
    };
  }
  function scoreToolWorkspaceExportLink(link) {
    const href = String(link?.getAttribute("href") || "").trim();
    const fileName = String(link?.getAttribute("download") || "").trim() || inferToolWorkspaceFileNameFromUrl(href, "");
    let score = 0;
    if (link?.hasAttribute("download")) score += 5;
    if (/\bdownload\b/i.test(String(link?.textContent || ""))) score += 3;
    if (/\.(?:png|jpe?g|webp|gif|glb|gltf|fbx|obj|mp4|webm|mov|mp3|wav|ogg|txt|md|svg|zip)$/i.test(fileName)) score += 4;
    if (/^data:/i.test(href)) score += 2;
    return score;
  }
  function getToolWorkspaceOutputLabel(node, fallback) {
    const direct = String(node?.getAttribute?.("data-export-label") || node?.getAttribute?.("aria-label") || node?.getAttribute?.("title") || "").trim();
    if (direct) {
      return direct;
    }
    const container = node?.closest?.("figure, [data-output], [data-result], .result, .output, .card, .panel") || null;
    const heading = container?.querySelector?.("[data-title], figcaption, h1, h2, h3, h4, strong") || null;
    return String(heading?.textContent || fallback || "").trim();
  }
  function sortToolWorkspaceElementsByArea(nodes) {
    return Array.from(nodes || []).sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    });
  }
  function inferToolWorkspaceDescriptorFromCanvasNode(canvas, entry, index) {
    if (!canvas) {
      return null;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const title = getToolWorkspaceOutputLabel(canvas, entry?.title || "Tool Image") || entry?.title || "Tool Image";
      return {
        kind: "image",
        title,
        fileName: buildToolWorkspaceFallbackFileName({ ...entry, title: title || entry?.title }, ".png", index > 0 ? "tool-image-" + String(index + 1) : "tool-image"),
        mimeType: "image/png",
        dataUrl,
        width: Number.isFinite(canvas.width) ? canvas.width : undefined,
        height: Number.isFinite(canvas.height) ? canvas.height : undefined,
        previewKind: "image",
        previewUrl: dataUrl,
        metadata: { inferenceSource: "canvas" }
      };
    } catch {
      return null;
    }
  }
  function inferToolWorkspaceDescriptorsFromCanvases(doc, entry) {
    return sortToolWorkspaceElementsByArea(Array.from(doc.querySelectorAll("canvas")).filter(isToolWorkspaceElementVisible))
      .filter(canvas => {
        const rect = canvas.getBoundingClientRect();
        return rect.width >= 32 && rect.height >= 32;
      })
      .slice(0, 8)
      .map((canvas, index) => inferToolWorkspaceDescriptorFromCanvasNode(canvas, entry, index))
      .filter(Boolean);
  }
  function inferToolWorkspaceDescriptorFromCanvas(doc, entry) {
    return inferToolWorkspaceDescriptorsFromCanvases(doc, entry)[0] || null;
  }
  function inferToolWorkspaceDescriptorFromVideoNode(video, entry, index) {
    const sourceUrl = toAbsoluteToolWorkspaceUrl(video.currentSrc || video.src || video.querySelector?.("source[src]")?.getAttribute("src") || "");
    if (!sourceUrl) return null;
    const fileName = inferToolWorkspaceFileNameFromUrl(sourceUrl, buildToolWorkspaceFallbackFileName(entry, ".mp4", index > 0 ? "tool-video-" + String(index + 1) : "tool-video"));
    return {
      kind: "video",
      title: getToolWorkspaceOutputLabel(video, fileName || entry?.title || "Tool Video") || fileName || entry?.title || "Tool Video",
      fileName,
      mimeType: inferToolWorkspaceMimeType(fileName, "video/mp4"),
      sourceUrl,
      previewKind: "video",
      previewUrl: sourceUrl,
      metadata: { inferenceSource: "video-element" }
    };
  }
  function inferToolWorkspaceDescriptorFromAudioNode(audio, entry, index) {
    const sourceUrl = toAbsoluteToolWorkspaceUrl(audio.currentSrc || audio.src || audio.querySelector?.("source[src]")?.getAttribute("src") || "");
    if (!sourceUrl) return null;
    const fileName = inferToolWorkspaceFileNameFromUrl(sourceUrl, buildToolWorkspaceFallbackFileName(entry, ".mp3", index > 0 ? "tool-audio-" + String(index + 1) : "tool-audio"));
    return {
      kind: "audio",
      title: getToolWorkspaceOutputLabel(audio, fileName || entry?.title || "Tool Audio") || fileName || entry?.title || "Tool Audio",
      fileName,
      mimeType: inferToolWorkspaceMimeType(fileName, "audio/mpeg"),
      sourceUrl,
      previewKind: "audio",
      previewUrl: sourceUrl,
      metadata: { inferenceSource: "audio-element" }
    };
  }
  function inferToolWorkspaceDescriptorFromImageNode(image, entry, index) {
    const sourceUrl = toAbsoluteToolWorkspaceUrl(image.currentSrc || image.src || "");
    if (!sourceUrl) return null;
    const fileName = inferToolWorkspaceFileNameFromUrl(sourceUrl, buildToolWorkspaceFallbackFileName(entry, ".png", index > 0 ? "tool-image-" + String(index + 1) : "tool-image"));
    const mimeType = inferToolWorkspaceMimeType(fileName, "image/png");
    const kind = inferToolWorkspaceAssetKindFromMimeType(mimeType, "image");
    return {
      kind,
      title: getToolWorkspaceOutputLabel(image, fileName || entry?.title || "Tool Image") || fileName || entry?.title || "Tool Image",
      fileName,
      mimeType,
      sourceUrl,
      previewKind: kind,
      previewUrl: sourceUrl,
      metadata: { inferenceSource: "image-element" }
    };
  }
  function inferToolWorkspaceDescriptorsFromMedia(doc, entry) {
    const videos = sortToolWorkspaceElementsByArea(Array.from(doc.querySelectorAll("video")).filter(isToolWorkspaceElementVisible))
      .slice(0, 6)
      .map((video, index) => inferToolWorkspaceDescriptorFromVideoNode(video, entry, index))
      .filter(Boolean);
    const audios = Array.from(doc.querySelectorAll("audio")).filter(isToolWorkspaceElementVisible)
      .slice(0, 6)
      .map((audio, index) => inferToolWorkspaceDescriptorFromAudioNode(audio, entry, index))
      .filter(Boolean);
    const images = sortToolWorkspaceElementsByArea(Array.from(doc.querySelectorAll("img")).filter(isToolWorkspaceElementVisible))
      .filter(image => {
        const rect = image.getBoundingClientRect();
        const sourceUrl = String(image.currentSrc || image.src || "").trim();
        return rect.width >= 32 && rect.height >= 32 && !/^(?:about:blank)?$/i.test(sourceUrl);
      })
      .slice(0, 12)
      .map((image, index) => inferToolWorkspaceDescriptorFromImageNode(image, entry, index))
      .filter(Boolean);
    return [...videos, ...audios, ...images];
  }
  function inferToolWorkspaceDescriptorFromMedia(doc, entry) {
    return inferToolWorkspaceDescriptorsFromMedia(doc, entry)[0] || null;
  }
  function inferToolWorkspaceDescriptorFromText(doc, entry) {
    const candidates = Array.from(doc.querySelectorAll("textarea, pre, code, [data-output-text], [contenteditable='true']"))
      .filter(isToolWorkspaceElementVisible)
      .map(node => {
        const rawText = typeof node.value === "string" ? node.value : node.textContent;
        return { node, text: String(rawText || "").trim() };
      })
      .filter(candidate => candidate.text);
    const best = candidates.sort((left, right) => right.text.length - left.text.length)[0] || null;
    if (!best) {
      return null;
    }
    return {
      kind: "text",
      title: entry?.title || "Tool Text",
      fileName: buildToolWorkspaceFallbackFileName(entry, ".txt", "tool-text"),
      mimeType: "text/plain",
      textContent: best.text,
      previewKind: "text",
      previewText: best.text,
      metadata: { inferenceSource: "text-output" }
    };
  }
  function inferToolWorkspaceCurrentAssetDescriptor(frameNode, entry) {
    const doc = frameNode?.contentDocument || null;
    if (!doc) {
      return null;
    }
    const links = Array.from(doc.querySelectorAll("a[href]")).filter(isToolWorkspaceElementVisible);
    const preferredLink = links.map(link => ({ link, score: scoreToolWorkspaceExportLink(link) })).sort((left, right) => right.score - left.score)[0] || null;
    if (preferredLink && preferredLink.score > 0) {
      return inferToolWorkspaceDescriptorFromLink(preferredLink.link, entry);
    }
    const fromCanvas = inferToolWorkspaceDescriptorFromCanvas(doc, entry);
    if (fromCanvas) {
      return fromCanvas;
    }
    const fromMedia = inferToolWorkspaceDescriptorFromMedia(doc, entry);
    if (fromMedia) {
      return fromMedia;
    }
    return inferToolWorkspaceDescriptorFromText(doc, entry);
  }
  function inferToolWorkspaceCurrentAssetDescriptors(frameNode, entry) {
    const doc = frameNode?.contentDocument || null;
    if (!doc) {
      return [];
    }
    const links = Array.from(doc.querySelectorAll("a[href]")).filter(isToolWorkspaceElementVisible);
    const descriptors = [];
    const seenKeys = new Set();
    const pushDescriptor = descriptor => {
      if (!descriptor || typeof descriptor !== "object") return;
      const key = [
        normalizeToolWorkspaceAssetKind(descriptor.kind),
        String(descriptor.fileName || "").trim().toLowerCase(),
        String(descriptor.sourceUrl || descriptor.dataUrl || descriptor.previewUrl || descriptor.textContent || "").trim().slice(0, 512)
      ].join("|");
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      descriptors.push(descriptor);
    };
    links
      .map(link => ({ link, score: scoreToolWorkspaceExportLink(link) }))
      .filter(candidate => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .forEach(candidate => pushDescriptor(inferToolWorkspaceDescriptorFromLink(candidate.link, entry)));
    inferToolWorkspaceDescriptorsFromCanvases(doc, entry).forEach(pushDescriptor);
    inferToolWorkspaceDescriptorsFromMedia(doc, entry).forEach(pushDescriptor);
    pushDescriptor(inferToolWorkspaceDescriptorFromText(doc, entry));
    return descriptors.slice(0, 20);
  }
  function buildToolWorkspacePreviewFromDescriptor(descriptor, fallbackLabel) {
    const resourceKind = normalizeToolWorkspaceAssetKind(descriptor?.kind);
    const previewKind = normalizeToolWorkspaceAssetKind(descriptor?.previewKind || descriptor?.kind);
    const previewUrl = toAbsoluteToolWorkspaceUrl(descriptor?.previewUrl || descriptor?.sourceUrl || descriptor?.dataUrl);
    const previewText = String(descriptor?.previewText || descriptor?.textContent || "").trim();
    const label = String(descriptor?.previewLabel || descriptor?.fileName || descriptor?.title || fallbackLabel || "Tool Resource").trim() || "Tool Resource";
    if (previewKind === "text" && previewText) {
      return { kind: "text", text: previewText, label };
    }
    if (previewUrl && (previewKind === "image" || previewKind === "gif" || previewKind === "video" || previewKind === "audio" || previewKind === "music")) {
      return { kind: previewKind, url: previewUrl, label };
    }
    return {
      kind: "placeholder",
      label,
      hint: resourceKind === "model3d"
        ? "This model will be queued directly for the selected engine importer."
        : "Preview is not available for this tool resource yet."
    };
  }
  function normalizeToolWorkspaceCurrentAssetDescriptor(descriptor, entry) {
    const resourceKind = normalizeToolWorkspaceAssetKind(descriptor?.kind);
    const fileName = String(descriptor?.fileName || "").trim();
    const title = String(descriptor?.title || fileName || entry?.title || "Tool Resource").trim() || "Tool Resource";
    const sourceUrl = toAbsoluteToolWorkspaceUrl(descriptor?.sourceUrl);
    const dataUrl = String(descriptor?.dataUrl || "").trim();
    const textContent = String(descriptor?.textContent || "").trim();
    const mimeType = String(descriptor?.mimeType || inferToolWorkspaceMimeType(fileName, resourceKind === "image" ? "image/png" : resourceKind === "gif" ? "image/gif" : resourceKind === "video" ? "video/mp4" : resourceKind === "audio" || resourceKind === "music" ? "audio/mpeg" : resourceKind === "text" ? "text/plain" : resourceKind === "model3d" ? "model/gltf-binary" : "")).trim();
    const sourceName = String(descriptor?.sourceName || fileName || title).trim() || title;
    const sourceDetail = String(descriptor?.sourceDetail || descriptor?.detail || "").trim();
    const metadata = descriptor?.metadata && typeof descriptor.metadata === "object" ? { ...descriptor.metadata } : {};
    const exportedImage = resourceKind === "image" && dataUrl
      ? {
        dataUrl,
        fileName: fileName || "tool-output.png",
        width: typeof descriptor?.width === "number" && Number.isFinite(descriptor.width) ? descriptor.width : undefined,
        height: typeof descriptor?.height === "number" && Number.isFinite(descriptor.height) ? descriptor.height : undefined
      }
      : null;
    const exportedAsset = exportedImage || (resourceKind === "gif" && (dataUrl || sourceUrl)
      ? {
        kind: "gif",
        dataUrl,
        sourceUrl,
        fileName: fileName || "tool-output.gif"
      }
      : null);
    const canQueueToEngine = resourceKind === "text" ? !!textContent : !!(dataUrl || sourceUrl);
    const canSendToTool = !!exportedAsset;
    const toolCandidates = canSendToTool ? getToolWorkspaceSendCandidates(entry, resourceKind) : [];
    return {
      entry,
      resourceKind,
      sourceName,
      sourceDetail: sourceDetail || (resourceKind === "text" ? "Using the current text resource from the active tool." : "Using the current " + resourceKind + " resource from the active tool."),
      preview: buildToolWorkspacePreviewFromDescriptor(descriptor, sourceName),
      toolCandidates,
      sendToToolSupported: toolCandidates.length > 0,
      sendToToolReason: canSendToTool
        ? (toolCandidates.length > 0 ? "" : "No compatible tools are available for this resource.")
        : "This tool does not expose a sendable resource yet.",
      sendToEngineSupported: canQueueToEngine,
      sendToEngineReason: canQueueToEngine ? "" : "This tool does not expose a queueable dashboard resource yet.",
      exportedImage,
      exportedAsset,
      assetDescriptor: {
        resourceKind,
        fileName,
        title,
        mimeType,
        sourceUrl,
        dataUrl,
        textContent,
        metadata
      }
    };
  }
  function buildToolWorkspaceResourceOptionId(entry, context, index) {
    const parts = [
      String(entry?.id || "tool").trim(),
      normalizeToolWorkspaceAssetKind(context?.resourceKind),
      buildToolWorkspaceFileStem(context?.sourceName || context?.assetDescriptor?.fileName || "resource", "resource"),
      String(index)
    ];
    return parts.join(":");
  }
  function buildToolWorkspaceResourceOptionLabel(context, index) {
    const name = String(context?.sourceName || context?.assetDescriptor?.fileName || "").trim();
    if (name) {
      return name;
    }
    const kind = normalizeToolWorkspaceAssetKind(context?.resourceKind);
    return (kind === "file" ? "File" : kind.charAt(0).toUpperCase() + kind.slice(1)) + " " + String(index + 1);
  }
  function buildToolWorkspaceExportContextFromOptions(entry, optionContexts, preferredResourceId) {
    const resourceOptions = Array.isArray(optionContexts)
      ? optionContexts
        .filter(option => option && typeof option === "object")
        .map((context, index) => ({
          id: buildToolWorkspaceResourceOptionId(entry, context, index),
          label: buildToolWorkspaceResourceOptionLabel(context, index),
          detail: String(context?.sourceDetail || "").trim(),
          resourceKind: context?.resourceKind || "file",
          preview: context?.preview || null,
          context
        }))
      : [];
    if (resourceOptions.length === 0) {
      return null;
    }
    const selectedOption = resourceOptions.find(option => option.id === preferredResourceId)
      || (toolsWorkspaceExportState.activeTab === "tool"
        ? resourceOptions.find(option => option.context?.sendToToolSupported)
        : resourceOptions.find(option => option.context?.sendToEngineSupported))
      || resourceOptions[0];
    return {
      ...selectedOption.context,
      resourceOptions,
      selectedResourceId: selectedOption.id
    };
  }

  return {
    buildExportContextFromOptions: buildToolWorkspaceExportContextFromOptions,
    inferCurrentAssetDescriptor: inferToolWorkspaceCurrentAssetDescriptor,
    inferCurrentAssetDescriptors: inferToolWorkspaceCurrentAssetDescriptors,
    inferMimeType: inferToolWorkspaceMimeType,
    normalizeAssetKind: normalizeToolWorkspaceAssetKind,
    normalizeCurrentAssetDescriptor: normalizeToolWorkspaceCurrentAssetDescriptor,
    toAbsoluteUrl: toAbsoluteToolWorkspaceUrl
  };
}
