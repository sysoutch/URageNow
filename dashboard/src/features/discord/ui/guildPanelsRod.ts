export function renderDashboardGuildRodPanels(): string {
  return `
          <article class="panel-card" data-subview-panel="guild-rod">
            <h3>Rod Guild Tools</h3>
            <div class="hint">Let LazyDev draft multiple channels at once or review the selected guild for structure and permission suggestions.</div>
            <div class="field">
              <label for="guild-ai-prompt">Prompt</label>
              <textarea id="guild-ai-prompt" placeholder="Create a cozy indie game server with categories for announcements, devlogs, media sharing, bug reports, off-topic chat, and voice hangouts."></textarea>
            </div>
            <div class="row">
              <button id="plan-guild-channels-button">Plan Channels</button>
              <button class="secondary" id="run-guild-audit-button">Run Guild Audit</button>
            </div>
            <div class="field">
              <label>Planned Channels</label>
              <div class="list medium-list" id="guild-channel-plan-list"></div>
            </div>
            <div class="row">
              <button id="apply-guild-channel-plan-button">Create Planned Channels</button>
              <button class="secondary" id="clear-guild-channel-plan-button">Clear Plan</button>
            </div>
            <div class="output simulation-output" id="guild-ai-output">No LazyDev guild action run yet.</div>
          </article>
`;
}
