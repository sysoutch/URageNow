function createResourceHubJsonRequestOptions(body) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {})
  };
}

async function readResourceHubJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : "Request failed.");
  }
  return payload;
}

function setActiveAssetPlatform(platform) {
  const selected = platform === "home" || platform === "godot" || platform === "unreal" ? platform : "unity";
  document.querySelectorAll("[data-asset-platform-tab]").forEach(tab => {
    tab.classList.toggle("active", tab.getAttribute("data-asset-platform-tab") === selected);
  });
  document.querySelectorAll("[data-asset-platform-panel]").forEach(panel => {
    const panelPlatform = panel.getAttribute("data-asset-platform-panel");
    panel.classList.toggle("hidden", panelPlatform !== selected);
    panel.classList.toggle("active", panelPlatform === selected);
  });
}

function setActiveGameEngineWorkspace(workspace) {
  const selected = workspace === "assets" ? "assets" : "projects";
  document.querySelectorAll("[data-game-engine-workspace-tab]").forEach(button => {
    const active = button.getAttribute("data-game-engine-workspace-tab") === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-game-engine-workspace-panel]").forEach(panel => {
    panel.classList.toggle("hidden", panel.getAttribute("data-game-engine-workspace-panel") !== selected);
  });
}

function setActiveBlenderAddonNav(nav) {
  const manager = document.querySelector("[data-blender-addon-manager]");
  if (!manager) return;

  // Handle global Projects/Addons main navigation (level 1)
  if (nav === "projects" || nav === "addons") {
    setGlobalSuiteMainTab(nav);
    return;
  }

  // Handle "home" - just show the default sub-panel (online)
  if (nav === "home") {
    setActiveBlenderAddonSubSection("online");
    return;
  }

  // Level 2: online/recommended/local-sources/local tabs
  setActiveBlenderAddonSubSection(nav);
}

function setActiveBlenderAddonSubSection(section) {
  const manager = document.querySelector("[data-blender-addon-manager]");
  if (!manager) return;
  // Toggle level 2 subtabs (inside addons content panel - now under 'home' section in global tab layout)
  const addonsPanel = manager.querySelector("[data-blender-section-panel='home']");
  if (!addonsPanel) return;
  const subtabs = addonsPanel.querySelector(".blender-subtabs");
  if (!subtabs) return;
  subtabs.querySelectorAll(".dashboard-tab").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-blender-nav") === section);
    btn.setAttribute("aria-selected", btn.getAttribute("data-blender-nav") === section ? "true" : "false");
  });
  // Toggle level 2 sub-panels (blender-sub-panel, direct children of addons panel)
  addonsPanel.querySelectorAll(".blender-sub-panel").forEach(panel => {
    const panelSection = panel.getAttribute("data-blender-addon-section");
    panel.classList.toggle("hidden", panelSection !== section);
    panel.classList.toggle("active", panelSection === section);
  });
}

function setActiveAssetPlatformNav(platform) {
  const selected = platform === "home" || platform === "godot" || platform === "unreal" ? platform : "unity";
  document.querySelectorAll("[data-asset-platform]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-asset-platform") === selected);
  });
  setActiveAssetPlatform(selected);
}

function getImportedAssetPlatformLabel(platform) {
  if (platform === "godot") return "Godot";
  if (platform === "unreal") return "Unreal";
  return "Unity";
}

function setAssetImportStatus(platform, message, tone) {
  const node = document.querySelector(`[data-asset-github-import-status="${platform}"]`);
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone || "";
}

let remoteAssetCatalogPromise = null;
let remoteBlenderScriptCatalogPromise = null;

function renderRemoteBlenderScriptCatalog(catalog) {
  const list = document.querySelector("[data-blender-script-catalog-list]");
  const status = document.querySelector("[data-blender-script-catalog-status]");
  const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
  if (status) status.textContent = entries.length + " Blender script package(s) cached" + (catalog?.revision ? " at " + String(catalog.revision).slice(0, 8) : "") + ".";
  if (!list) return;
  list.innerHTML = "";
  if (!entries.length) { list.innerHTML = '<div class="tools-workspace-empty">No script packages were found in the cached Blender repository.</div>'; return; }
  entries.forEach(entry => {
    const card = document.createElement("article"); card.className = "resource-hub-card asset-resource-card";
    card.innerHTML = '<div class="resource-hub-card-icon" aria-hidden="true"><i class="bi bi-code-slash"></i></div><div class="resource-hub-card-copy"><span class="panel-kicker">Blender Script</span><h4></h4><code></code><small></small></div><div class="desktop-tool-card-actions imported-tool-card-actions"><a class="secondary resource-hub-card-action"><i class="bi bi-download"></i><span>Download</span></a><a class="ghost resource-hub-card-action" target="_blank" rel="noopener"><i class="bi bi-github"></i><span>GitHub</span></a></div>';
    card.querySelector("h4").textContent = entry.title || "Blender Script";
    card.querySelector("code").textContent = entry.relativePath || "";
    card.querySelector("small").textContent = Number(entry.fileCount || 0) + " files · " + Number(entry.directoryCount || 0) + " folders";
    card.querySelector("a.secondary").href = "/api/blender-script-catalog/download?id=" + encodeURIComponent(String(entry.id || ""));
    card.querySelector("a.ghost").href = entry.githubUrl || "https://github.com/sysoutch/URage-Blender-Scripts";
    list.appendChild(card);
  });
}
function loadRemoteBlenderScriptCatalog(refresh) {
  if (remoteBlenderScriptCatalogPromise) return remoteBlenderScriptCatalogPromise;
  const status = document.querySelector("[data-blender-script-catalog-status]"); if (status) status.textContent = refresh ? "Refetching Blender Scripts..." : "Loading cached Blender scripts...";
  remoteBlenderScriptCatalogPromise = fetchAssetRepoJson("/api/blender-script-catalog" + (refresh ? "?refresh=true" : ""), {cache: "no-store"}).then(renderRemoteBlenderScriptCatalog).catch(error => { if (status) status.textContent = error.message || "Failed to load Blender scripts."; throw error; }).finally(() => { remoteBlenderScriptCatalogPromise = null; });
  return remoteBlenderScriptCatalogPromise;
}

