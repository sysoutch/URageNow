function normalizeToolSourcePath(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }
  try {
    return new URL(source, window.location.origin).pathname.toLowerCase();
  } catch {
    return source.toLowerCase();
  }
}
function isPixelArtToolSourcePath(value) {
  return normalizeToolSourcePath(value).includes("/pixel-art-converter/");
}
function isGifViewerToolSourcePath(value) {
  return normalizeToolSourcePath(value).includes("/tools/art/gif-viewer/");
}
function isArtToolSourcePath(value) {
  return normalizeToolSourcePath(value).includes("/tools/art/");
}
function isInteractiveBookToolSourcePath(value) {
  return normalizeToolSourcePath(value).includes("/tools/dev/interactive-book/");
}
function isTilemapCreatorToolSourcePath(value) {
  return normalizeToolSourcePath(value).includes("/tools/dev/tilemap-creator/");
}
function isFloatingMediaTrayToolSourcePath(value) {
  return isInteractiveBookToolSourcePath(value) || isTilemapCreatorToolSourcePath(value);
}
function isImageToolTargetSourcePath(value) {
  return isArtToolSourcePath(value) || isInteractiveBookToolSourcePath(value) || isTilemapCreatorToolSourcePath(value);
}
function isThreeModelViewerToolSourcePath(value) {
  return normalizeToolSourcePath(value).includes("/tools/art/3d-model-viewer/");
}
function getFileExtension(fileName) {
  const normalized = String(fileName || "").trim().toLowerCase();
  if (!normalized || !normalized.includes(".")) {
    return "";
  }
  return normalized.split(".").pop() || "";
}
function isThreeModelViewerCompatibleModelFile(fileName) {
  const ext = getFileExtension(fileName);
  return ext === "glb" || ext === "gltf" || ext === "obj";
}

const artToolImagePoolBridgeRootId = "urage-art-tool-image-pool-bridge";
const toolWorkspaceSendBridgeRootId = "urage-tool-send-bridge";
const toolWorkspaceRecentBridgeRootId = "urage-tool-recent-media-bridge";
const toolBackgroundFrameRootId = "urage-tool-background-frames";
const defaultArtToolInputImageUrl = "/assets/dashboard-logo.png";
const defaultArtToolInputImageFileName = "logo.png";
const toolWorkspaceBridgeState = {
  sendVisible: true,
  poolsVisible: true,
  recentVisible: true,
  positions: {}
};

