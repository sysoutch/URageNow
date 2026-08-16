export function renderDashboardMessengerDashboardView(): string {
  return `
      <section class="view messenger-dashboard-view" data-view-panel="dashboard">
        <div class="messenger-dashboard-shell">
          <article class="panel-card messenger-dashboard-header-card">
            <div class="messenger-dashboard-head">
              <div class="messenger-dashboard-identity">
                <span class="messenger-dashboard-icon" id="messenger-dashboard-icon-badge">D</span>
                <div class="messenger-dashboard-copy">
                  <h3 id="messenger-dashboard-title">Discord</h3>
                  <div class="panel-subtitle" id="messenger-dashboard-subtitle">Connect, manage, and interact with your Discord bot and server.</div>
                </div>
                <span class="messenger-dashboard-enabled" id="messenger-dashboard-enabled-pill">Enabled</span>
              </div>
              <div class="row messenger-dashboard-head-actions">
                <button class="secondary" id="messenger-dashboard-quick-runtime-button" type="button">Start Messenger</button>
                <button class="secondary" id="messenger-dashboard-runtime-button" type="button">Runtime Control</button>
                <button class="secondary" id="messenger-dashboard-open-browser-button" type="button">Open in Browser</button>
                <button id="messenger-dashboard-send-message-button" type="button">Send Message</button>
              </div>
            </div>
            <div class="messenger-dashboard-fetch-controls" data-discord-only="true">
              <div class="messenger-dashboard-fetch-buttons">
                <button class="secondary" id="messenger-dashboard-refresh-guilds-button" type="button">Refresh Guilds</button>
                <button class="secondary" id="messenger-dashboard-load-channels-button" type="button">Load Cached Channels</button>
                <button class="secondary" id="messenger-dashboard-load-messages-button" type="button">Load Cached Messages</button>
              </div>
              <div class="panel-subtitle" id="messenger-dashboard-fetch-status">Guilds auto-load. Other data stays manual.</div>
            </div>
            <div class="dashboard-tabs">
              <button class="ghost active" data-view="dashboard" type="button">Overview</button>
              <button class="ghost" data-view="messaging" data-discord-only="true" type="button">Messages</button>
              <button class="ghost" data-view="messenger" data-non-discord-only="true" type="button">Messages</button>
              <button class="ghost" data-view="guild" data-discord-only="true" type="button">Members</button>
              <button class="ghost" data-view="automation" type="button">Automation</button>
              <button class="ghost" data-view="activity" type="button">Activity</button>
            </div>
          </article>

          <div class="messenger-dashboard-stat-grid">
            <article class="panel-card messenger-dashboard-stat-card">
              <div class="panel-kicker">Bot Status</div>
              <div class="messenger-dashboard-runtime-state" id="messenger-dashboard-runtime-state">Offline</div>
              <div class="panel-subtitle" id="messenger-dashboard-runtime-meta">Uptime: --</div>
            </article>
            <article class="panel-card messenger-dashboard-stat-card">
              <div class="panel-kicker" id="messenger-dashboard-space-label">Guild</div>
              <div class="messenger-dashboard-stat-value" id="messenger-dashboard-space-count">0</div>
              <div class="panel-subtitle" id="messenger-dashboard-space-subtitle">No server selected</div>
            </article>
            <article class="panel-card messenger-dashboard-stat-card">
              <div class="panel-kicker" id="messenger-dashboard-member-label">Members</div>
              <div class="messenger-dashboard-stat-value" id="messenger-dashboard-member-count">0</div>
              <div class="panel-subtitle" id="messenger-dashboard-member-subtitle">No member cache yet</div>
            </article>
            <article class="panel-card messenger-dashboard-stat-card">
              <div class="panel-kicker" id="messenger-dashboard-channel-label">Channels</div>
              <div class="messenger-dashboard-stat-value" id="messenger-dashboard-channel-count">0</div>
              <div class="panel-subtitle" id="messenger-dashboard-channel-subtitle">Text: 0 | Voice: 0</div>
            </article>
            <article class="panel-card messenger-dashboard-stat-card">
              <div class="panel-kicker">Messages (24h)</div>
              <div class="messenger-dashboard-stat-value" id="messenger-dashboard-message-count">0</div>
              <div class="panel-subtitle" id="messenger-dashboard-message-subtitle">No activity yet</div>
            </article>
          </div>

          <div class="messenger-dashboard-main-grid">
            <article class="panel-card messenger-dashboard-feed-card">
              <h3 id="messenger-dashboard-recent-title">Recent Messages</h3>
              <div class="messenger-dashboard-message-list" id="messenger-dashboard-recent-list"></div>
            </article>
            <article class="panel-card messenger-dashboard-activity-card">
              <div class="messenger-dashboard-card-head">
                <h3>Activity (24h)</h3>
                <span class="chip" id="messenger-dashboard-activity-label">Messages</span>
              </div>
              <div class="messenger-dashboard-activity-bars" id="messenger-dashboard-activity-bars"></div>
            </article>
            <article class="panel-card messenger-dashboard-commands-card">
              <div class="messenger-dashboard-card-head">
                <h3 id="messenger-dashboard-command-title">Top Commands (24h)</h3>
                <span class="chip">All</span>
              </div>
              <div class="messenger-dashboard-command-list" id="messenger-dashboard-command-list"></div>
            </article>
          </div>

          <div class="messenger-dashboard-detail-grid">
            <article class="panel-card messenger-dashboard-detail-card">
              <h3>Bot Info</h3>
              <div class="messenger-dashboard-detail-list">
                <div class="messenger-dashboard-detail-row"><span>Bot Name</span><strong id="messenger-dashboard-bot-name">URage Bot</strong></div>
                <div class="messenger-dashboard-detail-row"><span>Bot ID</span><strong id="messenger-dashboard-bot-id">Unknown</strong></div>
                <div class="messenger-dashboard-detail-row"><span>Connected Since</span><strong id="messenger-dashboard-connected-since">Unknown</strong></div>
                <div class="messenger-dashboard-detail-row"><span>Permissions</span><strong id="messenger-dashboard-permissions">Configured</strong></div>
              </div>
              <div class="row">
                <button class="secondary" id="messenger-dashboard-view-bot-button" type="button">Open Bot View</button>
              </div>
            </article>
            <article class="panel-card messenger-dashboard-detail-card">
              <h3 id="messenger-dashboard-space-title">Server Info</h3>
              <div class="messenger-dashboard-detail-list">
                <div class="messenger-dashboard-detail-row"><span id="messenger-dashboard-server-name-label">Guild Name</span><strong id="messenger-dashboard-server-name">None</strong></div>
                <div class="messenger-dashboard-detail-row"><span id="messenger-dashboard-server-id-label">Guild ID</span><strong id="messenger-dashboard-server-id">None</strong></div>
                <div class="messenger-dashboard-detail-row"><span>Region</span><strong id="messenger-dashboard-server-region">Local</strong></div>
                <div class="messenger-dashboard-detail-row"><span id="messenger-dashboard-server-members-label">Members</span><strong id="messenger-dashboard-server-members">0</strong></div>
              </div>
              <div class="row">
                <button class="secondary" id="messenger-dashboard-view-server-button" type="button">Open Server View</button>
              </div>
            </article>
          </div>
        </div>
      </section>`;
}
