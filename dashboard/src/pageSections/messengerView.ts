export function renderDashboardMessengerView(): string {
  return `
      <section class="view" data-view-panel="messenger" data-non-discord-only="true">
        <div class="chat-workspace messenger-chat-workspace">
          <article class="panel-card feature-card chat-header-card">
            <div class="chat-header-topline">
              <div class="chat-header-copy">
                <div class="panel-kicker">Messenger Workspace</div>
                <h3 id="messenger-active-chip">Telegram</h3>
                <div class="panel-subtitle" id="messenger-chat-hint">Select Telegram for chat lists, WhatsApp for phone messaging, or Matrix for runtime room controls.</div>
              </div>
              <div class="chat-header-actions">
                <button class="secondary chat-new-button" id="messenger-new-chat-button">New Chat</button>
              </div>
            </div>
          </article>

          <article class="panel-card tool-card chat-feed-card" data-messenger-panel="telegram">
            <div class="chat-header-topline messenger-specific-chat-head">
              <div>
                <h3>Telegram Chats</h3>
                <div class="chip" id="telegram-selected-chat-chip">No Telegram chat selected</div>
              </div>
              <button class="secondary" id="telegram-refresh-chats-button" type="button">Refresh Chats</button>
            </div>
            <div class="list channel-browser messenger-specific-chat-list" id="telegram-chat-list"></div>
          </article>

          <article class="panel-card tool-card chat-composer-card" data-messenger-panel="telegram">
            <div class="chat-composer-grid">
              <div class="field">
                <label for="telegram-chat-id-input">Chat ID</label>
                <input id="telegram-chat-id-input" type="text" placeholder="Telegram chat ID">
              </div>
              <button id="telegram-send-message-button">Send</button>
            </div>
            <div class="field">
              <label for="telegram-message-text">Message</label>
              <textarea id="telegram-message-text" placeholder="Message selected Telegram chat"></textarea>
            </div>
          </article>

          <article class="panel-card tool-card chat-feed-card" data-messenger-panel="matrix">
            <div class="chat-header-topline messenger-specific-chat-head">
              <div>
                <h3>Matrix Rooms</h3>
                <div class="chip" id="matrix-selected-room-chip">No Matrix room selected</div>
              </div>
              <button class="secondary" id="matrix-refresh-rooms-button" type="button">Refresh Rooms</button>
            </div>
            <div class="row dense-row messenger-specific-chat-head">
              <span class="chip" id="matrix-runtime-health-chip">Runtime status unknown</span>
              <button class="secondary" id="matrix-refresh-activity-button" type="button">Refresh Activity</button>
            </div>
            <div class="list compact-list messenger-specific-chat-list" id="matrix-activity-list" aria-live="polite"></div>
          </article>

          <article class="panel-card tool-card chat-composer-card" data-messenger-panel="matrix">
            <div class="chat-composer-grid">
              <div class="field">
                <label for="matrix-room-id-input">Room ID</label>
                <input id="matrix-room-id-input" type="text" placeholder="!room:example.com">
              </div>
              <button id="matrix-send-message-button" type="button">Send</button>
            </div>
            <div class="field">
              <label for="matrix-message-text">Message</label>
              <textarea id="matrix-message-text" placeholder="Message selected Matrix room"></textarea>
            </div>
          </article>

          <article class="panel-card tool-card chat-composer-card" data-messenger-panel="matrix">
            <div class="chat-header-topline messenger-specific-chat-head">
              <div>
                <h3>Room workflow permissions</h3>
                <div class="panel-subtitle">Enabled rooms allow every member to run only the selected workflows. Rooms without a rule use the legacy allowlist.</div>
              </div>
              <button class="secondary" id="matrix-load-workflow-permissions-button" type="button">Load</button>
            </div>
            <div class="field">
              <label for="matrix-workflow-room-id">Room ID</label>
              <input id="matrix-workflow-room-id" type="text" placeholder="!room:example.com">
            </div>
            <div class="row dense-row" id="matrix-workflow-permission-actions">
              <label><input type="checkbox" value="chat"> Ask</label>
              <label><input type="checkbox" value="image"> Image</label>
              <label><input type="checkbox" value="audio"> Audio</label>
              <label><input type="checkbox" value="music"> Music</label>
              <label><input type="checkbox" value="video"> Video</label>
              <label><input type="checkbox" value="model3d"> 3D</label>
            </div>
            <label class="row dense-row"><input id="matrix-workflow-allow-all-members" type="checkbox"> Allow every member of this room to use the selected workflows</label>
            <div class="row dense-row">
              <button id="matrix-save-workflow-permissions-button" type="button">Save permissions</button>
              <span class="chip" id="matrix-workflow-permission-summary">Select a room to configure.</span>
            </div>
          </article>

          <article class="panel-card tool-card chat-composer-card" data-messenger-panel="whatsapp">
            <div class="chat-composer-grid">
              <div class="field">
                <label for="whatsapp-to-input">Recipient (E.164)</label>
                <input id="whatsapp-to-input" type="text" placeholder="+15551234567">
              </div>
              <button id="whatsapp-send-message-button">Send</button>
            </div>
            <div class="field">
              <label for="whatsapp-message-text">Message</label>
              <textarea id="whatsapp-message-text" placeholder="Message WhatsApp recipient"></textarea>
            </div>
          </article>
        </div>
      </section>`;
}