function setRemoteAssetCatalogStatus(platform, message, tone) {
  const node = document.querySelector(`[data-remote-asset-catalog-status="${platform}"]`);
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone || "";
}

function createRemoteAssetCatalogCard(entry) {
  const card = document.createElement("article");
  card.className = "resource-hub-card asset-resource-card";
  const icon = document.createElement("div");
  icon.className = "resource-hub-card-icon";
  icon.setAttribute("aria-hidden", "true");
  const iconUrl = String(entry.iconUrl || "");
  if (/^\/assets\/vendor\/bootstrap-icons\/icons\/[a-z0-9-]+\.svg$/.test(iconUrl)) {
    const artwork = document.createElement("span");
    artwork.className = "remote-asset-icon-artwork";
    artwork.style.setProperty("--remote-asset-icon", `url("${iconUrl}")`);
    icon.appendChild(artwork);
  } else {
    icon.innerHTML = '<i class="bi bi-box-seam"></i>';
  }
  const copy = document.createElement("div");
  copy.className = "resource-hub-card-copy";
  const kicker = document.createElement("span");
  kicker.className = "panel-kicker";
  kicker.textContent = "GitHub Package";
  const title = document.createElement("h4");
  title.textContent = entry.title || "URage Asset";
  const pathNode = document.createElement("code");
  pathNode.textContent = entry.relativePath || "";
  const counts = document.createElement("small");
  counts.textContent = Number(entry.fileCount || 0) + " files · " + Number(entry.directoryCount || 0) + " folders";
  copy.append(kicker, title, pathNode, counts);
  const actions = document.createElement("div");
  actions.className = "desktop-tool-card-actions imported-tool-card-actions";
  const download = document.createElement("a");
  download.className = "secondary resource-hub-card-action";
  download.href = "/api/asset-catalog/download?id=" + encodeURIComponent(String(entry.id || ""));
  download.innerHTML = '<i class="bi bi-download"></i><span>Download</span>';
  const github = document.createElement("a");
  github.className = "ghost resource-hub-card-action";
  github.href = String(entry.githubUrl || "https://github.com/sysoutch/URage-Assets");
  github.target = "_blank";
  github.rel = "noopener";
  github.innerHTML = '<i class="bi bi-github"></i><span>GitHub</span>';
  actions.append(download, github);
  card.append(icon, copy, actions);
  return card;
}

function renderRemoteAssetCatalog(catalog) {
  ["unity", "godot", "unreal"].forEach(function (platform) {
    const list = document.querySelector(`[data-remote-asset-catalog-list="${platform}"]`);
    const entries = (Array.isArray(catalog && catalog.entries) ? catalog.entries : [])
      .filter(function (entry) { return entry && entry.platform === platform; });
    document.querySelectorAll(`[data-remote-asset-count="${platform}"]`).forEach(function (node) {
      node.textContent = String(entries.length);
    });
    if (list) {
      list.innerHTML = "";
      if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tools-workspace-empty";
        empty.textContent = "No " + getImportedAssetPlatformLabel(platform) + " packages were found in the cached repository.";
        list.appendChild(empty);
      } else {
        entries.forEach(function (entry) {
          list.appendChild(createRemoteAssetCatalogCard(entry));
        });
      }
    }
    const revision = String(catalog && catalog.revision || "").slice(0, 8);
    const cachedAt = catalog && catalog.cachedAt ? new Date(catalog.cachedAt).toLocaleString() : "unknown time";
    setRemoteAssetCatalogStatus(
      platform,
      entries.length + " package(s) cached from sysoutch/URage-Assets" + (revision ? " at " + revision : "") + " · " + cachedAt,
      "ok"
    );
  });
}

async function loadRemoteAssetCatalog(refresh) {
  if (remoteAssetCatalogPromise) return remoteAssetCatalogPromise;
  ["unity", "godot", "unreal"].forEach(function (platform) {
    setRemoteAssetCatalogStatus(platform, refresh ? "Refetching sysoutch/URage-Assets..." : "Loading cached GitHub catalog...", "busy");
  });
  remoteAssetCatalogPromise = fetchAssetRepoJson(
    "/api/asset-catalog" + (refresh ? "?refresh=true" : ""),
    {cache: "no-store"}
  ).then(function (catalog) {
    renderRemoteAssetCatalog(catalog);
    return catalog;
  }).catch(function (error) {
    ["unity", "godot", "unreal"].forEach(function (platform) {
      setRemoteAssetCatalogStatus(platform, error.message || "Failed to load the GitHub asset catalog.", "error");
    });
    throw error;
  }).finally(function () {
    remoteAssetCatalogPromise = null;
  });
  return remoteAssetCatalogPromise;
}

function bindRemoteAssetCatalog() {
  document.querySelectorAll("[data-remote-asset-refetch]").forEach(function (button) {
    button.addEventListener("click", function () {
      void loadRemoteAssetCatalog(true).catch(function () {});
    });
  });
}

function hideAssetReleaseAssetSelector(platform) {
  const row = document.querySelector(`[data-asset-release-select-row="${platform}"]`);
  const select = document.querySelector(`[data-asset-github-release-asset-select="${platform}"]`);
  if (row) row.classList.add("hidden");
  if (select) {
    select.innerHTML = "";
    delete select.dataset.repo;
    delete select.dataset.releaseName;
  }
}

function getAssetRepoInputValue(platform) {
  const input = document.querySelector(`[data-asset-github-repo-input="${platform}"]`);
  return String(input && input.value || "").trim();
}

function formatReleaseAssetLabel(asset) {
  var size = Number(asset && asset.size || 0);
  if (!size) return String(asset && asset.name || "Asset");
  if (size >= 1024 * 1024) return String(asset.name || "Asset") + " (" + (size / (1024 * 1024)).toFixed(1) + " MB)";
  if (size >= 1024) return String(asset.name || "Asset") + " (" + Math.round(size / 1024) + " KB)";
  return String(asset.name || "Asset") + " (" + size + " B)";
}

