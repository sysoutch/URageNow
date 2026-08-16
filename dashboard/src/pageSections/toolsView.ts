import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import { getToolCatalogMetadata } from "../server/resourceHub/toolCatalogMetadataStore.js";
import {
  renderButtonIcon,
  renderBootstrapIcon,
  renderToolsIcon,
  renderToolsSearchIcon
} from "../shared/dashboardIcons.js";
import { renderDashboardLayoutSwitcher } from "../shared/dashboardLayoutSwitcher.js";

type ToolsCatalogEntry = {
  id: string;
  category: string;
  categoryLabel: string;
  categoryIcon: string;
  toolSlug: string;
  title: string;
  description: string;
  sourcePath: string;
  thumbnailPath: string | null;
  readmePath: string | null;
  tags: string[];
  tagColors: Record<string, string>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function toTitleCaseFromSlug(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function listDirectoryNames(baseDirectory: string): string[] {
  try {
    return readdirSync(baseDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !name.startsWith("."))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function resolveToolsRootDirectory(): string | null {
  return existsSync(toolsRoot) ? toolsRoot : null;
}

const toolDescriptionOverrides: Record<string, string> = {
  "audio/beat-maker": "Compose layered drum patterns and melodic loops with an offline step sequencer.",
  "plan/filer": "Analyze a local folder with sortable file, size, and line-count insights for planning and cleanup."
};

function readHtmlTitle(indexFilePath: string): string {
  try {
    const raw = readFileSync(indexFilePath, "utf8");
    const match = raw.match(/<title>([^<]+)<\/title>/i);
    return match && match[1] ? String(match[1]).trim() : "";
  } catch {
    return "";
  }
}

function readHtmlMetaDescription(indexFilePath: string): string {
  try {
    const raw = readFileSync(indexFilePath, "utf8");
    const match = raw.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)
      || raw.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["'][^>]*>/i);
    return match && match[1] ? String(match[1]).trim() : "";
  } catch {
    return "";
  }
}

function cleanReadmeDescriptionLine(line: string): string {
  const value = String(line || "").trim();
  if (!value) {
    return "";
  }
  if (value.startsWith("#")) {
    return "";
  }
  if (/^!\[[^\]]*\]\([^\)]+\)$/i.test(value)) {
    return "";
  }
  if (/^\[[^\]]*\]\([^\)]+\)$/i.test(value)) {
    return "";
  }
  if (/^`{3,}/.test(value) || /^-{3,}$/.test(value)) {
    return "";
  }
  return value.replace(/^[*-]\s*/, "").trim();
}

function readToolReadmeMetadata(readmePath: string): { title: string; description: string; } {
  if (!existsSync(readmePath)) {
    return { title: "", description: "" };
  }
  try {
    const lines = readFileSync(readmePath, "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    let title = "";
    let description = "";
    for (const line of lines) {
      if (!title && line.startsWith("#")) {
        title = line.replace(/^#+\s*/, "").trim();
        continue;
      }
      if (!description) {
        description = cleanReadmeDescriptionLine(line);
      }
      if (title && description) {
        break;
      }
    }
    return { title, description };
  } catch {
    return { title: "", description: "" };
  }
}

function resolveToolThumbnailPath(toolDirectory: string, category: string, toolSlug: string): string | null {
  const candidates = [
    "thumbnail.png",
    "thumbnail.jpg",
    "thumbnail.jpeg",
    "thumbnail.webp",
    "thumbnail.svg",
    "icon.png",
    "icon.svg"
  ];
  for (const candidate of candidates) {
    const absolutePath = path.join(toolDirectory, candidate);
    if (!existsSync(absolutePath)) {
      continue;
    }
    return `/tools/${encodeURIComponent(category)}/${encodeURIComponent(toolSlug)}/${encodeURIComponent(candidate)}`;
  }
  return null;
}

function resolveToolReadmePath(toolDirectory: string, category: string, toolSlug: string): string | null {
  const readmePath = path.join(toolDirectory, "README.md");
  return existsSync(readmePath)
    ? `/tools/${encodeURIComponent(category)}/${encodeURIComponent(toolSlug)}/README.md`
    : null;
}

function buildFallbackToolDescription(title: string, categoryLabel: string, toolSlug: string): string {
  const readableSlug = toTitleCaseFromSlug(toolSlug).toLowerCase();
  const readableCategory = String(categoryLabel || "Tool").trim();
  return `${title} for ${readableCategory.toLowerCase()} workflows (${readableSlug}).`;
}

function loadToolsCatalog(): ToolsCatalogEntry[] {
  const toolsRootDirectory = resolveToolsRootDirectory();
  if (!toolsRootDirectory) {
    return [];
  }
  const catalogEntries: ToolsCatalogEntry[] = [];
  const metadata = getToolCatalogMetadata();
  const categoryLabels = new Map(metadata.categories.map(category => [category.id, category.label]));
  const categoryIcons = new Map(metadata.categories.map(category => [category.id, category.icon]));
  for (const category of listDirectoryNames(toolsRootDirectory)) {
    const categoryDirectory = path.join(toolsRootDirectory, category);
    const categoryLabel = categoryLabels.get(category) || toTitleCaseFromSlug(category);
    for (const toolSlug of listDirectoryNames(categoryDirectory)) {
      const toolDirectory = path.join(categoryDirectory, toolSlug);
      const indexFilePath = path.join(toolDirectory, "index.html");
      if (!existsSync(indexFilePath)) {
        continue;
      }
      const readmeMetadata = readToolReadmeMetadata(path.join(toolDirectory, "README.md"));
      const htmlTitle = readHtmlTitle(indexFilePath);
      const htmlDescription = readHtmlMetaDescription(indexFilePath);
      const fallbackTitle = toTitleCaseFromSlug(toolSlug);
      const title = readmeMetadata.title || htmlTitle || fallbackTitle;
      const overrideKey = `${category}/${toolSlug}`;
      const description = toolDescriptionOverrides[overrideKey]
        || readmeMetadata.description
        || htmlDescription
        || buildFallbackToolDescription(title, categoryLabel, toolSlug);
      catalogEntries.push({
        id: `${category}__${toolSlug}`,
        category,
        categoryLabel,
        categoryIcon: categoryIcons.get(category) || "tools",
        toolSlug,
        title,
        description,
        sourcePath: `/tools/${encodeURIComponent(category)}/${encodeURIComponent(toolSlug)}/index.html`,
        thumbnailPath: resolveToolThumbnailPath(toolDirectory, category, toolSlug),
        readmePath: resolveToolReadmePath(toolDirectory, category, toolSlug),
        tags: metadata.toolTags[`${category}__${toolSlug}`] || [],
        tagColors: metadata.tagColors
      });
    }
  }
  return catalogEntries.sort((a, b) => {
    const categoryCompare = a.categoryLabel.localeCompare(b.categoryLabel);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }
    return a.title.localeCompare(b.title);
  });
}

export function getDashboardToolsCatalog(): ToolsCatalogEntry[] {
  return loadToolsCatalog();
}

function renderToolsCatalogButton(entry: ToolsCatalogEntry, active: boolean): string {
  const thumbnailMarkup = entry.thumbnailPath
    ? `<img src="${escapeHtml(entry.thumbnailPath)}" alt="" loading="lazy">`
    : renderToolsIcon();
  return `
                <button class="tools-catalog-button${active ? " active" : ""}" data-tools-tool="${escapeHtml(entry.id)}" data-tools-title="${escapeHtml(entry.title)}" data-tools-description="${escapeHtml(entry.description)}" data-tools-tags="${escapeHtml(entry.tags.join(","))}" data-tools-category="${escapeHtml(entry.categoryLabel)}" data-tools-category-id="${escapeHtml(entry.category)}" data-tools-src="${escapeHtml(entry.sourcePath)}" data-tools-readme="${escapeHtml(entry.readmePath || "")}" type="button">
                  <span class="tools-catalog-button-icon">${thumbnailMarkup}</span>
                  <span class="tools-catalog-button-copy"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.description)}</span>${entry.tags.length ? `<small class="tools-catalog-tags">${entry.tags.map(tag => `<span style="--tool-tag-color:${escapeHtml(entry.tagColors[tag] || "#b76cff")}">#${escapeHtml(tag)}</span>`).join(" ")}</small>` : ""}</span>
                </button>`;
}

function renderToolsCategoryButton(categoryId: string, categoryLabel: string, count: number): string {
  return `
                <button class="tools-nav-button" data-tools-filter="${escapeHtml(categoryId)}" type="button">
                  <span>${escapeHtml(categoryLabel)}</span>
                  <small>${count}</small>
                </button>`;
}

function renderToolsRailCategoryButton(categoryId: string, categoryLabel: string, categoryIcon: string, count: number): string {
  return `
          <button class="nav-link rail-nav-button rail-tools-category-button" data-tools-filter="${escapeHtml(categoryId)}" type="button" title="${escapeHtml(categoryLabel)} tools" aria-label="${escapeHtml(categoryLabel)} tools">
            <span class="rail-tools-category-icon" aria-hidden="true">${renderBootstrapIcon(categoryIcon)}</span>
            <span class="rail-tools-category-label">${escapeHtml(categoryLabel)}</span>
            <span class="rail-tools-category-count">${count}</span>
          </button>`;
}

function renderToolsFilterChip(filterId: string, label: string, active = false): string {
  return `<button class="tools-filter-chip${active ? " active" : ""}" data-tools-filter="${escapeHtml(filterId)}" type="button">${escapeHtml(label)}</button>`;
}

function renderToolsTagFilterChip(tag: string, color: string): string {
  return `<button class="tools-filter-chip tools-tag-filter-chip" data-tools-tag-filter="${escapeHtml(tag)}" style="--tool-tag-color:${escapeHtml(color)}" type="button">#${escapeHtml(tag)}</button>`;
}

