export function renderDashboardGuildBotPanels(): string {
  return `
          <article class="panel-card guild-card" data-subview-panel="guild-bot">
            <h3>Bot Mode</h3>
            <div class="hint">Choose how Discrod behaves in this server. "Act on user behalf" stays a safe proxy mode, not real user-account impersonation.</div>
            <div class="field">
              <label for="bot-mode-select">Server Bot Mode</label>
              <select id="bot-mode-select">
                <option value="normal">Normal bot</option>
                <option value="act-on-user-behalf">Act on user behalf</option>
                <option value="act-on-itself">Act on itself</option>
              </select>
            </div>
            <div class="field">
              <label for="bot-acting-preset-select">Proxy Persona</label>
              <select id="bot-acting-preset-select">
                <option value="user">User</option>
                <option value="mod">Mod</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="field">
              <label>Autonomous Status Channel</label>
              <div class="chip" id="autonomous-status-channel-chip">Disabled</div>
            </div>
            <div class="row">
              <button id="bot-mode-use-selected-channel-button">Use Selected Channel</button>
              <button class="secondary" id="bot-mode-clear-status-channel-button">Clear Status Channel</button>
            </div>
            <div class="toggle">
              <span>Autonomous heartbeat</span>
              <input id="autonomous-heartbeat-enabled" type="checkbox">
            </div>
            <div class="field">
              <label for="autonomous-heartbeat-minutes">Heartbeat Minutes</label>
              <input id="autonomous-heartbeat-minutes" type="number" min="1" step="1">
            </div>
            <div class="toggle">
              <span>Autonomous reply to mentions</span>
              <input id="autonomous-reply-to-mentions" type="checkbox">
            </div>
            <div class="field">
              <label>Verified Image Pool Roles</label>
              <div class="chip" id="image-pool-verified-roles-chip">Admins only</div>
            </div>
            <div class="row">
              <button id="image-pool-add-role-button">Add Selected Role</button>
              <button class="secondary" id="image-pool-remove-role-button">Remove Selected Role</button>
              <button class="secondary" id="image-pool-clear-roles-button">Clear Roles</button>
            </div>
            <div class="field">
              <label>Verified Image Pool Users</label>
              <div class="chip" id="image-pool-verified-users-chip">Admins only</div>
            </div>
            <div class="row">
              <button id="image-pool-add-user-button">Add Selected User</button>
              <button class="secondary" id="image-pool-remove-user-button">Remove Selected User</button>
              <button class="secondary" id="image-pool-clear-users-button">Clear Users</button>
            </div>
            <div class="hint">Admins can always add images to verified pools. Everyone else is sent to their own unverified pool unless they are allow-listed here.</div>
            <div class="field">
              <label for="media-reaction-rules-json">Media Reaction Rules</label>
              <textarea id="media-reaction-rules-json" placeholder='[
  {
    "enabled": true,
    "sourceChannelId": "channel that receives uploads",
    "resultChannelId": "channel for generated results",
    "allowedRoleIds": [],
    "allowedUserIds": [],
    "imageActions": ["generate-3d-model", "create-pixel-art"],
    "modelActions": ["generate-lowpoly", "generate-highpoly"]
  }
]'></textarea>
              <div class="hint">Rules define which channel, role, or user uploads should offer image/model actions and where results are posted back.</div>
            </div>
            <div class="field">
              <label>Safety</label>
              <label class="toggle compact-toggle">
                <span>Require mention or reply</span>
                <input id="bot-safety-require-mention" type="checkbox">
              </label>
              <label class="toggle compact-toggle">
                <span>Suggest only</span>
                <input id="bot-safety-suggest-only" type="checkbox">
              </label>
              <label class="toggle compact-toggle">
                <span>Allow role suggestions</span>
                <input id="bot-safety-role-suggestions" type="checkbox">
              </label>
              <label class="toggle compact-toggle">
                <span>Allow chat-triggered self tasks</span>
                <input id="bot-safety-chat-self-tasks" type="checkbox">
              </label>
              <label class="toggle compact-toggle">
                <span>Chat self tasks admin-only</span>
                <input id="bot-safety-chat-self-tasks-admin-only" type="checkbox" checked>
              </label>
              <div class="field">
                <label for="bot-safety-chat-task-confidence">Chat task confidence %</label>
                <input id="bot-safety-chat-task-confidence" type="number" min="0" max="100" step="1" value="85">
              </div>
              <label class="toggle compact-toggle">
                <span>Allow channel suggestions</span>
                <input id="bot-safety-channel-suggestions" type="checkbox">
              </label>
              <label class="toggle compact-toggle">
                <span>Allow promotion suggestions</span>
                <input id="bot-safety-promotion-suggestions" type="checkbox">
              </label>
            </div>
            <div class="field">
              <label>Rod Self Task Safety</label>
              <label class="toggle compact-toggle">
                <span>Dry run only</span>
                <input id="self-task-dry-run-only" type="checkbox">
              </label>
              <label class="toggle compact-toggle">
                <span>Allow create channels</span>
                <input data-self-task-action="create_channel" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow send messages</span>
                <input data-self-task-action="send_message" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow create threads</span>
                <input data-self-task-action="create_thread" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow create posts</span>
                <input data-self-task-action="create_post" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow edit bot messages</span>
                <input data-self-task-action="edit_bot_message" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow create roles</span>
                <input data-self-task-action="create_role" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow channel role access changes</span>
                <input data-self-task-action="set_channel_role_permissions" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow rename roles</span>
                <input data-self-task-action="rename_role" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow assign multiple roles</span>
                <input data-self-task-action="assign_roles" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow assign roles</span>
                <input data-self-task-action="assign_role" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow remove multiple roles</span>
                <input data-self-task-action="remove_roles" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow remove roles</span>
                <input data-self-task-action="remove_role" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow move channels</span>
                <input data-self-task-action="move_channel" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow rename channels</span>
                <input data-self-task-action="rename_channel" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow channel setting updates</span>
                <input data-self-task-action="update_channel_settings" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow list roles</span>
                <input data-self-task-action="list_roles" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow list channels</span>
                <input data-self-task-action="list_channels" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow list members</span>
                <input data-self-task-action="list_members" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow list invites</span>
                <input data-self-task-action="list_invites" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow create invites</span>
                <input data-self-task-action="create_invite" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow delete invites</span>
                <input data-self-task-action="delete_invite" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow replace invites</span>
                <input data-self-task-action="replace_invite" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow slowmode changes</span>
                <input data-self-task-action="set_channel_slowmode" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow archive threads</span>
                <input data-self-task-action="archive_thread" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow lock threads</span>
                <input data-self-task-action="lock_thread" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow welcome channel setup</span>
                <input data-self-task-action="set_welcome_channel" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow welcome message setup</span>
                <input data-self-task-action="set_welcome_message" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow member counter setup</span>
                <input data-self-task-action="set_member_counter" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow chat mode setup</span>
                <input data-self-task-action="set_chat_mode" type="checkbox" checked>
              </label>
              <label class="toggle compact-toggle">
                <span>Allow permission explanations</span>
                <input data-self-task-action="explain_channel_permissions" type="checkbox" checked>
              </label>
            </div>
            <div class="hint">This saves server-wide bot behavior and self-task safety only. Channel chat mode is separate below and is saved per selected channel.</div>
            <button id="save-bot-mode-button">Save Server Bot Mode</button>
          </article>

          <article class="panel-card guild-card" data-subview-panel="guild-bot">
            <h3>Channel Chat Mode</h3>
            <div class="hint">Enable chat mode for the selected channel, then allow only specific roles or users to trigger bot replies there. This section is separate from the server bot mode above.</div>
            <div class="field">
              <label>Selected Channel</label>
              <div class="chip" id="chat-mode-channel-chip">No channel selected</div>
            </div>
            <div class="toggle">
              <span>Chat mode enabled</span>
              <input id="chat-mode-enabled" type="checkbox">
            </div>
            <div class="toggle">
              <span>Require mention or reply in this channel</span>
              <input id="chat-mode-require-mention" type="checkbox">
            </div>
            <div class="field">
              <label for="chat-mode-cooldown-seconds">Cooldown Seconds</label>
              <input id="chat-mode-cooldown-seconds" type="number" min="0" step="1">
            </div>
            <div class="field">
              <label for="chat-mode-system-prompt">Channel Prompt</label>
              <textarea id="chat-mode-system-prompt" placeholder="Be extra concise, helpful, and focus on game-dev questions in this channel."></textarea>
            </div>
            <div class="field">
              <label>Allowed Roles</label>
              <div class="chip" id="chat-mode-allowed-roles-chip">None</div>
            </div>
            <div class="row">
              <button id="chat-mode-add-role-button">Add Selected Role</button>
              <button class="secondary" id="chat-mode-remove-role-button">Remove Selected Role</button>
              <button class="secondary" id="chat-mode-clear-roles-button">Clear Roles</button>
            </div>
            <div class="field">
              <label>Allowed Users</label>
              <div class="chip" id="chat-mode-allowed-users-chip">None</div>
            </div>
            <div class="row">
              <button id="chat-mode-add-user-button">Add Selected User</button>
              <button class="secondary" id="chat-mode-remove-user-button">Remove Selected User</button>
              <button class="secondary" id="chat-mode-clear-users-button">Clear Users</button>
            </div>
            <div class="field">
              <label>Last Chat Mode Decision</label>
              <div class="info-card" id="chat-mode-debug-card">
                <div class="info-card-title" id="chat-mode-debug-status">No chat-mode activity yet.</div>
                <div class="info-card-copy" id="chat-mode-debug-reason">Pick a channel with chat mode to see why messages were answered or ignored.</div>
                <div class="info-card-meta" id="chat-mode-debug-meta">No recent event.</div>
              </div>
            </div>
            <button id="save-chat-mode-button">Save Selected Channel Chat Mode</button>
          </article>
`;
}
