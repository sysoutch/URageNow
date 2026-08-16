export function renderDashboardMessagingView(): string {
  return `
      <section class="view" data-view-panel="messaging" data-discord-only="true">
        <div class="chat-workspace chat-workspace-discord">
          <article class="panel-card feature-card chat-header-card">
            <div class="chat-header-topline">
              <div class="chat-header-copy">
                <div class="chat-channel-title" id="messaging-selected-channel-chip"># no-channel-selected</div>
                <div class="chat-channel-subtitle" id="bot-message-time-chip">Pick a recent bot message to edit</div>
              </div>
              <div class="chat-header-actions">
                <button class="secondary chat-new-button" id="messaging-new-chat-button">New Chat</button>
                <button class="secondary" id="refresh-bot-messages-button">Refresh</button>
              </div>
            </div>
            <div class="chat-chip-row">
              <div class="chip messaging-chip" id="messaging-selected-user-chip">No user selected</div>
              <div class="chip messaging-chip" id="bot-message-id-chip">No bot message selected</div>
            </div>
            <div class="hint" id="bot-messages-refresh-status">Bot messages not loaded yet.</div>
          </article>

          <article class="panel-card tool-card chat-feed-card">
            <div class="chat-feed" id="bot-message-list"></div>
            <div class="field chat-preview-field">
              <label for="bot-message-preview">Assistant Preview</label>
              <div class="output markdown-render-box chat-preview-output" id="bot-message-preview">Select a recent bot message to preview it here.</div>
            </div>
          </article>

          <article class="panel-card tool-card dm-conversation-card">
            <div class="chat-header-topline">
              <div>
                <div class="panel-kicker">Direct Message</div>
                <h3>Conversation</h3>
              </div>
              <button class="secondary" id="refresh-dm-conversation-button" type="button">Refresh DM</button>
            </div>
            <div class="hint" id="dm-conversation-status">Select a direct-message user from the rail.</div>
            <div class="dm-conversation-list" id="dm-conversation-list" aria-live="polite"></div>
          </article>

          <article class="panel-card tool-card chat-composer-card">
            <div class="chat-composer-grid">
              <div class="field">
                <label for="channel-message">Message</label>
                <textarea id="channel-message" placeholder="Message #selected-channel"></textarea>
              </div>
              <button id="send-channel-button">Send</button>
            </div>
            <div class="row chat-action-row">
              <button class="secondary" id="post-gift-button">Gift</button>
              <button class="secondary" id="post-humble-button">Humble</button>
              <button class="secondary" id="ask-to-channel-button">Ask LazyDev</button>
              <button class="secondary" id="confirm-latest-button">Confirm Draft</button>
            </div>
            <div class="field">
              <label for="messaging-quick-preset-select">Quick Post Preset</label>
              <div class="row chat-action-row">
                <select id="messaging-quick-preset-select">
                  <option value="unity-publisher-gift" selected>Unity Publisher Gift</option>
                  <option value="humble-software">Humble Software Bundles</option>
                </select>
                <button class="secondary" id="run-messaging-quick-preset-button">Run Preset</button>
              </div>
              <div class="hint">Use a preset to run the matching automated promo post into the selected Discord channel.</div>
            </div>
            <div class="field">
              <label for="llm-prompt">Rod Prompt</label>
              <textarea id="llm-prompt" placeholder="Write prompt for LazyDev drafting."></textarea>
            </div>
            <div class="field">
              <label for="bot-message-edit-text">Edit Selected Bot Message</label>
              <textarea id="bot-message-edit-text" placeholder="Edit selected message text"></textarea>
            </div>
            <div class="row">
              <button id="save-bot-message-button">Save Edit</button>
            </div>
            <div class="field">
              <label for="dm-message">DM Message</label>
              <textarea id="dm-message" placeholder="DM selected user"></textarea>
            </div>
            <div class="row">
              <button class="secondary" id="send-dm-button">Send DM</button>
            </div>
            <div class="studio-toggle-grid chat-toggle-grid">
              <div class="toggle">
                <span>Require confirmation before send</span>
                <input id="require-confirmation" type="checkbox" checked>
              </div>
              <div class="toggle">
                <span>Strip metadata from images (WebUI)</span>
                <input id="strip-metadata-webui" type="checkbox" checked>
              </div>
              <div class="toggle">
                <span>Strip metadata from images (Discord)</span>
                <input id="strip-metadata-discord" type="checkbox" checked>
              </div>
            </div>
          </article>

          <article class="panel-card contrast-card chat-status-card">
            <div class="output messaging-output chat-status-output" id="main-output">Ready.</div>
          </article>
        </div>
      </section>`;
}
