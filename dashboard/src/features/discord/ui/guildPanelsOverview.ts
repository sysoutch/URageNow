export function renderDashboardGuildOverviewPanels(): string {
  return `
          <article class="panel-card guild-card" data-subview-panel="guild-overview">
            <h3>Welcome Message</h3>
            <div class="hint">Templates: {user}, {username}, {server}</div>
            <div class="toggle" style="margin-top: 14px;">
              <span>Welcome enabled</span>
              <input id="welcome-enabled" type="checkbox">
            </div>
            <div class="field">
              <label for="welcome-message">Template</label>
              <textarea id="welcome-message"></textarea>
            </div>
            <button id="save-welcome-button">Save Welcome Settings</button>
          </article>

          <article class="panel-card guild-card" data-subview-panel="guild-overview">
            <h3>Role Actions</h3>
            <div class="hint">Uses the selected user from the sidebar and the role chosen here.</div>
            <div class="field" style="margin-top: 14px;">
              <label for="role-select">Role</label>
              <select id="role-select"></select>
            </div>
            <div class="row" style="margin-top: 14px;">
              <button id="assign-role-button">Assign Role</button>
              <button class="secondary" id="remove-role-button">Remove Role</button>
            </div>
          </article>

          <article class="panel-card guild-card" data-subview-panel="guild-overview">
            <h3>Member Counter</h3>
            <div class="hint">Keep a text or voice channel renamed live with the current member count. Use <code>{count}</code> in the template.</div>
            <div class="field">
              <label for="member-counter-channel-select">Counter Channel</label>
              <select id="member-counter-channel-select"></select>
            </div>
            <div class="chip" id="member-counter-channel-chip">Disabled</div>
            <div class="field">
              <label for="member-counter-template">Counter Template</label>
              <input id="member-counter-template" placeholder="Members: {count}">
            </div>
            <div class="row">
              <button id="save-member-counter-button">Save Member Counter</button>
              <button class="secondary" id="refresh-member-counter-button">Refresh Counter</button>
              <button class="secondary" id="clear-member-counter-button">Disable Counter</button>
            </div>
          </article>
`;
}
