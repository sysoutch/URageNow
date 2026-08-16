import assert from "node:assert/strict";
import { createMessengerRuntimeManager } from "@urage/server/runtime/messengerRuntimeManager";
import { resolveMessengerRuntimeLaunch } from "@urage/server/runtime/messengerRuntimeLaunch";

const secureStoreLaunch = await resolveMessengerRuntimeLaunch({
  messenger: "discord",
  processEnv: { DISCORD_TOKEN_SECURE_STORE: "secure-store-token" }
});
assert.equal(secureStoreLaunch.credentialSource, "default");
assert.equal(secureStoreLaunch.discordToken, "secure-store-token");

const telegramLaunch = await resolveMessengerRuntimeLaunch({
  messenger: "telegram",
  processEnv: { TELEGRAM_BOT_TOKEN: "telegram-token" }
});
assert.equal(telegramLaunch.env.TELEGRAM_BOT_TOKEN, "telegram-token");

const matrixLaunch = await resolveMessengerRuntimeLaunch({
  messenger: "matrix",
  processEnv: { MATRIX_ACCESS_TOKEN: "matrix-token" }
});
assert.equal(matrixLaunch.env.MATRIX_ACCESS_TOKEN, "matrix-token");
assert.equal(matrixLaunch.env.MATRIX_HOMESERVER_URL, undefined);

const whatsappLaunch = await resolveMessengerRuntimeLaunch({
  messenger: "whatsapp",
  processEnv: { WHATSAPP_ACCESS_TOKEN: "whatsapp-token", WHATSAPP_PHONE_NUMBER_ID: "phone-id" }
});
assert.equal(whatsappLaunch.env.WHATSAPP_ACCESS_TOKEN, "whatsapp-token");

let receivedToken = "";
const manager = createMessengerRuntimeManager({
  startDiscord: async tokenOverride => {
    receivedToken = tokenOverride || "";
  },
  stopDiscord: async () => {},
  isDiscordRunning: () => false,
  telegram: { entryPath: "" },
  matrix: { entryPath: "" },
  whatsapp: { entryPath: "" }
});
await manager.control({
  messenger: "discord",
  action: "start",
  launchConfig: { credentialSource: "manual", discordToken: "manual-token" }
});
assert.equal(receivedToken, "manual-token");

console.log("Messenger runtime launch validation passed.");
