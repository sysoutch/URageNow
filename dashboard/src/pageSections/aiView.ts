import { comfyWorkflowPaths } from "../shared/comfyWorkflowPaths.js";
import {
  type ButtonIconKey,
  type DashboardWorkflowIconKey,
  renderAssetsIcon,
  renderBlenderIconSvg,
  renderButtonIcon,
  renderDashboardNavigationIcon,
  renderToolsSearchIcon,
  renderToolsIcon,
  renderWorkflowIcon
} from "../shared/dashboardIcons.js";

interface DashboardAiViewInput {
  model3dInitialThreadExtraText: string;
  model3dDestinationExtraText: string;
}

interface StudioStatusPanelInput {
  statusKey: string;
  initialMessage: string;
  progressLabel: string;
}

interface StudioWorkflowTileInput {
  title: string;
  description: string;
  iconKey: DashboardWorkflowIconKey;
  styleKey: "chat" | "image" | "model3d" | "audio" | "music" | "video";
  scrollTarget: string;
}

type WorkflowSettingsButtonInput = {
  panel: string;
  title: string;
  kicker: string;
  label: string;
};

function renderStudioStatusPanel(input: StudioStatusPanelInput): string {
  return `
            <div class="field studio-status studio-component-status">
              <div class="studio-status-header">
                <span class="studio-status-state is-idle" id="${input.statusKey}-status-state">Idle</span>
              </div>
              <div class="studio-status-current hint" id="${input.statusKey}-status">${input.initialMessage}</div>
              <div class="studio-status-progress" id="${input.statusKey}-status-progress-track" role="progressbar" aria-label="${input.progressLabel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="studio-status-progress-fill" id="${input.statusKey}-status-progress"></span>
              </div>
              <textarea class="studio-status-history" id="${input.statusKey}-status-history" readonly>${input.initialMessage}</textarea>
            </div>`;
}

function renderWorkflowQuickTile(input: StudioWorkflowTileInput): string {
  return `
              <button class="studio-workflow-quick-tile is-${input.styleKey}" data-ai-scroll-target="${input.scrollTarget}" type="button" aria-label="Open ${input.title} Studio">
                <div class="studio-workflow-quick-tile-icon" aria-hidden="true">${renderWorkflowIcon(input.iconKey)}</div>
                <h4>${input.title}</h4>
                <div class="panel-subtitle">${input.description}</div>
              </button>`;
}

function renderWorkflowHomeButton(input: StudioWorkflowTileInput): string {
  return `
              <button class="lazydev-home-workflow-button is-${input.styleKey}" data-ai-scroll-target="${input.scrollTarget}" type="button">
                <span class="lazydev-home-workflow-icon" aria-hidden="true">${renderWorkflowIcon(input.iconKey)}</span>
                <span class="lazydev-home-workflow-copy"><strong>${input.title}</strong><small>${input.description}</small></span>
              </button>`;
}

function renderWorkflowSettingsFooter(buttons: WorkflowSettingsButtonInput[]): string {
  return `
            <div class="studio-workflow-settings-footer">
              <div class="studio-workflow-settings-footer-copy">
                <span class="studio-workflow-settings-footer-label">Workflow Settings</span>
                <span class="studio-workflow-settings-footer-hint">Open connection, path, and shared pool tools in focused overlay windows.</span>
              </div>
              <div class="row studio-workflow-settings-footer-actions">
                <button class="secondary studio-workflow-settings-button studio-workflow-settings-button-global" data-workflow-global-action="image-pools" type="button">${renderButtonIcon("folder")}<span>Image Pools</span></button>
                ${buttons.map(button => `
                  <button
                    class="secondary studio-workflow-settings-button"
                    data-workflow-settings-open="${button.panel}"
                    data-workflow-settings-title="${button.title}"
                    data-workflow-settings-kicker="${button.kicker}"
                    type="button"
                  >${renderButtonIcon("settings")}<span>${button.label}</span></button>`).join("")}
              </div>
            </div>`;
}

function renderWorkflowSettingsOverlay(): string {
  return `
        <div class="runtime-overlay hidden settings-overlay workflow-settings-overlay" id="workflow-settings-overlay" aria-hidden="true">
          <button class="runtime-overlay-backdrop" id="workflow-settings-overlay-backdrop" aria-label="Close workflow settings"></button>
          <div class="runtime-overlay-panel settings-overlay-panel workflow-settings-overlay-panel">
            <div class="runtime-overlay-header">
              <div class="runtime-overlay-title-wrap">
                <div class="panel-kicker" id="workflow-settings-overlay-kicker">Workflow Settings</div>
                <h3 id="workflow-settings-overlay-title">Connection And Path Settings</h3>
              </div>
              <button class="ghost compact" id="close-workflow-settings-overlay-button" aria-label="Close workflow settings">&#10005;</button>
            </div>
            <div class="settings-overlay-grid workflow-settings-overlay-grid">
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="ask-models">
                <h4>Model + Connection Settings</h4>
                <div class="field">
                  <label for="ollama-text-model-select">Rod Text Model</label>
                  <select id="ollama-text-model-select"></select>
                  <div class="row">
                    <button class="secondary" id="load-text-model-button">${renderButtonIcon("download")}<span>Load Text Model</span></button>
                  </div>
                </div>
                <div class="toggle">
                  <span>Text model is also visual model</span>
                  <input id="ollama-text-model-visual" type="checkbox">
                </div>
                <div class="field" id="ollama-vision-model-field">
                  <label for="ollama-vision-model-select">Rod Vision Model</label>
                  <select id="ollama-vision-model-select"></select>
                  <div class="row">
                    <button class="secondary" id="load-vision-model-button">${renderButtonIcon("download")}<span>Load Vision Model</span></button>
                  </div>
                </div>
                <div class="row">
                  <button id="refresh-ollama-models-button">${renderButtonIcon("refresh")}<span>Refresh LazyDev Models</span></button>
                  <button class="secondary" id="save-ollama-models-button">${renderButtonIcon("save")}<span>Save LazyDev Models</span></button>
                </div>
                <div class="hint" id="ollama-models-refresh-status">Rod models not loaded yet.</div>
                <div class="field">
                  <label for="llm-provider-select">LLM Provider</label>
                  <select id="llm-provider-select">
                    <option value="ollama">Ollama</option>
                    <option value="lmstudio">LM Studio</option>
                    <option value="llamacpp">llama.cpp</option>
                  </select>
                </div>
                <div class="field">
                  <label for="ollama-url-input">Ollama URL</label>
                  <input id="ollama-url-input" placeholder="http://127.0.0.1:11434">
                </div>
                <div class="field">
                  <label for="lmstudio-base-url-input">OpenAI-compatible Base URL</label>
                  <input id="lmstudio-base-url-input" placeholder="http://127.0.0.1:1234/v1">
                </div>
                <div class="field">
                  <label for="lmstudio-api-key-input">OpenAI-compatible API Key</label>
                  <input id="lmstudio-api-key-input" placeholder="lm-studio">
                </div>
                <div class="field">
                  <label for="lmstudio-context-length-input">LM Studio Context Length</label>
                  <input id="lmstudio-context-length-input" type="number" min="0" step="1" placeholder="0 = LM Studio default">
                  <div class="hint">Used when loading models from the dashboard. Set 0 to keep LM Studio's default context length.</div>
                </div>
                <div class="toggle">
                  <span>Enable LM Studio reasoning for text model requests</span>
                  <input id="lmstudio-text-reasoning-enabled" type="checkbox" checked>
                </div>
                <div class="row">
                  <button id="save-llm-connection-settings-button">${renderButtonIcon("save")}<span>Save LLM Connection</span></button>
                  <button class="secondary" id="reload-llm-connection-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved Connection</span></button>
                </div>
                <div class="hint">Use LAN host/IP URLs to run LLM on another machine. No remote worker is required for LLM-only networking.</div>
                <div class="hint" id="llm-connection-settings-status">LLM connection settings not loaded yet.</div>
              </article>
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="model3d-comfy">
                <h4>3D ComfyUI Endpoint + Path Settings</h4>
                <div class="field">
                  <label for="comfy-base-url-input">ComfyUI Default Base URL (fallback)</label>
                  <input id="comfy-base-url-input" placeholder="http://127.0.0.1:8188">
                </div>
                <div class="field">
                  <label for="comfy-model-base-url-input">3D Model ComfyUI Base URL</label>
                  <input id="comfy-model-base-url-input" placeholder="http://127.0.0.1:8188">
                </div>
                <div class="field">
                  <label for="comfy-input-dir-input">ComfyUI Input Directory</label>
                  <input id="comfy-input-dir-input" placeholder="data/comfyui/input">
                </div>
                <div class="field">
                  <label for="comfy-model-workflow-path-input">3D Workflow Path</label>
                  <input id="comfy-model-workflow-path-input" placeholder="${comfyWorkflowPaths.model3d.primary}">
                </div>
                <div class="row">
                  <button id="save-comfy-model-path-settings-button">${renderButtonIcon("save")}<span>Save 3D Comfy Settings</span></button>
                  <button class="secondary" id="reload-comfy-model-path-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved Settings</span></button>
                </div>
                <div class="hint">This section applies to 3D only. Configure other media studios in their own cards.</div>
                <div class="hint" id="comfy-model-path-settings-status">3D Comfy settings not loaded yet.</div>
              </article>
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="model3d-llm">
                <h4>3D LLM Connection Settings (Prompt + Filename)</h4>
                <div class="field">
                  <label for="model3d-llm-provider-select">3D LLM Provider</label>
                  <select id="model3d-llm-provider-select">
                    <option value="ollama">Ollama</option>
                    <option value="lmstudio">LM Studio</option>
                    <option value="llamacpp">llama.cpp</option>
                  </select>
                </div>
                <div class="field">
                  <label for="model3d-llm-text-model-select">3D LLM Text Model</label>
                  <select id="model3d-llm-text-model-select"></select>
                </div>
                <div class="field">
                  <label for="model3d-llm-vision-model-select">3D LLM Vision Model</label>
                  <select id="model3d-llm-vision-model-select"></select>
                </div>
                <div class="field">
                  <label for="model3d-ollama-url-input">3D Ollama URL</label>
                  <input id="model3d-ollama-url-input" placeholder="Leave empty to use Ask LazyDev global Ollama URL">
                </div>
                <div class="field">
                  <label for="model3d-lmstudio-base-url-input">3D LM Studio Base URL</label>
                  <input id="model3d-lmstudio-base-url-input" placeholder="Leave empty to use Ask LazyDev global LM Studio URL">
                </div>
                <div class="field">
                  <label for="model3d-lmstudio-api-key-input">3D LM Studio API Key</label>
                  <input id="model3d-lmstudio-api-key-input" placeholder="Leave empty to use Ask LazyDev global API key">
                </div>
                <div class="row">
                  <button id="save-model3d-llm-connection-settings-button">${renderButtonIcon("save")}<span>Save 3D LLM Connection</span></button>
                  <button class="secondary" id="reload-model3d-llm-connection-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved 3D LLM Connection</span></button>
                </div>
                <div class="hint" id="model3d-llm-connection-settings-status">3D LLM connection settings not loaded yet.</div>
              </article>
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="image-comfy">
                <h4>Separate Setting: Image ComfyUI Workflow</h4>
                <div class="studio-settings-eyebrow">ComfyUI workflow settings</div>
                <div class="hint">These settings only choose the ComfyUI server and workflow JSON. They do not change prompt presets or generation fields above.</div>
                <div class="field">
                  <label for="comfy-image-base-url-input">Image ComfyUI Base URL</label>
                  <input id="comfy-image-base-url-input" placeholder="http://127.0.0.1:8188">
                </div>
                <div class="field">
                  <label for="comfy-image-workflow-path-input">Image Workflow Path</label>
                  <input id="comfy-image-workflow-path-input" placeholder="${comfyWorkflowPaths.image.generate}">
                </div>
                <div class="field">
                  <label for="comfy-image-edit-workflow-path-input">Image Edit Workflow Path</label>
                  <input id="comfy-image-edit-workflow-path-input" placeholder="${comfyWorkflowPaths.image.edit}">
                  <div class="hint">Used when the image slash command or other bot flows include a base/source image.</div>
                </div>
                <div class="field">
                  <label for="comfy-image-upscale-workflow-path-input">Image Upscale Workflow Path</label>
                  <input id="comfy-image-upscale-workflow-path-input" placeholder="${comfyWorkflowPaths.image.upscale}">
                  <div class="hint">Used by the Upscale quick action to increase the resolution of an image.</div>
                </div>
                <div class="field">
                  <label for="comfy-image-layered-workflow-path-input">Image Layers Workflow Path</label>
                  <input id="comfy-image-layered-workflow-path-input" placeholder="${comfyWorkflowPaths.image.layered}">
                  <div class="hint">Used by the Layers quick action to split one source image into multiple separated outputs.</div>
                </div>
                <div class="row">
                  <button id="save-comfy-image-path-settings-button">${renderButtonIcon("save")}<span>Save Image Comfy Settings</span></button>
                  <button class="secondary" id="reload-comfy-image-path-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved Settings</span></button>
                </div>
                <div class="hint" id="comfy-image-path-settings-status">Image Comfy settings not loaded yet.</div>
              </article>
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="image-llm">
                <h4>Image LLM Connection Settings (Prompt + Filename)</h4>
                <div class="field">
                  <label for="image-llm-provider-select">Image LLM Provider</label>
                  <select id="image-llm-provider-select">
                    <option value="ollama">Ollama</option>
                    <option value="lmstudio">LM Studio</option>
                    <option value="llamacpp">llama.cpp</option>
                  </select>
                </div>
                <div class="field">
                  <label for="image-llm-text-model-select">Image LLM Text Model</label>
                  <select id="image-llm-text-model-select"></select>
                </div>
                <div class="field">
                  <label for="image-llm-vision-model-select">Image LLM Vision Model</label>
                  <select id="image-llm-vision-model-select"></select>
                </div>
                <div class="field">
                  <label for="image-ollama-url-input">Image Ollama URL</label>
                  <input id="image-ollama-url-input" placeholder="Leave empty to use Ask LazyDev global Ollama URL">
                </div>
                <div class="field">
                  <label for="image-lmstudio-base-url-input">Image LM Studio Base URL</label>
                  <input id="image-lmstudio-base-url-input" placeholder="Leave empty to use Ask LazyDev global LM Studio URL">
                </div>
                <div class="field">
                  <label for="image-lmstudio-api-key-input">Image LM Studio API Key</label>
                  <input id="image-lmstudio-api-key-input" placeholder="Leave empty to use Ask LazyDev global API key">
                </div>
                <div class="row">
                  <button id="save-image-llm-connection-settings-button">${renderButtonIcon("save")}<span>Save Image LLM Connection</span></button>
                  <button class="secondary" id="reload-image-llm-connection-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved Image LLM Connection</span></button>
                </div>
                <div class="hint" id="image-llm-connection-settings-status">Image LLM connection settings not loaded yet.</div>
              </article>
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="audio-comfy">
                <h4>Separate Setting: Audio ComfyUI Workflow</h4>
                <div class="studio-settings-eyebrow">ComfyUI workflow settings</div>
                <div class="hint">These settings only choose the ComfyUI server and workflow JSON for audio generation.</div>
                <div class="field">
                  <label for="comfy-audio-base-url-input">Audio ComfyUI Base URL</label>
                  <input id="comfy-audio-base-url-input" placeholder="http://127.0.0.1:8188">
                </div>
                <div class="field">
                  <label for="comfy-audio-workflow-path-input">Audio Workflow Path</label>
                  <input id="comfy-audio-workflow-path-input" placeholder="${comfyWorkflowPaths.audio.generate}">
                </div>
                <div class="row">
                  <button id="save-comfy-audio-path-settings-button">${renderButtonIcon("save")}<span>Save Audio Comfy Settings</span></button>
                  <button class="secondary" id="reload-comfy-audio-path-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved Settings</span></button>
                </div>
                <div class="hint" id="comfy-audio-path-settings-status">Audio Comfy settings not loaded yet.</div>
              </article>
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="music-comfy">
                <h4>Music ComfyUI Endpoint + Path Settings</h4>
                <div class="field">
                  <label for="comfy-music-base-url-input">Music ComfyUI Base URL</label>
                  <input id="comfy-music-base-url-input" placeholder="http://127.0.0.1:8188">
                </div>
                <div class="field">
                  <label for="comfy-music-workflow-path-input">Music Workflow Path</label>
                  <input id="comfy-music-workflow-path-input" placeholder="${comfyWorkflowPaths.music.generate}">
                </div>
                <div class="row">
                  <button id="save-comfy-music-path-settings-button">${renderButtonIcon("save")}<span>Save Music Comfy Settings</span></button>
                  <button class="secondary" id="reload-comfy-music-path-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved Settings</span></button>
                </div>
                <div class="hint" id="comfy-music-path-settings-status">Music Comfy settings not loaded yet.</div>
              </article>
              <article class="status-card settings-overlay-card workflow-settings-card hidden" data-workflow-settings-panel="video-comfy">
                <h4>Separate Setting: Video ComfyUI Workflow</h4>
                <div class="studio-settings-eyebrow">ComfyUI workflow settings</div>
                <div class="hint">These settings only choose the ComfyUI server and workflow JSON. Use the presets below for width, height, frame length, FPS, and steps.</div>
                <div class="field">
                  <label for="comfy-video-base-url-input">Video ComfyUI Base URL</label>
                  <input id="comfy-video-base-url-input" placeholder="http://127.0.0.1:8188">
                </div>
                <div class="field">
                  <label for="comfy-video-workflow-path-input">Text To Video Workflow Path</label>
                  <input id="comfy-video-workflow-path-input" placeholder="${comfyWorkflowPaths.video.generate}">
                </div>
                <div class="field">
                  <label for="comfy-video-image-workflow-path-input">Image + Text Workflow Path</label>
                  <input id="comfy-video-image-workflow-path-input" value="${comfyWorkflowPaths.video.imageText}" readonly>
                  <div class="hint">Used automatically when Image + Text mode is selected.</div>
                </div>
                <div class="row">
                  <button id="save-comfy-video-path-settings-button">${renderButtonIcon("save")}<span>Save Video Comfy Settings</span></button>
                  <button class="secondary" id="reload-comfy-video-path-settings-button">${renderButtonIcon("refresh")}<span>Reload Saved Settings</span></button>
                </div>
                <div class="hint" id="comfy-video-path-settings-status">Video Comfy settings not loaded yet.</div>
              </article>
            </div>
            <div class="row settings-overlay-footer">
              <button class="secondary" id="close-workflow-settings-overlay-footer-button" type="button">Close</button>
            </div>
          </div>
        </div>`;
}

function renderGameEngineSendOverlay(): string {
  return `
        <div class="runtime-overlay hidden game-engine-send-overlay" id="game-engine-send-overlay" aria-hidden="true">
          <button class="runtime-overlay-backdrop" id="game-engine-send-overlay-backdrop" aria-label="Close game engine export"></button>
          <div class="runtime-overlay-panel game-engine-send-panel">
            <div class="runtime-overlay-header">
              <div class="runtime-overlay-title-wrap">
                <div class="panel-kicker">Game Engine Export</div>
                <h3>Send Resource To Engine</h3>
              </div>
              <button class="ghost compact" id="game-engine-send-close-button" aria-label="Close game engine export">&#10005;</button>
            </div>
            <div class="game-engine-send-body">
              <article class="status-card settings-overlay-card game-engine-send-source-card">
                <h4>Selected Resource</h4>
                <strong id="game-engine-send-source-name">No resource selected</strong>
                <div class="hint" id="game-engine-send-source-detail">Choose a studio item first.</div>
                <div class="game-engine-send-preview-card">
                  <div class="game-engine-send-preview-stage" id="game-engine-send-preview-stage" aria-live="polite"></div>
                  <div class="game-engine-send-preview-copy">
                    <strong id="game-engine-send-preview-label">No preview available</strong>
                    <small id="game-engine-send-preview-meta"></small>
                  </div>
                </div>
              </article>
              <article class="status-card settings-overlay-card game-engine-send-settings-card">
                <h4>Export Settings</h4>
                <div class="field">
                  <label for="game-engine-send-engine">Target Engine</label>
                  <select id="game-engine-send-engine">
                    <option value="unity">Unity</option>
                    <option value="unreal">Unreal</option>
                    <option value="godot">Godot</option>
                  </select>
                </div>
                <div class="field">
                  <label for="game-engine-send-title">Title</label>
                  <input id="game-engine-send-title" placeholder="Imported resource title">
                </div>
                <div class="field hidden" id="game-engine-send-option-field">
                  <label for="game-engine-send-option">Variant</label>
                  <select id="game-engine-send-option"></select>
                  <div class="hint" id="game-engine-send-option-hint"></div>
                </div>
                <div class="hint" id="game-engine-send-help">Unity and Godot importer support are ready. Unreal queue entries are kept ready for its future importer.</div>
              </article>
            </div>
            <div class="row settings-overlay-footer">
              <button class="secondary" id="game-engine-send-cancel-button" type="button">Cancel</button>
              <button id="game-engine-send-submit-button" type="button">Queue Export</button>
            </div>
          </div>
        </div>`;
}

function renderMessengerConnectionTile(input: { title: string; description: string; iconSrc: string; iconAlt: string; styleKey: string; messenger: "discord" | "telegram" | "matrix" | "whatsapp"; }) {
  return `
              <article class="studio-workflow-quick-tile messenger-connection-tile is-${input.styleKey}">
                <div class="studio-workflow-quick-tile-icon" aria-hidden="true"><img src="${input.iconSrc}" alt="${input.iconAlt}"></div>
                <h4>${input.title}</h4>
                <div class="panel-subtitle">${input.description}</div>
                <button class="studio-workflow-quick-tile-open" data-ai-open-messenger="${input.messenger}" type="button">${renderButtonIcon("expand")}<span>Open</span></button>
              </article>`;
}

