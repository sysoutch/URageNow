import { readFileSync } from "node:fs";
import { renderDashboardMessengerDashboardView } from "./pageSections/messengerDashboardView.js";
import { renderDashboardMessengerView } from "./pageSections/messengerView.js";
import { renderDashboardGamesView } from "./pageSections/gamesView.js";
import { renderDashboardAutomationView } from "./pageSections/automationView.js";
import { renderDashboardActivityView } from "./pageSections/activityView.js";
import { renderDashboardGuildView } from "./features/discord/ui/guildView.js";
import { renderDashboardMessagingView } from "./features/discord/ui/messagingView.js";
import { renderDashboardModerationView } from "./features/discord/ui/moderationView.js";

function inlineAsset(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/<\/script/gi, "<\\/script");
}

/** The standalone host composes the same bot view functions used by Studio. */
export function renderBotsDashboardHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>URage Now · Bots</title><style>${inlineAsset("./generated.css")}</style>
<style>
body{margin:0;min-height:100vh;background:var(--bg,#101418)}.bots-host{max-width:1300px;margin:auto;padding:18px}.bots-host-header{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:15px}.bots-host-header>.row{display:flex!important;flex-wrap:wrap;justify-content:flex-end;gap:8px}.bots-host-header>.row button{width:auto!important;min-width:82px}.bots-host-header h1{margin:0;font-size:1.5rem}.bots-host-header p{margin:4px 0;color:var(--muted)}.bots-host-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px}.bots-workspace-tabs{margin-bottom:15px}.bots-host .view{display:none;width:100%}.bots-host .view.active{display:block}.bots-host .messenger-dashboard-view.active{display:block}.bots-host .messenger-dashboard-shell{height:auto}.bots-host .panel-card{margin-bottom:12px}.bots-host [data-messenger-panel]{display:none}.bots-host [data-messenger-panel].active{display:block}.bots-host .messenger-dashboard-head-actions #messenger-dashboard-open-browser-button,.bots-host .messenger-dashboard-head-actions #messenger-dashboard-runtime-button,.bots-host .messenger-dashboard-head-actions #messenger-dashboard-send-message-button,.bots-host #messenger-dashboard-view-bot-button,.bots-host #messenger-dashboard-view-server-button,.bots-host #messenger-new-chat-button,.bots-host .messenger-dashboard-head .dashboard-tabs{display:none}.bots-host .messenger-dashboard-fetch-controls{display:none}.bots-host-notice{min-height:22px;color:var(--warm,#ffb68d)}.bots-host .messenger-dashboard-stat-grid{margin-bottom:14px}section[hidden]{display:none!important}.bots-host [hidden],.bots-host .messenger-dashboard-header-card>.dashboard-tabs{display:none!important}.bots-host button{font:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:7px 14px;border:1px solid color-mix(in srgb,var(--line) 82%,transparent);border-radius:var(--dashboard-buttons-radius,8px);background:var(--panel-alt);color:var(--ink)}.bots-host button:hover:not(:disabled){border-color:var(--accent)}.bots-host button:disabled{opacity:.45;cursor:not-allowed}.bots-host-nav button.active,.bots-host #bots-start:not(:disabled){border-color:var(--accent);background:var(--accent);color:#16120e}@media(max-width:700px){.bots-host{padding:12px}.bots-host-header{display:block}.bots-host-header>.row{justify-content:flex-start;margin-top:12px}}
</style></head>
<body class="messenger-discord view-dashboard-active" data-dashboard-scope="bots"><main class="bots-host" id="dashboard-app">
<header class="bots-host-header"><div><h1>URage Now · Bots</h1><p>Discord, Telegram, Matrix, and WhatsApp</p></div><div class="row"><button id="bots-start" type="button">Start</button><button id="bots-stop" class="secondary" type="button">Stop</button><button id="bots-restart" class="secondary" type="button">Restart</button><button id="bots-refresh" class="secondary" type="button">Refresh</button></div></header>
<nav class="bots-host-nav" aria-label="Bot dashboards"><button type="button" data-bot="discord" class="active">Discord</button><button type="button" data-bot="telegram">Telegram</button><button type="button" data-bot="matrix">Matrix</button><button type="button" data-bot="whatsapp">WhatsApp</button></nav>
<p id="bots-notice" class="bots-host-notice" role="status" aria-live="polite"></p>
<nav class="dashboard-tabs bots-workspace-tabs" aria-label="Bot workspace"><button class="ghost active" data-bots-view="dashboard" type="button">Overview</button><button class="ghost" data-bots-view="messaging" data-discord-only="true" type="button">Messages</button><button class="ghost" data-bots-view="messenger" data-non-discord-only="true" type="button">Messages</button><button class="ghost" data-bots-view="guild" data-discord-only="true" type="button">Guild</button><button class="ghost" data-bots-view="moderation" data-discord-only="true" type="button">Moderation</button><button class="ghost" data-bots-view="games" data-discord-only="true" type="button">Games</button><button class="ghost" data-bots-view="automation" type="button">Automation</button><button class="ghost" data-bots-view="activity" type="button">Activity</button></nav>
${renderDashboardMessengerDashboardView()}
${renderDashboardMessengerView()}
${renderDashboardMessagingView()}
${renderDashboardGuildView()}
${renderDashboardModerationView()}
${renderDashboardGamesView()}
${renderDashboardAutomationView({ model3dInitialThreadExtraText: "", model3dDestinationExtraText: "" })}
${renderDashboardActivityView()}
</main><script>${inlineAsset("./botsDashboardClient.js")}</script><script>${inlineAsset("./client/modules/gamesDashboard.js")}</script></body></html>`;
}

export function renderBotsDashboardHostView(): string {
  return `
    <section class="view bots-dashboard-host-view" data-view-panel="dashboard">
      <iframe id="bots-dashboard-frame" class="bots-dashboard-frame" title="Bots dashboard" loading="lazy" data-src="/bots-dashboard"></iframe>
    </section>`;
}
