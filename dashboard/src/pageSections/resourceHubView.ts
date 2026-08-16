import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "@urage/server/config/repositoryPaths";
import { renderBlenderIconSvg, renderButtonIcon, renderBootstrapIcon } from "../shared/dashboardIcons.js";
import { renderDashboardLayoutSwitcher } from "../shared/dashboardLayoutSwitcher.js";

type ResourceKind = "blender" | "unity" | "godot" | "unreal";

type ResourceHubEntry = {
  id: string;
  title: string;
  description: string;
  kind: string;
  group: ResourceKind;
  relativePath: string;
  absolutePath: string;
  sourcePath: string;
  fileCount: number;
  directoryCount: number;
};

type ResourceRootInput = {
  root: string;
  group: ResourceKind;
  kind: string;
  description: string;
  includeExtensions?: string[];
  depth?: number;
};

type RecommendedBlenderAddon = {
  title: string;
  description: string;
  url: string;
  flair: string;
};

const externalBlenderAddonRoot = "C:\\Files\\github\\URage-suite\\URage Addons\\blender";
const recommendedBlenderAddons: RecommendedBlenderAddon[] = [
  {
    title: "ComfyUI Model Generator",
    description: "Blender-side workflow bridge for URage model generation.",
    url: "https://github.com/sysoutch/blender-ComfyUIModelGenerator-addon",
    flair: "URage"
  },
  {
    title: "Blender Decimator",
    description: "Quick mesh decimation controls for generated and imported assets.",
    url: "https://github.com/sysoutch/blender-decimator-addon",
    flair: "URage"
  },
  {
    title: "Low Poly UV",
    description: "Low-poly UV helper addon for game-ready asset cleanup.",
    url: "https://github.com/sysoutch/blender-lowpolyuv-addon",
    flair: "URage"
  },
  {
    title: "Mesh Tools",
    description: "Utility mesh operations for cleanup, inspection, and export prep.",
    url: "https://github.com/sysoutch/blender-meshtools-addon",
    flair: "URage"
  },
  {
    title: "Blender BakeLab2",
    description: "Baking workflow addon fork for texture and map production.",
    url: "https://github.com/sysoutch/Blender-BakeLab2",
    flair: "Fork"
  }
];
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function toTitleCase(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveWorkspaceRoot(): string {
  return repoRoot;
}

function resolveInputRoot(root: string): string {
  return path.isAbsolute(root) ? path.resolve(root) : path.resolve(resolveWorkspaceRoot(), root);
}

function getDisplayPath(absolutePath: string): string {
  const workspaceRelative = path.relative(resolveWorkspaceRoot(), absolutePath).replaceAll("\\", "/");
  if (!workspaceRelative.startsWith("../") && workspaceRelative !== ".." && !path.isAbsolute(workspaceRelative)) return workspaceRelative;
  return absolutePath;
}

function toServedSourcePath(absolutePath: string): string {
  const workspaceRelative = path.relative(resolveWorkspaceRoot(), absolutePath).replaceAll("\\", "/");
  if (!workspaceRelative.startsWith("../") && workspaceRelative !== ".." && !path.isAbsolute(workspaceRelative)) {
    return "/" + workspaceRelative.split("/").map(encodeURIComponent).join("/");
  }
  return "";
}

function normalizeResourceId(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function isAllowedResourceFile(filePath: string, extensions?: string[]): boolean {
  if (!extensions || extensions.length === 0) return true;
  const extension = path.extname(filePath).toLowerCase();
  return extensions.includes(extension);
}

function countDirectoryChildren(directory: string): { fileCount: number; directoryCount: number; } {
  let fileCount = 0;
  let directoryCount = 0;
  const visit = (currentDirectory: string) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "Library") continue;
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        directoryCount += 1;
        visit(absolutePath);
        continue;
      }
      if (entry.isFile()) fileCount += 1;
    }
  };
  try {
    visit(directory);
  } catch {
    return { fileCount, directoryCount };
  }
  return { fileCount, directoryCount };
}