function showAssetReleaseAssetSelector(platform, repository, release) {
  const row = document.querySelector(`[data-asset-release-select-row="${platform}"]`);
  const select = document.querySelector(`[data-asset-github-release-asset-select="${platform}"]`);
  if (!row || !select) return;
  select.innerHTML = "";
  (Array.isArray(release && release.assets) ? release.assets : []).forEach(function (asset) {
    const option = document.createElement("option");
    option.value = String(asset && asset.name || "");
    option.textContent = formatReleaseAssetLabel(asset);
    select.appendChild(option);
  });
  select.dataset.repo = repository;
  select.dataset.releaseName = String(release && release.releaseName || release && release.tagName || "latest release");
  row.classList.remove("hidden");
}

async function fetchAssetRepoJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    var error = new Error(payload && payload.error ? payload.error : "Request failed.");
    error.payload = payload;
    throw error;
  }
  return payload;
}

function createImportedAssetRepoCard(entry) {
  const card = document.createElement("article");
  card.className = "desktop-tool-card imported-tool-card";
  const icon = document.createElement("div");
  icon.className = "desktop-tool-card-icon";
  icon.textContent = getImportedAssetPlatformLabel(entry.platform).charAt(0).toUpperCase();
  const copy = document.createElement("div");
  copy.className = "desktop-tool-card-copy imported-tool-card-copy";
  const flair = document.createElement("span");
  flair.className = "resource-flair";
  flair.textContent = entry.importKind === "release" ? "Release" : getImportedAssetPlatformLabel(entry.platform);
  const title = document.createElement("h4");
  title.textContent = entry.title || entry.repoRef || "Imported Asset";
  const description = document.createElement("p");
  description.textContent = entry.description || entry.readmeSummary || entry.repoUrl;
  const repo = document.createElement("code");
  repo.className = "imported-tool-card-repo";
  repo.textContent = entry.repoRef || entry.repoUrl;
  copy.append(flair, title, description, repo);
  if (entry.notes && entry.notes.length) {
    const notes = document.createElement("small");
    notes.textContent = entry.notes[0];
    copy.appendChild(notes);
  }
  if (entry.buildInstructions) {
    const build = document.createElement("pre");
    build.className = "imported-tool-build";
    build.textContent = entry.buildInstructions;
    copy.appendChild(build);
  }
  const actions = document.createElement("div");
  actions.className = "desktop-tool-card-actions imported-tool-card-actions";
  const openFolder = document.createElement("button");
  openFolder.type = "button";
  openFolder.className = "secondary";
  openFolder.textContent = "Open Folder";
  openFolder.addEventListener("click", function () {
    void openExplorerPath(entry.destinationPath).catch(function (error) {
      setAssetImportStatus(entry.platform, error.message, "error");
    });
  });
  actions.appendChild(openFolder);
  const github = document.createElement("a");
  github.className = "ghost desktop-tool-card-action";
  github.href = entry.repoUrl;
  github.target = "_blank";
  github.rel = "noopener";
  github.textContent = "GitHub";
  actions.appendChild(github);
  card.append(icon, copy, actions);
  return card;
}

async function renderImportedAssetRepositories(platform) {
  const list = document.querySelector(`[data-imported-asset-list="${platform}"]`);
  if (!list) return;
  list.innerHTML = "";
  try {
    const payload = await fetchAssetRepoJson("/api/asset-repos?platform=" + encodeURIComponent(platform), { cache: "no-store" });
    const imports = Array.isArray(payload && payload.imports) ? payload.imports : [];
    if (imports.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tools-workspace-empty desktop-tool-empty";
      empty.textContent = "No GitHub asset repositories imported yet.";
      list.appendChild(empty);
      return;
    }
    imports.forEach(function (entry) {
      list.appendChild(createImportedAssetRepoCard(entry));
    });
  } catch (error) {
    const empty = document.createElement("div");
    empty.className = "tools-workspace-empty desktop-tool-empty";
    empty.textContent = error.message || "Failed to load imported asset repositories.";
    list.appendChild(empty);
  }
}

async function importGithubAssetRepository(platform) {
  const repository = getAssetRepoInputValue(platform);
  const input = document.querySelector(`[data-asset-github-repo-input="${platform}"]`);
  if (!repository) {
    throw new Error("Enter a GitHub repository first.");
  }
  hideAssetReleaseAssetSelector(platform);
  setAssetImportStatus(platform, "Cloning " + repository + "...", "busy");
  const payload = await fetchAssetRepoJson("/api/asset-repos/import", createResourceHubJsonRequestOptions({
    repository,
    platform
  }));
  if (input) input.value = "";
  await renderImportedAssetRepositories(platform);
  setAssetImportStatus(platform, "Imported " + (payload && payload.entry && payload.entry.title || repository) + " into the " + getImportedAssetPlatformLabel(platform) + " workspace.", "ok");
}

async function downloadGithubAssetLatestRelease(platform, assetName) {
  const repository = getAssetRepoInputValue(platform);
  if (!repository) {
    throw new Error("Enter a GitHub repository first.");
  }
  setAssetImportStatus(platform, "Checking latest release for " + repository + "...", "busy");
  try {
    const payload = await fetchAssetRepoJson("/api/asset-repos/download-release", createResourceHubJsonRequestOptions({
      repository,
      platform,
      assetName: assetName || null
    }));
    hideAssetReleaseAssetSelector(platform);
    await renderImportedAssetRepositories(platform);
    setAssetImportStatus(platform, "Downloaded " + (payload && payload.asset && payload.asset.assetName || "release asset") + " into the " + getImportedAssetPlatformLabel(platform) + " workspace.", "ok");
  } catch (error) {
    if (error && error.payload && error.payload.requiresAssetSelection) {
      showAssetReleaseAssetSelector(platform, repository, error.payload.release);
      setAssetImportStatus(platform, (error.payload.error || error.message) + " Choose a file below.", "busy");
      return;
    }
    throw error;
  }
}

