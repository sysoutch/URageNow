(function() {
  "use strict";

  function ensureStylesheet(id, href) {
    var existing = document.getElementById(id);
    if (existing) {
      (document.head || document.documentElement).appendChild(existing);
      return;
    }
    var link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    (document.head || document.documentElement).appendChild(link);
  }

  function ensureSharedToolStyles() {
    var themeHost = document.body || document.documentElement;
    if (!themeHost.getAttribute("data-dashboard-theme") && !document.documentElement.getAttribute("data-dashboard-theme")) {
      themeHost.setAttribute("data-dashboard-theme", "fire");
    }
    ensureStylesheet("urage-shared-tool-theme-styles", "/tools/shared/css/tool-theme.css");
    ensureStylesheet("urage-shared-tool-component-styles", "/tools/shared/css/components/tool-components.css");
  }

  ensureSharedToolStyles();

  if (window.__urageToolDescribeCurrentAssets || window.__urageToolDescribeCurrentAsset) {
    return;
  }

  var MAX_DESCRIPTORS = 20;

  function toAbsoluteUrl(value) {
    var raw = String(value || "").trim();
    if (!raw || /^(?:javascript|mailto|tel):/i.test(raw)) {
      return "";
    }
    try {
      return new URL(raw, window.location.href).href;
    } catch (_) {
      return raw;
    }
  }

  function fileNameFromUrl(url, fallback) {
    try {
      var parsed = new URL(url, window.location.href);
      var name = decodeURIComponent((parsed.pathname.split("/").pop() || "").trim());
      return name || fallback;
    } catch (_) {
      var clean = String(url || "").split("?")[0].split("#")[0].split("/").pop();
      return clean || fallback;
    }
  }

  function slug(value, fallback) {
    var clean = String(value || "").trim().toLowerCase().replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
    return clean || fallback;
  }

  function isVisible(node) {
    if (!node || node.nodeType !== 1 || node.hidden) {
      return false;
    }
    try {
      var style = window.getComputedStyle(node);
      var rect = node.getBoundingClientRect();
      return !!rect && rect.width > 6 && rect.height > 6 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
    } catch (_) {
      return false;
    }
  }

  function area(node) {
    var rect = node.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function outputLabel(node, fallback) {
    var direct = String(node.getAttribute("data-export-label") || node.getAttribute("aria-label") || node.getAttribute("title") || "").trim();
    if (direct) {
      return direct;
    }
    var container = node.closest("figure, [data-output], [data-result], .result, .output, .preview, .card, .panel");
    var heading = container ? container.querySelector("[data-title], figcaption, h1, h2, h3, h4, strong") : null;
    return String(heading && heading.textContent || fallback || "Tool Output").trim();
  }

  function mimeTypeFromFileName(fileName, fallback) {
    var name = String(fileName || "").toLowerCase();
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".gif")) return "image/gif";
    if (name.endsWith(".svg")) return "image/svg+xml";
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".webm")) return "video/webm";
    if (name.endsWith(".mp3")) return "audio/mpeg";
    if (name.endsWith(".wav")) return "audio/wav";
    if (name.endsWith(".ogg")) return "audio/ogg";
    if (name.endsWith(".json")) return "application/json";
    if (name.endsWith(".md")) return "text/markdown";
    if (name.endsWith(".txt")) return "text/plain";
    if (name.endsWith(".glb")) return "model/gltf-binary";
    if (name.endsWith(".gltf")) return "model/gltf+json";
    return fallback || "";
  }

  function kindFromMimeType(mimeType, fallback) {
    var mime = String(mimeType || "").toLowerCase();
    if (mime === "image/gif") return "gif";
    if (mime.indexOf("image/") === 0) return "image";
    if (mime.indexOf("video/") === 0) return "video";
    if (mime.indexOf("audio/") === 0) return "audio";
    if (mime.indexOf("text/") === 0) return "text";
    if (mime.indexOf("model/") === 0) return "model3d";
    return fallback || "file";
  }

  function canvasDescriptor(canvas, index) {
    if (!canvas || !canvas.width || !canvas.height) {
      return null;
    }
    try {
      var title = outputLabel(canvas, "Canvas Output");
      var dataUrl = canvas.toDataURL("image/png");
      return {
        kind: "image",
        title: title,
        fileName: slug(title, index ? "tool-image-" + (index + 1) : "tool-image") + ".png",
        mimeType: "image/png",
        dataUrl: dataUrl,
        width: canvas.width,
        height: canvas.height,
        previewKind: "image",
        previewUrl: dataUrl,
        metadata: { inferenceSource: "tool-autodescribe-canvas" }
      };
    } catch (_) {
      return null;
    }
  }

  function mediaDescriptor(node, index, fallbackKind) {
    var sourceUrl = toAbsoluteUrl(node.currentSrc || node.src || (node.querySelector && node.querySelector("source[src]") || {}).src || "");
    if (!sourceUrl) {
      return null;
    }
    var fallbackName = (fallbackKind || "tool-output") + "-" + (index + 1);
    var fileName = fileNameFromUrl(sourceUrl, fallbackName);
    var mimeType = mimeTypeFromFileName(fileName, fallbackKind === "video" ? "video/mp4" : fallbackKind === "audio" ? "audio/mpeg" : "image/png");
    var kind = kindFromMimeType(mimeType, fallbackKind || "file");
    return {
      kind: kind,
      title: outputLabel(node, fileName),
      fileName: fileName,
      mimeType: mimeType,
      sourceUrl: sourceUrl,
      previewKind: kind,
      previewUrl: kind === "text" || kind === "file" ? "" : sourceUrl,
      metadata: { inferenceSource: "tool-autodescribe-media" }
    };
  }

  function linkDescriptor(link, index) {
    var href = toAbsoluteUrl(link.getAttribute("href") || link.href || "");
    if (!href) {
      return null;
    }
    var fileName = String(link.getAttribute("download") || "").trim() || fileNameFromUrl(href, "tool-output-" + (index + 1) + ".bin");
    var mimeType = mimeTypeFromFileName(fileName, "");
    var kind = kindFromMimeType(mimeType, "file");
    return {
      kind: kind,
      title: outputLabel(link, fileName),
      fileName: fileName,
      mimeType: mimeType,
      sourceUrl: href,
      previewKind: kind,
      previewUrl: kind === "file" || kind === "text" ? "" : href,
      metadata: { inferenceSource: "tool-autodescribe-link" }
    };
  }

  function textDescriptor(node) {
    var text = String(typeof node.value === "string" ? node.value : node.textContent || "").trim();
    if (!text) {
      return null;
    }
    var title = outputLabel(node, "Text Output");
    return {
      kind: "text",
      title: title,
      fileName: slug(title, "tool-text") + ".txt",
      mimeType: "text/plain",
      textContent: text,
      previewKind: "text",
      previewText: text,
      metadata: { inferenceSource: "tool-autodescribe-text" }
    };
  }

  function pushUnique(list, seen, descriptor) {
    if (!descriptor) {
      return;
    }
    var key = [descriptor.kind, descriptor.fileName, descriptor.sourceUrl || descriptor.dataUrl || descriptor.textContent || ""].join("|").slice(0, 800);
    if (!key || seen[key]) {
      return;
    }
    seen[key] = true;
    list.push(descriptor);
  }

  function describeCurrentAssets() {
    var descriptors = [];
    var seen = {};
    Array.prototype.slice.call(document.querySelectorAll("a[href]"))
      .filter(isVisible)
      .filter(function(link) { return link.hasAttribute("download") || /\.(?:png|jpe?g|webp|gif|svg|glb|gltf|fbx|obj|mp4|webm|mp3|wav|ogg|json|txt|md|zip)(?:[?#].*)?$/i.test(String(link.getAttribute("href") || "")); })
      .slice(0, 8)
      .forEach(function(link, index) { pushUnique(descriptors, seen, linkDescriptor(link, index)); });
    Array.prototype.slice.call(document.querySelectorAll("canvas"))
      .filter(isVisible)
      .filter(function(canvas) { var rect = canvas.getBoundingClientRect(); return rect.width >= 32 && rect.height >= 32; })
      .sort(function(left, right) { return area(right) - area(left); })
      .slice(0, 8)
      .forEach(function(canvas, index) { pushUnique(descriptors, seen, canvasDescriptor(canvas, index)); });
    Array.prototype.slice.call(document.querySelectorAll("video, audio, img"))
      .filter(isVisible)
      .filter(function(node) { var rect = node.getBoundingClientRect(); return node.tagName !== "IMG" || (rect.width >= 32 && rect.height >= 32); })
      .sort(function(left, right) { return area(right) - area(left); })
      .slice(0, 12)
      .forEach(function(node, index) {
        var tag = String(node.tagName || "").toLowerCase();
        pushUnique(descriptors, seen, mediaDescriptor(node, index, tag === "video" ? "video" : tag === "audio" ? "audio" : "image"));
      });
    Array.prototype.slice.call(document.querySelectorAll("textarea, pre, code, [data-output-text], [contenteditable='true']"))
      .filter(isVisible)
      .map(textDescriptor)
      .sort(function(left, right) { return String(right && right.textContent || "").length - String(left && left.textContent || "").length; })
      .slice(0, 3)
      .forEach(function(descriptor) { pushUnique(descriptors, seen, descriptor); });
    return descriptors.slice(0, MAX_DESCRIPTORS);
  }

  window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
  window.__urageToolDescribeCurrentAsset = function() {
    return describeCurrentAssets()[0] || null;
  };
})();