function collectResourceEntries(input: ResourceRootInput, limit = 120): ResourceHubEntry[] {
  const rootDirectory = resolveInputRoot(input.root);
  if (!existsSync(rootDirectory)) return [];
  const rootStat = statSync(rootDirectory);
  if (rootStat.isFile()) {
    const relativePath = getDisplayPath(rootDirectory);
    return [{
      id: normalizeResourceId(`${input.group}-${relativePath}`),
      title: toTitleCase(path.basename(rootDirectory)),
      description: input.description,
      kind: input.kind,
      group: input.group,
      relativePath,
      absolutePath: rootDirectory,
      sourcePath: toServedSourcePath(rootDirectory),
      fileCount: 1,
      directoryCount: 0
    }];
  }
  const entries: ResourceHubEntry[] = [];
  for (const entry of readdirSync(rootDirectory, { withFileTypes: true })) {
    if (entries.length >= limit) break;
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "Library") continue;
    const absolutePath = path.join(rootDirectory, entry.name);
    if (entry.isFile() && !isAllowedResourceFile(absolutePath, input.includeExtensions)) continue;
    if (!entry.isDirectory() && !entry.isFile()) continue;
    const childCounts = entry.isDirectory() ? countDirectoryChildren(absolutePath) : { fileCount: 1, directoryCount: 0 };
    const relativePath = getDisplayPath(absolutePath);
    entries.push({
      id: normalizeResourceId(`${input.group}-${relativePath}`),
      title: toTitleCase(entry.name),
      description: input.description,
      kind: input.kind,
      group: input.group,
      relativePath,
      absolutePath,
      sourcePath: toServedSourcePath(absolutePath),
      fileCount: childCounts.fileCount,
      directoryCount: childCounts.directoryCount
    });
  }
  return entries.sort((a, b) => a.title.localeCompare(b.title));
}

function renderResourceHubHomeTile(input: { title: string; description: string; iconKey: "download" | "sparkle" | "folder" | "wand" | "box" | "refresh" | "expand"; actionLabel: string; actionAttribute: string; actionValue: string; }): string {
  return `
              <article class="resource-hub-home-tile">
                <div class="resource-hub-home-tile-icon" aria-hidden="true">${renderButtonIcon(input.iconKey)}</div>
                <div class="resource-hub-home-tile-copy">
                  <h4>${escapeHtml(input.title)}</h4>
                  <p>${escapeHtml(input.description)}</p>
                </div>
                <button class="secondary resource-hub-home-tile-action" ${escapeHtml(input.actionAttribute)}="${escapeHtml(input.actionValue)}" type="button">${renderButtonIcon("expand")}<span>${escapeHtml(input.actionLabel)}</span></button>
              </article>`;
}

function renderBlenderAddonsHome(entries: ResourceHubEntry[]): string {
  return `
            <section class="resource-manager-panel resource-hub-section active resource-hub-home-panel" data-blender-section-panel="home" data-blender-addon-section-panel="home" id="blender-home-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">Home</span>
                  <h4>3D Suites Home</h4>
                </div>
                <span class="resource-manager-status">Start here to install, inspect, and manage addons.</span>
              </div>
              <div class="resource-hub-home-hero">
                <div class="resource-hub-home-copy">
                  <span class="panel-kicker">Blender</span>
                  <h3>Addon Manager Home</h3>
                  <p>Jump into GitHub installs, curated recommendations, local sources, or installed addons without hunting through the whole sidebar.</p>
                  <div class="resource-hub-home-stats">
                    <article class="resource-hub-home-stat">
                      <strong>${recommendedBlenderAddons.length}</strong>
                      <span>recommended addons</span>
                    </article>
                    <article class="resource-hub-home-stat">
                      <strong>${entries.length}</strong>
                      <span>local source repos</span>
                    </article>
                    <article class="resource-hub-home-stat">
                      <strong>4</strong>
                      <span>quick entry points</span>
                    </article>
                  </div>
                </div>
                <div class="resource-hub-home-grid">
${[
  { title: "Online", description: "Install from GitHub and enable after install.", iconKey: "download" as const, actionLabel: "Open Online", actionAttribute: "data-blender-nav", actionValue: "online" },
  { title: "Recommended", description: "Curated addons picked for the URage workflow.", iconKey: "sparkle" as const, actionLabel: "Open Recommended", actionAttribute: "data-blender-nav", actionValue: "recommended" },
  { title: "Local Sources", description: "Browse local addon repositories and script helpers.", iconKey: "folder" as const, actionLabel: "Open Local Sources", actionAttribute: "data-blender-nav", actionValue: "local-sources" },
  { title: "Installed", description: "Review the addons reported by your selected Blender executable.", iconKey: "wand" as const, actionLabel: "Open Installed", actionAttribute: "data-blender-nav", actionValue: "local" }
].map(tile => renderResourceHubHomeTile(tile)).join("\n")}
                </div>
              </div>
            </section>`;
}