export function renderDashboardAiView(input: DashboardAiViewInput): string {
  return `
      <section class="view active studio-view" data-view-panel="ai">
        <div class="studio-view-shell">
          <div class="studio-home-topbar studio-home-overview-only">
            <div class="studio-home-welcome-copy">
              <div class="panel-kicker">Command center</div>
              <h2>Welcome to URage NOW</h2>
              <p>Create with AI, manage your tools, and keep every workflow moving.</p>
            </div>
            <label class="studio-home-search" aria-label="Search Studio">
              <span class="button-icon" aria-hidden="true">${renderToolsSearchIcon()}</span>
              <input data-studio-home-search="studio" type="search" placeholder="Search workflows and recent work..." autocomplete="off">
            </label>
            <div class="studio-home-profile-pill"><span>LD</span></div>
          </div>
          <section class="studio-home-command-grid studio-home-overview-only" aria-label="URage command center">
          <article class="panel-card studio-workflow-quick-card studio-home-overview-only" id="studio-home-card">
            <div class="studio-workflow-quick-head">
              <div class="panel-heading">
                <div class="panel-kicker">Quick launch</div>
                <h3>Start a new creation</h3>
                <p>Choose a studio and jump straight into your next idea.</p>
              </div>
              <button class="studio-workflow-quick-open-all" data-view="ai" data-studio-home-view="workflow" type="button">${renderButtonIcon("folder")}<span>Go to LazyDev</span></button>
            </div>
            <div class="studio-workflow-quick-grid">
              ${renderWorkflowQuickTile({
                title: "Chat",
                description: "AI chat and conversations with your assistant.",
                iconKey: "chat",
                styleKey: "chat",
                scrollTarget: "ask-rod-card"
              })}
              ${renderWorkflowQuickTile({
                title: "Image",
                description: "Generate images from text prompts.",
                iconKey: "image",
                styleKey: "image",
                scrollTarget: "image-studio-card"
              })}
              ${renderWorkflowQuickTile({
                title: "3D Model",
                description: "Create 3D models and assets.",
                iconKey: "model3d",
                styleKey: "model3d",
                scrollTarget: "model3d-studio-card"
              })}
              ${renderWorkflowQuickTile({
                title: "Audio",
                description: "Generate audio from text.",
                iconKey: "audio",
                styleKey: "audio",
                scrollTarget: "audio-studio-card"
              })}
              ${renderWorkflowQuickTile({
                title: "Music",
                description: "Generate music and beats.",
                iconKey: "music",
                styleKey: "music",
                scrollTarget: "music-studio-card"
              })}
              ${renderWorkflowQuickTile({
                title: "Video",
                description: "Generate videos from prompts.",
                iconKey: "video",
                styleKey: "video",
                scrollTarget: "video-studio-card"
              })}
            </div>
          </article>
          <section class="studio-home-workbench studio-home-overview-only" aria-label="Current work and recent outputs">
            <article class="studio-home-workbench-panel studio-home-current-panel">
              <div class="studio-home-section-head"><div><div class="panel-kicker">Workspace</div><h3>Continue working</h3></div></div>
              <div class="studio-home-empty" id="studio-home-current-project-empty">Loading your most recent project...</div>
              <div class="studio-home-current-project" id="studio-home-current-project"></div>
            </article>
            <article class="studio-home-workbench-panel studio-home-output-panel">
              <div class="studio-home-section-head"><div><div class="panel-kicker">Recent outputs</div><h3>Pick up where you left off</h3></div><button class="ghost compact" data-view="ai" data-studio-home-view="workflow" type="button">View all</button></div>
              <div class="studio-home-project-grid studio-home-project-grid-list">
                <div class="studio-home-empty" id="studio-home-recent-projects-empty">Loading recent projects...</div>
                <div class="studio-home-project-list" id="studio-home-recent-projects"></div>
              </div>
            </article>
          </section>
          </section>
          <div class="studio-home-feature-grid studio-home-overview-only">
            <article class="panel-card studio-home-feature-card is-tools">
              <div class="studio-home-feature-copy">
                <h3>Tools</h3>
                <span>Utilities</span>
                <p>Enhance your workflow with powerful AI tools and utilities.</p>
                <button class="secondary studio-home-feature-button" data-view="tools" type="button">${renderButtonIcon("wand")}<span>Open Tools</span></button>
              </div>
              <div class="studio-home-feature-art is-tools" aria-hidden="true">${renderToolsIcon()}</div>
            </article>
            <article class="panel-card studio-home-feature-card is-addons">
              <div class="studio-home-feature-copy">
                <h3>3D Suites</h3>
                <span>Blender workflows</span>
                <p>Extend Blender's functionality with powerful AI-driven addons.</p>
                <div>
                  <button class="secondary studio-home-feature-button" data-view="blender-projects" type="button">${renderButtonIcon("box")}<span>Open Projects</span></button>
                  <button class="secondary studio-home-feature-button" data-view="blender-addons" type="button">${renderButtonIcon("box")}<span>Open Addons</span></button>
                </div>
              </div>
              <div class="studio-home-feature-art is-addons" aria-hidden="true">${renderBlenderIconSvg()}</div>
            </article>
            <article class="panel-card studio-home-feature-card is-assets">
              <div class="studio-home-feature-copy">
                <h3>Game Engines</h3>
                <span>Projects & assets</span>
                <p>Launch projects and manage engine assets.</p>
                <div>
                  <button class="secondary studio-home-feature-button" data-view="projects" type="button">${renderButtonIcon("box")}<span>Open Projects</span></button>
                  <button class="secondary studio-home-feature-button" data-view="assets" type="button">${renderButtonIcon("box")}<span>Open Assets</span></button>
                </div>
              </div>
              <div class="studio-home-feature-art is-assets" aria-hidden="true">${renderAssetsIcon()}</div>
            </article>
            <article class="panel-card studio-home-feature-card is-bots">
              <div class="studio-home-feature-copy">
                <h3>Bots</h3>
                <span>Automation</span>
                <p>Create and manage AI bots that work for you.</p>
                <button class="secondary studio-home-feature-button" data-view="dashboard" type="button">${renderButtonIcon("box")}<span>Open Bots</span></button>
              </div>
              <div class="studio-home-feature-art is-bots" aria-hidden="true">${renderDashboardNavigationIcon("discord")}</div>
            </article>
          </div>
          <article class="panel-card lazydev-home-card lazydev-home-only">
            <div class="lazydev-home-hero">
              <div class="lazydev-home-hero-copy">
                <div class="panel-kicker">URage NOW / LazyDev</div>
                <h2>Your creative workspace</h2>
                <p>Start a workflow, track what you made, and continue where you left off.</p>
              </div>
              <label class="studio-home-search" aria-label="Search LazyDev">
                <span class="button-icon" aria-hidden="true">${renderToolsSearchIcon()}</span>
                <input data-studio-home-search="workflow" type="search" placeholder="Search workflows and recent work..." autocomplete="off">
              </label>
            </div>
            <div class="lazydev-home-create-panel">
              <div class="lazydev-home-workflow-area">
                <div class="lazydev-home-workflow-heading"><span>Start a workflow</span><small>Choose the output you want to create.</small></div>
                <div class="lazydev-home-workflow-grid">
                ${renderWorkflowHomeButton({ title: "Chat", description: "Think, plan, and write", iconKey: "chat", styleKey: "chat", scrollTarget: "ask-rod-card" })}
                ${renderWorkflowHomeButton({ title: "Image", description: "Create from a prompt", iconKey: "image", styleKey: "image", scrollTarget: "image-studio-card" })}
                ${renderWorkflowHomeButton({ title: "3D Model", description: "Generate and refine assets", iconKey: "model3d", styleKey: "model3d", scrollTarget: "model3d-studio-card" })}
                ${renderWorkflowHomeButton({ title: "Audio", description: "Voice and sound tools", iconKey: "audio", styleKey: "audio", scrollTarget: "audio-studio-card" })}
                ${renderWorkflowHomeButton({ title: "Music", description: "Create tracks and beats", iconKey: "music", styleKey: "music", scrollTarget: "music-studio-card" })}
                ${renderWorkflowHomeButton({ title: "Video", description: "Generate moving media", iconKey: "video", styleKey: "video", scrollTarget: "video-studio-card" })}
                </div>
              </div>
            </div>
            <div class="lazydev-home-dashboard-grid">
              <section class="lazydev-home-panel lazydev-home-usage-panel">
                <div class="studio-home-section-head lazydev-home-usage-head">
                  <div><div class="panel-kicker">Insights</div><h3>Usage Overview</h3></div>
                  <div class="lazydev-home-usage-controls">
                    <small class="lazydev-home-range-label" id="lazydev-home-usage-range">Loading activity...</small>
                    <div class="lazydev-home-panel-filter-tabs lazydev-home-usage-filters" data-lazydev-home-filter-tabs="usage" role="tablist" aria-label="Usage media filter">
                      <button class="active" data-lazydev-home-filter-scope="usage" data-lazydev-home-filter="all" type="button">All</button>
                      <button data-lazydev-home-filter-scope="usage" data-lazydev-home-filter="image" type="button">Images</button>
                      <button data-lazydev-home-filter-scope="usage" data-lazydev-home-filter="model3d" type="button">3D</button>
                      <button data-lazydev-home-filter-scope="usage" data-lazydev-home-filter="audio" type="button">Audio</button>
                      <button data-lazydev-home-filter-scope="usage" data-lazydev-home-filter="music" type="button">Music</button>
                      <button data-lazydev-home-filter-scope="usage" data-lazydev-home-filter="video" type="button">Video</button>
                    </div>
                  </div>
                </div>
                <div class="lazydev-home-usage-content">
                  <article class="lazydev-home-activity-chart-card">
                    <div class="lazydev-home-chart-heading">
                      <div><strong>Generation activity</strong><small>Daily output by media type</small></div>
                      <span>7 day trend</span>
                    </div>
                    <div class="lazydev-home-activity-chart" id="lazydev-home-activity-chart"><div class="studio-home-empty">Loading activity graph...</div></div>
                  </article>
                  <div class="lazydev-home-usage-grid" id="lazydev-home-usage-overview"><div class="studio-home-empty">Loading usage statistics...</div></div>
                </div>
              </section>
              <section class="lazydev-home-panel lazydev-home-recent-panel">
                <div class="studio-home-section-head"><div><div class="panel-kicker">Workspace</div><h3>Continue working</h3></div></div>
                <div class="studio-home-empty" id="lazydev-home-recent-projects-empty">Loading recent work...</div>
                <div class="lazydev-home-current-project" id="lazydev-home-current-project"></div>
              </section>
              <section class="lazydev-home-panel lazydev-home-recent-work-panel">
                <div class="studio-home-section-head"><div><div class="panel-kicker">Library</div><h3>Recent work</h3></div></div>
                <div class="studio-home-project-list lazydev-home-recent-project-list" id="lazydev-home-recent-projects"></div>
              </section>
              <section class="lazydev-home-panel lazydev-home-activity-panel">
                <div class="studio-home-section-head"><div><div class="panel-kicker">Timeline</div><h3>Recent activity</h3></div></div>
                <div class="lazydev-home-activity-list" id="lazydev-home-activity-list"><div class="studio-home-empty">Loading recent activity...</div></div>
                <div class="lazydev-home-panel-filter-tabs" data-lazydev-home-filter-tabs="activity" role="tablist" aria-label="Recent activity media filter">
                  <button class="active" data-lazydev-home-filter-scope="activity" data-lazydev-home-filter="all" type="button">All</button>
                  <button data-lazydev-home-filter-scope="activity" data-lazydev-home-filter="image" type="button">Images</button>
                  <button data-lazydev-home-filter-scope="activity" data-lazydev-home-filter="model3d" type="button">3D</button>
                  <button data-lazydev-home-filter-scope="activity" data-lazydev-home-filter="audio" type="button">Audio</button>
                  <button data-lazydev-home-filter-scope="activity" data-lazydev-home-filter="video" type="button">Video</button>
                </div>
              </section>
            </div>
          </article>
          <article class="panel-card studio-workflow-quick-card studio-home-secondary-card studio-home-legacy-card messenger-connections-card hidden">
            <div class="studio-workflow-quick-head">
              <div class="panel-heading">
                <div class="panel-kicker">Messenger Connections</div>
                <h3>Connected messenger platforms</h3>
              </div>
            </div>
            <div class="studio-workflow-quick-grid messenger-connection-grid">
              ${renderMessengerConnectionTile({
                title: "Discord",
                description: "Runtime tools and bot server access.",
                iconSrc: "/assets/messengers/discord/logo.svg",
                iconAlt: "Discord",
                styleKey: "chat",
                messenger: "discord"
              })}
              ${renderMessengerConnectionTile({
                title: "Telegram",
                description: "Chat automation and bot messaging.",
                iconSrc: "/assets/messengers/telegram/logo.svg",
                iconAlt: "Telegram",
                styleKey: "audio",
                messenger: "telegram"
              })}
              ${renderMessengerConnectionTile({
                title: "Matrix",
                description: "Room routing and runtime controls.",
                iconSrc: "/assets/messengers/matrix/logo.svg",
                iconAlt: "Matrix",
                styleKey: "model3d",
                messenger: "matrix"
              })}
              ${renderMessengerConnectionTile({
                title: "WhatsApp",
                description: "Phone messaging runtime and automation handoff.",
                iconSrc: "/assets/messengers/whatsapp/logo.svg",
                iconAlt: "WhatsApp",
                styleKey: "audio",
                messenger: "whatsapp"
              })}
            </div>
          </article>
          <article class="panel-card studio-workflow-quick-card studio-home-secondary-card studio-home-legacy-card studio-tools-quick-card hidden">
            <div class="studio-workflow-quick-head">
              <div class="panel-heading">
                <div class="panel-kicker">Studio Tools</div>
                <h3>Open local tools from Studio Home</h3>
              </div>
              <button class="secondary studio-workflow-quick-open-all" data-view="tools" type="button">${renderButtonIcon("expand")}<span>Open Tools Workspace</span></button>
            </div>
            <div class="studio-workflow-quick-grid studio-tools-quick-grid" id="studio-tools-quick-grid">
              <div class="hint" id="studio-tools-quick-empty">No local tools with <code>index.html</code> detected yet.</div>
            </div>
          </article>
        </div>
        <div class="content-grid two-up ai-grid">
          <article class="panel-card ai-section-target ai-detail-card ask-rod-chat-card" id="ask-rod-card">
            <div class="chat-header-topline">
              <div class="chat-header-copy">
                <h3>Ask LazyDev</h3>
                <div class="panel-subtitle">Local text or vision answers without posting to any messenger.</div>
              </div>
              <div class="chat-header-actions">
                <button class="secondary chat-new-button" id="ask-new-chat-button" type="button">${renderButtonIcon("plus")}<span>New Chat</span></button>
                <button class="secondary workflow-sidebar-toggle-button" id="ask-rod-sidebar-toggle-button" data-workflow-sidebar-toggle="ask" aria-controls="ask-rod-sidebar-panel" aria-expanded="true" aria-pressed="false" type="button">${renderButtonIcon("expand")}<span data-workflow-sidebar-toggle-label>Hide Sidebar</span></button>
              </div>
            </div>
            <div class="ask-rod-workspace" data-workflow-sidebar-workspace="ask">
              <div class="ask-chat-tabs" id="ask-chat-tabs" role="tablist" aria-label="Ask LazyDev chats"></div>
              <div class="ask-rod-main">
                <div class="chat-feed ask-rod-feed" id="ask-chat-feed">
                  <div class="ask-chat-message-list" id="ask-chat-messages"></div>
                </div>
                <details class="fold-card hidden" id="ask-think-foldout">
                  <summary>Think</summary>
                  <div class="fold-content">
                    <div class="output simulation-output" id="ask-think-output">No reasoning trace yet.</div>
                  </div>
                </details>
                <div class="chat-composer-grid ask-rod-composer">
                  <div class="field ask-composer-field">
                    <label for="ask-prompt">Message</label>
                    <div class="ask-composer-context" aria-label="Active chat response settings">
                      <div class="ask-composer-context-badges" aria-live="polite">
                        <span class="ask-composer-context-badge" id="ask-active-personality-badge">Personality: Normal</span>
                        <span class="ask-composer-context-badge" id="ask-active-reply-style-badge">Reply: &lt;empty&gt;</span>
                      </div>
                      <label class="ask-composer-reply-override" for="ask-chat-reply-style-override">
                        <span>This chat</span>
                        <select id="ask-chat-reply-style-override" aria-label="Reply style for this chat">
                          <option value="">Use global (&lt;empty&gt;)</option>
                        </select>
                      </label>
                    </div>
                    <div class="ask-composer-attachment-tray hidden" id="ask-composer-attachment-tray" aria-live="polite"></div>
                    <div class="ask-recording-status hidden" id="ask-recording-status" role="status" aria-live="polite"></div>
                    <div class="ask-composer-message-row">
                      <details class="ask-upload-menu">
                        <summary class="secondary mini-button ask-composer-icon-button" title="Upload" aria-label="Upload">
                          ${renderButtonIcon("upload")}
                        </summary>
                        <div class="ask-upload-menu-panel" aria-label="Upload options">
                          <button class="secondary mini-button" id="browse-ai-images-button" type="button" title="Upload images">${renderButtonIcon("upload")}<span>Images</span></button>
                          <button class="secondary mini-button" id="ask-file-upload-browse-button" type="button" title="Upload files">${renderButtonIcon("file")}<span>Files</span></button>
                          <button class="secondary mini-button" id="ask-model-upload-browse-button" type="button" title="Upload 3D models">${renderButtonIcon("cube")}<span>3D</span></button>
                          <button class="secondary mini-button" id="ask-audio-upload-button" type="button" title="Upload audio file">${renderButtonIcon("audio")}<span>Audio</span></button>
                        </div>
                      </details>
                      <div class="ask-prompt-command-anchor">
                        <textarea id="ask-prompt" placeholder="Message LazyDev" aria-controls="ask-slash-command-palette" aria-autocomplete="list"></textarea>
                        <div class="ask-slash-command-palette hidden" id="ask-slash-command-palette" role="listbox" aria-label="Chat commands"></div>
                      </div>
                      <div class="ask-composer-send-actions">
                        <button class="secondary mini-button ask-composer-icon-button" id="ask-voice-record-button" type="button" title="Record Audio" aria-label="Record Audio">${renderButtonIcon("audio")}</button>
                        <button id="ask-button">${renderButtonIcon("send")}<span>Send</span></button>
                        <button class="secondary mini-button ask-composer-icon-button" id="ask-send-to-game-engine-button" type="button" title="Chat settings" aria-label="Chat settings">${renderButtonIcon("settings")}</button>
                      </div>
                    </div>
                    <details class="fold-card ask-prompt-presets-foldout">
                      <summary>Prompt Presets</summary>
                      <div class="fold-content">
                        <div class="ask-user-prompt-presets ask-user-prompt-presets-grouped is-dense">
                          ${[
                            { label: "Text", buttons: [
                              ["Explain", "file", "Explain this code in simple steps."],
                              ["Rewrite", "file", "Rewrite this text with a clearer structure and stronger flow."],
                              ["Plan", "settings", "Create a step by step plan with priorities and risks."]
                            ] },
                            { label: "Image", buttons: [
                              ["Scene", "image", "/generate-image A cozy fantasy workshop, warm lantern light, detailed props, painterly style."],
                              ["Icon", "wand", "/generate-image A clean cartoon flat-shaded character icon, centered composition, bold outline, light background."],
                              ["Product", "box", "/generate-image A premium product photo on a clean studio table, softbox lighting, realistic shadows, commercial look."]
                            ] },
                            { label: "3D Model", buttons: [
                              ["Prop", "cube", "/generate-model A stylized low-detail game prop, readable silhouette, clean material separation."],
                              ["Creature", "sparkle", "/generate-model A cute stylized creature character, full body, simple shapes, game-ready proportions."],
                              ["Lowpoly", "settings", "/generate-lowpoly Create a low poly version of the selected or uploaded 3D model."]
                            ] },
                            { label: "Audio", buttons: [
                              ["UI Sound", "sparkle", "/generate-audio A short clean UI confirmation sound, bright but soft, no harsh transient."],
                              ["Ambience", "wand", "/generate-audio Gentle forest ambience with distant wind, subtle leaves, no music."]
                            ] },
                            { label: "Music", buttons: [
                              ["Cozy Loop", "sparkle", "/generate-music A looping cozy synth theme for a creative studio, warm chords, gentle beat, optimistic mood."],
                              ["Tension", "wand", "/generate-music A tense cinematic game menu loop, pulsing low strings, restrained percussion, dark mood."]
                            ] },
                            { label: "Video", buttons: [
                              ["Cinematic", "image", "/generate-video A slow cinematic push-in on a cozy fantasy workshop, warm lanterns, dust motes, subtle camera movement."],
                              ["Turntable", "box", "/generate-video A simple product turntable shot on a clean studio background, smooth motion, soft shadows."]
                            ] }
                          ].map(group => `
                            <div class="studio-prompt-preset-category">
                              <div class="studio-prompt-preset-label">${group.label}</div>
                              <div class="studio-prompt-preset-buttons">
                                ${group.buttons.map(([label, icon, value]) => `<button class="secondary mini-button studio-prompt-preset-button quick-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="ask-prompt" data-prompt-preset-value="${value}" type="button" title="${label}">${renderButtonIcon((icon || "sparkle") as Parameters<typeof renderButtonIcon>[0])}<span class="quick-preset-label">${label}</span></button>`).join("")}
                              </div>
                            </div>
                          `).join("")}
                        </div>
                      </div>
                    </details>
                    <input type="file" id="ask-audio-upload-input" accept="audio/*" hidden>
                    <dialog class="ask-chat-settings-dialog" id="ask-chat-settings-dialog" aria-labelledby="ask-chat-settings-title">
                      <div class="ask-chat-settings-header">
                        <div>
                          <div class="eyebrow">Chat Studio</div>
                          <h3 id="ask-chat-settings-title">Chat Settings</h3>
                        </div>
                        <button class="secondary mini-button" id="ask-chat-settings-close-button" type="button" title="Close chat settings" aria-label="Close chat settings">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="ask-send-mode-row">
                      <label class="ask-tts-voice-picker" for="ask-chat-provider">
                        <span>Chat Provider</span>
                        <select id="ask-chat-provider" disabled aria-describedby="ask-chat-provider-hint">
                          <option value="dashboard-local">Dashboard local model</option>
                          <option value="openai" disabled>ChatGPT / OpenAI — planned</option>
                          <option value="gemini" disabled>Google Gemini — planned</option>
                          <option value="meshy" disabled>Meshy AI — planned</option>
                        </select>
                      </label>
                      <div class="hint" id="ask-chat-provider-hint">Chat currently uses the dashboard model selected in Settings. Cloud providers will be configured centrally so Android never stores provider API keys.</div>
                      <label class="toggle compact-toggle ask-send-mode-toggle" for="ask-auto-enter-send">
                        <span>Auto Enter Send</span>
                        <input id="ask-auto-enter-send" type="checkbox" checked>
                      </label>
                      <label class="toggle compact-toggle ask-send-mode-toggle" for="ask-auto-trigger-skills">
                        <span>Auto Trigger Skills</span>
                        <input id="ask-auto-trigger-skills" type="checkbox" checked>
                      </label>
                      <label class="toggle compact-toggle ask-send-mode-toggle" for="ask-auto-run-skills">
                        <span>Auto Run Skills</span>
                        <input id="ask-auto-run-skills" type="checkbox" checked>
                      </label>
                      <label class="toggle compact-toggle ask-send-mode-toggle" for="ask-auto-tts">
                        <span>Auto Text To Speech</span>
                        <input id="ask-auto-tts" type="checkbox">
                      </label>
                      <label class="ask-tts-voice-picker" for="ask-tts-voice">
                        <span>TTS Voice</span>
                        <select id="ask-tts-voice">
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                        </select>
                      </label>
                      <label class="ask-tts-voice-picker" for="ask-tts-mode">
                        <span>TTS Mode</span>
                        <select id="ask-tts-mode">
                          <option value="builtin">Built-in browser</option>
                          <option value="comfyui">ComfyUI tts.json</option>
                        </select>
                      </label>
                      <div class="hint ask-send-shortcut-hint" id="ask-send-shortcut-hint">Send: Ctrl+Enter | New line: Enter</div>
                      </div>
                    </dialog>
                  </div>
                </div>
              </div>
              <div class="studio-workflow-side-resizer" data-workflow-sidebar-resizer="ask" aria-hidden="true"></div>
              <aside class="ask-rod-side" id="ask-rod-sidebar-panel" data-workflow-sidebar-panel="ask" data-studio-inspector-panel="true">
                <details class="studio-side-foldout chat-sidebar-foldout" open>
                  <summary><span>Chat Image Inputs</span><small>Images</small></summary>
                  <div class="studio-side-foldout-content">
                    <div class="field ask-rod-images-panel studio-sidebar-form">
                      <div class="ai-dropzone" id="ai-dropzone" tabindex="0">
                        <div class="ai-dropzone-title">Drop, paste, or browse images</div>
                        <div class="panel-subtitle">Accepts image files, image URLs, data URLs, and local file paths.</div>
                      </div>
                      <input id="ai-image-input" type="file" accept="image/*" multiple hidden>
                      <div class="row studio-sidebar-actions">
                        <button class="secondary" id="clear-ai-images-button">${renderButtonIcon("trash")}<span>Clear Images</span></button>
                      </div>
                      <div class="list compact-list" id="ai-image-list"></div>
                    </div>
                  </div>
                </details>
                <details class="studio-side-foldout chat-sidebar-foldout">
                  <summary><span>Chat 3D Model Inputs</span><small>Models</small></summary>
                  <div class="studio-side-foldout-content">
                    <div class="field ask-rod-models-panel studio-sidebar-form">
                      <div class="panel-subtitle">Upload one or more source models for skills like low poly generation.</div>
                      <input id="ask-model-upload-input" type="file" accept=".glb,.gltf,.fbx,.obj,.stl,.ply,.usdz" multiple hidden>
                      <div class="row studio-sidebar-actions">
                        <button class="secondary" id="ask-model-upload-clear-button" type="button">${renderButtonIcon("trash")}<span>Clear 3D Models</span></button>
                      </div>
                      <div class="list compact-list" id="ask-model-upload-list"></div>
                    </div>
                  </div>
                </details>
                <details class="studio-side-foldout chat-sidebar-foldout">
                  <summary><span>Chat File Inputs</span><small>Files</small></summary>
                  <div class="studio-side-foldout-content">
                    <div class="field ask-rod-files-panel studio-sidebar-form">
                      <div class="panel-subtitle">Upload README, markdown, text, JSON, code, CSV, or other small reference files for chat context.</div>
                      <input id="ask-file-upload-input" type="file" multiple hidden>
                      <div class="row studio-sidebar-actions">
                        <button class="secondary" id="ask-file-upload-clear-button" type="button">${renderButtonIcon("trash")}<span>Clear Files</span></button>
                      </div>
                      <div class="list compact-list" id="ask-file-upload-list"></div>
                    </div>
                  </div>
                </details>
                <details class="ask-personality-panel studio-side-foldout chat-sidebar-foldout">
                  <summary><span>Personality + Memory</span><small>SOUL.md and USER.md</small></summary>
                  <div class="studio-side-foldout-content">
                    <div class="ask-personality-body studio-sidebar-form">
                    <div class="field">
                      <label for="ask-personality-select">Personality</label>
                      <select id="ask-personality-select"></select>
                    </div>
                    <div class="field">
                      <label for="ask-personality-label">Option Name</label>
                      <input id="ask-personality-label" placeholder="Normal">
                    </div>
                    <div class="field">
                      <label for="ask-personality-prompt">System Prompt</label>
                      <textarea id="ask-personality-prompt" spellcheck="false" placeholder="Write the selected personality prompt."></textarea>
                    </div>
                    <div class="row ask-personality-actions studio-sidebar-actions">
                      <button class="secondary" id="ask-personality-save-button" type="button">${renderButtonIcon("save")}<span>Save</span></button>
                      <button class="secondary" id="ask-personality-add-button" type="button">${renderButtonIcon("plus")}<span>Add Option</span></button>
                      <button class="secondary" id="ask-personality-delete-button" type="button">${renderButtonIcon("trash")}<span>Delete</span></button>
                    </div>
                    <div class="field">
                      <label for="ask-user-memory">USER.md</label>
                      <textarea id="ask-user-memory" spellcheck="false" placeholder="Write durable notes about yourself for LazyDev to know."></textarea>
                    </div>
                      <div class="hint studio-sidebar-status-note" id="ask-personality-status">Personality settings not loaded yet.</div>
                    </div>
                  </div>
                </details>
                <details class="ask-personality-panel ask-reply-style-panel studio-side-foldout chat-sidebar-foldout">
                  <summary><span>Reply Style</span><small>Output format from SOUL.md</small></summary>
                  <div class="studio-side-foldout-content">
                    <div class="ask-personality-body studio-sidebar-form">
                    <div class="field">
                      <label for="ask-reply-style-select">Output / Reply Style</label>
                      <select id="ask-reply-style-select"></select>
                    </div>
                    <div class="field">
                      <label for="ask-reply-style-label">Style Name</label>
                      <input id="ask-reply-style-label" placeholder="Custom Reply Style">
                    </div>
                    <div class="field">
                      <label for="ask-reply-style-prompt">Formatting Instruction</label>
                      <textarea id="ask-reply-style-prompt" spellcheck="false" placeholder="Describe exactly how LazyDev should format every reply."></textarea>
                    </div>
                    <div class="row ask-personality-actions studio-sidebar-actions">
                      <button class="secondary" id="ask-reply-style-save-button" type="button">${renderButtonIcon("save")}<span>Save</span></button>
                      <button class="secondary" id="ask-reply-style-add-button" type="button">${renderButtonIcon("plus")}<span>Add Custom</span></button>
                      <button class="secondary" id="ask-reply-style-delete-button" type="button">${renderButtonIcon("trash")}<span>Delete Custom</span></button>
                    </div>
                      <div class="hint studio-sidebar-status-note" id="ask-reply-style-status">Reply styles not loaded yet.</div>
                    </div>
                  </div>
                </details>
                <details class="studio-side-foldout chat-sidebar-foldout">
                  <summary><span>Recent Generated Media</span><small>Outputs</small></summary>
                  <div class="studio-side-foldout-content">
                    <div class="field ask-rod-recent-media-panel">
                      <div class="studio-bounded-section compact-media-section">
                        <div class="latest-media-grid" id="ask-latest-image-list"></div>
                        <div class="latest-media-grid" id="ask-latest-video-list"></div>
                        <div class="latest-media-grid" id="ask-latest-gif-list"></div>
                        <div class="list compact-list" id="ask-latest-audio-list"></div>
                      </div>
                    </div>
                  </div>
                </details>
              </aside>
            </div>
            ${renderWorkflowSettingsFooter([
              {
                panel: "ask-models",
                title: "Model + Connection Settings",
                kicker: "Ask LazyDev Settings",
                label: "Model + Connection Settings"
              }
            ])}
          </article>
          <article class="panel-card model3d-card ai-section-target ai-detail-card" id="model3d-studio-card">
            <div class="model3d-editor-appbar">
              <div class="model3d-appbar-brand">
                <span class="model3d-app-logo">${renderButtonIcon("cube")}</span>
                <span class="model3d-app-title">3D Model Studio</span>
                <span class="model3d-beta-pill">Beta</span>
              </div>
              <button class="secondary model3d-project-dropdown" type="button"><span>Project: Crystal Totem</span>${renderButtonIcon("expand")}</button>
              <div class="model3d-appbar-actions">
                <span class="model3d-autosave-status"><span aria-hidden="true"></span>Auto-save</span>
                <button class="secondary mini-button" data-ai-scroll-target="model3d-history-list" type="button" title="History" aria-label="History">${renderButtonIcon("history")}</button>
                <button class="secondary mini-button" data-workflow-settings-open="model3d-comfy" data-workflow-settings-title="3D Model Settings" data-workflow-settings-kicker="3D Model Studio" type="button" title="Settings" aria-label="Settings">${renderButtonIcon("settings")}</button>
                <button class="secondary mini-button model3d-share-button" id="model3d-share-button" type="button">${renderButtonIcon("upload")}<span>Share</span></button>
                <span class="model3d-user-avatar">JD</span>
              </div>
            </div>
            <div class="studio-card-header model3d-card-header">
              <div class="panel-heading">
                <div class="model3d-title-row">
                  <h3>3D Model Studio</h3>
                  <span class="model3d-beta-pill">Beta</span>
                </div>
                <div class="panel-subtitle">Generate GLB models from images, preview them in real time, and send them straight into your workflow tools.</div>
              </div>
              <div class="studio-card-header-actions">
                <button class="secondary workflow-sidebar-toggle-button" id="model3d-sidebar-toggle-button" data-workflow-sidebar-toggle="model3d" aria-controls="model3d-sidebar-panel" aria-expanded="true" aria-pressed="false" type="button">${renderButtonIcon("expand")}<span data-workflow-sidebar-toggle-label>Hide Sidebar</span></button>
                <button class="secondary studio-history-button" data-ai-scroll-target="model3d-history-list" type="button">${renderButtonIcon("history")}<span>History</span></button>
              </div>
            </div>
            <div id="studio-workflow-action-tabs">
              <div class="studio-action-tab-group" data-studio-action-target="model3d">
                <div class="workspace-tabs-new studio-primary-tabs" role="tablist" aria-label="3D Studio actions">
                  <button class="dashboard-tab active" data-model3d-studio-tab="generate" type="button" role="tab" aria-selected="true">${renderButtonIcon("sparkle")}<span>Generate</span></button>
                  <button class="dashboard-tab" data-model3d-studio-tab="edit" type="button" role="tab" aria-selected="false">${renderButtonIcon("settings")}<span>Edit</span></button>
                  <button class="dashboard-tab" data-model3d-studio-tab="rigging" type="button" role="tab" aria-selected="false">${renderButtonIcon("cube")}<span>Rigging</span></button>
                </div>
              </div>
            </div>
            <div class="studio-workflow-layout model3d-studio-workspace" data-workflow-sidebar-workspace="model3d">
              <div class="studio-workflow-main studio-component-form model3d-studio-main" tabindex="0" aria-label="3D Studio center workflow scroll area">
                <div class="model3d-action-panels">
                  <div class="workspace-tabs-new studio-primary-tabs" role="tablist" aria-label="3D Studio actions">
                    <button class="dashboard-tab active" data-model3d-action-tab="generate" type="button" role="tab" aria-selected="true">${renderButtonIcon("sparkle")}<span>Generate</span></button>
                    <button class="dashboard-tab" data-model3d-action-tab="edit" type="button" role="tab" aria-selected="false">${renderButtonIcon("settings")}<span>Edit</span></button>
                    <button class="dashboard-tab" data-model3d-action-tab="rigging" type="button" role="tab" aria-selected="false">${renderButtonIcon("cube")}<span>Rigging</span></button>
                  </div>
                  <div class="field model3d-generate-workflow-field" id="model3d-generate-workflow-field">
                    <label for="model3d-generate-workflow-select">Workflow</label>
                    <select id="model3d-generate-workflow-select">
                      <option value="single-image">Single Image</option>
                      <option value="multiview">MultiView</option>
                    </select>
                    <div class="hint" id="model3d-generate-workflow-hint">Single Image uses the standard 3D model workflow.</div>
                  </div>
                  <div class="model3d-studio-panel studio-component-form-section active" id="model3d-studio-panel-generate">
                    <div class="model3d-generate-panel-head">
                      <strong>Generate</strong>
                      <button class="secondary mini-button" id="model3d-toggle-advanced-button" type="button" title="Toggle advanced options" aria-label="Toggle advanced options">${renderButtonIcon("expand")}</button>
                    </div>
                    <div class="model3d-generation-grid model3d-generate-overview">
                      <div class="model3d-source-input-stack">
                        <div class="field studio-step-card model3d-source-card">
                          <div class="model3d-image-prompt-head">
                            ${renderButtonIcon("image")}
                            <span>Image Prompt</span>
                          </div>
                          <div class="model3d-source-field model3d-source-panel">
                            <label for="model3d-image-file">Source Image</label>
                            <input id="model3d-image-source" type="hidden">
                            <input id="model3d-image-file" type="file" accept="image/*" multiple hidden>
                            <button class="secondary model3d-image-upload-button" id="model3d-image-browse-button" type="button">
                              <img class="model3d-image-upload-preview hidden" id="model3d-image-upload-preview" alt="Selected 3D source image preview">
                              <span class="model3d-image-upload-content">
                                ${renderButtonIcon("upload")}
                                <span class="model3d-image-upload-title">Upload Source Image</span>
                                <span class="model3d-image-upload-subtitle">PNG, JPG up to 10MB</span>
                              </span>
                            </button>
                            <button class="secondary mini-button" id="model3d-image-paste-button" type="button">${renderButtonIcon("copy")}<span>Paste</span></button>
                            <button class="secondary mini-button" id="model3d-image-webcam-button" type="button">${renderButtonIcon("camera")}<span>From Webcam</span></button>
                            <button class="secondary mini-button" id="model3d-prepare-source-split-combine-button" type="button">${renderButtonIcon("wand")}<span>Split/Combine Source</span></button>
                            <div class="hint model3d-image-source-hint" id="model3d-image-source-hint">No source image selected yet.</div>
                            <div class="hint model3d-source-help">Upload one or more source images. Batch mode generates one model at a time, in order.</div>
                            <div class="model3d-source-list hidden" id="model3d-source-upload-list"></div>
                          </div>
                          <div class="model3d-source-panel">
                            <label for="model3d-image-pool-select">Image Pool <span class="label-soft">(Optional)</span></label>
                            <select id="model3d-image-pool-select"></select>
                            <div class="hint">When selected, pool images are included in manual 3D source picking.</div>
                            <div class="row model3d-pool-select-actions">
                              <button class="secondary mini-button hidden" id="model3d-pool-select-all-button" type="button" hidden><span>Select All</span></button>
                              <button class="secondary mini-button hidden" id="model3d-pool-clear-selection-button" type="button" hidden><span>Clear</span></button>
                            </div>
                            <div class="model3d-source-list model3d-pool-source-list" id="model3d-image-pool-list"></div>
                          </div>
                          <div class="studio-component-toolbar">
                            <button id="generate-model3d-button" disabled>${renderButtonIcon("sparkle")}<span>Generate 3D Model</span></button>
                            <button class="secondary hidden" id="model3d-image-clear-button" type="button" hidden>${renderButtonIcon("close")}<span>Clear</span></button>
                            <button class="secondary hidden" id="stop-model3d-generation-button" type="button" hidden><span>Stop</span></button>
                            <button class="secondary" id="model3d-advanced-settings-button" type="button">${renderButtonIcon("settings")}<span>Advanced Settings</span></button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="model3d-primary-stack" id="model3d-advanced-stack">
                      <details class="fold-card model3d-advanced-options studio-component-advanced-settings">
                        <summary>Generation + Post Options</summary>
                        <div class="fold-content">
                          <div class="toggle">
                            <span>Ask LLM if model should be metallic</span>
                            <input id="model3d-ask-llm-metallic" type="checkbox">
                          </div>
                          <div class="hint">LLM checks the input image: fully metallic enables metallic, non-metal disables metallic, mixed materials leave metallic unchanged.</div>
                          <div class="toggle">
                            <span>Ask LLM real-world height and scale model</span>
                            <input id="model3d-auto-scale-real-height" type="checkbox">
                          </div>
                          <div class="hint">LLM estimates typical real-world height from the input image and the model is uniformly scaled to that height.</div>
                          <div class="toggle">
                            <span>Use LLM for model filename</span>
                            <input id="model3d-llm-filename" type="checkbox" checked>
                          </div>
                          <div class="toggle">
                            <span>Use LLM for model description</span>
                            <input id="model3d-llm-description" type="checkbox" checked>
                          </div>
                          <div class="field">
                            <label for="model3d-llm-metadata-timing">LLM Metadata Timing</label>
                            <select id="model3d-llm-metadata-timing">
                              <option value="before">Before 3D generation</option>
                              <option value="after">After 3D generation</option>
                              <option value="parallel">At same time as 3D generation</option>
                            </select>
                          </div>
                          <div class="field">
                            <label for="model3d-metadata-target">LLM metadata execution</label>
                            <select id="model3d-metadata-target">
                              <option value="local">This machine</option>
                              <option value="remote">Remote worker machine</option>
                            </select>
                          </div>
                          <div class="toggle">
                            <span>Unload active LLM model before 3D generation</span>
                            <input id="model3d-unload-llm-before-generate" type="checkbox" checked>
                          </div>
                          <div class="field">
                            <label for="model3d-generation-target">3D model generation execution</label>
                            <select id="model3d-generation-target">
                              <option value="local">This machine</option>
                              <option value="remote">Remote worker machine</option>
                            </select>
                          </div>
                          <div class="toggle">
                            <span>Pick random source image from all available inputs</span>
                            <input id="model3d-random-source" type="checkbox" checked>
                          </div>
                          <div class="toggle">
                            <span>Generate every source image one by one</span>
                            <input id="model3d-batch-sources" type="checkbox">
                          </div>
                          <div class="field">
                            <label for="model3d-generate-count">Models per source</label>
                            <input id="model3d-generate-count" type="number" min="1" max="8" step="1" value="1">
                          </div>
                          <div class="field">
                            <label for="model3d-seed">Seed</label>
                            <input id="model3d-seed" type="number" min="0" step="1" placeholder="Random">
                          </div>
                          <div class="field">
                            <label for="model3d-seed-control">Control After Generate</label>
                            <select id="model3d-seed-control">
                              <option value="fixed">Fixed</option>
                              <option value="increase">Increase</option>
                              <option value="decrease">Decrease</option>
                              <option value="randomize" selected>Randomize</option>
                            </select>
                          </div>
                          <div class="toggle" id="model3d-create-lowpoly-after-generation-toggle">
                            <span>Create lowpoly version after generation</span>
                            <input id="model3d-create-lowpoly-after-generation" type="checkbox">
                          </div>
                          <div id="model3d-lowpoly-shared-controls">
                            <div class="toggle" id="model3d-lowpoly-use-llm-target-faces-toggle">
                              <span>Let LLM decide low poly target faces by object complexity</span>
                              <input id="model3d-lowpoly-use-llm-target-faces" type="checkbox" checked>
                            </div>
                            <div class="field" id="model3d-lowpoly-llm-decision-source-field">
                              <label for="model3d-lowpoly-llm-decision-source">Low Poly LLM Decision Source</label>
                              <select id="model3d-lowpoly-llm-decision-source">
                                <option value="input-image">Input image</option>
                                <option value="model-render">Generated 3D model render</option>
                              </select>
                            </div>
                            <div class="field" id="model3d-lowpoly-target-face-preset-field">
                              <label for="model3d-lowpoly-target-face-preset">Low Poly Target Preset</label>
                              <select id="model3d-lowpoly-target-face-preset">
                                <option value="500">Tiny (500 faces)</option>
                                <option value="1000">Small (1000 faces)</option>
                                <option value="1500" selected>Medium (1500 faces)</option>
                                <option value="3000">Large (3000 faces)</option>
                                <option value="5000">Huge (5000 faces)</option>
                                <option value="custom">Custom (use value below)</option>
                              </select>
                            </div>
                            <div class="field" id="model3d-lowpoly-target-face-count-field">
                              <label for="model3d-lowpoly-target-face-count">Low Poly Target Faces</label>
                              <input id="model3d-lowpoly-target-face-count" type="number" min="1" step="1" value="1500">
                            </div>
                            <div class="toggle" id="model3d-lowpoly-max-colors-toggle">
                              <span>Limit maximum colors</span>
                              <input id="model3d-lowpoly-max-colors" type="checkbox">
                            </div>
                          </div>
                          <div class="field" id="model3d-post-destination-field">
                            <label for="model3d-post-messenger-select">Post generated model to</label>
                            <select id="model3d-post-messenger-select">
                              <option value="none" selected>Do not post</option>
                              <option value="discord">Discord</option>
                              <option value="telegram">Telegram</option>
                              <option value="matrix">Matrix</option>
                              <option value="whatsapp">WhatsApp</option>
                            </select>
                            <select id="model3d-post-destination-input">
                              <option value="">Choose destination</option>
                            </select>
                            <div class="row" id="model3d-post-use-selected-discord-row">
                        <button class="secondary" id="model3d-post-use-selected-discord-button" type="button">${renderButtonIcon("copy")}<span>Use Selected Discord Channel</span></button>
                            </div>
                            <div class="hint" id="model3d-post-destination-hint">Pick a messenger and provide the destination ID.</div>
                          </div>
                          <div class="field" id="model3d-post-target-field">
                            <label for="model3d-post-target-mode">Post Target</label>
                            <select id="model3d-post-target-mode">
                              <option value="channel">Selected channel message</option>
                              <option value="thread">Create new thread in selected channel</option>
                              <option value="forum-post">Create post in forum channel (choose below)</option>
                              <option value="forum-create-and-post">Create/find forum channel and post</option>
                            </select>
                          </div>
                          <div class="field" id="model3d-thread-name-mode-field">
                            <label for="model3d-thread-name-mode">Thread Name Mode</label>
                            <select id="model3d-thread-name-mode">
                              <option value="fixed">Specific name</option>
                              <option value="increment">Base name + increasing number</option>
                              <option value="model-name">Model name</option>
                            </select>
                          </div>
                          <div class="field" id="model3d-model-name-source-field">
                            <label for="model3d-model-name-source">Model Name Source</label>
                            <select id="model3d-model-name-source">
                              <option value="llm">LLM</option>
                              <option value="filename">Filename</option>
                            </select>
                          </div>
                          <div class="field" id="model3d-thread-name-field">
                            <label for="model3d-thread-name">Thread Name</label>
                            <input id="model3d-thread-name" placeholder="Model Thread">
                          </div>
                          <div class="field" id="model3d-thread-base-field">
                            <label for="model3d-thread-base">Thread Base Name</label>
                            <input id="model3d-thread-base" placeholder="Day">
                            <div class="hint">Creates names like Day 1, Day 2, Day 3...</div>
                          </div>
                          <div class="field" id="model3d-forum-channel-id-field">
                            <label for="model3d-forum-channel-id">Forum Channel</label>
                            <select id="model3d-forum-channel-id">
                              <option value="">Choose forum channel below</option>
                            </select>
                          </div>
                          <div class="field" id="model3d-forum-channel-name-field">
                            <label for="model3d-forum-channel-name">Forum Channel Name</label>
                            <input id="model3d-forum-channel-name" placeholder="textures">
                          </div>
                          <div class="toggle" id="model3d-send-initial-toggle">
                            <span>Also post initial model message in selected channel</span>
                            <input id="model3d-send-initial" type="checkbox">
                          </div>
                          <div class="field" id="model3d-initial-extra-field">
                            <label for="model3d-initial-extra">Extra Message In Initial Channel Post</label>
                            <textarea id="model3d-initial-extra" placeholder="Optional extra text for the initial selected-channel post.">${input.model3dInitialThreadExtraText}</textarea>
                          </div>
                          <div class="field" id="model3d-model-upload-target-field">
                            <label for="model3d-model-upload-target">Model Upload Location</label>
                            <select id="model3d-model-upload-target">
                              <option value="selected">Upload in selected channel message</option>
                              <option value="target">Upload in target thread/forum post</option>
                            </select>
                            <div class="hint">The other message uses a link to this uploaded model instead of uploading again.</div>
                          </div>
                          <div class="toggle" id="model3d-embed-in-initial-toggle">
                            <span>Include metadata embed in initial selected-channel post</span>
                            <input id="model3d-embed-in-initial" type="checkbox" checked>
                          </div>
                          <div class="field" id="model3d-destination-extra-field">
                            <label for="model3d-destination-extra">Extra Message In Destination</label>
                            <textarea id="model3d-destination-extra" placeholder="Optional extra text appended to the destination model post.">${input.model3dDestinationExtraText}</textarea>
                          </div>
                          <div class="toggle" id="model3d-include-model-toggle">
                            <span>Include model file (.glb/.gltf)</span>
                            <input id="model3d-include-model" type="checkbox" checked>
                          </div>
                          <div class="toggle" id="model3d-include-preview-toggle">
                            <span>Include preview image/GIF</span>
                            <input id="model3d-include-preview" type="checkbox" checked>
                          </div>
                          <div class="toggle" id="model3d-include-embed-toggle">
                            <span>Include metadata embed</span>
                            <input id="model3d-include-embed" type="checkbox" checked>
                          </div>
                          <div class="toggle" id="model3d-include-buttons-toggle">
                            <span>Include action buttons</span>
                            <input id="model3d-include-buttons" type="checkbox" checked>
                          </div>
                          <div class="toggle" id="model3d-upload-textures-toggle">
                            <span>Upload texture messages (Multi View / UV / Normal)</span>
                            <input id="model3d-upload-textures" type="checkbox">
                          </div>
                          <div class="field" id="model3d-texture-upload-target-field">
                            <label for="model3d-texture-upload-target">Texture Upload Location</label>
                            <select id="model3d-texture-upload-target">
                              <option value="target">Target channel/thread/post</option>
                              <option value="selected">Selected channel</option>
                            </select>
                          </div>
                          <div class="toggle" id="model3d-upload-multiview-toggle">
                            <span>Include Multi View texture message</span>
                            <input id="model3d-upload-multiview" type="checkbox" checked>
                          </div>
                          <div class="toggle" id="model3d-upload-uv-toggle">
                            <span>Include UV texture message</span>
                            <input id="model3d-upload-uv" type="checkbox" checked>
                          </div>
                          <div class="toggle" id="model3d-upload-normal-toggle">
                            <span>Include Normal texture message</span>
                            <input id="model3d-upload-normal" type="checkbox" checked>
                          </div>
                          <div class="toggle" id="model3d-generate-lowpoly-toggle">
                            <span>Generate Low Poly follow-up version</span>
                            <input id="model3d-generate-lowpoly" type="checkbox">
                          </div>
                          <div class="field" id="model3d-lowpoly-forum-channel-id-field">
                            <label for="model3d-lowpoly-forum-channel-id">Low Poly Forum Channel</label>
                            <select id="model3d-lowpoly-forum-channel-id">
                              <option value="">Post lowpoly in same destination</option>
                            </select>
                            <div class="hint">Optional override. If set, lowpoly follow-up is posted in this forum channel as its own forum post.</div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                  <div class="model3d-studio-panel studio-component-form-section" id="model3d-studio-panel-edit">
                    <div class="panel-subtitle model3d-texture-intro">Texture one 3D model with one source image using the Hunyuan 3D Paint workflow.</div>
                    <div class="field studio-step-card model3d-edit-card">
                      <label class="model3d-texture-flow-title"><span class="model3d-texture-step-number">1</span>${renderButtonIcon("cube")}<span>Select 3D model<small>Choose one mesh to texture.</small></span></label>
                      <div class="studio-tabs studio-subtabs" aria-label="3D edit target">
                        <button class="ghost active" data-model3d-edit-target="selected" type="button">${renderButtonIcon("cube")}<span>Selected Model</span></button>
                        <button class="ghost" data-model3d-edit-target="upload" type="button">${renderButtonIcon("file")}<span>Upload Model</span></button>
                      </div>
                      <div class="field" id="model3d-edit-selected-target-field">
                        <label for="model3d-edit-selected-model-name">Selected Generated Model</label>
                        <input id="model3d-edit-selected-model-name" placeholder="No model selected from history." readonly>
                        <div class="hint">Choose one mesh from Recent 3D Models or history.</div>
                      </div>
                      <div class="field hidden" id="model3d-edit-upload-target-field">
                        <label for="model3d-edit-upload-source-name">Uploaded Source Model File</label>
                        <input id="model3d-edit-upload-source-name" placeholder="No file selected." readonly>
                        <input id="model3d-edit-upload-source-file" type="file" accept=".obj,.glb,.gltf,.stl,.3mf,.ply" multiple hidden>
                        <div class="row">
                          <button class="secondary" id="model3d-edit-upload-browse-button">${renderButtonIcon("file")}<span>Choose 3D Files</span></button>
                          <button class="secondary" id="model3d-edit-upload-clear-button">${renderButtonIcon("trash")}<span>Clear Files</span></button>
                        </div>
                        <div class="hint">This is the alternative to Selected Model, not a second model input. Choose one OBJ, GLB, GLTF, STL, 3MF, or PLY mesh.</div>
                        <div class="toggle compact-toggle">
                          <span>Apply edit to all uploaded files</span>
                          <input id="model3d-edit-batch-enabled" type="checkbox">
                        </div>
                        <div class="row compact-row model3d-edit-batch-controls hidden" id="model3d-edit-batch-controls">
                          <button class="secondary mini-button" id="model3d-edit-select-all-button" type="button">Select All</button>
                          <button class="secondary mini-button" id="model3d-edit-deselect-all-button" type="button">Deselect All</button>
                        </div>
                        <div class="hint">When enabled, Studio applies the same finish and scale edit to each selected uploaded model in this list, one after another.</div>
                        <div class="model3d-source-list model3d-edit-upload-source-list" id="model3d-edit-upload-source-list"></div>
                      </div>
                      <div class="field model3d-texture-image-step">
                        <label for="model3d-texture-source-image-file" class="model3d-texture-flow-title"><span class="model3d-texture-step-number">2</span>${renderButtonIcon("image")}<span>Source image<small>Add an image to paint onto your model.</small></span></label>
                        <input id="model3d-texture-source-image-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                        <div class="model3d-texture-image-dropzone" id="model3d-texture-source-image-dropzone" tabindex="0" role="button" aria-label="Choose source image">
                          ${renderButtonIcon("image")}
                          <strong>Drop an image here</strong>
                          <span>or click to browse</span>
                          <small id="model3d-texture-source-image-name">PNG, JPG, or WebP</small>
                        </div>
                        <div class="row model3d-texture-image-actions">
                          <button class="secondary mini-button" id="model3d-texture-source-image-browse-button" type="button">Browse image</button>
                          <button class="secondary mini-button" id="model3d-texture-source-image-clear-button" type="button">Clear</button>
                        </div>
                        <button class="primary model3d-texture-submit" id="texture-model3d-button" type="button">${renderButtonIcon("wand")}<span>Texture model</span></button>
                      </div>
                      <details class="studio-details-panel studio-workflow-advanced">
                        <summary><span class="studio-workflow-advanced-title">${renderButtonIcon("settings")}<span>Blender adjustments</span></span><small>Optional</small></summary>
                        <div class="model3d-workflow-details-body">
                        <div class="model3d-edit-grid">
                        <div class="field">
                          <label for="model3d-edit-dimension-mode">Dimension</label>
                          <select id="model3d-edit-dimension-mode">
                            <option value="keep" selected>Keep current size</option>
                            <option value="manual">Manual target height</option>
                            <option value="llm">Let LLM decide height</option>
                          </select>
                        </div>
                        <div class="field">
                          <label for="model3d-edit-target-height">Target Height (m)</label>
                          <input id="model3d-edit-target-height" type="number" min="0.03" max="4000" step="0.01" value="1.80">
                        </div>
                        <div class="field">
                          <label for="model3d-edit-metallic-mode">Metallic</label>
                          <select id="model3d-edit-metallic-mode">
                            <option value="keep" selected>Keep current material</option>
                            <option value="enable">Force metallic</option>
                            <option value="disable">Force non-metallic</option>
                          </select>
                        </div>
                        <div class="field">
                          <label for="model3d-edit-roughness">Roughness <span class="label-soft" id="model3d-edit-roughness-value">0.50</span></label>
                          <input id="model3d-edit-roughness" type="range" min="0" max="1" step="0.01" value="0.5">
                          <div class="toggle compact-toggle">
                            <span>Apply roughness override</span>
                            <input id="model3d-edit-roughness-enabled" type="checkbox">
                          </div>
                        </div>
                      </div>
                        <div class="row">
                          <button class="secondary" id="apply-model3d-edit-button" type="button">${renderButtonIcon("wand")}<span>Apply Model Edit</span></button>
                        </div>
                        </div>
                      </details>
                    </div>
                    <details class="studio-details-panel studio-workflow-advanced model3d-secondary-workflow">
                      <summary><span class="studio-workflow-advanced-title">${renderButtonIcon("box")}<span>Low-poly conversion</span></span><small>Optional</small></summary>
                      <div class="model3d-workflow-details-body">
                        <div class="field">
                          <label for="model3d-lowpoly-upload-source-name">Low Poly Source Model File</label>
                          <input id="model3d-lowpoly-upload-source-name" placeholder="No file selected." readonly>
                          <input id="model3d-lowpoly-upload-source-file" type="file" accept=".glb,.gltf,.fbx,.obj,.stl,.ply,.dae,.3ds,.blend,.usd,.usdz" hidden>
                          <div class="row">
                            <button class="secondary" id="model3d-lowpoly-upload-browse-button">${renderButtonIcon("file")}<span>Choose 3D File</span></button>
                            <button class="secondary" id="model3d-lowpoly-upload-clear-button">${renderButtonIcon("trash")}<span>Clear File</span></button>
                          </div>
                          <div class="hint">Create a low poly version from an uploaded source model without running full image-to-3D generation.</div>
                        </div>
                        <div class="toggle">
                          <span>Let LLM choose low poly target faces</span>
                          <input id="model3d-lowpoly-upload-use-llm" type="checkbox">
                        </div>
                        <div class="field">
                          <label for="model3d-lowpoly-upload-target-faces">Uploaded File Target Faces</label>
                          <input id="model3d-lowpoly-upload-target-faces" type="number" min="1" step="1" value="1500">
                        </div>
                        <div class="row">
                          <button class="secondary" id="generate-model3d-lowpoly-upload-button">${renderButtonIcon("box")}<span>Generate Low Poly From File</span></button>
                        </div>
                      </div>
                    </details>
                  </div>
                  <div class="model3d-studio-panel studio-component-form-section" id="model3d-studio-panel-rigging">
                    <div class="model3d-generate-panel-head">
                      <strong>Rigging</strong>
                      <button class="secondary mini-button" id="model3d-rigging-open-panel-button" type="button">${renderButtonIcon("settings")}<span>Open Rig Panel</span></button>
                    </div>
                    <div class="field studio-step-card model3d-rigging-card">
                      <label>AutoRig Setup</label>
                      <div class="model3d-rigging-actions">
                        <button class="secondary mini-button" id="model3d-rigging-open-markers-button" type="button">${renderButtonIcon("settings")}<span>Manual Markers</span></button>
                        <button class="secondary mini-button" id="model3d-rigging-preview-button" type="button">${renderButtonIcon("sparkle")}<span>LLM Preview</span></button>
                        <button class="secondary mini-button" id="model3d-rigging-update-preview-button" type="button">${renderButtonIcon("refresh")}<span>Manual + LLM</span></button>
                        <button class="primary mini-button" id="model3d-rigging-finalize-button" type="button">${renderButtonIcon("save")}<span>Finalize Rig</span></button>
                      </div>
                      <div class="hint">Open the marker panel first for a no-LLM estimate, optionally run an LLM pass, then finalize with the verified marker positions.</div>
                    </div>
                  </div>
                </div>
                <div class="field model3d-main-threejs-panel">
                  <label>Viewport</label>
                  <div class="model3d-viewer-shell model3d-main-viewer-shell">
                    <div class="model3d-viewport-toolbar model3d-viewport-toolbar-left">
                      <button class="secondary mini-button" id="model3d-viewport-perspective-button" type="button">${renderButtonIcon("cube")}<span>Perspective</span></button>
                      <button class="secondary mini-button" id="model3d-viewport-lit-button" type="button">${renderButtonIcon("sparkle")}<span>Lit</span></button>
                      <button class="secondary mini-button" id="model3d-viewport-show-button" type="button">${renderButtonIcon("settings")}<span>Show</span></button>
                    </div>
                    <div class="model3d-viewport-toolbar model3d-viewport-toolbar-right">
                      <button class="secondary mini-button" id="model3d-viewport-frame-button" type="button" title="Frame selected" aria-label="Frame selected">${renderButtonIcon("expand")}<span>Frame</span></button>
                      <button class="secondary mini-button" id="model3d-viewport-focus-button" type="button" title="Focus selected" aria-label="Focus selected">${renderButtonIcon("settings")}<span>Focus</span></button>
                      <button class="secondary mini-button" id="model3d-viewport-orbit-button" type="button" title="Orbit settings" aria-label="Orbit settings">${renderButtonIcon("refresh")}<span>Orbit</span></button>
                      <button class="secondary mini-button" id="model3d-viewport-export-gif-button" type="button" title="Export preview GIF" aria-label="Export preview GIF">${renderButtonIcon("image")}<span>GIF</span></button>
                    </div>
                    <div class="model3d-canvas-stage">
                      <canvas id="model3d-canvas"></canvas>
                    </div>
                    <div class="model3d-axis-gizmo" id="model3d-axis-gizmo" role="group" aria-label="Viewport axis controls" title="Click an axis for a preset viewpoint. Drag the gizmo to orbit the view.">
                      <button class="model3d-axis-gizmo-axis axis-z-positive" data-model3d-gizmo-view="front" type="button" title="Front view" aria-label="Front view">Z</button>
                      <button class="model3d-axis-gizmo-axis axis-z-negative" data-model3d-gizmo-view="back" type="button" title="Back view" aria-label="Back view">Z</button>
                      <button class="model3d-axis-gizmo-axis axis-x-positive" data-model3d-gizmo-view="right" type="button" title="Right view" aria-label="Right view">X</button>
                      <button class="model3d-axis-gizmo-axis axis-x-negative" data-model3d-gizmo-view="left" type="button" title="Left view" aria-label="Left view">X</button>
                      <button class="model3d-axis-gizmo-axis axis-y-positive" data-model3d-gizmo-view="top" type="button" title="Top view" aria-label="Top view">Y</button>
                      <button class="model3d-axis-gizmo-axis axis-y-negative" data-model3d-gizmo-view="bottom" type="button" title="Bottom view" aria-label="Bottom view">Y</button>
                      <button class="model3d-axis-gizmo-center" data-model3d-gizmo-view="reset" type="button" title="Reset camera" aria-label="Reset camera">●</button>
                    </div>
                    <button class="model3d-projection-gizmo-button" id="model3d-gizmo-projection-button" type="button" title="Switch to orthographic projection" aria-label="Switch to orthographic projection" aria-pressed="false">${renderButtonIcon("box")}</button>
                    <div class="model3d-visible-viewer-options" aria-label="3D viewport display options">
                      <div class="model3d-visible-viewer-group" aria-label="Material display modes">
                        <span class="model3d-visible-viewer-group-title">Material</span>
                        <div class="model3d-visible-viewer-button-row">
                          <button class="secondary mini-button active" data-model3d-material-mode="textured" type="button">${renderButtonIcon("image")}<span>Textured</span></button>
                          <button class="secondary mini-button" data-model3d-material-mode="material" type="button">${renderButtonIcon("cube")}<span>Material</span></button>
                          <button class="secondary mini-button" data-model3d-material-mode="clay" type="button">${renderButtonIcon("box")}<span>Clay</span></button>
                          <button class="secondary mini-button" data-model3d-material-mode="normal" type="button">${renderButtonIcon("settings")}<span>Normals</span></button>
                        </div>
                      </div>
                      <div class="model3d-visible-viewer-group" aria-label="Surface and scene display toggles">
                        <span class="model3d-visible-viewer-group-title">Surface</span>
                        <div class="model3d-visible-viewer-button-row">
                          <button class="secondary mini-button" data-model3d-viewer-toggle="wireframe" type="button">${renderButtonIcon("file")}<span>Wire</span></button>
                          <button class="secondary mini-button active" data-model3d-viewer-toggle="metallic" type="button">${renderButtonIcon("sparkle")}<span>Metal</span></button>
                          <button class="secondary mini-button" data-model3d-viewer-toggle="flat" type="button">${renderButtonIcon("cube")}<span>Flat</span></button>
                          <button class="secondary mini-button" data-model3d-viewer-toggle="skybox" type="button">${renderButtonIcon("image")}<span>Skybox</span></button>
                          <label class="model3d-visible-viewer-slider" for="model3d-three-roughness-slider-main">
                            <span>Rough</span>
                            <input id="model3d-three-roughness-slider-main" data-model3d-roughness-slider type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Preview roughness">
                            <span data-model3d-roughness-value>0.50</span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div class="model3d-viewport-stats" id="model3d-viewport-stats" aria-label="Model stats">
                      <strong>Model Stats</strong>
                      <span>Vertices <b>248,531</b></span>
                      <span>Triangles <b>497,062</b></span>
                      <span>Faces <b>497,062</b></span>
                      <span>UV Sets <b>2</b></span>
                      <span>Materials <b>4</b></span>
                      <span>Texture Size <b>4096 x 4096</b></span>
                    </div>
                    <div class="model3d-viewport-transform-bar" aria-label="Transform controls">
                      <button class="secondary mini-button" id="model3d-transform-orbit-button" type="button" title="Orbit" aria-label="Orbit">${renderButtonIcon("refresh")}</button>
                      <button class="secondary mini-button" id="model3d-transform-pan-button" type="button" title="Pan" aria-label="Pan">${renderButtonIcon("hand")}</button>
                      <button class="secondary mini-button" id="model3d-transform-front-button" type="button" title="Front view" aria-label="Front view">${renderButtonIcon("expand")}</button>
                      <button class="secondary mini-button" id="model3d-transform-turntable-button" type="button" title="Turntable view" aria-label="Turntable view">${renderButtonIcon("refresh")}</button>
                      <button class="secondary mini-button" id="model3d-transform-scale-button" data-model3d-llm-real-height-action type="button" title="Estimate real-life height and scale with LLM" aria-label="Estimate real-life height and scale selected model with LLM">${renderButtonIcon("settings")}</button>
                      <button class="secondary mini-button" id="model3d-transform-grid-button" type="button" title="Toggle grid" aria-label="Toggle grid">${renderButtonIcon("box")}</button>
                    </div>
                    <div class="model3d-viewer-flyout">
                      <div class="model3d-viewer-flyout-card">
                        <div class="model3d-viewer-flyout-label">Preview</div>
                        <select id="model3d-preview-render-mode">
                          <option value="turntable">Turntable rotation</option>
                          <option value="current" selected>Current view</option>
                          <option value="front">Front angle</option>
                          <option value="back">Back angle</option>
                          <option value="left">Left angle</option>
                          <option value="right">Right angle</option>
                          <option value="top">Top angle</option>
                          <option value="three-quarter">Three-quarter angle</option>
                        </select>
                        <select id="model3d-preview-projection">
                          <option value="current" selected>Current projection</option>
                          <option value="perspective">Perspective</option>
                          <option value="orthographic">Orthographic</option>
                        </select>
                      </div>
                      <div class="model3d-viewer-flyout-card">
                        <div class="model3d-viewer-flyout-label">Grid</div>
                        <label class="model3d-viewer-toggle" for="model3d-grid-toggle">
                          <input id="model3d-grid-toggle" type="checkbox" checked>
                          <span>Show grid</span>
                        </label>
                        <label class="model3d-viewer-toggle" for="model3d-rig-toggle">
                          <input id="model3d-rig-toggle" type="checkbox">
                          <span>Show rig</span>
                        </label>
                      </div>
                      <div class="model3d-viewer-flyout-card">
                        <div class="model3d-viewer-flyout-label">Shade</div>
                        <div class="studio-chip-grid">
                          <button class="secondary mini-button" id="model3d-three-shade-flat" type="button" title="Flat" aria-label="Flat normals">${renderButtonIcon("box")}<span>Flat</span></button>
                          <button class="secondary mini-button active" id="model3d-three-shade-smooth" type="button" title="Smooth" aria-label="Smooth normals">${renderButtonIcon("box")}<span>Smooth</span></button>
                        </div>
                      </div>
                      <div class="model3d-viewer-flyout-card">
                        <div class="model3d-viewer-flyout-label">Variant</div>
                        <div class="studio-chip-grid">
                          <button class="secondary mini-button active" id="model3d-three-variant-lowpoly" type="button" title="Low Poly" aria-label="Show low poly variant">${renderButtonIcon("box")}<span>Low Poly</span></button>
                          <button class="secondary mini-button" id="model3d-three-variant-albedo" type="button" title="Geometry From Albedo" aria-label="Show geometry from albedo variant">${renderButtonIcon("sparkle")}<span>Albedo Geo</span></button>
                          <button class="secondary mini-button" id="model3d-three-variant-current" type="button" title="Merged" aria-label="Show merged current variant">${renderButtonIcon("settings")}<span>Merged</span></button>
                          <button class="secondary mini-button" id="model3d-three-variant-original" type="button" title="Original" aria-label="Show original variant">${renderButtonIcon("cube")}<span>Original</span></button>
                        </div>
                      </div>
                      <div class="model3d-viewer-flyout-card">
                        <div class="model3d-viewer-flyout-label">Material</div>
                        <div class="studio-chip-grid">
                          <button class="secondary mini-button" id="model3d-three-wireframe-button" type="button" title="Wireframe" aria-label="Toggle wireframe">${renderButtonIcon("file")}<span>Wireframe</span></button>
                          <button class="secondary mini-button active" id="model3d-three-metallic-button" type="button" title="Metallic" aria-label="Toggle metallic material">${renderButtonIcon("sparkle")}<span>Metallic</span></button>
                          <button class="secondary mini-button active" data-model3d-material-mode="textured" type="button" title="Textured material" aria-label="Show textured material">${renderButtonIcon("image")}<span>Textured</span></button>
                          <button class="secondary mini-button" data-model3d-material-mode="material" type="button" title="Material colors without textures" aria-label="Show material colors without textures">${renderButtonIcon("cube")}<span>Material</span></button>
                          <button class="secondary mini-button" data-model3d-material-mode="clay" type="button" title="Clay no-color preview" aria-label="Show clay no-color preview">${renderButtonIcon("box")}<span>Clay</span></button>
                          <button class="secondary mini-button" data-model3d-material-mode="normal" type="button" title="Normal direction preview" aria-label="Show normal direction preview">${renderButtonIcon("settings")}<span>Normals</span></button>
                          <label class="model3d-viewer-inline-slider" for="model3d-three-roughness-slider" title="Preview roughness">
                            <span>Rough</span>
                            <input id="model3d-three-roughness-slider" data-model3d-roughness-slider type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Preview roughness">
                            <span class="model3d-viewer-inline-slider-value" id="model3d-three-roughness-value" data-model3d-roughness-value>0.50</span>
                          </label>
                          <button class="secondary mini-button active" id="model3d-three-texture-button" type="button" title="Texture quick toggle" aria-label="Toggle texture display">${renderButtonIcon("image")}<span>Texture</span></button>
                          <button class="secondary mini-button" id="model3d-three-flat-shading-button" type="button" title="Flat Shading" aria-label="Toggle flat shading">${renderButtonIcon("cube")}<span>Flat</span></button>
                        </div>
                      </div>
                      <div class="model3d-viewer-flyout-card">
                        <div class="model3d-viewer-flyout-label">Axis</div>
                        <div class="studio-chip-grid">
                          <button class="secondary mini-button" id="model3d-three-axis-blender-button" type="button" title="Blender Axis" aria-label="Use Blender axis">${renderButtonIcon("hand")}<span>Blend</span></button>
                          <button class="secondary mini-button active" id="model3d-three-axis-gameengine-button" type="button" title="Game Engine Axis" aria-label="Use game engine axis">${renderButtonIcon("settings")}<span>Game</span></button>
                        </div>
                      </div>
                      <div class="model3d-viewer-flyout-card">
                        <div class="model3d-viewer-flyout-label">Actions</div>
                        <div class="studio-chip-grid">
                          <button class="secondary mini-button" id="model3d-three-scale-llm-button" data-model3d-llm-real-height-action type="button" title="Estimate real-life height and scale with LLM" aria-label="Estimate real-life height and scale selected model with LLM">${renderButtonIcon("settings")}<span>Scale</span></button>
                        </div>
                      </div>
                    </div>
                    <div class="model3d-viewer-overlay" id="model3d-threejs-status">Select a generated model to preview it here.</div>
                  </div>
                  <div class="model3d-preview-quick-actions">
                    <button class="secondary" id="model3d-open-in-blender-button" type="button">${renderButtonIcon("cube")}<span>Open In Blender</span></button>
                    <button class="secondary" id="model3d-llm-real-height-button" data-model3d-llm-real-height-action type="button" title="Estimate real-life height and uniformly scale the selected model">${renderButtonIcon("sparkle")}<span>Ask LLM For Real-Life Height</span></button>
                    <button class="secondary" id="model3d-separate-by-loose-parts-button" type="button">${renderButtonIcon("settings")}<span>Separate By Loose Parts</span></button>
                    <button class="secondary" id="model3d-rotate-button" type="button">${renderButtonIcon("video")}<span>Rotate</span></button>
                    <button class="secondary" id="model3d-delight-button" type="button">${renderButtonIcon("sparkle")}<span>Delight</span></button>
                    <button class="secondary" id="model3d-albedo-to-geometry-button" type="button">${renderButtonIcon("sparkle")}<span>Albedo To Geometry</span></button>
                    <button class="secondary" id="model3d-create-lowpoly-button" type="button">${renderButtonIcon("box")}<span>Create Lowpoly</span></button>
                    <button class="secondary" id="model3d-autorig-button" type="button">${renderButtonIcon("settings")}<span>Open Rig Panel</span></button>
                    <button class="secondary" id="model3d-send-menu-toggle" type="button" aria-expanded="false" aria-controls="model3d-send-destination-panel">${renderButtonIcon("upload")}<span>Send To ...</span></button>
                    <div class="studio-send-destination-panel hidden" id="model3d-send-destination-panel" role="dialog" aria-modal="true" aria-labelledby="model3d-send-destination-title">
                      <div class="studio-send-destination-header">
                        <div>
                          <strong id="model3d-send-destination-title">Send Model To ...</strong>
                          <small>Choose where the selected 3D model should open.</small>
                        </div>
                        <button class="secondary icon-button" id="model3d-send-destination-close" type="button" aria-label="Close Send To window">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="studio-send-destination-tabs" role="tablist" aria-label="3D model destinations">
                        <button class="active" data-model3d-send-tab="tool" type="button" role="tab" aria-selected="true">Tool</button>
                        <button data-model3d-send-tab="game-engine" type="button" role="tab" aria-selected="false">Game Engine</button>
                        <button data-model3d-send-tab="3d-suite" type="button" role="tab" aria-selected="false">3D Suite</button>
                        <button data-model3d-send-tab="3d-print" type="button" role="tab" aria-selected="false">3D Print</button>
                      </div>
                      <div class="studio-send-destination-content">
                        <div class="studio-send-destination-pane active" data-model3d-send-pane="tool" role="tabpanel">
                          <p>Send the selected model to a compatible local dashboard or desktop tool.</p>
                          <div class="studio-send-destination-actions studio-send-destination-actions-two">
                            <div class="studio-tool-picker" id="model3d-tool-picker">
                              <button class="secondary" id="model3d-tool-picker-toggle" type="button" aria-expanded="false">${renderButtonIcon("settings")}<span id="model3d-tool-picker-label">Select Tool</span></button>
                              <div class="studio-tool-picker-menu hidden" id="model3d-tool-picker-menu"></div>
                            </div>
                            <button class="secondary" id="model3d-send-to-tool-button" type="button">${renderButtonIcon("expand")}<span>Send 3D Model To Tool</span></button>
                          </div>
                          <div class="row model3d-quick-action-row model3d-tool-quick-actions" id="model3d-tool-quick-actions"></div>
                        </div>
                        <div class="studio-send-destination-pane hidden" data-model3d-send-pane="game-engine" role="tabpanel">
                          <p>Queue the selected model directly for Unity, Godot, or Unreal import.</p>
                          <div class="studio-send-destination-actions studio-send-destination-actions-two">
                            <div class="field">
                              <label for="model3d-game-engine-select">Target engine</label>
                              <select id="model3d-game-engine-select">
                                <option value="unity">Unity</option>
                                <option value="godot">Godot</option>
                                <option value="unreal">Unreal</option>
                              </select>
                            </div>
                            <div class="field">
                              <label for="model3d-game-engine-title">Export title</label>
                              <input id="model3d-game-engine-title" type="text" placeholder="Selected model name">
                            </div>
                          </div>
                          <button class="secondary studio-send-destination-primary-action" id="model3d-send-to-game-engine-button" type="button">${renderButtonIcon("upload")}<span>Queue Model Export</span></button>
                          <div class="hint" id="model3d-game-engine-send-status">Select a generated model to queue.</div>
                        </div>
                        <div class="studio-send-destination-pane hidden" data-model3d-send-pane="3d-suite" role="tabpanel">
                          <p>Continue editing the selected model in a desktop 3D suite.</p>
                          <div class="studio-send-destination-actions studio-send-destination-actions-two">
                            <div class="field">
                              <label for="model3d-suite-application-select">Application</label>
                              <select id="model3d-suite-application-select">
                                <option value="blender">Blender</option>
                              </select>
                            </div>
                            <button class="secondary" id="model3d-send-to-3d-suite-button" type="button">${renderButtonIcon("cube")}<span>Open In 3D Suite</span></button>
                          </div>
                        </div>
                        <div class="studio-send-destination-pane hidden" data-model3d-send-pane="3d-print" role="tabpanel">
                          <p>Send the selected model to Bambu Studio. Starting a physical print additionally needs a configured slicer preset and printer transport.</p>
                          <div class="studio-send-destination-actions">
                            <div class="field">
                              <label for="model3d-print-application-select">Application</label>
                              <select id="model3d-print-application-select">
                                <option value="bambu-studio">BambuLab Studio</option>
                              </select>
                            </div>
                            <div class="field model3d-print-executable-field">
                              <label for="model3d-print-executable-path">Resolved application path</label>
                              <input id="model3d-print-executable-path" type="text" readonly value="" placeholder="Detecting BambuLab Studio ...">
                              <small>Override at startup with <code>BAMBU_STUDIO_EXECUTABLE_PATH</code>.</small>
                            </div>
                            <div class="model3d-print-send-control">
                              <button class="secondary" id="model3d-send-to-3d-print-button" type="button">${renderButtonIcon("expand")}<span id="model3d-send-to-3d-print-label">Send to BambuLab</span></button>
                              <button class="secondary model3d-print-mode-toggle" id="model3d-send-to-3d-print-options-button" type="button" aria-label="BambuLab send options" aria-expanded="false" aria-controls="model3d-send-to-3d-print-options">&hellip;</button>
                              <div class="model3d-print-mode-menu hidden" id="model3d-send-to-3d-print-options" role="menu">
                                <button type="button" data-model3d-print-mode="send" role="menuitem">Send to BambuLab</button>
                                <button type="button" data-model3d-print-mode="print" role="menuitem">Send to BambuLab + Print</button>
                              </div>
                            </div>
                          </div>
                          <div class="hint" id="model3d-print-send-status">Select a generated model to send.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="model3d-quick-action-modal hidden" id="model3d-quick-action-modal" role="dialog" aria-modal="true" aria-labelledby="model3d-quick-action-modal-title">
                  <button class="model3d-quick-action-backdrop" id="model3d-quick-action-backdrop" type="button" aria-label="Close 3D quick action"></button>
                  <div class="model3d-quick-action-panel">
                    <div class="model3d-quick-action-head">
                      <div>
                        <div class="panel-kicker" id="model3d-quick-action-kicker">3D Quick Action</div>
                        <h4 id="model3d-quick-action-modal-title">Prepare Action</h4>
                      </div>
                      <button class="ghost compact" id="model3d-quick-action-close-button" type="button" aria-label="Close 3D quick action">&#10005;</button>
                    </div>
                    <div class="model3d-quick-action-body">
                      <div class="model3d-quick-action-preview">
                        <span class="model3d-quick-action-preview-label">Selected Model</span>
                        <strong id="model3d-quick-action-source-name">No model selected</strong>
                        <small id="model3d-quick-action-source-detail">Select a model to continue.</small>
                      </div>
                      <div class="model3d-quick-action-settings">
                        <div class="field" id="model3d-quick-action-mode-field">
                          <label for="model3d-quick-action-mode">Mode</label>
                          <select id="model3d-quick-action-mode">
                            <option value="blender">Blender</option>
                            <option value="studio">Studio</option>
                            <option value="comfyui">ComfyUI</option>
                            <option value="tool">Tool</option>
                          </select>
                        </div>
                        <div class="field hidden" id="model3d-quick-action-tool-note">
                          <label>Tool Mode</label>
                          <div class="hint">Tool mode sends the selected preview image into Toon Image Shader.</div>
                        </div>
                        <div class="field hidden" id="model3d-quick-action-studio-settings">
                          <label>Studio Preview Settings</label>
                          <div class="image-workflow-input-grid model3d-quick-action-grid">
                            <div class="field"><label for="model3d-quick-action-studio-size">Output Size</label><select id="model3d-quick-action-studio-size"><option value="256">256</option><option value="512">512</option><option value="768">768</option><option value="1024">1024</option></select></div>
                            <div class="field"><label for="model3d-quick-action-studio-frames">Frames</label><input id="model3d-quick-action-studio-frames" type="number" min="2" max="120" step="1" value="48"></div>
                            <div class="field"><label for="model3d-quick-action-studio-delay">Frame Delay</label><input id="model3d-quick-action-studio-delay" type="number" min="20" max="1000" step="10" value="60"></div>
                            <div class="field"><label for="model3d-quick-action-studio-background">Background</label><select id="model3d-quick-action-studio-background"><option value="solid">Solid</option><option value="transparent">Transparent</option><option value="scene">Scene</option><option value="skybox">Skybox</option></select></div>
                            <div class="field hidden" id="model3d-quick-action-studio-solid-color-field"><label for="model3d-quick-action-studio-solid-color">Solid Color</label><input id="model3d-quick-action-studio-solid-color" type="color" value="#0b0d1f"></div>
                          </div>
                          <div class="studio-toggle-grid">
                            <label class="toggle"><span>Include grid</span><input id="model3d-quick-action-studio-grid" type="checkbox"></label>
                            <label class="toggle"><span>Include axes</span><input id="model3d-quick-action-studio-axes" type="checkbox"></label>
                            <label class="toggle"><span>Include rig</span><input id="model3d-quick-action-studio-rig" type="checkbox"></label>
                            <label class="toggle"><span>Use multi view textures</span><input id="model3d-quick-action-studio-use-multiview" type="checkbox"></label>
                          </div>
                        </div>
                        <div class="field hidden" id="model3d-quick-action-blender-settings">
                          <label>Blender Capture Settings</label>
                          <div class="image-workflow-input-grid model3d-quick-action-grid">
                            <div class="field" id="model3d-quick-action-width-field"><label for="model3d-quick-action-width">Width</label><input id="model3d-quick-action-width" type="number" min="64" max="4096" step="1" value="1080"></div>
                            <div class="field" id="model3d-quick-action-height-field"><label for="model3d-quick-action-height">Height</label><input id="model3d-quick-action-height" type="number" min="64" max="4096" step="1" value="1080"></div>
                            <div class="field" id="model3d-quick-action-quality-field"><label for="model3d-quick-action-quality">Quality</label><input id="model3d-quick-action-quality" type="number" min="1" max="100" step="1" value="90"></div>
                            <div class="field" id="model3d-quick-action-engine-field"><label for="model3d-quick-action-engine">Engine</label><select id="model3d-quick-action-engine"><option value="BLENDER_WORKBENCH">Workbench</option><option value="BLENDER_EEVEE_NEXT">Eevee Next</option><option value="CYCLES">Cycles</option></select></div>
                            <div class="field" id="model3d-quick-action-projection-field"><label for="model3d-quick-action-projection">Projection</label><select id="model3d-quick-action-projection"><option value="ORTHO">Orthographic</option><option value="PERSP">Perspective</option></select></div>
                            <div class="field" id="model3d-quick-action-shading-field"><label for="model3d-quick-action-shading">Shading</label><select id="model3d-quick-action-shading"><option value="TEXTURE">Texture</option><option value="MATERIAL">Material</option></select></div>
                            <div class="field" id="model3d-quick-action-shadows-field"><label for="model3d-quick-action-shadows">Shadows</label><select id="model3d-quick-action-shadows"><option value="off">Off</option><option value="on">On</option></select></div>
                            <div class="field" id="model3d-quick-action-zoom-field"><label for="model3d-quick-action-zoom">Zoom</label><input id="model3d-quick-action-zoom" type="number" min="0.01" max="10" step="0.01" value="1.35"></div>
                            <div class="field" id="model3d-quick-action-rotate-target-field"><label for="model3d-quick-action-rotate-target">Rotate Target</label><select id="model3d-quick-action-rotate-target"><option value="object">Object</option><option value="camera">Camera</option></select></div>
                            <div class="field" id="model3d-quick-action-axis-field"><label for="model3d-quick-action-axis">Axis</label><select id="model3d-quick-action-axis"><option value="Z">Z</option><option value="X">X</option><option value="Y">Y</option></select></div>
                            <div class="field" id="model3d-quick-action-degrees-field"><label for="model3d-quick-action-degrees">Degrees</label><input id="model3d-quick-action-degrees" type="number" min="1" max="3600" step="1" value="360"></div>
                            <div class="field" id="model3d-quick-action-frames-field"><label for="model3d-quick-action-frames">Frames</label><input id="model3d-quick-action-frames" type="number" min="2" max="240" step="1" value="32"></div>
                            <div class="field" id="model3d-quick-action-background-field"><label for="model3d-quick-action-background">Background</label><select id="model3d-quick-action-background"><option value="transparent">Transparent</option><option value="solidcolor">Solid Color</option><option value="skybox">Skybox</option></select></div>
                            <div class="field" id="model3d-quick-action-bg-color-field">
                              <label for="model3d-quick-action-bg-color">Background Color</label>
                              <div class="model3d-background-color-chooser">
                                <input id="model3d-quick-action-bg-color" type="color" value="#320000" aria-describedby="model3d-quick-action-bg-color-value">
                                <output id="model3d-quick-action-bg-color-value" for="model3d-quick-action-bg-color" aria-live="polite">#320000</output>
                              </div>
                              <div class="model3d-background-color-swatches" role="group" aria-label="Background color presets">
                                <button type="button" data-model3d-background-color="#111827" aria-label="Midnight blue"></button><button type="button" data-model3d-background-color="#320000" aria-label="Deep red"></button><button type="button" data-model3d-background-color="#193c2b" aria-label="Forest green"></button><button type="button" data-model3d-background-color="#4a2d11" aria-label="Warm brown"></button><button type="button" data-model3d-background-color="#4c1d95" aria-label="Deep violet"></button><button type="button" data-model3d-background-color="#e7edf7" aria-label="Soft white"></button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="field hidden" id="model3d-quick-action-albedo-settings">
                          <label>Albedo Geometry Settings</label>
                          <div class="image-workflow-input-grid model3d-quick-action-grid">
                            <div class="field"><label for="model3d-quick-action-albedo-strength">Height Strength</label><input id="model3d-quick-action-albedo-strength" type="number" min="0" max="10" step="0.01" value="0.05"></div>
                            <div class="field"><label for="model3d-quick-action-albedo-topology-mode">Topology Modifier</label><select id="model3d-quick-action-albedo-topology-mode"><option value="subdivision">Subdivision Surface</option><option value="multiresolution">Multiresolution</option></select></div>
                            <div class="field"><label for="model3d-quick-action-albedo-subdivisions">Topology Subdivision Levels</label><input id="model3d-quick-action-albedo-subdivisions" type="number" min="0" max="8" step="1" value="0"></div>
                            <div class="field"><label for="model3d-quick-action-albedo-blur">Blur Radius</label><input id="model3d-quick-action-albedo-blur" type="number" min="0" max="10" step="1" value="1"></div>
                            <div class="field"><label for="model3d-quick-action-albedo-merge-distance">Weld Distance</label><input id="model3d-quick-action-albedo-merge-distance" type="number" min="0" max="0.1" step="0.000001" value="0.000001"></div>
                          </div>
                          <div class="model3d-face-budget" id="model3d-quick-action-albedo-face-budget" data-risk="loading">
                            <div class="model3d-face-budget-head"><strong>Face Count Estimate</strong><span id="model3d-quick-action-albedo-face-risk">Inspecting</span></div>
                            <div class="model3d-face-budget-values">
                              <span>Current <strong id="model3d-quick-action-albedo-current-faces">...</strong></span>
                              <span>Estimated Target <strong id="model3d-quick-action-albedo-target-faces">...</strong></span>
                            </div>
                            <div class="model3d-face-budget-track" role="meter" aria-label="Estimated target face count" aria-valuemin="0" aria-valuemax="2400000" aria-valuenow="0">
                              <span id="model3d-quick-action-albedo-face-bar"></span>
                            </div>
                            <div class="hint" id="model3d-quick-action-albedo-face-hint">Reading the selected model variant.</div>
                          </div>
                          <div class="studio-toggle-grid">
                            <label class="toggle"><span>Smooth shading</span><input id="model3d-quick-action-albedo-auto-smooth" type="checkbox" checked></label>
                            <label class="toggle"><span>Selected faces only</span><input id="model3d-quick-action-albedo-selected-faces-only" type="checkbox"></label>
                            <label class="toggle"><span>Weld before modifier</span><input id="model3d-quick-action-albedo-merge-before-subdivide" type="checkbox" checked></label>
                            <label class="toggle"><span>Weld after modifier</span><input id="model3d-quick-action-albedo-merge-after-subdivide" type="checkbox" checked></label>
                          </div>
                          <div class="hint">The mesh is optionally welded before the modifier and again after it is converted to real topology. Welding preserves UV and material seams.</div>
                        </div>
                        <div class="hint" id="model3d-quick-action-mode-hint">Choose how this quick action should run.</div>
                      </div>
                    </div>
                    <div class="model3d-quick-action-foot">
                      <div class="hint model3d-quick-action-run-status hidden" id="model3d-quick-action-run-status" role="status" aria-live="polite"></div>
                      <button class="secondary" id="model3d-quick-action-cancel-button" type="button">Cancel</button>
                      <button id="model3d-quick-action-run-button" type="button">Run</button>
                    </div>
                  </div>
                </div>
                <div class="model3d-bottom-dock">
                  <section class="model3d-dock-panel model3d-recent-models-panel">
                    <div class="studio-tabs">
                      <button class="active" type="button">Recent Models</button>
                      <button type="button">Favorites</button>
                    </div>
                    <div class="recent-media-controls" id="model3d-recent-media-controls"></div>
                    <div class="studio-bounded-section model3d-recent-scroll">
                      <div class="list medium-list" id="model3d-history-list"></div>
                    </div>
                  </section>
                <section class="model3d-dock-panel model3d-queue-panel studio-component-queue">
                    <div class="studio-tabs">
                      <button class="active" type="button">Generation Queue</button>
                      <button type="button">Console</button>
                      <button class="model3d-dock-close" type="button" aria-label="Close queue">x</button>
                    </div>
                    <div class="model3d-queue-list" id="model3d-bottom-queue-list"></div>
                  </section>
                </div>
              </div>
              <div class="studio-workflow-side-resizer" data-workflow-sidebar-resizer="model3d" aria-hidden="true"></div>
              <aside class="studio-workflow-side model3d-studio-side" id="model3d-sidebar-panel" data-workflow-sidebar-panel="model3d" data-studio-inspector-panel="true">
                <div class="studio-tabs studio-inspector-tabs" role="tablist" aria-label="3D inspector">
                  <button class="active" type="button">Model</button>
                  <button type="button">Generation</button>
                  <button type="button">Materials</button>
                  <button type="button">Export</button>
                  <button type="button">History</button>
                </div>
                <div class="model3d-inspector-section">
                  <div class="model3d-transform-grid">
                    <span>Position</span><input value="X  0.00"><input value="Y  0.00"><input value="Z  0.00">
                    <span>Rotation</span><input value="X  0°"><input value="Y  0°"><input value="Z  0°">
                    <span>Scale</span><input value="X  1.00"><input value="Y  1.00"><input value="Z  1.00">
                  </div>
                </div>
                <div class="model3d-inspector-section">
                  <div class="field"><label for="model3d-inspector-mesh-name">Mesh Name</label><input id="model3d-inspector-mesh-name" placeholder="Select a model" value=""></div>
                  <div class="field"><label for="model3d-inspector-lod-group">LOD Group</label><select id="model3d-inspector-lod-group"><option>None</option><option>Prop</option><option>Hero Asset</option></select></div>
                  <label class="toggle compact-toggle"><span>Auto LOD</span><input id="model3d-inspector-auto-lod" type="checkbox" checked></label>
                  <button class="secondary" id="model3d-inspector-generate-lods-button" type="button">Generate LODs</button>
                  <div class="model3d-inspector-lod-results" id="model3d-inspector-lod-results"></div>
                </div>
                <div class="model3d-inspector-section">
                  <div class="model3d-material-list">
                    <span>No material data loaded.</span>
                  </div>
                </div>
                <div class="model3d-inspector-section">
                  <div class="field"><label for="model3d-inspector-uv">UV Sets</label><select id="model3d-inspector-uv"><option>Unknown</option><option>1</option><option>2</option></select></div>
                  <div class="field"><label for="model3d-inspector-texture-resolution">Texture Resolution</label><select id="model3d-inspector-texture-resolution"><option>4096 x 4096</option><option>2048 x 2048</option></select></div>
                  <label class="toggle compact-toggle"><span>Channel Packing</span><input type="checkbox" checked></label>
                  <button class="secondary" id="model3d-inspector-rebuild-textures-button" type="button">Rebuild Textures</button>
                </div>
                <div class="field studio-step-card model3d-side-card model3d-recent-images-card">
                  <label>Recent Images</label>
                  <div class="model3d-recent-image-list" id="model3d-recent-image-list"></div>
                </div>
                <div class="field studio-step-card model3d-side-card model3d-side-card-tools">
                  <label>Studio Tools</label>
                  <div class="row model3d-preview-actions">
                    <button class="secondary" id="generate-model3d-lowpoly-selected-button">${renderButtonIcon("box")}<span>Generate Low Poly From Selected Model</span></button>
                    <button class="secondary" id="model3d-open-in-blender-selected-button" type="button">${renderButtonIcon("cube")}<span>Open In Blender</span></button>
                    <button class="secondary" id="model3d-autorig-selected-button">${renderButtonIcon("settings")}<span>Open Rig Panel</span></button>
                    <button class="secondary" id="model3d-export-gif-button">${renderButtonIcon("video")}<span>Export Preview GIF</span></button>
                    <button class="secondary" id="comfy-free-button">${renderButtonIcon("trash")}<span>Unload ComfyUI Models</span></button>
                  </div>
                  <div class="model3d-sidebar-advanced-stack" id="model3d-sidebar-advanced-stack"></div>
                </div>
                <div class="field studio-step-card model3d-side-card model3d-autorig-card hidden" id="model3d-autorig-verification-card">
                  <div class="model3d-autorig-modal-head">
                    <button class="secondary mini-button" id="model3d-autorig-back-button" type="button"><span>Back</span></button>
                    <strong>Rig Panel</strong>
                    <button class="secondary mini-button" id="model3d-autorig-clear-button" type="button">${renderButtonIcon("trash")}<span>Close</span></button>
                  </div>
                  <div class="studio-tabs studio-subtabs" role="tablist" aria-label="Rigging mode">
                    <button class="active" id="model3d-autorig-basic-tab" data-autorig-tab="basic" type="button">Basic</button>
                    <button id="model3d-autorig-advanced-tab" data-autorig-tab="advanced" type="button">Advanced</button>
                  </div>
                  <div class="model3d-autorig-modal-body">
                    <div class="model3d-autorig-marker-rail" id="model3d-autorig-marker-rail"></div>
                    <div class="model3d-autorig-stage-shell">
                      <div class="model3d-autorig-stage" id="model3d-autorig-stage"></div>
                    </div>
                    <aside class="model3d-autorig-help-panel">
                      <h4>Place Markers</h4>
                      <p>Drag each colored ring onto the matching body joint, then finish the AutoRig pass.</p>
                      <div class="model3d-autorig-help-preview" id="model3d-autorig-help-preview"></div>
                      <div class="model3d-autorig-mode-panel" data-autorig-panel="basic">
                        <h4>Basic Rig</h4>
                        <p>Standard humanoid marker fitting for body, arms, legs, hands, and feet.</p>
                      </div>
                      <div class="model3d-autorig-mode-panel hidden" data-autorig-panel="advanced">
                        <h4>Advanced Rigging</h4>
                        <p>Add extended humanoid controls after the basic body landmarks look correct.</p>
                        <div class="model3d-autorig-option-stack">
                          <label><input id="model3d-autorig-advanced-face" type="checkbox"> Face controls</label>
                          <label><input id="model3d-autorig-advanced-teeth" type="checkbox"> Teeth bones</label>
                          <label><input id="model3d-autorig-advanced-tongue" type="checkbox"> Tongue bones</label>
                          <label><input id="model3d-autorig-advanced-eyes" type="checkbox"> Eye controls</label>
                        </div>
                      </div>
                      <h4>LLM Debug</h4>
                      <pre class="model3d-autorig-debug" id="model3d-autorig-debug-output">No rig payload prepared yet.</pre>
                    </aside>
                  </div>
                  <div class="model3d-autorig-modal-foot">
                    <label class="model3d-autorig-symmetry-toggle">
                      <input id="model3d-autorig-symmetry" type="checkbox" checked>
                      <span>Use Symmetry</span>
                    </label>
                    <label class="model3d-autorig-lod-field" for="model3d-autorig-lod-select">
                      <span>Skeleton LOD</span>
                      <select id="model3d-autorig-lod-select">
                        <option value="auto">Auto</option>
                        <option value="basic_human">Standard Skeleton</option>
                        <option value="cat">Cat</option>
                        <option value="wolf">Wolf / Dog</option>
                        <option value="horse">Horse</option>
                        <option value="basic_quadruped">Basic Quadruped</option>
                        <option value="bird">Bird</option>
                        <option value="shark">Shark / Fish</option>
                        <option value="basic_bones">Basic Bones</option>
                        <option value="human" data-autorig-advanced-option="true">Extended Human</option>
                      </select>
                    </label>
                    <div class="row model3d-autorig-editor-actions">
                      <button class="secondary mini-button" id="model3d-autorig-refresh-preview-button" type="button">${renderButtonIcon("refresh")}<span>Run LLM Pass</span></button>
                      <button class="secondary mini-button" id="model3d-autorig-manual-refresh-button" type="button">${renderButtonIcon("settings")}<span>Manual Preview</span></button>
                      <button class="primary mini-button" id="model3d-autorig-finalize-button" type="button"><span>Finalize</span></button>
                    </div>
                  </div>
                </div>
                <div class="model3d-side-card">
                  ${renderStudioStatusPanel({
                    statusKey: "model3d",
                    initialMessage: "No 3D model job run yet.",
                    progressLabel: "3D model generation progress"
                  })}
                </div>
                <div class="field studio-step-card model3d-side-card studio-component-preview-card">
                  <label>Model Preview</label>
                  <div class="model3d-viewer-shell model3d-side-preview-shell">
                    <img id="model3d-preview-media" alt="Generated model preview">
                    <div class="model3d-viewer-overlay" id="model3d-viewer-status">Select a generated model to preview it here.</div>
                  </div>
                </div>
                <div class="field studio-step-card model3d-side-card">
                  <label>Source Image</label>
                  <div class="model3d-source-preview-shell" id="model3d-source-image-shell">
                    <img class="hidden" id="model3d-source-image-preview" alt="Stored source image used for 3D model generation">
                    <div class="model3d-source-preview-empty" id="model3d-source-image-empty">Select a generated model to view its stored source image.</div>
                  </div>
                  <div class="hint" id="model3d-source-image-name">No source image available.</div>
                </div>
                <div class="field studio-step-card model3d-side-card">
                  <div class="model3d-variant-gallery" id="model3d-variant-gallery"></div>
                </div>
                <div class="field studio-step-card model3d-side-card">
                  <div class="model3d-texture-gallery" id="model3d-texture-gallery"></div>
                </div>
                <div class="model3d-gif-export-modal hidden" id="model3d-gif-export-modal" role="dialog" aria-modal="true" aria-labelledby="model3d-gif-export-title">
                  <div class="model3d-gif-export-dialog">
                    <div class="model3d-gif-export-head">
                      <div>
                        <span class="image-preview-context-badge">Viewport Export</span>
                        <h4 id="model3d-gif-export-title">Export 3D GIF</h4>
                      </div>
                      <button class="secondary mini-button" id="model3d-gif-export-close-button" type="button" aria-label="Close GIF export settings">${renderButtonIcon("close")}</button>
                    </div>
                    <div class="model3d-gif-export-body">
                      <div class="model3d-gif-export-preview">
                        <strong id="model3d-gif-export-source-name">No model selected</strong>
                        <small id="model3d-gif-export-source-detail">Select a generated model first.</small>
                      </div>
                      <div class="model3d-gif-export-settings">
                        <div class="model3d-gif-export-grid">
                          <div class="field">
                            <label for="model3d-gif-export-size">Output Size</label>
                            <select id="model3d-gif-export-size">
                              <option value="320">320 x 320</option>
                              <option value="512" selected>512 x 512</option>
                              <option value="640">640 x 640</option>
                            </select>
                          </div>
                          <div class="field">
                            <label for="model3d-gif-export-frames">Frames</label>
                            <input id="model3d-gif-export-frames" type="number" min="2" max="120" step="1" value="48">
                          </div>
                          <div class="field">
                            <label for="model3d-gif-export-delay">Frame Delay</label>
                            <input id="model3d-gif-export-delay" type="number" min="20" max="1000" step="10" value="60">
                          </div>
                          <div class="field">
                            <label for="model3d-gif-export-background-mode">Background</label>
                            <select id="model3d-gif-export-background-mode">
                              <option value="solid" selected>Solid Color</option>
                              <option value="skybox">Skybox</option>
                              <option value="transparent">Transparent</option>
                              <option value="scene">Current Scene</option>
                            </select>
                          </div>
                          <div class="field" id="model3d-gif-export-solid-color-field">
                            <label for="model3d-gif-export-solid-color">Solid Color</label>
                            <input id="model3d-gif-export-solid-color" type="color" value="#0b0d1f">
                          </div>
                        </div>
                        <div class="studio-toggle-grid model3d-gif-export-toggles">
                          <label class="toggle"><span>Include grid</span><input id="model3d-gif-export-include-grid" type="checkbox"></label>
                          <label class="toggle"><span>Include axes</span><input id="model3d-gif-export-include-axes" type="checkbox"></label>
                          <label class="toggle"><span>Include rig</span><input id="model3d-gif-export-include-rig" type="checkbox"></label>
                        </div>
                      </div>
                    </div>
                    <div class="model3d-gif-export-foot">
                      <button class="secondary" id="model3d-gif-export-cancel-button" type="button">Cancel</button>
                      <button class="primary" id="model3d-gif-export-run-button" type="button">${renderButtonIcon("video")}<span>Export GIF</span></button>
                    </div>
                  </div>
                </div>
                <div class="field studio-step-card model3d-side-card model3d-meta-card studio-component-metadata">
                  <label>Model Details</label>
                  <div class="output simulation-output studio-component-metadata" id="model3d-meta-output">No model selected.</div>
                </div>
              </aside>
            </div>
            ${renderWorkflowSettingsFooter([
              {
                panel: "model3d-comfy",
                title: "3D ComfyUI Endpoint + Path Settings",
                kicker: "3D Model Studio",
                label: "3D ComfyUI + Paths"
              },
              {
                panel: "model3d-llm",
                title: "3D LLM Connection Settings (Prompt + Filename)",
                kicker: "3D Model Studio",
                label: "3D LLM Connection"
              }
            ])}
          </article>
          <article class="panel-card ai-section-target ai-detail-card image-studio-generate-mode" id="image-studio-card">
            <div class="image-editor-appbar">
              <div class="image-appbar-brand">
                <span class="image-app-logo">${renderButtonIcon("image")}</span>
                <span class="image-app-title">Image Studio</span>
                <span class="model3d-beta-pill">Beta</span>
              </div>
              <button class="secondary image-project-dropdown" type="button"><span>Project: Fantasy Characters</span>${renderButtonIcon("expand")}</button>
              <div class="image-appbar-actions">
                <span class="image-autosave-status"><span aria-hidden="true"></span>Auto-save</span>
                <button class="secondary mini-button" type="button" title="Undo" aria-label="Undo">${renderButtonIcon("refresh")}</button>
                <button class="secondary mini-button" type="button" title="Redo" aria-label="Redo">${renderButtonIcon("refresh")}</button>
                <button class="secondary mini-button" type="button" title="Settings" aria-label="Settings">${renderButtonIcon("settings")}</button>
                <button class="secondary mini-button" type="button" title="Help" aria-label="Help">${renderButtonIcon("history")}</button>
                <button class="secondary mini-button image-share-button" type="button">${renderButtonIcon("upload")}<span>Share</span></button>
                <span class="image-user-avatar">JD</span>
              </div>
            </div>
            <div class="studio-card-header">
              <div class="panel-heading">
                <h3>Image Studio</h3>
                <div class="panel-subtitle">Generate single images from prompts, keep previews in view, and trigger follow-up workflows quickly.</div>
              </div>
              <div class="studio-card-header-actions">
                <button class="secondary workflow-sidebar-toggle-button" id="image-sidebar-toggle-button" data-workflow-sidebar-toggle="image" aria-controls="image-sidebar-panel" aria-expanded="true" aria-pressed="false" type="button">${renderButtonIcon("expand")}<span data-workflow-sidebar-toggle-label>Hide Sidebar</span></button>
                <button class="secondary studio-history-button" data-ai-scroll-target="image-bottom-filmstrip" type="button">${renderButtonIcon("history")}<span>History</span></button>
              </div>
            </div>
            <div class="studio-workflow-layout image-studio-workspace" data-workflow-sidebar-workspace="image">
              <div class="studio-workflow-main studio-component-form image-studio-main">
                <div class="image-studio-preview-panel image-studio-preview-panel-main studio-component-preview-card" id="image-studio-preview-panel">
                  <div class="image-canvas-toolbar">
                    <button class="secondary mini-button" type="button">${renderButtonIcon("image")}<span>Current Image</span></button>
                    <span class="image-canvas-toolbar-spacer"></span>
                    <button class="secondary mini-button" type="button"><span>100%</span></button>
                    <button class="secondary mini-button" type="button" title="Zoom out" aria-label="Zoom out"><span>-</span></button>
                    <button class="secondary mini-button" type="button" title="Zoom in" aria-label="Zoom in"><span>+</span></button>
                    <button class="secondary mini-button" type="button" title="Pan" aria-label="Pan">${renderButtonIcon("hand")}</button>
                    <button class="secondary mini-button" id="image-preview-reveal-button" data-reveal-slider-button="image" type="button" title="Compare selected variant with original" aria-label="Reveal slider">${renderButtonIcon("copy")}<span>Reveal Slider</span></button>
                    <button class="secondary mini-button" id="image-preview-focus-button" type="button" title="Focus preview" aria-label="Focus preview">${renderButtonIcon("expand")}</button>
                  </div>
                  <div class="image-studio-preview-header">
                    <div>
                      <label>Preview</label>
                      <div class="hint" id="image-preview-context-detail">Preview follows the selected generated image.</div>
                    </div>
                    <div class="image-preview-context-meta">
                      <span class="image-preview-context-badge" id="image-preview-context-badge">Generated</span>
                      <span class="image-preview-context-name" id="image-preview-context-name">No image selected</span>
                    </div>
                  </div>
                  <div class="image-preview-metadata-badge">
                    <span id="image-preview-metadata-size">Size: unknown</span>
                    <span id="image-preview-metadata-steps">Steps: unknown</span>
                    <span id="image-preview-metadata-cfg">CFG: unknown</span>
                    <span id="image-preview-metadata-seed">Seed: unknown</span>
                  </div>
                  <img id="imagegen-preview" alt="Generated preview">
                  <video class="hidden" id="imagegen-preview-video" playsinline muted preload="metadata"></video>
                  <canvas class="hidden" id="imagegen-preview-canvas" aria-label="GIF frame preview"></canvas>
                  <div class="image-generation-placeholder hidden" id="image-generation-placeholder" role="status" aria-live="polite" aria-label="Image generation in progress">
                    <div class="image-generation-placeholder-field" aria-hidden="true"></div>
                    <div class="image-generation-placeholder-copy">
                      <strong>Generating image</strong>
                      <span>Shaping pixels from your prompt</span>
                    </div>
                  </div>
                  <button class="image-play-overlay hidden" id="image-preview-play-overlay" type="button" aria-label="Play preview media">${renderButtonIcon("video")}</button>
                  <div class="hint image-preview-scrub-hint hidden" id="image-preview-scrub-hint">Drag left or right on the preview to step frames. Hold Ctrl before dragging; each 48px moves one quarter turn.</div>
                  <div class="image-preview-reveal hidden" id="image-preview-reveal">
                    <div class="image-preview-reveal-stage" id="image-preview-reveal-stage">
                      <img class="image-preview-reveal-image image-preview-reveal-source" id="image-preview-reveal-source" alt="Source image preview">
                      <div class="image-preview-reveal-overlay" id="image-preview-reveal-overlay">
                        <img class="image-preview-reveal-image image-preview-reveal-result" id="image-preview-reveal-result" alt="Pixel art result preview">
                      </div>
                      <div class="image-preview-reveal-divider" id="image-preview-reveal-divider" aria-hidden="true"></div>
                    </div>
                    <label class="image-preview-reveal-control" for="image-preview-reveal-slider">
                      <span>Reveal Slider</span>
                      <input id="image-preview-reveal-slider" type="range" min="0" max="100" step="1" value="50" aria-label="Reveal comparison split">
                      <span><span id="image-preview-reveal-value">50</span>%</span>
                    </label>
                  </div>
                  <div class="row image-studio-preview-tools studio-component-toolbar">
                    <button class="secondary mini-button" id="image-rotate-button" type="button">${renderButtonIcon("video")}<span>Rotate 360 Clip</span></button>
                    <button class="secondary mini-button" id="image-to-3d-button" type="button">${renderButtonIcon("cube")}<span>Create 3D From Preview</span></button>
                    <button class="secondary mini-button" id="image-to-video-button" type="button">${renderButtonIcon("video")}<span>Generate Video From Image</span></button>
                    <button class="secondary mini-button" id="image-regenerate-from-prompt-button" type="button">${renderButtonIcon("refresh")}<span>Regenerate From Prompt</span></button>
                    <button class="secondary mini-button" id="image-remove-background-button" type="button">${renderButtonIcon("wand")}<span>Remove Background</span></button>
                    <button class="secondary mini-button" id="image-remove-background-crop-button" type="button">${renderButtonIcon("wand")}<span>Remove Background + Crop</span></button>
                    <button class="secondary mini-button" id="image-separate-layers-button" type="button">${renderButtonIcon("image")}<span">Layers</span></button>
                    <button class="secondary mini-button" id="image-upscale-button" type="button">${renderButtonIcon("expand")}<span>Upscale</span></button>
                    <button class="secondary mini-button" id="image-pixel-art-button" type="button">${renderButtonIcon("image")}<span>Convert To Pixel Art</span></button>
                    <button class="secondary mini-button" id="image-delight-button" type="button">${renderButtonIcon("sparkle")}<span>Delight Image</span></button>
                    <button class="secondary mini-button" id="image-normal-map-button" type="button">${renderButtonIcon("image")}<span>Create Normal Map</span></button>
                  </div>
                  <div class="row image-studio-preview-tools studio-component-toolbar">
                    <button class="secondary mini-button" id="image-preview-download-button" type="button">${renderButtonIcon("download")}<span>Download Preview</span></button>
                    <button class="secondary mini-button" id="image-send-menu-toggle" type="button" aria-expanded="false" aria-controls="image-send-destination-panel">${renderButtonIcon("upload")}<span>Send To ...</span></button>
                    <div class="studio-send-destination-panel hidden" id="image-send-destination-panel" role="dialog" aria-modal="true" aria-labelledby="image-send-destination-title">
                      <div class="studio-send-destination-header">
                        <div>
                          <strong id="image-send-destination-title">Send Image To ...</strong>
                          <small>Choose where the selected image should open.</small>
                        </div>
                        <button class="secondary icon-button" id="image-send-destination-close" type="button" aria-label="Close Send To window">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="studio-send-destination-tabs" role="tablist" aria-label="Image destinations">
                        <button class="active" data-image-send-tab="tool" type="button" role="tab" aria-selected="true">Tool</button>
                        <button data-image-send-tab="game-engine" type="button" role="tab" aria-selected="false">Game Engine</button>
                        <button data-image-send-tab="3d-suite" type="button" role="tab" aria-selected="false">3D Suite</button>
                      </div>
                      <div class="studio-send-destination-content">
                        <div class="studio-send-destination-pane active" data-image-send-pane="tool" role="tabpanel">
                          <p>Send the selected image to a compatible local dashboard or desktop tool.</p>
                          <div class="studio-send-destination-actions studio-send-destination-actions-two">
                            <div class="studio-tool-picker" id="image-tool-picker">
                              <button class="secondary" id="image-tool-picker-toggle" type="button" aria-expanded="false">${renderButtonIcon("settings")}<span id="image-tool-picker-label">Select Tool</span></button>
                              <div class="studio-tool-picker-menu hidden" id="image-tool-picker-menu"></div>
                            </div>
                            <button class="secondary" id="image-send-to-tool-button" type="button">${renderButtonIcon("expand")}<span>Send Image To Tool</span></button>
                          </div>
                        </div>
                        <div class="studio-send-destination-pane hidden" data-image-send-pane="game-engine" role="tabpanel">
                          <p>Queue the selected image for Unity, Godot, or Unreal import.</p>
                          <button class="secondary studio-send-destination-primary-action" id="image-send-to-game-engine-button" type="button">${renderButtonIcon("upload")}<span>Choose Game Engine ...</span></button>
                        </div>
                        <div class="studio-send-destination-pane hidden" data-image-send-pane="3d-suite" role="tabpanel">
                          <p>Open the selected image on a plane in a desktop 3D suite.</p>
                          <button class="secondary studio-send-destination-primary-action" id="image-import-blender-button" type="button">${renderButtonIcon("cube")}<span>Open In Blender</span></button>
                        </div>
                      </div>
                    </div>
                    <button class="secondary mini-button" id="image-use-as-tool-logo-button" type="button">${renderButtonIcon("save")}<span>Use As Tool Logo</span></button>
                  </div>
                  <div class="row image-studio-preview-tools image-tool-quick-actions" id="image-tool-quick-actions"></div>
                  <div class="hint" id="image-preview-quick-action-hint">Select a generated image or uploaded source to unlock preview quick actions.</div>
                  <div class="image-quick-action-modal image-regenerate-mode-modal hidden" id="image-regenerate-mode-modal" role="dialog" aria-modal="true" aria-labelledby="image-regenerate-mode-title">
                    <div class="image-quick-action-dialog image-regenerate-mode-dialog">
                      <div class="image-quick-action-head">
                        <div>
                          <span class="image-preview-context-badge">Regenerate</span>
                          <h4 id="image-regenerate-mode-title">Regenerate From Prompt</h4>
                        </div>
                        <button class="secondary mini-button" id="image-regenerate-mode-close-button" type="button" aria-label="Close regenerate options">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="image-regenerate-mode-body">
                        <p id="image-regenerate-mode-summary">Choose how the regenerated image should be saved.</p>
                        <div class="image-regenerate-mode-actions">
                          <button class="secondary" id="image-regenerate-add-button" type="button">${renderButtonIcon("copy")}<span>Add New Image</span></button>
                          <button id="image-regenerate-overwrite-button" type="button">${renderButtonIcon("refresh")}<span>Overwrite Existing</span></button>
                        </div>
                      </div>
                      <div class="image-quick-action-foot">
                        <button class="secondary" id="image-regenerate-mode-cancel-button" type="button">Cancel</button>
                      </div>
                    </div>
                  </div>
                  <div class="image-quick-action-modal image-gif-export-modal hidden" id="image-gif-export-modal" role="dialog" aria-modal="true" aria-labelledby="image-gif-export-title">
                    <div class="image-quick-action-dialog image-regenerate-mode-dialog">
                      <div class="image-quick-action-head">
                        <div>
                          <span class="image-preview-context-badge">Download</span>
                          <h4 id="image-gif-export-title">Export GIF Preview</h4>
                        </div>
                        <button class="secondary mini-button" id="image-gif-export-close-button" type="button" aria-label="Close GIF export options">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="image-regenerate-mode-body">
                        <p id="image-gif-export-summary">Choose whether to download the animated GIF or only the current PNG frame shown in the preview.</p>
                        <div class="image-regenerate-mode-actions">
                          <button class="secondary" id="image-gif-export-original-button" type="button">${renderButtonIcon("download")}<span>Export GIF</span></button>
                          <button id="image-gif-export-frame-button" type="button">${renderButtonIcon("image")}<span>Export PNG Frame</span></button>
                        </div>
                      </div>
                      <div class="image-quick-action-foot">
                        <button class="secondary" id="image-gif-export-cancel-button" type="button">Cancel</button>
                      </div>
                    </div>
                  </div>
                  <div class="image-quick-action-modal hidden" id="image-quick-action-modal" role="dialog" aria-modal="true" aria-labelledby="image-quick-action-modal-title">
                    <div class="image-quick-action-dialog">
                      <div class="image-quick-action-head">
                        <div>
                          <span class="image-preview-context-badge" id="image-quick-action-kicker">Quick Action</span>
                          <h4 id="image-quick-action-modal-title">Prepare Action</h4>
                        </div>
                        <button class="secondary mini-button" id="image-quick-action-close-button" type="button" aria-label="Close quick action settings">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="image-quick-action-body">
                        <div class="image-quick-action-preview">
                          <div class="image-quick-action-preview-gallery" id="image-quick-action-preview-gallery" aria-label="Selected source image previews"></div>
                          <strong id="image-quick-action-source-name">No source selected</strong>
                          <small id="image-quick-action-source-detail">Select an image source first.</small>
                        </div>
                        <div class="image-quick-action-settings">
                          <div class="field hidden" id="image-quick-action-mode-field">
                            <label for="image-quick-action-mode">Mode</label>
                            <select id="image-quick-action-mode">
                              <option value="comfyui">ComfyUI</option>
                              <option value="blender">Blender</option>
                              <option value="tool">Tool</option>
                            </select>
                            <div class="hint hidden" id="image-quick-action-mode-hint">Choose how this quick action should run.</div>
                          </div>
                          <div class="field image-quick-video-field" id="image-quick-action-prompt-field">
                            <label for="image-quick-action-prompt">Prompt</label>
                            <textarea id="image-quick-action-prompt" rows="5" placeholder="Describe the motion or result you want."></textarea>
                            <div class="hint" id="image-quick-action-prompt-hint">Describe the motion or result you want.</div>
                          </div>
                          <div class="image-quick-video-field image-quick-action-grid">
                            <div class="field" id="image-quick-action-length-field"><label for="image-quick-action-length">Length</label><input id="image-quick-action-length" type="number" min="1" max="512" step="1" value="13"></div>
                            <div class="field" id="image-quick-action-fps-field"><label for="image-quick-action-fps">FPS</label><input id="image-quick-action-fps" type="number" min="1" max="60" step="1" value="8"></div>
                            <div class="field" id="image-quick-action-steps-field"><label for="image-quick-action-steps">Steps</label><input id="image-quick-action-steps" type="number" min="1" max="250" step="1" value="25"></div>
                            <div class="field hidden" id="image-quick-action-cfg-field"><label for="image-quick-action-cfg">CFG</label><input id="image-quick-action-cfg" type="number" min="0" max="30" step="0.1" value="2.5"></div>
                            <div class="field hidden" id="image-quick-action-layers-field"><label for="image-quick-action-layers">Layers</label><input id="image-quick-action-layers" type="number" min="1" max="16" step="1" value="2"></div>
                            <div class="field" id="image-quick-action-seed-field"><label for="image-quick-action-seed">Seed</label><input id="image-quick-action-seed" type="number" min="0" step="1" placeholder="Random"></div>
                            <div class="field" id="image-quick-action-width-field"><label for="image-quick-action-width">Width</label><input id="image-quick-action-width" type="number" min="64" max="4096" step="8" value="720"></div>
                            <div class="field" id="image-quick-action-height-field"><label for="image-quick-action-height">Height</label><input id="image-quick-action-height" type="number" min="64" max="4096" step="8" value="720"></div>
                          </div>
                          <div class="studio-toggle-grid image-quick-model-field image-quick-action-toggles">
                            <label class="toggle"><span>Use LLM for filename</span><input id="image-quick-action-model-filename" type="checkbox" checked></label>
                            <label class="toggle"><span>Use LLM for description</span><input id="image-quick-action-model-description" type="checkbox" checked></label>
                            <label class="toggle"><span>Ask LLM for real height</span><input id="image-quick-action-model-scale" type="checkbox" checked></label>
                            <label class="toggle"><span>Create low-poly copy after</span><input id="image-quick-action-model-lowpoly" type="checkbox"></label>
                          </div>
                          <div class="field hidden" id="image-quick-action-tool-note">
                            <label>Tool Mode</label>
                            <div class="hint">Tool mode opens Toon Image Shader with the selected source image loaded.</div>
                          </div>
                          <div class="image-quick-action-preflight hidden" id="image-quick-action-preflight" role="status" aria-live="polite"></div>
                        </div>
                      </div>
                      <div class="image-quick-action-foot">
                        <div class="hint image-quick-action-run-status hidden" id="image-quick-action-run-status" role="status" aria-live="polite"></div>
                        <label class="toggle image-quick-action-always-show-toggle">
                          <input id="image-quick-action-always-show-rotate-confirm" type="checkbox">
                          <span>Always show this window when running quick actions</span>
                        </label>
                        <button class="secondary" id="image-quick-action-cancel-button" type="button">Cancel</button>
                        <button id="image-quick-action-run-button" type="button">${renderButtonIcon("sparkle")}<span>Run Action</span></button>
                      </div>
                    </div>
                  </div>
                  <div class="image-quick-action-modal image-change-prompt-modal hidden" id="image-change-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="image-change-prompt-title">
                    <div class="image-quick-action-dialog image-change-prompt-dialog">
                      <div class="image-quick-action-head">
                        <div>
                          <span class="image-preview-context-badge">Prompt Editor</span>
                          <h4 id="image-change-prompt-title">Change Image Prompt</h4>
                        </div>
                        <button class="secondary mini-button" id="image-change-prompt-close-button" type="button" aria-label="Close prompt editor">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="image-change-prompt-body">
                        <div class="field">
                          <label for="image-change-prompt-current" id="image-change-prompt-current-label">Current Prompt</label>
                          <textarea id="image-change-prompt-current" readonly></textarea>
                        </div>
                        <div class="field">
                          <label>Change Mode</label>
                          <div class="studio-segmented-control image-change-prompt-mode" role="tablist" aria-label="Prompt change mode">
                            <button class="active" data-image-change-prompt-mode="add" type="button" role="tab" aria-selected="true">Add Details</button>
                            <button data-image-change-prompt-mode="replace" type="button" role="tab" aria-selected="false">Replace Parts</button>
                          </div>
                        </div>
                        <div class="field">
                          <label for="image-change-prompt-instructions">Requested Changes</label>
                          <textarea id="image-change-prompt-instructions" placeholder="Describe what the LLM should add or replace."></textarea>
                        </div>
                        <div class="hint" id="image-change-prompt-hint">Add the requested details while preserving the existing subject and visual direction.</div>
                      </div>
                      <div class="image-quick-action-foot">
                        <button class="secondary" id="image-change-prompt-cancel-button" type="button">Cancel</button>
                        <button id="image-change-prompt-apply-button" type="button">${renderButtonIcon("wand")}<span>Apply Changes</span></button>
                      </div>
                    </div>
                  </div>
                  <div class="image-quick-action-modal image-translate-prompt-modal hidden" id="image-translate-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="image-translate-prompt-title">
                    <div class="image-quick-action-dialog image-change-prompt-dialog">
                      <div class="image-quick-action-head">
                        <div>
                          <span class="image-preview-context-badge">Prompt Translator</span>
                          <h4 id="image-translate-prompt-title">Translate Image Prompt</h4>
                        </div>
                        <button class="secondary mini-button" id="image-translate-prompt-close-button" type="button" aria-label="Close prompt translator">${renderButtonIcon("close")}</button>
                      </div>
                      <div class="image-change-prompt-body">
                        <div class="field">
                          <label for="image-translate-prompt-current" id="image-translate-prompt-current-label">Current Prompt</label>
                          <textarea id="image-translate-prompt-current" readonly></textarea>
                        </div>
                        <div class="field">
                          <label for="image-translate-prompt-source-language-select">Translate From</label>
                          <select id="image-translate-prompt-source-language-select">
                            <option value="" selected>Auto Detect</option>
                            <option value="English">English</option>
                            <option value="German">German</option>
                            <option value="French">French</option>
                            <option value="Spanish">Spanish</option>
                            <option value="Italian">Italian</option>
                            <option value="Portuguese">Portuguese</option>
                            <option value="Japanese">Japanese</option>
                            <option value="Korean">Korean</option>
                            <option value="Chinese">Chinese</option>
                            <option value="Russian">Russian</option>
                          </select>
                        </div>
                        <div class="field">
                          <label for="image-translate-prompt-language-select">Translate To</label>
                          <select id="image-translate-prompt-language-select">
                            <option value="English" selected>English</option>
                            <option value="German">German</option>
                            <option value="French">French</option>
                            <option value="Spanish">Spanish</option>
                            <option value="Italian">Italian</option>
                            <option value="Portuguese">Portuguese</option>
                            <option value="Japanese">Japanese</option>
                            <option value="Korean">Korean</option>
                            <option value="Chinese">Chinese</option>
                            <option value="Russian">Russian</option>
                            <option value="custom">Custom Language</option>
                          </select>
                        </div>
                        <div class="field hidden" id="image-translate-prompt-custom-language-field" hidden>
                          <label for="image-translate-prompt-custom-language">Custom Language Name</label>
                          <input id="image-translate-prompt-custom-language" type="text" autocomplete="off" placeholder="For example: Dutch, Swedish, Arabic, Hindi">
                        </div>
                        <div class="hint" id="image-translate-prompt-hint">Translate only the prompt text, keep the visual meaning intact, and avoid adding or removing prompt details.</div>
                      </div>
                      <div class="image-quick-action-foot">
                        <button class="secondary" id="image-translate-prompt-cancel-button" type="button">Cancel</button>
                        <button id="image-translate-prompt-apply-button" type="button">${renderButtonIcon("refresh")}<span>Translate Prompt</span></button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="image-studio-left-sidebar">
                <div class="field studio-step-card image-prompt-card studio-component-form-section">
                  <div class="workspace-tabs-new studio-primary-tabs" role="tablist" aria-label="Image Studio actions">
                    <button class="dashboard-tab active" data-image-action-tab="generate" type="button" role="tab" aria-selected="true">${renderButtonIcon("sparkle")}<span>Generate</span></button>
                    <button class="dashboard-tab" data-image-action-tab="edit" type="button" role="tab" aria-selected="false">${renderButtonIcon("settings")}<span>Edit</span></button>
                  </div>
                  <div class="image-prompt-panel-head">
                    <strong>Prompt</strong>
                    <button class="secondary mini-button" type="button" title="Collapse prompt" aria-label="Collapse prompt">${renderButtonIcon("expand")}</button>
                  </div>
                  <div class="image-prompt-interpret-panel image-control-section studio-control-section">
                    <div class="image-prompt-interpret-head">
                      <div>
                        <strong>Source Image Prompt Builder</strong>
                        <div class="hint">Upload one image, then let the image vision model turn it into a reusable generation prompt.</div>
                      </div>
                      <input id="image-interpret-source-file" type="file" accept="image/*" hidden>
                      <div class="row compact-row image-prompt-interpret-actions">
                        <button class="secondary mini-button" id="image-interpret-source-browse-button" type="button">${renderButtonIcon("upload")}<span>Upload Image</span></button>
                        <button class="secondary mini-button" id="image-interpret-source-paste-button" type="button">${renderButtonIcon("copy")}<span>Paste Image</span></button>
                        <button class="secondary mini-button" id="image-interpret-source-webcam-button" type="button">${renderButtonIcon("camera")}<span>From Webcam</span></button>
                        <button class="secondary mini-button hidden" id="image-interpret-source-aspect-button" type="button" hidden>${renderButtonIcon("image")}<span>Use Same Aspect Ratio</span></button>
                        <button class="secondary mini-button hidden" id="image-interpret-source-clear-button" type="button" hidden>${renderButtonIcon("close")}<span>Clear</span></button>
                        <div class="studio-tabs image-interpret-detail-tabs" role="tablist" aria-label="Prompt interpretation detail">
                          <button data-image-interpret-detail="vague" type="button">Vague</button>
                          <button class="active" data-image-interpret-detail="normal" type="button">Normal</button>
                          <button data-image-interpret-detail="precise" type="button">Precise</button>
                        </div>
                        <label class="image-prompt-interpret-direction">
                          <span>Direction keywords or phrases</span>
                          <input id="image-interpret-direction-input" type="text" autocomplete="off" placeholder="logo, app icon, sticker, product render">
                        </label>
                        <label class="toggle compact-toggle image-identify-objects-toggle">
                          <span>Identify objects and queue images</span>
                          <input id="image-identify-objects-toggle" type="checkbox">
                        </label>
                        <label class="image-identify-max-amount hidden" id="image-identify-max-amount-field" for="image-identify-max-amount" hidden>
                          <span>Maximum objects</span>
                          <input id="image-identify-max-amount" type="number" min="1" max="20" step="1" value="5">
                        </label>
                        <button class="secondary mini-button image-prompt-interpret-submit" id="image-interpret-with-llm-button" type="button" disabled>${renderButtonIcon("sparkle")}<span>Interpret Image With LLM</span></button>
                      </div>
                    </div>
                    <div class="image-prompt-interpret-preview" id="image-prompt-interpret-preview" tabindex="0">
                      <img class="hidden" id="image-prompt-interpret-preview-image" alt="Prompt interpretation source preview">
                      <div class="image-prompt-interpret-preview-empty studio-component-empty-state" id="image-prompt-interpret-preview-empty">No source image selected yet.</div>
                      <div class="image-prompt-interpret-preview-meta">
                        <div class="image-prompt-interpret-preview-name" id="image-prompt-interpret-preview-name">Waiting for uploaded image.</div>
                      <div class="image-prompt-interpret-preview-detail" id="image-prompt-interpret-preview-detail">Choose an image from disk, then replace the prompt box with a vision-generated prompt.</div>
                      </div>
                    </div>
                  </div>
                    <div class="image-control-section studio-control-section image-prompt-fields-section">
                      <div class="image-sidebar-section-title studio-sidebar-section-title"><strong>Prompts</strong></div>
                      <div class="image-object-prompt-editor" id="image-object-prompt-editor">
                        <div class="image-object-prompt-editor-head">
                          <strong>Separate Image Prompts</strong>
                          <small id="image-object-prompt-count">0 prompts</small>
                        </div>
                        <div class="image-object-prompt-actions">
                          <button class="secondary mini-button" id="image-object-prompt-add-button" type="button">${renderButtonIcon("plus")}<span>Add Prompt</span></button>
                          <button class="secondary mini-button danger" id="image-object-prompt-delete-button" type="button" disabled>${renderButtonIcon("trash")}<span>Delete Selected</span></button>
                        </div>
                        <div class="studio-tabs image-object-prompt-tabs" id="image-object-prompt-tabs" role="tablist" aria-label="Separate image prompts"></div>
                      </div>
                      <div class="image-prompt-processing-controls hidden" id="image-prompt-processing-controls" hidden>
                        <label for="image-prompt-processing-mode">
                          <span>LLM Processing</span>
                          <select id="image-prompt-processing-mode">
                            <option value="all">All at once</option>
                            <option value="batch">Batch</option>
                            <option value="sequential" selected>One-by-one</option>
                          </select>
                        </label>
                        <label class="hidden" id="image-prompt-processing-batch-field" for="image-prompt-processing-batch-size" hidden>
                          <span>At once</span>
                          <input id="image-prompt-processing-batch-size" type="number" min="1" max="20" step="1" value="3">
                        </label>
                      </div>
                      <label for="imagegen-prompt">Image Prompt</label>
                      <textarea id="imagegen-prompt" placeholder="Describe the image you want. Leave empty and enable auto prompt if you want the bot to decide."></textarea>
                      <div class="image-prompt-action-row">
                        <button class="secondary mini-button" id="image-improve-prompt-button" type="button">${renderButtonIcon("sparkle")}<span>Improve Prompt</span></button>
                        <button class="secondary mini-button" id="image-change-prompt-button" type="button">${renderButtonIcon("wand")}<span>Change Prompt</span></button>
                        <button class="secondary mini-button" id="image-translate-prompt-button" type="button">${renderButtonIcon("refresh")}<span>Translate Prompt</span></button>
                      </div>
                    <div class="hint">When auto prompt is enabled and this field is filled, the bot uses this as guidance for prompt generation.</div>
                    <div class="field">
                      <label for="imagegen-negative-prompt">Negative Prompt</label>
                      <textarea id="imagegen-negative-prompt" placeholder="Optional: describe what the image should avoid."></textarea>
                      <button class="secondary mini-button" id="image-generate-from-prompt-button" type="button">${renderButtonIcon("sparkle")}<span>Generate from Prompt</span></button>
                    </div>
                  </div>
                  <div class="image-creative-control-stack">
                    <div class="image-creative-group image-control-section studio-control-section">
                      <label>Presets</label>
                      <div class="image-creative-subgroup">
                        <div class="image-creative-subtitle">Prompt Presets</div>
                        <div class="studio-prompt-presets" data-prompt-preset-block="image">
                          <div class="studio-prompt-preset-category">
                            <div class="studio-prompt-preset-label">Photo</div>
                            <div class="studio-prompt-preset-buttons">
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Cinematic portrait, soft key light, shallow depth of field, highly detailed skin texture, realistic lens rendering." type="button">${renderButtonIcon("image")}<span>Portrait</span></button>
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Street photography at night in the rain, neon reflections, high contrast, realistic film grain." type="button">${renderButtonIcon("image")}<span>Street Night</span></button>
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Product photo on clean studio table, soft box lighting, realistic shadows, premium commercial look." type="button">${renderButtonIcon("box")}<span>Product</span></button>
                            </div>
                          </div>
                          <div class="studio-prompt-preset-category">
                            <div class="studio-prompt-preset-label">Art</div>
                            <div class="studio-prompt-preset-buttons">
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Epic fantasy concept art, dramatic environment, volumetric light, painterly detail, rich colors." type="button">${renderButtonIcon("sparkle")}<span>Fantasy</span></button>
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Stylized anime key visual, dynamic composition, expressive lighting, clean linework." type="button">${renderButtonIcon("wand")}<span>Anime</span></button>
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Retro poster illustration, bold shapes, limited palette, textured print finish." type="button">${renderButtonIcon("file")}<span>Retro Poster</span></button>
                            </div>
                          </div>
                          <div class="studio-prompt-preset-category">
                            <div class="studio-prompt-preset-label">Style</div>
                            <div class="studio-prompt-preset-buttons">
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Stylized 3D render, appealing toy-like forms, soft studio lighting, clean shapes, polished materials, game asset presentation." type="button">${renderButtonIcon("cube")}<span>Stylized 3D</span></button>
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Stylized flat 2D illustration, clean vector-like shapes, bold readable silhouette, limited palette, crisp edges, no realistic lighting." type="button">${renderButtonIcon("image")}<span>Flat 2D</span></button>
                            </div>
                          </div>
                          <div class="studio-prompt-preset-category">
                            <div class="studio-prompt-preset-label">3D Ready</div>
                            <div class="studio-prompt-preset-buttons">
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Front facing character concept on neutral background, centered, full body, clear silhouette, no text." type="button">${renderButtonIcon("cube")}<span>Character Front</span></button>
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Hard surface prop render, neutral gray background, isolated object, high texture clarity, no text." type="button">${renderButtonIcon("box")}<span>Prop</span></button>
                              <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="imagegen-prompt" data-prompt-preset-value="Creature concept turnaround style, clean neutral background, high detail, texture readable from distance." type="button">${renderButtonIcon("sparkle")}<span>Creature</span></button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="image-creative-subgroup">
                        <div class="image-creative-subtitle">Style Presets</div>
                        <div class="studio-chip-grid">
                          <button class="active" data-image-style-preset="3d-render" type="button">3D Render</button>
                          <button data-image-style-preset="photography" type="button">Photography</button>
                          <button data-image-style-preset="digital-art" type="button">Digital Art</button>
                          <button data-image-style-preset="anime" type="button">Anime</button>
                          <button data-image-style-preset="concept-art" type="button">Concept Art</button>
                          <button data-image-style-preset="painting" type="button">Painting</button>
                        </div>
                      </div>
                    </div>
                    <div class="image-creative-group image-control-section studio-control-section">
                      <label>Aspect Ratio</label>
                      <div class="studio-segmented-control">
                        <button class="active" data-image-aspect-ratio="1:1" data-image-aspect-width="512" data-image-aspect-height="512" type="button">1:1</button>
                        <button data-image-aspect-ratio="16:9" data-image-aspect-width="768" data-image-aspect-height="432" type="button">16:9</button>
                        <button data-image-aspect-ratio="9:16" data-image-aspect-width="432" data-image-aspect-height="768" type="button">9:16</button>
                        <button data-image-aspect-ratio="4:5" data-image-aspect-width="512" data-image-aspect-height="640" type="button">4:5</button>
                        <button data-image-aspect-ratio="3:2" data-image-aspect-width="768" data-image-aspect-height="512" type="button">3:2</button>
                      </div>
                    </div>
                    <div class="image-creative-grid">
                      <div class="field image-control-section studio-control-section image-control-card studio-control-card">
                        <label for="image-editor-seed">Seed</label><input id="image-editor-seed" type="number" min="0" step="1" placeholder="Random">
                        <label for="image-editor-seed-control">Control After Generate</label><select id="image-editor-seed-control"><option value="fixed">Fixed</option><option value="increase">Increase</option><option value="decrease">Decrease</option><option value="randomize" selected>Randomize</option></select>
                        <label for="image-editor-steps">Steps</label><input id="image-editor-steps" type="number" min="1" max="250" step="1" value="20">
                        <label for="image-editor-cfg">CFG</label><input id="image-editor-cfg" type="number" min="0" max="30" value="4" step="0.1">
                        <label for="image-generate-count">Images</label><input id="image-generate-count" type="number" min="1" max="8" step="1" value="1">
                      </div>
                    </div>
                    <div class="field image-creative-field image-control-section studio-control-section image-control-card studio-control-card">
                      <label for="image-editor-resolution-select">Resolution</label>
                      <select id="image-editor-resolution-select">
                        <option value="512x512" selected>512 x 512</option>
                        <option value="768x768">768 x 768</option>
                        <option value="768x432">768 x 432</option>
                        <option value="432x768">432 x 768</option>
                        <option value="512x640">512 x 640</option>
                        <option value="768x512">768 x 512</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div class="image-creative-grid image-resolution-custom-grid">
                      <div class="field image-control-section studio-control-section image-control-card studio-control-card"><label for="image-editor-resolution-width">Width</label><input id="image-editor-resolution-width" type="number" min="64" max="4096" step="8" value="512"></div>
                      <div class="field image-control-section studio-control-section image-control-card studio-control-card"><label for="image-editor-resolution-height">Height</label><input id="image-editor-resolution-height" type="number" min="64" max="4096" step="8" value="512"></div>
                      <label class="toggle compact-toggle image-resolution-lock-toggle" for="image-editor-resolution-lock"><span>Lock aspect ratio</span><input id="image-editor-resolution-lock" type="checkbox" checked></label>
                    </div>
                  </div>
                  <div class="row image-studio-action-row image-studio-prompt-action-row studio-component-toolbar">
                    <button id="generate-image-button">${renderButtonIcon("sparkle")}<span>Generate Image</span></button>
                    <button class="secondary hidden" id="stop-image-generation-button" type="button" hidden><span>Stop</span></button>
                  </div>
                </div>
                <details class="image-studio-panel active studio-step-card image-generation-controls studio-component-advanced-settings" id="image-studio-panel-generate">
                  <summary class="image-generation-controls-summary">
                    <span>Generation Options</span>
                    <span class="hint">Prompt source, dimensions, seed, posting, and automation toggles.</span>
                  </summary>
                  <div class="image-generation-controls-content">
                    <div class="image-studio-option-grid">
                      <div class="field">
                        <label for="imagegen-prompt-text-file">Prompt Text Source</label>
                        <select id="imagegen-prompt-text-file" data-text-source-select="single" data-text-source-empty-label="No prompt text source selected"></select>
                        <div class="hint">Optional. One random line is picked for each generation.</div>
                        <div class="toggle compact-toggle">
                          <span>Avoid repeats until all lines are used</span>
                          <input id="imagegen-prompt-text-no-repeat" type="checkbox">
                        </div>
                      </div>
                      <div class="field">
                        <label for="imagegen-auto-filename-timing">Image Filename LLM Timing</label>
                        <select id="imagegen-auto-filename-timing">
                          <option value="before">Before image generation</option>
                          <option value="after">After image generation</option>
                          <option value="parallel">At same time as image generation</option>
                        </select>
                        <div class="hint">When the filename should be generated.</div>
                      </div>
                      <div class="field">
                        <label for="imagegen-post-messenger-select">Post generated image to</label>
                        <select id="imagegen-post-messenger-select">
                          <option value="none" selected>Do not post</option>
                          <option value="discord">Discord</option>
                          <option value="telegram">Telegram</option>
                          <option value="matrix">Matrix</option>
                          <option value="whatsapp">WhatsApp</option>
                        </select>
                        <select id="imagegen-post-destination-input">
                          <option value="">Choose destination</option>
                        </select>
                        <div class="row" id="imagegen-post-use-selected-discord-row">
                          <button class="secondary" id="imagegen-post-use-selected-discord-button" type="button">${renderButtonIcon("copy")}<span>Use Selected Discord Channel</span></button>
                        </div>
                        <div class="hint" id="imagegen-post-destination-hint">Pick a messenger and provide the destination ID.</div>
                      </div>
                    </div>
                    <div class="image-workflow-input-grid">
                      <div class="studio-field-preset-strip">
                        <button class="secondary mini-button" data-field-preset-label="Logo" data-field-preset-values="imagegen-width:512|imagegen-height:512" type="button">${renderButtonIcon("image")}<span>Logo 512</span></button>
                        <button class="secondary mini-button" data-field-preset-label="Landscape" data-field-preset-values="imagegen-width:1024|imagegen-height:576" type="button">${renderButtonIcon("image")}<span>Landscape</span></button>
                        <button class="secondary mini-button" data-field-preset-label="Portrait" data-field-preset-values="imagegen-width:576|imagegen-height:1024" type="button">${renderButtonIcon("image")}<span>Portrait</span></button>
                      </div>
                      <div class="field">
                        <label for="imagegen-width">Width</label>
                        <input id="imagegen-width" type="number" min="64" max="4096" step="8" value="512">
                      </div>
                      <div class="field">
                        <label for="imagegen-height">Height</label>
                        <input id="imagegen-height" type="number" min="64" max="4096" step="8" value="512">
                      </div>
                      <div class="field">
                        <label for="imagegen-seed">Seed</label>
                        <input id="imagegen-seed" type="number" min="0" step="1" value="">
                      </div>
                      <div class="field">
                        <label for="imagegen-seed-control">Control After Generate</label>
                        <select id="imagegen-seed-control">
                          <option value="fixed">Fixed</option>
                          <option value="increase">Increase</option>
                          <option value="decrease">Decrease</option>
                          <option value="randomize" selected>Randomize</option>
                        </select>
                      </div>
                      <div class="field">
                        <label for="imagegen-steps">Steps</label>
                        <input id="imagegen-steps" type="number" min="1" max="250" step="1" value="25">
                      </div>
                      <div class="field">
                        <label for="imagegen-cfg">CFG</label>
                        <input id="imagegen-cfg" type="number" min="0" max="30" step="0.1" value="7">
                      </div>
                      <div class="field">
                        <label for="imagegen-batch-size">Images</label>
                        <input id="imagegen-batch-size" type="number" min="1" max="8" step="1" value="1">
                      </div>
                    </div>
                    <div class="studio-toggle-grid">
                      <div class="toggle">
                        <span>Let bot create its own image prompt</span>
                        <input id="imagegen-auto-prompt" type="checkbox">
                      </div>
                      <div class="toggle">
                        <span>Let bot create image filename with LLM</span>
                        <input id="imagegen-auto-filename" type="checkbox" checked>
                      </div>
                      <div class="toggle">
                        <span>Let bot create image description with LLM</span>
                        <input id="imagegen-auto-description" type="checkbox" checked>
                      </div>
                      <div class="toggle">
                        <span>Remove metadata before storing images</span>
                        <input id="image-strip-metadata-storage" type="checkbox" checked>
                      </div>
                    </div>
                  </div>
                </details>
                <div class="image-studio-panel" id="image-studio-panel-edit">
                  <div class="image-edit-source-layout">
                    <div class="field image-studio-edit-hint-panel">
                      <label>Edit Mode</label>
                      <div class="hint">Choose a source image from disk, URL, clipboard, or image pool, then describe what should change and click <strong>Apply Edit</strong>.</div>
                      <div class="hint">The configured <code>Image Edit Workflow Path</code> will be used when a source image is attached.</div>
                      <div class="toggle compact-toggle">
                        <span>Apply edit to all loaded sources</span>
                        <input id="image-edit-batch-enabled" type="checkbox">
                      </div>
                      <div class="row compact-row image-edit-batch-controls hidden" id="image-edit-batch-controls">
                        <button class="secondary mini-button" id="image-edit-select-all-button" type="button">Select All</button>
                        <button class="secondary mini-button" id="image-edit-deselect-all-button" type="button">Deselect All</button>
                      </div>
                      <div class="hint">When enabled, Studio runs one image edit request per selected source image in the current order.</div>
                    </div>
                    <div class="image-edit-source-main-grid">
                      <div class="field image-edit-source-import-panel">
                        <label>1. Add Source Images</label>
                        <input id="image-edit-source-file" type="file" accept="image/*" multiple hidden>
                        <div class="media-dropzone image-edit-source-dropzone" id="image-edit-source-dropzone" tabindex="0">
                          <div class="media-dropzone-title">Drop, paste, or browse one or more images</div>
                          <div class="media-dropzone-subtitle">GIFs and still images are both supported. The active source becomes the main preview.</div>
                        </div>
                        <div class="row">
                          <button class="secondary" id="image-edit-source-browse-button">${renderButtonIcon("upload")}<span>Upload Images</span></button>
                          <button class="secondary" id="image-edit-source-clear-button">${renderButtonIcon("trash")}<span>Clear Sources</span></button>
                        </div>
                        <div class="image-edit-source-grid">
                          <div class="field">
                            <label for="image-edit-source-url">Source URL Or Local Path</label>
                            <input id="image-edit-source-url" placeholder="https://example.com/source.png or C:\\images\\source.png">
                            <div class="row">
                              <button class="secondary" id="image-edit-source-url-apply-button">${renderButtonIcon("sparkle")}<span>Use URL / Path</span></button>
                            </div>
                          </div>
                          <div class="field">
                            <label for="image-edit-source-pool-select">Source From Image Pool</label>
                            <select id="image-edit-source-pool-select"></select>
                            <select id="image-edit-source-pool-image-select"></select>
                            <div class="row">
                              <button class="secondary" id="image-edit-source-pool-load-button">${renderButtonIcon("image")}<span>Use Pool Image</span></button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="field image-edit-source-preview-field">
                        <label>2. Pick Active Source</label>
                        <div class="image-edit-source-preview-card" id="image-edit-source-preview-card">
                          <div class="image-edit-source-preview-empty studio-component-empty-state" id="image-edit-source-preview-empty">No source image selected.</div>
                          <div class="image-edit-source-preview-meta">
                            <div class="image-edit-source-preview-name" id="image-edit-source-preview-name">Waiting for source image.</div>
                            <div class="image-edit-source-preview-detail" id="image-edit-source-preview-detail">Pick a source from upload, paste, URL, or image pool.</div>
                          </div>
                        </div>
                        <div class="image-edit-source-selection-list" id="image-edit-source-selection-list"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="image-advanced-stack" id="image-advanced-stack"></div>
                </div>
              </div>
              <div class="studio-workflow-side-resizer" data-workflow-sidebar-resizer="image" aria-hidden="true"></div>
              <aside class="studio-workflow-side image-studio-side" id="image-sidebar-panel" data-workflow-sidebar-panel="image" data-studio-inspector-panel="true">
                <div class="studio-tabs studio-inspector-tabs" role="tablist" aria-label="Image inspector">
                  <button class="active" type="button">History</button>
                  <button type="button">Layers</button>
                  <button type="button">Generation</button>
                  <button type="button">Export</button>
                  <button type="button">Metadata</button>
                </div>
                <div class="image-history-search">
                  <input placeholder="Search history...">
                  <button class="secondary mini-button" type="button" title="Filter history" aria-label="Filter history">${renderButtonIcon("settings")}</button>
                </div>
                ${renderStudioStatusPanel({
                  statusKey: "imagegen",
                  initialMessage: "No image generation run yet.",
                  progressLabel: "Image generation progress"
                })}
                <div class="field studio-step-card image-side-card">
                  <div class="image-variant-gallery" id="image-variant-gallery"></div>
                </div>
                <div class="image-sidebar-advanced-stack" id="image-sidebar-advanced-stack"></div>
                <div class="field">
                  <label>Latest GIFs</label>
                  <div class="studio-bounded-section compact-media-section">
                    <div class="latest-media-grid" id="image-latest-gif-list"></div>
                  </div>
                </div>
                <div class="field">
                  <label>Latest Videos</label>
                  <div class="studio-bounded-section compact-media-section">
                    <div class="latest-media-grid" id="image-latest-video-list"></div>
                  </div>
                </div>
                <div class="field">
                  <label for="image-pool-library-select">Image Pool Browser</label>
                  <div class="studio-bounded-section">
                    <select id="image-pool-library-select"></select>
                    <div class="row">
                    <button class="secondary" id="image-pool-library-new-button">${renderButtonIcon("plus")}<span>Create New Image Pool</span></button>
                    <button class="secondary" id="image-pool-library-delete-button">${renderButtonIcon("trash")}<span>Delete Selected Pool</span></button>
                    </div>
                    <div class="list medium-list" id="image-pool-library-list"></div>
                  </div>
                </div>
                <div class="field">
                  <label for="imagegen-image-pool-select">Add Selected Image To Pool</label>
                  <select id="imagegen-image-pool-select"></select>
                  <div class="row">
                    <button class="secondary" id="imagegen-add-selected-to-pool-button">${renderButtonIcon("image")}<span>Add Selected Image To Pool</span></button>
                  </div>
                  <div class="hint">Pick an image from history first, then add it to the pool you select here.</div>
                </div>
                <div class="output simulation-output studio-component-metadata" id="imagegen-meta-output">No image selected.</div>
              </aside>
              <div class="image-bottom-dock">
                <section class="image-dock-panel image-filmstrip-panel">
                  <div class="studio-tabs">
                    <button class="active" type="button">Recent Images</button>
                    <button type="button">Favorites</button>
                  </div>
                  <div class="recent-media-controls" id="image-recent-media-controls"></div>
                  <div class="image-filmstrip" id="image-bottom-filmstrip"></div>
                </section>
                <section class="image-dock-panel image-queue-panel studio-component-queue">
                  <div class="studio-tabs">
                    <button class="active" type="button">Generation Queue</button>
                    <button type="button">Console</button>
                  </div>
                  <div class="image-queue-list" id="image-bottom-queue-list"></div>
                </section>
              </div>
            </div>
            ${renderWorkflowSettingsFooter([
              {
                panel: "image-comfy",
                title: "Separate Setting: Image ComfyUI Workflow",
                kicker: "Image Studio",
                label: "Image ComfyUI Workflow"
              },
              {
                panel: "image-llm",
                title: "Image LLM Connection Settings (Prompt + Filename)",
                kicker: "Image Studio",
                label: "Image LLM Connection"
              }
            ])}
          </article>
          <article class="panel-card ai-section-target ai-detail-card" id="audio-studio-card">
            <div class="studio-card-header">
              <div class="panel-heading">
                <h3>Audio Studio</h3>
                <div class="panel-subtitle">Generate audio clips from a text prompt and optionally post them to a selected messenger destination.</div>
              </div>
              <div class="studio-card-header-actions">
                <button class="secondary workflow-sidebar-toggle-button" id="audio-sidebar-toggle-button" data-workflow-sidebar-toggle="audio" aria-controls="audio-sidebar-panel" aria-expanded="true" aria-pressed="false" type="button">${renderButtonIcon("expand")}<span data-workflow-sidebar-toggle-label>Hide Sidebar</span></button>
                <button class="secondary studio-history-button" data-ai-scroll-target="audiogen-history-list" type="button">${renderButtonIcon("history")}<span>History</span></button>
              </div>
            </div>
            <div class="workspace-tabs-new" aria-label="Audio workflow mode">
              <button class="dashboard-tab ghost active" data-audio-studio-tab="sfx" type="button">${renderButtonIcon("sparkle")}<span>SFX</span></button>
              <button class="dashboard-tab ghost" data-audio-studio-tab="tts" type="button">${renderButtonIcon("file")}<span>TTS</span></button>
              <button class="dashboard-tab ghost" data-audio-studio-tab="stt" type="button">${renderButtonIcon("file")}<span>STT</span></button>
              <button class="dashboard-tab ghost" data-audio-studio-tab="sts" type="button">${renderButtonIcon("refresh")}<span>STS</span></button>
            </div>
            <div class="studio-workflow-layout audio-studio-workspace" data-workflow-sidebar-workspace="audio">
              <div class="studio-workflow-main studio-component-form audio-studio-main">
            <div class="audio-studio-panel studio-component-form-section active" id="audio-studio-panel-sfx">
              <div class="audio-studio-prompt-card studio-step-card">
                <div class="field audio-prompt-field">
                  <label for="audiogen-prompt">Audio Prompt</label>
                  <textarea id="audiogen-prompt" placeholder="Describe the audio clip you want."></textarea>
                </div>
                <div class="field">
                  <label for="audiogen-prompt-text-file">Prompt Text Source</label>
                  <select id="audiogen-prompt-text-file" data-text-source-select="single" data-text-source-empty-label="No prompt text source selected"></select>
                  <div class="hint">Optional. One random line is merged with the prompt for each audio generation.</div>
                  <div class="toggle compact-toggle">
                    <span>Avoid repeats until all lines are used</span>
                    <input id="audiogen-prompt-text-no-repeat" type="checkbox">
                  </div>
                </div>
                <div class="audio-action-stack studio-component-toolbar">
                  <button id="generate-audio-button">${renderButtonIcon("audio")}<span>Generate Audio</span></button>
                  <button class="secondary hidden" id="stop-audio-generation-button" type="button"><span>Stop</span></button>
                  <button class="secondary" id="reset-audio-form-button" type="button">${renderButtonIcon("refresh")}<span>Reset</span></button>
                </div>
                <div class="audio-option-row studio-component-advanced-settings">
                  <div class="field">
                    <label for="audiogen-seconds">Length In Seconds</label>
                    <input id="audiogen-seconds" type="number" min="1" max="120" step="1" placeholder="12">
                  </div>
                  <div class="field">
                    <label for="audiogen-steps">Steps</label>
                    <input id="audiogen-steps" type="number" min="1" max="250" step="1" value="50">
                  </div>
                  <div class="field">
                    <label for="audiogen-cfg">CFG</label>
                    <input id="audiogen-cfg" type="number" min="0" max="30" step="0.01" value="4.98">
                  </div>
                  <div class="field">
                    <label for="audiogen-post-messenger-select">Post Generated Audio To</label>
                    <select id="audiogen-post-messenger-select">
                      <option value="none" selected>Do not post</option>
                      <option value="discord">Discord</option>
                      <option value="telegram">Telegram</option>
                      <option value="matrix">Matrix</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div class="field">
                    <label for="audiogen-post-destination-input">Destination <span class="label-soft">(Optional)</span></label>
                    <select id="audiogen-post-destination-input">
                      <option value="">Choose destination</option>
                    </select>
                    <div class="row" id="audiogen-post-use-selected-discord-row">
                      <button class="secondary mini-button" id="audiogen-post-use-selected-discord-button" type="button">${renderButtonIcon("copy")}<span>Use Selected Discord Channel</span></button>
                    </div>
                    <div class="hint" id="audiogen-post-destination-hint">Pick a messenger and provide the destination ID.</div>
                  </div>
                </div>
                <div class="studio-field-preset-strip">
                  <button class="secondary mini-button" data-field-preset-label="Short SFX" data-field-preset-values="audiogen-seconds:4" type="button">${renderButtonIcon("audio")}<span>Short SFX</span></button>
                  <button class="secondary mini-button" data-field-preset-label="Loop Bed" data-field-preset-values="audiogen-seconds:12" type="button">${renderButtonIcon("audio")}<span>Loop Bed</span></button>
                  <button class="secondary mini-button" data-field-preset-label="Long Atmosphere" data-field-preset-values="audiogen-seconds:30" type="button">${renderButtonIcon("audio")}<span>Atmosphere</span></button>
                </div>
              </div>
            </div>
            <div class="audio-studio-panel studio-component-form-section" id="audio-studio-panel-tts">
              <div class="field studio-step-card">
                <label for="speech-tts-text">Text To Speech</label>
                <div class="hint">Supports Kokoro standard TTS plus Qwen voice clone, custom voice, and voice design workflows under <code>comfyui-workflows/audio/tts</code>.</div>
                <div class="field">
                  <label for="speech-tts-mode">TTS Mode</label>
                  <select id="speech-tts-mode">
                    <option value="standard">Standard</option>
                    <option value="voice-clone">Voice Clone</option>
                    <option value="custom-voice">Custom Voice</option>
                    <option value="design-voice">Design Voice</option>
                  </select>
                </div>
                <textarea id="speech-tts-text" placeholder="Enter text for speech synthesis."></textarea>
                <div class="row" id="speech-tts-standard-controls">
                  <label class="field">
                    <span>Voice</span>
                    <select id="speech-tts-speaker" disabled><option value="">Loading voices from ComfyUI...</option></select>
                  </label>
                  <input id="speech-tts-speed" type="number" min="0.5" max="2" step="0.1" value="1.0" placeholder="1.0">
                </div>
                <div class="field hidden" id="speech-tts-voice-clone-file-field">
                  <label for="speech-tts-voice-clone-file">Reference Audio</label>
                  <input id="speech-tts-voice-clone-file" type="file" accept="audio/*,video/*">
                </div>
                <div class="field hidden" id="speech-tts-reference-text-field">
                  <label for="speech-tts-reference-text">Reference Text <span class="label-soft">(Optional)</span></label>
                  <textarea id="speech-tts-reference-text" placeholder="Optional transcript or phonetic hint for the reference audio."></textarea>
                </div>
                <div class="field hidden" id="speech-tts-instruct-field">
                  <label for="speech-tts-instruct">Voice Instructions</label>
                  <textarea id="speech-tts-instruct" placeholder="Describe the target voice, tone, and character."></textarea>
                </div>
                <div class="row">
                  <button id="speech-tts-button" type="button">Generate TTS</button>
                </div>
                <audio id="speech-tts-preview" controls style="width: 100%;"></audio>
                <div class="output simulation-output" id="speech-tts-output">No TTS run yet.</div>
              </div>
            </div>
            <div class="audio-studio-panel studio-component-form-section" id="audio-studio-panel-stt">
              <div class="field studio-step-card">
                <label for="speech-stt-file">Speech To Text</label>
                <div class="hint">Upload audio or video and transcribe it through the moved STT workflow in <code>comfyui-workflows/audio/stt</code>.</div>
                <div class="audio-mic-capture-card">
                  <div class="audio-mic-capture-head">
                    <strong>Microphone</strong>
                    <button class="secondary mini-button" id="speech-stt-refresh-mics-button" type="button">Refresh Mics</button>
                  </div>
                  <div class="row audio-mic-capture-row">
                    <select id="speech-stt-mic-device"></select>
                    <button class="secondary" id="speech-stt-record-button" type="button">Record Mic</button>
                    <button class="secondary hidden" id="speech-stt-stop-button" type="button">Stop</button>
                  </div>
                  <div class="hint" id="speech-stt-mic-status">Mic idle.</div>
                </div>
                <input id="speech-stt-file" type="file" accept="audio/*,video/*">
                <div class="field">
                  <label for="speech-stt-language">Recognition Language</label>
                  <input id="speech-stt-language" list="speech-stt-language-options" value="auto" placeholder="auto">
                  <datalist id="speech-stt-language-options">
                    <option value="auto"></option>
                    <option value="English"></option>
                    <option value="German"></option>
                    <option value="French"></option>
                    <option value="Italian"></option>
                    <option value="Spanish"></option>
                    <option value="Portuguese"></option>
                    <option value="Dutch"></option>
                    <option value="Polish"></option>
                    <option value="Russian"></option>
                    <option value="Ukrainian"></option>
                    <option value="Arabic"></option>
                    <option value="Chinese"></option>
                    <option value="Japanese"></option>
                    <option value="Korean"></option>
                  </datalist>
                  <div class="hint">Use <code>auto</code> to detect the language, or enter any language label supported by this workflow's Apply Whisper node.</div>
                </div>
                <div class="row">
                  <button id="speech-stt-button" type="button">Transcribe</button>
                </div>
                <div class="output simulation-output" id="speech-stt-output">No transcription yet.</div>
              </div>
            </div>
            <div class="audio-studio-panel studio-component-form-section" id="audio-studio-panel-sts">
              <div class="field studio-step-card">
                <label for="speech-sts-file">Speech To Speech</label>
                <div class="hint">Upload speech and transform it with the STS workflow now stored under <code>comfyui-workflows/audio/sts</code>.</div>
                <div class="audio-mic-capture-card">
                  <div class="audio-mic-capture-head">
                    <strong>Microphone</strong>
                    <button class="secondary mini-button" id="speech-sts-refresh-mics-button" type="button">Refresh Mics</button>
                  </div>
                  <div class="row audio-mic-capture-row">
                    <select id="speech-sts-mic-device"></select>
                    <button class="secondary" id="speech-sts-record-button" type="button">Record Mic</button>
                    <button class="secondary hidden" id="speech-sts-stop-button" type="button">Stop</button>
                  </div>
                  <div class="hint" id="speech-sts-mic-status">Mic idle.</div>
                </div>
                <input id="speech-sts-file" type="file" accept="audio/*,video/*">
                <div class="row">
                  <input id="speech-sts-speaker" placeholder="Speaker (for example am_puck)">
                  <input id="speech-sts-speed" type="number" min="0.5" max="2" step="0.1" value="0.9" placeholder="0.9">
                  <button id="speech-sts-button" type="button">Generate STS</button>
                </div>
                <audio id="speech-sts-preview" controls style="width: 100%;"></audio>
                <div class="output simulation-output" id="speech-sts-output">No speech-to-speech run yet.</div>
              </div>
            </div>
              </div>
              <div class="studio-workflow-side-resizer" data-workflow-sidebar-resizer="audio" aria-hidden="true"></div>
              <aside class="studio-workflow-side audio-studio-side" id="audio-sidebar-panel" data-workflow-sidebar-panel="audio" data-studio-inspector-panel="true">
                ${renderStudioStatusPanel({
                  statusKey: "audiogen",
                  initialMessage: "No audio generation run yet.",
                  progressLabel: "Audio generation progress"
                })}
                <div class="field studio-step-card audio-side-card audio-history-card">
                  <label>Recent Generations</label>
                  <div class="studio-bounded-section">
                    <div class="list medium-list" id="audiogen-history-list"></div>
                  </div>
                </div>
                <div class="field studio-step-card audio-side-card audio-preview-card studio-component-preview-card">
                  <label>Latest Preview</label>
                  <audio id="audiogen-preview" controls style="width: 100%;"></audio>
                  <div class="row image-studio-preview-tools audio-preview-actions studio-component-toolbar">
                    <button class="secondary mini-button" id="audio-send-to-game-engine-button" type="button">${renderButtonIcon("upload")}<span>Send To Game Engine</span></button>
                  </div>
                  <div class="output simulation-output studio-component-metadata" id="audiogen-meta-output">No audio selected.</div>
                </div>
              </aside>
              <div class="audio-bottom-dock">
                <section class="audio-dock-panel audio-filmstrip-panel">
                  <div class="studio-tabs"><button class="active" type="button">Recent Audio</button><button type="button">Favorites</button></div>
                  <div class="recent-media-controls" id="audio-recent-media-controls"></div>
                  <div class="audio-filmstrip" id="audio-bottom-filmstrip"></div>
                </section>
                <section class="audio-dock-panel audio-queue-panel studio-component-queue">
                  <div class="studio-tabs"><button class="active" type="button">Generation Queue</button><button type="button">Console</button></div>
                  <div class="audio-queue-list" id="audio-bottom-queue-list"></div>
                </section>
              </div>
            </div>
            ${renderWorkflowSettingsFooter([
              {
                panel: "audio-comfy",
                title: "Separate Setting: Audio ComfyUI Workflow",
                kicker: "Audio Studio",
                label: "Audio ComfyUI Workflow"
              }
            ])}
          </article>
          <article class="panel-card ai-section-target ai-detail-card" id="music-studio-card">
            <div class="studio-card-header">
              <div class="panel-heading">
                <h3>Music Studio</h3>
                <div class="panel-subtitle">Generate music with optional style tags and lyrics, then post it directly if you want.</div>
              </div>
              <div class="studio-card-header-actions">
                <button class="secondary workflow-sidebar-toggle-button" id="music-sidebar-toggle-button" data-workflow-sidebar-toggle="music" aria-controls="music-sidebar-panel" aria-expanded="true" aria-pressed="false" type="button">${renderButtonIcon("expand")}<span data-workflow-sidebar-toggle-label>Hide Sidebar</span></button>
                <button class="secondary studio-history-button" data-ai-scroll-target="musicgen-history-list" type="button">${renderButtonIcon("history")}<span>History</span></button>
              </div>
            </div>
            <div class="studio-workflow-layout music-studio-workspace" data-workflow-sidebar-workspace="music">
              <div class="studio-workflow-main studio-component-form music-studio-main">
                <div class="studio-step-card music-prompt-card studio-component-form-section">
                  <div class="field">
                    <label for="musicgen-tags">Music Tags</label>
                    <input id="musicgen-tags" placeholder="electronic, cinematic, ambient">
                    <div class="row music-llm-action-row"><button class="secondary" id="musicgen-think-tags-button" type="button">${renderButtonIcon("sparkle")}<span data-music-thinking-label>Let LLM Think About Music Tags</span></button></div>
                    <div class="hint">Expands the current tags instead of replacing them.</div>
                    <select id="musicgen-tags-text-file" data-text-source-select="single" data-text-source-empty-label="No tag text source selected"></select>
                    <div class="toggle compact-toggle">
                      <span>Avoid repeats until all lines are used</span>
                      <input id="musicgen-tags-text-no-repeat" type="checkbox">
                    </div>
                  </div>
                  <div class="field">
                    <label for="musicgen-lyrics">Lyrics</label>
                    <textarea id="musicgen-lyrics" placeholder="Optional lyrics for the generated track."></textarea>
                    <div class="row music-llm-action-row"><button class="secondary" id="musicgen-think-lyrics-button" type="button">${renderButtonIcon("sparkle")}<span data-music-thinking-label>Let LLM Think About Lyrics</span></button></div>
                    <div class="hint">Develops your existing lyrics and uses section labels such as <code>[verse]</code>, <code>[chorus]</code>, <code>[bridge]</code>, and <code>[outro]</code>.</div>
                    <select id="musicgen-lyrics-text-file" data-text-source-select="single" data-text-source-empty-label="No lyric text source selected"></select>
                    <div class="toggle compact-toggle">
                      <span>Avoid repeats until all lines are used</span>
                      <input id="musicgen-lyrics-text-no-repeat" type="checkbox">
                    </div>
                  </div>
                  <div class="music-option-row studio-component-advanced-settings">
                    <div class="field">
                      <label for="musicgen-seconds">Length In Seconds</label>
                      <input id="musicgen-seconds" type="number" min="1" max="120" step="1" value="20">
                    </div>
                    <div class="field">
                      <label for="musicgen-steps">Steps</label>
                      <input id="musicgen-steps" type="number" min="1" max="250" step="1" value="25">
                    </div>
                    <div class="field">
                      <label for="musicgen-cfg">CFG</label>
                      <input id="musicgen-cfg" type="number" min="0" max="30" step="0.1" value="4">
                    </div>
                    <div class="field">
                      <label for="musicgen-seed">Seed</label>
                      <input id="musicgen-seed" type="number" min="0" step="1" placeholder="Random">
                    </div>
                    <div class="field">
                      <label for="musicgen-seed-control">Control After Generation</label>
                      <select id="musicgen-seed-control">
                        <option value="fixed">Fixed</option>
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                        <option value="randomize" selected>Randomize</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="musicgen-post-messenger-select">Post Generated Music To</label>
                      <select id="musicgen-post-messenger-select">
                        <option value="none" selected>Do not post</option>
                        <option value="discord">Discord</option>
                        <option value="telegram">Telegram</option>
                        <option value="matrix">Matrix</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="musicgen-post-destination-input">Destination <span class="label-soft">(Optional)</span></label>
                      <select id="musicgen-post-destination-input">
                        <option value="">Choose destination</option>
                      </select>
                      <div class="row" id="musicgen-post-use-selected-discord-row">
                        <button class="secondary mini-button" id="musicgen-post-use-selected-discord-button" type="button">${renderButtonIcon("copy")}<span>Use Selected Discord Channel</span></button>
                      </div>
                      <div class="hint" id="musicgen-post-destination-hint">Pick a messenger and provide the destination ID.</div>
                    </div>
                  </div>
                  <div class="row studio-component-toolbar">
                    <button id="generate-music-button">${renderButtonIcon("audio")}<span>Generate Music</span></button>
                    <button class="secondary hidden" id="stop-music-generation-button" type="button"><span>Stop</span></button>
                  </div>
                </div>
              </div>
              <div class="studio-workflow-side-resizer" data-workflow-sidebar-resizer="music" aria-hidden="true"></div>
              <aside class="studio-workflow-side music-studio-side" id="music-sidebar-panel" data-workflow-sidebar-panel="music" data-studio-inspector-panel="true">
                ${renderStudioStatusPanel({
                  statusKey: "musicgen",
                  initialMessage: "No music generation run yet.",
                  progressLabel: "Music generation progress"
                })}
                <div class="field studio-step-card music-side-card studio-component-preview-card">
                  <label>Recent Generated Music</label>
                  <div class="studio-bounded-section">
                    <div class="list medium-list" id="musicgen-history-list"></div>
                  </div>
                </div>
                <div class="field studio-step-card music-side-card">
                  <label>Latest Preview</label>
                  <audio id="musicgen-preview" controls style="width: 100%;"></audio>
                  <div class="row image-studio-preview-tools music-preview-actions studio-component-toolbar">
                    <button class="secondary mini-button" id="music-send-to-game-engine-button" type="button">${renderButtonIcon("upload")}<span>Send To Game Engine</span></button>
                  </div>
                </div>
                <div class="output simulation-output studio-component-metadata" id="musicgen-meta-output">No music selected.</div>
              </aside>
              <div class="music-bottom-dock">
                <section class="music-dock-panel music-filmstrip-panel">
                  <div class="studio-tabs"><button class="active" type="button">Recent Music</button><button type="button">Favorites</button></div>
                  <div class="recent-media-controls" id="music-recent-media-controls"></div>
                  <div class="music-filmstrip" id="music-bottom-filmstrip"></div>
                </section>
                <section class="music-dock-panel music-queue-panel studio-component-queue">
                  <div class="studio-tabs"><button class="active" type="button">Generation Queue</button><button type="button">Console</button></div>
                  <div class="music-queue-list" id="music-bottom-queue-list"></div>
                </section>
              </div>
            </div>
            ${renderWorkflowSettingsFooter([
              {
                panel: "music-comfy",
                title: "Music ComfyUI Endpoint + Path Settings",
                kicker: "Music Studio",
                label: "Music ComfyUI + Paths"
              }
            ])}
          </article>
          <article class="panel-card ai-section-target ai-detail-card video-studio-text-mode" id="video-studio-card">
            <div class="video-editor-appbar">
              <div class="video-appbar-brand">
                <span class="video-app-logo">${renderButtonIcon("video")}</span>
                <span class="video-app-title">Video Studio</span>
                <span class="model3d-beta-pill">Beta</span>
              </div>
              <button class="secondary video-project-dropdown" type="button"><span>Project: Fantasy Characters</span>${renderButtonIcon("expand")}</button>
              <div class="video-appbar-actions">
                <span class="video-autosave-status"><span aria-hidden="true"></span>Auto-save</span>
                <button class="secondary mini-button" type="button" title="Undo" aria-label="Undo">${renderButtonIcon("refresh")}</button>
                <button class="secondary mini-button" type="button" title="Redo" aria-label="Redo">${renderButtonIcon("refresh")}</button>
                <button class="secondary mini-button" type="button" title="Help" aria-label="Help">${renderButtonIcon("history")}</button>
                <button class="secondary mini-button" type="button" title="Settings" aria-label="Settings">${renderButtonIcon("settings")}</button>
                <button class="secondary mini-button video-share-button" type="button">${renderButtonIcon("upload")}<span>Share</span></button>
                <span class="video-user-avatar">JD</span>
              </div>
            </div>
            <div class="studio-card-header">
              <div class="panel-heading">
                <h3>Video Studio</h3>
                <div class="panel-subtitle">Generate text-to-video or image-plus-text motion clips with the dedicated Hunyuan workflows.</div>
              </div>
              <div class="studio-card-header-actions">
                <button class="secondary workflow-sidebar-toggle-button" id="video-sidebar-toggle-button" data-workflow-sidebar-toggle="video" aria-controls="video-sidebar-panel" aria-expanded="true" aria-pressed="false" type="button">${renderButtonIcon("expand")}<span data-workflow-sidebar-toggle-label>Hide Sidebar</span></button>
              </div>
            </div>
            <div class="studio-workflow-layout video-studio-workspace" data-workflow-sidebar-workspace="video">
              <div class="studio-workflow-main studio-component-form video-studio-main">
                <div class="field studio-step-card video-side-card video-preview-card-main studio-component-preview-card">
                  <label>Latest Preview</label>
                  <video id="videogen-preview" controls></video>
                  <div class="hint video-preview-scrub-hint" id="videogen-preview-scrub-hint">Pause and drag left or right on the preview to scrub frames.</div>
                  <div class="row video-studio-preview-tools studio-component-toolbar">
                    <div class="video-preview-tool-group video-preview-edit-tools">
                      <button class="secondary mini-button" data-video-preview-action="upscale" type="button">${renderButtonIcon("expand")}<span>Upscale</span></button>
                      <button class="secondary mini-button" data-video-preview-action="extend" type="button">${renderButtonIcon("plus")}<span>Extend</span></button>
                      <button class="secondary mini-button" data-video-preview-action="edit" type="button">${renderButtonIcon("wand")}<span>Edit</span></button>
                      <button class="secondary mini-button" data-video-preview-action="delight" type="button">${renderButtonIcon("sparkle")}<span>Delight</span></button>
                      <button class="secondary mini-button" data-video-preview-action="remove-bg" type="button">${renderButtonIcon("trash")}<span>Remove BG</span></button>
                      <button class="secondary mini-button" data-video-preview-action="reframe" type="button">${renderButtonIcon("image")}<span>Reframe</span></button>
                      <button class="secondary mini-button" data-video-preview-action="add-audio" type="button">${renderButtonIcon("audio")}<span>Add Audio</span></button>
                    </div>
                    <div class="video-preview-tool-group video-preview-export-tools">
                      <button class="secondary mini-button" id="video-convert-gif-button" type="button">${renderButtonIcon("video")}<span>Create GIF</span></button>
                      <div class="studio-tool-picker" id="video-tool-picker">
                        <button class="secondary mini-button" id="video-tool-picker-toggle" type="button" aria-expanded="false">${renderButtonIcon("settings")}<span id="video-tool-picker-label">Select Tool</span></button>
                        <div class="studio-tool-picker-menu hidden" id="video-tool-picker-menu"></div>
                      </div>
                      <button class="secondary mini-button" id="video-send-to-tool-button" type="button">${renderButtonIcon("expand")}<span>Send To Tool</span></button>
                      <button class="secondary mini-button" id="video-send-to-game-engine-button" type="button">${renderButtonIcon("upload")}<span>Send To Engine</span></button>
                    </div>
                  </div>
                  <div class="row video-studio-preview-tools video-tool-quick-actions" id="video-tool-quick-actions"></div>
                </div>
                <div class="field video-prompt-field-card studio-component-form-section">
                  <div class="workspace-tabs-new studio-primary-tabs" role="tablist" aria-label="Video workflow mode">
                    <button class="dashboard-tab active" data-video-workflow-mode="text" type="button" role="tab" aria-selected="true">${renderButtonIcon("file")}<span>Text To Video</span></button>
                    <button class="dashboard-tab" data-video-workflow-mode="image-text" type="button" role="tab" aria-selected="false">${renderButtonIcon("image")}<span>Image + Text To Video</span></button>
                  </div>

                  <!-- Start Image Source -->
                  <div class="field hidden" id="videogen-image-source-field" tabindex="0">
                    <label for="videogen-source-image-input">Start Image</label>
                    <input id="videogen-source-image-input" type="file" accept="image/*">
                    <div class="video-source-preview hidden" id="videogen-source-image-preview">
                      <img id="videogen-source-image-preview-image" alt="Selected Video Studio start image preview">
                      <div class="video-source-preview-meta">
                        <div class="video-source-preview-label">Current Start Image</div>
                        <div class="video-source-preview-name" id="videogen-source-image-preview-name">No start image selected.</div>
                      </div>
                    </div>
                  </div>

                  <!-- Prompt Area -->
                  <div class="video-prompt-header">
                    <label for="videogen-prompt">Prompt</label>
                    <span class="video-prompt-counter"><span id="videogen-prompt-count">0</span>/1000</span>
                  </div>
                  <div class="video-prompt-textarea-wrapper">
                    <textarea id="videogen-prompt" placeholder="Describe the video you want." maxlength="1000"></textarea>
                    <button class="secondary mini-button video-ai-sparkle-btn" id="videogen-create-ai-prompt-button" type="button">${renderButtonIcon("sparkle")}</button>
                  </div>

                  <!-- Text Source Select -->
                  <select id="videogen-prompt-text-file" data-text-source-select="single" data-text-source-empty-label="No prompt text source selected"></select>
                  <div class="hint">Optional. One random line is merged with the prompt for each video generation.</div>

                  <!-- Avoid Repeats Toggle -->
                  <div class="toggle compact-toggle">
                    <span>Avoid repeats until all lines are used</span>
                    <input id="videogen-prompt-text-no-repeat" type="checkbox">
                  </div>

                  <!-- Motion Controls Grid -->
                  <div class="video-section-label">Motion Controls</div>
                  <div class="video-motion-grid">
                    <button class="video-motion-item" data-video-motion="orbit" type="button">${renderButtonIcon("expand")}<span>Orbit</span></button>
                    <button class="video-motion-item" data-video-motion="zoom-in" type="button">${renderButtonIcon("expand")}<span>Zoom In</span></button>
                    <button class="video-motion-item" data-video-motion="pan-left" type="button">${renderButtonIcon("expand")}<span>Pan Left</span></button>
                    <button class="video-motion-item" data-video-motion="pan-right" type="button">${renderButtonIcon("expand")}<span>Pan Right</span></button>
                    <button class="video-motion-item" data-video-motion="tilt-up" type="button">${renderButtonIcon("expand")}<span>Tilt Up</span></button>
                    <button class="video-motion-item" data-video-motion="tilt-down" type="button">${renderButtonIcon("expand")}<span>Tilt Down</span></button>
                  </div>

                  <!-- Video Presets Cards -->
                  <div class="video-section-label">Video Presets</div>
                  <div class="video-preset-cards">
                    <button class="video-preset-card active" data-video-preset="cinematic" type="button">Cinematic</button>
                    <button class="video-preset-card" data-video-preset="animation" type="button">Animation</button>
                    <button class="video-preset-card" data-video-preset="realistic" type="button">Realistic</button>
                    <button class="video-preset-card" data-video-preset="anime" type="button">Anime</button>
                  </div>

                  <!-- Prompt Presets Strip -->
                  <div class="studio-field-preset-strip video-preset-strips">
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="A cinematic orbital camera shot around the subject, camera quickly circling the subject while the subject remains stationary, stable geometry, consistent lighting, smooth turntable motion, clean background, high consistency." type="button">${renderButtonIcon("video")}<span>Rotate Camera Around</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="The subject performs a fast in-place 360 degree rotation, physically turning its body around its vertical axis, consistent proportions, stable anatomy, rigid object motion, no deformation, clean turntable spin, even lighting, fixed camera." type="button">${renderButtonIcon("video")}<span>Turn 360°</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="A slow cinematic push-in toward the subject with perfectly smooth stabilized camera motion, subtle parallax, consistent framing, stable geometry, and natural cinematic depth." type="button">${renderButtonIcon("sparkle")}<span>Push In</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="A clean cinematic hero turntable shot, camera smoothly orbiting around the character with even pacing, locked framing, studio-style stabilization, consistent lighting, and stable character details." type="button">${renderButtonIcon("box")}<span>Turntable</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="The character remains mostly still with subtle idle breathing, gentle cloth and hair motion, tiny natural body sway, stable anatomy, and a calm locked cinematic camera." type="button">${renderButtonIcon("image")}<span>Idle Motion</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="The character performs a clean in-place walk cycle with readable leg motion, balanced timing, natural arm swing, stable anatomy, and a smooth locked side-view cinematic camera." type="button">${renderButtonIcon("expand")}<span>Walk Cycle</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset-button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="The shot begins wider and slowly reveals the character with a smooth cinematic arc camera move, gentle parallax, stable composition, consistent lighting, and polished cinematic motion." type="button">${renderButtonIcon("wand")}<span>Reveal Arc</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset.button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="A dynamic action shot with fast camera movement, dramatic angles, motion blur, and a sense of speed and energy." type="button">${renderButtonIcon("sparkle")}<span>Action Shot</span></button>
                    <button class="secondary mini-button studio-prompt-preset-button" data-prompt-preset.button="true" data-prompt-preset-target="videogen-prompt" data-prompt-preset-value="A cinematic treasure chest slowly creaks open like a heavy ancient door, revealing an intense glowing light and mysterious artifacts inside. Brilliant golden rays burst outward through the cracks, illuminating the surrounding scene with dramatic volumetric lighting, floating dust particles, soft smoke, and high-contrast shadows. The camera stays in place, creating an epic magical reveal with realistic reflections and atmospheric effects." type="button">${renderButtonIcon("box")}<span>Chest Open</span></button>
                  </div>

                  <!-- AI Prompt Toggle -->
                  <div class="studio-toggle-grid video-ai-prompt-toggle">
                    <div class="toggle compact-toggle">
                      <span>Let LazyDev create its own video prompt</span>
                      <input id="videogen-auto-prompt" type="checkbox">
                    </div>
                    <input id="videogen-auto-prompt-direction" placeholder="Optional direction for LazyDev's video prompt">
                  </div>

                  <!-- Collapsible Advanced Settings -->
                  <details class="video-advanced-settings studio-component-advanced-settings">
                        <summary class="video-advanced-summary">${renderButtonIcon("settings")}<span>Advanced Settings</span></summary>
                        <div class="video-advanced-content">
                          <!-- Aspect Ratio Segmented Control -->
                          <div class="video-setting-row">
                            <label>Aspect Ratio</label>
                            <div class="studio-segmented-control">
                              <button class="active" data-video-aspect-ratio="16:9" type="button">16:9</button>
                              <button data-video-aspect-ratio="9:16" type="button">9:16</button>
                              <button data-video-aspect-ratio="1:1" type="button">1:1</button>
                              <button data-video-aspect-ratio="4:5" type="button">4:5</button>
                              <button data-video-aspect-ratio="21:9" type="button">21:9</button>
                              <button data-video-aspect-ratio="custom" type="button">Custom</button>
                            </div>
                          </div>

                          <!-- Duration Segmented Control -->
                          <div class="video-setting-row">
                            <label>Duration</label>
                            <div class="studio-segmented-control">
                              <button data-video-duration-seconds="3" type="button">3s</button>
                              <button class="active" data-video-duration-seconds="5" type="button">5s</button>
                              <button data-video-duration-seconds="10" type="button">10s</button>
                              <button data-video-duration-seconds="15" type="button">15s</button>
                            </div>
                          </div>

                          <!-- Resolution Segmented Control -->
                          <div class="video-setting-row">
                            <label>Resolution</label>
                            <div class="studio-segmented-control">
                              <button data-video-resolution="720" type="button">720p</button>
                              <button class="active" data-video-resolution="1080" type="button">1080p</button>
                              <button data-video-resolution="2160" type="button">4K</button>
                            </div>
                          </div>

                          <!-- FPS Segmented Control -->
                          <div class="video-setting-row">
                            <label>FPS</label>
                            <div class="studio-segmented-control">
                              <button data-video-fps="24" type="button">24</button>
                              <button class="active" data-video-fps="30" type="button">30</button>
                              <button data-video-fps="60" type="button">60</button>
                            </div>
                          </div>

                          <!-- Custom Dimensions -->
                          <div class="video-creative-grid video-dimensions-grid">
                            <div class="field"><label for="videogen-width">Width</label><input id="videogen-width" type="number" min="64" max="4096" step="8" placeholder="1920"></div>
                            <div class="field"><label for="videogen-height">Height</label><input id="videogen-height" type="number" min="64" max="4096" step="8" placeholder="1080"></div>
                          </div>

                          <!-- Frames, Steps, Seed -->
                          <div class="video-setting-row"><label for="videogen-frames">Frames</label><input id="videogen-frames" type="number" min="1" max="512" step="1" placeholder="150"></div>
                          <div class="video-setting-row"><label for="video-editor-steps">Steps</label><input id="video-editor-steps" type="number" min="1" max="250" step="1" value="25"></div>
                          <div class="video-setting-row"><label for="video-editor-seed">Seed</label><input id="video-editor-seed" type="number" min="0" step="1" placeholder="Random"></div>
                          <div class="video-setting-row"><label for="video-editor-seed-control">Control After Generate</label><select id="video-editor-seed-control"><option value="fixed">Fixed</option><option value="increase">Increase</option><option value="decrease">Decrease</option><option value="randomize" selected>Randomize</option></select></div>
                          <div class="video-setting-row"><label for="video-generate-count">Videos</label><input id="video-generate-count" type="number" min="1" max="8" step="1" value="1"></div>
                        </div>
                      </details>

                  <!-- Generate Button -->
                  <div class="studio-component-toolbar">
                    <button id="generate-video-button">Generate Video</button>
                    <button class="secondary hidden" id="stop-video-generation-button" type="button" hidden>Stop</button>
                  </div>
                </div>
                <div class="field video-negative-field-card">
                  <label for="videogen-negative-prompt">Negative Prompt</label>
                  <textarea id="videogen-negative-prompt" placeholder="Optional: describe what to avoid."></textarea>
                </div>
                <div class="studio-step-card studio-preset-card">
                  <label>Video Presets</label>
                  <div class="studio-field-preset-strip">
                    <button class="secondary mini-button" data-field-preset-label="Sprite Animation" data-field-preset-values="videogen-width:512|videogen-height:512|videogen-frames:13|videogen-fps:6|videogen-steps:25" type="button">${renderButtonIcon("video")}<span>Sprite Animation</span></button>
                    <button class="secondary mini-button" data-field-preset-label="Short Portrait Clip" data-field-preset-values="videogen-width:480|videogen-height:720|videogen-frames:49|videogen-fps:8|videogen-steps:25" type="button">${renderButtonIcon("video")}<span>Portrait Clip</span></button>
                    <button class="secondary mini-button" data-field-preset-label="Wide Scene Clip" data-field-preset-values="videogen-width:832|videogen-height:480|videogen-frames:49|videogen-fps:8|videogen-steps:25" type="button">${renderButtonIcon("video")}<span>Wide Scene</span></button>
                  </div>
                </div>
                <div class="image-workflow-input-grid">
                  <div class="field">
                    <label for="videogen-fps">FPS</label>
                    <input id="videogen-fps" type="number" min="1" max="60" step="1" placeholder="6">
                  </div>
                  <div class="field">
                    <label for="videogen-steps">Steps</label>
                    <input id="videogen-steps" type="number" min="1" max="250" step="1" placeholder="25">
                  </div>
                  <div class="field">
                    <label for="videogen-batch-size">Videos</label>
                    <input id="videogen-batch-size" type="number" min="1" max="8" step="1" value="1">
                  </div>
                </div>
                <div class="field video-post-field">
                  <label for="videogen-post-messenger-select">Post generated video to</label>
                  <select id="videogen-post-messenger-select">
                    <option value="none" selected>Do not post</option>
                    <option value="discord">Discord</option>
                    <option value="telegram">Telegram</option>
                    <option value="matrix">Matrix</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <select id="videogen-post-destination-input">
                    <option value="">Choose destination</option>
                  </select>
                  <div class="row" id="videogen-post-use-selected-discord-row">
                    <button class="secondary" id="videogen-post-use-selected-discord-button" type="button">Use Selected Discord Channel</button>
                  </div>
                  <div class="hint" id="videogen-post-destination-hint">Pick a messenger and provide the destination ID.</div>
                </div>
                <div class="video-bottom-dock">
                  <section class="video-dock-panel video-filmstrip-panel">
                    <div class="studio-tabs"><button class="active" type="button">Project Videos</button><button type="button">Favorites</button></div>
                    <div class="recent-media-controls" id="video-recent-media-controls"></div>
                    <div class="video-filmstrip" id="video-bottom-filmstrip"></div>
                  </section>
                </div>
              </div>
              <div class="studio-workflow-side-resizer" data-workflow-sidebar-resizer="video" aria-hidden="true"></div>
              <aside class="studio-workflow-side video-studio-side" id="video-sidebar-panel" data-workflow-sidebar-panel="video" data-studio-inspector-panel="true">
                ${renderStudioStatusPanel({
                  statusKey: "videogen",
                  initialMessage: "No video generation run yet.",
                  progressLabel: "Video generation progress"
                })}
                <div class="field studio-step-card video-side-card">
                  <label>Latest Images</label>
                  <div class="studio-bounded-section compact-media-section">
                    <div class="latest-media-grid" id="video-latest-image-list"></div>
                  </div>
                </div>
                <div class="field studio-step-card video-side-card">
                  <label>Latest GIFs</label>
                  <div class="studio-bounded-section compact-media-section">
                    <div class="latest-media-grid" id="video-latest-gif-list"></div>
                  </div>
                </div>
                <div class="video-info-panel studio-component-metadata" id="videogen-meta-output">
                  <span>No video selected.</span>
                </div>
                <section class="video-dock-panel video-queue-panel studio-component-queue">
                  <div class="studio-tabs"><button class="active" type="button">Generation Queue</button><button type="button">Console</button></div>
                  <div class="video-queue-list" id="video-bottom-queue-list"></div>
                </section>
              </aside>
            </div>
            ${renderWorkflowSettingsFooter([
              {
                panel: "video-comfy",
                title: "Separate Setting: Video ComfyUI Workflow",
                kicker: "Video Studio",
                label: "Video ComfyUI Workflow"
              }
            ])}
          </article>
        </div>
        ${renderWorkflowSettingsOverlay()}
        ${renderGameEngineSendOverlay()}
      </section>`;
}