function toCompactExecutableLabel(blender) {
  const explicitLabel = blender && blender.label ? String(blender.label).trim() : "";
  if (explicitLabel) return explicitLabel;
  const executablePath = blender && blender.executablePath ? String(blender.executablePath).trim() : "";
  if (!executablePath) return "Blender";
  const normalized = executablePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.length >= 2 ? segments.slice(-2).join("/") : segments[segments.length - 1] || "Blender";
}

function getSelectedBlenderPath() {
  const select = document.querySelector("[data-suite-executable-select]");
  return select ? String(select.value || "").trim() : "";
}

const SUITE_EXECUTABLE_STORAGE_PREFIX = "urage:3d-suite-executable:";

function getSuiteExecutableSelect() {
  return document.querySelector("[data-suite-executable-select]");
}

function getSavedSuiteExecutable(suiteKey) {
  try {
    return localStorage.getItem(SUITE_EXECUTABLE_STORAGE_PREFIX + suiteKey) || "";
  } catch {
    return "";
  }
}

function saveSuiteExecutable(suiteKey, executablePath) {
  try {
    const key = SUITE_EXECUTABLE_STORAGE_PREFIX + suiteKey;
    if (executablePath) localStorage.setItem(key, executablePath);
    else localStorage.removeItem(key);
  } catch {
    // Private browsing or restrictive browser settings should not block the picker.
  }
}

function setSuiteExecutableStatus(message, tone) {
  const node = document.getElementById("suite-executable-status");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone || "";
}

function setSuiteExecutableOptions(installs, suiteKey) {
  const select = getSuiteExecutableSelect();
  if (!select) return false;
  select.innerHTML = "";
  const savedPath = getSavedSuiteExecutable(suiteKey);
  const availablePaths = installs.map(install => String(install.executablePath || ""));
  for (const install of installs) {
    const option = document.createElement("option");
    option.value = install.executablePath || "";
    option.textContent = toCompactExecutableLabel(install);
    option.title = install.executablePath || "";
    select.appendChild(option);
  }
  if (installs.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No executable found";
    select.appendChild(option);
    return false;
  }
  select.value = availablePaths.includes(savedPath) ? savedPath : availablePaths[0];
  saveSuiteExecutable(suiteKey, select.value);
  return true;
}

function setBlenderAddonStatus(message, tone) {
  const node = document.getElementById("blender-addon-status");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone || "";
}

function renderInstalledBlenderAddons(addons) {
  const list = document.getElementById("blender-installed-addon-list");
  if (!list) return;
  list.innerHTML = "";
  if (!Array.isArray(addons) || addons.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tools-workspace-empty";
    empty.textContent = "No installed addons were reported by this Blender executable.";
    list.appendChild(empty);
    return;
  }
  const visibleAddons = addons.slice(0, 180);
  for (const addon of visibleAddons) {
    const row = document.createElement("div");
    row.className = "resource-installed-row";
    row.dataset.enabled = addon.enabled ? "true" : "false";
    const copy = document.createElement("div");
    copy.className = "resource-installed-copy";
    const title = document.createElement("strong");
    title.textContent = addon.name || addon.module || "Addon";
    const meta = document.createElement("span");
    meta.textContent = [addon.module, addon.version, addon.category].filter(Boolean).join(" · ");
    copy.append(title, meta);
    const toggle = document.createElement("button");
    toggle.className = "secondary";
    toggle.type = "button";
    toggle.dataset.blenderToggleAddon = addon.module || "";
    toggle.dataset.nextEnabled = addon.enabled ? "false" : "true";
    toggle.textContent = addon.enabled ? "Disable" : "Enable";
    row.append(copy, toggle);
    list.appendChild(row);
  }
  if (addons.length > visibleAddons.length) {
    const note = document.createElement("div");
    note.className = "tools-catalog-hint";
    note.textContent = `Showing ${visibleAddons.length} of ${addons.length} addons.`;
    list.appendChild(note);
  }
}

async function loadInstalledBlenderAddons() {
  const blenderPath = getSelectedBlenderPath();
  if (!blenderPath) {
    renderInstalledBlenderAddons([]);
    setBlenderAddonStatus("Select a Blender executable.", "");
    return;
  }
  setBlenderAddonStatus("Reading installed addons...", "busy");
  const payload = await fetch("/api/blender/addons?blenderPath=" + encodeURIComponent(blenderPath), { cache: "no-store" }).then(readResourceHubJson);
  renderInstalledBlenderAddons(payload.addons || []);
  setBlenderAddonStatus(`${Array.isArray(payload.addons) ? payload.addons.length : 0} addons found.`, "ok");
}

async function loadBlenderInstalls() {
  const select = getSuiteExecutableSelect();
  if (!select) return;
  const label = document.getElementById("suite-executable-label");
  if (label) label.textContent = "Blender executable";
  setBlenderAddonStatus("Finding Blender installs...", "busy");
  setSuiteExecutableStatus("Finding Blender installs...", "busy");
  const payload = await fetch("/api/blender/installs", { cache: "no-store" }).then(readResourceHubJson);
  const blenders = Array.isArray(payload.blenders) ? payload.blenders : [];
  if (!setSuiteExecutableOptions(blenders, "blender")) {
    setBlenderAddonStatus("No Blender executable found.", "error");
    setSuiteExecutableStatus("No Blender executable found.", "error");
    return;
  }
  await loadInstalledBlenderAddons();
  setSuiteExecutableStatus(`${blenders.length} Blender installation${blenders.length === 1 ? "" : "s"} found.`, "ok");
}

async function installLocalBlenderAddon(sourcePath) {
  const blenderPath = getSelectedBlenderPath();
  if (!blenderPath) throw new Error("Select a Blender executable first.");
  setBlenderAddonStatus("Installing local addon...", "busy");
  await fetch("/api/blender/addons/install-local", createResourceHubJsonRequestOptions({
    blenderPath,
    sourcePath,
    enable: true
  })).then(readResourceHubJson);
  await loadInstalledBlenderAddons();
  setBlenderAddonStatus("Addon installed.", "ok");
}