function renderAssetsHome(): string {
  return `
            <section class="resource-manager-panel resource-hub-section active resource-hub-home-panel" data-asset-platform-panel="home" data-asset-platform-tab="home" id="asset-home-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">Home</span>
                  <h4>Assets Home</h4>
                </div>
                <span class="resource-manager-status">Start here to browse Unity, Godot, and Unreal sources.</span>
              </div>
              <div class="resource-hub-home-hero">
                <div class="resource-hub-home-copy">
                  <span class="panel-kicker">Game Engines</span>
                  <h3>Assets Workspace Home</h3>
                  <p>Keep the engine-specific sources close at hand. Use the home view to jump to Unity, Godot, or Unreal without opening every platform stack first.</p>
                  <div class="resource-hub-home-stats">
                    <article class="resource-hub-home-stat">
                      <strong data-remote-asset-count="unity">0</strong>
                      <span>Unity sources</span>
                    </article>
                    <article class="resource-hub-home-stat">
                      <strong data-remote-asset-count="godot">0</strong>
                      <span>Godot sources</span>
                    </article>
                    <article class="resource-hub-home-stat">
                      <strong data-remote-asset-count="unreal">0</strong>
                      <span>Unreal sources</span>
                    </article>
                  </div>
                </div>
                <div class="resource-hub-home-grid">
${[
  { title: "Unity", description: "Browse URage Unity packages and repository sources.", iconKey: "box" as const, actionLabel: "Open Unity", actionAttribute: "data-asset-platform", actionValue: "unity" },
  { title: "Godot", description: "Open the Godot mirror and its curated sources.", iconKey: "box" as const, actionLabel: "Open Godot", actionAttribute: "data-asset-platform", actionValue: "godot" },
  { title: "Unreal", description: "Inspect Unreal plugin sources and local package folders.", iconKey: "box" as const, actionLabel: "Open Unreal", actionAttribute: "data-asset-platform", actionValue: "unreal" }
].map(tile => renderResourceHubHomeTile(tile)).join("\n")}
                </div>
              </div>
            </section>`;
}

function renderBlenderAddonCard(entry: ResourceHubEntry): string {
  return `
              <article class="resource-hub-card blender-addon-card" id="resource-hub-card-${escapeHtml(entry.id)}" data-resource-hub-card="${escapeHtml(entry.id)}">
                <div class="resource-hub-card-icon" aria-hidden="true">${renderButtonIcon("wand")}</div>
                <div class="resource-hub-card-copy">
                  <span class="panel-kicker">${escapeHtml(entry.kind)}</span>
                  <h4>${escapeHtml(entry.title)}</h4>
                  <p>${escapeHtml(entry.description)}</p>
                  <code title="${escapeHtml(entry.absolutePath)}">${escapeHtml(entry.relativePath)}</code>
                  <small>${entry.fileCount} files · ${entry.directoryCount} folders</small>
                </div>
                <button class="secondary resource-hub-card-action" data-blender-install-local="${escapeHtml(entry.absolutePath)}" type="button">${renderButtonIcon("download")}<span>Install</span></button>
              </article>`;
}