type SuggestedTool = {
  title: string;
  description: string;
  url: string;
};

function renderSuggestedToolCards(suggestions: SuggestedTool[], iconName: string): string {
  return suggestions.map(suggestion => `
                    <article class="desktop-tool-card desktop-tool-suggestion-card">
                      <div class="desktop-tool-card-icon" aria-hidden="true">${renderBootstrapIcon(iconName)}</div>
                      <div class="desktop-tool-card-copy">
                        <span class="resource-flair">Recommended</span>
                        <h4>${escapeHtml(suggestion.title)}</h4>
                        <p>${escapeHtml(suggestion.description)}</p>
                      </div>
                      <a class="secondary desktop-tool-card-action" href="${escapeHtml(suggestion.url)}" target="_blank" rel="noopener">GitHub</a>
                    </article>`).join("\n");
}

function renderDesktopSuggestionCards(): string {
  return renderSuggestedToolCards([
    {
      title: "VoiceInputter",
      description: "Desktop speech input helper for faster local text capture.",
      url: "https://github.com/sysoutch/VoiceInputter"
    },
    {
      title: "ScreenGify",
      description: "Screen recording and GIF capture utility for quick visual notes.",
      url: "https://github.com/sysoutch/ScreenGify"
    },
    {
      title: "MatrixClient",
      description: "Local Matrix client workspace for companion communication flows.",
      url: "https://github.com/sysoutch/MatrixClient"
    }
  ], "window");
}