async function installGithubBlenderAddon(repositoryUrlOverride) {
  const blenderPath = getSelectedBlenderPath();
  const input = document.getElementById("blender-github-addon-url");
  const enableNode = document.getElementById("blender-github-addon-enable");
  const repositoryUrl = repositoryUrlOverride || (input ? String(input.value || "").trim() : "");
  if (!blenderPath) throw new Error("Select a Blender executable first.");
  if (!repositoryUrl) throw new Error("Paste a GitHub repository URL first.");
  setBlenderAddonStatus("Downloading GitHub addon...", "busy");
  await fetch("/api/blender/addons/install-github", createResourceHubJsonRequestOptions({
    blenderPath,
    repositoryUrl,
    enable: !enableNode || enableNode.checked !== false
  })).then(readResourceHubJson);
  await loadInstalledBlenderAddons();
  setBlenderAddonStatus("GitHub addon installed.", "ok");
}

async function toggleBlenderAddon(moduleName, enabled) {
  const blenderPath = getSelectedBlenderPath();
  if (!blenderPath) throw new Error("Select a Blender executable first.");
  setBlenderAddonStatus((enabled ? "Enabling " : "Disabling ") + moduleName + "...", "busy");
  await fetch("/api/blender/addons/toggle", createResourceHubJsonRequestOptions({
    blenderPath,
    moduleName,
    enabled
  })).then(readResourceHubJson);
  await loadInstalledBlenderAddons();
  setBlenderAddonStatus((enabled ? "Enabled " : "Disabled ") + moduleName + ".", "ok");
}

// Suite configuration with display names and download URLs
const THREE_D_SUITE_CONFIG = {
  "blender": {
    label: "Blender",
    icon: "blender",
    downloadUrl: "https://www.blender.org/download/"
  },
  "3ds-max": {
    label: "3ds Max",
    icon: "cube",
    downloadUrl: "https://www.autodesk.com/products/3ds-max"
  },
  "houdini": {
    label: "Houdini",
    icon: "sparkle",
    tryUrl: "https://www.sidefx.com/download",
    buyUrl: "https://www.sidefx.com/buy/"
  },
  "cinema-4d": {
    label: "Cinema 4D",
    icon: "cube",
    downloadUrl: "https://www.maxon.net/en/cinema-4d"
  }
};

// Track the currently selected global main tab ("projects" | "addons")
let currentSuiteMainTab = "projects";
let activeThreeDSuiteKey = "blender";

function renderAddonSuiteContent(suiteKey) {
  const isBlender = suiteKey === "blender";
  const config = THREE_D_SUITE_CONFIG[suiteKey] || THREE_D_SUITE_CONFIG.blender;
  document.querySelectorAll(".blender-tab-panel").forEach(panel => panel.classList.toggle("hidden", !isBlender));
  const fallbackPanel = document.getElementById("non-blender-addon-panel");
  if (fallbackPanel) fallbackPanel.classList.toggle("hidden", isBlender);
  if (isBlender) return;
  const kicker = document.getElementById("non-blender-addon-kicker");
  const title = document.getElementById("non-blender-addon-title");
  const copy = document.getElementById("non-blender-addon-copy");
  if (kicker) kicker.textContent = config.label;
  if (title) title.textContent = `${config.label} addon management is coming soon`;
  if (copy) copy.textContent = `Choose the ${config.label} executable above. That choice is saved in this browser; install and discovery controls will appear once ${config.label} has a dedicated suite adapter.`;
}

async function loadActiveSuiteInstalls() {
  const suiteKey = activeThreeDSuiteKey;
  const config = THREE_D_SUITE_CONFIG[suiteKey];
  const label = document.getElementById("suite-executable-label");
  if (label) label.textContent = `${config ? config.label : "3D suite"} executable`;
  if (suiteKey === "blender") {
    await loadBlenderInstalls();
    return;
  }
  setSuiteExecutableStatus(`Finding ${config.label} installs...`, "busy");
  const payload = await fetch(`/api/3d-suites/installs?suite=${encodeURIComponent(suiteKey)}`, {cache: "no-store"}).then(readResourceHubJson);
  const installs = Array.isArray(payload.installs) ? payload.installs : [];
  if (!setSuiteExecutableOptions(installs, suiteKey)) {
    setSuiteExecutableStatus(`No ${config.label} executable found. Select a supported local install and refresh.`, "error");
    return;
  }
  setSuiteExecutableStatus(`${installs.length} ${config.label} installation${installs.length === 1 ? "" : "s"} found.`, "ok");
}

function setGlobalSuiteMainTab(tab) {
  currentSuiteMainTab = tab;
  
  // Update active state on global tabs
  document.querySelectorAll("[data-suite-main-nav]").forEach(btn => {
    const btnTab = btn.getAttribute("data-suite-main-nav");
    btn.classList.toggle("active", btnTab === tab);
    btn.setAttribute("aria-selected", btnTab === tab ? "true" : "false");
  });
  
  // Show/hide the global content panels
  const projectsPanel = document.querySelector(".global-projects-panel");
  const addonsPanel = document.querySelector(".global-addons-panel");
  const scriptsPanel = document.querySelector(".global-scripts-panel");
  
  if (projectsPanel) {
    projectsPanel.classList.toggle("hidden", tab !== "projects");
  }
  if (addonsPanel) {
    addonsPanel.classList.toggle("hidden", tab !== "addons");
  }
  if (scriptsPanel) scriptsPanel.classList.toggle("hidden", tab !== "scripts");
  
  if (tab === "addons") {
    renderAddonSuiteContent(activeThreeDSuiteKey);
    if (activeThreeDSuiteKey === "blender") setActiveBlenderAddonNav("home");
    void loadActiveSuiteInstalls().catch(error => setSuiteExecutableStatus(error.message, "error"));
  }
  if (tab === "scripts") void loadRemoteBlenderScriptCatalog(false).catch(() => {});
}