function renderRecommendedBlenderAddonCard(addon: RecommendedBlenderAddon): string {
  return `
              <article class="resource-hub-card resource-recommendation-card">
                <div class="resource-hub-card-icon" aria-hidden="true">${renderButtonIcon("wand")}</div>
                <div class="resource-hub-card-copy">
                  <span class="resource-flair">${escapeHtml(addon.flair)}</span>
                  <h4>${escapeHtml(addon.title)}</h4>
                  <p>${escapeHtml(addon.description)}</p>
                  <code>${escapeHtml(addon.url.replace("https://github.com/", ""))}</code>
                </div>
                <button class="secondary resource-hub-card-action" data-blender-install-github-url="${escapeHtml(addon.url)}" type="button">${renderButtonIcon("download")}<span>Install</span></button>
              </article>`;
}

function renderAssetImportPanel(engine: Exclude<ResourceKind, "blender">): string {
  const engineLabel = toTitleCase(engine);
  return `
            <section class="resource-manager-panel resource-hub-section" data-asset-platform-panel="${engine}" data-asset-platform-tab="${engine}" id="asset-${engine}-import-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">GitHub</span>
                  <h4>Import ${engineLabel} Repository</h4>
                </div>
              </div>
              <div class="tool-import-form">
                <div class="field">
                  <label for="asset-github-repo-input-${engine}">GitHub Repository</label>
                  <input id="asset-github-repo-input-${engine}" data-asset-github-repo-input="${engine}" placeholder="owner/repo or https://github.com/owner/repo">
                </div>
                <div class="tool-import-actions">
                  <button data-asset-github-import-button="${engine}" type="button">${renderButtonIcon("download")}<span>Clone Repo</span></button>
                  <button class="secondary" data-asset-github-release-button="${engine}" type="button">${renderButtonIcon("download")}<span>Download Release</span></button>
                </div>
              </div>
              <div class="tool-release-select-row hidden" data-asset-release-select-row="${engine}">
                <div class="field">
                  <label for="asset-github-release-asset-select-${engine}">Latest Release Asset</label>
                  <select id="asset-github-release-asset-select-${engine}" data-asset-github-release-asset-select="${engine}"></select>
                </div>
                <button class="secondary" data-asset-github-release-download-selected-button="${engine}" type="button">${renderButtonIcon("download")}<span>Download Selected Asset</span></button>
              </div>
              <div class="hint" data-asset-github-import-status="${engine}">Clone a GitHub repo or download the latest release into the ${engineLabel} asset workspace.</div>
            </section>
            <section class="resource-manager-panel resource-hub-section" data-asset-platform-panel="${engine}" data-asset-platform-tab="${engine}" id="asset-${engine}-imported-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">Imported</span>
                  <h4>${engineLabel} GitHub Imports</h4>
                </div>
              </div>
              <div class="desktop-tool-card-grid" data-imported-asset-list="${engine}"></div>
            </section>`;
}

function renderRemoteAssetCatalogPanel(engine: Exclude<ResourceKind, "blender">): string {
  const engineLabel = toTitleCase(engine);
  return `
            <section class="resource-manager-panel resource-hub-section" data-asset-platform-panel="${engine}" data-asset-platform-tab="${engine}" id="asset-${engine}-catalog-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">Cached GitHub Catalog</span>
                  <h4>${engineLabel} Packages</h4>
                </div>
                <button class="secondary" data-remote-asset-refetch type="button">${renderButtonIcon("refresh")}<span>Refetch</span></button>
              </div>
              <div class="hint" data-remote-asset-catalog-status="${engine}">Loading ${engineLabel} packages from sysoutch/URage-Assets...</div>
              <div class="resource-hub-grid asset-platform-grid" data-remote-asset-catalog-list="${engine}">
                <div class="tools-workspace-empty">Loading cached GitHub catalog...</div>
              </div>
            </section>`;
}

