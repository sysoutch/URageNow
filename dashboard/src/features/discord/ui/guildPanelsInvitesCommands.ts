export function renderDashboardGuildInvitesCommandsPanels(): string {
  return `
          <article class="panel-card guild-card" data-subview-panel="guild-invites">
            <h3>Server Access</h3>
            <div class="hint">Discrod still has to be authorized through Discord OAuth, so this opens or copies the proper invite link for the selected guild.</div>
            <div class="field">
              <label>Invite Link</label>
              <div class="output" id="invite-link-output">Select a guild to generate the invite link.</div>
            </div>
            <div class="row">
              <button id="open-invite-link-button">Open Invite Link</button>
              <button class="secondary" id="copy-invite-link-button">Copy Invite Link</button>
            </div>
          </article>

          <article class="panel-card guild-card" data-subview-panel="guild-commands">
            <h3>Server Slash Commands</h3>
            <div class="hint">Guild-only commands appear quickly. Disabling inherited global commands here is a safe runtime block, because Discord does not fully hide a global command per server.</div>
            <div class="row">
              <button id="save-guild-command-settings-button">Save Server Command Rules</button>
              <button class="secondary" id="sync-guild-commands-button">Sync This Server</button>
            </div>
            <div class="field">
              <label>Extra Server Commands</label>
              <div class="list medium-list command-toggle-list" id="guild-command-enable-list"></div>
            </div>
            <div class="field">
              <label>Disable Inherited Global Commands Here</label>
              <div class="list medium-list command-toggle-list" id="guild-command-disable-list"></div>
            </div>
          </article>

          <article class="panel-card guild-card" data-subview-panel="guild-invites">
            <h3>Server Invites</h3>
            <div class="hint">Create fresh Discord server invites, revoke old ones, or replace an invite with new channel/settings. Discord does not support true in-place invite editing, so replace will recreate it.</div>
            <div class="list medium-list" id="guild-invite-list"></div>
            <div class="field">
              <label for="invite-channel-select">Invite Channel</label>
              <select id="invite-channel-select"></select>
            </div>
            <div class="compact-grid two-col">
              <div class="field">
                <label for="invite-max-age">Max Age Seconds</label>
                <input id="invite-max-age" type="number" min="0" step="1" value="0">
              </div>
              <div class="field">
                <label for="invite-max-uses">Max Uses</label>
                <input id="invite-max-uses" type="number" min="0" step="1" value="0">
              </div>
            </div>
            <div class="compact-grid two-col toggles-grid">
              <label class="toggle compact-toggle">
                <span>Temporary</span>
                <input id="invite-temporary" type="checkbox">
              </label>
              <label class="toggle compact-toggle">
                <span>Unique</span>
                <input id="invite-unique" type="checkbox" checked>
              </label>
            </div>
            <div class="row">
              <button id="create-guild-invite-button">Create Invite</button>
              <button class="secondary" id="replace-guild-invite-button">Replace Selected Invite</button>
              <button class="secondary" id="delete-guild-invite-button">Delete Selected Invite</button>
            </div>
          </article>
`;
}
