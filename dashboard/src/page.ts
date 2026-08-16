import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardSourceRoot, repoRoot } from "@urage/server/config/repositoryPaths";
// CSS loaded directly from generated.css (replaces generatedStyles.ts)
import { comfyWorkflowPaths } from "./shared/comfyWorkflowPaths.js";
import {
  renderDashboardNavigationIcon,
  renderWorkflowIcon,
  renderButtonIcon,
  renderBootstrapIcon,
  renderBlenderIconSvg,
  renderAssetsIcon,
  renderToolsIcon,
  type DashboardWorkflowIconKey
} from "./shared/dashboardIcons.js";
import {
  dashboardThemeGroups,
  dashboardThemes,
  defaultDashboardTheme
} from "./shared/dashboardThemes.js";
import {
  model3dDestinationExtraText,
  model3dInitialThreadExtraText
} from "@urage/shared/model3d.postText";
import { renderDashboardAiView } from "./pageSections/aiView.js";
import { renderDashboardMessagingView } from "./features/discord/ui/messagingView.js";
import { renderDashboardAutomationView } from "./pageSections/automationView.js";
import { renderDashboardGuildView } from "./features/discord/ui/guildView.js";
import { renderDashboardModerationView } from "./features/discord/ui/moderationView.js";
import { renderDashboardActivityView } from "./pageSections/activityView.js";
import { renderDashboardProfileView } from "./pageSections/profileView.js";
import { renderDashboardMessengerView } from "./pageSections/messengerView.js";
import { renderDashboardMessengerDashboardView } from "./pageSections/messengerDashboardView.js";
import { renderDashboardDetailsPane } from "./pageSections/detailsPane.js";
import { renderDashboardMobileNav } from "./pageSections/mobileNav.js";
import { getDashboardToolsCatalog, renderDashboardToolsRailCategories, renderDashboardToolsView } from "./pageSections/toolsView.js";
import { renderDashboardAssetsView, renderDashboardBlenderAddonsView } from "./pageSections/resourceHubView.js";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const dashboardAppearanceComponentOptions: ReadonlyArray<readonly [string, string]> = [
  ["Tabs", "tabs"],
  ["Buttons", "buttons"],
  ["Selections", "selections"],
  ["Inputs", "inputs"],
  ["Textareas", "textareas"],
  ["Selects", "selects"],
  ["Ranges", "ranges"],
  ["Checkboxes", "checkboxes"],
  ["Chips", "chips"],
  ["Cards", "cards"],
  ["Foldouts", "foldouts"],
  ["Sidebars", "sidebars"],
  ["Toolbars", "toolbars"],
  ["Lists", "lists"],
  ["Tables", "tables"],
  ["Badges", "badges"],
  ["Modals", "modals"],
  ["Overlays", "overlays"],
  ["Previews", "previews"],
  ["Outputs", "outputs"],
  ["Rails", "rails"]
];

function readEmbeddedScript(relativePath: string): string {
  const candidates = [
    path.resolve(moduleRoot, relativePath),
    path.resolve(repoRoot, relativePath)
  ];

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8").replace(/<\/script/gi, "<\\/script");
    } catch {
      continue;
    }
  }

  try {
    return "";
  } catch {
    return "";
  }
}

const markedLibraryScript = readEmbeddedScript("node_modules/marked/lib/marked.umd.js");
const domPurifyLibraryScript = readEmbeddedScript("node_modules/dompurify/dist/purify.min.js");
const gifLibraryScript = readEmbeddedScript("node_modules/gif.js.optimized/dist/gif.js");
export const dashboardGifWorkerScript = readEmbeddedScript("node_modules/gif.js.optimized/dist/gif.worker.js");

function readLatestDashboardStyles(): string {
  // Load dashboard CSS from generated.css — the single source of truth.
  const cssCandidates = [
    path.resolve(moduleRoot, "generated.css"),
    path.resolve(dashboardSourceRoot, "generated.css")
  ];

  for (const candidate of cssCandidates) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      continue;
    }
  }

  throw new Error(
    "Dashboard CSS not found. Run `node scripts/build-dashboard-css.mjs` to generate styles."
  );
}

function renderRailWorkflowButton(iconKey: DashboardWorkflowIconKey, styleKey: string, scrollTarget: string, title: string, label: string): string {
  return `<button class="nav-link rail-nav-button rail-studio-workflow-button is-${styleKey}" data-ai-scroll-target="${scrollTarget}" type="button" title="${title}" aria-label="Open ${title}"><span class="rail-studio-workflow-icon" aria-hidden="true">${renderWorkflowIcon(iconKey)}</span><span class="rail-studio-workflow-label">${label}</span></button>`;
}

function renderRailThemeButton(theme: { id: string; label: string; group: string; swatchStart: string; swatchEnd: string; swatchGlow: string; }, isActive = false): string {
  return `<button class="nav-link rail-theme-button${isActive ? " active" : ""}" data-dashboard-theme-button="${theme.id}" data-theme-group="${theme.group}" style="--theme-swatch-start:${theme.swatchStart};--theme-swatch-end:${theme.swatchEnd};--theme-swatch-glow:${theme.swatchGlow};" type="button" title="${theme.label} Theme" aria-label="Use ${theme.label} Theme"><span>${theme.label}</span></button>`;
}

function renderRailSectionButton(attributeName: string, value: string, label: string, iconMarkup: string, subtitle = ""): string {
  return `<button class="nav-link rail-nav-button rail-resource-section-button" ${attributeName}="${value}" type="button" title="${label}" aria-label="${label}"><span class="rail-resource-section-icon" aria-hidden="true">${iconMarkup}</span><span class="rail-resource-section-label">${label}</span>${subtitle ? `<span class="rail-resource-section-sub">${subtitle}</span>` : ""}</button>`;
}

function renderThemeManagerCard(theme: { id: string; label: string; group: string; imagePath: string; swatchStart: string; swatchEnd: string; swatchGlow: string; }): string {
  return `
            <article class="status-card settings-overlay-card theme-manager-card" data-theme-manager-card="${theme.id}" data-theme-group-panel="${theme.group}">
              <button
                class="theme-manager-card-button"
                data-dashboard-theme-button="${theme.id}"
                data-theme-group="${theme.group}"
                style="--theme-swatch-start:${theme.swatchStart};--theme-swatch-end:${theme.swatchEnd};--theme-swatch-glow:${theme.swatchGlow};"
                type="button"
                title="${theme.label} Theme"
                aria-label="Apply ${theme.label} theme"
              >
                <img src="${theme.imagePath}" alt="${theme.label} theme preview">
              </button>
            </article>`;
}

function renderAppearanceComponentFoldout(componentLabel: string, key: string, open = false): string {
  const sliders = [
    ["Radius", "radius", 32],
    ["Padding", "padding", 40],
    ["Margin", "margin", 40]
  ] as const;
  return `<details class="theme-appearance-component-foldout"${open ? " open" : ""} data-theme-component-row="${key}">
                  <summary><span>${componentLabel}</span><small data-theme-component-summary="${key}">Global</small></summary>
                  <div class="theme-appearance-component-controls">
                    ${sliders.map(([label, prop, max]) => `<label class="theme-component-slider-row">
                      <span>${label}</span>
                      <input data-appearance-component-input="${key}" data-appearance-component-prop="${prop}" aria-label="${componentLabel} ${label}" type="range" min="-1" max="${max}" step="1" value="-1">
                      <output data-appearance-component-value="${key}" data-appearance-component-prop="${prop}">Global</output>
                    </label>`).join("")}
                  </div>
                </details>`;
}

