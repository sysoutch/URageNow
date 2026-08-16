interface DashboardScheduledAutomationPanelInput {
  model3dInitialThreadExtraText: string;
  model3dDestinationExtraText: string;
}

export function renderDashboardScheduledAutomationPanel(input: DashboardScheduledAutomationPanelInput): string {
  return `
        <div class="automation-panel active" id="automation-panel-scheduled">
          <div class="automation-workspace">
            <article class="panel-card automation-card automation-browser-card">
              <div class="panel-heading">
                <h3>Scheduled Library</h3>
                <div class="panel-subtitle">Pick a preset, browse existing jobs, or start a fresh one.</div>
              </div>
              <div class="field">
                <label for="schedule-preset-select">Preset</label>
                <select id="schedule-preset-select"></select>
              </div>
              <div class="row automation-toolbar">
                <button id="apply-schedule-preset-button">Apply Preset</button>
                <button class="secondary" id="clear-schedule-form-button">New Job</button>
              </div>
              <div class="list medium-list" id="scheduled-automation-list"></div>
              <details class="fold-card automation-side-fold">
                <summary>Text Sources</summary>
                <div class="fold-content">
                  <div class="list medium-list" id="automation-text-source-list"></div>
                  <div class="row automation-toolbar">
                    <button class="secondary" id="refresh-automation-text-sources-button">Refresh Files</button>
                  </div>
                  <div class="hint" id="automation-text-sources-refresh-status">Text sources not loaded yet.</div>
                  <div class="hint">Create reusable text pools here, then mix several files together in one scheduled post.</div>
                </div>
              </details>
            </article>

            <article class="panel-card automation-card automation-editor-card">
              <div class="panel-heading">
                <h3>Scheduled Post Setup</h3>
                <div class="panel-subtitle">Build a repeat post for Discord channels, Telegram chats, or Matrix rooms. Basic mode keeps timing friendly, and advanced mode exposes raw cron.</div>
              </div>
              <div class="field">
                <label>Target Destination</label>
                <div class="chip" id="scheduled-target-channel-chip">Choose a destination, then use it here.</div>
              </div>
              <div class="field">
                <label for="scheduled-target-messenger-select">Target Messenger</label>
                <select id="scheduled-target-messenger-select">
                  <option value="discord">Discord</option>
                  <option value="telegram">Telegram</option>
                  <option value="matrix">Matrix</option>
                </select>
              </div>
              <div class="field" id="scheduled-target-discord-field">
                <label for="scheduled-target-channel-select">Scheduled Target Channel</label>
                <select id="scheduled-target-channel-select">
                  <option value="">Choose channel</option>
                </select>
              </div>
              <div class="row" id="scheduled-target-discord-actions">
                <button class="secondary" id="scheduled-use-selected-channel-button">Use Selected Channel</button>
              </div>
              <div class="field hidden" id="scheduled-target-telegram-field">
                <label for="scheduled-target-telegram-chat-id">Telegram Chat ID</label>
                <input id="scheduled-target-telegram-chat-id" placeholder="Telegram chat ID">
              </div>
              <div class="row hidden" id="scheduled-target-telegram-actions">
                <button class="secondary" id="scheduled-use-selected-telegram-chat-button">Use Selected Telegram Chat</button>
              </div>
              <div class="field hidden" id="scheduled-target-matrix-field">
                <label for="scheduled-target-matrix-room-id">Matrix Room ID</label>
                <input id="scheduled-target-matrix-room-id" placeholder="!room:server">
              </div>
              <div class="row hidden" id="scheduled-target-matrix-actions">
                <button class="secondary" id="scheduled-use-selected-matrix-room-button">Use Entered Matrix Room</button>
              </div>

              <details class="fold-card">
                <summary>Job Basics</summary>
                <div class="fold-content">
                  <div class="field">
                    <label for="scheduled-name">Name</label>
                    <input id="scheduled-name" placeholder="Daily tip">
                  </div>
                  <div class="toggle">
                    <span>Enabled</span>
                    <input id="scheduled-enabled" type="checkbox" checked>
                  </div>
                </div>
              </details>

              <details class="fold-card">
                <summary>Timing</summary>
                <div class="fold-content">
                  <div class="dashboard-tabs">
                    <button class="ghost active" data-scheduled-trigger-mode="cron">Cron / Calendar</button>
                    <button class="ghost" data-scheduled-trigger-mode="interval">Run Every X</button>
                  </div>
                  <div class="dashboard-tabs">
                    <button class="ghost active" data-schedule-mode="basic">Basic</button>
                    <button class="ghost" data-schedule-mode="advanced">Advanced</button>
                  </div>
                  <div id="scheduled-cron-panels">
                    <div id="scheduled-basic-panel">
                      <div class="compact-grid two-col">
                        <div class="field">
                          <label for="scheduled-basic-pattern">Repeat</label>
                          <select id="scheduled-basic-pattern">
                            <option value="daily">Every day</option>
                            <option value="weekdays">Weekdays</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div class="field">
                          <label for="scheduled-basic-time">Time</label>
                          <input id="scheduled-basic-time" type="time" value="09:00">
                        </div>
                      </div>
                      <div class="compact-grid two-col">
                        <div class="field" id="scheduled-weekday-field">
                          <label for="scheduled-basic-weekday">Weekday</label>
                          <select id="scheduled-basic-weekday">
                            <option value="1">Monday</option>
                            <option value="2">Tuesday</option>
                            <option value="3">Wednesday</option>
                            <option value="4">Thursday</option>
                            <option value="5">Friday</option>
                            <option value="6">Saturday</option>
                            <option value="0">Sunday</option>
                          </select>
                        </div>
                        <div class="field hidden" id="scheduled-monthday-field">
                          <label for="scheduled-basic-monthday">Day Of Month</label>
                          <input id="scheduled-basic-monthday" type="number" min="1" max="31" step="1" value="1">
                        </div>
                      </div>
                      <div class="field">
                        <label>Cron Preview</label>
                        <div class="chip" id="scheduled-cron-preview">0 9 * * *</div>
                      </div>
                    </div>
                    <div id="scheduled-advanced-panel" class="hidden">
                      <div class="field">
                        <label for="scheduled-cron">Cron</label>
                        <input id="scheduled-cron" placeholder="0 9 * * *">
                      </div>
                      <div class="hint">Example: <code>0 9 * * *</code> for every day at 09:00, or <code>0 18 * * 0</code> for Sundays at 18:00.</div>
                    </div>
                  </div>
                  <div id="scheduled-interval-panel" class="hidden">
                    <div class="compact-grid two-col">
                      <div class="field">
                        <label for="scheduled-interval-value">Run Every</label>
                        <input id="scheduled-interval-value" type="number" min="1" step="1" value="1">
                      </div>
                      <div class="field">
                        <label for="scheduled-interval-unit">Unit</label>
                        <select id="scheduled-interval-unit">
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                    <div class="field">
                      <label>Interval Preview</label>
                      <div class="chip" id="scheduled-interval-preview">Runs every 1 day.</div>
                    </div>
                  </div>
                  <div class="compact-grid two-col">
                    <div class="field">
                      <label for="scheduled-repeat-count">Repeat Each Run</label>
                      <input id="scheduled-repeat-count" type="number" min="1" step="1" value="1">
                    </div>
                    <div class="field">
                      <label for="scheduled-repeat-delay-seconds">Delay Between Repeats (seconds)</label>
                      <input id="scheduled-repeat-delay-seconds" type="number" min="0" step="1" value="0">
                    </div>
                  </div>
                </div>
              </details>

              <details class="fold-card">
                <summary>Content</summary>
                <div class="fold-content">
                  <div class="field">
                    <label for="scheduled-source">Source</label>
                    <select id="scheduled-source">
                      <option value="unity-publisher-gift">Unity Publisher Gift</option>
                      <option value="jokes-file">Random Line From File</option>
                      <option value="ollama">Rod Prompt</option>
                      <option value="image">Text To Image</option>
                      <option value="template">Plain Template</option>
                      <option value="model-3d">3D Model From Image</option>
                    </select>
                  </div>
                  <div class="field" id="scheduled-jokes-file-field">
                    <label for="scheduled-text-files">Source Files</label>
                    <select id="scheduled-text-files" multiple size="6"></select>
                    <div class="hint">Pick one or more \`.txt\` files. Discrod will pull a random line from the combined pool.</div>
                    <div class="hint">Tip: use Ctrl/Cmd-click or Shift-click to select multiple files.</div>
                  </div>
                  <div class="field" id="scheduled-prompt-field">
                    <label for="scheduled-prompt">Prompt</label>
                    <textarea id="scheduled-prompt" placeholder="Write one short useful community tip for the {server} Discord server."></textarea>
                  </div>
                  <div class="field hidden" id="scheduled-prompt-text-file-field">
                    <label for="scheduled-prompt-text-file">Prompt Text Source File</label>
                    <select id="scheduled-prompt-text-file"></select>
                    <div class="hint">Optional. One random line is picked per run and used for image/model prompt generation.</div>
                    <div class="hint">If prompt contains <code>{line}</code>, the line is injected there; otherwise it is appended.</div>
                  </div>
                  <div class="field hidden" id="scheduled-text-source-selection-field">
                    <div class="toggle">
                      <span>Avoid repeats until all lines are used</span>
                      <input id="scheduled-text-source-no-repeat" type="checkbox">
                    </div>
                    <div class="hint">Stores pick history for the selected text source pool, then resets after every line has been used once.</div>
                  </div>
                  <div class="toggle hidden" id="scheduled-image-auto-prompt-toggle">
                    <span>Let LazyDev expand this into a richer image prompt</span>
                    <input id="scheduled-image-auto-prompt" type="checkbox">
                  </div>
                  <div class="toggle hidden" id="scheduled-image-auto-filename-toggle">
                    <span>Let LazyDev create the image filename separately</span>
                    <input id="scheduled-image-auto-filename" type="checkbox">
                  </div>
                  <div class="toggle hidden" id="scheduled-image-auto-description-toggle">
                    <span>Let LazyDev create the Discord description separately</span>
                    <input id="scheduled-image-auto-description" type="checkbox">
                  </div>
                  <div class="field hidden" id="scheduled-image-candidates-field">
                    <div class="toggle">
                      <span>Generate several images, then choose one to post</span>
                      <input id="scheduled-image-candidate-selection-enabled" type="checkbox">
                    </div>
                    <div class="compact-grid three-col" id="scheduled-image-candidate-options">
                      <div class="field">
                        <label for="scheduled-image-candidate-count">Candidate Amount</label>
                        <input id="scheduled-image-candidate-count" type="number" min="1" max="12" step="1" value="3">
                      </div>
                      <div class="field">
                        <label for="scheduled-image-candidate-selection-mode">Pick Winner</label>
                        <select id="scheduled-image-candidate-selection-mode">
                          <option value="llm">Let LazyDev pick</option>
                          <option value="first">Use first image</option>
                        </select>
                      </div>
                      <div class="field">
                        <label for="scheduled-image-candidate-queue-mode">Queue Mode</label>
                        <select id="scheduled-image-candidate-queue-mode">
                          <option value="sequential">Wait for each image</option>
                          <option value="comfy">Send all to Comfy queue</option>
                        </select>
                      </div>
                      <div class="field">
                        <label for="scheduled-image-candidate-processing-mode">Version Processing</label>
                        <select id="scheduled-image-candidate-processing-mode">
                          <option value="selected">Only chosen image</option>
                          <option value="all">All candidates</option>
                        </select>
                      </div>
                    </div>
                    <div class="hint">Candidate amount counts original choices. Sequential queueing is the default, and version processing can run only on the chosen image or on every candidate.</div>
                  </div>
                  <div class="field hidden" id="scheduled-image-video-followup-field">
                    <div class="toggle">
                      <span>Also let LazyDev create and post a video after the image</span>
                      <input id="scheduled-image-create-video" type="checkbox">
                    </div>
                    <label for="scheduled-image-video-direction">Video Prompt Direction</label>
                    <input id="scheduled-image-video-direction" placeholder="Optional motion, camera, mood, or story direction">
                    <div class="field">
                      <label for="scheduled-image-video-mode">Video Generation Mode</label>
                      <select id="scheduled-image-video-mode">
                        <option value="text-to-video">Text to video</option>
                        <option value="text-image-to-video">Text + image to video</option>
                        <option value="both">Both versions</option>
                      </select>
                    </div>
                    <div class="studio-field-preset-strip">
                      <button class="secondary mini-button" data-field-preset-label="Sprite Animation" data-field-preset-values="scheduled-image-video-width:512|scheduled-image-video-height:512|scheduled-image-video-frames:13|scheduled-image-video-fps:6|scheduled-image-video-steps:25" type="button">Sprite Animation</button>
                      <button class="secondary mini-button" data-field-preset-label="Portrait Clip" data-field-preset-values="scheduled-image-video-width:480|scheduled-image-video-height:720|scheduled-image-video-frames:49|scheduled-image-video-fps:8|scheduled-image-video-steps:25" type="button">Portrait Clip</button>
                      <button class="secondary mini-button" data-field-preset-label="Wide Scene" data-field-preset-values="scheduled-image-video-width:832|scheduled-image-video-height:480|scheduled-image-video-frames:49|scheduled-image-video-fps:8|scheduled-image-video-steps:25" type="button">Wide Scene</button>
                    </div>
                    <div class="field">
                      <label for="scheduled-image-video-negative">Video Negative Prompt</label>
                      <textarea id="scheduled-image-video-negative" placeholder="Optional: avoid blur, artifacts, extra limbs, text overlays."></textarea>
                    </div>
                    <div class="image-workflow-input-grid">
                      <div class="field">
                        <label for="scheduled-image-video-width">Video Width</label>
                        <input id="scheduled-image-video-width" type="number" min="64" max="4096" step="8" value="512">
                      </div>
                      <div class="field">
                        <label for="scheduled-image-video-height">Video Height</label>
                        <input id="scheduled-image-video-height" type="number" min="64" max="4096" step="8" value="512">
                      </div>
                      <div class="field">
                        <label for="scheduled-image-video-frames">Frames</label>
                        <input id="scheduled-image-video-frames" type="number" min="1" max="512" step="1" value="13">
                      </div>
                      <div class="field">
                        <label for="scheduled-image-video-fps">FPS</label>
                        <input id="scheduled-image-video-fps" type="number" min="1" max="60" step="1" value="6">
                      </div>
                      <div class="field">
                        <label for="scheduled-image-video-steps">Steps</label>
                        <input id="scheduled-image-video-steps" type="number" min="1" max="250" step="1" value="25">
                      </div>
                    </div>
                    <div class="hint">Applies to Discord text-to-image schedules. LazyDev writes a video prompt from the image prompt plus this direction, then posts the generated video to the same destination.</div>
                  </div>
                  <div class="field hidden" id="scheduled-image-post-processing-field">
                    <label>Post Image Versions</label>
                    <div class="toggle">
                      <span>Also post remove-background version</span>
                      <input id="scheduled-image-variant-remove-background" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>Also post delight version</span>
                      <input id="scheduled-image-variant-delight" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>Also post pixel-art version</span>
                      <input id="scheduled-image-variant-pixel-art" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>After video generation, convert video to GIF</span>
                      <input id="scheduled-image-video-convert-gif" type="checkbox">
                    </div>
                    <div class="field">
                      <label for="scheduled-image-video-gif-playback-mode">GIF Playback Mode</label>
                      <select id="scheduled-image-video-gif-playback-mode">
                        <option value="loop">Loop</option>
                        <option value="pingpong">Pingpong</option>
                      </select>
                    </div>
                    <div class="toggle">
                      <span>Remove background from generated GIF</span>
                      <input id="scheduled-image-video-gif-remove-background" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>Convert generated GIF to pixel art</span>
                      <input id="scheduled-image-video-gif-pixel-art" type="checkbox">
                    </div>
                    <div class="field">
                      <label for="scheduled-image-variant-recipes">Custom Version Recipes</label>
                      <textarea class="hidden" id="scheduled-image-variant-recipes"></textarea>
                      <div class="variant-recipe-builder" id="scheduled-image-variant-recipe-builder"></div>
                      <div class="row variant-recipe-actions">
                        <button class="secondary mini-button" id="scheduled-image-add-variant-recipe-button" type="button">Add Custom Version</button>
                        <button class="secondary mini-button" id="scheduled-image-add-default-variant-recipe-button" type="button">Add Toggle Chain</button>
                        <button class="secondary mini-button" data-image-variant-recipe-preset="remove-background" type="button">Clean Cutout</button>
                        <button class="secondary mini-button" data-image-variant-recipe-preset="remove-background>pixel-art" type="button">Transparent Pixel Art</button>
                        <button class="secondary mini-button" data-image-variant-recipe-preset="pixel-art" type="button">Pixel Only</button>
                        <button class="secondary mini-button" id="scheduled-image-clear-variant-recipes-button" type="button">Clear Recipes</button>
                      </div>
                      <div class="hint">Leave recipes empty to use the toggle chain. Add custom versions only when one run should create several different outputs.</div>
                    </div>
                    <div class="field">
                      <label for="scheduled-image-variant-post-mode">Version Posting</label>
                      <select id="scheduled-image-variant-post-mode">
                        <option value="combined">Edit one Discord message with all versions</option>
                        <option value="separate">Post versions in separate messages</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="scheduled-image-variant-targets">Per-Version Targets</label>
                      <input id="scheduled-image-variant-targets" type="hidden">
                      <div class="variant-route-builder" id="scheduled-image-variant-target-list"></div>
                      <div class="row">
                        <button class="secondary" id="scheduled-image-add-variant-target-button" type="button">Add Destination Route</button>
                      </div>
                      <div class="hint">Add a route only when a specific version should go somewhere other than the main image destination.</div>
                    </div>
                    <div class="field">
                      <label for="scheduled-image-post-target-mode">Image Post Target</label>
                      <select id="scheduled-image-post-target-mode">
                        <option value="channel">Selected channel message</option>
                        <option value="thread">Create new thread in selected channel</option>
                        <option value="forum-post">Create post in forum channel (choose below)</option>
                        <option value="forum-create-and-post">Create/find forum channel and post</option>
                      </select>
                    </div>
                    <div class="toggle" id="scheduled-image-initial-post-toggle">
                      <span>Also post initial image message in selected channel</span>
                      <input id="scheduled-image-send-initial" type="checkbox">
                    </div>
                    <div class="field" id="scheduled-image-selected-channel-image-mode-field">
                      <label for="scheduled-image-selected-channel-image-mode">Selected Channel Images</label>
                      <select id="scheduled-image-selected-channel-image-mode">
                        <option value="notice-only">Notice only</option>
                        <option value="original">Original image</option>
                        <option value="all">All generated image versions</option>
                        <option value="custom">Specific version labels</option>
                      </select>
                    </div>
                    <div class="field" id="scheduled-image-selected-channel-labels-field">
                      <label for="scheduled-image-selected-channel-labels">Selected Channel Version Labels</label>
                      <input id="scheduled-image-selected-channel-labels" placeholder="Original, Pixel Art, remove-background > pixel-art">
                      <div class="hint">Comma-separated labels. Use the recipe line text or built-in labels like Original, Delight, Pixel Art.</div>
                    </div>
                    <div class="field" id="scheduled-image-thread-name-mode-field">
                      <label for="scheduled-image-thread-name-mode">Thread/Post Name Mode</label>
                      <select id="scheduled-image-thread-name-mode">
                        <option value="fixed">Specific name</option>
                        <option value="increment">Base name + increasing number</option>
                        <option value="image-name">Image filename</option>
                      </select>
                    </div>
                    <div class="field" id="scheduled-image-thread-name-field">
                      <label for="scheduled-image-thread-name">Thread/Post Name</label>
                      <input id="scheduled-image-thread-name" placeholder="Daily Image Drop">
                    </div>
                    <div class="field" id="scheduled-image-thread-base-field">
                      <label for="scheduled-image-thread-base">Thread/Post Base Name</label>
                      <input id="scheduled-image-thread-base" placeholder="Image Drop">
                    </div>
                    <div class="field" id="scheduled-image-forum-channel-id-field">
                      <label for="scheduled-image-forum-channel-id">Forum Channel</label>
                      <select id="scheduled-image-forum-channel-id">
                        <option value="">Choose forum channel below</option>
                      </select>
                    </div>
                    <div class="field" id="scheduled-image-forum-channel-name-field">
                      <label for="scheduled-image-forum-channel-name">Forum Channel Name</label>
                      <input id="scheduled-image-forum-channel-name" placeholder="images">
                    </div>
                    <div class="field" id="scheduled-image-destination-extra-field">
                      <label for="scheduled-image-destination-extra">Extra Message In Destination</label>
                      <textarea id="scheduled-image-destination-extra" placeholder="Optional extra text appended to the image post."></textarea>
                    </div>
                    <div class="field" id="scheduled-image-initial-extra-field">
                      <label for="scheduled-image-initial-extra">Extra Message In Initial Channel Post</label>
                      <textarea id="scheduled-image-initial-extra" placeholder="Optional extra text for the selected-channel mirror."></textarea>
                    </div>
                    <div class="toggle" id="scheduled-image-include-embed-toggle">
                      <span>Include metadata embeds</span>
                      <input id="scheduled-image-include-embed" type="checkbox" checked>
                    </div>
                    <div class="hint">Applies to Discord text-to-image schedules. The original image is always included.</div>
                  </div>
                  <div class="field" id="scheduled-template-field">
                    <label for="scheduled-template">Template</label>
                    <textarea id="scheduled-template" placeholder="Daily reminder for {server}."></textarea>
                  </div>
                  <div class="field hidden" id="scheduled-model-image-field">
                    <label for="scheduled-model-image">Model Source Image</label>
                    <input id="scheduled-model-image" placeholder="https://example.com/image.png or C:\\images\\seed.png">
                    <input id="scheduled-model-image-file" type="file" accept="image/*" hidden>
                    <div class="row">
                      <button class="secondary" id="scheduled-model-image-browse-button">Choose Local Image</button>
                    </div>
                    <div class="hint">Required for 3D model source. Supports URLs, local paths, and data URLs. Multiple lines are allowed and one is picked randomly each run.</div>
                    <div class="toggle">
                      <span>Pick random source image from all available inputs</span>
                      <input id="scheduled-model-random-source" type="checkbox" checked>
                    </div>
                    <div class="field">
                      <label for="scheduled-model-image-pool">Image Pool</label>
                      <select id="scheduled-model-image-pool"></select>
                      <div class="hint">Optional. Pool entries are merged with manual image entries at run time.</div>
                    </div>
                    <div class="field">
                      <label for="scheduled-model-generation-target">3D model generation execution</label>
                      <select id="scheduled-model-generation-target">
                        <option value="local">This machine</option>
                        <option value="remote">Remote worker machine</option>
                      </select>
                    </div>
                    <div class="toggle">
                      <span>Let bot create its own 3D prompt</span>
                      <input id="scheduled-model-auto-prompt" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>Ask LLM if model should be metallic</span>
                      <input id="scheduled-model-ask-llm-metallic" type="checkbox">
                    </div>
                    <div class="hint">Fully metallic objects enable metallic, non-metal objects disable it, mixed materials stay unchanged.</div>
                    <div class="toggle">
                      <span>Ask LLM real-world height and scale model</span>
                      <input id="scheduled-model-auto-scale-real-height" type="checkbox">
                    </div>
                    <div class="hint">LLM estimates typical real-world height from source image and model is scaled uniformly.</div>
                    <div class="toggle">
                      <span>Use LLM for model filename</span>
                      <input id="scheduled-model-llm-filename" type="checkbox">
                    </div>
                    <div class="toggle">
                      <span>Use LLM for model description</span>
                      <input id="scheduled-model-llm-description" type="checkbox">
                    </div>
                    <div class="field">
                      <label for="scheduled-model-llm-metadata-timing">LLM Metadata Timing</label>
                      <select id="scheduled-model-llm-metadata-timing">
                        <option value="before">Before 3D generation</option>
                        <option value="after">After 3D generation</option>
                        <option value="parallel">At same time as 3D generation</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="scheduled-model-metadata-target">LLM metadata execution</label>
                      <select id="scheduled-model-metadata-target">
                        <option value="local">This machine</option>
                        <option value="remote">Remote worker machine</option>
                      </select>
                    </div>
                    <div class="toggle">
                      <span>Unload active LLM model before 3D generation</span>
                      <input id="scheduled-model-unload-llm-before-generate" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Post source image start notice before generation</span>
                      <input id="scheduled-model-send-start-notice" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Send source image to selected channel</span>
                      <input id="scheduled-model-send-source-image-selected" type="checkbox">
                    </div>
                    <div class="field" id="scheduled-model-post-target-field">
                      <label for="scheduled-model-post-target-mode">3D Post Target</label>
                      <select id="scheduled-model-post-target-mode">
                        <option value="channel">Selected channel message</option>
                        <option value="thread">Create new thread in selected channel</option>
                        <option value="forum-post">Create post in forum channel (choose below)</option>
                        <option value="forum-create-and-post">Create/find forum channel and post</option>
                      </select>
                    </div>
                    <div class="toggle" id="scheduled-model-initial-post-toggle">
                      <span>Also post initial model message in selected channel</span>
                      <input id="scheduled-model-send-initial" type="checkbox">
                    </div>
                    <div class="field" id="scheduled-model-thread-name-mode-field">
                      <label for="scheduled-model-thread-name-mode">Thread/Post Name Mode</label>
                      <select id="scheduled-model-thread-name-mode">
                        <option value="fixed">Specific name</option>
                        <option value="increment">Base name + increasing number</option>
                        <option value="model-name">Model name</option>
                      </select>
                    </div>
                    <div class="field" id="scheduled-model-model-name-source-field">
                      <label for="scheduled-model-model-name-source">Model Name Source</label>
                      <select id="scheduled-model-model-name-source">
                        <option value="llm">LLM</option>
                        <option value="filename">Filename</option>
                      </select>
                    </div>
                    <div class="field" id="scheduled-model-thread-name-field">
                      <label for="scheduled-model-thread-name">Thread/Post Name</label>
                      <input id="scheduled-model-thread-name" placeholder="Daily Texture Drop">
                    </div>
                    <div class="field" id="scheduled-model-thread-base-field">
                      <label for="scheduled-model-thread-base">Thread/Post Base Name</label>
                      <input id="scheduled-model-thread-base" placeholder="Day">
                    </div>
                    <div class="field" id="scheduled-model-forum-channel-id-field">
                      <label for="scheduled-model-forum-channel-id">Forum Channel</label>
                      <select id="scheduled-model-forum-channel-id">
                        <option value="">Choose forum channel below</option>
                      </select>
                    </div>
                    <div class="field" id="scheduled-model-forum-channel-name-field">
                      <label for="scheduled-model-forum-channel-name">Forum Channel Name</label>
                      <input id="scheduled-model-forum-channel-name" placeholder="textures">
                    </div>
                    <div class="field">
                      <label for="scheduled-model-destination-extra">Extra Message In Destination</label>
                  <textarea id="scheduled-model-destination-extra" placeholder="Optional extra text appended to the destination model post.">${input.model3dDestinationExtraText}</textarea>
                    </div>
                    <div class="field">
                      <label for="scheduled-model-initial-extra">Extra Message In Initial Channel Post</label>
                  <textarea id="scheduled-model-initial-extra" placeholder="Optional extra text for the initial selected-channel post.">${input.model3dInitialThreadExtraText}</textarea>
                    </div>
                    <div class="field" id="scheduled-model-model-upload-target-field">
                      <label for="scheduled-model-model-upload-target">Model Upload Location</label>
                      <select id="scheduled-model-model-upload-target">
                        <option value="selected">Upload in selected channel message</option>
                        <option value="target">Upload in target thread/forum post</option>
                      </select>
                      <div class="hint">The other message uses a link to this uploaded model instead of uploading again.</div>
                    </div>
                    <div class="toggle" id="scheduled-model-embed-in-initial-toggle">
                      <span>Include metadata embed in initial selected-channel post</span>
                      <input id="scheduled-model-embed-in-initial" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Include model file (.glb/.gltf)</span>
                      <input id="scheduled-model-include-model" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Include preview image/GIF</span>
                      <input id="scheduled-model-include-preview" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Include source image</span>
                      <input id="scheduled-model-include-source-image" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Include metadata embed</span>
                      <input id="scheduled-model-include-embed" type="checkbox" checked>
                    </div>
                    <div class="toggle">
                      <span>Include action buttons</span>
                      <input id="scheduled-model-include-buttons" type="checkbox" checked>
                    </div>
                    <div class="toggle" id="scheduled-model-upload-textures-toggle">
                      <span>Upload texture messages (Multi View / UV / Normal)</span>
                      <input id="scheduled-model-upload-textures" type="checkbox">
                    </div>
                    <div class="field" id="scheduled-model-texture-upload-target-field">
                      <label for="scheduled-model-texture-upload-target">Texture Upload Location</label>
                      <select id="scheduled-model-texture-upload-target">
                        <option value="target">Target channel/thread/post</option>
                        <option value="selected">Selected channel</option>
                      </select>
                    </div>
                    <div class="toggle" id="scheduled-model-upload-multiview-toggle">
                      <span>Include Multi View texture message</span>
                      <input id="scheduled-model-upload-multiview" type="checkbox" checked>
                    </div>
                    <div class="toggle" id="scheduled-model-upload-uv-toggle">
                      <span>Include UV texture message</span>
                      <input id="scheduled-model-upload-uv" type="checkbox" checked>
                    </div>
                    <div class="toggle" id="scheduled-model-upload-normal-toggle">
                      <span>Include Normal texture message</span>
                      <input id="scheduled-model-upload-normal" type="checkbox" checked>
                    </div>
                    <div class="toggle" id="scheduled-model-generate-lowpoly-toggle">
                      <span>Generate Low Poly follow-up version</span>
                      <input id="scheduled-model-generate-lowpoly" type="checkbox">
                    </div>
                    <div class="toggle" id="scheduled-model-lowpoly-use-llm-target-faces-toggle">
                      <span>Let LLM decide low poly target faces by object complexity</span>
                      <input id="scheduled-model-lowpoly-use-llm-target-faces" type="checkbox">
                    </div>
                    <div class="field" id="scheduled-model-lowpoly-llm-decision-source-field">
                      <label for="scheduled-model-lowpoly-llm-decision-source">Low Poly LLM Decision Source</label>
                      <select id="scheduled-model-lowpoly-llm-decision-source">
                        <option value="input-image">Input image</option>
                        <option value="model-render">Generated 3D model render</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="scheduled-model-lowpoly-target-face-preset">Low Poly Target Preset</label>
                      <select id="scheduled-model-lowpoly-target-face-preset">
                        <option value="500">Tiny (500 faces)</option>
                        <option value="1000">Small (1000 faces)</option>
                        <option value="1500" selected>Medium (1500 faces)</option>
                        <option value="3000">Large (3000 faces)</option>
                        <option value="5000">Huge (5000 faces)</option>
                        <option value="custom">Custom (use value below)</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="scheduled-model-lowpoly-target-face-count">Low Poly Target Faces</label>
                      <input id="scheduled-model-lowpoly-target-face-count" type="number" min="1" step="1" value="1500">
                    </div>
                    <div class="field" id="scheduled-model-lowpoly-forum-channel-id-field">
                      <label for="scheduled-model-lowpoly-forum-channel-id">Low Poly Forum Channel</label>
                      <select id="scheduled-model-lowpoly-forum-channel-id">
                        <option value="">Post lowpoly in same destination</option>
                      </select>
                      <div class="hint">Optional override. If set, lowpoly follow-up is posted in this forum channel as its own forum post.</div>
                    </div>
                  </div>
                </div>
              </details>

              <div class="row automation-toolbar automation-save-row">
                <button id="save-scheduled-button">Save Scheduled Job</button>
                <button class="secondary" id="delete-scheduled-button">Delete Selected</button>
              </div>

              <details class="fold-card" id="automation-text-generator-fold">
                <summary>Generate Or Extend Text Files</summary>
                <div class="fold-content">
                  <div class="field">
                    <label for="automation-text-file-name">File Name</label>
                    <input id="automation-text-file-name" placeholder="jokes.txt or questions.txt">
                  </div>
                  <div class="compact-grid two-col">
                    <div class="field">
                      <label for="automation-text-mode">Save Mode</label>
                      <select id="automation-text-mode">
                        <option value="append">Append To File</option>
                        <option value="replace">Replace File</option>
                      </select>
                    </div>
                    <div class="field">
                      <label for="automation-text-quick-type">Quick Prompt</label>
                      <select id="automation-text-quick-type">
                        <option value="jokes">Jokes</option>
                        <option value="questions">Questions</option>
                        <option value="tips">Tips</option>
                        <option value="icebreakers">Icebreakers</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label for="automation-text-prompt">Rod Prompt</label>
                    <textarea id="automation-text-prompt" placeholder="Generate 25 short clean jokes, one per line, for a Discord community. Return only the lines."></textarea>
                  </div>
                  <div class="row">
                    <button id="generate-automation-text-button">Generate And Save</button>
                  </div>
                  <div class="output simulation-output" id="automation-text-output">No text-source generation run yet.</div>
                </div>
              </details>
            </article>
          </div>
        </div>
`;
}