function setActive3DSuite(suiteKey) {
  if (!THREE_D_SUITE_CONFIG[suiteKey]) return;
  activeThreeDSuiteKey = suiteKey;
  // Update active state on rail buttons
  document.querySelectorAll("[data-3d-suite]").forEach(btn => {
    const btnSuite = btn.getAttribute("data-3d-suite");
    btn.classList.toggle("active", btnSuite === suiteKey);
  });
  
  // If we're in Projects mode, show/hide the corresponding suite section
  if (currentSuiteMainTab === "projects") {
    document.querySelectorAll("[data-3d-suite-section]").forEach(section => {
      const sectionSuite = section.getAttribute("data-3d-suite-section");
      section.classList.toggle("hidden", sectionSuite !== suiteKey);
      section.classList.toggle("active", sectionSuite === suiteKey);
    });
  }
  
  // The executable picker belongs to the selected suite, not merely Blender.
  const blenderToolbar = document.getElementById("blender-toolbar");
  if (blenderToolbar) {
    blenderToolbar.classList.toggle("hidden", currentSuiteMainTab !== "addons");
  }
  if (currentSuiteMainTab === "addons") {
    renderAddonSuiteContent(suiteKey);
    void loadActiveSuiteInstalls().catch(error => setSuiteExecutableStatus(error.message, "error"));
  }
}

function openSuiteDownload(suiteKey) {
  const config = THREE_D_SUITE_CONFIG[suiteKey];
  if (!config) return;
  
  // For Houdini, show a prompt with try/buy options
  if (config.tryUrl && config.buyUrl) {
    const choice = confirm(
      `Download ${config.label}?\n\nOK - Try/Download Free Version (${config.tryUrl})\nCancel - Buy License (${config.buyUrl})`
    );
    window.open(choice ? config.tryUrl : config.buyUrl, "_blank", "noopener,noreferrer");
  } else if (config.downloadUrl) {
    window.open(config.downloadUrl, "_blank", "noopener,noreferrer");
  }
}

function bindResourceHubSidebarNav() {
  // Use document-level event delegation for all blender nav tabs
  // This works even when the manager container isn't in DOM yet
  document.addEventListener("click", event => {
    const tab = event.target.closest(".dashboard-tab[data-blender-nav]");
    if (!tab) return;
    
    event.preventDefault();
    event.stopPropagation();
    const nav = tab.getAttribute("data-blender-nav");
    
    // Check if this is a level 2 subtab (inside .blender-subtabs)
    const subtabsContainer = tab.closest(".blender-subtabs");
    if (subtabsContainer) {
      setActiveBlenderAddonSubSection(nav);
    } else {
      setActiveBlenderAddonNav(nav);
    }
  });

  // Handle global Projects/Addons tabs (data-suite-main-nav)
  document.addEventListener("click", event => {
    const tab = event.target.closest(".dashboard-tab[data-suite-main-nav]");
    if (!tab) return;
    
    event.preventDefault();
    event.stopPropagation();
    const mainNav = tab.getAttribute("data-suite-main-nav");
    setGlobalSuiteMainTab(mainNav);
  });
  
  // Handle rail section buttons for 3D suites (switch views, not download URLs)
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-3d-suite]");
    if (!button) return;
    
    event.preventDefault();
    event.stopPropagation();
    const suiteKey = button.getAttribute("data-3d-suite");
    setGlobalSuiteMainTab("projects");
    setActive3DSuite(suiteKey);
  });
  document.querySelectorAll("[data-asset-platform]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      const platform = button.getAttribute("data-asset-platform");
      setActiveGameEngineWorkspace("assets");
      setActiveAssetPlatformNav(platform);
    });
  });
  setActiveBlenderAddonNav(document.querySelector("[data-blender-nav].active")?.getAttribute("data-blender-nav") || "home");
  setActiveAssetPlatformNav(document.querySelector("[data-asset-platform].active")?.getAttribute("data-asset-platform") || "home");
}

function bindResourceHubSidebarCollapse() {
  document.querySelectorAll(".tools-catalog-collapse-button").forEach(trigger => {
    if (trigger.closest(".tools-layout")) return;
    trigger.addEventListener("click", () => {
      const catalog = trigger.closest(".resource-hub-sidebar");
      if (!catalog) return;
      const collapsed = catalog.classList.toggle("is-collapsed") === true;
      trigger.setAttribute("aria-expanded", String(!collapsed));
      trigger.setAttribute("aria-pressed", String(collapsed ? "1" : "0"));
    });
  });
}

async function openExplorerPath(targetPath) {
  try {
    await fetch("/api/explorer/open", createResourceHubJsonRequestOptions({ path: targetPath }));
  } catch (error) {
    console.error("Failed to open Explorer:", error);
  }
}

function setGameEngineProjectStatus(message, tone) {
  const node = document.getElementById("game-engine-project-status");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone || "";
}

function cloneGameEngineProjectIcon(sourceId) {
  return document.querySelector("#" + sourceId + " svg")?.cloneNode(true) || document.createTextNode("");
}

function createGameEngineProjectAction(label, iconSourceId, attributes, secondary) {
  const button = document.createElement("button");
  button.type = "button";
  if (secondary) button.className = "secondary";
  Object.entries(attributes).forEach(([name, value]) => button.setAttribute(name, value));
  const text = document.createElement("span");
  text.textContent = label;
  button.append(cloneGameEngineProjectIcon(iconSourceId), text);
  return button;
}