function renderGameEngineProjects(): string {
  const engineGroups: Array<Exclude<ResourceKind, "blender">> = ["unity", "godot", "unreal"];
  return engineGroups.map(engine => {
    return `
            <section class="resource-manager-panel resource-hub-section${engine === "unity" ? " active" : ""}" data-asset-platform-panel="${engine}" data-asset-platform-tab="${engine}">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">${escapeHtml(engine)}</span>
                  <h4>${escapeHtml(toTitleCase(engine))} Projects</h4>
                </div>
                <span class="resource-manager-status" data-game-engine-project-count="${engine}">Loading projects...</span>
              </div>
              <div class="game-engine-project-list" data-game-engine-project-list="${engine}">
                <div class="game-engine-project-table-header" aria-hidden="true"><span></span><span>Project</span><span>Path</span><span>Status</span><span>Actions</span></div>
                <div class="tools-workspace-empty">No ${escapeHtml(toTitleCase(engine))} projects are cached yet.</div>
              </div>
            </section>`;
  }).join("\n");
}

// 3D Suite configuration for rendering
const THREE_D_SUITE_INFO: Array<{ key: string; label: string; iconKey: "blender" | "cube" | "sparkle"; downloadUrl?: string; tryUrl?: string; buyUrl?: string }> = [
  { key: "blender", label: "Blender", iconKey: "blender", downloadUrl: "https://www.blender.org/download/" },
  { key: "3ds-max", label: "3ds Max", iconKey: "cube", downloadUrl: "https://www.autodesk.com/products/3ds-max" },
  { key: "houdini", label: "Houdini", iconKey: "sparkle", tryUrl: "https://www.sidefx.com/download", buyUrl: "https://www.sidefx.com/buy/" },
  { key: "cinema-4d", label: "Cinema 4D", iconKey: "cube", downloadUrl: "https://www.maxon.net/en/cinema-4d" }
];

function render3DSuiteDownloadButton(suite: typeof THREE_D_SUITE_INFO[0]): string {
  const btnIcon = suite.iconKey === "blender" ? renderBlenderIconSvg() : renderButtonIcon("download");
  
  if (suite.tryUrl && suite.buyUrl) {
    // Houdini: show both try and buy buttons
    return `
                <div class="resource-hub-download-actions">
                  <a class="primary resource-hub-card-action" href="${escapeHtml(suite.tryUrl)}" target="_blank" rel="noopener">${renderButtonIcon("download")}<span>Try / Free Download</span></a>
                  <a class="secondary resource-hub-card-action" href="${escapeHtml(suite.buyUrl)}" target="_blank" rel="noopener">${renderButtonIcon("expand")}<span>Buy License</span></a>
                </div>`;
  }
  
  if (suite.downloadUrl) {
    return `
                <a class="primary resource-hub-card-action" href="${escapeHtml(suite.downloadUrl)}" target="_blank" rel="noopener">${btnIcon}<span>Download ${escapeHtml(suite.label)}</span></a>`;
  }
  
  return "";
}

function render3DSuiteHome(): string {
  const suiteTiles = THREE_D_SUITE_INFO.map(suite => `
                  <article class="resource-hub-card resource-recommendation-card" data-3d-suite-section="${escapeHtml(suite.key)}">
                    <div class="resource-hub-card-icon" aria-hidden="true">${suite.iconKey === "blender" ? renderBlenderIconSvg() : renderButtonIcon("cube")}</div>
                    <div class="resource-hub-card-copy">
                      <h4>${escapeHtml(suite.label)}</h4>
                      <p>Install, inspect, and manage ${escapeHtml(suite.label)} projects and assets.</p>
                    </div>
                    ${render3DSuiteDownloadButton(suite)}
                  </article>`).join("\n");

  return `
            <section class="resource-manager-panel resource-hub-section active resource-hub-home-panel" data-3d-suite-section="home" id="3d-suites-home-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">Home</span>
                  <h4>3D Suites Home</h4>
                </div>
                <span class="resource-manager-status">Select a 3D suite to get started.</span>
              </div>
              <div class="resource-hub-home-hero">
                <div class="resource-hub-home-copy">
                  <span class="panel-kicker">3D Suites</span>
                  <h3>Choose Your 3D Suite</h3>
                  <p>Select a suite from the sidebar to view its projects, assets, and download options.</p>
                </div>
              </div>
              <div class="resource-hub-grid">
${suiteTiles}
              </div>
            </section>`;
}

