const desktopToolsStorageKey = "urage-tools-desktop-pinned";
const supportedDesktopToolPattern = /\.(exe|bat|cmd|sh|ps1|lnk|app|command|py)$/i;
const desktopToolApi = createDashboardDesktopToolApiHelpers();
const desktopToolPinStore = createDashboardDesktopToolPinStoreHelpers({
  storage: localStorage,
  storageKey: desktopToolsStorageKey,
  getToolName: getDesktopToolName,
  isAbsolutePath: isAbsoluteDesktopToolPath,
  isSupportedPath: isSupportedDesktopToolPath
});
const pinnedDesktopToolList = createDashboardPinnedDesktopToolListHelpers({
  api: desktopToolApi,
  getFileExtension: getDesktopToolFileExtension,
  getToolName: getDesktopToolName,
  renderFileIcon: renderDesktopToolFileIcon,
  setStatus: setDesktopToolStatus,
  store: desktopToolPinStore
});
const desktopToolDropzone = createDashboardDesktopToolDropzoneHelpers({
  getFilePath: getDesktopToolPathFromFile,
  pinTool: pinnedDesktopToolList.pin,
  setStatus: setDesktopToolStatus
});
const githubToolImport = createDashboardGithubToolImportHelpers({
  api: desktopToolApi,
  getFileExtension: getDesktopToolFileExtension,
  pinTool: pinnedDesktopToolList.pin,
  renderFileIcon: renderDesktopToolFileIcon,
  setDesktopStatus: setDesktopToolStatus
});

function getDesktopToolFileExtension(toolPath) {
  const normalized = String(toolPath || "").trim().toLowerCase();
  const match = normalized.match(/\.(exe|bat|cmd|sh|ps1|lnk|app|command|py)$/);
  return match ? match[1] : "";
}

function renderDesktopToolFileIcon(extension) {
  var iconName;
  switch (extension) {
    case "exe":
      iconName = "window";
      break;
    case "bat":
    case "cmd":
      iconName = "terminal";
      break;
    case "sh":
      iconName = "terminal";
      break;
    case "ps1":
      iconName = "terminal-fill";
      break;
    case "lnk":
      iconName = "link-45deg";
      break;
    case "app":
      iconName = "app-indicator";
      break;
    case "command":
      iconName = "terminal";
      break;
    case "py":
      iconName = "filetype-py";
      break;
    default:
      iconName = "file-earmark-code";
      break;
  }
  return '<span class="desktop-tool-card-file-icon"><i class="bi bi-' + iconName + '" aria-hidden="true"></i></span>';
}

function setDesktopToolStatus(message, tone) {
  const node = document.querySelector("[data-desktop-tool-status]");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone || "";
}

function getDesktopToolName(toolPath) {
  return String(toolPath || "").split(/[\\/]/).filter(Boolean).pop() || "Desktop Tool";
}

function getDesktopToolPathFromFile(file) {
  if (!file) return "";
  return String(file.path || file.mozFullPath || file.webkitRelativePath || file.name || "").trim();
}

function isSupportedDesktopToolPath(toolPath) {
  return supportedDesktopToolPattern.test(String(toolPath || "").trim());
}

function isAbsoluteDesktopToolPath(toolPath) {
  return /^(?:[a-z]:[\\/]|\\\\|\/)/i.test(String(toolPath || "").trim());
}

function setToolsMode(mode) {
  const nextMode = ["desktop", "mobile"].includes(mode) ? mode : "browser";
  localStorage.setItem("urage-tools-mode", nextMode);
  document.body.classList.toggle("tools-desktop-mode", nextMode === "desktop");
  document.body.classList.toggle("tools-mobile-mode", nextMode === "mobile");
  document.querySelectorAll("[data-tools-mode-tab]").forEach(tab => {
    const active = tab.getAttribute("data-tools-mode-tab") === nextMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-tools-mode-panel]").forEach(panel => {
    panel.classList.toggle("hidden", panel.getAttribute("data-tools-mode-panel") !== nextMode);
  });
  var catalog = document.getElementById("tools-main-catalog");
  if (catalog) {
    catalog.classList.toggle("hidden", nextMode !== "browser");
  }
}

function bindToolsModeTabs() {
  document.querySelectorAll("[data-tools-mode-tab]").forEach(tab => {
    tab.addEventListener("click", () => setToolsMode(tab.getAttribute("data-tools-mode-tab")));
  });
  setToolsMode(localStorage.getItem("urage-tools-mode") || "browser");
}

function bindDashboardDesktopTools() {
  bindToolsModeTabs();
  githubToolImport.bind();
  desktopToolDropzone.bind();
  pinnedDesktopToolList.render();
  void githubToolImport.render();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindDashboardDesktopTools, { once: true });
} else {
  bindDashboardDesktopTools();
}
