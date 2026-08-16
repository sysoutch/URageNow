export function renderDashboardModerationView(): string {
  return `
      <section class="view" data-view-panel="moderation" data-discord-only="true">
        <article class="panel-card feature-card moderation-overview-card">
          <div class="panel-heading">
            <div class="panel-kicker">Safety Workspace</div>
            <h3>Moderation</h3>
            <div class="panel-subtitle">Tune anti-spam checks, test moderation behavior, and keep a tighter grip on automated enforcement flows.</div>
          </div>
        </article>
        <div class="tabs workspace-subtabs">
          <button class="ghost active" data-subview="moderation-rules">Rules</button>
          <button class="ghost" data-subview="moderation-simulator">Simulator</button>
          <button class="ghost" data-subview="moderation-log">Log</button>
        </div>
        <div class="content-grid two-up">
          <article class="panel-card" data-subview-panel="moderation-rules">
            <h3>Anti-Spam Rules</h3>
            <div class="toggle">
              <span>Feature enabled</span>
              <input id="anti-spam-enabled" type="checkbox" checked>
            </div>
            <div class="toggle">
              <span>Apply timeouts</span>
              <input id="anti-spam-timeouts" type="checkbox" checked>
            </div>
            <div class="toggle">
              <span>Analyze images with Llava</span>
              <input id="anti-spam-images" type="checkbox" checked>
            </div>
            <div class="field">
              <label for="anti-spam-text-rules">Custom Spam Regex Rules</label>
              <textarea id="anti-spam-text-rules" placeholder="One regex per line&#10;cheap\\s+nitro&#10;/discord\\.(gg|com\\/invite)\\/.*nsfw/i"></textarea>
            </div>
            <div class="field">
              <label for="anti-spam-link-rules">Blocked Link Wildcards</label>
              <textarea id="anti-spam-link-rules" placeholder="One wildcard per line&#10;discord.gg/*&#10;*.example-scamsite.com/*"></textarea>
            </div>
            <div class="field">
              <label>Every-Image Scan Channels</label>
              <div class="chip" id="anti-spam-image-scan-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="anti-spam-set-image-channel-button">Add Selected Channel</button>
              <button class="secondary" id="anti-spam-remove-image-channel-button">Remove Selected Channel</button>
              <button class="secondary" id="anti-spam-clear-image-channel-button">Clear All</button>
            </div>
            <div class="hint">Every image posted in any listed channel will be checked with Llava.</div>
            <div class="field">
              <label>Excluded Channels</label>
              <div class="chip" id="anti-spam-excluded-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="anti-spam-add-excluded-channel-button">Exclude Selected Channel</button>
              <button class="secondary" id="anti-spam-remove-excluded-channel-button">Unexclude Selected Channel</button>
              <button class="secondary" id="anti-spam-clear-excluded-channels-button">Clear Excludes</button>
            </div>
            <div class="hint">Excluded channels are ignored by anti-spam checks.</div>
            <div class="field">
              <label for="anti-spam-excluded-role-select">Excluded Roles</label>
              <select id="anti-spam-excluded-role-select"></select>
            </div>
            <div class="field">
              <label>Current Excluded Roles</label>
              <div class="chip" id="anti-spam-excluded-role-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="anti-spam-add-excluded-role-button">Exclude Selected Role</button>
              <button class="secondary" id="anti-spam-remove-excluded-role-button">Unexclude Selected Role</button>
              <button class="secondary" id="anti-spam-clear-excluded-roles-button">Clear Roles</button>
            </div>
            <div class="hint">Members with any excluded role are skipped by anti-spam moderation.</div>
            <div class="field">
              <label>Moderation Alert Channel</label>
              <div class="chip" id="anti-spam-alert-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="anti-spam-set-alert-channel-button">Use Selected Channel</button>
              <button class="secondary" id="anti-spam-clear-alert-channel-button">Disable Alert Channel</button>
            </div>
            <div class="hint">Flagged moderation events can post a copy of the message and image links there.</div>
            <h3 style="margin-top: 18px;">Honeypot Channel</h3>
            <div class="toggle">
              <span>Feature enabled</span>
              <input id="honeypot-enabled" type="checkbox">
            </div>
            <div class="field">
              <label>Honeypot Channel</label>
              <div class="chip" id="honeypot-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="honeypot-set-channel-button">Use Selected Channel</button>
              <button class="secondary" id="honeypot-clear-channel-button">Clear Channel</button>
            </div>
            <div class="field">
              <label>Triggers</label>
              <div class="toggle">
                <span>Text messages</span>
                <input id="honeypot-trigger-text" type="checkbox" checked>
              </div>
              <div class="toggle">
                <span>File uploads</span>
                <input id="honeypot-trigger-files" type="checkbox" checked>
              </div>
              <div class="toggle">
                <span>Links</span>
                <input id="honeypot-trigger-links" type="checkbox" checked>
              </div>
            </div>
            <div class="field">
              <label for="honeypot-immediate-action">Immediate Action</label>
              <select id="honeypot-immediate-action">
                <option value="timeout">Timeout</option>
                <option value="kick">Kick</option>
                <option value="ban">Ban</option>
              </select>
            </div>
            <div class="field">
              <label for="honeypot-timeout-minutes">Timeout Length (minutes)</label>
              <input id="honeypot-timeout-minutes" type="number" min="1" step="1">
            </div>
            <div class="toggle">
              <span>Remove triggering message</span>
              <input id="honeypot-remove-message" type="checkbox" checked>
            </div>
            <div class="field">
              <label>Protected Roles</label>
              <div class="chip" id="protected-roles-chip">Discord permissions only</div>
            </div>
            <div class="row">
              <button id="protected-add-role-button">Protect Selected Role</button>
              <button class="secondary" id="protected-remove-role-button">Unprotect Selected Role</button>
              <button class="secondary" id="protected-clear-roles-button">Clear Roles</button>
            </div>
            <div class="field">
              <label>Protected Users</label>
              <div class="chip" id="protected-users-chip">Discord permissions only</div>
            </div>
            <div class="row">
              <button id="protected-add-user-button">Protect Selected User</button>
              <button class="secondary" id="protected-remove-user-button">Unprotect Selected User</button>
              <button class="secondary" id="protected-clear-users-button">Clear Users</button>
            </div>
            <div class="hint">Protected users and roles bypass automated moderation actions in this server, even without Discord mod/admin permissions.</div>
            <div class="field">
              <label>Whitelisted Channels</label>
              <div class="chip" id="honeypot-excluded-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="honeypot-add-excluded-channel-button">Whitelist Selected Channel</button>
              <button class="secondary" id="honeypot-remove-excluded-channel-button">Unwhitelist Selected Channel</button>
              <button class="secondary" id="honeypot-clear-excluded-channels-button">Clear Channels</button>
            </div>
            <div class="field">
              <label for="honeypot-excluded-role-select">Whitelisted Roles</label>
              <select id="honeypot-excluded-role-select"></select>
            </div>
            <div class="field">
              <label>Current Whitelisted Roles</label>
              <div class="chip" id="honeypot-excluded-role-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="honeypot-add-excluded-role-button">Whitelist Selected Role</button>
              <button class="secondary" id="honeypot-remove-excluded-role-button">Unwhitelist Selected Role</button>
              <button class="secondary" id="honeypot-clear-excluded-roles-button">Clear Roles</button>
            </div>
            <div class="hint">Whitelisted channels and roles bypass honeypot actions and DMs.</div>
            <div class="field">
              <label>Backup Channel</label>
              <div class="chip" id="honeypot-backup-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="honeypot-set-backup-channel-button">Use Selected Channel</button>
              <button class="secondary" id="honeypot-clear-backup-channel-button">Clear Backup</button>
            </div>
            <div class="toggle">
              <span>DM user with verification button</span>
              <input id="honeypot-dm-enabled" type="checkbox" checked>
            </div>
            <div class="field">
              <label for="honeypot-dm-message">DM Message</label>
              <textarea id="honeypot-dm-message" placeholder="Explain why the user was stopped and how verification works."></textarea>
            </div>
            <div class="hint">Protected members are skipped by default when they have Administrator, Manage Messages, or Moderate Members, or when they are listed above as protected users/roles.</div>
            <div class="field">
              <label>Verification Review Channel</label>
              <div class="chip" id="honeypot-review-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="honeypot-set-review-channel-button">Use Selected Channel</button>
              <button class="secondary" id="honeypot-clear-review-channel-button">Clear Review Channel</button>
            </div>
            <div class="field">
              <label for="honeypot-post-verify-action">After Verify</label>
              <select id="honeypot-post-verify-action">
                <option value="remove-timeout">Remove Timeout</option>
                <option value="unban">Unban</option>
                <option value="none">Notify Only</option>
              </select>
            </div>
            <div class="field">
              <label for="honeypot-verification-window-days">Verification Window (days)</label>
              <input id="honeypot-verification-window-days" type="number" min="1" step="1">
            </div>
            <div class="field">
              <label for="honeypot-unverified-action">If Not Verified In Time</label>
              <select id="honeypot-unverified-action">
                <option value="ban">Ban</option>
                <option value="kick">Kick</option>
                <option value="none">Do Nothing</option>
              </select>
            </div>
            <div class="hint">Verification reversals only apply to actions Discord can undo automatically, so kick cases can notify staff but cannot restore the member on their own.</div>
            <div class="field">
              <label for="investigation-role-select">Investigation Role</label>
              <select id="investigation-role-select"></select>
            </div>
            <div class="field">
              <label>Current Investigation Role</label>
              <div class="chip" id="investigation-role-chip">Disabled</div>
            </div>
            <div class="field">
              <label for="investigation-role-name">New Role Name</label>
              <input id="investigation-role-name" placeholder="Discrod Investigation">
            </div>
            <div class="row">
              <button id="save-investigation-role-button">Use Selected Role</button>
              <button class="secondary" id="create-investigation-role-button">Create Role</button>
              <button class="secondary" id="clear-investigation-role-button">Clear Role</button>
            </div>
            <div class="hint">Confirmed scam-image cases can move the member into this role. It should block normal messaging.</div>
            <div class="field">
              <label for="temp-block-role-select">Temporary Image Block Role</label>
              <select id="temp-block-role-select"></select>
            </div>
            <div class="field">
              <label>Current Temporary Image Block Role</label>
              <div class="chip" id="temp-block-role-chip">Disabled</div>
            </div>
            <div class="field">
              <label for="temp-block-role-name">New Temp Role Name</label>
              <input id="temp-block-role-name" placeholder="Discrod Temp Image Block">
            </div>
            <div class="row">
              <button id="save-temp-block-role-button">Use Selected Temp Role</button>
              <button class="secondary" id="create-temp-block-role-button">Create Temp Role</button>
              <button class="secondary" id="clear-temp-block-role-button">Clear Temp Role</button>
            </div>
            <div class="hint">This role still allows text chat, but the bot and channel permissions will block image attachments and link previews while a scan is pending.</div>
            <div class="toggle" style="margin-top: 14px;">
              <span>Temporary image hold with temp block role</span>
              <input id="anti-spam-temp-hold-enabled" type="checkbox">
            </div>
            <div class="field">
              <label for="anti-spam-temp-hold-seconds">Temporary Hold (seconds)</label>
              <input id="anti-spam-temp-hold-seconds" type="number" min="0" step="1">
            </div>
            <div class="hint">When enabled, monitored image posts immediately get the temp block role, then lose it after the minimum hold window and a safe Llava result. Flagged posts can escalate into the investigation role.</div>
            <div class="field">
              <label>Flagged Image Categories</label>
              <div class="toggle">
                <span>Generic spam / scam</span>
                <input id="anti-spam-image-flag-spam" type="checkbox" checked>
              </div>
              <div class="toggle">
                <span>NSFW</span>
                <input id="anti-spam-image-flag-nsfw" type="checkbox" checked>
              </div>
              <div class="toggle">
                <span>Crypto spam</span>
                <input id="anti-spam-image-flag-crypto-spam" type="checkbox" checked>
              </div>
              <div class="toggle">
                <span>Crypto imagery</span>
                <input id="anti-spam-image-flag-crypto-image" type="checkbox" checked>
              </div>
            </div>
            <div class="field">
              <label for="anti-spam-window-seconds">Duplicate Window (seconds)</label>
              <input id="anti-spam-window-seconds" type="number" min="5" step="5">
            </div>
            <div class="field">
              <label for="anti-spam-timeout-minutes">Timeout Length (minutes)</label>
              <input id="anti-spam-timeout-minutes" type="number" min="1" step="1">
            </div>
            <button id="save-anti-spam-button">Save Anti-Spam Settings</button>
          </article>

          <article class="panel-card" data-subview-panel="moderation-simulator">
            <h3>Moderation Simulator</h3>
            <div class="hint">Test the current anti-spam rules and LazyDev image checks without sending or deleting anything in Discord.</div>
            <div class="field">
              <label for="moderation-test-text">Message Text</label>
              <textarea id="moderation-test-text" placeholder="Paste the message text you want to simulate."></textarea>
            </div>
            <div class="field">
              <label>Test Images</label>
              <div class="ai-dropzone" id="moderation-dropzone" tabindex="0">
                <div class="ai-dropzone-title">Drop or paste moderation test images</div>
                <div class="panel-subtitle">Accepts image files, image URLs, data URLs, and local file paths.</div>
              </div>
              <input id="moderation-image-input" type="file" accept="image/*" multiple hidden>
              <div class="row">
                <button class="secondary" id="browse-moderation-images-button">Browse Test Images</button>
                <button class="secondary" id="clear-moderation-images-button">Clear Test Images</button>
              </div>
              <div class="list compact-list" id="moderation-image-list"></div>
            </div>
            <div class="row">
              <button id="simulate-moderation-button">Run Simulation</button>
              <button class="secondary" id="clear-moderation-simulation-button">Clear Result</button>
            </div>
            <div class="output simulation-output" id="moderation-simulation-output">No moderation simulation run yet.</div>
          </article>

          <article class="panel-card" data-subview-panel="moderation-log">
            <h3>Moderation Log</h3>
            <div class="list tall-list" id="feed-moderation"></div>
          </article>
        </div>
      </section>
`;
}