function renderMobileSuggestionCards(): string {
  const repositoryUrl = "https://github.com/sysoutch/urage-now-android-companion";
  return `
                    <article class="desktop-tool-card desktop-tool-suggestion-card mobile-tool-suggestion-card">
                      <div class="desktop-tool-card-icon" aria-hidden="true">${renderBootstrapIcon("phone")}</div>
                      <div class="desktop-tool-card-copy">
                        <span class="resource-flair">Android</span>
                        <h4>URage Now Android Companion</h4>
                        <p>Pair an Android device with URage Now Studio to browse, preview, upload, and transfer generated media.</p>
                      </div>
                      <div class="desktop-tool-card-actions">
                        <a class="secondary desktop-tool-card-action" href="${repositoryUrl}/releases/latest" target="_blank" rel="noopener">${renderButtonIcon("download")}<span>Download</span></a>
                        <a class="ghost desktop-tool-card-action" href="${repositoryUrl}" target="_blank" rel="noopener">${renderBootstrapIcon("github")}<span>GitHub</span></a>
                      </div>
                    </article>`;
}

export function renderDashboardToolsRailCategories(catalogEntries: ToolsCatalogEntry[] = loadToolsCatalog()): string {
  const hiddenCategories = new Set(getToolCatalogMetadata().categories.filter(category => category.hidden).map(category => category.id));
  const groups = new Map<string, ToolsCatalogEntry[]>();
  catalogEntries.forEach(entry => {
    const key = entry.categoryLabel;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(entry);
  });
  const buttons = Array.from(groups.entries())
    .filter(([, entries]) => !hiddenCategories.has(entries[0]?.category || ""))
    .map(([groupLabel, entries]) => renderToolsRailCategoryButton(entries[0]?.category || groupLabel.toLowerCase(), groupLabel, entries[0]?.categoryIcon || "tools", entries.length))
    .join("\n");
  return `
        <div class="rail-tools-categories" data-tools-category-rail="true" aria-label="Tool categories">
${buttons || '          <div class="rail-tools-category-empty">No tools</div>'}
        </div>`;
}