function renderGameEngineProjects(projects) {
  ["unity", "godot", "unreal"].forEach(engine => {
    const list = document.querySelector(`[data-game-engine-project-list="${engine}"]`);
    const count = document.querySelector(`[data-game-engine-project-count="${engine}"]`);
    const matching = Array.isArray(projects) ? projects.filter(project => project.engine === engine) : [];
    if (count) count.textContent = `${matching.length} cached project${matching.length === 1 ? "" : "s"}`;
    if (!list) return;
    list.innerHTML = "";
    const tableHeader = document.createElement("div");
    tableHeader.className = "game-engine-project-table-header";
    tableHeader.setAttribute("aria-hidden", "true");
    ["", "Project", "Path", "Status", "Actions"].forEach(label => {
      const cell = document.createElement("span");
      cell.textContent = label;
      tableHeader.appendChild(cell);
    });
    list.appendChild(tableHeader);
    if (matching.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tools-workspace-empty";
      empty.textContent = `No ${engine === "unity" ? "Unity" : engine === "godot" ? "Godot" : "Unreal"} projects are cached yet.`;
      list.appendChild(empty);
      return;
    }
    matching.forEach(project => {
      const card = document.createElement("article");
      card.className = "game-engine-project-card";
      card.dataset.gameEngineProject = project.id || "";
      card.dataset.available = project.available ? "true" : "false";
      const icon = document.createElement("div");
      icon.className = "game-engine-project-icon";
      icon.append(cloneGameEngineProjectIcon("game-engine-project-fetch-unity-hub-button"));
      const copy = document.createElement("div");
      copy.className = "game-engine-project-copy";
      const kicker = document.createElement("span");
      kicker.className = "panel-kicker";
      kicker.textContent = [project.engine, project.version, project.source].filter(Boolean).join(" · ");
      const title = document.createElement("h4");
      title.textContent = project.title || "Unity Project";
      const projectPath = document.createElement("code");
      projectPath.textContent = project.projectPath || "";
      projectPath.title = project.projectPath || "";
      const editor = document.createElement("small");
      editor.textContent = project.available
        ? `Unity ${project.version || "version unknown"} · Editor and project found`
        : `Unity ${project.version || "version unknown"} · Editor or project unavailable`;
      copy.append(kicker, title, projectPath, editor);
      const actions = document.createElement("div");
      actions.className = "game-engine-project-actions";
      const explorer = createGameEngineProjectAction("Explorer", "game-engine-project-browse-button", { "data-game-engine-project-open": project.projectPath || "" }, true);
      const launch = createGameEngineProjectAction("Start Project", "game-engine-project-fetch-unity-hub-button", { "data-game-engine-project-launch": project.id || "" }, false);
      launch.disabled = !project.available;
      actions.append(explorer, launch);
      card.append(icon, copy, actions);
      list.appendChild(card);
    });
  });
}

async function loadGameEngineProjects(refreshUnityHub) {
  setGameEngineProjectStatus(refreshUnityHub ? "Reading Unity Hub projects..." : "Loading cached projects...", "busy");
  const suffix = refreshUnityHub ? "?refreshUnityHub=true" : "";
  const payload = await fetch("/api/game-engine-projects" + suffix, { cache: "no-store" }).then(readResourceHubJson);
  renderGameEngineProjects(payload.projects || []);
  setGameEngineProjectStatus(`${Array.isArray(payload.projects) ? payload.projects.length : 0} projects cached persistently.`, "ok");
  return payload;
}

async function fetchUnityHubProjects() {
  setGameEngineProjectStatus("Fetching Unity Hub projects...", "busy");
  const payload = await fetch("/api/game-engine-projects/fetch-unity-hub", createResourceHubJsonRequestOptions({})).then(readResourceHubJson);
  renderGameEngineProjects(payload.projects || []);
  setGameEngineProjectStatus(`Fetched ${Array.isArray(payload.projects) ? payload.projects.length : 0} cached projects from Unity Hub.`, "ok");
}

async function browseForGameEngineProject() {
  setGameEngineProjectStatus("Waiting for project folder selection...", "busy");
  const payload = await fetch("/api/game-engine-projects/browse", createResourceHubJsonRequestOptions({})).then(readResourceHubJson);
  if (payload.canceled) {
    setGameEngineProjectStatus("Project browse canceled.", "");
    return;
  }
  renderGameEngineProjects(payload.projects || []);
  setGameEngineProjectStatus("Project added to the persistent cache.", "ok");
}

async function scanForGameEngineProjects() {
  const rootNode = document.getElementById("game-engine-project-scan-root");
  const recursiveNode = document.getElementById("game-engine-project-scan-recursive");
  const rootPath = rootNode ? String(rootNode.value || "").trim() : "";
  if (!rootPath) throw new Error("Choose a project scan folder first.");
  setGameEngineProjectStatus(recursiveNode?.checked ? "Scanning folder and subfolders..." : "Checking selected folder...", "busy");
  const payload = await fetch("/api/game-engine-projects/scan", createResourceHubJsonRequestOptions({ rootPath, recursive: recursiveNode?.checked === true })).then(readResourceHubJson);
  renderGameEngineProjects(payload.projects || []);
  setGameEngineProjectStatus(`${Array.isArray(payload.projects) ? payload.projects.length : 0} projects cached after scan.`, "ok");
}

async function launchGameEngineProject(button) {
  const projectId = button.getAttribute("data-game-engine-project-launch") || "";
  button.disabled = true;
  setGameEngineProjectStatus("Starting project...", "busy");
  try {
    await fetch("/api/game-engine-projects/launch", createResourceHubJsonRequestOptions({ projectId })).then(readResourceHubJson);
    setGameEngineProjectStatus("Project launch requested.", "ok");
  } finally {
    button.disabled = false;
  }
}