function render3DSuiteView(suiteKey: string): string {
  const suite = THREE_D_SUITE_INFO.find(s => s.key === suiteKey);
  if (!suite) return "";
  
  const suiteIcon = suite.iconKey === "blender" ? renderBlenderIconSvg() : renderButtonIcon("cube");
  const downloadSection = render3DSuiteDownloadButton(suite);

  return `
            <section class="resource-manager-panel resource-hub-section hidden" data-3d-suite-section="${escapeHtml(suiteKey)}" id="3d-suites-${escapeHtml(suiteKey)}-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">${escapeHtml(suite.label)}</span>
                  <h4>${escapeHtml(suite.label)} Projects</h4>
                </div>
                <span class="resource-manager-status" id="${suiteKey}-project-status">Ready to browse ${escapeHtml(suite.label)} projects.</span>
              </div>
              <div class="game-engine-project-list" data-game-engine-project-list="${suiteKey}">
                <div class="tools-workspace-empty">No ${escapeHtml(suite.label)} projects are cached yet.</div>
              </div>
              <div class="resource-hub-download-section">
                <h5>Get ${escapeHtml(suite.label)}</h5>
${downloadSection}
              </div>
            </section>`;
}

function renderBlenderAddonsMain(entries: ResourceHubEntry[]): string {
  // Suite sections for non-Blender suites (simple views with download buttons)
  const otherSuiteSections = THREE_D_SUITE_INFO
    .filter(s => s.key !== "blender")
    .map(suite => render3DSuiteView(suite.key))
    .join("\n");

  return `
          <article class="panel-card resource-hub-main blender-addon-manager" data-blender-addon-manager="true">
            <!-- Global Projects/Addons tabs - visible for all 3D suites -->
            <div class="workspace-tabs blender-workspace-tabs global-suite-tabs" role="tablist" aria-label="3D Suites workspace">
              <button class="dashboard-tab active" data-suite-main-nav="projects" type="button" role="tab" aria-selected="true">${renderButtonIcon("folder")}<span>Projects</span></button>
              <button class="dashboard-tab" data-suite-main-nav="addons" type="button" role="tab" aria-selected="false">${renderButtonIcon("wand")}<span>Addons</span></button>
              <button class="dashboard-tab" data-suite-main-nav="scripts" type="button" role="tab" aria-selected="false">${renderButtonIcon("settings")}<span>Scripts</span></button>
            </div>

<!-- Global Projects Panel (shows home or selected suite projects) -->
<div class="resource-hub-content-wrap global-projects-panel" data-dashboard-layout-panel="3d-suites-projects">
${renderDashboardLayoutSwitcher("3d-suites-projects")}
              <!-- 3D Suite Home View -->
${render3DSuiteHome()}
            
<!-- Blender Suite View with project list -->
<section class="resource-manager-panel resource-hub-section hidden" data-3d-suite-section="blender" id="3d-suites-blender-panel">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">${escapeHtml("Blender")}</span>
                    <h4>${escapeHtml("Blender")} Projects</h4>
                  </div>
                  <span class="resource-manager-status" id="blender-project-status">Ready to browse ${escapeHtml("Blender")} projects.</span>
                </div>
                <div class="game-engine-project-list" data-game-engine-project-list="blender">
                  <div class="tools-workspace-empty">No ${escapeHtml("Blender")} projects are cached yet.</div>
                </div>
              </section>

<!-- Other 3D Suite Views (simple project + download) -->
${otherSuiteSections}
</div>

<!-- Global Addons Panel (always visible when Addons tab is selected) -->
<div class="resource-hub-content-wrap global-addons-panel hidden" data-dashboard-layout-panel="3d-suites-addons">
${renderDashboardLayoutSwitcher("3d-suites-addons")}
            <!-- The selected suite owns its executable choice; Blender reuses it for addon actions. -->
            <section class="resource-manager-toolbar" id="blender-toolbar">
              <label class="resource-manager-field">
                <span id="suite-executable-label">Blender executable</span>
                <select id="suite-executable-select" data-suite-executable-select></select>
              </label>
              <button class="secondary" id="blender-refresh-addons-button" type="button">${renderButtonIcon("refresh")}<span>Refresh installs</span></button>
              <span class="resource-manager-status" id="suite-executable-status">Choose the installation used by this suite.</span>
            </section>

            <section class="resource-manager-panel resource-hub-section hidden" id="non-blender-addon-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker" id="non-blender-addon-kicker">3D Suite</span>
                  <h4 id="non-blender-addon-title">Addon management is coming soon</h4>
                </div>
              </div>
              <p class="hint" id="non-blender-addon-copy">Choose the executable that belongs to this suite. Its selection is saved in this browser; suite-native addon discovery and installation will arrive with a dedicated adapter.</p>
            </section>

<!-- Blender Addons Sub-panels (inside addons tab) -->
<section class="resource-manager-panel resource-hub-section blender-tab-panel active" data-blender-section-panel="home" id="blender-home-panel">
              <div class="workspace-tabs blender-subtabs" role="tablist" aria-label="Blender addon sections">
                <button class="dashboard-tab active" data-blender-nav="online" type="button" role="tab" aria-selected="true">${renderButtonIcon("download")}<span>Online</span></button>
                <button class="dashboard-tab" data-blender-nav="recommended" type="button" role="tab" aria-selected="false">${renderButtonIcon("sparkle")}<span>Recommended</span></button>
                <button class="dashboard-tab" data-blender-nav="local-sources" type="button" role="tab" aria-selected="false">${renderButtonIcon("folder")}<span>Local Sources</span></button>
                <button class="dashboard-tab" data-blender-nav="local" type="button" role="tab" aria-selected="false">${renderButtonIcon("wand")}<span>Installed</span></button>
</div>
              <section class="resource-manager-panel resource-hub-section blender-sub-panel active" data-blender-addon-section="online" id="blender-online-panel">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Download</span>
                    <h4>Install From GitHub</h4>
                  </div>
                </div>
                <div class="resource-manager-inline-form">
                  <input id="blender-github-addon-url" type="url" placeholder="https://github.com/user/blender-addon">
                  <label class="compact-toggle"><input id="blender-github-addon-enable" type="checkbox" checked><span>Enable after install</span></label>
                  <button class="secondary" id="blender-install-github-addon-button" type="button">${renderButtonIcon("download")}<span>Download + Install</span></button>
                </div>
              </section>
              <section class="resource-manager-panel resource-hub-section blender-sub-panel" data-blender-addon-section="recommended" id="blender-recommended-panel">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Recommended</span>
                    <h4>Recommended Addons</h4>
                  </div>
                </div>
                <div class="resource-hub-grid resource-recommendation-grid">
${recommendedBlenderAddons.map(renderRecommendedBlenderAddonCard).join("\n")}
                </div>
              </section>
              <section class="resource-manager-panel resource-hub-section blender-sub-panel" data-blender-addon-section="local" id="blender-local-panel">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Installed</span>
                    <h4>Installed Addons</h4>
                  </div>
                  <span class="resource-manager-status" id="blender-addon-status">Select a Blender executable.</span>
                </div>
                <div class="resource-installed-list" id="blender-installed-addon-list"></div>
              </section>
              <section class="resource-manager-panel resource-hub-section blender-sub-panel" data-blender-addon-section="local-sources" id="blender-local-sources-panel">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Local Sources</span>
                    <h4>Your Addon Repositories</h4>
                  </div>
                </div>
                <div class="resource-hub-grid">
${entries.map(renderBlenderAddonCard).join("\n") || `                  <div class="tools-workspace-empty">No Blender addon repositories were found.</div>`}
                </div>
              </section>
            </section>
          </div>

<!-- Global Scripts Panel (curated script catalog for supported suites) -->
<div class="resource-hub-content-wrap global-scripts-panel hidden" data-dashboard-layout-panel="3d-suites-scripts">
${renderDashboardLayoutSwitcher("3d-suites-scripts")}
            <section class="resource-manager-panel resource-hub-section active">
              <div class="resource-manager-panel-head">
                <div><span class="panel-kicker">Cached GitHub Catalog</span><h4>Blender Scripts</h4></div>
                <button class="secondary" data-blender-script-refetch type="button">${renderButtonIcon("refresh")}<span>Refetch</span></button>
              </div>
              <div class="hint" data-blender-script-catalog-status>Loading Blender scripts from sysoutch/URage-Blender-Scripts...</div>
              <div class="resource-hub-grid" data-blender-script-catalog-list><div class="tools-workspace-empty">Loading cached Blender script catalog...</div></div>
            </section>
</div>
          </article>`;
}

