export function renderDashboardJoinAutomationPanel(): string {
  return `
        <div class="automation-panel" id="automation-panel-join" data-discord-only="true">
          <div class="automation-workspace">
            <article class="panel-card automation-card automation-browser-card">
              <div class="panel-heading">
                <h3>Join Presets</h3>
                <div class="panel-subtitle">Start from a preset, then tune the follow-up for your server.</div>
              </div>
              <div class="field">
                <label for="join-preset-select">Preset</label>
                <select id="join-preset-select"></select>
              </div>
              <div class="row automation-toolbar">
                <button id="apply-join-preset-button">Apply Preset</button>
                <button class="secondary" id="clear-join-form-button">New Join Action</button>
              </div>
              <div class="list medium-list" id="join-automation-list"></div>
            </article>

            <article class="panel-card automation-card automation-editor-card">
              <div class="panel-heading">
                <h3>Join Follow-Up Setup</h3>
                <div class="panel-subtitle">Pick where the follow-up lands, how long to wait, and what type of message should be sent.</div>
              </div>
              <div class="field">
                <label>Target Channel</label>
                <div class="chip" id="join-target-channel-chip">Choose a channel in the sidebar, then use it here.</div>
              </div>
              <div class="field">
                <label for="join-target-channel-select">Join Target Channel</label>
                <select id="join-target-channel-select">
                  <option value="">Choose channel</option>
                </select>
              </div>
              <div class="row">
                <button class="secondary" id="join-use-selected-channel-button">Use Selected Channel</button>
              </div>

              <details class="fold-card">
                <summary>Join Action</summary>
                <div class="fold-content">
                  <div class="field">
                    <label for="join-name">Name</label>
                    <input id="join-name" placeholder="Welcome checklist">
                  </div>
                  <div class="toggle">
                    <span>Enabled</span>
                    <input id="join-enabled" type="checkbox" checked>
                  </div>
                  <div class="field">
                    <label for="join-delay-seconds">Delay Seconds</label>
                    <input id="join-delay-seconds" type="number" min="0" step="1">
                  </div>
                </div>
              </details>

              <details class="fold-card">
                <summary>Content</summary>
                <div class="fold-content">
                  <div class="field">
                    <label for="join-source">Source</label>
                    <select id="join-source">
                      <option value="jokes-file">Random Line From File</option>
                      <option value="ollama">Rod Prompt</option>
                      <option value="template">Plain Template</option>
                      <option value="model-3d">3D Model From Image</option>
                    </select>
                  </div>
                  <div class="field" id="join-jokes-file-field">
                    <label for="join-text-files">Source Files</label>
                    <select id="join-text-files" multiple size="6"></select>
                    <div class="hint">Pick one or more \`.txt\` files. Discrod will choose a random line from the combined list.</div>
                    <div class="hint">Tip: use Ctrl/Cmd-click or Shift-click to select multiple files.</div>
                  </div>
                  <div class="field" id="join-prompt-field">
                    <label for="join-prompt">Prompt</label>
                    <textarea id="join-prompt" placeholder="Write one short warm onboarding tip for {username} joining {server}."></textarea>
                  </div>
                  <div class="field hidden" id="join-prompt-text-file-field">
                    <label for="join-prompt-text-file">Prompt Text Source File</label>
                    <select id="join-prompt-text-file"></select>
                    <div class="hint">Optional. One random line is picked per run and used for image/model prompt generation.</div>
                    <div class="hint">If prompt contains <code>{line}</code>, the line is injected there; otherwise it is appended.</div>
                  </div>
                  <div class="field hidden" id="join-text-source-selection-field">
                    <div class="toggle">
                      <span>Avoid repeats until all lines are used</span>
                      <input id="join-text-source-no-repeat" type="checkbox">
                    </div>
                    <div class="hint">Stores pick history for the selected text source pool, then resets after every line has been used once.</div>
                  </div>
                  <div class="field" id="join-template-field">
                    <label for="join-template">Template</label>
                    <textarea id="join-template" placeholder="Good to have you here, {user}."></textarea>
                  </div>
                  <div class="field hidden" id="join-model-image-field">
                    <label for="join-model-image">Model Source Image</label>
                    <input id="join-model-image" placeholder="https://example.com/image.png or C:\\images\\seed.png">
                    <input id="join-model-image-file" type="file" accept="image/*" hidden>
                    <div class="row">
                      <button class="secondary" id="join-model-image-browse-button">Choose Local Image</button>
                    </div>
                    <div class="hint">Required for 3D model source. Supports URLs, local paths, and data URLs. Multiple lines are allowed and one is picked randomly each run.</div>
                    <div class="toggle">
                      <span>Pick random source image from all available inputs</span>
                      <input id="join-model-random-source" type="checkbox" checked>
                    </div>
                    <div class="field">
                      <label for="join-model-image-pool">Image Pool</label>
                      <select id="join-model-image-pool"></select>
                      <div class="hint">Optional. Pool entries are merged with manual image entries at run time.</div>
                    </div>
                    <div class="field">
                      <label for="join-model-generation-target">3D model generation execution</label>
                      <select id="join-model-generation-target">
                        <option value="local">This machine</option>
                        <option value="remote">Remote worker machine</option>
                      </select>
                    </div>
                    <div class="toggle">
                      <span>Let bot create its own 3D prompt</span>
                      <input id="join-model-auto-prompt" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>Ask LLM if model should be metallic</span>
                      <input id="join-model-ask-llm-metallic" type="checkbox">
                    </div>
                    <div class="hint">Fully metallic objects enable metallic, non-metal objects disable it, mixed materials stay unchanged.</div>
                    <div class="toggle">
                      <span>Ask LLM real-world height and scale model</span>
                      <input id="join-model-auto-scale-real-height" type="checkbox">
                    </div>
                    <div class="hint">LLM estimates typical real-world height from source image and model is scaled uniformly.</div>
                    <div class="toggle">
                      <span>Use LLM for model filename</span>
                      <input id="join-model-llm-filename" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>Use LLM for model description</span>
                      <input id="join-model-llm-description" type="checkbox">
                    </div>
                    <div class="field">
                      <label for="join-model-llm-metadata-timing">LLM Metadata Timing</label>
                      <select id="join-model-llm-metadata-timing">
                        <option value="before">Before 3D generation</option>
                        <option value="after">After 3D generation</option>
                        <option value="parallel">At same time as 3D generation</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="join-model-metadata-target">LLM metadata execution</label>
                      <select id="join-model-metadata-target">
                        <option value="local">This machine</option>
                        <option value="remote">Remote worker machine</option>
                      </select>
                    </div>
                    <div class="toggle">
                      <span>Unload active LLM model before 3D generation</span>
                      <input id="join-model-unload-llm-before-generate" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Post source image start notice before generation</span>
                      <input id="join-model-send-start-notice" type="checkbox" checked>
                    </div>
                  </div>
                </div>
              </details>

              <div class="row automation-toolbar automation-save-row">
                <button id="save-join-button">Save Join Action</button>
                <button class="secondary" id="delete-join-button">Delete Selected</button>
              </div>
            </article>
          </div>
        </div>
`;
}