export function renderDashboardToolsView(catalogEntries: ToolsCatalogEntry[] = loadToolsCatalog()): string {
  const catalogMetadata = getToolCatalogMetadata();
  const visibleCategories = catalogMetadata.categories.filter(category => !category.hidden);
  const hiddenCategoryIds = new Set(catalogMetadata.categories.filter(category => category.hidden).map(category => category.id));
  const groups = new Map<string, ToolsCatalogEntry[]>();
  catalogEntries.forEach(entry => {
    const key = entry.categoryLabel;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(entry);
  });
  const groupedCatalogMarkup = Array.from(groups.entries()).map(([groupLabel, entries]) => `
              <section class="tools-catalog-group">
                <div class="section-label">${escapeHtml(groupLabel)}</div>
                <div class="tools-catalog-list" role="group" aria-label="${escapeHtml(groupLabel)} tools">
${entries.map(entry => renderToolsCatalogButton(entry, false)).join("\n")}
                </div>
              </section>`).join("\n");
  const categoryNavMarkup = Array.from(groups.entries())
    .filter(([, entries]) => !hiddenCategoryIds.has(entries[0]?.category || ""))
    .map(([groupLabel, entries]) => renderToolsCategoryButton(entries[0]?.category || groupLabel.toLowerCase(), groupLabel, entries.length))
    .join("\n");
  const filterChipsMarkup = [
    renderToolsFilterChip("all", "All", true),
    renderToolsFilterChip("favorites", "Favorites"),
    renderToolsFilterChip("recent", "Recent"),
    ...Array.from(groups.entries()).filter(([, entries]) => !hiddenCategoryIds.has(entries[0]?.category || "")).slice(0, 5).map(([groupLabel, entries]) => renderToolsFilterChip(entries[0]?.category || groupLabel.toLowerCase(), groupLabel)),
    ...catalogMetadata.tags.map(tag => renderToolsTagFilterChip(tag, catalogMetadata.tagColors[tag] || "#b76cff"))
  ].join("\n");
  const allToolsButtons = catalogEntries.map(entry => renderToolsCatalogButton(entry, false)).join("\n");

  return `
      <section class="view tools-view" data-view-panel="tools">
        <article class="panel-card tools-workspace-card">
            <div class="tools-workspace-head">
              <div class="panel-heading">
                <div class="panel-kicker" id="tools-active-category">Tools Dashboard</div>
                <h3 id="tools-active-title">Toolbox Dashboard</h3>
                <div class="panel-subtitle" id="tools-active-description">Search, pin, and open local tools in the workspace.</div>
              </div>
              <div class="tools-workspace-actions" aria-label="Tool catalogue actions">
                <button class="secondary tools-workspace-action" id="tools-add-tool-button" type="button" title="Add Tool" aria-label="Add Tool">${renderButtonIcon("plus")}<span class="tools-workspace-action-label">Add Tool</span></button>
                <button class="secondary tools-workspace-action" id="tools-edit-tool-button" type="button" title="Edit Tool" aria-label="Edit Tool">${renderButtonIcon("settings")}<span class="tools-workspace-action-label">Edit Tool</span></button>
                <button class="secondary tools-workspace-action" id="tools-manage-metadata-button" type="button" title="Categories and Tags" aria-label="Categories and Tags">${renderButtonIcon("tags")}<span class="tools-workspace-action-label">Categories & Tags</span></button>
              </div>
              <a class="secondary tools-workspace-open-link hidden" id="tools-workspace-open-link" href="#" target="_blank" rel="noopener">Open In New Tab</a>
              <div class="workspace-tabs-new" role="tablist" aria-label="Tool mode">
                <button class="dashboard-tab active" data-tools-mode-tab="browser" type="button" role="tab" aria-selected="true">Browser</button>
                <button class="dashboard-tab" data-tools-mode-tab="desktop" type="button" role="tab" aria-selected="false">Desktop</button>
                <button class="dashboard-tab" data-tools-mode-tab="mobile" type="button" role="tab" aria-selected="false">Mobile</button>
              </div>
            </div>
            <div class="tools-dashboard-toolbar" role="search">
              <label class="tools-search-field" for="tools-search-input">
                <span class="tools-search-icon" aria-hidden="true">${renderToolsSearchIcon()}</span>
                <input id="tools-search-input" type="search" placeholder="Search tools by name, category, description, or tag" autocomplete="off" aria-controls="tools-main-catalog">
              </label>
              <div class="row tools-filter-chip-row" aria-label="Tool filters">
${filterChipsMarkup}
              </div>
            </div>
            <section class="resource-manager-panel tool-import-panel">
              <div class="resource-manager-panel-head">
                <div>
                  <span class="panel-kicker">GitHub</span>
                  <h4>Import Tool Repository</h4>
                </div>
              </div>
              <div class="tool-import-form">
                <div class="field">
                  <label for="tool-github-repo-input">GitHub Repository</label>
                  <input id="tool-github-repo-input" data-tool-github-repo-input placeholder="owner/repo or https://github.com/owner/repo">
                </div>
                <div class="field">
                  <label for="tool-github-type-select">Tool Type</label>
                  <select id="tool-github-type-select" data-tool-github-type-select>
                    <option value="">Auto Detect</option>
                    <option value="web">Web Tool</option>
                    <option value="desktop">Desktop Tool</option>
                  </select>
                </div>
                <div class="tool-import-actions">
                  <button id="tool-github-import-button" data-tool-github-import-button type="button">${renderButtonIcon("download")}<span>Clone Repo</span></button>
                  <button class="secondary" id="tool-github-release-button" data-tool-github-release-button type="button">${renderButtonIcon("download")}<span>Download Release</span></button>
                </div>
              </div>
              <div class="tool-release-select-row hidden" data-tool-release-select-row>
                <div class="field">
                  <label for="tool-github-release-asset-select">Latest Release Asset</label>
                  <select id="tool-github-release-asset-select" data-tool-github-release-asset-select></select>
                </div>
                <button class="secondary" id="tool-github-release-download-selected-button" data-tool-github-release-download-selected-button type="button">${renderButtonIcon("download")}<span>Download Selected Asset</span></button>
              </div>
              <div class="hint" data-tool-github-import-status>Clone a GitHub repo into the dashboard workspace. If detection is not clear, the dashboard will ask you to choose Web or Desktop.</div>
            </section>
            <!-- Main content area: tools catalog grid -->
            <div class="tools-main-catalog" id="tools-main-catalog" data-dashboard-layout-panel="tools-browser">
${renderDashboardLayoutSwitcher("tools-browser")}
${catalogEntries.length > 0 ? Array.from(groups.entries()).map(([groupLabel, entries]) => `                <section class="tools-catalog-group">
                  <div class="section-label">${escapeHtml(groupLabel)}</div>
                  <div class="tools-catalog-list" role="group" aria-label="${escapeHtml(groupLabel)} tools">
                    <div class="tools-catalog-table-header" aria-hidden="true"><span></span><span>Tool</span><span>Description</span><span>Open</span></div>
${entries.map(entry => renderToolsCatalogButton(entry, false)).join("\n")}
                  </div>
                </section>`).join("\n") : '              <div class="tools-catalog-hint">No local tools found.</div>'}
            </div>
            <!-- Hidden workspace frame (shown when a tool is selected) -->
            <div class="tools-workspace-frame-wrap hidden" data-tools-mode-panel="browser">
              <div class="tools-workspace-home hidden" id="tools-workspace-home">
                <div class="tools-workspace-home-grid hidden" id="tools-workspace-home-grid"></div>
              </div>
              <iframe class="tools-workspace-frame hidden" id="tools-workspace-frame" title="Tools workspace frame" loading="lazy" src="about:blank"></iframe>
              <div class="tools-workspace-empty hidden" id="tools-workspace-empty">No tool selected.</div>
            </div>
            <div class="tools-desktop-panel hidden" data-tools-mode-panel="desktop" data-dashboard-layout-panel="tools-desktop">
${renderDashboardLayoutSwitcher("tools-desktop")}
              <section class="desktop-tool-dropzone" data-desktop-tool-dropzone>
                <div class="desktop-tool-dropzone-icon" aria-hidden="true">${renderButtonIcon("download")}</div>
                <div class="desktop-tool-dropzone-copy">
                  <h4>Pin Desktop Tool</h4>
                  <p>Drop a desktop launcher here, browse for it, or paste an absolute path.</p>
                  <small>.exe, .bat, .cmd, .sh, .ps1, .lnk, .app, .command, .py</small>
                </div>
                <input class="hidden" id="desktop-tool-file-input" data-desktop-tool-file-input type="file" accept=".exe,.bat,.cmd,.sh,.ps1,.lnk,.app,.command,.py">
                <button class="secondary" data-desktop-tool-browse type="button">${renderButtonIcon("folder")}<span>Browse</span></button>
              </section>
              <section class="desktop-tool-path-row">
                <input id="desktop-tool-path-input" data-desktop-tool-path-input placeholder="C:\\Tools\\MyTool\\tool.exe or C:\\Tools\\MyTool\\tool.py">
                <button class="secondary" data-desktop-tool-add-path type="button">${renderButtonIcon("download")}<span>Pin Tool</span></button>
              </section>
              <div class="desktop-tool-status" data-desktop-tool-status>Desktop tools are stored locally in this browser.</div>
              <section class="desktop-tool-section">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Imported</span>
                    <h4>Imported GitHub Repositories</h4>
                  </div>
                </div>
                <div class="desktop-tool-card-grid" data-imported-tool-list></div>
              </section>
              <section class="desktop-tool-section">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Pinned</span>
                    <h4>Your Desktop Tools</h4>
                  </div>
                </div>
                <div class="desktop-tool-card-grid" data-desktop-tool-pinned-list></div>
              </section>
              <section class="desktop-tool-section">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Suggested</span>
                    <h4>Recommended Desktop Tools</h4>
                  </div>
                </div>
                <div class="desktop-tool-card-grid">
${renderDesktopSuggestionCards()}
                </div>
              </section>
            </div>
            <div class="tools-mobile-panel hidden" data-tools-mode-panel="mobile">
              <section class="desktop-tool-section" aria-labelledby="tools-mobile-recommended-title">
                <div class="resource-manager-panel-head">
                  <div>
                    <span class="panel-kicker">Suggested</span>
                    <h4 id="tools-mobile-recommended-title">Recommended Mobile Tools</h4>
                  </div>
                </div>
                <div class="desktop-tool-card-grid">
${renderMobileSuggestionCards()}
                </div>
              </section>
            </div>
            <footer class="tools-workspace-footer hidden" id="tools-workspace-footer" aria-label="Tool workspace controls">
              <div class="tools-workspace-footer-label">
                <span id="tools-workspace-footer-title">Tool Controls</span>
                <small id="tools-workspace-footer-status">Use dashboard bridges with the active tool.</small>
              </div>
              <div class="tools-workspace-footer-actions">
                <button class="secondary tools-workspace-footer-button" id="tools-workspace-export-toggle" type="button">Send Resource</button>
                <button class="secondary tools-workspace-footer-button" id="tools-workspace-pools-toggle" type="button" aria-pressed="true">Image Pools</button>
                <button class="secondary tools-workspace-footer-button" id="tools-workspace-recent-toggle" type="button" aria-pressed="true">Recent Media</button>
                <button class="secondary tools-workspace-footer-button" id="tools-workspace-show-readme-button" type="button">Show README.md</button>
              </div>
            </footer>
          </article>
        <div class="runtime-overlay hidden tool-scaffold-overlay" id="tool-scaffold-overlay" aria-hidden="true">
          <button class="runtime-overlay-backdrop" id="tool-scaffold-overlay-backdrop" aria-label="Close Add Tool"></button>
          <div class="runtime-overlay-panel tool-scaffold-panel" role="dialog" aria-modal="true" aria-labelledby="tool-scaffold-title">
            <div class="runtime-overlay-header">
              <div><span class="panel-kicker">Dashboard-integrated template</span><h3 id="tool-scaffold-title">Add Tool</h3></div>
              <button class="ghost compact" id="tool-scaffold-close-button" type="button" aria-label="Close Add Tool">${renderButtonIcon("close")}</button>
            </div>
            <div class="tool-scaffold-mode-tabs" role="tablist" aria-label="Tool creation mode">
              <button class="dashboard-tab active" data-tool-scaffold-mode="manual" type="button" role="tab" aria-selected="true">Manual</button>
              <button class="dashboard-tab" data-tool-scaffold-mode="llm" type="button" role="tab" aria-selected="false">With LazyDev</button>
            </div>
            <div class="tool-scaffold-body">
              <section class="tool-scaffold-llm-panel hidden" data-tool-scaffold-mode-panel="llm">
                <div class="field"><label for="tool-scaffold-request">Describe the tool</label><textarea id="tool-scaffold-request" placeholder="A sprite-sheet inspector that imports PNG files and exports selected frames..."></textarea></div>
                <button id="tool-scaffold-plan-button" type="button">${renderButtonIcon("sparkle")}<span>Generate Integrated Plan</span></button>
                <p class="hint">LazyDev plans the tool, then implements its HTML, CSS, and JavaScript. The server preserves and audits every dashboard integration contract.</p>
              </section>
              <section class="tool-scaffold-fields">
                <div class="field"><label for="tool-scaffold-title-input">Name</label><input id="tool-scaffold-title-input" value="New Dashboard Tool"></div>
                <div class="field"><label for="tool-scaffold-category">Category</label><select id="tool-scaffold-category">${visibleCategories.map(category => `<option value="${escapeHtml(category.id)}"${category.id === "dev" ? " selected" : ""}>${escapeHtml(category.label)}</option>`).join("")}</select></div>
                <div class="field"><label for="tool-scaffold-slug">Folder slug</label><input id="tool-scaffold-slug" value="new-dashboard-tool" placeholder="kebab-case"></div>
                <div class="field tool-scaffold-wide"><label for="tool-scaffold-description">Catalog description</label><input id="tool-scaffold-description" value="A focused dashboard-integrated utility."></div>
                <div class="field tool-scaffold-wide"><label for="tool-scaffold-purpose">Purpose and starting behavior</label><textarea id="tool-scaffold-purpose">Help the user complete one focused workflow.</textarea></div>
                <div class="field"><label for="tool-scaffold-output-kind">Primary output</label><select id="tool-scaffold-output-kind"><option value="text">Text</option><option value="image">Image / Canvas</option><option value="json">JSON</option></select></div>
                <div class="tool-scaffold-options">
                  <label class="compact-toggle"><input id="tool-scaffold-accepts-files" type="checkbox"><span>Accept dashboard/files</span></label>
                  <label class="compact-toggle"><input id="tool-scaffold-sidebar" type="checkbox" checked><span>Include tool sidebar</span></label>
                  <label class="compact-toggle"><input id="tool-scaffold-persist-state" type="checkbox"><span>Persist local input</span></label>
                </div>
              </section>
              <section class="tool-scaffold-audit">
                <h4>Integration checklist</h4>
                <div id="tool-scaffold-audit-list" class="tool-scaffold-audit-list"></div>
              </section>
              <section class="tool-editor-diff hidden" id="tool-scaffold-implementation-preview">
                <div class="tool-editor-diff-heading">
                  <div><h4>Implementation preview</h4><small id="tool-scaffold-implementation-summary"></small></div>
                  <label class="field compact-field" for="tool-scaffold-implementation-file"><span>File</span><select id="tool-scaffold-implementation-file"></select></label>
                </div>
                <div class="tool-scaffold-code-preview-grid">
                  <div><strong>Diff from audited baseline</strong><pre id="tool-scaffold-implementation-diff"></pre></div>
                  <div><strong>Complete generated file</strong><pre id="tool-scaffold-implementation-code"></pre></div>
                </div>
              </section>
              <p class="hint" id="tool-scaffold-status" aria-live="polite">Complete the fields, then create the tool from the shared template.</p>
            </div>
            <div class="runtime-overlay-actions">
              <button class="secondary" id="tool-scaffold-cancel-button" type="button">Cancel</button>
              <button id="tool-scaffold-create-button" type="button">${renderButtonIcon("plus")}<span>Create Tool</span></button>
            </div>
          </div>
        </div>
        <div class="runtime-overlay hidden tool-scaffold-overlay" id="tool-catalog-metadata-overlay" aria-hidden="true">
          <button class="runtime-overlay-backdrop" id="tool-catalog-metadata-backdrop" aria-label="Close Categories and Tags"></button>
          <div class="runtime-overlay-panel tool-scaffold-panel" role="dialog" aria-modal="true" aria-labelledby="tool-catalog-metadata-title">
            <div class="runtime-overlay-header">
              <div><span class="panel-kicker">Custom tool organization</span><h3 id="tool-catalog-metadata-title">Categories & Tags</h3></div>
              <button class="ghost compact" id="tool-catalog-metadata-close" type="button" aria-label="Close Categories and Tags">${renderButtonIcon("close")}</button>
            </div>
            <div class="tool-scaffold-body">
              <section class="tool-scaffold-fields">
                <div class="field tool-scaffold-wide"><label for="tool-category-existing">Existing category</label><select id="tool-category-existing"><option value="">New category</option>${catalogMetadata.categories.map(category => `<option value="${escapeHtml(category.id)}" data-label="${escapeHtml(category.label)}" data-icon="${escapeHtml(category.icon)}" data-description="${escapeHtml(category.description)}" data-hidden="${category.hidden}" data-preset="${category.preset}" data-count="${category.assignedToolCount}">${escapeHtml(category.label)} (${category.assignedToolCount})${category.hidden ? " — hidden" : ""}</option>`).join("")}</select></div>
                <div class="field"><label for="tool-category-id">Category id</label><input id="tool-category-id" placeholder="my-category"></div>
                <div class="field"><label for="tool-category-label">Category label</label><input id="tool-category-label" placeholder="My Category"></div>
                <div class="field"><label for="tool-category-icon">Bootstrap icon name</label><input id="tool-category-icon" value="grid" placeholder="controller"></div>
                <div class="field tool-scaffold-wide"><label for="tool-category-description">Description</label><input id="tool-category-description" placeholder="What belongs in this category?"></div>
                <button id="tool-category-save" type="button">${renderButtonIcon("save")}<span>Save Category</span></button>
                <button class="secondary" id="tool-category-visibility" type="button">Hide Category</button>
                <button class="secondary" id="tool-category-delete" type="button">Delete Category</button>
              </section>
              <section class="tool-scaffold-fields">
                <div class="field"><label for="tool-category-move-tool">Move tool</label><select id="tool-category-move-tool">${catalogEntries.map(entry => `<option value="${escapeHtml(entry.category + "/" + entry.toolSlug)}">${escapeHtml(entry.title)} — ${escapeHtml(entry.categoryLabel)}</option>`).join("")}</select></div>
                <div class="field"><label for="tool-category-move-target">Destination category</label><select id="tool-category-move-target">${visibleCategories.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</option>`).join("")}</select></div>
                <button id="tool-category-move" type="button">Move Transactionally</button>
              </section>
              <section class="tool-scaffold-fields">
                <div class="field"><label for="tool-tags-tool">Tools</label><select id="tool-tags-tool" multiple size="6">${catalogEntries.map(entry => `<option value="${escapeHtml(entry.id)}" data-tags="${escapeHtml(entry.tags.join(","))}">${escapeHtml(entry.title)}</option>`).join("")}</select></div>
                <div class="field"><label for="tool-tags-mode">Bulk operation</label><select id="tool-tags-mode"><option value="set">Replace tags</option><option value="add">Add tags</option><option value="remove">Remove tags</option></select></div>
                <div class="field"><label for="tool-tags-values">Tags (comma separated)</label><input id="tool-tags-values" list="tool-tag-suggestions" placeholder="pixel-art, offline, export"><datalist id="tool-tag-suggestions">${catalogMetadata.tags.map(tag => `<option value="${escapeHtml(tag)}" data-tag="${escapeHtml(tag)}"></option>`).join("")}</datalist></div>
                <button id="tool-tags-save" type="button">${renderButtonIcon("save")}<span>Apply Tags To Selected</span></button>
              </section>
              <section class="tool-scaffold-fields">
                <div class="field"><label for="tool-tag-from">Existing tag</label><select id="tool-tag-from"><option value="">Choose tag</option>${catalogMetadata.tags.map(tag => `<option value="${escapeHtml(tag)}" data-color="${escapeHtml(catalogMetadata.tagColors[tag] || "#b76cff")}">${escapeHtml(tag)}</option>`).join("")}</select></div>
                <div class="field"><label for="tool-tag-to">Rename to</label><input id="tool-tag-to" placeholder="new-tag"></div>
                <button id="tool-tag-rename" type="button">Rename Everywhere</button>
                <button class="secondary" id="tool-tag-remove" type="button">Remove Everywhere</button>
                <div class="field"><label for="tool-tag-color">Tag color</label><input id="tool-tag-color" type="color" value="#b76cff"></div>
                <button class="secondary" id="tool-tag-color-save" type="button">Save Color</button>
              </section>
              <p class="hint" id="tool-catalog-metadata-status" aria-live="polite">Preset categories come from tools/categories/*.json. Custom changes and tags are stored in dashboard data.</p>
            </div>
          </div>
        </div>
        <div class="runtime-overlay hidden tool-scaffold-overlay" id="tool-editor-overlay" aria-hidden="true">
          <button class="runtime-overlay-backdrop" id="tool-editor-overlay-backdrop" aria-label="Close Edit Tool"></button>
          <div class="runtime-overlay-panel tool-scaffold-panel" role="dialog" aria-modal="true" aria-labelledby="tool-editor-title">
            <div class="runtime-overlay-header">
              <div><span class="panel-kicker">Audited existing-tool changes</span><h3 id="tool-editor-title">Edit Tool</h3></div>
              <button class="ghost compact" id="tool-editor-close-button" type="button" aria-label="Close Edit Tool">${renderButtonIcon("close")}</button>
            </div>
            <div class="tool-scaffold-mode-tabs" role="tablist" aria-label="Tool editing mode">
              <button class="dashboard-tab active" data-tool-editor-mode="manual" type="button" role="tab" aria-selected="true">Manual</button>
              <button class="dashboard-tab" data-tool-editor-mode="llm" type="button" role="tab" aria-selected="false">With LazyDev</button>
            </div>
            <div class="tool-scaffold-body">
              <section class="tool-scaffold-fields">
                <div class="field"><label for="tool-editor-tool">Existing tool</label><select id="tool-editor-tool"></select></div>
                <div class="field"><label for="tool-editor-file">File / proposed change</label><select id="tool-editor-file"></select></div>
                <div class="field tool-scaffold-wide hidden" id="tool-editor-llm-fields">
                  <label for="tool-editor-request">Describe the change</label>
                  <textarea id="tool-editor-request" placeholder="Add keyboard controls, improve mobile layout, and preserve all dashboard bridge contracts..."></textarea>
                  <button id="tool-editor-plan-button" type="button">${renderButtonIcon("sparkle")}<span>Plan Changes With LazyDev</span></button>
                </div>
                <div class="field tool-scaffold-wide"><label for="tool-editor-content">File content</label><textarea id="tool-editor-content" class="tool-editor-code" spellcheck="false"></textarea></div>
              </section>
              <section class="tool-editor-diff hidden" id="tool-editor-diff-section">
                <div class="tool-editor-diff-heading"><h4>Staged diff</h4><span class="chip" id="tool-editor-diff-summary"></span></div>
                <pre id="tool-editor-diff" aria-label="Staged tool edit diff"></pre>
              </section>
              <section class="tool-scaffold-audit">
                <h4>Integration checklist after changes</h4>
                <div id="tool-editor-audit-list" class="tool-scaffold-audit-list"></div>
              </section>
              <p class="hint" id="tool-editor-status" aria-live="polite">Choose an existing tool. Every apply creates a backup in dashboard data.</p>
            </div>
            <div class="runtime-overlay-actions">
              <button class="secondary" id="tool-editor-cancel-button" type="button">Cancel</button>
              <button class="secondary hidden" id="tool-editor-rollback-button" type="button">${renderButtonIcon("undo")}<span>Roll Back Last Apply</span></button>
              <button id="tool-editor-apply-button" type="button">${renderButtonIcon("save")}<span>Review Staged Diff</span></button>
            </div>
          </div>
        </div>
        <div class="runtime-overlay hidden tools-workspace-export-overlay" id="tools-workspace-export-overlay" aria-hidden="true">
          <button class="runtime-overlay-backdrop" id="tools-workspace-export-overlay-backdrop" aria-label="Close tools export"></button>
          <div class="runtime-overlay-panel tools-workspace-export-panel">
            <div class="runtime-overlay-header">
              <div class="runtime-overlay-title-wrap">
                <div class="panel-kicker">Tool Workspace Export</div>
                <h3>Send Resource</h3>
              </div>
              <button class="ghost compact" id="tools-workspace-export-close-button" aria-label="Close tools export">&#10005;</button>
            </div>
            <div class="tools-workspace-export-body">
              <article class="status-card settings-overlay-card tools-workspace-export-source-card">
                <h4>Current Resource</h4>
                <strong id="tools-workspace-export-source-name">No active tool resource</strong>
                <div class="hint" id="tools-workspace-export-source-detail">Open a supported tool first.</div>
                <div class="field hidden" id="tools-workspace-export-resource-field">
                  <label for="tools-workspace-export-resource-select">Output</label>
                  <select id="tools-workspace-export-resource-select"></select>
                  <div class="hint" id="tools-workspace-export-resource-hint">Choose which processed result to send.</div>
                </div>
                <div class="tools-workspace-export-preview-card">
                  <div class="tools-workspace-export-preview-stage" id="tools-workspace-export-preview-stage" aria-live="polite"></div>
                  <div class="tools-workspace-export-preview-copy">
                    <strong id="tools-workspace-export-preview-label">No preview available</strong>
                    <small id="tools-workspace-export-preview-meta"></small>
                  </div>
                </div>
              </article>
              <article class="status-card settings-overlay-card tools-workspace-export-settings-card">
                <div class="dashboard-tabs" role="tablist" aria-label="Tools export destinations">
                  <button class="ghost active" data-tools-export-tab="tool" type="button" role="tab" aria-selected="true">Tool</button>
                  <button class="ghost" data-tools-export-tab="lazydev" type="button" role="tab" aria-selected="false">LazyDev</button>
                  <button class="ghost" data-tools-export-tab="game-engine" type="button" role="tab" aria-selected="false">Game Engine</button>
                </div>
                <section class="tools-workspace-export-tab-panel active" id="tools-workspace-export-tool-panel" data-tools-export-panel="tool" role="tabpanel">
                  <h4>Send To Tool</h4>
                  <div class="field">
                    <label for="tools-workspace-export-tool-target">Target Tool</label>
                    <select id="tools-workspace-export-tool-target"></select>
                  </div>
                  <div class="hint" id="tools-workspace-export-tool-hint">Export the current processed result and load it into another compatible tool.</div>
                </section>
                <section class="tools-workspace-export-tab-panel hidden" id="tools-workspace-export-lazydev-panel" data-tools-export-panel="lazydev" role="tabpanel">
                  <h4>Send To LazyDev Studio</h4>
                  <div class="field">
                    <label for="tools-workspace-export-lazydev-target">Target Studio</label>
                    <select id="tools-workspace-export-lazydev-target"><option value="image">Image Studio</option><option value="model3d">3D Model Studio</option></select>
                  </div>
                  <div class="hint" id="tools-workspace-export-lazydev-hint">Import the processed image into LazyDev, select it, and open the target studio ready to use it.</div>
                </section>
                <section class="tools-workspace-export-tab-panel hidden" id="tools-workspace-export-engine-panel" data-tools-export-panel="game-engine" role="tabpanel">
                  <h4>Send To Game Engine</h4>
                  <div class="field">
                    <label for="tools-workspace-export-engine-target">Target Engine</label>
                    <select id="tools-workspace-export-engine-target">
                      <option value="unity">Unity</option>
                      <option value="unreal">Unreal</option>
                      <option value="godot">Godot</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="tools-workspace-export-engine-title">Title</label>
                    <input id="tools-workspace-export-engine-title" placeholder="Imported resource title">
                  </div>
                  <div class="hint" id="tools-workspace-export-engine-hint">Queue the current tool resource for the dashboard game-engine importer.</div>
                </section>
                <div class="hint tools-workspace-export-status" id="tools-workspace-export-status">Choose where to send the active tool resource.</div>
              </article>
            </div>
            <div class="row settings-overlay-footer">
              <button class="secondary" id="tools-workspace-export-cancel-button" type="button">Cancel</button>
              <button id="tools-workspace-export-submit-button" type="button">Send Resource</button>
            </div>
          </div>
        </div>
      </section>
`;
}