function getToolsCatalogButtons() {
  return Array.from(document.querySelectorAll("[data-tools-tool][data-tools-src]"));
}
function getToolsCatalogEntries() {
  const seen = new Set();
  return getToolsCatalogButtons()
    .map(button => {
      const id = String(button.getAttribute("data-tools-tool") || "").trim();
      const title = String(button.getAttribute("data-tools-title") || "").trim() || "Tool";
      const categoryLabel = String(button.getAttribute("data-tools-category") || "").trim() || "Tool Workspace";
      const categoryId = String(button.getAttribute("data-tools-category-id") || "").trim() || categoryLabel.toLowerCase();
      const description = String(button.getAttribute("data-tools-description") || "").trim() || "Open local tool.";
      const tags = String(button.getAttribute("data-tools-tags") || "").split(",").map(tag => tag.trim()).filter(Boolean);
      const sourcePath = String(button.getAttribute("data-tools-src") || "").trim();
      const readmePath = String(button.getAttribute("data-tools-readme") || "").trim();
      const thumbnailImage = button.querySelector(".tools-catalog-button-icon img");
      const thumbnailPath = thumbnailImage ? String(thumbnailImage.getAttribute("src") || "").trim() : "";
      if (!id || !sourcePath || seen.has(id)) {
        return null;
      }
      seen.add(id);
      return { id, title, categoryId, categoryLabel, description, tags, sourcePath, thumbnailPath, readmePath };
    })
    .filter(Boolean);
}
function readStoredToolsWorkspaceIds(key) {
  return readStoredToolIdList(key);
}
function writeStoredToolsWorkspaceIds(key, values) {
  writeStoredToolIdList(key, values);
}
function getToolWorkspaceShortDescription(description) {
  const normalized = String(description || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 92) {
    return normalized;
  }
  return normalized.slice(0, 89).trimEnd() + "...";
}
function getToolWorkspaceKindLabel(entry) {
  const category = String(entry?.categoryLabel || "Tool").trim();
  if (/art|image|svg|texture/i.test(category)) return "Image";
  if (/audio|music|sound|sfx/i.test(category)) return "Audio";
  if (/dev|plan|code|utility/i.test(category)) return "Dev";
  if (/ui|ux/i.test(category)) return "UI";
  if (/ai|creative|game/i.test(category + " " + entry?.title)) return "Creative";
  return category || "Tool";
}
function syncToolsWorkspaceCollections(entries) {
  const validIds = new Set((Array.isArray(entries) ? entries : []).map(entry => entry.id));
  const normalize = values => Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(value => validIds.has(value))));
  toolsWorkspaceState.favoriteToolIds = normalize(readStoredToolsWorkspaceIds(toolsWorkspaceStorageKeys.favorites));
  toolsWorkspaceState.recentToolIds = normalize(readStoredToolsWorkspaceIds(toolsWorkspaceStorageKeys.recent));
  writeStoredToolsWorkspaceIds(toolsWorkspaceStorageKeys.favorites, toolsWorkspaceState.favoriteToolIds);
  writeStoredToolsWorkspaceIds(toolsWorkspaceStorageKeys.recent, toolsWorkspaceState.recentToolIds);
}
function rememberRecentTool(toolId) {
  const normalizedId = String(toolId || "").trim();
  if (!normalizedId) {
    return;
  }
  const next = [normalizedId].concat(toolsWorkspaceState.recentToolIds.filter(entry => entry !== normalizedId)).slice(0, 8);
  toolsWorkspaceState.recentToolIds = next;
  writeStoredToolsWorkspaceIds(toolsWorkspaceStorageKeys.recent, next);
}
function toggleToolsWorkspaceFavorite(toolId) {
  const normalizedId = String(toolId || "").trim();
  if (!normalizedId) {
    return;
  }
  const exists = toolsWorkspaceState.favoriteToolIds.includes(normalizedId);
  const next = exists
    ? toolsWorkspaceState.favoriteToolIds.filter(entry => entry !== normalizedId)
    : toolsWorkspaceState.favoriteToolIds.concat([normalizedId]);
  toolsWorkspaceState.favoriteToolIds = next;
  writeStoredToolsWorkspaceIds(toolsWorkspaceStorageKeys.favorites, next);
}
function findToolCatalogButtonById(toolId) {
  const targetId = String(toolId || "").trim();
  if (!targetId) {
    return null;
  }
  return getToolsCatalogButtons().find(button => String(button.getAttribute("data-tools-tool") || "").trim() === targetId) || null;
}
function findToolCatalogButtonBySourcePath(sourcePath) {
  const normalizedTarget = normalizeToolSourcePath(sourcePath);
  if (!normalizedTarget) {
    return null;
  }
  return getToolsCatalogButtons().find(button => normalizeToolSourcePath(button.getAttribute("data-tools-src")) === normalizedTarget) || null;
}
function getToolEntryBySourcePath(sourcePath) {
  const button = findToolCatalogButtonBySourcePath(sourcePath);
  if (!button) {
    return null;
  }
  return getToolsCatalogEntries().find(entry => entry.id === String(button.getAttribute("data-tools-tool") || "").trim()) || null;
}
function findToolEntryBySourceToken(sourceToken) {
  const normalizedToken = String(sourceToken || "").trim().toLowerCase().replace(/\\/g, "/");
  if (!normalizedToken) {
    return null;
  }
  return getToolsCatalogEntries().find(entry => normalizeToolSourcePath(entry.sourcePath).includes(normalizedToken)) || null;
}
function getPreferredDefaultToolEntry(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) {
    return null;
  }
  return list.find(entry => isPixelArtToolSourcePath(entry.sourcePath)) || list[0];
}
function readStoredToolIdList(storageKey) {
  if (!storageKey || typeof window.localStorage === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(value => String(value || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}
function writeStoredToolIdList(storageKey, values) {
  if (!storageKey || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    const normalized = Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(Boolean)));
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {}
}
function readStoredToolId(storageKey) {
  if (!storageKey || typeof window.localStorage === "undefined") {
    return "";
  }
  try {
    return String(window.localStorage.getItem(storageKey) || "").trim();
  } catch {
    return "";
  }
}
function writeStoredToolId(storageKey, value) {
  if (!storageKey || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    const normalized = String(value || "").trim();
    if (!normalized) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, normalized);
  } catch {}
}
