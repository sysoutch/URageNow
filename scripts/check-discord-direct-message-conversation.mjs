import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const controller = await readFile(new URL("../dashboard/src/client/modules/messenger/directMessageConversationController.js", import.meta.url), "utf8");
const rail = await readFile(new URL("../dashboard/src/client/modules/messenger/directMessageRailHelpers.js", import.meta.url), "utf8");
const bootstrap = await readFile(new URL("../dashboard/src/client/modules/studioRoutingMediaBootstrapHelpers.js", import.meta.url), "utf8");
const view = await readFile(new URL("../dashboard/src/features/discord/ui/messagingView.ts", import.meta.url), "utf8");

assert.match(controller, /\/api\/dm-messages\?channelId=/);
assert.match(controller, /state\.dmMessages/);
assert.match(controller, /selectConversation/);
assert.match(controller, /textContent = String\(message\.content/);
assert.match(rail, /selectDiscordDirectMessage\(item\.source\)/);
assert.match(bootstrap, /selectDiscordDirectMessage: thread => dashboardDirectMessageConversationController/);
assert.match(view, /id="dm-conversation-list"/);
assert.match(view, /id="refresh-dm-conversation-button"/);
assert.doesNotMatch(controller, /innerHTML\s*=/);

console.log("Discord direct-message conversation validation passed.");