function bindAssetRepoImporters() {
  ["unity", "godot", "unreal"].forEach(function (platform) {
    const importButton = document.querySelector(`[data-asset-github-import-button="${platform}"]`);
    const releaseButton = document.querySelector(`[data-asset-github-release-button="${platform}"]`);
    const releaseDownloadSelectedButton = document.querySelector(`[data-asset-github-release-download-selected-button="${platform}"]`);
    const repoInput = document.querySelector(`[data-asset-github-repo-input="${platform}"]`);
    const releaseAssetSelect = document.querySelector(`[data-asset-github-release-asset-select="${platform}"]`);
    if (importButton) {
      importButton.addEventListener("click", function () {
        void importGithubAssetRepository(platform).catch(function (error) {
          setAssetImportStatus(platform, error.message, "error");
        });
      });
    }
    if (releaseButton) {
      releaseButton.addEventListener("click", function () {
        void downloadGithubAssetLatestRelease(platform, null).catch(function (error) {
          setAssetImportStatus(platform, error.message, "error");
        });
      });
    }
    if (releaseDownloadSelectedButton && releaseAssetSelect) {
      releaseDownloadSelectedButton.addEventListener("click", function () {
        void downloadGithubAssetLatestRelease(platform, String(releaseAssetSelect.value || "").trim() || null).catch(function (error) {
          setAssetImportStatus(platform, error.message, "error");
        });
      });
    }
    if (repoInput) {
      repoInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        void importGithubAssetRepository(platform).catch(function (error) {
          setAssetImportStatus(platform, error.message, "error");
        });
      });
      repoInput.addEventListener("input", function () {
        hideAssetReleaseAssetSelector(platform);
      });
    }
    void renderImportedAssetRepositories(platform);
  });
}

function bindGameEngineWorkspaceControls() {
  document.querySelectorAll("[data-game-engine-workspace-tab]").forEach(button => {
    button.addEventListener("click", () => {
      const workspace = button.getAttribute("data-game-engine-workspace-tab");
      setActiveGameEngineWorkspace(workspace);
      if (workspace === "projects") void loadGameEngineProjects(true).catch(error => setGameEngineProjectStatus(error.message, "error"));
      if (workspace === "assets") void loadRemoteAssetCatalog(false).catch(function () {});
    });
  });
  document.getElementById("game-engine-project-browse-button")?.addEventListener("click", () => void browseForGameEngineProject().catch(error => setGameEngineProjectStatus(error.message, "error")));
  document.getElementById("game-engine-project-scan-button")?.addEventListener("click", () => void scanForGameEngineProjects().catch(error => setGameEngineProjectStatus(error.message, "error")));
  document.getElementById("game-engine-project-fetch-unity-hub-button")?.addEventListener("click", () => void fetchUnityHubProjects().catch(error => setGameEngineProjectStatus(error.message, "error")));
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-game-engine-project-launch], [data-game-engine-project-open]") : null;
    if (!target) return;
    const explorerPath = target.getAttribute("data-game-engine-project-open");
    if (explorerPath) {
      void openExplorerPath(explorerPath);
      return;
    }
    if (target.hasAttribute("data-game-engine-project-launch")) {
      void launchGameEngineProject(target).catch(error => setGameEngineProjectStatus(error.message, "error"));
    }
  });
  setActiveGameEngineWorkspace("projects");
  setActiveAssetPlatformNav("unity");
  void loadGameEngineProjects(true).catch(error => setGameEngineProjectStatus(error.message, "error"));
}

function bindResourceHubBlenderControls() {
  const manager = document.querySelector("[data-blender-addon-manager]");
  if (!manager) return;
  const select = getSuiteExecutableSelect();
  if (select) select.addEventListener("change", () => {
    saveSuiteExecutable(activeThreeDSuiteKey, String(select.value || "").trim());
    if (activeThreeDSuiteKey === "blender") {
      void loadInstalledBlenderAddons().catch(error => setBlenderAddonStatus(error.message, "error"));
    }
  });
  const refreshButton = document.getElementById("blender-refresh-addons-button");
  if (refreshButton) refreshButton.addEventListener("click", () => void loadActiveSuiteInstalls().catch(error => setSuiteExecutableStatus(error.message, "error")));
  const githubButton = document.getElementById("blender-install-github-addon-button");
  if (githubButton) githubButton.addEventListener("click", () => void installGithubBlenderAddon().catch(error => setBlenderAddonStatus(error.message, "error")));
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-blender-install-local], [data-blender-toggle-addon], [data-blender-install-github-url]") : null;
    if (!target) return;
    const githubUrl = target.getAttribute("data-blender-install-github-url");
    if (githubUrl) {
      void installGithubBlenderAddon(githubUrl).catch(error => setBlenderAddonStatus(error.message, "error"));
      return;
    }
    const localPath = target.getAttribute("data-blender-install-local");
    if (localPath) {
      void installLocalBlenderAddon(localPath).catch(error => setBlenderAddonStatus(error.message, "error"));
      return;
    }
    const moduleName = target.getAttribute("data-blender-toggle-addon");
    if (moduleName) {
      void toggleBlenderAddon(moduleName, target.getAttribute("data-next-enabled") === "true").catch(error => setBlenderAddonStatus(error.message, "error"));
      return;
    }
  });
  void loadActiveSuiteInstalls().catch(error => setSuiteExecutableStatus(error.message, "error"));
}

function bindResourceHubExplorerButtons() {
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("[data-explorer-open]") : null;
    if (!target) return;
    const pathValue = target.getAttribute("data-explorer-open");
    if (pathValue) {
      void openExplorerPath(pathValue).catch(error => console.error("Failed to open Explorer:", error));
    }
  });
}


function bindDashboardResourceHubViews() {
  bindResourceHubSidebarNav();
  bindResourceHubSidebarCollapse();
  bindResourceHubBlenderControls();
  bindAssetRepoImporters();
  bindRemoteAssetCatalog();
  document.querySelectorAll("[data-blender-script-refetch]").forEach(button => button.addEventListener("click", () => void loadRemoteBlenderScriptCatalog(true).catch(() => {})));
  bindResourceHubExplorerButtons();
  bindGameEngineWorkspaceControls();
  document.querySelector(".rail-assets-button")?.addEventListener("click", () => {
    setActiveGameEngineWorkspace("projects");
    setActiveAssetPlatformNav("unity");
    void loadGameEngineProjects(true).catch(error => setGameEngineProjectStatus(error.message, "error"));
  });
  document.querySelector(".rail-3d-suites-button")?.addEventListener("click", () => {
    setActiveBlenderAddonNav("addons");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindDashboardResourceHubViews, { once: true });
} else {
  bindDashboardResourceHubViews();
}
