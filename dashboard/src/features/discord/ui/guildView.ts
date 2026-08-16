import { renderDashboardGuildOverviewPanels } from "./guildPanelsOverview.js";
import { renderDashboardGuildChannelsPanels } from "./guildPanelsChannels.js";
import { renderDashboardGuildBotPanels } from "./guildPanelsBot.js";
import { renderDashboardGuildInvitesCommandsPanels } from "./guildPanelsInvitesCommands.js";
import { renderDashboardGuildRodPanels } from "./guildPanelsRod.js";

export function renderDashboardGuildView(): string {
  return `
      <section class="view" data-view-panel="guild" data-discord-only="true">
        <article class="panel-card feature-card guild-overview-card">
          <div class="panel-heading">
            <div class="panel-kicker">Guild Workspace</div>
            <h3>Server Setup</h3>
            <div class="panel-subtitle">Shape channels, invites, commands, bot behavior, and LazyDev-powered server tools from one place.</div>
          </div>
        </article>
        <div class="tabs workspace-subtabs">
          <button class="ghost active" data-subview="guild-overview">People</button>
          <button class="ghost" data-subview="guild-channels">Channels</button>
          <button class="ghost" data-subview="guild-invites">Invites</button>
          <button class="ghost" data-subview="guild-bot">Bot</button>
          <button class="ghost" data-subview="guild-commands">Commands</button>
          <button class="ghost" data-subview="guild-rod">Rod Tools</button>
        </div>
        <div class="content-grid two-up guild-grid">
${renderDashboardGuildOverviewPanels()}
${renderDashboardGuildChannelsPanels()}
${renderDashboardGuildBotPanels()}
${renderDashboardGuildInvitesCommandsPanels()}
${renderDashboardGuildRodPanels()}
        </div>
      </section>
`;
}
