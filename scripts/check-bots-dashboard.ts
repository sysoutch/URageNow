import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderBotsDashboardHostView, renderBotsDashboardHtml } from "../dashboard/src/botsDashboardPage.js";
import { isBotsDashboardPath } from "../dashboard/src/server/discordOnlyScope.js";

const pageSource = await readFile(new URL("../dashboard/src/page.ts", import.meta.url), "utf8");
const runtimeSource = await readFile(new URL("../runtime/botsDashboardRuntime.ts", import.meta.url), "utf8");
const html = renderBotsDashboardHtml();
const host = renderBotsDashboardHostView();

assert.match(html, /messenger-dashboard-shell/);
assert.match(html, /data-bot="discord"/);
assert.match(html, /data-bot="telegram"/);
assert.match(html, /data-bot="matrix"/);
assert.match(html, /data-bot="whatsapp"/);
assert.match(html, /data-view="guild"/);
assert.match(html, /data-view="moderation"/);
assert.match(html, /data-view-panel="games"/);
assert.match(host, /loading="lazy"/);
assert.match(host, /data-src="\/bots-dashboard"/);
assert.doesNotMatch(pageSource, /renderDashboardMessengerDashboardView/);
assert.doesNotMatch(pageSource, /renderDashboardGamesView/);
assert.match(runtimeSource, /URAGE_DASHBOARD_SCOPE = "bots"/);
assert.equal(isBotsDashboardPath("GET", "/bots-dashboard"), true);
assert.equal(isBotsDashboardPath("GET", "/discord-dashboard"), false);
assert.equal(isBotsDashboardPath("GET", "/api/messenger-runtimes"), true);
assert.equal(isBotsDashboardPath("GET", "/api/tools"), false);

console.log("Shared standalone bots dashboard validation passed.");
