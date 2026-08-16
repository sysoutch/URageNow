export function renderDashboardProfileView(port: number): string {
  return `
      <section class="view" data-view-panel="profile">
        <div class="content-grid profile-grid">
          <article class="panel-card hero-profile-card">
            <div class="profile-hero">
              <div class="profile-avatar-shell">
                <img class="profile-avatar hidden" id="profile-bot-avatar-image" alt="Bot avatar">
                <div class="profile-avatar-fallback" id="profile-bot-avatar-fallback">DR</div>
              </div>
              <div class="profile-hero-copy">
                <div class="stage-kicker">Bot Profile</div>
                <h3 id="profile-bot-tag">Discrod Bot</h3>
                <div class="panel-subtitle" id="profile-bot-id">No bot ID yet.</div>
              </div>
            </div>
          </article>

          <article class="panel-card">
            <h3>Runtime</h3>
            <div class="detail-list">
              <div class="detail-line">
                <span>Guilds</span>
                <strong id="profile-guild-count">0</strong>
              </div>
              <div class="detail-line">
                <span>Started</span>
                <strong id="profile-started-at">Unknown</strong>
              </div>
              <div class="detail-line">
                <span>Dashboard Port</span>
                <strong id="profile-dashboard-port">${port}</strong>
              </div>
              <div class="detail-line">
                <span>Confirmation</span>
                <strong id="profile-confirmation">On</strong>
              </div>
              <div class="detail-line">
                <span>Strip Metadata (WebUI)</span>
                <strong id="profile-strip-webui">On</strong>
              </div>
              <div class="detail-line">
                <span>Strip Metadata (Discord)</span>
                <strong id="profile-strip-discord">On</strong>
              </div>
            </div>
          </article>

          <article class="panel-card">
            <h3>Rod Models</h3>
            <div class="detail-list">
              <div class="detail-line">
                <span>Text</span>
                <strong id="profile-text-model">Unset</strong>
              </div>
              <div class="detail-line">
                <span>Vision</span>
                <strong id="profile-vision-model">Unset</strong>
              </div>
            </div>
          </article>

          <article class="panel-card profile-note-card">
            <h3>Control Notes</h3>
            <div class="panel-subtitle">
              Use this spot for the bot identity and runtime overview. Guild tools stay in Guild and Moderation, while LazyDev lives in AI.
            </div>
          </article>

          <article class="panel-card">
            <h3>Global Slash Commands</h3>
            <div class="panel-subtitle">These are registered globally for the app. Global Discord command updates can take a bit longer to appear than guild-only syncs.</div>
            <div class="row">
              <button id="save-global-command-settings-button">Save Global Commands</button>
              <button class="secondary" id="sync-global-commands-button">Sync Global</button>
            </div>
            <div class="list medium-list command-toggle-list" id="global-command-list"></div>
          </article>
        </div>
      </section>
`;
}
