export function renderDashboardDetailsPane(): string {
  return `
    <aside class="details-pane side-panel side-panel-right" data-discord-only="true">
      <header class="detail-pane-header">
        <div class="detail-pane-copy">
          <div class="section-label">Channel Inspector</div>
          <h3>Selected Channel</h3>
          <div class="panel-subtitle">Keep the active channel context and user lookup close while you work.</div>
        </div>
        <button class="ghost compact pane-collapse-button" type="button" data-shell-toggle="details" title="Toggle inspector" aria-label="Toggle inspector">
          <span class="pane-collapse-icon" aria-hidden="true">&#10095;</span>
        </button>
      </header>
      <div class="detail-panel" id="detail-panel-current">
        <section class="detail-card studio-right-sidebar hidden" data-studio-right-sidebar="discord">
          <div class="section-label">Studio Sidebar</div>
          <div class="studio-right-sidebar-stack" id="studio-right-sidebar-host-discord" data-studio-right-sidebar-host="discord"></div>
          <div class="panel-subtitle studio-right-sidebar-empty">Select a studio workflow to show tool panels here.</div>
        </section>
        <div class="detail-panel-default" data-detail-panel-default="discord">
        <section class="detail-card hidden" data-studio-workflow-detail="true">
          <div class="section-label">Studio Workflow</div>
          <div class="detail-list">
            <div class="detail-line">
              <span>Active</span>
              <strong class="detail-studio-workflow-name">None</strong>
            </div>
          </div>
          <div class="panel-subtitle detail-studio-workflow-summary">Select a Studio workflow to open compact inspector details here.</div>
          <div class="row dense-row">
            <button class="secondary" data-view="ai">Back To Overview</button>
            <button class="secondary" data-ai-scroll-target="ask-rod-card" type="button">Open Ask LazyDev</button>
          </div>
        </section>

        <section class="detail-card detail-hero-card">
          <div class="detail-hero-mark">#</div>
          <div class="detail-hero-copy">
            <div class="section-label">Current Channel</div>
            <h3 id="detail-channel-name">None</h3>
            <div class="panel-subtitle" id="detail-channel-hint">Pick a text channel to see more details.</div>
          </div>
        </section>

        <section class="detail-card">
          <div class="section-label">Channel Facts</div>
          <div class="detail-list">
            <div class="detail-line">
              <span>Category</span>
              <strong id="detail-channel-parent">None</strong>
            </div>
            <div class="detail-line">
              <span>Type</span>
              <strong id="detail-channel-kind">None</strong>
            </div>
            <div class="detail-line">
              <span>Messaging</span>
              <strong id="detail-channel-send-state">Unavailable</strong>
            </div>
            <div class="detail-line">
              <span>Focus Flags</span>
              <strong id="detail-channel-flags">None</strong>
            </div>
            <div class="detail-line">
              <span>Channel ID</span>
              <strong id="detail-channel-id">None</strong>
            </div>
          </div>
        </section>

        <section class="detail-card">
          <div class="section-label">Quick Actions</div>
          <div class="row dense-row">
            <button id="detail-open-messaging-button">Open Messaging</button>
            <button class="secondary" id="detail-open-channel-settings-button">Open Channel Tools</button>
          </div>
          <div class="row dense-row">
            <button class="secondary" id="detail-refresh-bot-messages-button">Refresh Bot Messages</button>
          </div>
        </section>

        <section class="detail-card">
          <div class="section-label">Selected User</div>
          <div class="detail-list">
            <div class="detail-line">
              <span>User</span>
              <strong id="detail-user-name">None</strong>
            </div>
            <div class="detail-line">
              <span>User Tag</span>
              <strong id="detail-user-tag">None</strong>
            </div>
          </div>
        </section>

        <section class="detail-card">
          <div class="section-label">Users In Channel</div>
          <div class="panel-subtitle" id="detail-channel-members-summary">No channel member details loaded.</div>
          <div class="list compact-list detail-list" id="detail-channel-members"></div>
        </section>

        <section class="detail-card detail-grow user-browser-card">
          <div class="section-label">Cached Users</div>
          <div class="field compact-field">
            <input id="user-search" placeholder="Search cached users or paste a user ID">
          </div>
          <div class="row dense-row">
            <button id="search-users-button">Search Cache</button>
            <button class="secondary" id="fetch-users-button">Fetch From Discord</button>
          </div>
          <div class="panel-subtitle" id="user-results-summary">No users loaded yet.</div>
          <div class="list compact-list detail-list" id="user-results"></div>
        </section>
        </div>
      </div>
    </aside>
    <aside class="details-pane side-panel side-panel-right" data-non-discord-only="true">
      <header class="detail-pane-header">
        <div class="detail-pane-copy">
          <div class="section-label">Messenger Inspector</div>
          <h3 id="detail-messenger-active">Telegram</h3>
          <div class="panel-subtitle" id="detail-messenger-hint">Messenger-side details and runtime state are visible here.</div>
        </div>
        <button class="ghost compact pane-collapse-button" type="button" data-shell-toggle="details" title="Toggle inspector" aria-label="Toggle inspector">
          <span class="pane-collapse-icon" aria-hidden="true">&#10095;</span>
        </button>
      </header>
      <div class="detail-panel" id="detail-panel-messenger">
        <section class="detail-card studio-right-sidebar hidden" data-studio-right-sidebar="messenger">
          <div class="section-label">Studio Sidebar</div>
          <div class="studio-right-sidebar-stack" id="studio-right-sidebar-host-messenger" data-studio-right-sidebar-host="messenger"></div>
          <div class="panel-subtitle studio-right-sidebar-empty">Select a studio workflow to show tool panels here.</div>
        </section>
        <div class="detail-panel-default" data-detail-panel-default="messenger">
        <section class="detail-card hidden" data-studio-workflow-detail="true">
          <div class="section-label">Studio Workflow</div>
          <div class="detail-list">
            <div class="detail-line">
              <span>Active</span>
              <strong class="detail-studio-workflow-name">None</strong>
            </div>
          </div>
          <div class="panel-subtitle detail-studio-workflow-summary">Select a Studio workflow to open compact inspector details here.</div>
          <div class="row dense-row">
            <button class="secondary" data-view="ai">Back To Overview</button>
            <button class="secondary" data-ai-scroll-target="ask-rod-card" type="button">Open Ask LazyDev</button>
          </div>
        </section>

        <section class="detail-card detail-hero-card">
          <div class="detail-hero-mark">&#128172;</div>
          <div class="detail-hero-copy">
            <div class="section-label">Active Messenger</div>
            <h3 id="detail-messenger-name">Telegram</h3>
            <div class="panel-subtitle" id="detail-messenger-subtitle">Use this pane to track runtime + selected chat context.</div>
          </div>
        </section>

        <section class="detail-card">
          <div class="section-label">Runtime Facts</div>
          <div class="detail-list">
            <div class="detail-line">
              <span>Status</span>
              <strong id="detail-messenger-runtime-state">STOPPED</strong>
            </div>
            <div class="detail-line">
              <span>Meta</span>
              <strong id="detail-messenger-runtime-meta">No runtime data yet.</strong>
            </div>
            <div class="detail-line">
              <span>Selected Chat</span>
              <strong id="detail-messenger-chat">None</strong>
            </div>
          </div>
        </section>

        <section class="detail-card">
          <div class="section-label">Quick Actions</div>
          <div class="row dense-row">
            <button data-view="messenger">Open Messenger View</button>
            <button class="secondary" id="detail-messenger-refresh-button">Refresh Messenger Data</button>
          </div>
          <div class="row dense-row">
            <button class="secondary" data-view="activity">Open Activity</button>
            <button class="secondary" data-view="ai">Open LazyDev</button>
          </div>
        </section>
        </div>
      </div>
    </aside>
`;
}
