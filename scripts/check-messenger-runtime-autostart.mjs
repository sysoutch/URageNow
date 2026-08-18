import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath => readFileSync(path.join(root, relativePath), "utf8");
const appConfig = read("server/src/config/appConfig.ts");
const runtimeState = read("server/src/runtime/runtimeState.ts");
const entrypoint = read("bots/discord-bot/src/index.ts");
const settingsRoute = read("dashboard/src/features/discord/server/routes/settingsAndGuildRoutes.ts");
const page = read("dashboard/src/page.ts");
const settingsClient = read("dashboard/src/client/modules/settingsRuntimeHelpers.js");

assert.match(appConfig, /DISCORD_RUNTIME_AUTOSTART", false/);
for (const messenger of ["discord", "telegram", "matrix", "whatsapp"]) {
  const setting = `${messenger}RuntimeAutostart`;
  assert.match(runtimeState, new RegExp(setting));
  assert.match(settingsRoute, new RegExp(setting));
}
assert.match(entrypoint, /URAGE_DISABLE_MESSENGER_AUTOSTART/);
assert.match(entrypoint, /createLocalMessengerHealthCheck/);
assert.match(entrypoint, /messengerRuntimeSettings\.discordRuntimeAutostart|runtimeState\.getGlobalDashboardSettings\(\)\.discordRuntimeAutostart/);
assert.match(page, /messenger-runtime-autostart-checkbox/);
assert.match(page, /settings-discord-runtime-autostart/);
assert.match(page, /data-settings-subtab="messengers"/);
assert.match(page, /headless server batch never autostarts messenger bots/);
assert.match(settingsClient, /\[messenger \+ "RuntimeAutostart"\]/);
assert.match(settingsClient, /saveDiscordRuntimeAutostartFromSettings/);

console.log("Messenger runtime autostart policy validation passed.");
