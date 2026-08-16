function createDashboardGithubToolImportHelpers(input) {
  const query = typeof input.query === "function"
    ? input.query
    : selector => document.querySelector(selector);
  const createElement = typeof input.createElement === "function"
    ? input.createElement
    : tagName => document.createElement(tagName);

  function setStatus(message, tone) {
    const node = query("[data-tool-github-import-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone || "";
  }

  function getRepositoryValue() {
    return String(query("[data-tool-github-repo-input]")?.value || "").trim();
  }

  function getToolTypeValue() {
    return String(query("[data-tool-github-type-select]")?.value || "").trim();
  }

  function hideReleaseAssetSelector() {
    const row = query("[data-tool-release-select-row]");
    const select = query("[data-tool-github-release-asset-select]");
    row?.classList.add("hidden");
    if (!select) return;
    select.innerHTML = "";
    delete select.dataset.repo;
    delete select.dataset.releaseName;
  }

  function formatReleaseAssetLabel(asset) {
    const size = Number(asset?.size || 0);
    if (!size) return String(asset?.name || "Asset");
    if (size >= 1024 * 1024) return String(asset.name || "Asset") + " (" + (size / (1024 * 1024)).toFixed(1) + " MB)";
    if (size >= 1024) return String(asset.name || "Asset") + " (" + Math.round(size / 1024) + " KB)";
    return String(asset.name || "Asset") + " (" + size + " B)";
  }

  function showReleaseAssetSelector(repository, release) {
    const row = query("[data-tool-release-select-row]");
    const select = query("[data-tool-github-release-asset-select]");
    if (!row || !select) return;
    select.innerHTML = "";
    (Array.isArray(release?.assets) ? release.assets : []).forEach(asset => {
      const option = createElement("option");
      option.value = String(asset?.name || "");
      option.textContent = formatReleaseAssetLabel(asset);
      select.appendChild(option);
    });
    select.dataset.repo = repository;
    select.dataset.releaseName = String(release?.releaseName || release?.tagName || "latest release");
    row.classList.remove("hidden");
  }

  function createActionButton(label, className, onClick) {
    const button = createElement("button");
    button.type = "button";
    button.className = className || "secondary";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  async function openImportedToolFolder(destinationPath) {
    await input.api.post("/api/explorer/open", {path: destinationPath});
  }

  function createImportedToolCard(entry) {
    const card = createElement("article");
    card.className = "desktop-tool-card imported-tool-card";
    const icon = createElement("div");
    icon.className = "desktop-tool-card-icon";
    icon.innerHTML = input.renderFileIcon(
      entry.toolType === "web"
        ? "command"
        : input.getFileExtension(entry.launcherCandidates?.[0]?.absolutePath || "py")
    );
    const copy = createElement("div");
    copy.className = "desktop-tool-card-copy imported-tool-card-copy";
    const flair = createElement("span");
    flair.className = "resource-flair";
    flair.textContent = entry.toolType === "web" ? "Web" : "Desktop";
    const title = createElement("h4");
    title.textContent = entry.title || entry.repoRef || "Imported Tool";
    const description = createElement("p");
    description.textContent = entry.description || entry.readmeSummary || entry.repoUrl;
    const repo = createElement("code");
    repo.className = "imported-tool-card-repo";
    repo.textContent = entry.repoRef || entry.repoUrl;
    copy.append(flair, title, description, repo);

    if (entry.notes?.length) {
      const notes = createElement("small");
      notes.textContent = entry.notes[0];
      copy.appendChild(notes);
    }
    if (entry.buildInstructions) {
      const build = createElement("pre");
      build.className = "imported-tool-build";
      build.textContent = entry.buildInstructions;
      copy.appendChild(build);
    }

    const actions = createElement("div");
    actions.className = "desktop-tool-card-actions imported-tool-card-actions";
    if (entry.toolType === "web" && entry.openUrl) {
      const open = createElement("a");
      open.className = "secondary desktop-tool-card-action";
      open.href = entry.openUrl;
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = "Open Tool";
      actions.appendChild(open);
    }
    if (entry.toolType === "desktop" && entry.launcherCandidates?.length) {
      const launcher = entry.launcherCandidates[0];
      actions.appendChild(createActionButton("Pin " + launcher.label, "secondary", () => {
        try {
          input.pinTool(launcher.absolutePath);
        } catch (error) {
          input.setDesktopStatus(error.message, "error");
        }
      }));
    }
    actions.appendChild(createActionButton("Open Folder", "secondary", () => {
      void openImportedToolFolder(entry.destinationPath).catch(error => setStatus(error.message, "error"));
    }));
    const github = createElement("a");
    github.className = "ghost desktop-tool-card-action";
    github.href = entry.repoUrl;
    github.target = "_blank";
    github.rel = "noopener";
    github.textContent = "GitHub";
    actions.appendChild(github);
    card.append(icon, copy, actions);
    return card;
  }

  async function render() {
    const list = query("[data-imported-tool-list]");
    if (!list) return false;
    list.innerHTML = "";
    try {
      const payload = await input.api.get("/api/tool-repos");
      const imports = Array.isArray(payload?.imports) ? payload.imports : [];
      if (imports.length === 0) {
        const empty = createElement("div");
        empty.className = "tools-workspace-empty desktop-tool-empty";
        empty.textContent = "No GitHub tool repositories imported yet.";
        list.appendChild(empty);
        return true;
      }
      imports.forEach(entry => list.appendChild(createImportedToolCard(entry)));
    } catch (error) {
      const empty = createElement("div");
      empty.className = "tools-workspace-empty desktop-tool-empty";
      empty.textContent = error.message || "Failed to load imported repositories.";
      list.appendChild(empty);
    }
    return true;
  }

  async function importRepository() {
    const repoInput = query("[data-tool-github-repo-input]");
    const typeSelect = query("[data-tool-github-type-select]");
    const repository = getRepositoryValue();
    if (!repository) throw new Error("Enter a GitHub repository first.");
    hideReleaseAssetSelector();
    setStatus("Cloning " + repository + "...", "busy");
    try {
      const payload = await input.api.post("/api/tool-repos/import", {
        repository,
        toolType: getToolTypeValue() || null
      });
      if (repoInput) repoInput.value = "";
      if (typeSelect) typeSelect.value = "";
      await render();
      if (payload?.entry?.toolType === "web") {
        setStatus(payload.entry.browserReady
          ? "Imported " + payload.entry.title + ". Open it below now, or reload the Browser tab to see it in the catalog."
          : "Imported " + payload.entry.title + ". Build it first, then reload the Browser tab when an index.html entry exists.", "ok");
        return;
      }
      setStatus("Imported " + (payload?.entry?.title || repository) + ".", "ok");
    } catch (error) {
      if (error?.payload?.requiresToolType) {
        setStatus((error.payload.error || error.message) + " Select Web or Desktop above and retry.", "busy");
        return;
      }
      throw error;
    }
  }

  async function downloadLatestReleaseAsset(assetName) {
    const repository = getRepositoryValue();
    if (!repository) throw new Error("Enter a GitHub repository first.");
    setStatus("Checking latest release for " + repository + "...", "busy");
    try {
      const payload = await input.api.post("/api/tool-repos/download-release", {
        repository,
        assetName: assetName || null
      });
      hideReleaseAssetSelector();
      const asset = payload?.asset;
      if (asset?.autoPinnable) {
        try {
          input.pinTool(asset.downloadPath);
          setStatus("Downloaded " + asset.assetName + " and pinned it as a desktop tool.", "ok");
          return;
        } catch (pinError) {
          setStatus("Downloaded " + asset.assetName + " to " + asset.downloadPath + ". Pinning failed: " + pinError.message, "busy");
          return;
        }
      }
      setStatus("Downloaded " + (asset?.assetName || "release asset") + " to " + (asset?.downloadPath || "the local releases folder") + ".", "ok");
    } catch (error) {
      if (error?.payload?.requiresAssetSelection) {
        showReleaseAssetSelector(repository, error.payload.release);
        setStatus((error.payload.error || error.message) + " Choose a file below.", "busy");
        return;
      }
      throw error;
    }
  }

  function bind() {
    const importButton = query("[data-tool-github-import-button]");
    const releaseButton = query("[data-tool-github-release-button]");
    const selectedReleaseButton = query("[data-tool-github-release-download-selected-button]");
    const repoInput = query("[data-tool-github-repo-input]");
    const typeSelect = query("[data-tool-github-type-select]");
    const releaseAssetSelect = query("[data-tool-github-release-asset-select]");
    if (!importButton || !releaseButton || !selectedReleaseButton || !repoInput || !typeSelect || !releaseAssetSelect) return false;
    const reportError = error => setStatus(error.message, "error");
    importButton.addEventListener("click", () => void importRepository().catch(reportError));
    releaseButton.addEventListener("click", () => void downloadLatestReleaseAsset(null).catch(reportError));
    selectedReleaseButton.addEventListener("click", () => {
      void downloadLatestReleaseAsset(String(releaseAssetSelect.value || "").trim() || null).catch(reportError);
    });
    repoInput.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void importRepository().catch(reportError);
    });
    repoInput.addEventListener("input", hideReleaseAssetSelector);
    return true;
  }

  return {bind, render};
}