function renderAssetsMain(): string {
  return `
          <article class="panel-card resource-hub-main asset-manager" data-asset-manager="true">
            <div class="workspace-tabs-new" role="tablist" aria-label="Game engine workspace">
              <button class="dashboard-tab active" data-game-engine-workspace-tab="projects" type="button" role="tab" aria-selected="true">${renderButtonIcon("folder")}<span>Projects</span></button>
              <button class="dashboard-tab" data-game-engine-workspace-tab="assets" type="button" role="tab" aria-selected="false">${renderButtonIcon("box")}<span>Assets</span></button>
            </div>
            <div class="resource-hub-content-wrap game-engine-workspace-panel" data-game-engine-workspace-panel="projects" data-dashboard-layout-panel="game-engines-projects">
${renderDashboardLayoutSwitcher("game-engines-projects")}
              <section class="game-engine-project-toolbar">
                <div class="field game-engine-scan-path-field">
                  <label for="game-engine-project-scan-root">Project scan folder</label>
                  <input id="game-engine-project-scan-root" value="C:\\Files\\git" placeholder="C:\\Projects">
                </div>
                <label class="toggle"><span>Include subfolders</span><input id="game-engine-project-scan-recursive" type="checkbox" checked></label>
                <button class="secondary" id="game-engine-project-browse-button" type="button">${renderButtonIcon("folder")}<span>Browse for Project</span></button>
                <button class="secondary" id="game-engine-project-scan-button" type="button">${renderButtonIcon("sparkle")}<span>Scan for Projects</span></button>
                <button class="secondary" id="game-engine-project-fetch-unity-hub-button" type="button">${renderButtonIcon("refresh")}<span>Fetch Unity Hub Projects</span></button>
              </section>
              <div class="game-engine-project-status" id="game-engine-project-status" role="status">Ready to launch a configured project.</div>
${renderGameEngineProjects()}
            </div>
            <div class="resource-hub-content-wrap game-engine-workspace-panel hidden" data-game-engine-workspace-panel="assets" data-dashboard-layout-panel="game-engines-assets">
${renderDashboardLayoutSwitcher("game-engines-assets")}
${renderAssetsHome()}
${renderAssetImportPanel("unity")}
${renderRemoteAssetCatalogPanel("unity")}
${renderAssetImportPanel("godot")}
${renderRemoteAssetCatalogPanel("godot")}
${renderAssetImportPanel("unreal")}
${renderRemoteAssetCatalogPanel("unreal")}
            </div>
          </article>`;
}

function getDashboardBlenderAddonEntries(): ResourceHubEntry[] {
  return [
    ...collectResourceEntries({
      root: externalBlenderAddonRoot,
      group: "blender",
      kind: "Blender Addon",
      description: "Install or inspect one of your local Blender addon repositories.",
      includeExtensions: [".py", ".zip"]
    }),
    ...collectResourceEntries({
      root: "blender-scripts",
      group: "blender",
      kind: "Blender Script",
      description: "Install or inspect a Blender automation script from this dashboard workspace.",
      includeExtensions: [".py", ".cmd", ".md"]
    }, 30)
  ];
}

export function renderDashboardBlenderAddonsView(): string {
  const entries = getDashboardBlenderAddonEntries();
  return `
      <section class="view resource-hub-view" data-view-panel="blender-addons">
        <div class="resource-hub-layout resource-hub-layout-shell">
${renderBlenderAddonsMain(entries)}
        </div>
      </section>`;
}

export function renderDashboardAssetsView(): string {
  return `
      <section class="view resource-hub-view" data-view-panel="assets">
        <div class="resource-hub-layout resource-hub-layout-shell">
${renderAssetsMain()}
        </div>
      </section>`;
}
