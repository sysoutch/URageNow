import assert from "node:assert/strict";
import { isDiscordOnlyDashboardPath } from "../dashboard/src/server/discordOnlyScope.js";
import { renderDiscordOnlyDashboardHtml } from "../dashboard/src/discordOnlyDashboardPage.js";

for (const path of ["/", "/api/discord/status", "/api/guilds", "/api/command-settings", "/api/games", "/api/discord/automations"]) {
  assert.equal(isDiscordOnlyDashboardPath("GET", path), true, path);
}
for (const path of ["/api/discord/runtime", "/api/send-message", "/api/send-dm", "/api/discord/moderation"]) {
  assert.equal(isDiscordOnlyDashboardPath("POST", path), true, path);
}
for (const path of ["/tools/example", "/android-companion", "/api/model3d-history", "/api/messenger-runtimes", "/api/ollama-models", "/api/ask-to-channel"]) {
  assert.equal(isDiscordOnlyDashboardPath("GET", path), false, path);
  assert.equal(isDiscordOnlyDashboardPath("POST", path), false, path);
}
const page = renderDiscordOnlyDashboardHtml();
for (const tab of ["overview", "guild", "commands", "messaging", "automation", "moderation", "games", "activity"]) {
  assert.match(page, new RegExp(`data-tab="${tab}"`));
}
assert.match(page, /games-installed-list/);
assert.doesNotMatch(page, /data-tab="(?:lazydev|tools|companion)"/i);
console.log("Discord-only dashboard scope and page validation passed.");
