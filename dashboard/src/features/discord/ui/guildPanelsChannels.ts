export function renderDashboardGuildChannelsPanels(): string {
  return `
          <article class="panel-card guild-card" id="channel-settings-card" data-subview-panel="guild-channels">
            <h3>Channel Settings</h3>
            <div class="hint">Edit real Discord text-channel settings here, or use the quick guild actions in the second tab.</div>
            <div class="chip" id="channel-settings-chip">No text channel selected</div>
            <div class="dashboard-tabs">
              <button class="ghost active" id="channel-settings-tab-discord" data-channel-settings-tab="discord">Discord Settings</button>
              <button class="ghost" id="channel-settings-tab-quick" data-channel-settings-tab="quick">Quick Actions</button>
            </div>
            <div id="channel-settings-panel-discord">
              <div class="field">
                <label for="channel-settings-name">Name</label>
                <input id="channel-settings-name" placeholder="channel-name">
              </div>
              <div class="field">
                <label for="channel-settings-topic">Topic</label>
                <textarea id="channel-settings-topic" placeholder="Channel topic"></textarea>
              </div>
              <div class="field">
                <label for="channel-settings-category">Category</label>
                <select id="channel-settings-category"></select>
              </div>
              <div class="toggle">
                <span>NSFW</span>
                <input id="channel-settings-nsfw" type="checkbox">
              </div>
              <div class="field">
                <label for="channel-settings-slowmode">Slowmode Seconds</label>
                <input id="channel-settings-slowmode" type="number" min="0" step="1">
              </div>
              <div class="field">
                <label for="channel-settings-auto-archive">Default Auto Archive</label>
                <select id="channel-settings-auto-archive">
                  <option value="60">1 hour</option>
                  <option value="1440">24 hours</option>
                  <option value="4320">3 days</option>
                  <option value="10080">7 days</option>
                </select>
              </div>
              <div class="hint" id="channel-settings-edit-hint">Select a text channel to load Discord settings.</div>
              <button id="save-channel-settings-button">Save Discord Channel Settings</button>
            </div>
            <div id="channel-settings-panel-quick" class="hidden">
              <div class="row" style="margin-top: 14px;">
                <button id="channel-set-welcome-button">Use As Welcome Channel</button>
                <button class="secondary" id="channel-set-image-scan-button">Add As Image Scan Channel</button>
              </div>
              <div class="row">
                <button class="secondary" id="channel-clear-image-scan-button">Clear Image Scan Channels</button>
              </div>
            </div>
          </article>

          <article class="panel-card guild-card" data-subview-panel="guild-channels">
            <h3>Channel Builder</h3>
            <div class="hint">Create categories, text channels, announcement channels, or voice channels for the selected guild.</div>
            <div class="field">
              <label for="create-channel-name">Name</label>
              <input id="create-channel-name" placeholder="new-channel">
            </div>
            <div class="field">
              <label for="create-channel-type">Type</label>
              <select id="create-channel-type">
                <option value="text">Text Channel</option>
                <option value="announcement">Announcement Channel</option>
                <option value="voice">Voice Channel</option>
                <option value="category">Category</option>
              </select>
            </div>
            <div class="field">
              <label for="create-channel-topic">Topic</label>
              <textarea id="create-channel-topic" placeholder="Optional topic for text or announcement channels."></textarea>
            </div>
            <div class="field">
              <label for="create-channel-parent-category">Parent Category</label>
              <select id="create-channel-parent-category"></select>
            </div>
            <button id="create-channel-button">Create Channel</button>
          </article>

          <article class="panel-card guild-card" data-subview-panel="guild-channels">
            <h3>Thread And Post Tools</h3>
            <div class="hint">Use the selected text or announcement channel for thread starters and manual post creation.</div>
            <div class="field">
              <label for="create-thread-name">Thread Name</label>
              <input id="create-thread-name" placeholder="follow-up-thread">
            </div>
            <div class="field">
              <label for="create-thread-message">Thread Starter Message</label>
              <textarea id="create-thread-message" placeholder="Write the starter message that will become the root post for the new thread."></textarea>
            </div>
            <div class="field">
              <label for="create-thread-auto-archive">Thread Auto Archive</label>
              <select id="create-thread-auto-archive">
                <option value="60">1 hour</option>
                <option value="1440">24 hours</option>
                <option value="4320">3 days</option>
                <option value="10080">7 days</option>
              </select>
            </div>
            <button id="create-thread-button">Create Thread</button>
            <div class="field">
              <label for="create-post-title">Post Title</label>
              <input id="create-post-title" placeholder="Optional title">
            </div>
            <div class="field">
              <label for="create-post-content">Post Content</label>
              <textarea id="create-post-content" placeholder="Write the post to send into the selected channel."></textarea>
            </div>
            <button class="secondary" id="create-post-button">Create Post</button>
          </article>
`;
}