export function renderDashboardHtml(port: number, clientScript: string): string {
  const latestDashboardStyles = readLatestDashboardStyles();
  const toolsCatalogEntries = getDashboardToolsCatalog();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#050813">
  <meta name="color-scheme" content="dark">
  <title>URage Now — Studio</title>
  <link rel="icon" type="image/png" data-dashboard-theme-favicon href="/assets/dashboard-theme-logo.png?theme=${defaultDashboardTheme}">
  <link rel="apple-touch-icon" data-dashboard-theme-favicon href="/assets/dashboard-theme-logo.png?theme=${defaultDashboardTheme}">
  <link rel="stylesheet" href="/assets/vendor/bootstrap-icons/bootstrap-icons.min.css">
  <style>${latestDashboardStyles}</style>
  <script>${markedLibraryScript}</script>
  <script>${domPurifyLibraryScript}</script>
</head>
<body class="messenger-discord view-ai-active" data-dashboard-theme="${defaultDashboardTheme}">
  <header class="desktop-window-titlebar" id="desktop-window-titlebar" hidden>
    <div class="desktop-window-drag-region" data-tauri-drag-region>
      <i class="bi bi-stars desktop-window-mark" aria-hidden="true"></i>
      <span class="desktop-window-title dashboard-wordmark" data-tauri-drag-region aria-label="URage Now Studio"><span class="dashboard-wordmark-u">U</span><span class="dashboard-wordmark-rage">RAGE</span><span class="dashboard-wordmark-now">Now</span><span class="dashboard-wordmark-descriptor">Studio</span></span>
    </div>
    <div class="desktop-window-controls" aria-label="Window controls">
      <button class="desktop-window-control" id="desktop-window-minimize" type="button" title="Minimize" aria-label="Minimize window"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>
      <button class="desktop-window-control" id="desktop-window-maximize" type="button" title="Maximize or restore" aria-label="Maximize or restore window"><i class="bi bi-square" aria-hidden="true"></i></button>
      <button class="desktop-window-control is-close" id="desktop-window-close" type="button" title="Hide to tray" aria-label="Hide window to tray"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
    </div>
  </header>
  <a class="skip-link" href="#dashboard-app">Skip to dashboard content</a>
  <main class="app-shell" id="dashboard-app" tabindex="-1">
    <div class="shell-scrim" id="workspace-scrim"></div>
    <div class="shell-scrim" id="details-scrim"></div>

    <aside class="server-rail side-nav">
      <button class="nav-link rail-settings-button" id="rail-workflow-expand-button" type="button" title="Expand workflow rail" aria-label="Expand workflow rail">
        <span aria-hidden="true">&#8646;</span>
      </button>
      <div class="rail-home-wrap">
        <button class="nav-link rail-nav-button rail-app-button active" data-rail-category="studio" data-view="ai" data-studio-home-view="studio" title="URage Now Studio Home" aria-label="Open URage Now Studio Home">
          <span class="rail-home-mark">
            <img class="rail-home-mark-logo" data-dashboard-theme-logo="studio" src="/assets/dashboard-theme-logo.png?theme=${defaultDashboardTheme}" alt="URage Now">
          </span>
          <span class="rail-home-label dashboard-wordmark" aria-label="URage Now Studio"><span class="dashboard-wordmark-u">U</span><span class="dashboard-wordmark-rage">RAGE</span><span class="dashboard-wordmark-now">Now</span><span class="dashboard-wordmark-descriptor">Studio</span></span>
        </button>
        <button class="nav-link rail-nav-button rail-home" data-rail-category="workflow" data-view="ai" data-studio-home-view="workflow" type="button" title="LazyDev Home" aria-label="Open LazyDev Home">
          <span class="rail-home-mark rail-lazydev-mark" aria-hidden="true">
            ${renderDashboardNavigationIcon("skills")}
          </span>
          <span class="rail-home-label">LazyDev</span>
        </button>
        <div class="rail-studio-workflows" data-studio-workflow-rail="true">
          ${renderRailWorkflowButton("chat", "chat", "ask-rod-card", "Ask LazyDev", "Chat")}
          ${renderRailWorkflowButton("image", "image", "image-studio-card", "Image Studio", "Image")}
          ${renderRailWorkflowButton("model3d", "model3d", "model3d-studio-card", "3D Model Studio", "3D")}
          ${renderRailWorkflowButton("audio", "audio", "audio-studio-card", "Audio Studio", "Audio")}
          ${renderRailWorkflowButton("music", "music", "music-studio-card", "Music Studio", "Music")}
          ${renderRailWorkflowButton("video", "video", "video-studio-card", "Video Studio", "Video")}
        </div>
        <button class="nav-link rail-nav-button rail-tools-button" data-rail-category="tools" data-view="tools" title="URage Tools" aria-label="Open tools">
          <span class="rail-home-mark rail-tools-mark" aria-hidden="true">
            ${renderToolsIcon()}
          </span>
          <span class="rail-home-label rail-tools-label">Tools</span>
        </button>
        ${renderDashboardToolsRailCategories(toolsCatalogEntries)}
        <button class="nav-link rail-nav-button rail-home rail-3d-suites-button" data-rail-category="blender-addons" data-view="blender-addons" title="3D Suites" aria-label="Open 3D Suites">
          <span class="rail-home-mark rail-3d-suites-mark" aria-hidden="true">
            ${renderBlenderIconSvg()}
          </span>
          <span class="rail-home-label rail-3d-suites-label">3D Suites</span>
        </button>
        <div class="rail-resource-sections rail-3d-suites-sections" data-resource-rail-group="blender-addons">
          ${renderRailSectionButton("data-3d-suite", "blender", "Blender", renderBlenderIconSvg())}
          ${renderRailSectionButton("data-3d-suite", "3ds-max", "3ds Max", renderButtonIcon("cube"))}
          ${renderRailSectionButton("data-3d-suite", "houdini", "Houdini", renderButtonIcon("sparkle"))}
          ${renderRailSectionButton("data-3d-suite", "cinema-4d", "Cinema 4D", renderButtonIcon("cube"))}
        </div>
        <button class="nav-link rail-nav-button rail-home rail-assets-button" data-rail-category="assets" data-view="assets" title="Game Engines" aria-label="Open Game Engines">
          <span class="rail-home-mark rail-assets-mark" aria-hidden="true">
            ${renderAssetsIcon()}
          </span>
          <span class="rail-home-label rail-assets-label">Game Engines</span>
        </button>
        <div class="rail-resource-sections rail-asset-sections" data-resource-rail-group="assets">
          ${renderRailSectionButton("data-asset-platform", "unity", "Unity", renderBootstrapIcon("box-seam"))}
          ${renderRailSectionButton("data-asset-platform", "godot", "Godot", renderBootstrapIcon("boxes"))}
          ${renderRailSectionButton("data-asset-platform", "unreal", "Unreal", renderBootstrapIcon("layers"))}
        </div>
        <button class="nav-link rail-nav-button rail-profile-button" id="rail-profile-button" data-rail-category="bots" data-view="dashboard" title="Bots" aria-label="Open bots">
          <span class="rail-home-mark rail-profile-mark" aria-hidden="true">
            ${renderDashboardNavigationIcon("discord")}
          </span>
          <span class="rail-home-label rail-profile-label">Bots</span>
        </button>
        <div class="rail-resource-sections rail-bot-sections" data-resource-rail-group="bots">
          ${renderRailSectionButton("data-messenger", "discord", "Discord", renderDashboardNavigationIcon("discord"), "Guild + channel dashboard")}
          ${renderRailSectionButton("data-messenger", "telegram", "Telegram", renderDashboardNavigationIcon("telegram"), "Chat and bot operations")}
          ${renderRailSectionButton("data-messenger", "matrix", "Matrix", renderDashboardNavigationIcon("matrix"), "Rooms and runtime controls")}
          ${renderRailSectionButton("data-messenger", "whatsapp", "WhatsApp", renderDashboardNavigationIcon("whatsapp"), "Phone messaging runtime")}
        </div>
        <section class="rail-direct-messages" id="rail-direct-messages" aria-label="Direct messages">
          <div class="rail-direct-messages-header">
            <span class="rail-direct-messages-label" id="rail-direct-messages-label">Direct messages</span>
            <button class="rail-direct-messages-refresh" id="rail-direct-messages-refresh" type="button" title="Refresh direct messages" aria-label="Refresh direct messages">
              <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
            </button>
          </div>
          <div class="rail-direct-message-list" id="rail-direct-message-list" aria-live="polite"></div>
        </section>
        <div class="rail-guilds" data-discord-only="true">
          <div class="guild-rail-list" id="guild-rail-list"></div>
        </div>
      </div>

      <div class="rail-divider" data-discord-only="true"></div>

      <details class="rail-theme-picker">
        <summary class="rail-theme-picker-summary" aria-label="Choose dashboard theme">
          <span aria-hidden="true">◐</span>
          <span>Theme</span>
          <span class="rail-theme-picker-chevron" aria-hidden="true">›</span>
        </summary>
        <div class="rail-theme-switcher" data-studio-theme-switcher="true" aria-label="Studio theme selector">
          ${dashboardThemes.map(theme => renderRailThemeButton(theme, theme.id === defaultDashboardTheme)).join("\n")}
        </div>
      </details>

      <div class="rail-bottom">
        <button class="nav-link rail-settings-button rail-about-button" id="rail-about-button" type="button" title="About" aria-label="Open About">
          <span aria-hidden="true">
            ${renderDashboardNavigationIcon("about")}
          </span>
          <span class="rail-bottom-label">About</span>
        </button>
        <button class="nav-link rail-settings-button rail-resources-button" id="rail-resources-button" type="button" title="Resources" aria-label="Open Resources">
          <span aria-hidden="true">
            ${renderDashboardNavigationIcon("resources")}
          </span>
          <span class="rail-bottom-label">Resources</span>
        </button>
        <button class="nav-link rail-settings-button rail-skills-button" id="rail-skills-button" type="button" title="Skills" aria-label="Open Skills">
          <span aria-hidden="true">
            ${renderDashboardNavigationIcon("skills")}
          </span>
          <span class="rail-bottom-label">Skills</span>
        </button>
        <button class="nav-link rail-settings-button rail-console-button" id="rail-console-button" type="button" title="Console" aria-label="Open Console">
          <span aria-hidden="true">
            ${renderDashboardNavigationIcon("console")}
          </span>
          <span class="rail-bottom-label">Console</span>
        </button>
        <button class="nav-link rail-settings-button" id="rail-settings-button" type="button" title="Settings" aria-label="Open Settings">
          <span aria-hidden="true">&#9881;</span>
          <span class="rail-bottom-label">Settings</span>
        </button>
      </div>

    </aside>

    <div class="studio-workflow-sidebar-resizer" id="studio-workflow-sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize workflow sidebar" title="Drag to resize workflow sidebar"></div>

    <aside class="workspace-sidebar side-panel side-panel-left" data-discord-only="true">
      <section class="sidebar-card grow-card">
        <article class="sidebar-mode-panel" data-sidebar-mode="discord">
          <div class="section-label">Messenger Switcher</div>
          <div class="sidebar-messenger-list sidebar-messenger-list-compact">
            <button class="secondary sidebar-messenger-button active" data-messenger="discord" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/discord/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Discord</strong>
                <span>Guild + channel dashboard</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="telegram" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/telegram/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Telegram</strong>
                <span>Chat and bot operations</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="matrix" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/matrix/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Matrix</strong>
                <span>Rooms and runtime controls</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="whatsapp" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/whatsapp/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>WhatsApp</strong>
                <span>Phone messaging runtime</span>
              </span>
            </button>
          </div>
          <div class="section-label">Channels</div>
          <div class="list channel-browser" id="channel-browser"></div>
          <div class="chip" id="channel-chip">No channel selected</div>
        </article>
        <article class="sidebar-mode-panel" data-sidebar-mode="studio">
          <div class="section-label">Messenger Switcher</div>
          <div class="sidebar-messenger-list">
            <button class="secondary sidebar-messenger-button active" data-messenger="discord" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/discord/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Discord</strong>
                <span>Active runtime + server tools</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="telegram" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/telegram/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Telegram</strong>
                <span>Chat + automation workflows</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="matrix" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/matrix/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Matrix</strong>
                <span>Room runtime + routing</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="whatsapp" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/whatsapp/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>WhatsApp</strong>
                <span>Phone messaging runtime</span>
              </span>
            </button>
          </div>
          <div class="section-label">Main Navigation</div>
          <div class="chip">Use the left rail workflow buttons to jump to Studio sections.</div>
        </article>
      </section>
    </aside>
    <aside class="workspace-sidebar side-panel side-panel-left" data-non-discord-only="true">
      <section class="sidebar-card grow-card">
        <article class="sidebar-mode-panel" data-sidebar-mode="studio">
          <div class="section-label">Messenger Switcher</div>
          <div class="sidebar-messenger-list">
            <button class="secondary sidebar-messenger-button" data-messenger="discord" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/discord/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Discord</strong>
                <span>Guild + channel dashboard</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button active" data-messenger="telegram" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/telegram/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Telegram</strong>
                <span>Chat and bot operations</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="matrix" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/matrix/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Matrix</strong>
                <span>Rooms and runtime controls</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="whatsapp" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/whatsapp/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>WhatsApp</strong>
                <span>Phone messaging runtime</span>
              </span>
            </button>
          </div>
          <div class="section-label">Main Navigation</div>
          <div class="chip">Use the left rail workflow buttons to jump to Studio sections.</div>
        </article>
        <article class="sidebar-mode-panel" data-sidebar-mode="messenger">
          <div class="section-label">Messenger Switcher</div>
          <div class="sidebar-messenger-list sidebar-messenger-list-compact">
            <button class="secondary sidebar-messenger-button" data-messenger="discord" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/discord/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Discord</strong>
                <span>Guild + channel dashboard</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button active" data-messenger="telegram" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/telegram/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Telegram</strong>
                <span>Chat and bot operations</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="matrix" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/matrix/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>Matrix</strong>
                <span>Rooms and runtime controls</span>
              </span>
            </button>
            <button class="secondary sidebar-messenger-button" data-messenger="whatsapp" type="button">
              <span class="sidebar-messenger-icon"><img src="/assets/messengers/whatsapp/logo.svg" alt=""></span>
              <span class="sidebar-messenger-copy">
                <strong>WhatsApp</strong>
                <span>Phone messaging runtime</span>
              </span>
            </button>
          </div>
          <div class="section-label">Messenger Sidebar</div>
          <article data-messenger-panel="telegram">
            <div class="row">
              <button class="secondary" id="messenger-sidebar-refresh-chats-button">Refresh Telegram Chats</button>
            </div>
            <div class="list channel-browser" id="messenger-sidebar-telegram-chat-list"></div>
            <div class="chip" id="messenger-sidebar-selected-chat-chip">No Telegram chat selected</div>
          </article>
          <article data-messenger-panel="matrix">
            <div class="panel-subtitle">Matrix room controls will appear here once Matrix runtime admin routes are connected.</div>
            <div class="row">
              <button class="secondary" data-view="messenger">Open Messaging View</button>
            </div>
          </article>
          <article data-messenger-panel="whatsapp">
            <div class="panel-subtitle">WhatsApp uses manual phone targets. Open Messaging View to send through runtime admin.</div>
            <div class="row">
              <button class="secondary" data-view="messenger">Open Messaging View</button>
            </div>
          </article>
        </article>
      </section>
    </aside>

    <section class="content-shell">
      <button class="shell-edge-toggle shell-edge-toggle-left" data-discord-only="true" type="button" data-shell-toggle="workspace" aria-label="Toggle side nav">
        <span class="shell-edge-toggle-icon" aria-hidden="true">&#9776;</span>
        <span class="shell-edge-toggle-label">Side Nav</span>
      </button>
      <button class="shell-edge-toggle shell-edge-toggle-right" data-discord-only="true" type="button" data-shell-toggle="details" aria-label="Toggle inspector">
        <span class="shell-edge-toggle-icon" aria-hidden="true">&#9681;</span>
        <span class="shell-edge-toggle-label">Inspector</span>
      </button>
      <button class="shell-edge-toggle shell-edge-toggle-left" data-non-discord-only="true" type="button" data-shell-toggle="workspace" aria-label="Toggle side nav">
        <span class="shell-edge-toggle-icon" aria-hidden="true">&#9776;</span>
        <span class="shell-edge-toggle-label">Side Nav</span>
      </button>
      <button class="shell-edge-toggle shell-edge-toggle-right" data-non-discord-only="true" type="button" data-shell-toggle="details" aria-label="Toggle messenger inspector">
        <span class="shell-edge-toggle-icon" aria-hidden="true">&#9681;</span>
        <span class="shell-edge-toggle-label">Inspector</span>
      </button>
      <header class="content-header">
        <div class="content-header-main">
          <div class="content-header-messenger-row">
            <div class="dashboard-tabs" id="messenger-launch-tablist">
              <button class="messenger-tab active" data-messenger="discord" title="Discord Dashboard" aria-label="Discord Dashboard">
                <span class="messenger-tab-icon messenger-tab-icon-discord" aria-hidden="true">
                  <img src="/assets/messengers/discord/logo.svg" alt="Discord">
                </span>
                <span class="messenger-tab-label">Discord</span>
              </button>
              <button class="messenger-tab" data-messenger="telegram" title="Telegram Dashboard" aria-label="Telegram Dashboard">
                <span class="messenger-tab-icon messenger-tab-icon-telegram" aria-hidden="true">
                  <img src="/assets/messengers/telegram/logo.svg" alt="Telegram">
                </span>
                <span class="messenger-tab-label">Telegram</span>
              </button>
              <button class="messenger-tab" data-messenger="matrix" title="Matrix Dashboard" aria-label="Matrix Dashboard">
                <span class="messenger-tab-icon messenger-tab-icon-matrix" aria-hidden="true">
                  <img src="/assets/messengers/matrix/logo.svg" alt="Matrix">
                </span>
                <span class="messenger-tab-label">Matrix</span>
              </button>
              <button class="messenger-tab" data-messenger="whatsapp" title="WhatsApp Dashboard" aria-label="WhatsApp Dashboard">
                <span class="messenger-tab-icon messenger-tab-icon-whatsapp" aria-hidden="true">
                  <img src="/assets/messengers/whatsapp/logo.svg" alt="WhatsApp">
                </span>
                <span class="messenger-tab-label">WhatsApp</span>
              </button>
            </div>
          </div>
          <div class="content-header-view-row">
            <div class="dashboard-tabs">
              <button class="nav-link tab-link" data-view="dashboard" title="Dashboard">&#127968; Dashboard</button>
              <button class="nav-link tab-link" data-view="messaging" title="Messages">&#128172; Messages</button>
              <button class="nav-link tab-link" data-ai-scroll-target="ask-rod-card" title="Chat">&#9993; Chat</button>
              <button class="nav-link tab-link" data-view="automation" title="Automation">&#9201; Automation</button>
              <button class="nav-link tab-link" data-view="guild" data-discord-only="true" title="Guild">&#9881; Guild</button>
              <button class="nav-link tab-link" data-view="moderation" data-discord-only="true" title="Moderation">&#128737; Moderation</button>
              <button class="nav-link tab-link" data-view="activity" title="Activity">&#128203; Activity</button>
            </div>
          </div>
        </div>
        <div class="content-header-side">
          <button class="runtime-launcher" id="open-runtime-overlay-button" title="Open runtime controls">
            <span class="runtime-launcher-label" id="messenger-runtime-compact-label">Discord Runtime</span>
            <span class="runtime-launcher-state is-stopped" id="messenger-runtime-compact-state">STOPPED</span>
            <span class="runtime-launcher-meta" id="messenger-runtime-compact-meta">Click to open runtime controls</span>
          </button>
          <button class="secondary header-side-restart-button" data-restart-dashboard="true" type="button" title="Reload and reinitialize dashboard UI">Restart Dashboard</button>
        </div>
      </header>
${renderDashboardAiView({ model3dInitialThreadExtraText, model3dDestinationExtraText })}
${renderDashboardToolsView(toolsCatalogEntries)}
${renderDashboardBlenderAddonsView()}
${renderDashboardAssetsView()}
${renderDashboardMessengerDashboardView()}
${renderDashboardMessagingView()}
${renderDashboardAutomationView({ model3dInitialThreadExtraText, model3dDestinationExtraText })}

${renderDashboardGuildView()}

${renderDashboardModerationView()}

${renderDashboardMessengerView()}

${renderDashboardActivityView()}

${renderDashboardProfileView(port)}
    </section>

${renderDashboardDetailsPane()}

${renderDashboardMobileNav()}

    <div class="runtime-overlay hidden settings-overlay resources-overlay" id="resources-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="resources-overlay-backdrop" aria-label="Close resources"></button>
      <div class="runtime-overlay-panel settings-overlay-panel resources-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">Studio Resources</div>
            <h3>Sources And Pools</h3>
          </div>
          <button class="ghost compact" id="close-resources-overlay-button" aria-label="Close resources">&#10005;</button>
        </div>
        <div class="dashboard-tabs" role="tablist" aria-label="Resource tabs">
          <button class="ghost active" data-resources-tab="text-sources" type="button">Text Sources</button>
          <button class="ghost" data-resources-tab="image-pools" type="button">Image Pools</button>
        </div>
        <section class="about-tab-panel resources-tab-panel active" id="resources-panel-text-sources">
          <div class="settings-overlay-grid overlay-manager-grid resources-overlay-grid">
            <article class="status-card settings-overlay-card overlay-manager-sidebar-card resources-overlay-card">
              <div class="overlay-manager-section-heading"><span>Shared Text Sources</span><small>Reusable prompt-line files</small></div>
              <div class="overlay-manager-card-body">
                <div class="hint">Reusable prompt-line files for Studio workflows and dashboard automation.</div>
                <div class="list medium-list resources-source-list" id="resources-text-source-list"></div>
                <div class="row">
                  <button class="secondary" id="resources-refresh-text-sources-button" type="button">Refresh Sources</button>
                  <button class="secondary" id="resources-open-automation-text-manager-button" type="button">Open Automation View</button>
                </div>
                <div class="hint" id="resources-text-sources-refresh-status">Text sources not loaded yet.</div>
              </div>
            </article>
            <article class="status-card settings-overlay-card overlay-manager-main-card resources-overlay-card">
              <div class="overlay-manager-section-heading"><span>Create Or Extend Text</span><small>Save reusable prompt lines</small></div>
              <div class="overlay-manager-card-body">
              <div class="field">
                <label for="resources-text-file-name">File Name</label>
                <input id="resources-text-file-name" placeholder="prompts.txt">
              </div>
              <div class="compact-grid two-col">
                <div class="field">
                  <label for="resources-text-mode">Save Mode</label>
                  <select id="resources-text-mode">
                    <option value="append">Append To File</option>
                    <option value="replace">Replace File</option>
                  </select>
                </div>
                <div class="field">
                  <label for="resources-text-quick-type">Quick Prompt</label>
                  <select id="resources-text-quick-type">
                    <option value="custom">Custom</option>
                    <option value="jokes">Jokes</option>
                    <option value="questions">Questions</option>
                    <option value="tips">Tips</option>
                    <option value="icebreakers">Icebreakers</option>
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="resources-text-content">Lines To Save</label>
                <textarea id="resources-text-content" placeholder="One reusable line per row."></textarea>
              </div>
              <div class="field">
                <label for="resources-text-prompt">LazyDev Prompt</label>
                <textarea id="resources-text-prompt" placeholder="Generate reusable prompt lines. Return one line per row."></textarea>
              </div>
              <div class="row">
                <button id="resources-save-text-button" type="button">Save Lines</button>
                <button class="secondary" id="resources-generate-text-button" type="button">Generate With LLM</button>
              </div>
              <div class="output simulation-output resources-output" id="resources-text-output">No resource text action run yet.</div>
              </div>
            </article>
          </div>
        </section>
        <section class="about-tab-panel resources-tab-panel" id="resources-panel-image-pools">
          <div class="settings-overlay-grid overlay-manager-grid resources-overlay-grid">
            <article class="status-card settings-overlay-card overlay-manager-sidebar-card resources-overlay-card">
              <div class="overlay-manager-section-heading"><span>Image Pool Editor</span><small>Create and update pools</small></div>
              <div class="overlay-manager-card-body">
            <div class="field">
              <label for="image-pool-select">Pool</label>
              <select id="image-pool-select"></select>
            </div>
            <div class="field">
              <label for="image-pool-name">Pool Name</label>
              <input id="image-pool-name" placeholder="Daily seeds">
            </div>
            <div class="field">
              <label for="image-pool-images">Image Sources</label>
              <textarea id="image-pool-images" placeholder="https://example.com/seed.png&#10;C:\\images\\seed.png"></textarea>
              <input id="image-pool-files" type="file" accept="image/*" multiple hidden>
              <div class="row">
                <button class="secondary" id="image-pool-browse-button" type="button">Add Local Images</button>
                <button class="secondary" id="image-pool-add-current-source-button" type="button">Use Current 3D Source</button>
              </div>
              <div class="hint">Use URLs, uploaded local paths, and data URLs. Uploaded local files are sanitized and stored in data/uploaded-model-images.</div>
            </div>
            <div class="row">
              <button id="save-image-pool-button" type="button">Save Pool</button>
              <button class="secondary" id="new-image-pool-button" type="button">New Pool</button>
              <button class="secondary" id="delete-image-pool-button" type="button">Delete Pool</button>
            </div>
              </div>
            </article>
            <article class="status-card settings-overlay-card overlay-manager-main-card resources-overlay-card resources-image-pool-browser-card">
              <div class="overlay-manager-section-heading"><span>Pool Browser</span><small>Preview saved entries</small></div>
              <div class="overlay-manager-card-body resources-image-pool-browser-body">
              <div class="field">
                <label for="resources-image-pool-library-select">Pool</label>
                <select id="resources-image-pool-library-select"></select>
              </div>
              <div class="row">
                <button class="secondary" id="resources-image-pool-library-new-button" type="button">Create New Pool</button>
                <button class="secondary" id="resources-image-pool-library-delete-button" type="button">Delete Selected Pool</button>
              </div>
              <div class="hint">Browse saved entries with previews where the source can be resolved.</div>
              <div class="list medium-list resources-source-list" id="resources-image-pool-library-list"></div>
              </div>
            </article>
          </div>
        </section>
        <div class="row settings-overlay-footer">
          <button class="secondary" id="close-resources-overlay-footer-button" type="button">Close</button>
        </div>
      </div>
    </div>

    <div class="runtime-overlay hidden settings-overlay resources-overlay skills-overlay" id="skills-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="skills-overlay-backdrop" aria-label="Close skills"></button>
      <div class="runtime-overlay-panel settings-overlay-panel resources-overlay-panel skills-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">Studio Skills</div>
            <h3>Skills Library</h3>
          </div>
          <button class="ghost compact" id="close-skills-overlay-button" aria-label="Close skills">&#10005;</button>
        </div>
        <div class="settings-overlay-grid resources-overlay-grid skills-overlay-grid">
          <article class="status-card settings-overlay-card resources-overlay-card skills-overlay-card">
            <h4>Available Skills</h4>
            <div class="hint">Chat skills loaded from dashboard/chat-skills. Pick one to edit its source skill.md file.</div>
            <div class="list medium-list resources-source-list skills-source-list" id="skills-list"></div>
            <div class="row">
              <button class="secondary" id="refresh-skills-button" type="button">Refresh Skills</button>
              <button class="secondary" id="new-skill-button" type="button">New Skill</button>
            </div>
            <div class="hint" id="skills-refresh-status">Skills not loaded yet.</div>
          </article>
          <article class="status-card settings-overlay-card resources-overlay-card skills-overlay-card">
            <h4>Edit Skill</h4>
            <div class="field">
              <label for="skill-editor-id">Skill ID</label>
              <input id="skill-editor-id" placeholder="my-skill">
            </div>
            <div class="field">
              <label for="skill-editor-content">skill.md</label>
              <textarea id="skill-editor-content" spellcheck="false" placeholder="---&#10;outputKind: utility&#10;inputMode: optional&#10;supportsMultiple: false&#10;allowedFollowUps:&#10;routerHint:&#10;---&#10;&#10;# My Skill&#10;&#10;Describe how this skill should behave."></textarea>
            </div>
            <div class="row">
              <button id="save-skill-button" type="button">Save Skill</button>
              <button class="secondary" id="reload-skill-button" type="button">Reload Selected</button>
            </div>
            <div class="output simulation-output resources-output skills-output" id="skills-output">No skill selected.</div>
          </article>
        </div>
        <div class="row settings-overlay-footer">
          <button class="secondary" id="close-skills-overlay-footer-button" type="button">Close</button>
        </div>
      </div>
    </div>

    <div class="runtime-overlay hidden settings-overlay quick-actions-overlay" id="quick-actions-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="quick-actions-overlay-backdrop" aria-label="Close quick actions"></button>
      <div class="runtime-overlay-panel settings-overlay-panel quick-actions-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">Quick Actions</div>
            <h3>Command Palette</h3>
          </div>
          <button class="ghost compact" id="close-quick-actions-overlay-button" aria-label="Close quick actions">&#10005;</button>
        </div>
        <div class="dashboard-tabs" role="tablist" aria-label="Quick action tabs">
          <button class="ghost active" data-quick-actions-tab="slash" type="button">Slash Commands</button>
          <button class="ghost" data-quick-actions-tab="tools" type="button">Tools</button>
        </div>
        <section class="about-tab-panel quick-actions-tab-panel active" data-quick-actions-panel="slash">
          <div class="quick-actions-grid">
            <article class="status-card settings-overlay-card quick-actions-card">
              <div class="quick-actions-command-row">
                <label class="field">
                  <span>Command</span>
                  <input id="quick-actions-command-input" placeholder="/tool gif viewer" autocomplete="off" spellcheck="false">
                </label>
                <button id="quick-actions-command-run-button" type="button">Run</button>
              </div>
              <div class="hint">Use <code>Ctrl+/</code> from any dashboard view to reopen this palette.</div>
              <div class="quick-actions-command-status" id="quick-actions-command-status">Ready.</div>
            </article>
            <article class="status-card settings-overlay-card quick-actions-card">
              <div class="quick-actions-section-head">
                <h4>Shortcuts</h4>
                <button class="secondary mini-button" id="quick-actions-open-tools-tab-button" type="button">Browse Tools</button>
              </div>
              <div class="quick-actions-command-list" id="quick-actions-command-list"></div>
            </article>
          </div>
        </section>
        <section class="about-tab-panel quick-actions-tab-panel" data-quick-actions-panel="tools">
          <div class="quick-actions-tools-panel">
            <label class="field">
              <span>Search Tools</span>
              <input id="quick-actions-tool-search" type="search" placeholder="3D model viewer, gif viewer, tilemap..." autocomplete="off">
            </label>
            <div class="quick-actions-tool-results" id="quick-actions-tool-results"></div>
          </div>
        </section>
        <div class="row settings-overlay-footer">
          <button class="secondary" id="close-quick-actions-overlay-footer-button" type="button">Close</button>
        </div>
      </div>
    </div>

    <div class="runtime-overlay hidden quick-tool-overlay" id="quick-tool-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="quick-tool-overlay-backdrop" aria-label="Close tool overlay"></button>
      <div class="runtime-overlay-panel quick-tool-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">Tool Overlay</div>
            <h3 id="quick-tool-overlay-title">Tool</h3>
            <div class="hint" id="quick-tool-overlay-meta">Open a local tool without leaving your current page.</div>
          </div>
          <div class="row quick-tool-overlay-actions">
            <button class="secondary" id="quick-tool-overlay-open-workspace-button" type="button">Open In Workspace</button>
            <button class="ghost compact" id="close-quick-tool-overlay-button" aria-label="Close tool overlay">&#10005;</button>
          </div>
        </div>
        <iframe class="quick-tool-overlay-frame" id="quick-tool-overlay-frame" title="Quick tool overlay frame" loading="lazy" src="about:blank"></iframe>
      </div>
    </div>

    <div class="runtime-overlay hidden settings-overlay console-overlay" id="console-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="console-overlay-backdrop" aria-label="Close console"></button>
      <div class="runtime-overlay-panel settings-overlay-panel console-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">Studio Console</div>
            <h3>LLM And System Logs</h3>
          </div>
          <button class="ghost compact" id="close-console-overlay-button" aria-label="Close console">&#10005;</button>
        </div>
        <div class="dashboard-tabs" role="tablist" aria-label="Console tabs">
          <button class="ghost active" data-console-tab="llm" type="button">LLM Prompts</button>
          <button class="ghost" data-console-tab="system" type="button">System Logs</button>
        </div>
        <div class="console-overlay-grid">
          <section class="status-card settings-overlay-card console-list-card">
            <div class="console-list-head">
              <strong id="console-list-title">Prompt History</strong>
              <button class="secondary mini-button" id="console-refresh-button" type="button">Refresh</button>
            </div>
            <div class="list console-event-list" id="console-event-list"></div>
          </section>
          <section class="status-card settings-overlay-card console-detail-card">
            <div class="console-detail-head">
              <strong id="console-detail-title">Select an entry</strong>
              <span id="console-detail-meta">No console entry selected.</span>
            </div>
            <div class="console-detail-block">
              <label>Input Prompt</label>
              <pre id="console-prompt-output">No prompt selected.</pre>
            </div>
            <div class="console-detail-block">
              <label>LLM Response / Log Detail</label>
              <pre id="console-response-output">Select an LLM prompt or system log to inspect it.</pre>
            </div>
            <div class="console-detail-block" id="console-reasoning-block">
              <label>Reasoning</label>
              <pre id="console-reasoning-output">No reasoning captured.</pre>
            </div>
          </section>
        </div>
        <div class="row settings-overlay-footer">
          <button class="secondary" id="close-console-overlay-footer-button" type="button">Close</button>
        </div>
      </div>
    </div>

    <div class="runtime-overlay hidden settings-overlay" id="settings-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="settings-overlay-backdrop" aria-label="Close settings"></button>
      <div class="runtime-overlay-panel settings-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">Studio Settings</div>
            <h3 id="settings-overlay-title">Setup And Paths</h3>
          </div>
          <button class="ghost compact" id="close-settings-overlay-button" aria-label="Close settings">&#10005;</button>
        </div>
        <div class="dashboard-tabs settings-overlay-tabs" role="tablist" aria-label="Settings tabs">
          <button class="ghost active" data-settings-tab="setup" type="button">Setup</button>
          <button class="ghost" data-settings-tab="network" type="button">Network</button>
          <button class="ghost" data-settings-tab="ui" type="button">UI</button>
          <button class="ghost" data-settings-tab="themes" type="button">Themes</button>
        </div>
        <section class="settings-overlay-tab-panel active" data-settings-panel="setup">
        <div class="dashboard-tabs settings-overlay-subtabs" role="tablist" aria-label="Setup sections">
          <button class="ghost active" data-settings-subtab="install" type="button">Install</button>
          <button class="ghost" data-settings-subtab="comfyui" type="button">ComfyUI</button>
          <button class="ghost" data-settings-subtab="ffmpeg" type="button">FFmpeg</button>
          <button class="ghost" data-settings-subtab="workflows" type="button">Workflows</button>
          <button class="ghost" data-settings-subtab="messengers" type="button">Messengers</button>
        </div>
        <div class="settings-overlay-subpanel active" data-settings-subpanel="install">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>Install Tools</h4>
            <div class="hint">Review the purpose and install location before an installer is allowed to run.</div>
            <div class="settings-install-grid">
              <button class="secondary" data-installer-review-button="true" data-installer-id="ollama" type="button">Review Ollama</button>
              <button class="secondary" data-installer-review-button="true" data-installer-id="lmstudio" type="button">Review LM Studio</button>
              <button class="secondary" data-installer-review-button="true" data-installer-id="comfyui" type="button">Review ComfyUI</button>
              <button class="secondary" data-installer-review-button="true" data-installer-id="blender" type="button">Review Blender</button>
              <button class="secondary" data-installer-review-button="true" data-installer-id="ffmpeg" type="button">Review FFmpeg</button>
            </div>
            <section class="installer-review-card hidden" id="installer-review-card" aria-live="polite">
              <div>
                <div class="panel-kicker" id="installer-review-kicker">Installer review</div>
                <h5 id="installer-review-title">Select an installer</h5>
                <p class="hint" id="installer-review-description">Choose a tool above to see what it installs and select a location.</p>
              </div>
              <div class="field">
                <label for="installer-location-mode-select">Install location</label>
                <select id="installer-location-mode-select">
                  <option value="default">Default location recommended by the publisher</option>
                  <option value="custom">Request a custom installation folder</option>
                </select>
              </div>
              <div class="field hidden" id="installer-custom-path-field">
                <label for="installer-custom-path-input">Custom installation folder</label>
                <input id="installer-custom-path-input" placeholder="C:\\Tools\\URage\\ComfyUI">
                <div class="hint" id="installer-custom-path-hint">Use an absolute folder path.</div>
              </div>
              <div class="row">
                <button id="installer-confirm-button" type="button">Install selected tool</button>
                <button class="secondary" id="installer-cancel-button" type="button">Cancel</button>
              </div>
            </section>
            <div class="hint" id="settings-install-status">Installer status: ready.</div>
          </article>
        </div>
        <div class="settings-overlay-subpanel" data-settings-subpanel="ffmpeg">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>FFmpeg Path</h4>
            <div class="hint">Leave empty to auto-detect FFmpeg from PATH, common install folders, or the winget install location.</div>
            <div class="field">
              <label for="quick-ffmpeg-executable-path-input">FFmpeg Executable Path</label>
              <input id="quick-ffmpeg-executable-path-input" placeholder="C:\Program Files\Gyan\FFmpeg\bin\ffmpeg.exe or ffmpeg">
            </div>
            <div class="row">
              <button id="quick-save-ffmpeg-settings-button" type="button">Save FFmpeg Path</button>
              <button class="secondary" id="quick-install-ffmpeg-button" type="button">Download FFmpeg</button>
            </div>
            <div class="hint" id="quick-ffmpeg-settings-status">FFmpeg path not loaded yet.</div>
          </article>
        </div>
        <div class="settings-overlay-subpanel" data-settings-subpanel="comfyui">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>ComfyUI Runtime</h4>
            <div class="hint">The dashboard starts only the batch file you select. Keep <code>--listen 127.0.0.1</code> for a ComfyUI instance used only by this PC’s dashboard.</div>
            <div class="field"><label for="comfy-runtime-root-input">ComfyUI launcher folder</label><div class="row"><input id="comfy-runtime-root-input" placeholder="Choose the folder containing venv and ComfyUI"><button class="secondary" id="comfy-runtime-browse-folder-button" type="button">Browse</button></div></div>
            <div class="field"><label for="comfy-runtime-launcher-input">Launcher batch file</label><div class="row"><input id="comfy-runtime-launcher-input" value="scripts/comfyui/run-comfyui.bat" placeholder="scripts/comfyui/run-comfyui.bat"><button class="secondary" id="comfy-runtime-browse-launcher-button" type="button">Browse</button></div><div class="hint">Default: bundled launcher. Choose a custom <code>.bat</code> or <code>.cmd</code> file to override it.</div></div>
            <div class="row"><button class="secondary" id="comfy-runtime-install-button" type="button">Install / repair ComfyUI</button><button class="secondary" id="comfy-runtime-create-launchers-button" type="button">Create URage launcher batches</button><button id="comfy-runtime-save-button" type="button">Save runtime</button></div>
            <div class="row"><button id="comfy-runtime-start-button" type="button">Start ComfyUI</button><button class="secondary" id="comfy-runtime-stop-button" type="button">Stop ComfyUI</button><button class="secondary" id="comfy-runtime-refresh-button" type="button">Refresh status</button></div>
            <div class="comfy-runtime-progress" id="comfy-runtime-progress" aria-live="polite"><div class="comfy-runtime-progress-bar"><span id="comfy-runtime-progress-fill"></span></div><strong id="comfy-runtime-progress-label">Waiting to start.</strong><pre id="comfy-runtime-output">No ComfyUI output yet.</pre></div>
            <div class="hint" id="comfy-runtime-status">ComfyUI runtime not loaded yet.</div>
          </article>
        </div>
        <div class="settings-overlay-subpanel" data-settings-subpanel="workflows">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>Comfy Workflow Paths</h4>
            <div class="hint">Use relative paths from the workspace root, for example <code>${comfyWorkflowPaths.image.generate}</code>.</div>
            <div class="field">
              <label for="quick-comfy-input-dir-input">ComfyUI Input Directory</label>
              <input id="quick-comfy-input-dir-input" placeholder="data/comfyui/input">
            </div>
            <div class="field">
              <label for="quick-comfy-model-workflow-path-input">3D Workflow Path</label>
              <input id="quick-comfy-model-workflow-path-input" placeholder="${comfyWorkflowPaths.model3d.primary}">
            </div>
            <div class="field">
              <label for="quick-comfy-image-workflow-path-input">Image Workflow Path</label>
              <input id="quick-comfy-image-workflow-path-input" placeholder="${comfyWorkflowPaths.image.generate}">
            </div>
            <div class="field">
              <label for="quick-comfy-image-edit-workflow-path-input">Image Edit Workflow Path</label>
              <input id="quick-comfy-image-edit-workflow-path-input" placeholder="${comfyWorkflowPaths.image.edit}">
            </div>
            <div class="field">
              <label for="quick-comfy-image-upscale-workflow-path-input">Image Upscale Workflow Path</label>
              <input id="quick-comfy-image-upscale-workflow-path-input" placeholder="${comfyWorkflowPaths.image.upscale}">
            </div>
            <div class="field">
              <label for="quick-comfy-image-layered-workflow-path-input">Image Layers Workflow Path</label>
              <input id="quick-comfy-image-layered-workflow-path-input" placeholder="${comfyWorkflowPaths.image.layered}">
            </div>
            <div class="field">
              <label for="quick-comfy-audio-workflow-path-input">Audio Workflow Path</label>
              <input id="quick-comfy-audio-workflow-path-input" placeholder="${comfyWorkflowPaths.audio.generate}">
            </div>
            <div class="field">
              <label for="quick-comfy-music-workflow-path-input">Music Workflow Path</label>
              <input id="quick-comfy-music-workflow-path-input" placeholder="${comfyWorkflowPaths.music.generate}">
            </div>
            <div class="field">
              <label for="quick-comfy-video-workflow-path-input">Video Workflow Path</label>
              <input id="quick-comfy-video-workflow-path-input" placeholder="${comfyWorkflowPaths.video.generate}">
            </div>
            <div class="row">
              <button id="quick-save-comfy-path-settings-button" type="button">Save Workflow Paths</button>
              <button class="secondary" id="quick-reload-comfy-path-settings-button" type="button">Reload Saved Paths</button>
            </div>
            <div class="hint" id="quick-comfy-path-settings-status">Workflow paths not loaded yet.</div>
          </article>
        </div>
        <div class="settings-overlay-subpanel" data-settings-subpanel="messengers">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>Messenger Startup</h4>
            <div class="hint">Messenger bots are owned by the dashboard runtime. The separate headless server never starts them automatically, which prevents duplicate bot sessions and misleading status.</div>
            <label class="check-row" for="settings-discord-runtime-autostart">
              <input id="settings-discord-runtime-autostart" type="checkbox">
              <span>Start Discord automatically when the dashboard starts</span>
            </label>
            <div class="row">
              <button id="settings-save-discord-runtime-autostart" type="button">Save Startup Preference</button>
              <button class="secondary" id="settings-open-runtime-control" type="button">Open Runtime Control</button>
            </div>
            <div class="hint" id="settings-messenger-autostart-status">Discord autostart is off by default.</div>
          </article>
        </div>
        </section>
        <section class="settings-overlay-tab-panel" data-settings-panel="network">
          <div class="dashboard-tabs settings-overlay-subtabs network-settings-subtabs" role="tablist" aria-label="Network settings sections">
            <button class="ghost active" data-network-settings-subtab="connection" type="button">Connection</button>
            <button class="ghost" data-network-settings-subtab="remote-access" type="button">Remote Access</button>
            <button class="ghost" data-network-settings-subtab="devices" type="button">Devices</button>
          </div>
          <div class="network-settings-subpanel active" data-network-settings-subpanel="connection">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>Dashboard Network Access</h4>
            <div class="hint">Use LAN mode for the Android companion. The dashboard can detect this PC's addresses, save the durable configuration, and apply it without a manual restart.</div>
            <div class="settings-list" id="network-readiness-checks" aria-live="polite"><span class="hint">Checking the current listener and network interfaces...</span></div>
            <div class="field">
              <label for="network-dashboard-mode">Access Mode</label>
              <select id="network-dashboard-mode"><option value="local">This PC</option><option value="lan">Another PC on this network</option><option value="internet">Internet server (HTTPS)</option></select>
              <div class="hint">This describes where this dashboard server is hosted. Internet mode enables the API listener but requires an HTTPS public URL; it does not create a reverse proxy or open router ports for you.</div>
            </div>
            <div class="field">
              <label for="network-interface-select">Detected Address</label>
              <select id="network-interface-select"><option value="">Detecting network interfaces...</option></select>
              <div class="hint">Choose the private Wi-Fi or Ethernet address shared with the phone. VPN and virtual adapter addresses usually should not be used.</div>
            </div>
            <div class="field">
              <label for="network-dashboard-public-url">Dashboard Public URL</label>
              <input id="network-dashboard-public-url" placeholder="http://192.168.1.20:4782">
            </div>
            <div class="field">
              <label for="network-companion-certificate-pin">Companion HTTPS Certificate SHA-256</label>
              <input id="network-companion-certificate-pin" placeholder="sha256/base64-pin or hexadecimal fingerprint">
              <div class="hint">Optional additional leaf-certificate pin advertised during LAN discovery. Android still requires a normally trusted certificate and valid hostname.</div>
            </div>
            <div class="field">
              <label for="network-dashboard-token">Dashboard Access Token</label>
              <input id="network-dashboard-token" type="password" autocomplete="new-password" placeholder="Keep the current token">
              <div class="hint">Protects other dashboard API access. Android receives its own revocable device token when pairing.</div>
            </div>
            <div class="field">
              <label for="network-dashboard-allowed-clients">Allowed Machines / IPs</label>
              <textarea id="network-dashboard-allowed-clients" rows="3" placeholder="192.168.1.21, 192.168.1.0/24"></textarea>
              <div class="hint">Use comma-separated exact IPs, IPv6 addresses, or IPv4 CIDR ranges. Leave empty to allow any client that has the token.</div>
            </div>
            <div class="field">
              <label for="network-worker-url">Remote Worker URL</label>
              <input id="network-worker-url" placeholder="http://192.168.1.30:5581">
            </div>
            <div class="row">
              <button class="secondary" id="network-detect-button" type="button"><i class="bi bi-radar" aria-hidden="true"></i><span>Detect This PC</span></button>
              <button class="secondary" id="network-use-recommended-button" type="button"><i class="bi bi-wifi" aria-hidden="true"></i><span>Use Recommended</span></button>
              <button class="secondary" id="network-generate-token-button" type="button"><i class="bi bi-key" aria-hidden="true"></i><span>Generate Token</span></button>
              <button class="secondary" id="network-copy-token-button" type="button"><i class="bi bi-clipboard-check" aria-hidden="true"></i><span>Copy Token</span></button>
              <button class="secondary" id="network-show-token-qr-button" type="button" aria-expanded="false"><i class="bi bi-qr-code" aria-hidden="true"></i><span>Show Token QR</span></button>
              <button class="secondary" id="network-register-urage-now-protocol-button" type="button"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i><span>Enable URage NOW links</span></button>
              <button class="secondary" id="network-test-urage-now-protocol-button" type="button"><i class="bi bi-activity" aria-hidden="true"></i><span>Test URage NOW link</span></button>
              <button id="network-save-apply-button" type="button"><i class="bi bi-check2-circle" aria-hidden="true"></i><span>Save &amp; Apply</span></button>
              <button class="secondary" id="network-copy-env-button" type="button">Copy Network Config</button>
            </div>
            <div class="network-token-qr" id="network-dashboard-token-qr" hidden>
              <img alt="QR code containing the dashboard access token" width="240" height="240">
              <span><strong>Dashboard access token</strong><small>This QR contains the durable dashboard password, not a one-use Android pairing token. Scan it only on a trusted network and hide it when finished.</small></span>
            </div>
            <div class="hint" id="network-settings-status" aria-live="polite">No network changes pending.</div>
            <pre class="output" id="network-config-preview">Choose a mode to generate the environment configuration.</pre>
            <div class="field">
              <label>Windows Firewall (if discovery still fails)</label>
              <div class="hint">Run these commands in an Administrator terminal on the dashboard PC. They only open the dashboard and discovery ports on Private networks.</div>
              <div class="row"><button class="secondary" id="network-copy-firewall-button" type="button"><i class="bi bi-clipboard" aria-hidden="true"></i><span>Copy Firewall Commands</span></button></div>
              <pre class="output" id="network-firewall-preview">Detect this PC to generate commands.</pre>
            </div>
          </article>
          </div>
          <div class="network-settings-subpanel" data-network-settings-subpanel="remote-access">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>Remote Access Policy</h4>
            <div class="hint">Permissions are capability-based so allowing one upload action cannot accidentally authorize every POST endpoint. Existing paired devices inherit these defaults unless you save an explicit device override.</div>
            <details class="network-settings-accordion" open>
              <summary>Default media permissions</summary>
              <div class="network-permission-grid">
                <label><input type="checkbox" data-companion-default-permission="media.list"><span><strong>Browse media</strong><small>GET · list bounded gallery pages</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="media.download"><span><strong>Download media</strong><small>GET · files and thumbnails</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="media.upload"><span><strong>Upload media</strong><small>POST / PATCH · resumable transfers</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="media.metadata.update"><span><strong>Change metadata</strong><small>UPDATE (PATCH / PUT) · uploaded titles</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="media.delete"><span><strong>Delete media</strong><small>DELETE · generated or uploaded media</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="workflow.chat"><span><strong>Use Chat Studio</strong><small>POST · submit prompts and receive replies</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="workflow.image.generate"><span><strong>Generate images</strong><small>POST · run Image Studio prompt workflows</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="workflow.audio.generate"><span><strong>Generate audio</strong><small>POST · run Audio Studio sound workflows</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="workflow.music.generate"><span><strong>Generate music</strong><small>POST · run Music Studio song workflows</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="workflow.video.generate"><span><strong>Generate videos</strong><small>POST · run Video Studio prompt workflows</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="workflow.model3d.generate"><span><strong>Generate 3D models</strong><small>POST · run prompt-to-image-to-3D workflows</small></span></label>
                <label><input type="checkbox" data-companion-default-permission="application.3d-print.launch"><span><strong>Open 3D models in Bambu Studio</strong><small>POST · launches the configured desktop slicer on this dashboard host</small></span></label>
              </div>
              <div class="row">
                <button id="network-save-default-permissions-button" type="button"><i class="bi bi-shield-check" aria-hidden="true"></i><span>Save Defaults</span></button>
                <button class="secondary" id="network-refresh-access-policy-button" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i><span>Reload Policy</span></button>
              </div>
              <div class="hint" id="network-access-policy-status" aria-live="polite">Policy not loaded yet.</div>
            </details>
            <details class="network-settings-accordion">
              <summary>How HTTP methods map to permissions</summary>
              <div class="hint">GET is split into browse and download. POST/PATCH upload chunks require Upload. PATCH/PUT metadata requires Change metadata. DELETE always requires Delete media. Dashboard-browser sessions remain full dashboard sessions; these controls govern paired companion devices.</div>
            </details>
          </article>
          </div>
          <div class="network-settings-subpanel" data-network-settings-subpanel="devices">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>Paired Devices</h4>
            <details class="network-settings-accordion" open>
              <summary>Pair an Android companion</summary>
              <div class="hint">Keep both devices on the same trusted network. Pairing codes are short-lived and each phone receives an independently revocable token.</div>
              <div class="row">
                <button class="secondary" id="network-companion-pairing-code-button" type="button"><i class="bi bi-qr-code" aria-hidden="true"></i><span>Create Pairing QR</span></button>
                <a class="secondary" href="/android-companion" target="_blank" rel="noopener"><i class="bi bi-android2" aria-hidden="true"></i><span>Download Android App</span></a>
                <strong class="chip" id="network-companion-pairing-code" aria-live="polite">No active code shown</strong>
              </div>
              <div class="companion-pairing-qr" id="network-companion-pairing-qr" hidden>
                <img alt="One-scan Android companion pairing code" width="240" height="240">
                <span>Scan with the phone camera. The signed app opens with this dashboard address and one-time token already filled in.</span>
              </div>
              <div class="hint" id="network-companion-pairing-expiry"></div>
            </details>
            <details class="network-settings-accordion" open>
              <summary>Device-specific permissions</summary>
              <div class="row">
                <button class="secondary" id="network-companion-devices-refresh-button" type="button"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i><span>Refresh Devices</span></button>
              </div>
              <div class="settings-list" id="network-companion-devices" aria-live="polite"><span class="hint">Load paired devices to review permissions or revoke access.</span></div>
            </details>
            <details class="network-settings-accordion">
              <summary>Policy backup and access audit</summary>
              <div class="row">
                <a class="secondary" href="/api/companion/access-policy/export" download><i class="bi bi-download" aria-hidden="true"></i><span>Export Policy</span></a>
                <button class="secondary" id="network-import-access-policy-button" type="button"><i class="bi bi-upload" aria-hidden="true"></i><span>Import Policy</span></button>
                <input id="network-import-access-policy-input" type="file" accept="application/json,.json" hidden>
                <button class="secondary" id="network-refresh-access-audit-button" type="button"><i class="bi bi-journal-text" aria-hidden="true"></i><span>Refresh Audit</span></button>
              </div>
              <div class="settings-list companion-access-audit" id="network-companion-access-audit" aria-live="polite"><span class="hint">Load recent device access decisions and policy changes.</span></div>
            </details>
          </article>
          </div>
        </section>
        <section class="settings-overlay-tab-panel" data-settings-panel="ui">
          <article class="status-card settings-overlay-card settings-subtab-card">
            <h4>Sidebar Behaviour</h4>
            <div class="hint">Hover navigation is off by default, so rail categories stay stable. Enable it only if you prefer hover-driven category previews.</div>
            <div class="field">
              <label for="settings-sidebar-hover-mode-select">Rail Category Hover</label>
              <select id="settings-sidebar-hover-mode-select">
                <option value="off">Off (stable rail)</option>
                <option value="temp-expand">Temp Expand</option>
                <option value="collapse-expand">Collapse+Expand</option>
                <option value="collapse-expand-keep-others">Collapse+Expand (keep others)</option>
              </select>
            </div>
            <div class="hint">Temp Expand previews a category without changing the selected view. Collapse+Expand also activates that category. The keep-others mode leaves other accordions open and a second click on a category collapses it.</div>
          </article>
        </section>
        <section class="settings-overlay-tab-panel" data-settings-panel="themes">
          <div class="settings-overlay-grid overlay-manager-grid">
            <article class="status-card settings-overlay-card overlay-manager-sidebar-card theme-manager-sidebar-card">
              <h4>Theme Manager</h4>
              <div class="dashboard-tabs theme-manager-group-tabs" role="tablist" aria-label="Theme groups">
                ${dashboardThemeGroups.map((group, index) => `<button class="ghost${index === 0 ? " active" : ""}" data-theme-manager-group="${group.id}" type="button">${group.label}</button>`).join("")}
              </div>
              <div class="theme-manager-meta-list">
                <div><strong>Total Themes</strong><span>${dashboardThemes.length}</span></div>
                <div><strong>Default</strong><span>${dashboardThemes.find(theme => theme.id === defaultDashboardTheme)?.label || "URage"}</span></div>
                <div><strong>Config</strong><span><code>dashboard/dashboard-theme-studio.json</code></span></div>
              </div>
              <div class="theme-appearance-controls">
                <h4>Appearance</h4>
                <label class="field theme-radius-field theme-appearance-range-field" for="dashboard-border-radius-input">
                  <span>Border Radius</span>
                  <input id="dashboard-border-radius-input" type="range" min="0" max="18" step="1" value="0">
                </label>
                <div class="theme-appearance-value" id="dashboard-border-radius-value">0px</div>
                <div class="theme-appearance-global-grid">
                  <label class="field theme-appearance-range-field" for="dashboard-padding-input">
                    <span>Padding</span>
                    <input id="dashboard-padding-input" type="range" min="0" max="28" step="1" value="0">
                  </label>
                  <div class="theme-appearance-value" id="dashboard-padding-value">0px</div>
                  <label class="field theme-appearance-range-field" for="dashboard-margin-input">
                    <span>Margin</span>
                    <input id="dashboard-margin-input" type="range" min="0" max="28" step="1" value="0">
                  </label>
                  <div class="theme-appearance-value" id="dashboard-margin-value">0px</div>
                </div>
                <div class="theme-appearance-component-heading">
                  <span>Component Overrides</span>
                  <small>${dashboardAppearanceComponentOptions.length} components</small>
                </div>
                <div class="theme-appearance-component-list">
                  ${dashboardAppearanceComponentOptions.map(([componentLabel, key], index) => renderAppearanceComponentFoldout(componentLabel, key, index === 0)).join("")}
                </div>
                <div class="row theme-appearance-actions">
                  <button class="secondary mini-button" id="dashboard-border-radius-reset-button" type="button">Reset Appearance</button>
                </div>
                <div class="hint" id="dashboard-appearance-status">Appearance settings loaded locally.</div>
              </div>
            </article>
            <article class="status-card settings-overlay-card overlay-manager-main-card theme-manager-grid-card">
              <div class="theme-manager-grid">
                ${dashboardThemes.map(renderThemeManagerCard).join("\n")}
              </div>
            </article>
          </div>
        </section>
        <div class="row settings-overlay-footer">
          <button class="secondary" id="open-full-settings-view-button" type="button">Open Studio View</button>
          <button class="secondary" id="close-settings-overlay-footer-button" type="button">Close</button>
        </div>
      </div>
    </div>

    <div class="runtime-overlay hidden settings-overlay about-overlay" id="about-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="about-overlay-backdrop" aria-label="Close about"></button>
      <div class="runtime-overlay-panel settings-overlay-panel about-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">ABOUT URage NOW</div>
            <h3>How The Studio Works</h3>
            <p class="about-subtitle">From idea to output. Five simple steps.</p>
          </div>
          <button class="ghost compact" id="close-about-overlay-button" aria-label="Close about">${renderBootstrapIcon("x-lg")}</button>
        </div>

        <!-- Top workflow timeline -->
        <div class="about-timeline">
          <div class="about-timeline-step active" data-about-phase="input">
            ${renderBootstrapIcon("chat-dots", "about-timeline-icon")}
            <span class="about-timeline-label">INPUT</span>
            <span class="about-timeline-desc">Start with your idea</span>
          </div>
          ${renderBootstrapIcon("arrow-right", "about-timeline-arrow")}
          <div class="about-timeline-step" data-about-phase="process">
            ${renderBootstrapIcon("cpu", "about-timeline-icon")}
            <span class="about-timeline-label">PROCESS</span>
            <span class="about-timeline-desc">We handle the heavy lifting</span>
          </div>
          ${renderBootstrapIcon("arrow-right", "about-timeline-arrow")}
          <div class="about-timeline-step" data-about-phase="results">
            ${renderBootstrapIcon("bullseye", "about-timeline-icon")}
            <span class="about-timeline-label">RESULTS</span>
            <span class="about-timeline-desc">Preview and refine</span>
          </div>
          ${renderBootstrapIcon("arrow-right", "about-timeline-arrow")}
          <div class="about-timeline-step" data-about-phase="reuse">
            ${renderBootstrapIcon("recycle", "about-timeline-icon")}
            <span class="about-timeline-label">REUSE</span>
            <span class="about-timeline-desc">Share or build on it</span>
          </div>
        </div>

        <!-- Main workflow panels -->
        <div class="about-workflow-grid">
          <!-- Panel 1: Pick A Studio -->
          <article class="about-panel about-panel-active" data-about-step="1">
            <div class="about-panel-number">1</div>
            <div class="about-panel-icon">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5">
                <!-- Chat bubble -->
                <path d="M8 16c0-2 2-4 4-4h20c2 0 4 2 4 4v12c0 2-2 4-4 4H24l-8 8V16z"/>
                <!-- Music note -->
                <path d="M36 28c0-1.5 1-3 3-3s3 1.5 3 3v8m-3-8c0-1.5 1-3 3-3s3 1.5 3 3v8" stroke-linecap="round"/>
              </svg>
            </div>
            <h4 class="about-panel-title">Pick A Studio</h4>
            <p class="about-panel-desc">Choose the studio for your creative task. Each one has dedicated tools.</p>
            <div class="about-panel-tags">
              <span class="about-tag">${renderBootstrapIcon("chat-dots")}Chat</span>
              <span class="about-tag">${renderBootstrapIcon("image")}Image</span>
              <span class="about-tag">${renderBootstrapIcon("box")}3D</span>
              <span class="about-tag">${renderBootstrapIcon("soundwave")}Audio</span>
              <span class="about-tag">${renderBootstrapIcon("camera-video")}Video</span>
            </div>
          </article>

          <!-- Panel 2: Prepare Inputs -->
          <article class="about-panel" data-about-step="2">
            <div class="about-panel-number">2</div>
            <div class="about-panel-icon">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5">
                <!-- Document with upload arrow -->
                <path d="M12 18h24l-4-8H16c-2 0-4 2-4 4z"/>
                <rect x="10" y="18" width="36" height="32" rx="4"/>
                <path d="M22 30h14m-14 8h10"/>
                <path d="M32 38l4 6-4 6" stroke-linecap="round"/>
              </svg>
            </div>
            <h4 class="about-panel-title">Prepare Inputs</h4>
            <p class="about-panel-desc">Add your prompts, uploads and other files. Everything stays local.</p>
            <div class="about-panel-section">
              <span class="about-section-label">EXAMPLES</span>
              <ul class="about-list">
                <li>${renderBootstrapIcon("file-earmark-text")}Prompt.txt</li>
                <li>${renderBootstrapIcon("file-earmark-image")}Image.png</li>
                <li>${renderBootstrapIcon("box")}Model.safetensors</li>
                <li>${renderBootstrapIcon("diagram-3")}Workflow.json</li>
              </ul>
            </div>
          </article>

          <!-- Panel 3: Run Local Engines -->
          <article class="about-panel" data-about-step="3">
            <div class="about-panel-number">3</div>
            <div class="about-panel-icon">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5">
                <!-- Chip with play -->
                <rect x="18" y="14" width="28" height="36" rx="4"/>
                <circle cx="32" cy="32" r="8"/>
                <path d="M30 28l6 4-6 4z" fill="currentColor"/>
                <path d="M14 22h4m28 0h4m-4 16h4m-28 0h4"/>
              </svg>
            </div>
            <h4 class="about-panel-title">Run Local Engines</h4>
            <p class="about-panel-desc">Rod talks to the selected LLM and ComfyUI endpoint using your workflow paths.</p>
            <div class="about-panel-section">
              <span class="about-section-label">WHAT HAPPENS</span>
              <ul class="about-list about-check-list">
                <li>${renderBootstrapIcon("check-lg")}Loads workflow</li>
                <li>${renderBootstrapIcon("check-lg")}Runs ComfyUI</li>
                <li>${renderBootstrapIcon("check-lg")}Generates outputs</li>
                <li>${renderBootstrapIcon("check-lg")}Saves locally</li>
              </ul>
            </div>
          </article>

          <!-- Panel 4: Preview Results -->
          <article class="about-panel" data-about-step="4">
            <div class="about-panel-number">4</div>
            <div class="about-panel-icon">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5">
                <!-- Image with eye -->
                <rect x="8" y="12" width="32" height="24" rx="4"/>
                <circle cx="18" cy="22" r="3"/>
                <path d="M8 30l8-6 6 4 8-8 4 6"/>
                <circle cx="48" cy="42" r="10"/>
                <path d="M44 42h8m-4-4v8"/>
              </svg>
            </div>
            <h4 class="about-panel-title">Preview Results</h4>
            <p class="about-panel-desc">Generated images, audio, videos and models appear in the studio history.</p>
            <div class="about-panel-section">
              <span class="about-section-label">EXAMPLES</span>
              <ul class="about-list about-check-list">
                <li>${renderBootstrapIcon("image")}image_001.png ${renderBootstrapIcon("check-circle-fill", "about-list-success")}</li>
                <li>${renderBootstrapIcon("camera-video")}video_001.mp4 ${renderBootstrapIcon("check-circle-fill", "about-list-success")}</li>
                <li>${renderBootstrapIcon("box")}model_001.glb ${renderBootstrapIcon("check-circle-fill", "about-list-success")}</li>
              </ul>
            </div>
          </article>

          <!-- Panel 5: Export & Reuse -->
          <article class="about-panel" data-about-step="5">
            <div class="about-panel-number">5</div>
            <div class="about-panel-icon">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5">
                <!-- Export arrow -->
                <rect x="18" y="30" width="28" height="20" rx="4"/>
                <path d="M32 30V14m0 0l-6 6m6-6l6 6"/>
              </svg>
            </div>
            <h4 class="about-panel-title">Export & Reuse</h4>
            <p class="about-panel-desc">Send outputs to others, use in 3D tools, or continue the workflow.</p>
            <div class="about-panel-section">
              <span class="about-section-label">OPTIONS</span>
              <ul class="about-list about-check-list">
                <li>${renderBootstrapIcon("send")}Send to Messenger</li>
                <li>${renderBootstrapIcon("download")}Export Files</li>
                <li>${renderBootstrapIcon("box-arrow-in-right")}Import to 3D App</li>
                <li>${renderBootstrapIcon("arrow-repeat")}Continue Workflow</li>
              </ul>
            </div>
          </article>
        </div>

        <!-- Example run section -->
        <div class="about-example-run">
          <div class="about-example-header">
            ${renderBootstrapIcon("stars")}
            <span class="about-example-label">EXAMPLE RUN</span>
          </div>
          <p class="about-example-subtitle">See it in action</p>
          <div class="about-example-flow">
            <div class="about-example-step">
              <span class="about-example-step-label">Prompt</span>
              <span class="about-example-step-value">"A cyberpunk city at sunset"</span>
            </div>
            ${renderBootstrapIcon("arrow-right", "about-example-arrow")}
            <div class="about-example-step">
              <span class="about-example-step-label">Studio</span>
              <span class="about-example-step-value">${renderBootstrapIcon("image")}Image</span>
            </div>
            ${renderBootstrapIcon("arrow-right", "about-example-arrow")}
            <div class="about-example-step">
              <span class="about-example-step-label">Model</span>
              <span class="about-example-step-value">${renderBootstrapIcon("box")}SDXL</span>
            </div>
            ${renderBootstrapIcon("arrow-right", "about-example-arrow")}
            <div class="about-example-step">
              <span class="about-example-step-label">Generate</span>
              <span class="about-example-step-value">${renderBootstrapIcon("play-circle")}</span>
            </div>
            ${renderBootstrapIcon("arrow-right", "about-example-arrow")}
            <div class="about-example-step about-example-output">
              <span class="about-example-step-label">Output</span>
              <span class="about-example-step-value">city.png</span>
            </div>
            ${renderBootstrapIcon("arrow-right", "about-example-arrow")}
            <div class="about-example-step">
              <span class="about-example-step-label">Reuse</span>
              <span class="about-example-step-value">Convert to 3D asset ${renderBootstrapIcon("box")}</span>
            </div>
          </div>
        </div>

        <!-- Tip footer -->
        <p class="about-tip">
          ${renderBootstrapIcon("lightbulb")}
          Tip: You can always switch studios or run steps in any order.
        </p>
      </div>
    </div>

    <div class="runtime-overlay hidden" id="runtime-overlay" aria-hidden="true">
      <button class="runtime-overlay-backdrop" id="runtime-overlay-backdrop" aria-label="Close runtime controls"></button>
      <div class="runtime-overlay-panel">
        <div class="runtime-overlay-header">
          <div class="runtime-overlay-title-wrap">
            <div class="panel-kicker">Runtime Control</div>
            <h3 id="runtime-overlay-title">Messenger Runtime</h3>
          </div>
          <button class="ghost compact" id="close-runtime-overlay-button" aria-label="Close runtime controls">&#10005;</button>
        </div>
        <div class="status-card messenger-runtime-card" id="bot-status">
          <div class="messenger-runtime-head">
            <span class="messenger-runtime-label" id="messenger-runtime-label">Discord Runtime</span>
            <span class="messenger-runtime-state is-stopped" id="messenger-runtime-state">Stopped</span>
          </div>
          <div class="messenger-runtime-progress" id="messenger-runtime-progress-track" role="progressbar" aria-label="Selected messenger runtime status" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <span class="messenger-runtime-progress-fill" id="messenger-runtime-progress-fill"></span>
          </div>
          <div class="messenger-runtime-meta" id="messenger-runtime-meta">Waiting for runtime updates...</div>
          <div class="messenger-runtime-launch-config">
            <div class="chat-composer-grid">
              <div class="field">
                <label for="messenger-runtime-credential-source">Credential Source</label>
                <select id="messenger-runtime-credential-source">
                  <option value="default">Current User Credentials</option>
                  <option value="safe-file">Safe Env File</option>
                  <option value="manual">Manual Entry</option>
                </select>
              </div>
              <div class="field">
                <label for="messenger-runtime-shared-path-input">Safe Env File Path</label>
                <input id="messenger-runtime-shared-path-input" type="text" placeholder="C:\Safe\messenger-runtime.env">
              </div>
              <button class="secondary" id="messenger-runtime-save-shared-path-button" type="button">Save Runtime Settings</button>
            </div>
            <div class="messenger-runtime-launch-note" id="messenger-runtime-launch-note">Current User Credentials uses the OS credential store, with environment variables as service overrides. Safe Env File reads a shared .env-style file with messenger credentials.</div>
            <div class="messenger-runtime-launch-source" id="messenger-runtime-launch-source">Selected source: Current User Credentials</div>
            <label class="check-row" for="messenger-runtime-autostart-checkbox">
              <input id="messenger-runtime-autostart-checkbox" type="checkbox">
              <span id="messenger-runtime-autostart-label">Start Discord automatically with the dashboard runtime</span>
            </label>
            <div class="hint">The separate headless server batch never autostarts messenger bots. This avoids duplicate clients and keeps the dashboard runtime status authoritative.</div>
            <div class="messenger-runtime-manual-grid hidden" id="messenger-runtime-manual-discord">
              <div class="field">
                <label for="messenger-runtime-discord-token-input">Discord Bot Token</label>
                <input id="messenger-runtime-discord-token-input" type="password" placeholder="Bot token">
              </div>
            </div>
            <div class="messenger-runtime-manual-grid hidden" id="messenger-runtime-manual-telegram">
              <div class="field">
                <label for="messenger-runtime-telegram-token-input">Telegram Bot Token</label>
                <input id="messenger-runtime-telegram-token-input" type="password" placeholder="Telegram bot token">
              </div>
            </div>
            <div class="messenger-runtime-manual-grid hidden" id="messenger-runtime-manual-matrix">
              <div class="field">
                <label for="messenger-runtime-matrix-homeserver-input">Matrix Homeserver URL</label>
                <input id="messenger-runtime-matrix-homeserver-input" type="text" placeholder="https://matrix.example.com">
              </div>
              <div class="field">
                <label for="messenger-runtime-matrix-token-input">Matrix Access Token</label>
                <input id="messenger-runtime-matrix-token-input" type="password" placeholder="Matrix access token">
              </div>
              <div class="field">
                <label for="messenger-runtime-matrix-user-id-input">Matrix Bot User ID</label>
                <input id="messenger-runtime-matrix-user-id-input" type="text" placeholder="@bot:example.com">
              </div>
            </div>
            <div class="messenger-runtime-manual-grid hidden" id="messenger-runtime-manual-whatsapp">
              <div class="field">
                <label for="messenger-runtime-whatsapp-token-input">WhatsApp Access Token</label>
                <input id="messenger-runtime-whatsapp-token-input" type="password" placeholder="WhatsApp access token">
              </div>
              <div class="field">
                <label for="messenger-runtime-whatsapp-phone-id-input">Phone Number ID</label>
                <input id="messenger-runtime-whatsapp-phone-id-input" type="text" placeholder="WhatsApp phone number ID">
              </div>
              <div class="field">
                <label for="messenger-runtime-whatsapp-api-version-input">API Version</label>
                <input id="messenger-runtime-whatsapp-api-version-input" type="text" placeholder="v22.0">
              </div>
            </div>
          </div>
          <div class="row compact messenger-runtime-actions">
            <button class="secondary" id="messenger-runtime-start-button">Start</button>
            <button class="secondary" id="messenger-runtime-stop-button">Stop</button>
            <button class="secondary" id="messenger-runtime-restart-button">Restart</button>
          </div>
          <div class="row compact">
            <button class="secondary" id="messenger-runtime-refresh-readiness-button" type="button">Check Readiness</button>
            <div class="hint" id="messenger-runtime-readiness-status">Readiness has not been checked.</div>
          </div>
          <textarea class="messenger-runtime-history" id="messenger-runtime-history" readonly>Waiting for runtime updates...</textarea>
        </div>
      </div>
    </div>
  </main>

  <script type="importmap">
    {
      "imports": {
        "three": "/vendor/three/build/three.module.js",
        "three/addons/": "/vendor/three/examples/jsm/"
      }
    }
  </script>
  <script type="module">
    import * as THREE from "three";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
    import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
    import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";
    window.DiscrodThree = { THREE, GLTFLoader, FBXLoader, OBJLoader, RGBELoader, OrbitControls };
    window.dispatchEvent(new Event("discrod-three-ready"));
  </script>
  <script>${gifLibraryScript}</script>
  <!-- Theme configuration data for client modules -->
  <script>
    window.__DASHBOARD_THEMES_DATA__ = ${JSON.stringify(dashboardThemes.map(theme => ({
      id: theme.id,
      label: theme.label,
      group: theme.group,
      imagePath: theme.imagePath,
      swatchStart: theme.swatchStart,
      swatchEnd: theme.swatchEnd,
      swatchGlow: theme.swatchGlow,
      aliases: (theme as any).aliases || []
    })))};
    window.__DASHBOARD_THEME_ORDER__ = ${JSON.stringify(dashboardThemes.map(theme => theme.id))};
    window.__DEFAULT_DASHBOARD_THEME__ = ${JSON.stringify(defaultDashboardTheme)};
  </script>
  <script>${readEmbeddedScript("client/modules/dashboardThemeInit.js")}</script>
  <script>${clientScript}</script>
</body>
</html>`;
}
